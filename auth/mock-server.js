// ============================================
// auth/mock-server.js — サーバー側判定のブラウザ内デモ実装
// 仕様: docs/specs/login-page-detailed-spec-v3.md §5, §8
//
// 本来は GAS 等のバックエンドが担う判定を、デモ用に同一契約・
// 同一判定順序でブラウザ内に実装したもの。実 API へ移行する場合は
// api.js の API_BASE_URL を設定すればこのファイルは使われなくなる。
//
// 認証(§5.4/§5.5): 失敗理由は AUTH_FAILED / LOCKED の2種に集約し、
// 未登録アドレスにはダミー照合で時間を揃える。verifySession の失敗は
// SESSION_INVALID 単一コード。
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

  // サーバー由来エラー文言(§9: Response.gs ERRORS 相当)
  const ERRORS = {
    AUTH_FAILED: "メールアドレスまたはパスワードが正しくありません。",
    LOCKED: "ログインを一時的に制限しています。時間をおいて再度お試しください。",
    SESSION_INVALID: "セッションが無効です。もう一度ログインしてください。",
    INVALID_REQUEST: "リクエストの形式が正しくありません。",
    INVALID_ACTION: "不明な操作が指定されました。",
    FORBIDDEN_ADMIN: "この操作は管理者のみ行えます。",
    SERVER_ERROR: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
  };

  // デモ用アカウント(初回アクセス時に投入)
  const SEED_USERS = [
    {
      email: "demo@kouryukai.jp",
      password: "kouryukai-demo-2026",
      role: "member",
      name: "デモ 会員",
    },
  ];

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

  async function hashPassword(password, salt) {
    const data = new TextEncoder().encode(salt + ":" + password);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : randomSalt();
  }

  async function ensureDb() {
    let db = loadDb();
    if (!db || !db.users || !db.dummy) {
      db = { users: [], sessions: {}, referralLogs: [], dummy: null };
      for (const seed of SEED_USERS) {
        const salt = randomSalt();
        db.users.push({
          userId: "usr_" + uuid(),
          email: seed.email.toLowerCase(),
          role: seed.role,
          accountStatus: "active",
          subscriptionStatus: "active",
          paymentExempt: false,
          isAdmin: false,
          salt,
          passwordHash: await hashPassword(seed.password, salt),
          failureCount: 0,
          lockedUntil: 0,
          passwordChangedAt: 0,
          createdAt: nowMs(),
          name: seed.name,
        });
      }
      // 未登録アドレス用のダミー照合データ(§8 判定順序2)
      const dummySalt = randomSalt();
      db.dummy = { salt: dummySalt, hash: await hashPassword("dummy-password-for-timing", dummySalt) };
      saveDb(db);
    }

    // 旧バージョンDBからの移行: マッチング機能(サンプル会員・いいね・メッセージ)の
    // データを削除し、紹介の記録を用意する
    let migrated = false;
    if (db.users.some((u) => u.isBot)) { db.users = db.users.filter((u) => !u.isBot); migrated = true; }
    ["likes", "messages", "botsSeeded"].forEach((k) => { if (k in db) { delete db[k]; migrated = true; } });
    if (!db.referralLogs) { db.referralLogs = []; migrated = true; }

    // 紹介先早見表の名簿(名簿が未作成のときだけ初期名簿を投入)
    if (!db.referralMembers && typeof REF_SEED_MEMBERS !== "undefined") {
      db.referralMembers = JSON.parse(JSON.stringify(REF_SEED_MEMBERS));
      migrated = true;
    }

    // デモ会員を管理者にする(名簿の追加・編集用)
    const demo = db.users.find((u) => u.email === "demo@kouryukai.jp");
    if (demo && !demo.isAdmin) {
      demo.isAdmin = true;
      demo.role = "admin";
      migrated = true;
    }

    if (migrated) saveDb(db);
    return db;
  }

  function toPublicUser(u) {
    // §5.3: 公開7フィールドのみ。passwordHash / salt は含めない
    return {
      userId: u.userId,
      email: u.email,
      role: u.role,
      accountStatus: u.accountStatus,
      subscriptionStatus: u.subscriptionStatus,
      paymentExempt: u.paymentExempt,
      isAdmin: u.isAdmin,
    };
  }

  function ok(data) { return { success: true, data }; }
  function fail(code) {
    return {
      success: false,
      error: { code: code || "UNKNOWN", message: ERRORS[code] || ERRORS.SERVER_ERROR },
    };
  }

  // セッショントークンから利用者を解決(無効なら null)
  function authUser(db, token) {
    const session = db.sessions[String(token || "")];
    if (!session || session.revoked || session.expiresAt <= nowMs()) return null;
    const user = db.users.find((u) => u.userId === session.userId);
    if (!user || user.accountStatus !== "active") return null;
    if (!user.paymentExempt && user.subscriptionStatus !== "active") return null;
    if (user.passwordChangedAt && session.issuedAt < user.passwordChangedAt) return null;
    return user;
  }

  // ---------- login(判定順序は §8 に一致) ----------
  async function login(body) {
    const db = await ensureDb();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("AUTH_FAILED");
    }

    const user = db.users.find((u) => u.email === email);
    if (!user) {
      await hashPassword(password, db.dummy.salt);
      return fail("AUTH_FAILED");
    }

    if (user.lockedUntil > nowMs()) {
      return fail("LOCKED");
    }

    if (user.accountStatus !== "active") {
      await hashPassword(password, db.dummy.salt);
      return fail("AUTH_FAILED");
    }

    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      user.failureCount += 1;
      if (user.failureCount >= LOGIN_FAILURE_LIMIT) {
        user.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000;
        user.failureCount = 0;
        saveDb(db);
        return fail("LOCKED");
      }
      saveDb(db);
      return fail("AUTH_FAILED");
    }

    if (!user.paymentExempt && user.subscriptionStatus !== "active") {
      return fail("AUTH_FAILED");
    }

    // Session fixation 対策(§7): 成功のたびに必ず新規トークンを発行
    user.failureCount = 0;
    user.lockedUntil = 0;

    // remember は === true の厳密判定(§5.2)。
    // Boolean()正規化は不可。Boolean("false")===true となり
    // 30日セッションが誤発行される(docs/specs §14)
    const remember = body.remember === true;
    const ttlMs = remember
      ? SESSION_REMEMBER_DAYS * 24 * 60 * 60 * 1000
      : SESSION_TTL_HOURS * 60 * 60 * 1000;

    const token = randomToken();
    db.sessions[token] = {
      userId: user.userId,
      issuedAt: nowMs(),
      expiresAt: nowMs() + ttlMs,
      remember,
      revoked: false,
      userAgent: String(body.userAgent || "").slice(0, 300),
    };
    saveDb(db);

    return ok({
      sessionToken: token,
      expiresAt: new Date(nowMs() + ttlMs).toISOString(),
      remember,
      user: toPublicUser(user),
    });
  }

  // ---------- verifySession(失敗は常に SESSION_INVALID §5.5) ----------
  async function verifySession(body) {
    const db = await ensureDb();
    const token = String(body.sessionToken || "");
    const session = db.sessions[token];
    const user = authUser(db, token);
    if (!session || !user) return fail("SESSION_INVALID");

    // 期限判定はサーバー時刻のみ・検証時の延長は行わない(§8)
    return ok({
      expiresAt: new Date(session.expiresAt).toISOString(),
      remember: session.remember,
      user: toPublicUser(user),
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

  // ---------- register(デモ用の新規会員登録) ----------
  // パスワードポリシー(§8 参考): 12〜128文字 / 空白のみ禁止 / 同一文字の繰り返しのみ禁止
  function validatePasswordStrength(password) {
    if (typeof password !== "string" || password.length < 12) {
      return "パスワードは12文字以上で入力してください。";
    }
    if (password.length > 128) {
      return "パスワードは128文字以内で入力してください。";
    }
    if (!password.trim()) {
      return "パスワードに空白以外の文字を含めてください。";
    }
    if (/^(.)\1+$/.test(password)) {
      return "同じ文字の繰り返しのみのパスワードは使用できません。";
    }
    return null;
  }

  async function register(body) {
    const db = await ensureDb();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 40);
    const password = String(body.password || "");

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("INVALID_REQUEST");
    }
    const weak = validatePasswordStrength(password);
    if (weak) {
      return { success: false, error: { code: "WEAK_PASSWORD", message: weak } };
    }
    if (db.users.some((u) => u.email === email)) {
      return {
        success: false,
        error: { code: "REGISTER_FAILED", message: "このメールアドレスでは登録できません。ログインまたはパスワード再設定をお試しください。" },
      };
    }

    const salt = randomSalt();
    db.users.push({
      userId: "usr_" + uuid(),
      email,
      role: "member",
      accountStatus: "active",
      subscriptionStatus: "active",
      paymentExempt: false,
      isAdmin: false,
      salt,
      passwordHash: await hashPassword(password, salt),
      failureCount: 0,
      lockedUntil: 0,
      passwordChangedAt: 0,
      createdAt: nowMs(),
      name,
    });
    saveDb(db);

    // 登録後は自動ログイン(通常セッション12時間)
    return login({ email, password, remember: false, userAgent: body.userAgent });
  }

  // ---------- requestPasswordReset(常時成功応答:列挙耐性) ----------
  async function requestPasswordReset() {
    await ensureDb();
    return ok({
      message: "入力されたメールアドレス宛に、再設定のご案内を送信しました(登録がある場合)。",
    });
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
    const user = authUser(db, token);
    if (!user) return { error: fail("SESSION_INVALID") };
    if (!user.isAdmin) return { error: fail("FORBIDDEN_ADMIN") };
    return { user };
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
    login, verifySession, logout, register, requestPasswordReset,
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
