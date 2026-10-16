// harvest-siwar.mjs — حصادُ مقابلات المصطلحات من معجمٍ عام على منصة «سوار» (مجمع الملك سلمان).
//
// يقرأ ما يقرؤه أيُّ زائرٍ للمنصة عبر واجهتها العامة نفسِها (لا مفتاح، لا تسجيل)، **وقت
// البناء على جهاز المطوّر فقط** — لا شأن للإضافة بهذا (عهد الخصوصية). ويأخذ **المقابلَ
// المصطلحي وحده** (اللِّمّة العربية ومقابلها الإنجليزي ومعرّفَ المدخل للإسناد) — **لا
// التعريفات**، فهي محتوًى محميٌّ لأصحابه.
//
//   node harvest-siwar.mjs [--lexicon=<id>] [--out=<ملف>] [--limit=<N>] [--dry-run] [--self-test]
// الافتراضي: معجم البيانات والذكاء الاصطناعي (سدايا + المجمع، الإصدار الثالث) ⇒ glossary/_lexicons/ai-pairs.json
// (ولغيره glossary/_lexicons/pairs-<id>.json). مهذّب: 4 طلبات متزامنة، وتأخيرٌ صغير، وقابلٌ للاستئناف (يتخطى ما نُزّل).
//
// ‎--limit=N‎ (للتجارب الصغيرة): لا يُجلب أكثر من N مدخلًا. تُقرأ صفحات القائمة حتى يجتمع N مدخلًا رأسُها عربي
// (التجميع يتخطى غيرها على كل حال)، ثم تُطلب تلك المداخل وحدها: طلبُ قائمةٍ واحد في الغالب، وN طلبًا على الأكثر.
// ولا يكتب فوق حصادٍ كامل قائم. ويُختم ناتجه بـ_meta.limited = N، فترفضه الأدوات القارئة (terms-match وsiwar-terms وsiwar-diff)
// إلا بـ--allow-limited الذي لا تمرّره إلا وصفة التجربة (siwar-lib.mjs). وبلا ‎--limit‎ يبقى السلوك كما هو: المعجم كله.
// ‎--dry-run‎: يتحقق من الوسائط ومن حارس ‎--out‎، ويطبع الخطة، ويخرج بلا أي طلب ولا كتابة.
// ‎--self-test‎: فحصٌ ذاتي لمنطق الاختيار على بياناتٍ مصطنعة، بلا شبكة ولا ملفات.
//
// ★ شروط سوار: لا احتفاظ ببيانات واجهاتها أكثر من ثلاثين يومًا، ويُشار إلى المعجم والمنصة والمجمع. فالناتج
// غير متتبَّع (_lexicons/) ويحمل تاريخ جلبه (‎_meta.fetched‎ = أقدم مدخلٍ جُمع منه) وإسناده، والذاكرة الخام في
// _siwar-cache/ غير متتبَّعة كذلك ويُعاد جلب ما جاوز منها المدة؛ و`node siwar-dump.mjs --purge-expired` يحذف
// من الموضعين ما جاوزها، والأدوات القارئة ترفضه (siwar-lib.mjs). لا يُكتب شيءٌ من هذا في ملفٍ متتبَّع.
import fs from "node:fs";
import path from "node:path";
import { LEXDIR, CACHE_DIR, AI_LEXICON_ID, AI_PAIRS, ATTRIBUTION, isExpired, fileDay, fixLemma, assertIgnoredOut } from "./siwar-lib.mjs";

const BASE = "https://siwar.ksaa.gov.sa";
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.split("=").slice(1).join("=") : d; };
const die = (msg, code = 2) => { console.error(`✗ harvest-siwar: ${msg}`); process.exit(code); };

// اختيار معرّفات المداخل من صفحة قائمة: بلا حدٍّ تؤخذ كلها بترتيبها؛ ومع الحد تؤخذ ذوات الرأس العربي وحدها حتى يُبلغ
const AR_HEAD = /[ء-ي]/;
function take(ids, words, limit) {
  for (const w of words || []) {
    if (ids.size >= limit) break;
    if (Number.isFinite(limit) && !AR_HEAD.test(String(w.word || ""))) continue;
    ids.set(w.lexicalEntryId, w.word);
  }
  return ids;
}
if (process.argv.includes("--self-test")) {
  const page = [{ lexicalEntryId: "a", word: "سحابة" }, { lexicalEntryId: "b", word: "cloud" }, { lexicalEntryId: "c", word: "خادم" },
    { lexicalEntryId: "d", word: "شبكة" }, { lexicalEntryId: "a", word: "سحابة" }];
  const keys = (limit) => [...take(new Map(), page, limit).keys()].join(",");
  const cases = [[Infinity, "a,b,c,d"], [2, "a,c"], [1, "a"], [10, "a,c,d"]];
  const bad = cases.filter(([n, want]) => keys(n) !== want);
  for (const [n, want] of bad) console.error(`✗ limit=${n}: ${keys(n)} ≠ ${want}`);
  console.log(bad.length ? `✗ الفحص الذاتي: أخفق ${bad.length} من ${cases.length}` : `✓ الفحص الذاتي: ${cases.length} حالات`);
  process.exit(bad.length ? 1 : 0);
}

const LEX = arg("lexicon", AI_LEXICON_ID);
const OUT = arg("out", LEX === AI_LEXICON_ID ? AI_PAIRS : path.join(LEXDIR, `pairs-${LEX}.json`));
const LIMIT_ARG = arg("limit", null);
const LIMIT = LIMIT_ARG === null ? Infinity : Number(LIMIT_ARG);
if (LIMIT_ARG !== null && !(Number.isInteger(LIMIT) && LIMIT > 0)) die(`‎--limit‎ يقبل عددًا صحيحًا موجبًا، وجاء «${LIMIT_ARG}»`);
const LIMITED = Number.isFinite(LIMIT);
assertIgnoredOut(OUT, "harvest-siwar"); // ‎--out‎ أيضًا: لا يُكتب الناتج إلا في موضعٍ يتجاهله git، قبل أي طلب
if (LIMITED && fs.existsSync(OUT)) { // حصادٌ محدود لا يحلّ محلَّ حصادٍ كامل
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUT, "utf8"))._meta || {}; } catch {}
  if (!prev.limited) die(`${OUT} حصادٌ كامل قائم؛ الحصاد المحدود لا يكتب فوقه (احذفه بعد انتهاء دورته، أو اختر ‎--out‎ آخر متجاهَلًا)`);
}
if (process.argv.includes("--dry-run")) {
  console.log(`تشغيلٌ جاف بلا طلب: المعجم ${LEX} | المخرج ${path.relative(process.cwd(), OUT)} (متجاهَل) | ` +
    (LIMITED ? `الحد: ${LIMIT} من المداخل؛ طلبُ قائمةٍ واحد في الغالب، وطلبات المداخل ${LIMIT} على الأكثر` : "بلا حد: المعجم كله"));
  process.exit(0);
}
const CACHE = path.join(CACHE_DIR, LEX);
fs.mkdirSync(CACHE, { recursive: true });
const UA = { "User-Agent": "claude-mutarjim/1.0 (open-source Arabic UI; term-equivalents only, build-time)", "Accept": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function screen(first, rows) {
  const res = await fetch(`${BASE}/api/screens/public/get-lexicon-search-screen-data/${LEX}?languageCode=ar`, {
    method: "POST", headers: { ...UA, "Content-Type": "application/json" },
    body: JSON.stringify({ preferences: { filters: {}, first, rows, multisortmeta: [] } }),
  });
  if (!res.ok) throw new Error("screen " + res.status);
  return res.json();
}

// ---- 1) قائمة المداخل ----
const first = await screen(0, 100);
const meta = first.lexicon || {};
const total = first.paginated.totalCount;
console.log(`المعجم: ${meta.name} | المؤلف: ${(meta.authors || []).map((a) => a.name).join("، ")} | المداخل: ${total}` +
  (LIMITED ? ` | الحد: ${LIMIT}` : ""));
let ids = take(new Map(), first.paginated.words, LIMIT);
for (let f = 100; f < total && ids.size < LIMIT; f += 100) {
  const pg = await screen(f, 100);
  take(ids, pg.paginated.words, LIMIT);
  process.stdout.write(`\rالقائمة: ${ids.size}/${total}   `);
  await sleep(120);
}
console.log(`\nمعرّفات فريدة: ${ids.size}`);

// ---- 2) المداخل واحدًا واحدًا (بتزامنٍ محدود وذاكرةٍ على القرص) ----
const list = [...ids.keys()];
let done = 0, failed = 0;
async function one(id) {
  const fp = path.join(CACHE, id + ".json");
  if (fs.existsSync(fp) && !isExpired(fileDay(fp))) { done++; return; } // ما جاوز ثلاثين يومًا يُعاد جلبه
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/search/get-public-entry/${id}`, { headers: UA });
      if (!res.ok) throw new Error(String(res.status));
      const o = await res.json();
      // نحفظ الحقول المصطلحية وحدها — لا senses (التعريفات)
      const slim = {
        id, lemma: o.lemma, lemmaType: o.lemmaType, lang: o.lemmaLanguage && o.lemmaLanguage.code,
        rel: (o.entryRelations || []).filter((r) => r.type === "TRANSLATION" && r.data)
          .map((r) => ({ lang: r.data.languageCode, lemma: r.data.nonDiacriticsLemma || r.data.lemma, id: r.relatedLexicalEntryId })),
        domains: ((o.senses || [])[0] || {}).domains || [],
      };
      fs.writeFileSync(fp, JSON.stringify(slim), "utf8");
      done++; return;
    } catch (e) { await sleep(600 * (attempt + 1)); }
  }
  failed++;
}
let cursor = 0;
async function worker() {
  while (cursor < list.length) {
    const id = list[cursor++];
    await one(id);
    if ((done + failed) % 50 === 0) process.stdout.write(`\rالمداخل: ${done} تمّ · ${failed} أخفق / ${list.length}   `);
    await sleep(80);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
console.log(`\nتمّ: ${done} | أخفق: ${failed}`);

// ---- 3) التجميع: أزواج (en → ar) والمعرّف للإسناد ----
const terms = [];
let oldest = null;
for (const id of list) {
  const fp = path.join(CACHE, id + ".json");
  if (!fs.existsSync(fp)) continue;
  const at = fileDay(fp);
  if (isExpired(at)) continue; // أخفق إعادة جلبه: لا يُستعمل ما جاوز المدة
  const o = JSON.parse(fs.readFileSync(fp, "utf8"));
  if (o.lang !== "ar") continue; // القائمة قد تحوي مداخل بغير العربية؛ نريد الرأس العربي
  const en = (o.rel || []).find((r) => r.lang === "eng");
  if (!en || !en.lemma) continue;
  if (!oldest || at < oldest) oldest = at;
  terms.push({ en: fixLemma(en.lemma), ar: fixLemma(o.lemma), id });
}
if (!terms.length) { console.error(`✗ لا أزواج صالحة (في المدة) في الذاكرة — لم يُكتب ${OUT}`); process.exit(1); }
const rec = { _meta: { key: LEX === AI_LEXICON_ID ? "ai-pairs" : "pairs-" + LEX, code: LEX === AI_LEXICON_ID ? "AI" : null, model: "pairs",
  lexicon: meta.name, lexiconId: LEX, publishers: (meta.authors || []).map((a) => a.name), sponsors: (meta.sponsors || []).map((s) => s.name),
  totalEntries: total, pairsEnAr: terms.length, ...(LIMITED ? { limited: LIMIT } : {}), fetched: oldest, url: `${BASE}/public-dict-information/${LEX}`, ...ATTRIBUTION,
  note: "مقابلاتٌ مصطلحية فقط (en وar ومعرّف المدخل؛ لا تعريفات ولا أمثلة) من الواجهة العامة للمنصة وقت البناء. غير متتبَّع؛ شروط سوار: لا احتفاظ فوق ثلاثين يومًا من fetched — ترفضه الأدوات بعدها ويحذفه siwar-dump.mjs --purge-expired" }, terms };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT + ".tmp", JSON.stringify(rec, null, 1), "utf8");
fs.renameSync(OUT + ".tmp", OUT); // كتابةٌ ثم إعادة تسمية: لا يرى قارئٌ متزامن ملفًّا نصف مكتوب
console.log(`أزواج (en→ar): ${terms.length} → ${OUT} (جُلبت ${oldest})`);
