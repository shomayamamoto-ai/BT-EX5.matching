// ============================================
// app/materials.js — 資料(全員が使える)
// ポスター(A4 横)を、回・日時・会場・参加費を入れるだけで作る。BT-EX フェス用と定例会用。
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
  const KINDS = [{ id: "fes", label: "BT-EX フェス" }, { id: "regular", label: "定例会" }];
  // 予定にまだないときの、はじめの値
  const DEF = {
    fes: { no: "1", date: "2026-12-02", start: "14:30", end: "16:30", open: "14:00", place: "銀座 Blossom", fee: "2,200円" },
    regular: { no: "", date: "", start: "13:00", end: "15:00", open: "", place: "オンライン(Google Meet)", fee: "会員 無料" },
  };

  App.views.materials = {
    title: "資料",
    async render(el) {
      el.append(h("p", { class: "app-lead mt-lead" }, "定例会や BT-EX フェスのポスターを、回・日時・会場・参加費を入れるだけで作れます。A4 横のまま、印刷・PDF・画像にできます。"));
      const d = await App.api("listEvents", {}, { quiet: true });
      const upcoming = d ? d.events.filter((e) => !e.past) : [];
      // 種類ごとの、いちばん近い予定(フェス = 特別会)
      const nextOf = (k) => upcoming.find((e) => (k === "fes" ? e.kind === "special" : e.kind !== "special")) || null;
      const fromEvent = (k) => {
        const e = nextOf(k);
        if (!e) return Object.assign({}, DEF[k]);
        return {
          no: numberOf(e.title) || (k === "fes" ? DEF.fes.no : ""),
          date: e.date, start: e.start || "", end: e.end || "", open: e.doors || "",
          place: e.online || e.meet ? "オンライン(Google Meet)" : e.place || DEF[k].place,
          fee: e.fee || DEF[k].fee,
        };
      };

      let kind = "fes";
      const f = {
        no: h("input", { type: "number", min: "1", max: "99", inputmode: "numeric", placeholder: "例:2(なしは空)" }),
        date: h("input", { type: "date" }),
        start: h("input", { type: "time" }),
        end: h("input", { type: "time" }),
        open: h("input", { type: "time" }),
        place: h("input", { type: "text", maxlength: "40", placeholder: "例:銀座 Blossom" }),
        fee: h("input", { type: "text", maxlength: "20", placeholder: "例:2,200円" }),
      };
      const put = (vals) => Object.entries(vals).forEach(([k, v]) => { f[k].value = v || ""; });
      const params = (extra) => {
        const q = new URLSearchParams({ k: kind });
        Object.entries(f).forEach(([k, input]) => q.set(k, input.value.trim()));
        Object.entries(extra || {}).forEach(([k, v]) => q.set(k, v));
        return `${POSTER}?${q}`;
      };

      // 見本(A4 横の比率のまま、この画面の幅に合わせて縮めて出す)
      const frame = h("iframe", { class: "mt-frame", title: "ポスターの見本", loading: "lazy" });
      let timer = 0;
      const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { frame.src = params({ embed: "1" }); }, 250); };
      Object.values(f).forEach((input) => input.addEventListener("input", refresh));

      const fill = () => {
        const v = fromEvent(kind);
        put(v);
        hint.textContent = nextOf(kind)
          ? `いちばん近い${kind === "fes" ? "特別会" : "定例会"}(${App.fmtDateLong ? App.fmtDateLong(nextOf(kind).date) : nextOf(kind).date})の内容を入れました。変えたいところだけ直してください。`
          : "予定にまだないので、前回の内容を入れました。回・日時・会場・参加費を直してください。";
        refresh();
      };
      const hint = h("p", { class: "app-field-hint mt-hint" });
      const kindToggle = App.toggle(KINDS, kind, (k) => { kind = k; fill(); });

      const busy = (b, on, label) => { b.disabled = on; b.textContent = on ? "作っています…" : label; };
      const pngBtn = App.btn("画像で保存(PNG)", async () => {
        const w = frame.contentWindow;
        if (!w || !w.BtexPoster) { App.toast("見本の読みこみを待ってから、もう一度押してください", "error"); return; }
        busy(pngBtn, true, "画像で保存(PNG)");
        try {
          // 見本の中で画像にして、保存はこの画面で(見本の枠の中からの保存は、ブラウザに止められることがあるため)
          const dataUrl = await w.BtexPoster.png({ download: false });
          const blob = await (await fetch(dataUrl)).blob();
          const href = URL.createObjectURL(blob);
          const a = h("a", { href, download: w.BtexPoster.fileName("png") });
          document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(href), 60000);
          App.toast("画像を保存しました");
        }
        catch { App.toast("画像にできませんでした。「PDF で保存・印刷」をお使いください", "error"); }
        finally { busy(pngBtn, false, "画像で保存(PNG)"); }
      }, "ghost");

      el.append(
        App.section("ポスターを作る",
          h("div", { class: "mt-maker" },
            h("div", { class: "mt-form" },
              App.field("種類", kindToggle),
              hint,
              h("div", { class: "app-grid2" }, App.field("回(数字)", f.no, "「第◯回」になります"), App.field("日にち", f.date)),
              h("div", { class: "app-grid2 mt-times" }, App.field("はじまり", f.start), App.field("おわり", f.end), App.field("受付(任意)", f.open)),
              App.field("会場", f.place),
              App.field("参加費", f.fee, "数字だけなら「2,200円」の形になります"),
              h("div", { class: "app-btn-row mt-actions" },
                App.btn("PDF で保存・印刷", () => window.open(params({ print: "1" }), "_blank", "noopener"), "primary"),
                pngBtn,
                h("a", { class: "app-btn ghost", href: params(), target: "_blank", rel: "noopener", onclick: (e) => { e.currentTarget.href = params(); } }, "ポスターだけを開く")),
              h("p", { class: "app-field-hint" }, "PDF は、開いた画面の「印刷」で「PDF として保存」を選ぶと保存できます(用紙は A4・横)。")),
            h("div", { class: "mt-preview" }, frame))),
        App.section("これまでの資料",
          h("ul", { class: "app-list mt-files" },
            h("li", null, h("a", { class: "app-row", href: "../materials/fes-poster/bt-ex-fes-poster-a4.pdf", target: "_blank", rel: "noopener" },
              h("span", { class: "mt-file-ic", "aria-hidden": "true" }, "PDF"),
              h("span", { class: "app-row-main" }, h("b", null, "第一回 BT-EX フェス ポスター(A4 横)"), h("small", null, "2026年12月2日(水)銀座 Blossom")))))));
      fill();
    },
  };
})();
