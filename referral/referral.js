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
  const filter = { category: "all", area: "all", search: "", topic: "all" };
  const answers = { topics: new Set(), keyword: "", who: null, industry: null, area: null, meeting: null };
  let step = 0;
  let scores = null;       // { [memberId]: { score, reasons, topicHits, keywordHits } }
  let sortByScore = false;
  let members = [];        // サーバーから取得した名簿
  let myMemberId = "";     // ログイン中の本人(名簿のID)


  const { keywordTokens, haystack, scoreMember } = RefScoring;

  function computeScores() {
    scores = {};
    members.forEach((m) => { scores[m.id] = scoreMember(m, answers); });
  }

  // ---------- 紹介文 ----------
  function introText(m) {
    const sc = scores && scores[m.id];
    const lines = [`【ご紹介】${m.name}さん${m.company ? `(${m.company})` : ""}`];
    if (m.business) lines.push(m.business);
    lines.push("");
    if (sc && sc.topicHits.length) {
      const talk = sc.topicHits.map((t) => labelOf(TOPICS, t)).join("・");
      lines.push(`「${talk}」のお話をされていたので、ぴったりだと思いご紹介します。`);
    }
    if (m.wants) lines.push(`${m.name}さんは「${m.wants}」とのつながりを求めています。`);
    const range = [];
    if (m.face) range.push(`対面:${m.face}`);
    if (m.online !== "unknown") range.push(`オンライン:${ONLINE_LABELS[m.online]}`);
    if (range.length) lines.push(range.join("/"));
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
    if (filter.topic !== "all" && !m.topics.includes(filter.topic)) return false;
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
    const onlineClass = m.online === "all" ? "online-all" : m.online === "none" || m.online === "unknown" ? "online-none" : "";
    const complete = isProfileComplete(m);

    return `
      <article class="ref-card${m.id === "yamamoto" ? " is-real" : ""}" id="member-${m.id}">
        <div class="ref-col ref-col-member">
          <div class="ref-card-head">
            <div>
              <h3 class="ref-name">${escapeHtml(m.name)}</h3>
              <p class="ref-company">${escapeHtml(m.company)}</p>
            </div>
            ${sc ? `<div class="ref-match"><strong>${sc.score}%</strong><small>一致度</small></div>` : ""}
          </div>
          <div class="ref-tags">
            ${m.base && m.base !== "未設定" ? `<span class="ref-tag ${m.base === "新潟" ? "base-niigata" : "base-tokyo"}">${escapeHtml(m.base)}拠点</span>` : ""}
            <span class="ref-tag">${escapeHtml(m.category)}</span>
            ${m.team ? `<span class="ref-tag team">${escapeHtml(m.team)}</span>` : ""}
            ${m.id === myMemberId ? '<span class="ref-tag me">あなた</span>' : ""}
            ${complete ? "" : '<span class="ref-tag pending">準備中</span>'}
          </div>
        </div>
        <div class="ref-col ref-col-business">
          <p class="ref-label">事業内容</p>
          <p class="ref-business${m.business ? "" : " ref-muted"}">${m.business ? escapeHtml(m.business) : "準備中"}</p>
          ${m.customers ? `<p class="ref-customers"><span>主なお客様</span>${escapeHtml(m.customers)}</p>` : ""}
          ${m.note ? `<p class="ref-note">${escapeHtml(m.note)}</p>` : ""}
        </div>
        <div class="ref-col ref-col-wants">
          <p class="ref-label">求める紹介</p>
          <p class="ref-wants${m.wants ? "" : " ref-muted"}">${m.wants ? escapeHtml(m.wants) : "まだ入力されていません"}</p>
          <div class="ref-triggers">${triggerHtml}</div>
        </div>
        <div class="ref-col ref-col-range">
          <p class="ref-label">活動範囲</p>
          <dl class="ref-range">
            <dt>対面</dt><dd class="${m.face ? "" : "ref-muted"}">${m.face ? escapeHtml(m.face) : "未入力"}</dd>
            <dt>オンライン</dt><dd class="${onlineClass}">${escapeHtml(ONLINE_LABELS[m.online])}</dd>
          </dl>
          <div class="ref-actions">
            <button type="button" class="ref-btn" data-copy="${m.id}">紹介文をコピー</button>
            <button type="button" class="ref-btn line" data-line="${m.id}">LINEで送る</button>
            ${m.id === myMemberId ? '<a href="../profile/" class="ref-btn record">自分の情報を編集</a>' : ""}
          </div>
        </div>
      </article>`;
  }

  function renderList() {
    let list = members.filter(matchesFilter);
    if (sortByScore && scores) {
      list = list.slice().sort((a, b) => scores[b.id].raw - scores[a.id].raw);
    } else if (filter.topic !== "all") {
      // 話題で探すときは、その話題を専門にしている人(扱う話題が少ない人)を先に
      list = list.slice().sort((a, b) => a.topics.length - b.topics.length);
    }
    $("#refList").innerHTML = list.length
      ? list.map(cardHtml).join("")
      : '<p class="ref-empty">条件に合うメンバーが見つかりませんでした。<br>キーワードや絞り込みを変えてみてください。</p>';
    $("#countShown").textContent = list.length;
    $("#countTotal").textContent = members.length;
    $("#sortedBanner").hidden = !(sortByScore && scores);
  }

  function chipHtml(group, value, label, active) {
    return `<button type="button" class="ref-chip" data-${group}="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
  }

  function renderTopicSelect() {
    $("#topicSelect").innerHTML = '<option value="all">すべての話題</option>' + TOPIC_GROUPS
      .map((g) => `<optgroup label="${escapeHtml(g.label)}">${TOPICS.filter((t) => t.group === g.id)
        .map((t) => `<option value="${t.id}"${filter.topic === t.id ? " selected" : ""}>${escapeHtml(t.label)}(${members.filter((m) => m.topics.includes(t.id)).length}名)</option>`)
        .join("")}</optgroup>`)
      .join("");
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
    const optionHtml = (o) => {
      const on = st.multi ? answers.topics.has(o.id) : answers[st.key] === o.id;
      return `<button type="button" class="diag-option" data-opt="${o.id}" aria-pressed="${on}">${escapeHtml(o.label)}</button>`;
    };
    // 話題はグループごとに見出しをつけて並べる
    $("#diagOptions").innerHTML = st.key === "topics" && typeof TOPIC_GROUPS !== "undefined"
      ? TOPIC_GROUPS
          .map((g) => `<div class="diag-group"><p class="diag-group-label">${escapeHtml(g.label)}</p><div class="diag-group-options">${st.options.filter((o) => o.group === g.id).map(optionHtml).join("")}</div></div>`)
          .join("")
      : st.options.map(optionHtml).join("");
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

  function openDiag() {
    $("#diagOverlay").hidden = false;
    document.body.style.overflow = "hidden";
    if (scores) {
      $("#diagIntro").hidden = true;
      $("#diagWizard").hidden = true;
      $("#diagResults").hidden = false;
      $("#diagResults .diag-title").focus({ preventScroll: true });
    } else {
      startDiagnosis();
    }
  }

  function closeDiag() {
    $("#diagOverlay").hidden = true;
    document.body.style.overflow = "";
  }

  function scrollDiagTop() {
    $("#diagOverlay").scrollTop = 0;
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
    scrollDiagTop();
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

    const ranked = RefScoring.rankMembers(members, answers);

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
    scrollDiagTop();
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
    closeDiag();
    filter.category = "all";
    filter.area = "all";
    filter.search = "";
    filter.topic = "all";
    $("#refSearch").value = "";
    $("#topicSelect").value = "all";
    renderChips();
    renderList();
    const card = document.getElementById(`member-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.add("is-highlight");
    setTimeout(() => card.classList.remove("is-highlight"), 2200);
  }

  // ---------- 自分の情報の記入状況 ----------
  function renderNudge() {
    const me = members.find((m) => m.id === myMemberId);
    const missing = me ? missingProfileItems(me).filter((it) => it.key !== "customers").map((it) => it.label) : [];
    $("#profileNudge").hidden = !missing.length;
    $("#profileNudgeItems").textContent = `未入力:${missing.join("・")}。入力すると紹介されやすくなります。`;
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
      const m = members.find((x) => x.id === copyBtn.dataset.copy);
      const ok = await copyText(introText(m));
      toast(ok ? "紹介文をコピーしました" : "コピーできませんでした");
      return;
    }

    const lineBtn = t.closest("[data-line]");
    if (lineBtn) {
      const m = members.find((x) => x.id === lineBtn.dataset.line);
      const url = "https://line.me/R/share?text=" + encodeURIComponent(introText(m));
      window.open(url, "_blank", "noopener");
      return;
    }

    const gotoBtn = t.closest("[data-goto]");
    if (gotoBtn) { gotoCard(gotoBtn.dataset.goto); return; }
  });

  document.querySelectorAll("[data-open-diag]").forEach((b) => b.addEventListener("click", openDiag));
  $("#diagClose").addEventListener("click", closeDiag);
  $("#diagOverlay").addEventListener("click", (e) => { if (e.target.id === "diagOverlay") closeDiag(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#diagOverlay").hidden) closeDiag();
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
    closeDiag();
    sortByScore = true;
    filter.category = "all";
    filter.area = "all";
    filter.topic = "all";
    $("#topicSelect").value = "all";
    renderChips();
    renderList();
    $("#sortedBanner").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#clearSort").addEventListener("click", () => { sortByScore = false; renderList(); });

  $("#topicSelect").addEventListener("change", (e) => {
    filter.topic = e.target.value;
    renderList();
  });

  $("#refSearch").addEventListener("input", (e) => {
    filter.search = e.target.value;
    renderList();
  });

  // ---------- 初期化(会員限定) ----------
  (async function init() {
    const session = await AuthSession.guardPage({ next: "referral", loginPath: "../login/" });
    if (!session) return;
    const res = await AuthApi.listReferralMembers(AuthSession.getToken());
    members = res.success ? res.data.members : [];
    $("#communityLabel").textContent = COMMUNITY.label;
    const notice = $("#pendingNotice");
    notice.textContent = COMMUNITY.pendingNote;
    notice.hidden = !members.some((m) => !isProfileComplete(m));
    $("#adminLink").hidden = !session.user.isAdmin;
    myMemberId = session.memberId || "";
    $("#demoNote").hidden = AuthApi.isShared();
    renderNudge();
    renderTopicSelect();
    renderChips();
    renderList();
    document.documentElement.classList.remove("guard-pending");
  })();
})();
