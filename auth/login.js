// ============================================
// auth/login.js — ログインページの画面ロジック(パスコード方式)
// 仕様: docs/specs/login-page-detailed-spec-v3.md §3, §4
// 手順1でパスコードを確認し、手順2で名簿から自分の名前を選んでログインする。
// ============================================

(function () {
  "use strict";

  const codeForm = document.getElementById("login-form");
  const codeInput = document.getElementById("login-passcode");
  const rememberInput = document.getElementById("login-remember");
  const codeSubmit = document.getElementById("login-submit");
  const toggleButton = document.getElementById("password-toggle");
  const memberForm = document.getElementById("member-form");
  const memberSelect = document.getElementById("login-member");
  const memberSubmit = document.getElementById("member-submit");
  const memberBack = document.getElementById("member-back");
  const lead = document.getElementById("login-lead");
  const messageArea = document.getElementById("login-message");

  const LAST_MEMBER_KEY = "kouryukai-last-member";
  const M = AuthUI.MESSAGES;
  let isBusy = false;
  let acceptedPasscode = ""; // 手順2の送信まで画面内でのみ保持する

  // ---------- パスコード表示切替(aria-pressed / aria-label を状態同期 §2 #6) ----------
  toggleButton.addEventListener("click", () => {
    const show = toggleButton.getAttribute("aria-pressed") !== "true";
    codeInput.type = show ? "text" : "password";
    toggleButton.setAttribute("aria-pressed", show ? "true" : "false");
    toggleButton.setAttribute("aria-label", show ? "パスコードを隠す" : "パスコードを表示");
    toggleButton.textContent = show ? "隠す" : "表示";
  });

  codeInput.addEventListener("input", () => AuthUI.setInvalid(codeInput, false));
  memberSelect.addEventListener("change", () => AuthUI.setInvalid(memberSelect, false));

  function readLastMember() {
    try { return localStorage.getItem(LAST_MEMBER_KEY) || ""; } catch { return ""; }
  }
  function saveLastMember(id) {
    try { localStorage.setItem(LAST_MEMBER_KEY, id); } catch { /* noop */ }
  }

  function showStep(step) {
    const onMember = step === "member";
    codeForm.hidden = onMember;
    memberForm.hidden = !onMember;
    lead.textContent = onMember
      ? "パスコードを確認しました。あなたのお名前を選んでください。"
      : "コミュニティのパスコードを入力してください。";
    (onMember ? memberSelect : codeInput).focus();
  }

  // ---------- 手順1: パスコード(二重送信は isBusy で遮断 §3) ----------
  codeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isBusy) return;
    AuthUI.clearMessage(messageArea);

    const passcode = codeInput.value.trim();
    if (!passcode) {
      AuthUI.setInvalid(codeInput, true);
      AuthUI.showError(messageArea, M.passcodeRequired);
      codeInput.focus();
      return;
    }
    if (!AuthSession.storageAvailable()) {
      AuthUI.showError(messageArea, M.storageUnavailable);
      return;
    }

    isBusy = true;
    AuthUI.setBusy(codeSubmit, true, "確認しています…", "次へ");
    const result = await AuthApi.passcodeLogin(passcode, "", rememberInput.checked === true);
    isBusy = false;
    AuthUI.setBusy(codeSubmit, false, "確認しています…", "次へ");

    if (!result.success) {
      // サーバー由来の文言をそのまま表示。フロントで作り直さない(§4)
      AuthUI.showError(messageArea, result.error.userMessage);
      // コード分岐は AUTH_FAILED のフォーカス制御1箇所のみ(§5.6)
      if (result.error.code === "AUTH_FAILED") {
        AuthUI.setInvalid(codeInput, true);
        codeInput.focus();
        codeInput.select();
      }
      return;
    }

    acceptedPasscode = passcode;
    const last = readLastMember();
    memberSelect.innerHTML = "";
    const placeholder = new Option("選択してください", "");
    memberSelect.add(placeholder);
    result.data.members.forEach((m) => memberSelect.add(new Option(m.name, m.id, false, m.id === last)));
    showStep("member");
  });

  // ---------- 手順2: 名前を選んでログイン ----------
  memberForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isBusy) return;
    AuthUI.clearMessage(messageArea);

    const memberId = memberSelect.value;
    if (!memberId) {
      AuthUI.setInvalid(memberSelect, true);
      AuthUI.showError(messageArea, M.memberRequired);
      memberSelect.focus();
      return;
    }

    isBusy = true;
    AuthUI.setBusy(memberSubmit, true, "ログインしています…", "はじめる");
    const result = await AuthApi.passcodeLogin(acceptedPasscode, memberId, rememberInput.checked === true);
    isBusy = false;
    AuthUI.setBusy(memberSubmit, false, "ログインしています…", "はじめる");

    if (!result.success) {
      AuthUI.showError(messageArea, result.error.userMessage);
      if (result.error.code === "AUTH_FAILED" || result.error.code === "LOCKED") {
        acceptedPasscode = "";
        codeInput.value = "";
        showStep("code");
      }
      return;
    }

    acceptedPasscode = "";
    saveLastMember(memberId);
    // Session fixation 対策(§7): ログイン前に保持していたトークンは
    // 破棄し、新規発行トークンで置き換える
    AuthSession.clearToken();
    AuthSession.saveToken(result.data.sessionToken);
    // user オブジェクトは localStorage へ保存しない(§5.3)
    redirectToNext();
  });

  memberBack.addEventListener("click", () => {
    acceptedPasscode = "";
    codeInput.value = "";
    AuthUI.clearMessage(messageArea);
    showStep("code");
  });

  function redirectToNext() {
    const params = new URLSearchParams(location.search);
    // リスト外・不正値はすべて既定画面へ丸める(§6 safeNextName)
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
