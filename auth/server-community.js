// ============================================
// auth/server-community.js — コミュニティ機能(サーバー側)
//
// auth/server-core.js に registerModule で足す操作のまとまり。
// ブラウザ内のデモと共有サーバー(GAS)の両方で同じコードが動く(同期処理のみ)。
//
//   ホーム         getHome(未読・次の定例会・今月の数字をまとめて返す)/ getActivity(自分に関係する出来事)
//   定例会         listEvents / rsvpEvent / checkIn / adminSaveEvent / adminDeleteEvent / adminOpenCheckIn / adminEventDetail / adminMarkAttendance
//   ビジター招待   createVisitorInvite / listMyVisitors / updateVisitor / visitorInfo(公開)/ visitorApply(公開)
//   紹介・マイル   listMyReferrals / reportThanks / deleteThanks / getRankings
//   1on1           list1on1 / save1on1 / delete1on1
//   運営連絡       listAnnouncements / markAnnouncementsRead / adminSaveAnnouncement / adminDeleteAnnouncement
//   掲示板         listBoard / createPost / deletePost / commentPost / deleteComment / likePost
//   バグ・要望     sendFeedback / listMyFeedback / adminListFeedback / adminUpdateFeedback
//
// 人は名簿の ID(memberId)で持つ。日付は日本時間の "YYYY-MM-DD"。
// ============================================

(function () {
  "use strict";

  var JST = 9 * 60 * 60 * 1000;
  var DAY = 24 * 60 * 60 * 1000;
  // 掲示板の種類(以前の「雑談」は「告知」に変えた)
  var BOARD_CATS = ["紹介依頼", "イベント・募集", "成約・お礼", "質問・相談", "告知"];
  var ANNOUNCE_CATS = ["お知らせ", "アップデート", "定例会", "重要", "その他"];
  // invited 招待中 / applied 参加申込 / confirmed 参加確定 / attended 参加済み / joined 入会 / declined キャンセル
  var VISITOR_STATUSES = ["invited", "applied", "confirmed", "attended", "joined", "declined"];
  var FEEDBACK_KINDS = ["bug", "idea", "other"];
  var FEEDBACK_STATUSES = ["new", "doing", "done"];
  var LIMITS = { posts: 400, comments: 100, msgs: 500, threads: 2000, announcements: 300, events: 300, feedback: 500 };

  BtexServerCore.registerModule({
    mutating: [
      "rsvpEvent", "checkIn", "adminSaveEvent", "adminDeleteEvent", "adminOpenCheckIn", "adminMarkAttendance",
      "adminSyncMeetAttendance", "adminMapMeetName",
      "createVisitorInvite", "updateVisitor", "visitorApply",
      "reportThanks", "deleteThanks", "save1on1", "delete1on1", "confirm1on1", "muteReferralNudge",
    ],
    // 書き込みのあとに、通知(プッシュ)を送るか確かめる操作(mutating に加えて)
    notifying: ["createPost", "commentPost", "adminSaveAnnouncement", "adminRemindAnnouncement", "setReferralMeeting", "adminSaveMinutes", "saveTask"],
    create: function (c) {
      function dateKey(ms) {
        var d = new Date(ms + JST);
        return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
      }
      function today() { return dateKey(c.nowMs()); }
      function monthKey(ms) { return dateKey(ms).slice(0, 7); }
      function cleanDate(v) {
        var s = c.cleanStr(v, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
      }
      function cleanTime(v) {
        // 0:00〜23:59 だけを受け付け、「7:00」は「07:00」にそろえる(カレンダー連携が時刻を読めるように)
        var m = /^(\d{1,2}):(\d{2})$/.exec(c.cleanStr(v, 5));
        if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return "";
        return ("0" + Number(m[1])).slice(-2) + ":" + m[2];
      }
      function cleanText(v, max) {
        return c.cleanStr(String(v === undefined || v === null ? "" : v).replace(/\r\n?/g, "\n"), max);
      }
      function newId(prefix) { return prefix + c.randomHex(6); }
      function oneOf(v, list, fallback) { return list.indexOf(v) !== -1 ? v : fallback; }

      // セッション → { db, me(名簿の行), id, isAdmin }。無効なら { error }
      function who(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        if (!a) return { error: c.fail("SESSION_INVALID") };
        var me = c.find(db.referralMembers || [], function (m) { return m.id === a.user.memberId; });
        if (!me) return { error: c.fail("SESSION_INVALID") };
        return { db: db, me: me, id: me.id, user: a.user, isAdmin: a.isAdmin };
      }
      function admin(body) {
        var w = who(body);
        if (w.error) return w;
        if (!w.isAdmin) return { error: c.fail("FORBIDDEN_ADMIN") };
        return w;
      }
      // 定例会の日程の追加・編集・削除: 管理者と、プレゼン(定例会の進行)を任された運営メンバー
      function planner(body) {
        var w = who(body);
        if (w.error) return w;
        if (!w.isAdmin && DECK_OWNERS.indexOf(w.id) === -1) return { error: c.fail("FORBIDDEN_ADMIN") };
        return w;
      }
      function member(db, id) { return c.find(db.referralMembers || [], function (m) { return m.id === id; }); }
      function nameOf(db, id) {
        var m = member(db, id);
        if (m) return m.name;
        // ほかの BT-EX のユニットの方(1on1 の相手)
        var x = db.extPeople && db.extPeople[id];
        if (x) return x.name;
        return "(退会したメンバー)";
      }
      function memberIdOfUser(db, userId) {
        var u = c.find(db.users, function (x) { return x.userId === userId; });
        return u ? u.memberId : "";
      }
      function trim(list, max) { if (list.length > max) list.splice(0, list.length - max); }

      function migrate(db) {
        var changed = false;
        ["events", "visitors", "thanks", "oneOnOnes", "announcements", "posts", "threads", "feedback", "pushSubs", "searchMisses", "tasks"].forEach(function (k) {
          if (!Array.isArray(db[k])) { db[k] = []; changed = true; }
        });
        if (!db.seen || typeof db.seen !== "object") { db.seen = {}; changed = true; }
        if (!db.searchLog || typeof db.searchLog !== "object") { db.searchLog = {}; changed = true; }
        // 掲示板の「雑談」は「告知」に変えた
        db.posts.forEach(function (p) { if (p.cat === "雑談") { p.cat = "告知"; changed = true; } });
        if (autoComplete(db)) changed = true;
        // 初めの定例会(REF_SEED_EVENTS)を一度だけ入れる
        if (typeof REF_SEED_EVENTS !== "undefined") {
          if (!Array.isArray(db.eventSeeds)) { db.eventSeeds = []; changed = true; }
          REF_SEED_EVENTS.forEach(function (se) {
            if (db.eventSeeds.indexOf(se.seedId) !== -1) return;
            db.eventSeeds.push(se.seedId);
            var ev = {
              seedId: se.seedId, id: newId("ev_"), title: se.title, date: se.date, start: se.start, end: se.end, place: se.place || "", area: se.area,
              body: se.body || "", agenda: se.agenda || "", fee: se.fee || "", capacity: se.capacity || 0, url: "", deadline: se.deadline || "",
              kind: se.kind === "special" ? "special" : "", doors: se.doors || "",
              meet: se.meet !== false, party: { enabled: false }, rsvps: {}, attended: [], createdAt: c.nowMs(), seed: true,
            };
            syncEventCalendar(db, ev); // 共有サーバーでカレンダーが使えれば、Meet もここで作る
            db.events.push(ev);
            changed = true;
          });
        }
        // 12/2(水)20:00 の定例会は、運営の依頼で消す(同じ日は「第一回BT-EXフェス」の特別会。2026年10月25日)
        if (db.eventSeeds && db.eventSeeds.indexOf("remove-2026-12-02-regular") === -1) {
          db.eventSeeds.push("remove-2026-12-02-regular");
          db.events = db.events.filter(function (ev) {
            var drop = ev.date === "2026-12-02" && ev.kind !== "special" && /日本海側最大のマーケット/.test(ev.title || "");
            if (drop && ev.calId && c.calendar) { try { c.calendar.remove(ev.calId); } catch (err) { /* 予定が消せなくても消す */ } }
            return !drop;
          });
          changed = true;
        }
        // 初めに入れた定例会の「当日の流れ」を BT-EX の指針の順にする(運営が書きかえた回はそのまま)
        if (typeof REF_SEED_AGENDA_PREV !== "undefined" && typeof REF_SEED_AGENDA !== "undefined" && db.eventSeeds && db.eventSeeds.indexOf("agenda-shishin-4") === -1) {
          db.eventSeeds.push("agenda-shishin-4");
          db.events.forEach(function (ev) { if (ev.seed && REF_SEED_AGENDA_PREV.indexOf(ev.agenda) !== -1) ev.agenda = REF_SEED_AGENDA; });
          changed = true;
        }
        // ⑤を「ブレイクアウトルーム商談(テーブル商談) 7分×4」にする(2026年10月。運営の依頼で、すべての定例会)
        if (db.eventSeeds && db.eventSeeds.indexOf("agenda-breakout-7x4") === -1) {
          db.eventSeeds.push("agenda-breakout-7x4");
          db.events.forEach(function (ev) {
            if (typeof ev.agenda !== "string") return;
            ev.agenda = ev.agenda.replace(/^([①-⑳]\s*)ブレイクアウトルーム商談\s*(?:[(（]テーブル商談[)）])?\s*\d+\s*分\s*[×xX✕]\s*\d+\s*回?\s*$/m, "$1ブレイクアウトルーム商談（テーブル商談） 7分×4");
          });
          changed = true;
        }
        // はじめの挨拶のあとに「②用語説明」を入れ、そのあとの番号を1つずつ送る(2026年10月。運営の依頼で、すべての定例会)
        if (db.eventSeeds && db.eventSeeds.indexOf("agenda-glossary") === -1) {
          db.eventSeeds.push("agenda-glossary");
          var CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
          db.events.forEach(function (ev) {
            if (typeof ev.agenda !== "string" || /用語説明/.test(ev.agenda)) return;
            var lines = ev.agenda.split("\n");
            var at = -1;
            lines.forEach(function (l, i) { if (at < 0 && /^①/.test(l.trim()) && /挨拶|あいさつ/.test(l)) at = i; });
            if (at < 0) return;
            var out = [];
            lines.forEach(function (l, i) {
              var t = l.trim(), n = CIRC.indexOf(t.charAt(0));
              if (i > at && n >= 1 && n < CIRC.length - 1) l = l.replace(t.charAt(0), CIRC.charAt(n + 1));
              out.push(l);
              if (i === at) out.push("②用語説明");
            });
            ev.agenda = out.join("\n");
          });
          changed = true;
        }
        // 入っていない値がつながって保存された「null」「nullnull」などの文字を、一度だけ消す
        // (ログイン・通知の登録・鍵などは触らない)
        if (!Array.isArray(db.cleanups)) { db.cleanups = []; changed = true; }
        if (db.cleanups.indexOf("nullish-1") === -1) {
          db.cleanups.push("nullish-1");
          changed = true;
          var SKIP = { users: 1, sessions: 1, pushSubs: 1, passcodeGuard: 1, vapid: 1, seen: 1, searchLog: 1, cleanups: 1 };
          var scrub = function (v) {
            if (typeof v === "string") {
              if (/^\s*(?:null|undefined)+\s*$/.test(v)) return "";
              return v.indexOf("nullnull") !== -1 || v.indexOf("undefinedundefined") !== -1 ? v.replace(/(?:null|undefined){2,}/g, "") : v;
            }
            if (Array.isArray(v)) {
              // 一覧の中で「nullnull」だけだったもの(キーワードなど)は、空のまま残さず取り除く
              return v.map(function (x) { return [x, scrub(x)]; })
                .filter(function (p) { return !(typeof p[0] === "string" && p[0] !== "" && p[1] === ""); })
                .map(function (p) { return p[1]; });
            }
            if (v && typeof v === "object") { Object.keys(v).forEach(function (k) { v[k] = scrub(v[k]); }); return v; }
            return v;
          };
          Object.keys(db).forEach(function (k) { if (!SKIP[k]) db[k] = scrub(db[k]); });
          // 中身が空になった投稿・やることは消す
          db.posts = db.posts.filter(function (p) { return String(p.body || "").trim(); });
          db.tasks = db.tasks.filter(function (t) { return String(t.title || "").trim(); });
          db.announcements = db.announcements.filter(function (a) { return String(a.title || "").trim(); });
        }
        // これまでの改善点の運営連絡(REF_SEED_ANNOUNCEMENTS)を一度だけ入れる(投稿日は改善した日)
        if (typeof REF_SEED_ANNOUNCEMENTS !== "undefined") {
          if (!Array.isArray(db.announcementSeeds)) { db.announcementSeeds = []; changed = true; }
          if (!db.announcementSeedRevs || typeof db.announcementSeedRevs !== "object") { db.announcementSeedRevs = {}; changed = true; }
          REF_SEED_ANNOUNCEMENTS.forEach(function (sa) {
            var rev = sa.rev || 1;
            if (db.announcementSeeds.indexOf(sa.seedId) !== -1) {
              // 種類(アップデート など)だけを変えたとき
              var had = sa.cat ? c.find(db.announcements, function (a) { return a.seedId === sa.seedId; }) : null;
              if (had && had.cat !== sa.cat && ANNOUNCE_CATS.indexOf(sa.cat) !== -1) { had.cat = sa.cat; changed = true; }
              // すでに入っている投稿: 中身を直した(rev を上げた)ときだけ、件名・本文を新しくする。
              // 既読・投稿日はそのまま。運営が消した投稿は戻さない
              if ((db.announcementSeedRevs[sa.seedId] || 1) >= rev) return;
              db.announcementSeedRevs[sa.seedId] = rev;
              var cur = c.find(db.announcements, function (a) { return a.seedId === sa.seedId; });
              if (cur) { cur.title = sa.title; cur.body = sa.body; cur.editedAt = c.nowMs(); }
              changed = true;
              return;
            }
            db.announcementSeeds.push(sa.seedId);
            db.announcementSeedRevs[sa.seedId] = rev;
            db.announcements.push({ id: newId("a_"), at: Math.min(sa.at, c.nowMs()), readBy: [], by: "yamamoto", byName: "山本 捷真", title: sa.title, body: sa.body, cat: ANNOUNCE_CATS.indexOf(sa.cat) !== -1 ? sa.cat : "お知らせ", pinned: false, seedId: sa.seedId });
            trim(db.announcements, LIMITS.announcements);
            changed = true;
          });
        }
        // お試し版のときの掲示板の投稿(REF_SEED_POSTS)を一度だけ入れる。
        // 書いた本人の端末には同じ投稿が既にあるので、本文の書き出しが同じなら入れない
        if (typeof REF_SEED_POSTS !== "undefined") {
          if (!Array.isArray(db.postSeeds)) { db.postSeeds = []; changed = true; }
          REF_SEED_POSTS.forEach(function (sp) {
            if (db.postSeeds.indexOf(sp.seedId) !== -1) return;
            db.postSeeds.push(sp.seedId);
            changed = true;
            var key = sp.body.replace(/\s/g, "").slice(0, 40);
            var dup = db.posts.some(function (p) { return p.by === sp.by && String(p.body).replace(/\s/g, "").slice(0, 40) === key; });
            if (dup || !member(db, sp.by)) return;
            db.posts.push({ id: newId("p_"), by: sp.by, cat: sp.cat, body: sp.body, at: sp.at, likes: [], comments: [], seedId: sp.seedId });
            db.posts.sort(function (a, b) { return a.at - b.at; });
          });
        }
        // 開く前の定例会の出欠(REF_SEED_EVENT_RECORDS)を一度だけ反映する。手で直した出欠は変えない
        if (typeof REF_SEED_EVENT_RECORDS !== "undefined") {
          if (!Array.isArray(db.eventRecordRevs)) { db.eventRecordRevs = []; changed = true; }
          REF_SEED_EVENT_RECORDS.forEach(function (r) {
            if (db.eventRecordRevs.indexOf(r.rev) !== -1) return;
            var e = c.find(db.events, function (x) { return x.seedId === r.seedId; })
              || c.find(db.events, function (x) { return x.seed && x.date === r.seedId; });
            if (!e) return;
            e.rsvps = e.rsvps || {};
            e.attendSource = e.attendSource || {};
            (r.attended || []).forEach(function (id) {
              if (!member(db, id) || e.attendSource[id] === "manual") return;
              if (!e.rsvps[id]) e.rsvps[id] = "yes";
              if ((e.attended || []).indexOf(id) === -1) setAttendance(e, id, "present", "record");
            });
            (r.absent || []).forEach(function (id) {
              if (!member(db, id) || e.attendSource[id] === "manual" || (e.attended || []).indexOf(id) !== -1) return;
              if (!e.rsvps[id]) e.rsvps[id] = "no";
            });
            db.eventRecordRevs.push(r.rev);
            changed = true;
          });
        }
        return changed;
      }
      function seen(db, id) { return db.seen[id] || (db.seen[id] = { board: 0 }); }

      // ============================================
      // 定例会
      // ============================================
      // いまの日本時間 "YYYY-MM-DDTHH:MM"(申込締切と比べる)
      function nowStamp() {
        var d = new Date(c.nowMs() + JST);
        return dateKey(c.nowMs()) + "T" + ("0" + d.getUTCHours()).slice(-2) + ":" + ("0" + d.getUTCMinutes()).slice(-2);
      }
      function cleanStamp(v) {
        var x = c.cleanStr(v, 16);
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x) ? x : "";
      }
      function deadlinePassed(e) { return !!e.deadline && nowStamp() > e.deadline; }

      function eventView(w, e) {
        var rsvps = e.rsvps || {};
        var yes = Object.keys(rsvps).filter(function (k) { return rsvps[k] === "yes"; });
        var my = rsvps[w.id] || "";
        var party = e.party && e.party.enabled ? e.party : null;
        var v = {
          id: e.id, title: e.title, date: e.date, start: e.start, end: e.end, place: e.place, area: e.area, hasMinutes: !!e.minutes,
          body: e.body, agenda: e.agenda || "", fee: e.fee, capacity: e.capacity || 0, url: e.url || "",
          kind: e.kind === "special" ? "special" : "", doors: e.doors || "",
          online: e.area === "online",
          deadline: e.deadline || "", deadlinePassed: deadlinePassed(e),
          // 参加リンク(Meet)は、申し込んだ人と管理者にだけ見せる
          meetUrl: e.meetUrl && (my === "yes" || w.isAdmin) ? e.meetUrl : "",
          hasMeet: !!e.meetUrl,
          calLink: w.isAdmin ? e.calLink || "" : "",
          party: party ? { place: party.place || "", fee: party.fee || "", time: party.time || "" } : null,
          myParty: (e.partyRsvps || {})[w.id] || "",
          partyYes: party ? Object.keys(e.partyRsvps || {}).filter(function (k) { return e.partyRsvps[k] === "yes"; }).length : 0,
          yesCount: yes.length,
          noCount: Object.keys(rsvps).filter(function (k) { return rsvps[k] === "no"; }).length,
          yesNames: yes.map(function (id) { return nameOf(w.db, id); }),
          myRsvp: my,
          attended: (e.attended || []).indexOf(w.id) !== -1,
          late: (e.late || []).indexOf(w.id) !== -1,
          checkInOpen: !!e.checkIn && e.date === today() && e.area !== "online",
          visitorCount: w.db.visitors.filter(function (x) { return x.eventId === e.id && x.status !== "declined" && x.status !== "invited"; }).length,
          past: e.date < today(),
        };
        return v;
      }

      // 定例会の詳細(全員に見せる): メンバーの出欠一覧とビジター
      function getEvent(body) {
        var w = who(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        var rs = e.rsvps || {}, pr = e.partyRsvps || {};
        var members = (w.db.referralMembers || []).map(function (m) {
          var att = (e.attended || []).indexOf(m.id) !== -1;
          return {
            id: m.id, name: m.name, team: m.team || "", category: m.company || m.category || "",
            rsvp: rs[m.id] || "", attended: att, late: (e.late || []).indexOf(m.id) !== -1, party: pr[m.id] || "", isMe: m.id === w.id,
          };
        });
        var visitors = w.db.visitors
          .filter(function (v) { return v.eventId === e.id && v.status !== "invited"; })
          .map(function (v) {
            var out = { id: v.id, name: v.name, company: v.company, business: v.business, kind: v.kind || "general", byName: nameOf(w.db, v.by), status: v.status };
            if (w.isAdmin || v.by === w.id) out.contact = v.contact || "";
            return out;
          });
        return c.ok({
          event: eventView(w, e), members: members, visitors: visitors, isAdmin: w.isAdmin,
          minutes: e.minutes ? { text: e.minutes.text, at: e.minutes.at, byName: nameOf(w.db, e.minutes.by), annId: e.minutes.annId || "" } : null,
        });
      }

      // 定例会の議事録・決定事項(管理者が書く。publish で運営連絡として全員に配る)
      function adminSaveMinutes(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        var text = cleanText(body.text, 4000);
        if (!text) {
          delete e.minutes;
          c.saveDb(w.db);
          return c.ok({ minutes: null });
        }
        e.minutes = { text: text, at: c.nowMs(), by: w.id, annId: (e.minutes && e.minutes.annId) || "" };
        if (body.publish === true) {
          var a = e.minutes.annId && c.find(w.db.announcements, function (x) { return x.id === e.minutes.annId; });
          if (!a) {
            a = { id: newId("a_"), at: c.nowMs(), readBy: [], by: w.id, byName: w.me.name, pinned: false };
            w.db.announcements.push(a);
            trim(w.db.announcements, LIMITS.announcements);
          } else {
            // 直したときは、もう一度読んでもらう
            a.at = c.nowMs();
            a.readBy = [];
          }
          a.title = e.date.slice(5).replace("-", "/") + " " + e.title + " の議事録・決定事項";
          a.body = text;
          a.cat = "定例会";
          a.readBy.push(w.id);
          e.minutes.annId = a.id;
        }
        c.saveDb(w.db);
        return c.ok({ minutes: { text: e.minutes.text, at: e.minutes.at, byName: w.me.name, annId: e.minutes.annId } });
      }

      function listEvents(body) {
        var w = who(body);
        if (w.error) return w.error;
        var from = dateKey(c.nowMs() - 120 * DAY);
        var events = w.db.events
          .filter(function (e) { return e.date >= from; })
          .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); })
          .map(function (e) { return eventView(w, e); });
        return c.ok({ events: events, today: today(), calendar: !!c.calendar });
      }

      function rsvpEvent(body) {
        var w = who(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.eventId; });
        if (!e) return c.fail("NOT_FOUND");
        if ((deadlinePassed(e) || e.date < today()) && !w.isAdmin) return c.fail("INVALID_REQUEST", "申込の受付は終了しました。変更は運営にご連絡ください。");
        if ("answer" in body) {
          var answer = oneOf(body.answer, ["yes", "no", ""], "");
          e.rsvps = e.rsvps || {};
          if (answer) e.rsvps[w.id] = answer; else delete e.rsvps[w.id];
          // 欠席にしたら懇親会も不参加に
          if (answer === "no" && e.partyRsvps && e.partyRsvps[w.id]) e.partyRsvps[w.id] = "no";
        }
        if ("party" in body && e.party && e.party.enabled) {
          var p = oneOf(body.party, ["yes", "no", ""], "");
          e.partyRsvps = e.partyRsvps || {};
          if (p) e.partyRsvps[w.id] = p; else delete e.partyRsvps[w.id];
        }
        c.saveDb(w.db);
        return c.ok({ event: eventView(w, e) });
      }

      // 出席コード: 定例会の当日、管理者が受付を開いている間だけ受け付ける
      function checkIn(body) {
        var w = who(body);
        if (w.error) return w.error;
        var guard = w.db.seen[w.id] = w.db.seen[w.id] || { board: 0 };
        if ((guard.checkInLockedUntil || 0) > c.nowMs()) return c.fail("LOCKED");
        var code = String(body.code || "").replace(/\D/g, "");
        var e = c.find(w.db.events, function (x) {
          return x.date === today() && x.checkIn && x.checkIn.code === code && (!body.eventId || x.id === body.eventId);
        });
        if (!code || !e) {
          guard.checkInFailures = (guard.checkInFailures || 0) + 1;
          if (guard.checkInFailures >= 5) { guard.checkInLockedUntil = c.nowMs() + 10 * 60 * 1000; guard.checkInFailures = 0; }
          c.saveDb(w.db);
          return c.fail(guard.checkInLockedUntil > c.nowMs() ? "LOCKED" : "CHECKIN_FAILED");
        }
        guard.checkInFailures = 0;
        if ((e.attended || []).indexOf(w.id) === -1) setAttendance(e, w.id, "present", "code");
        e.rsvps = e.rsvps || {};
        e.rsvps[w.id] = "yes";
        c.saveDb(w.db);
        return c.ok({ event: eventView(w, e) });
      }

      function daysBetween(a, b) {
        var pa = a.split("-").map(Number), pb = b.split("-").map(Number);
        return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / DAY);
      }
      function shiftStamp(stamp, days) {
        var p = stamp.slice(0, 10).split("-").map(Number);
        var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days));
        return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2) + stamp.slice(10);
      }
      // 定例会を Google カレンダー(運営のカレンダー)に入れ、オンラインなら Google Meet も作る
      function syncEventCalendar(db, e) {
        if (!c.calendar || e.date < today()) return null;
        if (e.area !== "online" && !e.calId) return null;
        try {
          var r = c.calendar.upsert({
            id: e.calId || "", title: e.title + "(BT-EX5 定例会)", date: e.date, start: e.start || "", end: e.end || e.start || "",
            meet: e.area === "online" && e.meet !== false, location: e.area === "online" ? "" : e.place,
            description: [e.agenda, e.body].filter(Boolean).join("\n\n"), guests: [],
          });
          e.calId = r.id || e.calId || "";
          e.calLink = r.link || e.calLink || "";
          if (r.meetUrl) e.meetUrl = r.meetUrl;
          return "synced";
        } catch (err) {
          return "error";
        }
      }

      function adminSaveEvent(body) {
        var w = planner(body);
        if (w.error) return w.error;
        var input = body.event || {};
        var e = c.find(w.db.events, function (x) { return x.id === input.id; });
        var next = {
          title: c.cleanStr(input.title, 80),
          date: cleanDate(input.date),
          start: cleanTime(input.start),
          end: cleanTime(input.end),
          place: c.cleanStr(input.place, 120),
          area: oneOf(input.area, ["niigata", "tokyo", "online", "other"], "other"),
          body: cleanText(input.body, 2000),
          fee: c.cleanStr(input.fee, 60),
          capacity: Math.max(0, Math.min(999, Number(input.capacity) || 0)),
          url: /^https:\/\/[^\s"'<>]+$/i.test(String(input.url || "")) ? c.cleanStr(input.url, 300) : "",
          agenda: cleanText(input.agenda, 2000),
          deadline: cleanStamp(input.deadline),
          meet: input.meet === true,
          // 種類(特別会)と受付の時刻
          kind: input.kind === "special" ? "special" : "",
          doors: cleanTime(input.doors),
          party: input.party && input.party.enabled ? { enabled: true, place: c.cleanStr(input.party.place, 120), fee: c.cleanStr(input.party.fee, 60), time: c.cleanStr(input.party.time, 20) } : { enabled: false },
        };
        // Meet の URL を手で入れた(自動で作れないとき)
        var manualMeet = c.cleanStr(input.meetUrl, 200);
        if (!next.title || !next.date) return c.fail("INVALID_REQUEST");
        var applyMeet = function (x) {
          if (next.area === "online" && /^https:\/\/meet\.google\.com\/[\w-]+$/.test(manualMeet)) x.meetUrl = manualMeet;
          if (next.area !== "online") x.meetUrl = "";
        };
        if (e) {
          Object.keys(next).forEach(function (k) { e[k] = next[k]; });
          applyMeet(e);
          syncEventCalendar(w.db, e);
        }
        else {
          // 繰り返し: dates(最初の日を含む日付の一覧)があれば、同じ内容でまとめて作る
          var dates = [next.date];
          if (Array.isArray(body.dates)) {
            body.dates.slice(0, 24).forEach(function (d) {
              var k = cleanDate(d);
              if (k && dates.indexOf(k) === -1) dates.push(k);
            });
          }
          dates.forEach(function (d, i) {
            var x = c.clone(next);
            x.date = d;
            // 申込締切は、開催日との差を保って各回にずらす
            if (next.deadline && i > 0) x.deadline = shiftStamp(next.deadline, daysBetween(next.date, d));
            x.id = newId("ev_");
            x.rsvps = {};
            x.attended = [];
            x.createdAt = c.nowMs();
            applyMeet(x);
            syncEventCalendar(w.db, x);
            w.db.events.push(x);
            if (i === 0) e = x;
          });
          trim(w.db.events, LIMITS.events);
          c.saveDb(w.db);
          return c.ok({ event: eventView(w, e), created: dates.length });
        }
        c.saveDb(w.db);
        return c.ok({ event: eventView(w, e) });
      }

      function adminDeleteEvent(body) {
        var w = planner(body);
        if (w.error) return w.error;
        var target = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!target) return c.fail("NOT_FOUND");
        if (target.calId && c.calendar) { try { c.calendar.remove(target.calId); } catch (err) { /* 予定が消せなくても定例会は消す */ } }
        w.db.events = w.db.events.filter(function (x) { return x.id !== body.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // 受付を開く(4桁のコードを作る)・閉じる
      function adminOpenCheckIn(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        if (body.open === false) e.checkIn = null;
        else {
          var n = 0;
          c.randomHex(4).match(/../g).forEach(function (h) { n = (n * 256 + parseInt(h, 16)) % 10000; });
          e.checkIn = { code: ("000" + n).slice(-4), openedAt: c.nowMs() };
        }
        c.saveDb(w.db);
        return c.ok({ code: e.checkIn ? e.checkIn.code : "" });
      }

      // ---------- 出欠(出席・遅刻早退) ----------
      // attended: 出席した人(遅刻早退を含む) / late: そのうち遅刻早退 / meetMinutes: Meet に参加した分数
      var MEET_PRESENT_MIN = 100; // 100分以上 → 出席
      var MEET_LATE_MIN = 60;     // 60分以上100分未満 → 遅刻早退
      function setAttendance(e, memberId, status, source, minutes) {
        e.attended = (e.attended || []).filter(function (x) { return x !== memberId; });
        e.late = (e.late || []).filter(function (x) { return x !== memberId; });
        e.attendSource = e.attendSource || {};
        if (status === "present" || status === "late") {
          e.attended.push(memberId);
          if (status === "late") e.late.push(memberId);
          e.attendSource[memberId] = source;
        } else {
          delete e.attendSource[memberId];
        }
        if (typeof minutes === "number") { e.meetMinutes = e.meetMinutes || {}; e.meetMinutes[memberId] = minutes; }
      }
      function attendanceOf(e, memberId) {
        if ((e.attended || []).indexOf(memberId) === -1) return "";
        return (e.late || []).indexOf(memberId) !== -1 ? "late" : "present";
      }
      function statusByMinutes(min) { return min >= MEET_PRESENT_MIN ? "present" : min >= MEET_LATE_MIN ? "late" : ""; }

      // Meet の参加者(表示名と分数)を名簿に当てはめる。手で付けた出欠は上書きしない
      function applyMeetParticipants(db, e, list) {
        var keys = {};
        (db.referralMembers || []).forEach(function (m) {
          keys[BtexServerCore.normalizeName(m.name)] = m.id;
          var u = userOf(db, m.id);
          if (u && u.meetName) keys[BtexServerCore.normalizeName(u.meetName)] = m.id;
        });
        Object.keys(db.meetAliases || {}).forEach(function (k) { keys[k] = db.meetAliases[k]; });
        var byMember = {};
        var unmatched = {};
        list.forEach(function (p) {
          var k = BtexServerCore.normalizeName(p.name);
          var id = keys[k];
          if (id) byMember[id] = (byMember[id] || 0) + p.minutes;
          else if (k) unmatched[p.name] = (unmatched[p.name] || 0) + p.minutes;
        });
        e.attendSource = e.attendSource || {};
        Object.keys(byMember).forEach(function (id) {
          if (e.attendSource[id] === "manual") { e.meetMinutes = e.meetMinutes || {}; e.meetMinutes[id] = byMember[id]; return; }
          setAttendance(e, id, statusByMinutes(byMember[id]), "meet", byMember[id]);
        });
        e.meetUnmatched = Object.keys(unmatched).map(function (n) { return { name: n, minutes: unmatched[n] }; })
          .filter(function (x) { return x.minutes > 0; });
        e.meetSyncedAt = c.nowMs();
        return { matched: Object.keys(byMember).length, unmatched: e.meetUnmatched.length };
      }
      function syncMeetFor(db, e) {
        if (!c.meet || !e.meetUrl) return { error: "unavailable" };
        try {
          var list = c.meet.attendance(e.meetUrl) || [];
          return applyMeetParticipants(db, e, list);
        } catch (err) {
          e.meetSyncError = String(err && err.message ? err.message : err).slice(0, 200);
          return { error: "failed" };
        }
      }
      // 終わった時刻(日本時間のミリ秒)
      function eventStartMs(e) {
        var p = e.date.split("-").map(Number);
        var hm = (e.start || "00:00").split(":").map(Number);
        return Date.UTC(p[0], p[1] - 1, p[2], hm[0], hm[1]) - JST;
      }
      // 予定の開始(日本時間)。時刻がなければ null
      var SOON = 3 * 60 * 60 * 1000;
      function startMs(date, time) {
        if (!date || !time) return null;
        return Date.parse(date + "T" + (time.length === 4 ? "0" + time : time) + ":00+09:00");
      }
      function startsSoon(date, time) {
        var s0 = startMs(date, time);
        return s0 !== null && c.nowMs() >= s0 - SOON && c.nowMs() < s0;
      }
      // 2日以内に始まり、出欠の締切前の定例会
      function eventSoon(e) {
        var start = eventStartMs(e);
        return c.nowMs() >= start - 2 * DAY && c.nowMs() < start && !deadlinePassed(e);
      }
      function eventEndMs(e) {
        var t = e.end || e.start || "23:59";
        var p = e.date.split("-").map(Number);
        var hm = t.split(":").map(Number);
        return Date.UTC(p[0], p[1] - 1, p[2], hm[0], hm[1]) - JST;
      }
      // 定期実行: 終わってから15分〜3時間の間、Meet の参加記録から出欠をつける(何度実行しても同じ結果)
      function jobSyncMeet() {
        var db = c.ensureDb();
        if (!c.meet) return { skipped: "no meet" };
        var count = 0;
        db.events.forEach(function (e) {
          if (!e.meetUrl || e.area !== "online") return;
          var end = eventEndMs(e);
          var now = c.nowMs();
          if (now < end + 15 * 60 * 1000 || now > end + 3 * 60 * 60 * 1000) return;
          syncMeetFor(db, e);
          count++;
        });
        if (count) c.saveDb(db);
        return { synced: count };
      }

      function adminEventDetail(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        var rsvps = e.rsvps || {};
        var rows = (w.db.referralMembers || []).map(function (m) {
          var a = attendanceOf(e, m.id);
          return {
            memberId: m.id, name: m.name, team: m.team, rsvp: rsvps[m.id] || "", attended: !!a, attendance: a,
            minutes: (e.meetMinutes || {})[m.id], source: (e.attendSource || {})[m.id] || "",
          };
        });
        var visitors = w.db.visitors.filter(function (v) { return v.eventId === e.id; }).map(function (v) { return visitorView(w.db, v, true); });
        return c.ok({
          event: eventView(w, e), code: e.checkIn ? e.checkIn.code : "", members: rows, visitors: visitors,
          meet: { available: !!c.meet, syncedAt: e.meetSyncedAt || 0, unmatched: e.meetUnmatched || [], error: e.meetSyncError || "", presentMin: MEET_PRESENT_MIN, lateMin: MEET_LATE_MIN },
        });
      }

      function adminMarkAttendance(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e || !member(w.db, body.memberId)) return c.fail("NOT_FOUND");
        var status = "status" in body ? oneOf(body.status, ["present", "late", ""], "") : (body.attended === true ? "present" : "");
        setAttendance(e, body.memberId, status, "manual");
        if (!status) { e.attendSource = e.attendSource || {}; e.attendSource[body.memberId] = "manual"; }
        c.saveDb(w.db);
        return c.ok({});
      }

      // 管理者: いますぐ Meet の参加記録から出欠をつける
      function adminSyncMeetAttendance(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        if (!c.meet) return c.fail("INVALID_REQUEST", "共有サーバーで Google Meet の参加記録を使う設定をすると、自動で出欠をつけられます(gas/README.md)。");
        if (!e.meetUrl) return c.fail("INVALID_REQUEST", "この定例会には Google Meet がありません。");
        var r = syncMeetFor(w.db, e);
        c.saveDb(w.db);
        if (r.error) return c.fail("SERVER_ERROR", "Google Meet の参加記録を読めませんでした。" + (e.meetSyncError || ""));
        return c.ok(r);
      }

      // 管理者: 名簿に当てはまらなかった Meet の表示名を、メンバーに結びつける(次からは自動)
      function adminMapMeetName(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e || !member(w.db, body.memberId)) return c.fail("NOT_FOUND");
        var name = c.cleanStr(body.name, 80);
        var row = c.find(e.meetUnmatched || [], function (x) { return x.name === name; });
        if (!row) return c.fail("NOT_FOUND");
        w.db.meetAliases = w.db.meetAliases || {};
        w.db.meetAliases[BtexServerCore.normalizeName(name)] = body.memberId;
        var total = ((e.meetMinutes || {})[body.memberId] || 0) + row.minutes;
        setAttendance(e, body.memberId, statusByMinutes(total), "meet", total);
        e.meetUnmatched = e.meetUnmatched.filter(function (x) { return x.name !== name; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // ============================================
      // ビジター招待
      // ============================================
      function visitorView(db, v, withContact) {
        var out = {
          id: v.id, eventId: v.eventId, name: v.name, company: v.company, business: v.business, message: v.message,
          status: v.status, at: v.at, appliedAt: v.appliedAt || 0, by: v.by, byName: nameOf(db, v.by), token: v.token, kind: v.kind || "general",
          inviteMessage: v.inviteMessage || "", linkTeam: v.linkTeam || "", linkUp: v.linkUp || "", linkAdvance: v.linkAdvance || "",
        };
        var e = c.find(db.events, function (x) { return x.id === v.eventId; });
        out.eventTitle = e ? e.title : "";
        out.eventDate = e ? e.date : "";
        if (withContact) out.contact = v.contact || "";
        return out;
      }

      function createVisitorInvite(body) {
        var w = who(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.eventId; });
        if (!e || e.date < today()) return c.fail("NOT_FOUND");
        var v = {
          id: newId("v_"), token: c.randomToken().slice(0, 22), eventId: e.id, by: w.id,
          name: c.cleanStr(body.name, 40), company: c.cleanStr(body.company, 80), business: "", contact: c.cleanStr(body.contact, 120), message: "",
          // 招待する人から相手へのひとこと(申込ページに出す)
          inviteMessage: cleanText(body.inviteMessage, 500),
          note: c.cleanStr(body.note, 200), status: "invited", at: c.nowMs(),
          // general 一般の方(LINK 以外) / link LINK BT 会員の方(申込で所属チーム・アップ・アドバンスを聞く)
          kind: oneOf(body.kind, ["general", "link"], "general"),
        };
        w.db.visitors.push(v);
        c.saveDb(w.db);
        return c.ok({ visitor: visitorView(w.db, v, true) });
      }

      function listMyVisitors(body) {
        var w = who(body);
        if (w.error) return w.error;
        var list = w.db.visitors
          .filter(function (v) { return v.by === w.id || (w.isAdmin && !body.mine); })
          .slice().reverse().slice(0, 200)
          .map(function (v) { return visitorView(w.db, v, true); });
        return c.ok({ visitors: list });
      }

      // 招待した本人か管理者が状況を変える
      function updateVisitor(body) {
        var w = who(body);
        if (w.error) return w.error;
        var v = c.find(w.db.visitors, function (x) { return x.id === body.id; });
        if (!v || (v.by !== w.id && !w.isAdmin)) return c.fail("NOT_FOUND");
        if (body.remove === true) {
          w.db.visitors = w.db.visitors.filter(function (x) { return x.id !== v.id; });
        } else {
          v.status = oneOf(body.status, VISITOR_STATUSES, v.status);
        }
        c.saveDb(w.db);
        return c.ok({});
      }

      // 公開(ログイン不要): 招待URLのトークンで定例会の案内を返す
      function visitorInfo(body) {
        var db = c.ensureDb();
        var v = c.find(db.visitors, function (x) { return x.token === String(body.token || ""); });
        var e = v && c.find(db.events, function (x) { return x.id === v.eventId; });
        if (!v || !e) return c.fail("NOT_FOUND", "招待のリンクが見つかりませんでした。招待してくれた方にご確認ください。");
        return c.ok({
          event: { title: e.title, date: e.date, start: e.start, end: e.end, place: e.place, area: e.area, fee: e.fee, body: e.body, url: e.url || "" },
          inviter: nameOf(db, v.by),
          name: v.name,
          company: v.company || "",
          kind: v.kind || "general",
          inviteMessage: v.inviteMessage || "",
          status: v.status,
          past: e.date < today(),
        });
      }

      function visitorApply(body) {
        var db = c.ensureDb();
        var v = c.find(db.visitors, function (x) { return x.token === String(body.token || ""); });
        var e = v && c.find(db.events, function (x) { return x.id === v.eventId; });
        if (!v || !e) return c.fail("NOT_FOUND", "招待のリンクが見つかりませんでした。招待してくれた方にご確認ください。");
        if (e.date < today()) return c.fail("INVALID_REQUEST", "この定例会の受付は終了しました。");
        var name = c.cleanStr(body.name, 40);
        if (!name) return c.fail("INVALID_REQUEST", "お名前を入力してください。");
        v.name = name;
        v.company = c.cleanStr(body.company, 80);
        v.business = c.cleanStr(body.business, 300);
        v.contact = c.cleanStr(body.contact, 120);
        v.message = c.cleanStr(body.message, 300);
        if (v.kind === "link") {
          v.linkTeam = c.cleanStr(body.linkTeam, 60);
          v.linkUp = c.cleanStr(body.linkUp, 40);
          v.linkAdvance = c.cleanStr(body.linkAdvance, 40);
        }
        if (v.status === "invited" || v.status === "declined") v.status = "applied";
        v.appliedAt = c.nowMs();
        c.saveDb(db);
        return c.ok({ status: v.status });
      }

      // ============================================
      // 紹介(リファーラル)とありがとうマイル
      // ============================================
      // ありがとうマイル: 紹介で仕事が決まった人が、紹介してくれた人へ「成約金額」をお礼として記録する。
      // 1円 = 1マイル(紹介から生まれた売上)
      function referralView(db, l, me) {
        var giver = memberIdOfUser(db, l.fromUserId);
        var thanks = c.find(db.thanks, function (t) { return t.referralId === l.id; });
        return {
          id: l.id, at: l.at, status: l.status, statusAt: l.statusAt || 0,
          fromId: giver, fromName: nameOf(db, giver), toId: l.toMemberId, toName: nameOf(db, l.toMemberId),
          prospect: l.prospect, contact: l.contact || "", memo: l.memo || "", topics: l.topics || [],
          mine: giver === me, received: l.toMemberId === me,
          thanksAmount: thanks ? thanks.amount : 0,
          meeting: meetingView(db, l.meeting),
        };
      }

      // 紹介の顔合わせの予定(紹介した人・紹介を受けた人のどちらでも決められる)
      function meetingView(db, mt) {
        if (!mt || !mt.date) return null;
        var o = { date: mt.date, time: mt.time || "", duration: mt.duration || 60 };
        return {
          date: mt.date, time: mt.time || "", duration: o.duration, end: endTime(o), endDate: endDate(o),
          mode: mt.mode || "onsite", place: mt.place || "", meetUrl: mt.meetUrl || "", setByName: mt.setBy ? nameOf(db, mt.setBy) : "",
        };
      }
      function setReferralMeeting(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var l = c.find(db.referralLogs, function (x) { return x.id === body.id; });
        if (!l || (memberIdOfUser(db, l.fromUserId) !== w.id && l.toMemberId !== w.id)) return c.fail("NOT_FOUND");
        var m = body.meeting;
        if (!m) {
          delete l.meeting;
        } else {
          var date = cleanDate(m.date);
          if (!date) return c.fail("INVALID_REQUEST", "顔合わせの日付を入れてください。");
          var mode = oneOf(m.mode, ["onsite", "meet"], "onsite");
          var url = c.cleanStr(m.meetUrl, 200);
          l.meeting = {
            date: date, time: cleanTime(m.time),
            duration: DURATIONS.indexOf(Number(m.duration)) !== -1 ? Number(m.duration) : 60,
            mode: mode, place: mode === "meet" ? "" : c.cleanStr(m.place, 80),
            meetUrl: mode === "meet" && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : "",
            setBy: w.id, setAt: c.nowMs(),
          };
        }
        c.saveDb(db);
        return c.ok({ item: referralView(db, l, w.id) });
      }

      function thanksView(db, t) {
        return { id: t.id, at: t.at, from: t.from, fromName: nameOf(db, t.from), to: t.to, toName: nameOf(db, t.to), amount: t.amount, message: t.message, referralId: t.referralId || "" };
      }

      function listMyReferrals(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var given = [], received = [];
        db.referralLogs.forEach(function (l) {
          var v = referralView(db, l, w.id);
          if (v.mine) given.push(v);
          if (v.received) received.push(v);
        });
        var thanksIn = db.thanks.filter(function (t) { return t.to === w.id; }).map(function (t) { return thanksView(db, t); });
        var thanksOut = db.thanks.filter(function (t) { return t.from === w.id; }).map(function (t) { return thanksView(db, t); });
        return c.ok({ given: given.reverse(), received: received.reverse(), thanksIn: thanksIn.reverse(), thanksOut: thanksOut.reverse() });
      }

      // 紹介で決まった仕事のお礼(ありがとうマイル)を記録する。
      // referralId があれば、その紹介を受けた本人だけが記録でき、紹介は「成約」になる
      function reportThanks(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var amount = Math.round(Number(String(body.amount || "").replace(/[^\d.]/g, "")) || 0);
        // 1件は1億円まで。1日に記録できるのは20件まで(打ちまちがい・いたずらでランキングがこわれないように)
        if (amount < 0 || amount > 100000000) return c.fail("INVALID_REQUEST", "金額は1億円までで入れてください。");
        var dayAgo = c.nowMs() - 24 * 60 * 60 * 1000;
        if (db.thanks.filter(function (x) { return x.from === w.id && x.at > dayAgo; }).length >= 20) return c.fail("RATE_LIMITED", "今日はたくさん記録しています。続きは明日にお願いします。");
        var to = c.cleanStr(body.toMemberId, 40);
        var referralId = c.cleanStr(body.referralId, 40);
        if (referralId) {
          var l = c.find(db.referralLogs, function (x) { return x.id === referralId; });
          if (!l || l.toMemberId !== w.id) return c.fail("NOT_FOUND");
          to = memberIdOfUser(db, l.fromUserId);
          l.status = "won";
          l.statusAt = c.nowMs();
          db.thanks = db.thanks.filter(function (t) { return t.referralId !== referralId; });
        }
        if (!member(db, to)) return c.fail("NOT_FOUND");
        if (to === w.id) return c.fail("SELF_REFERRAL");
        var t = { id: newId("t_"), at: c.nowMs(), from: w.id, to: to, amount: amount, message: c.cleanStr(body.message, 300), referralId: referralId };
        db.thanks.push(t);
        c.saveDb(db);
        return c.ok({ thanks: thanksView(db, t) });
      }

      function deleteThanks(body) {
        var w = who(body);
        if (w.error) return w.error;
        var t = c.find(w.db.thanks, function (x) { return x.id === body.id; });
        if (!t || (t.from !== w.id && !w.isAdmin)) return c.fail("NOT_FOUND");
        w.db.thanks = w.db.thanks.filter(function (x) { return x.id !== t.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // ランキング(個人・チーム): 紹介した数・成約・ありがとうマイル・1on1・出席
      function getRankings(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var period = oneOf(body.period, ["month", "year", "all"], "month");
        var nowKey = dateKey(c.nowMs());
        var inPeriod = function (ms) {
          if (period === "all") return true;
          var k = dateKey(ms);
          return period === "month" ? k.slice(0, 7) === nowKey.slice(0, 7) : k.slice(0, 4) === nowKey.slice(0, 4);
        };
        var inPeriodDate = function (d) {
          if (period === "all") return true;
          return period === "month" ? d.slice(0, 7) === nowKey.slice(0, 7) : d.slice(0, 4) === nowKey.slice(0, 4);
        };
        var rows = {};
        (db.referralMembers || []).forEach(function (m) {
          rows[m.id] = { id: m.id, name: m.name, team: m.team || "", referrals: 0, won: 0, miles: 0, oneOnOnes: 0, attended: 0 };
        });
        db.referralLogs.forEach(function (l) {
          var r = rows[memberIdOfUser(db, l.fromUserId)];
          if (!r || !inPeriod(l.at)) return;
          r.referrals += 1;
          if (l.status === "won") r.won += 1;
        });
        db.thanks.forEach(function (t) { if (rows[t.to] && inPeriod(t.at)) rows[t.to].miles += t.amount; });
        db.oneOnOnes.forEach(function (o) {
          if (o.status !== "done" || !inPeriodDate(o.date)) return;
          [o.a, o.b].forEach(function (id) { if (rows[id]) rows[id].oneOnOnes += 1; });
        });
        db.events.forEach(function (e) {
          if (e.date > today() || !inPeriodDate(e.date)) return;
          (e.attended || []).forEach(function (id) { if (rows[id]) rows[id].attended += 1; });
        });
        var list = Object.keys(rows).map(function (k) { return rows[k]; });
        var teams = {};
        list.forEach(function (r) {
          var key = r.team || "チーム未設定";
          var t = teams[key] || (teams[key] = { team: key, members: 0, referrals: 0, won: 0, miles: 0, oneOnOnes: 0, attended: 0 });
          t.members += 1;
          ["referrals", "won", "miles", "oneOnOnes", "attended"].forEach(function (f) { t[f] += r[f]; });
        });
        return c.ok({
          period: period,
          members: list,
          teams: Object.keys(teams).map(function (k) { return teams[k]; }),
          totals: {
            referrals: list.reduce(function (s, r) { return s + r.referrals; }, 0),
            won: list.reduce(function (s, r) { return s + r.won; }, 0),
            miles: list.reduce(function (s, r) { return s + r.miles; }, 0),
            oneOnOnes: db.oneOnOnes.filter(function (o) { return o.status === "done" && inPeriodDate(o.date); }).length,
          },
        });
      }

      // ============================================
      // チームのランキング(貢献ポイント)
      // ============================================
      // 貢献ポイント: 何をするとポイントになるかを画面で見せ、紹介と貢献金額が増えるようにする
      // 紹介 +1 / 成約 +3 / 貢献金額 1,000円ごとに +0.1 / 1on1 +1 / 定例会に出席 +1 / ビジターの申込 +2
      var POINTS = { referral: 1, won: 3, milesPer: 1000, mile: 0.1, oneOnOne: 1, attended: 1, visitor: 2 };
      function round1(x) { return Math.round(x * 10) / 10; }
      var VISITOR_COUNTED = ["applied", "confirmed", "attended", "joined"];
      function monthShift(ym, n) {
        var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
        y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
        return y + "-" + ("0" + (m + 1)).slice(-2);
      }
      function lastDay(ym) {
        var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
        return ym + "-" + ("0" + new Date(Date.UTC(y, m, 0)).getUTCDate()).slice(-2);
      }
      // 期間(日付 "YYYY-MM-DD" の from〜to)の、メンバーごとの数字とポイント
      function memberStats(db, from, to) {
        var inRange = function (key) { return key >= from && key <= to; };
        var rows = {};
        (db.referralMembers || []).forEach(function (m) {
          rows[m.id] = { id: m.id, name: m.name, team: m.team || "チーム未設定", referrals: 0, won: 0, miles: 0, oneOnOnes: 0, attended: 0, visitors: 0, points: 0 };
        });
        db.referralLogs.forEach(function (l) {
          var r = rows[memberIdOfUser(db, l.fromUserId)];
          if (!r) return;
          if (inRange(dateKey(l.at))) r.referrals += 1;
          if (l.status === "won" && inRange(dateKey(l.statusAt || l.at))) r.won += 1;
        });
        db.thanks.forEach(function (t) { if (rows[t.to] && inRange(dateKey(t.at))) rows[t.to].miles += t.amount; });
        db.oneOnOnes.forEach(function (o) {
          if (o.status !== "done" || !inRange(o.date)) return;
          [o.a, o.b].forEach(function (id) { if (rows[id]) rows[id].oneOnOnes += 1; });
        });
        db.events.forEach(function (e) {
          if (e.date > today() || !inRange(e.date)) return;
          (e.attended || []).forEach(function (id) { if (rows[id]) rows[id].attended += 1; });
        });
        db.visitors.forEach(function (v) {
          if (rows[v.by] && VISITOR_COUNTED.indexOf(v.status) !== -1 && inRange(dateKey(v.at))) rows[v.by].visitors += 1;
        });
        Object.keys(rows).forEach(function (k) {
          var r = rows[k];
          r.points = round1(r.referrals * POINTS.referral + r.won * POINTS.won + Math.floor(r.miles / POINTS.milesPer) * POINTS.mile
            + r.oneOnOnes * POINTS.oneOnOne + r.attended * POINTS.attended + r.visitors * POINTS.visitor);
        });
        return rows;
      }
      // 点の高い順に順位をつける(同点は同じ順位)。gap は1つ上の順位まであと何点か
      function rankRows(list, key) {
        var sorted = list.slice().sort(function (a, b) { return b[key] - a[key] || b.referrals - a.referrals || (a.name || "").localeCompare(b.name || ""); });
        sorted.forEach(function (r, i) {
          r.rank = i > 0 && sorted[i - 1][key] === r[key] ? sorted[i - 1].rank : i + 1;
          var above = null;
          for (var j = i - 1; j >= 0; j--) { if (sorted[j][key] > r[key]) { above = sorted[j]; break; } }
          r.gap = above ? round1(above[key] - r[key]) : 0;
          r.gapName = above ? (above.name || above.team) : "";
        });
        // 同じ順位の人数(「同率1位(15名)」と出すため)
        var same = {};
        sorted.forEach(function (r) { same[r.rank] = (same[r.rank] || 0) + 1; });
        sorted.forEach(function (r) { r.tied = same[r.rank]; });
        return sorted;
      }
      // BT-EX5 全体の月の目標(管理者が設定。決めていなければ紹介は1人1件)
      function communityGoal(db, size) {
        var d = ((db.settings.teamGoals || {}).default) || {};
        return { referrals: d.referrals || size, miles: d.miles || 0 };
      }
      // ランキング(BT-EX5 の中の個人の順位。チームでは分けない)
      // ============================================
      // 自分の数字・メンバー別の数字(期間を選んで集計)
      // 出席・1on1 は開催日、紹介・マイルは記録した日、ビジターは参加する定例会の日で数える
      // ============================================
      // 期間(from〜to)の、メンバーごとの数字と全体の数字
      function countRange(db, from, to) {
        var inRange = function (key) { return key >= from && key <= to; };
        var rows = {};
        (db.referralMembers || []).forEach(function (m) {
          rows[m.id] = { id: m.id, name: m.name, attended: 0, referrals: 0, received: 0, oneOnOnes: 0, milesGiven: 0, milesReceived: 0, visitors: 0, visitorsGeneral: 0, visitorsLink: 0, joined: 0 };
        });
        var total = { attended: 0, referrals: 0, miles: 0, oneOnOnes: 0, visitors: 0, joined: 0 };
        db.events.forEach(function (e) {
          if (e.date > today() || !inRange(e.date)) return;
          (e.attended || []).forEach(function (id) { if (rows[id]) { rows[id].attended += 1; total.attended += 1; } });
        });
        db.referralLogs.forEach(function (l) {
          if (!inRange(dateKey(l.at))) return;
          var g = rows[memberIdOfUser(db, l.fromUserId)];
          if (g) g.referrals += 1;
          if (rows[l.toMemberId]) rows[l.toMemberId].received += 1;
          total.referrals += 1;
        });
        // ありがとうマイル: to = 紹介した人(自分の紹介で相手が成約した分)/ from = 仕事を受けた人(メンバーの紹介で自分が成約できた分)
        db.thanks.forEach(function (t) {
          if (!inRange(dateKey(t.at))) return;
          if (rows[t.to]) rows[t.to].milesGiven += t.amount;
          if (rows[t.from]) rows[t.from].milesReceived += t.amount;
          total.miles += t.amount;
        });
        db.oneOnOnes.forEach(function (o) {
          if (o.status !== "done" || !inRange(o.date)) return;
          [o.a, o.b].forEach(function (id) { if (rows[id]) rows[id].oneOnOnes += 1; });
          total.oneOnOnes += 1;
        });
        // ビジター: 招待の URL から申し込み、参加が決まった方。同じ方は何回来ても1人
        var eventDate = {};
        db.events.forEach(function (e) { eventDate[e.id] = e.date; });
        var seenBy = {}, seenAll = {};
        db.visitors.forEach(function (v) {
          var d = eventDate[v.eventId];
          if (!d || !inRange(d) || VISITOR_COUNTED.indexOf(v.status) === -1) return;
          var person = BtexServerCore.normalizeName(v.name) + "|" + BtexServerCore.normalizeName(v.company);
          var r = rows[v.by];
          if (r && !seenBy[v.by + "|" + person]) {
            seenBy[v.by + "|" + person] = true;
            r.visitors += 1;
            if (v.kind === "link") r.visitorsLink += 1; else r.visitorsGeneral += 1;
            if (v.status === "joined") r.joined += 1;
          }
          if (!seenAll[person]) {
            seenAll[person] = true;
            total.visitors += 1;
            if (v.status === "joined") total.joined += 1;
          }
        });
        return { rows: rows, total: total };
      }
      // 日付("YYYY-MM-DD")を n 日ずらす
      function shiftDay(key, n) {
        var d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)) + n));
        return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
      }
      // くらべる前の期間: ひと月ちょうど(1日〜月末)なら前の月、それ以外は同じ日数だけ前
      function prevRange(from, to) {
        if (from.slice(8) === "01" && to === lastDay(to.slice(0, 7))) {
          var months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
          var pf = monthShift(from.slice(0, 7), -months);
          return { from: pf + "-01", to: lastDay(monthShift(to.slice(0, 7), -months)) };
        }
        var days = Math.round((Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10))) - Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)))) / 86400000) + 1;
        return { from: shiftDay(from, -days), to: shiftDay(from, -1) };
      }
      var MY_KEYS = ["attended", "referrals", "received", "oneOnOnes", "milesGiven", "milesReceived", "visitors", "joined"];
      function pickMine(r) {
        var o = {};
        MY_KEYS.forEach(function (k) { o[k] = r ? r[k] : 0; });
        return o;
      }
      function getStats(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var from = cleanDate(body.from), to = cleanDate(body.to);
        if (!from || !to) { from = today().slice(0, 8) + "01"; to = lastDay(today().slice(0, 7)); }
        if (from > to) { var tmp = from; from = to; to = tmp; }
        var cur = countRange(db, from, to);
        var rows = cur.rows, total = cur.total;
        var list = Object.keys(rows).map(function (k) { return rows[k]; });
        var sc = searchCounts(db, from, to);
        if (rows[w.id]) {
          rows[w.id].searchShown = (sc.m[w.id] || [0, 0])[0];
          rows[w.id].searchTop = (sc.m[w.id] || [0, 0])[1];
          rows[w.id].searchTotal = sc.n;
        }
        // 前の期間の自分の数字(前の期間とくらべた増減に使う)
        var pr = prevRange(from, to);
        var prev = pickMine(countRange(db, pr.from, pr.to).rows[w.id]);
        // 期間の終わりの月までの6か月の、自分の数字(月ごと)と、BT-EX5 全体のマイル
        var endYm = to.slice(0, 7);
        var series = [];
        for (var i = 5; i >= 0; i--) {
          var ym = monthShift(endYm, -i);
          var mr = countRange(db, ym + "-01", lastDay(ym));
          series.push(Object.assign({ ym: ym, allMiles: mr.total.miles }, pickMine(mr.rows[w.id])));
        }
        // この期間に自分が出した紹介の、いまの状況
        var mix = { new: 0, contacted: 0, meeting: 0, won: 0, lost: 0 };
        db.referralLogs.forEach(function (l) {
          if (memberIdOfUser(db, l.fromUserId) !== w.id || dateKey(l.at) < from || dateKey(l.at) > to) return;
          if (mix[l.status] !== undefined) mix[l.status] += 1;
        });
        return c.ok({
          from: from, to: to, today: today(),
          me: rows[w.id] || null,
          prev: prev, prevFrom: pr.from, prevTo: pr.to,
          series: series,
          refMix: mix,
          members: list.map(function (r) {
            return { id: r.id, name: r.name, isMe: r.id === w.id, attended: r.attended, referrals: r.referrals, miles: r.milesGiven, oneOnOnes: r.oneOnOnes, visitors: r.visitors };
          }),
          total: total,
        });
      }

      // ============================================
      // 検索の記録(だれが何回、検索結果に出たか)
      // 紹介診断・相談アシスタント・ジャンルで探す の結果に出た人を、日ごとに数える。
      // searchLog: { "YYYY-MM-DD": { n: 検索の回数, m: { メンバーID: [出た回数, 1位の回数] } } }(400日分)
      // 読み取れなかった相談は searchMisses(最新100件。管理者が言葉の辞書を足すのに使う)
      // ============================================
      var SEARCH_KINDS = ["diag", "consult", "genre"];
      function logSearch(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var kind = oneOf(body.kind, SEARCH_KINDS, "");
        if (!kind) return c.fail("INVALID_REQUEST");
        if (body.miss) {
          var text = c.cleanStr(body.text, 120);
          if (text) {
            db.searchMisses.push({ at: c.nowMs(), by: w.id, text: text });
            trim(db.searchMisses, 100);
          }
          c.saveDb(db);
          return c.ok({});
        }
        var ids = c.cleanList(body.shown, null, 10).filter(function (id) { return member(db, id); });
        var day = db.searchLog[today()] || (db.searchLog[today()] = { n: 0, m: {} });
        // 1人1日200回まで数える(押しすぎ・いたずらで数字がふくらまないように)
        day.u = day.u || {};
        day.u[w.id] = (day.u[w.id] || 0) + 1;
        if (day.u[w.id] > 200) return c.ok({ skipped: true });
        day.n += 1;
        ids.forEach(function (id, i) {
          var row = day.m[id] || (day.m[id] = [0, 0]);
          row[0] += 1;
          if (i === 0) row[1] += 1;
        });
        // 古い日を消す
        var keys = Object.keys(db.searchLog).sort();
        if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete db.searchLog[k]; });
        c.saveDb(db);
        return c.ok({});
      }
      // 期間の、メンバーごとの [出た回数, 1位の回数] と検索の回数
      function searchCounts(db, from, to) {
        var out = { n: 0, m: {} };
        Object.keys(db.searchLog || {}).forEach(function (k) {
          if (k < from || k > to) return;
          var d = db.searchLog[k];
          out.n += d.n || 0;
          Object.keys(d.m || {}).forEach(function (id) {
            var r = out.m[id] || (out.m[id] = [0, 0]);
            r[0] += d.m[id][0];
            r[1] += d.m[id][1];
          });
        });
        return out;
      }

      function getTeamRanking(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var t = today();
        var ym = t.slice(0, 7);
        var period = oneOf(body.period, ["month", "prev", "year", "all"], "month");
        var range = period === "month" ? [ym + "-01", t]
          : period === "prev" ? [monthShift(ym, -1) + "-01", lastDay(monthShift(ym, -1))]
          : period === "year" ? [t.slice(0, 4) + "-01-01", t] : ["2000-01-01", t];
        var rows = memberStats(db, range[0], range[1]);
        var members = rankRows(Object.keys(rows).map(function (k) { return rows[k]; }), "points");
        members.forEach(function (r) { r.isMe = r.id === w.id; });
        var total = { referrals: 0, won: 0, miles: 0, points: 0 };
        members.forEach(function (r) { total.referrals += r.referrals; total.won += r.won; total.miles += r.miles; total.points += r.points; });
        total.points = round1(total.points);

        // 自分の直近6か月(今月を含む)と、何か月つづけて紹介しているか
        var history = [];
        for (var i = 5; i >= 0; i--) {
          var mon = monthShift(ym, -i);
          var r1 = memberStats(db, mon + "-01", mon === ym ? t : lastDay(mon))[w.id] || {};
          history.push({ month: mon, referrals: r1.referrals || 0, miles: r1.miles || 0, points: r1.points || 0 });
        }
        var streak = 0;
        for (var j = 0; j < 24; j++) {
          var m2 = monthShift(ym, -j);
          var r2 = memberStats(db, m2 + "-01", m2 === ym ? t : lastDay(m2))[w.id];
          if (r2 && r2.referrals > 0) streak++;
          else if (j === 0) continue; // 今月まだなら先月から数える
          else break;
        }
        // 今月の BT-EX5 全体の目標
        var monthRows = period === "month" ? members : (function () {
          var mr = memberStats(db, ym + "-01", t);
          return Object.keys(mr).map(function (k) { return mr[k]; });
        })();
        var monthTotal = { referrals: 0, miles: 0 };
        monthRows.forEach(function (r) { monthTotal.referrals += r.referrals; monthTotal.miles += r.miles; });
        return c.ok({
          period: period, range: range, points: POINTS,
          members: members,
          me: members.filter(function (r) { return r.isMe; })[0] || null,
          total: total,
          goal: { target: communityGoal(db, members.length), referrals: monthTotal.referrals, miles: monthTotal.miles },
          history: history,
          streak: streak,
          canEditGoals: w.isAdmin,
        });
      }
      // 管理者: BT-EX5 全体の月の目標(紹介数・貢献金額)
      function adminSetTeamGoals(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var g = w.db.settings.teamGoals = w.db.settings.teamGoals || { default: {}, byTeam: {} };
        g.byTeam = g.byTeam || {};
        var goal = {
          referrals: Math.max(0, Math.min(999, Math.round(Number(body.referrals) || 0))),
          miles: Math.max(0, Math.min(1000000000, Math.round(Number(String(body.miles || "").replace(/[^\d]/g, "")) || 0))),
        };
        var team = c.cleanStr(body.team, 60);
        if (team) g.byTeam[team] = goal; else g.default = goal;
        c.saveDb(w.db);
        return c.ok({ goals: g });
      }

      // ============================================
      // 1on1(予定と記録)。メモは書いた本人だけが読める
      // ============================================
      // 30分きざみで5時間まで(45分は以前の記録のため残す)
      var DURATIONS = [30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300];
      function toMin(t) { var p = String(t || "").split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); }
      // 予定の時刻(時刻がなければその日)を過ぎた 1on1 は「確認待ち」。2人のどちらかが
      // 「実施した」と答えると実施になり、1on1 の回数に数える(「実施しなかった」なら中止)。
      // 以前は自動で実施にしていた(その記録は autoDone のまま残す)
      function autoComplete() { return false; }
      function awaitingConfirm(o) { return o.status === "planned" && c.nowMs() >= oneEndMs(o); }
      function endTime(o) {
        if (!o.time) return "";
        var m = toMin(o.time) + (o.duration || 60);
        return ("0" + Math.floor(m / 60) % 24).slice(-2) + ":" + ("0" + (m % 60)).slice(-2);
      }
      // 終わりが日付をまたぐ(例:22:30 から 4時間半 → 翌 3:00)とき、終わりの日付
      function endDate(o) {
        if (!o.time || toMin(o.time) + (o.duration || 60) < 24 * 60) return o.date;
        return dateKey(Date.parse(o.date + "T12:00:00+09:00") + DAY);
      }
      // 終わる時刻(時刻がなければその日の終わり)
      function oneEndMs(o) {
        var min = o.time ? toMin(o.time) + (o.duration || 60) : 24 * 60;
        return Date.parse(o.date + "T00:00:00+09:00") + min * 60000;
      }
      function oneView(db, o, me) {
        var other = o.a === me ? o.b : o.a;
        return {
          id: o.id, with: other, withName: nameOf(db, other), ext: db.extPeople && db.extPeople[other] ? "BT-EX" + db.extPeople[other].unit : "", date: o.date, time: o.time || "", end: endTime(o), endDate: endDate(o), duration: o.duration || 60,
          mode: o.mode || "onsite", place: o.place || "", meetUrl: o.meetUrl || "", calLink: o.calLink || "", synced: !!o.calId,
          status: o.status, autoDone: !!o.autoDone, awaiting: awaitingConfirm(o), confirmedByName: o.confirmedBy ? nameOf(db, o.confirmedBy) : "", note: (o.notes || {})[me] || "", next: (o.nexts || {})[me] || "", by: o.by, at: o.at,
        };
      }
      function userOf(db, memberId) { return c.find(db.users, function (u) { return u.memberId === memberId; }); }

      // Google カレンダーに予定を作る・直す・消す(共有サーバーでカレンダーを使えるときだけ)。
      // Google Meet を選んだときは Meet の会議も作り、2人のカレンダー用メールアドレスに招待を送る
      function syncCalendar(db, o, appUrl) {
        if (!c.calendar) return null;
        try {
          if (o.status === "cancelled") {
            if (o.calId) c.calendar.remove(o.calId);
            o.calId = ""; o.calLink = "";
            if (o.mode === "meet") o.meetUrl = "";
            return "removed";
          }
          if (o.status !== "planned") return null;
          var guests = [o.a, o.b].map(function (id) { var u = userOf(db, id); return u && u.calendarEmail; }).filter(Boolean);
          var r = c.calendar.upsert({
            id: o.calId || "",
            title: "1on1:" + nameOf(db, o.a) + " × " + nameOf(db, o.b) + "(BT-EX5)",
            date: o.date, start: o.time || "", end: endTime(o), endDate: endDate(o),
            meet: o.mode === "meet", location: o.mode === "meet" ? "" : o.place,
            description: "BT-EX5 の 1on1 です。" + (appUrl ? "\n会員サイト:" + appUrl : ""),
            guests: guests,
          });
          o.calId = r.id || o.calId || "";
          o.calLink = r.link || o.calLink || "";
          if (o.mode === "meet" && r.meetUrl) o.meetUrl = r.meetUrl;
          return "synced";
        } catch (err) {
          return "error";
        }
      }

      function list1on1(body) {
        var w = who(body);
        if (w.error) return w.error;
        var list = w.db.oneOnOnes
          .filter(function (o) { return o.a === w.id || o.b === w.id; })
          .sort(function (a, b) { return (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")); })
          .map(function (o) { return oneView(w.db, o, w.id); });
        return c.ok({ items: list, today: today(), calendar: !!c.calendar, hasCalendarEmail: !!w.user.calendarEmail });
      }
      function save1on1(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var o = body.id ? c.find(db.oneOnOnes, function (x) { return x.id === body.id && (x.a === w.id || x.b === w.id); }) : null;
        if (body.id && !o) return c.fail("NOT_FOUND");
        var date = cleanDate(body.date);
        if (!date) return c.fail("INVALID_REQUEST", "日付を入れてください。");
        if (!o) {
          var other = c.cleanStr(body.withMemberId, 40);
          // ほかの BT-EX のユニットの方: ユニットの番号(1〜14)とお名前で記録する(相手には届かず、自分の 1on1 として数える)
          var ext = body.ext && typeof body.ext === "object" ? body.ext : null;
          if (ext) {
            var unit = Math.round(Number(ext.unit));
            var extName = c.cleanStr(ext.name, 40);
            if (!(unit >= 1 && unit <= 14) || !extName) return c.fail("INVALID_REQUEST", "BT-EX の番号とお名前を入れてください。");
            if (!db.extPeople) db.extPeople = {};
            var known = Object.keys(db.extPeople).filter(function (k) { var p = db.extPeople[k]; return p.unit === unit && p.name === extName; })[0];
            other = known || ("x_" + c.randomHex(6));
            if (!known) db.extPeople[other] = { unit: unit, name: extName };
          } else if (!member(db, other) || other === w.id) return c.fail("INVALID_REQUEST", "相手を選んでください。");
          o = { id: newId("o_"), a: w.id, b: other, by: w.id, at: c.nowMs(), notes: {}, nexts: {} };
          db.oneOnOnes.push(o);
        }
        var before = JSON.stringify([o.date, o.time, o.duration, o.mode, o.place, o.status]);
        o.date = date;
        o.time = cleanTime(body.time);
        o.duration = DURATIONS.indexOf(Number(body.duration)) !== -1 ? Number(body.duration) : (o.duration || 60);
        o.mode = oneOf(body.mode, ["onsite", "meet"], o.mode || "onsite");
        o.place = o.mode === "meet" ? "Google Meet" : c.cleanStr(body.place, 80);
        // 共有サーバーで自動作成できないときは、自分で作った Meet の URL を入れられる
        var manualMeet = c.cleanStr(body.meetUrl, 200);
        if (o.mode === "meet" && /^https:\/\/meet\.google\.com\/[\w-]+$/.test(manualMeet)) o.meetUrl = manualMeet;
        if (o.mode !== "meet") o.meetUrl = "";
        var past = c.nowMs() >= oneEndMs(o);
        o.status = oneOf(body.status, ["planned", "done", "cancelled"], past ? "done" : "planned");
        if (o.status !== "done") { o.autoDone = false; }
        o.notes = o.notes || {};
        o.nexts = o.nexts || {};
        if ("note" in body) o.notes[w.id] = cleanText(body.note, 2000);
        if ("next" in body) o.nexts[w.id] = c.cleanStr(body.next, 200);
        var cal = null;
        var changedPlan = before !== JSON.stringify([o.date, o.time, o.duration, o.mode, o.place, o.status]);
        if (changedPlan || (o.status === "planned" && !o.calId)) cal = syncCalendar(db, o, c.cleanStr(body.appUrl, 300));
        c.saveDb(db);
        return c.ok({ item: oneView(db, o, w.id), calendar: cal });
      }
      // 時刻を過ぎた 1on1 に「実施した / 実施しなかった」と答える(2人のどちらでもよい)
      function confirm1on1(body) {
        var w = who(body);
        if (w.error) return w.error;
        var o = c.find(w.db.oneOnOnes, function (x) { return x.id === body.id && (x.a === w.id || x.b === w.id); });
        if (!o) return c.fail("NOT_FOUND");
        if (o.status !== "planned") return c.ok({ item: oneView(w.db, o, w.id), already: true });
        if (body.held === true) {
          o.status = "done";
          o.autoDone = false;
          o.doneAt = c.nowMs();
          o.confirmedBy = w.id;
        } else if (body.held === false) {
          o.status = "cancelled";
          o.confirmedBy = w.id;
          if (o.calId && c.calendar) syncCalendar(w.db, o, "");
        } else {
          return c.fail("INVALID_REQUEST");
        }
        c.saveDb(w.db);
        return c.ok({ item: oneView(w.db, o, w.id) });
      }

      function delete1on1(body) {
        var w = who(body);
        if (w.error) return w.error;
        var o = c.find(w.db.oneOnOnes, function (x) { return x.id === body.id && (x.a === w.id || x.b === w.id); });
        if (!o) return c.fail("NOT_FOUND");
        if (o.calId && c.calendar) { try { c.calendar.remove(o.calId); } catch (err) { /* 予定が消せなくても記録は消す */ } }
        w.db.oneOnOnes = w.db.oneOnOnes.filter(function (x) { return x.id !== o.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // 自分だけの設定(Google カレンダーの招待を受け取るメールアドレス)。ほかの会員には返さない
      // ホームの「〇〇さんへの紹介が N 日そのままです」を、紹介した本人が消す・あとにする
      //   mode: "done"(もう終わった・表示を消す)/ "later"(声をかけた。7日あとにまた知らせる)
      function muteReferralNudge(body) {
        var w = who(body);
        if (w.error) return w.error;
        var id = c.cleanStr(body.id, 40);
        var l = c.find(w.db.referralLogs, function (x) { return x.id === id; });
        if (!l || memberIdOfUser(w.db, l.fromUserId) !== w.id) return c.fail("NOT_FOUND");
        if (body.mode === "done") l.giverDone = true;
        else if (body.mode === "later") l.giverSnoozeUntil = c.nowMs() + 7 * DAY;
        else return c.fail("INVALID_REQUEST");
        c.saveDb(w.db);
        return c.ok({ id: l.id });
      }
      function getMySettings(body) {
        var w = who(body);
        if (w.error) return w.error;
        return c.ok({ calendarEmail: w.user.calendarEmail || "", calendar: !!c.calendar, meetName: w.user.meetName || "", name: w.me.name, goals: w.user.goals || null, pitchScript: w.user.pitchScript || "", notifyOff: w.user.notifyOff || [], line: lineState(w.user) });
      }
      function updateMySettings(body) {
        var w = who(body);
        if (w.error) return w.error;
        if ("calendarEmail" in body) {
          var email = c.cleanStr(body.calendarEmail, 120).toLowerCase();
          if (email && !/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email)) return c.fail("INVALID_REQUEST", "メールアドレスの形を確認してください。");
          w.user.calendarEmail = email;
        }
        if ("meetName" in body) w.user.meetName = c.cleanStr(body.meetName, 60);
        // 今月の目標(紹介・成約・1on1・ビジター。0 は目標なし)
        if (body.goals && typeof body.goals === "object") {
          var g = {};
          ["given", "won", "oneOnOnes", "visitors"].forEach(function (k) { var n = Math.round(Number(body.goals[k]) || 0); g[k] = Math.max(0, Math.min(99, n)); });
          w.user.goals = g;
        }
        // スマホに通知しない種類
        if (Array.isArray(body.notifyOff)) w.user.notifyOff = body.notifyOff.filter(function (g, i, a) { return PUSH_GROUPS[g] && a.indexOf(g) === i; });
        // 30秒プレゼンの原稿(本人だけが見る)
        if ("pitchScript" in body) w.user.pitchScript = cleanText(body.pitchScript, 2000);
        c.saveDb(w.db);
        return c.ok({ calendarEmail: w.user.calendarEmail || "", meetName: w.user.meetName || "", goals: w.user.goals || null, pitchScript: w.user.pitchScript || "", notifyOff: w.user.notifyOff || [] });
      }

      // ============================================
      // 運営連絡
      // ============================================
      function annView(w, a) {
        var v = { id: a.id, title: a.title, body: a.body, cat: a.cat, pinned: !!a.pinned, at: a.at, byName: a.byName || "運営", read: (a.readBy || []).indexOf(w.id) !== -1 };
        if (w.isAdmin) {
          v.readCount = (a.readBy || []).length;
          v.memberCount = (w.db.referralMembers || []).length;
          v.unreadNames = (w.db.referralMembers || []).filter(function (m) { return (a.readBy || []).indexOf(m.id) === -1; }).map(function (m) { return m.name; });
        }
        return v;
      }
      function listAnnouncements(body) {
        var w = who(body);
        if (w.error) return w.error;
        var list = w.db.announcements.slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at; });
        return c.ok({ items: list.map(function (a) { return annView(w, a); }), cats: ANNOUNCE_CATS });
      }
      function markAnnouncementsRead(body) {
        var w = who(body);
        if (w.error) return w.error;
        var ids = Array.isArray(body.ids) ? body.ids : null;
        var changed = false;
        w.db.announcements.forEach(function (a) {
          if (ids && ids.indexOf(a.id) === -1) return;
          a.readBy = a.readBy || [];
          if (a.readBy.indexOf(w.id) === -1) { a.readBy.push(w.id); changed = true; }
        });
        if (changed) c.saveDb(w.db);
        return c.ok({});
      }
      // まだ読んでいない人に、もう一度お知らせする(ベルとスマホ。通知の種類「運営連絡」を切っている人には送らない)。
      // 同じ運営連絡では6時間に1回まで
      function adminRemindAnnouncement(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var a = c.find(w.db.announcements, function (x) { return x.id === c.cleanStr(body.id, 40); });
        if (!a) return c.fail("NOT_FOUND");
        a.reminders = a.reminders || [];
        var last = a.reminders[a.reminders.length - 1];
        if (last && c.nowMs() - last.at < 6 * 60 * 60 * 1000) return c.fail("RATE_LIMITED", "この運営連絡は、さきほどお知らせしたばかりです。6時間あけてからにしてください。");
        var to = (w.db.referralMembers || []).filter(function (m) { return (a.readBy || []).indexOf(m.id) === -1 && m.id !== w.id; }).map(function (m) { return m.id; });
        if (!to.length) return c.fail("INVALID_REQUEST", "全員が読んでいます。");
        a.reminders.push({ at: c.nowMs(), to: to });
        if (a.reminders.length > 10) a.reminders = a.reminders.slice(-10);
        c.saveDb(w.db);
        return c.ok({ count: to.length });
      }

      function adminSaveAnnouncement(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var input = body.item || {};
        var title = c.cleanStr(input.title, 100);
        if (!title) return c.fail("INVALID_REQUEST", "件名を入れてください。");
        var a = c.find(w.db.announcements, function (x) { return x.id === input.id; });
        if (!a) {
          a = { id: newId("a_"), at: c.nowMs(), readBy: [], by: w.id, byName: w.me.name };
          w.db.announcements.push(a);
          trim(w.db.announcements, LIMITS.announcements);
        }
        a.title = title;
        a.body = cleanText(input.body, 4000);
        a.cat = oneOf(input.cat, ANNOUNCE_CATS, "お知らせ");
        a.pinned = input.pinned === true;
        // 書いた人は既読
        if (a.readBy.indexOf(w.id) === -1) a.readBy.push(w.id);
        c.saveDb(w.db);
        return c.ok({ item: annView(w, a) });
      }
      function adminDeleteAnnouncement(body) {
        var w = admin(body);
        if (w.error) return w.error;
        w.db.announcements = w.db.announcements.filter(function (a) { return a.id !== body.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // ============================================
      // 掲示板
      // ============================================
      function postView(w, p) {
        return {
          id: p.id, by: p.by, byName: nameOf(w.db, p.by), cat: p.cat, body: p.body, at: p.at,
          likes: (p.likes || []).length, liked: (p.likes || []).indexOf(w.id) !== -1,
          canDelete: p.by === w.id || w.isAdmin, canEdit: p.by === w.id, editedAt: p.editedAt || 0,
          comments: (p.comments || []).map(function (cm) {
            return { id: cm.id, by: cm.by, byName: nameOf(w.db, cm.by), body: cm.body, at: cm.at, canDelete: cm.by === w.id || w.isAdmin, canEdit: cm.by === w.id, edited: !!cm.editedAt };
          }),
        };
      }
      // ============================================
      // やること(担当者・期限つき)。管理者はだれにでも、メンバーは自分に割り当てられる。
      // 定例会の議事録から作ると、その定例会にひもづく
      // ============================================
      function taskView(db, t, me) {
        var done = t.done || {};
        return {
          id: t.id, title: t.title, note: t.note || "", due: t.due || "", time: t.time || "", private: !!t.private, eventId: t.eventId || "",
          eventTitle: (function () { var e = t.eventId && c.find(db.events, function (x) { return x.id === t.eventId; }); return e ? e.date.slice(5).replace("-", "/") + " " + e.title : ""; })(),
          by: t.by, byName: nameOf(db, t.by), at: t.at,
          assignees: t.assignees.map(function (id) { return { id: id, name: nameOf(db, id), done: !!done[id] }; }),
          mine: t.assignees.indexOf(me) !== -1, myDone: !!done[me], doneCount: t.assignees.filter(function (id) { return done[id]; }).length,
          canEdit: t.by === me,
        };
      }
      function listTasks(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var list = db.tasks.filter(function (t) {
          if (t.private && t.by !== w.id) return false;
          if (body.eventId) return t.eventId === body.eventId;
          return t.assignees.indexOf(w.id) !== -1 || t.by === w.id;
        });
        list.sort(function (a, b) { return (a.due || "9999").localeCompare(b.due || "9999") || a.at - b.at; });
        return c.ok({ items: list.map(function (t) { return taskView(db, t, w.id); }), today: today() });
      }
      function saveTask(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var input = body.item || {};
        var title = c.cleanStr(input.title, 100);
        if (!title) return c.fail("INVALID_REQUEST", "やることを入れてください。");
        var assignees = c.cleanList(input.assignees, null, 40).filter(function (id) { return member(db, id); });
        if (!w.isAdmin) assignees = assignees.filter(function (id) { return id === w.id; });
        if (!assignees.length) assignees = [w.id];
        var t = input.id ? c.find(db.tasks, function (x) { return x.id === input.id; }) : null;
        // 自分だけのやることは、書いた本人しか直せない(管理者も)
        if (input.id && (!t || (t.by !== w.id && (!w.isAdmin || t.private)))) return c.fail("NOT_FOUND");
        if (!t) {
          t = { id: newId("t_"), by: w.id, at: c.nowMs(), done: {} };
          db.tasks.push(t);
          trim(db.tasks, 1000);
        }
        t.title = title;
        t.note = cleanText(input.note, 500);
        t.due = cleanDate(input.due);
        t.time = t.due ? cleanTime(input.time) : "";
        var ev = input.eventId && c.find(db.events, function (x) { return x.id === input.eventId; });
        t.eventId = ev ? ev.id : (t.eventId || "");
        // 自分だけのやること: 担当は自分だけ、定例会にもつなげない(ほかの人・運営には見えない)
        t.private = input.private === true && !t.eventId;
        t.assignees = t.private ? [w.id] : assignees;
        c.saveDb(db);
        return c.ok({ item: taskView(db, t, w.id) });
      }
      function toggleTask(body) {
        var w = who(body);
        if (w.error) return w.error;
        var t = c.find(w.db.tasks, function (x) { return x.id === body.id; });
        if (!t || t.assignees.indexOf(w.id) === -1) return c.fail("NOT_FOUND");
        t.done = t.done || {};
        if (body.done === true) t.done[w.id] = c.nowMs(); else delete t.done[w.id];
        c.saveDb(w.db);
        return c.ok({ item: taskView(w.db, t, w.id) });
      }
      function deleteTask(body) {
        var w = who(body);
        if (w.error) return w.error;
        var t = c.find(w.db.tasks, function (x) { return x.id === body.id; });
        if (!t || (t.by !== w.id && (!w.isAdmin || t.private))) return c.fail("NOT_FOUND");
        w.db.tasks = w.db.tasks.filter(function (x) { return x.id !== t.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // 自分のコメントを直す
      function editComment(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.postId; });
        var cm = p && c.find(p.comments || [], function (x) { return x.id === body.id; });
        if (!cm || cm.by !== w.id) return c.fail("NOT_FOUND");
        var text = c.cleanStr(body.body, 1000);
        if (!text) return c.fail("INVALID_REQUEST", "コメントを入れてください。");
        cm.body = text;
        cm.editedAt = c.nowMs();
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }

      // 自分の投稿を直す(種類と本文)
      function editPost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.id; });
        if (!p || p.by !== w.id) return c.fail("NOT_FOUND");
        var text = cleanText(body.body, 2000);
        if (!text) return c.fail("INVALID_REQUEST", "本文を入れてください。");
        p.body = text;
        p.cat = oneOf(body.cat === "雑談" ? "告知" : body.cat, BOARD_CATS, p.cat);
        p.editedAt = c.nowMs();
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }
      function listBoard(body) {
        var w = who(body);
        if (w.error) return w.error;
        var s = seen(w.db, w.id);
        var lastSeen = s.board || 0;
        var items = w.db.posts.slice().reverse().map(function (p) {
          var v = postView(w, p);
          v.isNew = p.by !== w.id && p.at > lastSeen;
          return v;
        });
        if (body.markSeen !== false) { s.board = c.nowMs(); c.saveDb(w.db); }
        return c.ok({ items: items, cats: BOARD_CATS });
      }
      function createPost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var text = cleanText(body.body, 2000);
        if (!text) return c.fail("INVALID_REQUEST", "本文を入れてください。");
        var p = { id: newId("p_"), by: w.id, cat: oneOf(body.cat === "雑談" ? "告知" : body.cat, BOARD_CATS, "告知"), body: text, at: c.nowMs(), likes: [], comments: [] };
        w.db.posts.push(p);
        trim(w.db.posts, LIMITS.posts);
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }
      function deletePost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.id; });
        if (!p || (p.by !== w.id && !w.isAdmin)) return c.fail("NOT_FOUND");
        w.db.posts = w.db.posts.filter(function (x) { return x.id !== p.id; });
        c.saveDb(w.db);
        return c.ok({});
      }
      function commentPost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.postId; });
        if (!p) return c.fail("NOT_FOUND");
        var text = cleanText(body.body, 1000);
        if (!text) return c.fail("INVALID_REQUEST", "コメントを入れてください。");
        p.comments = p.comments || [];
        p.comments.push({ id: newId("c_"), by: w.id, body: text, at: c.nowMs() });
        trim(p.comments, LIMITS.comments);
        p.activeAt = c.nowMs();
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }
      function deleteComment(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.postId; });
        var cm = p && c.find(p.comments || [], function (x) { return x.id === body.id; });
        if (!cm || (cm.by !== w.id && !w.isAdmin)) return c.fail("NOT_FOUND");
        p.comments = p.comments.filter(function (x) { return x.id !== cm.id; });
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }
      function likePost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.id; });
        if (!p) return c.fail("NOT_FOUND");
        p.likes = p.likes || [];
        var i = p.likes.indexOf(w.id);
        if (i === -1) p.likes.push(w.id); else p.likes.splice(i, 1);
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }

      // ============================================
      // バグ・要望
      // ============================================
      function fbView(db, f, full) {
        var v = { id: f.id, kind: f.kind, body: f.body, at: f.at, status: f.status, reply: f.reply || "", replyAt: f.replyAt || 0 };
        if (full) { v.by = f.by; v.byName = nameOf(db, f.by); v.page = f.page || ""; }
        return v;
      }
      function sendFeedback(body) {
        var w = who(body);
        if (w.error) return w.error;
        var text = cleanText(body.body, 2000);
        if (!text) return c.fail("INVALID_REQUEST", "内容を入れてください。");
        var f = { id: newId("f_"), by: w.id, kind: oneOf(body.kind, FEEDBACK_KINDS, "other"), body: text, page: c.cleanStr(body.page, 120), at: c.nowMs(), status: "new" };
        w.db.feedback.push(f);
        trim(w.db.feedback, LIMITS.feedback);
        c.saveDb(w.db);
        return c.ok({ item: fbView(w.db, f) });
      }
      function listMyFeedback(body) {
        var w = who(body);
        if (w.error) return w.error;
        return c.ok({ items: w.db.feedback.filter(function (f) { return f.by === w.id; }).reverse().map(function (f) { return fbView(w.db, f); }) });
      }
      function adminListFeedback(body) {
        var w = admin(body);
        if (w.error) return w.error;
        return c.ok({ items: w.db.feedback.slice().reverse().map(function (f) { return fbView(w.db, f, true); }) });
      }
      function adminUpdateFeedback(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var f = c.find(w.db.feedback, function (x) { return x.id === body.id; });
        if (!f) return c.fail("NOT_FOUND");
        f.status = oneOf(body.status, FEEDBACK_STATUSES, f.status);
        if ("reply" in body) { f.reply = cleanText(body.reply, 1000); f.replyAt = c.nowMs(); }
        c.saveDb(w.db);
        return c.ok({ item: fbView(w.db, f, true) });
      }

      // ============================================
      // 運営ダッシュボード(管理者): 月ごとの数字・動きの少ない人・定例会ごとの出席
      // ============================================
      function adminDashboard(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var db = w.db;
        var month = /^\d{4}-\d{2}$/.test(String(body.month || "")) ? body.month : today().slice(0, 7);
        var prev = (function () {
          var y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)) - 1;
          if (m === 0) { y -= 1; m = 12; }
          return y + "-" + ("0" + m).slice(-2);
        })();
        function totals(mon) {
          var inMon = function (ms) { return monthKey(ms) === mon; };
          return {
            referrals: db.referralLogs.filter(function (l) { return inMon(l.at); }).length,
            won: db.referralLogs.filter(function (l) { return l.status === "won" && inMon(l.statusAt || l.at); }).length,
            miles: db.thanks.filter(function (t) { return inMon(t.at); }).reduce(function (s2, t) { return s2 + t.amount; }, 0),
            oneOnOnes: db.oneOnOnes.filter(function (o) { return o.status === "done" && o.date.slice(0, 7) === mon; }).length,
            visitors: db.visitors.filter(function (v) { var e = c.find(db.events, function (x) { return x.id === v.eventId; }); return e && e.date.slice(0, 7) === mon && v.status !== "invited" && v.status !== "declined"; }).length,
            posts: db.posts.filter(function (p) { return inMon(p.at); }).length,
          };
        }
        var monthEvents = db.events.filter(function (e) { return e.date.slice(0, 7) === month; })
          .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
          .map(function (e) {
            var rs = e.rsvps || {};
            return {
              id: e.id, title: e.title, date: e.date,
              yes: Object.keys(rs).filter(function (k) { return rs[k] === "yes"; }).length,
              no: Object.keys(rs).filter(function (k) { return rs[k] === "no"; }).length,
              attended: (e.attended || []).length,
              late: (e.late || []).length,
              visitors: db.visitors.filter(function (v) { return v.eventId === e.id && (v.status === "applied" || v.status === "attended" || v.status === "joined"); }).length,
            };
          });
        var members = (db.referralMembers || []).map(function (m) {
          var u = c.find(db.users, function (x) { return x.memberId === m.id; });
          var gave = db.referralLogs.filter(function (l) { return memberIdOfUser(db, l.fromUserId) === m.id; });
          var lastAct = 0;
          gave.forEach(function (l) { lastAct = Math.max(lastAct, l.at); });
          db.oneOnOnes.forEach(function (o) { if (o.a === m.id || o.b === m.id) lastAct = Math.max(lastAct, o.at); });
          db.posts.forEach(function (p) { if (p.by === m.id) lastAct = Math.max(lastAct, p.at); });
          var pastEvents = db.events.filter(function (e) { return e.date < today() && e.date >= dateKey(c.nowMs() - 120 * DAY); });
          var att = pastEvents.filter(function (e) { return (e.attended || []).indexOf(m.id) !== -1; }).length;
          return {
            id: m.id, name: m.name, team: m.team || "",
            lastLoginAt: (u && u.lastLoginAt) || 0,
            account: u && u.pw ? "active" : "none",
            monthGiven: gave.filter(function (l) { return monthKey(l.at) === month; }).length,
            monthReceived: db.referralLogs.filter(function (l) { return l.toMemberId === m.id && monthKey(l.at) === month; }).length,
            monthMiles: db.thanks.filter(function (t) { return t.to === m.id && monthKey(t.at) === month; }).reduce(function (s2, t) { return s2 + t.amount; }, 0),
            monthOnes: db.oneOnOnes.filter(function (o) { return (o.a === m.id || o.b === m.id) && o.status === "done" && o.date.slice(0, 7) === month; }).length,
            attendRate: pastEvents.length ? Math.round((att / pastEvents.length) * 100) : null,
            lastActivityAt: lastAct,
          };
        });
        var sc = searchCounts(db, month + "-01", month + "-31");
        // やることの進み具合(終わっていないもの)
        var openTasks = db.tasks.filter(function (t) { return !t.private && t.assignees.some(function (id) { return !(t.done || {})[id]; }); });
        members.forEach(function (row) {
          var mine = openTasks.filter(function (t) { return t.assignees.indexOf(row.id) !== -1 && !(t.done || {})[row.id]; });
          row.openTasks = mine.length;
          row.overdueTasks = mine.filter(function (t) { return t.due && t.due < today(); }).length;
        });
        members.forEach(function (row) {
          var m = member(db, row.id);
          row.topicCount = m && Array.isArray(m.topics) ? m.topics.length : 0;
          row.searchShown = (sc.m[row.id] || [0, 0])[0];
          row.searchTop = (sc.m[row.id] || [0, 0])[1];
        });
        return c.ok({
          month: month, prevMonth: prev, totals: totals(month), prevTotals: totals(prev), events: monthEvents, members: members, now: c.nowMs(),
          tasks: openTasks.sort(function (a, b) { return (a.due || "9999").localeCompare(b.due || "9999"); }).slice(0, 30).map(function (t) {
            var v = taskView(db, t, w.id);
            return { id: v.id, title: v.title, due: v.due, eventTitle: v.eventTitle, byName: v.byName, doneCount: v.doneCount, total: v.assignees.length,
              notDone: v.assignees.filter(function (a) { return !a.done; }).map(function (a) { return a.name; }) };
          }),
          search: { total: sc.n, misses: db.searchMisses.slice(-20).reverse().map(function (x) { return { at: x.at, text: x.text, byName: nameOf(db, x.by) }; }) },
        });
      }

      // データの書き出し(管理者)。紹介した相手の連絡先は当事者だけのものなので含めない
      function adminExport(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var db = w.db;
        var kind = oneOf(body.kind, ["referrals", "thanks", "attendance", "visitors", "oneOnOnes"], "referrals");
        var rows = [];
        if (kind === "referrals") {
          rows.push(["日時", "紹介した人", "紹介先", "紹介した方", "相談内容", "状況"]);
          db.referralLogs.forEach(function (l) {
            var g = memberIdOfUser(db, l.fromUserId);
            rows.push([l.at, nameOf(db, g), nameOf(db, l.toMemberId), l.prospect, l.memo || "", l.status]);
          });
        } else if (kind === "thanks") {
          rows.push(["日時", "お礼をした人", "紹介してくれた人", "金額(円)", "メッセージ"]);
          db.thanks.forEach(function (t) { rows.push([t.at, nameOf(db, t.from), nameOf(db, t.to), t.amount, t.message]); });
        } else if (kind === "attendance") {
          rows.push(["日付", "定例会", "氏名", "チーム", "出欠の回答", "出席"]);
          db.events.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (e) {
            (db.referralMembers || []).forEach(function (m) {
              rows.push([e.date, e.title, m.name, m.team || "", (e.rsvps || {})[m.id] || "", (e.attended || []).indexOf(m.id) !== -1 ? "出席" : ""]);
            });
          });
        } else if (kind === "visitors") {
          rows.push(["招待した日", "招待した人", "定例会", "お名前", "会社名", "事業内容", "連絡先", "ひとこと", "状況"]);
          db.visitors.forEach(function (v) {
            var e = c.find(db.events, function (x) { return x.id === v.eventId; });
            rows.push([v.at, nameOf(db, v.by), e ? e.date + " " + e.title : "", v.name, v.company, v.business, v.contact, v.message, v.status]);
          });
        } else {
          rows.push(["日付", "時刻", "メンバー", "相手", "場所", "状況"]);
          db.oneOnOnes.forEach(function (o) { rows.push([o.date, o.time || "", nameOf(db, o.a), nameOf(db, o.b), o.place || "", o.status]); });
        }
        return c.ok({ kind: kind, rows: rows });
      }

      // ============================================
      // お知らせ(自分に関係する出来事)。保存はせず、記録から毎回組み立てる
      // ============================================
      // 「@名前」で呼ばれたか(フルネーム・空白なし・名字だけ。名字だけは同じ名字の人がいないときだけ。全角の＠も)
      function mentions(db, me, text) {
        var t = String(text || "").replace(/＠/g, "@");
        if (t.indexOf("@") === -1) return false;
        var m = member(db, me);
        if (!m || !m.name) return false;
        var full = String(m.name).trim(), flat = full.replace(/\s+/g, ""), fam = full.split(/\s+/)[0];
        var famUnique = fam && fam !== full && (db.referralMembers || []).filter(function (x) { return String(x.name || "").split(/\s+/)[0] === fam; }).length === 1;
        return t.indexOf("@" + full) !== -1 || t.indexOf("@" + flat) !== -1 || (famUnique && t.indexOf("@" + fam) !== -1);
      }
      function activityItems(db, me) {
        var items = [];
        db.referralLogs.forEach(function (l) {
          var giver = memberIdOfUser(db, l.fromUserId);
          if (l.toMemberId === me && giver !== me) {
            items.push({ type: "refIn", at: l.at, who: giver, whoName: nameOf(db, giver), text: l.prospect || "", link: "log/ref" });
          }
          // もうすぐ始まる紹介の顔合わせ(3時間前から。紹介した人・受けた人の両方)
          if (l.meeting && l.status !== "lost" && (giver === me || l.toMemberId === me) && startsSoon(l.meeting.date, l.meeting.time)) {
            var other = giver === me ? l.toMemberId : giver;
            items.push({ type: "refMeetSoon", at: startMs(l.meeting.date, l.meeting.time) - SOON, who: other, whoName: nameOf(db, other), text: l.prospect || "", date: l.meeting.date, time: l.meeting.time, meetUrl: l.meeting.meetUrl || "", link: "log/ref" });
          }
          // 紹介の顔合わせの予定(相手が決めた・直したとき)
          if (l.meeting && l.meeting.setBy && l.meeting.setBy !== me && (giver === me || l.toMemberId === me)) {
            items.push({ type: "refMeet", at: l.meeting.setAt, who: l.meeting.setBy, whoName: nameOf(db, l.meeting.setBy), text: l.prospect || "", date: l.meeting.date, link: "log/ref" });
          }
          if (giver === me && l.statusAt && l.status !== "new") {
            items.push({ type: "refStatus", at: l.statusAt, who: l.toMemberId, whoName: nameOf(db, l.toMemberId), status: l.status, text: l.prospect || "", link: "log/ref" });
          }
        });
        db.thanks.forEach(function (t) {
          if (t.to === me) items.push({ type: "thanks", at: t.at, who: t.from, whoName: nameOf(db, t.from), amount: t.amount, text: t.message || "", link: "log/miles" });
        });
        db.posts.forEach(function (p) {
          // 掲示板の新しい投稿(自分以外)
          if (p.by !== me) items.push({ type: "post", at: p.at, who: p.by, whoName: nameOf(db, p.by), text: String(p.body).replace(/\s+/g, " ").slice(0, 60), cat: p.cat, link: "board" });
          if (p.by !== me && mentions(db, me, p.body)) items.push({ type: "mention", at: p.at + 1, who: p.by, whoName: nameOf(db, p.by), text: String(p.body).replace(/\s+/g, " ").slice(0, 60), link: "board?post=" + p.id });
          (p.comments || []).forEach(function (cm) {
            if (cm.by === me) return;
            if (mentions(db, me, cm.body)) { items.push({ type: "mention", at: cm.at + 1, who: cm.by, whoName: nameOf(db, cm.by), text: String(cm.body).slice(0, 60), link: "board?post=" + p.id }); return; }
            var mine = p.by === me;
            var joined = !mine && (p.comments || []).some(function (x) { return x.by === me && x.at < cm.at; });
            if (mine || joined) items.push({ type: mine ? "comment" : "reply", at: cm.at, who: cm.by, whoName: nameOf(db, cm.by), text: cm.body.slice(0, 60), link: "board" });
          });
        });
        db.oneOnOnes.forEach(function (o) {
          if ((o.a === me || o.b === me) && o.by !== me) items.push({ type: "oneNew", at: o.at, who: o.by, whoName: nameOf(db, o.by), date: o.date, link: "log/1on1" });
          // もうすぐ始まる 1on1(3時間前から)
          if ((o.a === me || o.b === me) && o.status === "planned" && startsSoon(o.date, o.time)) {
            var withId = o.a === me ? o.b : o.a;
            items.push({ type: "oneSoon", at: startMs(o.date, o.time) - SOON, who: withId, whoName: nameOf(db, withId), date: o.date, time: o.time, meetUrl: o.meetUrl || "", link: "log/1on1" });
          }
          // 時刻を過ぎた 1on1: 実施したかの確認
          if ((o.a === me || o.b === me) && awaitingConfirm(o)) {
            var other = o.a === me ? o.b : o.a;
            items.push({ type: "oneAsk", at: oneEndMs(o), who: other, whoName: nameOf(db, other), date: o.date, link: "log/1on1?confirm=" + o.id });
          }
        });
        db.visitors.forEach(function (v) {
          if (v.by === me && v.appliedAt) items.push({ type: "visitor", at: v.appliedAt, text: v.name, link: "events" });
        });
        // やること: 人から割り当てられた/期限が明日・今日でまだ
        db.tasks.forEach(function (tk) {
          if (tk.assignees.indexOf(me) === -1 || (tk.done || {})[me]) return;
          if (tk.by !== me) items.push({ type: "taskNew", at: tk.at, who: tk.by, whoName: nameOf(db, tk.by), text: tk.title, date: tk.due || "", link: "home" });
          if (tk.due) {
            var remind = Date.parse(tk.due + "T09:00:00+09:00") - DAY;
            if (c.nowMs() >= remind && tk.due >= today()) items.push({ type: "taskDue", at: remind, text: tk.title, date: tk.due, link: "home" });
            // 時刻つきのやることは、その時刻の少し前(1on1 と同じく3時間前から)にもお知らせ
            if (tk.time) {
              var s0 = startMs(tk.due, tk.time);
              if (s0 !== null && c.nowMs() >= s0 - SOON && c.nowMs() < s0) items.push({ type: "taskSoon", at: s0 - SOON, text: tk.title, date: tk.due, time: tk.time, link: "home" });
            }
          }
        });
        db.announcements.forEach(function (a) {
          items.push({ type: "ann", at: a.at, text: a.title, link: "news?open=" + a.id });
          // 運営からの「まだ読んでいない方へ」(まだ読んでいなければ)
          (a.reminders || []).forEach(function (r) {
            if (r.to.indexOf(me) !== -1 && (a.readBy || []).indexOf(me) === -1) items.push({ type: "annRemind", at: r.at, text: a.title, link: "news?open=" + a.id });
          });
        });
        db.events.forEach(function (e) {
          if (e.createdAt && e.date >= today()) items.push({ type: "event", at: e.createdAt, text: e.title, date: e.date, link: "events" });
          // 2日前になっても出欠がまだ → 確認(スマホにも通知)
          if (eventSoon(e) && !(e.rsvps || {})[me]) items.push({ type: "rsvpSoon", at: eventStartMs(e) - 2 * DAY, text: e.title, date: e.date, link: "events/detail/" + e.id });
        });
        var from = c.nowMs() - 60 * DAY;
        return items.filter(function (x) { return x.at >= from; }).sort(function (a, b) { return b.at - a.at; });
      }

      function getActivity(body) {
        var w = who(body);
        if (w.error) return w.error;
        var s = seen(w.db, w.id);
        var lastSeen = s.feed || 0;
        var items = activityItems(w.db, w.id).slice(0, 50).map(function (x) { x.isNew = x.at > lastSeen; return x; });
        if (body.markSeen !== false) { s.feed = c.nowMs(); c.saveDb(w.db); }
        return c.ok({ items: items });
      }

      // ============================================
      // ホーム: 1回の通信で、やること・未読・予定・数字をまとめて返す
      // ============================================
      // BT-EX5 シグナル(直近6か月の、自分の活動の信号。本人にだけ返す)
      // 参加(出席・1on1)と、価値の提供(紹介・ありがとうマイル・ビジター)を 100点で見る。緑 70〜・黄 50〜・赤 30〜・灰 〜29
      var SIGNAL_RULES = [
        { key: "attend", label: "定例会の出席", unit: "%", steps: [[90, 20], [75, 15], [50, 10], [0.01, 5]], tip: "定例会に出席する" },
        { key: "ones", label: "1on1", unit: "回/月", steps: [[2, 20], [1, 15], [0.5, 10], [0.01, 5]], tip: "1on1 をする", count: "回" },
        { key: "given", label: "出した紹介", unit: "件/月", steps: [[2, 25], [1, 20], [0.5, 12], [0.01, 6]], tip: "紹介を記録する", count: "件" },
        { key: "miles", label: "紹介からの売上", unit: "円", steps: [[1000000, 15], [300000, 10], [1, 5]], tip: "紹介が成約したら、お礼(ありがとうマイル)の記録をお願いする" },
        { key: "visitors", label: "ビジター招待", unit: "人", steps: [[3, 20], [2, 15], [1, 10]], tip: "ビジターを招待する", count: "人" },
      ];
      function signalOf(db, memberId) {
        var since = c.nowMs() - 182 * DAY;
        var t = today();
        var sinceDate = dateKey(since);
        var held = db.events.filter(function (e) { return e.date >= sinceDate && e.date <= t; });
        var attended = held.filter(function (e) { return (e.attended || []).indexOf(memberId) !== -1; }).length;
        var vals = {
          attend: held.length ? Math.round((attended / held.length) * 100) : 100,
          ones: Math.round((db.oneOnOnes.filter(function (o) { return o.status === "done" && (o.a === memberId || o.b === memberId) && o.date >= sinceDate; }).length / 6) * 10) / 10,
          given: Math.round((db.referralLogs.filter(function (l) { return memberIdOfUser(db, l.fromUserId) === memberId && l.at >= since; }).length / 6) * 10) / 10,
          miles: db.thanks.filter(function (x) { return x.to === memberId && x.at >= since; }).reduce(function (sum, x) { return sum + x.amount; }, 0),
          visitors: db.visitors.filter(function (v) { return v.by === memberId && v.at >= since && v.status !== "declined" && v.status !== "invited"; }).length,
        };
        var total = 0;
        var items = SIGNAL_RULES.map(function (r) {
          var v = vals[r.key], pt = 0, next = null;
          for (var i = 0; i < r.steps.length; i++) { if (v >= r.steps[i][0]) { pt = r.steps[i][1]; break; } }
          // 次の段まであといくつ(いちばん上ならなし)
          for (var j = r.steps.length - 1; j >= 0; j--) { if (r.steps[j][1] > pt) { next = { at: r.steps[j][0], pt: r.steps[j][1] - pt }; break; } }
          total += pt;
          // 次の段まで「あと何回・何件」(月あたりのものは6か月の回数に直す)
          if (next && r.count) next.more = Math.max(1, Math.ceil(r.unit.indexOf("/月") !== -1 ? next.at * 6 - v * 6 - 1e-9 : next.at - v));
          return { key: r.key, label: r.label, unit: r.unit, value: v, points: pt, max: r.steps[0][1], next: next, tip: r.tip, count: r.count || "" };
        });
        var color = total >= 70 ? "green" : total >= 50 ? "yellow" : total >= 30 ? "red" : "gray";
        return { total: total, color: color, items: items, held: held.length, attended: attended };
      }

      function getHome(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var t = today();
        var month = t.slice(0, 7);
        var upcoming = db.events
          .filter(function (e) { return e.date >= t; })
          .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
        var unreadAnn = db.announcements.filter(function (a) { return (a.readBy || []).indexOf(w.id) === -1; });
        var lastBoard = seen(db, w.id).board || 0;
        var newPosts = db.posts.filter(function (p) { return p.by !== w.id && p.at > lastBoard; }).length;
        var myLogs = db.referralLogs.filter(function (l) { return memberIdOfUser(db, l.fromUserId) === w.id; });
        var inbox = db.referralLogs.filter(function (l) { return l.toMemberId === w.id; });
        var monthMs = function (ms) { return monthKey(ms) === month; };
        var ones = db.oneOnOnes.filter(function (o) { return o.a === w.id || o.b === w.id; });
        var nextOnes = ones
          .filter(function (o) { return o.status === "planned" && o.date >= t; })
          .sort(function (a, b) { return (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")); })
          .slice(0, 3)
          .map(function (o) { return oneView(db, o, w.id); });
        var missing = typeof missingProfileItems === "function" ? missingProfileItems(Object.assign({ triggers: [], faceAreas: [] }, w.me)).map(function (it) { return it.label; }) : [];
        if (!(w.me.topics || []).length) missing.push("できること(ジャンル)");

        // 声かけが必要なこと(放っておくと紹介が止まるもの)
        var followUps = [];
        myLogs.forEach(function (l) {
          // 自分で「もう終わった」にしたもの・「あとで」にしたもの・30日より前のものは出さない
          if (l.status === "new" && !l.giverDone && !(l.giverSnoozeUntil > c.nowMs()) && c.nowMs() - l.at > 3 * DAY && c.nowMs() - l.at <= 30 * DAY) {
            followUps.push({ type: "givenStale", id: l.id, with: l.toMemberId, withName: nameOf(db, l.toMemberId), prospect: l.prospect, days: Math.floor((c.nowMs() - l.at) / DAY) });
          }
        });
        inbox.forEach(function (l) {
          var giver = memberIdOfUser(db, l.fromUserId);
          if (l.status === "won" && !c.find(db.thanks, function (t) { return t.referralId === l.id; })) {
            followUps.push({ type: "thanksMissing", id: l.id, with: giver, withName: nameOf(db, giver), prospect: l.prospect });
          } else if (l.status === "new" && c.nowMs() - l.at > 2 * DAY) {
            followUps.push({ type: "inboxStale", id: l.id, with: giver, withName: nameOf(db, giver), prospect: l.prospect, days: Math.floor((c.nowMs() - l.at) / DAY) });
          }
        });
        ones.forEach(function (o) {
          if (o.status !== "planned") return;
          var other = o.a === w.id ? o.b : o.a;
          if (awaitingConfirm(o)) followUps.push({ type: "oneConfirm", id: o.id, with: other, withName: nameOf(db, other), date: o.date, time: o.time || "" });
          else if (o.date === t) followUps.push({ type: "oneToday", id: o.id, with: other, withName: nameOf(db, other), time: o.time || "", place: o.place || "", meetUrl: o.meetUrl || "" });
        });
        // 今日の紹介の顔合わせ(紹介した人・受けた人)
        db.referralLogs.forEach(function (l) {
          if (!l.meeting || l.meeting.date !== t || l.status === "lost") return;
          var giver = memberIdOfUser(db, l.fromUserId);
          if (giver !== w.id && l.toMemberId !== w.id) return;
          var end = startMs(l.meeting.date, l.meeting.time);
          if (end !== null && c.nowMs() > end + (l.meeting.duration || 60) * 60000) return;
          followUps.push({ type: "refMeetToday", id: l.id, prospect: l.prospect || "", withName: nameOf(db, giver === w.id ? l.toMemberId : giver), time: l.meeting.time || "", place: l.meeting.mode === "meet" ? "Google Meet" : l.meeting.place || "", meetUrl: l.meeting.meetUrl || "" });
        });
        // 自分が招いたビジターが参加した(入会・見送りがまだ・参加から14日以内) → 入会の声かけ
        db.visitors.forEach(function (v) {
          if (v.by !== w.id || v.status !== "attended") return;
          var e = c.find(db.events, function (x) { return x.id === v.eventId; });
          if (!e || e.date > t || c.nowMs() - eventEndMs(e) > 14 * DAY) return;
          followUps.push({ type: "visitorFollow", id: v.id, name: v.name || "ビジター", date: e.date });
        });
        // 定例会が近いのに出欠がまだ(2日以内・締切前)
        db.events.forEach(function (e) {
          if (!eventSoon(e) || (e.rsvps || {})[w.id]) return;
          followUps.push({ type: "rsvpSoon", id: e.id, title: e.title, date: e.date, start: e.start || "" });
        });
        // 時刻を過ぎて自動で「実施」になった 1on1(1週間以内・自分のメモがまだ)
        ones.forEach(function (o) {
          if (!(o.autoDone || o.confirmedBy) || (o.notes || {})[w.id] || c.nowMs() - (o.doneAt || 0) > 7 * DAY) return;
          var other = o.a === w.id ? o.b : o.a;
          followUps.push({ type: "oneMemo", id: o.id, with: other, withName: nameOf(db, other), date: o.date });
        });
        // 今週の紹介チャレンジ: 最近(60日)紹介を受けていない人を優先し、週ごとに1人。自分は除く。
        // 求める紹介が入っている人だけ(紹介のしようがないため)
        var spotlight = (function () {
          var since = c.nowMs() - 60 * DAY;
          var week = Math.floor((c.nowMs() + JST) / (7 * DAY));
          var pool = (db.referralMembers || []).filter(function (m) { return m.id !== w.id && m.wants; }).map(function (m) {
            var got = db.referralLogs.filter(function (l) { return l.toMemberId === m.id && l.at >= since; }).length;
            var h = 0, key = m.id + ":" + week;
            for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100003;
            return { m: m, got: got, h: h };
          });
          if (!pool.length) return null;
          pool.sort(function (a, b) { return a.got - b.got || a.h - b.h; });
          var p = pool[0].m;
          return { id: p.id, name: p.name, company: p.company || "", wants: p.wants, triggers: (p.triggers || []).slice(0, 4), offer: p.offer || "", received: pool[0].got };
        })();
        var myTasks = db.tasks.filter(function (tk) { return tk.assignees.indexOf(w.id) !== -1 && !(tk.done || {})[w.id]; })
          .sort(function (a, b) { return (a.due || "9999").localeCompare(b.due || "9999") || a.at - b.at; })
          .map(function (tk) { return taskView(db, tk, w.id); });
        return c.ok({
          tasks: myTasks,
          spotlight: spotlight,
          me: { id: w.id, name: w.me.name, team: w.me.team || "", isAdmin: w.isAdmin, hasPassword: !!w.user.pw, goals: w.user.goals || null },
          today: t,
          events: upcoming.slice(0, 3).map(function (e) { return eventView(w, e); }),
          checkInOpen: upcoming.some(function (e) { return e.date === t && e.checkIn; }),
          announcements: db.announcements.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, 3).map(function (a) { return annView(w, a); }),
          badges: {
            announcements: unreadAnn.length,
            board: newPosts,
            inbox: inbox.filter(function (l) { return l.status === "new"; }).length,
            rsvp: upcoming.filter(function (e) { return !(e.rsvps || {})[w.id]; }).length,
            feed: activityItems(db, w.id).filter(function (x) { return x.at > (seen(db, w.id).feed || 0); }).length,
          },
          stats: {
            given: myLogs.filter(function (l) { return monthMs(l.at); }).length,
            received: inbox.filter(function (l) { return monthMs(l.at); }).length,
            won: myLogs.filter(function (l) { return l.status === "won" && monthMs(l.statusAt || l.at); }).length,
            milesIn: db.thanks.filter(function (x) { return x.to === w.id && monthMs(x.at); }).reduce(function (s, x) { return s + x.amount; }, 0),
            milesOut: db.thanks.filter(function (x) { return x.from === w.id && monthMs(x.at); }).reduce(function (s, x) { return s + x.amount; }, 0),
            oneOnOnes: ones.filter(function (o) { return o.status === "done" && o.date.slice(0, 7) === month; }).length,
            visitors: db.visitors.filter(function (v) { return v.by === w.id && monthMs(v.at); }).length,
            givenAll: myLogs.length,
            milesInAll: db.thanks.filter(function (x) { return x.to === w.id; }).reduce(function (s, x) { return s + x.amount; }, 0),
          },
          signal: signalOf(db, w.id),
          // BT-EX5 全体の今月(みんなの動き)
          community: {
            given: db.referralLogs.filter(function (l) { return monthMs(l.at); }).length,
            won: db.referralLogs.filter(function (l) { return l.status === "won" && monthMs(l.statusAt || l.at); }).length,
            miles: db.thanks.filter(function (x) { return monthMs(x.at); }).reduce(function (s2, x) { return s2 + x.amount; }, 0),
            ones: db.oneOnOnes.filter(function (o) { return o.status === "done" && o.date.slice(0, 7) === month; }).length,
            posts: db.posts.filter(function (p) { return monthMs(p.at); }).length,
            members: (db.referralMembers || []).length,
          },
          inboxNew: inbox.filter(function (l) { return l.status === "new"; }).slice(-3).reverse().map(function (l) { return referralView(db, l, w.id); }),
          nextOneOnOnes: nextOnes,
          missing: missing,
          followUps: followUps.slice(0, 6),
          teamRank: (function () {
            var rows = memberStats(db, t.slice(0, 7) + "-01", t);
            if (!rows[w.id]) return null;
            var ms = rankRows(Object.keys(rows).map(function (k) { return rows[k]; }), "points");
            var me = ms.filter(function (r) { return r.id === w.id; })[0];
            return { rank: me.rank, size: ms.length, points: me.points, gap: me.gap, gapName: me.gapName, tied: me.tied || 1 };
          })(),
        });
      }

      // ============================================
      // プッシュ通知(iPhone・Android・パソコンの通知)
      // サーバーから送るのは中身のない「合図」だけ。合図を受けた端末(sw.js)が pushPeek で
      // 自分あての最新のお知らせを取りに来て表示する。pushPeek はその端末だけが知る鍵で読む
      // (ログインのトークンを端末の裏側に置かない)。お知らせの中身は activityItems と同じ
      // ============================================
      var PUSH_MAX_PER_MEMBER = 10;
      function cleanEndpoint(v) {
        var s = String(v || "").trim();
        return /^https:\/\/[^\s"'<>]+$/.test(s) && s.length <= 1000 ? s : "";
      }
      function cleanKey(v) {
        var s = String(v || "");
        return /^[A-Za-z0-9_-]{1,200}$/.test(s) ? s : "";
      }
      // スマホの通知の種類(本人が切ったものは通知しない。ベルのお知らせには、これまでどおり全部出す)
      var PUSH_GROUPS = {
        ref: ["refIn", "refStatus", "refMeet", "refMeetSoon", "thanks"],
        one: ["oneNew", "oneSoon", "oneAsk"],
        board: ["post", "comment", "reply"],
        mention: ["mention"],
        news: ["ann", "annRemind", "rsvpSoon", "event"],
        task: ["taskNew", "taskDue", "taskSoon"],
        visitor: ["visitor"],
      };
      function pushItems(db, memberId) {
        var u = userOf(db, memberId);
        var off = (u && Array.isArray(u.notifyOff)) ? u.notifyOff : [];
        var muted = [];
        off.forEach(function (g) { (PUSH_GROUPS[g] || []).forEach(function (t) { muted.push(t); }); });
        var items = activityItems(db, memberId);
        return muted.length ? items.filter(function (x) { return muted.indexOf(x.type) === -1; }) : items;
      }
      function latestActivityAt(db, memberId) {
        var items = pushItems(db, memberId);
        return items.length ? items[0].at : 0;
      }

      function pushConfig(body) {
        var w = who(body);
        if (w.error) return w.error;
        var available = !!(c.push && c.push.publicKey);
        return c.ok({
          available: available,
          publicKey: available ? c.push.publicKey() : "",
          devices: w.db.pushSubs.filter(function (s) { return s.memberId === w.id; }).length,
        });
      }

      function savePushSubscription(body) {
        var w = who(body);
        if (w.error) return w.error;
        if (!c.push) return c.fail("INVALID_REQUEST", "通知は共有サーバーで動いているときだけ使えます。");
        var sub = body.subscription || {};
        var endpoint = cleanEndpoint(sub.endpoint);
        if (!endpoint) return c.fail("INVALID_REQUEST");
        var db = w.db;
        var peekKey = c.randomToken();
        var row = c.find(db.pushSubs, function (s) { return s.endpoint === endpoint; });
        if (!row) {
          row = { endpoint: endpoint, at: c.nowMs() };
          db.pushSubs.push(row);
        }
        row.memberId = w.id;
        row.peek = c.sha256Hex(peekKey);
        row.ua = c.cleanStr(body.userAgent, 120);
        row.seenAt = c.nowMs();
        // 登録した時点より前の出来事では鳴らさない
        row.notified = Math.max(row.notified || 0, latestActivityAt(db, w.id));
        // 古い端末から消す(1人あたり上限まで)
        var mine = db.pushSubs.filter(function (s) { return s.memberId === w.id; }).sort(function (a, b) { return a.seenAt - b.seenAt; });
        var drop = mine.slice(0, Math.max(0, mine.length - PUSH_MAX_PER_MEMBER)).map(function (s) { return s.endpoint; });
        if (drop.length) db.pushSubs = db.pushSubs.filter(function (s) { return drop.indexOf(s.endpoint) === -1; });
        var site = String(body.site || "").match(/^https:\/\/[A-Za-z0-9.-]+(:\d+)?/);
        if (site) db.pushSite = site[0];
        c.saveDb(db);
        return c.ok({ peekKey: peekKey, devices: mine.length - drop.length });
      }

      function deletePushSubscription(body) {
        var db = c.ensureDb();
        var endpoint = cleanEndpoint(body.endpoint);
        var a = c.authSession(db, body.sessionToken);
        var peek = cleanKey(body.peekKey);
        var before = db.pushSubs.length;
        db.pushSubs = db.pushSubs.filter(function (s) {
          if (s.endpoint !== endpoint) return true;
          var mine = (a && a.user.memberId === s.memberId) || (peek && s.peek === c.sha256Hex(peek));
          return !mine;
        });
        if (db.pushSubs.length !== before) c.saveDb(db);
        return c.ok({ removed: before - db.pushSubs.length });
      }

      // 通知に出す文(app/feed.js の表示と同じ言い回し)
      var REF_STATUS_JA = { contacted: "連絡しました", meeting: "商談中です", won: "成約しました", lost: "見送りになりました" };
      function pushText(x) {
        var n = (x.whoName || "") + "さん";
        switch (x.type) {
          case "refIn": return { title: "🤝 " + n + "から紹介が届きました", body: x.text };
          case "refStatus": return { title: "🤝 紹介の進み具合", body: n + "への紹介(" + x.text + ")が" + (REF_STATUS_JA[x.status] || "更新されました") };
          case "thanks": return { title: "🎉 " + n + "からありがとうマイル", body: (x.amount ? Number(x.amount).toLocaleString("ja-JP") + "円 " : "") + x.text };
          case "post": return { title: "📝 " + n + "が掲示板に投稿しました", body: x.text };
          case "comment": return { title: "💬 " + n + "があなたの投稿にコメント", body: x.text };
          case "reply": return { title: "💬 " + n + "も掲示板でコメント", body: x.text };
          case "oneNew": return { title: "☕ " + n + "と1on1の予定", body: x.date || "" };
          case "rsvpSoon": return { title: "📅 " + (x.date || "") + " の定例会の出欠がまだです", body: x.text + "(押して出席・欠席を選んでください)" };
          case "refMeet": return { title: "🤝 " + n + "が紹介の顔合わせの予定を入れました", body: (x.date || "") + " " + x.text };
          case "oneSoon": return { title: "☕ " + (x.time || "") + " から " + n + "と 1on1 です", body: x.meetUrl ? "Google Meet:" + x.meetUrl : "押すと予定を確認できます" };
          case "refMeetSoon": return { title: "🤝 " + (x.time || "") + " から紹介の顔合わせです", body: x.text + " × " + n + (x.meetUrl ? "(Google Meet:" + x.meetUrl + ")" : "") };
          case "taskNew": return { title: "✅ " + n + "から やること", body: x.text + (x.date ? "(期限 " + x.date.slice(5).replace("-", "/") + ")" : "") };
          case "taskDue": return { title: "⏰ やることの期限が近づいています", body: x.text + "(期限 " + x.date.slice(5).replace("-", "/") + ")" };
          case "mention": return { title: "＠ " + n + "が掲示板であなたの名前を出しました", body: x.text };
          case "taskSoon": return { title: "⏰ " + (x.time || "") + " から:" + x.text, body: "やることの時刻が近づいています" };
          case "oneAsk": return { title: "☕ " + n + "との1on1 は実施しましたか?", body: "「実施した」を押すと 1on1 の回数に数えます" };
          case "visitor": return { title: "🙋 ビジターの申込がありました", body: x.text + " さん" };
          case "ann": return { title: "📣 運営からのお知らせ", body: x.text };
          case "annRemind": return { title: "📣 まだ読んでいない運営連絡があります", body: x.text };
          case "event": return { title: "📅 定例会の予定が出ました", body: (x.date || "") + " " + x.text };
          default: return { title: "BT-EX5", body: "新しいお知らせがあります" };
        }
      }

      // 端末(sw.js)が通知に出す中身を取りに来る。ログインは不要で、登録時に渡した鍵で読む
      function pushPeek(body) {
        var db = c.ensureDb();
        var endpoint = cleanEndpoint(body.endpoint);
        var peek = cleanKey(body.peekKey);
        var row = endpoint && peek ? c.find(db.pushSubs, function (s) { return s.endpoint === endpoint; }) : null;
        if (!row || row.peek !== c.sha256Hex(peek)) return c.fail("SESSION_INVALID");
        var lastSeen = seen(db, row.memberId).feed || 0;
        var fresh = pushItems(db, row.memberId).filter(function (x) { return x.at > lastSeen; });
        var top = fresh[0];
        var t = top ? pushText(top) : { title: "BT-EX5", body: "新しいお知らせがあります" };
        return c.ok({
          title: t.title,
          body: String(t.body || "").slice(0, 120),
          link: top ? top.link : "feed",
          count: fresh.length,
          more: Math.max(0, fresh.length - 1),
        });
      }

      // ============================================
      // LINE で受け取る(LINE 公式アカウント + Messaging API)
      // 運営が LINE 公式アカウントを用意して共有サーバーに設定すると使える(c.line)。
      // つなぎ方: 会員がアプリで6けたのコードを出す → 公式アカウントを友だち追加して、そのコードを送る →
      // 共有サーバーが受け取った(Webhook)LINE のユーザー ID を、その会員にひもづける。
      // 送る内容はスマホの通知と同じ(通知の種類で切ったものは送らない)。月の上限(無料プランは200通)をこえたら止める
      // ============================================
      var LINE_CODE_MINUTES = 30;
      function lineState(u) {
        return { available: !!c.line, linked: !!(u && u.lineUserId), on: !!(u && u.lineUserId && u.lineOn !== false), addUrl: (c.line && c.line.addUrl) || "" };
      }
      function lineLinkCode(body) {
        var w = who(body);
        if (w.error) return w.error;
        if (!c.line) return c.fail("INVALID_REQUEST", "LINE での通知は、まだ準備中です(運営が LINE 公式アカウントを用意すると使えます)。");
        var code = String(100000 + (parseInt(c.randomHex(4), 16) % 900000));
        w.user.lineCode = { hash: c.sha256Hex("line:" + code), exp: c.nowMs() + LINE_CODE_MINUTES * 60 * 1000 };
        var site = String(body.appUrl || "").match(/^https:\/\/[^\s"'<>#?]+\/app\//);
        if (site) w.db.lineAppUrl = site[0];
        c.saveDb(w.db);
        return c.ok({ code: code, minutes: LINE_CODE_MINUTES, addUrl: c.line.addUrl || "" });
      }
      function lineSetting(body) {
        var w = who(body);
        if (w.error) return w.error;
        if (body.unlink === true) { delete w.user.lineUserId; delete w.user.lineOn; delete w.user.lineCode; }
        else if (typeof body.on === "boolean") w.user.lineOn = body.on;
        c.saveDb(w.db);
        return c.ok({ line: lineState(w.user) });
      }
      // LINE から届いたできごと(Webhook)。返すのは「返信する文」の一覧(送るのは GAS 側)
      function jobLineWebhook(events) {
        var db = c.ensureDb();
        var replies = [];
        var changed = false;
        (Array.isArray(events) ? events : []).forEach(function (ev) {
          var uid = ev && ev.source && ev.source.userId;
          if (!uid || !ev.replyToken) return;
          if (ev.type === "follow") {
            replies.push({ replyToken: ev.replyToken, text: "BT-EX5 の公式アカウントです。\n通知を受け取るには、会員アプリの「マイページ → 通知を受け取る → LINE とつなぐ」に出る6けたのコードを、このトークに送ってください。" });
            return;
          }
          if (ev.type !== "message" || !ev.message || ev.message.type !== "text") return;
          var m = /(\d{6})/.exec(String(ev.message.text || "").replace(/[０-９]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 0xfee0); }));
          if (!m) {
            var known = c.find(db.users, function (u) { return u.lineUserId === uid; });
            replies.push({ replyToken: ev.replyToken, text: known ? "このアカウントには、BT-EX5 からのお知らせが届きます。ご返信はアプリからお願いします。" : "会員アプリに出る6けたのコードを送ってください。" });
            return;
          }
          var hash = c.sha256Hex("line:" + m[1]);
          var user = c.find(db.users, function (u) { return u.lineCode && u.lineCode.hash === hash && u.lineCode.exp > c.nowMs(); });
          if (!user) { replies.push({ replyToken: ev.replyToken, text: "コードが正しくないか、期限(30分)が切れています。アプリでもう一度コードを出してください。" }); return; }
          // 同じ LINE がほかの会員にひもづいていたら外す(1つの LINE は1人だけ)
          db.users.forEach(function (u) { if (u !== user && u.lineUserId === uid) { delete u.lineUserId; } });
          user.lineUserId = uid; user.lineOn = true; delete user.lineCode;
          user.lineNotified = latestActivityAt(db, user.memberId); // つないだ時点より前のお知らせは送らない
          changed = true;
          replies.push({ replyToken: ev.replyToken, text: (nameOf(db, user.memberId) || "") + "さん、つながりました。これから BT-EX5 のお知らせ(紹介・1on1・運営連絡など)を LINE でもお届けします。止めるときはアプリの「通知を受け取る」から。" });
        });
        if (changed) c.saveDb(db);
        return { replies: replies };
      }
      // 書き込みのあとに呼ぶ: LINE で送るお知らせ(1人1通にまとめる)
      function jobTakeLineOutbox() {
        if (!c.line) return { messages: [] };
        var db = c.ensureDb();
        var month = today().slice(0, 7);
        db.lineSent = db.lineSent && db.lineSent.month === month ? db.lineSent : { month: month, count: 0 };
        var limit = Number((db.settings && db.settings.lineMonthlyLimit) || c.line.monthlyLimit || 200);
        var out = [];
        db.users.forEach(function (u) {
          if (!u.lineUserId || u.lineOn === false || !member(db, u.memberId)) return;
          var fresh = pushItems(db, u.memberId).filter(function (x) { return x.at > (u.lineNotified || 0); });
          if (!fresh.length) return;
          if (db.lineSent.count >= limit) return;
          u.lineNotified = fresh.reduce(function (mx, x) { return Math.max(mx, x.at); }, 0);
          var t = pushText(fresh[0]);
          var url = (db.lineAppUrl || "") ? db.lineAppUrl + "#" + (fresh[0].link || "feed") : "";
          var text = t.title + "\n" + String(t.body || "").slice(0, 200) + (fresh.length > 1 ? "\n(ほか " + (fresh.length - 1) + " 件)" : "") + (url ? "\n" + url : "");
          out.push({ to: u.lineUserId, text: text });
          db.lineSent.count += 1;
        });
        if (out.length) c.saveDb(db);
        return { messages: out };
      }
      // 管理者: LINE の状態(つないだ人数・今月送った数)と、月の上限
      function adminLineStatus(body) {
        var w = admin(body);
        if (w.error) return w.error;
        if (typeof body.monthlyLimit === "number" && body.monthlyLimit >= 0 && body.monthlyLimit <= 100000) { w.db.settings.lineMonthlyLimit = Math.round(body.monthlyLimit); c.saveDb(w.db); }
        var month = today().slice(0, 7);
        var sent = w.db.lineSent && w.db.lineSent.month === month ? w.db.lineSent.count : 0;
        var linked = w.db.users.filter(function (u) { return u.lineUserId && member(w.db, u.memberId); });
        return c.ok({
          available: !!c.line, addUrl: (c.line && c.line.addUrl) || "",
          linked: linked.length, members: (w.db.referralMembers || []).length,
          linkedNames: linked.map(function (u) { return nameOf(w.db, u.memberId); }),
          sentThisMonth: sent, monthlyLimit: Number(w.db.settings.lineMonthlyLimit || (c.line && c.line.monthlyLimit) || 200),
        });
      }

      // 書き込みのあとに呼ぶ: 新しいお知らせがある端末を選び、送り先として返す(中身は返さない)
      function jobTakePushOutbox() {
        var db = c.ensureDb();
        if (!db.pushSubs || !db.pushSubs.length) return { subs: [] };
        var latest = {};
        var out = [];
        db.pushSubs.forEach(function (s) {
          if (!(s.memberId in latest)) latest[s.memberId] = member(db, s.memberId) ? latestActivityAt(db, s.memberId) : 0;
          var at = latest[s.memberId];
          if (at > (s.notified || 0)) {
            s.notified = at;
            out.push({ endpoint: s.endpoint });
          }
        });
        if (out.length) c.saveDb(db);
        return { subs: out, subject: db.pushSite || "" };
      }

      // 届かなくなった端末(404・410)を消す
      function jobDropPushSubs(endpoints) {
        var list = Array.isArray(endpoints) ? endpoints : [];
        if (!list.length) return { removed: 0 };
        var db = c.ensureDb();
        var before = db.pushSubs.length;
        db.pushSubs = db.pushSubs.filter(function (s) { return list.indexOf(s.endpoint) === -1; });
        if (db.pushSubs.length !== before) c.saveDb(db);
        return { removed: before - db.pushSubs.length };
      }

      return {
        migrate: migrate,
        jobs: { syncMeet: jobSyncMeet, takePushOutbox: jobTakePushOutbox, dropPushSubs: jobDropPushSubs, lineWebhook: jobLineWebhook, takeLineOutbox: jobTakeLineOutbox },
        actions: {
          getHome: getHome, getActivity: getActivity, adminDashboard: adminDashboard, adminExport: adminExport,
          listEvents: listEvents, getEvent: getEvent, rsvpEvent: rsvpEvent, checkIn: checkIn,
          adminSaveEvent: adminSaveEvent, adminDeleteEvent: adminDeleteEvent, adminSaveMinutes: adminSaveMinutes, adminOpenCheckIn: adminOpenCheckIn,
          adminEventDetail: adminEventDetail, adminMarkAttendance: adminMarkAttendance,
          adminSyncMeetAttendance: adminSyncMeetAttendance, adminMapMeetName: adminMapMeetName,
          createVisitorInvite: createVisitorInvite, listMyVisitors: listMyVisitors, updateVisitor: updateVisitor,
          visitorInfo: visitorInfo, visitorApply: visitorApply,
          listMyReferrals: listMyReferrals, setReferralMeeting: setReferralMeeting, reportThanks: reportThanks, deleteThanks: deleteThanks, getRankings: getRankings, getTeamRanking: getTeamRanking, getStats: getStats, logSearch: logSearch, adminSetTeamGoals: adminSetTeamGoals,
          list1on1: list1on1, save1on1: save1on1, delete1on1: delete1on1, confirm1on1: confirm1on1,
          getMySettings: getMySettings, updateMySettings: updateMySettings, muteReferralNudge: muteReferralNudge, lineLinkCode: lineLinkCode, lineSetting: lineSetting, adminLineStatus: adminLineStatus,
          listAnnouncements: listAnnouncements, markAnnouncementsRead: markAnnouncementsRead,
          adminSaveAnnouncement: adminSaveAnnouncement, adminDeleteAnnouncement: adminDeleteAnnouncement, adminRemindAnnouncement: adminRemindAnnouncement,
          listTasks: listTasks, saveTask: saveTask, toggleTask: toggleTask, deleteTask: deleteTask,
          listBoard: listBoard, createPost: createPost, editPost: editPost, editComment: editComment, deletePost: deletePost, commentPost: commentPost,
          deleteComment: deleteComment, likePost: likePost,
          sendFeedback: sendFeedback, listMyFeedback: listMyFeedback, adminListFeedback: adminListFeedback, adminUpdateFeedback: adminUpdateFeedback,
          pushConfig: pushConfig, savePushSubscription: savePushSubscription, deletePushSubscription: deletePushSubscription, pushPeek: pushPeek,
        },
      };
    },
  });

  // ---------- 顔写真(30秒プレゼンの画面・名簿で使う) ----------
  // 写真は小さな JPEG(data:image/jpeg;base64,…)。名簿の本体とは別の置き場所(env.blobs)に入れ、
  // 本体には「いつ変えたか」(photoRevs)だけを持つ。置き場所がないとき(お試し版の古い形)は本体に入れる。
  //   getPhotoRevs(写真のある人と更新日時)/ getPhotos(写真そのもの。最大40人)
  //   setMyPhoto(自分の写真)/ adminSetMemberPhoto(運営がほかの人の写真を入れる)。photo を空にすると消す
  var PHOTO_MAX = 48000; // 文字数(スプレッドシートの1セルに収まる大きさ)
  BtexServerCore.registerModule({
    create: function (c) {
      function blobGet(db, key) {
        if (c.blobs) return c.blobs.get(key) || "";
        return (db.photoBlobs && db.photoBlobs[key]) || "";
      }
      function blobSet(db, key, value) {
        if (c.blobs) { c.blobs.set(key, value); return; }
        if (!db.photoBlobs) db.photoBlobs = {};
        if (value) db.photoBlobs[key] = value; else delete db.photoBlobs[key];
      }
      function cleanPhoto(v) {
        var s = String(v || "");
        if (!s) return "";
        if (s.length > PHOTO_MAX || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s)) return null;
        return s;
      }
      function session(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        return a ? { db: db, a: a } : null;
      }
      function save(db, memberId, photo) {
        var p = cleanPhoto(photo);
        if (p === null) return c.fail("INVALID_REQUEST", "写真が大きすぎるか、形式が読めません。別の写真でお試しください。");
        blobSet(db, "photo:" + memberId, p);
        if (!db.photoRevs) db.photoRevs = {};
        if (p) db.photoRevs[memberId] = c.nowMs(); else delete db.photoRevs[memberId];
        c.saveDb(db);
        return c.ok({ memberId: memberId, rev: db.photoRevs[memberId] || 0 });
      }
      function getPhotoRevs(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        return c.ok({ revs: x.db.photoRevs || {} });
      }
      function getPhotos(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        var revs = x.db.photoRevs || {};
        var ids = (Array.isArray(body.ids) ? body.ids : []).map(function (v) { return c.cleanStr(v, 40); })
          .filter(function (id, i, a) { return id && revs[id] && a.indexOf(id) === i; }).slice(0, 40);
        var photos = {};
        ids.forEach(function (id) { var p = blobGet(x.db, "photo:" + id); if (p) photos[id] = { data: p, rev: revs[id] }; });
        return c.ok({ photos: photos });
      }
      function setMyPhoto(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        return save(x.db, x.a.user.memberId, body.photo);
      }
      function adminSetMemberPhoto(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        if (!x.a.isAdmin) return c.fail("FORBIDDEN_ADMIN");
        var id = c.cleanStr(body.memberId, 40);
        if (!c.find(x.db.referralMembers || [], function (m) { return m.id === id; })) return c.fail("NOT_FOUND");
        return save(x.db, id, body.photo);
      }
      return { actions: { getPhotoRevs: getPhotoRevs, getPhotos: getPhotos, setMyPhoto: setMyPhoto, adminSetMemberPhoto: adminSetMemberPhoto } };
    },
  });

  // ---------- 定例会のスライドの内容(日にち・スケジュール・規定・時間の目安など) ----------
  // 元の内容は referral/data.js の BTEX_DECK。ここには運営が書きかえたところだけを入れる。
  //   getDeckConfig(だれでも読める)/ saveDeckConfig(進行役だけ。config を空にすると元に戻す)
  var DECK_OWNERS = ["yamamoto", "m22", "m02", "m16", "m08", "m14", "m09", "m10", "m24", "m04"]; // 山本 捷真・小林 末季(こばねぇ)・あまみや 七音・桜羽 李果・床島 良夫・三村 隆・大場 雅俊・大枝 篤志・栁橋 雅也・吉澤 美和子
  var DECK_MAX = 60000; // 文字数
  BtexServerCore.registerModule({
    mutating: ["saveDeckConfig"],
    create: function (c) {
      function session(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        return a ? { db: db, a: a } : null;
      }
      function readCfg(db) {
        var raw = c.blobs ? c.blobs.get("deck:config") || "" : db.deckConfig || "";
        try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
      }
      function getDeckConfig(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        return c.ok({ config: readCfg(x.db), at: x.db.deckConfigAt || 0, canEdit: DECK_OWNERS.indexOf(x.a.user.memberId) !== -1 });
      }
      function saveDeckConfig(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        if (DECK_OWNERS.indexOf(x.a.user.memberId) === -1) return c.fail("FORBIDDEN_ADMIN");
        var cfg = body.config;
        var raw = "";
        if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
          try { raw = JSON.stringify(cfg); } catch (e) { return c.fail("INVALID_REQUEST"); }
          if (raw.length > DECK_MAX) return c.fail("INVALID_REQUEST", "内容が長すぎます。");
          if (raw === "{}") raw = "";
        } else if (cfg) return c.fail("INVALID_REQUEST");
        if (c.blobs) c.blobs.set("deck:config", raw);
        else if (raw) x.db.deckConfig = raw; else delete x.db.deckConfig;
        x.db.deckConfigAt = c.nowMs();
        c.saveDb(x.db);
        return c.ok({ config: raw ? JSON.parse(raw) : null, at: x.db.deckConfigAt });
      }
      function writeCfg(db, cfg) {
        var raw = cfg && Object.keys(cfg).length ? JSON.stringify(cfg) : "";
        if (c.blobs) c.blobs.set("deck:config", raw);
        else if (raw) db.deckConfig = raw; else delete db.deckConfig;
      }
      // 運営の依頼で決めた改行(2026年10月)。前に保存したスライドの内容に同じ文が残っていれば、同じように改行する
      var TEXT_BREAKS = [
        ["ビジターと1on1をする際は、その招待者を通す、または情報を共有すること\nメンバーと招待者はその責任において(アポの確認や規定の遵守など)ビジターをフォローまたは対応すること", "ビジターと1on1をする際は、その招待者を通す\nまたは情報を共有すること\nメンバーと招待者はその責任において\n(アポの確認や規定の遵守など)ビジターを\nフォローまたは対応すること"],
        ["一つひとつの関わりを大切に、信頼が積み重なる関係を育てていきます", "一つひとつの関わりを大切に\n信頼が積み重なる関係を育てていきます"],
        ["自分の仕事に誇りを持ち、プロとしての責任を大切に行動します", "自分の仕事に誇りを持ち\nプロとしての責任を大切に行動します"],
        ["公の場やチャットにおいても、メンバーやグループへの否定的な発言は控え\n互いを尊重するコミュニケーションを大切にします", "公の場やチャットにおいても\nメンバーやグループへの否定的な発言は控え\n互いを尊重するコミュニケーションを大切にします"],
        ["LINK や BT の中の BNI・守成クラブ・ニーズマッチの強みを取り入れた事業者コミュニティ", "LINK や BT の中の BNI・守成クラブ・\nニーズマッチの強みを取り入れた\n事業者コミュニティ"],
        ["ユニットごとに月2回ひらく会プレゼンや商談で紹介を生み出す", "ユニットごとに月2回ひらく会\nプレゼンや商談で紹介を生み出す"],
        ["20,000人の市場告知やセミナー、テストマーケができる", "20,000人の市場\n告知やセミナー、テストマーケができる"],
        ["ビジネススキル向上の仕組みと10,000人の人脈", "ビジネススキル向上の仕組みと\n10,000人の人脈"],
        ["メンバー同士が1対1でお互いの事業や紹介してほしい人を深く知るミーティング", "メンバー同士が1対1で\nお互いの事業や紹介してほしい人を\n深く知るミーティング"],
        ["紹介で仕事が決まったら紹介してくれた人へ成約金額を感謝として送る(1円＝1マイル)", "紹介で仕事が決まったら\n紹介してくれた人へ\n成約金額を感謝として送る(1円＝1マイル)"],
        ["見学で定例会に参加する方(同じ方の参加は2回まで)", "見学で定例会に参加する方\n(同じ方の参加は2回まで)"],
        ["定例会で画面に出る4桁のコードbt-ex.jp で入れると出席になる", "定例会で画面に出る4桁のコード\nbt-ex.jp で入れると出席になる"],
        ["BT-EXメンバーは、LINKの会員規約に準ずるものとする", "BT-EXメンバーは、LINKの会員規約に\n準ずるものとする"],
        ["メンバーにも、その先の大切なご縁にも、いつも誠実な気持ちで向き合います", "メンバーにも、その先の大切なご縁にも\nいつも誠実な気持ちで向き合います"],
      ];
      // 改行・読点・句点・空白の入れ方がちがうだけの同じ文も、指定の形にそろえる
      function flatText(t) { return String(t).replace(/[\s、。,]/g, ""); }
      function breakTexts(v) {
        if (typeof v === "string") { TEXT_BREAKS.forEach(function (p) { if (v !== p[1] && flatText(v) === flatText(p[1])) v = p[1]; }); return v; }
        if (Array.isArray(v)) return v.map(breakTexts);
        if (v && typeof v === "object") { Object.keys(v).forEach(function (k) { v[k] = breakTexts(v[k]); }); return v; }
        return v;
      }
      function migrate(db) {
        if (!db.cleanups) db.cleanups = [];
        var changed = false;
        // 運営が時間の目安を決め直したとき(2026年10月: 商談7分×4回・用語説明を足した)、前に保存した時間の目安を一度だけ外す
        if (db.cleanups.indexOf("deck-timeplan-3") === -1) {
          db.cleanups.push("deck-timeplan-3");
          var cfg = readCfg(db);
          if (cfg && "timeplan" in cfg) { delete cfg.timeplan; writeCfg(db, cfg); }
          changed = true;
        }
        if (db.cleanups.indexOf("deck-text-breaks-5") === -1) {
          db.cleanups.push("deck-text-breaks-5");
          var cfg2 = readCfg(db);
          if (cfg2) {
            breakTexts(cfg2);
            // 入会申し込みフォームの説明: 同じ文なら、改行・読点の入れ方にかかわらず2行にそろえる
            var jf = cfg2.joinForm;
            var JOIN_LEAD = "BT-EX5 への入会をご希望の方は\nこちらのフォームからお申し込みください";
            var flat = function (t) { return String(t || "").replace(/[\s、,]/g, ""); };
            if (jf && typeof jf.lead === "string" && flat(jf.lead) === flat(JOIN_LEAD)) jf.lead = JOIN_LEAD;
            writeCfg(db, cfg2);
          }
          changed = true;
        }
        // 入会の3ステップ(2026年10月): 順番を「LINKへの入会 → BT-EX5 入会 → ユニット選択」にし、Step1・2 の説明はカードの外の「入会希望の方はご紹介者の方へお聞きください」にまとめた。
        // 前に保存したステップが元のままなら、一度だけ外して新しい形にする(書きかえていたときはそのまま)
        if (db.cleanups.indexOf("deck-joinsteps-2") === -1) {
          db.cleanups.push("deck-joinsteps-2");
          var cfg3 = readCfg(db);
          var isOld = function (v) { return Array.isArray(v) && v.map(function (x) { return String((x && x.head) || "").replace(/\s/g, ""); }).join("|") === "LINKへの入会|ユニット選択|BT-EX5入会"; };
          // 保存の形は「joinSteps.steps」(編集画面)と「joinSteps: { steps }」の2通り
          if (cfg3 && isOld(cfg3["joinSteps.steps"])) { delete cfg3["joinSteps.steps"]; writeCfg(db, cfg3); }
          else if (cfg3 && cfg3.joinSteps && isOld(cfg3.joinSteps.steps)) { delete cfg3.joinSteps.steps; writeCfg(db, cfg3); }
          changed = true;
        }
        // アンケートの説明(2026年10月): 「本日の定例会の…」を「本日のBT-EX5の定例会の…」に。前に保存した説明が元の文のままなら書きかえる
        if (db.cleanups.indexOf("deck-survey-lead-1") === -1) {
          db.cleanups.push("deck-survey-lead-1");
          var cfg4 = readCfg(db);
          var OLD_LEAD = "本日の定例会の感想をお聞かせください", NEW_LEAD = "本日のBT-EX5の定例会の感想をお聞かせください";
          var fixLead = function (t) { return typeof t === "string" && t.indexOf(OLD_LEAD) === 0 ? NEW_LEAD + t.slice(OLD_LEAD.length) : t; };
          if (cfg4) {
            if (typeof cfg4["survey.lead"] === "string") cfg4["survey.lead"] = fixLead(cfg4["survey.lead"]);
            if (cfg4.survey && typeof cfg4.survey.lead === "string") cfg4.survey.lead = fixLead(cfg4.survey.lead);
            writeCfg(db, cfg4);
          }
          changed = true;
        }
        return changed;
      }
      return { migrate: migrate, actions: { getDeckConfig: getDeckConfig, saveDeckConfig: saveDeckConfig } };
    },
  });
  // ============================================
  // 定例会のアンケート(BT-EX メンバー向け・ビジター向け)
  //   submitSurvey(公開・ログイン不要)/ listSurveys・adminDeleteSurvey(プレゼンの進行役・管理者)
  //   同じ定例会の日・同じメールアドレス・同じ種類の回答は、あとの回答で上書きする
  // ============================================
  var SURVEY_SCORES = ["とても感じた", "感じた", "どちらともいえない", "あまり感じなかった", "感じなかった"];
  var SURVEY_INTEREST = ["ぜひ入会したい", "詳しく話を聞きたい", "今は考えていない"];
  var SURVEY_MAX = 3000; // 保存しておく回答の数
  var SURVEY_DAY_MAX = 600; // 1日に受け付ける回答の数(いたずら対策)
  BtexServerCore.registerModule({
    mutating: ["submitSurvey", "adminDeleteSurvey"],
    create: function (c) {
      function canRead(db, token) {
        var a = c.authSession(db, token);
        if (!a) return c.fail("SESSION_INVALID");
        if (!a.isAdmin && DECK_OWNERS.indexOf(a.user.memberId) === -1) return c.fail("FORBIDDEN_ADMIN");
        return null;
      }
      function submitSurvey(body) {
        var db = c.ensureDb();
        if (!Array.isArray(db.surveys)) db.surveys = [];
        if (c.cleanStr(body.website, 10)) return c.ok({}); // 見えない欄に入っているのは機械の送信
        var kind = body.kind === "visitor" ? "visitor" : "member";
        var day = new Date(c.nowMs() + 9 * 3600000).toISOString().slice(0, 10);
        if (!db.surveyGuard || db.surveyGuard.day !== day) db.surveyGuard = { day: day, count: 0 };
        if (db.surveyGuard.count >= SURVEY_DAY_MAX) return c.fail("INVALID_REQUEST", "ただいま回答を受け付けられません。時間をおいてお試しください。");
        var date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? String(body.date) : "";
        var last = c.cleanStr(body.last, 30), first = c.cleanStr(body.first, 30);
        var email = c.cleanStr(body.email, 120);
        var score = SURVEY_SCORES.indexOf(String(body.score || ""));
        var reason = c.cleanStr(body.reason, 800), comment = c.cleanStr(body.comment, 1200);
        var program = c.cleanStr(body.program, 80);
        if (!date || !last || !first || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || score < 0 || !program || !reason || !comment) {
          return c.fail("INVALID_REQUEST", "必須の項目を入れてください。");
        }
        var r = {
          kind: kind, eventId: c.cleanStr(body.eventId, 40), date: date, last: last, first: first, email: email,
          score: score, program: program, reason: reason, comment: comment,
        };
        if (kind === "member") {
          r.unit = c.cleanStr(body.unit, 12); r.lineage = c.cleanStr(body.lineage, 60); r.job = c.cleanStr(body.job, 80);
          r.upcre = c.cleanStr(body.upcre, 40); r.adopt = c.cleanStr(body.adopt, 800);
          if (!r.unit || !r.lineage || !r.job || !r.upcre) return c.fail("INVALID_REQUEST", "必須の項目を入れてください。");
        } else {
          r.job = c.cleanStr(body.job, 80); r.inviter = c.cleanStr(body.inviter, 40); r.link = ["yes", "no"].indexOf(body.link) !== -1 ? body.link : "";
          r.interest = SURVEY_INTEREST.indexOf(String(body.interest || "")) !== -1 ? String(body.interest) : "";
          if (!r.job || !r.inviter || !r.interest) return c.fail("INVALID_REQUEST", "必須の項目を入れてください。");
        }
        var same = c.find(db.surveys, function (x) { return x.kind === kind && x.date === date && x.email.toLowerCase() === email.toLowerCase(); });
        if (same) { Object.assign(same, r, { updatedAt: c.nowMs() }); }
        else {
          r.id = "sv_" + c.randomHex(6); r.at = c.nowMs();
          db.surveys.push(r);
          if (db.surveys.length > SURVEY_MAX) db.surveys.splice(0, db.surveys.length - SURVEY_MAX);
        }
        db.surveyGuard.count += 1;
        c.saveDb(db);
        return c.ok({ updated: !!same });
      }
      function listSurveys(body) {
        var db = c.ensureDb();
        var e = canRead(db, body.sessionToken);
        if (e) return e;
        var list = (db.surveys || []).slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
        return c.ok({ items: list, scores: SURVEY_SCORES, interests: SURVEY_INTEREST });
      }
      function adminDeleteSurvey(body) {
        var db = c.ensureDb();
        var e = canRead(db, body.sessionToken);
        if (e) return e;
        var before = (db.surveys || []).length;
        db.surveys = (db.surveys || []).filter(function (x) { return x.id !== body.id; });
        if (db.surveys.length === before) return c.fail("NOT_FOUND");
        c.saveDb(db);
        return c.ok({});
      }
      return { actions: { submitSurvey: submitSurvey, listSurveys: listSurveys, adminDeleteSurvey: adminDeleteSurvey } };
    },
  });
  // ============================================
  // エデュケーションコーナーの資料(毎回入れかえる)
  //   getEducation(ログインした人)/ getEduPage(1枚ずつ)/ saveEducation(プレゼンの進行役。pages を空にすると元の資料に戻す)
  //   1枚の画像は、スプレッドシートの1セルに収まる大きさに分けて置く
  // ============================================
  var EDU_PAGES_MAX = 40, EDU_PAGE_MAX = 600000, EDU_CHUNK = 45000;
  BtexServerCore.registerModule({
    mutating: ["saveEducation"],
    create: function (c) {
      function bget(db, k) { return c.blobs ? c.blobs.get(k) || "" : ((db.eduBlobs || {})[k] || ""); }
      function bset(db, k, v) {
        if (c.blobs) { c.blobs.set(k, v); return; }
        if (!db.eduBlobs) db.eduBlobs = {};
        if (v) db.eduBlobs[k] = v; else delete db.eduBlobs[k];
      }
      function session(body) { var db = c.ensureDb(); var a = c.authSession(db, body.sessionToken); return a ? { db: db, a: a } : null; }
      function info(db) { var e = db.education || null; return e && e.pages ? { title: e.title || "", pages: e.pages.length, rev: e.rev || 0 } : null; }
      function getEducation(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        return c.ok({ education: info(x.db), canEdit: DECK_OWNERS.indexOf(x.a.user.memberId) !== -1 });
      }
      function getEduPage(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        var e = x.db.education, i = Number(body.i);
        if (!e || !e.pages || !(i >= 0 && i < e.pages.length)) return c.fail("NOT_FOUND");
        var data = "";
        for (var k = 0; k < e.pages[i]; k++) data += bget(x.db, "edu:" + e.rev + ":" + i + ":" + k);
        return c.ok({ data: data, rev: e.rev });
      }
      function saveEducation(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        if (DECK_OWNERS.indexOf(x.a.user.memberId) === -1) return c.fail("FORBIDDEN_ADMIN");
        var db = x.db, old = db.education;
        // 題だけを変える
        if (body.titleOnly) {
          if (!old) return c.fail("INVALID_REQUEST", "先に資料を入れてください。");
          old.title = c.cleanStr(body.title, 60) || old.title; c.saveDb(db);
          return c.ok({ education: info(db) });
        }
        var pages = Array.isArray(body.pages) ? body.pages : [];
        if (pages.length > EDU_PAGES_MAX) return c.fail("INVALID_REQUEST", "資料は" + EDU_PAGES_MAX + "枚までです。");
        for (var j = 0; j < pages.length; j++) {
          var s = String(pages[j] || "");
          if (s.length > EDU_PAGE_MAX || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s)) return c.fail("INVALID_REQUEST", (j + 1) + "枚目の画像が大きすぎるか、形式が読めません。");
        }
        // 前の資料を消す
        if (old && old.pages) old.pages.forEach(function (n, i) { for (var k = 0; k < n; k++) bset(db, "edu:" + old.rev + ":" + i + ":" + k, ""); });
        if (!pages.length) { delete db.education; c.saveDb(db); return c.ok({ education: null }); }
        var rev = c.nowMs(), counts = [];
        pages.forEach(function (s, i) {
          var n = Math.ceil(s.length / EDU_CHUNK);
          for (var k = 0; k < n; k++) bset(db, "edu:" + rev + ":" + i + ":" + k, s.slice(k * EDU_CHUNK, (k + 1) * EDU_CHUNK));
          counts.push(n);
        });
        db.education = { title: c.cleanStr(body.title, 60) || "エデュケーションコーナー", pages: counts, rev: rev, by: x.a.user.memberId };
        c.saveDb(db);
        return c.ok({ education: info(db) });
      }
      return { actions: { getEducation: getEducation, getEduPage: getEduPage, saveEducation: saveEducation } };
    },
  });
  // ============================================
  // 運営会議(プレゼンを任された運営メンバーだけ)
  //   listOpsMeetings / saveOpsMeeting / deleteOpsMeeting / saveOpsNotes / fetchOpsNotes
  //   会議を作ると Google Meet を自動で作り(カレンダー連携のとき)、運営メンバーを招待する。
  //   会議のあと、Google Meet の「Gemini によるメモ」・文字起こしを読みこんで議事録にする(共有サーバーのとき)。
  //   読みこめないときは、メモを貼り付けて残せる
  // ============================================
  var OPS_MAX = 300, OPS_NOTE_MAX = 40000;
  BtexServerCore.registerModule({
    mutating: ["saveOpsMeeting", "deleteOpsMeeting", "saveOpsNotes", "fetchOpsNotes"],
    create: function (c) {
      function ops(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        if (!a) return { error: c.fail("SESSION_INVALID") };
        if (DECK_OWNERS.indexOf(a.user.memberId) === -1 && !a.isAdmin) return { error: c.fail("FORBIDDEN_ADMIN") };
        if (!Array.isArray(db.opsMeetings)) db.opsMeetings = [];
        return { db: db, a: a, id: a.user.memberId };
      }
      function nameOf(db, id) { var m = c.find(db.referralMembers || [], function (x) { return x.id === id; }); return m ? m.name : ""; }
      function view(db, m) {
        return { id: m.id, title: m.title, date: m.date, start: m.start, end: m.end, agenda: m.agenda || "", meetUrl: m.meetUrl || "", link: m.link || "",
          notes: (m.notes || []).map(function (n) { return { id: n.id, source: n.source, title: n.title || "", text: n.text || "", url: n.url || "", at: n.at, byName: n.by ? nameOf(db, n.by) : "" }; }),
          byName: nameOf(db, m.by), at: m.at };
      }
      function cleanDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : ""; }
      function cleanTime(v) { return /^\d{2}:\d{2}$/.test(String(v || "")) ? String(v) : ""; }
      function listOpsMeetings(body) {
        var x = ops(body); if (x.error) return x.error;
        var list = x.db.opsMeetings.slice().sort(function (p, q) { return (q.date + q.start).localeCompare(p.date + p.start); });
        return c.ok({ items: list.map(function (m) { return view(x.db, m); }), calendar: !!c.calendar, autoNotes: !!(c.meet && c.meet.notes) });
      }
      function saveOpsMeeting(body) {
        var x = ops(body); if (x.error) return x.error;
        var input = body.meeting || {};
        var date = cleanDate(input.date), start = cleanTime(input.start), end = cleanTime(input.end) || start;
        var title = c.cleanStr(input.title, 80) || "運営会議";
        if (!date || !start) return c.fail("INVALID_REQUEST", "日付と開始の時刻を入れてください。");
        var m = input.id ? c.find(x.db.opsMeetings, function (y) { return y.id === input.id; }) : null;
        if (input.id && !m) return c.fail("NOT_FOUND");
        if (!m) { m = { id: "op_" + c.randomHex(6), by: x.id, at: c.nowMs(), notes: [] }; x.db.opsMeetings.push(m); if (x.db.opsMeetings.length > OPS_MAX) x.db.opsMeetings.shift(); }
        m.title = title; m.date = date; m.start = start; m.end = end;
        m.agenda = c.cleanStr(input.agenda, 2000);
        if (!c.calendar) m.meetUrl = /^https:\/\/meet\.google\.com\/[a-z0-9-]+/i.test(String(input.meetUrl || "")) ? c.cleanStr(input.meetUrl, 200) : (m.meetUrl || "");
        if (c.calendar) {
          // 運営メンバーのうち、カレンダー用のメールを入れている人を招待する
          var guests = (x.db.users || []).filter(function (u) { return DECK_OWNERS.indexOf(u.memberId) !== -1 && u.calendarEmail; }).map(function (u) { return u.calendarEmail; });
          try {
            var r = c.calendar.upsert({ id: m.calId, title: "【BT-EX5 運営会議】" + title, date: date, start: start, end: end, meet: true, description: m.agenda, guests: guests });
            m.calId = r.id; m.meetUrl = r.meetUrl || m.meetUrl || ""; m.link = r.link || "";
          } catch (err) { /* カレンダーに入れられなくても、会議は保存する */ }
        }
        c.saveDb(x.db);
        return c.ok({ meeting: view(x.db, m) });
      }
      function deleteOpsMeeting(body) {
        var x = ops(body); if (x.error) return x.error;
        var m = c.find(x.db.opsMeetings, function (y) { return y.id === body.id; });
        if (!m) return c.fail("NOT_FOUND");
        if (m.calId && c.calendar) { try { c.calendar.remove(m.calId); } catch (err) { /* noop */ } }
        x.db.opsMeetings = x.db.opsMeetings.filter(function (y) { return y.id !== m.id; });
        c.saveDb(x.db);
        return c.ok({});
      }
      // 議事録を貼り付けて残す(Gemini のメモ・自分のメモ)。noteId があれば直す、text を空にすると消す
      function saveOpsNotes(body) {
        var x = ops(body); if (x.error) return x.error;
        var m = c.find(x.db.opsMeetings, function (y) { return y.id === body.id; });
        if (!m) return c.fail("NOT_FOUND");
        if (!m.notes) m.notes = [];
        var text = c.cleanStr(String(body.text || "").replace(/\r\n?/g, "\n"), OPS_NOTE_MAX);
        var url = /^https:\/\/[^\s"'<>]+$/.test(String(body.url || "")) ? c.cleanStr(body.url, 500) : "";
        var n = body.noteId ? c.find(m.notes, function (y) { return y.id === body.noteId; }) : null;
        if (n && !text && !url) { m.notes = m.notes.filter(function (y) { return y.id !== n.id; }); c.saveDb(x.db); return c.ok({ meeting: view(x.db, m) }); }
        if (!text && !url) return c.fail("INVALID_REQUEST", "議事録の内容か、リンクを入れてください。");
        if (!n) { n = { id: "nt_" + c.randomHex(5), source: "manual" }; m.notes.push(n); }
        n.title = c.cleanStr(body.title, 80) || "議事録"; n.text = text; n.url = url; n.by = x.id; n.at = c.nowMs();
        c.saveDb(x.db);
        return c.ok({ meeting: view(x.db, m) });
      }
      // Google Meet の「Gemini によるメモ」・文字起こしを読みこむ(共有サーバーで Meet・ドキュメントが使えるとき)
      function pullNotes(db, m) {
        if (!c.meet || !c.meet.notes || (!m.calId && !m.meetUrl)) return 0;
        var got = c.meet.notes({ calId: m.calId || "", meetUrl: m.meetUrl || "" }) || [];
        var added = 0;
        if (!m.notes) m.notes = [];
        got.forEach(function (g) {
          if (!g || !g.text) return;
          var key = String(g.url || g.title);
          var cur = c.find(m.notes, function (y) { return y.source !== "manual" && (y.url || y.title) === key; });
          if (cur) { cur.text = c.cleanStr(g.text, OPS_NOTE_MAX); cur.at = c.nowMs(); return; }
          m.notes.push({ id: "nt_" + c.randomHex(5), source: g.kind === "transcript" ? "transcript" : "gemini", title: c.cleanStr(g.title, 120), text: c.cleanStr(g.text, OPS_NOTE_MAX), url: c.cleanStr(g.url, 500), at: c.nowMs() });
          added++;
        });
        m.notesCheckedAt = c.nowMs();
        return added;
      }
      function fetchOpsNotes(body) {
        var x = ops(body); if (x.error) return x.error;
        var m = c.find(x.db.opsMeetings, function (y) { return y.id === body.id; });
        if (!m) return c.fail("NOT_FOUND");
        if (!c.meet || !c.meet.notes) return c.fail("INVALID_REQUEST", "共有サーバーで Google Meet と連携すると、会議のあとに議事録を自動で読みこめます。いまはメモを貼り付けてください。");
        var added = 0;
        try { added = pullNotes(x.db, m); } catch (err) { return c.fail("INVALID_REQUEST", "議事録を読みこめませんでした。会議の主催者の Google アカウントで、Gemini のメモがオンになっていたか確かめてください。"); }
        c.saveDb(x.db);
        return c.ok({ meeting: view(x.db, m), added: added });
      }
      // 1時間ごと: 終わってから3日以内の会議で、まだ議事録のないものを読みこむ
      function jobOpsNotes() {
        var db = c.ensureDb();
        if (!c.meet || !c.meet.notes || !Array.isArray(db.opsMeetings)) return 0;
        var now = c.nowMs(), n = 0;
        db.opsMeetings.forEach(function (m) {
          var endMs = Date.parse(m.date + "T" + (m.end || m.start || "23:59") + ":00+09:00");
          if (!(endMs < now && now - endMs < 3 * 86400000)) return;
          if ((m.notes || []).some(function (y) { return y.source === "gemini"; })) return;
          if (m.notesCheckedAt && now - m.notesCheckedAt < 50 * 60000) return;
          try { n += pullNotes(db, m); } catch (err) { m.notesCheckedAt = now; }
        });
        c.saveDb(db);
        return n;
      }
      return {
        actions: { listOpsMeetings: listOpsMeetings, saveOpsMeeting: saveOpsMeeting, deleteOpsMeeting: deleteOpsMeeting, saveOpsNotes: saveOpsNotes, fetchOpsNotes: fetchOpsNotes },
        jobs: { syncMeet: jobOpsNotes },
      };
    },
  });
})();
