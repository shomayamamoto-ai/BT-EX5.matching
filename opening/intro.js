// ============================================
// オープニングムービーの再生(全画面)
// - ログイン画面: 開くたびに自動で流す(<script data-autoplay>)。
//   ブラウザの決まりで音なしで始まる。右上の「音を出す」で音が出る
// - ログイン後: ヘッダーの [data-open-movie] ボタンで流す(押したときなので音ありで始まる)
// - 画面のどこかを押すか、左上の「スキップ」で閉じる。Esc でも閉じる
// ============================================

(function () {
  "use strict";

  // パソコンなど大きな画面は 1080p、スマホは 720p(どちらも高画質)。
  // Chrome・Android は軽い WebM(VP9)を先に、Safari(iPhone・Mac)は確実に再生できる MP4 を先に
  const V = "3d4";
  const BIG = Math.max(window.innerWidth, window.innerHeight) >= 1100 && Math.min(window.innerWidth, window.innerHeight) >= 600;
  const SAFARI = /^((?!chrome|chromium|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  const base = BIG ? "bt-ex5-opening" : "bt-ex5-opening-720p";
  const MP4 = [`../assets/opening/${base}.mp4?v=${V}`, "video/mp4"];
  const WEBM = [`../assets/opening/${base}.webm?v=${V}`, "video/webm"];
  const SOURCES = SAFARI ? [MP4, WEBM] : [WEBM, MP4];
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
      <video class="op-intro-video" poster="../assets/opening/poster.jpg?v=${V}" playsinline preload="auto">
        ${SOURCES.map(([src, type]) => `<source src="${src}" type="${type}">`).join("")}
      </video>
      <button type="button" class="op-intro-btn primary op-intro-skip" data-op="skip">スキップ</button>
      <button type="button" class="op-intro-btn op-intro-sound" data-op="sound"></button>
      <p class="op-intro-hint">画面を押すとスキップ</p>`;
    // ほかの全画面(定例会の進行など)の上に出すとき
    if (opts && opts.zIndex) box.style.zIndex = String(opts.zIndex);
    (opts && opts.zIndex ? document.documentElement : document.body).appendChild(box);
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
      setTimeout(() => { video.pause(); current.remove(); if (opts && opts.onClose) opts.onClose(); }, 450);
      const back = (opts && opts.returnFocus) || (opts && opts.onClose ? null : document.getElementById("login-passcode"));
      if (back) back.focus();
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    // 終わり: 映像は最後に真っ黒になる。念のため最後の 0.6 秒で映像を黒へ溶かし、ボタンも消してから閉じる
    video.addEventListener("timeupdate", () => {
      if (video.duration && video.duration - video.currentTime < 0.6) current.classList.add("is-ending");
    });
    video.addEventListener("ended", () => { current.classList.add("is-ending"); setTimeout(close, 450); });
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
