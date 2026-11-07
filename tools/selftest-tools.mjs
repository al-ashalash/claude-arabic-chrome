// selftest-tools.mjs — ★ (ر12-ب، ٥ جمادى الأولى ١٤٤٨هـ) الفحص الذاتي لأدوات السلسلة: تحكم على رمز القالب %T<n> كما يحكم المحرّك.
//
// لماذا: ر12 جعل الالتقاط %T مفتاحًا حرفيًّا في قاموس الموقع، وجعل الأدوات كلها تحكم عليه بمُحلِّلات المحرّك (cml-shared: fillPattern
// وpatternApply وtoolRes وrawCaps). ووجد مراجع ر12 أن لا فحصَ مُلتزَمًا يحرس ذلك في الأدوات: طفرات T1–T10 كان يكشفها حزامٌ خارج المستودع،
// وrawCaps بلا فحص. فهذا الحزام نفسه، مُلتزَمًا، بأمثلةٍ اصطناعية وحدها (مفاتيح «Zq…» مخترعة، لا نصَّ من المواقع).
//
// كيف: يشغّل الأدوات الحقيقية لهذه الشجرة على نسخةٍ في مجلدٍ مؤقت (الأدوات والإضافة وlanguages.json وملفات الإبقاء المتتبَّعة) قواميسُها
// قاموسان صغيران اصطناعيان للأكاديمية والتطبيق فيهما أنماط %T، ثم يحذفه. ولا يمسّ المستودع ولا يتصل بشبكة:
//   build.mjs (حارس التظليل shadowGuard)، وcross-check-patterns، وlint-dict، وcompleteness (طبقة النصوص بلا شبكة)، وgen-patterns (الحقل "t")،
//   وdiff-engine (فهرسٌ اصطناعي)، وcatalogue-coverage (أداة التطوير في project/tools/app-refresh — بكتالوجٍ اصطناعي في مجلد عملٍ مؤقت؛ وفي
//   بنيةٍ بلا هذه الأداة يُذكر الفحص متروكًا ولا يُعدّ)، وrawCaps (مباشرةً، ثم عبر فحص الخلط في completeness لحزم التطبيق).
//
//   node web/code/toolchain/selftest-tools.mjs     الخروج 0 = كل توقّعٍ صادق، والسطر الأخير «TOOLS: N/N»
// وهو بوابةٌ في RULES §8 (سطر «Tools self-test»)، ومعه حدٌّ أدنى لعدد فحوصه (MIN أدناه) فلا يسقط فحصٌ صامتًا.
import fs from "node:fs";
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ROOT, EXT, DICTS, GLOSSARY, LANGUAGES_JSON } from "./paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// ★ حدٌّ أدنى لعدد الفحوص المعدودة: فحصٌ يسقط من الحزام صامتًا يُخفقه. وهو عددها بلا فحص أداة التطوير (يُترك في بنيةٍ بلا تلك الأداة
// ويُذكر متروكًا)؛ ففي مستودع التطوير 18 فحصًا، وبوابة RULES §8 تشترطها 18/18
// ★ (ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ) +8: الإبقاء بنطاق الصفحة في merge-blocks والبناء، وحصادات النطاق كلها في completeness (الكتل وDOM)، وصفُّ اللافتات
// (labelRow) فيها، وسمات ما بعد النقرة (extraItems) — فالحدّ 25 والعدد 26 في مستودع التطوير (26/26). ★ (مراجعة ر13-ج) +1: مدخلٌ ذو keepOn بلا ترجمةٍ
// علامةٌ في صفحته وحدها — فالحدّ 26 والعدد 27 (27/27)
// ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) +8: com-routes.mjs (الهبوط، والقائمة، وإعادة التشغيل، والعتبة)، والبناء (الحقن، والكتلة المختلّة)، وبوابة الحزمة
// (النطاق المشحون بلا قاموس: الحكم وسطره) — فالحدّ 34 والعدد 35 في مستودع التطوير (35/35)
// ★ (مراجعة ر15) +3: بوابة com-routes عند حدّيها، ومحلِّلاتها (hreflang والخريطة وعدد اللغات)، ومدخلات عتبةٍ أدنى لا تكتب بعتبةٍ أعلى — فالحدّ 37
// والعدد 38 في مستودع التطوير (38/38)
// ★ (ر16-ب، ٦ جمادى الأولى ١٤٤٨هـ) +2: دمج خطّ أساس فحص الاتجاه بالنطاق (rtl-baseline.mjs) ورفضه — فالحدّ 39 والعدد 40 (40/40)
// ★ (ر16-ج، ٦ جمادى الأولى ١٤٤٨هـ) +5: فحص الاتجاه بلا كروم ولا شبكة — حكم الانقلاب على حدّ التسامح (rtl-geom.mjs)، والنسخة المشغَّلة تُبنى وتُتحقَّق
// وتُحذف، ونسخةٌ لا تصير مشغَّلة تُرفض، ورفض --write-baseline بعد تشغيلٍ جزئي أو صفحةٍ أخفقت، وخطة OPT_IN — فالحدّ 44 والعدد 45 (45/45)
// ★ (ر17، ٨ جمادى الأولى ١٤٤٨هـ) +12: com-harvest.mjs بلا شبكةٍ ولا كروم — القائمة وعائلاتها وترتيب CM وعيّنة الهيكل، وبوابتها عند حدّها، والمصنِّف
// بالموضع (LCS) وقاعدة «إحدى النسختين» وصفحة النسخة الواحدة والجمع عبر الصفحات، والسمات بالعدد، واختيار النسختين وlang وRetry-After وميزانية الإخفاق، وقوالب
// الواجهة وأنماط السوق والمرجع، والتقسيم (التجاور والمشتركة و«ذات صلة» والمجموعات والمراحل) وحال البصمة، والأداة كلها على حصادٍ اصطناعي وجزءٌ يقبله
// validate-batch، وبوابة الشمول لـcom بحصادين وقائمة إبقاء؛ وسكربت مرحلة المتون بـdomain=com (من أدوات التطوير: يُترك في بنيةٍ بلا cloud/) — فالحدّ 55
// والعدد 57 في مستودع التطوير (57/57)
// ★ (المراجعة المستقلة لـر17، ٨ جمادى الأولى ١٤٤٨هـ) +2: ما نجا من طفرات المراجع (قبول النسخة والإعادة وحكم الصفحة دوالَّ خالصة، والالتباس و«إحدى النسختين»،
// والمرحلة فوق الساعتين، و«ذات صلة» بالحجم، وبوابة أول تشغيل، ومدخلات CM1 للسوق والعناوين والقوالب التي لم تصر أنماطًا، و«symbols» في قائمة الإبقاء) — فالحدّ 57
// والعدد 59 في مستودع التطوير (59/59)
// ★ (ر18، ٨ جمادى الأولى ١٤٤٨هـ) +2: كتل السوق ذات الشهر والسنة أو العدد نمطٌ لـCM1 لا كتلة متن (rowItems وblockPatterns خالصتين عند حدّهما، ثم ui وchunk
// بلا شبكة: الكتل في قائمة الإبقاء بسبب ui-cm1-pattern، ونمط {date} بملاحظة RULES §2، ولافتتها بندٌ حرفي)؛ و+1: النسخة التي خُدمت غير مترجمة تُترك، وعنوان
// الموصِّل الذي تبقيه الشركة خارج نمط العنوان؛ و+1: فرع box-not-mirrored في فحص الاتجاه بحكم الإشارة على حدّ التسامح (rtl-geom sideNotMirrored)
// — فالحدّ 61 والعدد 63 في مستودع التطوير (63/63)
// ★ (المراجعة المستقلة لـر18، ٨ جمادى الأولى ١٤٤٨هـ) +1: ما نجا من طفرات المراجع في أنماط السوق (كتلةٌ تبقيها الشركة لا تصير نمطًا، وعتبة الصفحات بالصفحات
// لا بالكتل، وبند الرابط لا يصير نمطًا، وبند الرمز ليس بندًا حرفيًّا) — فالحدّ 62 والعدد 64 في مستودع التطوير (64/64)
// ★ (ر24-ب1، ١٢ جمادى الأولى ١٤٤٨هـ) +1: حكم الخروج عن عرض الصفحة «في الراحة» في فحص الاتجاه (rtl-geom insideAtRest) — فالحدّ 63 والعدد 65 في مستودع
// التطوير (65/65)
// ★ (ر24-ب2، ١٢ جمادى الأولى ١٤٤٨هـ) +3: ترتيب CSS المتداخل (CX-006)، واستثناء الجزر للقيم الفيزيائية المقلوبة (CX-007)، وحكم أمانة الجزر في فحص الاتجاه
// (rtl-geom islandDrift) وتوصيله — فالحدّ 66 والعدد 68 في مستودع التطوير (68/68)
// ★ (ر20-أ، ١٢ جمادى الأولى ١٤٤٨هـ) +1: صنفُ المسار المشحون قبل CN1 (لوحة المطوّرين في مدخل الوثائق) ترفضه بوابة الحزمة باسمه بالسببين، والقادم لا — فالحدّ 70
// والعدد 72 في مستودع التطوير (72/72)
// ★ (ر24-و، ١٢ جمادى الأولى ١٤٤٨هـ) +2: جزر الورقة النقطية في خطة فحص الاتجاه (pointIslandsOf سلوكًا: ورقةٌ اصطناعية والإضافة الحقيقية)، وحاجز الإصدار النهائي
// (verify-package --final بالاسم، وحكمه الخالص في الحالات الخمس، والمسار الحقيقي لـmake-release يطلبه)؛ و+1: علامات الإبقاء في completeness بالصفحة كما
// يعدّها حارس المتن (keepOn في صفحته وحدها، والقائمة تُقرأ مع هيكل قاموس الكتل الفارغ) — فالحدّ 73 والعدد 76 في مستودع التطوير (76/76)
// ★ (ر20-ج، ١٢ جمادى الأولى ١٤٤٨هـ) +1: lint-dict وcross-check-patterns يقرآن قاموس صنف المسار ويسمّيانه؛ وفحص الصنف المشحون في verify-package بقاعدته
// الجديدة (بلا قراءةٍ لنصّ المحرّك، وبمحدِّدات محتوى المستخدم) — فالحدّ 73 والعدد 77 في مستودع التطوير (77/77)
// ★ (DX0-0، ١٩ جمادى الأولى ١٤٤٨هـ) +6: خريطة الانجراف drift-map.mjs (الفرق والتشابه، والأصناف على حدودها، والصفحة نفسها أولًا، والخريطة، والأجزاء،
// والأداة كلها ورفض الكتابة فوق أجزاءٍ قائمة) — فالحدّ 79 والعدد 92 في مستودع التطوير (92/92)
// ★ (مراجعة DX0-0) +1: مصادر خريطة الانجراف (الحصاد الجديد داخل مجلد القديم، ودفعات _draft، وتقدُّم القاموس على الدفعة) — فالحدّ 80 والعدد 93 (93/93)
// ★ (ر29-ط، ١٩ جمادى الأولى ١٤٤٨هـ) +4: أداة اللقطة ترفض صفحة التحقّق (403 و503 والنموذج وحده) ولا تكتب شيئًا، وتلقط الصفحة العادية — بكروم وخادمٍ محلي،
// وبلا كروم تُذكر متروكةً ولا تُعدّ؛ فالحدّ 80 كما هو، والعدد 97 في مستودع التطوير (97/97)
// ★ (مراجعة ر29-ط) +2: وصفحة خطأٍ HTTP ليست تحقّقًا (حجب Cloudflare «Access denied» بالحالة 403، وصفحة 404) تُرفض كذلك ولا يُكتب شيء — فالعدد 99 (99/99)
// ★ (ر29-ي، ١٩ جمادى الأولى ١٤٤٨هـ) +1: أداة تغطية الكتالوج تعدّ الطويل في النطاق، وتحرس النمط بحارس الالتقاط، وتقرأ ‎--cat‎ — فالعدد 100 (100/100)
// ★ (ر29-ك) +1: معرّف الأحرف الستة (حزم اليوم) معرّفٌ في عمود المنطقة لأداة تغطية الكتالوج كمعرّف العشرة — فالعدد 101 (101/101)
// ★ (ر29-س، ٢٠ جمادى الأولى ١٤٤٨هـ) +6: validate-batch --icu-ar يقارن وسوم رسالة ICU بعروضها (الإنجليزية بقواعد en-US والعربية بقواعد ar عند القيم نفسها،
// وبترتيبها) لا بالنصّ الخام — شكل n02 يمرّ، والقسم الناقص والزائد يُرفضان بقيمتهما، ووسم other وحدها و=N من الجانبين، والاختيار، وما بقي على الخام
// كما كان — فالعدد 107 (107/107)
// ★ (مراجعة ر29-س) +1: الاختيار داخل فرع اختيارٍ يُعرض بتراكيب الفروع، والجمع بـoffset يُعرض عند القيم مزاحةً به، والوسم بلا بياضه — فالعدد 108 (108/108)
// ★ (ت10-هـ1، ٢٠ جمادى الأولى ١٤٤٨هـ) +7: أداة دمج ICU (merge-icu.mjs) — أرقام كل قسمٍ عربي، ومدخل الجمع وحرفيُّ الفرع بلا عدد، وأنماط الأقسام
// (والمتغيّر الملاصق للعدد، وجمعان، وجمعٌ في اختيار، والأشكال المحمولة a وc)، والاختيار المتداخل والمضاف في العربية (e) والوسوم، و%T لمفردات الموقع وحدها
// (b) والوحدة (d)، والتعارضات؛ وقتلت طفراتها الثماني — فالعدد 115 (115/115)
// ★ (ت10-هـ1، ٢٠ جمادى الأولى ١٤٤٨هـ) +1: بوابة اللفظ الإنجليزي تحكم على مخرَج الحرفيّ وتصحيح المستخدم والجمع، بإبقاءٍ متعمَّدٍ ضيّق (نادرٌ في الفهرس ويُبقيه نصٌّ
// مراجَعٌ آخر)، والاسم والرمز بحدودهما لا يُعدّان؛ وفحص ت10-0 بقاموسه مع نصٍّ مراجَعٍ ثانٍ لكلمة الرمز ومدخلٍ عربيٍّ كله للإصلاح — فالعدد 116 مع ما قبله (116/116)
// ★ (ر24-د2، ٢٠ جمادى الأولى ١٤٤٨هـ) +4: بوابة الجلب (المخالفات الخمس وشجرة اليوم)، وحكم روابط الفحصين scanUrlOk، ومفتاح ‎"__proto__"‎ في applyTermEdits
// ★ (ر28-ب، ٢٠ جمادى الأولى ١٤٤٨هـ — السؤال 2 على افتراضه) بلا زيادة: مانيفست الحزمة يحجب مدخلي النطاقين القادمين، فاشتدّ فحصان قائمان — حاجز
// الإصدار النهائي يحكم على مانيفستٍ بمدخليهما مبنيٍّ بمولّد البناء (manifest-entry.mjs) ويرفض نطاقًا مشحونًا بلا مدخل، والنسخة المشغَّلة لفحص الاتجاه
// تضيف مدخل claude.com إلى مانيفستها بأوراقه الثلاث
// ★ (ت14-هـ0ب، ٢٦ جمادى الأولى ١٤٤٨هـ — القرار 142) +8: طريق الدمج — gen-patterns بالفقرات و‎{x, number}‎ والتاريخ (‎"m"‎ و‎{x, date}‎ بـ‎%M‎) و‎"override"‎
// ورفض ICU الجمع، وmerge-batches بالفقرات ومفتاح ICU وفقرات القالب، والمدخل اليدوي الآمن manual-patterns.mjs بحرّاسه، والأعداد بفاصلة الآلاف في
// partial-english، وأداة تغطية الكتالوج بأسطر النصّ — فالعدد 130 (130/130)
const MIN = 80;
// أداة تغطية الكتالوج من أدوات التطوير (لا تُنشر): بجوار web/ في مستودع التطوير
const CATALOGUE_TOOL = path.join(ROOT, "..", "project", "tools", "app-refresh", "catalogue-coverage.mjs");

const BOX = fs.mkdtempSync(path.join(os.tmpdir(), "cml-selftest-tools-"));
process.on("exit", () => { try { fs.rmSync(BOX, { recursive: true, force: true }); } catch {} });
// النسخة ببنية الشجرة نفسها (مسارات paths.mjs نسبةً إلى ROOT)، فتجد كلُّ أداةٍ فيها ما تجده هنا — في مستودع التطوير وفي بنية النشر
const inBox = (p) => path.join(BOX, path.relative(ROOT, p));
const cp = (p, filter) => { if (fs.existsSync(p)) fs.cpSync(p, inBox(p), { recursive: true, filter }); };
// الإضافة بلا مولَّداتها (قطع المتون والقواميس المبنيّة: يعيد البناء كتابتها)، والقواميس لا تُنسخ: لا نصَّ من المواقع في النسخة، والبناء يعدّ
// القاموس الغائب فارغًا — فيُبنى في ثوانٍ، ولا يتعلّق الحزام بقواميس اليوم
cp(HERE); cp(LANGUAGES_JSON);
cp(EXT, (src) => !/^(bodies|dictionary\.js|dict-[a-z]+\.js)(?:[\\/]|$)/.test(path.relative(EXT, src)));
fs.mkdirSync(inBox(DICTS), { recursive: true });
for (const rel of ["keep-en.json", "academy/keep-en.json", "academy/scope-exempt.json"]) cp(path.join(GLOSSARY, rel));
const T = (name) => path.join(inBox(HERE), name);
const G = inBox(GLOSSARY);
fs.mkdirSync(path.join(G, "academy", "_harvest"), { recursive: true });
const run = (args, cwd = BOX) => {
  const r = spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 600000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
};
const writeJson = (file, obj) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8"); };
const results = [];
const expect = (name, ok, detail) => { results.push({ name, ok: !!ok, detail: ok ? undefined : String(detail).slice(0, 700) }); };
const skipped = [];

// قاموسٌ اصطناعي بصيغة القواميس
const dictOf = (domain, strings, patterns) => ({ _meta: { language: "ar", direction: "rtl", domain, count: Object.keys(strings).length }, strings, plurals: {}, patterns });
const ACAD = path.join(inBox(DICTS), "ar-academy.json"), APP = path.join(inBox(DICTS), "ar.json");
const STR = { "Zq Lesson": "درسٌ تجريبي", "Zq Other": "آخرُ تجريبي", "zq panel": "لوحةٌ تجريبية" };
const PAT_NEXT = { en: "Zq next: {title}", re: "^Zq next: (.+)$", ar: "التالي التجريبي: %T1" };
// قاموس تطبيقٍ اصطناعي (للبناء، ثم للأدوات الثلاث في (٥) و(٦)): نمطٌ بـ%T التقاطُه «zq panel» (مفتاح) أو «Zeddicus» (ليس مفتاحًا)
writeJson(APP, dictOf("app", { "Zq Settings": "إعداداتٌ تجريبية", "zq panel": "لوحةٌ تجريبية", "Zq Recents": "الأحدث التجريبي" },
  [{ en: "Zqt open {page}", re: "^Zqt open (.+)$", ar: "فتح %T1" }]));
const harvest = (keys) => fs.writeFileSync(path.join(G, "academy", "_harvest", "harvest-20990101T0000.json"),
  JSON.stringify({ domain: "academy", keys: keys.map((key) => ({ key, kinds: ["text"], count: 1, zone: "ui", pages: ["https://academy.claude.com/zq"] })) }), "utf8");

// (١) حارس التظليل في البناء وcross-check: حرفيٌّ التقاطُه بـ%T ليس مفتاحًا لا يُعدّ مظلَّلًا (المحرّك لا يعرّبه بالنمط)، والتقاطُه مفتاحٌ يُعدّ
writeJson(ACAD, dictOf("academy", Object.assign({}, STR, { "Zq next: Zeddicus": "التالي التجريبي: زيديكس" }), [PAT_NEXT]));
let b = run([T("build.mjs")]);
expect("البناء: حرفيٌّ التقاطُه بـ%T ليس مفتاحًا لا يُعدّ مظلَّلًا (الخروج 0)", b.code === 0, b.out.split("\n").filter((l) => /shadow|!|✗/.test(l)).join(" | "));
let x = run([T("cross-check-patterns.mjs"), "--domain=academy"]);
expect("cross-check: والحرفيُّ نفسه لا يُعدّ (التظليل 0)", /مفاتيح يظللها نمط: 0 /.test(x.out) && x.code === 0, x.out);
writeJson(ACAD, dictOf("academy", Object.assign({}, STR, { "Zq next: Zq Lesson": "التالي التجريبي: درسٌ تجريبي" }), [PAT_NEXT]));
b = run([T("build.mjs")]);
expect("البناء: حرفيٌّ يعرّبه نمط %T (التقاطُه مفتاح) مظلَّلٌ (الخروج 1 ويسمّيه)", b.code === 1 && /Zq next: Zq Lesson/.test(b.out), b.out.slice(-500));
x = run([T("cross-check-patterns.mjs"), "--domain=academy"]);
expect("cross-check: ويُعدّ (التظليل 1)", /مفاتيح يظللها نمط: 1 /.test(x.out) && x.code === 1, x.out);
// الفائز الخاطئ مع نمط %T يفشل التقاطُه: نمط %T (أطول ثابتًا) لا يطابق ما التقاطُه ليس مفتاحًا فيفوز التالي — تعدّدٌ واحد من اثنين، ولا فائز خاطئ
writeJson(ACAD, dictOf("academy", STR, [{ en: "Zq next: lesson {title}", re: "^Zq next: lesson (.+)$", ar: "التالي التجريبي: درس %T1" },
  { en: "Zq next: {x}", re: "^Zq next: (.+)$", ar: "التالي التجريبي: $1", b: 1 }]));
harvest(["Zq next: lesson Zq Lesson", "Zq next: lesson Zeddicus"]);
x = run([T("cross-check-patterns.mjs"), "--domain=academy"]);
expect("cross-check: التعدّد يُعدّ حيث ينطبق نمط %T وحده (1 من 2)، والفائز الخاطئ 0", /نصوص يغطيها أكثر من نمط: 1 من 2/.test(x.out) && /الأخصّ: 0 /.test(x.out), x.out);

// (٢) lint-dict: مرجع %T بلا مجموعته يُخفق، والقوس المهروب ليس مجموعة، والصحيح يمرّ ويُعدّ
writeJson(ACAD, dictOf("academy", STR, [{ en: "Zq next: {title}", re: "^Zq next: (.+)$", ar: "التالي التجريبي: %T2" }]));
let l = run([T("lint-dict.mjs"), "--domain=academy"]);
expect("lint: %T2 ومجموعةٌ واحدة يُخفق", l.code === 1 && /%T2 بلا مجموعة/.test(l.out), l.out);
writeJson(ACAD, dictOf("academy", STR, [{ en: "Zq next: \\(x\\) {title}", re: "^Zq next: \\(x\\) (.+)$", ar: "التالي التجريبي: %T2" }]));
l = run([T("lint-dict.mjs"), "--domain=academy"]);
expect("lint: القوس المهروب ليس مجموعة (العدّ دقيق) فـ%T2 يُخفق", l.code === 1 && /%T2 بلا مجموعة/.test(l.out), l.out);
writeJson(ACAD, dictOf("academy", STR, [PAT_NEXT]));
l = run([T("lint-dict.mjs"), "--domain=academy"]);
expect("lint: %T الصحيح يمرّ ويُعدّ", l.code === 0 && /منها 1 بـ%T/.test(l.out), l.out);

// (٣) completeness (طبقة النصوص بلا شبكة): «Zq next: Zq Lesson» يغطّيه نمط %T، و«Zq next: Zeddicus» باقٍ (المحرّك لا يعرّبه)
harvest(["Zq next: Zq Lesson", "Zq next: Zeddicus"]);
const cj = path.join(BOX, "c-academy.json");
let c = run([T("completeness.mjs"), "--domain=academy", "--offline", "--json=" + cj]);
let rep = null; try { rep = JSON.parse(fs.readFileSync(cj, "utf8")); } catch {}
const inv = rep && rep.domains && rep.domains.academy && rep.domains.academy.text && (rep.domains.academy.text.inventories || [])[0];
expect("completeness: %T يغطّي التقاطًا هو مفتاح ويترك ما ليس مفتاحًا باقيًا (نمطٌ 1، وباقٍ 1)",
  inv && inv.by && inv.by.pattern === 1 && inv.missing === 1, JSON.stringify(inv) + " " + c.out.slice(-300));

// (٤) gen-patterns: زوجٌ فيه "t" يولّد %T؛ وقالبٌ متغيّراته كلها %T محفوفٌ بمتغيّرين يُقبل؛ والمختلط لا؛ و%T1 خامٌ في عربية زوجٍ رمزُ قالبٍ يُرفض
writeJson(ACAD, dictOf("academy", STR, []));
const pairs = path.join(BOX, "pairs.json");
fs.writeFileSync(pairs, JSON.stringify([
  { en: "Zq next: {title}", ar: "التالي التجريبي: {title}", t: ["title"] },
  { en: "{first} zq and {second}", ar: "{first} و{second} التجريبيان", t: ["first", "second"] },
  { en: "{title} zq by {name}", ar: "{title} من {name} تجريبيًّا", t: ["title"] },
  { en: "Zq open {page}", ar: "فتح %T1 تجريبيًّا" }]), "utf8");
let g = run([T("gen-patterns.mjs"), "--domain=academy", "--in=" + pairs]);
let gd = { patterns: [] }; try { gd = JSON.parse(fs.readFileSync(ACAD, "utf8")); } catch {}
const byEn = new Map((gd.patterns || []).map((p) => [p.en, p]));
expect("gen-patterns: «Zq next: {title}» بـt ⇐ «التالي التجريبي: %T1»", byEn.get("Zq next: {title}") && byEn.get("Zq next: {title}").ar === "التالي التجريبي: %T1",
  JSON.stringify(gd.patterns) + g.out.slice(-300));
expect("gen-patterns: قالبٌ كلُّه %T محفوفٌ بمتغيّرين يُقبل ⇐ «%T1 و%T2 التجريبيان»",
  byEn.get("{first} zq and {second}") && byEn.get("{first} zq and {second}").ar === "%T1 و%T2 التجريبيان", JSON.stringify(gd.patterns));
expect("gen-patterns: المختلط (متغيّرٌ حرٌّ في طرف) يُرفض، و%T1 خامٌ في عربية زوجٍ رمزُ قالبٍ يُرفض",
  !byEn.has("{title} zq by {name}") && !byEn.has("Zq open {page}"), JSON.stringify(gd.patterns));

// (٥) catalogue-coverage — أداة التطوير وحدها، بكتالوجٍ اصطناعي في مجلد عملٍ تحت glossary (كما في CLOUD-RUNBOOK E-1)
if (fs.existsSync(CATALOGUE_TOOL)) {
  const RUN = path.join(G, "_catalogue-run");
  fs.mkdirSync(RUN, { recursive: true });
  fs.copyFileSync(CATALOGUE_TOOL, path.join(RUN, "catalogue-coverage.mjs"));
  fs.writeFileSync(path.join(RUN, "en-US.json"), JSON.stringify({ a: "Zqt open zq panel", b: "Zqt open Zeddicus", c: "Zq Recents" }), "utf8");
  const k = run([path.join(RUN, "catalogue-coverage.mjs"), "--dict=" + APP, "--json=" + path.join(RUN, "s.json")], RUN);
  let ks = null; try { ks = JSON.parse(fs.readFileSync(path.join(RUN, "s.json"), "utf8")); } catch {}
  const kstr = JSON.stringify(ks || {}) + " " + k.out.slice(-500);
  expect("catalogue-coverage: التقاط %T الذي هو مفتاحٌ نمط، وما ليس مفتاحًا غير مغطّى", /"pattern":1/.test(kstr) && /"literal":1/.test(kstr) && !/"pattern":2/.test(kstr), kstr);
  fs.rmSync(RUN, { recursive: true, force: true });
  // ★ (ر29-ي، توجيه المالك: لا سقف طولٍ يُبقي نصَّ موقعٍ بالإنجليزية) كل قيمةٍ بسيطة في النطاق مهما طالت — كان ما فوق TEXT_MAX يُخرج من النسبة
  // ويُسمّى «over-TEXT_MAX» فلا ترى البوابة الطويل غير المترجَم —، والنمطُ القصير العامّ لا يُحسب لطويلٍ إلا بحارس الالتقاط كالمحرّك، و‎--cat‎
  // يقرأ كتالوجًا في مكانه بصيغة الزحف ({ids}). قاموسٌ وكتالوجٌ اصطناعيان (مفاتيح «Zq…»)
  const RUN2 = path.join(G, "_catalogue-run-long");
  fs.mkdirSync(RUN2, { recursive: true });
  fs.copyFileSync(CATALOGUE_TOOL, path.join(RUN2, "catalogue-coverage.mjs"));
  const longU = "Zqu long untranslated " + "alpha ".repeat(70).trim(), longT = "Zqt long translated " + "bravo ".repeat(70).trim();
  const longP = "Zqp " + "charlie ".repeat(60).trim() + " zqend", shortP = "Zqp short zqend";
  fs.writeFileSync(path.join(RUN2, "ar.json"), JSON.stringify({ strings: { [longT]: "مترجمٌ طويلٌ تجريبي", "Zq short": "قصيرٌ تجريبي" },
    patterns: [{ en: "{a} zqend", re: "^(.+?) zqend$", ar: "$1 نهايةٌ تجريبية" }], plurals: {} }), "utf8");
  fs.writeFileSync(path.join(RUN2, "keep.json"), JSON.stringify({ keep: [] }), "utf8");
  fs.writeFileSync(path.join(RUN2, "en-by-id.json"), JSON.stringify({ at: "zq", ids: { a: longU, b: longT, c: longP, d: shortP, e: "Zq short" } }), "utf8");
  const k2 = run([path.join(RUN2, "catalogue-coverage.mjs"), "--dict=" + path.join(RUN2, "ar.json"), "--keep=" + path.join(RUN2, "keep.json"),
    "--cat=" + path.join(RUN2, "en-by-id.json"), "--json=" + path.join(RUN2, "s.json")], RUN2);
  let k2s = null; try { k2s = JSON.parse(fs.readFileSync(path.join(RUN2, "s.json"), "utf8")); } catch {}
  const sc = (k2s && k2s.engineScope) || {}, gr = (k2s && k2s.gap && k2s.gap.byReason) || {};
  expect("★ (ر29-ي) catalogue-coverage: الطويل في النطاق (5/5 بثلاثٍ فوق 300)، والطويل غير المترجَم ناقصٌ لا «over-TEXT_MAX»، والنمط القصير العامّ لا يُحسب للطويل فوق حارس الالتقاط، و--cat بصيغة الزحف",
    k2.code === 0 && sc.of === 5 && sc.covered === 3 && sc.pct === 60 && gr["not-harvested"] === 2 && !("over-TEXT_MAX" in gr) && k2s.catalogue.overTextMax === 3,
    JSON.stringify(k2s || {}) + " " + k2.out.slice(-400));
  fs.rmSync(RUN2, { recursive: true, force: true });
  // ★ (ر29-ك، ت13-1 §٤) معرّفات حزم اليوم من ستة أحرف (أول ستةٍ من العشرة): عمود المنطقة يعدّها معرّفاتٍ كالعشرة (منطقةٌ بالمحتوى)، لا مفاتيح مسمّاة
  // («key:…»)، والمفتاح المسمّى يبقى باسمه. كتالوجٌ اصطناعي بصيغة الزحف وقيمٌ غير مترجمة («Zq…»)
  const RUN3 = path.join(G, "_catalogue-run-ids");
  fs.mkdirSync(RUN3, { recursive: true });
  fs.copyFileSync(CATALOGUE_TOOL, path.join(RUN3, "catalogue-coverage.mjs"));
  fs.writeFileSync(path.join(RUN3, "ar.json"), JSON.stringify({ strings: {}, patterns: [], plurals: {} }), "utf8");
  fs.writeFileSync(path.join(RUN3, "keep.json"), JSON.stringify({ keep: [] }), "utf8");
  fs.writeFileSync(path.join(RUN3, "en-by-id.json"), JSON.stringify({ at: "zq", ids: { Zq9xQ1: "Zq rename this project", "Zq9xQ1ab+/": "Zq share the project link",
    "settings.zqPanel": "Zq open the zq project panel" } }), "utf8");
  const k3 = run([path.join(RUN3, "catalogue-coverage.mjs"), "--dict=" + path.join(RUN3, "ar.json"), "--keep=" + path.join(RUN3, "keep.json"),
    "--cat=" + path.join(RUN3, "en-by-id.json"), "--json=" + path.join(RUN3, "s.json")], RUN3);
  let k3s = null; try { k3s = JSON.parse(fs.readFileSync(path.join(RUN3, "s.json"), "utf8")); } catch {}
  const ba = (k3s && k3s.gap && k3s.gap.byArea) || {};
  expect("★ (ر29-ك) catalogue-coverage: معرّف الأحرف الستة (حزم اليوم) معرّفٌ كمعرّف العشرة في عمود المنطقة، لا مفتاحٌ مسمًّى، والمسمّى باسمه",
    k3.code === 0 && ba["projects-artifacts"] === 2 && ba["key:settings"] === 1 && !Object.keys(ba).some((a) => a === "key:Zq"), JSON.stringify(ba) + " " + k3.out.slice(-300));
  fs.rmSync(RUN3, { recursive: true, force: true });
} else skipped.push("catalogue-coverage (أداة التطوير غائبة في هذه البنية)");
// diff-engine — فهرسٌ اصطناعي
fs.writeFileSync(path.join(G, "claude-ALL-strings.txt"), "Zqt open zq panel\nZqt open Zeddicus\nZq Recents\n", "utf8");
let de = run([T("diff-engine.mjs")]);
expect("diff-engine: الأنماط 1 (التقاطٌ هو مفتاح)، والباقي 1", /patterns 1 /.test(de.out) && /MISSING plain: 1 /.test(de.out), de.out);
fs.rmSync(path.join(G, "claude-ALL-strings.txt"), { force: true });

// (٦) ★ rawCaps — القيم الملتقطة التي يُظهرها الناتج خامًا: كل التقاطٍ إلا ما لا يستهلكه إلا %T (تحلّ محلّه عربية مفتاح)
await import(pathToFileURL(path.join(inBox(EXT), "cml-shared.js")).href);
const SH = globalThis.CMLShared;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const m3 = ["Zqt open zq panel by Bob 5", "zq panel", "Bob", "5"];
expect("rawCaps: التقاطٌ لا يستهلكه إلا %T ليس خامًا، و$n خام", same(SH.rawCaps("فتح %T1 من $2", m3.slice(0, 3)), ["Bob"]),
  JSON.stringify(SH.rawCaps("فتح %T1 من $2", m3.slice(0, 3))));
expect("rawCaps: التقاطٌ يستهلكه %T و$n معًا خام", same(SH.rawCaps("فتح %T1 ($1)", m3.slice(0, 2)), ["zq panel"]),
  JSON.stringify(SH.rawCaps("فتح %T1 ($1)", m3.slice(0, 2))));
expect("rawCaps: التقاطٌ غير مذكور في القالب أو برمزٍ غير %T (%M) خام", same(SH.rawCaps("فتح %T1 في %M3", m3), ["Bob", "5"]),
  JSON.stringify(SH.rawCaps("فتح %T1 في %M3", m3)));
// وعبر فحص الخلط في completeness لحزم التطبيق (inv.source): «Zqt open zq panel» يغطّيه نمط %T، وقيمته الملتقطة «zq panel» كلمةٌ صغيرة الحرف الأول
// (قاعدة الخلط) لكنها لا تظهر خامًا — عربية مفتاحها مكانها — فلا خلط
fs.writeFileSync(path.join(G, "_live-catalog.txt"), "Zqt open zq panel\nZq Recents\n", "utf8");
const cja = path.join(BOX, "c-app.json");
c = run([T("completeness.mjs"), "--domain=app", "--offline", "--json=" + cja]);
rep = null; try { rep = JSON.parse(fs.readFileSync(cja, "utf8")); } catch {}
const invA = rep && rep.domains && rep.domains.app && rep.domains.app.text && (rep.domains.app.text.inventories || [])[0];
expect("completeness (حزم التطبيق): نصٌّ لا يغطّيه إلا نمط %T التقاطُه مفتاحٌ لا يُعدّ خلطًا (rawCaps)، ويُعدّ مغطًّى بالنمط",
  invA && invA.mixed === 0 && invA.by && invA.by.pattern === 1 && invA.by.literal === 1, JSON.stringify(invA) + " " + c.out.slice(-300));

// (٧) ★ (ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ) merge-blocks وbuild: الإبقاء بنطاق الصفحة (keepOn في kept-as-is.json) — علامةٌ في صفحاتها وحدها ولو تُرجمت البصمة
// (لا تُشحن ترجمتها هناك) أو غطّاها قاموس الواجهة؛ وui-timer لا علامة له؛ والبناء يُغلّب علامة الصفحة على ترجمة البصمة فيها إن اجتمعتا
const AC = path.join(G, "academy");
const BLK = (tpl) => ({ tpl, fp: SH.blockFp(tpl) });
const bX = BLK("Zq shared label paragraph."), bY = BLK("Zq other paragraph."), bL = BLK("Zq Owner"), bW = BLK("Zq whole kept paragraph.");
const bT = BLK("<g1/><s2>Zq reading the file</s2><s3>31s</s3>"), bT2 = BLK("<g1/><s2>Zq reading the file</s2><s3>47s</s3>");
const bR = BLK("<s1>Zq one</s1> <s2>Zq two</s2>"), bZ = BLK("Zq new page paragraph.");
// ★ (مراجعة ر13-ج) bK: مدخلٌ بنطاق صفحةٍ لا ترجمة لبصمته بعد (علامةٌ في صفحته وحدها لا إبقاءٌ عامّ)؛ bF: صفٌّ أحد بنديه مركّبٌ (false) والآخر في قاموس الواجهة
const bK = BLK("Zq scoped untranslated label."), bF = BLK("<s1><b2>Zq</b2> two</s1><s3>Zq reading the file</s3>");
const blocksHv = (name, pages, list) => writeJson(path.join(AC, "_harvest", name), { _tool: "harvest-dom --blocks", domain: "academy", at: "2099-01-01T00:00:00.000Z",
  v: SH.BLOCK.V, pages, urls: Object.fromEntries(Object.keys(pages).map((pk) => [pk, "https://academy.claude.com" + pk])), tally: {},
  blocks: list.map((b) => ({ fp: b.fp, tpl: b.tpl, count: 1, pages: Object.keys(pages).filter((pk) => pages[pk].includes(b.fp)), status: "todo" })) });
blocksHv("blocks-20990101T0000.json", { "/zq/a": [bX.fp, bY.fp, bL.fp, bT.fp, bW.fp, bK.fp], "/zq/b": [bX.fp, bY.fp, bW.fp, bK.fp] }, [bX, bY, bL, bT, bW, bK]);
writeJson(path.join(AC, "_blk_batches", "zq-000.json"), [{ fp: bX.fp, src: bX.tpl, ar: "فقرةٌ مشتركة تجريبية." }, { fp: bY.fp, src: bY.tpl, ar: "فقرةٌ أخرى تجريبية." }]);
writeJson(path.join(AC, "_blk_todo", "kept-as-is.json"), { blocks: [
  { fp: bX.fp, src: bX.tpl, why: "company-keeps-en", pages: ["/zq/a", "/zq/b"], keepOn: ["/zq/b"] },
  { fp: bL.fp, src: bL.tpl, why: "ui-dict", pages: ["/zq/a"], keepOn: ["/zq/a"] },
  { fp: bT.fp, src: bT.tpl, why: "ui-timer", pages: ["/zq/a"] },
  { fp: bW.fp, src: bW.tpl, why: "company-keeps-en", pages: ["/zq/a", "/zq/b"] },
  { fp: bK.fp, src: bK.tpl, why: "company-keeps-en", pages: ["/zq/a", "/zq/b"], keepOn: ["/zq/b"] }] });
writeJson(ACAD, dictOf("academy", { "Zq reading the file": "قراءةٌ تجريبية للملف", "Zq Owner": "مالكٌ تجريبي" }, []));
const mb = run([T("merge-blocks.mjs"), "--domain=academy"]);
const ABD = path.join(inBox(DICTS), "ar-academy.blocks.json");
let bd0 = null; try { bd0 = JSON.parse(fs.readFileSync(ABD, "utf8")); } catch {}
const has = (o, pk, fp) => !!(o && o[pk] && o[pk].includes(fp));
expect("merge-blocks: keepOn علامة إبقاءٍ في صفحتها وحدها ولو تُرجمت البصمة، ولا تُشحن ترجمتها فيها، وتُشحن في غيرها",
  bd0 && !has(bd0.pages, "/zq/b", bX.fp) && has(bd0.keepPages, "/zq/b", bX.fp) && has(bd0.pages, "/zq/a", bX.fp) && !has(bd0.keepPages, "/zq/a", bX.fp),
  JSON.stringify(bd0 && { pages: bd0.pages, keepPages: bd0.keepPages }) + " " + mb.out.slice(-400));
expect("merge-blocks: مدخل ui-dict ذو keepOn علامةٌ في صفحته، وui-timer لا علامة له، والإبقاء العامّ في صفحاته كلها كما كان",
  bd0 && has(bd0.keepPages, "/zq/a", bL.fp) && !Object.values(bd0.keepPages || {}).some((l) => l.includes(bT.fp)) &&
  has(bd0.keepPages, "/zq/a", bW.fp) && has(bd0.keepPages, "/zq/b", bW.fp), JSON.stringify(bd0 && bd0.keepPages));
// ★ (مراجعة ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ) ومدخلٌ بنطاقٍ لا ترجمة لبصمته بعد علامةٌ في صفحته وحدها: لا يصير إبقاءً عامًّا في صفحاته الأخرى (كانت طفرةٌ تجعله
// كذلك تنجو من الفحص كله)
expect("merge-blocks: مدخلٌ ذو keepOn بلا ترجمةٍ لبصمته علامةٌ في صفحته وحدها، لا إبقاءٌ عامّ في صفحاته الأخرى",
  bd0 && has(bd0.keepPages, "/zq/b", bK.fp) && !has(bd0.keepPages, "/zq/a", bK.fp), JSON.stringify(bd0 && bd0.keepPages));
// والبناء: قطعة ‎/zq/b‎ علامةٌ بلا ترجمة، وقطعة ‎/zq/a‎ ترجمةٌ وعلامات؛ وصفحةٌ اجتمعت فيها الترجمة والعلامة في قاموسٍ (‎/zq/c‎) تغلب علامتها
if (bd0) { bd0.pages["/zq/c"] = [bX.fp, bY.fp]; bd0.keepPages["/zq/c"] = [bX.fp]; bd0.harvested["/zq/c"] = [bX.fp, bY.fp]; fs.writeFileSync(ABD, JSON.stringify(bd0, null, 1) + "\n", "utf8"); }
b = run([T("build.mjs")]);
const shard = (pk) => { try { return JSON.parse(fs.readFileSync(path.join(inBox(EXT), "bodies", "academy", "ar", SH.shardOf(pk) + ".json"), "utf8")); } catch { return null; } };
const sA = shard("/zq/a"), sB = shard("/zq/b"), sC = shard("/zq/c");
expect("build: قطعة الصفحة المُبقية علامةٌ بلا ترجمة البصمة، والأخرى ترجمتها؛ وما اجتمعا فيه في القاموس تغلب العلامة (لا ترجمةَ لها في قطعته)",
  sA && sB && sC && sA.blocks[bX.fp] && !(sA.keep || []).includes(bX.fp) && !sB.blocks[bX.fp] && (sB.keep || []).includes(bX.fp) &&
  !sC.blocks[bX.fp] && sC.blocks[bY.fp] && (sC.keep || []).includes(bX.fp), JSON.stringify({ sA, sB, sC }).slice(0, 600) + " " + b.out.slice(-300));
// (٨) ★ (ر13-ج) completeness: حصادات النطاق كلها بترتيب زمنها (merge-blocks) — لكل صفحةٍ أحدثُ حصادها، والكتل ما تشير إليه الخريطة الناتجة
blocksHv("blocks-20990101T0100.json", { "/zq/a": [bX.fp, bY.fp], "/zq/c": [bZ.fp, bT2.fp, bR.fp, bF.fp] }, [bX, bY, bZ, bT2, bR, bF]);
const domHv = (name, pages, keys) => writeJson(path.join(AC, "_harvest", name), { _tool: "harvest-dom", domain: "academy", at: "2099-01-01T00:00:00.000Z",
  pages: pages.map((u) => ({ url: "https://academy.claude.com" + u, final: "https://academy.claude.com" + u, mode: "full", keys: 1 })),
  keys: keys.map(([key, u]) => ({ key, kinds: ["text"], count: 1, zone: "ui", pages: ["https://academy.claude.com" + u], translated: false })) });
domHv("harvest-20980101T0000.json", ["/zq", "/zq-old"], [["Zq Superseded", "/zq"], ["Zq Old Key", "/zq-old"]]);
domHv("harvest-20990101T0000.json", ["/zq"], [["Zq Owner", "/zq"]]);
const cj2 = path.join(BOX, "c-academy2.json");
c = run([T("completeness.mjs"), "--domain=academy", "--offline", "--json=" + cj2]);
rep = null; try { rep = JSON.parse(fs.readFileSync(cj2, "utf8")); } catch {}
const ra = rep && rep.domains && rep.domains.academy && rep.domains.academy.text;
const bod = ra && ra.bodies, inv2 = ra && (ra.inventories || [])[0];
expect("completeness: حصادات الكتل كلها بترتيب زمنها — الصفحات 3 (‎/zq/b‎ من الأقدم وحده)، والكتل ما تشير إليه الخريطة (ما سقط من ‎/zq/a‎ في الأحدث لا يُعدّ)",
  bod && bod.pages === 3 && bod.blocks === 8, JSON.stringify(bod) + " " + c.out.slice(-300));
expect("completeness: حصادات DOM مضمومة — نصُّ صفحةٍ لم يُعَد حصادها يُعدّ، ونصُّ صفحةٍ أُعيد حصادها ولم يُرَ فيها لا يُعدّ",
  inv2 && inv2.total === 2 && inv2.missing === 1 && inv2.covered === 1, JSON.stringify(inv2));
// (٩) ★ (ر13-ج) صفُّ لافتاتٍ بشكل قالبه (labelRow كحكم المحرّك ex.group): صفُّ العدّاد الزمني بعبارةٍ في قاموس الواجهة مغطًّى أيًّا كانت ثوانيه، والصفُّ
// الذي بين بنوده بياضٌ جملةٌ لا صفّ فيبقى باقيًا
expect("completeness: صفُّ العدّاد الزمني (حاله todo في الحصاد) مغطًّى بعبارته في قاموس الواجهة، والصفُّ ذو البياض بين بنوده باقٍ، والصفُّ ذو البند المركّب (false) باقٍ ولو غطّى القاموسُ بندَه الآخر",
  // ★ (ر24-و) وعلامات الإبقاء كما يعدّها الحارس بعد الدمج: bW (إبقاءٌ عامّ من التحضير) وbK (keepOn في ‎/zq/b‎ وهي صفحته الوحيدة اليوم) مُبقاتان — كانتا
  // تُعدّان باقيتين (5) لأن القائمة لا تُقرأ متى وُجد قاموس الكتل
  bod && bod.viaUi === 1 && bod.translated === 2 && bod.keptSource === 2 && bod.keptList === 2 && bod.missing === 3, JSON.stringify(bod));
const { labelRow, extraItems } = await import(pathToFileURL(T("domain-arg.mjs")).href);
expect("labelRow: صفٌّ بذرّةٍ وعبارةٍ وثوانٍ ⇐ [null، العبارة، الثواني]؛ وجملةٌ موزّعة (بياضٌ بين البنود أو في طرف بند، أو نصٌّ حرّ) ليست صفًّا",
  same(labelRow(bT.tpl), [null, "Zq reading the file", "31s"]) && labelRow(bR.tpl) === null && labelRow("<s1>Zq a</s1><s2> zq b</s2>") === null &&
  labelRow("Zq x <s1>y</s1><s2>z</s2>") === null && same(labelRow("<s1><b2>Zq</b2> two</s1><s3>Zq c</s3>"), [false, "Zq c"]),
  JSON.stringify([labelRow(bT.tpl), labelRow(bR.tpl)]));
// (١٠) ★ (ر13-ج) harvest-dom: سماتٌ تظهر بعد نقرة تُضمّ إلى حصاد الواجهة بعددها (extraItems)، والنصوص لا
const X0 = [{ key: "Zq a", kind: "attr:alt" }, { key: "Zq t", kind: "text" }];
const X1 = [{ key: "Zq a", kind: "attr:alt" }, { key: "Zq a", kind: "attr:alt" }, { key: "Zq b", kind: "attr:aria-label" }, { key: "Zq u", kind: "text" }];
expect("extraItems: ما زاد من السمات بعد النقرة بعدده (نسخةٌ ثانية من «Zq a» وسمةٌ جديدة)، ولا نصّ",
  same(extraItems(X0, X1), [{ key: "Zq a", kind: "attr:alt" }, { key: "Zq b", kind: "attr:aria-label" }]) && same(extraItems(X1, X0), []),
  JSON.stringify(extraItems(X0, X1)));

// (١١) ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) com-routes.mjs: قائمة مسارات claude.com المترجمة من مدخلاتٍ اصطناعية محفوظة (‎--from‎، بلا شبكة) — الخريطة
// والروابط والتحويل والسوق والعتبة، وبوابة الهبوط، والكتابة في كتلة cml-const.js مرّةً لا تتكرّر، ثم البناء يحقنها ويرفض كتلةً مختلّة أو نطاقًا
// مشحونًا بلا قاموس. وفي النسخة كتلةُ الشجرة الحقيقية (ثلاثمئة مسارٍ ونيّف) فالهبوط إلى أربعة يُرفض
const CR = path.join(BOX, "com-routes-in"), CMLB = path.join(inBox(EXT), "cml-const.js");
writeJson(path.join(CR, "inputs.json"), { v: 1, sitemap: 14, prefixes: 2, fetched: 4, errors: [], redirects: ["/zq-redir"],
  english: ["/", "/zq-a", "/zq-b", "/zq-c", "/customers/zq-x", "/marketplace", "/marketplace/zq-m", "/zq-redir"],
  localized: { "/": 2, "/zq-a": 1, "/customers/zq-x": 2, "/marketplace": 2, "/zq-orphan": 1, "/zq-redir": 1 },
  hreflang: { "/zq-b": 2, "/zq-c": 0 } });
const cmlText = () => fs.readFileSync(CMLB, "utf8");
const comExact = async () => { const m = await import(pathToFileURL(T("com-routes.mjs")).href); const b = m.readBlock(cmlText()); return b ? b.exact : null; };
const before0 = cmlText();
let cr = run([T("com-routes.mjs"), "--from=" + CR, "--write"]);
expect("com-routes: هبوط القائمة من مئاتٍ إلى أربعة يُرفض (رمز 2) ولا يُكتب شيء",
  cr.code === 2 && /هبط العدد/.test(cr.out) && cmlText() === before0, cr.code + " " + cr.out.slice(-300));
cr = run([T("com-routes.mjs"), "--from=" + CR, "--write", "--accept-drop"]);
const ex1 = await comExact(), after1 = cmlText();
expect("com-routes: القائمة من الخريطة (لغةٌ واحدة تكفي) وروابط hreflang، بلا السوق ولا المحوَّل ولا المترجَم بلا أصلٍ إنجليزي ولا ما لا لغة له، مرتّبةً",
  cr.code === 0 && same(ex1, ["/", "/customers/zq-x", "/zq-a", "/zq-b"]), cr.code + " " + JSON.stringify(ex1) + " " + cr.out.slice(-300));
cr = run([T("com-routes.mjs"), "--from=" + CR, "--write"]);
expect("com-routes: إعادة التشغيل على المدخلات نفسها لا تغيّر بايتًا (تُكتب الكتلة حين تتغيّر القائمة وحدها)",
  cr.code === 0 && cmlText() === after1 && /لم يُكتب شيء/.test(cr.out), cr.code + " " + cr.out.slice(-200));
const crj = path.join(BOX, "com-routes-2.json");
cr = run([T("com-routes.mjs"), "--from=" + CR, "--min-locales=2", "--accept-drop", "--json=" + crj]);
const crr = fs.existsSync(crj) ? JSON.parse(fs.readFileSync(crj, "utf8")) : {};
expect("com-routes: عتبة لغتين (السؤال 15) تُسقط ما ترجمته لغةٌ واحدة، بلا كتابة",
  cr.code === 0 && crr.meta && crr.meta.exact === 3 && same(crr.removed, ["/zq-a"]) && cmlText() === after1, cr.code + " " + JSON.stringify(crr.meta));
let bd = run([T("build.mjs")]);
const dictCom = fs.existsSync(path.join(inBox(EXT), "dict-com.js")) ? fs.readFileSync(path.join(inBox(EXT), "dict-com.js"), "utf8") : "";
expect("build: القائمة المكتوبة في الكتلة تُحقن في dict-com.js (meta.routes.exact)",
  bd.code === 0 && dictCom.indexOf('"exact":["/","/customers/zq-x","/zq-a","/zq-b"]') >= 0, bd.code + " " + bd.out.slice(-300));
fs.writeFileSync(CMLB, after1.replace('    "/zq-a",\n    "/zq-b"', '    "/zq-b",\n    "/zq-a"'));
bd = run([T("build.mjs")]);
const unsortedOut = bd;
fs.writeFileSync(CMLB, after1.replace('"exact":4', '"exact":5'));
bd = run([T("build.mjs")]);
expect("build: كتلةٌ مختلّة (ترتيبٌ باليد، أو عددٌ يخالف COM_EXACT_META) توقف البناء",
  unsortedOut.code === 1 && /غير مرتّب/.test(unsortedOut.out) && bd.code === 1 && /لا يطابق COM_EXACT_META/.test(bd.out), unsortedOut.out.slice(-200) + " | " + bd.out.slice(-200));
// وبوابة الحزمة نفسها على الحزمة المبنيّة هنا: com قادمٌ بقاموسه الفارغ فلا يُشكى منه، وتبديلُ صيغته وحدها (بلا قاموس) يُرفض باسمه. (تُخفق البوابة
// في النسخة لأسبابٍ أخرى — لا قفل خطوطٍ فيها، وقواميس المواقع الأخرى غائبة — فالحكم على سطر com وحده)
fs.writeFileSync(CMLB, after1);
// ★ (ر28-ب، ٢٠ جمادى الأولى ١٤٤٨هـ — السؤال 2 على افتراضه) ومانيفست الحزمة يحجب مدخلي النطاقين القادمين (build.mjs ‏packageEntries)، وصفُّ أحدهما مشحونًا
// يبني له البناء مدخله: فيُكتب مانيفست النسخة لفحوص vp1 وvp2 وvp4 بمدخليهما من مولّد البناء نفسه (manifest-entry.mjs)، كما كان مانيفست التطوير قبلها، فيبقى
// الحكم على القاموس وحده كما كان (القادم بمدخله لا يُشكى منه بلا ‎--final‎، والمشحون بقاموسه الفارغ يُرفض باسمه)، ثم يُعاد مانيفست النسخة بعد كلٍّ منها
// (والبناء بينها يكتبه بلا مدخليهما، فيُكتب ثانيةً قبل vp4)
const { contentScriptFor: upEntry } = await import(pathToFileURL(T("manifest-entry.mjs")).href);
const UPMF = path.join(inBox(EXT), "manifest.json");
await import(pathToFileURL(path.join(EXT, "cml-const.js")).href);
const upHas = (id) => JSON.parse(fs.readFileSync(UPMF, "utf8")).content_scripts.some((cs) => cs.js.includes("dict-" + id + ".js"));
const withUp = () => {
  const text = fs.readFileSync(UPMF, "utf8"), C0 = globalThis.CMLConst, m = JSON.parse(text);
  m.content_scripts = C0.DOMAINS.map((d) => m.content_scripts.find((cs) => same(cs.matches, d.matches)) || upEntry(d, C0, inBox(EXT)));
  fs.writeFileSync(UPMF, JSON.stringify(m, null, 2) + "\n");
  return { text, both: upHas("com") && upHas("portal") };
};
const up1 = withUp(), upBoth = up1.both;
const COM_EMPTY = /(^|\n|- )com: نطاقٌ مشحون بلا قاموس/;
const vp1 = run([T("verify-package.mjs")]);
// ★ (ر20-أ) صفُّ com بعينه: صنفُ مسار لوحة المطوّرين في صفّ docs قبله قادمٌ بالصيغة نفسها، فالاستبدال الأول كان يقع عليه
const COM_UP = 'dict: "dict-com.js", allFrames: false,\n        status: { upcoming: true },';
fs.writeFileSync(CMLB, after1.replace(COM_UP, COM_UP.replace("{ upcoming: true }", "{ full: true }")));
const vp2 = run([T("verify-package.mjs")]);
fs.writeFileSync(UPMF, up1.text);
expect("verify-package: نطاقٌ مشحون (status بلا upcoming) قاموسُه المبنيّ لا يعرّب شيئًا يُرفض باسمه، والنطاق القادم بالقاموس نفسه لا",
  upBoth && after1.indexOf(COM_UP) > 0 && !COM_EMPTY.test(vp1.out) && COM_EMPTY.test(vp2.out) && vp2.code !== 0, vp1.out.slice(-200) + " | " + vp2.out.slice(-300));
// ★ (ر20-أ، ١٢ جمادى الأولى ١٤٤٨هـ) وصنفُ المسار (لوحة المطوّرين في مدخل الوثائق) بحاله نفسها: قادمًا لا يُشكى منه، ومشحونًا (status بلا upcoming) بقاموسه
// الفارغ يُرفض باسمه — فلا يُشحن صنفٌ قبل قاموسه (CN1) صامتًا.
// ★ (ر20-ج، ١٢ جمادى الأولى ١٤٤٨هـ) والحاجز لا يقرأ نصّ المحرّك بعد اليوم (المحرّك يبدّل القاموس والبيانات بالمسار): المشحون بقاموسه الفارغ يُرفض بسبب القاموس
// وحده؛ والمشحون بقاموسٍ يعرّب (محقونًا في مدخل الوثائق بالبناء) يمرّ ولو حمل المحرّك نصَّ الحارس القديم تعليقًا؛ وبلا محدِّدات محتوى المستخدم في
// بياناته يُرفض باسمه. ثم تُعاد النسخة كما كانت (الصنف قادم، وقاموسه فارغ، والمحرّك والحزمة كما بُنيا)
const CON_UP = 'dict: "dict-console.js", status: { upcoming: true },';
const CON_EMPTY = /docs\/console: صنفٌ مشحون بلا قاموس/, CON_ENGINE = /المحرّك يحكم على مساره بالخمول/;
const CON_NOSKIP = /docs\/console: صنفٌ مشحون بلا محدِّدات محتوى المستخدم/;
const CON_META = 'meta: { skipSel: CONSOLE_USER + ", " + EDITOR_USER } }] },';
const CON_ON = after1.replace(CON_UP, CON_UP.replace("{ upcoming: true }", "{ full: true }"));
fs.writeFileSync(CMLB, CON_ON);
const vp3 = run([T("verify-package.mjs")]);
const CONJ = path.join(inBox(DICTS), "ar-console.json"), ENGB = path.join(inBox(EXT), "engine.js"), eng0 = fs.readFileSync(ENGB, "utf8");
writeJson(CONJ, dictOf("docs", { "Zq Keys": "مفاتيحُ تجريبية" }, []));
fs.writeFileSync(ENGB, eng0 + '\n// routeClassNow() ? "inactive"\n');
const bdc = run([T("build.mjs")]);
const mfc = JSON.parse(fs.readFileSync(path.join(inBox(EXT), "manifest.json"), "utf8"));
const docsJs = ((mfc.content_scripts || []).find((cs) => cs.js.includes("dict-docs.js")) || { js: [] }).js.join(",");
const vp3b = run([T("verify-package.mjs")]);
fs.writeFileSync(CMLB, CON_ON.replace(CON_META, "meta: {} }] },"));
const bdc2 = run([T("build.mjs")]);
const vp3c = run([T("verify-package.mjs")]);
fs.writeFileSync(ENGB, eng0); fs.rmSync(CONJ, { force: true }); fs.writeFileSync(CMLB, after1);
const bdc3 = run([T("build.mjs")]);
expect("verify-package: صنفُ مسارٍ مشحون قاموسُه لا يعرّب شيئًا يُرفض باسمه (بلا قراءةٍ لنصّ المحرّك)، وبقاموسٍ يعرّب يمرّ محقونًا بعد قاموس الوثائق، وبلا محدِّدات محتوى المستخدم يُرفض باسمه، والقادم لا",
  after1.indexOf(CON_UP) > 0 && CON_ON !== after1 && CON_ON.indexOf(CON_META) > 0 && !/docs\/console:/.test(vp1.out) &&
  CON_EMPTY.test(vp3.out) && !CON_ENGINE.test(vp3.out) && vp3.code !== 0 &&
  bdc.code === 0 && /dict-docs\.js,dict-console\.js,engine\.js$/.test(docsJs) && !/docs\/console:/.test(vp3b.out) &&
  bdc2.code === 0 && CON_NOSKIP.test(vp3c.out) && !CON_EMPTY.test(vp3c.out) && vp3c.code !== 0 && bdc3.code === 0,
  vp3.out.slice(-200) + " | " + docsJs + " | " + vp3b.out.slice(-200) + " | " + vp3c.out.slice(-300));
// ★ (ر20-ج، ١٢ جمادى الأولى ١٤٤٨هـ — ما حملته ر20-أ) وأداتا القواميس تقرآن قاموس صنف المسار بعد قاموس نطاقه (domain-arg dictTargets): قاموسُ صنفٍ
// اصطناعي بزوجٍ فاسد يُفشل lint-dict باسم الصنف ونطاقه، وآخرُ بنمطٍ يظلّل مفتاحًا يُفشل cross-check-patterns باسمه، وبلا قاموسٍ والصنف قادم سطرُ معلومة.
// وقاموس الوثائق في النسخة هيكلٌ فارغ مؤقت (الأداتان تفحصان النطاق قبل صنفه)، ويُحذفان بعد
const CONJ2 = path.join(inBox(DICTS), "ar-console.json"), DOCJ = path.join(inBox(DICTS), "ar-docs.json"), hadDocs = fs.existsSync(DOCJ);
if (!hadDocs) writeJson(DOCJ, dictOf("docs", {}, []));
writeJson(CONJ2, dictOf("docs", { "Zq a": "", "Zq b": "بٌ" }, []));
const ldc = run([T("lint-dict.mjs"), "--domain=docs"]);
writeJson(CONJ2, dictOf("docs", { "Zq 5 keys": "خمسة مفاتيح تجريبية" }, [{ en: "Zq {n} keys", re: "^Zq (\\d+) keys$", ar: "$1 مفاتيح تجريبية" }]));
const xcc = run([T("cross-check-patterns.mjs"), "--domain=docs"]);
fs.rmSync(CONJ2, { force: true });
const ldc0 = run([T("lint-dict.mjs"), "--domain=docs"]), xcc0 = run([T("cross-check-patterns.mjs"), "--domain=docs"]);
if (!hadDocs) fs.rmSync(DOCJ, { force: true });
const CLS_TAG = "لوحة المطوّرين (Console) (docs/console)";
expect("lint-dict وcross-check-patterns: قاموس صنف المسار يُفحص بعد قاموس نطاقه — الزوج الفاسد والنمط المظلِّل يُسمّيان باسم الصنف ونطاقه، والقادم بلا قاموسٍ معلومة",
  ldc.code === 1 && ldc.out.indexOf("✗ " + CLS_TAG + ": زوج فاسد") >= 0 && ldc.out.indexOf("— " + CLS_TAG + ": ar-console.json") >= 0 &&
  xcc.code === 1 && xcc.out.indexOf("  " + CLS_TAG + ': تظليل: "Zq 5 keys"') >= 0 &&
  ldc0.code === 0 && ldc0.out.indexOf("ℹ " + CLS_TAG + ": صنفٌ قادم بلا قاموسٍ بعد") >= 0 && xcc0.code === 0 && xcc0.out.indexOf("— " + CLS_TAG) >= 0,
  ldc.code + " " + ldc.out.slice(-300) + " | " + xcc.code + " " + xcc.out.slice(-300) + " | " + ldc0.code + " " + ldc0.out.slice(-200));
// ★ (ر20-ب، ١٢ جمادى الأولى ١٤٤٨هـ) والنطاق التاسع (بوابة Anthropic) بالحال نفسها: قادمًا بقاموسه الفارغ لا يُشكى منه، وتبديل صيغته وحدها يُرفض باسمه —
// فلا تُشحن البوابة قبل قاموسها (CN2) صامتةً، ومطابقة مضيفها في المانيفست لا تعمل شيئًا وهي قادمة
const PT_EMPTY = /(^|\n|- )portal: نطاقٌ مشحون بلا قاموس/;
const PT_UP = 'dict: "dict-portal.js", allFrames: false,\n        status: { upcoming: true },';
fs.writeFileSync(CMLB, after1.replace(PT_UP, PT_UP.replace("{ upcoming: true }", "{ full: true }")));
const up4 = withUp();
const vp4 = run([T("verify-package.mjs")]);
fs.writeFileSync(UPMF, up4.text);
expect("verify-package: بوابة Anthropic (النطاق التاسع) مشحونةً بقاموسها الفارغ تُرفض باسمها، وقادمةً لا",
  upBoth && up4.both && after1.indexOf(PT_UP) > 0 && !PT_EMPTY.test(vp1.out) && PT_EMPTY.test(vp4.out) && vp4.code !== 0, vp1.out.slice(-200) + " | " + vp4.out.slice(-300));
fs.writeFileSync(CMLB, before0);
// وحكم بوابة الحزمة (verify-package) على نطاقٍ مشحونٍ قاموسُه لا يعرّب شيئًا: dict-com.js المبنيّ هنا فارغٌ (فلا يُشحن com إلا قادمًا)، وما فيه نصٌّ
// أو نمطٌ أو جمعٌ أو فقراتٌ مشحونة يعرّب
const { translatesNothing } = await import(pathToFileURL(T("domain-arg.mjs")).href);
const payloadOf = (src) => { const g = {}; try { new Function("globalThis", src)(g); } catch {} return g.CLAUDE_L10N || null; };
const dicts1 = (o) => ({ default: "ar", dicts: { ar: Object.assign({ strings: {}, patterns: [], plurals: {} }, o) } });
expect("verify-package: قاموسٌ مبنيّ لا يعرّب شيئًا (dict-com.js الفارغ) يُعرف، وما فيه نصٌّ أو نمطٌ أو جمعٌ أو فقراتٌ مشحونة لا",
  translatesNothing(payloadOf(dictCom)) === true && !translatesNothing(dicts1({ strings: { "Zq a": "أ" } })) &&
  !translatesNothing(dicts1({ patterns: [{ en: "Zq {n}" }] })) && !translatesNothing(dicts1({ plurals: { "%d zq": {} } })) &&
  !translatesNothing(dicts1({ counts: { blocks: 3 } })) && translatesNothing(dicts1({ counts: { blocks: 0 } })),
  String(translatesNothing(payloadOf(dictCom))));
// ★ (مراجعة ر15، ٦ جمادى الأولى ١٤٤٨هـ) بوابة com-routes عند حدودها، ومحلِّلاتها على HTML وخرائط اصطناعية: كانت أربع طفراتٍ تنجو من الحزام — الهبوط
// المقبول حتى 90٪ (الفحص أعلاه هبوطٌ إلى أربعة وحده)، وإسقاط حدّ إخفاق الجلب، وroutes بلا شرط rel=alternate، وعدُّ الروابط الإنجليزية لغاتٍ (فتدخل
// القائمةَ كلُّ صفحةٍ إنجليزية لها رابطٌ إلى نفسها، والبوابة لا تمنع الارتفاع)
const CRM = await import(pathToFileURL(T("com-routes.mjs")).href);
const zqList = (n) => Array.from({ length: n }, (_, i) => "/zq-" + String(i).padStart(3, "0"));
const gOk = (p, n, o) => CRM.gate(zqList(p), zqList(n), o || {}).ok;
const gv = [gOk(100, 90), gOk(100, 89), gOk(100, 89, { acceptDrop: true }), gOk(100, 130), gOk(100, 100, { errors: 10, fetched: 1000 }),
  gOk(100, 100, { errors: 11, fetched: 1000 }), gOk(100, 100, { errors: 11, fetched: 1000, acceptErrors: true }), gOk(100, 0, { acceptDrop: true }), gOk(0, 3)];
expect("com-routes: البوابة عند حدّيها — هبوط 10٪ يُقبل وما فوقه يُرفض إلا بقرار، وإخفاق جلب 1٪ يُقبل وما فوقه يُرفض إلا بقرار، والقائمة الفارغة تُرفض ولو بقرار",
  CRM.DROP_MAX === 0.10 && CRM.ERR_MAX === 0.01 && same(gv, [true, false, true, true, true, false, true, false, true]), JSON.stringify(gv));
const ZQ_HTML = '<head><link rel="alternate" hreflang="xx" href="https://claude.com/xx/zq-a"><link href="/yy/zq-a" hreflang="YY" rel="alternate">' +
  "<link rel='alternate' hreflang='en' href='https://claude.com/zq-a'><link rel=\"alternate\" hreflang=\"en-GB\" href=\"https://claude.com/zq-a\">" +
  '<link rel="alternate" hreflang="x-default" href="https://claude.com/zq-a"><link rel="canonical" hreflang="zz" href="https://claude.com/zz/zq-a">' +
  '<link rel="alternate" hreflang="ww" href="https://zq.example/ww/zq-a"></head><body><link rel="alternate" hreflang="vv" href="https://claude.com/vv/zq-a?q=1&amp;r=2"></body>';
const zqAlts = CRM.alternatesOf(ZQ_HTML), zqPf = [...CRM.prefixesOf(zqAlts)].sort();
const zqSmI = CRM.parseSitemap('<?xml version="1.0"?><sitemapindex><sitemap><loc>https://claude.com/zq-sm-1.xml</loc></sitemap></sitemapindex>');
const zqSmU = CRM.parseSitemap("<urlset><url><loc> https://claude.com/zq-a?p=1&amp;q=2 </loc></url><url><loc>https://claude.com/xx/zq-a</loc></url></urlset>");
const zqSplit = CRM.splitSitemap(["/", "/zq-a", "/xx/zq-a", "/xx/zq-a", "/yy/zq-a", "/xx"], new Set(["xx", "yy"]));
expect("com-routes: روابط hreflang بأي ترتيبٍ للسمات وحالة حروف وفي آخر المستند، والبادئات بلا الإنجليزية ولا x-default ولا غير alternate ولا مضيفٍ آخر؛ والخريطة وفهرسها، وعدد لغات المسار بادئاتٌ مختلفة لا عناوين",
  same(zqPf, ["vv", "xx", "yy"]) && CRM.localeCount(zqAlts) === 3 && zqAlts.length === 7 &&
  same(zqSmI, { locs: [], children: ["https://claude.com/zq-sm-1.xml"] }) && same(zqSmU, { locs: ["https://claude.com/zq-a?p=1&q=2", "https://claude.com/xx/zq-a"], children: [] }) &&
  same(zqSplit, { english: ["/", "/zq-a"], localized: { "/zq-a": 2, "/": 1 } }) &&
  CRM.normPath("/zq-a/?x=1#y") === "/zq-a" && CRM.normPath("//zq-a//b/") === "/zq-a/b" && CRM.normPath("") === "/",
  JSON.stringify({ zqPf, n: zqAlts.length, zqSmI, zqSmU, zqSplit }));
// ومدخلاتٌ محفوظة لعتبة 1 لا تكتب قائمةً بعتبةٍ أعلى (روابط الصفحات المترجمة في الخريطة لم تُقرأ): تنبيهٌ ورفضٌ ولا يتغيّر بايت
const cmlBefore2 = cmlText();
cr = run([T("com-routes.mjs"), "--from=" + CR, "--min-locales=2", "--accept-drop", "--write"]);
expect("com-routes: مدخلات عتبة 1 بعتبة 2 تنبّه وترفض الكتابة (رمز 2) ولا يتغيّر بايت",
  cr.code === 2 && /جُلبت لعتبة 1/.test(cr.out) && cmlText() === cmlBefore2, cr.code + " " + cr.out.slice(-300));

// ★ (ر16-ب، ٦ جمادى الأولى ١٤٤٨هـ) خطّ أساس فحص الاتجاه بالنطاق (rtl-baseline.mjs، يكتب به rtl-audit.mjs --write-baseline): بصمات النطاق
// المفحوص تحلّ محلّ القديمة، وبصمات غيره تبقى حرفًا بحرف وبترتيبها، والرأس كما كان، ويُختم النطاق المكتوب — بنطاقين اصطناعيين zqa وzqb
const RB = await import(pathToFileURL(T("rtl-baseline.mjs")).href);
const zqFp = (fp, d, sev, decision) => Object.assign({ fp, sev, d, check: "zq-check", sel: "div.zq-" + fp, count: 2 }, decision ? { decision } : {});
const zqOld = JSON.stringify({ at: "zq-at", commit: "zq0", extVersion: "0.0.0",
  fps: [zqFp("a1", "zqa", "high", "intended"), zqFp("b1", "zqb", "low"), zqFp("a2", "zqa", "medium"), zqFp("b2", "zqb", "medium")] }, null, 1);
const zqStamp = (d) => ({ at: "zq-new", commit: "zq1", extVersion: "0.0.1", switchedOn: d === "zqb" });
const zqBlock = (t, fp) => (t.match(new RegExp('\\{\\n\\s*"fp": "' + fp + '"[\\s\\S]*?\\n\\s*\\}')) || [""])[0];
// ★ (مراجعة ر16-ب) رأسٌ حقيقي يُمرَّر كما يمرّره rtl-audit (لا {} فارغ): الملف القديم يحتفظ برأسه؛ ودمج نطاقٍ ثانٍ يُبقي ختم الأول في domains
// — طفرتان نجتا بدونهما: كتابة الرأس الجديد فوق القديم، وإسقاط أختام النطاقات التي لم تُفحص
const zqHead = { at: "zq-new", commit: "zq1", extVersion: "0.0.1" };
const zqNew = RB.mergeBaseline(zqOld + "\n", [zqFp("b3", "zqb", "low")], ["zqb"], zqHead, zqStamp), zqN = JSON.parse(zqNew);
expect("rtl-baseline: بصمات النطاق المفحوص تحلّ محلّ القديمة، وبصمات غيره حرفًا بحرف وبترتيبها، والرأس كما كان، والختم في domains، والسطر الأخير",
  same(zqN.fps.map((x) => x.fp), ["a1", "a2", "b3"]) && zqBlock(zqNew, "a1") === zqBlock(zqOld, "a1") && zqBlock(zqOld, "a1").length > 40 &&
  zqBlock(zqNew, "a2") === zqBlock(zqOld, "a2") && zqN.at === "zq-at" && zqN.commit === "zq0" && same(zqN.domains, { zqb: zqStamp("zqb") }) &&
  zqNew.endsWith("}\n") && !RB.mergeBaseline(zqOld, [], ["zqb"], {}, zqStamp).endsWith("\n") &&
  same(JSON.parse(RB.mergeBaseline(zqNew, [], ["zqa"], zqHead, zqStamp)).fps.map((x) => x.fp), ["b3"]) &&
  same(Object.keys(JSON.parse(RB.mergeBaseline(zqNew, [], ["zqa"], zqHead, zqStamp)).domains).sort(), ["zqa", "zqb"]) &&
  JSON.parse(RB.mergeBaseline(zqNew, [], ["zqa"], zqHead, zqStamp)).at === "zq-at", zqNew.slice(0, 600));
const zqThrows = (f) => { try { f(); return false; } catch { return true; } };
const zqFresh = JSON.parse(RB.mergeBaseline("", [zqFp("a9", "zqa", "low")], ["zqa"], { at: "zq-h", commit: "zq2", extVersion: "0.0.2" }, zqStamp));
expect("rtl-baseline: ملفٌّ جديد برأسه وختمه، ويُرفض ملفٌّ قديم غير مقروء أو بلا fps، وبصمةٌ لنطاقٍ لم يُفحص",
  zqFresh.at === "zq-h" && same(zqFresh.fps.map((x) => x.fp), ["a9"]) && !!zqFresh.domains.zqa &&
  zqThrows(() => RB.mergeBaseline("{zq", [], ["zqa"], {}, zqStamp)) && zqThrows(() => RB.mergeBaseline("{}", [], ["zqa"], {}, zqStamp)) &&
  zqThrows(() => RB.mergeBaseline(zqOld, [zqFp("b9", "zqb", "low")], ["zqa"], {}, zqStamp)), JSON.stringify(zqFresh).slice(0, 300));

// ★ (ر16-ج، ٦ جمادى الأولى ١٤٤٨هـ) فحص الاتجاه (rtl-audit.mjs) بلا كروم ولا شبكة. أولًا حكم الانقلاب (rtl-geom.mjs): فرقٌ على حدّ التسامح تمامًا إشارته
// صفر فلا يُعدّ انعكاسًا (الصنف 01ee2f7d7487 في ر16-ب: pl=2.9 pr=0 قبل وبعد)، والانقلاب فوقه يُعدّ — وrtl-audit يحكم به في فرع box-mirrored-ltr
const GEO = await import(pathToFileURL(T("rtl-geom.mjs")).href);
const audSrc = fs.readFileSync(T("rtl-audit.mjs"), "utf8");
const geoV = [GEO.ltrSideFlipped(2.9, 2.9, 2.9), GEO.ltrSideFlipped(-2.9, -2.9, 2.9), GEO.ltrSideFlipped(2.9, -2.9, 2.9), GEO.ltrSideFlipped(3, -3, 2.9),
  GEO.ltrSideFlipped(-8, 8, 2.9), GEO.ltrSideFlipped(8, 8, 2.9), GEO.ltrSideFlipped(8, 0, 2.9), GEO.ltrSideFlipped(1, -8, 2.9),
  GEO.sgn(2.9, 2.9), GEO.sgn(2.91, 2.9), GEO.sgn(-2.91, 2.9)];
expect("rtl-geom: فرقٌ على حدّ التسامح تمامًا (2.9 قبل وبعد، أو 2.9 ثم ‎-2.9‎) لا يُعدّ انعكاسًا، والانقلاب الحقيقي فوقه يُعدّ، وrtl-audit يحكم به في فرع box-mirrored-ltr",
  same(geoV, [false, false, false, true, true, false, false, false, 0, 1, -1]) &&
  /if \(!ltrSideFlipped\(d0, d1, tol\)\) continue;[^\n]*\n\s*const mag = Math\.abs\(d0\);\n\s*add\(\{ check: "box-mirrored-ltr"/.test(audSrc) &&
  /^import \{ sgn, ltrSideFlipped, sideNotMirrored, insideAtRest, islandDrift \} from "\.\/rtl-geom\.mjs";$/m.test(audSrc) && !/^const sgn = /m.test(audSrc), JSON.stringify(geoV));
// ★ (ر18، ٨ جمادى الأولى ١٤٤٨هـ — ما حمله ر16-ج) وفرع box-not-mirrored بالحكم نفسه: فرقٌ على حدّ التسامح تمامًا (2.9 قبل وبعد، أو 0.9 في الحدّ) لا يُعدّ «لم ينعكس»،
// وما بقي على جهته فوقه يُعدّ، وما انقلب أو صار متناظرًا لا — وrtl-audit يحكم به لا بـ‎|d0| < tol‎
const nmV = [GEO.sideNotMirrored(2.9, 2.9, 2.9), GEO.sideNotMirrored(-2.9, 0, 2.9), GEO.sideNotMirrored(0.9, 0.9, 0.9), GEO.sideNotMirrored(3, 3, 2.9),
  GEO.sideNotMirrored(-8, -6, 2.9), GEO.sideNotMirrored(8, -8, 2.9), GEO.sideNotMirrored(8, 0, 2.9), GEO.sideNotMirrored(1, 1, 2.9), GEO.sideNotMirrored(1, 0.95, 0.9)];
expect("rtl-geom (ر18): فرع box-not-mirrored — فرقٌ على حدّ التسامح تمامًا لا يُعدّ «لم ينعكس»، وما بقي على جهته فوقه يُعدّ، والمنقلب والمتناظر لا؛ وrtl-audit يحكم به",
  same(nmV, [false, false, false, true, true, false, false, false, true]) &&
  /if \(!sideNotMirrored\(d0, d1, tol\)\) continue;/.test(audSrc) && !/if \(Math\.abs\(d0\) < tol\) continue;/.test(audSrc), JSON.stringify(nmV));
// ★ (ر24-ب1، ١٢ جمادى الأولى ١٤٤٨هـ) وحكم الخروج عن عرض الصفحة «في الراحة» (insideAtRest): الصفحة RTL التي يفتحها كروم الجوال مُمرَّرةً إلى طرفها
// الأيسر (‎scrollX = −75‎) تُقاس بعد ردّ التمرير — عنصرٌ في الإطار 286–400 داخلٌ (211–325 في الراحة)، وكذلك 107–457 (32–382)، وما في فسحة الفيض اليسرى
// (5–65 في الإطار: ‎−70 – −10‎ في الراحة) خارج، وما يملأ الإطار المُمرَّر (0–390) خارجٌ في الراحة؛ وبلا تمريرٍ الحكم هو هو بتسامح بكسلٍ في الجهتين. والنصّ
// المُمرَّر إلى الصفحة (toString) يحكم كالدالة نفسها، والجامع يحكم به (ويُمرِّر له التمرير صفرًا في السلف الثابت) لا بمستطيل الإطار كما هو
const restArgs = [[286, 400, -75, 390], [107, 457, -75, 390], [5, 65, -75, 390], [0, 390, -75, 390], [0, 390, 0, 390], [-1, 391, 0, 390], [-1.5, 300, 0, 390], [10, 391.5, 0, 390]];
const restV = restArgs.map((a) => GEO.insideAtRest(...a));
const restSrc = (0, eval)("(" + GEO.insideAtRest.toString() + ")");
expect("rtl-geom (ر24-ب1): الخروج عن عرض الصفحة يُحكم به «في الراحة» — الصفحة RTL المُمرَّرة إلى طرفها الأيسر في محاكاة الجوال تُقاس بعد ردّ تمريرها، وبلا تمريرٍ الحكم هو هو؛ والجامع يحكم به",
  same(restV, [true, true, false, false, true, true, false, false]) && same(restArgs.map((a) => restSrc(...a)), restV) &&
  /^function COLLECT\(o, inRest\) \{$/m.test(audSrc) && /if \(inRest\(r\.left, r\.right, sx && !fixedIn\(el\) \? sx : 0, vw\)\) return 0;/.test(audSrc) &&
  /getComputedStyle\(a\)\.position === "fixed"/.test(audSrc) && /\+ ", " \+ insideAtRest\.toString\(\) \+ "\)", 120000\)/.test(audSrc) &&
  !/if \(r\.left >= -1 && r\.right <= vw \+ 1\) return 0;/.test(audSrc), JSON.stringify(restV));
// ★ (ر27، ٢٠ جمادى الأولى ١٤٤٨هـ — ما وجده مراجع ت10-هـ2ب، reports/T10H2.md §٥) إيقاف التشغيل بلا ‎--keep-going‎ (stopsRun في rtl-baseline.mjs): صفحة
// التحقّق (Cloudflare، ‎entry.challenge‎) لا توقفه وإن ذكرت رسالتها «كروم بلا واجهة» — كانت تطابق ‎/CDP|كروم/‎ فيتوقف ‎--gate‎ كلما حُجبت صفحة الدخول بعرض 390،
// والبوابة لا تعدّها صفحةً أخفقت —، وإخفاق كروم أو CDP يوقفه كما كان («مهلة CDP: …» و«لم أجد كروم …» بنصّيهما في rtl-audit)، وخطأٌ غيرهما لا؛ وrtl-audit
// يحكم به في سطر الإيقاف لا بالتعبير القديم. والرسالتان من نصّ rtl-audit نفسه (لا نسخةٌ هنا)، وتشغيلٌ حيّ على صفحتي تحقّقٍ محليتين في قسم كروم أدناه
const chlMsgs = [...audSrc.matchAll(/entry\.error = ((?:`[^`]*`|"[^"]*")(?:\s*\+\s*(?:`[^`]*`|"[^"]*"))*);/g)].map((m) => m[1])
  .filter((t) => /صفحة تحقّق Cloudflare/.test(t)).map((t) => t.replace(/\$\{[^}]*\}/g, "…").replace(/`\s*\+\s*`/g, "").replace(/^[`"]|[`"]$/g, ""));
const cdpMsgs = [(audSrc.match(/rej\(new Error\("(مهلة CDP: )" \+ method\)\)/) || [])[1] + "Runtime.evaluate", (audSrc.match(/throw new Error\("(لم أجد كروم[^"]*)"\)/) || [])[1]];
const stopV = [...chlMsgs.map((m) => RB.stopsRun({ error: m, challenge: { ref: false, ext: true } })), ...cdpMsgs.map((m) => RB.stopsRun({ error: m })),
  RB.stopsRun({ error: "المحرّك لم يعمل على الصفحة (data-cml≠on)" }), RB.stopsRun({ error: null }), RB.stopsRun({ error: "مهلة CDP: Page.navigate", challenge: null })];
expect("rtl-audit (ر27): صفحة التحقّق (Cloudflare) لا توقف التشغيل بلا ‎--keep-going‎ ورسالتها تذكر «كروم بلا واجهة»، وإخفاق كروم أو CDP يوقفه، وخطأٌ غيرهما لا؛ وسطر الإيقاف يحكم بـstopsRun",
  chlMsgs.length === 2 && chlMsgs.every((m) => /كروم بلا واجهة/.test(m) && /CDP|كروم/.test(m)) && cdpMsgs.every((m) => /^(مهلة CDP: Runtime\.evaluate|لم أجد كروم)/.test(m || "")) &&
  same(stopV, [false, false, true, true, false, false, true]) &&
  /^import \{ stopsRun \} from "\.\/rtl-baseline\.mjs";$/m.test(audSrc) && /if \(!flag\("keep-going"\) && stopsRun\(entry\)\) throw new Error\(entry\.error\);/.test(audSrc) &&
  !/\/CDP\|كروم\/\.test\(entry\.error\)/.test(audSrc), JSON.stringify(stopV) + " " + chlMsgs.length);
// ثم تشغيلاتٌ لا تُقاس فيها صفحة (--pages بعروضٍ فارغة، و--plan): مستودعٌ مصغَّر في مجلدٍ مؤقت بوصلتين إلى الإضافة والأدوات في النسخة، فيعمل rtl-audit كما
// في مستودعه في أي بنية؛ ولكل تشغيلٍ مجلدُ نظامٍ مؤقت خاصّ (TMPDIR) يُرى فيه ما بقي بعد الخروج. ★ طفرتا مراجعة ر16-ب (رفع رفض الكتابة، وترك الحذف عند
// الخروج) نجتا من كل بوابة، وهذه تكشفهما
const AREPO = fs.mkdtempSync(path.join(os.tmpdir(), "cml-selftest-arepo-"));
process.on("exit", () => { try { fs.rmSync(AREPO, { recursive: true, force: true }); } catch {} });
fs.mkdirSync(path.join(AREPO, "web", "user"), { recursive: true }); fs.mkdirSync(path.join(AREPO, "web", "code"), { recursive: true });
fs.symlinkSync(inBox(EXT), path.join(AREPO, "web", "user", "extension"), "junction");
fs.symlinkSync(inBox(HERE), path.join(AREPO, "web", "code", "toolchain"), "junction");
const zqPagesFile = (tag, list) => { const f = path.join(BOX, "zq-pages-" + tag + ".json"); fs.writeFileSync(f, JSON.stringify(list)); return f; };
const audRun = (args, tag) => {
  const tmp = fs.mkdtempSync(path.join(BOX, "zq-tmp-" + tag + "-")), out = path.join(BOX, "zq-aud-" + tag);
  // والإضافة بمسارها الحقيقي (--ext) ما لم يُمرَّر غيره: الوصلة نفسها تُنسخ وصلةً (fs.cpSync لا يتبعها)
  const ext = args.some((a) => a.startsWith("--ext=")) ? [] : ["--ext=" + inBox(EXT)];
  const r = spawnSync(process.execPath, [T("rtl-audit.mjs"), "--repo=" + AREPO, "--no-shots", "--out=" + out, ...ext, ...args],
    { cwd: BOX, encoding: "utf8", timeout: 120000, env: Object.assign({}, process.env, { TMPDIR: tmp, TMP: tmp, TEMP: tmp }) });
  let res = null; try { res = JSON.parse(fs.readFileSync(path.join(out, "rtl-audit-results.json"), "utf8")); } catch {}
  return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), tmp, res, left: fs.readdirSync(tmp).filter((n) => /^cml-rtlaudit-on-/.test(n)) };
};
const pOn = zqPagesFile("on", [{ d: "com", tag: "zq-on", url: "https://claude.com/zq", widths: [] }]);
const a1 = audRun(["--pages=" + pOn], "on"), sw1 = a1.res && a1.res.switchedOn && a1.res.switchedOn.com;
// ★ (ر28-ب، ٢٠ جمادى الأولى ١٤٤٨هـ — السؤال 2 على افتراضه) ومانيفست الحزمة لا يحمل مدخل claude.com، فتضيفه النسخة من صفّه المشغَّل بمولّد البناء: مطابقتُه
// وسكربتاته بقاموسه قبل المحرّك وأوراقه base.css ثم rtl-com.css ثم com-point.css (ما كان _comcsstest يقرؤه من مانيفست الحزمة)
const a1Mf = JSON.parse(fs.readFileSync(path.join(inBox(EXT), "manifest.json"), "utf8"));
expect("rtl-audit: النطاق القادم يُفحص بنسخةٍ مشغَّلة تُبنى في مجلد النظام المؤقت وتُتحقَّق ({full: true} ونصوصها التجريبية الثمانية، والإعلان في الخرج وملف النتائج)، ويُضاف إلى مانيفستها مدخلُه المحجوب عن الحزمة بمولّد البناء، ثم تُحذف عند الخروج",
  a1.code === 0 && /⚑ نطاقٌ قادم يُفحص مشغَّلًا: com/.test(a1.out) && !!sw1 && !!sw1.status && sw1.status.full === true && sw1.dummyStrings === 8 &&
  typeof sw1.dir === "string" && path.dirname(sw1.dir) === a1.tmp && /^cml-rtlaudit-on-/.test(path.basename(sw1.dir)) && !fs.existsSync(sw1.dir) &&
  a1.left.length === 0 && a1.res.totals.pages === 0 &&
  same(sw1.entry, { matches: ["https://claude.com/*"], js: ["cml-const.js", "cml-shared.js", "cml-rtl.js", "cml-font.js", "dict-com.js", "engine.js"],
    css: ["base.css", "rtl-com.css", "com-point.css"] }) &&
  !a1Mf.content_scripts.some((cs) => cs.matches.includes("https://claude.com/*")),
  a1.code + " " + JSON.stringify(sw1) + " left=" + a1.left + " " + a1.out.slice(-300));
// ونسخةٌ لا يصير فيها النطاق مشغَّلًا تُرفض: صفُّه قادمٌ بكتابةٍ أخرى، والنصّ الذي يبدّله الاستبدال في تعليقٍ بعده — فالتحقّق بالجدول المحمَّل لا بالنص
const BADEXT = path.join(BOX, "zq-ext-bad");
fs.cpSync(inBox(EXT), BADEXT, { recursive: true });
let badSrc = fs.readFileSync(path.join(BADEXT, "cml-const.js"), "utf8");
const comAt = badSrc.indexOf('{ id: "com"'), stAt = comAt < 0 ? -1 : badSrc.indexOf("status: { upcoming: true },", comAt);
if (stAt > 0) badSrc = badSrc.slice(0, stAt) + "status: {upcoming: true}, // status: { upcoming: true }" + badSrc.slice(stAt + "status: { upcoming: true },".length);
fs.writeFileSync(path.join(BADEXT, "cml-const.js"), badSrc);
const a2 = audRun(["--pages=" + pOn, "--ext=" + BADEXT], "bad");
expect("rtl-audit: نسخةٌ لا يصير فيها النطاق القادم مشغَّلًا تُرفض قبل أي تشغيل (التحقّق بالجدول المحمَّل)، ولا يبقى منها شيء ولا ملف نتائج",
  stAt > comAt && comAt > 0 && a2.code !== 0 && a2.code !== null && /ما زال قادمًا/.test(a2.out) && a2.left.length === 0 && !a2.res, a2.code + " " + a2.out.slice(-300));
// ورفض --write-baseline: بعد تشغيلٍ جزئي (--widths أو --only) برمز 2، وبعد صفحةٍ أخفقت برمز 1 (كرومٌ بمسارٍ غير موجود فلا يُشغَّل شيء) — والملف
// مكتوبٌ مضغوطًا فأي كتابةٍ عليه تغيّر بايتاته
const zqBase = path.join(BOX, "zq-baseline.json");
const zqBaseText = JSON.stringify({ at: "zq", commit: "zq0", extVersion: "0.0.0", fps: [{ fp: "zq1", sev: "low", d: "support", check: "zq-check", sel: "div.zq", count: 1 }] }) + "\n";
fs.writeFileSync(zqBase, zqBaseText);
const pZero = zqPagesFile("zero", [{ d: "support", tag: "zq-zero", url: "https://support.claude.com/en/zq", widths: [] }]);
const pFail = zqPagesFile("fail", [{ d: "support", tag: "zq-fail", url: "https://support.claude.com/en/zq", widths: [1366] }]);
const wbArgs = ["--write-baseline", "--baseline=" + zqBase, "--decisions=" + path.join(BOX, "zq-no-decisions.json")];
const wb = [["--pages=" + pZero, "--widths=1366"], ["--pages=" + pZero, "--only=zq"]].map((x, i) => audRun([...x, ...wbArgs], "wb" + i));
const wf = audRun(["--pages=" + pFail, "--chrome=" + path.join(BOX, "zq-no-chrome"), ...wbArgs], "wf");
expect("rtl-audit --write-baseline: يرفض بعد تشغيلٍ جزئي (--widths أو --only) برمز 2، وبعد صفحةٍ أخفقت برمز 1، ولا يتغيّر بايتٌ من خطّ الأساس",
  wb.every((r) => r.code === 2 && /لا يُكتب خطّ الأساس من فحصٍ جزئي/.test(r.out)) && wf.code === 1 && /صفحة أخفقت/.test(wf.out) &&
  fs.readFileSync(zqBase, "utf8") === zqBaseText, wb.map((r) => r.code).join(",") + "/" + wf.code + " " + wf.out.slice(-240));
// وخطة OPT_IN (--plan: الخطة وحدها ثم الخروج): claude.com خارج التشغيل الافتراضي، وداخلٌ بـ--domains=com وحده بصفحاته (ومنها ‎/product/cowork‎
// بعرضين — ر16-ج)، وبملف --pages الصريح؛ ولا نسخةٌ مشغَّلة في أيٍّ منها
const planOf = (args, tag) => { const r = audRun(["--plan", ...args], tag); let j = null; try { j = JSON.parse(r.out.trim().split("\n").pop()); } catch {} return { r, j }; };
const pl = [planOf([], "p0"), planOf(["--domains=com"], "p1"), planOf(["--pages=" + pOn], "p2")];
const plDoms = (j) => (j && Array.isArray(j.pages) ? [...new Set(j.pages.map((p) => p.d))].sort().join(",") : "?");
const plCw = pl[1].j && pl[1].j.pages.find((p) => p.tag === "product-cowork");
expect("rtl-audit: خطة OPT_IN — claude.com خارج التشغيل الافتراضي (النطاقات السبعة وحدها)، وداخلٌ بـ--domains=com وحده (ومنه ‎/product/cowork‎ بعرضين) وبملف --pages الصريح، بلا نسخةٍ مشغَّلة",
  plDoms(pl[0].j) === "academy,app,code,docs,legal,privacy,support" && same(pl[0].j.upcoming, []) && same(pl[0].j.optIn, ["com"]) &&
  plDoms(pl[1].j) === "com" && same(pl[1].j.upcoming, ["com"]) && !!plCw && same(plCw.widths, [1366, 390]) && plDoms(pl[2].j) === "com" &&
  pl.every((x) => x.r.code === 0 && x.r.left.length === 0 && !/⚑/.test(x.r.out)), pl.map((x) => plDoms(x.j)).join(" | ") + " " + JSON.stringify(plCw));

// (١٥) ★ (ر17، ٨ جمادى الأولى ١٤٤٨هـ) com-harvest.mjs: أدوات حصاد claude.com بلا شبكةٍ ولا كروم، بمساراتٍ وقوالب اصطناعية («zq»، لا نصَّ من الموقع)
const CH = await import(pathToFileURL(T("com-harvest.mjs")).href);
// القائمة والعائلات وترتيب CM: exact كلّها، والإنجليزية تحت routes.full وحدها، وعيّنة هيكلٍ لكل بادئة ليست كاملة؛ ولا مسارٌ خامل
const zqExact = ["/", "/zq-pricing", "/product/zq", "/solutions/zq", "/partners/zq", "/contact-sales/zq", "/resources", "/resources/articles", "/resources/articles/zq-a", "/customers", "/customers/zq-c"];
const zqEng = zqExact.concat(["/marketplace", "/marketplace/plugins", "/marketplace/connectors/zq-1", "/marketplace/plugins/zq-2", "/marketplace/agents-products/zq-3", "/customers/zq-shell", "/resources/guides/zq-g", "/docs/zq"]);
const zl = CH.buildList({ exact: zqExact, english: zqEng, full: ["/marketplace/"], shell: ["/customers/", "/resources/"] });
expect("com-harvest list: العائلات بترتيب CM (الرئيسة… الفهارس ← السوق ← المقالات ← القصص ← عيّنة الهيكل)، والسوق من الخريطة تحت routes.full وحدها، وعيّنة الهيكل لا تكون صفحةً كاملة، ولا مسارٌ خامل",
  same(zl.items.map((x) => x.family + ":" + x.path), ["home:/", "singles:/zq-pricing", "product:/product/zq", "solutions:/solutions/zq", "partners:/partners/zq", "forms:/contact-sales/zq",
    "indexes:/customers", "indexes:/resources", "indexes:/resources/articles", "mkt-index:/marketplace", "mkt-index:/marketplace/plugins", "mkt-connector:/marketplace/connectors/zq-1",
    "mkt-plugin:/marketplace/plugins/zq-2", "mkt-agent:/marketplace/agents-products/zq-3", "articles:/resources/articles/zq-a", "customers:/customers/zq-c",
    "shell:/customers/zq-shell", "shell:/resources/guides/zq-g"]) && zl.counts.full === 16 && zl.counts.marketplace === 5 && zl.counts.shell === 2 && zl.counts.exact === 11,
  JSON.stringify(zl.items.map((x) => x.family + ":" + x.path)));
// بوابة القائمة: هبوط السوق 10٪ يُقبل وفوقه يُرفض إلا بقرار، وقائمةٌ لا تحمل كتلة com-routes بعددها تُرفض ولو بقرار، والفارغة تُرفض
const cnt = (full, marketplace, exact) => ({ counts: { full, marketplace, exact } });
const lg = [CH.listGate(cnt(100, 80, 20), cnt(92, 72, 20), { exactMeta: { exact: 20 } }), CH.listGate(cnt(100, 80, 20), cnt(91, 71, 20), { exactMeta: { exact: 20 } }),
  CH.listGate(cnt(100, 80, 20), cnt(91, 71, 20), { exactMeta: { exact: 20 }, acceptDrop: true }), CH.listGate(null, cnt(100, 80, 19), { exactMeta: { exact: 20 }, acceptDrop: true }),
  CH.listGate(null, cnt(0, 0, 0), { acceptDrop: true })];
expect("com-harvest list: البوابة — هبوط 10٪ يُقبل، وفوقه يُرفض إلا بـ--accept-drop، ومسارات exact بغير عدد كتلة com-routes تُرفض ولو بقرار، والقائمة الفارغة تُرفض",
  lg[0].ok && !lg[1].ok && lg[2].ok && !lg[3].ok && !lg[4].ok, JSON.stringify(lg.map((g) => g.why)));
// المصنِّف: المحاذاة بالموضع (LCS) لا مجرّد الوجود — كتلةٌ قصيرة باقيةٌ بالعدّ في موضعٍ آخر تُترجم وتُعدّ ملتبسة؛ ومترجمةٌ إن ترجمتها إحدى النسختين؛ وتكرارها بعدده
const cp1 = CH.classifyPage(["zqS", "zqK", "zqT"], [["zqK", "zqT", "zqS"]]);
expect("com-harvest classify: كتلةٌ باقيةٌ في الصفحة المترجمة في غير موضعها (بعد كتلتين محاذاتين) مترجمةٌ وملتبسة، والمحاذاتان مُبقاتان",
  cp1.verdict.get("zqS") === "translated" && cp1.verdict.get("zqK") === "kept" && cp1.verdict.get("zqT") === "kept" && same([...cp1.ambiguous], ["zqS"]),
  JSON.stringify([[...cp1.verdict], [...cp1.ambiguous]]));
const cp2 = CH.classifyPage(["zqA", "zqB", "zqC", "zqD", "zqA"], [["zqA", "zqX", "zqC", "zqY", "zqZ"], ["zqA", "zqB2", "zqC", "zqD", "zqA"]]);
const cp3 = CH.classifyPage(["zqA", "zqC"], [["zqA", "zqC2"]]), cp4 = CH.classifyPage(["zqA"], []);
const cv = CH.combineVerdicts([new Map([["zqA", "kept"], ["zqE", "kept"], ["zqF", "unverified"]]), new Map([["zqA", "translated"], ["zqE", "unverified"], ["zqF", "unverified"]])]);
expect("com-harvest classify: مترجمةٌ إن ترجمتها إحدى النسختين (zqD)، وتكرارٌ تُرجم أحد موضعيه مترجم (zqA)، والباقية في النسختين مُبقاة (zqC)؛ والصفحة بنسخةٍ واحدة تُحكم بها، وبلا نسخةٍ غير متحقَّقة؛ وعبر الصفحات تغلب الترجمة ثم الإبقاء",
  cp2.verdict.get("zqA") === "translated" && cp2.verdict.get("zqB") === "translated" && cp2.verdict.get("zqC") === "kept" && cp2.verdict.get("zqD") === "translated" &&
  cp3.verdict.get("zqA") === "kept" && cp3.verdict.get("zqC") === "translated" && cp4.verdict.get("zqA") === "unverified" &&
  cv.get("zqA") === "translated" && cv.get("zqE") === "kept" && cv.get("zqF") === "unverified", JSON.stringify([[...cp2.verdict], [...cp3.verdict], [...cv]]));
// السمات قيمةً قيمة بعددها: سمةٌ مكرّرة تُرجم أحد موضعيها في نسخةٍ مترجمة؛ وalt الباقية في النسختين مُبقاة؛ وplaceholder ترجمته نسخةٌ واحدة مترجمة
const it = (zone, kind, key) => ({ zone, kind, key });
const ci = CH.classifyItems([it("body", "attr:aria-label", "Zq close"), it("body", "attr:aria-label", "Zq close"), it("body", "attr:alt", "Zq logo"), it("ui", "attr:placeholder", "Zq search")],
  [[it("body", "attr:aria-label", "Zq close"), it("body", "attr:alt", "Zq logo")], [it("body", "attr:aria-label", "Zq close"), it("body", "attr:aria-label", "Zq close"), it("body", "attr:alt", "Zq logo"), it("ui", "attr:placeholder", "Zq search")]]);
const civ = (z, k, v) => ci.get(z + "\u0000" + k + "\u0000" + v);
expect("com-harvest classify: السمات قيمةً قيمة بالعدد — aria-label مكرّرةٌ بقي منها واحدٌ في نسخة: مترجمة؛ وalt الباقية في النسختين: مُبقاة؛ وplaceholder مترجمةٌ في نسخة: مترجمة",
  civ("body", "attr:aria-label", "Zq close") === "translated" && civ("body", "attr:alt", "Zq logo") === "kept" && civ("ui", "attr:placeholder", "Zq search") === "translated", JSON.stringify([...ci]));
// اختيار النسختين (رتبٌ لا رموز)، وlang، وانتظار الإعادة يحترم Retry-After، وميزانية الإخفاق عند حدّها
const zr = ["zqa", "zqb", "zqc", "zqd", "zqe"];
expect("com-harvest classify: النسختان بالرتبة المطلوبة إن توفّرتا ثم الباقي احتياطًا، و<html lang> بالرمز أو لغته الأولى، وRetry-After بالثواني والتاريخ ثم التضاعف بسقف، وميزانية الإخفاق 1٪ يُقبل وفوقها يُرفض إلا بقرار",
  same(CH.versionOrder(new Set(["zqb", "zqd", "zqe"]), zr, [1, 2]), ["zqb", "zqd", "zqe"]) && same(CH.versionOrder(new Set(zr), zr, [1, 5]), ["zqa", "zqe", "zqb", "zqc", "zqd"]) &&
  CH.langMatches("ZQA-xx", "zqa") && !CH.langMatches("zqb", "zqa") && !CH.langMatches("", "zqa") &&
  CH.backoffMs(0, "7") === 7000 && CH.backoffMs(0, new Date(Date.UTC(2099, 0, 1, 0, 0, 9)).toUTCString(), { now: Date.UTC(2099, 0, 1) }) === 9000 &&
  CH.backoffMs(0, null) === 1500 && CH.backoffMs(3, "") === 12000 && CH.backoffMs(9, null) === 60000 && CH.backoffMs(0, "600") === 60000 &&
  CH.errorGate(1, 100).ok && !CH.errorGate(2, 100).ok && CH.errorGate(2, 100, { acceptErrors: true }).ok && CH.errorGate(0, 0).ok,
  JSON.stringify([CH.versionOrder(new Set(zr), zr, [1, 5]), CH.backoffMs(0, "7"), CH.backoffMs(3, "")]));
// مدخلات الواجهة: القالب يجرّد الاسم والرابط والشهر والسنة والأعداد؛ والنمط ما رُئي بقيمٍ مختلفة في ثلاث صفحاتٍ فأكثر؛ والمرجع من القواميس
const mrow = (tpl, page, value, kind = "attr:aria-label") => ({ tpl, page, value, kind });
const mp = CH.marketPatterns([mrow("Zq copy {name} link", "p1", "Zq copy Zqa link"), mrow("Zq copy {name} link", "p2", "Zq copy Zqb link"), mrow("Zq copy {name} link", "p3", "Zq copy Zqc link"),
  mrow("Zq used {n} times", "p1", "Zq used 3 times"), mrow("Zq used {n} times", "p2", "Zq used 5 times"), mrow("Zq same {n}", "p1", "Zq same 1"), mrow("Zq same {n}", "p2", "Zq same 1"), mrow("Zq same {n}", "p3", "Zq same 1"),
  mrow("{name}", "p1", "Zqa", "attr:alt"), mrow("{name}", "p2", "Zqb", "attr:alt"), mrow("{name}", "p3", "Zqc", "attr:alt"),
  mrow("Zq added {date}", "p1", "Zq added May 2025", "text"), mrow("Zq added {date}", "p2", "Zq added June 2024", "text"), mrow("Zq added {date}", "p3", "Zq added July 2023", "text")]);
expect("com-harvest ui: القالب يجرّد الاسم والرابط والشهر والسنة والأعداد؛ والنمط في ثلاث صفحاتٍ فأكثر بقيمٍ مختلفة (لا نمط في صفحتين ولا بقيمةٍ واحدة ولا اسمٌ وحده)، والتاريخ بملاحظة RULES §2؛ والمرجع من القواميس المشحونة",
  CH.templateOf("Zq install Zqa: https://zq.example/x?y=1 since March 2025, 1,234 users", { names: ["Zqa"] }) === "Zq install {name}: {url} since {date}, {n} users" &&
  same(mp.map((p) => p.en + "/" + p.count), ["Zq added {date}/3", "Zq copy {name} link/3"]) && mp.every((p) => p.ar === "" && p.bounded === true) && /RULES §2/.test(mp[0].note || "") &&
  same(CH.refOf("Zq Settings", [["ar.json", { "Zq Settings": "إعداداتٌ تجريبية" }]]), { ref: "إعداداتٌ تجريبية", refFrom: "ar.json" }) && CH.refOf("Zq none", [["ar.json", {}]]) === null,
  JSON.stringify([CH.templateOf("Zq install Zqa: https://zq.example/x?y=1 since March 2025, 1,234 users", { names: ["Zqa"] }), mp]));
// التقسيم: كتل الصفحة متجاورة، والمشتركة في جزء أول صفحةٍ لها، ومجموعات CM لا تجتمع في جزء، وبطاقات «ذات صلة» جزءٌ واحد أول السوق، والصفحة الأطول من 1.2×الحدّ
// تُقسم وحدها؛ والمراحل أربعة أجزاءٍ فأقل لا تعبر مجموعة
const w = (n, tag) => Array.from({ length: n }, (_, i) => "zq" + tag + i).join(" ");
const zinfo = new Map(), zst = (fp, n, status = "TRANSLATE") => zinfo.set(fp, { tpl: w(n, fp), status });
zst("a", 40); zst("b", 40); zst("c", 40); zst("k", 40, "kept"); zst("d", 150); zst("q1", 40); zst("q2", 40); zst("q3", 40); zst("q4", 40); zst("q5", 40);
zst("e", 30); zst("f", 30); zst("g", 30); zst("r", 20, "related"); zst("h", 50);
const zpages = [{ pk: "/", family: "home", fps: ["a", "k", "b"] }, { pk: "/zq-s", family: "singles", fps: ["c", "a"] }, { pk: "/product/zq", family: "product", fps: ["d"] },
  { pk: "/solutions/zq", family: "solutions", fps: ["q1", "q2", "q3", "q4", "q5"] }, { pk: "/marketplace/connectors/zq-1", family: "mkt-connector", fps: ["e", "r"] },
  { pk: "/marketplace/connectors/zq-2", family: "mkt-connector", fps: ["f", "r"] }, { pk: "/marketplace/plugins/zq-3", family: "mkt-plugin", fps: ["g"] },
  { pk: "/resources/articles/zq-a", family: "articles", fps: ["h"] }];
const zp = CH.planParts(zpages, zinfo, { max: 100 });
const shape = zp.parts.map((p) => p.group + ":" + p.kind + ":" + p.items.join(","));
const zs = CH.planStages(zp.parts, { first: 2 });
expect("com-harvest chunk: كتل الصفحة متجاورة والمشتركة في جزء أول صفحةٍ لها، والمُبقاة خارجها، ومجموعات CM لا تجتمع، و«ذات صلة» جزءٌ واحد أول السوق، والصفحة الأطول من 1.2×الحدّ وحدها تُقسم؛ والمراحل أربعة أجزاءٍ فأقل لا تعبر مجموعة",
  same(shape, ["main:pages:a,b", "main:pages:c", "main:pages:d", "main:pages:q1,q2,q3", "main:pages:q4,q5", "marketplace:related:r", "marketplace:pages:e,f,g", "articles:pages:h"]) &&
  zp.parts[4].split["/solutions/zq"] === true && zp.owner.get("a") === "com-000" && !zp.owner.has("k") && same(zp.parts[5].pages, ["/marketplace/connectors/zq-1"]) &&
  same(zs.map((s) => s.stage + ":" + s.ids.length + ":" + s.group), ["CM2:4:main", "CM3:1:main", "CM4:2:marketplace", "CM5:1:articles"]) && zs.every((s) => s.hours[1] <= 2),
  JSON.stringify([shape, zs.map((s) => [s.stage, s.ids, s.group])]));
expect("com-harvest chunk: حال البصمة — المُبقاة، ثم ما لا كلمة لاتينية فيه خارج الشيفرة، ثم المتكرّرة في 20 صفحةً (CM1)، ثم «ذات صلة» في صفحتين من السوق، ثم للترجمة",
  CH.statusOf("x", { verdict: "kept", tpl: "Zq words", pagesN: 1, mktPagesN: 0 }) === "kept" && CH.statusOf("x", { verdict: "translated", tpl: "<c1>zq_code</c1> 42", pagesN: 1, mktPagesN: 0 }) === "symbols" &&
  CH.statusOf("x", { verdict: "translated", tpl: "Zq banner", pagesN: 20, mktPagesN: 20 }) === "ui-repeated" && CH.statusOf("x", { verdict: "translated", tpl: "Zq banner", pagesN: 19, mktPagesN: 2 }) === "related" &&
  CH.statusOf("x", { verdict: "unverified", tpl: "Zq words", pagesN: 1, mktPagesN: 1 }) === "TRANSLATE", "statusOf");
// الأداة كلها بلا شبكة على حصادٍ اصطناعي (chunk ثم ui): أجزاءٌ يقبلها validate-batch --mode=block بدفعةٍ اصطناعية وترفض الناقصة، ومدخلات CM1 بصيغة مراحل الواجهة
const CHO = path.join(BOX, "com-harvest-out"), CHD = path.join(BOX, "com-harvest-in");
const zqB = (t) => ({ fp: SH.blockFp(t), tpl: t });
const B1 = zqB("Zq first paragraph of the zq home page."), B2 = zqB("Zq second <a1>link</a1> paragraph."), B3 = zqB("Zq kept product name"), B4 = zqB("Zq connector description words.");
writeJson(path.join(CHD, "list.json"), { items: [{ path: "/", family: "home", mode: "full" }, { path: "/marketplace/connectors/zq-1", family: "mkt-connector", mode: "full" }] });
writeJson(path.join(CHD, "blocks-20990101T0000.json"), { domain: "com", pages: { "/": [B1.fp, B2.fp, B3.fp], "/marketplace/connectors/zq-1": [B4.fp, B3.fp] },
  urls: { "/": "https://claude.com/", "/marketplace/connectors/zq-1": "https://claude.com/marketplace/connectors/zq-1" }, blocks: [B1, B2, B3, B4].map((b) => ({ ...b, count: 1, pages: [], status: "todo" })) });
writeJson(path.join(CHD, "classified.json"), { blocks: { [B1.fp]: "translated", [B2.fp]: "translated", [B3.fp]: "kept", [B4.fp]: "unverified" }, pages: { "/": { titleKept: false } },
  items: [{ zone: "ui", kind: "text", key: "Zq Pricing", v: "translated" }, { zone: "ui", kind: "text", key: "Zq Brand", v: "kept" }] });
writeJson(path.join(CHD, "harvest-20990101T0000.json"), { domain: "com", pages: [{ url: "https://claude.com/", final: "https://claude.com/", mode: "full", keys: 3, title: "Zq Home | Claude by Anthropic" }],
  keys: [{ key: "Zq Pricing", kinds: ["text"], count: 2, zone: "ui", pages: ["https://claude.com/"] }, { key: "Zq Brand", kinds: ["text"], count: 2, zone: "ui", pages: ["https://claude.com/"] }] });
const chArgs = ["--list=" + path.join(CHD, "list.json"), "--blocks=" + path.join(CHD, "blocks-20990101T0000.json"), "--classified=" + path.join(CHD, "classified.json"), "--out=" + CHO];
const chk = run([T("com-harvest.mjs"), "chunk", ...chArgs]);
const chu = run([T("com-harvest.mjs"), "ui", ...chArgs, "--harvest=" + path.join(CHD, "harvest-20990101T0000.json")]);
const part0 = path.join(CHO, "_blk_todo", "p4", "com-000.json");
let p0 = null; try { p0 = JSON.parse(fs.readFileSync(part0, "utf8")); } catch {}
const synth = (arr) => arr.map((x) => ({ fp: x.fp, src: x.src, ar: x.src.replace(/<(\/?)a1>/g, "\u0000$1").replace(/[^\u0000<>/]+/g, "نصٌّ تجريبي").replace(/\u0000(\/?)/g, "<$1a1>") }));
const goodB = path.join(BOX, "zq-synth-good.json"), badB = path.join(BOX, "zq-synth-bad.json");
if (p0) { writeJson(goodB, synth(p0)); writeJson(badB, synth(p0).slice(1)); }
const vg = run([T("validate-batch.mjs"), "--mode=block", part0, goodB]), vb = run([T("validate-batch.mjs"), "--mode=block", part0, badB]);
let kai = null, uiT = null, man = null; try { kai = JSON.parse(fs.readFileSync(path.join(CHO, "_blk_todo", "kept-as-is.json"), "utf8")); uiT = JSON.parse(fs.readFileSync(path.join(CHO, "_ar_todo", "ui-cm1-todo.json"), "utf8")); man = JSON.parse(fs.readFileSync(path.join(CHO, "_blk_todo", "p4-manifest.json"), "utf8")); } catch {}
expect("com-harvest chunk/ui بلا شبكة: الجزء بصيغة p4 يقبله validate-batch --mode=block بدفعةٍ اصطناعية ويرفض الناقصة، والمُبقاة في kept-as-is لا في جزء، والبيان والسياق والمراحل والموجز مكتوبة؛ ومدخلات CM1 بلا ما تبقيه الشركة، ومعها عنوان التبويب بلا ذيله",
  chk.code === 0 && chu.code === 0 && p0 && same(p0.map((x) => x.fp), [B1.fp, B2.fp]) && vg.code === 0 && vb.code === 1 &&
  kai && same(kai.blocks.map((b) => b.fp + ":" + b.why), [B3.fp + ":company-keeps-en"]) && man && same(man.map((m) => m.id), ["com-000", "com-001"]) &&
  ["p4ctx/com-000.json", "p4-shared.json", "stages.json", "BRIEF.md"].every((f) => fs.existsSync(path.join(CHO, "_blk_todo", f))) &&
  uiT && same(uiT.items.map((x) => x.en + ":" + x.source), ["Zq Pricing:header-footer", "Zq Home:tab-title"]) && uiT.counts.keptByCompany.text === 1 &&
  fs.readFileSync(path.join(CHO, "_ar_todo", "cm1", "U1.txt"), "utf8") === "Zq Pricing\nZq Home\n",
  [chk.code, chu.code, vg.code, vb.code, chk.out.slice(-300), chu.out.slice(-300), vg.out.slice(-200), JSON.stringify(uiT && uiT.items)].join(" | "));
// بوابة الشمول لنطاق com: بلا حصادٍ تُخفق، وبحصادٍ (ملفّان بترتيب زمنهما) وقائمة إبقاءٍ لا تُخفق، وقائمة الإبقاء تُعدّ بلا سبب ui ولا keepOn
const CG = path.join(G, "com");
const cRun = (tag) => { const j = path.join(BOX, "c-com-" + tag + ".json"); const r = run([T("completeness.mjs"), "--domain=com", "--offline", "--json=" + j]); let rep2 = null; try { rep2 = JSON.parse(fs.readFileSync(j, "utf8")); } catch {} return { r, rep: rep2 }; };
const cc0 = cRun("0");
fs.mkdirSync(path.join(CG, "_harvest"), { recursive: true });
fs.copyFileSync(path.join(CHD, "harvest-20990101T0000.json"), path.join(CG, "_harvest", "harvest-20990101T0000.json"));
writeJson(path.join(CG, "_harvest", "harvest-20990102T0000.json"), { domain: "com", pages: [{ url: "https://claude.com/marketplace/connectors/zq-1", final: "https://claude.com/marketplace/connectors/zq-1", mode: "full", keys: 1 }],
  keys: [{ key: "Zq Install", kinds: ["text"], count: 1, zone: "ui", pages: ["https://claude.com/marketplace/connectors/zq-1"] }] });
fs.copyFileSync(path.join(CHD, "blocks-20990101T0000.json"), path.join(CG, "_harvest", "blocks-20990101T0000.json"));
writeJson(path.join(CG, "_blk_todo", "kept-as-is.json"), { blocks: [{ fp: B3.fp, why: "company-keeps-en" }, { fp: B4.fp, why: "ui-cm1" }, { fp: B1.fp, why: "company-keeps-en", keepOn: ["/"] }] });
const cc1 = cRun("1");
const cb = cc1.rep && cc1.rep.domains && cc1.rep.domains.com && cc1.rep.domains.com.text;
expect("completeness --domain=com: بلا حصادٍ تُخفق («لا حصاد DOM»)، وبحصادَي DOM (ملفّان) وحصاد كتلٍ وقائمة إبقاءٍ لا تُخفق؛ والمُستبقى من القائمة كتلتان (إبقاءٌ عامّ، وkeepOn في صفحته الوحيدة — ر24-و)، ولا سبب ui، والباقي اثنتان",
  cc0.rep && cc0.rep.failures.some((f) => f.d === "com" && /لا حصاد DOM/.test(f.msg)) && cc1.rep && cc1.rep.failures.length === 0 &&
  cb && cb.bodies && cb.bodies.keptList === 2 && cb.bodies.keptSource === 2 && cb.bodies.missing === 2 && cb.inventories[0].total === 3,
  JSON.stringify([cc0.rep && cc0.rep.failures, cc1.rep && cc1.rep.failures, cb && cb.bodies, cb && cb.inventories]));
// ★ (ر24-و، ١٢ جمادى الأولى ١٤٤٨هـ — شرط AC-د من ر13-ج) علامات الإبقاء بالصفحة كما يعدّها حارس المتن (قطعة الصفحة تحمل keepPages التي يكتبها merge-blocks):
// قائمة الإبقاء تُقرأ ولو وُجد قاموس كتلٍ فارغ (هيكل الأكاديمية قبل أول دمج)، وسببٌ يبدأ بـui ليس علامة، ومدخلٌ بنطاق صفحةٍ (keepOn) لبصمةٍ في صفحتين مُبقًى
// في صفحته وحدها: ناقصٌ في الأخرى وحدها، فالصفحة التي أُبقيت فيه كاملة (pagesIncomplete 1 لا 2)
writeJson(path.join(CG, "_blk_todo", "kept-as-is.json"), { blocks: [{ fp: B2.fp, why: "company-keeps-en" }, { fp: B4.fp, why: "ui-cm1" },
  { fp: B1.fp, why: "company-keeps-en", keepOn: ["/"] }, { fp: B3.fp, why: "ui-dict", keepOn: ["/"] }] });
const comBD = path.join(inBox(DICTS), "ar-com.blocks.json"), comBD0 = fs.existsSync(comBD) ? fs.readFileSync(comBD) : null;
const cc2 = cRun("2");
writeJson(comBD, { _meta: { domain: "com", count: 0 }, pages: {}, blocks: {}, kept: [], keepPages: {}, harvested: {} });
const cc3 = cRun("3");
if (comBD0) fs.writeFileSync(comBD, comBD0); else fs.rmSync(comBD, { force: true });
const cbOf = (x) => x.rep && x.rep.domains && x.rep.domains.com && x.rep.domains.com.text && x.rep.domains.com.text.bodies;
const kb2 = cbOf(cc2), kb3 = cbOf(cc3);
const kbKey = (b) => b ? [b.keptSource, b.keptList, b.keptPartial, b.viaUi, b.missing, b.pagesIncomplete].join(",") : "?";
expect("completeness (ر24-و): علامات الإبقاء بالصفحة كما يعدّها الحارس — keepOn لبصمةٍ في صفحتين ناقصٌ في الأخرى وحدها (الصفحة المُبقية كاملة)، وسبب ui ليس علامة، والقائمة تُقرأ بلا قاموس كتلٍ ومع هيكله الفارغ سواء",
  kbKey(kb2) === "2,2,1,0,2,1" && kbKey(kb3) === kbKey(kb2), kbKey(kb2) + " | " + kbKey(kb3));
// stage-code-bodies.cloud.js بـdomain=com: موجز الموقع وسياقه ومتونٌ تُترجم أول مرة (لا «الجديد والمتغيّر» الذي للمواقع المنشورة)، والنطاق code كما كان
// (سكربت المراحل من أدوات مستودع التطوير: في بنيةٍ بلا مجلد cloud/ يُذكر الفحص متروكًا ولا يُعدّ، كأداة تغطية الكتالوج)
const STAGE_SCRIPT = path.join(ROOT, "..", "cloud", "stage-code-bodies.cloud.js");
const stageSrc = fs.existsSync(STAGE_SCRIPT) ? fs.readFileSync(STAGE_SCRIPT, "utf8").replace(/^export const meta/m, "const meta") : null;
const runStage = async (args) => {
  const prompts = {};
  const agent = async (prompt, o) => { prompts[o.label] = prompt; return o.label === "plan" ? { done: [], drafted: [], todo: args.ids } : /^translate/.test(o.label) ? "DRAFT OK" : "ok"; };
  const pipeline = async (items, f1, f2) => { const out = []; for (const id of items) out.push(await f2(await f1(id), id)); return out; };
  await new (Object.getPrototypeOf(async function () {}).constructor)("args", "agent", "phase", "log", "pipeline", stageSrc)(args, agent, () => {}, () => {}, pipeline);
  return prompts;
};
let spCom = {}, spCode = {};
if (!stageSrc) skipped.push("stage-code-bodies.cloud.js بـdomain=com (لا مجلد cloud/ في هذه البنية)");
else try { spCom = await runStage({ repo: "/zq", domain: "com", stage: "CM2", ids: ["com-000"], ctx: "p4ctx" }); spCode = await runStage({ repo: "/zq", domain: "code", stage: "C9", ids: ["code-102"] }); } catch (e) { spCom = { error: String(e) }; }
const tCom = spCom["translate:com-000"] || "", tCode = spCode["translate:code-102"] || "";
if (stageSrc) expect("stage-code-bodies.cloud.js بـdomain=com: المترجم يقرأ موجز claude.com وسياق p4ctx ومتونٌ تُترجم أول مرة (لا «الجديد والمتغيّر»)، والمسودة والمدقّق بصيغة الأجزاء؛ والنطاق code كما كان",
  /claude\.com/.test(tCom) && /FULL BODIES/.test(tCom) && tCom.includes("/zq/web/code/glossary/com/_blk_todo/BRIEF.md") && tCom.includes("/zq/web/code/glossary/com/_blk_todo/p4ctx/") &&
  !/NEW AND CHANGED/.test(tCom) && tCom.includes("validate-batch.mjs --mode=block /zq/web/code/glossary/com/_blk_todo/p4/com-000.json") &&
  /Claude Code documentation/.test(tCode) && !/FULL BODIES of the Claude website/.test(tCode), JSON.stringify(spCom).slice(0, 300));

// (١٦) ★ (المراجعة المستقلة لـر17، ٨ جمادى الأولى ١٤٤٨هـ) ما لم تبلغه فحوص ر17 (نجت منها 13 طفرةً من 14 للمراجع): قبول النسخة (200 و<html lang>
// والمتن) والإعادة على 429/5xx وحدها وحكم الصفحة على ما لا يحمله الخادم دوالَّ خالصة؛ والالتباس بالموضع في النسختين كلتيهما، ومقياس «إحدى النسختين»،
// والمرحلة فوق الساعتين، وتقسيم «ذات صلة» بالحجم، وبوابة القائمة في أول تشغيل أمام خريطة com-routes؛ ومدخلات CM1 على حصادٍ اصطناعي فيه السوق والعناوين
// (المتن الخالص لا يدخلها، والعنوان الذي تبقيه الشركة يُستبعد ويُعدّ، وعناوين السوق نمطٌ لا بنود، وقيم القوالب التي لم تصر أنماطًا بنودٌ حرفية معدودة لا تسقط،
// والاسم وحده لا يُترجم)، وقائمة الإبقاء تحمل «symbols» مع ما تبقيه الشركة، و«ذات صلة» جزءٌ قبل صفحات السوق
const rvC1 = CH.classifyPage(["zqS", "zqK"], [["zqK", "zqS"], ["zqK"]]), rvC2 = CH.classifyPage(["zqA"], [["zqA"], ["zqB"]]);
const rvInfo = new Map([["r1", { tpl: w(60, "r1"), status: "related" }], ["r2", { tpl: w(60, "r2"), status: "related" }], ["m1", { tpl: w(10, "m1"), status: "TRANSLATE" }]]);
const rvParts = CH.planParts([{ pk: "/marketplace/connectors/zq-1", family: "mkt-connector", fps: ["r1", "m1"] }, { pk: "/marketplace/connectors/zq-2", family: "mkt-connector", fps: ["r2", "r1"] }], rvInfo, { max: 100 });
const rvSt = CH.planStages([{ id: "x1", group: "main", items: [1], words: 9000 }, { id: "x2", group: "articles", items: [1], words: 5500 }]);
const rvG = (eng, sm, accept) => CH.listGate(null, cnt(100, 80, 20), { exactMeta: { exact: 20, sitemap: 1000, english: 600 }, facts: { sitemap: sm, english: eng }, acceptDrop: !!accept });
expect("com-harvest (مراجعة ر17): النسخة تُقبل بـ200 و<html lang> المطابق والمتن وحدها، والإعادة على 429 و5xx لا 404 ولا 3xx، وما لا يحمله الخادم غير متحقَّق؛ والالتباس بالموضع يشترط النسختين، و«إحدى النسختين» تُعدّ، والمرحلة فوق الساعتين مرفوضة، و«ذات صلة» تُقسم بالحجم، وبوابة أول تشغيلٍ أمام خريطة com-routes",
  CH.acceptVersion(200, { lang: "ZQA-xx", main: 1 }, "zqa") && !CH.acceptVersion(404, { lang: "zqa", main: 1 }, "zqa") && !CH.acceptVersion(200, { lang: "zqe", main: 1 }, "zqa") &&
  !CH.acceptVersion(200, { lang: "zqa", main: 0 }, "zqa") && !CH.acceptVersion(200, null, "zqa") &&
  CH.retryable(429) && CH.retryable(500) && CH.retryable(503) && !CH.retryable(404) && !CH.retryable(301) && !CH.retryable(200) &&
  same([...CH.pageVerdicts(["zqA", "zqB"], new Map([["zqA", "kept"]]))], [["zqA", "kept"], ["zqB", "unverified"]]) &&
  rvC1.verdict.get("zqS") === "translated" && rvC1.verdict.get("zqK") === "kept" && rvC1.ambiguous.size === 0 && rvC1.split.size === 0 &&
  rvC2.verdict.get("zqA") === "translated" && same([...rvC2.split], ["zqA"]) &&
  rvSt[0].ok === false && rvSt[1].ok === true &&
  same(rvParts.parts.map((p) => p.kind + ":" + p.items.join(",")), ["related:r1", "related:r2", "pages:m1"]) &&
  rvG(540, 1000).ok && !rvG(539, 1000).ok && !rvG(600, 899).ok && rvG(539, 899, true).ok && CH.listGate(null, cnt(100, 80, 20), { exactMeta: { exact: 20 } }).ok,
  JSON.stringify([[...rvC1.ambiguous], [...rvC2.split], rvSt.map((x) => x.ok), rvParts.parts.map((p) => p.kind + ":" + p.items.join(",")), rvG(539, 1000).why, rvG(600, 899).why]));
const RVI = path.join(BOX, "com-rv-in"), RVO = path.join(BOX, "com-rv-out");
const rvB = (t) => ({ fp: SH.blockFp(t), tpl: t });
const rvS1 = rvB("<c1>zq_x</c1> 7 x"), rvK1 = rvB("Zq kept product line"), rvX1 = rvB("Zq home sentence to translate."), rvX2 = rvB("Zq single page sentence."),
  rvM1 = rvB("Zq first connector body."), rvM2 = rvB("Zq second connector body."), rvRC = rvB("Zq related card shown on two connector pages.");
const MK = (s) => "https://claude.com/marketplace/connectors/" + s;
writeJson(path.join(RVI, "list.json"), { items: [{ path: "/", family: "home", mode: "full" }, { path: "/zq-one", family: "singles", mode: "full" },
  { path: "/marketplace/connectors/zq-a", family: "mkt-connector", mode: "full" }, { path: "/marketplace/connectors/zq-b", family: "mkt-connector", mode: "full" }] });
writeJson(path.join(RVI, "blocks-20990101T0000.json"), { domain: "com", pages: { "/": [rvS1.fp, rvK1.fp, rvX1.fp], "/zq-one": [rvX2.fp], "/marketplace/connectors/zq-a": [rvM1.fp, rvRC.fp], "/marketplace/connectors/zq-b": [rvM2.fp, rvRC.fp] },
  urls: { "/": "https://claude.com/", "/zq-one": "https://claude.com/zq-one", "/marketplace/connectors/zq-a": MK("zq-a"), "/marketplace/connectors/zq-b": MK("zq-b") },
  blocks: [rvS1, rvK1, rvX1, rvX2, rvM1, rvM2, rvRC].map((b) => ({ ...b, count: 1, pages: [], status: "todo" })) });
writeJson(path.join(RVI, "classified.json"), { blocks: { [rvS1.fp]: "translated", [rvK1.fp]: "kept", [rvX1.fp]: "translated", [rvX2.fp]: "translated", [rvM1.fp]: "translated", [rvM2.fp]: "translated", [rvRC.fp]: "translated" },
  pages: { "/": { titleKept: false }, "/zq-one": { titleKept: true }, "/marketplace/connectors/zq-a": { titleKept: false }, "/marketplace/connectors/zq-b": { titleKept: false } },
  items: [{ zone: "ui", kind: "text", key: "Zq Menu", v: "translated" }, { zone: "body", kind: "attr:aria-label", key: "Zq slide 2 of 3", v: "translated" }] });
const rvPg = (u, t) => ({ url: u, final: u, mode: "full", keys: 1, title: t + " | Claude by Anthropic" });
writeJson(path.join(RVI, "harvest-20990101T0000.json"), { domain: "com", pages: [rvPg("https://claude.com/", "Zq Home"), rvPg("https://claude.com/zq-one", "Zq One"), rvPg(MK("zq-a"), "Zqa connector"), rvPg(MK("zq-b"), "Zqb connector")],
  keys: [{ key: "Zq Menu", kinds: ["text"], count: 1, zone: "ui", pages: ["https://claude.com/"] }, { key: "Zq body sentence", kinds: ["text"], count: 1, zone: "body", pages: ["https://claude.com/"] },
    { key: "Zq slide 2 of 3", kinds: ["attr:aria-label"], count: 1, zone: "body", pages: ["https://claude.com/"] }, { key: "Zqa", kinds: ["attr:alt"], count: 1, zone: "body", pages: [MK("zq-a")] }] });
const rvArgs = ["--list=" + path.join(RVI, "list.json"), "--blocks=" + path.join(RVI, "blocks-20990101T0000.json"), "--classified=" + path.join(RVI, "classified.json"), "--out=" + RVO];
const rvU = run([T("com-harvest.mjs"), "ui", ...rvArgs, "--harvest=" + path.join(RVI, "harvest-20990101T0000.json")]), rvK = run([T("com-harvest.mjs"), "chunk", ...rvArgs]);
let rvT = null, rvP = null, rvKai = null, rvMan = null;
try { rvT = JSON.parse(fs.readFileSync(path.join(RVO, "_ar_todo", "ui-cm1-todo.json"), "utf8")); rvP = JSON.parse(fs.readFileSync(path.join(RVO, "_vars-pairs-com-cm1.json"), "utf8"));
  rvKai = JSON.parse(fs.readFileSync(path.join(RVO, "_blk_todo", "kept-as-is.json"), "utf8")); rvMan = JSON.parse(fs.readFileSync(path.join(RVO, "_blk_todo", "p4-manifest.json"), "utf8")); } catch {}
expect("com-harvest ui/chunk (مراجعة ر17): المتن الخالص خارج CM1، والعنوان الذي تبقيه الشركة مستبعَدٌ معدود، وعناوين السوق لا تُضاف بنودَ تبويب، وقيم القوالب التي لم تصر أنماطًا بنودٌ حرفية معدودة والاسم وحده لا؛ وقائمة الإبقاء فيها «symbols» وما تبقيه الشركة، و«ذات صلة» جزءٌ قبل صفحات السوق",
  rvU.code === 0 && rvK.code === 0 && rvT && same(rvT.items.map((x) => x.en + ":" + x.source), ["Zq Menu:header-footer", "Zq Home:tab-title", "Zq slide 2 of 3:body-attr", "Zqa connector:marketplace-title", "Zqb connector:marketplace-title"]) &&
  rvT.counts.keptByCompany.title === 1 && rvT.counts.literalFromTemplates === 3 && same(rvP, []) &&
  rvKai && same(rvKai.blocks.map((b) => b.fp + ":" + b.why).sort(), [rvS1.fp + ":symbols", rvK1.fp + ":company-keeps-en"].sort()) &&
  rvMan && same(rvMan.map((m) => m.group + ":" + m.kind + ":" + m.blocks), ["main:pages:2", "marketplace:related:1", "marketplace:pages:2"]),
  [rvU.code, rvK.code, rvU.out.slice(-300), JSON.stringify(rvT && rvT.items.map((x) => x.en + ":" + x.source)), JSON.stringify(rvT && rvT.counts), JSON.stringify(rvKai && rvKai.blocks.map((b) => b.why)), JSON.stringify(rvMan && rvMan.map((m) => m.group + ":" + m.kind + ":" + m.blocks))].join(" | "));

// ★ (ر18، ٨ جمادى الأولى ١٤٤٨هـ — مراجعة ر17، البند 4) كتل السوق ذات «الشهر والسنة» أو العدد: نمطٌ لـCM1 لا كتلة متن. أولًا الدالتان الخالصتان: بنود الكتلة
// كما يراها المحرّك (عقدةٌ واحدة، وصفُّ لافتاتٍ متراصّ، والجملة والصفّ المتباعد والبند ذو العقد العدّة)، والنمط عند حدّه (ثلاث صفحاتٍ بقيمتين)،
// والتاريخ وحده نمطٌ والعدد وحده محايد، والبند الطويل يبقى متنًا — بقوالب اصطناعية («Zq»، لا نصَّ من الموقع)
const zqRow = (lab, d) => `<s1>${lab}</s1><s2>${d}</s2>`;
const bpE = (fp, tpl, pages) => ({ fp, tpl, pages });
const bp3 = CH.blockPatterns([bpE("d1", zqRow("Zq updated", "March 2026"), ["m1"]), bpE("d2", zqRow("Zq updated", "April 2026"), ["m2"]), bpE("d3", zqRow("Zq updated", "May 2025"), ["m3"]),
  bpE("n1", "12 zq installs", ["m1"]), bpE("n2", "1,234 zq installs", ["m2"]), bpE("n3", "56K zq installs", ["m3"]), bpE("v1", zqRow("Zq version", "2.1"), ["m4"]),
  bpE("l1", "Zq prose with 3 words and many more words than a short label", ["m1"]), bpE("l2", "Zq prose with 4 words and many more words than a short label", ["m2"]),
  bpE("l3", "Zq prose with 5 words and many more words than a short label", ["m3"]), bpE("f1", "<s1>Zq <a2>x</a2> y</s1><s3>June 2026</s3>", ["m1", "m2", "m3"]),
  bpE("s1", "<s1>Zq updated</s1> <s2>July 2026</s2>", ["m1"]), bpE("s2", "Zq since <s1>July 2026</s1> here", ["m2"])]);
const bp2 = CH.blockPatterns([bpE("d1", zqRow("Zq updated", "March 2026"), ["m1"]), bpE("d2", zqRow("Zq updated", "April 2026"), ["m2"])]);
const bpSame = CH.blockPatterns([bpE("d1", zqRow("Zq updated", "March 2026"), ["m1", "m2", "m3"])]);
expect("com-harvest (ر18): كتل السوق ذات الشهر والسنة أو العدد — بنودها كما يراها المحرّك، والتاريخ وحده نمطٌ في ثلاث صفحاتٍ بقيمتين (لا في صفحتين ولا بقيمةٍ واحدة)، والعدد مع كلمةٍ نمط، والعدد وحده محايدٌ ولافتته حرفية، والجملة الطويلة والصفّ المتباعد والجملة الموزّعة والبند ذو العقد العدّة تبقى متنًا",
  same(CH.rowItems(zqRow("Zq updated", "March 2026")), { kind: "group", items: ["Zq updated", "March 2026"] }) && same(CH.rowItems(" Zq  one "), { kind: "single", items: ["Zq one"] }) &&
  CH.rowItems("<s1>Zq updated</s1> <s2>July 2026</s2>") === null && CH.rowItems("Zq since <s1>July 2026</s1> here") === null && CH.rowItems("<s1>Zq</s1>") === null &&
  same(CH.rowItems("<s1>Zq <a2>x</a2> y</s1><g3/>"), { kind: "group", items: [false, null] }) && CH.rowItems("<s1> Zq</s1><s2>x</s2>") === null &&
  same([...bp3.status.keys()].sort(), ["d1", "d2", "d3", "n1", "n2", "n3", "v1"]) && [...bp3.status.values()].every((v) => v === "ui-pattern") &&
  same(bp3.pairs.map((p) => p.en + ":" + p.count + ":" + !!p.note), ["{date}:3:true", "{n} zq installs:3:false"]) &&
  same(bp3.literals.map((l) => l.en + ":" + l.count).sort(), ["Zq updated:3", "Zq version:1"]) &&
  bp2.status.size === 0 && bp2.pairs.length === 0 && bpSame.status.size === 0,
  JSON.stringify([CH.rowItems(zqRow("Zq updated", "March 2026")), [...bp3.status.keys()], bp3.pairs, bp3.literals, bp2.status.size, bpSame.status.size]));
// ثم الأمران بلا شبكة: كتل التاريخ تخرج من أجزاء المتن إلى قائمة الإبقاء بسببٍ يبدأ بـui (لا علامة إبقاء)، ونمطها في أزواج CM1 بملاحظة RULES §2، ولافتتها
// بندٌ حرفي، وكتلة المتن الأخرى في جزئها كما كانت
const BPI = path.join(BOX, "com-bp-in"), BPO = path.join(BOX, "com-bp-out");
const bpB = (t) => ({ fp: SH.blockFp(t), tpl: t });
const bpD = ["March 2026", "April 2026", "May 2025"].map((d) => bpB(zqRow("Zq updated", d))), bpM = bpB("Zq connector body sentence to translate.");
const BMK = (s) => "https://claude.com/marketplace/connectors/" + s, bpPk = ["zq-a", "zq-b", "zq-c"].map((s) => "/marketplace/connectors/" + s);
writeJson(path.join(BPI, "list.json"), { items: bpPk.map((p) => ({ path: p, family: "mkt-connector", mode: "full" })) });
writeJson(path.join(BPI, "blocks-20990101T0000.json"), { domain: "com", pages: { [bpPk[0]]: [bpD[0].fp, bpM.fp], [bpPk[1]]: [bpD[1].fp], [bpPk[2]]: [bpD[2].fp] },
  urls: Object.fromEntries(bpPk.map((p, i) => [p, BMK(["zq-a", "zq-b", "zq-c"][i])])), blocks: [...bpD, bpM].map((b) => ({ ...b, count: 1, pages: [], status: "todo" })) });
writeJson(path.join(BPI, "classified.json"), { blocks: Object.fromEntries([...bpD, bpM].map((b) => [b.fp, "translated"])), pages: Object.fromEntries(bpPk.map((p) => [p, { titleKept: false }])), items: [] });
writeJson(path.join(BPI, "harvest-20990101T0000.json"), { domain: "com", pages: bpPk.map((p, i) => ({ url: "https://claude.com" + p, final: "https://claude.com" + p, mode: "full", keys: 1, title: "Zq" + "abc"[i] + " connector | Claude by Anthropic" })), keys: [] });
const bpArgs = ["--list=" + path.join(BPI, "list.json"), "--blocks=" + path.join(BPI, "blocks-20990101T0000.json"), "--classified=" + path.join(BPI, "classified.json"), "--out=" + BPO];
const bpU = run([T("com-harvest.mjs"), "ui", ...bpArgs, "--harvest=" + path.join(BPI, "harvest-20990101T0000.json")]), bpK = run([T("com-harvest.mjs"), "chunk", ...bpArgs]);
let bpT = null, bpP = null, bpKai = null, bpParts = null;
try { bpT = JSON.parse(fs.readFileSync(path.join(BPO, "_ar_todo", "ui-cm1-todo.json"), "utf8")); bpP = JSON.parse(fs.readFileSync(path.join(BPO, "_vars-pairs-com-cm1.json"), "utf8"));
  bpKai = JSON.parse(fs.readFileSync(path.join(BPO, "_blk_todo", "kept-as-is.json"), "utf8"));
  bpParts = JSON.parse(fs.readFileSync(path.join(BPO, "_blk_todo", "p4-manifest.json"), "utf8")).map((m) => JSON.parse(fs.readFileSync(path.join(BPO, "_blk_todo", "p4", m.id + ".json"), "utf8")).map((x) => x.fp)); } catch {}
expect("com-harvest ui/chunk (ر18): كتل الشهر والسنة في السوق خارج أجزاء المتن (في قائمة الإبقاء بسبب ui-cm1-pattern لا علامة إبقاء)، ونمط {date} في أزواج CM1 بملاحظة RULES §2، ولافتتها بندٌ حرفي، وكتلة المتن الأخرى في جزئها",
  bpU.code === 0 && bpK.code === 0 && bpP && same(bpP.map((p) => p.en + ":" + p.source + ":" + !!p.note), ["{name} connector:com-harvest ui (marketplace):false", "{date}:com-harvest ui (marketplace blocks):true"]) &&
  bpT && bpT.items.some((x) => x.en === "Zq updated" && x.source === "marketplace-block-label") && bpT.counts.blockPatternBlocks === 3 &&
  bpKai && same(bpKai.blocks.filter((b) => b.why === "ui-cm1-pattern").map((b) => b.fp).sort(), bpD.map((b) => b.fp).sort()) && bpKai.counts["ui-cm1-pattern"] === 3 &&
  bpParts && same(bpParts.flat(), [bpM.fp]),
  [bpU.code, bpK.code, bpU.out.slice(-300), JSON.stringify(bpP), JSON.stringify(bpT && bpT.counts), JSON.stringify(bpKai && bpKai.counts), JSON.stringify(bpParts)].join(" | "));

// ★ (ر18، اختياري من مراجعة ر17) نسخةٌ تُخدم غير مترجمة بلغةٍ مطابقة تُترك (حدّ 95٪ من بصمات المتن الإنجليزي وخمس كتلٍ فأكثر)، وعنوان موصِّلٍ تبقيه
// الشركة لا يُحتسب في نمط «{name} connector» ويُعدّ مستبعَدًا — فبعنوانين باقيين من ثلاثة لا نمط
const uvEn = Array.from({ length: 20 }, (_, i) => "f" + i);
const uvV = (k) => uvEn.map((fp, i) => (i < k ? "t" + i : fp));
const BPO2 = path.join(BOX, "com-bp-out2");
writeJson(path.join(BPI, "classified-kept.json"), { blocks: Object.fromEntries([...bpD, bpM].map((b) => [b.fp, "translated"])),
  pages: Object.fromEntries(bpPk.map((p, i) => [p, { titleKept: i === 2 }])), items: [] });
const bpU2 = run([T("com-harvest.mjs"), "ui", "--list=" + path.join(BPI, "list.json"), "--blocks=" + path.join(BPI, "blocks-20990101T0000.json"),
  "--classified=" + path.join(BPI, "classified-kept.json"), "--out=" + BPO2, "--harvest=" + path.join(BPI, "harvest-20990101T0000.json")]);
let bpP2 = null, bpT2 = null;
try { bpP2 = JSON.parse(fs.readFileSync(path.join(BPO2, "_vars-pairs-com-cm1.json"), "utf8")); bpT2 = JSON.parse(fs.readFileSync(path.join(BPO2, "_ar_todo", "ui-cm1-todo.json"), "utf8")); } catch {}
expect("com-harvest (ر18): نسخةٌ خُدمت غير مترجمة تُترك عند حدّ 95٪ من بصمات المتن (19 من 20 تُترك، و18 تُقبل، وأقل من خمس كتلٍ تُقبل)، وعنوان موصِّلٍ تبقيه الشركة لا يُحتسب في نمط «{name} connector» ويُعدّ",
  CH.untranslatedVersion(uvEn, uvEn) === true && CH.untranslatedVersion(uvEn, uvV(1)) === true && CH.untranslatedVersion(uvEn, uvV(2)) === false &&
  CH.untranslatedVersion(uvEn.slice(0, 4), uvEn.slice(0, 4)) === false && CH.untranslatedVersion(uvEn.slice(0, 5), uvEn.slice(0, 5)) === true && CH.untranslatedVersion([], []) === false &&
  CH.versionVerdict(200, { lang: "zq", main: true, seq: uvEn }, "zq", uvEn) === "untranslated" && CH.versionVerdict(200, { lang: "zq", main: true, seq: uvV(2) }, "zq", uvEn) === "ok" &&
  CH.versionVerdict(404, { lang: "zq", main: true, seq: uvV(2) }, "zq", uvEn) === "rejected" && CH.versionVerdict(200, { lang: "zz", main: true, seq: uvEn }, "zq", uvEn) === "rejected" &&
  bpU2.code === 0 && bpP2 && !bpP2.some((p) => p.en === "{name} connector") && bpP2.some((p) => p.en === "{date}") && bpT2 && bpT2.counts.keptByCompany.title === 1 &&
  same(bpT2.items.filter((x) => /connector$/.test(x.en)).map((x) => x.en + ":" + x.source), ["Zqa connector:marketplace-title", "Zqb connector:marketplace-title"]),
  [bpU2.code, JSON.stringify(bpP2 && bpP2.map((p) => p.en)), JSON.stringify(bpT2 && bpT2.counts.keptByCompany), bpU2.out.slice(-200)].join(" | "));

// ★ (المراجعة المستقلة لـر18، ٨ جمادى الأولى ١٤٤٨هـ) أربع طفراتٍ نجت من فحوص ر18 فهذه حدودها: كتلةٌ تبقيها الشركة (kept) لا تدخل أنماط السوق
// فتبقى علامة إبقاءٍ لا نمطًا يعرّبه قاموس الواجهة (والتاريخان الباقيان في صفحتين لا نمط لهما)؛ وعتبة الصفحات بالصفحات لا بالكتل (كتلةٌ واحدة في
// صفحتين وأخرى في ثالثة نمط)؛ وبندٌ برابط ({url}) لا يصير نمطًا؛ وبندٌ بلا كلمة («·») ليس بندًا حرفيًّا — بقوالب اصطناعية («Zq»)
const rvShare = CH.blockPatterns([bpE("e1", zqRow("Zq updated", "March 2026"), ["m1", "m2"]), bpE("e2", zqRow("Zq updated", "April 2026"), ["m3"])]);
const rvUrl = CH.blockPatterns(["a1", "a2", "a3"].map((s, i) => bpE("u" + i, "Zq docs at https://zq.example/" + s, ["m" + (i + 1)])));
const rvDot = CH.blockPatterns(["March 2026", "April 2026", "May 2025"].map((d, i) => bpE("t" + i, `<s1>Zq updated</s1><s2>·</s2><s3>${d}</s3>`, ["m" + (i + 1)])));
writeJson(path.join(BPI, "classified-keptdate.json"), { blocks: Object.fromEntries([...bpD, bpM].map((b, i) => [b.fp, i === 2 ? "kept" : "translated"])),
  pages: Object.fromEntries(bpPk.map((p) => [p, { titleKept: false }])), items: [] });
const BPO3 = path.join(BOX, "com-bp-out3");
const bpK3 = run([T("com-harvest.mjs"), "chunk", "--list=" + path.join(BPI, "list.json"), "--blocks=" + path.join(BPI, "blocks-20990101T0000.json"),
  "--classified=" + path.join(BPI, "classified-keptdate.json"), "--out=" + BPO3]);
let bpKai3 = null;
try { bpKai3 = JSON.parse(fs.readFileSync(path.join(BPO3, "_blk_todo", "kept-as-is.json"), "utf8")); } catch {}
expect("com-harvest (مراجعة ر18 المستقلة): كتلة التاريخ التي تبقيها الشركة تبقى علامة إبقاء ولا تصير نمطًا، وعتبة النمط بالصفحات لا بالكتل، وبند الرابط لا يصير نمطًا، وبند الرمز ليس بندًا حرفيًّا",
  same([...rvShare.status.keys()].sort(), ["e1", "e2"]) && same(rvShare.pairs.map((p) => p.en + ":" + p.count), ["{date}:3"]) &&
  rvUrl.status.size === 0 && rvUrl.pairs.length === 0 &&
  same([...rvDot.status.keys()].sort(), ["t0", "t1", "t2"]) && same(rvDot.literals.map((l) => l.en), ["Zq updated"]) &&
  bpK3.code === 0 && bpKai3 && same(bpKai3.blocks.filter((b) => b.fp === bpD[2].fp).map((b) => b.why), ["company-keeps-en"]) && bpKai3.counts["ui-cm1-pattern"] === 0,
  JSON.stringify([[...rvShare.status.keys()], rvShare.pairs.map((p) => p.en + ":" + p.count), rvUrl.status.size, rvDot.literals, bpK3.code, bpKai3 && bpKai3.counts]));

// ★ (ر24-ب2، ١٢ جمادى الأولى ١٤٤٨هـ — مراجعة Codex CX-006) ترتيب CSS المتداخل في محلِّل محرّك الاتجاه (cml-rtl.js، يستهلكه gen-rtl والورقة الحيّة):
// الإعلانات السابقة لقاعدةٍ متداخلة تُدفع قبلها، فيبقى القيد المتداخل بعد ما يغلبه. مثال Codex بقيد @media، وقاعدة & بتخصيصٍ مسطَّحٍ مساوٍ
// (:where)، وإعلانٌ بعد القاعدة المتداخلة قاعدةٌ مستقلةٌ بعدها، وقاعدةٌ بلا إعلانٍ قبلها لا تولّد قاعدةً فارغة
await import(pathToFileURL(path.join(inBox(EXT), "cml-rtl.js")).href);
const RTL = globalThis.CMLRtl;
const nestKey = (css) => RTL.parseCss(css).rules.map((r) => (r.ctx.length ? r.ctx.join("|") + " " : "") + r.sel + "{" + r.decls.map((d) => d.prop + ":" + d.value).join(";") + "}");
const nestOut = (css) => { const o = RTL.flipSheet(RTL.parseCss(css).rules, {}); return RTL.serializeRules(o.logical); };
const nA = nestKey(".probe{margin-left:10px; @media (min-width:0px){margin-left:20px}}");
const nB = nestKey(".zq{margin-left:1px; &:where(.on){margin-left:2px} padding-left:3px}");
const nC = nestKey(".zq{&:where(.on){margin-left:2px}}");
const oA = nestOut(".probe{margin-left:10px; @media (min-width:0px){margin-left:20px}}");
const oB = nestOut(".zq{margin-left:1px; &:where(.on){margin-left:2px}}");
expect("cml-rtl (ر24-ب2، CX-006): الإعلانات السابقة لقاعدةٍ متداخلة تُدفع قبلها — قيد @media وقاعدة & تبقيان بعد ما تغلبانه في التحليل وفي الورقة المولَّدة، وما بعدهما قاعدةٌ بعدهما",
  same(nA, [".probe{margin-left:10px}", "@media (min-width:0px) .probe{margin-left:20px}"]) &&
  same(nB, [".zq{margin-left:1px}", ".zq:where(.on){margin-left:2px}", ".zq{padding-left:3px}"]) && same(nC, [".zq:where(.on){margin-left:2px}"]) &&
  oA.indexOf("margin-inline-start:10px") !== -1 && oA.indexOf("margin-inline-start:10px") < oA.indexOf("margin-inline-start:20px") &&
  oB.indexOf("margin-inline-start:1px") !== -1 && oB.indexOf("margin-inline-start:1px") < oB.indexOf("margin-inline-start:2px"),
  JSON.stringify([nA, nB, nC, oA.slice(0, 400), oB.slice(0, 400)]));

// ★ (ر24-ب2، ١٢ جمادى الأولى ١٤٤٨هـ — مراجعة Codex CX-007) الجزر من اليسار: القيمة الفيزيائية المقلوبة (التحويل والإزاحة المستقلة ومتغيّر الإزاحة
// السينية وموضع الخلفية) تحمل استثناء الجزر وأحفادها (pre وcode وkbd وsamp و[data-cml-noflip="ltr"])، والتحويل المنطقي (المرساة والهامش ومحاذاة
// النص) لا يحمله فيبقى بديله المحلّي داخل الجزيرة؛ واستثناء السطح المحسوب على القاعدة كلها كما كان
const islRules = (css) => { const o = RTL.flipSheet(RTL.parseCss(css).rules, {}); return RTL.parseCss(RTL.serializeRules(o.logical).split(RTL.GATE).join("html[data-zq]")).rules
  .map((r) => ({ ex: r.sel.indexOf(RTL.ISLAND_EXEMPT) !== -1, nf: r.sel.indexOf('[data-cml-noflip="computed"]') !== -1, d: r.decls.map((d) => d.prop + ":" + d.value).join(";") })); };
const iC = islRules(".zq-c{position:absolute;left:50%;transform:translateX(-50%)}");
const iM = islRules(".zq-m{margin-left:4px}.zq-v{--tw-translate-x:-1rem}.zq-b{background-position:left top}.zq-t{text-align:left;translate:-4px 0}");
const iKey = (rs) => rs.map((r) => (r.ex ? "I" : "-") + (r.nf ? "N" : "-") + " " + r.d);
expect("cml-rtl (ر24-ب2، CX-007): القيم الفيزيائية المقلوبة تُستثنى في جزر LTR وأحفادها، والتحويلات المنطقية لا — مثال Codex (left:50% مع translateX(-50%)) والإزاحة المستقلة ومتغيّرها وموضع الخلفية",
  same(iKey(iC), ["-N inset-inline-start:50%", "IN transform:translateX(50%)"]) &&
  same(iKey(iM), ["-N margin-inline-start:4px", "IN --tw-translate-x:1rem", "I- background-position:right top", "-N text-align:start", "IN translate:4px 0"]) &&
  /^:not\(:where\(pre,code,kbd,samp,\[data-cml-noflip="ltr"\],\[data-cml-noflip=""\],pre \*,code \*,kbd \*,samp \*,\[data-cml-noflip="ltr"\] \*,\[data-cml-noflip=""\] \*\)\)$/.test(RTL.ISLAND_EXEMPT),
  JSON.stringify([iKey(iC), iKey(iM), RTL.ISLAND_EXEMPT]));

// ★ (ر24-ب2، CX-007) فحص أمانة الجزر في rtl-audit (islandDrift في rtl-geom.mjs): جذرٌ بمقاسه الأصلي وأحفادٌ في مواضعهم لا حكم عليه، وحفيدٌ أزاحته
// قيمةٌ مقلوبة (مثال Codex: 110 بدل 90) يُعدّ، والحدّ (بكسلان) لا يُعدّ وفوقه يُعدّ، وجذرٌ تغيّر مقاسه (التفاف) لا يُقارن، والجامع يسجّل الأحفاد للجذر
// وحده، والمقارنة تستعمل الحكم، وتصنيفه لا يبتلعه «جزيرةٌ مقصودة»
const isR = (w, kids) => ({ w, h: 40, ik: kids });
const isA = isR(200, [["/0", 90, 10, 20, 10], ["/1", 0, 0, 200, 8]]);
const isV = [
  GEO.islandDrift(isA, isR(200, [["/0", 90, 10, 20, 10], ["/1", 0, 0, 200, 8]]), 2),
  GEO.islandDrift(isA, isR(200, [["/0", 110, 10, 20, 10], ["/1", 0, 0, 200, 8]]), 2),
  GEO.islandDrift(isA, isR(200, [["/0", 92, 10, 20, 10]]), 2),
  GEO.islandDrift(isA, isR(200, [["/0", 92.5, 10, 20, 10]]), 2),
  GEO.islandDrift(isA, isR(230, [["/0", 110, 10, 20, 10]]), 2),
  GEO.islandDrift(isA, isR(200, [["/9", 110, 10, 20, 10]]), 2),
];
expect("rtl-geom (ر24-ب2، CX-007): أمانة الجزر — الأصل لا حكم عليه، والحفيد المُزاح يُعدّ، والحدّ بكسلان، وجذرٌ تغيّر مقاسه لا يُقارن، ومسارٌ غائب لا يُقارن؛ والجامع والمقارنة والتصنيف موصولة",
  isV[0] === null && isV[1] && isV[1].n === 1 && isV[1].of === 2 && isV[1].first.p === "/0" && isV[1].first.dx === 20 && isV[2] === null &&
  isV[3] && isV[3].n === 1 && isV[4] === null && isV[5] === null &&
  /^import \{ sgn, ltrSideFlipped, sideNotMirrored, insideAtRest, islandDrift \} from "\.\/rtl-geom\.mjs";$/m.test(audSrc) &&
  /if \(island && rec && !isl && tag !== "svg" && tag !== "math"\) rec\.ik = islandKids\(el, r\);/.test(audSrc) &&
  /const g = islandDrift\(r, e, 2\);/.test(audSrc) &&
  audSrc.indexOf('if (f.check === "island-geometry") return { cls: "engine-gap"') !== -1 &&
  audSrc.indexOf('if (f.check === "island-geometry") return { cls: "engine-gap"') < audSrc.indexOf('if (f.el && (f.el.isl || f.el.nf)) return { cls: "intended-ltr"'),
  JSON.stringify(isV));

// ★ (ر24-ب4، ١٢ جمادى الأولى ١٤٤٨هـ — بقية CX-007) جزر أوراق ‎*-point.css‎ بعلامتنا ‎--cml-island‎: islandSelectors تقرأ محدِّدات القواعد الحاملة لها
// (قائمة المحدِّدات تُقسم، وشرط @media يُرفض لأنه لا يُنقل إلى المحدِّد)، وislandExempt يضمّها وأحفادها إلى الجزر المسمّاة في ورقة ذلك الموقع
// وحده: القيمة الفيزيائية المقلوبة تحمل الاستثناء الموسَّع، والتحويل المنطقي لا يحمله، وبلا جزرٍ يبقى ISLAND_EXEMPT حرفًا بحرف. ومعه طي قناع
// الخلفية (‎mask-position‎ قيمةٌ فيزيائية تحمل الاستثناء: طافرةٌ نجت في ر24-ب2)
const ptCss = 'html[data-cml="on"][dir="rtl"] .zq-a, html[data-cml="on"] .zq-b > i{direction:ltr;--cml-island:ltr}\n' +
  'html[data-cml="on"] .zq-n{direction:ltr}\n@media (min-width:0px){html[data-cml="on"] .zq-m{direction:ltr;--cml-island:ltr}}';
const ptX = RTL.islandSelectors(ptCss);
const ptSels = ['html[data-cml="on"][dir="rtl"] .zq-a', 'html[data-cml="on"] .zq-b > i'];
const ptEx = RTL.islandExempt(ptSels);
const ptRules = (css, islands) => { const o = RTL.flipSheet(RTL.parseCss(css).rules, { islands }); return RTL.parseCss(RTL.serializeRules(o.logical).split(RTL.GATE).join("html[data-zq]")).rules
  .map((r) => (r.sel.indexOf(ptEx) !== -1 ? "P" : r.sel.indexOf(RTL.ISLAND_EXEMPT) !== -1 ? "I" : "-") + " " + r.decls.map((d) => d.prop + ":" + d.value).join(";")); };
const ptA = ptRules(".zq-c{position:absolute;left:50%;transform:translateX(-50%)}.zq-k{mask-position:left top;-webkit-mask-position:left top}", ptSels);
const ptB = ptRules(".zq-c{position:absolute;left:50%;transform:translateX(-50%)}.zq-k{mask-position:left top}", []);
expect("cml-rtl (ر24-ب4، بقية CX-007): جزر الورقة النقطية بعلامة ‎--cml-island‎ — تُقرأ محدِّداتها وتُقسم قائمتها ويُرفض شرط @media، وتنضمّ وأحفادها إلى استثناء القيم الفيزيائية (ومنها قناع الخلفية) في ورقة الموقع وحده، وبلا جزرٍ يبقى الاستثناء كما كان",
  same(ptX.sels, ptSels) && ptX.errors.length === 1 && /^ctx:/.test(ptX.errors[0]) &&
  ptEx === ":not(:where(" + RTL.ISLAND_EXEMPT.slice(12, -2) + "," + ptSels.join(",") + "," + ptSels.map((x) => x + " *").join(",") + "))" &&
  same(ptA, ["- inset-inline-start:50%", "P transform:translateX(50%)", "P mask-position:right top;-webkit-mask-position:right top"]) &&
  same(ptB, ["- inset-inline-start:50%", "I transform:translateX(50%)", "I mask-position:right top"]) &&
  RTL.islandExempt([]) === RTL.ISLAND_EXEMPT && RTL.islandExempt(undefined) === RTL.ISLAND_EXEMPT && RTL.REV === 10,
  JSON.stringify([ptX, ptA, ptB, ptEx.slice(0, 200)]));

// ★ (ر24-ب4) العقد في الأوراق المشحونة والمولّد والعامل: كل قاعدةٍ في ‎*-point.css‎ تعلن ‎direction:ltr‎ تحمل العلامة والعكس (فلا تُنسى جزيرةٌ جديدة
// ولا تبقى علامةٌ بلا جزيرة)، ولا قاعدة معلَّمة في سياق @؛ وgen-rtl يمرّر جزر ورقة الهدف إلى القلب، والعامل يمرّرها إلى الورقة الحيّة ويُدخل بصمتها
// بصمةَ الذاكرة. والعدّ الحاضر: الأكاديمية 5، وClaude Code 3، وclaude.com 7، والوثائق 3، وIntercom 1، والقانونية 1، والتطبيق 0
const ptParity = {};
for (const f of ["app", "intercom", "docs", "code", "legal", "academy", "com"]) {
  const txt = fs.readFileSync(path.join(EXT, f + "-point.css"), "utf8"), pr = RTL.parseCss(txt).rules;
  const ltrR = pr.filter((r) => r.decls.some((d) => d.prop === "direction" && /^ltr\b/.test(d.value))), mk = pr.filter((r) => r.decls.some((d) => d.prop === RTL.ISLAND_MARK));
  ptParity[f] = ltrR.length + "/" + mk.length + "/" + (ltrR.every((r) => mk.includes(r)) && mk.every((r) => ltrR.includes(r)) ? "=" : "≠") + "/" + RTL.islandSelectors(txt).errors.length;
}
const genSrc = fs.readFileSync(T("gen-rtl.mjs"), "utf8"), swSrc = fs.readFileSync(path.join(EXT, "sw.js"), "utf8");
expect("الأوراق النقطية (ر24-ب4): كل جزيرةٍ تحمل علامة ‎--cml-island‎ والعكس، بلا سياق @، وgen-rtl والعامل يمرّران جزر الموقع (وبصمتها في الذاكرة)",
  same(Object.entries(ptParity).map(([k, v]) => k + ":" + v), ["app:0/0/=/0", "intercom:1/1/=/0", "docs:3/3/=/0", "code:3/3/=/0", "legal:1/1/=/0", "academy:5/5/=/0", "com:7/7/=/0"]) &&
  /const out = R\.flipSheet\(all, \{ layerOrder, vars, islands \}\);/.test(genSrc) &&
  Object.keys({ app: 1, intercom: 1, docs: 1, code: 1, legal: 1, academy: 1, com: 1 }).every((t) => new RegExp("^\\s*" + t + ":\\s*\\{[^\\n]*point: \"" + (t === "app" ? "app" : t) + "-point\\.css\"").test(genSrc.split("\n").find((l) => new RegExp("^\\s*" + t + ":\\s*\\{").test(l)) || "")) &&
  /CMLRtl\.buildLiveSheet\(recs, \{\}, \{ islands: islands \}\)/.test(swSrc) && /CMLRtl\.buildLiveSheet\(linkRecs, \{\}, \{ islands: islands \}\)/.test(swSrc) &&
  /pointIslands\(req\.domain\)\.then/.test(swSrc) && /"i" \+ CMLRtl\.fnv1a\(islands\.join/.test(swSrc),
  JSON.stringify(ptParity));

// ★ (ر29-ب، ١٣ جمادى الأولى ١٤٤٨هـ — القرار 123، ما كشفته ر30-أ) حارسا محرّك الاتجاه في المسارين: gen-rtl الحقيقي على لقطةٍ اصطناعية (--out-dir)
// والورقة الحيّة (buildLiveSheet) على الورقة نفسها. (١) شرط RTL باللغة أو بصنف ‎.rtl‎ — ‎:lang(ar)‎ و‎[lang=ar]‎ و‎[lang|=ar]‎ و‎[lang^="ar"]‎ و‎html.rtl‎ —
// لا يُقلب ولا يُصفَّر، ويُعاد في المستوى الرابع بقيمته الفيزيائية قصدًا للموقع؛ والمنفيّ (‎html:not(.rtl)‎ و‎:not(:lang(ar))‎) يُقلب كغيره، و‎[lang=ar_x]‎
// ليس عربيًّا. (٢) مستهلك متغيّرٍ يعرّفه الموقع تحت RTL موجب (قناع التلاشي ‎to right‎ وحشو التمرير الأيسر) لا يُقلب ولا يُصفَّر؛ ومستهلك متغيّرٍ يُعرَّف
// في قاعدةٍ عادية، أو تحت ‎html:not([dir=rtl])‎ وحده، يُقلب كما كان. وبلا الحارسين كان الأول يُقلب مرتين والثاني يعيد الحافّتين إلى جهة LTR
// ★ (مراجعة ر29-ب) وصيغة القائمة ‎:lang(en, ar)‎ شرطُ RTL كذلك، ومستهلك متغيّرٍ يعرّفه الموقع تحت شرط LTR موجب (‎:dir(ltr)‎) يُقلب كما كان (ليس تبديلًا لـRTL)
const gdPad = Array.from({ length: 1100 }, (_, i) => ".zq-pad-" + i + "{margin-left:" + (i + 1) + "px}").join("\n");
const gdCss = [
  ":lang(ar) .zq-l1{margin-right:8px}", "[lang=ar] .zq-l2{padding-left:2px}", "[lang|=ar] .zq-l3{left:1px}", '[lang^="ar"] .zq-l4{text-align:left}',
  "html.rtl .zq-l5{margin-left:3px}", "html:not(.rtl) .zq-n1{margin-left:5px}", ".zq-x:not(:lang(ar)) .zq-n2{margin-left:6px}", "[lang=ar_x] .zq-n3{margin-left:7px}",
  ":lang(en, ar) .zq-l6{margin-left:4px}", ".zq-lt:where(:dir(ltr),[dir=ltr],[dir=ltr] *){--zq-ltr-v:3px}", ".zq-u{left:calc(var(--zq-ltr-v, 0px) + 2px)}",
  ".zq-f{mask-image:linear-gradient(to right, transparent, #000 var(--zq-fade-l))}", ".zq-f:where(:root[dir=rtl] :dir(rtl)){--zq-fade-l:var(--zq-raw-r)}",
  ".zq-sp{scroll-padding-left:calc(var(--zq-size) * var(--zq-l-on))}", ".rtl\\:zq-hide:where(:dir(rtl),[dir=rtl],[dir=rtl] *){--zq-l-on:0}",
  ".zq-g{--zq-other:10px;mask-image:linear-gradient(to right, #000 var(--zq-other))}",
  "html:not([dir=rtl]) .zq-k{--zq-ltr-only:2px}", ".zq-k{left:calc(var(--zq-ltr-only, 0px) + 1px)}",
  // ★ (ر30-ب) الحارس بنطاق المكوّن: الأداة المسمّاة بقيمةٍ ثابتة (‎.rtl\:zq-hide‎ أعلاه) لا تُبقي ‎.zq-sp‎، وقاعدة RTL على المكوّن نفسه تعيّن متغيّرًا وتقرأ آخر
  // فتُبقي مستهلكه (‎.zq-cp‎)، وأداة الخاصية الاعتباطية تُبقي مستهلك متغيّرها أينما كان (‎.zq-ar‎)، وقراءة النظير من الجهة الأخرى مرآةٌ تُبقيه (‎.zq-mv‎)؛
  // والتدرّج بزاوية يُعكس (‎.zq-ga‎) إلا أن يبدّل الموقع متغيّره تحت RTL في مكوّنه (‎.zq-gs‎)
  ".zq-cp{scroll-padding-left:calc(var(--zq-size) * var(--zq-c-left-on))}", ".zq-cp:where(:root[dir=rtl] :dir(rtl)){--zq-c-fade:calc(var(--zq-c-raw) * var(--zq-c-left-on))}",
  // وقراءة متغيّرٍ في خاصيةٍ عادية على المكوّن نفسه ليست تبديلًا ولو كان في اسمه جهة: ‎.zq-cn‎ يُقلب وتُعاد قاعدة الموقع في المستوى الرابع
  ".zq-cn{border-left:1px solid var(--zq-line-left)}", ".zq-cn:where(:root[dir=rtl] :dir(rtl)){border-right:1px solid var(--zq-line-left)}",
  ".zq-ar{left:var(--zq-dot)}", ".\\[\\&\\:dir\\(rtl\\)\\]\\:\\[--zq-dot\\:2px\\]:dir(rtl){--zq-dot:2px}",
  ".zq-mv{padding-left:var(--zq-pad-left)}", ".zq-wrap:where(:root[dir=rtl] :dir(rtl)){--zq-pad-left:var(--zq-pad-right-raw)}",
  ".zq-ga{mask-image:linear-gradient(90deg,#000,#0000)}",
  ".zq-gs{mask-image:linear-gradient(90deg,#000 var(--zq-gs-w),#0000)}", ".zq-gs:where(:root[dir=rtl] :dir(rtl)){--zq-gs-w:4px}", gdPad].join("\n");
const gdSnap = path.join(BOX, "zq-sitecss-r29b"), gdOut = path.join(BOX, "zq-gen-r29b");
fs.mkdirSync(gdSnap, { recursive: true }); fs.mkdirSync(gdOut, { recursive: true });
fs.writeFileSync(path.join(gdSnap, "zq.css"), gdCss, "utf8");
const gdRun = run([T("gen-rtl.mjs"), "--target=docs", gdSnap, "--out-dir=" + gdOut]);
const gdGen = fs.existsSync(path.join(gdOut, "rtl-docs.css")) ? fs.readFileSync(path.join(gdOut, "rtl-docs.css"), "utf8") : "";
const gdLive = RTL.buildLiveSheet([{ text: gdCss }], {}, { islands: [] });
// ‏لكل مسار: المستوى (2 مصفِّر، 3 منطقي، 4 معزَّز) لكل قاعدةٍ تحمل صنفًا اختباريًّا، وإعلاناتها
const gdTiers = (css, gate) => {
  const out = {};
  for (const r of RTL.parseCss(css.split(gate).join("html[data-zq]")).rules) {
    const m = /#cml0(?:#cml1(?:#cml2(#cml3)?)?)?\)/.exec(r.sel), cls = (/\.zq-(?:l\d|n\d|f|sp|g|k|u|lt|cp|cn|ar|mv|ga|gs|wrap)\b/.exec(r.sel) || [])[0];
    if (!m || !cls) continue;
    const tier = (m[0].match(/#cml/g) || []).length;
    (out[cls] = out[cls] || []).push(tier + " " + r.decls.map((d) => d.prop + ":" + d.value).join(";"));
  }
  return Object.keys(out).sort().map((k) => k + "=" + out[k].join("|"));
};
// (قاعدتا المتغيّرين المشروطتان بالاتجاه تُعادان في المستوى الرابع كما كانتا — ومنها المنفيّة، وهي لا تطابق في صفحتنا RTL؛ و‎.zq-sp‎ لا أثر له البتة)
const gdWant = [
  ".zq-cn=2 border-left:unset|3 border-inline-start:1px solid var(--zq-line-left)|4 border-right:1px solid var(--zq-line-left)",
  ".zq-cp=4 --zq-c-fade:calc(var(--zq-c-raw) * var(--zq-c-left-on))",
  ".zq-f=4 --zq-fade-l:var(--zq-raw-r)",
  ".zq-g=3 mask-image:linear-gradient(to left, #000 var(--zq-other))",
  ".zq-ga=3 mask-image:linear-gradient(270deg,#000,#0000)", ".zq-gs=4 --zq-gs-w:4px",
  ".zq-k=2 left:unset|3 inset-inline-start:calc(var(--zq-ltr-only, 0px) + 1px)|4 --zq-ltr-only:2px",
  ".zq-l1=4 margin-right:8px", ".zq-l2=4 padding-left:2px", ".zq-l3=4 left:1px", ".zq-l4=4 text-align:left", ".zq-l5=4 margin-left:3px", ".zq-l6=4 margin-left:4px",
  ".zq-n1=2 margin-left:unset|3 margin-inline-start:5px", ".zq-n2=2 margin-left:unset|3 margin-inline-start:6px", ".zq-n3=2 margin-left:unset|3 margin-inline-start:7px",
  ".zq-sp=2 scroll-padding-left:unset|3 scroll-padding-inline-start:calc(var(--zq-size) * var(--zq-l-on))",
  ".zq-u=2 left:unset|3 inset-inline-start:calc(var(--zq-ltr-v, 0px) + 2px)",
  ".zq-wrap=4 --zq-pad-left:var(--zq-pad-right-raw)",
];
const gdG = gdTiers(gdGen, RTL.GATE), gdL = gdLive ? gdTiers(gdLive.css, RTL.LIVE_GATE) : [];
// وعتبة «المدخل الهزيل» تعدّ المتروك لجهة الموقع مع المقلوب (ورقة /login بعرض 390 كانت تُرفض فتعود اللقطة): 55 مقلوبًا و10 متروكة تُقبل، و55 وحدها تُرفض
const gdThin = (held) => { const info = {}; const css = Array.from({ length: 1000 }, (_, i) => ".zq-c" + i + "{color:red}").concat(Array.from({ length: 55 }, (_, i) => ".zq-q" + i + "{margin-left:" + (i + 1) + "px}"),
  Array.from({ length: held }, (_, i) => ".zq-h" + i + "{scroll-padding-left:calc(" + (i + 1) + "px * var(--zq-on))}"), [".\\[\\&\\:dir\\(rtl\\)\\]\\:\\[--zq-on\\:0\\]:dir(rtl){--zq-on:0}"]).join("\n");
  const o = RTL.buildLiveSheet([{ text: css }], info, { islands: [] }); return (o ? "ok:" + o.stats.flipped + "+" + o.stats.rtlVarHeld : "null:" + info.reason); };
const gdThin10 = gdThin(10), gdThin0 = gdThin(0);
// ★ (مراجعة ر29-ب) والعتبة نفسها في gen-rtl الحقيقي (--target=docs: 400 قاعدة و60 قلبًا): 55 مقلوبًا و10 متروكة تُكتب، و55 وحدها «هزيلة» لا تُكتب
const gdGenThin = (held) => { const dir = path.join(BOX, "zq-sitecss-r29b-thin-" + held), out = path.join(BOX, "zq-gen-r29b-thin-" + held);
  fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(dir, "zq.css"), Array.from({ length: 450 }, (_, i) => ".zq-c" + i + "{color:red}").concat(Array.from({ length: 55 }, (_, i) => ".zq-q" + i + "{margin-left:" + (i + 1) + "px}"),
    Array.from({ length: held }, (_, i) => ".zq-h" + i + "{scroll-padding-left:calc(" + (i + 1) + "px * var(--zq-on))}"), [".\\[\\&\\:dir\\(rtl\\)\\]\\:\\[--zq-on\\:0\\]:dir(rtl){--zq-on:0}"]).join("\n"), "utf8");
  return run([T("gen-rtl.mjs"), "--target=docs", dir, "--out-dir=" + out]).code; };
const gdGenThin10 = gdGenThin(10), gdGenThin0 = gdGenThin(0);
expect("cml-rtl (ر29-ب): شرط RTL باللغة أو بصنف .rtl لا يُقلب ويُعاد في المستوى الرابع والمنفيّ يُقلب، ومستهلك متغيّرٍ يبدّله الموقع تحت RTL لا يُقلب ولا يُصفَّر — في gen-rtl والورقة الحيّة معًا",
  gdRun.code === 0 && same(gdG, gdWant) && same(gdL, gdWant) && gdLive.stats.langRtl === 6 && gdLive.stats.rtlVarHeld === 5 && gdLive.stats.gradient === 1 &&
  gdThin10 === "ok:55+10" && gdThin0 === "null:thin" && gdGenThin10 === 0 && gdGenThin0 !== 0 &&
  /منه بشرط اللغة أو صنف \.rtl: 6 \| متروكٌ لجهة الموقع \(متغيّرٌ يبدّله تحت RTL\): 5/.test(gdRun.out) && /عُكست زاويته \(θ ↦ 360−θ\): 1/.test(gdRun.out) &&
  RTL.condKind("html:not(.rtl) .a") === 0 && RTL.condKind(":is(:lang(ar)) .a") === 2 && RTL.condKind(".rtl\\:x .a") === 0 && RTL.condKind(".a[data-cml-x]") === 1,
  JSON.stringify({ thin: [gdThin10, gdThin0, gdGenThin10, gdGenThin0], code: gdRun.code, miss: gdWant.filter((x) => gdG.indexOf(x) === -1), extra: gdG.filter((x) => gdWant.indexOf(x) === -1), liveSame: same(gdG, gdL), st: gdLive && gdLive.stats }));

// ★ (ر30-ب، ١٣ جمادى الأولى ١٤٤٨هـ — القرار 124) زاوية التدرّج الخطي تُعكس (θ ↦ 360−θ) بوحداتها، والرأسيّ على حاله، وكلمات الجهة كما كانت؛ ويبقى عجزًا:
// البادئة القديمة، والمخروطي بزاوية، والخاصية غير الخلفية والقناع، والمختصر بموضعٍ عددي (واللون السداسي ليس موضعًا)
const gaF = (p, v) => { const a = RTL.analyzeDecl(p, v); return !a ? "null" : a.kind === "flip" ? a.flips.map((f) => f.value).join("|") + (a.grad ? " #g" : "") : a.kind + ":" + (a.reason || ""); };
const gaGot = [
  gaF("mask-image", "linear-gradient(90deg,#000 85%,#0000)"), gaF("background-image", "repeating-linear-gradient(45deg,red 0 2px,blue 2px 4px)"),
  gaF("background", "linear-gradient(0.25turn, red, blue)"), gaF("background-image", "linear-gradient(1.5708rad,red,blue)"), gaF("background-image", "linear-gradient(100grad,red,blue)"),
  gaF("background-image", "linear-gradient(-45deg,red,blue)"), gaF("background-image", "linear-gradient(90deg in oklab,red,blue)"), gaF("background-image", "linear-gradient(180deg,red,blue)"),
  gaF("background-image", "linear-gradient(270deg,red,blue), linear-gradient(to left, red, blue)"), gaF("background-image", "-webkit-linear-gradient(90deg,red,blue)"),
  gaF("background-image", "conic-gradient(from 90deg,red,blue),linear-gradient(90deg,red,blue)"), gaF("border-image", "linear-gradient(90deg,red,blue) 1"),
  gaF("background", "linear-gradient(90deg,red,blue) 0 0/50% 100% no-repeat"), gaF("background", "#f0eee6 linear-gradient(135deg,#f0eee6 0%,#e8e6dc 100%)"),
  typeof RTL.mirrorAngle === "function" ? RTL.mirrorAngle("360deg") : "missing", typeof RTL.mirrorAngle === "function" ? RTL.mirrorAngle("0.5turn") : "missing",
  // ★ (مراجعة ر30-ب) موضع البلاطة في القاعدة نفسها: موضعٌ لا نقلبه وليس وسطًا يُبقي التدرّج عجزًا (سهم القائمة بمثلّثين)، وما سواه يُعكس
  ...[".q{background-image:linear-gradient(45deg,transparent 50%,#222 0),linear-gradient(135deg,#222 50%,transparent 0);background-position:calc(100% - 17px) 50%,calc(100% - 12px) 50%;background-repeat:no-repeat}",
    ".q{background-image:linear-gradient(45deg,red,blue);background-position:0 0}", ".q{background-image:linear-gradient(45deg,red,blue);background-position:center}",
    ".q{background-image:linear-gradient(45deg,red,blue);background-size:20px 20px}", ".q{mask-image:linear-gradient(90deg,#000,#0000);mask-position:-1px 0}",
    ".q{-webkit-mask-image:linear-gradient(90deg,#000,#0000);-webkit-mask-position:50% 0,center}", ".q{mask-image:linear-gradient(90deg,#000,#0000);background-position:-1px 0}",
  ].map((css) => typeof RTL.gradPlacementKept === "function" ? "kept:" + RTL.gradPlacementKept(RTL.parseCss(css).rules[0].decls, 0) : "missing"),
];
const gaWant = [
  "linear-gradient(270deg,#000 85%,#0000) #g", "repeating-linear-gradient(315deg,red 0 2px,blue 2px 4px) #g",
  "linear-gradient(0.75turn, red, blue) #g", "linear-gradient(4.7124rad,red,blue) #g", "linear-gradient(300grad,red,blue) #g",
  "linear-gradient(45deg,red,blue) #g", "linear-gradient(270deg in oklab,red,blue) #g", "null",
  "linear-gradient(90deg,red,blue), linear-gradient(to right, red, blue) #g", "physical-unflippable:gradient-angle",
  "physical-unflippable:gradient-angle", "physical-unflippable:gradient-angle",
  "physical-unflippable:gradient-angle", "#f0eee6 linear-gradient(225deg,#f0eee6 0%,#e8e6dc 100%) #g",
  "360deg", "0.5turn",
  "kept:true", "kept:false", "kept:false", "kept:false", "kept:true", "kept:false", "kept:false",
];
expect("cml-rtl (ر30-ب): زاوية التدرّج الخطي تُعكس بوحداتها (deg وturn وrad وgrad والسالبة ومع فضاء الاستيفاء)، والرأسيّ وكلمات الجهة كما كانت، والعجزُ للبادئة القديمة والمخروطي بزاوية وغير الخلفية والمختصر بموضعٍ عددي",
  same(gaGot, gaWant), JSON.stringify(gaGot.map((g, i) => g === gaWant[i] ? "=" : g)));

// ★ (ر30-ب2، ١٤ جمادى الأولى ١٤٤٨هـ — طافرتا مراجعة ر30-ب الناجيتان R10 وR11) الحارس بنطاق المكوّن يفهرس قاعدة RTL بمركّبها الأخير وحده (subjectTokens):
// سلفٌ في قاعدة RTL (‎.zq-pane:dir(rtl) .zq-chip‎) لا يُبقي مستهلكًا يشاركه السلف وحده (‎.zq-pane .zq-other‎)، والمستهلك على المكوّن نفسه يبقى؛ والعلامات العامّة
// (مجموعات Tailwind وسمات الحال المشتركة) لا تعيّن مكوّنًا: مستهلكٌ لا يشارك قاعدة RTL إلا ‎[data-state]‎ أو ‎.group‎ يُقلب. في الورقة الحيّة وفي الحارس مباشرةً
const gtCss = [
  ".zq-pane:dir(rtl) .zq-chip{--zq-chip-left-on:0}", ".zq-pane .zq-other{padding-left:calc(4px * var(--zq-chip-left-on))}",
  ".zq-chip{padding-left:calc(5px * var(--zq-chip-left-on))}",
  "[dir=rtl] .zq-fade[data-state=open]{--zq-fade-left-on:0}", ".zq-menu[data-state=open]{padding-left:calc(6px * var(--zq-fade-left-on))}",
  ".group:dir(rtl) .zq-gx{--zq-gx-left-on:0}", ".group .zq-gy{margin-left:calc(7px * var(--zq-gx-left-on))}",
].join("\n");
const gtRules = RTL.parseCss(gtCss).rules, gtVars = RTL.rtlVarsOf(gtRules);
const gtHeld = gtRules.filter((r) => !RTL.condKind(r.sel) && r.decls.some((d) => !d.prop.startsWith("--")))
  .map((r) => r.sel + "=" + RTL.rtlVarHeld(r.decls[0].value, gtVars, r.sel));
const gtLive = RTL.buildLiveSheet([{ text: gtCss + "\n" + gdPad }], {}, { islands: [] });
const gtTiers = gtLive ? gdTiers(gtLive.css, RTL.LIVE_GATE) : [];
expect("cml-rtl (ر30-ب2، R10 وR11): حارس المكوّن يفهرس قاعدة RTL بمركّبها الأخير لا بسلفها، ولا تعيّن العلاماتُ العامّة ([data-state] و.group) مكوّنًا — المستهلك المشارك بها وحدها يُقلب",
  same(gtHeld, [".zq-pane .zq-other=false", ".zq-chip=true", ".zq-menu[data-state=open]=false", ".group .zq-gy=false"]) &&
  same(RTL.subjectTokens(".zq-pane:dir(rtl) .zq-chip"), [".zq-chip"]) && same(RTL.subjectTokens("[dir=rtl] .zq-fade[data-state=open]"), [".zq-fade"]) &&
  same(RTL.compTokens(".group .zq-gy[aria-expanded=true]"), [".zq-gy"]) &&
  !!gtLive && gtLive.stats.rtlVarHeld === 1 && !gtTiers.some((t) => /^\.zq-(?:other|menu|gy)=4/.test(t)),
  JSON.stringify({ gtHeld, st: gtLive && gtLive.stats.rtlVarHeld, subj: RTL.subjectTokens(".zq-pane:dir(rtl) .zq-chip") }));

// ★ (ر30-ب2 — حدّ «فحص الاتجاه»، R29B §٤) القائمة كما يقسمها القلب (coverageSels): المتفاوتة التخصيص جزءًا جزءًا، والمتساوية والمحدِّد الواحد كما كُتبا؛
// وبصماتُ التغطية في الورقة الحيّة (buildLiveSheet.coverage) بصماتُ الأجزاء نفسها، فالطبيب يبصم بها فيرى المقلوب مقلوبًا
const csLive = RTL.buildLiveSheet([{ text: ".zq-a, #zq-b{margin-left:4px}\n.zq-c, .zq-d{margin-left:5px}\n" + gdPad }], {}, { islands: [] });
const csCov = new Set((csLive && csLive.coverage) || []);
const csKeys = (sel, prop) => RTL.coverageSels(sel).map((x) => csCov.has(RTL.coverageKey([], x, prop)) ? "in" : "out").join("+");
expect("cml-rtl (ر30-ب2): أجزاء القائمة كما يقسمها القلب (coverageSels)، وبصمات الورقة الحيّة بصماتُ أجزائها (والقائمة كلها ليست بصمةً فيها)",
  same(RTL.coverageSels(".zq-a, #zq-b"), [".zq-a", "#zq-b"]) && same(RTL.coverageSels(".zq-c, .zq-d"), [".zq-c, .zq-d"]) && same(RTL.coverageSels(".zq-e"), [".zq-e"]) &&
  same(RTL.coverageSels(":is(.a, #b) .c"), [":is(.a, #b) .c"]) &&
  csKeys(".zq-a, #zq-b", "margin-left") === "in+in" && csKeys(".zq-c, .zq-d", "margin-left") === "in" &&
  !csCov.has(RTL.coverageKey([], ".zq-a, #zq-b", "margin-left")),
  JSON.stringify({ a: RTL.coverageSels(".zq-a, #zq-b"), k1: csKeys(".zq-a, #zq-b", "margin-left"), k2: csKeys(".zq-c, .zq-d", "margin-left") }));

// ★ (ر30-ب2 — مراجعة ر30-ب، O4) طبقةٌ شعاعية أو مخروطية موضعُها السيني عدديٌّ غير موسَّط إلى جانب زاويةٍ تُعكس: القيمة عجزٌ (لا يُعكس نصفها)؛ والموسَّط
// وكلمةُ الحافّة (تقلبها swapWords) يُعكسان، وبلا زاويةٍ تُعكس لا أثر
const o4 = [
  gaF("background-image", "linear-gradient(90deg,red,blue),radial-gradient(circle at 20% 30%,red,blue)"),
  gaF("background-image", "linear-gradient(90deg,red,blue),conic-gradient(at 8px 0,red,blue)"),
  gaF("background-image", "linear-gradient(90deg,red,blue),radial-gradient(ellipse at calc(100% - 4px) 50%,red,blue)"),
  gaF("background-image", "linear-gradient(90deg,red,blue),radial-gradient(circle at center,red,blue)"),
  gaF("background-image", "linear-gradient(90deg,red,blue),radial-gradient(at 50% 0,red,blue)"),
  gaF("background-image", "linear-gradient(90deg,red,blue),radial-gradient(at left top,red,blue)"),
  gaF("background-image", "linear-gradient(180deg,red,blue),radial-gradient(at 20% 0,red,blue)"),
  // (مراجعة ر30-ب2) وكلمة الحافّة الرأسية وحدها (السيني موسَّط) والصيغة الرباعية بكلمة حافّةٍ أفقية تُعكسان
  gaF("background-image", "linear-gradient(90deg,red,blue),radial-gradient(at top,red,blue)"),
  gaF("background-image", "linear-gradient(90deg,red,blue),radial-gradient(at top 20% left 10px,red,blue)"),
];
expect("cml-rtl (ر30-ب2، O4): التدرّج بزاوية مع طبقةٍ شعاعية أو مخروطية بموضعٍ عددي غير موسَّط عجزٌ، والموسَّط وكلمة الحافّة يُعكسان، وبلا زاويةٍ تُعكس لا أثر",
  same(o4, ["physical-unflippable:gradient-angle", "physical-unflippable:gradient-angle", "physical-unflippable:gradient-angle",
    "linear-gradient(270deg,red,blue),radial-gradient(circle at center,red,blue) #g", "linear-gradient(270deg,red,blue),radial-gradient(at 50% 0,red,blue) #g",
    "linear-gradient(270deg,red,blue),radial-gradient(at right top,red,blue) #g", "null",
    "linear-gradient(270deg,red,blue),radial-gradient(at top,red,blue) #g", "linear-gradient(270deg,red,blue),radial-gradient(at top 20% right 10px,red,blue) #g"]),
  JSON.stringify(o4));

// ★ (ر24-ب4 — طافرتان نجتا في ر24-ب2) أمانة الجزر (islandDrift) تحكم بالعرض والارتفاع والموضع الرأسي كما تحكم بالأفقي: حفيدٌ تغيّر عرضه وحده، أو نزل
// وحده، أو تغيّر ارتفاعه وحده، يُعدّ؛ وعلى الحدّ (بكسلان) لا يُعدّ
const dW = GEO.islandDrift(isA, isR(200, [["/0", 90, 10, 26, 10]]), 2), dY = GEO.islandDrift(isA, isR(200, [["/0", 90, 16, 20, 10]]), 2);
const dH = GEO.islandDrift(isA, isR(200, [["/0", 90, 10, 20, 15]]), 2), dE = GEO.islandDrift(isA, isR(200, [["/0", 90, 12, 22, 12]]), 2);
expect("rtl-geom (ر24-ب4): أمانة الجزر — انحراف العرض وحده، والرأسي وحده، والارتفاع وحده، يُعدّ كلٌّ منها؛ وعلى الحدّ لا يُعدّ",
  dW && dW.n === 1 && dW.first.dw === 6 && dW.first.dx === 0 && dY && dY.n === 1 && dY.first.dx === 0 && dH && dH.n === 1 && dE === null,
  JSON.stringify([dW, dY, dH, dE]));

// ★ (ر24-و، ثغرة اختبارٍ من مراجعة ر24-ب4) قراءة فحص الاتجاه جزرَ الورقة النقطية (pointIslandsOf في rtl-audit) سلوكًا لا نصًّا: خطة التشغيل (--plan) تطبع
// جزر كل نطاقٍ كما تُمرَّر إلى الجامع. بورقةٍ اصطناعية في نسخةٍ من الإضافة (--ext): قائمة المحدِّدات تُقسم ولا تُقسم الفاصلة داخل :not()، والقاعدة المعلَّمة
// داخل @media متروكة، والمعلَّمة بلا بوابة html متروكة (لا شرط لها في المعرَّب)، وغير المعلَّمة ليست جزيرة، وsite هو المحدِّد بلا مركّب html؛ وبالإضافة
// الحقيقية: جزر كل نطاقٍ مشحون هي محدِّدات islandSelectors لورقته النقطية (اسمها من مدخل النطاق في المانيفست) ذوات بوابة html، بعددها
const PEXT = path.join(BOX, "zq-ext-pisl");
fs.cpSync(inBox(EXT), PEXT, { recursive: true });
fs.writeFileSync(path.join(PEXT, "docs-point.css"),
  'html[data-cml="on"] .zq-a,\nhtml[data-cml="on"] .zq-b > pre {\n  direction: ltr;\n  --cml-island: ltr;\n}\n' +
  '@media (min-width: 1px) {\n  html[data-cml="on"] .zq-m { direction: ltr; --cml-island: ltr; }\n}\n' +
  '.zq-nohtml { direction: ltr; --cml-island: ltr; }\nhtml[data-cml="on"] .zq-plain { direction: ltr; }\n' +
  'html[data-cml="on"][data-cml-route="shell"] .zq-c:not(.zq-d, .zq-e) { direction: ltr; --cml-island: ltr; }\n');
const piS = planOf(["--domains=docs", "--ext=" + PEXT], "pisl1"), piR = planOf([], "pisl0");
const piMan = JSON.parse(fs.readFileSync(path.join(inBox(EXT), "manifest.json"), "utf8"));
await import(pathToFileURL(path.join(EXT, "cml-const.js")).href);
const piDoms = (globalThis.CMLConst || {}).DOMAINS || [];
const piWant = {};
for (const d of piDoms) {
  const e = piMan.content_scripts.find((c) => d.matches && c.matches[0] === d.matches[0]), f = e && (e.css || []).find((x) => /-point\.css$/.test(x));
  if (f) piWant[d.id] = RTL.islandSelectors(fs.readFileSync(path.join(inBox(EXT), f), "utf8")).sels.filter((s) => /^html[[:]/.test(s));
}
const piHead = (x) => x.site === x.full.replace(/^html(?:\[[^\]]*\]|:not\((?:[^()]|\([^()]*\))*\))*\s+/, "") && x.site !== x.full;
const piRj = (piR.j && piR.j.islands) || {};
expect("rtl-audit (ر24-و): جزر الورقة النقطية في خطة التشغيل — القائمة مقسومة بلا قسمة :not()، والمعلَّمة في @media وبلا بوابة html وغير المعلَّمة متروكة، وsite بلا مركّب html؛ " +
  "وجزر النطاقات المشحونة في الإضافة الحقيقية هي محدِّدات ورقتها النقطية من مدخلها في المانيفست",
  piS.r.code === 0 && same(piS.j && piS.j.islands && piS.j.islands.docs, [
    { full: 'html[data-cml="on"] .zq-a', site: ".zq-a" }, { full: 'html[data-cml="on"] .zq-b > pre', site: ".zq-b > pre" },
    { full: 'html[data-cml="on"][data-cml-route="shell"] .zq-c:not(.zq-d, .zq-e)', site: ".zq-c:not(.zq-d, .zq-e)" }]) &&
  piR.r.code === 0 && same(Object.keys(piRj).sort(), ["academy", "app", "code", "docs", "legal", "privacy", "support"]) &&
  Object.keys(piRj).every((d) => same(piRj[d].map((x) => x.full), piWant[d] || []) && piRj[d].every(piHead)) &&
  Object.values(piRj).reduce((n, v) => n + v.length, 0) > 0,
  JSON.stringify(piS.j && piS.j.islands) + " | " + Object.entries(piRj).map(([d, v]) => d + ":" + v.length + "/" + (piWant[d] || []).length).join(","));

// ★ (ر24-و، ١٢ جمادى الأولى ١٤٤٨هـ — PLAN §٧ الخطر 3، من ر20-ب) حاجز الإصدار النهائي: verify-package --release --final يرفض باسمه كل نطاقٍ قادم له مطابقةٌ في
// المانيفست وكل صنف مسارٍ قادم حُقن قاموسه، والمسار الحقيقي لـmake-release (وجهةٌ تُكتب فيها بنية النشر) يطلبه.
// ★ (ر28-ب، ٢٠ جمادى الأولى ١٤٤٨هـ — السؤال 2 على افتراضه) ومانيفست الإضافة الحقيقي يحجب مدخلي com وportal (build.mjs ‏packageEntries): فالحكم الخالص
// (inertInRelease) عليه لا شيء، ومداخله النطاقاتُ المشحونة وحدها بترتيب الجدول. والمانيفست بمدخلي القادمين (irUp) يُبنى هنا من الحقيقي ومعه مدخلاهما بمولّد
// البناء نفسه (manifest-entry.mjs ‏contentScriptFor)، فتبقى حالات الحاجز كما كانت: com وportal بالاسم؛ وبحجب مدخليهما لا شيء؛ وبشحنهما (status بلا
// upcoming) لا شيء؛ وقاموس صنف لوحة المطوّرين القادم محقونًا يُسمّى؛ ونمطُ مطابقةِ نطاقٍ قادم في مدخلٍ آخر يُسمّى به. ثم البوابة نفسها والمسار الحقيقي في
// النسخة ومانيفست irUp مكتوبٌ فيها (ثم يُعاد مانيفستها): سطرا الاسمين مع --final وحده، ومجلد الوجهة لا يُنشأ؛ وبمانيفستها المحجوب لا سطر لنطاقٍ قادم ولا
// لنطاقٍ مشحونٍ بلا مدخل، وبحذف مدخل نطاقٍ مشحون (legal) يُسمّى. (في النسخة تُخفق البوابة لأسبابٍ أخرى — لا قفل خطوط — فالحكم على سطور النطاقات؛ وبوابة
// اليوم --release --final على الشجرة الحقيقية خضراء)
const { inertInRelease } = await import(pathToFileURL(T("domain-arg.mjs")).href);
const { contentScriptFor: irEntry } = await import(pathToFileURL(T("manifest-entry.mjs")).href);
const IC = globalThis.CMLConst, irMan = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
const irIds = (m) => inertInRelease(m, IC).map((x) => x.id + (x.matches ? "=" + x.matches.join(" ") : "") + (x.dict ? "=" + x.dict : "")).join(",");
const irDomOf = (cs) => (IC.DOMAINS.find((d) => same(d.matches, cs.matches)) || {}).id;
const irUp = JSON.parse(JSON.stringify(irMan));
irUp.content_scripts = IC.DOMAINS.map((d) => irMan.content_scripts.find((cs) => same(cs.matches, d.matches)) || irEntry(d, IC, EXT));
const irClone = () => JSON.parse(JSON.stringify(irUp));
const irWithheld = irClone(); irWithheld.content_scripts = irWithheld.content_scripts.filter((cs) => !["com", "portal"].some((id) => JSON.stringify(cs.matches) === JSON.stringify(IC.domain(id).matches)));
const irRows = ["com", "portal"].map((id) => IC.domain(id)), irSt = irRows.map((d) => d.status);
irRows.forEach((d) => { d.status = { full: true }; });
const irShipped = irIds(irUp);
irRows.forEach((d, i) => { d.status = irSt[i]; });
const irCls = irClone(); irCls.content_scripts.find((cs) => cs.js.includes("dict-docs.js")).js.splice(-1, 0, "dict-console.js");
const irClsW = JSON.parse(JSON.stringify(irWithheld)); irClsW.content_scripts.find((cs) => cs.js.includes("dict-docs.js")).js.splice(-1, 0, "dict-console.js");
const irOver = JSON.parse(JSON.stringify(irWithheld)); irOver.content_scripts[0].matches = irOver.content_scripts[0].matches.concat(["https://claude.com/*"]);
const irDest = path.join(BOX, "zq-release-dest");
const irBoxMf = path.join(inBox(EXT), "manifest.json"), irBox0 = fs.readFileSync(irBoxMf, "utf8");
const irWrite = (cs) => fs.writeFileSync(irBoxMf, JSON.stringify(Object.assign(JSON.parse(irBox0), { content_scripts: cs }), null, 2) + "\n");
const vpF0 = run([T("verify-package.mjs"), "--release", "--final"]);
irWrite(JSON.parse(irBox0).content_scripts.filter((cs) => !cs.matches.includes("https://www.anthropic.com/legal/*")));
const vpMiss = run([T("verify-package.mjs"), "--release"]);
irWrite(irUp.content_scripts);
const vpF = run([T("verify-package.mjs"), "--release", "--final"]), vpR = run([T("verify-package.mjs"), "--release"]), mrR = run([T("make-release.mjs"), irDest]);
fs.writeFileSync(irBoxMf, irBox0);
const IR_LINES = /(^|\n)\s*- com: نطاقٌ قادم \(status\.upcoming\) له مطابقةٌ في المانيفست \(https:\/\/claude\.com\/\*\)[^\n]*الإصدار النهائي[\s\S]*\n\s*- portal: نطاقٌ قادم \(status\.upcoming\) له مطابقةٌ في المانيفست \(https:\/\/portal\.anthropic\.com\/\*\)/;
const IR_ANY = /نطاقٌ قادم \(status\.upcoming\) له مطابقةٌ في المانيفست|نطاقٌ مشحون في الجدول بلا مدخلٍ في المانيفست/;
expect("verify-package --final (ر24-و، الخطر 3؛ ر28-ب): مانيفست الحزمة يحجب النطاقين القادمين ومداخلُه للمشحونة وحدها، ونطاقٌ مشحون بلا مدخلٍ يُرفض باسمه؛ ونطاقٌ قادم بمطابقةٍ وصنفٌ قادم بقاموسٍ محقون يُرفضان باسميهما، ويمرّ ما حُجب أو شُحن؛ والمسار الحقيقي لـmake-release يطلبه ولا تُنشأ وجهته",
  irIds(irMan) === "" && same(irMan.content_scripts.map(irDomOf), IC.DOMAINS.filter((d) => !IC.upcoming(d.id)).map((d) => d.id)) &&
  same(IC.DOMAINS.filter((d) => IC.upcoming(d.id)).map((d) => d.id), ["com", "portal"]) &&
  irIds(irUp) === "com=https://claude.com/*,portal=https://portal.anthropic.com/*" && irIds(irWithheld) === "" && irShipped === "" &&
  same(irWithheld.content_scripts, irMan.content_scripts) && irWithheld.content_scripts.length === irUp.content_scripts.length - 2 &&
  irIds(irCls) === "docs/console=dict-console.js,com=https://claude.com/*,portal=https://portal.anthropic.com/*" &&
  irIds(irClsW) === "docs/console=dict-console.js" && irIds(irOver) === "com=https://claude.com/*" &&
  !IR_ANY.test(vpF0.out) && /نطاقٌ مشحون في الجدول بلا مدخلٍ في المانيفست: legal/.test(vpMiss.out) && vpMiss.code !== 0 &&
  IR_LINES.test(vpF.out) && vpF.code !== 0 && !/الإصدار النهائي/.test(vpR.out) &&
  mrR.code === 1 && /بوابة الحزمة \(--release --final\) أخفقت/.test(mrR.out) && IR_LINES.test(mrR.out) && !fs.existsSync(irDest) &&
  fs.readFileSync(irBoxMf, "utf8") === irBox0,
  [irIds(irMan), irMan.content_scripts.map(irDomOf).join(","), irIds(irUp), irIds(irWithheld), irShipped, irIds(irCls), irIds(irClsW), irIds(irOver),
   IR_ANY.test(vpF0.out), vpMiss.code, vpF.code, mrR.code, fs.existsSync(irDest)].join(" | ") + " " + mrR.out.slice(-300));

// ★ (ت10-0، ١٣ جمادى الأولى ١٤٤٨هـ) بوابة اللفظ الإنجليزي وسط العربية (partial-english.mjs): قاموسٌ وفهرسٌ اصطناعيان في الصندوق. نمطٌ عامٌّ يلتقط لفظًا
// عاديًّا يُعدّ، والاسم والرمز والمسار والحرفيّ المراجَع ومقطع ‎<code>‎ لا تُعدّ، والمقطع الباقي بلا ترجمةٍ بجوار مقطعٍ مترجَم يُعدّ؛ وحالةٌ جديدة تُخرج 1، والتحسّن يُطبع
{
  const peDir = path.join(BOX, "zq-pe"); fs.mkdirSync(peDir, { recursive: true });
  // (ت10-هـ1) والحرفيّ صار يُحكم عليه: فكلمة الرمز الصغيرة المتعمَّدة «zqtool» يُبقيها نصّان مراجَعان (الثاني ليس في الفهرس)، فتمرّ كما كانت
  const peDict = { _meta: { language: "ar" }, strings: { "Zqshow": "عرض", "Zqrun zqtool": "شغّل zqtool", "Zqstop zqtool": "أوقف zqtool" }, plurals: {},
    patterns: [{ en: "Zqopen {x}", re: "^Zqopen (.+)$", ar: "فتح $1" }] };
  writeJson(inBox(path.join(DICTS, "ar.json")), peDict);
  const peCat = path.join(peDir, "cat.txt"), peBase = path.join(peDir, "base.json");
  const lines = ["Zqopen zqfoo widgets", "Zqopen Zqalpha", "Zqopen ~/.zqrc", "Zqrun zqtool", "<b>Zqshow</b> zqmore items", "<code>zqcmd run</code> <b>Zqshow</b>", "Zqopen {name}"];
  fs.writeFileSync(peCat, lines.join("\n") + "\n");
  const pe = (extra) => run([T("partial-english.mjs"), "--catalog=" + peCat, "--baseline=" + peBase, ...(extra || [])]);
  const w = pe(["--write-baseline"]), ok = pe();
  let base = {}; try { base = JSON.parse(fs.readFileSync(peBase, "utf8")); } catch {} // أداةٌ تنهار لا تكتب خطّ الأساس: يُخفق الفحص باسمه لا الحزامُ كلّه
  fs.writeFileSync(peCat, lines.concat(["Zqopen zqbar gadgets"]).join("\n") + "\n");
  const fresh = pe();
  fs.writeFileSync(peCat, lines.filter((l) => l !== "Zqopen zqfoo widgets").join("\n") + "\n");
  const gone = pe(); // الرسالة غابت عن الفهرس: لا إصلاح
  fs.writeFileSync(peCat, lines.map((l) => (l === "Zqopen zqfoo widgets" ? "Zqopen zqfoo widgets" : l)).join("\n") + "\n");
  peDict.strings["Zqopen zqfoo widgets"] = "فتح الأدوات"; writeJson(inBox(path.join(DICTS, "ar.json")), peDict); // (ت10-هـ1) مدخلٌ عربيٌّ كله: حرفيٌّ يُبقي لفظًا عاديًّا لا يُعدّ إصلاحًا الآن
  const better = pe(); // الرسالة في الفهرس وصار لها مدخلٌ حرفيّ: إصلاح
  expect("partial-english (ت10-0): النمط العامّ الملتقِط لفظًا عاديًّا والمقطع الباقي بجوار مترجَم يُعدّان (2)، والاسم والرمز والمسار والحرفيّ ومقطع code والقيمة النموذجية لا؛ " +
    "وخطّ الأساس ببصماتٍ لا نصوص، والجديد يُخرج 1، والزائل تحسّنٌ يُطبع",
    w.code === 0 && ok.code === 0 && base.app && base.app.count === 2 && base.app.fps.length === 2 && !/zq/i.test(JSON.stringify(base)) &&
    /: 2 \(/.test(ok.out) && fresh.code === 1 && /جديدة ليست فيه: 1/.test(fresh.out) && better.code === 0 && /أُصلح منه 1/.test(better.out) && !/ليس في هذا الفهرس/.test(better.out) && gone.code === 0 && /ليس في هذا الفهرس منه 1/.test(gone.out) && !/أُصلح منه/.test(gone.out),
    [w.code, ok.code, JSON.stringify(base.app && base.app.count), fresh.code, gone.code, better.code].join(" | ") + " " + ok.out.slice(-300) + " " + gone.out.slice(-200) + " " + better.out.slice(-200));
  fs.rmSync(inBox(path.join(DICTS, "ar.json")), { force: true });
}

// ★ (ت10-هـ1، ٢٠ جمادى الأولى ١٤٤٨هـ) بوابة اللفظ الإنجليزي تحكم على مخرَج الحرفيّ (strings وoverrides) والجمع لا على النمط والمقطع وحدهما:
// حرفيٌّ يترك لفظًا عاديًّا يُعدّ، وصيغة جمعٍ تتركه تُعدّ، وتصحيح المستخدم كذلك؛ وكلمةُ رمزٍ صغيرة متعمَّدة (نادرةٌ في الفهرس ويُبقيها نصٌّ مراجَعٌ آخر)
// تمرّ، ولا يُعفي النصُّ نفسَه ولا مفتاحان بالعربية نفسها أحدُهما الآخر، والشائعة في الفهرس (25 رسالةً فأكثر) تُعدّ ولو أبقاها نصّان؛ والاسم (حرفٌ كبير
// في أولها أو وسطها، ورابطٌ بين اسمين) والرمز بحدوده (كتلةٌ فيها علامة، وما بين ‎`…`‎، والامتداد) لا تُعدّ؛ والنمط والمقطع كما كانا
{
  const qDir = path.join(BOX, "zq-pe2"); fs.mkdirSync(qDir, { recursive: true });
  const qDict = { _meta: { language: "ar" },
    strings: { "Zqshow": "عرض", "Zqrun zqtool": "شغّل zqtool", "Zqstop zqtool": "أوقف zqtool", "Zqsave zqitems": "احفظ zqitems",
      "Zqa zqcommon": "أ zqcommon", "Zqb zqcommon": "ب zqcommon", "Zqsave zqdup": "احفظ zqdup", "zqsave zqdup": "احفظ zqdup",
      "Zqget Zqalpha for Zqbeta": "احصل على Zqalpha for Zqbeta", "Zqsupports zqOS": "يدعم zqOS", "Zqexec `zqx start now`": "نفّذ `zqx start now`",
      "Zqclone zqorg/zqrepo-zqide": "انسخ zqorg/zqrepo-zqide", "Zqext zqfile.zqmd": "امتداد .zqmd", "Zqcall Zqalpha reads Zqbeta": "اتصل Zqalpha reads Zqbeta" },
    overrides: { "Zqmove zqthing": "انقل zqthing" },
    plurals: { "%d Zqfiles zqpending": { plural: "%d Zqfile zqpending", forms: ["%d ملف zqpending", "ملف واحد zqpending", "ملفان zqpending", "%d ملفات zqpending", "%d ملفًا zqpending", "%d ملف zqpending"] },
      "%d Zqruns": { plural: "%d Zqrun", forms: ["%d تشغيل", "تشغيل واحد", "تشغيلان", "%d تشغيلات", "%d تشغيلًا", "%d تشغيل"] } },
    patterns: [{ en: "Zqopen {x}", re: "^Zqopen (.+)$", ar: "فتح $1" }] };
  writeJson(inBox(path.join(DICTS, "ar.json")), qDict);
  const qCat = path.join(qDir, "cat.txt"), qBase = path.join(qDir, "base.json"), qList = path.join(qDir, "list.json");
  const flagged = ["Zqopen zqfoo widgets", "<b>Zqshow</b> zqmore items", "Zqsave zqitems", "Zqa zqcommon", "Zqb zqcommon", "Zqsave zqdup", "zqsave zqdup",
    "Zqmove zqthing", "{count, plural, one {# Zqfile zqpending} other {# Zqfiles zqpending}}", "Zqcall Zqalpha reads Zqbeta", "Zqopen {org} on Zqcloud"];
  const clean = ["Zqopen Zqalpha", "Zqopen ~/.zqrc", "Zqrun zqtool", "Zqstop zqtool", "<code>zqcmd run</code> <b>Zqshow</b>", "Zqopen {name}",
    "Zqget Zqalpha for Zqbeta", "Zqsupports zqOS", "Zqexec `zqx start now`", "Zqclone zqorg/zqrepo-zqide", "Zqext zqfile.zqmd", "{count, plural, one {# Zqrun} other {# Zqruns}}"];
  const fill = Array.from({ length: 25 }, (_, i) => "Zqfill" + i + " zqcommon");
  fs.writeFileSync(qCat, flagged.concat(clean, fill).join("\n") + "\n");
  const qw = run([T("partial-english.mjs"), "--catalog=" + qCat, "--baseline=" + qBase, "--list=" + qList, "--write-baseline"]);
  let list = []; try { list = JSON.parse(fs.readFileSync(qList, "utf8")); } catch {}
  const got = new Map(list.map((c) => [c.en, [...new Set(c.samples.map((x) => x.how))].sort().join("+")]));
  const want = { "Zqopen zqfoo widgets": "pattern", "<b>Zqshow</b> zqmore items": "fragments", "Zqsave zqitems": "exact", "Zqa zqcommon": "exact", "Zqb zqcommon": "exact",
    "Zqsave zqdup": "exact", "zqsave zqdup": "exact", "Zqmove zqthing": "override", "{count, plural, one {# Zqfile zqpending} other {# Zqfiles zqpending}}": "plural",
    // ★ (مراجعة ت10-هـ1) كلمةٌ عاديةٌ بين اسمين ليست رابطًا: الرابط قائمةٌ مغلقة (for وin وon…)
    "Zqcall Zqalpha reads Zqbeta": "exact",
    // والرابط بجوار قيمةٍ ملتقَطة (Zeddicus) رابطُ جملةٍ بقي من الإنجليزية لا اسم: «فتح Zeddicus on Zqcloud» يُعدّ
    "Zqopen {org} on Zqcloud": "pattern" };
  const wrong = Object.entries(want).filter(([en, how]) => got.get(en) !== how).map(([en, how]) => en + "≠" + how + ":" + got.get(en))
    .concat(clean.filter((en) => got.has(en)).map((en) => en + " counted"));
  let qb = {}; try { qb = JSON.parse(fs.readFileSync(qBase, "utf8")); } catch {}
  const qok = run([T("partial-english.mjs"), "--catalog=" + qCat, "--baseline=" + qBase]);
  // حرفيٌّ جديدٌ يترك لفظًا عاديًّا (وصيغةُ جمعٍ جديدة تتركه) بعد خطّ الأساس: حالتان جديدتان والخروج 1
  qDict.strings["Zqload zqrows"] = "تحميل zqrows";
  qDict.plurals["%d Zqjobs zqqueued"] = { plural: "%d Zqjob zqqueued", forms: ["%d مهمة zqqueued", "مهمة واحدة zqqueued", "مهمتان zqqueued", "%d مهام zqqueued", "%d مهمةً zqqueued", "%d مهمة zqqueued"] };
  writeJson(inBox(path.join(DICTS, "ar.json")), qDict);
  fs.writeFileSync(qCat, flagged.concat(clean, fill, ["Zqload zqrows", "{n, plural, one {# Zqjob zqqueued} other {# Zqjobs zqqueued}}"]).join("\n") + "\n");
  const qnew = run([T("partial-english.mjs"), "--catalog=" + qCat, "--baseline=" + qBase]);
  expect("partial-english (ت10-هـ1): الحرفيّ وتصحيح المستخدم والجمع يُحكم عليها — اللفظ العاديّ يُعدّ (والنادر الذي لا يُبقيه إلا نصُّه، والمكرّر بالعربية نفسها، والشائع ولو أبقاه نصّان)، " +
    "وكلمة الرمز المتعمَّدة والاسم والرابط بين اسمين والحرف الكبير في الوسط والرمز بحدوده والامتداد لا تُعدّ؛ والنمط والمقطع كما كانا؛ وحرفيٌّ وجمعٌ جديدان بعد خطّ الأساس يُخرجان 1",
    qw.code === 0 && wrong.length === 0 && list.length === flagged.length && qb.app && qb.app.count === flagged.length && !/zq/i.test(JSON.stringify(qb)) &&
    qok.code === 0 && /exact 6/.test(qok.out) && /plural \d/.test(qok.out) && /override 1/.test(qok.out) &&
    qnew.code === 1 && /جديدة ليست فيه: 2/.test(qnew.out),
    [qw.code, qok.code, qnew.code, list.length, JSON.stringify(qb.app && qb.app.count), wrong.join(" ; ")].join(" | ") + " " + qok.out.slice(-300) + " " + qnew.out.slice(-200));
  fs.rmSync(inBox(path.join(DICTS, "ar.json")), { force: true });
}

// ★ (ت10-0) validate-batch --icu-ar: جمعٌ بالعربية بأقسامه الست واختيارٌ بفروع الإنجليزية يمرّان، والجمع الناقص والاختيار الناقص والمتغيّر الساقط تُرفض؛ وبلا الخيار
// يبقى فحص الفروع بالتساوي (فالأقسام الست تُرفض كما كانت)
{
  const vb = path.join(BOX, "zq-icu"); fs.mkdirSync(vb, { recursive: true });
  const en = ["{count, plural, one {Zq # item} other {Zq # items}}", "Zq {who} picked {kind, select, file {a file} other {something}}", "Zq plain {name}",
    "{n, plural, one {Zq # by {who}} other {Zq # by {who}}}"];
  const six = (x) => `{n, plural, zero {${x}} one {${x}} two {${x}} few {${x}} many {${x}} other {${x}}}`;
  fs.writeFileSync(path.join(vb, "in.txt"), en.join("\n") + "\n");
  writeJson(path.join(vb, "good.json"), [{ en: en[0], ar: "{count, plural, zero {لا Zq} one {Zq واحد} two {Zqان} few {# Zq} many {# Zq} other {# Zq}}" },
    { en: en[1], ar: "اختار {who} {kind, select, file {ملفًّا} other {شيئًا}} Zq" }, { en: en[2], ar: "Zq عادي {name}" }, { en: en[3], ar: six("# Zq من {who}") }]);
  writeJson(path.join(vb, "bad.json"), [{ en: en[0], ar: "{count, plural, one {Zq واحد} other {# Zq}}" },
    { en: en[1], ar: "اختار {who} {kind, select, other {شيئًا}} Zq" }, { en: en[2], ar: "Zq عادي" }, { en: en[3], ar: six("# Zq") }]);
  const g = run([T("validate-batch.mjs"), "--icu-ar", path.join(vb, "in.txt"), path.join(vb, "good.json")]);
  const b = run([T("validate-batch.mjs"), "--icu-ar", path.join(vb, "in.txt"), path.join(vb, "bad.json")]);
  const l = run([T("validate-batch.mjs"), path.join(vb, "in.txt"), path.join(vb, "good.json")]);
  expect("validate-batch --icu-ar (ت10-0): الجمع بالأقسام الست والاختيار بفروعه يمرّان، والناقص منهما والمتغيّر الساقط تُرفض بأسمائها؛ وبلا الخيار يبقى فحص الفروع بالتساوي",
    g.code === 0 && b.code === 1 && /بلا: zero two few many/.test(b.out) && /فروع الاختيار \{kind\} مختلّة/.test(b.out) && /#2: متغيّرات مختلّة/.test(b.out) && /#3: متغيّرات ICU مختلّة/.test(b.out) && l.code === 1 && /فروع ICU مختلّة/.test(l.out),
    [g.code, b.code, l.code].join(" | ") + " " + b.out.slice(-300));
}

// ★ (ر29-س، ٢٠ جمادى الأولى ١٤٤٨هـ) validate-batch --icu-ar: وسوم رسالة ICU بالعرض لا بالنصّ الخام — الإنجليزية بقواعد en-US والعربية بقواعد ar عند
// القيم نفسها (0 و1 و2 و3 و11 و100 وكل =N في الجانبين، ولكل اختيارٍ كل فرع)، ووسوم كل عرضٍ بترتيبها؛ والوسوم خارج كل جمعٍ واختيار، والرسالة بلا ICU،
// وبلا الخيار: فحص اليوم على الخام كما كان. ستة فحوص (الموجز §4: وسمٌ في كل فرعٍ إنجليزي يتكرّر في الأقسام العربية الست)
{
  const vb = path.join(BOX, "zq-icu-tags"); fs.mkdirSync(vb, { recursive: true });
  const CATS = ["zero", "one", "two", "few", "many", "other"], AT = { zero: 0, one: 1, two: 2, few: 3, many: 11, other: 100 };
  const six = (f, nm = "count") => `{${nm}, plural, ${CATS.map((c) => `${c} {${f(c)}}`).join(" ")}}`;
  const vbRun = (name, items, flag = true) => {
    fs.writeFileSync(path.join(vb, name + ".txt"), items.map((x) => x.en).join("\n") + "\n");
    writeJson(path.join(vb, name + ".json"), items);
    return run([T("validate-batch.mjs"), ...(flag ? ["--icu-ar"] : []), path.join(vb, name + ".txt"), path.join(vb, name + ".json")]);
  };
  // (١) شكل n02: وسمٌ في كل فرعٍ إنجليزي (مرتين في one وother) وفي كل قسمٍ من الست يمرّ — ووسمٌ حول متغيّر، ووسمان متتاليان في الفرع
  const n02 = [{ en: "{count, plural, one {<b>Zq # item</b> zqfoo.} other {<b>Zq # items</b> zqfoo.}}", ar: six((c) => `<b>${c === "zero" ? "لا" : "#"} زق</b> زقق.`) },
    { en: "{count, plural, one {Zq set it to <b>{zone}</b>?} other {Zq set them to <b>{zone}</b>?}}", ar: six(() => "ضبط زق على <b>{zone}</b>؟") },
    { en: "{total, plural, one {# <words>zqopen</words><sr> zqnote</sr>} other {# <words>zqopen</words><sr> zqnotes</sr>}}", ar: six(() => "# <words>زق</words><sr> زقق</sr>", "total") }];
  const r1 = vbRun("n02", n02);
  expect("validate-batch --icu-ar (ر29-س): وسمٌ في كل فرعٍ إنجليزي وفي كل قسمٍ عربيٍّ من الست يمرّ (كان يُرفض «وسوم مختلّة» بالعدّ الخام)",
    r1.code === 0 && /أخطاء 0/.test(r1.out) && !/وسوم/.test(r1.out), r1.code + " " + r1.out.slice(-400));
  // (٢) قسمٌ عربيٌّ واحدٌ بلا الوسم يُرفض، والخطأ يسمّي قيمته وحدها — لكل قسمٍ من الست
  const miss = CATS.map((k, j) => ({ en: `{count, plural, one {<b>Zq${j} # item</b>} other {<b>Zq${j} # items</b>}}`, ar: six((c) => (c === k ? "# زق" : "<b># زق</b>")) }));
  const r2 = vbRun("miss", miss);
  const named = (out, j, ns, all = 6) => new RegExp(`#${j}: وسوم مختلّة في العروض \\(المختلّ ${ns.length} من ${all}: عند ${ns.map((n) => "count=" + n).join("؛ ")}\\)`).test(out);
  expect("validate-batch --icu-ar (ر29-س): قسمٌ عربيٌّ واحدٌ بلا الوسم يُرفض بقيمته وحدها، لكل قسمٍ من الست (0 و1 و2 و3 و11 و100)",
    r2.code === 1 && CATS.every((k, j) => named(r2.out, j, [AT[k]])) && /أخطاء 6/.test(r2.out), r2.code + " " + r2.out.slice(-600));
  // (٣) وقسمٌ بوسمٍ زائد يُرفض كذلك بقيمته وحدها
  const extra = CATS.map((k, j) => ({ en: `{count, plural, one {<b>Zq${j} # item</b>} other {<b>Zq${j} # items</b>}}`, ar: six((c) => (c === k ? "<b># زق</b> <i>زقق</i>" : "<b># زق</b>")) }));
  const r3 = vbRun("extra", extra);
  expect("validate-batch --icu-ar (ر29-س): قسمٌ عربيٌّ بوسمٍ زائد يُرفض بقيمته وحدها، لكل قسمٍ من الست",
    r3.code === 1 && CATS.every((k, j) => named(r3.out, j, [AT[k]])) && /أخطاء 6/.test(r3.out), r3.code + " " + r3.out.slice(-600));
  // (٤) الوسم في other الإنجليزية وحده: الصفحة تعرضه عند 0 و2 و3 و11 و100 لا عند 1 — فالعربية به في zero وtwo وfew وmany وother تمرّ، وبه في few وmany
  // وother وحدها تُرفض عند 0 و2 بالضبط؛ و=N من أيٍّ من الجانبين قيمةٌ تُعرض (=5 في الإنجليزية، و=7 في العربية وحدها)
  const enO = "{count, plural, one {Zq # item} other {Zq <b># items</b>}}", enEq = "{count, plural, =5 {<b>Zq five</b>} one {Zq # thing} other {Zq # things}}";
  const arEq = (five) => `{count, plural, =5 {${five}} ${CATS.map((c) => `${c} {# زق}`).join(" ")}}`;
  const r4g = vbRun("other-ok", [{ en: enO, ar: six((c) => (c === "one" ? "زق واحد" : "<b># زق</b>")) }, { en: enEq, ar: arEq("<b>خمسة زق</b>") }]);
  const r4b = vbRun("other-bad", [{ en: enO, ar: six((c) => (["few", "many", "other"].includes(c) ? "<b># زق</b>" : "زق")) }, { en: enEq, ar: arEq("خمسة زق") },
    { en: "{count, plural, one {Zq # bit} other {Zq # bits}}", ar: `{count, plural, =7 {<b>سبعة زق</b>} ${CATS.map((c) => `${c} {# زق}`).join(" ")}}` },
    { en: "{count, plural, =5 {<b>Zq five</b>} one {Zq # piece} other {Zq # pieces}}", ar: six(() => "# زق") }]);
  expect("validate-batch --icu-ar (ر29-س): وسم other الإنجليزية وحدها يُحكم بالعروض — العربية به في الأقسام إلا one تمرّ، وبه في few وmany وother وحدها تُرفض عند 0 و2 " +
    "بالضبط؛ و=5 الإنجليزية بلا وسمها في العربية تُرفض عند 5 (وفي العربية مفتاحها أو لا)، و=7 العربية وحدها بوسمٍ تُرفض عند 7",
    r4g.code === 0 && /أخطاء 0/.test(r4g.out) && r4b.code === 1 && named(r4b.out, 0, [0, 2]) && named(r4b.out, 1, [5], 7) && named(r4b.out, 2, [7], 7) &&
      named(r4b.out, 3, [5], 7),
    [r4g.code, r4b.code].join(" | ") + " " + r4g.out.slice(-300) + " " + r4b.out.slice(-500));
  // (٥) اختيارٌ بوسومٍ في فروعه: الفروع كالإنجليزية تمرّ؛ وفرعٌ بلا وسمه، ووسمٌ انتقل من فرعٍ إلى آخر، ووسمان تبادلا موضعيهما (الترتيب) تُرفض
  const s1 = "Zq {kind, select, file {<b>{name}</b> zqfile} other {<b>{name}</b> zqitem}}", s2 = "Zq {has, select, true {<b>{masked}</b>} other {zqmail}}",
    s3 = "Zq {kind, select, a {<b>zqx</b> <i>zqy</i>} other {zqz}}";
  const r5g = vbRun("sel-ok", [{ en: s1, ar: "زق {kind, select, file {<b>{name}</b> ملف} other {<b>{name}</b> عنصر}}" },
    { en: s2, ar: "زق {has, select, true {<b>{masked}</b>} other {بريدك}}" }, { en: s3, ar: "{kind, select, a {<b>س</b> <i>ص</i>} other {ع}} زق" }]);
  const r5b = vbRun("sel-bad", [{ en: s1, ar: "زق {kind, select, file {{name} ملف} other {<b>{name}</b> عنصر}}" },
    { en: s2, ar: "زق {has, select, true {{masked}} other {<b>بريدك</b>}}" }, { en: s3, ar: "{kind, select, a {<i>ص</i> <b>س</b>} other {ع}} زق" },
    { en: "Zq {mode, select, on {zqon} other {zqoff}}", ar: "زق {mode, select, on {مفعّل} dim {<b>خافت</b>} other {معطّل}}" }]);
  const selNamed = (out, j, at, n, all) => new RegExp(`#${j}: وسوم مختلّة في العروض \\(المختلّ ${n} من ${all}: عند ${at}\\)`).test(out);
  expect("validate-batch --icu-ar (ر29-س): اختيارٌ بوسومٍ في فروعه — كالإنجليزية يمرّ؛ وفرعٌ بلا وسمه، ووسمٌ انتقل إلى فرعٍ آخر، ووسمان متبادلان (الترتيب)، " +
    "وفرعٌ عربيٌّ زائد بوسم (يُعرض كذلك) تُرفض بفروعها",
    r5g.code === 0 && /أخطاء 0/.test(r5g.out) && r5b.code === 1 && selNamed(r5b.out, 0, "kind=file", 1, 2) && selNamed(r5b.out, 1, "has=true؛ has=other", 2, 2) &&
      selNamed(r5b.out, 2, "kind=a", 1, 2) && /الإنجليزية «<b><\/b><i><\/i>» والعربية «<i><\/i><b><\/b>»/.test(r5b.out) && selNamed(r5b.out, 3, "mode=dim", 1, 3),
    [r5g.code, r5b.code].join(" | ") + " " + r5g.out.slice(-300) + " " + r5b.out.slice(-600));
  // (٦) كما كان: رسالةٌ بلا ICU (المجموعة على الخام: وسمان متبادلان يمرّان والناقص يُرفض بالرسالة القديمة)، ورسالة ICU وسومها كلها خارج كل جمعٍ واختيار
  // (فحص اليوم على الخام كذلك)، وبلا ‎--icu-ar‎ شكلُ n02 يُرفض بالعدّ الخام وبفروع ICU كما كان
  const plain = "Zq <b>zqx</b> and <link>zqy</link>", outside = "<b>Zq</b> {count, plural, one {# item} other {# items}} <i>zq</i>";
  const r6g = vbRun("asis-ok", [{ en: plain, ar: "<link>ص</link> و<b>س</b> زق" }, { en: outside, ar: `<i>زق</i> ${six(() => "# زق")} <b>زق</b>` }]);
  const r6b = vbRun("asis-bad", [{ en: plain, ar: "<link>ص و<b>س</b> زق" }, { en: outside, ar: `${six(() => "# زق")} <b>زق</b>` }]);
  const r6d = vbRun("n02", n02, false);
  expect("validate-batch (ر29-س): الرسالة بلا ICU، ورسالة ICU وسومها خارج كل جمعٍ واختيار، وبلا ‎--icu-ar‎ — فحص الوسوم على الخام كما كان",
    r6g.code === 0 && /أخطاء 0/.test(r6g.out) && r6b.code === 1 && /#0: وسوم مختلّة: Zq <b>zqx/.test(r6b.out) && /#1: وسوم مختلّة: <b>Zq/.test(r6b.out) &&
      !/في العروض/.test(r6b.out) && r6d.code === 1 && /#0: وسوم مختلّة: \{count/.test(r6d.out) && /#0: فروع ICU مختلّة/.test(r6d.out) && !/في العروض/.test(r6d.out),
    [r6g.code, r6b.code, r6d.code].join(" | ") + " " + r6g.out.slice(-300) + " " + r6b.out.slice(-300) + " " + r6d.out.slice(-300));
  // (٧) (مراجعة ر29-س) اختيارٌ داخل فرعٍ من اختيارٍ آخر (شكل s02 وs04): الوسم الساقط من فرعه الداخلي تحت الفرع الأب يُرفض بالفرعين معًا — وكان يمرّ حين
  // يُعرض كل اختيارٍ وحده والبقية other — وكالإنجليزية يمرّ؛ وجمعٌ بـoffset:1 وسمُه ساقطٌ من other العربية وحدها يُرفض عند 101 (NUMS+1)، وكالإنجليزية يمرّ؛
  // والوسم في العرض بلا بياضه كما في الخام (‎<br />‎ في الإنجليزية و‎<br/>‎ في العربية يمرّ)
  const nest = "Zq {a, select, x {{b, select, y {<b>zqy</b>} other {zqn}}} other {zqo}}", offs = "{count, plural, offset:1 one {<b>#</b> zqone} other {<b>#</b> zqmore}}";
  const offAr = (miss) => `{count, plural, offset:1 ${CATS.map((c) => `${c} {${c === miss ? "# زق" : "<b>#</b> زق"}}`).join(" ")}}`;
  const r7g = vbRun("nest-ok", [{ en: nest, ar: "زق {a, select, x {{b, select, y {<b>ي</b>} other {ن}}} other {و}}" }, { en: offs, ar: offAr("") },
    { en: "{count, plural, one {Zq<br /># zqline} other {Zq<br /># zqlines}}", ar: six(() => "زق<br/># زق") }]); // والوسم بلا بياضه كما في الخام: ‎<br />‎ هو ‎<br/>‎
  const r7b = vbRun("nest-bad", [{ en: nest, ar: "زق {a, select, x {{b, select, y {ي} other {ن}}} other {و}}" }, { en: offs, ar: offAr("other") }]);
  expect("validate-batch --icu-ar (مراجعة ر29-س): اختيارٌ داخل فرع اختيار يُعرض بتراكيب الفروع (الوسم الساقط تحت الفرع الأب يُرفض بالفرعين)، والجمع بـoffset:1 " +
    "يُعرض عند NUMS+1 (وسم other العربية الساقط يُرفض عند 101)؛ وكالإنجليزية يمرّان",
    r7g.code === 0 && /أخطاء 0/.test(r7g.out) && r7b.code === 1 && /أخطاء 2/.test(r7b.out) && selNamed(r7b.out, 0, "a=x، b=y", 1, 4) &&
      new RegExp("#1: وسوم مختلّة في العروض \\(المختلّ 1 من 9: عند count=101\\)").test(r7b.out),
    [r7g.code, r7b.code].join(" | ") + " " + r7g.out.slice(-300) + " " + r7b.out.slice(-500));
}

// ★ (ر29-د، ١٣ جمادى الأولى ١٤٤٨هـ — بعد ر29-أ F1) صحة المحدِّدات (sel-health.mjs): مسار المتن من الجدول الحقيقي، والمفاتيح الساقطة في الصفحة،
// والإبقاء في النطاق لا في كل صفحة، والمحدِّد الذي لا يُحلَّل، وفقرة الفحص اللاتينية؛ ومصدر المسبار يقيس في DOM مصطنع (vm) بلا نصّ
{
  const SHL = await import(new URL("./sel-health.mjs", import.meta.url).href);
  await import(pathToFileURL(path.join(inBox(EXT), "cml-const.js")).href);
  const CC = globalThis.CMLConst, RM = SH.routeMode;
  const br = (d, p) => SHL.isBodyRoute(CC.domain(d).meta, p, RM);
  const routesOk = [br("support", "/en/articles/1-zq"), !br("support", "/en/"), !br("support", "/en/collections/1-zq"), br("legal", "/legal/aup"),
    !br("legal", "/legal/archive/zq"), br("docs", "/docs/en/intro"), br("code", "/docs/en/hooks"), !br("code", "/docs"), !br("code", "/docs/en/changelog"),
    !br("academy", "/courses/zq/zq"), !br("app", "/new")].every(Boolean);
  const v = SHL.selVerdict([
    { d: "legal", page: "/legal/privacy", counts: { bodySel: 0, dirSel: 3, siteLangSel: 1, keepSel: 0 } },
    { d: "legal", page: "/legal/aup", counts: { bodySel: 1, dirSel: 3, siteLangSel: 0, keepSel: 0 } },
    { d: "docs", page: "/docs/en/intro", counts: { bodySel: 2, dirSel: 9, siteLangSel: null, keepSel: 0 } },
    { d: "docs", page: "/docs/en/api/messages", counts: { bodySel: 1, dirSel: 9, siteLangSel: null, keepSel: 4 } },
    { d: "code", page: "/docs/en/hooks", counts: { bodySel: 3, dirSel: -1, siteLangSel: null, keepSel: null } },
  ]).map((x) => x.d + ":" + x.key + ":" + (x.page || "*")).join(",");
  const lp = [SHL.latinPara({ txt: "Zq this is an English paragraph of the policy text.", ar: 0, la: 41 }),
    !SHL.latinPara({ txt: "Claude Code", ar: 0, la: 10 }), !SHL.latinPara({ txt: "Zq mixed paragraph with Arabic عربيٌّ كثير here and there", ar: 9, la: 40 }),
    !SHL.latinPara({ txt: "Zq words only five here", ar: 0, la: 40 }),
    SHL.paraEl("P", ""), SHL.paraEl("div", "cell"), !SHL.paraEl("span", ""), !SHL.paraEl("a", ""), !SHL.paraEl("div", "")].every(Boolean);
  // المسبار في DOM مصطنع: يعدّ ولا يقرأ نصًّا، والمحدِّد الذي لا يُحلَّل ‎-1‎، والمفتاح الغائب null
  const fakeDoc = { querySelectorAll: (q) => { if (q === "zq-bad[") throw new Error("bad"); return { length: q === ".zq-body" ? 2 : 0 }; } };
  const probe = vm.runInNewContext(SHL.selProbeSrc({ bodySel: ".zq-body", dirSel: "zq-bad[", keepSel: ".zq-none" }), { document: fakeDoc });
  expect("sel-health (ر29-د): مسار المتن من الجدول، والساقط في الصفحة، والإبقاء في النطاق، والمحدِّد الذي لا يُحلَّل، والمسبار، وفقرة الفحص اللاتينية",
    routesOk && v === "legal:bodySel:/legal/privacy,legal:siteLangSel:/legal/aup,code:dirSel:/docs/en/hooks,legal:keepSel:*" && lp &&
    JSON.stringify(probe) === JSON.stringify({ bodySel: 2, bodyMain: null, dirSel: -1, siteLangSel: null, keepSel: 0 }) && SHL.missLine({ d: "legal", key: "bodySel", page: "/legal/privacy" }).indexOf("legal") >= 0,
    [routesOk, v, lp, JSON.stringify(probe)].join(" | "));

  // ★ (ر29-د2، ١٤ جمادى الأولى ١٤٤٨هـ — مراجعة ر29-د F4) حاوية المتن الرئيسة (bodyMain) مفتاحٌ بنفسه: المحدِّد المركّب يطابق بجزئه الثانوي (2) والحاوية
  // ساقطة (0) ⇒ يسقط bodyMain وحده في الحاصد وفحص الاتجاه وبوابة بدء المرحلة؛ وجدول النطاقات الحقيقي بلا خلل (كل مركّبٍ له حاويةٌ من أجزائه)،
  // والخللان يُكشفان في جدولٍ مصطنع؛ وأجزاء المحدِّد في المستوى الأعلى (‎:has(…)‎ جزءٌ واحد)
  const fakeDoc2 = { querySelectorAll: (q) => ({ length: q === ".zq-main" ? 0 : 2 }) };
  const probe2 = vm.runInNewContext(SHL.selProbeSrc({ bodySel: ".zq-main, .zq-toc", bodyMain: ".zq-main", dirSel: ".zq-dir" }), { document: fakeDoc2 });
  const v2 = SHL.selVerdict([
    { d: "code", page: "/docs/en/zq", counts: probe2 },
    { d: "docs", page: "/docs/en/zq-ok", counts: { bodySel: 2, bodyMain: 1, dirSel: 5, siteLangSel: null, keepSel: null } },
  ]).map((x) => x.d + ":" + x.key + ":" + (x.page || "*")).join(",");
  const gapsReal = SHL.tableGaps(CC.DOMAINS);
  const gapsFake = SHL.tableGaps([{ id: "zq1", meta: { bodySel: "#a, #b", bodyRoutes: { full: ["/"] } } }, { id: "zq2", meta: { bodySel: "#a, #b", bodyMain: "#c" } },
    { id: "zq3", meta: { bodySel: "#a" } }, { id: "zq4", meta: { bodySel: "#a, #b", bodyMain: "#b" } },
    // ★ (مراجعة ر29-د2) ومركّبٌ بلا مسارات متن (كالأكاديمية) يلزمه الحاوية أيضًا: بوابة بدء المرحلة تحكم بها في كل نطاقٍ له محدِّد متن
    { id: "zq5", meta: { bodySel: "#a, #b" } }]).map((x) => x.d).join(",");
  // ★ (مراجعة ر29-د2) والفاصلة والمعقوف داخل الاقتباس ليسا فاصلًا ولا إغلاقًا
  const partsQ = SHL.selParts("[data-zq='a], b'], .zq-y");
  const parts = SHL.selParts(CC.domain("docs").meta.bodySel);
  const mains = CC.DOMAINS.filter((d) => d.meta && SHL.selParts(d.meta.bodySel).length > 1).map((d) => d.id + "=" + d.meta.bodyMain).join(",");
  expect("sel-health (ر29-د2): حاوية المتن الرئيسة مفتاحٌ بنفسه (يسقط وحده والمحدِّد المركّب يطابق بجزئه الثانوي)، وجدول النطاقات: لكل مركّبٍ حاويةٌ من أجزائه",
    JSON.stringify(probe2) === JSON.stringify({ bodySel: 2, bodyMain: 0, dirSel: 2, siteLangSel: null, keepSel: null }) &&
    SHL.pageMisses(probe2).join(",") === "bodyMain" && v2 === "code:bodyMain:/docs/en/zq" && gapsReal.length === 0 && gapsFake === "zq1,zq2,zq5" &&
    partsQ.length === 2 && partsQ[0] === "[data-zq='a], b']" && partsQ[1] === ".zq-y" &&
    parts.length === 3 && parts[2] === "nav:has(li > a[href^='#'])" &&
    mains === "support=.article_body,privacy=.article_body,academy=article.mdx-article,docs=.docs-prose, .stldocs-root,code=#content" &&
    SHL.missLine({ d: "code", key: "bodyMain", page: "/docs/en/zq" }).indexOf("حاوية المتن") >= 0,
    [JSON.stringify(probe2), v2, JSON.stringify(gapsReal), gapsFake, JSON.stringify(parts), JSON.stringify(partsQ), mains].join(" | "));
}

// ★ (DX0-0، ١٩ جمادى الأولى ١٤٤٨هـ) خريطة الانجراف (drift-map.mjs): الفرق بالكلمات وتشابهه، والأصناف الثلاثة على حدودها، والصفحة نفسها أولًا
// وتقدُّم كتلة الموقع عليها بأكثر من 0.05، والبصمة المترجمة في دفعةٍ لم تُدمج، والأجزاء بترتيب البادئات والتجاور والحجم، ثم الأداة كلها على حصادٍ
// ودفعةٍ وقاموسٍ اصطناعية (كلماتٌ «Zq» مخترعة، لا نصَّ من المواقع) ورفضُها الكتابةَ فوق أجزاءٍ قائمة
{
  const DM = await import(pathToFileURL(T("drift-map.mjs")).href);
  const d1 = DM.wordDiff(["Zq", "alpha", "beta", "gamma", "delta"], ["Zq", "alpha", "beta", "gamma", "epsilon"]);
  const d2 = DM.wordDiff(["Zqa", "Zqb", "Zqc"], ["Zqc", "Zqa", "Zqb"]);
  expect("drift-map: الفرق بالكلمات (أطول تتابعٍ مشترك: المضاف والمحذوف) وتشابهه، والكلمات بعدّ الحاصد (الذرّة البرمجية لا تُعدّ)",
    d1.lcs === 4 && d1.added.join() === "epsilon" && d1.removed.join() === "delta" && DM.simOf(d1, 5, 5) === 0.8 &&
    d2.lcs === 2 && d2.added.join() === "Zqc" && d2.removed.join() === "Zqc" &&
    DM.wordsOf("Zq one <c1>zq_code two</c1> <a2>three</a2>") === 3 && DM.plainOf("<s1>Zq  one</s1> <c2>x</c2>") === "Zq one x" &&
    DM.skeletonOf("<s1>Zq <a2>b</a2></s1><g3/>") === "<s><a></a></s><g/>",
    JSON.stringify([d1, d2]));
  const best = (src, sim, lcs) => ({ src, sim, lcs });
  expect("drift-map: الأصناف — same بالنص المرئي نفسه (الغلاف وحده تغيّر)، وedited على حدّ التشابه، وnew تحته أو بكلمةٍ مشتركة واحدة أو بلا مرشّح",
    DM.classify("<s1>Zq one two</s1>", best("Zq one two", 1, 3)) === "same" &&
    DM.classify("Zq one <a1>two</a1>", best("Zq <a1>one two</a1>", 1, 3)) === "same" &&
    DM.classify("Zq one two four", best("Zq one two three", 0.5, 2)) === "edited" &&
    DM.classify("Zq one two four", best("Zq one two three", 0.499, 2)) === "new" &&
    DM.classify("Zq one", best("Zq two", 0.5, 1)) === "new" && DM.classify("Zq one", null) === "new" &&
    DM.classify("Zq one two four", best("Zq one two three", 0.6, 2), 0.7) === "new" &&
    // الطباعة وحدها (الفاصلة العليا المنحنية) معدَّلٌ لا جديد ولو قلّ التشابه المحسوب قبلها، والتطبيع للمقارنة وحدها
    DM.classify("Zq don\u2019t go", best("Zq don't go", 0.33, 2)) === "edited" &&
    DM.typoOf("Zq\u2019s \u201Cx\u201D\u2026\u00A0y") === "Zq's \"x\"... y",
    "classify");
  const olds = [
    { fp: "zq00000000000001", src: "Zq alpha beta gamma delta", ar: "زق ألفا بيتا جاما دلتا", from: "dict", pages: new Set(["/zq/p1"]) },
    { fp: "zq00000000000002", src: "Zq alpha beta gamma delta", ar: "زق ألفا بيتا جاما دلتا (ب)", from: "dict", pages: new Set(["/zq/p2"]) },
    { fp: "zq00000000000003", src: "Zq kappa lambda mu nu xi omicron", ar: "زق كابا", from: "dict", pages: new Set(["/zq/p1"]) },
    { fp: "zq00000000000004", src: "Zq kappa lambda mu nu xi pi", ar: "زق كابا (ب)", from: "batch", pages: new Set(["/zq/p3"]) },
    { fp: "zq00000000000005", src: "Zq it's done fine", ar: "زق تمّ", from: "dict", pages: new Set(["/zq/p1"]) },
  ];
  const ix = DM.buildIndex(olds);
  const c1 = DM.closest(ix, "Zq alpha beta gamma epsilon", ["/zq/p2"]);
  const c2 = DM.closest(ix, "Zq alpha beta gamma epsilon", ["/zq/p1"]);
  const c3 = DM.closest(ix, "Zq kappa lambda mu nu xi pi", ["/zq/p1"]);
  const c4 = DM.closest(ix, "Zqx unrelated words only", ["/zq/p9"]);
  expect("drift-map: أقرب كتلة — الصفحة نفسها أولًا بين متساويين، وكتلة الموقع تتقدّم إن زادت بأكثر من 0.05، ولا مرشّح بلا كلمةٍ مشتركة",
    c1 && c1.fp === "zq00000000000002" && c1.samePage === true && c2 && c2.fp === "zq00000000000001" && c2.samePage === true &&
    c3 && c3.fp === "zq00000000000004" && c3.samePage === false && c3.sim === 1 && c3.from === "batch" && c4 === null,
    JSON.stringify([c1, c2, c3, c4]));
  const nb = [
    { fp: "zq10000000000001", tpl: "Zq alpha beta gamma epsilon", status: "todo", pages: ["/zq/p1"] },
    { fp: "zq10000000000002", tpl: "<s1>Zq kappa lambda mu nu xi omicron</s1>", status: "todo", pages: ["/zq/p1"] },
    { fp: "zq00000000000004", tpl: "Zq kappa lambda mu nu xi pi", status: "todo", pages: ["/zq/p3"] },
    { fp: "zq10000000000003", tpl: "Zqy fresh sentence entirely", status: "todo", pages: ["/zq/p1"] },
    { fp: "zq10000000000004", tpl: "Zq done", status: "dict", pages: ["/zq/p1"] },
    { fp: "zq10000000000005", tpl: "Zq it\u2019s done fine", status: "todo", pages: ["/zq/p1"] },
  ];
  const m = DM.mapDrift(nb, olds, { seen: new Set(["zq10000000000003"]) });
  const row = (fp) => m.rows.find((r) => r.fp === fp) || {};
  expect("drift-map: الخريطة — المغطّى خارجها ومعدودٌ في الحال، والمعدَّل بأساسه العربي وفرقه، والغلاف same بهيكلي الوسوم، والمترجمة في دفعةٍ هي نفسها، والثغرة المعروفة seen",
    m.rows.length === 5 && m.tally.dict === 1 && m.tally.todo === 5 &&
    row("zq10000000000005").class === "edited" && row("zq10000000000005").typo === true && row("zq10000000000005").diff.size === 0 &&
    row("zq10000000000005").base.fp === "zq00000000000005" && !row("zq10000000000001").typo && m.typo.blocks === 1 &&
    row("zq10000000000001").class === "edited" && row("zq10000000000001").base.ar === "زق ألفا بيتا جاما دلتا" && row("zq10000000000001").diff.size === 2 &&
    row("zq10000000000002").class === "same" && row("zq10000000000002").markup.new === "<s></s>" && row("zq10000000000002").markup.old === "" &&
    row("zq00000000000004").class === "same" && row("zq00000000000004").base.fp === "zq00000000000004" && !row("zq00000000000004").markup.new &&
    row("zq10000000000003").class === "new" && row("zq10000000000003").seen === true && !row("zq10000000000003").base &&
    m.counts.same === 2 && m.counts.edited === 2 && m.counts.new === 1 && m.words.new === 4,
    JSON.stringify(m.rows.map((r) => [r.fp, r.class, r.seen, r.base && r.base.fp])));
  const R = (fp, words) => ({ fp, src: "Zq " + fp, class: "new", words });
  const rows = [R("a1", 3), R("a2", 3), R("b1", 5), R("c1", 2), R("c2", 2), R("c3", 2), R("d1", 9)];
  const pg = { "/zq/rest": ["d1"], "/zq/top/sub": ["b1", "a1"], "/zq/top": ["a1", "a2"], "/zq/other": ["c1", "c2", "c3"] };
  const P = DM.partition(rows, pg, { order: ["/zq/top"], maxWords: 6, maxBlocks: 2, name: "zq" });
  const ids = P.map((p) => p.id + ":" + p.items.map((i) => i.fp).join("+") + "@" + p.pages.join("+")).join(" ");
  expect("drift-map: الأجزاء — صفحات البادئة أولًا (هي وما تحتها) بترتيب الحصاد، والبصمة مرةً واحدة، والصفحة لا تُقسم إلا أكبرَ من جزء، والحدّان بالكلمات والكتل",
    ids === "zq-000:b1@/zq/top/sub zq-001:a1+a2@/zq/top/sub+/zq/top zq-002:d1@/zq/rest zq-003:c1+c2@/zq/other zq-004:c3@/zq/other" &&
    P.reduce((a, p) => a + p.items.length, 0) === 7,
    ids);
  // الأداة كلها: حصادٌ جديد وقديم ودفعةٌ وقاموسٌ اصطناعية في مجلدٍ مؤقت
  const DMD = path.join(BOX, "zq-drift");
  fs.mkdirSync(DMD, { recursive: true });
  const hNew = path.join(DMD, "blocks-new.json");
  writeJson(hNew, { _tool: "harvest-dom --blocks", domain: "docs", at: "2099-01-01T00:00:00.000Z", v: 1,
    pages: { "/docs/en/zq-a": ["zq20000000000001", "zq20000000000002"], "/docs/en/zq-b": ["zq20000000000003"] }, urls: {}, tally: {},
    blocks: [{ fp: "zq20000000000001", tpl: "Zq alpha beta gamma epsilon", count: 1, pages: ["/docs/en/zq-a"], status: "todo" },
      { fp: "zq20000000000002", tpl: "Zq done here", count: 1, pages: ["/docs/en/zq-a"], status: "dict" },
      { fp: "zq20000000000003", tpl: "<s1>Zq kappa lambda</s1>", count: 1, pages: ["/docs/en/zq-b"], status: "todo" }] });
  writeJson(path.join(DMD, "old", "blocks-old.json"), { domain: "docs", pages: { "/docs/en/zq-a": ["zq30000000000001"] },
    blocks: [{ fp: "zq30000000000001", tpl: "Zq alpha beta gamma delta", pages: ["/docs/en/zq-a"], status: "dict" }] });
  writeJson(path.join(DMD, "batches", "p4-zq-000.json"), [{ fp: "zq30000000000002", src: "Zq kappa lambda", ar: "زق كابا لامدا" }]);
  writeJson(path.join(DMD, "dict.json"), { blocks: { zq30000000000001: "زق ألفا بيتا جاما دلتا" } });
  const dmArgs = [T("drift-map.mjs"), "--domain=docs", "--harvest=" + hNew, "--old=" + path.join(DMD, "old"), "--batches=" + path.join(DMD, "batches"),
    "--dict=" + path.join(DMD, "dict.json"), "--out=" + path.join(DMD, "map.json"), "--parts=" + path.join(DMD, "parts"), "--part-name=zq", "--order=/docs/en/zq-b"];
  const r1 = run(dmArgs);
  let mapOk = false, man = null, p0 = null;
  try {
    const mj = JSON.parse(fs.readFileSync(path.join(DMD, "map.json"), "utf8"));
    man = JSON.parse(fs.readFileSync(path.join(DMD, "parts", "zq-manifest.json"), "utf8"));
    p0 = JSON.parse(fs.readFileSync(path.join(DMD, "parts", "zq-000.json"), "utf8"));
    mapOk = mj.counts.same === 1 && mj.counts.edited === 1 && mj.counts.new === 0 && mj.tally.dict === 1 && mj.old.withArabic === 2 &&
      mj.blocks.find((b) => b.fp === "zq20000000000003").base.ar === "زق كابا لامدا";
  } catch (e) { mapOk = false; }
  const r2 = run(dmArgs);
  const r3 = run([T("drift-map.mjs"), "--domain=docs", "--harvest=" + hNew, "--min-sim=2"]);
  expect("drift-map: الأداة كلها (القاموس ثم الدفعة، والأجزاء بالبادئة أولًا ومعها الأساس العربي) ورفض الكتابة فوق أجزاءٍ قائمة وحدِّ تشابهٍ خارج 0…1",
    r1.code === 0 && mapOk && man && man.parts.length === 1 && man.parts[0].pages.join() === "/docs/en/zq-b,/docs/en/zq-a" &&
    p0 && p0[0].fp === "zq20000000000003" && p0[0].base.ar === "زق كابا لامدا" && p0[1].diff.size === 2 &&
    r2.code === 2 && /zq-NNN/.test(r2.out) && r3.code === 2,
    [r1.code, r1.out.slice(-300), r2.code, r3.code, JSON.stringify(man)].join(" | "));
  // ★ (مراجعة DX0-0) المصادر القديمة: الحصاد الجديد داخل مجلد القديم ليس مصدرًا قديمًا (ولا يجعل كتله «حُصدت قبلُ»)، ودفعات _draft لا تُقرأ،
  // وعربية القاموس المشحون تتقدّم على عربية الدفعة للبصمة نفسها
  const DM2 = path.join(BOX, "zq-drift2");
  writeJson(path.join(DM2, "h", "blocks-old.json"), { domain: "docs", pages: { "/docs/en/zq-c": ["zq40000000000001"] },
    blocks: [{ fp: "zq40000000000001", tpl: "Zq rho sigma tau upsilon", pages: ["/docs/en/zq-c"], status: "dict" }] });
  const hNew2 = path.join(DM2, "h", "blocks-zz-new.json");
  writeJson(hNew2, { _tool: "harvest-dom --blocks", domain: "docs", at: "2099-01-02T00:00:00.000Z", v: 1,
    pages: { "/docs/en/zq-c": ["zq50000000000001", "zq50000000000002", "zq50000000000003"] }, urls: {}, tally: {},
    blocks: [{ fp: "zq50000000000001", tpl: "Zq rho sigma tau phi", count: 1, pages: ["/docs/en/zq-c"], status: "todo" },
      { fp: "zq50000000000002", tpl: "Zqq chi psi omega", count: 1, pages: ["/docs/en/zq-c"], status: "todo" },
      { fp: "zq50000000000003", tpl: "Zqz lone words here", count: 1, pages: ["/docs/en/zq-c"], status: "todo" }] });
  writeJson(path.join(DM2, "batches", "p4-zq-001.json"), [{ fp: "zq40000000000001", src: "Zq rho sigma tau upsilon", ar: "زق رو من الدفعة" }]);
  writeJson(path.join(DM2, "batches", "_draft", "p4-zq-002.json"), [{ fp: "zq40000000000002", src: "Zqq chi psi omega", ar: "زق مسودة" }]);
  writeJson(path.join(DM2, "dict.json"), { blocks: { zq40000000000001: "زق رو من القاموس" } });
  const r4 = run([T("drift-map.mjs"), "--domain=docs", "--harvest=" + hNew2, "--old=" + path.join(DM2, "h"), "--batches=" + path.join(DM2, "batches"),
    "--dict=" + path.join(DM2, "dict.json"), "--out=" + path.join(DM2, "map.json")]);
  let m2 = null;
  try { m2 = JSON.parse(fs.readFileSync(path.join(DM2, "map.json"), "utf8")); } catch (e) { m2 = null; }
  const row2 = (fp) => (m2 && m2.blocks.find((b) => b.fp === fp)) || {};
  expect("drift-map: المصادر — الحصاد الجديد في مجلد القديم مستثنًى منه (لا «seen» لكتله)، ودفعات _draft لا تُقرأ، وعربية القاموس قبل عربية الدفعة",
    r4.code === 0 && m2 && m2.old.harvests.join() === "blocks-old.json" && m2.old.withArabic === 1 && m2.seenBefore === 0 &&
    row2("zq50000000000001").class === "edited" && row2("zq50000000000001").base.ar === "زق رو من القاموس" &&
    row2("zq50000000000002").class === "new" && !row2("zq50000000000002").base && !row2("zq50000000000002").seen && !row2("zq50000000000003").seen,
    [r4.code, r4.out.slice(-300), m2 && JSON.stringify(m2.old), m2 && JSON.stringify(m2.blocks.map((b) => [b.fp, b.class, b.seen, b.base && b.base.ar]))].join(" | "));
}

// ★ (ر29-ط، ١٩ جمادى الأولى ١٤٤٨هـ — C1 من ر29-ز) أداة اللقطة snapshot-css.mjs ترفض صفحة التحقّق (Cloudflare) كما يرفضها فحص الاتجاه (CHALLENGE_PROBE في
// cdp-lib.mjs، بنصّه فيهما): كانت تخرج ناجحةً وتكتب ورقتي التحقّق لقطةً فتُفرغ مجلدًا حقيقيًّا. على صفحاتٍ محلية يجيبها خادمٌ هنا على 127.0.0.1 (لا شبكة):
// صفحةٌ بالحالة 403 وعنوان التحقّق وحده، وأخرى بالحالة 503، وثالثةٌ بالحالة 200 ونموذج التحقّق وحده ⇒ الخروج 3 برسالةٍ عربية، واللقطة القائمة كما هي
// (لا يُكتب شيء)؛ وصفحةٌ عادية بالحالة 200 في عنوانها ونصّها «Just a moment» (النصّ وحده لا يكفي بلا 403 أو 503) ⇒ تُلقَط كما كانت.
// يحتاج كروم (CHROME أو مواضعه المعروفة، findChrome)، وبلا كروم يُذكر متروكًا ولا يُعدّ. والتشغيل غير متزامن: الخادم في هذه العملية
{
  const { findChrome } = await import(pathToFileURL(T("cdp-lib.mjs")).href);
  let chromeExe = null;
  try { chromeExe = findChrome(); } catch { chromeExe = null; }
  if (!chromeExe) skipped.push("snapshot-css وصفحة التحقّق: لا كروم (CHROME)");
  else {
    const http = await import("node:http");
    const { spawn } = await import("node:child_process");
    const page = (title, body, extra) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${extra || ""}` +
      `<style>.zq-chl{margin-left:3px}</style></head><body>${body}</body></html>`;
    const ROUTES = {
      "/chl403": [403, page("Just a moment...", "<p>Zq checking the browser before the site.</p>")],
      "/chl503": [503, page("Attention Required! | Zq", "<p>Zq please complete the security check.</p>")],
      "/chlform": [200, page("Zq page", '<form id="challenge-form" action="/?__cf_chl_f_tk=zq" method="POST"></form>')],
      "/ok": [200, page("Just a moment: a Zq lesson", "<p>Just a moment, this Zq page is real.</p>", '<link rel="stylesheet" href="/zq.css">')],
      "/zq.css": [200, ".zq-ok{padding-left:2px}", "text/css"],
      // ★ (مراجعة ر29-ط) صفحتا خطأٍ ليستا تحقّقًا: حجبٌ من Cloudflare (الخطأ 1020) بعنوانٍ لا يعرفه فحص التحقّق، وصفحة 404
      "/denied403": [403, page("Access denied | zq.test used Cloudflare to restrict access", "<p>Zq error 1020.</p>")],
      "/nf404": [404, page("Zq page not found", "<p>Zq 404.</p>")],
    };
    const srv = http.createServer((req, res) => {
      const r = ROUTES[req.url.split("?")[0]];
      if (!r) { res.writeHead(404); res.end("nf"); return; }
      res.writeHead(r[0], { "content-type": (r[2] || "text/html") + "; charset=utf-8" });
      res.end(r[1]);
    });
    await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
    const origin = "http://127.0.0.1:" + srv.address().port;
    // بلا وكيلٍ للعنوان المحلي (جلب الأوراق بـfetch في الأداة، وكروم)
    const env = Object.assign({}, process.env);
    for (const k of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy", "NODE_USE_ENV_PROXY"]) delete env[k];
    env.CHROME = chromeExe;
    const runAsync = (args) => new Promise((done) => {
      const p = spawn(process.execPath, args, { cwd: BOX, env });
      let out = "";
      p.stdout.on("data", (d) => { out += d; });
      p.stderr.on("data", (d) => { out += d; });
      const timer = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, 180000);
      p.on("close", (code) => { clearTimeout(timer); done({ code, out }); });
    });
    const SNAP = path.join(BOX, "snap-chl");
    const seeded = (name) => {
      const d = path.join(SNAP, name);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, "zq-sentinel.css"), ".zq-sentinel{margin-left:1px}\n");
      fs.writeFileSync(path.join(d, "_manifest.json"), '{"zq":"sentinel"}\n');
      return d;
    };
    const state = (d) => fs.readdirSync(d).sort().map((f) => f + "=" + fs.readFileSync(path.join(d, f), "utf8").length).join(",");
    try {
      for (const [name, why] of [["chl403", "الحالة 403 وعنوان التحقّق وحده"], ["chl503", "الحالة 503 وعنوان التحقّق وحده"], ["chlform", "الحالة 200 ونموذج التحقّق وحده"]]) {
        const d = seeded(name), before = state(d);
        const r = await runAsync([T("snapshot-css.mjs"), "--target=docs", "--url=" + origin + "/" + name, "--out=" + d]);
        expect(`snapshot-css (ر29-ط): صفحة تحقّقٍ (${why}) تُرفض بالخروج 3 ورسالةٍ عربية، ولا يُكتب شيء (اللقطة القائمة كما هي)`,
          r.code === 3 && /رُفضت اللقطة/.test(r.out) && /صفحةُ تحقّقٍ من Cloudflare/.test(r.out) && state(d) === before,
          [r.code, r.out.slice(-300), before, state(d)].join(" | "));
      }
      // ★ (مراجعة ر29-ط) وصفحة خطأٍ HTTP (الحالة 400 فما فوق) ليست صفحة الموقع وإن لم تكن تحقّقًا: تُرفض بالخروج 3 ولا يُكتب شيء
      for (const [name, st] of [["denied403", 403], ["nf404", 404]]) {
        const d0 = seeded(name), before0 = state(d0);
        const r0 = await runAsync([T("snapshot-css.mjs"), "--target=docs", "--url=" + origin + "/" + name, "--out=" + d0]);
        expect(`snapshot-css (مراجعة ر29-ط): صفحة خطأٍ بالحالة ${st} ليست تحقّقًا تُرفض كذلك بالخروج 3 ورسالةٍ عربية، ولا يُكتب شيء (اللقطة القائمة كما هي)`,
          r0.code === 3 && /رُفضت اللقطة/.test(r0.out) && new RegExp("أجابت بالحالة " + st).test(r0.out) && state(d0) === before0,
          [r0.code, r0.out.slice(-300), before0, state(d0)].join(" | "));
      }
      const d = seeded("ok");
      const r = await runAsync([T("snapshot-css.mjs"), "--target=docs", "--url=" + origin + "/ok", "--out=" + d]);
      let man = null; try { man = JSON.parse(fs.readFileSync(path.join(d, "_manifest.json"), "utf8")); } catch { man = null; }
      const files = fs.readdirSync(d).sort();
      expect("snapshot-css (ر29-ط): وصفحةٌ عادية بالحالة 200 في عنوانها ونصّها «Just a moment» تُلقَط كما كانت: الخروج 0، والورقتان (المرتبطة والمضمَّنة) بترتيب المستند، والقديمة حُذفت",
        r.code === 0 && man && man.css && man.css.length === 2 && man.css[0].file === "zq.css" && man.css[1].inline === true &&
          !files.includes("zq-sentinel.css") && files.includes("zq.css"),
        [r.code, r.out.slice(-300), files.join(","), man && JSON.stringify(man.css)].join(" | "));
      // ★ (ر27، ٢٠ جمادى الأولى ١٤٤٨هـ) وفحص الاتجاه بلا ‎--keep-going‎ على صفحتي تحقّقٍ محليتين (403 ثم 503، بعرض 390 كصفحة الدخول المحجوبة) في المستودع
      // المصغَّر: لا يتوقف عند الأولى (كان يتوقف لأن رسالتها تذكر «كروم بلا واجهة»)، فتُذكر كلتاهما «⊘ لم تُقَس» ويُكتب ملف النتائج بالصفحتين والخروج 0
      const AUDC = path.join(BOX, "zq-aud-chl");
      const pChl = zqPagesFile("chl", [{ d: "support", tag: "zq-chl403", url: origin + "/chl403", widths: [390] }, { d: "support", tag: "zq-chl503", url: origin + "/chl503", widths: [390] }]);
      const ra = await runAsync([T("rtl-audit.mjs"), "--repo=" + AREPO, "--ext=" + inBox(EXT), "--no-shots", "--out=" + AUDC, "--pages=" + pChl, "--challenge-wait=0"]);
      let resC = null; try { resC = JSON.parse(fs.readFileSync(path.join(AUDC, "rtl-audit-results.json"), "utf8")); } catch { resC = null; }
      expect("rtl-audit (ر27): صفحتا تحقّقٍ (403 ثم 503) بلا ‎--keep-going‎ لا توقفان التشغيل — كلتاهما «⊘ لم تُقَس» بسببها، وملف النتائج بالصفحتين، والخروج 0",
        ra.code === 0 && !!resC && resC.totals.pages === 2 && same(resC.pages.map((e) => e.tag), ["zq-chl403", "zq-chl503"]) &&
          resC.pages.every((e) => !!e.challenge && /Cloudflare/.test(e.error || "") && /كروم بلا واجهة/.test(e.error || "")) && (ra.out.match(/^⊘ support-zq-chl/gm) || []).length === 2,
        [ra.code, ra.out.slice(-400), resC && JSON.stringify(resC.pages.map((e) => [e.tag, !!e.challenge, (e.error || "").slice(0, 40)]))].join(" | "));
    } finally { srv.close(); }
  }
}

// ★ (ت10-هـ1، ٢٠ جمادى الأولى ١٤٤٨هـ) أداة دمج رسائل ICU (merge-icu.mjs) على نهائياتٍ اصطناعية («Zq…» مخترعة، لا نصَّ من الموقع) وقاموسٍ
// اصطناعي: أرقام كل قسمٍ عربي، والأصناف الأربعة، والأشكال المحمولة (a)–(e)، وقيمة المستخدم لا تكون %T، والتعارضات، والذهاب والإياب بلا مخالفة
{
  const MI = await import(pathToFileURL(T("merge-icu.mjs")).href);
  const { makeLookup } = await import(pathToFileURL(T("partial-english.mjs")).href);
  // (١) أرقام الأقسام: كل عددٍ من 0 إلى 1200 (وأعدادٌ أكبر) يطابقه قسمٌ واحد هو قسمه في Intl.PluralRules("ar")
  const PR = new Intl.PluralRules("ar"), badN = [];
  const nums = [...Array(1201).keys(), 9999, 10000, 10002, 10003, 10010, 10011, 10099, 10100, 123456];
  for (const n of nums) {
    const m = Object.keys(MI.CAT_RE).filter((c) => new RegExp("^(?:" + MI.CAT_RE[c] + ")$").test(String(n)));
    if (m.length !== 1 || m[0] !== PR.select(n)) badN.push(n + ":" + m.join("+"));
  }
  const ex = { zero: [0], one: [1], two: [2], few: [3, 10, 103], many: [11, 99, 111], other: [100, 101, 102, 1000] };
  for (const [c, ns] of Object.entries(ex)) for (const n of ns) if (!new RegExp("^(?:" + MI.CAT_RE[c] + ")$").test(String(n))) badN.push(c + "≠" + n);
  expect("merge-icu (ت10-هـ1): أرقام كل قسمٍ عربي تطابق أعداده وحدها — 0 و1 و2، وfew 3 و10 و103، وmany 11 و99 و111، وother 100 و101 و102 و1000 (ومن 0 إلى 1200 كلّها بقسم Intl.PluralRules)",
    !badN.length, badN.slice(0, 12).join(" "));

  const mi = path.join(BOX, "mi"), miOut = path.join(BOX, "mi-out");
  const PL6 = (z, o, t, f, m, x) => `zero {${z}} one {${o}} two {${t}} few {${f}} many {${m}} other {${x}}`;
  const FINALS = {
    n01: [
      // (١) جمعٌ حوله نصٌّ ثابت ⇒ مدخل جمع
      ["{count, plural, one {# Zq file} other {# Zq files}}", "{count, plural, " + PL6("لا ملفات زقية", "ملف زقي واحد", "ملفان زقيان", "# ملفات زقية", "# ملفًا زقيًا", "# ملف زقي") + "}"],
      // وفرعٌ لا يُظهر العدد ⇒ حرفيّ
      ["{count, plural, one {Zq remove the other one} other {Zq remove the other #}}", "{count, plural, " + PL6("لا شيء يُزال زقيًا", "أزل الآخر الزقي", "أزل الاثنين الزقيين", "أزل الـ# الأخرى الزقية", "أزل الـ# الأخرى الزقية", "أزل الـ# الأخرى الزقية") + "}"],
      // (٢) جمعٌ ومتغيّرٌ آخر ⇒ نمطٌ لكل قسم
      ["{count, plural, one {# Zq doc in {folder}} other {# Zq docs in {folder}}}", "{count, plural, " + PL6("لا مستندات زقية في {folder}", "مستند زقي واحد في {folder}", "مستندان زقيان في {folder}", "# مستندات زقية في {folder}", "# مستندًا زقيًا في {folder}", "# مستند زقي في {folder}") + "}"],
      // جمعان
      ["{a, plural, one {# Zq line} other {# Zq lines}} in {b, plural, one {# Zq page} other {# Zq pages}}", "{a, plural, " + PL6("لا أسطر", "سطر واحد", "سطران", "# أسطر", "# سطرًا", "# سطر") + "} في {b, plural, " + PL6("لا صفحات", "صفحة واحدة", "صفحتين", "# صفحات", "# صفحة", "# صفحة") + "}"],
      // (a) جمعٌ في اختيار، والعدد {matches} في الفرع المتداخل
      ["{limited, select, true {Zq first } other {}}{matches, plural, one {# Zq hit} other {# Zq hits}}", "{matches, plural, " + PL6("لا إصابات", "{limited, select, true {أول إصابة} other {إصابة واحدة}}", "{limited, select, true {أول إصابتين} other {إصابتان}}",
        "{limited, select, true {أول {matches} إصابات} other {{matches} إصابات}}", "{limited, select, true {أول {matches} إصابة} other {{matches} إصابة}}", "{limited, select, true {أول {matches} إصابة} other {{matches} إصابة}}") + "}"],
      // (a) العدد منسَّقًا {n} في فروع جمع count
      ["{count, plural, one {{n} Zq finding} other {{n} Zq findings}}", "{count, plural, " + PL6("لا نتائج زقية", "نتيجة زقية واحدة", "نتيجتان زقيتان", "{n} نتائج زقية", "{n} نتيجة زقية", "{n} نتيجة زقية") + "}"],
      // (c) {count} خارج الجمع في الإنجليزية نُقل داخل الفروع العربية
      ["{count} Zq new {count, plural, one {member} other {members}} added on {date}", "{count, plural, " + PL6("لم يُضف أعضاء زقيون", "أُضيف عضو زقي واحد", "أُضيف عضوان زقيان", "أُضيف {count} أعضاء زقيين", "أُضيف {count} عضوًا زقيًا", "أُضيف {count} عضو زقي") + "} في {date}"],
      // (b) %T: مفردات الموقع
      ["{n, plural, one {a Zq background {noun}} other {# Zq background {nouns}}}", "{n, plural, " + PL6("لا {nouns} في الخلفية الزقية", "{noun} في الخلفية الزقية", "{nouns} في الخلفية الزقية: #", "{nouns} في الخلفية الزقية: #", "{nouns} في الخلفية الزقية: #", "{nouns} في الخلفية الزقية: #") + "}"],
      // (d) الوحدة: مدخل كل وحدةٍ في القاموس يسبق النمط العام
      ["Zq free for {value} {unit}{value, plural, one {} other {s}}", "زقي مجانًا لمدة {value} {unit}{value, plural, " + PL6("", "", "", "", "", "") + "}"],
      // قيمةٌ يكتبها المستخدم لا تكون %T ولو طُلبت
      ["{count, plural, one {# Zq row in {fileName}} other {# Zq rows in {fileName}}}", "{count, plural, " + PL6("لا صفوف زقية في {fileName}", "صف زقي واحد في {fileName}", "صفان زقيان في {fileName}", "# صفوف زقية في {fileName}", "# صفًا زقيًا في {fileName}", "# صف زقي في {fileName}") + "}"],
      // متغيّرٌ حرٌّ يلاصق العدد ({sign}{count}): لا يقتطع رقمًا منه
      ["{sign}{count, plural, one {# Zq seat} other {# Zq seats}}", "{sign}{count, plural, " + PL6("# مقاعد زقية", "# مقعد زقي", "# مقعدان زقيان", "# مقاعد زقية", "# مقعدًا زقيًا", "# مقعد زقي") + "}"],
    ],
    s01: [
      // (٣) اختيارٌ متداخل: كل تركيب
      ["{a, select, x {Zq alpha {b, select, y {Zq yes} other {Zq no}}} other {Zq beta}}", "{a, select, x {ألفا زقي {b, select, y {نعم زقية} other {لا زقية}}} other {بيتا زقي}}"],
      // (e) اختيارٌ أُضيف في العربية وحدها على متغيّرٍ قائم (kind)
      ["Zq open the {kind, select, task {task} other {routine}}.", "افتح {kind, select, task {المهمة} other {الروتين}} {kind, select, task {الزقية} other {الزقي}}."],
    ],
    r01: [
      // (٤) الوسوم: كل مقطعٍ نصٌّ مستقل
      ["Zq read the <link>Zq guide</link> first.", "اقرأ <link>الدليل الزقي</link> أولًا."],
      // ووسمٌ داخل فرع جمع
      ["{count, plural, one {<b># Zq item</b> Zq left} other {<b># Zq items</b> Zq left}}", "{count, plural, " + PL6("<b>لا عناصر زقية</b> باقية زقيًا", "<b>عنصر زقي واحد</b> باقية زقيًا", "<b>عنصران زقيان</b> باقية زقيًا", "<b># عناصر زقية</b> باقية زقيًا", "<b># عنصرًا زقيًا</b> باقية زقيًا", "<b># عنصر زقي</b> باقية زقيًا") + "}"],
    ],
  };
  const writeT10 = (dir, finals) => {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const [p, rows] of Object.entries(finals)) {
      writeJson(path.join(dir, "final", p + ".json"), rows.map(([en, ar]) => ({ en, ar })));
      writeJson(path.join(dir, "parts", p + ".json"), rows.map(([en]) => ({ en, kind: "x" })));
    }
  };
  const miDict = path.join(BOX, "mi-ar.json");
  const baseDict = () => ({ ...dictOf("app", { "zq task": "مهمةٌ زقية", "zq tasks": "مهامُّ زقية" }, []),
    plurals: { "Zq free for %d day": { plural: "Zq free for %d days", forms: ["زقي مجانًا", "زقي مجانًا ليومٍ واحد", "زقي مجانًا ليومين", "زقي مجانًا لـ%d أيام", "زقي مجانًا لـ%d يومًا", "زقي مجانًا لـ%d يوم"] } } });
  writeT10(mi, FINALS);
  writeJson(miDict, baseDict());
  const runMI = (extra) => run([T("merge-icu.mjs"), "--t10=" + mi, "--dict=" + miDict, "--out=" + miOut, ...(extra || [])]);
  const readOut = (f) => JSON.parse(fs.readFileSync(path.join(miOut, f), "utf8"));
  let r = runMI(["--t-vars=noun,nouns,fileName"]);
  const rep = r.code === 0 ? readOut("report.json") : null;
  const cls = rep ? Object.keys(rep.classes).sort().map((k) => k + ":" + rep.classes[k]).join(" ") : "";
  expect("merge-icu (ت10-هـ1): النهائيات الاصطناعية كلها تُحوَّل، والذهاب والإياب بلا مخالفةٍ غير مفسَّرة (الخروج 0) — الأصناف: مدخل جمع 5، ونمط قسم 7، واختيار 2، ووسوم 1",
    rep && rep.roundTrip.unexplained === 0 && rep.roundTrip.mismatches === 0 && rep.notConverted.length === 0 && rep.roundTrip.checked > 300 &&
      cls === "category:7 plural-entry:5 rich:1 select:2",
    [r.code, r.out.slice(-600), rep && JSON.stringify(rep.classes), rep && JSON.stringify(rep.notConverted)].join(" | "));

  // نسخة المحرّك على القاموس المدموج نفسه، لأعدادٍ بعينها
  const lits = rep ? readOut("literals.json") : [], pls = rep ? readOut("plurals.json") : {}, cats = rep ? readOut("category-patterns.json").patterns : [];
  const gen = rep ? readOut("gen-patterns-added.json").patterns : [];
  const d0 = baseDict(), merged = { ...d0, strings: { ...d0.strings }, plurals: { ...d0.plurals, ...pls }, patterns: globalThis.CMLShared.sortBySpecificity(gen.concat(cats)) };
  for (const l of lits) merged.strings[l.en] = l.ar;
  const L = makeLookup(merged), q = (s) => { const x = L.lookup(s); return x && x.out; };
  const litOf = (en) => (lits.find((l) => l.en === en) || {}).ar;
  expect("merge-icu (ت10-هـ1): جمعٌ حوله نصٌّ ثابت مدخلُ جمعٍ بشكل المحرّك (المفتاح one والحقل plural والصيغ الست بـ%d)، وفرعٌ لا يُظهر العدد حرفيّ",
    pls["%d Zq file"] && pls["%d Zq file"].plural === "%d Zq files" && JSON.stringify(pls["%d Zq file"].forms) ===
      JSON.stringify(["لا ملفات زقية", "ملف زقي واحد", "ملفان زقيان", "%d ملفات زقية", "%d ملفًا زقيًا", "%d ملف زقي"]) &&
      litOf("Zq remove the other one") === "أزل الآخر الزقي" && pls["Zq remove the other %d"] && !pls["Zq remove the other %d"].plural &&
      q("3 Zq files") === "3 ملفات زقية" && q("11 Zq files") === "11 ملفًا زقيًا" && q("101 Zq files") === "101 ملف زقي" && q("103 Zq files") === "103 ملفات زقية",
    JSON.stringify([pls["%d Zq file"], litOf("Zq remove the other one"), pls["Zq remove the other %d"], q("3 Zq files"), q("101 Zq files")]));
  const want = [["0 Zq docs in Zeddicus", "لا مستندات زقية في Zeddicus"], ["1 Zq doc in Zeddicus", "مستند زقي واحد في Zeddicus"], ["2 Zq docs in Zeddicus", "مستندان زقيان في Zeddicus"],
    ["3 Zq docs in Zeddicus", "3 مستندات زقية في Zeddicus"], ["10 Zq docs in Zeddicus", "10 مستندات زقية في Zeddicus"], ["11 Zq docs in Zeddicus", "11 مستندًا زقيًا في Zeddicus"],
    ["99 Zq docs in Zeddicus", "99 مستندًا زقيًا في Zeddicus"], ["100 Zq docs in Zeddicus", "100 مستند زقي في Zeddicus"], ["102 Zq docs in Zeddicus", "102 مستند زقي في Zeddicus"],
    ["103 Zq docs in Zeddicus", "103 مستندات زقية في Zeddicus"], ["111 Zq docs in Zeddicus", "111 مستندًا زقيًا في Zeddicus"], ["1000 Zq docs in Zeddicus", "1000 مستند زقي في Zeddicus"],
    ["3 Zq lines in 11 Zq pages", "3 أسطر في 11 صفحة"], ["Zq first 11 Zq hits", "أول 11 إصابة"], ["11 Zq hits", "11 إصابة"], ["Zq first 2 Zq hits", "أول إصابتين"],
    ["11 Zq findings", "11 نتيجة زقية"], ["11 Zq new members added on Zeddicus", "أُضيف 11 عضوًا زقيًا في Zeddicus"], ["1 Zq new member added on Zeddicus", "أُضيف عضو زقي واحد في Zeddicus"],
    ["+100 Zq seats", "+100 مقعد زقي"], ["+13 Zq seats", "+13 مقعدًا زقيًا"], ["+2 Zq seats", "+2 مقعدان زقيان"], ["Zq100 Zq seats", "Zq100 مقعد زقي"], ["+1 Zq seat", "+1 مقعد زقي"]];
  const wrong = want.filter(([en, ar]) => q(en) !== ar).map(([en]) => en + " ⇒ " + q(en));
  expect("merge-icu (ت10-هـ1): نمطٌ لكل قسمٍ يلتقط عددَه أرقامُ قسمه وحدها (0 1 2 3 10 11 99 100 102 103 111 1000)، والمتغيّر الملاصق للعدد لا يقتطع منه رقمًا، وجمعان، وجمعٌ في اختيار بـ{matches} (a)، و{n} المنسَّق (a)، و{count} المنقول داخل الفروع (c)",
    !wrong.length && cats.some((p) => p.re.includes("(" + MI.CAT_RE.few + ")")) && !cats.some((p) => /\(\.\+\?\)\(|\(\\d\+\)/.test(p.re)), wrong.join(" | "));
  expect("merge-icu (ت10-هـ1): اختيارٌ متداخل بكل تركيب، واختيارٌ أُضيف في العربية وحدها على متغيّرٍ قائم (e)، والوسوم مقاطعُ بترتيبها (ووسمٌ داخل فرع جمع)، ولا وسمَ في مدخل",
    litOf("Zq alpha Zq yes") === "ألفا زقي نعم زقية" && litOf("Zq alpha Zq no") === "ألفا زقي لا زقية" && litOf("Zq beta") === "بيتا زقي" &&
      litOf("Zq open the task.") === "افتح المهمة الزقية." && litOf("Zq open the routine.") === "افتح الروتين الزقي." &&
      litOf("Zq read the") === "اقرأ" && litOf("Zq guide") === "الدليل الزقي" && litOf("first.") === "أولًا." && litOf("Zq left") === "باقية زقيًا" &&
      q("3 Zq items") === "3 عناصر زقية" && !lits.concat(gen, cats).some((x) => /<\/?[a-z]+>/.test(x.en + x.ar)),
    JSON.stringify(lits.slice(0, 30)));
  const tPat = cats.find((p) => /Zq background/.test(p.en)), rowPats = cats.filter((p) => /Zq rows? in/.test(p.en)).concat(gen.filter((p) => /Zq rows? in/.test(p.en)));
  const unit = rep ? rep.unitCheck.filter((u) => u.unit === "day") : [], unitM = rep ? rep.unitCheck.filter((u) => u.unit === "month") : [];
  expect("merge-icu (ت10-هـ1): %T لمفردات الموقع وحدها (b) — يُترجم الالتقاط من القاموس وإلا بقي النصّ إنجليزيًّا؛ وقيمةُ المستخدم ({fileName}) لا تكون %T ولو طُلبت؛ ومدخل الوحدة في القاموس يسبق النمط العام (d)",
    tPat && /%T\d/.test(tPat.ar) && q("3 Zq background zq tasks") === "مهامُّ زقية في الخلفية الزقية: 3" && q("3 Zq background Zeddicus") === null &&
      rowPats.length >= 3 && rowPats.every((p) => !/%T/.test(p.ar)) && /مرفوض لقيمة مستخدم: fileName/.test(r.out) &&
      unit.length && unit.every((u) => u.by === "existing plural") && unitM.some((u) => /generic/.test(u.by)),
    JSON.stringify([tPat, rowPats.map((p) => p.ar), unit.slice(0, 2), unitM.slice(0, 2)]));
  // (٥) التعارضات تُسرد ولا تُحسم: مفتاحٌ قائم بقيمةٍ أخرى، وحرفيٌّ قائم يظلّل جمعًا مولَّدًا، ونهائيّان بمفتاحٍ واحد وقيمتين، ونمطٌ قائم يظلّل المولَّد
  // ★ (مراجعة ت10-هـ1) ونمطٌ مولَّد يأخذ نصًّا كان يترجمه نمطٌ قائم («0 Zq docs in …»: الصفرُ ثابتٌ في تعبيره فيتقدّم بفرز التخصيص)
  writeT10(mi, Object.assign({}, FINALS, { r02: [["Zq read the <link>Zq guide</link> first.", "اقرأ <link>المرشد الزقي</link> أولًا."]] }));
  const cd = baseDict();
  cd.strings["Zq beta"] = "بيتا أخرى";
  cd.strings["5 Zq files"] = "خمسةُ ملفاتٍ زقية";
  cd.patterns = [{ en: "{x} Zq docs in {y}", re: "^(.+?) Zq docs in (.+?)$", ar: "مستندات زقية ($1) في $2" }];
  writeJson(miDict, cd);
  r = runMI(["--t-vars=noun,nouns"]);
  const rep2 = fs.existsSync(path.join(miOut, "report.json")) ? readOut("report.json") : null;
  const kinds = rep2 ? new Set(rep2.conflicts.map((c) => c.kind)) : new Set();
  expect("merge-icu (ت10-هـ1): التعارضات تُسرد: مفتاحٌ في strings بقيمةٍ أخرى، وحرفيٌّ قائم يظلّل جمعًا مولَّدًا، ونهائيّان بمفتاحٍ واحد وقيمتين، ونمطٌ قائم يُظلّل المولَّد — وكلُّ مخالفةٍ لها سببها",
    rep2 && ["key-in-ar-strings", "existing-literal-shadows-new-plural", "two-finals-one-key", "new-entry-shadowed-by-existing-pattern", "new-pattern-takes-text-of-existing-pattern"].every((k) => kinds.has(k)) && rep2.roundTrip.unexplained === 0,
    [r.code, r.out.slice(-500), [...kinds].join(",")].join(" | "));
}

// ★ (ر24-د2، مراجعة ر24-د، ٢٠ جمادى الأولى ١٤٤٨هـ) +4: بوابة الجلب (fetch-gate.mjs، F-03) — نداءٌ مجرّد يُخفقها وشجرة الإضافة اليوم تمرّ؛ وحكم روابط الفحصين
// (scanUrlOk، F-05) يرفض http في صفحة https؛ ونسخُ applyTermEdits يتخطّى مفتاح ‎"__proto__"‎ المملوك فلا يتبدّل نموذج كائنٍ ولا يُقبل التعديل
{
  const FG = await import(pathToFileURL(T("fetch-gate.mjs")).href);
  const fx = path.join(BOX, "fetch-gate-fixture");
  fs.mkdirSync(fx, { recursive: true });
  fs.writeFileSync(path.join(fx, "ok.js"), 'fetch(chrome.runtime.getURL("a.json"));\nfetch(u, { credentials: "omit", redirect: "error" });\n// fetch(u)\nvar s = "fetch(u)";\nif (typeof fetch === "function") {}\n' +
    'fetch(u, { ...o, credentials: "omit" });\nvar t = \'x["fetch"]\', q = o["signal"];\n');
  const okOnly = FG.scanDir(fx);
  fs.writeFileSync(path.join(fx, "bad.js"), 'fetch(u).then(function (r) { return r.text(); });\nself.fetch(u, { signal: s });\nvar f = fetch;\nfetch(u, c ? { credentials: "omit" } : {});\nnew XMLHttpRequest();\n' +
    'fetch(u, { credentials: "omit", credentials: "include" });\nfetch(u, { credentials: "omit", ...o });\nself["fetch"](u);\n');
  const withBad = FG.scanDir(fx);
  expect("بوابة الجلب (ر24-د2، F-03): fetch مجرّدٌ أو عضوٌ بلا credentials:\"omit\" في كائن خياراته، أو مُسنَدٌ بلا نداء، أو خياراتٌ شرطية، أو XMLHttpRequest، أو credentials تاليةٌ تغلب omit، أو نشرٌ بعدها، أو fetch بفهرسٍ نصّي (مراجعة ر24-د2) — كلٌّ مخالفة؛ وملف الحزمة (getURL) والتعليق والسلسلة وtypeof والنشرُ قبل omit لا",
    okOnly.length === 0 && withBad.length === 8 && withBad.every((v) => v.file === "bad.js") && same(withBad.map((v) => v.line), [1, 2, 3, 4, 5, 6, 7, 8]),
    JSON.stringify([okOnly, withBad]));
  const tree = FG.scanDir(EXT);
  expect("بوابة الجلب (ر24-د2، F-03): شجرة الإضافة اليوم بلا مخالفة (والبوابة في check-syntax.mjs)", tree.length === 0 && /scanDir\(EXT\)/.test(fs.readFileSync(T("check-syntax.mjs"), "utf8")),
    JSON.stringify(tree));
  const page = (href) => new URL(href);
  const https = page("https://claude.ai/new"), shell = page("http://127.0.0.1:8794/web/code/test/_rtldoctest.html");
  const U = (u, loc) => SH.scanUrlOk(u, loc);
  expect("scanUrlOk (ر24-د2، F-05): https وحدها للمضيفين أنفسهم — http لـclaude.ai أو فرعه مرفوض، وطرفٌ ثالث مرفوض؛ وhttp لأصل صفحة الاختبار http وحده",
    U("http://claude.ai/x.css", https) === null && U("http://assets.claude.ai/x.css", https) === null && U("https://assets-proxy.anthropic.com/a.css", https) === "https://assets-proxy.anthropic.com/a.css" &&
      U("/a/b.css", https) === "https://claude.ai/a/b.css" && U("https://evil.example/a.css", https) === null && U("chrome-extension://abc/x.css", https) === null &&
      U("assets/x.css", shell) === "http://127.0.0.1:8794/web/code/test/assets/x.css" && U("http://localhost:8794/x.css", shell) === null &&
      U("http://127.0.0.1:9999/x.css", shell) === null && U("http://claude.ai/x.css", shell) === null,
    JSON.stringify([U("http://claude.ai/x.css", https), U("http://127.0.0.1:9999/x.css", shell), U("http://claude.ai/x.css", shell)]));
  const ov1 = JSON.parse('{"__proto__": {"ar": {"Zq inherited": "موروث"}}}');
  const r1 = SH.applyTermEdits(ov1, [], "ar", [{ op: "set", k: "Zq a", v: "أ" }]);
  const ov2 = { ar: JSON.parse('{"__proto__": {"Zq x": "س"}, "Zq b": "ب"}') };
  const r2 = SH.applyTermEdits(ov2, [], "ar", [{ op: "set", k: "__proto__", v: "ز" }]);
  expect("applyTermEdits (ر24-د2): مفتاح ‎\"__proto__\"‎ مملوكٌ في المخزَّن (في الجذر وفي اللغة) لا يبدّل نموذج النسخة ولا تُرقّى لغةٌ موروثة، وتعديلُه يُتجاهل",
    Object.getPrototypeOf(r1.overrides) === Object.prototype && same(Object.keys(r1.overrides.ar), ["Zq a"]) && !Object.prototype.hasOwnProperty.call(r1.overrides, "__proto__") &&
      Object.getPrototypeOf(r2.overrides.ar) === Object.prototype && r2.overrides.ar["Zq x"] === undefined && same(Object.keys(r2.overrides.ar), ["Zq b"]) &&
      r2.report.skipped === 1 && r2.report.set === 0 && r2.ovChanged === false && Object.getPrototypeOf({}) === Object.prototype && ({}).ar === undefined,
    JSON.stringify([Object.keys(r1.overrides.ar), Object.getPrototypeOf(r1.overrides) === Object.prototype, Object.keys(r2.overrides.ar), r2.report, r2.overrides.ar["Zq x"]]));
}

// ★ (ت14-هـ0ب، القرار 142) طريق الدمج لا يُضيّع نصًّا: الفقرات، ومتغيّرات ICU الرقمية والتاريخ، والنهائي الذي يحلّ محلّ عربيةٍ قائمة، والمدخل اليدوي
// الآمن (manual-patterns.mjs)، والأعداد بفاصلة الآلاف في النسخة العقدية من البحث، وأداة تغطية الكتالوج بأسطر النصّ. قاموسٌ ونهائياتٌ اصطناعية («Zq…»)
{
  writeJson(APP, dictOf("app", { "Zq existing para": "فقرةٌ قائمة", "Zq 3 of 3 rows": "حرفيٌّ تجريبي" },
    [{ en: "Zq keep {name} here", re: "^Zq keep (.+?) here$", ar: "إبقاء قديم $1" }]));
  const gp = path.join(BOX, "pairs-h0b.json");
  fs.writeFileSync(gp, JSON.stringify([
    { en: "Zq first paragraph.\n\nZq second {name} paragraph.", ar: "الفقرة الأولى التجريبية.\n\nالفقرة الثانية التجريبية {name}." },
    { en: "Zq step {current, number} of {total, number} in zqsetup", ar: "الخطوة {current, number} من {total, number} في الإعداد التجريبي" },
    { en: "Zq credits expire on {date}", ar: "تنتهي صلاحية الرصيد التجريبي في {date}", m: ["date"] },
    { en: "Zq renews on {when, date, medium} for zqplan", ar: "تتجدّد الخطة التجريبية في {when, date, medium}" },
    { en: "Zq keep {name} here", ar: "إبقاء جديد {name}", override: true },
    { en: "Zq {n, plural, one {# zq} other {# zqs}} left", ar: "ما بقي" },
  ]), "utf8");
  const g2 = run([T("gen-patterns.mjs"), "--in=" + gp]);
  let gd2 = {}; try { gd2 = JSON.parse(fs.readFileSync(APP, "utf8")); } catch {}
  const P2 = new Map((gd2.patterns || []).map((p) => [p.en, p]));
  const ap = (en, txt) => { const p = P2.get(en); return p ? SH.patternApply(new RegExp(p.re), p.ar, txt, SH.toolRes(gd2.strings || {})) : null; };
  const out = (r) => (r && typeof r === "object" ? r.out : r);
  expect("★ gen-patterns (ت14-هـ0ب): رسالةٌ بفقرتين تُولَّد فقرةً فقرةً — الثابتة حرفيٌّ والتي فيها متغيّرٌ نمط — كما تعرضها الصفحة",
    gd2.strings && gd2.strings["Zq first paragraph."] === "الفقرة الأولى التجريبية." && out(ap("Zq second {name} paragraph.", "Zq second Moravek paragraph.")) === "الفقرة الثانية التجريبية Moravek.",
    JSON.stringify([gd2.strings && gd2.strings["Zq first paragraph."], P2.get("Zq second {name} paragraph.")]) + g2.out.slice(-300));
  expect("★ gen-patterns: ‎{x, number}‎ يُقبل بالتقاطٍ عدديّ يأخذ «1,200» ولا يأخذ كلمة",
    out(ap("Zq step {current} of {total} in zqsetup", "Zq step 3 of 1,200 in zqsetup")) === "الخطوة 3 من 1,200 في الإعداد التجريبي" && ap("Zq step {current} of {total} in zqsetup", "Zq step three of 1,200 in zqsetup") === null,
    JSON.stringify(P2.get("Zq step {current} of {total} in zqsetup")));
  expect("★ gen-patterns: تاريخٌ تعرضه الصفحة بالإنجليزية (‎\"m\"‎ و‎{x, date}‎) يُكتب ‎$اليوم %Mالشهر$السنة‎ — «31 ديسمبر 2026» و«5 ديسمبر» — وشهرٌ لا يعرفه الجدول لا يطابق",
    out(ap("Zq credits expire on {date}", "Zq credits expire on December 31, 2026")) === "تنتهي صلاحية الرصيد التجريبي في 31 ديسمبر 2026" &&
      out(ap("Zq renews on {when} for zqplan", "Zq renews on Dec 5 for zqplan")) === "تتجدّد الخطة التجريبية في 5 ديسمبر" && ap("Zq credits expire on {date}", "Zq credits expire on Zqmonth 5") === null,
    JSON.stringify([P2.get("Zq credits expire on {date}"), P2.get("Zq renews on {when} for zqplan")]));
  expect("★ gen-patterns: ‎\"override\": true‎ يستبدل عربية النمط القائم ذي التعبير نفسه، ورسالة الجمع ICU تُرفض (مكانها merge-icu)",
    P2.get("Zq keep {name} here") && P2.get("Zq keep {name} here").ar === "إبقاء جديد $1" && /icu-plural-or-select/.test(fs.readFileSync(path.join(G, "_patterns-rejected.json"), "utf8")),
    JSON.stringify(P2.get("Zq keep {name} here")) + g2.out.slice(-200));
  // merge-batches: الفقرات وICU
  const BD = path.join(G, "_ar_batches");
  fs.rmSync(BD, { recursive: true, force: true }); fs.mkdirSync(BD, { recursive: true });
  fs.writeFileSync(path.join(BD, "zq.json"), JSON.stringify([
    { en: "Zq alpha one.\n\nZq existing para", ar: "ألفا الأولى التجريبية.\n\nفقرةٌ أخرى" },
    { en: "Zq beta one.\n\nZq beta two.", ar: "بيتا واحدة." },
    { en: "{available, number} zq seats left", ar: "{available, number} مقاعد" },
    { en: "Zq gamma {name} one.\n\nZq gamma two.", ar: "غاما {name} الأولى.\n\nغاما الثانية." },
  ]), "utf8");
  const mb = run([T("merge-batches.mjs")]);
  let md = {}; try { md = JSON.parse(fs.readFileSync(APP, "utf8")); } catch {}
  const MS = md.strings || {};
  expect("★ merge-batches (ت14-هـ0ب): فقرات الرسالة مداخلُ بترتيبها والقائم يبقى، والعدد المختلف يُذكر ولا يُخمَّن، ومفتاح ICU لا يدخل strings، وفقرات القالب الثابتة تُضاف",
    MS["Zq alpha one."] === "ألفا الأولى التجريبية." && MS["Zq existing para"] === "فقرةٌ قائمة" && MS["Zq alpha one.\n\nZq existing para"] !== undefined &&
      MS["Zq beta one."] === undefined && /paragraph count differs: 1/.test(mb.out) && MS["{available, number} zq seats left"] === undefined && MS["Zq gamma two."] === "غاما الثانية." &&
      MS["Zq gamma {name} one."] === undefined,
    mb.out.slice(-400));
  fs.rmSync(BD, { recursive: true, force: true });
  // manual-patterns: الوصفة وحرّاسها
  const FD = path.join(BOX, "finals-h0b");
  writeJson(path.join(FD, "v99.json"), [
    { en: "{count} {tier} zq seats until {date}", ar: "{count} من مقاعد {tier} التجريبية حتى {date}" },
    { en: "{a} {b} zq both words", ar: "{a} {b} كلمتان" },
    { en: "{a} zq free {b}", ar: "{a} حرّ {b}" },
    { en: "{x} zq rows", ar: "{x} صفوف تجريبية" },
    { en: "{x} zq corpus hit", ar: "{x} نصٌّ تجريبي" },
    { en: "{x} zq keep", ar: "{x} إبقاءٌ جديد" },
    { en: "{x} zq wide", ar: "{x} واسعٌ تجريبي" },
    { en: "{x} zq other", ar: "{x} آخر تجريبي" },
  ]);
  const RC = path.join(BOX, "recipe-h0b.json");
  fs.writeFileSync(RC, JSON.stringify([
    { en: "{count} {tier} zq seats until {date}", regex: "^{count:num} {tier:word} zq seats until {date:date}$", "ar-from": "v99#1", why: "typed", sample: "1,200 Team zq seats until Dec 5, 2026" },
    { en: "{a} {b} zq both words", regex: "^{a:word} {b:word} zq both words$", "ar-from": "v99#2", why: "x" },
    { en: "{a} zq free {b}", regex: "^(.+?) zq free {b:word}$", "ar-from": "v99#3", why: "x" },
    { en: "{x} zq rows", regex: "^{x:num} zq rows$", "ar-from": "v99#4", why: "x" },
    { en: "{x} zq corpus hit", regex: "^{x:word} zq corpus hit$", "ar-from": "v99#5", why: "x" },
    { en: "{x} zq keep changed", regex: "^{x:word} zq keep$", "ar-from": "v99#6", why: "x" },
    { en: "{x} zq wide", regex: "^{x:num} zq (?:.*)wide$", "ar-from": "v99#7", why: "x", sample: "3 zq wide" },
    { en: "{x} zq other", regex: "^{x:num} zq another$", "ar-from": "v99#8", why: "x", sample: "3 zq another" },
  ]), "utf8");
  writeJson(APP, dictOf("app", { "3 zq rows": "ثلاثة صفوف" }, []));
  const CP = path.join(BOX, "corpus-h0b.json");
  fs.writeFileSync(CP, JSON.stringify(["Some other zq corpus hit", "Unrelated zq text"]), "utf8");
  const RP = path.join(BOX, "recipe-h0b-report.json");
  const mp = run([T("manual-patterns.mjs"), "--recipe=" + RC, "--finals=t14=" + FD, "--corpus=" + CP, "--report=" + RP]);
  let rp = { rows: [] }; try { rp = JSON.parse(fs.readFileSync(RP, "utf8")); } catch {}
  let mpd = {}; try { mpd = JSON.parse(fs.readFileSync(APP, "utf8")); } catch {}
  const st = (i) => rp.rows[i] && (rp.rows[i].status === "added" ? "added" : rp.rows[i].why);
  const mpat = (mpd.patterns || [])[0];
  expect("★ manual-patterns (ت14-هـ0ب): الوصفة تأخذ العربية من النهائي عند التطبيق (عددٌ وقيمةٌ وتاريخ ‎%M‎)، وترفض: كلمتين متجاورتين، والتقاطًا حرًّا، وما يطابق مفتاحًا حرفيًّا، وما يطابق نصًّا آخر، ونصًّا غير نصّ النهائي، و(مراجعة ت14-هـ0ب) ثابتًا غير حرفي ‎(?:.*)‎ وثابتًا غير نصّ القالب",
    rp.added === 1 && st(0) === "added" && st(1) === "adjacent-words" && st(2) === "free-capture" && st(3) === "matches-literal" && st(4) === "matches-other-text" && st(5) === "final-en-differs" &&
      st(6) === "not-literal" && st(7) === "regex-differs-from-template" &&
      mpat && SH.patternApply(new RegExp(mpat.re), mpat.ar, "1,200 Team zq seats until Dec 5, 2026", SH.toolRes({})).out === "1,200 من مقاعد Team التجريبية حتى 5 ديسمبر 2026",
    JSON.stringify(rp.rows) + " " + JSON.stringify(mpat) + mp.out.slice(-300));
  // الأعداد بفاصلة الآلاف في النسخة العقدية من البحث (partial-english makeLookup، كالمحرّك)
  const PE = await import(pathToFileURL(T("partial-english.mjs")).href);
  const lk = PE.makeLookup({ strings: {}, plurals: { "%d zq run": { plural: "%d zq runs", forms: ["لا تشغيل", "تشغيل واحد", "تشغيلان", "%d تشغيلات", "%d تشغيلًا", "%d تشغيل"] } }, patterns: [] });
  const r1 = lk.lookup("1,000 zq runs"), r2 = lk.lookup("12,345 zq runs"), r3 = lk.lookup("1,00 zq runs"), r4 = lk.lookup("1,000.5 zq runs");
  expect("★ partial-english (ت14-هـ0ب): «1,000» و«12,345» تُترجم بصيغة قسمها والعدد بصورته، و«1,00» و«1,000.5» لا",
    r1.out === "1,000 تشغيل" && r2.out === "12,345 تشغيلًا" && r3.out === null && r4.out === null, JSON.stringify([r1, r2, r3, r4]));
  // أداة تغطية الكتالوج تسأل بأسطر النصّ كالمحرّك
  if (fs.existsSync(CATALOGUE_TOOL)) {
    const RUN4 = path.join(G, "_catalogue-run-nl");
    fs.mkdirSync(RUN4, { recursive: true });
    fs.copyFileSync(CATALOGUE_TOOL, path.join(RUN4, "catalogue-coverage.mjs"));
    fs.writeFileSync(path.join(RUN4, "ar.json"), JSON.stringify({ strings: { "Zq line one.\nZq line two.": "سطرٌ أول.\nسطرٌ ثانٍ.", "Zq joined one. Zq joined two.": "مضموم" }, patterns: [], plurals: {} }), "utf8");
    fs.writeFileSync(path.join(RUN4, "keep.json"), JSON.stringify({ keep: [] }), "utf8");
    fs.writeFileSync(path.join(RUN4, "cat.json"), JSON.stringify({ a: "Zq line one.\nZq line two.", b: "Zq joined one.\nZq joined two." }), "utf8");
    const k4 = run([path.join(RUN4, "catalogue-coverage.mjs"), "--dict=" + path.join(RUN4, "ar.json"), "--keep=" + path.join(RUN4, "keep.json"),
      "--cat=" + path.join(RUN4, "cat.json"), "--out=" + path.join(RUN4, "gap.txt"), "--json=" + path.join(RUN4, "s.json")], RUN4);
    let k4s = null; try { k4s = JSON.parse(fs.readFileSync(path.join(RUN4, "s.json"), "utf8")); } catch {}
    const by4 = (k4s && k4s.engineLookup && k4s.engineLookup.by) || {};
    expect("★ catalogue-coverage (ت14-هـ0ب): يسأل بأسطر النصّ كالمحرّك — المفتاح بأسطره مغطًّى، والمحفوظ مضمومًا وحده ناقص",
      k4.code === 0 && by4.literal === 1 && by4.missing === 1, JSON.stringify(k4s || {}) + " " + k4.out.slice(-300));
    fs.rmSync(RUN4, { recursive: true, force: true });
  }
}

const bad = results.filter((r) => !r.ok);
for (const r of results) console.log((r.ok ? "✓ " : "✗ ") + r.name + (r.ok ? "" : "\n    " + r.detail));
for (const s of skipped) console.log("ℹ متروك: " + s);
const short = results.length < MIN;
if (short) console.log(`✗ ${results.length} فحصًا أقل من الحدّ الأدنى ${MIN}`);
console.log(`TOOLS: ${results.length - bad.length}/${results.length}`);
process.exit(bad.length || short ? 1 : 0);
