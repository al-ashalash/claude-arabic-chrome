// siwar-diff.mjs — مقابلةُ القاموس كلِّه وقاعدةِ المصطلحات على معجم سوار (الإصدار الثالث).
// يُعيد التجميع من الذاكرة المحلية (_siwar-cache، يملؤها harvest-siwar.mjs) بلا تنزيل، ويُخرج:
//   glossary/_lexicons/ai-pairs.json   الأزواج (en/ar/id) نظيفةً
//   glossary/_lexicons/ai-diff.json    الفروق: كل مصطلحٍ في المعجم له أثرٌ في قاموسنا،
//                                      مع ترجمتنا الحالية وعدد النصوص المتأثرة وحكمٍ أوليّ.
//
// ★ شروط سوار: لا احتفاظ ببيانات واجهاتها أكثر من ثلاثين يومًا، ويُشار إلى المعجم والمنصة والمجمع. فالأداة
// ترفض ذاكرةً خامًا جاوز أقدمُ ملفاتها المدة، والناتجان غير متتبَّعين (_lexicons/) بتاريخ الجلب (‎_meta.fetched‎ =
// أقدم ملفٍ في الذاكرة) وإسناده، و`node siwar-dump.mjs --purge-expired` يحذفهما والذاكرةَ بعد المدة (siwar-lib.mjs).
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS } from "./paths.mjs";
import { LEXDIR, CACHE_DIR, AI_LEXICON_ID as LEX, AI_PAIRS, ATTRIBUTION, RETENTION_DAYS, isExpired, fileDay, fixLemma, isLimitedPairs } from "./siwar-lib.mjs";

const BASE = "https://siwar.ksaa.gov.sa";
const CACHE = path.join(CACHE_DIR, LEX);
const files = fs.existsSync(CACHE) ? fs.readdirSync(CACHE).filter((f) => f.endsWith(".json")) : [];
if (!files.length) {
  console.error(`✗ siwar-diff: لا ذاكرة خام لمعجم البيانات والذكاء الاصطناعي في glossary/_siwar-cache/${LEX} — احصدها أولًا بـharvest-siwar.mjs`);
  process.exit(1);
}
const fetched = files.map((f) => fileDay(path.join(CACHE, f))).sort()[0];
if (isExpired(fetched)) {
  console.error(`✗ siwar-diff: في الذاكرة الخام ملفاتٌ جُلبت ${fetched} وجاوزت ${RETENTION_DAYS} يومًا (شروط سوار) فلم تُستعمل — ` +
    `احذفها بـsiwar-dump.mjs --purge-expired ثم أعد الحصاد بـharvest-siwar.mjs`);
  process.exit(1);
}
// حصادٌ محدود (harvest-siwar.mjs --limit=N) ملأ الذاكرة الخام: الأزواج القائمة مختومةٌ بـ_meta.limited، والذاكرة عيّنةُ تجربةٍ لا معجم.
// فلا تُقرأ إلا بـ--allow-limited (للتجارب وحدها)، ويبقى الختم في الناتجين، فلا تصير العيّنة بإعادة التجميع معجمًا كاملًا بلا ختم.
let prevPairs = null;
try { prevPairs = JSON.parse(fs.readFileSync(AI_PAIRS, "utf8")); } catch {}
const LIMITED = isLimitedPairs(prevPairs) ? prevPairs._meta.limited : null;
if (LIMITED && !process.argv.includes("--allow-limited")) {
  console.error(`✗ siwar-diff: الأزواج القائمة في glossary/${path.relative(GLOSSARY, AI_PAIRS).replace(/\\/g, "/")} من حصادٍ محدود (--limit=${LIMITED})، ` +
    `فالذاكرة الخام عيّنةُ تجربةٍ لا معجم — احصد المعجم كاملًا بـharvest-siwar.mjs بلا --limit، أو أضف --allow-limited للتجربة وحدها`);
  process.exit(1);
}
const writeAtomic = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + ".tmp", data, "utf8"); fs.renameSync(file + ".tmp", file); };
const LEXNAME = "معجم البيانات والذكاء الاصطناعي (الإصدار الثالث)";

const all = files.map((f) => JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8")));
const ar = all.filter((e) => e.lang === "ar");
const terms = [];
for (const e of ar) {
  const en = (e.rel || []).find((r) => r.lang === "eng");
  if (!en || !en.lemma) continue;
  terms.push({ en: fixLemma(en.lemma), ar: fixLemma(e.lemma), id: e.id });
}
writeAtomic(AI_PAIRS, JSON.stringify({
  _meta: { key: "ai-pairs", code: "AI", model: "pairs", lexicon: LEXNAME, lexiconId: LEX,
    publishers: ["الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)", "مجمع الملك سلمان العالمي للغة العربية"],
    concepts: ar.length, pairsEnAr: terms.length, ...(LIMITED ? { limited: LIMITED } : {}), fetched, url: `${BASE}/public-dict-information/${LEX}`, ...ATTRIBUTION,
    note: "مقابلاتٌ مصطلحية فقط (en وar ومعرّف المدخل؛ لا تعريفات ولا أمثلة) من الواجهة العامة للمنصة وقت البناء. غير متتبَّع؛ شروط سوار: لا احتفاظ فوق ثلاثين يومًا من fetched — ترفضه الأدوات بعدها ويحذفه siwar-dump.mjs --purge-expired" },
  terms,
}, null, 1));
console.log(`المفاهيم العربية: ${ar.length} | أزواج en→ar: ${terms.length} | جُلبت ${fetched} → ${path.relative(GLOSSARY, AI_PAIRS)}`);

// ---- المقابلة على القاموس ----
const dict = JSON.parse(fs.readFileSync(path.join(DICTS, "ar.json"), "utf8"));
const S = dict.strings;
const keys = Object.keys(S);
const lowerKey = new Map(keys.map((k) => [k.toLowerCase(), k]));
const base = JSON.parse(fs.readFileSync(path.join(GLOSSARY, "terms-base.json"), "utf8"));
const baseBy = new Map(base.terms.map((t) => [t.en.toLowerCase(), t]));
const strip = (s) => String(s).replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s*\([^)]*\)\s*$/, "").replace(/^ال/, "").trim();
const norm = (s) => s.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim();

const rows = [];
for (const t of terms) {
  const en = norm(t.en);
  if (en.length < 3) continue;
  const re = new RegExp("(^|[^A-Za-z])" + en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:s|es)?(?=[^A-Za-z]|$)", "i");
  const exactKey = lowerKey.get(en) || lowerKey.get(en + "s");
  let inside = 0; for (const k of keys) if (re.test(k)) inside++;
  if (!exactKey && !inside) continue; // لا أثر له عندنا
  const ours = exactKey ? S[exactKey] : null;
  const b = baseBy.get(en);
  const agree = ours ? strip(ours) === strip(t.ar) : null;
  rows.push({ en: t.en, siwar: t.ar, ours, inBase: b ? b.ar : null, baseDecision: b ? b.decision : null, agree, inside, id: t.id });
}
rows.sort((a, b) => (b.inside + (b.ours ? 5 : 0)) - (a.inside + (a.ours ? 5 : 0)));
writeAtomic(path.join(LEXDIR, "ai-diff.json"), JSON.stringify({
  _meta: { key: "ai-diff", code: "AI", model: "diff", lexicon: LEXNAME, lexiconId: LEX, ...(LIMITED ? { limited: LIMITED } : {}), fetched, ...ATTRIBUTION,
    note: "مقابلة القاموس وقاعدة المصطلحات على أزواج المعجم؛ فيه مقابلات سوار فيخضع لمدة الاحتفاظ: يحذفه siwar-dump.mjs --purge-expired بعد ثلاثين يومًا من fetched" },
  rows,
}, null, 1));
const withEntry = rows.filter((r) => r.ours);
console.log(`مصطلحاتٌ لها أثرٌ في قاموسنا: ${rows.length} | لها مدخلٌ مستقل: ${withEntry.length} (متطابق ${withEntry.filter((r) => r.agree).length} · مختلف ${withEntry.filter((r) => !r.agree).length}) | في قاعدتنا: ${rows.filter((r) => r.inBase).length}`);
console.log("\nالاختلافات في المداخل المستقلة (الأكثر أثرًا أولًا):");
for (const r of withEntry.filter((r) => !r.agree).slice(0, 40)) console.log(`  ${r.en}: «${r.ours}» ↔ سوار «${r.siwar}»${r.inBase ? " [قاعدتنا: " + r.inBase + "/" + r.baseDecision + "]" : ""} — يرد داخل ${r.inside} نصًّا`);
console.log("\nمصطلحات القاعدة التي يخالفها سوار:");
for (const b of base.terms) { const t = terms.find((x) => norm(x.en) === b.en.toLowerCase()); if (t && strip(t.ar) !== strip(b.ar)) console.log(`  ${b.en}: قاعدتنا «${b.ar}» (${b.decision}) ↔ سوار «${t.ar}»`); else if (!t) console.log(`  ${b.en}: — لا مدخل في الإصدار الثالث (قاعدتنا «${b.ar}»)`); }
