// ============================================
// app/talk.js — 運営連絡・掲示板(下のメニューにそれぞれのタブ)
// ============================================

(function () {
  "use strict";
  const { h } = App;

  // 運営連絡・掲示板は、下のメニューにそれぞれのタブを置く
  App.views.news = {
    title: "運営連絡",
    autoRefresh: true,
    async render(el, parts, params) { await renderNews(el, params); },
  };
  App.views.board = {
    title: "掲示板",
    autoRefresh: true,
    async render(el, parts, params) { await renderBoard(el, params); },
  };
  // 以前のリンク(#talk/news・#talk/board・メッセージ)は、運営連絡・掲示板へ移す
  App.views.talk = {
    title: "",
    async render(el, parts, params) {
      const to = parts[0] === "news" ? "news" : "board";
      const q = params.toString();
      history.replaceState(null, "", `#${to}${q && parts[0] !== "msg" ? `?${q}` : ""}`);
      await App.route();
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
            App.siteUrl(`#news?open=${a.id}`),
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
    boardCats = d.cats;
    App.setBadges(Object.assign({}, JSON.parse(sessionStorage.getItem("btex5-badges") || "{}").badges, { board: 0 }));
    const filter = params.get("cat") || "";
    el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 投稿する", () => postForm(d.cats, filter), "primary wide")));
    el.append(h("div", { class: "board-cats" },
      [{ id: "", label: "すべて" }].concat(d.cats.map((c) => ({ id: c, label: c }))).map((c) => h("button", {
        type: "button", class: `app-pill${c.id === filter ? " is-on" : ""}`,
        onclick: () => App.go(`board${c.id ? `?cat=${encodeURIComponent(c.id)}` : ""}`),
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
          h("div", null, h("a", { href: App.profileHref(p.by) }, h("b", null, p.byName)), h("small", null, `${App.fmtTime(p.at)}${p.editedAt ? "(編集済み)" : ""}`)),
          App.chip(p.cat, p.cat === "紹介依頼" ? "warn" : p.cat === "成約・お礼" ? "good" : "info"),
          p.isNew ? h("span", { class: "ann-dot" }, "新着") : null),
        App.richText(p.body),
        h("div", { class: "post-actions" },
          h("button", { type: "button", class: `post-like${p.liked ? " is-on" : ""}`, "aria-pressed": p.liked ? "true" : "false", onclick: async () => {
            const d = await App.api("likePost", { id: p.id });
            if (d) { Object.assign(p, d.item); draw(); }
          } }, p.liked ? "♥" : "♡", ` ${p.likes || ""}`),
          p.canEdit ? h("button", { type: "button", class: "post-link", onclick: () => editForm(p, (item) => { Object.assign(p, item); draw(); }) }, "編集") : null,
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

  // 自分の投稿を直す
  let boardCats = [];
  function editForm(p, done) {
    App.openSheet("投稿を直す", (body, close) => {
      let picked = p.cat;
      const chips = h("div", { class: "board-cats" });
      const drawChips = () => chips.replaceChildren(...boardCats.map((c) => h("button", { type: "button", class: `app-pill${c === picked ? " is-on" : ""}`, onclick: () => { picked = c; drawChips(); } }, c)));
      drawChips();
      const text = h("textarea", { rows: "8", maxlength: "2000" });
      text.value = p.body;
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        if (!text.value.trim()) { App.toast("本文を入れてください"); return; }
        const d = await App.api("editPost", { id: p.id, cat: picked, body: text.value });
        if (!d) return;
        close();
        App.toast("直しました");
        done(d.item);
      } }, App.field("種類", chips), App.field("本文", text), h("button", { type: "submit", class: "app-btn primary wide" }, "保存する")));
    });
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
        App.go("board");
      } }, App.field("種類", chips), App.field("本文", text), h("button", { type: "submit", class: "app-btn primary wide" }, "投稿する")));
    }, { confirmClose: () => false });
  }
})();
