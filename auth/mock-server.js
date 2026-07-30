// ============================================
// auth/mock-server.js — サーバー側判定のブラウザ内デモ実装
// 仕様: docs/specs/login-page-detailed-spec-v3.md §5, §8
//
// 本来は GAS 等のバックエンドが担う判定を、デモ用に同一契約・
// 同一判定順序でブラウザ内に実装したもの。実 API へ移行する場合は
// api.js の API_BASE_URL を設定すればこのファイルは使われなくなる。
//
// アカウント列挙耐性(§5.4): 失敗理由は AUTH_FAILED / LOCKED の
// 2種に集約し、未登録アドレスにはダミー照合で時間を揃える。
// verifySession の失敗は常に SESSION_INVALID 単一コード(§5.5)。
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
    SERVER_ERROR: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
  };

  // デモ用アカウント(初回アクセス時に投入)
  const SEED_USERS = [
    { email: "demo@kouryukai.jp", password: "kouryukai-demo-2026", role: "member" },
  ];

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
    return crypto.randomUUID
      ? crypto.randomUUID()
      : randomSalt();
  }

  async function ensureDb() {
    let db = loadDb();
    if (db && db.users && db.dummy) return db;
    db = { users: [], sessions: {}, dummy: null };
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
      });
    }
    // 未登録アドレス用のダミー照合データ(§8 判定順序2)
    const dummySalt = randomSalt();
    db.dummy = { salt: dummySalt, hash: await hashPassword("dummy-password-for-timing", dummySalt) };
    saveDb(db);
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

  // ---------- login(判定順序は §8 に一致) ----------
  async function login(body) {
    const db = await ensureDb();

    // 1. メール正規化 / 形式不正は AUTH_FAILED に集約(§5.4)
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("AUTH_FAILED");
    }

    // 2. ユーザー検索(不在時はダミー照合で同時間消費・利用者行は作らない)
    const user = db.users.find((u) => u.email === email);
    if (!user) {
      await hashPassword(password, db.dummy.salt);
      return fail("AUTH_FAILED");
    }

    // 3. ロック確認(照合せず終了)
    if (user.lockedUntil > nowMs()) {
      return fail("LOCKED");
    }

    // 4. アカウント状態
    if (user.accountStatus !== "active") {
      await hashPassword(password, db.dummy.salt);
      return fail("AUTH_FAILED");
    }

    // 5. パスワード照合(不一致で失敗回数+1、上限到達でロック)
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

    // 6-7. payment_exempt / subscription_status
    if (!user.paymentExempt && user.subscriptionStatus !== "active") {
      return fail("AUTH_FAILED");
    }

    // 8. セッション発行。
    // Session fixation 対策(§7): 既存トークンは一切再利用せず、
    // 成功のたびに必ず新規の暗号学的ランダムトークンを発行する
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
    if (!session) return fail("SESSION_INVALID");
    if (session.revoked) return fail("SESSION_INVALID");
    if (session.expiresAt <= nowMs()) return fail("SESSION_INVALID");

    const user = db.users.find((u) => u.userId === session.userId);
    if (!user || user.accountStatus !== "active") return fail("SESSION_INVALID");
    if (!user.paymentExempt && user.subscriptionStatus !== "active") return fail("SESSION_INVALID");
    // パスワード変更時の全失効(§12): 変更前に発行されたセッションは無効
    if (user.passwordChangedAt && session.issuedAt < user.passwordChangedAt) {
      return fail("SESSION_INVALID");
    }

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
    const name = String(body.name || "").trim();
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
    const user = {
      userId: "usr_" + uuid(),
      email,
      name,
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
    };
    db.users.push(user);
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

  const ACTIONS = { login, verifySession, logout, requestPasswordReset, register };

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
