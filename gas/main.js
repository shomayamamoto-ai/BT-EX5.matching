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

/** @OnlyCurrentDoc */

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

var SERVER_ = BtexServerCore.createServer({
  load: loadDb_,
  save: saveDb_,
  randomBytes: randomBytes_,
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
      if (!r && !att) return;
      rsvpRows.push([e.date, e.title, m.name, m.team, RSVP_LABELS_JA[r] || "", att ? "出席済み" : ""].map(cell_));
    });
  });
  writeSheet_("定例会の出欠", ["日付", "定例会", "氏名", "チーム", "出欠の回答", "出席コード"], rsvpRows);
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
  try {
    var result = SERVER_.handle(body);
    if (result.success && body && BtexServerCore.MUTATING_ACTIONS.indexOf(body.action) !== -1) {
      try { refreshSheets_(); } catch (err) { console.error(err); }
    }
    return json_(result);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ success: true, data: { service: "BT-EX5 会員サイト API", status: "ok" } });
}

// 初回に Apps Script のエディタから一度だけ実行する(権限の承認と、名簿の作成)
function setup() {
  SERVER_.handle({ action: "loginOptions" });
  SERVER_.handle({ action: "verifySession", sessionToken: "" });
  refreshSheets_();
  return "準備できました。名簿 " + (loadDb_().referralMembers || []).length + " 名";
}
