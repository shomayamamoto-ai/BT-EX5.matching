// ============================================
// BT-EX5 オープニングムービー(13秒)
// render(t) が時刻 t(秒)の画面を作る(同じ t なら同じ画面)。
// 動画(MP4)は、1コマずつ画面を撮って書き出して作る(opening/src/README.md)。
//
// 方針: 黒と金だけの色、細い線、広い字間、余白。霧・粒子・フィルムの粒・周辺減光で空気を作り、
// 光の筋とピント送りでロゴを見せる。音はロゴが決まる瞬間(9.0秒)に合わせる。
//
//  0.0〜3.4  暗やみにひとつの光がともる            「出会いは、ひとつの光から。」
//  3.0〜4.4  光が5つに分かれ、軌跡を残して五角形に並ぶ(出会い・信頼・紹介・仕事・感謝)
//  4.4〜6.6  金の糸で5つを結ぶ                        「信頼で、つながる。」
//  5.9〜8.4  糸の上を光が巡る                         「ご縁が巡る、BT-EX5。」
//  8.2〜9.0  五角形が集まり、光がためられる
//  9.0       光の筋とともにロゴが決まる
//  9.4〜13.0 名前と一言が出て、静かに終わる
// ============================================

const BtexOpening = (function () {
  "use strict";

  const DURATION = 13;
  const W = 1920;
  const H = 1080;
  const CX = W / 2;
  const CY = 500; // 物語の五角形の中心
  const NS = "http://www.w3.org/2000/svg";
  const R = 290; // 物語の五角形の大きさ
  const VALUES = ["出会い", "信頼", "紹介", "仕事", "感謝"];
  const SPLIT = 3.0; // 光が分かれる時刻
  const FLY = 0.9;
  const HIT = 9.0; // ロゴが決まる時刻

  // ロゴ(assets/bt-ex5-mark.svg と同じ形。64×64 の座標で輪の中心は (32,32)、半径 21。
  // 5つの弧の輪と、切れ目にいる5つの点、内側でそれを結ぶ細い五角形)
  const MK = 5.0; // ロゴの拡大率
  const MARK_CY = 352; // ロゴの五角形の中心(画面上)
  const MARK_R = 21 * MK;
  const WORD_Y = 640;
  const RULE_Y = 700;
  const TAG_Y = 768;

  const GOLD = "#d9b77a";
  const GOLD_LIGHT = "#f3dfb3";
  const INK = "#f2ead9";

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeIn = (x) => x * x * x;
  const lerp = (a, b, x) => a + (b - a) * x;
  // 区間 [a,b] で 0→1、[c,d] で 1→0
  const fadeInOut = (t, a, b, c, d) => Math.min(easeOut(prog(t, a, b)), 1 - easeIn(prog(t, c, d)));

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  function pentagon(cx, cy, r) {
    return [0, 1, 2, 3, 4].map((k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  }
  const pathOf = (pts) => `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")} Z`;

  // 周の上の位置(0〜1、上の頂点から時計回り)
  function onPerimeter(pts, u) {
    const x = ((u % 1) + 1) % 1 * 5;
    const i = Math.floor(x);
    const f = x - i;
    const a = pts[i];
    const b = pts[(i + 1) % 5];
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }

  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  // 漂う粒子(手前ほど大きくぼける)
  const rnd = seeded(20261009);
  const DUST = Array.from({ length: 90 }, () => {
    const z = rnd();
    return { x: rnd() * W, y: rnd() * H, z, r: 1 + z * z * 9, sp: 6 + z * 22, ph: rnd() * Math.PI * 2, a: 0.25 + rnd() * 0.55 };
  });

  function mount(container, opts) {
    const o = Object.assign({ fit: "slice" }, opts);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: `xMidYMid ${o.fit}`, class: "op-stage", role: "img", "aria-label": "BT-EX5 オープニングムービー" });
    svg.innerHTML = `
      <defs>
        <radialGradient id="op-haze1" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#4a2c16" stop-opacity="0.55"/><stop offset="1" stop-color="#4a2c16" stop-opacity="0"/></radialGradient>
        <radialGradient id="op-haze2" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#2a1d2e" stop-opacity="0.5"/><stop offset="1" stop-color="#2a1d2e" stop-opacity="0"/></radialGradient>
        <radialGradient id="op-vig" cx="0.5" cy="0.48" r="0.72"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></radialGradient>
        <radialGradient id="op-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff6e2" stop-opacity="1"/><stop offset="0.25" stop-color="${GOLD_LIGHT}" stop-opacity="0.55"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>
        <radialGradient id="op-dust" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f6e3bd" stop-opacity="0.9"/><stop offset="1" stop-color="#f6e3bd" stop-opacity="0"/></radialGradient>
        <linearGradient id="op-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d397"/><stop offset="0.5" stop-color="#b88a45"/><stop offset="1" stop-color="#ead09a"/></linearGradient>
        <linearGradient id="op-mk-gold" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f3d89e"/><stop offset="0.5" stop-color="#bf8f45"/><stop offset="1" stop-color="#f0d6a0"/></linearGradient>
        <linearGradient id="op-streak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd9a0" stop-opacity="0"/><stop offset="0.5" stop-color="#fff4dc" stop-opacity="1"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></linearGradient>
        <linearGradient id="op-word-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2d9a2"/><stop offset="0.6" stop-color="#c99a52"/><stop offset="1" stop-color="#e6c88f"/></linearGradient>
        <linearGradient id="op-rule" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD}" stop-opacity="0"/><stop offset="0.5" stop-color="${GOLD_LIGHT}"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient>
        <linearGradient id="op-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <filter id="op-blur-near" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
        <filter id="op-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="op-line-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur id="op-line-blur-v" stdDeviation="0"/></filter>
        <filter id="op-mark-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur id="op-mark-blur-v" stdDeviation="0"/></filter>
        <filter id="op-word-blur" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur id="op-word-blur-v" stdDeviation="0"/></filter>
        <filter id="op-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence id="op-grain-noise" type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="1"/>
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0"/>
        </filter>
        <mask id="op-sheen-mask"><g id="op-sheen-shapes"></g></mask>
      </defs>
      <rect width="${W}" height="${H}" fill="#060508"/>
      <g id="op-haze">
        <ellipse id="op-haze-a" cx="${CX}" cy="${CY}" rx="900" ry="620" fill="url(#op-haze1)"/>
        <ellipse id="op-haze-b" cx="${CX}" cy="${CY}" rx="760" ry="520" fill="url(#op-haze2)"/>
      </g>
      <g id="op-dust-far"></g>
      <g id="op-world"></g>
      <g id="op-final"></g>
      <g id="op-dust-near" filter="url(#op-blur-near)"></g>
      <g id="op-flash"></g>
      <text class="op-line" id="op-line" x="${CX}" y="${H - 170}" text-anchor="middle" filter="url(#op-line-blur)"></text>
      <rect width="${W}" height="${H}" fill="url(#op-vig)"/>
      <rect width="${W}" height="${H}" filter="url(#op-grain)" style="mix-blend-mode:overlay"/>
      <rect id="op-fade" width="${W}" height="${H}" fill="#000" opacity="0"/>`;
    container.appendChild(svg);

    const q = (sel) => svg.querySelector(sel);
    const parts = {
      svg,
      hazeA: q("#op-haze-a"), hazeB: q("#op-haze-b"),
      dustFar: q("#op-dust-far"), dustNear: q("#op-dust-near"),
      world: q("#op-world"), final: q("#op-final"), flash: q("#op-flash"),
      line: q("#op-line"), lineBlur: q("#op-line-blur-v"),
      markBlur: q("#op-mark-blur-v"), wordBlur: q("#op-word-blur-v"),
      grain: q("#op-grain-noise"), fade: q("#op-fade"),
    };

    // 粒子
    parts.dust = DUST.map((d) => el("circle", { r: d.r.toFixed(1), fill: "url(#op-dust)" }, d.z > 0.72 ? parts.dustNear : parts.dustFar));

    // ---- 物語の層(光・軌跡・糸・巡る光・言葉) ----
    const w = parts.world;
    parts.threadGlow = el("path", { fill: "none", stroke: GOLD, "stroke-width": "10", opacity: "0", filter: "url(#op-soft)" }, w);
    parts.thread = el("path", { fill: "none", stroke: "url(#op-gold)", "stroke-width": "2.4", "stroke-linejoin": "miter" }, w);
    parts.threadHead = el("circle", { r: "26", fill: "url(#op-glow)", opacity: "0" }, w);
    parts.trails = VALUES.map(() => Array.from({ length: 14 }, () => el("circle", { fill: GOLD_LIGHT, opacity: "0" }, w)));
    parts.nodes = VALUES.map(() => {
      const g = el("g", { opacity: "0" }, w);
      el("circle", { r: "60", fill: "url(#op-glow)", opacity: "0.55" }, g);
      el("circle", { r: "5", fill: "#fff8ea" }, g);
      return g;
    });
    parts.labels = VALUES.map((v) => { const t = el("text", { class: "op-label", "text-anchor": "middle", opacity: "0" }, w); t.textContent = v; return t; });
    parts.pulses = [0, 1, 2, 3, 4].map(() => el("circle", { r: "22", fill: "url(#op-glow)", opacity: "0" }, w));
    parts.seed = el("g", { opacity: "0" }, w);
    parts.seedGlow = el("circle", { cx: CX, cy: CY, r: "140", fill: "url(#op-glow)" }, parts.seed);
    el("circle", { cx: CX, cy: CY, r: "7", fill: "#fffaf0" }, parts.seed);

    // ---- 最後の層(ロゴ・名前・一言) ----
    const f = parts.final;
    parts.lockup = el("g", {}, f);
    const mx = CX - 32 * MK;
    const my = MARK_CY - 32 * MK;
    parts.mark = el("g", { filter: "url(#op-mark-blur)", opacity: "0" }, parts.lockup);
    parts.mark.innerHTML = `
      <g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) scale(${MK})">
        <path d="M35.29 11.26A21 21 0 0 1 50.71 22.47 M52.74 28.71A21 21 0 0 1 46.85 46.85 M41.53 50.71A21 21 0 0 1 22.47 50.71 M17.15 46.85A21 21 0 0 1 11.26 28.71 M13.29 22.47A21 21 0 0 1 28.71 11.26" fill="none" stroke="url(#op-mk-gold)" stroke-width="0.95" stroke-linecap="round"/>
        <path d="M32 11 51.97 25.51 44.34 48.99H19.66L12.03 25.51Z" fill="none" stroke="url(#op-mk-gold)" stroke-width="0.32" opacity="0.6"/>
        <g fill="url(#op-mk-gold)"><circle cx="51.97" cy="25.51" r="0.95"/><circle cx="44.34" cy="48.99" r="0.95"/><circle cx="19.66" cy="48.99" r="0.95"/><circle cx="12.03" cy="25.51" r="0.95"/></g>
      </g>`;
    // 頂点の光(ひとつの出会い)。やわらかく脈打つ
    parts.spark = el("g", { opacity: "0" }, parts.lockup);
    parts.sparkGlow = el("circle", { cx: CX, cy: MARK_CY - MARK_R, r: "40", fill: "url(#op-glow)", opacity: "0.7" }, parts.spark);
    el("circle", { cx: CX, cy: MARK_CY - MARK_R, r: "6.5", fill: "#fff6e2" }, parts.spark);

    parts.word = el("text", { class: "op-word", x: CX, y: WORD_Y, "text-anchor": "middle", filter: "url(#op-word-blur)" }, parts.lockup);
    // 「EX5」はロゴと同じ金
    parts.letters = [..."BT-EX5"].map((ch, i) => { const s = el("tspan", { "fill-opacity": "0" }, parts.word); if (i >= 3) s.setAttribute("fill", "url(#op-word-gold)"); s.textContent = ch; return s; });
    parts.rule = el("rect", { x: CX, y: RULE_Y, width: "0", height: "1.6", fill: "url(#op-rule)" }, parts.lockup);
    parts.tag = el("text", { class: "op-tag", x: CX, y: TAG_Y, "text-anchor": "middle", opacity: "0" }, parts.lockup);
    parts.tag.textContent = "新潟・東京 日本海側最大の経営者コミュニティ";

    // ロゴと名前をなでる光(ロゴと文字の形で切り抜く)
    const shapes = q("#op-sheen-shapes");
    shapes.innerHTML = `
      <g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) scale(${MK})" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"><path d="M35.29 11.26A21 21 0 0 1 50.71 22.47 M52.74 28.71A21 21 0 0 1 46.85 46.85 M41.53 50.71A21 21 0 0 1 22.47 50.71 M17.15 46.85A21 21 0 0 1 11.26 28.71 M13.29 22.47A21 21 0 0 1 28.71 11.26"/></g>
      <text class="op-word" x="${CX}" y="${WORD_Y}" text-anchor="middle" fill="#fff">BT-EX5</text>`;
    parts.sheen = el("rect", { x: "0", y: String(MARK_CY - MARK_R - 60), width: "260", height: String(WORD_Y - MARK_CY + MARK_R + 100), fill: "url(#op-sheen)", mask: "url(#op-sheen-mask)", opacity: "0", transform: "skewX(-18)" }, f);

    // 光の筋(アナモルフィック・フレア)と、ロゴが決まる瞬間の閃光
    parts.bloom = el("circle", { cx: CX, cy: MARK_CY - MARK_R, r: "420", fill: "url(#op-glow)", opacity: "0" }, parts.flash);
    parts.streak = el("ellipse", { cx: CX, cy: MARK_CY - MARK_R, rx: "900", ry: "10", fill: "url(#op-streak)", opacity: "0" }, parts.flash);
    parts.streakCore = el("rect", { x: CX - 700, y: MARK_CY - MARK_R - 1, width: "1400", height: "2", fill: "url(#op-streak)", opacity: "0" }, parts.flash);

    const style = el("style", {}, svg);
    style.textContent = `
      .op-line { font-family: "Shippori Mincho", "Noto Serif JP", serif; font-weight: 500; font-size: 56px; fill: ${INK}; }
      .op-label { font-family: "Shippori Mincho", "Noto Serif JP", serif; font-weight: 500; font-size: 25px; letter-spacing: 0.32em; fill: ${GOLD}; }
      .op-word { font-family: "Montserrat", "Inter", sans-serif; font-weight: 300; font-size: 118px; letter-spacing: 0.34em; fill: ${INK}; }
      .op-tag { font-family: "Shippori Mincho", "Noto Serif JP", serif; font-weight: 500; font-size: 32px; letter-spacing: 0.24em; fill: #cdb489; }`;
    return parts;
  }

  // 字間をとると最後の字の後ろにも空きができるので、そのぶん中央をずらす
  function centerTracked(text, cx, em, size) {
    text.setAttribute("x", (cx + (em * size) / 2).toFixed(1));
  }

  function render(p, t) {
    // ---- 空気: 霧・粒子・フィルムの粒 ----
    p.hazeA.setAttribute("cx", (CX + Math.sin(t * 0.25) * 120).toFixed(1));
    p.hazeA.setAttribute("cy", (CY + Math.cos(t * 0.2) * 60).toFixed(1));
    p.hazeB.setAttribute("cx", (CX - Math.sin(t * 0.18) * 160).toFixed(1));
    p.grain.setAttribute("seed", String(Math.floor(t * 24) + 1));
    const dustIn = easeOut(prog(t, 0.2, 2.5));
    DUST.forEach((d, i) => {
      const y = ((d.y - t * d.sp) % H + H) % H;
      const x = d.x + Math.sin(t * 0.4 + d.ph) * 18 * (0.4 + d.z);
      const tw = 0.6 + 0.4 * Math.sin(t * 1.3 + d.ph * 3);
      const c = p.dust[i];
      c.setAttribute("cx", x.toFixed(1));
      c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("opacity", (d.a * tw * dustIn * (d.z > 0.72 ? 0.5 : 0.75)).toFixed(3));
    });

    // ---- 物語の層 ----
    // ゆっくり寄るカメラ。8.2秒からは五角形を集めてロゴの位置へ
    const conv = easeInOut(prog(t, 8.2, 8.95));
    const radius = lerp(R, MARK_R, conv);
    const cy = lerp(CY, MARK_CY, conv);
    const push = 1 + 0.045 * easeInOut(prog(t, 0, 8.2)) * (1 - conv);
    p.world.setAttribute("transform", `translate(${CX} ${cy}) scale(${push.toFixed(4)}) translate(${-CX} ${-CY})`);
    const story = 1 - prog(t, HIT, HIT + 0.05);
    p.world.setAttribute("opacity", story.toFixed(3));
    const pts = pentagon(CX, CY, radius);

    // ひとつの光
    const seedIn = easeOut(prog(t, 0.5, 1.8));
    const seedOut = 1 - easeIn(prog(t, SPLIT, SPLIT + 0.35));
    p.seed.setAttribute("opacity", (seedIn * seedOut).toFixed(3));
    p.seedGlow.setAttribute("r", (110 + 30 * Math.sin(t * 2.2) + 60 * prog(t, 2.4, SPLIT)).toFixed(1));

    // 5つに分かれて、曲線の軌跡を残しながら頂点へ
    const flyPos = (k, u) => {
      const [tx, ty] = pts[k];
      const sx = CX, sy = CY;
      const mxp = (sx + tx) / 2, myp = (sy + ty) / 2;
      const nx = -(ty - sy), ny = tx - sx;
      const bend = 0.28;
      const qx = mxp + nx * bend, qy = myp + ny * bend;
      const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      return [a * sx + b * qx + c * tx, a * sy + b * qy + c * ty];
    };
    VALUES.forEach((_, k) => {
      const start = SPLIT + k * 0.12;
      const u = easeInOut(prog(t, start, start + FLY));
      const [x, y] = flyPos(k, u);
      const on = t >= start;
      p.nodes[k].setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      p.nodes[k].setAttribute("opacity", on ? String(1 - 0.35 * conv) : "0");
      p.trails[k].forEach((c, j) => {
        const back = (j + 1) * 0.022;
        const uu = easeInOut(prog(t - back, start, start + FLY));
        const [tx, ty] = flyPos(k, uu);
        const visible = on && u < 1 ? (1 - j / 14) * 0.7 : u >= 1 ? Math.max(0, 0.7 * (1 - j / 14) * (1 - prog(t, start + FLY, start + FLY + 0.35))) : 0;
        c.setAttribute("cx", tx.toFixed(1));
        c.setAttribute("cy", ty.toFixed(1));
        c.setAttribute("r", (5 * (1 - j / 16)).toFixed(2));
        c.setAttribute("opacity", visible.toFixed(3));
      });
      const arrive = start + FLY;
      const out = 1 - easeIn(prog(t, 7.8, 8.3));
      const [lx, ly] = pts[k];
      const lyOff = k === 0 ? -58 : ly > CY ? 62 : -40;
      const lxOff = k === 1 ? 70 : k === 4 ? -70 : 0;
      const lab = p.labels[k];
      lab.setAttribute("x", (lx + lxOff + 4).toFixed(1));
      lab.setAttribute("y", (ly + lyOff).toFixed(1));
      lab.setAttribute("opacity", (easeOut(prog(t, arrive + 0.1, arrive + 0.7)) * out * 0.9).toFixed(3));
    });

    // 金の糸を一筆で結ぶ
    const draw = easeInOut(prog(t, 4.4, 5.8));
    // 集まるあいだに、まっすぐな糸がふくらんで輪になる(ロゴの輪へつながる)
    const bow = easeInOut(prog(t, 8.3, 8.95));
    const d = bow > 0 ? (() => {
      let out = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + ((k + 0.5) * 2 * Math.PI) / 5;
        const dist = lerp(radius * Math.cos(Math.PI / 5), radius / Math.cos(Math.PI / 5), bow);
        const nx = pts[(k + 1) % 5];
        out += ` Q${(CX + dist * Math.cos(a)).toFixed(1)} ${(CY + dist * Math.sin(a)).toFixed(1)} ${nx[0].toFixed(1)} ${nx[1].toFixed(1)}`;
      }
      return out + " Z";
    })() : pathOf(pts);
    const perim = 5 * 2 * radius * Math.sin(Math.PI / 5);
    [p.thread, p.threadGlow].forEach((path) => {
      path.setAttribute("d", d);
      path.setAttribute("stroke-dasharray", draw >= 1 ? "none" : `${(perim * draw).toFixed(1)} ${perim.toFixed(1)}`);
    });
    p.thread.setAttribute("stroke-width", (2.4 + 1.2 * conv).toFixed(2));
    p.threadGlow.setAttribute("opacity", (draw > 0 ? 0.35 + 0.35 * conv : 0).toFixed(3));
    const head = onPerimeter(pts, draw);
    p.threadHead.setAttribute("cx", head[0].toFixed(1));
    p.threadHead.setAttribute("cy", head[1].toFixed(1));
    p.threadHead.setAttribute("opacity", (draw > 0 && draw < 1 ? 1 : 0).toFixed(2));

    // 糸の上を巡る光
    const flow = fadeInOut(t, 5.9, 6.4, 7.9, 8.6);
    p.pulses.forEach((c, k) => {
      const [x, y] = onPerimeter(pts, k / 5 + (t - 5.9) * 0.22);
      c.setAttribute("cx", x.toFixed(1));
      c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("opacity", flow.toFixed(3));
    });

    // 字幕: ぼかしから合い、字間がゆっくり詰まる
    const LINES = [
      [0.9, 2.0, 2.9, 3.4, "出会いは、ひとつの光から。"],
      [4.6, 5.6, 6.1, 6.6, "信頼で、つながる。"],
      [6.8, 7.7, 8.0, 8.4, "ご縁が巡る、BT-EX5。"],
    ];
    const cur = LINES.find(([a, , , dd]) => t >= a && t <= dd);
    if (cur) {
      const [a, b, c, dd, text] = cur;
      const inn = easeOut(prog(t, a, b));
      const op = fadeInOut(t, a, b, c, dd);
      if (p.line.textContent !== text) p.line.textContent = text;
      const em = lerp(0.42, 0.2, inn);
      p.line.style.letterSpacing = `${em.toFixed(3)}em`;
      centerTracked(p.line, CX, em, 56);
      p.line.setAttribute("opacity", op.toFixed(3));
      p.lineBlur.setAttribute("stdDeviation", (9 * (1 - inn) + 6 * prog(t, c, dd)).toFixed(2));
    } else {
      p.line.setAttribute("opacity", "0");
    }

    // ---- ロゴが決まる瞬間 ----
    const flash = Math.max(0, 1 - prog(t, HIT, HIT + 0.7)) * (t >= HIT ? 1 : 0);
    const charge = easeIn(prog(t, 8.3, HIT)) * (t < HIT ? 1 : 0);
    p.bloom.setAttribute("opacity", Math.max(flash * 0.72, charge * 0.35).toFixed(3));
    p.bloom.setAttribute("r", (300 + 260 * (1 - flash)).toFixed(1));
    const streak = t >= HIT ? Math.max(0, 1 - prog(t, HIT, HIT + 1.3)) : charge * 0.25;
    p.streak.setAttribute("opacity", streak.toFixed(3));
    p.streak.setAttribute("rx", (700 + 500 * prog(t, HIT, HIT + 1.3)).toFixed(1));
    p.streakCore.setAttribute("opacity", (streak * 0.9).toFixed(3));

    // ロゴ: ピントが合いながら現れ、ゆっくり寄る
    const markIn = t >= HIT ? easeOut(prog(t, HIT, HIT + 0.45)) : 0;
    p.mark.setAttribute("opacity", markIn.toFixed(3));
    p.markBlur.setAttribute("stdDeviation", (14 * (1 - easeOut(prog(t, HIT, HIT + 0.8)))).toFixed(2));
    const hold = 1 + 0.03 * easeOut(prog(t, HIT, DURATION));
    p.lockup.setAttribute("transform", `translate(${CX} ${(MARK_CY + WORD_Y) / 2}) scale(${hold.toFixed(4)}) translate(${-CX} ${-(MARK_CY + WORD_Y) / 2})`);
    const sp = t >= HIT ? easeOut(prog(t, HIT, HIT + 0.6)) : 0;
    p.spark.setAttribute("opacity", sp.toFixed(3));
    p.sparkGlow.setAttribute("r", (lerp(90, 34, easeOut(prog(t, HIT, HIT + 0.9))) * (1 + 0.08 * Math.sin(t * 2.4))).toFixed(1));

    // 名前: 一文字ずつ
    const wordIn = prog(t, HIT + 0.35, HIT + 1.4);
    p.letters.forEach((s, i) => s.setAttribute("fill-opacity", easeOut(prog(t, HIT + 0.35 + i * 0.09, HIT + 0.95 + i * 0.09)).toFixed(3)));
    const wem = lerp(0.5, 0.34, easeOut(wordIn));
    p.word.style.letterSpacing = `${wem.toFixed(3)}em`;
    centerTracked(p.word, CX, wem, 118);
    p.wordBlur.setAttribute("stdDeviation", (6 * (1 - easeOut(wordIn))).toFixed(2));
    // 細い金の線と一言
    const ruleW = 560 * easeInOut(prog(t, HIT + 0.9, HIT + 1.7));
    p.rule.setAttribute("x", (CX - ruleW / 2).toFixed(1));
    p.rule.setAttribute("width", ruleW.toFixed(1));
    p.tag.setAttribute("opacity", easeOut(prog(t, HIT + 1.3, HIT + 2.2)).toFixed(3));
    centerTracked(p.tag, CX, 0.24, 32);
    // ロゴと名前をなでる光
    const sh = prog(t, HIT + 1.7, HIT + 2.7);
    p.sheen.setAttribute("x", (CX - 700 + 1500 * easeInOut(sh)).toFixed(1));
    p.sheen.setAttribute("opacity", (sh > 0 && sh < 1 ? 0.9 : 0).toFixed(2));

    // 終わり: 静かに暗くなる
    p.fade.setAttribute("opacity", easeIn(prog(t, 12.35, DURATION)).toFixed(3));
  }

  function play(container, opts) {
    const stage = mount(container, opts);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = (now - t0) / 1000;
      render(stage, Math.min(t, DURATION));
      if (t < DURATION) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return { stop() { cancelAnimationFrame(raf); }, stage };
  }

  return { DURATION, W, H, mount: (c, o) => { const parts = mount(c, o); return { svg: parts.svg, render: (t) => render(parts, t) }; }, play, render };
})();

if (typeof window !== "undefined") window.BtexOpening = BtexOpening;
