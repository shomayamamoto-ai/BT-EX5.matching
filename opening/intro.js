// ============================================
// ログイン画面のオープニング(この端末で初めて開いたときに1回だけ)
// 動画は音を消して始まる(ブラウザの決まり)。「音を出す」「スキップ」を置く。
// 動きを減らす設定の人には自動で流さない。もう一度見るときは /opening/
// ============================================

(function () {
  "use strict";

  const KEY = "btex5-opening-seen";
  // H.264 が再生できないブラウザ(Chromium など)には WebM を使う
  const SOURCES = [
    ["../assets/opening/bt-ex5-opening-720p.mp4", "video/mp4"],
    ["../assets/opening/bt-ex5-opening-720p.webm", "video/webm"],
  ];

  function seen() {
    try { return localStorage.getItem(KEY) === "1"; } catch { return true; }
  }
  function markSeen() {
    try { localStorage.setItem(KEY, "1"); } catch { /* noop */ }
  }

  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (seen() || reduced) return;

  const box = document.createElement("div");
  box.className = "op-intro";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "BT-EX5 オープニングムービー");
  box.innerHTML = `
    <video class="op-intro-video" poster="../assets/opening/poster.jpg" autoplay muted playsinline preload="auto">
      ${SOURCES.map(([src, type]) => `<source src="${src}" type="${type}">`).join("")}
    </video>
    <div class="op-intro-bar">
      <button type="button" class="op-intro-btn" data-op="sound">音を出す</button>
      <button type="button" class="op-intro-btn primary" data-op="skip">スキップ</button>
    </div>`;
  document.body.appendChild(box);
  document.documentElement.classList.add("op-intro-open");
  const video = box.querySelector("video");

  function close() {
    markSeen();
    box.classList.add("is-closing");
    document.documentElement.classList.remove("op-intro-open");
    setTimeout(() => { video.pause(); box.remove(); }, 450);
    const first = document.getElementById("login-passcode");
    if (first) first.focus();
  }

  video.addEventListener("ended", () => setTimeout(close, 600));
  // どの形式も再生できなかったとき(最後の source のエラー)は閉じる
  const lastSource = video.querySelector("source:last-of-type");
  if (lastSource) lastSource.addEventListener("error", close);
  // 自動再生できなかったときは閉じる(画面を止めない)
  const p = video.play && video.play();
  if (p && p.catch) p.catch(() => close());

  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-op]");
    if (!b) return;
    if (b.dataset.op === "skip") close();
    if (b.dataset.op === "sound") {
      video.muted = !video.muted;
      b.textContent = video.muted ? "音を出す" : "音を消す";
      if (!video.muted && video.ended) { video.currentTime = 0; video.play(); }
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.contains(box)) close(); });
})();
