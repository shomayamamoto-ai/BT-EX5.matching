// ============================================
// auth/server-core.js — サーバー側判定の本体(実行環境に依存しない)
// 仕様: docs/specs/login-page-detailed-spec-v3.md §5, §8
//
// 同じコードを2か所で動かす。
//   ・ブラウザ内のデモ(auth/mock-server.js が localStorage に保存)
//   ・共有サーバー(gas/ の Google Apps Script がスプレッドシートに保存)
// そのため同期処理だけで書き、ブラウザ固有の API(crypto.subtle・btoa など)は
// 使わない。保存先と乱数は createServer({ load, save, randomBytes }) で受け取る。
//
// 認証は2通り。
//   ・会員ごとのアカウント(本番): 運営者が発行した招待コードで本人がパスワードを決め、
//     以後は「お名前 + パスワード」で入る。5回まちがえると15分ロック(本人ごと)。
//   ・共通パスコード(移行期間用): パスコードが正しければ名簿から自分の名前を選ぶ。
//     会員用パスコードは管理者が設定で止められる。管理者用パスコードは非常用に常に使える。
// 管理者は、管理者用パスコードで入ったセッションか、管理者に指定された会員のアカウント。
// 失敗理由は AUTH_FAILED / LOCKED、verifySession の失敗は SESSION_INVALID 単一コード(§5.4 / §5.5)。
//
// 機能の追加: BtexServerCore.registerModule(...) で操作(action)のまとまりを足せる
// (auth/server-community.js が定例会・掲示板などを足す)。createServer より前に登録する。
//
// 紹介先早見表: 名簿の閲覧は会員、追加・編集・削除は管理者のみ。
// 会員は自分のプロフィール(名前・所属チーム以外)だけを編集できる。
// 紹介の記録は会員が自分の名義でのみ追加・取り消しでき、紹介を受けた本人だけが
// 対応状況(未対応・連絡済み・成約・見送り)を更新できる。
// ============================================

var BtexServerCore = (function () {
  "use strict";

  // 設定値(§8)。この4値は仕様で固定
  var LOGIN_FAILURE_LIMIT = 5;
  var LOCK_DURATION_MINUTES = 15;
  var SESSION_TTL_HOURS = 12;
  var SESSION_REMEMBER_DAYS = 30;

  // パスコードは平文を置かず、ソルト付き SHA-256 のハッシュだけを持つ。
  // 照合前に小文字化し、ハイフンと空白を取り除く
  var PASSCODES = {
    member: { salt: "0fdad7ca2a02b6424d2fda1d85d36c3a", hash: "c2bd4fe026b60aed343fe5d9547119167f92dcec1a5fb8a7df44f41c65f79595" },
    admin: { salt: "208b4fd8211062d5ced31e63c9e4626e", hash: "9e47ede3415ac83b0fc215d0780ecabd8cb9a7da124aa19c5facd44d23c9438a" },
  };

  // サーバー由来エラー文言(§9: Response.gs ERRORS 相当)
  var ERRORS = {
    AUTH_FAILED: "パスコードが正しくありません。",
    LOCKED: "ログインを一時的に制限しています。時間をおいて再度お試しください。",
    SESSION_INVALID: "セッションが無効です。もう一度ログインしてください。",
    INVALID_REQUEST: "リクエストの形式が正しくありません。",
    INVALID_ACTION: "不明な操作が指定されました。",
    FORBIDDEN_ADMIN: "この操作は管理者のみ行えます。",
    SELF_REFERRAL: "ご自身への紹介は記録できません。",
    ACCOUNT_FAILED: "お名前またはパスワードが正しくありません。",
    INVITE_INVALID: "招待コードが正しくないか、期限が切れています。運営者に新しいコードをお願いしてください。",
    PASSWORD_WEAK: "パスワードは8文字以上で、お名前とは違うものにしてください。",
    PASSCODE_DISABLED: "共通パスコードでのログインは終了しました。お名前とパスワードでログインしてください。",
    NOT_FOUND: "対象が見つかりませんでした。画面を読み込み直してください。",
    CHECKIN_FAILED: "出席コードが正しくないか、受付時間外です。",
    SERVER_ERROR: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
  };

  // 紹介の対応状況(紹介を受けた本人が更新する)
  // new 未対応 / contacted 連絡済み / meeting 商談中 / won 成約 / lost 見送り
  var REFERRAL_STATUSES = ["new", "contacted", "meeting", "won", "lost"];

  // 会員アカウント
  var INVITE_DAYS = 14;
  var PASSWORD_ITERATIONS = 1500;
  var INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 見まちがえやすい I・O・0・1 は使わない

  // 本人が編集できる項目(名前・所属チーム・ID は管理者のみ)
  var SELF_EDITABLE = [
    "company", "base", "category", "business", "customers", "offer", "selfIntro", "note", "wants", "triggers",
    "face", "faceAreas", "online", "topics", "targets", "prospects", "links",
    "strengths", "pitch", "ng", "goals", "personal",
  ];

  // 追加の機能(registerModule で登録)
  var MODULES = [];
  function registerModule(mod) { MODULES.push(mod); }

  // お名前の照合用: 全角・半角、空白、大文字小文字の違いをそろえる
  function normalizeName(v) {
    var s = String(v || "");
    if (s.normalize) s = s.normalize("NFKC");
    return s.replace(/[\s\u3000・]/g, "").toLowerCase();
  }

  // ---------- SHA-256(UTF-8 文字列 → 16進) ----------
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  function utf8Bytes(text) {
    var s = unescape(encodeURIComponent(String(text)));
    var out = new Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function sha256Hex(text) {
    var bytes = utf8Bytes(text);
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    bytes.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    for (var off = 0; off < bytes.length; off += 64) {
      for (var t = 0; t < 16; t++) {
        var j = off + t * 4;
        w[t] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) | 0;
      }
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (k + S1 + ch + K[t] + w[t]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + k) | 0;
    }
    return h.map(function (v) { return ("00000000" + (v >>> 0).toString(16)).slice(-8); }).join("");
  }

  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function base64url(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
      if (i + 1 < bytes.length) out += B64[(n >>> 6) & 63];
      if (i + 2 < bytes.length) out += B64[n & 63];
    }
    return out;
  }

  function hashPassword(salt, password, iterations) {
    var h = String(password);
    for (var i = 0; i < iterations; i++) h = sha256Hex(salt + ":" + h);
    return h;
  }

  // データ定義(referral/data.js)は読み込まれていない環境もあるため typeof で参照する
  function dataList(name) {
    var lists = {
      TOPICS: typeof TOPICS === "undefined" ? null : TOPICS,
      INDUSTRIES: typeof INDUSTRIES === "undefined" ? null : INDUSTRIES,
      PROSPECTS: typeof PROSPECTS === "undefined" ? null : PROSPECTS,
      REF_CATEGORIES: typeof REF_CATEGORIES === "undefined" ? null : REF_CATEGORIES,
      REF_BASES: typeof REF_BASES === "undefined" ? null : REF_BASES,
      REF_SEED_MEMBERS: typeof REF_SEED_MEMBERS === "undefined" ? null : REF_SEED_MEMBERS,
      REF_SEED_REVISIONS: typeof REF_SEED_REVISIONS === "undefined" ? null : REF_SEED_REVISIONS,
      LINK_TYPES: typeof LINK_TYPES === "undefined" ? null : LINK_TYPES,
      REF_LEGACY_CATEGORIES: typeof REF_LEGACY_CATEGORIES === "undefined" ? null : REF_LEGACY_CATEGORIES,
      REF_CATEGORY_TOPICS: typeof REF_CATEGORY_TOPICS === "undefined" ? null : REF_CATEGORY_TOPICS,
    };
    return lists[name];
  }
  function idsOf(name) {
    var list = dataList(name);
    return list ? list.map(function (x) { return x.id; }) : null;
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function createServer(env) {
    var nowMs = env.now || function () { return Date.now(); };

    function randomHex(n) {
      return env.randomBytes(n).map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    }
    function randomToken() { return base64url(env.randomBytes(32)); } // base64url 43文字(§5.3)

    function saveDb(db) { env.save(db); }

    function ensureDb() {
      var db = env.load();
      var migrated = false;
      if (!db || !db.users) {
        db = { users: [], sessions: {}, referralLogs: [], passcodeGuard: { failures: 0, lockedUntil: 0 } };
        migrated = true;
      }
      // 旧バージョンからの移行: マッチング機能のデータ、メールアドレスで作った
      // アカウントとそのセッションを削除する(パスコード方式に一本化)
      ["likes", "messages", "botsSeeded", "dummy"].forEach(function (k) {
        if (k in db) { delete db[k]; migrated = true; }
      });
      if (!db.sessions) { db.sessions = {}; migrated = true; }
      if (db.users.some(function (u) { return !u.memberId; })) {
        db.users = db.users.filter(function (u) { return u.memberId; });
        migrated = true;
      }
      // 期限切れ・ログアウト済み・持ち主のいないセッションを片付ける(保存量を抑える)
      Object.keys(db.sessions).forEach(function (t) {
        var s = db.sessions[t];
        var owner = db.users.some(function (u) { return u.userId === s.userId; });
        if (!owner || s.revoked || s.expiresAt <= nowMs()) { delete db.sessions[t]; migrated = true; }
      });
      if (!db.referralLogs) { db.referralLogs = []; migrated = true; }
      if (!db.passcodeGuard) { db.passcodeGuard = { failures: 0, lockedUntil: 0 }; migrated = true; }
      if (!db.inviteGuard) { db.inviteGuard = { failures: 0, lockedUntil: 0 }; migrated = true; }
      if (!db.settings) { db.settings = { memberPasscode: true, admins: [] }; migrated = true; }
      if (!Array.isArray(db.settings.admins)) { db.settings.admins = []; migrated = true; }
      db.referralLogs.forEach(function (l) {
        if (REFERRAL_STATUSES.indexOf(l.status) === -1) { l.status = "new"; migrated = true; }
      });

      // 紹介先早見表の名簿(名簿が未作成のときだけ初期名簿を投入)
      var seed = dataList("REF_SEED_MEMBERS");
      if (!db.referralMembers && seed) {
        db.referralMembers = clone(seed);
        db.seedRevisions = seedRevisionIds();
        migrated = true;
      }
      if (applySeedRevisions(db)) migrated = true;
      if (remapLegacyCategories(db)) migrated = true;
      MODULE_INSTANCES.forEach(function (m) { if (m.migrate && m.migrate(db)) migrated = true; });

      if (migrated) saveDb(db);
      return db;
    }

    function seedRevisionIds() {
      var revs = dataList("REF_SEED_REVISIONS");
      return revs ? revs.map(function (r) { return r.rev; }) : [];
    }

    function isBlankField(key, value) {
      if (Array.isArray(value)) return value.length === 0;
      if (key === "base") return !value || value === "未設定";
      if (key === "online") return !value || value === "unknown";
      if (key === "category") return !value || (typeof UNCATEGORIZED !== "undefined" && value === UNCATEGORIZED);
      return !value;
    }

    // 初期名簿の更新(REF_SEED_REVISIONS)を既存の名簿に一度だけ反映する。
    // 管理者ページ・本人が編集していないメンバーは初期名簿の内容に置き換え、
    // 編集済みのメンバーは空欄だけを埋める(force: true の更新は編集済みでも置き換える)。
    // fields があればその項目だけを見る。addTopics は、置き換えなかった(編集済みの)メンバーに
    // 初期名簿のその話題だけを足す。removeTopics({id: [話題]})はその人から外す。削除済みのメンバーは戻さない
    function applySeedRevisions(db) {
      var revs = dataList("REF_SEED_REVISIONS");
      var seedMembers = dataList("REF_SEED_MEMBERS");
      if (!db.referralMembers || !revs || !seedMembers) return false;
      if (!Array.isArray(db.seedRevisions)) db.seedRevisions = [];
      var changed = false;
      revs.forEach(function (r) {
        if (db.seedRevisions.indexOf(r.rev) !== -1) return;
        (r.remove || []).forEach(function (id) { removeMember(db, id); });
        r.ids.forEach(function (id) {
          var seedMember = seedMembers.filter(function (m) { return m.id === id; })[0];
          var index = findIndex(db.referralMembers, function (m) { return m.id === id; });
          if (!seedMember || index < 0) return;
          var current = db.referralMembers[index];
          var next = Object.assign({}, current);
          Object.keys(seedMember).forEach(function (k) {
            if (k === "id") return;
            if (r.fields && r.fields.indexOf(k) === -1) return;
            if (r.force || !current.editedAt || isBlankField(k, current[k])) next[k] = clone(seedMember[k]);
          });
          if (r.addTopics && Array.isArray(next.topics)) {
            next.topics = next.topics.concat((seedMember.topics || []).filter(function (t) {
              return r.addTopics.indexOf(t) !== -1 && next.topics.indexOf(t) === -1;
            }));
          }
          var removeTopics = r.removeTopics && r.removeTopics[id];
          if (removeTopics && Array.isArray(next.topics)) {
            next.topics = next.topics.filter(function (t) { return removeTopics.indexOf(t) === -1; });
          }
          db.referralMembers[index] = next;
        });
        db.seedRevisions.push(r.rev);
        changed = true;
      });
      return changed;
    }

    // 使わなくなった業種名(REF_LEGACY_CATEGORIES)のメンバーを新しい業種に置き換える。
    // 初期名簿にいる人は初期名簿の業種、いない人は扱う話題から決め、決まらなければ未分類
    function remapLegacyCategories(db) {
      var legacy = dataList("REF_LEGACY_CATEGORIES");
      var categories = dataList("REF_CATEGORIES");
      if (!legacy || !categories || !db.referralMembers) return false;
      var seedMembers = dataList("REF_SEED_MEMBERS") || [];
      var catTopics = dataList("REF_CATEGORY_TOPICS") || {};
      var changed = false;
      db.referralMembers.forEach(function (m) {
        if (legacy.indexOf(m.category) === -1) return;
        var seedMember = seedMembers.filter(function (x) { return x.id === m.id; })[0];
        var next = seedMember && categories.indexOf(seedMember.category) !== -1 ? seedMember.category : null;
        if (!next) {
          next = Object.keys(catTopics).filter(function (c) {
            return categories.indexOf(c) !== -1 && (m.topics || []).some(function (t) { return catTopics[c].indexOf(t) !== -1; });
          })[0] || categories[categories.length - 1];
        }
        m.category = next;
        changed = true;
      });
      return changed;
    }

    // メンバーを名簿から消し、そのメンバーとして作られたログイン情報・セッション・
    // 紹介の記録もあわせて消す
    function removeMember(db, id) {
      var userIds = db.users.filter(function (u) { return u.memberId === id; }).map(function (u) { return u.userId; });
      db.referralMembers = db.referralMembers.filter(function (m) { return m.id !== id; });
      db.users = db.users.filter(function (u) { return u.memberId !== id; });
      Object.keys(db.sessions).forEach(function (t) {
        if (userIds.indexOf(db.sessions[t].userId) !== -1) delete db.sessions[t];
      });
      db.referralLogs = db.referralLogs.filter(function (l) {
        return l.toMemberId !== id && userIds.indexOf(l.fromUserId) === -1;
      });
    }

    function findIndex(list, fn) {
      for (var i = 0; i < list.length; i++) if (fn(list[i])) return i;
      return -1;
    }
    function find(list, fn) {
      var i = findIndex(list, fn);
      return i < 0 ? null : list[i];
    }

    // 管理者かどうか: 管理者用パスコードで入ったセッション、または管理者に指定された会員
    function sessionIsAdmin(db, session, user) {
      if (session.isAdmin === true) return true;
      return !!(db.settings && db.settings.admins.indexOf(user.memberId) !== -1);
    }

    function toPublicUser(u, session, db) {
      // §5.3 の7フィールド
      var admin = db ? sessionIsAdmin(db, session, u) : session.isAdmin === true;
      return {
        userId: u.userId,
        email: "",
        role: admin ? "admin" : "member",
        accountStatus: "active",
        subscriptionStatus: "active",
        paymentExempt: false,
        isAdmin: admin,
      };
    }

    function ok(data) { return { success: true, data: data }; }
    function fail(code, message) {
      return {
        success: false,
        error: { code: code || "UNKNOWN", message: message || ERRORS[code] || ERRORS.SERVER_ERROR },
      };
    }

    // セッショントークンから { session, user } を解決(無効なら null)
    function authSession(db, token) {
      var session = db.sessions[String(token || "")];
      if (!session || session.revoked || session.expiresAt <= nowMs()) return null;
      var user = find(db.users, function (u) { return u.userId === session.userId; });
      if (!user) return null;
      // 名簿から削除されたメンバーのセッションは無効
      if (db.referralMembers && !db.referralMembers.some(function (m) { return m.id === user.memberId; })) return null;
      return { session: session, user: user, isAdmin: sessionIsAdmin(db, session, user) };
    }

    function authUser(db, token) {
      var a = authSession(db, token);
      return a ? a.user : null;
    }

    // 入力されたパスコードの種類を返す("admin" / "member" / null)。
    // どちらの照合も必ず行い、どちらに一致したかで処理時間が変わらないようにする
    function matchPasscode(code) {
      var normalized = String(code || "").trim().toLowerCase().replace(/[\s-]/g, "");
      var adminHash = sha256Hex(PASSCODES.admin.salt + ":" + normalized);
      var memberHash = sha256Hex(PASSCODES.member.salt + ":" + normalized);
      if (!normalized) return null;
      if (adminHash === PASSCODES.admin.hash) return "admin";
      if (memberHash === PASSCODES.member.hash) return "member";
      return null;
    }

    // ---------- passcodeLogin ----------
    // 1回目: { passcode } → 正しければ名簿の名前一覧を返す
    // 2回目: { passcode, memberId, remember } → セッションを発行する
    function passcodeLogin(body) {
      var db = ensureDb();
      var guard = db.passcodeGuard;

      // ロック中は照合しない(§8 判定順序3)
      if (guard.lockedUntil > nowMs()) return fail("LOCKED");

      var role = matchPasscode(body.passcode);
      if (!role) {
        guard.failures += 1;
        if (guard.failures >= LOGIN_FAILURE_LIMIT) {
          guard.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000;
          guard.failures = 0;
          saveDb(db);
          return fail("LOCKED");
        }
        saveDb(db);
        return fail("AUTH_FAILED");
      }
      guard.failures = 0;
      guard.lockedUntil = 0;
      if (role === "member" && db.settings.memberPasscode === false) {
        saveDb(db);
        return fail("PASSCODE_DISABLED");
      }

      var roster = db.referralMembers || [];
      var memberId = String(body.memberId || "").trim();
      if (!memberId) {
        saveDb(db);
        return ok({ step: "chooseMember", members: roster.map(function (m) { return { id: m.id, name: m.name }; }) });
      }
      var member = find(roster, function (m) { return m.id === memberId; });
      if (!member) return fail("INVALID_REQUEST");

      var user = find(db.users, function (u) { return u.memberId === member.id; });
      if (!user) {
        user = { userId: "usr_" + randomHex(16), memberId: member.id, name: member.name, createdAt: nowMs() };
        db.users.push(user);
      }
      user.name = member.name;

      // Session fixation 対策(§7): 成功のたびに必ず新規トークンを発行
      // remember は === true の厳密判定(§5.2)。
      // Boolean()正規化は不可。Boolean("false")===true となり
      // 30日セッションが誤発行される(docs/specs §14)
      var remember = body.remember === true;
      var ttlMs = remember
        ? SESSION_REMEMBER_DAYS * 24 * 60 * 60 * 1000
        : SESSION_TTL_HOURS * 60 * 60 * 1000;

      return issueSession(db, user, { isAdmin: role === "admin", remember: remember, userAgent: body.userAgent, via: "passcode" });
    }

    // セッションを発行して保存する(ログイン成功時の共通処理)
    function issueSession(db, user, opt) {
      var ttlMs = opt.remember
        ? SESSION_REMEMBER_DAYS * 24 * 60 * 60 * 1000
        : SESSION_TTL_HOURS * 60 * 60 * 1000;
      var token = randomToken();
      var session = {
        userId: user.userId,
        isAdmin: opt.isAdmin === true,
        via: opt.via,
        issuedAt: nowMs(),
        expiresAt: nowMs() + ttlMs,
        remember: opt.remember,
        revoked: false,
        userAgent: String(opt.userAgent || "").slice(0, 300),
      };
      db.sessions[token] = session;
      user.lastLoginAt = nowMs();
      saveDb(db);
      return ok({
        sessionToken: token,
        expiresAt: new Date(session.expiresAt).toISOString(),
        remember: opt.remember,
        user: toPublicUser(user, session, db),
        displayName: user.name,
        memberId: user.memberId,
      });
    }

    // ============================================
    // 会員ごとのアカウント
    // ============================================

    function userForMember(db, member) {
      var user = find(db.users, function (u) { return u.memberId === member.id; });
      if (!user) {
        user = { userId: "usr_" + randomHex(16), memberId: member.id, name: member.name, createdAt: nowMs() };
        db.users.push(user);
      }
      user.name = member.name;
      return user;
    }

    function inviteHash(code) {
      return sha256Hex("invite:" + String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));
    }

    function findInvite(db, code) {
      var h = inviteHash(code);
      return find(db.users, function (u) { return u.invite && u.invite.hash === h && u.invite.expiresAt > nowMs(); });
    }

    // 招待コードの総当たりを防ぐ(全体で20回まちがえると15分止める)
    function inviteGuardFail(db) {
      var g = db.inviteGuard;
      g.failures += 1;
      if (g.failures >= 20) { g.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000; g.failures = 0; }
      saveDb(db);
      return fail(g.lockedUntil > nowMs() ? "LOCKED" : "INVITE_INVALID");
    }

    // ログイン画面の表示に使う(共通パスコードを受け付けているか)
    function loginOptions() {
      var db = ensureDb();
      return ok({ memberPasscode: db.settings.memberPasscode !== false });
    }

    // 招待コードの確認 → 本人の名前を返す
    function inviteInfo(body) {
      var db = ensureDb();
      if (db.inviteGuard.lockedUntil > nowMs()) return fail("LOCKED");
      var user = findInvite(db, body.code);
      if (!user) return inviteGuardFail(db);
      return ok({ name: user.name, hasPassword: !!user.pw });
    }

    function passwordOk(password, name) {
      var p = String(password || "");
      return p.length >= 8 && p.length <= 128 && normalizeName(p) !== normalizeName(name);
    }

    function setPassword(user, password) {
      var salt = randomHex(16);
      user.pw = { salt: salt, iter: PASSWORD_ITERATIONS, hash: hashPassword(salt, password, PASSWORD_ITERATIONS) };
      user.failures = 0;
      user.lockedUntil = 0;
    }

    // 招待コードで本人がパスワードを決める(再発行されたコードならパスワードの再設定)
    function activateAccount(body) {
      var db = ensureDb();
      if (db.inviteGuard.lockedUntil > nowMs()) return fail("LOCKED");
      var user = findInvite(db, body.code);
      if (!user) return inviteGuardFail(db);
      if (!passwordOk(body.password, user.name)) return fail("PASSWORD_WEAK");
      setPassword(user, body.password);
      delete user.invite;
      user.activatedAt = nowMs();
      // パスワードを決め直したら、ほかの端末のログインは切る
      Object.keys(db.sessions).forEach(function (t) { if (db.sessions[t].userId === user.userId) delete db.sessions[t]; });
      return issueSession(db, user, { remember: body.remember === true, userAgent: body.userAgent, via: "account" });
    }

    // ログイン画面の「お名前」の選択肢(名簿の名前だけ。名簿は早見表と同じもの)
    function loginMembers() {
      var db = ensureDb();
      return ok({
        members: (db.referralMembers || []).map(function (m) { return { id: m.id, name: m.name }; }),
        memberPasscode: db.settings.memberPasscode !== false,
      });
    }

    // お名前(名簿から選ぶ。memberId)+ パスワード。
    // まだパスワードを決めていない人は、移行期間のあいだ共通パスコードでも入れる
    function accountLogin(body) {
      var db = ensureDb();
      var password = String(body.password || "");
      var memberId = cleanStr(body.memberId, 40);
      if (memberId) {
        var mem = find(db.referralMembers || [], function (m) { return m.id === memberId; });
        if (!mem || !password) return fail("ACCOUNT_FAILED");
        var u0 = find(db.users, function (u) { return u.memberId === mem.id; });
        if (!u0 || !u0.pw) {
          if (db.passcodeGuard.lockedUntil > nowMs()) return fail("LOCKED");
          var role = db.settings.memberPasscode !== false ? matchPasscode(password) : null;
          if (role !== "member" && role !== "admin") {
            db.passcodeGuard.failures += 1;
            if (db.passcodeGuard.failures >= LOGIN_FAILURE_LIMIT) {
              db.passcodeGuard.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000;
              db.passcodeGuard.failures = 0;
              saveDb(db);
              return fail("LOCKED");
            }
            saveDb(db);
            return fail("ACCOUNT_FAILED", db.settings.memberPasscode !== false
              ? "パスワード(まだ決めていない方は共通パスコード)が正しくありません。"
              : "まだパスワードが決まっていません。運営者から届く招待コードで、パスワードを決めてください。");
          }
          db.passcodeGuard.failures = 0;
          var user0 = userForMember(db, mem);
          // ここは会員としてのログイン(管理者用パスコードでも、管理者にはしない)
          return issueSession(db, user0, { remember: body.remember === true, userAgent: body.userAgent, via: "passcode" });
        }
        body.name = mem.name;
        body._only = mem.id;
      }
      var key = normalizeName(body.name);
      if (!key || !password) return fail("ACCOUNT_FAILED");
      var candidates = (db.referralMembers || [])
        .filter(function (m) { return normalizeName(m.name) === key && (!body._only || m.id === body._only); })
        .map(function (m) { return find(db.users, function (u) { return u.memberId === m.id && u.pw; }); })
        .filter(Boolean);
      if (!candidates.length) return fail("ACCOUNT_FAILED");
      if (candidates.every(function (u) { return (u.lockedUntil || 0) > nowMs(); })) return fail("LOCKED");
      var user = null;
      candidates.forEach(function (u) {
        if (user || (u.lockedUntil || 0) > nowMs()) return;
        if (hashPassword(u.pw.salt, password, u.pw.iter) === u.pw.hash) user = u;
      });
      if (!user) {
        var locked = false;
        candidates.forEach(function (u) {
          u.failures = (u.failures || 0) + 1;
          if (u.failures >= LOGIN_FAILURE_LIMIT) { u.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000; u.failures = 0; locked = true; }
        });
        saveDb(db);
        return fail(locked ? "LOCKED" : "ACCOUNT_FAILED");
      }
      user.failures = 0;
      user.lockedUntil = 0;
      return issueSession(db, user, { remember: body.remember === true, userAgent: body.userAgent, via: "account" });
    }

    function changePassword(body) {
      var db = ensureDb();
      var a = authSession(db, body.sessionToken);
      if (!a) return fail("SESSION_INVALID");
      var user = a.user;
      if (user.pw && hashPassword(user.pw.salt, String(body.current || ""), user.pw.iter) !== user.pw.hash) {
        return fail("ACCOUNT_FAILED", "いまのパスワードが正しくありません。");
      }
      if (!passwordOk(body.password, user.name)) return fail("PASSWORD_WEAK");
      setPassword(user, body.password);
      user.activatedAt = user.activatedAt || nowMs();
      // このセッション以外のログインは切る
      Object.keys(db.sessions).forEach(function (t) {
        if (db.sessions[t].userId === user.userId && t !== String(body.sessionToken)) delete db.sessions[t];
      });
      saveDb(db);
      return ok({});
    }

    // 招待コードを発行する(コードはこのときだけ返す。保存するのはハッシュだけ)
    function adminIssueInvite(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var ids = Array.isArray(body.memberIds) ? body.memberIds : [body.memberId];
      var out = [];
      ids.slice(0, 500).forEach(function (raw) {
        var id = cleanStr(raw, 40);
        var member = find(db.referralMembers || [], function (m) { return m.id === id; });
        if (!member) return;
        var user = userForMember(db, member);
        var code = env.randomBytes(10).map(function (b) { return INVITE_ALPHABET[b % INVITE_ALPHABET.length]; }).join("");
        code = code.slice(0, 5) + "-" + code.slice(5);
        user.invite = { hash: inviteHash(code), expiresAt: nowMs() + INVITE_DAYS * 24 * 60 * 60 * 1000, issuedAt: nowMs() };
        out.push({ memberId: member.id, name: member.name, code: code, expiresAt: user.invite.expiresAt, reset: !!user.pw });
      });
      if (!out.length) return fail("NOT_FOUND");
      saveDb(db);
      return ok({ invites: out });
    }

    function adminListAccounts(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var accounts = (db.referralMembers || []).map(function (m) {
        var u = find(db.users, function (x) { return x.memberId === m.id; });
        var status = u && u.pw ? "active" : u && u.invite && u.invite.expiresAt > nowMs() ? "invited" : u && u.invite ? "expired" : "none";
        return {
          memberId: m.id,
          name: m.name,
          team: m.team,
          status: status,
          inviteExpiresAt: u && u.invite ? u.invite.expiresAt : 0,
          activatedAt: (u && u.activatedAt) || 0,
          lastLoginAt: (u && u.lastLoginAt) || 0,
          locked: !!(u && u.lockedUntil > nowMs()),
          admin: db.settings.admins.indexOf(m.id) !== -1,
        };
      });
      return ok({ accounts: accounts, settings: { memberPasscode: db.settings.memberPasscode !== false } });
    }

    function adminSetSettings(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      if (typeof body.memberPasscode === "boolean") db.settings.memberPasscode = body.memberPasscode;
      saveDb(db);
      return ok({ settings: { memberPasscode: db.settings.memberPasscode !== false } });
    }

    function adminSetAdmin(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var id = cleanStr(body.memberId, 40);
      if (!find(db.referralMembers || [], function (m) { return m.id === id; })) return fail("NOT_FOUND");
      db.settings.admins = db.settings.admins.filter(function (x) { return x !== id; });
      if (body.admin === true) db.settings.admins.push(id);
      saveDb(db);
      return ok({ admins: db.settings.admins });
    }

    // ロックの解除・ログアウトさせる(端末をなくしたときなど)
    function adminResetAccount(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var id = cleanStr(body.memberId, 40);
      var user = find(db.users, function (u) { return u.memberId === id; });
      if (!user) return fail("NOT_FOUND");
      user.failures = 0;
      user.lockedUntil = 0;
      if (body.signOut === true) {
        Object.keys(db.sessions).forEach(function (t) { if (db.sessions[t].userId === user.userId) delete db.sessions[t]; });
      }
      saveDb(db);
      return ok({});
    }

    // ---------- verifySession(失敗は常に SESSION_INVALID §5.5) ----------
    function verifySession(body) {
      var db = ensureDb();
      var a = authSession(db, body.sessionToken);
      if (!a) return fail("SESSION_INVALID");

      // 期限判定はサーバー時刻のみ・検証時の延長は行わない(§8)
      return ok({
        expiresAt: new Date(a.session.expiresAt).toISOString(),
        remember: a.session.remember,
        user: toPublicUser(a.user, a.session, db),
        displayName: a.user.name,
        memberId: a.user.memberId,
        hasPassword: !!a.user.pw,
      });
    }

    // ---------- logout ----------
    function logout(body) {
      var db = ensureDb();
      var token = String(body.sessionToken || "");
      if (db.sessions[token]) {
        delete db.sessions[token];
        saveDb(db);
      }
      return ok({});
    }

    // ============================================
    // 紹介先早見表の名簿
    // ============================================

    function cleanStr(v, max) {
      return String(v === undefined || v === null ? "" : v).trim().slice(0, max);
    }

    function cleanList(v, allowed, max) {
      if (!Array.isArray(v)) return [];
      var out = [];
      v.forEach(function (x) {
        var t = cleanStr(x, 60);
        if (!t || out.indexOf(t) !== -1) return;
        if (allowed && allowed.indexOf(t) === -1) return;
        out.push(t);
      });
      return out.slice(0, max);
    }

    function sanitizeReferralMember(input, id) {
      var m = input || {};
      var categories = dataList("REF_CATEGORIES");
      var bases = dataList("REF_BASES");
      var category = cleanStr(m.category, 40);
      var base = cleanStr(m.base, 10);
      var online = cleanStr(m.online, 10);
      var industries = idsOf("INDUSTRIES");
      return {
        id: id,
        name: cleanStr(m.name, 40),
        company: cleanStr(m.company, 80),
        team: cleanStr(m.team, 40),
        base: !bases || bases.indexOf(base) !== -1 ? base || "未設定" : "未設定",
        category: !categories || categories.indexOf(category) !== -1 ? category : categories[categories.length - 1],
        business: cleanStr(m.business, 600),
        customers: cleanStr(m.customers, 400),
        offer: cleanStr(m.offer, 120),
        selfIntro: cleanStr(String(m.selfIntro || "").replace(/\r\n?/g, "\n"), 3000),
        note: cleanStr(m.note, 300),
        wants: cleanStr(m.wants, 400),
        triggers: cleanList(m.triggers, null, 12).map(function (t) { return t.slice(0, 40); }),
        face: cleanStr(m.face, 60),
        faceAreas: cleanList(m.faceAreas, ["niigata", "tokyo"], 2),
        online: ["all", "partial", "none", "unknown"].indexOf(online) !== -1 ? online : "unknown",
        topics: cleanList(m.topics, idsOf("TOPICS"), 20),
        targets: cleanList(m.targets, industries ? industries.concat("any") : null, 10),
        prospects: cleanList(m.prospects, idsOf("PROSPECTS"), 3),
        links: cleanLinks(m.links),
        // 1on1シート(人柄が伝わる項目)
        strengths: cleanStr(m.strengths, 400),
        pitch: cleanStr(m.pitch, 200),
        ng: cleanStr(m.ng, 300),
        goals: cleanStr(m.goals, 300),
        personal: cleanStr(m.personal, 400),
      };
    }

    // 資料・リンク: https:// のURLか、サイト内の materials/ のファイルだけを受け付ける
    function cleanUrl(v) {
      var u = cleanStr(v, 500);
      if (/^https:\/\/[^\s"'<>]+$/i.test(u)) return u;
      if (/^materials\/[\w.-]+$/.test(u) && u.indexOf("..") === -1) return u;
      return "";
    }
    function cleanLinks(v) {
      if (!Array.isArray(v)) return [];
      var types = idsOf("LINK_TYPES");
      var out = [];
      v.forEach(function (x) {
        if (!x || typeof x !== "object" || out.length >= 8) return;
        var type = cleanStr(x.type, 20);
        var url = cleanUrl(x.url);
        if (!url || (types && types.indexOf(type) === -1)) return;
        var link = { type: type, url: url, label: cleanStr(x.label, 60) };
        var cover = cleanUrl(x.cover);
        if (cover) link.cover = cover;
        out.push(link);
      });
      return out;
    }

    function requireAdmin(db, token) {
      var a = authSession(db, token);
      if (!a) return { error: fail("SESSION_INVALID") };
      if (!a.isAdmin) return { error: fail("FORBIDDEN_ADMIN") };
      return { user: a.user };
    }

    function listReferralMembers(body) {
      var db = ensureDb();
      if (!authUser(db, body.sessionToken)) return fail("SESSION_INVALID");
      return ok({ members: db.referralMembers || [] });
    }

    // 本人によるプロフィール編集。名前・所属チームは変えられない
    function updateMyProfile(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var index = findIndex(db.referralMembers || [], function (m) { return m.id === me.memberId; });
      if (index < 0) return fail("INVALID_REQUEST");
      var current = db.referralMembers[index];
      var input = body.profile && typeof body.profile === "object" ? body.profile : {};
      var merged = Object.assign({}, current);
      SELF_EDITABLE.forEach(function (k) { if (k in input) merged[k] = input[k]; });
      var member = sanitizeReferralMember(merged, current.id);
      member.name = current.name;
      member.team = current.team;
      member.editedAt = nowMs();
      member.editedBy = "self";
      db.referralMembers[index] = member;
      saveDb(db);
      return ok({ member: member });
    }

    function adminSaveReferralMember(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      if (!db.referralMembers) db.referralMembers = [];

      var requestedId = cleanStr(body.member && body.member.id, 40);
      var index = findIndex(db.referralMembers, function (x) { return x.id === requestedId; });
      var id = index >= 0 ? requestedId : "m_" + randomHex(5);
      // 送られてこなかった項目(1on1シートなど)は今の値を残す
      var input = index >= 0 ? Object.assign({}, db.referralMembers[index], body.member || {}) : body.member;
      var member = sanitizeReferralMember(input, id);
      if (!member.name) return fail("INVALID_REQUEST");
      member.editedAt = nowMs();
      member.editedBy = "admin";

      if (index >= 0) db.referralMembers[index] = member;
      else db.referralMembers.push(member);
      saveDb(db);
      return ok({ member: member, created: index < 0 });
    }

    function adminDeleteReferralMember(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var id = cleanStr(body.id, 40);
      var before = (db.referralMembers || []).length;
      db.referralMembers = (db.referralMembers || []).filter(function (x) { return x.id !== id; });
      if (db.referralMembers.length === before) return fail("INVALID_REQUEST");
      saveDb(db);
      return ok({});
    }

    function adminImportReferralMembers(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      if (!Array.isArray(body.members) || body.members.length > 500) return fail("INVALID_REQUEST");
      var seen = {};
      var members = [];
      body.members.forEach(function (raw) {
        var id = cleanStr(raw && raw.id, 40);
        if (!id || seen[id]) id = "m_" + randomHex(5);
        seen[id] = true;
        var m = sanitizeReferralMember(raw, id);
        m.editedAt = nowMs();
        m.editedBy = "admin";
        if (m.name) members.push(m);
      });
      db.referralMembers = members;
      saveDb(db);
      return ok({ count: members.length });
    }

    // ============================================
    // 紹介の記録
    // ============================================

    function displayName(u) {
      return u.name || "会員";
    }

    function recordReferral(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var memberId = cleanStr(body.toMemberId, 40);
      var member = find(db.referralMembers || [], function (m) { return m.id === memberId; });
      if (!member) return fail("INVALID_REQUEST");
      if (member.id === me.memberId) return fail("SELF_REFERRAL");
      var log = {
        id: "r_" + randomHex(6),
        fromUserId: me.userId,
        toMemberId: member.id,
        prospect: cleanStr(body.prospect, 60),
        // 紹介した相手の連絡先: 紹介した人と紹介を受けた人だけが見る
        contact: cleanStr(body.contact, 120),
        memo: cleanStr(body.memo, 300),
        topics: cleanList(body.topics, idsOf("TOPICS"), 10),
        status: "new",
        at: nowMs(),
        statusAt: 0,
      };
      db.referralLogs.push(log);
      saveDb(db);
      return ok({ log: log });
    }

    function deleteReferral(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var id = cleanStr(body.id, 40);
      var log = find(db.referralLogs, function (l) { return l.id === id; });
      if (!log || log.fromUserId !== me.userId) return fail("INVALID_REQUEST");
      db.referralLogs = db.referralLogs.filter(function (l) { return l.id !== id; });
      saveDb(db);
      return ok({});
    }

    // 紹介を受けた本人だけが対応状況を更新できる
    function updateReferralStatus(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var id = cleanStr(body.id, 40);
      var status = cleanStr(body.status, 20);
      if (REFERRAL_STATUSES.indexOf(status) === -1) return fail("INVALID_REQUEST");
      var log = find(db.referralLogs, function (l) { return l.id === id; });
      if (!log || log.toMemberId !== me.memberId) return fail("INVALID_REQUEST");
      log.status = status;
      log.statusAt = nowMs();
      saveDb(db);
      return ok({ id: log.id, status: log.status });
    }

    function getReferralStats(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var logs = db.referralLogs;
      var monthStart = new Date(nowMs());
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      var received = {};
      var byGiver = {};
      logs.forEach(function (l) {
        received[l.toMemberId] = (received[l.toMemberId] || 0) + 1;
        var g = byGiver[l.fromUserId] || (byGiver[l.fromUserId] = { count: 0, won: 0 });
        g.count += 1;
        if (l.status === "won") g.won += 1;
      });
      var ranking = Object.keys(byGiver)
        .map(function (userId) {
          var u = find(db.users, function (x) { return x.userId === userId; });
          return {
            name: u ? displayName(u) : "退会した会員",
            count: byGiver[userId].count,
            won: byGiver[userId].won,
            isMe: userId === me.userId,
          };
        })
        .sort(function (a, b) { return b.count - a.count || b.won - a.won; })
        .slice(0, 5);
      var memberName = function (id) {
        var m = find(db.referralMembers || [], function (x) { return x.id === id; });
        return m ? m.name : "(削除されたメンバー)";
      };
      var giverName = function (userId) {
        var u = find(db.users, function (x) { return x.userId === userId; });
        return u ? displayName(u) : "退会した会員";
      };
      var mine = logs.filter(function (l) { return l.fromUserId === me.userId; });
      var inbox = logs.filter(function (l) { return l.toMemberId === me.memberId; });

      return ok({
        myCount: mine.length,
        myWonCount: mine.filter(function (l) { return l.status === "won"; }).length,
        totalCount: logs.length,
        wonCount: logs.filter(function (l) { return l.status === "won"; }).length,
        monthCount: logs.filter(function (l) { return l.at >= monthStart.getTime(); }).length,
        received: received,
        ranking: ranking,
        myRecent: mine
          .slice(-10)
          .reverse()
          .map(function (l) {
            return { id: l.id, toName: memberName(l.toMemberId), toMemberId: l.toMemberId, prospect: l.prospect, memo: l.memo || "", status: l.status, at: l.at };
          }),
        inboxNewCount: inbox.filter(function (l) { return l.status === "new"; }).length,
        inbox: inbox
          .slice(-30)
          .reverse()
          .map(function (l) {
            return { id: l.id, fromName: giverName(l.fromUserId), prospect: l.prospect, contact: l.contact || "", memo: l.memo || "", topics: l.topics || [], status: l.status, at: l.at };
          }),
      });
    }

    var ACTIONS = {
      passcodeLogin: passcodeLogin,
      verifySession: verifySession,
      logout: logout,
      listReferralMembers: listReferralMembers,
      updateMyProfile: updateMyProfile,
      adminSaveReferralMember: adminSaveReferralMember,
      adminDeleteReferralMember: adminDeleteReferralMember,
      adminImportReferralMembers: adminImportReferralMembers,
      recordReferral: recordReferral,
      deleteReferral: deleteReferral,
      updateReferralStatus: updateReferralStatus,
      getReferralStats: getReferralStats,
      loginOptions: loginOptions,
      loginMembers: loginMembers,
      inviteInfo: inviteInfo,
      activateAccount: activateAccount,
      accountLogin: accountLogin,
      changePassword: changePassword,
      adminIssueInvite: adminIssueInvite,
      adminListAccounts: adminListAccounts,
      adminSetSettings: adminSetSettings,
      adminSetAdmin: adminSetAdmin,
      adminResetAccount: adminResetAccount,
    };

    // 追加の機能に渡す道具
    var ctx = {
      ensureDb: ensureDb, saveDb: saveDb, ok: ok, fail: fail, nowMs: nowMs,
      randomHex: randomHex, randomToken: randomToken, sha256Hex: sha256Hex,
      authSession: authSession, requireAdmin: requireAdmin,
      cleanStr: cleanStr, cleanList: cleanList, find: find, findIndex: findIndex,
      dataList: dataList, idsOf: idsOf, clone: clone, ERRORS: ERRORS,
      // Google カレンダー(共有サーバーで設定したときだけ。なければ null)
      calendar: env.calendar || null,
      // Google Meet の参加記録(共有サーバーで設定したときだけ。なければ null)
      meet: env.meet || null,
    };
    var MODULE_INSTANCES = MODULES.map(function (m) {
      var inst = m.create(ctx) || {};
      Object.keys(inst.actions || {}).forEach(function (name) { ACTIONS[name] = inst.actions[name]; });
      return inst;
    });

    function handle(body) {
      try {
        if (!body || typeof body !== "object" || !body.action) return fail("INVALID_REQUEST");
        var fn = Object.prototype.hasOwnProperty.call(ACTIONS, body.action) ? ACTIONS[body.action] : null;
        if (!fn) return fail("INVALID_ACTION");
        return fn(body);
      } catch (err) {
        if (env.onError) env.onError(err);
        return fail("SERVER_ERROR");
      }
    }

    // 定期実行の処理(外からは呼べない。GAS の時間主導トリガーから呼ぶ)
    function runJob(name) {
      var done = [];
      MODULE_INSTANCES.forEach(function (m) {
        if (m.jobs && typeof m.jobs[name] === "function") done.push(m.jobs[name]());
      });
      return done;
    }

    return { handle: handle, runJob: runJob };
  }

  // 書き込みを伴う操作(共有サーバーでスプレッドシートの一覧を更新する対象)
  var MUTATING_ACTIONS = [
    "updateMyProfile", "adminSaveReferralMember", "adminDeleteReferralMember", "adminImportReferralMembers",
    "recordReferral", "deleteReferral", "updateReferralStatus",
  ];

  return {
    createServer: createServer,
    registerModule: function (mod) {
      registerModule(mod);
      (mod.mutating || []).forEach(function (a) { MUTATING_ACTIONS.push(a); });
    },
    sha256Hex: sha256Hex,
    normalizeName: normalizeName,
    SELF_EDITABLE: SELF_EDITABLE,
    ERRORS: ERRORS,
    REFERRAL_STATUSES: REFERRAL_STATUSES,
    MUTATING_ACTIONS: MUTATING_ACTIONS,
  };
})();
