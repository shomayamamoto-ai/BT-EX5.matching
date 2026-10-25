// ============================================
// app/stats.js — 記録 →「分析」: 自分の数字とメンバー別の数字(期間を選んで集計)
// 期間は ← 月 → / 当月 / 前月 / 直近6か月 / 期間指定。選んだ期間は下のメンバー別の表にも効く。
// メンバー別の表は、項目ごとに 1位・2位・3位・4位 を色分けし、見出しを押すと並べ替える。
// 上の「ダッシュボード」: 数字のカード(前の期間との増減)/ 活動の推移(6か月の折れ線)/
// 出した紹介の状況(ドーナツ)/ メンバー TOP5 / ありがとうマイルの推移(6か月の棒)
// ============================================

(function () {
  "use strict";
  const { h } = App;

  // 並びは順位の優先順(ありがとうマイル > 紹介 > 1on1 > ビジター招待 > 出席)。
  // 最初の項目(ありがとうマイル)が既定の並べ替え。同じ値のときは、この順で次の項目を比べる
  const COLS = [
    { id: "miles", label: "ありがとうマイル", fmt: man },
    { id: "referrals", label: "紹介", fmt: (n) => String(n) },
    { id: "oneOnOnes", label: "1on1", fmt: (n) => String(n) },
    { id: "visitors", label: "ビジター", fmt: (n) => String(n) },
    { id: "attended", label: "出席", fmt: (n) => String(n) },
  ];
  const DEFAULT_SORT = COLS[0].id;

  // 100.9万 のような表記
  // 0 は「—」、1万円未満は円、それより上は「◯.◯万」
  function man(n) {
    const v = Number(n || 0);
    if (!v) return "—";
    if (v < 10000) return `¥${v.toLocaleString("ja-JP")}`;
    return `${(v / 10000).toFixed(1)}万`;
  }
  function ymOf(key) { return key.slice(0, 7); }
  function shiftYm(ym, n) {
    const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function monthEnd(ym) {
    const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0);
    return `${ym}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function ymLabel(ym) { return `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`; }
  // 軸の目盛り用(1.5万 のように短く)
  function yenShort(n) {
    const v = Number(n || 0);
    if (!v) return "¥0";
    if (v < 10000) return `¥${v.toLocaleString("ja-JP")}`;
    return `¥${(v / 10000).toFixed(v % 10000 ? 1 : 0)}万`;
  }

  // ---------- グラフ(SVG。幅は入れものに合わせて描き直す) ----------
  const NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, ...kids) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (v !== null && v !== undefined) e.setAttribute(k, v); });
    kids.flat(Infinity).forEach((k) => { if (k !== null && k !== undefined) e.append(k); });
    return e;
  }
  // きりのよい目盛り(0 から max まで、4つほど)
  function niceTicks(max, whole) {
    const top = Math.max(whole ? 4 : 1, max);
    const raw = top / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw && (!whole || Number.isInteger(x))) || mag * 10;
    const out = [];
    for (let v = 0; v <= top + step * 0.001; v += step) out.push(v);
    if (out[out.length - 1] < top) out.push(out[out.length - 1] + step);
    return out;
  }
  // 入れものの幅が変わったら描き直す(画面から外れたら止める)
  function responsive(box, draw) {
    let w = 0;
    const redraw = () => { const nw = Math.round(box.clientWidth); if (nw && nw !== w) { w = nw; draw(nw); } };
    if (typeof ResizeObserver !== "undefined") { const ro = new ResizeObserver(() => { if (!box.isConnected) { ro.disconnect(); return; } redraw(); }); ro.observe(box); }
    requestAnimationFrame(redraw);
  }
  // 吹き出し(グラフの上に重ねる)
  function tipBox(box) {
    const tip = h("div", { class: "sd-tip", role: "status", "aria-live": "polite", hidden: true });
    box.append(tip);
    return {
      show(x, y, title, value) {
        tip.hidden = false;
        App.fill(tip, h("small", null, title), h("b", null, value));
        const bw = box.clientWidth, tw = tip.offsetWidth;
        tip.style.left = `${Math.max(4, Math.min(bw - tw - 4, x - tw / 2))}px`;
        tip.style.top = `${Math.max(0, y - tip.offsetHeight - 12)}px`;
      },
      hide() { tip.hidden = true; },
    };
  }
  // 折れ線(6か月)。points: [{ label, title, value }]
  function lineChart(points, fmt, whole) {
    const box = h("div", { class: "sd-chart" });
    const tip = tipBox(box);
    responsive(box, (W) => {
      const H = Math.max(190, Math.min(260, Math.round(W * 0.42)));
      const L = 40, R = 14, T = 14, B = 26;
      const ticks = niceTicks(Math.max(...points.map((p) => p.value)), whole);
      const top = ticks[ticks.length - 1] || 1;
      const x = (i) => L + (points.length > 1 ? (i * (W - L - R)) / (points.length - 1) : (W - L - R) / 2);
      const y = (v) => T + (H - T - B) * (1 - v / top);
      const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
      const area = `${line} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
      const cross = sv("line", { class: "sd-cross", x1: 0, x2: 0, y1: T, y2: y(0), visibility: "hidden" });
      const dots = points.map((p, i) => sv("circle", { class: `sd-dot${i === points.length - 1 ? " is-last" : ""}`, cx: x(i), cy: y(p.value), r: i === points.length - 1 ? 5 : 4 }));
      const svg = sv("svg", { class: "sd-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": points.map((p) => `${p.title} ${fmt(p.value)}`).join("、") },
        ticks.map((t) => [sv("line", { class: "sd-grid", x1: L, x2: W - R, y1: y(t), y2: y(t) }), sv("text", { class: "sd-ytick", x: L - 8, y: y(t) + 4, "text-anchor": "end" }, whole ? String(t) : yenShort(t))]),
        points.map((p, i) => sv("text", { class: "sd-xtick", x: x(i), y: H - 6, "text-anchor": "middle" }, p.label)),
        sv("path", { class: "sd-area", d: area }), sv("path", { class: "sd-line", d: line }), cross, dots,
        // いちばん新しい月の値だけ、点の横に出す
        sv("text", { class: "sd-end", x: x(points.length - 1) - 10, y: y(points[points.length - 1].value) - 12, "text-anchor": "end" }, fmt(points[points.length - 1].value)));
      const hit = sv("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" });
      const pick = (e) => {
        const r = svg.getBoundingClientRect();
        const px = e.clientX - r.left;
        let i = 0, best = Infinity;
        points.forEach((_, k) => { const d = Math.abs(x(k) - px); if (d < best) { best = d; i = k; } });
        cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
        dots.forEach((d, k) => d.classList.toggle("is-on", k === i));
        tip.show(x(i), y(points[i].value), points[i].title, fmt(points[i].value));
      };
      hit.addEventListener("pointermove", pick);
      hit.addEventListener("pointerdown", pick);
      hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.classList.remove("is-on")); tip.hide(); });
      svg.append(hit);
      box.querySelector("svg") ? box.querySelector("svg").replaceWith(svg) : box.prepend(svg);
    });
    return box;
  }
  // 縦の棒(6か月)。いちばん右(期間の終わりの月)を濃くして、値を上に出す
  function barChart(points, fmt, tickFmt) {
    const box = h("div", { class: "sd-chart" });
    const tip = tipBox(box);
    responsive(box, (W) => {
      const H = Math.max(180, Math.min(240, Math.round(W * 0.48)));
      const L = 46, R = 8, T = 30, B = 26;
      const ticks = niceTicks(Math.max(...points.map((p) => p.value)), false).map((t) => (t < 1 ? Math.round(t) : t));
      const top = ticks[ticks.length - 1] || 1;
      const slot = (W - L - R) / points.length;
      const bw = Math.min(24, slot * 0.5);
      const y = (v) => T + (H - T - B) * (1 - v / top);
      const last = points.length - 1;
      const bars = points.map((p, i) => {
        const cx = L + slot * (i + 0.5);
        const hgt = y(0) - y(p.value);
        const r = Math.min(4, hgt);
        // 上の角だけ丸く、下(0 の線)は四角
        const d = hgt <= 0 ? "" : `M${cx - bw / 2} ${y(0)} V${y(p.value) + r} Q${cx - bw / 2} ${y(p.value)} ${cx - bw / 2 + r} ${y(p.value)} H${cx + bw / 2 - r} Q${cx + bw / 2} ${y(p.value)} ${cx + bw / 2} ${y(p.value) + r} V${y(0)} Z`;
        const g = sv("g", { class: `sd-bar${i === last ? " is-last" : ""}`, tabindex: "0", role: "img", "aria-label": `${p.title} ${fmt(p.value)}` },
          sv("rect", { x: cx - slot / 2, y: T, width: slot, height: H - T - B, fill: "transparent" }), d ? sv("path", { d }) : null);
        const show = () => tip.show(cx, y(p.value), p.title, fmt(p.value));
        g.addEventListener("pointerenter", show); g.addEventListener("focus", show);
        g.addEventListener("pointerleave", () => tip.hide()); g.addEventListener("blur", () => tip.hide());
        return g;
      });
      const cxLast = L + slot * (last + 0.5);
      const svg = sv("svg", { class: "sd-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}` },
        ticks.map((t) => [sv("line", { class: "sd-grid", x1: L, x2: W - R, y1: y(t), y2: y(t) }), sv("text", { class: "sd-ytick", x: L - 8, y: y(t) + 4, "text-anchor": "end" }, (tickFmt || yenShort)(t))]),
        points.map((p, i) => sv("text", { class: `sd-xtick${i === last ? " is-last" : ""}`, x: L + slot * (i + 0.5), y: H - 6, "text-anchor": "middle" }, p.label)),
        bars,
        sv("text", { class: "sd-end", x: cxLast, y: y(points[last].value) - 8, "text-anchor": cxLast > W - 50 ? "end" : "middle" }, fmt(points[last].value)));
      box.querySelector("svg") ? box.querySelector("svg").replaceWith(svg) : box.prepend(svg);
    });
    return box;
  }
  // ドーナツ(内訳)。parts: [{ label, value, color }]
  function donut(parts, centerLabel, unit) {
    const total = parts.reduce((a, p) => a + p.value, 0);
    const S = 168, R = 76, r = 52, c = S / 2;
    const at = (a, rad) => [c + rad * Math.sin(a), c - rad * Math.cos(a)];
    const segs = [];
    let a0 = 0;
    const gap = total ? 0.035 : 0; // 2px ほどの すき間
    parts.forEach((p) => {
      if (!p.value) return;
      const a1 = a0 + (p.value / total) * Math.PI * 2;
      const s0 = a0 + (parts.filter((x) => x.value).length > 1 ? gap / 2 : 0), s1 = a1 - (parts.filter((x) => x.value).length > 1 ? gap / 2 : 0);
      const big = s1 - s0 > Math.PI ? 1 : 0;
      const full = p.value === total;
      const d = full
        ? `M${c} ${c - R} A${R} ${R} 0 1 1 ${c - 0.01} ${c - R} L${c - 0.01} ${c - r} A${r} ${r} 0 1 0 ${c} ${c - r} Z`
        : (() => { const [x0, y0] = at(s0, R), [x1, y1] = at(s1, R), [x2, y2] = at(s1, r), [x3, y3] = at(s0, r);
          return `M${x0} ${y0} A${R} ${R} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${big} 0 ${x3} ${y3} Z`; })();
      segs.push(sv("path", { d, fill: p.color, class: "sd-seg", "data-label": p.label }));
      a0 = a1;
    });
    const mid = h("div", { class: "sd-donut-mid" }, h("small", null, centerLabel), h("b", null, String(total)), h("small", null, unit));
    const svg = sv("svg", { class: "sd-donut-svg", viewBox: `0 0 ${S} ${S}`, role: "img", "aria-label": parts.map((p) => `${p.label} ${p.value}${unit}`).join("、") },
      total ? null : sv("circle", { cx: c, cy: c, r: (R + r) / 2, fill: "none", class: "sd-empty-ring", "stroke-width": R - r }), segs);
    const legend = h("ul", { class: "sd-legend" }, parts.map((p) => h("li", null,
      h("i", { style: `background:${p.color}` }), h("span", null, p.label),
      h("b", null, `${p.value}${unit}`), h("small", null, total ? `${((p.value / total) * 100).toFixed(1)}%` : "—"))));
    return h("div", { class: "sd-donut" }, h("div", { class: "sd-donut-fig" }, svg, mid), legend);
  }
  // ほかの画面(アンケートの結果など)でも同じグラフを使う
  App.charts = { lineChart, barChart, donut };
  function dateLabel(key) { return `${key.slice(0, 4)}年${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日`; }

  // 期間: params → { mode, ym, from, to, title }
  function periodOf(params) {
    const cur = ymOf(App.todayKey());
    const mode = ["month", "6m", "custom"].includes(params.get("p")) ? params.get("p") : "month";
    if (mode === "6m") {
      const from = `${shiftYm(cur, -5)}-01`;
      return { mode, from, to: monthEnd(cur), title: "直近6か月" };
    }
    if (mode === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(params.get("from") || "") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("to") || "")) {
      let from = params.get("from"), to = params.get("to");
      if (from > to) [from, to] = [to, from];
      return { mode, from, to, title: "期間指定" };
    }
    const ym = /^\d{4}-\d{2}$/.test(params.get("ym") || "") ? params.get("ym") : cur;
    return { mode: "month", ym, from: `${ym}-01`, to: monthEnd(ym), title: ym === cur ? "今月" : ym === shiftYm(cur, -1) ? "先月" : ymLabel(ym) };
  }

  // after: グラフのあとに置くもの(BT-EX5 シグナル・全体の今月)
  App.renderStats = async function (el, params, after) {
    const per = periodOf(params);
    const sortKey = COLS.some((c) => c.id === params.get("s")) ? params.get("s") : DEFAULT_SORT;
    const d = await App.api("getStats", { from: per.from, to: per.to });
    if (!d) return;
    const cur = ymOf(d.today);
    const link = (over) => {
      const p = new URLSearchParams();
      const next = Object.assign({ p: per.mode, ym: per.ym, from: per.from, to: per.to, s: sortKey }, over);
      if (next.p === "month") { p.set("p", "month"); p.set("ym", next.ym || cur); }
      else if (next.p === "custom") { p.set("p", "custom"); p.set("from", next.from); p.set("to", next.to); }
      else p.set("p", next.p);
      if (next.s && next.s !== DEFAULT_SORT) p.set("s", next.s);
      return `log/stats?${p}`;
    };

    // ---------- 期間の切り替え ----------
    const pill = (label, on, over) => h("button", { type: "button", class: `app-pill${on ? " is-on" : ""}`, onclick: () => App.go(link(over)) }, label);
    const head = h("div", { class: "st-period" },
      h("div", { class: "st-period-title" },
        h("h2", null, `自分の数字:${per.title}`),
        h("p", null, `${dateLabel(d.from)} 〜 ${dateLabel(d.to)} の集計`),
        h("small", null, "この期間は、下のメンバー別の表にも同じように効きます。")),
      h("div", { class: "st-period-ctrl" },
        per.mode === "month" ? h("div", { class: "st-month" },
          h("button", { type: "button", class: "st-arrow", "aria-label": "前の月", onclick: () => App.go(link({ p: "month", ym: shiftYm(per.ym, -1) })) }, "←"),
          h("b", null, ymLabel(per.ym)),
          h("button", { type: "button", class: "st-arrow", "aria-label": "次の月", disabled: per.ym >= cur, onclick: () => App.go(link({ p: "month", ym: shiftYm(per.ym, 1) })) }, "→")) : null,
        h("div", { class: "app-chips st-quick" },
          pill("当月", per.mode === "month" && per.ym === cur, { p: "month", ym: cur }),
          pill("前月", per.mode === "month" && per.ym === shiftYm(cur, -1), { p: "month", ym: shiftYm(cur, -1) }),
          pill("直近6か月", per.mode === "6m", { p: "6m" }),
          pill("期間指定", per.mode === "custom", { p: "custom", from: per.from, to: per.to }))));
    el.append(head);
    if (per.mode === "custom") {
      const from = h("input", { type: "date", value: d.from, "aria-label": "はじめの日" });
      const to = h("input", { type: "date", value: d.to, "aria-label": "おわりの日" });
      el.append(h("form", { class: "st-custom", onsubmit: (e) => { e.preventDefault(); if (from.value && to.value) App.go(link({ p: "custom", from: from.value, to: to.value })); } },
        from, h("span", null, "〜"), to, h("button", { type: "submit", class: "app-btn primary" }, "集計する")));
    }

    // ---------- 自分の数字(ダッシュボード) ----------
    const m = d.me || { attended: 0, referrals: 0, received: 0, oneOnOnes: 0, milesGiven: 0, milesReceived: 0, visitors: 0, visitorsGeneral: 0, visitorsLink: 0, joined: 0 };
    const pv = d.prev || {};
    const vsLabel = per.mode === "month" ? "前月比" : per.mode === "6m" ? "前の6か月比" : "前の同じ日数比";
    // 前の期間とくらべた増減(↑ +12% / ↓ −5% / 前と同じ / 新しく +2)
    const delta = (now, before, money) => {
      now = Number(now || 0); before = Number(before || 0);
      if (!before && !now) return h("p", { class: "sd-delta is-flat" }, h("span", null, "前と同じ"), h("small", null, vsLabel));
      if (!before) return h("p", { class: "sd-delta is-up" }, h("span", null, `↑ ${money ? App.yen(now) : `+${now}`}`), h("small", null, `${vsLabel}(前は0)`));
      const pct = Math.round(((now - before) / before) * 100);
      const cls = pct > 0 ? "is-up" : pct < 0 ? "is-down" : "is-flat";
      return h("p", { class: `sd-delta ${cls}` }, h("span", null, pct > 0 ? `↑ +${pct}%` : pct < 0 ? `↓ ${pct}%` : "±0%"), h("small", null, vsLabel));
    };
    const kpi = (icon, tone, label, value, now, before, money, sub) => h("div", { class: "sd-kpi" },
      h("div", { class: "sd-kpi-head" }, h("span", { class: `sd-kpi-ic tone-${tone}` }, App.glyph(icon)), h("span", null, label)),
      h("b", { class: "sd-kpi-val" }, value), delta(now, before, money), sub ? h("small", { class: "sd-kpi-sub" }, sub) : null);

    const orderAll = [DEFAULT_SORT, ...COLS.map((c) => c.id).filter((id) => id !== DEFAULT_SORT)];
    el.append(h("div", { class: "sd-kpis" },
      kpi("ref", "gold", "出した紹介", `${m.referrals}`, m.referrals, pv.referrals),
      kpi("ref", "blue", "受けた紹介", `${m.received}`, m.received, pv.received),
      kpi("one", "violet", "1on1", `${m.oneOnOnes}`, m.oneOnOnes, pv.oneOnOnes),
      kpi("calendar", "green", "出席", `${m.attended}`, m.attended, pv.attended),
      kpi("thanks", "coral", "ありがとうマイル(受け取った)", App.yen(m.milesGiven), m.milesGiven, pv.milesGiven, true, "自分の紹介・協力で相手が成約した分"),
      kpi("thanks", "amber", "ありがとうマイル(贈った)", App.yen(m.milesReceived), m.milesReceived, pv.milesReceived, true, "メンバーの紹介・協力で自分が成約できた分"),
      kpi("visitor", "teal", "招待したビジター", `${m.visitors}人`, m.visitors, pv.visitors, false, `一般 ${m.visitorsGeneral} / LINK BT ${m.visitorsLink}`),
      kpi("won", "gold", "入会者数", `${m.joined}人`, m.joined, pv.joined, false, `入会率 ${m.visitors ? `${Math.round((m.joined / m.visitors) * 100)}%` : "—"}`)));

    // 活動の推移(6か月)と、出した紹介の状況
    const series = d.series || [];
    const mLabel = (ym) => `${Number(ym.slice(5, 7))}月`;
    const TREND = [["referrals", "出した紹介", "件"], ["received", "受けた紹介", "件"], ["oneOnOnes", "1on1", "回"], ["attended", "出席", "回"], ["visitors", "ビジター", "人"]];
    let trendKey = "referrals";
    const trendBox = h("div", { class: "sd-trend-body" });
    const tabs = h("div", { class: "sd-tabs", role: "tablist", "aria-label": "推移の項目" });
    const drawTrend = () => {
      const [, label, unit] = TREND.find((t) => t[0] === trendKey);
      [...tabs.children].forEach((b) => { const on = b.dataset.k === trendKey; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); });
      // 共有サーバーが古い(6か月の数字を返さない)ときは、グラフの代わりに案内を出す
      if (!series.length) { App.fill(trendBox, h("p", { class: "sd-empty" }, "推移のグラフは、共有サーバーを新しくすると表示されます。")); return; }
      App.fill(trendBox, lineChart(series.map((x) => ({ label: mLabel(x.ym), title: `${ymLabel(x.ym)}の${label}`, value: x[trendKey] || 0 })), (v) => `${v}${unit}`, true));
    };
    TREND.forEach(([k, label]) => tabs.append(h("button", { type: "button", role: "tab", "data-k": k, onclick: () => { trendKey = k; drawTrend(); } }, label)));
    const mix = d.refMix || {};
    const MIX = [["new", "未対応", "#e0861a"], ["contacted", "連絡済み", "#58a6e8"], ["meeting", "商談中", "#2c5fb2"], ["won", "成約", "#16865a"], ["lost", "見送り", "#bdb2a6"]];
    const mixTotal = MIX.reduce((a, [k]) => a + (mix[k] || 0), 0);
    el.append(h("div", { class: "sd-row" },
      h("section", { class: "sd-card sd-trend" },
        h("div", { class: "sd-card-head" }, h("h3", null, "活動の推移(6か月)"), tabs),
        trendBox),
      h("section", { class: "sd-card sd-mix" },
        h("div", { class: "sd-card-head" }, h("h3", null, "出した紹介の状況")),
        donut(MIX.map(([k, label, color]) => ({ label, value: mix[k] || 0, color })), "この期間", "件"),
        h("small", { class: "sd-card-foot" }, mixTotal ? `成約率 ${Math.round(((mix.won || 0) / mixTotal) * 100)}%(この期間に出した紹介のいまの状況)` : "この期間に出した紹介はまだありません。"))));
    drawTrend();

    // メンバー TOP5 と、ありがとうマイルの推移
    const sortCol = COLS.find((c) => c.id === sortKey);
    const top5 = d.members.slice().sort((a, b) => { for (const k of [sortKey, ...orderAll.filter((x) => x !== sortKey)]) { if (b[k] !== a[k]) return b[k] - a[k]; } return (a.name || "").localeCompare(b.name || "", "ja"); }).filter((r) => r[sortKey] > 0).slice(0, 5);
    const topMax = Math.max(1, ...top5.map((r) => r[sortKey]));
    const lastMiles = series.length ? series[series.length - 1].milesGiven : 0;
    const prevMiles = series.length > 1 ? series[series.length - 2].milesGiven : 0;
    el.append(h("div", { class: "sd-row" },
      h("section", { class: "sd-card sd-top" },
        h("div", { class: "sd-card-head" }, h("h3", null, `メンバー TOP5(${sortCol.label})`),
          h("button", { type: "button", class: "sd-link", onclick: () => { const t = document.getElementById("stTable"); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); } }, "すべてのメンバーを見る ↓")),
        top5.length ? h("ol", { class: "sd-top-list" }, top5.map((r, i) => h("li", { class: r.isMe ? "is-me" : "" },
          h("span", { class: `sd-top-no st-r${i + 1}` }, String(i + 1)),
          App.avatar(r.name),
          h("a", { class: "sd-top-name", href: App.profileHref(r.id) }, r.name, r.isMe ? h("span", { class: "st-me" }, "あなた") : null),
          h("span", { class: "sd-top-bar", "aria-hidden": "true" }, h("i", { style: `width:${Math.round((r[sortKey] / topMax) * 100)}%` })),
          h("b", { class: "sd-top-val" }, sortCol.fmt(r[sortKey])))))
          : h("p", { class: "sd-empty" }, "この期間の記録はまだありません。")),
      h("section", { class: "sd-card sd-miles" },
        h("div", { class: "sd-card-head" }, h("h3", null, "ありがとうマイルの推移(受け取った)")),
        series.length ? barChart(series.map((x) => ({ label: mLabel(x.ym), title: ymLabel(x.ym), value: x.milesGiven || 0 })), (v) => App.yen(v)) : h("p", { class: "sd-empty" }, "推移のグラフは、共有サーバーを新しくすると表示されます。"),
        h("div", { class: "sd-miles-foot" },
          h("div", null, h("small", null, series.length ? `${ymLabel(series[series.length - 1].ym)}のマイル` : "マイル"), h("b", null, App.yen(lastMiles))),
          delta(lastMiles, prevMiles, true)))));
    if (after) el.append(after);

    // 検索での表示(この期間に「探す」の結果に出た回数)
    el.append(h("div", { class: "st-search" },
      h("span", null, App.glyph("search"), " この期間、あなたがメンバーの検索結果に出た回数"),
      h("b", null, `${m.searchShown || 0}回`, h("small", null, `(うち1位 ${m.searchTop || 0}回 / みんなの検索 ${m.searchTotal || 0}回)`)),
      (m.searchShown || 0) === 0 ? h("a", { href: "../profile/" }, "扱うジャンル・事業内容を入れると、検索に出やすくなります →") : null));
    el.append(h("p", { class: "st-note" },
      "招待したビジター:ビジター招待の URL から申し込み、参加が決まった方(日付は参加する定例会の開催日。同じ方は何回来ても1人)。", h("br"),
      "入会者数:そのうち入会した方。直近の期間は、これから入会する方がいるため少なめに出ます。"));

    // ---------- メンバー別の数字 ----------
    // 選んだ項目 → 残りを優先順で比べる(すべて同じなら同じ順位)
    const order = [sortKey, ...COLS.map((c) => c.id).filter((id) => id !== sortKey)];
    const cmp = (a, b) => { for (const k of order) { if (b[k] !== a[k]) return b[k] - a[k]; } return 0; };
    const rows = d.members.slice().sort((a, b) => cmp(a, b) || (a.name || "").localeCompare(b.name || "", "ja"));
    // 順位(どの項目も0の人は順位なし)
    const rowRank = new Map();
    rows.forEach((r, i) => {
      const zero = order.every((k) => !r[k]);
      const prev = rows[i - 1];
      rowRank.set(r, zero ? 0 : prev && cmp(prev, r) === 0 ? rowRank.get(prev) : i + 1);
    });
    // 項目ごとの順位(同じ値は同じ順位。0 は順位なし)
    const rankIn = {};
    COLS.forEach((c) => {
      const vals = d.members.map((r) => r[c.id]).filter((v) => v > 0).sort((a, b) => b - a);
      rankIn[c.id] = (v) => (v > 0 ? vals.indexOf(v) + 1 : 0);
    });
    const max = {};
    COLS.forEach((c) => { max[c.id] = Math.max(1, ...d.members.map((r) => r[c.id])); });

    const th = (c) => h("th", { scope: "col", class: `st-num${c.id === sortKey ? " is-sort" : ""}`, "aria-sort": c.id === sortKey ? "descending" : "none" },
      h("button", { type: "button", onclick: () => App.go(link({ s: c.id })) }, c.label, c.id === sortKey ? " ▼" : ""));
    const td = (r, c) => {
      const v = r[c.id];
      const rk = rankIn[c.id](v);
      return h("td", { class: "st-num" },
        h("span", { class: `st-val${rk && rk <= 4 ? ` st-r${rk}` : ""}` }, c.fmt(v)),
        h("span", { class: "st-bar", "aria-hidden": "true" }, h("i", { style: `width:${Math.round((v / max[c.id]) * 100)}%` })));
    };
    const t = d.total;
    el.append(h("section", { class: "st-table-card", id: "stTable" },
      h("div", { class: "st-table-head" },
        h("div", null, h("h2", null, `メンバー別の数字(${per.title})`),
          h("small", null, "順位は ありがとうマイル > 紹介 > 1on1 > ビジター招待 > 出席 の順に比べます。項目ごとに 1位・2位・3位・4位 を色分けしています。見出しを押すと、その項目を先に比べて並べ替えます。")),
        h("b", null, per.mode === "month" ? ymLabel(per.ym) : `${d.from.replace(/-/g, "/")}〜${d.to.replace(/-/g, "/")}`)),
      h("div", { class: "st-totals" },
        [["マイル(全体)", man(t.miles)], ["紹介(全体)", String(t.referrals)], ["1on1(全体)", String(t.oneOnOnes)], ["ビジター(全体)", String(t.visitors)], ["出席(のべ)", String(t.attended)]]
          .map(([k, v]) => h("div", null, h("small", null, k), h("b", null, v)))),
      h("p", { class: "st-scroll-hint" }, "表は横にすべらせると、ほかの数字が見られます →"),
      h("div", { class: "st-scroll" },
        h("table", { class: "st-table" },
          h("thead", null, h("tr", null, h("th", { scope: "col" }, "順位"), h("th", { scope: "col" }, "メンバー"), COLS.map(th))),
          h("tbody", null, rows.map((r) => {
            const rk = rowRank.get(r);
            return h("tr", { class: r.isMe ? "is-me" : "" },
              h("td", null, h("span", { class: `st-rank${rk && rk <= 4 ? ` st-r${rk}` : ""}` }, rk ? String(rk) : "—")),
              h("td", { class: "st-name" }, h("a", { href: App.profileHref(r.id) }, r.name), r.isMe ? h("span", { class: "st-me" }, "あなた") : null),
              COLS.map((c) => td(r, c)));
          }))))));
  };
})();
