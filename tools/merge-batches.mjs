// merge-batches.mjs — merge the translated _ar_batches/*.json into user/dictionaries/ar.json.
// Existing (hand-curated) entries win on conflict; new entries are added.
// Usage: node merge-batches.mjs [--domain=<نطاق>]   (دفعات glossary/<نطاق>/_ar_batches إلى قاموسه)
import fs from "node:fs";
import path from "node:path";
import { DICTS, GLOSSARY } from "./paths.mjs";

// نصٌّ فيه متغيّر لا يصلح مفتاحًا حرفيًّا: الصفحة تعرض قيمةً لا «{name}»، فلا يطابق
// شيئًا أبدًا ويتضخّم به القاموس. مكانُه القواعد (gen-patterns بحرّاس makePattern).
const VAR_KEY_RE = new RegExp("\\{[A-Za-z_$][\\w$]*\\}");
// ★ (ت14-هـ0ب) ومتغيّر ICU (‎{x, number}‎ و‎{x, date}‎ والجمع والاختيار) لا يصلح مفتاحًا كذلك: كان ‎"{available, number} … seat(s) available"‎
// يدخل strings مفتاحًا لا تعرضه الصفحة أبدًا، ومكانُه gen-patterns (يضيّق التقاطه) أو merge-icu
const ICU_KEY_RE = /\{[A-Za-z_$][\w$]*\s*,\s*(?:number|date|time|plural|select|selectordinal)\b/;
// ★ (ت14-هـ0ب، القرار 142) الفقرات: الصفحة تعرض كل فقرةٍ (بسطرٍ فارغ) عقدةَ نصٍّ وحدها — كما يقسمها ماسح المحرّك — فمدخل الرسالة كاملةً لا يُطلب
// أبدًا (85 من نهائيات ت10 لم تصل الصفحة لهذا). يُضاف لكل فقرةٍ مدخلها بترتيبها إن تساوى عدد الفقرات في الطرفين، بقاعدة التصادم نفسها،
// والرسالة كاملةً كما كانت؛ والعدد المختلف يُذكر ولا يُخمَّن
const PARA_RE = /\n[ \t]*\n/;

const { C, domainArg, domainsOf, dictFile, workDir, batchDir, label, harvestKeys } = await import(new URL("./domain-arg.mjs", import.meta.url).href);
const DOMAIN = domainArg(process.argv);
const bDir = batchDir(DOMAIN);
if (!fs.existsSync(bDir)) { console.error(`! لا مجلد دفعات لـ${label(DOMAIN)}: ${bDir}`); process.exit(1); }
const files = fs.readdirSync(bDir).filter((f) => f.endsWith(".json")).sort();

const arPath = dictFile(DOMAIN);
const dict = JSON.parse(fs.readFileSync(arPath, "utf8"));
dict.strings = dict.strings || {};
const before = Object.keys(dict.strings).length;

let seen = 0, added = 0, updated = 0, skipped = 0, bad = 0, icuSkipped = 0, paraAdded = 0, paraMismatch = 0;
const paraBad = [];
const overrideSeen = new Map(); // ★ ملفا override يمسّان مفتاحًا واحدًا بقيمتين = الأخير بترتيب الاسم يدهس الأول بصمت
let overrideClash = 0;
for (const f of files) {
  const isOverride = /override/i.test(f); // files named *override* overwrite existing entries
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(bDir, f), "utf8")); }
  catch (e) { bad++; console.warn("! unparseable:", f); continue; }
  // مدخلٌ واحد بقاعدة التصادم: القائم يبقى إلا في ملف override
  const put = (en, ar, isPara) => {
    const exists = Object.prototype.hasOwnProperty.call(dict.strings, en);
    if (exists && !isOverride) return false;                      // keep curated unless override
    if (isOverride) { const prev = overrideSeen.get(en); if (prev !== undefined && prev !== ar) overrideClash++; overrideSeen.set(en, ar); }
    if (exists && dict.strings[en] === ar) return false;
    dict.strings[en] = ar;
    if (isPara) paraAdded++; else if (exists) updated++; else added++;
    return true;
  };
  for (const p of arr) {
    if (!p || typeof p.en !== "string") continue;
    // ★ نصُّ فيه متغيّر لا يصلح مفتاحًا حرفيًّا: الصفحة تعرض قيمةً لا «{name}»،
    // فمكانُه القواعد (gen-patterns بحرّاس makePattern) لا strings
    // ★ (ت14-هـ0ب) ورسالةٌ بمتغيّرٍ وفقرات: فقراتها التي لا متغيّر فيها نصوصٌ ثابتة على الصفحة (عقدةٌ لكلٍّ منها)، فتُضاف مداخلها والرسالة للقواعد
    const varKey = VAR_KEY_RE.test(p.en), icuKey = ICU_KEY_RE.test(p.en);
    if ((varKey || icuKey) && typeof p.ar === "string" && PARA_RE.test(p.en)) {
      const pe = p.en.trim().split(PARA_RE).map((x) => x.trim()), pa = p.ar.trim().split(PARA_RE).map((x) => x.trim());
      if (pe.length === pa.length && pe.every(Boolean) && pa.every(Boolean)) pe.forEach((x, i) => { if (!/\{/.test(x) && pa[i] !== x && !/\{/.test(pa[i])) put(x, pa[i], true); });
      else { paraMismatch++; paraBad.push({ file: f, en: p.en.trim().slice(0, 60), en_paras: pe.length, ar_paras: pa.length }); }
    }
    if (varKey) { skipped++; continue; }
    if (icuKey) { skipped++; icuSkipped++; continue; }
    seen++;
    const en = p.en.trim(), ar = (p.ar || "").trim();
    if (!en || !ar || ar === en) { skipped++; continue; }         // skip empty / brand-kept
    if (PARA_RE.test(en)) {
      const pe = en.split(PARA_RE).map((x) => x.trim()), pa = ar.split(PARA_RE).map((x) => x.trim());
      if (pe.length === pa.length && pe.every(Boolean) && pa.every(Boolean)) pe.forEach((x, i) => { if (pa[i] !== x) put(x, pa[i], true); });
      else { paraMismatch++; paraBad.push({ file: f, en: en.slice(0, 60), en_paras: pe.length, ar_paras: pa.length }); }
    }
    if (!put(en, ar, false)) skipped++;
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
console.log(`(ت14-هـ0ب) paragraph entries added: ${paraAdded} | paragraph count differs: ${paraMismatch} | ICU keys skipped: ${icuSkipped}`);
for (const b of paraBad.slice(0, 20)) console.warn(`⚠ paragraphs differ (${b.en_paras} en / ${b.ar_paras} ar) in ${b.file}: «${b.en}…»`);
console.log(`${path.basename(arPath)} strings: ${before} -> ${Object.keys(dict.strings).length}`);
