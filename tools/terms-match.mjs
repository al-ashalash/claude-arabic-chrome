// terms-match.mjs — المرحلة ٣: مقابلة المرشّحات المصطلحية بتفريغات المعاجم محليًّا (بلا طلب)، وترتيب
// المقابلات بسياسة التخصصات (دراسة المعاجم §٦ ومراجعتها المستقلة). **ترشّح ولا تحكم**: الناتج ورقة مراجعة
// لكل مرشّح — تخصّصٌ مخمَّن، ومقابلاتٌ مرتّبة بمعرّفاتها ونوع مطابقتها — يمرّ بعدها بحكمٍ على المعنى
// يُسجَّل في قاعدة المصطلحات (sources[]).
//
//   node terms-match.mjs <candidates.json>[,<more.json>…] <out.json> [--external=<ملف JSON>[,…]] [--allow-limited]
//   node terms-match.mjs --self-test
//
// المدخلات: تفريغات siwar-dump.mjs في glossary/_lexicons/، ومعجم البيانات والذكاء الاصطناعي من
// glossary/_lexicons/ai-pairs.json (نموذج v2: المقابل في علاقة المدخل؛ يكتبه harvest-siwar.mjs)، ومسارد رسمية
// خارج سوار اختياريًّا بصيغة {_meta:{code,name,authority,url,fetched}, terms:[{en, ar, ref?}]} (glossary/_external/).
//
// ★ شروط سوار: لا احتفاظ ببيانات واجهاتها أكثر من ثلاثين يومًا. فالأداة ترفض كل تفريغٍ أو أزواجٍ جاوزت المدة
// (بـ‎_meta.fetched‎)، و`node siwar-dump.mjs --purge-expired` يحذفها من _lexicons/ (siwar-lib.mjs).
// وترفض أزواجًا من حصادٍ محدود (harvest-siwar.mjs --limit=N، مختومةً بـ_meta.limited) إلا بـ--allow-limited، وهو لوصفة
// التجربة وحدها (قائمة G2، الخطوة ٧)؛ وتُختم ورقتها حينئذٍ بـlimited في _meta.lexicons.AI.
// --self-test: فحصٌ ذاتي لقاعدة القبول والرفض على بياناتٍ مصطنعة، بلا شبكة ولا ملفات.
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY as G } from "./paths.mjs";
import { LEXDIR, RETENTION_DAYS, NOT_V1_DUMPS, loadAiPairs, aiPairsProblem, assertIgnoredOut, retentionMeta } from "./siwar-lib.mjs";

const argv = process.argv.slice(2);
const pos = argv.filter((a) => !a.startsWith("--"));
const opt = (k) => { const a = argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : null; };
const ALLOW_LIMITED = argv.includes("--allow-limited");
if (argv.includes("--self-test")) {
  const day = new Date().toISOString().slice(0, 10);
  // [الحالة، الملف، --allow-limited، المتوقع: يُرفض؟]
  const cases = [
    ["كامل", { _meta: { fetched: day } }, false, false],
    ["كامل مع الإذن", { _meta: { fetched: day } }, true, false],
    ["محدود", { _meta: { fetched: day, limited: 5, pairsEnAr: 5 } }, false, true],
    ["محدود مع الإذن", { _meta: { fetched: day, limited: 5, pairsEnAr: 5 } }, true, false],
    ["محدود (true)", { _meta: { fetched: day, limited: true } }, false, true],
    ["limited: 0", { _meta: { fetched: day, limited: 0 } }, false, false],
    ["جاوز المدة", { _meta: { fetched: "2000-01-01" } }, false, true],
    ["محدود جاوز المدة مع الإذن", { _meta: { fetched: "2000-01-01", limited: 5 } }, true, true],
    ["بلا تاريخ", { _meta: {} }, true, true],
  ];
  const bad = cases.filter(([, d, allow, refused]) => (aiPairsProblem(d, { allowLimited: allow }) !== null) !== refused);
  for (const [name, , allow, refused] of bad) console.error(`✗ ${name}${allow ? " (--allow-limited)" : ""}: المتوقع ${refused ? "الرفض" : "القبول"}`);
  console.log(bad.length ? `✗ الفحص الذاتي: أخفق ${bad.length} من ${cases.length}` : `✓ الفحص الذاتي: ${cases.length} حالات`);
  process.exit(bad.length ? 1 : 0);
}
if (pos.length < 2) { console.error("usage: node terms-match.mjs <candidates.json>[,…] <out.json> [--external=…] [--allow-limited] | --self-test"); process.exit(2); }
assertIgnoredOut(pos[1], "terms-match"); // ورقة المراجعة فيها مقابلات سوار: لا تُكتب إلا في موضعٍ يتجاهله git (glossary/_terms/)

// ---------- التطبيع (§٢د + حيل المراجعة ج-٣) ----------
function base(s) {
  return String(s || "").toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim()
    .replace(/^(the|a|an|to) /, "");
}
// مفاتيح الكلمة الإنجليزية: البدائل مفصولة، وما بين الأقواس قيدٌ يُحذف من المفتاح، والشرطة مسافةً ومحذوفةً،
// والجمع البسيط مطويًّا
function keysOf(s) {
  const out = new Set();
  const noParen = String(s || "").replace(/\([^)]*\)/g, " ");
  for (const alt of noParen.split(/[;|,،/]/)) {
    const b = base(alt).replace(/[^a-z0-9' -]+/g, " ").replace(/\s+/g, " ").trim();
    if (!b) continue;
    for (const v of [b.replace(/-/g, " ").replace(/\s+/g, " "), b.replace(/-/g, "")]) {
      out.add(v);
      const sg = singular(v);
      if (sg) out.add(sg);
    }
  }
  return out;
}
function singular(k) {
  const w = k.split(" "), last = w[w.length - 1];
  let s = null;
  if (/ies$/.test(last) && last.length > 4) s = last.slice(0, -3) + "y";
  else if (/(sses|xes|ches|shes)$/.test(last)) s = last.slice(0, -2);
  else if (/s$/.test(last) && !/(ss|us|is)$/.test(last) && last.length > 3) s = last.slice(0, -1);
  return s ? w.slice(0, -1).concat(s).join(" ") : null;
}
// جدول اختصاراتٍ منتقًى بيدٍ (لا فهرسة عمياء): الاختصار ⇒ صيغته الكاملة كما ترد في المعاجم
const ABBR = {
  dns: "domain name system", url: "uniform resource locator", ip: "internet protocol", "ip address": "internet protocol address",
  http: "hypertext transfer protocol", https: "hypertext transfer protocol secure", tcp: "transmission control protocol",
  api: "application programming interface", sdk: "software development kit", cli: "command line interface",
  gui: "graphical user interface", ui: "user interface", sso: "single sign on", mfa: "multi factor authentication",
  "2fa": "two factor authentication", vpn: "virtual private network", lan: "local area network", wan: "wide area network",
  faq: "frequently asked questions", kpi: "key performance indicator", sla: "service level agreement",
  pii: "personally identifiable information", gdpr: "general data protection regulation", ocr: "optical character recognition",
  llm: "large language model", ai: "artificial intelligence", ml: "machine learning", nlp: "natural language processing",
  rag: "retrieval augmented generation", csv: "comma separated values", pdf: "portable document format",
  saml: "security assertion markup language", scim: "system for cross domain identity management",
};

// ---------- الفهرس ----------
const index = new Map(); // key → [prop]
function add(k, prop) { if (!index.has(k)) index.set(k, []); const l = index.get(k); if (!l.some((x) => x.code === prop.code && x.entry === prop.entry && x.branch === prop.branch)) l.push(prop); }
const lexMeta = {};
// شروط سوار: لا احتفاظ ببيانات الواجهات أكثر من ثلاثين يومًا — التفريغ الأقدم لا يُستعمل (يُعاد بـsiwar-dump)
const expired = [];
function loadV1(file) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const m = d._meta;
  if (m.model && m.model !== "v1") return; // أزواجٌ أو فروقٌ لا تفريغ كلمات (pairs-<id>.json من harvest-siwar مثلًا)
  const age = m.fetched ? (Date.now() - Date.parse(m.fetched)) / 864e5 : Infinity;
  if (age > RETENTION_DAYS) { expired.push(`${m.code} (${m.fetched || "بلا تاريخ"})`); return; }
  lexMeta[m.code] = m;
  const groups = d.branches ? Object.entries(d.branches).map(([b, g]) => [b, g]) : [[null, d]];
  for (const [branch, g] of groups) {
    const ar = new Map();
    for (const w of g.ar || []) if (w.b === "l") { if (!ar.has(w.id)) ar.set(w.id, []); ar.get(w.id).push(w.w); }
    for (const w of g.en || []) {
      const lem = ar.get(w.id);
      if (!lem) continue; // كلمةٌ إنجليزية بلا رأسٍ عربي في القائمة (مدخلٌ غير منشور بالعربية)
      const prop = { code: m.code, lexiconId: m.lexiconId, entry: w.id, en: w.w, ar: [...new Set(lem)], branch };
      for (const k of keysOf(w.w)) add(k, prop);
    }
  }
}
for (const f of fs.existsSync(LEXDIR) ? fs.readdirSync(LEXDIR) : []) {
  if (!f.endsWith(".json") || NOT_V1_DUMPS.has(f)) continue; // معجم البيانات والذكاء الاصطناعي (v2) من ai-pairs.json أدناه
  loadV1(path.join(LEXDIR, f));
}
{
  const ai = loadAiPairs("terms-match", { allowLimited: ALLOW_LIMITED }); // يخرج برسالةٍ إن غاب أو جاوز ثلاثين يومًا أو كان محدودًا بلا إذن
  lexMeta.AI = { code: "AI", lexiconId: ai._meta.lexiconId, name: ai._meta.lexicon, authors: ai._meta.publishers || ai._meta.authors, fetched: ai._meta.fetched, model: "v2",
    ...(ai._meta.limited ? { limited: ai._meta.limited } : {}) };
  for (const t of ai.terms) {
    const prop = { code: "AI", lexiconId: ai._meta.lexiconId, entry: t.id, en: t.en, ar: [t.ar], branch: null };
    for (const k of keysOf(t.en)) add(k, prop);
  }
}
for (const f of (opt("external") || "").split(",").filter(Boolean)) {
  const x = JSON.parse(fs.readFileSync(f, "utf8"));
  const m = x._meta; lexMeta[m.code] = { ...m, external: true };
  for (const t of x.terms) {
    const prop = { code: m.code, lexiconId: null, entry: t.ref || null, en: t.en, ar: [t.ar], branch: null, external: true };
    for (const k of keysOf(t.en)) add(k, prop);
  }
}

// ---------- التخصص (تخمينٌ ببذورٍ لترتيب المقترحات؛ الحكم يصحّحه) ----------
const SEEDS = [
  ["ai", /\b(model|prompt|token|context window|agent|agentic|embedding|inference|training|fine[- ]?tun|llm|machine learning|neural|hallucinat|reasoning|thinking|artificial intelligence|classifier|evaluation|eval|completion|tool use|tool call|batch|cach)/],
  ["security", /\b(security|secure|encrypt|authenticat|password|vulnerab|attack|malware|phishing|breach|threat|firewall|incident|penetration|jailbreak|abuse|misuse|safeguard)/],
  // الخصوصية منفصلةً عن القانون (جرد المسارد الحكومية §٤ج-٢): يحكمها نظام حماية البيانات الشخصية لا المعجم القانوني
  ["privacy", /\b(privacy|personal (data|information)|data subject|consent|controller|processor|retention|deletion|anonymi|pseudonymi|de-?identif|sensitive (data|personal)|cookie)/],
  ["legal", /\b(law|legal|regulat|terms of|agreement|contract|rights?|subpoena|jurisdiction|liabilit|compliance|dpa|baa|copyright|license)/],
  ["finance", /\b(billing|invoice|payment|pric|tax|vat|credit|subscription|refund|charge|fee|cost|spend|purchase|seat|discount|currency|budget)/],
  ["identity", /\b(account|log ?in|sign ?in|sign ?up|sso|identity|role|permission|access|member|organization|workspace|admin|owner|invite|domain capture|provision)/],
  ["network", /\b(network|server|domain|dns|ip address|url|http|proxy|bandwidth|connection|connect|browser|internet|web|sync|latency|endpoint|request|webhook)/],
  ["stats", /\b(analytics|metric|statistic|dashboard|report|sample|rate|average|percent|usage data|benchmark|indicator)/],
  ["software", /\b(code|api|sdk|file|library|package|function|variable|command|terminal|repositor|deploy|build|install|version|integration|plugin|extension|app|application|software|developer|debug|error|log|script|project|artifact|mcp|server|schema|json|parameter|header|response)/],
  ["education", /\b(education|student|universit|course|learn|teacher|school)/],
];
function specialtyOf(en) { for (const [id, re] of SEEDS) if (re.test(en)) return id; return "general"; }
// ترتيب المعاجم لكل تخصص (§٦ معدَّلًا بالمراجعة: لائحة الأمن السيبراني NCA حاكمة في الأمن، والمجموعات
// الفرعية من الخطوط الحديدية والإحصائية مُسنِدةٌ للشبكات والبرمجيات لا مستبعدة)، ثم بسياسة الأولوية في جرد
// المسارد الحكومية (§٤ب) للمسارد الرسمية خارج سوار (glossary/_external/):
//   CST هيئة الاتصالات والفضاء والتقنية · PDPL نظام حماية البيانات الشخصية ولائحتاه · NDMO ضوابط مكتب إدارة البيانات
//   SAMA البنك المركزي (المدفوعات والأمن السيبراني) · ZATCA معجم زاتكا ١٤٤٨هـ · GASTAT معجم الهيئة العامة للإحصاء
//   DGA3 قاموس الحكومة الرقمية ٣٫٠، ويسبق DGA (نسخة سوار الأقدم) أينما وردت: الأحدث من الجهة نفسها أولًا (ق٣)
// وقواعد ثابتة: المصدر غير السعودي لا يتقدّم مصدرًا سعوديًّا (قرار المالك: مساندٌ لا حاكم) — وهو هنا UNI (مكتب تنسيق
// التعريب) فيأتي آخرًا؛ والحاكم بالاختصاص الفرعي (المال: المالية/الضريبة/المدفوعات، والإحصاء: البيانات/التحليلات/
// المؤشرات) يبقى أوله القائم وتليه الجهات الحاكمة الجديدة؛ ومسرد الجهة على موقعها يسبق نسخته على سوار (ق٥ج).
const ORDER = {
  ai:        ["AI", "DGA3", "RIY", "UNI:1.1|4.1.1"],
  software:  ["CST", "AI", "DGA3", "DGA", "RAIL", "RIY", "UNI:4.1.1|1.1"],
  security:  ["NCA", "SAMA", "FIN", "DGA3", "DGA", "LEG", "AI", "CST", "RIY", "UNI:4.1.1"],
  privacy:   ["PDPL", "LEG", "NDMO", "CST", "DGA3", "DGA", "AI", "RIY", "UNI:1.6.1"],
  stats:     ["AI", "ADA", "GASTAT", "STA", "NDMO", "RIY", "UNI:2.1|4.1.1"],
  legal:     ["LEG", "LGL", "MOJ", "AI", "RIY", "UNI:1.6.1"],
  finance:   ["FIN", "ZATCA", "SAMA", "LEG", "CST", "GASTAT", "CON", "RIY", "UNI:1.6.1|4.1.1"],
  network:   ["CST", "GASTAT", "NCA", "DGA3", "DGA", "RAIL", "STA", "RIY", "UNI:4.1.1"],
  identity:  ["DGA3", "DGA", "NCA", "SAMA", "FIN", "LEG", "AI", "RIY", "UNI:1.6.1|4.1.1"],
  general:   ["RIY", "MED", "UNI:4.1.1|4.1.2"],
  education: ["RIY", "UNI:1.2|1.1"],
};
function rankOf(spec, p) {
  const order = ORDER[spec] || ORDER.general;
  for (let i = 0; i < order.length; i++) {
    const [code, br] = order[i].split(":");
    if (code !== p.code) continue;
    if (br && !br.split("|").includes(p.branch)) continue;
    return i;
  }
  return null; // خارج ترتيب التخصص: يُعرض بديلًا لا مقترحًا
}

// ---------- المطابقة ----------
const cands = [];
for (const f of pos[0].split(",")) for (const c of JSON.parse(fs.readFileSync(f, "utf8"))) cands.push(c);
const seen = new Map();
for (const c of cands) { const k = base(c.en); if (!seen.has(k)) seen.set(k, c); else { const s = seen.get(k); s.n += c.n; } }
const terms = JSON.parse(fs.readFileSync(path.join(G, "terms-base.json"), "utf8")).terms;
const inBase = new Map(terms.map((t) => [base(t.en), t]));
const GOVERNING = new Set(["AI", "LEG", "FIN", "DGA", "NCA", "LGL", "MOJ"]);
if (expired.length) {
  console.error(`✗ تفريغاتٌ جاوزت ${RETENTION_DAYS} يومًا (شروط سوار) لم تُستعمل: ${expired.join("، ")} — أعد التفريغ بـsiwar-dump.mjs --force ثم احذف القديم بـ--purge-expired`);
  process.exit(1);
}
const out = [];
for (const c of seen.values()) {
  const spec = specialtyOf(c.en);
  const found = [];
  const push = (list, type) => { for (const p of list || []) if (!found.some((x) => x.code === p.code && x.entry === p.entry && x.branch === p.branch)) found.push({ ...p, type }); };
  for (const k of keysOf(c.en)) push(index.get(k), "exact");
  if (c.plural) for (const k of keysOf(c.plural)) push(index.get(k), "exact");
  const ab = ABBR[base(c.en)];
  if (ab) push(index.get(ab), "abbr");
  // مطابقة الرأس بعد حذف قيدٍ شائع (data controller ⇐ Controller) — في المعاجم الحاكمة وحدها
  const w = base(c.en).split(" ");
  if (w.length > 1) for (const p of index.get(w.slice(1).join(" ")) || []) if (GOVERNING.has(p.code)) push([p], "head");
  const ranked = found.map((p) => ({ ...p, rank: rankOf(spec, p) }))
    .sort((a, b) => (a.rank === null) - (b.rank === null) || (a.rank || 0) - (b.rank || 0) ||
      (a.type === "exact" ? 0 : 1) - (b.type === "exact" ? 0 : 1));
  out.push({
    en: c.en, plural: c.plural, n: c.n, pages: c.pages, dom: c.dom, specialty: spec,
    base: inBase.has(base(c.en)) ? { ar: inBase.get(base(c.en)).ar, decision: inBase.get(base(c.en)).decision } : undefined,
    ui: c.ui && c.ui.length ? c.ui : undefined, ctx: c.ctx,
    proposals: ranked.filter((p) => p.rank !== null).slice(0, 6),
    alternatives: ranked.filter((p) => p.rank === null).slice(0, 4),
  });
}
out.sort((a, b) => b.n - a.n);
const total = out.reduce((s, x) => s + x.n, 0);
let acc = 0; const cut = {};
out.forEach((x, i) => { acc += x.n; for (const p of [50, 70, 80, 90]) if (!cut[p] && acc >= total * p / 100) cut[p] = i + 1; });
const withProp = out.filter((x) => x.proposals.length).length;
const perLex = {}; for (const x of out) for (const p of x.proposals) perLex[p.code] = (perLex[p.code] || 0) + 1;
const perSpec = {}; for (const x of out) { const s = perSpec[x.specialty] || (perSpec[x.specialty] = { n: 0, withProposal: 0 }); s.n++; if (x.proposals.length) s.withProposal++; }
// ‎_meta.fetched‎ = أقدم تفريغٍ من سوار دخل الورقة، فيحذفها siwar-dump.mjs --purge-expired بعد المدة
const siwarFetched = Object.values(lexMeta).filter((m) => !m.external).map((m) => m.fetched);
fs.writeFileSync(pos[1], JSON.stringify({ _meta: { made: new Date().toISOString().slice(0, 10), ...retentionMeta(siwarFetched), candidates: out.length, withProposal: withProp,
  occurrenceCut: cut, perLexicon: perLex, perSpecialty: perSpec, lexicons: lexMeta, order: ORDER,
  note: "مقترحاتٌ للمراجعة لا قرارات: المطابقة ترشّح ولا تحكم (دراسة المعاجم §٥)" }, terms: out }, null, 1));
console.log(`مرشّحات: ${out.length} | لها مقترحٌ في ترتيب تخصّصها: ${withProp} (${(100 * withProp / out.length).toFixed(1)}%)`);
console.log(`المراجعة بالأعلى تكرارًا: 50% من الورود في ${cut[50]}، و70% في ${cut[70]}، و80% في ${cut[80]}، و90% في ${cut[90]}`);
console.log("لكل معجم: " + Object.entries(perLex).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(" | "));
console.log("لكل تخصص: " + Object.entries(perSpec).map(([k, v]) => `${k} ${v.withProposal}/${v.n}`).join(" | "));
