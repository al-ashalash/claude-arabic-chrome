/* cml-const.js — المصدر الواحد للثوابت ومفاتيح التخزين (المرحلة ١ من خطة الإطلاق).
 *
 * لماذا: كانت عتبة الحجز 90000 مكتوبة مرتين بعقد «نفس عتبة claimScan» اليدوي، وسقف
 * الـ300 حرف في ثلاثة مواضع، ومفاتيح التخزين الـ13 موزعة على أربع قوائم تُصان يدويًا —
 * والانحراف وقع فعلًا (resetAll). القيمة تُكتب هنا مرة واحدة ويستهلكها الجميع.
 *
 * ثنائي الاستخدام: لا import/export — يُحقن سكربتًا كلاسيكيًا في المتصفح (المانيفست
 * وoptions.html) ويستورده Node كوحدة ESM صالحة (التعيين على globalThis يعمل في كليهما).
 */
(function (g) {
  "use strict";
  // متن المقالة وعنوانها وفهرسُ «في هذه الصفحة» (يكرّر عناوين المتن) في قالبَي Intercom — الخصوصية
  // وقالب Docs في مركز المساعدة، مقيسان: كلُّ كتلةٍ تأخذ dir بحسب نصّها (resolveDir)، فالمتن
  // الإنجليزي LTR داخل تخطيطٍ RTL بلا ترقيمٍ مقلوب («?What is Claude») إلى أن يُعرَّب
  var INTERCOM_DIRSEL = ".article_body article, h1, .table-of-contents section, [class*='DocsToc_item']";
  // متن المقالة وفهرسُه (أداة الحصاد: ما فيهما «متن» للمرحلة ٤، وما سواهما «واجهة» للمرحلة ١) —
  // الفهرس يكرّر عناوين المتن، فعدُّه واجهةً كان يجرّ آلاف عناوين المتن إلى دفعة المرحلة ١
  var INTERCOM_BODYSEL = ".article_body, .table-of-contents, [class*='DocsToc_toc']";
  // متغيّرا الخط اللذان ترسم بهما منصة Intercom نصّها (على :root لا على body) — موضعا الإلحاق (DESIGN-fonts §٤.٤)
  var INTERCOM_FONT_VARS = ["--font-family-primary", "--font-family-secondary"];
  // ★ مرجع الواجهة البرمجية في وثائق المطوّرين (‎.stldocs-root‎ تحت ‎/docs/en/api/‎ — دراسة S7-B، ٢١ ربيع الآخر ١٤٤٨هـ): نترجم ما تترجمه
  // الشركة في صفحاتها المعرَّبة وحده — عنوان الصفحة، وبنود مسار التنقّل، ووصف الطريقة وملخصها، وعناوين الطرق والموارد الفرعية،
  // وعنوان بطاقة المثال — ويبقى العقد البرمجي على أصله LTR بمحدِّدٍ صريح لا بمصادفة القاموس («Models» و«API reference» و«Copy page»
  // فيه): شجرة الخصائص والنماذج، وتوقيع الطريقة في صفحات SDK، والشيفرة، والملاحظات، والأزرار، وسطر الطريقة وشاراتها (الطريقة
  // و«Deprecated»)، ولافتات الأقسام (Headers وBody وReturns… h5 بلا رابط)، ورأس بطاقة الشيفرة إلا عنوانها (لافتة «Response 200»
  // ولغة المثال «cURL» والأزرار)، وأول بندٍ في المسار، وشريط صفحات الامتثال، وغلاف زرّ «Copy page» المنقسم (سمته aria-label
  // «Copy page» كانت تُعرَّب وحدها والزرّ إنجليزي — المراجعة العدائية). و:has داخل :is() المتسامحة: متصفحٌ لا يعرفها يُسقط
  // ذلك البند وحده لا المحدِّد كلَّه
  var STL_KEEP = ".stldocs-root :is(.stldocs-property, .stldocs-model, .stldocs-method-signature, pre, aside, button, .text-code, " +
    "[data-cds='Badge'], [data-cds='SplitDropdownButton'], h5:not(:has(a)), .rounded-card > .border-b > :not(:has(> .truncate))), " +
    ".stldocs-root nav ol > li:first-child, .stldocs-root [data-testid='docs-page-banner']";
  // جزر الاتجاه داخل المرجع: كلُّ جزيرةٍ بحسب نصّها — المعرَّبة RTL والإنجليزية LTR. والتخطيط حولها يتبع الصفحة RTL، وما في
  // STL_KEEP يبقى LTR كتلًا كاملة بقاعدةٍ في docs-point.css (شجرة الخصائص ومُغلِّف إزاحة المُوسِّعات والشيفرة…)
  var STL_DIR = ".stldocs-root :is(h1, h4, h5:has(> a), span.truncate:not(.text-code)), " +
    ".stldocs-root .stldocs-content:not(:is(.stldocs-property, .stldocs-model) .stldocs-content)";
  // ★ (S9-M، ٢٢ ربيع الآخر ١٤٤٨هـ؛ ما وجده S8-A) أسماءٌ كتبها المستخدم في واجهة claude.ai — محتواه لا واجهتنا: محادثةٌ اسمها
  // «Settings» أو «Projects» كانت تُعرَّب في الشريط الجانبي لأنها تطابق نصًّا في القاموس. تُستثنى كمتن المحادثة (meta.skipSel للتطبيق):
  // لا نصَّ ولا سمة يُقرأ للمطابقة، ولا يحصدها حاصد DOM، وما عرّبناه قبل أن يصير منها يُرجع أصله. المحدِّدات من حزم الموقع
  // (١ أكتوبر ٢٠٢٦، _app-gap-20261002/cache):
  //   صفوف الشريط الجانبي (المحادثات وجلسات Claude Code ومهام Cowork والمشاريع، في «الأحدث» و«المثبّتة»): كل صفٍّ ملفوفٌ في
  //   ‎[data-row-key]‎ واسمه في ‎[data-row-label]‎ — لا الصفّ كلّه: فيه وقتٌ وحالةٌ وأزرار إجراءاتٍ هي واجهة
  //   عنوان المحادثة أو الجلسة في رأس الصفحة: الزرّ الأول من ‎[data-testid="chat-title-split"]‎ (و‎session-title-split‎) وبديله المؤقت
  //   أسماء المُخرَجات في إطارها وفي حوارات الحذف والمشاركة والدعوة والنشر وبطاقات الإذن، وأسماء الملفات في حواري الرفع والنشر
  // والنصوص حولها («Delete artifact “{name}”?») تبقى تُعرَّب: الاسم عنصرٌ مستقل فيها
  var APP_USER_NAMED = "[data-row-key] [data-row-label], " +
    "[data-testid='chat-title-split'] > :first-child, [data-testid='session-title-split'] > :first-child, [data-testid='chat-title-standin'], " +
    "[data-testid='frame-artifact-title'], [data-testid='artifact-data-title'], [data-testid='artifact-delete-title'], " +
    "[data-testid='artifact-share-title'], [data-testid='artifact-invite-title'], [data-testid='artifact-publish-target-title'], " +
    "[data-testid='mp-filename'], [data-testid='artifact-publish-file-name']";
  // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) الوثائق القانونية الخمس في www.anthropic.com/legal (Next.js 16 وSanity — دراسة ر3).
  // غلاف الموقع إنجليزيٌّ عند الشركة فيبقى كما هو: الترويسة والتذييل وقائمة الجوال والقوائم المنسدلة ولافتة الموافقة،
  // ومنتقي لغة الوثيقة (أسماء لغات). لا تُعرَّب ولا تُحصد، وتبقى LTR بقاعدةٍ في legal-point.css
  var LEGAL_CHROME = "header[class*='SiteHeader-module'], footer[class*='SiteFooter-module'], [class*='SiteMobileNav-module'], " +
    "[class*='Dropdown-module'], [class*='ConsentBanner-module'], [class*='LegalPageDetail-module'][class*='__language-options']";
  // متن الوثيقة: أسماء CSS Modules باسم الوحدة واسم الصنف، فالجزء المجزَّأ (G_oy1G) يتغيّر مع كل تعديلٍ للوحدة
  var LEGAL_BODY = "[class*='LegalPageDetail-module'][class*='__body']";
  // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) الأكاديمية (academy.claude.com — Vite وReact مع تصييرٍ مسبق — دراسة ر4): ما يبقى إنجليزيًّا في 2.0.0
  // ولا يُعرَّب ولا يُحصد: المتون (الدروس والدورات والشروح وحالات الاستخدام، ومنها أفلام حالات الاستخدام وتمارينها) — القرار 69،
  // وتُعرَّب في 3.0.0؛ وقائمة «في هذه الصفحة» (عناوين المتن)؛ ولافتة الإعلانات (إنجليزيةٌ عند الشركة في كل عرضٍ مترجَم)؛ وقيمة
  // منتقي اللغة وخياراته (أسماء لغات)؛ ومحادثة «اسأل Claude» (سؤال القارئ وجواب Claude — كمتن المحادثة في التطبيق). ولا محدِّد
  // بسمة aria-label: تعريبُنا للسمة كان سيُسقطه
  // ★ (المراجعة المستقلة لـر4-أ، ٢٨ ربيع الآخر ١٤٤٨هـ) نشرُ الموقع في اليوم نفسه بدّل منتقي اللغة: زرٌّ في التذييل يفتح حوارًا
  // (‎button[aria-haspopup=dialog]‎ وقيمته ‎span[lang=en]‎) وخياراته أزرار ‎[role=radio][lang]‎ — فلا يطابق المحدِّدان الأولان شيئًا، وكانت
  // «English» تُحصد في كل صفحة. والعنصر الذي يعلن لغته بسمة lang (اسمُ لغةٍ أو نصٌّ بلغته) ليس نصَّ واجهةٍ إنجليزيًّا: يُستثنى كلّه
  // (‎body [lang]‎: لا <html> الذي نكتب فيه ar)؛ وقِيس أن لا عنصر بسمة lang خارج المتن غيرُ المنتقي وخياراته. والأولان باقيان إن عاد المكوّن
  var ACADEMY_SKIP = "article.mdx-article, ul:has(> li > a[href^='#']), [data-testid^='notification-banner'], " +
    "footer [role=combobox] > span:first-child, [role=option] [lang], body [lang], [data-ask-view]";
  // اتجاه كل كتلةٍ بنصّها حيث يبقى إنجليزيٌّ في 2.0.0 (المتن، والملخصات والأهداف ووصف الأقسام وبيانات الندوات خارجه): الفقرات
  // والبنود وحدها لا حاويات التخطيط — حاويةٌ أغلبُ نصّها إنجليزي كانت ستقلب تخطيطها كلّه إلى اليسار. ومحادثة «اسأل Claude» (خارج
  // main): الاتجاه وحده لكل كتلة ونصُّها لا يُمسّ (skipSel)، كأجوبة المساعد في وثائق Claude Code (‎#chat-content‎)
  // ★ (المراجعة المستقلة لـر4-أ، ٢٨ ربيع الآخر ١٤٤٨هـ) والبند الذي ابنُه المباشر رابطٌ صفُّ تخطيطٍ لا بندُ نص (صفوف مراكز المنتجات وصفحات
  // الإعداد: ‎li > a.grid‎ بعنوانٍ ووسومٍ في خلايا): كان يُحسم بعنوانه الإنجليزي حين يبقى (اسم منتجٍ أو عنوانٌ جديد لم يُترجم) فيرث وسمُه
  // المعرَّب LTR — فحص الاتجاه بقاموسٍ تجريبي للعناوين والوسوم وحدها (والجمل إنجليزية كما في 2.0.0): نصٌّ عربي محسوب LTR ×4 في
  // ‎/products/claude‎. فالاتجاه لخلايا الصف (‎li > a > span‎) لا للصف، والبنود النصية (الأهداف: شارةٌ ثم جملة) كما كانت
  var ACADEMY_DIR = "article.mdx-article, main :is(p, figcaption, dd), main li:not(:has(> a)), main li > a > span, [data-ask-view]";
  // ★ (ر5ب، ٢٩ ربيع الآخر ١٤٤٨هـ — القرار 71) أسماء أوجه خط النظام العربي لمصادر local() في «خط النظام» (FONT_SYS أدناه). الاسم في local()
  // اسم الوجه الكامل ثم اسمه البرمجي (PostScript)، لا اسم العائلة (تجربة ر5ب البند ٦: أخفق «Noto Sans Arabic» ونجح «Noto Sans Arabic Regular»).
  // والترتيب بالنظام: خطّا ماك العربيان (SF Arabic في الحديث، ثم Geeza Pro الموجود في كل إصدار)، ثم لينكس (Noto Sans Arabic UI ثم Noto Sans
  // Arabic، ثم DejaVu Sans الذي يسقط إليه كثيرٌ من التوزيعات)؛ وأوجه ويندوز (Segoe UI) تتقدّمها في كل نطاقٍ من FONT_SYS. ولا يجتمع في
  // نظامٍ واحد اسمان من نظامين عادةً، فالقائمة تصل في كلٍّ إلى خطه هو
  var SYS_REG = ["SF Arabic", "SF Arabic Regular", "SFArabic-Regular", "Geeza Pro Regular", "GeezaPro",
    "Noto Sans Arabic UI Regular", "NotoSansArabicUI-Regular", "Noto Sans Arabic Regular", "NotoSansArabic-Regular", "DejaVu Sans", "DejaVuSans"];
  var SYS_BOLD = ["SF Arabic Bold", "SFArabic-Bold", "Geeza Pro Bold", "GeezaPro-Bold",
    "Noto Sans Arabic UI Bold", "NotoSansArabicUI-Bold", "Noto Sans Arabic Bold", "NotoSansArabic-Bold", "DejaVu Sans Bold", "DejaVuSans-Bold"];
  // الأوزان الوسيطة إن وُجدت في النظام، ثم أقرب الطرفين: ما دون 600 إلى العادي وما فوقه إلى العريض (فالعريض لا يرجع إلى عاديٍّ أبدًا)
  var SYS_LIGHT = ["SF Arabic Light", "SFArabic-Light", "Noto Sans Arabic UI Light", "NotoSansArabicUI-Light", "Noto Sans Arabic Light",
    "NotoSansArabic-Light"].concat(SYS_REG);
  var SYS_MEDIUM = ["SF Arabic Medium", "SFArabic-Medium", "Noto Sans Arabic UI Medium", "NotoSansArabicUI-Medium", "Noto Sans Arabic Medium",
    "NotoSansArabic-Medium"].concat(SYS_REG);
  var SYS_SEMI = ["SF Arabic Semibold", "SFArabic-Semibold", "Noto Sans Arabic UI SemiBold", "NotoSansArabicUI-SemiBold",
    "Noto Sans Arabic SemiBold", "NotoSansArabic-SemiBold"].concat(SYS_BOLD);
  // ★ (ر6-د، ٣٠ ربيع الآخر ١٤٤٨هـ) عتبة حارس المتن المختلط (meta.bodyGuard) في مواقع المتون الخمسة كلها — المساعدة والخصوصية والوثائق
  // والوثائق القانونية وClaude Code: ‏5٪، قرّرها المالك (القرار 83: «5٪ (موصى به)»). الصفحة التي تزيد فيها حصّة كتل المتن غير المغطّاة على
  // هذه النسبة يبقى متنها إنجليزيًّا كلُّه والواجهة حوله عربية، والصفحة التي لا قطعة لها تُحكم بقطعةٍ فارغة (القرار 84، engine.js judgeBody).
  // تغييرها في المواقع كلها هذا الرقم وحده، ولموقعٍ بعينه رقمٌ مكان الاسم في سطر bodyGuard من صفّه، وحذفُ ذلك السطر يُطفئ الحارس فيه
  var BODY_GUARD = 0.05;
  var C = {
    // ---- مفاتيح chrome.storage.local — كل مفتاح باسمه الواحد ----
    K: {
      LANG: "cml_lang",
      ENABLED: "cml_enabled",
      RTL: "cml_rtl",
      CHATRTL: "cml_chatrtl",
      OVERRIDES: "cml_overrides",
      USER_PATTERNS: "cml_user_patterns",
      SCAN_REQUEST: "cml_scan_request",
      SCAN_RESULT: "cml_scan_result",
      SCAN_CANCEL: "cml_scan_cancel",
      SCAN_CLAIM: "cml_scan_claim",
      RECON_DISMISSED: "cml_recon_dismissed",
      BAD_RULES: "cml_bad_rules",
      RTL_ENGINE: "cml_rtl_engine",       // "v2" (جذري، الافتراضي) أو "v1" (نقطي للتوافق)
      RTLDOC_REQUEST: "cml_rtldoc_request", // طلب طبيب الاتجاه (عابر — SESS)
      RTLDOC_RESULT: "cml_rtldoc_result",   // نتيجته (دائمة — local، كنتيجة الفحص)
      // المحرّك الحيّ: ورقةُ قلبٍ مبنيّةٌ من CSS الموقع الحاضر، مفتاحُها بصمةُ عناوينه
      RTL_LIVE: "cml_rtl_live",           // {fp, css, at, sources, bytes, flipped}
      // ---- المزامنة الاختيارية (المرحلة ٦) — العقد كاملًا في رأس cml-sync.js ----
      SYNC_ENABLED: "cml_sync_enabled",   // local: علم الموافقة — غيابه أو false = معطّلة
      SYNC_TOMBS: "cml_sync_tombs",       // local: شواهد الحذف {"<لغة>|<مفتاح>": وقتُ الحذف}
      SYNC_LASTHASH: "cml_sync_lasthash", // local: بصمة آخر حالة طابقت السحابة (حارس الصدى)
      SYNC_DEVICE: "cml_sync_device",     // local: هوية الجهاز — لتجاهل صدى دفعاتنا نحن
      SYNC_STATE: "cml_sync_state",       // local: حال آخر دفعة {status:"ok"|"overflow"|"error",…}
      SYNC_PENDING: "cml_sync_pending",   // local: طابع دفعة معلّقة — يضمن الدفع بعد موت العامل
      SYNC_DIRTY: "cml_sync_dirty",       // local: علامة «حدثُ سحابةٍ لم يُدمج» — تنجو من موت العامل
      // local: جيلُ المزامنة — يرفعه كل أمر إدارة (تفعيل/إيقاف/مسح/ضبط) فتُلغى جولةٌ بدأت
      // على جيلٍ أقدم قبل أن تكتب. خارج RESET_KEYS عمدًا: يبقى صاعدًا بعد إعادة الضبط
      SYNC_GEN: "cml_sync_gen",
      // local: موعد إعادة فحص سحابةٍ رُئيت ممزّقة — يلتقطه الإيقاظ إن مات العامل قبل مؤقّته
      SYNC_RECHECK: "cml_sync_recheck",
      // local: السببية (رأس cml-sync.js) — «المعروف» {هوية: {h, d}}: بصمة قيمة كل عنصرٍ ونقطة
      // آخر كتابةٍ له؛ والمتّجه {جهاز: أعلى عدّاد} لما ضمّه هذا الجهاز من كتابات
      SYNC_KNOWN: "cml_sync_known",
      SYNC_VV: "cml_sync_vv",
      SYNC_META: "cml_syncmeta",          // sync: {v,rev,at,device,count,hash,chunks} — يُكتب آخِرًا
      SYNC_CHUNK_PREFIX: "cml_syncd_",    // sync: بادئة مفاتيح الشرائح cml_syncd_0..N
      // ---- النطاقات (١-٠ب): المفتاح الرئيس cml_enabled للجميع، ولكل نطاقٍ مفتاحٌ فرعي
      SITE_ON: "cml_site",                // local: cml_site.<id> — false = النطاق مطفأ (والغياب = مفعّل)
      // local: cml_engine_site.<id> — "v1"|"v2" تجاوزٌ لمحرّك الاتجاه في موقعٍ واحد؛ غيابُه = يتبع
      // المحرّك العام cml_rtl_engine. («المبسّط» مخرج طوارئ لشاشةٍ معطوبة في موقعٍ بعينه، فلا يُسقط
      // لقطات الاتجاه في المواقع الأخرى.) والمفتاح بلاحقة الموقع للجميع، والتطبيق منها
      ENGINE_SITE: "cml_engine_site",
      V2_INIT: "cml_v2_init",             // local: علامة ترحيل أول إقلاعٍ لـ2.0.0 (قرار المالك ق٣)
      // ---- الخط العربي (2.0.0، DESIGN-fonts §٤.٢): اختيارٌ واحدٌ عامّ لكل المواقع، محلّيٌّ لا يُزامَن ----
      FONT: "cml_font",                   // local: معرّف الخط المختار أو "site"/"system" — غيابه = الافتراضي (fontResolve)
      FONT_DATA: "cml_font_data",         // local: {id, v: بصمة, b64} أو {id, v, err} — يكتبها عامل الخدمة وحده
    // مفاتيح بناءات ما قبل النشر — تُحذف عند الإقلاع ولا تُستعمل
      LEGACY_COLLECT: "cml_collect",
      LEGACY_COLLECTED: "cml_collected",
    },

    // ★ تصنيف المفاتيح (مراجعة كودكس ٢٣): كل مفتاحٍ محلي تكتبه الإضافة في صنفٍ واحد،
    // و«إعادة الضبط» تُشتق من الأصناف (RESET_CLASSES) لا من قائمةٍ تُصان يدويًّا — واختبار
    // hosttest يتحقق أن كل مفتاحٍ في K مصنَّف. الأصناف:
    //   settings : اختيارات المستخدم (اللغة، التفعيل، الاتجاه، المحرّك، مفتاح كل موقع، الخط العربي)
    //   data     : عمله (التصحيحات والقواعد وما أغلقه من مراجعة ما بعد التحديث)
    //   cache    : ما يُعاد بناؤه وحده (نتائج الفحص والطبيب، الورقة الحيّة، القواعد المعطوبة، نسخة الخط)
    //   sync     : الموافقة ودفاتر المزامنة المحلية (السحابة ليست هنا: «إعادة الضبط» محلية
    //              بالعقد، وزرُّ المحو في الإعدادات يتولى الطرف البعيد)
    //   transient: طلباتٌ عابرة تكتبها الطبقة القديمة في local (الفحص والطبيب وحجزهما)
    //   ui       : حال العرض (الترحيب)
    //   keep     : خارج إعادة الضبط عمدًا — الجيل يبقى صاعدًا، وعلامة الترحيل لا تُعاد
    //   legacy   : بقايا بناءات ما قبل النشر، تُحذف عند الإقلاع
    // per: "domain" = نسخةٌ لكل نطاق (التطبيق على الاسم القديم، والبقية بلاحقة «.<id>»)،
    //      "site" = بلاحقة النطاق للجميع (cml_site.<id>).
    KEY_CLASSES: [
      { k: "cml_lang", c: "settings" }, { k: "cml_enabled", c: "settings" },
      { k: "cml_rtl", c: "settings" }, { k: "cml_chatrtl", c: "settings" },
      { k: "cml_rtl_engine", c: "settings" }, { k: "cml_site", c: "settings", per: "site" },
      { k: "cml_engine_site", c: "settings", per: "site" }, { k: "cml_font", c: "settings" },
      { k: "cml_overrides", c: "data", per: "domain" }, { k: "cml_user_patterns", c: "data", per: "domain" },
      { k: "cml_recon_dismissed", c: "data", per: "domain" }, { k: "cml_block_ov", c: "data", per: "domain" },
      { k: "cml_block_pat", c: "data", per: "domain" },
      { k: "cml_scan_result", c: "cache", per: "domain" }, { k: "cml_bad_rules", c: "cache", per: "domain" },
      { k: "cml_rtldoc_result", c: "cache", per: "domain" }, { k: "cml_rtl_live", c: "cache", per: "domain" },
      { k: "cml_font_data", c: "cache" },
      { k: "cml_sync_enabled", c: "sync" }, { k: "cml_sync_device", c: "sync" },
      { k: "cml_sync_tombs", c: "sync", per: "domain" }, { k: "cml_sync_lasthash", c: "sync", per: "domain" },
      { k: "cml_sync_state", c: "sync", per: "domain" }, { k: "cml_sync_pending", c: "sync", per: "domain" },
      { k: "cml_sync_dirty", c: "sync", per: "domain" }, { k: "cml_sync_recheck", c: "sync", per: "domain" },
      { k: "cml_sync_known", c: "sync", per: "domain" }, { k: "cml_sync_vv", c: "sync", per: "domain" },
      // مساحة تصحيحات الفقرات (المرحلة ٢) — دفترُها المحلي كدفتر مساحة النطاق، بأسماء مستقلة
      { k: "cml_bsync_tombs", c: "sync", per: "domain" }, { k: "cml_bsync_lasthash", c: "sync", per: "domain" },
      { k: "cml_bsync_state", c: "sync", per: "domain" }, { k: "cml_bsync_pending", c: "sync", per: "domain" },
      { k: "cml_bsync_dirty", c: "sync", per: "domain" }, { k: "cml_bsync_recheck", c: "sync", per: "domain" },
      { k: "cml_bsync_known", c: "sync", per: "domain" }, { k: "cml_bsync_vv", c: "sync", per: "domain" },
      { k: "cml_scan_request", c: "transient" }, { k: "cml_scan_cancel", c: "transient" },
      { k: "cml_scan_claim", c: "transient" }, { k: "cml_rtldoc_request", c: "transient" },
      // ★ (ر8-د، المراجعة) الترحيب بحال المواقع بمفتاحٍ جديد فيُعرض مرّةً أخرى لمن أغلقه في test-2.0.0-2، والقديم بقيّةٌ تمحوها الإعدادات
      { k: "cml_welcome_v2b", c: "ui" },
      { k: "cml_sync_gen", c: "keep" }, { k: "cml_v2_init", c: "keep" },
      { k: "cml_collect", c: "legacy" }, { k: "cml_collected", c: "legacy" }, { k: "cml_welcome_v2", c: "legacy" },
    ],
    RESET_CLASSES: ["settings", "data", "cache", "sync", "transient", "ui"],
    // مفاتيح السحابة (chrome.storage.sync) — لا تصنيف محلي لها: مساحة التطبيق وبادئات النطاقات
    CLOUD_KEYS: ["cml_syncmeta", "cml_syncd_", "cmlm_", "cmlc_", "cmlbm_", "cmlbc_"],

    // ---- منفذ التحكيم (المرحلة ٤): اسم قناة runtime بين المحرك وعامل الخدمة ----
    PORT_CRAWL: "cml-crawl",

    // ---- عتبات المحرك ----
    // بوابة الترطيب (meta.hydrate = "defer"): أقصى انتظارٍ لإشارة اكتمال الترطيب بعد DOMContentLoaded
    // قبل فتح النصوص على أي حال (موقعٌ غيّر منصته فلا إشارة) — قِيس الترطيب ≈0.2–0.5ث بعده
    HYDRATE_MAX_MS: 8000,
    // ★ (قرار المالك: «الظهور مثل claude.ai») إمساك الصفحة مخفيّةً حتى الترطيب ثم التعريب، فتظهر
    // عربيةً من أول مرة: بسقفٍ بعد DOMContentLoaded (قِيس في زيارةٍ ثانية: Intercom ‏0.1–0.4 ث،
    // الوثائق 1.4–2 ث) وسقفٍ مطلق من بدء الإمساك — فإن تأخّر الترطيب أكثر ظهرت ثم عُرِّبت
    HOLD_MAX_MS: 2500,
    HOLD_ABS_MS: 6000,
    // ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ) حارس المتن المختلط (meta.bodyGuard): بعد التنقّل داخل الموقع يُحكم على الصفحة الجديدة حين يستقرّ متنها —
    // بعد تبدّلٍ في شجرتها (لا في <head>) ثم هدوءٍ بهذا القدر بلا تبدّلٍ آخر، وبسقفٍ من لحظة التنقّل يُحكم عنده بما في الصفحة. قِيس في
    // وثائق Claude Code: العنوان والمتن يتبدّلان في اللحظة نفسها، ثم إضافاتٌ صغيرة بعد 100–280 مث
    // ★ (ر6-ج، ٣٠ ربيع الآخر ١٤٤٨هـ) والتبدّل تبدّلُ هويّة شجرة المتن (engine.js guardTrack)، والهدوء يُعدّ من لحظته لا من آخر إضافة: كانت كلُّ
    // إضافةٍ صغيرة تعيد العدّ فيبقى المتن إنجليزيًّا 0.26–0.55 ث بعد التبدّل. والسقف لا يُحكم عنده على شجرة الصفحة السابقة: بعده يُحكم فور تبدّلها
    BODY_GUARD_QUIET_MS: 150,
    BODY_GUARD_CAP_MS: 2500,
    // ★ (ر6-د، ٣٠ ربيع الآخر ١٤٤٨هـ) وما دام التبدّل منتظَرًا يُنظر في هويّة الشجرة كل هذا القدر أيضًا (engine.js guardPoll): وثائق المطوّرين
    // تُبدّل الصفحة في الرجوع والتقدّم بسمة style وحدها، ومراقب الطفرات لا يراها
    BODY_GUARD_POLL_MS: 100,
    // سقف إعادة تثبيت سمات html بعد أن يمحوها الموقع (إعادة رسم الجذر في Next.js App Router)
    HTML_PIN_MAX: 10,
    // عنوان التبويب (meta.titleSuffix): موقعٌ يعيد عنوانه الإنجليزي نفسه فورَ كتابتنا (خلال FAST) هذا العدد من المرات خلال
    // النافذة (قفلٌ يراقب <head> ويعيد ما حفظه — مقيسٌ في حزم claude.ai) ⇒ نترك ذلك العنوان إنجليزيًّا حتى يتغيّر، فلا تقاذف.
    // وإعادةُ العنوان نفسه بعد مهلةٍ أطول من FAST تنقّلٌ لا قفل، فتُصفّر العدّ
    TITLE_PIN_MAX: 5,
    TITLE_PIN_WINDOW_MS: 3000,
    TITLE_PIN_FAST_MS: 100,
    // ★ (٢١ ربيع الآخر ١٤٤٨هـ، توجيه المالك: «لا يمنع أي حدٍّ تقني تعريب نص موقعٍ مهما طال ما دام ليس محادثةً أو محتوى
    // مستخدم») لم يعد TEXT_MAX سقفًا لما يترجمه المحرّك: مفتاح العقدة والسمة والعنوان بلا سقف طول (engine.js KEY_MAX)، والجمع
    // والنمط مفهرسان بثوابتهما (cml-shared patternIndex). بقي حدًّا لما يُدخله المستخدم (تصحيحاته في الإعدادات والنافذة
    // والمزامنة) ولفحص الحزم داخل الإضافة.
    TEXT_MAX: 300,
    // ما تلتقطه متغيّرات نمطٍ من نصٍّ مجتمعةً (النص ناقصَ ثوابت النمط): القالب الطويل ثوابته طويلة فيمرّ، ونمطٌ قصيرٌ عامّ
    // لا يبتلع فقرةً طويلةً لا تخصّه — والنصّ الذي لا يزيد على هذا الحدّ لا يمسّه الشرط أصلًا (السلوك قبل رفع السقف نفسه)
    PATTERN_CAPTURE_MAX: 300,
    PEND_MAX: 2000,         // سقف طابور الطفرات قبل التحول لمرور كامل
    LOOKUP_CACHE_MAX: 5000, // سقف ذاكرة نتائج البحث
    LOOKUP_CACHE_KEY_MAX: 300, // ولا يُخزَّن فيها مفتاحٌ أطول (حدُّ ذاكرةٍ لا حدُّ ترجمة: الطويل يُطلب بالفهرس كل مرة)

    // ---- عتبات الفحص ----
    CLAIM_STALE_MS: 90000,  // حجز أقدم من هذا متروك (يطابقه startScan وclaimScan حكمًا)
    SCAN_CAP: 4000,         // أقصى ما يُخزَّن من غير المترجَم (القائمتان تُقصان، العدّ يصدق)
    RTLDOC_CAP: 500,        // أقصى ما يُخزَّن من إعلانات فيزيائية غير مغطاة (العدّ يصدق)
    // سقفُ ورقة المحرّك الحيّ المخزَّنة (الحاليّ ~400ك.ب؛ ما تجاوز هذا لقطةٌ شاذّة لا تُخزَّن)
    RTL_LIVE_MAX_BYTES: 2 * 1024 * 1024,
    // أقصى عدد أوراق في الجولة: ما زاد عليه يُرفض البناءُ كلُّه (لا بناءَ جزئيًّا بصمتُه بصمةُ الكل)
    RTL_LIVE_SHEETS_MAX: 12,
    RTL_LIVE_FETCH_MS: 20000,                    // مهلة جلب الورقة الواحدة
    RTL_LIVE_SOURCE_MAX_BYTES: 6 * 1024 * 1024,  // سقف الورقة الواحدة (أكبر أوراق الموقع ~1.3م.ب)
    RTL_LIVE_TOTAL_MAX_BYTES: 12 * 1024 * 1024,  // سقف مجموع الأوراق
    // ★ ميزانية صنف cache كلِّه (DESIGN-fonts §٢.٢، ث٩): الأوراق الحيّة المحفوظة للنطاقات كلها **ونسخة الخط
    // العربي** (cml_font_data) معًا ≤ 3 م.ب. فحصة storage.local لا تقل عن 5 م.ب في أي إصدارٍ مدعوم (الأدنى Chrome 120، القرار 70) يشاركها
    // صنف data، ولا يُطرد منه شيءٌ لأجل النسخة. (الاسم باقٍ لأن العامل والاختبارات تستعمله؛ وevictLive يحسب النسخة
    // في المجموع مع وحدة الخط)
    RTL_LIVE_BUDGET_BYTES: 3 * 1024 * 1024,
    SCAN_PARALLEL: 6,       // توازي الجلب — لا يزاحم بث المحادثة على الاتصال نفسه
    HEARTBEAT_STALL_MS: 45000, // نبض أقدم من هذا في «جارٍ» = فحص متعثر
    // ماسح فهرس الصفحات (scan:"llms"): ملفٌّ عامٌّ واحد من أصل الصفحة نفسها (~70 ك.ب اليوم)
    LLMS_MAX_BYTES: 2 * 1024 * 1024,
    LLMS_FETCH_MS: 15000,
    // ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ — N6) شاراتٌ يُلحقها فهرس الصفحات بالعنوان بين قوسين في آخره (« (Beta)»: 292 عنوانًا في مرجع الواجهة
    // البرمجية في فهرس ١ جمادى الأولى، والموقع يكتب العنوان بلا لاحقة والشارةَ عنصرًا وحدها): عنوانٌ لا يغطّيه القاموس كاملًا يُبحث بأصله
    // بلا الشارة قبل أن يُعدّ غير مترجَم.
    // ★ (ر8-د، المراجعة) والقائمة مغلقة على ما ثبت أنه شارةٌ لا تظهر في العنوان، بحروفه كما في الفهرس: « (Beta)» وحدها (314 عنوانًا كلها
    // تحت ‎/docs/en/api/beta‎، وصفحتها تكتب العنوان بلا لاحقة — مقيس). أما « (beta)» و« (legacy)» و« (research preview)» في الوثائق،
    // و« (beta)» و« (removed)» في Claude Code، فنصٌّ من العنوان الظاهر في الشريط الجانبي (sidebarTitle) وفي القاموس بلاحقته؛ فلو بُحث بأصله
    // لعُدّ عنوانٌ جديدٌ منها مترجَمًا والموقعُ يعرضه إنجليزيًّا
    LLMS_BADGES: ["Beta"],

    // ---- سقوف الاستيراد ----
    IMPORT_MAX_BYTES: 5 * 1024 * 1024,
    IMPORT_MAX_TERMS: 20000,
    IMPORT_MAX_RULES: 2000,

    // ---- عتبات المزامنة (حصص chrome.storage.sync الحقيقية: 8192 بايت للعنصر،
    //      102400 للمجموع، 512 عنصرًا، وسقفُ كتابات بالدقيقة — فالأرقام دونها بهامش) ----
    SYNC_ITEM_BYTES: 7500,          // سقف (مفتاح + قيمة JSON) للشريحة الواحدة، بايتات UTF-8
    SYNC_TOTAL_BYTES: 92000,        // سقف مجموع اللقطة (الشرائح + الميتا)
    SYNC_TOMB_MAX: 200,             // سقف شواهد الحذف — الأقدم يُسقَط أولًا
    // عمر الشاهد: شهر ثم يُنسى. ليس دليلًا أن الحذف بلغ الأجهزة كلها — جهازٌ يغيب أطول
    // وفيه تعديلاتٌ لم تُرفع قد يُعيد ما حُذف (حدٌّ موثّق: الطابع للمجموعة لا للمفتاح)
    SYNC_TOMB_TTL_MS: 30 * 24 * 3600 * 1000,
    // لقطةٌ طابعُها أبعدَ من هذا في المستقبل = ساعةُ جهازٍ منحرفة: لا تُؤتمن على
    // الحذف بالغياب (وإلا محت تصحيحات الجهاز السليم في كل دمج)
    SYNC_SKEW_TOLERANCE_MS: 5 * 60 * 1000,
    // عدّاد النقطة ساعةٌ منطقية هجينة: max(عدّاد الجهاز + 1، الدقائق منذ هذا المبدأ) — فالحسم بين
    // كتابتين متزامنتين للأحدث وقتًا لا لأكبر عدّادٍ مصادفةً (المراجعة الثالثة)
    SYNC_HLC_EPOCH_MS: 1672531200000,           // 2023-01-01T00:00:00Z (ثابتٌ صريح لا Date.UTC)
    SYNC_PUSH_DEBOUNCE_MS: 2000,    // تجميع التعديلات المتتابعة قبل الدفع (سقف الكتابات)
    // طابعٌ معلّق أقدمُ من هذا عند الإيقاظ = مؤقّتٌ مات مع عامله ⇒ دفعٌ فوري؛ والأحدثُ
    // منه ينتظر بقيّة المهلة بمؤقّتٍ جديد (المؤقّت الأصلي مات، والانتظار وحده لا يُعيده)
    SYNC_WAKE_GRACE_MS: 10000,
    // كتابتان متسابقتان قد تتركان السحابة ممزّقة: القارئ يُصلحها بدفعةٍ جديدة —
    // وهذه أقلُّ مدةٍ بين إصلاحين، حارسًا من دورة إصلاحٍ لا تنتهي بين جهازين
    SYNC_REPAIR_MIN_MS: 60 * 1000,
    // لقطةٌ تُقرأ أثناء كتابةِ جهازٍ آخر تبدو ممزّقةً وهي سليمة: لا يقع الإصلاح إلا
    // إن بقي التمزّق بعد هذه المدة (تفوق زمن انتشار كتابةٍ عادية)
    SYNC_TORN_CONFIRM_MS: 20 * 1000,
    // إعادة المحاولة بعد قراءةٍ أو كتابةٍ فاشلة، بمؤقّتٍ ما دام العامل حيًّا (دون مهلة
    // خموله ~30ث) — وإن مات فالطابع المعلّق أو العلامة يلتقطهما الإيقاظ
    SYNC_RETRY_MS: 20 * 1000,
    // سعة مساحات النطاقات: ما يتبقّى من سقف كروم الكلي بعد بقية المفاتيح، ناقصًا هامشًا
    // (قرار المالك ق١٠: بأفضل جهد — ما لا يسع يبقى محليًّا ويُعاد لاحقًا بلا فقد)
    SYNC_CHROME_TOTAL: 102400,
    SYNC_DOMAIN_MARGIN: 2048,
    // ★ (المرحلة ٢، قرار المالك ق٢) تصحيحات الفقرات تُزامَن بأدنى أولوية: مساحتُها ما يبقى بعد كل ما سواها
    // ناقصًا هامشًا لنموّ تصحيحات الواجهة، ومساحةُ الواجهة تُخليها متى احتاجت (لا تتوقف مزامنة الواجهة أبدًا)
    SYNC_BLOCK_HEADROOM: 8192,
    BLOCK_VAL_MAX: 8000,     // أطول قالبٍ عربي لفقرةٍ يُقبل تصحيحًا (المتون حتى BLOCK.MAX=4000 إنجليزيًّا)

    // ═══ جدول النطاقات (١-٠ب) — المصدر الواحد لها في المحرّك والعامل والخيارات والبناء ═══
    // id هو اسم النطاق في المفاتيح (key) والقواميس؛ «app» يبقى على مفاتيح 1.0.0 بلا لاحقة
    // فلا ترحيل. meta تحملها قواميس النطاق نفسها (build.mjs يحقنها) فالمحرّك يعرف نطاقه
    // من قاموسه لا من اسم المضيف:
    //   scan  : "app" فحص حزم التطبيق | "llms" فهرس llms.txt (المسار meta.llms، وافتراضه "/llms.txt")
    //           | "none" لا فحص
    //   live  : ورقة اتجاهٍ حيّة من أوراق الصفحة (وإلا فاللقطة المشحونة وحدها)
    //   liveInline: أوراق <style> المضمَّنة في الورقة الحيّة — اختياريةٌ لكل نطاق (غيابها = الروابط وحدها): true كلُّها،
    //           أو محدِّدٌ يحصرها؛ وما داخل المحادثة أو skipSel خارجها أبدًا (المحرّك يستثنيه، والعامل يرفضها من نطاقٍ لم يخترها)
    //   siteLang: حارس لغة الموقع — لغةٌ غير الإنجليزية يكتبها الموقع في <html lang> (إعداد الحساب) تُخمد الإضافة (التطبيق)
    //   siteLangSel: (ر3) حارسٌ ثانٍ للغة الموقع — محدِّد عنصرٍ يسمّي لغة المحتوى المعروض (منتقي لغة الوثيقة في anthropic.com/legal):
    //           نصُّه غير ما في siteLangOk (افتراضه ["English"]) ⇒ الإضافة خاملة كحارس <html lang>؛ وغيابُ العنصر لا يُخمدها
    //   siteLangOk: نصوص ذلك العنصر التي تعني الإنجليزية
    //   siteLangHow: (ر5) علاج «الواجهة بلغةٍ غير الإنجليزية» في النافذة لموقعٍ تُختار لغته في الصفحة نفسها لا في إعدادات الحساب: جملةُ أمرٍ
    //           عربية تُلحق بالسبب («… — <العلاج> لتعمل الإضافة.»)؛ وغيابها = «اجعلها English من إعداداتها» كما في claude.ai
    //   chat  : استثناء نصّ المحادثة وضبط اتجاهه (التطبيق وحده)
    //   hydrate: "none" | "defer" (السمات مبكرًا والنصوص بعد ترطيب الصفحة)
    //   hydrateMaxMs: سقف انتظار إشارة الترطيب لهذا النطاق بدل HYDRATE_MAX_MS (موقعٌ صفحاته الثقيلة أبطأ ترطيبًا)
    //   hydrateSignal: "announcer" (الافتراض: next-route-announcer وحده) | "idle" (الإشارة ثم load ثم فترتا خمولٍ للخيط
    //           الرئيس — لموقعٍ يترطّب انتقائيًّا بعد الإشارة فتُفشل كتابتُنا المبكرة ترطيبَه: React ‎#418‎) | "lang" (ر4: أول كتابةٍ
    //           من الموقع نفسه لسمة <html lang> بعد اكتمال التحليل — لا كتابتُنا — ثم load وفترتا خمولٍ كـ"idle"؛ لموقعٍ بلا
    //           next-route-announcer يكتب لغة واجهته عند تركيب تطبيقه: الأكاديمية، ويلزمه siteLang). السقفان كما هما
    //   isoLabels: عزل اللافتات اللاتينية الخالصة التي لم تُترجم وفي طرفها رمز («C#» تُرسم «#C» في سياق RTL) بـLRI…PDI في
    //           عقدة نصّها — حين تكون وحدها نصَّ صندوق سطرها واتجاهُها المحسوب RTL (engine.js isolateLabel). لا يُفعَّل في نطاقٍ فيه
    //           نصوصٌ كتبها المستخدم خارج متن المحادثة (عناوين المحادثات في التطبيق)
    //   routes: حارس المسار — exact: مساراتٌ كاملةٌ بالمساواة (بعد نزع الشرطة الختامية)، full: بادئاتٌ
    //           يعمل فيها كاملًا، shell: هيكلٌ فقط؛ وما سواها خامل
    //   bodies: متونٌ بوضع الكتلة (المرحلة ٢) — قطعةٌ لكل صفحة من bodies/<id>/<لغة>/ داخل المتن (bodySel)
    //   bodyGuard: ★ (ر6-ب) حارس المتن المختلط — نسبةٌ من 0 إلى أقل من 1: إذا زادت حصّة كتل المتن الحيّة التي لا تغطّيها قطعة الصفحة (لا ترجمة لها
    //           ولا علامة إبقاء ولا يعرّبها قاموس الواجهة ولا هي محايدة بلا كلمةٍ لاتينية) على هذه النسبة لم يُكتب داخل متن تلك الصفحة شيء:
    //           يبقى المتن إنجليزيًّا كلُّه والواجهة حوله عربية، وعلى الجذر data-cml-body="held". يُحكم مرّةً لكل صفحة بعد وصول قطعتها
    //           وترطيبها، وما يظهر بعده (لوحات التبويب والأكورديون) يتبع الحكم. غيابُها = لا حارس (كما كان).
    //           ★ (ر6-د — القرار 84) والصفحة التي لا قطعة لها تُحكم بقطعةٍ فارغة فتُحجب كذلك إلا أن يغطّي قاموسُ الواجهة متنَها، ومعها
    //           data-cml-held="none" (و"drift" لما لها قطعة) — والعتبة في المواقع الخمسة BODY_GUARD (القرار 83)
    //   pageAlias: [{re, to}] — مساراتٌ عدّة لصفحةٍ واحدة تُردّ إلى مفتاحها القانوني (SHARED.pageKey: المحرّك والعامل والحاصد والبناء
    //           معًا): re مصدرُ تعبيرٍ على المسار بلا شرطةٍ ختامية، وto قالبُ الاستبدال ($1…). مرجع الوثائق: صفحات SDK (‎/api/python/…‎)
    //           نصوصُ ما نترجمه فيها هي نصوص صفحة HTTP حرفًا بحرف، فقطعتُها قطعتُها
    //   skipSel: ما لا يُترجم ولا يُحصد أبدًا في النطاق (محتوى مولَّد كأجوبة المساعد، والعقد البرمجي في مرجع الوثائق، وأسماءٌ كتبها
    //           المستخدم في التطبيق: المحادثات والمشاريع والمُخرَجات والملفات — APP_USER_NAMED) — كاستثناء المحادثة في التطبيق
    //   fontFamilies: القائمة المغلقة لعائلات خطوط الموقع التي يُعكس فيها الخط العربي {عائلة: دور} (DESIGN-fonts §٤.٣)؛
    //           الدور ui أو read أو mono (ق٤)، والأسماء مطبَّعة (SHARED.normFamily: بلا تنصيص) — ولا وجه لعائلةٍ
    //           خارجها ولا لاسمٍ فيها لم يعلنه الموقع نفسه في document.fonts. تفحص «fonts.mjs verify» كلَّ اسمٍ منها
    //           في @font-face من لقطة نطاقه (الانجراف)
    //   fontPrepend: متغيّرا خط Intercom على <html> يُلحق بهما «cml-ar» حين يبدآن بخط نظام أو باسمٍ عام (§٤.٤)
    //   fontFallback: (ر5ب) اسم الخط المحلي في أوجه «<عائلةٍ من fontFamilies> Fallback» التي تولّدها next/font للموقع (local(Arial)) —
    //           بها تُبنى في «خط النظام» مرايا الرفيقة اللاتينية بعريضها (cml-font.js)، وتفحص «fonts.mjs verify» مصدرها في اللقطة (الانجراف)
    //   titleSuffix: ذيول عنوان التبويب كما يكتبها الموقع (الفاصل ثم الاسم) — قرار المالك ١٩ ربيع الآخر ١٤٤٨هـ «ترجم كل شيء»
    //           يشمل <title>. العنوان يُبحث كاملًا في القاموس أولًا، وإلا فما قبل الذيل بالبحث نفسه (القاموس والجموع والأنماط)
    //           والذيل باسمه من قاموس الموقع (أو titleKeep)؛ وما لم يُترجم منهما يُبقي العنوان كلّه على أصله (لا عنوان مختلط)
    //   titleKeep: أسماء ذيولٍ هي أسماء منتجات تبقى كما هي («Claude»، «Claude Code»)
    //   titleSkip: مصادر تعابير على location.pathname — مساراتٌ عنوانُها محتوى المستخدم (اسم محادثة أو مشروع أو مُخرَج…)
    //           فلا يُقرأ عنوانها للمطابقة أصلًا، وما كتبناه فيه قبل التنقّل يُرجع
    //   siteLabel: (ر4) عنوان الموقع المختصر في الإعدادات والنافذة بدل المشتقّ من أول بادئةٍ في routes.full (موقعٌ بادئاتُه
    //           كثيرة لا تختصره أولاها: «academy.claude.com/all»)
    // ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ) وخارج meta (لا يُحقن في القاموس، فالمحرّك لا يحتاجه) حقل status: حال تعريب الموقع في هذا الإصدار —
    //   المصدر الواحد لعلامة «كامل» أو «جزئي» في بطاقة الترحيب ولجملة «وتبقى بالإنجليزية في هذا الإصدار…» تحتها (options.js renderWelcome):
    //   {full: true} كاملٌ؛ وإلا {part: سببٌ قصير يُكتب بعد «جزئي:»، en: ما يبقى منه بالإنجليزية بصيغة بندٍ في تلك الجملة}، وغياب en = لا بند
    //   (وثائق المطوّرين: باقيها ما غيّره الموقع بعد ترجمته، ولذلك ذيلُ الجملة العام). ويمتحنه _optionstest على المشحون
    //   (للنطاقات القادمة، مقيسًا في ٢٠ ربيع الآخر ١٤٤٨هـ: claude.com « | Claude by Anthropic»؛ والأكاديمية « · Claude Academy» صار لها
    //   نطاقها في ر4؛ وصفحات anthropic.com « \ Anthropic» بشرطةٍ مائلة عكسية — مقيسٌ في ٢٨ ربيع الآخر ١٤٤٨هـ، والوثائق القانونية أولها)
    DOMAINS: [
      { id: "app", name: "تطبيق Claude", host: "claude.ai", origin: "https://claude.ai",
        matches: ["https://claude.ai/*", "https://*.claude.ai/*"], dict: "dictionary.js", allFrames: true,
        status: { full: true },
        // إطارات assets.claude.ai: عروضٌ تسويقية تضمّنها صفحات claude.com، والنجمة مع all_frames كانت تحقن المحرّك فيها
        // فتنقلب وتُعرَّب داخل صفحةٍ غير معرَّبة (مقيس على 1.0.0 المنشور) — تضييقٌ لا يطلب إذنًا.
        // ومثلها (جرد S3-E، ١٩ ربيع الآخر ١٤٤٨هـ): pivot.claude.ai لوحةُ إضافة المكتب (Office/Google Docs) وهي إنجليزيةٌ عند
        // الشركة، و‎*.livepreview.claude.ai‎ معايناتُ تطبيقات المستخدم نفسه (محتواه لا واجهتنا)
        excludeMatches: ["https://assets.claude.ai/*", "https://pivot.claude.ai/*", "https://*.livepreview.claude.ai/*"],
        meta: { scan: "app", live: true, chat: true, hydrate: "none", siteLang: true,
                // أسماء المحادثات والمشاريع والمُخرَجات والملفات: محتوى المستخدم لا يُعرَّب ولو طابق نصَّ واجهة (APP_USER_NAMED)
                skipSel: APP_USER_NAMED,
                fontFamilies: { "anthropic-sans": "ui", "anthropic-serif": "read", "anthropic-mono": "mono" },
                // عنوان التبويب (من حزم الموقع، ٢٠ ربيع الآخر ١٤٤٨هـ): رأسُ المسار «<العنوان> - Claude» (والجذر «Claude» وحده،
                // وبعض المسارات عنوانٌ كامل بلا ذيل)، وأداة العنوان في المكوّنات «<الاسم> - Claude»، وClaude Code على الويب «<…> | Claude Code»
                titleSuffix: [" - Claude", " | Claude Code"], titleKeep: ["Claude", "Claude Code"],
                // مساراتٌ عنوانها اسمٌ كتبه المستخدم أو مؤسسته (من جدول المسارات في الحزم): المحادثات (ومحادثات التحليلات)، والمشاريع،
                // والمُخرَجات بأعيانها (لا قائمتا ‎/artifacts‎ و‎/artifacts/design‎)، والمشارَكات، وتقارير الرؤى، والرسائل، وعناصر الدليل،
                // والذاكرة، والتصاميم؛ ثم كل مسارٍ فيه معرِّفٌ معتم (UUID، أو ‎session_…‎ وأمثاله) — عنوانه اسمُ ما يعرّفه
                titleSkip: ["(^|/)chat/[^/]", "(^|/)project/[^/]", "(^|/)artifact/[^/]", "^/artifacts/(?!design/?$)[^/]",
                            "^/(public/artifacts|cowork-artifact)/[^/]", "(^|/)share/[^/]", "(^|/)insights/(?!new/?$)[^/]",
                            "(^|/)messages/[^/]", "(^|/)directory/[^/]", "(^|/)memory/[^/]", "(^|/)design/[^/]",
                            // (المراجعة العدائية، ٢٠ ربيع الآخر ١٤٤٨هـ، من حزم الموقع) ومعرّفاتٌ قد لا تكون UUID ولا «بادئة_رقم»: عناصر
                            // مكتبة «تخصيص» (أداة العنوان «<اسم المهارة أو الإضافة أو الموصّل> - Claude»، ومنها ما صنعه المستخدم أو
                            // مؤسسته) عدا صفحة «اكتشاف»، والمهام المجدولة (معرّفها اسمٌ بصيغة kebab)، والمساحات، وتفاصيل
                            // الروتينات والمجدولات (عنوانها اسمُها) عدا صفحة «جديد»
                            "^/customize/[^/]+/(?!discover/?$)[^/]", "(^|/)scheduled-task/[^/]", "(^|/)space/[^/]",
                            "(^|/)(scheduled|routines)/(?!new/?$)[^/]",
                            // (UUID في أي موضعٍ من المسار ولو ببادئة؛ والمعرِّف ذو البادئة مقطعٌ كامل فيه رقمٌ لزامًا: «aws_marketplace»
                            // و«cowork_sessions» اسما مسارين لا معرِّفان)
                            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
                            "/[a-z]{2,16}_(?=[0-9A-Za-z]*[0-9])[0-9A-Za-z]{8,}(/|$)"] } },
      { id: "support", name: "مركز المساعدة", host: "support.claude.com", origin: "https://support.claude.com",
        matches: ["https://support.claude.com/en/*"], dict: "dict-support.js", allFrames: false,
        status: { full: true },
        meta: { scan: "none", live: false, chat: false, hydrate: "defer", intercom: true, bodies: true, dirSel: INTERCOM_DIRSEL, bodySel: INTERCOM_BODYSEL,
                // ★ (ر6-د) حارس المتن المختلط بعتبة القرار 83 (BODY_GUARD أعلاه)
                bodyGuard: BODY_GUARD,
                fontFamilies: { "AnthropicSans-Regular-Web": "ui", "AnthropicSerif-Regular-Web": "read" }, fontPrepend: INTERCOM_FONT_VARS,
                // «<المقالة أو المجموعة> | Claude Help Center»، والرئيسية «Home | …» (وأكثرها في القاموس كاملةً من حصاد DOM)
                titleSuffix: [" | Claude Help Center"] } },
      { id: "privacy", name: "مركز الخصوصية", host: "privacy.claude.com", origin: "https://privacy.claude.com",
        matches: ["https://privacy.claude.com/en/*"], dict: "dict-privacy.js", allFrames: false,
        status: { full: true },
        meta: { scan: "none", live: false, chat: false, hydrate: "defer", intercom: true, bodies: true, dirSel: INTERCOM_DIRSEL, bodySel: INTERCOM_BODYSEL,
                // ★ (ر6-د) حارس المتن المختلط بعتبة القرار 83 (BODY_GUARD أعلاه)
                bodyGuard: BODY_GUARD,
                fontFamilies: { "Tiempos Text Regular": "read" }, fontPrepend: INTERCOM_FONT_VARS,
                titleSuffix: [" | Anthropic Privacy Center"] } },
      // ★ (ر3) الوثائق القانونية الخمس (دراسة ر3، ٢٨ ربيع الآخر ١٤٤٨هـ): المسارات الخمسة بأعيانها، وسائر /legal/ والأرشيف خامل.
      // المطابقة ‎/legal/*‎ وحدها (أضيق نمطٍ يعمل: يشمل سلسلة الاستعلام والتنقّل بين الوثائق داخل الموقع)
      { id: "legal", name: "الوثائق القانونية", host: "www.anthropic.com", origin: "https://www.anthropic.com",
        matches: ["https://www.anthropic.com/legal/*"], dict: "dict-legal.js", allFrames: false,
        // ★ (ر8-د) أربعٌ من الخمس: سياسة الاستخدام (‎/legal/aup‎) بلا قطعةٍ حتى يُحسم q90 (القرار 84)
        status: { part: "أربعُ وثائق من خمس", en: "سياسة الاستخدام في الوثائق القانونية" },
        // live: الموقع يُنشر كثيرًا وتتبدّل أسماء أوراقه وأصناف وحداته، فاللقطة المشحونة للطلاء الأول والحيّة تُبنى من أوراقه السبع.
        // hydrate: Next.js App Router — السمات والاتجاه مبكرًا والنصوص بعد إشارة الترطيب (المتن في غلاف الجذر فيترطّب في إيداعه).
        // ★ (قياس ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) الإشارة الافتراضية (next-route-announcer) تكفي فلا hydrateSignal ولا hydrateMaxMs: الصفحات الخمس
        // بالإضافة الحقيقية وقاموسٍ وقطعٍ تجريبية تكتب العنوان والرأس والمتن كلّه — 0 خطأ React في 25 تحميلًا بها و15 بدونها، والإشارة
        // بعد DOMContentLoaded بـ0.1–0.4 ث، وأول كتابةٍ عربية بعدها بـ9–20 مث لا قبلها أبدًا (و<title> في <body> يُعرَّب كذلك)
        meta: { scan: "none", live: true, chat: false, hydrate: "defer", bodies: true, siteLang: true,
                // ★ (ر6-د) حارس المتن المختلط بعتبة القرار 83 (BODY_GUARD أعلاه): وسياسة الاستخدام (‎/legal/aup‎) بلا قطعةٍ حتى يُحسم q90،
                // فتُحجب بلا تنبيه (القرار 84)
                bodyGuard: BODY_GUARD,
                routes: { exact: ["/legal/privacy", "/legal/non-user-privacy-policy", "/legal/cookies", "/legal/aup", "/legal/consumer-terms"] },
                dirSel: LEGAL_BODY, bodySel: LEGAL_BODY, skipSel: LEGAL_CHROME,
                // منتقي لغة الوثيقة يبدّل المتن في React بلا تغييرٍ في العنوان ولا <html lang>، ويبدأ بلغة بلد الزائر إن وُجدت ترجمتها
                siteLangSel: "[class*='LegalPageDetail-module'][class*='__language-options'] [class*='singleValue']",
                siteLangOk: ["English"],
                fontFamilies: { anthropicSans: "ui", anthropicSerif: "read", anthropicMono: "mono" },
                // ★ (ر5ب) رفيقات «anthropicSans Fallback» وأخواتها: local(Arial) بواصفات حجمٍ (لقطة sitecss-legal) — بها «خط النظام» هنا
                fontFallback: "Arial",
                // «<العنوان> \ Anthropic» (الفاصل شرطةٌ مائلة عكسية؛ sepSplit يعرفها بعد ر3)، وAnthropic اسم الشركة يبقى كما هو
                titleSuffix: [" \\ Anthropic"], titleKeep: ["Anthropic"] } },
      // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) الأكاديمية: الواجهة والعناوين في 2.0.0 (القرار 69)، والمتون في 3.0.0 (دراسة ر4). الصفحات الإنجليزية بلا
      // بادئة لغة؛ وصفحات اللغات الأخرى ‎/<لغة>/…‎ خاملةٌ بحارس المسار من بدء المستند؛ وحارس <html lang> (siteLang) يُخمد الإضافة حين
      // تعرض الواجهةُ لغةً أخرى في صفحةٍ بلا بادئة (اختيارٌ محفوظ في academy.locale أو لغة المتصفح — يكتبها الموقع في <html lang> بعد
      // التركيب، مقيسًا). والمطابقة المضيفُ كلّه: الموقع تطبيقٌ واحد يتنقّل بين أقسامه (وبين الإنجليزية و‎/<لغة>/‎) من جهة العميل
      { id: "academy", name: "أكاديمية Claude", host: "academy.claude.com", origin: "https://academy.claude.com",
        matches: ["https://academy.claude.com/*"], dict: "dict-academy.js", allFrames: false,
        // ★ (ر8-د) الواجهة والعناوين في 2.0.0 والمتون في 3.0.0 (القرار 69)
        status: { part: "الواجهة وعناوين الدورات والدروس", en: "محتوى أكاديمية Claude عدا واجهتها وعناوين الدورات والدروس" },
        // live: Vite يبدّل أسماء أوراقه المجزَّأة مع كل نشر، فاللقطة المشحونة للطلاء الأول والحيّة تُبنى من أوراق الصفحة (٢–٣).
        // hydrate: كتابةُ نصٍّ قبل الترطيب تُفشله فيرمي React ما رسمه الخادم ويُبلغ الموقعُ «[prerender] hydration failed» إلى
        // مراقبته (مقيس: دراسة ر4 §1.4)؛ ولا next-route-announcer فيه، فالإشارة "lang": أول كتابةٍ منه لـ<html lang> (أثر IntlProvider
        // عند التركيب) ثم load وفترتا خمول — الوحيدة التي اجتازت 4/4 في القياس (السمات والاتجاه مبكرًا كما في غيره).
        // ★ (قياس ر4-أ بالإضافة الحقيقية وقاموسٍ تجريبي يكتب الواجهة والعنوان والسمات، ٢٨ ربيع الآخر ١٤٤٨هـ) صفحات العيّنة الاثنتا عشرة ×3:
        // 0 بلاغ ترطيب و0 خطأ React في 36 تحميلًا بها و36 بدونها، وما رسمه الخادم باقٍ؛ والبوابة «open:lang+idle» في كلها، وكتابة الموقع
        // لـlang بعد DOMContentLoaded بـ0.22–0.55 ث، وأول نصٍّ عربي بعد DOMContentLoaded بـ0.5–1.8 ث (والسقف 8 ث)، ولا كتابة قبل كتابته أبدًا
        meta: { scan: "none", live: true, chat: false, hydrate: "defer", hydrateSignal: "lang", siteLang: true, isoLabels: true,
                // أول بادئةٍ في routes.full («/all/») لا تختصر الموقع
                siteLabel: "academy.claude.com",
                // ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر4-أ L6) لغة الواجهة هنا منتقٍ في تذييل الصفحة (يحفظ اختياره في academy.locale)، لا إعدادٌ في الحساب
                siteLangHow: "اختر English من منتقي اللغة في تذييل الصفحة",
                // الصفحة الرئيسة بعينها (بادئة «/» كانت ستُعمل ‎/<لغة>/…‎ كلها)، وأقسام الموقع الإنجليزية بادئاتٍ، ومنها صفحات الدخول (واجهتها في
                // فهرس الرسائل)؛ وصفحتا المساعدة هيكلٌ فقط (الشركة تبقي محتواهما إنجليزيًّا في كل لغة). وما سواها خامل: ‎/<لغة>/…‎ وصفحات
                // الإدارة الداخلية (/admin/ وبيانات المؤسسة، و/garden/ و/_dev/ و/embed/ و/oauth/ و/mcp) وكل قسمٍ جديد لا نعرفه
                routes: { exact: ["/"],
                          full: ["/all/", "/courses/", "/tutorials/", "/use-cases/", "/collections/", "/products/", "/webinars/",
                                 "/verify/", "/paths/", "/login/", "/dashboard/", "/settings/", "/start/", "/welcome/",
                                 "/goodbye/", "/badges/", "/certificates/", "/fluency-check-in/"],
                          shell: ["/help/"] },
                // في مسار الهيكل يبقى محتوى الصفحة على أصله LTR (academy-point.css ببوابة data-cml-route)
                shellSel: "main",
                dirSel: ACADEMY_DIR, skipSel: ACADEMY_SKIP,
                // عائلات @font-face في أوراق الموقع (أسماء claude.ai نفسها)
                fontFamilies: { "anthropic-sans": "ui", "anthropic-serif": "read", "anthropic-mono": "mono" },
                // «<الصفحة أو الوحدة> · Claude Academy»، والدرس «<الدرس> · <الدورة> · Claude Academy» (حرفيٌّ مشتقّ وقت الدمج)،
                // والرئيسة «Claude Academy · …» حرفيٌّ كامل؛ واسم المنتج يبقى لاتينيًّا (تبقيه الشركة كذلك في لغاتها كلها)
                titleSuffix: [" · Claude Academy"], titleKeep: ["Claude Academy"] } },
      { id: "docs", name: "وثائق المطوّرين", host: "platform.claude.com", origin: "https://platform.claude.com",
        matches: ["https://platform.claude.com/*"], dict: "dict-docs.js", allFrames: false,
        // ★ (ر8-د) ما غيّره الموقع بعد ترجمته يحجبه حارس المتن (القراران 83 و84) حتى تحديثٍ قادم — ولا en: له ذيلُ جملة الترحيب العام
        status: { part: "الصفحات التي غيّرها الموقع بعد ترجمتها تبقى بالإنجليزية حتى تحديثٍ قادم" },
        // ★ (S6-C، ٢١ ربيع الآخر ١٤٤٨هـ) hydrateSignal "idle": كتابتنا بعد الإشارة وحدها كانت تسبق ترطيب المتن والرأس
        // فيقع خطأ React ‎#418‎ في كل تحميل (قِيس بالإضافة وبدونها على thinking وrelease-notes) — انظر engine.js hydrationSignal
        // ★ (S7-B، المراجعة العدائية) وسقف الترطيب 20 ث كوثائق Claude Code: صفحات المرجع الثقيلة (messages/create 5 م.ب
        // وbeta وmessages) يتأخّر فيها DOMContentLoaded إلى 4–11 ث، فالسقف العام (8 ث منه) كان يفتح النصوص قبل الإشارة («timeout»
        // في كل تحميلٍ مقيس) فيقع خطأ React ‎#418‎ ويُعاد رسم المرجع — وفي الصفحات الخفيفة تسبق الإشارةُ السقفَ فلا يتغيّر شيء
        meta: { scan: "llms", live: true, chat: false, hydrate: "defer", hydrateSignal: "idle", hydrateMaxMs: 20000, bodies: true, isoLabels: true,
                // ★ (ر6-د) حارس المتن المختلط بعتبة القرار 83 (BODY_GUARD أعلاه): يسري على ما لم يُترجم من متغيّر الوثائق عند الإصدار
                bodyGuard: BODY_GUARD,
                // ★ (S7-B، ٢١ ربيع الآخر ١٤٤٨هـ) مرجع الواجهة البرمجية (‎/docs/en/api/‎) مسارٌ كامل: كان هيكلًا فقط (shell) فيبقى ‎.stldocs-root‎
                // كلُّه إنجليزيًّا والصفحاتُ النثرية العشر تحته (overview وerrors وrate-limits…) بلا متون — والشركة تترجم فيه ما يسمّي
                // العملية ويصفها. وما تبقيه على أصله مستثنًى بمحدِّد (skipSel = STL_KEEP) لا يُترجم ولا يُحصد
                routes: { full: ["/docs/en/"] },
                // المتن والعنوان (.docs-prose) وبنود الفهرس، وجزر المرجع المترجَمة (STL_DIR) — كل كتلةٍ بحسب نصّها
                dirSel: ".docs-prose, nav li:has(> a[href^='#']), " + STL_DIR,
                bodySel: ".docs-prose, .stldocs-root, nav:has(li > a[href^='#'])",
                // ★ (ر7-ب، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ ر7، M2) لافتة «القسم الحالي» في الشريط اللاصق دون عرض xl («الصفحة / القسم»): نصُّها نصُّ
                // عنوانٍ من المتن، فتأخذ نصَّه المعروض بحال حارس المتن (engine.js echoText) لا قاموس الواجهة. واسم الصفحة قبلها (خارج ‎div.flex.min-w-0‎)
                // من قاموس الواجهة كما كان
                echoSel: "div.fixed.inset-x-0[class*='top-[calc(3.5rem'] div.flex.min-w-0 > button span.truncate",
                skipSel: STL_KEEP,
                // صفحات SDK في المرجع (‎/docs/en/api/python/messages/create‎ و‎…/http/…‎ وروابط المرجع الداخلية منها) قطعتُها قطعةُ الصفحة
                // القانونية: البادئات الثماني و«http» بديلُ الافتراضية (مقيسةٌ في الدراسة؛ وkotlin وterraform واسمٌ مختلَق 404 ليّنة)
                pageAlias: [{ re: "^(/docs/en/api)/(?:http|python|typescript|go|java|ruby|csharp|php|cli)(?=/)", to: "$1" }],
                fontFamilies: { anthropicSans: "ui", anthropicSerif: "read", anthropicMono: "mono" },
                // ★ (ر5ب) رفيقات «anthropicSans Fallback» وأخواتها: local(Arial) بواصفات حجمٍ (لقطة sitecss-docs) — بها «خط النظام» هنا
                fontFallback: "Arial",
                // «<الصفحة> - Claude Platform Docs»، وفي المرجع «<العملية> - Claude API Reference»
                titleSuffix: [" - Claude Platform Docs", " - Claude API Reference"] } },
      // ★ وثائق Claude Code (Mintlify فوق Next.js — دراسة code-claude-docs.md §٨ ومراجعتها المستقلة، ١٣ ربيع الآخر ١٤٤٨هـ)
      { id: "code", name: "وثائق Claude Code", host: "code.claude.com", origin: "https://code.claude.com",
        matches: ["https://code.claude.com/docs*"], dict: "dict-code.js", allFrames: false,
        // ★ (ر8-د) المقالات في 3.0.0 (القرار 82: لم تُشحن متونها)
        status: { part: "الواجهة وحدها", en: "مقالات وثائق Claude Code" },
        // فهرس الصفحات تحت /docs صراحةً: نسخة الجذر (/llms.txt) خارج المطابقة ولا ضمان لبقائها (المراجعة ج-٤).
        // وسقف الترطيب 20 ث: قِيس ترطيب أثقل الصفحات بين 8.6 و14.6 ث (settings-reference وchangelog)، والسقف
        // العام 8 ث كان يكتب النصوص قبل الترطيب فيقع خطأ React ‎#418‎ ويُعاد رسم الصفحة كلها
        meta: { scan: "llms", llms: "/docs/llms.txt", live: true, chat: false, hydrate: "defer", hydrateMaxMs: 20000, bodies: true,
                // ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ) حارس المتن المختلط: تغيّر الموقع بعد حصاد ٢٥ سبتمبر فصارت كتلٌ إنجليزية بين العربية في أكثر
                // صفحاته؛ فالصفحة التي تزيد فيها حصّة الكتل غير المغطّاة على العتبة تبقى إنجليزية المتن كلَّه.
                // ★ (ر6-د) والعتبة 5٪ بقرار المالك (القرار 83، BODY_GUARD أعلاه) في مواقع المتون كلها لا هنا وحده؛ ومتون Claude Code لم تُشحن
                // بعد (القرار 82)، فكل صفحةٍ هنا بلا قطعة تُحكم بقطعةٍ فارغة (القرار 84)
                bodyGuard: BODY_GUARD,
                // CSS الموقع الخاص (button.css وstyle.css: 31 إعلانًا فيزيائيًّا) مضمَّنٌ في المتن بهذه السمة وثابتٌ في الصفحات كلها؛
                // وأوراق المكوّنات التفاعلية في المتن (#content style: settings وprompt-library وcontext-window…) داخلةٌ كذلك.
                // ★ (التحقق النهائي، ١٧ ربيع الآخر ١٤٤٨هـ) كانت خارجها لتثبت البصمة بين الصفحات (مراجعة المحرّك ٢)، فغلبتها قواعد
                // الورقة الحيّة المعاد بثّها بخصوصيةٍ عالية (‎:where(*)‎ من preflight: حشوة المحور وهامشه وحدّه صفرًا، و‎:where(button)‎
                // بلا استدارة): أدوات الصفحات الأربع فقدت حشوتها الأفقية وحدودها الجانبية واستدارة أزرارها (26 من 66 عنصرًا في settings،
                // و87 من 125 في prompt-library — قِيس بالإضافة الحقيقية). والثمن المقبول: بناءٌ في العامل عند التنقّل إلى صفحةٍ منها ومنها
                liveInline: "style[data-custom-css-path], #content style",
                // "/docs" وحده يعرض صفحة overview الإنجليزية (exact: لا بادئة، فلا تعمل /docs/<locale>/ الأخرى)؛
                // وسجلّ الإصدارات هيكلٌ فقط: يُولَّد يوميًّا من CHANGELOG فتعريب متنه تقادمٌ دائم. والبادئة بشرطتها الختامية
                // (routeMode يضيفها للمسار): ‎/docs/en/changelog‎ وما تحته وحده، لا كل صفحةٍ يبدأ اسمها بـ«changelog» (مراجعة المحرّك ٤)
                routes: { exact: ["/docs"], full: ["/docs/en/"], shell: ["/docs/en/changelog/"] },
                // المتن والرأس (العنوان والوصف) وبنود الفهرس — كل كتلة بحسب نصّها؛ ورابط «ما الجديد» (رابطٌ مستقلّ بسهمٍ بعده،
                // فاتجاهه بنصّه لا بسطره المختلط)؛ وأجوبة المساعد (#chat-content): الاتجاه وحده لكل كتلة، ونصُّها لا يُمسّ (skipSel)
                dirSel: "#content, #header, #table-of-contents li, #content .digest-feature-link, #chat-content",
                bodySel: "#content, #header, #table-of-contents",
                // في مسار shell يبقى المتن على أصله LTR (code-point.css ببوابة data-cml-route)
                shellSel: "#content",
                // أجوبة المساعد المولَّدة (خدمة Mintlify) لا تُعرَّب ولا تُحصد؛ إطاره (الحقل والأزرار) خارجها فيُعرَّب
                skipSel: "#chat-content",
                // Inter عائلة واجهةٍ ثانية في Mintlify (وجهان في الإقلاع)، وSerif Display للعناوين
                fontFamilies: { "Anthropic Sans": "ui", "Inter": "ui", "Anthropic Serif": "read", "Anthropic Serif Display": "read",
                                paperMono: "mono" },
                titleSuffix: [" - Claude Code Docs"] } },
    ],

    // ═══ الخط العربي (2.0.0 — DESIGN-fonts §٢ و§٤؛ قرارات المالك ق١–ق٧، ١٨ ربيع الآخر ١٤٤٨هـ) ═══
    // يُرسم به ما في مدى FONT_AR_RANGE وحده، تحت أسماء عائلات الموقع (meta.fontFamilies) بواصفاتها منسوخةً وقت
    // التشغيل؛ فالحروف الإنجليزية والأرقام الغربية والمسافة والأيقونات تبقى برسم الموقع حرفًا (ث١).
    // ★ FONT_DEFAULT والفهرس FONTS من معايرة ٢٠ ربيع الآخر ١٤٤٨هـ («fonts.mjs measure --apply»، بالعلاجين في *-point.css)، لا باليد:
    // اجتازها 3 من الستة فبقيت بترتيب طلباتها في Google Fonts، والافتراضي أكثرها طلبًا بقاعدة ق١؛ وأُسقط Noto Sans Arabic وReadex Pro وMada
    // (أسبابها في fonts.lock.json ‹dropped›). وm وclamp لكل خطٍّ هما calib.m وcalib.clamp في القفل حرفًا، والبوابة («fonts.mjs verify») تفحص تطابقهما.
    // والحقول: sha بادئة sha256 في القفل (تحقّق النسخة المخزَّنة)، وqmarks أن الملف يرسم علامات المصحف (§٢.٢)، وwhy شرح
    // الخيار في الإعدادات (§٣.٢) بلا الجملة الأولى للافتراضي لأنها تُولَّد لـ FONT_DEFAULT، وnote سبب أي تصحيحٍ خاص (ومنه s < 1)
    // وclamp لكل ملف نقطة (app وcode وdocs وintercom): {s, a, d} للوجه المضغوط «cml-ar-compact» داخل عناصر القطع بعدد الأسطر
    // (يُسجَّل من بايتات الخط نفسه بـ size-adjust = s وتجاوزي a وd)، أو null فلا يُسجَّل فتقع العربية هناك على «cml-ar-today» كما اليوم
    FONT_LANG: "ar",          // الفهرس عربيٌّ فقط: لا خط مع لغةٍ غيرها (§٤.٨)
    FONT_DEFAULT: "cairo",  // قاعدة ق١: أكثر الخطوط الناجحة طلبًا
    FONT_SITE: "site",        // «خط الموقع كما هو»: لا تضيف الإضافة خطًّا
    // ق٦ «خط النظام» (القرار 71، ٢٥ ربيع الآخر ١٤٤٨هـ): بلا ملف (fontResolve يحسمه إلى null فلا نسخة يحفظها عامل الخدمة)، وأوجهه
    // FONT_SYS أدناه بمصدر local(). وكان مؤجَّلًا (S6-B): وجهٌ local() واحدٌ داخل واصف الموقع "300 800" يرسم كل وزنٍ عاديًّا (حبر 700 =
    // حبر 400)، وتقسيم المدى يُسقط الإنجليزية (A3). ★ (ر5ب، ٢٩ ربيع الآخر ١٤٤٨هـ) والتنفيذ بقواعد تجربة ر5ب لكل بنية خط (رأس cml-font.js)
    FONT_SYSTEM: "system",
    // ★ (ر5ب) مدخل «خط النظام» لوحدة الخط (local: لا بايتات): لكل نطاق وزنٍ وجهٌ واحد بقائمة local(). وحدود النطاقات ما يختاره ويندوز
    // لـ"Segoe UI" عند كل وزن (مقيسةٌ من 1 إلى 1000 في معايرة ٢٠ ربيع الآخر ١٤٤٨هـ، وهي أوجه «cml-ar-today» في *-point.css): الخفيف حتى 325،
    // ونصف الخفيف حتى 375، والعادي حتى 499، ونصف العريض حتى 649، والعريض فوقه — إلا أن ما فوق 799 هنا Segoe UI Bold لا Times New Roman
    // العريض (Segoe UI Black بلا عربية فكان النظام يقفز إلى خطٍّ مذيَّل)، وأن 500–599 نطاقٌ مستقل: على ويندوز نصف العريض نفسه، وفي غيره
    // الوزن المتوسط إن وُجد وإلا العادي، فلا نطاقَ يجمع ما دون 600 وما فوقه (عتبة العريض المصطنع، وعليها تُبنى مرايا «Fallback»)
    FONT_SYS: { id: "system", local: true, v: "1", bands: [
      { w: [1, 325], names: ["Segoe UI Light", "SegoeUI-Light"].concat(SYS_LIGHT) },
      { w: [326, 375], names: ["Segoe UI Semilight", "SegoeUI-Semilight"].concat(SYS_LIGHT) },
      { w: [376, 499], names: ["Segoe UI", "SegoeUI"].concat(SYS_REG) },
      { w: [500, 599], names: ["Segoe UI Semibold", "SegoeUI-Semibold"].concat(SYS_MEDIUM) },
      { w: [600, 649], names: ["Segoe UI Semibold", "SegoeUI-Semibold"].concat(SYS_SEMI) },
      { w: [650, 1000], names: ["Segoe UI Bold", "SegoeUI-Bold"].concat(SYS_BOLD) },
    ] },
    // ★ (ر5ب) الاسم البرمجي للوجه العريض لخطوط «Fallback» التي تولّدها next/font (adjustFontFallback): وإلا فالاسم بلا مسافاتٍ و«-Bold»
    FONT_FALLBACK_BOLD_PS: { "Arial": "Arial-BoldMT", "Times New Roman": "TimesNewRomanPS-BoldMT" },
    FONT_MONO: true,          // ق٤: العربية داخل الشيفرة بالخط المختار عبر عائلات الموقع الأحادية (false يُسقط دور mono كله)
    // سمةٌ بلا قيمة على <html> تكتبها وحدة الخط ما دام لها وجهٌ مضاف في document.fonts، وتزيلها مع آخر وجه (الإطفاء
    // و«خط الموقع» والخروج من النطاق). عليها وحدها يُعلَّق العلاج النقطي للقصّ في *-point.css (قرار المالك — الخيار ٢،
    // ١٩ ربيع الآخر ١٤٤٨هـ)، فلا يتغيّر شيءٌ في المواقع بلا خطٍّ مضاف. و«fonts.mjs measure» يقرأ العلاج من تلك الملفات بهذا الاسم
    FONT_ATTR: "data-cml-font",
    // مدى Google العربي (واحدٌ للعائلات كلها) منقوصًا منه U+2010-2011 (الشرطتان ترِدان في النص الإنجليزي وأسماء النماذج)؛
    // ويبقى U+200C-200E فلا تنقسم الكلمة العربية بين خطين. والأرقام الغربية والمسافة خارجه أبدًا (§٤.٥)
    FONT_AR_RANGE: "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+204F, U+2E41, " +
      "U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, " +
      "U+1EE00-1EE03, U+1EE05-1EE1F, U+1EE21-1EE22, U+1EE24, U+1EE27, U+1EE29-1EE32, U+1EE34-1EE37, U+1EE39, U+1EE3B, " +
      "U+1EE42, U+1EE47, U+1EE49, U+1EE4B, U+1EE4D-1EE4F, U+1EE51-1EE52, U+1EE54, U+1EE57, U+1EE59, U+1EE5B, U+1EE5D, " +
      "U+1EE5F, U+1EE61-1EE62, U+1EE64, U+1EE67-1EE6A, U+1EE6C-1EE72, U+1EE74-1EE77, U+1EE79-1EE7C, U+1EE7E, " +
      "U+1EE80-1EE89, U+1EE8B-1EE9B, U+1EEA1-1EEA3, U+1EEA5-1EEA9, U+1EEAB-1EEBB, U+1EEF0-1EEF1",
    FONT_MAX_BYTES: 184320,        // 180 KiB سقف ملف woff2 الواحد (§٢.١ الشرط 5)
    FONT_BUDGET_BYTES: 409600,     // 400 KiB سقف مجموع الملفات المحزومة
    FONT_CACHE_MAX_CHARS: 250000,  // سقف نسخة base64 في التخزين (أكبرها اليوم 221,280 حرفًا)
    // سطر المعاينة الواحد لكل الخيارات في صفحة الإعدادات (§٣.٢): العريض يُظهر محور الوزن، والحركات الضبط،
    // و«3» أن الأرقام الغربية تبقى بخط الصفحة. b بالعريض، وt بعده
    // ★ (ر7-ب، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ ر7، L6) والعددُ ومعدودُه بمسافةٍ لا تنكسر (U+00A0): على عرض الهاتف (375) كان سطر «Markazi Text»
    // ينتهي بـ«3» ويبدأ التالي بـ«ملفات»
    FONT_SAMPLE: { b: "محادثة جديدة", t: " · الإعدادات · يُبِينُ الخَطُّ الجَيِّدُ الحَرَكاتِ · 3\u00A0ملفات" },
    FONTS: [
      { id: "cairo", family: "Cairo", file: "fonts/cairo.woff2", bytes: 30896, sha: "748022f50c427456", wght: [200, 1000],
        qmarks: false, why: "هندسيٌّ بلمسةٍ كوفية، واضحٌ في القوائم والأزرار، وأوزانه كاملة.",
        m: { ui: { s: 0.94, a: 1.0559, d: 0.2739 }, read: { s: 0.94, a: 1.0557, d: 0.2738 } },
        clamp: { app: null, code: { s: 0.85, a: 1.1676, d: 0.3029 }, docs: null, intercom: { s: 0.87, a: 1.1408, d: 0.296 } },
        note: "s = 0.94 دون ارتفاع x للهوية (s_x = 1.031): أكبر حجمٍ لا يقصّ فيه أكثر من Segoe UI اليوم عند أي ارتفاع، مع العلاج النقطي في *-point.css (معايرة ٢٠ ربيع الآخر ١٤٤٨هـ)" },
      { id: "noto-naskh-arabic", family: "Noto Naskh Arabic", file: "fonts/noto-naskh-arabic.woff2", bytes: 94032, sha: "2a10d33e1f7129ab", wght: [400, 700],
        qmarks: true, why: "نسخٌ متقنٌ للقراءة الطويلة، تستقرّ فيه الحركات المركّبة كالشدّة مع الفتحة، ويرسم علامات المصحف.",
        m: { ui: { s: 0.93, a: 1.0672, d: 0.2769 }, read: { s: 0.93, a: 1.0671, d: 0.2768 } },
        clamp: { app: null, code: null, docs: null, intercom: { s: 0.86, a: 1.1541, d: 0.2994 } },
        note: "s = 0.93 دون ارتفاع x للهوية (s_x = 1.500): أكبر حجمٍ لا يقصّ فيه أكثر من Segoe UI اليوم عند أي ارتفاع، مع العلاج النقطي في *-point.css (معايرة ٢٠ ربيع الآخر ١٤٤٨هـ)" },
      { id: "markazi-text", family: "Markazi Text", file: "fonts/markazi-text.woff2", bytes: 41320, sha: "5e875d6141dfb250", wght: [400, 700],
        qmarks: false, why: "نسخيُّ الطابع معاصر للنصوص الطويلة، هادئ الإيقاع، أسطره متقاربة.",
        m: { ui: { s: 0.91, a: 1.0907, d: 0.283 }, read: { s: 0.91, a: 1.0905, d: 0.2829 } },
        clamp: { app: null, code: null, docs: null, intercom: null },
        note: "s = 0.91 دون ارتفاع x للهوية (s_x = 1.737): أكبر حجمٍ لا يقصّ فيه أكثر من Segoe UI اليوم عند أي ارتفاع، مع العلاج النقطي في *-point.css (معايرة ٢٠ ربيع الآخر ١٤٤٨هـ)" },
    ],
  };
  // مفتاح تخزين نطاقٍ من اسمه الأساس: التطبيق على مفتاحه القديم، والبقية بلاحقة «.<id>»
  C.key = function (base, d) { return !d || d === "app" ? base : base + "." + d; };
  // الخط المحسوم لقيمة cml_font (DESIGN-fonts §٤.٢): مدخلُ الفهرس نفسه، أو null حين لا ملفَّ يُحفظ.
  // "site" و"system" (بلا ملف) ← null؛ والغياب وكل قيمةٍ مجهولة ← الافتراضي؛ وقبل أن يُكتب الفهرس ← null (لا خط).
  // و«خط النظام» يأخذ مدخله FONT_SYS من المحرّك مباشرةً لا من هنا (لا نسخة يكتبها عامل الخدمة ولا يحذفها إلا هذا الحسم)
  C.fontResolve = function (v) {
    if (v === C.FONT_SITE || (C.FONT_SYSTEM && v === C.FONT_SYSTEM)) return null;
    var list = C.FONTS || [];
    function find(id) {
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
      return null;
    }
    return (typeof v === "string" && find(v)) || (C.FONT_DEFAULT ? find(C.FONT_DEFAULT) : null);
  };
  // ★ (ر5ب) نصّ مصدر local() لوجه «خط النظام» عند وزنٍ ما (نطاقه من FONT_SYS)، أو لقائمة أسماءٍ صريحة؛ و"" حين لا مدخل
  function localSrc(names) {
    return (names || []).map(function (n) { return 'local("' + String(n).replace(/["\\]/g, "") + '")'; }).join(", ");
  }
  C.fontSysBand = function (w) {
    var b = (C.FONT_SYS && C.FONT_SYS.bands) || [], n = +w;
    for (var i = 0; i < b.length; i++) if (n >= b[i].w[0] && n <= b[i].w[1]) return b[i];
    return null;
  };
  C.fontSysSrc = function (w) { var b = C.fontSysBand(w); return b ? localSrc(b.names) : ""; };
  // ★ (ر5ب) مصدر المرآة اللاتينية لرفيقة «Fallback» من next/font: الوجه العادي باسمه كما في الموقع حرفًا (local(Arial))، والعريض
  // بنظيره العريض (الاسم الكامل ثم البرمجي) — فالإنجليزي في مجموعات الوزن التي نضيفها هو خط الرفيقة نفسه
  C.fontFallbackSrc = function (name, bold) {
    var n = String(name || "");
    if (!n) return "";
    if (!bold) return localSrc([n]);
    var ps = (C.FONT_FALLBACK_BOLD_PS || {})[n] || n.replace(/\s+/g, "") + "-Bold";
    return localSrc([n + " Bold", ps]);
  };
  // المفاتيح الفعلية لأصنافٍ من KEY_CLASSES، موسَّعةً على النطاقات من الجدول فلا تنحرف عنه
  C.keysOf = function (classes) {
    var out = [];
    for (var i = 0; i < C.KEY_CLASSES.length; i++) {
      var e = C.KEY_CLASSES[i];
      if (classes.indexOf(e.c) < 0) continue;
      if (!e.per) { out.push(e.k); continue; }
      for (var j = 0; j < C.DOMAINS.length; j++) {
        var d = C.DOMAINS[j].id;
        out.push(e.per === "site" ? e.k + "." + d : C.key(e.k, d));
      }
    }
    return out;
  };
  // صنفُ مفتاحٍ فعلي (بلاحقة نطاقه أو بدونها)، وnull لما لا يعرفه الجدول
  C.classOf = function (key) {
    var k = String(key || ""), dot = k.indexOf("."), base = dot < 0 ? k : k.slice(0, dot);
    var suf = dot < 0 ? null : k.slice(dot + 1);
    if (suf !== null && !C.domain(suf)) return null;
    for (var i = 0; i < C.KEY_CLASSES.length; i++) {
      var e = C.KEY_CLASSES[i];
      if (e.k !== base) continue;
      if (suf === null) return e.per === "site" ? null : e.c;
      return e.per ? e.c : null;
    }
    return null;
  };
  // «إعادة الضبط»: الأصناف كلها إلا المحفوظ عمدًا والبقايا — مفاتيح كل النطاقات
  C.RESET_KEYS = C.keysOf(C.RESET_CLASSES);
  C.UNUSED_KEYS = C.keysOf(["legacy"]);
  C.domain = function (id) {
    for (var i = 0; i < C.DOMAINS.length; i++) if (C.DOMAINS[i].id === id) return C.DOMAINS[i];
    return null;
  };
  // نطاقُ عنوانٍ ما (أو null): المضيف أولًا ثم بادئة المسار كما في matches
  C.domainOfUrl = function (url) {
    var u;
    try { u = new URL(url); } catch (e) { return null; }
    if (u.protocol !== "https:") return null;
    for (var i = 0; i < C.DOMAINS.length; i++) {
      var d = C.DOMAINS[i];
      for (var j = 0; j < d.matches.length; j++) {
        var m = /^https:\/\/(\*\.)?([^\/]+)(\/.*)$/.exec(d.matches[j]);
        if (!m) continue;
        var hostOk = m[1] ? (u.hostname === m[2] || u.hostname.slice(-(m[2].length + 1)) === "." + m[2]) : u.hostname === m[2];
        var pathPrefix = m[3].replace(/\*$/, "");
        if (hostOk && u.pathname.indexOf(pathPrefix) === 0) return d;
      }
    }
    return null;
  };

  // ═══ مصفوفة القدرات (صفحة الخيارات والنافذة والاختبارات) ═══════════════════════════
  // ما يملكه كل موقعٍ من ميزات الصفحة مشتقًّا من meta، ومع كل ميزةٍ غائبة **نصُّ سببها** —
  // فالصفحة لا تُخفي قسمًا بل تعطّله بسببٍ مكتوب، والسبب يُكتب هنا مرةً واحدة. وإضافةُ موقعٍ
  // جديد صفٌّ في DOMAINS لا تعديلٌ في الصفحة.
  function pathOf(match) { var m = /^https:\/\/[^\/]+(\/.*)$/.exec(match || ""); return m ? m[1].replace(/\*$/, "") : "/"; }
  function listNames(pred) {
    var n = [];
    for (var i = 0; i < C.DOMAINS.length; i++) if (pred(C.DOMAINS[i].meta || {})) n.push("«" + C.DOMAINS[i].name + "»");
    return { text: n.join(" و"), n: n.length };
  }
  // عنوانٌ قصير للموقع: المضيف وبادئة مساره بلا مقطع اللغة (platform.claude.com/docs، support.claude.com)
  C.siteLabel = function (id) {
    var d = C.domain(id);
    if (!d) return "";
    // ★ (ر4) عنوانٌ صريح في الجدول (meta.siteLabel) يسبق المشتقّ: بادئات الأكاديمية الثماني عشرة لا تختصرها أولاها («/all/»)
    if (d.meta && typeof d.meta.siteLabel === "string" && d.meta.siteLabel) return d.meta.siteLabel;
    var r = d.meta && d.meta.routes, p = (r && r.full && r.full[0]) || pathOf(d.matches[0]);
    return d.host + p.replace(/\/en\/?$/, "").replace(/\/+$/, "");
  };
  C.caps = function (id) {
    var d = C.domain(id);
    if (!d) return null;
    var m = d.meta || {}, nm = "«" + d.name + "»";
    var kind = m.scan === "app" || m.scan === "llms" ? m.scan : "none";
    var chat = listNames(function (x) { return !!x.chat; });
    var doc = listNames(function (x) { return x.scan === "app"; });
    var bod = listNames(function (x) { return !!x.bodies; });
    // نطاق المسارات: حارس المسار إن وُجد، وإلا بادئات المطابقة
    // ★ (ر8-د، ١ جمادى الأولى ١٤٤٨هـ — N3) والجملة مقاطعُ أيضًا (whereSeg: {t} نصٌّ و{p} مسار): المسار بين العربية بلا عزلٍ يُرسم معكوس
    // الشرطة («legal/privacy/» بدل «/legal/privacy»)، فالصفحة تعزل كل مسارٍ في <bdi dir="ltr"> وفواصلُه العربية خارجه. وwhere نصُّها
    // مجموعًا كما كان حرفًا بحرف
    var seg = [];
    var T = function (s) { seg.push({ t: s }); }, P = function (s) { seg.push({ p: s }); };
    if (m.routes) {
      // المسارات الكاملة بالمساواة (exact: ‎/docs‎ وحده) ثم بالبادئة
      T("يعمل في ");
      (m.routes.exact || []).map(function (p) { return [p, " بعينه"]; }).concat((m.routes.full || []).map(function (p) { return [p, ""]; }))
        .forEach(function (x, i) { if (i) T("، "); P(x[0]); if (x[1]) T(x[1]); });
      T(" كاملًا");
      if ((m.routes.shell || []).length) {
        T("، وفي ");
        m.routes.shell.forEach(function (p, i) { if (i) T("، "); P(p); });
        T(" هيكلُ الصفحة وحده");
      }
      T("، ولا يمسّ سائر صفحات المضيف");
    } else {
      var ps = d.matches.map(pathOf);
      if (ps.indexOf("/") >= 0) T("يعمل في صفحات الموقع كلها");
      else { T("يعمل في صفحات المسار "); ps.forEach(function (p, i) { if (i) T(" و"); P(p); }); T(" وحدها"); }
    }
    var where = seg.map(function (s) { return s.p !== undefined ? s.p : s.t; }).join("");
    return {
      id: id, name: d.name, host: d.host, label: C.siteLabel(id), where: where, whereSeg: seg,
      // ★ (ر8-د — N4) تسمية الفحص بما يُفحص لا بمصدره: نصوص الواجهة كلها (حزم التطبيق)، أو عناوين الصفحات وحدها (فهرس llms.txt)،
      // أو لا فحص في المتصفح فتُحدَّث الترجمة عند كل إصدار (قرار المالك: لا جلب لخريطة الموقع)
      scan: { on: kind !== "none", kind: kind,
        label: kind === "app" ? "نصوص الواجهة كلها" : kind === "llms" ? "عناوين الصفحات" : "عند كل إصدار",
        why: kind !== "none" ? "" : m.bodies
          ? "لا فحص لـ" + nm + " في المتصفح: صفحاته تُحصد وتُترجم وقت إصدار الإضافة، وليس فيه ملفات واجهةٍ يقرؤها الفحص."
          : "لا فحص لـ" + nm + " في المتصفح: قاموسه يُبنى ويُحدَّث مع كل إصدارٍ للإضافة." },
      rtlDoc: { on: kind === "app", why: kind === "app" ? "" :
        "فحص الاتجاه يحتاج بيانات تغطية الاتجاه للموقع، وهي متاحة الآن لـ" + (doc.text || "لا موقع") + (doc.n > 1 ? " وحدها." : " وحده.") },
      live: { on: !!m.live, why: m.live ? "" :
        "اتجاه " + nm + " من لقطةٍ مشحونة مع الإضافة تُحدَّث مع كل إصدار، لا من ملفات الموقع الحيّة؛ فلا ورقة حيّة يُعاد ضبطها." },
      chat: { on: !!m.chat, why: m.chat ? "" : "لا محادثات في " + nm + "؛ هذا الخيار يخصّ " + (chat.text || "التطبيق") + "." },
      bodies: { on: !!m.bodies, why: m.bodies ? "" : "لا مقالات في " + nm + "؛ تصحيحات الفقرات تخصّ " + (bod.text || "مواقع المقالات") + "." },
    };
  };
  // مفاتيح موقعٍ واحد المحلية («إعادة ضبط هذا الموقع»): كل مفتاحٍ لكل نطاقٍ من أصناف إعادة الضبط —
  // تشغيله ومحرّكه وتصحيحاته وقواعده وفقراته ونتائج فحصه وورقته ودفاتر مزامنته — ولا شيء عامّ
  C.keysOfDomain = function (id) {
    if (!C.domain(id)) return [];
    var out = [];
    for (var i = 0; i < C.KEY_CLASSES.length; i++) {
      var e = C.KEY_CLASSES[i];
      if (!e.per || C.RESET_CLASSES.indexOf(e.c) < 0) continue;
      out.push(e.per === "site" ? e.k + "." + id : C.key(e.k, id));
    }
    return out;
  };
  g.CMLConst = C;
})(typeof globalThis !== "undefined" ? globalThis : this);
