// ============================================
// mcp/worker/src/index.js — BT-EX5 会員サイトの MCP サーバー(インターネット版。Cloudflare Workers)
//
// ChatGPT・Claude・Gemini などの AI に「MCP サーバーの URL」(https://…/mcp)を入れるとつながる。
// つなぐときは BT-EX5 のログイン画面(お名前・パスワード)が開き、「許可する」で、その AI がご本人として使えるようになる(OAuth)。
// 道具の中身は mcp/core.mjs(パソコン版と同じ)。データは共有サーバー(Google Apps Script)にあり、ここには持たない。
// ここに残るのは、AI ごとの許可(共有サーバーのログインの合いことば)だけ(暗号化して KV に保存。OAuth の部品が管理)。
// ============================================
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { createTools, handleRpc } from "../../core.mjs";

const DEFAULT_API = "https://script.google.com/macros/s/AKfycbw_Pb3sqA4O83kwIiT5GPO9cBGfhyh5knBqgebBPbKxbedMkzS9skIIH6M7MKb3pP9mqA/exec";
const DAY = 24 * 60 * 60;

// ---------- 共有サーバー(GAS)へ ----------
async function gas(env, action, payload) {
  const res = await fetch(env.BTEX5_API || DEFAULT_API, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, action, userAgent: "btex5-mcp-worker/1.0" }),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`共有サーバーにつながりませんでした(HTTP ${res.status})`);
  const json = await res.json();
  if (json && json.success === true) return json.data || {};
  const err = (json && json.error) || {};
  const e = new Error(err.message || err.code || "共有サーバーがエラーを返しました");
  e.code = err.code || "";
  throw e;
}

// ---------- MCP の入口(/mcp)。OAuth の部品が、正しいアクセストークンのときだけここに通す ----------
const mcpHandler = {
  async fetch(request, env, ctx) {
    const props = ctx.props || {};
    if (request.method === "GET") return new Response("このサーバーは、知らせ(SSE)を送りません。POST で使ってください。", { status: 405, headers: { Allow: "POST, DELETE" } });
    if (request.method === "DELETE") return new Response(null, { status: 204 });
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
    let body;
    try { body = await request.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }

    // 共有サーバーのログインが切れたら(30日)、AI につなぎ直してもらう(401 → AI が BT-EX5 のログイン画面を出す)
    let expired = false;
    const authed = async (action, payload = {}) => {
      try { return await gas(env, action, { ...payload, sessionToken: props.sessionToken }); }
      catch (e) { if (e.code === "SESSION_INVALID") { expired = true; throw new Error("BT-EX5 のログインの期限が切れました。AI のアプリで BT-EX5 をつなぎ直してください。"); } throw e; }
    };
    const tools = createTools({ authed, me: async () => ({ name: props.name, memberId: props.memberId, isAdmin: !!props.isAdmin }) });

    const batch = Array.isArray(body);
    const out = [];
    for (const msg of batch ? body : [body]) {
      const r = await handleRpc(msg, tools);
      if (r) out.push(r);
    }
    if (expired) {
      return new Response(JSON.stringify({ error: "invalid_token", error_description: "BT-EX5 のログインの期限が切れました" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${new URL("/.well-known/oauth-protected-resource/mcp", request.url).href}"` },
      });
    }
    if (!out.length) return new Response(null, { status: 202 });
    return json(batch ? out : out[0]);
  },
};

const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });

// ---------- ログイン画面(/authorize)と、案内(/) ----------
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function page(title, inner, headers) {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
:root{--bg:#f8f3f0;--card:#fff;--ink:#3a2a24;--sub:#7a645c;--coral:#d9776b;--line:#ecdcd6}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:16px/1.7 "Hiragino Sans","Noto Sans JP",system-ui,sans-serif;padding:16px}
.card{width:min(100%,420px);background:var(--card);border:1px solid var(--line);border-radius:20px;padding:28px 24px;box-shadow:0 12px 40px rgba(80,40,30,.08)}
h1{margin:0 0 4px;font:700 24px/1.3 "Shippori Mincho","Hiragino Mincho ProN",serif;letter-spacing:.04em}h1 b{color:var(--coral)}
p{margin:8px 0;color:var(--sub);font-size:14px}.who{margin:14px 0;padding:12px 14px;border-radius:12px;background:#fbefec;font-size:14px;color:var(--ink)}
.who small{display:block;color:var(--sub)}label{display:block;margin:14px 0 4px;font-weight:700;font-size:14px}
input{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:12px;font:inherit;background:#fff}input:focus{outline:2px solid var(--coral);border-color:transparent}
.row{display:flex;gap:10px;margin-top:20px}button{flex:1;padding:13px;border-radius:999px;border:0;font:700 15px inherit;cursor:pointer}
.ok{background:var(--coral);color:#fff}.no{background:#f1e7e3;color:var(--ink)}.err{color:#b4554a;font-weight:700}.warn{color:#9a5a12}
ul{margin:8px 0 0;padding-left:1.2em;color:var(--sub);font-size:14px}
</style></head><body><main class="card">${inner}</main></body></html>`;
  const h = new Headers(headers || {});
  h.set("Content-Type", "text/html; charset=utf-8");
  h.set("Cache-Control", "no-store");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "no-referrer");
  return new Response(html, { headers: h });
}

function loginPage(desc, tx, opts = {}) {
  return page("BT-EX5 につなぐ", `
<h1><b>BT-EX5</b> を AI につなぐ</h1>
<p>BT-EX5 会員サイトのお名前とパスワードでログインし、「許可する」を押すと、この AI がご本人として、定例会の予定や記録を調べたり、1on1・ありがとうマイル・リファーラルを登録したりできるようになります。</p>
<div class="who">つなぐ AI: <b>${esc(desc.clientName)}</b><small>行き先: ${esc(desc.redirectHost)}</small>${desc.redirectIsLoopback ? '<small class="warn">この端末の中のアプリへの接続です。心当たりがないときは「やめる」を押してください。</small>' : ""}</div>
${opts.error ? `<p class="err">${esc(opts.error)}</p>` : ""}
<form method="post">
<input type="hidden" name="handle" value="${esc(tx.handle)}">
<label for="n">お名前</label><input id="n" name="name" autocomplete="username" required value="${esc(opts.name || "")}" placeholder="例:山本 捷真">
<label for="p">パスワード</label><input id="p" name="password" type="password" autocomplete="current-password" required placeholder="会員サイトと同じパスワード">
<p>まだパスワードを決めていない方は、会員の共通パスコードを入れてください。</p>
<div class="row"><button class="no" name="decision" value="deny" formnovalidate>やめる</button><button class="ok" name="decision" value="allow">許可する</button></div>
</form>`, tx.headers);
}

const defaultHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/authorize") {
      try {
        if (request.method === "GET") {
          const authReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
          const desc = await env.OAUTH_PROVIDER.describeConsent(authReq);
          return loginPage(desc, await env.OAUTH_PROVIDER.beginConsent(authReq));
        }
        if (request.method === "POST") {
          const form = await request.formData();
          const handle = String(form.get("handle") || "");
          if (form.get("decision") === "deny") {
            const d = await env.OAUTH_PROVIDER.denyConsent(request, handle, { description: "ご本人がやめました" });
            return new Response(null, { status: 302, headers: d.headers });
          }
          const approved = await env.OAUTH_PROVIDER.approveConsent(request, handle);
          const name = String(form.get("name") || "").trim().slice(0, 60);
          const password = String(form.get("password") || "");
          let s;
          try {
            s = await gas(env, "accountLogin", { name, password, remember: true });
          } catch (e) {
            // まちがえたときは、同じ依頼でもう一度ログイン画面を出す(合いことばは1回きりなので作り直す)
            const desc = await env.OAUTH_PROVIDER.describeConsent(approved.request);
            const tx = await env.OAUTH_PROVIDER.beginConsent(approved.request);
            const msg = e.code === "LOCKED" ? "何度かまちがえたため、しばらくログインできません。時間をおいてください。" : e.message || "ログインできませんでした。";
            return loginPage(desc, tx, { error: msg, name });
          }
          const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
            request: approved.request,
            userId: encodeURIComponent(s.memberId),
            metadata: { name: s.displayName, at: Date.now() },
            scope: approved.request.scope,
            props: { sessionToken: s.sessionToken, memberId: s.memberId, name: s.displayName, isAdmin: !!(s.user && s.user.isAdmin) },
          });
          const h = new Headers(approved.headers);
          h.set("Location", redirectTo);
          return new Response(null, { status: 302, headers: h });
        }
        return new Response("Method Not Allowed", { status: 405 });
      } catch (e) {
        return page("つなげませんでした", `<h1>つなげませんでした</h1><p class="err">${esc(e && e.message ? e.message : e)}</p><p>AI のアプリで、もう一度 BT-EX5 をつないでください。</p>`);
      }
    }
    if (url.pathname === "/" || url.pathname === "") {
      return page("BT-EX5 MCP サーバー", `<h1><b>BT-EX5</b> MCP サーバー</h1>
<p>AI(ChatGPT・Claude・Gemini など)に BT-EX5 会員サイトをつなぐためのサーバーです。AI のアプリの「コネクター」「カスタムアプリ」などに、次の URL を入れてください。</p>
<div class="who"><b>${esc(new URL("/mcp", request.url).href)}</b></div>
<p>くわしいつなぎ方は、会員サイトの「AI との連携」にあります${env.APP_URL ? `(<a href="${esc(env.APP_URL)}">会員サイトを開く</a>)` : ""}。</p>`);
    }
    return new Response("Not Found", { status: 404 });
  },
};

// 公開した URL(例: https://btex5-mcp.○○.workers.dev)。設定(PUBLIC_URL)がなければ、来た依頼の URL から決める
const providers = new Map();
function providerFor(origin) {
  if (!providers.has(origin)) {
    providers.set(origin, new OAuthProvider({
      apiRoute: "/mcp",
      apiHandler: mcpHandler,
      defaultHandler,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/token",
      clientRegistrationEndpoint: "/register",
      // ChatGPT などは、登録の代わりに「クライアントの説明書の URL」(CIMD)を使うことがある
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: ["btex5"],
      resourceMetadata: { resource: `${origin}/mcp`, resource_name: "BT-EX5 会員サイト" },
      // AI に渡す合いことば: 1時間ごとに自動で取り直す。許可そのものは30日(共有サーバーのログインと同じ長さ)
      accessTokenTTL: 60 * 60,
      refreshTokenTTL: 30 * DAY,
    }));
  }
  return providers.get(origin);
}

export default {
  fetch(request, env, ctx) {
    const origin = String(env.PUBLIC_URL || new URL(request.url).origin).replace(/\/+$/, "");
    return providerFor(origin).fetch(request, env, ctx);
  },
};
