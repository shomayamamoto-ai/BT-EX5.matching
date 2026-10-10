// ============================================
// app/tab-dock.js — 下のメニュー(タブ)を、つかんで上下左右へ動かせるようにする
// つかんで動かし、離した場所にいちばん近い辺(上・下・左・右)にくっつく。
// 左右に置いたときは縦に並ぶ。端のつまみ(⋮⋮)を押すと、下→右→上→左の順に動く(キーボードでも)。
// 置いた場所はこの端末に保存し、ほかのページでも同じ場所に出す。
// ============================================

const TabDock = (function () {
  "use strict";

  const KEY = "btex5-tab-dock";
  const SIDES = ["bottom", "right", "top", "left"];
  const LABELS = { bottom: "下", right: "右", top: "上", left: "左" };

  function saved() {
    try { const v = localStorage.getItem(KEY); return SIDES.includes(v) ? v : "bottom"; } catch { return "bottom"; }
  }
  function apply(side) {
    SIDES.forEach((s) => document.body.classList.toggle(`tabs-${s}`, s === side && s !== "bottom"));
    try { localStorage.setItem(KEY, side); } catch { /* noop */ }
    const grip = document.querySelector(".tab-grip");
    if (grip) grip.setAttribute("aria-label", `メニューの位置を変える(いまは${LABELS[side]})`);
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
    apply(saved());

    // つまみ(押すと次の位置へ。つかんで動かすこともできる)
    grip = document.createElement("button");
    grip.type = "button";
    grip.className = "tab-grip";
    grip.title = "つかんで動かすと、メニューを上下左右に移動できます";
    grip.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="3" cy="3" r="1.2"/><circle cx="9" cy="3" r="1.2"/><circle cx="3" cy="9" r="1.2"/><circle cx="9" cy="9" r="1.2"/><circle cx="3" cy="6" r="1.2"/><circle cx="9" cy="6" r="1.2"/></svg>';
    grip.addEventListener("click", () => {
      if (dragged) return;
      document.body.classList.add("dock-ready");
      const next = SIDES[(SIDES.indexOf(saved()) + 1) % SIDES.length];
      apply(next);
    });
    nav.append(grip);
    apply(saved());

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
      // 離したときに行く辺を先に見せる
      document.body.dataset.dockPreview = nearest(e.clientX, e.clientY);
    };
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (dragged) {
        apply(nearest(e.clientX, e.clientY));
        nav.classList.remove("is-dragging");
        document.body.classList.remove("dock-dragging");
        nav.style.translate = "";
        delete document.body.dataset.dockPreview;
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

  // いちばん近い辺
  function nearest(x, y) {
    const w = window.innerWidth, h = window.innerHeight;
    const d = { top: y / h, bottom: (h - y) / h, left: x / w, right: (w - x) / w };
    return Object.keys(d).sort((a, b) => d[a] - d[b])[0];
  }

  // 本文が描かれる前に位置を反映(ちらつきを防ぐ)
  if (document.body) apply(saved());
  else document.addEventListener("DOMContentLoaded", () => apply(saved()));

  return { attach, apply, saved };
})();
