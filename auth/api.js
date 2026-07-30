// ============================================
// auth/api.js — 通信の唯一の窓口
// 仕様: docs/specs/login-page-detailed-spec-v3.md §5
//
// 画面コードからの fetch 直呼びは禁止。将来別基盤へ移行する場合の
// 変換点はこのファイルに限定する(§5.1)。
// API_BASE_URL を設定すると text/plain POST で実 API を呼ぶ。
// 空文字の間は auth/mock-server.js のデモ実装を使用する。
// ============================================

const AuthApi = (function () {
  "use strict";

  const API_BASE_URL = ""; // 実バックエンド(GAS 等)の URL。空ならデモ実装を使用

  const NETWORK_MESSAGE = "通信に失敗しました。ネットワーク環境をご確認のうえ、再度お試しください。";

  // 既知のエラーコード(§5.4 / §5.5 / 入口・例外側)
  const KNOWN_CODES = new Set([
    "AUTH_FAILED", "LOCKED", "SESSION_INVALID",
    "INVALID_REQUEST", "INVALID_ACTION", "RATE_LIMITED", "SERVER_ERROR",
  ]);

  // §5.6 フォールバック: message 欠落・未知コード → NETWORK_MESSAGE
  function readResult(json) {
    if (json && json.success === true) {
      return { success: true, data: json.data || {} };
    }
    const err = (json && json.error) || {};
    const code = KNOWN_CODES.has(err.code) ? err.code : "NETWORK";
    const userMessage =
      code !== "NETWORK" && typeof err.message === "string" && err.message
        ? err.message
        : NETWORK_MESSAGE;
    return { success: false, error: { code, userMessage } };
  }

  async function post(action, payload) {
    // userAgent は全 POST に自動付与(ログ用途のみ・最大300文字)。
    // GASのdoPost(e)はHTTPヘッダーを受け取れないため、サーバー側でUA取得は不可能(docs/specs §14)
    const body = Object.assign({}, payload, {
      action,
      userAgent: String((navigator && navigator.userAgent) || "").slice(0, 300),
    });

    if (!API_BASE_URL) {
      const json = await AuthMockServer.handle(body);
      return readResult(json);
    }

    try {
      // application/json はプリフライトを発生させるため text/plain を用いる(§5)
      const res = await fetch(API_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return { success: false, error: { code: "NETWORK", userMessage: NETWORK_MESSAGE } };
      }
      return readResult(await res.json());
    } catch {
      return { success: false, error: { code: "NETWORK", userMessage: NETWORK_MESSAGE } };
    }
  }

  // remember はここでも === true の厳密判定で boolean を保証する(§5.2 の3層判定)
  function login(email, password, remember) {
    return post("login", { email, password, remember: remember === true });
  }
  function verifySession(sessionToken) {
    return post("verifySession", { sessionToken });
  }
  function logout(sessionToken) {
    return post("logout", { sessionToken });
  }
  function requestPasswordReset(email) {
    return post("requestPasswordReset", { email });
  }

  return { login, verifySession, logout, requestPasswordReset, NETWORK_MESSAGE };
})();
