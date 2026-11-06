// ============================================
// app/tour.js — はじめてログインしたときの「使い方ツアー」
// ・画面を暗くして、説明するところ(下のタブ・上のボタン)だけを明るく抜き、吹き出しで順番に説明する
// ・その人がこの端末ではじめてアプリを開いたときに1回だけ出る(「あとで」「スキップ」でも出なくなる)
// ・マイページ →「アプリの使い方ツアー」や、使い方(#help)から、いつでももう一度見られる(#tour)
// ・使えないタブ(準備中で黒いもの)や、その人に出ていないタブは、その人に合わせて説明を変える
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const KEY = (id) => `btex5-tour-v1-${id || "guest"}`;
  const local = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* noop */ } },
  };
  const coarse = () => window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const tabEl = (id) => document.querySelector(`#appTabs .app-tab[data-tab="${id}"]`);
  const shown = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

  // その人に合わせた説明の順番
  function buildSteps() {
    const s = App.session || {};
    const first = String(s.displayName || "").split(/\s+/)[0] || "";
    const tap = coarse() ? "タップ" : "クリック";
    const locked = ["log", "events", "materials"].filter((id) => tabEl(id) && !App.canTab(id));
    const label = { log: "記録", events: "予定", materials: "資料" };
    const steps = [
      { center: true, kicker: "WELCOME", title: `ようこそ${first ? `、${first}さん` : ""}`,
        text: "BT-EX5 アプリの使い方を、1分でご案内します。説明しているところだけが明るくなります。「次へ」で進んでください。" },
      { el: () => tabEl("search"), title: "早見表(メンバーを探す)",
        text: "メンバー全員の仕事・つながりたい人がわかります。「こんなことで困っている」と書くと、紹介できそうな人を探してくれます。" },
      { el: () => tabEl("board"), title: "掲示板",
        text: "紹介のお願い・イベントの告知・成約のお礼を、みんなに伝えられます。「紹介依頼」を書くと、合いそうなメンバーが自動で出ます。" },
    ];
    if (locked.length) {
      steps.push({ el: () => tabEl(locked[0]), title: "黒いタブは準備中です",
        text: `「${locked.map((id) => label[id]).join("」「")}」は、いまは準備中のため押せません。使えるようになったら、お知らせでご案内します。` });
    }
    if (App.canTab("log") && tabEl("log")) steps.push({ el: () => tabEl("log"), title: "記録",
      text: "紹介・1on1・ありがとうマイル(紹介のお礼)を記録します。「分析」で、自分の活動の進み具合も見られます。" });
    if (App.canTab("events") && tabEl("events")) steps.push({ el: () => tabEl("events"), title: "予定",
      text: "定例会の出席・欠席はここで押します。当日は、会場で見せる4桁の出席コードをここに入れます。" });
    if (tabEl("present")) steps.push({ el: () => tabEl("present"), title: "プレゼン",
      text: "定例会の進行用です。顔写真と紹介つきの大きな画面で、1分プレゼンを順番に進められます。" });
    if (tabEl("materials")) steps.push({ el: () => tabEl("materials"), title: "資料",
      text: App.canMaterials && App.canMaterials() ? "ポスター・招待の画像・Zoom 背景など、そのまま使える資料がそろっています。" : "BT-EX5 の Zoom 背景を保存できます。ポスターなどのほかの資料は準備中です。" });
    steps.push(
      { el: () => document.getElementById("appSearchBtn"), title: "アプリ内を検索",
        text: "名前・仕事・掲示板のことばなどで、アプリの中をまとめて探せます。" },
      { el: () => document.getElementById("appBell"), title: "お知らせ",
        text: "あなたへの紹介・コメント・運営からの連絡が届きます。赤い数字は、まだ見ていない数です。" },
      { el: () => document.getElementById("appMe"), title: "マイページ",
        text: `あなたのプロフィール・パスワード・通知の設定はここです。このツアーも、マイページからもう一度見られます。` },
      { center: true, kicker: "READY", title: "準備ができました",
        text: `まずは、マイページで「パスワード」と「プロフィール」を入れておくと安心です。わからないときは、マイページの「使い方マニュアル」をご覧ください。下のメニューは、${tap}して切りかえます。`,
        final: true },
    );
    return steps;
  }

  let active = null;
  function close(markDone) {
    if (!active) return;
    if (markDone !== false) local.set(KEY(App.session && App.session.memberId), String(Date.now()));
    active.cleanup();
    active = null;
  }

  function start(force) {
    if (active) return;
    const s = App.session;
    if (!s) return;
    if (!force && local.get(KEY(s.memberId))) return;
    const steps = buildSteps();
    let i = 0;
    const prevFocus = document.activeElement;
    const root = h("div", { class: "tour", role: "dialog", "aria-modal": "true", "aria-labelledby": "tourTitle", "aria-describedby": "tourText" });
    const shade = h("div", { class: "tour-shade" });
    const hole = h("div", { class: "tour-hole", "aria-hidden": "true" });
    const bubble = h("div", { class: "tour-bubble" });
    root.append(shade, hole, bubble);
    // 暗いところを押しても進まない(まちがえて閉じないように)。説明しているところを押したときも、ツアーの中で止める
    root.addEventListener("click", (e) => { if (!bubble.contains(e.target)) e.preventDefault(); });

    function place() {
      const st = steps[i];
      const el = st.el && st.el();
      const vw = window.innerWidth, vh = window.innerHeight;
      if (!st.center && shown(el)) {
        const r = el.getBoundingClientRect();
        const pad = 6;
        Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
        hole.hidden = false; root.classList.remove("is-center"); shade.classList.add("is-clear");
        const bw = Math.min(340, vw - 24);
        bubble.style.width = `${bw}px`;
        const bh = bubble.offsetHeight;
        const below = r.top + r.height / 2 < vh / 2;
        let top = below ? r.bottom + pad + 14 : r.top - pad - 14 - bh;
        top = Math.max(12, Math.min(vh - bh - 12, top));
        let left = r.left + r.width / 2 - bw / 2;
        left = Math.max(12, Math.min(vw - bw - 12, left));
        Object.assign(bubble.style, { left: `${left}px`, top: `${top}px` });
        bubble.dataset.side = below ? "below" : "above";
        bubble.style.setProperty("--arrow-x", `${Math.max(18, Math.min(bw - 18, r.left + r.width / 2 - left))}px`);
      } else {
        hole.hidden = true; root.classList.add("is-center"); shade.classList.remove("is-clear");
        bubble.style.width = ""; bubble.style.left = ""; bubble.style.top = ""; bubble.dataset.side = "";
      }
    }

    function draw() {
      const st = steps[i];
      const last = i === steps.length - 1;
      const dots = h("div", { class: "tour-dots", "aria-hidden": "true" }, steps.map((_, k) => h("i", { class: k === i ? "is-on" : k < i ? "is-done" : "" })));
      const next = h("button", { type: "button", class: "app-btn primary small tour-next", onclick: () => { if (last) close(); else { i += 1; draw(); } } },
        i === 0 ? "はじめる" : last ? "はじめよう" : "次へ");
      App.fill(bubble,
        st.kicker ? h("p", { class: "tour-kicker" }, st.kicker) : null,
        h("p", { class: "tour-step" }, i === 0 || last ? "" : `${i} / ${steps.length - 2}`),
        h("h2", { id: "tourTitle", class: "tour-title" }, st.title),
        h("p", { id: "tourText", class: "tour-text" }, st.text),
        st.final ? h("div", { class: "tour-links" },
          h("a", { class: "app-btn ghost small", href: "#me", onclick: () => close() }, "マイページを開く"),
          h("a", { class: "app-btn ghost small", href: "../manual/", onclick: () => close() }, "使い方マニュアル")) : null,
        h("div", { class: "tour-foot" },
          dots,
          h("div", { class: "tour-btns" },
            i === 0 ? h("button", { type: "button", class: "tour-skip", onclick: () => { close(); App.toast("「マイページ → アプリの使い方ツアー」から、いつでも見られます"); } }, "あとで")
              : last ? null : h("button", { type: "button", class: "tour-skip", onclick: () => { i -= 1; draw(); } }, "戻る"),
            next)),
        i > 0 && !last ? h("button", { type: "button", class: "tour-close", "aria-label": "ツアーを終わる", onclick: () => { close(); App.toast("「マイページ → アプリの使い方ツアー」から、いつでも見られます"); } }, "×") : null);
      // 吹き出しの大きさが決まってから置く
      place();
      requestAnimationFrame(place);
      next.focus({ preventScroll: true });
    }

    const onResize = () => place();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (i < steps.length - 1) { i += 1; draw(); } }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (i > 0) { i -= 1; draw(); } }
      else if (e.key === "Tab") {
        // ツアーの中だけで移る
        const f = [...bubble.querySelectorAll("button, a[href]")];
        if (!f.length) return;
        const at = f.indexOf(document.activeElement);
        if (e.shiftKey && at <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && at === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    document.addEventListener("keydown", onKey, true);
    document.body.append(root);
    document.documentElement.classList.add("is-touring");
    active = {
      cleanup() {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", onResize);
        document.removeEventListener("keydown", onKey, true);
        document.documentElement.classList.remove("is-touring");
        root.classList.add("is-leaving");
        setTimeout(() => root.remove(), 200);
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      },
    };
    draw();
  }

  // はじめて開いたとき: 画面が落ち着いてから(ほかのシート・プレゼン・ムービーが出ていないとき)に出す
  function maybeStart() {
    const s = App.session;
    if (!s || local.get(KEY(s.memberId)) || window.__btex5NoTour) return;
    // QR の出席コードなどのリンクから開いたときは、その用事を先に(次に開いたときに出す)
    if (/[?&](checkin|post|new)=?/.test(location.hash)) return;
    let tries = 0;
    const tick = () => {
      tries += 1;
      const busy = document.querySelector(".app-sheet-wrap, .pr-run, .op-intro");
      if (busy || !shown(document.getElementById("appTabs"))) { if (tries < 40) setTimeout(tick, 1500); return; }
      start(false);
    };
    setTimeout(tick, 900);
  }

  // #tour: いつでももう一度見る(マイページ・使い方から)
  App.views.tour = {
    title: "使い方ツアー",
    tab: "",
    render() {
      setTimeout(() => {
        history.replaceState(null, "", "#home");
        Promise.resolve(App.route()).then(() => setTimeout(() => start(true), 350));
      }, 0);
    },
  };

  App.tour = { start, maybeStart, close };
})();
