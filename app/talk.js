// ============================================
// app/talk.js — つながる(運営連絡・掲示板・メッセージ)
// ============================================

(function () {
  "use strict";
  const { h } = App;

  App.views.talk = {
    title: "つながる",
    // やりとりの画面は自分で新着を取りに行くので、一覧のときだけ戻ったら最新にする
    autoRefresh: (parts) => !(parts[0] === "msg" && parts[1]),
    async render(el, parts, params) {
      const tab = ["news", "board", "msg"].includes(parts[0]) ? parts[0] : "news";
      if (tab === "msg" && parts[1]) return renderThread(el, parts[1], params);
      const home = await App.api("getHome", {}, { quiet: true });
      const b = home ? home.badges : {};
      if (home) App.setBadges(b);
      el.append(App.segmented([
        { id: "news", label: "運営連絡", badge: b.announcements },
        { id: "board", label: "掲示板", badge: b.board },
        { id: "msg", label: "メッセージ", badge: b.messages },
      ], tab, (id) => App.go(`talk/${id}`)));
      const body = h("div");
      el.append(body);
      if (tab === "news") await renderNews(body, params);
      if (tab === "board") await renderBoard(body, params);
      if (tab === "msg") await renderThreads(body);
    },
  };

  // ============================================
  // 運営連絡
  // ============================================
  async function renderNews(el, params) {
    const d = await App.api("listAnnouncements");
    if (!d) return;
    if (App.isAdmin()) el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 運営連絡を書く(管理者)", () => annForm(null, d.cats), "ghost wide")));
    const unread = d.items.filter((a) => !a.read);
    if (unread.length > 1) {
      el.append(h("div", { class: "app-cta-row" }, App.btn(`未読 ${unread.length} 件をすべて既読にする`, async () => {
        if (await App.api("markAnnouncementsRead", {})) App.route();
      }, "ghost small")));
    }
    if (!d.items.length) { el.append(App.empty("運営からの連絡はまだありません。")); return; }
    const openId = params.get("open");
    el.append(h("ul", { class: "ann-list" }, d.items.map((a) => {
      const det = h("details", { class: `ann${a.read ? "" : " is-unread"}`, open: a.id === openId });
      det.append(
        h("summary", null,
          h("span", { class: "ann-head" }, a.pinned ? h("span", { class: "ann-pin" }, "固定") : null, App.chip(a.cat, a.cat === "重要" ? "warn" : "info"), a.read ? null : h("span", { class: "ann-dot" }, "未読")),
          h("b", null, a.title),
          h("small", null, `${App.fmtTime(a.at)} ・ ${a.byName}${a.readCount !== undefined ? ` ・ 既読 ${a.readCount}/${a.memberCount}` : ""}`)),
        App.richText(a.body),
        a.unreadNames && a.unreadNames.length ? h("p", { class: "app-field-hint ann-unread" }, `未読:${a.unreadNames.join("、")}`) : null,
        App.isAdmin() ? h("div", { class: "app-btn-row" },
          a.unreadNames && a.unreadNames.length ? App.btn(`未読の ${a.unreadNames.length} 名への声かけ文をコピー`, () => App.copyText([
            `【運営連絡を見てください】${a.title}`,
            `まだ見ていない方:${a.unreadNames.map((n) => `${n}さん`).join("、")}`,
            App.siteUrl(`#talk/news?open=${a.id}`),
          ].join("\n"), "コピーしました。LINE グループなどに貼り付けてください"), "small") : null,
          App.btn("編集", () => annForm(a, d.cats), "ghost small"),
          App.btn("削除", async () => {
            if (!confirm("この運営連絡を削除しますか?")) return;
            if (await App.api("adminDeleteAnnouncement", { id: a.id })) App.route();
          }, "ghost small danger")) : null);
      det.addEventListener("toggle", async () => {
        if (!det.open || a.read) return;
        a.read = true;
        det.classList.remove("is-unread");
        const dot = det.querySelector(".ann-dot");
        if (dot) dot.remove();
        await App.api("markAnnouncementsRead", { ids: [a.id] }, { quiet: true });
      });
      if (a.id === openId && !a.read) setTimeout(() => det.dispatchEvent(new Event("toggle")), 0);
      return h("li", null, det);
    })));
  }

  function annForm(a, cats) {
    App.openSheet(a ? "運営連絡を編集" : "運営連絡を書く", (body, close) => {
      const title = h("input", { type: "text", maxlength: "100", value: a ? a.title : "" });
      const cat = h("select", null, cats.map((c) => h("option", { value: c }, c)));
      cat.value = a ? a.cat : cats[0];
      const text = h("textarea", { rows: "8", maxlength: "4000" });
      text.value = a ? a.body : "";
      const pinned = h("input", { type: "checkbox", checked: a ? a.pinned : false });
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        const d = await App.api("adminSaveAnnouncement", { item: { id: a ? a.id : "", title: title.value.trim(), cat: cat.value, body: text.value, pinned: pinned.checked } });
        if (!d) return;
        close();
        App.toast(a ? "更新しました" : "全員に届けました");
        App.route();
      } },
      App.field("件名", title), App.field("種類", cat), App.field("本文", text, "URL はリンクになります"),
      h("label", { class: "app-check" }, pinned, " いちばん上に固定する"),
      h("button", { type: "submit", class: "app-btn primary wide" }, a ? "更新する" : "全員に届ける")));
    });
  }

  // ============================================
  // 掲示板
  // ============================================
  async function renderBoard(el, params) {
    const d = await App.api("listBoard");
    if (!d) return;
    App.setBadges(Object.assign({}, JSON.parse(sessionStorage.getItem("btex5-badges") || "{}").badges, { board: 0 }));
    const filter = params.get("cat") || "";
    el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 投稿する", () => postForm(d.cats, filter), "primary wide")));
    el.append(h("div", { class: "board-cats" },
      [{ id: "", label: "すべて" }].concat(d.cats.map((c) => ({ id: c, label: c }))).map((c) => h("button", {
        type: "button", class: `app-pill${c.id === filter ? " is-on" : ""}`,
        onclick: () => App.go(`talk/board${c.id ? `?cat=${encodeURIComponent(c.id)}` : ""}`),
      }, c.label))));
    const items = d.items.filter((p) => !filter || p.cat === filter);
    if (!items.length) { el.append(App.empty("まだ投稿がありません。紹介のお願いやイベントの告知、成約のお礼などを気軽にどうぞ。")); }
    // 掲示板の中を探す(本文・名前・コメント)
    const q = h("input", { type: "search", class: "board-search", placeholder: "掲示板を検索(例:税理士・イベント)", "aria-label": "掲示板を検索" });
    const list = h("ul", { class: "board-list" });
    const none = h("p", { class: "app-empty", hidden: true }, "見つかりませんでした。");
    const draw = () => {
      const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const hits = items.filter((p) => {
        const text = [p.body, p.byName, p.cat, ...p.comments.map((c) => `${c.byName} ${c.body}`)].join(" ").toLowerCase();
        return words.every((w) => text.includes(w));
      });
      list.replaceChildren(...hits.map((p) => h("li", null, postCard(p))));
      none.hidden = !(items.length && !hits.length);
    };
    q.addEventListener("input", draw);
    if (items.length > 3) el.append(q);
    el.append(list, none);
    draw();
    if (params.has("new")) postForm(d.cats, filter);
  }

  function postCard(p) {
    const card = h("article", { class: `post${p.isNew ? " is-new" : ""}` });
    function draw() {
      const comment = h("input", { type: "text", maxlength: "1000", placeholder: "コメントする", "aria-label": "コメント" });
      App.fill(card, 
        h("div", { class: "post-head" }, App.avatar(p.byName),
          h("div", null, h("a", { href: `../referral/#member=${encodeURIComponent(p.by)}` }, h("b", null, p.byName)), h("small", null, App.fmtTime(p.at))),
          App.chip(p.cat, p.cat === "紹介依頼" ? "warn" : p.cat === "成約・お礼" ? "good" : "info"),
          p.isNew ? h("span", { class: "ann-dot" }, "新着") : null),
        App.richText(p.body),
        h("div", { class: "post-actions" },
          h("button", { type: "button", class: `post-like${p.liked ? " is-on" : ""}`, "aria-pressed": p.liked ? "true" : "false", onclick: async () => {
            const d = await App.api("likePost", { id: p.id });
            if (d) { Object.assign(p, d.item); draw(); }
          } }, p.liked ? "♥" : "♡", ` ${p.likes || ""}`),
          p.by !== App.session.memberId ? h("button", { type: "button", class: "post-link", onclick: () => App.go(`talk/msg/new?to=${encodeURIComponent(p.by)}`) }, "メッセージ") : null,
          p.canDelete ? h("button", { type: "button", class: "post-link danger", onclick: async () => {
            if (!confirm("この投稿を削除しますか?")) return;
            if (await App.api("deletePost", { id: p.id })) card.closest("li").remove();
          } }, "削除") : null),
        p.comments.length ? h("ul", { class: "post-comments" }, p.comments.map((c) => h("li", null,
          h("b", null, c.byName), " ", c.body, h("small", null, ` ${App.fmtTime(c.at)}`),
          c.canDelete ? h("button", { type: "button", class: "post-link danger", "aria-label": "コメントを削除", onclick: async () => {
            const d = await App.api("deleteComment", { postId: p.id, id: c.id });
            if (d) { Object.assign(p, d.item); draw(); }
          } }, "×") : null))) : null,
        h("form", { class: "post-comment-form", onsubmit: async (e) => {
          e.preventDefault();
          if (!comment.value.trim()) return;
          const d = await App.api("commentPost", { postId: p.id, body: comment.value.trim() });
          if (d) { Object.assign(p, d.item); draw(); }
        } }, comment, h("button", { type: "submit", class: "app-btn small" }, "送信")));
    }
    draw();
    return card;
  }

  function postForm(cats, cat) {
    App.openSheet("掲示板に投稿", (body, close) => {
      let picked = cat || cats[0];
      const chips = h("div", { class: "board-cats" });
      const drawChips = () => chips.replaceChildren(...cats.map((c) => h("button", { type: "button", class: `app-pill${c === picked ? " is-on" : ""}`, onclick: () => { picked = c; drawChips(); } }, c)));
      drawChips();
      const text = App.draft("board", h("textarea", { rows: "6", maxlength: "2000", placeholder: "例:〇〇で困っている知り合いがいます。△△に詳しい方いませんか?" }));
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        if (!text.value.trim()) { App.toast("本文を入れてください"); return; }
        const d = await App.api("createPost", { cat: picked, body: text.value });
        if (!d) return;
        App.clearDraft("board");
        close();
        App.toast("投稿しました");
        App.go("talk/board");
      } }, App.field("種類", chips), App.field("本文", text), h("button", { type: "submit", class: "app-btn primary wide" }, "投稿する")));
    }, { confirmClose: () => false });
  }

  // ============================================
  // メッセージ
  // ============================================
  async function renderThreads(el) {
    const d = await App.api("listThreads");
    if (!d) return;
    el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 新しいメッセージ", () => App.go("talk/msg/new"), "primary wide")));
    if (!d.threads.length) { el.append(App.empty("まだやりとりはありません。メンバーのプロフィールや掲示板から、気軽にメッセージを送れます。")); return; }
    el.append(h("ul", { class: "app-list thread-list" }, d.threads.map((t) => h("li", null,
      h("a", { class: `app-row${t.unread ? " is-unread" : ""}`, href: `#talk/msg/${t.id}` },
        App.avatar(t.title),
        h("span", { class: "app-row-main" }, h("b", null, t.title, t.group ? ` (${t.members.length})` : ""),
          h("small", null, t.last ? `${t.last.mine ? "あなた: " : t.group ? `${t.last.byName}: ` : ""}${t.last.body}` : "")),
        h("span", { class: "thread-side" }, h("small", null, t.last ? App.fmtTime(t.last.at) : ""), t.unread ? h("span", { class: "app-badge" }, String(t.unread)) : null))))));
  }

  // やりとりの画面。new なら相手を選んでから最初の1通で作る。開いている間は新着を取りに行く
  async function renderThread(el, id, params) {
    el.classList.add("is-thread");
    el.append(h("a", { class: "app-back", href: "#talk/msg" }, "← メッセージ一覧"));
    const isNew = id === "new";
    const log = h("ol", { class: "msg-log", "aria-live": "polite" });
    const head = h("div", { class: "msg-head" });
    let picker = null;
    let lastAt = 0;
    let threadId = isNew ? "" : id;
    let readUpTo = 0;
    const seenIds = new Set();

    if (isNew) {
      const to = params.get("to");
      picker = App.memberPicker({ multiple: true, value: to && App.memberById(to) ? [to] : [], exclude: [App.session.memberId], label: "送る相手" });
      head.append(App.field("送る相手(複数選ぶとグループ)", picker));
    }
    function addMsgs(msgs) {
      if (msgs.length) log.querySelectorAll(".app-empty").forEach((x) => x.remove());
      msgs.forEach((m) => {
        if (seenIds.has(m.id)) return;
        seenIds.add(m.id);
        lastAt = Math.max(lastAt, m.at);
        log.append(h("li", { class: `msg${m.mine ? " is-mine" : ""}`, dataset: { at: String(m.at) } },
          m.mine ? null : h("small", { class: "msg-name" }, m.byName),
          h("div", { class: "msg-bubble" }, App.richText(m.body)),
          h("small", { class: "msg-time" }, App.fmtTime(m.at))));
      });
      markRead();
    }
    function markRead() {
      log.querySelectorAll(".msg.is-mine").forEach((li) => li.classList.toggle("is-read", Number(li.dataset.at) <= readUpTo));
    }
    async function load(initial) {
      if (!threadId) return;
      const d = await App.api("getThread", { id: threadId, since: initial ? 0 : lastAt }, { quiet: !initial });
      if (!d) return;
      if (initial) {
        App.fill(head, h("h1", { class: "app-h1" }, d.title), d.members.length > 2 ? h("p", { class: "app-field-hint" }, d.members.map((m) => m.name).join("、")) : null);
        document.getElementById("appTitle").textContent = d.title;
      }
      readUpTo = d.readUpTo;
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
      addMsgs(d.msgs);
      if (initial || (atBottom && d.msgs.length)) requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    }

    const input = h("textarea", { rows: "1", maxlength: "2000", placeholder: "メッセージを入力", "aria-label": "メッセージ" });
    const grow = () => { input.style.height = "auto"; input.style.height = `${Math.min(140, input.scrollHeight)}px`; };
    input.addEventListener("input", grow);
    const draftName = isNew ? `msg-new-${params.get("to") || ""}` : `msg-${id}`;
    // 決まった用件は文を用意しておく(1on1 の申し込み・紹介のその後)
    App.draft(draftName, input);
    const tpl = params.get("tpl");
    if (input.value) { /* 書きかけを優先 */ } else if (isNew && tpl === "1on1") {
      input.value = "はじめまして(いつもありがとうございます)。お互いの仕事をもっと知りたいので、30分ほど 1on1 をお願いできませんか?\n候補日:\n・\n・\nオンラインでも対面でも大丈夫です。";
    } else if (isNew && tpl === "follow") {
      const who = params.get("p");
      input.value = `${who ? `先日ご紹介した${who}の件、` : "先日の紹介の件、"}その後いかがでしょうか?何かお手伝いできることがあれば教えてください。`;
    }
    requestAnimationFrame(grow);
    // ひと言で返せる定型文(押すと入力欄に入る)
    const PHRASES = ["ありがとうございます!", "承知しました。", "日程を調整させてください。候補日:", "ご紹介させていただきました。", "よろしくお願いします。"];
    const quick = h("div", { class: "msg-quick", "aria-label": "定型文" }, PHRASES.map((t) => h("button", { type: "button", class: "app-pill", onclick: () => {
      input.value = input.value ? `${input.value}${/\s$/.test(input.value) ? "" : "\n"}${t}` : t;
      input.dispatchEvent(new Event("input"));
      input.focus();
    } }, t.replace(/。?候補日:$/, ""))));
    const send = h("button", { type: "submit", class: "app-btn primary" }, "送信");
    const form = h("form", { class: "msg-form", onsubmit: async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const payload = { body: text };
      if (threadId) payload.threadId = threadId;
      else {
        payload.to = picker.getValue();
        if (!payload.to.length) { App.toast("送る相手を選んでください"); return; }
      }
      send.disabled = true;
      const d = await App.api("sendMessage", payload);
      send.disabled = false;
      if (!d) return;
      input.value = "";
      input.style.height = "auto";
      App.clearDraft(draftName);
      if (!threadId) { threadId = d.threadId; history.replaceState(null, "", `#talk/msg/${threadId}`); App.route(); return; }
      addMsgs([d.msg]);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
    } }, input, send);
    // Enter で改行、Ctrl/⌘+Enter で送信
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });

    el.append(head, log, quick, form);
    await load(true);
    if (!isNew && !log.children.length) log.append(h("li", { class: "app-empty" }, "まだメッセージはありません。"));

    // 開いている間は 8 秒ごとに新着を確認(画面が隠れている間は止める)
    const timer = setInterval(() => { if (!document.hidden) load(false); }, 8000);
    return () => clearInterval(timer);
  }
})();
