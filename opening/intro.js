// ============================================
// オープニングムービーの再生(全画面)
// - ログイン画面: 開くたびに自動で流す(<script data-autoplay>)。
//   ブラウザの決まりで音なしで始まる。右上の「音を出す」で音が出る
// - ログイン後: ヘッダーの [data-open-movie] ボタンで流す(押したときなので音ありで始まる)
// - 画面のどこかを押すか、左上の「スキップ」で閉じる。Esc でも閉じる
// ============================================

(function () {
  "use strict";

  // H.264 が再生できないブラウザ(Chromium など)には WebM を使う
  const SOURCES = [
    ["../assets/opening/bt-ex5-opening-720p.mp4", "video/mp4"],
    ["../assets/opening/bt-ex5-opening-720p.webm", "video/webm"],
  ];
  const script = document.currentScript;
  let box = null;

  function open(opts) {
    if (box) return;
    const withSound = !!(opts && opts.sound);
    box = document.createElement("div");
    box.className = "op-intro";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "BT-EX5 オープニングムービー(画面を押すとスキップ)");
    box.innerHTML = `
      <video class="op-intro-video" poster="../assets/opening/poster.jpg" playsinline preload="auto">
        ${SOURCES.map(([src, type]) => `<source src="${src}" type="${type}">`).join("")}
      </video>
      <button type="button" class="op-intro-btn primary op-intro-skip" data-op="skip">スキップ</button>
      <button type="button" class="op-intro-btn op-intro-sound" data-op="sound"></button>
      <p class="op-intro-hint">画面を押すとスキップ</p>`;
    document.body.appendChild(box);
    document.documentElement.classList.add("op-intro-open");
    const video = box.querySelector("video");
    const soundBtn = box.querySelector("[data-op=sound]");
    const current = box;
    const setMuted = (m) => { video.muted = m; soundBtn.textContent = m ? "音を出す" : "音を消す"; };

    function close() {
      if (box !== current) return;
      box = null;
      current.classList.add("is-closing");
      document.documentElement.classList.remove("op-intro-open");
      document.removeEventListener("keydown", onKey);
      setTimeout(() => { video.pause(); current.remove(); }, 450);
      const back = (opts && opts.returnFocus) || document.getElementById("login-passcode");
      if (back) back.focus();
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    video.addEventListener("ended", () => setTimeout(close, 600));
    // どの形式も再生できなかったとき(最後の source のエラー)は閉じる
    const lastSource = video.querySelector("source:last-of-type");
    if (lastSource) lastSource.addEventListener("error", close);

    function start(muted) {
      setMuted(muted);
      const p = video.play && video.play();
      return p && p.catch ? p : Promise.resolve();
    }
    // 音ありで始められなければ音なしで、それもだめなら閉じる(画面を止めない)
    start(!withSound).catch(() => (withSound ? start(true) : Promise.reject())).catch(close);

    current.addEventListener("click", (e) => {
      const b = e.target.closest("[data-op]");
      if (b && b.dataset.op === "sound") {
        setMuted(!video.muted);
        if (!video.muted && video.ended) { video.currentTime = 0; video.play(); }
        return;
      }
      close(); // スキップボタン、または画面のどこか
    });
    document.addEventListener("keydown", onKey);
    current.querySelector("[data-op=skip]").focus({ preventScroll: true });
  }

  window.BtexIntro = { open };

  // ログイン後: ヘッダーのボタン
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open-movie]");
    if (!b) return;
    e.preventDefault();
    open({ sound: true, returnFocus: b });
  });

  // ログイン画面: 開くたびに流す(自動テストでは window.__btex5NoIntro で止められる)
  if (script && script.hasAttribute("data-autoplay") && !window.__btex5NoIntro) open({ sound: false });
})();
