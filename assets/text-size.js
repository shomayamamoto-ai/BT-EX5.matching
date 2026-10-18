// ============================================
// assets/text-size.js — 文字の大きさの切りかえ(「ぁ|あ」)
// どのページでも、上の帯(ヘッダー)の右上に出す。ヘッダーのないページ(ログイン・利用規約・ビジター申込)は、
// 画面の中のカードの右上に出す。選んだ大きさはこの端末に保存し、すべてのページで同じにする。
// <head> で読みこむ(読みこんだときに、すぐ大きさをそろえる。ちらつかないように)
// ============================================

(function () {
  "use strict";
  var KEY = "btex5-big-text";
  var root = document.documentElement;
  function isBig() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function apply(big) {
    root.classList.toggle("big-text", big);
    var nodes = document.querySelectorAll(".ts-toggle button");
    for (var i = 0; i < nodes.length; i++) {
      var on = nodes[i].getAttribute("data-size") === (big ? "big" : "normal");
      nodes[i].classList.toggle("is-on", on);
      nodes[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }
  apply(isBig());

  function set(big) {
    try { localStorage.setItem(KEY, big ? "1" : "0"); } catch (e) { /* 保存できなくても、この画面では切りかえる */ }
    apply(big);
  }
  function make() {
    var box = document.createElement("div");
    box.className = "ts-toggle";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "文字の大きさ");
    [["normal", "ぁ", "文字をふつうの大きさにする"], ["big", "あ", "文字を大きくする"]].forEach(function (x) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-size", x[0]);
      b.setAttribute("aria-label", x[2]);
      b.title = x[2];
      b.textContent = x[1];
      b.addEventListener("click", function () { set(x[0] === "big"); });
      box.appendChild(b);
    });
    return box;
  }
  function mount() {
    if (document.querySelector(".ts-toggle")) return;
    var box = make();
    var appTop = document.querySelector(".app-top");
    var refHeader = document.querySelector(".ref-header");
    var card = document.querySelector(".auth-card");
    if (appTop) {
      // ベルの前に(早見表などのページと同じ並び: …ムービー → 文字の大きさ → ベル → 名前の丸)
      appTop.insertBefore(box, appTop.querySelector(".app-bell") || null);
    } else if (refHeader) {
      // 右のまとまり(リンク・ベル・名前の丸)の中に入れる。ベルと名前の丸は、あとから右に足される
      var nav = refHeader.querySelector(".ref-header-nav") || refHeader;
      var bell = nav.querySelector(".nav-bell, .nav-me");
      if (bell) nav.insertBefore(box, bell); else nav.appendChild(box);
    } else if (card) {
      box.classList.add("is-corner");
      card.insertBefore(box, card.firstChild);
    } else {
      box.classList.add("is-float");
      document.body.appendChild(box);
    }
    apply(isBig());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  // ほかのタブで切りかえたとき
  window.addEventListener("storage", function (e) { if (e.key === KEY) apply(e.newValue === "1"); });
})();
