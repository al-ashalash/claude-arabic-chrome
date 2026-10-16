// siwar-terms.mjs — المرحلة ٣: مقابلة المصطلحات المرشّحة بمعاجم «سوار» العامة (بحث الترجمات)، وقت البناء فقط.
// يأخذ المقابل المصطلحي وحده (اللِّمّة، ومعرّف المدخل والمعجم للإسناد) — لا التعريفات ولا الأمثلة.
// المطابقة: ترجمةٌ إنجليزية للمدخل تساوي المرشّح (أو جمعه) بعد التطبيع.
//   node siwar-terms.mjs <candidates.json> <out.json> [--allow-limited]
//
// ★ شروط سوار: لا احتفاظ ببيانات واجهاتها أكثر من ثلاثين يومًا، ويُشار إلى المعجم والمنصة والمجمع. فذاكرة البحث
// (glossary/_siwar-cache/search، غير متتبَّعة) يُعاد جلب ما جاوز منها المدة بتاريخ ملفه، وأزواج معجم البيانات
// والذكاء الاصطناعي (_lexicons/ai-pairs.json) تُرفض بعدها؛ و`node siwar-dump.mjs --purge-expired` يحذف الاثنين
// (siwar-lib.mjs). والناتج فيه مقابلات سوار: يُكتب في مجلدٍ غير متتبَّع (glossary/_terms/ مثلًا).
// وأزواجٌ من حصادٍ محدود (harvest-siwar.mjs --limit=N) تُرفض إلا بـ--allow-limited، للتجارب وحدها، ويُختم الناتج حينئذٍ بـaiLimited.
import fs from "node:fs";
import path from "node:path";
import { CACHE_DIR, loadAiPairs, isExpired, fileDay, today, assertIgnoredOut, retentionMeta } from "./siwar-lib.mjs";
const CACHE = path.join(CACHE_DIR, "search");
const [inF, outF] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ALLOW_LIMITED = process.argv.includes("--allow-limited");
if (!inF || !outF) { console.error("usage: node siwar-terms.mjs <candidates.json> <out.json> [--allow-limited]"); process.exit(2); }
assertIgnoredOut(outF, "siwar-terms"); // الناتج فيه مقابلات سوار: لا يُكتب إلا في موضعٍ يتجاهله git (قبل أي طلبٍ أو ذاكرة)
fs.mkdirSync(CACHE, { recursive: true });
const fetchedDays = []; // أيام الجلب لكل ما دخل الناتج (ذاكرةً أو طلبًا) — يُختم أقدمها ‎_meta.fetched‎
const cands = JSON.parse(fs.readFileSync(inF, "utf8"));
const UA = { "User-Agent": "claude-mutarjim/2.0 (open-source Arabic UI; term-equivalents only, build-time)", Accept: "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' -]+/g, " ").replace(/\s+/g, " ").trim();
function cacheFile(q) { return path.join(CACHE, Buffer.from(q).toString("base64url").slice(0, 120) + ".json"); }
async function search(q) {
  const f = cacheFile(q);
  if (fs.existsSync(f) && !isExpired(fileDay(f))) { fetchedDays.push(fileDay(f)); return JSON.parse(fs.readFileSync(f, "utf8")); } // الأقدم يُعاد جلبه
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch("https://siwar.ksaa.gov.sa/api/search/publicSearchByTranslations?query=" + encodeURIComponent(q), { headers: UA });
      if (r.ok) {
        const d = await r.json();
        // ما يُحفظ: المقابل وحده (لا تعريفات): المعرّفات واللِّمّة والترجمات الإنجليزية
        const slim = (d.entries || []).map((e) => ({
          id: e.lexicalEntryId, lexId: e.lexiconId, lex: e.lexiconName, lemma: e.lemma, plain: e.nonDiacriticsLemma,
          en: [...new Set((e.senses || []).flatMap((s) => (s.translations || []).filter((x) => /^en/i.test(x.language || x.languageCode || "")).map((x) => norm(x.word || x.value))))],
        }));
        fs.writeFileSync(f, JSON.stringify(slim));
        fetchedDays.push(today());
        return slim;
      }
      if (r.status === 429) await sleep(5000);
    } catch (e) {}
    await sleep(1500 * (t + 1));
  }
  return null;
}
// معجم البيانات والذكاء الاصطناعي محصودٌ كاملًا محليًّا (_lexicons/ai-pairs.json) — لا يظهر في بحث الترجمات العام
const AI = loadAiPairs("siwar-terms", { allowLimited: ALLOW_LIMITED }); // يخرج برسالةٍ إن غاب أو جاوز ثلاثين يومًا أو كان محدودًا بلا إذن
fetchedDays.push(AI._meta.fetched);
const aiIdx = new Map();
for (const t of AI.terms) {
  for (const v of [t.en, String(t.en || "").replace(/\s*\([^)]*\)\s*/g, " ")]) {
    const k = norm(v);
    if (!k) continue;
    if (!aiIdx.has(k)) aiIdx.set(k, []);
    aiIdx.get(k).push({ lex: AI._meta.lexicon, lexId: AI._meta.lexiconId, id: t.id, lemma: t.ar, plain: t.ar });
  }
}
const out = [];
let i = 0, done = 0;
async function worker() {
  while (i < cands.length) {
    const c = cands[i++];
    const want = new Set([norm(c.en)].concat(c.plural ? [norm(c.plural)] : []));
    const res = await search(c.en);
    const matches = (res || []).filter((e) => e.en.some((w) => want.has(w)))
      .map((e) => ({ lex: e.lex, lexId: e.lexId, id: e.id, lemma: e.lemma, plain: e.plain }));
    const ai = [...want].flatMap((w) => aiIdx.get(w) || []);
    out.push({ ...c, ai: ai.length ? ai : undefined, siwar: res === null ? null : matches });
    if (++done % 50 === 0) console.log(done + "/" + cands.length);
    await sleep(250);
  }
}
await Promise.all([worker(), worker(), worker()]);
out.sort((a, b) => b.n - a.n);
// ‎_meta.fetched‎ = أقدم جلبٍ في الناتج، فيحذفه siwar-dump.mjs --purge-expired بعد المدة (الناتج: { _meta, terms })
fs.writeFileSync(outF, JSON.stringify({ _meta: { tool: "siwar-terms", made: today(), ...retentionMeta(fetchedDays),
  ...(AI._meta.limited ? { aiLimited: AI._meta.limited } : {}) }, terms: out }, null, 1));
const hit = out.filter((x) => (x.siwar && x.siwar.length) || x.ai).length, fail = out.filter((x) => x.siwar === null).length;
const lexes = {}; for (const x of out) for (const m of (x.siwar || []).concat(x.ai || [])) lexes[m.lex] = (lexes[m.lex] || 0) + 1;
console.log(`مقابلة: ${hit}/${out.length} لها مطابقةٌ تامة في معجمٍ ما؛ تعذّر ${fail}`);
console.log(Object.entries(lexes).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + " " + v).join(" | "));
