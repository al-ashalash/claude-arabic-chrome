// siwar-dump.mjs — المرحلة ٣: تفريغ قوائم الكلمات الإنجليزية والعربية لمعاجم «سوار» ذات الصلة بمتوننا،
// وقت البناء على جهاز المطوّر فقط (لا شأن للإضافة بهذا). المطابقة بعدها محلية بلا طلبٍ جديد (terms-match.mjs).
//
// لماذا التفريغ لا البحث لكل مصطلح (دراسة المعاجم §٢ج): بحث v1 لا يفهرس معجم البيانات والذكاء الاصطناعي،
// وبحث v2 بحثُ احتواءٍ يُرجع مئات المداخل (control: 844) — والتفريغ الكامل أقلّ عبئًا على المنصة وأكمل،
// ويُعاد عليه القياس لكل مرشّحاتٍ لاحقة (code.claude.com وclaude.com) بلا طلب.
//
// ما يُحفظ: الكلمة، ومعرّف مدخلها، ونوع انتمائها (lemma|translation) — لا تعريفات ولا أمثلة ولا سياقات.
// أين يُحفظ: web/code/glossary/_lexicons/ (غير متتبَّع: مادة الغير لا تُلتزم مفردةً؛ المعتمد وحده يدخل
// قاعدة المصطلحات بمعرّفاته).
//
//   node siwar-dump.mjs [--lex=legal,finance,…|--lex=all] [--force]
//   node siwar-dump.mjs --purge-expired      ← يحذف كل ما جاوز مدة الاحتفاظ من بيانات سوار المجلوبة
//
// ★ شروط منصة سوار (اتفاقية الشروط والأحكام): لا يُحتفظ ببيانات واجهاتها أكثر من ثلاثين يومًا، ويُشار إلى المعجم
// والمنصة والمجمع. فكل تفريغٍ يحمل تاريخ جلبه، وterms-match يرفض ما جاوز المدة، و‎--purge-expired‎ يحذفه: ملفات
// _lexicons/ كلها بـ‎_meta.fetched‎ (ومنها ai-pairs.json وai-diff.json)، وذاكرة _siwar-cache/ الخام بتاريخ ملفها
// (siwar-lib.mjs). والمعتمد في قاعدة المصطلحات مقابلٌ واحد بمعرّفه وإسناده (جرد المسارد الحكومية ١٤٤٨هـ، §٦ س١ —
// القرار الأخير للمالك).
// الأدب: طلبٌ واحد في كل مرة، و≥300ms بين بدايات الطلبات، وإعادة المحاولة بتأخيرٍ متصاعد؛ وقابلٌ للاستئناف.
import fs from "node:fs";
import path from "node:path";
import { LEXDIR as OUTDIR, RETENTION_DAYS, CACHE_DIR, purgeExpiredCache, isExpired } from "./siwar-lib.mjs";

const API = "https://siwar.ksaa.gov.sa/api";
const UA = { "User-Agent": "claude-mutarjim/2.0 (open-source Arabic UI; term-equivalents only, build-time)", Accept: "application/json" };
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
const FORCE = argv.includes("--force");
export { RETENTION_DAYS };
if (argv.includes("--purge-expired")) {
  let removed = 0;
  for (const f of fs.existsSync(OUTDIR) ? fs.readdirSync(OUTDIR).filter((n) => n.endsWith(".json")) : []) {
    const p = path.join(OUTDIR, f);
    let at = null;
    try { at = JSON.parse(fs.readFileSync(p, "utf8"))._meta.fetched; } catch {}
    const age = at ? (Date.now() - Date.parse(at)) / 864e5 : Infinity;
    if (age > RETENTION_DAYS) { fs.rmSync(p); removed++; console.log(`حُذف ${f} (${at || "بلا تاريخ"})`); }
  }
  // نواتج المقابلة (terms-match، siwar-terms) في glossary/_terms/ مختومةٌ بـ‎_meta.retention‎ وأقدم جلبٍ فيها؛
  // وما لم تختمه الأدوات (أحكام المراجعة مثلًا) لا يُمسّ هنا
  const TERMS_DIR = path.join(path.dirname(OUTDIR), "_terms");
  for (const f of fs.existsSync(TERMS_DIR) ? fs.readdirSync(TERMS_DIR).filter((n) => n.endsWith(".json")) : []) {
    const p = path.join(TERMS_DIR, f);
    let m = null;
    try { m = JSON.parse(fs.readFileSync(p, "utf8"))._meta; } catch {}
    if (!m || !m.retention || !m.fetched) continue;
    if (isExpired(m.fetched)) { fs.rmSync(p); removed++; console.log(`حُذف _terms/${f} (${m.fetched})`); }
  }
  console.log(`تفريغاتٌ ونواتجُ جاوزت ${RETENTION_DAYS} يومًا حُذفت: ${removed}`);
  const cached = purgeExpiredCache();
  console.log(`ملفاتٌ من ذاكرة سوار الخام (${path.basename(CACHE_DIR)}) جاوزت ${RETENTION_DAYS} يومًا حُذفت: ${cached}`);
  process.exit(0);
}

// المعاجم ذات الصلة بحسب سياسة التخصصات (§٦ والمراجعة المستقلة): الحاكمة والمُسنِدة. الموحّد بفروعه
// المسمّاة وحدها (لا فرع معلوماتية فيه، وأكثر مطابقاته من علومٍ بعيدة)؛ والخطوط الحديدية والإحصائية كاملتان
// لأن مجموعتيهما الفرعيتين الحاسوبية والاتصالية تُنتقيان بقائمة سماحٍ عند المطابقة لا هنا.
export const LEXICONS = {
  ai:          { id: "4cd164a7-7160-4de8-af5c-34382f5da657", code: "AI",  model: "v2" },
  legal:       { id: "0f465c61-2af3-46e6-9ad5-f3a3d4c0bc24", code: "LEG" },
  finance:     { id: "4264f8ae-7c51-437d-a6e4-877abad57325", code: "FIN" },
  dga:         { id: "97ac5360-d65f-425f-974f-9118f09d13a6", code: "DGA" },
  boe:         { id: "b09d4471-8198-4a82-b9f9-5fa97b140e2b", code: "LGL" },
  adaa:        { id: "7806f9cf-4bdb-4c10-b9e5-2705d8945603", code: "ADA" },
  stats:       { id: "ee392446-a5df-4b0c-b1e2-f0002b74342d", code: "STA" },
  procurement: { id: "89af196b-70be-4a4b-b193-4b761e0b0fdd", code: "CON" },
  railways:    { id: "2813060b-8eda-4c7b-8b10-1fc3255305cb", code: "RAIL" },
  media:       { id: "928f4f87-b98c-4b2d-b31d-0b45c6747644", code: "MED" },
  unified:     { id: "93ebb249-abd0-435d-b30d-0a9986f596c9", code: "UNI", branches: ["4.1.1", "4.1.2", "1.1", "1.6.1", "1.2", "2.1"] },
  riyadh:      { name: /الرياض للغة العربية المعاصرة/, code: "RIY" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastStart = 0, requests = 0;
async function call(url, init) {
  for (let t = 0; t < 5; t++) {
    const wait = lastStart + 300 - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now(); requests++;
    try {
      const r = await fetch(url, { ...init, headers: { ...UA, ...(init && init.headers) } });
      if (r.ok) return await r.json();
      if (r.status === 404) throw Object.assign(new Error("404 " + url), { fatal: true });
      await sleep(r.status === 429 ? 8000 : 1500 * (t + 1));
    } catch (e) {
      if (e.fatal) throw e;
      await sleep(1500 * (t + 1));
    }
  }
  throw new Error("تعذّر: " + url);
}
const post = (url, body) => call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function resolveId(spec) {
  if (spec.id) return spec.id;
  const all = await call(API + "/lexicons/findAll/public");
  const list = Array.isArray(all) ? all : all.lexicons || all.data || [];
  const hit = list.find((x) => spec.name.test(x.name || x.title || ""));
  if (!hit) throw new Error("لم يوجد المعجم: " + spec.name);
  return hit._id || hit.id;
}
async function screen(id) {
  return post(`${API}/screens/public/get-lexicon-search-screen-data/${id}?languageCode=ar`,
    { preferences: { filters: {}, first: 0, rows: 1, multisortmeta: [] } });
}
async function words(id, lang, synsetId) {
  const out = [];
  let total = Infinity;
  for (let first = 0; first < total; first += 1000) {
    const filters = { languageCode: [{ value: lang, matchMode: "equals", operator: "and" }] };
    if (synsetId) filters.synsetId = [{ value: [synsetId], matchMode: "in", operator: "and" }];
    const d = await post(`${API}/v2/lexicons/${id}/paginate-public-words`,
      { preferences: { first, rows: 1000, filters, multisortmeta: [] } });
    total = d.totalCount || 0;
    for (const w of d.words || []) out.push({ w: w.word, id: w.lexicalEntryId, b: w.belongsTo === "translation" ? "t" : "l" });
    if (!(d.words || []).length) break;
  }
  return out;
}
function langCodes(scr) {
  const codes = (scr.languages || []).map((l) => l.code || l.languageCode || l).filter((c) => typeof c === "string");
  return { en: codes.find((c) => /^en/i.test(c)) || null, ar: codes.find((c) => /^ar/i.test(c)) || "ar" };
}
function branchIds(scr, wanted) {
  const map = {};
  const walk = (arr) => { for (const s of arr || []) {
    const m = /^(\d+(?:\.\d+)*)/.exec(String(s.code || "").trim());
    if (m && wanted.includes(m[1])) map[m[1]] = { id: s._id || s.id, label: m[1] + " " + (s.name || "") };
    walk(s.children || s.synsets);
  } };
  walk(scr.synsets);
  return map;
}

const which = opt("lex", "all");
const keys = which === "all" ? Object.keys(LEXICONS) : which.split(",");
fs.mkdirSync(OUTDIR, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
for (const key of keys) {
  const spec = LEXICONS[key];
  if (!spec) { console.error("! مفتاحٌ مجهول: " + key); continue; }
  const file = path.join(OUTDIR, key + ".json");
  if (!FORCE && fs.existsSync(file)) { console.log(`• ${key}: موجود (--force لإعادته)`); continue; }
  const id = await resolveId(spec);
  const scr = await screen(id);
  const lex = scr.lexicon || {};
  const codes = langCodes(scr);
  const rec = {
    _meta: { key, code: spec.code, lexiconId: id, name: lex.name, model: spec.model || "v1",
      authors: (lex.authors || []).map((a) => a.name).filter(Boolean),
      sponsors: (lex.sponsors || []).map((s) => s.name).filter(Boolean),
      entries: lex.totalEntriesCount || (scr.paginated && scr.paginated.totalCount) || null,
      langs: codes, fetched: today, url: "https://siwar.ksaa.gov.sa/public-dict-information/" + id,
      note: "كلماتٌ ومعرّفات مداخلها فقط — لا تعريفات؛ من الواجهة العامة للمنصة وقت البناء. غير متتبَّع." },
  };
  if (spec.branches) {
    const br = branchIds(scr, spec.branches);
    rec.branches = {};
    for (const b of spec.branches) {
      if (!br[b]) { console.warn(`  ⚠ ${key}: الفرع ${b} غير موجود في الشاشة`); continue; }
      rec.branches[b] = { label: br[b].label, en: codes.en ? await words(id, codes.en, br[b].id) : [], ar: await words(id, codes.ar, br[b].id) };
      console.log(`  ${key} [${b}] en ${rec.branches[b].en.length} · ar ${rec.branches[b].ar.length}`);
    }
  } else {
    rec.en = codes.en ? await words(id, codes.en) : [];
    rec.ar = await words(id, codes.ar);
  }
  fs.writeFileSync(file, JSON.stringify(rec));
  const n = rec.branches ? Object.values(rec.branches).reduce((s, b) => s + b.en.length, 0) : rec.en.length;
  console.log(`✓ ${key} (${spec.code}) ${lex.name || ""}: en ${n}${rec.branches ? " في " + Object.keys(rec.branches).length + " فروع" : ""} — ${requests} طلبًا حتى الآن`);
}
console.log(`تمّ: ${requests} طلبًا → ${OUTDIR}`);
