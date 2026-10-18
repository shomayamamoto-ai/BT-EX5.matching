// ============================================
// app/pitch.js — プレゼンの練習・タイマーと、今月の目標
// ・プレゼン: 原稿(本人だけが見る。サーバーに保存)・文字数と読む時間の目安・読み上げ
// ・タイマー: 30秒・1分・3分・5分・10分・25分(ポモドーロ)。続けて押すと足せる(10分×3で30分。最大3時間)。
//   一時停止・つづける。残りわずかと 0秒で、音(鐘)・色・ふるえ。練習のシートとホームに同じタイマーを出し、
//   画面を移っても動きつづける(タイマーが出ていない画面では右上に残り時間)。
//   長さと音のオン・オフは、この端末に覚える。動いているあいだは画面を消さない(対応する端末)
// ・今月の目標: 紹介・成約・1on1・ビジター招待の数を決めると、ホームの「今月のあなた」に進み具合が出る
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const CHARS_PER_SEC = 8.5; // 人前で話す速さの目安(1秒に約8〜9文字)

  // ---------- プレゼン ----------
  function template() {
    const s = App.session;
    const me = App.memberById(s.memberId) || {};
    // プロフィールの文はそのまま全部使う(途中で切らない)。改行・空白はまとめ、文末の「。」は重ねない
    const full = (t) => String(t || "").replace(/\s+/g, " ").trim().replace(/[。．.、,\s]+$/, "");
    return [
      `${me.company ? `${full(me.company)}の` : ""}${s.displayName}です。`,
      me.business ? `${full(me.business)}をしています。` : "(どんな仕事をしているか)",
      me.wants ? `ご紹介いただきたいのは、${full(me.wants)}です。` : "(どんな人を紹介してほしいか)",
      me.offer ? `BT-EX5 のメンバーからのご紹介には、${full(me.offer)}。` : "",
      "よろしくお願いいたします。",
    ].filter(Boolean).join("\n");
  }

  // ---------- タイマー(画面をまたいで1つだけ動く。練習のシートとホームの両方に同じものを出す) ----------
  // 長さのボタンは続けて押すと足していける(10分を3回で30分)。「もどす」で選び直し
  const LENGTHS = [[30, "30秒"], [60, "1分"], [180, "3分"], [300, "5分"], [600, "10分"], [1500, "25分"]];
  const MAX = 3 * 3600; // いちばん長くて3時間
  const store = {
    get(k, d) { try { const v = localStorage.getItem(`btex5-timer-${k}`); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(`btex5-timer-${k}`, String(v)); } catch { /* noop */ } },
  };
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}` : sec >= 60 ? `${Math.floor(sec / 60)}:${pad(sec % 60)}` : String(sec));
  const lenLabel = (sec) => {
    const hh = Math.floor(sec / 3600), mm = Math.floor(sec / 60) % 60, ss = sec % 60;
    return [hh ? `${hh}時間` : "", mm ? `${mm}分` : "", ss ? `${ss}秒` : ""].join("") || "0秒";
  };

  // 音(Web Audio で鐘の音を作る。ファイルは使わない)。iPhone は押したときに音の準備が要るので、はじめるボタンで作る
  let audio = null;
  function audioReady() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audio) audio = new AC();
      if (audio.state === "suspended") audio.resume();
      return audio;
    } catch { return null; }
  }
  function bell(at, freq, len, vol) {
    const ac = audio; if (!ac) return;
    [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([mul, v]) => { // 鐘らしく、少しずれた倍音を重ねる
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = freq * mul;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol * v, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g).connect(ac.destination); o.start(at); o.stop(at + len + 0.05);
    });
  }
  function soundEnd() { const ac = audio; if (!ac) return; const t = ac.currentTime + 0.02; [0, 0.55, 1.1].forEach((d) => { bell(t + d, 880, 1.6, 0.5); bell(t + d, 1318.5, 1.2, 0.18); }); }
  function soundWarn() { const ac = audio; if (!ac) return; bell(ac.currentTime + 0.02, 660, 0.9, 0.3); }

  const T = {
    total: (() => { const v = Math.round(Number(store.get("len", 30))); return v >= 1 && v <= MAX ? v : 30; })(),
    left0: 0,       // 一時停止したときの残り(秒)。0 なら止まっていない
    endAt: 0, timer: null, warned: false, wake: null, done: false, // done: 0秒になったところ(次に触るまで 0 を出す)
    sound: store.get("sound", "1") === "1",
    adding: false,  // true のあいだは、長さのボタンを押すと足す
    counts: {},     // ボタンごとに押した回数(10分 ×3 など)
    order: [],      // 押した順(合計の説明に使う)
    subs: [],
  };
  const running = () => Boolean(T.timer);
  const paused = () => !running() && T.left0 > 0;
  const leftNow = () => (running() ? (T.endAt - Date.now()) / 1000 : paused() ? T.left0 : T.done ? 0 : T.total);
  const warnAt = () => (T.total <= 60 ? 10 : 60);
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* noop */ } };
  async function keepAwake(on) { // 動いているあいだは画面を消さない(対応する端末)
    try {
      if (on && "wakeLock" in navigator) T.wake = await navigator.wakeLock.request("screen");
      else if (!on && T.wake) { await T.wake.release(); T.wake = null; }
    } catch { /* noop */ }
  }
  // 表示しているところ(シート・ホーム)へ知らせる。画面から消えたものは外す
  let pill = null;
  function emit() {
    T.subs = T.subs.filter((s) => { if (s.root.isConnected) s.seen = true; return !s.seen || s.root.isConnected; });
    T.subs.forEach((s) => s.fn());
    // どこにもタイマーが出ていない画面では、右上に小さく残りを出す(押すと練習の画面のタイマーへ)
    const shown = T.subs.some((s) => s.root.isConnected);
    const active = running() || paused();
    if (active && !shown) {
      if (!pill) {
        pill = h("a", { class: "timer-pill", href: "#me/pitch", "aria-label": "タイマー(練習の画面で開く)" });
        document.body.append(pill);
      }
      pill.textContent = `⏱ ${fmt(Math.max(0, Math.ceil(leftNow())))}${paused() ? " 停止中" : ""}`;
      pill.classList.toggle("is-last", running() && leftNow() <= warnAt());
    } else if (pill) { pill.remove(); pill = null; }
  }
  function halt() { clearInterval(T.timer); T.timer = null; keepAwake(false); }
  // 動いている・止めているタイマーは、この端末に覚える(読み込み直したり、アプリを開き直したりしても続きから)
  function saveRun() { store.set("run", running() ? JSON.stringify({ endAt: T.endAt }) : paused() ? JSON.stringify({ left: T.left0 }) : ""); }
  function tick() {
    const left = leftNow();
    if (left <= warnAt() && !T.warned) { T.warned = true; buzz(120); if (T.sound) soundWarn(); }
    if (left <= 0) {
      halt(); T.left0 = 0; T.adding = false; T.counts = {}; T.order = []; T.done = true; saveRun();
      buzz([200, 100, 200, 100, 200]);
      if (T.sound) soundEnd();
      App.toast(`${lenLabel(T.total)}です。おつかれさまでした`);
    }
    emit();
  }
  const timer = {
    tap(v) {
      T.done = false;
      if ((running() || paused()) && !confirm("タイマーを止めて、長さを選び直しますか?")) return;
      if (running() || paused()) { halt(); T.left0 = 0; T.adding = false; saveRun(); }
      if (T.adding) { T.total = Math.min(MAX, T.total + v); if (!T.counts[v]) T.order.push(v); T.counts[v] = (T.counts[v] || 0) + 1; }
      else { T.total = v; T.counts = { [v]: 1 }; T.order = [v]; T.adding = true; }
      store.set("len", T.total); emit();
    },
    start() {
      if (running()) { T.left0 = Math.max(0.1, leftNow()); halt(); saveRun(); emit(); return; } // とめる(一時停止)
      if (T.sound) audioReady();
      T.done = false;
      const remain = paused() ? T.left0 : T.total;
      T.endAt = Date.now() + remain * 1000; T.left0 = 0; T.adding = false;
      T.warned = remain <= warnAt();
      keepAwake(true);
      T.timer = setInterval(tick, 100);
      saveRun(); emit();
    },
    reset() { T.done = false; halt(); T.left0 = 0; T.adding = false; T.counts = {}; T.order = []; saveRun(); emit(); },
    setSound(on) { T.sound = on; store.set("sound", on ? "1" : "0"); if (on) { audioReady(); soundWarn(); } emit(); },
    get total() { return T.total; },
  };
  App.timer = timer;
  // 前に動かしていたタイマーの続き(もう時間が過ぎていたら何もしない)
  try {
    const run = JSON.parse(store.get("run", "") || "null");
    if (run && run.endAt > Date.now() + 500) {
      T.endAt = run.endAt; T.warned = (run.endAt - Date.now()) / 1000 <= warnAt();
      T.timer = setInterval(tick, 100); keepAwake(true);
      setTimeout(emit, 0);
    } else if (run && run.left > 0) { T.left0 = Math.min(run.left, T.total); setTimeout(emit, 0); }
    else if (run) store.set("run", "");
  } catch { /* noop */ }
  App.timerSound = { ready: audioReady, end: soundEnd, warn: soundWarn };

  // タイマーの部品。compact はホーム用(説明を短く)。extra はボタンの下に足すもの(読み上げなど)
  App.timerWidget = function (opts = {}) {
    const clock = h("b", { class: "pitch-clock" });
    const unit = h("small", null);
    const ring = h("div", { class: "pitch-ring" }, clock, unit);
    const startBtn = h("button", { type: "button", class: "app-btn primary pitch-start", onclick: () => timer.start() });
    const resetBtn = h("button", { type: "button", class: "app-btn ghost pitch-reset", onclick: () => timer.reset() }, "もどす");
    const lens = h("div", { class: "pitch-lens", role: "group", "aria-label": "タイマーの長さ(続けて押すと足せます)" }, LENGTHS.map(([v, label]) =>
      h("button", { type: "button", class: "pitch-len", "data-len": String(v), onclick: () => timer.tap(v) },
        label, v === 1500 ? h("small", null, "ポモドーロ") : null, h("span", { class: "pitch-len-n" }))));
    const sumLine = h("p", { class: "pitch-sum" });
    const soundBox = h("input", { type: "checkbox", onchange: () => timer.setSound(soundBox.checked) });
    const root = h("div", { class: `pitch-timer-wrap${opts.compact ? " is-compact" : ""}` },
      lens, sumLine,
      h("div", { class: "pitch-timer" }, ring, h("div", { class: "pitch-btns" }, startBtn, resetBtn, opts.extra || null)),
      h("label", { class: "pitch-sound" }, soundBox, h("span", null, opts.compact ? "0秒で音を鳴らす" : "0秒で音を鳴らす(残りわずかのときも小さく鳴らします)")));
    function draw() {
      const left = leftNow();
      const sec = Math.max(0, Math.ceil(left));
      clock.textContent = fmt(sec);
      clock.classList.toggle("is-long", sec >= 60 && sec < 3600);
      clock.classList.toggle("is-hour", sec >= 3600);
      unit.textContent = sec >= 3600 ? "時間:分:秒" : sec >= 60 ? "分:秒" : "秒";
      ring.style.setProperty("--p", String(Math.max(0, left) / T.total));
      ring.classList.toggle("is-last", (running() || paused()) && left <= warnAt() && left > 0);
      ring.classList.toggle("is-end", T.done);
      startBtn.textContent = running() ? "とめる" : paused() ? "つづける" : "はじめる";
      const picked = Object.keys(T.counts).map(Number);
      lens.querySelectorAll(".pitch-len").forEach((b) => {
        const v = Number(b.dataset.len), n = T.counts[v] || 0;
        b.classList.toggle("is-on", picked.length ? n > 0 : v === T.total);
        b.querySelector(".pitch-len-n").textContent = n > 1 ? `×${n}` : "";
      });
      const taps = picked.reduce((a, v) => a + T.counts[v], 0);
      sumLine.textContent = taps > 1
        ? `${T.order.map((v) => `${lenLabel(v)}${T.counts[v] > 1 ? `×${T.counts[v]}` : ""}`).join(" + ")} = ${lenLabel(T.total)}${T.adding ? "(続けて押すと、さらに足せます)" : ""}`
        : T.adding ? "続けて押すと足せます(例:10分を3回で30分)。「もどす」で選び直せます" : "続けて押すと足せます(例:10分を3回で30分)";
      soundBox.checked = T.sound;
      if (opts.onChange) opts.onChange(T.total);
    }
    T.subs.push({ root, fn: draw, seen: false });
    draw();
    return root;
  };

  App.pitchSheet = function () {
    App.openSheet("プレゼンの練習・タイマー", async (body) => {
      const text = h("textarea", { class: "pitch-text", rows: "7", maxlength: "2000", placeholder: "例:〇〇株式会社の山田です。\n飲食店さまの集客を、SNS と動画でお手伝いしています。\nご紹介いただきたいのは、新しくお店を始める方です。\nよろしくお願いいたします。" });
      const meter = h("p", { class: "pitch-meter" });
      const sayBtn = h("button", { type: "button", class: "app-btn ghost" }, "読み上げて聞く");
      const saved = h("small", { class: "pitch-saved" });
      body.append(
        h("p", { class: "app-lead" }, "定例会の「プレゼンテーション」の原稿を書いて、時間を計って練習できます。原稿はあなただけが見られます。タイマーは 1分・5分・25分(ポモドーロ)なども選べ、続けて押すと足せます。「プレゼン」の画面では、大きなメーターのタイマー(ポモドーロも)が使えます。"),
        h("div", { class: "app-btn-row pitch-tools" }, App.btn("プロフィールからひな形を入れる", async () => {
          if (text.value.trim() && !(await App.confirm("いまの原稿を、ひな形で置きかえますか?", { ok: "置きかえる" }))) return;
          text.value = template(); update(); save();
        }, "ghost small"), saved),
        text, meter,
        App.timerWidget({ extra: "speechSynthesis" in window ? sayBtn : null, onChange: () => update() }),
        App.roundSheet ? h("button", { type: "button", class: "app-btn ghost wide pitch-round", onclick: () => App.roundSheet() }, "定例会で、みんなのプレゼンを順番に進行する") : null,
        h("p", { class: "app-field-hint" }, "残りわずか(1分までは残り10秒、それより長いときは残り1分)と、0秒になったときに、音・画面の色・スマホのふるえ(対応する端末)でお知らせします。マナーモードのときは音が出ないことがあります。シートを閉じても、タイマーは動きつづけます。"));

      // 文字数と、読むのにかかる時間の目安(5分までの長さで比べる)
      function update() {
        const n = text.value.replace(/\s/g, "").length;
        const sec = Math.round(n / CHARS_PER_SEC);
        const goal = T.total <= 300 ? T.total : 30;
        const maxChars = Math.round(goal * CHARS_PER_SEC / 50) * 50; // 30秒は 250字、1分は 500字
        meter.className = `pitch-meter${sec > goal * 1.07 ? " is-over" : sec >= goal * 0.8 ? " is-good" : ""}`;
        meter.textContent = n
          ? `${n}文字 ・ 読むと約${sec}秒${sec > goal * 1.07 ? `(${lenLabel(goal)}には長すぎます。${maxChars}字くらいまで)` : sec >= goal * 0.8 ? `(${lenLabel(goal)}にちょうどよい長さです)` : `(${lenLabel(goal)}は ${maxChars}字くらいが目安)`}`
          : `${lenLabel(goal)}で話せるのは ${maxChars}字くらいです`;
      }
      // 書いたら少しして自動で保存
      let saveTimer = null;
      async function save() {
        const r = await App.api("updateMySettings", { pitchScript: text.value }, { quiet: true });
        saved.textContent = r ? "保存しました" : "";
      }
      text.addEventListener("input", () => { update(); saved.textContent = ""; clearTimeout(saveTimer); saveTimer = setTimeout(save, 900); });
      sayBtn.addEventListener("click", () => {
        if (!text.value.trim()) { App.fieldError(text, "原稿を入れてください。"); return; }
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.value);
        u.lang = "ja-JP"; u.rate = 1.05;
        const t0 = Date.now();
        u.onend = () => App.toast(`読み上げは約${Math.round((Date.now() - t0) / 1000)}秒でした`);
        speechSynthesis.speak(u);
      });
      update();
      const d = await App.api("getMySettings", {}, { quiet: true });
      if (d && d.pitchScript && !text.value) { text.value = d.pitchScript; update(); }
    }, { noFocus: true, onClose: () => { try { speechSynthesis.cancel(); } catch { /* noop */ } setTimeout(emit, 0); if (location.hash === "#me/pitch") history.replaceState(null, "", "#me"); } });
  };

  // ---------- 今月の目標 ----------
  const GOALS = [
    ["given", "紹介する", "件"],
    ["won", "成約", "件"],
    ["oneOnOnes", "1on1", "回"],
    ["visitors", "ビジターを招待", "人"],
  ];
  App.GOALS = GOALS;
  App.goalsSheet = function (current, onSaved) {
    App.openSheet("今月の目標", (body, close) => {
      const vals = Object.assign({ given: 0, won: 0, oneOnOnes: 0, visitors: 0 }, current || {});
      const rows = GOALS.map(([k, label, unit]) => {
        const out = h("b", null, String(vals[k]));
        const set = (n) => { vals[k] = Math.max(0, Math.min(99, n)); out.textContent = String(vals[k]); };
        return h("div", { class: "goal-row" },
          h("span", null, label),
          h("button", { type: "button", class: "goal-step", "aria-label": `${label}を減らす`, onclick: () => set(vals[k] - 1) }, "−"),
          out, h("small", null, unit),
          h("button", { type: "button", class: "goal-step", "aria-label": `${label}を増やす`, onclick: () => set(vals[k] + 1) }, "＋"));
      });
      body.append(
        h("p", { class: "app-lead" }, "今月がんばる数を決めると、「記録」→「数字」の「今月のあなた」に進み具合が出ます。0 の項目は出しません。"),
        h("div", { class: "goal-rows" }, rows),
        h("button", { type: "button", class: "app-btn primary wide", onclick: async () => {
          const d = await App.api("updateMySettings", { goals: vals });
          if (!d) return;
          close();
          App.toast("目標を決めました");
          if (onSaved) onSaved(d.goals);
        } }, "この目標にする"));
    }, { noFocus: true, onClose: () => { if (location.hash === "#me/goals") history.replaceState(null, "", "#me"); } });
  };
})();
