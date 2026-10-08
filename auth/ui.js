// ============================================
// auth/ui.js — 入力検証文言・画面ヘルパー
// 仕様: docs/specs/login-page-detailed-spec-v3.md §4, §9
// 入力検証(未入力・形式)とストレージ利用不可の文言はここで管理する。
// サーバー由来エラーの文言はフロントで作り直さない(§4)。
// ============================================

const AuthUI = (function () {
  "use strict";

  const MESSAGES = {
    passcodeRequired: "エラー:パスコードを入力してください。",
    memberRequired: "エラー:お名前を選んでください。",
    storageUnavailable:
      "お使いのブラウザではログイン情報を保存できないため、ログインできません。プライベートブラウズを終了するか、サイトデータの保存を許可してください。",
  };

  // メッセージ領域: エラーは role="alert"、案内は role="status"(§2 #9)
  function showError(el, text) {
    el.setAttribute("role", "alert");
    el.dataset.kind = "error";
    el.textContent = text;
  }

  function showStatus(el, text) {
    el.setAttribute("role", "status");
    el.dataset.kind = "status";
    el.textContent = text;
  }

  function clearMessage(el) {
    el.removeAttribute("role");
    delete el.dataset.kind;
    el.textContent = "";
  }

  function setInvalid(input, invalid) {
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  // 送信中: disabled + 文言変更 + aria-busy(§3)
  function setBusy(button, busy, busyLabel, idleLabel) {
    button.disabled = busy;
    button.setAttribute("aria-busy", busy ? "true" : "false");
    button.textContent = busy ? busyLabel : idleLabel;
  }

  return { MESSAGES, showError, showStatus, clearMessage, setInvalid, setBusy };
})();
