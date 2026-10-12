// ============================================
// app/round.js — 30秒プレゼンの進行(順番タイマー)
// 定例会の「30秒プレゼンテーション」を、出席予定の人の順番で進める。
// ・準備(シート): 1人の時間(30秒・1分・2分・3分)、出る人(出席予定のメンバー。ビジターも入れられる)、順番(上下・シャッフル)
// ・進行(全画面): いまの人の名前と会社、大きな残り時間、次の人、何人目か。
//   残り10秒と 0秒で音(鐘)。「自動で次へ」なら 0秒のあと3秒で次の人へ。
//   キー操作: スペース=止める・つづける、→=次へ、←=前へ、Esc=終わる(Meet の画面共有やプロジェクターで映す想定)
// 名前と会社だけを出す(連絡先などは出さない)
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const PER = [[30, "30秒"], [60, "1分"], [120, "2分"], [180, "3分"]];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(`btex5-round-${k}`); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(`btex5-round-${k}`, String(v)); } catch { /* noop */ } },
  };
  const fmt = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : String(sec));
  const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

  // いちばん近い定例会(今日をふくむ)。無ければ null
  async function nearestEvent() {
    const d = await App.api("listEvents", {}, { quiet: true });
    if (!d) return null;
    const today = App.todayKey();
    return d.events.filter((e) => e.date >= today).sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")))[0] || null;
  }

  // ---------- 準備 ----------
  App.roundSheet = function (opts = {}) {
    App.openSheet("30秒プレゼンの進行", async (body, close) => {
      body.append(h("p", { class: "app-loading" }, "読み込み中…"));
      const evId = opts.eventId || ((await nearestEvent()) || {}).id;
      const d = evId ? await App.api("getEvent", { id: evId }, { quiet: true }) : null;
      const ev = d && d.event;
      // 出る人の候補: 出席予定・出席のメンバー → 無ければ全メンバー。ビジターは別に
      const all = (App.members || []).map((m) => ({ key: `m:${m.id}`, name: m.name, sub: m.company || m.category || "", kind: "member" }));
      const going = d ? d.members.filter((m) => m.rsvp === "yes" || m.attended).map((m) => ({ key: `m:${m.id}`, name: m.name, sub: m.category || "", kind: "member" })) : [];
      const visitors = d ? (d.visitors || []).filter((v) => v.name && ["applied", "confirmed", "attended", "joined"].includes(v.status)).map((v) => ({ key: `v:${v.id}`, name: v.name, sub: v.company || "", kind: "visitor" })) : [];
      let pool = going.length ? going : all;
      let order = pool.slice();
      let per = Number(store.get("per", 30)) || 30;
      if (!PER.some(([v]) => v === per)) per = 30;
      let auto = store.get("auto", "1") === "1";

      const perRow = h("div", { class: "pitch-lens round-per" }, PER.map(([v, label]) =>
        h("button", { type: "button", class: `pitch-len${v === per ? " is-on" : ""}`, "data-per": String(v), onclick: (e) => {
          per = v; store.set("per", v);
          perRow.querySelectorAll(".pitch-len").forEach((b) => b.classList.toggle("is-on", b === e.currentTarget));
          drawTotal();
        } }, label)));
      const total = h("p", { class: "round-total" });
      const list = h("ol", { class: "round-list" });
      const autoBox = h("input", { type: "checkbox", onchange: () => { auto = autoBox.checked; store.set("auto", auto ? "1" : "0"); } });
      autoBox.checked = auto;
      const visBox = h("input", { type: "checkbox", onchange: () => {
        if (visBox.checked) order = order.concat(visitors.filter((v) => !order.some((o) => o.key === v.key)));
        else order = order.filter((o) => o.kind !== "visitor");
        drawList();
      } });
      const addSel = h("select", { class: "round-add", "aria-label": "人を足す", onchange: () => {
        const m = all.find((x) => x.key === addSel.value);
        if (m && !order.some((o) => o.key === m.key)) { order.push(m); drawList(); }
        addSel.value = "";
      } });

      function drawTotal() {
        const sec = order.length * per;
        total.textContent = `${order.length}名 × ${PER.find(([v]) => v === per)[1]} = 約${Math.floor(sec / 60)}分${sec % 60 ? `${sec % 60}秒` : ""}`;
      }
      function drawList() {
        App.fill(list, order.map((o, i) => h("li", { class: "round-item" },
          h("span", { class: "round-no" }, String(i + 1)),
          h("span", { class: "round-name" }, h("b", null, o.name), o.kind === "visitor" ? App.chip("ビジター", "info") : null, o.sub ? h("small", null, o.sub) : null),
          h("span", { class: "round-move" },
            h("button", { type: "button", "aria-label": `${o.name}さんを上へ`, disabled: i === 0, onclick: () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; drawList(); } }, "↑"),
            h("button", { type: "button", "aria-label": `${o.name}さんを下へ`, disabled: i === order.length - 1, onclick: () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; drawList(); } }, "↓"),
            h("button", { type: "button", "aria-label": `${o.name}さんを外す`, onclick: () => { order.splice(i, 1); drawList(); } }, "×")))));
        App.fill(addSel, h("option", { value: "" }, "＋ 人を足す"),
          all.filter((m) => !order.some((o) => o.key === m.key)).map((m) => h("option", { value: m.key }, m.name)));
        drawTotal();
      }

      App.fill(body,
        h("p", { class: "app-lead" }, ev
          ? `${App.fmtDate(ev.date)}「${ev.title}」の${going.length ? "出席予定の方" : "メンバー"}の順番で、30秒プレゼンを進めます。全画面で大きく出るので、会場のスクリーンや Meet の画面共有でも見せられます。`
          : "メンバーの順番で、30秒プレゼンを進めます。全画面で大きく出るので、会場のスクリーンや Meet の画面共有でも見せられます。"),
        h("p", { class: "round-label" }, "1人の時間"), perRow,
        h("div", { class: "round-head" }, h("p", { class: "round-label" }, "順番"),
          h("div", { class: "app-btn-row" },
            App.btn("シャッフル", () => { order = shuffle(order); drawList(); }, "ghost small"),
            App.btn("名前の順", () => { order = order.slice().sort((a, b) => a.name.localeCompare(b.name, "ja")); drawList(); }, "ghost small"))),
        visitors.length ? h("label", { class: "pitch-sound" }, visBox, h("span", null, `ビジター(${visitors.length}名)も入れる`)) : null,
        list, addSel, total,
        h("label", { class: "pitch-sound" }, autoBox, h("span", null, "0秒になったら、3秒あけて自動で次の人へ")),
        h("button", { type: "button", class: "app-btn primary wide round-go", onclick: () => {
          if (!order.length) { App.toast("出る人を入れてください", "error"); return; }
          close();
          App.roundRun(order.slice(), per, auto, ev ? ev.title : "");
        } }, "全画面ではじめる"),
        h("p", { class: "app-field-hint" }, "残り10秒で小さな音、0秒で鐘の音が鳴ります(マイページの音の設定とは別に、いつも鳴ります)。キーボードでは スペース=止める・つづける、→=次へ、←=前へ、Esc=終わる。"));
      drawList();
    }, { noFocus: true, onClose: () => { if (/^#events\/round/.test(location.hash)) history.replaceState(null, "", "#events"); } });
  };

  // ---------- 進行(全画面) ----------
  App.roundRun = function (people, per, auto, title) {
    App.timerSound.ready();
    let idx = 0, endAt = 0, left0 = per, timer = null, warned = false, gapUntil = 0, wake = null, done = false;
    const name = h("p", { class: "round-now-name" });
    const sub = h("p", { class: "round-now-sub" });
    const clock = h("b", { class: "round-clock" });
    const ring = h("div", { class: "round-ring" }, clock);
    const nextLine = h("p", { class: "round-next" });
    const count = h("p", { class: "round-count" });
    const pauseBtn = h("button", { type: "button", class: "round-btn is-main" });
    const prevBtn = h("button", { type: "button", class: "round-btn", onclick: () => go(idx - 1) }, "◀ 前へ");
    const nextBtn = h("button", { type: "button", class: "round-btn", onclick: () => go(idx + 1) }, "次へ ▶");
    const endBtn = h("button", { type: "button", class: "round-btn round-end", onclick: () => finish(true) }, "終わる");
    const stage = h("div", { class: "round-stage" }, count, name, sub, ring, nextLine);
    const box = h("div", { class: "round-run", role: "dialog", "aria-label": "30秒プレゼンの進行" },
      h("p", { class: "round-title" }, title ? `${title} ・ 30秒プレゼン` : "30秒プレゼン"),
      stage,
      h("div", { class: "round-ctrl" }, prevBtn, pauseBtn, nextBtn, endBtn));
    document.body.append(box);
    document.documentElement.classList.add("round-open");
    try { if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then((w) => { wake = w; }).catch(() => {}); } catch { /* noop */ }

    const running = () => Boolean(timer);
    const leftNow = () => (running() ? (endAt - Date.now()) / 1000 : left0);
    function draw() {
      if (done) return;
      const p = people[idx], n = people[idx + 1];
      count.textContent = `${idx + 1} / ${people.length} 人目`;
      name.textContent = `${p.name}さん`;
      sub.textContent = [p.kind === "visitor" ? "ビジター" : "", p.sub].filter(Boolean).join(" ・ ");
      nextLine.textContent = n ? `次は ${n.name}さん` : "最後の方です";
      const gap = gapUntil > Date.now();
      const left = gap ? 0 : leftNow();
      const sec = Math.max(0, Math.ceil(left));
      clock.textContent = gap ? `次まで ${Math.ceil((gapUntil - Date.now()) / 1000)}` : fmt(sec);
      clock.classList.toggle("is-gap", gap);
      ring.style.setProperty("--p", String(Math.max(0, left) / per));
      ring.classList.toggle("is-last", left <= 10 && left > 0);
      ring.classList.toggle("is-end", left <= 0);
      pauseBtn.textContent = running() || gap ? "⏸ とめる" : left0 < per && left0 > 0 ? "▶ つづける" : left <= 0 ? "▶ もう一度" : "▶ はじめる";
      prevBtn.disabled = idx === 0;
      nextBtn.textContent = idx === people.length - 1 ? "おわり ▶" : "次へ ▶";
    }
    function halt() { clearInterval(timer); timer = null; }
    function start() {
      if (left0 <= 0) left0 = per;
      endAt = Date.now() + left0 * 1000; warned = left0 <= 10;
      timer = setInterval(tick, 100); draw();
    }
    function tick() {
      if (gapUntil) {
        if (Date.now() >= gapUntil) { gapUntil = 0; halt(); go(idx + 1, true); }
        else draw();
        return;
      }
      const left = leftNow();
      if (left <= 10 && !warned) { warned = true; App.timerSound.warn(); }
      if (left <= 0) {
        halt(); left0 = 0;
        App.timerSound.end();
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch { /* noop */ }
        if (auto && idx < people.length - 1) { gapUntil = Date.now() + 3000; timer = setInterval(tick, 100); }
      }
      draw();
    }
    function go(i, autoStart) {
      halt(); gapUntil = 0;
      if (i >= people.length) { finish(false); return; }
      idx = Math.max(0, i); left0 = per;
      stage.classList.remove("is-in"); void stage.offsetWidth; stage.classList.add("is-in");
      if (autoStart) start(); else draw();
    }
    pauseBtn.addEventListener("click", () => {
      if (gapUntil) { halt(); gapUntil = 0; draw(); return; }
      if (running()) { left0 = Math.max(0.1, leftNow()); halt(); draw(); } else start();
    });
    function finish(early) {
      if (early && !confirm("進行を終わりますか?")) return;
      halt(); gapUntil = 0; done = true;
      const said = early ? idx : people.length;
      App.fill(stage, h("p", { class: "round-now-name" }, "おつかれさまでした"),
        h("p", { class: "round-now-sub" }, `${said}名の方が話しました`));
      App.fill(box.querySelector(".round-ctrl"), h("button", { type: "button", class: "round-btn is-main", onclick: closeRun }, "閉じる"));
    }
    function closeRun() {
      halt(); box.remove(); document.documentElement.classList.remove("round-open");
      document.removeEventListener("keydown", onKey);
      try { if (wake) wake.release(); } catch { /* noop */ }
    }
    function onKey(e) {
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.key === " ") { e.preventDefault(); if (!done) pauseBtn.click(); }
      else if (e.key === "ArrowRight" && !done) go(idx + 1);
      else if (e.key === "ArrowLeft" && !done && idx > 0) go(idx - 1);
      else if (e.key === "Escape") { if (done) closeRun(); else finish(true); }
    }
    document.addEventListener("keydown", onKey);
    draw();
    pauseBtn.focus({ preventScroll: true });
  };
})();
