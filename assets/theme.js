// ============================================
// assets/theme.js — 見た目の切りかえ(この端末に覚える)
//   サイト: "soft"(やわらかいデザイン・はじめ)⇔ "classic"(元の黒×金)
//   スライド: "soft" ⇔ "classic"(定例会のスライドだけ別に選べる)
// 元の黒×金にするときは、やわらかいデザインの見た目(link[data-theme="soft"])を読みこまないだけなので、
// 前の見た目にそのまま戻る。どのページでも、assets/soft.css の link のすぐあとで読みこむ。
// ============================================
var BtexTheme = (function () {
  "use strict";
  var KEY = "btex5-theme", DECK_KEY = "btex5-deck-theme";
  function read(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できない端末は、その場だけ */ } }
  var site = read(KEY) === "classic" ? "classic" : "soft";
  function apply() {
    var classic = site === "classic";
    document.documentElement.classList.toggle("theme-classic", classic);
    var links = document.querySelectorAll('link[data-theme="soft"]');
    for (var i = 0; i < links.length; i++) links[i].disabled = classic;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", classic ? "#1a0f0c" : "#faf6f4");
  }
  apply();
  return {
    site: function () { return site; },
    setSite: function (v) { site = v === "classic" ? "classic" : "soft"; write(KEY, site); apply(); },
    deck: function () { return read(DECK_KEY) === "classic" ? "classic" : "soft"; },
    setDeck: function (v) { write(DECK_KEY, v === "classic" ? "classic" : "soft"); },
  };
})();
