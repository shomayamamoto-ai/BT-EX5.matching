// ============================================
// auth/login.js — ログインページの画面ロジック
// 仕様: docs/specs/login-page-detailed-spec-v3.md §3, §4
// ・お名前とパスワード(会員ごとのアカウント。ふだんはこれ)
// ・招待コード(はじめての方・パスワードを忘れた方): コード → パスワードを決める
// ・共通パスコード(移行期間・運営者用): 手順1でパスコード、手順2で名簿から名前を選ぶ
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
  const LAST_NAME_KEY = "kouryukai-last-name";
  const LAST_MODE_KEY = "kouryukai-login-mode";
  const accountForm = document.getElementById("account-form");
  const nameInput = document.getElementById("login-name");
  const passwordInput = document.getElementById("login-password");
  const accountSubmit = document.getElementById("account-submit");
  const inviteForm = document.getElementById("invite-form");
  const inviteInput = document.getElementById("invite-code");
  const inviteSubmit = document.getElementById("invite-submit");
  const setpwForm = document.getElementById("setpw-form");
  const setpwSubmit = document.getElementById("setpw-submit");
  const tabs = document.getElementById("login-tabs");
  let passcodeAllowed = true;
  let acceptedInvite = "";
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

  const LEADS = {
    account: "お名前とパスワードを入力してください。",
    invite: "運営者から届いた招待コードを入力してください。",
    setpw: "あなた専用のパスワードを決めてください。",
    code: "コミュニティのパスコードを入力してください。",
    member: "パスコードを確認しました。あなたのお名前を選んでください。",
  };
  // step: account / invite / setpw / code(共通パスコード) / member(名前を選ぶ)
  function showStep(step, noFocus) {
    accountForm.hidden = step !== "account";
    inviteForm.hidden = step !== "invite";
    setpwForm.hidden = step !== "setpw";
    codeForm.hidden = step !== "code";
    memberForm.hidden = step !== "member";
    tabs.hidden = step === "invite" || step === "setpw" || step === "member";
    const onPasscode = step === "code";
    document.getElementById("tab-account").setAttribute("aria-selected", onPasscode ? "false" : "true");
    document.getElementById("tab-passcode").setAttribute("aria-selected", onPasscode ? "true" : "false");
    lead.textContent = LEADS[step];
    AuthUI.clearMessage(messageArea);
    if (noFocus) return;
    const focusEl = { account: nameInput.value ? passwordInput : nameInput, invite: inviteInput, setpw: document.getElementById("setpw-password"), code: codeInput, member: memberSelect }[step];
    if (focusEl) focusEl.focus();
  }

  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    const mode = b.dataset.mode;
    if (mode === "account" || mode === "passcode") {
      try { localStorage.setItem(LAST_MODE_KEY, mode); } catch { /* noop */ }
    }
    showStep(mode === "passcode" ? "code" : mode);
  }));

  // パスワード欄の表示切替(お名前とパスワード・パスワードを決める)
  document.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
    const input = document.getElementById(b.dataset.toggle);
    const show = b.getAttribute("aria-pressed") !== "true";
    input.type = show ? "text" : "password";
    b.setAttribute("aria-pressed", show ? "true" : "false");
    b.setAttribute("aria-label", show ? "パスワードを隠す" : "パスワードを表示");
    b.textContent = show ? "隠す" : "表示";
  }));

  // ---------- お名前とパスワード ----------
  accountForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isBusy) return;
    AuthUI.clearMessage(messageArea);
    const name = nameInput.value.trim();
    const password = passwordInput.value;
    if (!name || !password) {
      AuthUI.setInvalid(name ? passwordInput : nameInput, true);
      AuthUI.showError(messageArea, "エラー:お名前とパスワードを入力してください。");
      (name ? passwordInput : nameInput).focus();
      return;
    }
    if (!AuthSession.storageAvailable()) { AuthUI.showError(messageArea, M.storageUnavailable); return; }
    isBusy = true;
    AuthUI.setBusy(accountSubmit, true, "ログインしています…", "ログイン");
    const result = await AuthApi.accountLogin(name, password, document.getElementById("account-remember").checked === true);
    isBusy = false;
    AuthUI.setBusy(accountSubmit, false, "ログインしています…", "ログイン");
    if (!result.success) {
      AuthUI.showError(messageArea, result.error.userMessage);
      if (result.error.code === "ACCOUNT_FAILED") { passwordInput.select(); passwordInput.focus(); }
      return;
    }
    try { localStorage.setItem(LAST_NAME_KEY, name); localStorage.setItem(LAST_MODE_KEY, "account"); } catch { /* noop */ }
    finishLogin(result.data);
  });
  [nameInput, passwordInput].forEach((i) => i.addEventListener("input", () => AuthUI.setInvalid(i, false)));

  // ---------- 招待コード ----------
  async function checkInvite(code) {
    isBusy = true;
    AuthUI.setBusy(inviteSubmit, true, "確認しています…", "次へ");
    const result = await AuthApi.inviteInfo(code);
    isBusy = false;
    AuthUI.setBusy(inviteSubmit, false, "確認しています…", "次へ");
    if (!result.success) {
      showStep("invite");
      AuthUI.showError(messageArea, result.error.userMessage);
      AuthUI.setInvalid(inviteInput, true);
      return;
    }
    acceptedInvite = code;
    document.getElementById("setpw-name").textContent = result.data.name;
    document.getElementById("setpw-user").value = result.data.name;
    showStep("setpw");
  }
  inviteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (isBusy) return;
    const code = inviteInput.value.trim();
    if (!code) { AuthUI.setInvalid(inviteInput, true); AuthUI.showError(messageArea, "エラー:招待コードを入力してください。"); return; }
    checkInvite(code);
  });
  inviteInput.addEventListener("input", () => AuthUI.setInvalid(inviteInput, false));

  setpwForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isBusy) return;
    AuthUI.clearMessage(messageArea);
    const pw = document.getElementById("setpw-password").value;
    const pw2 = document.getElementById("setpw-password2").value;
    if (pw.length < 8) { AuthUI.showError(messageArea, "エラー:パスワードは8文字以上にしてください。"); return; }
    if (pw !== pw2) { AuthUI.showError(messageArea, "エラー:確認用のパスワードが一致しません。"); return; }
    if (!AuthSession.storageAvailable()) { AuthUI.showError(messageArea, M.storageUnavailable); return; }
    isBusy = true;
    AuthUI.setBusy(setpwSubmit, true, "保存しています…", "決めてはじめる");
    const result = await AuthApi.activateAccount(acceptedInvite, pw, document.getElementById("setpw-remember").checked === true);
    isBusy = false;
    AuthUI.setBusy(setpwSubmit, false, "保存しています…", "決めてはじめる");
    if (!result.success) {
      AuthUI.showError(messageArea, result.error.userMessage);
      if (result.error.code === "INVITE_INVALID" || result.error.code === "LOCKED") showStep("invite", true);
      return;
    }
    try { localStorage.setItem(LAST_NAME_KEY, result.data.displayName); localStorage.setItem(LAST_MODE_KEY, "account"); } catch { /* noop */ }
    acceptedInvite = "";
    finishLogin(result.data);
  });

  function finishLogin(data) {
    // Session fixation 対策(§7): 以前のトークンは破棄して新しいもので置き換える
    AuthSession.clearToken();
    AuthSession.saveToken(data.sessionToken);
    redirectToNext();
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
    // user オブジェクトは localStorage へ保存しない(§5.3)
    finishLogin(result.data);
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

  // ---------- はじめの表示 ----------
  // ・?invite=コード → 招待コードの確認から
  // ・前回の方法(お名前とパスワード / 共通パスコード)を覚えておく。
  //   共通パスコードが止められていればタブを出さない(運営者は下のリンクから)
  (function initMode() {
    let lastName = "";
    let lastMode = "";
    try { lastName = localStorage.getItem(LAST_NAME_KEY) || ""; lastMode = localStorage.getItem(LAST_MODE_KEY) || ""; } catch { /* noop */ }
    nameInput.value = lastName;
    const invite = new URLSearchParams(location.search).get("invite");
    if (invite) {
      inviteInput.value = invite;
      showStep("invite", true);
      checkInvite(invite);
      return;
    }
    showStep(lastMode === "passcode" ? "code" : "account", true);
    AuthApi.loginOptions().then((res) => {
      passcodeAllowed = !res.success || res.data.memberPasscode !== false;
      document.getElementById("tab-passcode").textContent = passcodeAllowed ? "共通パスコード" : "運営者用パスコード";
      if (!passcodeAllowed && !codeForm.hidden) showStep("account", true);
    });
  })();

  // ---------- ログイン済みで到達 → 即遷移(フォームを見せない §3) ----------
  (async function checkExistingSession() {
    if (!AuthSession.storageAvailable()) {
      AuthUI.showError(messageArea, M.storageUnavailable);
      return;
    }
    // 招待リンクで開いたときは、ログイン中でもパスワードを決める画面を出す
    if (new URLSearchParams(location.search).get("invite")) return;
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
