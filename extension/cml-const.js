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
  // ★ (ر29-د2، ١٤ جمادى الأولى ١٤٤٨هـ — مراجعة ر29-د F4) حاوية المتن الرئيسة (meta.bodyMain): الجزء الذي فيه نصّ المقالة من المحدِّد المركّب
  var INTERCOM_BODYMAIN = ".article_body";
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
  // (٢٠ ربيع الآخر ١٤٤٨هـ، _app-gap-20261002/cache):
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
  // ★ (ر24-ج2، ١٠ جمادى الأولى ١٤٤٨هـ — ما حملته ر24-ج1) مواضع الكتابة: ما يكتبه المستخدم محتوى مستخدمٍ بالمحدِّد أيًّا كانت قابلية تحريره (CLAUDE.md §5:
  // الحماية باستثناء المحادثات ومحتوى المستخدم بالمحدِّدات). كانت قابلية التحرير وحدها تحميه، فمحرِّرٌ صار ‎contenteditable="false"‎ وفيه مسودةٌ تطابق
  // القاموس كانت تُقرأ وتُعرَّب. الجرد (عيّنة فحص الاتجاه العامة، 57 صفحة في النطاقات السبعة المشحونة، أعدادٌ لا نص): لا محرِّر نصٍّ غنيّ في أي صفحةٍ عامة
  // (0 لكلٍّ من ‎[role=textbox]‎ و‎[role=searchbox]‎ و‎.ProseMirror‎ و‎[contenteditable=true]‎)، وحقول البحث وأسئلة المساعد فيها ‎<input>‎ (43) و‎<textarea>‎ (39) لا
  // عقدة نصٍّ فيها؛ ومحادثة «اسأل Claude» في الأكاديمية (‎[data-ask-view]‎) وأجوبة مساعد Claude Code (‎#chat-content‎) محتوى مستخدمٍ من قبل. ومحرِّر
  // claude.ai (صندوق الكتابة، وClaude Code على الويب) خلف الدخول: ProseMirror (‎tiptap‎) بشهادة أوراق الموقع (‎.ProseMirror‎ في 54 قاعدة، ومنها
  // ‎.ProseMirror>p>code‎ و‎p.is-editor-empty:first-child‎: المحتوى فقراتٌ أبناءٌ مباشرون للجذر). فالمحدِّدات:
  //   ‎.ProseMirror > *‎: كتل المحتوى تحت جذر المحرِّر — الصنف ثابتٌ تضعه المكتبة نفسها على الجذر في كل حال (‎contenteditable="false"‎ حين لا يُحرَّر)، لا
  //     صنفُ تنسيقٍ مولَّد. وجذرُه نفسه خارجها: سماته (‎aria-label‎ وأمثالها) واجهةٌ تُعرَّب كما كانت؛
  //   ‎[role=textbox]:not(.ProseMirror)‎ و‎[role=searchbox]:not(.ProseMirror)‎: دورا ARIA للحقل الذي يكتب فيه المستخدم (وحقل البحث منه) في غير عناصر
  //     الإدخال — أيُّ محرِّرٍ يعلن دوره، في كل نطاق.
  // ولا يُحمى ‎contenteditable="false"‎ عامّةً: في عيّنة Claude Code ‏1,209 عنصرًا منه خارج أي محرِّر، في 1,172 منها نصُّ الموقع (كانت ستبقى إنجليزية).
  // وclaude.com قادمٌ خامل: جدوله على حاله
  var EDITOR_USER = ".ProseMirror > *, [role=textbox]:not(.ProseMirror), [role=searchbox]:not(.ProseMirror)";
  // ★ (ر3، ٢٨ ربيع الآخر ١٤٤٨هـ) الوثائق القانونية الخمس في www.anthropic.com/legal (Next.js 16 وSanity — دراسة ر3).
  // غلاف الموقع إنجليزيٌّ عند الشركة فيبقى كما هو: الترويسة والتذييل وقائمة الجوال والقوائم المنسدلة ولافتة الموافقة،
  // ومنتقي لغة الوثيقة (أسماء لغات). لا تُعرَّب ولا تُحصد، وتبقى LTR بقاعدةٍ في legal-point.css
  // ★ (ر29-ج، ١٣ جمادى الأولى ١٤٤٨هـ — ر29-أ F1) أعاد الموقع بناء صفحاته القانونية بين 2026-10-16 و2026-10-23 فماتت المحدِّدات كلها
  // (LegalPageDetail وSiteHeader وSiteFooter وSiteMobileNav لا أثر لها في أوراقه). فالغلاف الجديد مقيسًا على الخمس بعرضي 1366 و390:
  //   الترويسة ‎header.HeaderLayout‎ (وفيها SiteHeaderShell وNavItems ومشغّلات NavDropdown والبحث)، ورابط التخطّي SkipLink (ابنٌ مباشر
  //   لـ<body> خارج الترويسة)، والتذييل ‎footer.Footer‎، وقائمة الجوال SiteMenuDialog (نافذةٌ تُلحق بـ<body> عند فتحها، 390)، وقوائم
  //   الترويسة المنسدلة NavDropdown (مشغّلها في الترويسة ونافذتها ملحقةٌ بـ<body>)، ولافتة الموافقة ConsentBanner (وحدتها باقيةٌ في أوراق
  //   الموقع وإن لم تظهر لزائر السحابة: تظهر بحسب البلد)، ومنتقي لغة الوثيقة Select (المشغّل في رأس الوثيقة وقائمته ملحقةٌ بـ<body>)
  // ★ (ر29-ح، ١٩ جمادى الأولى ١٤٤٨هـ — DX0-0 §٥) غيّر الموقع صيغة أصناف CSS Modules: من ‎<الوحدة>-module-scss-module__<بصمة>__<اسم>‎ إلى
  // ‎<بصمة>_<اسم>‎ (وبادئة ‎_‎ إن بدأت البصمة برقم)، فذهب اسم الوحدة من الصفحة كلها ومات كل محدِّدٍ بُني عليه. والبصمة واسم الصنف كما كانا
  // (البصمات الإحدى عشرة في لقطة ١٣ جمادى الأولى ١٤٤٨هـ بالصيغة الطويلة هي هي اليوم). فالمحدِّدات الآن لا اسم وحدةٍ فيها ولا بصمة: اسم الصنف
  // بعد ‎_‎ (يطابق الصيغتين: ‎__Content‎ فيها ‎_Content‎) مع موضعه في البنية، أو سمةٌ أو دورٌ يعلنه الموقع. مقيسةً على الخمس بعرضي 1366
  // و390 مغلقةً ومع كل نافذة: الترويسة (‎body > header‎، وعليها data-site-nav) 1، ورابط التخطّي (‎data-skip-link‎، ابنٌ مباشر لـ<body>
  // رابطُه ‎#main-content‎) 1، والتذييل (‎body > footer‎) 1؛ والنوافذ تُلحق بـ<body> في بوّابات Base UI: قائمة الجوال حوارٌ فيه ‎<nav>‎ الموقع
  // (1 مفتوحةً بعرض 390)، والقوائم المنسدلة ‎[role=menu]‎ (1 مفتوحةً بعرض 1366)، وقائمة منتقي اللغة ‎[role=listbox]‎ (1 مفتوحةً)، والمنتقي
  // نفسه زرّ ‎_LanguageSelect‎ في رأس الوثيقة (1). وحوار سجل الإصدارات ليس منها (حوارٌ بلا ‎<nav>‎: 0) فيبقى يُعرَّب كما كان. ولافتة الموافقة
  // لا تظهر لزائر السحابة، واسم صنفها في أوراق الموقع ‎_consentBanner‎ (اللقطة)
  var LEGAL_CHROME = "body > header, header[data-site-nav], a[data-skip-link], body > a[href^='#'], body > footer, " +
    "[role=dialog]:has(nav), [role=menu], [class*='_consentBanner'], [class*='_LanguageSelect'], [role=listbox]";
  // متن الوثيقة: أسماء CSS Modules باسم الوحدة واسم الصنف، فالجزء المجزَّأ (rSIXoW) يتغيّر مع كل تعديلٍ للوحدة.
  // ★ (ر29-ج) غلاف المتن الجديد ‎LegalArticlePage__Content‎ (واحدٌ في كل وثيقة، وفيه ArticleContent ثم Body): خارجه رأس الوثيقة
  // LegalArticleHero (العنوان والشارة وبيانات الوثيقة وزرّ الإصدارات ومنتقي اللغة وفهرس الأقسام) وشريط الأقسام اللاصق — نصوص واجهةٍ
  // يعرّبها قاموس الواجهة (العنوان وسطر السريان)، وما ليس فيه منها لـت11
  // ★ (ر29-ح) بالصيغة الجديدة: غلاف المتن ابنٌ مباشر للمقالة ‎article[_Article]‎ وصنفه ‎_Content‎ (1 في العشرة)، ورأس الوثيقة ‎header‎ وشريط
  // الأقسام ‎_Bar‎ أخواه. واسم الصنف بلا بصمةٍ ولا اسم وحدة، فيطابق الصيغتين
  var LEGAL_BODY = "article[class*='_Article'] > [class*='_Content']";
  // ★ (ر29-ج) بنود بيانات رأس الوثيقة، وفهرس أقسامه، وشريط الأقسام اللاصق: نصوص واجهةٍ خارج المتن (الفهرس عناوين المتن تكتبها الشركة خارجه،
  // فهي مفاتيح واجهةٍ لا كتل)، وما بقي منها إنجليزيًّا (حتى ت11) يُحسم اتجاهه بنصّه كالمتن (dirSel) فلا يُعرض إنجليزيٌّ من اليمين، والمعرَّب منها
  // (سطر السريان) RTL. والبند لا قائمته: الحاوية تُحسم بأغلب نصّها، وقائمة البيانات مختلطةٌ فكانت تنقلب كلُّها LTR فيُعكس ترتيب صفّها.
  // مقيسًا: 3–4 بنودٍ إنجليزية قصيرة في بيانات الرأس كانت تُحسم RTL في كل وثيقة
  // ★ (ر29-ح) بالصيغة الجديدة: بنود البيانات ‎_Metadata‎ داخل رأس الوثيقة (4–5)، والفهرس ‎_TableOfContents‎ فيه (3 متداخلة: الحاوية والقائمة
  // ونسختها للحاسوب)، والشريط ‎_Bar‎ ابن المقالة (1)
  var LEGAL_HERO = "article[class*='_Article'] > header [class*='_Metadata'], article[class*='_Article'] > header [class*='_TableOfContents'], " +
    "article[class*='_Article'] > [class*='_Bar']";
  // ★ (ر4، ٢٨ ربيع الآخر ١٤٤٨هـ) الأكاديمية (academy.claude.com — Vite وReact مع تصييرٍ مسبق — دراسة ر4): ما يبقى إنجليزيًّا في 2.0.0
  // ولا يُعرَّب ولا يُحصد: المتون (الدروس والدورات والشروح وحالات الاستخدام، ومنها أفلام حالات الاستخدام وتمارينها) — القرار 69،
  // وتُعرَّب في 3.0.0؛ وقائمة «في هذه الصفحة» (عناوين المتن)؛ ولافتة الإعلانات (إنجليزيةٌ عند الشركة في كل عرضٍ مترجَم)؛ وقيمة
  // منتقي اللغة وخياراته (أسماء لغات)؛ ومحادثة «اسأل Claude» (سؤال القارئ وجواب Claude — كمتن المحادثة في التطبيق). ولا محدِّد
  // بسمة aria-label: تعريبُنا للسمة كان سيُسقطه
  // ★ (المراجعة المستقلة لـر4-أ، ٢٨ ربيع الآخر ١٤٤٨هـ) نشرُ الموقع في اليوم نفسه بدّل منتقي اللغة: زرٌّ في التذييل يفتح حوارًا
  // (‎button[aria-haspopup=dialog]‎ وقيمته ‎span[lang=en]‎) وخياراته أزرار ‎[role=radio][lang]‎ — فلا يطابق المحدِّدان الأولان شيئًا، وكانت
  // «English» تُحصد في كل صفحة. والعنصر الذي يعلن لغته بسمة lang (اسمُ لغةٍ أو نصٌّ بلغته) ليس نصَّ واجهةٍ إنجليزيًّا: يُستثنى كلّه
  // (‎body [lang]‎: لا <html> الذي نكتب فيه ar)؛ وقِيس أن لا عنصر بسمة lang خارج المتن غيرُ المنتقي وخياراته. والأولان باقيان إن عاد المكوّن
  // ★ (ر13، ٥ جمادى الأولى ١٤٤٨هـ — دراسة ر13-أ) المتون في 3.0.0 بوضع الكتلة (ACADEMY_BODY أدناه، meta.bodySel): خرج المتن وقائمة «في هذه الصفحة»
  // من هذه القائمة، فتُعرَّب كتلهما من قطعة الصفحة ويحصدهما حاصد الكتل، وما سواهما هنا كما كان. و‎body [lang]‎ ضُيِّق إلى ما خارج المتن: ملخّصُ
  // الأداة لقارئ الشاشة داخل المتن (‎p.sr-only[data-widget-summary][lang=en]‎) تترجمه الشركة في صفحاتها المعرَّبة (عيّنة ر13-أ)، فهو متنٌ لا اسم
  // لغة؛ وخارج المتن لا عنصرَ بسمة lang غيرُ قيمة المنتقي وخياراته (قِيس في ر4-أ ثم في ر13-أ). و‎:not()‎ بمحدِّدٍ مركّب في كروم 88 فما بعده
  // ★ (ر13) جذور المتن: المقالة (‎article.mdx-article‎: الدروس والدورات والشروح وحالات الاستخدام بأفلامها وتمارينها)، وقائمة «في هذه الصفحة»
  // في الشريط الجانبي (عناوين المتن، روابط إلى ‎#…‎؛ في المستند بكل عرضٍ ولو خفيت دون xl، فيعدّها الحارس في العرضين كما في الوثائق). تُحكم
  // القائمة مع المتن وتُعرَّب معه، فتبقى في الصفحة المحجوبة إنجليزيةً كعناوينه ولا يكتب فيها قاموس الواجهة. وقِيس في ر13-أ: هي وحدها
  // ‎ul:has(> li > a[href^='#'])‎ في الصفحة، ولا مثلها داخل المقالة
  var ACADEMY_TOC = "main nav ul:has(> li > a[href^='#'])";
  var ACADEMY_BODY = "article.mdx-article, " + ACADEMY_TOC;
  // ★ (ر24-ج1، ١٠ جمادى الأولى ١٤٤٨هـ) صنفا المستثنى (meta.keepSel أدناه): ما تبقيه الشركة إنجليزيًّا من نصّ الموقع — لافتة الإعلانات، وقيمة
  // المنتقي، وأسماء اللغات في خياراته — وما سواه محتوى مستخدمٍ احتياطًا: محادثة «اسأل Claude»، والعنصر المعلِن لغته خارج المقالة (لا يُثبت
  // أنه نصُّ الشركة في كل حال). والسلسلة المجموعة ACADEMY_SKIP هي هي حرفًا بحرف
  var ACADEMY_KEEP = "[data-testid^='notification-banner'], footer [role=combobox] > span:first-child, [role=option] [lang]";
  var ACADEMY_USER = "body [lang]:not(article.mdx-article [lang]), [data-ask-view]";
  var ACADEMY_SKIP = ACADEMY_KEEP + ", " + ACADEMY_USER;
  // اتجاه كل كتلةٍ بنصّها حيث يبقى إنجليزيٌّ في 2.0.0 (المتن، والملخصات والأهداف ووصف الأقسام وبيانات الندوات خارجه): الفقرات
  // والبنود وحدها لا حاويات التخطيط — حاويةٌ أغلبُ نصّها إنجليزي كانت ستقلب تخطيطها كلّه إلى اليسار. ومحادثة «اسأل Claude» (خارج
  // main): الاتجاه وحده لكل كتلة ونصُّها لا يُمسّ (skipSel)، كأجوبة المساعد في وثائق Claude Code (‎#chat-content‎)
  // ★ (المراجعة المستقلة لـر4-أ، ٢٨ ربيع الآخر ١٤٤٨هـ) والبند الذي ابنُه المباشر رابطٌ صفُّ تخطيطٍ لا بندُ نص (صفوف مراكز المنتجات وصفحات
  // الإعداد: ‎li > a.grid‎ بعنوانٍ ووسومٍ في خلايا): كان يُحسم بعنوانه الإنجليزي حين يبقى (اسم منتجٍ أو عنوانٌ جديد لم يُترجم) فيرث وسمُه
  // المعرَّب LTR — فحص الاتجاه بقاموسٍ تجريبي للعناوين والوسوم وحدها (والجمل إنجليزية كما في 2.0.0): نصٌّ عربي محسوب LTR ×4 في
  // ‎/products/claude‎. فالاتجاه لخلايا الصف (‎li > a > span‎) لا للصف، والبنود النصية (الأهداف: شارةٌ ثم جملة) كما كانت
  // ★ (ر13، ٥ جمادى الأولى ١٤٤٨هـ) وبنود «في هذه الصفحة» بنصّها كذلك (ابنُها المباشر رابطٌ فلم يطابقها ما قبلها): تتبع المتن — إنجليزيةً LTR في
  // الصفحة المحجوبة وفي جزيرة academy-point.css، ومعرَّبةً RTL حين يُكتب المتن (data-cml-body="tr")
  var ACADEMY_DIR = "article.mdx-article, main :is(p, figcaption, dd), main li:not(:has(> a)), main li > a > span, " +
    ACADEMY_TOC + " > li, [data-ask-view]";
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
  // ★ (ر13، ٥ جمادى الأولى ١٤٤٨هـ) والأكاديمية سادستها منذ صار لها متون (القرار 83: «لكل مواقع المتون»)
  var BODY_GUARD = 0.05;
  // ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) claude.com (Next.js مع Sanity — دراسة ر14 §٧أ ومراجعتها). لافتة الموافقة نصٌّ قانوني تبقيه الشركة إنجليزيًّا
  // في عروضها المترجمة، ومنتقي اللغة يسمّي اللغات بأسمائها (قرار دراسة 2.0.0): لا يُعرَّبان ولا يُحصدان
  var COM_SKIP = "[class*='ConsentContainer-module'], [class*='LocalePicker-module']";
  // اتجاه كل كتلةٍ بنصّها في النص الغني (المقالات والقصص والإضافات والأدلة): ما يبقى إنجليزيًّا منها LTR داخل تخطيطٍ من اليمين
  var COM_DIR = ".text-rich-text, .w-richtext";
  // الصفحات التي تترجم الشركة إطارها دون متنها (السؤال 17، وافتراضه «هيكلٌ فقط»): قصص العملاء والمقالات غير المترجمة، والأدلة والندوات
  // وسلاسلها، ونماذج التواصل والاستمارات، والحلول غير المترجمة، وصفحة إدارة الرعاية الصحية — نسختها ‎/<locale>/…‎ تُرجع 200 بترويسةٍ وتذييلٍ
  // مترجمَين ومتنٍ إنجليزي (دراسة ر14 §٢هـ). والمترجَم منها بعينه في COM_EXACT فيسبقها (routeMode: exact ثم shell ثم full)
  var COM_SHELL = ["/customers/", "/resources/", "/contact-sales/", "/form/", "/solutions/", "/healthcare-administration/"];
  // ═══ <com-routes> مولَّدٌ بـ«node web/code/toolchain/com-routes.mjs --write» من خريطة claude.com وروابط hreflang — لا يُعدَّل باليد ═══
  // مساراتُ الصفحات التي تترجمها الشركة بأعيانها (حارس المسار exact لنطاق com)، وأعدادها: الخريطة كلها، والإنجليزية، والمترجمة فيها،
  // وما دخل من الخريطة، وما دخل من روابط hreflang وحدها، وعتبة اللغات (السؤال 15)، ويوم آخر تغيّرٍ في القائمة
  var COM_EXACT = [
    "/",
    "/claude-for-google-workspace",
    "/claude-for-microsoft-365",
    "/claude-in-chrome",
    "/community",
    "/community/ambassadors",
    "/contact-sales",
    "/contact-sales/education-plan",
    "/contact-sales/financial-services",
    "/contact-sales/followup",
    "/contact-sales/healthcare",
    "/contact-sales/life-sciences",
    "/contact-sales/nonprofits",
    "/contact-sales/priority-tier",
    "/contact-sales/security",
    "/contact-sales/vc-partner",
    "/customers",
    "/customers/adalat-ai",
    "/customers/advolve",
    "/customers/aes",
    "/customers/alexa-plus",
    "/customers/amazon-q-in-connect",
    "/customers/amira",
    "/customers/apollo",
    "/customers/appfolio",
    "/customers/armanino",
    "/customers/asana",
    "/customers/asana-qa",
    "/customers/asapp",
    "/customers/assembled",
    "/customers/athena",
    "/customers/attention",
    "/customers/audience-strategies",
    "/customers/augment-code",
    "/customers/aura",
    "/customers/banner-health",
    "/customers/base44",
    "/customers/benchling",
    "/customers/binti",
    "/customers/biomni",
    "/customers/bito",
    "/customers/block",
    "/customers/blueflame",
    "/customers/bluenote",
    "/customers/bolt",
    "/customers/braintrust",
    "/customers/brand-ai",
    "/customers/brex",
    "/customers/brian-impact-foundation",
    "/customers/bunq",
    "/customers/campfire",
    "/customers/canva",
    "/customers/carta-healthcare",
    "/customers/charm-industrial",
    "/customers/chatandbuild",
    "/customers/chatbase",
    "/customers/chronograph",
    "/customers/circleback",
    "/customers/circleci",
    "/customers/classdojo",
    "/customers/classmethod",
    "/customers/clay",
    "/customers/coderabbit",
    "/customers/codewords",
    "/customers/cogent",
    "/customers/coinbase",
    "/customers/copy-ai",
    "/customers/cove",
    "/customers/cox-automotive",
    "/customers/cred",
    "/customers/crunched",
    "/customers/cubic",
    "/customers/decagon",
    "/customers/delightai-qa",
    "/customers/descript",
    "/customers/doctolib",
    "/customers/dolly",
    "/customers/dust",
    "/customers/elation-health",
    "/customers/emergent",
    "/customers/epic-systems",
    "/customers/esentire",
    "/customers/factory",
    "/customers/figma",
    "/customers/fountain",
    "/customers/freedom-forever",
    "/customers/futurehouse",
    "/customers/gambit",
    "/customers/gamma",
    "/customers/genspark",
    "/customers/gitlab",
    "/customers/gitlab-enterprise",
    "/customers/grab",
    "/customers/gradient-labs",
    "/customers/grafana",
    "/customers/graph",
    "/customers/graphite",
    "/customers/greptile",
    "/customers/gumroad",
    "/customers/harvey",
    "/customers/headstart",
    "/customers/hebbia",
    "/customers/hostinger",
    "/customers/hubspot",
    "/customers/hubspot-qa",
    "/customers/humach",
    "/customers/hume",
    "/customers/ifs",
    "/customers/ig-group",
    "/customers/inscribe",
    "/customers/intercom",
    "/customers/intuit",
    "/customers/jetbrains",
    "/customers/jetbrains-2",
    "/customers/jumpcut",
    "/customers/kodif",
    "/customers/law-and-company",
    "/customers/lazy-ai",
    "/customers/legora",
    "/customers/lex",
    "/customers/lindy",
    "/customers/lokalise",
    "/customers/loreal",
    "/customers/lotte-homeshopping",
    "/customers/lyft",
    "/customers/magicschool",
    "/customers/matillion",
    "/customers/medgate",
    "/customers/micro1",
    "/customers/mintlify",
    "/customers/money-forward",
    "/customers/n26",
    "/customers/n8n",
    "/customers/nbim",
    "/customers/nevis",
    "/customers/newfront",
    "/customers/notion",
    "/customers/notion-qa",
    "/customers/novo-nordisk",
    "/customers/nri",
    "/customers/orange",
    "/customers/otter",
    "/customers/palo-alto-networks",
    "/customers/panorama",
    "/customers/panther",
    "/customers/parcha",
    "/customers/pelanor",
    "/customers/pensive",
    "/customers/perplexity",
    "/customers/pjmf",
    "/customers/postman",
    "/customers/pratham-international",
    "/customers/praxis",
    "/customers/pulpit-ai",
    "/customers/qodo",
    "/customers/qualified-health",
    "/customers/quantium",
    "/customers/quillit",
    "/customers/rakuten",
    "/customers/rakuten-qa",
    "/customers/ramp",
    "/customers/replit",
    "/customers/rileybot",
    "/customers/rising-academies",
    "/customers/rocket",
    "/customers/scribd",
    "/customers/section",
    "/customers/semgrep",
    "/customers/sentry",
    "/customers/sett",
    "/customers/shopify",
    "/customers/shortcut",
    "/customers/skillfully",
    "/customers/skt",
    "/customers/slack",
    "/customers/snowflake",
    "/customers/solvely",
    "/customers/sourcegraph",
    "/customers/sourcegraph-claude-for-work",
    "/customers/spotify",
    "/customers/spring-new",
    "/customers/stairwell",
    "/customers/steno",
    "/customers/stripe",
    "/customers/stubhub",
    "/customers/studyfetch",
    "/customers/super-teacher",
    "/customers/tabnine",
    "/customers/tahoe-lead-removal-project",
    "/customers/tasklet",
    "/customers/telus",
    "/customers/thomson-reuters",
    "/customers/thomson-reuters-qa",
    "/customers/tidio",
    "/customers/tines",
    "/customers/tldv",
    "/customers/tome",
    "/customers/trellix",
    "/customers/triple-whale",
    "/customers/try",
    "/customers/vambe",
    "/customers/vanta",
    "/customers/vibecode",
    "/customers/wedia-group",
    "/customers/windsurf",
    "/customers/wiz",
    "/customers/wordsmith",
    "/customers/workato",
    "/customers/wrtn",
    "/customers/you-dot-com",
    "/customers/zapia",
    "/customers/zapier",
    "/customers/zencoder",
    "/customers/zingage",
    "/customers/zoom",
    "/download",
    "/features/artifacts",
    "/import-memory",
    "/marketplace-partners",
    "/newsletter/developers",
    "/office-hours",
    "/partners",
    "/partners/claude-on-aws",
    "/partners/google-cloud",
    "/partners/microsoft-foundry",
    "/partners/powered-by-claude",
    "/platform/api",
    "/pricing",
    "/problem-solvers",
    "/product/claude-code",
    "/product/claude-code/enterprise",
    "/product/claude-science",
    "/product/claude-security",
    "/product/cowork",
    "/product/design",
    "/product/overview",
    "/product/tag",
    "/programs/campus",
    "/programs/frontier-academy",
    "/programs/startups",
    "/programs/team-plan-for-scientists",
    "/regional-compliance",
    "/resources",
    "/resources/articles",
    "/resources/articles/1m-context-ga",
    "/resources/articles/auto-mode",
    "/resources/articles/automate-security-reviews-with-claude-code",
    "/resources/articles/best-practices-for-prompt-engineering",
    "/resources/articles/beyond-permission-prompts-making-claude-code-more-secure-and-autonomous",
    "/resources/articles/build-responsive-web-layouts",
    "/resources/articles/building-agents-with-skills-equipping-agents-for-specialized-work",
    "/resources/articles/building-companies-with-claude-code",
    "/resources/articles/building-multi-agent-systems-when-and-how-to-use-them",
    "/resources/articles/claude-code-and-slack",
    "/resources/articles/claude-code-desktop-redesign",
    "/resources/articles/claude-code-guide-for-startups",
    "/resources/articles/claude-code-mods",
    "/resources/articles/claude-code-on-the-web",
    "/resources/articles/claude-code-plugins",
    "/resources/articles/claude-design-stays-on-brand-for-daily-work",
    "/resources/articles/claude-excel-powerpoint-updates",
    "/resources/articles/claude-for-chrome",
    "/resources/articles/claude-for-financial-advisors",
    "/resources/articles/claude-for-government-is-now-generally-available",
    "/resources/articles/claude-for-the-legal-industry",
    "/resources/articles/claude-in-chrome-generally-available",
    "/resources/articles/claude-managed-agents",
    "/resources/articles/claude-now-works-in-google-docs-sheets-and-slides",
    "/resources/articles/common-workflow-patterns-for-ai-agents-and-when-to-use-them",
    "/resources/articles/complete-guide-to-building-skills-for-claude",
    "/resources/articles/context-management",
    "/resources/articles/cowork-built-in-browser",
    "/resources/articles/cowork-is-now-claude",
    "/resources/articles/cowork-plugins-across-enterprise",
    "/resources/articles/cowork-plugins-finance",
    "/resources/articles/create-files",
    "/resources/articles/eight-trends-defining-how-software-gets-built-in-2026",
    "/resources/articles/extending-claude-capabilities-with-skills-mcp-servers",
    "/resources/articles/fix-software-bugs-faster-with-claude",
    "/resources/articles/how-ai-helps-break-cost-barrier-cobol-modernization",
    "/resources/articles/how-anthropic-enables-self-service-data-analytics-with-claude",
    "/resources/articles/how-anthropic-teams-use-claude-code",
    "/resources/articles/how-anthropic-uses-claude-legal",
    "/resources/articles/how-anthropic-uses-claude-marketing",
    "/resources/articles/how-brex-improves-code-quality-and-productivity-with-claude-code",
    "/resources/articles/how-enterprises-are-building-ai-agents-in-2026",
    "/resources/articles/how-healthcare-organizations-use-claude-tag",
    "/resources/articles/how-to-configure-hooks",
    "/resources/articles/how-to-create-skills-key-steps-limitations-and-examples",
    "/resources/articles/how-to-prepare-for-ai-driven-code-modernization-projects",
    "/resources/articles/improved-web-search-with-dynamic-filtering",
    "/resources/articles/improving-frontend-design-through-skills",
    "/resources/articles/improving-skill-creator-test-measure-and-refine-agent-skills",
    "/resources/articles/integrate-apis-seamlessly",
    "/resources/articles/introducing-routines-in-claude-code",
    "/resources/articles/introduction-to-agentic-coding",
    "/resources/articles/key-benefits-transitioning-agentic-coding",
    "/resources/articles/making-claude-a-better-electrical-engineer",
    "/resources/articles/memory",
    "/resources/articles/observability-for-developers-building-connectors",
    "/resources/articles/optimize-code-performance-quickly",
    "/resources/articles/opus-4-6-finance",
    "/resources/articles/organization-skills-and-directory",
    "/resources/articles/preview-review-and-merge-with-claude-code",
    "/resources/articles/self-serve-enterprise",
    "/resources/articles/skills",
    "/resources/articles/skills-explained",
    "/resources/articles/structured-outputs-on-the-claude-developer-platform",
    "/resources/articles/the-ai-native-sdlc-playbook",
    "/resources/articles/the-founders-playbook",
    "/resources/articles/using-claude-md-files",
    "/resources/articles/were-expanding-the-claude-startups-program-to-help-founders-build",
    "/resources/articles/what-is-model-context-protocol",
    "/resources/best-practices",
    "/resources/guides",
    "/resources/insights",
    "/resources/perspectives",
    "/resources/product-announcements",
    "/resources/videos",
    "/resources/webinars",
    "/skills",
    "/solutions/agents",
    "/solutions/code-modernization",
    "/solutions/coding",
    "/solutions/commerce",
    "/solutions/customer-support",
    "/solutions/cybersecurity",
    "/solutions/education",
    "/solutions/enterprise",
    "/solutions/financial-services",
    "/solutions/government",
    "/solutions/healthcare",
    "/solutions/legal",
    "/solutions/life-sciences",
    "/solutions/life-sciences/ai-adoption-index",
    "/solutions/nonprofits",
    "/solutions/sales",
    "/solutions/small-business",
    "/solutions/teachers"
  ];
  var COM_EXACT_META = {"at":"2026-10-17","sitemap":3696,"english":2387,"localized":340,"fromSitemap":334,"fromHreflang":5,"minLocales":1,"exact":339};
  // ═══ </com-routes> ═══
  // ★ (ر20-أ، ١٢ جمادى الأولى ١٤٤٨هـ) لوحة المطوّرين (Console) على platform.claude.com خارج ‎/docs/‎: تطبيق Next.js واحدٌ مع الوثائق يتنقّل بينهما بلا إعادة
  // تحميل (الجرد §٣-٢، وخطة النطاقات §٤ب)، فهي **صنفُ مسارٍ في مدخل الوثائق نفسه** بقاموسٍ ثانٍ (ar-console.json ← dict-console.js) لا مدخلٌ ثانٍ على
  // المضيف نفسه، ولا إذن جديدًا (‎https://platform.claude.com/*‎ مطابَقٌ اليوم). والمسارات أقسام اللوحة بأعيانها، لا «كل ما ليس ‎/docs/‎»: قسمٌ جديد
  // لا نعرفه خاملٌ حتى يُضاف هنا. والمصدر (١٢ جمادى الأولى ١٤٤٨هـ، قراءةٌ بنيوية للحزم العامة بلا دخولٍ ولا كعكات، أسماءٌ وأعداد): أسماء المسارات
  // المقتبسة في حزم صفحة الدخول وأغلفة الأقسام العامة (215 ملفًّا)، ثم طلبٌ بلا اعتمادٍ لكلٍّ منها — 200 (غلاف القسم يُرسم ثم يُطلب الدخول من العميل)
  // أو تحويلٌ إلى قسمٍ منها (‎/settings‎ ← ‎/settings/organization‎، و‎/workbench‎ ← ‎/playground‎) يُبقيه، و404 يُسقطه (‎/limits‎ و‎/workspaces‎ و‎/upgrade‎…).
  // وأقسام الإعدادات التسعة عشر في حزمةٍ واحدة (جدول التنقّل في الإعدادات) تحت البادئة ‎/settings/‎. والجذر ‎/‎ بعينه (لوحة البداية). وخارجها كما هي:
  // ‎/docs/‎ (مدخل الوثائق)، و‎/cookbook/‎ (خارج النطاق، PLAN-3.0.0 §١-٨)، وكل مسارٍ آخر
  var CONSOLE_ROUTES = { exact: ["/"],
    full: ["/agents/", "/appeal/", "/batches/", "/claude-code/", "/cost/", "/create/", "/dashboard/", "/deployments/", "/environments/", "/files/",
           "/invites/", "/join/", "/login/", "/logout/", "/logs/", "/magic-link/", "/memory-stores/", "/notifications/", "/onboarding/",
           "/org-discovery/", "/partner-callback/", "/partner-onboarding/", "/partner-setup/", "/playground/", "/restricted/", "/sessions/",
           "/settings/", "/skills/", "/spending/", "/sso-callback/", "/usage/", "/vaults/", "/workbench/"] };
  // ★ (ر20-أ) محتوى المستخدم في أسطح اللوحة (RULES §1): لا يُعرَّب ولا يُقلب ولا يُحصد، ولا يُقرأ نصُّه للمطابقة (رفض التتابع كلّه، SHARED.blockProt)، وهو
  // خاملٌ اليوم مع الصنف كلّه حتى CN1. والمحدِّدات من بنية الحزم العامة وحدها (أسماء الأصناف وسمات البيانات ومعرّفات الاختبار، أعدادًا بلا نص)، وما
  // يحتاج فحص المالك بحسابه في CN-د مذكورٌ بنجمة:
  //   ‎[data-row-key]‎ (8 في الحزم): صفوف جداول البيانات كلها — المفاتيح (‎table-api-keys‎) والأعضاء والمساحات والسجلّات والملفات والدفعات والفواتير
  //     (‎console-billing-invoice-history‎): الصفّ كلّه سجلٌّ من حساب المستخدم (اسم المفتاح وبادئته، والاسم والبريد، ومبلغ الفاتورة)؛ ورؤوس الأعمدة
  //     خارجه فتُعرَّب. ★ وما في الصفّ من نصّ الشركة (شارة الحالة، واسم الدور) يبقى إنجليزيًّا احتياطًا حتى يفصله فحص المالك
  //   ‎.bg-user-message‎ (3): دورُ المستخدم في محادثة ساحة التجربة (‎/playground‎)
  //   ‎[class~="prose"]‎ (21 صنفًا يبدأ بـ‎prose‎): النصّ المنسَّق بمكتبة الطباعة — مخرجات النموذج في ساحة التجربة والتقييم. ★ وإن كان فيه نصُّ شركةٍ فاحتياطٌ
  //   ومعرّفات الاختبار للمبالغ والأعداد: ‎kpi-value‎ و‎top-bar-balance‎ و‎purchase-dialog-current-balance‎ و‎balance-after-bonus‎ و‎members-count‎،
  //     وإطار الفاتورة ‎invoice-detail-frame‎
  //   ومعها EDITOR_USER في الصف (محرِّر الموجِّه ومتغيّراته إن كان ProseMirror أو أعلن دور ‎textbox‎). ★ ولا محرِّر غنيّ في الحزم العامة (0 من ‎cm-editor‎
  //     و‎monaco-editor‎ و‎ProseMirror‎)، فمحرِّر الموجِّه خلف الدخول؛ و‎contenteditable‎ (17 موضعًا) يحميه المحرّك بقابلية التحرير أصلًا، و‎<input>‎ لا عقدة نصٍّ
  //     فيه، وقيمة ‎<textarea>‎ الأولى عقدةُ نصٍّ يحميها تخطّي المحرّك وسمَ TEXTAREA (ر24-و). ★ واسم المؤسسة والمساحة في مبدِّل الرأس (‎top-bar-menu‎) لم يُعرف عنصره بلا دخول
  var CONSOLE_USER = "[data-row-key], .bg-user-message, [class~='prose'], [data-testid='kpi-value'], [data-testid='top-bar-balance'], " +
    "[data-testid='purchase-dialog-current-balance'], [data-testid='balance-after-bonus'], [data-testid='members-count'], " +
    "[data-testid='invoice-detail-frame']";
  // ★ (ر20-ب، ١٢ جمادى الأولى ١٤٤٨هـ) محتوى المستخدم في بوابة Anthropic (portal.anthropic.com، صفّ portal أدناه): التطبيق من عائلة اللوحة نفسها
  // (applicationType ‏trust-portal في إعداد الصفحة، ومكتبة الدخول ونظام التصميم CDS نفساهما)، لكن حزمه ليست حزم اللوحة (2 من 59 ملفًّا متطابقةٌ
  // بالمحتوى مع حزم صفحة دخول اللوحة). والمحدِّدات من بنية الحزم العامة لصفحة الدخول وحدها (أسماءٌ وأعداد بلا نص، والحزم محذوفة بعد القراءة)، لأن كل
  // مسارٍ غير صفحات الدخول الأربع يحوّله الخادم إلى الدخول (307 ← ‎/login?returnTo=‎) ولو كان مسارًا لا وجود له، فلا يُرى من أسطح البوابة خلف الدخول
  // شيء. وما عليه نجمة ★ يحتاج فحص المالك بحسابه في متصفحه (CN2-د)، والبوابة كلها خاملةٌ اليوم:
  //   ‎[data-row-key]‎ ★: صفوف جداول البيانات في CDS كما في اللوحة (CONSOLE_USER) — الطلبات وأعضاء المؤسسة إن عُرضت جداولَ
  //   ‎[class~="prose"]‎ ★: النصّ المنسَّق — إجابات نماذج التقديم إن عُرضت للمراجعة منسَّقة
  //   ‎[dir="ltr"]‎: ما يجعله الموقع من اليسار بسمةٍ صريحة — في حزم الدخول 6 مواضع في 4 ملفات، ومنها عنوان البريد الذي أُرسل إليه رابط الدخول
  //     وأرقام الرموز؛ وهي في البوابة قيمٌ يكتبها المستخدم أو تخصّ حسابه (بريد، هاتف، رمز)
  //   ومعها EDITOR_USER في الصف. و‎<input>‎ (حقول النماذج) لا عقدة نصٍّ فيه؛ أما ‎<textarea>‎ فقيمته الأولى التي يرسلها الخادم عقدةُ نصٍّ فيه، ويحميها
  //   تخطّي المحرّك وسمَ TEXTAREA (‎CMLShared.DOM_RULES.SKIP‎) لا غيابُ النص (تصحيح مراجع ر20-ب في RULES §1، ر24-و). والمحرِّر القابل للتحرير يحميه المحرّك.
  //   ★ ولم يُعرف بلا دخول: عرضُ إجابات الطلب بعد إرساله، وأسماء المتقدّم والمؤسسة وحقولها، وأسماء الملفات المرفوعة (‎input[type=file]‎ موضعٌ واحد
  //     في الحزم، واسم الملف المعروض بجانبه غير معروف)، وحال الطلب (شارةٌ من نصّ الشركة أم من بيانات الطلب)، ومبدِّل الحساب (‎add-or-switch-*‎)
  var PORTAL_USER = "[data-row-key], [class~='prose'], [dir='ltr']";
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
    // والنمط مفهرسان بثوابتهما (cml-shared patternIndex). بقي حدًّا لما يُدخله المستخدم وحده (تصحيحاته في الإعدادات والنافذة
    // والمزامنة). ★ (ر29-ط، ١٩ جمادى الأولى ١٤٤٨هـ) ولم يعد سقفًا لـ«فحص الترجمة» (ماسحا الحزم وفهرس الصفحات في engine.js): كان نصٌّ طويلٌ غير مترجم
    // لا يبلغ تصدير المالك أبدًا. ★ (ر29-ي، ١٩ جمادى الأولى ١٤٤٨هـ) ولم يعد حدًّا لما يُحفظ من تصحيحات المستخدم: التصحيح يُحفظ على الجهاز مهما طال،
    // وبقي حدَّ المزامنة وحدها (cml-sync.js: ما جاوز النصُّ فيه TEXT_MAX أو الترجمةُ ضعفَه لا يُرفع ويبقى محليًّا، وتقوله الإعدادات والنافذة).
    TEXT_MAX: 300,
    // ما تلتقطه متغيّرات نمطٍ من نصٍّ مجتمعةً (النص ناقصَ ثوابت النمط): القالب الطويل ثوابته طويلة فيمرّ، ونمطٌ قصيرٌ عامّ
    // لا يبتلع فقرةً طويلةً لا تخصّه — والنصّ الذي لا يزيد على هذا الحدّ لا يمسّه الشرط أصلًا (السلوك قبل رفع السقف نفسه)
    PATTERN_CAPTURE_MAX: 300,
    PEND_MAX: 2000,         // سقف طابور الطفرات قبل التحول لمرور كامل
    LOOKUP_CACHE_MAX: 5000, // سقف ذاكرة نتائج البحث
    LOOKUP_CACHE_KEY_MAX: 300, // ولا يُخزَّن فيها مفتاحٌ أطول (حدُّ ذاكرةٍ لا حدُّ ترجمة: الطويل يُطلب بالفهرس كل مرة)

    // ---- عتبات الفحص ----
    CLAIM_STALE_MS: 90000,  // حجز أقدم من هذا متروك (يطابقه startScan وclaimScan حكمًا)
    // ★ (ر29-ز) لا سقف عددٍ لغير المترجَم (كان SCAN_CAP ‏4,000 سطر فأسقط من تصدير المالك خمسة أسطر): حدُّ حجمٍ لما يُخزَّن منه حمايةً لسعة
    // التخزين المحلي، أعلى بكثيرٍ من أي فحصٍ قيس (4,005 أسطر نحو 0.2 م.ب). وما جاوزه يُعدّ ويُقال في الإعدادات وفي ملف «أمر الترجمة» (omitted)
    SCAN_MAX_BYTES: 2 * 1024 * 1024,
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
    BLOCK_VAL_MAX: 8000,     // أطول قالبٍ عربي لفقرةٍ يُقبل تصحيحًا من القارئ: حصّة تخزين التصحيحات ومزامنتها، لا شرطُ ترجمة (المتون بلا سقف طولٍ منذ ر24-أ)

    // ═══ جدول النطاقات (١-٠ب) — المصدر الواحد لها في المحرّك والعامل والخيارات والبناء ═══
    // id هو اسم النطاق في المفاتيح (key) والقواميس؛ «app» يبقى على مفاتيح 1.0.0 بلا لاحقة
    // فلا ترحيل. meta تحملها قواميس النطاق نفسها (build.mjs يحقنها) فالمحرّك يعرف نطاقه
    // من قاموسه لا من اسم المضيف:
    //   scan  : "app" فحص حزم التطبيق | "llms" فهرس llms.txt (المسار meta.llms، وافتراضه "/llms.txt")
    //           | "none" لا فحص
    //   live  : ورقة اتجاهٍ حيّة من أوراق الصفحة (وإلا فاللقطة المشحونة وحدها)
    //   liveSheetsMax: ★ (ر16-ج) سقف عدد أوراق الجولة لهذا النطاق بدل RTL_LIVE_SHEETS_MAX (العامل validLiveRequest) — لموقعٍ تزيد أوراق صفحاته
    //           على السقف العام، مقيسًا من قوالبه؛ وغيابُه = السقف العام كما كان
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
    //           next-route-announcer يكتب لغة واجهته عند تركيب تطبيقه: الأكاديمية، ويلزمه siteLang) | "attr" (ر27-ب: أول كتابةٍ من الموقع
    //           لسمة <html> المسمّاة في hydrateAttr بعد اكتمال التحليل — لا نكتبها نحن أبدًا — تفتح البوابة بلا انتظار الخمول؛ لموقعٍ بلا
    //           next-route-announcer يعيد كتابة تلك السمة في إيداع ترطيب جذره ولا يبقى بعده غير مرطَّبٍ ما فيه نصّ: بناء Mintlify الجديد
    //           في وثائق Claude Code، وnext-route-announcer يبقى إشارةً معها). السقفان كما هما
    //   hydrateAttr: اسم سمة <html> لإشارة "attr" (وحدها)
    //   isoLabels: عزل اللافتات اللاتينية الخالصة التي لم تُترجم وفي طرفها رمز («C#» تُرسم «#C» في سياق RTL) بـLRI…PDI في
    //           عقدة نصّها — حين تكون وحدها نصَّ صندوق سطرها واتجاهُها المحسوب RTL (engine.js isolateLabel). لا يُفعَّل في نطاقٍ فيه
    //           نصوصٌ كتبها المستخدم خارج متن المحادثة (عناوين المحادثات في التطبيق)
    //   iconMirror: ★ (ر30-ب، القرار 124) يسم المحرّك الأيقونات الاتجاهية بهويّتها (اسم الرمز وأصنافه) ‎data-cml-mirror‎ فتعكسها base.css تحت
    //           ‎:dir(rtl)‎ (engine.js markIcons). لا يُفعَّل في claude.ai: يعكس أيقوناته بنفسه
    //   countNoun: ★ (ر12، ٥ جمادى الأولى ١٤٤٨هـ — PLAN-3.0.0 ج3) معدودٌ يُرسم عقدةً وحده بعد عددٍ في عقدةٍ أخرى («‎2<!-- --> <!-- -->lessons‎»)
    //           يُكتب بصيغة الجمع للعدد من مدخل «‎%d <المعدود>‎» في القاموس، وتُفرَّغ عقدة العدد (engine.js countPair). للأكاديمية وحدها:
    //           لم يُقَس شكلٌ كهذا في غيرها، وفي التطبيق أسماءٌ يكتبها المستخدم خارج المحادثة
    //   routes: حارس المسار — exact: مساراتٌ كاملةٌ بالمساواة (بعد نزع الشرطة الختامية)، full: بادئاتٌ
    //           يعمل فيها كاملًا، shell: هيكلٌ فقط؛ وما سواها خامل
    //   bodyRoutes: ★ (ر29-د) مسارات المتن (بصيغة routes: exact وfull): صفحاتٌ لا بدّ فيها من متنٍ يطابقه bodySel. فإن لم يطابق شيئًا بعد استقرار
    //           الصفحة حُجزت «nosel» وخمد المحرّك فيها (engine.js)، وفحص الاتجاه والحاصد يعدّانه عطلًا. غيابها = لا صمّام (الأكاديمية وclaude.ai).
    //           ★ (مراجعة ر29-د) وshell فيها: بادئةٌ تحت بادئةٍ كاملة ليست مسار متن (صفحةٌ بلا متنٍ أصلًا) — routeMode يقدّمها على full
    //   bodyMain: ★ (ر29-د2، مراجعة ر29-د F4) حاوية المتن الرئيسة — أجزاءٌ من bodySel فيها نصّ الصفحة (لا الرأس ولا الفهرس)، وأيُّها يكفي. يسأل
    //           عنها الصمّام وحكمُ الحارس (engine.js mainFound)، وتُفحص مفتاحًا بنفسها في الحاصد وفحص الاتجاه وبوابة بدء المرحلة ونتيجة الفحص
    //           (sel-health.mjs). لازمةٌ لكل نطاقٍ له bodyRoutes ومحدِّد متنه مركّب (selftest-tools: tableGaps)؛ وغيابها = bodySel كلّه
    //   bodies: متونٌ بوضع الكتلة (المرحلة ٢) — قطعةٌ لكل صفحة من bodies/<id>/<لغة>/ داخل المتن (bodySel)
    //   bodyGuard: ★ (ر6-ب) حارس المتن المختلط — نسبةٌ من 0 إلى أقل من 1: إذا زادت حصّة كتل المتن الحيّة التي لا تغطّيها قطعة الصفحة (لا ترجمة لها
    //           ولا علامة إبقاء ولا يعرّبها قاموس الواجهة ولا هي محايدة بلا كلمةٍ لاتينية) على هذه النسبة لم يُكتب داخل متن تلك الصفحة شيء:
    //           يبقى المتن إنجليزيًّا كلُّه والواجهة حوله عربية، وعلى الجذر data-cml-body="held". يُحكم مرّةً لكل صفحة بعد وصول قطعتها
    //           وترطيبها، وما يظهر بعده (لوحات التبويب والأكورديون) يتبع الحكم. غيابُها = لا حارس (كما كان).
    //           ★ (ر6-د — القرار 84) والصفحة التي لا قطعة لها تُحكم بقطعةٍ فارغة فتُحجب كذلك إلا أن يغطّي قاموسُ الواجهة متنَها، ومعها
    //           data-cml-held="none" (و"drift" لما لها قطعة) — والعتبة في المواقع الخمسة BODY_GUARD (القرار 83)، ★ (ر13) والأكاديمية سادستها
    //   bodyRejudge: ★ (مراجعة ر13-أ) true: الحكم يُعاد بكتل المتن الحاضرة كلما كبر المتن بعد حكمٍ لم يحجبه ولم يُكتب فيه من القطعة شيء (engine.js
    //           bodyRejudge) — لموقعٍ يُركِّب جزءًا من متنه من العميل بعد فتح البوابة (أدوات الأكاديمية الحيّة)؛ وبعد أول كتابةٍ من القطعة يتبع ما يظهر
    //           الحكمَ كما في bodyGuard. غيابُها = حكمٌ واحد لكل صفحة (كما كان)
    //   pageAlias: [{re, to}] — مساراتٌ عدّة لصفحةٍ واحدة تُردّ إلى مفتاحها القانوني (SHARED.pageKey: المحرّك والعامل والحاصد والبناء
    //           معًا): re مصدرُ تعبيرٍ على المسار بلا شرطةٍ ختامية، وto قالبُ الاستبدال ($1…). مرجع الوثائق: صفحات SDK (‎/api/python/…‎)
    //           نصوصُ ما نترجمه فيها هي نصوص صفحة HTTP حرفًا بحرف، فقطعتُها قطعتُها
    //   skipSel: ما لا يُترجم ولا يُحصد أبدًا في النطاق (محتوى مولَّد كأجوبة المساعد، والعقد البرمجي في مرجع الوثائق، وأسماءٌ كتبها
    //           المستخدم في التطبيق: المحادثات والمشاريع والمُخرَجات والملفات — APP_USER_NAMED) — كاستثناء المحادثة في التطبيق
    //   keepSel: ★ (ر24-ج1، ١٠ جمادى الأولى ١٤٤٨هـ — بعد ر24-أ، القراران 107 و113) صنفُ ما في skipSel: أجزاؤه (محدِّداتٌ مفصولةٌ بفاصلةٍ في المستوى
    //           الأعلى، حرفًا بحرف كما في skipSel) التي هي نصُّ الموقع تبقيه الشركة إنجليزيًّا — العقد البرمجي والشيفرة والشارات وغلاف الموقع.
    //           وكلُّ جزءٍ من skipSel ليس هنا محتوى مستخدم (المحادثة، والقابل للتحرير، وأسماء المستخدم ونصوصه، وما يتلقّاه جوابًا) — فما لم يُصنَّف
    //           محتوى مستخدمٍ احتياطًا. وكلاهما لا يُترجم ولا يُحصد كما كان؛ والفرق داخل تتابع الكتلة وحده (SHARED.blockProt): عنصرُ محتوى المستخدم
    //           يرفض التتابع كلَّه بلا قراءة، وعنصرُ ما تبقيه الشركة ذرّةٌ معتمة لا تُكتب (<cN>نصّها</cN> أو <gN/>) ويُترجم ما حوله. وshellSel (محتوى
    //           الموقع في مسار shell) وechoSel (صدى عنوانٍ من المتن) من الصنف الثاني بتعريفهما (SHARED.harvestKeep)، ومحدِّدات المحادثة وقابل
    //           التحرير من الأول دائمًا. وغيابُه = كلُّ skipSel محتوى مستخدم
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
    //   ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) وصيغةٌ ثالثة {upcoming: true}: نطاقٌ «قادم» — صفُّه هنا، ومطابقته يحجبها البناء عن مانيفست الحزمة
    //   (ر28-ب، ٢٠ جمادى الأولى ١٤٤٨هـ، السؤال 2 على افتراضه: manifest-entry.mjs ‏packageEntries)، فلا يُعلَن مضيفه في نافذة الإذن حتى يُشحن
    //   قاموسه في الإصدار الذي يحمله، ولا قاموس له بعد. فهو خاملٌ تمامًا في صفحاته (engine.js: لا سمة ولا إخفاء ولا خط ولا
    //   عنوان ولا طلب، والنافذة وحدها تقول إنه قادم)، ولا تعرضه الإعدادات ولا يُعدّ في الترحيب (C.shipped)، وعامل الخدمة لا يجيب له طلب قطعةٍ ولا
    //   ورقة، وبوابة الحزمة (verify-package) لا تقبل نطاقًا مشحونًا قاموسُه المبنيّ لا يعرّب شيئًا. ويُشغَّل بتبديل صيغته إلى {full} أو {part, en}
    //   في المرحلة التي تشحن قاموسه (CM-د)، ومعه تُحدَّث الفحوص المثبَّتة على حاله اليوم (_comtest و_cominerttest و_optionstest والدخان)
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
                skipSel: APP_USER_NAMED + ", " + EDITOR_USER,
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
        meta: { scan: "none", live: false, chat: false, iconMirror: true, hydrate: "defer", intercom: true, bodies: true, dirSel: INTERCOM_DIRSEL, bodySel: INTERCOM_BODYSEL,
                // ★ (ر6-د) حارس المتن المختلط بعتبة القرار 83 (BODY_GUARD أعلاه)
                bodyGuard: BODY_GUARD,
                // ★ (ر29-د) مسارات المتن لصمّام «nosel» (engine.js): مقالاتٌ فيها متنٌ لا بدّ منه، لا الرئيسة ولا المجموعات
                bodyRoutes: { full: ["/en/articles/"] },
                // ★ (ر29-د2) حاوية المتن الرئيسة: نصّ المقالة، لا فهرسها (INTERCOM_BODYSEL مركّب)
                bodyMain: INTERCOM_BODYMAIN,
                fontFamilies: { "AnthropicSans-Regular-Web": "ui", "AnthropicSerif-Regular-Web": "read" }, fontPrepend: INTERCOM_FONT_VARS,
                // «<المقالة أو المجموعة> | Claude Help Center»، والرئيسية «Home | …» (وأكثرها في القاموس كاملةً من حصاد DOM)
                titleSuffix: [" | Claude Help Center"],
                skipSel: EDITOR_USER } },   // ★ (ر24-ج2) مواضع الكتابة
      { id: "privacy", name: "مركز الخصوصية", host: "privacy.claude.com", origin: "https://privacy.claude.com",
        matches: ["https://privacy.claude.com/en/*"], dict: "dict-privacy.js", allFrames: false,
        status: { full: true },
        meta: { scan: "none", live: false, chat: false, iconMirror: true, hydrate: "defer", intercom: true, bodies: true, dirSel: INTERCOM_DIRSEL, bodySel: INTERCOM_BODYSEL,
                // ★ (ر6-د) حارس المتن المختلط بعتبة القرار 83 (BODY_GUARD أعلاه)
                bodyGuard: BODY_GUARD,
                // ★ (ر29-د) مسارات المتن لصمّام «nosel» (engine.js): مقالاتٌ فيها متنٌ لا بدّ منه، لا الرئيسة ولا المجموعات
                bodyRoutes: { full: ["/en/articles/"] },
                // ★ (ر29-د2) حاوية المتن الرئيسة: نصّ المقالة، لا فهرسها (INTERCOM_BODYSEL مركّب)
                bodyMain: INTERCOM_BODYMAIN,
                fontFamilies: { "Tiempos Text Regular": "read" }, fontPrepend: INTERCOM_FONT_VARS,
                titleSuffix: [" | Anthropic Privacy Center"],
                skipSel: EDITOR_USER } },   // ★ (ر24-ج2) مواضع الكتابة
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
        meta: { scan: "none", live: true, chat: false, iconMirror: true, hydrate: "defer", bodies: true, siteLang: true,
                // ★ (ر6-د) حارس المتن المختلط بعتبة القرار 83 (BODY_GUARD أعلاه): وسياسة الاستخدام (‎/legal/aup‎) بلا قطعةٍ حتى يُحسم q90،
                // فتُحجب بلا تنبيه (القرار 84)
                bodyGuard: BODY_GUARD,
                routes: { exact: ["/legal/privacy", "/legal/non-user-privacy-policy", "/legal/cookies", "/legal/aup", "/legal/consumer-terms"] },
                // ★ (ر29-د) مسارات المتن لصمّام «nosel» (engine.js): الوثائق الخمس كلها، وسياسة الاستخدام منها (متنها محجوزٌ «none» وموضعه معروف)
                bodyRoutes: { exact: ["/legal/privacy", "/legal/non-user-privacy-policy", "/legal/cookies", "/legal/aup", "/legal/consumer-terms"] },
                dirSel: LEGAL_BODY + ", " + LEGAL_HERO, bodySel: LEGAL_BODY, skipSel: LEGAL_CHROME + ", " + EDITOR_USER,
                // ★ (ر24-ج1) غلاف الموقع ومنتقي اللغة نصُّ الموقع تبقيه الشركة إنجليزيًّا: كلُّه من صنف keepSel
                keepSel: LEGAL_CHROME,
                // منتقي لغة الوثيقة يبدّل المتن في React بلا تغييرٍ في العنوان ولا <html lang>، ويبدأ بلغة بلد الزائر إن وُجدت ترجمتها
                // ★ (ر29-ج) المنتقي الجديد زرٌّ (Select__trigger، وعليه LegalArticleHero__LanguageSelect) فيه قيمته المعروضة (‎<span>‎ بلا صنف)
                // وأيقونته (Select__icon، بلا نص). واختيار لغةٍ أخرى يضيف سلسلة استعلامٍ ويبدّل المتن والقيمة، ولا يمسّ المسار ولا <html lang>
                // (مقيسًا) — فالحكم بنصّ القيمة كما كان
                // ★ (ر29-ح) بالصيغة الجديدة: الزرّ ‎_LanguageSelect‎ (وعليه ‎_trigger‎ من وحدة المنتقي) وأيقونته ‎_icon‎ — قيمته English في العشرة
                siteLangSel: "[class*='_LanguageSelect'] > span:not([class*='_icon'])",
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
        // ★ (ر13، ٥ جمادى الأولى ١٤٤٨هـ) ويبقى كما هو ما دام فهرس قطعها المشحون فارغًا (متون صفحاتها محجوبةٌ «none»)، ويُعدَّل حين تُشحن القطع (AC-د)
        status: { part: "الواجهة وعناوين الدورات والدروس", en: "محتوى أكاديمية Claude عدا واجهتها وعناوين الدورات والدروس" },
        // live: Vite يبدّل أسماء أوراقه المجزَّأة مع كل نشر، فاللقطة المشحونة للطلاء الأول والحيّة تُبنى من أوراق الصفحة (٢–٣).
        // hydrate: كتابةُ نصٍّ قبل الترطيب تُفشله فيرمي React ما رسمه الخادم ويُبلغ الموقعُ «[prerender] hydration failed» إلى
        // مراقبته (مقيس: دراسة ر4 §1.4)؛ ولا next-route-announcer فيه، فالإشارة "lang": أول كتابةٍ منه لـ<html lang> (أثر IntlProvider
        // عند التركيب) ثم load وفترتا خمول — الوحيدة التي اجتازت 4/4 في القياس (السمات والاتجاه مبكرًا كما في غيره).
        // ★ (قياس ر4-أ بالإضافة الحقيقية وقاموسٍ تجريبي يكتب الواجهة والعنوان والسمات، ٢٨ ربيع الآخر ١٤٤٨هـ) صفحات العيّنة الاثنتا عشرة ×3:
        // 0 بلاغ ترطيب و0 خطأ React في 36 تحميلًا بها و36 بدونها، وما رسمه الخادم باقٍ؛ والبوابة «open:lang+idle» في كلها، وكتابة الموقع
        // لـlang بعد DOMContentLoaded بـ0.22–0.55 ث، وأول نصٍّ عربي بعد DOMContentLoaded بـ0.5–1.8 ث (والسقف 8 ث)، ولا كتابة قبل كتابته أبدًا
        meta: { scan: "none", live: true, chat: false, iconMirror: true, hydrate: "defer", hydrateSignal: "lang", siteLang: true, isoLabels: true,
                // ★ (ر12، ج3) عدد دروس القسم وعدده في عقدتين («‎2<!-- --> <!-- -->lessons‎»، مقيسٌ في صفحات الدورات): صيغة الجمع للعدد
                countNoun: true,
                // أول بادئةٍ في routes.full («/all/») لا تختصر الموقع
                siteLabel: "academy.claude.com",
                // ★ (ر5، ٢٩ ربيع الآخر ١٤٤٨هـ — مراجعة ر4-أ L6) لغة الواجهة هنا منتقٍ في تذييل الصفحة (يحفظ اختياره في academy.locale)، لا إعدادٌ في الحساب
                siteLangHow: "اختر English من منتقي اللغة في تذييل الصفحة",
                // ★ (ر13، ٥ جمادى الأولى ١٤٤٨هـ — دراسة ر13-أ) المتون بوضع الكتلة: قطعةٌ لكل صفحة (bodies/academy/<لغة>/) للمقالة وقائمة «في هذه
                // الصفحة» (ACADEMY_BODY)، والحارس بعتبة القرار 83. ولا قطعة مشحونة حتى AC-د: كل صفحةٍ في متنها كتلٌ تُحكم بقطعةٍ فارغة فتُحجب
                // (data-cml-held="none"، القرار 84) ويبقى متنها إنجليزيًّا LTR كما في 2.0.0. وكتابة الكتل خلف بوابة الترطيب نفسها ("lang")، والقطعة
                // تُطلب من بدء المستند. ولا pageAlias (لكل صفحةٍ مسارٌ عامٌّ واحد في خريطة الموقع) ولا echoSel (لا يحكي خارجَ المتن عنوانٌ منه)
                // ★ (مراجعة ر13-أ، ٦ جمادى الأولى ١٤٤٨هـ) وأداةٌ حيّة تُركَّب بعد الحكم في درسٍ متنُه هي وحدها: يُعاد الحكم إذا كبر المتن ولم يُكتب فيه
                // شيءٌ من القطعة (bodyRejudge) — قِيس: 8 من 156 صفحةً بأداةٍ حيّة كانت تُحكم بكتلةٍ واحدة فلا تُحجب
                // ★ (ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ — E-lang) وما يُكتب بالعربية في عنصرٍ من المتن يعلن لغةً أخرى (ملخّص الأداة لقارئ الشاشة
                // ‎p.sr-only[data-widget-summary][lang=en]‎) تصير سمةُ lang فيه لغةَ الصفحة كما تفعل الشركة في عروضها المترجمة، وتُرجع مع إرجاع النص
                // (engine.js langSync). براية الأكاديمية وحدها، فالمواقع الأخرى على حالها حرفًا
                // ★ (مراجعة ر13-ج، ٦ جمادى الأولى ١٤٤٨هـ) وعلامة الإبقاء في صفّ لافتاتٍ تُبقيه الشركة (شاشات الأفلام وأدوات المحاكاة) تمنع قاموس الواجهة من
                // تعريب بنوده كما تمنعه في العقدة الوحيدة (keepRows، engine.js blockPass) — كان يُعرَّب منها ما في القاموس («Design» و«Copy» و«Plugins»…)
                bodies: true, bodySel: ACADEMY_BODY, bodyGuard: BODY_GUARD, bodyRejudge: true, blockLang: true, keepRows: true,
                // ★ (ر29-د2) حاوية المتن الرئيسة: المقالة لا قائمة «في هذه الصفحة». ولا صمّام هنا (لا bodyRoutes)، فتُفحص في بوابة بدء المرحلة وحدها
                // (قِيست في الدرس والدورة والدرس التعليمي بالعرضين: تطابق في الأربع، والقائمة في اثنتين)
                bodyMain: "article.mdx-article",
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
                dirSel: ACADEMY_DIR, skipSel: ACADEMY_SKIP + ", " + EDITOR_USER,
                // ★ (ر24-ج1) ما تبقيه الشركة من المستثنى (ACADEMY_KEEP)، وسائره محتوى مستخدم
                keepSel: ACADEMY_KEEP,
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
        meta: { scan: "llms", live: true, chat: false, iconMirror: true, hydrate: "defer", hydrateSignal: "idle", hydrateMaxMs: 20000, bodies: true, isoLabels: true,
                // ★ (ر6-د) حارس المتن المختلط بعتبة القرار 83 (BODY_GUARD أعلاه): يسري على ما لم يُترجم من متغيّر الوثائق عند الإصدار
                bodyGuard: BODY_GUARD,
                // ★ (S7-B، ٢١ ربيع الآخر ١٤٤٨هـ) مرجع الواجهة البرمجية (‎/docs/en/api/‎) مسارٌ كامل: كان هيكلًا فقط (shell) فيبقى ‎.stldocs-root‎
                // كلُّه إنجليزيًّا والصفحاتُ النثرية العشر تحته (overview وerrors وrate-limits…) بلا متون — والشركة تترجم فيه ما يسمّي
                // العملية ويصفها. وما تبقيه على أصله مستثنًى بمحدِّد (skipSel = STL_KEEP) لا يُترجم ولا يُحصد
                routes: { full: ["/docs/en/"] },
                // ★ (ر29-د) مسارات المتن لصمّام «nosel» (engine.js): كل صفحةٍ من الوثائق، والشرح ومرجع الواجهة البرمجية معًا.
                // ★ (مراجعة ر29-د) إلا الصفحة الرئيسة ‎/docs/en/home‎: بطاقاتٌ بلا متنٍ ولا فهرس، فلا يطابقها محدِّد المتن ولا الاتجاه اليوم (مقيسٌ في عيّنة
                // 94 صفحةً عامة من llms.txt: هي وحدها) — كانت تُحجز «nosel» فتخمد الإضافة في صفحةٍ تعرّب 2.0.0 واجهتها
                bodyRoutes: { full: ["/docs/en/"], shell: ["/docs/en/home/"] },
                // المتن والعنوان (.docs-prose) وبنود الفهرس، وجزر المرجع المترجَمة (STL_DIR) — كل كتلةٍ بحسب نصّها
                dirSel: ".docs-prose, nav li:has(> a[href^='#']), " + STL_DIR,
                bodySel: ".docs-prose, .stldocs-root, nav:has(li > a[href^='#'])",
                // ★ (ر29-د2، مراجعة ر29-د F4) حاوية المتن الرئيسة: نوعا المتن (الشرح ومرجع الواجهة البرمجية) وأيُّهما يكفي، لا فهرس الصفحة —
                // إن تغيّر ‎.docs-prose‎ بقي الفهرس يطابق فلم يكن الصمّام يحجز ولا البوابات تسقط
                bodyMain: ".docs-prose, .stldocs-root",
                // ★ (ر7-ب، ٣٠ ربيع الآخر ١٤٤٨هـ — الفحص الحيّ ر7، M2) لافتة «القسم الحالي» في الشريط اللاصق دون عرض xl («الصفحة / القسم»): نصُّها نصُّ
                // عنوانٍ من المتن، فتأخذ نصَّه المعروض بحال حارس المتن (engine.js echoText) لا قاموس الواجهة. واسم الصفحة قبلها (خارج ‎div.flex.min-w-0‎)
                // من قاموس الواجهة كما كان
                echoSel: "div.fixed.inset-x-0[class*='top-[calc(3.5rem'] div.flex.min-w-0 > button span.truncate",
                skipSel: STL_KEEP + ", " + EDITOR_USER,
                // ★ (ر24-ج1) العقد البرمجي كلُّه نصُّ الموقع تبقيه الشركة إنجليزيًّا (لا محتوى مستخدم في الوثائق): ذرّةٌ داخل التتابع لا رفضٌ له — فعنوان
                // بطاقة المثال بجوار شارة الطريقة يُعرَّب كما في 2.0.0، والشارة على أصلها حرفًا
                keepSel: STL_KEEP,
                // صفحات SDK في المرجع (‎/docs/en/api/python/messages/create‎ و‎…/http/…‎ وروابط المرجع الداخلية منها) قطعتُها قطعةُ الصفحة
                // القانونية: البادئات الثماني و«http» بديلُ الافتراضية (مقيسةٌ في الدراسة؛ وkotlin وterraform واسمٌ مختلَق 404 ليّنة)
                pageAlias: [{ re: "^(/docs/en/api)/(?:http|python|typescript|go|java|ruby|csharp|php|cli)(?=/)", to: "$1" }],
                fontFamilies: { anthropicSans: "ui", anthropicSerif: "read", anthropicMono: "mono" },
                // ★ (ر5ب) رفيقات «anthropicSans Fallback» وأخواتها: local(Arial) بواصفات حجمٍ (لقطة sitecss-docs) — بها «خط النظام» هنا
                fontFallback: "Arial",
                // «<الصفحة> - Claude Platform Docs»، وفي المرجع «<العملية> - Claude API Reference»
                titleSuffix: [" - Claude Platform Docs", " - Claude API Reference"] },
        // ★ (ر20-أ، ١٢ جمادى الأولى ١٤٤٨هـ) أصناف المسار في هذا المدخل: لوحة المطوّرين (Console) بقاموسها (CONSOLE_ROUTES أعلاه). خارج meta عمدًا: لا يُحقن
        // في dict-docs.js فيبقى قاموس الوثائق المبنيّ هو هو بايتًا بايتًا، ويقرؤه المحرّك والنافذة والبناء من هذا الجدول حيًّا (C.routeClass). وحال الصنف
        // status كحال النطاق: {upcoming: true} خاملٌ تمامًا في مساراته (المحرّك يحكم بها «inactive» كما اليوم: لا سمة ولا اتجاه ولا خط ولا عنوان ولا نصّ ولا
        // طلب)، وقاموسه يُبنى (ar-console.json ← dict-console.js) ولا يُحقن في المانيفست ما دام قادمًا. وCN1 يملأ ar-console.json ثم يبدّل status —
        // و‎verify-package‎ يرفض صنفًا مشحونًا قاموسُه لا يعرّب شيئًا أو لا يحمله المانيفست، والمحرّك لا يشغّل قاموس الصنف بعدُ (تبديل القاموس بالمسار
        // عند التنقّل بندٌ من CN1 الهندسي، انظر engine.js routeMode)
        classes: [{ id: "console", name: "لوحة المطوّرين (Console)", dict: "dict-console.js", status: { upcoming: true },
                    routes: CONSOLE_ROUTES,
                    meta: { skipSel: CONSOLE_USER + ", " + EDITOR_USER } }] },
      // ★ وثائق Claude Code (كانت Mintlify فوق Next.js — دراسة code-claude-docs.md §٨ ومراجعتها المستقلة، ١٣ ربيع الآخر ١٤٤٨هـ؛ وصارت بناء
      // Mintlify الجديد بلا Next.js — ر27-ب، ٢٠ جمادى الأولى ١٤٤٨هـ)
      { id: "code", name: "وثائق Claude Code", host: "code.claude.com", origin: "https://code.claude.com",
        matches: ["https://code.claude.com/docs*"], dict: "dict-code.js", allFrames: false,
        // ★ (ر8-د) المقالات في 3.0.0 (القرار 82: لم تُشحن متونها)
        status: { part: "الواجهة وحدها", en: "مقالات وثائق Claude Code" },
        // فهرس الصفحات تحت /docs صراحةً: نسخة الجذر (/llms.txt) خارج المطابقة ولا ضمان لبقائها (المراجعة ج-٤).
        // وسقف الترطيب 20 ث: قِيس ترطيب أثقل الصفحات بين 8.6 و14.6 ث (settings-reference وchangelog)، والسقف
        // العام 8 ث كان يكتب النصوص قبل الترطيب فيقع خطأ React ‎#418‎ ويُعاد رسم الصفحة كلها
        // ★ (ر27-ب، ٢٠ جمادى الأولى ١٤٤٨هـ — العيب D1 في الفحص الحيّ ر27) انتقل الموقع إلى بناء Mintlify الجديد (Vite وReact 19.2، بلا ‎_next‎ ولا
        // next-route-announcer)، فكانت كل صفحةٍ تبقى إنجليزيةً حتى السقف (20 ث) — وفي 2.0.0 المنشور كذلك. فالإشارة "attr" بسمة data-current-path:
        // يكتبها سكربتٌ مضمَّن أثناء التحليل، ثم يعيد مكوّن المسار كتابتها في إيداع ترطيب الجذر (قِيس بخطّاف إيداعات React على overview وquickstart
        // وhooks وsettings وchangelog بعرضَي 1366 و390، 63 تحميلًا: بلا الإضافة بين 0.6 و2.0 ث، وما بقي غير مرطَّبٍ فيه حدُّ Suspense واحدٌ فارغ، والترطيب كاملٌ
        // في الإيداع التالي) فتُفتح البوابة عندها. والسقف 20 ث باقٍ احتياطًا، وnext-route-announcer يبقى إشارةً إن عاد الموقع إلى Next.js
        meta: { scan: "llms", llms: "/docs/llms.txt", live: true, chat: false, iconMirror: true, hydrate: "defer", hydrateSignal: "attr",
                hydrateAttr: "data-current-path", hydrateMaxMs: 20000, bodies: true,
                // ★ (ر6-ب، ٢٩ ربيع الآخر ١٤٤٨هـ) حارس المتن المختلط: تغيّر الموقع بعد حصاد ١٤ ربيع الآخر ١٤٤٨هـ فصارت كتلٌ إنجليزية بين العربية في أكثر
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
                // ★ (ر29-د) مسارات المتن لصمّام «nosel» (engine.js): كل صفحةٍ كاملة من الوثائق (والجذر ‎/docs‎ وسجلّ الإصدارات ليسا منها)
                bodyRoutes: { full: ["/docs/en/"] },
                // المتن والرأس (العنوان والوصف) وبنود الفهرس — كل كتلة بحسب نصّها؛ ورابط «ما الجديد» (رابطٌ مستقلّ بسهمٍ بعده،
                // فاتجاهه بنصّه لا بسطره المختلط)؛ وأجوبة المساعد (#chat-content): الاتجاه وحده لكل كتلة، ونصُّها لا يُمسّ (skipSel)
                dirSel: "#content, #header, #table-of-contents li, #content .digest-feature-link, #chat-content",
                bodySel: "#content, #header, #table-of-contents",
                // ★ (ر29-د2، مراجعة ر29-د F4) حاوية المتن الرئيسة: ‎#content‎ وحده — إن تغيّر اسمه بقي الرأس والفهرس يطابقان
                bodyMain: "#content",
                // في مسار shell يبقى المتن على أصله LTR (code-point.css ببوابة data-cml-route)
                shellSel: "#content",
                // أجوبة المساعد المولَّدة (خدمة Mintlify) لا تُعرَّب ولا تُحصد؛ إطاره (الحقل والأزرار) خارجها فيُعرَّب
                skipSel: "#chat-content, " + EDITOR_USER,
                // Inter عائلة واجهةٍ ثانية في Mintlify (وجهان في الإقلاع)، وSerif Display للعناوين
                fontFamilies: { "Anthropic Sans": "ui", "Inter": "ui", "Anthropic Serif": "read", "Anthropic Serif Display": "read",
                                paperMono: "mono" },
                titleSuffix: [" - Claude Code Docs"] } },
      // ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) claude.com وسوقه (Next.js مع Sanity؛ دراسة ر14 §٧أ، والنطاق بافتراضات أسئلة المالك 15–17). المطابقة
      // المضيفُ كلّه: الموقع تطبيقٌ واحد يتنقّل بين أقسامه من جهة العميل، وحارس المسار يحصر العمل. ★ قادمٌ (status.upcoming): خاملٌ حتى يُشحن
      // قاموسه في CM-د (3.1.0 بالقرار 135)، ومطابقته يحجبها البناء عن مانيفست الحزمة منذ ر28-ب (السؤال 2 على افتراضه)، فلا يُعلَن مضيفه قبل ذلك
      { id: "com", name: "موقع Claude", host: "claude.com", origin: "https://claude.com",
        matches: ["https://claude.com/*"], dict: "dict-com.js", allFrames: false,
        status: { upcoming: true },
        // live: الأوراق كلها على المضيف نفسه (‎/_next/static/chunks/*.css‎، 4–16 لكل صفحة)، ولا <style> مضمَّنة ذات شأن فلا liveInline.
        // hydrate: كتابةٌ عند DOMContentLoaded أسقطت React في خطأ الترطيب في 20 من 20 تحميلًا، وعند ظهور next-route-announcer سليمةٌ في 20 من 20
        // (دراسة ر14 §٣ب) — فالإشارة الافتراضية بلا hydrateSignal ولا hydrateMaxMs. siteLang: الصفحات ‎/<locale>/…‎ تكتب لغتها في <html lang>
        meta: { scan: "none", live: true, chat: false, iconMirror: true, hydrate: "defer", siteLang: true,
                // ★ (ر16-ج، ٦ جمادى الأولى ١٤٤٨هـ) سقف أوراق الجولة: السقف العام 12 كان يرفض الورقة الحيّة في 53 من 492 صفحة قيست من قوالب الموقع كلها
                // (المسارات المترجمة بأعيانها وأربعٌ من كل بادئةٍ في الخريطة): الصفحة 4–8 أوراق أو 16، والموقع يُبقي أوراق الصفحات السابقة في التنقّل من
                // جهة العميل (23 بعد ستّ تنقّلات)، وأوراقه المختلفة على مضيفه في الصفحات كلها 42 (1.35 م.ب، دون سقف المجموع) — فلا تنقّل يتجاوزها.
                // فالسقف 48 (أوراق الموقع كلها وفسحةٌ لنموّها)، وسقفا الورقة الواحدة والمجموع بالبايت كما هما
                liveSheetsMax: 48,
                // أول بادئةٍ في routes.full («/marketplace/») لا تختصر الموقع
                siteLabel: "claude.com",
                // المتون بوضع الكتلة (المتن ‎main#main-content‎ في كل صفحةٍ إلا ‎/hard-questions‎ الخاملة)، والحارس بعتبة القرار 83
                bodies: true, bodyGuard: BODY_GUARD,
                // الصفحات المترجمة بأعيانها (COM_EXACT، مولَّدة)، ثم الهيكل (COM_SHELL)، ثم السوق كلّه (مترجمٌ عند الشركة كلّه، ونسخه المترجمة خارج
                // الخريطة). وما سواها خامل: ‎/<locale>/…‎، و‎/docs/‎ (Mintlify، إنجليزيٌّ عند الشركة)، و‎/code-with-claude/‎ والمفردات التي تحوّل
                // الشركة نسختها المترجمة إلى الإنجليزية (‎/check-files‎ و‎/fast-mode‎ و‎/hard-questions‎ و‎/marketplace-contact-sales‎)، وكل قسمٍ جديد
                routes: { exact: COM_EXACT, full: ["/marketplace/"], shell: COM_SHELL },
                // في مسار الهيكل يبقى المتن على أصله (لا تعريب ولا حصاد)؛ وبقاؤه LTR بقاعدةٍ في com-point.css ببوابة data-cml-route (ر16)
                shellSel: "main",
                dirSel: COM_DIR, bodySel: "main", skipSel: COM_SKIP,
                // ★ (ر24-ج1) لافتة الموافقة ومنتقي اللغة نصُّ الموقع تبقيه الشركة إنجليزيًّا
                keepSel: COM_SKIP,
                // أسماء @font-face في أوراق الموقع هي أسماء الوثائق القانونية نفسها، ورفيقات «… Fallback» local(Arial) (دراسة ر14 §٤ب)
                fontFamilies: { anthropicSans: "ui", anthropicSerif: "read", anthropicMono: "mono" }, fontFallback: "Arial",
                // «<العنوان> | Claude by Anthropic» في 2,221 صفحة، والشركة تبقي الذيل إنجليزيًّا في نسخها المترجمة كلها (دراسة ر14 §٢و)
                titleSuffix: [" | Claude by Anthropic"], titleKeep: ["Claude by Anthropic"] } },
      // ★ (ر20-ب، ١٢ جمادى الأولى ١٤٤٨هـ) بوابة Anthropic (portal.anthropic.com: التقدّم لبرامج الثقة، الجرد §٣-٥) — نطاقٌ تاسع **قادمٌ خامل** على نمط
      // claude.com في ر15: صفُّه هنا، ومطابقة مضيفه يحجبها البناء عن مانيفست الحزمة منذ ر28-ب (السؤال 2 على افتراضه)، فيأتي إذن المضيف مع الإصدار
      // الذي يحمل ترجمتها في CN2 (3.1.0 بالقرار 135؛ PLAN §٧ الخطر 3)، وقاموسٌ فارغ قادم (ar-portal.json ← dict-portal.js). فلا سمة ولا اتجاه ولا خط
      // ولا عنوان ولا نصّ ولا طلب شبكة في صفحاتها، ولا جواب لفحص، والنافذة وحدها تقول إنها قادمة (status.upcoming، كما في claude.com).
      // والمطابقة المضيفُ كلّه: البوابة تطبيق Next.js واحد (Turbopack)، وكل مسارٍ فيه من أسطحها؛ والعامّ منها بلا دخول أربع صفحات (‎/login‎ و‎/magic-link‎
      // و‎/sso-callback‎ و‎/logout‎) و‎/‎ يحوّل إلى ‎/login‎، وما سواها يحوّله الخادم إلى الدخول. فلا حارس مسارٍ بعد (routes غائبة = كامل)، وخريطة ما خلف
      // الدخول ★ لفحص المالك بحسابه (CN2-د). والبيانات أدناه تصميمٌ لـ CN2 لا يعمل اليوم: siteLang لأن الموقع يكتب لغة المتصفح في <html lang> ويقدّم
      // ترجمته (الجرد ت-12)، فالصفحة بلغةٍ غير الإنجليزية خاملة؛ وhydrate بالإشارة الافتراضية كتطبيقات Next.js الأخرى؛ وscan ‏none (لا فحص حزمٍ حتى
      // يُصمَّم لها في CN2)؛ وlive ‏false حتى تُلتقط أوراقها (لقطة sitecss-portal وورقة قلبها في CN2)، ولاحقة عنوانها تُقاس في CN2. وأسماء @font-face في
      // أوراق صفحة الدخول الأربع هي أسماء claude.com نفسها (anthropicSans وanthropicSerif وanthropicMono، ورفيقات «… Fallback» من local(Arial))، فإعداد
      // الخطوط إعداده — ولا يعمل اليوم: المحرّك يعود قبل وحدة الخط في النطاق القادم
      { id: "portal", name: "بوابة Anthropic", host: "portal.anthropic.com", origin: "https://portal.anthropic.com",
        matches: ["https://portal.anthropic.com/*"], dict: "dict-portal.js", allFrames: false,
        status: { upcoming: true },
        meta: { scan: "none", live: false, chat: false, hydrate: "defer", siteLang: true,
                siteLabel: "portal.anthropic.com",
                skipSel: PORTAL_USER + ", " + EDITOR_USER,
                fontFamilies: { anthropicSans: "ui", anthropicSerif: "read", anthropicMono: "mono" }, fontFallback: "Arial" } },
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
  // ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) نطاقٌ «قادم» (status.upcoming): خاملٌ في هذا البناء — يُقرأ الصفُّ حيًّا لا مرّةً عند التحميل، فالاختبار يبدّله
  C.upcoming = function (id) { var d = C.domain(id); return !!(d && d.status && d.status.upcoming); };
  // النطاقات المشحونة بترتيب الجدول: ما تعرضه الإعدادات والنافذة ويُعدّ في الترحيب وفي «حول»
  C.shipped = function () { return C.DOMAINS.filter(function (d) { return !(d.status && d.status.upcoming); }); };
  // ★ (ر20-أ، ١٢ جمادى الأولى ١٤٤٨هـ) أصناف المسار في نطاقٍ (لوحة المطوّرين في مدخل الوثائق): صنفُ مسارٍ ما أو null. الحكم بحارس المسار نفسه
  // (CMLShared.routeMode على routes الصنف: exact ثم full)، ويُقرأ الصفّ حيًّا كـC.upcoming. وبلا CMLShared (أداةٌ حمّلت الثوابت وحدها) فلا صنف
  C.routeClasses = function (id) { var d = C.domain(id); return (d && Array.isArray(d.classes)) ? d.classes : []; };
  C.routeClass = function (id, pathname) {
    var cs = C.routeClasses(id), S = g.CMLShared;
    if (!cs.length || !S || typeof S.routeMode !== "function") return null;
    for (var i = 0; i < cs.length; i++) if (cs[i].routes && S.routeMode(cs[i].routes, pathname) !== "inactive") return cs[i];
    return null;
  };
  C.classUpcoming = function (cls) { return !!(cls && cls.status && cls.status.upcoming); };
  // ★ (ر20-ج، ١٢ جمادى الأولى ١٤٤٨هـ) حقول المضيف في بيانات منظر الصنف (engine.js classMeta): الصنفُ والنطاقُ تطبيقٌ واحد بلا إعادة تحميل، فهذه من صفّ
  // النطاق وحده في المنظرين (الفحص وفهرسه، والورقة الحيّة وحدّها، والمحادثة، والترطيب، وحارس لغة الموقع، وIntercom، وعائلات الخط)، ولا يتجاوزها الصنف —
  // ثوابتُ يحسبها المحرّك مرّةً عند الإقلاع فتبقى هي هي إذا بُدّل المنظر. وسائر الحقول (محتوى المستخدم skipSel، وkeepSel، وdirSel، والمتون، والعنوان…)
  // من بيانات الصنف وحدها، ومساراتُ المنظر مساراتُ الصنف
  C.CLASS_HOST_META = ["scan", "llms", "live", "liveInline", "liveSheetsMax", "chat", "hydrate", "hydrateSignal", "hydrateAttr", "hydrateMaxMs",
                       "siteLang", "siteLangSel", "siteLangOk", "intercom", "fontFamilies", "fontPrepend", "fontFallback"];
  // أعداد قائمة claude.com المولَّدة (كتلة com-routes أعلاه): يفحص البناء أن القائمة بعددها، ويقرؤها الفحص الذاتي
  C.COM_EXACT_META = COM_EXACT_META;
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
  // ★ (ر15) أطول قائمة مساراتٍ بأعيانها تُسرد في جملة «يعمل في …» (الوثائق القانونية خمسة)؛ وما زاد عليها يُذكر بعدده
  var EXACT_LISTED_MAX = 10;
  // ★ (مراجعة ر15، ٦ جمادى الأولى ١٤٤٨هـ) المواقع المشحونة وحدها (C.shipped): النطاق القادم لا يُذكر في جمل القدرات — كانت جملة «تصحيحات الفقرات
  // تخصّ …» في إعدادات تطبيق Claude تذكر «موقع Claude» (له متون) وهو قادمٌ لا تعرضه الصفحة
  function listNames(pred) {
    var n = [], ds = C.shipped();
    for (var i = 0; i < ds.length; i++) if (pred(ds[i].meta || {})) n.push("«" + ds[i].name + "»");
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
      // ★ (ر15، ٦ جمادى الأولى ١٤٤٨هـ) وقائمةٌ طويلة بأعيانها (claude.com: ثلاثمئة مسارٍ ونيّف مولَّدة من خريطة الموقع) تُذكر بعددها لا بمساراتها
      var ex = m.routes.exact || [], many = ex.length > EXACT_LISTED_MAX;
      if (many) T("الصفحات التي تترجمها الشركة بأعيانها (" + String(ex.length).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + ")");
      (many ? [] : ex).map(function (p) { return [p, " بعينه"]; }).concat((m.routes.full || []).map(function (p) { return [p, ""]; }))
        .forEach(function (x, i) { if (i || many) T("، "); P(x[0]); if (x[1]) T(x[1]); });
      T(" كاملًا");
      if ((m.routes.shell || []).length) {
        T("، وفي ");
        m.routes.shell.forEach(function (p, i) { if (i) T("، "); P(p); });
        T(" هيكلُ الصفحة وحده");
      }
      T("، ولا يمسّ سائر صفحات المضيف");
      // ★ (ر20-أ، ١٢ جمادى الأولى ١٤٤٨هـ) وصنفُ مسارٍ قادم على المضيف نفسه (لوحة المطوّرين في «وثائق المطوّرين») يُذكر تحت موقعه بأنه قادم، بلا مفتاحٍ
      // ولا إعداد (كالنطاق القادم): الإعدادات تعرض هذه الجملة تحت الموقع. والصنف المشحون يُذكر بمساراته حين يُشحن (CN1)
      C.routeClasses(id).filter(C.classUpcoming).forEach(function (c) { T("؛ وتعريب «" + c.name + "» على المضيف نفسه قادمٌ في تحديثٍ لاحق"); });
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
