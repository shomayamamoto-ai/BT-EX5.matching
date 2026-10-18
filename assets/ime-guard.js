// ============================================
// assets/ime-guard.js — 日本語の変換中の Enter で、勝手に検索・送信・画面の移動をしない
// <head> で読みこむ(どの画面の入力欄にも効く)。
// - 変換中の Enter(確定)、変換を終えた直後の Enter(Safari は確定の Enter が変換のあとに届く)は、
//   入力欄のほかの処理(検索・追加・送信)に渡さない
// - 1行の入力欄の Shift+Enter(変換の取り消しなどに使う)も、ほかの処理に渡さない
//   (複数行の欄 textarea の Shift+Enter は、そのまま改行に使える)
// ============================================
(function () {
  "use strict";
  let composing = false;
  let endedAt = 0;
  const isField = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  document.addEventListener("compositionstart", () => { composing = true; }, true);
  document.addEventListener("compositionend", () => { composing = false; endedAt = Date.now(); }, true);
  function guard(e) {
    if (e.key !== "Enter" || !isField(e.target)) return;
    const ime = composing || e.isComposing || e.keyCode === 229 || Date.now() - endedAt < 120;
    const shiftInLine = e.shiftKey && e.target.tagName === "INPUT";
    if (!ime && !shiftInLine) return;
    // 変換の確定・取り消しは入力欄の中だけで終わらせる(ほかの処理・フォームの送信をしない)
    e.stopImmediatePropagation();
    // 変換が終わったあとの Enter・Shift+Enter は、フォームの送信も止める(変換中は止めない。変換がこわれるため)
    const stillComposing = composing || e.isComposing;
    if (!stillComposing) e.preventDefault();
  }
  // いちばん先に受け取る(window の capture)
  window.addEventListener("keydown", guard, true);
  window.addEventListener("keypress", guard, true);
})();
