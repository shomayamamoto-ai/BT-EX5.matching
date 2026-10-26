// ============================================
// survey/survey.js — 定例会のアンケート(ログイン不要)
// ?k=member(BT-EX メンバー)/ ?k=visitor(ビジター)、&e=定例会の ID。定例会のスライドの QR コードから開く
// 回答は運営(プレゼンの進行役・管理者)がアプリの「アンケートの結果」で一覧・分析できる
// 答えやすいように、文を書く質問は任意にし、ほかは押して選ぶだけ。
// 「どこを良くするか」「時間の長さ」「出会いがあったか」を選んでもらい、改善点を数で集計できるようにする
// ============================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const eventId = q.get("e") || "";
  let kind = q.get("k") === "visitor" ? "visitor" : "member";
  const SCORES = ["とても感じた", "感じた", "どちらともいえない", "あまり感じなかった", "感じなかった"];
  const INTEREST = ["ぜひ入会したい", "詳しく話を聞きたい", "今は考えていない"];
  const IMPROVE = ["時間配分・進行のテンポ", "音声・映像・接続", "説明のわかりやすさ", "商談(ブレイクアウト)の時間・組み合わせ", "プレゼンの長さ・順番", "事前の案内・資料", "参加者どうしの交流", "特になし(このままでよい)"];
  const NONE_IMPROVE = IMPROVE[IMPROVE.length - 1];
  const LENGTH = ["短い", "ちょうどよい", "長い"];
  const MEET = {
    member: ["1on1・商談の約束をした", "これから声をかけたい人がいる", "今回はなかった"],
    visitor: ["また話したい人がいた", "少しいた", "いなかった"],
  };
  // 良かったプログラム: 定例会の流れ(「⑤ブレイクアウトルーム商談（テーブル商談） 7分×4」→「ブレイクアウトルーム商談（テーブル商談）」)
  const programs = String(typeof REF_SEED_AGENDA !== "undefined" ? REF_SEED_AGENDA : "").split("\n")
    .map((x) => x.trim()).filter((x) => /^[①-⑳]/.test(x))
    .map((x) => x.slice(1).replace(/\s*[（(]?\s*\d+\s*分(?:\s*[×xX✕]\s*\d+\s*回?)?\s*[)）]?\s*$/, "").trim());
  const opts = (sel, list, first) => { sel.replaceChildren(new Option(first, ""), ...list.map((x) => new Option(x, x))); };
  opts($("sv-unit"), Array.from({ length: 14 }, (_, i) => `BT-EX${i + 1}`), "選んでください");
  // 今日の日付(日本時間)
  $("sv-date").value = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  // B.T.内系列名: すべてのチームを並べて、押して選ぶ
  const lineage = BtTeams.mount($("sv-lineage"));

  // 押して選ぶボタンの組。multi: いくつでも選べる(only: これを選ぶとほかは外れる)
  const picked = {};
  function chips(id, list, { multi = false, only = "", onchange } = {}) {
    const box = $(id);
    picked[id] = multi ? [] : "";
    const draw = () => box.replaceChildren(...list.map((v) => {
      const on = multi ? picked[id].includes(v) : picked[id] === v;
      return Object.assign(document.createElement("button"), {
        type: "button", className: "sv-chip" + (on ? " is-on" : "") + (v === only ? " is-only" : ""), textContent: v, ariaPressed: String(on),
        onclick: () => {
          if (!multi) picked[id] = picked[id] === v ? "" : v;
          else if (v === only) picked[id] = picked[id].includes(v) ? [] : [v];
          else picked[id] = picked[id].includes(v) ? picked[id].filter((x) => x !== v) : [...picked[id].filter((x) => x !== only), v];
          draw();
          if (onchange) onchange(picked[id]);
        },
      });
    }));
    draw();
    box.redraw = (newList) => { list = newList; picked[id] = multi ? [] : ""; draw(); };
  }
  chips("sv-score", SCORES);
  chips("sv-program", [...programs, "その他"], { onchange: (v) => { $("sv-program-other").hidden = v !== "その他"; } });
  chips("sv-meet", MEET[kind]);
  chips("sv-interest", INTEREST);
  chips("sv-improve", IMPROVE, { multi: true, only: NONE_IMPROVE });
  chips("sv-fix", [...programs, "特になし"]);
  chips("sv-length", LENGTH);

  // 書く欄の例(何を書けばよいか分かるように)
  const EXAMPLES = {
    member: { reason: "例:商談で具体的な案件の話ができた/用語説明でUSPの意味がわかった", comment: "例:商談の時間をあと3分のばしてほしい/資料を前日までに共有してほしい" },
    visitor: { reason: "例:メンバーの方が温かく、紹介が回る仕組みがよくわかった", comment: "例:はじめての人向けに、最初に流れの説明がほしい/名刺交換の時間がほしい" },
  };

  function setKind(k) {
    kind = k;
    document.querySelectorAll(".sv-kind button").forEach((b) => b.setAttribute("aria-selected", b.dataset.kind === k ? "true" : "false"));
    document.querySelectorAll("[data-for]").forEach((el) => { el.hidden = el.dataset.for !== k; });
    $("sv-lead").textContent = k === "visitor"
      ? "本日はご参加ありがとうございました\n今後の定例会づくりのため\nご感想をお聞かせください(2〜3分)"
      : "(BT-EXメンバー向け)\n本日の定例会の事後アンケートです\nご協力をお願いします(2〜3分)";
    $("sv-score-text").textContent = k === "visitor"
      ? "BT-EXの仕組みや定例会は、ご自身のビジネスを加速させる可能性を感じましたか?"
      : "BT-EXの仕組みや定例会は、自身やチームメンバーのビジネスを加速させる可能性を感じましたか?";
    $("sv-meet-text").textContent = k === "visitor"
      ? "また話してみたいメンバーはいましたか?"
      : "今日、紹介や商談につながりそうな出会いはありましたか?";
    $("sv-meet").redraw(MEET[k]);
    $("sv-reason").placeholder = EXAMPLES[k].reason;
    $("sv-comment").placeholder = EXAMPLES[k].comment;
    // 質問の番号(見えている質問だけ Q1, Q2 …)
    let no = 0;
    document.querySelectorAll(".sv-q").forEach((el) => { if (!el.closest("[hidden]") && !el.hidden) el.querySelector(".sv-qn").textContent = `Q${++no}`; });
    $("sv-message").textContent = "";
  }
  document.querySelectorAll(".sv-kind button").forEach((b) => b.addEventListener("click", () => setKind(b.dataset.kind)));
  setKind(kind);

  const val = (id) => ($(id).value || "").trim();
  function fail(id, msg) {
    $("sv-message").textContent = msg;
    const el = typeof id === "string" ? $(id) : id;
    if (el) {
      const target = el.matches(".sv-chips") ? el.querySelector("button") || el : el;
      target.focus({ preventScroll: true });
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    return null;
  }
  // 選んだ答えを1行の文にしたもの(感想の欄の最後に付ける。共有サーバーが古い版のときも、選んだ答えが残るように)
  const choiceLine = (d) => `【選んだ答え】もっと良くするなら: ${d.improve.join("、")} / 全体の長さ: ${d.length} / 出会い: ${d.meet}${d.fix ? ` / 見直してほしいプログラム: ${d.fix}` : ""}`;

  function read() {
    const prog = picked["sv-program"];
    const program = prog === "その他" ? `その他: ${val("sv-program-other")}` : prog;
    const d = { kind, eventId, date: val("sv-date"), last: val("sv-last"), first: val("sv-first"), email: val("sv-email"),
      score: picked["sv-score"], program, reason: val("sv-reason"), comment: val("sv-comment"), website: val("sv-website"),
      improve: picked["sv-improve"].slice(), length: picked["sv-length"], meet: picked["sv-meet"], fix: picked["sv-fix"] === "特になし" ? "" : picked["sv-fix"] };
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
      Object.assign(d, { job: val("sv-job-v"), inviter: val("sv-inviter"), link: link ? link.value : "", interest: picked["sv-interest"] });
      if (!d.job) return fail("sv-job-v", "会社名・職業を入れてください。");
      if (!d.inviter) return fail("sv-inviter", "招待してくれたメンバーのお名前を入れてください。");
      if (!d.link) return fail("sv-link-yes", "LINK の会員かどうかを選んでください。");
    }
    if (!d.score) return fail("sv-score", "可能性を感じたかを選んでください。");
    if (!prog || (prog === "その他" && !val("sv-program-other"))) return fail(prog === "その他" ? "sv-program-other" : "sv-program", "特に良かったプログラムを選んでください。");
    if (!d.meet) return fail("sv-meet", kind === "visitor" ? "また話してみたいメンバーがいたかを選んでください。" : "出会いがあったかを選んでください。");
    if (kind === "visitor" && !d.interest) return fail("sv-interest", "入会への興味を選んでください。");
    if (!d.improve.length) return fail("sv-improve", "もっと良くするならどこかを選んでください(なければ「特になし」)。");
    if (!d.length) return fail("sv-length", "定例会全体の長さを選んでください。");
    // 書く欄は任意。空のときは「(記入なし)」として送る(古い版の共有サーバーでも受け付けられるように)
    if (!d.reason) d.reason = "(記入なし)";
    d.comment = `${d.comment ? `${d.comment}\n` : ""}${choiceLine(d)}`;
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
