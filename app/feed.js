// ============================================
// app/feed.js — お知らせ(自分に関係する出来事を新しい順に)
// 紹介が届いた・紹介の状況が変わった・お礼が届いた・コメントがついた・1on1 が入った・
// ビジターが申し込んだ・運営連絡・新しい定例会。押すとその画面へ
// ============================================

(function () {
  "use strict";
  const { h } = App;

  function describe(x) {
    const st = App.REF_STATUS[x.status];
    switch (x.type) {
      case "refIn": return { icon: "🤝", title: `${x.whoName}さんから紹介が届きました`, sub: x.text };
      case "refStatus": return { icon: x.status === "won" ? "🎉" : "📮", title: `${x.whoName}さんが紹介を「${st ? st.label : x.status}」にしました`, sub: x.text };
      case "thanks": return { icon: "💐", title: `${x.whoName}さんからありがとうが届きました`, sub: `${App.yen(x.amount)}${x.text ? ` ・ ${x.text}` : ""}` };
      case "comment": return { icon: "💬", title: `${x.whoName}さんがあなたの投稿にコメントしました`, sub: x.text };
      case "reply": return { icon: "💬", title: `${x.whoName}さんも同じ投稿にコメントしました`, sub: x.text };
      case "oneAsk": return { icon: "☕", title: `${x.whoName}さんとの 1on1 は実施しましたか?`, sub: "押して「実施した」を選ぶと回数に数えます" };
      case "oneNew": return { icon: "👥", title: `${x.whoName}さんが 1on1 を記録しました`, sub: App.fmtDate(x.date) };
      case "visitor": return { icon: "🙋", title: `${x.text || "ビジター"}さんが定例会に申し込みました`, sub: "あなたの招待から" };
      case "ann": return { icon: "📣", title: "運営連絡", sub: x.text };
      case "post": return { icon: "📝", title: `${x.whoName}さんが掲示板に投稿しました`, sub: x.text };
      case "event": return { icon: "📅", title: `定例会が追加されました(${App.fmtDate(x.date)})`, sub: x.text };
      default: return { icon: "・", title: x.type, sub: x.text || "" };
    }
  }

  App.views.feed = {
    title: "お知らせ",
    tab: "",
    autoRefresh: true,
    async render(el) {
      const d = await App.api("getActivity");
      if (!d) return;
      App.setBadges(Object.assign({}, (() => { try { return JSON.parse(sessionStorage.getItem("btex5-badges") || "{}").badges; } catch { return {}; } })(), { feed: 0 }));
      if (!d.items.length) { el.append(App.empty("まだお知らせはありません。紹介やお礼、コメントが届くとここに並びます。")); return; }
      el.append(h("ul", { class: "app-list feed-list" }, d.items.map((x) => {
        const t = describe(x);
        return h("li", null, h("a", { class: `app-row${x.isNew ? " is-unread" : ""}`, href: `#${x.link}` },
          h("span", { class: "feed-icon", "aria-hidden": "true" }, t.icon),
          h("span", { class: "app-row-main" }, h("b", null, t.title), t.sub ? h("small", null, t.sub) : null),
          h("span", { class: "thread-side" }, h("small", null, App.fmtTime(x.at)), x.isNew ? h("span", { class: "ann-dot" }, "新着") : null)));
      })));
    },
  };
})();
