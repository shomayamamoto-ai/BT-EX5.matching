// ============================================
// app/pitch.js — 30秒プレゼンの練習と、今月の目標
// ・30秒プレゼン: 原稿(本人だけが見る。サーバーに保存)・文字数と読む時間の目安・30秒タイマー(残り10秒と終わりで知らせる)・読み上げ
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

  App.pitchSheet = function () {
    App.openSheet("30秒プレゼンの練習", async (body) => {
      const text = h("textarea", { class: "pitch-text", rows: "7", maxlength: "800", placeholder: "例:〇〇株式会社の山田です。飲食店さまの集客を、SNS と動画でお手伝いしています。ご紹介いただきたいのは、新しくお店を始める方です。よろしくお願いいたします。" });
      const meter = h("p", { class: "pitch-meter" });
      const clock = h("b", { class: "pitch-clock" }, "30");
      const ring = h("div", { class: "pitch-ring" }, clock, h("small", null, "秒"));
      const startBtn = h("button", { type: "button", class: "app-btn primary" }, "練習をはじめる");
      const resetBtn = h("button", { type: "button", class: "app-btn ghost" }, "もどす");
      const sayBtn = h("button", { type: "button", class: "app-btn ghost" }, "読み上げて聞く");
      const saved = h("small", { class: "pitch-saved" });
      body.append(
        h("p", { class: "app-lead" }, "定例会の「30秒プレゼンテーション」の原稿を書いて、時間を計って練習できます。原稿はあなただけが見られます。"),
        h("div", { class: "app-btn-row pitch-tools" }, App.btn("プロフィールからひな形を入れる", () => {
          if (text.value.trim() && !confirm("いまの原稿を、ひな形で置きかえますか?")) return;
          text.value = template(); update(); save();
        }, "ghost small"), saved),
        text, meter,
        h("div", { class: "pitch-timer" }, ring, h("div", { class: "pitch-btns" }, startBtn, resetBtn, "speechSynthesis" in window ? sayBtn : null)),
        h("p", { class: "app-field-hint" }, "残り10秒と、30秒になったときに、画面の色とスマホのふるえ(対応する端末)でお知らせします。"));

      // 文字数と、読むのにかかる時間の目安
      function update() {
        const n = text.value.replace(/\s/g, "").length;
        const sec = Math.round(n / CHARS_PER_SEC);
        meter.className = `pitch-meter${sec > 32 ? " is-over" : sec >= 24 ? " is-good" : ""}`;
        meter.textContent = n ? `${n}文字 ・ 読むと約${sec}秒${sec > 32 ? "(長すぎます。30秒は 250字くらいまで)" : sec >= 24 ? "(ちょうどよい長さです)" : "(30秒は 250字くらいが目安)"}` : "30秒で話せるのは 250字くらいです";
      }
      // 書いたら少しして自動で保存
      let saveTimer = null;
      async function save() {
        const r = await App.api("updateMySettings", { pitchScript: text.value }, { quiet: true });
        saved.textContent = r ? "保存しました" : "";
      }
      text.addEventListener("input", () => { update(); saved.textContent = ""; clearTimeout(saveTimer); saveTimer = setTimeout(save, 900); });

      // 30秒タイマー
      let timer = null, endAt = 0;
      const draw = (left) => {
        clock.textContent = String(Math.max(0, Math.ceil(left)));
        ring.style.setProperty("--p", String(Math.max(0, left) / 30));
        ring.classList.toggle("is-last", left <= 10 && left > 0);
        ring.classList.toggle("is-end", left <= 0);
      };
      const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* noop */ } };
      function stop() { clearInterval(timer); timer = null; startBtn.textContent = "練習をはじめる"; }
      startBtn.addEventListener("click", () => {
        if (timer) { stop(); return; }
        endAt = Date.now() + 30000;
        let warned = false;
        startBtn.textContent = "とめる";
        timer = setInterval(() => {
          const left = (endAt - Date.now()) / 1000;
          if (left <= 10 && !warned) { warned = true; buzz(120); }
          draw(left);
          if (left <= 0) { stop(); buzz([200, 100, 200]); App.toast("30秒です。おつかれさまでした"); }
        }, 100);
      });
      resetBtn.addEventListener("click", () => { stop(); draw(30); });
      sayBtn.addEventListener("click", () => {
        if (!text.value.trim()) { App.toast("原稿を入れてください"); return; }
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.value);
        u.lang = "ja-JP"; u.rate = 1.05;
        const t0 = Date.now();
        u.onend = () => App.toast(`読み上げは約${Math.round((Date.now() - t0) / 1000)}秒でした`);
        speechSynthesis.speak(u);
      });
      draw(30);
      update();
      const d = await App.api("getMySettings", {}, { quiet: true });
      if (d && d.pitchScript && !text.value) { text.value = d.pitchScript; update(); }
    }, { noFocus: true, onClose: () => { try { speechSynthesis.cancel(); } catch { /* noop */ } if (location.hash === "#me/pitch") history.replaceState(null, "", "#me"); } });
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
