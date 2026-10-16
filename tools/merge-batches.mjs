// merge-batches.mjs — merge the translated _ar_batches/*.json into user/dictionaries/ar.json.
// Existing (hand-curated) entries win on conflict; new entries are added.
// Usage: node merge-batches.mjs [--domain=<نطاق>]   (دفعات glossary/<نطاق>/_ar_batches إلى قاموسه)
import fs from "node:fs";
import path from "node:path";
import { DICTS, GLOSSARY } from "./paths.mjs";

// نصٌّ فيه متغيّر لا يصلح مفتاحًا حرفيًّا: الصفحة تعرض قيمةً لا «{name}»، فلا يطابق
// شيئًا أبدًا ويتضخّم به القاموس. مكانُه القواعد (gen-patterns بحرّاس makePattern).
const VAR_KEY_RE = new RegExp("\\{[A-Za-z_$][\\w$]*\\}");

const { C, domainArg, domainsOf, dictFile, workDir, batchDir, label, harvestKeys } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
const DOMAIN = domainArg(process.argv);
const bDir = batchDir(DOMAIN);
if (!fs.existsSync(bDir)) { console.error(`! لا مجلد دفعات لـ${label(DOMAIN)}: ${bDir}`); process.exit(1); }
const files = fs.readdirSync(bDir).filter((f) => f.endsWith(".json")).sort();

const arPath = dictFile(DOMAIN);
const dict = JSON.parse(fs.readFileSync(arPath, "utf8"));
dict.strings = dict.strings || {};
const before = Object.keys(dict.strings).length;

let seen = 0, added = 0, updated = 0, skipped = 0, bad = 0;
const overrideSeen = new Map(); // ★ ملفا override يمسّان مفتاحًا واحدًا بقيمتين = الأخير بترتيب الاسم يدهس الأول بصمت
let overrideClash = 0;
for (const f of files) {
  const isOverride = /override/i.test(f); // files named *override* overwrite existing entries
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(bDir, f), "utf8")); }
  catch (e) { bad++; console.warn("! unparseable:", f); continue; }
  for (const p of arr) {
    if (!p || typeof p.en !== "string") continue;
    // ★ نصُّ فيه متغيّر لا يصلح مفتاحًا حرفيًّا: الصفحة تعرض قيمةً لا «{name}»،
    // فمكانُه القواعد (gen-patterns بحرّاس makePattern) لا strings
    if (VAR_KEY_RE.test(p.en)) { skipped++; continue; }
    seen++;
    const en = p.en.trim(), ar = (p.ar || "").trim();
    if (!en || !ar || ar === en) { skipped++; continue; }         // skip empty / brand-kept
    const exists = Object.prototype.hasOwnProperty.call(dict.strings, en);
    if (exists && !isOverride) { skipped++; continue; }            // keep curated unless override
    if (isOverride) { const prev = overrideSeen.get(en); if (prev !== undefined && prev !== ar) overrideClash++; overrideSeen.set(en, ar); }
    if (exists && dict.strings[en] === ar) { skipped++; continue; }
    dict.strings[en] = ar;
    if (exists) updated++; else added++;
  }
}

// stable alphabetical order for readability
const ordered = {};
for (const k of Object.keys(dict.strings).sort((a, b) => a.localeCompare(b))) ordered[k] = dict.strings[k];
dict.strings = ordered;
if (dict._meta) dict._meta.count = Object.keys(dict.strings).length;
if (overrideClash) console.warn("⚠ " + overrideClash + " مفتاحًا مسّه أكثر من ملف override بقيمٍ مختلفة — انقل المُطبَّق منها إلى _applied/ (الأخيرُ بترتيب الاسم هو ما ساد)");

fs.writeFileSync(arPath, JSON.stringify(dict, null, 2) + "\n", "utf8");
console.log(`batches: ${files.length} (bad: ${bad}) | pairs seen: ${seen} | added: ${added} | updated: ${updated} | skipped: ${skipped}`);
console.log(`${path.basename(arPath)} strings: ${before} -> ${Object.keys(dict.strings).length}`);
