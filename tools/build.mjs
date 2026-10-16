// build.mjs — assemble the browser extension's runtime data from the editable
// dictionary JSONs + languages.json. Produces:
//   user/extension/dictionary.js   (globalThis.CLAUDE_L10N — تطبيق claude.ai)
//   user/extension/dict-<نطاق>.js  (قاموس كل نطاقٍ آخر من جدول CMLConst.DOMAINS)
//   user/extension/languages.json  (enabled languages for the popup)
//   user/extension/bodies/<نطاق>/<لغة>/<قطعة>.json + index.json  (قطع المتون لكل صفحة — المرحلة ٢)
//   manifest.json: content_scripts من جدول النطاقات، وversion_name
// Run this after editing any user/dictionaries/*.json.  node build.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveDirection } from "./direction.mjs";
import { LANGUAGES_JSON, DICTS, EXT, GLOSSARY } from "./paths.mjs";
import { latestBlocksHarvest, harvestDate } from "./domain-arg.mjs";

// ── وسائط الإصدار تُتحقَّق **قبل** أي كتابة (مراجعة كودكس) ─────────────────────────
//   --set-version=X.Y.Z  إسنادٌ صريح (تكراره لا يغيّر شيئًا — هو ما يُستعمل عند الإصدار)
//   --bump=patch|minor|major  زيادةٌ نسبية (تكرارها يزيد مرة أخرى؛ للصيانة الفرعية)
//   نوعٌ مجهول أو رقمٌ غير صالح ⇒ خروجٌ قبل أن يُمسّ ملف (كان يُفسَّر patch صامتًا بعد
//   كتابة القاموس). --out=<مجلد>: مخرجات البناء هناك بدل مجلد الإضافة (بوابة الطزاجة).
const argSet = (process.argv.find((a) => a.startsWith("--set-version=")) || "").slice("--set-version=".length);
const bumpRaw = process.argv.find((a) => a.startsWith("--bump"));
let bumpKind = null;
if (bumpRaw) {
  bumpKind = (bumpRaw.split("=")[1] || process.argv[process.argv.indexOf(bumpRaw) + 1] || "").toLowerCase();
  if (!/^(patch|minor|major)$/.test(bumpKind)) { console.error(`! نوع --bump مجهول: «${bumpKind}» — المسموح patch|minor|major`); process.exit(1); }
}
if (argSet && !/^\d+\.\d+\.\d+$/.test(argSet)) { console.error(`! --set-version يطلب X.Y.Z: «${argSet}»`); process.exit(1); }
if (argSet && bumpKind) { console.error("! لا يُجمع --set-version و--bump"); process.exit(1); }
const OUT_ARG = (process.argv.find((a) => a.startsWith("--out=")) || "").slice("--out=".length);
const OUTDIR = OUT_ARG ? path.resolve(OUT_ARG) : EXT;
if (OUT_ARG) fs.mkdirSync(OUTDIR, { recursive: true });

const registry = JSON.parse(fs.readFileSync(LANGUAGES_JSON, "utf8"));
const enabled = registry.languages.filter((l) => l.enabled && !l.isBase);

// جدول النطاقات من المصدر الواحد (cml-const.js) — البناء يولّد قاموسًا لكل نطاق ومداخلَ
// المانيفست منه، فلا تنحرف قائمةٌ عن أختها
await import(pathToFileURL(path.join(EXT, "cml-const.js")).href);
const C = globalThis.CMLConst;

// ---- guard: a literal string that a pattern/plural already covers would SHADOW it.
// The engine tries strings first, so one date would render in the literal's style and
// every other date in the pattern's — silently inconsistent. Fail loudly instead.
function shadowGuard(d, label) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const res = [];
  // الأنماط ذات الالتقاط المحدود (b)، والمعلَّمة lit (عنوانٌ حرّ الطول كعنوان المحادثة لا يُحدّ التقاطه)، تُستثنى: تصادمها مع مفتاحٍ حرفي مقبولٌ بقصد — «Add a card» نصٌّ مستقل في الموقع
  // لا مثيلٌ لقالب «Add {name}»، والحرفيّ يسبق الأنماط فيبقى كلٌّ بترجمته (makePatternBounded، بوابة الشمول ١٤٤٨هـ)
  for (const p of d.patterns || []) { if (p.b || p.lit) continue; try { res.push({ re: new RegExp(p.re), src: `pattern «${p.en}»` }); } catch {} }
  for (const [en, spec] of Object.entries(d.plurals || {}))
    for (const pat of [en, spec.plural])
      if (pat) res.push({ re: new RegExp("^" + esc(pat).replace("%d", "(\\d+)") + "$"), src: `plural «${en}»` });
  const clashes = [];
  for (const k of Object.keys(d.strings || {})) {
    const hit = res.find((r) => r.re.test(k));
    if (hit) clashes.push(`   ${JSON.stringify(k)}  ← shadows ${hit.src}`);
  }
  if (clashes.length) {
    console.error(`\n! ${label}: ${clashes.length} literal string(s) shadow a pattern/plural:`);
    console.error(clashes.slice(0, 20).join("\n"));
    console.error("  Remove them from the dictionary — the pattern is the general, consistent form.\n");
    process.exit(1);
  }
}

// ملف قاموس النطاق لكل لغة: التطبيق على اسمه القديم (ar.json)، والبقية <اللغة>-<النطاق>.json؛
// وقاموس نطاقٍ لم يُنشأ بعدُ فارغٌ لا خطأ (المحرّك يعمل عليه بسمات الاتجاه وحدها)
function dictFileFor(lang, domain) {
  if (domain.id === "app") return path.join(DICTS, lang.dictionary || `${lang.code}.json`);
  return path.join(DICTS, `${lang.code}-${domain.id}.json`);
}

// ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ — N5) قاموس كتل النطاق يُقرأ مرّةً واحدة: يُعدّ هنا لحجم الترجمة، ويُقطَّع بعدُ قطعًا للصفحات
const BLOCKS_CACHE = new Map();
function readBlocks(src) {
  if (!BLOCKS_CACHE.has(src)) BLOCKS_CACHE.set(src, fs.existsSync(src) ? JSON.parse(fs.readFileSync(src, "utf8")) : null);
  return BLOCKS_CACHE.get(src);
}
// ★ (ر8-د — N5) حجم الترجمة لكل موقع يُحسب وقت البناء ويُشحن في قاموسه (dicts.<لغة>.counts)، فبطاقة القاموس تعرضه ولا تعدّ شيئًا:
//   strings: نصوص الواجهة المترجَمة (الحرفية التي تخالف ترجمتُها أصلَها — «Claude Code» ← «Claude Code» إبقاءٌ لا ترجمة)،
//   plurals وpatterns: قواعد الجمع والنصوص المتغيّرة، blocks: فقرات المقالات المشحونة في قطع الصفحات (shippedBlocks أدناه)،
//   words: الكلمات العربية (كل متتاليةٍ من حروف الخط العربي) في ترجمات النصوص الحرفية والفقرات. ولا تُعدّ فيها صيغ الجمع (ستُّ صيغٍ
//   لرسالةٍ واحدة) ولا قوالب الأنماط — وهذا منهج أرقام المنسّق نفسه (ملاحظات المالك N5: نحو 1.03 مليون كلمة في المواقع السبعة)
const AR_WORD = /\p{Script=Arabic}+/gu;
function arWords(s) { return typeof s === "string" ? (s.match(AR_WORD) || []).length : 0; }
// ★ (ر8-د، المراجعة — قرار المنسّق) فقرات المقالات المشحونة وحدها: ما تشير إليه صفحات قاموس الكتل (bd.pages) فتحمله قطعها أدناه،
// كلُّ بصمةٍ مرّةً واحدة وإن تكرّرت في صفحات. ومدخلٌ في blocks لا تشير إليه صفحةٌ لا يُشحن ولا يُرى في صفحة، فلا يُعدّ (يوم ١ جمادى
// الأولى: 1,601 مدخلًا — المساعدة 431، والخصوصية 30، والوثائق 1,140). وكلماتُ الفقرات من المشحون وحده كذلك
function shippedBlocks(bd) {
  const blocks = (bd && bd.blocks) || {}, out = new Set();
  for (const fps of Object.values((bd && bd.pages) || {})) {
    for (const fp of Array.isArray(fps) ? fps : []) if (Object.prototype.hasOwnProperty.call(blocks, fp)) out.add(fp);
  }
  return out;
}
function countsOf(d, bd) {
  const c = { strings: 0, plurals: Object.keys(d.plurals || {}).length, patterns: (d.patterns || []).length, blocks: 0, words: 0 };
  for (const [en, ar] of Object.entries(d.strings || {})) if (ar !== en) { c.strings++; c.words += arWords(ar); }
  if (bd) for (const fp of shippedBlocks(bd)) { c.blocks++; c.words += arWords(bd.blocks[fp]); }
  return c;
}
// ★ (ر8-د — N6) ما يبقى بالإنجليزية بقاعدة النطاق (أسماء المنتجات والنماذج، والرموز، والتعليمات البرمجية…) يُشحن نصوصًا وحدها — بلا
// أسبابها — في قاموس كل موقعٍ له فحصٌ في المتصفح (payload.keep)، فيعدّه الفحص مغطًّى لا «غير مترجَم». المصدر ملفات keep-en.json
// المتتبَّعة وحدها (التطبيق في جذر المسرد، وغيره في مجلده): البناء في test-build لا يرى إلا المتتبَّع، فلا يُقرأ _keep-en.generated.json
// وفي بنية المستودع العام (لا مجلد مسردٍ فيها أصلًا — make-release لا ينشره) تُؤخذ القائمة من قاموس النطاق المودَع نفسه، فيبقى البناء
// هناك مطابقًا لما شُحن (بوابة الطزاجة في ci.yml)؛ أما مجلد العمل ففيه المصدر المتتبَّع دائمًا، وملفٌّ غائبٌ فيه = لا قائمة
function committedKeep(domain) {
  try {
    const g = {};
    new Function("globalThis", fs.readFileSync(path.join(EXT, domain.dict), "utf8"))(g);
    const k = g.CLAUDE_L10N && g.CLAUDE_L10N.keep;
    return Array.isArray(k) && k.every((x) => typeof x === "string") ? k.slice() : null;
  } catch { return null; }
}
function keepOf(domain) {
  const caps = C.caps(domain.id);
  if (!caps || !caps.scan.on) return null;
  if (!fs.existsSync(GLOSSARY)) {
    const k = committedKeep(domain);
    if (k) console.log(`  ℹ ${domain.id}: keep من القاموس المودَع (لا مسرد في هذه البنية)`);
    return k;
  }
  const f = domain.id === "app" ? path.join(GLOSSARY, "keep-en.json") : path.join(GLOSSARY, domain.id, "keep-en.json");
  if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const out = new Set();
  for (const e of Array.isArray(j.keep) ? j.keep : []) {
    const en = e && typeof e.en === "string" ? e.en.replace(/\s+/g, " ").trim() : "";
    // ماسح حزم التطبيق لا يجمع نصًّا فيه «@» أصلًا (engine.js doScan)، فعناوين البريد المثالية في قائمته لا عمل لها، ولا تُشحن (لا بريد في الحزمة)
    if (!en || (caps.scan.kind === "app" && en.indexOf("@") >= 0)) continue;
    out.add(en);
  }
  return [...out].sort();
}

const langs = [];
const totals = {};
const outputs = [];
for (const domain of C.DOMAINS) {
  const dicts = {};
  const dlangs = [];
  for (const lang of enabled) {
    const dictPath = dictFileFor(lang, domain);
    let d = { strings: {}, plurals: {}, patterns: [] };
    if (fs.existsSync(dictPath)) d = JSON.parse(fs.readFileSync(dictPath, "utf8"));
    else if (domain.id === "app") { console.warn(`! skip ${lang.code}: missing ${dictPath}`); continue; }
    shadowGuard(d, `${lang.code}/${domain.id}`);
    const dir = resolveDirection(lang.code, lang.direction || d._meta?.direction);
    const bd = domain.meta && domain.meta.bodies ? readBlocks(path.join(DICTS, `${lang.code}-${domain.id}.blocks.json`)) : null;
    const counts = countsOf(d, bd);
    dicts[lang.code] = {
      dir,
      strings: d.strings || {},
      plurals: d.plurals || {},
      patterns: d.patterns || [],
      counts,
    };
    dlangs.push({ code: lang.code, endonym: lang.endonym, englishName: lang.englishName, direction: dir });
    totals[domain.id] = (totals[domain.id] || 0) + Object.keys(d.strings || {}).length;
    console.log(`+ ${domain.id}/${lang.code} (${dir}): ${Object.keys(d.strings || {}).length} strings` +
      ` · ${counts.strings} translated, ${counts.blocks} blocks, ${counts.words} Arabic words`);
  }
  if (domain.id === "app") langs.push(...dlangs);
  // هوية النطاق وسماته تُحقن في قاموسه نفسه: المحرّك يعرف نطاقه من قاموسه لا من المضيف
  const payload = { domain: domain.id, meta: domain.meta, default: registry.default || dlangs[0]?.code || "ar", langs: dlangs, dicts };
  const keep = keepOf(domain);
  if (keep) { payload.keep = keep; console.log(`  ${domain.id}: keep ${keep.length}`); }

  // ★ JSON.parse بدل الكائن الحرفي (المرحلة ٢): توصية V8 الموثقة للبيانات الكبيرة.
  // الإهراب: الشرطات المائلة ثم الفواصل العليا ثم U+2028/2029 احتياطًا.
  const jsonText = JSON.stringify(payload)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
  const js =
    "/* AUTO-GENERATED by code/toolchain/build.mjs — do not edit by hand. */\n" +
    "/* مُولّد آليًّا — لا تُعدّله يدويًّا. عدّل user/dictionaries/*.json ثم أعد البناء. */\n" +
    "globalThis.CLAUDE_L10N = JSON.parse('" + jsonText + "');\n";
  fs.writeFileSync(path.join(OUTDIR, domain.dict), js, "utf8");
  outputs.push(domain.dict);
}
fs.writeFileSync(path.join(OUTDIR, "languages.json"), JSON.stringify({ default: registry.default || langs[0]?.code || "ar", languages: langs }, null, 2) + "\n", "utf8");

// ★★ (المرحلة ٢) قطع المتون: قاموس كتل النطاق (<لغة>-<نطاق>.blocks.json) ← قطعةٌ لكل صفحة باسم
// CMLShared.shardOf(مفتاح الصفحة) وفهرسٌ بها، يقرؤها العامل من الحزمة نفسها. المجلد يُمحى ويُعاد (صفحةٌ
// حُذفت لا تبقى قطعتها). البوابة: كل قالبٍ عربي يُحلَّل سليمًا وكل بصمةٍ في صفحةٍ لها قيمة (العقد التام مع
// المصدر الإنجليزي فُحص في merge-blocks على المصادر الخاصة التي لا تُنشر)
await import(pathToFileURL(path.join(EXT, "cml-shared.js")).href);
const SH = globalThis.CMLShared;
let bodyFiles = 0, bodyBytes = 0;
// الشجرة كلها تُمحى مرّةً ثم تُبنى: قطعُ لغةٍ أو نطاقٍ أُطفئ لا تبقى في الحزمة
fs.rmSync(path.join(OUTDIR, "bodies"), { recursive: true, force: true });
for (const domain of C.DOMAINS) {
  if (!domain.meta || !domain.meta.bodies) continue;
  for (const lang of langs) {
    const src = path.join(DICTS, `${lang.code}-${domain.id}.blocks.json`);
    const dir = path.join(OUTDIR, "bodies", domain.id, lang.code);
    fs.rmSync(dir, { recursive: true, force: true });
    if (!fs.existsSync(src)) {
      // ★ (S6-C) نطاقٌ بمتونٍ ولا قاموس كتلٍ له بعد (وثائق Claude Code): فهرسٌ فارغ لا غياب. كان العامل يطلب
      // bodies/<نطاق>/<لغة>/index.json فيُسجَّل في طرفيته خطأ ERR_FILE_NOT_FOUND (والسلوك نفسه: لا قطعة)
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ v: SH.BLOCK.V, shards: [], pages: 0, harvested: 0, harvestedAt: null }), "utf8");
      outputs.push(`bodies/${domain.id}/${lang.code} (0)`);
      continue;
    }
    const bd = readBlocks(src);
    if (bd._meta && bd._meta.v !== SH.BLOCK.V) { console.error(`! ${path.basename(src)}: إصدار تطبيع ${bd._meta.v} والمحرّك ${SH.BLOCK.V}`); process.exit(1); }
    const blocks = bd.blocks || {};
    const badTpl = Object.entries(blocks).filter(([fp, ar]) => !/^[0-9a-f]{16}$/.test(fp) || typeof ar !== "string" ||
      /[\u0590-\u05FF]/.test(ar) || !SH.parseTemplate(ar));
    if (badTpl.length) { console.error(`! ${path.basename(src)}: ${badTpl.length} قالبًا مختلًّا — أوّلها ${badTpl[0][0]}`); process.exit(1); }
    fs.mkdirSync(dir, { recursive: true });
    const shards = [];
    // بمفتاح الصفحة القانوني (SHARED.pageKey — «…/index» مسارُ أبيها): القطعة باسم ما يطلبه المحرّك؛ ومفتاحان صارا واحدًا يُضمّان
    const byPk = new Map();
    for (const [pk0, fps0] of Object.entries(bd.pages || {})) {
      const k = SH.pageKey(domain.meta, pk0);
      byPk.set(k, [...new Set((byPk.get(k) || []).concat(fps0))]);
    }
    // ★ (S6-C) علامات الإبقاء بنطاق الصفحة (merge-blocks: keepPages) — بصماتٌ فقط، وصفحةٌ لا ترجمة فيها إلا علاماتٌ لها قطعتها
    const keepBy = new Map();
    for (const [pk0, fps0] of Object.entries(bd.keepPages || {})) {
      const k = SH.pageKey(domain.meta, pk0);
      keepBy.set(k, [...new Set((keepBy.get(k) || []).concat(fps0))].sort());
      if (!byPk.has(k)) byPk.set(k, []);
    }
    let trShards = 0;
    for (const [pk, fps] of byPk) {
      const part = {};
      for (const fp of fps) {
        if (!Object.prototype.hasOwnProperty.call(blocks, fp)) { console.error(`! ${path.basename(src)}: صفحة ${pk} تشير إلى بصمةٍ بلا قيمة ${fp}`); process.exit(1); }
        part[fp] = blocks[fp];
      }
      const keep = (keepBy.get(pk) || []).filter((fp) => /^[0-9a-f]{16}$/.test(fp) && !Object.prototype.hasOwnProperty.call(part, fp));
      if (!fps.length && !keep.length) continue;
      if (fps.length) trShards++;
      const name = SH.shardOf(pk);
      if (shards.includes(name)) { console.error(`! تعارض قطعتين على اسمٍ واحد (${pk})`); process.exit(1); }
      shards.push(name);
      const txt = JSON.stringify(keep.length ? { page: pk, blocks: part, keep } : { page: pk, blocks: part });
      fs.writeFileSync(path.join(dir, name + ".json"), txt, "utf8");
      bodyFiles++; bodyBytes += Buffer.byteLength(txt);
    }
    shards.sort();
    // ★ التغطية تُحسب وقت البناء وتُشحن في الفهرس (قرار المالك: لا جلب لخريطة الموقع من الإضافة):
    // pages = صفحاتٌ بمتونٍ معرَّبة، harvested = الصفحات المحصودة كلها، harvestedAt = تاريخ آخر حصاد
    // (من _meta إن كتبه الدمج، وإلا من اسم أحدث ملف حصاد blocks-YYYYMMDDTHHMM.json، وإلا null)
    const harvested = Object.keys(bd.harvested || bd.pages || {}).length;
    let harvestedAt = (bd._meta && typeof bd._meta.harvestedAt === "string") ? bd._meta.harvestedAt : null;
    // ★ (ر9-أ) merge-blocks يكتب التاريخ في _meta فيسافر مع القاموس إلى المستودع العام (لا حصاد فيه)؛ واسم أحدث حصادٍ في مجلد
    // العمل احتياطٌ لقاموسٍ أقدم بلا تاريخ (domain-arg.mjs: harvestDate)
    if (!harvestedAt) harvestedAt = harvestDate(latestBlocksHarvest(domain.id));
    // pages: الصفحات المعرَّبة وحدها (قطعةٌ فيها ترجمة) — قطعةُ علاماتِ إبقاءٍ وحدها لا تُعدّ صفحةً معرَّبة في سطر التغطية
    fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ v: SH.BLOCK.V, shards, pages: trShards, harvested, harvestedAt }), "utf8");
    outputs.push(`bodies/${domain.id}/${lang.code} (${shards.length})`);
  }
}
if (bodyFiles) console.log(`قطع المتون: ${bodyFiles} ملفًا، ${(bodyBytes / 1024).toFixed(0)} ك.ب`);

console.log(`\nBuilt ${langs.length} language(s) × ${C.DOMAINS.length} domain(s) -> ${outputs.join(", ")}`);

// مداخل المانيفست من جدول النطاقات: ترتيب السكربتات إلزامي (الثوابت ثم المشترك ثم الاتجاه ثم
// التغطية للتطبيق ثم وحدة الخط ثم القاموس **قبل** المحرّك)، وأنماطها: base.css أولًا (يعلن الطبقات)، ثم
// لقطة الاتجاه إن وُجدت، ثم إصلاحات التطبيق النقطية للتطبيق وحده
const SNAPSHOT = { app: "rtl-overrides.css", support: "rtl-intercom.css", privacy: "rtl-intercom.css", docs: "rtl-docs.css", code: "rtl-code.css",
  legal: "rtl-legal.css", academy: "rtl-academy.css" };
const POINT = { app: "app-point.css", support: "intercom-point.css", privacy: "intercom-point.css", docs: "docs-point.css", code: "code-point.css",
  legal: "legal-point.css", academy: "academy-point.css" };
function contentScriptFor(domain) {
  const js = ["cml-const.js", "cml-shared.js", "cml-rtl.js"];
  if (domain.id === "app") js.push("rtl-coverage.js");
  // وحدة الخط العربي بعد الاتجاه وقبل القاموس (DESIGN-fonts §٤.٣): يُنشئها المحرّك عند document_start فتركّب محفّزاتها
  js.push("cml-font.js", domain.dict, "engine.js");
  const css = ["base.css"];
  const snap = SNAPSHOT[domain.id];
  if (snap && fs.existsSync(path.join(EXT, snap))) css.push(snap);
  // إصلاحات النطاق النقطية بعد لقطته: التطبيق، ومنصة Intercom لمركزي المساعدة والخصوصية، والوثائق، ووثائق Claude Code،
  // والوثائق القانونية (تنبيهها وغلاف الموقع LTR — ر3)، والأكاديمية (جزر المتون واللافتة والمنتقي LTR — ر4)
  const point = POINT[domain.id];
  if (point && fs.existsSync(path.join(EXT, point))) css.push(point);
  const cs = { matches: domain.matches.slice(), js, css, run_at: "document_start", all_frames: !!domain.allFrames };
  if (domain.excludeMatches && domain.excludeMatches.length) cs.exclude_matches = domain.excludeMatches.slice();
  return cs;
}
const totalAll = Object.values(totals).reduce((a, n) => a + n, 0);
// ★ (ر9-أ، ٣ جمادى الأولى ١٤٤٨هـ) عدد العبارات في version_name («قاموس 40,219 عبارةً»): الرقم مجمَّع المراتب، والمعدود بعده بصيغته
// العربية بقاعدة arCount في options.js — والعدد مضافٌ إليه بعد «قاموس»: 1 ← «عبارة واحدة»، و2 ← «عبارتين»، وآخر رقمين 3–10 (ومعها
// الصفر) ← «عبارات»، و11–99 ← «عبارةً»، وما سواهما (المئات والألوف الصحيحة وما زاد عليها واحدًا أو اثنين) ← «عبارة». والتجميع بيدٍ
// لا بـtoLocaleString، فلا يتغيّر الناتج بمكتبة ICU في Node فيبقى البناء طازجًا في كل بيئة
function phrasesAr(n) {
  const ns = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","), m = n % 100;
  if (n === 1) return "عبارة واحدة";
  if (n === 2) return "عبارتين";
  if (n === 0 || (m >= 3 && m <= 10)) return ns + " عبارات";
  if (m >= 11 && m <= 99) return ns + " عبارةً";
  return ns + " عبارة";
}

// --- الإصدار مفصول عن عدّاد القاموس (المرحلة ٠ من خطة الإطلاق) ---
// كان البناء يرفع manifest.version آليًا كلما تغيّر عدد المفردات، وقرارُ المالك تثبيتُ
// 1.0.0 حتى النشر الأول — فأُعيد الرقم يدويًا أربع مرات، وبناءٌ منسيّ واحد قبل الرفع
// كان سيشحن للمتجر رقمًا لا يمكن إنزاله. عمليةٌ يدوية تصحّح عمليةً آلية = عطل ينتظر النسيان.
// الآن: الرقم لا يُمسّ إلا بأمر صريح `--bump patch|minor|major`، وversion_name يُحدَّث
// دائمًا ليحمل عدد المفردات الصادق (فهو وصف لا هوية).
const manifestPath = path.join(EXT, "manifest.json");
if (fs.existsSync(manifestPath)) {
  const mf = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const total = totalAll;
  mf.content_scripts = C.DOMAINS.map(contentScriptFor);

  if (argSet) {
    if (mf.version !== argSet) console.log(`↑ version -> ${argSet} (--set-version)`);
    mf.version = argSet;
  } else if (bumpKind) {
    const kind = bumpKind;
    const p = String(mf.version || "1.0.0").split(".").map((x) => parseInt(x, 10) || 0);
    while (p.length < 3) p.push(0);
    if (kind === "major") { p[0]++; p[1] = 0; p[2] = 0; }
    else if (kind === "minor") { p[1]++; p[2] = 0; }
    else p[2]++;
    mf.version = p.join(".");
    console.log(`↑ version -> ${mf.version} (--bump ${kind})`);
  }

  const newName = `${mf.version} — قاموس ${phrasesAr(total)}`;
  if (mf.version_name !== newName) {
    mf.version_name = newName;
    console.log(`  version_name -> ${newName}`);
  } else {
    console.log(`= version ${mf.version} (${total} strings)`);
  }
  fs.writeFileSync(path.join(OUTDIR, "manifest.json"), JSON.stringify(mf, null, 2) + "\n", "utf8");
}
