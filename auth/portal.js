// ============================================
// auth/portal.js — 保護ページ(マイページ)のロジック
// 仕様: docs/specs/login-page-detailed-spec-v3.md §6, §7
// 表示内容は毎回 verifySession の結果を正とする(§5.3)。
// user を localStorage へ保存しない。
// ============================================

(function () {
  "use strict";

  const statusEl = document.getElementById("portal-status");
  const contentEl = document.getElementById("portal-content");
  const messageEl = document.getElementById("portal-message");

  const ROLE_LABELS = { member: "一般会員", admin: "管理者" };

  (async function init() {
    // guardPage: 無効ならログインページへ遷移して戻らない(§6)
    const data = await AuthSession.guardPage({ next: "portal" });
    if (!data) return;

    // 未サニタイズ innerHTML は使わない。textContent のみ(§11)
    document.getElementById("portal-name").textContent = data.displayName || "";
    document.getElementById("portal-role").textContent =
      ROLE_LABELS[data.user.role] || data.user.role;
    // expiresAt は表示・参考値に限定(§5.3)。認可判断には使わない
    document.getElementById("portal-expires").textContent = new Date(
      data.expiresAt
    ).toLocaleString("ja-JP");

    statusEl.textContent = "ログイン中です。";
    contentEl.hidden = false;
  })();

  document.getElementById("logout-button").addEventListener("click", async () => {
    const token = AuthSession.getToken();
    if (token) await AuthApi.logout(token);
    AuthSession.clearToken();
    location.replace("../login/");
  });
})();
