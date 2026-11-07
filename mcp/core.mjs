// ============================================
// mcp/core.mjs — BT-EX5 会員サイトの MCP の中身(道具と JSON-RPC の受け答え)
// パソコンで動かす版(btex5-mcp.mjs)と、インターネットで動かす版(worker/、Cloudflare Workers)の両方で使う。
// 道具は、共有サーバー(Google Apps Script)の操作を呼ぶだけ。データは共有サーバーにある。
// ============================================

export const SERVER_INFO = { name: "btex5", title: "BT-EX5", version: "1.1.0" };
export const INSTRUCTIONS = "BT-EX5 会員サイト(新潟⇔東京)の名簿・定例会・出欠・紹介(リファーラル)・ありがとうマイル・1on1 を扱う。" +
  "書きこむ道具(record_*・rsvp・add_members・mark_*)は、まず apply なしで下見を見せ、ご本人の OK をもらってから apply: true で呼ぶこと。" +
  "bt-ex.jp(BT-EX 全体のサイト)の MCP も同じ AI につながっていれば、そちらで読んだ名簿・出席を compare 系の道具に渡してくらべたり、" +
  "こちらの紹介・ありがとうマイルを btex5_list_referrals_for_btex で出して bt-ex.jp 側に登録し、btex5_mark_btex_posted で印を付けたりできる。";

// ---------- 名前のくらべ方 ----------
// 空白・全角半角・旧字(栁/柳 など一部)・敬称のちがいは見ない
const VARIANTS = { "栁": "柳", "髙": "高", "﨑": "崎", "邊": "辺", "邉": "辺", "齋": "斎", "齊": "斎", "濵": "浜", "濱": "浜" };
export function nameKey(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/(さん|様|さま|氏)$/u, "")
    .replace(/[\s　・･]/g, "")
    .replace(/./gu, (ch) => VARIANTS[ch] || ch)
    .toLowerCase();
}
function indexByName(members) {
  const map = new Map();
  for (const m of members) {
    for (const k of [nameKey(m.name), nameKey(m.kana)].filter(Boolean)) {
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(m);
    }
  }
  return map;
}
function matchName(map, name) {
  const hits = map.get(nameKey(name)) || [];
  return hits.length === 1 ? hits[0] : hits.length > 1 ? "ambiguous" : null;
}


// authed(action, payload): ログインした本人として共有サーバーの操作を呼ぶ
// me(): { name, memberId, isAdmin }
export function createTools({ authed, me }) {
  // ---------- 定例会を「id か 日にち」で探す ----------
  async function findEvent(ref) {
    const { events } = await authed("listEvents");
    const r = String(ref || "").trim();
    let ev = events.find((e) => e.id === r);
    if (!ev && /^\d{4}-\d{2}-\d{2}$/.test(r)) {
      const same = events.filter((e) => e.date === r);
      ev = same.find((e) => e.kind !== "special") || same[0];
    }
    if (!ev && !r) ev = [...events].reverse().find((e) => e.past) || events[0];
    if (!ev) throw new Error(`定例会が見つかりません: ${r || "(指定なし)"}。btex5_list_events で id か日にち(YYYY-MM-DD)を確かめてください。`);
    return ev;
  }

  // ---------- 道具 ----------
  const memberView = (m) => ({
    id: m.id, name: m.name, kana: m.kana || "", team: m.team || "", category: m.company || m.category || "",
    business: String(m.business || "").slice(0, 200), wants: String(m.wants || "").slice(0, 200),
  });

  const TOOLS = [
    {
      name: "btex5_whoami",
      annotations: { readOnlyHint: true },
      description: "BT-EX5 会員サイトに、だれとしてログインしているか(管理者かどうか)を返す。",
      inputSchema: { type: "object", properties: {} },
      run: async () => { const s = await me(); return { name: s.name, memberId: s.memberId, isAdmin: s.isAdmin }; },
    },
    {
      name: "btex5_list_members",
      annotations: { readOnlyHint: true },
      description: "BT-EX5 会員サイトの名簿(お名前・フリガナ・チーム・業種・事業内容・求める紹介)。query で名前や仕事を絞りこめる。電話・メール・住所は返さない。",
      inputSchema: { type: "object", properties: { query: { type: "string", description: "名前・業種・事業内容に含まれることば(任意)" } } },
      run: async ({ query }) => {
        const { members } = await authed("listReferralMembers");
        const q = String(query || "").trim();
        const list = members.map(memberView).filter((m) => !q || [m.name, m.kana, m.category, m.business, m.wants].some((x) => String(x).includes(q)));
        return { count: list.length, members: list };
      },
    },
    {
      name: "btex5_list_events",
      annotations: { readOnlyHint: true },
      description: "BT-EX5 の定例会・特別会の一覧(この120日より後)。id・日にち・時間・オンラインか・出欠の人数・終わったか。",
      inputSchema: { type: "object", properties: { upcoming_only: { type: "boolean", description: "true なら、これからの会だけ" } } },
      run: async ({ upcoming_only }) => {
        const { events, today } = await authed("listEvents");
        return {
          today,
          events: events.filter((e) => !upcoming_only || !e.past).map((e) => ({
            id: e.id, title: e.title, date: e.date, start: e.start, end: e.end, online: e.online, kind: e.kind || "regular",
            yes: e.yesCount, no: e.noCount, past: e.past, agenda: e.agenda,
          })),
        };
      },
    },
    {
      name: "btex5_get_event",
      annotations: { readOnlyHint: true },
      description: "定例会1回分の、メンバーごとの出欠の回答(yes/no)と、出席・遅刻の記録、ビジターの人数。event は id か日にち(YYYY-MM-DD)。省くと直近に終わった会。",
      inputSchema: { type: "object", properties: { event: { type: "string" } } },
      run: async ({ event }) => {
        const ev = await findEvent(event);
        const d = await authed("getEvent", { id: ev.id });
        const ms = d.members || [];
        return {
          event: { id: d.event.id, title: d.event.title, date: d.event.date, start: d.event.start, end: d.event.end },
          attended: ms.filter((m) => m.attended).map((m) => m.name + (m.late ? "(遅刻)" : "")),
          rsvpYesNotAttended: ms.filter((m) => m.rsvp === "yes" && !m.attended).map((m) => m.name),
          rsvpNo: ms.filter((m) => m.rsvp === "no").map((m) => m.name),
          noAnswer: ms.filter((m) => !m.rsvp && !m.attended).map((m) => m.name),
          visitors: (d.visitors || []).length,
        };
      },
    },
    {
      name: "btex5_referral_stats",
      annotations: { readOnlyHint: true },
      description: "紹介(リファーラル)・ありがとうマイルの集計。",
      inputSchema: { type: "object", properties: {} },
      run: async () => authed("getReferralStats"),
    },
    {
      name: "btex5_compare_roster",
      annotations: { readOnlyHint: true },
      description: "bt-ex.jp の BT-EX5 の名簿(bt-ex.jp の MCP、またはご本人のブラウザの bt-ex.jp の画面から読み取ったもの)と、会員サイトの名簿をくらべる。読むだけで、何も書きかえない。bt-ex.jp にいて会員サイトにいない人・その逆・業種がちがう人を返す。",
      inputSchema: {
        type: "object",
        required: ["btex_members"],
        properties: {
          btex_members: {
            type: "array", description: "bt-ex.jp の名簿の1人ずつ",
            items: { type: "object", required: ["name"], properties: { name: { type: "string" }, kana: { type: "string" }, work: { type: "string", description: "仕事・業種" } } },
          },
        },
      },
      run: async ({ btex_members }) => {
        const { members } = await authed("listReferralMembers");
        const map = indexByName(members);
        const seen = new Set();
        const onlyOnBtex = [], workDiff = [], ambiguous = [];
        for (const b of btex_members || []) {
          const m = matchName(map, b.name) || (b.kana ? matchName(map, b.kana) : null);
          if (m === "ambiguous") { ambiguous.push(b.name); continue; }
          if (!m) { onlyOnBtex.push(b); continue; }
          seen.add(m.id);
          const now = m.company || m.category || "";
          if (b.work && now && nameKey(b.work) !== nameKey(now)) workDiff.push({ name: m.name, site: now, btex: b.work });
        }
        const onlyOnSite = members.filter((m) => !seen.has(m.id)).map((m) => m.name);
        return {
          btexCount: (btex_members || []).length, siteCount: members.length,
          onlyOnBtex, onlyOnSite, workDiff, ambiguous,
          next: onlyOnBtex.length ? "足すときは btex5_add_members に onlyOnBtex を渡してください(はじめは apply を付けずに下見)。会員サイトだけにいる人は、自動では消しません(運営が確かめて管理画面から)。" : "名簿のちがいはありません。",
        };
      },
    },
    {
      name: "btex5_add_members",
      description: "bt-ex.jp にいて会員サイトにいない方を、会員サイトの名簿に足す(管理者だけ)。apply: true のときだけ書きこむ。省くと、足す予定の人の下見だけ返す。すでにいる人・名前が重なる人は足さない。だれも消さない。",
      inputSchema: {
        type: "object",
        required: ["members"],
        properties: {
          members: { type: "array", items: { type: "object", required: ["name"], properties: { name: { type: "string" }, kana: { type: "string" }, work: { type: "string" } } } },
          apply: { type: "boolean", description: "true で実際に足す" },
        },
      },
      run: async ({ members: input, apply }) => {
        const { members } = await authed("listReferralMembers");
        const map = indexByName(members);
        const toAdd = [], skipped = [];
        for (const b of input || []) {
          const name = String(b.name || "").trim();
          if (!name) continue;
          if (matchName(map, name)) { skipped.push({ name, reason: "すでに名簿にいます(または同じ名前の方がいます)" }); continue; }
          toAdd.push({ name, kana: String(b.kana || "").trim(), company: String(b.work || "").trim() });
        }
        if (!apply) return { preview: true, toAdd, skipped, next: toAdd.length ? "この内容でよければ、apply: true を付けてもう一度呼んでください。" : "足す人はいません。" };
        const s = await me();
        if (!s.isAdmin) throw new Error("名簿に足せるのは管理者だけです。");
        const added = [];
        for (const m of toAdd) {
          const r = await authed("adminSaveReferralMember", { member: { name: m.name, kana: m.kana, company: m.company, team: "" } });
          added.push({ id: r.member.id, name: r.member.name });
        }
        return { added, skipped };
      },
    },
    {
      name: "btex5_compare_attendance",
      annotations: { readOnlyHint: true },
      description: "bt-ex.jp の出席記録(bt-ex.jp の MCP、またはご本人のブラウザの bt-ex.jp の画面から読み取った、その会に出席した方のお名前)と、会員サイトの出席の記録をくらべる。読むだけ。",
      inputSchema: {
        type: "object",
        required: ["attendees"],
        properties: {
          event: { type: "string", description: "会員サイトの定例会の id か日にち(YYYY-MM-DD)" },
          attendees: { type: "array", items: { type: "string" }, description: "bt-ex.jp で出席になっている方のお名前" },
        },
      },
      run: async ({ event, attendees }) => {
        const ev = await findEvent(event);
        const d = await authed("getEvent", { id: ev.id });
        const map = indexByName(d.members || []);
        const toMark = [], unknown = [], ambiguous = [];
        for (const n of attendees || []) {
          const m = matchName(map, n);
          if (m === "ambiguous") ambiguous.push(n);
          else if (!m) unknown.push(n);
          else if (!m.attended) toMark.push(m.name);
        }
        const keys = new Set((attendees || []).map(nameKey));
        const onlyOnSite = (d.members || []).filter((m) => m.attended && !keys.has(nameKey(m.name))).map((m) => m.name);
        return {
          event: { id: d.event.id, title: d.event.title, date: d.event.date },
          toMark, alreadyMarked: (d.members || []).filter((m) => m.attended && keys.has(nameKey(m.name))).length,
          onlyOnSite, unknown, ambiguous,
          next: toMark.length ? "会員サイトに出席を付けるときは btex5_mark_attendance に toMark を渡してください(はじめは apply を付けずに下見)。" : "会員サイトの出席は、bt-ex.jp と同じです。",
        };
      },
    },
    {
      name: "btex5_mark_attendance",
      description: "会員サイトの定例会に、出席(または遅刻)を付ける(管理者だけ)。apply: true のときだけ書きこむ。省くと下見だけ。外すことはしない。",
      inputSchema: {
        type: "object",
        required: ["event", "names"],
        properties: {
          event: { type: "string", description: "定例会の id か日にち(YYYY-MM-DD)" },
          names: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["present", "late"], description: "出席(present・はじめの値)か遅刻(late)" },
          apply: { type: "boolean" },
        },
      },
      run: async ({ event, names, status, apply }) => {
        const ev = await findEvent(event);
        const d = await authed("getEvent", { id: ev.id });
        const map = indexByName(d.members || []);
        const targets = [], skipped = [];
        for (const n of names || []) {
          const m = matchName(map, n);
          if (!m || m === "ambiguous") skipped.push({ name: n, reason: m ? "同じ名前の方が複数います" : "名簿に見つかりません" });
          else if (m.attended && (status || "present") === "present") skipped.push({ name: m.name, reason: "すでに出席になっています" });
          else targets.push(m);
        }
        const st = status === "late" ? "late" : "present";
        if (!apply) return { preview: true, event: { id: d.event.id, title: d.event.title, date: d.event.date }, status: st, toMark: targets.map((m) => m.name), skipped };
        const s = await me();
        if (!s.isAdmin) throw new Error("出席を付けられるのは管理者だけです。");
        for (const m of targets) await authed("adminMarkAttendance", { id: ev.id, memberId: m.id, status: st });
        return { marked: targets.map((m) => m.name), status: st, skipped };
      },
    },
    {
      name: "btex5_list_referrals_for_btex",
      annotations: { readOnlyHint: true },
      description: "ログインしている本人が会員サイトに記録した「紹介(リファーラル)」と「送ったありがとうマイル」のうち、まだ bt-ex.jp に登録していないものを返す(include_posted: true で登録ずみも)。AI はこれを見て、bt-ex.jp の MCP の登録の道具(または ご本人のブラウザの bt-ex.jp の入力画面)で1件ずつ登録し、その前にご本人に確かめてもらう。紹介した相手の連絡先は返さない(bt-ex.jp に必要なときは、ご本人が入れる)。",
      inputSchema: { type: "object", properties: { include_posted: { type: "boolean" } } },
      run: async ({ include_posted }) => {
        const d = await authed("listMyReferrals");
        const day = (ms) => (ms ? new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10) : "");
        const STATUS = { new: "未対応", contacted: "連絡済み", meeting: "商談中", won: "成約", lost: "見送り" };
        const referrals = (d.given || []).filter((r) => include_posted || !r.btexPostedAt).map((r) => ({
          id: r.id, kind: "紹介(リファーラル)", date: day(r.at), to: r.toName, prospect: r.prospect, memo: r.memo,
          status: STATUS[r.status] || r.status, thanksAmount: r.thanksAmount || 0, btexPosted: day(r.btexPostedAt),
        }));
        const thanks = (d.thanksOut || []).filter((t) => include_posted || !t.btexPostedAt).map((t) => ({
          id: t.id, kind: "ありがとうマイル(送った)", date: day(t.at), to: t.toName, amount: t.amount, message: t.message, btexPosted: day(t.btexPostedAt),
        }));
        return {
          referrals, thanks,
          next: referrals.length + thanks.length
            ? "bt-ex.jp に登録できたら、その id を btex5_mark_btex_posted に渡して「bt-ex.jp に登録ずみ」にしてください(はじめは apply なしで下見)。"
            : "bt-ex.jp にまだ登録していない記録はありません。",
        };
      },
    },
    {
      name: "btex5_mark_btex_posted",
      description: "会員サイトの紹介・ありがとうマイルの記録に「bt-ex.jp に登録ずみ」の印を付ける(本人の記録だけ)。bt-ex.jp で実際に送信できたものだけに付ける。apply: true のときだけ書きこむ。posted: false で印を外す。",
      inputSchema: {
        type: "object",
        required: ["ids"],
        properties: { ids: { type: "array", items: { type: "string" } }, posted: { type: "boolean" }, apply: { type: "boolean" } },
      },
      run: async ({ ids, posted, apply }) => {
        const d = await authed("listMyReferrals");
        const all = [...(d.given || []).map((r) => ({ id: r.id, what: `紹介: ${r.toName} へ ${r.prospect || ""}`.trim() })),
          ...(d.thanksOut || []).map((t) => ({ id: t.id, what: `ありがとうマイル: ${t.toName} へ ${t.amount}` }))];
        const targets = (ids || []).map((id) => all.find((x) => x.id === id) || { id, what: "(本人の記録に見つかりません)" });
        if (!apply) return { preview: true, posted: posted !== false, targets };
        const r = await authed("markBtexPosted", { ids: targets.map((t) => t.id), posted: posted !== false });
        return { marked: r.marked, notFound: targets.filter((t) => !r.marked.includes(t.id)).map((t) => t.id) };
      },
    },
    {
      name: "btex5_my_records",
      title: "自分の記録",
      description: "ログインしている本人の記録: した紹介・受けた紹介(リファーラル)、送った・もらったありがとうマイル、1on1 の予定と記録。紹介した相手の連絡先は返さない。",
      inputSchema: { type: "object", properties: { limit: { type: "number", description: "種類ごとの件数(はじめは20)" } } },
      annotations: { readOnlyHint: true },
      run: async ({ limit }) => {
        const n = Math.max(1, Math.min(100, Number(limit) || 20));
        const [r, o] = await Promise.all([authed("listMyReferrals"), authed("list1on1")]);
        const day = (ms) => (ms ? new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10) : "");
        const STATUS = { new: "未対応", contacted: "連絡済み", meeting: "商談中", won: "成約", lost: "見送り" };
        const ref = (x) => ({ id: x.id, date: day(x.at), from: x.fromName, to: x.toName, prospect: x.prospect, memo: x.memo, status: STATUS[x.status] || x.status, thanksAmount: x.thanksAmount || 0 });
        const th = (t) => ({ id: t.id, date: day(t.at), from: t.fromName, to: t.toName, amount: t.amount, message: t.message });
        return {
          referralsGiven: (r.given || []).slice(0, n).map(ref),
          referralsReceived: (r.received || []).slice(0, n).map(ref),
          thanksSent: (r.thanksOut || []).slice(0, n).map(th),
          thanksReceived: (r.thanksIn || []).slice(0, n).map(th),
          oneOnOnes: (o.items || []).slice(0, n).map((x) => ({ id: x.id, date: x.date, time: x.time, with: x.withName + (x.ext ? `(${x.ext})` : ""), mode: x.mode === "meet" ? "Google Meet" : "対面", place: x.place, status: { planned: "予定", done: "実施", cancelled: "中止" }[x.status] || x.status })),
        };
      },
    },
    {
      name: "btex5_record_referral",
      title: "紹介(リファーラル)を記録",
      description: "紹介(リファーラル)を記録する。to は紹介を受けるメンバーのお名前、prospect は紹介する相手(会社名・お名前など)。apply: true のときだけ記録し、省くと下見だけ。",
      inputSchema: {
        type: "object", required: ["to", "prospect"],
        properties: {
          to: { type: "string", description: "紹介を受ける BT-EX5 のメンバーのお名前" },
          prospect: { type: "string", description: "紹介する相手(会社名・お名前など。60字まで)" },
          memo: { type: "string", description: "どんな紹介か(300字まで)" },
          contact: { type: "string", description: "紹介する相手の連絡先(任意。紹介した人と受けた人だけが見る)" },
          apply: { type: "boolean" },
        },
      },
      run: async ({ to, prospect, memo, contact, apply }) => {
        const { members } = await authed("listReferralMembers");
        const m = matchName(indexByName(members), to);
        if (!m || m === "ambiguous") throw new Error(m ? `「${to}」に当てはまる方が複数います。フルネームで指定してください。` : `「${to}」は BT-EX5 の名簿に見つかりません。btex5_list_members で確かめてください。`);
        const plan = { to: m.name, prospect: String(prospect || "").slice(0, 60), memo: String(memo || "").slice(0, 300), contact: contact ? "(入れる)" : "" };
        if (!apply) return { preview: true, ...plan, next: "この内容でよければ apply: true を付けてもう一度呼んでください。" };
        const r = await authed("recordReferral", { toMemberId: m.id, prospect: plan.prospect, memo: plan.memo, contact: String(contact || "").slice(0, 120) });
        return { recorded: true, id: r.log.id, to: m.name, prospect: plan.prospect };
      },
    },
    {
      name: "btex5_record_thanks",
      title: "ありがとうマイルを記録",
      description: "紹介で決まった仕事のお礼(ありがとうマイル。1円=1マイル)を記録する。to は紹介してくれたメンバー。受けた紹介(referral_id)を指定すると、その紹介は「成約」になる。apply: true のときだけ記録。",
      inputSchema: {
        type: "object", required: ["amount"],
        properties: {
          to: { type: "string", description: "紹介してくれたメンバーのお名前(referral_id を指定するときは不要)" },
          referral_id: { type: "string", description: "受けた紹介の id(btex5_my_records の referralsReceived)" },
          amount: { type: "number", description: "成約金額(円)= マイル" },
          message: { type: "string", description: "ひとこと(300字まで)" },
          apply: { type: "boolean" },
        },
      },
      run: async ({ to, referral_id, amount, message, apply }) => {
        const yen = Math.round(Number(amount) || 0);
        if (yen < 0 || yen > 100000000) throw new Error("金額は 0〜1億円で指定してください。");
        let toId = "", toName = "";
        if (referral_id) {
          const r = await authed("listMyReferrals");
          const x = (r.received || []).find((y) => y.id === referral_id);
          if (!x) throw new Error("その紹介は、あなたが受けた紹介の中に見つかりません。");
          toName = x.fromName;
        } else {
          const { members } = await authed("listReferralMembers");
          const m = matchName(indexByName(members), to);
          if (!m || m === "ambiguous") throw new Error(m ? `「${to}」に当てはまる方が複数います。` : `「${to}」は名簿に見つかりません。`);
          toId = m.id; toName = m.name;
        }
        const plan = { to: toName, amount: yen, miles: yen, message: String(message || "").slice(0, 300), referralId: referral_id || "" };
        if (!apply) return { preview: true, ...plan, next: "この内容でよければ apply: true を付けてもう一度呼んでください。" };
        const r = await authed("reportThanks", { toMemberId: toId, referralId: referral_id || "", amount: String(yen), message: plan.message });
        return { recorded: true, id: r.thanks.id, to: r.thanks.toName, amount: r.thanks.amount };
      },
    },
    {
      name: "btex5_record_1on1",
      title: "1on1 を記録・予定",
      description: "1on1 を記録(または予定)する。with は BT-EX5 のメンバーのお名前。ほかの BT-EX の方は ext_unit(1〜14)と with(お名前)で。日時が過ぎていれば「実施」、これからなら「予定」になる。apply: true のときだけ記録。",
      inputSchema: {
        type: "object", required: ["with", "date"],
        properties: {
          with: { type: "string" }, ext_unit: { type: "number", description: "ほかの BT-EX の方のときのユニット番号(1〜14)" },
          date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM(任意)" },
          duration: { type: "number", description: "分(30/45/60/90/120 など。はじめは60)" },
          mode: { type: "string", enum: ["onsite", "meet"], description: "対面(onsite)か Google Meet(meet)" },
          place: { type: "string" }, note: { type: "string", description: "自分だけが見るメモ" },
          apply: { type: "boolean" },
        },
      },
      run: async (a) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.date || ""))) throw new Error("date は YYYY-MM-DD で指定してください。");
        let payload = { date: a.date, time: a.time || "", duration: a.duration || 60, mode: a.mode === "meet" ? "meet" : "onsite", place: a.place || "", note: a.note || "" };
        let withName = String(a.with || "");
        if (a.ext_unit) {
          payload.ext = { unit: Number(a.ext_unit), name: withName };
          withName = `BT-EX${a.ext_unit} ${withName}`;
        } else {
          const { members } = await authed("listReferralMembers");
          const m = matchName(indexByName(members), a.with);
          if (!m || m === "ambiguous") throw new Error(m ? `「${a.with}」に当てはまる方が複数います。` : `「${a.with}」は BT-EX5 の名簿に見つかりません(ほかの BT-EX の方は ext_unit を付けてください)。`);
          payload.withMemberId = m.id; withName = m.name;
        }
        if (!a.apply) return { preview: true, with: withName, ...payload, next: "この内容でよければ apply: true を付けてもう一度呼んでください。" };
        const r = await authed("save1on1", payload);
        return { recorded: true, id: r.item.id, with: r.item.withName, date: r.item.date, time: r.item.time, status: r.item.status };
      },
    },
    {
      name: "btex5_rsvp",
      title: "定例会の出欠を答える",
      description: "これからの定例会に、本人の出欠(yes=出席 / no=欠席)を答える。event は id か日にち。apply: true のときだけ書きこむ。",
      inputSchema: { type: "object", required: ["event", "answer"], properties: { event: { type: "string" }, answer: { type: "string", enum: ["yes", "no"] }, apply: { type: "boolean" } } },
      run: async ({ event, answer, apply }) => {
        const ev = await findEvent(event);
        if (ev.past) throw new Error("終わった会の出欠は変えられません(運営にご連絡ください)。");
        const plan = { event: { id: ev.id, title: ev.title, date: ev.date, start: ev.start }, answer: answer === "no" ? "欠席" : "出席" };
        if (!apply) return { preview: true, ...plan };
        await authed("rsvpEvent", { eventId: ev.id, answer: answer === "no" ? "no" : "yes" });
        return { done: true, ...plan };
      },
    },
  ];
  return TOOLS;
}

// ---------- JSON-RPC 2.0(MCP)の受け答え。返事がいらない通知のときは null ----------
export async function handleRpc(msg, tools) {
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } });
  if (method === "initialize") {
    const want = params && params.protocolVersion;
    const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
    return ok({
      protocolVersion: SUPPORTED.includes(want) ? want : SUPPORTED[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    });
  }
  if (typeof method === "string" && method.startsWith("notifications/")) return null;
  if (method === "ping") return ok({});
  if (method === "tools/list") {
    return ok({ tools: tools.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })) });
  }
  if (method === "tools/call") {
    const tool = tools.find((t) => t.name === (params && params.name));
    if (!tool) return err(-32602, `道具が見つかりません: ${params && params.name}`);
    try {
      const out = await tool.run((params && params.arguments) || {});
      return ok({ content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out && typeof out === "object" && !Array.isArray(out) ? out : undefined });
    } catch (e) {
      return ok({ isError: true, content: [{ type: "text", text: String((e && e.message) || e) }] });
    }
  }
  if (id === undefined) return null;
  return err(-32601, `未対応のメソッド: ${method}`);
}
