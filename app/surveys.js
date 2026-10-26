// ============================================
// app/surveys.js — 定例会のアンケートの結果(プレゼンの進行役・管理者)
// survey/ のページで答えてもらった回答を、BT-EX メンバー向け・ビジター向けに分けて
// 一覧・集計(可能性の5段階・良かったプログラム・ユニット・入会への興味)・改善点のまとめ・改善のヒント・CSV で見る
// ============================================
(function () {
  "use strict";
  const h = App.h;
  const POINT = [5, 4, 3, 2, 1]; // とても感じた=5 … 感じなかった=1

  // 横棒(数の多い順。いちばん多いものを100%として長さを決める)
  function bars(rows, total) {
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return h("ul", { class: "sv-bars" }, rows.map(([label, n]) => h("li", null,
      h("span", { class: "sv-bar-label" }, label),
      h("span", { class: "sv-bar-track" }, h("i", { style: `width:${(n / max) * 100}%` })),
      h("b", { class: "sv-bar-num" }, `${n}件${total ? `(${Math.round((n / total) * 100)}%)` : ""}`))));
  }
  const countBy = (list, fn) => { const m = new Map(); list.forEach((x) => { const k = fn(x); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const fmtAt = (ms) => { const d = new Date(ms + 9 * 3600000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };

  function csv(items, kind, scores) {
    const head = kind === "member"
      ? ["回答日時", "定例会参加日", "姓", "名", "メールアドレス", "所属ユニット", "B.T.内系列名", "職業", "アップクリエ氏名", "可能性を感じたか", "特に良かったプログラム", "自ユニットに取り入れたいこと", "理由", "感想・質問・提案"]
      : ["回答日時", "定例会参加日", "姓", "名", "メールアドレス", "会社名・職業", "招待者", "LINK会員", "可能性を感じたか", "特に良かったプログラム", "入会への興味", "理由", "感想・質問・提案"];
    const row = (x) => (kind === "member"
      ? [fmtAt(x.at), x.date, x.last, x.first, x.email, x.unit, x.lineage, x.job, x.upcre, scores[x.score], x.program, x.adopt, x.reason, x.comment]
      : [fmtAt(x.at), x.date, x.last, x.first, x.email, x.job, x.inviter, x.link === "yes" ? "はい" : x.link === "no" ? "いいえ" : "", scores[x.score], x.program, x.interest, x.reason, x.comment]);
    const esc = (v) => `"${String(v === undefined || v === null ? "" : v).replace(/"/g, '""')}"`;
    const text = [head, ...items.map(row)].map((r) => r.map(esc).join(",")).join("\r\n");
    const a = h("a", { href: URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" })), download: `survey-${kind}-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
  }

  // ---------- 改善点のまとめ(自動) ----------
  // 回答の数字(可能性の5段階・良かったプログラム・入会への興味・回ごとの変化)と、
  // 理由・感想の文に出てくる言葉(テーマごと)から、強み・改善点・要望をまとめる
  const THEMES = [
    ["時間・進行", ["時間", "長", "短", "押し", "延長", "進行", "テンポ", "スムーズ", "間延び"]],
    ["商談・ブレイクアウト", ["商談", "ブレイクアウト", "テーブル", "1on1", "ワンオン"]],
    ["プレゼン・自己紹介", ["プレゼン", "自己紹介", "発表", "1分", "30秒"]],
    ["説明の分かりやすさ", ["説明", "分かり", "わかり", "難し", "理解", "用語"]],
    ["音声・画面(オンライン)", ["音", "聞こえ", "声", "接続", "回線", "画面", "Meet", "カメラ", "マイク"]],
    ["雰囲気・交流", ["雰囲気", "交流", "つながり", "繋が", "楽し", "温か", "仲間", "居心地"]],
    ["紹介・ビジネス", ["紹介", "ビジネス", "仕事", "売上", "集客", "案件"]],
    ["学び・エデュケーション", ["学び", "勉強", "エデュケーション", "USP", "気づき", "参考"]],
  ];
  // 要望・提案の言い方(この言葉がある文を「要望」として拾う)
  const ASK = /(ほしい|欲しい|もっと|改善|したほうが|した方が|してほしい|あれば|あると|希望|要望|できれば|足りな|わかりにく|分かりにく|聞こえな|長かった|短かった|難しかった)/;
  const sentences = (t) => String(t || "").split(/(?<=[。!?！？\n])/).map((x) => x.trim()).filter(Boolean);
  // 定例会の流れ(良かったプログラムの選択肢と同じ形)
  const PROGRAMS = String(typeof REF_SEED_AGENDA !== "undefined" ? REF_SEED_AGENDA : "").split("\n")
    .map((x) => x.trim()).filter((x) => /^[①-⑳]/.test(x))
    .map((x) => x.slice(1).replace(/\s*[（(]?\s*\d+\s*分(?:\s*[×xX✕]\s*\d+\s*回?)?\s*[)）]?\s*$/, "").trim());

  function summarize(list, all, kind, scores) {
    const n = list.length;
    const pct = (a) => `${Math.round((a / Math.max(1, n)) * 100)}%`;
    const avg = (xs) => (xs.length ? xs.reduce((t, x) => t + POINT[x.score], 0) / xs.length : 0);
    const a = avg(list);
    const good = list.filter((x) => x.score <= 1).length;
    const strengths = [], issues = [];
    // 満足度
    const level = a >= 4.2 ? "とても高い" : a >= 3.6 ? "高い" : a >= 3 ? "ふつう" : "低め";
    (a >= 3.6 ? strengths : issues).push(`「ビジネスを加速させる可能性」の平均は ${a.toFixed(1)} / 5(${level})。「感じた」以上が ${pct(good)}。`);
    // プログラム
    const progs = countBy(list, (x) => String(x.program || "").replace(/^その他: ?/, "その他"));
    if (progs.length) strengths.push(`いちばん評価されたプログラムは「${progs[0][0]}」(${progs[0][1]}件・${pct(progs[0][1])})。`);
    const chosen = new Set(progs.map((p) => p[0]));
    const never = PROGRAMS.filter((p) => !chosen.has(p));
    if (n >= 3 && never.length) issues.push(`一度も「良かった」に選ばれていないプログラム: ${never.join("・")}。内容や時間の見直し候補です。`);
    // 低い評価
    const low = list.filter((x) => x.score >= 2);
    if (low.length) issues.push(`「どちらともいえない」以下が ${low.length}件(${pct(low.length)})。理由は下の「改善のヒント」にあります。`);
    // ビジターの入会への興味
    if (kind === "visitor") {
      const warm = list.filter((x) => x.interest === "ぜひ入会したい" || x.interest === "詳しく話を聞きたい").length;
      (warm / Math.max(1, n) >= 0.5 ? strengths : issues).push(`入会に前向き(ぜひ入会したい+詳しく話を聞きたい)は ${warm}件(${pct(warm)})。前向きな方には早めにフォローを。`);
      const notNow = list.filter((x) => x.interest === "今は考えていない").length;
      if (notNow) issues.push(`「今は考えていない」が ${notNow}件。理由を読み、入会の価値の伝え方を見直しましょう。`);
    }
    // 回ごとの変化(同じ種類の回答で、いちばん新しい回と1つ前の回をくらべる)
    const ofKind = all.filter((x) => x.kind === kind);
    const dates = [...new Set(ofKind.map((x) => x.date))].sort();
    if (dates.length >= 2) {
      const [p, q] = dates.slice(-2);
      const ap = avg(ofKind.filter((x) => x.date === p)), aq = avg(ofKind.filter((x) => x.date === q));
      const diff = aq - ap;
      (diff >= 0 ? strengths : issues).push(`前回(${p})${ap.toFixed(1)} → 今回(${q})${aq.toFixed(1)}。${diff > 0.05 ? "上がっています" : diff < -0.05 ? "下がっています" : "ほぼ同じです"}。`);
    }
    // 声のテーマ(理由・感想・取り入れたいことの文から)
    const themes = THEMES.map(([label, words]) => {
      const hits = list.filter((x) => words.some((w) => `${x.reason} ${x.comment} ${x.adopt || ""}`.includes(w)));
      return { label, n: hits.length, low: hits.filter((x) => x.score >= 2).length, asks: hits.flatMap((x) => sentences(`${x.reason}\n${x.comment}`).filter((s) => ASK.test(s) && words.some((w) => s.includes(w)))) };
    }).filter((t) => t.n).sort((x, y) => y.n - x.n);
    themes.filter((t) => t.low > 0).slice(0, 3).forEach((t) => issues.push(`「${t.label}」について、評価の低い回答で ${t.low}件ふれられています。`));
    // 要望・提案の文
    const asks = [...new Set(list.flatMap((x) => sentences(`${x.reason}\n${x.comment}`).filter((s) => ASK.test(s))))].slice(0, 12);
    const text = [
      `定例会アンケートのまとめ(${kind === "member" ? "BT-EX メンバー" : "ビジター"}・${n}件)`,
      "", "■ 良かった点", ...strengths.map((s) => `・${s}`),
      "", "■ 改善点", ...(issues.length ? issues.map((s) => `・${s}`) : ["・いまのところ大きな改善点はありません。"]),
      themes.length ? "" : null, themes.length ? "■ 声の多いテーマ" : null, ...themes.map((t) => `・${t.label}: ${t.n}件(うち評価の低い回答 ${t.low}件)`),
      asks.length ? "" : null, asks.length ? "■ 要望・提案" : null, ...asks.map((s) => `・${s}`),
    ].filter((x) => x !== null).join("\n");
    const sec = h("section", { class: "sv-res-sec is-summary" },
      h("div", { class: "sv-sum-head" }, h("h3", null, "改善点のまとめ(自動)"),
        h("div", { class: "app-btn-row" }, App.btn("まとめをコピー", () => App.copyText(text, "まとめをコピーしました"), "ghost small"),
          App.btn("保存(.txt)", () => {
            const a2 = h("a", { href: URL.createObjectURL(new Blob([text], { type: "text/plain" })), download: `survey-summary-${kind}-${new Date().toISOString().slice(0, 10)}.txt` });
            document.body.append(a2); a2.click(); a2.remove();
          }, "ghost small"))),
      h("div", { class: "sv-sum-cols" },
        h("div", { class: "sv-sum-col is-good" }, h("h4", null, "良かった点"), h("ul", null, strengths.map((s) => h("li", null, s)))),
        h("div", { class: "sv-sum-col is-issue" }, h("h4", null, "改善点"), h("ul", null, (issues.length ? issues : ["いまのところ大きな改善点はありません。"]).map((s) => h("li", null, s))))),
      themes.length ? h("div", { class: "sv-sum-themes" }, h("h4", null, "声の多いテーマ(理由・感想の言葉から)"),
        h("table", { class: "sv-sum-table" }, h("thead", null, h("tr", null, h("th", null, "テーマ"), h("th", null, "件数"), h("th", null, "うち評価の低い回答"))),
          h("tbody", null, themes.map((t) => h("tr", { class: t.low ? "is-low" : "" }, h("td", null, t.label), h("td", null, `${t.n}件`), h("td", null, `${t.low}件`)))))) : null,
      asks.length ? h("div", { class: "sv-sum-asks" }, h("h4", null, "要望・提案(文から拾ったもの)"), h("ul", { class: "sv-res-quotes" }, asks.map((s) => h("li", null, s)))) : null);
    return sec;
  }

  // ---------- やわらかいデザインの見出し(筆記体の英語 + 日本語 + 細い線)。セクションごとに背景を交互に ----------
  const band = (script, jp, ...children) => h("section", { class: "svx-band" },
    h("header", { class: "svx-head" }, h("p", { class: "svx-script", "aria-hidden": "true" }, script), h("h3", null, jp), h("i", { class: "svx-rule", "aria-hidden": "true" })),
    h("div", { class: "svx-body" }, ...children));
  // 筆記体の英語の見出しの字(この画面を開いたときだけ読みこむ)
  let fontLoaded = false;
  const loadScriptFont = () => {
    if (fontLoaded) return;
    fontLoaded = true;
    document.head.append(h("link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" }));
  };

  // ---------- ダッシュボード(記録の「分析」と同じ見た目): 数字のカード・回ごとの推移・内訳 ----------
  const SCORE_COLORS = ["#16865a", "#58b88a", "#c9b28a", "#e0861a", "#c2462a"];
  const INTEREST_COLORS = { "ぜひ入会したい": "#16865a", "詳しく話を聞きたい": "#2c5fb2", "今は考えていない": "#bdb2a6" };
  const md = (key) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
  function dashboard(list, ofKind, date, kind, scores) {
    const C = App.charts || {};
    const n = list.length;
    const avgOf = (xs) => (xs.length ? xs.reduce((t, x) => t + POINT[x.score], 0) / xs.length : 0);
    const pctOf = (xs, fn) => (xs.length ? Math.round((xs.filter(fn).length / xs.length) * 100) : 0);
    const warm = (x) => x.interest === "ぜひ入会したい" || x.interest === "詳しく話を聞きたい";
    // くらべる相手: 回を選んでいればその1つ前の回、「すべての回」ならいちばん新しい回とその前の回
    const dates = [...new Set(ofKind.map((x) => x.date))].sort();
    const curDate = date || dates[dates.length - 1];
    const prevDate = dates[dates.indexOf(curDate) - 1];
    const cur = ofKind.filter((x) => x.date === curDate), prev = prevDate ? ofKind.filter((x) => x.date === prevDate) : null;
    const vs = prevDate ? `前回(${md(prevDate)})比` : "";
    const delta = (now, before, unit, digits) => {
      if (!prev) return h("p", { class: "sd-delta is-flat" }, h("span", null, "—"), h("small", null, "くらべる前回がありません"));
      const d = now - before;
      const cls = d > 0.0001 ? "is-up" : d < -0.0001 ? "is-down" : "is-flat";
      const v = digits ? Math.abs(d).toFixed(digits) : String(Math.abs(Math.round(d)));
      return h("p", { class: `sd-delta ${cls}` }, h("span", null, d > 0.0001 ? `↑ +${v}${unit}` : d < -0.0001 ? `↓ −${v}${unit}` : "±0"), h("small", null, `${date ? "" : `今回(${md(curDate)})・`}${vs}`));
    };
    const kpi = (icon, tone, label, value, dl, sub) => h("div", { class: "sd-kpi" },
      h("div", { class: "sd-kpi-head" }, h("span", { class: `sd-kpi-ic tone-${tone}` }, App.glyph(icon)), h("span", null, label)),
      h("b", { class: "sd-kpi-val" }, value), dl, h("small", { class: "sd-kpi-sub" }, sub || ""));
    const kpis = h("div", { class: "sd-kpis" },
      kpi("comment", "gold", "回答数", `${n}件`, delta(cur.length, prev ? prev.length : 0, "件"), date ? `${md(date)} の回` : `${dates.length}回分の合計`),
      kpi("won", "green", "可能性の平均", `${avgOf(list).toFixed(1)} / 5`, delta(avgOf(cur), prev ? avgOf(prev) : 0, "", 1), "とても感じた=5 〜 感じなかった=1"),
      kpi("thanks", "blue", "「感じた」以上", `${pctOf(list, (x) => x.score <= 1)}%`, delta(pctOf(cur, (x) => x.score <= 1), prev ? pctOf(prev, (x) => x.score <= 1) : 0, "pt"), "とても感じた+感じた"),
      kind === "visitor"
        ? kpi("visitor", "teal", "入会に前向き", `${pctOf(list, warm)}%`, delta(pctOf(cur, warm), prev ? pctOf(prev, warm) : 0, "pt"), "ぜひ入会したい+詳しく話を聞きたい")
        : kpi("one", "violet", "所属ユニットの数", `${new Set(list.map((x) => x.unit).filter(Boolean)).size}`, delta(new Set(cur.map((x) => x.unit)).size, prev ? new Set(prev.map((x) => x.unit)).size : 0, ""), "回答してくれたユニット"));
    // 回ごとの推移(折れ線): 可能性の平均・回答数
    const TREND = [["avg", "可能性の平均", (v) => `${v.toFixed(1)} / 5`], ["count", "回答数", (v) => `${v}件`], ["good", "「感じた」以上", (v) => `${v}%`]];
    let tk = "avg";
    const tBody = h("div");
    const tabs = h("div", { class: "sd-tabs", role: "tablist", "aria-label": "推移の項目" });
    const drawTrend = () => {
      [...tabs.children].forEach((b) => { const on = b.dataset.k === tk; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); });
      const [, label, fmt] = TREND.find((t) => t[0] === tk);
      const pts = dates.slice(-8).map((dk) => {
        const xs = ofKind.filter((x) => x.date === dk);
        const v = tk === "avg" ? Math.round(avgOf(xs) * 10) / 10 : tk === "count" ? xs.length : pctOf(xs, (x) => x.score <= 1);
        return { label: md(dk), title: `${md(dk)} の${label}`, value: v };
      });
      if (pts.length < 2 || !C.lineChart) { App.fill(tBody, h("p", { class: "sd-empty" }, "2回分以上の回答がたまると、回ごとの推移が出ます。")); return; }
      App.fill(tBody, C.lineChart(pts, fmt, true));
    };
    TREND.forEach(([k, label]) => tabs.append(h("button", { type: "button", role: "tab", "data-k": k, onclick: () => { tk = k; drawTrend(); } }, label)));
    drawTrend();
    const trendCard = h("section", { class: "sd-card" }, h("div", { class: "sd-card-head" }, h("h3", null, "回ごとの推移"), tabs), tBody);
    const scoreCard = h("section", { class: "sd-card" }, h("div", { class: "sd-card-head" }, h("h3", null, "可能性を感じたか(5段階)")),
      C.donut ? C.donut(scores.map((label, i) => ({ label, value: list.filter((x) => x.score === i).length, color: SCORE_COLORS[i] })), "回答", "件") : bars(scores.map((label, i) => [label, list.filter((x) => x.score === i).length]), n));
    const progCard = h("section", { class: "sd-card" }, h("div", { class: "sd-card-head" }, h("h3", null, "特に良かったプログラム TOP")), bars(countBy(list, (x) => x.program).slice(0, 8), n));
    const sideCard = kind === "visitor"
      ? h("section", { class: "sd-card" }, h("div", { class: "sd-card-head" }, h("h3", null, "入会への興味")),
        C.donut ? C.donut(Object.keys(INTEREST_COLORS).map((k) => ({ label: k, value: list.filter((x) => x.interest === k).length, color: INTEREST_COLORS[k] })), "回答", "件") : bars(countBy(list, (x) => x.interest), n))
      : h("section", { class: "sd-card" }, h("div", { class: "sd-card-head" }, h("h3", null, "所属ユニット")), bars(countBy(list, (x) => x.unit), n));
    return [
      band("Summary", "数字で見る", h("div", { class: "sv-dash" }, kpis)),
      band("Trend", "回ごとの推移と内訳", h("div", { class: "sv-dash" }, h("div", { class: "sd-row" }, trendCard, scoreCard))),
      band("Ranking", kind === "visitor" ? "良かったプログラムと入会への興味" : "良かったプログラムと所属ユニット", h("div", { class: "sv-dash" }, h("div", { class: "sd-row is-half" }, progCard, sideCard))),
    ];
  }

  App.surveyResults = async function () {
    const d = await App.api("listSurveys", {});
    if (!d) return;
    const scores = d.scores || [];
    let all = d.items || [];
    let kind = "member", date = "";
    App.openSheet("アンケートの結果", (body) => {
      const box = h("div", { class: "sv-res" });
      function draw() {
        const ofKind = all.filter((x) => x.kind === kind);
        const dates = [...new Set(ofKind.map((x) => x.date))].sort().reverse();
        if (date && !dates.includes(date)) date = "";
        const list = ofKind.filter((x) => !date || x.date === date);
        const n = list.length;
        const avg = n ? list.reduce((t, x) => t + POINT[x.score], 0) / n : 0;
        const good = list.filter((x) => x.score <= 1).length;
        const dateSel = h("select", { class: "sv-res-date", "aria-label": "定例会の日", onchange: () => { date = dateSel.value; draw(); } },
          h("option", { value: "" }, `すべての回(${ofKind.length}件)`), dates.map((v) => h("option", { value: v }, `${v}(${ofKind.filter((x) => x.date === v).length}件)`)));
        dateSel.value = date;
        // 改善のヒント: 「どちらともいえない」以下の回答の理由と、感想・提案
        const low = list.filter((x) => x.score >= 2);
        App.fill(box,
          h("div", { class: "sv-dash-head svx-controls" },
            App.segmented([{ id: "member", label: "BT-EX メンバー", badge: all.filter((x) => x.kind === "member").length }, { id: "visitor", label: "ビジター", badge: all.filter((x) => x.kind === "visitor").length }], kind, (k) => { kind = k; date = ""; draw(); }),
            h("div", { class: "sv-res-tools" }, dateSel, n ? App.btn("CSV で保存", () => csv(list, kind, scores), "ghost small") : null)),
          ...(n ? dashboard(list, ofKind, date, kind, scores) : []),
          n ? band("Voice", "改善点のまとめ", summarize(list, all, kind, scores)) : null,
          n && kind === "member" && list.some((x) => x.adopt) ? band("Idea", "自ユニットに取り入れたいこと", h("section", { class: "sv-res-sec" },
            h("ul", { class: "sv-res-quotes" }, list.filter((x) => x.adopt).map((x) => h("li", null, x.adopt, h("small", null, `${x.unit} ${x.last}さん`)))))) : null,
          n ? band("Hint", "改善のヒント(「どちらともいえない」以下の回答)", h("section", { class: "sv-res-sec is-improve" },
            low.length ? h("ul", { class: "sv-res-quotes" }, low.map((x) => h("li", null, h("b", null, scores[x.score]), ` ${x.reason}`, x.comment ? h("span", null, ` / ${x.comment}`) : null, h("small", null, `${x.date} ${x.last}さん`))))
              : h("p", { class: "app-field-hint" }, "いまのところ、低い評価の回答はありません。"))) : null,
          band("Answers", `回答の一覧(${n}件)`, h("section", { class: "sv-res-sec" },
            n ? h("ul", { class: "sv-res-list" }, list.map((x) => h("li", null,
              h("details", { dataset: { id: x.id } },
                h("summary", null, h("b", null, `${x.last} ${x.first}`), h("span", null, kind === "member" ? x.unit : x.job), h("em", null, scores[x.score]), h("small", null, x.date)),
                h("dl", null,
                  ...(kind === "member"
                    ? [["メール", x.email], ["系列", x.lineage], ["職業", x.job], ["アップクリエ", x.upcre]]
                    : [["メール", x.email], ["招待者", x.inviter], ["LINK会員", x.link === "yes" ? "はい" : x.link === "no" ? "いいえ" : "—"], ["入会への興味", x.interest]]).concat([["良かったプログラム", x.program], ["理由", x.reason], ["感想・質問・提案", x.comment]], kind === "member" && x.adopt ? [["取り入れたいこと", x.adopt]] : [])
                    .flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v || "—")])),
                App.btn("この回答を消す", async () => {
                  if (!(await App.confirm(`${x.last} ${x.first}さんの回答を消しますか?`, { ok: "消す", danger: true }))) return;
                  if (await App.api("adminDeleteSurvey", { id: x.id })) { all = all.filter((y) => y.id !== x.id); draw(); App.toast("回答を消しました"); }
                }, "ghost small"))))) : App.empty("まだ回答がありません。定例会の終わりの「定例会のアンケート」の\nスライドの QR コードから答えてもらえます。"))));
      }
      draw();
      // 開いているあいだは、新しい回答が届いたらすぐに出す(5秒ごとに確かめる。変わったときだけ描き直す)
      const sig = (items) => `${items.length}|${items.reduce((m, x) => Math.max(m, x.updatedAt || x.at || 0), 0)}`;
      const live = h("p", { class: "sv-res-live" }, h("i", { "aria-hidden": "true" }), h("span", null, "回答が届くと自動で更新します"));
      let last = sig(all), busy = false;
      const timer = setInterval(async () => {
        if (!box.isConnected) { clearInterval(timer); return; }
        if (busy || document.hidden) return;
        busy = true;
        const r = await App.api("listSurveys", {}, { quiet: true });
        busy = false;
        if (!r || !box.isConnected) return;
        const items = r.items || [];
        const now = sig(items);
        if (now === last) return;
        const added = items.length - all.length;
        last = now; all = items;
        // 開いていた回答の詳しい中身は、描き直したあとも開いたままにする
        const open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.id));
        draw();
        box.querySelectorAll("details").forEach((d) => { if (open.has(d.dataset.id)) d.open = true; });
        if (added > 0) App.toast(`新しい回答が${added}件届きました`);
      }, 5000);
      // 共有サーバーにつながっていない間は、回答は答えた人のスマホの中にしか残らない(ここには届かない)
      const notShared = typeof AuthApi !== "undefined" && !AuthApi.isShared();
      loadScriptFont();
      body.classList.add("svx");
      body.append(h("header", { class: "svx-hero" },
        h("p", { class: "svx-script is-big", "aria-hidden": "true" }, "Survey"),
        h("h2", null, "アンケートの結果"),
        h("p", { class: "app-lead sv-res-lead" }, "定例会の終わりに QR コードから答えてもらったアンケートです。\nBT-EX メンバーとビジターで分けて集計します。"), live),
        notShared ? h("p", { class: "sv-res-warn tone-warn" }, "いまは共有サーバーにつながっていないため、ほかの方のスマホで答えたアンケートはここに届きません(この端末で答えたものだけが出ます)。共有サーバー(Google Apps Script)の URL を設定すると、全員の回答がここに集まります。") : null, box);
    }, { full: true, noFocus: true });
  };
})();
