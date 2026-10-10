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
  var ANNOUNCE_CATS = ["お知らせ", "定例会", "重要", "その他"];
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
      "reportThanks", "deleteThanks", "save1on1", "delete1on1", "confirm1on1",
    ],
    // 書き込みのあとに、通知(プッシュ)を送るか確かめる操作(mutating に加えて)
    notifying: ["createPost", "commentPost", "adminSaveAnnouncement"],
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
        var s = c.cleanStr(v, 5);
        return /^\d{1,2}:\d{2}$/.test(s) ? s : "";
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
      function member(db, id) { return c.find(db.referralMembers || [], function (m) { return m.id === id; }); }
      function nameOf(db, id) { var m = member(db, id); return m ? m.name : "(退会したメンバー)"; }
      function memberIdOfUser(db, userId) {
        var u = c.find(db.users, function (x) { return x.userId === userId; });
        return u ? u.memberId : "";
      }
      function trim(list, max) { if (list.length > max) list.splice(0, list.length - max); }

      function migrate(db) {
        var changed = false;
        ["events", "visitors", "thanks", "oneOnOnes", "announcements", "posts", "threads", "feedback", "pushSubs"].forEach(function (k) {
          if (!Array.isArray(db[k])) { db[k] = []; changed = true; }
        });
        if (!db.seen || typeof db.seen !== "object") { db.seen = {}; changed = true; }
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
              body: se.body || "", agenda: se.agenda || "", fee: se.fee || "", capacity: 0, url: "", deadline: se.deadline || "",
              meet: se.meet !== false, party: { enabled: false }, rsvps: {}, attended: [], createdAt: c.nowMs(), seed: true,
            };
            syncEventCalendar(db, ev); // 共有サーバーでカレンダーが使えれば、Meet もここで作る
            db.events.push(ev);
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
          id: e.id, title: e.title, date: e.date, start: e.start, end: e.end, place: e.place, area: e.area,
          body: e.body, agenda: e.agenda || "", fee: e.fee, capacity: e.capacity || 0, url: e.url || "",
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
        return c.ok({ event: eventView(w, e), members: members, visitors: visitors, isAdmin: w.isAdmin });
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
        var w = admin(body);
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
        var w = admin(body);
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
        };
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
        if (amount < 0 || amount > 1000000000) return c.fail("INVALID_REQUEST");
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
      function getStats(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var from = cleanDate(body.from), to = cleanDate(body.to);
        if (!from || !to) { from = today().slice(0, 8) + "01"; to = lastDay(today().slice(0, 7)); }
        if (from > to) { var tmp = from; from = to; to = tmp; }
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
        var list = Object.keys(rows).map(function (k) { return rows[k]; });
        return c.ok({
          from: from, to: to, today: today(),
          me: rows[w.id] || null,
          members: list.map(function (r) {
            return { id: r.id, name: r.name, isMe: r.id === w.id, attended: r.attended, referrals: r.referrals, miles: r.milesGiven, oneOnOnes: r.oneOnOnes, visitors: r.visitors };
          }),
          total: total,
        });
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
          id: o.id, with: other, withName: nameOf(db, other), date: o.date, time: o.time || "", end: endTime(o), endDate: endDate(o), duration: o.duration || 60,
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
          if (!member(db, other) || other === w.id) return c.fail("INVALID_REQUEST", "相手を選んでください。");
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
      function getMySettings(body) {
        var w = who(body);
        if (w.error) return w.error;
        return c.ok({ calendarEmail: w.user.calendarEmail || "", calendar: !!c.calendar, meetName: w.user.meetName || "", name: w.me.name });
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
        c.saveDb(w.db);
        return c.ok({ calendarEmail: w.user.calendarEmail || "", meetName: w.user.meetName || "" });
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
          canDelete: p.by === w.id || w.isAdmin,
          comments: (p.comments || []).map(function (cm) {
            return { id: cm.id, by: cm.by, byName: nameOf(w.db, cm.by), body: cm.body, at: cm.at, canDelete: cm.by === w.id || w.isAdmin };
          }),
        };
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
        return c.ok({ month: month, prevMonth: prev, totals: totals(month), prevTotals: totals(prev), events: monthEvents, members: members, now: c.nowMs() });
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
      function activityItems(db, me) {
        var items = [];
        db.referralLogs.forEach(function (l) {
          var giver = memberIdOfUser(db, l.fromUserId);
          if (l.toMemberId === me && giver !== me) {
            items.push({ type: "refIn", at: l.at, who: giver, whoName: nameOf(db, giver), text: l.prospect || "", link: "log/ref" });
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
          (p.comments || []).forEach(function (cm) {
            if (cm.by === me) return;
            var mine = p.by === me;
            var joined = !mine && (p.comments || []).some(function (x) { return x.by === me && x.at < cm.at; });
            if (mine || joined) items.push({ type: mine ? "comment" : "reply", at: cm.at, who: cm.by, whoName: nameOf(db, cm.by), text: cm.body.slice(0, 60), link: "board" });
          });
        });
        db.oneOnOnes.forEach(function (o) {
          if ((o.a === me || o.b === me) && o.by !== me) items.push({ type: "oneNew", at: o.at, who: o.by, whoName: nameOf(db, o.by), date: o.date, link: "log/1on1" });
          // 時刻を過ぎた 1on1: 実施したかの確認
          if ((o.a === me || o.b === me) && awaitingConfirm(o)) {
            var other = o.a === me ? o.b : o.a;
            items.push({ type: "oneAsk", at: oneEndMs(o), who: other, whoName: nameOf(db, other), date: o.date, link: "log/1on1?confirm=" + o.id });
          }
        });
        db.visitors.forEach(function (v) {
          if (v.by === me && v.appliedAt) items.push({ type: "visitor", at: v.appliedAt, text: v.name, link: "events" });
        });
        db.announcements.forEach(function (a) {
          items.push({ type: "ann", at: a.at, text: a.title, link: "news?open=" + a.id });
        });
        db.events.forEach(function (e) {
          if (e.createdAt && e.date >= today()) items.push({ type: "event", at: e.createdAt, text: e.title, date: e.date, link: "events" });
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
          if (l.status === "new" && c.nowMs() - l.at > 3 * DAY) {
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
        // 時刻を過ぎて自動で「実施」になった 1on1(1週間以内・自分のメモがまだ)
        ones.forEach(function (o) {
          if (!(o.autoDone || o.confirmedBy) || (o.notes || {})[w.id] || c.nowMs() - (o.doneAt || 0) > 7 * DAY) return;
          var other = o.a === w.id ? o.b : o.a;
          followUps.push({ type: "oneMemo", id: o.id, with: other, withName: nameOf(db, other), date: o.date });
        });
        return c.ok({
          me: { id: w.id, name: w.me.name, team: w.me.team || "", isAdmin: w.isAdmin, hasPassword: !!w.user.pw },
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
            givenAll: myLogs.length,
            milesInAll: db.thanks.filter(function (x) { return x.to === w.id; }).reduce(function (s, x) { return s + x.amount; }, 0),
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
            return { rank: me.rank, size: ms.length, points: me.points, gap: me.gap, gapName: me.gapName };
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
      function latestActivityAt(db, memberId) {
        var items = activityItems(db, memberId);
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
          case "oneAsk": return { title: "☕ " + n + "との1on1 は実施しましたか?", body: "「実施した」を押すと 1on1 の回数に数えます" };
          case "visitor": return { title: "🙋 ビジターの申込がありました", body: x.text + " さん" };
          case "ann": return { title: "📣 運営からのお知らせ", body: x.text };
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
        var fresh = activityItems(db, row.memberId).filter(function (x) { return x.at > lastSeen; });
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
        jobs: { syncMeet: jobSyncMeet, takePushOutbox: jobTakePushOutbox, dropPushSubs: jobDropPushSubs },
        actions: {
          getHome: getHome, getActivity: getActivity, adminDashboard: adminDashboard, adminExport: adminExport,
          listEvents: listEvents, getEvent: getEvent, rsvpEvent: rsvpEvent, checkIn: checkIn,
          adminSaveEvent: adminSaveEvent, adminDeleteEvent: adminDeleteEvent, adminOpenCheckIn: adminOpenCheckIn,
          adminEventDetail: adminEventDetail, adminMarkAttendance: adminMarkAttendance,
          adminSyncMeetAttendance: adminSyncMeetAttendance, adminMapMeetName: adminMapMeetName,
          createVisitorInvite: createVisitorInvite, listMyVisitors: listMyVisitors, updateVisitor: updateVisitor,
          visitorInfo: visitorInfo, visitorApply: visitorApply,
          listMyReferrals: listMyReferrals, reportThanks: reportThanks, deleteThanks: deleteThanks, getRankings: getRankings, getTeamRanking: getTeamRanking, getStats: getStats, adminSetTeamGoals: adminSetTeamGoals,
          list1on1: list1on1, save1on1: save1on1, delete1on1: delete1on1, confirm1on1: confirm1on1,
          getMySettings: getMySettings, updateMySettings: updateMySettings,
          listAnnouncements: listAnnouncements, markAnnouncementsRead: markAnnouncementsRead,
          adminSaveAnnouncement: adminSaveAnnouncement, adminDeleteAnnouncement: adminDeleteAnnouncement,
          listBoard: listBoard, createPost: createPost, deletePost: deletePost, commentPost: commentPost,
          deleteComment: deleteComment, likePost: likePost,
          sendFeedback: sendFeedback, listMyFeedback: listMyFeedback, adminListFeedback: adminListFeedback, adminUpdateFeedback: adminUpdateFeedback,
          pushConfig: pushConfig, savePushSubscription: savePushSubscription, deletePushSubscription: deletePushSubscription, pushPeek: pushPeek,
        },
      };
    },
  });
})();
