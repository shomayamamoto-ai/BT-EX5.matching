// ============================================
// app/admin.js — 運営ダッシュボード(管理者)
// 月ごとの数字(前の月との差)・定例会ごとの出席・声かけが必要なメンバー・データの書き出し
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const DAY = 86400000;

  const KPIS = [
    { id: "referrals", label: "紹介", unit: "件" },
    { id: "won", label: "成約", unit: "件" },
    { id: "miles", label: "ありがとうマイル", yen: true },
    { id: "oneOnOnes", label: "1on1", unit: "回" },
    { id: "visitors", label: "ビジター申込", unit: "名" },
    { id: "posts", label: "掲示板の投稿", unit: "件" },
  ];
  const EXPORTS = [
    { kind: "referrals", label: "紹介の記録" },
    { kind: "thanks", label: "ありがとうマイル" },
    { kind: "attendance", label: "定例会の出欠" },
    { kind: "visitors", label: "ビジター" },
    { kind: "oneOnOnes", label: "1on1" },
  ];

  function monthLabel(m) { return `${Number(m.slice(0, 4))}年${Number(m.slice(5, 7))}月`; }
  function shiftMonth(m, n) {
    const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function fmtCell(v) {
    // 日時(ミリ秒)は読める形に
    if (typeof v === "number" && v > 1e12) {
      const d = new Date(v);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return String(v === undefined || v === null ? "" : v);
  }
  // Excel で文字化けしない CSV(先頭に BOM)。数式として読まれないよう = + - @ で始まる値は ' を付ける
  function downloadCsv(name, rows) {
    const esc = (v) => {
      let s = fmtCell(v);
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const text = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  App.renderDashboard = async function (el, monthParam) {
    const d = await App.api("adminDashboard", { month: monthParam || "" });
    if (!d) return;
    const go = (m) => App.go(`admin/dashboard/${m}`);
    el.append(h("div", { class: "dash-month" },
      App.btn("‹", () => go(shiftMonth(d.month, -1)), "ghost small"),
      h("b", null, monthLabel(d.month)),
      App.btn("›", () => go(shiftMonth(d.month, 1)), "ghost small")));

    // 数字(前の月との差)
    el.append(h("div", { class: "dash-kpis" }, KPIS.map((k) => {
      const v = d.totals[k.id];
      const p = d.prevTotals[k.id];
      const diff = v - p;
      return h("div", { class: "home-stat" },
        h("span", null, k.label),
        h("b", null, k.yen ? App.yen(v) : String(v), k.yen ? null : h("small", null, k.unit)),
        h("small", { class: `dash-diff ${diff > 0 ? "is-up" : diff < 0 ? "is-down" : ""}` },
          `前月 ${diff > 0 ? "+" : ""}${k.yen ? App.yen(diff).replace("¥-", "-¥") : diff}`));
    })));

    // 定例会ごとの出席
    el.append(App.section("この月の定例会",
      d.events.length
        ? h("ul", { class: "app-list" }, d.events.map((e) => h("li", null,
          h("a", { class: "app-row", href: `#events/manage/${e.id}` },
            h("span", { class: "app-row-main" }, h("b", null, `${App.fmtDate(e.date)} ${e.title}`),
              h("small", null, `出席予定 ${e.yes} ・ 欠席 ${e.no} ・ 出席 ${e.attended} ・ ビジター ${e.visitors}`)),
            h("span", { class: "dash-rate" }, d.members.length ? `${Math.round((e.attended / d.members.length) * 100)}%` : "")))))
        : App.empty("この月の定例会はありません。")));

    // 声かけが必要なメンバー: 30日以上ログインしていない・出席率が50%未満・この月の動きがない
    const now = d.now;
    const flags = (m) => {
      const f = [];
      if (!m.lastLoginAt) f.push("まだログインしていない");
      else if (now - m.lastLoginAt > 30 * DAY) f.push(`${Math.floor((now - m.lastLoginAt) / DAY)}日ログインなし`);
      if (m.attendRate !== null && m.attendRate < 50) f.push(`出席率 ${m.attendRate}%`);
      if (!m.monthGiven && !m.monthOnes && !m.monthReceived) f.push("この月の動きなし");
      return f;
    };
    const need = d.members.map((m) => ({ m, f: flags(m) })).filter((x) => x.f.length).sort((a, b) => b.f.length - a.f.length);
    const nudgeText = need.length ? [
      "【BT-EX5 運営より】",
      "いつもありがとうございます。会員サイトで、今月の紹介・1on1・定例会の出欠をぜひ記録してください。",
      "紹介したい人が分からないときは「探す」に相談の内容を入れるだけで候補が出ます。",
      App.siteUrl("#home"),
    ].join("\n") : "";
    el.append(App.section(`声かけが必要なメンバー(${need.length}名)`,
      need.length ? (() => {
        const list = h("ul", { class: "app-list" }, need.map((x, i) => h("li", { hidden: i >= 8 },
          h("div", { class: "app-row" }, App.avatar(x.m.name),
            h("span", { class: "app-row-main" }, h("b", null, x.m.name), h("small", null, x.f.join(" ・ "))),
            h("a", { class: "app-btn ghost small", href: `#talk/msg/new?to=${encodeURIComponent(x.m.id)}` }, "連絡")))));
        const more = need.length > 8 ? App.btn(`残りの ${need.length - 8} 名も見る`, () => {
          list.querySelectorAll("li[hidden]").forEach((li) => { li.hidden = false; });
          more.remove();
        }, "ghost small wide") : null;
        return [list, more];
      })() : App.empty("全員が動いています。"),
      need.length ? h("div", { class: "app-btn-row" }, App.btn("声かけの文をコピー", () => App.copyText(nudgeText, "コピーしました"), "small")) : null));

    // メンバーごとの数字(この月)
    const sorted = d.members.slice().sort((a, b) => (b.monthGiven + b.monthOnes) - (a.monthGiven + a.monthOnes));
    el.append(App.section("メンバーごとの数字",
      h("div", { class: "dash-table-wrap" }, h("table", { class: "dash-table" },
        h("thead", null, h("tr", null, ["名前", "紹介した", "された", "マイル", "1on1", "出席率"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", null, sorted.map((m) => h("tr", null,
          h("th", { scope: "row" }, m.name),
          h("td", null, String(m.monthGiven)), h("td", null, String(m.monthReceived)),
          h("td", null, m.monthMiles ? App.yen(m.monthMiles) : "0"), h("td", null, String(m.monthOnes)),
          h("td", null, m.attendRate === null ? "—" : `${m.attendRate}%`))))))));

    // 書き出し
    const stamp = App.todayKey().replace(/-/g, "");
    el.append(App.section("データを書き出す(Excel で開ける CSV)",
      h("p", { class: "app-field-hint" }, "紹介した方の連絡先は、紹介した人と受けた人だけのものなので含めません。"),
      h("div", { class: "app-btn-row" }, EXPORTS.map((x) => App.btn(x.label, async () => {
        const r = await App.api("adminExport", { kind: x.kind });
        if (r) downloadCsv(`BT-EX5-${x.kind}-${stamp}.csv`, r.rows);
      }, "ghost small")))));
  };
})();
