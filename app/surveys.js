// ============================================
// app/surveys.js — 定例会のアンケートの結果(プレゼンの進行役・管理者)
// survey/ のページで答えてもらった回答を、BT-EX メンバー向け・ビジター向けに分けて
// 一覧・集計(可能性の5段階・良かったプログラム・ユニット・入会への興味)・改善のヒント・CSV で見る
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
          App.segmented([{ id: "member", label: "BT-EX メンバー", badge: all.filter((x) => x.kind === "member").length }, { id: "visitor", label: "ビジター", badge: all.filter((x) => x.kind === "visitor").length }], kind, (k) => { kind = k; date = ""; draw(); }),
          h("div", { class: "sv-res-tools" }, dateSel, n ? App.btn("CSV で保存", () => csv(list, kind, scores), "ghost small") : null),
          n ? h("div", { class: "home-stats sv-res-kpis" },
            App.kpi("回答", `${n}件`),
            App.kpi("可能性の平均", `${avg.toFixed(1)} / 5`, "とても感じた=5 〜 感じなかった=1"),
            App.kpi("「感じた」以上", `${Math.round((good / n) * 100)}%`),
            kind === "visitor" ? App.kpi("入会に前向き", `${Math.round((list.filter((x) => x.interest === "ぜひ入会したい" || x.interest === "詳しく話を聞きたい").length / n) * 100)}%`, "ぜひ入会したい+詳しく話を聞きたい") : null) : null,
          n ? h("section", { class: "sv-res-sec" }, h("h3", null, "ビジネスを加速させる可能性を感じたか"), bars(scores.map((label, i) => [label, list.filter((x) => x.score === i).length]), n)) : null,
          n ? h("section", { class: "sv-res-sec" }, h("h3", null, "特に良かったプログラム"), bars(countBy(list, (x) => x.program), n)) : null,
          n && kind === "member" ? h("section", { class: "sv-res-sec" }, h("h3", null, "所属ユニット"), bars(countBy(list, (x) => x.unit), n)) : null,
          n && kind === "visitor" ? h("section", { class: "sv-res-sec" }, h("h3", null, "入会への興味"), bars(countBy(list, (x) => x.interest), n)) : null,
          n && kind === "member" && list.some((x) => x.adopt) ? h("section", { class: "sv-res-sec" }, h("h3", null, "自ユニットに取り入れたいこと"),
            h("ul", { class: "sv-res-quotes" }, list.filter((x) => x.adopt).map((x) => h("li", null, x.adopt, h("small", null, `${x.unit} ${x.last}さん`))))) : null,
          n ? h("section", { class: "sv-res-sec is-improve" }, h("h3", null, "改善のヒント(「どちらともいえない」以下の回答)"),
            low.length ? h("ul", { class: "sv-res-quotes" }, low.map((x) => h("li", null, h("b", null, scores[x.score]), ` ${x.reason}`, x.comment ? h("span", null, ` / ${x.comment}`) : null, h("small", null, `${x.date} ${x.last}さん`))))
              : h("p", { class: "app-field-hint" }, "いまのところ、低い評価の回答はありません。")) : null,
          h("section", { class: "sv-res-sec" }, h("h3", null, `回答の一覧(${n}件)`),
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
                }, "ghost small"))))) : App.empty("まだ回答がありません。定例会の終わりの「定例会のアンケート」の\nスライドの QR コードから答えてもらえます。")));
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
      body.append(h("p", { class: "app-lead sv-res-lead" }, "定例会の終わりに QR コードから答えてもらったアンケートです。\nBT-EX メンバーとビジターで分けて集計します。"), live,
        notShared ? h("p", { class: "sv-res-warn tone-warn" }, "いまは共有サーバーにつながっていないため、ほかの方のスマホで答えたアンケートはここに届きません(この端末で答えたものだけが出ます)。共有サーバー(Google Apps Script)の URL を設定すると、全員の回答がここに集まります。") : null, box);
    });
  };
})();
