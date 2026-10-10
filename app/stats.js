// ============================================
// app/stats.js — 記録 →「数字」: 自分の数字とメンバー別の数字(期間を選んで集計)
// 期間は ← 月 → / 当月 / 前月 / 直近6か月 / 期間指定。選んだ期間は下のメンバー別の表にも効く。
// メンバー別の表は、項目ごとに 1位・2位・3位・4位 を色分けし、見出しを押すと並べ替える。
// ============================================

(function () {
  "use strict";
  const { h } = App;

  // 並びは順位の優先順(ありがとうマイル > リファーラル > 1on1 > ビジター招待 > 出席)。
  // 最初の項目(ありがとうマイル)が既定の並べ替え。同じ値のときは、この順で次の項目を比べる
  const COLS = [
    { id: "miles", label: "ありがとうマイル", fmt: man },
    { id: "referrals", label: "リファーラル", fmt: (n) => String(n) },
    { id: "oneOnOnes", label: "1on1", fmt: (n) => String(n) },
    { id: "visitors", label: "ビジター", fmt: (n) => String(n) },
    { id: "attended", label: "出席", fmt: (n) => String(n) },
  ];
  const DEFAULT_SORT = COLS[0].id;

  // 100.9万 のような表記
  function man(n) { return `${(Number(n || 0) / 10000).toFixed(1)}万`; }
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

  App.renderStats = async function (el, params) {
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

    // ---------- 自分の数字 ----------
    const m = d.me || { attended: 0, referrals: 0, received: 0, oneOnOnes: 0, milesGiven: 0, milesReceived: 0, visitors: 0, visitorsGeneral: 0, visitorsLink: 0, joined: 0 };
    const card = (label, value, unit, sub) => h("div", { class: "st-card" },
      h("span", null, label), h("b", null, value, unit ? h("small", null, unit) : null), sub ? h("small", { class: "st-card-sub" }, sub) : null);
    el.append(h("div", { class: "st-cards" },
      card("出席", String(m.attended)),
      card("出したリファーラル", String(m.referrals)),
      card("受けたリファーラル", String(m.received)),
      card("1on1", String(m.oneOnOnes)),
      card("ありがとうマイル(受け取った)", App.yen(m.milesGiven), "", "自分の紹介・協力で相手が成約した分"),
      card("ありがとうマイル(贈った)", App.yen(m.milesReceived), "", "メンバーの紹介・協力で自分が成約できた分"),
      card("招待したビジター", String(m.visitors), "人", `一般 ${m.visitorsGeneral} / LINK BT ${m.visitorsLink}`),
      card("入会者数", String(m.joined), "人", `招待したビジターのうち入会 / 入会率 ${m.visitors ? `${Math.round((m.joined / m.visitors) * 100)}%` : "—"}`)));
    // 検索での表示(この期間に「探す」の結果に出た回数)
    el.append(h("div", { class: "st-search" },
      h("span", null, "🔎 この期間、あなたがメンバーの検索結果に出た回数"),
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
    el.append(h("section", { class: "st-table-card" },
      h("div", { class: "st-table-head" },
        h("div", null, h("h2", null, `メンバー別の数字(${per.title})`),
          h("small", null, "順位は ありがとうマイル > リファーラル > 1on1 > ビジター招待 > 出席 の順に比べます。項目ごとに 1位・2位・3位・4位 を色分けしています。見出しを押すと、その項目を先に比べて並べ替えます。")),
        h("b", null, per.mode === "month" ? ymLabel(per.ym) : `${d.from.replace(/-/g, "/")}〜${d.to.replace(/-/g, "/")}`)),
      h("div", { class: "st-totals" },
        [["ありがとうマイル(全体)", man(t.miles)], ["リファーラル(全体)", String(t.referrals)], ["1on1(全体)", String(t.oneOnOnes)], ["ビジター(全体)", String(t.visitors)], ["出席(のべ)", String(t.attended)]]
          .map(([k, v]) => h("div", null, h("small", null, k), h("b", null, v)))),
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
