// ============================================
// 交流会マッチング - アプリケーションロジック
// ============================================

(function () {
  "use strict";

  // ---------- 状態 ----------
  const STORAGE_KEY = "kouryukai.likes";
  const PROFILE_KEY = "kouryukai.profile";
  const CHAT_KEY = "kouryukai.chats";
  const SKIP_KEY = "kouryukai.skips";
  const JOIN_KEY = "kouryukai.joins";

  let likedIds = loadSet(STORAGE_KEY);
  let skippedIds = loadSet(SKIP_KEY);
  let joinedEvents = loadSet(JOIN_KEY);
  let chats = loadChats();
  let activeTag = null;
  let searchQuery = "";
  let activeCategory = CATEGORIES[0];
  let sortMode = "score";
  let calYear = 2026;
  let calMonth = 7; // 1-12
  let unread = new Set(); // 未読の相手id
  let deckAnimating = false;

  // お互いいいねでマッチする「相手からのいいね」(デモ用に固定)
  const INCOMING_LIKES = new Set([2, 4, 5, 8, 11, 15]);

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
  function loadChats() {
    try {
      return JSON.parse(localStorage.getItem(CHAT_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveChats() {
    localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
  }

  // ---------- ユーティリティ ----------
  const $ = (sel) => document.querySelector(sel);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // メンバーidから決まる擬似「相性スコア」(72〜98%)
  function score(id) {
    return 72 + ((id * 37 + 11) % 27);
  }

  function isMatched(id) {
    return likedIds.has(id) && INCOMING_LIKES.has(id);
  }

  let toastTimer = null;
  function showToast(msg) {
    const toast = $("#toast");
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  // ---------- メンバーカード ----------
  function memberCard(m) {
    const liked = likedIds.has(m.id);
    return `
      <article class="member-card ${m.isPickup ? "pickup" : ""}" data-id="${m.id}">
        <span class="card-score">相性 ${score(m.id)}%</span>
        ${m.isPickup ? '<span class="pickup-label">PICK UP</span>' : ""}
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
        </div>
        <p class="member-bio">${escapeHtml(m.bio)}</p>
        <div class="card-actions">
          <button class="like-btn ${liked ? "liked" : ""}" data-like="${m.id}">
            ${liked ? "♥ いいね済み" : "♡ 話してみたい"}
          </button>
          <button class="detail-btn" data-detail="${m.id}">詳細</button>
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
    const filtered = MEMBERS.filter(matchesFilter);

    const newMembers = filtered.filter((m) => m.isNew);
    $("#newMembersGrid").innerHTML = newMembers.length
      ? newMembers.map(memberCard).join("")
      : '<p class="empty-note">条件に合う新着メンバーが見つかりませんでした。</p>';

    const pickups = filtered.filter((m) => m.isPickup);
    $("#pickupGrid").innerHTML = pickups.length
      ? pickups.map(memberCard).join("")
      : '<p class="empty-note">条件に合うピックアップメンバーが見つかりませんでした。</p>';

    let inCategory = MEMBERS.filter(
      (m) => m.category === activeCategory && matchesFilter(m)
    );
    inCategory = inCategory.slice().sort((a, b) =>
      sortMode === "score"
        ? score(b.id) - score(a.id)
        : (b.isNew === a.isNew ? 0 : b.isNew ? 1 : -1) || a.id - b.id
    );
    $("#categoryGrid").innerHTML = inCategory.length
      ? inCategory.map(memberCard).join("")
      : '<p class="empty-note">このカテゴリのメンバーが見つかりませんでした。</p>';

    $("#likedCount").textContent = likedIds.size;
    renderUnreadBadge();
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
    return MEMBERS.filter((m) => !likedIds.has(m.id) && !skippedIds.has(m.id))
      .slice()
      .sort((a, b) => score(b.id) - score(a.id));
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
        <div class="deck-card${cls}" data-deck-id="${m.id}" style="z-index:${10 - i}">
          <span class="score-chip">相性 ${score(m.id)}%</span>
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
    const el = $(`#deck [data-deck-id="${top.id}"]`);
    if (!el) return;
    deckAnimating = true;
    el.classList.add(like ? "fly-right" : "fly-left");
    setTimeout(() => {
      deckAnimating = false;
      if (like) {
        toggleLike(top.id, { silentRender: true });
      } else {
        skippedIds.add(top.id);
        saveSet(SKIP_KEY, skippedIds);
      }
      renderDeck();
      renderGrids();
    }, 330);
  }

  // ---------- いいね・マッチング ----------
  function toggleLike(id, opts = {}) {
    const m = MEMBERS.find((x) => x.id === id);
    if (!m) return;

    if (likedIds.has(id)) {
      likedIds.delete(id);
      saveSet(STORAGE_KEY, likedIds);
      renderAll();
      showToast(`${m.name}さんへのいいねを取り消しました`);
      return;
    }

    likedIds.add(id);
    skippedIds.delete(id);
    saveSet(STORAGE_KEY, likedIds);
    saveSet(SKIP_KEY, skippedIds);
    if (!opts.silentRender) renderAll();
    else renderGrids();

    if (INCOMING_LIKES.has(id)) {
      $("#matchText").textContent = `${m.name}さん(${m.company})とマッチングしました!メッセージを送って交流を始めましょう。`;
      $("#matchChatBtn").dataset.chatWith = m.id;
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
  }

  function showProfile(id) {
    const m = MEMBERS.find((x) => x.id === id);
    if (!m) return;
    const liked = likedIds.has(m.id);
    $("#profileModalBody").innerHTML = `
      <div class="profile-detail">
        <div class="avatar">${m.avatar}</div>
        <h3>${escapeHtml(m.name)}</h3>
        <div class="member-company">${escapeHtml(m.company)}</div>
        <div class="member-tags">
          <span class="tag">${escapeHtml(m.category)}</span>
          ${m.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          <span class="tag" style="border-color:var(--accent);color:var(--accent)">相性 ${score(m.id)}%</span>
        </div>
        <div class="full-bio">${escapeHtml(m.bio)}</div>
        <p class="interest"><strong>こんな人と話したい:</strong> ${escapeHtml(m.interest)}</p>
        ${isMatched(m.id)
          ? `<button class="btn btn-primary btn-block" data-chat-with="${m.id}">💬 メッセージを送る</button>`
          : `<button class="like-btn ${liked ? "liked" : ""}" data-like="${m.id}" style="width:100%; padding:12px 0; font-size:15px;">
              ${liked ? "♥ いいね済み" : "♡ 話してみたい"}
            </button>`}
      </div>`;
    openModal("#profileModal");
  }

  function showLikedList() {
    const liked = MEMBERS.filter((m) => likedIds.has(m.id));
    $("#likedListBody").innerHTML = liked.length
      ? liked
          .map((m) => {
            const matched = INCOMING_LIKES.has(m.id);
            return `
        <div class="liked-row">
          <div class="avatar">${m.avatar}</div>
          <div class="liked-info">
            <div class="member-name">${escapeHtml(m.name)} ${matched ? "🎉" : ""}</div>
            <div class="member-company">${escapeHtml(m.company)}${matched ? " ・マッチング済み" : ""}</div>
          </div>
          ${matched ? `<button class="join-btn" data-chat-with="${m.id}">💬 話す</button>` : ""}
          <button class="unlike-btn" data-unlike="${m.id}">取り消す</button>
        </div>`;
          })
          .join("")
      : '<p class="empty-note">まだ誰にもいいねしていません。気になるメンバーに「話してみたい」を送ってみましょう。</p>';
    openModal("#likedModal");
  }

  // ---------- メッセージ(チャット / LINE風) ----------
  const AUTO_REPLIES = [
    { text: "メッセージありがとうございます!ぜひ今度お話しましょう。" },
    { text: "👍", stamp: true },
    { text: "こちらこそよろしくお願いします。次回の交流会には参加されますか?" },
    { text: "興味あります!詳しく聞かせてください。" },
    { text: "🙏", stamp: true },
    { text: "ありがとうございます。今度ランチでもいかがですか?" },
    { text: "いいですね!日程候補をいくつか送ってもらえますか?" },
  ];

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

  function chatOpenId() {
    const form = $("#chatForm");
    return !$("#chatModal").hidden && form ? Number(form.dataset.chatId) : null;
  }

  function renderMessages(id, m) {
    const log = chats[id] || [];
    if (!log.length) {
      return '<p class="chat-empty-note">🎉 マッチング成立!最初のメッセージを送ってみましょう。</p>';
    }
    let html = "";
    let lastDate = "";
    for (const msg of log) {
      if (msg.at) {
        const dstr = fmtDate(msg.at);
        if (dstr !== lastDate) {
          html += `<div class="date-chip"><span>${escapeHtml(dstr)}</span></div>`;
          lastDate = dstr;
        }
      }
      const time = msg.at ? fmtTime(msg.at) : "";
      const body = msg.stamp
        ? `<div class="chat-stamp">${escapeHtml(msg.text)}</div>`
        : `<div class="chat-bubble ${msg.from === "me" ? "me" : "them"}">${escapeHtml(msg.text)}</div>`;
      if (msg.from === "me") {
        html += `<div class="msg-row me"><span class="msg-meta">${msg.read ? "既読<br>" : ""}${time}</span>${body}</div>`;
      } else {
        html += `<div class="msg-row them"><div class="msg-avatar">${m.avatar}</div>${body}<span class="msg-meta">${time}</span></div>`;
      }
    }
    return html;
  }

  function matchedMembers() {
    return MEMBERS.filter((m) => isMatched(m.id));
  }

  function renderUnreadBadge() {
    const el = $("#unreadCount");
    el.textContent = unread.size;
    el.classList.toggle("badge-hide", unread.size === 0);
  }

  function showChatList() {
    const matched = matchedMembers();
    $("#chatBody").innerHTML = `
      <div class="chat-list">
        <h3 class="chat-list-title">💬 メッセージ</h3>
        ${matched.length
          ? matched
              .map((m) => {
                const log = chats[m.id] || [];
                const last = log.length ? log[log.length - 1].text : "マッチングしました!メッセージを送ってみましょう";
                return `
            <div class="chat-partner-row" data-chat-with="${m.id}">
              <div class="avatar">${m.avatar}</div>
              <div>
                <div class="member-name">${escapeHtml(m.name)} ${unread.has(m.id) ? "🔴" : ""}</div>
                <div class="last-msg">${escapeHtml(last)}</div>
              </div>
            </div>`;
              })
              .join("")
          : '<p class="empty-note">まだマッチングした相手がいません。<br>「話してみたい」を送ってマッチングするとメッセージできます。</p>'}
      </div>`;
    openModal("#chatModal");
  }

  function showChat(id) {
    const m = MEMBERS.find((x) => x.id === id);
    if (!m || !isMatched(id)) return;
    unread.delete(id);
    renderUnreadBadge();
    $("#chatBody").innerHTML = `
      <div class="chat-header">
        <button class="chat-back" data-chat-back title="一覧へ戻る">‹</button>
        <div class="avatar">${m.avatar}</div>
        <div>
          <div class="chat-header-name">${escapeHtml(m.name)}</div>
          <div class="chat-header-company">${escapeHtml(m.company)}</div>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages">${renderMessages(id, m)}</div>
      <div class="stamp-row">
        ${STAMPS.map((s) => `<button type="button" class="stamp-btn" data-stamp="${s}" title="スタンプを送る">${s}</button>`).join("")}
      </div>
      <form class="chat-input-row" id="chatForm" data-chat-id="${id}">
        <input type="text" id="chatInput" placeholder="メッセージを入力…" autocomplete="off">
        <button type="submit" class="btn btn-primary">送信</button>
      </form>`;
    openModal("#chatModal");
    const box = $("#chatMessages");
    box.scrollTop = box.scrollHeight;
    $("#chatInput").focus();
  }

  function sendChat(id, text, isStamp) {
    if (!text.trim()) return;
    if (!chats[id]) chats[id] = [];
    chats[id].push({ from: "me", text: text.trim(), at: Date.now(), read: false, stamp: !!isStamp });
    saveChats();
    showChat(id);
    scheduleReply(id);
  }

  // デモ用:入力中インジケーター → 自動返信 → 既読付与(LINE風)
  function scheduleReply(id) {
    const m = MEMBERS.find((x) => x.id === id);

    setTimeout(() => {
      const box = $("#chatMessages");
      if (box && chatOpenId() === id && !document.getElementById("typingRow")) {
        box.insertAdjacentHTML(
          "beforeend",
          `<div class="msg-row them" id="typingRow">
            <div class="msg-avatar">${m.avatar}</div>
            <div class="chat-bubble them typing"><span></span><span></span><span></span></div>
          </div>`
        );
        box.scrollTop = box.scrollHeight;
      }
    }, 600);

    setTimeout(() => {
      const themCount = chats[id].filter((x) => x.from === "them").length;
      const reply = AUTO_REPLIES[themCount % AUTO_REPLIES.length];
      chats[id].push({ from: "them", text: reply.text, stamp: !!reply.stamp, at: Date.now() });
      // 相手が読んだ扱い: 自分の送信メッセージに既読を付ける
      chats[id].forEach((x) => { if (x.from === "me") x.read = true; });
      saveChats();
      if (chatOpenId() === id) {
        showChat(id);
      } else {
        unread.add(id);
        renderUnreadBadge();
        showToast(`💬 ${m.name}さんから新着メッセージ`);
      }
    }, 1500 + Math.floor(Math.random() * 900));
  }

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

  // ---------- 登録フォーム ----------
  function setupRegisterForm() {
    const select = document.querySelector('#registerForm select[name="category"]');
    CATEGORIES.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });

    $("#registerForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const profile = Object.fromEntries(fd.entries());
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      closeModals();
      showToast(`${profile.name}さん、登録ありがとうございます!🎉`);
      e.target.reset();
    });
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
      showChat(Number(chatWith.dataset.chatWith));
      return;
    }

    if (e.target.closest("[data-chat-back]")) { showChatList(); return; }

    const stampBtn = e.target.closest("[data-stamp]");
    if (stampBtn) {
      const id = chatOpenId();
      if (id) sendChat(id, stampBtn.dataset.stamp, true);
      return;
    }

    const likeBtn = e.target.closest("[data-like]");
    if (likeBtn) {
      e.stopPropagation();
      const inProfile = !!likeBtn.closest("#profileModal");
      toggleLike(Number(likeBtn.dataset.like));
      if (inProfile) showProfile(Number(likeBtn.dataset.like));
      return;
    }

    const detailBtn = e.target.closest("[data-detail]");
    if (detailBtn) {
      e.stopPropagation();
      showProfile(Number(detailBtn.dataset.detail));
      return;
    }

    const unlikeBtn = e.target.closest("[data-unlike]");
    if (unlikeBtn) {
      toggleLike(Number(unlikeBtn.dataset.unlike));
      showLikedList();
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
      showProfile(Number(card.dataset.id));
      return;
    }

    const deckCard = e.target.closest(".deck-card:not(.behind-1):not(.behind-2)");
    if (deckCard) {
      showProfile(Number(deckCard.dataset.deckId));
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
      const id = Number(e.target.dataset.chatId);
      const input = $("#chatInput");
      sendChat(id, input.value);
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
    const id = Number($("#matchChatBtn").dataset.chatWith);
    closeModals();
    if (id) showChat(id);
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
  $("#registerBtn2").addEventListener("click", () => openModal("#registerModal"));

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
    const token = AuthSession.getToken();
    if (token) await AuthApi.logout(token);
    AuthSession.clearToken();
    location.replace("login/");
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

  // ---------- 初期化 ----------
  setupRegisterForm();
  setupStats();
  setupReveal();
  renderAll();
  renderCalendar();
})();
