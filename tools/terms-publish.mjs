// terms-publish.mjs — كاتبُ قاعدة المصطلحات المتتبَّعة (code/glossary/terms-base.json).
//
// القاعدة: لا يُلتزم من سوار إلا المقابل المعتمد بمعرّف مدخله وإسناده (شروط سوار: لا احتفاظ ببيانات واجهاتها فوق
// ثلاثين يومًا). فكل مسودّةٍ للقاعدة — من أداة دمجٍ أو تعديلٍ يدوي — تمرّ من هنا قبل أن تُكتب: ما كان من سوار وليس
// مقابلًا معتمدًا (siwar-lib.mjs: adoptedRenderings، والقائمة glossary/adopted-renderings.json) يُحفظ بمعرّفه
// وحده (publishableBase)، وتُرفض المسودّة إن نسبت note أو why إلى معجمٍ من سوار صياغةً ليست مقابلًا معتمدًا
// (proseViolations) حتى يُكتب مكانها «مقابلٌ آخر في المعجم (المدخل <أول ٨>)» أو يُكتفى بالمعرّف.
//   node terms-publish.mjs <draft.json>   → يكتب terms-base.json (ذرّيًّا) ويطبع ما حُفظ بمعرّفه وحده
//   node terms-publish.mjs --check        → يفحص terms-base.json المتتبَّع: رمز خروج 2 إن خالف القاعدة
// المسودّة تحمل بيانات سوار، فموضعها مجلدٌ يتجاهله git (glossary/_terms/ مثلًا) — والأداة ترفض غيره.
// الصياغة ثابتة كما في القاعدة المتتبَّعة: إزاحة مسافةٍ واحدة، وLF، وسطرٌ أخير.
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY } from "./paths.mjs";
import { publishableBase, proseViolations, loadAdopted, assertIgnoredOut } from "./siwar-lib.mjs";

const TARGET = path.join(GLOSSARY, "terms-base.json");
const argv = process.argv.slice(2);
const check = argv.includes("--check");
const src = check ? TARGET : argv.find((a) => !a.startsWith("--"));
if (!src) { console.error("usage: node terms-publish.mjs <draft.json> | --check"); process.exit(2); }
if (!check) assertIgnoredOut(src, "terms-publish (المسودّة)");
const draft = JSON.parse(fs.readFileSync(src, "utf8"));
if (!draft || !Array.isArray(draft.terms)) { console.error(`✗ terms-publish: ${src} بلا terms[]`); process.exit(2); }
const adopted = loadAdopted();
const { base, reduced } = publishableBase(draft, adopted);
const prose = proseViolations(draft, adopted);
const list = (xs) => { for (const r of xs.slice(0, 30)) console.error(`  ${r.term} ← ${r.code} ${r.entry || ""}`); if (xs.length > 30) console.error(`  … و${xs.length - 30} غيرها`); };
const listProse = (xs) => { for (const p of xs.slice(0, 40)) console.error(`  ${p.term}.${p.field}`); if (xs.length > 40) console.error(`  … و${xs.length - 40} غيرها`); };
const proseMsg = (n) => `✗ terms-publish: ${n} صياغةً في note/why منسوبةً إلى معجمٍ من سوار وليست مقابلًا معتمدًا — ` +
  "اكتب مكان كلٍّ منها «مقابلٌ آخر في المعجم (المدخل <أول ٨ من المعرّف>)» بإعرابه، أو اكتفِ بالمعرّف، ثم أعد التشغيل:";

if (check) {
  if (reduced.length) {
    console.error(`✗ terms-publish --check: ${reduced.length} مصدرًا من سوار بزوجٍ ليس مقابلًا معتمدًا في terms-base.json — ` +
      "أعد كتابتها بـ node terms-publish.mjs <المسودّة> (تُحفظ بمعرّفها وحده):");
    list(reduced);
  }
  if (prose.length) { console.error(proseMsg(prose.length)); listProse(prose); }
  if (reduced.length || prose.length) process.exit(2);
  console.log(`✓ terms-base.json: ${base.terms.length} مصطلحًا، ولا زوجَ ولا صياغةَ منسوبةً من سوار إلا المقابل المعتمد`);
  process.exit(0);
}

if (prose.length) { console.error(proseMsg(prose.length)); listProse(prose); process.exit(2); }
const txt = JSON.stringify(base, null, 1) + "\n";
const tmp = TARGET + ".tmp-" + process.pid;
fs.writeFileSync(tmp, txt, "utf8");
fs.renameSync(tmp, TARGET);
console.log(`terms-base.json: ${base.terms.length} مصطلحًا؛ حُفظ بمعرّفه وحده ${reduced.length} مصدرًا من سوار`);
list(reduced);
