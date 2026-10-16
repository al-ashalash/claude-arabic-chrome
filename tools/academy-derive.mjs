// academy-derive.mjs — عناوين التبويب والمركّبات المشتقّة للأكاديمية بعد ت3 (دراسة ر4 §4.4، ومراجعة ر4-أ في E2).
//   node web/code/toolchain/academy-derive.mjs [--harvest=<harvest-*.json>] [--out=<ملف>] [--dry-run]
// ★ (ت3، ٢٨ ربيع الآخر ١٤٤٨هـ) القاموس حرفيّ، وفي الأكاديمية نصوصٌ من عقدةٍ واحدة تجمع عنوانًا مترجمًا إلى غيره، فلا يطابقها
// مدخلٌ واحد ولا نمطٌ بلا E2 (التقاط عنوان، غير منفَّذ). فتُشتقّ لها هنا مدخلاتٌ حرفية من الترجمات المراجَعة نفسها، لكل مفتاحٍ في
// أحدث حصاد DOM للنطاق، **الكل أو لا شيء** (RULES §1: لا يُترجم عنوانٌ مختلطٌ جزئيًّا):
//   ١) عناوين التبويب «<جزء> · … · Claude Academy» و«Claude Academy · <شعار>»: كل جزءٍ من strings في ar-academy.json، أو يبقى
//      إن كان «Claude Academy» أو مُبقًى بقرار (keep-en.json و_keep-en.generated.json)؛ وعنوانٌ أجزاؤه كلها باقيةٌ لا يُكتب.
//   ٢) «Lesson N of M · <عنوان>» و«Quiz N of M · <عنوان>»: القالب المترجم من _vars-pairs-academy-t3.json بأرقامه، والعنوان
//      من strings.
//   ٣) «N lessons · M quiz/quizzes» (بطاقات الدورات): الجزءان من مدخلَي الجمع «%d lesson» و«%d quiz» في plurals بصيغة العدد
//      (Intl.PluralRules للعربية، ترتيب صيغ المحرّك نفسه).
// ولا يُشتقّ غيرها: ما تعذّر جزءٌ منه يبقى إنجليزيًّا ويُعدّ. والمدخلات من مجلد عمل النطاق والقاموس، والناتج دفعة [{en, ar}] في
// _ar_batches/ (خارج git؛ مكانها مستودع البيانات) تُدمج بـmerge-batches. يُعاد تشغيله بعد كل حصاد. يطبع الأعداد وحدها.
// ★ (مراجعة دمج ت3) مدخلٌ في القاموس بقيمةٍ غير المشتقّة يُعدّ حرفيًّا مراجَعًا فيغلب؛ فإن تغيّرت ترجمة عنوانٍ بعد دمجٍ سابق بقي مشتقّه القديم.
// فإعادة الدمج تبدأ من قاموس HEAD (والترتيب كله: الحرفيات ← هذه الأداة ← دمج المشتقّ ← gen-patterns أخيرًا ← build).
import fs from "node:fs";
import path from "node:path";
import { workDir, batchDir, dictFile, latestHarvest } from "./domain-arg.mjs";

const D = "academy";
const argv = process.argv.slice(2);
const opt = (n) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ""; };
const DRY = argv.includes("--dry-run");
const SEP = " · ";
const BRAND = "Claude Academy";

const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const harvestFile = opt("harvest") || latestHarvest(D);
if (!harvestFile || !fs.existsSync(harvestFile)) { console.error("! لا حصاد DOM للأكاديمية"); process.exit(2); }
const keys = (readJson(harvestFile).keys || []).map((r) => r.key);
const dict = readJson(dictFile(D));
const S = dict.strings || {};
const has = (k) => Object.prototype.hasOwnProperty.call(S, k);

// المُبقى بقرار: الملف المتتبَّع ثم المولَّد (كما يقرؤهما completeness.mjs)
const kept = new Set();
for (const name of ["keep-en.json", "_keep-en.generated.json"]) {
  const f = path.join(workDir(D), name);
  if (fs.existsSync(f)) for (const k of readJson(f).keep || []) kept.add(k.en);
}

// القالبان المترجمان (ت3، الجزء F)
const pairsFile = path.join(workDir(D), "_vars-pairs-academy-t3.json");
const pairs = fs.existsSync(pairsFile) ? readJson(pairsFile) : [];
const tpl = (en) => { const p = pairs.find((x) => x.en === en); return p && typeof p.ar === "string" && p.ar.trim() ? p.ar : null; };
const LESSON = tpl("Lesson {number} of {count}");
const QUIZ = tpl("Quiz {number} of {count}");
// الجمع: صيغ المحرّك الست بترتيبه (engine.js PLURAL_FORMS.ar) وفئات CLDR من Intl.PluralRules
const AR_ORDER = ["zero", "one", "two", "few", "many", "other"];
const PR = new Intl.PluralRules("ar");
const P = dict.plurals || {};
function counted(key, num) {
  const spec = P[key];
  if (!spec || !Array.isArray(spec.forms) || spec.forms.length !== 6) return null;
  const f = spec.forms[AR_ORDER.indexOf(PR.select(num))];
  return typeof f === "string" && f ? f.replace("%d", String(num)) : null;
}
const fill = (t, n, m) => (t.includes("{number}") && t.includes("{count}") ? t.replace("{number}", n).replace("{count}", m) : null);

const out = [];
const n = { tab: 0, tabDone: 0, tabKept: 0, tabMissing: 0, lesson: 0, lessonDone: 0, quiz: 0, quizDone: 0, count: 0, countDone: 0, already: 0 };
const missingParts = new Map();
// الجزء يُطلب بلا بياضٍ في طرفيه (عنوانٌ في الموقع بمسافتين قبل الفاصل)، ويُعاد بياضه حول العربية كما كان
function part(p) {
  const t = p.trim(), lead = p.slice(0, p.length - p.trimStart().length), trail = p.slice(p.trimEnd().length);
  if (t === BRAND) return { ar: p, tr: false };
  if (has(t)) return { ar: lead + S[t] + trail, tr: S[t] !== t };
  if (kept.has(t)) return { ar: p, tr: false };
  return null;
}
// مدخلٌ حرفيٌّ مراجَعٌ بقيمةٍ غير المشتقّة يغلب (لا يُكتب فوقه)؛ والمشتقّ الموجود بقيمته نفسها يُكتب في الدفعة من جديد، فتبقى
// الدفعة كاملةً في كل تشغيل (مصدر الحقيقة لقاموسٍ يُعاد بناؤه من الدفعات)
function emit(k, ar) {
  if (has(k) && S[k] !== ar) { n.already++; return false; }
  out.push({ en: k, ar }); return true;
}
for (const k of keys) {
  // ٢) «Lesson N of M · <عنوان>» / «Quiz N of M · <عنوان>»
  let m = /^(Lesson|Quiz) (\d+) of (\d+) · (.+)$/.exec(k);
  if (m) {
    const isL = m[1] === "Lesson";
    isL ? n.lesson++ : n.quiz++;
    const head = fill(isL ? LESSON || "" : QUIZ || "", m[2], m[3]);
    const t = part(m[4]);
    if (head && t) { if (emit(k, head + SEP + t.ar)) isL ? n.lessonDone++ : n.quizDone++; }
    else if (!t) missingParts.set(m[4], (missingParts.get(m[4]) || 0) + 1);
    continue;
  }
  // ٣) «N lessons · M quiz/quizzes»
  m = /^(\d+) lessons? · (\d+) quiz(?:zes)?$/.exec(k);
  if (m) {
    n.count++;
    const a = counted("%d lesson", +m[1]), b = counted("%d quiz", +m[2]);
    if (a && b && emit(k, a + SEP + b)) n.countDone++;
    continue;
  }
  // ١) عناوين التبويب
  if (!(k.endsWith(SEP + BRAND) || k.startsWith(BRAND + SEP))) continue;
  n.tab++;
  const parts = k.split(SEP).map((p) => [p, part(p)]);
  const miss = parts.filter(([, r]) => !r);
  if (miss.length) { n.tabMissing++; for (const [p] of miss) missingParts.set(p, (missingParts.get(p) || 0) + 1); continue; }
  if (!parts.some(([, r]) => r.tr)) { n.tabKept++; continue; }
  if (emit(k, parts.map(([, r]) => r.ar).join(SEP))) n.tabDone++;
}

console.log(`academy-derive — ${path.basename(harvestFile)}: ${keys.length} مفتاحًا (${n.already} يغلبها مدخلٌ حرفيٌّ مراجَع)`);
console.log(`  عناوين التبويب ${n.tab}: مشتقّ ${n.tabDone} · أجزاؤه كلها باقية ${n.tabKept} · بجزءٍ غير مترجم ${n.tabMissing}`);
console.log(`  «Lesson N of M · …» ${n.lesson}: مشتقّ ${n.lessonDone}${LESSON ? "" : " (القالب غير مترجم)"} · «Quiz N of M · …» ${n.quiz}: مشتقّ ${n.quizDone}${QUIZ ? "" : " (القالب غير مترجم)"}`);
console.log(`  «N lessons · M quiz» ${n.count}: مشتقّ ${n.countDone}`);
console.log(`  أجزاءٌ غير مترجمة: ${missingParts.size} (في ${[...missingParts.values()].reduce((a, b) => a + b, 0)} موضعًا)`);
if (DRY) process.exit(0);
const stamp = path.basename(harvestFile).replace(/^harvest-|\.json$/g, "");
const outFile = opt("out") || path.join(batchDir(D), `academy-derived-${stamp}.json`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + "\n", "utf8");
console.log(`✓ ${out.length} مدخلًا ← ${path.relative(process.cwd(), outFile)}`);
