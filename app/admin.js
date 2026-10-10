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
            h("a", { class: "app-btn ghost small", href: App.profileHref(x.m.id) }, "連絡先")))));
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

    // 検索での表示(紹介診断・相談アシスタント・ジャンルで探す の結果に出た回数)
    const s = d.search || { total: 0, misses: [] };
    const bySearch = d.members.slice().sort((a, b) => b.searchShown - a.searchShown || b.searchTop - a.searchTop);
    const hidden = d.members.filter((m) => !m.topicCount || (s.total >= 10 && !m.searchShown));
    const profileAsk = [
      "【BT-EX5 運営より】プロフィールのお願い",
      "会員サイトの「探す」(紹介診断・相談アシスタント)で、あなたが紹介先の候補に出るように、",
      "マイページ →「プロフィール・1on1シートを編集」から、扱うジャンル・事業内容・求める紹介を入れてください(5分ほどです)。",
      App.siteUrl("../profile/"),
    ].join("\n");
    el.append(App.section(`検索での表示(この月 ・ 検索 ${s.total} 回)`,
      h("p", { class: "app-field-hint" }, "メンバーが「探す」で紹介診断・相談アシスタント・ジャンルで探したとき、結果に出た回数です。合う人が多いときは、3位から下を一致度の近い人の中から日替わりで出し、同じ人ばかりが出ないようにしています。"),
      h("div", { class: "dash-table-wrap" }, h("table", { class: "dash-table" },
        h("thead", null, h("tr", null, ["名前", "結果に出た", "1位", "ジャンル数"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", null, bySearch.map((m) => h("tr", { class: !m.topicCount ? "is-warn" : "" },
          h("th", { scope: "row" }, m.name),
          h("td", null, String(m.searchShown)), h("td", null, String(m.searchTop)),
          h("td", null, m.topicCount ? String(m.topicCount) : "未登録")))))),
      hidden.length ? h("div", { class: "dash-hidden" },
        h("p", null, h("b", null, `検索に出ていないメンバー(${hidden.length}名)`), ":", hidden.map((m) => `${m.name}${m.topicCount ? "" : "(ジャンル未登録)"}`).join("、")),
        h("div", { class: "app-btn-row" }, App.btn("プロフィール入力のお願い文をコピー", () => App.copyText(profileAsk, "コピーしました。LINE などで送ってください"), "small"))) : null,
      h("details", { class: "dash-misses" },
        h("summary", null, `読み取れなかった相談(最新 ${s.misses.length} 件)`),
        s.misses.length
          ? h("ul", { class: "app-list" }, s.misses.map((x) => h("li", null, h("div", { class: "app-row" },
            h("span", { class: "app-row-main" }, h("b", null, x.text), h("small", null, `${App.fmtTime(x.at)} ・ ${x.byName}`))))))
          : App.empty("ありません。"),
        h("p", { class: "app-field-hint" }, "相談アシスタントが困りごとを読み取れなかった文です。よく出る言い方は、言葉の辞書(referral/data.js の CONSULT_PHRASES)に足すと次から読み取れます。"))));

    // メンバーから届いたプロフィール(お試し版でそれぞれの端末に入力したもの)を取り込む
    const paste = h("textarea", { rows: "4", placeholder: "メンバーから届いた「【BT-EX5 プロフィールの送付】」の文を、そのまま貼り付けてください(何人分でも)" });
    el.append(App.section("プロフィールを取り込む",
      h("p", { class: "app-field-hint" }, "お試し版では、メンバーが自分の端末で入力したプロフィールはその端末にしか保存されていません。本人がプロフィール画面の「運営に送る」で送った文を、ここに貼り付けると取り込めます。"),
      h("div", { class: "app-form" }, paste, App.btn("取り込む", async () => {
        const list = typeof ProfileTransfer !== "undefined" ? ProfileTransfer.decodeAll(paste.value) : [];
        if (!list.length) { App.toast("取り込めるコードが見つかりませんでした"); return; }
        const done = [];
        for (const p of list) {
          if (!App.memberById(p.id)) continue;
          const member = Object.assign({}, p);
          delete member.editedAt;
          const res = await AuthApi.adminSaveReferralMember(AuthSession.getToken(), member);
          if (res.success) done.push(p.name);
        }
        paste.value = "";
        App.toast(done.length ? `${done.join("、")}さんのプロフィールを取り込みました` : "取り込めませんでした(名簿にいない人です)");
      }, "primary"))));

    // 書き出し
    const stamp = App.todayKey().replace(/-/g, "");
    el.append(App.section("データを書き出す(Excel で開ける CSV)",
      h("p", { class: "app-field-hint" }, "紹介した方の連絡先は、紹介した人と受けた人だけのものなので含めません。"),
      h("div", { class: "app-btn-row" }, EXPORTS.map((x) => App.btn(x.label, async () => {
        const r = await App.api("adminExport", { kind: x.kind });
        if (r) App.downloadCsv(`BT-EX5-${x.kind}-${stamp}.csv`, r.rows);
      }, "ghost small")))));
  };
})();
