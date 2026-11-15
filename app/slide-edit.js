// ============================================
// app/slide-edit.js — 定例会のスライドを「見たまま編集」する(進行役だけ)
//
// スライドの画面の上の「編集」を押すと、いま見ているスライドをその場で直せる:
//   ・文字を押して選ぶ → もう一度押すと書きかえ / つまんで動かす / 大きさ・色 / かくす
//   ・文字や写真を足す(好きな場所に置ける)
//   ・ページを足す・かくす・並べかえる
// 直したところは、スライドの内容の書きかえ(app/deck-edit.js)と同じ場所(saveDeckConfig)に
// 「edits」という名前で保存する。形は:
//   { slides: { [スライドの名札]: { hide, t: [{ f: 元の文字, n: 何番目, to, s, c, x, dx, dy }], add: [{ id, k: "t"|"i", x, y, … }] } },
//     order: [スライドの名札…], custom: [{ id, after, title, body }] }
// スライドを作るコード(app/round.js)は元のまま。出来上がったスライドの上に、ここで直したところを重ねる
// (元の文字が変わったページは、その文字の直しだけが外れて元の内容で出る)。
// ============================================
(function () {
  "use strict";
  const h = App.h;
  const SE = (App.slideEdits = {});
  const clone = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;

  // ---------- スライドの名札(どのスライドの直しかを覚えるための名前) ----------
  // 定例会のスライドは「種類|題」、足したページは「c|番号」、人・タイマーは元のキー。同じ名前が続くときは #2, #3 …
  SE.keys = function (items) {
    const seen = {};
    items.forEach((it) => {
      const base = it.customId ? `c|${it.customId}` : it.kind === "deck" ? `d|${it.type}|${String(it.name || "").replace(/\s+/g, "")}` : `x|${it.key}`;
      seen[base] = (seen[base] || 0) + 1;
      it.skey = seen[base] > 1 ? `${base}#${seen[base]}` : base;
    });
  };

  // 足したページ・並べかえ・かくしたページを、スライドの並びに反映する(全部の並びを返す。かくしたものは hidden: true)
  SE.apply = function (items, edits) {
    SE.keys(items);
    const E = edits && typeof edits === "object" ? edits : null;
    if (!E) return items;
    let list = items.slice();
    // どの区切り(01 はじめの挨拶 など)の中にいるか
    const secOf = (arr) => { const m = new Map(); let cur = ""; arr.forEach((x) => { if (x.kind === "deck" && x.type === "section") cur = x.skey; m.set(x, cur); }); return m; };
    const before = secOf(list);
    (Array.isArray(E.custom) ? E.custom : []).forEach((c) => {
      if (!c || !c.id) return;
      const it = { key: `c:${c.id}`, kind: "deck", type: "custom", name: String(c.title || ""), body: String(c.body || ""), customId: c.id, skey: `c|${c.id}`, step: "" };
      let at = list.findIndex((x) => x.skey === c.after);
      if (at < 0) { const cl = list.findIndex((x) => x.kind === "deck" && x.type === "closing"); at = cl >= 0 ? cl - 1 : list.length - 1; }
      list.splice(at + 1, 0, it);
    });
    if (Array.isArray(E.order) && E.order.length) {
      const pos = new Map(E.order.map((k, i) => [k, i]));
      const out = list.filter((x) => pos.has(x.skey)).sort((a, b) => pos.get(a.skey) - pos.get(b.skey));
      // 並びを決めたあとで増えたスライドは、元の並びで1つ前にいたスライドのうしろへ
      list.forEach((x, i) => {
        if (pos.has(x.skey)) return;
        const prev = list[i - 1];
        out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, x);
      });
      list = out;
    }
    // 別の区切りへ動かしたスライド・足したページは、「進行の場所」を1つ前のスライドに合わせる
    const after = secOf(list);
    list.forEach((it, i) => {
      if (it.kind !== "deck" || it.type === "section") return;
      if (it.type === "custom" || before.get(it) !== after.get(it)) it.step = (list[i - 1] || {}).step || it.step || "定例会";
    });
    const S = E.slides && typeof E.slides === "object" ? E.slides : {};
    list.forEach((it) => { it.hidden = !!(S[it.skey] && S[it.skey].hide); });
    if (!list.some((it) => !it.hidden)) list.forEach((it) => { it.hidden = false; });
    return list;
  };

  // ---------- 足した写真(共有サーバーに置く。番号で読みこむ) ----------
  const imgs = new Map();
  SE.imageUrl = function (id) {
    if (!id) return Promise.resolve("");
    if (!imgs.has(id)) {
      imgs.set(id, App.api("getDeckImage", { id }, { quiet: true }).then((r) => (r && r.data) || "").catch(() => "")
        .then((u) => { if (!u) imgs.delete(id); return u; }));
    }
    return imgs.get(id);
  };
  // スライドを開く前に、使っている写真を先に読みこんでおく
  SE.preload = function (edits) {
    Object.values((edits && edits.slides) || {}).forEach((r) => ((r && r.add) || []).forEach((a) => { if (a && a.k === "i") SE.imageUrl(a.img); }));
  };
  // 写真を小さくして JPEG に(長い辺 1400px まで・約28万文字まで)
  async function fileToJpeg(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ng; im.src = url; });
      const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      let data = "";
      for (const q of [0.82, 0.72, 0.62, 0.5, 0.4, 0.3]) { data = cv.toDataURL("image/jpeg", q); if (data.length < 280000) break; }
      return { data, ratio: cv.height / cv.width };
    } finally { URL.revokeObjectURL(url); }
  }

  // ---------- 文字のかたまり(1つずつ選べる単位)を見つける ----------
  const SKIP = "button, a, select, input, textarea, svg, img, video, canvas, .pd-car-foot, .pd-eyebrow, .se-layer";
  const INL = new Set(["BR", "WBR", "EM", "STRONG"]);
  const onlyText = (n) => [...n.childNodes].every((c) => c.nodeType === 3);
  const simple = (n) => n.nodeType === 3 || (n.nodeType === 1 && (n.tagName === "BR" || n.tagName === "WBR" || onlyText(n)));
  const softInline = (n) => n.nodeType === 3 || (n.nodeType === 1 && (INL.has(n.tagName) || n.matches("span.pd-nw, span.pd-wavy")) && onlyText(n));
  function isUnit(el) {
    const kids = [...el.childNodes];
    if (!kids.length || !el.textContent.trim()) return false;
    // じかに文字がある(ほかは改行・強調などのかんたんなものだけ)
    if (kids.some((n) => n.nodeType === 3 && n.nodeValue.trim())) return kids.every(simple);
    // じかの文字はないが、ことばの区切りや強調だけでできている(「ブレイクアウト/ルーム商談」など)
    return kids.every(softInline) && kids.some((n) => n.nodeType === 1 && n.tagName !== "BR" && n.tagName !== "WBR");
  }
  function findUnits(root) {
    const out = [];
    const walk = (el) => {
      if (el.nodeType !== 1 || el.matches(SKIP)) return;
      if (isUnit(el)) { out.push(el); return; }
      [...el.children].forEach(walk);
    };
    if (root) walk(root);
    return out;
  }
  // 元の文字(改行は \n、強調は《 》)
  function textOf(el) {
    let s = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) s += n.nodeValue;
      else if (n.nodeType === 1) {
        if (n.tagName === "BR") s += "\n";
        else if (n.tagName === "WBR") s += "";
        else if (n.matches("em, .pd-wavy")) s += `《${n.textContent}》`;
        else s += n.textContent;
      }
    });
    return s.replace(/ /g, " ").trim();
  }
  // 文字を、改行(\n)と強調(《 》)つきの中身にする
  function nodes(text, wavy) {
    const out = [];
    String(text).split("\n").forEach((line, i) => {
      if (i) out.push(document.createElement("br"));
      line.split(/《|》/).forEach((x, j) => {
        if (!x) return;
        out.push(j % 2 ? h(wavy ? "span" : "em", wavy ? { class: "pd-wavy" } : null, x) : document.createTextNode(x));
      });
    });
    return out;
  }

  const COLORS = [["", "元の色"], ["#1d1d1f", "黒"], ["#ffffff", "白"], ["#c9962e", "金"], ["#d9534f", "赤"], ["#2f6fdb", "青"], ["#2e9d62", "緑"]];
  const TYPE_NAMES = { movie: "オープニング", cover: "表紙", agenda: "流れ", section: "区切り", staff: "運営", glossary: "用語", custom: "足したページ", closing: "おわり", leader: "あいさつ", photo: "写真", survey: "アンケート" };

  // ---------- スライドの画面につなぐ ----------
  // ctx: { box, slide, people(.all = かくしたものも入った並び), edit: { canEdit, edits, state, setLocal, save, relaunch }, idx(), go(i), fit(), redraw(), relaunch(key, state) }
  SE.attach = function (ctx) {
    const { box, slide, edit } = ctx;
    let state = edit.state || null; // 編集の途中の内容と、取り消しの控え(開き直しても引きつぐ)
    let editing = false, sel = null, typing = null, drag = null, panel = null, pop = null;
    let unitList = [], unitSet = new Set(), root = null, layer = null;
    const E = () => (state ? state.edits : edit.edits) || {};
    const cur = () => ctx.people[ctx.idx()] || null;
    const curKey = () => (cur() || {}).skey || "";
    const customOf = (Eo, p) => (p && p.customId ? ((Eo.custom || []).find((c) => c.id === p.customId) || null) : null);

    const slideRec = (Eo, key, make) => {
      if (!Eo.slides) { if (!make) return null; Eo.slides = {}; }
      if (!Eo.slides[key]) { if (!make) return null; Eo.slides[key] = {}; }
      return Eo.slides[key];
    };
    const unitRec = (Eo, key, uk, make) => {
      const r = slideRec(Eo, key, make);
      if (!r) return null;
      if (!r.t) { if (!make) return null; r.t = []; }
      let e = r.t.find((x) => x.f === uk.f && (x.n || 0) === uk.n);
      if (!e && make) { e = { f: uk.f }; if (uk.n) e.n = uk.n; r.t.push(e); }
      return e || null;
    };
    const freeRec = (Eo, key, id) => { const r = slideRec(Eo, key, false); return (r && (r.add || []).find((a) => a.id === id)) || null; };
    // 空になった記録を消す
    function prune(Eo) {
      Object.keys(Eo.slides || {}).forEach((k) => {
        const r = Eo.slides[k];
        if (r.t) { r.t = r.t.filter((e) => typeof e.to === "string" || e.s || e.c || e.x || e.dx || e.dy); if (!r.t.length) delete r.t; }
        if (r.add && !r.add.length) delete r.add;
        if (!r.hide) delete r.hide;
        if (!Object.keys(r).length) delete Eo.slides[k];
      });
      if (Eo.slides && !Object.keys(Eo.slides).length) delete Eo.slides;
      if (Eo.custom && !Eo.custom.length) delete Eo.custom;
      if (Eo.order && !Eo.order.length) delete Eo.order;
      if (!Eo.order) delete Eo.ov;
    }

    // ---------- スライドに重ねる ----------
    function applyUnit(el, e) {
      if (el._seKids && el !== typing) el.replaceChildren(...el._seKids);
      el.style.zoom = ""; el.style.translate = ""; el.style.color = "";
      el.classList.remove("se-hidden", "se-inl");
      if (!e) return;
      if (typeof e.to === "string" && el !== typing) el.replaceChildren(...nodes(e.to, el._seWavy));
      const s = e.s || 1;
      if (s !== 1) el.style.zoom = String(s);
      if (e.c) el.style.color = e.c;
      if (e.x) el.classList.add("se-hidden");
      if (e.dx || e.dy) {
        if (getComputedStyle(el).display === "inline") el.classList.add("se-inl");
        el.style.translate = `calc(var(--se-w) * ${r3((e.dx || 0) / s)}) calc(var(--se-w) * ${r3((e.dy || 0) / s)})`;
      }
    }
    function freeEl(a) {
      let el;
      if (a.k === "i") {
        el = h("img", { class: "se-free is-img", alt: "", draggable: "false" });
        el.style.width = `${a.w || 30}%`;
        el.addEventListener("load", () => ctx.fit());
        SE.imageUrl(a.img).then((u) => { if (u) el.src = u; else el.classList.add("is-missing"); });
      } else {
        el = h("div", { class: "se-free is-text" }, ...nodes(a.text || "", false));
        el.style.fontSize = `calc(var(--se-w) * ${r3((a.fs || 3) / 100)})`;
        if (a.c) el.style.color = a.c;
      }
      el.style.left = `${a.x}%`; el.style.top = `${a.y}%`;
      el._seFree = a.id;
      return el;
    }
    function setVars() { if (root) root.style.setProperty("--se-w", `${root.offsetWidth}px`); }
    // スライドを描いたすぐあと(大きさを合わせる前)に呼ぶ
    function paint() {
      const p = cur();
      const keep = sel ? (sel.free ? { free: sel.free } : sel.el._seKey) : null;
      sel = null; typing = null; drag = null;
      unitList = []; unitSet = new Set(); root = null; layer = null;
      if (p && p.kind === "deck") {
        root = slide.firstElementChild;
        if (root && root.classList.contains("pd")) {
          const rec = (E().slides || {})[p.skey] || {};
          setVars();
          const count = {};
          findUnits(root).forEach((el) => {
            const f = el.dataset.seField ? `@${el.dataset.seField}` : textOf(el);
            if (!f) return;
            const n = count[f] || 0; count[f] = n + 1;
            el._seKey = { f, n };
            el._seKids = [...el.childNodes];
            el._seWavy = !!el.querySelector(".pd-wavy");
            unitList.push(el); unitSet.add(el);
            if (editing) el.classList.add("se-unit");
            const e = (rec.t || []).find((x) => x.f === f && (x.n || 0) === n);
            if (e) applyUnit(el, e);
          });
          if ((rec.add || []).length || editing) {
            layer = h("div", { class: "se-layer" }, (rec.add || []).map(freeEl));
            root.classList.add("se-host");
            root.append(layer);
          }
        } else root = null;
      }
      if (editing) {
        if (keep) {
          const el = keep.free ? (layer ? [...layer.children].find((x) => x._seFree === keep.free) : null) : unitList.find((x) => x._seKey.f === keep.f && x._seKey.n === keep.n);
          if (el) { sel = { el, free: el._seFree || null }; el.classList.add("se-sel"); }
        }
        drawBar();
      }
    }
    const onResize = () => setVars();
    window.addEventListener("resize", onResize);

    // ---------- 保存(少し待ってからまとめて。開き直しても続くように、控えは state に置く) ----------
    const statusEl = h("span", { class: "se-status", "aria-live": "polite" });
    function showStatus(x) {
      statusEl.dataset.state = x || "";
      statusEl.textContent = x === "saving" ? "保存中…" : x === "saved" ? "保存しました" : x === "error" ? "保存できていません" : "";
    }
    function setStatus(x) { state.status = x; if (state.onStatus) state.onStatus(x); }
    async function doSave() {
      clearTimeout(state.timer); state.timer = 0;
      if (state.busy) { state.again = true; return; }
      state.busy = true;
      let ok = false;
      try { ok = await edit.save(state.edits); } catch { ok = false; }
      state.busy = false;
      if (state.again) { state.again = false; doSave(); return; }
      state.dirty = !ok;
      setStatus(ok ? "saved" : "error");
    }
    function scheduleSave() { state.dirty = true; setStatus("saving"); clearTimeout(state.timer); state.timer = setTimeout(doSave, 700); }
    function flush() { if (state && state.timer) doSave(); }

    // 変更を1つ行う(取り消しの控えを取り、保存を予約する)。opt.rebuild: 並びが変わるので、スライドを開き直す
    function change(fn, opt = {}) {
      state.undo.push(JSON.stringify(state.edits));
      if (state.undo.length > 60) state.undo.shift();
      fn(state.edits);
      prune(state.edits);
      edit.setLocal(state.edits);
      scheduleSave();
      if (opt.rebuild) { rebuild(opt.at); return; }
      drawBar();
    }
    function rebuild(at) { closePanel(); ctx.relaunch(at || curKey(), state); }
    const structKey = (Eo) => JSON.stringify([Eo.order || 0, (Eo.custom || []).map((c) => [c.id, c.after]), Object.keys(Eo.slides || {}).filter((k) => Eo.slides[k].hide).sort()]);
    // 足したページの題・文を、いまの内容に合わせ直す(取り消しのあと)
    function syncCustom() {
      (ctx.people.all || ctx.people).forEach((it) => { const c = customOf(E(), it); if (c) { it.name = String(c.title || ""); it.body = String(c.body || ""); } });
    }
    function undo() {
      finishText();
      const raw = state.undo.pop();
      if (!raw) return;
      const was = structKey(state.edits);
      state.edits = JSON.parse(raw);
      edit.setLocal(state.edits);
      scheduleSave();
      if (structKey(state.edits) !== was) { rebuild(); return; }
      syncCustom();
      ctx.redraw();
    }

    // ---------- 選ぶ ----------
    function select(el) {
      if (sel && sel.el) sel.el.classList.remove("se-sel");
      sel = el ? { el, free: el._seFree || null } : null;
      if (el) el.classList.add("se-sel");
      closePop();
      drawBar();
    }
    const selFree = () => (sel && sel.free ? freeRec(E(), curKey(), sel.free) : null);
    const selRec = () => (sel && !sel.free ? unitRec(E(), curKey(), sel.el._seKey, false) : null);
    const selIsText = () => !!sel && (!sel.free || (selFree() || {}).k !== "i");

    // ---------- 文字を書きかえる ----------
    function startText(el) {
      if (!editing || !el || typing === el) return;
      finishText();
      const p = cur();
      let raw;
      if (el._seFree) raw = (freeRec(E(), curKey(), el._seFree) || {}).text || "";
      else if (el._seKey.f[0] === "@") raw = String((p && (el._seKey.f === "@title" ? p.name : p.body)) || "");
      else { const e = unitRec(E(), curKey(), el._seKey, false); raw = e && typeof e.to === "string" ? e.to : el._seKey.f; }
      typing = el;
      el._seRaw = raw;
      const ws = getComputedStyle(el).whiteSpace;
      el.style.whiteSpace = /^(nowrap|pre)$/.test(ws) ? "pre" : "pre-wrap";
      el.replaceChildren(document.createTextNode(raw));
      el.classList.add("se-typing");
      try { el.contentEditable = "plaintext-only"; } catch { el.contentEditable = "true"; }
      if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
      el.focus({ preventScroll: true });
      try { const rg = document.createRange(); rg.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); } catch { /* noop */ }
      drawBar();
    }
    function finishText() {
      const el = typing;
      if (!el) return;
      const text = String(el.innerText || "").replace(/\r/g, "").replace(/ /g, " ").replace(/^\n+|\n+$/g, "").replace(/[ \t]+$/gm, "");
      typing = null;
      el.removeAttribute("contenteditable"); el.classList.remove("se-typing"); el.style.whiteSpace = "";
      try { getSelection().removeAllRanges(); } catch { /* noop */ }
      const key = curKey(), p = cur(), raw = el._seRaw;
      if (el._seFree) {
        const id = el._seFree;
        if (!text) { change((Eo) => { const r = slideRec(Eo, key, false); if (r && r.add) r.add = r.add.filter((a) => a.id !== id); }); el.remove(); if (sel && sel.el === el) select(null); return; }
        if (text !== raw) change((Eo) => { const a = freeRec(Eo, key, id); if (a) a.text = text; });
        el.replaceChildren(...nodes(text, false));
      } else if (el._seKey.f[0] === "@") {
        // 足したページの題・文は、そのページの内容として持つ
        const field = el._seKey.f === "@title" ? "title" : "body";
        const val = text || raw;
        if (val !== raw) {
          change((Eo) => { const c = customOf(Eo, p); if (c) c[field] = val; });
          if (field === "title") p.name = val; else p.body = val;
        }
        el._seKids = nodes(val, false);
        applyUnit(el, unitRec(E(), key, el._seKey, false));
      } else {
        const uk = el._seKey;
        if (!text) change((Eo) => { unitRec(Eo, key, uk, true).x = 1; }); // ぜんぶ消したら「かくす」
        else if (text !== raw) change((Eo) => { const e = unitRec(Eo, key, uk, true); if (text === uk.f) delete e.to; else e.to = text; });
        applyUnit(el, unitRec(E(), key, uk, false));
      }
      ctx.fit();
      drawBar();
    }

    // ---------- 大きさ・色・かくす・元に戻す ----------
    function resize(f) {
      if (!sel) return;
      const key = curKey();
      if (sel.free) {
        const id = sel.free, el = sel.el;
        change((Eo) => { const a = freeRec(Eo, key, id); if (!a) return; if (a.k === "i") a.w = r3(clamp((a.w || 30) * f, 4, 100)); else a.fs = r3(clamp((a.fs || 3) * f, 0.8, 24)); });
        const a = selFree();
        if (a && a.k === "i") el.style.width = `${a.w}%`; else if (a) el.style.fontSize = `calc(var(--se-w) * ${r3(a.fs / 100)})`;
      } else {
        const uk = sel.el._seKey;
        change((Eo) => { const e = unitRec(Eo, key, uk, true); e.s = Math.round(clamp((e.s || 1) * f, 0.4, 3) * 100) / 100; if (e.s === 1) delete e.s; });
        applyUnit(sel.el, selRec());
      }
      ctx.fit();
    }
    function recolor(c) {
      if (!sel || !selIsText()) return;
      const key = curKey();
      if (sel.free) {
        const id = sel.free;
        change((Eo) => { const a = freeRec(Eo, key, id); if (a) { if (c) a.c = c; else delete a.c; } });
        sel.el.style.color = c || "";
      } else {
        const uk = sel.el._seKey;
        change((Eo) => { const e = unitRec(Eo, key, uk, true); if (c) e.c = c; else delete e.c; });
        applyUnit(sel.el, selRec());
      }
      closePop();
    }
    function toggleHide() {
      if (!sel) return;
      const key = curKey();
      if (sel.free) { removeFree(); return; }
      const uk = sel.el._seKey;
      change((Eo) => { const e = unitRec(Eo, key, uk, true); if (e.x) delete e.x; else e.x = 1; });
      applyUnit(sel.el, selRec());
      ctx.fit();
    }
    function removeFree() {
      if (!sel || !sel.free) return;
      const key = curKey(), id = sel.free, el = sel.el;
      change((Eo) => { const r = slideRec(Eo, key, false); if (r && r.add) r.add = r.add.filter((a) => a.id !== id); });
      el.remove(); select(null);
    }
    function resetUnit() {
      if (!sel || sel.free) return;
      const key = curKey(), uk = sel.el._seKey;
      change((Eo) => { const r = slideRec(Eo, key, false); if (r && r.t) r.t = r.t.filter((x) => !(x.f === uk.f && (x.n || 0) === uk.n)); });
      applyUnit(sel.el, null);
      ctx.fit();
    }

    // ---------- 足す ----------
    function ensureLayer() {
      if (layer || !root) return;
      layer = h("div", { class: "se-layer" });
      root.classList.add("se-host");
      root.append(layer);
    }
    function addFree(a) {
      const key = curKey();
      change((Eo) => { const r = slideRec(Eo, key, true); if (!r.add) r.add = []; r.add.push(a); });
      ensureLayer();
      const el = freeEl(a);
      layer.append(el);
      select(el);
      return el;
    }
    function addText() {
      if (!root) return;
      finishText();
      const n = ((slideRec(E(), curKey(), false) || {}).add || []).length;
      const el = addFree({ id: uid(), k: "t", x: 36 + (n % 4) * 3, y: 42 + (n % 4) * 5, fs: 3, text: "ここに文字" });
      startText(el);
    }
    const fileIn = h("input", { type: "file", accept: "image/*", hidden: true });
    fileIn.addEventListener("change", async () => {
      const f = fileIn.files && fileIn.files[0];
      fileIn.value = "";
      if (!f || !root) return;
      App.toast("写真を入れています…");
      let img;
      try { img = await fileToJpeg(f); } catch { App.toast("この写真は読みこめませんでした", "error"); return; }
      const r = await App.api("saveDeckImage", { data: img.data }, { quiet: true, raw: true });
      if (!r || r.success === false || !r.id) {
        const msg = r && r.error && r.error.code === "INVALID_REQUEST" && r.error.userMessage;
        App.toast(msg || "写真を保存できませんでした。共有サーバー(GAS)の更新がまだのときは、更新のあとでお試しください", "error");
        return;
      }
      imgs.set(r.id, Promise.resolve(img.data));
      const n = ((slideRec(E(), curKey(), false) || {}).add || []).length;
      // はじめの大きさ: 横はスライドの36%まで、縦長の写真は高さがスライドの半分ほどに収まる幅に
      const w = r3(clamp(Math.min(36, (48 * root.offsetHeight) / Math.max(1, root.offsetWidth * img.ratio)), 8, 60));
      addFree({ id: uid(), k: "i", img: r.id, x: r3(50 - w / 2 + (n % 4) * 3), y: 26 + (n % 4) * 4, w });
    });
    function addPhoto() { if (!root) return; finishText(); fileIn.click(); }
    function addPage() {
      finishText();
      const id = uid(), after = curKey();
      change((Eo) => {
        if (!Eo.custom) Eo.custom = [];
        Eo.custom.push({ id, after, title: "新しいページ", body: "ここに文を入れます" });
        if (Eo.order) { const at = Eo.order.indexOf(after); Eo.order.splice(at >= 0 ? at + 1 : Eo.order.length, 0, `c|${id}`); }
      }, { rebuild: true, at: `c|${id}` });
    }
    // ---------- ページをかくす・消す ----------
    function nextKey() { const i = ctx.idx(); const n = ctx.people[i + 1] || ctx.people[i - 1]; return n ? n.skey : ""; }
    function hidePage() {
      finishText();
      if (ctx.people.length < 2) { App.toast("最後の1ページはかくせません", "error"); return; }
      const key = curKey(), at = nextKey();
      change((Eo) => { slideRec(Eo, key, true).hide = true; }, { rebuild: true, at });
      App.toast("このページをかくしました(「ページ」の一覧から戻せます)");
    }
    function dropCustom(Eo, it) {
      Eo.custom = (Eo.custom || []).filter((c) => c.id !== it.customId);
      if (Eo.slides) delete Eo.slides[it.skey];
      if (Eo.order) Eo.order = Eo.order.filter((k) => k !== it.skey);
      // このページのうしろに足したページは、1つ前のページのうしろへ付けかえる
      (Eo.custom || []).forEach((c) => { if (c.after === it.skey) c.after = (Eo.custom.find((x) => x.id === it.customId) || {}).after || ""; });
    }
    async function deletePage() {
      finishText();
      const p = cur();
      if (!p || !p.customId) return;
      if (!(await App.confirm("このページを消しますか?(足した文字や写真もいっしょに消えます)", { ok: "消す", danger: true }))) return;
      const at = nextKey();
      const all = ctx.people.all || ctx.people;
      const prev = all[all.indexOf(p) - 1];
      change((Eo) => {
        (Eo.custom || []).forEach((c) => { if (c.after === p.skey) c.after = prev ? prev.skey : ""; });
        dropCustom(Eo, p);
      }, { rebuild: true, at });
    }

    // ---------- ページの一覧(順番・出す/かくす) ----------
    function closePanel() { if (panel) { panel.remove(); panel = null; } }
    function openPanel() {
      finishText(); closePop();
      if (panel) { closePanel(); return; }
      const all = (ctx.people.all || ctx.people).slice();
      let order = all.slice();
      const hidden = new Set(all.filter((x) => x.hidden).map((x) => x.skey));
      const gone = new Set();
      const start = JSON.stringify([order.map((x) => x.skey), [...hidden]]);
      const listEl = h("ol", { class: "se-pages-list" });
      const nameOf = (it) => {
        if (it.kind !== "deck") return it.kind === "timer" ? String(it.name || "タイマー") : `${it.name || ""}さん`;
        const c = customOf(E(), it);
        return String((c ? c.title : it.name) || TYPE_NAMES[it.type] || "").replace(/\s*\n\s*/g, " ");
      };
      const move = (i, d) => {
        // 人・タイマーの列は、まとめて飛びこえる
        let j = i + d;
        while (j > 0 && j < order.length - 1 && order[j].kind !== "deck") j += d;
        if (j < 0 || j >= order.length) return;
        const [x] = order.splice(i, 1);
        order.splice(j, 0, x);
        draw(x);
      };
      function draw(focusIt) {
        const now = cur();
        App.fill(listEl, order.map((it, i) => {
          if (gone.has(it.skey)) return null;
          const deck = it.kind === "deck";
          const off = hidden.has(it.skey);
          const li = h("li", { class: `se-page${deck ? "" : " is-person"}${off ? " is-off" : ""}${it === now ? " is-now" : ""}` },
            h("button", { type: "button", class: "se-page-name", disabled: !deck && false, onclick: () => apply(it.skey) },
              h("span", { class: "se-page-no" }, String(i + 1)),
              deck && TYPE_NAMES[it.type] ? h("span", { class: "se-page-kind" }, TYPE_NAMES[it.type]) : null,
              h("span", { class: "se-page-title" }, nameOf(it))),
            deck ? h("span", { class: "se-page-tools" },
              h("button", { type: "button", title: "前へ", "aria-label": "前へ", disabled: i === 0, onclick: () => move(i, -1) }, "↑"),
              h("button", { type: "button", title: "うしろへ", "aria-label": "うしろへ", disabled: i === order.length - 1, onclick: () => move(i, 1) }, "↓"),
              h("button", { type: "button", class: "se-page-eye", "aria-pressed": off ? "false" : "true", onclick: () => { if (off) hidden.delete(it.skey); else hidden.add(it.skey); draw(it); } }, off ? "出す" : "かくす"),
              it.customId ? h("button", { type: "button", class: "is-danger", title: "このページを消す", onclick: () => { gone.add(it.skey); draw(); } }, "消す") : null) : null);
          if (it === focusIt) requestAnimationFrame(() => li.scrollIntoView({ block: "nearest" }));
          return li;
        }));
      }
      // 決定: 並び・出す/かくす・消すを、まとめて反映する。goKey: そのページを開く
      function apply(goKey) {
        const keys = order.filter((x) => !gone.has(x.skey)).map((x) => x.skey);
        const next = JSON.stringify([order.map((x) => x.skey), [...hidden]]);
        if (next === start && !gone.size) {
          closePanel();
          if (goKey) { const i = ctx.people.findIndex((x) => x.skey === goKey); if (i >= 0) ctx.go(i); }
          return;
        }
        if (keys.every((k) => hidden.has(k))) { App.toast("ぜんぶのページはかくせません", "error"); return; }
        let at = goKey && !hidden.has(goKey) && !gone.has(goKey) ? goKey : curKey();
        if (hidden.has(at) || gone.has(at)) at = keys.find((k) => !hidden.has(k)) || "";
        const moved = JSON.stringify(order.map((x) => x.skey)) !== JSON.stringify(all.map((x) => x.skey));
        change((Eo) => {
          order.forEach((it) => { if (gone.has(it.skey)) dropCustom(Eo, it); });
          if (moved || Eo.order) { Eo.order = keys; Eo.ov = 2; } // ov: 並びの版(2 = ムービーは表紙のあと)
          keys.forEach((k) => {
            const r = slideRec(Eo, k, hidden.has(k));
            if (r) { if (hidden.has(k)) r.hide = true; else delete r.hide; }
          });
        }, { rebuild: true, at });
      }
      async function resetAll() {
        if (!(await App.confirm("「見たまま編集」で直したところをすべて消して、元のスライドに戻しますか?(足したページ・文字・写真も消えます)", { ok: "すべて元に戻す", danger: true }))) return;
        change((Eo) => { Object.keys(Eo).forEach((k) => delete Eo[k]); }, { rebuild: true });
      }
      function resetPage() {
        const key = curKey();
        closePanel();
        change((Eo) => { const r = slideRec(Eo, key, false); if (r) { delete r.t; delete r.add; } });
        ctx.redraw();
        App.toast("このページの文字・足したものを元に戻しました");
      }
      panel = h("aside", { class: "se-pages", role: "dialog", "aria-label": "ページの一覧" },
        h("header", { class: "se-pages-head" }, h("b", null, "ページの一覧"), h("button", { type: "button", class: "se-pages-x", "aria-label": "とじる", onclick: closePanel }, "×")),
        h("p", { class: "se-pages-hint" }, "↑↓で順番を変え、「かくす」で出さないページを決めます。名前を押すと、そのページを開きます。"),
        listEl,
        h("footer", { class: "se-pages-foot" },
          h("button", { type: "button", class: "se-tool is-main", onclick: () => apply("") }, "この並びにする"),
          h("button", { type: "button", class: "se-tool", onclick: resetPage }, "このページを元に戻す"),
          h("button", { type: "button", class: "se-tool is-danger", onclick: resetAll }, "すべて元に戻す")));
      box.append(panel);
      draw(cur());
    }

    // ---------- 色のえらび ----------
    function closePop() { if (pop) { pop.remove(); pop = null; } }
    function openColors(btn) {
      if (pop) { closePop(); return; }
      const now = sel.free ? (selFree() || {}).c || "" : (selRec() || {}).c || "";
      pop = h("div", { class: "se-pop", role: "listbox", "aria-label": "文字の色" }, COLORS.map(([c, name]) =>
        h("button", { type: "button", class: `se-swatch${c ? "" : " is-none"}${c === now ? " is-on" : ""}`, title: name, "aria-label": name, style: c ? `background:${c}` : "", onclick: () => recolor(c) }, c ? "" : "元")));
      box.append(pop);
      const r = btn.getBoundingClientRect();
      pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left))}px`;
      pop.style.top = `${r.bottom + 6}px`;
    }

    // ---------- 上の道具の帯 ----------
    const bar = h("div", { class: "se-bar", role: "toolbar", "aria-label": "スライドの編集" });
    const tool = (label, onclick, o = {}) => h("button", Object.assign({ type: "button", class: `se-tool${o.cls ? ` ${o.cls}` : ""}`, onclick }, o.title ? { title: o.title } : {}, o.off ? { disabled: true } : {}), label);
    function drawBar() {
      if (!editing) return;
      const p = cur();
      const deck = !!root;
      const has = !!sel;
      const txt = has && selIsText();
      const rec = selRec();
      const hid = !!(rec && rec.x);
      const colorBtn = tool("色", () => openColors(colorBtn), { off: !txt });
      App.fill(bar,
        h("div", { class: "se-group" }, h("span", { class: "se-label" }, "足す"),
          tool("＋ 文字", addText, { off: !deck }), tool("＋ 写真", addPhoto, { off: !deck }), tool("＋ ページ", addPage)),
        h("div", { class: `se-group${has ? " is-sel" : ""}` }, h("span", { class: "se-label" }, has ? "選んだもの" : deck ? "文字を押して選ぶ" : "このページは直せません"),
          tool("書く", () => startText(sel.el), { off: !txt || !!typing }),
          tool("小さく", () => resize(1 / 1.12), { off: !has }), tool("大きく", () => resize(1.12), { off: !has }),
          colorBtn,
          has && sel.free ? tool("消す", removeFree) : tool(hid ? "出す" : "かくす", toggleHide, { off: !has }),
          tool("元に戻す", resetUnit, { off: !rec, title: "選んだ文字を、元の文字・大きさ・場所に戻す" })),
        h("div", { class: "se-group" }, h("span", { class: "se-label" }, "ページ"),
          tool("一覧・順番", openPanel), tool("かくす", hidePage, { title: "このページを出さないようにする" }),
          p && p.customId ? tool("消す", deletePage, { cls: "is-danger", title: "足したページを消す" }) : null),
        h("div", { class: "se-group is-end" },
          tool("取り消し", undo, { off: !state.undo.length, title: "1つ前の状態に戻す" }),
          statusEl,
          tool("編集を終わる", stop, { cls: "is-main" })));
    }

    // ---------- 押す・つまんで動かす ----------
    function targetOf(t) {
      if (!(t instanceof Element)) return null;
      const f = t.closest(".se-free");
      if (f && slide.contains(f)) return f;
      for (let el = t; el && el !== slide; el = el.parentElement) if (unitSet.has(el)) return el;
      return null;
    }
    function onDown(e) {
      if (!editing || e.button) return;
      closePop();
      if (typing) { if (typing.contains(e.target)) return; finishText(); }
      if (e.target.closest && e.target.closest(".pd-car-foot, .pd-car-btn")) return;
      const el = targetOf(e.target);
      if (!el) { select(null); return; }
      const was = !!sel && sel.el === el;
      select(el);
      const rr = root.getBoundingClientRect(), er = el.getBoundingClientRect();
      const rec = el._seFree ? null : unitRec(E(), curKey(), el._seKey, false);
      drag = { el, id: e.pointerId, x: e.clientX, y: e.clientY, was, moved: false, rw: rr.width || 1, rh: rr.height || 1, rl: rr.left, rt: rr.top, ox: e.clientX - er.left, oy: e.clientY - er.top,
        dx0: (rec && rec.dx) || 0, dy0: (rec && rec.dy) || 0, s: (rec && rec.s) || 1 };
      e.preventDefault();
    }
    function onMove(e) {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      const mx = e.clientX - d.x, my = e.clientY - d.y;
      if (!d.moved && Math.hypot(mx, my) < 6) return;
      if (!d.moved) { d.moved = true; d.el.classList.add("se-dragging"); }
      if (d.el._seFree) {
        d.nx = r3(clamp(((e.clientX - d.ox - d.rl) / d.rw) * 100, -20, 100));
        d.ny = r3(clamp(((e.clientY - d.oy - d.rt) / d.rh) * 100, -20, 100));
        d.el.style.left = `${d.nx}%`; d.el.style.top = `${d.ny}%`;
      } else {
        d.nx = r3(d.dx0 + mx / d.rw); d.ny = r3(d.dy0 + my / d.rw);
        if (getComputedStyle(d.el).display === "inline") d.el.classList.add("se-inl");
        d.el.style.translate = `calc(var(--se-w) * ${r3(d.nx / d.s)}) calc(var(--se-w) * ${r3(d.ny / d.s)})`;
      }
    }
    function onUp(e) {
      const d = drag;
      if (!d || (e.pointerId !== undefined && e.pointerId !== d.id)) return;
      drag = null;
      d.el.classList.remove("se-dragging");
      if (!d.moved) { if (d.was && selIsText()) startText(d.el); return; }
      const key = curKey();
      if (d.el._seFree) { const id = d.el._seFree; change((Eo) => { const a = freeRec(Eo, key, id); if (a) { a.x = d.nx; a.y = d.ny; } }); }
      else {
        const uk = d.el._seKey;
        change((Eo) => { const r = unitRec(Eo, key, uk, true); r.dx = d.nx; r.dy = d.ny; if (!r.dx) delete r.dx; if (!r.dy) delete r.dy; });
        applyUnit(d.el, unitRec(E(), key, uk, false));
      }
    }
    // 指でスライドを上下に送りはじめたときなど(動かすのをやめて、元の場所に戻す)
    function onCancel() {
      const d = drag;
      if (!d) return;
      drag = null;
      d.el.classList.remove("se-dragging");
      if (d.moved) ctx.redraw();
    }
    // 編集のあいだは、スライドの中のボタン・リンクは動かさない(カードを送るボタンだけは使える)
    function onClick(e) {
      if (!editing) return;
      if (e.target.closest && e.target.closest(".pd-car-foot, .pd-car-btn")) return;
      e.preventDefault(); e.stopPropagation();
    }
    function onDbl(e) { if (!editing) return; const el = targetOf(e.target); if (el && el !== typing) { select(el); if (selIsText()) startText(el); } }
    function onKey(e) {
      if (!editing) return;
      if (typing) {
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); finishText(); }
        e.stopPropagation(); // 文字を打っているあいだは、スライドを送らない
        return;
      }
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        if (pop) closePop(); else if (panel) closePanel(); else if (sel) select(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault(); e.stopPropagation();
        if (sel.free) removeFree(); else if (!(selRec() || {}).x) toggleHide();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopPropagation(); undo(); }
      else if (e.key === "Enter" && sel && selIsText()) { e.preventDefault(); e.stopPropagation(); startText(sel.el); }
    }
    function onPaste(e) {
      if (!typing) return;
      // 貼りつけは文字だけ(かざりは入れない)
      const t = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
      e.preventDefault();
      try { document.execCommand("insertText", false, t); } catch { /* noop */ }
    }
    const onBlur = (e) => { if (typing && e.target === typing) setTimeout(() => { if (typing && document.activeElement !== typing) finishText(); }, 0); };

    // ---------- 編集をはじめる・終わる ----------
    function start() {
      if (editing || !edit.canEdit) return;
      if (!state) state = edit.state = { edits: clone(edit.edits || {}) || {}, undo: [] };
      state.onStatus = showStatus;
      showStatus(state.status === "saving" || state.status === "error" ? state.status : "");
      editing = true;
      box.classList.add("is-editing");
      const top = box.querySelector(".pr-top");
      top.after(bar);
      box.append(fileIn);
      slide.addEventListener("pointerdown", onDown);
      slide.addEventListener("click", onClick, true);
      slide.addEventListener("dblclick", onDbl);
      slide.addEventListener("paste", onPaste);
      slide.addEventListener("focusout", onBlur);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      document.addEventListener("keydown", onKey, true);
      drawBar();
      ctx.redraw();
      window.dispatchEvent(new Event("resize"));
    }
    function unbind() {
      slide.removeEventListener("pointerdown", onDown);
      slide.removeEventListener("click", onClick, true);
      slide.removeEventListener("dblclick", onDbl);
      slide.removeEventListener("paste", onPaste);
      slide.removeEventListener("focusout", onBlur);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKey, true);
    }
    function stop() {
      if (!editing) return;
      finishText(); closePanel(); closePop();
      flush();
      editing = false; sel = null;
      box.classList.remove("is-editing");
      bar.remove(); fileIn.remove();
      unbind();
      ctx.redraw();
      window.dispatchEvent(new Event("resize"));
    }
    function destroy() {
      if (editing) { try { finishText(); } catch { /* noop */ } unbind(); editing = false; }
      flush();
      if (state && state.onStatus === showStatus) state.onStatus = null;
      window.removeEventListener("resize", onResize);
    }
    return { paint, start, stop, destroy, editing: () => editing };
  };
})();
