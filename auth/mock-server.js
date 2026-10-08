// ============================================
// auth/mock-server.js — サーバー側判定のブラウザ内デモ実装
// 仕様: docs/specs/login-page-detailed-spec-v3.md §5, §8
//
// 本来は GAS 等のバックエンドが担う判定を、デモ用にブラウザ内に実装したもの。
// 実 API へ移行する場合は api.js の API_BASE_URL を設定すればこのファイルは
// 使われなくなる。
//
// 認証: 会員登録はなく、コミュニティ共通のパスコードで入る。
// パスコードが正しければ名簿から自分の名前を選んでセッションを発行する
// (紹介の記録を本人名義で集計するため)。管理者用パスコードで入った
// セッションだけが名簿を編集できる。失敗理由は AUTH_FAILED / LOCKED の2種、
// verifySession の失敗は SESSION_INVALID 単一コード(§5.4 / §5.5)。
//
// 紹介先早見表: 名簿の閲覧は会員、追加・編集・削除は管理者のみ。
// 紹介の記録は会員が自分の名義でのみ追加・取り消しできる。
// データは localStorage のDBに保存する(デモのため同一ブラウザ内のみ)。
// ============================================

const AuthMockServer = (function () {
  "use strict";

  const DB_KEY = "kouryukai-auth-db";

  // 設定値(§8)。この4値は仕様で固定
  const LOGIN_FAILURE_LIMIT = 5;
  const LOCK_DURATION_MINUTES = 15;
  const SESSION_TTL_HOURS = 12;
  const SESSION_REMEMBER_DAYS = 30;

  // パスコードは平文を置かず、ソルト付き SHA-256 のハッシュだけを持つ。
  // 照合前に小文字化し、ハイフンと空白を取り除く
  const PASSCODES = {
    member: { salt: "0fdad7ca2a02b6424d2fda1d85d36c3a", hash: "c2bd4fe026b60aed343fe5d9547119167f92dcec1a5fb8a7df44f41c65f79595" },
    admin: { salt: "208b4fd8211062d5ced31e63c9e4626e", hash: "9e47ede3415ac83b0fc215d0780ecabd8cb9a7da124aa19c5facd44d23c9438a" },
  };

  // サーバー由来エラー文言(§9: Response.gs ERRORS 相当)
  const ERRORS = {
    AUTH_FAILED: "パスコードが正しくありません。",
    LOCKED: "ログインを一時的に制限しています。時間をおいて再度お試しください。",
    SESSION_INVALID: "セッションが無効です。もう一度ログインしてください。",
    INVALID_REQUEST: "リクエストの形式が正しくありません。",
    INVALID_ACTION: "不明な操作が指定されました。",
    FORBIDDEN_ADMIN: "この操作は管理者のみ行えます。",
    SELF_REFERRAL: "ご自身への紹介は記録できません。",
    SERVER_ERROR: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
  };

  let channel = null;
  try {
    channel = new BroadcastChannel("kouryukai-sync");
  } catch {
    channel = null;
  }

  function nowMs() { return Date.now(); }

  function loadDb() {
    try {
      return JSON.parse(localStorage.getItem(DB_KEY) || "null");
    } catch {
      return null;
    }
  }
  function saveDb(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    // 別タブへ即時通知(storage イベントの補完)
    if (channel) {
      try { channel.postMessage("db-updated"); } catch { /* noop */ }
    }
  }

  function randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    // base64url 43文字(§5.3)
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : randomSalt();
  }

  async function ensureDb() {
    let db = loadDb();
    if (!db || !db.users) {
      db = { users: [], sessions: {}, referralLogs: [], passcodeGuard: { failures: 0, lockedUntil: 0 } };
      saveDb(db);
    }

    let migrated = false;
    // 旧バージョンからの移行: マッチング機能のデータ、メールアドレスで作った
    // アカウントとそのセッションを削除する(パスコード方式に一本化)
    ["likes", "messages", "botsSeeded", "dummy"].forEach((k) => { if (k in db) { delete db[k]; migrated = true; } });
    if (db.users.some((u) => !u.memberId)) {
      db.users = db.users.filter((u) => u.memberId);
      migrated = true;
    }
    Object.keys(db.sessions).forEach((t) => {
      if (!db.users.some((u) => u.userId === db.sessions[t].userId)) { delete db.sessions[t]; migrated = true; }
    });
    if (!db.referralLogs) { db.referralLogs = []; migrated = true; }
    if (!db.passcodeGuard) { db.passcodeGuard = { failures: 0, lockedUntil: 0 }; migrated = true; }

    // 紹介先早見表の名簿(名簿が未作成のときだけ初期名簿を投入)
    if (!db.referralMembers && typeof REF_SEED_MEMBERS !== "undefined") {
      db.referralMembers = JSON.parse(JSON.stringify(REF_SEED_MEMBERS));
      db.seedRevisions = seedRevisionIds();
      migrated = true;
    }
    if (applySeedRevisions(db)) migrated = true;

    if (migrated) saveDb(db);
    return db;
  }

  function seedRevisionIds() {
    return typeof REF_SEED_REVISIONS === "undefined" ? [] : REF_SEED_REVISIONS.map((r) => r.rev);
  }

  function isBlankField(key, value) {
    if (Array.isArray(value)) return value.length === 0;
    if (key === "base") return !value || value === "未設定";
    if (key === "online") return !value || value === "unknown";
    if (key === "category") return !value || (typeof UNCATEGORIZED !== "undefined" && value === UNCATEGORIZED);
    return !value;
  }

  // 初期名簿の更新(REF_SEED_REVISIONS)を既存の名簿に一度だけ反映する。
  // 管理者ページで編集していないメンバーは初期名簿の内容に置き換え、
  // 編集済みのメンバーは空欄だけを埋める。削除済みのメンバーは戻さない
  function applySeedRevisions(db) {
    if (!db.referralMembers || typeof REF_SEED_REVISIONS === "undefined" || typeof REF_SEED_MEMBERS === "undefined") return false;
    if (!Array.isArray(db.seedRevisions)) db.seedRevisions = [];
    let changed = false;
    REF_SEED_REVISIONS.forEach((r) => {
      if (db.seedRevisions.includes(r.rev)) return;
      r.ids.forEach((id) => {
        const seed = REF_SEED_MEMBERS.find((m) => m.id === id);
        const index = db.referralMembers.findIndex((m) => m.id === id);
        if (!seed || index < 0) return;
        const current = db.referralMembers[index];
        const next = Object.assign({}, current);
        Object.keys(seed).forEach((k) => {
          if (k === "id") return;
          if (!current.editedAt || isBlankField(k, current[k])) next[k] = JSON.parse(JSON.stringify(seed[k]));
        });
        db.referralMembers[index] = next;
      });
      db.seedRevisions.push(r.rev);
      changed = true;
    });
    return changed;
  }

  function toPublicUser(u, session) {
    // §5.3 の7フィールド。管理者かどうかはセッション単位(入ったパスコード)で決まる
    return {
      userId: u.userId,
      email: "",
      role: session.isAdmin ? "admin" : "member",
      accountStatus: "active",
      subscriptionStatus: "active",
      paymentExempt: false,
      isAdmin: session.isAdmin === true,
    };
  }

  function ok(data) { return { success: true, data }; }
  function fail(code) {
    return {
      success: false,
      error: { code: code || "UNKNOWN", message: ERRORS[code] || ERRORS.SERVER_ERROR },
    };
  }

  // セッショントークンから { session, user } を解決(無効なら null)
  function authSession(db, token) {
    const session = db.sessions[String(token || "")];
    if (!session || session.revoked || session.expiresAt <= nowMs()) return null;
    const user = db.users.find((u) => u.userId === session.userId);
    if (!user) return null;
    // 名簿から削除されたメンバーのセッションは無効
    if (db.referralMembers && !db.referralMembers.some((m) => m.id === user.memberId)) return null;
    return { session, user };
  }

  function authUser(db, token) {
    const a = authSession(db, token);
    return a ? a.user : null;
  }

  // 入力されたパスコードの種類を返す("admin" / "member" / null)。
  // どちらの照合も必ず行い、どちらに一致したかで処理時間が変わらないようにする
  async function matchPasscode(code) {
    const normalized = String(code || "").trim().toLowerCase().replace(/[\s-]/g, "");
    const [adminHash, memberHash] = await Promise.all([
      sha256(PASSCODES.admin.salt + ":" + normalized),
      sha256(PASSCODES.member.salt + ":" + normalized),
    ]);
    if (!normalized) return null;
    if (adminHash === PASSCODES.admin.hash) return "admin";
    if (memberHash === PASSCODES.member.hash) return "member";
    return null;
  }

  // ---------- passcodeLogin ----------
  // 1回目: { passcode } → 正しければ名簿の名前一覧を返す
  // 2回目: { passcode, memberId, remember } → セッションを発行する
  async function passcodeLogin(body) {
    const db = await ensureDb();
    const guard = db.passcodeGuard;

    // ロック中は照合しない(§8 判定順序3)
    if (guard.lockedUntil > nowMs()) return fail("LOCKED");

    const role = await matchPasscode(body.passcode);
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

    const roster = db.referralMembers || [];
    const memberId = String(body.memberId || "").trim();
    if (!memberId) {
      saveDb(db);
      return ok({ step: "chooseMember", members: roster.map((m) => ({ id: m.id, name: m.name })) });
    }
    const member = roster.find((m) => m.id === memberId);
    if (!member) return fail("INVALID_REQUEST");

    let user = db.users.find((u) => u.memberId === member.id);
    if (!user) {
      user = { userId: "usr_" + uuid(), memberId: member.id, name: member.name, createdAt: nowMs() };
      db.users.push(user);
    }
    user.name = member.name;

    // Session fixation 対策(§7): 成功のたびに必ず新規トークンを発行
    // remember は === true の厳密判定(§5.2)。
    // Boolean()正規化は不可。Boolean("false")===true となり
    // 30日セッションが誤発行される(docs/specs §14)
    const remember = body.remember === true;
    const ttlMs = remember
      ? SESSION_REMEMBER_DAYS * 24 * 60 * 60 * 1000
      : SESSION_TTL_HOURS * 60 * 60 * 1000;

    const token = randomToken();
    const session = {
      userId: user.userId,
      isAdmin: role === "admin",
      issuedAt: nowMs(),
      expiresAt: nowMs() + ttlMs,
      remember,
      revoked: false,
      userAgent: String(body.userAgent || "").slice(0, 300),
    };
    db.sessions[token] = session;
    saveDb(db);

    return ok({
      sessionToken: token,
      expiresAt: new Date(session.expiresAt).toISOString(),
      remember,
      user: toPublicUser(user, session),
      displayName: user.name,
    });
  }

  // ---------- verifySession(失敗は常に SESSION_INVALID §5.5) ----------
  async function verifySession(body) {
    const db = await ensureDb();
    const a = authSession(db, body.sessionToken);
    if (!a) return fail("SESSION_INVALID");

    // 期限判定はサーバー時刻のみ・検証時の延長は行わない(§8)
    return ok({
      expiresAt: new Date(a.session.expiresAt).toISOString(),
      remember: a.session.remember,
      user: toPublicUser(a.user, a.session),
      displayName: a.user.name,
      memberId: a.user.memberId,
    });
  }

  // ---------- logout ----------
  async function logout(body) {
    const db = await ensureDb();
    const token = String(body.sessionToken || "");
    if (db.sessions[token]) {
      db.sessions[token].revoked = true;
      saveDb(db);
    }
    return ok({});
  }

  // ============================================
  // 紹介先早見表の名簿(閲覧は会員、追加・編集・削除は管理者のみ)
  // ============================================

  function cleanStr(v, max) {
    return String(v === undefined || v === null ? "" : v).trim().slice(0, max);
  }

  function cleanList(v, allowed, max) {
    if (!Array.isArray(v)) return [];
    const out = [];
    v.forEach((x) => {
      const t = cleanStr(x, 60);
      if (!t || out.includes(t)) return;
      if (allowed && !allowed.includes(t)) return;
      out.push(t);
    });
    return out.slice(0, max);
  }

  const idsOf = (list) => (typeof list === "undefined" ? null : list.map((x) => x.id));

  function sanitizeReferralMember(input, id) {
    const m = input || {};
    const categories = typeof REF_CATEGORIES === "undefined" ? null : REF_CATEGORIES;
    const bases = typeof REF_BASES === "undefined" ? null : REF_BASES;
    const category = cleanStr(m.category, 40);
    const base = cleanStr(m.base, 10);
    const online = cleanStr(m.online, 10);
    return {
      id,
      name: cleanStr(m.name, 40),
      company: cleanStr(m.company, 80),
      team: cleanStr(m.team, 40),
      base: !bases || bases.includes(base) ? base || "未設定" : "未設定",
      category: !categories || categories.includes(category) ? category : categories[categories.length - 1],
      business: cleanStr(m.business, 600),
      customers: cleanStr(m.customers, 400),
      note: cleanStr(m.note, 300),
      wants: cleanStr(m.wants, 400),
      triggers: cleanList(m.triggers, null, 12).map((t) => t.slice(0, 40)),
      face: cleanStr(m.face, 60),
      faceAreas: cleanList(m.faceAreas, ["niigata", "tokyo"], 2),
      online: ["all", "partial", "none", "unknown"].includes(online) ? online : "unknown",
      topics: cleanList(m.topics, idsOf(typeof TOPICS === "undefined" ? undefined : TOPICS), 20),
      targets: cleanList(m.targets, (idsOf(typeof INDUSTRIES === "undefined" ? undefined : INDUSTRIES) || []).concat("any"), 10),
      prospects: cleanList(m.prospects, idsOf(typeof PROSPECTS === "undefined" ? undefined : PROSPECTS), 3),
    };
  }

  function requireAdmin(db, token) {
    const a = authSession(db, token);
    if (!a) return { error: fail("SESSION_INVALID") };
    if (!a.session.isAdmin) return { error: fail("FORBIDDEN_ADMIN") };
    return { user: a.user };
  }

  async function listReferralMembers(body) {
    const db = await ensureDb();
    if (!authUser(db, body.sessionToken)) return fail("SESSION_INVALID");
    return ok({ members: db.referralMembers || [] });
  }

  async function adminSaveReferralMember(body) {
    const db = await ensureDb();
    const auth = requireAdmin(db, body.sessionToken);
    if (auth.error) return auth.error;
    if (!db.referralMembers) db.referralMembers = [];

    const requestedId = cleanStr(body.member && body.member.id, 40);
    const index = db.referralMembers.findIndex((x) => x.id === requestedId);
    const id = index >= 0 ? requestedId : "m_" + randomSalt().slice(0, 10);
    const member = sanitizeReferralMember(body.member, id);
    if (!member.name) return fail("INVALID_REQUEST");
    member.editedAt = nowMs();

    if (index >= 0) db.referralMembers[index] = member;
    else db.referralMembers.push(member);
    saveDb(db);
    return ok({ member, created: index < 0 });
  }

  async function adminDeleteReferralMember(body) {
    const db = await ensureDb();
    const auth = requireAdmin(db, body.sessionToken);
    if (auth.error) return auth.error;
    const id = cleanStr(body.id, 40);
    const before = (db.referralMembers || []).length;
    db.referralMembers = (db.referralMembers || []).filter((x) => x.id !== id);
    if (db.referralMembers.length === before) return fail("INVALID_REQUEST");
    saveDb(db);
    return ok({});
  }

  async function adminImportReferralMembers(body) {
    const db = await ensureDb();
    const auth = requireAdmin(db, body.sessionToken);
    if (auth.error) return auth.error;
    if (!Array.isArray(body.members) || body.members.length > 500) return fail("INVALID_REQUEST");
    const seen = new Set();
    const members = [];
    body.members.forEach((raw) => {
      let id = cleanStr(raw && raw.id, 40);
      if (!id || seen.has(id)) id = "m_" + randomSalt().slice(0, 10);
      seen.add(id);
      const m = sanitizeReferralMember(raw, id);
      m.editedAt = nowMs();
      if (m.name) members.push(m);
    });
    db.referralMembers = members;
    saveDb(db);
    return ok({ count: members.length });
  }

  // ============================================
  // 紹介の記録(会員が自分の名義でのみ追加・取り消しできる)
  // ============================================

  function displayName(u) {
    return u.name || "会員";
  }

  async function recordReferral(body) {
    const db = await ensureDb();
    const me = authUser(db, body.sessionToken);
    if (!me) return fail("SESSION_INVALID");
    const memberId = cleanStr(body.toMemberId, 40);
    const member = (db.referralMembers || []).find((m) => m.id === memberId);
    if (!member) return fail("INVALID_REQUEST");
    if (member.id === me.memberId) return fail("SELF_REFERRAL");
    const log = {
      id: "r_" + randomSalt().slice(0, 12),
      fromUserId: me.userId,
      toMemberId: member.id,
      prospect: cleanStr(body.prospect, 60),
      topics: cleanList(body.topics, idsOf(typeof TOPICS === "undefined" ? undefined : TOPICS), 10),
      at: nowMs(),
    };
    db.referralLogs.push(log);
    saveDb(db);
    return ok({ log });
  }

  async function deleteReferral(body) {
    const db = await ensureDb();
    const me = authUser(db, body.sessionToken);
    if (!me) return fail("SESSION_INVALID");
    const id = cleanStr(body.id, 40);
    const log = db.referralLogs.find((l) => l.id === id);
    if (!log || log.fromUserId !== me.userId) return fail("INVALID_REQUEST");
    db.referralLogs = db.referralLogs.filter((l) => l.id !== id);
    saveDb(db);
    return ok({});
  }

  async function getReferralStats(body) {
    const db = await ensureDb();
    const me = authUser(db, body.sessionToken);
    if (!me) return fail("SESSION_INVALID");
    const logs = db.referralLogs;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const received = {};
    const byGiver = {};
    logs.forEach((l) => {
      received[l.toMemberId] = (received[l.toMemberId] || 0) + 1;
      byGiver[l.fromUserId] = (byGiver[l.fromUserId] || 0) + 1;
    });
    const ranking = Object.entries(byGiver)
      .map(([userId, count]) => {
        const u = db.users.find((x) => x.userId === userId);
        return { name: u ? displayName(u) : "退会した会員", count, isMe: userId === me.userId };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const memberName = (id) => ((db.referralMembers || []).find((m) => m.id === id) || {}).name || "(削除されたメンバー)";
    const mine = logs.filter((l) => l.fromUserId === me.userId);

    return ok({
      myCount: mine.length,
      totalCount: logs.length,
      monthCount: logs.filter((l) => l.at >= monthStart.getTime()).length,
      received,
      ranking,
      myRecent: mine
        .slice(-5)
        .reverse()
        .map((l) => ({ id: l.id, toName: memberName(l.toMemberId), prospect: l.prospect, at: l.at })),
    });
  }

  const ACTIONS = {
    passcodeLogin, verifySession, logout,
    listReferralMembers, adminSaveReferralMember, adminDeleteReferralMember, adminImportReferralMembers,
    recordReferral, deleteReferral, getReferralStats,
  };

  async function handle(body) {
    try {
      if (!body || typeof body !== "object" || !body.action) return fail("INVALID_REQUEST");
      const fn = ACTIONS[body.action];
      if (!fn) return fail("INVALID_ACTION");
      return await fn(body);
    } catch {
      return fail("SERVER_ERROR");
    }
  }

  return { handle, ERRORS };
})();
