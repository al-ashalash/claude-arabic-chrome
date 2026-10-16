/* cml-shared.js — النسخة الواحدة من المنطق الحرج المشترك (المرحلة ١ من خطة الإطلاق).
 *
 * لماذا: كانت makePattern منسوخة ثلاثًا (options.js واختبار القواعد وأداة التوليد)
 * وانحرفت النسختان فعلًا في ترتيب الحرّاس؛ وunescapeLiteral مكررة بين المحرك وسكربت
 * الحصاد بعقد «أبقِهما متطابقتين» اليدوي. أول تعديل يصيب نسخة دون أختها = علة صامتة
 * بالتعريف. قيدُ «الملف الواحد» غير قائم: المانيفست يقبل قائمة سكربتات.
 *
 * ثنائي الاستخدام كـ cml-const.js: كلاسيكي في المتصفح، ESM صالح في Node.
 * الاستثناء الوحيد: harvest-all-strings.js (سكربت لصقٍ في وحدة التحكم، ذاتي الاكتفاء
 * حكمًا) يحمل نسخة قسرية من unescapeLiteral — وحارس التطابق النصي في lint-dict.mjs
 * يجعل العقد آليًّا لا يدويًّا.
 *
 * ═══ العقود الأربعة الكبرى (JSDoc — توثيق المساهم الأول) ═══════════════════════
 *
 * @typedef {Object} CmlRule            قاعدة ذكية (نمط ديناميكي)
 * @property {string} en   النص الإنجليزي الأصلي بمتغيراته {name} — للتوثيق والفرز
 * @property {string} re   تعبير نمطي مصدره en: ثوابت مهروبة و(.+?) لكل متغير، بمرساتي ^$
 * @property {string} ar   القالب العربي: $1..$9 مجموعات، و%M/%W/%P/%C رموز المحرك
 *
 * @typedef {Object} CmlScanResult      نتيجة «تحديث المصدر — فحص الموقع»
 * @property {"running"|"done"|"error"|"cancelled"} status
 * @property {number} fetched   ملفات فُحصت فعلًا (الفاشلة لا تُحسب)
 * @property {number} [failed]  ملفات تعذّر جلبها — النتيجة ناقصة لا كاملة
 * @property {number} found     نصوص الكتالوج المقبولة بعد المرشحات
 * @property {number} [missing] غير المترجَم الحقيقي (قد يفوق المعروض عند القص بالسقف)
 * @property {number} [shown]   المعروض في القائمتين بعد القص
 * @property {string[]} [list]     غير المترجَم الثابت
 * @property {string[]} [varList]  غير المترجَم ذو المتغيرات
 * @property {boolean} [capped] قُصّت القائمتان عند SCAN_CAP
 * @property {number} at        نبض آخر تحديث — غيابه أو تقادمه = فحص متعثر
 * @property {number} [seconds] زمن الفحص الكلي
 * @property {string} [error]
 *
 * @typedef {Object} CmlDictionary      حمولة globalThis.CLAUDE_L10N.dicts[lang]
 * @property {"rtl"|"ltr"} dir
 * @property {string} font
 * @property {Object<string,string>} strings   إنجليزي ← عربي (مطابقة حرفية بعد trim)
 * @property {Object<string,{plural:string,forms:string[]}>} plurals  صيغ %d الست
 * @property {CmlRule[]} patterns  مرتبة بالتخصيص: الأطول ثابتًا أولًا — الترتيب دلالي!
 *
 * @typedef {Object} CmlExportFile      ملف التصدير/الاستيراد الموحد
 * @property {"claude-mutarjim"} _app
 * @property {"terms"|"source-bare"|"source-full"} _kind
 * @property {string} lang
 * @property {{en:string,ar:string}[]} terms
 * ═══════════════════════════════════════════════════════════════════════════════
 */
(function (g) {
  "use strict";

  var VAR_RE = /\{([A-Za-z_$][\w$]*)\}/g;
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /**
   * فكُّ حرفيّة جافاسكربت فكًّا حقيقيًا. أدوات الحزم ترمّز كل محرف غير ASCII
   * (’ ← ’، terser يستعمل \xNN) — وبلا فكٍّ حقيقي يعمى الفحص عن فئة محارف
   * كاملة (نحو سُدس نصوص الواجهة — درس §7و المؤسِّس).
   * @param {string} lit النص كما ورد بين علامتي الاقتباس في الحزمة
   * @param {boolean} singleQuoted هل كان المحدِّد فاصلة عليا
   * @returns {string|null} النص المفكوك، أو null إن تعذّر (تجاهُل لا تشويه)
   */
  function unescapeLiteral(lit, singleQuoted) {
    if (lit == null) return null;
    // (١) \' هروب صحيح في الحرفية المفردة ولا يعرفه JSON
    var t = singleQuoted ? lit.replace(/\\'/g, "'") : lit;
    // (٢) \xNN هروب جافاسكربت لا يعرفه JSON — حوّله إلى \u00NN (وإلا سقطت é و× و·)
    t = t.replace(/\\x([0-9a-fA-F]{2})/g, "\\u00$1");
    // (٣) اهرب علامات الاقتباس العارية بتمريرة ذرّية: تبتلع كل هروب بأكمله أولًا،
    // فلا تُخدع بـ\" ولا بعلامتين متلاصقتين
    t = t.replace(/\\[\s\S]|"/g, function (x) { return x === '"' ? '\\"' : x; });
    try { return JSON.parse('"' + t + '"'); } catch (e) { return null; }
  }

  /**
   * توليد قاعدة ذكية من زوج {en, ar} — أو null إن لم تصلح قاعدةً آمنة.
   * الفشل الآمن هو الرفض: القاعدة الخاطئة أسوأ من غياب الترجمة.
   * ترتيب الحُرّاس هنا هو المرجع الوحيد — النسخ الأخرى أُميتت عمدًا.
   * @param {string} en  النص الإنجليزي بمتغيراته {name}
   * @param {string} ar  الترجمة العربية بالمتغيرات نفسها
   * @returns {CmlRule|null}
   */
  function makePattern(en, ar) {
    VAR_RE.lastIndex = 0;
    var names = [], m;
    while ((m = VAR_RE.exec(en))) names.push(m[1]);
    if (!names.length) return null;                 // لا متغيرات: مدخلة حرفية عادية
    if (names.length > 3) return null;              // سقف يكبح التراجع الأسّي

    // حارس ReDoS: متغيّران متلاصقان (أو بينهما بياض فقط) = (.+?)(.+?) = زمن أسّي
    if (/\}[\s ]*\{/.test(en)) return null;
    // حارس رمز القالب: $رقم في الترجمة يُقرأ مجموعة ملتقطة فيفسد الناتج
    if (/\$\d/.test(ar)) return null;

    var literal = en.replace(VAR_RE, "").trim();
    if (literal.length < 6) return null;            // ثابت أقصر من أن يميّز
    if (!/[A-Za-z]{3}/.test(literal)) return null;  // رموز بلا كلمات

    // الأهم: الموضع لا الطول — نمط محفوف بمتغيرين من الطرفين بلا مرساة
    // ("{a} of {b}" يطابق "Terms of Service")
    var t = en.trim();
    if (/^\{[A-Za-z_$][\w$]*\}/.test(t) && /\{[A-Za-z_$][\w$]*\}$/.test(t)) return null;

    // كل متغير في العربية موجود في الإنجليزية (لا متغير مخترع)
    VAR_RE.lastIndex = 0;
    var arNames = [], m2;
    while ((m2 = VAR_RE.exec(ar))) arNames.push(m2[1]);
    for (var i = 0; i < arNames.length; i++) if (names.indexOf(arNames[i]) < 0) return null;

    var re = "^", idx = 0, mm;
    VAR_RE.lastIndex = 0;
    while ((mm = VAR_RE.exec(en))) {
      re += escapeRe(en.slice(idx, mm.index)) + "(.+?)";
      idx = mm.index + mm[0].length;
    }
    re += escapeRe(en.slice(idx)) + "$";

    var arOut = ar.replace(VAR_RE, function (whole, name) {
      var pos = names.indexOf(name);
      return pos < 0 ? whole : "$" + (pos + 1);
    });

    try { new RegExp(re); } catch (e) { return null; }
    return { en: en, re: re, ar: arOut };
  }

  /** طول النص الثابت — معيار فرز التخصيص (الأطول أخصّ فيُجرَّب أولًا) */
  function patternLiteralLen(p) { return String(p && p.en || "").replace(/\{[^{}]*\}/g, "").length; }

  /**
   * فرز القواعد بالتخصيص فرزًا مستقرًا. المحرك يأخذ أول نمط يطابق — فإن سبق الأعمُّ
   * الأخصَّ ابتلع النص وأخرج ترجمة خاطئة (39 حالة قيست على المدونة قبل الفرز).
   * @param {CmlRule[]} pats
   * @returns {CmlRule[]} مصفوفة جديدة مرتبة
   */
  function sortBySpecificity(pats) {
    return pats.map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return (patternLiteralLen(b.p) - patternLiteralLen(a.p)) || (a.i - b.i); })
      .map(function (x) { return x.p; });
  }

  /* ---------- resolveDir: حاسمُ اتجاه فقرةٍ من المحادثة (أذكى من dir="auto") ----------
   * dir="auto" في المتصفح يحكم بـ**أول حرفٍ قويٍّ** لا غير، وهذا يخطئ في نمطين
   * شائعين في محادثةٍ عربية (أكّدهما مسحُ مشاريع نظيرة، وتُثبتهما اختباراتنا):
   *   ١) فقرةٌ تبدأ بضجيجٍ لاتينيٍّ ثم تسترسل عربيةً: رابطٌ، أو مسار، أو اسم ملف، أو
   *      مقتطفُ شيفرةٍ بين علامتين مائلتين، أو رقمُ بند — فأولُ قويٍّ لاتينيٌّ فتُقلب كلها.
   *   ٢) فقرةٌ تبدأ بكلمةٍ لاتينيةٍ واحدة وأكثرُها عربي.
   * فالحسمُ هنا ثلاثُ درجات: تجريدُ الضجيج البادئ، ثم أولُ قويٍّ، ثم أغلبيةٌ حاسمة.
   *
   * ومبدأُ الحذر صريح: نُرجع null متى لم نجزم — فيبقى dir="auto" وهو سلوك المنصة
   * القياسي. ولا نخالفه إلا حين يُغيّر التجريدُ الحكمَ أو تكون الأغلبية بهامشٍ ساحق.
   * (النطاقات أرقامٌ لا أسماء: كلُّ ما يُكتب من اليمين إلى اليسار.)
   */
  var RTL_ONE = new RegExp("[\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF]");
  var RTL_ALL = new RegExp("[\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF]", "g");
  var LTR_ONE = new RegExp("[A-Za-z\\u00C0-\\u024F]");
  var LTR_ALL = new RegExp("[A-Za-z\\u00C0-\\u024F]", "g");
  // ضجيجٌ بادئٌ محايدُ الدلالة اتجاهيًّا وإن كان لاتينيَّ المحارف
  var LEAD_NOISE = new RegExp(
    "^(?:\\s|[\\u2000-\\u206F]|`[^`]*`|https?://\\S+|www\\.\\S+" +
    "|[\\w.-]+\\.[A-Za-z]{2,6}(?:/\\S*)?|[\\w.-]*[/\\\\][\\w.\\-/\\\\]*" +
    "|@[\\w.-]+|\\$[\\w.-]+|\\d+[.)\\-]?" +
    "|[-–—•*+>#\\[\\](){}«»\"'،,.:;!?/\\\\|~^&=_])+");
  function firstStrong(s) {
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (RTL_ONE.test(c)) return "rtl";
      if (LTR_ONE.test(c)) return "ltr";
    }
    return null;
  }
  function resolveDir(text) {
    if (!text) return null;
    var s = String(text).slice(0, 600); // عيّنةٌ تكفي للحكم — ولا نمشي على نصٍّ طويل
    var raw = firstStrong(s);
    if (raw === null) return null;                  // لا حرف قويّ ⇒ dir=auto يكفي
    var afterStrip = firstStrong(s.replace(LEAD_NOISE, ""));
    // ١) التجريد غيّر الحكم ⇒ نصرّح به — ولبُّ الإصلاح أن الضجيج البادئ لا يحكم
    if (afterStrip && afterStrip !== raw) return afterStrip;
    // ٢) أغلبيةٌ حاسمة: هامشٌ مضاعَفٌ وعددٌ معتبر، وإلا فلا نخالف المنصة
    var r = (s.match(RTL_ALL) || []).length;
    var l = (s.match(LTR_ALL) || []).length;
    if (r + l >= 12) {
      if (raw !== "rtl" && r >= l * 2) return "rtl";
      if (raw !== "ltr" && l >= r * 2) return "ltr";
    }
    return null;                                    // لم نجزم ⇒ اتركها لـdir="auto"
  }

  g.CMLShared = {
    VAR_RE: VAR_RE,
    resolveDir: resolveDir,
    escapeRe: escapeRe,
    unescapeLiteral: unescapeLiteral,
    makePattern: makePattern,
    patternLiteralLen: patternLiteralLen,
    sortBySpecificity: sortBySpecificity,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
