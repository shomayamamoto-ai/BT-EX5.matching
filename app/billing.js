// ============================================
// app/billing.js — 会費と領収書(ひな形。いまは 0円)
// ・会員(#me/billing): 会費のプラン、今の期間の状態、これまでの明細。明細書・領収書を印刷・PDF 保存できる
// ・管理者(管理者メニュー →「会費」): プラン・発行者(インボイスの登録番号)・決済のページの URL、
//   期間ごとの全員の状態(支払い済み・未払い・免除)、合計、CSV
// 金額と決済のページの URL を入れるだけで有料にできる(決済そのものは Stripe の Payment Links などの外部サービス)
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const STATUS = {
    free: { label: "無料", tone: "good" },
    unpaid: { label: "未払い", tone: "warn" },
    paid: { label: "支払い済み", tone: "good" },
    exempt: { label: "免除", tone: "mute" },
  };
  const CYCLE = { monthly: "月額", yearly: "年額" };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const day = (ms) => { const d = new Date(ms); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; };

  // ---------- 明細書・領収書(印刷・PDF 保存用の別の画面) ----------
  // 支払い済みは「領収書」、0円・未払いは「ご利用明細書」。インボイスの記載事項(登録番号・税率ごとの金額と税額)を入れる
  function openDocument(x, b) {
    const paid = x.status === "paid";
    const title = paid ? "領収書" : x.status === "unpaid" ? "ご請求書" : "ご利用明細書";
    const rate = b.plan.taxRate || 10;
    const no = paid ? x.receiptNo : x.id.toUpperCase();
    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} ${esc(x.periodLabel)} ${esc(x.name)}</title>
<style>
  body{margin:0;background:#f3efe7;font-family:"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif;color:#1f1813}
  .doc{max-width:720px;margin:24px auto;padding:48px 52px;background:#fff;border:1px solid #e0d2b8;box-shadow:0 10px 30px rgba(0,0,0,.06)}
  h1{margin:0 0 6px;text-align:center;font-size:30px;letter-spacing:.6em;padding-left:.6em}
  .no{text-align:right;font-size:13px;color:#555}
  .to{margin:28px 0 6px;font-size:20px;border-bottom:1px solid #1f1813;display:inline-block;padding:0 40px 4px 0}
  .amount{margin:22px 0;padding:16px 20px;border:2px solid #1f1813;display:flex;justify-content:space-between;align-items:baseline;font-size:15px}
  .amount b{font-size:30px;letter-spacing:.04em}
  table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
  th,td{border:1px solid #cdbf9f;padding:8px 10px;text-align:left}
  th{background:#f6f0e3;width:34%}
  td.num{text-align:right}
  .issuer{margin-top:30px;text-align:right;font-size:14px;line-height:1.8}
  .issuer b{font-size:16px}
  .note{margin-top:18px;font-size:12px;color:#555}
  .bar{max-width:720px;margin:16px auto 0;text-align:right}
  .bar button{padding:10px 18px;border-radius:999px;border:none;background:#1a120c;color:#f6e7c4;font:700 14px sans-serif;cursor:pointer}
  @media print{body{background:#fff}.doc{box-shadow:none;border:none;margin:0;padding:24px}.bar{display:none}}
</style></head><body>
<div class="bar"><button onclick="print()">印刷・PDF で保存</button></div>
<div class="doc">
  <h1>${esc(title)}</h1>
  <p class="no">No. ${esc(no)}<br>発行日 ${esc(day(paid && x.paidAt ? x.paidAt : x.issuedAt))}</p>
  <p class="to">${esc(x.name)} 様</p>
  <div class="amount"><span>${paid ? "金額(税込)" : "ご利用金額(税込)"}</span><b>¥${Number(x.amount).toLocaleString("ja-JP")}-</b></div>
  ${paid ? "<p>上記の金額を正に領収いたしました。</p>" : x.amount > 0 ? "<p>下記のとおりご請求申し上げます。</p>" : "<p>下記のとおり、無料でご利用いただいております。</p>"}
  <table>
    <tr><th>但し書き</th><td>${esc(b.plan.name)} 会費(${esc(x.periodLabel)})</td></tr>
    <tr><th>${rate}%対象(税込)</th><td class="num">¥${Number(x.amount).toLocaleString("ja-JP")}</td></tr>
    <tr><th>うち消費税(${rate}%)</th><td class="num">¥${Number(x.tax).toLocaleString("ja-JP")}</td></tr>
    ${paid ? `<tr><th>お支払い日</th><td>${esc(day(x.paidAt))}</td></tr><tr><th>お支払い方法</th><td>${esc(x.method || "—")}</td></tr>` : ""}
  </table>
  <div class="issuer">
    <b>${esc(b.issuer.name)}</b><br>
    ${b.issuer.regNo ? `登録番号 ${esc(b.issuer.regNo)}<br>` : ""}
    ${b.issuer.address ? `${esc(b.issuer.address)}<br>` : ""}
    ${b.issuer.contact ? `${esc(b.issuer.contact)}` : ""}
  </div>
  ${b.issuer.regNo ? "" : '<p class="note">※ 発行者は適格請求書発行事業者の登録番号を記載していません。</p>'}
</div></body></html>`;
    const win = window.open("", "_blank");
    if (!win) { App.toast("新しい画面を開けませんでした。ポップアップを許可してください", "error"); return; }
    win.document.open(); win.document.write(html); win.document.close();
  }

  // ---------- 会員: 会費・領収書 ----------
  App.billingSheet = function () {
    App.openSheet("会費・領収書", async (body) => {
      body.append(h("p", { class: "app-loading" }, "読み込み中…"));
      const d = await App.api("getMyBilling");
      if (!d) return;
      const cur = d.current;
      const st = STATUS[cur.status] || STATUS.free;
      const free = Number(d.plan.amount) === 0;
      App.fill(body,
        h("section", { class: "bill-plan" },
          h("p", { class: "bill-plan-name" }, d.plan.name),
          h("p", { class: "bill-plan-price" }, h("small", null, CYCLE[d.plan.cycle] || "月額"), h("b", null, `¥${Number(d.plan.amount).toLocaleString("ja-JP")}`), h("small", null, "(税込)")),
          h("p", { class: "bill-plan-note" }, free ? "いまは無料でご利用いただけます。" : `${cur.periodLabel}:`, free ? null : App.chip(st.label, st.tone))),
        !free && cur.status === "unpaid"
          ? (d.payUrl
            ? h("a", { class: "app-btn primary wide", href: d.payUrl, target: "_blank", rel: "noopener" }, `${cur.periodLabel}の会費を支払う`)
            : h("p", { class: "app-field-hint" }, "お支払い方法は、運営からご案内します。"))
          : null,
        d.note ? h("p", { class: "app-field-hint" }, d.note) : null,
        App.section("明細", h("ul", { class: "app-list" }, d.items.map((x) => {
          const s = STATUS[x.status] || STATUS.free;
          return h("li", null, h("div", { class: "app-row bill-row" },
            h("span", { class: "app-row-main" }, h("b", null, x.periodLabel), h("small", null, `¥${Number(x.amount).toLocaleString("ja-JP")}${x.receiptNo ? ` ・ ${x.receiptNo}` : ""}`)),
            App.chip(s.label, s.tone),
            App.btn(x.status === "paid" ? "領収書" : "明細書", () => openDocument(x, d), "ghost small")));
        }))),
        h("p", { class: "app-field-hint" }, "明細書・領収書は、開いた画面の「印刷・PDF で保存」から保存できます。"));
    }, { noFocus: true, onClose: () => { if (location.hash === "#me/billing") history.replaceState(null, "", "#me"); } });
  };

  // ---------- 管理者: 会費 ----------
  App.renderBillingAdmin = async function (el, periodArg) {
    const d = await App.api("adminBilling", { period: periodArg || "" });
    if (!d) return;
    const f = {
      name: h("input", { type: "text", maxlength: "60", value: d.plan.name }),
      amount: h("input", { type: "text", inputmode: "numeric", value: String(d.plan.amount) }),
      cycle: h("select", null, h("option", { value: "monthly" }, "月額"), h("option", { value: "yearly" }, "年額")),
      taxRate: h("select", null, h("option", { value: "10" }, "10%"), h("option", { value: "8" }, "8%")),
      issuer: h("input", { type: "text", maxlength: "80", value: d.issuer.name }),
      regNo: h("input", { type: "text", maxlength: "20", value: d.issuer.regNo, placeholder: "T1234567890123(なければ空)" }),
      address: h("input", { type: "text", maxlength: "160", value: d.issuer.address }),
      contact: h("input", { type: "text", maxlength: "120", value: d.issuer.contact, placeholder: "例:メール・電話" }),
      payUrl: h("input", { type: "url", maxlength: "500", value: d.payUrl, placeholder: "https://buy.stripe.com/…(なければ空)" }),
      note: h("textarea", { rows: "2", maxlength: "300" }),
    };
    f.cycle.value = d.plan.cycle; f.taxRate.value = String(d.plan.taxRate); f.note.value = d.note || "";
    const settings = h("details", { class: "bill-settings" },
      h("summary", null, "会費の設定(プラン・発行者・決済のページ)"),
      h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        const r = await App.api("adminSaveBilling", {
          plan: { name: f.name.value, amount: f.amount.value, cycle: f.cycle.value, taxRate: Number(f.taxRate.value) },
          issuer: { name: f.issuer.value, regNo: f.regNo.value, address: f.address.value, contact: f.contact.value },
          payUrl: f.payUrl.value.trim(), note: f.note.value,
        });
        if (r) { App.toast("会費の設定を保存しました"); App.route(); }
      } },
        App.field("プランの名前", f.name),
        h("div", { class: "bill-grid" }, App.field("会費(円・税込)", f.amount, "0円なら無料。金額を入れると、今の期間の未払いの明細も新しい金額になります"), App.field("払い方", f.cycle), App.field("消費税率", f.taxRate)),
        App.field("発行者(領収書に出る名前)", f.issuer),
        App.field("インボイスの登録番号", f.regNo, "適格請求書発行事業者の登録番号(T+13けた)。登録していなければ空のまま"),
        App.field("住所", f.address), App.field("連絡先", f.contact),
        App.field("決済のページの URL", f.payUrl, "Stripe の Payment Links・Square・PayPay などの支払いページ。入れると、会員の画面に「会費を支払う」ボタンが出ます"),
        App.field("会員へのひとこと", f.note, "例:お支払いは毎月10日までにお願いします"),
        h("button", { type: "submit", class: "app-btn primary" }, "保存")));
    // 期間を切り替える
    const isYear = d.plan.cycle === "yearly";
    const shift = (p, n) => {
      if (isYear) return String(Number(p) + n);
      const dt = new Date(Number(p.slice(0, 4)), Number(p.slice(5, 7)) - 1 + n, 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    };
    const nav = h("div", { class: "bill-nav" },
      App.btn("← 前", () => { el.replaceChildren(); App.renderBillingAdmin(el, shift(d.period, -1)); }, "ghost small"),
      h("b", null, d.periodLabel),
      App.btn("次 →", () => { el.replaceChildren(); App.renderBillingAdmin(el, shift(d.period, 1)); }, "ghost small"));
    const list = h("ul", { class: "app-list" }, d.rows.map((x) => {
      const sel = h("select", { "aria-label": `${x.name}さんの状態` }, Object.entries(STATUS).filter(([k]) => x.amount > 0 ? k !== "free" : true).map(([k, v]) => h("option", { value: k }, v.label)));
      sel.value = x.status;
      const method = h("select", { "aria-label": "支払い方法" }, h("option", { value: "" }, "方法"), d.methods.map((m) => h("option", { value: m }, m)));
      method.value = x.method || "";
      const sub = h("small", null);
      const docBtn = App.btn("", () => openDocument(x, d), "ghost small");
      const drawRow = () => {
        sub.textContent = `¥${Number(x.amount).toLocaleString("ja-JP")}${x.receiptNo ? ` ・ ${x.receiptNo}` : ""}`;
        docBtn.textContent = x.status === "paid" ? "領収書" : "明細";
      };
      const save = async () => {
        const r = await App.api("adminSetInvoice", { id: x.id, status: sel.value, method: method.value });
        if (r) { Object.assign(x, r.item); drawRow(); App.toast(`${x.name}さん:${STATUS[x.status].label}${x.receiptNo ? `(${x.receiptNo})` : ""}`); }
      };
      sel.addEventListener("change", save); method.addEventListener("change", save);
      drawRow();
      return h("li", null, h("div", { class: "app-row bill-row" },
        h("span", { class: "app-row-main" }, h("b", null, x.name), sub),
        h("span", { class: "bill-ctrl" }, sel, method, docBtn)));
    }));
    el.append(
      App.section("会費", h("p", { class: "app-lead" }, Number(d.plan.amount) === 0
        ? `いまは ${d.plan.name}(${CYCLE[d.plan.cycle]} 0円・無料)です。会費を決めたら、下の設定で金額と決済のページを入れるだけで有料にできます。`
        : `${d.plan.name}:${CYCLE[d.plan.cycle]} ¥${Number(d.plan.amount).toLocaleString("ja-JP")}(税込)`), settings),
      App.section(`${d.periodLabel}の状態`, nav,
        h("div", { class: "dash-kpis" },
          h("div", null, h("small", null, "支払い済み"), h("b", null, App.yen(d.totals.paid))),
          h("div", null, h("small", null, "未払い"), h("b", null, App.yen(d.totals.unpaid)), h("small", null, `${d.totals.unpaidCount}名`))),
        list,
        h("div", { class: "app-btn-row" }, App.btn("この期間を CSV で書き出す", () => App.downloadCsv(`BT-EX5-会費-${d.period}`, [
          ["名前", "会社", "期間", "金額", "うち消費税", "状態", "支払い日", "方法", "領収書番号"],
          ...d.rows.map((x) => [x.name, x.company, x.periodLabel, x.amount, x.tax, (STATUS[x.status] || {}).label, x.paidAt || "", x.method, x.receiptNo]),
        ]), "ghost small"))));
  };
})();
