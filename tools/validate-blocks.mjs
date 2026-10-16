// validate-blocks.mjs — بوابة دفعة كتلٍ مترجمة قبل دمجها (المرحلة ٢؛ يستدعيها validate-batch --mode=block).
// عقد قابلية التمثيل (مراجعة كودكس) يُفحص هنا قبل أن يدخل القاموس — لا في الصفحة وحدها:
//   ١) كل كتلةٍ في المدخل لها ترجمةٌ واحدة، ولا زائد عليه؛ والبصمة هي بصمة المصدر نفسه (لا انحراف تطبيع)
//   ٢) العناصر النائبة هي نفسها عددًا وترتيبًا ونوعًا ورقمًا، ومحتوى الشيفرة إن ذُكر مطابق
//   ٣) لا نصَّ في خانةٍ لا عقدة نصٍّ لها في المصدر (لا يُكتب إلا في العقد القائمة)
//   ٤) عربيةٌ فعلًا (أو المصدر نفسه حرفًا = يُبقى كما هو)، ولا حروف غير مسموحة
// وتنبيهاتٌ لا تُسقط: طولٌ شاذّ النسبة، أو لاتينيةٌ كثيرة خارج الشيفرة والروابط (ترجمةٌ ناقصة؟).
//   node validate-blocks.mjs <todo-chunk.json: [{fp, src}]> <out.json: [{fp, ar}]>
import fs from "node:fs";
import { SHARED } from "./domain-arg.mjs";

export function validateBlocks(chunk, out) {
  const errors = [], warns = [];
  const want = new Map();
  for (const [i, c] of chunk.entries()) {
    if (!c || typeof c.fp !== "string" || typeof c.src !== "string") { errors.push(`المدخل #${i}: عنصر ناقص`); continue; }
    if (SHARED.blockFp(c.src) !== c.fp) errors.push(`المدخل #${i}: البصمة لا تطابق المصدر (${c.fp})`);
    want.set(c.fp, c.src);
  }
  const seen = new Set();
  let kept = 0;
  for (const [i, p] of out.entries()) {
    if (!p || typeof p.fp !== "string" || typeof p.ar !== "string") { errors.push(`#${i}: عنصر ناقص`); continue; }
    const src = want.get(p.fp);
    const tag = `#${i} ${p.fp}`;
    if (src === undefined) { errors.push(`${tag}: ليس في المدخل`); continue; }
    if (seen.has(p.fp)) { errors.push(`${tag}: مكرّر`); continue; }
    seen.add(p.fp);
    if (typeof p.src === "string" && p.src !== src) errors.push(`${tag}: المصدر المنسوخ غير مصدر المدخل`);
    const ar = p.ar;
    if (!ar.trim()) { errors.push(`${tag}: ترجمة فارغة`); continue; }
    if (/[\u0590-\u05FF]/.test(ar)) errors.push(`${tag}: حروف غير مسموحة`);
    const bad = SHARED.checkBlock(src, ar);
    if (bad) { errors.push(`${tag}: ${bad} — ${src.slice(0, 70)}`); continue; }
    if (ar === src) { kept++; continue; }
    if (!/[\u0600-\u06FF]/.test(ar)) errors.push(`${tag}: لا عربية في الترجمة`);
    // تنبيهات: نسبة الطول، واللاتينية خارج الشيفرة (الروابط قد تكون أسماء منتجات فتُحسب)
    const plain = (s) => s.replace(/<c(\d+)>[\s\S]*?<\/c\1>/g, " ").replace(/<\/?[abisgc]\d+\/?>/g, " ");
    // ★ (S7-B، المراجعة العدائية) معرّفٌ برمجيٌّ في نثر المصدر بلا وسم شيفرة — اسمُ معاملٍ أو حقلٍ (created_at، include_archived،
    // user_ids[]) أو مسارُ نقطة نهاية (/v1/…/{claude_file_id}/content) كما في أوصاف مرجع الواجهة البرمجية — يُنسخ حرفًا كالشيفرة
    const idents = plain(src).match(/(?:\/v\d+\/[\w\/{}.\-]+)|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\[\])?/g) || [];
    const lostIds = [...new Set(idents)].filter((t) => plain(ar).indexOf(t) < 0);
    if (lostIds.length) errors.push(`${tag}: معرّفٌ برمجيٌّ خارج الشيفرة لم يُنسخ حرفيًّا (${lostIds.join("، ")})`);
    const ls = plain(src).trim().length, la = plain(ar).trim().length;
    if (ls > 40 && (la < ls * 0.45 || la > ls * 1.9)) warns.push(`${tag}: طولٌ شاذّ ${la}/${ls}`);
    const latin = (plain(ar).match(/[A-Za-z]/g) || []).length, letters = (plain(ar).match(/[A-Za-z\u0600-\u06FF]/g) || []).length;
    if (letters > 30 && latin / letters > 0.5) warns.push(`${tag}: لاتينيةٌ ${Math.round((100 * latin) / letters)}% — ترجمةٌ ناقصة؟`);
  }
  const missing = [...want.keys()].filter((fp) => !seen.has(fp));
  for (const m of missing.slice(0, 15)) errors.push(`مفقود: ${m} ${want.get(m).slice(0, 60)}`);
  if (missing.length > 15) errors.push(`… و${missing.length - 15} مفقودًا آخر`);
  return { errors, warns, total: out.length, kept, missing: missing.length };
}

if (import.meta.url === new URL(process.argv[1], "file:").href || process.argv[1]?.endsWith("validate-blocks.mjs")) {
  const [chunkPath, outPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!chunkPath || !outPath) { console.error("الاستعمال: node validate-blocks.mjs <todo-chunk.json> <out.json>"); process.exit(2); }
  let chunk, out;
  try { chunk = JSON.parse(fs.readFileSync(chunkPath, "utf8")); out = JSON.parse(fs.readFileSync(outPath, "utf8")); }
  catch (e) { console.error("✗ JSON غير صالح:", e.message); process.exit(1); }
  if (!Array.isArray(chunk) || !Array.isArray(out)) { console.error("✗ ليس مصفوفة"); process.exit(1); }
  const r = validateBlocks(chunk, out);
  console.log(`المدخل ${chunk.length} | المخرَج ${r.total} | مُبقًى ${r.kept} | مفقود ${r.missing} | أخطاء ${r.errors.length} | تنبيهات ${r.warns.length}`);
  for (const e of r.errors.slice(0, 40)) console.log("  ✗", e);
  if (r.errors.length > 40) console.log("  … و" + (r.errors.length - 40) + " أخرى");
  for (const w of r.warns.slice(0, 20)) console.log("  ⚠", w);
  process.exit(r.errors.length ? 1 : 0);
}
