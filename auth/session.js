// ============================================
// auth/session.js — セッション保存とページガード
// 仕様: docs/specs/login-page-detailed-spec-v3.md §6, §7
//
// 保存はこのファイル経由のみ。保存するのはトークン文字列のみで、
// expiresAt / remember / user は localStorage に置かない(§7)。
// 期限・有効性の判断はサーバー(verifySession)のみが行い、
// クライアント側の値を認可判断に使わない(§11)。
// ============================================

const AuthSession = (function () {
  "use strict";

  const SESSION_KEY = "kouryukai-auth-session";

  // 許可リスト方式(§6)。任意URL・任意パスは恒久的に受け取らない。
  // ログイン直後に外部サイトへ遷移させるオープンリダイレクトを構造的に排除する。
  // 保護対象画面が3つを超えたため、§6 の将来拡張どおり ALLOWED_NEXT は
  // 画面定義(SCREENS)から導出する。画面の追加はここに1行足すだけでよい
  // home(サイトの入口)は紹介先早見表
  const SCREENS = {
    home: "../app/",
    app: "../app/",
    portal: "../app/",
    referral: "../referral/",
    admin: "../admin/",
    profile: "../profile/",
    teams: "../teams/",
  };
  const ALLOWED_NEXT = Object.keys(SCREENS);
  const DEFAULT_NEXT = "home";

  function safeNextName(value) {
    return ALLOWED_NEXT.indexOf(value) !== -1 ? value : DEFAULT_NEXT;
  }

  function screenPath(name) {
    return SCREENS[safeNextName(name)];
  }

  function storageAvailable() {
    try {
      const probe = "__kouryukai_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  // トークンはタブ単位(sessionStorage)を優先し、localStorage を
  // フォールバックにする。これにより同一ブラウザの別タブで別アカウントに
  // 同時ログインでき(タブごとに独立したセッション)、新しいタブや
  // ブラウザ再起動後は直近ログインのトークンを引き継げる。
  function getToken() {
    try {
      const tabToken = sessionStorage.getItem(SESSION_KEY);
      if (tabToken) return tabToken;
      const shared = localStorage.getItem(SESSION_KEY) || "";
      if (shared) sessionStorage.setItem(SESSION_KEY, shared);
      return shared;
    } catch {
      return "";
    }
  }

  function saveToken(token) {
    sessionStorage.setItem(SESSION_KEY, token);
    localStorage.setItem(SESSION_KEY, token);
  }

  function clearToken() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem("btex5-my-name");
      sessionStorage.removeItem("btex5-badges");
      localStorage.removeItem(VERIFY_CACHE);
      localStorage.removeItem("btex5-members-cache");
      localStorage.removeItem("btex5-view-cache");
    } catch {
      /* noop */
    }
  }

  // 保護ページ用ガード(§6)。
  // トークンなし/無効 → トークン破棄のうえ ?next=<画面名> 付きでログインへ。
  // 元URLのパス・クエリ・ハッシュは引き継がない。
  // 有効ならサーバーが返した user を resolve する(表示は都度この結果を正とする §5.3)
  // すぐ開くための控え: 前回サーバーが「有効」と答えた結果(名前・管理者かどうか・期限)を、トークンの「しるし」と一緒に置いておく。
  // 次に開いたときはこれで先に画面を出し、サーバーの確認は裏で行う(無効なら、その時点でログインへ)。
  // パスワード・メールアドレスは入っていない。期限の判断は、これまでどおりサーバーだけが行う
  const VERIFY_CACHE = "btex5-verify-cache";
  const VERIFY_TTL = 12 * 3600 * 1000;
  function tokenMark(t) { let x = 2166136261; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36) + t.length; }
  function readVerify(token) {
    try {
      const c = JSON.parse(localStorage.getItem(VERIFY_CACHE) || "null");
      if (!c || c.k !== tokenMark(token) || Date.now() - c.at > VERIFY_TTL) return null;
      if (!c.data || (c.data.expiresAt && new Date(c.data.expiresAt).getTime() < Date.now())) return null;
      return c.data;
    } catch { return null; }
  }
  function writeVerify(token, data) {
    try { localStorage.setItem(VERIFY_CACHE, JSON.stringify({ k: tokenMark(token), at: Date.now(), data })); } catch { /* noop */ }
  }

  async function guardPage(options) {
    const next = safeNextName(options && options.next);
    // loginPath: 呼び出しページからログインページへの相対パス(既定 ../login/)
    const loginPath = (options && options.loginPath) || "../login/";
    const loginUrl = loginPath + "?next=" + encodeURIComponent(next);
    const token = getToken();
    if (!token) {
      location.replace(loginUrl);
      return null;
    }
    // 前回の確認結果があれば、それですぐ開く(サーバーの確認は裏で。無効ならログインへ)
    const cached = readVerify(token);
    if (cached) {
      AuthApi.verifySession(token).then((r) => {
        if (r.success) writeVerify(token, r.data);
        else if (r.error && r.error.code === "SESSION_INVALID") { clearToken(); location.replace(loginUrl); }
      });
      return cached;
    }
    const result = await AuthApi.verifySession(token);
    if (!result.success) {
      // ログインが切れた(無効なトークン)ときだけ、ログイン画面へ。
      // 電波が弱い・サーバーが混んでいるだけのときは、ログインしたまま「もう一度」を出す
      if (result.error && result.error.code === "SESSION_INVALID") {
        clearToken();
        location.replace(loginUrl);
      } else {
        showOffline(result.error && result.error.userMessage);
      }
      return null;
    }
    writeVerify(token, result.data);
    return result.data;
  }

  // 通信できなかったときの画面(ログインは消さない)
  function showOffline(message) {
    const box = document.createElement("div");
    box.className = "auth-offline";
    box.setAttribute("role", "alert");
    box.style.cssText = "position:fixed;inset:0;z-index:300;display:grid;place-content:center;gap:14px;padding:24px;text-align:center;background:#f6f2ea;color:#2a211b;font:500 15px/1.7 'Noto Sans JP',sans-serif";
    const title = document.createElement("p");
    title.style.cssText = "margin:0;font-size:18px;font-weight:800";
    title.textContent = "いまサーバーにつながりません";
    const text = document.createElement("p");
    text.style.cssText = "margin:0;color:#6b5d50";
    text.textContent = (message || "通信に失敗しました。") + " ログインはそのままです。電波のよい場所で、もう一度お試しください。";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "もう一度読み込む";
    btn.style.cssText = "justify-self:center;padding:12px 22px;border-radius:999px;border:none;background:#1a120c;color:#f6e7c4;font:800 15px 'Noto Sans JP',sans-serif;cursor:pointer";
    btn.addEventListener("click", () => location.reload());
    box.append(title, text, btn);
    document.body.appendChild(box);
  }

  return {
    SESSION_KEY,
    ALLOWED_NEXT,
    safeNextName,
    screenPath,
    storageAvailable,
    getToken,
    saveToken,
    clearToken,
    guardPage,
  };
})();
