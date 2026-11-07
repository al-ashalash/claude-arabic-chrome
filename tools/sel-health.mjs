// sel-health.mjs — صحة محدِّدات النطاق في صفحةٍ حيّة (ر29-د، ١٣ جمادى الأولى ١٤٤٨هـ — بعد ر29-أ F1).
//
// لماذا: أعاد anthropic.com بناء صفحاته القانونية فلم يطابق محدِّد المتن ولا الاتجاه ولا الإبقاء ولا حارس اللغة شيئًا، وعرضت 2.0.0 الوثائق
// الخمس فقراتٍ إنجليزية من اليمين أسبوعًا، ولم تكشفه بوابة: smoke بتجهيزٍ قديم، وفحص الاتجاه هندسي، والحاصد ينبّه ولا يُخفق. فهذه الدوالّ
// الخالصة يتقاسمها الحاصد (harvest-dom.mjs، يخرج بغير الصفر) وفحص الاتجاه (rtl-audit.mjs: صنفٌ عالٍ، ووضع ‎--selectors-only‎ بوابةً في بدء كل
// مرحلة)، ويمتحنها selftest-tools.mjs بلا كروم. لا تقرأ نصًّا من الصفحة: تعدّ ما يطابقه كل محدِّد، والرسائل بالنطاق والمفتاح والمسار وحدها.
//
// المفاتيح: bodySel (المتن) وbodyMain (حاوية المتن الرئيسة، ر29-د2) وdirSel (الاتجاه) وsiteLangSel (منتقي اللغة) وkeepSel (ما يُبقى بالإنجليزية).
// وفي مسار متن (meta.bodyRoutes):
//   - المتن وحاويته الرئيسة والاتجاه ومنتقي اللغة لازمةٌ في كل صفحة؛
//   - والإبقاء لازمٌ في النطاق لا في كل صفحة: محدِّد إبقاء وثائق المطوّرين لمرجع الواجهة البرمجية وحده (‎.stldocs-root …‎) فلا يطابق في صفحات
//     الشرح، فيُخفق إن لم يطابق في صفحةٍ واحدة من صفحات المتن المفحوصة في النطاق.
// ★ (ر29-د2، ١٤ جمادى الأولى ١٤٤٨هـ — مراجعة ر29-د F4) وbodyMain (حاوية المتن الرئيسة) مفتاحٌ لازمٌ بنفسه في كل صفحة متن: محدِّد المتن المركّب
//   يطابق بجزئه الثانوي (الرأس أو الفهرس) والحاوية التي فيها النص ساقطة، فكان يُحكم عليه جملةً فلا يسقط. وبلا الحقل في الجدول (محدِّد متنٍ من
//   جزءٍ واحد) فهو null لا يُحكم به، ومحدِّد المتن نفسه هو الحاوية.
export const SEL_KEYS = ["bodySel", "bodyMain", "dirSel", "siteLangSel", "keepSel"];
export const PAGE_KEYS = ["bodySel", "bodyMain", "dirSel", "siteLangSel"];

// ★ (ر29-د2) أجزاء محدِّدٍ في المستوى الأعلى (الفاصلة خارج الأقواس والمعقوفات والاقتباس): «‎.a, nav:has(li > a[href^='#'])‎» جزءان
export function selParts(sel) {
  const out = [];
  let depth = 0, cur = "", q = null;
  for (const ch of String(sel || "")) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ★ (ر29-د2) خلل الجدول نفسه: نطاقٌ محدِّد متنه مركّبٌ بلا bodyMain، أو bodyMain فيه جزءٌ ليس من أجزاء محدِّد المتن (الحاوية من المتن نفسه:
//   ما يحكم به الصمّام هو ما يُحصد ويُكتب فيه). يُعيد [{d, why}] — يمتحنه selftest-tools.mjs على الجدول الحقيقي
export function tableGaps(domains) {
  const out = [];
  for (const x of domains || []) {
    const m = (x && x.meta) || {}, parts = selParts(m.bodySel);
    if (!m.bodySel) continue;
    if (parts.length > 1 && !m.bodyMain) { out.push({ d: x.id, why: "مركّبٌ بلا bodyMain" }); continue; }
    if (m.bodyMain) for (const p of selParts(m.bodyMain)) if (!parts.includes(p)) out.push({ d: x.id, why: "bodyMain ليس من محدِّد المتن: " + p });
  }
  return out;
}

// مصدر تعبيرٍ يُقيَّم في الصفحة: عدد ما يطابقه كل مفتاحٍ معرَّف (‎-1‎ لمحدِّدٍ لا يُحلَّل)، وnull لمفتاحٍ غائبٍ عن الجدول
export function selProbeSrc(meta) {
  const m = meta || {}, pairs = SEL_KEYS.map((k) => [k, typeof m[k] === "string" && m[k] ? m[k] : null]);
  return "(function(){var o={};" + pairs.map(([k, s]) => s === null ? `o[${JSON.stringify(k)}]=null;`
    : `try{o[${JSON.stringify(k)}]=document.querySelectorAll(${JSON.stringify(s)}).length;}catch(e){o[${JSON.stringify(k)}]=-1;}`).join("") + "return o;})()";
}

// مسار متن: المسار كاملٌ في حارس النطاق (meta.routes) وفي مسارات المتن (meta.bodyRoutes). نطاقٌ بلا bodyRoutes لا مسار متن فيه
export function isBodyRoute(meta, pathname, routeMode) {
  const m = meta || {};
  if (!m.bodyRoutes || typeof m.bodyRoutes !== "object" || typeof routeMode !== "function") return false;
  return routeMode(m.routes, pathname) === "full" && routeMode(m.bodyRoutes, pathname) === "full";
}

// مفاتيح الصفحة الساقطة: لازمٌ معرَّفٌ عدُّه صفرٌ أو محدِّدٌ لا يُحلَّل
export function pageMisses(counts) {
  const c = counts || {};
  return PAGE_KEYS.filter((k) => c[k] !== null && c[k] !== undefined && !(c[k] > 0));
}

// الحكم على تشغيلٍ كامل: rows = [{d, page, counts}] لصفحات المتن وحدها. يُعيد قائمة الساقط [{d, key, page}] (page: المسار، أو null للإبقاء
// الساقط في النطاق كلّه) بترتيب الصفوف ثم المفاتيح
export function selVerdict(rows) {
  const out = [], keepByD = new Map();
  for (const r of rows || []) {
    for (const k of pageMisses(r.counts)) out.push({ d: r.d, key: k, page: r.page });
    const kc = r.counts ? r.counts.keepSel : null;
    if (kc === null || kc === undefined) continue;
    const prev = keepByD.get(r.d) || { hit: false, bad: false, pages: [] };
    if (kc > 0) prev.hit = true;
    if (kc < 0) prev.bad = true;
    prev.pages.push(r.page);
    keepByD.set(r.d, prev);
  }
  for (const [d, v] of keepByD) if (!v.hit || v.bad) out.push({ d, key: "keepSel", page: null, pages: v.pages.length });
  return out;
}

// سطرٌ للخلل بالنطاق والمفتاح والمسار وحدها (لا نصَّ من الصفحة)
export function missLine(x) {
  const what = { bodySel: "المتن", bodyMain: "حاوية المتن الرئيسة", dirSel: "الاتجاه", siteLangSel: "منتقي اللغة", keepSel: "الإبقاء" }[x.key] || x.key;
  return `✗ ${x.d}: ‎${x.key}‎ (${what}) لا يطابق شيئًا ` + (x.page ? `في ‎${x.page}‎` : `في صفحات المتن المفحوصة كلها (${x.pages || 0})`);
}

// ★ فقرةٌ «لاتينية» لفحص الاتجاه (rtl-audit.mjs، الصنف latin-rtl): نصٌّ إنجليزي حقيقي لا تسميةٌ قصيرة — ستّ كلماتٍ لاتينية فأكثر و30 حرفًا لاتينيًّا
// فأكثر، والعربي فيه لا شيء أو أقلّه (2٪ من اللاتيني، فالاسم العربي العارض لا يُخرجها). B = {txt, ar, la} من جامع الفحص. اسم منتجٍ أو زرٌّ
// إنجليزيٌّ في واجهةٍ مقلوبة («Claude Code») ليس منها: يُرسم في صندوقٍ من اليمين بترتيبه
export function latinPara(B) {
  if (!B || typeof B.txt !== "string") return false;
  const la = +B.la || 0, ar = +B.ar || 0;
  if (la < 30 || ar > Math.floor(la * 0.02)) return false;
  return B.txt.split(/\s+/).filter((w) => /[A-Za-z]{2}/.test(w)).length >= 6;
}

// ★ وعنصر الفقرة نفسه: وسوم الفقرات والبنود والخلايا والعناوين، وخلايا الجدول المبنيّ بعناصر div بأدوارها — لا span ولا a ولا div عامّ: تسميات
// الواجهة الإنجليزية (بندٌ في الشريط الجانبي لم يُترجم بعد) ليست متنًا. وجده أول تشغيلٍ كامل (ر29-د): تسميةٌ واحدة في الشريط الجانبي لوثائق المطوّرين
export const PARA_TAGS = new Set(["p", "li", "td", "th", "dd", "dt", "blockquote", "figcaption", "caption", "summary", "h1", "h2", "h3", "h4", "h5", "h6"]);
export function paraEl(tag, role) { return PARA_TAGS.has(String(tag || "").toLowerCase()) || /^(cell|gridcell|columnheader|rowheader|paragraph)$/.test(role || ""); }

// ★ صفحات بوابة بدء المرحلة (rtl-audit.mjs ‎--selectors-only‎): صفحتان عامتان من صفحات المتن لكل نطاقٍ مشحونٍ بمحدِّدات، تغطّيان قالبيه (في وثائق
// المطوّرين الشرحَ ومرجعَ الواجهة البرمجية، فمحدِّد الإبقاء لمرجعها). والأكاديمية بلا مسارات متن (لا صمّام فيها) ومتونها محجوزةٌ «none»، ومحدِّداتها
// تُفحص هنا كذلك في درسٍ ودورة: لا يسقط المتن والاتجاه؛ والإبقاء فيها لافتةٌ عابرة ومنتقي لغة التذييل، فهو للعلم (optional). وclaude.ai بلا محدِّدات متن
const S = "https://support.claude.com/en/", P = "https://privacy.claude.com/en/", D = "https://platform.claude.com/docs/en/";
const CC = "https://code.claude.com/docs/en/", LG = "https://www.anthropic.com/legal/", AC = "https://academy.claude.com/";
export const SEL_PAGES = [
  { d: "support", url: S + "articles/10015870-what-certifications-has-anthropic-obtained" },
  { d: "support", url: S + "articles/13930452-manage-custom-roles-on-enterprise-plans" },
  { d: "privacy", url: P + "articles/9015913-how-to-get-support" },
  { d: "privacy", url: P + "articles/10023541-what-cookies-does-anthropic-use" },
  { d: "legal", url: LG + "privacy" },
  { d: "legal", url: LG + "aup" },
  { d: "docs", url: D + "intro" },
  { d: "docs", url: D + "api/messages" },
  { d: "code", url: CC + "overview" },
  { d: "code", url: CC + "hooks" },
  { d: "academy", url: AC + "courses/claude-101/what-is-claude" },
  { d: "academy", url: AC + "courses/claude-101" },
];
