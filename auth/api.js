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

  // 既知のエラーコード(§5.4 / §5.5 / 入口・例外側 / 名簿・紹介の記録用)
  const KNOWN_CODES = new Set([
    "AUTH_FAILED", "LOCKED", "SESSION_INVALID",
    "INVALID_REQUEST", "INVALID_ACTION", "RATE_LIMITED", "SERVER_ERROR",
    "FORBIDDEN_ADMIN", "SELF_REFERRAL",
    "ACCOUNT_FAILED", "INVITE_INVALID", "PASSWORD_WEAK", "PASSCODE_DISABLED", "NOT_FOUND", "CHECKIN_FAILED",
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

  // memberId を省くと、パスコードが正しい場合に名簿の名前一覧が返る。
  // remember はここでも === true の厳密判定で boolean を保証する(§5.2 の3層判定)
  function passcodeLogin(passcode, memberId, remember) {
    return post("passcodeLogin", { passcode, memberId: memberId || "", remember: remember === true });
  }
  function verifySession(sessionToken) {
    return post("verifySession", { sessionToken });
  }
  function logout(sessionToken) {
    return post("logout", { sessionToken });
  }

  // ---------- 紹介先早見表の名簿(追加・編集・削除は管理者のみ) ----------
  function listReferralMembers(sessionToken) {
    return post("listReferralMembers", { sessionToken });
  }
  // 本人によるプロフィール編集(名前・所属チーム以外)
  function updateMyProfile(sessionToken, profile) {
    return post("updateMyProfile", { sessionToken, profile });
  }
  function adminSaveReferralMember(sessionToken, member) {
    return post("adminSaveReferralMember", { sessionToken, member });
  }
  function adminDeleteReferralMember(sessionToken, id) {
    return post("adminDeleteReferralMember", { sessionToken, id });
  }
  function adminImportReferralMembers(sessionToken, members) {
    return post("adminImportReferralMembers", { sessionToken, members });
  }

  // ---------- 紹介の記録 ----------
  function recordReferral(sessionToken, toMemberId, prospect, topics, memo, contact) {
    return post("recordReferral", { sessionToken, toMemberId, prospect, topics, memo: memo || "", contact: contact || "" });
  }
  // 紹介を受けた本人が対応状況を更新する(new / contacted / won / lost)
  function updateReferralStatus(sessionToken, id, status) {
    return post("updateReferralStatus", { sessionToken, id, status });
  }
  function deleteReferral(sessionToken, id) {
    return post("deleteReferral", { sessionToken, id });
  }
  function getReferralStats(sessionToken) {
    return post("getReferralStats", { sessionToken });
  }

  // ---------- 会員アカウント ----------
  function accountLogin(name, password, remember) {
    return post("accountLogin", { name, password, remember: remember === true });
  }
  function inviteInfo(code) {
    return post("inviteInfo", { code });
  }
  function activateAccount(code, password, remember) {
    return post("activateAccount", { code, password, remember: remember === true });
  }
  function loginOptions() {
    return post("loginOptions", {});
  }

  // ---------- そのほかの操作(定例会・掲示板など)。ログイン中のトークンを自動で付ける ----------
  function call(action, payload) {
    let sessionToken = "";
    try { sessionToken = typeof AuthSession !== "undefined" ? AuthSession.getToken() : ""; } catch { sessionToken = ""; }
    return post(action, Object.assign({ sessionToken }, payload || {}));
  }

  return {
    passcodeLogin, verifySession, logout,
    accountLogin, inviteInfo, activateAccount, loginOptions, call,
    listReferralMembers, updateMyProfile,
    adminSaveReferralMember, adminDeleteReferralMember, adminImportReferralMembers,
    recordReferral, deleteReferral, updateReferralStatus, getReferralStats,
    isShared: () => Boolean(API_BASE_URL),
    NETWORK_MESSAGE,
  };
})();

// 電波の弱い会場でも開けるよう、サービスワーカー(/sw.js)を登録する
(function () {
  if (!("serviceWorker" in navigator)) return;
  const script = document.currentScript;
  if (!script) return;
  const swUrl = new URL("../sw.js", script.src);
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(swUrl.href, { scope: new URL("../", script.src).pathname }).catch(() => {});
  });
})();
