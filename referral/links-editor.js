// ============================================
// 資料・リンクの入力欄(管理者ページ・自分の情報を編集で共用)
// LinksEditor.mount(要素, links) で表示し、LinksEditor.read(要素) で取り出す。
// URL は https:// から始まるもの(サイト内の資料は materials/ のまま残す)
// ============================================

const LinksEditor = (function () {
  "use strict";

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MAX = 8;
  let seq = 0;

  function rowHtml(link) {
    const id = `lk${++seq}`;
    const l = link || { type: "website", url: "", label: "" };
    return `
      <div class="lk-row" data-cover="${esc(l.cover || "")}">
        <label class="visually-hidden" for="${id}-type">種類</label>
        <select id="${id}-type" class="lk-type">${LINK_TYPES.map((t) => `<option value="${t.id}"${t.id === l.type ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</select>
        <label class="visually-hidden" for="${id}-url">URL</label>
        <input id="${id}-url" class="lk-url" type="url" inputmode="url" value="${esc(l.url || "")}" placeholder="https://" autocomplete="off">
        <label class="visually-hidden" for="${id}-label">表示名(任意)</label>
        <input id="${id}-label" class="lk-label" type="text" maxlength="60" value="${esc(l.label || "")}" placeholder="表示名(任意)" autocomplete="off">
        <button type="button" class="lk-remove" aria-label="このリンクを削除">削除</button>
      </div>`;
  }

  function mount(el, links) {
    el.innerHTML = `
      <div class="lk-rows">${(links || []).map(rowHtml).join("")}</div>
      <button type="button" class="ref-btn ghost lk-add">+ リンクを追加</button>
      <p class="lk-hint">提案資料は、Google ドライブなどの「リンクを知っている全員が閲覧可」の共有リンクを貼ってください。Instagram・LINE などはプロフィールのURLです。</p>
      <p class="lk-error" role="alert"></p>`;
    const update = () => { el.querySelector(".lk-add").hidden = el.querySelectorAll(".lk-row").length >= MAX; };
    el.querySelector(".lk-add").addEventListener("click", () => {
      el.querySelector(".lk-rows").insertAdjacentHTML("beforeend", rowHtml(null));
      update();
      const rows = el.querySelectorAll(".lk-row");
      rows[rows.length - 1].querySelector(".lk-url").focus();
    });
    el.addEventListener("click", (e) => {
      const rm = e.target.closest(".lk-remove");
      if (rm) { rm.closest(".lk-row").remove(); update(); }
    });
    update();
  }

  // 入力を取り出す。URL が正しくない行があれば error に理由を入れて返す
  function read(el) {
    const links = [];
    let error = "";
    el.querySelectorAll(".lk-row").forEach((row) => {
      const url = row.querySelector(".lk-url").value.trim();
      if (!url) return;
      const ok = /^https:\/\/\S+$/i.test(url) || /^materials\/[\w.-]+$/.test(url);
      row.querySelector(".lk-url").setAttribute("aria-invalid", ok ? "false" : "true");
      if (!ok) { error = "リンクは https:// から始まるURLを入れてください。"; return; }
      const link = { type: row.querySelector(".lk-type").value, url, label: row.querySelector(".lk-label").value.trim() };
      if (row.dataset.cover) link.cover = row.dataset.cover;
      links.push(link);
    });
    el.querySelector(".lk-error").textContent = error;
    return { links, error };
  }

  return { mount, read };
})();
