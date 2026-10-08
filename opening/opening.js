// ============================================
// BT-EX5 オープニングムービー「ご縁(5円)× チーム5」
// render(t) が時刻 t(秒)の画面を作る(同じ t なら同じ画面)。
// サイトでは requestAnimationFrame で再生し、動画(MP4)は1コマずつ書き出して作る。
//
//  0.0〜2.4  5円玉が回りながら落ちてきて、チャリンと止まる   「5円は、ご縁。」
//  2.4〜5.0  穴の中へ飛び込む                             「ひとつのご縁が、」
//  5.0〜8.6  5つの光がともり、赤い糸で結ばれる             「5つの縁を結ぶ。」
//  8.6〜10.8 糸の上を光が巡る                             「紹介が巡る、チーム5。」
// 10.8〜15.0 結び目がロゴになり、名前が出る               「BT-EX5」
// ============================================

const BtexOpening = (function () {
  "use strict";

  const DURATION = 15;
  const W = 1920;
  const H = 1080;
  const CX = W / 2;
  const CY = H / 2 - 40;
  const NS = "http://www.w3.org/2000/svg";
  const VALUES = ["紹介", "信頼", "仲間", "仕事", "感謝"];
  const NODE_TIMES = [5.2, 5.6, 6.0, 6.4, 6.8];

  // ---------- 補助 ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeIn = (x) => x * x * x;
  // 落下して2回はずむ
  function bounce(x) {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  }
  // 区間 [a,b] で 0→1、[c,d] で 1→0
  const fadeInOut = (t, a, b, c, d) => Math.min(easeOut(prog(t, a, b)), 1 - easeIn(prog(t, c, d)));

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  // 五角形の頂点(半径 r、上から時計回り)
  function pentagon(r) {
    return [0, 1, 2, 3, 4].map((k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
    });
  }

  // 決まった並びの乱数(毎回同じ星空にする)
  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

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
        <linearGradient id="op-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff0b8"/>
          <stop offset="0.35" stop-color="#f6cf6a"/>
          <stop offset="0.7" stop-color="#dba23a"/>
          <stop offset="1" stop-color="#b9781f"/>
        </linearGradient>
        <linearGradient id="op-rim" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#fff3c4"/>
          <stop offset="0.5" stop-color="#c58a2a"/>
          <stop offset="1" stop-color="#8f5a14"/>
        </linearGradient>
        <radialGradient id="op-light" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#fff7dc"/>
          <stop offset="0.45" stop-color="#ffd27a" stop-opacity="0.85"/>
          <stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="op-node" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#fffbe8"/>
          <stop offset="0.35" stop-color="#ffd27a"/>
          <stop offset="1" stop-color="#ff7a3c" stop-opacity="0"/>
        </radialGradient>
        <filter id="op-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <mask id="op-hole">
          <rect x="-400" y="-400" width="800" height="800" fill="#fff"/>
          <circle cx="0" cy="0" r="38" fill="#000"/>
        </mask>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#op-bg)"/>
      <g class="op-stars"></g>
      <g class="op-coin-wrap">
        <ellipse class="op-shadow" cx="0" cy="0" rx="170" ry="18" fill="#000" opacity="0.5"/>
        <g class="op-coin">
          <g mask="url(#op-hole)">
            <circle r="174" fill="url(#op-face)"/>
            <circle r="164" fill="none" stroke="url(#op-rim)" stroke-width="14"/>
            <circle r="148" fill="none" stroke="#9a6418" stroke-opacity="0.35" stroke-width="4"/>
            <path class="op-coin-shine" d="M-117 -60a130 130 0 0 1 102 -80" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="12" stroke-linecap="round"/>
            <g class="op-coin-thread">
              <path d="M0 -101 96 -31 59 82H-59L-96 -31Z" fill="none" stroke="#d8402a" stroke-width="12" stroke-linejoin="round"/>
              <g fill="#fff8e6" stroke="#d8402a" stroke-width="8">
                <circle cx="0" cy="-101" r="18"/><circle cx="96" cy="-31" r="18"/><circle cx="59" cy="82" r="18"/><circle cx="-59" cy="82" r="18"/><circle cx="-96" cy="-31" r="18"/>
              </g>
            </g>
          </g>
          <circle r="42" fill="none" stroke="#8f5a14" stroke-width="8" stroke-opacity="0.8"/>
        </g>
      </g>
      <circle class="op-holelight" r="38" fill="url(#op-light)"/>
      <path class="op-glint" d="M0 -46C4 -10 10 -4 46 0 10 4 4 10 0 46 -4 10 -10 4 -46 0 -10 -4 -4 -10 0 -46Z" fill="#fff"/>
      <g class="op-web"></g>
      <g class="op-runners"></g>
      <g class="op-brand">
        <text class="op-wordmark" x="0" y="0" text-anchor="start"><tspan class="op-bt">BT-</tspan><tspan class="op-ex5">EX5</tspan></text>
        <text class="op-tagline" x="0" y="0" text-anchor="start">ご縁でつながる 紹介者制コミュニティ</text>
        <text class="op-area" x="0" y="0" text-anchor="start">NIIGATA ・ TOKYO</text>
      </g>
      <text class="op-line" x="${CX}" y="${H - 150}" text-anchor="middle"></text>
      <rect class="op-flash" width="${W}" height="${H}" fill="#fff4dc" opacity="0"/>`;
    container.appendChild(svg);

    const q = (s) => svg.querySelector(s);
    const parts = {
      stars: [],
      coinWrap: q(".op-coin-wrap"),
      coin: q(".op-coin"),
      shadow: q(".op-shadow"),
      shine: q(".op-coin-shine"),
      coinThread: q(".op-coin-thread"),
      holeLight: q(".op-holelight"),
      glint: q(".op-glint"),
      web: q(".op-web"),
      runners: q(".op-runners"),
      brand: q(".op-brand"),
      wordmark: q(".op-wordmark"),
      tagline: q(".op-tagline"),
      area: q(".op-area"),
      line: q(".op-line"),
      flash: q(".op-flash"),
      nodes: [],
      labels: [],
      thread: null,
      threadLen: 0,
      runnerDots: [],
    };

    // 星(金の粒)
    const rnd = seeded(5);
    const starG = q(".op-stars");
    for (let i = 0; i < 90; i++) {
      const s = el("circle", { cx: rnd() * W, cy: rnd() * H, r: 0.8 + rnd() * 2.4, fill: rnd() < 0.7 ? "#ffd98a" : "#ff9d6b" }, starG);
      parts.stars.push({ e: s, phase: rnd() * Math.PI * 2, speed: 0.6 + rnd() * 1.6, base: 0.15 + rnd() * 0.45, drift: (rnd() - 0.5) * 14 });
    }

    // 5つの点と赤い糸
    const pts = pentagon(300);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + "Z";
    parts.thread = el("path", { d, fill: "none", stroke: "#e2442b", "stroke-width": 7, "stroke-linejoin": "round", "stroke-linecap": "round", filter: "url(#op-glow)" }, parts.web);
    parts.threadLen = 5 * 2 * 300 * Math.sin(Math.PI / 5);
    parts.thread.setAttribute("stroke-dasharray", `${parts.threadLen} ${parts.threadLen}`);
    pts.forEach((p, i) => {
      const g = el("g", { transform: `translate(${p[0]} ${p[1]})` }, parts.web);
      el("circle", { r: 70, fill: "url(#op-node)" }, g);
      el("circle", { r: 22, fill: "#fff8e6", stroke: "#e2442b", "stroke-width": 6 }, g);
      parts.nodes.push(g);
      const out = [p[0] - CX, p[1] - CY];
      const len = Math.hypot(out[0], out[1]);
      // 点の外側に名前を置く(左右の点は横に大きく離す)
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
      .op-ex5 { fill: #ffbe4d; }
      .op-tagline { font-family: "Shippori Mincho", "Noto Serif JP", serif; font-weight: 700; font-size: 46px; letter-spacing: 0.16em; fill: #ffe2b0; }
      .op-area { font-family: "Inter", sans-serif; font-weight: 700; font-size: 26px; letter-spacing: 0.5em; fill: #c99a6a; }`;
    svg.prepend(style);

    return { svg, render: (t) => render(parts, t) };
  }

  // ---------- 時刻 t の画面 ----------
  function render(p, t) {
    t = clamp(t, 0, DURATION);

    // 星はゆっくり瞬く
    p.stars.forEach((s) => {
      const tw = s.base + 0.35 * Math.sin(t * s.speed + s.phase);
      s.e.setAttribute("opacity", clamp(tw).toFixed(3));
      s.e.setAttribute("transform", `translate(0 ${(s.drift * t).toFixed(1)})`);
    });

    // ---- 場面1: 5円玉が回りながら落ちる(0〜2.4)
    const fall = bounce(prog(t, 0.2, 2.0));
    const y = CY - 760 * (1 - fall);
    const spin = 1 - easeOut(prog(t, 0.2, 2.1));
    const flip = Math.cos(spin * Math.PI * 6); // 3回転して正面で止まる
    const sx = Math.max(0.04, Math.abs(flip));
    // 場面2: 穴の中へ(3.4〜5.0)
    const dive = easeIn(prog(t, 3.4, 5.0));
    const scale = 1 + dive * 60;
    const coinVisible = t < 5.1;
    p.coinWrap.style.display = coinVisible ? "" : "none";
    p.coin.setAttribute("transform", `translate(${CX} ${y}) scale(${(sx * scale).toFixed(4)} ${scale.toFixed(4)})`);
    p.coin.setAttribute("opacity", (fadeInOut(t, 0.1, 0.4, 4.7, 5.05)).toFixed(3));
    p.shadow.setAttribute("transform", `translate(${CX} ${CY + 210}) scale(${(0.3 + 0.7 * fall) * (1 - dive)} 1)`);
    p.shadow.setAttribute("opacity", (0.45 * fall * (1 - dive)).toFixed(3));
    p.coinThread.setAttribute("opacity", "1");
    // 穴からの光
    const holeGlow = easeOut(prog(t, 2.6, 3.4)) * (1 - prog(t, 5.0, 5.5));
    p.holeLight.setAttribute("transform", `translate(${CX} ${y}) scale(${(1 + dive * 60).toFixed(3)})`);
    p.holeLight.setAttribute("opacity", (holeGlow * 0.95).toFixed(3));
    // 着地のきらめき
    const gl = fadeInOut(t, 1.95, 2.15, 2.3, 2.8);
    p.glint.setAttribute("transform", `translate(${CX - 90} ${CY - 110}) scale(${(0.4 + gl).toFixed(3)}) rotate(${(t * 40).toFixed(1)})`);
    p.glint.setAttribute("opacity", gl.toFixed(3));
    // 飛び込んだ瞬間の光
    p.flash.setAttribute("opacity", (0.85 * fadeInOut(t, 4.75, 5.0, 5.05, 5.6)).toFixed(3));

    // ---- 場面3: 5つの光と赤い糸(5.0〜8.6)
    const webOn = t >= 5.0;
    p.web.style.display = webOn ? "" : "none";
    if (t < 11.8) p.web.setAttribute("opacity", "1");
    // 場面5で結び目がロゴの大きさまで縮む
    const shrink = easeInOut(prog(t, 10.8, 12.2));
    const logoX = CX - 330;
    const webScale = 1 - shrink * (1 - 101 / 300);
    const webTx = (logoX - CX) * shrink;
    p.web.setAttribute("transform", `translate(${(CX + webTx).toFixed(1)} ${CY}) scale(${webScale.toFixed(4)}) translate(${-CX} ${-CY})`);
    p.nodes.forEach((n, i) => {
      const a = easeOut(prog(t, NODE_TIMES[i], NODE_TIMES[i] + 0.35)) * (1 - 0.25 * shrink);
      const pulse = 1 + 0.08 * Math.sin((t - NODE_TIMES[i]) * 5) * (t > 8.6 && t < 10.8 ? 1 : 0);
      const tr = n.getAttribute("transform").replace(/ scale\([^)]*\)/, "");
      n.setAttribute("transform", `${tr} scale(${(a * pulse).toFixed(3)})`);
      n.setAttribute("opacity", a.toFixed(3));
    });
    p.labels.forEach((l, i) => l.setAttribute("opacity", (fadeInOut(t, NODE_TIMES[i] + 0.15, NODE_TIMES[i] + 0.6, 10.6, 11.1)).toFixed(3)));
    const draw = easeInOut(prog(t, 7.0, 8.4));
    p.thread.setAttribute("stroke-dashoffset", (p.threadLen * (1 - draw)).toFixed(1));
    p.thread.setAttribute("stroke-width", (7 + shrink * 9).toFixed(2));

    // ---- 場面4: 糸の上を光が巡る(8.6〜10.8)
    const run = t >= 8.4 && t <= 11.2;
    p.runners.style.display = run ? "" : "none";
    if (run) {
      const speed = 0.55; // 1秒で周の55%
      const fade = fadeInOut(t, 8.4, 8.8, 10.7, 11.1);
      p.runnerDots.forEach((g, i) => {
        [...g.children].forEach((c, k) => {
          const u = ((t - 8.4) * speed + i / 5 - k * 0.012 + 10) % 1;
          const pt = p.thread.getPointAtLength(u * p.threadLen);
          c.setAttribute("cx", pt.x.toFixed(1));
          c.setAttribute("cy", pt.y.toFixed(1));
        });
        g.setAttribute("opacity", fade.toFixed(3));
      });
    }

    // ---- 場面5: ロゴと名前(10.8〜15)
    const brandIn = easeOut(prog(t, 12.0, 13.0));
    p.brand.setAttribute("opacity", brandIn.toFixed(3));
    const bx = logoX + 230 + (1 - brandIn) * 60;
    p.wordmark.setAttribute("x", bx.toFixed(1));
    p.wordmark.setAttribute("y", (CY + 30).toFixed(1));
    p.tagline.setAttribute("x", bx.toFixed(1));
    p.tagline.setAttribute("y", (CY + 112).toFixed(1));
    p.tagline.setAttribute("opacity", easeOut(prog(t, 12.6, 13.4)).toFixed(3));
    p.area.setAttribute("x", (bx + 6).toFixed(1));
    p.area.setAttribute("y", (CY - 118).toFixed(1));
    p.area.setAttribute("opacity", easeOut(prog(t, 13.0, 13.8)).toFixed(3));
    // ロゴのコイン面: 結び目の後ろに金の面が現れる
    if (t >= 11.8) {
      p.coinWrap.style.display = "";
      const c = easeOut(prog(t, 11.8, 12.6));
      p.coin.setAttribute("transform", `translate(${logoX} ${CY}) scale(${(c).toFixed(4)})`);
      p.coin.setAttribute("opacity", c.toFixed(3));
      // 結び目(動く点)から、ロゴの赤い糸へ入れかえる
      const swap = easeInOut(prog(t, 12.6, 13.3));
      p.coinThread.setAttribute("opacity", swap.toFixed(3));
      p.web.setAttribute("opacity", (1 - swap).toFixed(3));
      p.shadow.setAttribute("opacity", "0");
      p.holeLight.setAttribute("opacity", "0");
    }

    // ---- 字幕
    const lines = [
      [0.9, 1.3, 3.0, 3.5, "5円は、ご縁。"],
      [3.6, 4.0, 4.7, 5.0, "ひとつのご縁が、"],
      [7.2, 7.6, 8.5, 8.9, "5つの縁を結ぶ。"],
      [9.0, 9.4, 10.5, 10.9, "紹介が巡る、チーム5。"],
    ];
    const cur = lines.find((l) => t >= l[0] && t < l[3]);
    if (cur) {
      p.line.textContent = cur[4];
      const a = fadeInOut(t, cur[0], cur[1], cur[2], cur[3]);
      p.line.setAttribute("opacity", a.toFixed(3));
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
