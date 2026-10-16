// gen-rtl.mjs — مولّد rtl-overrides.css من CSS الموقع الحقيقي (المرحلة ٣).
//
// المدخل: code/sitecss/*.css (لقطة CSS الموقع — تُجدَّد بإعادة تنزيلها عند تحديث
// الموقع، و«طبيب الاتجاه» في صفحة الإعدادات يكشف متى تقادمت).
// المخرج: user/extension/rtl-overrides.css  (قسمان: مصفِّرات ثم منطقيات — الترتيب عقد)
//         user/extension/rtl-coverage.js    (بصمات التغطية التي يقارن بها الطبيب)
//
// منطق القلب كله في user/extension/cml-rtl.js (النسخة الواحدة) — هذا الملف تجميع
// وبوابات فقط. البوابات الثلاث:
//   ١) إعادة تحليل الناتج تمرّ بلا أخطاء وكل قاعدة خلف بوابة data-cml-rtl.
//   ٢) اللاعودة: قلب الناتج نفسه = صفر قلب (فلا قلب مزدوج بنيويًّا).
//   ٣) عتبات صحة المدخل: قواعد كافية وقلب كافٍ — وإلا فالموقع غيّر صيغته والملف
//      القديم يبقى خيرًا من ملف فارغ (exit 1 قبل الكتابة).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// ★ (١-١) أهدافٌ للمواقع: لقطةٌ ومخرجٌ وعتباتُ صحةٍ بحجم كل موقع — منصة Intercom (مركز
// المساعدة والخصوصية) أصغر أوراقًا من التطبيق بكثير، فعتبات التطبيق كانت ترفضها «هزيلة».
//   node gen-rtl.mjs [--target=app|intercom|docs|code|legal|academy] [<مجلد اللقطة>] [--out-dir=<مجلد>]
const TARGETS = {
  app:      { dir: "sitecss",          out: "rtl-overrides.css", cov: "rtl-coverage.js", minRules: 1000, minFlipped: 200 },
  intercom: { dir: "sitecss-intercom", out: "rtl-intercom.css",  cov: null,              minRules: 400,  minFlipped: 60 },
  docs:     { dir: "sitecss-docs",     out: "rtl-docs.css",      cov: null,              minRules: 400,  minFlipped: 60 },
  // وثائق Claude Code (Mintlify، Tailwind v4): قِيس على لقطةٍ من الروابط والأوراق المضمَّنة 4,587 قاعدة و306 مقلوبًا
  code:     { dir: "sitecss-code",     out: "rtl-code.css",      cov: null,              minRules: 1000, minFlipped: 150 },
  // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) الوثائق القانونية في www.anthropic.com/legal (Next.js 16): قِيس على لقطة الصفحات الخمس (6 أوراقٍ
  // مرتبطة و10 مضمَّنة) 3,086 قاعدة و348 مقلوبًا — والعتبتان نحو نصفهما (كما في دراسة ر3)
  legal:    { dir: "sitecss-legal",    out: "rtl-legal.css",     cov: null,              minRules: 1500, minFlipped: 170 },
  // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) الأكاديمية في academy.claude.com (Vite وTailwind ونظام تصميم CDS): لقطة عشر صفحاتٍ بلا ورقة أفلام
  // حالات الاستخدام (جزيرةٌ إنجليزية LTR داخل المتن)، ثلاث أوراق (index وIcon ومضمَّنة) — قِيس 5,546 قاعدة و431 مقلوبًا كما في الدراسة،
  // والعتبتان نحو نصفهما
  academy:  { dir: "sitecss-academy",  out: "rtl-academy.css",   cov: null,              minRules: 2500, minFlipped: 200 },
};
const TARGET_NAME = (process.argv.find((a) => a.startsWith("--target=")) || "--target=app").slice(9);
const TARGET = TARGETS[TARGET_NAME];
if (!TARGET) { console.error("! هدفٌ مجهول: " + TARGET_NAME + " — المعروف: " + Object.keys(TARGETS).join("، ")); process.exit(2); }
// مسار اللقطة يصمد في البنيتين: مجلد العمل (web/code/sitecss) ونسخة النشر السطحية
// (sitecss/ في الجذر — ينشئه المساهم وينزّل فيه CSS الموقع؛ اللقطة نفسها لا تُنشر).
// ويقبل تمريرًا صريحًا: node gen-rtl.mjs <مجلد اللقطة>
const CANDIDATES = [
  process.argv.slice(2).find((a) => !a.startsWith("--")),
  path.resolve(HERE, "..", TARGET.dir),        // مجلد العمل: code/<لقطة الهدف> بجوار toolchain
  path.resolve(HERE, "..", "..", TARGET.dir),  // نسخة النشر: اللقطة في الجذر بجوار tools
].filter(Boolean);
const SITECSS = CANDIDATES.find((p) => { try { return fs.readdirSync(p).some((f) => f.endsWith(".css")); } catch { return false; } });
if (!SITECSS) {
  console.error("! لا لقطة CSS للموقع. أنشئ مجلد sitecss/ ونزّل فيه ملفات CSS من claude.ai ثم أعد التشغيل.");
  console.error("  بُحث في: " + CANDIDATES.join(" | "));
  process.exit(1);
}
const { EXT } = await import(new URL("./paths.mjs", import.meta.url).href);
const { pathToFileURL } = await import("node:url");
// عبر EXT لا ../../user/ (يعمل في بنية العمل ونسخة النشر سواء — مراجعة كودكس)
await import(pathToFileURL(path.join(EXT, "cml-rtl.js")).href);
// ‎--out-dir=<مجلد>‎: يكتب الناتجين هناك بدل مجلد الإضافة (بوابة «البناء طازج» تقارن ولا تكتب)
const OUT_DIR = (process.argv.find((a) => a.startsWith("--out-dir=")) || "").slice("--out-dir=".length) || EXT;
const R = globalThis.CMLRtl;

// ---- 1) اجمع لقطة الموقع ----
let manifest = null;
try { manifest = JSON.parse(fs.readFileSync(path.join(SITECSS, "_manifest.json"), "utf8")); } catch {}
// ترتيب المستند الحقيقي (من _manifest.json) لا الترتيب الأبجدي: قواعد الموقع غير
// المطبَّقة تتحاكم بالترتيب عند تساوي التخصيص، وترتيبُنا الداخلي يستنسخ ترتيبه
const docOrder = manifest && Array.isArray(manifest.css) ? manifest.css.map((x) => x.file) : [];
const files = fs.readdirSync(SITECSS).filter((f) => f.endsWith(".css")).sort((a, b) => {
  const ia = docOrder.indexOf(a), ib = docOrder.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
});
if (!files.length) {
  console.error("! لا ملفات CSS في code/sitecss/ — نزّل لقطة الموقع أولًا.");
  process.exit(1);
}

const all = [];
const layerOrder = [];
let parseErrors = 0;
const parseStats = { animatedPhysical: 0 };
for (const f of files) {
  const p = R.parseCss(fs.readFileSync(path.join(SITECSS, f), "utf8"));
  parseErrors += p.stats.parseErrors;
  parseStats.animatedPhysical += p.stats.animatedPhysical;
  for (const L of p.layerOrder) if (!layerOrder.includes(L)) layerOrder.push(L);
  for (const r of p.rules) { r.idx = all.length; all.push(r); }
  console.log(`+ ${f}: ${p.rules.length} قاعدة${p.stats.parseErrors ? ` (${p.stats.parseErrors} خطأ تحليل)` : ""}`);
}

// ---- 2) اقلب ----
const out = R.flipSheet(all, { layerOrder });
const st = out.stats;
console.log(`\nقواعد الموقع: ${all.length} | مقلوب: ${st.flipped} إعلانًا | مصفِّرات: ${st.neutralized}`);
console.log(`منطقي أصلًا: ${st.logicalAlready} | واعٍ بالاتجاه: ${st.dirAware} (عُزّز منه المشروط بـRTL: ${st.dirBoosted})`);
const unf = Object.entries(st.unflippable).map(([k, v]) => `${k}:${v}`).join(" ");
if (unf) console.log(`متعذّر (يصرّح به الطبيب): ${unf}`);

// ---- 3) بوابات الصحة قبل الكتابة ----
if (parseErrors > 50) { console.error(`! ${parseErrors} خطأ تحليل — صيغة CSS الموقع تغيّرت؟ لن أكتب.`); process.exit(1); }
if (all.length < TARGET.minRules || st.flipped < TARGET.minFlipped) {
  console.error(`! المدخل هزيل (قواعد ${all.length}، قلب ${st.flipped}) — لقطة ناقصة؟ لن أكتب.`);
  process.exit(1);
}

const header =
  "/* AUTO-GENERATED by code/toolchain/gen-rtl.mjs — do not edit by hand.\n" +
  " * مُولّد آليًّا (tools/gen-rtl.mjs) من لقطةٍ لملفات CSS العامة للموقع — لا يُعدَّل يدويًّا.\n" +
  " * سلّم تخصيص موحّد: المصفِّرات :not(#..×2) < المنطقيات والمطابقات ×3 < المعزَّزات ×4،\n" +
  " * ومحدِّدات الموقع ملفوفة في :where() (صفر تخصيص) — فالحسم بسلّمنا ثم بترتيب الموقع.\n" +
  " * إعلانات !important في @layer cml-imp (المعلَنة ثانيةً — فالمبكر يغلب في المهمّات،\n" +
  " * وcml-point قبلها محجوزة لإصلاحات app-point.css النقطية فتبقى لها الكلمة الأخيرة).\n" +
  " * كل قاعدة خلف بوابة " + R.GATE + " — بلا السمة الملفُّ خامل حرفيًّا.\n" +
  " * الأنماط السطرية (المحسوبة بجافاسكربت) لا تُمسّ عمدًا. */\n" +
  "@layer cml-point, cml-imp;\n";
const impRules = out.neutralImp.concat(out.logicalImp, out.dirBoostImp);
const css =
  header +
  "\n/* --- جزر LTR --- */\n" + R.ISLANDS_CSS +
  (impRules.length
    ? "\n/* --- المهمّات (!important) — طبقة مبكرة تقلب قانون الطبقات لصالحنا --- */\n" +
      "@layer cml-imp{\n" + R.serializeRules(impRules) + "\n}\n"
    : "") +
  "\n/* --- المستوى ٢: المصفِّرات --- */\n" + R.serializeRules(out.neutral) +
  "\n\n/* --- المستوى ٣: المنطقيات والنسخ المطابقة --- */\n" + R.serializeRules(out.logical) +
  "\n\n/* --- المستوى ٤: قواعد الموقع المشروطة بـRTL معزَّزةً (قصد المؤلف يفوز) --- */\n" +
  R.serializeRules(out.dirBoost) + "\n";

// بوابة ١: إعادة تحليل الناتج
const re = R.parseCss(css);
if (re.stats.parseErrors > 0) { console.error(`! الناتج لا يُعاد تحليله (${re.stats.parseErrors} خطأ). لن أكتب.`); process.exit(1); }
const ungated = re.rules.filter((r) => !r.sel.startsWith('html[data-cml-rtl="v2"]'));
if (ungated.length) {
  console.error(`! ${ungated.length} قاعدة بلا بوابة، أولها: ${ungated[0].sel.slice(0, 80)}. لن أكتب.`);
  process.exit(1);
}
// بوابة ٢: لا فيزيائيَّ في الناتج — الثابت الحقيقي لمحرّك الاتجاه.
// ★ كانت «اللاعودة» تُعيد قلب الناتج وتتوقع صفرًا، وهو صفرٌ بنيويٌّ لا مُختبَر: كل
// قاعدةٍ تحمل البوابة فيتخطاها المحلّل قبل التحليل أصلًا. والثابت الذي يعنينا حقًّا
// أوضحُ منه: **مستوى المنطقيات لا يحمل خاصيةً فيزيائيةً اتجاهية قط**؛ والمصفِّرات لا
// تحمل إلا unset؛ وfloat/clear احتياطٌ مقصود (لا مقابل منطقيَّ لهما مدعومًا).
// (أما المعزَّزات فتُعيد بثَّ قواعد الموقع المشروطة بـRTL كما كتبها مؤلفها — وفيها
// الفيزيائيُّ عن قصدٍ منه، فهي خارج هذا الفحص عمدًا.)
const PHYS_RE = /^(?:margin|padding|border)-(?:left|right)(?:-|$)|^(?:left|right)$|^border-(?:top|bottom)-(?:left|right)-radius$|^inset-(?:left|right)$|^scroll-(?:margin|padding)-(?:left|right)$/;
const leaks = [];
for (const rule of (out.logical || []).concat(out.logicalImp || [])) {
  for (const d of rule.decls || []) {
    if (d.prop === "float" || d.prop === "clear") continue; // احتياطٌ مقصود
    if (PHYS_RE.test(d.prop)) leaks.push(d.prop + ":" + String(d.value).slice(0, 30) + " ← " + rule.sel.slice(0, 70));
  }
}
for (const rule of (out.neutral || []).concat(out.neutralImp || [])) {
  for (const d of rule.decls || []) {
    if (String(d.value).trim() !== "unset") leaks.push("مصفِّرٌ بقيمةٍ غير unset: " + d.prop + ":" + String(d.value).slice(0, 30));
  }
}
if (leaks.length) {
  console.error(`! فيزيائيٌّ تسرّب إلى الناتج (${leaks.length})، أوله:`);
  for (const l of leaks.slice(0, 5)) console.error("   " + l);
  process.exit(1);
}
console.log(`  لا فيزيائيَّ في المنطقيات (${(out.logical || []).length + (out.logicalImp || []).length} قاعدة)، والمصفِّرات unset كلها`);

// ---- 4) اكتب ----
fs.writeFileSync(path.join(OUT_DIR, TARGET.out), css, "utf8");
if (TARGET.cov) {
const cov =
  "/* AUTO-GENERATED by code/toolchain/gen-rtl.mjs — بصمات تغطية محرّك الاتجاه.\n" +
  " * يقارن بها «طبيب الاتجاه» CSS الموقعَ الحيّ ليكشف ما استجدّ ولا نغطيه. */\n" +
  "globalThis.CMLRtlCoverage = " + JSON.stringify({
    flipped: st.flipped,
    sources: manifest && Array.isArray(manifest.css) ? manifest.css.map((x) => ({ file: x.file, sha: x.sha256 })) : files.map((f) => ({ file: f })),
    keys: out.coverage,
  }) + ";\n";
fs.writeFileSync(path.join(OUT_DIR, TARGET.cov), cov, "utf8");
}

console.log(`\n✓ ${TARGET.out}: ${(css.length / 1024).toFixed(1)}KB (تصفير ${out.neutral.length} + منطقي/مطابق ${out.logical.length} + معزَّز ${out.dirBoost.length} + مهمّات ${impRules.length})`);
console.log(`  نسخ مطابقة: ${st.identity} إعلانًا | حركات اتجاهية (تُبلَّغ لا تُقلب): ${parseStats.animatedPhysical}`);
if (TARGET.cov) console.log(`✓ ${TARGET.cov}: ${out.coverage.length} بصمة`);
console.log("✓ البوابات الثلاث: إعادة التحليل، البوابة على كل قاعدة، لا فيزيائيَّ في الناتج");
