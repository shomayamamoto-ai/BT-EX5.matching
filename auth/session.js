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
  // home(トップ=アプリ本体)は §6 の手順(guardPage明示指定+リスト追加)で追加した保護画面
  const ALLOWED_NEXT = ["portal", "home"];
  const DEFAULT_NEXT = "home";

  // 画面名 → ログインページからの相対パス
  const SCREEN_PATHS = {
    portal: "../portal/",
    home: "../",
  };

  function safeNextName(value) {
    return ALLOWED_NEXT.indexOf(value) !== -1 ? value : DEFAULT_NEXT;
  }

  function screenPath(name) {
    return SCREEN_PATHS[safeNextName(name)];
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

  function getToken() {
    try {
      return localStorage.getItem(SESSION_KEY) || "";
    } catch {
      return "";
    }
  }

  function saveToken(token) {
    localStorage.setItem(SESSION_KEY, token);
  }

  function clearToken() {
    try {
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
