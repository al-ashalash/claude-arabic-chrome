// merge-blocks.mjs — دمج دفعات الكتل المترجمة (المرحلة ٢) في قاموس كتل النطاق، وخريطة الصفحات من حصاد الكتل.
//   node merge-blocks.mjs --domain=<نطاق> [--harvest=<blocks-*.json>] [--rebuild]   (--rebuild بعد مرورٍ تحريري على دفعاتٍ مدموجة)
// المدخل: glossary/<نطاق>/_blk_batches/*.json ‏[{fp, src, ar}] (خاصة، لا تُنشر). كل عنصرٍ يُعاد فحصه هنا بعقد
// قابلية التمثيل نفسه (validate-blocks) — البوابة قبل القاموس، لا في الصفحة وحدها.
// الناتج: user/dictionaries/ar-<نطاق>.blocks.json = {_meta, pages: {مفتاح الصفحة: [fp…]}, blocks: {fp: عربية}}
// بلا نصٍّ إنجليزي (المفتاح بصمة). ما تُرك كما هو (ar = src) يُسجَّل في kept ولا تُشحن له قيمة، بل علامةُ إبقاءٍ في صفحاته
// (keepPages: {مفتاح الصفحة: [fp…]} — بصماتٌ فقط؛ S6-C): المحرّك يقدّمها على قاموس الواجهة في الكتلة ذات العقدة الوحيدة.
// ودفعةٌ اسمها يحوي override تسبق ما قبلها؛ وإلا فالموجود يبقى. وبصمةٌ واحدة لمصدرين مختلفين = تعارضٌ يوقف الدمج.
import fs from "node:fs";
import path from "node:path";
import { C, SHARED, domainArg, label, blocksDictFile, blockBatchDir, latestBlocksHarvest, harvestDate } from "./domain-arg.mjs";

const argv = process.argv.slice(2);
const opt = (n) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ""; };
const D = domainArg(process.argv);
const dictPath = blocksDictFile(D);
const dict = fs.existsSync(dictPath) ? JSON.parse(fs.readFileSync(dictPath, "utf8")) : {};
// ★ قاموسٌ بإصدار تطبيعٍ آخر لا يُحمَل إلى الجديد (بصماته لا تطابق شيئًا): يُرفض إلا بـ--reset مع حصادٍ جديد
const stale = dict._meta && dict._meta.v !== SHARED.BLOCK.V;
if (stale && !argv.includes("--reset")) {
  console.error(`! القاموس بإصدار تطبيع ${dict._meta.v} والحالي ${SHARED.BLOCK.V} — أعد الحصاد كاملًا وبصمات الدفعات ثم شغّل بـ--reset`);
  process.exit(2);
}
if (stale && !opt("harvest") && !latestBlocksHarvest(D)) { console.error("! ‎--reset‎ يتطلّب حصاد كتلٍ جديدًا"); process.exit(2); }
const base = stale ? {} : dict;
const blocks = Object.assign({}, base.blocks || {});
const kept = new Set(base.kept || []);
const before = Object.keys(blocks).length;

const bDir = blockBatchDir(D);
const files = fs.existsSync(bDir) ? fs.readdirSync(bDir).filter((f) => f.endsWith(".json")).sort() : [];
const srcOf = new Map();
let added = 0, updated = 0, skipped = 0, bad = 0, keptN = 0;
const problems = [];
// ★ (S9-M، ٢٢ ربيع الآخر ١٤٤٨هـ) --rebuild: الدفعات مصدر الحقيقة. مرورٌ تحريري يعدّل دفعاتٍ دُمجت من قبل (S9-A وCONSOLE-EN)
// فكان الدمج العادي «يترك» القيمة القديمة لأن الموجود يبقى إلا بدفعة override — فيُبنى القاموس ناجحًا ولا يحمل التحرير.
// بهذا الخيار تُعاد كل بصمةٍ في دفعةٍ من دفعتها (الأول بترتيب الملفات يغلب، وoverride فوقه كالعادة)، وما ليس في دفعةٍ يبقى كما هو
const rebuild = argv.includes("--rebuild");
const prevBlocks = Object.assign({}, blocks), prevKept = new Set(kept);
if (rebuild) {
  for (const f of files) {
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(bDir, f), "utf8")); } catch { continue; }
    for (const p of Array.isArray(arr) ? arr : []) if (p && typeof p.fp === "string") { delete blocks[p.fp]; kept.delete(p.fp); }
  }
}
for (const f of files) {
  const over = /override/i.test(f);
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(bDir, f), "utf8")); } catch { problems.push(`${f}: JSON غير صالح`); bad++; continue; }
  for (const p of Array.isArray(arr) ? arr : []) {
    if (!p || typeof p.fp !== "string" || typeof p.src !== "string" || typeof p.ar !== "string") { bad++; continue; }
    if (SHARED.blockFp(p.src) !== p.fp) { problems.push(`${f} ${p.fp}: البصمة لا تطابق المصدر`); bad++; continue; }
    const prevSrc = srcOf.get(p.fp);
    if (prevSrc !== undefined && prevSrc !== p.src) { console.error(`✗ تعارض بصمة ${p.fp} بين مصدرين — أُوقف الدمج`); process.exit(1); }
    srcOf.set(p.fp, p.src);
    const ar = p.ar.trim();
    if (/[\u0590-\u05FF]/.test(ar)) { problems.push(`${f} ${p.fp}: حروف غير مسموحة`); bad++; continue; }
    const why = SHARED.checkBlock(p.src, ar);
    if (why) { problems.push(`${f} ${p.fp}: ${why}`); bad++; continue; }
    const hasAr = Object.prototype.hasOwnProperty.call(blocks, p.fp);
    // «يُترك كما هو» كسائر القرارات: لا يمحو ترجمةً قائمة ولا يُمحى إلا بدفعة override (ترتيب الملفات لا يقرّر)
    if (ar === p.src) {
      if (hasAr && !over) { skipped++; continue; }
      if (!kept.has(p.fp)) { kept.add(p.fp); keptN++; }
      delete blocks[p.fp]; continue;
    }
    if (kept.has(p.fp) && !over) { skipped++; continue; }
    if (!/[\u0600-\u06FF]/.test(ar)) { problems.push(`${f} ${p.fp}: لا عربية`); bad++; continue; }
    const has = Object.prototype.hasOwnProperty.call(blocks, p.fp);
    if (has && !over) { skipped++; continue; }
    if (has && blocks[p.fp] === ar) { skipped++; continue; }
    blocks[p.fp] = ar; kept.delete(p.fp);
    if (has) updated++; else added++;
  }
}

// خريطة الصفحات: ما في الحصاد يُستبدل، وما ليس فيه يبقى (حصادٌ جزئي لا يمحو صفحاتٍ لم يزرها)
// ★ كل حصادٍ في _harvest بترتيب زمنه (الأحدث يغلب في الصفحة الواحدة) — لا الأحدث وحده: حصادٌ جزئي
// لاحق كان يُسقط صفحاتِ حصادٍ سابق لم يُدمج بعدُ فلا تُشحن ترجماتها
// ★ (١٦ ربيع الآخر ١٤٤٨هـ) بمفتاح الصفحة القانوني (SHARED.pageKey: «…/index» مسارُ أبيها) — حصادٌ قديم أخذ العنوان من
// llms.txt كما هو (‎/docs/en/whats-new/index‎) فكانت قطعته باسمٍ لا يطلبه المحرّك؛ والقانوني يعود نفسه فلا يتغيّر غيره
const META_D = (C.domain(D) || {}).meta || {};
const pk0 = (pk) => SHARED.pageKey(META_D, pk);
const pages = {};
for (const [pk, fps] of Object.entries(base.harvested || base.pages || {})) pages[pk0(pk)] = fps;
const hvDir = path.join(path.dirname(latestBlocksHarvest(D) || path.join(blockBatchDir(D), "..", "_harvest", "x")), "");
const hvFiles = opt("harvest") ? [opt("harvest")]
  : (fs.existsSync(hvDir) ? fs.readdirSync(hvDir).filter((n) => /^blocks-.*\.json$/.test(n)).sort().map((n) => path.join(hvDir, n)) : []);
let hvUsed = 0;
// ★ (ر9-أ، ٣ جمادى الأولى ١٤٤٨هـ) تاريخ الحصاد يسافر مع القاموس (_meta.harvestedAt): أحدثُ حصادٍ استُعمل فعلًا للنطاق هنا (harvestDate)،
// ومنه يكتب build.mjs تاريخ index.json، فتُبنى بنية المستودع العام (لا مجلد عمل فيها ولا حصاد — make-release لا ينشرهما) طازجةً
// كمجلد العمل. ولا يرجع التاريخ إلى الوراء: خريطة الصفحات تراكمية (ما حمله القاموس من حصادٍ أحدث باقٍ فيها)، فتاريخ القاموس
// السابق يبقى إن كان أحدث — حصادٌ أقدم بـ--harvest، أو تشغيلٌ بلا حصاد. وقاموسٌ بإصدار تطبيعٍ آخر (--reset) لا يُحمل تاريخه
const prevAt = !stale && dict._meta && typeof dict._meta.harvestedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dict._meta.harvestedAt)
  ? dict._meta.harvestedAt : null;
let harvestedAt = prevAt;
for (const hvPath of hvFiles) {
  const hv = JSON.parse(fs.readFileSync(hvPath, "utf8"));
  if (hv.domain !== D || hv.v !== SHARED.BLOCK.V) { console.warn(`⚠ تُرك ${path.basename(hvPath)}: نطاق ${hv.domain} أو إصدار تطبيع ${hv.v}`); continue; }
  for (const [pk, fps] of Object.entries(hv.pages || {})) pages[pk0(pk)] = fps;
  hvUsed++;
  const at = harvestDate(hvPath, hv);
  if (at && (!harvestedAt || at > harvestedAt)) harvestedAt = at;
}
if (stale && !hvUsed) { console.error("! ‎--reset‎ يتطلّب حصاد كتلٍ بالإصدار الحالي"); process.exit(2); }
// ★ (ر6، ٢٦ ربيع الآخر ١٤٤٨هـ) لا يُشحن متن صفحةٍ لم تكتمل دفعتها: الكتلة المشتركة تُترجم في دفعة أول صفحةٍ تحملها،
// فكانت صفحات الدفعات الباقية (code-102…144) تُشحن بكتلٍ عربيةٍ متفرقة وسط متنٍ إنجليزي، ويعدّها سطر التغطية معرَّبة.
// المرجع بيان الدفعات (_blk_todo/p4-manifest.json: {id, pages}): صفحةٌ كل دفعاتها بلا ملفٍّ في _blk_batches تُحجب من
// pages وkeepPages وتبقى في harvested؛ وصفحةٌ ليست في البيان لا تتأثّر. ولا يعمل الحجب إلا إذا طابقت دفعةٌ واحدةٌ على
// الأقل معرّفًا في البيان، فنطاقٌ بتسميةٍ أخرى لا تسقط صفحاته كلها.
const pending = new Set();
const manPath = path.join(bDir, "..", "_blk_todo", "p4-manifest.json");
if (fs.existsSync(manPath)) {
  const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
  const has = (id) => files.some((n) => new RegExp("(^|[^0-9A-Za-z])" + id + "([^0-9]|$)").test(n));
  const doneIds = new Set(man.filter((m) => has(m.id)).map((m) => m.id));
  if (doneIds.size) {
    // ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر6، F5) تُحجب الصفحة إن بقيت لها دفعةٌ واحدةٌ غير منجزة، لا إن خلت من المنجز كلّه: صفحةٌ تتوزّع
    // كتلها على دفعاتٍ منجزة وأخرى لم تُنجز (hooks في code-122…125، وenv-vars في 116…118) كانت تُشحن نصفُها عربيٌّ ونصفُها إنجليزي متى
    // دُمج بعضُ C8–C10. واليوم لا صفحة كذلك في code ولا في legal، فالناتج واحد
    for (const m of man) for (const u of m.pages || []) {
      const pk = pk0(/^https?:/.test(u) ? new URL(u).pathname : u);
      if (!doneIds.has(m.id)) pending.add(pk);
    }
    console.log(`بيان الدفعات: ${doneIds.size} من ${man.length} دفعةً منجزة؛ حُجب متن ${[...pending].filter((pk) => pages[pk]).length} صفحةً لم تكتمل دفعتها`);
  }
}
// كل صفحةٍ تحمل ما تُرجم من كتلها وحده (القطعة المشحونة)
const outPages = {};
let shipped = 0;
for (const pk of Object.keys(pages).sort()) {
  if (pending.has(pk)) continue;
  const fps = pages[pk].filter((fp) => Object.prototype.hasOwnProperty.call(blocks, fp));
  if (fps.length) { outPages[pk] = fps; shipped += fps.length; }
}
// ★ (S6-C) علامات الإبقاء بنطاق الصفحة: كل كتلةٍ قرّر المترجم إبقاءها كما في المصدر، في كل صفحةٍ حُصدت فيها. كانت لا تُشحن
// فيعرّب قاموسُ الواجهة كتلةً من عقدةٍ واحدة يطابق نصُّها عنوانًا فيه (جدول «الصفحات المتاحة» في صفحة Claude Platform on AWS:
// عشرة أسماءٍ لصفحات Console عربيةٌ بين صفوفٍ أبقاها المترجم إنجليزية). والعلامة لصفحاتها وحدها: البصمة نفسها في صفحةٍ أخرى
// لم تُحصد فيها لا تتأثّر
// ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ) ومع قرارات المترجم ما أبقاه تحضير الدفعات كما هو قبل الترجمة (_blk_todo/kept-as-is.json: شيفرةٌ أو عناوين
// وروابط أو مفاتيح ورموز أو أسماء منتجاتٍ وحدها، أو كتلٌ مؤجَّلة لقرار المالك) — لا ما أحاله إلى قاموس الواجهة (أسبابه تبدأ بـui). يحتاجها
// حارس المتن المختلط (engine.js، meta.bodyGuard) ليعدّها مغطّاةً لا متنًا تغيّر؛ وعلامةُ الإبقاء لا تغيّر عرضها: لا تُترجم أصلًا، ولا يعرّب
// قاموسُ الواجهة منها شيئًا (قِيس على الصفحات المشحونة الحيّة، ٢٩ ربيع الآخر ١٤٤٨هـ). وهي في keepPages وحدها لا في kept (قرارات المترجم)
const prepKeep = new Set();
const kaiPath = path.join(bDir, "..", "_blk_todo", "kept-as-is.json");
if (fs.existsSync(kaiPath)) {
  const kai = JSON.parse(fs.readFileSync(kaiPath, "utf8"));
  for (const x of (kai && kai.blocks) || []) if (x && typeof x.fp === "string" && typeof x.why === "string" && !/^ui/.test(x.why)) prepKeep.add(x.fp);
}
const keepPages = {};
let keepShipped = 0, prepShipped = 0;
for (const pk of Object.keys(pages).sort()) {
  if (pending.has(pk)) continue;
  const fps = [...new Set(pages[pk].filter((fp) => (kept.has(fp) || prepKeep.has(fp)) && !Object.prototype.hasOwnProperty.call(blocks, fp)))].sort();
  if (fps.length) { keepPages[pk] = fps; keepShipped += fps.length; prepShipped += fps.filter((fp) => !kept.has(fp)).length; }
}
if (prepKeep.size) console.log(`مُبقًى في التحضير (kept-as-is): ${prepKeep.size} بصمة؛ منها ${prepShipped} علامة إبقاءٍ في صفحاتٍ مشحونة`);
const sorted = {};
for (const fp of Object.keys(blocks).sort()) sorted[fp] = blocks[fp];
const out = {
  _meta: { domain: D, v: SHARED.BLOCK.V, count: Object.keys(sorted).length, pages: Object.keys(outPages).length, kept: kept.size,
           keepPages: Object.keys(keepPages).length, keepShipped,
           // ★ (ر9-أ) تاريخ آخر حصادٍ دخل خريطة الصفحات (أعلاه) — ولا مفتاح إن لم يُعرف تاريخ (فيأخذه البناء من اسم أحدث حصادٍ إن وُجد)
           ...(harvestedAt ? { harvestedAt } : {}),
           note: "قاموس كتل المتون: البصمة ← القالب العربي (cml-shared.js، وضع الكتلة). بلا نصٍّ إنجليزي." },
  pages: outPages,
  blocks: sorted,
  kept: [...kept].sort(),
  keepPages,
  // الصفحات المحصودة كلها بكتلها (لتُحسب القطعة من جديد متى تُرجم المزيد) — بصماتٌ فقط
  harvested: Object.fromEntries(Object.keys(pages).sort().map((pk) => [pk, pages[pk]])),
};
fs.writeFileSync(dictPath, JSON.stringify(out, null, 1) + "\n", "utf8");
for (const p of problems.slice(0, 30)) console.log("  ✗ " + p);
if (problems.length > 30) console.log(`  … و${problems.length - 30} أخرى`);
console.log(`${label(D)}: دفعات ${files.length} | أُضيف ${added} | حُدِّث ${updated} | تُرك ${skipped} | مُبقًى ${keptN} | مرفوض ${bad}`);
if (rebuild) {
  let chg = 0, gone = 0, fresh = 0, keptNew = 0, keptGone = 0;
  for (const [fp, v] of Object.entries(prevBlocks)) { if (!Object.prototype.hasOwnProperty.call(blocks, fp)) gone++; else if (blocks[fp] !== v) chg++; }
  for (const fp of Object.keys(blocks)) if (!Object.prototype.hasOwnProperty.call(prevBlocks, fp)) fresh++;
  for (const fp of kept) if (!prevKept.has(fp)) keptNew++;
  for (const fp of prevKept) if (!kept.has(fp)) keptGone++;
  console.log(`--rebuild (مقارنةً بالقاموس السابق): تغيّرت ${chg} | جديدة ${fresh} | زالت ${gone} | مُبقًى جديد ${keptNew} | مُبقًى زال ${keptGone}`);
}
console.log(`${path.basename(dictPath)}: ${before} → ${out._meta.count} كتلة؛ صفحاتٌ بمتونٍ مترجمة ${out._meta.pages} (${shipped} مدخلًا في القطع)` +
  `؛ علامات إبقاء ${keepShipped} في ${Object.keys(keepPages).length} صفحة`);
{
  const atNote = !harvestedAt ? "" : harvestedAt === prevAt ? " (كما في القاموس السابق)" : prevAt ? ` (كان ${prevAt})` : " (لم يكن في القاموس)";
  console.log(`تاريخ الحصاد (_meta.harvestedAt): ${harvestedAt || "غير معروف"}${atNote} — الحصادات المستعملة: ${hvUsed}`);
}
process.exit(bad ? 1 : 0);
