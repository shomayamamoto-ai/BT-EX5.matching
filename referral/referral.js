// ============================================
// 紹介先早見表 - ロジック
// ・業種/エリア/キーワードでの絞り込み
// ・紹介診断:5つの質問の回答からメンバーごとの一致度(0〜100%)を計算
// ・紹介文のコピー/LINEで送る
// ============================================

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  const labelOf = (list, id) => (list.find((x) => x.id === id) || {}).label || "";

  // ---------- 状態 ----------
  const filter = { category: "all", area: "all", search: "" };
  const answers = { topics: new Set(), keyword: "", who: null, industry: null, area: null, meeting: null };
  let step = 0;
  let scores = null;       // { [memberId]: { score, reasons, topicHits, keywordHits } }
  let sortByScore = false;

  // ---------- 一致度の計算 ----------
  // 配点: 話題50 + 業種15 + 相手のタイプ10 + 会い方・エリア25 = 100
  // キーワード一致で+10(上限100)。話題もキーワードも一致しない人は30%で頭打ち
  function keywordTokens(text) {
    return String(text || "")
      .split(/[\s、,,・/]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
  }

  function haystack(m) {
    return [m.name, m.company, m.category, m.business, m.note, m.wants, ...m.triggers].join(" ");
  }

  function scoreMember(m, a) {
    const reasons = [];
    let s = 0;

    const topicHits = [...a.topics].filter((t) => m.topics.includes(t));
    if (a.topics.size) s += (50 * topicHits.length) / a.topics.size;
    topicHits.forEach((t) => reasons.push(`「${labelOf(TOPICS, t)}」に対応`));

    if (a.industry === "unknown") {
      s += 9;
    } else if (m.targets.includes(a.industry)) {
      s += 15;
      reasons.push(`${labelOf(INDUSTRIES, a.industry)}の紹介を求めている`);
    } else if (m.targets.includes("any")) {
      s += 11;
    }

    if (a.who === "unknown") {
      s += 6;
    } else if (m.prospects.includes(a.who)) {
      s += 10;
    }

    const faceOK = a.area !== "other" && m.faceAreas.includes(a.area);
    const onlineAll = m.online === "all";
    const onlinePartial = m.online === "partial";
    let areaScore = 0;
    if (a.meeting === "face") {
      areaScore = faceOK ? 25 : onlineAll ? 8 : onlinePartial ? 5 : 0;
    } else if (a.meeting === "online") {
      areaScore = onlineAll ? 25 : onlinePartial ? 14 : faceOK ? 8 : 0;
    } else {
      areaScore = faceOK || onlineAll ? 25 : onlinePartial ? 14 : 0;
    }
    s += areaScore;
    if (faceOK && a.meeting !== "online") reasons.push(`${labelOf(AREAS, a.area)}で対面可`);
    if (onlineAll && (a.meeting !== "face" || !faceOK)) reasons.push("オンライン全国対応");

    const hay = haystack(m);
    const keywordHits = keywordTokens(a.keyword).filter((t) => hay.includes(t));
    if (keywordHits.length) {
      s += 10;
      keywordHits.forEach((t) => reasons.push(`「${t}」がキーワードに一致`));
    }

    if (!topicHits.length && !keywordHits.length) s = Math.min(s, 30);

    return { score: Math.round(Math.min(100, s)), reasons, topicHits, keywordHits };
  }

  function computeScores() {
    scores = {};
    REF_MEMBERS.forEach((m) => { scores[m.id] = scoreMember(m, answers); });
  }

  // ---------- 紹介文 ----------
  function introText(m) {
    const sc = scores && scores[m.id];
    const lines = [
      `【ご紹介】${m.name}さん(${m.company})`,
      m.business,
      "",
    ];
    if (sc && sc.topicHits.length) {
      const talk = sc.topicHits.map((t) => labelOf(TOPICS, t)).join("・");
      lines.push(`「${talk}」のお話をされていたので、ぴったりだと思いご紹介します。`);
    }
    lines.push(`${m.name}さんは「${m.wants}」とのつながりを求めています。`);
    lines.push(`対面:${m.face}/オンライン:${ONLINE_LABELS[m.online]}`);
    lines.push("ぜひ一度お話ししてみてください。");
    return lines.join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("#refToast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  // ---------- 一覧 ----------
  function matchesFilter(m) {
    if (filter.category !== "all" && m.category !== filter.category) return false;
    if (filter.area === "niigata" && !m.faceAreas.includes("niigata")) return false;
    if (filter.area === "tokyo" && !m.faceAreas.includes("tokyo")) return false;
    if (filter.area === "online" && m.online === "none") return false;
    if (filter.search) {
      const tokens = keywordTokens(filter.search).length ? keywordTokens(filter.search) : [filter.search.trim()];
      const hay = haystack(m).toLowerCase();
      if (!tokens.every((t) => hay.includes(t.toLowerCase()))) return false;
    }
    return true;
  }

  function cardHtml(m) {
    const sc = scores && scores[m.id];
    const hitWords = [
      ...(sc ? sc.keywordHits : []),
      ...keywordTokens(filter.search),
    ];
    const triggerHtml = m.triggers
      .map((t) => {
        const hit = hitWords.some((w) => t.includes(w));
        return `<span class="ref-trigger${hit ? " hit" : ""}">「${escapeHtml(t)}」</span>`;
      })
      .join("");
    const onlineClass = m.online === "all" ? "online-all" : m.online === "none" ? "online-none" : "";

    return `
      <article class="ref-card${m.sample ? "" : " is-real"}" id="member-${m.id}">
        <div class="ref-card-head">
          <div>
            <h3 class="ref-name">${escapeHtml(m.name)}</h3>
            <p class="ref-company">${escapeHtml(m.company)}</p>
          </div>
          ${sc ? `<div class="ref-match"><strong>${sc.score}%</strong><small>一致度</small></div>` : ""}
        </div>
        <div class="ref-tags">
          <span class="ref-tag ${m.base === "新潟" ? "base-niigata" : "base-tokyo"}">${escapeHtml(m.base)}拠点</span>
          <span class="ref-tag">${escapeHtml(m.category)}</span>
          ${m.sample ? '<span class="ref-tag sample">サンプル</span>' : ""}
        </div>
        <p class="ref-label">事業内容</p>
        <p class="ref-business">${escapeHtml(m.business)}</p>
        ${m.note ? `<p class="ref-note">${escapeHtml(m.note)}</p>` : ""}
        <p class="ref-label">求める紹介</p>
        <p class="ref-wants">${escapeHtml(m.wants)}</p>
        <div class="ref-triggers">${triggerHtml}</div>
        <p class="ref-label">活動範囲</p>
        <dl class="ref-range">
          <dt>対面</dt><dd>${escapeHtml(m.face)}</dd>
          <dt>オンライン</dt><dd class="${onlineClass}">${escapeHtml(ONLINE_LABELS[m.online])}</dd>
        </dl>
        <div class="ref-actions">
          <button type="button" class="ref-btn" data-copy="${m.id}">紹介文をコピー</button>
          <button type="button" class="ref-btn line" data-line="${m.id}">LINEで送る</button>
        </div>
      </article>`;
  }

  function renderList() {
    let list = REF_MEMBERS.filter(matchesFilter);
    if (sortByScore && scores) {
      list = list.slice().sort((a, b) => scores[b.id].score - scores[a.id].score);
    }
    $("#refList").innerHTML = list.length
      ? list.map(cardHtml).join("")
      : '<p class="ref-empty">条件に合うメンバーが見つかりませんでした。<br>キーワードや絞り込みを変えてみてください。</p>';
    $("#countShown").textContent = list.length;
    $("#countTotal").textContent = REF_MEMBERS.length;
    $("#sortedBanner").hidden = !(sortByScore && scores);
  }

  function chipHtml(group, value, label, active) {
    return `<button type="button" class="ref-chip" data-${group}="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
  }

  function renderChips() {
    $("#categoryChips").innerHTML = [
      chipHtml("category", "all", "すべて", filter.category === "all"),
      ...REF_CATEGORIES.map((c) => chipHtml("category", c, c, filter.category === c)),
    ].join("");
    const areaOptions = [
      ["all", "すべて"],
      ["niigata", "新潟で対面可"],
      ["tokyo", "東京・関東で対面可"],
      ["online", "オンライン可"],
    ];
    $("#areaChips").innerHTML = areaOptions
      .map(([v, l]) => chipHtml("area", v, l, filter.area === v))
      .join("");
  }

  // ---------- 紹介診断 ----------
  const UNKNOWN = { id: "unknown", label: "わからない" };
  const STEPS = [
    { key: "topics", q: "どんな話が出ましたか?", hint: "当てはまるものをすべて選んでください(複数選択可)", options: TOPICS, multi: true },
    { key: "who", q: "相手はどんな方ですか?", hint: "わからなければ「わからない」でOKです", options: [...PROSPECTS, UNKNOWN] },
    { key: "industry", q: "相手の業種は?", hint: "近いものを1つ選んでください", options: [...INDUSTRIES, UNKNOWN] },
    { key: "area", q: "相手はどこにいますか?", hint: "主な活動エリアを選んでください", options: AREAS },
    { key: "meeting", q: "会うならどの形がよさそうですか?", hint: "相手の希望に近いものを選んでください", options: MEETINGS },
  ];

  function isAnswered(st) {
    return st.multi ? answers.topics.size > 0 : answers[st.key] !== null;
  }

  function renderStep() {
    const st = STEPS[step];
    $("#diagProgressBar").style.width = `${((step + 1) / STEPS.length) * 100}%`;
    $("#diagStepLabel").textContent = `質問 ${step + 1} / ${STEPS.length}`;
    $("#diagQuestion").textContent = st.q;
    $("#diagHint").textContent = st.hint;
    $("#diagOptions").innerHTML = st.options
      .map((o) => {
        const on = st.multi ? answers.topics.has(o.id) : answers[st.key] === o.id;
        return `<button type="button" class="diag-option" data-opt="${o.id}" aria-pressed="${on}">${escapeHtml(o.label)}</button>`;
      })
      .join("");
    $("#diagKeywordWrap").hidden = !st.multi;
    $("#diagBack").hidden = step === 0;
    $("#diagNext").textContent = step === STEPS.length - 1 ? "結果を見る" : "次へ";
    $("#diagNext").disabled = !isAnswered(st);
  }

  function goStep(n) {
    step = n;
    renderStep();
    $("#diagQuestion").focus({ preventScroll: true });
  }

  function startDiagnosis() {
    answers.topics = new Set();
    answers.keyword = "";
    answers.who = answers.industry = answers.area = answers.meeting = null;
    $("#diagKeyword").value = "";
    $("#diagIntro").hidden = true;
    $("#diagResults").hidden = true;
    $("#diagWizard").hidden = false;
    goStep(0);
    $("#diagnosis").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showResults() {
    answers.keyword = $("#diagKeyword").value.trim();
    computeScores();

    const summary = [
      ...[...answers.topics].map((t) => labelOf(TOPICS, t)),
      answers.who === "unknown" ? null : labelOf(PROSPECTS, answers.who),
      answers.industry === "unknown" ? null : labelOf(INDUSTRIES, answers.industry),
      labelOf(AREAS, answers.area),
      labelOf(MEETINGS, answers.meeting),
      answers.keyword ? `「${answers.keyword}」` : null,
    ].filter(Boolean);
    $("#diagSummary").innerHTML = summary.map((s) => `<span>${escapeHtml(s)}</span>`).join("");

    const ranked = REF_MEMBERS
      .map((m) => ({ m, sc: scores[m.id] }))
      .filter((x) => x.sc.score >= 40)
      .sort((a, b) => b.sc.score - a.sc.score)
      .slice(0, 5);

    $("#diagRanking").innerHTML = ranked.length
      ? ranked
          .map(({ m, sc }, i) => `
        <li class="rank-item">
          <span class="rank-no">${i + 1}</span>
          <span class="rank-name">${escapeHtml(m.name)}</span>
          <span class="rank-score"><strong>${sc.score}%</strong><small>一致度</small></span>
          <span class="rank-company">${escapeHtml(m.company)}・${escapeHtml(m.category)}</span>
          <span class="rank-bar"><span style="width:${sc.score}%"></span></span>
          <span class="rank-reasons">${sc.reasons.slice(0, 4).map((r) => `<span>${escapeHtml(r)}</span>`).join("")}</span>
          <span class="rank-actions">
            <button type="button" class="ref-btn" data-copy="${m.id}">紹介文をコピー</button>
            <button type="button" class="ref-btn line" data-line="${m.id}">LINEで送る</button>
            <button type="button" class="ref-btn ghost" data-goto="${m.id}">カードを見る</button>
          </span>
        </li>`)
          .join("")
      : '<p class="diag-empty">一致度の高いメンバーが見つかりませんでした。話題を増やすか、会い方を「どちらでもよい」にして再診断してみてください。</p>';

    $("#diagWizard").hidden = true;
    $("#diagResults").hidden = false;
    $("#diagResults .diag-title").setAttribute("tabindex", "-1");
    $("#diagResults .diag-title").focus({ preventScroll: true });
    $("#diagnosis").scrollIntoView({ behavior: "smooth", block: "start" });
    renderList();
  }

  function onOptionClick(id) {
    const st = STEPS[step];
    if (st.multi) {
      if (answers.topics.has(id)) answers.topics.delete(id);
      else answers.topics.add(id);
      renderStep();
      return;
    }
    answers[st.key] = id;
    renderStep();
    // 単一選択は選んだら自動で次へ
    setTimeout(() => {
      if (step === STEPS.indexOf(st)) {
        if (step === STEPS.length - 1) showResults();
        else goStep(step + 1);
      }
    }, 220);
  }

  function gotoCard(id) {
    filter.category = "all";
    filter.area = "all";
    filter.search = "";
    $("#refSearch").value = "";
    renderChips();
    renderList();
    const card = document.getElementById(`member-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.add("is-highlight");
    setTimeout(() => card.classList.remove("is-highlight"), 2200);
  }

  // ---------- イベント ----------
  document.addEventListener("click", async (e) => {
    const t = e.target;

    const cat = t.closest("[data-category]");
    if (cat) { filter.category = cat.dataset.category; renderChips(); renderList(); return; }

    const area = t.closest("[data-area]");
    if (area) { filter.area = area.dataset.area; renderChips(); renderList(); return; }

    const opt = t.closest("[data-opt]");
    if (opt) { onOptionClick(opt.dataset.opt); return; }

    const copyBtn = t.closest("[data-copy]");
    if (copyBtn) {
      const m = REF_MEMBERS.find((x) => x.id === copyBtn.dataset.copy);
      const ok = await copyText(introText(m));
      toast(ok ? "紹介文をコピーしました。LINEやメールに貼り付けて送れます" : "コピーできませんでした");
      return;
    }

    const lineBtn = t.closest("[data-line]");
    if (lineBtn) {
      const m = REF_MEMBERS.find((x) => x.id === lineBtn.dataset.line);
      const url = "https://line.me/R/share?text=" + encodeURIComponent(introText(m));
      window.open(url, "_blank", "noopener");
      return;
    }

    const gotoBtn = t.closest("[data-goto]");
    if (gotoBtn) { gotoCard(gotoBtn.dataset.goto); return; }
  });

  $("#diagStart").addEventListener("click", startDiagnosis);
  $("#diagRetry").addEventListener("click", startDiagnosis);
  $("#diagBack").addEventListener("click", () => { if (step > 0) goStep(step - 1); });
  $("#diagNext").addEventListener("click", () => {
    if (!isAnswered(STEPS[step])) return;
    if (step === STEPS.length - 1) showResults();
    else goStep(step + 1);
  });
  $("#diagSortList").addEventListener("click", () => {
    sortByScore = true;
    filter.category = "all";
    filter.area = "all";
    renderChips();
    renderList();
    $("#sortedBanner").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#clearSort").addEventListener("click", () => { sortByScore = false; renderList(); });

  $("#refSearch").addEventListener("input", (e) => {
    filter.search = e.target.value;
    renderList();
  });

  // ---------- 初期化(会員限定) ----------
  (async function init() {
    const session = await AuthSession.guardPage({ next: "referral", loginPath: "../login/" });
    if (!session) return;
    $("#communityLabel").textContent = COMMUNITY.label;
    $("#sampleNotice").textContent = COMMUNITY.realMemberNote;
    renderChips();
    renderList();
    document.documentElement.classList.remove("guard-pending");
  })();
})();
