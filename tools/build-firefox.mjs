// build-firefox.mjs — يولّد نسخة فايرفوكس من الإضافة في مجلد شقيق (extension-firefox).
//
// لماذا نسخة مولَّدة لا مجلد ثانٍ يُصان يدويًّا؟ لأن الفرق بين المتصفحَين محصور في
// المانيفست وحده: فايرفوكس MV3 لا يشغّل عمال خدمة بل صفحة أحداث (background.scripts)،
// ويشترط هوية gecko، ولا يعرف minimum_chrome_version. فالمصدر يبقى واحدًا (مجلد كروم)
// وهذا المولّد ينسخه كاملًا ثم يحوّل المانيفست — فلا ينفرق المتصفحان بالسهو أبدًا.
//
//   node web/code/toolchain/build-firefox.mjs
// الناتج: <شقيق مجلد الإضافة>/extension-firefox — يُمحى ويُبنى كاملًا في كل تشغيل،
// فلا يُعدَّل فيه شيء يدويًّا (ولا يُرفع للمستودع — مذكور في .gitignore).

import fs from "node:fs";
import path from "node:path";
import { EXT } from "./paths.mjs";

// الوجهة شقيقةُ مجلد الإضافة لا ابنته: لو وُلدت داخله لدخلت في حزمة كروم نفسها
// (البوابة الخامسة تمسح مجلد الإضافة وتصيح بأي دخيل).
const OUT = path.join(path.dirname(EXT), "extension-firefox");

// هوية الإضافة عند فايرفوكس: ثابتة كي يُعرَف التحديث أنه للإضافة نفسها.
// وstrict_min_version = 127 عمدًا: هو أول إصدار MV3 يوقف منح أذونات المواقع عند
// التثبيت — وشاشةُ الإرشاد في صفحة الإعدادات مبنية على سلوكه هذا بالذات.
const GECKO_ID = "claude-ai-arabic@al-ashalash.github.io";
const GECKO_MIN = "127.0";

// ── النسخ الكامل ────────────────────────────────────────────────────────────
// يُفرَّغ الناتج ويُبنى من الصفر: النسخ فوق بقايا تشغيلٍ سابق يُبقي ملفات حُذفت
// من المصدر، فتشحن نسخة فايرفوكس ما لم يعد موجودًا في كروم.
fs.rmSync(OUT, { recursive: true, force: true });

let copied = 0;
const skipped = [];
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) { copyDir(s, d); continue; }
    // مفتاح التوقيع وحزمته لا يدخلان أي ناتج — كقاعدة make-release نفسها
    if (/\.(pem|crx)$/i.test(e.name)) { skipped.push(e.name); continue; }
    fs.copyFileSync(s, d);
    copied++;
  }
}
copyDir(EXT, OUT);

// ── تحويل المانيفست ─────────────────────────────────────────────────────────
const mfPath = path.join(OUT, "manifest.json");
const mf = JSON.parse(fs.readFileSync(mfPath, "utf8"));

// ١) لا معنى لحدّ إصدار كروم في فايرفوكس — وجودُه ضجيج لا خطأ، لكنه يوهم القارئ
delete mf.minimum_chrome_version;
delete mf.version_name; // فايرفوكس لا يعرفه ويحذّر من الغريب — والعدّاد وصفٌ كروميّ الموطن

// ٢) صفحة الأحداث بدل عامل الخدمة: فايرفوكس MV3 لا يدعم service_worker أصلًا.
//    الترتيب هو ترتيب importScripts في sw.js سواءً بسواء — الثوابت فالمحكّم
//    فالمزامنة فالغراء — لأن sw.js في الصفحة لا يستورد شيئًا (حارس typeof
//    importScripts) بل يجد الكائنات محمَّلةً قبله بهذا الترتيب بالذات.
mf.background = { scripts: ["cml-const.js", "cml-shared.js", "cml-rtl.js", "cml-arbiter.js", "cml-sync.js", "sw.js"] };

// ٣) هوية gecko: بدونها يرفض فايرفوكس MV3 الإضافة، وبحدّ 127 نضمن أن كل من
//    ثبّتها يرى سلوكَ الأذونات الذي بُنيت عليه شاشةُ الإرشاد.
mf.browser_specific_settings = { gecko: { id: GECKO_ID, strict_min_version: GECKO_MIN } };

fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2) + "\n", "utf8");

// ── الفحص الذاتي ────────────────────────────────────────────────────────────
// لا نثق بأنفسنا: نعيد قراءة الناتج من القرص ونتحقق أنه يصلح للتحميل فعلًا.
const errs = [];
function need(cond, msg) { if (!cond) errs.push(msg); }

let back;
try {
  back = JSON.parse(fs.readFileSync(mfPath, "utf8")); // ذهابٌ وإياب: الملف المكتوب JSON صالح
} catch (e) {
  errs.push("المانيفست المكتوب لا يُقرأ JSON: " + e.message);
}
if (back) {
  need(back.manifest_version === 3, "manifest_version يجب أن يبقى 3");
  need(back.minimum_chrome_version === undefined, "minimum_chrome_version لم يُحذف");
  need(back.version_name === undefined, "version_name لم يُحذف (فايرفوكس يحذّر منه)");
  need(back.background && back.background.service_worker === undefined, "service_worker بقي في المانيفست");
  need(back.background && Array.isArray(back.background.scripts) && back.background.scripts.length === 6,
    "background.scripts ليست قائمة الملفات الستة");
  for (const f of (back.background && back.background.scripts) || []) {
    need(fs.existsSync(path.join(OUT, f)), "ملف خلفية يذكره المانيفست مفقود: " + f);
  }
  need(back.browser_specific_settings && back.browser_specific_settings.gecko &&
    back.browser_specific_settings.gecko.id === GECKO_ID &&
    back.browser_specific_settings.gecko.strict_min_version === GECKO_MIN,
    "هوية gecko أو حدّ الإصدار ناقصان");
  need(Array.isArray(back.permissions) && back.permissions.length === 1 && back.permissions[0] === "storage",
    "الصلاحيات يجب أن تبقى [storage] وحدها");
}
// الحارس في sw.js شرطُ صحة الصفحة: بدونه تصيح الصفحة بـimportScripts غير المعرّفة
const swText = fs.readFileSync(path.join(OUT, "sw.js"), "utf8");
need(/typeof\s+importScripts\s*===\s*"function"/.test(swText),
  "sw.js بلا حارس typeof importScripts — سينهار في صفحة أحداث فايرفوكس");

if (errs.length) {
  console.error("✗ فحص نسخة فايرفوكس أخفق:");
  for (const e of errs) console.error("  - " + e);
  process.exit(1);
}

console.log("نسخة فايرفوكس: " + OUT);
console.log("نُسخ " + copied + " ملفًا" + (skipped.length ? " · استُثني: " + skipped.join("، ") : ""));
console.log("المانيفست: صفحة أحداث [" + back.background.scripts.join("، ") + "] · gecko " +
  GECKO_ID + " (حدّه " + GECKO_MIN + ") · بلا minimum_chrome_version");
console.log("✓ الفحص الذاتي سليم — حمّلها مؤقتًا من about:debugging ثم امنح إذن المواقع من صفحة الخيارات");
