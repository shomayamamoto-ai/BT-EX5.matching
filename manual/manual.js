// BT-EX5 使い方マニュアル(共通): 戻るボタン・いちばん上へのボタン・動画はひとつだけ再生
(function () {
  "use strict";
  // 戻る: このサイトの前のページから来たときはそこへ。外から直接開いたときは、data-back の場所へ
  document.querySelectorAll("[data-back]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var fromHere = false;
      try { fromHere = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (err) { /* noop */ }
      if (fromHere && history.length > 1) { e.preventDefault(); history.back(); }
    });
  });

  // いちばん上へ: 下のほうまで読んだら出る
  var btn = document.querySelector(".to-top");
  if (btn) {
    var onScroll = function () { btn.classList.toggle("is-on", window.scrollY > Math.max(700, window.innerHeight * 1.2)); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    btn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  // 動画は、ひとつ再生したら、ほかの動画は止める
  var videos = document.querySelectorAll("video");
  videos.forEach(function (v) {
    v.addEventListener("play", function () { videos.forEach(function (o) { if (o !== v) o.pause(); }); });
  });
})();
