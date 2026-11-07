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

import { createTools, handleRpc } from "./core.mjs";

const API = process.env.BTEX5_API || "https://script.google.com/macros/s/AKfycbw_Pb3sqA4O83kwIiT5GPO9cBGfhyh5knBqgebBPbKxbedMkzS9skIIH6M7MKb3pP9mqA/exec";
const NAME = process.env.BTEX5_NAME || "";
const PASSWORD = process.env.BTEX5_PASSWORD || "";

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

const TOOLS = createTools({ authed, me: async () => session || (await login()) });

// ---------- 標準入出力(1行に1つの JSON-RPC) ----------
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
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
    handleRpc(msg, TOOLS).then((r) => { if (r) send(r); }).catch((e) => { if (msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String((e && e.message) || e) } }); });
  }
});
process.stdin.on("end", () => process.exit(0));
