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
      // 入っていない部分(null)は「null」の文字にせず飛ばす(App.append を使う)
      App.append(det, [
        h("summary", null,
          h("span", { class: "ann-head" }, a.pinned ? h("span", { class: "ann-pin" }, "固定") : null, App.chip(a.cat, a.cat === "重要" ? "warn" : "info"), a.read ? null : h("span", { class: "ann-dot" }, "未読")),
          h("b", null, a.title),
          h("small", null, `${App.fmtTime(a.at)} ・ ${a.byName}${a.readCount !== undefined ? ` ・ 既読 ${a.readCount}/${a.memberCount}` : ""}`)),
        App.richText(a.body),
        // LINE のトークにそのまま貼れる文(件名・本文・アプリのリンク)
        h("div", { class: "app-btn-row ann-share" },
          App.btn("LINE に貼る文をコピー", () => App.copyText(lineText(a), "コピーしました。LINE のトークに貼り付けてください"), "small"),
          App.btn("LINE などで送る", () => App.shareText(lineText(a), a.title), "ghost small")),
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
          }, "ghost small danger")) : null]);
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

  // LINE に貼る文。LINE は太字などが使えないので、記号で見出しを分ける
  function lineText(a) {
    const body = String(a.body || "").replace(/(?:null|undefined){2,}/g, "").replace(/\n{3,}/g, "\n\n").trim();
    return [
      "【BT-EX5 運営連絡】",
      a.title,
      "",
      body,
      "",
      "▼ アプリで見る",
      App.siteUrl(`#news?open=${a.id}`),
    ].join("\n");
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
    // LINE などから開いたとき(#board?post=…): その投稿まで動かして、少し光らせる
    const target = params.get("post");
    if (target) {
      setTimeout(() => {
        const card = document.getElementById(`post-${target}`);
        if (!card) return;
        const more = card.querySelector(".post-more");
        if (more) more.click(); // リンクから開いた投稿は、折りたたまずに全部見せる
        card.scrollIntoView({ block: "center", behavior: "smooth" });
        card.classList.add("is-focus");
        setTimeout(() => card.classList.remove("is-focus"), 2400);
      }, 80);
    }
  }

  // 掲示板の投稿を LINE に貼る文
  function postLineText(p) {
    return [
      `【BT-EX5 掲示板・${p.cat}】`,
      `${p.byName}さんの投稿`,
      "",
      String(p.body || "").replace(/(?:null|undefined){2,}/g, "").trim(),
      "",
      "▼ アプリで見る・コメントする",
      App.siteUrl(`#board?post=${p.id}`),
    ].join("\n");
  }

  // 長い投稿は6行ほどで折りたたみ、「続きを読む」で全部見せる(一覧がひとつの投稿で埋まらないように)
  function clampBody(p) {
    const body = App.richText(p.body);
    const long = (p.body || "").length > 220 || (p.body || "").split("\n").length > 6;
    if (!long || p._open) return body;
    body.classList.add("is-clamped");
    const more = h("button", { type: "button", class: "post-more", onclick: () => { p._open = true; body.classList.remove("is-clamped"); more.remove(); } }, "続きを読む");
    return h("div", { class: "post-body-wrap" }, body, more);
  }

  function postCard(p) {
    const card = h("article", { class: `post${p.isNew ? " is-new" : ""}`, id: `post-${p.id}` });
    function draw() {
      const comment = h("input", { type: "text", maxlength: "1000", placeholder: "コメントする", "aria-label": "コメント" });
      App.fill(card, 
        h("div", { class: "post-head" }, App.avatar(p.byName),
          h("div", null, h("a", { href: App.profileHref(p.by) }, h("b", null, p.byName)), h("small", null, `${App.fmtTime(p.at)}${p.editedAt ? "(編集済み)" : ""}`)),
          App.chip(p.cat, p.cat === "紹介依頼" ? "warn" : p.cat === "成約・お礼" ? "good" : "info"),
          p.isNew ? h("span", { class: "ann-dot" }, "新着") : null),
        clampBody(p),
        h("div", { class: "post-actions" },
          h("button", { type: "button", class: `post-like${p.liked ? " is-on" : ""}`, "aria-pressed": p.liked ? "true" : "false", onclick: async () => {
            const d = await App.api("likePost", { id: p.id });
            if (d) { Object.assign(p, d.item); draw(); }
          }, "aria-label": p.liked ? "いいねを取り消す" : "いいね" }, p.liked ? "♥ いいね" : "♡ いいね", ` ${p.likes || ""}`),
          h("button", { type: "button", class: "post-link", onclick: () => App.copyText(postLineText(p), "コピーしました。LINE のトークに貼り付けてください") }, "LINE 用にコピー"),
          p.canEdit ? h("button", { type: "button", class: "post-link", onclick: () => editForm(p, (item) => { Object.assign(p, item); draw(); }) }, "編集") : null,
          p.canDelete ? h("button", { type: "button", class: "post-link danger", onclick: async () => {
            if (!confirm("この投稿を削除しますか?")) return;
            if (await App.api("deletePost", { id: p.id })) card.closest("li").remove();
          } }, "削除") : null),
        p.comments.length ? h("ul", { class: "post-comments" }, p.comments.map((c) => h("li", null,
          h("b", null, c.byName), " ", c.body, h("small", null, ` ${App.fmtTime(c.at)}${c.edited ? "(編集済み)" : ""}`),
          c.canEdit ? h("button", { type: "button", class: "post-link", "aria-label": "コメントを直す", onclick: async () => {
            const text = prompt("コメントを直す", c.body);
            if (text === null || !text.trim() || text.trim() === c.body) return;
            const d = await App.api("editComment", { postId: p.id, id: c.id, body: text.trim() });
            if (d) { Object.assign(p, d.item); draw(); App.toast("直しました"); }
          } }, "編集") : null,
          c.canDelete ? h("button", { type: "button", class: "post-link danger", "aria-label": "コメントを削除", onclick: async () => {
            const d = await App.api("deleteComment", { postId: p.id, id: c.id });
            if (d) { Object.assign(p, d.item); draw(); }
          } }, "×") : null))) : null,
        h("form", { class: "post-comment-form", onsubmit: async (e) => {
          e.preventDefault();
          if (!comment.value.trim()) return;
          const d = await App.api("commentPost", { postId: p.id, body: comment.value.trim() });
          if (d) { Object.assign(p, d.item); draw(); }
        } }, mentionWrap(comment), h("button", { type: "submit", class: "app-btn small" }, "送信")));
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
      } }, App.field("種類", chips), App.field("本文", mentionWrap(text), "「@名前」と書くと、その人に通知が届きます"), h("button", { type: "submit", class: "app-btn primary wide" }, "保存する")));
    });
  }

  // 「@」のあとに名前を打つと、メンバーの候補を出す。押すと「@名前 」が入る(その人に通知が届く)
  function mentionWrap(field) {
    const list = h("ul", { class: "mention-list", role: "listbox", hidden: true });
    const wrap = h("div", { class: "mention-wrap" }, field, list);
    const token = () => {
      const before = field.value.slice(0, field.selectionStart || 0);
      const m = /[@＠]([^\s@＠]{0,12})$/.exec(before);
      return m ? { q: m[1], start: before.length - m[0].length } : null;
    };
    const close = () => { list.hidden = true; };
    const draw = () => {
      const t = token();
      if (!t) { close(); return; }
      const q = t.q.replace(/\s/g, "");
      const hits = App.members.filter((m) => m.id !== App.session.memberId && (!q || String(m.name).replace(/\s+/g, "").includes(q))).slice(0, 6);
      if (!hits.length) { close(); return; }
      list.replaceChildren(...hits.map((m) => h("li", null, h("button", { type: "button", role: "option", onmousedown: (e) => e.preventDefault(), onclick: () => {
        const name = String(m.name).replace(/\s+/g, "");
        const end = field.selectionStart || field.value.length;
        field.value = `${field.value.slice(0, t.start)}@${name} ${field.value.slice(end)}`;
        const pos = t.start + name.length + 2;
        field.focus(); field.setSelectionRange(pos, pos);
        field.dispatchEvent(new Event("input"));
        close();
      } }, App.avatar(m.name, "sm"), h("span", null, m.name)))));
      list.hidden = false;
    };
    field.addEventListener("input", draw);
    field.addEventListener("click", draw);
    field.addEventListener("blur", () => setTimeout(close, 150));
    return wrap;
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
        if (!text.value.trim()) { App.fieldError(text, "本文を入れてください。"); return; }
        const d = await App.api("createPost", { cat: picked, body: text.value });
        if (!d) return;
        App.clearDraft("board");
        close();
        App.toast("投稿しました");
        App.go("board");
      } }, App.field("種類", chips), App.field("本文", mentionWrap(text), "「@名前」と書くと、その人に通知が届きます"), h("button", { type: "submit", class: "app-btn primary wide" }, "投稿する")));
    }, { confirmClose: () => false });
  }
})();
