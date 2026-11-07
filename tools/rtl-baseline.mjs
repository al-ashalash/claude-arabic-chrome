// rtl-baseline.mjs — ★ (ر16-ب، ٦ جمادى الأولى ١٤٤٨هـ) دمج خطّ أساس فحص الاتجاه بالنطاق (rtl-audit.mjs --write-baseline).
//
// لماذا: كان --write-baseline يكتب الملف كلَّه من التشغيل الحاضر، ففحصُ نطاقٍ واحد (--domains=com) يمحو بصمات النطاقات السبعة الأخرى.
// فالدمج بالنطاق: بصمات النطاقات التي فُحصت في التشغيل تحلّ محلّ بصماتها القديمة (وتُلحق بآخر القائمة)، وبصمات غيرها تبقى كما هي حرفًا
// بحرف وبترتيبها — والملف يكتبه JSON.stringify بمسافةٍ واحدة، فإعادة كتابته لا تغيّر بايتًا من مدخلٍ لم يُمسّ — ويُختم كل نطاقٍ كُتب
// في domains (الوقت والالتزام والإصدار، وswitchedOn للنطاق القادم المفحوص بنسخته المشغَّلة). ويمتحنه selftest-tools.mjs.
//
//   mergeBaseline(oldText, fps, ran, head, stamp) ⇒ نصّ الملف الجديد
//     oldText: نصّ الملف القديم أو "" (لا ملف)؛ fps: بصمات التشغيل؛ ran: النطاقات التي فُحصت؛ head: {at, commit, extVersion} لملفٍّ جديد؛
//     stamp(d): ختم النطاق d. والملف القديم غير المقروء يُرفض (رميٌ) — لا يُكتب ملفٌّ جديد فوقه فتضيع بصمات غير المفحوص
export function mergeBaseline(oldText, fps, ran, head, stamp) {
  const set = new Set(ran);
  for (const f of fps) if (!set.has(f.d)) throw new Error(`بصمةٌ لنطاقٍ لم يُفحص في التشغيل: ${f.d}`);
  const domains = Object.fromEntries([...set].map((d) => [d, stamp(d)]));
  let out;
  if (oldText) {
    const old = JSON.parse(oldText);
    if (!old || !Array.isArray(old.fps)) throw new Error("خطّ الأساس القديم بلا قائمة fps");
    out = Object.assign({}, old, { fps: old.fps.filter((x) => !set.has(x.d)).concat(fps), domains: Object.assign({}, old.domains || {}, domains) });
  } else out = Object.assign({}, head, { fps, domains });
  return JSON.stringify(out, null, 1) + (oldText && oldText.endsWith("\n") ? "\n" : "");
}

// ★ (ر27، ٢٠ جمادى الأولى ١٤٤٨هـ — ما وجده مراجع ت10-هـ2ب، reports/T10H2.md §٥) هل يوقف إخفاقُ صفحةٍ التشغيلَ كله بلا ‎--keep-going‎ (rtl-audit.mjs)؟
// إخفاق كروم نفسه نعم: «مهلة CDP: …» و«لم أجد كروم …». وصفحة التحقّق (Cloudflare، ‎entry.challenge‎) لا: لم تُقَس ولا أثر للإضافة فيها، والبوابة لا تعدّها
// صفحةً أخفقت؛ ورسالتها تذكر «كروم بلا واجهة» فكانت تطابق ‎/CDP|كروم/‎ فيتوقف ‎--gate‎ كلما حُجبت صفحة الدخول بعرض 390. ويمتحنه selftest-tools.mjs
export function stopsRun(entry) {
  return !!(entry && entry.error) && !entry.challenge && /CDP|كروم/.test(entry.error);
}
