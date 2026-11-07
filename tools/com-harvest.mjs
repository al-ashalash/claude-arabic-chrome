// com-harvest.mjs — ★ (ر17، ٨ جمادى الأولى ١٤٤٨هـ) أدوات حصاد claude.com لمرحلتي ر19 (ر19-أ غير السوق، ور19-ب السوق) ومراحل الترجمة CM1…CMn.
//
// لماذا: claude.com أكبر المواقع (1,666 صفحةً كاملة: 338 خارج السوق و1,328 فيه — دراسة ر14 §٢ب)، والشركة تُبقي داخل ما تترجمه كتلًا إنجليزية
// (أسماء الموصِّلات وأدواتها، وبطاقاتٌ تربط بمحتوى إنجليزي، وأوصاف شركاء — 4.7٪ من كلمات الصفحات و17٪ من السوق، §٢د). وقاعدة النطاق (RULES §1):
// ما تترجمه الشركة نترجمه، وما تُبقيه إنجليزيًّا يبقى. فالأداة لا تترجم شيئًا؛ تُعدّ ما يلزم الأنبوب القائم (harvest-dom ‎--blocks‎ ثم
// stage-code-bodies.cloud.js بـdomain=com وvalidate-batch ‎--mode=block‎) بصيغ الأكاديمية نفسها (ر13-ب):
//
//   list      قائمة الحصاد: المسارات الكاملة (routes.exact المولَّدة، وكل صفحةٍ إنجليزية في الخريطة تحت routes.full «/marketplace/») بعائلة
//             قالبها وبترتيب CM، ومعها عيّنةٌ من صفحات الهيكل (صفحةٌ لكل بادئة في routes.shell) لواجهتها وحدها. مساراتٌ وعائلاتٌ فقط.
//             بوابةٌ ترفض الهبوط المفاجئ (DROP_MAX كـcom-routes) أمام القائمة السابقة وأعداد كتلة com-routes، و‎--accept-drop‎ قرار المنسِّق.
//   classify  مصنِّف «ما تبقيه الشركة»: بصمات كتل المتن (تطبيع harvest-dom ‎--blocks‎ نفسه: CMLShared.harvestBlocks، bodySel «main») في HTML
//             الخادم للصفحة الإنجليزية ونسختين مترجمتين منها، بلا متصفح يحمّل الموقع (المحلِّل وحده في كروم على about:blank). الكتلة مترجمةٌ إن
//             ترجمتها إحدى النسختين؛ وتُبقى إن بقيت ببصمتها في موضعها (محاذاة التسلسل LCS، لا مجرّد وجودها في الصفحة) في النسختين كلتيهما
//             وفي كل صفحةٍ قورنت فيها. والسمات (aria-label وtitle وplaceholder وalt) قيمةً قيمة بالعدد. وبادئات اللغات من hreflang الرئيسة وقت
//             التشغيل؛ والسوق بلا hreflang فتُبنى ‎/<locale>/marketplace/…‎ وتُقبل النسخة بـ200 و<html lang> المطابق. والنسخ المترجمة في الذاكرة
//             وحدها: لا يُحفظ منها إلا نعم/لا لكل بصمةٍ وقيمة، والأعداد. ولا يُكتب رمز لغةٍ في ملفٍّ ولا سجلّ: تُذكر بترتيبها (#1…).
//             ‎--browser-check‎: والمقارنة نفسها على الصفحات معروضةً في كروم (سياقٌ جديد لكل تحميل: الزائر العائد يُحوَّل إلى claude.ai)
//             فتُقاس موافقة المصنِّف وتُشرح كل مخالفة.
//   ui        مدخلات CM1 (قاموس الواجهة) بصيغة مراحل الواجهة: الترويسة والتذييل، وسمات المتن خارج السوق (الأرقام والعناوين متغيّرات)،
//             والكتل المتكرّرة في 20 صفحةً فأكثر، وعناوين التبويب خارج السوق (يبقى ذيل titleKeep)، وأنماط السوق، ومرجعٌ من القواميس المشحونة.
//             وما تبقيه الشركة إنجليزيًّا يُستبعد ويُعدّ (ويُكتب في ‎_keep-en.generated.json‎ فتعدّه بوابة الشمول).
//   chunk     أجزاء المتون بصيغة الأكاديمية: p4/<id>.json وp4-manifest.json وp4-shared.json وp4ctx/ وstages.json (أربعة أجزاءٍ للمرحلة
//             بحدّ الساعتين بمعدّل الأكاديمية المقيس) وkept-as-is.json وBRIEF.md هيكلًا. كتل الصفحة متجاورة، وبطاقات «ذات صلة» في جزءٍ واحد.
//
//   NODE_USE_ENV_PROXY=1 node web/code/toolchain/com-harvest.mjs list [--out=<مجلد>] [--prev=<list.json>] [--accept-drop] [--sample=N]
//   CI=true NODE_USE_ENV_PROXY=1 node web/code/toolchain/com-harvest.mjs classify --list=<list.json> [--blocks=<blocks-*.json>,…]
//        [--out=<مجلد>] [--pick=1,2] [--concurrency=2] [--accept-errors] [--browser-check]
//   node web/code/toolchain/com-harvest.mjs ui    --list=… --classified=<classified.json> [--harvest=<harvest-*.json>,…] [--blocks=…] [--out=<مجلد>]
//   node web/code/toolchain/com-harvest.mjs chunk --list=… --classified=… [--blocks=…] [--out=<مجلد>] [--words=5500]
// بلا ‎--blocks/--harvest‎: حصادات مجلد عمل النطاق كلها (domain-arg: blocksHarvests/domHarvests، الأحدث يغلب في الصفحة). وبلا ‎--out‎: مجلد عمل
// النطاق (web/code/glossary/com: ‎_harvest/‎ و‎_blk_todo/‎ و‎_ar_todo/‎ — خارج git، ومكانها مستودع البيانات). والطباعة أعدادٌ لا نصوص.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EXT, DICTS } from "./paths.mjs";
import { C, SHARED, workDir, blocksHarvests, domHarvests, mergeDomHarvests } from "./domain-arg.mjs";
import { SITE, DROP_MAX, ERR_MAX, normPath, parseSitemap, alternatesOf, prefixesOf, underFull } from "./com-routes.mjs";

const D = "com";
export const REPEAT_MIN = 20;       // كتلةٌ في 20 صفحةً مترجمةً فأكثر: واجهةٌ (CM1) لا متن (دراسة ر14 §٢و)
export const RELATED_MIN = 2;       // كتلةٌ في صفحتين من السوق فأكثر: بطاقة «ذات صلة» — جزءٌ واحد (§٥ البند 5)
export const PART_WORDS = 5500;     // حجم الجزء: أجزاء الأكاديمية 4.5–6 آلاف كلمة، وأربعةٌ منها بالتوازي 1.1–1.3 ساعة (stages-replan، AC1–AC2)
export const STAGE_PARTS = 4;       // أربعة أجزاءٍ للمرحلة (عرض 4 في stage-code-bodies) فتبقى دون الساعتين
export const PATTERN_MIN = 3;       // قالب سمةٍ أو نصٍّ في السوق يُعدّ نمطًا إن رُئي بقيمٍ مختلفة في ثلاث صفحاتٍ فأكثر

// ── العائلات وترتيب CM (دراسة ر14 §٢ج و§٧ج: الرئيسة والمفردات والمنتج والحلول والشركاء والفهارس ← السوق ← المقالات ← القصص) ──────────
export const FAMILIES = ["home", "singles", "product", "solutions", "partners", "forms", "indexes",
  "mkt-index", "mkt-connector", "mkt-plugin", "mkt-agent", "mkt-other", "articles", "customers", "shell"];
export function groupOf(f) { return /^mkt-/.test(f) ? "marketplace" : f === "articles" ? "articles" : f === "customers" ? "customers" : f === "shell" ? "shell" : "main"; }
export function familyOf(p) {
  p = normPath(p);
  if (p === "/") return "home";
  const m = /^\/marketplace(?:\/([^/]+)(?:\/(.+))?)?$/.exec(p);
  if (m) return !m[1] || !m[2] ? "mkt-index" : ({ connectors: "mkt-connector", plugins: "mkt-plugin", "agents-products": "mkt-agent" })[m[1]] || "mkt-other";
  if (/^\/product(\/|$)/.test(p)) return "product";
  if (/^\/solutions(\/|$)/.test(p)) return "solutions";
  if (/^\/(partners|programs|community)(\/|$)/.test(p)) return "partners";
  if (/^\/(contact-sales|form)(\/|$)/.test(p)) return "forms";
  if (p === "/customers" || /^\/resources(\/[^/]+)?$/.test(p)) return "indexes";
  if (/^\/resources\/[^/]+\/.+/.test(p)) return "articles";
  if (/^\/customers\/.+/.test(p)) return "customers";
  return "singles";
}
const rankOf = (f) => { const i = FAMILIES.indexOf(f); return i < 0 ? FAMILIES.length : i; };
export function cmSort(items) { return items.slice().sort((a, b) => rankOf(a.family) - rankOf(b.family) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)); }

// القائمة: exact (COM_EXACT) + الإنجليزية تحت routes.full + عيّنة هيكلٍ لكل بادئة shell. english: مسارات الخريطة الإنجليزية (بلا بادئات اللغات)
export function buildList({ exact = [], english = [], full = [], shell = [] }) {
  const ex = new Set(exact.map(normPath)), seen = new Set(), items = [];
  const add = (p, mode, src) => { p = normPath(p); if (seen.has(p)) return; seen.add(p); items.push({ path: p, family: mode === "shell" ? "shell" : familyOf(p), mode, src }); };
  for (const p of ex) add(p, "full", "exact");
  const eng = [...new Set(english.map(normPath))].sort();
  for (const p of eng) if (underFull(p, full)) add(p, "full", "sitemap");
  // عيّنة الهيكل: أول مسارٍ إنجليزي تحت كل بادئة ليس كاملًا (المتن يبقى أصله، والترويسة والتذييل واجهة الصفحات الكاملة نفسها، وبوابة الشمول
  // تشترط صفحة هيكلٍ محصودةً واحدة على الأقل)
  for (const s of shell) { const p = eng.find((x) => (x + "/").startsWith(s) && !ex.has(x) && !underFull(x, full)); if (p) add(p, "shell", "shell-sample"); }
  const sorted = cmSort(items);
  return { items: sorted, counts: countList(sorted) };
}
export function countList(items) {
  const byFamily = {};
  for (const it of items) byFamily[it.family] = (byFamily[it.family] || 0) + 1;
  const full = items.filter((x) => x.mode === "full");
  return { total: items.length, full: full.length, exact: items.filter((x) => x.src === "exact").length,
    marketplace: full.filter((x) => groupOf(x.family) === "marketplace").length, shell: items.length - full.length, byFamily };
}
// البوابة: القائمة الفارغة، وهبوط الكامل أو السوق أمام القائمة السابقة فوق DROP_MAX (إلا بقرار)، وقائمةٌ لا تحمل كتلة com-routes بعددها (لا يُقبل بقرار:
// الكتلة مولَّدة ويفحصها البناء)، وهبوط صفحات الخريطة الإنجليزية تحت routes.full
// ★ (مراجعة ر17) وفي أول تشغيلٍ لا قائمة سابقة: فتُقاس الخريطة التي قرأتها الأداة (sitemap: عناوينها، english: صفحاتها الإنجليزية) بما قرأه
// com-routes حين ولّد الكتلة (COM_EXACT_META.sitemap وenglish)، فلا تمرّ خريطةٌ مبتورة (فرعٌ من فروعها لم يُقرأ) بلا قرار
export function listGate(prev, next, { exactMeta = null, acceptDrop = false, facts = null } = {}) {
  const why = [];
  for (const [k, lab] of [["sitemap", "عناوين الخريطة"], ["english", "صفحات الخريطة الإنجليزية"]]) {
    if (facts && exactMeta && exactMeta[k] && facts[k] < exactMeta[k] * (1 - DROP_MAX) && !acceptDrop)
      why.push(`${lab} ${facts[k]} وكانت ${exactMeta[k]} حين وُلّدت كتلة com-routes (أكثر من ${Math.round(DROP_MAX * 100)}٪) — راجع الموقع، أو مرّر --accept-drop بقرار`);
  }
  const n = next && next.counts ? next.counts : countList((next && next.items) || []);
  const p = prev && prev.counts ? prev.counts : null;
  if (!n.full) why.push("القائمة الكاملة فارغة");
  if (exactMeta && n.exact !== exactMeta.exact) why.push(`مسارات exact في القائمة ${n.exact} وكتلة com-routes ${exactMeta.exact} — أعد توليدها (com-routes.mjs) ثم البناء`);
  for (const [k, lab] of [["full", "الصفحات الكاملة"], ["marketplace", "صفحات السوق"]]) {
    if (p && p[k] && n[k] < p[k] * (1 - DROP_MAX) && !acceptDrop)
      why.push(`هبط عدد ${lab} من ${p[k]} إلى ${n[k]} (أكثر من ${Math.round(DROP_MAX * 100)}٪) — راجع الموقع، أو مرّر --accept-drop بقرار`);
  }
  return { ok: !why.length, why };
}
// عيّنةٌ حتمية: لكل عائلةٍ N (بترتيب بصمة المسار، لا الأبجدية) — وللسوق ما في mkt
export function sampleList(items, { per = 2, mkt = { "mkt-index": 2, "mkt-connector": 6, "mkt-plugin": 2, "mkt-agent": 2 } } = {}) {
  const by = new Map();
  for (const it of items) { if (!by.has(it.family)) by.set(it.family, []); by.get(it.family).push(it); }
  const out = [];
  for (const [f, arr] of by) {
    const k = f === "shell" ? arr.length : mkt[f] !== undefined ? mkt[f] : per;
    out.push(...arr.slice().sort((a, b) => (SHARED.fp64("s\n" + a.path) < SHARED.fp64("s\n" + b.path) ? -1 : 1)).slice(0, k));
  }
  return cmSort(out);
}

// ── المصنِّف (خالص) ──────────────────────────────────────────────────────────────────────────────────────────
// محاذاة تسلسلين بأطول تتابعٍ مشترك: مواضع a التي طابقت عنصرًا من b بالترتيب
export function lcsMatched(a, b) {
  const n = a.length, m = b.length, W = m + 1;
  const dp = new Uint32Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i * W + j] = a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
  const hit = new Uint8Array(n);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) { hit[i] = 1; i++; j++; }
    else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
    else j++;
  }
  return hit;
}
const countOf = (arr) => { const m = new Map(); for (const x of arr) m.set(x, (m.get(x) || 0) + 1); return m; };
// صفحةٌ واحدة: en تسلسل بصمات المتن الإنجليزي (بتكراره)، وvers تسلسلات النسخ المترجمة المقبولة (0–2). لكل بصمةٍ في en: kept إن طابقت كلُّ
// مواضعها بالمحاذاة في كل نسخة، وإلا translated؛ وبلا نسخة unverified. وambiguous: باقيةٌ بالعدّ (مجموعة) لا بالموضع — خطر الكتلة القصيرة
export function classifyPage(en, vers) {
  const out = new Map(), amb = new Set(), split = new Set();
  if (!vers.length) { for (const fp of en) out.set(fp, "unverified"); return { verdict: out, ambiguous: amb, split }; }
  const keptBy = vers.map((t) => { const hit = lcsMatched(en, t), bad = new Set(); en.forEach((fp, i) => { if (!hit[i]) bad.add(fp); }); return bad; });
  const cE = countOf(en), cT = vers.map(countOf);
  for (const fp of new Set(en)) {
    const kept = keptBy.every((bad) => !bad.has(fp));
    out.set(fp, kept ? "kept" : "translated");
    if (!kept && cT.every((c) => (c.get(fp) || 0) >= cE.get(fp))) amb.add(fp);
    // قاعدة «إحدى النسختين» في عملها: باقيةٌ في نسخةٍ ومترجمةٌ في الأخرى (الوصف الطويل لموصِّلٍ تُبقيه إحدى البادئات — دراسة ر14 §٥)
    if (!kept && keptBy.some((bad) => !bad.has(fp))) split.add(fp);
  }
  return { verdict: out, ambiguous: amb, split };
}
// عبر الصفحات: مترجمةٌ إن ترجمتها صفحةٌ واحدة (أو نسخةٌ واحدة فيها)، ومُبقاةٌ إن بقيت في كل صفحةٍ قورنت فيها، وغير متحقَّقة إن لم تُقارن قطّ
export function combineVerdicts(perPage) {
  const out = new Map();
  for (const v of perPage) for (const [fp, x] of v) {
    const o = out.get(fp);
    if (x === "translated" || o === "translated") out.set(fp, "translated");
    else if (x === "kept" || o === "kept") out.set(fp, "kept");
    else out.set(fp, "unverified");
  }
  return out;
}
// السمات والنصوص خارج المتن: قيمةً قيمة بالعدد (لا تسلسل موضعيًّا لها): مُبقاةٌ إن كان عددها في كل نسخةٍ ≥ عددها في الإنجليزية
export function classifyItems(en, vers) {
  const key = (x) => x.zone + "\u0000" + x.kind + "\u0000" + x.key;
  const cE = countOf(en.map(key)), cT = vers.map((v) => countOf(v.map(key)));
  const out = new Map();
  for (const [k, n] of cE) out.set(k, !vers.length ? "unverified" : cT.every((c) => (c.get(k) || 0) >= n) ? "kept" : "translated");
  return out;
}
// اختيار النسختين: البادئات المتاحة للصفحة مرتّبةً بترتيبها العام (عدد صفحاتها في الخريطة)، ويُقدَّم ما في pick (رتبٌ 1…)، والباقي احتياطٌ إن رُفضت نسخة
export function versionOrder(available, ranked, pick = [1, 2]) {
  const av = ranked.filter((p) => available.has(p));
  const first = pick.map((r) => ranked[r - 1]).filter((p) => p && available.has(p));
  return [...new Set([...first, ...av])];
}
// ★ (مراجعة ر17) قبول النسخة المترجمة: 200 و<html lang> المطابق للبادئة وفيها المتن — دالةٌ خالصة تختبرها الفحوص الذاتية
export function acceptVersion(status, v, prefix) { return status === 200 && !!v && langMatches(v.lang, prefix) && !!v.main; }
// ★ (ر18، ٨ جمادى الأولى ١٤٤٨هـ — مراجعة ر17، ملاحظة) نسخةٌ تُخدم غير مترجمة بلغةٍ مطابقة (<html lang> صحيح والمتن إنجليزي) كانت تُقبل، فتصير كل
// كتلةٍ فيها «باقية» — وبنسختين كذلك يُحكم على متن الصفحة كلّه أن الشركة تبقيه. فالنسخة التي فيها من بصمات متن الصفحة الإنجليزية (في HTML الخادم)
// UNTRANSLATED_MIN فأكثر، والمتن خمس كتلٍ فأكثر، غير مترجمةٍ: تُترك كأنها لم تُقبل فتُجرَّب التالية، وتُعدّ. ولم تُرَ في 74 نسخة (ر17)، والمترجمة
// حقًّا تبقي من كتل السوق نحو 17٪ من الكلمات (دراسة ر14 §٢د)، فالحدّ بعيدٌ عنها
export const UNTRANSLATED_MIN = 0.95;
export function untranslatedVersion(enSeq, verSeq, { min = UNTRANSLATED_MIN, minBlocks = 5 } = {}) {
  const en = [...new Set(enSeq || [])];
  if (en.length < minBlocks) return false;
  const vs = new Set(verSeq || []);
  return en.filter((fp) => vs.has(fp)).length / en.length >= min;
}
// حكم النسخة المجلوبة في سطرٍ واحد من حلقة الجلب: "rejected" (acceptVersion)، أو "untranslated"، أو "ok"
export function versionVerdict(status, v, prefix, enSeq) {
  if (!acceptVersion(status, v, prefix)) return "rejected";
  return untranslatedVersion(enSeq, v.seq) ? "untranslated" : "ok";
}
// ما يُعاد جلبه بانتظار: 429 و5xx وحدها (404 و3xx جوابٌ نهائي)
export const retryable = (status) => status === 429 || status >= 500;
// حكم صفحةٍ على بصمات حصادها: ما لا يحمله HTML الخادم الإنجليزي (يركّبه العميل) غير متحقَّق، فيُرسل للترجمة ما لم تُحكم في صفحةٍ أخرى
export function pageVerdicts(harvestFps, verdict) { const v2 = new Map(); for (const fp of harvestFps) v2.set(fp, verdict.has(fp) ? verdict.get(fp) : "unverified"); return v2; }
// <html lang> يطابق البادئة: الرمز نفسه أو لغته الأولى (بلا حساسية حروف)
export function langMatches(lang, prefix) {
  const a = String(lang || "").toLowerCase(), b = String(prefix || "").toLowerCase();
  return !!a && !!b && (a === b || a.split("-")[0] === b.split("-")[0]);
}
// انتظار الإعادة: Retry-After (ثوانٍ أو تاريخ HTTP) إن وُجد، وإلا تضاعفٌ أسّي من base، بسقف cap
export function backoffMs(attempt, retryAfter, { base = 1500, cap = 60000, now = Date.now() } = {}) {
  if (retryAfter != null && String(retryAfter).trim() !== "") {
    const s = String(retryAfter).trim();
    if (/^\d+$/.test(s)) return Math.min(cap, +s * 1000);
    const t = Date.parse(s);
    if (!isNaN(t)) return Math.min(cap, Math.max(0, t - now));
  }
  return Math.min(cap, base * 2 ** attempt);
}
// ميزانية الإخفاق: نسبة جلبٍ أخفق (شبكةٌ أو 429/5xx بعد الإعادات) فوق ERR_MAX تمنع الكتابة إلا بقرار
export function errorGate(errors, fetched, { acceptErrors = false } = {}) {
  const why = [];
  if (fetched && errors / fetched > ERR_MAX && !acceptErrors)
    why.push(`أخفق ${errors} من ${fetched} جلبًا (أكثر من ${Math.round(ERR_MAX * 100)}٪) — أعد التشغيل بتمهّل، أو مرّر --accept-errors بقرار`);
  return { ok: !why.length, why };
}

// ── مدخلات الواجهة (خالص) ─────────────────────────────────────────────────────────────────────────────────
// ذيل العنوان (titleSuffix) يُنزع، فيبقى ما يُترجم
export function titleCore(title, suffixes) { let t = String(title || "").replace(/\s+/g, " ").trim(); for (const s of suffixes || []) if (t.endsWith(s)) return t.slice(0, -s.length).trim(); return t; }
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
// قالب قيمةٍ بتجريد الأسماء ({name}) والعناوين ({title}) والروابط ({url}) والشهر والسنة ({date}) والأعداد ({n})
export function templateOf(value, { names = [], titles = [] } = {}) {
  let s = String(value);
  for (const [list, tok] of [[names, "{name}"], [titles, "{title}"]])
    for (const x of [...new Set(list)].filter((y) => y && y.length >= 2).sort((a, b) => b.length - a.length)) s = s.split(x).join(tok);
  s = s.replace(/\bhttps?:\/\/[^\s"'<>]+/g, "{url}");
  s = s.replace(new RegExp("\\b(?:" + MONTHS + ")\\s+\\d{4}\\b", "g"), "{date}");
  s = s.replace(/\d[\d,.]*\d[KkMm+]?|\d[KkMm+]?/g, "{n}");
  return s;
}
const VARS_RE = /\{(name|title|url|date|n)\}/g;
export const hasVar = (s) => { VARS_RE.lastIndex = 0; return VARS_RE.test(s); };
// أنماط السوق: قوالب رُئيت بقيمٍ مختلفة في PATTERN_MIN صفحاتٍ فأكثر ← أزواجٌ بصيغة gen-patterns ({en, ar:""}) — والمتغيّرات بأسماء
// القالب؛ والشهر والسنة بقاعدة RULES §2 (الشهر عربيًّا والأرقام غربية)
export function marketPatterns(rows, { min = PATTERN_MIN } = {}) {
  const by = new Map();
  for (const r of rows) {
    if (!hasVar(r.tpl)) continue;
    let g = by.get(r.tpl);
    if (!g) { g = { en: r.tpl, kinds: new Set(), pages: new Set(), values: new Set() }; by.set(r.tpl, g); }
    g.kinds.add(r.kind); g.pages.add(r.page); g.values.add(r.value);
  }
  // وقالبٌ لا كلمة لاتينية فيه خارج متغيّراته («{name}» وحده: alt أو aria-label هو اسم العنصر) ليس نمطًا — الاسم يبقى كما هو
  return [...by.values()].filter((g) => g.pages.size >= min && g.values.size >= 2 && /[A-Za-z]{2}/.test(g.en.replace(VARS_RE, " ")))
    .map((g) => ({ en: g.en, ar: "", kinds: [...g.kinds].sort(), count: g.pages.size, bounded: true, source: "com-harvest ui (marketplace)",
      ...(/\{date\}/.test(g.en) ? { note: "{date} = month and year: Arabic month name, Western digits (RULES §2)" } : {}) }))
    .sort((a, b) => b.count - a.count || (a.en < b.en ? -1 : 1));
}
// ★ (مراجعة ر17) قيم القوالب التي لم تصر أنماطًا: بنودٌ حرفية (بندٌ لكل قيمة)، إلا قالبًا لا كلمة لاتينية فيه خارج متغيّراته
export function literalRows(rows, pairs) {
  const pe = new Set(pairs.map((x) => x.en)), out = new Map();
  for (const r of rows) {
    if (pe.has(r.tpl) || !r.item || !/[A-Za-z]{2}/.test(r.tpl.replace(VARS_RE, " ")) || out.has(r.value)) continue;
    out.set(r.value, r.item);
  }
  return [...out.values()];
}
// ★ (ر18، ٨ جمادى الأولى ١٤٤٨هـ — مراجعة ر17، البند 4) «الشهر والسنة» وعددٌ مع كلمة في صفحات السوق يقعان داخل المتن، فكانا يُحصدان كتلةً لا نمطًا:
// وكل شهرٍ جديد (أو عددٍ جديد) بصمةٌ لا قطعة لها، فيبقى إنجليزيًّا حتى الحصاد التالي ويُحسب على حارس المتن غير مغطًّى. فكتلة السوق التي هي
// عقدةٌ واحدة أو صفُّ لافتات (بنودٌ في المستوى الأعلى بلا نصٍّ بينها ولا بياض — ex.group في المحرّك: إن لم تُترجم الكتلة كلّها عُرِّب كل بندٍ
// وحده بقاموس الواجهة) وفي بنودها متغيّر: يُشتقّ من قيمها نمطٌ لقاموس الواجهة (CM1)، وبنودها الأخرى بنودٌ حرفية أو محايدة، وتخرج الكتلة من
// أجزاء المتن بحال «ui-pattern» (سببٌ يبدأ بـui فلا يصير علامة إبقاءٍ في merge-blocks ولا في الشمول). والتاريخ بقاعدة RULES §2.
// بنود الكتلة كما يراها المحرّك (cml-shared extractBlock): {kind: "single"|"group", items: [نصُّ البند | null (بلا نص) | false (بعقدٍ عدّة فيها
// حروف: لا يُعرَّب وحده)]}، أو null: جملةٌ (نصٌّ أو بياضٌ في المستوى الأعلى، أو بندٌ في طرفه بياض) أو بندٌ واحد
export function rowItems(tpl) {
  const s = String(tpl || "");
  if (!/<[a-z]\d+/.test(s)) { const t = s.replace(/\s+/g, " ").trim(); return t ? { kind: "single", items: [t] } : null; }
  const P = SHARED.parseTemplate(s);
  if (!P) return null;
  const items = [];
  let depth = 0, cur = null;
  for (let i = 0; i < P.texts.length; i++) {
    const t = P.texts[i];
    if (depth === 0) { if (t !== "") return null; } else if (t !== "") cur.push(t);
    if (i === P.toks.length) break;
    const k = P.toks[i];
    if (k.t === "o") { if (depth === 0) { cur = []; items.push(cur); } depth++; }
    else if (k.t === "c") depth--;
    else if (depth === 0) items.push([]);
  }
  if (items.length < 2) return null;
  const out = [];
  for (const it of items) {
    if (/^\s|\s$/.test(it.join(""))) return null;
    const filled = it.filter((t) => /\S/.test(t));
    out.push(filled.length === 1 ? filled[0] : filled.some((t) => /[A-Za-z]/.test(t)) ? false : null);
  }
  return { kind: "group", items: out };
}
export const ROW_PATTERN_WORDS = 8;   // بندٌ بمتغيّر لا يزيد على ثماني كلمات: لافتةٌ أو عدّاد أو تاريخ، لا جملةٌ من المتن
// entries: [{fp, tpl, pages: [مفاتيح صفحات السوق التي فيها الكتلة]}] ← {status: fp → "ui-pattern", pairs (بصيغة marketPatterns), literals: [{en, count}]}.
// البند المتغيّر: قالبه (templateOf بلا أسماء ولا عناوين) فيه {date} أو {n}. ويُقبل قالبُه نمطًا إن رُئي في min صفحةً فأكثر بقيمتين فأكثر، وفيه {date}
// أو كلمةٌ لاتينية خارج متغيّراته؛ والبند المتغيّر بلا كلمةٍ لاتينية (عددٌ وحده) محايدٌ لا يحتاج نمطًا. والكتلة «ui-pattern» إن كان فيها بندٌ متغيّر
// وكان كل بندٍ متغيّرٍ نمطًا مقبولًا أو محايدًا، ولا بند false؛ وبنودها الثابتة ذات الكلمات بنودٌ حرفية لـCM1
export function blockPatterns(entries, { min = PATTERN_MIN, maxWords = ROW_PATTERN_WORDS } = {}) {
  const cand = new Map(), by = new Map();
  for (const e of entries) {
    const r = rowItems(e.tpl);
    if (!r || r.items.some((x) => x === false)) continue;
    const pats = [], lits = [];
    let variable = false, bad = false;
    for (const x of r.items) {
      if (x === null) continue;
      const t = templateOf(x);
      if (t === x) { if (/[A-Za-z]{2}/.test(x)) lits.push(x); continue; }
      variable = true;
      const vars = t.match(VARS_RE) || [];
      if (vars.some((v) => v !== "{date}" && v !== "{n}")) { bad = true; break; }
      if (!/[A-Za-z]{2}/.test(x)) continue;                                   // عددٌ وحده (أو برمز): محايد
      if (wordsOf(x) > maxWords || !(/\{date\}/.test(t) || /[A-Za-z]{2}/.test(t.replace(VARS_RE, " ")))) { bad = true; break; }
      pats.push({ tpl: t, value: x });
    }
    if (bad || !variable) continue;
    cand.set(e.fp, { pats, lits, pages: e.pages || [] });
    for (const p of pats) {
      let g = by.get(p.tpl);
      if (!g) by.set(p.tpl, (g = { pages: new Set(), values: new Set() }));
      for (const pg of e.pages || []) g.pages.add(pg);
      g.values.add(p.value);
    }
  }
  const ok = (t) => { const g = by.get(t); return !!g && g.pages.size >= min && g.values.size >= 2; };
  const status = new Map(), used = new Set(), lit = new Map();
  for (const [fp, c] of cand) {
    if (!c.pats.every((p) => ok(p.tpl))) continue;
    status.set(fp, "ui-pattern");
    for (const p of c.pats) used.add(p.tpl);
    for (const l of c.lits) lit.set(l, (lit.get(l) || 0) + c.pages.length);
  }
  const pairs = [...used].map((t) => ({ en: t, ar: "", kinds: ["block"], count: by.get(t).pages.size, bounded: true, source: "com-harvest ui (marketplace blocks)",
    ...(/\{date\}/.test(t) ? { note: "{date} = month and year: Arabic month name, Western digits (RULES §2)" } : {}) }))
    .sort((a, b) => b.count - a.count || (a.en < b.en ? -1 : 1));
  return { status, pairs, literals: [...lit].map(([en, count]) => ({ en, count })) };
}
// مرجعٌ من القواميس المشحونة لنصٍّ مطابق حرفًا (لاتساق المصطلحات)
export function refOf(en, dicts) { for (const [from, S] of dicts) if (typeof S[en] === "string" && S[en] !== en) return { ref: S[en], refFrom: from }; return null; }

// ── التقسيم (خالص) ────────────────────────────────────────────────────────────────────────────────────────
export const plainOf = (tpl) => String(tpl || "").replace(/<c(\d+)>[\s\S]*?<\/c\1>/g, " ").replace(/<\/?[abisgc]\d+\/?>/g, " ").replace(/\s+/g, " ").trim();
export const wordsOf = (s) => (String(s).replace(/<c(\d+)>[\s\S]*?<\/c\1>/g, " ").replace(/<[^>]+>/g, " ").match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
// حال كل بصمة: kept (تبقيها الشركة)، وsymbols (لا كلمة لاتينية من حرفين خارج الشيفرة)، وui-repeated (في REPEAT_MIN صفحةً فأكثر: CM1)،
// وrelated (في RELATED_MIN صفحةً من السوق فأكثر: جزء «ذات صلة» الواحد)، وTRANSLATE ما سواها
export function statusOf(fp, { verdict, tpl, pagesN, mktPagesN }) {
  if (verdict === "kept") return "kept";
  if (!/[A-Za-z]{2}/.test(plainOf(tpl))) return "symbols";
  if (pagesN >= REPEAT_MIN) return "ui-repeated";
  if (mktPagesN >= RELATED_MIN) return "related";
  return "TRANSLATE";
}
// الأجزاء: pages = [{pk, url, family, fps}] بترتيب CM؛ info: fp → {tpl, status}. الكتلة المشتركة في جزء أول صفحةٍ لها؛ وكتل الصفحة متجاورة
// ولا تُقسم إلا صفحةٌ تزيد وحدها على 1.2×max؛ ومجموعات CM لا تجتمع في جزء؛ وبطاقات «ذات صلة» جزءٌ واحد (أو أكثر إن زادت) أول السوق
export function planParts(pages, info, { max = PART_WORDS, prefix = "com" } = {}) {
  const parts = [], owner = new Map();
  let cur = null;
  const open = (group, kind) => { cur = { group, kind, items: [], pages: [], words: 0, split: {} }; parts.push(cur); };
  const push = (fp, pk) => {
    const w = wordsOf(info.get(fp).tpl);
    if (cur.items.length && cur.words + w > max * 1.2) { const g = cur.group, k = cur.kind; open(g, k); cur.split[pk] = true; }
    cur.items.push(fp); cur.words += w; owner.set(fp, parts.length - 1);
    if (!cur.pages.includes(pk)) cur.pages.push(pk);
  };
  // بطاقات «ذات صلة»: كلّها قبل صفحات السوق، بترتيب أول ظهور
  const related = [], relPage = new Map();
  for (const pg of pages) if (groupOf(pg.family) === "marketplace") for (const fp of pg.fps) if (info.get(fp).status === "related" && !related.includes(fp)) { related.push(fp); relPage.set(fp, pg.pk); }
  let relDone = false;
  for (const pg of pages) {
    const g = groupOf(pg.family);
    if (g === "shell") continue;
    if (g === "marketplace" && !relDone && related.length) {
      open("marketplace", "related");
      for (const fp of related) { const w = wordsOf(info.get(fp).tpl); if (cur.items.length && cur.words + w > max) open("marketplace", "related"); cur.items.push(fp); cur.words += w; owner.set(fp, parts.length - 1); if (!cur.pages.includes(relPage.get(fp))) cur.pages.push(relPage.get(fp)); }
      relDone = true; cur = null;
    }
    const mine = pg.fps.filter((fp) => info.get(fp).status === "TRANSLATE" && !owner.has(fp));
    if (!mine.length) continue;
    const words = mine.reduce((n, fp) => n + wordsOf(info.get(fp).tpl), 0);
    // جزءٌ جديد: مجموعةٌ أخرى، أو صفحةٌ لا تتّسع لها البقية (بفسحة 10٪) — فلا تُقسم صفحةٌ تتّسع لجزءٍ وحدها
    if (!cur || cur.group !== g || cur.kind !== "pages" || (cur.items.length && cur.words + words > max * 1.1)) open(g, "pages");
    for (const fp of mine) push(fp, pg.pk);
  }
  const out = parts.filter((p) => p.items.length);
  out.forEach((p, i) => { p.id = `${prefix}-${String(i).padStart(3, "0")}`; });
  const ownerId = new Map();
  for (const p of out) for (const fp of p.items) ownerId.set(fp, p.id);
  return { parts: out, owner: ownerId };
}
// المراحل: أربعة أجزاءٍ فأقل، ولا تجتمع مجموعتا CM في مرحلة؛ والساعات بمعدّل الأكاديمية: مجموعة أربعة أجزاء بالتوازي 1.1–1.3 ساعة لجزءٍ
// من نحو 5.5 آلاف كلمة، ومعها نقطة الحفظ — فتُقاس بأكبر أجزائها
export function planStages(parts, { per = STAGE_PARTS, first = 2, name = "CM" } = {}) {
  const st = [];
  let cur = null;
  for (const p of parts) {
    if (!cur || cur.ids.length >= per || cur.group !== p.group) { cur = { stage: name + (first + st.length), group: p.group, ids: [], blocks: 0, words: 0, max: 0 }; st.push(cur); }
    cur.ids.push(p.id); cur.blocks += p.items.length; cur.words += p.words; cur.max = Math.max(cur.max, p.words);
  }
  for (const s of st) { s.hours = [+(0.2 + 1.1 * s.max / PART_WORDS).toFixed(2), +(0.3 + 1.3 * s.max / PART_WORDS).toFixed(2)]; s.ok = s.hours[1] <= 2; }
  return st;
}

// ── الجلب المتمهّل ────────────────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function politeGet(url, { tries = 5, timeoutMs = 45000 } = {}) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, { redirect: "manual", signal: ac.signal, headers: { "accept-language": "en-US,en;q=0.9", accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "user-agent": "claude-mutarjim com-harvest (public pages, build-time)" } });
      const text = r.status >= 300 && r.status < 400 ? "" : await r.text();
      clearTimeout(t);
      if (retryable(r.status)) { last = new Error("HTTP " + r.status); await sleep(backoffMs(i, r.headers.get("retry-after"))); continue; }
      return { status: r.status, text, location: r.headers.get("location") };
    } catch (e) { clearTimeout(t); last = e; await sleep(backoffMs(i, null)); }
  }
  throw last || new Error("fetch failed");
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, n) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
// بادئات اللغات (من hreflang الرئيسة) مرتّبةً بعدد صفحاتها في الخريطة، ومسارات الخريطة الإنجليزية — في الذاكرة وحدها
async function siteFacts() {
  const home = await politeGet(SITE + "/");
  if (home.status !== 200) throw new Error("الصفحة الرئيسة: HTTP " + home.status);
  const P = prefixesOf(alternatesOf(home.text));
  if (!P.size) throw new Error("لا روابط hreflang في الصفحة الرئيسة — لا تُعرف بادئات اللغات");
  const locs = [], queue = [SITE + "/sitemap.xml"], seen = new Set();
  while (queue.length) {
    const u = queue.shift(); if (seen.has(u)) continue; seen.add(u);
    const r = await politeGet(u);
    if (r.status !== 200) throw new Error("الخريطة: HTTP " + r.status);
    const sm = parseSitemap(r.text);
    for (const c of sm.children) { try { if (new URL(c).host === new URL(SITE).host) queue.push(c); } catch {} }
    for (const l of sm.locs) { try { const x = new URL(l); if (x.host === new URL(SITE).host) locs.push(normPath(x.pathname)); } catch {} }
  }
  const cnt = new Map([...P].map((p) => [p, 0])), english = [];
  for (const p of locs) { const f = p.split("/")[1] || ""; if (P.has(f)) cnt.set(f, cnt.get(f) + 1); else english.push(p); }
  const ranked = [...P].sort((a, b) => cnt.get(b) - cnt.get(a) || (a < b ? -1 : 1));
  return { P, ranked, english: [...new Set(english)], sitemap: locs.length };
}

// ── كروم: محلِّل HTML الخادم (about:blank) والصفحات المعروضة (سياقٌ جديد لكل تحميل) ─────────────────────────────────
const SRC = () => ["cml-const.js", "cml-shared.js"].map((f) => fs.readFileSync(path.join(EXT, f), "utf8")).join("\n;\n");
// يُحقن في الصفحة: إدراج حدود Suspense كما يفعل ‎$RC‎ في Next.js (المحتوى المتأخر في ‎div[hidden][id^="S:"]‎ يحلّ محلّ احتياط ‎template#B:n‎)، ثم
// بصمات الكتل في المتن بتكرارها، والسمات والنصوص (المنطقة: متنٌ أو واجهة)، و<html lang>، والعنوان
const PARSER = `window.__cmlScan = function (doc, opts) {
  var bodySel = opts.body, skip = opts.skip, keep = opts.keep || null;
  var html = doc.documentElement;
  var pairs = {}; var re = /\\$RC\\("([^"]+)","([^"]+)"\\)/g, m;
  Array.prototype.forEach.call(doc.querySelectorAll("script"), function (s) { var t = s.textContent || ""; while ((m = re.exec(t))) pairs[m[2]] = m[1]; });
  Array.prototype.forEach.call(doc.querySelectorAll('div[hidden][id^="S:"]'), function (seg) {
    var bid = pairs[seg.id] || seg.id.replace(/^S:/, "B:"), tpl = doc.getElementById(bid);
    if (!tpl || !tpl.parentNode) return;
    var start = tpl.previousSibling, par = tpl.parentNode, end = tpl.nextSibling, depth = 0;
    while (end) { if (end.nodeType === 8) { if (end.data === "/$" && depth === 0) break; if (/^\\$/.test(end.data)) depth++; else if (end.data === "/$") depth--; } end = end.nextSibling; }
    var n = tpl; while (n && n !== end) { var nx = n.nextSibling; par.removeChild(n); n = nx; }
    while (seg.firstChild) par.insertBefore(seg.firstChild, end || null);
    if (start && start.nodeType === 8 && start.data === "$?") start.data = "$";
    seg.parentNode && seg.parentNode.removeChild(seg);
  });
  var blocks = CMLShared.harvestBlocks(doc, { body: bodySel, skip: skip, keep: keep });   // ★ (ر24-ج1) بصنفَي المحرّك
  var all = doc.body ? CMLShared.harvestDom(doc.body, { chat: false, max: Infinity, skip: skip }) : [];
  var inBody = [].concat.apply([], Array.prototype.map.call(doc.querySelectorAll(bodySel), function (el) { return CMLShared.harvestDom(el, { chat: false, max: Infinity, skip: skip }); }));
  var bc = {}; inBody.forEach(function (h) { var k = h.kind + "\\u0000" + h.key; bc[k] = (bc[k] || 0) + 1; });
  var items = all.map(function (h) { var k = h.kind + "\\u0000" + h.key, z = "ui"; if (bc[k] > 0) { bc[k]--; z = "body"; } return { zone: z, kind: h.kind, key: h.key }; });
  return { lang: html.getAttribute("lang") || "", title: (doc.querySelector("title") || {}).textContent || "", seq: blocks.map(function (b) { return b.fp; }),
           tpl: blocks.map(function (b) { return [b.fp, b.tpl]; }), items: items, main: doc.querySelectorAll(bodySel).length };
};
window.__cmlParse = function (html, opts) { return window.__cmlScan(new DOMParser().parseFromString(html, "text/html"), opts); };
true`;

async function chromeParser(cdp) {
  const { sessionId } = await cdp.openPage("about:blank");
  await cdp.until(sessionId, "document.readyState === 'complete'", 10000);
  await cdp.evalIn(sessionId, SRC() + "\n;" + PARSER);
  return (html, opts) => cdp.evalIn(sessionId, `window.__cmlParse(${JSON.stringify(html)}, ${JSON.stringify(opts)})`, 120000);
}
async function renderedScan(cdp, url, opts, settle) {
  const { targetId, sessionId } = await cdp.openPage(url, { fresh: true });
  try {
    await settle(cdp, sessionId, { quietMs: 1500, maxMs: 20000 });
    const final = await cdp.evalIn(sessionId, "location.href");
    await cdp.evalIn(sessionId, SRC() + "\n;" + PARSER);
    const r = await cdp.evalIn(sessionId, `window.__cmlScan(document, ${JSON.stringify(opts)})`, 120000);
    return { ...r, final };
  } finally { await cdp.closePage(targetId); }
}

// ── مساعدات الملفات ───────────────────────────────────────────────────────────────────────────────────────
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1) + "\n", "utf8"); };
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
const pct = (a, b) => (b ? +(100 * a / b).toFixed(2) : 0);
// حصادات الكتل مضمومةً (لكل صفحةٍ أحدث حصادٍ لها — قاعدة merge-blocks): {pages: pk→[fp], urls: pk→url, tpl: fp→tpl, count: fp→n}
export function mergeBlocks(files) {
  const pages = {}, urls = {}, tpl = new Map();
  for (const f of files) {
    const h = readJson(f);
    for (const b of h.blocks || []) tpl.set(b.fp, b.tpl);
    Object.assign(pages, h.pages || {}); Object.assign(urls, h.urls || {});
  }
  return { pages, urls, tpl };
}
function listFiles(arg, fallback) { const a = String(arg || "").split(",").filter(Boolean); return a.length ? a.map((x) => path.resolve(x)) : fallback; }

// ── التشغيل ───────────────────────────────────────────────────────────────────────────────────────────────
async function main(argv) {
  const cmd = argv[0];
  const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
  const flag = (n) => argv.includes(`--${n}`);
  const dom = C.domain(D), META = dom.meta || {}, R = META.routes || {};
  const WD = workDir(D);
  const OUT = path.resolve(opt("out", WD));
  const t0 = Date.now();

  if (cmd === "list") {
    const facts = await siteFacts();
    const list = buildList({ exact: R.exact || [], english: facts.english, full: R.full || [], shell: R.shell || [] });
    const prevF = opt("prev", path.join(OUT, "_harvest", "list.json"));
    const prev = fs.existsSync(prevF) ? readJson(prevF) : null;
    const g = listGate(prev, list, { exactMeta: C.COM_EXACT_META, acceptDrop: flag("accept-drop"), facts: { sitemap: facts.sitemap, english: facts.english.length } });
    const meta = { at: new Date().toISOString(), sitemap: facts.sitemap, english: facts.english.length, prefixes: facts.P.size, exactMeta: C.COM_EXACT_META };
    console.log(`الخريطة ${facts.sitemap} عنوانًا (إنجليزية ${facts.english.length})، وبادئات اللغات ${facts.P.size}`);
    console.log(`القائمة: ${list.counts.full} صفحةً كاملة (exact ${list.counts.exact}، والسوق ${list.counts.marketplace}) وعيّنة هيكل ${list.counts.shell}` +
      (prev ? `؛ وكانت ${prev.counts.full} (السوق ${prev.counts.marketplace})` : ""));
    console.log("  العائلات: " + Object.entries(list.counts.byFamily).map(([k, v]) => k + " " + v).join("، "));
    for (const w of g.why) console.log("✗ " + w);
    if (!g.ok) return 2;
    const N = +opt("sample", "0") || 0;
    const items = N ? sampleList(list.items, { per: N }) : list.items;
    const out = { _tool: "com-harvest list", ...meta, sample: N || undefined, counts: N ? countList(items) : list.counts, items };
    const lf = path.join(OUT, "_harvest", N ? "list-sample.json" : "list.json");
    writeJson(lf, out);
    fs.writeFileSync(lf.replace(/\.json$/, ".urls.txt"), items.map((x) => SITE + x.path).join("\n") + "\n", "utf8");
    console.log(`✓ ${path.relative(process.cwd(), lf)} (${items.length} مسارًا) و.urls.txt لـharvest-dom ‎--urls‎`);
    return 0;
  }

  const listF = opt("list", path.join(WD, "_harvest", "list.json"));
  if (!fs.existsSync(listF)) { console.error("✗ لا قائمة: " + listF + " — شغّل list أولًا"); return 2; }
  const LIST = readJson(listF);
  const famOf = new Map(LIST.items.map((x) => [x.path, x.family]));
  const blkFiles = listFiles(opt("blocks", ""), blocksHarvests(D));
  if (!blkFiles.length) { console.error("✗ لا حصاد كتل (harvest-dom --domain=com --blocks)"); return 2; }
  const BH = mergeBlocks(blkFiles);
  const pkToPath = (pk) => normPath(pk);

  if (cmd === "classify") {
    const { launch, settle } = await import("./cdp-lib.mjs");
    const facts = await siteFacts();
    const pick = opt("pick", "1,2").split(",").map((x) => parseInt(x, 10)).filter((x) => x >= 1);
    const conc = Math.max(1, parseInt(opt("concurrency", "2"), 10) || 2);
    const skip = SHARED.harvestSkip(META, "full");
    const sOpts = { body: META.bodySel, skip, keep: SHARED.harvestKeep(META, "full") };
    const cdp = await launch({ chrome: opt("chrome", ""), headless: true });
    let errors = 0, fetched = 0, fetchMs = 0, untranslated = 0;
    const perPage = [], perItems = [], ambiguous = new Set(), splitAll = new Set(), pages = {}, server = {};
    const rankName = (p) => "#" + (facts.ranked.indexOf(p) + 1);
    try {
      const parse = await chromeParser(cdp);
      const pks = Object.keys(BH.pages).filter((pk) => famOf.has(pkToPath(pk)));
      await pool(pks, conc, async (pk) => {
        const p = pkToPath(pk), t1 = Date.now();
        let en;
        try { fetched++; const r = await politeGet(SITE + (p === "/" ? "/" : p)); if (r.status !== 200) throw new Error("HTTP " + r.status); en = await parse(r.text, sOpts); en.html = r.text; }
        catch (e) { errors++; pages[pk] = { error: "en: " + e.message }; return; }
        const hl = prefixesOf(alternatesOf(en.html));
        delete en.html;
        const avail = hl.size ? new Set([...hl].filter((x) => facts.P.has(x))) : new Set(facts.P);
        const vers = [], used = [];
        for (const pre of versionOrder(avail, facts.ranked, pick)) {
          if (vers.length >= 2) break;
          try {
            fetched++;
            const r = await politeGet(SITE + "/" + pre + (p === "/" ? "" : p));
            if (r.status !== 200) continue;
            const v = await parse(r.text, sOpts);
            const vv = versionVerdict(r.status, v, pre, en.seq);
            if (vv === "untranslated") untranslated++;
            if (vv !== "ok") continue;
            vers.push(v); used.push(rankName(pre));
          } catch (e) { errors++; }
        }
        fetchMs += Date.now() - t1;
        const { verdict, ambiguous: amb, split } = classifyPage(en.seq, vers.map((v) => v.seq));
        for (const fp of amb) ambiguous.add(fp);
        for (const fp of split) splitAll.add(fp);
        // بصماتٌ في حصاد المتصفح لا يحملها HTML الخادم: لا تُحكم هنا (تُرسل للترجمة ما لم تُحكم في صفحةٍ أخرى)
        perPage.push(pageVerdicts(BH.pages[pk], verdict));
        perItems.push(classifyItems(en.items, vers.map((v) => v.items)));
        const tc = titleCore(en.title, META.titleSuffix), tk = vers.length ? vers.every((v) => titleCore(v.title, META.titleSuffix) === tc) : null;
        pages[pk] = { versions: vers.length, used, titleKept: tk, blocks: BH.pages[pk].length, notInServer: BH.pages[pk].filter((fp) => !verdict.has(fp)).length,
          splitBlocks: split.size, splitWords: [...split].reduce((n, fp) => n + wordsOf(BH.tpl.get(fp) || ""), 0) };
        server[pk] = { en: en.seq, vers: vers.map((v) => v.seq), used };
      });
      const verdicts = combineVerdicts(perPage);
      const items = new Map();
      for (const m of perItems) for (const [k, v] of m) { const o = items.get(k); items.set(k, v === "translated" || o === "translated" ? "translated" : v === "kept" || o === "kept" ? "kept" : "unverified"); }
      const eg = errorGate(errors, fetched, { acceptErrors: flag("accept-errors") });
      // الأعداد: الكتل والكلمات (البصمة مرّةً في الموقع)، والمُبقى، والملتبس بالموضع
      let words = 0, keptW = 0; const tally = { kept: 0, translated: 0, unverified: 0 };
      for (const [fp, v] of verdicts) { const w = wordsOf(BH.tpl.get(fp) || ""); words += w; tally[v]++; if (v === "kept") keptW += w; }
      const nPages = Object.keys(pages).length, okPages = Object.values(pages).filter((x) => !x.error);
      const byFam = {};
      for (const [pk, x] of Object.entries(pages)) { const f = famOf.get(pkToPath(pk)) || "?"; byFam[f] = byFam[f] || { pages: 0, versions2: 0, versions1: 0, versions0: 0 }; byFam[f].pages++; byFam[f]["versions" + (x.versions || 0)]++; }
      const ambN = [...ambiguous].filter((fp) => verdicts.get(fp) === "translated").length;
      const res = { _tool: "com-harvest classify", at: new Date().toISOString(), list: path.basename(listF), blocks: blkFiles.map((f) => path.basename(f)), pick,
        counts: { pages: nPages, pagesOk: okPages.length, fetched, errors, untranslatedVersions: untranslated, blocks: verdicts.size, words, ...tally, keptWords: keptW, keptBlocksPct: pct(tally.kept, verdicts.size),
          keptWordsPct: pct(keptW, words), eitherVersion: [...splitAll].filter((fp) => verdicts.get(fp) === "translated").length,
          eitherVersionWords: [...splitAll].filter((fp) => verdicts.get(fp) === "translated").reduce((n, fp) => n + wordsOf(BH.tpl.get(fp) || ""), 0),
          eitherVersionPages: Object.values(pages).filter((x) => x.splitBlocks).length, ambiguous: ambN, ambiguousPct: pct(ambN, verdicts.size), secondsPerPage: +(fetchMs / 1000 / Math.max(1, okPages.length)).toFixed(2), concurrency: conc,
          wallSecondsPerPage: +((Date.now() - t0) / 1000 / Math.max(1, nPages)).toFixed(2),
          wallSeconds: Math.round((Date.now() - t0) / 1000), byFamily: byFam },
        pages, blocks: Object.fromEntries([...verdicts].map(([fp, v]) => [fp, v])),
        items: [...items].map(([k, v]) => { const [zone, kind, key] = k.split("\u0000"); return { zone, kind, key, v }; }) };
      console.log(`المصنِّف: ${nPages} صفحة (${okPages.length} سليمة)، جلب ${fetched} وإخفاق ${errors}؛ الكتل ${verdicts.size} (≈${words} كلمة): مُبقاة ${tally.kept} (${res.counts.keptBlocksPct}٪، والكلمات ${res.counts.keptWordsPct}٪)، ` +
        `مترجمة ${tally.translated} (منها ما أبقته نسخةٌ وترجمته الأخرى ${res.counts.eitherVersion} في ${res.counts.eitherVersionPages} صفحة، ≈${res.counts.eitherVersionWords} كلمة)، وغير متحقَّقة ${tally.unverified}؛ وملتبسةٌ بالموضع (باقيةٌ بالعدّ لا بالموضع، فتُترجم) ${ambN} (${res.counts.ambiguousPct}٪)`);
      console.log(`  النسخ المستعملة بالترتيب: ${[...new Set(Object.values(pages).flatMap((x) => x.used || []))].sort().join(" ")}؛ وثوانٍ للصفحة (الإنجليزية ونسختاها بلا متصفح) ${res.counts.secondsPerPage}` +
        `؛ ونسخٌ تُركت لأنها خُدمت غير مترجمة ${untranslated}`);
      for (const w of eg.why) console.log("✗ " + w);
      // ‎--browser-check‎: المقارنة نفسها على الصفحات معروضة (سياقٌ جديد لكل تحميل)، وموافقة المصنِّف بها، وسبب كل مخالفة
      if (flag("browser-check")) {
        const agree = { pairs: 0, same: 0 }, dis = [];
        let bMs = 0, bLoads = 0;
        for (const pk of Object.keys(server)) {
          const p = pkToPath(pk), sv = server[pk];
          const t1 = Date.now();
          let enB; try { enB = await renderedScan(cdp, SITE + (p === "/" ? "/" : p), sOpts, settle); bLoads++; } catch (e) { dis.push({ pk, error: "en: " + e.message }); continue; }
          if (normPath(new URL(enB.final).pathname) !== p) { dis.push({ pk, error: "حُوِّل المعروض الإنجليزي" }); continue; }
          const versB = [];
          for (const rk of sv.used) {
            const pre = facts.ranked[+rk.slice(1) - 1];
            try { const v = await renderedScan(cdp, SITE + "/" + pre + (p === "/" ? "" : p), sOpts, settle); bLoads++; if (langMatches(v.lang, pre)) versB.push(v.seq); } catch {}
          }
          bMs += Date.now() - t1;
          if (versB.length !== sv.vers.length) { dis.push({ pk, error: `نسخٌ معروضة ${versB.length} وخادم ${sv.vers.length}` }); }
          const bv = classifyPage(enB.seq, versB).verdict, sv0 = classifyPage(sv.en, sv.vers).verdict;
          for (const fp of new Set(enB.seq)) {
            const b = bv.get(fp) || "unverified", sLocal = sv0.has(fp) ? sv0.get(fp) : "unverified";
            agree.pairs++;
            if (sLocal === b) { agree.same++; continue; }
            // السبب: بصمةٌ لا يحملها HTML الخادم الإنجليزي (محتوًى يركّبه العميل)، أو تظهر في نسخةٍ معروضة لا في خادمها أو العكس، أو ترتيبٌ وعدد
            const reason = !sv.en.includes(fp) ? "not-in-server-en" : sv.vers.some((t) => !t.includes(fp)) && versB.every((t) => t.includes(fp)) ? "rendered-only-in-version"
              : versB.some((t) => !t.includes(fp)) && sv.vers.every((t) => t.includes(fp)) ? "server-only-in-version" : "order-or-count";
            dis.push({ pk, fp, server: sLocal, browser: b, site: verdicts.get(fp) || "unverified", reason, words: wordsOf(BH.tpl.get(fp) || "") });
          }
        }
        res.browserCheck = { pairs: agree.pairs, same: agree.same, agreementPct: pct(agree.same, agree.pairs), loads: bLoads,
          secondsPerLoad: +(bMs / 1000 / Math.max(1, bLoads)).toFixed(2), disagreements: dis,
          reasons: dis.reduce((o, d) => { const k = d.reason || "page-error"; o[k] = (o[k] || 0) + 1; return o; }, {}) };
        console.log(`مقارنة المتصفح: ${agree.same}/${agree.pairs} زوجًا (صفحةٌ × بصمة) متوافقًا = ${res.browserCheck.agreementPct}٪ في ${bLoads} تحميلًا (${res.browserCheck.secondsPerLoad} ث للتحميل)؛ ` +
          "المخالفات: " + Object.entries(res.browserCheck.reasons).map(([k, v]) => k + " " + v).join("، "));
      }
      if (!eg.ok) return 2;
      const f = path.join(OUT, "_harvest", `classified-${stamp()}.json`);
      writeJson(f, res);
      console.log("✓ " + f);
      return 0;
    } finally { await cdp.close(); }
  }

  const clsF = opt("classified", "");
  const CLS = clsF ? readJson(clsF) : null;
  if (!CLS) { console.error("✗ ‎--classified=<classified-*.json>‎ (مخرج classify) لازم"); return 2; }
  const V = new Map(Object.entries(CLS.blocks || {}));
  // صفحات كل بصمة (كلها، لا ثلاثٌ أولى) وصفحاتها في السوق
  const fpPages = new Map(), fpMkt = new Map(), fpMktPages = new Map();
  const order = cmSort(Object.keys(BH.pages).filter((pk) => famOf.has(pkToPath(pk))).map((pk) => ({ pk, path: pkToPath(pk), family: famOf.get(pkToPath(pk)) })));
  for (const { pk, family } of order) for (const fp of new Set(BH.pages[pk])) {
    fpPages.set(fp, (fpPages.get(fp) || 0) + 1);
    if (groupOf(family) === "marketplace") { fpMkt.set(fp, (fpMkt.get(fp) || 0) + 1); if (!fpMktPages.has(fp)) fpMktPages.set(fp, []); fpMktPages.get(fp).push(pk); }
  }
  const info = new Map();
  for (const [fp, n] of fpPages) info.set(fp, { tpl: BH.tpl.get(fp) || "", status: statusOf(fp, { verdict: V.get(fp), tpl: BH.tpl.get(fp) || "", pagesN: n, mktPagesN: fpMkt.get(fp) || 0 }) });
  // ★ (ر18) كتل السوق ذات الشهر والسنة أو العدد (عقدةٌ واحدة أو صفُّ لافتات): نمطٌ لـCM1 وبنودٌ حرفية، وتخرج من أجزاء المتن (blockPatterns أعلاه).
  // وما تبقيه الشركة أو لا كلمة فيه يبقى على حاله
  const BP = blockPatterns([...info].filter(([fp, x]) => fpMktPages.has(fp) && (x.status === "TRANSLATE" || x.status === "related" || x.status === "ui-repeated"))
    .map(([fp, x]) => ({ fp, tpl: x.tpl, pages: fpMktPages.get(fp) })));
  for (const fp of BP.status.keys()) info.get(fp).status = "ui-pattern";

  if (cmd === "ui") {
    const hvFiles = listFiles(opt("harvest", ""), domHarvests(D));
    if (!hvFiles.length) { console.error("✗ لا حصاد DOM للنطاق"); return 2; }
    const H = mergeDomHarvests(hvFiles);
    const keptItem = new Map((CLS.items || []).map((x) => [x.zone + "\u0000" + x.kind + "\u0000" + x.key, x.v]));
        // القواميس المشحونة (لا قاموس com): مرجع الاتساق
    const dicts = fs.readdirSync(DICTS).filter((n) => /^ar(-[a-z]+)?\.json$/.test(n) && n !== "ar-com.json").sort((a, b) => (a === "ar.json" ? -1 : b === "ar.json" ? 1 : a < b ? -1 : 1))
      .map((n) => [n, (readJson(path.join(DICTS, n)).strings || {})]);
    const titles = new Map();   // مسار ← عنوانٌ بلا ذيل
    for (const p of H.pages || []) if (p.title && !p.error) titles.set(normPath(new URL(p.url).pathname), titleCore(p.title, META.titleSuffix));
    const mktPath = (u) => { try { return groupOf(familyOf(new URL(u).pathname)) === "marketplace"; } catch { return false; } };
    const nameOf = (p) => { const t = titles.get(p) || "", m = /^(.+) connector$/.exec(t); return m ? m[1] : t; };
    const items = [], pairsRows = [], kept = { attr: 0, text: 0, title: 0, block: 0 };
    const allTitles = new Set([...titles.values()]);
    const add = (it) => { const r = refOf(it.en, dicts); items.push({ ...it, words: wordsOf(it.en), ...(r || {}) }); };
    for (const r of H.keys || []) {
      if (allTitles.has(titleCore(r.key, META.titleSuffix)) && (r.kinds || []).every((k) => k === "text")) continue; // نصّ <title>: صنف العناوين أدناه
      const kinds = r.kinds || [], isAttr = kinds.some((k) => k.indexOf("attr:") === 0);
      const inMkt = (r.pages || []).length && r.pages.every(mktPath);
      if (r.zone === "body" && !isAttr) continue;            // متنٌ خالص: تأخذه الكتل
      const zone = r.zone === "body" ? "body" : "ui";
      // تبقيها الشركة: حكمُ المصنِّف «kept» في نوعٍ واحدٍ على الأقل من أنواعها ومنطقتها، ولا «translated» في أيٍّ منها
      const zs = r.zone === "both" ? ["ui", "body"] : [zone];
      const vs = kinds.flatMap((k) => zs.map((z) => keptItem.get(z + "\u0000" + k + "\u0000" + r.key))).filter(Boolean);
      if (vs.includes("kept") && !vs.includes("translated")) { kept[isAttr ? "attr" : "text"]++; continue; }
      if (inMkt) {
        const names = (r.pages || []).map((u) => nameOf(normPath(new URL(u).pathname)));
        const tpl = templateOf(r.key, { names });
        const item = { en: r.key, kinds, zone, pages: (r.pages || []).slice(0, 3), count: r.count, source: "marketplace-attr" };
        for (const u of r.pages || []) pairsRows.push({ tpl, kind: kinds[0], page: u, value: r.key, item });
        if (hasVar(tpl)) continue;
      } else if (zone === "body") {
        const tpl = templateOf(r.key, { titles: (r.pages || []).map((u) => titles.get(normPath(new URL(u).pathname)) || "") });
        const item = { en: r.key, kinds, zone, pages: (r.pages || []).slice(0, 3), count: r.count, source: "body-attr" };
        if (hasVar(tpl)) { for (const u of r.pages || []) pairsRows.push({ tpl, kind: kinds[0], page: u, value: r.key, item }); continue; }
      }
      add({ en: r.key, kinds, zone, pages: (r.pages || []).slice(0, 3), count: r.count, source: zone === "ui" ? "header-footer" : inMkt ? "marketplace-attr" : "body-attr" });
    }
    // الكتل المتكرّرة (REPEAT_MIN صفحةً فأكثر): ذات العقدة الواحدة نصٌّ لقاموس الواجهة، وغيرها جزء كتلٍ لـCM1 (يُعدّه chunk)
    for (const [fp, x] of info) if (x.status === "ui-repeated" && !/<[a-z]\d+/.test(x.tpl)) add({ en: x.tpl, kinds: ["block"], zone: "body", count: fpPages.get(fp), source: "repeated-block" });
    // عناوين التبويب خارج السوق (يبقى ذيل titleKeep)، وما تبقيه الشركة منها يُستبعد؛ وعناوين السوق: نمط «{name} connector» وحده (أسماء الإضافات والمنتجات تبقى)
    const tSeen = new Set();
    for (const [p, t] of titles) {
      const pk = Object.keys(CLS.pages || {}).find((k) => pkToPath(k) === p);
      // ★ (ر18) وعنوان موصِّلٍ تبقيه الشركة إنجليزيًّا (titleKept في المصنِّف) لا يُحتسب في نمط «{name} connector»، ويُعدّ مستبعَدًا
      if (groupOf(familyOf(p)) === "marketplace" && / connector$/.test(t) && pk && CLS.pages[pk].titleKept === true) { kept.title++; continue; }
      if (groupOf(familyOf(p)) === "marketplace") { if (/ connector$/.test(t)) pairsRows.push({ tpl: "{name} connector", kind: "title", page: SITE + p, value: t, item: { en: t, kinds: ["title"], zone: "title", pages: [SITE + p], count: 1, source: "marketplace-title" } }); continue; }
      if (!t || tSeen.has(t)) continue; tSeen.add(t);
      if (pk && CLS.pages[pk].titleKept === true) { kept.title++; continue; }
      add({ en: t, kinds: ["title"], zone: "title", pages: [SITE + p], count: 1, source: "tab-title" });
    }
    // ★ (ر18) ومعها أنماط كتل السوق (التاريخ والأعداد) وبنودها الحرفية — والنمط الواحد مرّةً واحدة
    const pairs = [...new Map([...marketPatterns(pairsRows), ...BP.pairs].map((x) => [x.en, x])).values()];
    for (const l of BP.literals) add({ en: l.en, kinds: ["block"], zone: "body", count: l.count, source: "marketplace-block-label" });
    // ★ (مراجعة ر17) قالبٌ بمتغيّرٍ لم يصر نمطًا (رُئي في أقل من PATTERN_MIN صفحة أو بقيمةٍ واحدة) كان يسقط من مدخلات CM1 بلا عدّ (29 قيمةً في عيّنة
    // ر17): فتُضاف قيمه حرفيةً وتُعدّ (literalFromTemplates) — إلا قالبًا لا كلمة لاتينية فيه خارج متغيّراته (الاسم وحده يبقى كما هو)
    const literalFromTemplates = literalRows(pairsRows, pairs);
    for (const it of literalFromTemplates) add(it);
    // الأجزاء: نحو 250 بندًا أو 4,500 كلمة (أجزاء ‎_ar_todo/ac/A*‎ في الأكاديمية)
    const dedup = []; const s2 = new Set();
    for (const it of items) { if (s2.has(it.en)) continue; s2.add(it.en); dedup.push(it); }
    const uparts = []; let cu = null;
    for (const it of dedup) { if (!cu || cu.items.length >= 250 || cu.words + it.words > 4500) { cu = { id: "U" + (uparts.length + 1), items: [], words: 0 }; uparts.push(cu); } cu.items.push(it); cu.words += it.words; }
    const AR = path.join(OUT, "_ar_todo");
    const rel = (f) => "web/code/glossary/com/" + path.relative(OUT, f).split(path.sep).join("/");
    for (const p of uparts) {
      writeJson(path.join(AR, "cm1", p.id + ".json"), p.items);
      fs.writeFileSync(path.join(AR, "cm1", p.id + ".txt"), p.items.map((x) => x.en).join("\n") + "\n", "utf8");
    }
    const keptN = Object.values(kept).reduce((a, b) => a + b, 0);
    writeJson(path.join(AR, "ui-cm1-todo.json"), { _about: "CM1 inputs for claude.com (UI dictionary ar-com.json): header and footer texts, body attributes outside the marketplace, single-node blocks repeated on 20 or more pages, tab titles outside the marketplace (the \" | Claude by Anthropic\" tail stays: titleKeep). Parts cm1/U<n>.txt (one English text per line) with cm1/U<n>.json (context); validate each batch with validate-batch.mjs <U<n>.txt> <out.json>. ref/refFrom = the Arabic of the same English in a shipped dictionary (use it for consistency). Texts the company keeps English are excluded (keptByCompany). Marketplace patterns are in ../_vars-pairs-com-cm1.json (gen-patterns input), with the month-year and count patterns of marketplace body blocks (source marketplace blocks) whose fixed labels are items here (source marketplace-block-label).",
      prepared: new Date().toISOString().slice(0, 10), stage: "CM1", counts: { items: dedup.length, words: dedup.reduce((n, x) => n + x.words, 0), withRef: dedup.filter((x) => x.ref).length, pairs: pairs.length, literalFromTemplates: literalFromTemplates.length, keptByCompany: kept,
        blockPatterns: BP.pairs.length, blockPatternBlocks: BP.status.size, blockLabels: BP.literals.length },
      parts: uparts.map((p) => ({ id: p.id, file: rel(path.join(AR, "cm1", p.id + ".json")), items: p.items.length, words: p.words })), items: dedup, keptByCompany: keptN });
    writeJson(path.join(OUT, "_vars-pairs-com-cm1.json"), pairs);
    // ما تبقيه الشركة إنجليزيًّا من نصوص الواجهة والسمات: لبوابة الشمول (completeness تقرأ ‎_keep-en.generated.json‎)
    const keepGen = (CLS.items || []).filter((x) => x.v === "kept").map((x) => ({ en: x.key, why: "company-keeps-en (" + x.kind + ", ر17 classifier)" }));
    writeJson(path.join(OUT, "_keep-en.generated.json"), { _about: "claude.com UI texts and attribute values the company keeps English (com-harvest classify: unchanged in every compared translated version). Read by completeness after keep-en.json.", keep: [...new Map(keepGen.map((k) => [k.en, k])).values()] });
    console.log(`CM1: ${dedup.length} نصًّا (≈${dedup.reduce((n, x) => n + x.words, 0)} كلمة) في ${uparts.length} جزءًا، منها بمرجعٍ من القواميس المشحونة ${dedup.filter((x) => x.ref).length}؛ ` +
      `أنماط ${pairs.length} (منها من كتل السوق ${BP.pairs.length} تغطّي ${BP.status.size} كتلة، وبنودها الحرفية ${BP.literals.length})، وقيمٌ حرفية من قوالب لم تصر أنماطًا ${literalFromTemplates.length}؛ ومستبعَدٌ تبقيه الشركة: سمات ${kept.attr}، نصوص ${kept.text}، عناوين ${kept.title}`);
    console.log("  المصادر: " + Object.entries(dedup.reduce((o, x) => { o[x.source] = (o[x.source] || 0) + 1; return o; }, {})).map(([k, v]) => k + " " + v).join("، "));
    return 0;
  }

  if (cmd === "chunk") {
    const max = Math.max(500, parseInt(opt("words", String(PART_WORDS)), 10) || PART_WORDS);
    const pagesArr = order.map(({ pk, path: p, family }) => ({ pk, url: (BH.urls[pk] || SITE + p), family, fps: [...new Set(BH.pages[pk])] }));
    const { parts, owner } = planParts(pagesArr, info, { max });
    // CM1: الكتل المتكرّرة متعدّدة العقد جزء كتلٍ مستقلّ (com-ui-NNN)
    const uiBlocks = [...info].filter(([, x]) => x.status === "ui-repeated" && /<[a-z]\d+/.test(x.tpl)).map(([fp]) => fp);
    const uiParts = [];
    for (let i = 0; i < uiBlocks.length; i += 250) uiParts.push({ id: `com-ui-${String(uiParts.length).padStart(3, "0")}`, group: "ui", kind: "repeated", items: uiBlocks.slice(i, i + 250), pages: [], words: uiBlocks.slice(i, i + 250).reduce((n, fp) => n + wordsOf(info.get(fp).tpl), 0), split: {} });
    for (const p of uiParts) for (const fp of p.items) owner.set(fp, p.id);
    const BT = path.join(OUT, "_blk_todo");
    for (const sub of ["p4", "p4ctx"]) fs.mkdirSync(path.join(BT, sub), { recursive: true });
    const rel = (f) => "web/code/glossary/com/" + path.relative(OUT, f).split(path.sep).join("/");
    const all = [...uiParts, ...parts];
    for (const p of all) writeJson(path.join(BT, "p4", p.id + ".json"), p.items.map((fp) => ({ fp, src: info.get(fp).tpl })));
    const famOfPk = new Map(pagesArr.map((x) => [x.pk, x.family]));
    writeJson(path.join(BT, "p4-manifest.json"), all.map((p) => ({ id: p.id, domain: D, file: rel(path.join(BT, "p4", p.id + ".json")), blocks: p.items.length, words: p.words,
      pages: p.pages.map((pk) => BH.urls[pk] || SITE + pkToPath(pk)), types: [...new Set(p.pages.map((pk) => famOfPk.get(pk)))], kind: p.kind, group: p.group,
      ...(Object.keys(p.split).length ? { split: Object.keys(p.split) } : {}) })));
    const shared = {};
    for (const [fp, n] of fpPages) if (n > 1 && owner.has(fp)) shared[fp] = { chunk: owner.get(fp), count: n, pages: pagesArr.filter((x) => x.fps.includes(fp)).slice(0, 3).map((x) => x.url) };
    writeJson(path.join(BT, "p4-shared.json"), { _about: "Blocks of the p4 chunks that appear on more than one page (pages: up to the first three; count: pages in the harvest). Each is translated once, in its owner chunk (the related-cards chunk for marketplace cards; com-ui for blocks repeated on 20 or more pages), and must read correctly on every page.", blocks: shared });
    // السياق: كل كتلةٍ في صفحات الجزء بترتيبها وحالها
    const why = { kept: "company-keeps-en", symbols: "symbols", "ui-repeated": "ui-cm1", "ui-pattern": "ui-cm1-pattern" };
    for (const p of parts) {
      const ctxPages = (p.kind === "related" ? pagesArr.filter((x) => groupOf(x.family) === "marketplace" && x.fps.some((fp) => p.items.includes(fp))).slice(0, 12) : pagesArr.filter((x) => p.pages.includes(x.pk)))
        .map((x) => ({ page: pkToPath(x.pk), url: x.url, type: x.family, blocks: x.fps.map((fp) => { const s = info.get(fp).status, o = owner.get(fp);
          return { fp, status: o === p.id ? "TRANSLATE" : o ? "chunk" : s === "kept" || s === "symbols" ? "kept" : "ui", ...(o && o !== p.id ? { chunk: o } : {}), ...(why[s] && !o ? { why: why[s] } : {}), src: info.get(fp).tpl }; }) }));
      writeJson(path.join(BT, "p4ctx", p.id + ".json"), { _about: `Context only (do not translate this file): every harvested block of each page in chunk ${p.id}, in page order. status TRANSLATE = translated in this chunk; chunk = another chunk translates it; kept = stays English (company-keeps-en: unchanged in both translated versions of the company; symbols: nothing to translate); ui = the UI dictionary translates it (CM1).` + (p.kind === "related" ? " This is the related-cards chunk: each card is a short description of another marketplace item shown on many item pages; the context lists up to twelve of those pages." : ""), pages: ctxPages });
    }
    const keptRows = [...info].filter(([fp, x]) => (x.status === "kept" || x.status === "symbols" || x.status === "ui-pattern" || (x.status === "ui-repeated" && !owner.has(fp))))
      .map(([fp, x]) => ({ fp, src: x.tpl, why: x.status === "kept" ? "company-keeps-en" : x.status === "symbols" ? "symbols" : x.status === "ui-pattern" ? "ui-cm1-pattern" : "ui-cm1", pages: pagesArr.filter((y) => y.fps.includes(fp)).slice(0, 3).map((y) => pkToPath(y.pk)) }));
    const cnt = (w) => keptRows.filter((r) => r.why === w).length, wds = (w) => keptRows.filter((r) => r.why === w).reduce((n, r) => n + wordsOf(r.src), 0);
    writeJson(path.join(BT, "kept-as-is.json"), { _about: "claude.com body blocks NOT sent to translation, each with its reason. Every other harvested fp of a full page is in exactly one chunk p4/<id>.json. merge-blocks.mjs turns every reason that does not start with \"ui\" into a keep mark on the pages that carry the block; ui-cm1 and ui-cm1-pattern are translated by the UI dictionary (CM1).",
      prepared: new Date().toISOString().slice(0, 10), stage: "ر19", source: blkFiles.map((f) => path.basename(f)).join(" + ") + " ; " + (clsF ? path.basename(clsF) : ""),
      method: "com-harvest classify: the block's fingerprint in the server HTML of the English page and of two translated versions (Suspense boundaries inserted), aligned in order (LCS); kept when every occurrence survives in place in both versions on every compared page; translated when either version translated it.",
      reasons: { "company-keeps-en": "the company keeps this block English: unchanged in place in both of its translated versions on every compared page", symbols: "no word of two Latin letters outside code atoms: nothing to translate", "ui-cm1": "single text node repeated on 20 or more pages: translated by the UI dictionary in CM1 (not a keep mark)",
        "ui-cm1-pattern": "marketplace block (one text node, or a row of labels) whose month and year or count changes between harvests: a CM1 pattern from its values and its fixed labels translate it item by item (not a keep mark)" },
      counts: { "company-keeps-en": cnt("company-keeps-en"), symbols: cnt("symbols"), "ui-cm1": cnt("ui-cm1"), "ui-cm1-pattern": cnt("ui-cm1-pattern") }, words: { "company-keeps-en": wds("company-keeps-en"), symbols: wds("symbols"), "ui-cm1": wds("ui-cm1"), "ui-cm1-pattern": wds("ui-cm1-pattern") },
      total: keptRows.length, blocks: keptRows });
    const stages = planStages(parts, { first: 2 });
    const stagesOut = [{ stage: "CM1", ids: uiParts.map((p) => p.id), blocks: uiBlocks.length, words: uiParts.reduce((n, p) => n + p.words, 0), note: "with the UI parts _ar_todo/cm1/U*.txt" },
      ...stages.map((s) => ({ stage: s.stage, ids: s.ids, blocks: s.blocks, words: s.words, hours: s.hours, group: s.group,
        first: parts.find((p) => p.id === s.ids[0]).pages.map(pkToPath)[0] || null, last: (parts.find((p) => p.id === s.ids[s.ids.length - 1]).pages.map(pkToPath).slice(-1)[0]) || null,
        types: [...new Set(s.ids.flatMap((id) => parts.find((p) => p.id === id).pages.map((pk) => famOfPk.get(pk))))] }))];
    writeJson(path.join(BT, "stages.json"), stagesOut);
    const tw = parts.reduce((n, p) => n + p.words, 0), tb = parts.reduce((n, p) => n + p.items.length, 0);
    fs.writeFileSync(path.join(BT, "BRIEF.md"), briefSkeleton({ parts: parts.length, blocks: tb, words: tw, stages: stages.length, ui: uiParts.length, kept: keptRows.length }), "utf8");
    const over = stages.filter((s) => !s.ok);
    console.log(`الأجزاء: ${parts.length} (≈${tw} كلمة، ${tb} كتلة؛ «ذات صلة» ${parts.filter((p) => p.kind === "related").length})، وأجزاء CM1 للكتل المتكرّرة ${uiParts.length} (${uiBlocks.length} كتلة)؛ ` +
      `المراحل CM2…CM${stages.length + 1}: ${stages.length}، أطولها ${Math.max(0, ...stages.map((s) => s.hours[1]))} ساعة؛ وخارج الترجمة ${keptRows.length} (${Object.entries({ "company-keeps-en": cnt("company-keeps-en"), symbols: cnt("symbols"), "ui-cm1": cnt("ui-cm1"), "ui-cm1-pattern": cnt("ui-cm1-pattern") }).map(([k, v]) => k + " " + v).join("، ")})`);
    for (const g of ["main", "marketplace", "articles", "customers"]) { const ps = parts.filter((p) => p.group === g); if (ps.length) console.log(`  ${g}: ${ps.length} جزءًا، ≈${ps.reduce((n, p) => n + p.words, 0)} كلمة`); }
    if (over.length) { console.log("✗ مراحل فوق الساعتين: " + over.map((s) => s.stage).join(" ")); return 2; }
    return 0;
  }
  console.error("الاستعمال: com-harvest.mjs list|classify|ui|chunk … (انظر رأس الملف)");
  return 2;
}

function briefSkeleton(n) {
  return `# Translator brief: claude.com bodies (claude.com and its marketplace)

Prepared by \`com-harvest.mjs chunk\` (ر17 tools) as a SKELETON. The coordinator of ر19 completes every section marked TODO before CM2 starts.
Project: «تعريب كلود (Claude) لنسخة الويب (غير رسمي)», a browser extension that shows public Claude pages in Arabic, right to left. This brief covers only the "com" domain.

## 0. What you get and what you hand back
- **Input chunk:** \`web/code/glossary/com/_blk_todo/p4/com-NNN.json\`, a JSON array of \`{fp, src}\`. ${n.parts} chunks, ${n.blocks} blocks, about ${n.words} English words, in CM order (home, single pages, product, solutions, partners, forms and indexes, then the marketplace, then articles, then customer stories).
- **Chunk map:** \`p4-manifest.json\` (pages, block and word counts, page families, \`kind\`: pages or related). **Stages:** \`stages.json\` (${n.stages} body stages, at most four chunks each).
- **Context (read it, do not translate it):** \`p4ctx/com-NNN.json\` lists every harvested block of each page of your chunk in page order with its status (TRANSLATE, chunk, kept, ui).
- **Related cards:** the marketplace chunk(s) of kind \`related\` hold the short item descriptions shown as "related" cards on many item pages; translate them once, so they read correctly on every page.
- **Shared blocks:** \`p4-shared.json\`. **Not sent to you:** \`kept-as-is.json\` (${n.kept} blocks the company keeps English, or with nothing to translate, or translated by the UI dictionary in CM1).
- **Draft / final / validator:** as for the other sites (\`_blk_batches/_draft/\`, \`_blk_batches/p4-<id>.json\`, \`node web/code/toolchain/validate-batch.mjs --mode=block <chunk> <output>\`).

## 1. Placeholders
Same contract as the other sites: translate inside \`<aN> <bN> <iN> <sN>\`; copy \`<cN>…</cN>\` and \`<gN/>\` exactly; same count, numbers, nesting and order.

## 2. What stays verbatim — TODO
Product, plan and model names; connector, plugin and agent-product names; tool names of connectors; URLs; code. TODO: complete from the ر19 harvest.

## 3. Terms and the UI dictionary — TODO
\`web/user/dictionaries/ar-com.json\` (CM1) for UI labels, with \`ar.json\` for claude.ai labels. TODO: the terms table.

## 4. Dates and numbers
Gregorian dates keep the source form: Arabic month names with Western digits (RULES §2); numeric dates unchanged.

## 5. Site notes — TODO
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error("✗ " + (e && e.stack || e)); process.exit(1); });
}
