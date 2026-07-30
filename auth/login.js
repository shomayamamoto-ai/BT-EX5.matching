// ============================================
// auth/login.js — ログインページの画面ロジック
// 仕様: docs/specs/login-page-detailed-spec-v3.md §3, §4
// ============================================

(function () {
  "use strict";

  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const rememberInput = document.getElementById("login-remember");
  const submitButton = document.getElementById("login-submit");
  const toggleButton = document.getElementById("password-toggle");
  const messageArea = document.getElementById("login-message");

  const SUBMIT_LABEL = "ログイン";
  const SUBMIT_BUSY_LABEL = "ログインしています…";

  const M = AuthUI.MESSAGES;
  let isBusy = false;

  // ---------- パスワード表示切替(aria-pressed / aria-label を状態同期 §2 #6) ----------
  toggleButton.addEventListener("click", () => {
    const show = toggleButton.getAttribute("aria-pressed") !== "true";
    passwordInput.type = show ? "text" : "password";
    toggleButton.setAttribute("aria-pressed", show ? "true" : "false");
    toggleButton.setAttribute("aria-label", show ? "パスワードを隠す" : "パスワードを表示");
    toggleButton.textContent = show ? "隠す" : "表示";
  });

  // ---------- 入力エラーの解除(修正で解除 §3) ----------
  emailInput.addEventListener("input", () => AuthUI.setInvalid(emailInput, false));
  passwordInput.addEventListener("input", () => AuthUI.setInvalid(passwordInput, false));

  // ---------- クライアント側バリデーション(§4) ----------
  function validate() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
      AuthUI.setInvalid(emailInput, true);
      AuthUI.showError(messageArea, M.emailRequired);
      emailInput.focus();
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      AuthUI.setInvalid(emailInput, true);
      AuthUI.showError(messageArea, M.emailInvalid);
      emailInput.focus();
      return null;
    }
    if (!password) {
      AuthUI.setInvalid(passwordInput, true);
      AuthUI.showError(messageArea, M.passwordRequired);
      passwordInput.focus();
      return null;
    }
    return { email, password };
  }

  // ---------- 送信(二重送信は isBusy で遮断 §3) ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isBusy) return;

    AuthUI.clearMessage(messageArea);
    const values = validate();
    if (!values) return;

    if (!AuthSession.storageAvailable()) {
      AuthUI.showError(messageArea, M.storageUnavailable);
      return;
    }

    isBusy = true;
    AuthUI.setBusy(submitButton, true, SUBMIT_BUSY_LABEL, SUBMIT_LABEL);

    // remember はチェック状態から boolean を厳密に生成(§5.2)
    const result = await AuthApi.login(
      values.email,
      values.password,
      rememberInput.checked === true
    );

    isBusy = false;
    AuthUI.setBusy(submitButton, false, SUBMIT_BUSY_LABEL, SUBMIT_LABEL);

    if (!result.success) {
      // サーバー由来の文言をそのまま表示。フロントで作り直さない(§4)
      AuthUI.showError(messageArea, result.error.userMessage);
      // コード分岐は AUTH_FAILED のフォーカス制御1箇所のみ(§5.6)
      if (result.error.code === "AUTH_FAILED") {
        passwordInput.focus();
        passwordInput.select();
      }
      return;
    }

    // Session fixation 対策(§7): ログイン前に保持していたトークンは
    // 破棄し、新規発行トークンで置き換える
    AuthSession.clearToken();
    AuthSession.saveToken(result.data.sessionToken);
    // user オブジェクトは localStorage へ保存しない(§5.3)

    redirectToNext();
  });

  function redirectToNext() {
    const params = new URLSearchParams(location.search);
    // リスト外・不正値はすべて portal へ丸める(§6 safeNextName)
    location.replace(AuthSession.screenPath(params.get("next")));
  }

  // ---------- ログイン済みで到達 → 即遷移(フォームを見せない §3) ----------
  (async function checkExistingSession() {
    if (!AuthSession.storageAvailable()) {
      AuthUI.showError(messageArea, M.storageUnavailable);
      return;
    }
    const token = AuthSession.getToken();
    if (!token) return;
    const result = await AuthApi.verifySession(token);
    if (result.success) {
      redirectToNext();
    } else {
      // 無効なら破棄してフォーム表示(§7)
      AuthSession.clearToken();
    }
  })();
})();
