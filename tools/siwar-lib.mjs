// siwar-lib.mjs — ما تشترك فيه أدوات «سوار»: مدة الاحتفاظ، ومواضع البيانات المجلوبة، وتحميل أزواج
// معجم البيانات والذكاء الاصطناعي مع رفض ما جاوز المدة.
//
// ★ شروط منصة سوار (اتفاقية الشروط والأحكام): لا يُحتفظ ببيانات واجهاتها أكثر من ثلاثين يومًا، ويُشار إلى
// المعجم والمنصة والمجمع. فكل ما يُجلب منها يعيش في موضعين غير متتبَّعين وحدهما:
//   glossary/_lexicons/*.json   بتاريخ جلبه في ‎_meta.fetched‎ (تفريغات siwar-dump، وai-pairs.json، وai-diff.json)
//   glossary/_siwar-cache/…     ذاكرة الطلبات الخام، وتاريخها تاريخ ملفها
// و`node siwar-dump.mjs --purge-expired` يحذف منهما ما جاوز المدة، والأدوات ترفض استعماله قبل ذلك.
// ولا يُلتزم في المستودع من سوار إلا المقابل المعتمد بمعرّف مدخله وإسناده في terms-base.json — القاعدة في آخر الملف
// (publishableBase وproseViolations، والمقابلات المعتمدة في glossary/adopted-renderings.json)، وterms-publish.mjs
// يكتب القاعدة عبرها، وterm-check.mjs وverify-package.mjs وحارس pre-commit (.githooks/pre-commit) تفشل على كل مخالفة.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { GLOSSARY } from "./paths.mjs";

export const RETENTION_DAYS = 30;
export const LEXDIR = path.join(GLOSSARY, "_lexicons");
export const CACHE_DIR = path.join(GLOSSARY, "_siwar-cache");
export const AI_LEXICON_ID = "4cd164a7-7160-4de8-af5c-34382f5da657";
// أزواج (en → ar) معجم البيانات والذكاء الاصطناعي: نموذجه v2 (المقابل في علاقة المدخل) فلا يكفيه تفريغ الكلمات
export const AI_PAIRS = path.join(LEXDIR, "ai-pairs.json");
// ملفات _lexicons التي ليست تفريغ كلماتٍ بنموذج v1 (لا يقرؤها terms-match على أنها معاجم)
export const NOT_V1_DUMPS = new Set(["ai.json", "ai-pairs.json", "ai-diff.json"]);
export const ATTRIBUTION = {
  platform: "منصة سوار — https://siwar.ksaa.gov.sa",
  academy: "مجمع الملك سلمان العالمي للغة العربية",
};

// علّةٌ في بيانات المنصة: «Engineering» تظهر «eng-English      ineering» في بعض المداخل
export const fixLemma = (s) => String(s || "").replace(/eng-English\s+ineering/g, "Engineering").replace(/\s+/g, " ").trim();

const day = (ms) => new Date(ms).toISOString().slice(0, 10);
export const today = () => day(Date.now());
export function ageDays(fetched) {
  const t = Date.parse(fetched);
  return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity;
}
export const isExpired = (fetched) => ageDays(fetched) > RETENTION_DAYS;
// تاريخ جلب ذاكرةٍ خام = أقدم ملفٍ فيها (يوم UTC، كما تكتب الأدوات ‎_meta.fetched‎)
export const fileDay = (file) => day(fs.statSync(file).mtimeMs);

function die(msg) { console.error(msg); process.exit(1); }
const rel = (p) => path.relative(GLOSSARY, p).replace(/\\/g, "/");

// أزواجٌ من حصادٍ محدود (harvest-siwar.mjs --limit=N يختمها _meta.limited = N) عيّنةُ تجربةٍ لا معجم: لو قرأتها أداةٌ على أنها
// المعجم لبدا كل مصطلحٍ غائبٍ عنها غائبًا عن المعجم. فترفضها القارئات (terms-match وsiwar-terms وsiwar-diff) إلا بإذنٍ صريح
// --allow-limited في سطر الأمر، تمرّره القارئة في opts.allowLimited؛ ولا يمرّره إلا وصفةُ التجربة (قائمة G2، الخطوة ٧).
export const isLimitedPairs = (d) => Boolean(d && d._meta && d._meta.limited);
// سبب رفض ملف الأزواج، أو null إن صلح للاستعمال — دالةٌ صرفة يفحصها terms-match.mjs --self-test بلا شبكة ولا ملفات
export function aiPairsProblem(d, { allowLimited = false } = {}) {
  const m = (d && d._meta) || {};
  if (isExpired(m.fetched)) {
    return `جُلبت ${m.fetched || "بلا تاريخ"} وجاوزت ${RETENTION_DAYS} يومًا (شروط سوار) فلم تُستعمل — ` +
      `أعد الحصاد بـharvest-siwar.mjs ثم احذف القديم بـsiwar-dump.mjs --purge-expired`;
  }
  if (isLimitedPairs(d) && !allowLimited) {
    return `حصادٌ محدود (--limit=${m.limited}، ${m.pairsEnAr ?? "?"} زوجًا من ${m.totalEntries ?? "?"} مدخلًا) عيّنةُ تجربةٍ لا معجم، فلم تُستعمل — ` +
      `للدورة الحقيقية احصد المعجم كاملًا بـharvest-siwar.mjs بلا --limit، وللتجربة وحدها أضف --allow-limited`;
  }
  return null;
}
// يحمّل ai-pairs.json أو يخرج برسالةٍ واضحة: غائبٌ ⇒ كيف يُحصد، وجاوز المدة ⇒ لا يُستعمل، ومحدودٌ بلا إذن ⇒ لا يُستعمل
export function loadAiPairs(tool, { allowLimited = false } = {}) {
  if (!fs.existsSync(AI_PAIRS)) {
    die(`✗ ${tool}: لا أزواج لمعجم البيانات والذكاء الاصطناعي في glossary/${rel(AI_PAIRS)} — احصدها بـharvest-siwar.mjs`);
  }
  const d = JSON.parse(fs.readFileSync(AI_PAIRS, "utf8"));
  const why = aiPairsProblem(d, { allowLimited });
  if (why) die(`✗ ${tool}: أزواج معجم البيانات والذكاء الاصطناعي (glossary/${rel(AI_PAIRS)}) ${why}`);
  if (isLimitedPairs(d)) {
    console.error(`ℹ ${tool}: أزواجٌ من حصادٍ محدود (--limit=${d._meta.limited}) بإذن --allow-limited: للتجربة وحدها، ولا يُعتمد منها شيء`);
  }
  return d;
}

// يحذف من ذاكرة سوار الخام ما جاوز المدة (بتاريخ الملف) والمجلدات التي فرغت؛ يُرجع عدد المحذوف
export function purgeExpiredCache(dir = CACHE_DIR) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      removed += purgeExpiredCache(p);
      if (!fs.readdirSync(p).length) fs.rmdirSync(p);
    } else if (isExpired(fileDay(p))) { fs.rmSync(p); removed++; }
  }
  return removed;
}

// ---------- قاعدة الالتزام: ما يُحفظ من سوار في قاعدة المصطلحات ----------
// يُحفظ من سوار المقابلُ المعتمد بمعرّف مدخله وإسناده، ولا شيء سواه. والمصدرُ من سوار: ما له lexiconId، أو رمزُه رمزُ
// معجمٍ من نوع siwar في ‎_meta.sources‎، أو له entry بصيغة معرّف مدخل (UUID أو بادئته الثمانية) تحت أي رمز، أو في url
// رابطٌ إلى منصة سوار.
// والمقابلات المعتمدة لمصطلحٍ (adoptedRenderings): بدائلُ مقابله (ar مقسومًا على «/» و«،» و« أو »)، والصيغُ المراجَعة
// له، والمقابلاتُ المراجَعة التي اعتمدها المشروع (قرار المالك، أو ما تنصّ عليه الملاحظة لمعنى، أو ما تقبله صراحةً،
// أو عرف الواجهة، أو المصدر الحاكم لقرار adopt) — والقائمتان في glossary/adopted-renderings.json.
// ويبقى زوج المصدر en/ar في حالين:
//   ١) ar بعد الطيّ (foldAr) مقابلٌ معتمد للمصطلح نفسه، أو صيغةٌ مراجَعة مدرَجة لهذا المصدر بعينه (term وcode وentry)؛
//   ٢) زوجٌ معتمد لمصطلحٍ آخر: en المصدر هو en مصطلحٍ آخر في القاعدة (بلا اعتبارٍ لحالة الأحرف والمسافات، أو بعد
//      تطبيعٍ خفيف: حذف ما بين القوسين، و"to " في أوله، والبدائل المفصولة بـ";" أو "/"، والشرطة، وs الجمع) وar مقابلٌ
//      معتمد لذلك المصطلح؛ أو الزوج نفسه (code وentry وen وar) باقٍ تحت مصطلحٍ آخر في القاعدة.
// إلا مدخلًا مدرَجًا في id_only (مدخلٌ يوافق لفظُه مقابلًا معتمدًا بعد الطيّ لكن الملاحظة تجعله لمعنى آخر): يُحفظ بمعرّفه.
// وما سواهما يُحفظ بمعرّفه وإسناده وحدهما: تُحذف en وar وsense، ويبقى code وlexiconId وentry وbranch وrole وfetched
// وadopted وref وurl وvia. والكتلة القديمة siwar {ar, id, edition} تبقى ar فيها إن كان مقابلًا معتمدًا للمصطلح، وksaa
// بلا page إن ساوى siwar.ar فهو من بيانات المنصة فيُحذف، وksaa ذات page من الطبعة المطبوعة (2022) فتبقى.
// الطيّ: normAr (NFC، وحذف التشكيل وعلامات المصحف والألف الخنجرية والتطويل وعلامات الاتجاه والعرض الصفري، وطيّ
// المسافات)، ثم نزع «ال» من أول كل كلمةٍ من أربعة أحرفٍ فأكثر، ثم توحيد: أ إ آ ٱ ← ا، ى ← ي، ة ← ه، ؤ ← و، ئ ← ي.
export const SIWAR_CODES = new Set(["ADA", "AI", "CON", "DGA", "FIN", "LEG", "LGL", "MED", "RAIL", "RIY", "STA", "UNI"]);
const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ​-‏‪-‮⁦-⁩؜﻿]/g;
const WS = "\\t\\n\\v\\f\\r \\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const WS_RUN = new RegExp(`[${WS}]+`, "g");
const WS_EDGE = new RegExp(`^[${WS}]+|[${WS}]+$`, "g");
export const normAr = (s) => String(s ?? "").normalize("NFC").replace(AR_MARKS, "").replace(WS_RUN, " ").replace(WS_EDGE, "");
const UNIFY = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي" };
export function foldAr(s) {
  return normAr(s).split(" ").map((w) => (w.startsWith("ال") && [...w].length >= 4 ? w.slice(2) : w)).join(" ")
    .replace(/[أإآٱىةؤئ]/g, (c) => UNIFY[c]);
}
const ALT = new RegExp(`[${WS}]*/[${WS}]*|[${WS}]*،[${WS}]*|[${WS}]+أو[${WS}]+`);
export const headwordAlts = (ar) => String(ar ?? "").split(ALT).map((x) => x.replace(WS_EDGE, "")).filter(Boolean);
// رموز معاجم سوار كما تعلنها القاعدة نفسها (‎_meta.sources[code].kind === "siwar"‎)، وإلا القائمة الثابتة
export function siwarCodes(base) {
  const meta = (base && base._meta && base._meta.sources) || {};
  const own = Object.entries(meta).filter(([, v]) => v && typeof v === "object" && v.kind === "siwar").map(([k]) => k);
  return own.length ? new Set(own) : SIWAR_CODES;
}
const ENTRY_ID = /^[0-9a-f]{8}(-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/;
export const isSiwarSource = (s, codes = SIWAR_CODES) => !!s && typeof s === "object" && !Array.isArray(s) &&
  ("lexiconId" in s || codes.has(s.code) || (typeof s.entry === "string" && ENTRY_ID.test(s.entry)) ||
   (typeof s.url === "string" && /(^|\/\/|\.)siwar\.ksaa\.gov\.sa/i.test(s.url)));

// قائمة المقابلات المعتمدة (glossary/adopted-renderings.json):
//   renderings [{ term, rendering, class, entry? }] و inflections [{ term, code, entry, form }]: المقابلات المعتمدة؛
//   id_only [{ term, code, entry }]: مداخل تُحفظ بمعرّفها وحده وإن وافق لفظها مقابلًا معتمدًا بعد الطيّ (معنًى آخر)؛
//   homographs [{ term, key }]: ألفاظٌ من سوار توافق بعد الطيّ مقابلًا معتمدًا للمصطلح لكنها لمعنًى آخر، فلا تُنسب إلى
//   المعجم في نصّ المصطلح (key بصمة shapeKey: اللفظ بهيئته وشدّته)؛
//   reviewed_prose [{ term, field, quote, reason }]: اقتباساتٌ في note/why راجعها المشروع وأبقاها (quote بصمةٌ لا نصّ)؛
//   non_adopted [بصمة]: صياغاتٌ من سوار راجعها المشروع لمصطلحاتها ولم يعتمدها (بصمة wordingKey(المصطلح، الصياغة))؛
//   known_occurrences [{ term, field, key, count, reason }]: مواضع راجعها المشروع يرد فيها لفظٌ من non_adopted في نصّ
//   المصطلح نفسه بغير إسنادٍ إلى سوار (شرح معنى، أو لفظ الواجهة، أو مصدرٌ من غير سوار)، وcount عددها المراجَع.
export const ADOPTED = path.join(GLOSSARY, "adopted-renderings.json");
export function loadAdopted(file = ADOPTED) {
  const out = { renderings: new Map(), inflections: new Map(), reviewedProse: new Set(), idOnly: new Set(), homographs: new Set(), nonAdopted: new Set(), known: new Map() };
  if (!file || !fs.existsSync(file)) return out;
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const e of d.renderings || []) {
    if (e.class === "same-pair-kept") continue; // يبقى زوجه لأنه باقٍ بعينه تحت مصطلحٍ آخر (الحال ٢)، لا مقابلًا عامًّا
    if (!out.renderings.has(e.term)) out.renderings.set(e.term, new Set());
    out.renderings.get(e.term).add(foldAr(e.rendering));
  }
  for (const e of d.inflections || []) out.inflections.set(`${e.term}|${e.code}|${e.entry}`, e);
  for (const e of d.reviewed_prose || []) out.reviewedProse.add(`${e.term}|${e.field}|${e.quote}`);
  for (const e of d.id_only || []) out.idOnly.add(`${e.term}|${e.code}|${e.entry}`);
  for (const e of d.homographs || []) out.homographs.add(`${e.term}|${e.key}`);
  for (const k of d.non_adopted || []) out.nonAdopted.add(k);
  for (const e of d.known_occurrences || []) out.known.set(`${e.term}|${e.field}|${e.key}`, e.count);
  return out;
}
const sha16 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
export const quoteKey = (term, field, quote) => sha16(`${term}\u0001${field}\u0001${foldAr(quote)}`);
// بصمة صياغةٍ مطويّة مرّةً واحدة (والطيّ لا يُعاد على المطويّ، فلا تُنزع «ال» مرّتين من كلمةٍ واحدة)
const foldedKey = (term, folded) => sha16(`${term}\u0001${folded}`);
export const wordingKey = (term, wording) => foldedKey(term, foldAr(wording));
// بصمة اللفظ بهيئته (بالشدّة، بلا سائر الحركات، وبلا حذف «ال»): تفرّق المشدَّد من المخفَّف، والاسمَ المعرَّف من الفعل
const shapeAr = (s) => String(s ?? "").normalize("NFC")
  .replace(/[ؐ-ًؚ-ِْ-ٰٟۖ-ۭـ​-‏‪-‮⁦-⁩؜﻿]/g, "")
  .replace(WS_RUN, " ").replace(WS_EDGE, "");
export const shapeKey = (term, wording) => sha16(`${term}\u0002${shapeAr(wording)}`);
// المقابلات المعتمدة لكل مصطلحٍ في القاعدة: Map(en → Set(foldAr))
export function adoptedRenderings(base, adopted = loadAdopted()) {
  const m = new Map();
  const add = (t, w) => { const f = foldAr(w); if (!f) return; if (!m.has(t)) m.set(t, new Set()); m.get(t).add(f); };
  for (const t of base.terms || []) for (const a of headwordAlts(t.ar)) add(t.en, a);
  for (const e of adopted.inflections.values()) add(e.term, e.form);
  for (const [t, fs_] of adopted.renderings) for (const f of fs_) { if (!m.has(t)) m.set(t, new Set()); m.get(t).add(f); }
  return m;
}
const lowerEn = (s) => String(s ?? "").toLowerCase();
const enExact = (s) => lowerEn(String(s ?? "").replace(WS_EDGE, "")).replace(WS_RUN, " ");
export function enKeys(s) {
  const out = [enExact(s)];
  for (const part of lowerEn(s).replace(/\([^)]*\)/g, " ").split(new RegExp(`[${WS}]*[;/][${WS}]*`))) {
    const p = part.replace(new RegExp(`^[${WS}]*to[${WS}]+`), "").replace(WS_RUN, " ").replace(/^[ .,]+|[ .,]+$/g, "");
    if (!p) continue;
    out.push(p, p.replace(/-/g, ""));
    if (p.endsWith("s")) out.push(p.slice(0, -1));
  }
  return out;
}
// قرار كل مصدرٍ من سوار في القاعدة: [{ t, s, kind: "source"|"siwar", keep, why }]
export function siwarDecisions(base, adopted = loadAdopted()) {
  const codes = siwarCodes(base);
  const A = adoptedRenderings(base, adopted);
  const byEn = new Map();
  for (const t of base.terms || []) { const k = enExact(t.en); if (!byEn.has(k)) byEn.set(k, []); byEn.get(k).push(t.en); }
  const rows = [];
  for (const t of base.terms || []) {
    for (const s of Array.isArray(t.sources) ? t.sources : []) {
      if (!isSiwarSource(s, codes) || !("en" in s || "ar" in s)) continue;
      rows.push({ t, s, kind: "source", en: s.en, ar: s.ar, code: s.code, entry: s.entry });
    }
    if (t.siwar && typeof t.siwar === "object" && "ar" in t.siwar) rows.push({ t, s: t.siwar, kind: "siwar", en: t.en, ar: t.siwar.ar });
  }
  for (const r of rows) {
    const f = foldAr(r.ar);
    const own = A.get(r.t.en) || new Set();
    const infl = r.kind === "source" && adopted.inflections.get(`${r.t.en}|${r.code}|${r.entry}`);
    if (r.kind === "source" && adopted.idOnly.has(`${r.t.en}|${r.code}|${r.entry}`)) { r.keep = false; r.why = "id-only (reviewed)"; }
    else if (own.has(f)) { r.keep = true; r.why = "adopted"; }
    else if (infl && foldAr(infl.form) === f) { r.keep = true; r.why = "inflection"; }
    else r.keep = null;
  }
  for (let changed = true; changed;) {
    changed = false;
    const kept = new Map();
    for (const r of rows) if (r.keep && r.kind === "source") kept.set(JSON.stringify([r.code, r.entry, r.en, r.ar]), r.t.en);
    for (const r of rows) {
      if (r.keep !== null) continue;
      if (r.kind === "source") {
        const f = foldAr(r.ar);
        const other = enKeys(r.en).some((k) => (byEn.get(k) || []).some((u) => u !== r.t.en && (A.get(u) || new Set()).has(f)));
        const same = kept.get(JSON.stringify([r.code, r.entry, r.en, r.ar]));
        if (other || (same !== undefined && same !== r.t.en)) { r.keep = true; r.why = "adopted-pair"; changed = true; }
      }
    }
  }
  for (const r of rows) if (r.keep === null) { r.keep = false; r.why = "id-only"; }
  return rows;
}
// قاعدة مصطلحاتٍ صالحة للالتزام (نسخة، بترتيب المفاتيح نفسه): { base, reduced: [{ term, code, entry }] }
export function publishableBase(base, adopted = loadAdopted()) {
  const rows = siwarDecisions(base, adopted);
  const drop = new Map(rows.filter((r) => !r.keep).map((r) => [r.s, r]));
  const reduced = [];
  const terms = (base.terms || []).map((t) => {
    let u = t;
    if (Array.isArray(t.sources) && t.sources.some((s) => drop.has(s))) {
      u = { ...u, sources: t.sources.map((s) => { if (!drop.has(s)) return s; const { en, ar, sense, ...rest } = s; reduced.push({ term: t.en, code: s.code, entry: s.entry || null }); return rest; }) };
    }
    const sw = t.siwar;
    if (sw && typeof sw === "object" && "ar" in sw) {
      const old = sw.ar;
      if (drop.has(sw)) { const { ar, ...rest } = sw; u = { ...u, siwar: rest }; reduced.push({ term: t.en, code: "siwar", entry: sw.id || null }); }
      if (typeof u.ksaa === "string" && !("page" in u) && foldAr(u.ksaa) === foldAr(old)) { const { ksaa, ...r } = u; u = r; }
    }
    return u;
  });
  return { base: { ...base, terms }, reduced };
}
// كل مخالفةٍ في قاعدة المصطلحات: مصدرٌ من سوار بزوجٍ لا يجيزه الحالان
export const siwarViolations = (base, adopted = loadAdopted()) => publishableBase(base, adopted).reduced;

// ---------- النصوص (note وwhy وjudged): لا تُنسب إلى سوار صياغةٌ ليست مقابلًا معتمدًا ----------
// أ) الإسناد في الجملة: في كل جملةٍ فرعية (تُقسم على . و؛ و; والسطر و«،»، وقبل « و«» و« ومقابل» و« ومدخل» و« ومعجم»، لا
//    داخل «…» ولا (…)) تذكر معجمًا من معاجم سوار باسمه أو رمزه أو معرّف مدخل، يُفحص: كل اقتباسٍ «X» عربي، وكل لفظٍ عربي
//    بين قوسين بعد اسم المعجم («الموحّد (X، Y)»، لا فرعًا ولا رقمًا ولا وصفًا للمدخل ولا شرحَ معنى)، وكل لفظٍ عربي يلي رمز
//    المعجم في جملةٍ إنجليزية («RIY X»، «CON X and UNI 1.6.1 Y»، «both give X»). تُقسم أجزاؤه على / ، ⇒ = ← → ويجب أن يكون
//    كل جزءٍ مقابلًا معتمدًا: للمصطلح نفسه (أو كلمةً من مقابله، أو زوجًا باقيًا لمصدرٍ منه)، أو لمصطلحٍ في القاعدة يُذكر لفظه
//    الإنجليزي في الجملة أو يكون جزءًا من لفظ المصطلح المركّب، أو زوجًا باقيًا لمدخلٍ تذكر الجملة معرّفه.
//    ولا يُعفى اقتباسٌ إلا إن أُسند هو نفسه إلى مصدرٍ من غير سوار: بين قوسين بعده أو وهو بين قوسين معه، أو في قائمة
//    المصادر التي تليه بحرف جر («في الرياض وعرف الواجهة»)، أو كان أقربُ مصدرٍ قبله من غير سوار؛ أو قبلته الجملة صراحةً
//    (يجوز، مقبول، يُقبل، تصلح، بديلٌ مسنَد — لا مسبوقةً بنفي)، أو كان اقتباسَ جذر («من مادة «X»»)، أو اسمَ المعجم («أداء»)،
//    أو جملةً من خمس كلماتٍ فأكثر، أو مما راجعه المشروع وأبقاه (reviewed_prose).
// ب) البصمات: كل عبارةٍ عربية من كلمةٍ إلى خمس في note وwhy وjudged تُطوى وتُقارن ببصمات non_adopted للمصطلح نفسه؛ فإن
//    ورد منها في الحقل أكثر مما راجعه المشروع (known_occurrences) فهي مخالفة، أُسندت أم لم تُسند.
// ج) ومعرّف مدخلٍ يليه قوسٌ فيه لفظٌ عربي («RIY 1234abcd (X)»)، أو رمز معجمٍ في جملةٍ إنجليزية تقول إنه يعطي لفظًا
//    عربيًّا («RIY gives X»): اللفظ منسوبٌ إلى المدخل، فحكمه حكم (أ)؛ إلا تعليقًا بين القوسين لا لفظًا (فيه نفيٌ أو ظرف).
// والإحالة المحايدة: «مقابلٌ آخر في المعجم (المدخل <أول ٨>)» أو «(المدخل <أول ٨>)» أو المعرّف وحده.
const SIWAR_NAME_SRC = [
  "الرياض", // الرياض
  "الموحّ?د(?!ة)", // الموحّد
  "معجم البيانات والذكاء الاصطناعي", // معجم البيانات والذكاء الاصطناعي
  "معجم الذكاء الاصطناعي", // معجم الذكاء الاصطناعي
  "الإصدار الثالث", // الإصدار الثالث
  "القانونيّ?(?=[\\s،).؛:]|$)", // القانوني
  "الماليّ?(?=[\\s،).؛:]|$)", // المالي
  "قاموس العقود", // قاموس العقود
  "العقود والمشتريات", // العقود والمشتريات
  "الحكومة الرقمية", // الحكومة الرقمية
  "قياس الأداء", // قياس الأداء
  "معجم الأداء", "معجما الأداء", // معجم الأداء
  "الإحصائيّ?ة?(?=[\\s،).؛:]|$)", // الإحصائي/الإحصائية
  "الخطوط الحديدية", // الخطوط الحديدية
  "مسرد هيئة الخبراء", // مسرد هيئة الخبراء
  "مسرد المصطلحات القانونية", // مسرد المصطلحات القانونية
  "معجم الإعلام", "مصطلحات الإعلام", "فرع الإعلام", // الإعلام
  "سوار", "siwar", // سوار
  "(?<![A-Za-z])(?:RIY|UNI|AI|LEG|FIN|DGA|ADA|STA|RAIL|CON|LGL|MED)(?![A-Za-z])",
  "(?<![0-9a-f])[0-9a-f]{8}(?![0-9a-f])",
].join("|");
const SIWAR_NAME = new RegExp(SIWAR_NAME_SRC, "i");
const SIWAR_NAME_G = new RegExp(SIWAR_NAME_SRC, "gi");
// مصادر من غير سوار تُسنَد إليها الصياغة
const OTHER_SOURCE_SRC = [
  "الطبعة الأولى", "2022", "ص\\s?\\d", "ص[٠-٩]", // الطبعة الأولى، 2022، ص N
  "الهيئة الوطنية للأمن السيبراني", // الهيئة الوطنية للأمن السيبراني
  "ECC", "CCC", "OTCC", "DCC", "NCA", "SAMA", "PDPL", "NDMO", "ZATCA", "CST", "MOJ", "GASTAT", "BOE", "ARABTERM", "SDAIA", "ITU", "UNTERM", "WIPO", "NELC", "PDF",
  "البنك المركزي", // البنك المركزي
  "نظام حماية البيانات", // نظام حماية البيانات
  "اللائحة التنفيذية", "لائحة نقل", // اللائحة التنفيذية، لائحة نقل
  "مكتب إدارة البيانات", "زاتكا", // مكتب إدارة البيانات، زاتكا
  "هيئة الاتصالات", "نظام الاتصالات", // هيئة الاتصالات، نظام الاتصالات
  "المصطلحات العدلية", "وزارة العدل", // المصطلحات العدلية، وزارة العدل
  "الهيئة العامة للإحصاء", "البوابة النظامية", "منشآت", // الإحصاء، البوابة النظامية، منشآت
  "الواجهة", "(?<![A-Za-z])UI(?![A-Za-z])", "DGA ?3", "الحكومة الرقمية ?(?:٣|3)", "سدايا", // الواجهة، UI، الحكومة الرقمية ٣٫٠، سدايا
  "المركز الوطني للتعليم", "نظام التعاملات", // المركز الوطني للتعليم، نظام التعاملات
  "لائحة المدفوعات", "الأدلة الإرشادية", "كود المنصات", // لائحة المدفوعات، الأدلة الإرشادية، كود المنصات
  "الاتحاد الدولي", "مجمع دمشق", "الدليل الأردني", "مدينة الملك عبدالله", // مساندون من غير سوار
  "(?:^|[\\s(،])و?عرف(?=[\\s«])", // عرف (الاستعمال)
].join("|");
const OTHER_SOURCE = new RegExp(OTHER_SOURCE_SRC);
const OTHER_SOURCE_G = new RegExp(OTHER_SOURCE_SRC, "g");
// قبولٌ صريح في الجملة: يجوز، مقبول، يُقبل، تصلح، بديلٌ مسنَد، مسندتان — ما لم يسبقه نفي
const ACCEPTED_G = /يجوز|مقبول|يُ?قبل|تصلح|بديلٌ? مُ?سنَ?د|مسندتان/g;
const NEGATED = /(?:^|[\s(،])و?(?:غير|لا|ليس|ليست|لم|لن)\s*$/;
const acceptedIn = (s) => [...s.matchAll(ACCEPTED_G)].some((m) => !NEGATED.test(s.slice(0, m.index)));
// عبارات المعنى («في المعنى المالي والقانوني») تسمّي معنًى لا معجمًا
const SENSE_PHRASE = /(?:المعنى|معنى|المعنيين|معنيي|السياق|سياق|القطاع|المجال|الاستعمال)\s+\S+(?:\s+و\S+)?/g;
const ARABIC_LETTER = /[ء-ي]/;
const LEXICON_IN_QUOTES = new Set(["أداء"]); // «أداء» اسم المعجم
const ID8 = /(?<![0-9a-f])[0-9a-f]{8}(?![0-9a-f])/;
const ID8_G = /(?<![0-9a-f])[0-9a-f]{8}(?![0-9a-f])/g;
// كلمةٌ قبل القوس تجعل ما بينهما شرحَ معنى لا لفظًا («للصفة (سريع)»، «وللفعل (حثّ)»)
const SENSE_WORD = /^و?(?:لل|ل|ب|بال|ال)?(?:صفة|فعل|اسم|معنى|معاني|معنيين|فعلًا|اسمًا)$/;
// ما بين القوسين بعد اسم المعجم وليس لفظًا: فرعٌ أو قسمٌ أو وصفٌ للمعجم أو للمدخل، أو رقمٌ أو تاريخ
const NOT_WORDING = /[0-9٠-٩]|(?:^|\s)(?:فرعا?|الفروع|قسمه?|قسمها|الحوسبة|الحاسوبي|المصدر|الحاكم|المجمع|مدخل[اهي]?|مدخلَي|المدخل|ترتيب|القانون العام|الإعلام|التربية)(?:\s|$|،)/;
// تعليقٌ بين قوسين بعد معرّف مدخل، لا لفظ («(ليس في مدخلات المرشح)»، «(خارج المدخلات)»)
const COMMENT_WORD = /(?:^|\s)(?:ليس|ليست|لا|لم|لن|غير|خارج|ضمن|انظر|راجع|يعني|أي)(?:\s|$)/;
const AR_PART_SPLIT = /\s*(?:\/|،|,|⇒|=|←|→|؛|;)\s*/;
const AR_WORDS = /[ء-ي][ء-يً-ٰٟـ]*(?:\s+[ء-ي][ء-يً-ٰٟـ]*)*/g;
export function proseClauses(text) {
  const s = String(text ?? "");
  const out = [];
  let cur = "", q = 0, p = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "«") q++; else if (c === "»") q = Math.max(0, q - 1);
    else if (c === "(") p++; else if (c === ")") p = Math.max(0, p - 1);
    if (!q && !p && c === " " && /^و(?:«|مقابل|مدخل|معجم)/.test(s.slice(i + 1, i + 8)) && cur.trim()) { out.push(cur); cur = ""; }
    cur += c;
    const dot = c === "." && !(/\d/.test(s[i - 1] || "") && /\d/.test(s[i + 1] || "")) && !/[^\s.؛;\n]/.test(s[i + 1] || " ");
    if (!q && !p && (c === "؛" || c === ";" || c === "\n" || c === "،" || dot)) { out.push(cur); cur = ""; }
  }
  if (cur) out.push(cur);
  return out;
}
// ذكر المصادر في نصٍّ مرتّبًا: [[موضع، "siwar"|"other"، طول]] — ويُقدَّم ما كان من غير سوار عند التداخل
function sourceHits(s) {
  const hits = [];
  for (const m of s.matchAll(OTHER_SOURCE_G)) hits.push([m.index, "other", m[0].length]);
  for (const m of s.matchAll(SIWAR_NAME_G)) if (!hits.some(([i, k, l]) => k === "other" && m.index >= i && m.index < i + l)) hits.push([m.index, "siwar", m[0].length]);
  return hits.sort((a, b) => a[0] - b[0]);
}
// قائمة المصادر في أول النص (بعد حرف جر): أسماء المصادر وحروف العطف والأقواس والأرقام فقط — وفيها مصدرٌ من غير سوار؟
function listHasOther(s) {
  const hits = sourceHits(s);
  let pos = 0, other = false;
  for (const [i, k, l] of hits) {
    const gap = s.slice(pos, i).replace(/\([^()]*\)/g, " ");
    if (!/^[\s،,و]*(?:في|عند|لدى|بلفظ|كما في|من|بحسب|ب)?[\s،,و]*(?:في|عند|لدى)?[\s،,و]*$/.test(gap)) break;
    if (k === "other") other = true;
    pos = i + l;
  }
  return other;
}
// هل أُسند الاقتباس (bare من start إلى end) نفسه إلى مصدرٍ من غير سوار؟
function quoteFromOtherSource(bare, start, end, prevEnd, nextStart) {
  // داخل قوسين فيهما مصدرٌ من غير سوار («(«X»، ص28)»)
  const open = bare.lastIndexOf("(", start), close = bare.indexOf(")", end);
  if (open >= 0 && close >= 0 && bare.lastIndexOf(")", start) < open && OTHER_SOURCE.test(bare.slice(open, close + 1))) return true;
  const after = bare.slice(end, nextStart);
  const par = after.match(/^\s*\(([^()]*)\)/);
  if (par) {
    if (OTHER_SOURCE.test(par[1])) return true;
    if (SIWAR_NAME.test(par[1])) return false;
  }
  if (/^\s*(?:في|عند|لدى|بلفظ|كما في|من|بحسب|ب)\s/.test(after)) {
    const hits = sourceHits(after);
    if (hits.length) return listHasOther(after);
  }
  const hits = sourceHits(bare.slice(prevEnd, start));
  return hits.length ? hits[hits.length - 1][1] === "other" : false;
}
// مرشّحات الصياغة في جملةٍ مسندة: [{ x, start, end, kind }]
function candidates(clause, bare) {
  const out = [];
  for (const m of clause.matchAll(/«([^«»]+)»/g)) out.push({ x: m[1], start: m.index, end: m.index + m[0].length, kind: "quote" });
  // لفظٌ عربي بين قوسين بعد اسم معجم (بكلمتين على الأكثر)، لا شرح معنى ولا إسناد ولا معرّف ولا فرع
  for (const m of clause.matchAll(/\(([^()«»]*)\)/g)) {
    const inner = m[1];
    if (!ARABIC_LETTER.test(inner) || ID8.test(inner) || SIWAR_NAME.test(inner) || OTHER_SOURCE.test(inner) || NOT_WORDING.test(inner) || COMMENT_WORD.test(inner)) continue;
    const before = bare.slice(0, m.index);
    const last = [...before.matchAll(SIWAR_NAME_G)].pop();
    if (!last) continue;
    const gap = before.slice(last.index + last[0].length).trim();
    if ((gap ? gap.split(/\s+/) : []).length > 2) continue;
    if (SENSE_WORD.test(before.trim().split(/\s+/).pop() || "")) continue;
    out.push({ x: inner, start: m.index, end: m.index + m[0].length, kind: "paren" });
  }
  // لفظٌ عربي يلي رمز المعجم مباشرةً (ورقم فرعه) أو فعل العطاء في جملةٍ إنجليزية: «Only RIY X remains»، «UNI 1.6.1 X»، «both give X»
  if ((clause.match(/[A-Za-z]/g) || []).length > (clause.match(/[ء-ي]/g) || []).length) {
    const masked = clause.replace(/«[^«»]*»|\([^()]*\)/g, (m) => " ".repeat(m.length));
    for (const m of masked.matchAll(/(?:(?<![A-Za-z])(?:RIY|UNI|AI|LEG|FIN|DGA|ADA|STA|RAIL|CON|LGL|MED)(?:\s+[0-9.]+)?|\b(?:gives?|has|lists|offers|uses))\s+(?:only\s+)?['"]?([ء-ي][ء-يً-ٰٟـ]*(?:\s+[ء-ي][ء-يً-ٰٟـ]*)*)/g)) {
      const s0 = m.index + m[0].length - m[1].length;
      if (SIWAR_NAME.test(m[1]) || OTHER_SOURCE.test(m[1]) || [...foldAr(m[1])].length < 2) continue; // اسم معجمٍ أو حرف عطف
      out.push({ x: m[1], start: s0, end: s0 + m[1].length, kind: "code" });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
// مصطلحات القاعدة التي يُذكر لفظها الإنجليزي في النص، أو يكون كلمةً من لفظ المصطلح المركّب (الحال ٢ في النصوص)
function namedTerms(text, enList, ownEn = "") {
  const low = String(text).toLowerCase();
  const own = ` ${String(ownEn).toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return enList.filter(([k]) => (low.includes(k) && new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^a-z]|$)`).test(low)) ||
    (own.trim().includes(" ") && own.includes(` ${k} `))).map(([, en]) => en);
}
const AR_PHRASE = /[ء-غف-يٱ-ۓؐ-ًؚ-ٰٟـ]+(?:[  ]+[ء-غف-يٱ-ۓؐ-ًؚ-ٰٟـ]+)*/g;
const AR_TOKEN = /[ء-غف-يٱ-ۓؐ-ًؚ-ٰٟـ]+/g;
// كل عبارةٍ عربية من كلمةٍ إلى خمس في النص، مطويّة، بعددها (وبلا واو العطف في أولها أيضًا)
export function arabicNgrams(text) {
  const m = new Map();
  const add = (g) => m.set(g, (m.get(g) || 0) + 1);
  for (const ph of String(text ?? "").match(AR_PHRASE) || []) {
    const tk = (ph.match(AR_TOKEN) || []).map(foldAr).filter(Boolean);
    for (let i = 0; i < tk.length; i++) for (let j = i + 1; j <= Math.min(tk.length, i + 5); j++) {
      add(tk.slice(i, j).join(" "));
      if (/^و/.test(tk[i]) && [...tk[i]].length >= 4) add([tk[i].slice(1), ...tk.slice(i + 1, j)].join(" "));
    }
  }
  return m;
}
const textOf = (v) => (typeof v === "string" ? v : v && typeof v === "object" ? Object.values(v).map(textOf).filter(Boolean).join(" | ") : "");
const ownSet = (t, A, keptOf) => {
  const own = new Set([...(A.get(t.en) || []), ...(keptOf.get(t.en) || [])]);
  for (const a of headwordAlts(t.ar)) { const w = foldAr(a).split(" "); for (let i = 0; i < w.length; i++) for (let j = i + 1; j <= w.length; j++) own.add(w.slice(i, j).join(" ")); }
  return own;
};
function keptPairs(base) {
  const keptOf = new Map(), keptById = new Map();
  const codes = siwarCodes(base);
  for (const t of base.terms || []) for (const s of t.sources || []) {
    if (!isSiwarSource(s, codes) || typeof s.ar !== "string") continue;
    (keptOf.get(t.en) || keptOf.set(t.en, new Set()).get(t.en)).add(foldAr(s.ar));
    if (typeof s.entry === "string") { const k = s.entry.slice(0, 8); (keptById.get(k) || keptById.set(k, new Set()).get(k)).add(foldAr(s.ar)); }
  }
  return { keptOf, keptById };
}
export function proseViolations(base, adopted = loadAdopted()) {
  const A = adoptedRenderings(base, adopted);
  const enList = (base.terms || []).map((t) => [String(t.en).toLowerCase(), t.en]).filter(([k]) => k.length >= 3);
  const { keptOf, keptById } = keptPairs(base);
  const out = [];
  for (const t of base.terms || []) {
    const own = ownSet(t, A, keptOf);
    // (أ) الإسناد في الجملة
    for (const field of ["note", "why"]) {
      if (typeof t[field] !== "string") continue;
      for (const clause of proseClauses(t[field])) {
        const bare = clause.replace(/«[^«»]*»/g, (m) => " ".repeat(m.length)).replace(SENSE_PHRASE, (m) => " ".repeat(m.length));
        if (!SIWAR_NAME.test(bare) && !/«أداء»/.test(clause)) continue;
        if (acceptedIn(bare)) continue;
        const ids = [...clause.matchAll(ID8_G)].map((m) => m[0]);
        const named = new Set(namedTerms(clause, enList, t.en).flatMap((u) => [...(A.get(u) || [])]));
        const cands = candidates(clause, bare);
        cands.forEach((c, ci) => {
          const x = c.x;
          if (LEXICON_IN_QUOTES.has(x)) return;
          if (c.kind === "quote" && /(?:^|\s)(?:من\s+)?مادة\s*$/.test(clause.slice(0, c.start))) return; // «من مادة «X»»: جذر
          const parts = x.split(AR_PART_SPLIT).map((p) => (p.match(AR_WORDS) || []).join(" ")).filter((p) => p && ARABIC_LETTER.test(p));
          if (!parts.length || parts.every((p) => p.split(/\s+/).length >= 5)) return;
          const prevEnd = ci > 0 ? cands[ci - 1].end : 0, nextStart = ci + 1 < cands.length ? cands[ci + 1].start : clause.length;
          if (quoteFromOtherSource(bare, c.start, c.end, prevEnd, nextStart)) return;
          const homograph = (p) => adopted.homographs.has(`${t.en}|${shapeKey(t.en, p)}`);
          const ok = (p) => { const f = foldAr(p); return !homograph(p) && (own.has(f) || named.has(f) || ids.some((i) => (keptById.get(i) || new Set()).has(f))); };
          if ((ok(x) && !parts.some(homograph)) || parts.every((p) => p.split(/\s+/).length >= 5 || ok(p))) return;
          if (adopted.reviewedProse.has(`${t.en}|${field}|${quoteKey(t.en, field, x)}`)) return;
          out.push({ term: t.en, field, quote: x });
        });
      }
    }
    // (ب) البصمات
    if (adopted.nonAdopted.size) {
      for (const field of ["note", "why", "judged"]) {
        if (t[field] === undefined) continue;
        for (const [g, n] of arabicNgrams(textOf(t[field]))) {
          if (own.has(g)) continue;
          const k = foldedKey(t.en, g);
          if (!adopted.nonAdopted.has(k)) continue;
          if (n > (adopted.known.get(`${t.en}|${field}|${k}`) || 0)) out.push({ term: t.en, field, quote: `#${k}`, count: n });
        }
      }
    }
  }
  out.push(...idAttributedViolations(base, adopted));
  return out;
}
// (ج) ومعرّف مدخلٍ يليه قوسٌ فيه لفظٌ عربي («RIY 1234abcd (X)»، «1234abcd و5678abcd (X، Y)»)، أو رمز معجمٍ في جملةٍ
// إنجليزية تقول إنه يعطي لفظًا عربيًّا («RIY gives X»): اللفظ منسوبٌ إلى المدخل، فيجب أن يكون مقابلًا معتمدًا كذلك
// (للمصطلح، أو لمصطلحٍ يُذكر لفظه الإنجليزي في الموضع أو من لفظ المصطلح المركّب، أو كلمةً من مقابله)؛ والمعرّف وحده يكفي.
export function idAttributedViolations(base, adopted = loadAdopted()) {
  const A = adoptedRenderings(base, adopted);
  const enList = (base.terms || []).map((t) => [String(t.en).toLowerCase(), t.en]).filter(([k]) => k.length >= 3);
  const { keptOf } = keptPairs(base);
  const out = [];
  for (const t of base.terms || []) {
    const own = ownSet(t, A, keptOf);
    for (const field of ["note", "why"]) {
      const text = t[field];
      if (typeof text !== "string") continue;
      const found = [];
      for (const m of text.matchAll(/(?<![0-9a-f])[0-9a-f]{8,9}(?![0-9a-f])\s*\(([^()]*)\)/g)) {
        if (COMMENT_WORD.test(m[1])) continue; // تعليقٌ لا لفظ
        found.push(...m[1].split(/\s*(?:،|,|\/|⇒|→|←|=|;)\s*/).map((p) => [p, m[0]]));
      }
      for (const m of text.matchAll(/(?<![A-Za-z])(?:RIY|UNI|AI|LEG|FIN|DGA|ADA|STA|RAIL|CON|LGL|MED)(?![A-Za-z])[^.;«»()،]{0,40}?\b(?:gives|has|lists|offers)\s+(?:only\s+)?['"]?([ء-ي][^\s,;.'")]*)/g)) found.push([m[1], m[0]]);
      for (const [p, ctx] of found) {
        const w = (String(p).match(/[ء-ي][ء-يً-ٟـٰ]*/g) || []).join(" ");
        if (!w) continue;
        const f = foldAr(w);
        const named = new Set(namedTerms(ctx, enList, t.en).flatMap((u) => [...(A.get(u) || [])]));
        if (own.has(f) || named.has(f)) continue;
        if (adopted.reviewedProse.has(`${t.en}|${field}|${quoteKey(t.en, field, w)}`)) continue;
        out.push({ term: t.en, field, quote: w });
      }
    }
  }
  return out;
}

// المسارد المصدَّرة (CSV: english_term,arabic_term,…): في كل صفٍّ يُسند إلى سوار (اسم المنصة، أو معرّف مدخل، أو
// «(المدخل …)»)، كل اقتباس «X» وكل لفظٍ عربي في جملةٍ تذكر المعجم (glossary، lexicon، Siwar، 3rd ed، المعجم، سوار)
// يجب أن يكون مقابلًا معتمدًا: بديلًا من arabic_term الصف، أو مقابلًا معتمدًا لمصطلح الصف في القاعدة، أو المقابلَ المعتمد
// لمصطلحٍ في القاعدة تذكر الجملةُ اسمَه الإنجليزي. وتُستثنى الجملة التي تُسند إلى الطبعة المطبوعة (1st ed. (2022))
// وحدها، والعبارة المحايدة «مقابلٌ آخر في المعجم (المدخل …)». تُرجع [{ file, row, term, wording }]
const SIWAR_REF = /\bSiwar\b|سوار|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?:المدخل|المدخلان|المداخل) [0-9a-f]{8}\b/i;
const LEX_CUE = /glossary|lexicon|siwar|\b(?:1st|2nd|3rd)\s+ed\b|المعجم|معجم|سوار/i;
const PRINT_ED = /\b1st\s+ed\.?\s*\(2022\)|\(2022\)|الطبعة الأولى/i;
const SIWAR_ED = /\b3rd\s+ed\b|\bSiwar\b|سوار|[0-9a-f]{8}-[0-9a-f]{4}/i;
const NEUTRAL = /مقابل[ًٌٍ]?ا? آخر في المعجم(?: \((?:المدخل|المدخلان|المداخل)[^)]*\))?/g;
const AR_RUN = /[ء-غف-يٱ-ۓؐ-ًؚ-ٰٟـ]+(?:\s+[ء-غف-يٱ-ۓؐ-ًؚ-ٰٟـ]+)*/g;
function csvCells(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const sentences = (s) => String(s).split(/(?<!\b(?:ed|p|pp|e\.g|i\.e|vs|cf))[.;](?:\s+|$)/);
export function siwarCsvViolations(csvText, base, file = "", adopted = loadAdopted()) {
  const terms = (base && base.terms) || [];
  const A = adoptedRenderings(base || { terms: [] }, adopted);
  const named = (sentence) => terms.filter((t) => new RegExp(`(^|[^A-Za-z])${String(t.en).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^A-Za-z]|$)`, "i").test(sentence));
  const out = [];
  String(csvText).replace(/^﻿/, "").split(/\r?\n/).forEach((line, i) => {
    if (i === 0 || !line.trim() || !SIWAR_REF.test(line)) return;
    const cells = csvCells(line);
    const own = new Set([...headwordAlts(cells[1]).map(foldAr), ...(A.get(cells[0]) || [])]);
    const ok = (w, sentence) => {
      const allowed = new Set(own);
      for (const t of named(sentence)) for (const f of A.get(t.en) || []) allowed.add(f);
      return allowed.has(foldAr(w)) || w.split(/\s*(?:\/|⇒)\s*/).filter(Boolean).every((p) => allowed.has(foldAr(p)));
    };
    for (const cell of cells.slice(2)) {
      for (const s of sentences(cell)) {
        if (PRINT_ED.test(s) && !SIWAR_ED.test(s)) continue; // الطبعة المطبوعة (2022) وحدها
        const clean = s.replace(NEUTRAL, " ");
        const words = [...clean.matchAll(/«([^«»]+)»/g)].map((m) => m[1]);
        if (LEX_CUE.test(clean)) words.push(...[...clean.replace(/«[^«»]*»/g, " ").matchAll(AR_RUN)].map((m) => m[0]));
        for (const w of words) if (!ok(w, s)) out.push({ file, row: i + 1, term: cells[0], wording: w });
      }
    }
  });
  return out;
}
// مسارد CSV تحت مجلد الوثائق (تعاوديًّا)
export function docsCsvFiles(dir = path.join(GLOSSARY, "..", "docs")) {
  const out = [];
  (function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.toLowerCase().endsWith(".csv")) out.push(p);
    }
  })(dir);
  return out.sort();
}

// ---------- نواتج فيها بيانات سوار: في موضعٍ يتجاهله git وحده، وبتاريخ أقدم جلبٍ فيها ----------
// الأداة التي تكتب مقابلاتٍ من سوار في ملفٍ يختاره مشغّلها (harvest-siwar ‎--out‎، terms-match، siwar-terms، ومسودّة
// terms-publish) ترفض موضعًا لا يتجاهله git: الملف المتتبَّع أو خارج المستودع لا تبلغه ‎--purge-expired‎ ولا قاعدة الحذف.
// والناتج يُختم ‎_meta.fetched‎ (أقدم جلبٍ فيه) و‎_meta.retention‎ ليحذفه siwar-dump.mjs --purge-expired بعد المدة.
export function assertIgnoredOut(file, tool) {
  const abs = path.resolve(file);
  let ignored = false;
  try {
    execFileSync("git", ["-C", GLOSSARY, "check-ignore", "-q", "--", abs], { stdio: "ignore" });
    ignored = true; // رمز 0: يتجاهله git (والمتتبَّع لا يُعدّ متجاهَلًا)
  } catch {}
  if (!ignored) {
    die(`✗ ${tool}: ${file} ليس في موضعٍ يتجاهله git — ما فيه بياناتٌ من سوار يُكتب في glossary/_terms/ أو ` +
      `glossary/_lexicons/ (شروط سوار: لا احتفاظ فوق ${RETENTION_DAYS} يومًا، ولا يُلتزم إلا المقابل المعتمد ومعرّفه)`);
  }
}
export const oldestDay = (days) => days.filter(Boolean).map((d) => String(d).slice(0, 10)).sort()[0] || null;
export const retentionMeta = (fetchedDays) => ({ fetched: oldestDay(fetchedDays), retention: `siwar-${RETENTION_DAYS}d` });
