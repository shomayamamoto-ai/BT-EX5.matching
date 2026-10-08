// 各ページが読み込む自前の .js / .css に ?v=<日時> を付け直す。
// ブラウザが古いファイルを使い続けないよう、サイトを更新するたびに実行する。
// 使い方: node tools/stamp-assets.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = new Date();
const pad = (n) => String(n).padStart(2, "0");
const version = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith(".") || name === "node_modules" || name === "gas" || name === "docs" || name === "tools") return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith(".html") ? [p] : [];
  });
}

let count = 0;
for (const file of htmlFiles(root)) {
  const before = readFileSync(file, "utf8");
  // 外部URL(https://)は対象外。相対パスの .js / .css だけ
  const after = before.replace(/((?:src|href)=")((?!https?:|\/\/)[^"?#]+\.(?:js|css))(?:\?v=[^"]*)?"/g, (_, attr, path) => `${attr}${path}?v=${version}"`);
  if (after !== before) {
    writeFileSync(file, after);
    count++;
  }
}
console.log(`?v=${version} を ${count} ページに付けました`);
