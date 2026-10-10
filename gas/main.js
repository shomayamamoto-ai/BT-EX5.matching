// ============================================
// gas/main.js — 共有サーバー(Google Apps Script)の入口
//
// スプレッドシートに紐づいた Apps Script として動かす。判定の本体は
// auth/server-core.js(ブラウザ内デモと同じコード)で、ここではデータの
// 保存先をスプレッドシートにして、Web アプリとして公開する。
// tools/build-gas.mjs が referral/data.js・auth/server-core.js と
// このファイルをつないで gas/Code.gs を作る(Code.gs を直接編集しない)。
//
// 保存:
//   「_data」シート … 全データの JSON を 4万文字ずつ A 列に分けて保存(非表示)
//   「名簿」「紹介の記録」「ありがとうマイル」「定例会の出欠」「ビジター」「1on1」シート
//     … 運営者が見るための一覧(書き込みのたびに更新。ここを書き換えてもサイトには反映されない)
// 同時アクセスはスクリプトロックで1件ずつ処理する。
// ============================================

/**
 * @OnlyCurrentDoc
 */

var DATA_SHEET = "_data";
var CHUNK_SIZE = 40000; // セルの上限(5万文字)より小さく
var STATUS_LABELS_JA = { new: "未対応", contacted: "連絡済み", meeting: "商談中", won: "成約", lost: "見送り" };
var VISITOR_LABELS_JA = { invited: "招待中", applied: "参加申込", attended: "参加済み", joined: "入会", declined: "見送り" };
var RSVP_LABELS_JA = { yes: "出席", no: "欠席" };

function spreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function dataSheet_() {
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DATA_SHEET);
    sh.getRange("A:A").setNumberFormat("@");
    sh.hideSheet();
  }
  return sh;
}

function loadDb_() {
  var sh = dataSheet_();
  var last = sh.getLastRow();
  if (last < 1) return null;
  // 各セルの先頭1文字は目印("j")。数式や数値として解釈されるのを防ぐ
  var text = sh.getRange(1, 1, last, 1).getValues()
    .map(function (r) { return String(r[0]).slice(1); })
    .join("");
  if (!text) return null;
  return JSON.parse(text); // 壊れていたら例外 → SERVER_ERROR(データを上書きしない)
}

function saveDb_(db) {
  var sh = dataSheet_();
  var text = JSON.stringify(db);
  var rows = [];
  for (var i = 0; i < text.length; i += CHUNK_SIZE) rows.push(["j" + text.slice(i, i + CHUNK_SIZE)]);
  sh.getRange(1, 1, rows.length, 1).setValues(rows);
  var last = sh.getLastRow();
  if (last > rows.length) sh.getRange(rows.length + 1, 1, last - rows.length, 1).clearContent();
}

// Utilities.getUuid()(UUID v4)から乱数を取り出す。版・種別の桁を含むバイトは使わない
function randomBytes_(n) {
  var out = [];
  while (out.length < n) {
    var hex = Utilities.getUuid().replace(/-/g, "");
    for (var i = 0; i + 1 < hex.length; i += 2) {
      if (i === 12 || i === 16) continue;
      out.push(parseInt(hex.substr(i, 2), 16));
    }
  }
  return out.slice(0, n);
}

// ---------- Google カレンダー(定例会・1on1 の予定と Google Meet) ----------
// Apps Script の「サービス」で「Google Calendar API」を追加すると使える(gas/README.md)。
// 予定は運営者のアカウントに作る専用カレンダー「BT-EX5 定例会・1on1」に入れる(1on1 は2人に招待を送る)
var CALENDAR_PROP = "BTEX5_1ON1_CALENDAR_ID";
function oneOnOneCalendarId_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CALENDAR_PROP);
  if (id && CalendarApp.getCalendarById(id)) return id;
  var cal = CalendarApp.createCalendar("BT-EX5 定例会・1on1", { timeZone: "Asia/Tokyo" });
  props.setProperty(CALENDAR_PROP, cal.getId());
  return cal.getId();
}
function calTime_(date, time) {
  return { dateTime: date + "T" + time + ":00+09:00", timeZone: "Asia/Tokyo" };
}
var CALENDAR_ = typeof Calendar === "undefined" ? null : {
  upsert: function (x) {
    var calId = oneOnOneCalendarId_();
    var nextDay = function (d) {
      var t = new Date(d + "T00:00:00+09:00");
      t.setDate(t.getDate() + 1);
      return Utilities.formatDate(t, "Asia/Tokyo", "yyyy-MM-dd");
    };
    var ev = {
      summary: x.title,
      description: x.description,
      location: x.location || "",
      start: x.start ? calTime_(x.date, x.start) : { date: x.date },
      // 日付をまたぐ 1on1(22:30〜翌3:00 など)は、終わりの日付 x.endDate を使う
      end: x.start ? calTime_(x.endDate || x.date, x.end) : { date: nextDay(x.date) },
      attendees: (x.guests || []).map(function (e) { return { email: e }; }),
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
    };
    var opts = { conferenceDataVersion: 1, sendUpdates: "all" };
    var result;
    if (x.meet) {
      ev.conferenceData = { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
    }
    if (x.id) {
      // 既にある Meet はそのまま使う(作り直すと URL が変わるため)
      try {
        var cur = Calendar.Events.get(calId, x.id);
        if (x.meet && cur.conferenceData) ev.conferenceData = cur.conferenceData;
        if (!x.meet) ev.conferenceData = null;
        result = Calendar.Events.patch(ev, calId, x.id, opts);
      } catch (err) {
        result = Calendar.Events.insert(ev, calId, opts);
      }
    } else {
      result = Calendar.Events.insert(ev, calId, opts);
    }
    return { id: result.id, meetUrl: result.hangoutLink || "", link: result.htmlLink || "" };
  },
  remove: function (id) {
    Calendar.Events.remove(oneOnOneCalendarId_(), id, { sendUpdates: "all" });
  },
};

// ---------- Google Meet の参加記録(出欠の自動判定) ----------
// Google Meet REST API で、会議に参加した人の表示名と参加時間(分)を読む。
// 使うには gas/README.md の手順(Google Cloud のプロジェクトで「Google Meet REST API」を有効にする)が必要
function meetGet_(url) {
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error("Meet API " + res.getResponseCode() + " " + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText());
}
function meetList_(url, key) {
  var out = [], token = "";
  do {
    var page = meetGet_(url + (url.indexOf("?") === -1 ? "?" : "&") + "pageSize=100" + (token ? "&pageToken=" + encodeURIComponent(token) : ""));
    out = out.concat(page[key] || []);
    token = page.nextPageToken || "";
  } while (token);
  return out;
}
var MEET_ = {
  attendance: function (meetUrl) {
    var m = String(meetUrl).match(/meet\.google\.com\/([a-z0-9-]+)/i);
    if (!m) return [];
    var API = "https://meet.googleapis.com/v2/";
    var space = meetGet_(API + "spaces/" + m[1]);
    var records = meetList_(API + "conferenceRecords?filter=" + encodeURIComponent('space.name="' + space.name + '"'), "conferenceRecords");
    var totals = {};
    records.forEach(function (rec) {
      meetList_(API + rec.name + "/participants", "participants").forEach(function (p) {
        var name = (p.signedinUser && p.signedinUser.displayName) || (p.anonymousUser && p.anonymousUser.displayName) || (p.phoneUser && p.phoneUser.displayName) || "";
        var ms = 0;
        meetList_(API + p.name + "/participantSessions", "participantSessions").forEach(function (sess) {
          if (!sess.startTime) return;
          var end = sess.endTime ? new Date(sess.endTime) : new Date();
          ms += Math.max(0, end - new Date(sess.startTime));
        });
        if (name) totals[name] = (totals[name] || 0) + ms;
      });
    });
    return Object.keys(totals).map(function (n) { return { name: n, minutes: Math.round(totals[n] / 60000) }; });
  },
};

// ---------- プッシュ通知(iPhone・Android・パソコン) ----------
// 送り手の鍵(VAPID)は初回に作ってスクリプトのプロパティに保存する(サイトには公開鍵だけを渡す)。
// 送るのは中身のない合図だけで、端末が会員サイトから中身を取りに来る(gas/webpush.js)
var VAPID_PROP = "BTEX5_VAPID_KEYS";
function vapidKeys_() {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty(VAPID_PROP);
  if (saved) return JSON.parse(saved);
  var keys = WebPush.generateKeys(randomBytes_);
  props.setProperty(VAPID_PROP, JSON.stringify(keys));
  return keys;
}
// Apps Script のバイト列は -128〜127。0〜255 との相互変換
function toSigned_(bytes) { return bytes.map(function (b) { return b > 127 ? b - 256 : b; }); }
function toUnsigned_(bytes) { return bytes.map(function (b) { return b & 255; }); }
function sha256Bytes_(bytes) { return toUnsigned_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toSigned_(bytes))); }
function hmacBytes_(key, msg) { return toUnsigned_(Utilities.computeHmacSha256Signature(toSigned_(msg), toSigned_(key))); }

// 送り先のサービス(Apple・Google・Mozilla)ごとの署名は 11時間使い回す(署名の計算は重いため)
function vapidAuth_(endpoint, subject) {
  var aud = String(endpoint).match(/^https:\/\/[^/]+/)[0];
  var cache = CacheService.getScriptCache();
  var key = "vapid:" + aud;
  var hit = cache.get(key);
  if (hit) return hit;
  var header = WebPush.vapidHeader(endpoint, vapidKeys_(), subject, Math.floor(Date.now() / 1000), sha256Bytes_, hmacBytes_);
  cache.put(key, header, 11 * 60 * 60);
  return header;
}

// 合図を送る(スクリプトロックを外してから呼ぶ)。届かなくなった端末は名簿から消す
function sendPushes_(job) {
  if (!job || !job.subs || !job.subs.length) return;
  var subject = job.subject || "https://github.com/";
  var requests = job.subs.map(function (s) {
    return {
      url: s.endpoint,
      method: "post",
      headers: { TTL: "86400", Urgency: "normal", Authorization: vapidAuth_(s.endpoint, subject) },
      payload: "",
      muteHttpExceptions: true,
    };
  });
  var gone = [];
  UrlFetchApp.fetchAll(requests).forEach(function (res, i) {
    var code = res.getResponseCode();
    if (code === 404 || code === 410) gone.push(job.subs[i].endpoint);
    else if (code >= 300) console.warn("push " + code + " " + res.getContentText().slice(0, 200));
  });
  if (gone.length) {
    var lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
      try { SERVER_.runJob("dropPushSubs", gone); } finally { lock.releaseLock(); }
    }
  }
}

var SERVER_ = BtexServerCore.createServer({
  load: loadDb_,
  save: saveDb_,
  randomBytes: randomBytes_,
  calendar: CALENDAR_,
  meet: MEET_,
  push: { publicKey: function () { return vapidKeys_().publicKey; } },
  onError: function (err) { console.error(err && err.stack ? err.stack : err); },
});

// ---------- 運営者向けの一覧シート ----------
// 入力値が「=」「+」「-」「@」で始まると数式として扱われるため、先頭に ' を付ける
function cell_(v) {
  var s = Array.isArray(v) ? v.join("、") : String(v === undefined || v === null ? "" : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function writeSheet_(name, header, rows) {
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  var values = [header].concat(rows);
  sh.getRange(1, 1, values.length, header.length).setValues(values);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight("bold");
}

function fmtTime_(ms) {
  return ms ? Utilities.formatDate(new Date(ms), "Asia/Tokyo", "yyyy/MM/dd HH:mm") : "";
}

function refreshSheets_() {
  var db = loadDb_();
  if (!db) return;
  var members = db.referralMembers || [];
  var onlineLabels = { all: "全国対応", partial: "打合せのみ可", none: "対面のみ", unknown: "未入力" };
  writeSheet_(
    "名簿",
    ["ID", "氏名", "会社名・肩書き", "所属チーム", "拠点", "業種", "事業内容", "主なお客様", "紹介特典", "自己紹介文", "求める紹介", "こんな話が出たら", "対面", "オンライン", "資料・リンク", "最終更新", "更新した人"],
    members.map(function (m) {
      var links = (m.links || []).map(function (l) { return (l.label || l.type) + " " + l.url; }).join("\n");
      return [m.id, m.name, m.company, m.team, m.base, m.category, m.business, m.customers, m.offer, m.selfIntro, m.wants, m.triggers, m.face, onlineLabels[m.online] || "", links, fmtTime_(m.editedAt), m.editedBy === "self" ? "本人" : m.editedBy === "admin" ? "管理者" : ""].map(cell_);
    })
  );
  var memberName = function (id) {
    var m = members.filter(function (x) { return x.id === id; })[0];
    return m ? m.name : "(削除されたメンバー)";
  };
  var userName = function (userId) {
    var u = (db.users || []).filter(function (x) { return x.userId === userId; })[0];
    return u ? u.name : "退会した会員";
  };
  writeSheet_(
    "紹介の記録",
    ["日時", "紹介した人", "紹介先", "紹介した相手", "メモ", "状況", "状況の更新"],
    (db.referralLogs || []).slice().reverse().map(function (l) {
      return [fmtTime_(l.at), userName(l.fromUserId), memberName(l.toMemberId), l.prospect, l.memo, STATUS_LABELS_JA[l.status] || "", fmtTime_(l.statusAt)].map(cell_);
    })
  );
  writeSheet_(
    "ありがとうマイル",
    ["日時", "お礼をした人(仕事を受けた人)", "紹介してくれた人", "金額(円)", "メッセージ"],
    (db.thanks || []).slice().reverse().map(function (t) {
      return [fmtTime_(t.at), memberName(t.from), memberName(t.to), String(t.amount), t.message].map(cell_);
    })
  );
  var events = (db.events || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var rsvpRows = [];
  events.forEach(function (e) {
    members.forEach(function (m) {
      var r = (e.rsvps || {})[m.id] || "";
      var att = (e.attended || []).indexOf(m.id) !== -1;
      if (!r && !att && (e.meetMinutes || {})[m.id] === undefined) return;
      var late = (e.late || []).indexOf(m.id) !== -1;
      var min = (e.meetMinutes || {})[m.id];
      rsvpRows.push([e.date, e.title, m.name, m.team, RSVP_LABELS_JA[r] || "", att ? (late ? "遅刻早退" : "出席") : "", min === undefined ? "" : String(min)].map(cell_));
    });
  });
  writeSheet_("定例会の出欠", ["日付", "定例会", "氏名", "チーム", "出欠の回答", "出欠(結果)", "Meet の参加(分)"], rsvpRows);
  var eventTitle = function (id) {
    var e = events.filter(function (x) { return x.id === id; })[0];
    return e ? e.date + " " + e.title : "";
  };
  writeSheet_(
    "ビジター",
    ["招待した日", "招待した人", "定例会", "お名前", "会社名", "事業内容", "連絡先", "ひとこと", "状況"],
    (db.visitors || []).slice().reverse().map(function (v) {
      return [fmtTime_(v.at), memberName(v.by), eventTitle(v.eventId), v.name, v.company, v.business, v.contact, v.message, VISITOR_LABELS_JA[v.status] || ""].map(cell_);
    })
  );
  writeSheet_(
    "1on1",
    ["日付", "時刻", "メンバー", "相手", "場所", "状況"],
    (db.oneOnOnes || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (o) {
      return [o.date, o.time, memberName(o.a), memberName(o.b), o.place, { planned: "予定", done: "実施", cancelled: "中止" }[o.status] || ""].map(cell_);
    })
  );
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Web アプリの入口 ----------
// サイトからは text/plain で JSON を POST する(プリフライトを避けるため §5)
function doPost(e) {
  var body = null;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "null");
  } catch (err) {
    body = null;
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ success: false, error: { code: "SERVER_ERROR", message: BtexServerCore.ERRORS.SERVER_ERROR } });
  }
  var result, pushJob = null;
  try {
    result = SERVER_.handle(body);
    if (result.success && body && BtexServerCore.MUTATING_ACTIONS.indexOf(body.action) !== -1) {
      try { refreshSheets_(); } catch (err) { console.error(err); }
    }
    if (result.success && body && BtexServerCore.NOTIFY_ACTIONS.indexOf(body.action) !== -1) {
      // 新しいお知らせが届く人の端末を選んでおく(送るのはロックを外してから)
      try { pushJob = SERVER_.runJob("takePushOutbox")[0]; } catch (err) { console.error(err); }
    }
  } finally {
    lock.releaseLock();
  }
  try { sendPushes_(pushJob); } catch (err) { console.error(err); }
  return json_(result);
}

function doGet() {
  return json_({ success: true, data: { service: "BT-EX5 会員サイト API", status: "ok" } });
}

// ---------- 定期実行(1時間ごと) ----------
// 定例会が終わったあと、Google Meet の参加記録から出欠をつける
function syncMeetAttendanceJob() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var r = SERVER_.runJob("syncMeet");
    if (r[0] && r[0].synced) refreshSheets_();
    return r;
  } finally {
    lock.releaseLock();
  }
}
function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "syncMeetAttendanceJob") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncMeetAttendanceJob").timeBased().everyHours(1).create();
}

// 初回に Apps Script のエディタから一度だけ実行する(権限の承認と、名簿の作成)
function setup() {
  SERVER_.handle({ action: "loginOptions" });
  // Google Calendar API を追加していれば、1on1 用のカレンダーを作っておく(権限の確認もここで出る)
  if (CALENDAR_) oneOnOneCalendarId_();
  // Meet の参加記録から出欠をつける処理を、1時間ごとに動かす(カレンダー連携を設定したときだけ)
  if (CALENDAR_) {
    try { installTriggers_(); } catch (err) { console.error("トリガーを入れられませんでした: " + err); }
  }
  SERVER_.handle({ action: "verifySession", sessionToken: "" });
  refreshSheets_();
  return "準備できました。名簿 " + (loadDb_().referralMembers || []).length + " 名";
}
