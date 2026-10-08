// gas/Code.gs を作る: referral/data.js + auth/server-core.js + gas/main.js
// 使い方: node tools/build-gas.mjs        (作り直す)
//         node tools/build-gas.mjs --check (最新かどうかだけ確かめる)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const parts = ["referral/data.js", "auth/server-core.js", "gas/main.js"];

const header = `// ============================================
// BT-EX5 紹介先早見表 — 共有サーバー(Google Apps Script)
// このファイルは tools/build-gas.mjs が自動で作ったものです。直接編集しないでください。
// 元のファイル: ${parts.join(" / ")}
// 設定方法は gas/README.md を参照してください。
// ============================================
`;

const body = parts
  .map((p) => `\n// ---------- ${p} ----------\n` + readFileSync(join(root, p), "utf8"))
  .join("\n");
const out = header + body;
const target = join(root, "gas/Code.gs");

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(target, "utf8"); } catch { /* なし */ }
  if (current !== out) {
    console.error("gas/Code.gs が古くなっています。node tools/build-gas.mjs を実行してください。");
    process.exit(1);
  }
  console.log("gas/Code.gs は最新です。");
} else {
  writeFileSync(target, out);
  console.log(`gas/Code.gs を作りました(${out.length.toLocaleString()} 文字)`);
}
