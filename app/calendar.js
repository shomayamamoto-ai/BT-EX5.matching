// ============================================
// app/calendar.js — 予定のカレンダーと、立体的な時計
// ・カレンダー: 定例会・1on1・紹介の顔合わせ・やることの期限を、月ごとに1枚で見る。日を押すとその日の予定
// ・時計: 黒×金の文字盤に、金の針と秒針がなめらかに回るアナログ時計(日本時間)
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const JST = 9 * 60 * 60 * 1000;
  const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  const KINDS = {
    event: { label: "定例会", cls: "is-event" },
    one: { label: "1on1", cls: "is-one" },
    ref: { label: "紹介の顔合わせ", cls: "is-ref" },
    task: { label: "やることの期限", cls: "is-task" },
  };
  // 表示中の月と選んだ日(自動の読み込み直しのあとも同じ月のまま)
  const state = { ym: "", sel: "" };

  function jstNow() { return new Date(Date.now() + JST); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function key(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
  function longDate(k) {
    const [y, m, d] = k.split("-").map(Number);
    return `${m}月${d}日(${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
  }

  // ---------- 予定を集める ----------
  async function collect(events) {
    const items = [];
    (events || []).forEach((e) => items.push({
      kind: "event", date: e.date, time: e.start || "", title: e.title,
      sub: [e.start && `${e.start}${e.end ? `〜${e.end}` : ""}`, e.online ? "オンライン" : e.place, e.attended ? "出席済み" : e.myRsvp === "yes" ? "出席予定" : e.myRsvp === "no" ? "欠席" : e.past ? "" : "出欠まだ"].filter(Boolean).join(" ・ "),
      href: `#events/detail/${encodeURIComponent(e.id)}`,
    }));
    const [ones, refs, tasks] = await Promise.all([
      App.api("list1on1", {}, { quiet: true }),
      App.api("listMyReferrals", {}, { quiet: true }),
      App.api("listTasks", {}, { quiet: true }),
    ]);
    ((ones && ones.items) || []).filter((o) => o.status !== "cancelled").forEach((o) => items.push({
      kind: "one", date: o.date, time: o.time || "", title: `${o.withName}さんと 1on1`,
      sub: [o.time && `${o.time}${o.end ? `〜${o.end}` : ""}`, o.mode === "meet" ? "Google Meet" : o.place, o.status === "done" ? "実施済み" : ""].filter(Boolean).join(" ・ "),
      href: "#log/1on1", meetUrl: o.status === "planned" ? o.meetUrl : "",
    }));
    const seen = new Set();
    (refs ? [...(refs.given || []), ...(refs.received || [])] : []).forEach((r) => {
      if (!r.meeting || seen.has(r.id)) return;
      seen.add(r.id);
      const mt = r.meeting;
      items.push({
        kind: "ref", date: mt.date, time: mt.time || "", title: `顔合わせ:${r.prospect || "お客様"}`,
        sub: [mt.time, r.mine ? `${r.toName}さんへの紹介` : `${r.fromName}さんからの紹介`, mt.mode === "meet" ? "Google Meet" : mt.place].filter(Boolean).join(" ・ "),
        href: "#log/ref", meetUrl: mt.meetUrl || "",
      });
    });
    ((tasks && tasks.items) || []).filter((t) => t.due && t.mine && !t.myDone).forEach((t) => items.push({
      kind: "task", date: t.due, time: t.time || "", title: t.title, sub: t.private ? "自分だけのやること" : t.eventTitle ? `定例会:${t.eventTitle}` : "やること", href: "#home",
    }));
    items.sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));
    return items;
  }

  // ---------- カレンダー ----------
  // events: listEvents の定例会。today: "YYYY-MM-DD"
  function calendarPanel(events, today) {
    if (!state.ym) state.ym = today.slice(0, 7);
    if (!state.sel) state.sel = today;
    let items = [];
    const byDay = new Map();
    const title = h("h2", { class: "cal-title", "aria-live": "polite" });
    const grid = h("div", { class: "cal-grid", role: "grid" });
    const dayBox = h("section", { class: "cal-day", "aria-live": "polite" });
    const legend = h("p", { class: "cal-legend" }, Object.keys(KINDS).map((k) => h("span", { class: KINDS[k].cls }, KINDS[k].label)), h("small", { class: "cal-swipe-hint" }, "左右にはらうと月が変わります"));

    function shift(n) {
      const [y, m] = state.ym.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 + n, 1));
      state.ym = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
      drawMonth();
    }
    const head = h("div", { class: "cal-head" },
      h("button", { type: "button", class: "cal-nav", "aria-label": "前の月", onclick: () => shift(-1) }, "‹"),
      title,
      h("button", { type: "button", class: "cal-nav", "aria-label": "次の月", onclick: () => shift(1) }, "›"),
      h("button", { type: "button", class: "cal-today", onclick: () => { state.ym = today.slice(0, 7); state.sel = today; drawMonth(); drawDay(); } }, "今日"));

    function drawMonth() {
      const [y, m] = state.ym.split("-").map(Number);
      title.textContent = `${y}年${m}月`;
      const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const cells = [];
      WEEK.forEach((w, i) => cells.push(h("span", { class: `cal-wd${i === 0 ? " is-sun" : i === 6 ? " is-sat" : ""}`, role: "columnheader" }, w)));
      const total = Math.ceil((first + days) / 7) * 7;
      for (let i = 0; i < total; i++) {
        const d = i - first + 1;
        if (d < 1 || d > days) { cells.push(h("span", { class: "cal-cell is-blank", "aria-hidden": "true" })); continue; }
        const k = key(y, m - 1, d);
        const list = byDay.get(k) || [];
        const dow = i % 7;
        const kinds = [...new Set(list.map((x) => x.kind))];
        cells.push(h("button", {
          type: "button", role: "gridcell",
          class: `cal-cell${k === today ? " is-today" : ""}${k === state.sel ? " is-sel" : ""}${k < today ? " is-past" : ""}${dow === 0 ? " is-sun" : dow === 6 ? " is-sat" : ""}`,
          "aria-pressed": k === state.sel ? "true" : "false",
          "aria-label": `${m}月${d}日${list.length ? ` 予定${list.length}件` : ""}`,
          onclick: () => { state.sel = k; drawMonth(); drawDay(); },
        },
          h("span", { class: "cal-num" }, String(d)),
          // スマホは色の点、パソコンは予定の名前
          list.length ? h("span", { class: "cal-dots", "aria-hidden": "true" }, kinds.slice(0, 4).map((x) => h("i", { class: KINDS[x].cls }))) : null,
          list.length ? h("span", { class: "cal-labels", "aria-hidden": "true" },
            list.slice(0, 2).map((x) => h("span", { class: KINDS[x.kind].cls }, `${x.time ? `${x.time} ` : ""}${x.kind === "one" ? x.title.replace("さんと 1on1", "") : x.kind === "event" ? "定例会" : x.title}`)),
            list.length > 2 ? h("small", null, `ほか${list.length - 2}件`) : null) : null));
      }
      App.fill(grid, cells);
    }

    function drawDay() {
      const list = byDay.get(state.sel) || [];
      App.fill(dayBox,
        h("h3", null, `${longDate(state.sel)}の予定`, state.sel === today ? h("span", { class: "cal-day-today" }, "今日") : null),
        list.length
          ? h("ul", { class: "cal-day-list" }, list.map((x) => h("li", { class: KINDS[x.kind].cls },
            h("a", { href: x.href },
              h("span", { class: "cal-day-time" }, x.time || (x.kind === "task" ? "期限" : "終日")),
              h("span", { class: "cal-day-main" }, h("small", null, KINDS[x.kind].label), h("b", null, x.title), x.sub ? h("span", null, x.sub) : null)),
            x.meetUrl && state.sel >= today ? h("a", { class: "cal-day-meet", href: x.meetUrl, target: "_blank", rel: "noopener" }, "Meet に参加") : null)))
          : h("p", { class: "cal-day-empty" }, "この日の予定はありません。"),
        h("div", { class: "cal-day-add" },
          h("a", { class: "app-btn ghost small", href: "#log/1on1?new" }, "＋ 1on1 を入れる"),
          h("button", { type: "button", class: "app-btn ghost small", onclick: () => App.taskForm({ due: state.sel }, () => App.route()) }, "＋ やることを入れる")));
    }

    const main = h("div", { class: "cal-main" }, head, grid, legend);
    // 指で左右にはらうと、次の月・前の月へ
    let touch = null;
    grid.addEventListener("touchstart", (e) => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
    grid.addEventListener("touchend", (e) => {
      if (!touch) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
    }, { passive: true });
    drawMonth();
    drawDay();
    collect(events).then((all) => {
      items = all;
      byDay.clear();
      items.forEach((x) => { if (!byDay.has(x.date)) byDay.set(x.date, []); byDay.get(x.date).push(x); });
      drawMonth();
      drawDay();
      if (panel.onItems) panel.onItems(items);
    }).catch(() => {});
    const panel = { main, day: dayBox };
    return panel;
  }

  // ---------- 立体的な時計(黒の文字盤 × 金) ----------
  let clockId = 0;
  function luxClock() {
    const id = `lux${++clockId}`;
    const NS = "http://www.w3.org/2000/svg";
    const ticks = [];
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      ticks.push(`<line x1="100" y1="11.5" x2="100" y2="15" transform="rotate(${i * 6} 100 100)"/>`);
    }
    const marks = [];
    for (let i = 0; i < 12; i++) {
      if (i === 3) continue; // 3時は日付の窓
      const w = i % 3 === 0 ? 7 : 4.2;
      if (i === 0) {
        // 12時は2本のバー
        marks.push(`<rect x="${100 - 7.2}" y="17" width="5.4" height="22" rx="1.2" fill="url(#${id}g)" stroke="url(#${id}e)" stroke-width=".5"/>`);
        marks.push(`<rect x="${100 + 1.8}" y="17" width="5.4" height="22" rx="1.2" fill="url(#${id}g)" stroke="url(#${id}e)" stroke-width=".5"/>`);
      } else {
        marks.push(`<rect x="${100 - w / 2}" y="18" width="${w}" height="${i % 3 === 0 ? 20 : 15}" rx="1.2" fill="url(#${id}g)" stroke="url(#${id}e)" stroke-width=".5" transform="rotate(${i * 30} 100 100)"/>`);
      }
    }
    const svg = `
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#fff3c9"/><stop offset=".35" stop-color="#e2b866"/>
            <stop offset=".55" stop-color="#9c6a27"/><stop offset=".8" stop-color="#e9c77b"/><stop offset="1" stop-color="#b8873f"/>
          </linearGradient>
          <linearGradient id="${id}e" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff8dc"/><stop offset="1" stop-color="#6e4a1a"/>
          </linearGradient>
          <linearGradient id="${id}hl" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#8a5f22"/><stop offset=".5" stop-color="#f8e3a6"/><stop offset=".5" stop-color="#c99a52"/><stop offset="1" stop-color="#6e4a1a"/>
          </linearGradient>
          <radialGradient id="${id}cap" cx=".35" cy=".35" r=".8">
            <stop offset="0" stop-color="#fff6d5"/><stop offset=".5" stop-color="#d4a85a"/><stop offset="1" stop-color="#7a5320"/>
          </radialGradient>
          <filter id="${id}s" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="1.6" dy="2.6" stdDeviation="1.4" flood-color="#000" flood-opacity=".55"/>
          </filter>
          <filter id="${id}s2" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx=".6" dy="1" stdDeviation=".5" flood-color="#000" flood-opacity=".6"/>
          </filter>
        </defs>
        <g class="lux-ticks" stroke="#b8935a" stroke-width=".9" stroke-linecap="round" opacity=".75">${ticks.join("")}</g>
        <g filter="url(#${id}s2)">${marks.join("")}</g>
        <text x="100" y="62" text-anchor="middle" class="lux-brand">BT-EX5</text>
        <text x="100" y="71" text-anchor="middle" class="lux-sub">NIIGATA · TOKYO</text>
        <text x="100" y="146" text-anchor="middle" class="lux-sub">AUTOMATIC</text>
        <g filter="url(#${id}s2)">
          <rect x="149" y="92" width="22" height="16" rx="2" fill="#f8f3e7" stroke="url(#${id}g)" stroke-width="1.6"/>
          <text x="160" y="104" text-anchor="middle" class="lux-date"></text>
        </g>
        <g class="lux-h" filter="url(#${id}s)">
          <path d="M100 47 L105.2 100 L100 112 L94.8 100 Z" fill="url(#${id}hl)"/>
          <path d="M100 56 L101.6 96 L100 100 L98.4 96 Z" fill="#fff8e1" opacity=".55"/>
        </g>
        <g class="lux-m" filter="url(#${id}s)">
          <path d="M100 19 L103.8 100 L100 114 L96.2 100 Z" fill="url(#${id}hl)"/>
          <path d="M100 30 L101.1 94 L100 98 L98.9 94 Z" fill="#fff8e1" opacity=".55"/>
        </g>
        <g class="lux-s" filter="url(#${id}s)">
          <line x1="100" y1="126" x2="100" y2="16" stroke="#e2532f" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="100" cy="122" r="3.6" fill="#e2532f"/>
          <circle cx="100" cy="100" r="5.4" fill="#e2532f"/>
        </g>
        <circle cx="100" cy="100" r="3.6" fill="url(#${id}cap)"/>
      </svg>`;
    const dial = h("div", { class: "lux-dial" });
    dial.innerHTML = svg;
    const wrap = h("div", { class: "lux-clock", role: "img" },
      h("div", { class: "lux-lug is-top", "aria-hidden": "true" }),
      h("div", { class: "lux-lug is-bottom", "aria-hidden": "true" }),
      h("div", { class: "lux-crown", "aria-hidden": "true" }),
      h("div", { class: "lux-bezel", "aria-hidden": "true" }, dial, h("div", { class: "lux-glass" })));
    const hh = dial.querySelector(".lux-h"), mm = dial.querySelector(".lux-m"), ss = dial.querySelector(".lux-s");
    const dateText = dial.querySelector(".lux-date");
    const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let started = false, lastMin = -1;
    function frame() {
      if (!wrap.isConnected) { if (started) return; requestAnimationFrame(frame); return; }
      started = true;
      const now = jstNow();
      const ms = now.getUTCMilliseconds();
      const s = now.getUTCSeconds() + (calm ? 0 : ms / 1000);
      const m = now.getUTCMinutes() + s / 60;
      const hr = (now.getUTCHours() % 12) + m / 60;
      ss.setAttribute("transform", `rotate(${s * 6} 100 100)`);
      mm.setAttribute("transform", `rotate(${m * 6} 100 100)`);
      hh.setAttribute("transform", `rotate(${hr * 30} 100 100)`);
      if (now.getUTCMinutes() !== lastMin) {
        lastMin = now.getUTCMinutes();
        dateText.textContent = String(now.getUTCDate());
        wrap.setAttribute("aria-label", `いまの時刻 ${now.getUTCHours()}時${lastMin}分`);
        if (wrap.onMinute) wrap.onMinute(now);
      }
      if (calm || document.hidden) setTimeout(() => requestAnimationFrame(frame), 1000 - ms);
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    void NS;
    return wrap;
  }

  // 時計と今日の日付・いまの時刻・次の予定(予定の画面の上)
  function clockCard(nextEvent, today) {
    const clock = luxClock();
    const time = h("b", { class: "cal-now-time" });
    const date = h("span", { class: "cal-now-date" });
    const next = h("span", { class: "cal-now-next" });
    clock.onMinute = (now) => {
      time.textContent = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
      const k = key(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      date.textContent = `${now.getUTCFullYear()}年 ${longDate(k)}`;
    };
    if (nextEvent) {
      const days = App.daysUntil(nextEvent.date, today);
      next.textContent = days === 0 ? `今日は定例会です${nextEvent.start ? `(${nextEvent.start}〜)` : ""}` : `次の定例会まで あと${days}日`;
    }
    return h("div", { class: "cal-clock-card" }, clock, h("div", { class: "cal-now" }, date, time, nextEvent ? next : null));
  }

  App.calendarPanel = calendarPanel;
  App.collectSchedule = collect; // ホームの「今日・明日の予定」でも使う
  App.SCHEDULE_KINDS = KINDS;
  App.luxClock = luxClock;
  App.clockCard = clockCard;
})();
