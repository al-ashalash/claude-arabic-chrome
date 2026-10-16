/* engine.js — claude-mutarjim live translator (isolated content-script world).
 * Reads globalThis.CLAUDE_L10N (from dictionary.js), applies direction,
 * translates UI text nodes + attributes, and re-runs on dynamic DOM changes.
 *
 * PRIVACY — stated precisely, because a claim that overreaches is worse than none:
 * To translate a label the engine must MATCH it, so it does read text nodes as it walks
 * the DOM. What it never does is KEEP any of that: nothing read from the page is stored,
 * accumulated, or transmitted — not to storage, not to a server, not anywhere. Reads are
 * transient and match-only; the sole persistent writes are the user's own settings and
 * the corrections they type themselves.
 * Conversation content is excluded outright (see inChatContent), so message prose is
 * never even matched. Discovering untranslated strings is done exclusively by «site
 * scan», which fetches claude.ai's own public asset files — never the rendered page.
 * No page-script injection: works within the page CSP.  */
(function () {
  "use strict";
  // ★ حارس نوع المستند (وثائق Claude Code، المراجعة المستقلة ج-٣): المطابقة تشمل ملفات الموقع النصية الخام —
  // نسخة ‎.md‎ لكل صفحة وllms.txt — وكروم يعرضها مستنداتٍ نصية لا واجهة فيها ولا ترطيب. كان المحرّك يضع
  // الاتجاه ويُمسك الصفحة مخفيّةً حتى سقفه بلا شيءٍ يُترجم (قِيس على ‎platform.claude.com/docs/en/intro.md‎).
  // فما ليس HTML خاملٌ تمامًا: لا سمات ولا إخفاء ولا ترجمة ولا فحص — قبل أي لمسٍ للمستند.
  var DOC_TYPE = String((typeof document !== "undefined" && document.contentType) || "text/html").toLowerCase();
  if (DOC_TYPE !== "text/html" && DOC_TYPE !== "application/xhtml+xml") return;
  var L10N = (typeof globalThis !== "undefined" && globalThis.CLAUDE_L10N) || null;
  if (!L10N || !L10N.dicts) return;
  // الثوابت والمنطق المشترك يُحقنان قبلنا (ترتيب المانيفست) — غيابهما عطل تركيب صريح
  var CONST = globalThis.CMLConst, SHARED = globalThis.CMLShared;
  if (!CONST || !SHARED) { console.error("[تعريب كلود] cml-const/cml-shared لم يُحمَّلا — راجع ترتيب المانيفست"); return; }

  // ★ حالة التنسيق العابرة (طلب/إلغاء/حجز الفحص) في storage.session: تُمحى بإغلاق
  // المتصفح، فيستحيل بنيويًا «حجزٌ خالد» أو «إلغاء عالق» يسبق صاحبه إلى الأبد —
  // وهو صنف العلل الذي طاردناه رقعةً رقعة في §7ب. النتيجة النهائية تبقى في local
  // (المستخدم يتوقع بقاءها بعد إعادة التشغيل، وتعافي «جارٍ» المتقادمة قائم بالنبض).
  // القشرة تسقط إلى local حيث لا session (قشور الاختبار، ومتصفح أقدم) بسلوك الأمس نفسه.
  var SESS = (chrome.storage && chrome.storage.session) || chrome.storage.local;

  // ═══ هوية النطاق (١-٠ب): من قاموس النطاق نفسه لا من اسم المضيف ═══════════════════
  // قاموسٌ بلا domain (قشور الاختبار وبناءات ما قبل 2.0.0) هو التطبيق بسلوكه كله.
  var DOMAIN = (typeof L10N.domain === "string" && L10N.domain) || "app";
  var META = L10N.meta || {};
  function dk(base) { return typeof CONST.key === "function" ? CONST.key(base, DOMAIN) : base; }
  var K_OV = dk("cml_overrides"), K_PAT = dk("cml_user_patterns"), K_BAD = dk("cml_bad_rules");
  var K_SCAN = dk("cml_scan_result"), K_RTLDOC = dk("cml_rtldoc_result");
  // المفتاح الرئيس cml_enabled للنطاقات كلها، ولكل نطاقٍ مفتاحٌ فرعي (غيابُه = مفعّل)
  var K_SITE = ((CONST.K && CONST.K.SITE_ON) || "cml_site") + "." + DOMAIN;
  // تجاوزُ محرّك الاتجاه لهذا الموقع وحده (غيابُه = يتبع cml_rtl_engine العام)
  var K_ENG_SITE = ((CONST.K && CONST.K.ENGINE_SITE) || "cml_engine_site") + "." + DOMAIN;
  // الخط العربي: اختيارٌ واحدٌ عامّ لكل المواقع، ونسخته يكتبها عامل الخدمة وحده (DESIGN-fonts §٤.٢)
  var K_FONT = (CONST.K && CONST.K.FONT) || "cml_font", K_FONT_DATA = (CONST.K && CONST.K.FONT_DATA) || "cml_font_data";
  var CHAT_ON = META.chat !== false;                 // استثناء المحادثة واتجاهها: للتطبيق وحده
  var SCAN_APP = !META.scan || META.scan === "app";  // فحص حزم التطبيق وطبيب الاتجاه
  var SCAN_LLMS = META.scan === "llms";              // فحص فهرس الصفحات العام (llms.txt) — مواقع الوثائق
  var LIVE_ON = META.live !== false;
  // ★ (مراجعتا القيود والمحرّك لوثائق Claude Code، ١٦ ربيع الآخر ١٤٤٨هـ) أوراق <style> المضمَّنة في الورقة الحيّة **اختياريةٌ
  // لكل نطاق** (meta.liveInline) لا عامّة: true = كل ورقةٍ مضمَّنة تمسّ المحور، أو محدِّدٌ يحصرها فيما يطابقه. كانت تُجمع في
  // كل نطاقٍ حيّ ومنه التطبيق، فورقةٌ يولّدها الموقع داخل المحادثة (SVG مضمَّن مثلًا) كانت تُرسل إلى العامل فتُقلب وتُخزَّن —
  // خرقٌ لاستثناء المحادثة ولوعد «لا تخزّن شيئًا مما يظهر على شاشتك»؛ وورقةٌ عابرة في الرأس (قفل التمرير عند فتح قائمة)
  // كانت تُعيد بناء الورقة كلّها مرّتين عند كل فتحٍ وإغلاق. والمحدِّد يحصرها فيما يطابقه (Mintlify: CSS الموقع ‎style[data-custom-css-path]‎
  // وأوراق المكوّنات في المتن ‎#content style‎ — انظر جدول النطاقات). وما كان داخل المحادثة أو المستثنى (meta.skipSel) خارجها في كل حال.
  var LIVE_INLINE = META.liveInline === true || (typeof META.liveInline === "string" && META.liveInline) ? META.liveInline : false;
  // ★ (1.1.0، منقولٌ إلى 2.0.0 — ١٦ ربيع الآخر ١٤٤٨هـ) حارس لغة الموقع للتطبيق (meta.siteLang؛ وقاموسٌ بلا domain هو التطبيق
  // فالحارس فيه ما لم يُطفأ صراحةً). انظر judgeSiteLang
  var SITE_LANG = DOMAIN === "app" ? META.siteLang !== false : META.siteLang === true;
  // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) حارسٌ ثانٍ للغة الموقع (meta.siteLangSel): منتقي لغة الوثيقة في anthropic.com/legal يبدّل المتن
  // في حال React وحدها — لا العنوان ولا <html lang> — ويبدأ الخادم بلغة بلد الزائر إن وُجدت ترجمتها. فنصُّ العنصر الذي يسمّي
  // اللغة المعروضة غيرُ ما في siteLangOk ⇒ الإضافة خاملة كحارس <html lang> (لا نقلب صفحةً بلغةٍ أخرى ولا نضع تنبيهنا فوقها)،
  // وغيابُ العنصر لا يُخمدها (المحدِّد انجرف: تعمل كما كانت). انظر judgeSiteLang
  var LANG_SEL = typeof META.siteLangSel === "string" && META.siteLangSel ? META.siteLangSel : null;
  var LANG_OK = Array.isArray(META.siteLangOk) && META.siteLangOk.length ? META.siteLangOk : ["English"];
  // العنصر المخزَّن (يُعاد البحث عنه متى خرج من الصفحة وحده)، وحكم <html lang> وحده وقيمته
  var langEl = null, htmlForeign = false, htmlForeignV = null;

  // ★ حارس المسار (مراجعة كودكس ١٥): موقعٌ يتقاسم تطبيقًا واحدًا مع ما لا نعرّبه (الوثائق
  // ولوحة المطوّرين) يُطابَق كلُّه في المانيفست، ويحصر الحارس العمل في مساراته: full كامل،
  // shell هيكلٌ فقط، وما سواهما **خامل** (لا سمات ولا إخفاء ولا ترجمة ولا فحص).
  function routeMode() { return SHARED.routeMode(META.routes, location.pathname); } // واحدٌ مع حاصد DOM

  var state = {
    enabled: true,   // الفعلي: الرئيس × مفتاح النطاق × حارس المسار (يُحسب في refreshEnabled)
    master: true,
    site: true,
    route: routeMode(),
    lang: L10N.default || (L10N.langs && L10N.langs[0] && L10N.langs[0].code),
    overrides: {},
    userPatterns: [], // أنماط وَلّدها الاستيراد من النصوص ذات المتغيّرات
    rtl: true, // full page dir=rtl ON by default for RTL languages; user can turn it off if a screen misbehaves
    chatrtl: true, // fix direction of conversation text (dir=auto) — ON by default for Arabic
    // محرّك الاتجاه (المرحلة ٣): "v2" الجذري افتراضيًا — سمة data-cml-rtl تفعّل
    // rtl-overrides.css المولَّد (قلب منطقي شامل لأصناف الموقع). "v1" يبقيه خاملًا
    // فتعمل الإصلاحات النقطية في base.css وحدها (مخرج توافقٍ إن ساءت شاشة).
    rtlEngine: "v2",
    engGlobal: null, // cml_rtl_engine كما خُزّن ("v1" أو غائب)
    engSite: null,   // cml_engine_site.<النطاق> كما خُزّن ("v1"/"v2" أو غائب)
    siteForeign: false, // حارس لغة الموقع: الموقع كتب في <html lang> لغةً غير الإنجليزية ⇒ الإضافة خاملة
    siteLang: null,     // تلك اللغة كما كتبها الموقع (للنافذة المنبثقة)
    siteLangBy: null,   // (ر3) مصدر الحكم: "html" (<html lang>) أو "sel" (منتقي اللغة في الصفحة، meta.siteLangSel)
    // الخط العربي (DESIGN-fonts §٤.٢): cml_font كما خُزّن (غيابه = الافتراضي)، ونسخة عامل الخدمة {id, v, b64} أو {id, v, err}
    fontChoice: undefined,
    fontData: undefined,
  };
  // المحرّك الفعلي: تجاوزُ الموقع إن وُجد، وإلا العام — وكل ما عدا "v1" هو v2 الافتراضي
  function refreshEngine() {
    var s = state.engSite;
    state.rtlEngine = s === "v1" || s === "v2" ? s : (state.engGlobal === "v1" ? "v1" : "v2");
  }
  var active = null;
  var pluralRes = null;
  function reqForMe(v) {
    if (!v) return false;
    if (typeof v === "object") return (v.d || "app") === DOMAIN;
    return DOMAIN === "app";
  }
  function refreshEnabled() {
    state.route = routeMode();
    state.enabled = state.master && state.site && state.route !== "inactive" && !state.siteForeign;
  }

  // ═══ الخط العربي (2.0.0 — DESIGN-fonts §٤؛ الوحدة cml-font.js قبل القاموس في المانيفست) ═══════════════
  // يتبع بوابة المحرّك نفسها (الرئيس ومفتاح الموقع والمسار وحارس لغة الموقع: ق٧ — واجهة claude.ai بغير الإنجليزية
  // تُخمده مع الإضافة كلها) ويُزاد عليها شرطان: لغة التعريب العربية، واختيارٌ غير «خط الموقع». وسياق القطع لوجه
  // «cml-ar-compact» هو ملف النقطة: Intercom لمركزي المساعدة والخصوصية، وإلا النطاق نفسه (app وdocs وcode)
  var F = (globalThis.CMLFont && typeof globalThis.CMLFont.create === "function" && CONST.FONTS && CONST.FONTS.length)
    ? globalThis.CMLFont.create({ families: META.fontFamilies || {}, prepend: META.fontPrepend || [], mono: CONST.FONT_MONO !== false,
                                  range: CONST.FONT_AR_RANGE, attr: CONST.FONT_ATTR, ctx: META.intercom ? "intercom" : DOMAIN,
                                  // ★ (ر5ب) خط رفيقات «Fallback» من next/font في الموقع (meta.fontFallback): به تُبنى مراياها في «خط النظام»
                                  fallback: META.fontFallback || null,
                                  // فشل تحليل الوجه (نسخةٌ تالفة الجسم بترويسةٍ وطولٍ صحيحين): يُطلب الإصلاح بالقيد نفسه — مرةً، ومن الأعلى
                                  onFail: function () { fontEnsure(); } })
    : null;
  var fontBooted = false, fontEnsureSent = false;
  // النسخة تخصّ الخط المحسوم: معرّفه وبصمته، ونصٌّ طوله طول base64 لبايتاته بالضبط (§٤.٢ «تحقُّق المحرّك»)
  function fontDataFits(d, want) {
    return !!d && typeof d === "object" && d.id === want.id && d.v === want.sha && typeof d.b64 === "string" &&
      d.b64.length === Math.ceil(want.bytes / 3) * 4;
  }
  // طلب الإصلاح من عامل الخدمة (font-ensure) — في الإقلاع وحده، ومن الإطار الأعلى وحده، ومرةً واحدة (ن٨): في
  // التبديل الحيّ يرى كل تبويبٍ الاختيار الجديد قبل نسخته، والعامل قد انطلق من تغيّر المفتاح نفسه
  function fontEnsure() {
    if (fontEnsureSent || window.top !== window) return;
    fontEnsureSent = true;
    try {
      if (chrome.runtime && typeof chrome.runtime.sendMessage === "function")
        chrome.runtime.sendMessage({ type: "font-ensure" }, function () { void chrome.runtime.lastError; });
    } catch (e) {}
  }
  function fontApply() {
    if (!F) return;
    var boot = !fontBooted;
    fontBooted = true;
    var on = state.enabled && active && state.lang === CONST.FONT_LANG;
    // ★ (ر5ب، القرار 71) «خط النظام»: مدخلٌ بأوجهٍ محلية بلا ملف (CONST.FONT_SYS) — لا نسخة تُنتظر ولا إصلاح يُطلب، والبوابة نفسها
    if (on && CONST.FONT_SYS && CONST.FONT_SYSTEM && state.fontChoice === CONST.FONT_SYSTEM) { F.sync(true, CONST.FONT_SYS, null); return; }
    var want = on ? CONST.fontResolve(state.fontChoice) : null;
    if (!want) { F.sync(false); return; } // الإطفاء و«خط الموقع» والخمول: تُحذف الأوجه فورًا بلا إعادة تحميل
    var d = state.fontData;
    if (fontDataFits(d, want) && F.sync(true, want, d.b64)) return;
    // نسخةٌ غائبة أو لا تطابق أو تالفة: في الإقلاع لا وجه ويُطلب الإصلاح؛ وفي التبديل الحيّ تبقى الأوجه القائمة حتى تصل نسختها.
    // إلا سجلّ «quota» لهذا الخط: علاجه بيد المستخدم (يحذف ما لا يلزم ثم «إعادة المحاولة» في البطاقة)، وكل محاولةٍ آلية
    // تطرد الأوراق الحيّة كلها ثم تفشل — فطلبُها مع كل صفحة كان يعيد بناء الاتجاه من الشبكة في كل تحميل (المراجعة العدائية S6-B)
    var quota = !!d && typeof d === "object" && d.id === want.id && d.v === want.sha && d.err === "quota";
    if (boot) { F.sync(true, want, null); if (!quota) fontEnsure(); }
  }

  function compile() {
    var base = L10N.dicts[state.lang];
    if (!base) { active = null; return; }
    var ov = (state.overrides && state.overrides[state.lang]) || {};
    active = {
      dir: base.dir || "ltr",
      // ★ لا نسخة ثانية: Object.assign على 22 ألف مدخلة كان يضاعف ذاكرة كل تبويب
      // (~10MB) في كل compile — والبحث يفحص التصحيحات ثم القاموس تتابعًا بلا دمج.
      strings: base.strings,
      overrides: ov,
      plurals: base.plurals || {},
      // أنماط المستخدم أولًا: تصحيحه يسبق النمط المدمج عند التعارض
      patterns: (state.userPatterns || []).concat(base.patterns || []),
    };
    buildPlurals();
    buildPatterns();
    patIdx = null; // فهرس الأنماط (cml-shared patternIndex) يُبنى كسولًا عند أول بحث
    lookupCache = new Map(); // النتائج المخزّنة تعتمد على القاموس والقواعد — أبطِلها مع كل إعادة تركيب
    reportBadRules();
  }

  function reportBadRules() {
    var total = badPatterns + badPlurals;
    if (total === lastBadReport) return;
    lastBadReport = total;
    try {
      var o = {}; o[K_BAD] = { patterns: badPatterns, plurals: badPlurals };
      if (total) chrome.storage.local.set(o);
      else chrome.storage.local.remove(K_BAD);
    } catch (e) {}
  }

  // قيم الموقع الأصلية تُحفظ مرة واحدة: كان الإطفاء يمحو lang وdir محوًا مطلقًا،
  // فتفقد الصفحة سمة lang التي وضعها الموقع (يعتمد عليها قارئ الشاشة والتدقيق الإملائي)
  // ولا تعود إليها إلا بإعادة تحميل.
  // ★ (مراجعة كودكس ١٨، مثبتة) وسجلُّ ملكية: آخرُ قيمةٍ كتبناها نحن. كان الأصل يُحفظ مرةً
  // واحدة ويُعاد عند الإطفاء ولو غيّر الموقع السمة بعدنا (قِيس: dir وlang غيّرهما الموقع
  // فأُرجعا إلى قيم الإقلاع). الآن: الاستعادة لا تمسّ قيمةً ليست قيمتَنا، والأصلُ يُعاد
  // تقييمه متى وجدنا السمة على غير ما كتبنا (الموقع كتب بعدنا فقيمتُه هي الأصل الجديد).
  var origLang = null, origDir = null, origSaved = false;
  var wroteLang = null, wroteDir = null;
  function saveOriginals(html) {
    var curL = html.getAttribute("lang"), curD = html.getAttribute("dir");
    if (!origSaved) { origSaved = true; origLang = curL; origDir = curD; return; }
    if (wroteLang === null || curL !== wroteLang) origLang = curL;
    if (wroteDir === null || curD !== wroteDir) origDir = curD;
  }
  function restoreAttr(html, name, val) {
    if (val === null) html.removeAttribute(name); else html.setAttribute(name, val);
  }
  // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) كتاباتنا نحن لسمة lang بعد أن يُركَّب مراقب حارس اللغة (siteLangObs): لكل كتابةٍ سجلُّ طفرةٍ واحد يصله،
  // فيعدّها ويطرحها فلا يبقى إلا ما كتبه الموقع — إشارة الترطيب "lang" (hydrateSignal) تقوم عليه. والقيمة وحدها لا تكفي: إرجاعُنا
  // الأصلَ عند الإطفاء أو الخروج إلى مسارٍ خامل يمحو wroteLang فكانت كتابتُنا تُحسب كتابةً من الموقع
  var ownLangRecs = 0;
  function noteOwnLang() { if (siteLangObs) ownLangRecs++; }
  function setOwned(html, name, val) {
    if (html.getAttribute(name) !== val) { html.setAttribute(name, val); if (name === "lang") noteOwnLang(); }
    if (name === "lang") wroteLang = val; else wroteDir = val;
  }
  function restoreOwned(html, name) {
    var mine = name === "lang" ? wroteLang : wroteDir;
    var orig = name === "lang" ? origLang : origDir;
    // (ر4) والإرجاع إلى القيمة نفسها لا يُكتب (لا سجلَّ طفرةٍ بلا تغيير)
    if (mine !== null && html.getAttribute(name) === mine && orig !== mine) { restoreAttr(html, name, orig); if (name === "lang") noteOwnLang(); }
    if (name === "lang") wroteLang = null; else wroteDir = null;
  }
  // ★ المحرّك الحيّ: أوراقُ الموقع الحاضرة تُقلب وقتَ التشغيل بدل لقطةٍ مبنيّةٍ وقت
  // الإصدار. بصمةُ العناوين هي المفتاح: ما دامت هي هي فالورقة من الذاكرة بلا شبكة،
  // وأولُ تغيّرٍ في حزم الموقع يُعيد البناء تلقائيًّا — فلا تتقادم التغطية أبدًا.
  // ★★ (مراجعة كودكس ١١–١٣) المدخل سجلّاتٌ لا عناوين مجرّدة، بترتيب المستند لا
  // الأبجدي (قواعد الموقع غير المطبَّقة تتحاكم بالترتيب)، ومعها وسيطُ الورقة؛ والورقة
  // المعطَّلة وورقة الطباعة ليستا من الصفحة المعروضة فلا تدخلان. وكل طلبٍ برقم جيل:
  // ردٌّ قديمٌ بطيء لا يستبدل بناءً أحدث، ولا يُطبَّق بعد إطفاء الاتجاه.
  var LIVE_HOSTS = /(^|\.)claude\.ai$|(^|\.)anthropic\.com$/;
  var liveGen = 0, liveInflight = null, liveApplied = null, liveRetried = Object.create(null);
  // ★★ (وثائق Claude Code، والمراجعة المستقلة لفحص الاتجاه ج-٣) وأوراقُ <style> المضمَّنة في المستند نفسه:
  // CSS الموقع الخاص في Mintlify (style.css، فيه 24 إعلانًا فيزيائيًّا) مضمَّنٌ لا رابط، فكان يضيع متى خلفت
  // الورقةُ الحيّة اللقطة. نصُّها يُقرأ من المستند (لا جلب ولا شبكة) بترتيب المستند بين الروابط:
  //   - ما لا إعلانَ فيه يمسّ المحور الأفقي يُترك (متغيّرات :root، وأصناف Tailwind المولَّدة لكل صفحة) —
  //     فلا تتبدّل البصمة بين الصفحات بلا سبب فيُعاد البناء في كل تنقّل؛
  //   - والمتجاورةُ تُضمّ سجلًّا واحدًا بترتيبها (فلا تستهلك سقف الأوراق RTL_LIVE_SHEETS_MAX)؛
  //   - وما فيه @import يُترك (لا نتبعه، وكان سيُسقط البناء كلّه)، وما جاوز سقف الورقة الواحدة يُترك.
  // والبصمة تحمل بصمة النص (inline:<fnv1a>) فيُعاد البناء متى تغيّر — والعامل يحسبها من النص الذي تحقّق منه.
  var INLINE_AXIS = /(?:^|[{;\s])(?:margin|padding|border|inset|left|right|float|clear|text-align|scroll-margin|scroll-padding|translate|transform|background-position|justify-[a-z]+)(?:-[a-z-]+)?\s*:/i;
  // ورقةٌ مضمَّنة تدخل الورقة الحيّة؟ النطاق اختارها (LIVE_INLINE)، وليست ورقتنا، ويطابقها محدِّده إن حصرها،
  // وليست في محتوى المحادثة ولا في المستثنى — فلا يُرسل إلى العامل ولا يُخزَّن نصٌّ من محادثةٍ أو جوابٍ مولَّد أبدًا
  function inlineEligible(ln) {
    if (!LIVE_INLINE || !ln || ln.localName !== "style" || ln.id === "cml-live-rtl") return false;
    if (typeof LIVE_INLINE === "string") { try { if (!ln.matches(LIVE_INLINE)) return false; } catch (e) { return false; } }
    return !inChatContent(ln) && !inSkipSel(ln);
  }
  function liveSheets() {
    var out = [], seen = {}, run = null;
    var MAXB = CONST.RTL_LIVE_SOURCE_MAX_BYTES || 6291456;
    var els = document.querySelectorAll(LIVE_INLINE ? 'link[rel~="stylesheet"][href], style' : 'link[rel~="stylesheet"][href]');
    for (var i = 0; i < els.length; i++) {
      var ln = els[i];
      if (ln.localName === "style") {
        if (!inlineEligible(ln) || ln.hasAttribute("data-cml") || ln.disabled) continue;
        var ty = (ln.getAttribute("type") || "").trim().toLowerCase();
        if (ty && ty !== "text/css") continue;
        var sm = (ln.getAttribute("media") || "").trim();
        if (/^print$/i.test(sm)) continue;
        var tx = ln.textContent || "";
        if (tx.indexOf("{") < 0 || !INLINE_AXIS.test(tx) || /@import\b/i.test(tx) || tx.length > MAXB) continue;
        if (run && run.media === sm && run.inline.length + tx.length < MAXB) { run.inline += "\n" + tx; continue; }
        run = { inline: tx, media: sm };
        out.push(run);
        continue;
      }
      if (ln.disabled || /\balternate\b/i.test(ln.rel || "")) continue;
      var media = (ln.getAttribute("media") || "").trim();
      if (/^print$/i.test(media)) continue;
      var href = ln.href;
      // https وحده، إلا ورقةً من أصل الصفحة نفسها (قشور الاختبار على http محلي؛ والعامل
      // يرفض غير https على كل حال، ونطاقاتنا كلها https)
      if (!/^https:/.test(href) && href.indexOf(location.origin + "/") !== 0) continue;
      var host;
      try { host = new URL(href).hostname; } catch (e) { continue; }
      if (!LIVE_HOSTS.test(host) && host !== location.hostname) continue; // نطاقُنا المصرَّح به وحده
      if (seen[href]) continue;
      seen[href] = 1;
      out.push({ url: href, media: media });
      run = null; // رابطٌ داخلٌ في البناء يقطع التتابع (الترتيب عقد)؛ والمتروك (أصلٌ آخر) لا يدخل فلا يقطعه
    }
    return out;
  }
  // مفتاح الورقة في البصمة — وهو نفسه في العامل (sw.js): الرابط بعنوانه، والمضمَّنة ببصمة نصّها
  function liveKey(x) {
    var id = x.url ? x.url : "inline:" + (CMLRtl && CMLRtl.fnv1a ? CMLRtl.fnv1a(x.inline) : String(x.inline.length));
    return id + (x.media ? " @" + x.media : "");
  }
  function applyLiveSheet() {
    if (!LIVE_ON) return;
    if (!state.enabled || !state.rtl || state.rtlEngine !== "v2") return;
    if (!chrome.runtime || !chrome.runtime.sendMessage) return;
    // ★ لا طلب قبل اكتمال تحليل المستند: أوراق <style> في المتن (CSS الموقع في Mintlify) لم تُحلَّل بعدُ، فكان الطلب
    // المبكر يبني ورقةً بالروابط وحدها ويخزّنها ثم يبني الكاملة عند DOMContentLoaded — بناءان في كل تحميل يتقاذفان
    // خانة الذاكرة الواحدة، وقد تبقى الناقصة مطبَّقة (قِيس بأداة فحص الاتجاه). واللقطة المشحونة عاملةٌ حتى ذلك الحين
    if (document.readyState === "loading") return;
    var sheets = liveSheets();
    // عند document_start لا أوراق بعدُ في <head> — لا نبصم فراغًا ولا نيأس: مراقبُ الرأس
    // يعاود متى ظهرت ورقةٌ أو تبدّلت
    if (!sheets.length) return;
    // رقمُ مراجعة المحرّك في البصمة: الورقة المخزّنة من محرّكٍ سابق لا تُعاد بعد تحديث الإضافة (ق١)
    var fpSrc = "r" + ((CMLRtl && CMLRtl.REV) || 1) + "|" + sheets.map(liveKey).join("|");
    var fp = CMLRtl && CMLRtl.fnv1a ? CMLRtl.fnv1a(fpSrc) : fpSrc;
    if (fp === liveApplied || fp === liveInflight || liveRetried[fp] > 1) return;
    liveInflight = fp;
    var gen = ++liveGen;
    try {
      chrome.runtime.sendMessage({ type: "rtlcss", sheets: sheets, fp: fp }, function (res) {
        void chrome.runtime.lastError;
        if (gen !== liveGen) return;          // طلبٌ أحدث سبقه: هذا الردّ لاغٍ
        liveInflight = null;
        if (!res || !res.css) {
          // إخفاق ⇒ تبقى اللقطة (أو آخر ورقةٍ حيّة مكتملة)، ومحاولةٌ ثانية واحدة لهذه
          // البصمة بعد مهلة (جلبٌ عابر) — لا دورانَ على رفضٍ دائم
          liveRetried[fp] = (liveRetried[fp] || 0) + 1;
          if (liveRetried[fp] === 1) setTimeout(applyLiveSheet, 5000);
          return;
        }
        if (!(state.enabled && state.rtl && state.rtlEngine === "v2")) return; // أُطفئ أثناء البناء
        var el = document.getElementById("cml-live-rtl");
        if (!el) {
          el = document.createElement("style");
          el.id = "cml-live-rtl";
          (document.head || document.documentElement).appendChild(el);
        }
        if (el.textContent !== res.css) el.textContent = res.css;
        el.setAttribute("data-fp", fp);
        liveApplied = fp;
        // تبديل البوابة **بعد** الحقن: لحظةٌ واحدة بلا ورقةٍ عاملة لا تقع
        if (active && active.dir === "rtl") document.documentElement.setAttribute("data-cml-rtl", "live");
      });
    } catch (e) { liveInflight = null; }
  }
  // مراقبُ الرأس: ورقةٌ تُضاف أو تُزال (رابطٌ أو <style> مضمَّنة)، أو يتبدّل href/rel/media/disabled في العنصر
  // نفسه ⇒ إعادة بناءٍ مجمَّعة. (كانت المعاودة ثلاث مهلٍ ثابتة لا ترى ما يأتي بعدها.) وورقتُنا نحن (cml-live-rtl)
  // لا توقظه؛ وأوراق <style> في المتن تتبدّل بالتنقّل فيعاودها checkRoute
  var headObs = null, headTimer = null;
  function scheduleLiveSheet(ms) {
    if (headTimer) clearTimeout(headTimer);
    headTimer = setTimeout(function () { headTimer = null; applyLiveSheet(); }, ms || 300);
  }
  // (ورقةٌ مضمَّنة توقظه إن كانت مما يدخل البناء وحده: ورقةٌ عابرة لا يختارها النطاق لا تعيد البناء)
  function sheetNode(n) { return n && (n.nodeName === "LINK" || inlineEligible(n)); }
  function watchHead() {
    if (headObs || !document.head || typeof MutationObserver !== "function") return;
    headObs = new MutationObserver(function (muts) {
      var hit = false;
      for (var i = 0; i < muts.length && !hit; i++) {
        var m = muts[i];
        if (m.type === "attributes") { hit = m.target && m.target.nodeName === "LINK"; continue; }
        var lists = [m.addedNodes, m.removedNodes];
        for (var j = 0; j < 2 && !hit; j++) {
          for (var k = 0; k < lists[j].length; k++) { if (sheetNode(lists[j][k])) { hit = true; break; } }
        }
      }
      if (!hit) return;
      scheduleLiveSheet(300);
    });
    try {
      headObs.observe(document.head, { childList: true, subtree: true, attributes: true,
        attributeFilter: ["href", "rel", "media", "disabled"] });
    } catch (e) { headObs = null; }
  }

  // ★ (١-١) غلاف منصة Intercom: الصفحة كلها ملفوفةٌ في <div dir="ltr"> تحت #__next (حتى في
  // صفحات المنصة العربية)، فاتجاه html لا يحرّك عنصرًا واحدًا وتنقلب قواعد [dir=rtl] الأصلية
  // وحدها فيخرج هجينٌ أسوأ من LTR (الدراسة §٣). نضع dir على الغلاف بملكية: نحفظ مرجعه
  // وقيمته الأصلية، والإطفاء يعيدها ما دامت قيمتَنا؛ وغلافٌ استبدله الترطيب يُلتقط فيُعاد إليه
  // الاتجاه — بسقفٍ لكل غلاف (WRAP_PIN_MAX) كي لا نتقاذف السمة مع الموقع بلا نهاية.
  var WRAP_SEL = "#__next > div[dir]", WRAP_PIN_MAX = 5;
  var wrapEl = null, wrapOrig = null, wrapWrote = null, wrapPins = 0, wrapObs = null;
  function applyWrapper() {
    if (!META.intercom) return;
    var el = null;
    try { el = document.querySelector(WRAP_SEL); } catch (e) {}
    if (el !== wrapEl) {
      // غلافٌ جديد (أول مرة أو بعد ترطيبٍ استبدله): سجلٌّ جديد، والقديم خرج من الصفحة
      if (wrapObs) { wrapObs.disconnect(); wrapObs = null; }
      wrapEl = el; wrapOrig = el ? el.getAttribute("dir") : null; wrapWrote = null; wrapPins = 0;
      if (el) {
        // الموقع يعيد dir على الغلاف نفسه (تحديثٌ لا استبدال): نراه فنعيد تثبيته
        try { wrapObs = new MutationObserver(applyWrapper); wrapObs.observe(el, { attributes: true, attributeFilter: ["dir"] }); } catch (e) {}
      }
    }
    if (!el) return;
    var want = state.enabled && active && state.rtl && active.dir === "rtl";
    if (want) {
      if (el.getAttribute("dir") !== "rtl") {
        if (wrapWrote === "rtl" && ++wrapPins > WRAP_PIN_MAX) return; // الموقع يصرّ: لا تقاذف
        el.setAttribute("dir", "rtl");
        wrapWrote = "rtl";
      }
    } else if (wrapWrote !== null) {
      if (el.getAttribute("dir") === wrapWrote) {
        if (wrapOrig === null) el.removeAttribute("dir"); else el.setAttribute("dir", wrapOrig);
      }
      wrapWrote = null;
    }
  }

  // ★ (١-٣) سمات html يمحوها الموقع: Next.js App Router يملك عنصر <html> في تخطيطه الجذري، فإن
  // أعاد React رسم الجذر من العميل (استعادةٌ من خطأ، أو ترطيبٌ أخفق) أزال ما ليس في خصائصه —
  // dir وlang وdata-cml ومتغيّر الخط — فتبقى الصفحة بلا اتجاهٍ ولا تعريب (قِيس على الوثائق). مراقبٌ
  // على سمات html يعيد تثبيتها ما دامت الإضافة عاملة، بسقفٍ (HTML_PIN_MAX) لا تقاذفَ بعده.
  var htmlObs = null, htmlPins = 0;
  // ★ (1.1.0، منقولٌ إلى 2.0.0 — ١٦ ربيع الآخر ١٤٤٨هـ) حارس لغة الموقع: لغة واجهة claude.ai إعدادٌ في حساب المستخدم لا في
  // العنوان، والموقع يكتبها في سمة lang على الجذر (ثبت من حزمه). فإن اختار المستخدم لغةً غير الإنجليزية لم تطابق مفاتيحُ
  // القاموس شيئًا، وكانت الإضافة مع ذلك تقلب الصفحة من اليمين وتكتب lang=ar — واجهةٌ بلغةٍ أخرى مقلوبة. الآن: متى كتب
  // الموقع لغةً غير الإنجليزية (ومنها عربيةُ الموقع نفسه إن أتاحها يومًا) خمدت الإضافة كلها كأنها موقوفة (لا ترجمة ولا
  // اتجاه ولا lang، وتُستعاد الصفحة) دون أن يُمسّ إعداد المستخدم، وتعود متى عاد الموقع إلى الإنجليزية.
  // وبسجلّ الملكية نفسه (wroteLang/origLang): ما كتبناه نحن (آخر قيمةٍ كتبناها) لا يُحسب كتابةً من الموقع، وما كتبه
  // الموقع يصير الأصلَ المستعاد — ولا يُعاد تثبيت lang فوق لغةٍ أجنبية كتبها الموقع (مراقب الحارس يسبق مراقب التثبيت).
  function isForeignLang(v) { return !!v && !/^en(-|$)/i.test(v); }
  // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) نصُّ منتقي اللغة في الصفحة (meta.siteLangSel) حين لا يعني الإنجليزية، وإلا null. العنصر مخزَّنٌ
  // ويُبحث عنه من جديد متى خرج من الصفحة وحده؛ وفي المسار الخامل لا يُبحث عنه أصلًا (الحكم يمرّ مع كل دفعة طفرات). والمسار من
  // العنوان الحاضر لا من state.route: الحكم يسبق checkRoute في مراقب الطفرات، فالتنقّل إلى وثيقةٍ معروضةٍ بلغةٍ أخرى لا يُعرَّب لحظة
  function selLangLabel() {
    if (!LANG_SEL || routeMode() === "inactive") return null;
    if (!langEl || !langEl.isConnected) {
      langEl = null;
      try { langEl = document.querySelector(LANG_SEL); } catch (e) { langEl = null; }
    }
    if (!langEl) return null;
    var t = (langEl.textContent || "").replace(/\s+/g, " ").trim();
    return t && LANG_OK.indexOf(t) < 0 ? t : null;
  }
  // الحكم من مصدرين (ر3): <html lang> بسجلّ الملكية كما كان، ومنتقي اللغة في الصفحة — أيُّهما قال «لغةٌ أخرى» خمدت الإضافة
  function judgeSiteLang() {
    if (!SITE_LANG && !LANG_SEL) return;
    var h = document.documentElement;
    if (!h) return;
    if (SITE_LANG) {
      var v = h.getAttribute("lang");
      // كتابتُنا نحن لا تغيّر حكم <html lang>؛ وما كتبه الموقع هو الأصل الجديد (وdir بالحكم نفسه)
      if (v === null || v !== wroteLang) {
        saveOriginals(h);
        htmlForeign = isForeignLang(v);
        htmlForeignV = htmlForeign ? v : null;
      }
    }
    var sel = selLangLabel();
    var foreign = htmlForeign || sel !== null;
    state.siteLang = htmlForeign ? htmlForeignV : sel;
    state.siteLangBy = htmlForeign ? "html" : sel !== null ? "sel" : null;
    if (foreign === state.siteForeign) return;
    state.siteForeign = foreign;
    refreshEnabled();
    fullPass();
  }
  var siteLangObs = null;
  function watchSiteLang() {
    if (!SITE_LANG || siteLangObs || !document.documentElement || typeof MutationObserver !== "function") return;
    try {
      siteLangObs = new MutationObserver(function (recs) {
        // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) إشارة الترطيب "lang" (meta.hydrateSignal، الأكاديمية): سجلٌّ لسمة lang لم نكتبه نحن (ownLangRecs) بعد
        // اكتمال التحليل = الموقع كتب لغة واجهته عند تركيب تطبيقه، ثم load وفترتا خمول (hydrationSignal). من سجلّ الطفرة لا من نداءٍ
        // مباشر للحكم: «en» التي رسمها الخادم تخالف wroteLang عند الإقلاع فكانت ستُحسب إشارةً كاذبة. ومراقبٌ يُركَّب بعد كتابة الموقع
        // (قراءة الإعدادات أبطأ من تركيبه) يفوّتها فيفتح السقفُ البوابة (أبطأ لا أعطب). واللغة الأخرى يحكمها judgeSiteLang بعدها فتخمد
        // الإضافة، وفتح البوابة عندئذٍ لا أثر له
        var site = 0;
        for (var i = 0; i < recs.length; i++) {
          if (recs[i].attributeName !== "lang") continue;
          if (ownLangRecs > 0) ownLangRecs--; else site++;
        }
        if (site && HYD_LANG && textGate === "wait" && document.readyState !== "loading") hydrationSignal("lang");
        judgeSiteLang();
      });
      siteLangObs.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) { siteLangObs = null; }
    judgeSiteLang(); // ما تغيّر بين الإقلاع وهذه اللحظة
  }
  function watchHtml() {
    if (htmlObs || !document.documentElement) return;
    try {
      htmlObs = new MutationObserver(function () {
        judgeSiteLang(); // أولًا: لغةٌ أجنبية كتبها الموقع مع ما محاه لا يُثبَّت فوقها شيء (والحكم لا يتكرّر أثره)
        if (!state.enabled || !active) return;
        var h = document.documentElement;
        // ومعها سمة الخط ومتغيّرا الإلحاق في Intercom (F.lostVars — DESIGN-fonts §٤.٤): محوُ style أو السمة يعيدهما
        var lost = h.getAttribute("data-cml") !== "on" || (state.rtl && h.getAttribute("dir") !== active.dir) || (!!F && F.lostVars());
        if (!lost) return;
        if (++htmlPins > (CONST.HTML_PIN_MAX || 10)) { htmlObs.disconnect(); return; } // الموقع يصرّ: لا تقاذف
        applyChrome();
      });
      htmlObs.observe(document.documentElement, { attributes: true,
        attributeFilter: ["dir", "lang", "data-cml", "data-cml-rtl", "style", CONST.FONT_ATTR || "data-cml-font"] });
    } catch (e) {}
  }

  function applyChrome() {
    // بعد ضبط السمات وخارج المسار الحرج؛ مرّةً لكل نداء لا مستمعاتٍ ومهلًا تتراكم مع كل
    // تغيير إعداد (مراجعة كودكس: تكرار مستمع إعادة الاتجاه) — والبصمة تمنع إعادة الطلب
    setTimeout(applyLiveSheet, 0);
    var html = document.documentElement;
    if (!html) return;
    saveOriginals(html);
    if (state.enabled && active) {
      html.setAttribute("data-cml", "on");
      if (META.routes) html.setAttribute("data-cml-route", state.route); else html.removeAttribute("data-cml-route");
      // (ر3) سمة «في المتن كتلةٌ معرَّبة» تُعاد مع سماتنا إن محاها إعادة رسم الجذر (watchHtml يرى محو data-cml فيستدعينا)
      // ★ (ر6-ب) ومعها «held» لصفحةٍ حجب حارسُ المتن قطعتها (bodyAttr)
      bodyAttr();
      // lang للغة النص المعروض لا لقلب الاتجاه (مراجعة كودكس): الترجمة وحدها بلا قلبٍ
      // تعرض عربيةً فيجب أن يقولها lang لقارئ الشاشة والتدقيق الإملائي
      setOwned(html, "lang", state.lang);
      if (state.rtl) {
        setOwned(html, "dir", active.dir);
        // بوابة محرّك v2: rtl-overrides.css كله خلف هذه السمة — بلاها خاملٌ حرفيًّا
        if (active.dir === "rtl" && state.rtlEngine !== "v1") {
          // ورقةٌ حيّةٌ محقونةٌ بالفعل ⇒ أبقِ بوابتها: إعادتُها إلى "v2" تُخمد الحيّة
          // وتوقظ اللقطة المتقادمة — وهذا عينُ ما نعالجه
          var liveOn = !!document.getElementById("cml-live-rtl");
          html.setAttribute("data-cml-rtl", liveOn ? "live" : "v2");
        } else html.removeAttribute("data-cml-rtl");
      } else {
        restoreOwned(html, "dir");
        html.removeAttribute("data-cml-rtl");
      }
    } else {
      endHold();   // أُطفئت الإضافة أو صار المسار خاملًا: لا إمساك
      markBodyTr(false); // (ر3) ولا تنبيه: ما عُرِّب من المتن يُستعاد الآن
      bodyAttr();        // ★ (ر6-ب) ولا «held»: والحكم باقٍ لهذه الصفحة فيعود بعودة التشغيل
      html.removeAttribute("data-cml");
      html.removeAttribute("data-cml-route");
      html.removeAttribute("data-cml-rtl");
      restoreOwned(html, "dir");
      restoreOwned(html, "lang");
    }
    applyWrapper();
    // الخط في آخر الفرعين: يحسم الاختيار ويتحقق من النسخة ويسلّح الوحدة أو يطفئها (DESIGN-fonts §٥.٢)
    fontApply();
  }

  // ---------- plurals ----------
  // Intl.PluralRules (منصة Baseline منذ 2019) بدل الصيغ اليدوية: تُحمَل قواعد CLDR
  // محدَّثةً لكل لغة، فإضافة لغةٍ جديدة لا تستلزم كتابة قواعد جمعها في المحرك —
  // والمشروع مفتوح ليضيف آخرون لغات. الخريطة أدناه **صريحة** لأن ترتيبها هو عقدُ
  // مصفوفات forms في القاموس — لغةٌ تُضاف مستقبلًا يُضاف سطرُ ترتيبها هنا، وفئةٌ
  // غير مذكورة في السطر تسقط إلى «other» (سلوك اللغات ناقصة الصيغ نفسه الذي كان قبلُ).
  var PLURAL_FORMS = {
    ar: ["zero", "one", "two", "few", "many", "other"],
    default: ["one", "other"],
  };
  var prCache = {};
  function pluralIndex(lang, n) {
    var order = PLURAL_FORMS[lang] || PLURAL_FORMS.default;
    var cat;
    try {
      var pr = prCache[lang] || (prCache[lang] = new Intl.PluralRules(lang));
      cat = pr.select(n);
    } catch (e) { cat = n === 1 ? "one" : "other"; } // لغة لا يعرفها المتصفح
    var i = order.indexOf(cat);
    if (i < 0) i = order.indexOf("other");
    return i < 0 ? order.length - 1 : i;
  }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function buildPlurals() {
    pluralRes = []; badPlurals = 0;
    if (!active) return;
    for (var eng in active.plurals) {
      var spec = active.plurals[eng];
      var forms = spec.forms || [];
      [eng, spec.plural].forEach(function (pat) {
        if (!pat) return;
        // ★ (٢١ ربيع الآخر ١٤٤٨هـ) البادئة والذيل الثابتان حول ‎%d‎ (الأول وحده يصير رقمًا كما في replace): فحصٌ رخيص قبل التعبير
        var at = pat.indexOf("%d"), pre = at < 0 ? null : pat.slice(0, at), suf = at < 0 ? null : pat.slice(at + 2);
        try { pluralRes.push({ re: new RegExp("^" + esc(pat).replace("%d", "(\\d+)") + "$"), forms: forms, pre: pre, suf: suf }); } catch (e) { badPlurals++; }
      });
    }
  }
  var DIGIT = /\d/; // \d كما في تعبير الجمع (‎(\d+)‎)
  function tryPlural(text) {
    if (!pluralRes) return null;
    for (var i = 0; i < pluralRes.length; i++) {
      var P = pluralRes[i];
      // لا سقف طول (توجيه المالك): نصٌّ لا يبدأ ببادئة الجمع أو لا ينتهي بذيله، أو لا رقمَ في طرفي موضع العدد، لا يُشغَّل عليه تعبيره
      if (P.pre !== null && (text.length <= P.pre.length + P.suf.length || !DIGIT.test(text.charAt(P.pre.length)) ||
          !DIGIT.test(text.charAt(text.length - P.suf.length - 1)) || text.lastIndexOf(P.pre, 0) !== 0 ||
          text.indexOf(P.suf, text.length - P.suf.length) !== text.length - P.suf.length)) continue;
      var m = text.match(P.re);
      if (m) {
        var n = +m[1];
        var f = pluralRes[i].forms[pluralIndex(state.lang, n)];
        if (f === undefined) f = pluralRes[i].forms[pluralRes[i].forms.length - 1] || "";
        return f.replace("%d", n);
      }
    }
    return null;
  }

  // ---------- dynamic patterns (dates, "%d days ago" composites, greeting-with-name…) ----------
  // dictionary "patterns": [{re, ar}] — ar may use $1..$9 (captured group),
  // %M<n> (group n is an English month name → Arabic), %W<n> (weekday), %P<n> (AM/PM),
  // and %C<n> (place name → Arabic *if known*, otherwise kept verbatim — never fails
  // the pattern, so an unknown city still gets the rest of the line translated).
  var MONTHS = { Jan: "يناير", January: "يناير", Feb: "فبراير", February: "فبراير", Mar: "مارس", March: "مارس", Apr: "أبريل", April: "أبريل", May: "مايو", Jun: "يونيو", June: "يونيو", Jul: "يوليو", July: "يوليو", Aug: "أغسطس", August: "أغسطس", Sep: "سبتمبر", Sept: "سبتمبر", September: "سبتمبر", Oct: "أكتوبر", October: "أكتوبر", Nov: "نوفمبر", November: "نوفمبر", Dec: "ديسمبر", December: "ديسمبر" };
  var WDAYS = { Mon: "الاثنين", Monday: "الاثنين", Tue: "الثلاثاء", Tuesday: "الثلاثاء", Wed: "الأربعاء", Wednesday: "الأربعاء", Thu: "الخميس", Thursday: "الخميس", Fri: "الجمعة", Friday: "الجمعة", Sat: "السبت", Saturday: "السبت", Sun: "الأحد", Sunday: "الأحد" };
  var PERIODS = { AM: "صباحًا", PM: "مساءً" };
  // أماكن شائعة (مدن ومناطق) — غير الموجود يبقى كما ورد
  var PLACES = {
    Riyadh: "الرياض", Jeddah: "جدة", Jiddah: "جدة", Mecca: "مكة المكرمة", Makkah: "مكة المكرمة",
    Medina: "المدينة المنورة", Madinah: "المدينة المنورة", Dammam: "الدمام", Khobar: "الخبر",
    Dhahran: "الظهران", Buraydah: "بريدة", Buraidah: "بريدة", Unaizah: "عنيزة", Tabuk: "تبوك",
    Abha: "أبها", "Khamis Mushait": "خميس مشيط", Taif: "الطائف", "Ta'if": "الطائف",
    Hail: "حائل", "Ha'il": "حائل", Najran: "نجران", Jazan: "جازان", Yanbu: "ينبع",
    Jubail: "الجبيل", Qatif: "القطيف", Hofuf: "الهفوف", Sakaka: "سكاكا", Arar: "عرعر",
    "Al-Qassim": "القصيم", Qassim: "القصيم", "'Asir": "عسير", Asir: "عسير",
    "Al-Bahah": "الباحة", Bahah: "الباحة", "Al-Jawf": "الجوف", Jawf: "الجوف",
    "Eastern Province": "المنطقة الشرقية", "Northern Borders": "الحدود الشمالية",
  };
  var patRes = null;
  // القاعدة الفاسدة تُعدّ وتُصرَّح — الابتلاع الصامت يجعل المستخدم يرى قاعدته محفوظةً
  // في الإعدادات والمحرك لا يطبّقها أبدًا فيظن الإضافة معطلة (قاعدة §7ج: الصمت يُقرأ عطلًا آخر)
  var badPatterns = 0, badPlurals = 0, lastBadReport = -1;
  function buildPatterns() {
    patRes = []; badPatterns = 0;
    if (!active || !active.patterns) return;
    for (var i = 0; i < active.patterns.length; i++) {
      var p = active.patterns[i];
      if (!p || !p.re || !p.ar) continue;
      try { patRes.push({ re: new RegExp(p.re), ar: p.ar, src: p.re }); } catch (e) { badPatterns++; }
    }
  }
  // ★ فهرسُ الأنماط: كان كل نصٍّ لاتينيٍّ غير مترجَم يمسح 2,595 تعبيرًا خطيًّا (0.63 مث للنص؛ 300 عنوان محادثة = 189 مث
  // تجميدًا)، ففُهرست بأول كلمةٍ ثابتة وسلّةٍ عامة لما بدأ بمتغيّر. (٢١ ربيع الآخر ١٤٤٨هـ، توجيه المالك: لا سقف طولٍ يمنع
  // تعريب نصّ موقع) والفهرس الآن في cml-shared (patternIndex — مصدرٌ واحد مع أدوات القياس واختبار التكافؤ): أول كلمةٍ
  // ثابتة، ثم آخر محرفٍ من الذيل الثابت لما بدأ بمتغيّر، وثوابتُ كل نمطٍ وأدنى طوله تُفحص قبل تعبيره — فالقالب الطويل
  // يُترجم، والطويل الذي لا يطابق لا يُشغَّل عليه تعبيرٌ غالبًا. (ومفاتيح الفهرس بلا نموذجٍ موروث — مراجعة كودكس ٢٥.)
  var patIdx = null;
  function buildPatIndex() {
    patIdx = SHARED.patternIndex(patRes.map(function (p) { return p.src; }));
  }
  // capOk (اختياري، لعنوان التبويب وحده): التقاطٌ لا يقبله يجعل النمط غير مطابق فيُجرَّب التالي
  function tryPatterns(text, capOk) {
    if (!patRes || !patRes.length || !/[A-Za-z]/.test(text)) return null;
    if (!patIdx) buildPatIndex();
    var hit = patIdx.find(text, function (i) {
      var m = text.match(patRes[i].re);
      if (!m) return null;
      var bad = false;
      var out = patRes[i].ar
        .replace(/%M(\d)/g, function (t, g) { var v = ownGet(MONTHS, m[+g]); if (v === undefined) { bad = true; return t; } return v; })
        .replace(/%W(\d)/g, function (t, g) { var v = ownGet(WDAYS, m[+g]); if (v === undefined) { bad = true; return t; } return v; })
        .replace(/%P(\d)/g, function (t, g) { var v = ownGet(PERIODS, m[+g]); if (v === undefined) { bad = true; return t; } return v; })
        .replace(/%C(\d)/g, function (t, g) { var raw = m[+g]; if (raw === undefined) return ""; var v = ownGet(PLACES, raw); return v === undefined ? raw : v; })
        .replace(/\$(\d)/g, function (t, g) {
          var c = m[+g];
          if (c === undefined) return "";
          if (capOk && !capOk(c)) bad = true;
          return c;
        });
      return bad ? null : { v: out }; // an unmapped %M/%W/%P means the pattern didn't really fit — try the next one
    }, CONST.PATTERN_CAPTURE_MAX);
    return hit ? hit.v : null;
  }

  // ---------- text + attributes ----------
  // القواعد من cml-shared.js (DOM_RULES) — مصدرٌ واحد مع حاصد DOM فمفاتيحه مفاتيحنا حرفًا بحرف
  var SKIP = SHARED.DOM_RULES.SKIP;
  // ★ الحاجز بالأب المباشر وحده لا يكفي: كتلة شيفرة بنية <pre><code><span>…</span></code></pre>
  // — وهي بنية إبراز الصياغة المعتادة — أبو عقدتها النصية <span> لا <code>، فيمرّ نصّ
  // الشيفرة فيُترجَم. `closest` يصعد إلى الجذر بلا سقف فيسدّها. (مسار walk كان محميًّا
  // بالتقليم من مستوى العنصر، أما مسار الطفرات فينفذ إلى translateText مباشرة.)
  var SKIP_ANCESTOR = SHARED.DOM_RULES.SKIP_ANCESTOR;
  function inSkipped(el) {
    if (el && el.nodeType !== 1) el = el.parentNode;
    if (!el || el.nodeType !== 1 || !el.closest) return false;
    try { return !!el.closest(SKIP_ANCESTOR); } catch (e) { return false; }
  }
  var ATTRS = SHARED.DOM_RULES.ATTRS, ATTR_SELECTOR = SHARED.DOM_RULES.ATTR_SELECTOR;

  // سجلّ ما تُرجم: عقدة → {raw الأصل الإنجليزي, key, lastWritten آخر ما كتبناه}.
  // بدونه يضيع الأصل بعد الترجمة، فلا يمكن تطبيق تصحيحات «كلماتك المحفوظة» على عقدة
  // مترجمة إلا بإعادة تحميل الصفحة — وهو ما كان يجعل الميزة تبدو معطلة.
  var appliedText = new WeakMap();
  var appliedAttr = new WeakMap();

  // ★ ذاكرة نتائج البحث (تشمل الإخفاق). بعد توسّع القواعد إلى ما يقارب الألف صار كل نصٍّ
  // غير مترجَم يكلّف مسحًا كاملًا للأنماط (~0.35 مللي ثانية للنص الواحد قياسًا)، وواجهة
  // claude.ai تعيد عرض العقد نفسها مئات المرات أثناء البث والتمرير — فبلا تخزين تتكرر
  // الكلفة نفسها بلا فائدة. المفتاح ← الناتج (أو null). تُمسح في compile() لأن تعديل
  // «كلماتك المحفوظة» أو القواعد المستوردة يغيّر النتائج.
  var lookupCache = null;
  var LOOKUP_CACHE_MAX = CONST.LOOKUP_CACHE_MAX;

  // سلسلة البحث الموحّدة: القاموس ← الجموع ← الأنماط. null = لا ترجمة.
  // ★ قراءةٌ بالملكية لا بالوراثة: نصُّ واجهةٍ يساوي اسمَ عضوٍ موروثٍ من Object.prototype
  // (constructor، toString، valueOf، __proto__…) كان يُستبدل بمصدر دالةٍ داخلية — وعناوين
  // المحادثات والمشاريع نصوصٌ يتحكّم بها المستخدم وتقع خارج استثناء متن المحادثة
  function ownGet(o, k) {
    return (o && Object.prototype.hasOwnProperty.call(o, k)) ? o[k] : undefined;
  }

  // ★ (٢١ ربيع الآخر ١٤٤٨هـ، توجيه المالك: «لا يمنع أي حدٍّ تقني تعريب نص موقعٍ مهما طال ما دام ليس محادثةً أو محتوى
  // مستخدم») لا سقف طولٍ لمفتاح عقدةٍ أو سمةٍ أو عنوان — كان ما فوق TEXT_MAX (300) لا يُطلب أصلًا، فـ104 رسائل في كتالوج
  // claude.ai (حتى 1,118 محرفًا) لا تُترجم أبدًا. المطابقة الحرفية بحثٌ في جدول، والجمع والنمط مفهرسان بثوابتهما (tryPlural،
  // patternIndex) فلا كلفة على الطويل الذي لا يطابق. والحماية استثناءُ مناطق المحادثة ومحتوى المستخدم (translable) لا الطول.
  var KEY_MAX = Infinity;
  // وذاكرة البحث لما لا يزيد مفتاحه على LOOKUP_CACHE_KEY_MAX وحده: حدُّ ذاكرةٍ (5,000 مفتاحٍ طويل قد تبلغ ميغابايتات) لا حدُّ
  // ترجمة — الطويل يُطلب كل مرةٍ بالفهرس، وكلفته جدولان وفحصُ ثوابت
  var CACHE_KEY_MAX = CONST.LOOKUP_CACHE_KEY_MAX || 300;
  function lookup(key) {
    var cacheable = !!lookupCache && key.length <= CACHE_KEY_MAX;
    if (cacheable) {
      var hit = lookupCache.get(key);
      if (hit !== undefined) return hit;
    }
    var v = ownGet(active.overrides, key);
    if (v === undefined) v = ownGet(active.strings, key);
    if (v === undefined) { var pl = tryPlural(key); if (pl !== null) v = pl; }
    if (v === undefined) { var pt = tryPatterns(key); if (pt !== null) v = pt; }
    var out = v === undefined ? null : v;
    if (cacheable) {
      if (lookupCache.size >= LOOKUP_CACHE_MAX) lookupCache.clear(); // سقف يحمي الذاكرة
      lookupCache.set(key, out);
    }
    return out;
  }

  // Never touch the CONTENT of a conversation (user/Claude message prose):
  // the engine only relabels UI chrome, never reads/rewrites message text.
  // كان الصعود يدويًّا بسقف عشرة مستويات، فرسالةٌ عميقة التداخل (قائمة داخل اقتباس داخل
  // جدول) تتجاوز السقف فيُعامَل نصّها معاملة الواجهة ويُعاد كتابته — وهو ما يحرّم على
  // الإضافة أن تفعله. closest يصعد إلى الجذر بلا سقف وهو مبنيّ في المتصفح فأسرع.
  var CHAT_ANCESTOR = SHARED.DOM_RULES.CHAT_ANCESTOR;
  function inChatContent(el) {
    if (!CHAT_ON) return false;
    if (el && el.nodeType !== 1) el = el.parentNode;
    if (!el || el.nodeType !== 1 || !el.closest) return false;
    try { return !!el.closest(CHAT_ANCESTOR); } catch (e) { return false; }
  }
  // ★ (١-٣) مسار «هيكل فقط» (routes.shell): محتوى meta.shellSel يبقى على أصله — لا تعريب ولا
  // قلب (docs-point.css يبقيه LTR ببوابة data-cml-route) — ويُعرَّب ما حوله من هيكل الموقع
  var SHELL_SEL = META.shellSel || null;
  function inShell(el) {
    if (!SHELL_SEL || state.route !== "shell") return false;
    if (el && el.nodeType !== 1) el = el.parentNode;
    if (!el || el.nodeType !== 1 || !el.closest) return false;
    try { return !!el.closest(SHELL_SEL); } catch (e) { return false; }
  }
  // ★ (وثائق Claude Code) meta.skipSel: ما لا يُعرَّب أبدًا في النطاق — أجوبة مساعد Mintlify المولَّدة
  // (#chat-content). عبارةٌ قصيرة منها («Settings») تطابق القاموس فكانت تُعرَّب داخل جوابٍ إنجليزي؛ فهي
  // كمتن المحادثة في التطبيق: لا نصَّ ولا سمة يُقرأ للمطابقة، في كل مسار. وحاصد DOM يستثنيها بالمحدِّد نفسه.
  var SKIP_SEL = typeof META.skipSel === "string" && META.skipSel ? META.skipSel : null;
  function inSkipSel(el) {
    if (!SKIP_SEL) return false;
    if (el && el.nodeType !== 1) el = el.parentNode;
    if (!el || el.nodeType !== 1 || !el.closest) return false;
    try { return !!el.closest(SKIP_SEL); } catch (e) { return false; }
  }
  // ★ داخل المتن (meta.bodySel) والمتون إنجليزيةٌ إلى المرحلة ٤: لا يُعرَّب إلا نصٌّ هو كتلته كلّها
  // (عنوانٌ، بندٌ، خليّة). جزءٌ من جملةٍ إنجليزية — رابطٌ يطابق عنوانًا في القاموس — كان يُعرَّب وحده
  // فتخرج جملةٌ مختلطة («…see استخدام الرسائل API and the…»، قِيس على الوثائق)
  var BODY_SEL = META.bodySel || null;
  var BLOCK_SEL = "p, li, td, th, dt, dd, h1, h2, h3, h4, h5, h6, blockquote, figcaption, summary, caption";
  function fragmentInBody(p, node) {
    if (!BODY_SEL) return false;
    try {
      if (!p.closest || !p.closest(BODY_SEL)) return false;
      var blk = p.closest(BLOCK_SEL);
      if (!blk) return false;
      return (blk.textContent || "").trim() !== (node.nodeValue || "").trim();
    } catch (e) { return false; }
  }
  function translable(node) {
    var p = node.parentNode;
    if (!p) return false;
    if (inSkipSel(p)) return false;
    if (inShell(p)) return false;
    if (fragmentInBody(p, node)) return false;
    if (inSkipped(p)) return false;   // بالسلف لا بالأب المباشر (شيفرة ملفوفة في <span>)
    if (p.isContentEditable) return false;
    if (inChatContent(p)) return false;
    return true;
  }
  // ★★ (المرحلة ٢) وضع الكتلة داخل المتن: الفقرة وحدةُ الترجمة (التطبيع والقالب والبصمة في cml-shared،
  // واحدٌ مع حاصد الكتل). ترتيب البحث لكتلة: عقدةٌ وحيدة ⇒ قاموس الواجهة أولًا (عنوانٌ أو بندٌ مترجَم
  // هناك)؛ ثم تصحيح المستخدم للكتلة ثم قطعة متون الصفحة بالبصمة؛ وما لم يوجد يبقى إنجليزيًّا كلّه (لا
  // جملة مختلطة) ويعود إلى قاعدة المرحلة ١ لكل عقدة (fragmentInBody). والكتابة قيمٌ في العقد القائمة
  // وحدها بعد تحقّق العقد (blockWrites): الرموز نفسها ولا نصَّ في خانةٍ بلا عقدة — وإلا بقيت الإنجليزية.
  var BODIES_ON = !!(META.bodies && BODY_SEL);
  var K_BOV = dk("cml_block_ov");
  var blkPass = 1, blkStamp = new WeakMap(), badBlocks = 0, kindMemo = new WeakMap();
  // ★ (المرحلة ٤، منقولٌ إلى 2.0.0 — ١٦ ربيع الآخر ١٤٤٨هـ) مالكو كتلٍ كتب فيها وضع الكتلة ترجمةً كاملة: نصُّها كلُّه بلغة الهدف
  // يقينًا، فاتجاهها اتجاهُ اللغة لا حكمُ عدّ الحروف — «Claude Code CLI عبر OAuth في Claude Enterprise.» لاتينيّها أكثر فكان
  // resolveDir يتركها لـauto فتُعرض LTR (فحص الاتجاه على متون الموجة الأولى: 8 فقرات). والعضوية للمالك الذي لا نصَّ فيه خارج
  // هذه الكتلة (ما سواها كتلٌ تحمل اتجاهها هي، كالقائمة المتداخلة في بند) — فمالكٌ بكتلتين إحداهما إنجليزية يبقى لحكم النص.
  // ويُمحى العضو متى عادت الكتلة إنجليزية، ويُعاد حكم اتجاهه فورًا (setChatDir) إن كان قد حُكم قبلُ.
  var blkOwnersTr = new WeakSet();
  function soleRun(owner, b) {
    var inside = false;
    for (var c = owner.firstChild; c; c = c.nextSibling) {
      if (c === b.first) inside = true;
      if (!inside) {
        if (c.nodeType === 3 && /\S/.test(rawOfNode(c) || "")) return false;
        if (c.nodeType === 1 && SHARED.inlineKind(c, rawOfNode, kindMemo) && SHARED.inlineKind(c, rawOfNode, kindMemo) !== "g") return false;
      }
      if (c === b.last) inside = false;
    }
    return true;
  }
  var bodyMap = null, bodyPage = null, bodyLang = null, bodyPending = false, bodyGen = 0, holdForBodies = false;
  // ★ (S6-C) علامات «يبقى كما في المصدر» لكتل هذه الصفحة (keep في القطعة، من قرارات المترجم ar = src عبر merge-blocks):
  // بصمةٌ ← 1. والقطعة لا تحمل نصًّا إنجليزيًّا ولا عربيًّا لها — قرارٌ لا ترجمة
  var bodyKeep = null;
  // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) سمةٌ على الجذر ما دامت في الصفحة الحاضرة كتلةٌ من المتن كُتبت كلُّها بلغة الهدف من القطعة أو من
  // تصحيح المستخدم (data-cml-body="tr"): تنبيه الوثائق القانونية في legal-point.css معلَّقٌ بها، فلا يظهر فوق متنٍ إنجليزيٍّ لم يُعرَّب
  // منه شيء (لا قطعة بعد، أو غيّرت الشركة الوثيقة، أو اختار القارئ لغةً أخرى من منتقي الصفحة). تُمحى مع كل تبدّلٍ للصفحة أو اللغة
  // ومع وصول القطعة (فتُكسب من جديد بقطعة الصفحة نفسها)، وفي الإطفاء والخمول؛ وتُعاد مع السمات إن محاها إعادة رسم الجذر (applyChrome).
  // عامّةٌ لكل نطاقٍ بمتون ولا مفتاح تخزين لها
  var bodyTr = false;
  function markBodyTr(on) {
    if (bodyTr === on) return;
    bodyTr = on;
    bodyAttr();
  }
  // ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ) سمة حال المتن على الجذر من الحالين معًا: «held» إن حجب حارسُ المتن قطعةَ الصفحة (وتغلب، فتصحيحُ قارئٍ
  // كُتب في صفحةٍ محجوبة لا يمحوها)، وإلا «tr» كما كانت؛ وتُمحى في الإطفاء والخمول. وبلا حارسٍ فهي «tr» أو لا شيء كما كانت حرفًا
  // ★ (ر6-د، ٣٠ ربيع الآخر ١٤٤٨هـ — القرار 84) ومعها سببُ الحجب ما دامت «held»: data-cml-held="drift" (للصفحة قطعةٌ تغيّر متنها في الموقع
  // بعدها) أو "none" (لا قطعة لها في هذا الإصدار) — به تفرّق النافذة والاختبارات بين السببين؛ وتُمحى مع «held»
  function bodyAttr() {
    var h = document.documentElement;
    if (!h) return;
    var held = !!(state.enabled && active && bodyHeld && state.route === "full");
    var v = state.enabled && active ? (held ? "held" : bodyTr ? "tr" : null) : null;
    if (v) { if (h.getAttribute("data-cml-body") !== v) h.setAttribute("data-cml-body", v); }
    else h.removeAttribute("data-cml-body");
    var w = held && bodyWhy ? bodyWhy : null;
    if (w) { if (h.getAttribute("data-cml-held") !== w) h.setAttribute("data-cml-held", w); }
    else if (h.hasAttribute("data-cml-held")) h.removeAttribute("data-cml-held");
  }
  // ★★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ) حارس المتن المختلط على مستوى الصفحة (meta.bodyGuard، عتبةٌ لكل نطاق في cml-const.js). تغيّرت وثائق
  // Claude Code بعد حصادها فصارت كتلٌ إنجليزية (جديدةٌ أو معدَّلة لا تعرفها القطعة) بين العربية في 114 صفحة من 124. فبعد وصول قطعة الصفحة
  // وترطيبها تُعدّ كتل المتن الحيّة كلها كما يعدّها الحاصد (bodyCoverage)، والمغطّى منها ما يعرّبه وضع الكتلة أو يبقيه بقرار: ترجمةٌ في القطعة
  // أو تصحيح القارئ، أو علامة إبقاء، أو قاموس الواجهة (العقدة الوحيدة واللافتة المكرّرة وصفّ اللافتات)، أو محايدٌ بلا كلمةٍ لاتينية خارج
  // الشيفرة. فإن زادت حصّة غير المغطّى على العتبة حُجب المتن في هذه الصفحة: لا يُكتب داخله شيء (heldNow: لا من القطعة ولا من قاموس الواجهة
  // ولا تصحيح القارئ) فيبقى إنجليزيًّا كلُّه والواجهة حوله عربية، وعلى الجذر data-cml-body="held". والحكم مرّةً لكل صفحة: لا يُعاد إلا بتنقّلٍ
  // إلى صفحةٍ أخرى أو تبدّل اللغة، وما يُضاف بعده (لوحة تبويب، أكورديون، قسمٌ متأخر) يتبعه. ولا يُكتب في المتن شيءٌ قبل الحكم (bodyGate)،
  // ولا من قطعة الصفحة السابقة أثناء انتظار قطعة الجديدة.
  // وبعد التنقّل داخل الموقع يُنتظر تبدّلُ الشجرة ثم هدوءٌ قصير (BODY_GUARD_QUIET_MS) بسقفٍ (BODY_GUARD_CAP_MS) — فلا يُحكم على متن الصفحة
  // السابقة. وبلا عتبةٍ للنطاق فالسلوك كما كان حرفًا (shardOn صادقةٌ دائمًا، ولا عدّ)
  // ★ (ر6-ج، ٣٠ ربيع الآخر ١٤٤٨هـ — مراجعة ر6-ب R10 وR8 وR4) والتبدّلُ تبدّلُ هويّة الشجرة لا أيُّ إضافة (guardTrack)، والهدوء يُعدّ من
  // لحظته لا من آخر إضافةٍ صغيرة يُلحقها الموقع بعده، ولا حكمَ على شجرة الصفحة السابقة ولو بلغ السقف (guardArm)
  // ★ (ر6-د، ٣٠ ربيع الآخر ١٤٤٨هـ — القرار 84) والصفحة التي لا قطعة لها (ليست في فهرس النطاق، أو تعذّر جلبها) يُحكم عليها بالحارس نفسه وبقطعةٍ
  // فارغة: ما يغطّيه قاموس الواجهة أو علامة الإبقاء أو تصحيح القارئ أو المحايد مغطًّى، والفقرات غير مغطّاة. فإن زادت حصّة غير المغطّى على
  // العتبة حُجبت كالمحروسة (لا يكتب قاموس الواجهة داخل متنها، وسببها "none")؛ وصفحةٌ يغطّي قاموسُ الواجهة متنَها (صفحات المجموعات وبطاقات
  // الصفحة الأولى) أو لا كتلة فيها لا تُحجب، فتبقى كما كانت. والحكم في لحظة حكم المحروسة نفسها (وصول الجواب null وجاهزية الشجرة)، بلا انتظارٍ آخر
  var GUARD = BODIES_ON && typeof META.bodyGuard === "number" && META.bodyGuard >= 0 && META.bodyGuard < 1 ? META.bodyGuard : null;
  var GUARD_QUIET_MS = CONST.BODY_GUARD_QUIET_MS || 150, GUARD_CAP_MS = CONST.BODY_GUARD_CAP_MS || 2500;
  var GUARD_POLL_MS = CONST.BODY_GUARD_POLL_MS || 100;
  // ★ (ر6-د) bodyWhy سبب حكم هذه الصفحة: "drift" لها قطعة، و"none" لا قطعة لها — للسمة data-cml-held وجواب النافذة
  var bodyHeld = false, bodyJudged = false, bodyStat = null, bodyWhy = null;
  var guardWait = false, guardCapped = false, guardQT = null, guardCT = null, guardPT = null;
  // ★ (ر6-ج) هويّة شجرة المتن: لأيّ صفحةٍ هي (gdKey)، ولقطتها (gdSnap)، ومتى صارت لها (gdAt)، ولقطةُ الصفحة السابقة ما دام تبدّلها منتظَرًا (gdFrom)
  var gdKey = null, gdSnap = null, gdAt = 0, gdFrom = null;
  // أيُكتب من قطعة الصفحة الآن؟ بلا حارس: نعم كما كان. وبه: بعد حكم هذه الصفحة وإن لم تُحجب، ووصولِ قطعتها هي
  function shardOn() { return GUARD === null || (bodyJudged && !bodyHeld && !bodyPending); }
  // صفحةٌ حُجب متنها الآن: لا يُكتب داخل المتن (bodySel) شيءٌ أصلًا — لا قطعة ولا قاموس واجهة ولا تصحيح قارئ — فلا «نعم» عربية في جدولٍ
  // إنجليزي ولا عنوانٌ يطابق نصَّ واجهةٍ فوق فقرةٍ إنجليزية؛ وما كُتب فيه قبل الحكم يُرجع. وما خارج المتن (الشريط والرأس والتذييل) يُعرَّب كالعادة
  function heldNow() { return bodyHeld && state.route === "full"; }
  // الكتابة داخل المتن: 0 كالعادة (بلا حارس، أو حُكم للصفحة ولم تُحجب، أو مسارٌ غير كامل)؛ 1 لم يُحكم بعدُ — لا كتابة ولا إرجاع، فلا وميض
  // عربيٍّ يُمحى إن حُجبت، وما بقي من الصفحة السابقة يُحكم معها؛ 2 محجوبة — لا كتابة، وما كُتب يُرجع
  function bodyGate() { return GUARD === null || state.route !== "full" ? 0 : bodyHeld ? 2 : bodyJudged ? 0 : 1; }
  function guardClear() {
    if (guardQT) clearTimeout(guardQT);
    if (guardCT) clearTimeout(guardCT);
    if (guardPT) clearInterval(guardPT);
    guardQT = guardCT = guardPT = null;
  }
  // ★ (ر6-د، ٣٠ ربيع الآخر ١٤٤٨هـ) وما دام التبدّل منتظَرًا يُنظر في هويّة الشجرة كل GUARD_POLL_MS (guardArm) لا مع دفعات الطفرات وحدها:
  // وثائق المطوّرين في الرجوع والتقدّم تُظهر الصفحة المخبوءة وتُخبّئ الحاضرة بتبديل style وحده، ومراقب الطفرات لا يرى style — فكان
  // الحكم ينتظر طفرةً أخرى لا صلة لها (0.4–0.7 ث بعد التبدّل مقيسًا). والنظر نفسه (guardTrack) لا يحكم على شجرة الصفحة السابقة.
  // وبسقف GUARD_CAP_MS من آخر انتظار: تنقّلٌ يتبدّل فيه العنوان ولا تتبدّل الشجرة أبدًا (ر6-ج، المراجعة F2) لا يُبقي نظرًا لا ينتهي
  var guardPollEnd = 0;
  function guardPoll() {
    guardPollEnd = Date.now() + GUARD_CAP_MS;
    if (guardPT) return;
    guardPT = setInterval(function () {
      if (!guardWait || bodyJudged || Date.now() > guardPollEnd) { clearInterval(guardPT); guardPT = null; return; }
      guardArm();
    }, GUARD_POLL_MS);
  }
  // صفحةٌ أو لغةٌ جديدة: حكمٌ جديد. nav: تنقّلٌ من صفحةٍ سابقة — يُحكم حين تصير الشجرة شجرتَها (guardArm)، والسقف من الآن.
  // ★ (ر6-ج) وتبدّلُ اللغة أثناء انتظار تبدّل الشجرة لا يُسقط الانتظار
  function guardReset(nav) {
    guardClear();
    bodyJudged = false; bodyHeld = false; bodyStat = null; bodyWhy = null;
    if (nav) { guardWait = true; guardCapped = false; }
    if (guardWait) { guardCT = setTimeout(function () { guardCT = null; guardCapped = true; guardArm(); }, GUARD_CAP_MS); guardPoll(); }
    bodyAttr();
  }
  // ★ (ر6-ج، ٣٠ ربيع الآخر ١٤٤٨هـ) هويّة شجرة المتن تُتابَع مع كل دفعة طفرات وفي كل حال — ولو كانت الإضافة مطفأةً أو المسار غير كامل:
  // لأيّ صفحةٍ هي الشجرة الحاضرة. لقطتها جذور المتن (bodySel)، وعيّنةٌ من أبنائها المباشرين (حتى ستّةٍ لكل جذرٍ موزَّعةٍ عليهم، أولُهم وآخرهم
  // فيها)، ونصُّ أول عنوان h1 فيها بأصله (rawOfNode، فكتابتنا فيه لا تغيّره). وتتبع اللقطةُ إعادةَ رسم الصفحة نفسها؛ فإذا سمّى العنوانُ صفحةً
  // أخرى لم تصر الشجرة شجرتَها حتى تفارق شجرةَ السابقة: يخرج جذرٌ من المستند، أو أكثرُ العيّنة، أو يتغيّر نصُّ العنوان — لا بأي إضافةٍ في
  // الصفحة (تلميحٌ أو شريطٌ جانبي أو أشرطة تمرير) — وgdAt لحظةُ ذلك. قِيس في وثائق Claude Code: كل تنقّلٍ يستبدل الجذور الثلاثة والعنوان معًا،
  // في دفعة تبدّل العنوان نفسها عند النقر وبعده بـ75–190 مث في الرجوع والتقدّم. ورجوعٌ إلى الصفحة نفسها قبل التبدّل يُلغي انتظاره
  function guardTrack() {
    if (GUARD === null) return;
    var k = SHARED.pageKey(META, location.pathname);
    if (gdKey === null || k === gdKey) { gdFrom = null; gdSnap = guardSnap(); if (gdKey === null) { gdKey = k; gdAt = Date.now(); } return; }
    if (!gdFrom) gdFrom = gdSnap;
    if (guardLeft(gdFrom)) { gdKey = k; gdFrom = null; gdSnap = guardSnap(); gdAt = Date.now(); }
  }
  // جذور المتن مع كل دفعة: محدِّدٌ من معرّفاتٍ وحدها (#content, #header, #table-of-contents) يُقرأ بـgetElementById بترتيب المستند —
  // querySelectorAll على قائمة محدِّداتٍ يمشي المستند كلَّه (قِيس: 0.9–2.3 مث للدفعة في hooks وerrors وsettings-reference، ونحو ميكروثانيةٍ
  // بالمعرّفات)؛ وغيرُه بـquerySelectorAll
  var GUARD_IDS = (function () {
    var parts = String(BODY_SEL || "").split(","), ids = [];
    for (var i = 0; i < parts.length; i++) { var m = /^\s*#([A-Za-z][\w-]*)\s*$/.exec(parts[i]); if (!m) return null; ids.push(m[1]); }
    return ids.length ? ids : null;
  })();
  // ★ (ر6-د، ٣٠ ربيع الآخر ١٤٤٨هـ) جذرٌ خبّأه الموقع بنمطٍ مضمَّن (display:none على الجذر أو على أحد أصوله): صفحةٌ سابقة يُبقيها الموقع في
  // المستند بعد التنقّل داخله. وثائق المطوّرين (Next.js) تُبقي كلَّ صفحةٍ زارها القارئ مخبوءةً بـ‎style="display: none !important"‎ على
  // مُغلِّفها — مقيسٌ في ر6-د: بعد تنقّلين ستة جذور، أربعةٌ منها لصفحتين سابقتين — فكانت كتلُها تُعدّ في حكم الصفحة الحاضرة بقطعتها هي:
  // batch-processing تُحمَّل وحدها «tr» بـ9 من 250، وبعد تنقّلٍ إليها «held» بـ519 من 859. فلا يُعدّ المخبوء في الحكم ولا في هويّة الشجرة؛
  // والإخفاء المتجاوب بالأصناف (الفهرس دون عرض xl) ليس منه فيبقى معدودًا، فالحكم واحدٌ في العرضين
  function rootCached(r) {
    for (var e = r; e && e.nodeType === 1; e = e.parentElement) {
      var st = e.getAttribute("style");
      if (st && st.indexOf("none") >= 0 && /(^|;)\s*display\s*:\s*none/i.test(st)) return true;
    }
    return false;
  }
  // ★ (ر6-د) وجذور المتن المخبوءة الآن، مرّةً لكل حقبة (cacheEpoch: تُزاد مع كل دفعة طفراتٍ وكل مرورٍ كامل، ففي الدفعة الواحدة حسابٌ واحد
  // مهما كثرت العقد المضافة) — وفي الغالب لا شيء فلا فحصَ لكل عقدة. والمعرّفات بـgetElementById كما في guardRoots (querySelectorAll على
  // قائمة محدِّداتٍ يمشي المستند كلّه)
  var cacheEpoch = 0, cachedAt = -1, cachedList = [];
  function cachedRootsNow() {
    if (cachedAt === cacheEpoch) return cachedList;
    cachedAt = cacheEpoch; cachedList = [];
    var all = [], i, e;
    if (GUARD_IDS) { for (i = 0; i < GUARD_IDS.length; i++) { e = document.getElementById(GUARD_IDS[i]); if (e) all.push(e); } }
    else { try { all = document.querySelectorAll(BODY_SEL); } catch (x) { all = []; } }
    for (i = 0; i < all.length; i++) if (rootCached(all[i])) cachedList.push(all[i]);
    return cachedList;
  }
  // عقدةٌ في متن صفحةٍ مخبوءة: لا يُكتب فيها ولا يُرجع منها شيء (translateText وtranslateAttrs) — تبقى كما تُركت حين كانت صفحتُها حاضرة،
  // فتعود كما هي إن رجع إليها القارئ. كان يُكتب فيها بحال الصفحة الحاضرة (قاموس الواجهة وقطعتُها) فيظهر عند الرجوع إلى صفحةٍ محجوبة
  // عنوانُها عربيًّا 0.4 ث حتى يُحكم لها فيُمحى (مقيسٌ في ر6-د: الرجوع إلى prompt-caching)
  function inCachedBody(p) {
    if (GUARD === null || !p) return false;
    var l = cachedRootsNow();
    for (var i = 0; i < l.length; i++) if (l[i] === p || l[i].contains(p)) return true;
    return false;
  }
  function guardRoots() {
    var out = [], i, e;
    if (!GUARD_IDS) {
      var all;
      try { all = document.querySelectorAll(BODY_SEL); } catch (x) { return []; }
      for (i = 0; i < all.length; i++) if (!rootCached(all[i])) out.push(all[i]);
      return out;
    }
    for (i = 0; i < GUARD_IDS.length; i++) { e = document.getElementById(GUARD_IDS[i]); if (e && !rootCached(e)) out.push(e); }
    return out.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
  }
  function guardH1El(rs) {
    var e = null, i;
    for (i = 0; i < rs.length && !e; i++) e = rs[i].querySelector("h1");
    // ★ (ر6-د، المراجعة) وعنوانُ الصفحة خارج جذور المتن (مركز المساعدة: h1 المقالة فوق ‎.article_body‎): أولُ h1 ظاهرٍ في المستند. الموقع يعيد
    // استعمال الجذر وابنه الوحيد بين مقالتين ويغيّر النصوص في مكانها، فكان التنقّل من مقالةٍ إلى أخرى لا يُرى تبدّلًا ولا يُحكم للحاضرة أبدًا:
    // متنها إنجليزيٌّ ولو كانت معرَّبة، وفيه فقرةٌ عربية من السابقة تشترك فيها المقالتان فلم يمسّها الموقع (متنٌ مختلط) — مقيسٌ في المراجعة
    if (!e && rs.length) { var hs = document.getElementsByTagName("h1"); for (i = 0; i < hs.length && !e; i++) if (!rootCached(hs[i])) e = hs[i]; }
    return e;
  }
  function guardH1(rs, e) {
    if (e === undefined) e = guardH1El(rs);
    if (!e) return null;
    var s = "", tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, null), t;
    while ((t = tw.nextNode())) s += rawOfNode(t);
    return s;
  }
  function guardSnap() {
    var rs = guardRoots(), roots = [], kids = [];
    for (var i = 0; i < rs.length; i++) {
      var ch = rs[i].children, n = ch.length, m = Math.min(n, 6);
      roots.push(rs[i]);
      for (var j = 0; j < m; j++) kids.push(ch[m < 2 ? 0 : Math.round(j * (n - 1) / (m - 1))]);
    }
    var he = guardH1El(rs);
    return { roots: roots, kids: kids, h: guardH1(rs, he), he: he };
  }
  // فارقت الشجرةُ لقطةَ الصفحة السابقة s؟ (صفحةٌ بلا جذورٍ سابقة: بظهور جذر)
  function guardLeft(s) {
    var rs = guardRoots(), i, gone = 0;
    if (!s.roots.length) return rs.length > 0;
    for (i = 0; i < s.roots.length; i++) {
      if (!s.roots[i].isConnected) return true;
      // ★ (ر6-د) أو خبّأه الموقع (rootCached) وظهر متنٌ غيره: تنقّلٌ في موقعٍ يُبقي الصفحات السابقة مخبوءةً في المستند
      if (rs.length && rs.indexOf(s.roots[i]) < 0) return true;
    }
    // ★ (ر6-د، المراجعة) ولا جذرَ ظاهرًا وجذورُ الصفحة السابقة باقيةٌ في المستند (مخبوءة): متنُ الحاضرة لم يأتِ بعد (حالُ تحميلٍ بين الصفحتين)
    // فيُنتظر. كانت قاعدة العنوان تقارن عنوان السابقة بلا شيء فتقول «فارقت»، فيُحكم على هيكلٍ بلا كتلة (لا حجب) ثم يُكتب في متن الحاضرة إذا جاء
    if (!rs.length) return false;
    // ★ (ر6-د، المراجعة) أو خرج عنصرُ عنوان الصفحة السابقة h1 من المستند: مرجع الواجهة البرمجية يُبقي ‎.stldocs-root‎ وابنه الوحيد ويبني العنوان من
    // جديد بنصّه نفسه بين صفحتين بعنوانٍ واحد («Create a Message» وصنوها التجريبي)، فكانت الحاضرة لا يُحكم لها فتبقى إنجليزية — مقيسٌ في المراجعة
    if (s.he && !s.he.isConnected) return true;
    for (i = 0; i < s.kids.length; i++) if (!s.kids[i].isConnected) gone++;
    return gone * 2 > s.kids.length || guardH1(rs) !== s.h;
  }
  // ★ (ر6-ج) بعد التنقّل يُحكم حين تصير الشجرة شجرةَ الصفحة الحاضرة (gdKey)، بعد هدوءٍ يُعدّ من لحظة تبدّلها (gdAt) لا من آخر إضافةٍ صغيرة
  // يُلحقها الموقع (كانت كلُّ إضافةٍ تعيد العدّ فيبقى المتن إنجليزيًّا 0.26–0.55 ث بعد التبدّل — R10). وفورًا إن مضى الهدوء قبل الانتظار
  // (تبدّلت والإضافة مطفأةٌ ثم شُغّلت فكان ينتظر تبدّلًا مضى حتى السقف — R8)، أو بعد السقف. وما دامت الشجرة شجرةَ الصفحة السابقة فلا حكمَ
  // ولو بلغ السقف: كان يُعدّ متنها بقطعة الجديدة فتُحجب خطأً (R4)؛ فيبقى المتن على حاله بلا كتابةٍ حتى تتبدّل
  function guardArm() {
    if (!guardWait || bodyJudged) return;
    guardTrack();
    if (gdFrom || gdKey !== bodyPage) return;
    var left = guardCapped ? 0 : gdAt + GUARD_QUIET_MS - Date.now();
    if (left > 0) { if (!guardQT) guardQT = setTimeout(function () { guardQT = null; guardGo(); }, left); return; }
    if (guardQT) { clearTimeout(guardQT); guardQT = null; }
    guardGo();
  }
  function guardGo() {
    if (!guardWait || bodyJudged) return;
    guardWait = false;
    judgeBody();
    if (bodyJudged && state.enabled && active && textGate !== "wait") bodyPassAll();
  }
  function judgeBody() {
    if (GUARD === null || bodyJudged || bodyPending || !BODIES_ON) return;
    if (!state.enabled || !active || textGate === "wait" || state.route !== "full") return;
    if (guardWait) return;
    // ★ (ر6-ج) ولا حكم إلا على شجرة الصفحة الحاضرة
    guardTrack();
    // ★ (ر6-ج، المراجعة) وإن لم تصر شجرتَها بعدُ ولا انتظار — أول طلبٍ للقطعة في المستند (الإضافة مطفأةٌ عند التحميل فلا bodyPage، ثم
    // شُغّلت بين تبدّل العنوان وتبدّل الشجرة في الرجوع والتقدّم) — فالانتظار من الآن، فيُحكم حين تصير شجرتَها (guardArm من المراقب):
    // كان يُرفض الحكم ثم لا يُعاد بعد التبدّل، فتبقى الصفحة بلا حكمٍ ولا كتابةٍ في متنها ما بقيت
    if (gdFrom || gdKey !== bodyPage) { guardWait = true; guardCapped = false; guardPoll(); return; }
    guardClear();
    bodyJudged = true;
    // ★ (ر6-د — القرار 84) وصفحةٌ بلا قطعة (حُجب متنها في البناء، أو لم يُترجم، أو تعذّر جلبها) تُعدّ كتلُها بقطعةٍ فارغة (bodyMap وbodyKeep
    // null: blockCovered يقرأ تصحيح القارئ وقاموس الواجهة والمحايد وحدها)، فتُحجب إن زاد غير المغطّى على العتبة. كانت لا تُعدّ فلا تُحجب،
    // فيكتب قاموس الواجهة عناوين وخلايا عربية داخل متنٍ إنجليزي
    bodyWhy = bodyMap || bodyKeep ? "drift" : "none";
    var c = bodyCoverage();
    bodyStat = c;
    bodyHeld = c.n > 0 && c.unc / c.n > GUARD;
    bodyAttr();
  }
  // كتل المتن الحيّة كلها بمشي الحاصد نفسه (SHARED.harvestBlocks: المحدِّد والمستثنى والذرّات)، بأصل ما كتبناه (rawOfNode) — مخفيُّها
  // وظاهرُها: {n: عددها، unc: غير المغطّى منها}
  function bodyCoverage() {
    var n = 0, unc = 0, roots;
    try { roots = document.querySelectorAll(BODY_SEL); } catch (e) { return { n: 0, unc: 0 }; }
    var skip = SHARED.harvestSkip(META, state.route), SK = SHARED.DOM_RULES.SKIP, memo = new WeakMap(), seen = new Set();
    var filter = { acceptNode: function (x) {
      if (x.nodeType === 1) {
        if (SK[x.nodeName] || x.isContentEditable) return NodeFilter.FILTER_REJECT;
        try { if (skip && x.matches && x.matches(skip)) return NodeFilter.FILTER_REJECT; } catch (e) {}
        return NodeFilter.FILTER_SKIP;
      }
      var p = x.parentNode;
      if (!p || SK[p.nodeName] || p.isContentEditable) return NodeFilter.FILTER_REJECT;
      return /\S/.test(rawOfNode(x) || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    } };
    for (var r = 0; r < roots.length; r++) {
      if (rootCached(roots[r])) continue;   // ★ (ر6-د) متن صفحةٍ سابقة خبّأها الموقع في المستند: ليس من هذه الصفحة
      var tw = document.createTreeWalker(roots[r], NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filter), t;
      while ((t = tw.nextNode())) {
        if (inSkipped(t.parentNode)) continue;
        if (skip) { try { if (t.parentNode.closest(skip)) continue; } catch (e) {} }
        var o = SHARED.blockOwner(t, rawOfNode, memo);
        if (!o) continue;
        var b = SHARED.blockBounds(o.top, rawOfNode, memo);
        if (seen.has(b.first)) continue;
        seen.add(b.first);
        var ex = SHARED.extractBlock(b.first, b.last, rawOfNode, SHARED.BLOCK.MAX, memo);
        if (!ex) continue;
        n++;
        if (!blockCovered(ex)) unc++;
      }
    }
    return { n: n, unc: unc };
  }
  function uiCovered(t) {
    var k = SHARED.textKey(rawOfNode(t), KEY_MAX);
    return !!k && (lookup(k) !== null || !/[A-Za-z]{2}/.test(k));
  }
  // كتلةٌ تغطّيها قطعة الصفحة أو قاموس الواجهة أو هي محايدة (بمنطق blockPass نفسه، وبالقطعة لا بحكمها)
  function blockCovered(ex) {
    var v = ownGet(blockOv && blockOv[state.lang], ex.fp);
    if (typeof v === "string" && v) return true;
    v = ownGet(bodyMap, ex.fp);
    if (typeof v === "string" && v) return true;
    if (bodyKeep && bodyKeep[ex.fp] === 1) return true;
    if (ex.single && uiCovered(ex.single)) return true;
    if (sameLabel(ex)) return true;
    if (ex.group) {
      var ok = true;
      for (var i = 0; i < ex.group.length && ok; i++) ok = ex.group[i] === null || (ex.group[i] !== false && uiCovered(ex.group[i]));
      if (ok) return true;
    }
    return !/[A-Za-z]{2}/.test(ex.texts.join(" "));
  }
  // جولةٌ جديدة: أختام الكتل وذاكرة أنواع العناصر تُبدأ من جديد (البناء قد تغيّر بين جولتين)
  function newPass() { blkPass++; kindMemo = new WeakMap(); }
  var blockOv = {};
  function inBody(p) { try { return !!(p && p.closest && p.closest(BODY_SEL)); } catch (e) { return false; } }
  // الأصل الإنجليزي لعقدةٍ كتبناها وهي كما تركناها؛ وإلا فقيمتها (الموقع كتب بعدنا فقيمته هي الأصل)
  function rawOfNode(t) {
    var r = appliedText.get(t);
    return r && t.nodeValue === r.lastWritten ? r.raw : t.nodeValue;
  }
  // ★ (ر7-ب، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ ر7، M2) صدى عنوان المتن خارج المتن (meta.echoSel): لافتةٌ يكتب فيها الموقع نصَّ عنوانٍ
  // من المتن — «القسم الحالي» في الشريط اللاصق بوثائق المطوّرين دون عرض xl («الأسعار / Model pricing») — كانت تبقى إنجليزيةً والعنوانُ
  // الذي تحكيه عربيٌّ تحتها: هي خارج جذور المتن فلا تبلغها قطعة الصفحة، وبصمتُها غير بصمة العنوان (فيه ذرّة زرّ الرابط) فلا تُطلب بها.
  // فتأخذ نصَّ عنوانها كما عُرض: عنوانٌ (h1–h6) في جذور المتن الحاضرة (guardRoots: لا المخبوءة من صفحاتٍ سابقة) أصلُه الإنجليزي بلا
  // رسومه نصُّ اللافتة نفسه وقد كُتب بلغة الهدف — من القطعة أو قاموس الواجهة أو تصحيح القارئ، كيفما كُتب. وتتبع حارسَ المتن كعنوانها
  // (bodyGate): قبل الحكم لا كتابة ولا إرجاع، وفي الصفحة المحجوبة أصلُها؛ ولا يكتب فيها قاموس الواجهة أبدًا، فلا لافتةٌ عربية فوق متنٍ
  // إنجليزي ولا إنجليزيةٌ فوق عنوانٍ عربي. والعنوان يُعرَّب في الغالب بعد اللافتة (عند الحكم وفي المرور على المستند كلّه وفي دفعات
  // الطفرات)، فيُعاد النظر فيها بعد كل مرورٍ ودفعة (echoAll)
  var ECHO_SEL = BODIES_ON && typeof META.echoSel === "string" && META.echoSel ? META.echoSel : null;
  // كتبنا نصًّا أو أرجعناه منذ آخر نظرٍ في اللافتات (scheduleRelayoutNudge وrestoreText): دفعةُ الطفرات تنظر فيها حينئذٍ وحده — مسحُ
  // العناوين 1–2 مث في أثقل الصفحات (قِيس: سجلّ الإصدارات 153 عنوانًا، ومرجع messages/create)، والتمرير يبدّل اللافتة في كل قسم
  var echoDirty = false;
  function isEcho(p) {
    if (!ECHO_SEL || !p || p.nodeType !== 1 || !p.matches) return false;
    try { return p.matches(ECHO_SEL); } catch (e) { return false; }
  }
  // (محارف الأيقونات من المنطقة الخاصة والمسافة الصفرية لا تُعدّ: أيقونة زرّ «نسخ الرابط» في العنوان محرفٌ من خطّ أيقونات)
  var ECHO_JUNK = /[\uE000-\uF8FF\u200B\uFEFF]/g;
  function wsTrim(s) { return String(s || "").replace(ECHO_JUNK, "").replace(/\s+/g, " ").trim(); }
  // نصُّ عنصرٍ بلا رسومه (svg) ولا ما خُبّئ عن قارئ الشاشة (aria-hidden: الأيقونات): بأصل كل عقدة (raw) أو بقيمتها الحاضرة
  // ★ (ر7-ب، المراجعة المستقلة) والشيفرة السطرية (code وkbd) من نصّ العنوان كما يكتبه الموقع في اللافتة: «Migrate from files-api-2025-04-14»
  // في صفحة Files — كان SKIP يُسقطها فلا يطابق أصلُ العنوان نصَّ اللافتة أبدًا، فبقيت إنجليزيةً والعنوانُ عربيٌّ تحتها (قِيس على 390)
  var ECHO_SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TEMPLATE: 1 };
  function plainText(el, raw) {
    var s = "", t, tw = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: function (x) {
      if (x.nodeType === 1) {
        return x.namespaceURI === SVG_NS || ECHO_SKIP[x.nodeName] || x.getAttribute("aria-hidden") === "true" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    } });
    while ((t = tw.nextNode())) s += raw ? rawOfNode(t) : t.nodeValue;
    return s;
  }
  // النصُّ المعروض لعنوانٍ في المتن الحاضر أصلُه key وقد كُتب بلغةٍ من اليمين؛ وإلا null (لا عنوان بهذا النص، أو بقي على أصله)
  function echoOf(key) {
    if (!key || !HAS_LTR_CH.test(key)) return null;
    var rs = guardRoots();
    for (var i = 0; i < rs.length; i++) {
      var hs = rs[i].querySelectorAll("h1, h2, h3, h4, h5, h6");
      for (var j = 0; j < hs.length; j++) {
        if (wsTrim(plainText(hs[j], true)) !== key) continue;
        var now = wsTrim(plainText(hs[j], false));
        if (now !== key && HAS_RTL_CH.test(now)) return now;
      }
    }
    return null;
  }
  function echoText(node) {
    // ★ (ر7-ب، المراجعة المستقلة) لافتةُ صفحةٍ سابقة خبّأها الموقع في المستند (للشريط نسخةٌ في مُغلِّف كل صفحة، و‎display: none‎ مضمَّنٌ عليه —
    // rootCached): لا كتابة فيها ولا إرجاع، كمتن تلك الصفحة (inCachedBody)، فتعود كما تُركت. كانت تُكتب بحال الصفحة الحاضرة وعناوينها
    // (قِيس على 390: حُكم بحجب workflow-runs فأُرجعت لافتة pricing المخبوءة إلى الإنجليزية ومتنُها المخبوء عربيٌّ كما تُرك)، وقد تُكتب
    // عربيةً من عنوانٍ في الحاضرة يطابقها، فإن أظهرها الموقع بالرجوع إليها ظهرت كذلك حتى يُحكم لصفحتها
    if (GUARD !== null && node.parentNode && rootCached(node.parentNode)) return;
    var g = bodyGate();
    if (g === 1) return;
    var raw = rawOfNode(node), want = raw;
    if (g === 0 && state.route === "full") {
      var ar = echoOf(wsTrim(raw));
      if (ar !== null) want = raw.replace(raw.trim(), function () { return ar; });
    }
    var rec = appliedText.get(node);
    if (want === raw) {
      // على أصلها: واللافتة اللاتينية تُعزل كما تُعزل في المسار العام (isolateLabel، meta.isoLabels) — «Rate limits (beta)» لا تُرسم «(Rate
      // limits (beta» في سطرٍ RTL؛ وعزلٌ قائمٌ كما تُرك يبقى (لا إرجاعَ ثم كتابةٌ في كل دفعة)
      if (rec && rec.iso && node.nodeValue === rec.lastWritten) return;
      if (rec) restoreText(node);
      if (ISO_LABELS) { var k = SHARED.textKey(raw, KEY_MAX); if (k) isolateLabel(node, raw, k); }
      return;
    }
    if (node.nodeValue !== want) { node.nodeValue = want; scheduleRelayoutNudge(); }
    appliedText.set(node, { raw: raw, key: null, lastWritten: want, echo: 1 });
    everTranslated = true;
  }
  function echoAll() {
    echoDirty = false;
    if (!ECHO_SEL || !active || !state.enabled || textGate === "wait") return;
    var els;
    try { els = document.querySelectorAll(ECHO_SEL); } catch (e) { return; }
    for (var i = 0; i < els.length; i++) {
      for (var c = els[i].firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && /\S/.test(c.nodeValue)) echoText(c);
    }
  }
  // ★ (S6-C، جدول «الصفحات المتاحة» في صفحة Claude Platform on AWS) لكتلة هذه الصفحة مدخلٌ صريح؟ تصحيح المستخدم ("ov")،
  // أو ترجمةٌ في القطعة ("tr")، أو علامة إبقاء ("keep")؛ وإلا null. والمدخل الصريح يسبق قاموس الواجهة في الكتلة ذات العقدة
  // الوحيدة: عشرة أسماءٍ لصفحات Console في الجدول («Rate limits»، «Files»…) تطابق عناوين صفحاتٍ في القاموس فكانت تُعرَّب
  // وحدها بينما قرّر المترجم إبقاء صفوف الجدول كلها كما هي — فيخرج جدولٌ نصفُه عربيٌّ ونصفُه إنجليزي
  // ★ (ر6-ب) وقطعة الصفحة (ترجمةً وعلامة إبقاء) حين يأذن حارس المتن وحده (shardOn)؛ وتصحيح القارئ كما كان (كصفحةٍ بلا قطعة)
  function blockExplicit(fp) {
    var v = ownGet(blockOv && blockOv[state.lang], fp);
    if (typeof v === "string" && v) return "ov";
    if (!shardOn()) return null;
    v = ownGet(bodyMap, fp);
    if (typeof v === "string" && v) return "tr";
    return bodyKeep && bodyKeep[fp] === 1 ? "keep" : null;
  }
  function blockLookup(fp) {
    var ov = blockOv && blockOv[state.lang], v = ownGet(ov, fp);
    if (typeof v === "string" && v) return v;
    v = shardOn() ? ownGet(bodyMap, fp) : undefined;
    return typeof v === "string" && v ? v : null;
  }
  // إرجاع ما كتبه وضع الكتلة وحده (سجلّات العقدة الواحدة يديرها مسارها بثباتٍ لا تقاذف فيه)
  // ★ (ر8-ج، ٣٠ ربيع الآخر ١٤٤٨هـ — مراجعة ر7-ب F4) والإرجاع كتابةٌ: عنوانٌ يعود إلى أصله هنا وحده (لا كتابةَ غيرُه في الدفعة) كان يترك لافتة
  // صداه (meta.echoSel) عربيةً حتى كتابةٍ تالية — فيُعلَّم echoDirty كما تعلّمه scheduleRelayoutNudge وrestoreText
  function dropBlk(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], r = appliedText.get(n);
      if (r && r.blk) { if (n.nodeValue === r.lastWritten) { n.nodeValue = r.raw; echoDirty = true; } appliedText.delete(n); }
    }
  }
  function runTexts(first, last) {
    var out = [];
    (function add(x, top) {
      for (; x; x = x.nextSibling) {
        if (x.nodeType === 3) out.push(x); else if (x.nodeType === 1 && x.firstChild) add(x.firstChild, false);
        if (top && x === last) return;
      }
    })(first, true);
    return out;
  }
  function slotNodes(ex) {
    var out = [];
    for (var i = 0; i < ex.slots.length; i++) out = out.concat(ex.slots[i].nodes);
    return out;
  }
  // عقدةٌ هي نصُّ وحدتها كلّه (كتلةٌ من عقدةٍ واحدة، أو بندٌ في صفّ لافتات): بقاموس الواجهة كمسار العقدة
  // الواحدة (التصحيحات والجموع والأنماط، والعزل الاتجاهي)؛ وما لم يُترجم يعود إلى أصله. يُرجع: تُرجمت؟
  function writeSingle(t, cb) {
    var sraw = rawOfNode(t), sk = SHARED.textKey(sraw, KEY_MAX), sv = sk ? lookup(sk) : null;
    if (sv === null) {
      var r = appliedText.get(t);
      // (عزلُ اللافتة اللاتينية iso لا يُرجع هنا: ليس ترجمةً، ومساره في translateText يحكمه)
      if (r && !r.blk && !r.iso) { if (t.nodeValue === r.lastWritten) { t.nodeValue = r.raw; cb(); } appliedText.delete(t); }
      return false;
    }
    var want = sv === sk ? sraw : sraw.replace(sk, function () { return bidiWrap(sv); });
    if (t.nodeValue !== want) { t.nodeValue = want; cb(); }
    if (want !== sraw) appliedText.set(t, { raw: sraw, key: sk, lastWritten: want });
    else appliedText.delete(t);
    return true;
  }
  // كتلةٌ كلُّ عقد نصّها النصُّ نفسه (عقدتان فأكثر، ولا شيفرةَ ذات حروف) وهو في قاموس الواجهة ⇒ عقدها؛ وإلا null
  function sameLabel(ex) {
    for (var t = 0; t < ex.toks.length; t++) if (ex.toks[t].k === "c" && /[A-Za-z0-9]/.test(ex.toks[t].body || "")) return null;
    var nodes = slotNodes(ex).filter(function (n) { return /\S/.test(rawOfNode(n) || ""); });
    if (nodes.length < 2) return null;
    var k = SHARED.textKey(rawOfNode(nodes[0]), KEY_MAX);
    if (!k) return null;
    for (var i = 1; i < nodes.length; i++) if (SHARED.textKey(rawOfNode(nodes[i]), KEY_MAX) !== k) return null;
    return lookup(k) !== null ? nodes : null;
  }
  // true: عُولجت العقدة بوضع الكتلة (أو هي داخل شيفرة) فلا يمسّها مسار العقدة الواحدة
  function blockPass(node) {
    var o = SHARED.blockOwner(node, rawOfNode, kindMemo);
    if (!o) return true;
    // الختم على كل عضوٍ في التتابع: عقد الفقرة الأخرى في الجولة نفسها لا تعيد حساب حدودها (كان تربيعيًّا)
    var st = blkStamp.get(o.top);
    if (st && st.pass === blkPass) return st.done;
    var b = SHARED.blockBounds(o.top, rawOfNode, kindMemo);
    var ex = SHARED.extractBlock(b.first, b.last, rawOfNode, SHARED.BLOCK.MAX, kindMemo), done = false, changed = false, fullBlk = false;
    var mark = function () { changed = true; }, kept = false;
    var explicit = ex ? blockExplicit(ex.fp) : null;
    if (ex && ex.single && !explicit) {
      var sraw = rawOfNode(ex.single), sk = SHARED.textKey(sraw, KEY_MAX);
      if (sk && lookup(sk) !== null) { dropBlk(slotNodes(ex)); done = writeSingle(ex.single, mark); }
    }
    if (ex && ex.single && explicit === "keep") {
      // ★ يبقى كما في المصدر بقرار المترجم: لا قاموسَ واجهة ولا مسارَ العقدة الوحيدة بعده (وما كتباه قبلُ يُرجع)
      var kn = slotNodes(ex);
      dropBlk(kn);
      for (var ki = 0; ki < kn.length; ki++) { var kr = appliedText.get(kn[ki]); if (kr && !kr.iso) restoreText(kn[ki]); }
      kept = true;
    } else if (ex && !done) {
      var ar = blockLookup(ex.fp);
      // ★ (ر5) قالبٌ إلى لغةٍ من اليمين: القوسان ذوا المحتوى اللاتيني تُلاصقهما علامة LRM في خانات نصّه قبل التوزيع (SHARED.ltrParens يفهم
      // الرموز والشيفرة، ولا يضيف نصًّا في خانةٍ فارغة) — كمسار العقدة الواحدة في bidiWrap؛ والقالب المحفوظ (ar) كما هو
      var markTpl = function (t) { return active && active.dir === "rtl" && HAS_RTL_CH.test(t) ? SHARED.ltrParens(t, true) : t; };
      var w = ar !== null ? SHARED.blockWrites(ex, markTpl(ar)) : null;
      if (!w && ar !== null) {
        // تصحيح المستخدم لا يطابق فقرته في الصفحة: تُجرَّب ترجمة الإضافة لها قبل أن تبقى إنجليزية
        var pv = shardOn() ? ownGet(bodyMap, ex.fp) : undefined;
        if (typeof pv === "string" && pv && pv !== ar) { badBlocks++; ar = pv; w = SHARED.blockWrites(ex, markTpl(pv)); }
      }
      if (w) {
        // ★ (S6-C) كتلةٌ داخل رسم SVG: نصُّ الرسم لا يأخذ اتجاه الصفحة (ولا يُضبط له اتجاه — يُزيح مرساة التسمية)، فالعبارة
        // المختلطة («طلب API»، «يقيّم Claude الأمر») كانت تُرتَّب من اليسار فتُقرأ مقلوبة. تُلفّ كلُّها بالعزل كما يلفّ bidiWrap
        // مسارَ العقدة الوحيدة: RLI في أول عقدةٍ ذات نصٍّ وPDI في آخرها، والسجلّ يحفظ الملفوف فتصدق المقارنات
        // ★ (S6-C، المراجعة العدائية) مقطعٌ لاتيني في طرفه محايدٌ داخل الترجمة («وC#» تُرسم «#C»، و«.docx» «docx.»، و«/status»
        // «status/»): علامةُ LRM ملاصقة كما يفعل المترجمون في البيانات (SHARED.ltrMarks) — في نصّ الترجمة وحده لا الذرّات،
        // ومتكافئةُ التكرار، والسجلّ يحفظ المكتوب فلا تقاذف ولا يتغيّر الأصل ولا البصمة
        if (active && active.dir === "rtl" && HAS_RTL_CH.test(ar)) {
          for (var li = 0; li < w.length; li++) if (w[li][1]) w[li][1] = SHARED.ltrMarks(w[li][1]);
        }
        if (o.owner.namespaceURI === SVG_NS) svgIsolate(w);
        for (var i = 0; i < w.length; i++) {
          var n = w[i][0], v = w[i][1], raw = rawOfNode(n);
          if (n.nodeValue !== v) { n.nodeValue = v; changed = true; }
          appliedText.set(n, { raw: raw, key: null, lastWritten: v, blk: 1 });
        }
        done = fullBlk = true;
        markBodyTr(true); // (ر3) في الصفحة كتلةٌ معرَّبة كلُّها: تنبيه الوثائق القانونية يظهر
      } else if (ar !== null) badBlocks++;
    }
    // ★ (S6-C) علامات الترقيم المنفردة في ذرّاتها: عربيةٌ مع الكتلة المكتوبة كلّها، وأصلُها متى لم تُكتب
    var pa = ex ? SHARED.punctAtoms(ex, rawOfNode) : [];
    if (pa.length) {
      if (fullBlk && HAS_RTL_CH.test(ar || "")) {
        for (var pi = 0; pi < pa.length; pi++) {
          var pn = pa[pi][0], praw = rawOfNode(pn), pw = praw.replace(praw.trim(), pa[pi][1]);
          if (pn.nodeValue !== pw) { pn.nodeValue = pw; changed = true; }
          appliedText.set(pn, { raw: praw, key: null, lastWritten: pw, blk: 1 });
        }
      } else dropBlk(pa.map(function (x) { return x[0]; }));
    }
    var handled = done || kept;
    var same = ex && !handled ? sameLabel(ex) : null;
    if (same) {
      // ★ نُسخٌ متطابقة للافتةٍ واحدة (وثائق Claude Code: Mintlify يرسم نصّ زرّ «Copy page» مرّتين — نسخةٌ خفيّة تحفظ
      // عرضه وأخرى ظاهرة): لافتةٌ لا جملة، فتُعرَّب نسخُها كلّها بقاموس الواجهة معًا (وإلا بقيت إنجليزيةً كلّها)
      dropBlk(slotNodes(ex));
      for (var si = 0; si < same.length; si++) if (writeSingle(same[si], mark)) done = true;
      handled = true;
    }
    if (ex && !handled && ex.group) {
      // صفُّ لافتاتٍ لم يُترجم كلّه: كل بندٍ وحدةٌ مستقلة لا جزءُ جملة — يُعرَّب وحده بقاموس الواجهة
      dropBlk(slotNodes(ex));
      for (var gi = 0; gi < ex.group.length; gi++) if (ex.group[gi] && writeSingle(ex.group[gi], mark)) done = true;
      handled = true;
    }
    if (!handled) {
      var bn = ex ? slotNodes(ex) : runTexts(b.first, b.last);
      dropBlk(bn);
      if (ex && !ex.single) {
        // ★ جملةٌ لم تُترجم كلّها تبقى إنجليزيةً كلّها أيًّا كان مالكها (div/section لا p/li وحدها): لا يُعرَّب
        // جزءٌ منها بقاموس الواجهة فتخرج جملةٌ مختلطة؛ وما كتبه مسار العقدة الواحدة قبلُ يُرجع
        for (var ri = 0; ri < bn.length; ri++) restoreText(bn[ri]);
        handled = true;
      }
    }
    // اتجاه اللغة لمالكٍ كتبه وضع الكتلة كلَّه (blkOwnersTr)؛ وتبدّلُ الحكم يُعاد له الاتجاه فورًا إن كان محكومًا قبلُ.
    // ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر6، السبب D2) والحكم من تتابعٍ هو كتلة (ex) وحده: تتابعٌ بلا حرفٍ لاتيني خارج الشيفرة (البياض
    // بعد قائمةٍ متداخلة </ul>، أو أيقونة) لا يقول شيئًا عن مالكه. كان يمحو عضوية البند المعرَّب فيتقاذف (T f T f مقيسًا)، فيُحكم على البند كلّه
    // بنصّه مع قائمته المتداخلة الإنجليزية فيصير LTR وهو عربي («النوع: قيمة منطقية (Boolean)»: 15 بندًا في صفحات Claude Code)
    if (ex) {
      var wasTr = blkOwnersTr.has(o.owner), nowTr = fullBlk && soleRun(o.owner, b);
      if (nowTr) blkOwnersTr.add(o.owner); else if (wasTr) blkOwnersTr.delete(o.owner);
      if (wasTr !== nowTr && o.owner.hasAttribute && o.owner.hasAttribute("data-cml-dir")) setChatDir(o.owner);
    }
    if (done) everTranslated = true;
    if (changed) scheduleRelayoutNudge();
    var rec = { pass: blkPass, done: handled };
    for (var sx = b.first; sx; sx = sx.nextSibling) { blkStamp.set(sx, rec); if (sx === b.last) break; }
    return handled;
  }
  // قطعة متون الصفحة من العامل (ملفٌّ في حزمة الإضافة نفسها، لا اتصال بأحد): عند الإقلاع وعند كل
  // تنقّلٍ داخل الموقع، وفي المسار الكامل وحده (لا في shell ولا الخامل)
  function loadBodies() {
    if (!BODIES_ON || !state.enabled || state.route !== "full") return;
    var pk = SHARED.pageKey(META, location.pathname);
    if (pk === bodyPage && state.lang === bodyLang) return;
    markBodyTr(false); // (ر3) صفحةٌ أو لغةٌ جديدة: تكسب تنبيهها بكتلتها هي
    // ★ (ر6-ب) وحكمَ حارس المتن كذلك؛ والتنقّل من صفحةٍ سابقة يُنتظر فيه تبدّلُ الشجرة وهدوؤها
    if (GUARD !== null) guardReset(bodyPage !== null && pk !== bodyPage);
    if (state.lang !== bodyLang) { bodyMap = null; bodyKeep = null; }   // تغيّرت اللغة: لا تُكتب فقرات لغةٍ أخرى أثناء انتظار القطعة
    bodyPage = pk; bodyLang = state.lang;
    var gen = ++bodyGen;
    bodyPending = true;
    var done = function (res) {
      if (gen !== bodyGen) return;
      bodyPending = false;
      bodyMap = res && res.blocks && typeof res.blocks === "object" ? res.blocks : null;
      bodyKeep = null;
      if (res && Array.isArray(res.keep)) {
        bodyKeep = Object.create(null);
        for (var ki = 0; ki < res.keep.length; ki++) if (typeof res.keep[ki] === "string") bodyKeep[res.keep[ki]] = 1;
      }
      // (ر3) أثناء انتظار القطعة تبقى قطعة الصفحة السابقة (اللغة نفسها) فقد تُكتب منها كتلةٌ مشتركة: السمة تُكسب من جديد بهذه
      // القطعة وحدها — المرور التالي يكتب ما فيها ويُرجع ما ليس فيها، فلا يبقى التنبيه فوق صفحةٍ لا ترجمة لها
      markBodyTr(false);
      if (state.enabled && active && textGate !== "wait") bodyPassAll();
      if (holdForBodies) { holdForBodies = false; endHold(); }
    };
    // ★ (S7-B، المراجعة العدائية) ردٌّ ضائع (runtime.lastError: العامل لم يُجب — قِيس في صفحة مرجعٍ ثقيلة: الطلب عند 2.7 ث
    // وخطؤه عند 19.6 ث) كان يُبقي المتن إنجليزيًّا ما بقيت الصفحة، فلا طلبَ آخر إلا بتنقّل. يُعاد الطلب مرّتين بمهلةٍ متزايدة ما دام
    // الجيل نفسه؛ والردّ null بلا خطأٍ جوابٌ صحيح («لا قطعة لهذه الصفحة») لا يُعاد
    var path = location.pathname, lang = state.lang, tries = 0;
    var ask = function () {
      try {
        chrome.runtime.sendMessage({ type: "bodies", path: path, lang: lang }, function (res) {
          var lost = !!chrome.runtime.lastError;
          if (lost && gen === bodyGen && tries < 2) {
            tries++;
            setTimeout(function () { if (gen === bodyGen) ask(); }, tries === 1 ? 600 : 2500);
            return;
          }
          done(lost ? null : res);
        });
      } catch (e) { done(null); }
    };
    ask();
    // ★ (ر6-ج) والشجرة قد تكون شجرةَ الصفحة الجديدة الآن (تبدّلت مع العنوان في المهمة نفسها، أو والإضافة مطفأة): لا تنتظر تبدّلًا مضى.
    // (بعد طلب القطعة: لا يُحكم بقطعة الصفحة السابقة)
    if (GUARD !== null) guardArm();
  }
  // ★ تصحيح فقرة (النافذة تسأل عن الفقرة التي حدّد المستخدم نصًّا منها): قالبُها الإنجليزي وبصمتها
  // وما يظهر لها الآن — يُعاد إلى صفحة الإضافة نفسها لا إلى أحد. عقدةٌ وحيدة يترجمها قاموس الواجهة
  // تُصحَّح هناك (الواجهة تسبق)، فيُعاد نصُّها لنموذج التصحيح العادي.
  function blockAtSelection() {
    if (!BODIES_ON || !state.enabled || !active) return { error: "off" };
    // ★ (ر6-ب) المتن محجوب: لا يُعرض فيه تصحيح (النافذة تقول السبب). ★ (ر6-د) والسبب معه: "drift" أو "none"
    if (heldNow()) return { error: "held", why: bodyWhy };
    var n = selTextNode(window.getSelection && window.getSelection());
    if (!n || !inBody(n.parentNode) || inShell(n.parentNode) || inSkipSel(n.parentNode)) return { error: "nosel" };
    if (n.parentNode.isContentEditable) return { error: "noblock" };
    // ما لا يُترجم أصلًا (pre وscript ونحوهما) لا يُعرض للتصحيح — التصحيح لن يُطبَّق عليه
    if (inSkipped(n.parentNode) && !atomOf(n)) return { error: "code" };
    // تحديدٌ يبدأ بشيفرةٍ سطرية داخل فقرة (نقرٌ ثلاثي): الفقرة التي تحويها لا «هذه شيفرة»
    var atom = atomOf(n), memo = new WeakMap();
    var o = SHARED.blockOwner(atom || n, rawOfNode, memo);
    if (!o) return { error: "code" };
    var b = SHARED.blockBounds(o.top, rawOfNode, memo);
    var ex = SHARED.extractBlock(b.first, b.last, rawOfNode, SHARED.BLOCK.MAX, memo);
    if (!ex) return { error: atom ? "code" : "noblock" };
    // (S6-C) والمدخل الصريح للكتلة في صفحتها (تصحيحٌ أو ترجمةٌ أو إبقاء) يسبق قاموس الواجهة هنا كما في الكتابة
    if (ex.single && !blockExplicit(ex.fp)) {
      var sk = SHARED.textKey(rawOfNode(ex.single), KEY_MAX), sv = sk ? lookup(sk) : null;
      if (sv !== null) return { ui: true, en: sk, ar: sv };
    }
    var cur = blockLookup(ex.fp);
    // صفُّ لافتاتٍ بلا ترجمةٍ للصفّ كلّه: اللافتة المحدَّدة تُصحَّح في قاموس الواجهة كما تُعرَّب
    if (ex.group && cur === null) {
      var gi = ex.group.indexOf(n);
      if (gi >= 0) {
        var gk = SHARED.textKey(rawOfNode(n), KEY_MAX), gv = gk ? lookup(gk) : null;
        if (gv !== null) return { ui: true, en: gk, ar: gv };
      }
    }
    var ov = ownGet(blockOv && blockOv[state.lang], ex.fp), pv = ownGet(bodyMap, ex.fp);
    return { fp: ex.fp, src: ex.tpl, ar: cur, mine: typeof ov === "string" && !!ov,
             shipped: typeof pv === "string" && pv ? pv : null };
  }
  // عقدة النص المحدَّدة فعلًا (أول نصٍّ غير فارغ داخل المدى)، لا مرساة التحديد وحدها
  function selTextNode(sel) {
    if (!sel || !sel.rangeCount) return null;
    var r = sel.getRangeAt(0), root = r.commonAncestorContainer, t, a, z, tw;
    if (!r.collapsed) {
      if (root.nodeType === 3) { if (/\S/.test(root.nodeValue.slice(r.startOffset, r.endOffset))) return root; }
      else {
        tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        while ((t = tw.nextNode())) {
          if (!r.intersectsNode(t)) continue;
          a = t === r.startContainer ? r.startOffset : 0;
          z = t === r.endContainer ? r.endOffset : t.nodeValue.length;
          if (/\S/.test(t.nodeValue.slice(a, z))) return t;
        }
      }
    }
    var n = r.startContainer;
    if (n.nodeType === 3) return /\S/.test(n.nodeValue) ? n : null;
    var c = n.childNodes[r.startOffset] || n;
    tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, null);
    while ((t = tw.nextNode())) if (/\S/.test(t.nodeValue)) return t;
    return null;
  }
  // أبعد ذرّةٍ (شيفرة أو ما لا حرف فيه) تحوي العقدة قبل مالك كتلتها — أو null
  function atomOf(n) {
    var atom = null, k;
    for (var p = n.parentNode; p && p.nodeType === 1 && (k = SHARED.inlineKind(p, rawOfNode)); p = p.parentNode) {
      if (k === "c" || k === "g") atom = p;
    }
    return atom;
  }
  function bodyPassAll() {
    cacheEpoch++; // ★ (ر6-د) جذور المتن المخبوءة تُحسب من جديد قبل المرور
    judgeBody(); // ★ (ر6-ب) الحكم قبل أول كتابةٍ من القطعة (لا شيء إن لم يحن)
    var roots;
    try { roots = document.querySelectorAll(BODY_SEL); } catch (e) { return; }
    for (var i = 0; i < roots.length; i++) { walk(roots[i]); applyChatDir(roots[i]); }
    echoAll(); // ★ (ر7-ب) والعناوين قد تغيّرت بالحكم (عُرّبت أو أُرجعت): لافتاتُ صداها تتبعها
  }
  // ---------- الحل الجذري لاختلاط الاتجاهين (لقطة «العمل المشترك (Cowork)») ----------
  // ١) عزل اتجاهي: ترجمةٌ تخلط حروفًا عربية ولاتينية داخل حاويةٍ أيًّا كان اتجاهُها
  //    كانت تتبعثر بصريًّا بجوار الأرقام والأقواس. FSI/PDI (U+2068/U+2069) هما حلُّ
  //    المنصة القياسي: القطعة تُرتَّب داخليًّا بأول حرفٍ قويٍّ فيها وتُعامَل خارجيًّا
  //    وحدةً واحدة — لا رقعة CSS لكل موضع. النقية (عربية فقط) تُترك بلا لفّ.
  //    lastWritten يخزّن الملفوف فتبقى مقارنات «كما تركناها» صادقة، والاستعادة بالأصل.
  // ★ (فحص الاتجاه الشامل ١٤٤٨هـ، ج-١) FSI يرتّب القطعة بأول حرفٍ قويٍّ فيها، فكانت كل ترجمةٍ تبدأ
  //    بكلمةٍ لاتينية («Claude على AWS»، «API الرسائل») تُرتَّب من اليسار داخل كتلةٍ RTL. والترجمة مكتوبةٌ
  //    بلغة الهدف، فاتجاهها الأساسي اتجاهُ لغتها لا أولُ حرفٍ فيها: RLI للغات من اليمين، وFSI لغيرها.
  var FSI = "\u2068", RLI = "\u2067", PDI = "\u2069";
  var HAS_RTL_CH = new RegExp("[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]");
  var HAS_LTR_CH = /[A-Za-z]/;
  // ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ — ملاحظة المالك ٢(ج)) وفي لغةٍ من اليمين: قوسان محتواهما لاتينيٌّ تعطيهما قاعدة الأقواس اتجاه الفقرة تُلاصقهما
  // علامة LRM من الخارج (SHARED.ltrParens): «إدارة الهوية (SSO, JIT, SCIM)» كانت تنكسر أقواسها حين تلتفّ («SSO, JIT,)» ثم «(SCIM»)، وبالعلامة
  // تلتفّ وحدةً واحدة، ورسمها على سطرٍ واحد كما هو. والدالة متكافئة التكرار، فالمكتوب واحدٌ في كل جولة وسجلّ lastWritten يصدق
  function bidiWrap(s) {
    if (!(HAS_RTL_CH.test(s) && HAS_LTR_CH.test(s))) return s;
    return active && active.dir === "rtl" ? RLI + SHARED.ltrParens(s, true) + PDI : FSI + s + PDI;
  }
  // كتابات كتلةٍ في رسم SVG ‏[[عقدة، قيمة]…]: العبارة كلّها (عبر عقدها) معزولةٌ كما يعزل bidiWrap العقدة الواحدة
  // ★ (ر6-هـ، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ لـت4، O3) والتسمية العربية الخالصة كذلك إن كان فيها غيرُ الحروف والحركات والمسافات (ترقيمٌ
  // أو رقمٌ أو رمز): نصُّ الرسم LTR (اتجاه الرسم الأصلي)، فكانت «الجهد، وفئة النموذج، والميزانيات:» تُرسم نقطتاها يمين أول الجملة لا عند آخرها
  // في القراءة، و«($)» في «التكلفة لكل مهمة محلولة ($)» يمينها، و«80%» ينفصل رقمها عن علامتها (قِيس 29 تسميةً في صفحة التكلفة و13 في
  // best-practices). وفي العزل تُرسم كما تُرسم في فقرةٍ عربية من المتن حرفًا (قِيس). والعربية الخالصة حروفًا لا يتغيّر رسمها بالعزل فلا تُمسّ
  var SVG_NS = "http://www.w3.org/2000/svg";
  var SVG_WEAK = /[^\s\p{L}\p{M}]/u;
  function svgIsolate(w) {
    var f = -1, l = -1, all = "";
    for (var i = 0; i < w.length; i++) if (/\S/.test(w[i][1])) { if (f < 0) f = i; l = i; all += w[i][1]; }
    if (f < 0 || !(HAS_RTL_CH.test(all) && (HAS_LTR_CH.test(all) || SVG_WEAK.test(all)))) return;
    w[f][1] = (active && active.dir === "rtl" ? RLI : FSI) + w[f][1];
    w[l][1] = w[l][1] + PDI;
  }
  // ٢) نبضة إعادة قياس: مكوناتُ الموقع تقيس عروضَ نصوصها عند الإقلاع (مؤشرُ شرائح
  //    «محادثة/العمل المشترك» المنزلق) ثم نبدّل النص بالعربية الأطول فيبقى القياسُ
  //    القديم قصًّا وانزياحًا — وهذه أرضُ «المحسوب» التي لا تلمسها CSS بمبدئنا.
  //    أخفُّ علاجٍ جذريٍّ عام: نبضةُ resize واحدة مدمجةٌ بعد كل دفعة تعريب، فتعيد
  //    المكوناتُ قياسَها بمساراتها هي. لا حلقةَ هنا: الدفعة التالية بلا كتابةٍ فلا نبضة.
  var relayoutTimer = null;
  // سقفُ النبضات: مكوّنٌ يعيد كتابة نصّه عند resize كان يدخل حلقة ترجمة→نبضة→كتابة→ترجمة
  // (7 أحداث في 4 ثوانٍ مقيسًا). ثلاثُ نبضاتٍ في ثلاث ثوانٍ تكفي كل استعمالٍ مشروع.
  var nudgeStamps = [];
  function scheduleRelayoutNudge() {
    echoDirty = true; // ★ (ر7-ب) كتابةُ نصٍّ: لافتات صدى العناوين يُنظر فيها في آخر الدفعة
    if (relayoutTimer) return;
    relayoutTimer = setTimeout(function () {
      relayoutTimer = null;
      var now = Date.now();
      nudgeStamps = nudgeStamps.filter(function (s) { return now - s < 3000; });
      if (nudgeStamps.length >= 3) return;
      nudgeStamps.push(now);
      try { window.dispatchEvent(new Event("resize")); } catch (e) {}
    }, 250);
  }

  // ★ (١-١) بوابة الترطيب (meta.hydrate = "defer"، منصات Next.js): تعريبُ نصٍّ قبل أن يُكمل
  // React ترطيبه يُفشل الترطيب (قِيس على مركز الخصوصية: الأخطاء ٤٢٥ و٤١٨ و٤٢٣، ثم يرمي React
  // ما رسمه الخادم ويعيد الرسم كله من العميل — عملٌ مضاعف وأخطاءٌ في مراقبة الموقع نفسه).
  // فالسمات والاتجاه مبكرًا (اختلاف السمات لا يُفشل الترطيب)، والنصوص بعد إشارة الاكتمال:
  // عنصر next-route-announcer يُدرَج بعد إيداع React (قِيس: في اللحظة نفسها) ويراه عالمُنا
  // المعزول، بخلاف علامات React على العقد. وبلا إشارةٍ خلال HYDRATE_MAX_MS فالنصوص تُفتح.
  var textGate = META.hydrate === "defer" ? "wait" : "open", gateTimer = null;
  // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) meta.hydrateSignal = "lang" (الأكاديمية: Vite وReact 19 بتصييرٍ مسبق، ولا next-route-announcer): الكتابة عند
  // DOMContentLoaded، أو عند حذف علامة التصيير المسبق، أو عند أول كتابةٍ من الموقع لـ<html lang> وحدها، أفشلت ترطيبه في كل تحميلٍ مقيس
  // (أجزاء Suspense تترطّب بعدها)؛ وتلك الكتابة ثم load وفترتا خمول اجتازت 4/4 (دراسة ر4 §1.4). فالإشارة من مراقب حارس اللغة
  // (watchSiteLang) والتسوية تسوية "idle"، ولا يُعدّ next-route-announcer إشارةً في هذا الوضع (لا يكون في الموقع، فظهوره مصادفةٌ من غيره)
  var HYD_LANG = META.hydrate === "defer" && META.hydrateSignal === "lang";
  function hydratedNow() { if (HYD_LANG) return false; try { return !!document.querySelector("next-route-announcer"); } catch (e) { return false; } }
  // ★ (S6-C، ٢١ ربيع الآخر ١٤٤٨هـ) إشارةٌ أقوى (meta.hydrateSignal = "idle"، وثائق المطوّرين): العنصر يُدرَج بعد إيداع
  // الجذر، وأجزاء الصفحة المؤجَّلة (حدود Suspense في الترطيب الانتقائي) تترطّب بعده — قِيس على صفحة thinking بالإضافة
  // الحقيقية: الإشارة عند 6349 مث، وأول كتابةٍ عربية عند 6646، وترطيبُ المتن والرأس عند 8376، فوقع خطأ React ‎#418‎ عند 7991
  // ورُمي ما رسمه الخادم من ذلك الجزء. فبعد الإشارة: حدث load ثم فترتا خمولٍ متتاليتان للخيط الرئيس — مُجدوِل React
  // يُبقي الطابور مشغولًا ما بقي عملُ ترطيب، فلا تأتي فترة خمولٍ قبل اكتماله (قِيس: أول خمولٍ بعد load عند 9133،
  // وبلا الإضافة 4306 بعد اكتمال الترطيب عند 4269). وسقف HYDRATE_MAX يحكمها كما يحكم الإشارة، والإمساك بسقفيه كما هو.
  var HYD_IDLE = META.hydrate === "defer" && (META.hydrateSignal === "idle" || HYD_LANG), hydSettling = false;
  var idleCb = window.requestIdleCallback ? window.requestIdleCallback.bind(window) : function (cb) { return setTimeout(cb, 50); };
  function hydrationSignal(why) {
    if (textGate !== "wait") return;
    if (!HYD_IDLE) { openTextGate(why); return; }
    if (hydSettling) return;
    hydSettling = true;
    var settle = function () { idleCb(function () { idleCb(function () { openTextGate(why + "+idle"); }); }); };
    if (document.readyState === "complete") settle();
    else window.addEventListener("load", settle, { once: true });
  }
  function openTextGate(why) {
    if (textGate === "open") return;
    textGate = "open:" + why;
    if (gateTimer) { clearTimeout(gateTimer); gateTimer = null; }
    setTimeout(function () {
      if (state.enabled && active) fullPass();
      if (bodyPending && holding) holdForBodies = true; else endHold(); // المتن جزءٌ من «أول ظهورٍ عربي»
    }, 0);
  }
  // ★ الإمساك (قرار المالك: «الظهور مثل claude.ai»): تبقى الصفحة مخفيّةً حتى تُفتح البوابة ويجري
  // التعريب، فلا يرى الزائر الإنجليزية قبل العربية. سقفان لا يسقطان: HOLD_MAX_MS بعد
  // DOMContentLoaded، وHOLD_ABS_MS من بدء الإمساك — بعدهما تظهر الصفحة وتُعرَّب متى ترطّبت.
  var holding = false, holdTimer = null, holdAbsTimer = null;
  // early: عند بدء المستند قبل قراءة الإعدادات (المواقع ذات الترطيب المؤجَّل) — فلا نافذةَ تظهر فيها
  // الصفحة إنجليزيةً إن أبطأت قراءةُ الإعدادات عن احتياط الإقلاع (400 مث)، وقِيس ذلك في تحميلٍ بارد.
  // والإعدادات إن قالت «موقوف» رفعته applyChrome فورًا، والسقفان يحكمانه كما يحكمان الإمساك العادي
  function startHold(early) {
    if (holding || textGate !== "wait" || (!early && (!state.enabled || !active))) return;
    holding = true;
    try { document.documentElement.setAttribute("data-cml-hold", "1"); } catch (e) {}
    holdAbsTimer = setTimeout(endHold, CONST.HOLD_ABS_MS || 6000);
    var armCap = function () { if (holding && !holdTimer) holdTimer = setTimeout(endHold, CONST.HOLD_MAX_MS || 2500); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", armCap, { once: true });
    else armCap();
  }
  function endHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (holdAbsTimer) { clearTimeout(holdAbsTimer); holdAbsTimer = null; }
    if (!holding) return;
    holding = false;
    try { document.documentElement.removeAttribute("data-cml-hold"); } catch (e) {}
  }
  // ★ (وثائق Claude Code) سقفٌ لكل نطاق (meta.hydrateMaxMs) بدل العام: صفحات Mintlify الثقيلة تترطّب في 9–15 ث،
  // والسقف العام (8 ث) كان يفتح النصوص قبل الترطيب فيقع خطأ React ‎#418‎ ويُعاد رسم الصفحة كلها من العميل.
  // (قيمةٌ غير عددية أو خارج المعقول تسقط إلى العام؛ والسقف الأعلى دقيقة كي لا تُحبس نصوص موقعٍ فقد إشارته)
  var HYDRATE_MAX = typeof META.hydrateMaxMs === "number" && META.hydrateMaxMs > 0
    ? Math.min(META.hydrateMaxMs, 60000) : (CONST.HYDRATE_MAX_MS || 8000);
  function armTextGate() {
    if (textGate !== "wait") return;
    if (!gateTimer) gateTimer = setTimeout(function () { openTextGate("timeout"); }, HYDRATE_MAX);
    if (hydratedNow()) hydrationSignal("already");
  }

  // ★ (S6-C) عزل اللافتات اللاتينية (meta.isoLabels): لافتةٌ لاتينيةٌ خالصة لم تُترجم وفي طرفها رمزٌ أو رقمٌ في أولها
  // («C#»، «C++»، «‎.NET‎»، «(beta)») تُرسم في سياقٍ RTL مقلوبة («#C» — قِيس في الشريط الجانبي لقائمة حزم SDK وفي قائمة لغة
  // الشيفرة في المرجع): المحايد في الطرف يأخذ اتجاه الفقرة. تُلفّ بـLRI…PDI في عقدة نصّها نفسها (لا عنصرَ يُنشأ) حين تكون
  // اللافتة وحدها نصَّ صندوق سطرها (لا جزءَ جملة — العزل يُفسد ترتيب جملةٍ هي جزؤها) واتجاهُ أبيها المحسوب RTL. والسجلّ iso يحفظ
  // الأصل فيُستعاد في الإطفاء، ومتى صار لها ترجمةٌ تُرجع ثم تُترجم. لا يُخزَّن شيءٌ ولا يُرسل؛ ولا يكون في متن محادثة (translable).
  var ISO_LABELS = !!META.isoLabels, LRI = "\u2066";
  var ISO_EDGE = /^[^A-Za-z]|[^A-Za-z0-9]$/, ISO_MARKS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
  function isolateLabel(node, raw, key) {
    if (key.length > 80 || !HAS_LTR_CH.test(key) || HAS_RTL_CH.test(key) || !ISO_EDGE.test(key) || ISO_MARKS.test(raw)) return;
    var p = node.parentNode;
    if (!p || p.nodeType !== 1 || p.namespaceURI === SVG_NS) return;
    // «وحدها»: صندوقُ سطرها — أقرب سلفٍ عرضُه المحسوب غير inline (كتلةٌ أو عنصرُ مرنٍ أو خلية) — لا نصَّ فيه غيرها. لا بالوسوم:
    // بنود قائمة SDK في الشريط روابطُ <a> متجاورة في حاويةٍ واحدة، والرابط نفسه flex فهو صندوقُ لافتته (قِيس على client-sdks)
    var box = p;
    try {
      if (getComputedStyle(p).direction !== "rtl") return;
      while (box.parentElement && /^(inline|contents)$/.test(getComputedStyle(box).display)) box = box.parentElement;
    } catch (e) { return; }
    if ((box.textContent || "").replace(/\s+/g, " ").trim() !== key.replace(/\s+/g, " ")) return;
    var out = raw.replace(key, function () { return LRI + key + PDI; });
    appliedText.set(node, { raw: raw, key: key, lastWritten: out, iso: 1 });
    everTranslated = true; // كتبنا في الصفحة: مسارات الاستعادة (الإطفاء، والعقد المنقولة بعده) تشملها
    node.nodeValue = out;
  }
  function translateText(node) {
    if (!active || textGate === "wait") return;
    // عنوان التبويب تملكه وحدته (syncTitle) بذيوله ومساراته المستثناة: كان تغيّرُه في التنقّل يمرّ من هنا نصًّا عاديًّا
    // (مراقب الطفرات يغطي <head>) فيُعرَّب حتى في مسارٍ عنوانه اسمُ محادثة. (عنوان SVG في الصفحة nodeName فيه «title» فيبقى هنا)
    if (node.parentNode && node.parentNode.nodeName === "TITLE") return;
    if (BODIES_ON) {
      var bp = node.parentNode;
      // ★ (ر7-ب) لافتةٌ تحكي عنوانًا من المتن (meta.echoSel): نصُّ عنوانها المعروض بحال حارس المتن، لا قاموس الواجهة
      if (ECHO_SEL && isEcho(bp)) { echoText(node); return; }
      // ★ (ر6-د) متن صفحةٍ سابقة خبّأها الموقع في المستند (inCachedBody): لا كتابة فيه ولا إرجاع
      if (bp && bp.nodeType === 1 && inCachedBody(bp)) return;
      // ★ (ر6-ب) حارس المتن: قبل حكم الصفحة لا يُكتب في متنها شيء، وفي الصفحة المحجوبة متنُها على أصله كلّه (bodyGate)
      var bg = bodyGate();
      if (bg && bp && bp.nodeType === 1 && inBody(bp)) { if (bg === 2 && appliedText.has(node)) restoreText(node); return; }
      if (bp && bp.nodeType === 1 && inBody(bp) && !inShell(bp) && !inSkipped(bp) && !inSkipSel(bp) && !bp.isContentEditable &&
          blockPass(node)) return;
    }
    if (!translable(node)) {
      // جزءٌ من جملةٍ في المتن كان كتلةً كاملة ثم لم يعد: يُرجع ما كتبناه (مرّةً، فلا تقاذف)
      if (BODY_SEL && node.parentNode && appliedText.has(node) && fragmentInBody(node.parentNode, node)) restoreText(node);
      // وعقدةٌ عرّبناها ثم صارت في المستثنى (نُقلت إلى جوابٍ مولَّد): يُرجع أصلها
      else if (SKIP_SEL && node.parentNode && appliedText.has(node) && inSkipSel(node.parentNode)) restoreText(node);
      return;
    }
    var prev = appliedText.get(node);
    if (prev && prev.iso) {
      // لافتةٌ لاتينية عزلناها (isolateLabel): كما تركناها وما زالت بلا ترجمة ⇒ تبقى؛ وإلا تُنسى وتُعامل من جديد
      if (node.nodeValue === prev.lastWritten) {
        if (lookup(prev.key) === null) return;
        node.nodeValue = prev.raw;
      }
      appliedText.delete(node);
      prev = null;
    }
    if (prev && (prev.blk || prev.echo)) {
      // سجلُّ كتلةٍ لعقدةٍ لم تعد في المتن (نُقلت): يُرجع أصلها ثم تُعامل عقدةً عادية. ★ (ر7-ب) وسجلُّ صدى عنوانٍ لعقدةٍ لم تعد في لافتتها كذلك
      if (node.nodeValue === prev.lastWritten) node.nodeValue = prev.raw;
      appliedText.delete(node);
      prev = null;
    }
    if (prev) {
      if (node.nodeValue === prev.lastWritten) {
        // العقدة كما تركناها: أعد اشتقاق الترجمة من الأصل (يلتقط تصحيحًا جديدًا أو حذفه)
        var nv = lookup(prev.key);
        var want = nv === null ? prev.raw : prev.raw.replace(prev.key, function () { return bidiWrap(nv); });
        if (node.nodeValue !== want) { node.nodeValue = want; prev.lastWritten = want; scheduleRelayoutNudge(); }
        if (nv === null) appliedText.delete(node); // عاد للأصل — عقدة عادية من جديد
        return;
      }
      // الموقع نفسه غيّر النص (عدّاد مثلًا) — انسَ القديم وترجم الجديد ترجمة عادية
      appliedText.delete(node);
    }
    var raw = node.nodeValue;
    var key = SHARED.textKey(raw, KEY_MAX); // القصّ وحده، بلا سقف طول (نص المحادثة ومحتوى المستخدم مستثنيان في translable)
    if (!key) return;
    var v = lookup(key);
    if (v !== null && v !== key) {
      var out = raw.replace(key, function () { return bidiWrap(v); });
      appliedText.set(node, { raw: raw, key: key, lastWritten: out });
      everTranslated = true;
      node.nodeValue = out;
      if (F) F.note(node.parentNode); // أول خمسة عناصر كتبنا فيها: قياس بلوغ الخط (خاصيةٌ لا نصّ)
      scheduleRelayoutNudge();
      return;
    }
    if (ISO_LABELS) isolateLabel(node, raw, key);
    // لا يُسجَّل شيء هنا: النصّ قُرئ للمطابقة فحسب، ولم يُطابق، فيُترك ويُنسى. لا يُخزَّن
    // ولا يُراكَم ولا يُرسَل. (وهذا موضع الفرق: القراءة عابرة، والتخزين معدوم.)
    // اكتشاف النصوص غير المترجمة يجري عبر «فحص الموقع» الذي يقرأ ملفات claude.ai العامة.
  }
  function translateAttrs(el) {
    if (!active || el.nodeType !== 1 || !el.getAttribute) return;
    if (inChatContent(el) || inShell(el) || inSkipSel(el)) return;
    var rec = appliedAttr.get(el);
    // ★ (ر6-ب) وسمات العناصر داخل المتن (title وaria-label…) كنصوصه: لا تُكتب قبل الحكم، وفي الصفحة المحجوبة على أصلها وما كُتب منها يُرجع
    // ★ (ر6-د) ولا في سمات متن صفحةٍ مخبوءة (inCachedBody)
    if (BODIES_ON && inCachedBody(el)) return;
    var bga = bodyGate();
    if (bga && inBody(el)) {
      if (bga === 2 && rec) { for (var ra in rec) if (el.getAttribute(ra) === rec[ra].lastWritten) el.setAttribute(ra, rec[ra].raw); appliedAttr.delete(el); }
      return;
    }
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], val = el.getAttribute(a);
      if (!val) continue;
      var prev = rec && rec[a];
      if (prev) {
        if (val === prev.lastWritten) {
          var nv = lookup(prev.key);
          var want = nv === null ? prev.raw : prev.raw.replace(prev.key, function () { return bidiWrap(nv); });
          if (val !== want) { el.setAttribute(a, want); prev.lastWritten = want; scheduleRelayoutNudge(); }
          if (nv === null) delete rec[a];
          continue;
        }
        delete rec[a]; // الموقع بدّل السمة — ترجمة عادية من جديد
      }
      var key = SHARED.textKey(val, KEY_MAX); // كعقد النص: بلا سقف طول
      if (!key) continue;
      var t = lookup(key);
      if (t !== null && t !== key) {
        var out = val.replace(key, function () { return bidiWrap(t); });
        if (!rec) { rec = {}; appliedAttr.set(el, rec); }
        rec[a] = { raw: val, key: key, lastWritten: out };
        everTranslated = true;
        el.setAttribute(a, out);
        scheduleRelayoutNudge();
      }
    }
  }
  // إيقاف الترجمة يجب أن يُرجع النص الإنجليزي فورًا، لا أن يترك ما تُرجم مترجمًا.
  // سجلّ الأصول يجعل ذلك ممكنًا بلا تحديث الصفحة.
  // ما ترجمناه ثم فُصل عن الصفحة لا تبلغه الاستعادة (تمشي على المتّصل وحده)، فإن أُعيد
  // بعد الإطفاء بقي عربيًّا (قِيس). فالمراقب وهو خامل يستعيد ما يُضاف من فروعٍ — عملٌ
  // محدود بالمُضاف وحده، ولا قائمةَ قويةً بالعقد (الخرائط ضعيفة المراجع).
  var everTranslated = false;
  function restoreText(n) {
    var rec = appliedText.get(n);
    if (rec) echoDirty = true; // ★ (ر7-ب)
    if (rec && n.nodeValue === rec.lastWritten) n.nodeValue = rec.raw;
    if (rec) appliedText.delete(n);
  }
  function restoreAll(root) {
    // ★ المراقب يغطي documentElement كله (عنوان التبويب، سمات <body>) بينما كانت الاستعادة
    // تمشي على body فقط وتستثني الجذر نفسه — فالإطفاء لا يُرجع كل ما كُتب
    var scope = root || document.documentElement || document.body;
    if (!scope) return;
    var tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var n, list = [];
    while ((n = tw.nextNode())) list.push(n);
    for (var i = 0; i < list.length; i++) {
      var rec = appliedText.get(list[i]);
      if (rec && list[i].nodeValue === rec.lastWritten) { list[i].nodeValue = rec.raw; appliedText.delete(list[i]); }
    }
    if (scope.querySelectorAll) {
      var els = Array.prototype.slice.call(scope.querySelectorAll("[placeholder],[aria-label],[title],[alt]"));
      if (scope.nodeType === 1 && appliedAttr.has(scope)) els.push(scope); // الجذرُ نفسه لا يلتقطه querySelectorAll
      for (var j = 0; j < els.length; j++) {
        var ar = appliedAttr.get(els[j]);
        if (!ar) continue;
        for (var a in ar) {
          if (els[j].getAttribute(a) === ar[a].lastWritten) els[j].setAttribute(a, ar[a].raw);
        }
        appliedAttr.delete(els[j]);
      }
    }
    scheduleRelayoutNudge(); // الاستعادةُ تغييرُ أطوالٍ كذلك — القياسات القديمة بطلت
  }
  // فرعٌ صار داخل المستثنى (meta.skipSel): ما عرّبناه فيه قبلُ (عنصرٌ نُقل إلى جوابٍ مولَّد) يُرجع أصله، نصًّا وسمة.
  // ونبضة إعادة القياس متى أُرجع شيءٌ فعلًا — فبثُّ جوابٍ طويل يضيف عقدًا كثيرة لا نبضة لها
  function unskip(root) {
    var n = 0, tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), t;
    while ((t = tw.nextNode())) if (appliedText.has(t)) { restoreText(t); n++; }
    var els = [root].concat(Array.prototype.slice.call(root.querySelectorAll(ATTR_SELECTOR)));
    for (var i = 0; i < els.length; i++) {
      var ar = appliedAttr.get(els[i]);
      if (!ar) continue;
      for (var a in ar) if (els[i].getAttribute(a) === ar[a].lastWritten) els[i].setAttribute(a, ar[a].raw);
      appliedAttr.delete(els[i]); n++;
    }
    if (n) scheduleRelayoutNudge();
  }

  // ---------- عنوان التبويب (<title>) — قرار المالك (١٩ ربيع الآخر ١٤٤٨هـ): «ترجم كل شيء» يشمله ----------
  // العنوان ليس نصًّا في الصفحة، فمسار النص العام لا يمسّه (translateText) وتملكه هذه الوحدة وحدها:
  //   - يُبحث كاملًا أولًا حرفيًّا (عناوين المقالات والصفحات في قواميس المواقع كاملةً من حصاد DOM)، وإلا فما قبل ذيله (meta.titleSuffix)
  //     بالتصحيحات والقاموس والجموع والأنماط — والنمطُ بلا التقاطٍ لاتيني إلا اسمَ منتج (titleCapOk) — والذيلُ باسمه من قاموس الموقع
  //     أو من meta.titleKeep. ما لم يُترجم منهما يُبقي العنوان كلّه على أصله — لا عنوانَ مختلطًا ولا نصفَ عنوان.
  //   - مسارات meta.titleSkip عنوانها محتوى المستخدم (اسم محادثةٍ أو مشروعٍ أو مُخرَج): لا يُطابَق عنوانها أصلًا، وما كتبناه
  //     فيه قبل التنقّل يُرجع. والحكم بالمسار لا بنصّ العنوان.
  //   - سجلُّ ملكيةٍ كسائر المحرّك (آخر ما كتبناه وأصله)، وذاكرةٌ صغيرة لكتاباتنا: مكوّنات claude.ai تحفظ document.title
  //     لتعيده عند زوالها (نمطٌ متكرر في حزمه)، فما أعاده الموقع من كتابتنا يُعرف أصلُه فيُستعاد عند الإطفاء ولا يعلق عربيًّا.
  //   - لا تقاذف: موقعٌ يعيد ما كان قبل كتابتنا فورًا (خلال TITLE_PIN_FAST_MS) TITLE_PIN_MAX مراتٍ في TITLE_PIN_WINDOW_MS (في حزم
  //     claude.ai قفلٌ يراقب <head> ويعيد عنوانًا حفظه) ⇒ تبقى قيمته حتى يتغيّر — إنجليزيةً في الترجمة، أو عربيةً حفظها من كتابتنا
  //     في الإرجاع. والعنوان نفسه يعيده
  //     التنقّل بعد مهلة (رأس المسار بين صفحتين فرعيتين) ليس قفلًا فلا يُعدّ. وكتابتنا لا توقظنا (نعرفها بقيمتها).
  //   - الكتابة قيمةٌ في عقدة النص القائمة لا استبدالُ عقد (React يحدّث عقدته هو)؛ وعنوانٌ من عقدٍ متعددة لا يُمسّ.
  //   - الإطار الأعلى وحده (عنوان التبويب عنوانُه)، وبعد بوابة الترطيب كالنصوص (اختلاف <title> يُفشل ترطيب Next.js).
  //   - لا يُخزَّن شيء: الأصل والمكتوب في ذاكرة الصفحة ما دامت، ولعناوين الواجهة وحدها.
  var TITLE_ON = window.top === window;
  var TITLE_SFX = (Array.isArray(META.titleSuffix) ? META.titleSuffix : [])
    .filter(function (s) { return typeof s === "string" && !!s.trim(); })
    .sort(function (a, b) { return b.length - a.length; }); // الأطول أولًا: ذيلٌ لا يختبئ خلف ذيلٍ أقصر منه
  var TITLE_KEEP = Array.isArray(META.titleKeep) ? META.titleKeep : [];
  var TITLE_SKIP = (Array.isArray(META.titleSkip) ? META.titleSkip : [])
    .map(function (s) { try { return new RegExp(s); } catch (e) { return null; } })
    .filter(function (r) { return !!r; });
  // أسماء المنتجات الأطولُ أولًا («Claude Code» قبل «Claude»): تُنزع من الالتقاط قبل الحكم عليه (titleCapOk)
  var TITLE_KEEP_LONG = TITLE_KEEP.filter(function (s) { return typeof s === "string" && !!s; })
    .sort(function (a, b) { return b.length - a.length; });
  var TITLE_MINE_MAX = 16;
  var RLM = String.fromCharCode(0x200F);
  var titleRec = null;          // {raw: الأصل الإنجليزي، out: ما كتبناه}
  var titleMine = new Map();    // ما كتبناه ← أصله (آخر TITLE_MINE_MAX)
  var titleReverts = [], titleGiveUp = null, titleHref = null, titleObs = null, titleWroteAt = 0;
  // ★ (المراجعة العدائية، ٢٠ ربيع الآخر ١٤٤٨هـ) آخر ما كتبناه وما كان قبله: القفل يُعرف بإعادته ما كان قبل كتابتنا فورًا — في
  // الاتجاهين. كان العدّ في فرع «نصّ الموقع» وحده، فقفلٌ حفظ عنواننا العربي (مكوّن الأجزاء في claude.ai يحفظ document.title
  // عند تركيبه ويعيده كلما تغيّر) يتقاذف مع الإرجاع (الإطفاء، مسارٌ مستثنى) بلا سقف: مراقبان يتبادلان الكتابة فتتجمّد الصفحة
  var titleWrote = null, titleBefore = null;
  function titleSkipped() {
    var p = location.pathname;
    for (var i = 0; i < TITLE_SKIP.length; i++) if (TITLE_SKIP[i].test(p)) return true;
    return false;
  }
  // عنصر عنوان المستند كما يحسبه المتصفح: أول <title> من فضاء HTML (عنوان SVG داخل الصفحة تلميحٌ لا عنوان)
  function docTitleEl() {
    var l = document.getElementsByTagName("title");
    for (var i = 0; i < l.length; i++) if (l[i].namespaceURI === "http://www.w3.org/1999/xhtml") return l[i];
    return null;
  }
  // الذيل: فاصلٌ (| - : · – — \) بمسافاته ثم الاسم. ★ (ر3) والشرطة المائلة العكسية فاصلُ صفحات anthropic.com
  // («Privacy Policy \ Anthropic»): بدونها كان الاسم «\ Anthropic» فلا يُعرف فيبقى العنوان كلّه إنجليزيًّا
  function sepSplit(s) {
    var i = 0;
    while (i < s.length && s.charAt(i) === " ") i++;
    if ("|-:·–—\\".indexOf(s.charAt(i)) < 0) return { sep: " ", name: s.trim() };
    i++;
    while (i < s.length && s.charAt(i) === " ") i++;
    return { sep: s.slice(0, i), name: s.slice(i).trim() };
  }
  // ★ (المراجعة العدائية) التقاطُ نمطٍ في العنوان لا كلامَ لاتينيًّا فيه إلا اسمَ منتجٍ في titleKeep: أنماط القاموس عريضةٌ للنصوص
  // («Add {name}»، «Actions for X»)، فكانت تطابق العنوان كلَّه فتبتلع الذيل في التقاطها وتعرّب اسمَ جلسةٍ أو عنصرٍ هو محتوى المستخدم
  // («Add tests | Claude Code» ⇒ «إضافة tests | Claude Code» — عنوانٌ مختلط). الأرقام والتواريخ تبقى («Page 7»، «3 files»)
  function titleCapOk(c) {
    for (var i = 0; i < TITLE_KEEP_LONG.length; i++) c = c.split(TITLE_KEEP_LONG[i]).join("");
    return !HAS_LTR_CH.test(c);
  }
  // بحث العنوان: التصحيحات والقاموس كالنصوص؛ ثم (ما لم يُطلب الحرفيّ وحده) الجموع والأنماط بالتقاطٍ مقبول. بلا ذاكرة lookup:
  // نتيجةُ النمط هنا غيرُ نتيجته للنص
  function titleLookup(key, litOnly) {
    var v = ownGet(active.overrides, key);
    if (v === undefined) v = ownGet(active.strings, key);
    if (v !== undefined) return v;
    if (litOnly) return null;
    var pl = tryPlural(key);
    return pl !== null ? pl : tryPatterns(key, titleCapOk);
  }
  // ترجمة العنوان كلِّه أو null (لا ترجمةَ لجزءٍ منه): عنوانٌ بذيلٍ معروف يُطابَق كاملًا حرفيًّا (عناوين المقالات من حصاد DOM) ثم
  // ما قبل ذيله؛ وعنوانٌ بلا ذيلٍ معروف يُطابَق كاملًا كالنصوص («Download Claude»)
  function titleTr(key) {
    for (var i = 0; i < TITLE_SFX.length; i++) {
      var s = TITLE_SFX[i];
      if (key.length <= s.length || key.slice(key.length - s.length) !== s) continue;
      var v = titleLookup(key, true);
      if (v !== null) return v;
      var pre = key.slice(0, key.length - s.length).trim();
      var pv = pre ? titleLookup(pre, false) : null;
      if (pv === null) return null;
      var sp = sepSplit(s);
      var nv = TITLE_KEEP.indexOf(sp.name) >= 0 ? sp.name : titleLookup(sp.name, true);
      return nv === null ? null : pv + sp.sep + nv;
    }
    return titleLookup(key, false);
  }
  // عنوانٌ مترجَم أولُ حرفٍ قويٍّ فيه لاتيني («API الرسائل - …») يُعرض في شريط التبويبات من اليسار: علامةُ اتجاهٍ واحدة
  // (RLM) تجعل فقرته فقرةَ لغة الهدف — لا عوازل (عازلٌ لا يُحسب في اتجاه الفقرة)
  function titleDir(s) {
    if (!active || active.dir !== "rtl") return s;
    var l = s.search(HAS_LTR_CH), r = s.search(HAS_RTL_CH);
    return l >= 0 && r >= 0 && l < r ? RLM + s : s;
  }
  function syncTitle() {
    if (!TITLE_ON) return;
    titleHref = location.href;
    var el = docTitleEl();
    var t = el && el.childNodes.length === 1 && el.firstChild.nodeType === 3 ? el.firstChild : null;
    if (!t) { titleRec = null; return; }
    var cur = t.nodeValue, raw, skip = titleSkipped();
    if (titleWrote !== null && cur !== titleWrote) {
      // كتب غيرُنا بعدنا: أعاد ما كان قبل كتابتنا فورًا (قفل) ⇒ عدٌّ في نافذة، وعند السقف نتركه على قيمته (لا تقاذف)؛ وإلا
      // فعنوانٌ آخر، أو العنوان نفسه بعد مهلة (تنقّلٌ أعاد رأس المسار): ليس قفلًا
      var now = Date.now();
      if (cur === titleBefore && now - titleWroteAt <= (CONST.TITLE_PIN_FAST_MS || 100)) {
        var win = CONST.TITLE_PIN_WINDOW_MS || 3000;
        titleReverts = titleReverts.filter(function (x) { return now - x < win; });
        titleReverts.push(now);
        if (titleReverts.length >= (CONST.TITLE_PIN_MAX || 5)) titleGiveUp = cur;
      } else titleReverts = [];
      titleWrote = null;
    }
    if (titleGiveUp !== null && cur !== titleGiveUp) titleGiveUp = null; // عنوانٌ آخر: تُعاد المحاولة
    if (titleRec && cur === titleRec.out) raw = titleRec.raw;      // كما تركناه
    // كتابتُنا أعادها الموقع بعد أن حفظها — لا في مسارٍ مستثنى (عربيةٌ فيه تساوي ترجمةً لنا هي اسمٌ كتبه المستخدم) ولا والموقع
    // بلغةٍ أخرى (عنوانه عنوانه)
    else if (!skip && !state.siteForeign && titleMine.has(cur)) raw = titleMine.get(cur);
    else raw = cur;                                                // نصُّ الموقع: هو الأصل
    var want = raw;
    if (cur === titleGiveUp) want = cur;                           // قفلٌ غلب: قيمتُه كما هي في الاتجاهين
    else if (state.enabled && active && textGate !== "wait" && !skip) {
      var key = SHARED.textKey(raw, KEY_MAX), tv = key ? titleTr(key) : null;
      if (tv !== null && tv !== key) want = raw.replace(key, function () { return titleDir(tv); });
    }
    if (want === raw) titleRec = null;
    else {
      titleRec = { raw: raw, out: want };
      titleMine.delete(want);
      titleMine.set(want, raw);
      if (titleMine.size > TITLE_MINE_MAX) titleMine.delete(titleMine.keys().next().value);
    }
    if (t.nodeValue !== want) { titleBefore = t.nodeValue; t.nodeValue = want; titleWrote = want; titleWroteAt = Date.now(); }
  }
  function touchesTitle(list) {
    for (var i = 0; i < list.length; i++) if (list[i].nodeName === "TITLE") return true;
    return false;
  }
  // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) دفعةُ طفراتٍ تمسّ <title> خارج <head> (مراقب الرأس يتولّى ما فيه): العنصر نفسه أو نصّه، أو عنوانٌ
  // أُضيف أو أُزيل — من سجلّات الطفرة وحدها لا بحثًا في الفروع، فكلفتها ثابتةٌ لكل سجلّ. وكتابتنا نحن تعود إلى syncTitle فيعرفها
  // بقيمتها (titleWrote) فلا تقاذف
  function titleOutsideHead(list) {
    var hd = document.head;
    for (var i = 0; i < list.length; i++) {
      var m = list[i], tg = m.target;
      if (m.type === "attributes" || !tg) continue;
      if (!(tg.nodeName === "TITLE" || (tg.parentNode && tg.parentNode.nodeName === "TITLE") ||
            touchesTitle(m.addedNodes) || touchesTitle(m.removedNodes))) continue;
      if (!hd || !hd.contains(tg)) return true;
    }
    return false;
  }
  // مراقبُ <head>: تبدّلُ نصّ العنوان (React يكتب قيمة عقدته، وdocument.title يستبدلها) أو عنصرِه (next/head) — والتنقّل
  // داخل المستند بلا تغيّرٍ في العنوان يلتقطه مراقب الطفرات العام (titleHref) وpopstate وواجهة Navigation
  function watchTitle() {
    if (!TITLE_ON || titleObs || !document.head || typeof MutationObserver !== "function") return;
    try {
      titleObs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i], tg = m.target;
          if (tg.nodeName === "TITLE" || (tg.parentNode && tg.parentNode.nodeName === "TITLE") ||
              touchesTitle(m.addedNodes) || touchesTitle(m.removedNodes)) { syncTitle(); return; }
        }
      });
      titleObs.observe(document.head, { childList: true, subtree: true, characterData: true });
    } catch (e) { titleObs = null; return; }
    window.addEventListener("popstate", function () { setTimeout(syncTitle, 0); });
    try {
      if (window.navigation && typeof window.navigation.addEventListener === "function") {
        window.navigation.addEventListener("navigatesuccess", function () { syncTitle(); });
      }
    } catch (e) {}
    syncTitle();
  }

  function walk(root) {
    if (!active || !state.enabled || !root) return;
    newPass();
    // تقليم من مستوى العنصر: صعودٌ واحد بدل صعودٍ لكل عقدة نصية داخل الفرع.
    if (root.nodeType === 1 && inChatContent(root)) return;
    if (root.nodeType === 1 && inSkipSel(root)) { if (everTranslated) unskip(root); return; }
    if (root.nodeType === 1) {
      translateAttrs(root);
      var els = root.querySelectorAll(ATTR_SELECTOR);
      for (var i = 0; i < els.length; i++) translateAttrs(els[i]);
    }
    // نمشي على العناصر والنصوص معًا: عنصرُ محادثةٍ يُرفض فيُقلَّم فرعه كله بفحص واحد،
    // بدل استدعاء inChatContent لكل عقدة نصية داخل ردٍّ طويل (مئات العقد).
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          if (SKIP[n.nodeName] || n.isContentEditable) return NodeFilter.FILTER_REJECT;
          try { if (CHAT_ON && n.matches && n.matches(CHAT_ANCESTOR)) return NodeFilter.FILTER_REJECT; } catch (e) {}
          try { if (SHELL_SEL && state.route === "shell" && n.matches && n.matches(SHELL_SEL)) return NodeFilter.FILTER_REJECT; } catch (e) {}
          try { if (SKIP_SEL && n.matches && n.matches(SKIP_SEL)) return NodeFilter.FILTER_REJECT; } catch (e) {}
          return NodeFilter.FILTER_SKIP; // تجاوز العنصر نفسه واستمر في أبنائه
        }
        var p = n.parentNode;
        if (!p || SKIP[p.nodeName] || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var batch = [], n;
    while ((n = tw.nextNode())) batch.push(n);
    for (var j = 0; j < batch.length; j++) translateText(batch[j]);
  }

  // ---------- observe dynamic UI ----------
  // لا نحتفظ بسجلات الطفرات كما هي: السجل يمسك addedNodes وremovedNodes (قوائم عقد حيّة)
  // فتبقى شجرةٌ أُزيلت محتجزةً في الذاكرة، وتبويبٌ خلفي يبثّ دقائق يراكم عشرات الآلاف من
  // السجلات لأن requestIdleCallback لا يكاد يعمل وهو مخفيّ. نستخرج الأهداف فورًا في
  // مجموعات (إزالة تكرار مجانية) بسقفٍ يمنع التضخم غير المحدود.
  var queued = false;
  var pendAdded = [], pendText = new Set(), pendAttr = new Set(), pendRem = new Set();
  var pendOverflow = false;
  var PEND_MAX = CONST.PEND_MAX;
  var ric = window.requestIdleCallback ? window.requestIdleCallback.bind(window) : null;
  var schedule = ric ? function (cb) { return ric(cb, { timeout: 500 }); } : function (cb) { return setTimeout(cb, 200); };
  function clearPending() { pendAdded = []; pendText.clear(); pendAttr.clear(); pendRem.clear(); }
  var obs = new MutationObserver(function (list) {
    cacheEpoch++; // ★ (ر6-د) حقبةٌ جديدة لجذور المتن المخبوءة (inCachedBody)
    // الخط أولًا وقبل الرسم (§٤.٣ المحفِّزات): أول نداءٍ يبني الدلاء المنتظمة للقراءة والشيفرة، وبعده تمريرةٌ
    // إن تغيّر document.fonts.size وحده — فيوجد الوجه قبل الإطار الذي تُرسم فيه أول عربيةٍ مترجَمة أو من المحادثة
    if (F) F.check();
    // ★ (ر3) منتقي اللغة في الصفحة (meta.siteLangSel): يُحكم مع كل دفعة ولو كانت الإضافة خاملة — فالعودة إلى «English» تُرى —
    // وقبل حارس المسار، فوثيقةٌ يُتنقَّل إليها وهي بلغةٍ أخرى تبقى خاملة من أول لحظة
    if (LANG_SEL) judgeSiteLang();
    if (META.intercom && (!wrapEl || !wrapEl.isConnected)) applyWrapper(); // يظهر أثناء التحليل أو يستبدله الترطيب
    if (textGate === "wait" && hydratedNow()) hydrationSignal("hydrated");
    if ((META.routes || BODIES_ON) && location.href !== lastHref) checkRoute();
    // ★ (ر6-ج) هويّة شجرة المتن مع كل دفعةٍ وفي كل حال (guardTrack)، وبعد التنقّل يُحكم حين تصير شجرةَ الصفحة الحاضرة (guardArm) — لا
    // بأيّ تبدّلٍ خارج <head> يُعيد عدّ الهدوء (ر6-ب). وكتابتنا قيمٌ وسمات لا عقد، فلا تغيّر الهويّة
    if (GUARD !== null) { guardTrack(); if (guardWait) guardArm(); }
    // تنقّلٌ داخل المستند (التطبيق بلا حارس مسار): مسار العنوان قد صار مستثنًى وعنوانُنا باقٍ فيه — يُعاد حكمه.
    // ★ (ر3) و<title> خارج <head>: بيانات Next.js المتدفّقة تضعه في <body> في بعض التحميلات (الوثائق القانونية: 3 من 5)، ومراقب
    // العنوان (watchTitle) يرى <head> وحده — فالتنقّل بين وثيقتين كان يُبقي العنوان الجديد إنجليزيًّا. مرّةً لكل دفعة
    if (TITLE_ON && ((titleHref !== null && location.href !== titleHref) || titleOutsideHead(list))) syncTitle();
    if (!state.enabled || !active) {
      if (!state.enabled && everTranslated) {
        for (var ri = 0; ri < list.length; ri++) {
          var added = list[ri].type === "childList" ? list[ri].addedNodes : [];
          for (var rk = 0; rk < added.length; rk++) {
            var an = added[rk];
            if (an.nodeType === 3) restoreText(an);
            else if (an.nodeType === 1) restoreAll(an);
          }
        }
      }
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (pendAdded.length + pendText.size + pendAttr.size + pendRem.size > PEND_MAX) {
        // تجاوزنا السقف: انسَ التفاصيل واكتفِ بمرور كامل لاحق — أرخص وأضمن من طابور متضخم
        pendOverflow = true; clearPending(); break;
      }
      if (m.type === "childList") {
        for (var k = 0; k < m.addedNodes.length; k++) {
          var nd = m.addedNodes[k];
          if (nd.nodeType === 1 || nd.nodeType === 3) pendAdded.push(nd);
        }
        // ★ إزالةٌ داخل المتن تغيّر كتلتها (خانةٌ فقدت عقدتها، أو زال ما أُدرج عابرًا): تُعاد تقديرها
        if (BODIES_ON && m.removedNodes.length && m.target && m.target.nodeType === 1) pendRem.add(m.target);
      } else if (m.type === "characterData") pendText.add(m.target);
      else if (m.type === "attributes") pendAttr.add(m.target);
    }
    if (queued) return; queued = true;
    schedule(function () {
      queued = false;
      // الحالة قد تكون تبدّلت بين جدولة الدفعة وتنفيذها (حتى نصف ثانية). بلا هذا الفحص
      // تُنفَّذ دفعة قديمة بعد أن أوقف المستخدم الترجمة فتعيد ترجمة عقد أرجعها restoreAll
      // إلى الإنجليزية — فتبقى عبارات عربية عالقة في صفحة «موقفة» حتى إعادة التحميل.
      if (!state.enabled || !active) { clearPending(); pendOverflow = false; return; }
      if (pendOverflow) { pendOverflow = false; clearPending(); fullPass(); return; }
      var added = pendAdded, texts = pendText, attrs = pendAttr, rems = pendRem;
      pendAdded = []; pendText = new Set(); pendAttr = new Set(); pendRem = new Set();
      newPass(); // دفعةٌ جديدة لا ترث أختام الكتل من سابقتها (نصٌّ أُدرج في كتلةٍ معرَّبة يُعاد تقديرها)
      // حاوياتُ الاتجاه التي مسّتها الدفعة: تُعاد مرةً واحدة بعدها لا مرةً لكل عقدةٍ مضافة (مالكو ق٢ يمشون المتن كله)
      var dirRoots = new Set();
      for (var i = 0; i < added.length; i++) {
        var nd = added[i];
        if (!nd.isConnected) continue; // عقدة أُزيلت قبل أن نصل إليها
        if (nd.nodeType === 1) {
          walk(nd);
          // ★ فقرةٌ يبثّها الموقع داخل حاوية رسالةٍ سبق معالجتها: applyChatDir تنظر إلى الأسفل
          // فلا تجد الحاوية، فكانت الكتل المبثوثة (60/60 مقيسًا) تبقى بلا dir حتى مرورٍ كامل
          // مصادفةً — فتُعرض العربية بعد فاتحةٍ إنجليزية LTR. الحاويةُ الحاضنة هي النطاق.
          dirRoots.add((DIRSEL && nd.closest && nd.closest(DIRSEL)) || nd);
          // المواضع المحسوبة تظهر مع فروعها المستجدّة (قائمة تُفتح، لوحة تُركَّب)،
          // والمرور الكامل وحده كان يفوّتها حتى المرور التالي — فتظهر مقلوبةً لحظتَها
          markComputedSurfaces(nd);
        } else {
          translateText(nd);
          // خارج المحادثة: نصٌّ أُضيف إلى كتلةٍ قائمة يغيّر حكم مالكها (ق٢)؛ والمحادثة على حالها المقيس
          if (!CHAT_ON && DIRSEL && nd.parentNode && nd.parentNode.closest) {
            var dr0 = nd.parentNode.closest(DIRSEL);
            if (dr0) dirRoots.add(dr0);
          }
        }
      }
      if (rems.size) {
        // المالك غير السطري للهدف (الكتلة كلّها لا ما بقي داخل الوسم وحده) — مرّةً لكل مالك
        var owners = new Set();
        rems.forEach(function (t) {
          if (!t.isConnected || !inBody(t)) return;
          var ow = t;
          while (ow && ow.nodeType === 1 && SHARED.inlineKind(ow, rawOfNode)) ow = ow.parentNode;
          if (ow && ow.nodeType === 1) owners.add(ow);
        });
        owners.forEach(function (ow) {
          walk(ow);
          var dr1 = !CHAT_ON && DIRSEL && ow.closest ? ow.closest(DIRSEL) : null;
          if (dr1) dirRoots.add(dr1);
        });
      }
      // ★ نصٌّ يُبثّ في عقدةٍ قائمة داخل المستثنى (جوابٌ مولَّد في وثائق Claude Code يكبر حرفًا حرفًا): يُعاد حكم اتجاه
      // حاويته — فجوابٌ عربي بدأ باسمٍ لاتيني لا يبقى على LTR حُكم به من أول كلماته. في المستثنى وحده: لا نكتب فيه شيئًا
      // فلا يوقظ نفسه، وخارجه تغيّراتُ النص كتاباتُنا نحن (مسحُ المتن كله عند كل دفعة كلفةٌ بلا سبب)
      if (!CHAT_ON && SKIP_SEL && DIRSEL) texts.forEach(function (n) {
        var pe = n.isConnected && n.parentNode;
        if (pe && pe.closest && inSkipSel(pe)) { var dr2 = pe.closest(DIRSEL); if (dr2) dirRoots.add(dr2); }
      });
      dirRoots.forEach(function (r) { if (r.isConnected) applyChatDir(r); });
      newPass();
      texts.forEach(function (n) { if (n.isConnected) translateText(n); });
      attrs.forEach(function (n) { if (n.isConnected) translateAttrs(n); });
      // ★ (ر7-ب) عنوانٌ عُرّب أو أُرجع في هذه الدفعة: لافتات صداه تتبعه (وما سوى ذلك لا يغيّر عنوانًا معروضًا: اللافتة نفسُها إن بدّلها
      // الموقع مرّت بـtranslateText في الدفعة)
      if (echoDirty) echoAll();
    });
  });

  // ---------- conversation direction (optional; دير=auto lets the browser flow Arabic RTL and keep code/English LTR) ----------
  var CHATSEL = ".prose, .font-claude-message, [data-testid='user-message'], [data-testid='message-content']";
  // ★ dir="auto" أساسٌ، وتدخُّلُنا استثناءٌ محسوم: المتصفح يحكم بأول حرفٍ قويٍّ لا
  // غير، فتنقلب فقرةٌ عربيةٌ صدرُها رابطٌ أو مسارٌ أو مقتطفُ شيفرةٍ أو رقمُ بند.
  // resolveDir يجرّد ذلك الضجيج ثم يحكم، ولا يُرجع رأيًا إلا حين يجزم — وإلا
  // بقيت "auto" وهي سلوك المنصة القياسي (وقياسُنا أثبت أنه يضبط direction نفسها
  // فتصحّ الخصائص المنطقية للأحفاد، وهو ما لا يفعله unicode-bidi:plaintext).
  // dir الذي وضعه الموقع نفسُه يُحفظ عند أول كتابة ويُرجَع عند الإطفاء — كان يُدهس ثم يُحذف
  var chatDirOrig = new WeakMap();
  function restoreDir(el) {
    var o = chatDirOrig.get(el);
    if (o === undefined || o === null) el.removeAttribute("dir"); else el.setAttribute("dir", o);
    chatDirOrig.delete(el);
    el.removeAttribute("data-cml-dir");
  }
  // خارج المحادثة لا يكتب بلغة الهدف غيرُنا: أغلبيةٌ عربية بسيطة تحسم ولو قصر النص (ق٢)
  var DIR_OPT = CHAT_ON ? null : { ui: true };
  // حرفٌ قويّ الاتجاه (لاتيني أو من كتابات اليمين إلى اليسار — النطاقات أرقامٌ لا أسماء)
  var STRONG_CH = new RegExp("[A-Za-z\\u00C0-\\u024F\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF]");
  // ★ (ر5-ج) حرفٌ من حروف كتابة لغة الهدف ذات الاتجاه من اليمين: حروف الكتابة العربية وحدها بخاصيّتَي يونيكود (لا نطاقاتٌ مكتوبة)، في كتلها كلها
  // ومنها أشكال العرض. ★ (المراجعة المستقلة E8) وكان المدى كلَّ محارف تلك الكتل، ومنها U+FEFF (علامة ترتيب البايتات) ومحارف التنسيق والترقيم
  // والأرقام: فجدولٌ إنجليزي كلّه فيه محرفٌ شاردٌ منها كان يأخذ اتجاه الصفحة فتنقلب أعمدته
  var TARGET_SCRIPT = /(?=\p{Script=Arabic})\p{L}/u;
  // ★ (ر6-ب) أبعد غلافٍ لكل جدولٍ معرَّب تحت root لا نصَّ فيه غيرُ الجدول (إخوته في كل مستوى بلا نص: شريط التمرير على الجوال) — دون root
  function tableWrappersIn(root, into) {
    var tbs = root.getElementsByTagName("table");
    for (var i = 0; i < tbs.length; i++) {
      var w = tbs[i];
      if (!TARGET_SCRIPT.test(w.textContent || "")) continue;
      for (var p = w.parentElement; p && p !== root; p = p.parentElement) {
        var other = false;
        for (var c = p.firstChild; c && !other; c = c.nextSibling) {
          if (c !== w && (c.nodeType === 3 ? /\S/.test(c.nodeValue || "") : c.nodeType === 1 && /\S/.test(c.textContent || ""))) other = true;
        }
        if (other) break;
        w = p;
      }
      if (w !== tbs[i] && into.indexOf(w) < 0) into.push(w);
    }
  }
  // ★ (ر6-ب) كلُّ عقدة نصٍّ ذات محتوى في العنصر خارج الذرّات (الشيفرة والأيقونات) كتبها وضع الكتلة وما زالت كما تركها، وفيه واحدةٌ على الأقل
  function blkWrittenOnly(el) {
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), t, any = false, memo = new WeakMap();
    while ((t = tw.nextNode())) {
      if (!/\S/.test(t.nodeValue || "")) continue;
      if (!SHARED.blockOwner(t, rawOfNode, memo)) continue;
      var r = appliedText.get(t);
      if (!r || !r.blk || t.nodeValue !== r.lastWritten) return false;
      any = true;
    }
    return any;
  }
  // ★ (ر6-هـ) كلُّ نصٍّ ذي حرفٍ قويٍّ في العنصر نصُّ رسمٍ SVG (أبوه من فضاء SVG، لا HTML داخل foreignObject)، وفيه واحدٌ على الأقل
  function svgTextOnly(el) {
    if (!el.getElementsByTagNameNS || !el.getElementsByTagNameNS(SVG_NS, "text").length) return false;
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), t, any = false;
    while ((t = tw.nextNode())) {
      if (!STRONG_CH.test(t.nodeValue || "")) continue;
      if (!t.parentNode || t.parentNode.namespaceURI !== SVG_NS) return false;
      any = true;
    }
    return any;
  }
  // ★ (ر6-هـ) نصٌّ كلُّه رموزُ مفاتيح وترقيمٌ لاتيني (بلا حرفٍ ولا رقم) وفيه قوسٌ أو شرطةٌ مائلة: «], [» في جدول اختصارات Slides
  var KEYS_ONLY = /^[\s!-\/:-@\[-`{-~]+$/, KEYS_SYM = /[\[\]{}()\/\\]/;
  function setChatDir(el) {
    if (!chatDirOrig.has(el)) chatDirOrig.set(el, el.getAttribute("dir"));
    // كتلةٌ ترجمها وضع الكتلة كلَّها: اتجاه لغة الهدف بلا عدّ (انظر blkOwnersTr)
    if (BODIES_ON && blkOwnersTr.has(el) && active && active.dir) {
      if (el.getAttribute("dir") !== active.dir) el.setAttribute("dir", active.dir);
      return;
    }
    // ★ (ر6-هـ، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ لـت4، O2) حاويةٌ نصُّها كلُّه تسمياتُ رسمٍ SVG (‎<figure>‎ المخطط في الوثائق): اتجاه الرسم الأصلي
    // LTR، لا اتجاهٌ يُحكم بتسمياته المعرَّبة. مواضع نصوص الرسم أرقامٌ ثابتة رُسمت لـLTR، ومرساةُ «start» تتبع اتجاه النص: كانت حاويةُ مخططَي صفحة
    // التفكير المحفوظ (preserved-thinking) تُحكم RTL لأن أكثر تسمياتها عربية، فترث النصوصُ RTL وتمتدّ تسمياتُ «start» يسارًا فتُقصّ 11 منها عند
    // حافة الرسم؛ والموقع بلا الإضافة لا يضع عليها اتجاهًا (LTR). وسائر مخططات الوثائق نالت dir="auto" فصارت LTR بأول حرفٍ لاتيني فيها مصادفةً —
    // ومخططٌ أول تسمياته عربية كان سيصير RTL كذلك. والعربية في التسميات معزولةٌ بـRLI…PDI (svgIsolate) فتُقرأ من اليمين داخل الرسم LTR.
    // (سمة dir على عناصر SVG نفسها لا أثر لها في كروم — قِيس — فالحاوية HTML هي موضعها)
    if (!CHAT_ON && svgTextOnly(el)) {
      if (el.getAttribute("dir") !== "ltr") el.setAttribute("dir", "ltr");
      return;
    }
    // ★ (ر5-ج، ٢٩ ربيع الآخر ١٤٤٨هـ — ملاحظة المالك ٢(أ)) الجدول وغلافه الذي لا يحوي غيره (غلاف كتلة Intercom، و‎.prose-scroll‎ في الوثائق):
    // اتجاهه ترتيبُ أعمدته لا لغةُ أغلب نصّه، فمتى عُرِّب منه شيءٌ (فيه حرفٌ من كتابة لغة الهدف) أخذ اتجاه الصفحة. كان جدولا ملفات تعريف
    // الارتباط المتماثلان في الخصوصية يُحسمان مختلفَين: الأول غلبت عليه أسماء الملفات والنطاقات اللاتينية فنال dir="auto"، وخلاياه العربية لها
    // اتجاهها فتخطّاها المتصفح إلى أول لاتيني، فصار LTR برؤوسٍ عربية — عموده الأول يسارًا وبدايته خارج الشاشة على الجوال. والجدول الإنجليزي
    // كلُّه (لم يُعرَّب) يبقى على حكمه كما كان، وخلايا كل صفٍّ تُحسم وحدها كما كانت (العربية RTL والقيم اللاتينية LTR)
    if (!CHAT_ON && active && active.dir === "rtl") {
      var tbl = el.localName === "table" ? el : (el.childElementCount === 1 && el.firstElementChild.localName === "table" ? el.firstElementChild : null);
      // ★ (ر6، ٢٩ ربيع الآخر ١٤٤٨هـ) وغلاف الجدول في وثائق Claude Code أعمق: div.min-w-0 ثم ثلاثة أغلفة قبل table، وعلى الجوال يجاورها شريطُ
      // تمريرٍ بلا نص (div.z-10)، فلم تطابقه القاعدة: جدول المفاتيح في settings أكثرُ نصّه لاتيني فنال غلافُه dir="auto"، وتخطّى المتصفح خلاياه
      // العربية ذات الاتجاه إلى أول لاتيني فصار LTR برؤوسٍ عربية، عموده الأول يسارًا (فحص الاتجاه: table-dir في settings وclaude-directory).
      // فالغلاف الذي لا يحوي غيره: جدولٌ واحد فيه نصُّه كلُّه. وفي صفحةٍ وصلت قطعةُ متنها وحدها (bodyMap ولا طلبَ معلَّق): صفحةٌ حُجب متنها
      // (لا قطعة لها) تبقى جداولها الإنجليزية LTR ولو عرّب قاموس الواجهة فيها كلمةً («نعم»/«لا» في hooks) أو صحّح القارئ فيها فقرة
      // ★ (ر6-ب) وصفحةٌ حجب حارسُ المتن قطعتها كصفحةٍ بلا قطعة (shardOn)
      if (!tbl && bodyMap && !bodyPending && shardOn()) {
        var tbs = el.getElementsByTagName("table");
        if (tbs.length === 1 && (el.textContent || "").replace(/\s+/g, "") === (tbs[0].textContent || "").replace(/\s+/g, "")) tbl = tbs[0];
      }
      if (tbl && TARGET_SCRIPT.test(tbl.textContent || "")) {
        if (el.getAttribute("dir") !== active.dir) el.setAttribute("dir", active.dir);
        return;
      }
    }
    // ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر6، السبب D1) فقرة Mintlify السطرية <span data-as="p"> (تُحسم وحدها منذ ر5) لا تنال عضوية
    // blkOwnersTr — مالكُ كتلتها اللوحةُ كلُّها لا هي — فكان resolveDir يعدّ حروفها ومعها الشيفرة السطرية فيحكم LTR على فقرةٍ عربية أكثرُها
    // شيفرة («اسم الحدث: claude_code.tool_result»، 93 فقرةً في 34 صفحة). فإن كانت كلُّ عقد نصّها ذات الحروف خارج الذرّات كتاباتٍ لوضع الكتلة
    // كما تركناها (ترجمةٌ يقينًا، blkWrittenOnly) فاتجاهها اتجاه اللغة بلا عدّ — كما يُفعل بالمالك في blkOwnersTr
    // ★ (ر6-ب، المراجعة) والرابط <a> كذلك: بندُ الفهرس (#table-of-contents li > a في Claude Code، وnav li > a في الوثائق) ابنٌ مباشرٌ لجذر
    // الاتجاه فيُحكم وحده بعدّ حروفه، فترجمةٌ أكثرُ حروفها لاتينية («تثبيت Claude Code»، «3. تهيئة Claude Code») كانت تُعرض LTR داخل بندٍ RTL،
    // وعنوانُها نفسه في المتن RTL (40 بندًا في 17 من الصفحات الـ35 على 1366؛ ولا فهرس على 390)
    if (BODIES_ON && !CHAT_ON && active && active.dir && (el.localName === "span" || el.localName === "a") && blkWrittenOnly(el)) {
      if (el.getAttribute("dir") !== active.dir) el.setAttribute("dir", active.dir);
      return;
    }
    var want = "auto", txt = "";
    try {
      txt = el.textContent || "";
      if (txt && txt.length > 1) want = SHARED.resolveDir(txt, DIR_OPT) || "auto";
    } catch (e) {}
    // ★ (وثائق Claude Code — فحص الاتجاه، تراكبٌ عالٍ) خارج المحادثة: مالكٌ بلا حرفٍ قويّ لا يُحسم بـauto — فـauto بلا
    // قويٍّ يعني LTR، فتنقلب هوامشه المنطقية داخل سطرٍ من اليمين. قِيس: مرساة العنوان («Navigate to header»: محرفُ
    // عرضٍ صفري وأيقونة) نالت dir=auto فبقيت يسارًا متراكبةً على العنوان المعرَّب. فيرث اتجاه حاويته (أصلُ سمته يعود)
    if (!CHAT_ON && want === "auto" && !STRONG_CH.test(txt)) {
      // ★ (ر6-هـ، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ لـت4) إلا نصًّا كلُّه رموزُ مفاتيح وترقيمٌ لاتيني فيه قوسٌ أو شرطةٌ مائلة (خلية «], [» لمفتاحَي
      // «]» و«[» في جدول اختصارات Slides): موروثُ RTL يعكس ترتيبه ويقلب شكل القوسين فيُرى «[ ,]» — فهو LTR كخلايا المفاتيح اللاتينية في
      // الجدول نفسه («Cmd+Z»). وما فيه حرفٌ عربيٌّ (قويٌّ) لا يصل هنا، ولا رقمٌ («[1]»)، ولا سهمٌ («->» يُعكس مع الصفحة)
      if (KEYS_ONLY.test(txt) && KEYS_SYM.test(txt)) {
        if (el.getAttribute("dir") !== "ltr") el.setAttribute("dir", "ltr");
        return;
      }
      var o = chatDirOrig.get(el);
      if (o === null || o === undefined) el.removeAttribute("dir"); else if (el.getAttribute("dir") !== o) el.setAttribute("dir", o);
      return;
    }
    if (el.getAttribute("dir") !== want) el.setAttribute("dir", want);
  }
  // ★ (فحص الاتجاه الشامل ١٤٤٨هـ، ق٢) مالكو الكتل الحاملة لنصٍّ داخل الحاوية — لا قائمةُ وسومٍ ثابتة:
  // كل ما لم يكن في القائمة (زرّ «نسخ الصفحة»، وصف بطاقة، رابطٌ في div) كان يرث اتجاه الحاوية المحسوم
  // بأول قويٍّ في المتن كله، فيُعرض العربي فيه LTR (102 عنصر مقيسًا). المالك: أقرب سلفٍ غير سطري
  // (SHARED.blockOwner، حكمُ الحصاد والكتل نفسه)، والشيفرة وما داخل الذرّات خارجه.
  function dirOwnersIn(el, into) {
    var memo = new WeakMap(), tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), t;
    var have = new Set(into);
    while ((t = tw.nextNode())) {
      if (!/[^\s]/.test(t.nodeValue)) continue;
      var pe = t.parentNode;
      if (!pe || pe.nodeType !== 1 || (pe.closest && pe.closest("pre, code, script, style, textarea"))) continue;
      var o = SHARED.blockOwner(t, rawOfNode, memo);
      var ow = o ? o.owner : null;
      if (!ow || ow === el || have.has(ow) || !el.contains(ow)) continue;
      have.add(ow); into.push(ow);
    }
  }

  // ★ (١-١) الاتجاه لكل كتلة: في التطبيق متنُ المحادثة (CHATSEL، بمفتاح «اتجاه المحادثة»)، وفي
  // منصة Intercom متنُ المقالة وعنوانها (meta.dirSel، مع قلب الصفحة) — متونٌ إنجليزية داخل
  // تخطيطٍ من اليمين كانت تُعرض بترقيمٍ مقلوب («?How long…») إلى أن تُعرَّب في المرحلة ٤.
  var DIRSEL = CHAT_ON ? CHATSEL : (META.dirSel || null);
  function applyChatDir(root) {
    if (!root || !DIRSEL) return;
    var scope = root.nodeType === 1 ? root : (document.body || document.documentElement);
    if (!scope || !scope.querySelectorAll) return;
    var list = [];
    if (scope.matches && scope.matches(DIRSEL)) list.push(scope);
    var found = scope.querySelectorAll(DIRSEL);
    for (var i = 0; i < found.length; i++) list.push(found[i]);
    var on = state.enabled && (CHAT_ON ? state.chatrtl : !!(state.rtl && active && active.dir === "rtl"));
    for (var j = 0; j < list.length; j++) {
      var el = list[j];
      if (on) {
        setChatDir(el);
        el.setAttribute("data-cml-dir", "1");
        // ★ dir=auto على الحاوية وحدها يحسم الاتجاه بأول حرف قويّ في الرسالة كلها،
        // فردٌّ يبدأ بالإنجليزية ثم يسترسل بالعربية يُعرض كله LTR وفقراته العربية
        // بمحاذاة يسارية. الحسم لكل فقرة على حدة هو ما يجعل النص المختلط سليمًا.
        // ★ (ر5، ٢٦ ربيع الآخر ١٤٤٨هـ) والفقرة في مكوّنات Mintlify ‏<span data-as="p"> (التبويبات والخطوات والتنبيهات): سطريّةٌ
        // بوسمها فمالكُ كتلتها لوحةُ التبويب كلُّها، وفيها أسماء التبويبات وأوامر التثبيت فتُحسم LTR وترثها الجملة العربية
        // بترقيمٍ مقلوب (فحص الاتجاه: 20 عنصرًا في الصفحة الرئيسة وصفحة overview لوثائق Claude Code). فتُحسم كل فقرةٍ وحدها
        var kids = Array.prototype.slice.call(el.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dd, dt, figcaption, span[data-as=\"p\"]"));
        // وأغلفة الكتل المباشرة (كتل Intercom تحمل محاذاتها على غلافها لا على الفقرة)
        for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (kids.indexOf(c) < 0) kids.push(c);
        // وخارج المحادثة: كلُّ مالك كتلةٍ ذي نص (ق٢) — المحادثة على حالها المقيس
        if (!CHAT_ON) dirOwnersIn(el, kids);
        // ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر6، F4) والغلاف الأبعد لكل جدولٍ معرَّب لا يحوي غيره: قاعدة الغلاف في setChatDir لا تُستدعى
        // إلا على ما في kids، وغلاف الجدول داخل أكورديون أو لوحة تبويب أو خطوات (details وrole=tabpanel و‎.steps‎) ليس ابنًا مباشرًا ولا مالك
        // كتلة، فيرث اتجاه حاويته (auto أو ltr) فيبقى الجدول المعرَّب LTR عموده الأول يسارًا (5 من 452 في صفحات Claude Code). وبشرط القاعدة
        // نفسها: قطعة الصفحة وصلت وتُكتب (shardOn)، وفي الجدول حرفٌ من كتابة لغة الهدف — فلا يمسّ جدولًا إنجليزيًّا ولا صفحةً بلا قطعة
        if (!CHAT_ON && BODIES_ON && bodyMap && !bodyPending && shardOn() && active && active.dir === "rtl") tableWrappersIn(el, kids);
        for (var q = 0; q < kids.length; q++) {
          if (kids[q].closest("pre, code")) continue; // الشيفرة تبقى LTR
          setChatDir(kids[q]);
          kids[q].setAttribute("data-cml-dir", "1");
        }
      } else if (el.getAttribute("data-cml-dir")) {
        restoreDir(el);
      }
    }
    // تنظيف الأبناء عند الإطفاء (السلكتور أعلاه لا يلتقطهم لأنهم ليسوا حاويات رسائل)
    if (!on && scope.querySelectorAll) {
      var marked = scope.querySelectorAll("[data-cml-dir]");
      for (var z = 0; z < marked.length; z++) restoreDir(marked[z]);
    }
  }

  // ---------- فحص تحديثات الموقع (يُطلب من صفحة الإعدادات عبر مفتاح تخزين) ----------
  // claude.ai مقسّم إلى مئات الملفات تُحمَّل بتسلسل عميق، فالزحف التكراري هو السبيل
  // الوحيد لرؤية كل النصوص. يعمل هنا لأننا داخل الصفحة (نفس الأصل) — بلا صلاحيات إضافية.
  // فكُّ الحرفيّات صار في cml-shared.js — نسخة واحدة للمحرك وأدوات التوليد (درس §7و)
  var CTRL_RE = new RegExp("[\\u0000-\\u001f\\u007f]");
  var unescapeLiteral = SHARED.unescapeLiteral;

  var scanning = false;
  var cancelScan = false;
  var SCAN_ID = String(Math.random()).slice(2) + "-" + Date.now(); // هوية هذا الإطار
  function setScan(o) { try { var w = {}; w[K_SCAN] = o; chrome.storage.local.set(w); } catch (e) {} }

  // طلب الفحص يُذاع إلى **كل** تبويبات وإطارات claude.ai. بلا تنسيق يزحف كلٌّ منها
  // زحفًا كاملًا (مئات الطلبات × عدد التبويبات) وتتضارب عدّاداتها في صفحة الإعدادات.
  // الحل: حجز بمفتاح مشترك — أول من يكتب هويته يفوز، والبقية تنسحب بصمت.
  function claimScan(cb) {
    if (window.top !== window) return cb(false); // الإطارات الداخلية لا تزحف أصلًا
    try {
      SESS.get(["cml_scan_claim"], function (s) {
        var c = s.cml_scan_claim;
        // حجز قديم (>90 ثانية) يُعدّ متروكًا — تبويب أُغلق في منتصف فحصه
        if (c && c.id && c.at && Date.now() - c.at < CONST.CLAIM_STALE_MS) return cb(false);
        SESS.set({ cml_scan_claim: { id: SCAN_ID, at: Date.now() } }, function () {
          // تأخير عشوائي قصير قبل التحقق: «اكتب ثم اقرأ» ليست عملية ذرّية، وتبويبان
          // أيقظهما البثّ نفسه قد تتداخل كتاباتهما فيرى كلٌّ هويته ويفوزان معًا. المهلة
          // تجعل آخر كاتب هو الفائز الوحيد، ويكمّلها فحص الملكية الدوري في step().
          setTimeout(function () {
            SESS.get(["cml_scan_claim"], function (s2) {
              cb(!!(s2.cml_scan_claim && s2.cml_scan_claim.id === SCAN_ID));
            });
          }, 120 + Math.floor(Math.random() * 180));
        });
      });
    } catch (e) { cb(false); } // تعطّل التخزين ⇒ لا حجز ⇒ لا زحف يتيم بلا تنسيق
  }
  function releaseScan() { try { SESS.set({ cml_scan_claim: null }); } catch (e) {} }
  // تجديد طابع الحجز أثناء الزحف: عتبة «المتروك» تسعون ثانية، والزحف الكامل يتجاوزها
  // بكثير — فبلا تجديد يصير الزاحفُ الحيّ متروكًا في نظر بقية التبويبات وصفحة الإعدادات.
  function touchClaim() { try { SESS.set({ cml_scan_claim: { id: SCAN_ID, at: Date.now() } }); } catch (e) {} }
  // ---------- تحكيم عامل الخدمة (المرحلة ٤ — الفحص 2.0) ----------
  // رسالة «طلب منحة» إلى معالجٍ أحاديِّ الخيط: أول طالبٍ يفوز والباقي يُرفض — لا
  // سباق بنيويًّا، ولا طوابع تقادم: المنحة حياتُها حياةُ منفذها (أُغلق التبويب ⇒
  // تحررت فورًا، لا انتظار 90ث). حجزُ التخزين القديم يبقى **طبقة سقوط** كاملةً حيث
  // لا عامل (قشور الاختبار — وبها تبقى اختبارات القفل الثمانية حارسةً لهذا المسار،
  // أو سياقٌ أبطله تحديث الإضافة، أو عاملٌ متعطل تجاوز مهلته).
  //
  // ★ «مقبضٌ» لكل منحة لا حالةٌ مشتركة (درس دحضٍ مؤكد): كان swPort/swMode مفردين
  // على مستوى الوحدة، فسقوطُ مهلةِ طلبٍ للطبيب يقلب swMode تحت زحف ترجمةٍ حيّ،
  // وتحريرُ الطبيب يقطع منفذَ الزحف فيُجهضه. الآن يرجع swClaim مقبضًا يملكه طالبُه
  // وحده — beat/alive/release كلها عليه، ومقبضُ الطبقة القديمة يوحّد الواجهة
  // (نبضُه هو تجديد الطابع وحياتُه هي مطابقة الهوية) فتختفي كل أوامر «إن كان الوضع».
  function swClaim(kind, cb, onLost) {
    var settled = false, timer = null, port = null;
    function legacyGrant() {
      return {
        legacy: true,
        beat: function () { touchClaim(); },
        alive: function (acb) {
          try {
            SESS.get(["cml_scan_claim"], function (s) {
              acb(!!(s.cml_scan_claim && s.cml_scan_claim.id === SCAN_ID));
            });
          } catch (e) { acb(true); }
        },
        release: function () { releaseScan(); },
      };
    }
    function fallback() {
      if (settled) return;
      settled = true;
      try { clearTimeout(timer); } catch (e) {}
      // اقطع المنفذ إن فُتح: منحةٌ متأخرة على منفذٍ شبح كانت ستحجب بقية التبويبات
      // حتى يُغلق تبويبُنا — والقطعُ يحرّرها في المحكّم فورًا.
      if (port) { try { port.disconnect(); } catch (e) {} port = null; }
      claimScan(function (won) { cb(won, won ? legacyGrant() : null); });
    }
    try {
      if (!chrome.runtime || typeof chrome.runtime.connect !== "function") return fallback();
      port = chrome.runtime.connect({ name: CONST.PORT_CRAWL });
      timer = setTimeout(fallback, 700); // عاملٌ لا يرد = معطّل ⇒ الطبقة القديمة
      var handle = null;
      port.onMessage.addListener(function (m) {
        if (settled || !m) return;
        if (m.type === "grant") {
          settled = true;
          try { clearTimeout(timer); } catch (e) {}
          handle = {
            legacy: false,
            dead: false,
            beat: function () { if (!handle.dead) { try { port.postMessage({ type: "beat" }); } catch (e) {} } },
            alive: function (acb) { acb(!handle.dead); },
            release: function () {
              if (handle.dead) return;
              handle.dead = true;
              try { port.postMessage({ type: "release" }); } catch (e) {}
              try { port.disconnect(); } catch (e) {}
            },
          };
          cb(true, handle);
        } else if (m.type === "deny") {
          settled = true;
          try { clearTimeout(timer); } catch (e) {}
          try { port.disconnect(); } catch (e) {}
          cb(false, null);
        }
      });
      port.onDisconnect.addListener(function () {
        if (!settled) { fallback(); return; } // العامل غير متاح أصلًا
        if (handle && !handle.dead) {
          // مات العامل أثناء المنحة (نادر): المقبض ميت — صاحبه يقرر الاسترداد
          handle.dead = true;
          if (onLost) onLost();
        }
      });
      port.postMessage({ type: "claim", kind: kind });
    } catch (e) { fallback(); }
  }
  // منحتا المسارين — كلٌّ يملك خانته وحده ولا يمسّ الأخرى
  var scanGrant = null;
  var rtlGrant = null;
  function dropScanGrant() { if (scanGrant) { scanGrant.release(); scanGrant = null; } }
  function dropRtlGrant() { if (rtlGrant) { rtlGrant.release(); rtlGrant = null; } }
  // استردادُ منحة الزحف بعد موت العامل — مُعاد التسليح ذاتيًّا (موتٌ ثانٍ كان يُيتم
  // الزحف بصمت)، ومع حارسي «ما زلنا نزحف؟» كي لا تُحتجز منحةٌ يتيمة بعد الانسحاب
  function lostScan() {
    if (!scanning) return;
    swClaim("scan", function (won, h) {
      if (!won) { cancelScan = true; return; }
      if (!scanning) { h.release(); return; }
      scanGrant = h;
    }, lostScan);
  }
  function lostRtl() {
    if (!rtlDocRunning) return;
    swClaim("rtl", function (won, h) {
      if (!won) return; // فقدناها لغيرنا: الطبيب قراءةٌ قصيرة — يكملها بلا منحة
      if (!rtlDocRunning) { h.release(); return; }
      rtlGrant = h;
    }, lostRtl);
  }

  // ★ الردّ الفوري (إشعار استلام). كان المحرّك يصمت في كل مسارات الرفض — إن كان مشغولًا،
  // أو خسر الحجز، أو تعطّل التخزين — فتنتظر صفحة الإعدادات عشرين ثانية ثم تقول «لم يستجب
  // أي تبويب». وهي رسالة كاذبة: التبويب استجاب لكنه امتنع بصمت، فيضيع الفرق بين
  // «لا سكربت حيّ» و«سكربت حيّ امتنع» — وهو الفرق الذي يحدّد ما يفعله المستخدم.
  // فالآن: كل إطار عُلويٍّ يستلم الطلب يكتب إشعار استلام فورًا قبل أي شيء.
  function ackScan() {
    setScan({ status: "running", fetched: 0, found: 0, queued: 0, missing: 0, at: Date.now() });
  }
  function runScan() {
    if (!SCAN_APP && !SCAN_LLMS) return;        // موقعٌ بلا ماسح (يُحصد وقت البناء)
    if (window.top !== window) return;          // الإطارات الداخلية لا تفحص ولا تُشعِر
    // حارس المسار: صفحةٌ خاملة من المضيف (لوحة المطوّرين خارج الوثائق) لا تفحص ولا تُشعِر —
    // فلا تُحسب «تبويب الموقع المفتوح»، وتقول صفحةُ الإعدادات افتح صفحةً من مساره
    if (routeMode() === "inactive") return;
    if (!active) return;                        // لا قاموس ⇒ لا معنى للفحص
    if (scanning) { ackScan(); return; }        // نفحص فعلًا: طمئنها بدل الصمت
    ackScan();
    swClaim("scan", function (won, h) {
      if (won) { scanGrant = h; return SCAN_LLMS ? doLlmsScan() : doScan(); }
      // خسرنا الحجز: إمّا فحصٌ حيّ في تبويب آخر (وسيكتب نتيجته ويدهس إشعارنا)، وإمّا
      // حجزٌ عالق. ننتظر قليلًا، فإن لم يظهر تقدّمٌ من غيرنا صرّحنا بالسبب بدل تركه غامضًا.
      setTimeout(function () {
        try {
          chrome.storage.local.get([K_SCAN], function (s) {
            var r = s[K_SCAN];
            if (r && r.status === "running" && r.fetched > 0) return; // غيرُنا يعمل فعلًا
            if (r && r.status !== "running") return;                  // غيرُنا أنهى أو أخطأ
            setScan({ status: "error", error:
              "يبدو أن فحصًا آخر ما زال محجوزًا. إن لم يكن ثمة تبويبٌ آخر يفحص الآن، فاضغط «إيقاف» ثم «بدء الفحص» من جديد." });
          });
        } catch (e) {}
      }, 3000);
    }, lostScan);
  }
  function doScan() {
    if (scanning) return;
    scanning = true;
    // طلب الإلغاء يُذاع لكل التبويبات، لكن التصفير لا يقع إلا داخل abort/finish — أي في
    // التبويب الفاحص وحده. فتبويب لم يكن يفحص يحتفظ بالعلم مرفوعًا ويُجهض أول فحص يفوز به.
    cancelScan = false;
    var t0 = Date.now();
    // ★ النبض `at` لازم في **كل** تحديث «جارٍ» بلا استثناء. كان أول تحديث بلا نبض،
    // فإن مات الفحص بعده مباشرة (أُغلق التبويب، أُعيد تحميل الإضافة) بقيت في التخزين
    // نتيجةُ «running» بلا نبض إلى الأبد — وصفحة الإعدادات تعطّل زر البدء في هذه الحالة
    // ولا تعرض مخرجًا إلا بنبضٍ متقادم، فيصير الفحص مقفلًا لا يبدأ أبدًا.
    setScan({ status: "running", fetched: 0, found: 0, missing: 0, at: Date.now() });
    (function () {
      var scripts = [];
      var els = document.querySelectorAll("script[src]");
      for (var i = 0; i < els.length; i++) scripts.push(els[i].src);
      // بعض البنى تعلن ملفاتها بروابط تحميل مسبق لا بوسم script، فلا تُرى بدون هذا
      var links = document.querySelectorAll("link[rel='modulepreload'][href], link[rel='preload'][as='script'][href]");
      for (var i2 = 0; i2 < links.length; i2++) scripts.push(links[i2].href);

      // ★ اختيار ملف الدخول على مراحل. الاشتراط الصارم (مسار ‎/assets/v1/‎ حرفيًّا **و**
      // أصل الصفحة نفسه) كان يُفشل الفحص كليًّا متى غيّر الموقع مسار أصوله أو قدّمها من
      // نطاق فرعي — ورسالة «افتح صفحة claude.ai» تُوهم أن العلة عند المستخدم لا عندنا.
      // نتدرّج: أصلُنا ومسارٌ معروف ← عائلة claude.ai ← أي ملف حزمة مُبصَّم من أصلنا.
      // ويبقى الوعد محفوظًا: لا نقبل أصلًا خارج نطاق الموقع مهما كان مسار السكربت.
      function urlOf(u) { try { return new URL(u, location.href); } catch (e) { return null; } }
      function ours(h) { return h === location.hostname || /(^|\.)claude\.ai$/.test(h) || /(^|\.)anthropic\.com$/.test(h); }
      var HASHED = /\/[A-Za-z0-9_.]+-[A-Za-z0-9_-]{6,}\.[cm]?js(\?|$)/;
      function pickBy(test) {
        for (var pass = 0; pass < 2; pass++) {          // 0: أصل الصفحة  1: عائلة claude.ai
          for (var j = 0; j < scripts.length; j++) {
            var u = urlOf(scripts[j]);
            if (!u) continue;
            if (pass === 0 ? u.origin !== location.origin : !ours(u.hostname)) continue;
            if (test(u)) return u;
          }
        }
        return null;
      }
      var pick = pickBy(function (u) { return /\/assets\/v\d+\//.test(u.pathname); })
              || pickBy(function (u) { return HASHED.test(u.pathname); });
      if (!pick) {
        var origins = {};
        for (var q = 0; q < scripts.length; q++) { var uq = urlOf(scripts[q]); if (uq) origins[uq.origin] = 1; }
        scanning = false; dropScanGrant();
        // ★ (ر9-أ) بصيغةٍ غير شخصية كسائر رسائل المحرّك («تعذّر…»)، والتحديث الكامل Ctrl+Shift+R كما في الإضافة كلها
        setScan({ status: "error", error:
          "تعذّر العثور على ملفات الموقع في هذه الصفحة. تأكّد أنك في تبويب claude.ai وأن الصفحة اكتمل تحميلها، ثم حدّثها (Ctrl+Shift+R) وأعد الفحص." +
          " [تشخيص: عدد الملفات " + scripts.length + " · الأصول: " + (Object.keys(origins).join("، ") || "لا شيء") + " · الصفحة: " + location.origin + "]" });
        return;
      }
      var base = pick.href.slice(0, pick.href.lastIndexOf("/") + 1);
      // ‎(?![\w.])‎: اسمٌ مثل «x-abcdef.json» (رسوم Lottie) كان يُقتطع «x-abcdef.js» فيُطلب ملفٌ لا وجود له (إشارةٌ وهمية)
      var REF = /[A-Za-z0-9_]+-[A-Za-z0-9_-]{6,}\.js(?![\w.])/g;
      var DM = /(?:"?defaultMessage"?):\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
      var seen = Object.create(null), queue = [], msgs = Object.create(null), fetched = 0, found = 0, failed = 0; // بلا نموذج: نصوص الموقع قد تكون «constructor»
      var GHOST = {};              // علامة 404: إشارة وهمية لا ملف — تُحصى ولا تُعدّ نقصًا
      var ghosts = 0, retryNames = [], retried = false;
      // ابذر الطابور بكل ملف يقع تحت القاعدة المكتشفة (لا تحت مسارٍ ثابتٍ مفترض)
      for (var k = 0; k < scripts.length; k++) {
        var uk = urlOf(scripts[k]);
        if (!uk || uk.href.indexOf(base) !== 0) continue;
        var f = uk.href.slice(base.length);
        if (f && !seen[f]) { seen[f] = 1; queue.push(f); }
      }
      // معالجة ملف واحد ثم إفساح المجال للصفحة. الملفات قد تبلغ ميغابايتات، ومعالجة
      // ثلاثين منها في مهمة واحدة تجمّد الواجهة مئات المللي ثانية في كل دفعة —
      // والمستخدم قد يكون يقرأ ردّ كلود في التبويب نفسه. التوازي 6 لا 30 لئلا يزاحم
      // الفحصُ تدفّقَ المحادثة على الاتصال نفسه.
      var PARALLEL = CONST.SCAN_PARALLEL;
      function scanOne(tx) {
        fetched++;
        var refs = tx.match(REF) || [];
        for (var b = 0; b < refs.length; b++) if (!seen[refs[b]]) { seen[refs[b]] = 1; queue.push(refs[b]); }
        var m;
        DM.lastIndex = 0;
        while ((m = DM.exec(tx))) {
          // ★★ فكُّ ترميزٍ حقيقي. كان الفكّ لا يعالج إلا \" و\' ثم **يرمي** كل نصّ بقي
          // فيه \u أو \x. وأدوات الحزم ترمّز كل محرف غير ASCII هكذا — فكان الفحص أعمى
          // عن **فئة محارف كاملة**: كل نصّ فيه فاصلة عليا مطبعية (’) أو شرطة طويلة (—)
          // أو نقاط حذف (…) يُرمى برمّته. وقياسًا على كتالوج الموقع: 16% من نصوص الواجهة.
          // وهذا هو السبب الجذري لِما يراه المستخدم على الشاشة غير مترجَم ولا يظهر في
          // نتيجة الفحص أبدًا. (العلة نفسها كانت في harvest-all-strings.js فحُرم القاموس
          // منها منذ البداية — وما تُرجم منها إنما جاء من حزمة سطح المكتب.)
          var s = unescapeLiteral(m[1] != null ? m[1] : m[2], m[1] == null);
          if (s === null) continue;                       // تعذّر الفكّ ⇒ تجاهُل، لا نصّ مشوّه
          s = s.replace(/\s+/g, " ").trim();
          if (!s || s.length < 2 || s.length > CONST.TEXT_MAX) continue;
          if (!/[A-Za-z]/.test(s)) continue;
          if (CTRL_RE.test(s)) continue;                  // محارف تحكّم: صار الفكّ يقبلها
          if (/^[#\/]|^\d|https?:|www\.|[@\\^~`|=]/.test(s) || /^[a-z]+([A-Z][a-z]+)+$/.test(s) || (/_/.test(s) && !/ /.test(s))) continue;
          // كتل ICU (جمع/اختيار) خارج نطاق التوليد التلقائي — تحتاج فئات العربية الست
          if (/\{[^{}]*,\s*(plural|select|selectordinal)\s*,/.test(s)) continue;
          if (/<\/?[A-Za-z][^>]*>/.test(s)) continue; // وسوم HTML داخل النص
          // نقبل الآن النصوص ذات المتغيّرات {name} — تُحوَّل إلى أنماط عند الاستيراد
          if (/\{/.test(s) && !/^[^{}]*(\{[A-Za-z_$][\w$]*\}[^{}]*)+$/.test(s)) continue;
          if (!msgs[s]) { msgs[s] = 1; found++; }
        }
      }
      // ★ التنازل بين الملفات. المشكلة: الفحص يجري في تبويب claude.ai بينما المستخدم في
      // تبويب الإعدادات — أي في تبويب **مخفيّ**. و`requestIdleCallback` لا تُنفَّذ أصلًا
      // ما دامت الصفحة مخفية (لا وقت خمول يُحتسب لها)، و`setTimeout` يُخنق إلى مرّة كل
      // ثانية. فالزحف كان يزحف زحفًا أو يقف. ورسائل المُرحِّل (MessageChannel) مهامٌّ
      // لا تخضع لخنق المؤقّتات، فهي السبيل الصحيح للتنازل في تبويب مخفيّ.
      // ولا نستعمل المهام الصغرى (Promise) هنا: سلسلةٌ منها لا تُفرَّغ فتَحرِم الشبكةَ
      // من فرصة تسليم ردودها فيتجمّد الزحف.
      var mcQueue = [], mc = null;
      try {
        mc = new MessageChannel();
        mc.port1.onmessage = function () { var f = mcQueue.shift(); if (f) f(); };
      } catch (e) { mc = null; }
      // ★ (مراجعة كودكس) سلسلة الزحف بلا معالج أخطاء: رميةٌ واحدة في معالجة ملف كانت توقف
      // الزحف صامتًا ومنحتُه محجوزة وحالُه «جارٍ» حتى يتقادم النبض. فكل خطوةٍ مؤجَّلة تمرّ
      // بحارس: الرميةُ تُنهي الفحص إنهاءً دائمًا يحرّر المنحة ويكتب خطأً صريحًا، وأي نداءٍ
      // متأخر بعد النهاية (dead) لا يكمل شيئًا.
      var dead = false;
      function fail(e) {
        if (dead) return;
        dead = true;
        scanning = false; cancelScan = false; dropScanGrant(); releaseResources();
        setScan({ status: "error", fetched: fetched, found: found,
          error: "تعذّر إكمال الفحص بسبب خطأ داخلي (" + String((e && e.message) || e).slice(0, 160) + "). أعد الفحص؛ وإن تكرّر فأبلغ عنه." });
      }
      function guard(fn) { return function () { if (dead) return; try { fn(); } catch (e) { fail(e); } }; }
      var yieldTo = function (fn0) {
        var fn = guard(fn0);
        // scheduler.yield (كروم 129+): مهامه لا تُخنق في التبويب المخفي — كالحيلة أدناه
        // تماماً بحسب وثيقة مجدول Blink، لكنه ليس Baseline (لا Safari) والسلوك موثَّق لا
        // مضمونٌ بمواصفة — فمسار MessageChannel يبقى احتياطاً شرطاً لا ترفاً.
        if (typeof scheduler !== "undefined" && typeof scheduler.yield === "function") {
          scheduler.yield().then(fn, function () { setTimeout(fn, 0); });
          return;
        }
        if (document.hidden && mc) { mcQueue.push(fn); mc.port2.postMessage(0); return; }
        if (window.requestIdleCallback) { window.requestIdleCallback(fn, { timeout: 200 }); return; }
        setTimeout(fn, 0);
      };
      var ownCheck = 0;
      function step() {
        if (cancelScan) return abort();
        if (!queue.length) {
          // جولة إعادة واحدة لإخفاقات الشبكة الحقيقية قبل الحكم بالنقص
          if (retryNames.length && !retried) {
            retried = true;
            queue = retryNames;
            retryNames = [];
            return stepNow();
          }
          failed = retryNames.length;
          return finish();
        }
        // تحقّق من ملكية الحجز كل عشر دفعات: إن مسحه بدءُ فحصٍ جديد أو فاز به تبويب آخر
        // فانسحب بدل مواصلة زحفٍ موازٍ تتداخل كتاباته مع الزاحف الفائز.
        if (++ownCheck % 10 === 0) {
          var g = scanGrant;
          return (g ? function (f) { g.alive(f); } : function (f) { f(true); })(function (ours) {
            if (!ours) {
              // فقدنا الملكية (سحبها بدءُ فحصٍ جديد أو خسرنا الاسترداد): انسحب بصمت —
              // فمن أخذها يكتب النتائج — لكن نظّف الموارد (الانسحاب القديم كان يسرّبها)
              dead = true; scanning = false; cancelScan = false; releaseResources();
              return;
            }
            guard(stepNow)(); // نداءٌ من منفذ العامل: خارج أي حارسٍ آخر
          });
        }
        stepNow();
      }
      function stepNow() {
        var batch = queue.splice(0, PARALLEL);
        Promise.all(batch.map(function (n) {
          // ★ `fetch` لا ترفض عند 404 ولا 500 — فكان جسمُ صفحة الخطأ يُمرَّر إلى scanOne
          // فيُحسب «ملفًا مفحوصًا» بلا نصوص. ثم فُصل الإخفاق صنفين (تشخيص حي 2026-09-04
          // على 2133 ملفًا: «المتعذرات» الـ32 كلها 404 دائمة):
          //  - 404 = «إشارة وهمية»: المعبّرُ يلتقط من نصوص الحزم أسماءً تشبه الملفات
          //    (أسماء عمال بمسارات أخرى، وأسماء ملفات أمثلة داخل رسائل مصرِّف مضمّنة،
          //    وملفات خارجية) — ليست ملفات موقع أصلًا، وإعادةُ الفحص لن «تصلحها» أبدًا،
          //    فعدُّها نقصًا كان إنذارًا كاذبًا بنيويًّا يوهم المستخدم أن النتيجة معيبة.
          //  - غيرُ 404 (شبكة/5xx): إخفاق حقيقي قابل للشفاء — يدخل جولةَ إعادةٍ واحدة،
          //    وما بقي بعدها هو «الناقص» المصرَّح به بحق.
          // مهلةٌ كالطبيب: جلبٌ لا يُحسم كان يُبقي المنحة محجوزةً والفحصَ مقفولًا بلا مخرج
          var ctrl = typeof AbortController === "function" ? new AbortController() : null;
          var tmo = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
          // ★ (ر8-ب) بلا بيانات اعتماد، كجلب عامل الخدمة للأوراق وجلب llms.txt: الحزم ملفاتٌ عامة لا تحتاج ملفات تعريف الارتباط، فلا
          // يحمل الطلب شيئًا من عند المستخدم ولو صارت الحزم من أصل الصفحة («ولا يُرسَل فيها شيءٌ من عندك» في «حول» — مراجعة ر8-أ، F15).
          // وحزم claude.ai في لقطة الموقع (sitecss/_manifest.json) من assets-proxy.anthropic.com، أصلٍ آخر لا تُرسَل إليه ملفات تعريف
          // الارتباط أصلًا (credentials الافتراضي same-origin)، فلا يتغيّر فيها شيء؛ ويمتحنه _scantest على خادمٍ من أصل الصفحة
          return fetch(base + n, { credentials: "omit", signal: ctrl ? ctrl.signal : undefined })
            .then(function (r) { clearTimeout(tmo); return r.ok ? r.text() : (r.status === 404 ? GHOST : null); })
            .catch(function () { clearTimeout(tmo); return null; });
        })).then(guard2, fail);
        function guard2(texts) { if (dead) return; try { chewAll(texts); } catch (e) { fail(e); } }
        function chewAll(texts) {
          var a = 0;
          (function chew() {
            if (cancelScan) return abort();
            if (a >= texts.length) {
              // التقدّم = المعالَج ÷ (المعالَج + المتبقي)؛ الطابور ينمو أثناء الزحف فهو تقديري
              // at = نبض: صفحة الإعدادات تستدلّ به على تعثّر الفحص (تبويب أُغلق مثلًا)
              setScan({ status: "running", fetched: fetched, found: found, queued: queue.length, missing: 0, at: Date.now() });
              if (scanGrant) scanGrant.beat(); // الزحف الكامل يتجاوز 200 ثانية، وحجزٌ بطابعٍ قديم يُعدّ متروكًا
              return yieldTo(step);
            }
            if (texts[a] === null) retryNames.push(batch[a]);
            else if (texts[a] === GHOST) ghosts++;
            else scanOne(texts[a]);
            texts[a] = null; // حرّر النص فورًا بدل احتجاز الدفعة كلها
            a++;
            yieldTo(chew); // ملف واحد لكل مهمة
          })();
        }
      }
      // تحرير موارد الزحف. مُرحِّل الرسائل (MessageChannel) يبقى حيًّا ما بقيت الصفحة إن
      // لم يُغلق، ومعه طابور المهام وخريطة الملفات المرئية — فكل فحص يترك أثره في الذاكرة
      // إلى الأبد. والصفحة هنا تبقى مفتوحة ساعاتٍ، وقد يُعاد الفحص مرارًا.
      function releaseResources() {
        if (mc) {
          try { mc.port1.onmessage = null; mc.port1.close(); mc.port2.close(); } catch (e) {}
          mc = null;
        }
        mcQueue.length = 0;
        queue.length = 0;
        seen = null;
      }
      function abort() {
        dead = true;
        scanning = false; cancelScan = false; dropScanGrant(); releaseResources();
        setScan({ status: "cancelled", fetched: fetched, found: found });
      }
      function finish() {
        var c = classifyMissing(msgs);
        dead = true;
        scanning = false;
        cancelScan = false;
        dropScanGrant();
        releaseResources();
        setScan({
          status: "done", fetched: fetched, found: found, capped: c.capped,
          failed: failed,                   // إخفاق شبكي حقيقي بقي بعد جولة الإعادة — نقصٌ بحق
          ghosts: ghosts,                   // إشارات وهمية (404): ليست ملفات موقع — لا نقص فيها
          missing: c.missing,               // الحقيقي (قد يفوق المعروض عند القصّ)
          kept: c.kept,                     // ★ (ر8-د) ما عُدّ مغطًّى لأنه يبقى بالإنجليزية بقاعدة النطاق (L10N.keep)
          shown: c.plain.length + c.vars.length, // المعروض في القائمتين
          list: c.plain, varList: c.vars,
          at: Date.now(), seconds: Math.round((Date.now() - t0) / 1000),
        });
      }
      guard(step)();
    })();
  }

  // تصنيف ما وجده الفحص: نص ثابت (مطابقة حرفية) مقابل نص فيه متغيّرات (يصير نمطًا)، وما يترجمه
  // القاموس أو تصحيحات المستخدم أو جموعه أو قواعده يُسقط — نسخةٌ واحدة للماسحَين
  // ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ — N6) وما يبقى بالإنجليزية بقاعدة النطاق (L10N.keep: نصوص keep-en.json المتتبَّعة يشحنها البناء)
  // مغطًّى كذلك لا «غير مترجَم»: كان فحص الوثائق يعدّ أسماء النماذج والمنتجات ولغات البرمجة نقصًا (45 من 340 في فهرس ١ جمادى الأولى).
  // ويُعدّ مغطًّى لا صنفًا ثالثًا: الفحص يسرد ما يحتاج ترجمة، و«أمر الترجمة» يُبنى منه، فاسمٌ يبقى بالإنجليزية لا عمل فيه للمستخدم
  // (وكان سيُترجَم لو بقي في القائمة)؛ وعددُه في النتيجة (kept) لسطر الحال وحده
  var KEEP = null;
  function keptEn(s) {
    if (!KEEP) {
      KEEP = Object.create(null);
      var K = Array.isArray(L10N.keep) ? L10N.keep : [];
      for (var i = 0; i < K.length; i++) if (typeof K[i] === "string") KEEP[K[i]] = 1;
    }
    return KEEP[s] === 1;
  }
  function coveredText(s) {
    return active.strings[s] !== undefined || active.overrides[s] !== undefined || tryPlural(s) !== null || tryPatterns(s) !== null;
  }
  // ★ (ر8-د — N6) شارةٌ في آخر العنوان بين قوسين من قائمةٍ مغلقة (CONST.LLMS_BADGES): « (Beta)» يكتبها فهرس الصفحات بعد عناوين مرجع
  // الواجهة البرمجية والموقع يعرض العنوان بلا لاحقة (292 من 340 في فهرس ١ جمادى الأولى). يُرجع الأصلَ بلا الشارة، وإلا null
  // ★ (ر8-د، المراجعة) والمطابقة بحروف الشارة كما في القائمة (« (beta)» بالصغيرة نصٌّ من العنوان الظاهر لا شارة — cml-const.js)
  var BADGES = Array.isArray(CONST.LLMS_BADGES) ? CONST.LLMS_BADGES : [];
  function badgeBase(s) {
    var m = / \(([^()]+)\)$/.exec(s);
    if (!m || BADGES.indexOf(m[1]) < 0) return null;
    var b = s.slice(0, m.index).replace(/\s+$/, "");
    return b.length >= 2 ? b : null;
  }
  // opts.badges: الماسح يعرف شارات العناوين (فهرس الصفحات وحده). ما لا يغطّيه القاموس كاملًا ويغطّيه بأصله بلا الشارة — ترجمةً أو
  // إبقاءً — مغطًّى؛ وإلا يبقى في القائمة بنصّه كما في الفهرس
  function classifyMissing(msgs, opts) {
    var plain = [], vars = [], nKept = 0, nBadge = 0, withBadges = !!(opts && opts.badges);
    for (var s in msgs) {
      if (coveredText(s)) continue;
      if (keptEn(s)) { nKept++; continue; }
      var b = withBadges ? badgeBase(s) : null;
      if (b !== null && (coveredText(b) || keptEn(b))) { nBadge++; if (keptEn(b) && !coveredText(b)) nKept++; continue; }
      if (/\{[A-Za-z_$][\w$]*\}/.test(s)) vars.push(s); else plain.push(s);
    }
    plain.sort(); vars.sort();
    // ★ العدد الحقيقي **قبل** القصّ: نسبة التغطية في صفحة الإعدادات تُحسب من `missing`،
    // فلو حُسبت من المقصوص كذبت متى تجاوز غيرُ المترجَم السقف — تقول «4000 غير مترجَم»
    // وهي في الحقيقة أكثر، فتظهر التغطية أفضل مما هي. القائمتان تُقصّان (حمايةً للتخزين)
    // أما العدّ فيبقى صادقاً.
    var missingTotal = plain.length + vars.length, capped = false, CAP = CONST.SCAN_CAP;
    if (missingTotal > CAP) {
      capped = true;
      vars = vars.slice(0, Math.min(vars.length, Math.floor(CAP / 2)));
      plain = plain.slice(0, CAP - vars.length);
    }
    return { plain: plain, vars: vars, missing: missingTotal, capped: capped, kept: nKept, badge: nBadge };
  }

  // ---------- ماسح فهرس الصفحات (scan:"llms") — مواقع الوثائق ----------
  // مواقع الوثائق تنشر فهرسًا عامًّا لصفحاتها (llms.txt) على أصلها نفسه: روابطُ Markdown
  // «- [العنوان](الرابط)» تحت عناوين مجموعات («### …»). يقرؤه هذا الماسح مرّةً واحدة — ملفٌّ واحد
  // من أصل الصفحة كملفات التطبيق في فحص الحزم، بلا بيانات اعتماد ولا تحويلٍ إلى أصلٍ آخر — ويأخذ
  // عناوين الصفحات التي يعمل فيها حارس المسار، ومعها عناوين مجموعاتها، ثم يصنّفها بالقاموس كفحص
  // الحزم تمامًا ويكتب النتيجة بصيغتها نفسها (صفحة الإعدادات لا تفرّق بين الماسحين).
  var LLMS_ESC = /\\([\[\]()*_`\\])/g;
  function parseLlms(txt) {
    var out = Object.create(null), found = 0, pendingHeads = [];
    function add(t) {
      t = String(t || "").replace(LLMS_ESC, "$1").replace(/\s+/g, " ").trim();
      if (!t || t.length < 2 || t.length > CONST.TEXT_MAX || !/[A-Za-z]/.test(t) || CTRL_RE.test(t)) return;
      if (!out[t]) { out[t] = 1; found++; }
    }
    var lines = String(txt).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var h = /^#{3,6}\s+(.+?)\s*#*\s*$/.exec(ln);
      if (h) { pendingHeads.push(h[1]); continue; }
      if (/^#{1,2}\s/.test(ln)) { pendingHeads = []; continue; } // قسمٌ جديد (لغةٌ أخرى مثلًا)
      var m = /^\s*[-*+]\s*\[([^\]]+)\]\(([^)\s]+)[^)]*\)/.exec(ln);
      if (!m) continue;
      var u;
      try { u = new URL(m[2], location.href); } catch (e) { continue; }
      if (u.host !== location.host) continue;
      var path = u.pathname.replace(/\.md$/, "");
      if (SHARED.routeMode(META.routes, path) === "inactive") continue;
      // عنوان المجموعة يُحسب متى ضمّت صفحةً في المسار (فلا تدخل مجموعاتُ لغةٍ أخرى)
      for (var k = 0; k < pendingHeads.length; k++) add(pendingHeads[k]);
      pendingHeads = [];
      add(m[1]);
    }
    return { msgs: out, found: found };
  }
  function doLlmsScan() {
    if (scanning) return;
    scanning = true;
    cancelScan = false;
    var t0 = Date.now();
    var path = typeof META.llms === "string" && META.llms.charAt(0) === "/" ? META.llms : "/llms.txt";
    setScan({ status: "running", fetched: 0, found: 0, queued: 1, missing: 0, at: Date.now() });
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var tmo = setTimeout(function () { if (ctrl) ctrl.abort(); }, CONST.LLMS_FETCH_MS || 15000);
    var MAX = CONST.LLMS_MAX_BYTES || 2097152, BIG = "الملف أكبر من الحدّ";
    function end(o) {
      clearTimeout(tmo);
      scanning = false; cancelScan = false; dropScanGrant();
      setScan(o);
    }
    // ★ السقف على ما يُقرأ فعلًا، بايتًا بعد فكّ الضغط: رأسُ Content-Length يغيب في النقل المجزَّأ
    // ويعدّ المضغوط لا المفكوك، وr.text() يملأ الذاكرة بالملف كله قبل أي قياس. فالجسم يُقرأ دفعةً
    // دفعة ويُقطع الطلب متى تجاوز المجموعُ السقف؛ وحيث لا قارئَ تدفّق فالقياس بطول UTF-8 لا بطول النص
    function readCapped(r) {
      if (!r.body || typeof r.body.getReader !== "function" || typeof TextDecoder !== "function") {
        return r.text().then(function (t) {
          var n = typeof TextEncoder === "function" ? new TextEncoder().encode(t).length : t.length * 3;
          if (n > MAX) throw new Error(BIG);
          return t;
        });
      }
      var reader = r.body.getReader(), dec = new TextDecoder("utf-8"), parts = [], total = 0;
      return (function pump() {
        return reader.read().then(function (x) {
          if (x.done) { parts.push(dec.decode()); return parts.join(""); }
          total += x.value ? x.value.byteLength : 0;
          if (total > MAX) {
            try { reader.cancel().catch(function () {}); } catch (e) {}
            if (ctrl) { try { ctrl.abort(); } catch (e2) {} }
            throw new Error(BIG);
          }
          parts.push(dec.decode(x.value, { stream: true }));
          return pump();
        });
      })();
    }
    fetch(location.origin + path, { credentials: "omit", redirect: "error", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        var len = +(r.headers.get("content-length") || 0);
        if (len && len > MAX) throw new Error(BIG);   // طريقٌ مختصر حين يصدق الرأس
        return readCapped(r);
      })
      .then(function (txt) {
        if (cancelScan) { end({ status: "cancelled", fetched: 0, found: 0 }); return; }
        if (typeof txt !== "string" || !txt.length) throw new Error("ملفٌّ فارغ");
        var p = parseLlms(txt);
        if (!p.found) throw new Error("لا عناوين صفحاتٍ فيه");
        // ★ (ر8-د) الماسح يعرف شارات العناوين (« (Beta)» وأخواتها)، وما يبقى بالإنجليزية بقاعدة النطاق
        var c = classifyMissing(p.msgs, { badges: true });
        end({
          status: "done", source: "llms", fetched: 1, found: p.found, capped: c.capped, failed: 0, ghosts: 0,
          missing: c.missing, kept: c.kept, badge: c.badge, shown: c.plain.length + c.vars.length, list: c.plain, varList: c.vars,
          at: Date.now(), seconds: Math.round((Date.now() - t0) / 1000),
        });
      })
      .catch(function (e) {
        end({ status: "error", fetched: 0, found: 0, error:
          "تعذّرت قراءة فهرس الصفحات " + path + " من " + location.hostname + " (" + String((e && e.message) || e).slice(0, 120) +
          "). حدّث التبويب ثم أعد الفحص." });
      });
  }

  // ---------- «طبيب الاتجاه» (المرحلة ٣) — شقيق فحص الترجمة ----------
  // يجلب CSS الموقع الحيّ من داخل الصفحة (نفس أصل الفحص وقيوده)، يحلّله بالنسخة
  // الواحدة CMLRtl، ويقارن كل إعلان فيزيائي ببصمات التغطية المشحونة — فيكشف ما
  // استجدّ في نشرة الموقع ولا يقلبه rtl-overrides.css، تمامًا كما يكشف فحصُ
  // الترجمة النصوصَ غير المترجمة. يتشارك الحجز مع الفحص فلا يجريان معًا.
  var rtlDocRunning = false;
  function setRtlDoc(o) { try { var w = {}; w[K_RTLDOC] = o; chrome.storage.local.set(w); } catch (e) {} }
  function runRtlDoc() {
    if (!SCAN_APP) return;
    if (window.top !== window) return;
    if (routeMode() === "inactive") return;     // حارس المسار كالفحص
    var RTL = globalThis.CMLRtl, COV = globalThis.CMLRtlCoverage;
    if (!RTL || !COV || !COV.keys) {
      setRtlDoc({ status: "error", error: "ملفات محرّك الاتجاه غير محمّلة — أعد تحميل التبويب بعد تحديث الإضافة." });
      return;
    }
    if (rtlDocRunning) { setRtlDoc({ status: "running", fetched: 0, at: Date.now() }); return; }
    setRtlDoc({ status: "running", fetched: 0, at: Date.now() }); // إشعار استلام فوري — كالفحص
    swClaim("rtl", function (won, h) {
      if (won) { rtlGrant = h; return doRtlDoc(RTL, COV); }
      // خاسر الحجز لا يكتب الخطأ فورًا: الطلب يُذاع لكل التبويبات، والكتابة العمياء
      // كانت تدهس إشعارَ الفائز فتظهر «فحص آخر يعمل» طوالَ فحصٍ يعمل فعلًا (دُحض
      // تجريبيًّا بتبويبين). ننتظر ثم لا نكتب إلا إن لم يظهر أثرٌ حيّ من غيرنا.
      setTimeout(function () {
        try {
          chrome.storage.local.get([K_RTLDOC], function (s) {
            var r = s[K_RTLDOC];
            if (r && r.status === "running" && r.at && Date.now() - r.at < 20000) return; // فائز حيّ
            if (r && r.status !== "running") return; // أنهى أو أخطأ — نتيجته أولى
            setRtlDoc({ status: "error", error: "يبدو أن فحصًا آخر محجوز (الترجمة أو الاتجاه). إن لم يكن ثمة فحص يعمل فعلًا فأعد المحاولة بعد لحظات." });
          });
        } catch (e) {}
      }, 3000);
    }, lostRtl);
  }
  function doRtlDoc(RTL, COV) {
    rtlDocRunning = true;
    var t0 = Date.now();
    var covSet = {};
    for (var c = 0; c < COV.keys.length; c++) covSet[COV.keys[c]] = 1;

    function urlOk(u) {
      try {
        var p = new URL(u, location.href);
        if (p.protocol !== "https:" && p.protocol !== "http:") return null; // أوراقنا chrome-extension تُستبعد هنا
        var h = p.hostname;
        if (h === location.hostname || /(^|\.)claude\.ai$/.test(h) || /(^|\.)anthropic\.com$/.test(h)) return p.href;
      } catch (e) {}
      return null;
    }
    var urls = [];
    var links = document.querySelectorAll("link[rel='stylesheet'][href]");
    for (var i = 0; i < links.length; i++) {
      var ok = urlOk(links[i].href);
      if (ok && urls.indexOf(ok) === -1) urls.push(ok);
    }
    // ★ (ر8-ب) بلا بيانات اعتماد كالحزم في فحص الترجمة وكعامل الخدمة حين يبني الورقة الحيّة من هذه الأوراق نفسها: ملفات تصميمٍ عامة لا
    // تحتاج ملفات تعريف الارتباط (مراجعة ر8-أ، F15). وأوراق claude.ai في لقطة الموقع (sitecss/_manifest.json) كلها من
    // assets-proxy.anthropic.com فلا يتغيّر فيها شيء؛ ويمتحنه _scantest
    function fetchCss(u) {
      return Promise.race([
        fetch(u, { credentials: "omit" }).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; }),
        new Promise(function (res) { setTimeout(function () { res(null); }, 15000); }),
      ]);
    }
    Promise.all(urls.map(fetchCss)).then(function (texts) {
      // نبض بعد جولة الجلب الأولى + تجديد الحجز: أسوأ حالات الجلب (مهلتان ×15ث)
      // تقارب عتبة التعثر 45ث — وبلا نبضٍ يظهر الفحصُ الحيُّ متعثرًا لصفحة الإعدادات
      setRtlDoc({ status: "running", fetched: urls.length, at: Date.now() });
      if (rtlGrant) rtlGrant.beat();
      // مستوى واحد من @import (نادر لكنه موجود في أنظمة التصميم)
      var extra = [];
      for (var t = 0; t < texts.length; t++) {
        if (texts[t] === null) continue;
        var im = RTL.parseCss(texts[t]).imports;
        for (var m = 0; m < im.length; m++) {
          var r2 = urlOk(new URL(im[m], urls[t]).href);
          if (r2 && urls.indexOf(r2) === -1 && extra.indexOf(r2) === -1) extra.push(r2);
        }
      }
      return Promise.all(extra.map(fetchCss)).then(function (more) { return texts.concat(more); });
    }).then(function (texts) {
      setRtlDoc({ status: "running", fetched: texts.length, at: Date.now() }); // نبض قبل التحليل
      if (rtlGrant) rtlGrant.beat();
      // أوراق <style> الحرجة المضمّنة في الصفحة تُحلَّل مجانًا (بلا جلب)
      var styles = document.querySelectorAll("style:not([data-cml])");
      var inlineTexts = [];
      for (var s = 0; s < styles.length; s++) inlineTexts.push(styles[s].textContent || "");
      var failed = 0, rulesN = 0, physical = 0, covered = 0, animatedPhysical = 0;
      var uncovered = [], unflippable = [], localSeen = {};
      function chewSheet(tx) {
        if (tx === null) { failed++; return; }
        var p = RTL.parseCss(tx);
        animatedPhysical += p.stats.animatedPhysical || 0;
        for (var r = 0; r < p.rules.length; r++) {
          var rule = p.rules[r];
          rulesN++;
          if (rule.sel.indexOf("data-cml") !== -1) continue;               // مخرجاتنا
          if (/\[dir\s*[=\]]|:dir\(/.test(rule.sel)) continue;             // واعٍ بالاتجاه
          for (var d = 0; d < rule.decls.length; d++) {
            var a = RTL.analyzeDecl(rule.decls[d].prop, rule.decls[d].value);
            if (!a || a.kind === "logical") continue;
            physical++;
            if (a.kind === "physical-unflippable") {
              if (unflippable.length < 50) unflippable.push({ sel: rule.sel.slice(0, 120), prop: rule.decls[d].prop, reason: a.reason });
              continue;
            }
            var key = RTL.coverageKey(rule.ctx, rule.sel, rule.decls[d].prop);
            if (localSeen[key]) continue;
            localSeen[key] = 1;
            if (covSet[key]) { covered++; continue; }
            if (uncovered.length < CONST.RTLDOC_CAP) {
              uncovered.push({ sel: rule.sel.slice(0, 120), prop: rule.decls[d].prop, value: rule.decls[d].value.slice(0, 80) });
            }
          }
        }
      }
      for (var x = 0; x < texts.length; x++) chewSheet(texts[x]);
      for (var y = 0; y < inlineTexts.length; y++) chewSheet(inlineTexts[y]);
      // جولة على الأنماط السطرية — عدٌّ للتصريح فقط، فمبدؤنا ألّا تُمسّ
      var INLINE_RE = /(?:^|;)\s*(left|right|margin-left|margin-right|padding-left|padding-right|float|clear)\s*:/;
      var inlinePhysical = 0;
      var styled = document.querySelectorAll("[style]");
      var lim = Math.min(styled.length, 4000);
      for (var e = 0; e < lim; e++) {
        var sv = styled[e].getAttribute("style");
        if (sv && INLINE_RE.test(sv)) inlinePhysical++;
      }
      dropRtlGrant();
      rtlDocRunning = false;
      setRtlDoc({
        status: "done",
        files: urls.length, failed: failed, rules: rulesN,
        physical: physical, covered: covered,
        // العدّ الحقيقي قبل القصّ (عقد الفحص نفسه: القائمة تُقصّ والعدّ يصدق)
        uncovered: Object.keys(localSeen).length - covered,
        shown: uncovered.length,
        list: uncovered, unflippable: unflippable,
        animatedPhysical: animatedPhysical, // حركات اتجاهية — تُبلَّغ ولا تُقلب (قرار)
        inlinePhysical: inlinePhysical, inlineChecked: lim,
        shipped: COV.keys.length,
        at: Date.now(), seconds: Math.round((Date.now() - t0) / 1000),
      });
    }).catch(function (e) {
      dropRtlGrant();
      rtlDocRunning = false;
      setRtlDoc({ status: "error", error: "تعذّر فحص الاتجاه: " + (e && e.message ? e.message : e) });
    });
  }

  // ---------- جزيرة المواضع المحسوبة (بعد دحضٍ على الموقع الحيّ) ----------
  // مؤشرُ الشرائح المنزلق في claude.ai عنصرٌ `absolute left-0 origin-left` يحرّكه
  // الموقع بـtransform يحسبه من **اليسار**. وقلبُنا مرساتَه (left → inset-inline-start
  // = يمين في RTL) يجعل حسابَه يقذفه إلى القرص الخطأ — وهو بعينه ما شوهد حيًّا.
  // العلاج بمبدئنا نفسه: ما يُموضِعه الموقعُ بحسابه لا نمسّ مرساته. والتوقيع موزَّع
  // على أصناف عدة فلا يُلتقط من CSS، فيوسَم وقت التشغيل: مطلقٌ + ينتقل/يتغيّر
  // تحويلُه. مرشَّحون قلائل بمحدِّدٍ رخيص، وبسقفٍ يمنع أي كلفة على صفحاتٍ ضخمة.
  var COMPUTED_SEL = '[class*="origin-"],[class*="translate-x"],[style*="translate"]';
  function markComputedSurfaces(root) {
    if (!state.enabled || !state.rtl || state.rtlEngine === "v1") return;
    var scope = (root && root.querySelectorAll) ? root : document;
    var list;
    try { list = scope.querySelectorAll(COMPUTED_SEL); } catch (e) { return; }
    // الجذرُ نفسه قد يكون الموضعَ المحسوب (يُدرَج المؤشر عقدةً مفردة) — والاستعلام
    // لا يرى إلا الأحفاد، فكان يُفلت
    var self = [];
    try { if (scope.nodeType === 1 && scope.matches && scope.matches(COMPUTED_SEL)) self = [scope]; } catch (e) {}
    list = self.concat(Array.prototype.slice.call(list, 0, 300));
    var lim = list.length;
    for (var i = 0; i < lim; i++) {
      var el = list[i];
      if (el.hasAttribute("data-cml-noflip")) continue;
      var cs;
      try { cs = getComputedStyle(el); } catch (e) { continue; }
      if (cs.position !== "absolute" && cs.position !== "fixed") continue;
      var tp = cs.transitionProperty || "";
      var wc = cs.willChange || "";
      if (tp.indexOf("transform") === -1 && tp.indexOf("all") === -1 && wc.indexOf("transform") === -1) continue;
      // "computed" = استثناءُ المراسي وحده؛ ولا يُفرض عليه اتجاه (انظر ISLANDS_CSS)
      el.setAttribute("data-cml-noflip", "computed");
    }
  }
  // إيقافُ الترجمة أو المحرّك يرفع الوسم كما يرفع سائر أثرنا
  function unmarkComputedSurfaces() {
    var m = document.querySelectorAll('[data-cml-noflip="computed"]');
    for (var i = 0; i < m.length; i++) m[i].removeAttribute("data-cml-noflip");
  }

  function fullPass() {
    cacheEpoch++; // ★ (ر6-د) جذور المتن المخبوءة تُحسب من جديد قبل المرور
    applyChrome();
    loadBodies();
    // ★ (ر3، المراجعة المستقلة) جولةٌ كاملة تعيد تقدير كل كتلة (walk يبدأ newPass)، فتنبيه الوثائق القانونية يُكسب فيها من جديد:
    // كان يبقى بعد أن يمحو القارئ تصحيحه الوحيد في صفحةٍ بلا قطعة فوق متنٍ صار إنجليزيًّا كلُّه. والمحو والإعادة في مهمةٍ واحدة فلا وميض
    // ★ (ر7-ب) ولافتات صدى العناوين بعد المشي: اللافتة قد تسبق عنوانها في المستند
    if (state.enabled && active) { markBodyTr(false); judgeBody(); walk(document.body || document.documentElement); echoAll(); }
    else if (!state.enabled) restoreAll(); // أُوقفت الترجمة: أرجِع ما ترجمناه فورًا
    // الإيقاف يجب أن يرفع أثر الإضافة كاملًا: كان dir="auto" وdata-cml-dir يبقيان على
    // رسائل المحادثة بعد الإيقاف بلا سبيل لإزالتهما إلا بإعادة تحميل الصفحة.
    applyChatDir(document.body || document.documentElement);
    if (state.enabled && state.rtl && state.rtlEngine !== "v1") markComputedSurfaces(document);
    else unmarkComputedSurfaces();
    // عنوان التبويب يتبع الحال كلها (التشغيل ومفتاح الموقع والمسار وحارس اللغة وبوابة الترطيب واللغة والتصحيحات): يُترجم أو يُستعاد
    syncTitle();
  }

  // تنقّلٌ داخل المستند (تطبيقات الصفحة الواحدة): يُعاد تقييم الحارس عند كل تغيّرٍ في
  // العنوان — من مراقب الطفرات (التنقّل يرسم) ومن popstate وواجهة Navigation حيث وُجدت.
  // لا نعترض pushState في العالم المعزول: لا يرى نداءات عالم الصفحة أصلًا (مراجعة كودكس).
  var lastHref = location.href;
  function checkRoute() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    if (META.routes) {
      var was = state.enabled;
      refreshEnabled();
      if (was !== state.enabled || state.enabled) { if (active) fullPass(); }
    }
    loadBodies();
    // أوراق <style> في المتن تأتي مع الصفحة الجديدة بعد تبدّل العنوان (مكتبة الأوامر في وثائق Claude Code):
    // معاودتان للورقة الحيّة — والبصمة تمنع إعادة البناء إن لم يتغيّر شيء
    if (LIVE_ON) { setTimeout(applyLiveSheet, 1000); setTimeout(applyLiveSheet, 3500); }
  }
  function watchRoutes() {
    if (!META.routes && !BODIES_ON) return;
    window.addEventListener("popstate", function () { setTimeout(checkRoute, 0); });
    try {
      if (window.navigation && typeof window.navigation.addEventListener === "function") {
        window.navigation.addEventListener("navigatesuccess", function () { checkRoute(); });
      }
    } catch (e) {}
  }

  // ★ النافذة المنبثقة تسأل التبويب عن نطاقه (قرار المالك ق١: بالمراسلة، بلا إذنٍ جديد)؛
  // تسأل الإطار الأعلى وحده (frameId:0) والإطارات الداخلية لا تجيب
  try {
    if (chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
      if (msg && msg.type === "cml-block-at" && window.top === window) { respond(blockAtSelection()); return false; }
      if (!msg || msg.type !== "cml-hello" || window.top !== window) return false;
      // siteLang: لغةٌ غير الإنجليزية كتبها الموقع (حارس لغة الموقع) — فتقول النافذة لماذا الإضافة خاملة وكيف تعود
      respond({ domain: DOMAIN, route: state.route, enabled: state.enabled, master: state.master, site: state.site, text: textGate,
                siteLang: state.siteForeign ? state.siteLang : null,
                // (ر3) ومصدرُ الحكم: "html" إعداد الموقع، و"sel" منتقي اللغة في الصفحة (الوثائق القانونية) — لكلٍّ علاجُه في النافذة
                siteLangBy: state.siteForeign ? state.siteLangBy : null,
                // حال الخط في هذا التبويب (م٨ «لا إخفاء صامت»): البطاقة والنافذة تعرضانها
                font: F ? F.stats() : null,
                bodies: BODIES_ON ? { page: bodyPage, have: bodyMap ? Object.keys(bodyMap).length : 0, pending: bodyPending, bad: badBlocks,
                  // ★ (ر6-ب) حكم حارس المتن لهذه الصفحة: محجوبة؟ وعدد كتلها وغير المغطّى منها
                  // ★ (ر6-د) وسببه (why): "drift" لها قطعة و"none" لا قطعة لها — به تختار النافذة سطرها
                  guard: GUARD === null ? null : { judged: bodyJudged, held: bodyHeld, why: bodyWhy, blocks: bodyStat ? bodyStat.n : null, uncovered: bodyStat ? bodyStat.unc : null } } : null });
      return false;
    });
  } catch (e) {}

  function start() {
    loadBodies();
    watchRoutes();
    watchSiteLang(); // قبل مراقب التثبيت: المراقبات تُستدعى بترتيب إنشائها، فالحكم على اللغة يسبق أي تثبيت
    watchHtml();
    // ★ لا compile() هنا (مراجعة كودكس ٢٦): الإقلاع يركّب مرةً واحدة قبل applyChrome —
    // كان يركّب مرتين (قِيس: نحو ضعف كلفة تركيب الأنماط لكل إطار)
    // معاودةُ المحرّك الحيّ بعد وجود الأوراق فعلًا، ثم مراقبُ الرأس لما يستجدّ
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { watchHead(); watchTitle(); applyLiveSheet(); armTextGate(); }, { once: true });
    } else { watchHead(); watchTitle(); armTextGate(); }
    // <head> حاضرٌ قبل اكتمال التحليل غالبًا: مراقبة العنوان من الآن (والنداء الثاني عند DOMContentLoaded لا يكرّرها)
    watchTitle();
    window.addEventListener("load", applyLiveSheet, { once: true });
    // (ر3) ومنتقي اللغة في الصفحة (meta.siteLangSel) يُحكم قبل المرور الأول: عند document_start لم يُحلَّل بعد، وعند اكتمال التحليل
    // حاضرٌ إن رسمه الخادم (وبعده يحكمه مراقب الطفرات مع كل دفعة)
    var first = function () { if (LANG_SEL) judgeSiteLang(); fullPass(); };
    if (document.body) first();
    else document.addEventListener("DOMContentLoaded", first, { once: true });
    try {
      obs.observe(document.documentElement, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATTRS,
      });
    } catch (e) {}
    // مسحتان متأخرتان للمواضع المحسوبة: مكوّناتٌ تقيس نفسها بعد الترطيب فتكتب
    // نمطَها السطري متأخرًا بلا إدراج عقدةٍ جديدة — فلا حدثَ يوقظنا لها
    setTimeout(function () { markComputedSurfaces(document); }, 1200);
    setTimeout(function () { markComputedSurfaces(document); }, 4000);
  }

  // ---------- settings (chrome.storage) ----------
  // مفاتيح من بناءات ما قبل النشر لم تعد الإضافة تكتبها ولا تقرؤها. تُحذف مرّةً واحدة
  // من أجهزة من جرّب تلك البناءات، فلا يبقى في تخزينه ما لا تستعمله الإضافة.
  var UNUSED_KEYS = ["cml_collect", "cml_collected"];
  function purgeUnusedKeys() {
    try {
      chrome.storage.local.get(UNUSED_KEYS, function (r) {
        var found = UNUSED_KEYS.filter(function (k) { return r[k] !== undefined; });
        if (found.length) chrome.storage.local.remove(found);
      });
    } catch (e) {}
  }

  function loadSettings(cb) {
    try {
      // ★ قراءة get() الوحيدة عند document_start، ومعها الخط المختار ونسخته (كلفة IPC لا تتبع حجم الحمولة — §٤.٧)
      chrome.storage.local.get(["cml_lang", "cml_enabled", K_SITE, K_OV, K_PAT, K_BOV, "cml_rtl", "cml_chatrtl", "cml_rtl_engine", K_ENG_SITE,
                                K_FONT, K_FONT_DATA], function (r) {
        if (r.cml_lang) state.lang = r.cml_lang;
        state.fontChoice = r[K_FONT];
        state.fontData = r[K_FONT_DATA];
        state.master = r.cml_enabled !== false;
        state.site = r[K_SITE] !== false;
        refreshEnabled();
        if (r[K_OV]) state.overrides = r[K_OV];
        if (Array.isArray(r[K_PAT])) state.userPatterns = r[K_PAT];
        if (r[K_BOV] && typeof r[K_BOV] === "object") blockOv = r[K_BOV];
        if (typeof r.cml_rtl === "boolean") state.rtl = r.cml_rtl;
        if (typeof r.cml_chatrtl === "boolean") state.chatrtl = r.cml_chatrtl;
        state.engGlobal = r.cml_rtl_engine === "v1" ? "v1" : null; // كل ما عداها = v2 الافتراضي
        state.engSite = r[K_ENG_SITE] === "v1" || r[K_ENG_SITE] === "v2" ? r[K_ENG_SITE] : null;
        refreshEngine();
        purgeUnusedKeys();
        cb();
      });
    } catch (e) { cb(); }
  }
  try {
    chrome.storage.onChanged.addListener(function (ch, area) {
      // مفاتيح التنسيق (طلب/إلغاء الفحص) تصل على مساحة session — أو على local حيث
      // تسقط القشرة إليها. الإعدادات الدائمة على local وحدها.
      var scanArea = (SESS === chrome.storage.local) ? "local" : "session";
      if (area === scanArea) {
        // ★ الطلبات بنطاقها (مراجعة كودكس ٢٢): طلبٌ لنطاقٍ آخر يُتجاهل قبل أي إقرارٍ أو منحة؛
        // والقيمة العددية القديمة (بناءات ما قبل 2.0.0) للتطبيق
        if (ch.cml_scan_request && reqForMe(ch.cml_scan_request.newValue)) runScan(); // طلب فحص من صفحة الإعدادات
        if (ch.cml_scan_cancel && reqForMe(ch.cml_scan_cancel.newValue)) cancelScan = true;
        if (ch.cml_rtldoc_request && reqForMe(ch.cml_rtldoc_request.newValue)) runRtlDoc(); // طبيب الاتجاه
      }
      if (area !== "local") return;
      // ★ الخط خارج relevant (DESIGN-fonts §٥.٢): لا fullPass ولا مرور على DOM ولا font-ensure — الوحدة تستبدل
      // أوجهها حين تصل النسخة المطابقة، و«خط الموقع» يحذفها فورًا
      if (ch[K_FONT] || ch[K_FONT_DATA]) {
        if (ch[K_FONT]) state.fontChoice = ch[K_FONT].newValue;
        if (ch[K_FONT_DATA]) state.fontData = ch[K_FONT_DATA].newValue;
        fontApply();
      }
      var relevant = false, recompile = false;
      if (ch.cml_lang) { state.lang = ch.cml_lang.newValue || L10N.default; relevant = recompile = true; }
      if (ch.cml_enabled) { state.master = ch.cml_enabled.newValue !== false; refreshEnabled(); relevant = true; }
      if (ch[K_SITE]) { state.site = ch[K_SITE].newValue !== false; refreshEnabled(); relevant = true; }
      if (ch[K_OV]) { state.overrides = ch[K_OV].newValue || {}; relevant = recompile = true; }
      if (ch[K_PAT]) { state.userPatterns = ch[K_PAT].newValue || []; relevant = recompile = true; }
      if (ch[K_BOV]) { blockOv = ch[K_BOV].newValue || {}; relevant = true; }
      // ملاحظة: «إعادة الضبط» تحذف المفاتيح فتصل هنا newValue=undefined. الافتراض الصحيح
      // للـRTL هو التفعيل (كما في loadState وصفحة الإعدادات)، فلا يصح `=== true` هنا وإلا
      // انقلبت الصفحة المفتوحة إلى LTR بينما الإعدادات تعرضها مفعّلة.
      if (ch.cml_rtl) { state.rtl = ch.cml_rtl.newValue !== false; relevant = true; }
      if (ch.cml_chatrtl) { state.chatrtl = ch.cml_chatrtl.newValue !== false; relevant = true; }
      // كالـRTL تمامًا: الحذف (إعادة الضبط) يصل newValue=undefined والافتراض v2
      if (ch.cml_rtl_engine) { state.engGlobal = ch.cml_rtl_engine.newValue === "v1" ? "v1" : null; refreshEngine(); relevant = true; }
      if (ch[K_ENG_SITE]) {
        var ev = ch[K_ENG_SITE].newValue;
        state.engSite = ev === "v1" || ev === "v2" ? ev : null;
        refreshEngine(); relevant = true;
      }
      // التركيب لمدخلات القاموس وحدها (اللغة والتصحيحات والقواعد)؛ الاتجاه والتشغيل
      // لا يغيّران القاموس فلا يعيدان بناءه
      if (relevant) { if (recompile || !active) compile(); fullPass(); }
    });
  } catch (e) {}

  // immediate default (reduce RTL flash), then refine from storage
  // ★ كتابةٌ متفائلة بالافتراضات **قبل** قراءة الإعدادات — مقايضةٌ مقصودة لا سهو:
  // ★ نافذةُ الإقلاع بدل المقايضة: كنّا نكتب السمات بالافتراضات قبل قراءة الإعدادات،
  // فيرى من أطفأ الإضافة ومضةَ انقلابٍ ثم ارتدادًا في كل تحميل. والآن لا نكتب شيئًا
  // قبل الجواب، ونُخفي الصفحة في هذه الأجزاء من الثانية بسمةٍ نرفعها بعده — فلا ومضةَ
  // لأحد. (الإخفاء في base.css معلَّقٌ بهذه السمة نفسِها، فلا يقع بلا جافاسكربت عامل.)
  var bootEl = document.documentElement;
  var bootDone = false;
  function endBoot() {
    if (bootDone) return;
    bootDone = true;
    try { bootEl.removeAttribute("data-cml-boot"); } catch (e) {}
  }
  // حارس لغة الموقع: اللغة كما جاءت في الصفحة قبل أن نكتب شيئًا (الخادم قد يكتب اختيار المستخدم من البداية)
  if (SITE_LANG) {
    try {
      var bootLang = bootEl.getAttribute("lang");
      if (isForeignLang(bootLang)) {
        htmlForeign = true; htmlForeignV = bootLang; // (ر3) حكم <html lang> وحده، يجمعه judgeSiteLang مع منتقي الصفحة
        state.siteForeign = true; state.siteLang = bootLang; state.siteLangBy = "html"; refreshEnabled();
      }
    } catch (e) {}
  }
  // الحارس يسبق الإخفاء: مسارٌ خامل (أو موقعٌ بلغةٍ أخرى) لا يُخفى ولا يُمسّ (مراجعة كودكس ١٥)
  var bootIdle = state.route === "inactive" || state.siteForeign;
  if (!bootIdle) { try { bootEl.setAttribute("data-cml-boot", "1"); } catch (e) {} }
  // احتياطٌ لا يسقط: مهما أخفقت القراءة أو تأخّرت لا تبقى الصفحة مخفيّة
  setTimeout(endBoot, 400);
  if (!bootIdle) startHold(true);
  // تركيبٌ واحد بعد قراءة الإعدادات (اللغة والتصحيحات والقواعد) ثم السمات ثم فكّ الإخفاء
  // وفي المواقع ذات الترطيب المؤجَّل يبدأ الإمساك قبل فكّ نافذة الإقلاع فلا فجوة بينهما
  loadSettings(function () { compile(); applyChrome(); startHold(); endBoot(); start(); });
})();
