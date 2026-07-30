// ============================================
// auth/reset.js — パスワード再設定リクエスト画面
// 仕様: docs/specs/login-page-detailed-spec-v3.md §5.1
// 再設定リクエストは登録の有無にかかわらず常に成功応答を返す
// (アカウント列挙耐性)。文言はサーバー側応答をそのまま表示する。
// ============================================

(function () {
  "use strict";

  const form = document.getElementById("reset-form");
  const emailInput = document.getElementById("reset-email");
  const submitButton = document.getElementById("reset-submit");
  const messageArea = document.getElementById("reset-message");

  const SUBMIT_LABEL = "再設定メールを送信";
  const SUBMIT_BUSY_LABEL = "送信しています…";

  const M = AuthUI.MESSAGES;
  let isBusy = false;

  emailInput.addEventListener("input", () => AuthUI.setInvalid(emailInput, false));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isBusy) return;
    AuthUI.clearMessage(messageArea);

    const email = emailInput.value.trim();
    if (!email) {
      AuthUI.setInvalid(emailInput, true);
      AuthUI.showError(messageArea, M.emailRequired);
      emailInput.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      AuthUI.setInvalid(emailInput, true);
      AuthUI.showError(messageArea, M.emailInvalid);
      emailInput.focus();
      return;
    }

    isBusy = true;
    AuthUI.setBusy(submitButton, true, SUBMIT_BUSY_LABEL, SUBMIT_LABEL);
    const result = await AuthApi.requestPasswordReset(email);
    isBusy = false;
    AuthUI.setBusy(submitButton, false, SUBMIT_BUSY_LABEL, SUBMIT_LABEL);

    if (result.success) {
      AuthUI.showStatus(messageArea, result.data.message);
    } else {
      AuthUI.showError(messageArea, result.error.userMessage);
    }
  });
})();
