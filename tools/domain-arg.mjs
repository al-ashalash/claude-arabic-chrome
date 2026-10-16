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
// ★ (ر9-أ، ٣ جمادى الأولى ١٤٤٨هـ) تاريخ حصاد الكتل (YYYY-MM-DD): من اسم ملفه blocks-YYYYMMDDTHHMM.json (طابع harvest-dom بتوقيت UTC)،
// وإلا من حقل at في محتواه إن مُرِّر (ملفٌّ بـ--harvest باسمٍ آخر)، وإلا null. تقرؤه merge-blocks فتكتبه في _meta قاموس الكتل،
// ويقرؤه build.mjs احتياطًا لقاموسٍ أقدم بلا تاريخ
export function harvestDate(file, hv) {
  const m = /blocks-(\d{4})(\d{2})(\d{2})T/.exec(path.basename(file || ""));
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const at = hv && typeof hv.at === "string" ? hv.at.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : null;
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
