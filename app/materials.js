// ============================================
// app/materials.js — 資料(全員が使える)
// ポスター(A4 横)を、回・日時・会場・参加費を入れるだけで作る。BT-EX フェス用と定例会用。
// 定例会のお誘い画像(縦 4:5。掲示板・SNS 用)も、日時・開催方法を入れて作る(materials/invite/ のページ)
// 見本はこの画面の中に出し、「PDF で保存・印刷」「画像で保存」でそのまま使える(materials/poster/ のページを開く)
// ============================================
(function () {
  "use strict";
  const h = App.h;
  const KANJI = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  // 「第一回BT-EXフェス」→ 1
  function numberOf(title) {
    const m = /第\s*([0-9０-９]+|[一二三四五六七八九十]+)\s*回/.exec(String(title || ""));
    if (!m) return "";
    const t = m[1].replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    if (/^\d+$/.test(t)) return t;
    const [a, b] = t.split("十");
    const v = t.includes("十") ? (a ? KANJI.indexOf(a) : 1) * 10 + (b ? KANJI.indexOf(b) : 0) : KANJI.indexOf(t);
    return v > 0 ? String(v) : "";
  }
  const POSTER = "../materials/poster/";
  // 定例会の回の数え方: 2026年11月14日が第8回。予定にある定例会の並びから数える
  const REGULAR_ANCHOR = { date: "2026-11-14", no: 8 };
  const ONLINE = "オンライン(Zoom)";
  const KINDS = [{ id: "fes", label: "BT-EX フェス" }, { id: "regular", label: "定例会" }];
  // 予定にまだないときの、はじめの値
  const DEF = {
    fes: { no: "1", date: "2026-12-02", start: "14:30", end: "16:30", open: "14:00", place: "銀座 Blossom", fee: "2,200円" },
    regular: { no: "", date: "2026-11-14", start: "20:00", end: "22:00", open: "", place: ONLINE, fee: "会員 無料" },
  };

  // 定例会のお誘い画像(掲示板・SNS 用。縦 4:5)。日時(2回まで)・オンラインか会場か・「お声がけを」の欄のあり/なしを変えて何度でも使える
  const INVITE = "../materials/invite/";
  function inviteSection(upcoming) {
    const regular = upcoming.filter((e) => e.kind !== "special").slice(0, 2);
    const f = {
      d1: h("input", { type: "date" }), s1: h("input", { type: "time" }), e1: h("input", { type: "time" }),
      d2: h("input", { type: "date" }), s2: h("input", { type: "time" }), e2: h("input", { type: "time" }),
      place: h("input", { type: "text", maxlength: "30", placeholder: "例:銀座 Blossom" }),
      name: h("input", { type: "text", maxlength: "12", placeholder: "例:山本" }),
    };
    regular.forEach((e, i) => { f[`d${i + 1}`].value = e.date || ""; f[`s${i + 1}`].value = e.start || ""; f[`e${i + 1}`].value = e.end || ""; });
    const first = regular[0];
    let mode = first && !(first.online || first.meet) && first.place ? "offline" : "online";
    if (mode === "offline") f.place.value = first.place;
    let contact = "1";
    // 声がけ先は、使う人の名字(はじめの値。変えられる)
    f.name.value = String((App.session && App.session.displayName) || "").trim().split(/\s+/)[0] || "";
    const params = (extra) => {
      const q = new URLSearchParams({ mode, contact });
      Object.entries(f).forEach(([k, input]) => q.set(k, input.value.trim()));
      Object.entries(extra || {}).forEach(([k, v]) => q.set(k, v));
      return `${INVITE}?${q}`;
    };
    const frame = h("iframe", { class: "mt-frame is-portrait", title: "お誘い画像の見本", loading: "lazy" });
    let timer = 0;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { frame.src = params({ embed: "1" }); }, 250); };
    Object.values(f).forEach((input) => input.addEventListener("input", refresh));
    const placeField = App.field("会場", f.place, "画像には「次回の定例会(会場:◯◯)」と出ます");
    const nameField = App.field("声がけ先のお名前", f.name, "「参加したい方は◯◯までお声がけを」の◯◯。空なら「お気軽にお声がけを」");
    const drawMode = () => { placeField.hidden = mode !== "offline"; nameField.hidden = contact !== "1"; };
    const modeToggle = App.toggle([{ id: "online", label: "オンライン" }, { id: "offline", label: "会場で(対面)" }], mode, (v) => { mode = v; drawMode(); refresh(); });
    const contactToggle = App.toggle([{ id: "1", label: "あり" }, { id: "0", label: "なし" }], contact, (v) => { contact = v; drawMode(); refresh(); });
    const label = "画像で保存(PNG)";
    const saveBtn = App.btn(label, async () => {
      const w = frame.contentWindow;
      if (!w || !w.BtexInvite) { App.toast("見本の読みこみを待ってから、もう一度押してください", "error"); return; }
      saveBtn.disabled = true; saveBtn.textContent = "作っています…";
      try {
        const blob = await (await fetch(await w.BtexInvite.png({ download: false }))).blob();
        const href = URL.createObjectURL(blob);
        const a = h("a", { href, download: w.BtexInvite.fileName("png") });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 60000);
        App.toast("画像を保存しました");
      } catch { App.toast("作れませんでした。少し待ってから、もう一度押してください", "error"); }
      finally { saveBtn.disabled = false; saveBtn.textContent = label; }
    }, "primary");
    drawMode();
    refresh();
    return App.section("定例会のお誘い画像(掲示板・SNS)",
      h("p", { class: "app-field-hint mt-hint" }, "システムの画面を見せて、定例会に誘う画像です(縦長 4:5)。日時・開催方法を変えて、何度でも使えます。"),
      h("div", { class: "mt-maker" },
        h("div", { class: "mt-form" },
          h("div", { class: "app-grid2 mt-times" }, App.field("1回目の日にち", f.d1), App.field("はじまり", f.s1), App.field("おわり", f.e1)),
          h("div", { class: "app-grid2 mt-times" }, App.field("2回目(任意)", f.d2), App.field("はじまり", f.s2), App.field("おわり", f.e2)),
          App.field("開催方法", modeToggle),
          placeField,
          App.field("「参加したい方は…お声がけを」の欄", contactToggle, "なしにすると、日時の欄が横いっぱいになります"),
          nameField,
          h("div", { class: "app-btn-row mt-actions" },
            saveBtn,
            h("a", { class: "app-btn ghost", href: params(), target: "_blank", rel: "noopener", onclick: (e) => { e.currentTarget.href = params(); } }, "画像だけを開く")),
          h("p", { class: "app-field-hint" }, "2160 × 2700 ピクセルの PNG で保存します。2回目の日にちを空にすると、1回分だけ出ます。")),
        h("div", { class: "mt-preview is-portrait" }, frame)));
  }

  App.views.materials = {
    title: "資料",
    async render(el) {
      el.append(h("p", { class: "app-lead mt-lead" }, "定例会や BT-EX フェスのポスターを、回・日時・会場・参加費を入れるだけで作れます。A4 横のまま、印刷・PDF・画像にできます。"));
      const d = await App.api("listEvents", {}, { quiet: true });
      const upcoming = d ? d.events.filter((e) => !e.past) : [];
      // 定例会の日にちから、第何回かを出す(第8回 = 11月14日 を基準に、あいだの定例会の数を足し引き)
      const regularDates = [...new Set((d ? d.events : []).filter((e) => e.kind !== "special").map((e) => e.date))].sort();
      const regularNo = (date) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "";
        const before = (x) => regularDates.filter((v) => v < x).length;
        const n = REGULAR_ANCHOR.no + before(date) - before(REGULAR_ANCHOR.date);
        return n > 0 ? String(n) : "";
      };
      // 種類ごとの、いちばん近い予定(フェス = 特別会)
      const nextOf = (k) => upcoming.find((e) => (k === "fes" ? e.kind === "special" : e.kind !== "special")) || null;
      const fromEvent = (k) => {
        const e = nextOf(k);
        if (!e) return Object.assign({}, DEF[k]);
        return {
          no: k === "fes" ? numberOf(e.title) || DEF.fes.no : regularNo(e.date),
          date: e.date, start: e.start || "", end: e.end || "", open: e.doors || "",
          place: e.online || e.meet ? ONLINE : e.place || DEF[k].place,
          fee: e.fee || DEF[k].fee,
        };
      };

      let kind = "fes";
      const f = {
        no: h("input", { type: "number", min: "1", max: "99", inputmode: "numeric" }),
        date: h("input", { type: "date" }),
        start: h("input", { type: "time" }),
        end: h("input", { type: "time" }),
        open: h("input", { type: "time" }),
        place: h("input", { type: "text", maxlength: "40", placeholder: "例:銀座 Blossom" }),
        fee: h("input", { type: "text", maxlength: "20", placeholder: "例:2,200円" }),
      };
      // 回は薄く(入れなくても、その数字で作る)。ほかはそのまま入れる
      const put = (vals) => Object.entries(vals).forEach(([k, v]) => {
        if (k === "no") { f.no.value = ""; f.no.placeholder = v || ""; } else f[k].value = v || "";
      });
      const noHint = h("span");
      const params = (extra) => {
        const q = new URLSearchParams({ k: kind });
        Object.entries(f).forEach(([k, input]) => q.set(k, input.value.trim()));
        // 回が空のときは、薄く出している数字(予定から数えた回)で作る
        if (!f.no.value.trim()) q.set("no", f.no.placeholder.replace(/[^0-9]/g, ""));
        Object.entries(extra || {}).forEach(([k, v]) => q.set(k, v));
        return `${POSTER}?${q}`;
      };

      // 見本(A4 横の比率のまま、この画面の幅に合わせて縮めて出す)
      const frame = h("iframe", { class: "mt-frame", title: "ポスターの見本", loading: "lazy" });
      let timer = 0;
      const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { frame.src = params({ embed: "1" }); }, 250); };
      Object.values(f).forEach((input) => input.addEventListener("input", refresh));
      // 定例会は、日にちを変えると回の薄い数字も変わる
      f.date.addEventListener("input", () => { if (kind === "regular") { f.no.placeholder = regularNo(f.date.value); drawNoHint(); } });
      const drawNoHint = () => {
        noHint.textContent = f.no.placeholder
          ? `薄い数字(第${f.no.placeholder}回)のままで作れます${kind === "regular" ? "(11月14日 = 第8回 から数えています)" : ""}。違うときだけ入れてください`
          : "「第◯回」になります。なしは空のまま";
      };

      const fill = () => {
        const v = fromEvent(kind);
        put(v);
        drawNoHint();
        hint.textContent = nextOf(kind)
          ? `いちばん近い${kind === "fes" ? "特別会" : "定例会"}(${App.fmtDateLong ? App.fmtDateLong(nextOf(kind).date) : nextOf(kind).date})の内容を入れました。変えたいところだけ直してください。`
          : "予定にまだないので、前回の内容を入れました。回・日時・会場・参加費を直してください。";
        refresh();
      };
      const hint = h("p", { class: "app-field-hint mt-hint" });
      const kindToggle = App.toggle(KINDS, kind, (k) => { kind = k; drawPhoto(); fill(); });

      // 写真の入れかえ: えらんだ写真を小さく(長い辺 1600px・JPEG)してこの端末に保存し、ポスターに使う
      const PHOTO_KEY = () => `btex5-poster-photo-${kind}`;
      const storedPhoto = () => { try { return localStorage.getItem(PHOTO_KEY()) || ""; } catch { return ""; } };
      const thumb = h("img", { class: "mt-photo-thumb", alt: "" });
      const photoNote = h("small", { class: "mt-photo-note" });
      const resetBtn = App.btn("元の写真に戻す", () => {
        try { localStorage.removeItem(PHOTO_KEY()); } catch { /* noop */ }
        drawPhoto(); refresh(); App.toast("元の写真に戻しました");
      }, "ghost small");
      const drawPhoto = () => {
        const url = storedPhoto();
        thumb.hidden = !url; if (url) thumb.src = url;
        resetBtn.hidden = !url;
        photoNote.textContent = url ? "入れかえた写真を使っています(この端末に保存)" : kind === "fes" ? "いまは第一回の銀座の写真です" : "いまはロゴと新潟⇔東京のイラストです";
      };
      const shrink = (file) => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
          const c = h("canvas", { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) });
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(img.src);
          res(c.toDataURL("image/jpeg", 0.86));
        };
        img.onerror = rej;
        img.src = URL.createObjectURL(file);
      });
      const photoIn = h("input", { type: "file", accept: "image/*", class: "mt-photo-input", onchange: async () => {
        const file = photoIn.files && photoIn.files[0];
        photoIn.value = "";
        if (!file) return;
        try {
          const url = await shrink(file);
          try { localStorage.setItem(PHOTO_KEY(), url); } catch { App.toast("この端末に保存できませんでした。写真をもう少し小さくしてください", "error"); return; }
          drawPhoto(); refresh(); App.toast("写真を入れかえました");
        } catch { App.toast("写真を読みこめませんでした", "error"); }
      } });
      const photoField = h("div", { class: "mt-photo" }, thumb,
        h("div", { class: "mt-photo-main" },
          h("label", { class: "app-btn ghost small mt-photo-pick" }, photoIn, "写真をえらぶ"), resetBtn, photoNote));

      const busy = (b, on, label) => { b.disabled = on; b.textContent = on ? "作っています…" : label; };
      // 見本の中で作って、保存はこの画面で(見本の枠の中からの保存は、ブラウザに止められることがあるため)
      const saveBtn = (label, cls, kindOf) => {
        const b = App.btn(label, async () => {
          const w = frame.contentWindow;
          if (!w || !w.BtexPoster) { App.toast("見本の読みこみを待ってから、もう一度押してください", "error"); return; }
          busy(b, true, label);
          try {
            const blob = kindOf === "pdf"
              ? await w.BtexPoster.pdf({ download: false })
              : await (await fetch(await w.BtexPoster.png({ download: false }))).blob();
            const href = URL.createObjectURL(blob);
            const a = h("a", { href, download: w.BtexPoster.fileName(kindOf) });
            document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(href), 60000);
            App.toast(kindOf === "pdf" ? "PDF を保存しました" : "画像を保存しました");
          } catch { App.toast("作れませんでした。少し待ってから、もう一度押してください", "error"); }
          finally { busy(b, false, label); }
        }, cls);
        return b;
      };
      const pdfBtn = saveBtn("PDF で保存", "primary", "pdf");
      const pngBtn = saveBtn("画像で保存(PNG)", "ghost", "png");

      el.append(
        App.section("ポスターを作る",
          h("div", { class: "mt-maker" },
            h("div", { class: "mt-form" },
              App.field("種類", kindToggle),
              hint,
              h("div", { class: "app-grid2" }, App.field("回(数字)", f.no, noHint), App.field("日にち", f.date)),
              h("div", { class: "app-grid2 mt-times" }, App.field("はじまり", f.start), App.field("おわり", f.end), App.field("受付(任意)", f.open)),
              App.field("会場", f.place),
              App.field("参加費", f.fee, "数字だけなら「2,200円」の形になります"),
              App.field("写真", photoField, "アーチの中の写真を入れかえられます(横より縦長の写真が合います)"),
              h("div", { class: "app-btn-row mt-actions" },
                pdfBtn,
                pngBtn,
                h("a", { class: "app-btn ghost", href: params(), target: "_blank", rel: "noopener", onclick: (e) => { e.currentTarget.href = params(); } }, "ポスターだけを開く")),
              h("p", { class: "app-field-hint" }, "PDF・画像は、A4 横(297mm × 210mm)ちょうどの大きさで保存します。印刷するときは「実際のサイズ(100%)」を選んでください。")),
            h("div", { class: "mt-preview" }, frame))),
        inviteSection(upcoming),
        App.section("これまでの資料",
          h("ul", { class: "app-list mt-files" },
            h("li", null, h("a", { class: "app-row", href: "../materials/fes-poster/bt-ex-fes-poster-a4.pdf", target: "_blank", rel: "noopener" },
              h("span", { class: "mt-file-ic", "aria-hidden": "true" }, "PDF"),
              h("span", { class: "app-row-main" }, h("b", null, "第一回 BT-EX フェス ポスター(A4 横)"), h("small", null, "2026年12月2日(水)銀座 Blossom")))))));
      drawPhoto();
      fill();
    },
  };
})();
