// ============================================
// 交流会マッチング - アプリケーションロジック
//
// メンバー・いいね・マッチング・メッセージはすべて AuthApi
// (auth/api.js)経由で取得・更新する。メッセージの閲覧・送信は
// サーバー層(mock-server / 実API)がマッチング済みの2者のみに
// 制限しており、画面側はその結果を表示するだけにする。
// 別タブ・別アカウントでの更新は BroadcastChannel / storage
// イベント+ポーリングで即時反映する。
// ============================================

(function () {
  "use strict";

  // ---------- 状態 ----------
  const SKIP_KEY = "kouryukai.skips";
  const JOIN_KEY = "kouryukai.joins";

  let roster = [];        // 自分以外のメンバー一覧(サーバー取得)
  let matches = [];       // マッチ済みの相手(サーバー取得)
  let knownMatchedIds = null; // マッチ通知用(前回のマッチ集合)
  let knownUnreadTotal = 0;
  let skippedIds = loadSet(SKIP_KEY);
  let joinedEvents = loadSet(JOIN_KEY);
  let activeTag = null;
  let searchQuery = "";
  let activeCategory = CATEGORIES[0];
  let sortMode = "score";
  let calYear = 2026;
  let calMonth = 7; // 1-12
  let deckAnimating = false;

  let openChatId = null;      // 開いているチャットの相手 userId
  let chatPollTimer = null;
  let lastChatRender = "";    // 差分検出用

  const token = () => AuthSession.getToken();

  function loadSet(key) {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      return new Set();
    }
  }
  function saveSet(key, set) {
    localStorage.setItem(key, JSON.stringify([...set]));
  }

  // ---------- ユーティリティ ----------
  const $ = (sel) => document.querySelector(sel);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function strHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  // userId から決まる擬似「相性スコア」(72〜98%)
  function score(userId) {
    return 72 + (strHash(String(userId)) % 27);
  }

  function memberById(userId) {
    return roster.find((m) => m.userId === userId) || matches.find((m) => m.userId === userId);
  }

  let toastTimer = null;
  function showToast(msg) {
    const toast = $("#toast");
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  // ---------- サーバーからの読み込み ----------
  async function loadRoster() {
    const res = await AuthApi.listMembers(token());
    if (!res.success) return;
    roster = res.data.members;
    renderAll();
  }

  async function refreshMatches(options) {
    const res = await AuthApi.getMatches(token());
    if (!res.success) return;
    const prevIds = knownMatchedIds;
    matches = res.data.matches;

    // 新しくマッチした相手を通知(相手側のいいねで成立した場合もここで気付ける)
    const currentIds = new Set(matches.map((m) => m.userId));
    if (prevIds) {
      for (const m of matches) {
        if (!prevIds.has(m.userId) && !(options && options.silent)) {
          showToast(`🎉 ${m.name}さんとマッチングしました!`);
        }
      }
    }
    knownMatchedIds = currentIds;

    // 未読バッジ(開いているチャットの分は除く)
    const unreadTotal = matches.reduce(
      (sum, m) => sum + (m.userId === openChatId ? 0 : m.unreadCount), 0
    );
    if (unreadTotal > knownUnreadTotal && prevIds && !(options && options.silent)) {
      const noisy = matches.find((m) => m.unreadCount > 0 && m.userId !== openChatId);
      if (noisy) showToast(`💬 ${noisy.name}さんから新着メッセージ`);
    }
    knownUnreadTotal = unreadTotal;
    const badge = $("#unreadCount");
    badge.textContent = unreadTotal;
    badge.classList.toggle("badge-hide", unreadTotal === 0);
  }

  // ---------- メンバーカード ----------
  function memberCard(m) {
    return `
      <article class="member-card ${m.isPickup ? "pickup" : ""}" data-id="${m.userId}">
        <span class="card-score">相性 ${score(m.userId)}%</span>
        ${m.isPickup ? '<span class="pickup-label">PICK UP</span>' : ""}
        ${!m.isBot ? '<span class="pickup-label member-label">会員</span>' : ""}
        <div class="card-top">
          <div class="avatar">${m.avatar}</div>
          <div>
            <div class="member-name">${escapeHtml(m.name)}</div>
            <div class="member-company">${escapeHtml(m.company)}</div>
          </div>
        </div>
        <div class="member-tags">
          <span class="tag">${escapeHtml(m.category)}</span>
          ${m.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          ${m.likesMe && !m.matched ? '<span class="tag likes-me">♥ あなたにいいね</span>' : ""}
          ${m.matched ? '<span class="tag likes-me">🎉 マッチング済み</span>' : ""}
        </div>
        <p class="member-bio">${escapeHtml(m.bio)}</p>
        <div class="card-actions">
          ${m.matched
            ? `<button class="like-btn liked" data-chat-with="${m.userId}">💬 メッセージ</button>`
            : `<button class="like-btn ${m.likedByMe ? "liked" : ""}" data-like="${m.userId}">
                ${m.likedByMe ? "♥ いいね済み" : "♡ 話してみたい"}
              </button>`}
          <button class="detail-btn" data-detail="${m.userId}">詳細</button>
        </div>
      </article>`;
  }

  function matchesFilter(m) {
    if (activeTag && m.category !== activeTag) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [m.name, m.company, m.category, m.bio, m.interest, ...m.tags]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }

  function renderGrids() {
    const filtered = roster.filter(matchesFilter);

    // 新着: 登録会員(新しい順)を先頭に、サンプルの新着メンバーを続ける
    const newMembers = filtered
      .filter((m) => m.isNew)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    $("#newMembersGrid").innerHTML = newMembers.length
      ? newMembers.map(memberCard).join("")
      : '<p class="empty-note">条件に合う新着メンバーが見つかりませんでした。</p>';

    const pickups = filtered.filter((m) => m.isPickup);
    $("#pickupGrid").innerHTML = pickups.length
      ? pickups.map(memberCard).join("")
      : '<p class="empty-note">条件に合うピックアップメンバーが見つかりませんでした。</p>';

    let inCategory = roster.filter(
      (m) => m.category === activeCategory && matchesFilter(m)
    );
    inCategory = inCategory.slice().sort((a, b) =>
      sortMode === "score"
        ? score(b.userId) - score(a.userId)
        : (b.createdAt || 0) - (a.createdAt || 0)
    );
    $("#categoryGrid").innerHTML = inCategory.length
      ? inCategory.map(memberCard).join("")
      : '<p class="empty-note">このカテゴリのメンバーが見つかりませんでした。</p>';

    $("#likedCount").textContent = roster.filter((m) => m.likedByMe).length;
  }

  // ---------- タグフィルタ・カテゴリタブ ----------
  function renderTagFilters() {
    $("#tagFilters").innerHTML = CATEGORIES.map(
      (c) =>
        `<button class="tag-filter ${activeTag === c ? "active" : ""}" data-tag="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ).join("");
  }

  function renderCategoryTabs() {
    $("#categoryTabs").innerHTML = CATEGORIES.map(
      (c) =>
        `<button class="category-tab ${activeCategory === c ? "active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ).join("");
  }

  // ---------- 今日のおすすめ(カードデッキ) ----------
  function deckQueue() {
    return roster
      .filter((m) => !m.likedByMe && !m.matched && !skippedIds.has(m.userId))
      .slice()
      .sort((a, b) => score(b.userId) - score(a.userId));
  }

  function renderDeck() {
    const queue = deckQueue();
    const deck = $("#deck");
    if (!queue.length) {
      deck.innerHTML = `
        <div class="deck-empty">
          <span class="big">🍵</span>
          <p>今日のおすすめは以上です。<br>また明日チェックしてみてください。</p>
          <button class="btn btn-ghost" id="deckReset">もう一度見る</button>
        </div>`;
      return;
    }
    deck.innerHTML = queue
      .slice(0, 3)
      .map((m, i) => {
        const cls = i === 0 ? "" : ` behind-${i}`;
        return `
        <div class="deck-card${cls}" data-deck-id="${m.userId}" style="z-index:${10 - i}">
          <span class="score-chip">相性 ${score(m.userId)}%</span>
          <div class="avatar">${m.avatar}</div>
          <h3>${escapeHtml(m.name)}</h3>
          <div class="member-company">${escapeHtml(m.company)}</div>
          <div class="member-tags">
            <span class="tag">${escapeHtml(m.category)}</span>
            ${m.tags.slice(0, 3).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          </div>
          <p class="member-bio">${escapeHtml(m.bio)}</p>
        </div>`;
      })
      .reverse()
      .join("");
  }

  function deckAction(like) {
    if (deckAnimating) return;
    const queue = deckQueue();
    if (!queue.length) return;
    const top = queue[0];
    const el = document.querySelector(`#deck [data-deck-id="${top.userId}"]`);
    if (!el) return;
    deckAnimating = true;
    el.classList.add(like ? "fly-right" : "fly-left");
    setTimeout(async () => {
      deckAnimating = false;
      if (like) {
        await likeMember(top.userId, { fromDeck: true });
      } else {
        skippedIds.add(top.userId);
        saveSet(SKIP_KEY, skippedIds);
      }
      renderDeck();
      renderGrids();
    }, 330);
  }

  // ---------- いいね・マッチング ----------
  async function likeMember(userId, opts = {}) {
    const m = memberById(userId);
    if (!m) return;

    const res = await AuthApi.sendLike(token(), userId);
    if (!res.success) {
      showToast(res.error.userMessage);
      return;
    }

    m.likedByMe = res.data.liked;
    m.matched = res.data.matched;
    skippedIds.delete(userId);
    saveSet(SKIP_KEY, skippedIds);
    renderAll();
    refreshMatches({ silent: true });

    if (!res.data.liked) {
      showToast(`${m.name}さんへのいいねを取り消しました`);
      return;
    }
    if (res.data.matched) {
      knownMatchedIds = knownMatchedIds || new Set();
      knownMatchedIds.add(userId);
      $("#matchText").textContent = `${m.name}さん(${m.company || m.category})とマッチングしました!メッセージを送って交流を始めましょう。`;
      $("#matchChatBtn").dataset.chatWith = userId;
      openModal("#matchModal");
    } else {
      showToast(`${m.name}さんに「話してみたい」を送りました ♥`);
    }
  }

  // ---------- モーダル ----------
  function openModal(sel) {
    $(sel).hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModals() {
    document.querySelectorAll(".modal-overlay").forEach((el) => (el.hidden = true));
    document.body.style.overflow = "";
    stopChat();
  }

  function showProfile(userId) {
    const m = memberById(userId);
    if (!m) return;
    $("#profileModalBody").innerHTML = `
      <div class="profile-detail">
        <div class="avatar">${m.avatar}</div>
        <h3>${escapeHtml(m.name)}</h3>
        <div class="member-company">${escapeHtml(m.company)}</div>
        <div class="member-tags">
          <span class="tag">${escapeHtml(m.category)}</span>
          ${m.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          <span class="tag" style="border-color:var(--accent);color:var(--accent)">相性 ${score(m.userId)}%</span>
          ${m.likesMe && !m.matched ? '<span class="tag likes-me">♥ あなたにいいね</span>' : ""}
        </div>
        <div class="full-bio">${escapeHtml(m.bio) || "よろしくお願いします。"}</div>
        ${m.interest ? `<p class="interest"><strong>こんな人と話したい:</strong> ${escapeHtml(m.interest)}</p>` : ""}
        ${m.matched
          ? `<button class="btn btn-primary btn-block" data-chat-with="${m.userId}">💬 メッセージを送る</button>`
          : `<button class="like-btn ${m.likedByMe ? "liked" : ""}" data-like="${m.userId}" style="width:100%; padding:12px 0; font-size:15px;">
              ${m.likedByMe ? "♥ いいね済み" : "♡ 話してみたい"}
            </button>`}
      </div>`;
    openModal("#profileModal");
  }

  function showLikedList() {
    const liked = roster.filter((m) => m.likedByMe || m.matched);
    $("#likedListBody").innerHTML = liked.length
      ? liked
          .map((m) => `
        <div class="liked-row">
          <div class="avatar">${m.avatar}</div>
          <div class="liked-info">
            <div class="member-name">${escapeHtml(m.name)} ${m.matched ? "🎉" : ""}</div>
            <div class="member-company">${escapeHtml(m.company || m.category)}${m.matched ? " ・マッチング済み" : ""}</div>
          </div>
          ${m.matched ? `<button class="join-btn" data-chat-with="${m.userId}">💬 話す</button>` : ""}
          ${m.likedByMe && !m.matched ? `<button class="unlike-btn" data-unlike="${m.userId}">取り消す</button>` : ""}
        </div>`)
          .join("")
      : '<p class="empty-note">まだ誰にもいいねしていません。気になるメンバーに「話してみたい」を送ってみましょう。</p>';
    openModal("#likedModal");
  }

  // ---------- メッセージ(チャット / LINE風) ----------
  const STAMPS = ["👍", "😊", "🎉", "🙏", "🍻", "❤️"];

  function fmtTime(ms) {
    const d = new Date(ms);
    return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function fmtDate(ms) {
    const d = new Date(ms);
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    if (d.toDateString() === now.toDateString()) return "今日";
    if (d.toDateString() === yesterday.toDateString()) return "昨日";
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function renderMessagesHtml(m, messages) {
    if (!messages.length) {
      return '<p class="chat-empty-note">🎉 マッチング成立!最初のメッセージを送ってみましょう。</p>';
    }
    let html = "";
    let lastDate = "";
    for (const msg of messages) {
      const dstr = fmtDate(msg.at);
      if (dstr !== lastDate) {
        html += `<div class="date-chip"><span>${escapeHtml(dstr)}</span></div>`;
        lastDate = dstr;
      }
      const time = fmtTime(msg.at);
      const body = msg.stamp
        ? `<div class="chat-stamp">${escapeHtml(msg.text)}</div>`
        : `<div class="chat-bubble ${msg.mine ? "me" : "them"}">${escapeHtml(msg.text)}</div>`;
      if (msg.mine) {
        html += `<div class="msg-row me"><span class="msg-meta">${msg.read ? "既読<br>" : ""}${time}</span>${body}</div>`;
      } else {
        html += `<div class="msg-row them"><div class="msg-avatar">${m.avatar}</div>${body}<span class="msg-meta">${time}</span></div>`;
      }
    }
    return html;
  }

  async function refreshChatMessages() {
    if (openChatId === null || $("#chatModal").hidden) return;
    const m = memberById(openChatId);
    if (!m) return;
    const res = await AuthApi.getMessages(token(), openChatId);
    if (!res.success) {
      if (res.error.code === "FORBIDDEN") {
        showToast(res.error.userMessage);
        closeModals();
      }
      return;
    }
    const html = renderMessagesHtml(m, res.data.messages);
    if (html !== lastChatRender) {
      lastChatRender = html;
      const box = $("#chatMessages");
      if (box) {
        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
      }
    }
  }

  function stopChat() {
    openChatId = null;
    lastChatRender = "";
    if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; }
  }

  async function showChat(userId) {
    const m = memberById(userId);
    if (!m || !m.matched) {
      showToast(AuthMockServer.ERRORS.FORBIDDEN);
      return;
    }
    openChatId = userId;
    lastChatRender = "";
    $("#chatBody").innerHTML = `
      <div class="chat-header">
        <button class="chat-back" data-chat-back title="一覧へ戻る">‹</button>
        <div class="avatar">${m.avatar}</div>
        <div>
          <div class="chat-header-name">${escapeHtml(m.name)}</div>
          <div class="chat-header-company">${escapeHtml(m.company || m.category)}</div>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages"></div>
      <div class="stamp-row">
        ${STAMPS.map((s) => `<button type="button" class="stamp-btn" data-stamp="${s}" title="スタンプを送る">${s}</button>`).join("")}
      </div>
      <form class="chat-input-row" id="chatForm">
        <input type="text" id="chatInput" placeholder="メッセージを入力…" autocomplete="off">
        <button type="submit" class="btn btn-primary">送信</button>
      </form>`;
    openModal("#chatModal");
    await refreshChatMessages();
    refreshMatches({ silent: true });
    if (chatPollTimer) clearInterval(chatPollTimer);
    chatPollTimer = setInterval(refreshChatMessages, 2500);
    $("#chatInput").focus();
  }

  function showTypingIndicator() {
    const m = memberById(openChatId);
    const box = $("#chatMessages");
    if (!m || !box || document.getElementById("typingRow")) return;
    box.insertAdjacentHTML(
      "beforeend",
      `<div class="msg-row them" id="typingRow">
        <div class="msg-avatar">${m.avatar}</div>
        <div class="chat-bubble them typing"><span></span><span></span><span></span></div>
      </div>`
    );
    box.scrollTop = box.scrollHeight;
  }

  async function sendChat(text, isStamp) {
    if (openChatId === null || !text.trim()) return;
    const m = memberById(openChatId);
    const res = await AuthApi.sendMessage(token(), openChatId, text.trim(), isStamp === true);
    if (!res.success) {
      showToast(res.error.userMessage);
      return;
    }
    await refreshChatMessages();
    if (m && m.isBot) {
      setTimeout(showTypingIndicator, 500);
      setTimeout(refreshChatMessages, 1500);
    }
  }

  async function showChatList() {
    await refreshMatches({ silent: true });
    $("#chatBody").innerHTML = `
      <div class="chat-list">
        <h3 class="chat-list-title">💬 メッセージ</h3>
        ${matches.length
          ? matches
              .map((m) => {
                const last = m.lastMessage
                  ? (m.lastMessage.mine ? "自分: " : "") + m.lastMessage.text
                  : "マッチングしました!メッセージを送ってみましょう";
                return `
            <div class="chat-partner-row" data-chat-with="${m.userId}">
              <div class="avatar">${m.avatar}</div>
              <div style="flex:1; min-width:0;">
                <div class="member-name">${escapeHtml(m.name)}</div>
                <div class="last-msg">${escapeHtml(last)}</div>
              </div>
              ${m.unreadCount ? `<span class="badge">${m.unreadCount}</span>` : ""}
            </div>`;
              })
              .join("")
          : '<p class="empty-note">まだマッチングした相手がいません。<br>「話してみたい」を送ってマッチングするとメッセージできます。</p>'}
      </div>`;
    openModal("#chatModal");
  }

  // ---------- リアルタイム同期 ----------
  let syncTimer = null;
  function onDbChanged() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      loadRoster();
      refreshMatches();
      refreshChatMessages();
    }, 200);
  }

  window.addEventListener("storage", (e) => {
    if (e.key === "kouryukai-auth-db") onDbChanged();
  });
  try {
    const bc = new BroadcastChannel("kouryukai-sync");
    bc.onmessage = onDbChanged;
  } catch { /* BroadcastChannel 非対応環境 */ }

  // フォールバックの定期同期
  setInterval(() => {
    if (document.visibilityState === "visible") refreshMatches({ silent: false });
  }, 8000);

  // ---------- カレンダー ----------
  function eventKey(e) {
    return `${e.year}-${e.month}-${e.day}`;
  }
  function baseAttendees(e) {
    return 8 + ((e.day * 7 + e.month * 3) % 18);
  }

  function renderCalendar() {
    $("#calendarTitle").textContent = `${calYear}年 ${calMonth}月`;

    const dows = ["日", "月", "火", "水", "木", "金", "土"];
    let html = dows
      .map((d, i) => `<div class="cal-dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${d}</div>`)
      .join("");

    const first = new Date(calYear, calMonth - 1, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const today = new Date();

    for (let i = 0; i < startDow; i++) html += '<div class="cal-day other"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const ev = EVENTS.find((e) => e.year === calYear && e.month === calMonth && e.day === d);
      const isToday =
        today.getFullYear() === calYear &&
        today.getMonth() + 1 === calMonth &&
        today.getDate() === d;
      html += `<div class="cal-day ${ev ? "has-event" : ""} ${isToday ? "today" : ""}" ${ev ? `title="${escapeHtml(ev.name)}"` : ""}>
        ${d}${ev ? '<span class="event-dot">●</span>' : ""}
      </div>`;
    }
    $("#calendar").innerHTML = html;

    const monthEvents = EVENTS.filter((e) => e.year === calYear && e.month === calMonth);
    $("#eventList").innerHTML = monthEvents.length
      ? monthEvents
          .map((e) => {
            const key = eventKey(e);
            const joined = joinedEvents.has(key);
            const count = baseAttendees(e) + (joined ? 1 : 0);
            return `
      <div class="event-item">
        <div class="event-date">${e.month}/${e.day}<small>${dows[new Date(e.year, e.month - 1, e.day).getDay()]}曜</small></div>
        <div class="event-main">
          <div class="event-name">${escapeHtml(e.name)}</div>
          <div class="event-place">${escapeHtml(e.place)}</div>
        </div>
        <div class="event-meta">
          <span class="event-attendees">👥 ${count}名参加予定</span>
          <button class="join-btn ${joined ? "joined" : ""}" data-join="${key}">${joined ? "✓ 参加予定" : "参加する"}</button>
        </div>
      </div>`;
          })
          .join("")
      : '<p class="empty-note">この月に予定されているイベントはありません。</p>';
  }

  function changeMonth(delta) {
    calMonth += delta;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    if (calMonth < 1) { calMonth = 12; calYear--; }
    renderCalendar();
  }

  // ---------- 実績カウントアップ ----------
  function setupStats() {
    const nums = document.querySelectorAll(".stat-num");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const el = entry.target;
        const target = Number(el.dataset.count);
        const dur = 1100;
        const start = performance.now();
        function tick(now) {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased).toLocaleString();
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    nums.forEach((el) => io.observe(el));
  }

  // ---------- スクロールリビール ----------
  function setupReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  // ---------- 描画まとめ ----------
  function renderAll() {
    renderTagFilters();
    renderCategoryTabs();
    renderGrids();
    renderDeck();
  }

  // ---------- イベント委譲 ----------
  document.addEventListener("click", (e) => {
    const chatWith = e.target.closest("[data-chat-with]");
    if (chatWith) {
      e.stopPropagation();
      closeModals();
      showChat(chatWith.dataset.chatWith);
      return;
    }

    if (e.target.closest("[data-chat-back]")) { stopChat(); showChatList(); return; }

    const stampBtn = e.target.closest("[data-stamp]");
    if (stampBtn) {
      sendChat(stampBtn.dataset.stamp, true);
      return;
    }

    const likeBtn = e.target.closest("[data-like]");
    if (likeBtn) {
      e.stopPropagation();
      const inProfile = !!likeBtn.closest("#profileModal");
      const userId = likeBtn.dataset.like;
      likeMember(userId).then(() => { if (inProfile) showProfile(userId); });
      return;
    }

    const detailBtn = e.target.closest("[data-detail]");
    if (detailBtn) {
      e.stopPropagation();
      showProfile(detailBtn.dataset.detail);
      return;
    }

    const unlikeBtn = e.target.closest("[data-unlike]");
    if (unlikeBtn) {
      likeMember(unlikeBtn.dataset.unlike).then(showLikedList);
      return;
    }

    const joinBtn = e.target.closest("[data-join]");
    if (joinBtn) {
      const key = joinBtn.dataset.join;
      if (joinedEvents.has(key)) {
        joinedEvents.delete(key);
        showToast("参加予定を取り消しました");
      } else {
        joinedEvents.add(key);
        showToast("参加予定に登録しました!当日お会いしましょう 🍻");
      }
      saveSet(JOIN_KEY, joinedEvents);
      renderCalendar();
      return;
    }

    if (e.target.closest("#deckReset")) {
      skippedIds.clear();
      saveSet(SKIP_KEY, skippedIds);
      renderDeck();
      return;
    }

    const card = e.target.closest(".member-card");
    if (card) {
      showProfile(card.dataset.id);
      return;
    }

    const deckCard = e.target.closest(".deck-card:not(.behind-1):not(.behind-2)");
    if (deckCard) {
      showProfile(deckCard.dataset.deckId);
      return;
    }

    const tagBtn = e.target.closest("[data-tag]");
    if (tagBtn) {
      activeTag = activeTag === tagBtn.dataset.tag ? null : tagBtn.dataset.tag;
      renderTagFilters();
      renderGrids();
      return;
    }

    const catBtn = e.target.closest("[data-cat]");
    if (catBtn) {
      activeCategory = catBtn.dataset.cat;
      renderCategoryTabs();
      renderGrids();
      return;
    }

    if (e.target.closest("[data-close]")) { closeModals(); return; }
    if (e.target.classList.contains("modal-overlay")) { closeModals(); return; }
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id === "chatForm") {
      e.preventDefault();
      const input = $("#chatInput");
      const text = input.value;
      input.value = "";
      sendChat(text, false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModals();
      if ($("#drawer").classList.contains("open")) {
        $("#drawer").classList.remove("open");
        $("#menuBtn").classList.remove("open");
        $("#drawerOverlay").hidden = true;
        $("#menuBtn").setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    }
  });

  $("#matchChatBtn").addEventListener("click", () => {
    const userId = $("#matchChatBtn").dataset.chatWith;
    closeModals();
    if (userId) showChat(userId);
  });

  $("#searchBtn").addEventListener("click", () => {
    searchQuery = $("#searchInput").value.trim();
    renderGrids();
    document.getElementById("members").scrollIntoView({ behavior: "smooth" });
  });
  $("#searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    renderGrids();
  });
  $("#searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#searchBtn").click();
  });

  $("#sortSelect").addEventListener("change", (e) => {
    sortMode = e.target.value;
    renderGrids();
  });

  $("#messagesBtn").addEventListener("click", showChatList);
  $("#likedListBtn").addEventListener("click", showLikedList);
  $("#exploreBtn").addEventListener("click", () => {
    document.getElementById("recommend").scrollIntoView({ behavior: "smooth" });
  });
  $("#prevMonth").addEventListener("click", () => changeMonth(-1));
  $("#nextMonth").addEventListener("click", () => changeMonth(1));
  $("#deckSkip").addEventListener("click", () => deckAction(false));
  $("#deckLike").addEventListener("click", () => deckAction(true));

  // ヘッダー影・ページトップへ戻る
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    $("#siteHeader").classList.toggle("scrolled", y > 8);
    $("#backToTop").classList.toggle("show", y > 600);
  }, { passive: true });
  $("#backToTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // ---------- ハンバーガーメニュー(ドロワー) ----------
  const menuBtn = $("#menuBtn");
  const drawer = $("#drawer");
  const drawerOverlay = $("#drawerOverlay");

  function setMenu(open) {
    drawer.classList.toggle("open", open);
    menuBtn.classList.toggle("open", open);
    drawerOverlay.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    document.body.style.overflow = open ? "hidden" : "";
  }

  menuBtn.addEventListener("click", () => setMenu(!drawer.classList.contains("open")));
  drawerOverlay.addEventListener("click", () => setMenu(false));
  drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  $("#drawerLiked").addEventListener("click", () => { setMenu(false); showLikedList(); });
  $("#drawerMessages").addEventListener("click", () => { setMenu(false); showChatList(); });
  $("#drawerLogout").addEventListener("click", async () => {
    const t = token();
    if (t) await AuthApi.logout(t);
    AuthSession.clearToken();
    location.replace("login/");
  });

  // ---------- 初期化 ----------
  setupStats();
  setupReveal();
  renderCalendar();
  renderAll();
  loadRoster().then(() => refreshMatches({ silent: true }));
})();
