// pattern-shapes.mjs — أشكال الالتقاط المضيَّقة للقوالب، مشتركةٌ بين gen-patterns.mjs وmanual-patterns.mjs (ت14-هـ0ب، القرار 142)
//
// لماذا: ثلاثة أشكالٍ من القوالب كانت تضيع عند الدمج (reports/T14-0.md §٢ وجرد ت14-هـ0ب):
//   ١) التاريخ الذي تكتبه الصفحة بالإنجليزية داخل قالب («Until Dec 5, 2026»): كان التقاطًا حرًّا يُخرج «حتى Dec 5, 2026». فالمتغيّر الذي
//      تعرض الصفحة قيمته تاريخًا إنجليزيًّا يُضيَّق إلى شكل المحرّك المعتمد (الشهر ثم اليوم ثم السنة اختيارًا) ويُكتب في العربية ‎$<اليوم> %M<الشهر>$<السنة>‎:
//      ‎%M‎ يحوّل اسم الشهر من الجدول المغلق (cml-shared PAT_MAPS.M)، وما لا يعرفه الجدول يُفشل النمط فيُجرَّب التالي — كأنماط القاموس القائمة
//      («Effective {date}» و«{cap} total credit · Expires {date}»).
//   ٢) متغيّرات ICU الرقمية ‎{x, number}‎: لا يعرفها makePattern (يعرف ‎{x}‎ وحده) فيُرفض القالب كله، والصفحة تكتب العدد بفاصلة الآلاف. فيُكتب
//      ‎{x}‎ ويُضيَّق التقاطه إلى عددٍ (‎1,234‎ و‎12.5‎) — و‎{x, date}‎ تاريخًا كما في (١). وما سواهما من ICU (الجمع والاختيار والوقت) لأداة ICU.
//   ٣) الفقرات: رسالةٌ فيها سطرٌ فارغ تعرضها الصفحة فقرةً فقرةً (عقدة نصٍّ لكل فقرة، كما يحصدها الماسح)، فمدخلها كاملةً لا يُطلب أبدًا.
// والتضييق لا يوسّع ما يطابقه نمطٌ أبدًا: يحلّ شكلٌ أضيق محلّ التقاطٍ قبلته حرّاس makePattern أو makePatternBounded، فتبقى الحرّاس صادقة.

export const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";
// ثلاث مجموعات: الشهر، واليوم، والسنة (اختيارية ومعها مسافتها)
export const DATE_SHAPE = "(" + MONTHS + ") (\\d{1,2})(?:,( \\d{4}))?";
// عددٌ كما تكتبه الصفحة: بفاصلة الآلاف أو بدونها، وكسرٌ عشري اختيارًا
export const NUM_SHAPE = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)";
// رمزٌ واحد بلا بياض (مسار، مضيف، معرّف، إصدار)
export const TOKEN_SHAPE = "([^\\s]+)";
// قيمةٌ لا جملة: حتى أربعة رموز (BOUNDED_CAP في cml-shared)
export const WORD_SHAPE = "([^\\s]+(?:\\s[^\\s]+){0,3}?)";
export const SHAPES = { num: NUM_SHAPE, token: TOKEN_SHAPE, word: WORD_SHAPE, date: DATE_SHAPE };
const GROUPS = { num: 1, token: 1, word: 1, date: 3 };

const ICU_ARG = /\{([A-Za-z_$][\w$]*)\s*,\s*(number|date|time|plural|select|selectordinal)\b[^{}]*\}/g;
const ICU_NEST = /\{[A-Za-z_$][\w$]*\s*,\s*(plural|select|selectordinal)\s*,/;
// ‎{x, number}‎ و‎{x, date}‎ ← ‎{x}‎ في الطرفين، ونوعُ التقاطه؛ وما سواهما من ICU يُرفض بسببه (null وwhy)
export function normalizeIcuArgs(en, ar) {
  if (ICU_NEST.test(en) || ICU_NEST.test(ar)) return { why: "icu-plural-or-select" };
  const kinds = {};
  let why = null;
  const fix = (s, side) => s.replace(ICU_ARG, (w, name, fmt) => {
    if (fmt === "number") { if (side === "en") kinds[name] = "num"; return "{" + name + "}"; }
    if (fmt === "date") { if (side === "en") kinds[name] = "date"; return "{" + name + "}"; }
    why = "icu-" + fmt;
    return w;
  });
  const en2 = fix(en, "en"), ar2 = fix(ar, "ar");
  if (why) return { why };
  return { en: en2, ar: ar2, kinds };
}

// مواضع المجموعات الملتقطة في المستوى الأعلى من تعبيرٍ بناه makePattern (الثوابت مهروبةٌ بـescapeRe: لا قوس فيها غير مهروب)
export function captureSpans(re) {
  const out = [];
  let depth = 0, start = -1, cap = false;
  for (let i = 0; i < re.length; i++) {
    const ch = re[i];
    if (ch === "\\") { i++; continue; }
    if (ch === "[") { // صنف حروف: لا أقواس فيه
      for (i++; i < re.length && re[i] !== "]"; i++) if (re[i] === "\\") i++;
      continue;
    }
    if (ch === "(") {
      if (depth === 0) { start = i; cap = re[i + 1] !== "?"; }
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0 && cap) out.push({ start, end: i + 1 });
    }
  }
  return out;
}

const VAR_G = /\{([A-Za-z_$][\w$]*)\}/g;
// نمطٌ ({en, re, ar}) قبلته الحرّاس ← النمط نفسه بالتقاطٍ أضيق لكل متغيّرٍ في kinds ({اسم: "num"|"date"|"token"|"word"})، وعربيته بأرقام
// المجموعات بعد الإزاحة (التاريخ ثلاث مجموعات: ‎$<اليوم> %M<الشهر>$<السنة>‎). يُرجع {why} إن زادت المجموعات على تسع (‎$n‎ برقمٍ واحد) أو لم
// تطابق المجموعاتُ متغيّرات القالب
export function narrowPattern(pat, kinds) {
  const names = [...String(pat.en).matchAll(VAR_G)].map((m) => m[1]);
  if (!kinds || !names.some((n) => kinds[n])) return pat;
  const spans = captureSpans(pat.re);
  if (spans.length !== names.length) return { why: "groups-mismatch" };
  // رقم المجموعة الجديد لكل موضع، ونوعه
  let re = "", at = 0, g = 0;
  const newIdx = [];
  names.forEach((n, i) => {
    const k = kinds[n];
    re += pat.re.slice(at, spans[i].start) + (k ? SHAPES[k] : pat.re.slice(spans[i].start, spans[i].end));
    at = spans[i].end;
    newIdx.push({ first: g + 1, kind: k || null });
    g += k ? GROUPS[k] : 1;
  });
  re += pat.re.slice(at);
  if (g > 9) return { why: "groups>9" };
  try { new RegExp(re); } catch { return { why: "bad-regex" }; }
  // العربية: ‎$n‎ و‎%Tn‎ يشيران إلى المجموعة n القديمة (أول ظهورٍ للاسم في القالب)
  const ar = String(pat.ar).replace(/(\$|%T)(\d)/g, (w, sym, d) => {
    const ni = newIdx[+d - 1];
    if (!ni) return w;
    if (ni.kind === "date") return sym === "$" ? "$" + (ni.first + 1) + " %M" + ni.first + "$" + (ni.first + 2) : w;
    return sym + ni.first;
  });
  return Object.assign({}, pat, { re, ar });
}

const PARA = /\n[ \t]*\n/;
// زوجٌ فيه فقرات (سطرٌ فارغ) ← أزواج الفقرات بترتيبها إن تساوى عددها في الطرفين، وإلا {why}؛ وnull لما لا فقرات فيه
export function splitParagraphs(en, ar) {
  if (!PARA.test(en)) return null;
  const e = en.split(PARA).map((x) => x.trim()), a = String(ar).split(PARA).map((x) => x.trim());
  if (e.length !== a.length || e.some((x) => !x) || a.some((x) => !x)) return { why: "paragraph-count", en: e.length, ar: a.length };
  return { pairs: e.map((x, i) => ({ en: x, ar: a[i] })) };
}
