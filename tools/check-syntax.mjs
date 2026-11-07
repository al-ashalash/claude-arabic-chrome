// check-syntax.mjs — بوابة CI الأولى: صياغة كل ملفات JS في الإضافة والأدوات
// (node --check لكل ملف — يلتقط ما قد يفلت من مراجعة يدوية قبل الدمج).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EXT } from "./paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIRS = [EXT, HERE]; // الإضافة + الأدوات (في البنيتين: toolchain أو tools)

let checked = 0, failed = 0;
for (const dir of DIRS) {
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(js|mjs)$/.test(f)) continue;
    const fp = path.join(dir, f);
    const r = spawnSync(process.execPath, ["--check", fp], { encoding: "utf8" });
    checked++;
    if (r.status !== 0) {
      failed++;
      console.error(`✗ ${path.relative(process.cwd(), fp)}\n${(r.stderr || "").slice(0, 400)}`);
    }
  }
}
console.log(failed ? `✗ أخفق ${failed} من ${checked}` : `✓ الصياغة سليمة في ${checked} ملفًا`);
// ★ (ر24-د2، مراجعة ر24-د F-03) وبوابة الجلب في ملفات الإضافة (fetch-gate.mjs): كل fetch بـcredentials:"omit" أو من الحزمة (chrome.runtime.getURL)
const { scanDir } = await import("./fetch-gate.mjs");
const fetchBad = scanDir(EXT);
for (const b of fetchBad) console.error(`✗ ${b.file}:${b.line} ${b.why}`);
console.log(fetchBad.length ? `✗ بوابة الجلب: ${fetchBad.length} مخالفة` : "✓ بوابة الجلب: كل fetch في الإضافة بلا اعتماد أو من الحزمة");
process.exit(failed || fetchBad.length ? 1 : 0);
