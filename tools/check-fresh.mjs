// check-fresh.mjs — بوابة «البناء طازج»: المولَّد المودَع يطابق ما يولّده مصدرُه الآن.
//
// لماذا: القاموس المبنيّ (dictionary.js) ولقطة الاتجاه (rtl-overrides.css) ملفاتٌ مولَّدة
// مودَعة في المستودع — وتعديلُ المصدر (ar.json أو cml-rtl.js) بلا إعادة بناءٍ يشحن للمتجر
// ناتجًا قديمًا لا يراه أي اختبار. هذه البوابة تبني في مجلدٍ مؤقت ثم تقارن **كل مخرجٍ متوقع
// بعينه** (لا git diff، الذي لا يرى ملفًّا مولَّدًا جديدًا غير متتبَّع)، ولا تكتب في الإضافة شيئًا.
//
//   node check-fresh.mjs            ← رمز الخروج 1 إن تقادم مخرجٌ واحد
// لقطة الاتجاه تُفحص حيث توجد لقطة CSS الموقع (مجلد العمل)؛ وفي نسخة النشر (بلا sitecss)
// يُصرَّح بتخطّيها لا يُسكت عنه.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EXT } from "./paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cml-fresh-"));
// ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ) process.exit داخل try (البناء أخفق) لا يمرّ بـfinally، فكان المجلد المؤقت يبقى: احتياطٌ عند الخروج
process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });
let stale = 0;

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}
function same(name, quiet) {
  const a = path.join(EXT, name), b = path.join(tmp, name);
  if (!fs.existsSync(b)) { console.error(`✗ ${name}: لم يولّده البناء`); stale++; return; }
  if (!fs.existsSync(a)) { console.error(`✗ ${name}: مولَّدٌ غير مودَع في الإضافة`); stale++; return; }
  // مقارنة بايتية بعد توحيد نهايات الأسطر (مستخرَجات ويندوز قد تحمل CRLF)
  const na = fs.readFileSync(a, "utf8").replace(/\r\n/g, "\n"), nb = fs.readFileSync(b, "utf8").replace(/\r\n/g, "\n");
  if (na !== nb) { console.error(`✗ ${name}: قديم — أعد البناء (${na.length} ≠ ${nb.length} حرفًا)`); stale++; }
  else if (!quiet) console.log(`✓ ${name}`);
}

try {
  const b = run("build.mjs", ["--out=" + tmp]);
  if (!b.ok) { console.error("✗ البناء نفسه أخفق:\n" + b.out); process.exit(1); }
  // قاموس كل نطاق من جدول النطاقات (dictionary.js للتطبيق وdict-<نطاق>.js للبقية)
  await import(pathToFileURL(path.join(EXT, "cml-const.js")).href);
  globalThis.CMLConst.DOMAINS.map((d) => d.dict).concat(["languages.json", "manifest.json"]).forEach(same);
  // قطع المتون (المرحلة ٢): الشجرة كلها في الاتجاهين — قطعةٌ ناقصة أو زائدة (صفحةٌ حُذفت) تُعدّ قِدمًا
  const listTree = (root) => {
    const out = [];
    (function walk(d, rel) {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(d, e.name), rel + e.name + "/"); else out.push(rel + e.name);
      }
    })(path.join(root, "bodies"), "bodies/");
    return out.sort();
  };
  const bodiesA = listTree(EXT), bodiesB = listTree(tmp);
  for (const f of bodiesA) if (!bodiesB.includes(f)) { console.error(`✗ ${f}: مودَعٌ لم يعد البناء يولّده`); stale++; }
  let bodiesOk = 0;
  for (const f of bodiesB) { const before = stale; same(f, true); if (stale === before) bodiesOk++; }
  if (bodiesB.length) console.log(`✓ قطع المتون: ${bodiesOk}/${bodiesB.length}`);

  // لقطة الاتجاه لكل هدف (التطبيق، ومنصة Intercom، والوثائق، ووثائق Claude Code، والوثائق القانونية، والأكاديمية متى وُجدت لقطتها)
  for (const [target, outs] of [["app", ["rtl-overrides.css", "rtl-coverage.js"]], ["intercom", ["rtl-intercom.css"]], ["docs", ["rtl-docs.css"]], ["code", ["rtl-code.css"]],
                                ["legal", ["rtl-legal.css"]], ["academy", ["rtl-academy.css"]]]) {
    const g = run("gen-rtl.mjs", ["--target=" + target, "--out-dir=" + tmp]);
    if (g.ok) outs.forEach(same);
    else if (/لا لقطة CSS للموقع/.test(g.out)) {
      // لا لقطة للهدف في مجلد العمل ومخرجُه مودَع: يتيمٌ لا يُعرف مصدره — يُصرَّح به
      const orphan = outs.filter((o) => fs.existsSync(path.join(EXT, o)));
      if (orphan.length && fs.existsSync(path.join(HERE, "..", "sitecss"))) { console.error(`✗ ${orphan.join("، ")}: مودَعٌ بلا لقطة مصدره (${target})`); stale++; }
      else console.log(`ℹ لقطة الاتجاه (${target}): لا لقطة CSS هنا — تُفحص في مجلد العمل وحده`);
    }
    else { console.error(`✗ مولّد الاتجاه أخفق (${target}):\n` + g.out.slice(-1500)); stale++; }
  }
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
if (stale) { console.error(`\n✗ ${stale} مخرجًا ليس طازجًا`); process.exit(1); }
console.log("\n✓ المولَّد المودَع طازج");
