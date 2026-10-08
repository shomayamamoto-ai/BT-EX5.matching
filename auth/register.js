// ============================================
// auth/register.js — 会員登録ページの画面ロジック(デモ用)
// 登録成功時は自動ログインして紹介先早見表へ遷移する。
// ============================================

(function () {
  "use strict";

  const form = document.getElementById("register-form");
  const nameInput = document.getElementById("register-name");
  const emailInput = document.getElementById("register-email");
  const passwordInput = document.getElementById("register-password");
  const submitButton = document.getElementById("register-submit");
  const toggleButton = document.getElementById("password-toggle");
  const messageArea = document.getElementById("register-message");

  const SUBMIT_LABEL = "登録してはじめる";
  const SUBMIT_BUSY_LABEL = "登録しています…";

  const M = AuthUI.MESSAGES;
  let isBusy = false;

  toggleButton.addEventListener("click", () => {
    const show = toggleButton.getAttribute("aria-pressed") !== "true";
    passwordInput.type = show ? "text" : "password";
    toggleButton.setAttribute("aria-pressed", show ? "true" : "false");
    toggleButton.setAttribute("aria-label", show ? "パスワードを隠す" : "パスワードを表示");
    toggleButton.textContent = show ? "隠す" : "表示";
  });

  [nameInput, emailInput, passwordInput].forEach((el) =>
    el.addEventListener("input", () => AuthUI.setInvalid(el, false))
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isBusy) return;
    AuthUI.clearMessage(messageArea);

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!name) {
      AuthUI.setInvalid(nameInput, true);
      AuthUI.showError(messageArea, "エラー:お名前を入力してください。");
      nameInput.focus();
      return;
    }
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
    if (!password) {
      AuthUI.setInvalid(passwordInput, true);
      AuthUI.showError(messageArea, M.passwordRequired);
      passwordInput.focus();
      return;
    }

    if (!AuthSession.storageAvailable()) {
      AuthUI.showError(messageArea, M.storageUnavailable);
      return;
    }

    isBusy = true;
    AuthUI.setBusy(submitButton, true, SUBMIT_BUSY_LABEL, SUBMIT_LABEL);
    const result = await AuthApi.register(name, email, password);
    isBusy = false;
    AuthUI.setBusy(submitButton, false, SUBMIT_BUSY_LABEL, SUBMIT_LABEL);

    if (!result.success) {
      AuthUI.showError(messageArea, result.error.userMessage);
      if (result.error.code === "WEAK_PASSWORD") {
        AuthUI.setInvalid(passwordInput, true);
        passwordInput.focus();
      }
      return;
    }

    // 自動ログイン成功: トークンのみ保存して紹介先早見表へ
    AuthSession.clearToken();
    AuthSession.saveToken(result.data.sessionToken);
    location.replace(AuthSession.screenPath("home"));
  });
})();
