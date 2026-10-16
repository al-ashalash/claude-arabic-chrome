// validate-batch.mjs — تحقّقٌ آليٌّ من دفعة ترجمة قبل دمجها: كل سطرٍ في المدخل له زوجٌ واحد
// بنصٍّ إنجليزي حرفي، والمتغيّرات والوسوم في العربية هي نفسها في الإنجليزية، ولا ترجمة فارغة.
//   node validate-batch.mjs <chunk.txt> <out.json>     → يطبع الملخّص ويخرج 1 عند أي خلل
//   node validate-batch.mjs --mode=block <todo.json> <out.json>   → دفعة كتل المتون (validate-blocks.mjs)
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--mode=block")) {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("./validate-blocks.mjs", import.meta.url)),
    ...process.argv.slice(2).filter((a) => a !== "--mode=block")], { stdio: "inherit" });
  process.exit(r.status === null ? 1 : r.status);
}
const [chunkPath, outPath] = process.argv.slice(2);
if (!chunkPath || !outPath) { console.error("الاستعمال: node validate-batch.mjs <chunk.txt> <out.json>"); process.exit(2); }
const lines = fs.readFileSync(chunkPath, "utf8").split("\n").filter(Boolean);
let arr;
try { arr = JSON.parse(fs.readFileSync(outPath, "utf8")); } catch (e) { console.error("✗ JSON غير صالح:", e.message); process.exit(1); }
if (!Array.isArray(arr)) { console.error("✗ ليس مصفوفة"); process.exit(1); }

// ما يُحفظ حرفيًّا: {var}، ${var}، مفاتيح فروع ICU (one/other/…) — تُقارَن كمجموعات مرتَّبة
const VARS = /\$?\{[A-Za-z_$][\w$]*(?:,\s*(?:plural|select|selectordinal|number|date|time)[^{}]*)?/g;
const TAGS = /<\/?[a-zA-Z][\w-]*\s*\/?>/g;
const ICU_KEYS = /\b(one|other|zero|two|few|many|=\d+)\s*\{/g;
function sig(s, re) { return (s.match(re) || []).map((x) => x.replace(/\s+/g, "")).sort().join("|"); }

const errors = [];
const seen = new Map();
for (const [i, p] of arr.entries()) {
  if (!p || typeof p.en !== "string" || typeof p.ar !== "string") { errors.push(`#${i}: عنصر ناقص`); continue; }
  if (seen.has(p.en)) errors.push(`#${i}: مكرّر: ${p.en.slice(0, 60)}`);
  seen.set(p.en, p.ar);
  if (!p.ar.trim()) errors.push(`#${i}: ترجمة فارغة: ${p.en.slice(0, 60)}`);
  if (sig(p.en, VARS) !== sig(p.ar, VARS)) errors.push(`#${i}: متغيّرات مختلّة: ${p.en.slice(0, 60)}`);
  if (sig(p.en, TAGS) !== sig(p.ar, TAGS)) errors.push(`#${i}: وسوم مختلّة: ${p.en.slice(0, 60)}`);
  if (sig(p.en, ICU_KEYS) !== sig(p.ar, ICU_KEYS)) errors.push(`#${i}: فروع ICU مختلّة: ${p.en.slice(0, 60)}`);
  if ((p.en.match(/#/g) || []).length !== (p.ar.match(/#/g) || []).length && /plural/.test(p.en)) errors.push(`#${i}: عدد # مختلف: ${p.en.slice(0, 60)}`);
  if (/[\u0590-\u05FF]/.test(p.ar)) errors.push(`#${i}: حروف غير مسموحة`);
}
const missing = lines.filter((l) => !seen.has(l));
const extra = [...seen.keys()].filter((k) => !lines.includes(k));
const kept = arr.filter((p) => p && p.en === p.ar).length;
const translated = arr.length - kept;
for (const m of missing.slice(0, 15)) errors.push(`مفقود: ${m.slice(0, 70)}`);
for (const x of extra.slice(0, 15)) errors.push(`زائد (ليس في المدخل حرفيًّا): ${x.slice(0, 70)}`);

console.log(`المدخل ${lines.length} | المخرَج ${arr.length} | مترجَم ${translated} | مُبقًى ${kept} | مفقود ${missing.length} | زائد ${extra.length} | أخطاء ${errors.length}`);
for (const e of errors.slice(0, 40)) console.log("  ✗", e);
if (errors.length > 40) console.log("  … و" + (errors.length - 40) + " أخرى");
process.exit(errors.length ? 1 : 0);
