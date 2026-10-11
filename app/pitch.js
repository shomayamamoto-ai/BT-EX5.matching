// ============================================
// app/pitch.js — プレゼンの練習・タイマーと、今月の目標
// ・30秒プレゼン: 原稿(本人だけが見る。サーバーに保存)・文字数と読む時間の目安・読み上げ
// ・タイマー: 30秒・1分・3分・5分・10分・25分(ポモドーロ)。一時停止・つづける。残りわずかと 0秒で、音(鐘)・色・ふるえ。
//   選んだ長さと音のオン・オフは、この端末に覚える。動いているあいだは画面を消さない(対応する端末)
// ・今月の目標: 紹介・成約・1on1・ビジター招待の数を決めると、ホームの「今月のあなた」に進み具合が出る
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const CHARS_PER_SEC = 8.5; // 人前で話す速さの目安(1秒に約8〜9文字)

  // ---------- 30秒プレゼン ----------
  function template() {
    const s = App.session;
    const me = App.memberById(s.memberId) || {};
    const cut = (t, n) => { const x = String(t || "").replace(/\s+/g, " ").trim(); return x.length > n ? `${x.slice(0, n)}…` : x; };
    return [
      `${me.company ? `${me.company}の` : ""}${s.displayName}です。`,
      me.business ? `${cut(me.business, 60)}をしています。` : "(どんな仕事をしているか)",
      me.wants ? `ご紹介いただきたいのは、${cut(me.wants, 60)}です。` : "(どんな人を紹介してほしいか)",
      me.offer ? `BT-EX5 のメンバーからのご紹介には、${cut(me.offer, 30)}。` : "",
      "よろしくお願いいたします。",
    ].filter(Boolean).join("\n");
  }

  // タイマーの長さ(30秒プレゼン・1分・3分・5分・10分・25分のポモドーロ)
  const LENGTHS = [[30, "30秒"], [60, "1分"], [180, "3分"], [300, "5分"], [600, "10分"], [1500, "25分"]];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(`btex5-timer-${k}`); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(`btex5-timer-${k}`, String(v)); } catch { /* noop */ } },
  };
  const fmt = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : String(sec));
  const lenLabel = (sec) => (sec >= 60 ? `${sec / 60}分` : `${sec}秒`);

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
  App.timerSound = { ready: audioReady, end: soundEnd, warn: soundWarn };

  App.pitchSheet = function () {
    App.openSheet("プレゼンの練習・タイマー", async (body) => {
      let total = Number(store.get("len", 30)) || 30;
      if (!LENGTHS.some(([v]) => v === total)) total = 30;
      let withSound = store.get("sound", "1") === "1";

      const text = h("textarea", { class: "pitch-text", rows: "7", maxlength: "800", placeholder: "例:〇〇株式会社の山田です。\n飲食店さまの集客を、SNS と動画でお手伝いしています。\nご紹介いただきたいのは、新しくお店を始める方です。\nよろしくお願いいたします。" });
      const meter = h("p", { class: "pitch-meter" });
      const clock = h("b", { class: "pitch-clock" });
      const unit = h("small", null);
      const ring = h("div", { class: "pitch-ring" }, clock, unit);
      const startBtn = h("button", { type: "button", class: "app-btn primary" }, "はじめる");
      const resetBtn = h("button", { type: "button", class: "app-btn ghost" }, "もどす");
      const sayBtn = h("button", { type: "button", class: "app-btn ghost" }, "読み上げて聞く");
      const saved = h("small", { class: "pitch-saved" });
      const lens = h("div", { class: "pitch-lens", role: "radiogroup", "aria-label": "タイマーの長さ" }, LENGTHS.map(([v, label]) =>
        h("button", { type: "button", class: "pitch-len", role: "radio", "data-len": String(v), onclick: () => choose(v) }, label, v === 1500 ? h("small", null, "ポモドーロ") : null)));
      const soundBox = h("input", { type: "checkbox" });
      soundBox.checked = withSound;
      soundBox.addEventListener("change", () => { withSound = soundBox.checked; store.set("sound", withSound ? "1" : "0"); if (withSound) { audioReady(); soundWarn(); } });
      body.append(
        h("p", { class: "app-lead" }, "定例会の「30秒プレゼンテーション」の原稿を書いて、時間を計って練習できます。原稿はあなただけが見られます。タイマーは 1分・5分・25分(ポモドーロ)なども選べます。"),
        h("div", { class: "app-btn-row pitch-tools" }, App.btn("プロフィールからひな形を入れる", () => {
          if (text.value.trim() && !confirm("いまの原稿を、ひな形で置きかえますか?")) return;
          text.value = template(); update(); save();
        }, "ghost small"), saved),
        text, meter,
        lens,
        h("div", { class: "pitch-timer" }, ring, h("div", { class: "pitch-btns" }, startBtn, resetBtn, "speechSynthesis" in window ? sayBtn : null)),
        h("label", { class: "pitch-sound" }, soundBox, h("span", null, "0秒で音を鳴らす(残りわずかのときも小さく鳴らします)")),
        h("p", { class: "app-field-hint" }, "残りわずか(1分までは残り10秒、それより長いときは残り1分)と、0秒になったときに、音・画面の色・スマホのふるえ(対応する端末)でお知らせします。マナーモードのときは音が出ないことがあります。"));

      // 文字数と、読むのにかかる時間の目安(5分までの長さで比べる)
      function update() {
        const n = text.value.replace(/\s/g, "").length;
        const sec = Math.round(n / CHARS_PER_SEC);
        const goal = total <= 300 ? total : 30;
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

      // タイマー
      let timer = null, endAt = 0, wake = null;
      const warnAt = () => (total <= 60 ? 10 : 60);
      const draw = (left) => {
        const sec = Math.max(0, Math.ceil(left));
        clock.textContent = fmt(sec);
        clock.classList.toggle("is-long", sec >= 60);
        unit.textContent = sec >= 60 ? "分:秒" : "秒";
        ring.style.setProperty("--p", String(Math.max(0, left) / total));
        ring.classList.toggle("is-last", left <= warnAt() && left > 0);
        ring.classList.toggle("is-end", left <= 0);
      };
      const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* noop */ } };
      // 動いているあいだは画面を消さない(対応する端末)
      async function keepAwake(on) {
        try {
          if (on && "wakeLock" in navigator) wake = await navigator.wakeLock.request("screen");
          else if (!on && wake) { await wake.release(); wake = null; }
        } catch { /* noop */ }
      }
      function stop(label = "はじめる") { clearInterval(timer); timer = null; startBtn.textContent = label; keepAwake(false); }
      function choose(v) {
        if (timer && !confirm("タイマーを止めて、長さを変えますか?")) return;
        stop(); total = v; store.set("len", v);
        lens.querySelectorAll(".pitch-len").forEach((b) => { const on = Number(b.dataset.len) === v; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", on ? "true" : "false"); });
        draw(total); update();
      }
      let left0 = 0; // 一時停止したときの残り
      startBtn.addEventListener("click", () => {
        if (timer) { left0 = (endAt - Date.now()) / 1000; stop("つづける"); return; }
        if (withSound) audioReady();
        const remain = left0 > 0 ? left0 : total;
        endAt = Date.now() + remain * 1000;
        let warned = remain <= warnAt();
        left0 = 0;
        startBtn.textContent = "とめる";
        keepAwake(true);
        timer = setInterval(() => {
          const left = (endAt - Date.now()) / 1000;
          if (left <= warnAt() && !warned) { warned = true; buzz(120); if (withSound) soundWarn(); }
          draw(left);
          if (left <= 0) {
            stop(); buzz([200, 100, 200, 100, 200]);
            if (withSound) soundEnd();
            App.toast(`${lenLabel(total)}です。おつかれさまでした`);
          }
        }, 100);
      });
      resetBtn.addEventListener("click", () => { left0 = 0; stop(); draw(total); });
      sayBtn.addEventListener("click", () => {
        if (!text.value.trim()) { App.toast("原稿を入れてください"); return; }
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.value);
        u.lang = "ja-JP"; u.rate = 1.05;
        const t0 = Date.now();
        u.onend = () => App.toast(`読み上げは約${Math.round((Date.now() - t0) / 1000)}秒でした`);
        speechSynthesis.speak(u);
      });
      App.pitchStop = () => { left0 = 0; stop(); };
      choose(total);
      const d = await App.api("getMySettings", {}, { quiet: true });
      if (d && d.pitchScript && !text.value) { text.value = d.pitchScript; update(); }
    }, { noFocus: true, onClose: () => { try { if (App.pitchStop) App.pitchStop(); speechSynthesis.cancel(); } catch { /* noop */ } if (location.hash === "#me/pitch") history.replaceState(null, "", "#me"); } });
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
        h("p", { class: "app-lead" }, "今月がんばる数を決めると、ホームの「今月のあなた」に進み具合が出ます。0 の項目は出しません。"),
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
