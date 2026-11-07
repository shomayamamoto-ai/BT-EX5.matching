#!/usr/bin/env node
// ============================================
// mcp/btex5-mcp.mjs — BT-EX5 会員サイトの MCP サーバー
//
// Claude などの AI から、この会員サイト(共有サーバー = Google Apps Script)の名簿・定例会・出欠を
// 読んだり、bt-ex.jp の名簿・出席とくらべて反映したりできるようにする。
// 追加のパッケージは不要(Node.js 18 以上)。AI のアプリが、このファイルを起動して標準入出力で話す。
//
// 設定(環境変数。AI のアプリの設定ファイルに書く。リポジトリには書かない):
//   BTEX5_NAME      ログインするお名前(例: 山本 捷真)
//   BTEX5_PASSWORD  ご自分のパスワード(まだ決めていない方は共通パスコード)
//   BTEX5_API       (任意)共有サーバーの URL。省くと auth/api.js と同じ URL
//
// bt-ex.jp には、このサーバーからはつながない(ログイン情報も持たない)。
// bt-ex.jp の名簿・出席は、AI がご本人のブラウザで開いた画面(または貼り付けた文)から読み取り、
// ここの「くらべる」道具に渡す。書きこみは apply: true のときだけ行い、ふだんは「こうなります」の下見だけ返す。
// ============================================

const API = process.env.BTEX5_API || "https://script.google.com/macros/s/AKfycbw_Pb3sqA4O83kwIiT5GPO9cBGfhyh5knBqgebBPbKxbedMkzS9skIIH6M7MKb3pP9mqA/exec";
const NAME = process.env.BTEX5_NAME || "";
const PASSWORD = process.env.BTEX5_PASSWORD || "";
const SERVER_INFO = { name: "btex5", version: "1.0.0" };

// ---------- 共有サーバーとの通信 ----------
let session = null; // { token, memberId, name, isAdmin }

async function call(action, payload = {}) {
  const body = JSON.stringify({ ...payload, action, userAgent: "btex5-mcp/1.0" });
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, redirect: "follow" });
  if (!res.ok) throw new Error(`共有サーバーにつながりませんでした(HTTP ${res.status})`);
  const json = await res.json();
  if (json && json.success === true) return json.data || {};
  const err = (json && json.error) || {};
  const e = new Error(err.message || err.code || "共有サーバーがエラーを返しました");
  e.code = err.code || "";
  throw e;
}

async function login() {
  if (!NAME || !PASSWORD) throw new Error("BTEX5_NAME と BTEX5_PASSWORD を、AI のアプリの MCP の設定(env)に入れてください。");
  const d = await call("accountLogin", { name: NAME, password: PASSWORD, remember: true });
  session = { token: d.sessionToken, memberId: d.memberId, name: d.displayName, isAdmin: !!(d.user && d.user.isAdmin) };
  return session;
}

// ログインしたままの操作。期限切れなら一度だけログインし直す
async function authed(action, payload = {}) {
  if (!session) await login();
  try {
    return await call(action, { ...payload, sessionToken: session.token });
  } catch (e) {
    if (e.code !== "SESSION_INVALID") throw e;
    await login();
    return call(action, { ...payload, sessionToken: session.token });
  }
}

// ---------- 名前のくらべ方 ----------
// 空白・全角半角・旧字(栁/柳 など一部)・敬称のちがいは見ない
const VARIANTS = { "栁": "柳", "髙": "高", "﨑": "崎", "邊": "辺", "邉": "辺", "齋": "斎", "齊": "斎", "濵": "浜", "濱": "浜" };
function nameKey(s) {
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
    description: "BT-EX5 会員サイトに、だれとしてログインしているか(管理者かどうか)を返す。",
    inputSchema: { type: "object", properties: {} },
    run: async () => { const s = session || (await login()); return { name: s.name, memberId: s.memberId, isAdmin: s.isAdmin, api: API }; },
  },
  {
    name: "btex5_list_members",
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
    description: "紹介(リファーラル)・ありがとうマイルの集計。",
    inputSchema: { type: "object", properties: {} },
    run: async () => authed("getReferralStats"),
  },
  {
    name: "btex5_compare_roster",
    description: "bt-ex.jp の BT-EX5 の名簿(AI がご本人のブラウザの bt-ex.jp の画面から読み取ったもの)と、会員サイトの名簿をくらべる。読むだけで、何も書きかえない。bt-ex.jp にいて会員サイトにいない人・その逆・業種がちがう人を返す。",
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
      const s = session || (await login());
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
    description: "bt-ex.jp の出席記録(AI がご本人のブラウザの bt-ex.jp の画面から読み取った、その会に出席した方のお名前)と、会員サイトの出席の記録をくらべる。読むだけ。",
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
      const s = session || (await login());
      if (!s.isAdmin) throw new Error("出席を付けられるのは管理者だけです。");
      for (const m of targets) await authed("adminMarkAttendance", { id: ev.id, memberId: m.id, status: st });
      return { marked: targets.map((m) => m.name), status: st, skipped };
    },
  },
  {
    name: "btex5_list_referrals_for_btex",
    description: "ログインしている本人が会員サイトに記録した「紹介(リファーラル)」と「送ったありがとうマイル」のうち、まだ bt-ex.jp に登録していないものを返す(include_posted: true で登録ずみも)。AI はこれを見て、ご本人のブラウザの bt-ex.jp の入力画面に1件ずつ書き写し、送信の前にご本人に確かめてもらう。紹介した相手の連絡先は返さない(bt-ex.jp に必要なときは、ご本人が入れる)。",
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
          ? "bt-ex.jp の入力画面に書き写し、ご本人が送信したら、その id を btex5_mark_btex_posted に渡して「bt-ex.jp に登録ずみ」にしてください(はじめは apply なしで下見)。"
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
];

// ---------- MCP(JSON-RPC 2.0、1行に1つ) ----------
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const replyError = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return reply(id, {
      protocolVersion: (params && params.protocolVersion) || "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: "BT-EX5 会員サイトの名簿・定例会・出欠を扱う。bt-ex.jp の名簿・出席は、ご本人のブラウザで開いた bt-ex.jp の画面から読み取って、compare 系の道具に渡す。書きこむ道具は、まず apply なしで下見を見せ、ご本人の OK をもらってから apply: true で呼ぶこと。",
    });
  }
  if (method === "notifications/initialized" || (method && method.startsWith("notifications/"))) return;
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") return reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  if (method === "tools/call") {
    const tool = TOOLS.find((t) => t.name === (params && params.name));
    if (!tool) return replyError(id, -32602, `道具が見つかりません: ${params && params.name}`);
    try {
      const out = await tool.run((params && params.arguments) || {});
      return reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
    } catch (e) {
      return reply(id, { isError: true, content: [{ type: "text", text: String((e && e.message) || e) }] });
    }
  }
  if (id !== undefined) replyError(id, -32601, `未対応のメソッド: ${method}`);
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); continue; }
    handle(msg).catch((e) => { if (msg.id !== undefined) replyError(msg.id, -32603, String((e && e.message) || e)); });
  }
});
process.stdin.on("end", () => process.exit(0));
