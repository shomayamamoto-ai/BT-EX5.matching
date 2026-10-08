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
  const SCREENS = {
    home: "../",
    portal: "../portal/",
    referral: "../referral/",
    admin: "../admin/",
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
    } catch {
      /* noop */
    }
  }

  // 保護ページ用ガード(§6)。
  // トークンなし/無効 → トークン破棄のうえ ?next=<画面名> 付きでログインへ。
  // 元URLのパス・クエリ・ハッシュは引き継がない。
  // 有効ならサーバーが返した user を resolve する(表示は都度この結果を正とする §5.3)
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
    const result = await AuthApi.verifySession(token);
    if (!result.success) {
      clearToken();
      location.replace(loginUrl);
      return null;
    }
    return result.data;
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
