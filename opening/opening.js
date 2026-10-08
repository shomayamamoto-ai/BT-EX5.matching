// ============================================
// BT-EX5 オープニングムービー
// render(t) が時刻 t(秒)の画面を作る(同じ t なら同じ画面)。
// サイトでは requestAnimationFrame で再生し、動画(MP4)は1コマずつ書き出して作る。
//
//  0.0〜2.0  ひとつの光がともる                       「出会いは、ひとつの光から。」
//  2.0〜3.2  光が5つに分かれ、五角形に並ぶ(紹介・信頼・仲間・仕事・感謝)
//  3.2〜4.8  赤い糸で5つを結ぶ                         「信頼で、つながる。」
//  4.8〜7.2  糸の上を光が巡る                          「ご縁が巡る、BT-EX5。」
//  7.2〜12.0 結び目がロゴになり、名前が出る             「BT-EX5」
// ============================================

const BtexOpening = (function () {
  "use strict";

  const DURATION = 12;
  const W = 1920;
  const H = 1080;
  const CX = W / 2;
  const CY = H / 2 - 40;
  const NS = "http://www.w3.org/2000/svg";
  const R = 300; // 五角形の大きさ
  const VALUES = ["出会い", "信頼", "紹介", "仕事", "感謝"];
  const SPLIT = [2.0, 2.15, 2.3, 2.45, 2.6]; // 光が分かれて飛び出す時刻
  const FLY = 0.6;

  // ロゴ(assets/bt-ex5-mark.svg と同じ形)。64×64 の座標で、五角形の中心は (32, 32.44)、半径 18.24
  const MARK_SIZE = 380;
  const MARK_K = MARK_SIZE / 64;
  const MARK_R = 18.24 * MARK_K;
  const MARK_X = CX - 475; // ロゴの中心(名前と合わせて画面の中央に来る位置)
  const MARK_DY = (32.44 - 32) * MARK_K;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeIn = (x) => x * x * x;
  // 区間 [a,b] で 0→1、[c,d] で 1→0
  const fadeInOut = (t, a, b, c, d) => Math.min(easeOut(prog(t, a, b)), 1 - easeIn(prog(t, c, d)));

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  function pentagon(r) {
    return [0, 1, 2, 3, 4].map((k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
    });
  }

  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  const MARK_SVG = `
    <rect x="1" y="1" width="62" height="62" rx="15" fill="url(#op-mk-tile)"/>
    <rect x="1.6" y="1.6" width="60.8" height="60.8" rx="14.4" fill="none" stroke="url(#op-mk-edge)" stroke-width="1.2"/>
    <circle cx="32" cy="14.2" r="11" fill="url(#op-mk-glow)"/>
    <path d="M32 14.2 49.3 26.8 42.7 47.2H21.3L14.7 26.8Z" fill="none" stroke="url(#op-mk-thread)" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M49.3 26.8 42.7 47.2" stroke="url(#op-mk-streak)" stroke-width="3.4" stroke-linecap="round"/>
    <g fill="#fff8ec" stroke="#1c100c" stroke-width="1.2">
      <circle cx="49.3" cy="26.8" r="3.5"/><circle cx="42.7" cy="47.2" r="3.5"/><circle cx="21.3" cy="47.2" r="3.5"/><circle cx="14.7" cy="26.8" r="3.5"/>
    </g>
    <circle cx="32" cy="14.2" r="4.6" fill="#fff8ec" stroke="#ffbe4d" stroke-width="1.6"/>`;

  // ---------- 舞台を組み立てる ----------
  function mount(container, opts) {
    const o = Object.assign({ fit: "slice" }, opts);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: `xMidYMid ${o.fit}`, class: "op-stage", role: "img", "aria-label": "BT-EX5 オープニングムービー" });
    svg.innerHTML = `
      <defs>
        <radialGradient id="op-bg" cx="50%" cy="45%" r="75%">
          <stop offset="0" stop-color="#3a2219"/>
          <stop offset="0.55" stop-color="#1f1310"/>
          <stop offset="1" stop-color="#0d0807"/>
        </radialGradient>
        <radialGradient id="op-node" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#fffbe8"/>
          <stop offset="0.35" stop-color="#ffd27a"/>
          <stop offset="1" stop-color="#ff7a3c" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="op-thread" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ff7a52"/>
          <stop offset="0.55" stop-color="#f4694b"/>
          <stop offset="1" stop-color="#ffbe4d"/>
        </linearGradient>
        <filter id="op-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="op-mk-tile" x1="8" y1="2" x2="56" y2="62" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3a2219"/><stop offset="1" stop-color="#140b09"/></linearGradient>
        <linearGradient id="op-mk-thread" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff7a52"/><stop offset="0.55" stop-color="#f4694b"/><stop offset="1" stop-color="#ffbe4d"/></linearGradient>
        <radialGradient id="op-mk-glow" cx="32" cy="14.2" r="11" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.75"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
        <linearGradient id="op-mk-streak" x1="49.3" y1="26.8" x2="42.7" y2="47.2" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff4dc" stop-opacity="0"/><stop offset="0.75" stop-color="#fff4dc" stop-opacity="0.95"/><stop offset="1" stop-color="#fff4dc"/></linearGradient>
        <linearGradient id="op-mk-edge" x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#op-bg)"/>
      <g class="op-stars"></g>
      <g class="op-mark" opacity="0">${MARK_SVG}</g>
      <g class="op-web"></g>
      <g class="op-runners"></g>
      <g class="op-seed">
        <circle r="120" fill="url(#op-node)"/>
        <circle r="26" fill="#fff8ec" stroke="#ffbe4d" stroke-width="6"/>
      </g>
      <g class="op-brand">
        <text class="op-wordmark" x="0" y="0" text-anchor="start"><tspan class="op-bt">BT-</tspan><tspan class="op-ex5">EX5</tspan></text>
        <text class="op-tagline" x="0" y="0" text-anchor="start">新潟・東京　日本海側最大の経営者コミュニティ</text>
        <text class="op-area" x="0" y="0" text-anchor="start">NIIGATA ・ TOKYO</text>
      </g>
      <text class="op-line" x="${CX}" y="${H - 150}" text-anchor="middle"></text>`;
    container.appendChild(svg);

    const q = (s) => svg.querySelector(s);
    const parts = {
      stars: [],
      mark: q(".op-mark"),
      web: q(".op-web"),
      runners: q(".op-runners"),
      seed: q(".op-seed"),
      brand: q(".op-brand"),
      wordmark: q(".op-wordmark"),
      tagline: q(".op-tagline"),
      area: q(".op-area"),
      line: q(".op-line"),
      pts: pentagon(R),
      nodes: [],
      labels: [],
      thread: null,
      threadLen: 5 * 2 * R * Math.sin(Math.PI / 5),
      runnerDots: [],
    };

    const rnd = seeded(5);
    const starG = q(".op-stars");
    for (let i = 0; i < 90; i++) {
      const s = el("circle", { cx: rnd() * W, cy: rnd() * H, r: 0.8 + rnd() * 2.4, fill: rnd() < 0.7 ? "#ffd98a" : "#ff9d6b" }, starG);
      parts.stars.push({ e: s, phase: rnd() * Math.PI * 2, speed: 0.6 + rnd() * 1.6, base: 0.15 + rnd() * 0.45, drift: (rnd() - 0.5) * 14 });
    }

    const d = parts.pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + "Z";
    parts.thread = el("path", { d, fill: "none", stroke: "url(#op-thread)", "stroke-width": 9, "stroke-linejoin": "round", "stroke-linecap": "round", filter: "url(#op-glow)" }, parts.web);
    parts.thread.setAttribute("stroke-dasharray", `${parts.threadLen} ${parts.threadLen}`);
    parts.pts.forEach((p, i) => {
      const g = el("g", {}, parts.web);
      el("circle", { r: 70, fill: "url(#op-node)" }, g);
      el("circle", { r: i === 0 ? 28 : 22, fill: "#fff8ec", stroke: i === 0 ? "#ffbe4d" : "#1c100c", "stroke-width": i === 0 ? 7 : 5 }, g);
      parts.nodes.push(g);
      const out = [p[0] - CX, p[1] - CY];
      const len = Math.hypot(out[0], out[1]);
      const lx = p[0] + (out[0] / len) * 92 + Math.sign(out[0]) * (Math.abs(out[0]) > 100 ? 34 : 0);
      const ly = p[1] + (out[1] / len) * 74 + 14;
      const label = el("text", { x: lx, y: ly, "text-anchor": "middle", class: "op-value" }, parts.web);
      label.textContent = VALUES[i];
      parts.labels.push(label);
    });
    for (let i = 0; i < 5; i++) {
      const g = el("g", {}, parts.runners);
      for (let k = 0; k < 6; k++) el("circle", { r: 9 - k * 1.3, fill: k ? "#ffcf80" : "#fffbe8", opacity: 1 - k * 0.15 }, g);
      parts.runnerDots.push(g);
    }

    const style = document.createElement("style");
    style.textContent = `
      .op-stage { display: block; width: 100%; height: 100%; background: #0d0807; }
      .op-line { font-family: "Shippori Mincho", "Noto Serif JP", serif; font-weight: 700; font-size: 76px; letter-spacing: 0.12em; fill: #fff3dc; }
      .op-value { font-family: "Shippori Mincho", "Noto Serif JP", serif; font-weight: 700; font-size: 40px; letter-spacing: 0.1em; fill: #ffe2b0; }
      .op-wordmark { font-family: "Inter", "Noto Sans JP", sans-serif; font-weight: 800; font-size: 150px; letter-spacing: 0.04em; }
      .op-bt { fill: #fff3dc; }
      .op-ex5 { fill: #ff8a5c; }
      .op-tagline { font-family: "Shippori Mincho", "Noto Serif JP", serif; font-weight: 700; font-size: 38px; letter-spacing: 0.08em; fill: #ffe2b0; }
      .op-area { font-family: "Inter", sans-serif; font-weight: 700; font-size: 26px; letter-spacing: 0.5em; fill: #c99a6a; }`;
    svg.prepend(style);

    return { svg, render: (t) => render(parts, t) };
  }

  // ---------- 時刻 t の画面 ----------
  function render(p, t) {
    t = clamp(t, 0, DURATION);

    p.stars.forEach((s) => {
      const tw = s.base + 0.35 * Math.sin(t * s.speed + s.phase);
      s.e.setAttribute("opacity", clamp(tw).toFixed(3));
      s.e.setAttribute("transform", `translate(0 ${(s.drift * t).toFixed(1)})`);
    });

    // ---- 場面1: ひとつの光(0〜2.4)
    const seedIn = easeOut(prog(t, 0.3, 1.1));
    const seedPulse = 1 + 0.08 * Math.sin(t * 4);
    const seedOut = 1 - easeIn(prog(t, 2.0, 2.5));
    p.seed.setAttribute("transform", `translate(${CX} ${CY}) scale(${(seedIn * seedPulse * (0.6 + 0.4 * seedOut)).toFixed(3)})`);
    p.seed.setAttribute("opacity", (seedIn * seedOut).toFixed(3));

    // ---- 場面5で結び目がロゴの位置・大きさへ縮む(7.2〜8.4)
    const shrink = easeInOut(prog(t, 7.2, 8.4));
    const webScale = 1 - shrink * (1 - MARK_R / R);
    const webTx = (MARK_X - CX) * shrink;
    const webTy = MARK_DY * shrink;
    p.web.style.display = t >= 2.0 ? "" : "none";
    p.web.setAttribute("transform", `translate(${(CX + webTx).toFixed(1)} ${(CY + webTy).toFixed(1)}) scale(${webScale.toFixed(4)}) translate(${-CX} ${-CY})`);

    // ---- 場面2: 光が5つに分かれる(2.0〜3.2)
    p.nodes.forEach((n, i) => {
      const f = easeOut(prog(t, SPLIT[i], SPLIT[i] + FLY));
      const [px, py] = p.pts[i];
      const x = CX + (px - CX) * f;
      const y = CY + (py - CY) * f;
      const pulse = 1 + 0.08 * Math.sin((t - SPLIT[i]) * 5) * (t > 4.8 && t < 7.2 ? 1 : 0);
      const a = t >= SPLIT[i] ? clamp(0.3 + f) : 0;
      n.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${((0.5 + 0.5 * f) * pulse * (1 - 0.25 * shrink)).toFixed(3)})`);
      n.setAttribute("opacity", Math.min(1, a).toFixed(3));
    });
    p.labels.forEach((l, i) => l.setAttribute("opacity", (fadeInOut(t, SPLIT[i] + FLY, SPLIT[i] + FLY + 0.4, 7.0, 7.4)).toFixed(3)));

    // ---- 場面3: 赤い糸で結ぶ(3.2〜4.4)
    const draw = easeInOut(prog(t, 3.2, 4.4));
    p.thread.setAttribute("stroke-dashoffset", (p.threadLen * (1 - draw)).toFixed(1));

    // ---- 場面4: 光が巡る(4.4〜7.4)
    const run = t >= 4.4 && t <= 7.6;
    p.runners.style.display = run ? "" : "none";
    if (run) {
      const fade = fadeInOut(t, 4.4, 4.8, 7.0, 7.4);
      p.runnerDots.forEach((g, i) => {
        [...g.children].forEach((c, k) => {
          const u = ((t - 4.4) * 0.55 + i / 5 - k * 0.012 + 10) % 1;
          const pt = p.thread.getPointAtLength(u * p.threadLen);
          c.setAttribute("cx", pt.x.toFixed(1));
          c.setAttribute("cy", pt.y.toFixed(1));
        });
        g.setAttribute("opacity", fade.toFixed(3));
      });
    }

    // ---- 場面5: ロゴと名前(7.2〜12)
    const markIn = easeOut(prog(t, 8.0, 8.8));
    p.mark.setAttribute("opacity", markIn.toFixed(3));
    p.mark.setAttribute("transform", `translate(${(MARK_X - 32 * MARK_K).toFixed(1)} ${(CY - 32 * MARK_K).toFixed(1)}) scale(${MARK_K.toFixed(4)})`);
    // 動く結び目から、ロゴの形へ入れかえる
    p.web.setAttribute("opacity", (1 - easeInOut(prog(t, 8.4, 9.0))).toFixed(3));
    const brandIn = easeOut(prog(t, 8.6, 9.6));
    p.brand.setAttribute("opacity", brandIn.toFixed(3));
    const bx = MARK_X + MARK_SIZE / 2 + 50 + (1 - brandIn) * 60;
    p.wordmark.setAttribute("x", bx.toFixed(1));
    p.wordmark.setAttribute("y", (CY + 40).toFixed(1));
    p.tagline.setAttribute("x", bx.toFixed(1));
    p.tagline.setAttribute("y", (CY + 122).toFixed(1));
    p.tagline.setAttribute("opacity", easeOut(prog(t, 9.2, 10.0)).toFixed(3));
    p.area.setAttribute("x", (bx + 6).toFixed(1));
    p.area.setAttribute("y", (CY - 110).toFixed(1));
    p.area.setAttribute("opacity", easeOut(prog(t, 9.6, 10.4)).toFixed(3));

    // ---- 字幕
    const lines = [
      [0.7, 1.1, 1.9, 2.3, "出会いは、ひとつの光から。"],
      [3.3, 3.7, 4.5, 4.9, "信頼で、つながる。"],
      [5.0, 5.4, 6.6, 7.0, "ご縁が巡る、BT-EX5。"],
    ];
    const cur = lines.find((l) => t >= l[0] && t < l[3]);
    if (cur) {
      p.line.textContent = cur[4];
      p.line.setAttribute("opacity", fadeInOut(t, cur[0], cur[1], cur[2], cur[3]).toFixed(3));
      p.line.setAttribute("transform", `translate(0 ${((1 - easeOut(prog(t, cur[0], cur[1]))) * 24).toFixed(1)})`);
    } else {
      p.line.setAttribute("opacity", "0");
    }
  }

  // ---------- サイトでの再生 ----------
  function play(container, opts) {
    const o = Object.assign({ onEnd: null }, opts);
    const stage = mount(container, o);
    let start = null;
    let raf = 0;
    function frame(now) {
      if (start === null) start = now;
      const t = (now - start) / 1000;
      stage.render(t);
      if (t < DURATION) raf = requestAnimationFrame(frame);
      else if (o.onEnd) o.onEnd();
    }
    stage.render(0);
    raf = requestAnimationFrame(frame);
    return { stop() { cancelAnimationFrame(raf); }, stage };
  }

  return { DURATION, W, H, mount, play, render };
})();
