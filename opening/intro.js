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
  // ムービーは2種類: やわらかいデザインは「新潟と東京をつなぐ」(朱鷺・新幹線・スカイツリーの絵。2026年11月)、
  // 元の黒×金のデザインは、これまでのムービー。定例会のスライドではスライドのデザイン、それ以外はサイトのデザインで選ぶ
  const V = "3d4", VS = "s3";
  const BIG = Math.max(window.innerWidth, window.innerHeight) >= 1100 && Math.min(window.innerWidth, window.innerHeight) >= 600;
  const SAFARI = /^((?!chrome|chromium|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  // long: 定例会のはじめに流す3分版(BT-EXの紹介・メンバー・スケジュールつき。やわらかいデザインだけ)
  function movie(theme, long) {
    const soft = theme !== "classic";
    const base = `bt-ex5-opening${soft ? (long ? "-soft-3min" : "-soft") : ""}${BIG ? "" : "-720p"}`;
    const v = soft ? (long ? "m2" : VS) : V;
    const MP4 = [`../assets/opening/${base}.mp4?v=${v}`, "video/mp4"];
    const WEBM = [`../assets/opening/${base}.webm?v=${v}`, "video/webm"];
    return { sources: SAFARI ? [MP4, WEBM] : [WEBM, MP4], poster: `../assets/opening/${soft ? "poster-soft" : "poster"}.jpg?v=${v}` };
  }
  const siteTheme = () => { try { return window.BtexTheme && BtexTheme.site ? BtexTheme.site() : "soft"; } catch { return "soft"; } };
  const script = document.currentScript;
  let box = null;

  function open(opts) {
    if (box) return;
    const withSound = !!(opts && opts.sound);
    box = document.createElement("div");
    box.className = "op-intro";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "BT-EX5 オープニングムービー(画面を押すとスキップ)");
    const mv = movie((opts && opts.theme) || siteTheme(), !!(opts && opts.long));
    box.innerHTML = `
      <video class="op-intro-video" poster="${mv.poster}" playsinline preload="auto">
        ${mv.sources.map(([src, type]) => `<source src="${src}" type="${type}">`).join("")}
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
    // 3分版が読めないとき(まだ置いていない・通信が切れた など)は、14秒版に切りかえる。それも読めなければ閉じる
    let fellBack = !(opts && opts.long);
    const watchLast = () => {
      const last = video.querySelector("source:last-of-type");
      if (!last) return;
      last.addEventListener("error", () => {
        if (fellBack) { close(); return; }
        fellBack = true;
        const sm = movie((opts && opts.theme) || siteTheme(), false);
        video.poster = sm.poster;
        video.innerHTML = sm.sources.map(([src, type]) => `<source src="${src}" type="${type}">`).join("");
        watchLast(); video.load(); start(video.muted).catch(close);
      });
    };
    watchLast();

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
