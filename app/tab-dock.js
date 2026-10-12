// ============================================
// app/tab-dock.js — 下のメニュー(タブ)を、つかんで好きな場所へ動かせるようにする
// ・メニューが画面の端に近づく(約50px)か端からはみ出して離すと、その辺(上・下・左・右)にくっつく(左右は縦に並ぶ)。
//   辺の中の位置は離したところのまま(左右は高さ、パソコンの上下は横の位置)
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

  // 保存の形: "bottom" などの辺、{ side: "left", along }(辺の中の位置。画面に対するメニューの中心の割合)、
  // または { side: "free", fx, fy, v }(fx・fy は画面に対する左上の位置の割合)
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (SIDES.includes(raw)) return { side: raw };
      const st = JSON.parse(raw || "null");
      if (st && st.side === "free" && isFinite(st.fx) && isFinite(st.fy)) return { side: "free", fx: st.fx, fy: st.fy, v: !!st.v };
      if (st && SIDES.includes(st.side)) return isFinite(st.along) ? { side: st.side, along: st.along } : { side: st.side };
    } catch { /* 読めなければ下 */ }
    return { side: "bottom" };
  }
  function store(st) {
    const plain = st.side !== "free" && !isFinite(st.along);
    try { localStorage.setItem(KEY, plain ? st.side : JSON.stringify(st)); } catch { /* noop */ }
  }

  // 辺にくっつけたメニューを、辺の中の離した位置に置く(画面の中に収める)
  function placeAlong(st) {
    const nav = navEl();
    if (!nav) return;
    nav.style.left = ""; nav.style.top = ""; nav.style.transform = "";
    // 真ん中の近く(±12%)に置いたときは、ちょうど真ん中にそろえる
    if (!isFinite(st.along) || Math.abs(st.along - 0.5) < 0.12) return;
    const w = window.innerWidth, h = window.innerHeight;
    const r = nav.getBoundingClientRect();
    if (st.side === "left" || st.side === "right") {
      const minTop = 68; // 上の見出し(ロゴ・ベル)にかぶらないように
      const top = Math.min(Math.max(minTop, st.along * h - r.height / 2), Math.max(minTop, h - r.height - 8));
      nav.style.transform = "none";
      nav.style.top = `${Math.round(top)}px`;
    } else if (r.width < w - 24) {
      // 上下は、画面より幅が狭いとき(パソコン)だけ横の位置を変える
      const left = Math.min(Math.max(8, st.along * w - r.width / 2), Math.max(8, w - r.width - 8));
      nav.style.transform = "none";
      nav.style.left = `${Math.round(left)}px`;
    }
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
    if (nav && !free) placeAlong(st);
    if (nav && free) nav.style.transform = "";
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
      const edge = nearEdge(e.clientX, e.clientY, nav.getBoundingClientRect(), start.box);
      if (edge) document.body.dataset.dockPreview = edge;
      else delete document.body.dataset.dockPreview;
    };
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      // ブラウザが止めたとき(pointercancel)は、置き場所を変えずに元へ戻す(位置が 0,0 になるため)
      if (dragged && e.type === "pointercancel") {
        nav.classList.remove("is-dragging");
        document.body.classList.remove("dock-dragging");
        nav.style.translate = "";
        delete document.body.dataset.dockPreview;
        setTimeout(() => { dragged = false; }, 50);
        start = null;
        return;
      }
      if (dragged) {
        const box = nav.getBoundingClientRect();
        nav.classList.remove("is-dragging");
        document.body.classList.remove("dock-dragging");
        nav.style.translate = "";
        delete document.body.dataset.dockPreview;
        const edge = nearEdge(e.clientX, e.clientY, box, start.box);
        if (edge) {
          // 辺の中の位置は、離したときのメニューの中心
          const w = window.innerWidth, h = window.innerHeight;
          const along = edge === "left" || edge === "right" ? (box.top + box.height / 2) / h : (box.left + box.width / 2) / w;
          apply({ side: edge, along: Math.min(1, Math.max(0, along)) });
        } else {
          // 離した場所(指の位置)がメニューの真ん中になるように置く
          const w = window.innerWidth, h = window.innerHeight;
          const v = e.clientX < w * SIDE_ZONE || e.clientX > w * (1 - SIDE_ZONE);
          document.body.classList.add("tabs-free");
          document.body.classList.toggle("tabs-free-v", v);
          SIDES.forEach((s) => document.body.classList.remove(`tabs-${s}`));
          const r = nav.getBoundingClientRect();
          const left = e.clientX - r.width / 2, top = e.clientY - r.height / 2;
          // 置いた結果が端から約50px以内なら、その辺にくっつける(スマホの横いっぱいのメニューを左右へ寄せたときなど)
          const gaps = { left, right: w - (left + r.width), top, bottom: h - (top + r.height) };
          const snapTo = (v ? ["left", "right"] : ["top", "bottom"]).filter((k) => gaps[k] <= SNAP).sort((a, b) => gaps[a] - gaps[b])[0];
          if (snapTo) apply({ side: snapTo, along: v ? Math.min(1, Math.max(0, e.clientY / h)) : Math.min(1, Math.max(0, e.clientX / w)) });
          else apply({ side: "free", v, fx: left / w, fy: top / h });
        }
        // ドラッグのあとのクリック(リンクへの移動)はしない
        setTimeout(() => { dragged = false; }, 50);
      }
      start = null;
    };
    nav.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId, box: nav.getBoundingClientRect() };
      dragged = false;
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    });
    nav.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
    // パソコンのブラウザは、リンク(タブ)をつかむと「リンクのドラッグ」を始めて、メニューの移動が止まる。
    // メニューの中ではそれをさせない
    nav.addEventListener("dragstart", (e) => e.preventDefault());
    // メニューをつかんでいるあいだは、ページのほかの場所(リンクや選んだ文字)のドラッグも始めない
    // (始まるとブラウザがメニューの移動を止めてしまう)
    window.addEventListener("dragstart", (e) => { if (start) e.preventDefault(); }, true);
  }

  // メニュー(または指)が端の近く・端の外なら、その辺。いちばん近い(はみ出している)辺を選ぶ。
  // つかんだときにすでに触れていた辺(例: スマホの下のメニューは左右いっぱい)は、指がその辺の近くに行ったときだけ
  function edgeGaps(box) {
    const w = window.innerWidth, h = window.innerHeight;
    return { top: box.top, bottom: h - box.bottom, left: box.left, right: w - box.right };
  }
  function nearEdge(x, y, box, startBox) {
    const w = window.innerWidth, h = window.innerHeight;
    const byPointer = { top: y, bottom: h - y, left: x, right: w - x };
    const d = {};
    const g = box ? edgeGaps(box) : null, g0 = startBox ? edgeGaps(startBox) : null;
    Object.keys(byPointer).forEach((k) => {
      if (!g) d[k] = byPointer[k];
      else if (g0 && g0[k] <= SNAP) d[k] = byPointer[k];
      else d[k] = Math.min(g[k], byPointer[k]);
    });
    const side = Object.keys(d).sort((a, b) => d[a] - d[b])[0];
    return d[side] <= SNAP ? side : "";
  }

  // 画面の大きさが変わったら、浮かせたメニューを画面の中に収め直す
  window.addEventListener("resize", () => { const st = load(); if (st.side === "free") placeFree(st); else placeAlong(st); });

  // 本文が描かれる前に位置を反映(ちらつきを防ぐ)
  if (document.body) apply(load());
  else document.addEventListener("DOMContentLoaded", () => apply(load()));

  return { attach, apply, saved };
})();
