// ============================================
// app/tab-dock.js — 下のメニュー(タブ)を、つかんで好きな場所へ動かせるようにする
// ・画面の端の近く(約50px)で離すと、その辺(上・下・左・右)にくっつく(左右は縦に並ぶ)
// ・それ以外の場所で離すと、そこに浮かせて置く(画面の左右寄りに置いたときは縦、ほかは横に並ぶ)
// ・端のつまみ(⋮⋮)を押すと、下→右→上→左の順にくっつく(キーボードでも)
// 置いた場所はこの端末に保存し、ほかのページでも同じ場所に出す(画面の大きさが変わっても画面の中に収める)
// ============================================

const TabDock = (function () {
  "use strict";

  const KEY = "btex5-tab-dock";
  const SIDES = ["bottom", "right", "top", "left"];
  const LABELS = { bottom: "下", right: "右", top: "上", left: "左", free: "好きな場所" };
  const SNAP = 52;       // 端からこの距離(px)以内で離すと、その辺にくっつく
  const SIDE_ZONE = 0.2; // 画面の左右それぞれ2割の中に置くと縦並び

  // 保存の形: "bottom" などの辺、または { side: "free", fx, fy, v }(fx・fy は画面に対する左上の位置の割合)
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (SIDES.includes(raw)) return { side: raw };
      const st = JSON.parse(raw || "null");
      if (st && st.side === "free" && isFinite(st.fx) && isFinite(st.fy)) return { side: "free", fx: st.fx, fy: st.fy, v: !!st.v };
    } catch { /* 読めなければ下 */ }
    return { side: "bottom" };
  }
  function store(st) {
    try { localStorage.setItem(KEY, st.side === "free" ? JSON.stringify(st) : st.side); } catch { /* noop */ }
  }
  function saved() { return load().side; }

  function navEl() { return document.getElementById("appTabs") || document.querySelector(".app-tabs"); }

  // 浮かせたメニューを画面の中に収める
  function placeFree(st) {
    const nav = navEl();
    if (!nav) return;
    const w = window.innerWidth, h = window.innerHeight;
    const r = nav.getBoundingClientRect();
    const left = Math.min(Math.max(8, st.fx * w), Math.max(8, w - r.width - 8));
    const top = Math.min(Math.max(8, st.fy * h), Math.max(8, h - r.height - 8));
    nav.style.left = `${Math.round(left)}px`;
    nav.style.top = `${Math.round(top)}px`;
  }

  function apply(input) {
    const st = typeof input === "string" ? { side: input } : input;
    const free = st.side === "free";
    SIDES.forEach((s) => document.body.classList.toggle(`tabs-${s}`, s === st.side && s !== "bottom"));
    document.body.classList.toggle("tabs-free", free);
    document.body.classList.toggle("tabs-free-v", free && st.v);
    const nav = navEl();
    if (nav && !free) { nav.style.left = ""; nav.style.top = ""; }
    if (free) placeFree(st);
    store(st);
    const grip = document.querySelector(".tab-grip");
    if (grip) grip.setAttribute("aria-label", `メニューの位置を変える(いまは${LABELS[st.side]})`);
  }

  let grip = null;
  // 何度呼んでもよい(タブを描き直したあとに、つまみを付け直す)
  function attach(nav) {
    if (!nav) return;
    if (nav.dataset.dock) {
      if (grip && !nav.contains(grip)) nav.append(grip);
      return;
    }
    nav.dataset.dock = "1";

    // つまみ(押すと次の辺へ。つかんで動かすこともできる)
    grip = document.createElement("button");
    grip.type = "button";
    grip.className = "tab-grip";
    grip.title = "つかんで動かすと、メニューを好きな場所に置けます(押すと上下左右の端へ)";
    grip.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="3" cy="3" r="1.2"/><circle cx="9" cy="3" r="1.2"/><circle cx="3" cy="9" r="1.2"/><circle cx="9" cy="9" r="1.2"/><circle cx="3" cy="6" r="1.2"/><circle cx="9" cy="6" r="1.2"/></svg>';
    grip.addEventListener("click", () => {
      if (dragged) return;
      document.body.classList.add("dock-ready");
      const cur = saved();
      const next = cur === "free" ? "bottom" : SIDES[(SIDES.indexOf(cur) + 1) % SIDES.length];
      apply(next);
    });
    nav.append(grip);
    apply(load());

    // つかんで動かす(マウス・指どちらでも)。少し動かしたらドラッグとみなし、リンクは押さない。
    // 押したあとはバーの外に出ても追いかけられるよう、画面全体で動きを見る
    let start = null;
    let dragged = false;
    const move = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < 10) return;
      if (!dragged) {
        dragged = true;
        nav.classList.add("is-dragging");
        document.body.classList.add("dock-dragging", "dock-ready");
      }
      e.preventDefault();
      nav.style.translate = `${dx}px ${dy}px`;
      // 離したときにくっつく辺を先に見せる(端の近くのときだけ)
      const edge = nearEdge(e.clientX, e.clientY);
      if (edge) document.body.dataset.dockPreview = edge;
      else delete document.body.dataset.dockPreview;
    };
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (dragged) {
        nav.classList.remove("is-dragging");
        document.body.classList.remove("dock-dragging");
        nav.style.translate = "";
        delete document.body.dataset.dockPreview;
        const edge = nearEdge(e.clientX, e.clientY);
        if (edge) {
          apply(edge);
        } else {
          // 離した場所(指の位置)がメニューの真ん中になるように置く
          const w = window.innerWidth, h = window.innerHeight;
          const v = e.clientX < w * SIDE_ZONE || e.clientX > w * (1 - SIDE_ZONE);
          document.body.classList.add("tabs-free");
          document.body.classList.toggle("tabs-free-v", v);
          SIDES.forEach((s) => document.body.classList.remove(`tabs-${s}`));
          const r = nav.getBoundingClientRect();
          apply({ side: "free", v, fx: (e.clientX - r.width / 2) / w, fy: (e.clientY - r.height / 2) / h });
        }
        // ドラッグのあとのクリック(リンクへの移動)はしない
        setTimeout(() => { dragged = false; }, 50);
      }
      start = null;
    };
    nav.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      dragged = false;
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    });
    nav.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
  }

  // 端の近くなら、その辺
  function nearEdge(x, y) {
    const w = window.innerWidth, h = window.innerHeight;
    const d = { top: y, bottom: h - y, left: x, right: w - x };
    const side = Object.keys(d).sort((a, b) => d[a] - d[b])[0];
    return d[side] <= SNAP ? side : "";
  }

  // 画面の大きさが変わったら、浮かせたメニューを画面の中に収め直す
  window.addEventListener("resize", () => { const st = load(); if (st.side === "free") placeFree(st); });

  // 本文が描かれる前に位置を反映(ちらつきを防ぐ)
  if (document.body) apply(load());
  else document.addEventListener("DOMContentLoaded", () => apply(load()));

  return { attach, apply, saved };
})();
