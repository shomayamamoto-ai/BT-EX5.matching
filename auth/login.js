// ============================================
// auth/login.js — ログインページの画面ロジック
// 仕様: docs/specs/login-page-detailed-spec-v3.md §3, §4
//
// 2つのページで使う(ページにある入力欄だけを動かす)。
//   ・会員のログイン(/login/): お名前を一覧から選び、パスワードを入れる。
//       まだパスワードを決めていない人は、移行期間のあいだ共通パスコードを入れる。
//       はじめての方・パスワードを忘れた方は「招待コード」から(?invite=コード で開くとそこから)
//   ・運営者のログイン(/login/admin/): 管理者用パスコード → お名前を選ぶ
// ============================================

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const lead = $("login-lead");
  const messageArea = $("login-message");
  const M = AuthUI.MESSAGES;
  let isBusy = false;

  const LAST_MEMBER_KEY = "kouryukai-last-member";

  function readLastMember() {
    try { return localStorage.getItem(LAST_MEMBER_KEY) || ""; } catch { return ""; }
  }
  function saveLastMember(id) {
    try { localStorage.setItem(LAST_MEMBER_KEY, id); } catch { /* noop */ }
  }

  function finishLogin(data) {
    // Session fixation 対策(§7): 以前のトークンは破棄して新しいもので置き換える
    AuthSession.clearToken();
    AuthSession.saveToken(data.sessionToken);
    redirectToNext(data.user && data.user.isAdmin);
  }
  function redirectToNext(isAdmin) {
    const params = new URLSearchParams(location.search);
    // 運営者のログインで行き先の指定がなければ、管理者メニューへ
    if (isAdmin && document.getElementById("login-form") && !params.get("next")) { location.replace("../app/#admin"); return; }
    // リスト外・不正値はすべて既定画面へ丸める(§6 safeNextName)
    location.replace(AuthSession.screenPath(params.get("next")));
  }

  // 「運営者の方はこちら」などのリンクに、行き先(?next=)を引き継ぐ
  document.querySelectorAll(".auth-admin-link a").forEach((a) => {
    const next = new URLSearchParams(location.search).get("next");
    if (next) a.href = `${a.getAttribute("href")}?next=${encodeURIComponent(AuthSession.safeNextName(next))}`;
  });

  // パスワード・パスコード欄の表示切替(aria-pressed / aria-label を状態同期 §2 #6)
  document.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
    const input = $(b.dataset.toggle);
    const show = b.getAttribute("aria-pressed") !== "true";
    input.type = show ? "text" : "password";
    b.setAttribute("aria-pressed", show ? "true" : "false");
    b.setAttribute("aria-label", show ? "隠す" : "表示する");
    b.textContent = show ? "隠す" : "表示";
  }));

  function fillMembers(select, members, selected) {
    select.innerHTML = "";
    select.add(new Option("お名前を選んでください", ""));
    members.forEach((m) => select.add(new Option(m.name, m.id, false, m.id === selected)));
  }

  // ============================================
  // 会員のログイン(/login/)
  // ============================================
  const accountForm = $("account-form");
  if (accountForm) {
    const memberSelect = $("login-member");
    const passwordInput = $("login-password");
    const accountSubmit = $("account-submit");
    const inviteForm = $("invite-form");
    const inviteInput = $("invite-code");
    const inviteSubmit = $("invite-submit");
    const setpwForm = $("setpw-form");
    const setpwSubmit = $("setpw-submit");
    let acceptedInvite = "";

    const LEADS = {
      account: "お名前を選んで、パスワードを入れてください。",
      invite: "運営者から届いた招待コードを入力してください。",
      setpw: "あなた専用のパスワードを決めてください。",
    };
    const showStep = (step, noFocus) => {
      accountForm.hidden = step !== "account";
      inviteForm.hidden = step !== "invite";
      setpwForm.hidden = step !== "setpw";
      lead.textContent = LEADS[step];
      AuthUI.clearMessage(messageArea);
      if (noFocus) return;
      const focusEl = { account: memberSelect.value ? passwordInput : memberSelect, invite: inviteInput, setpw: $("setpw-password") }[step];
      if (focusEl) focusEl.focus();
    };
    document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => showStep(b.dataset.mode)));

    // お名前の一覧(名簿から)。前回選んだ人を最初から選んでおく
    AuthApi.loginMembers().then((res) => {
      if (!res.success) { AuthUI.showError(messageArea, res.error.userMessage); return; }
      fillMembers(memberSelect, res.data.members, readLastMember());
      $("passcode-hint").hidden = !res.data.memberPasscode;
      if (memberSelect.value && !accountForm.hidden && document.activeElement === document.body) passwordInput.focus();
    });

    accountForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isBusy) return;
      AuthUI.clearMessage(messageArea);
      const memberId = memberSelect.value;
      const password = passwordInput.value;
      if (!memberId) {
        AuthUI.setInvalid(memberSelect, true);
        AuthUI.showError(messageArea, M.memberRequired);
        memberSelect.focus();
        return;
      }
      if (!password) {
        AuthUI.setInvalid(passwordInput, true);
        AuthUI.showError(messageArea, "エラー:パスワードを入力してください。");
        passwordInput.focus();
        return;
      }
      if (!AuthSession.storageAvailable()) { AuthUI.showError(messageArea, M.storageUnavailable); return; }
      isBusy = true;
      AuthUI.setBusy(accountSubmit, true, "ログインしています…", "ログイン");
      const result = await AuthApi.accountLogin(memberId, password, $("account-remember").checked === true, true);
      isBusy = false;
      AuthUI.setBusy(accountSubmit, false, "ログインしています…", "ログイン");
      if (!result.success) {
        AuthUI.showError(messageArea, result.error.userMessage);
        if (result.error.code === "ACCOUNT_FAILED") { AuthUI.setInvalid(passwordInput, true); passwordInput.select(); passwordInput.focus(); }
        return;
      }
      saveLastMember(memberId);
      finishLogin(result.data);
    });
    memberSelect.addEventListener("change", () => { AuthUI.setInvalid(memberSelect, false); if (memberSelect.value) passwordInput.focus(); });
    passwordInput.addEventListener("input", () => AuthUI.setInvalid(passwordInput, false));

    // ---------- 招待コード ----------
    const checkInvite = async (code) => {
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
      $("setpw-name").textContent = result.data.name;
      $("setpw-user").value = result.data.name;
      showStep("setpw");
    };
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
      const pw = $("setpw-password").value;
      const pw2 = $("setpw-password2").value;
      if (pw.length < 8) { AuthUI.showError(messageArea, "エラー:パスワードは8文字以上にしてください。"); return; }
      if (pw !== pw2) { AuthUI.showError(messageArea, "エラー:確認用のパスワードが一致しません。"); return; }
      if (!AuthSession.storageAvailable()) { AuthUI.showError(messageArea, M.storageUnavailable); return; }
      isBusy = true;
      AuthUI.setBusy(setpwSubmit, true, "保存しています…", "決めてはじめる");
      const result = await AuthApi.activateAccount(acceptedInvite, pw, $("setpw-remember").checked === true);
      isBusy = false;
      AuthUI.setBusy(setpwSubmit, false, "保存しています…", "決めてはじめる");
      if (!result.success) {
        AuthUI.showError(messageArea, result.error.userMessage);
        if (result.error.code === "INVITE_INVALID" || result.error.code === "LOCKED") showStep("invite", true);
        return;
      }
      acceptedInvite = "";
      if (result.data.memberId) saveLastMember(result.data.memberId);
      finishLogin(result.data);
    });

    const invite = new URLSearchParams(location.search).get("invite");
    if (invite) {
      inviteInput.value = invite;
      showStep("invite", true);
      checkInvite(invite);
    } else {
      showStep("account", true);
    }
  }

  // ============================================
  // 運営者のログイン(/login/admin/): パスコード → お名前を選ぶ
  // ============================================
  const codeForm = $("login-form");
  if (codeForm) {
    const codeInput = $("login-passcode");
    const rememberInput = $("login-remember");
    const codeSubmit = $("login-submit");
    const memberForm = $("member-form");
    const memberSelect = $("login-member");
    const memberSubmit = $("member-submit");
    let acceptedPasscode = ""; // 手順2の送信まで画面内でのみ保持する

    const showStep = (step) => {
      codeForm.hidden = step !== "code";
      memberForm.hidden = step !== "member";
      lead.textContent = step === "member" ? "パスコードを確認しました。あなたのお名前を選んでください。" : "運営者用のパスコードを入力してください。";
      (step === "member" ? memberSelect : codeInput).focus();
    };
    codeInput.addEventListener("input", () => AuthUI.setInvalid(codeInput, false));
    memberSelect.addEventListener("change", () => AuthUI.setInvalid(memberSelect, false));

    // 手順1: パスコード(二重送信は isBusy で遮断 §3)
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
      if (!AuthSession.storageAvailable()) { AuthUI.showError(messageArea, M.storageUnavailable); return; }
      isBusy = true;
      AuthUI.setBusy(codeSubmit, true, "確認しています…", "次へ");
      const result = await AuthApi.passcodeLogin(passcode, "", rememberInput.checked === true);
      isBusy = false;
      AuthUI.setBusy(codeSubmit, false, "確認しています…", "次へ");
      if (!result.success) {
        // サーバー由来の文言をそのまま表示。フロントで作り直さない(§4)
        AuthUI.showError(messageArea, result.error.userMessage);
        if (result.error.code === "AUTH_FAILED") {
          AuthUI.setInvalid(codeInput, true);
          codeInput.focus();
          codeInput.select();
        }
        return;
      }
      acceptedPasscode = passcode;
      fillMembers(memberSelect, result.data.members, readLastMember());
      showStep("member");
    });

    // 手順2: 名前を選んでログイン
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

    $("member-back").addEventListener("click", () => {
      acceptedPasscode = "";
      codeInput.value = "";
      AuthUI.clearMessage(messageArea);
      showStep("code");
    });
  }

  // ---------- ログイン済みで到達 → 即遷移(フォームを見せない §3) ----------
  (async function checkExistingSession() {
    if (!AuthSession.storageAvailable()) {
      AuthUI.showError(messageArea, M.storageUnavailable);
      return;
    }
    // 招待リンクで開いたとき・運営者のログインでは、ログイン中でもフォームを出す
    if (new URLSearchParams(location.search).get("invite") || codeForm) return;
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
