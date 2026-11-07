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
  // ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) نطاقٌ قادم (status.upcoming في جدول النطاقات — claude.com حتى CM-د): مطابقته في المانيفست ولا قاموس له بعد،
  // فالمحرّك خاملٌ تمامًا قبل أي لمسٍ للمستند — لا نافذة إقلاع (data-cml-boot) ولا إمساك ولا سمات ولا اتجاه ولا خط ولا عنوان ولا قراءة للإعدادات ولا
  // طلب قطعةٍ أو ورقةٍ من العامل — فلا يتغيّر شيءٌ مما يراه المستخدم في صفحاته. ويجيب النافذة وحدها بأنه قادم (فلا تقول «حدّث التبويب»).
  // والحكم من الجدول حيًّا (CONST.upcoming) لا من القاموس المبنيّ: صفٌّ واحد يشغّله في المحرّك والعامل والإعدادات معًا
  if (typeof CONST.upcoming === "function" && CONST.upcoming(DOMAIN)) {
    try {
      if (chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
        if (!msg || msg.type !== "cml-hello" || window.top !== window) return false;
        respond({ domain: DOMAIN, upcoming: true, enabled: false, route: "inactive" });
        return false;
      });
    } catch (e) {}
    return;
  }
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
  // ★ (ر20-أ، ١٢ جمادى الأولى ١٤٤٨هـ) وصنفُ المسار أولًا (لوحة المطوّرين في مدخل الوثائق — جدول النطاقات classes، CONST.routeClass): مسارُ صنفٍ
  // خاملٌ بحكم الحارس نفسه («inactive»)، فيُعاد تقييمه مع كل تنقّل (checkRoute) ويعيد الانتقالُ إليه الصفحةَ إلى أصلها كأي مسارٍ خامل. والصنف قادمٌ
  // (status.upcoming) وقاموسه لا يحمله المانيفست، فلا قاموس له في هذا المحرّك بعد: يبقى خاملًا وإن شُحن (verify-package يرفض شحنه قبل CN1)، وتشغيلُه
  // تبديلُ القاموس والبيانات بالمسار عند التنقّل (بند CN1 الهندسي). وصنفُ المسار يسبق routes النطاق: مسارٌ في الصنف خاملٌ ولو وقع تحت بادئةٍ كاملة
  // ★★ (ر20-ج، ١٢ جمادى الأولى ١٤٤٨هـ) تبديل القاموس والبيانات بالمسار — هندسةُ CN1 بلا حصاد، والصنف قادمٌ كما كان:
  //   - «المنظر» (VIEW) صنفُ المسار الحاضر إن كان **حيًّا**: مشحونًا في الجدول (لا status.upcoming) وقاموسُه محقونٌ بنطاقه واسمه
  //     (CLAUDE_L10N_CLASSES[<الصنف>]، classL10N). فالصنف القادم لا منظر له أبدًا: مساره «inactive» بالحكم نفسه الذي كان، حرفًا بحرف؛
  //   - في منظر الصنف يعمل المحرّك بقاموس الصنف وبياناته: حقول المضيف من صفّ النطاق وحده (CONST.CLASS_HOST_META: التطبيق الواحد بخطوطه
  //     وترطيبه وورقته الحيّة وفحصه، فثوابت الإقلاع هي هي في المنظرين)، وسائرها من بيانات الصنف وحدها (محتوى مستخدمه skipSel وما يُبقيه
  //     keepSel واتجاهه dirSel وعنوانه…)، ومساراتُه مساراتُ الصنف. فلا متون ولا حارس متن ولا صدى عناوين للوثائق في اللوحة؛
  //   - ويُحكم المنظر عند كل تنقّل (checkRoute: مراقب الطفرات وpopstate وواجهة Navigation)، والانتقال بين المنظرين يمرّ بالخمول أولًا: يُرجع
  //     الجانبَ الذي نغادره كما يُرجعه المسار الخامل (الانتقال الذي أثبتت ر20-أ أنه بلا أثرٍ بايتًا بايتًا: النص والسمات والعلامات والاتجاه
  //     والخط والورقة الحيّة والعنوان)، ثم يركّب قاموس الجانب الآخر ويدخله كما يُدخل المسارُ الكامل؛
  //   - ومسارٌ لا يطابق المنظر المحمَّل خاملٌ حتى يُبدَّل (routeMode): لا يُعرَّب شيءٌ بقاموس الجانب الآخر ولو لمرورٍ واحد.
  function routeClassNow() { return typeof CONST.routeClass === "function" ? CONST.routeClass(DOMAIN, location.pathname) : null; }
  var DOMAIN_L10N = L10N, DOMAIN_META = META, VIEW = null, viewWait = false, viewTimer = null;
  function classL10N(cls) {
    var all = globalThis.CLAUDE_L10N_CLASSES;
    var x = cls && all && Object.prototype.hasOwnProperty.call(all, cls.id) ? all[cls.id] : null;
    return x && x.dicts && x.domain === DOMAIN && x.routeClass === cls.id ? x : null;
  }
  function classLive(cls) { return !!cls && typeof CONST.classUpcoming === "function" && !CONST.classUpcoming(cls) && !!classL10N(cls); }
  function viewNow() { var rc = routeClassNow(); return classLive(rc) ? rc : null; }
  // بيانات منظر الصنف: حقول المضيف من النطاق، والباقي من بيانات الصنف المبنيّة (لا يتجاوز الصنفُ حقلَ مضيف)، ومساراتُه مساراتُ الصنف
  function classMeta(cls, x) {
    var out = {}, H = Array.isArray(CONST.CLASS_HOST_META) ? CONST.CLASS_HOST_META : [], own = Object.prototype.hasOwnProperty;
    for (var i = 0; i < H.length; i++) if (own.call(DOMAIN_META, H[i])) out[H[i]] = DOMAIN_META[H[i]];
    var cm = (x && x.meta) || {};
    for (var k in cm) if (own.call(cm, k) && H.indexOf(k) < 0 && k !== "routes") out[k] = cm[k];
    out.routes = cls.routes;
    return out;
  }
  function setView(cls) {
    VIEW = cls || null;
    L10N = VIEW ? classL10N(VIEW) : DOMAIN_L10N;
    META = VIEW ? classMeta(VIEW, L10N) : DOMAIN_META;
  }
  function routeMode() { // واحدٌ مع حاصد DOM
    if (viewWait) return "inactive"; // (ر20-ج) منظرٌ بُدّل والموقع لم يرسم صفحته بعد (انظر swapView)
    var rc = routeClassNow();
    if (rc) return classLive(rc) && VIEW === rc ? SHARED.routeMode(rc.routes, location.pathname) : "inactive";
    return VIEW ? "inactive" : SHARED.routeMode(DOMAIN_META.routes, location.pathname);
  }
  // الإقلاع في مسار صنفٍ حيّ يبدأ بمنظره (والقادم لا منظر له: VIEW يبقى null فكل ما بعده هو هو)
  setView(viewNow());

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
    state.enabled = state.master && state.site && state.route !== "inactive" && !state.siteForeign && !noselHeld && !botPage;
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
  // ★★ (ر24-أ، ٨ جمادى الأولى ١٤٤٨هـ — مراجعة Codex CX-005) وكلُّ كتابةٍ لنا سجلٌّ مرتَّب {old، val} لكل سمة (lang وdir) لا عدّادٌ وحده: كان الحكم
  // بالمساواة (قيمةٌ تساوي wroteLang ليست من الموقع)، فإن كتب الموقع نفسه lang="ar" بعد أن كتبناها — يوم يتيح عربيته — لم تخمد الإضافة، وبقيت
  // تقلب واجهةً عربيةً من الموقع وتطابقها. فمراقب الحارس يطابق كل سجلّ طفرةٍ (قيمته القديمة oldValue، والجديدة قديمةُ السجلّ التالي للسمة نفسها أو
  // القيمة الحاضرة) بأول كتابةٍ لنا تطابقه بالترتيب: ما طابق فهو لنا، وما سواه كتبه الموقع — ولو ساوى ما كتبناه — فقيمته الأصلُ الجديد ولا نملكها
  // بعده (siteWrote)، فلا يمسّها الإرجاع، ويُحكم بها. والطابور محدود (ذاكرةٌ لا حكم)، وما سقط منه سجلُّه لا يُطابق ما بعده (يُحذف ما قبل المطابق)
  var ownQ = { lang: [], dir: [] }, OWN_Q_MAX = 32;
  function noteOwn(name, old, val) {
    if (!siteLangObs) return;
    var q = ownQ[name];
    q.push({ old: old, val: val });
    if (q.length > OWN_Q_MAX) q.shift();
  }
  // سجلُّ طفرةٍ للسمة name من القيمة old إلى val: أهو كتابتنا؟ (يُستهلك من الطابور)
  function ownRec(name, old, val) {
    var q = ownQ[name];
    for (var i = 0; i < q.length; i++) if (q[i].old === old && q[i].val === val) { q.splice(0, i + 1); return true; }
    return false;
  }
  function setOwned(html, name, val) {
    var cur = html.getAttribute(name);
    if (cur !== val) { html.setAttribute(name, val); noteOwn(name, cur, val); }
    if (name === "lang") wroteLang = val; else wroteDir = val;
  }
  function restoreOwned(html, name) {
    var mine = name === "lang" ? wroteLang : wroteDir;
    var orig = name === "lang" ? origLang : origDir;
    // (ر4) والإرجاع إلى القيمة نفسها لا يُكتب (لا سجلَّ طفرةٍ بلا تغيير)
    if (mine !== null && html.getAttribute(name) === mine && orig !== mine) { restoreAttr(html, name, orig); noteOwn(name, mine, orig); }
    if (name === "lang") wroteLang = null; else wroteDir = null;
  }
  // كتب الموقع السمة بقيمة v (بسجلّ طفرته لا بالمساواة): قيمته الأصلُ الجديد، وإن كانت هي الحاضرة فليست لنا (لا يمسّها الإرجاع)
  function siteWrote(html, name, v) {
    if (name === "lang") { origLang = v; if (html.getAttribute("lang") === v) wroteLang = null; }
    else { origDir = v; if (html.getAttribute("dir") === v) wroteDir = null; }
    origSaved = true;
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
  // رقمُ مراجعة المحرّك في البصمة: الورقة المخزّنة من محرّكٍ سابق لا تُعاد بعد تحديث الإضافة (ق١). (ر30-ب2: ويحسبها «فحص الاتجاه» بالدالة نفسها)
  function liveFp(sheets) {
    var fpSrc = "r" + ((CMLRtl && CMLRtl.REV) || 1) + "|" + sheets.map(liveKey).join("|");
    return CMLRtl && CMLRtl.fnv1a ? CMLRtl.fnv1a(fpSrc) : fpSrc;
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
    var fp = liveFp(sheets);
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
  // ★ (ر20-أ) رفع الورقة الحيّة عند الخمول بالمسار (applyChrome): العنصر يُزال، والبصمة تُنسى فتُطلب عند العودة، والجيل يُلغي ردًّا في الطريق
  function dropLiveSheet() {
    var ls = document.getElementById("cml-live-rtl");
    if (!ls && liveApplied === null && liveInflight === null) return;
    if (ls && ls.parentNode) ls.parentNode.removeChild(ls);
    liveApplied = null; liveInflight = null; liveGen++;
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
  var langEntry = false, langPins = 0; // (ر20-ج) دخولٌ من مسارٍ خامل بالتنقّل (checkRoute)، وما استُردّ فيه من lang
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
  // ★ (ر24-أ، CX-005) siteV: آخر قيمةٍ كتبها الموقع لسمة lang في دفعة مراقب الحارس (بمصدر الطفرة: ownRec)، أو undefined — فيُحكم بها ولو
  // ساوت ما كتبناه (عربيةُ الموقع نفسه بعد كتابتنا)؛ وقد صارت الأصلَ ولا نملكها (siteWrote في المراقب)
  function judgeSiteLang(siteV) {
    if (!SITE_LANG && !LANG_SEL) return;
    var h = document.documentElement;
    if (!h) return;
    if (SITE_LANG && siteV !== undefined) {
      htmlForeign = isForeignLang(siteV);
      htmlForeignV = htmlForeign ? siteV : null;
    } else if (SITE_LANG) {
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
        // ★ (ر24-أ، CX-005) مصدر كل سجلّ بترتيبه (ownRec): كتابتنا تُطرح، وما كتبه الموقع — ولو ساوى ما كتبناه — قيمتُه الأصلُ الجديد (siteWrote)،
        // وآخرُ ما كتبه للغة يُحكم به (judgeSiteLang(siteV)). وdir معها: «الموقع يكتب dir كما نكتبها» لا يُرجع عند الخمود
        var site = 0, siteV, h = document.documentElement;
        for (var i = 0; i < recs.length; i++) {
          var an = recs[i].attributeName;
          if (an !== "lang" && an !== "dir") continue;
          var nv;
          for (var j = i + 1; j < recs.length; j++) if (recs[j].attributeName === an) { nv = recs[j].oldValue; break; }
          if (j >= recs.length) nv = h.getAttribute(an);
          if (ownRec(an, recs[i].oldValue, nv)) continue;
          siteWrote(h, an, nv);
          if (an === "lang") { site++; siteV = nv; }
        }
        if (site && HYD_LANG && textGate === "wait" && document.readyState !== "loading") hydrationSignal("lang");
        judgeSiteLang(siteV);
      });
      siteLangObs.observe(document.documentElement, { attributes: true, attributeOldValue: true, attributeFilter: ["lang", "dir"] });
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
        if (!lost) {
          // ★ (ر20-ج، ١٢ جمادى الأولى ١٤٤٨هـ — مراجعة ر20-أ، منخفض) سمة lang فورًا في طريق العودة: بعد الدخول من مسارٍ خامل إلى مسارٍ عامل
          // (من لوحة المطوّرين إلى الوثائق بلا إعادة تحميل) يعيد الموقع كتابة ‎<html lang>‎ بعد مرورنا، فكانت الصفحة المعرَّبة تبقى بلغة الموقع حتى
          // مرورٍ تالٍ. فما كتبه الموقع في lang بعد ذلك الدخول يُستردّ في الحال: قيمتُه الأصلُ الجديد (saveOriginals) ونكتب لغتنا. وفي نطاقٍ بلا
          // حارس لغة (لا siteLang ولا siteLangSel) وحده، فلغة الموقع فيه لا حكم لها؛ وبحدٍّ لكل دخول خارج htmlPins فلا تستنفد العوداتُ حارسَ التثبيت
          // ★ (ر29-ب، ١٣ جمادى الأولى ١٤٤٨هـ — ملاحظة ر30-أ) وفي نطاقٍ بحارس لغة <html lang> (التطبيق): يكتب الموقع لغته الإنجليزية (en-US) بعد
          // كتابتنا عند تركيب تطبيقه (قِيس في /login: نكتب ar في 0.4ث ويكتب en-US في 1.2ث)، فكانت الصفحة المعرَّبة تبقى lang="en-US" مع dir=rtl —
          // فيقرأ قارئ الشاشة العربية بصوتٍ إنجليزي. والحارس قد حكم قبل هذا السطر (judgeSiteLang): الإنجليزية ليست لغةً أخرى، فقيمتُها الأصلُ
          // المستعاد (saveOriginals) ونكتب لغتنا. واللغة الأخرى (ومنها عربية الموقع نفسه) تُخمد الإضافة قبله فلا يُكتب فوقها شيء. وبحدّ langPins نفسه.
          // وبعد فتح بوابة النص وحده (textGate): قبلها لم نعرّب شيئًا بعد، فلغة الموقع التي كتبها أثناء التحليل باقية (الأكاديمية، _hydlangtest)
          var siteEn = SITE_LANG && textGate !== "wait" && !state.siteForeign && !isForeignLang(h.getAttribute("lang"));
          if (((langEntry && !SITE_LANG && !LANG_SEL) || siteEn) && h.getAttribute("lang") !== state.lang && langPins < (CONST.HTML_PIN_MAX || 10)) {
            langPins++;
            saveOriginals(h);
            setOwned(h, "lang", state.lang);
          }
          return;
        }
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
      // ★ (ر30-ب) هوية النطاق لقواعد base.css المشتركة التي لا تعمل في claude.ai (حقول LTR: يعالجها الموقع وapp-point.css)
      html.setAttribute("data-cml-site", DOMAIN);
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
      html.removeAttribute("data-cml-site");
      html.removeAttribute("data-cml-route");
      html.removeAttribute("data-cml-rtl");
      restoreOwned(html, "dir");
      restoreOwned(html, "lang");
      // ★ (ر20-أ، ١٢ جمادى الأولى ١٤٤٨هـ) والانتقال إلى مسارٍ خامل (لوحة المطوّرين وما سواها خارج ‎/docs/en/‎ في التطبيق الواحد) يرفع ورقتنا الحيّة
      // من <head> أيضًا: قواعدها كلها خلف سمات <html> التي رُفعت فهي خاملة، لكن الصفحة الخاملة لا يبقى فيها من أثرنا شيء. والعودة تطلبها من جديد
      // (البصمة تُنسى، وطلبٌ في الطريق يلغو بالجيل)، وعامل الخدمة يعيدها من ذاكرته. والإطفاء بالمفتاح كما كان: الورقة باقيةٌ خاملة
      if (state.route === "inactive") dropLiveSheet();
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
    pluralRes = []; badPlurals = 0; nounSet = Object.create(null);
    if (!active) return;
    for (var eng in active.plurals) {
      var spec = active.plurals[eng];
      var forms = spec.forms || [];
      [eng, spec.plural].forEach(function (pat) {
        if (!pat) return;
        // ★ (ر12، ج3) معدودٌ يُرسم عقدةً وحده بعد عدده: مدخلٌ «‎%d <المعدود>‎» بعينه (countPair)
        var nm = /^%d (\S[\s\S]*)$/.exec(pat);
        if (nm && nm[1].indexOf("%d") < 0) nounSet[nm[1]] = true;
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

  // ---------- (ر12، ٥ جمادى الأولى ١٤٤٨هـ — PLAN-3.0.0 ج3) العدد في عقدةٍ ومعدودُه في أخرى (meta.countNoun) ----------
  // ترسم الأكاديمية عدد دروس القسم «‎<span>2<!-- --> <!-- -->lessons</span>‎» (React يفصل عُقد النص بتعليق)، فكان «lessons» يُطابَق حرفيًّا
  // «دروس» مع كل عدد: «2 دروس» و«13 دروس» (35 من 64 في حصاد ت3). فالمعدودُ عقدةً وحده بعد عددٍ في عقدةٍ أخرى يُطلب بصيغة الجمع للعدد
  // كاملًا («‎13 lessons‎» ← tryPlural): الصيغ الست من مدخل الجمع في القاموس نفسه («‎%d lesson‎»)، فلا عربيةَ في المحرّك. والصيغة تُكتب
  // كاملةً في عقدة المعدود وتُفرَّغ عقدة العدد، فيُقرأ ما يقرؤه النصّ الواحد «‎13 lessons‎»: «13 درسًا»، و«درس واحد» و«درسان» بلا رقم
  // (دليل الأسلوب، قاعدة مطابقة العدد). والمعدود ما كان مدخلُ جمعه «‎%d <المعدود>‎» بعينه (مفردًا أو جمعًا: nounSet)؛ والعدد أرقامٌ وحدها
  // في أقرب ما يسبقه (تُتخطّى التعليقات والبياض): عقدةُ نصٍّ أختٌ له، أو عنصرٌ سطريٌّ ليس فيه إلا نصُّ العدد — والمعدودُ نفسه قد يكون
  // وحده نصَّ عنصرٍ سطريٍّ يسبقه العدد كذلك (‎<span>13</span> <span>lessons</span>‎). لا خلايا جدولٍ ولا كتل: السطري وحده.
  // والسجلّان متقابلان (cn في المعدود، وcnt في العدد): يُرجعان معًا (الإطفاء والاستعادة والمستثنى)، وتغيُّرُ أحدهما من الموقع يحلّ الزوج
  // ثم يُعاد حكم المعدود. للأكاديمية وحدها (جدول النطاقات): لم يُقَس شكلٌ كهذا في غيرها، وفي التطبيق أسماءٌ يكتبها المستخدم خارج المحادثة
  var COUNT_NOUN = META.countNoun === true;
  var nounSet = null;
  var CN_INLINE = { SPAN: 1, B: 1, STRONG: 1, EM: 1, I: 1, SMALL: 1 };
  var CN_DIGITS = /^\s*\d+\s*$/;
  function cnOurs(t) { var r = appliedText.get(t); return !!(r && r.cnt); }
  // أقرب أخٍ ذي معنى قبل x: تُتخطّى التعليقات وعُقد البياض (فاصل React بين العدد والمعدود)، وعقدةُ عددٍ فرّغناها نحن تُعدّ
  function cnPrev(x) {
    for (var s = x.previousSibling; s; s = s.previousSibling) {
      if (s.nodeType === 8) continue;
      if (s.nodeType === 3 && !cnOurs(s) && !/\S/.test(s.nodeValue || "")) continue;
      return s;
    }
    return null;
  }
  // عقدة النص الوحيدة في عنصرٍ سطري (وما سواها تعليقاتٌ أو بياض)، وإلا null
  function cnSole(el) {
    if (!el || el.nodeType !== 1 || !CN_INLINE[el.nodeName]) return null;
    var one = null;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 8) continue;
      if (c.nodeType !== 3) return null;
      if (!cnOurs(c) && !/\S/.test(c.nodeValue || "")) continue;
      if (one) return null;
      one = c;
    }
    return one;
  }
  // عقدة العدد لعقدة المعدود، أو null
  function countNodeOf(node) {
    var s = cnPrev(node);
    if (!s) {
      var p = node.parentNode;
      if (!p || cnSole(p) !== node) return null;
      s = cnPrev(p);
      if (!s) return null;
    }
    var c = s.nodeType === 3 ? s : cnSole(s);
    if (!c) return null;
    return cnOurs(c) || CN_DIGITS.test(c.nodeValue || "") ? c : null;
  }
  // يُكتب الزوج إن صحّ: true إن كُتب. عددٌ فرّغناه لمعدودٍ زال يُتبنّى، وعددٌ كتب الموقع فيه بعدنا يُقرأ من جديد
  function countPair(node, raw, key) {
    if (!nounSet || nounSet[key] !== true) return false;
    var cn = countNodeOf(node);
    if (!cn || !translable(cn)) return false;
    var cr = appliedText.get(cn);
    if (cr && !cr.cnt) return false;
    if (cr && cn.nodeValue !== cr.lastWritten) { appliedText.delete(cn); cr = null; }
    if (cr && cr.cnt !== node) {
      var on = cr.cnt, onr = appliedText.get(on);
      if (on.isConnected && onr && onr.cn === cn && on.nodeValue === onr.lastWritten) return false; // عددُ معدودٍ آخر قائم
    }
    var craw = cr ? cr.raw : cn.nodeValue;
    if (!CN_DIGITS.test(craw)) return false;
    var v = tryPlural(craw.trim() + " " + key);
    if (v === null) return false;
    if (cr) cr.cnt = node;
    else appliedText.set(cn, { raw: craw, key: craw.trim(), lastWritten: "", cnt: node });
    if (cn.nodeValue !== "") cn.nodeValue = "";
    var out = raw.replace(key, function () { return bidiWrap(v); });
    appliedText.set(node, { raw: raw, key: key, lastWritten: out, cn: cn });
    everTranslated = true;
    if (node.nodeValue !== out) node.nodeValue = out;
    if (F) F.note(node.parentNode);
    scheduleRelayoutNudge();
    return true;
  }
  // الزوج كما تركناه: العقدتان على ما كتبنا، والعدد ما زال أقرب ما يسبق المعدود
  function cnIntact(noun, nr) {
    var cn = nr.cn, cr = cn && appliedText.get(cn);
    return !!(cr && cr.cnt === noun && cn.nodeValue === cr.lastWritten && noun.nodeValue === nr.lastWritten && countNodeOf(noun) === cn);
  }
  // عددٌ ظهر بعد معدوده (أو كتب الموقع فيه عددًا وهو غير مقترن): يُعاد حكم المعدود الذي يليه أخًا له (عُرّب حرفيًّا قبل ظهور العدد)
  function cnForward(cnode) {
    for (var s = cnode.nextSibling; s; s = s.nextSibling) {
      if (s.nodeType === 8) continue;
      if (s.nodeType !== 3) return;
      if (!/\S/.test(s.nodeValue || "")) continue;
      var r = appliedText.get(s);
      if (r && (r.cn || r.cnt || r.iso || r.blk || r.echo)) return;
      var k = r ? r.key : SHARED.textKey(s.nodeValue, KEY_MAX);
      if (k && nounSet && nounSet[k] === true) translateText(s);
      return;
    }
  }
  // يُحلّ الزوج: كلُّ عقدةٍ ما زالت كما تركناها يُرجع أصلها، ويُمحى السجلّان
  function cnDissolve(noun, nr) {
    var cn = nr.cn, cr = cn && appliedText.get(cn);
    if (cr && cr.cnt === noun) { if (cn.nodeValue === cr.lastWritten) cn.nodeValue = cr.raw; appliedText.delete(cn); }
    if (noun.nodeValue === nr.lastWritten) noun.nodeValue = nr.raw;
    appliedText.delete(noun);
  }

  // ---------- dynamic patterns (dates, "%d days ago" composites, greeting-with-name…) ----------
  // dictionary "patterns": [{re, ar}] — ar may use $1..$9 (captured group),
  // %M<n> (group n is an English month name → Arabic), %W<n> (weekday), %P<n> (AM/PM),
  // and %C<n> (place name → Arabic *if known*, otherwise kept verbatim — never fails
  // the pattern, so an unknown city still gets the rest of the line translated).
  // ★ (ر12، ٥ جمادى الأولى ١٤٤٨هـ — PLAN-3.0.0 E2) and %T<n>: group n must be a LITERAL key of the active site's
  // dictionary (user corrections first, then the shipped strings — the literal chain of lookup, trimmed like any key),
  // and its Arabic is substituted; not a key ⇒ the pattern fails like an unmapped %M, so the text stays wholly English.
  // Never recursive (literal tables only), and only ever reached for text the engine may translate (translable).
  // The template is filled in one pass by SHARED.fillPattern — the same filler the build and measuring tools use.
  // (ر12) جداول الشهور والأيام وص/م والأماكن صارت في cml-shared (PAT_MAPS): مصدرٌ واحدٌ للمحرّك وللأدوات (patternRes)
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
  // مُحلِّلات رموز القالب (SHARED.patternRes، وهي نفسها للأدوات): الجداول المغلقة، و★ (ر12) %T بالسلسلة الحرفية نفسها التي يطلبها lookup
  // — تصحيحات المستخدم ثم قاموس الموقع النشط (لكل موقعٍ قاموسه: مفتاحٌ في قاموس موقعٍ آخر وحده لا يُعدّ) — لا جموع ولا أنماط، فلا تداخل
  var PAT_RES = SHARED.patternRes(function () { return active ? [active.overrides, active.strings] : null; });
  // capOk (اختياري، لعنوان التبويب وحده): التقاطٌ ($n) لا يقبله يجعل النمط غير مطابق فيُجرَّب التالي. ★ (ر12) والتقاط %T لا يمرّ به: لا
  // يبقى منه في العنوان حرفٌ لاتيني — تحلّ محلّه عربيةُ مفتاحٍ حرفيٍّ مراجَع، وهي ما يكتبه بحث العنوان الحرفي نفسه لذلك المفتاح
  // ‎{v, i}‎: الناتج وموضع النمط الفائز في الترتيب (الأخصّ أولًا) — يحتاجه البحث بالعدد ذي فاصلة الآلاف ليقارن بين صورتَي العدد
  function tryPatternsHit(text, capOk) {
    if (!patRes || !patRes.length || !/[A-Za-z]/.test(text)) return null;
    if (!patIdx) buildPatIndex();
    return patIdx.find(text, function (i) {
      var m = text.match(patRes[i].re);
      if (!m) return null;
      var out = SHARED.fillPattern(patRes[i].ar, m, PAT_RES, capOk);
      return out === null ? null : { v: out, i: i }; // an unmapped %M/%W/%P/%T means the pattern didn't really fit — try the next one
    }, CONST.PATTERN_CAPTURE_MAX);
  }
  function tryPatterns(text, capOk) {
    var hit = tryPatternsHit(text, capOk);
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
    // ★ (ت14-هـ0ب) العدد بفاصلة الآلاف («1,000 sessions»): الجموع والأنماط بأرقامٍ بلا فاصلة، ثم يعود العدد إلى صورته (cml-shared degroupDigits).
    // ★ (ت14-هـ2) وبترتيب السلسلة نفسه: الجمعُ بالعدد بلا فاصلة يسبق الأنماط، والنمطُ الأسبق في الفرز (الأخصّ) يفوز أيًّا كانت صورة العدد التي
    // طابقها — كان نمطٌ عامٌّ قديم («Dismissed {ago}»، «{label} members») يأخذ «1,000 findings» قيمةً لمتغيّره قبل أن يُسأل الجمع، فيخرج نصفه
    // إنجليزيًّا (n01#23 في ت14-هـ0ب). والنصّ الذي لا عدد فيه بفاصلة لا يتغيّر حكمه
    var dg = v === undefined ? SHARED.degroupDigits(key) : null;
    if (dg) { var gp = tryPlural(dg.key); if (gp !== null) v = SHARED.regroupDigits(gp, dg); }
    if (v === undefined) {
      var pt = tryPatternsHit(key), gt = dg ? tryPatternsHit(dg.key) : null;
      if (gt && (!pt || gt.i < pt.i)) v = SHARED.regroupDigits(gt.v, dg);
      else if (pt) v = pt.v;
    }
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
      // ★ (ر24-أ، المراجعة المستقلة — CX-001) كتلةٌ فيها عنصرٌ محميّ (مستثنى النطاق أو المحادثة أو قابلٌ للتحرير، بالعناصر وحدها: blockP) جزءٌ لا
      // كتلةٌ كاملة، ولا يُقرأ نصُّها للمقارنة: textContent كان يقرأ نصَّ المحميّ (حدٌّ مستقلٌّ كـdiv[contenteditable] داخل li بجوار نصٍّ ليس في القاموس)
      if (SHARED.protDesc(blk, blockP())) return true;
      return (blk.textContent || "").trim() !== (node.nodeValue || "").trim();
    } catch (e) { return false; }
  }
  // ★ (ر24-أ، CX-001) فحوص العناصر وحدها قبل fragmentInBody (التي تقرأ قيمة العقدة): المستثنى والمحرَّر والمحادثة لا يُقرأ نصُّها ولو للمقارنة
  function translable(node) {
    var p = node.parentNode;
    if (!p) return false;
    if (inSkipSel(p)) return false;
    if (inShell(p)) return false;
    if (inSkipped(p)) return false;   // بالسلف لا بالأب المباشر (شيفرة ملفوفة في <span>)
    if (p.isContentEditable) return false;
    if (inChatContent(p)) return false;
    // ★ (ر29-د — طافر ر29-ج M6) ما يقرؤه حارس لغة الصفحة (meta.siteLangSel) لا يُترجم أبدًا: ترجمةُ قيمته جعلت الحارس يقرؤها لغةً أخرى فيُخمد
    // الإضافة ثم يعيدها، فتدور حتى تتعلّق الصفحة. بالعنصر نفسه لا بقاموسٍ يُبقيه
    if (LANG_SEL) { try { if (p.closest && p.closest(LANG_SEL)) return false; } catch (e) {} }
    if (fragmentInBody(p, node)) return false;
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
  // ★ (ر12-ب، ٥ جمادى الأولى ١٤٤٨هـ — الفحص الحيّ لـت8، L2) ومالكو كتلٍ أبقاها المترجم كما في المصدر (علامة keep في القطعة): المالك ← آمنٌ؟
  // (SHARED.ltrSafe: نصُّه اللاتيني يُرسم في فقرةٍ من اليمين بترتيبه — «Claude Code» و«Claude Platform (API)» و«Claude MSIX (x64)»، لا جملةٌ تنتهي
  // بنقطةٍ أو تبدأ برقم). كان بندُ القائمة منها LTR بنقطته يسارًا بين بنودٍ عربيةٍ نقاطها يمينًا (المساعدة a/17444146 وثلاث صفحاتٍ منشورة)،
  // والفقرةُ منها يسارًا بين فقراتٍ يمينًا. فالمالك الآمن اتجاهُه اتجاهُ اللغة كجيرانه ورسمُ نصّه هو هو، وغيرُ الآمن يبقى لحكم نصّه (جزيرةٌ من
  // اليسار تُقرأ بترتيبها)، والحاوية فوقهما (البند وغلاف القائمة) اتجاهُ اللغة في الحالين فنقطتها يمينًا (decidedOnly). وبشرط blkOwnersTr نفسه
  // (لا نصَّ في المالك خارج الكتلة)، ويُمحى العضو متى لم تعد الكتلة مُبقاة (ترجمةٌ أو تصحيحٌ أو غيّر الموقع نصّها)، ويُعاد حكم اتجاهه فورًا
  var blkOwnersKeep = new WeakMap();
  // ★★ (ر24-أ، ٨ جمادى الأولى ١٤٤٨هـ — مراجعة Codex CX-001) سياق حماية التتابع (SHARED.blockProt): مستثنى النطاق بحال المسار كما يستثنيه الحاصد
  // والحارس بعينه (harvestSkip: meta.skipSel وshellSel في shell وechoSel)، ومحدِّدات المحادثة حيث تُستثنى (CHAT_ON)، وقابلُ التحرير. يُمرَّر إلى
  // blockOwner وblockBounds وextractBlock وinlineKind في وضع الكتلة كلّه (الكتابة والحارس والتصحيح)، فتتابعٌ فيه محميٌّ يُرفض كلّه بالعناصر وحدها
  // قبل قراءة أي نصٍّ منه: لا مطابقة ولا كتابة ولا عدّ، وما كتبناه في نصّه المؤهَّل قبلُ يُرجع (protRun). وذاكرة الجولة (kindMemo) بهذا السياق وحده
  var protRoute = null, protCtx = null;
  function blockP() {
    if (protCtx === null || protRoute !== state.route) {
      protRoute = state.route;
      // ★ (ر24-ج1، ١٠ جمادى الأولى ١٤٤٨هـ) وصنفا المستثنى بالجدول (SHARED.harvestKeep، meta.keepSel): محتوى المستخدم يرفض التتابع كلَّه، وما تبقيه
      // الشركة ذرّةٌ معتمة فيه لا تُكتب ويُترجم ما حولها (عنوان بطاقة المثال بجوار شارة الطريقة كما في 2.0.0)
      protCtx = SHARED.blockProt(SHARED.harvestSkip(META, state.route), CHAT_ON, SHARED.harvestKeep(META, state.route));
      kindMemo = new WeakMap();
    }
    return protCtx;
  }
  function soleRun(owner, b) {
    var inside = false, P = blockP();
    for (var c = owner.firstChild; c; c = c.nextSibling) {
      if (c === b.first) inside = true;
      if (!inside) {
        if (c.nodeType === 3 && /\S/.test(rawOfNode(c) || "")) return false;
        if (c.nodeType === 1 && SHARED.inlineKind(c, rawOfNode, kindMemo, P) && SHARED.inlineKind(c, rawOfNode, kindMemo, P) !== "g") return false;
      }
      if (c === b.last) inside = false;
    }
    return true;
  }
  // ★ (ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ — E-lang، meta.blockLang: للأكاديمية وحدها) سمة lang لما كتبناه بلغة الهدف في المتن. ملخّصُ الأداة لقارئ الشاشة في
  // دروس الأكاديمية (‎p.sr-only[data-widget-summary][lang=en]‎) تترجمه الشركة وتجعل سمته لغةَ الصفحة في عروضها المترجمة (تحقّق مراجع ر13-أ)، وكان
  // يبقى lang="en" على نصٍّ عربي كتبناه فيقرؤه قارئ الشاشة بصوتٍ إنجليزي. فكتلةٌ كُتبت بلغة الهدف وأقربُ إعلانٍ لها في المتن لغةٌ أخرى تُسجَّل: المالك
  // نفسه إن كان هو المعلِن، أو المالك وحده (تُضاف له السمة) إن كان المعلِن أصلًا فوقه ولا نصَّ في المالك خارج الكتلة (soleRun)، وكلُّ عنصرٍ معلِنٍ داخل
  // حدود الكتلة. والسمة تتبع النصّ بعد كل مرور (langSync): لغةُ الصفحة ما دام في العنصر حرفٌ من لغة الهدف والإضافة عاملة، وإلا أصلُها — فالإرجاع
  // بكل طرقه (الإطفاء، والمسار الخامل، والمستثنى، وحجبُ الحارس، وعودةُ الكتلة إلى أصلها) يُرجعها. وما غيّره الموقع بعدنا قيمتُه الأصلُ الجديد
  var LANG_FIX = BODIES_ON && META.blockLang === true;
  // ★ (مراجعة ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ) علامة الإبقاء تشمل الكتلة ذات العقد العدّة (صفّ اللافتات) فلا يعرّب قاموس الواجهة بنودها (blockPass) —
  // للأكاديمية وحدها (meta.keepRows)
  var KEEP_ROWS = BODIES_ON && META.keepRows === true;
  var langRecs = new Map();   // العنصر ← {orig: قيمته الأصلية أو null، wrote: ما كتبناه أو null}
  function langOther(v) {
    var a = String(v || "").toLowerCase().split("-")[0], b = String(state.lang || "").toLowerCase().split("-")[0];
    return !!a && a !== b;
  }
  function langNote(el) { if (el && el.nodeType === 1 && !langRecs.has(el)) langRecs.set(el, { orig: el.getAttribute("lang"), wrote: null }); }
  function langNoteBlock(o, b) {
    if (!LANG_FIX || !active || active.dir !== "rtl") return;
    var d = null;
    try { d = o.owner.closest("[lang]"); } catch (e) { d = null; }
    if (d && d !== document.documentElement && inBody(d) && langOther(d.getAttribute("lang")) && soleRun(o.owner, b)) langNote(o.owner);
    for (var x = b.first; x; x = x.nextSibling) {
      if (x.nodeType === 1) {
        if (x.hasAttribute("lang") && langOther(x.getAttribute("lang"))) langNote(x);
        var ins = x.querySelectorAll ? x.querySelectorAll("[lang]") : [];
        for (var i = 0; i < ins.length; i++) if (langOther(ins[i].getAttribute("lang"))) langNote(ins[i]);
      }
      if (x === b.last) break;
    }
  }
  // ★ (ر24-ج1، ١٠ جمادى الأولى ١٤٤٨هـ — على قاعدة CX-001) في نصّ العنصر غير المحميّ حرفٌ يطابق re؟ بالعناصر أولًا: ما هو أو سلفُه محتوى مستخدم
  // (blockP: المحادثة حيث تُستثنى، ومحتوى المستخدم من المستثنى، وقابل التحرير) لا يُقرأ منه شيء، والفروع المحمية تُقلَّم قبل قراءة نصّها
  function unprotHas(el, re) {
    var P = blockP();
    if (SHARED.protAbove(el, P)) return false;
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      if (n.nodeType === 1) return SHARED.protEl(n, P) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    } }), t;
    while ((t = tw.nextNode())) if (re.test(t.nodeValue || "")) return true;
    return false;
  }
  function langSync() {
    if (!langRecs.size) return;
    var on = !!(LANG_FIX && state.enabled && active && active.dir === "rtl");
    langRecs.forEach(function (r, el) {
      var cur = el.getAttribute("lang");
      if (r.wrote !== null && cur !== r.wrote) { r.orig = cur; r.wrote = null; }   // الموقع كتب بعدنا: قيمتُه الأصل
      // ★ (ر24-ج1) نصُّه غير المحميّ وحده (unprotHas): كان textContent يقرأ ما في العنصر من محتوى مستخدم
      var want = on && el.isConnected && unprotHas(el, HAS_RTL_CH) ? state.lang : null;
      if (want) { if (cur !== want) el.setAttribute("lang", want); r.wrote = want; return; }
      if (r.wrote !== null && el.getAttribute("lang") === r.wrote) restoreAttr(el, "lang", r.orig);
      langRecs.delete(el);
    });
  }
  // ★★ (ر29-د — ر29-أ §٤ و§٧ ب10) صفحة التحقق من الموقع (التحدّي الذي يسبق الصفحة الحقيقية، رآه الفحص من السحابة في claude.ai/login): كانت الإضافة
  // تقلبها وتكتب مقطعًا معرَّبًا داخل جملةٍ إنجليزية. فهي تُعرف بعلامات الصفحة نفسها لا بأداةٍ في نموذج دخولٍ حقيقي: سكربت منسِّق صفحة التحدّي
  // (‎/cdn-cgi/challenge-platform/…/orchestrate/chl_page/‎ أو jsch أو captcha) أو كائن خياراتها في سكربتٍ مضمَّن (‎_cf_chl_opt‎) أو نموذجها (‎#challenge-form‎
  // بعلامة رمزها). وسكربت الكشف الذي يُحقن في الصفحات الحقيقية (‎…/scripts/jsd/main.js‎) وأداة Turnstile ليسا منها (مقيسٌ: الأول في صفحة الدخول
  // الحقيقية). فيها تخمد الإضافة كلّها (refreshEnabled) كحارس اللغة، وبعد التحقق يحمّل الموقع الصفحة الحقيقية مستندًا جديدًا. بلا إذنٍ ولا مضيفٍ جديد
  var botPage = false;
  var BOT_SRC_RE = /\/cdn-cgi\/challenge-platform\/[^?#]*\/orchestrate\/(chl_page|jsch|captcha)\//;
  function botCheckPage() {
    var ss = document.scripts || [], i;
    for (i = 0; i < ss.length; i++) {
      var src = ss[i].getAttribute("src");
      if (src) { if (BOT_SRC_RE.test(src)) return true; continue; }
      var t = ss[i].text || "";
      if (t.length < 20000 && t.indexOf("_cf_chl_opt") >= 0 && /\b_cf_chl_opt\s*=/.test(t)) return true;
    }
    var f = document.getElementById("challenge-form");
    return !!(f && f.tagName === "FORM" && /__cf_chl_/.test(f.getAttribute("action") || ""));
  }
  function botSet() {
    if (botPage) return;
    botPage = true;
    refreshEnabled();
    if (active) fullPass(); else applyChrome();
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
    // ★ (ر29-د) وصمّام «nosel»: المحرّك خاملٌ في الصفحة (refreshEnabled)، والسمتان تقولان السبب للنافذة والاختبارات والفحص
    var ns = noselNow();
    var v = ns ? "held" : state.enabled && active ? (held ? "held" : bodyTr ? "tr" : null) : null;
    if (v) { if (h.getAttribute("data-cml-body") !== v) h.setAttribute("data-cml-body", v); }
    else h.removeAttribute("data-cml-body");
    var w = ns ? "nosel" : held && bodyWhy ? bodyWhy : null;
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
  // ★★ (ر29-د2، ١٤ جمادى الأولى ١٤٤٨هـ — مراجعة ر29-د F4) حاوية المتن الرئيسة (meta.bodyMain): محدِّد المتن المركّب كان يُحكم عليه جملةً، فيخفي
  // جزؤه الثانوي سقوط الحاوية التي فيها النص — في Claude Code إن تغيّر اسم ‎#content‎ بقي الرأس والفهرس يطابقان، وفي شرح وثائق المطوّرين إن تغيّر
  // ‎.docs-prose‎ بقي فهرس الصفحة — فلا يحجز الصمّام ويُقلب متنٌ لم يُعرف موضعه (عينُ عطل 2.0.0 في الوثائق القانونية). فالصمّام وحكمُ الحارس
  // يسألان عن هذه الحاوية وحدها: جذرٌ ظاهرٌ منها (لا مخبوءٌ لصفحةٍ سابقة) يكفي، وفي الوثائق أيٌّ من نوعي المتن (الشرح ومرجع الواجهة البرمجية).
  // وبلا الحقل فهي محدِّد المتن كلّه كما كان (نطاقٌ محدِّدُ متنه جزءٌ واحد). وبالمعرّفات وحدها بـgetElementById كما في guardRoots
  var MAIN_SEL = META.bodyMain || BODY_SEL, MAIN_IDS = selIds(MAIN_SEL);
  function selIds(sel) {
    var parts = String(sel || "").split(","), ids = [];
    for (var i = 0; i < parts.length; i++) { var m = /^\s*#([A-Za-z][\w-]*)\s*$/.exec(parts[i]); if (!m) return null; ids.push(m[1]); }
    return ids.length ? ids : null;
  }
  function mainFound() {
    var i, e, all;
    if (!MAIN_SEL) return false;
    if (MAIN_IDS) { for (i = 0; i < MAIN_IDS.length; i++) { e = document.getElementById(MAIN_IDS[i]); if (e && !rootCached(e)) return true; } return false; }
    try { all = document.querySelectorAll(MAIN_SEL); } catch (x) { return false; }
    for (i = 0; i < all.length; i++) if (!rootCached(all[i])) return true;
    return false;
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
    // ★ (ر29-د) ومسار متنٍ لا جذر متنٍ فيه بعد: لا حكم بلا متن (كان يُحكم بصفرٍ من الكتل «لا حجب» فيُكتب في متنٍ يظهر بعدُ بلا عدّ).
    // يحكم الصمّام (noselTick) إن بقي غائبًا، ويُحكم للصفحة متى ظهر جذرها
    // ★ (ر29-د2، F4) والسؤال عن الحاوية الرئيسة لا عن المحدِّد كلّه: رأسٌ أو فهرسٌ وحده ليس متنًا يُحكم عليه
    if (NOSEL && bodyRouteNow() && !mainFound()) { noselTick(); return; }
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
  // ★ (مراجعة ر13-أ، ٦ جمادى الأولى ١٤٤٨هـ — meta.bodyRejudge، للأكاديمية وحدها) متنٌ يكبر بعد حكمه ولم يُكتب فيه شيءٌ من قطعته (bodyTr) يُعاد
  // حكمه بكتله الحاضرة. أدوات الأكاديمية الحيّة (‎[data-living-embed]‎) تُركَّب من العميل بعد فتح البوابة، فدرسٌ متنُه أداةٌ وحدها كان يُحكم بكتلةٍ
  // واحدة مغطّاة (1 من 1) فلا يُحجب، ثم تتبع الأداةُ الحكم فيكتب قاموس الواجهة أزرارها وتسمياتها عربيةً داخل متنٍ إنجليزي (قِيس بالحزمة بلا قطعة:
  // 8 من 156 صفحةً عامة بأداةٍ حيّة لم تُحجب، وفي 6 منها 44 عقدةً عربية). فما دام الحكم «لا حجب» ولم تُكتب كتلةٌ من القطعة: إذا زاد عدد الكتل
  // على ما حُكم به أُعيد الحكم به، فإن حُجبت أُرجع ما كتبه قاموس الواجهة في المتن (bodyPassAll، والحجب يغلب). وبعد أن تُكتب كتلةٌ من القطعة لا
  // يُعاد الحكم: ما يظهر بعدها يتبع حكم الصفحة كما كان. والنطاقات الأخرى (بلا الراية) على حالها حرفًا
  var REJUDGE = GUARD !== null && META.bodyRejudge === true;
  function bodyRejudge() {
    if (!REJUDGE || !bodyJudged || bodyHeld || bodyTr || bodyPending || guardWait || !bodyStat) return;
    if (!state.enabled || !active || textGate === "wait" || state.route !== "full") return;
    var c = bodyCoverage();
    if (c.n <= bodyStat.n) return;
    bodyStat = c;
    if (c.unc / c.n > GUARD) { bodyHeld = true; bodyAttr(); bodyPassAll(); }
  }
  // ★★ (ر29-د، ١٣ جمادى الأولى ١٤٤٨هـ — بعد ر29-أ F1) صمّام «nosel»: أعاد anthropic.com بناء صفحاته القانونية فلم يطابق محدِّد المتن شيئًا، فقلبت
  // 2.0.0 الوثائق الخمس فقراتٍ إنجليزية من اليمين وكتب قاموس الواجهة مقاطع عربية داخل جملها، أسبوعًا. فمسار المتن (meta.bodyRoutes في الجدول،
  // في نطاقٍ له حارس متن) الذي لا يطابق فيه محدِّد المتن جذرًا ظاهرًا بعد استقرار الصفحة يُحجز بالسبب "nosel":
  //   - **ما لا يُقلب: الصفحة كلها لا منطقة المحتوى.** المتن لا يُعرف موضعه، ومحدِّدات الإبقاء والاتجاه كُتبت على البنية نفسها فتسقط معه (سقطت كلها
  //     في legal)، وتخمين منطقة المحتوى (main أو article) قد يفوّت بعض المتن أو يبتلع الواجهة، وقلبُ الصفحة يورث كلَّ فقرةٍ لم تُعرف اتجاهَ اليمين —
  //     عينُ العطل. فلا يصحّ في كل بنيةٍ قادمة إلا عرضُ الموقع نفسه: المحرّك خاملٌ في الصفحة بمسلك حارس لغة الموقع المجرَّب (لا ترجمة ولا اتجاه ولا
  //     lang ولا ورقة حيّة، وما كُتب يُرجع، والعنوان يُستعاد)، وعلى الجذر data-cml-body="held" وdata-cml-held="nosel"، والنافذة والفحص يقولان السبب؛
  //   - **التوقيت توقيت الحارس:** لا حكم أثناء التحميل (readyState «complete»)، ولا قبل سقف الحارس (BODY_GUARD_CAP_MS) من التحميل أو من التنقّل،
  //     ولا وفي الشجرة طفراتٌ منذ أقلّ من هدوئه (BODY_GUARD_QUIET_MS)، وتُعاد النظرة مع كل دفعة طفرات؛
  //   - **يُرفع وحده** متى ظهر جذر المتن (رسمٌ متأخر أو تنقّل) أو صار المسار غير مسار متن (فهرسٌ أو قائمة)، فيُحكم للصفحة من جديد بحارسها؛
  //   - **لا يمسّ** ما ليس مسار متن، ولا نطاقًا بلا bodyRoutes (الأكاديمية وclaude.ai وما لم يُشغَّل)
  var NOSEL = GUARD !== null && !!META.bodyRoutes && typeof META.bodyRoutes === "object";
  var noselHeld = false, noselT = null, noselFrom = 0, noselMut = 0;
  function bodyRouteNow() { return NOSEL && SHARED.routeMode(META.bodyRoutes, location.pathname) === "full"; }
  // صفحةٌ يُحكم فيها الصمّام (بلا النظر في الحجز نفسه): لا لغةٌ أخرى ولا صفحة تحقّق، ومسارٌ كامل هو مسار متن. ★ (مراجعة ر29-د) بلا المفتاحين:
  // الحجز وصفُ الصفحة لا حالُ الإضافة، فيُحكم والإضافة مطفأة ويبقى بإطفائها — كان إطفاؤها (أو إطفاء الموقع) مع أي طفرةٍ يرفعه، فإذا شُغّلت قُلبت
  // الصفحة وكتب قاموس الواجهة داخل متنٍ لم يُعرف موضعه 2.5 ث حتى يُحجز ثانية: عينُ عطل 2.0.0 مع كل إطفاءٍ وتشغيل (مقيسٌ في المراجعة)
  function noselPage() {
    return NOSEL && !state.siteForeign && !botPage && routeMode() === "full" && bodyRouteNow();
  }
  // مرشّحٌ للحجز الظاهر (النافذة والسمتان والفحص): والمفتاحان معه — الإضافة المطفأة تقول «مطفأة» لا «محجوزة»
  function noselCand() { return noselPage() && state.master && state.site; }
  function noselNow() { return !!noselHeld && noselCand(); }
  function noselStop() { if (noselT) { clearTimeout(noselT); noselT = null; } }
  function noselTick() {
    if (!NOSEL) return;
    var cand = noselPage(), found = cand && mainFound();   // ★ (ر29-د2، F4) الحاوية الرئيسة
    if (noselHeld) { if (!cand || found) noselRelease(); return; }
    if (!cand || found) {
      noselStop();
      // ظهر الجذر وللصفحة قطعتها ولم يُحكم لها: يُحكم الآن (judgeBody أجّل حكمه)
      if (found && GUARD !== null && !bodyJudged && !bodyPending && !guardWait && bodyPage !== null && state.enabled && active && textGate !== "wait") {
        judgeBody();
        if (bodyJudged) bodyPassAll();
      }
      return;
    }
    if (!noselFrom) noselFrom = Date.now();
    if (document.readyState !== "complete") return;   // لا حكم أثناء التحميل
    if (!noselT) noselT = setTimeout(noselDecide, Math.max(GUARD_QUIET_MS, noselFrom + GUARD_CAP_MS - Date.now()));
  }
  function noselDecide() {
    noselT = null;
    if (noselHeld || !noselPage() || mainFound()) return;
    if (document.readyState !== "complete") return;
    // الشجرة ما زالت تتبدّل: هدوءٌ آخر
    if (Date.now() - noselMut < GUARD_QUIET_MS) { noselT = setTimeout(noselDecide, GUARD_QUIET_MS); return; }
    noselHeld = true;
    refreshEnabled();
    fullPass();
  }
  function noselRelease() {
    noselHeld = false; noselFrom = 0;
    noselStop();
    refreshEnabled();
    // حكمٌ جديد للصفحة بجذرها الحاضر (حكمٌ سابقٌ على شجرةٍ ذهبت لا يُبنى عليه)
    if (GUARD !== null) guardReset(false);
    if (active) fullPass(); else bodyAttr();
    noselTick();
  }
  // تنقّلٌ داخل الموقع: العدّ من التنقّل
  function noselNav() { if (!NOSEL) return; noselStop(); noselFrom = Date.now(); noselTick(); }
  // كتل المتن الحيّة كلها بمشي الحاصد نفسه (SHARED.harvestBlocks: المحدِّد والمستثنى والذرّات)، بأصل ما كتبناه (rawOfNode) — مخفيُّها
  // وظاهرُها: {n: عددها، unc: غير المغطّى منها}
  // ★ (ر24-أ، مراجعة Codex) بلا سقف طول (CX-003: الكتلة فوق 4,000 كانت لا تُعدّ أصلًا)، وبحماية الحاصد نفسها (CX-001: blockP — جذرٌ تحت محميّ
  // يُترك، والمحميّ يُرفض قبل قراءة نصّه، وتتابعٌ فيه محميٌّ لا يُعدّ مغطًّى ولا غير مغطًّى، كما لا يُحصد)
  function bodyCoverage() {
    var n = 0, unc = 0, roots;
    try { roots = document.querySelectorAll(BODY_SEL); } catch (e) { return { n: 0, unc: 0 }; }
    var skip = SHARED.harvestSkip(META, state.route), SK = SHARED.DOM_RULES.SKIP, memo = new WeakMap(), seen = new Set();
    var P = SHARED.blockProt(skip, CHAT_ON, SHARED.harvestKeep(META, state.route));   // ★ (ر24-ج1) بصنفَي الحاصد نفسه
    var filter = { acceptNode: function (x) {
      if (x.nodeType === 1) {
        if (SK[x.nodeName] || SHARED.protEl(x, P) || SHARED.keptEl(x, P)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
      var p = x.parentNode;
      if (!p || SK[p.nodeName] || p.isContentEditable) return NodeFilter.FILTER_REJECT;
      return /\S/.test(rawOfNode(x) || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    } };
    for (var r = 0; r < roots.length; r++) {
      if (rootCached(roots[r])) continue;   // ★ (ر6-د) متن صفحةٍ سابقة خبّأها الموقع في المستند: ليس من هذه الصفحة
      if (SHARED.protAbove(roots[r], P) || keptRoot(roots[r], P)) continue;
      var tw = document.createTreeWalker(roots[r], NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filter), t;
      while ((t = tw.nextNode())) {
        if (inSkipped(t.parentNode)) continue;
        if (skip) { try { if (t.parentNode.closest(skip)) continue; } catch (e) {} }
        var o = SHARED.blockOwner(t, rawOfNode, memo, P);
        if (!o || o.prot) continue;
        var b = SHARED.blockBounds(o.top, rawOfNode, memo, P);
        if (seen.has(b.first)) continue;
        seen.add(b.first);
        var ex = SHARED.extractBlock(b.first, b.last, rawOfNode, memo, P);
        if (!ex) continue;
        n++;
        if (!blockCovered(ex)) unc++;
      }
    }
    return { n: n, unc: unc };
  }
  function keptRoot(el, P) {
    for (var i = 0; i < P.keep.length; i++) { try { if (el.closest(P.keep[i])) return true; } catch (e) {} }
    return false;
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
  // ★ (ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ) وعلامة الإبقاء في قطعة الصفحة تسبق ترجمة البصمة فيها: تسمياتٌ قصيرة (Owner وStatus وDesign…) تُبقيها الشركة
  // إنجليزيةً في شاشات بعض الأفلام والأدوات وتترجمها في غيرها، والبصمة واحدة — فعلامتها في قطعة صفحةٍ تُبقيها هناك وحدها (keepOn في kept-as-is.json،
  // merge-blocks)، وتبقى ترجمتها في صفحات غيرها. والحارس يعدّها مغطّاة (blockCovered). وتصحيحُ القارئ يسبقهما كما كان
  function keptHere(fp) { return !!(bodyKeep && bodyKeep[fp] === 1); }
  function shardTr(fp) { return shardOn() && !keptHere(fp) ? ownGet(bodyMap, fp) : undefined; }
  function blockExplicit(fp) {
    var v = ownGet(blockOv && blockOv[state.lang], fp);
    if (typeof v === "string" && v) return "ov";
    if (!shardOn()) return null;
    if (keptHere(fp)) return "keep";
    v = ownGet(bodyMap, fp);
    return typeof v === "string" && v ? "tr" : null;
  }
  function blockLookup(fp) {
    var ov = blockOv && blockOv[state.lang], v = ownGet(ov, fp);
    if (typeof v === "string" && v) return v;
    v = shardTr(fp);
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
  // ★ (ر24-أ، CX-001) تتابعٌ فيه محميٌّ مرفوضٌ كلّه: ما كتبناه قبلُ في نصّه المؤهَّل (خارج العناصر المحمية، بالعناصر وحدها) يُرجع — فلا تبقى
  // ترجمةٌ جزئية — ولا يُقرأ من المحميّ شيء؛ ومالكه لا يُعدّ معرَّبًا ولا مُبقًى. ومالكٌ محميٌّ هو أو سلفه لا نصَّ فيه لنا يُرجع هنا
  function protRun(o, b, P) {
    if (!SHARED.protAbove(o.owner, P)) {
      var nodes = [];
      (function add(x, top) {
        for (; x; x = x.nextSibling) {
          if (x.nodeType === 3) nodes.push(x);
          else if (x.nodeType === 1 && x.firstChild && !SHARED.protEl(x, P)) add(x.firstChild, false);
          if (top && x === b.last) return;
        }
      })(b.first, true);
      dropBlk(nodes);
      for (var i = 0; i < nodes.length; i++) if (appliedText.has(nodes[i])) restoreText(nodes[i]);
    }
    var wasTr = blkOwnersTr.delete(o.owner), wasK = blkOwnersKeep.delete(o.owner);
    if ((wasTr || wasK) && o.owner.hasAttribute && o.owner.hasAttribute("data-cml-dir")) setChatDir(o.owner);
  }
  // true: عُولجت العقدة بوضع الكتلة (أو هي داخل شيفرة) فلا يمسّها مسار العقدة الواحدة
  function blockPass(node) {
    var P = blockP();
    var o = SHARED.blockOwner(node, rawOfNode, kindMemo, P);
    if (!o) return true;
    // الختم على كل عضوٍ في التتابع: عقد الفقرة الأخرى في الجولة نفسها لا تعيد حساب حدودها (كان تربيعيًّا)
    var st = blkStamp.get(o.top);
    if (st && st.pass === blkPass) return st.done;
    var b = SHARED.blockBounds(o.top, rawOfNode, kindMemo, P);
    if (o.prot) {
      protRun(o, b, P);
      var pr = { pass: blkPass, done: true };
      for (var px = b.first; px; px = px.nextSibling) { blkStamp.set(px, pr); if (px === b.last) break; }
      return true;
    }
    // ★ (ر24-أ، CX-003) بلا سقف طول: الكتلة كلّها مهما طالت تُطابق وتُكتب معًا أو تبقى كلّها على أصلها
    var ex = SHARED.extractBlock(b.first, b.last, rawOfNode, kindMemo, P), done = false, changed = false, fullBlk = false;
    var mark = function () { changed = true; }, kept = false;
    var explicit = ex ? blockExplicit(ex.fp) : null;
    if (ex && ex.single && !explicit) {
      var sraw = rawOfNode(ex.single), sk = SHARED.textKey(sraw, KEY_MAX);
      if (sk && lookup(sk) !== null) { dropBlk(slotNodes(ex)); done = writeSingle(ex.single, mark); }
    }
    if (ex && explicit === "keep" && (ex.single || KEEP_ROWS)) {
      // ★ يبقى كما في المصدر بقرار المترجم: لا قاموسَ واجهة ولا مسارَ العقدة الوحيدة بعده (وما كتباه قبلُ يُرجع)
      // ★ (مراجعة ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ — meta.keepRows) وفي الأكاديمية الكتلةُ ذات العقد العدّة كذلك (صفُّ لافتاتٍ ونُسخ اللافتة الواحدة): كان
      // صفٌّ تُبقيه الشركة (علامة إبقاءٍ عامّة أو بنطاق الصفحة) يمرّ بعدها بقاموس الواجهة بندًا بندًا (ex.group وsameLabel) فيُعرَّب منه ما يطابق لافتةً
      // في القاموس — قِيس حيًّا: «Design» في صفّ «Design · Accelerate design workflows…» بحالة استخدامٍ تُبقيه الشركة كلَّه، و64 صفًّا مُبقًى في متون
      // الأكاديمية فيها بندٌ في القاموس. والنطاقات الأخرى على حالها حرفًا (في الوثائق خمسة صفوفٍ أبقاها المترجم يعرّب منها القاموسُ اسمَ منتج، تُرفع للمالك)
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
        var pv = shardTr(ex.fp);   // (ر13-ج) لا ترجمةَ قطعةٍ لبصمةٍ عليها علامة إبقاءٍ في هذه الصفحة
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
      // ★ (ر12-ب، L2) وعضوية المالك المُبقى (blkOwnersKeep) وأمانُه من التتابع نفسه
      var wasK = blkOwnersKeep.has(o.owner) ? blkOwnersKeep.get(o.owner) : null;
      // ★ (مراجعة ر12-ب، ٥ جمادى الأولى ١٤٤٨هـ) إلا صفَّ لافتات (ex.group: ألسنة «cURL/CLI/Python» فوق أمثلة الشيفرة، ووسوم): ليس عبارةً
      // واحدة، فكلُّ لسانٍ صندوقٌ يُرسم وحده؛ واتجاه اللغة على حاويته كان يعكس ترتيب الألسنة في بطاقة الشيفرة اليسارية ويرسم «C#» «#C»،
      // وعلى 390 يُخرج اللسان المختار عن الشاشة (وثائق المنصة، مقيسًا). فلا يُسجَّل، ويبقى صفُّه لحكم نصّه كما كان قبل ر12-ب
      var nowK = !fullBlk && explicit === "keep" && !ex.group && soleRun(o.owner, b) ? SHARED.ltrSafe(ex.tpl) : null;
      if (nowK !== null) blkOwnersKeep.set(o.owner, nowK); else if (wasK !== null) blkOwnersKeep.delete(o.owner);
      if ((wasTr !== nowTr || wasK !== nowK) && o.owner.hasAttribute && o.owner.hasAttribute("data-cml-dir")) setChatDir(o.owner);
    }
    if (done) everTranslated = true;
    // ★ (ر13-ج — E-lang) كُتب في الكتلة شيءٌ بلغة الهدف: معلِنُ لغتها في المتن يُسجَّل، وlangSync يضبط سمته بعد المرور
    if (done && LANG_FIX && ex) langNoteBlock(o, b);
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
    if (noselNow()) return { error: "held", why: "nosel" };   // ★ (ر29-د)
    if (!BODIES_ON || !state.enabled || !active) return { error: "off" };
    // ★ (ر6-ب) المتن محجوب: لا يُعرض فيه تصحيح (النافذة تقول السبب). ★ (ر6-د) والسبب معه: "drift" أو "none"
    if (heldNow()) return { error: "held", why: bodyWhy };
    var n = selTextNode(window.getSelection && window.getSelection());
    if (!n || !inBody(n.parentNode) || inShell(n.parentNode) || inSkipSel(n.parentNode)) return { error: "nosel" };
    if (n.parentNode.isContentEditable) return { error: "noblock" };
    // ما لا يُترجم أصلًا (pre وscript ونحوهما) لا يُعرض للتصحيح — التصحيح لن يُطبَّق عليه
    if (inSkipped(n.parentNode) && !atomOf(n)) return { error: "code" };
    // تحديدٌ يبدأ بشيفرةٍ سطرية داخل فقرة (نقرٌ ثلاثي): الفقرة التي تحويها لا «هذه شيفرة»
    var atom = atomOf(n), memo = new WeakMap(), P = blockP();
    var o = SHARED.blockOwner(atom || n, rawOfNode, memo, P);
    if (!o) return { error: "code" };
    // ★ (ر24-أ، CX-001) تتابعٌ فيه محميٌّ لا يُعرض للتصحيح (لا قالب له، ولا يُقرأ منه شيء)
    if (o.prot) return { error: "noblock" };
    var b = SHARED.blockBounds(o.top, rawOfNode, memo, P);
    var ex = SHARED.extractBlock(b.first, b.last, rawOfNode, memo, P);
    if (!ex) return { error: atom ? "code" : "noblock" };
    // (S6-C) والمدخل الصريح للكتلة في صفحتها (تصحيحٌ أو ترجمةٌ أو إبقاء) يسبق قاموس الواجهة هنا كما في الكتابة
    if (ex.single && !blockExplicit(ex.fp)) {
      var sk = SHARED.textKey(rawOfNode(ex.single), KEY_MAX), sv = sk ? lookup(sk) : null;
      if (sv !== null) return { ui: true, en: sk, ar: sv };
    }
    var cur = blockLookup(ex.fp);
    // صفُّ لافتاتٍ بلا ترجمةٍ للصفّ كلّه: اللافتة المحدَّدة تُصحَّح في قاموس الواجهة كما تُعرَّب
    // ★ (مراجعة ر13-ج — meta.keepRows) إلا صفًّا عليه علامة إبقاء: لا يعرّب القاموسُ بنوده، فيُعرض للتصحيح كتلةً كاملة كالمُبقاة ذات العقدة الوحيدة
    if (ex.group && cur === null && !(KEEP_ROWS && blockExplicit(ex.fp) === "keep")) {
      var gi = ex.group.indexOf(n);
      if (gi >= 0) {
        var gk = SHARED.textKey(rawOfNode(n), KEY_MAX), gv = gk ? lookup(gk) : null;
        if (gv !== null) return { ui: true, en: gk, ar: gv };
      }
    }
    var ov = ownGet(blockOv && blockOv[state.lang], ex.fp), pv = keptHere(ex.fp) ? undefined : ownGet(bodyMap, ex.fp);
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
    var atom = null, k, P = blockP(), memo = new WeakMap();
    for (var p = n.parentNode; p && p.nodeType === 1 && (k = SHARED.inlineKind(p, rawOfNode, memo, P)); p = p.parentNode) {
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
  // ★ (ر12-ب، ٥ جمادى الأولى ١٤٤٨هـ — M1 وL4) وltrParens يحكم بعد الأقواس زوجَي «» (زوجٌ يختلف حكما علامتيه تُضاف له علامةٌ واحدة: «مضيف SSH»
  // ثم «(user@host)» كانت خاتمتُه تنضمّ إلى ما بعدها)، وقبله الشرطة المائلة في آخر مقطعٍ لاتيني (SHARED.ltrSlash: «commands/» لا «/commands»)
  function bidiWrap(s) {
    if (!(HAS_RTL_CH.test(s) && HAS_LTR_CH.test(s))) return s;
    return active && active.dir === "rtl" ? RLI + SHARED.ltrParens(SHARED.ltrSlash(s), true) + PDI : FSI + s + PDI;
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
  // ★ (ر27-ب، ٢٠ جمادى الأولى ١٤٤٨هـ) meta.hydrateSignal = "attr" مع meta.hydrateAttr (وثائق Claude Code: انتقلت من Mintlify فوق Next.js إلى بناء
  // Mintlify الجديد — Vite وReact 19 بلا Next.js، فلا next-route-announcer أبدًا، فكانت النصوص تنتظر السقف 20 ث في كل صفحة). الإشارة أول كتابةٍ
  // من الموقع لسمة <html hydrateAttr> بعد اكتمال التحليل: يكتبها سكربتٌ مضمَّن أثناء التحليل، ثم يعيد مكوّن مسار Mintlify (useLayoutEffect) كتابتها
  // في إيداع ترطيب الجذر نفسه — قِيس بخطّاف إيداعات React في الصفحات الخمس بعرضين بالإضافة وبدونها (63 تحميلًا): في الإيداع الأول دائمًا، وما بقي فيه
  // غير مرطَّب حدُّ Suspense واحدٌ فارغ (لا نصّ ولا عنصر)، والترطيب كاملٌ في الإيداع التالي. فالبوابة تُفتح عندها بلا انتظار الخمول: لا نصّ يُكتب
  // قبل ترطيبه، وانتظارُ load والخمول كان يؤخّر الصفحات الثقيلة إلى 10–12 ث أو إلى السقف (الخيط مشغولٌ بعد الترطيب، قِيس). ولا نكتب هذه السمة
  // أبدًا فكل سجلٍّ لها بعد التحليل من الموقع. وnext-route-announcer يبقى إشارةً هنا (بناء Next.js القديم إن عاد إليه الموقع)
  var HYD_ATTR = META.hydrate === "defer" && META.hydrateSignal === "attr" && typeof META.hydrateAttr === "string" && META.hydrateAttr
    ? META.hydrateAttr : null, hydAttrObs = null;
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
  // مراقب إشارة "attr" من بدء المستند (قبل الإعدادات: كتابة الموقع بعد التحليل لا تُفوَّت)، ويُفصل بفتح البوابة. سجلٌّ وصل والتحليل جارٍ
  // كتابةُ سكربتٍ مضمَّن لا إشارة (مراقبات الطفرات تُنادى بعد كل سكربتٍ مضمَّن والحالة «loading»)
  function watchHydAttr() {
    if (!HYD_ATTR || hydAttrObs || textGate !== "wait" || !document.documentElement || typeof MutationObserver !== "function") return;
    try {
      hydAttrObs = new MutationObserver(function (recs) {
        if (textGate !== "wait") { hydAttrObs.disconnect(); return; }
        if (!recs.length || document.readyState === "loading") return;
        hydAttrObs.disconnect();
        hydrationSignal("attr");
      });
      hydAttrObs.observe(document.documentElement, { attributes: true, attributeFilter: [HYD_ATTR] });
    } catch (e) { hydAttrObs = null; }
  }
  watchHydAttr();
  function openTextGate(why) {
    if (textGate === "open") return;
    textGate = "open:" + why;
    if (gateTimer) { clearTimeout(gateTimer); gateTimer = null; }
    if (hydAttrObs) { try { hydAttrObs.disconnect(); } catch (e) {} }
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
    watchHydAttr(); // (ر27-ب) إن لم يكن عنصر الجذر حاضرًا عند بدء المستند
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
    // ★ (ر24-ج1، على قاعدة CX-001) صندوقٌ فيه محتوى مستخدم (بالعناصر وحدها، blockP) ليس اللافتة وحدها، ولا يُقرأ نصُّه للمقارنة
    if (SHARED.protDesc(box, blockP())) return;
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
      // ★ (ر24-ج1، CX-004) أو صارت قابلةً للتحرير أو في المحادثة (بسمةٍ وحدها أو بنقل): يُرجع أصلها كذلك
      else if (node.parentNode && appliedText.has(node) && (node.parentNode.isContentEditable || inChatContent(node.parentNode))) restoreText(node);
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
    // ★ (ر12، ج3) زوج العدد والمعدود (countPair): عقدة عددٍ فرّغناها يحكمها معدودها — الزوج كما تركناه يبقى، وإلا يُحلّ ويُعاد حكم المعدود
    // (عددٌ جديد كتبه الموقع أو معدودٌ تغيّر)؛ وسجلُّها اليتيم (المعدود زال) يُرجع أصلها
    if (prev && prev.cnt) {
      var cnn = prev.cnt, cnr = appliedText.get(cnn);
      if (cnr && cnr.cn === node) {
        if (cnIntact(cnn, cnr)) return;
        cnDissolve(cnn, cnr);
        if (cnn.isConnected) translateText(cnn);
        if (appliedText.has(node)) return; // اقترن من جديد (عددٌ جديد): فُرّغ ثانيةً
      } else if (node.nodeValue === prev.lastWritten) node.nodeValue = prev.raw;
      appliedText.delete(node);
      prev = null; // وما كتبه الموقع فيها غيرَ عددٍ يُعامل نصًّا عاديًّا أدناه
    }
    // ومعدودٌ كما تركناه: تُشتقّ صيغته من جديد (القاموس قد تغيّر)؛ وإلا يُحلّ الزوج ويُعامل نصُّه الحاضر من جديد أدناه
    if (prev && prev.cn) {
      if (cnIntact(node, prev)) {
        var cpv = tryPlural(appliedText.get(prev.cn).key + " " + prev.key);
        if (cpv !== null) {
          var cpw = prev.raw.replace(prev.key, function () { return bidiWrap(cpv); });
          if (node.nodeValue !== cpw) { node.nodeValue = cpw; prev.lastWritten = cpw; scheduleRelayoutNudge(); }
          return;
        }
      }
      cnDissolve(node, prev);
      prev = null;
    }
    // ومعدودٌ عُرّب حرفيًّا قبل أن يظهر قبله عدد: يُرجع أصله ويُحكم زوجًا أدناه
    if (prev && COUNT_NOUN && node.nodeValue === prev.lastWritten && nounSet && nounSet[prev.key] === true && countNodeOf(node)) {
      node.nodeValue = prev.raw;
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
    if (COUNT_NOUN) {
      if (countPair(node, raw, key)) return; // ★ (ر12، ج3) معدودٌ بعد عددٍ في عقدةٍ أخرى: صيغة الجمع للعدد
      if (CN_DIGITS.test(key)) cnForward(node); // وعددٌ ظهر بعد معدوده: يُعاد حكم المعدود
    }
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
    cnPartner(rec, n);
  }
  // ★ (ر12، ج3) زوج العدد والمعدود يُرجع معًا: شريكُ عقدةٍ أُرجعت يُرجع إن كان سجلُّه يشير إليها (ولو خارج جذر الاستعادة)
  function cnPartner(rec, n) {
    var pt = rec && (rec.cn || rec.cnt);
    if (!pt) return;
    var pr = appliedText.get(pt);
    if (pr && (pr.cn === n || pr.cnt === n)) restoreText(pt);
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
      if (rec && list[i].nodeValue === rec.lastWritten) { list[i].nodeValue = rec.raw; appliedText.delete(list[i]); cnPartner(rec, list[i]); }
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

  // ★ (ر24-ج2، ١٠ جمادى الأولى ١٤٤٨هـ — ما حملته ر24-ج1) عنصرٌ معرَّب (لا عقدةُ نصٍّ مجرّدة) نقله الموقع إلى محادثةٍ أو إلى حاوٍ قابلٍ للتحرير: كان walk يعود
  // عند المحادثة بلا إرجاع، ويرفض المحرَّر في المشي، فيبقى نصُّنا فيه. فيُرجع ما كتبناه نحن فيه وحده: عقدٌ في سجلّنا (appliedText — بحثٌ في خريطة لا
  // قراءةُ نص)، ولا يُقرأ نصُّ عقدةٍ ليست منه. والمحرَّر: نصُّه وحده كما يرجعه translateText (سماتُه — aria-label المحرِّر — واجهةٌ تُعرَّب كما كانت)
  function restoreEd(root) {
    var n = 0, tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), t;
    while ((t = tw.nextNode())) if (appliedText.has(t) && t.parentNode && t.parentNode.isContentEditable) { restoreText(t); n++; }
    if (n) scheduleRelayoutNudge();
  }
  // ★ (ر24-ج2) وفي دفعة الطفرات (walkPruned): ما يرفضه المشي من فرعٍ محادثةً أو مستثنًى أو محرَّرًا يُرجع ما كتبناه فيه كذلك — فجذرٌ جديد فيه محادثةٌ نُقل
  // إليها عنصرٌ معرَّب في الدفعة نفسها يُرجعه، كما كان يُرجعه مشيُ العنصر نفسه قبل إزالة التكرار (AD-001). وخارج الدفعة (المرور الكامل) لا يُمسح ما يُرفض
  var walkPruned = false;
  // ★ (المراجعة المستقلة لـر24-ج2) ما يرفضه مرشِّح المشي من العناصر، بترتيبه: 1 وسمٌ متخطّى (SKIP)، 2 قابلٌ للتحرير، 3 محادثة، 4 هيكل، 5 مستثنى؛ 0 يُمشى.
  // مصدرٌ واحد للمشي ولجذور الدفعة (batchRoots): العقدة المغطّاة لا تُسقط إلا إن بلغها مشيُ سلفها فعلًا
  function walkRej(n) {
    if (SKIP[n.nodeName]) return 1;
    return walkRejProt(n);
  }
  // ★ (ر24-هـ — ما حملته ر24-ج2) شروط walkRej بعد الوسم المتخطّى وحدها: بها يُعرف أن وسمًا متخطًّى (‎.ProseMirror > pre‎) محتوى مستخدمٍ أو محادثةٌ أو قابلٌ للتحرير
  function walkRejProt(n) {
    if (n.isContentEditable) return 2;
    try { if (CHAT_ON && n.matches && n.matches(CHAT_ANCESTOR)) return 3; } catch (e) {}
    try { if (SHELL_SEL && state.route === "shell" && n.matches && n.matches(SHELL_SEL)) return 4; } catch (e) {}
    try { if (SKIP_SEL && n.matches && n.matches(SKIP_SEL)) return 5; } catch (e) {}
    return 0;
  }
  function walk(root) {
    if (!active || !state.enabled || !root) return;
    newPass();
    // تقليم من مستوى العنصر: صعودٌ واحد بدل صعودٍ لكل عقدة نصية داخل الفرع.
    if (root.nodeType === 1 && inChatContent(root)) { if (everTranslated) unskip(root); return; }
    if (root.nodeType === 1 && inSkipSel(root)) { if (everTranslated) unskip(root); return; }
    if (root.nodeType === 1 && everTranslated && root.isContentEditable) restoreEd(root);
    if (root.nodeType === 1) {
      translateAttrs(root);
      var els = root.querySelectorAll(ATTR_SELECTOR);
      for (var i = 0; i < els.length; i++) translateAttrs(els[i]);
    }
    // نمشي على العناصر والنصوص معًا: عنصرُ محادثةٍ يُرفض فيُقلَّم فرعه كله بفحص واحد،
    // بدل استدعاء inChatContent لكل عقدة نصية داخل ردٍّ طويل (مئات العقد).
    var pr = walkPruned && everTranslated ? [] : null;
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          var rj = walkRej(n);
          if (!rj) return NodeFilter.FILTER_SKIP; // تجاوز العنصر نفسه واستمر في أبنائه
          // ★ (ر24-هـ — ما حملته ر24-ج2) والوسم المتخطّى يُرفض قبل المستثنى والمحادثة، فعقدةٌ معرَّبة في فرعٍ مفصولٍ ثم موصول، مباشرةً في ‎.ProseMirror > pre‎،
          // كانت لا تُرجع (ولا في المحرّك السابق). ففي الدفعة يُسأل الوسم المتخطّى عن تلك الشروط نفسها (walkRejProt، بالعناصر وحدها)، ويُرجع من سجلّاتنا وحدها
          if (pr) { var pk = rj === 1 ? walkRejProt(n) : rj; if (pk === 2 || pk === 3 || pk === 5) pr.push(n, pk === 2 ? 1 : 0); }
          return NodeFilter.FILTER_REJECT;
        }
        var p = n.parentNode;
        if (!p || SKIP[p.nodeName] || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var batch = [], n;
    while ((n = tw.nextNode())) batch.push(n);
    for (var j = 0; j < batch.length; j++) translateText(batch[j]);
    if (pr) for (var k = 0; k < pr.length; k += 2) { if (pr[k + 1]) restoreEd(pr[k]); else unskip(pr[k]); }
  }
  // ★ (ر24-ج2، ١٠ جمادى الأولى ١٤٤٨هـ — مراجعة Codex AD-001) جذور الدفعة: أصغرُ مجموعةٍ من العقد المضافة تغطّيها — المتّصلة وحدها، مرّةً لكلٍّ (عقدةٌ أُضيفت
  // ثم أُزيلت ثم أُعيدت تُرى مرّتين في السجلّات)، وتسقط كلُّ عقدةٍ سلفُها في المجموعة: مشيُ السلف يمرّ بفرعها (المشيُ يبلغ كلَّ ما يبلغه مشيُها، وما يرفضه
  // يُرجع ما كتبناه فيه — walkPruned). كان كلُّ ابنٍ أُضيف مع أبيه يُمشى مرّةً معه ومرّةً وحده (وسلسلةٌ بعمق d تُمشى d(d+1)/2 زيارة). بالعناصر وحدها:
  // صعودٌ في الآباء بذاكرةٍ لكل سلفٍ مرّ به (كلُّ سلفٍ يُفحص مرّةً في الدفعة)، ولا يُقرأ نص
  function batchRoots(added) {
    var set = new Set(), list = [], memo = new Map();
    for (var i = 0; i < added.length; i++) {
      var nd = added[i];
      if (!nd.isConnected || set.has(nd)) continue;
      set.add(nd); list.push(nd);
    }
    // ★ (المراجعة المستقلة لـر24-ج2) مغطّاةٌ = يبلغها مشيُ سلفها: لا عنصرَ يرفضه المشي (walkRej) منها هي إلى ما دون ذلك السلف. وإلا تُمشى وحدها كما كانت
    // — جزيرةٌ غير قابلةٍ للتحرير في محرِّرٍ أُدرج مع سلفه كان مشيُ المحرِّر وحده يعرّبها، ومشيُ السلف يرفض المحرِّر كلَّه فكانت تبقى إنجليزية؛ وعنصرٌ معرَّب
    // نُقل إلى ‎<pre>‎ تحت ‎.ProseMirror‎ يرفضه المشي وسمًا متخطًّى قبل المستثنى فلا يُرجع. والذاكرة لكل سلف: false إن مرّ الصعود منه بمرفوضٍ قبل المجموعة
    function covered(nd) {
      if (nd.nodeType === 1 && walkRej(nd)) return false;
      var path = [], p = nd.parentNode, res = false;
      while (p) {
        if (set.has(p)) { res = true; break; }
        var m = memo.get(p);
        if (m !== undefined) { res = m; break; }
        path.push(p);
        if (p.nodeType === 1 && walkRej(p)) break;
        p = p.parentNode;
      }
      for (var j = 0; j < path.length; j++) memo.set(path[j], res);
      return res;
    }
    var out = [];
    for (var k = 0; k < list.length; k++) out.push(list[k], covered(list[k]));
    return out;
  }

  // ★★ (ر24-ج1، ١٠ جمادى الأولى ١٤٤٨هـ — مراجعة Codex CX-004) الاستثناء الذي يطرأ بسمةٍ وحدها. المراقب كان يرى السمات القابلة للترجمة وحدها، فعنصرٌ
  // معرَّبٌ صار محتوى مستخدمٍ أو قابلًا للتحرير بتغيّر سمة (‎data-row-key‎ و‎data-row-label‎ و‎data-testid‎ و‎contenteditable‎…) تبقى ترجمته. فالمراقب يرى
  // أيضًا السمات التي تقوم عليها محدِّدات محتوى المستخدم في النطاق (المحادثة حيث تُستثنى، وأجزاء المستثنى التي ليست ممّا تبقيه الشركة —
  // blockProt) مستخرجةً منها بالجدول: ‎[سمة]‎ و‎#المعرّف‎ (id)، ومعها contenteditable — لا class ولا style (كلفة الأداء: محدِّدٌ بصنفٍ وحده لا يُرى
  // تغيّره بسمة). وما تبقيه الشركة ليس منها: لا نصّ مستخدمٍ فيه يُحمى
  // ★ (ر20-ج) والمراقب يُركَّب مرّةً للصفحة كلها، فسماتُه سماتُ النطاق ومعها سمات كل صنفٍ حيّ (منظرٌ قد يُدخَل بلا إعادة تحميل)؛ والصنف القادم
  // لا يضيف شيئًا، فالقائمة اليوم هي هي
  var PROT_ATTRS = (function () {
    var metas = [DOMAIN_META], out = ["contenteditable"], m;
    if (typeof CONST.routeClasses === "function") CONST.routeClasses(DOMAIN).forEach(function (c) { if (classLive(c)) metas.push(classMeta(c, classL10N(c))); });
    metas.forEach(function (mt) {
      var P0 = SHARED.blockProt(SHARED.harvestSkip(mt, "full"), CHAT_ON, SHARED.harvestKeep(mt, "full"));
      var src = P0.sels.join(", "), re = /\[\s*([A-Za-z_][-\w.:]*)|#(?=[A-Za-z_-])/g;
      while ((m = re.exec(src))) {
        var a = m[1] ? m[1].toLowerCase() : "id";
        if (a !== "class" && a !== "style" && out.indexOf(a) < 0) out.push(a);
      }
    });
    return out;
  })();
  var PROT_ATTR_SET = {}, ATTR_SET = {};
  PROT_ATTRS.forEach(function (a) { PROT_ATTR_SET[a] = 1; });
  ATTRS.forEach(function (a) { ATTR_SET[a] = 1; });
  var OBS_ATTRS = ATTRS.concat(PROT_ATTRS.filter(function (a) { return ATTR_SET[a] !== 1; }));
  // ما صار محميًّا بسمةٍ في العنصر أو تحته: يُرجع ما كتبناه فيه نصًّا وسمة (unskip) — هو إن كان هو أو سلفُه محميًّا، وإلا كلُّ ما تحته صار محميًّا
  // (‎[data-row-key] [data-row-label]‎: السمة على الصفّ تحمي اسمه). بالعناصر وحدها (blockP)، ولا يُقرأ نصٌّ للحكم
  function protChange(el) {
    if (!everTranslated) return;
    var P = blockP();
    if (SHARED.protAbove(el, P)) { unskip(el); return; }
    var q = P.sels.concat(["[contenteditable]"]), ds;
    for (var i = 0; i < q.length; i++) {
      try { ds = el.querySelectorAll(q[i]); } catch (e) { continue; }
      for (var j = 0; j < ds.length; j++) if (SHARED.protAbove(ds[j], P)) unskip(ds[j]);
    }
  }
  // ---------- observe dynamic UI ----------
  // لا نحتفظ بسجلات الطفرات كما هي: السجل يمسك addedNodes وremovedNodes (قوائم عقد حيّة)
  // فتبقى شجرةٌ أُزيلت محتجزةً في الذاكرة، وتبويبٌ خلفي يبثّ دقائق يراكم عشرات الآلاف من
  // السجلات لأن requestIdleCallback لا يكاد يعمل وهو مخفيّ. نستخرج الأهداف فورًا في
  // مجموعات (إزالة تكرار مجانية) بسقفٍ يمنع التضخم غير المحدود.
  var queued = false;
  var pendAdded = [], pendText = new Set(), pendAttr = new Set(), pendRem = new Set(), pendProt = new Set();
  var pendOverflow = false;
  var PEND_MAX = CONST.PEND_MAX;
  var ric = window.requestIdleCallback ? window.requestIdleCallback.bind(window) : null;
  var schedule = ric ? function (cb) { return ric(cb, { timeout: 500 }); } : function (cb) { return setTimeout(cb, 200); };
  function clearPending() { pendAdded = []; pendText.clear(); pendAttr.clear(); pendRem.clear(); pendProt.clear(); }
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
    if (viewWait && bodyRendered(list)) viewEnter(); // (ر20-ج) الموقع رسم صفحة المنظر الجديد
    if ((META.routes || BODIES_ON) && location.href !== lastHref) checkRoute(true);
    // ★ (ر6-ج) هويّة شجرة المتن مع كل دفعةٍ وفي كل حال (guardTrack)، وبعد التنقّل يُحكم حين تصير شجرةَ الصفحة الحاضرة (guardArm) — لا
    // بأيّ تبدّلٍ خارج <head> يُعيد عدّ الهدوء (ر6-ب). وكتابتنا قيمٌ وسمات لا عقد، فلا تغيّر الهويّة
    if (GUARD !== null) { guardTrack(); if (guardWait) guardArm(); }
    // ★ (ر29-د) صمّام «nosel» مع كل دفعة وفي كل حال (الحجز يُرفع والإضافة خاملةٌ به)، وصفحة التحقق أثناء التحليل
    if (NOSEL) { noselMut = Date.now(); noselTick(); }
    if (!botPage && document.readyState === "loading" && botCheckPage()) botSet();
    // تنقّلٌ داخل المستند (التطبيق بلا حارس مسار): مسار العنوان قد صار مستثنًى وعنوانُنا باقٍ فيه — يُعاد حكمه.
    // ★ (ر3) و<title> خارج <head>: بيانات Next.js المتدفّقة تضعه في <body> في بعض التحميلات (الوثائق القانونية: 3 من 5)، ومراقب
    // العنوان (watchTitle) يرى <head> وحده — فالتنقّل بين وثيقتين كان يُبقي العنوان الجديد إنجليزيًّا. مرّةً لكل دفعة
    if (TITLE_ON && ((titleHref !== null && location.href !== titleHref) || titleOutsideHead(list))) syncTitle();
    if (!state.enabled || !active) {
      // ★ (ر24-ج2، CX-008) وعنصرٌ كتبنا اتجاهه فُصل ونحن نعمل ثم أُعيد بعد الإيقاف: يُرجع اتجاهه (بشرط الملكية) كما يُرجع نصُّه
      if (!state.enabled && (everTranslated || everDir)) {
        for (var ri = 0; ri < list.length; ri++) {
          var added = list[ri].type === "childList" ? list[ri].addedNodes : [];
          for (var rk = 0; rk < added.length; rk++) {
            var an = added[rk];
            if (an.nodeType === 3) { if (everTranslated) restoreText(an); }
            else if (an.nodeType === 1) { if (everTranslated) restoreAll(an); if (everDir) restoreDirIn(an); }
          }
        }
      }
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (pendAdded.length + pendText.size + pendAttr.size + pendRem.size + pendProt.size > PEND_MAX) {
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
        // ★ (مراجعة ر12، ج3) عقدةٌ من زوج العدد والمعدود أزالها الموقع (أو استبدل بها عقدةً جديدة): يُعاد حكم شريكها في الدفعة. كان المعدود
        // يبقى مقترنًا بعددٍ زال فيُرى «5 13 درسًا» إن جاء عددٌ جديد، و«13 درسًا» إن لم يأتِ؛ والعددُ المفرَّغ يبقى فارغًا إن زال معدوده
        if (COUNT_NOUN) for (var rq = 0; rq < m.removedNodes.length; rq++) {
          var rn = m.removedNodes[rq], rt = rn.nodeType === 3 ? rn : cnSole(rn), rr = rt ? appliedText.get(rt) : null;
          if (rr && (rr.cnt || rr.cn)) pendText.add(rr.cnt || rr.cn);
        }
      } else if (m.type === "characterData") pendText.add(m.target);
      else if (m.type === "attributes") {
        // ★ (ر24-ج1، CX-004) سمةٌ يقوم عليها محتوى المستخدم أو قابلية التحرير (PROT_ATTRS) لا سمةٌ تُترجم
        // (لا <html>: لغته واتجاهه لنا ولحارس لغة الموقع؛ ولا lang كتبناه نحن في المتن — langSync، الأكاديمية)
        if (PROT_ATTR_SET[m.attributeName] === 1 && m.target !== document.documentElement &&
            !(m.attributeName === "lang" && langRecs.has(m.target))) pendProt.add(m.target);
        if (ATTR_SET[m.attributeName] === 1) pendAttr.add(m.target);
      }
    }
    if (queued) return; queued = true;
    schedule(function () {
      queued = false;
      // الحالة قد تكون تبدّلت بين جدولة الدفعة وتنفيذها (حتى نصف ثانية). بلا هذا الفحص
      // تُنفَّذ دفعة قديمة بعد أن أوقف المستخدم الترجمة فتعيد ترجمة عقد أرجعها restoreAll
      // إلى الإنجليزية — فتبقى عبارات عربية عالقة في صفحة «موقفة» حتى إعادة التحميل.
      if (!state.enabled || !active) { clearPending(); pendOverflow = false; return; }
      if (pendOverflow) { pendOverflow = false; clearPending(); fullPass(); bodyRejudge(); return; }
      var added = pendAdded, texts = pendText, attrs = pendAttr, rems = pendRem, prots = pendProt;
      pendAdded = []; pendText = new Set(); pendAttr = new Set(); pendRem = new Set(); pendProt = new Set();
      newPass(); // دفعةٌ جديدة لا ترث أختام الكتل من سابقتها (نصٌّ أُدرج في كتلةٍ معرَّبة يُعاد تقديرها)
      // ★ (ر24-ج1، ١٠ جمادى الأولى ١٤٤٨هـ — مراجعة Codex CX-004) عنصرٌ صار محتوى مستخدمٍ أو قابلًا للتحرير بسمةٍ وحدها، بلا تغيّر نصّه ولا عقده: يُرجع ما
      // كتبناه فيه وفي ما صار تحته محميًّا (protChange، بالعناصر وحدها)، ثم يُعاد تقدير تتابعه في المتن من مالكه (rems: يُرفض كلُّه فيُرجع ما كتبناه في نصّه
      // المؤهَّل) وفرعُه خارج المتن (walk). وإن زالت السمة صار مؤهَّلًا فيُترجم بالطريق نفسه
      prots.forEach(function (el) {
        if (!el.isConnected || el.nodeType !== 1) return;
        protChange(el);
        if (BODIES_ON && inBody(el)) rems.add(el);
        else walk(el);
      });
      // حاوياتُ الاتجاه التي مسّتها الدفعة: تُعاد مرةً واحدة بعدها لا مرةً لكل عقدةٍ مضافة (مالكو ق٢ يمشون المتن كله)
      var dirRoots = new Set();
      // ★ (ر24-ج2، AD-001) جذور الدفعة وحدها تُمشى (batchRoots): المتّصلة، مرّةً لكلٍّ، بلا ما سلفُه منها. وعقدةٌ مغطّاةٌ بسلفها لا تُمشى ولا يُعاد تقديرُ
      // تتابعها ولا اتجاه حاويتها (يفعل ذلك سلفُها، وحاويته تحويها)، إلا عقدةَ نصٍّ في سجلّنا (معرَّبةٌ نُقلت) فتُعامل كما كانت. ومواضعُ الحساب
      // (markComputedSurfaces) لكل عنصرٍ كما كانت: سقفُها 300 لكل نداءٍ يجعل نداء السلف وحده غير مكافئ
      walkPruned = true;
      var BR = batchRoots(added);
      for (var i = 0; i < BR.length; i += 2) {
        var nd = BR[i], cov = BR[i + 1];
        if (cov) {
          if (nd.nodeType === 1) { markComputedSurfaces(nd); markIcons(nd); }
          else if (appliedText.has(nd)) translateText(nd);
          continue;
        }
        if (nd.nodeType === 1) {
          walk(nd);
          // ★ (ر24-أ، CX-001) عنصرٌ محميٌّ (أو فيه محميّ) أُدرج في تتابعٍ داخل المتن لا يمشيه walk: يُعاد تقدير تتابعه من مالكه (مع الإزالات أدناه)
          // فيُرفض كلّه ويُرجع ما كتبناه في نصّه المؤهَّل — لا تبقى جملةٌ معرَّبة حول محتوى مستخدم. بالشكل وحده (لا يُقرأ نصُّ المُدرَج)
          if (BODIES_ON && nd.parentNode && nd.parentNode.nodeType === 1 && inBody(nd.parentNode) && SHARED.blockShape(nd, null, blockP()) === "x") rems.add(nd.parentNode);
          // ★ فقرةٌ يبثّها الموقع داخل حاوية رسالةٍ سبق معالجتها: applyChatDir تنظر إلى الأسفل
          // فلا تجد الحاوية، فكانت الكتل المبثوثة (60/60 مقيسًا) تبقى بلا dir حتى مرورٍ كامل
          // مصادفةً — فتُعرض العربية بعد فاتحةٍ إنجليزية LTR. الحاويةُ الحاضنة هي النطاق.
          dirRoots.add((DIRSEL && nd.closest && nd.closest(DIRSEL)) || nd);
          // المواضع المحسوبة تظهر مع فروعها المستجدّة (قائمة تُفتح، لوحة تُركَّب)،
          // والمرور الكامل وحده كان يفوّتها حتى المرور التالي — فتظهر مقلوبةً لحظتَها
          markComputedSurfaces(nd);
          markIcons(nd); // ★ (ر30-ب) والأيقونات الاتجاهية في الفرع المستجدّ
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
        var owners = new Set(), remP = blockP();
        rems.forEach(function (t) {
          if (!t.isConnected || !inBody(t)) return;
          var ow = t;
          // ★ (ر24-أ، CX-001) بالشكل وحده (العناصر لا النص): الصعود إلى المالك لا يقرأ ما في السطريّ المحميّ
          while (ow && ow.nodeType === 1 && SHARED.blockShape(ow, null, remP) !== null) ow = ow.parentNode;
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
      walkPruned = false;
      dirRoots.forEach(function (r) { if (r.isConnected) applyChatDir(r); });
      newPass();
      texts.forEach(function (n) { if (n.isConnected) translateText(n); });
      attrs.forEach(function (n) { if (n.isConnected) translateAttrs(n); });
      // ★ (ر7-ب) عنوانٌ عُرّب أو أُرجع في هذه الدفعة: لافتات صداه تتبعه (وما سوى ذلك لا يغيّر عنوانًا معروضًا: اللافتة نفسُها إن بدّلها
      // الموقع مرّت بـtranslateText في الدفعة)
      if (echoDirty) echoAll();
      // ★ (مراجعة ر13-أ) متنٌ كبر في هذه الدفعة بعد حكمٍ لم يحجبه ولم يُكتب فيه من القطعة شيء: يُعاد حكمه (meta.bodyRejudge)
      bodyRejudge();
      langSync(); // ★ (ر13-ج — E-lang) وسمة lang لما كُتب أو أُرجع في الدفعة
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
  // ★ (ر24-ج2، ١٠ جمادى الأولى ١٤٤٨هـ — مراجعة Codex CX-008) سجلُّ ملكيةٍ لكل عنصر {o: الأصل، w: آخر ما كتبناه} (null: لا سمة)، كسجلّات النص
  // والسمات ولغة الجذر واتجاهه. كان الإرجاع يضع الأصل الأول بلا شرط، فيدهس dir كتبه الموقع بعدنا (‎ltr‎ ثم كتابتنا ثم ‎rtl‎ من الموقع ثم
  // الإطفاء: يعود ‎ltr‎). فقيمةٌ تخالف آخر ما كتبناه كتبها الموقع: تصير الأصلَ الجديد قبل كتابتنا التالية (dirRec)، ولا يُرجَع شيءٌ إلا والقيمة
  // الحاضرة ما كتبناه نحن (restoreDir) — وإلا تبقى قيمة الموقع ويسقط سجلّنا. والغياب غير القيمة: أصلٌ بلا سمة يعود بلا سمة
  var chatDirRec = new WeakMap(), everDir = false;
  function dirRec(el) {
    var cur = el.getAttribute("dir"), r = chatDirRec.get(el);
    if (!r) { r = { o: cur, w: cur }; chatDirRec.set(el, r); }
    else if (cur !== r.w) { r.o = cur; r.w = cur; }
    return r;
  }
  function writeDir(el, r, v) {
    if (v === null) { if (el.hasAttribute("dir")) el.removeAttribute("dir"); }
    else if (el.getAttribute("dir") !== v) el.setAttribute("dir", v);
    r.w = v; everDir = true;
  }
  function restoreDir(el) {
    var r = chatDirRec.get(el);
    if (r && el.getAttribute("dir") === r.w) writeDir(el, r, r.o);
    chatDirRec.delete(el);
    el.removeAttribute("data-cml-dir");
  }
  // ما أُدرج والإضافة موقفةٌ كلّها (عنصرٌ فُصل ونحن نعمل ثم أُعيد بعد الإيقاف): يُرجع اتجاهه بالشرط نفسه — بالعناصر وحدها
  function restoreDirIn(root) {
    if (root.nodeType !== 1) return;
    if (root.hasAttribute("data-cml-dir")) restoreDir(root);
    var m = root.querySelectorAll("[data-cml-dir]");
    for (var i = 0; i < m.length; i++) restoreDir(m[i]);
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
  // ★ (ر12-ب، ٥ جمادى الأولى ١٤٤٨هـ — الفحص الحيّ لـت8، M2 وL2) أو كتبها مسار العقدة الواحدة ترجمةً داخل المتن (قاموس الواجهة: «خطتا Team
  // وEnterprise») وما زالت كما تركها — لا عزلُ لافتةٍ لاتينية (iso) فليس ترجمة — أو هي في مالك كتلةٍ مُبقاة (blkOwnersKeep): نصُّ العنصر كلُّه
  // ممّا قرّرناه، بلغة الهدف أو إبقاءً. والمُبقى غيرُ الآمن (جملةٌ إنجليزية تنتهي بنقطة) يُعدّ للحاوية فوق مالكه وحدها (البند وغلاف القائمة)، لا
  // للمالك نفسه ولا لما داخله: يبقى جزيرةً من اليسار بترتيبها، ونقطةُ البند يمينًا كإخوته. ولا يُعدّ المُبقى في جدولٍ ولا لحاويةٍ فيها جدول:
  // اتجاه الجدول ترتيبُ أعمدته، وقاعدته (ر5-ج) تُبقي الجدول الإنجليزي كلَّه على حاله
  function decidedOnly(el) {
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), t, any = false, memo = new WeakMap(), keepOk = null;
    while ((t = tw.nextNode())) {
      if (!/\S/.test(t.nodeValue || "")) continue;
      var o = SHARED.blockOwner(t, rawOfNode, memo);
      if (!o) continue;
      var r = appliedText.get(t);
      if (r && !r.iso && t.nodeValue === r.lastWritten) { any = true; continue; }
      var safe = blkOwnersKeep.get(o.owner);
      if (safe === undefined) return false;
      if (keepOk === null) keepOk = !(el.closest && el.closest("table")) && !el.getElementsByTagName("table").length;
      if (!keepOk || (!safe && !(o.owner !== el && el.contains(o.owner)))) return false;
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
    var dr = dirRec(el);   // ★ (ر24-ج2، CX-008) السجلّ قبل أي كتابة: ما كتبه الموقع بعدنا أصلٌ جديد
    // كتلةٌ ترجمها وضع الكتلة كلَّها: اتجاه لغة الهدف بلا عدّ (انظر blkOwnersTr)
    if (BODIES_ON && blkOwnersTr.has(el) && active && active.dir) {
      writeDir(el, dr, active.dir);
      return;
    }
    // ★ (ر6-هـ، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ لـت4، O2) حاويةٌ نصُّها كلُّه تسمياتُ رسمٍ SVG (‎<figure>‎ المخطط في الوثائق): اتجاه الرسم الأصلي
    // LTR، لا اتجاهٌ يُحكم بتسمياته المعرَّبة. مواضع نصوص الرسم أرقامٌ ثابتة رُسمت لـLTR، ومرساةُ «start» تتبع اتجاه النص: كانت حاويةُ مخططَي صفحة
    // التفكير المحفوظ (preserved-thinking) تُحكم RTL لأن أكثر تسمياتها عربية، فترث النصوصُ RTL وتمتدّ تسمياتُ «start» يسارًا فتُقصّ 11 منها عند
    // حافة الرسم؛ والموقع بلا الإضافة لا يضع عليها اتجاهًا (LTR). وسائر مخططات الوثائق نالت dir="auto" فصارت LTR بأول حرفٍ لاتيني فيها مصادفةً —
    // ومخططٌ أول تسمياته عربية كان سيصير RTL كذلك. والعربية في التسميات معزولةٌ بـRLI…PDI (svgIsolate) فتُقرأ من اليمين داخل الرسم LTR.
    // (سمة dir على عناصر SVG نفسها لا أثر لها في كروم — قِيس — فالحاوية HTML هي موضعها)
    if (!CHAT_ON && svgTextOnly(el)) {
      writeDir(el, dr, "ltr");
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
        writeDir(el, dr, active.dir);
        return;
      }
    }
    // ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر6، السبب D1) فقرة Mintlify السطرية <span data-as="p"> (تُحسم وحدها منذ ر5) لا تنال عضوية
    // blkOwnersTr — مالكُ كتلتها اللوحةُ كلُّها لا هي — فكان resolveDir يعدّ حروفها ومعها الشيفرة السطرية فيحكم LTR على فقرةٍ عربية أكثرُها
    // شيفرة («اسم الحدث: claude_code.tool_result»، 93 فقرةً في 34 صفحة). فإن كانت كلُّ عقد نصّها ذات الحروف خارج الذرّات كتاباتٍ لوضع الكتلة
    // كما تركناها (ترجمةٌ يقينًا، decidedOnly — وكان اسمها blkWrittenOnly) فاتجاهها اتجاه اللغة بلا عدّ — كما يُفعل بالمالك في blkOwnersTr
    // ★ (ر6-ب، المراجعة) والرابط <a> كذلك: بندُ الفهرس (#table-of-contents li > a في Claude Code، وnav li > a في الوثائق) ابنٌ مباشرٌ لجذر
    // الاتجاه فيُحكم وحده بعدّ حروفه، فترجمةٌ أكثرُ حروفها لاتينية («تثبيت Claude Code»، «3. تهيئة Claude Code») كانت تُعرض LTR داخل بندٍ RTL،
    // وعنوانُها نفسه في المتن RTL (40 بندًا في 17 من الصفحات الـ35 على 1366؛ ولا فهرس على 390)
    // ★ (ر12-ب، ٥ جمادى الأولى ١٤٤٨هـ — الفحص الحيّ لـت8، M2) وكلُّ حاويةٍ كذلك لا الفقرة السطرية والرابط وحدهما: بندُ القائمة في Intercom
    // (li > div > p) ليس مالك كتلته — المالكُ الفقرة — فكان يُحكم بعدّ حروفه: ترجمةٌ أكثرُ حروفها لاتينية («ضمن Platforms، اختر «iOS/iPadOS»:»)
    // تعطيه dir=ltr، وما دون الأغلبية dir=auto الذي يتخطّى الفقرة ذات الاتجاه فلا يجد قويًّا فيصير LTR — فرقمُ البند ونقطته وهامشه يسارًا (60 بندًا في
    // 22 صفحة من فحص ت8، منها 10 في مقالة Intune). وغلافُ القائمة كذلك. فالعنصر الذي نصُّه كلُّه ممّا قرّرناه (decidedOnly: ترجمةٌ في موضعها أو
    // مُبقًى آمنٌ — L2) اتجاهُه اتجاه اللغة بلا عدّ، وما فيه نصٌّ لم يُقرَّر (إنجليزيٌّ لم يُعرَّب) يبقى لحكم نصّه كما كان
    if (BODIES_ON && !CHAT_ON && active && active.dir && decidedOnly(el)) {
      writeDir(el, dr, active.dir);
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
        writeDir(el, dr, "ltr");
        return;
      }
      writeDir(el, dr, dr.o);
      return;
    }
    writeDir(el, dr, want);
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
        var kids = Array.prototype.slice.call(el.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dd, dt, figcaption, span[data-as=\"p\"]" +
          // ★ (ر29-د — ر29-ج §٨) وخارج المحادثة خلايا الجدول المبنيّ بعناصر div بأدوارها (جدول legal/privacy): كانت القاعدة td وth وحدهما فبقيت
          // خليّةٌ إنجليزيةٌ خالصة محسوبةً من اليمين. والمحادثة في claude.ai على حالها المقيس
          (CHAT_ON ? "" : ", [role=cell], [role=gridcell], [role=columnheader], [role=rowheader]")));
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
  function setScan(o) { try { var w = {}; w[K_SCAN] = withSel(o); chrome.storage.local.set(w); } catch (e) {} }
  // ★ (ر29-د) صحة محدِّدات النطاق في هذه الصفحة مع النتيجة النهائية لـ«فحص الترجمة» و«فحص الاتجاه»: حجزُ «nosel»، وكل مفتاحٍ لا يطابق شيئًا في مسار
  // متن (المتن، والاتجاه، ومنتقي اللغة) — بأسماء المفاتيح والمسار وحدها، لا نصَّ من الموقع
  function selHealth() {
    var out = { held: noselNow() ? "nosel" : null, miss: [], page: location.pathname };
    if (!bodyRouteNow()) return out;
    // ★ (مراجعة ر29-د) ولا يُحكم على الإبقاء في صفحةٍ واحدة (كما في sel-health.mjs: PAGE_KEYS): محدِّد إبقاء وثائق المطوّرين لمرجع الواجهة
    // البرمجية وحده، فكان فحصُ أي صفحة شرحٍ يقول «تغيّرت بنية الصفحة» وهي سليمة
    // ★ (ر29-د2، F4) والحاوية الرئيسة مفتاحٌ بنفسها: المحدِّد المركّب يطابق بجزئه الثانوي وحاويتُها ساقطة
    var K = [["bodySel", META.bodySel], ["bodyMain", META.bodyMain], ["dirSel", META.dirSel], ["siteLangSel", META.siteLangSel]];
    // ★ (مراجعة ر29-د2) والمفتاح الذي يحكم به الصمّام (bodyMain، أو bodySel بلا حاوية) يُحكم هنا بحكمه نفسه (mainFound: جذرٌ ظاهر، لا مخبوءٌ
    // لصفحةٍ سابقة): كان querySelector يعدّ الحاوية المخبوءة فتقول النتيجة «محجوزة» بلا مفتاحٍ ساقط (مرجعٌ مخبوء ثم شرحٌ تغيّر اسم حاويته)
    var MK = META.bodyMain ? "bodyMain" : "bodySel";
    for (var i = 0; i < K.length; i++) {
      if (typeof K[i][1] !== "string" || !K[i][1]) continue;
      var hit = false;
      if (K[i][0] === MK) hit = mainFound();
      else { try { hit = !!document.querySelector(K[i][1]); } catch (e) { hit = false; } }
      if (!hit) out.miss.push(K[i][0]);
    }
    return out;
  }
  function withSel(o) {
    if (!o || o.status !== "done") return o;
    try { o.sel = selHealth(); } catch (e) {}
    return o;
  }

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
      // ★ (ر24-د2، مراجعة ر24-د F-05) بحكم «فحص الاتجاه» نفسه (SHARED.scanUrlOk): https وحدها والمضيفون أنفسهم — كان يقبل http لعائلة claude.ai
      function ours(u) { return SHARED.scanUrlOk(u.href, location) !== null; }
      var HASHED = /\/[A-Za-z0-9_.]+-[A-Za-z0-9_-]{6,}\.[cm]?js(\?|$)/;
      function pickBy(test) {
        for (var pass = 0; pass < 2; pass++) {          // 0: أصل الصفحة  1: عائلة claude.ai
          for (var j = 0; j < scripts.length; j++) {
            var u = urlOf(scripts[j]);
            if (!u) continue;
            if (!ours(u) || (pass === 0 && u.origin !== location.origin)) continue;
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
      // ★ (ر29-ي، توجيه المالك: لا يبقى نصُّ موقعٍ بالإنجليزية لعلّةٍ تقنية) والحرفية المائلة (`…`) بلا استيفاء ‎${}‎ رسالةٌ كغيرها، كما يقرؤها
      // harvest-live: كانت 95 رسالةً في 23 حزمة من claude.ai (174 فقرةً تُقبل، 77 منها غير مترجمة) لا تبلغ «فحص الترجمة» أبدًا. وما فيه ‎${‎ لا يطابق أصلًا (كأداة الحصاد): نصُّه يُبنى
      // وقت التشغيل فلا مفتاح ثابتًا له يترجمه المحرّك (ولا شيء منه في حزم اليوم)
      var DM = /(?:"?defaultMessage"?):\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\$]|\\[\s\S]|\$(?!\{))*)`)/g;
      // المرشّح الرمزي (بلا «~»: له حكمه في takeMsg) — نصُّه كما في harvest-live
      var SYM_RE = /^[#\/]|^\d|https?:|www\.|[@\\^`|=]/;
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
          var s0 = m[3] != null ? SHARED.unescapeTemplate(m[3]) : unescapeLiteral(m[1] != null ? m[1] : m[2], m[1] == null);
          if (s0 === null) continue;                      // تعذّر الفكّ ⇒ تجاهُل، لا نصّ مشوّه
          // ★ (ر29-ي) الحرفية المائلة متعددة الأسطر: فقراتها (بسطرٍ فارغ) عقدٌ مستقلة في الصفحة عادةً، والمحرّك يطابق نصَّ العقدة كما هو —
          // فالمضموم كله مفتاحٌ لا يُرى أبدًا. تُعدّ الفقرات كما يحصدها harvest-live، وكلٌّ منها يمرّ بالمرشّحات نفسها
          var parts = m[3] != null ? s0.split(/\n[ \t]*\n/) : [s0];
          for (var pi = 0; pi < parts.length; pi++) takeMsg(parts[pi]);
        }
      }
      function takeMsg(s0) {
        // ★ (ر29-ك — توجيه المالك: لا يُخفى نصُّ موقعٍ إنجليزيٌّ عن تصدير المالك) المفتاح مفتاحُ المحرّك نفسه: textKey يقصّ الطرفين ولا يضمّ ما بينهما،
        // فعقدةُ نصٍّ فيها سطرٌ جديد أو مسافةٌ خاصة (‎U+00A0‎) تُطلب في القاموس بها. وكان الماسح يضمّ البياض قبل السؤال، فرسالةٌ لا يحفظ القاموس إلا صيغتها
        // المضمومة تُعدّ مترجمةً وهي على الصفحة بالإنجليزية (39 في حزم claude.ai العامة: 38 بأسطرها و1 بمسافةٍ خاصة؛ جرّبها المحرّك الحقيقي فبقيت كلها
        // إنجليزية)، وما يحفظه القاموس بأسطره لا يطابقه المضموم. والمرشّحات بعده على المحتوى المضموم كما كانت، فلا يتغيّر ما يُقبل، بل مفتاحُه وحده
        var k = SHARED.textKey(s0, Infinity);
        var s = s0.replace(/\s+/g, " ").trim();
        // ★ (ر29-ط، ١٩ جمادى الأولى ١٤٤٨هـ — توجيه المالك: لا يمنع سقفُ طولٍ تعريبَ نصّ موقع) لا سقف طول: كان ما يزيد على TEXT_MAX (300 حرف)
        // يُتخطّى، فلا يبلغ تصديرَ المالك نصٌّ طويلٌ غير مترجم أبدًا، والمحرّك يترجمه مهما طال (KEY_MAX). والمرشّحات بعده بالمحتوى لا بالطول، والحماية أن
        // الماسح لا يقرأ إلا رسائل الواجهة (defaultMessage) في حزم الموقع العامة، وحدُّ الحجم SCAN_MAX_BYTES لما يُخزَّن (classifyMissing) بعدِّ ما يبقى خارجه
        if (!s || s.length < 2) return;
        if (!/[A-Za-z]/.test(s)) return;
        if (CTRL_RE.test(s)) return;                    // محارف تحكّم: صار الفكّ يقبلها
        if (SYM_RE.test(s) || /^[a-z]+([A-Z][a-z]+)+$/.test(s) || (/_/.test(s) && !/ /.test(s))) return;
        // ★ (ر29-ي) «~» لا يُسقط نثرًا: مسارٌ في البيت (‎~/.ssh/known_hosts‎) أو تقريبٌ (‎~{count}‎، ‎~24‎) داخل جملةٍ نصُّ واجهة — كان أيُّ «~»
        // يُسقط الرسالة، فبقيت 58 رسالةً من claude.ai لا يُسقطها غيره خارج «فحص الترجمة» (منها اثنتان فوق 300 حرف، و24 غير مترجمة). وما لا بياض فيه
        // (مسارٌ وحده ‎~/.aws‎، أو رمزٌ برمجي) ليس نثر واجهة فيبقى مُسقَطًا
        if (/~/.test(s) && !/\s/.test(s)) return;
        // كتل ICU (جمع/اختيار) خارج نطاق التوليد التلقائي — تحتاج فئات العربية الست
        if (/\{[^{}]*,\s*(plural|select|selectordinal)\s*,/.test(s)) return;
        if (/<\/?[A-Za-z][^>]*>/.test(s)) return; // وسوم HTML داخل النص
        // نقبل الآن النصوص ذات المتغيّرات {name} — تُحوَّل إلى أنماط عند الاستيراد
        if (/\{/.test(s) && !/^[^{}]*(\{[A-Za-z_$][\w$]*\}[^{}]*)+$/.test(s)) return;
        if (!msgs[k]) { msgs[k] = 1; found++; }
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
          // ★ (ر24-د2، مراجعة ر24-د F-05) ولا يتبع تحويلًا: حزمةٌ تحوّل إلى أصلٍ آخر لا يُطلب هدفها، وتُعدّ إخفاقًا (جولة الإعادة ثم «الناقص»). وقيس قبلُ
          // (٢٠ جمادى الأولى ١٤٤٨هـ): زحفُ الحزم كلها من ملف الدخول على مضيف أصول claude.ai، 2,680 ملفًّا (2,656 بـ200 و24 بـ404)، بلا تحويلٍ واحد
          return fetch(base + n, { credentials: "omit", redirect: "error", signal: ctrl ? ctrl.signal : undefined })
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
          status: "done", fetched: fetched, found: found, capped: c.capped, omitted: c.omitted, omittedVars: c.omittedVars,
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
    if (KEEP[s] === 1) return true;
    // ★ (مراجعة ر29-ك، ١٩ جمادى الأولى ١٤٤٨هـ) وبصيغته المضمومة: صار مفتاحُ الماسح نصَّ العقدة بأسطره، وقائمة الإبقاء كُتبت من تصديرٍ مضموم،
    // فمثالُ شهادةٍ في حقلٍ يبقى بالإنجليزية (رسالةٌ بأسطرها في حزم claude.ai العامة) صار يُسرد «غير مترجَم» في «أمر الترجمة» وهو مُبقًى بقرار.
    // والإبقاء لا يكتب شيئًا في الصفحة، فلا يتغيّر به ما يعرّبه المحرّك ولا ما يطابقه؛ يتغيّر حكمُ الماسح وحده: ما أُبقي مضمومُه مُبقًى بأسطره
    var c = s.replace(/\s+/g, " ").trim();
    return c !== s && KEEP[c] === 1;
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
    // فلو حُسبت من المقصوص كذبت متى تجاوز غيرُ المترجَم السقف، فتظهر التغطية أفضل مما هي. أما العدّ فيبقى صادقاً.
    // ★ (ر29-ز، ١٩ جمادى الأولى ١٤٤٨هـ — توجيه المالك: كل سقفٍ تقني يُبقي نصّ الموقع بالإنجليزية عيب) كان السقف 4,000 سطر (SCAN_CAP)،
    // فأسقط تصديرُ المالك في ١٨ جمادى الأولى خمسة أسطرٍ ثابتة بلا كلمة. فلا سقف عدد: القائمتان تُخزَّنان كاملتين ما دام حجمهما دون
    // SCAN_MAX_BYTES (بايتات UTF-8 للنصوص؛ 4,005 أسطر نحو 0.2 م.ب، والحدّ 2 م.ب) حمايةً لسعة التخزين المحلي (الإذن storage وحده). وإن
    // جاوزتاه — ولا حالة له اليوم — قُصّتا بترتيبهما (للمتغيّرات نصف الحدّ على الأقل، والباقي للثابتة) وسُجّل ما بقي خارجهما بعدده
    // (omitted، وomittedVars منه)، فتقوله صفحة الإعدادات وملف «أمر الترجمة» صراحةً مع طريق الحصول عليه، ولا يسقط سطرٌ بصمت
    var missingTotal = plain.length + vars.length, MAXB = CONST.SCAN_MAX_BYTES;
    var fit = fitScanLists(plain, vars, MAXB);
    return { plain: fit.plain, vars: fit.vars, missing: missingTotal, capped: fit.omitted > 0, omitted: fit.omitted,
      omittedVars: fit.omittedVars, kept: nKept, badge: nBadge };
  }
  // حجم النصّ كما يُخزَّن: بايتات UTF-8 وعلامتا الاقتباس والفاصلة وتهريب JSON (لا يقلّ عن حجمه في JSON، فلا يُفاجأ الحدّ)
  function scanBytes(s) {
    var n = 3;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      n += c < 0x80 ? (c === 34 || c === 92 ? 2 : 1) : c < 0x800 ? 2 : (c >= 0xd800 && c <= 0xdbff) ? 2 : 3; // الاقتباس والشرطة المائلة مهرَّبان
    }
    return n;
  }
  function takeBytes(list, max) {
    var n = 0, i = 0;
    for (; i < list.length; i++) { var b = scanBytes(list[i]); if (n + b > max) break; n += b; }
    return { list: i < list.length ? list.slice(0, i) : list, bytes: n };
  }
  function fitScanLists(plain, vars, max) {
    if (!(max > 0)) return { plain: plain, vars: vars, omitted: 0, omittedVars: 0 };
    var pAll = takeBytes(plain, Infinity).bytes, vAll = takeBytes(vars, Infinity).bytes;
    if (pAll + vAll <= max) return { plain: plain, vars: vars, omitted: 0, omittedVars: 0 };
    var v = takeBytes(vars, Math.max(max - pAll, Math.floor(max / 2)));
    var p = takeBytes(plain, max - v.bytes);
    return { plain: p.list, vars: v.list, omitted: (plain.length - p.list.length) + (vars.length - v.list.length),
      omittedVars: vars.length - v.list.length };
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
      // ★ (ر29-ط) ولا سقف طول هنا كذلك: العنوان وعنوان المجموعة يُعدّان مهما طالا (كان ما فوق TEXT_MAX يُتخطّى)
      if (!t || t.length < 2 || !/[A-Za-z]/.test(t) || CTRL_RE.test(t)) return;
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
      if (SHARED.routeMode(DOMAIN_META.routes, path) === "inactive") continue; // (ر20-ج) فحص النطاق بمسارات الوثائق في كل منظر
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
          status: "done", source: "llms", fetched: 1, found: p.found, capped: c.capped, omitted: c.omitted, omittedVars: c.omittedVars,
          failed: 0, ghosts: 0,
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
  function setRtlDoc(o) { try { var w = {}; w[K_RTLDOC] = withSel(o); chrome.storage.local.set(w); } catch (e) {} }
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
    var covSet = {}, shippedN = COV.keys.length;
    for (var c = 0; c < COV.keys.length; c++) covSet[COV.keys[c]] = 1;

    // ★ (ر24-د2، مراجعة ر24-د F-05) https وحدها (وhttp لأصل صفحة اختبارٍ محلية http لا غير)، والمضيفون أنفسهم — SHARED.scanUrlOk، وهي حكم فحص الحزم أيضًا.
    // وأوراقنا chrome-extension تُستبعد هنا
    function urlOk(u) { return SHARED.scanUrlOk(u, location); }
    var urls = [], mediaOf = {};
    var links = document.querySelectorAll("link[rel='stylesheet'][href]");
    for (var i = 0; i < links.length; i++) {
      var ok = urlOk(links[i].href);
      if (ok && urls.indexOf(ok) === -1) { urls.push(ok); mediaOf[ok] = (links[i].getAttribute("media") || "").trim(); }
    }
    // ★ (ر8-ب) بلا بيانات اعتماد كالحزم في فحص الترجمة وكعامل الخدمة حين يبني الورقة الحيّة من هذه الأوراق نفسها: ملفات تصميمٍ عامة لا
    // تحتاج ملفات تعريف الارتباط (مراجعة ر8-أ، F15). وأوراق claude.ai في لقطة الموقع (sitecss/_manifest.json) كلها من
    // assets-proxy.anthropic.com فلا يتغيّر فيها شيء؛ ويمتحنه _scantest
    // ★ (ر24-د2، مراجعة ر24-د F-05) ولا يتبع تحويلًا (redirect:"error"، كجلب العامل للورقة الحيّة وجلب llms.txt): ورقةٌ تحوّل إلى أصلٍ آخر لا يُطلب هدفها
    // أصلًا وتُعدّ متعذّرة. وقيس قبلُ (٢٠ جمادى الأولى ١٤٤٨هـ) على مضيف أصول claude.ai العامّ: أوراق آخر لقطة متصفح (8) وكل ورقةٍ تسمّيها الحزم (30)، بلا تحويلٍ ولا ‎@import‎
    function fetchCss(u) {
      return Promise.race([
        fetch(u, { credentials: "omit", redirect: "error" }).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; }),
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
      var failed = 0, rulesN = 0, physical = 0, covered = 0, animatedPhysical = 0, siteRtl = 0;
      var uncovered = [], unflippable = [], localSeen = {};
      // ★ (ر29-ب) تُحلَّل الأوراق كلها أولًا: متغيّرات الموقع تحت RTL قد تُعرَّف في ورقةٍ وتُستهلك في أخرى (حارس المولّد نفسه، rtlVarsOf)
      var parsed = [], allRules = [];
      function parseSheet(tx, media) {
        if (tx === null) { failed++; return; }
        var p = RTL.parseCss(tx);
        p.media = media && !/^(?:all|screen)$/i.test(media) ? media : ""; // ★ (ر30-ب2) وسيط الرابط (للأساس الحيّ، ctxOf)
        parsed.push(p);
        for (var q = 0; q < p.rules.length; q++) allRules.push(p.rules[q]);
      }
      for (var x0 = 0; x0 < texts.length; x0++) parseSheet(texts[x0], x0 < urls.length ? mediaOf[urls[x0]] : "");
      for (var y0 = 0; y0 < inlineTexts.length; y0++) parseSheet(inlineTexts[y0]);
      var rtlVars = RTL.rtlVarsOf(allRules);
      /* ★ (ر30-ب2، ١٤ جمادى الأولى ١٤٤٨هـ — حدّا «فحص الاتجاه»، R29B §٤ وR30B §٨) يقارن الفحص بما هو مطبَّقٌ فعلًا:
       *   ١) الورقة الحيّة إن كانت هي المطبَّقة (‎html[data-cml-rtl="live"]‎): تُبنى بصماتُ تغطيتها من نصوص الأوراق نفسها التي بُنيت منها (liveSheets،
       *      بعناوينها ووسائطها وبالمحرّك نفسه، buildLiveSheet) — ولا تُقارن ببصمات اللقطة المشحونة (rtl-coverage.js)، وهي خامدةٌ ما دامت الحيّة عاملة؛
       *      فكان كلُّ ما تقلبه الورقة الحيّة مما ليس في اللقطة يظهر ثغرة (98 من 118 في ملف المالك). والبصمةُ (liveFp) تُطابَق ببصمة الورقة المطبَّقة:
       *      إن تبدّلت أوراق الموقع منذ بنائها فالأساس «live-stale» (بصماتُ الأوراق الحاضرة، تقريبًا حتى يُعاد البناء)؛
       *   ٢) واللقطة إن لم تكن الحيّة مطبَّقة (أو تعذّر بناء بصماتها هنا).
       * والأساسُ في النتيجة (basis) وعددُ بصماته (shipped). */
      var basis = "snapshot", html0 = document.documentElement, liveEl = document.getElementById("cml-live-rtl");
      if (liveEl && html0.getAttribute("data-cml-rtl") === "live") {
        var ls = liveSheets(), recs = [], allIn = ls.length > 0;
        for (var li = 0; li < ls.length && allIn; li++) {
          if (!ls[li].url) { recs.push({ text: ls[li].inline, base: null, media: ls[li].media }); continue; }
          var at = urls.indexOf(urlOk(ls[li].url));
          if (at === -1 || texts[at] === null) allIn = false;
          else recs.push({ text: texts[at], base: ls[li].url, media: ls[li].media });
        }
        var built = null;
        if (allIn) { try { built = RTL.buildLiveSheet(recs, {}, {}); } catch (e) { built = null; } }
        if (built && built.coverage) {
          covSet = {};
          for (var cv = 0; cv < built.coverage.length; cv++) covSet[built.coverage[cv]] = 1;
          basis = liveFp(ls) === liveEl.getAttribute("data-fp") ? "live" : "live-stale";
          shippedN = built.coverage.length;
        }
      }
      if (rtlGrant) rtlGrant.beat();
      // وسيطُ الورقة في الأساس الحيّ سياقٌ على قواعدها (‎@media …‎) كما يبنيها المحرّك الحيّ، فبصمةُ الإعلان ببصمة الورقة الحيّة نفسها
      function ctxOf(p, rule) {
        if (basis === "snapshot" || !p.media) return rule.ctx;
        return ["@media " + p.media].concat(rule.ctx || []);
      }
      function chewSheet(p) {
        animatedPhysical += p.stats.animatedPhysical || 0;
        for (var r = 0; r < p.rules.length; r++) {
          var rule = p.rules[r];
          rulesN++;
          // ★ (ر30-ب2) القائمة كما يقسمها القلب (coverageSels): متفاوتةُ التخصيص محدِّدًا محدِّدًا، فلكل جزءٍ نوعُه وحارسُه وبصمتُه كما في المولّد؛
          // وكانت تُبصم كلُّها دائمًا فيظهر المقلوبُ ثغرة (8 في ملف المالك)
          var parts = RTL.coverageSels ? RTL.coverageSels(rule.sel) : [rule.sel];
          // مخرجاتنا (1)، والواعية بالاتجاه (2): سمة dir أو ‎:dir()‎، وشرط RTL باللغة أو بصنف ‎.rtl‎ (ر29-ب) — نوعها عند المولّد نفسه
          if (parts.length === 1) { if (RTL.condKind(rule.sel)) continue; }
          else { parts = parts.filter(function (q) { return !RTL.condKind(q); }); if (!parts.length) continue; }
          var ctx = ctxOf(p, rule);
          for (var d = 0; d < rule.decls.length; d++) {
            var a = RTL.analyzeDecl(rule.decls[d].prop, rule.decls[d].value);
            // ★ (مراجعة ر30-ب) تدرّجٌ بزاوية وموضعُ بلاطته في القاعدة لا ينقلب: عجزٌ كما في المولّد والورقة الحيّة (gradPlacementKept)
            if (a && a.grad && RTL.gradPlacementKept && RTL.gradPlacementKept(rule.decls, d)) a = { kind: "physical-unflippable", reason: "gradient-angle" };
            if (!a || a.kind === "logical") continue;
            // ★ (ر29-ب) مستهلكُ متغيّرٍ يبدّله الموقع تحت RTL: الموقع يعالج جهته، فلا يُعدّ فجوةً ولا متعذّرًا (ولكل جزءٍ من القائمة المقسومة حارسُه)
            var own = [];
            for (var pq = 0; pq < parts.length; pq++) if (!RTL.rtlVarHeld(rule.decls[d].value, rtlVars, parts[pq])) own.push(parts[pq]);
            if (!own.length) { siteRtl++; continue; }
            physical++;
            if (a.kind === "physical-unflippable") {
              if (unflippable.length < 50) unflippable.push({ sel: rule.sel.slice(0, 120), prop: rule.decls[d].prop, reason: a.reason });
              continue;
            }
            var keys = [], miss = [];
            for (var kq = 0; kq < own.length; kq++) {
              var key = RTL.coverageKey(ctx, own[kq], rule.decls[d].prop);
              keys.push(key);
              if (!covSet[key]) miss.push(own[kq]);
            }
            var id = keys.join(",");
            if (localSeen[id]) continue;
            localSeen[id] = 1;
            if (!miss.length) { covered++; continue; }
            if (uncovered.length < CONST.RTLDOC_CAP) {
              // (وفي القائمة المقسومة: الأجزاء التي لم تُقلب وحدها)
              uncovered.push({ sel: (parts.length === 1 ? rule.sel : miss.join(", ")).slice(0, 120), prop: rule.decls[d].prop, value: rule.decls[d].value.slice(0, 80) });
            }
          }
        }
      }
      for (var x = 0; x < parsed.length; x++) chewSheet(parsed[x]);
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
        siteRtl: siteRtl, // ★ (ر29-ب) فيزيائيٌّ جهته من متغيّرٍ يبدّله الموقع تحت RTL — لا يُقلب ولا يُعدّ فجوة
        inlinePhysical: inlinePhysical, inlineChecked: lim,
        shipped: shippedN, basis: basis, // ★ (ر30-ب2) أساس المقارنة: "live" أو "live-stale" أو "snapshot"، وعدد بصماته
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
  /* ★ (ر24-ب2، ١٢ جمادى الأولى ١٤٤٨هـ — مؤشر التبويبات في الوثائق القانونية، الصنف 51204596b9cb) مؤشرٌ من مكوّن تبويباتٍ (Base UI) يجمع
   * ‎left:0‎ إلى ‎translate: var(--active-tab-left) -50%‎ وينتقل بـ‎transition-property: translate, width‎، والإزاحةُ يقيسها سكربت الموقع من
   * offsetLeft للتبويب النشط ويكتبها متغيّراتٍ سطرية على المؤشر نفسه. ففاته الوسم من جهتين: صنفُه لا يطابق المحدِّد أعلاه، وتوقيعُه كان
   * transform وحده (فالخاصية المستقلة translate لم تكن تُعدّ). فقلبُ مرساته إلى اليمين يقذفه عن التبويب النشط (450 بكسلًا في قائمةٍ عرضها 600).
   * مرشّحان رخيصان جديدان، لكلٍّ سقفُه كي لا يزاحما الأول:
   *   ١) [class*="ndicator"]: يُرى عند الإدراج ولو كتب السكربت متغيّراته بعده (المكوّن يُدرج المؤشر مخفيًّا بلا نمطٍ ثم يقيس) — وفي لقطات
   *      المواقع كلِّها ثلاث قواعد «indicator» بانتقال إزاحة، كلُّها مؤشرات تبويبٍ مرساتها left:0 وإزاحتها متغيّرٌ يكتبه السكربت؛
   *   ٢) [style*="--"]: متغيّرٌ سطريٌّ على العنصر نفسه، وهو صورة الإزاحة التي يكتبها السكربت أيًّا كان اسم الصنف.
   * والتوقيع فيهما أضيق: انتقالٌ أو will-change يسمّي transform أو translate صراحةً — لا «all» (شائعٌ في أدوات transition-all). */
  var OFFSET_SELS = ['[class*="ndicator"]', '[style*="--"]'];
  var MOVES_RE = /transform|translate/;
  /* ★ (ر24-ب4، ١٢ جمادى الأولى ١٤٤٨هـ — مراجع ر24-ب2، البند 3) توقيعٌ أضيق للمرشّحَين الجديدين، فلا يُستثنى من القلب ما لا يحرّكه الموقع أفقيًّا:
   *   ١) المتغيّر السطري وحده ([style*="--"]) لا يكفي: يلزم أن يكون للعنصر محرِّكٌ حاضر (transform أو translate غير none) — فالإزاحة التي يكتبها
   *      السكربت متغيّرًا تظهر فيه. صندوقٌ عليه متغيّرٌ سطريٌّ آخر وانتقال transform بلا تحويلٍ أصلًا كان يوسم فلا تنقلب مرساته.
   *      (والمرشّح بالصنف يبقى بلا هذا الشرط: المؤشر يُدرج مخفيًّا قبل أن تُكتب متغيّراته فلا محرِّك له بعد.)
   *   ٢) شريطٌ عمودي (أطول منه عرضًا) لا يُزاح إلا رأسيًّا (لا مركّبة سينية في transform ولا translate، وله مركّبةٌ صادية): مؤشر تنقّلٍ عمودي
   *      يحرّكه السكربت بين البنود، ومرساته الأفقية ثابتةٌ تنقلب مع الصفحة. والمؤشر الأفقي (أعرض منه طولًا) يبقى موسومًا ولو كانت إزاحته
   *      السينية صفرًا على التبويب الأول ومعها توسيطٌ رأسي (‎translate: 0px -50%‎ في الوثائق القانونية).
   * والمرشّح الأول (COMPUTED_SEL) كما كان. */
  var NEED_MOVER = { '[style*="--"]': 1 };
  /* ★ (ر24-ب4، البند 4 — كان قبل ر24-ب2 أيضًا) مؤشرٌ موضعه ‎left:var(--x)‎ وانتقاله ‎left‎ (أو inset): المرساة نفسها هي ما يحسبه السكربت. فيوسم
   * إن سمّى انتقالُه أو will-change المرساةَ صراحةً، وكانت قيمة متغيّرٍ سطريٍّ عليه (بالبكسل) هي موضعه المحسوب من اليسار أو اليمين — أي أن
   * المتغيّر الذي كتبه السكربت هو المرساة (قبل قلبنا يساوي left، وبعده يساوي right). وصندوقٌ ينتقل بـleft ومتغيّره السطري غير موضعه لا يوسم. */
  var ANCHOR_MOVES_RE = /(?:^|,)\s*(?:left|right|inset|inset-inline|inset-inline-start|inset-inline-end)\s*(?=,|$)/;
  function inlineAnchor(el, cs) {
    var st = el.style, L = parseFloat(cs.left), R = parseFloat(cs.right);
    for (var i = 0; st && i < st.length; i++) {
      var nm = st[i];
      if (nm.charAt(0) !== "-" || nm.charAt(1) !== "-") continue;
      var v = String(st.getPropertyValue(nm) || "").trim();
      if (!/^-?\d+(?:\.\d+)?px$/.test(v)) continue;
      var x = parseFloat(v);
      if ((!isNaN(L) && Math.abs(x - L) < 0.5) || (!isNaN(R) && Math.abs(x - R) < 0.5)) return true;
    }
    return false;
  }
  function xyOf(v) {
    // transform: matrix(a,b,c,d,e,f) أو matrix3d(…16) ⇒ [e،f]؛ وtranslate: «X [Y [Z]]» ⇒ [X،Y] (الصفر صفر، وما سواه — والنسبة المئوية — غير صفر)
    if (!v || v === "none") return [0, 0];
    var m = /^matrix(3d)?\(([^)]*)\)$/.exec(v);
    if (m) { var n = m[2].split(","); return m[1] ? [parseFloat(n[12]) || 0, parseFloat(n[13]) || 0] : [parseFloat(n[4]) || 0, parseFloat(n[5]) || 0]; }
    var p = v.split(/\s+/);
    return [/^-?0(?:\.0+)?(?:px|%)?$/.test(p[0] || "0") ? 0 : 1, /^-?0(?:\.0+)?(?:px|%)?$/.test(p[1] || "0") ? 0 : 1];
  }
  function markComputedSurfaces(root) {
    if (!state.enabled || !state.rtl || state.rtlEngine === "v1") return;
    var scope = (root && root.querySelectorAll) ? root : document;
    markSurfaces(scope, COMPUTED_SEL, false);
    for (var s = 0; s < OFFSET_SELS.length; s++) markSurfaces(scope, OFFSET_SELS[s], true);
  }
  function markSurfaces(scope, sel, strict) {
    var list;
    try { list = scope.querySelectorAll(sel); } catch (e) { return; }
    // الجذرُ نفسه قد يكون الموضعَ المحسوب (يُدرَج المؤشر عقدةً مفردة) — والاستعلام
    // لا يرى إلا الأحفاد، فكان يُفلت
    var self = [];
    try { if (scope.nodeType === 1 && scope.matches && scope.matches(sel)) self = [scope]; } catch (e) {}
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
      // ★ (ر24-ب2) translate كـtransform: الخاصية المستقلة تُزيح كما يُزيح التحويل
      if (strict && !MOVES_RE.test(tp) && !MOVES_RE.test(wc) && (ANCHOR_MOVES_RE.test(tp) || ANCHOR_MOVES_RE.test(wc))) {
        // ★ (ر24-ب4) مرساةٌ يحسبها السكربت متغيّرًا سطريًّا (انظر ANCHOR_MOVES_RE)
        if (inlineAnchor(el, cs)) el.setAttribute("data-cml-noflip", "computed");
        continue;
      }
      if (!MOVES_RE.test(tp) && !MOVES_RE.test(wc) && (strict || tp.indexOf("all") === -1)) continue;
      if (strict) {
        // ★ (ر24-ب4) التوقيع الأضيق للمرشّحَين الجديدين (انظر NEED_MOVER أعلاه)
        var tf = cs.transform || "none", tl = cs.translate || "none";
        if (NEED_MOVER[sel] && tf === "none" && tl === "none") continue;
        var a1 = xyOf(tf), a2 = xyOf(tl), bx = el.getBoundingClientRect();
        if (!a1[0] && !a2[0] && (a1[1] || a2[1]) && bx.width < bx.height) continue;
      }
      // "computed" = استثناءُ المراسي وحده؛ ولا يُفرض عليه اتجاه (انظر ISLANDS_CSS)
      el.setAttribute("data-cml-noflip", "computed");
    }
  }
  // إيقافُ الترجمة أو المحرّك يرفع الوسم كما يرفع سائر أثرنا
  function unmarkComputedSurfaces() {
    var m = document.querySelectorAll('[data-cml-noflip="computed"]');
    for (var i = 0; i < m.length; i++) m[i].removeAttribute("data-cml-noflip");
  }

  /* ★ (ر30-ب، ١٣ جمادى الأولى ١٤٤٨هـ — القرار 124) الأيقونات الاتجاهية بعلامةٍ صريحة، على طريقة claude.ai: يعكس أيقونات نظام تصميمه بسمة
   * ‎data-cds-mirror‎، وسهمَ الرابط الخارجي (ArrowUpRight) داخل الرابط RTL. فاتجاه الأيقونة يُعرف من **هويّتها** لا من شكلها: اسمُ الرمز في ‎<use href>‎،
   * وأصنافُها وأصنافُ غلافها الأيقوني (‎…__BackLinkIcon‎، ‎lucide-chevron-right‎)، و‎data-icon‎، واسمُ ملف الصورة أو القناع السطري. فالسهم الأفقي
   * (يمين أو يسار، رجوع أو تقدّم، التالي أو السابق) يوسم ‎data-cml-mirror‎ وتعكسه قاعدةٌ واحدة في base.css (‎scale: -1 1‎ تحت ‎:dir(rtl)‎)، وسهمُ الرابط
   * الخارجي (↗) لا يوسم إلا داخل رابط. ولا يوسم:
   *   - الشعار والعلامة والصورة الشخصية والوسائط والصحّ والساعة، وما كان رأسيًّا (أعلى أو أسفل) أو غيرَ اتجاهي (بحث، نسخ، قائمة…)؛
   *   - ما يعكسه الموقع أو أوراقنا بنفسه: ‎data-cds-mirror‎، أو انعكاسٌ محسوب (‎transform‎ أو ‎scale‎) عليه أو على ثلاثةٍ من أسلافه — فلا قلب مزدوج؛
   *   - ما يُدار أو قد يُدار: دورانٌ محسوب، أو صنف ‎rotate-‎ عليه أو على أبيه، أو ‎data-cds-rotate‎، أو زرّ طيٍّ بـ‎aria-expanded‎ قريب — فالعكس
   *     بخاصية ‎scale‎ يقع قبل ‎rotate‎ فيقلب معنى السهم المفتوح (لهذه قواعدها النقطية بحاويتها، كما في code-point.css)؛
   *   - ما في جزيرة LTR (اتجاهه المحسوب ltr) أو في محتوى المستخدم (skipSel).
   * ويعمل حيث يعلنه النطاق (‎meta.iconMirror‎): المواقع الأخرى دون claude.ai الذي يعكس أيقوناته بنفسه. والحكم بالاسم يُحفظ لكل عنصر (iconSeen)، وما
   * تأجّل لحاله (مخفيٌّ بلا مقاس، أو LTR الآن) يُعاد في الدفعة التالية */
  var ICON_MIRROR = !!META.iconMirror;
  var ICON_SEL = 'svg, img, i, [class*="icon" i], [data-icon]';
  var ICON_LEAF_SEL = "svg, img, i";
  var iconSeen = new WeakSet();
  function iconWords(s) {
    return String(s || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/);
  }
  var ICON_NEVER = { logo: 1, logos: 1, brand: 1, wordmark: 1, avatar: 1, play: 1, pause: 1, media: 1, video: 1, audio: 1, volume: 1, check: 1,
    checkmark: 1, tick: 1, clock: 1, time: 1, history: 1, spinner: 1, loader: 1, loading: 1, refresh: 1, sort: 1 };
  var ICON_VERT = { up: 1, down: 1, top: 1, bottom: 1, expand: 1, collapse: 1, download: 1, upload: 1 };
  var ICON_SHAPE = { chevron: 1, chevrons: 1, arrow: 1, arrows: 1, caret: 1, angle: 1, triangle: 1, back: 1, next: 1, prev: 1, previous: 1, forward: 1 };
  var ICON_HORIZ = { right: 1, left: 1, back: 1, next: 1, prev: 1, previous: 1, forward: 1 };
  // "dir" سهمٌ أفقي، "ext" سهم الرابط الخارجي، null غير ذلك
  function iconKind(words) {
    var w = {}, i;
    for (i = 0; i < words.length; i++) if (words[i]) w[words[i]] = 1;
    for (i in w) if (ICON_NEVER[i] === 1) return null;
    if (w.external || (w.up && (w.right || w.left)) || (w.open && w["new"]) || (w.link && w.out)) return "ext";
    for (i in w) if (ICON_VERT[i] === 1) return null;
    var shape = false, horiz = false;
    for (i in w) { if (ICON_SHAPE[i] === 1) shape = true; if (ICON_HORIZ[i] === 1) horiz = true; }
    return shape && horiz ? "dir" : null;
  }
  function urlBase(s) {
    var m = /url\(\s*['"]?([^'")]*)/i.exec(String(s || ""));
    return m ? m[1].split(/[?#]/)[0].split("/").pop() : "";
  }
  function iconName(el) {
    var parts = [el.getAttribute("class"), el.getAttribute("data-icon")];
    var tag = el.nodeName.toLowerCase();
    if (tag === "svg") { var u = el.querySelector("use"); if (u) parts.push(u.getAttribute("href") || u.getAttribute("xlink:href")); }
    if (tag === "img") parts.push(String(el.getAttribute("src") || "").split(/[?#]/)[0].split("/").pop());
    var st = el.getAttribute("style"); if (st && st.indexOf("url(") !== -1) parts.push(urlBase(st));
    var p = el.parentElement;
    if (p && /icon/i.test(p.getAttribute("class") || "")) parts.push(p.getAttribute("class"), p.getAttribute("data-icon"));
    return iconWords(parts.join(" "));
  }
  // انعكاسٌ في التحويل المحسوب (محدِّدٌ سالب) أو في ‎scale‎ (مركّبةٌ واحدة سالبة)
  function reflectsIn(cs) {
    var n = 0, t = cs.transform, s = cs.scale;
    if (t && t !== "none") {
      var m = /^matrix(3d)?\(([^)]*)\)$/.exec(t);
      if (m) { var v = m[2].split(",").map(parseFloat); if ((m[1] ? v[0] * v[5] - v[1] * v[4] : v[0] * v[3] - v[1] * v[2]) < 0) n++; }
    }
    if (s && s !== "none") { var q = s.split(/\s+/), sx = parseFloat(q[0]), sy = q.length > 1 ? parseFloat(q[1]) : sx; if (sx * sy < 0) n++; }
    return n % 2 === 1;
  }
  function rotatedIn(cs) {
    var r = cs.rotate;
    if (r && r !== "none" && parseFloat(r) !== 0) return true;
    var m = /^matrix\(([^)]*)\)$/.exec(cs.transform || "");
    if (m) { var v = m[1].split(",").map(parseFloat); if (Math.abs(v[1]) > 1e-6 || Math.abs(v[2]) > 1e-6) return true; }
    return /^matrix3d\(/.test(cs.transform || "");
  }
  var ROTATE_CLS_RE = /(?:^|[\s:])-?rotate-/;
  /* ★ (مراجعة ر30-ب2، O1) ما يكسر عكسَ الموسوم بعد وسمه: الخاصية المستقلة ‎rotate‎ تُطبَّق بعد ‎scale‎ فتدير السهمَ المعكوس فيصير الدوران بعكس جهته
   * (‎rotate: 90deg‎ يرفع السهم وكان الموقع يُنزله)، إلا نصفَ الدورة ومضاعفاتِه فهو يتبادل مع العكس الأفقي فيبقى السهم صوابًا. أما التحويل الدوّار في
   * ‎transform‎ فيُطبَّق قبل ‎scale‎، فعكسُنا مرآةُ ما يرسمه الموقع بدورانه كما هو، فلا ترتفع له العلامة. ومحورٌ غير z أو قيمةٌ لا تُقرأ: كالمُدار */
  function rotateBreaksMirror(r) {
    if (!r || r === "none") return false;
    var m = /^(?:z\s+|0\s+0\s+1\s+)?(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)$/i.exec(String(r).trim());
    if (!m) return true;
    var deg = parseFloat(m[1]) * { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 }[m[2].toLowerCase()];
    var k = ((deg % 180) + 180) % 180;
    return k > 1e-3 && 180 - k > 1e-3;
  }
  /* ★ (ر29-هـ، ١٤ جمادى الأولى ١٤٤٨هـ — مراجعة ر30-ب2) عكسُ غيرِنا لأيقونةٍ موسومة، بزوجيّة الحكم الأول نفسها: تحويلٌ محسوبٌ معكوس عليها (‎scaleX(-1)‎)،
   * أو خاصية ‎scale‎ معكوسةٌ غيرُ قيمتنا (‎-1 1‎ من base.css: خاصيةٌ واحدة فلا تعكس مرتين)، أو عكسٌ محسوب (‎transform‎ أو ‎scale‎) على ثلاثةٍ من أسلافها */
  var MIRROR_SCALE = "-1 1";
  function reflectedOverMark(el, csm) {
    var refl = reflectsIn({ transform: csm.transform, scale: csm.scale === MIRROR_SCALE ? "none" : csm.scale });
    for (var a = el.parentElement, k = 0; a && k < 3; a = a.parentElement, k++) if (reflectsIn(getComputedStyle(a))) refl = !refl;
    return refl;
  }
  // 1 وُسم، 0 ليس سهمًا (يُحفظ)، -1 مؤجَّل لحاله
  function judgeIcon(el) {
    if (el.hasAttribute("data-cml-mirror")) {
      /* ★ (ر30-ب2 — مراجعة ر30-ب، O1) موسومٌ صار الموقع يديره بعدُ بخاصية ‎rotate‎ المستقلة (سهمُ طيٍّ يُفتح بصنفٍ على سلفٍ بعيد): عكسُنا بخاصية
       * ‎scale‎ يقع قبل ‎rotate‎ فيقلب معنى السهم المُدار، فترتفع العلامة ويُحفظ الحكم (لا يوسم ما يدور أو قد يدور، كما في الحكم الأول). (ومراجعة ر30-ب2:
       * لا ترتفع لتحويلٍ دوّار في ‎transform‎ ولا لنصف دورة، فالعكس معهما صواب — rotateBreaksMirror) */
      var csm;
      try { csm = getComputedStyle(el); } catch (e) { return 1; }
      /* ★ (ر29-هـ — مراجعة ر30-ب2) وموسومٌ صار الموقع يعكسه بعدُ (‎data-cds-mirror‎ يُضاف بعد الترطيب، أو ‎scaleX(-1)‎ عليه أو على سلفٍ قريب): عكسُنا
       * فوق عكسه يردّ السهم إلى أصله، فترتفع العلامة في الدفعة التي تمرّ به ويُعاد الحكم في الدفعة التالية (-1) كما في الحكم الأول: لا علامة ما دام
       * الموقع يعكسه، وتعود إن زال عكسه */
      if (reflectedOverMark(el, csm)) { el.removeAttribute("data-cml-mirror"); return -1; }
      if (!rotateBreaksMirror(csm.rotate)) return 1;
      el.removeAttribute("data-cml-mirror");
      return 0;
    }
    if (el.querySelector && !/^(?:svg|img|i)$/i.test(el.nodeName) && el.querySelector(ICON_LEAF_SEL)) return 0; // غلافٌ: الرسمُ فيه هو الموسوم
    // ★ (مراجعة ر30-ب) وما فيه نصٌّ ليس رسمًا: لافتةٌ بصنفٍ فيه icon («التالي» في زرّ ترقيم) تُعكس حروفها لو وُسمت، و‎<i>‎ بنصٍّ مائلٌ لا أيقونة
    if (!/^(?:svg|img)$/i.test(el.nodeName) && /\S/.test(el.textContent || "")) return 0;
    var kind = iconKind(iconName(el));
    if (!kind) return 0;
    if (kind === "ext" && !(el.closest && el.closest("a[href]"))) return 0;
    if (inSkipSel(el) || inChatContent(el)) return 0;
    var r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return -1;
    if (r.width > 48 || r.height > 48) return 0;
    if (el.hasAttribute("data-cds-mirror") || el.hasAttribute("data-cds-rotate")) return 0;
    if (ROTATE_CLS_RE.test(el.getAttribute("class") || "") || (el.parentElement && ROTATE_CLS_RE.test(el.parentElement.getAttribute("class") || ""))) return 0;
    var cs = getComputedStyle(el);
    if (cs.direction !== "rtl") return -1;
    if (rotatedIn(cs)) return 0;
    // ★ (مراجعة ر30-ب) خاصية scale من الموقع (أدوات Tailwind v4 في الأكاديمية والوثائق وClaude Code): قاعدتنا ‎scale: -1 1‎ كانت تمحوها فيتغيّر مقاس الأيقونة —
    // فلا علامة ما دامت (ويُعاد الحكم في الدفعة التالية)
    if (cs.scale && cs.scale !== "none") return -1;
    var refl = reflectsIn(cs);
    for (var a = el.parentElement, k = 0; a && k < 3; a = a.parentElement, k++) {
      // (ومراجعة ر30-ب: وعنوان ‎<details>‎ زرُّ طيٍّ بلا aria-expanded، يدير سهمه بقاعدة ‎details[open]‎)
      if (a.hasAttribute("aria-expanded") || a.hasAttribute("data-cds-mirror") || a.nodeName === "SUMMARY") return 0;
      if (reflectsIn(getComputedStyle(a))) refl = !refl;
    }
    if (refl) return -1; // يعكسه الموقع أو ورقتُنا الآن — لا علامة (ويُعاد إن زال العكس)
    el.setAttribute("data-cml-mirror", "");
    return 1;
  }
  function markIcons(root) {
    if (!ICON_MIRROR || !state.enabled || !state.rtl || !active) return;
    var scope = (root && root.querySelectorAll) ? root : document;
    var list;
    try { list = scope.querySelectorAll(ICON_SEL); } catch (e) { return; }
    var self = [];
    try { if (scope.nodeType === 1 && scope.matches && scope.matches(ICON_SEL)) self = [scope]; } catch (e) {}
    list = self.concat(Array.prototype.slice.call(list, 0, 3000));
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (iconSeen.has(el)) continue;
      var v = 0;
      try { v = judgeIcon(el); } catch (e) { v = 0; }
      if (v === 0) iconSeen.add(el);
    }
  }
  function unmarkIcons() {
    var m = document.querySelectorAll("[data-cml-mirror]");
    for (var i = 0; i < m.length; i++) m[i].removeAttribute("data-cml-mirror");
    iconSeen = new WeakSet();
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
    // ★ (ر30-ب) الأيقونات الاتجاهية (meta.iconMirror): توسم مع قلب الصفحة، وترفع علامتها بإطفائه أو بخمول المسار
    if (ICON_MIRROR) { if (state.enabled && state.rtl && active) markIcons(document); else unmarkIcons(); }
    // عنوان التبويب يتبع الحال كلها (التشغيل ومفتاح الموقع والمسار وحارس اللغة وبوابة الترطيب واللغة والتصحيحات): يُترجم أو يُستعاد
    syncTitle();
    // ★ (ر13-ج — E-lang) سمة lang لما كتبناه تتبع النصّ بعد المرور الكامل (والإطفاءُ والخمول يُرجعانها في المهمة نفسها). وما يُكتب أو يُرجع خارجه (وصول
    // القطعة وحكم الحارس وإعادته) كتابةٌ في عقدٍ يراها مراقب الطفرات، فتتبعها السمة في آخر الدفعة التالية
    langSync();
  }

  // تنقّلٌ داخل المستند (تطبيقات الصفحة الواحدة): يُعاد تقييم الحارس عند كل تغيّرٍ في
  // العنوان — من مراقب الطفرات (التنقّل يرسم) ومن popstate وواجهة Navigation حيث وُجدت.
  // لا نعترض pushState في العالم المعزول: لا يرى نداءات عالم الصفحة أصلًا (مراجعة كودكس).
  var lastHref = location.href, lastPath = location.pathname;
  // ★★ (ر20-ج) ما يُشتقّ من بيانات الصفحة يُعاد اشتقاقه عند تبديل المنظر، بالتعابير نفسها التي عُرّف بها أعلاه (وحقول المضيف ثابتة في المنظرين)
  function rederive() {
    SHELL_SEL = META.shellSel || null;
    SKIP_SEL = typeof META.skipSel === "string" && META.skipSel ? META.skipSel : null;
    BODY_SEL = META.bodySel || null;
    MAIN_SEL = META.bodyMain || BODY_SEL; MAIN_IDS = selIds(MAIN_SEL);   // ★ (ر29-د2)
    BODIES_ON = !!(META.bodies && BODY_SEL);
    LANG_FIX = BODIES_ON && META.blockLang === true;
    KEEP_ROWS = BODIES_ON && META.keepRows === true;
    GUARD = BODIES_ON && typeof META.bodyGuard === "number" && META.bodyGuard >= 0 && META.bodyGuard < 1 ? META.bodyGuard : null;
    REJUDGE = GUARD !== null && META.bodyRejudge === true;
    ECHO_SEL = BODIES_ON && typeof META.echoSel === "string" && META.echoSel ? META.echoSel : null;
    COUNT_NOUN = META.countNoun === true;
    ISO_LABELS = !!META.isoLabels;
    ICON_MIRROR = !!META.iconMirror; // ★ (ر30-ب)
    TITLE_SFX = (Array.isArray(META.titleSuffix) ? META.titleSuffix : [])
      .filter(function (s) { return typeof s === "string" && !!s.trim(); })
      .sort(function (a, b) { return b.length - a.length; });
    TITLE_KEEP = Array.isArray(META.titleKeep) ? META.titleKeep : [];
    TITLE_SKIP = (Array.isArray(META.titleSkip) ? META.titleSkip : [])
      .map(function (s) { try { return new RegExp(s); } catch (e) { return null; } })
      .filter(function (r) { return !!r; });
    TITLE_KEEP_LONG = TITLE_KEEP.filter(function (s) { return typeof s === "string" && !!s; })
      .sort(function (a, b) { return b.length - a.length; });
    DIRSEL = CHAT_ON ? CHATSEL : (META.dirSel || null);
    protCtx = null; // سياق حماية التتابع (blockP) من مستثنى المنظر الجديد
  }
  // ★★ (ر20-ج) الانتقال بين منظر النطاق ومنظر صنفٍ حيّ (انظر setView أعلاه): يُرجَع الجانب الذي نغادره أولًا بطريق المسار الخامل نفسه
  // (fullPass بحالٍ خاملة: النص والسمات والعلامات والاتجاه والخط والورقة الحيّة والعنوان)، ثم يُحمَّل قاموس الجانب الآخر وبياناته ويُركَّب،
  // ويدخله checkRoute بعدها كما يدخل أي مسارٍ كامل
  // ★ والعنوان قد يتبدّل قبل أن يرسم الموقع صفحته: في الرجوع والتقدّم يصل navigatesuccess قبل popstate الذي يعيد فيه الموقع الرسم (قِيس على
  // _consoleswaptest: منظر الوثائق مشى على شجرة الفوترة فقرأ محتوى مستخدمها). فإن بُدّل المنظر من غير مراقب الطفرات (popstate وواجهة Navigation)
  // يُترك الجانب القديم في الحال ويُدخل الجديد مع أول دفعةٍ يغيّر فيها الموقع شجرة المتن (viewWait؛ والحارس خاملٌ حتى ذلك)، أو بعد VIEW_WAIT_MS
  // ★ (ر20-ج، المراجعة المستقلة) والانتظار لكل عبورٍ لحدّ صنف المسار من غير مراقب الطفرات، لا لتبديل المنظر وحده: الصنف القادم لا منظر له،
  // فالتقدّم من الفوترة إلى الوثائق كان يُدخل الوثائق عند navigatesuccess فيمشي منظرها على شجرة اللوحة قبل أن يرسم الموقع عند popstate ويقرأ
  // محتوى مستخدمها (قِيس على _consoleswaptest: الجاسوس 3). فيُترك الجانب القديم في الحال كما كان، ويُدخل الجديد مع رسم الموقع (viewWait)
  var VIEW_WAIT_MS = 3000;
  function leaveSide() { if (state.enabled) { state.route = "inactive"; state.enabled = false; if (active) fullPass(); } }
  function holdView(fromObs) {
    clearTimeout(viewTimer);
    viewWait = !fromObs;
    if (viewWait) viewTimer = setTimeout(viewEnter, VIEW_WAIT_MS);
  }
  function swapView(nv, fromObs) {
    leaveSide();
    setView(nv);
    rederive();
    compile();
    holdView(fromObs);
  }
  function viewEnter() {
    if (!viewWait) return;
    viewWait = false; clearTimeout(viewTimer);
    routeEnter();
  }
  // دفعةٌ غيّر فيها الموقع شجرةً خارج <head> (رسمُ الصفحة الجديدة): بها يُدخل المنظر المنتظر
  function bodyRendered(list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type !== "childList" || (!m.addedNodes.length && !m.removedNodes.length)) continue;
      var t = m.target;
      if (t && t.nodeType === 1 && t.closest && t.closest("head")) continue;
      return true;
    }
    return false;
  }
  function checkRoute(fromObs) {
    if (location.href === lastHref) return;
    var crossed = typeof CONST.routeClass === "function" && CONST.routeClass(DOMAIN, lastPath) !== routeClassNow();
    lastHref = location.href; lastPath = location.pathname;
    var nv = viewNow();
    if (nv !== VIEW) { swapView(nv, fromObs === true); if (viewWait) return; }
    else if (viewWait) return; // تنقّلٌ آخر والمنظر ما زال ينتظر رسم الموقع
    else if (crossed && fromObs !== true) { leaveSide(); holdView(false); return; } // (المراجعة المستقلة) عبورُ حدّ الصنف بلا منظر (الصنف القادم)
    routeEnter();
  }
  function routeEnter() {
    if (META.routes) {
      var was = state.enabled;
      refreshEnabled();
      langEntry = !was && state.enabled; langPins = 0;
      if (was !== state.enabled || state.enabled) { if (active) fullPass(); }
    }
    loadBodies();
    noselNav();   // ★ (ر29-د) العدّ من التنقّل، والحجز يُرفع إن صار المسار فهرسًا
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
      // ★ (ر20-أ) وصنفُ المسار الحاضر وحاله (لوحة المطوّرين قادمة): تقول النافذة إنها قادمة لا «لا يعمل هنا»
      var rc = routeClassNow();
      respond({ domain: DOMAIN, route: state.route, enabled: state.enabled, master: state.master, site: state.site, text: textGate,
                routeClass: rc ? { id: rc.id, name: rc.name, upcoming: CONST.classUpcoming(rc) } : null,
                siteLang: state.siteForeign ? state.siteLang : null,
                // (ر3) ومصدرُ الحكم: "html" إعداد الموقع، و"sel" منتقي اللغة في الصفحة (الوثائق القانونية) — لكلٍّ علاجُه في النافذة
                siteLangBy: state.siteForeign ? state.siteLangBy : null,
                // حال الخط في هذا التبويب (م٨ «لا إخفاء صامت»): البطاقة والنافذة تعرضانها
                font: F ? F.stats() : null,
                bodies: BODIES_ON ? { page: bodyPage, have: bodyMap ? Object.keys(bodyMap).length : 0, pending: bodyPending, bad: badBlocks,
                  // ★ (ر6-ب) حكم حارس المتن لهذه الصفحة: محجوبة؟ وعدد كتلها وغير المغطّى منها
                  // ★ (ر6-د) وسببه (why): "drift" لها قطعة و"none" لا قطعة لها — به تختار النافذة سطرها
                  // ★ (ر29-د) و"nosel": لم يطابق محدِّد المتن شيئًا في مسار متن (المحرّك خاملٌ في الصفحة)
                  guard: GUARD === null ? null : noselNow() ? { judged: true, held: true, why: "nosel", blocks: 0, uncovered: 0 }
                    : { judged: bodyJudged, held: bodyHeld, why: bodyWhy, blocks: bodyStat ? bodyStat.n : null, uncovered: bodyStat ? bodyStat.unc : null } } : null,
                // ★ (ر29-د) صفحة تحقّقٍ من الموقع (botCheckPage): الإضافة خاملةٌ فيها
                bot: botPage });
      return false;
    });
  } catch (e) {}

  // ---------- ★★ (ر24-هـ، ١١ جمادى الأولى ١٤٤٨هـ — القرار 112) النسخ بلا علامات الاتجاه التي أدخلناها ----------
  // الترجمة المختلطة ملفوفةٌ بعلامتي عزلٍ خفيّتين (RLI أو FSI…PDI، bidiWrap وsvgIsolate)، واللافتة اللاتينية المعزولة (LRI…PDI، isolateLabel)،
  // وتُلاصق علامتا LRM وRLM بعض الرموز والأقواس والشرطة المائلة (ltrMarks وltrParens وltrSlash)، وفي القواميس نفسها LRM وRLM كتبها المترجمون
  // (294 LRM و80 RLM في web/user/dictionaries، ولا علامة اتجاهٍ غيرهما). فحص الاتجاه يرى الشاشة وحدها، والعلامات تنتقل مع النسخ فتُفسد أمرًا يُلصق في الطرفية («~/.claude»).
  // فمعالجٌ لحدث copy على النافذة بعد معالجات الموقع (طور الفقاعة، ومسجَّلٌ عند document_start قبل سكربتات الموقع):
  //   - لا يعمل إلا وفي التحديد عقدةٌ نصية من سجلّاتنا ما زالت كما كتبناها (appliedText وlastWritten)، وإلا فالنسخ الأصلي كما هو بلا مسّ؛
  //     ولا إن عالج الموقع الحدث قبله (defaultPrevented)، ولا والإضافة مطفأة للموقع (السجلّات تُمحى بالإرجاع، وstate.enabled)؛
  //   - يحذف علامات الاتجاه (Bidi_Control كلها: ALM وLRM وRLM والتضمين والعزل) ممّا جاء من عقدنا وحدها، بمواضعها في نصّ التحديد؛ وعلامةٌ في نصّ
  //     الموقع الذي لم نترجمه تبقى؛
  //   - لا يمسّ المحادثة ولا محتوى المستخدم ولا القابل للتحرير ولا يقرأ نصّها: تحديدٌ يمسّ محميًّا (السلف أو ما بين حدّيه، بفحوص العناصر وحدها:
  //     protAbove وprotEl بسياق blockP الذي يمشي به المحرّك) يُترك للنسخ الأصلي قبل أي قراءة، وكذلك عناصر الإدخال (قيمها ممّا يكتبه المستخدم)؛
  //   - لا يغيّر DOM ولا التحديد ولا السجلّات (النسخة المستنسخة منفصلة)، ولا عمل له خارج حدث النسخ، وكلفته بقدر التحديد؛
  //   - يضع text/plain وtext/html معًا: إلغاء الحدث يجعل الحافظة ما نضعه وحده، فلا يبقى HTML المتصفح. والنصّ هو نصّ التحديد كما يسلسله المتصفح
  //     (Selection.toString) والمسافة غير الفاصلة مسافةً كما يكتبها نسخه الأصلي؛ وما يكتبه نسخه الأصلي ولا يكتبه toString (نصّ alt للصورة،
  //     والحروف بعد text-transform، ومحتوى الظلّ) لا يُحاكى: تحديدٌ فيه شيءٌ منه يُترك للنسخ الأصلي. وHTML نسخةُ التحديد (cloneContents) بعلاماتنا
  //     محذوفةً من نصّ عقدنا وسماتنا المترجمة، والروابط مطلقة، ملفوفةً بأسلافها السطرية (وpre) كما يلفّها المتصفح.
  //   - ★ (المراجعة المستقلة لـر24-هـ، ١٢ جمادى الأولى ١٤٤٨هـ) وفي HTML ما في نسخ المتصفح وحده: لا يدخله ما لا يُرسم (display:none) ولا ما لا يُحدَّد
  //     (user-select:none) ولا نصٌّ مخفيّ (visibility)، وتُلفّ صفوف الجدول وخلاياه وبنود القائمة بجدولها أو قائمتها (CP_BOX) — كان الجدول يصل الحافظة نصًّا ملتصقًا.
  var CP_SET = (function () {
    var c = String.fromCharCode;
    return "[" + c(0x061C) + c(0x200E) + c(0x200F) + c(0x202A) + "-" + c(0x202E) + c(0x2066) + "-" + c(0x2069) + "]";
  })();
  var CP_RE = new RegExp(CP_SET, "g"), CP_ONE = new RegExp(CP_SET), CP_NBSP = new RegExp(String.fromCharCode(0xA0), "g");
  var CP_FORM = { INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, OPTGROUP: 1, DATALIST: 1 };
  // ★ (المراجعة المستقلة لـر24-هـ) حاويات البنية: صفوف الجدول وخلاياه وبنود القائمة لا تُلصق وحدها — المحلّل في سياق body يُسقط ‎<td>‎ و‎<tr>‎ بلا
  // جدولها فتلتصق الخلايا نصًّا واحدًا (قِيس: تحديد جدولٍ كاملٍ كان يصل الحافظة بلا جدول) — فتُلفّ بجدولها أو قائمتها كما يلفّها نسخ المتصفح. 2: آخر ما يُلفّ
  var CP_BOX = { TR: 1, TBODY: 1, THEAD: 1, TFOOT: 1, COLGROUP: 1, TABLE: 2, UL: 2, OL: 2, DL: 2, MENU: 2 };
  function cpStyle(el, memo) {
    var v = memo.get(el);
    if (v === undefined) { try { v = getComputedStyle(el); } catch (e) { v = null; } memo.set(el, v); }
    return v;
  }
  // ما لا يُحدَّد (user-select:none، وهي موروثةٌ في المحسوب): لا يكتبه toString ولا نسخ المتصفح نصًّا ولا HTML
  function cpNoSel(cs) { return !!cs && (cs.userSelect || cs.webkitUserSelect) === "none"; }
  // عنصرٌ في فرعٍ متخطّى الرسم (محتوى details المغلق، وhidden="until-found"، وcontent-visibility:hidden): لا يكتب نصَّه toString ولا نسخ المتصفح.
  // (checkVisibility بلا خيارات: صندوقٌ له ولا سلفَ يتخطّى رسمه؛ وعنصرُ display:contents لا صندوق له وأبناؤه مرسومون فلا يُسأل، ولا عناصر SVG)
  function cpSkipped(el, cs) {
    return !!el.checkVisibility && el.namespaceURI !== SVG_NS && !!cs && cs.display !== "contents" && !el.checkVisibility();
  }
  function cpWrap(e, inner) { var w = e.cloneNode(false); cpAttrs(e, w); w.appendChild(inner); return w; }
  // العقدة التالية في ترتيب المستند خارج فرع n، داخل الجذر
  function cpAfter(n, root) {
    while (n && n !== root) { if (n.nextSibling) return n.nextSibling; n = n.parentNode; }
    return null;
  }
  // عقدةٌ نصية تُرسم فيسلسلها المتصفح؟ (لعقدٍ فيها علامةٌ وحدها: محاذاة العلامات بمواضعها)
  function cpShown(t) {
    try {
      var r = document.createRange();
      r.selectNodeContents(t);
      if (!r.getClientRects().length) return false;
      var cs = getComputedStyle(t.parentNode);
      return cs.visibility === "visible" && !cpNoSel(cs) && !cpSkipped(t.parentNode, cs);
    } catch (e) { return false; }
  }
  // خطّة النسخ بالعناصر أولًا: null = النسخ الأصلي (محميّ، أو ما لا يُحاكى، أو لا عقدةَ لنا)
  function copyPlan(rg) {
    var P = blockP(), sc = rg.startContainer, ec = rg.endContainer, root = rg.commonAncestorContainer;
    var se = sc.nodeType === 1 ? sc : sc.parentNode, ee = ec.nodeType === 1 ? ec : ec.parentNode;
    if (!se || !ee || se.nodeType !== 1 || ee.nodeType !== 1) return null;
    // الحدّان وكلُّ أسلافهما: محادثةٌ أو محتوى مستخدمٍ أو قابلٌ للتحرير أو عنصر إدخال ⇒ لا شيء، ولا قراءة
    if (SHARED.protAbove(se, P) || SHARED.protAbove(ee, P)) return null;
    for (var fa = se; fa && fa.nodeType === 1; fa = fa.parentNode) if (CP_FORM[fa.nodeName] || fa.shadowRoot) return null;
    for (var fb = ee; fb && fb.nodeType === 1; fb = fb.parentNode) if (CP_FORM[fb.nodeName] || fb.shadowRoot) return null;
    // أسلاف الحدّ الأول تحت الجذر المشترك (تُستنسخ ضحلةً في cloneContents)، من الأعلى
    var chain = [];
    if (root.nodeType === 1 || root.nodeType === 9 || root.nodeType === 11) {
      for (var a = sc.nodeType === 1 ? sc : sc.parentNode; a && a !== root && a.nodeType === 1; a = a.parentNode) chain.unshift(a);
    }
    var first = sc.nodeType === 1 ? (sc.childNodes[rg.startOffset] || cpAfter(sc, root)) : sc;
    // أول عقدةٍ بعد نهاية التحديد (بالهوية لا بالمقارنة: comparePoint لكل عقدةٍ يحسب ترتيبها بين إخوتها فيصير المشي تربيعيًّا)
    var stop = ec.nodeType === 1 ? (ec.childNodes[rg.endOffset] || cpAfter(ec, root)) : null;
    var list = [], own = new Set(), seq = [], siteAll = 0, sm = new Map(), drop = new Set(), blank = new Set(), dropTop = null;
    if (first && first !== stop) {
      var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
      tw.currentNode = first;
      for (var x = first; x && x !== stop; x = tw.nextNode()) {
        if (dropTop && !dropTop.contains(x)) dropTop = null;
        if (x.nodeType === 1) {
          // عنصرٌ في التحديد: يُفحص قبل أي نصٍّ تحته (ترتيب المستند: السلف قبل أبنائه)
          if (SHARED.protEl(x, P) || CP_FORM[x.nodeName] || x.shadowRoot) return null;
          if (!dropTop) {
            // ★ (المراجعة المستقلة لـر24-هـ) ما لا ينسخه المتصفح لا يدخل HTML نسختنا: غير المرسوم (display:none — ومنه script وstyle وtemplate
            // وسمة hidden) وما لا يُحدَّد (أرقام الأسطر وأزرار النسخ). كانت cloneContents تحمله فيُلصق ما لم يُرَ ولم يُحدَّد. وtoString لا يكتبه أصلًا
            var xs = cpStyle(x, sm);
            if (xs && (xs.display === "none" || cpNoSel(xs) || cpSkipped(x, xs))) { drop.add(x); dropTop = x; }
            else if (x.nodeName === "IMG" && x.getAttribute("alt")) return null;   // نسخ المتصفح يكتب alt ولا يكتبه toString
          }
          list.push(x);
        } else if (x.nodeType === 3) {
          var rec = appliedText.get(x), v = x.nodeValue, ours = !!rec && v === rec.lastWritten;
          var part = v.slice(x === sc ? rg.startOffset : 0, x === ec ? rg.endOffset : v.length);
          if (ours) own.add(x);
          if (CP_ONE.test(part)) {
            var ms = part.match(CP_RE);
            if (!ours) siteAll += ms.length;
            seq.push(x, ms, ours ? 1 : 0);
          }
          if (!dropTop) {
            var ps = cpStyle(x.parentNode, sm);
            // ★ (المراجعة المستقلة لـر24-هـ) ونصٌّ مخفيٌّ (visibility) أو لا يُحدَّد: لا يكتبه toString ولا HTML المتصفح، فيُفرَّغ في HTML نسختنا
            if (ps && (ps.visibility !== "visible" || cpNoSel(ps))) blank.add(x);
            // نسخ المتصفح يكتب الحروف قبل text-transform وtoString بعده: حرفٌ ذو حالةٍ تحت تحويلٍ ⇒ لا يُحاكى (وما لا يُرسم أو لا يُحدَّد لا يكتبه أيٌّ منهما)
            else if (ps && part.toUpperCase() !== part.toLowerCase() && (ps.textTransform || "none") !== "none") return null;
          }
          list.push(x);
        }
        if (x === ec && x.nodeType !== 1) break;
      }
    }
    if (!own.size) return null;
    return { list: chain.concat(list), own: own, seq: seq, siteAll: siteAll, drop: drop, blank: blank };
  }
  // علامات العقد بترتيبها [علامة، لنا؟]…: كلُّ العقد، أو المرسومة وحدها (shown) — والرسم يُسأل عنه في الحالة النادرة وحدها (انظر cpText)
  function cpMarks(seq, shown) {
    var out = [];
    for (var i = 0; i < seq.length; i += 3) {
      if (shown && !cpShown(seq[i])) continue;
      for (var j = 0; j < seq[i + 1].length; j++) out.push(seq[i + 1][j], seq[i + 2]);
    }
    return out;
  }
  function cpAlign(s, m) {
    var k = 0, bad = false;
    var out = s.replace(CP_RE, function (c) {
      var w = m[k], o = m[k + 1];
      k += 2;
      if (w !== c) bad = true;
      return o ? "" : c;
    });
    return bad ? null : out;
  }
  // نصّ التحديد بعلاماتنا محذوفةً بمواضعها: علامات النصّ بترتيبها هي علامات العقد بترتيبها (كلِّها، فإن لم تتّفق عدًّا فالمرسومة وحدها)، وإلا فالنسخ الأصلي
  function cpText(s, plan) {
    var n = (s.match(CP_RE) || []).length, out = null, m;
    if (!plan.siteAll) out = s.replace(CP_RE, "");   // لا علامة في نصّ الموقع المحدَّد: كلُّ علامةٍ في النصّ منّا
    else {
      m = cpMarks(plan.seq, false);
      if (m.length !== n * 2) m = cpMarks(plan.seq, true);   // عقدةٌ ذات علامةٍ لا تُرسم (مخفيّة): لا يسلسلها المتصفح
      if (m.length === n * 2) out = cpAlign(s, m);
    }
    return out === null ? null : out.replace(CP_NBSP, " ");
  }
  function cpAttrs(o, c) {
    var ar = appliedAttr.get(o);
    if (ar) for (var a in ar) { var v = o.getAttribute(a); if (v !== null && v === ar[a].lastWritten) c.setAttribute(a, v.replace(CP_RE, "")); }
    if (c.hasAttribute("href") && typeof o.href === "string" && o.href) c.setAttribute("href", o.href);
    if (c.hasAttribute("src") && typeof o.src === "string" && o.src) c.setAttribute("src", o.src);
  }
  function cpHtml(rg, plan) {
    var frag = rg.cloneContents(), L = plan.list, i = 0, c, rm = [];
    var tw = document.createTreeWalker(frag, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    while ((c = tw.nextNode())) {
      var o = L[i++];
      if (!o || o.nodeType !== c.nodeType || o.nodeName !== c.nodeName) return null;
      if (c.nodeType === 3) { if (plan.blank.has(o)) c.nodeValue = ""; else if (plan.own.has(o)) c.nodeValue = c.nodeValue.replace(CP_RE, ""); }
      else { cpAttrs(o, c); if (plan.drop.has(o)) rm.push(c); }
    }
    if (i !== L.length) return null;
    for (var q = 0; q < rm.length; q++) if (rm[q].parentNode) rm[q].parentNode.removeChild(rm[q]);
    var inner = frag, anc = rg.commonAncestorContainer, e;
    if (anc.nodeType !== 1) anc = anc.parentNode;
    for (e = anc; e && e.nodeType === 1 && e !== document.body && e !== document.documentElement; e = e.parentNode) {
      var d = "";
      try { d = getComputedStyle(e).display; } catch (x) {}
      var pre = e.nodeName === "PRE";
      if (!pre && !/^(inline|contents)/.test(d)) break;
      inner = cpWrap(e, inner);
      if (pre) { e = null; break; }
    }
    // ★ (المراجعة المستقلة لـر24-هـ) وأول سلفٍ غير سطريٍّ صفٌّ أو جسمُ جدولٍ أو جدولٌ أو قائمة: تُلفّ به حتى الجدول أو القائمة (CP_BOX)
    for (; e && e.nodeType === 1 && e !== document.body && CP_BOX[e.nodeName]; e = e.parentNode) {
      inner = cpWrap(e, inner);
      if (CP_BOX[e.nodeName] === 2) break;
    }
    var box = document.createElement("div");
    box.appendChild(inner);
    return box.innerHTML;
  }
  function copyClean(e) {
    try {
      if (!e || e.defaultPrevented || !everTranslated || !active || !state.enabled) return;
      var dt = e.clipboardData;
      if (!dt || typeof dt.setData !== "function") return;
      var sel = window.getSelection ? window.getSelection() : null;
      if (!sel || sel.rangeCount !== 1 || sel.isCollapsed) return;
      var rg = sel.getRangeAt(0), plan = copyPlan(rg);
      if (!plan) return;
      var txt = cpText(sel.toString(), plan);
      if (txt === null) return;
      var html = cpHtml(rg, plan);
      if (html === null) return;
      dt.setData("text/plain", txt);
      dt.setData("text/html", html);
      e.preventDefault();
    } catch (x) {}
  }

  function start() {
    // ★ (ر24-هـ) النسخ بلا علاماتنا: على النافذة في طور الفقاعة، بعد معالجات الموقع في المستند وعناصره
    window.addEventListener("copy", copyClean, false);
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
    // ★ (ر29-د) اكتمال التحميل يفتح حكم الصمّام (لا حكم أثناءه)
    if (NOSEL) window.addEventListener("load", function () { setTimeout(noselTick, 0); }, { once: true });
    // (ر3) ومنتقي اللغة في الصفحة (meta.siteLangSel) يُحكم قبل المرور الأول: عند document_start لم يُحلَّل بعد، وعند اكتمال التحليل
    // حاضرٌ إن رسمه الخادم (وبعده يحكمه مراقب الطفرات مع كل دفعة)
    var first = function () {
      if (LANG_SEL) judgeSiteLang();
      if (!botPage && botCheckPage()) { botSet(); return; }   // ★ (ر29-د) صفحة التحقق: خمولٌ قبل المرور الأول
      fullPass();
      if (NOSEL) noselTick();   // ★ (ر29-د) والصمّام يبدأ عدّه من التحميل
    };
    if (document.body) first();
    else document.addEventListener("DOMContentLoaded", first, { once: true });
    try {
      obs.observe(document.documentElement, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: OBS_ATTRS,   // ★ (ر24-ج1، CX-004) وسمات محتوى المستخدم وقابلية التحرير (PROT_ATTRS)
      });
    } catch (e) {}
    // مسحتان متأخرتان للمواضع المحسوبة: مكوّناتٌ تقيس نفسها بعد الترطيب فتكتب
    // نمطَها السطري متأخرًا بلا إدراج عقدةٍ جديدة — فلا حدثَ يوقظنا لها
    setTimeout(function () { markComputedSurfaces(document); markIcons(document); }, 1200);
    setTimeout(function () { markComputedSurfaces(document); markIcons(document); }, 4000);
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
