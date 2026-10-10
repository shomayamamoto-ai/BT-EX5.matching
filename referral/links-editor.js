// ============================================
// 資料・リンクの入力欄(管理者ページ・自分の情報を編集で共用)
// LinksEditor.mount(要素, links) で表示し、LinksEditor.read(要素) で取り出す。
// URL は https:// から始まるもの(サイト内の資料は materials/ のまま残す)
// ============================================

const LinksEditor = (function () {
  "use strict";

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MAX = 12;
  // すぐ足せる SNS・連絡先
  const QUICK = ["line", "instagram", "x", "facebook", "tiktok", "youtube", "threads", "linkedin", "note"];
  // 貼った URL から種類を決める(LINE なら line.me、など)
  function typeOfUrl(url) {
    const host = String(url || "").trim().replace(/^https?:\/\//i, "");
    const t = LINK_TYPES.find((x) => x.match && x.match.test(host));
    return t ? t.id : "";
  }
  const PLACEHOLDER = {
    line: "https://line.me/ti/p/…(LINE の「友だち追加」のURL)",
    instagram: "https://www.instagram.com/…",
    x: "https://x.com/…",
    facebook: "https://www.facebook.com/…",
    tiktok: "https://www.tiktok.com/@…",
    youtube: "https://www.youtube.com/@…",
    threads: "https://www.threads.net/@…",
    linkedin: "https://www.linkedin.com/in/…",
    note: "https://note.com/…",
  };
  let seq = 0;

  function rowHtml(link) {
    const id = `lk${++seq}`;
    const l = link || { type: "website", url: "", label: "" };
    return `
      <div class="lk-row" data-cover="${esc(l.cover || "")}">
        <label class="visually-hidden" for="${id}-type">種類</label>
        <select id="${id}-type" class="lk-type">${LINK_TYPES.map((t) => `<option value="${t.id}"${t.id === l.type ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</select>
        <label class="visually-hidden" for="${id}-url">URL</label>
        <input id="${id}-url" class="lk-url" type="url" inputmode="url" value="${esc(l.url || "")}" placeholder="${esc(PLACEHOLDER[l.type] || "https://")}" autocomplete="off">
        <label class="visually-hidden" for="${id}-label">表示名(任意)</label>
        <input id="${id}-label" class="lk-label" type="text" maxlength="60" value="${esc(l.label || "")}" placeholder="表示名(任意)" autocomplete="off">
        <button type="button" class="lk-remove" aria-label="このリンクを削除">削除</button>
      </div>`;
  }

  function mount(el, links) {
    el.innerHTML = `
      <div class="lk-rows">${(links || []).map(rowHtml).join("")}</div>
      <div class="lk-quick" aria-label="SNS・連絡先を追加">${QUICK.map((id) => `<button type="button" class="lk-quick-btn" data-type="${id}">+ ${esc(LINK_TYPES.find((t) => t.id === id).label)}</button>`).join("")}</div>
      <button type="button" class="ref-btn ghost lk-add">+ リンクを追加</button>
      <p class="lk-hint">提案資料は、Google ドライブなどの「リンクを知っている全員が閲覧可」の共有リンクを貼ってください。LINE は「友だち追加」のURL(LINE アプリ → ホーム → 友だち追加 → QRコード →「リンクをコピー」)、Instagram・X などはプロフィールのURLです。URL を貼ると種類は自動で選ばれます。</p>
      <p class="lk-error" role="alert"></p>`;
    const update = () => {
      const full = el.querySelectorAll(".lk-row").length >= MAX;
      el.querySelector(".lk-add").hidden = full;
      el.querySelector(".lk-quick").hidden = full;
    };
    const addRow = (link) => {
      el.querySelector(".lk-rows").insertAdjacentHTML("beforeend", rowHtml(link));
      update();
      const rows = el.querySelectorAll(".lk-row");
      rows[rows.length - 1].querySelector(".lk-url").focus();
    };
    el.querySelector(".lk-add").addEventListener("click", () => addRow(null));
    el.querySelector(".lk-quick").addEventListener("click", (e) => {
      const b = e.target.closest(".lk-quick-btn");
      if (b) addRow({ type: b.dataset.type, url: "", label: "" });
    });
    // URL を貼ったら種類を合わせる(資料のときはそのまま)
    el.addEventListener("input", (e) => {
      const input = e.target.closest(".lk-url");
      if (!input) return;
      const row = input.closest(".lk-row");
      const sel = row.querySelector(".lk-type");
      const t = typeOfUrl(input.value);
      if (t && sel.value !== "proposal" && sel.value !== t) sel.value = t;
    });
    el.addEventListener("change", (e) => {
      const sel = e.target.closest(".lk-type");
      if (sel) sel.closest(".lk-row").querySelector(".lk-url").placeholder = PLACEHOLDER[sel.value] || "https://";
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
