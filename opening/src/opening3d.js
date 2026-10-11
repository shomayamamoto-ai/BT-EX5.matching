// ============================================
// BT-EX5 オープニングムービー(3D 版・13秒)
// three.js で作った立体の場面を、時刻 t(秒)ごとに描く(同じ t なら同じ画面)。
// 動画は 1/30 秒ずつ画面を撮って書き出して作る(opening/src/README.md)。
//
//  0.0〜3.0  暗やみに金の塵が漂い、ひとつの光がともる      「出会いは、ひとつの光から。」
//  3.0〜4.4  光が5つに分かれ、尾を引いて宙に五角形をつくる(出会い・信頼・紹介・仕事・感謝)
//  4.4〜6.6  金の糸で5つを結ぶ。カメラが周りを巡る          「信頼で、つながる。」
//  5.9〜8.4  糸の上を光が巡る                               「ご縁が巡る、BT-EX5。」
//  8.2〜9.0  五角形が集まり、金の弧が伸びて輪になる
//  9.0       閃光・光の筋・衝撃の輪とともに、金のロゴが決まる
//  9.4〜13.0 BT-EX5 の名前と一言。金属に光が流れ、静かに終わる
// ============================================

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const W = 1920, H = 1080;
const DURATION = 13;
const SPLIT = 3.0, HIT = 9.0, FLY_T = 0.9; // 分かれる時刻・ロゴが決まる時刻・光が飛ぶ長さ
const VALUES = ["出会い", "信頼", "紹介", "仕事", "感謝"];
const R = 1.45; // 宙に浮かぶ五角形の大きさ
const STORY_Y = 0.22; // 五角形は字幕にかからないよう少し上
const LOGO_R = 0.74; // ロゴの輪の大きさ
const LOGO_Y = 0.58; // ロゴは画面の上寄り(下に名前を出す)

// ---------- 小さな道具 ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x * x;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, x) => a + (b - a) * x;
const fadeInOut = (t, a, b, c, d) => Math.min(easeOut(prog(t, a, b)), 1 - easeIn(prog(t, c, d)));
function rng(seed) { // 決まった並びの乱数(同じ画面を何度でも作れるように)
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
// 五角形の頂点(上が出会い。時計回り)
const vertex = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return new THREE.Vector3(Math.cos(a) * r, -Math.sin(a) * r, 0); };

// ---------- 描画の準備 ----------
const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050302);
scene.fog = new THREE.FogExp2(0x070403, 0.045);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 200);

// 光の形(やわらかい丸・横に長い筋)
function glowTexture(stops) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
const TX_GLOW = glowTexture([[0, "rgba(255,246,220,1)"], [0.12, "rgba(255,224,160,0.85)"], [0.35, "rgba(232,176,92,0.28)"], [1, "rgba(200,140,60,0)"]]);
const TX_DOT = glowTexture([[0, "rgba(255,240,205,1)"], [0.4, "rgba(240,200,130,0.55)"], [1, "rgba(220,160,80,0)"]]);
const TX_STREAK = (() => {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 64;
  const g = c.getContext("2d");
  const gx = g.createLinearGradient(0, 0, 1024, 0);
  gx.addColorStop(0, "rgba(255,210,140,0)"); gx.addColorStop(0.5, "rgba(255,246,225,1)"); gx.addColorStop(1, "rgba(255,210,140,0)");
  g.fillStyle = gx; g.fillRect(0, 0, 1024, 64);
  const gy = g.createLinearGradient(0, 0, 0, 64);
  gy.addColorStop(0, "rgba(0,0,0,1)"); gy.addColorStop(0.5, "rgba(0,0,0,0)"); gy.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out"; g.fillStyle = gy; g.fillRect(0, 0, 1024, 64);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
})();
const additive = (map, color = 0xffffff) => new THREE.SpriteMaterial({ map, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

// ---------- 金の塵(手前から奥まで。ゆっくり漂う) ----------
const DUST_N = 1800;
const dustBase = new Float32Array(DUST_N * 3), dustPhase = new Float32Array(DUST_N * 2);
const dustPos = new Float32Array(DUST_N * 3), dustSize = new Float32Array(DUST_N), dustBright = new Float32Array(DUST_N);
{
  const r = rng(7);
  for (let i = 0; i < DUST_N; i++) {
    dustBase[i * 3] = (r() - 0.5) * 26; dustBase[i * 3 + 1] = (r() - 0.5) * 15; dustBase[i * 3 + 2] = -18 + r() * 24;
    dustPhase[i * 2] = r() * Math.PI * 2; dustPhase[i * 2 + 1] = 0.15 + r() * 0.5;
    dustSize[i] = 0.6 + Math.pow(r(), 3) * 5.5; dustBright[i] = 0.25 + r() * 0.75;
  }
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
dustGeo.setAttribute("size", new THREE.BufferAttribute(dustSize, 1));
dustGeo.setAttribute("bright", new THREE.BufferAttribute(dustBright, 1));
const dustMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uOpacity: { value: 0 }, uMap: { value: TX_DOT }, uScale: { value: H * 0.5 } },
  vertexShader: `attribute float size; attribute float bright; varying float vB; varying float vFar;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = size * (12.0 / -mv.z); vB = bright; vFar = clamp((-mv.z - 3.0) / 22.0, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D uMap; uniform float uOpacity; varying float vB; varying float vFar;
    void main(){ vec4 c = texture2D(uMap, gl_PointCoord); float a = c.a * vB * uOpacity * (1.0 - vFar * 0.7);
      gl_FragColor = vec4(vec3(1.0, 0.78, 0.48) * a, 1.0); }`,
});
scene.add(new THREE.Points(dustGeo, dustMat));

// 奥のぼけた光
const bokeh = new THREE.Group(); scene.add(bokeh);
{
  const r = rng(21);
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(additive(TX_DOT, 0xc89650));
    s.position.set((r() - 0.5) * 30, (r() - 0.5) * 14, -20 - r() * 14);
    const k = 1.2 + r() * 2.8; s.scale.set(k, k, 1); s.userData = { k, ph: r() * 6.28, base: 0.05 + r() * 0.12 };
    bokeh.add(s);
  }
}

// ---------- 主役の光と、5つの光 ----------
const world = new THREE.Group(); scene.add(world); // 五角形とロゴはこの中(カメラから見てまわす)
const core = new THREE.Group(); world.add(core);
const coreGlow = new THREE.Sprite(additive(TX_GLOW)); core.add(coreGlow);
const coreBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff1d0 })); core.add(coreBall);
const coreLight = new THREE.PointLight(0xffd49a, 0, 12, 1.6); core.add(coreLight);

const gold = new THREE.MeshPhysicalMaterial({ color: 0xd4a65a, metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.2, emissive: 0x3a2408, emissiveIntensity: 0.25 });
const nodes = VALUES.map((_, i) => {
  const g = new THREE.Group();
  const glow = new THREE.Sprite(additive(TX_GLOW)); g.add(glow);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 12), new THREE.MeshBasicMaterial({ color: 0xfff2d6 })); g.add(ball);
  // 尾(通ってきた道に、薄くなっていく光の点)
  const trail = new THREE.Group();
  for (let k = 0; k < 28; k++) { const s = new THREE.Sprite(additive(TX_DOT, 0xffd69a)); trail.add(s); }
  world.add(trail);
  world.add(g);
  return { g, glow, ball, trail, i };
});
// 光が飛ぶ道(中心から、ふくらんだ曲線で頂点へ)
function flyPath(i) {
  const end = vertex(i, R);
  const side = vertex(i + 1.5, R * 0.9);
  return new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side.x * 0.6, side.y * 0.6, 1.6), new THREE.Vector3(end.x * 1.25, end.y * 1.25, -0.9), end);
}
const PATHS = VALUES.map((_, i) => flyPath(i));

// ---------- 金の糸(五角形の辺)と、巡る光 ----------
const threads = VALUES.map((_, i) => {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({ color: 0xe0b56a, metalness: 1, roughness: 0.3, emissive: 0x6a4410, emissiveIntensity: 0.9, transparent: true }));
  world.add(mesh); return mesh;
});
const pulses = VALUES.map(() => { const s = new THREE.Sprite(additive(TX_GLOW, 0xfff0cc)); world.add(s); return s; });
function threadGeo(a, b, p, sag, radius) {
  const mid = a.clone().lerp(b, 0.5); mid.z += sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const pts = []; const n = 40; const m = Math.max(2, Math.round(n * p));
  for (let k = 0; k <= m; k++) pts.push(curve.getPoint((k / n)));
  if (pts.length < 2) pts.push(pts[0].clone().add(new THREE.Vector3(0.0001, 0, 0)));
  return { geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(2, m), radius, 10, false), curve };
}

// ---------- ロゴ(5つの金の弧・切れ目の5つの点・内側の細い五角形) ----------
const logo = new THREE.Group(); logo.position.y = LOGO_Y; scene.add(logo);
const arcs = VALUES.map(() => { const m = new THREE.Mesh(new THREE.BufferGeometry(), gold); logo.add(m); return m; });
const ARC_SPAN = (54 * Math.PI) / 180;
function arcGeo(i, p) {
  const span = Math.max(0.001, ARC_SPAN * p);
  const g = new THREE.TorusGeometry(LOGO_R, 0.034, 24, 96, span);
  // i 番目の点と i+1 番目の点のあいだの、まん中から両側へ伸びる
  const mid = Math.PI / 2 - (i * 2 * Math.PI) / 5 - Math.PI / 5;
  g.rotateZ(mid - span / 2);
  return g;
}
const logoDots = VALUES.map((_, i) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.05 : 0.056, 32, 16), gold); m.position.copy(vertex(i, LOGO_R)); logo.add(m); return m;
});
const topGlow = new THREE.Sprite(additive(TX_GLOW)); topGlow.position.copy(vertex(0, LOGO_R)); topGlow.position.z = 0.05; logo.add(topGlow);
const inner = (() => {
  // 内側の細い五角形は、1px の線ではなく細い管で(ふちがなめらかに見える)
  const mat = new THREE.MeshBasicMaterial({ color: 0xd9b77a, transparent: true, opacity: 0, fog: false });
  const g = new THREE.Group();
  VALUES.forEach((_, i) => {
    const a = vertex(i, LOGO_R), b = vertex(i + 1, LOGO_R);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, 0.0045, 8, false), mat));
  });
  logo.add(g); return { material: mat };
})();
// ロゴに光を流すための光(左上から右へ動く)
const key = new THREE.PointLight(0xfff0d8, 0, 30, 1.2); scene.add(key);
const rim = new THREE.PointLight(0xffb060, 0, 20, 1.5); scene.add(rim);
scene.add(new THREE.AmbientLight(0x2a1c10, 0.6));

// 衝撃の輪・光の筋
const ring = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 160), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
ring.position.y = LOGO_Y; scene.add(ring);
const streak = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX_STREAK, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffe6b8 }));
scene.add(streak);
const flash = new THREE.Sprite(additive(TX_GLOW)); scene.add(flash);

// ---------- 仕上げ(光のにじみ・周辺減光・フィルムの粒・わずかな色ずれ) ----------
// 細い線や輪のふちがギザギザしないよう 4 倍のなめらか描画(MSAA)。暗い光のぼかしに段がつかないよう、中間は 16bit で持つ
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.55, 0.32);
composer.addPass(bloom);
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uAberr: { value: 0.0012 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uFade; uniform float uAberr; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime * 37.0) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r = length(d);
      vec2 off = d * uAberr * (0.5 + r);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= smoothstep(0.95, 0.25, r * 1.08);           // 周辺減光
      col += (hash(vUv * 1000.0) - 0.5) * 0.010;          // フィルムの粒(動画が重くならないよう、うっすら)
      col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; // 暗い所の段差を消すディザ
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
});
composer.addPass(finish);
composer.addPass(new OutputPass());

// ---------- 文字(DOM。明朝の字幕・名前・一言・五つの言葉) ----------
const $ = (id) => document.getElementById(id);
const labels = VALUES.map((v) => { const d = document.createElement("div"); d.className = "label"; d.textContent = v; $("labels").appendChild(d); return d; });
const LINES = [
  [0.9, 2.0, 2.6, 3.2, "出会いは、ひとつの光から。"],
  [4.6, 5.6, 6.1, 6.6, "信頼で、つながる。"],
  [6.8, 7.7, 8.0, 8.4, "ご縁が巡る、BT-EX5。"],
];
const project = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]; };

// ---------- 時刻 t の画面 ----------
function render(t) {
  // カメラ: 近づく → 周りを巡る → 正面で止まる → ゆっくり寄る
  const orbit = lerp(-0.38, 0.32, easeInOut(prog(t, 2.6, 8.2)));
  const settle = easeInOut(prog(t, 7.6, 9.0));
  const ang = lerp(orbit, 0, settle);
  const dist = t < 3 ? lerp(10.5, 8.2, easeOut(prog(t, 0, 3))) : t < 9 ? lerp(8.2, 7.2, easeInOut(prog(t, 3, 9))) : lerp(7.2, 6.6, easeOut(prog(t, 9, 13)));
  const lift = lerp(0.8, 0.35, easeInOut(prog(t, 2.6, 6.6))) * (1 - settle);
  camera.position.set(Math.sin(ang) * dist, lift + Math.sin(t * 0.6) * 0.04 * (1 - settle), Math.cos(ang) * dist);
  // 決まる瞬間の小さなゆれ
  const shake = Math.exp(-(t - HIT) * 9) * (t >= HIT ? 1 : 0);
  camera.position.x += Math.sin(t * 90) * 0.02 * shake; camera.position.y += Math.cos(t * 77) * 0.02 * shake;
  camera.lookAt(0, lerp(STORY_Y * 0.6, 0, settle), 0);
  camera.updateMatrixWorld();

  // 塵
  const dustOn = fadeInOut(t, 0, 1.6, 12.4, 13.0);
  dustMat.uniforms.uOpacity.value = 0.85 * dustOn;
  const burst = t >= HIT ? easeOut(prog(t, HIT, HIT + 2.4)) * 0.9 : 0;
  for (let i = 0; i < DUST_N; i++) {
    const ph = dustPhase[i * 2], sp = dustPhase[i * 2 + 1];
    let x = dustBase[i * 3] + Math.sin(t * sp + ph) * 0.35, y = dustBase[i * 3 + 1] + Math.cos(t * sp * 0.8 + ph) * 0.25 + t * 0.06, z = dustBase[i * 3 + 2];
    if (burst) { const k = 1 + burst * (0.35 / (0.3 + Math.hypot(x, y - LOGO_Y) * 0.25)); x *= k; y = LOGO_Y + (y - LOGO_Y) * k; }
    dustPos[i * 3] = x; dustPos[i * 3 + 1] = y; dustPos[i * 3 + 2] = z;
  }
  dustGeo.attributes.position.needsUpdate = true;
  bokeh.children.forEach((s) => { s.material.opacity = s.userData.base * (0.6 + 0.4 * Math.sin(t * 0.7 + s.userData.ph)) * dustOn; });

  // 主役の光(ともる → 脈打つ → 分かれる瞬間にふくらんで消える)
  const ignite = easeOut(prog(t, 0.25, 1.6));
  const breathe = 1 + 0.08 * Math.sin(t * 3.2);
  const splitFlash = Math.exp(-Math.pow((t - SPLIT) / 0.18, 2));
  const coreOn = t < SPLIT + 0.25 ? ignite : 0;
  coreGlow.scale.setScalar((0.25 + 1.35 * ignite) * breathe + splitFlash * 2.4);
  coreGlow.material.opacity = coreOn;
  coreBall.visible = coreOn > 0.02; coreBall.scale.setScalar(0.4 + 0.6 * ignite);
  coreLight.intensity = 26 * coreOn;
  core.position.set(0, 0, 0);

  // 五角形の向き(ゆっくり回り、最後は正面へ)
  const spin = lerp(0.55, 0, easeInOut(prog(t, SPLIT, 8.6)));
  world.rotation.set(lerp(0.22, 0, easeInOut(prog(t, 3, 8.6))), spin, 0);
  // 集まる: 五角形 → ロゴの大きさ・位置へ
  const gather = easeInOut(prog(t, 8.2, 9.0));
  const pentR = lerp(R, LOGO_R, gather);
  world.position.y = lerp(STORY_Y, LOGO_Y, gather);

  nodes.forEach((n) => {
    const u = (t - SPLIT - n.i * 0.05) / FLY_T; // 飛びはじめからの割合(1 で着く。1 をこえても数える)
    const fly = easeInOut(clamp(u));
    const on = t >= SPLIT ? 1 : 0;
    const pos = fly < 1 ? PATHS[n.i].getPoint(fly) : vertex(n.i, pentR);
    if (fly >= 1) pos.z = Math.sin(t * 1.3 + n.i) * 0.08 * (1 - gather);
    n.g.position.copy(pos);
    const lit = on * (1 - easeIn(prog(t, HIT - 0.1, HIT + 0.15)));
    n.glow.material.opacity = lit * (0.85 + 0.15 * Math.sin(t * 4 + n.i));
    n.glow.scale.setScalar(lerp(0.4, 0.6, Math.sin(t * 2.4 + n.i) * 0.5 + 0.5) * lerp(1, 0.7, gather) + Math.exp(-Math.pow((t - (SPLIT + FLY_T + n.i * 0.05)) / 0.12, 2)) * 0.9);
    n.ball.visible = lit > 0.02; n.ball.scale.setScalar(lerp(1, 0.6, gather));
    // 尾
    const tailFade = 1 - prog(u, 1, 1.4); // 着いたあと、尾は光に吸いこまれて消える
    n.trail.children.forEach((s, k) => {
      const back = easeInOut(clamp(u - (k + 1) * 0.03));
      const vis = on && u > 0 && tailFade > 0 && u - (k + 1) * 0.03 > 0;
      if (!vis) { s.material.opacity = 0; return; }
      const p = PATHS[n.i].getPoint(back);
      if (u >= 1) p.lerp(n.g.position, prog(u, 1, 1.4));
      s.position.copy(p);
      const fadeTail = 1 - k / n.trail.children.length;
      s.material.opacity = 0.5 * fadeTail * tailFade;
      s.scale.setScalar(0.16 * fadeTail + 0.04);
    });
    // 言葉(光の近くに浮かべる)
    const [px, py] = project(n.g.getWorldPosition(new THREE.Vector3()));
    const la = fadeInOut(t, 3.9 + n.i * 0.08, 4.6 + n.i * 0.08, 7.9, 8.4);
    const out = vertex(n.i, 1).multiplyScalar(54);
    labels[n.i].style.transform = `translate(${px + out.x}px, ${py - out.y}px) translate(-50%, -50%)`;
    labels[n.i].style.opacity = la;
  });
  const FLY_DONE = SPLIT + FLY_T + 0.2;

  // 金の糸(順番に伸びる)・巡る光
  threads.forEach((m, i) => {
    const p = easeInOut(prog(t, 4.4 + i * 0.28, 5.2 + i * 0.28));
    const fadeOut = 1 - easeIn(prog(t, 8.3, 9.0));
    m.visible = t > FLY_DONE && p > 0.01 && fadeOut > 0.01;
    if (!m.visible) { pulses[i].material.opacity = 0; return; }
    const a = vertex(i, pentR), b = vertex(i + 1, pentR);
    a.z = nodes[i].g.position.z; b.z = nodes[(i + 1) % 5].g.position.z;
    const { geo, curve } = threadGeo(a, b, p, 0.14 * (1 - gather), 0.01);
    m.geometry.dispose(); m.geometry = geo;
    m.material.opacity = fadeOut;
    const run = prog(t, 5.9, 8.4);
    const q = ((t - 5.9) * 0.55 + i * 0.2) % 1;
    pulses[i].position.copy(curve.getPoint(clamp(q)));
    pulses[i].material.opacity = run > 0 ? 0.9 * fadeInOut(t, 5.9, 6.3, 8.1, 8.6) : 0;
    pulses[i].scale.setScalar(0.32);
  });

  // ロゴ: 弧が伸びて輪になり、点と内側の五角形が出る
  const grow = easeOut(prog(t, 8.45, 9.05));
  const logoOn = t >= 8.45;
  arcs.forEach((m, i) => { m.visible = logoOn; if (logoOn) { m.geometry.dispose(); m.geometry = arcGeo(i, grow); } });
  logoDots.forEach((m) => { m.visible = t >= HIT - 0.05; });
  inner.material.opacity = 0.5 * easeOut(prog(t, 9.2, 10.4));
  topGlow.material.opacity = t >= HIT ? 0.9 * (0.85 + 0.15 * Math.sin(t * 2.6)) : 0;
  topGlow.scale.setScalar(0.42 + Math.exp(-(t - HIT) * 3) * 1.0 * (t >= HIT ? 1 : 0));
  logo.rotation.set(0, t >= HIT ? Math.sin((t - HIT) * 0.55) * 0.22 * easeOut(prog(t, HIT, HIT + 1.2)) : 0, 0);
  logo.scale.setScalar(t >= HIT ? 1 + Math.exp(-(t - HIT) * 7) * 0.06 : 1);

  // 光: ロゴを照らし、表面に光を流す
  key.intensity = 45 * easeOut(prog(t, 8.4, 9.2));
  key.position.set(lerp(-4.5, 4.5, easeInOut(prog(t, 9.0, 12.6))), 2.6, 3.4);
  rim.intensity = 30 * easeOut(prog(t, 8.8, 9.6));
  rim.position.set(2.5, LOGO_Y - 2.2, -1.5);

  // 決まる瞬間: 閃光・光の筋・衝撃の輪
  const hit = t >= HIT ? t - HIT : -1;
  flash.position.set(0, LOGO_Y, 0.3);
  flash.material.opacity = hit >= 0 ? 0.75 * Math.exp(-hit * 6) : 0;
  flash.scale.setScalar(1.4 + hit * 4);
  streak.position.set(0, LOGO_Y, 0.4);
  streak.material.opacity = hit >= 0 ? Math.exp(-hit * 2.4) * 0.65 : 0;
  streak.scale.set(lerp(2.5, 13, easeOut(clamp(hit / 0.6))), 0.14, 1);
  ring.material.opacity = hit >= 0 ? 0.45 * Math.exp(-hit * 2.6) : 0;
  ring.scale.setScalar(hit >= 0 ? LOGO_R * (1 + easeOut(clamp(hit / 1.6)) * 3.2) : 0.001);
  ring.lookAt(camera.position);

  // 仕上げ
  bloom.strength = 0.6 + 0.8 * (hit >= 0 ? Math.exp(-hit * 4) : 0) + splitFlash * 0.5;
  renderer.toneMappingExposure = 1.05 + (hit >= 0 ? Math.exp(-hit * 7) * 0.25 : 0);
  finish.uniforms.uTime.value = Math.floor(t * 10) / 10; // 粒は 1/10 秒ごとに変わる
  finish.uniforms.uFade.value = Math.min(easeOut(prog(t, 0, 0.6)), 1 - easeIn(prog(t, 12.3, 13.0)));
  finish.uniforms.uAberr.value = 0.0012 + (hit >= 0 ? Math.exp(-hit * 5) * 0.006 : 0);

  // 字幕
  const line = LINES.find(([a, , , d]) => t >= a - 0.01 && t <= d + 0.01);
  $("line").textContent = line ? line[4] : "";
  const la = line ? fadeInOut(t, line[0], line[1], line[2], line[3]) : 0;
  $("line").style.opacity = la;
  $("line").style.filter = `blur(${(1 - la) * 6}px)`;
  $("line").style.letterSpacing = `${0.3 + (1 - la) * 0.12}em`;
  // 名前と一言
  const wo = easeOut(prog(t, 9.35, 10.6));
  $("word").style.opacity = wo * finish.uniforms.uFade.value;
  $("word").style.letterSpacing = `${lerp(0.62, 0.36, wo)}em`;
  $("word").style.filter = `blur(${(1 - wo) * 8}px)`;
  $("rule").style.transform = `scaleX(${easeInOut(prog(t, 9.9, 11.0))})`;
  $("rule").style.opacity = finish.uniforms.uFade.value;
  const to = easeOut(prog(t, 10.5, 11.6));
  $("tag").style.opacity = to * finish.uniforms.uFade.value;
  $("tag").style.transform = `translateY(${(1 - to) * 14}px)`;

  composer.render();
}
window.BtexOpening3D = { render, DURATION, W, H };
window.renderAt = (t) => { render(t); return new Promise((ok) => requestAnimationFrame(() => ok(true))); };
// ふつうに開いたときは、そのまま再生する(?frame=… のときは止める)
if (!new URLSearchParams(location.search).has("frame")) {
  const start = performance.now();
  const loop = () => { const t = ((performance.now() - start) / 1000) % (DURATION + 1); render(Math.min(t, DURATION)); requestAnimationFrame(loop); };
  loop();
} else {
  render(Number(new URLSearchParams(location.search).get("frame")) || 0);
}
