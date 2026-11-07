// domain-arg.mjs — ‎--domain=<id>‎ واحدٌ لأدوات السلسلة (١-٠د): قاموس النطاق ومجلد عمله يُشتقّان
// من جدول النطاقات نفسه (cml-const.js) فلا تنحرف أداةٌ عن أخرى ولا عن build.mjs.
// بلا الوسيط = التطبيق (سلوك الأدوات في 1.0.0 كما هو).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DICTS, GLOSSARY, EXT } from "./paths.mjs";

await import(pathToFileURL(path.join(EXT, "cml-const.js")).href);
await import(pathToFileURL(path.join(EXT, "cml-shared.js")).href);
export const C = globalThis.CMLConst;
export const SHARED = globalThis.CMLShared;
export const DOMAIN_IDS = C.DOMAINS.map((d) => d.id);

// allowAll: الأداة تقبل «all» فتمشي على النطاقات كلها (البوابات)
export function domainArg(argv = process.argv, { allowAll = false, fallback = "app" } = {}) {
  const a = argv.find((x) => x.startsWith("--domain="));
  const v = a ? a.slice(9) : fallback;
  if (allowAll && v === "all") return "all";
  if (!C.domain(v)) {
    console.error(`! نطاقٌ مجهول: ${v} — المعروف: ${DOMAIN_IDS.join("، ")}${allowAll ? "، all" : ""}`);
    process.exit(2);
  }
  return v;
}
export function domainsOf(sel) { return sel === "all" ? DOMAIN_IDS.slice() : [sel]; }
// ★ (ر20-ج، ١٢ جمادى الأولى ١٤٤٨هـ — ما حملته ر20-أ) أهداف أدوات القواميس (lint-dict وcross-check-patterns): كل نطاقٍ، وبعده أصناف مساره بقواميسها
// (‎<لغة>-<الصنف>.json‎ كما يبنيها build.mjs: لوحة المطوّرين ar-console.json في مدخل الوثائق). والصنف يُذكر باسمه ونطاقه («docs/console»)
export function dictTargets(sel, lang = "ar") {
  const out = [];
  for (const d of domainsOf(sel)) {
    out.push({ id: d, domain: d, file: dictFile(d, lang), label: label(d), upcoming: C.upcoming(d), cls: null });
    for (const c of (typeof C.routeClasses === "function" ? C.routeClasses(d) : []))
      out.push({ id: d + "/" + c.id, domain: d, file: path.join(DICTS, `${lang}-${c.id}.json`), label: `${c.name} (${d}/${c.id})`,
                 upcoming: C.classUpcoming(c), cls: c });
  }
  return out;
}
// ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) قاموسٌ مبنيّ (CLAUDE_L10N) لا يعرّب شيئًا بلغته الافتراضية: لا نصوص ولا أنماط ولا جموع ولا فقرات مشحونة
// (counts.blocks من البناء). نطاقٌ مشحون (لا status.upcoming) بقاموسٍ كهذا يقلب صفحاته الإنجليزية بلا تعريب — فبوابة الحزمة (verify-package)
// ترفضه، والنطاق يبقى قادمًا حتى يُشحن قاموسه (claude.com حتى CM-د)
export function translatesNothing(payload) {
  const d = payload && payload.dicts ? payload.dicts[payload.default] || {} : {};
  return !Object.keys(d.strings || {}).length && !(d.patterns || []).length && !Object.keys(d.plurals || {}).length && !(d.counts && d.counts.blocks > 0);
}

// ★ (ر24-و، ١٢ جمادى الأولى ١٤٤٨هـ — PLAN §٧ الخطر 3، من ر20-ب) ما لا يحمله الإصدار النهائي: نطاقٌ قادم (status.upcoming) له مطابقةٌ في المانيفست
// (مضيفٌ يُعلَن في نافذة الأذونات ولا تعمل الإضافة فيه شيئًا)، وصنفُ مسارٍ قادم حُقن قاموسه. وهو صوابٌ في التطوير والنسخ التجريبية (المطابقة تُعلَن مع
// القاموس في التحديث نفسه)، وخطأٌ في إصدارٍ يُنشر: يُشحن النطاق بقاموسه، أو يُحجب صفّه ومطابقته معًا. دالّةٌ خالصة: المانيفست والجدول يُمرَّران،
// والحكم بالاسم — النطاق القادم مذكورٌ إن ظهر أيُّ نمطٍ من مطابقاته في أي مدخل (لا المدخل المطابق حرفًا وحده)
export function inertInRelease(mf, C) {
  const out = [], entries = (mf && mf.content_scripts) || [];
  for (const d of C.DOMAINS) {
    if (C.upcoming(d.id)) {
      const hit = entries.filter((cs) => (cs.matches || []).some((m) => (d.matches || []).includes(m)));
      if (hit.length) out.push({ id: d.id, kind: "domain", matches: [...new Set(hit.flatMap((cs) => cs.matches.filter((m) => d.matches.includes(m))))] });
    }
    for (const cls of C.routeClasses(d.id)) {
      if (C.classUpcoming(cls) && entries.some((cs) => (cs.js || []).includes(cls.dict))) out.push({ id: d.id + "/" + cls.id, kind: "class", dict: cls.dict });
    }
  }
  return out;
}

// قاموس النطاق: التطبيق على اسمه القديم (ar.json)، والبقية <اللغة>-<النطاق>.json (كما في build.mjs)
export const dictFile = (d, lang = "ar") => path.join(DICTS, d === "app" ? `${lang}.json` : `${lang}-${d}.json`);
// مجلد عمل النطاق (الحصاد والدفعات والمراجعات): التطبيق في جذر glossary كما كان، والبقية في glossary/<id>
export const workDir = (d) => (d === "app" ? GLOSSARY : path.join(GLOSSARY, d));
export const batchDir = (d) => path.join(workDir(d), "_ar_batches");
export const label = (d) => `${C.domain(d).name} (${d})`;
// ★ (المرحلة ٢) قاموس كتل النطاق: بصماتٌ وعربيةٌ وخريطة صفحات — بلا نصٍّ إنجليزي (المفتاح بصمة)
export const blocksDictFile = (d, lang = "ar") => path.join(DICTS, `${lang}-${d}.blocks.json`);
// دفعات الكتل المترجمة ([{fp, src, ar}]) — خاصةٌ لا تُنشر (.gitignore)
export const blockBatchDir = (d) => path.join(workDir(d), "_blk_batches");
// أحدث حصاد كتل (harvest-dom --blocks)
export function latestBlocksHarvest(d) {
  const dir = path.join(workDir(d), "_harvest");
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).filter((n) => /^blocks-.*\.json$/.test(n)).sort().pop();
  return f ? path.join(dir, f) : null;
}
// ★ (ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ) حصادات النطاق كلها بترتيب زمنها — ترتيبُ merge-blocks نفسه: اسم الملف طابعُ وقته (blocks-YYYYMMDDTHHMM.json،
// وharvest-…)، والأحدث يغلب في الصفحة الواحدة. حصاد الأكاديمية في ر13-ب ثماني دفعاتٍ وملحق (كلٌّ لصفحاتٍ غير صفحات الأخرى)، فكان «الأحدث وحده»
// يقيس 60 صفحةً من 741 (بوابة الشمول وacademy-prep)
function harvestsOf(d, re) {
  const dir = path.join(workDir(d), "_harvest");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => re.test(n)).sort().map((n) => path.join(dir, n));
}
export const blocksHarvests = (d) => harvestsOf(d, /^blocks-.*\.json$/);
export const domHarvests = (d) => harvestsOf(d, /^harvest-.*\.json$/);
// ★ (ر13-ج) حصاداتُ DOM مضمومةً بقاعدة merge-blocks: لكل صفحةٍ أحدثُ حصادٍ لها، ومفتاحٌ من حصادٍ يبقى إن كان ذلك الحصاد أحدثَ حصادٍ لصفحةٍ
// من صفحاته المسجَّلة (حتى ثلاثٍ لكل مفتاح، harvest-dom)، أو لم تُسجَّل له صفحة. فما أُعيد حصاد صفحاته كلها ولم يُرَ فيها لا يبقى، ونصوص
// صفحةٍ لم يُعَد حصادها تبقى من حصادها الأقدم. files مرتّبةٌ زمنًا؛ والناتج بصيغة حصادٍ واحد {domain, at, pages, keys, files}
export function mergeDomHarvests(files) {
  const hs = files.map((f) => ({ f, h: JSON.parse(fs.readFileSync(f, "utf8")) }));
  const newest = new Map();   // عنوانٌ ← رقم أحدث حصادٍ له
  hs.forEach(({ h }, i) => { for (const p of h.pages || []) { newest.set(p.url, i); if (p.final) newest.set(p.final, i); } });
  const pages = new Map(), keys = new Map();
  hs.forEach(({ h }, i) => {
    for (const p of h.pages || []) if (newest.get(p.url) === i) pages.set(p.url, p);
    for (const r of h.keys || []) {
      const ps = r.pages || [];
      if (ps.length && !ps.some((u) => newest.get(u) === i || !newest.has(u))) continue;
      const k = keys.get(r.key);
      if (!k) { keys.set(r.key, { ...r, kinds: [...(r.kinds || [])], pages: [...ps] }); continue; }
      for (const x of r.kinds || []) if (!k.kinds.includes(x)) k.kinds.push(x);
      k.count = (k.count || 0) + (r.count || 0);
      for (const u of ps) if (k.pages.length < 3 && !k.pages.includes(u)) k.pages.push(u);
      // المنطقة: الأحدث يغلب، وما رُئي في الموضعين «both»
      if (k.zone !== r.zone) k.zone = (k.zone === "both" || r.zone === "both" || (k.zone && r.zone)) ? "both" : (r.zone || k.zone);
      if (r.translated === false) k.translated = false;
    }
  });
  const last = hs.length ? hs[hs.length - 1].h : {};
  return { domain: last.domain, at: last.at, pages: [...pages.values()], keys: [...keys.values()], files: files.map((f) => path.basename(f)) };
}
// ★ (ر9-أ، ٣ جمادى الأولى ١٤٤٨هـ) تاريخ حصاد الكتل (YYYY-MM-DD): من اسم ملفه blocks-YYYYMMDDTHHMM.json (طابع harvest-dom بتوقيت UTC)،
// وإلا من حقل at في محتواه إن مُرِّر (ملفٌّ بـ--harvest باسمٍ آخر)، وإلا null. تقرؤه merge-blocks فتكتبه في _meta قاموس الكتل،
// ويقرؤه build.mjs احتياطًا لقاموسٍ أقدم بلا تاريخ
export function harvestDate(file, hv) {
  const m = /blocks-(\d{4})(\d{2})(\d{2})T/.exec(path.basename(file || ""));
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const at = hv && typeof hv.at === "string" ? hv.at.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : null;
}

// ★ (ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ) ما زاد في حصاد DOM لحالٍ جديدة (now) على حصادٍ سابق (base) من بنودٍ يبدأ نوعها بـprefix ("attr:")، بعددها:
// سمةٌ (alt وaria-label وtitle وplaceholder) لا تظهر إلا بعد نقرة (لوحة تبويب، محتوى مطويّ) — وكان حصاد الواجهة يأخذ السمات من الحال الأولى
// وحدها فتفوته (فحص ر13-ب: 23 قيمةً في المقالة خلف تبويبٍ أو محتوى مطويّ). البند {key, kind} كما يُرجعه CMLShared.harvestDom؛ والناتج ما يُضاف إلى base
export function extraItems(base, now, prefix = "attr:") {
  const have = new Map();
  for (const h of base || []) if (h && String(h.kind).indexOf(prefix) === 0) { const k = h.key + "\u0000" + h.kind; have.set(k, (have.get(k) || 0) + 1); }
  const out = [];
  for (const h of now || []) {
    if (!h || String(h.kind).indexOf(prefix) !== 0) continue;
    const k = h.key + "\u0000" + h.kind, n = have.get(k) || 0;
    if (n > 0) have.set(k, n - 1); else out.push({ key: h.key, kind: h.kind });
  }
  return out;
}
// ★ (ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ) صفُّ لافتاتٍ من قالب الكتلة وحده — حكمُ ex.group في CMLShared.extractBlock نفسه منقولًا إلى القالب: عنصران أو أكثر
// في المستوى الأعلى، ولا نصَّ بينها ولا بياض (وإلا فهو جملةٌ موزّعة على وسوم)، ولا بياضَ في طرفَي نصّ بند. يُرجع نصوص البنود: نصُّ البند ذي العقدة
// الواحدة، وfalse لبندٍ بعقدٍ عدّة فيها حروف (يحتاج ترجمةً ولا يُعرَّب وحده)، وnull لذرّةٍ أو بندٍ بلا حروف — أو null إن لم يكن صفًّا. صفوف العدّاد
// الزمني في أفلام الأكاديمية («<g1/><s2>Reading …</s2><s3>31s</s3>») كذلك: المحرّك يعرّبها بندًا بندًا بقاموس الواجهة، فبوابة الشمول تقيسها كذلك
export function labelRow(tpl) {
  const re = /<c(\d+)>[\s\S]*?<\/c\1>|<([cg])(\d+)\/>|<([a-z])(\d+)>|<\/([a-z])(\d+)>/g;
  const s = String(tpl || "");
  const items = [], iraw = [];
  let depth = 0, last = 0, m, free = false, wsGap = false, loose = false;
  const text = (t) => {
    if (!t) return;
    if (depth === 0) { if (/\S/.test(t)) free = true; else if (items.length) wsGap = true; return; }
    iraw[iraw.length - 1] += t;
    if (/\S/.test(t)) items[items.length - 1].push(t.replace(/\s+/g, " ").trim());
  };
  const top = () => { if (wsGap) loose = true; wsGap = false; items.push([]); iraw.push(""); };
  while ((m = re.exec(s))) {
    text(s.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] !== undefined || m[2] !== undefined) { if (depth === 0) top(); continue; }   // ذرّة: بندٌ بلا نصّ في المستوى الأعلى، ولا شيء داخله
    if (m[4] !== undefined) { if (depth === 0) top(); depth++; continue; }
    depth = Math.max(0, depth - 1);
  }
  text(s.slice(last));
  if (free || loose || items.length < 2 || iraw.some((t) => /^\s|\s$/.test(t))) return null;
  return items.map((it) => (it.length === 1 ? it[0] : it.some((t) => /[A-Za-z]/.test(t)) ? false : null));
}
// أحدث حصاد DOM للنطاق (harvest-dom.mjs) — مدوّنتُه للأدوات التي تقيس على «نصوص الموقع»
export function latestHarvest(d) {
  const dir = path.join(workDir(d), "_harvest");
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).filter((n) => /^harvest-.*\.json$/.test(n)).sort().pop();
  return f ? path.join(dir, f) : null;
}
export function harvestKeys(d) {
  const f = latestHarvest(d);
  if (!f) return null;
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  return { file: f, keys: (j.keys || []).map((r) => r.key) };
}
