// ============================================
// コミュニティ分析ページ
// 共通のお客様・今回る紹介は名簿から計算し、いると仕事が回る業種(analysis.js)を合わせて表示する
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

  function fillCounts(text) {
    const vars = {
      webCount: members.filter((m) => m.topics.some((t) => t === "web" || t === "ec")).length,
      noWantsCount: members.filter((m) => !m.wants).length,
    };
    return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ""));
  }

  function renderHighlights() {
    $("#tmDate").textContent = `${TEAM_ANALYSIS_DATE}の名簿(${members.length}名)をもとに分析`;
    $("#tmHighlights").innerHTML = TEAM_HIGHLIGHTS
      .map((h) => `<article class="tm-point"><h2>${esc(fillCounts(h.title))}</h2><p>${esc(fillCounts(h.body))}</p></article>`)
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

  // 共通のお客様: 「主なお客様」「求める紹介」に出てくる言葉を、人数の多い順に
  function commonCustomers() {
    const count = {};
    members.forEach((m) => {
      RefPartners.segmentsIn(`${m.customers || ""} ${m.wants || ""}`).forEach((k) => { count[k] = (count[k] || 0) + 1; });
    });
    return Object.entries(count).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }

  // 今コミュニティ内で回る紹介: 紹介し合えそうな2人の組を、相性の高い順に(重複なし)。
  // 多くの人が見えるよう、同じ人は2組まで
  function topPairs(limit) {
    const seen = new Set();
    const pairs = [];
    members.forEach((a) => {
      RefPartners.findPartners(members, a, 3).forEach((p) => {
        const key = [a.id, p.m.id].sort().join("|");
        if (seen.has(key)) return;
        seen.add(key);
        pairs.push({ a, b: p.m, score: p.score, reason: p.reasons[0] });
      });
    });
    const used = {};
    return pairs
      .sort((x, y) => y.score - x.score)
      .filter((p) => {
        if ((used[p.a.id] || 0) >= 2 || (used[p.b.id] || 0) >= 2) return false;
        used[p.a.id] = (used[p.a.id] || 0) + 1;
        used[p.b.id] = (used[p.b.id] || 0) + 1;
        return true;
      })
      .slice(0, limit);
  }

  function renderWhole() {
    const customers = commonCustomers();
    const pairs = topPairs(8);
    const top = NEEDED_ROLES.filter((r) => r.priority === 1).slice(0, 3);
    $("#tmWhole").innerHTML = `
      <header class="tm-team-head">
        <h2 class="tm-team-name">BT-EX5 全体</h2>
        <span class="tm-team-count">${members.length}名</span>
      </header>
      <div class="tm-grid">
        <section class="tm-col">
          <h3 class="tm-h3">共通のお客様(名簿に多く出てくる順)</h3>
          <ul class="tm-tags">${customers.map(([k, n]) => `<li>${esc(k)}<small>${n}名</small></li>`).join("")}</ul>
          <h3 class="tm-h3">今コミュニティ内で回る紹介</h3>
          ${pairs.length
            ? `<ul class="tm-flows">${pairs.map((p) => `<li><span class="tm-flow-who">${person(p.a.id)}<span class="tm-arrow" aria-label="と">⇄</span>${person(p.b.id)}</span><span class="tm-flow-what">${esc(p.reason)}</span></li>`).join("")}</ul>`
            : '<p class="tm-none">まだありません(「求める紹介」が入ると出てきます)</p>'}
        </section>
        <section class="tm-col tm-needs">
          <h3 class="tm-h3">この人がいると仕事が回る(特に効果が大きい3つ)</h3>
          <ol class="tm-need-list">
            ${top.map((n) => `
              <li>
                <p class="tm-role">${esc(n.role)}</p>
                <p class="tm-why">${esc(n.why)}</p>
                ${n.gives.some(byId) ? `<p class="tm-gives"><span>紹介し合える人</span>${people(n.gives)}</p>` : ""}
              </li>`).join("")}
          </ol>
          <a class="tm-more" href="#tmNeedsTitle">必要な業種をすべて見る(${NEEDED_ROLES.length}業種)↓</a>
        </section>
      </div>
      <p class="tm-note">Web・集客の人が多いので、LINE/女性向けブランディング/SEO・MEO/EC/Canva・LP/AIシステムと得意分野を分けて紹介すると、ぶつからずに回ります。</p>`;
  }

  function renderNeeds() {
    $("#tmNeeds").innerHTML = [1, 2, 3].map((p) => {
      const list = NEEDED_ROLES.filter((r) => r.priority === p);
      return `
        <section class="tm-need-group">
          <h3 class="tm-need-group-title">${esc(NEEDED_PRIORITY_LABELS[p])}<small>${list.length}業種</small></h3>
          <ul class="tm-role-grid">
            ${list.map((n) => `
              <li class="tm-role-card">
                <p class="tm-role">${esc(n.role)}</p>
                <p class="tm-why">${esc(n.why)}</p>
                ${n.gives.some(byId) ? `<p class="tm-gives"><span>紹介し合える人</span>${people(n.gives)}</p>` : ""}
              </li>`).join("")}
          </ul>
        </section>`;
    }).join("");
  }

  (async function init() {
    const session = await AuthSession.guardPage({ next: "teams", loginPath: "../login/" });
    if (!session) return;
    const res = await AuthApi.listReferralMembers(AuthSession.getToken());
    members = res.success ? res.data.members : [];
    renderHighlights();
    renderFields();
    renderWhole();
    renderNeeds();
    document.documentElement.classList.remove("guard-pending");
  })();
})();
