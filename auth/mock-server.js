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
// メッセージング: いいね・マッチング・メッセージはすべてこの層で
// アクセス制御する。メッセージの閲覧・送信は「相互いいね(マッチング)
// 成立済みの2者」のみに許可し、それ以外は FORBIDDEN を返す。
// データは localStorage の共有DBに保存し、書き込みのたびに
// BroadcastChannel で通知することで別タブへ即時反映される。
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
    FORBIDDEN: "マッチングした相手とのみメッセージのやり取りができます。",
    SERVER_ERROR: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
  };

  // デモ用アカウント(初回アクセス時に投入)
  const SEED_USERS = [
    {
      email: "demo@kouryukai.jp",
      password: "kouryukai-demo-2026",
      role: "member",
      name: "デモ 会員",
      category: "経営者",
      avatar: "😀",
      bio: "デモ用のアカウントです。よろしくお願いします!",
    },
  ];

  // いいねを返してくれるサンプルメンバー(旧 INCOMING_LIKES 相当)
  const AUTO_LIKE_BOT_IDS = new Set([2, 4, 5, 8, 11, 15]);

  // サンプルメンバーの自動返信(デモ用)
  const AUTO_REPLIES = [
    { text: "メッセージありがとうございます!ぜひ今度お話しましょう。" },
    { text: "👍", stamp: true },
    { text: "こちらこそよろしくお願いします。次回の交流会には参加されますか?" },
    { text: "興味あります!詳しく聞かせてください。" },
    { text: "🙏", stamp: true },
    { text: "ありがとうございます。今度ランチでもいかがですか?" },
    { text: "いいですね!日程候補をいくつか送ってもらえますか?" },
  ];

  const HUMAN_AVATARS = ["😀", "😄", "🙂", "😎", "🤗", "🧑‍💼", "👩‍💼", "🤠"];

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

  function strHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  async function ensureDb() {
    let db = loadDb();
    if (!db || !db.users || !db.dummy) {
      db = { users: [], sessions: {}, likes: [], messages: {}, dummy: null, botsSeeded: false };
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
          isBot: false,
          name: seed.name,
          category: seed.category,
          avatar: seed.avatar,
          tags: [],
          bio: seed.bio,
          interest: "",
          isNew: false,
          isPickup: false,
        });
      }
      // 未登録アドレス用のダミー照合データ(§8 判定順序2)
      const dummySalt = randomSalt();
      db.dummy = { salt: dummySalt, hash: await hashPassword("dummy-password-for-timing", dummySalt) };
      saveDb(db);
    }

    // 旧バージョンDBからの移行
    let migrated = false;
    if (!db.likes) { db.likes = []; migrated = true; }
    if (!db.messages) { db.messages = {}; migrated = true; }

    // サンプルメンバー(ボット)の投入。data.js の MEMBERS が読み込まれて
    // いるページ(アプリ本体)で初回に行う
    if (!db.botsSeeded && typeof MEMBERS !== "undefined") {
      for (const m of MEMBERS) {
        if (db.users.some((u) => u.userId === "usr_bot_" + m.id)) continue;
        db.users.push({
          userId: "usr_bot_" + m.id,
          email: "member" + m.id + "@kouryukai.jp",
          role: "member",
          accountStatus: "active",
          subscriptionStatus: "active",
          paymentExempt: false,
          isAdmin: false,
          salt: "",
          passwordHash: "",
          failureCount: 0,
          lockedUntil: 0,
          passwordChangedAt: 0,
          createdAt: 0,
          isBot: true,
          botId: m.id,
          name: m.name,
          company: m.company,
          category: m.category,
          avatar: m.avatar,
          tags: m.tags,
          bio: m.bio,
          interest: m.interest,
          isNew: m.isNew,
          isPickup: m.isPickup,
        });
      }
      db.botsSeeded = true;
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

    const user = db.users.find((u) => u.email === email && !u.isBot);
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
    const category = String(body.category || "").trim().slice(0, 20) || "会員";
    const bio = String(body.bio || "").trim().slice(0, 300);

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("INVALID_REQUEST");
    }
    const weak = validatePasswordStrength(password);
    if (weak) {
      return { success: false, error: { code: "WEAK_PASSWORD", message: weak } };
    }
    if (db.users.some((u) => u.email === email && !u.isBot)) {
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
      isBot: false,
      name,
      category,
      avatar: HUMAN_AVATARS[strHash(email) % HUMAN_AVATARS.length],
      tags: [],
      bio,
      interest: "",
      isNew: true,
      isPickup: false,
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
  // ここから いいね・マッチング・メッセージ
  // ============================================

  function convKey(a, b) { return [a, b].sort().join("__"); }
  function likeExists(db, from, to) {
    return db.likes.some((l) => l.from === from && l.to === to);
  }
  function isMutual(db, a, b) {
    return likeExists(db, a, b) && likeExists(db, b, a);
  }

  // 一覧表示用のメンバー情報(パスワード関連・メールは含めない)
  function toMemberView(db, me, u) {
    return {
      userId: u.userId,
      name: u.name || "会員",
      company: u.company || "",
      category: u.category || "会員",
      avatar: u.avatar || "🙂",
      tags: u.tags || [],
      bio: u.bio || "",
      interest: u.interest || "",
      isNew: !!u.isNew,
      isPickup: !!u.isPickup,
      isBot: !!u.isBot,
      createdAt: u.createdAt || 0,
      likedByMe: likeExists(db, me.userId, u.userId),
      likesMe: likeExists(db, u.userId, me.userId),
      matched: isMutual(db, me.userId, u.userId),
    };
  }

  // ---------- listMembers(要ログイン) ----------
  async function listMembers(body) {
    const db = await ensureDb();
    const me = authUser(db, body.sessionToken);
    if (!me) return fail("SESSION_INVALID");
    return ok({
      members: db.users
        .filter((u) => u.userId !== me.userId)
        .map((u) => toMemberView(db, me, u)),
    });
  }

  // ---------- sendLike(いいねのトグル) ----------
  async function sendLike(body) {
    const db = await ensureDb();
    const me = authUser(db, body.sessionToken);
    if (!me) return fail("SESSION_INVALID");
    const target = db.users.find((u) => u.userId === String(body.toUserId || ""));
    if (!target || target.userId === me.userId) return fail("INVALID_REQUEST");

    const idx = db.likes.findIndex((l) => l.from === me.userId && l.to === target.userId);
    let liked;
    if (idx >= 0) {
      db.likes.splice(idx, 1);
      liked = false;
    } else {
      db.likes.push({ from: me.userId, to: target.userId, at: nowMs() });
      liked = true;
      // デモ: 一部のサンプルメンバーはいいねを返してくれる
      if (target.isBot && AUTO_LIKE_BOT_IDS.has(target.botId) && !likeExists(db, target.userId, me.userId)) {
        db.likes.push({ from: target.userId, to: me.userId, at: nowMs() });
      }
    }
    saveDb(db);
    return ok({ liked, matched: isMutual(db, me.userId, target.userId) });
  }

  // ---------- getMatches(マッチ済み相手と未読数) ----------
  async function getMatches(body) {
    const db = await ensureDb();
    const me = authUser(db, body.sessionToken);
    if (!me) return fail("SESSION_INVALID");
    const matches = db.users
      .filter((u) => u.userId !== me.userId && isMutual(db, me.userId, u.userId))
      .map((u) => {
        const conv = db.messages[convKey(me.userId, u.userId)] || [];
        const last = conv[conv.length - 1] || null;
        return Object.assign(toMemberView(db, me, u), {
          lastMessage: last
            ? { text: last.text, stamp: !!last.stamp, at: last.at, mine: last.from === me.userId }
            : null,
          unreadCount: conv.filter((msg) => msg.from !== me.userId && !msg.read).length,
        });
      });
    return ok({ matches });
  }

  // サンプルメンバーの自動返信(最後の発言が相手からで1.2秒以上経過していたら返す)
  function maybeBotReply(db, conv, bot) {
    if (!conv.length) return false;
    const last = conv[conv.length - 1];
    if (last.from === bot.userId) return false;
    if (nowMs() - last.at < 1200) return false;
    const replyCount = conv.filter((m) => m.from === bot.userId).length;
    const reply = AUTO_REPLIES[replyCount % AUTO_REPLIES.length];
    conv.push({ from: bot.userId, text: reply.text, stamp: !!reply.stamp, at: nowMs(), read: false });
    conv.forEach((m) => { if (m.from !== bot.userId) m.read = true; });
    return true;
  }

  // ---------- sendMessage(マッチング相手のみ) ----------
  async function sendMessage(body) {
    const db = await ensureDb();
    const me = authUser(db, body.sessionToken);
    if (!me) return fail("SESSION_INVALID");
    const target = db.users.find((u) => u.userId === String(body.toUserId || ""));
    const text = String(body.text || "").trim().slice(0, 2000);
    if (!target || target.userId === me.userId || !text) return fail("INVALID_REQUEST");
    // アクセス制御: マッチング(相互いいね)済みの相手以外には送信できない
    if (!isMutual(db, me.userId, target.userId)) return fail("FORBIDDEN");

    const key = convKey(me.userId, target.userId);
    if (!db.messages[key]) db.messages[key] = [];
    db.messages[key].push({
      from: me.userId,
      text,
      stamp: body.stamp === true,
      at: nowMs(),
      read: false,
    });
    saveDb(db);
    return ok({});
  }

  // ---------- getMessages(マッチング相手のみ・取得時に既読化) ----------
  async function getMessages(body) {
    const db = await ensureDb();
    const me = authUser(db, body.sessionToken);
    if (!me) return fail("SESSION_INVALID");
    const target = db.users.find((u) => u.userId === String(body.toUserId || ""));
    if (!target || target.userId === me.userId) return fail("INVALID_REQUEST");
    // アクセス制御: マッチング相手以外の会話は閲覧できない
    if (!isMutual(db, me.userId, target.userId)) return fail("FORBIDDEN");

    const key = convKey(me.userId, target.userId);
    const conv = db.messages[key] || (db.messages[key] = []);

    let changed = false;
    if (target.isBot) changed = maybeBotReply(db, conv, target) || changed;
    // 自分宛のメッセージを既読化(相手側には「既読」として反映される)
    conv.forEach((msg) => {
      if (msg.from !== me.userId && !msg.read) { msg.read = true; changed = true; }
    });
    if (changed) saveDb(db);

    return ok({
      messages: conv.map((msg) => ({
        mine: msg.from === me.userId,
        text: msg.text,
        stamp: !!msg.stamp,
        at: msg.at,
        read: !!msg.read,
      })),
    });
  }

  const ACTIONS = {
    login, verifySession, logout, register, requestPasswordReset,
    listMembers, sendLike, getMatches, sendMessage, getMessages,
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
