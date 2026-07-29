// ============================================
// 交流会マッチング - アプリケーションロジック
// ============================================

(function () {
  "use strict";

  // ---------- 状態 ----------
  const STORAGE_KEY = "kouryukai.likes";
  const PROFILE_KEY = "kouryukai.profile";

  let likedIds = loadLikes();
  let activeTag = null;
  let searchQuery = "";
  let activeCategory = CATEGORIES[0];
  let calYear = 2026;
  let calMonth = 7; // 1-12

  // お互いいいねでマッチする「相手からのいいね」(デモ用に固定)
  const INCOMING_LIKES = new Set([2, 4, 5, 8, 11, 15]);

  function loadLikes() {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
      return new Set();
    }
  }
  function saveLikes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...likedIds]));
  }

  // ---------- ユーティリティ ----------
  const $ = (sel) => document.querySelector(sel);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
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

    const inCategory = MEMBERS.filter(
      (m) => m.category === activeCategory && matchesFilter(m)
    );
    $("#categoryGrid").innerHTML = inCategory.length
      ? inCategory.map(memberCard).join("")
      : '<p class="empty-note">このカテゴリのメンバーが見つかりませんでした。</p>';

    $("#likedCount").textContent = likedIds.size;
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

  // ---------- いいね・マッチング ----------
  function toggleLike(id) {
    const m = MEMBERS.find((x) => x.id === id);
    if (!m) return;

    if (likedIds.has(id)) {
      likedIds.delete(id);
      saveLikes();
      renderAll();
      showToast(`${m.name}さんへのいいねを取り消しました`);
      return;
    }

    likedIds.add(id);
    saveLikes();
    renderAll();

    if (INCOMING_LIKES.has(id)) {
      $("#matchText").textContent = `${m.name}さん(${m.company})とマッチングしました!メッセージを送って交流を始めましょう。`;
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
        </div>
        <div class="full-bio">${escapeHtml(m.bio)}</div>
        <p class="interest"><strong>こんな人と話したい:</strong> ${escapeHtml(m.interest)}</p>
        <button class="like-btn ${liked ? "liked" : ""}" data-like="${m.id}" style="width:100%; padding:12px 0; font-size:15px;">
          ${liked ? "♥ いいね済み" : "♡ 話してみたい"}
        </button>
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
          <button class="unlike-btn" data-unlike="${m.id}">取り消す</button>
        </div>`;
          })
          .join("")
      : '<p class="empty-note">まだ誰にもいいねしていません。気になるメンバーに「話してみたい」を送ってみましょう。</p>';
    openModal("#likedModal");
  }

  // ---------- カレンダー ----------
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
          .map(
            (e) => `
      <div class="event-item">
        <div class="event-date">${e.month}/${e.day}<small>${dows[new Date(e.year, e.month - 1, e.day).getDay()]}曜</small></div>
        <div>
          <div class="event-name">${escapeHtml(e.name)}</div>
          <div class="event-place">${escapeHtml(e.place)}</div>
        </div>
      </div>`
          )
          .join("")
      : '<p class="empty-note">この月に予定されているイベントはありません。</p>';
  }

  function changeMonth(delta) {
    calMonth += delta;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    if (calMonth < 1) { calMonth = 12; calYear--; }
    renderCalendar();
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
  }

  // ---------- イベント委譲 ----------
  document.addEventListener("click", (e) => {
    const likeBtn = e.target.closest("[data-like]");
    if (likeBtn) {
      e.stopPropagation();
      toggleLike(Number(likeBtn.dataset.like));
      // モーダル内のボタンなら表示を更新
      if (likeBtn.closest("#profileModal")) showProfile(Number(likeBtn.dataset.like));
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

    const card = e.target.closest(".member-card");
    if (card) {
      showProfile(Number(card.dataset.id));
      return;
    }

    const tagBtn = e.target.closest("[data-tag]");
    if (tagBtn) {
      activeTag = activeTag === tagBtn.dataset.tag ? null : tagBtn.dataset.tag;
      renderAll();
      return;
    }

    const catBtn = e.target.closest("[data-cat]");
    if (catBtn) {
      activeCategory = catBtn.dataset.cat;
      renderAll();
      return;
    }

    if (e.target.closest("[data-close]")) { closeModals(); return; }
    if (e.target.classList.contains("modal-overlay")) { closeModals(); return; }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
  });

  $("#searchBtn").addEventListener("click", () => {
    searchQuery = $("#searchInput").value.trim();
    renderAll();
    document.getElementById("members").scrollIntoView({ behavior: "smooth" });
  });
  $("#searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    renderGrids();
  });
  $("#searchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#searchBtn").click();
  });

  $("#likedListBtn").addEventListener("click", showLikedList);
  $("#registerBtn").addEventListener("click", () => openModal("#registerModal"));
  $("#registerBtn2").addEventListener("click", () => openModal("#registerModal"));
  $("#prevMonth").addEventListener("click", () => changeMonth(-1));
  $("#nextMonth").addEventListener("click", () => changeMonth(1));

  // ---------- 初期化 ----------
  setupRegisterForm();
  renderAll();
  renderCalendar();
})();
