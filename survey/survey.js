// ============================================
// survey/survey.js — 定例会のアンケート(ログイン不要)
// ?k=member(BT-EX メンバー)/ ?k=visitor(ビジター)、&e=定例会の ID。定例会のスライドの QR コードから開く
// 回答は運営(プレゼンの進行役・管理者)がアプリの「アンケートの結果」で一覧・分析できる
// ============================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const eventId = q.get("e") || "";
  let kind = q.get("k") === "visitor" ? "visitor" : "member";
  const SCORES = ["とても感じた", "感じた", "どちらともいえない", "あまり感じなかった", "感じなかった"];
  const INTEREST = ["ぜひ入会したい", "詳しく話を聞きたい", "今は考えていない"];
  // 良かったプログラム: 定例会の流れ(「⑤ブレイクアウトルーム商談（テーブル商談） 7分×4」→「ブレイクアウトルーム商談（テーブル商談）」)
  const programs = String(typeof REF_SEED_AGENDA !== "undefined" ? REF_SEED_AGENDA : "").split("\n")
    .map((x) => x.trim()).filter((x) => /^[①-⑳]/.test(x))
    .map((x) => x.slice(1).replace(/\s*[（(]?\s*\d+\s*分(?:\s*[×xX✕]\s*\d+\s*回?)?\s*[)）]?\s*$/, "").trim());
  const opts = (sel, list, first) => { sel.replaceChildren(new Option(first, ""), ...list.map((x) => new Option(x, x))); };
  opts($("sv-unit"), Array.from({ length: 14 }, (_, i) => `BT-EX${i + 1}`), "選んでください");
  opts($("sv-score"), SCORES, "選んでください");
  opts($("sv-program"), [...programs, "その他"], "選んでください");
  opts($("sv-interest"), INTEREST, "選んでください");
  // 今日の日付(日本時間)
  $("sv-date").value = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  // B.T.内系列名: すべてのチームを並べて、押して選ぶ
  const lineage = BtTeams.mount($("sv-lineage"));
  $("sv-program").addEventListener("change", () => { $("sv-program-other").hidden = $("sv-program").value !== "その他"; });

  function setKind(k) {
    kind = k;
    document.querySelectorAll(".sv-kind button").forEach((b) => b.setAttribute("aria-selected", b.dataset.kind === k ? "true" : "false"));
    document.querySelectorAll("[data-for]").forEach((el) => { el.hidden = el.dataset.for !== k; });
    $("sv-lead").textContent = k === "visitor"
      ? "本日はご参加ありがとうございました\n今後の定例会づくりのため\nご感想をお聞かせください(2〜3分)"
      : "(BT-EXメンバー向け)\n本日の定例会の事後アンケートです\nご協力をお願いします(2〜3分)";
    $("sv-score-label").firstChild.textContent = k === "visitor"
      ? "BT-EXの仕組みや定例会は、ご自身のビジネスを加速させる可能性を感じましたか? "
      : "BT-EXの仕組みや定例会は、自身やチームメンバーのビジネスを加速させる可能性を感じましたか? ";
    $("sv-message").textContent = "";
  }
  document.querySelectorAll(".sv-kind button").forEach((b) => b.addEventListener("click", () => setKind(b.dataset.kind)));
  setKind(kind);

  const val = (id) => ($(id).value || "").trim();
  function fail(id, msg) {
    $("sv-message").textContent = msg;
    const el = typeof id === "string" ? $(id) : id;
    if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
    return null;
  }
  function read() {
    const program = val("sv-program") === "その他" ? `その他: ${val("sv-program-other")}` : val("sv-program");
    const d = { kind, eventId, date: val("sv-date"), last: val("sv-last"), first: val("sv-first"), email: val("sv-email"),
      score: val("sv-score"), program, reason: val("sv-reason"), comment: val("sv-comment"), website: val("sv-website") };
    if (!d.date) return fail("sv-date", "定例会参加日を入れてください。");
    if (!d.last) return fail("sv-last", "姓を入れてください。");
    if (!d.first) return fail("sv-first", "名を入れてください。");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return fail("sv-email", "メールアドレスを正しく入れてください。");
    if (kind === "member") {
      Object.assign(d, { unit: val("sv-unit"), lineage: val("sv-lineage"), job: val("sv-job-m"), upcre: val("sv-upcre"), adopt: val("sv-adopt") });
      if (!d.unit) return fail("sv-unit", "所属ユニットを選んでください。");
      const lp = lineage.problem(true);
      if (lp) return fail(lineage.root, lp);
      if (!d.job) return fail("sv-job-m", "職業を入れてください。");
    } else {
      const link = document.querySelector('input[name="sv-link"]:checked');
      Object.assign(d, { job: val("sv-job-v"), inviter: val("sv-inviter"), link: link ? link.value : "", interest: val("sv-interest") });
      if (!d.job) return fail("sv-job-v", "会社名・職業を入れてください。");
      if (!d.inviter) return fail("sv-inviter", "招待してくれたメンバーのお名前を入れてください。");
      if (!d.link) return fail("sv-link-yes", "LINK の会員かどうかを選んでください。");
    }
    if (!d.score) return fail("sv-score", "可能性を感じたかを選んでください。");
    if (!val("sv-program") || (val("sv-program") === "その他" && !val("sv-program-other"))) return fail("sv-program", "特に良かったプログラムを選んでください。");
    if (kind === "visitor" && !d.interest) return fail("sv-interest", "入会への興味を選んでください。");
    if (!d.reason) return fail("sv-reason", "回答の理由を入れてください。");
    if (!d.comment) return fail("sv-comment", "ご感想・ご質問・ご提案を入れてください。");
    return d;
  }
  $("sv-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = read();
    if (!d) return;
    $("sv-submit").disabled = true;
    const res = await AuthApi.call("submitSurvey", d);
    $("sv-submit").disabled = false;
    if (!res.success) { $("sv-message").textContent = res.error.userMessage; return; }
    $("sv-message").textContent = "";
    $("sv-form").hidden = true;
    document.querySelector(".sv-kind").hidden = true;
    $("sv-done").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("sv-again").addEventListener("click", () => { $("sv-done").hidden = true; $("sv-form").hidden = false; document.querySelector(".sv-kind").hidden = false; });
})();
