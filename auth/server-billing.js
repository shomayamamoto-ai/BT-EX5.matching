// ============================================
// auth/server-billing.js — 会費と領収書(ひな形)
// いまは会費 0円で動かし、あとから金額・決済リンク(Stripe の Payment Links など)を入れるだけで有料にできる。
//
//   会員       getMyBilling(会費のプランと、自分の明細の一覧。今の期間の明細はこのとき作る)
//   管理者     adminBilling(期間ごとの全員の明細と合計)/ adminSaveBilling(プラン・発行者・決済リンク)/
//              adminSetInvoice(支払い済み・未払い・免除にする。支払い済みにすると領収書の番号をつける)
//
// 保存の形 db.billing = {
//   plan: { name, amount(円・税込), cycle: "monthly" | "yearly", taxRate(%) },
//   issuer: { name, regNo(インボイスの登録番号 T+13けた), address, contact },
//   payUrl(決済のページ。空なら「お支払い方法は運営からご案内します」), note,
//   invoices: [{ id, memberId, period("2026-10" か "2026"), amount, status: "free" | "unpaid" | "paid" | "exempt",
//                issuedAt, paidAt, method, receiptNo }],
//   seq: 領収書の番号の連番
// }
// ============================================

(function () {
  "use strict";
  var JST = 9 * 60 * 60 * 1000;
  var STATUSES = ["free", "unpaid", "paid", "exempt"];
  var CYCLES = ["monthly", "yearly"];
  var METHODS = ["", "カード", "振込", "現金", "その他"];

  BtexServerCore.registerModule({
    mutating: ["adminSaveBilling", "adminSetInvoice"],
    create: function (c) {
      function today() { return new Date(c.nowMs() + JST).toISOString().slice(0, 10); }
      function who(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        if (!a) return { error: c.fail("SESSION_INVALID") };
        var me = c.find(db.referralMembers || [], function (m) { return m.id === a.user.memberId; });
        if (!me) return { error: c.fail("SESSION_INVALID") };
        return { db: db, me: me, id: me.id, isAdmin: a.isAdmin };
      }
      function admin(body) {
        var w = who(body);
        if (w.error) return w;
        if (!w.isAdmin) return { error: c.fail("FORBIDDEN_ADMIN") };
        return w;
      }
      function billing(db) {
        if (!db.billing || typeof db.billing !== "object") {
          db.billing = {
            plan: { name: "BT-EX5 会員", amount: 0, cycle: "monthly", taxRate: 10 },
            issuer: { name: "BT-EX5 運営", regNo: "", address: "", contact: "" },
            payUrl: "", note: "", invoices: [], seq: 0,
          };
        }
        return db.billing;
      }
      function periodOf(b, dateKey) { return b.plan.cycle === "yearly" ? dateKey.slice(0, 4) : dateKey.slice(0, 7); }
      function periodLabel(b, p) { return p.length === 4 ? p + "年分" : Number(p.slice(0, 4)) + "年" + Number(p.slice(5, 7)) + "月分"; }
      // その期間の明細がなければ作る(金額は、そのときのプランの金額)
      function ensureInvoice(db, memberId, period) {
        var b = billing(db);
        var inv = c.find(b.invoices, function (x) { return x.memberId === memberId && x.period === period; });
        if (inv) return { inv: inv, created: false };
        var amount = Number(b.plan.amount) || 0;
        inv = { id: "inv_" + c.randomHex(6), memberId: memberId, period: period, amount: amount, status: amount > 0 ? "unpaid" : "free", issuedAt: c.nowMs(), paidAt: 0, method: "", receiptNo: "" };
        b.invoices.push(inv);
        // 古い明細は 26人×5年分ほどで切る(保存の量を抑える)
        if (b.invoices.length > 3000) b.invoices.splice(0, b.invoices.length - 3000);
        return { inv: inv, created: true };
      }
      // 税込の金額から、うち消費税(10%などの切り捨て)
      function taxOf(amount, rate) { return Math.floor((Number(amount) || 0) * rate / (100 + rate)); }
      function invView(db, b, x) {
        var m = c.find(db.referralMembers || [], function (r) { return r.id === x.memberId; });
        return {
          id: x.id, memberId: x.memberId, name: m ? m.name : "(退会したメンバー)", company: m ? (m.company || "") : "",
          period: x.period, periodLabel: periodLabel(b, x.period), amount: x.amount, tax: taxOf(x.amount, b.plan.taxRate || 10),
          status: x.status, issuedAt: x.issuedAt, paidAt: x.paidAt || 0, method: x.method || "", receiptNo: x.receiptNo || "",
        };
      }
      function publicPlan(b) {
        return {
          plan: { name: b.plan.name, amount: b.plan.amount, cycle: b.plan.cycle, taxRate: b.plan.taxRate || 10 },
          issuer: { name: b.issuer.name, regNo: b.issuer.regNo, address: b.issuer.address, contact: b.issuer.contact },
          payUrl: b.payUrl || "", note: b.note || "",
        };
      }

      function getMyBilling(body) {
        var w = who(body);
        if (w.error) return w.error;
        var b = billing(w.db);
        var cur = ensureInvoice(w.db, w.id, periodOf(b, today()));
        if (cur.created) c.saveDb(w.db);
        var mine = b.invoices.filter(function (x) { return x.memberId === w.id; })
          .sort(function (a, z) { return z.period.localeCompare(a.period); })
          .map(function (x) { return invView(w.db, b, x); });
        return c.ok(Object.assign(publicPlan(b), { current: invView(w.db, b, cur.inv), items: mine }));
      }

      function adminBilling(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var b = billing(w.db);
        var period = String(body.period || "");
        if (!/^\d{4}(-\d{2})?$/.test(period)) period = periodOf(b, today());
        var changed = false;
        (w.db.referralMembers || []).forEach(function (m) { if (ensureInvoice(w.db, m.id, period).created) changed = true; });
        if (changed) c.saveDb(w.db);
        var rows = b.invoices.filter(function (x) { return x.period === period; }).map(function (x) { return invView(w.db, b, x); })
          .sort(function (a, z) { return a.name.localeCompare(z.name, "ja"); });
        var sum = function (st) { return rows.filter(function (r) { return r.status === st; }).reduce(function (s, r) { return s + r.amount; }, 0); };
        return c.ok(Object.assign(publicPlan(b), {
          period: period, periodLabel: periodLabel(b, period), rows: rows,
          totals: { paid: sum("paid"), unpaid: sum("unpaid"), count: rows.length, unpaidCount: rows.filter(function (r) { return r.status === "unpaid"; }).length },
          methods: METHODS.slice(1),
        }));
      }

      function adminSaveBilling(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var b = billing(w.db);
        var p = body.plan || {}, iss = body.issuer || {};
        var amount = Math.round(Number(String(p.amount === undefined ? b.plan.amount : p.amount).replace(/[^\d]/g, "")) || 0);
        if (amount > 10000000) return c.fail("INVALID_REQUEST", "会費は1,000万円までで入れてください。");
        var regNo = c.cleanStr(iss.regNo, 20).toUpperCase().replace(/[\s-]/g, "");
        if (regNo && !/^T\d{13}$/.test(regNo)) return c.fail("INVALID_REQUEST", "登録番号は「T」と13けたの数字で入れてください(例: T1234567890123)。");
        var payUrl = c.cleanStr(body.payUrl, 500);
        if (payUrl && !/^https:\/\/[^\s"'<>]+$/.test(payUrl)) return c.fail("INVALID_REQUEST", "決済のページの URL は https:// から入れてください。");
        b.plan = {
          name: c.cleanStr(p.name, 60) || "BT-EX5 会員",
          amount: amount,
          cycle: CYCLES.indexOf(p.cycle) !== -1 ? p.cycle : b.plan.cycle,
          taxRate: [8, 10].indexOf(Number(p.taxRate)) !== -1 ? Number(p.taxRate) : 10,
        };
        b.issuer = { name: c.cleanStr(iss.name, 80) || "BT-EX5 運営", regNo: regNo, address: c.cleanStr(iss.address, 160), contact: c.cleanStr(iss.contact, 120) };
        b.payUrl = payUrl;
        b.note = c.cleanStr(body.note, 300);
        // まだ払われていない今の期間の明細は、新しい金額に合わせる
        var period = periodOf(b, today());
        b.invoices.forEach(function (x) {
          if (x.period === period && (x.status === "unpaid" || x.status === "free")) { x.amount = amount; x.status = amount > 0 ? "unpaid" : "free"; }
        });
        c.saveDb(w.db);
        return c.ok(publicPlan(b));
      }

      function adminSetInvoice(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var b = billing(w.db);
        var x = c.find(b.invoices, function (i) { return i.id === c.cleanStr(body.id, 40); });
        if (!x) return c.fail("NOT_FOUND");
        var st = STATUSES.indexOf(body.status) !== -1 ? body.status : x.status;
        if (st === "free" && x.amount > 0) st = "unpaid";
        x.status = st;
        x.method = METHODS.indexOf(body.method) !== -1 ? body.method : x.method;
        if (st === "paid") {
          if (!x.paidAt) x.paidAt = c.nowMs();
          // 領収書の番号は、はじめて支払い済みにしたときに1回だけつける(R-2026-0001)
          if (!x.receiptNo) { b.seq = (b.seq || 0) + 1; x.receiptNo = "R-" + today().slice(0, 4) + "-" + ("000" + b.seq).slice(-4); }
        } else { x.paidAt = 0; }
        c.saveDb(w.db);
        return c.ok({ item: invView(w.db, b, x) });
      }

      return {
        actions: { getMyBilling: getMyBilling, adminBilling: adminBilling, adminSaveBilling: adminSaveBilling, adminSetInvoice: adminSetInvoice },
      };
    },
  });
})();
