// ============================================
// 紹介先早見表 - ロジック
// ・業種/エリア/キーワードでの絞り込み
// ・紹介診断:困りごと → 方法 → 相手の情報(6つの質問)の回答からメンバーごとの一致度(0〜100%)を計算
// ・紹介文のコピー
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
  const filter = { category: "all", area: "all", search: "", topic: "all", offer: false };
  // need: 困りごと(REF_NEEDS の id) / methods: 選んだ方法の番号 / anyTopic: 「まだ分からない」
  // topics・topicGroups は選んだ方法から作る(「その他」のときはジャンルを直接選ぶ)
  const answers = { need: null, methods: new Set(), anyTopic: false, topics: new Set(), topicGroups: [], keyword: "", who: null, industry: null, area: null, meeting: null };
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
    // 本人の自己紹介文があれば、それをそのまま入れる(事業内容などの自動の文は重なるので入れない)
    if (m.selfIntro) {
      if (sc && sc.topicHits.length) {
        lines.push(`「${sc.topicHits.map((t) => labelOf(TOPICS, t)).join("・")}」のお話をされていたので、ぴったりだと思いご紹介します。`);
      }
      if (m.offer) lines.push(`BT-EX5のメンバーからの紹介特典:${m.offer}`);
      lines.push("", "以下、ご本人の自己紹介です。", "", m.selfIntro, "", "ぜひ一度お話ししてみてください。");
      return lines.join("\n");
    }
    if (m.business) lines.push(m.business);
    lines.push("");
    if (sc && sc.topicHits.length) {
      const talk = sc.topicHits.map((t) => labelOf(TOPICS, t)).join("・");
      lines.push(`「${talk}」のお話をされていたので、ぴったりだと思いご紹介します。`);
    }
    if (m.wants) lines.push(`${m.name}さんは「${m.wants}」とのつながりを求めています。`);
    if (m.offer) lines.push(`BT-EX5のメンバーからの紹介特典:${m.offer}`);
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
    if (filter.offer && !m.offer) return false;
    if (filter.category !== "all" && !refInCategory(m, filter.category)) return false;
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

  // カードに出す一致度: 診断の一致度順のときは診断、ジャンルで探すときはそのジャンルの一致度。
  // 一致度は、その順に並んでいるときだけ出す(並び順と%が食い違って見えないように。
  // 代表・役職・役割の基礎ポイントは一致度の中に足してあり、別に上へ上げることはしない)
  let topicScores = null;
  function shownScores() {
    if (sortByScore && scores) return scores;
    if (topicScores) return topicScores;
    return null;
  }

  function cardHtml(m) {
    const all = shownScores();
    const sc = all && all[m.id];
    const hitWords = [
      ...(sc ? sc.keywordHits : []),
      ...keywordTokens(filter.search),
    ];
    // 「こんな話が出たら」はカードでは4つまで(検索に当たった言葉を先に)。全部は詳細で見られる
    const TRIGGER_MAX = 4;
    const triggers = m.triggers
      .map((t) => ({ t, hit: hitWords.some((w) => t.includes(w)) }))
      .sort((a, b) => b.hit - a.hit);
    const triggerHtml = triggers
      .slice(0, TRIGGER_MAX)
      .map(({ t, hit }) => `<span class="ref-trigger${hit ? " hit" : ""}">「${escapeHtml(t)}」</span>`)
      .join("") + (triggers.length > TRIGGER_MAX
      ? `<button type="button" class="ref-trigger-more" data-detail="${m.id}">ほか${triggers.length - TRIGGER_MAX}件</button>` : "");
    const onlineClass = m.online === "all" ? "online-all" : m.online === "none" || m.online === "unknown" ? "online-none" : "";
    // 長い説明は数行で切り、続きは詳細で読む(キーワード検索中は切らない)
    const clamp = filter.search ? "" : " is-clamped";

    return `
      <article class="ref-card${m.id === "yamamoto" ? " is-real" : ""}" id="member-${m.id}">
        <div class="ref-col ref-col-member">
          <div class="ref-card-head">
            <div>
              <h3 class="ref-name"><button type="button" class="ref-name-btn" data-detail="${m.id}">${escapeHtml(m.name)}</button></h3>
              ${roleMark(m.id)}
              <p class="ref-company">${escapeHtml(m.company)}</p>
            </div>
            ${sc ? `<div class="ref-match"><strong>${sc.score}%</strong><small>一致度</small></div>` : ""}
          </div>
          <div class="ref-tags">
            ${m.id === myMemberId ? '<span class="ref-tag me">あなた</span>' : ""}
            <span class="ref-tag">${escapeHtml(m.category)}</span>
            ${m.base && m.base !== "未設定" ? `<span class="ref-tag ${m.base === "新潟" ? "base-niigata" : "base-tokyo"}">${escapeHtml(m.base)}拠点</span>` : ""}
            ${m.team ? `<span class="ref-tag team">${escapeHtml(m.team)}</span>` : ""}
          </div>
          ${genreTags(m, sc, 8)}
          ${linkBadges(m)}
        </div>
        <div class="ref-col ref-col-business">
          <p class="ref-label">事業内容</p>
          <p class="ref-business${m.business ? clamp : " ref-muted"}">${m.business ? escapeHtml(m.business) : "まだ入力されていません"}</p>
          ${m.customers ? `<p class="ref-customers${clamp}"><span>主なお客様</span>${escapeHtml(m.customers)}</p>` : ""}
          ${m.offer ? `<p class="ref-offer"><span>紹介特典</span>${escapeHtml(m.offer)}</p>` : ""}
          ${m.note ? `<p class="ref-note">${escapeHtml(m.note)}</p>` : ""}
        </div>
        <div class="ref-col ref-col-wants">
          <p class="ref-label">求める紹介</p>
          <p class="ref-wants${m.wants ? clamp : " ref-muted"}">${m.wants ? escapeHtml(m.wants) : "まだ入力されていません"}</p>
          <div class="ref-triggers">${triggerHtml}</div>
        </div>
        <div class="ref-col ref-col-range">
          <p class="ref-label">活動範囲</p>
          ${!m.face && (!m.online || m.online === "unknown")
            ? '<p class="ref-range-none ref-muted">未入力</p>'
            : `<dl class="ref-range">
            <dt>対面</dt><dd class="${m.face ? "" : "ref-muted"}">${m.face ? escapeHtml(m.face) : "未入力"}</dd>
            <dt>オンライン</dt><dd class="${onlineClass}">${escapeHtml(ONLINE_LABELS[m.online])}</dd>
          </dl>`}
          <div class="ref-actions">
            <button type="button" class="ref-btn" data-copy="${m.id}">紹介文をコピー</button>
            <button type="button" class="ref-btn ghost" data-detail="${m.id}">詳細・資料を見る</button>
          </div>
        </div>
      </article>`;
  }

  // ---------- 資料・リンク ----------
  const linkType = (id) => (typeof LINK_TYPES !== "undefined" && LINK_TYPES.find((t) => t.id === id)) || { label: "リンク", kind: "web" };
  // サイト内の資料(materials/…)はこのページから見た相対パスにする
  const linkHref = (url) => (/^https:\/\//i.test(url) ? url : "../" + url);

  function linkBadges(m) {
    const links = m.links || [];
    if (!links.length) return "";
    const kinds = [...new Set(links.map((l) => linkType(l.type).kind))];
    const names = { material: "資料あり", web: "HPあり", contact: "SNS・連絡先" };
    return `<button type="button" class="ref-link-badges" data-detail="${m.id}" aria-label="${escapeHtml(m.name)}さんの資料・リンクを見る">${kinds.map((k) => `<span class="ref-link-badge ${k}">${names[k]}</span>`).join("")}</button>`;
  }

  function linkButton(l) {
    const t = linkType(l.type);
    const text = l.label || t.label;
    return `<a class="md-link ${t.kind}" href="${escapeHtml(linkHref(l.url))}" target="_blank" rel="noopener noreferrer"><span class="md-link-type">${escapeHtml(t.label)}</span><span class="md-link-text">${escapeHtml(text)}</span><span class="md-link-go" aria-hidden="true">↗</span></a>`;
  }

  function detailHtml(m) {
    const links = m.links || [];
    const materials = links.filter((l) => linkType(l.type).kind === "material");
    const webs = links.filter((l) => linkType(l.type).kind === "web");
    const contacts = links.filter((l) => linkType(l.type).kind === "contact");
    const section = (title, body) => `<section class="md-sec"><h3>${title}</h3>${body}</section>`;
    const text = (v, empty = "まだ入力されていません") => (v ? `<p>${escapeHtml(v)}</p>` : `<p class="ref-muted">${empty}</p>`);
    const range = [m.face ? `対面:${m.face}` : "", m.online && m.online !== "unknown" ? `オンライン:${ONLINE_LABELS[m.online]}` : ""].filter(Boolean).join(" / ");
    return `
      <header class="md-head">
        <h2 class="md-name" id="detailTitle">${escapeHtml(m.name)}</h2>
        ${roleMark(m.id)}
        <p class="md-company">${escapeHtml(m.company || "")}</p>
        <div class="ref-tags">
          ${m.base && m.base !== "未設定" ? `<span class="ref-tag ${m.base === "新潟" ? "base-niigata" : "base-tokyo"}">${escapeHtml(m.base)}拠点</span>` : ""}
          <span class="ref-tag">${escapeHtml(m.category)}</span>
          ${m.team ? `<span class="ref-tag team">${escapeHtml(m.team)}</span>` : ""}
        </div>
        ${genreTags(m, scores && scores[m.id], 0)}
      </header>
      ${materials.length ? section("資料", materials.map((l) => `
        <a class="md-material" href="${escapeHtml(linkHref(l.url))}" target="_blank" rel="noopener noreferrer">
          ${l.cover ? `<img src="${escapeHtml(linkHref(l.cover))}" alt="" loading="lazy" width="960" height="540">` : ""}
          <span class="md-material-bar"><span>${escapeHtml(l.label || linkType(l.type).label)}</span><span class="md-material-open">開く ↗</span></span>
        </a>`).join("")) : ""}
      ${webs.length ? section("ホームページ・リンク", `<div class="md-links">${webs.map(linkButton).join("")}</div>`) : ""}
      ${contacts.length ? section("連絡先・SNS", `<div class="md-links">${contacts.map(linkButton).join("")}</div>`) : ""}
      ${!links.length ? `<p class="md-nolinks">資料・リンクはまだ登録されていません。</p>` : ""}
      ${m.offer ? `<section class="md-sec md-offer"><h3>BT-EX5 メンバーからの紹介特典</h3><p>${escapeHtml(m.offer)}</p></section>` : ""}
      ${section("事業内容", text(m.business))}
      ${m.selfIntro ? `<details class="md-sec md-intro"><summary>自己紹介(紹介文に入る文章)</summary><p class="md-intro-text">${escapeHtml(m.selfIntro)}</p></details>` : ""}
      ${m.customers ? section("主なお客様", text(m.customers)) : ""}
      ${section("求める紹介", text(m.wants))}
      ${m.triggers.length ? section("こんな話が出たら", `<div class="ref-triggers">${m.triggers.map((t) => `<span class="ref-trigger">「${escapeHtml(t)}」</span>`).join("")}</div>`) : ""}
      ${m.note ? section("補足", text(m.note)) : ""}
      ${section("活動範囲", text(range, "未入力"))}
      ${partnersSection(m)}
      <div class="md-actions">
        <button type="button" class="ref-btn" data-copy="${m.id}">紹介文をコピー</button>
        <button type="button" class="ref-btn ghost" data-close-detail>閉じる</button>
      </div>`;
  }

  // この人と紹介し合えそうな人(詳細画面)
  function partnersSection(m) {
    const ps = RefPartners.findPartners(members, m, 3);
    if (!ps.length) return "";
    return `<section class="md-sec"><h3>この人と紹介し合えそうな人</h3><ul class="md-partners">${ps
      .map((p) => `<li><button type="button" class="md-partner-name" data-detail="${p.m.id}">${escapeHtml(p.m.name)}</button><span>${escapeHtml(p.reasons[0])}</span></li>`)
      .join("")}</ul></section>`;
  }

  // あなたと紹介し合えそうな人(一覧の上)
  function renderPartners() {
    const me = members.find((m) => m.id === myMemberId);
    const ps = RefPartners.findPartners(members, me, 3);
    const box = $("#myPartners");
    box.hidden = !ps.length;
    if (!ps.length) return;
    // 理由は「相手から紹介してもらえそう/あなたから紹介できそう/共通のお客様」の短い言葉で見せる
    const line = (label, words) => (words.length
      ? `<span class="pt-why"><b>${label}</b>${words.slice(0, 3).map((w) => `<span class="pt-word">${escapeHtml(w)}</span>`).join("")}</span>` : "");
    $("#myPartnersList").innerHTML = ps
      .map((p) => `
        <li class="pt-item">
          <button type="button" class="pt-name" data-detail="${p.m.id}">${escapeHtml(p.m.name)}</button>
          ${roleMark(p.m.id, true)}
          <span class="pt-company">${escapeHtml(p.m.company || p.m.category)}</span>
          ${line("あなたへ紹介してもらえそう", p.get)}${line("あなたから紹介できそう", p.give)}${line("共通のお客様", p.shared)}
          ${!p.get.length && !p.give.length && !p.shared.length ? `<span class="pt-why">${escapeHtml(p.reasons[0] || "")}</span>` : ""}
        </li>`)
      .join("");
  }

  // できること(ジャンル)のタグ。押すとそのジャンルで探す。選んでいるジャンル・診断で合ったジャンルは色を変える
  const topicTag = (id) => { const t = TOPICS.find((x) => x.id === id); return t ? t.tag || t.label : ""; };
  function genreTags(m, sc, max) {
    const ids = m.topics.filter((id) => TOPICS.some((t) => t.id === id));
    if (!ids.length) return "";
    const hit = (id) => filter.topic === id || (sc && sc.topicHits.includes(id));
    // 並び: 探しているジャンル → 本業に近いジャンル → 本人が登録した順(先に書いたものほど主な仕事)
    const main = (typeof REF_CATEGORY_TOPICS !== "undefined" && REF_CATEGORY_TOPICS[m.category]) || [];
    const order = (id) => m.topics.indexOf(id);
    const ordered = ids.slice().sort((a, b) => hit(b) - hit(a) || main.includes(b) - main.includes(a) || order(a) - order(b));
    const shown = max ? ordered.slice(0, max) : ordered;
    return `<div class="ref-genres" aria-label="できること">${shown
      .map((id) => `<button type="button" class="ref-genre${hit(id) ? " hit" : ""}" data-genre="${id}" title="「${escapeHtml(labelOf(TOPICS, id))}」で探す">${escapeHtml(topicTag(id))}</button>`)
      .join("")}${ordered.length > shown.length ? `<button type="button" class="ref-genre more" data-detail="${m.id}">+${ordered.length - shown.length}</button>` : ""}</div>`;
  }

  // 代表・役職・役割のマーク(data.js の REF_BASE_POINTS)
  const ROLE_ICONS = {
    leader: '<path d="M2 11.5h12L15 4.5l-3.6 2.7L8 2 4.6 7.2 1 4.5z"/>',
    post: '<path d="M8 1.2 14 3.6v4.1c0 3.5-2.6 6.1-6 7.1-3.4-1-6-3.6-6-7.1V3.6z"/>',
    role: '<path d="m8 1.4 1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.2l-4 2.2 1-4.4-3.4-3 4.5-.5z"/>',
  };
  function roleMark(id, compact) {
    const r = refRoleOf(id);
    if (!r) return "";
    // 「役職」「役割」などの区分の言葉は出さず、マーク(色・形)と肩書きだけを出す
    return `<span class="ref-role ref-role-${r.kind}${compact ? " compact" : ""}" title="${escapeHtml(r.role)}">`
      + `<svg viewBox="0 0 16 16" aria-hidden="true">${ROLE_ICONS[r.kind] || ROLE_ICONS.role}</svg>`
      + `<span class="ref-role-text">${escapeHtml(r.role)}</span></span>`;
  }

  // 一覧の並び順は日替わり(だれもが上に表示される日があるように)。同じ日は同じ順
  function dailyOrder(list) {
    const d = new Date();
    let seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // 検索・診断の前の並び: 1番目は利用者本人。そのあとは役職・役割の基礎ポイント
  // (data.js の REF_BASE_POINTS)の高い順、ほかは日替わり
  function viewerOrder(list) {
    const me = list.filter((m) => m.id === myMemberId);
    const rest = list.filter((m) => m.id !== myMemberId);
    const ranked = rest.filter((m) => refBasePoints(m.id)).sort((a, b) => refBasePoints(b.id) - refBasePoints(a.id));
    return [...me, ...ranked, ...rest.filter((m) => !refBasePoints(m.id))];
  }

  let detailReturnFocus = null;
  function openDetail(id) {
    const m = members.find((x) => x.id === id);
    if (!m) return;
    detailReturnFocus = document.activeElement;
    $("#detailBody").innerHTML = detailHtml(m);
    $("#detailOverlay").hidden = false;
    $("#detailOverlay").scrollTop = 0;
    document.body.style.overflow = "hidden";
    $("#detailClose").focus();
  }
  function closeDetail() {
    $("#detailOverlay").hidden = true;
    document.body.style.overflow = "";
    if (detailReturnFocus && detailReturnFocus.focus) detailReturnFocus.focus();
  }

  function renderList() {
    let list = members.filter(matchesFilter);
    topicScores = null;
    if (sortByScore && scores) {
      list = list.slice().sort((a, b) => scores[b.id].raw - scores[a.id].raw);
    } else if (filter.topic !== "all") {
      // 話題で探すときは、その話題の一致度順(専門の人ほど高く、役職・役割の基礎ポイントも入る)。
      // 同点なら扱う話題が少ない人、そのあとは今の並び(本人・役職・日替わり)
      const answers = RefScoring.topicAnswers(filter.topic, filter.search);
      topicScores = {};
      list.forEach((m) => { topicScores[m.id] = scoreMember(m, answers); });
      list = list.slice().sort((a, b) => topicScores[b.id].raw - topicScores[a.id].raw || a.topics.length - b.topics.length);
    }
    $("#refList").innerHTML = list.length
      ? list.map(cardHtml).join("")
      : '<p class="ref-empty">条件に合うメンバーが見つかりませんでした。<br>キーワードや絞り込みを変えてみてください。</p>';
    $("#countShown").textContent = list.length;
    $("#countTotal").textContent = members.length;
    renderFilterState();
    const diagSorted = !!(sortByScore && scores);
    $("#sortedBanner").hidden = !diagSorted && !topicScores;
    $("#sortedText").textContent = diagSorted
      ? "診断結果の一致度順に表示しています"
      : topicScores ? `「${labelOf(TOPICS, filter.topic)}」の一致度順に表示しています(代表・役職・役割の基礎ポイントを含む)` : "";
    $("#orderNote").hidden = diagSorted || !!topicScores;
  }

  // 選んでいる条件: 閉じた「業種・エリアで絞り込む」にも出し、「条件をすべてクリア」を出す
  function renderFilterState() {
    const areaLabels = { niigata: "新潟で対面可", tokyo: "東京・関東で対面可", online: "オンライン可" };
    const more = [
      filter.category !== "all" ? filter.category : "",
      filter.area !== "all" ? areaLabels[filter.area] : "",
      filter.offer ? "紹介特典あり" : "",
    ].filter(Boolean);
    $("#moreFiltersActive").textContent = more.length ? `選択中:${more.join("・")}` : "";
    $("#clearFilters").hidden = !(more.length || filter.search || filter.topic !== "all");
  }

  function clearFilters() {
    Object.assign(filter, { category: "all", area: "all", search: "", topic: "all", offer: false });
    $("#refSearch").value = "";
    renderTopicSelect();
    renderChips();
    renderList();
  }

  function chipHtml(group, value, label, active) {
    return `<button type="button" class="ref-chip" data-${group}="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
  }

  function renderTopicSelect() {
    $("#topicSelect").innerHTML = '<option value="all">すべてのジャンル</option>' + TOPIC_GROUPS
      .map((g) => `<optgroup label="${escapeHtml(g.label)}">${TOPICS.filter((t) => t.group === g.id)
        .map((t) => `<option value="${t.id}"${filter.topic === t.id ? " selected" : ""}>${escapeHtml(t.label)}(${members.filter((m) => m.topics.includes(t.id)).length}名)</option>`)
        .join("")}</optgroup>`)
      .join("");
  }

  function renderChips() {
    // 業種はまとまりごとに並べる。IT・Web・クリエイティブは細かく分け、その仕事を扱う人も数える
    const count = (c) => members.filter((m) => refInCategory(m, c)).length;
    const grouped = REF_CATEGORY_GROUPS.flatMap((g) => g.categories);
    const rest = REF_CATEGORIES.filter((c) => !grouped.includes(c));
    $("#categoryChips").innerHTML = [
      `<div class="ref-chip-row">${chipHtml("category", "all", "すべて", filter.category === "all")}</div>`,
      ...REF_CATEGORY_GROUPS.map((g, i) => `
        <div class="ref-chip-group">
          <p class="ref-chip-group-label">${escapeHtml(g.label)}</p>
          <div class="ref-chip-row">${(i === REF_CATEGORY_GROUPS.length - 1 ? g.categories.concat(rest) : g.categories)
            .map((c) => chipHtml("category", c, `${c}(${count(c)})`, filter.category === c)).join("")}</div>
        </div>`),
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
    const offerCount = members.filter((m) => m.offer).length;
    // 特典を登録している人がいないうちは、絞り込みを出さない
    $("#offerFilter").hidden = offerCount === 0;
    $("#offerChip").innerHTML = `<button type="button" class="ref-chip" data-offer aria-pressed="${filter.offer}">紹介特典あり(${offerCount}名)</button>`;
  }

  // ---------- 紹介診断 ----------
  const UNKNOWN = { id: "unknown", label: "わからない" };
  const STEPS = [
    { key: "need", q: "紹介したい相手は、何に困っていますか?", hint: "いちばん近いものを1つ選んで「次へ」を押してください(「何をしたいか」で選んでもOKです)", options: REF_NEEDS },
    { key: "topics", q: "どんな方法がよさそうですか?", hint: "当てはまるものをすべて選んで「次へ」を押してください。分からなければ「まだ分からない」でOKです", options: TOPICS, multi: true },
    { key: "who", q: "相手はどんな方ですか?", hint: "1つ選んで「次へ」を押してください。わからなければ「わからない」でOKです", options: [...PROSPECTS, UNKNOWN] },
    { key: "industry", q: "相手の業種は?", hint: "近いものを1つ選んで「次へ」を押してください", options: [...INDUSTRIES, UNKNOWN] },
    { key: "area", q: "相手はどこにいますか?", hint: "主な活動エリアを選んで「次へ」を押してください", options: AREAS },
    { key: "meeting", q: "会うならどの形がよさそうですか?", hint: "相手の希望に近いものを選んで「結果を見る」を押してください", options: MEETINGS },
  ];

  const needOf = () => REF_NEEDS.find((n) => n.id === answers.need) || null;
  const byGenreList = () => { const n = needOf(); return !n || !n.methods; };

  function isAnswered(st) {
    if (st.multi) return byGenreList() ? answers.topics.size > 0 : answers.methods.size > 0 || answers.anyTopic;
    return answers[st.key] !== null;
  }

  // 選んだ方法から、点数に使うジャンルを作る
  function syncTopics() {
    const n = needOf();
    if (!n || !n.methods) { answers.topicGroups = []; return; }
    const chosen = answers.anyTopic ? n.methods : [...answers.methods].sort((a, b) => a - b).map((i) => n.methods[i]);
    answers.topicGroups = chosen.map((x) => x.topics);
    answers.topics = new Set(chosen.flatMap((x) => x.topics));
  }

  const memberCount = (topics) => members.filter((m) => topics.some((t) => m.topics.includes(t))).length;

  function renderStep() {
    const st = STEPS[step];
    $("#diagProgressBar").style.width = `${((step + 1) / STEPS.length) * 100}%`;
    $("#diagStepLabel").textContent = `質問 ${step + 1} / ${STEPS.length}`;
    const need = needOf();
    const genreList = st.key === "topics" && byGenreList();
    $("#diagQuestion").textContent = st.key === "topics" && !genreList ? `「${need.label}」には、どんな方法がよさそうですか?` : genreList ? "どんな話が出ましたか?" : st.q;
    $("#diagHint").textContent = genreList ? "当てはまるジャンルをすべて選んで「次へ」を押してください(複数選択可)" : st.hint;
    const optionHtml = (o) => {
      const on = st.multi ? answers.topics.has(o.id) : answers[st.key] === o.id;
      return `<button type="button" class="diag-option" data-opt="${o.id}" aria-pressed="${on}">${escapeHtml(o.label)}</button>`;
    };
    if (st.key === "need") {
      // 困りごと: 説明つきのカードで並べる
      $("#diagOptions").innerHTML = `<div class="diag-needs">${REF_NEEDS.map((n) => `
        <button type="button" class="diag-option diag-need" data-opt="${n.id}" aria-pressed="${answers.need === n.id}">
          <b>${escapeHtml(n.label)}</b><small>${escapeHtml(n.desc)}</small>
        </button>`).join("")}</div>`;
    } else if (st.key === "topics" && !genreList) {
      // 方法: その困りごとに合う仕事。何人いるかも出す。「まだ分からない」はその課題の方法すべてで探す
      $("#diagOptions").innerHTML = `<div class="diag-methods">${need.methods.map((x, i) => {
        const n = memberCount(x.topics);
        return `<button type="button" class="diag-option diag-method${n ? "" : " is-empty"}" data-opt="m${i}" aria-pressed="${answers.methods.has(i)}">
          <b>${escapeHtml(x.label)}</b>${x.desc ? `<small>${escapeHtml(x.desc)}</small>` : ""}<span class="diag-method-count">${n}名</span>
        </button>`;
      }).join("")}
        <button type="button" class="diag-option diag-method diag-any" data-opt="any" aria-pressed="${answers.anyTopic}">
          <b>まだ分からない(おまかせ)</b><small>上のどれでも対応できる人を探します</small>
        </button></div>`;
    } else if (genreList) {
      // ジャンルはまとまりごとに見出しをつけて並べる
      $("#diagOptions").innerHTML = TOPIC_GROUPS
        .map((g) => `<div class="diag-group"><p class="diag-group-label">${escapeHtml(g.label)}</p><div class="diag-group-options">${st.options.filter((o) => o.group === g.id).map(optionHtml).join("")}</div></div>`)
        .join("");
    } else {
      $("#diagOptions").innerHTML = st.options.map(optionHtml).join("");
    }
    $("#diagKeywordWrap").hidden = !st.multi;
    $("#diagBack").hidden = step === 0;
    $("#diagNext").textContent = step === STEPS.length - 1 ? "結果を見る" : "次へ";
    $("#diagNext").disabled = !isAnswered(st);
  }

  function goStep(n) {
    step = n;
    renderStep();
    // 質問が変わったら上に戻す(選択肢が少ない質問で、下の空いたところを触らないように)
    scrollDiagTop();
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
    answers.need = null;
    answers.methods = new Set();
    answers.anyTopic = false;
    answers.topicGroups = [];
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

    const need = needOf();
    const summary = [
      need && need.methods ? need.label : null,
      ...(need && need.methods
        ? (answers.anyTopic ? ["方法はおまかせ"] : [...answers.methods].sort((a, b) => a - b).map((i) => need.methods[i].label))
        : [...answers.topics].map((t) => labelOf(TOPICS, t))),
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
          <span class="rank-company">${roleMark(m.id, true)}${escapeHtml(m.company)}・${escapeHtml(m.category)}</span>
          <span class="rank-bar"><span style="width:${sc.score}%"></span></span>
          <span class="rank-reasons">${sc.reasons.slice(0, 4).map((r) => `<span>${escapeHtml(r)}</span>`).join("")}</span>
          <span class="rank-actions">
            <button type="button" class="ref-btn" data-copy="${m.id}">紹介文をコピー</button>
            <button type="button" class="ref-btn ghost" data-goto="${m.id}">カードを見る</button>
          </span>
        </li>`)
          .join("")
      : '<p class="diag-empty">一致度の高いメンバーが見つかりませんでした。方法を「まだ分からない」にするか、会い方を「どちらでもよい」にして再診断してみてください。</p>';

    $("#diagWizard").hidden = true;
    $("#diagResults").hidden = false;
    $("#diagResults .diag-title").setAttribute("tabindex", "-1");
    $("#diagResults .diag-title").focus({ preventScroll: true });
    scrollDiagTop();
    renderList();
  }

  function onOptionClick(id) {
    const st = STEPS[step];
    if (st.multi && !byGenreList()) {
      // 方法: 「まだ分からない」とほかの方法は同時に選ばない
      if (id === "any") {
        answers.anyTopic = !answers.anyTopic;
        if (answers.anyTopic) answers.methods.clear();
      } else {
        const i = Number(id.slice(1));
        if (answers.methods.has(i)) answers.methods.delete(i);
        else answers.methods.add(i);
        answers.anyTopic = false;
      }
      syncTopics();
      renderStep();
      return;
    }
    if (st.multi) {
      if (answers.topics.has(id)) answers.topics.delete(id);
      else answers.topics.add(id);
      renderStep();
      return;
    }
    if (st.key === "need" && answers.need !== id) {
      // 困りごとを変えたら、選んでいた方法はリセット
      answers.need = id;
      answers.methods = new Set();
      answers.anyTopic = false;
      answers.topics = new Set();
      answers.topicGroups = [];
    }
    // どの質問も、選んだあとに「次へ」で進む(勝手に次へ進まない)
    answers[st.key] = id;
    renderStep();
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
    const missing = me ? missingProfileItems(me).filter((it) => it.key !== "customers" && it.key !== "offer").map((it) => it.label) : [];
    $("#profileNudge").hidden = !missing.length;
    $("#profileNudgeItems").textContent = `未入力:${missing.join("・")}。入力すると紹介されやすくなります。`;
  }

  // ---------- イベント ----------
  document.addEventListener("click", async (e) => {
    const t = e.target;

    const cat = t.closest("[data-category]");
    if (cat) { filter.category = cat.dataset.category; renderChips(); renderList(); return; }

    if (t.closest("[data-offer]")) { filter.offer = !filter.offer; renderChips(); renderList(); return; }

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

    // ジャンルのタグ: そのジャンルで探す(詳細から押したときは詳細を閉じる)
    const genreBtn = t.closest("[data-genre]");
    if (genreBtn) {
      if (!$("#detailOverlay").hidden) closeDetail();
      sortByScore = false;
      filter.topic = genreBtn.dataset.genre;
      renderTopicSelect();
      renderList();
      $("#refList").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const detailBtn = t.closest("[data-detail]");
    if (detailBtn) { openDetail(detailBtn.dataset.detail); return; }
    if (t.closest("[data-close-detail]")) { closeDetail(); return; }

    const gotoBtn = t.closest("[data-goto]");
    if (gotoBtn) { gotoCard(gotoBtn.dataset.goto); return; }
  });

  document.querySelectorAll("[data-open-diag]").forEach((b) => b.addEventListener("click", openDiag));
  $("#diagClose").addEventListener("click", closeDiag);
  $("#detailClose").addEventListener("click", closeDetail);
  $("#detailOverlay").addEventListener("click", (e) => { if (e.target.id === "detailOverlay") closeDetail(); });
  // 回答中は枠の外を触っても閉じない(閉じるのは × だけ)。結果の画面では枠の外で閉じる
  $("#diagOverlay").addEventListener("click", (e) => {
    if (e.target.id === "diagOverlay" && $("#diagWizard").hidden) closeDiag();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#detailOverlay").hidden) closeDetail();
    else if (!$("#diagOverlay").hidden && $("#diagWizard").hidden) closeDiag();
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
  $("#clearSort").addEventListener("click", () => {
    if (sortByScore && scores) sortByScore = false;
    else { filter.topic = "all"; renderTopicSelect(); }
    renderList();
  });

  $("#clearFilters").addEventListener("click", clearFilters);
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
    myMemberId = session.memberId || "";
    members = viewerOrder(dailyOrder(res.success ? res.data.members : []));
    $("#communityLabel").textContent = COMMUNITY.label;
    // 業種・エリアの絞り込みは、広い画面では最初から開いておく
    $("#moreFilters").open = window.matchMedia("(min-width: 720px)").matches;
    $("#adminLink").hidden = !session.user.isAdmin;
    $("#demoNote").hidden = AuthApi.isShared();
    renderNudge();
    renderPartners();
    renderTopicSelect();
    renderChips();
    renderList();
    document.documentElement.classList.remove("guard-pending");
  })();
})();
