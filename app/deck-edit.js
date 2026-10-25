// ============================================
// app/deck-edit.js — 定例会のスライドの内容を編集する(進行役だけ)
// 元の内容は referral/data.js の BTEX_DECK。書きかえたところだけを共有サーバーに保存し
// (getDeckConfig / saveDeckConfig)、スライドを作るときに元の内容の上に重ねる。
// 保存の形は { "leader.kana": "…", "schedule.rows": [["第一水曜日", "13:00-15:00"]], … }(場所 → 値)
// ============================================
(function () {
  "use strict";
  const h = App.h;
  const base = () => (typeof BTEX_DECK !== "undefined" ? BTEX_DECK : {});
  const clone = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split(".");
    let o = obj;
    keys.slice(0, -1).forEach((k, i) => {
      if (o[k] === null || typeof o[k] !== "object") o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[k];
    });
    o[keys[keys.length - 1]] = value;
  }

  // 元の内容に、書きかえたところを重ねる
  App.deckData = function (cfg) {
    const d = clone(base());
    if (cfg && typeof cfg === "object") Object.keys(cfg).forEach((path) => { try { setPath(d, path, clone(cfg[path])); } catch { /* noop */ } });
    return d;
  };
  App.loadDeckConfig = async function () {
    const r = await App.api("getDeckConfig", {}, { quiet: true });
    return r ? { config: r.config || null, canEdit: !!r.canEdit } : { config: null, canEdit: false };
  };

  // ---------- 入力欄の形 ----------
  // lines: 1行に1つ / text: 1行 / paras: 段落(空の行で区切る。段落の中の改行はそのまま)
  // pairs: 「左|右」を1行に1つ / heads: 「見出し|文」を1行に1つ / blocks: 1行目が題、続く行が中身。空の行で区切る
  const SEP = /\s*[|｜]\s*/;
  // 1行に1つの欄では、項目の中の改行を「↵」で書く(スライドではそこで改行する)
  const enc = (v) => String(v || "").replace(/\n/g, "↵");
  const dec = (v) => String(v || "").replace(/\s*↵\s*/g, "\n");
  const TYPES = {
    text: { rows: 1, to: (v) => enc(v), from: (s) => dec(s.trim()) },
    lines: { rows: 5, to: (v) => (v || []).map(enc).join("\n"), from: (s) => s.split("\n").map((x) => x.trim()).filter(Boolean).map(dec) },
    paras: { rows: 9, to: (v) => (v || []).join("\n\n"), from: (s) => s.split(/\n\s*\n/).map((x) => x.split("\n").map((y) => y.trim()).join("\n").trim()).filter(Boolean) },
    pairs: { rows: 4, to: (v) => (v || []).map((r) => r.join(" | ")).join("\n"), from: (s) => s.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => { const [a, ...b] = x.split(SEP); return [a, b.join(" ")]; }) },
    heads: { rows: 9, to: (v) => (v || []).map((r) => (typeof r === "string" ? r : `${r.head} | ${r.text}`)).join("\n"), from: (s) => s.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => { const [a, ...b] = x.split(SEP); return b.length ? { head: a, text: b.join(" ") } : { head: "", text: a }; }) },
    // multi: 改行をそのまま(スライドの改行になる)
    multi: { rows: 3, to: (v) => String(v || ""), from: (s) => s.split("\n").map((x) => x.trim()).join("\n").trim() },
    // cards: 1行目が見出し、続く行が文(文の中の改行はそのまま)。空の行で区切る。見出しだけのときは1行
    cards: { rows: 12, to: (v) => (v || []).map((r) => (typeof r === "string" ? r : [r.head, r.text].filter(Boolean).join("\n"))).join("\n\n"),
      from: (s) => s.split(/\n\s*\n/).map((x) => x.split("\n").map((y) => y.trim()).filter(Boolean)).filter((x) => x.length).map(([a, ...b]) => (b.length ? { head: a, text: b.join("\n") } : { head: "", text: a })) },
    blocks: { rows: 9, key: "title", to: (v, f) => (v || []).map((b) => [b[f.key || "title"], ...(b[f.items || "lines"] || [])].map(enc).join("\n")).join("\n\n"),
      from: (s, f) => s.split(/\n\s*\n/).map((x) => x.split("\n").map((y) => y.trim()).filter(Boolean).map(dec)).filter((x) => x.length).map(([t, ...rest]) => ({ [f.key || "title"]: t, [f.items || "lines"]: rest })) },
  };
  const SECTIONS = [
    ["用語説明(いちばんはじめのページ)", [
      { path: "glossary.title", label: "題", type: "text" },
      { path: "glossary.items", label: "言葉と説明(「言葉 | 説明」を1行に1つ)", type: "heads" },
    ]],
    ["代表の紹介(はじめの挨拶)", [
      { path: "leader.title", label: "肩書き", type: "text" },
      { path: "leader.kana", label: "ふりがな", type: "text" },
      { path: "leader.achievements", label: "実績(1行に1つ)", type: "lines" },
      { path: "leader.now", label: "現在(1行に1つ)", type: "lines" },
      { path: "leader.dreams", label: "想い・夢(1行に1つ)", type: "lines" },
    ]],
    ["BT-EXとは・理念とビジョン", [
      { path: "about", label: "BT-EXとは(段落は空の行で区切る。段落の中の改行はそのままスライドの改行になります)", type: "paras" },
      { path: "philosophy", label: "理念(改行はそのままスライドの改行になります)", type: "multi" },
      { path: "vision", label: "ビジョン(改行はそのままスライドの改行になります)", type: "multi" },
      { path: "purposes", label: "目的(空の行で区切る。中の改行はそのままスライドの改行になります)", type: "paras" },
      { path: "feature.lines", label: "BT-EX5 の特徴(1行目が大きな文、2行目は「新潟 ⇔ 東京」のように ⇔ でつなぐと図になります)", type: "lines" },
      { path: "benefits", label: "仕組みとベネフィット(1行目が見出し、続く行が文。空の行で区切る。文の中の改行はそのままスライドの改行になります)", type: "cards" },
      { path: "activities", label: "主な3つの活動(1行目が題、続く行が説明。空の行で区切る)", type: "blocks" },
    ]],
    ["規定とスケジュール", [
      { path: "rules.general", label: "一般規定(1行に1つ。《 》で囲むと強調)", type: "lines" },
      { path: "rules.heads.general", label: "一般規定のカードの見出し(1行に1つ。上の規定と同じ順)", type: "lines" },
      { path: "rules.attendance", label: "出席規定(1行に1つ。《 》で囲むと強調)", type: "lines" },
      { path: "rules.heads.attendance", label: "出席規定のカードの見出し(1行に1つ。上の規定と同じ順)", type: "lines" },
      { path: "rules.kpis", label: "BT-EX の約束(「3件/月 | 紹介活動 + 1on1 の合計」を1行に1つ)", type: "pairs" },
      { path: "rules.note", label: "規定の注意書き", type: "text" },
      { path: "rules.ethics", label: "倫理規定(1行に1つ)", type: "lines" },
      { path: "rules.heads.ethics", label: "倫理規定のカードの見出し(1行に1つ。上の規定と同じ順)", type: "lines" },
      { path: "schedule.lead", label: "スケジュールの見出し", type: "text" },
      { path: "schedule.rows", label: "定例会の日程(「第一水曜日 | 13:00-15:00」を1行に1つ)", type: "pairs" },
      { path: "schedule.note", label: "スケジュールの注意書き", type: "text" },
    ]],
    ["ブレイクアウトルーム商談", [
      { path: "fits.items", label: "このような人のお役に立てます(1行に1つ)", type: "lines" },
      { path: "strengths.groups", label: "それぞれの強み(1行目が名前、続く行が強み。空の行で区切る)", type: "blocks", key: "name", items: "items" },
    ]],
    ["挙手のお願い(LINKのビジネス実績紹介のあと)", [
      { path: "raise.0.items", label: "1ページ目: 発表すること(1行に1つ)", type: "lines" },
      { path: "raise.0.note", label: "1ページ目: 注意書き(《 》で囲むと強調)", type: "text" },
      { path: "raise.1.items", label: "2ページ目: 発表すること(1行に1つ)", type: "lines" },
      { path: "raise.1.note", label: "2ページ目: 注意書き", type: "text" },
      { path: "raise.2.items", label: "3ページ目: 発表すること(1行に1つ)", type: "lines" },
      { path: "raise.2.note", label: "3ページ目: 注意書き", type: "text" },
    ]],
    ["終わりの挨拶(入会の3ステップ・アンケート・出席コード)", [
      { path: "joinSteps.title", label: "入会のステップの題", type: "text" },
      { path: "joinSteps.steps", label: "ステップ(1行目が見出し、続く行が文。空の行で区切る)", type: "cards" },
      { path: "joinSteps.note", label: "ステップのカードの外の注意書き(Step1・Step2 の下にまとめて出す)", type: "text" },
      { path: "survey.lead", label: "アンケートの説明", type: "text" },
      { path: "attend.lead", label: "出席コードの説明(改行はそのままスライドの改行になります)", type: "multi" },
      { path: "attend.note", label: "出席コードの注意書き", type: "text" },
    ]],
  ];

  // ---------- エデュケーションコーナーの資料(毎回入れかえる) ----------
  // 画像(1枚ずつ)か PDF を選ぶと、1枚ずつの画像にしてサーバーに置く。PDF は pdf.js を読みこんで画像にする
  App.loadEducation = async function () {
    const r = await App.api("getEducation", {}, { quiet: true });
    return r ? { info: r.education || null, canEdit: !!r.canEdit } : { info: null, canEdit: false };
  };
  const eduCache = {};
  App.eduPageUrl = async function (rev, i) {
    const k = `${rev}:${i}`;
    if (eduCache[k]) return eduCache[k];
    const r = await App.api("getEduPage", { i }, { quiet: true });
    if (r && r.data) eduCache[k] = r.data;
    return eduCache[k] || "";
  };
  const loadScript = (src) => new Promise((ok, ng) => { const el = document.createElement("script"); el.src = src; el.onload = ok; el.onerror = ng; document.head.append(el); });
  // キャンバスを JPEG にする(大きいときは画質を下げて、1枚 約45万文字まで)
  function canvasJpeg(cv) {
    for (const q of [0.82, 0.72, 0.62, 0.52, 0.42]) { const d = cv.toDataURL("image/jpeg", q); if (d.length < 450000) return d; }
    return cv.toDataURL("image/jpeg", 0.35);
  }
  function fitCanvas(w, h) { const k = Math.min(1, 1600 / w); const cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k); return cv; }
  async function imageToPage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ng; im.src = url; });
      const cv = fitCanvas(img.naturalWidth, img.naturalHeight);
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      return canvasJpeg(cv);
    } finally { URL.revokeObjectURL(url); }
  }
  async function pdfToPages(file, onStep) {
    if (!window.pdfjsLib) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const out = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 40); n++) {
      onStep(n, pdf.numPages);
      const page = await pdf.getPage(n);
      const v1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 1600 / v1.width });
      const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      out.push(canvasJpeg(cv));
    }
    return out;
  }
  App.eduEditor = function (info, onSaved) {
    App.openSheet("エデュケーションコーナーの資料", (body, close) => {
      const titleIn = h("input", { type: "text", maxlength: "60", value: (info && info.title) || (base().education || {}).title || "" });
      const fileIn = h("input", { type: "file", accept: "image/*,application/pdf", multiple: true });
      const state = h("p", { class: "app-field-hint", "aria-live": "polite" }, info ? `いまの資料: ${info.title}(${info.pages}枚)` : `いまの資料: 元の資料「${(base().education || {}).title || ""}」`);
      let pages = null;
      fileIn.addEventListener("change", async () => {
        const files = [...fileIn.files];
        if (!files.length) return;
        pages = [];
        try {
          for (const f of files) {
            if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) pages.push(...(await pdfToPages(f, (n, all) => { state.textContent = `PDF を画像にしています… ${n} / ${all}`; })));
            else { state.textContent = `画像を読みこんでいます… ${pages.length + 1}枚目`; pages.push(await imageToPage(f)); }
          }
          if (!titleIn.value.trim()) titleIn.value = files[0].name.replace(/\.[^.]+$/, "");
          state.textContent = `${pages.length}枚の資料を読みこみました。「保存する」で入れかえます`;
        } catch (e) {
          pages = null;
          state.textContent = "読みこめませんでした。PowerPoint は「ファイル → エクスポート」で PDF か画像にしてから選んでください。";
        }
      });
      const save = App.btn("保存する", async () => {
        const title = titleIn.value.trim();
        if (!pages && !info) { App.toast("資料(PDF・画像)を選んでください", "error"); return; }
        save.disabled = true; state.textContent = "保存しています…";
        const r = await App.api("saveEducation", pages ? { title, pages } : { title, titleOnly: true });
        save.disabled = false;
        if (r) { App.toast("エデュケーションコーナーの資料を入れかえました"); close(); if (onSaved) onSaved(r.education); }
        else state.textContent = "保存できませんでした。枚数を減らすか、もう一度お試しください。";
      }, "primary wide");
      body.append(
        h("p", { class: "app-lead" }, "定例会の「エデュケーションコーナー」で、タイマーと一緒に映す資料です。毎回、ここで入れかえられます。"),
        App.field("資料の題", titleIn, "例: USPについて"),
        App.field("資料(PDF か画像)", fileIn, "PowerPoint・Keynote・Googleスライドは、PDF に書き出してから選んでください。画像は選んだ順に並びます(40枚まで)"),
        state,
        info ? h("div", { class: "app-btn-row" }, App.btn("元の資料に戻す", async () => {
          if (!(await App.confirm("入れかえた資料を消して、元の資料に戻しますか?", { ok: "元に戻す", danger: true }))) return;
          const r = await App.api("saveEducation", { pages: [] });
          if (r) { App.toast("元の資料に戻しました"); close(); if (onSaved) onSaved(null); }
        }, "ghost small")) : null,
        save);
    });
  };

  // 編集の画面。steps: 当日の流れ(時間の目安の欄の名前に使う)。onSaved(config)
  App.deckEditor = function (cfg, steps, onSaved) {
    const now = App.deckData(cfg);
    App.openSheet("スライドの内容を編集", (body, close) => {
      const inputs = [];
      const sections = SECTIONS.map(([title, fields], si) => h("details", { class: "dk-sec", open: si === 0 },
        h("summary", null, title),
        fields.map((f) => {
          const t = TYPES[f.type];
          const el = t.rows === 1
            ? h("input", { type: "text", maxlength: "300", value: t.to(getPath(now, f.path), f) })
            : h("textarea", { rows: String(t.rows), maxlength: "6000" });
          if (t.rows !== 1) el.value = t.to(getPath(now, f.path), f);
          inputs.push({ f, el });
          return App.field(f.label, el);
        })));
      // 時間の目安(2時間の定例会のタイムマネジメントに使う)
      const plan = Array.isArray(now.timeplan) ? now.timeplan.slice() : [];
      const names = ["オープニング", ...(steps || []).map((s) => `${s.no}. ${s.title}`)];
      const sum = h("p", { class: "dk-sum" });
      const minInputs = names.map((n, i) => h("input", { type: "number", min: "0", max: "180", step: "1", inputmode: "numeric", value: String(plan[i] || 0), "aria-label": `${n}(分)`, oninput: drawSum }));
      function drawSum() {
        const t = minInputs.reduce((a, x) => a + (Number(x.value) || 0), 0);
        sum.textContent = `合計 ${Math.floor(t / 60) ? `${Math.floor(t / 60)}時間` : ""}${t % 60 ? `${t % 60}分` : ""}${t ? "" : "0分"}`;
        sum.classList.toggle("is-off", t !== 120);
      }
      drawSum();
      const timeSec = h("details", { class: "dk-sec" },
        h("summary", null, "時間の目安(タイムマネジメント)"),
        h("p", { class: "app-field-hint" }, "定例会の進行中に出る「遅れ・早い」の表示は、この時間の目安で計算します。合計は2時間(120分)が目安です。"),
        h("div", { class: "dk-plan" }, names.map((n, i) => h("label", { class: "dk-plan-row" }, h("span", null, n), minInputs[i], h("small", null, "分")))),
        sum);
      const reset = App.btn("元の内容に戻す", async () => {
        if (!(await App.confirm("書きかえた内容をすべて消して、元の内容に戻しますか?", { ok: "元に戻す", danger: true }))) return;
        const r = await App.api("saveDeckConfig", { config: null });
        if (r) { App.toast("元の内容に戻しました"); close(); if (onSaved) onSaved(null); }
      }, "ghost small");
      const save = App.btn("保存する", async () => {
        const out = {};
        const orig = base();
        inputs.forEach(({ f, el }) => {
          const v = TYPES[f.type].from(el.value, f);
          if (JSON.stringify(v) !== JSON.stringify(clone(getPath(orig, f.path)))) out[f.path] = v;
        });
        const tp = minInputs.map((x) => Math.max(0, Math.min(180, Math.round(Number(x.value) || 0))));
        if (JSON.stringify(tp) !== JSON.stringify(orig.timeplan || [])) out.timeplan = tp;
        const r = await App.api("saveDeckConfig", { config: Object.keys(out).length ? out : null });
        if (r) { App.toast("スライドの内容を保存しました"); close(); if (onSaved) onSaved(r.config || null); }
      }, "primary wide");
      body.append(
        h("p", { class: "app-lead" }, "ここで書きかえた内容は、次に「定例会をはじめる」を押したときのスライドに入ります。開催日・開始時刻・当日の流れは、「予定」の定例会の編集で変えられます。"),
        h("p", { class: "app-field-hint" }, "1行に1つずつ書く欄で、項目の中で改行したいところには「↵」を入れてください(スライドではそこで改行します)。"),
        ...sections, timeSec,
        h("div", { class: "app-btn-row dk-actions" }, reset), save);
    });
  };
})();
