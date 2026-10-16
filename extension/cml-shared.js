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

  /* ---------- makePatternBounded: نمطٌ بالتقاطٍ محدود لما يرفضه makePattern (الشحن الجماعي وحده) ----------
   * لماذا (بوابة الشمول ١٤٤٨هـ): 841 نصًّا بمتغيّرات مترجمًا بقي إنجليزيًّا لأن makePattern يرفضه — ثابتُه أقصر
   * من أن يميّز («Add {name}»)، أو نمطه (.+?) يطابق مفاتيح حرفية («Added to {name}» يبتلع جملةً كاملة). والخطر
   * الحقيقي في الحالتين ابتلاعُ الالتقاط جملةً لا قيمة. فالالتقاط هنا **قيمةٌ لا جملة**: حتى أربعة رموزٍ بلا بياض
   * (اسم، رقم، عنوان، مسار — والنقطة داخل الرمز مسموحة: gitlab.example.com).
   * وتصادمُه مع مفتاحٍ حرفي لا يضرّ: الحرفيّ يسبق الأنماط في المحرّك. ويبقى ما يمسّ الأمان كما في makePattern:
   * سقف المتغيّرات، والمتلاصقان (ReDoS)، والمحفوف من الطرفين بلا مرساة، و$رقم، ومتغيّرٌ عربي مخترع.
   * الخطر الباقي نصٌّ إنجليزي غير مترجَم يطابق النمط فيخرج مختلطًا — وبوابة الشمول تفحصه على الحصاد كله. */
  var BOUNDED_CAP = "([^\\s]+(?:\\s[^\\s]+){0,3}?)";
  // متغيّرُ عدٍّ أو مقدار يلتقط رمزًا واحدًا فيه رقم («5»، «$20.00»، «75%»، «1,234») — لا كلمات: «{count} Premium»
  // كان يجعل «Claude for Enterprise Premium» «Claude for Enterprise من Premium». و‎delta‎ (٢١ ربيع الآخر ١٤٤٨هـ): «Up {delta}»
  // بالتقاطٍ نصّي حوّل تحية الصفحة الرئيسية «Up late, …?» إلى «ارتفاع late, …?» — وقيمته نسبةٌ منسَّقة
  var NUMERIC_VAR = /^(count|n|num|number|total|percent|pct|percentage|amount|size|limit|days?|hours?|minutes?|mins?|seconds?|secs?|weeks?|months?|years?|remaining|used|max|min|index|position|price|cost|credits?|seats?|tokens?|quantity|qty|value|delta)$/i;
  var NUMERIC_CAP = "([^\\s]*\\d[^\\s]*)";
  function makePatternBounded(en, ar) {
    VAR_RE.lastIndex = 0;
    var names = [], m;
    var t = String(en).trim();
    while ((m = VAR_RE.exec(t))) names.push(m[1]);
    if (!names.length || names.length > 3) return null;
    if (/\}[\s\u00A0]*\{/.test(t)) return null;
    if (/\$\d/.test(ar)) return null;
    var literal = t.replace(VAR_RE, "").trim();
    if (!/[A-Za-z]{2}/.test(literal)) return null;
    if (/^\{[A-Za-z_$][\w$]*\}/.test(t) && /\{[A-Za-z_$][\w$]*\}$/.test(t)) return null;
    VAR_RE.lastIndex = 0;
    var m2;
    while ((m2 = VAR_RE.exec(ar))) if (names.indexOf(m2[1]) < 0) return null;
    var re = "^", idx = 0, mm;
    VAR_RE.lastIndex = 0;
    while ((mm = VAR_RE.exec(t))) {
      re += escapeRe(t.slice(idx, mm.index)) + (NUMERIC_VAR.test(mm[1]) ? NUMERIC_CAP : BOUNDED_CAP);
      idx = mm.index + mm[0].length;
    }
    re += escapeRe(t.slice(idx)) + "$";
    var arOut = String(ar).trim().replace(VAR_RE, function (whole, name) {
      var pos = names.indexOf(name);
      return pos < 0 ? whole : "$" + (pos + 1);
    });
    try { new RegExp(re); } catch (e) { return null; }
    return { en: t, re: re, ar: arOut, b: 1 };
  }

  /** طول النص الثابت — معيار فرز التخصيص (الأطول أخصّ فيُجرَّب أولًا) */
  function patternLiteralLen(p) { return String(p && p.en || "").replace(/\{[^{}]*\}/g, "").length; }

  /**
   * فرز القواعد بالتخصيص فرزًا مستقرًا. المحرك يأخذ أول نمط يطابق — فإن سبق الأعمُّ
   * الأخصَّ ابتلع النص وأخرج ترجمة خاطئة (39 حالة قيست على المدونة قبل الفرز).
   * @param {CmlRule[]} pats
   * @returns {CmlRule[]} مصفوفة جديدة مرتبة
   */
  // ترتيب قواعد المستخدم القانوني: التخصيص ثم هوية القاعدة (re) — ترتيبٌ كلّيٌّ لا يتبع ترتيب
  // الإدراج، وهو نفسه sortRules في cml-sync.js، فلا يختلف جهازان في ترتيب المحتوى نفسه
  function sortUserRules(pats) {
    function rk(p) { return p && typeof p.re === "string" && p.re ? p.re : "~" + JSON.stringify(p === undefined ? null : p); }
    return pats.map(function (p, i) { return { p: p, k: rk(p), i: i }; })
      .sort(function (a, b) {
        return (patternLiteralLen(b.p) - patternLiteralLen(a.p)) || (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i);
      })
      .map(function (x) { return x.p; });
  }
  function sortBySpecificity(pats) {
    return pats.map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return (patternLiteralLen(b.p) - patternLiteralLen(a.p)) || (a.i - b.i); })
      .map(function (x) { return x.p; });
  }

  /* ---------- فهرس الأنماط (٢١ ربيع الآخر ١٤٤٨هـ، توجيه المالك: لا سقف طولٍ يمنع تعريب نصّ موقع) ----------
   * كان نصٌّ فوق TEXT_MAX لا يُجرَّب عليه نمطٌ أصلًا، فالقالب الطويل لا يُترجم أبدًا. والسقف كان يحمي الأداء: كل نصٍّ
   * لاتينيٍّ غير مترجَم يُمسح عليه كلُّ نمطٍ يبدأ بمتغيّر (السلّة العامة) — ومسحُ تعبيرٍ مرتكز على نصٍّ طويل خطّيٌّ في طوله.
   * فالأداء الآن بالفهرسة لا بالإسقاط، والمطابقة كاملةٌ مرتكزة (^…$) كما كانت:
   *  ١) أول كلمةٍ ثابتة (patKey، كما كان في engine.js): النمط في سلّة كلمته؛
   *  ٢) وما بدأ بمتغيّر: في سلّة آخر محرفٍ من ذيله الثابت (patLiterals.suf)، وما لا ذيل ثابتًا له في سلّةٍ مفتوحة؛
   *  ٣) وقبل تشغيل أي تعبير: ثوابتُه اللازمة (بادئةٌ وذيلٌ ومقاطعُ وسطى بترتيبها) وأدنى طولٍ له — فحصٌ بـ indexOf
   *     خطّيٌّ رخيص يُسقط كلَّ نمطٍ لا يمكن أن يطابق، فنصٌّ طويلٌ لا يطابق شيئًا لا يُشغَّل عليه تعبيرٌ واحد غالبًا.
   * الترتيب (التخصيص، وأول مطابقٍ يفوز) محفوظ: الدمج بين السلال الثلاث بمؤشّراتٍ على الفهارس التصاعدية. */

  // المفتاح من **مصدر التعبير** لا من en: قاعدةٌ تبدأ بتناوبٍ (^(Jan|Feb|…)) يذكر en بديلًا واحدًا منها فيَضلّ الفهرس.
  // حروفٌ لاتينية تلي ^ مباشرةً، ولا تُعتمد إلا إذا قطع الحرفُ التالي الكلمةَ يقينًا (فراغ/ترقيم/\s/\b/نهاية) — وإلا
  // (? * + { | ( [ .) فلا مفتاح. (أُثبت التكافؤ مع المسح الخطي على الحصاد كله: صفر تعارض في 22,625 نصًّا.)
  function patKey(src) {
    var m = /^\^([A-Za-z]+)(.?)/.exec(String(src || ""));
    if (!m) return null;
    var next = m[2];
    if (next === "") return m[1];
    if (/[ ,.:;·-]/.test(next)) return m[1];
    if (next === "\\") { var nx = String(src).charAt(m[0].length); return (nx === "s" || nx === "b") ? m[1] : null; }
    return null;
  }
  // ثوابتُ نمطٍ مرتكزٍ من مصدر تعبيره: ما يلزم كلَّ نصٍّ يطابقه — {pre: بادئة، suf: ذيل، mids: مقاطع وسطى بترتيبها، min: أدنى طول}.
  // محافظ: ما لا يُفهم يقينًا (تناوبٌ في المستوى الأعلى، مرساةٌ في غير الطرفين، مرجعٌ خلفي، \p…) ⇒ null فيُجرَّب التعبير دائمًا.
  // والمحرفُ الثابت إذا تلاه مُكمِّم (? * + {n,m}) يُعدّ غير لازم.
  function patLiterals(src) {
    src = String(src == null ? "" : src);
    var n = src.length;
    if (n < 2 || src.charAt(0) !== "^" || src.charAt(n - 1) !== "$") return null;
    var bs = 0;
    for (var q = n - 2; q >= 0 && src.charAt(q) === "\\"; q--) bs++;
    if (bs % 2) return null; // ‎\$‎ في الطرف محرفٌ مهروب لا مرساة
    var end = n - 1, i = 1, toks = []; // محرفٌ ثابت (نصّ) أو null لغيره
    function skipClass(j) { // j عند «[» ⇒ الموضع بعد «]» أو -1
      j++;
      if (src.charAt(j) === "^") j++;
      if (src.charAt(j) === "]") j++;
      while (j < end) { var c = src.charAt(j); if (c === "\\") j += 2; else if (c === "]") return j + 1; else j++; }
      return -1;
    }
    while (i < end) {
      var c = src.charAt(i);
      if (c === "\\") {
        if (i + 1 >= end) return null;
        var e = src.charAt(i + 1);
        if (e === "u" && /^[0-9A-Fa-f]{4}$/.test(src.substr(i + 2, 4))) { toks.push(String.fromCharCode(parseInt(src.substr(i + 2, 4), 16))); i += 6; }
        else if (e === "x" && /^[0-9A-Fa-f]{2}$/.test(src.substr(i + 2, 2))) { toks.push(String.fromCharCode(parseInt(src.substr(i + 2, 2), 16))); i += 4; }
        else if (e === "n") { toks.push("\n"); i += 2; }
        else if (e === "t") { toks.push("\t"); i += 2; }
        else if (e === "r") { toks.push("\r"); i += 2; }
        else if (/[dDwWsSbB]/.test(e)) { toks.push(null); i += 2; }
        else if (/[A-Za-z0-9]/.test(e)) return null;
        else { toks.push(e); i += 2; } // ترقيمٌ مهروب: \. \? \( \$ \/ \- …
      } else if (c === "[") {
        var j = skipClass(i);
        if (j < 0) return null;
        toks.push(null); i = j;
      } else if (c === "(") {
        var depth = 0, k = i;
        for (; k < end; k++) {
          var ch = src.charAt(k);
          if (ch === "\\") { k++; continue; }
          if (ch === "[") { var jj = skipClass(k); if (jj < 0) return null; k = jj - 1; continue; }
          if (ch === "(") depth++;
          else if (ch === ")" && --depth === 0) break;
        }
        if (k >= end) return null;
        toks.push(null); i = k + 1;
      } else if (c === "*" || c === "+" || c === "?") {
        if (!toks.length) return null;
        toks[toks.length - 1] = null; i++;
        if (src.charAt(i) === "?") i++;
      } else if (c === "{") {
        var qm = /^\{\d+(,\d*)?\}/.exec(src.slice(i, end));
        if (!qm || !toks.length) return null;
        toks[toks.length - 1] = null; i += qm[0].length;
        if (src.charAt(i) === "?") i++;
      } else if (c === "|" || c === "^" || c === "$" || c === ")" || c === "]" || c === "}") return null;
      else if (c === ".") { toks.push(null); i++; }
      else { toks.push(c); i++; }
    }
    var runs = [], cur = "";
    for (var t = 0; t < toks.length; t++) {
      if (toks[t] === null) { if (cur) runs.push(cur); cur = ""; } else cur += toks[t];
    }
    if (cur) runs.push(cur);
    var startLit = toks.length > 0 && toks[0] !== null, endLit = toks.length > 0 && toks[toks.length - 1] !== null;
    var pre = startLit ? runs.shift() : "";
    var suf = endLit && runs.length ? runs.pop() : "";
    var min = pre.length + suf.length;
    for (var r = 0; r < runs.length; r++) min += runs[r].length;
    return { pre: pre, suf: suf, mids: runs, min: min };
  }
  // يمكن أن يطابق النمطُ ذو الثوابت L النصَّ s؟ (false يقينًا ⇒ لا يُشغَّل التعبير)
  function litMayMatch(L, s) {
    if (!L) return true;
    if (s.length < L.min) return false;
    if (L.pre && s.lastIndexOf(L.pre, 0) !== 0) return false;
    var lim = s.length - L.suf.length;
    if (L.suf && s.indexOf(L.suf, lim) !== lim) return false;
    var pos = L.pre.length;
    for (var i = 0; i < L.mids.length; i++) {
      var j = s.indexOf(L.mids[i], pos);
      if (j < 0 || j + L.mids[i].length > lim) return false;
      pos = j + L.mids[i].length;
    }
    return true;
  }
  // فهرسٌ لمصادر أنماطٍ مرتّبة (srcs[i] = re): find(text, fn, capMax) تستدعي fn(i) لكل نمطٍ مرشَّح بترتيب القائمة — ما لا
  // يمكن أن يطابق لا يُستدعى له — حتى تُرجع fn قيمةً صادقة فتُرجعها find (وإلا null).
  // capMax (اختياري): أقصى ما تلتقطه متغيّرات النمط من النص مجتمعةً (طولُ النص ناقصَ ثوابته اللازمة). القالبُ الطويل ثوابتُه
  // طويلةٌ فيمرّ، أما نمطٌ قصيرٌ عامّ («{a} or {b}.») فلا يبتلع فقرةً طويلةً لا تخصّه فيُخرجها مختلطة — والنصّ القصير
  // (≤ capMax) لا يمسّه هذا الشرط أصلًا. نمطٌ لا تُفهم ثوابته يُعدّ بلا ثوابت.
  function patternIndex(srcs) {
    var keyed = Object.create(null), bySuf = Object.create(null), open = [], lits = new Array(srcs.length), NONE = [];
    for (var i = 0; i < srcs.length; i++) {
      var k = patKey(srcs[i]), L = patLiterals(srcs[i]);
      lits[i] = L;
      if (k !== null) (keyed[k] = keyed[k] || []).push(i);
      else if (L && L.suf) { var c = L.suf.charAt(L.suf.length - 1); (bySuf[c] = bySuf[c] || []).push(i); }
      else open.push(i);
    }
    function find(text, fn, capMax) {
      var cm = capMax > 0 ? capMax : Infinity;
      var km = /^([A-Za-z]+)/.exec(text);
      var A = (km && keyed[km[1]]) || NONE, B = (text && bySuf[text.charAt(text.length - 1)]) || NONE, C = open;
      var a = 0, b = 0, c = 0, INF = Infinity;
      for (;;) {
        var x = a < A.length ? A[a] : INF, y = b < B.length ? B[b] : INF, z = c < C.length ? C[c] : INF;
        var i = x < y ? (x < z ? x : z) : (y < z ? y : z);
        if (i === INF) return null;
        if (i === x) a++; else if (i === y) b++; else c++;
        if (text.length - (lits[i] ? lits[i].min : 0) > cm) continue; // O(1) أولًا: الطويل يسقط هنا قبل أي بحث
        if (!litMayMatch(lits[i], text)) continue;
        var r = fn(i);
        if (r) return r;
      }
    }
    return { find: find, lits: lits, sizes: { keyed: Object.keys(keyed).length, suffix: Object.keys(bySuf).length, open: open.length } };
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
   *
   * ★ opt.ui (فحص الاتجاه الشامل ١٤٤٨هـ، ق٢): سطوحُ الواجهة والمتون خارج المحادثة — لا يكتب فيها
   * بلغة الهدف أحدٌ غيرُنا، فكتلةٌ حروفُها العربية أكثرُ من اللاتينية ترجمتُنا حتمًا ⇒ RTL ولو قصرت
   * («API الرسائل»: 7 مقابل 3، دون عتبة الأغلبية الحاسمة 12 فكانت تُترك لـauto فتُعرض LTR).
   * وفي كل حال: نصٌّ حروفُه القوية كلُّها داخل عزلٍ من اليمين (RLI…PDI، وهو ما يلفّ به المحرّك
   * ترجمتَه المختلطة) حُكمُه RTL — فـauto في كروم لا يتخطّى محارف العزل فيحسمه أولُ لاتينيٍّ فيه.
   */
  var RTL_ONE = new RegExp("[\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF]");
  var RTL_ALL = new RegExp("[\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF]", "g");
  var LTR_ONE = new RegExp("[A-Za-z\\u00C0-\\u024F]");
  var LTR_ALL = new RegExp("[A-Za-z\\u00C0-\\u024F]", "g");
  // ضجيجٌ بادئٌ محايدُ الدلالة اتجاهيًّا وإن كان لاتينيَّ المحارف
  var LEAD_NOISE = new RegExp(
    "^(?:\\s|[\\u2000-\\u2065\\u206A-\\u206F]|`[^`]*`|https?://\\S+|www\\.\\S+" +
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
  // مقاطعُ العزل من اليمين (RLI … PDI) غير المتداخلة — ما يلفّ به المحرّك ترجمتَه المختلطة
  var RLI_SEG = new RegExp("\\u2067[^\\u2066-\\u2069]*\\u2069", "g");
  function resolveDir(text, opt) {
    if (!text) return null;
    var s = String(text).slice(0, 600); // عيّنةٌ تكفي للحكم — ولا نمشي على نصٍّ طويل
    // ما قويُّه كلُّه داخل عزلٍ من اليمين: RTL (وما خرج عنه شيءٌ منه فللدرجات بعدُ)
    if (s.indexOf("\u2067") !== -1 && firstStrong(s.replace(RLI_SEG, " ")) === null) return "rtl";
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
    if (opt && opt.ui && r > l) return "rtl";       // خارج المحادثة: أغلبيةٌ عربية بسيطة تكفي
    return null;                                    // لم نجزم ⇒ اتركها لـdir="auto"
  }

  // ★ تعديلٌ جزئي للتصحيحات (مراجعة كودكس، ١-٠ج): الصفحة ترسل «ماذا تغيّر» لا الكائن كله،
  // ويطبّقه العامل على قراءةٍ طازجة تحت قفل دفتر المزامنة — فلا تكتب صفحةٌ فوق دمجٍ وقع بين
  // قراءتها وكتابتها. وهو المعقِّم الواحد للحفظ والإضافة والاستيراد (حدود النص كحدود المزامنة،
  // والقاعدة تُبنى هنا من نصّيها بحارس makePattern نفسه)، ومسارُ الصفحة المباشر حين لا عامل.
  //   ops: {op:"set", k, v, cap?} | {op:"del", k, ifv?} | {op:"rule", en, ar, cap?} | {op:"unrule", re}
  //   cap: السقف يُطبَّق على الجديد (الاستيراد)؛ ifv: لا يُحذف إلا إن بقيت القيمة كما رآها المستخدم
  var LANG_OK = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function badKey(k) { return k === "__proto__" || k === "constructor" || k === "prototype"; }
  function applyTermEdits(overrides, patterns, lang, ops, lim) {
    lim = lim || {};
    var textMax = lim.textMax || 300;
    var maxTerms = lim.maxTerms || Infinity, maxRules = lim.maxRules || Infinity;
    var root = {}, k0;
    var src = overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {};
    for (k0 in src) if (hasOwn(src, k0)) root[k0] = src[k0];
    var rep = { set: 0, del: 0, rule: 0, unrule: 0, capped: 0, skipped: 0 };
    var pats = Array.isArray(patterns) ? patterns.slice() : [];
    ops = Array.isArray(ops) ? ops : [];
    if (typeof lang !== "string" || !LANG_OK.test(lang)) {
      rep.skipped = ops.length;
      return { overrides: root, patterns: pats, ovChanged: false, patChanged: false, report: rep };
    }
    var cur = root[lang] && typeof root[lang] === "object" && !Array.isArray(root[lang]) ? root[lang] : {};
    var ov = {};
    for (k0 in cur) if (hasOwn(cur, k0)) ov[k0] = cur[k0];
    var nTerms = Object.keys(ov).length, ovCh = false, patCh = false;
    for (var n = 0; n < ops.length; n++) {
      var o = ops[n];
      if (!o || typeof o !== "object") { rep.skipped++; continue; }
      if (o.op === "set") {
        var k = o.k, v = o.v;
        if (typeof k !== "string" || typeof v !== "string" || !k || !v || badKey(k) ||
            k.length > textMax || v.length > textMax * 2 || (lim.keyRe && !lim.keyRe.test(k))) { rep.skipped++; continue; }
        var isNew = !hasOwn(ov, k);
        if (isNew && o.cap && nTerms >= maxTerms) { rep.capped++; continue; }
        if (ov[k] !== v) { ov[k] = v; ovCh = true; }
        if (isNew) nTerms++;
        rep.set++;
      } else if (o.op === "del") {
        if (typeof o.k !== "string" || !hasOwn(ov, o.k)) continue;
        if (o.ifv !== undefined && ov[o.k] !== o.ifv) { rep.skipped++; continue; }
        delete ov[o.k]; nTerms--; ovCh = true; rep.del++;
      } else if (o.op === "rule") {
        if (typeof o.en !== "string" || typeof o.ar !== "string" ||
            o.en.length > textMax || o.ar.length > textMax * 2) { rep.skipped++; continue; }
        var p = makePattern(o.en, o.ar);
        if (!p) { rep.skipped++; continue; }
        var idx = -1;
        for (var i = 0; i < pats.length; i++) if (pats[i] && pats[i].re === p.re) { idx = i; break; }
        if (idx < 0 && o.cap && pats.length >= maxRules) { rep.capped++; continue; }
        if (idx >= 0) pats[idx] = p; else pats.push(p);
        patCh = true; rep.rule++;
      } else if (o.op === "unrule") {
        var n0 = pats.length;
        pats = pats.filter(function (x) { return !x || x.re !== o.re; });
        if (pats.length !== n0) { patCh = true; rep.unrule++; }
      } else rep.skipped++;
    }
    if (patCh) pats = sortUserRules(pats);
    root[lang] = ov;
    return { overrides: root, patterns: pats, ovChanged: ovCh, patChanged: patCh, report: rep };
  }

  // ★ قواعد ما يقرؤه المحرّك من الصفحة (١-٠د) — المصدر الواحد للمحرّك ولحاصد DOM: الحاصد
  // (harvest-dom.mjs، أداة بناءٍ على جهاز المطوّر) يحقن هذا الملف في الصفحة ويستدعي harvestDom،
  // فمفاتيحه هي ما يبحث عنه المحرّك حرفًا بحرف. والمحرّك نفسه لا يستدعي harvestDom أبدًا:
  // ما يقرؤه للمطابقة عابرٌ لا يُخزَّن ولا يُراكَم ولا يُرسَل.
  var DOM_RULES = {
    // عناصرُ لا يُقرأ ما تحتها (تقليم الممشى، والأب المباشر لعقدة النص)
    SKIP: { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, KBD: 1, SAMP: 1 },
    // والسلف كله (شيفرةٌ ملفوفة في <span> داخل <pre><code>)
    SKIP_ANCESTOR: "script, style, noscript, textarea, code, pre, kbd, samp",
    ATTRS: ["placeholder", "aria-label", "title", "alt"],
    ATTR_SELECTOR: "[placeholder],[aria-label],[title],[alt]",
    // متن المحادثة في التطبيق (meta.chat) — لا يُقرأ ولا يُكتب
    // ★ (٢١ ربيع الآخر ١٤٤٨هـ) ومع رفع سقف الطول صار هذا الاستثناء الحمايةَ الوحيدة لنصّ المحادثة، فرُوجع على حزم claude.ai
    // اليوم: ‎.font-claude-message‎ لا أثر له فيها (0 من 2,656 حزمة)، وجواب Claude يُعرض في ‎[data-testid="assistant-message"]‎
    // ومتنُه Markdown بصنفٍ من ثلاثة: ‎standard-markdown‎ (المكتمل)، و‎progressive-markdown‎ (الجواب وهو يُبثّ)، و‎epitaxy-markdown‎
    // (العارض الجديد ومعاينة الملفات). فأُضيفت الثلاثة. (لا الحاوية كلّها: فيها شريط «نسخ/إعادة» ‎message-actions‎ وهو واجهة.)
    // ورسالة المستخدم ‎[data-testid="user-message"]‎ مشمولة، ومربع الكتابة قابلٌ للتحرير (isContentEditable) أو textarea.
    CHAT_ANCESTOR: ".prose, .font-claude-message, [data-testid*='user-message'], [data-testid*='message-content'], .standard-markdown, .progressive-markdown, .epitaxy-markdown",
  };
  // مفتاح البحث من نصٍّ خام: القصّ وحده؛ وما فرغ أو تجاوز السقف فلا مفتاح له
  function textKey(raw, max) {
    if (!raw) return null;
    var k = String(raw).trim();
    return !k || k.length > (max || 300) ? null : k;
  }
  // حارس المسار: routes = meta.routes للنطاق ({full, shell} بادئات، و{exact} مساراتٌ بعينها)؛ بلا routes فالنطاق كلّه كامل
  // ★ exact (وثائق Claude Code): المطابقة بالبادئة تضيف «/» ثم تقارن، فلا تجعل ‎/docs‎ كاملًا إلا وجعلت
  // ‎/docs/<locale>/…‎ كلها كاملة — والمساواةُ بعد نزع الشرطة الختامية تحصره فيه وحده (‎/docs‎ و‎/docs/‎)
  function trimSlash(p) { return String(p || "/").replace(/\/+$/, "") || "/"; }
  function routeMode(routes, pathname) {
    if (!routes) return "full";
    var path = String(pathname || "/") + "/", bare = trimSlash(pathname), i;
    for (i = 0; i < (routes.exact || []).length; i++) if (bare === trimSlash(routes.exact[i])) return "full";
    for (i = 0; i < (routes.shell || []).length; i++) if (path.indexOf(routes.shell[i]) === 0) return "shell";
    for (i = 0; i < (routes.full || []).length; i++) if (path.indexOf(routes.full[i]) === 0) return "full";
    return "inactive";
  }
  // ما يستثنيه حاصد DOM في صفحةٍ بحال حارسها (mode): المستثنى في النطاق كلّه (meta.skipSel — أجوبة مساعدٍ
  // مولَّدة) في كل مسار، ومحتوى المرجع (meta.shellSel) في مسار shell وحده — كما يستثنيهما المحرّك؛ وnull إن لا شيء
  // ★ (ر8-ج، ٣٠ ربيع الآخر ١٤٤٨هـ — مراجعة ر7-ب) ولافتات صدى العناوين (meta.echoSel) في كل مسار: نصُّها نصُّ عنوانٍ من المتن يكتبه المحرّك
  // (echoText) لا قاموس الواجهة، فلا يُحصد نصَّ واجهةٍ ناقصًا
  function harvestSkip(meta, mode) {
    var m = meta || {}, out = [];
    if (mode === "shell" && m.shellSel) out.push(m.shellSel);
    if (m.skipSel) out.push(m.skipSel);
    if (m.echoSel) out.push(m.echoSel);
    return out.length ? out.join(", ") : null;
  }
  function closestSafe(el, sel) {
    if (el && el.nodeType !== 1) el = el.parentNode;
    if (!el || el.nodeType !== 1 || !el.closest) return false;
    try { return !!el.closest(sel); } catch (e) { return false; }
  }
  // حاصد DOM — يمشي كما يمشي walk في المحرّك (التقليم نفسه ثم شرط translable لكل عقدة نص،
  // والسمات لكل عنصرٍ خارج المحادثة) ويُرجع [{key, kind: "text"|"attr:<اسم>"}] بترتيب الوثيقة.
  // opts: {chat: استثناء المحادثة كما في نطاق التطبيق، max: سقف الطول (Infinity: المحرّك بلا سقف منذ ٢١ ربيع الآخر ١٤٤٨هـ)، skip: محدِّدٌ مستثنى كلّه
  //        (harvestSkip: محتوى المرجع في مسار shell، وmeta.skipSel في كل مسار — كما يستثنيهما المحرّك)}
  function harvestDom(root, opts) {
    opts = opts || {};
    var R = DOM_RULES, chat = !!opts.chat, max = opts.max || 300, skip = opts.skip || null, out = [];
    var doc = root && (root.ownerDocument || root);
    if (!root || !doc || !doc.createTreeWalker) return out;
    if (root.nodeType === 1 && chat && closestSafe(root, R.CHAT_ANCESTOR)) return out;
    var els = root.nodeType === 1 ? [root] : [];
    if (root.querySelectorAll) els = els.concat(Array.prototype.slice.call(root.querySelectorAll(R.ATTR_SELECTOR)));
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.getAttribute || (chat && closestSafe(el, R.CHAT_ANCESTOR)) || (skip && closestSafe(el, skip))) continue;
      for (var a = 0; a < R.ATTRS.length; a++) {
        var ak = textKey(el.getAttribute(R.ATTRS[a]), max);
        if (ak) out.push({ key: ak, kind: "attr:" + R.ATTRS[a] });
      }
    }
    var NF = (doc.defaultView && doc.defaultView.NodeFilter) || { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
    var tw = doc.createTreeWalker(root, NF.SHOW_ELEMENT | NF.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          if (R.SKIP[n.nodeName] || n.isContentEditable) return NF.FILTER_REJECT;
          try { if (chat && n.matches && n.matches(R.CHAT_ANCESTOR)) return NF.FILTER_REJECT; } catch (e) {}
          try { if (skip && n.matches && n.matches(skip)) return NF.FILTER_REJECT; } catch (e) {}
          return NF.FILTER_SKIP;
        }
        var p = n.parentNode;
        if (!p || R.SKIP[p.nodeName] || p.isContentEditable) return NF.FILTER_REJECT;
        return NF.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = tw.nextNode())) {
      var p = n.parentNode;
      if (closestSafe(p, R.SKIP_ANCESTOR) || p.isContentEditable || (chat && closestSafe(p, R.CHAT_ANCESTOR)) ||
          (skip && closestSafe(p, skip))) continue;
      var tk = textKey(n.nodeValue, max);
      if (tk) out.push({ key: tk, kind: "text" });
    }
    return out;
  }

  // ★★ وضع الكتلة (المرحلة ٢) — المتون بوحدة الفقرة. المصدر الواحد للمحرّك والحاصد وأدوات البناء.
  // الكتلة: أطول تتابعٍ من إخوةٍ سطريين (نصٌّ ووسومٌ سطرية «نظيفة») تحت أقرب سلفٍ غير سطري — فلكل
  // عقدة نصٍّ مالكٌ واحد (بندٌ فيه فقرة: الفقرة كتلة؛ ونصُّ البند قبل قائمته المتداخلة كتلةٌ أخرى).
  // القالب: نصُّ الكتلة بمسافاتٍ مطبَّعة، ووسومها عناصرُ نائبة مرقّمة بترتيب ظهورها:
  //   زوجية لما يُترجم محتواه: <aN>…</aN> رابط، <bN> غامق، <iN> مائل، <sN> سائرها
  //   ذرّية لا يُكتب داخلها: <cN>محتواها</cN> شيفرةٌ يراها المترجم وتُنسخ حرفيًّا، و<gN/> ما لا نصَّ فيه (صورة، سطر، أيقونة)
  // البصمة 64 بتًا (مساران ببذرتين) على «إصدار التطبيع + القالب» فهرسُ القاموس. والكتابة قيمٌ في عقد
  // النص القائمة فقط — لا إنشاء ولا حذف ولا نقل — فتبقى الروابط والشيفرة ومعالجات الأحداث وتوافق React.
  var BLOCK = {
    V: 1,
    PAIRED: { A: "a", B: "b", STRONG: "b", I: "i", EM: "i", SPAN: "s", U: "s", S: "s", SUP: "s", SUB: "s",
              MARK: "s", SMALL: "s", ABBR: "s", CITE: "s", Q: "s", DEL: "s", INS: "s", TIME: "s", DFN: "s",
              LABEL: "s", BUTTON: "s", BDI: "s", FONT: "s" },
    CODE: { CODE: 1, KBD: 1, SAMP: 1, VAR: 1 },
    EMPTY: { IMG: 1, BR: 1, WBR: 1, SVG: 1, MATH: 1, INPUT: 1, PICTURE: 1 },
    MAX: 4000,   // سقف طول القالب (البحث بالبصمة لا يمسح الأنماط، فالسقف للذاكرة لا للزمن)
  };
  var PH_RE = /<(\/?)([abisgc])(\d{1,4})(\/?)>/g, PH_TEST = /<\/?[abisgc]\d{1,4}\/?>/;
  function tagOf(el) { return String(el.nodeName || "").toUpperCase(); }
  // نوع العنصر داخل الكتلة: "p" زوجيٌّ نظيف، "c" شيفرة، "g" ذرّةٌ بلا نص؛ null حدٌّ للكتلة
  // (غير سطري، أو سطريٌّ في داخله ما ليس سطريًّا — بطاقةٌ داخل رابط مثلًا)
  // ★ «فيه نص» يُحكم بالأصل (rawOf) لا بالقيمة الحالية: عربيةٌ أفرغت رابطًا («the» تسقط) كانت تجعله
  // ذرّةً في الاستخراج التالي فيتغيّر القالب وتُستعاد الإنجليزية ثم تُعرَّب — تقاذفٌ بلا نهاية
  function hasText(el, rawOf) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { if (/\S/.test((rawOf ? rawOf(c) : c.nodeValue) || "")) return true; }
      else if (c.nodeType === 1 && hasText(c, rawOf)) return true;
    }
    return false;
  }
  // ★ وفيه حرفٌ أو رقم؟ (قِيس في الوثائق: أيقوناتٌ في <span> بمحرفٍ من المنطقة الخاصة، وفواصل «·») — ما لا
  // حرف فيه ولا رقم ذرّةٌ معتمة بمحتواها (<cN>) لا خانةُ نصٍّ تُكتب: ترجمةٌ تُسقط المحرف الخفيّ كانت تمحو الأيقونة
  var WORD_RE = /[\p{L}\p{N}]/u;
  function hasWord(el, rawOf) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { if (WORD_RE.test((rawOf ? rawOf(c) : c.nodeValue) || "")) return true; }
      else if (c.nodeType === 1 && hasWord(c, rawOf)) return true;
    }
    return false;
  }
  // memo (اختياري): WeakMap لجولةٍ واحدة لا يتغيّر فيها البناء — بدونها يُعاد حساب النوع لكل عقدة نصٍّ في
  // فقرةٍ طويلة فيصير العمل تربيعيًّا (مراجعة المرحلة ٢)
  function inlineKind(el, rawOf, memo) {
    if (memo) { var mv = memo.get(el); if (mv !== undefined) return mv; }
    var t = tagOf(el), r;
    if (BLOCK.CODE[t]) r = "c";
    else if (BLOCK.EMPTY[t]) r = "g";
    else if (!BLOCK.PAIRED[t]) r = null;
    else {
      r = undefined;
      for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && !inlineKind(c, rawOf, memo)) { r = null; break; }
      if (r === undefined) r = !hasText(el, rawOf) ? "g" : hasWord(el, rawOf) ? "p" : "c";
    }
    if (memo) memo.set(el, r);
    return r;
  }
  // موضع عقدة نصٍّ من كتلتها: {owner المالك غير السطري، top ابنُه الذي يحويها}؛ null داخل ذرّة
  function blockOwner(node, rawOf, memo) {
    var top = node, p = node && node.parentNode;
    while (p && p.nodeType === 1) {
      var k = inlineKind(p, rawOf, memo);
      if (k === "c" || k === "g") return null;
      if (!k) return { owner: p, top: top };
      top = p; p = p.parentNode;
    }
    return null;
  }
  function inRun(n, rawOf, memo) { return n.nodeType === 3 || n.nodeType === 8 || (n.nodeType === 1 && !!inlineKind(n, rawOf, memo)); }
  function blockBounds(top, rawOf, memo) {
    var first = top, last = top, s;
    while ((s = first.previousSibling) && inRun(s, rawOf, memo)) first = s;
    while ((s = last.nextSibling) && inRun(s, rawOf, memo)) last = s;
    return { first: first, last: last };
  }
  function collapseWs(s) { return String(s).replace(/\s+/g, " "); }
  // نصُّ عنصرٍ كما textContent لكن بأصل كل عقدة (rawOf) — والحاصد (rawOf = القيمة) يرى textContent نفسه حرفًا بحرف
  function rawTextOf(el, rawOf) {
    var s = "";
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) s += (rawOf ? rawOf(c) : c.nodeValue) || "";
      else if (c.nodeType === 1) s += rawTextOf(c, rawOf);
    }
    return s;
  }
  // ★ (S6-C، دليل الأسلوب §٩) علامةُ ترقيمٍ لاتينية منفردة يلفّها الموقع في عنصرٍ وحدها (<cN>,</cN> — قِيس في مقالتين من
  // مركز المساعدة) ذرّةٌ تُنسخ حرفيًّا فتبقى «,» لاتينيةً وسط جملةٍ عربية. تُبدَّل عند الكتابة بنظيرها العربي في عقدة نصّها
  // القائمة (لا إنشاء ولا حذف) إذا كُتبت الكتلة كلّها عربية، وتُستعاد مع الكتلة. وما كان شيفرةً حقيقية (code وkbd…) لا يُمسّ.
  var PUNCT_AR = { ",": "\u060C", ";": "\u061B", "?": "\u061F" };
  function punctAtoms(ex, rawOf) {
    var out = [];
    for (var i = 0; i < ex.toks.length; i++) {
      var t = ex.toks[i];
      if (t.t !== "a" || t.k !== "c" || !t.el || !hasOwn(PUNCT_AR, t.body) || BLOCK.CODE[tagOf(t.el)]) continue;
      var tn = (function find(el) {
        for (var c = el.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3 && ((rawOf ? rawOf(c) : c.nodeValue) || "").trim() === t.body) return c;
          if (c.nodeType === 1) { var f = find(c); if (f) return f; }
        }
        return null;
      })(t.el);
      if (tn) out.push([tn, PUNCT_AR[t.body]]);
    }
    return out;
  }
  // ★ (S6-C، المراجعة العدائية — ٢١ ربيع الآخر ١٤٤٨هـ) مقطعٌ لاتيني في طرفه محايدٌ داخل جملةٍ عربية يُرسم مقلوب الطرف:
  // «وC#» تُرسم «#C»، و«.NET Standard 2.0+،» تُرسم «+NET Standard 2.0.»، و«ملفات .docx» «docx.»، و«/status» «status/»
  // (المحايد بين لاتينيٍّ وعربي يأخذ اتجاه الفقرة RTL — قِيس في الوثائق 89 موضعًا وفي المساعدة 159 عند الكتابة).
  // علاجُ المترجمين في البيانات علامةُ LRM ملاصقة («.md»)؛ وهذه هي نفسها عند الكتابة في نصّ الترجمة (لا الذرّات):
  // بعد المحايدات الختامية [#+] لمقطعٍ لاتيني لا يليها حرفٌ لاتيني ولا رقم، وقبل البادئة [.#@~/] لمقطعٍ لاتيني بعد
  // مسافةٍ أو عربيٍّ أو قوسٍ فاتح (لا بعد لاتيني، ولا داخل عنوانٍ أو بريد: «https://» و«a@b.com» كما هما).
  // ما جاورته علامةٌ قائمة لا يُمسّ؛ والدالة متكافئة التكرار فالقيمة نفسها في كل جولة (والسجلّ يحفظ المكتوب)
  // ★ (ر6-هـ، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ لـت4، R1) والمحايدات الختامية أيضًا [/[]\] (تركيبات المفاتيح «Cmd+/» و«Cmd+]» و«Cmd+[» و«Cmd+\»):
  // كانت العلامة تقع بعد «+» وحده فيبقى ما بعده محايدًا بين العلامة وما يليها من عربيٍّ أو قوسٍ فيأخذ اتجاه الفقرة، فيُرسم «/Cmd+» و«[Cmd+»
  // (والقوس يُعكس شكله أيضًا) — قِيس في 10 كتلٍ من المساعدة. فالذيل كلُّه («+/» و«+]») يُعلَّم بعلامةٍ واحدةٍ بعده، ومثله مقطعٌ ينتهي بـ«/» وحدها
  // (مسارٌ أو عنوان: «src/» و«claude.ai/code/») فلا تنتقل الشَّرطة إلى أوله. والقوس والشرطة المائلة العكسية في الذيل بعد «+» أو «#» وحدها (مفتاحٌ
  // في تركيبة): القوسان المتقابلان («[Enterprise].»، «[Claude app] →») تحسمهما قاعدة الأقواس (N0) قبل أي علامةٍ فلا يتغيّر رسمهما بها، فلا تُزاد
  // فيهما (كانت ستمسّ 30 كتلةً بلا أثرٍ مرئي). وذيلٌ من هذه يُعلَّم عند نهاية الوحدة وحدها: مسافةٌ يليها غيرُ حرفٍ لاتيني أو رقم (عربيٌّ أو قوس)،
  // أو آخرُ النص، أو ترقيمٌ ملاصقٌ يليه مسافةٌ أو آخرُ النص أو حرفٌ عربي («Cmd+/،»). فلا يُعلَّم:
  //   - ما يليه حرفٌ عربيٌّ ملاصق: «/» فاصلةٌ بين كلمتين («Claude/وحدة التحكّم» و«SSO/تسجيل الدخول») — العلامة تنقلها إلى الجانب الآخر؛
  //   - ولا داخل معرّفٍ أو مسار: «…/documents/{id}» و«projects/<project>/» (علامةٌ خفيّة فيما يُنسخ)؛
  //   - ولا ما يليه حرفٌ لاتيني أو رقم («TCP/IP»، «C++/CLI»).
  // والذيل من [#+] وحدها كما كان
  var LTR_AR_W = "\\u0620-\\u0669\\u066E-\\u06D3\\u06D5-\\u06FF";   // حرفٌ عربيٌّ أو حركةٌ أو رقمٌ عربي — لا «،» ولا «؛» ولا «؟»
  var LTR_TAIL = new RegExp("([A-Za-z](?:[A-Za-z0-9._\\-/ ]*[A-Za-z0-9])?)(?:" +
    "((?:[#+]+[\\/\\[\\]\\\\]|\\/)[#+\\/\\[\\]\\\\]*)(?![#+\\/\\[\\]\\\\\\u200E])(?=\\s+[^\\sA-Za-z0-9]|\\s*$|[^\\sA-Za-z0-9" + LTR_AR_W + "]+(?:\\s|$|[" + LTR_AR_W + "]))" +
    "|([#+]+)(?![#+\\/\\[\\]\\\\\\u200E])(?=\\s*(?:[^\\sA-Za-z0-9]|$)))", "g");
  var LTR_HEAD = new RegExp("(?<=^|[\\s\\u0600-\\u06FF(\\u00AB\"'])(?<![A-Za-z0-9]\\s+)([.#@~/]+)(?=[A-Za-z])", "g");
  function ltrMarks(s) {
    s = String(s);
    if (!/[#+.@~\/\[\]\\]/.test(s) || !/[A-Za-z]/.test(s)) return s;
    return s.replace(LTR_TAIL, "$1$2$3\u200E").replace(LTR_HEAD, "\u200E$1");
  }
  // ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ — ملاحظة المالك ٢(ج)) قوسان في محتواهما حرفٌ لاتيني ولا حرف من اليمين داخل ترجمةٍ إلى لغةٍ من اليمين: «إدارة الهوية (SSO, JIT, SCIM)»
  // سليمةٌ على سطرٍ واحد، فإن التفّت داخل القوسين انكسرت: قاعدة الأقواس في خوارزمية الاتجاه (N0) تعطي القوسين اتجاه الفقرة متى كان أول حرفٍ قويٍّ
  // قبلهما من اليمين (أو رقمًا، أو بداية الفقرة) والمحتوى من اليسار، فيُرى في السطر الأول «SSO, JIT,)» وفي الثاني «(SCIM». والعلاج علامة LRM
  // ملاصقةٌ قبل القوس الفاتح وبعد المغلق (كما يفعل المترجمون في البيانات، وكـltrMarks): الحرف القوي قبل القوس من اليسار فيصير القوسان من اليسار
  // مع محتواهما، فتلتفّ الوحدة كما تلتفّ عبارةٌ لاتينية («(SSO, JIT,» ثم «SCIM)»)، ورسمُها على سطرٍ واحد هو رسمها بلا علامةٍ حرفًا.
  // ★ (ر5-ج، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر5-أ F2) وما يليها رقمًا أوروبيًّا أو حرفًا لاتينيًّا (بعد مسافةٍ أو محايدات) كان ينضمّ إليها بعد
  // علامتها الختامية في وحدةٍ من اليسار (القاعدتان W7 وN1) فيقع على الجانب الآخر منها: «77 (uint8)». فتليها علامة RLM أيضًا: يصير
  // أقرب حرفٍ قويٍّ قبل التابع من اليمين، فيبقى التابع وحدةً مستقلة إلى يسار القوسين كما في رسمها بلا علامة («(uint8) 77»)، والقوسان
  // على حالهما (سياقهما علامة LRM قبلهما). ويُحسب ذلك في الجولة نفسها: ما بعد زوجٍ معلَّمٍ يرى علامتيه، فتبقى الدالة متكافئة التكرار.
  // وقِيس في كروم أن العزل (LRI…PDI) يصلح الأقواس كذلك، لكنه في ‎white-space: break-spaces‎ (متون Intercom) يُسقط فرصة الالتفاف قبله ويغيّر
  // ارتفاع السطر فتنقسم الروابط الطويلة («identit|y»)؛ والعلامة لا تغيّر التفافًا ولا ارتفاعًا في الأوضاع الثلاثة (normal وpre-wrap وbreak-spaces)،
  // ومنها محتوًى فيه أرقام («(Claude Opus 4)»: الرقم بعد اللاتيني لاتينيٌّ بقاعدة W7). ولا يُعلَّم غير ذلك:
  //   - قوسٌ أول حرفٍ قويٍّ قبله لاتيني («Claude (beta)»): القاعدة نفسها تضمّه إلى العبارة اللاتينية فلا ينكسر؛
  //   - قوسٌ ملتصقٌ بكلمةٍ في أحد طرفيه («f(x)»)، أو فيه حرفٌ من اليمين، أو لا حرف لاتينيًّا فيه («(25)»)، أو فيه علامة عزلٍ أو تضمين،
  //     أو معلَّمٌ قبلُ (فالدالة متكافئة التكرار).
  // وتفهم قوالب الكتل: الرموز النائبة محايدة، وذرّة الشيفرة ‎<cN>…</cN>‎ محايدةٌ كذلك في السياق — ★ (ر5-ج — مراجعة ر5-أ F1) كانت تُعدّ حرفًا
  // لاتينيًّا، والصفحة تعزلها (base.css: ‎code, kbd, samp { unicode-bidi: isolate }‎) فيراها السطر محايدًا وتنظر القاعدة N0 من ورائها إلى
  // الكلمة العربية: فقوسٌ لاتيني بعد شيفرةٍ سطرية («صيغة ‎<c1>xn--</c1>‎ (Punycode)») كان لا يُعلَّم وينكسر حين يلتفّ. ولا تُعدّ ملاصقةً لقوسٍ
  // بجانبها، وهي داخل القوسين محتوًى لاتيني (تُرسم من اليسار)، ولا يُعدّ قوسٌ داخلها، وتقع العلامات في خانات النص وحدها. ‎startRtl‎: بداية النص
  // بداية فقرةٍ من اليمين (الترجمة الملفوفة بـRLI، وقالب الكتلة المعرَّبة)، فقوسٌ لا حرف قويًّا قبله يُعلَّم؛ وإلا تُرك. المحرّك يستدعيها للغةٍ
  // من اليمين وحدها (bidiWrap وكتابات الكتل)
  var PAR_LRM = String.fromCharCode(0x200E), PAR_RLM = String.fromCharCode(0x200F), PAR_CODE = String.fromCharCode(1);
  var BIDI_CTL = new RegExp("[" + String.fromCharCode(0x202A) + "-" + String.fromCharCode(0x202E) + String.fromCharCode(0x2066) + "-" + String.fromCharCode(0x2069) + "]");
  var PAR_TOK = /<c(\d{1,4})>[\s\S]*?<\/c\1>|<\/?[abisg]\d{1,4}\/?>/g;
  var PAR_EN = /[0-9۰-۹]/;   // أرقامٌ أوروبية (EN): تصير من اليسار بعد علامة LRM (W7) — والعربية-الهندية (AN) لا
  function ltrParens(s, startRtl) {
    s = String(s);
    if (s.indexOf("(") < 0 || !/[A-Za-z]/.test(s)) return s;
    // نسخةٌ بالطول نفسه: الشيفرة محرفٌ داخلي محايد (PAR_CODE) والرموز مسافات — فتُقرأ الأقواس والسياق منها وتُكتب العلامات في الأصل بالمواضع نفسها
    var view = s.replace(PAR_TOK, function (t) { return (/^<c/.test(t) ? PAR_CODE : " ").repeat(t.length); });
    var cuts = [], marks = {};   // marks[موضع]: آخر علامةٍ ستُكتب بعد زوجٍ معلَّمٍ في هذه الجولة ("L" أو "R") — يراها ما بعده
    view.replace(/\(([^()]*)\)/g, function (m, inner, at) {
      var end = at + m.length, before = view.charAt(at - 1), after = view.charAt(end);
      var codeOnly = !/[A-Za-z]/.test(inner);
      if (codeOnly && inner.indexOf(PAR_CODE) < 0) return m;
      // ★ (ر5-ج، المراجعة المستقلة — الصنف c944fede1d7c) والزوج الذي لا يحوي إلا عنصرًا واحدًا من نوع ‎<sN>‎ كالشيفرة في ذلك: الزرّ يُرسم inline-block
      // (وكروم يجعل ‎display:inline‎ في الزرّ كذلك) فهو ذرّةٌ محايدة لا يرى خطُّ الاتجاه نصَّها، فكان «وحدة استهلاك Claude (<s1>CCU</s1>)» في جدول
      // الأسعار يأخذ قوساه اتجاه الفقرة فينقلبان حول الزرّ وينكسران حين تلتفّ الخلية. والعنصر السطري العادي تحسم القاعدة N0 قوسيه من اليسار أصلًا
      // بعد لاتيني، فلا تغيّر العلامة رسمه في سطرٍ ولا التفاف
      var atomOnly = codeOnly || /^\s*<s(\d{1,4})>[^<]*<\/s\1>\s*$/.test(s.slice(at + 1, end - 1));
      if (RTL_ONE.test(inner) || BIDI_CTL.test(s.slice(at, end))) return m;
      if (before === PAR_LRM && after === PAR_LRM) return m;
      if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after) || LTR_ONE.test(before) || LTR_ONE.test(after)) return m;
      var ctx = startRtl ? "R" : "";
      for (var i = at - 1; i >= 0; i--) {
        if (marks[i + 1]) { ctx = marks[i + 1]; break; }
        var c = view.charAt(i);
        if (LTR_ONE.test(c) || c === PAR_LRM) { ctx = "L"; break; }
        if (RTL_ONE.test(c) || /[0-9]/.test(c) || c === PAR_RLM) { ctx = "R"; break; }
      }
      if (ctx !== "R" && !(ctx === "L" && atomOnly)) return m;
      // التابع: أول حرفٍ قويٍّ أو رقمٍ بعد الزوج (المحايدات والشيفرة المعزولة تُتخطّى): "L" لاتينيٌّ أو رقمٌ أوروبي (أو علامة LRM)، و"R" من
      // اليمين، و"" لا شيء. ورقمٌ بإشارةٍ ملاصقة («-51») تابعٌ لاتيني تُعلَّم إشارته (sign)
      var fol = "", sign = -1, j = end;
      while (j < view.length && /\s/.test(view.charAt(j))) j++;
      var cont = view.charAt(j) === "," || view.charAt(j) === ";";
      for (; j < view.length; j++) {
        var f = view.charAt(j);
        if (f.charCodeAt(0) === 0x060C) continue;   // الفاصلة العربية محايدةٌ في خوارزمية الاتجاه (CS) وإن وقعت في مدى العربية
        if ((f === "-" || f === "+") && PAR_EN.test(view.charAt(j + 1))) { fol = "L"; sign = j; break; }
        if (LTR_ONE.test(f) || PAR_EN.test(f) || f === PAR_LRM) { fol = "L"; break; }
        if (RTL_ONE.test(f) || f === PAR_RLM) { fol = "R"; break; }
      }
      // ★ (ر5-ج) زوجٌ لا حرف قويًّا فيه غير الشيفرة المعزولة لا تحسمه القاعدة N0، فيأخذ القوسان اتجاه المحايدات حولهما: من اليسار إن كان
      // قبلهما وبعدهما لاتيني («Console (<c1>x</c1>) Code»)، وإلا اتجاه الفقرة من اليمين فينكسران حين تلتفّ الشيفرة — فيُعلَّم ما لم يكن تابعه لاتينيًّا.
      // ★ (المراجعة المستقلة) وهذا وحده يغيّر رسم السطر الواحد: تصير العبارة اللاتينية قبله معه وحدةً من اليسار («Claude Console (platform.claude.com)»)
      // كما تُرسم لو لم تُعزل الشيفرة، وكان القوسان بلا علامةٍ يقعان يسارها في ترتيب الفقرة («(platform.claude.com) Claude Console»)
      if (ctx === "L" && (fol === "L" || cont)) return m;
      // وتابعٌ لاتيني بعد زوجٍ معلَّم يلحقه RLM (F2 أعلاه)، إلا بعد فاصلةٍ أو فاصلةٍ منقوطة لاتينيتين: الجملة العربية تفصل بـ«،» و«؛» (الدليل)،
      // فاللاتينيتان استمرارُ عبارةٍ إنجليزية واحدة يبقى التابع فيها معه («(Yeoksam-dong), 41F, 152 Teheran-ro…»)
      var rlm = fol === "L" && !cont;
      if (!rlm) sign = -1;
      cuts.push([at, end, rlm, sign]);
      marks[end] = rlm ? "R" : "L";
      return m;
    });
    for (var k = cuts.length - 1; k >= 0; k--) {
      var cu = cuts[k];
      if (cu[3] >= 0) s = s.slice(0, cu[3]) + PAR_LRM + s.slice(cu[3]);
      s = s.slice(0, cu[0]) + PAR_LRM + s.slice(cu[0], cu[1]) + PAR_LRM + (cu[2] ? PAR_RLM : "") + s.slice(cu[1]);
    }
    return s;
  }
  function tokStr(t) {
    if (t.t === "o") return "<" + t.k + t.id + ">";
    if (t.t === "c") return "</" + t.k + t.id + ">";
    return t.k === "c" ? "<c" + t.id + ">" + t.body + "</c" + t.id + ">" : "<g" + t.id + "/>";
  }
  // استخراج الكتلة [first..last]: {tpl, fp, toks, slots:[{nodes, raw}], lead, trail, single}.
  // الخانة: عقدُ النص بين عنصرين نائبين متتاليين (texts.length = toks.length + 1).
  // rawOf(عقدة) يعيد أصلها (المحرّك: الإنجليزيَّ لما كتبه هو؛ الحاصد: القيمة نفسها).
  // single: عقدة النص الوحيدة ذات المحتوى إن لم يكن في الكتلة غيرها ولا شيفرة (تُبحث في قاموس الواجهة أولًا).
  // group: صفُّ لافتاتٍ لا جملة — عنصران أو أكثر في المستوى الأعلى ولا نصَّ بينها (ألسنة «cURL/CLI/Python»،
  //        وسوم البطاقات): [عقدةُ كل بندٍ الوحيدة أو null]؛ إن لم تُترجم الكتلة كلّها عُرِّب كل بندٍ وحده.
  // null: لا حرف لاتيني خارج الشيفرة، أو قالبٌ فوق السقف، أو نصٌّ يشبه عنصرًا نائبًا حرفيًّا.
  function extractBlock(first, last, rawOf, max, memo) {
    rawOf = rawOf || function (t) { return t.nodeValue; };
    var slots = [{ nodes: [], raw: "" }], toks = [], n = 0, filled = [], code = false, depth = 0;
    // ★ صفّ لافتاتٍ «متراصّ» وحده (لا بياض بين بنوده ولا على أطرافها): جملةٌ موزّعةٌ على وسومٍ متجاورة
    // («<a>Contact Support</a><span> if you cannot sign in.</span>») ليست لافتات فلا يُعرَّب جزؤها وحده
    var free = false, items = [], item = null, iraw = [], loose = false, wsGap = false;
    function cut(tok) { toks.push(tok); slots.push({ nodes: [], raw: "" }); }
    function visit(x) {
      if (x.nodeType === 3) {
        var s = slots[slots.length - 1], r = rawOf(x) || "";
        s.nodes.push(x); s.raw += r;
        if (depth > 0 && iraw.length) iraw[iraw.length - 1] += r;
        else if (depth === 0 && !/\S/.test(r) && r && items.length) wsGap = true;
        if (/\S/.test(r)) { filled.push(x); if (depth === 0) free = true; else if (item) item.push(x); }
        return;
      }
      if (x.nodeType !== 1) return;
      var k = inlineKind(x, rawOf, memo), id = ++n;
      if (depth === 0) { if (wsGap) loose = true; wsGap = false; item = []; items.push(item); iraw.push(""); }
      if (k === "c") {
        // ★ (S6-C) محتوى الذرّة بأصلها (rawOf) لا بقيمتها الحالية: علامةُ ترقيمٍ منفردة في ذرّتها يبدّلها المحرّك عند الكتابة
        // («,» ← «،») فكانت قيمتها الجديدة تغيّر القالب والبصمة في الجولة التالية فتُستعاد الإنجليزية — تقاذف
        var body = collapseWs(rawTextOf(x, rawOf)).trim();
        if (WORD_RE.test(body)) code = true;   // شيفرةٌ حقيقية؛ أيقونةٌ أو فاصلٌ لا يمنع «العقدة الوحيدة»
        cut({ t: "a", k: "c", id: id, body: body, el: x });
        return;
      }
      if (k !== "p") { cut({ t: "a", k: "g", id: id }); return; }
      var L = BLOCK.PAIRED[tagOf(x)];
      cut({ t: "o", k: L, id: id });
      depth++;
      for (var c = x.firstChild; c; c = c.nextSibling) visit(c);
      depth--;
      cut({ t: "c", k: L, id: id });
    }
    for (var x = first; x; x = x.nextSibling) { visit(x); if (x === last) break; }
    var E = slots.length - 1, texts = [], i;
    for (i = 0; i <= E; i++) texts.push(collapseWs(slots[i].raw));
    texts[0] = texts[0].replace(/^ /, "");
    texts[E] = texts[E].replace(/ $/, "");
    var letters = false;
    for (i = 0; i <= E; i++) {
      if (PH_TEST.test(texts[i])) return null;
      if (/[A-Za-z]/.test(texts[i])) letters = true;
    }
    if (!letters) return null;
    var tpl = texts[0];
    for (i = 0; i < toks.length; i++) {
      if (toks[i].body && PH_TEST.test(toks[i].body)) return null;
      tpl += tokStr(toks[i]) + texts[i + 1];
    }
    if (tpl.length > (max || BLOCK.MAX)) return null;
    return {
      tpl: tpl, fp: fp64("b" + BLOCK.V + "\n" + tpl), toks: toks, slots: slots, texts: texts,
      lead: /^\s*/.exec(slots[0].raw)[0], trail: /\s*$/.exec(slots[E].raw)[0],
      single: filled.length === 1 && !code ? filled[0] : null,
      // بندٌ من عقدةٍ واحدة ⇒ عقدته؛ بندٌ بعقدٍ عدّة فيها حروف ⇒ false (يحتاج ترجمةً ولا يُعرَّب وحده)؛ وإلا null
      group: !free && !loose && items.length >= 2 && !iraw.some(function (t) { return /^\s|\s$/.test(t); }) ? items.map(function (it) {
        if (it.length === 1) return it[0];
        return it.some(function (t) { return /[A-Za-z]/.test(rawOf(t) || ""); }) ? false : null;
      }) : null,
    };
  }
  // تحليل قالبٍ إلى {toks, texts}؛ null إن اختلّ (إغلاقٌ بلا فتح أو متقاطع، رقمٌ مكرّر، ذرّةٌ بغير صيغتها).
  // الشيفرة بصيغتين: الطويلة <cN>محتواها</cN> (المصدر) والقصيرة <cN/> (تُقبل في العربية)
  function parseTemplate(s) {
    s = String(s);
    var re = new RegExp(PH_RE.source, "g"), m, last = 0, texts = [], toks = [], stack = [], ids = {};
    while ((m = re.exec(s))) {
      var close = m[1] === "/", k = m[2], id = +m[3], self = m[4] === "/";
      if (close && self) return null;
      texts.push(s.slice(last, m.index));
      if (!close && ids[id]) return null;
      if (k === "c" && !close && !self) {
        var end = "</c" + m[3] + ">", e = s.indexOf(end, re.lastIndex);
        if (e < 0) return null;
        var body = s.slice(re.lastIndex, e);
        if (PH_TEST.test(body)) return null;
        ids[id] = 1; toks.push({ t: "a", k: "c", id: id, body: collapseWs(body).trim() });
        last = re.lastIndex = e + end.length;
        continue;
      }
      if (self) {
        if (k !== "g" && k !== "c") return null;
        ids[id] = 1; toks.push({ t: "a", k: k, id: id, body: null });
      } else if (!close) {
        if (k === "g" || k === "c") return null;
        ids[id] = 1; stack.push(k + id); toks.push({ t: "o", k: k, id: id });
      } else {
        if (stack.pop() !== k + id) return null;
        toks.push({ t: "c", k: k, id: id });
      }
      last = re.lastIndex;
    }
    if (stack.length) return null;
    texts.push(s.slice(last));
    return { toks: toks, texts: texts };
  }
  // ★ عقد قابلية التمثيل (مراجعة كودكس، المرحلة ٢): هل يُكتب القالب العربي ar في كتلةٍ رموزُها srcToks؟
  // الرموز نفسها عددًا وترتيبًا ونوعًا ورقمًا (فلا نقل ولا حذف ولا إنشاء لعنصر)، ومحتوى الشيفرة إن
  // ذُكر هو نفسه، ولا نصَّ في خانةٍ لا عقدة نصٍّ فيها (canHold(i)). يُرجع نصوص الخانات أو null.
  function fitTemplate(srcToks, ar, canHold) {
    var a = parseTemplate(ar);
    if (!a || a.toks.length !== srcToks.length) return null;
    for (var i = 0; i < srcToks.length; i++) {
      var x = srcToks[i], y = a.toks[i];
      if (x.t !== y.t || x.k !== y.k || x.id !== y.id) return null;
      if (x.k === "c" && y.body !== null && y.body !== x.body) return null;
    }
    for (var j = 0; j < a.texts.length; j++) if (/\S/.test(a.texts[j]) && !canHold(j)) return null;
    return a.texts;
  }
  // كتابات الكتلة: [[عقدة، قيمة]…] أو null إن لم يصلح القالب. الخانة كلها في أول عقدها وما بعدها
  // يُفرَّغ، ومسافةُ صدر الكتلة وعجزها الأصليتان تبقيان
  function blockWrites(ex, ar) {
    var texts = fitTemplate(ex.toks, ar, function (i) { return ex.slots[i].nodes.length > 0; });
    if (!texts) return null;
    var out = [], E = ex.slots.length - 1;
    for (var i = 0; i <= E; i++) {
      var nodes = ex.slots[i].nodes;
      if (!nodes.length) continue;
      var v = texts[i];
      if (i === 0) v = ex.lead + v.replace(/^\s+/, "");
      if (i === E) v = v.replace(/\s+$/, "") + ex.trail;
      out.push([nodes[0], v]);
      for (var j = 1; j < nodes.length; j++) out.push([nodes[j], ""]);
    }
    return out;
  }
  // تحقّقُ دفعةٍ بلا DOM (أدوات البناء): القالب العربي صالحٌ لمصدره؟ خانةٌ فارغةٌ في المصدر لا عقدة لها
  function checkBlock(src, ar) {
    var s = parseTemplate(src);
    if (!s) return "قالب المصدر مختلّ";
    if (!parseTemplate(ar)) return "رموز الترجمة مختلّة (رمزٌ بلا إغلاق، أو إغلاقٌ متقاطع، أو رقمٌ مكرّر)";
    var t = fitTemplate(s.toks, ar, function () { return true; });
    if (!t) return "الرموز لا تطابق الأصل عددًا أو ترتيبًا أو نوعًا — انسخها كما في الأصل وبترتيبها";
    for (var j = 0; j < t.length; j++) {
      if (!/\S/.test(t[j]) || s.texts[j] !== "") continue;
      if (j === 0) return "لا يُكتب نصٌّ قبل " + tokStr(s.toks[0]) + " لأن الأصل يبدأ به (لا موضع للنص هناك)";
      if (j === t.length - 1) return "لا يُكتب نصٌّ بعد " + tokStr(s.toks[j - 1]) + " لأن الأصل ينتهي به (لا موضع للنص هناك)";
      return "لا يُكتب نصٌّ بين " + tokStr(s.toks[j - 1]) + " و" + tokStr(s.toks[j]) + " لأنهما متلاصقان في الأصل";
    }
    return null;
  }
  // بصمة 64 بتًا: مساران 32 بتًا ببذرتين (خلطُ cyrb53) — 16 خانةً ست عشرية
  function fp64(str) {
    str = String(str);
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ("0000000" + (h2 >>> 0).toString(16)).slice(-8) + ("0000000" + (h1 >>> 0).toString(16)).slice(-8);
  }
  function blockFp(tpl) { return fp64("b" + BLOCK.V + "\n" + tpl); }
  // مفتاح الصفحة لقطعة المتون: مقالات Intercom ومجموعاتها برقمها (العنوان المقروء يتغيّر والرقم ثابت)،
  // وما سواها مسارها القانوني: بلا شرطةٍ ختامية، و«…/index» الختامية مسارُ أبيها.
  // ★ (مراجعة القيود لوثائق Claude Code، ١٦ ربيع الآخر ١٤٤٨هـ) فهرس llms.txt يذكر ‎/docs/en/whats-new/index‎ والموقع
  // (الرابط القانوني والشريط وخريطة الموقع) ‎/docs/en/whats-new‎ — فكانت متون الصفحة تُحصد بمفتاحٍ لا يطلبه المحرّك أبدًا.
  // والمفتاح واحدٌ للصفحة أيًّا كان العنوان الذي فُتحت به، في الحاصد والبناء والمحرّك والعامل (والمفتاح القانوني يعود نفسه)
  // ★ (S7-B، ٢١ ربيع الآخر ١٤٤٨هـ) meta.pageAlias: مساراتٌ عدّة لصفحةٍ واحدة — صفحات SDK في مرجع الوثائق (‎/docs/en/api/python/…‎
  // و‎…/http/…‎) نصوصُ ما نترجمه فيها نصوصُ الصفحة القانونية حرفًا بحرف، فمفتاحها مفتاحُها وقطعتها قطعتها (تعبيرٌ يتعذّر بناؤه يُتجاهل)
  function pageKey(meta, pathname) {
    var p = String(pathname || "/").replace(/\/+$/, "") || "/";
    if (meta && meta.intercom) {
      var m = /\/(articles|collections)\/(\d+)/.exec(p);
      if (m) return m[1].charAt(0) + "/" + m[2];
    }
    var al = meta && Array.isArray(meta.pageAlias) ? meta.pageAlias : [];
    for (var i = 0; i < al.length; i++) {
      if (!al[i] || typeof al[i].re !== "string") continue;
      try { p = p.replace(new RegExp(al[i].re), typeof al[i].to === "string" ? al[i].to : ""); } catch (e) {}
    }
    return p.replace(/\/index$/, "") || "/";
  }
  function shardOf(pk) { return fp64("page\n" + pk); }
  // حاصد الكتل: يمشي تحت body (meta.bodySel) كما يمشي المحرّك ويستخرج كل كتلةٍ مرّةً بالتطبيع نفسه.
  // يُرجع [{fp, tpl, single, group}] بترتيب الوثيقة؛ single: نصُّ عقدةٍ وحيدة (قاموس الواجهة يسبق فيه)،
  // group: نصوص بنود صفِّ اللافتات (تُعرَّب بندًا بندًا بقاموس الواجهة إن لم تُترجم الكتلة كلّها)
  function harvestBlocks(doc, opts) {
    opts = opts || {};
    var R = DOM_RULES, skip = opts.skip || null, out = [], seen = [];
    if (!opts.body || !doc || !doc.querySelectorAll) return out;
    var roots = Array.prototype.slice.call(doc.querySelectorAll(opts.body));
    var NF = (doc.defaultView && doc.defaultView.NodeFilter) || { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
    for (var r = 0; r < roots.length; r++) {
      var tw = doc.createTreeWalker(roots[r], NF.SHOW_ELEMENT | NF.SHOW_TEXT, {
        acceptNode: function (n) {
          if (n.nodeType === 1) {
            if (R.SKIP[n.nodeName] || n.isContentEditable) return NF.FILTER_REJECT;
            try { if (skip && n.matches && n.matches(skip)) return NF.FILTER_REJECT; } catch (e) {}
            return NF.FILTER_SKIP;
          }
          var p = n.parentNode;
          if (!p || R.SKIP[p.nodeName] || p.isContentEditable) return NF.FILTER_REJECT;
          return /\S/.test(n.nodeValue || "") ? NF.FILTER_ACCEPT : NF.FILTER_REJECT;
        },
      });
      var n;
      while ((n = tw.nextNode())) {
        if (closestSafe(n.parentNode, R.SKIP_ANCESTOR) || (skip && closestSafe(n.parentNode, skip))) continue;
        var o = blockOwner(n);
        if (!o) continue;
        var b = blockBounds(o.top);
        if (seen.indexOf(b.first) >= 0) continue;
        seen.push(b.first);
        var ex = extractBlock(b.first, b.last, null, opts.max);
        if (ex) out.push({ fp: ex.fp, tpl: ex.tpl, single: ex.single ? textKey(ex.single.nodeValue, 100000) : null,
                           group: ex.group ? ex.group.map(function (t) { return t ? textKey(t.nodeValue, 100000) : t; }) : null });
      }
    }
    return out;
  }

  // ═══ الخط العربي (DESIGN-fonts §٤.٢–٤.٦) — مشتركٌ بين وحدة الخط وعامل الخدمة وصفحة الإعدادات والبوابة ═══

  /**
   * اسم عائلة خطٍّ مطبَّعًا للمطابقة (م٣، ث١١): FontFace.family يعود منصَّصًا في Chrome 154 ("anthropic-sans")
   * ولو كُتب في CSS بلا تنصيص، وقد يعود بلا تنصيص في متصفحٍ آخر، فلا تكون المطابقة حرفية. تنزع طبقة التنصيص
   * الواحدة، وتفكّ هروب CSS (\" و\\ والست عشري)، وتصغّر الحروف الإنجليزية وحدها كما يطابق المتصفح العائلات
   * بلا حساسيةٍ لحالتها. تستعملها وحدة الخط وبوابة الانجراف (fonts.mjs verify) معًا. أما الاسم الذي يُعطى
   * لـ new FontFace فهو face.family كما عاد، لا هذا.
   * @param {string} s
   * @returns {string}
   */
  function normFamily(s) {
    var t = String(s == null ? "" : s).trim();
    var q0 = t.charAt(0), quoted = t.length >= 2 && (q0 === '"' || q0 === "'") && t.charAt(t.length - 1) === q0;
    if (quoted) t = t.slice(1, -1);
    t = t.replace(/\\(?:([0-9a-fA-F]{1,6})(?:\r\n|[ \t\n\r\f])?|(\r\n|[\n\r\f])|([\s\S]))/g, function (m, hex, nl, ch) {
      if (hex) {
        var cp = parseInt(hex, 16);
        return !cp || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? "�" : String.fromCodePoint(cp);
      }
      return nl ? "" : ch; // السطر المهروب داخل نصٍّ منصَّص استمرارٌ لا محرف
    });
    if (!quoted) t = t.replace(/\s+/g, " "); // الاسم غير المنصَّص معرِّفاتٌ بينها مسافةٌ واحدة
    return t.replace(/[A-Z]+/g, function (c) { return c.toLowerCase(); });
  }

  /**
   * نسخة base64 ← ArrayBuffer (§٤.٢ «الفكّ»): Uint8Array.fromBase64 حيث يوجد، وإلا حلقة atob. يُفكّ مرةً في
   * الإطار ويُعاد المخزن نفسه لكل الأوجه. يرمي عند نصٍّ غير صالح، والمستدعي يرفض النسخة (ث٧).
   * @param {string} b64
   * @returns {ArrayBuffer}
   */
  function b64ToBuf(b64) {
    if (typeof Uint8Array.fromBase64 === "function") return Uint8Array.fromBase64(b64).buffer;
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  /**
   * بايتات الملف ← نسخة base64 التي يكتبها عامل الخدمة في cml_font_data (§٤.٢). toBase64 حيث يوجد، وإلا
   * btoa على قطعٍ (فلا يتجاوز String.fromCharCode حدّ الوسائط).
   * @param {ArrayBuffer|ArrayBufferView} buf
   * @returns {string}
   */
  function bufToB64(buf) {
    var u = ArrayBuffer.isView(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : new Uint8Array(buf);
    if (typeof u.toBase64 === "function") return u.toBase64();
    var s = "", CH = 0x8000;
    for (var i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
    return btoa(s);
  }

  /**
   * واصفات وجهنا سوى الثلاثة المنسوخة من وجه الموقع وقت التشغيل (weight وstyle وstretch لا تُكتب هنا، §٤.٣):
   * المدى العربي وحده، وswap، ومقاييس المعايرة للدور (§٤.٦): size-adjust = s، وتجاوزا الصعود والنزول a وd
   * (صندوق العلامة مقسومًا على s)، وفجوة السطر صفر. والدور mono يأخذ قيم ui، ومدخلٌ بلا m (خط النظام) بلا
   * تجاوزات. وبها تُبنى وجوه المعاينة في صفحة الإعدادات أيضًا، فالمعاينة هي ما يُرسم في المواقع.
   * لا وجه بلا مدى عربي أبدًا (ث١): غيابه أو مقاييسُ غير عددية ترمي، والمستدعي لا يضيف شيئًا.
   * @param {{m?:Object}} entry مدخل الفهرس CMLConst.FONTS
   * @param {"ui"|"read"|"mono"} role
   * @returns {Object} واصفات FontFace
   */
  function fontFaceDesc(entry, role) {
    var C = g.CMLConst || {};
    if (!C.FONT_AR_RANGE) throw new Error("fontFaceDesc: FONT_AR_RANGE غائب");
    var d = { unicodeRange: C.FONT_AR_RANGE, display: "swap" };
    var ms = entry && entry.m, m = ms && (ms[role === "mono" ? "ui" : role] || ms.ui);
    if (m) {
      [m.s, m.a, m.d].forEach(function (v) {
        if (typeof v !== "number" || !isFinite(v)) throw new Error("fontFaceDesc: m." + role + " ليس {s, a, d} أعدادًا");
      });
      d.sizeAdjust = pct(m.s);
      d.ascentOverride = pct(m.a);
      d.descentOverride = pct(m.d);
      d.lineGapOverride = "0%";
    }
    return d;
  }
  function pct(x) { return +(x * 100).toFixed(4) + "%"; }

  g.CMLShared = {
    VAR_RE: VAR_RE,
    resolveDir: resolveDir,
    escapeRe: escapeRe,
    unescapeLiteral: unescapeLiteral,
    makePattern: makePattern,
    makePatternBounded: makePatternBounded,
    patternLiteralLen: patternLiteralLen,
    sortBySpecificity: sortBySpecificity,
    patKey: patKey,
    patLiterals: patLiterals,
    litMayMatch: litMayMatch,
    patternIndex: patternIndex,
    sortUserRules: sortUserRules,
    applyTermEdits: applyTermEdits,
    DOM_RULES: DOM_RULES,
    textKey: textKey,
    harvestDom: harvestDom,
    routeMode: routeMode,
    harvestSkip: harvestSkip,
    BLOCK: BLOCK,
    inlineKind: inlineKind,
    blockOwner: blockOwner,
    blockBounds: blockBounds,
    extractBlock: extractBlock,
    parseTemplate: parseTemplate,
    fitTemplate: fitTemplate,
    blockWrites: blockWrites,
    punctAtoms: punctAtoms,
    PUNCT_AR: PUNCT_AR,
    ltrMarks: ltrMarks,
    ltrParens: ltrParens,
    checkBlock: checkBlock,
    fp64: fp64,
    blockFp: blockFp,
    pageKey: pageKey,
    shardOf: shardOf,
    harvestBlocks: harvestBlocks,
    normFamily: normFamily,
    b64ToBuf: b64ToBuf,
    bufToB64: bufToB64,
    fontFaceDesc: fontFaceDesc,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
