// ============================================
// チーム分析ページ
// 分析の文(analysis.js)と、名簿(サーバー層)を合わせて表示する
// ============================================

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let members = [];
  const byId = (id) => members.find((m) => m.id === id);

  function person(id) {
    const m = byId(id);
    return m ? `<span class="tm-person">${esc(m.name)}</span>` : "";
  }
  function people(ids) {
    return ids.map(person).filter(Boolean).join("");
  }

  function teamMembers(team) {
    return members.filter((m) => (m.team || "") === team);
  }

  function fillCounts(text) {
    const teams = {};
    members.forEach((m) => { if (m.team) teams[m.team] = (teams[m.team] || 0) + 1; });
    const sorted = Object.entries(teams).sort((a, b) => b[1] - a[1]);
    const others = sorted.slice(1).map(([, n]) => n);
    const vars = {
      webCount: members.filter((m) => m.topics.some((t) => t === "web" || t === "ec")).length,
      noTeamCount: members.filter((m) => !m.team).length,
      largestTeam: sorted[0] ? sorted[0][0] : "",
      largestCount: sorted[0] ? sorted[0][1] : 0,
      otherRange: others.length ? (Math.min(...others) === Math.max(...others) ? `${others[0]}` : `${Math.min(...others)}〜${Math.max(...others)}`) : "0",
    };
    return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ""));
  }

  function renderHighlights() {
    $("#tmDate").textContent = `${TEAM_ANALYSIS_DATE}の名簿(${members.length}名)をもとに分析`;
    $("#tmHighlights").innerHTML = TEAM_HIGHLIGHTS
      .map((h) => `<article class="tm-point"><h2>${esc(h.title)}</h2><p>${esc(fillCounts(h.body))}</p></article>`)
      .join("");
  }

  function renderFields() {
    const counts = REF_CATEGORIES.map((c) => ({ c, n: members.filter((m) => m.category === c).length }));
    const max = Math.max(1, ...counts.map((x) => x.n));
    $("#tmFields").innerHTML = counts
      .map(({ c, n }) => `
        <li class="${n === 0 ? "is-empty" : ""}" title="${esc(c)}:${n}名">
          <span class="tm-field-name">${esc(c)}</span>
          <span class="tm-field-bar"><span style="width:${(n / max) * 100}%"></span></span>
          <span class="tm-field-num">${n === 0 ? "0名(空き)" : `${n}名`}</span>
        </li>`)
      .join("");
  }

  function teamLabel(t) { return t.team || t.label; }

  function renderTeams() {
    const list = TEAM_ANALYSIS.filter((t) => teamMembers(t.team).length);
    $("#tmJump").innerHTML = list
      .map((t, i) => `<a href="#team-${i}">${esc(teamLabel(t))}<small>${teamMembers(t.team).length}名</small></a>`)
      .join("");
    $("#tmTeams").innerHTML = list.map((t, i) => {
      const ms = teamMembers(t.team);
      const flows = t.flows.filter((f) => f.from.some(byId) && f.to.some(byId));
      const fits = t.fits.filter((f) => byId(f.id) && (byId(f.id).team || "") !== t.team);
      return `
      <article class="tm-team" id="team-${i}" aria-labelledby="team-${i}-title">
        <header class="tm-team-head">
          <h2 class="tm-team-name" id="team-${i}-title">${esc(teamLabel(t))}</h2>
          <span class="tm-team-count">${ms.length}名</span>
        </header>
        <div class="tm-members">${ms.map((m) => `<span class="tm-person">${esc(m.name)}</span>`).join("")}</div>

        <div class="tm-grid">
          <section class="tm-col">
            <h3 class="tm-h3">共通のお客様</h3>
            <ul class="tm-tags">${t.customers.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
            <h3 class="tm-h3">今チーム内で回る紹介</h3>
            ${flows.length
              ? `<ul class="tm-flows">${flows.map((f) => `<li><span class="tm-flow-who">${people(f.from)}<span class="tm-arrow" aria-label="から">→</span>${people(f.to)}</span><span class="tm-flow-what">${esc(f.text)}</span></li>`).join("")}</ul>`
              : '<p class="tm-none">まだありません(下の役割の人が入ると回り始めます)</p>'}
          </section>

          <section class="tm-col tm-needs">
            <h3 class="tm-h3">この人がいると仕事が回る</h3>
            <ol class="tm-need-list">
              ${t.needs.map((n) => `
                <li>
                  <p class="tm-role">${esc(n.role)}</p>
                  <p class="tm-why">${esc(n.why)}</p>
                  ${n.gives.some(byId) ? `<p class="tm-gives"><span>紹介し合える人</span>${people(n.gives)}</p>` : ""}
                </li>`).join("")}
            </ol>
          </section>
        </div>

        ${fits.length ? `<div class="tm-fit"><h3 class="tm-h3">系列のない人で合いそうな人</h3>${fits.map((f) => `<p>${person(f.id)}${esc(f.why)}</p>`).join("")}</div>` : ""}
        ${t.note ? `<p class="tm-note">${esc(t.note)}</p>` : ""}
      </article>`;
    }).join("");
  }

  (async function init() {
    const session = await AuthSession.guardPage({ next: "teams", loginPath: "../login/" });
    if (!session) return;
    const res = await AuthApi.listReferralMembers(AuthSession.getToken());
    members = res.success ? res.data.members : [];
    renderHighlights();
    renderFields();
    renderTeams();
    document.documentElement.classList.remove("guard-pending");
  })();
})();
