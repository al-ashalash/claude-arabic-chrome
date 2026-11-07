# سجلّ الإصدارات — Changelog

## 3.0.0 — واجهة claude.ai بالعربية

### ما الجديد لك
- **واجهة تطبيق Claude (claude.ai):** قابلنا كتالوج نصوص الموقع الإنجليزي كله بقاموسنا، فتُرجم ما بقي فيها بالإنجليزية أو نصفَ
  مترجم: 3,257 عبارة في 13 جزءًا، منها 126 لواجهتي وثائق المطوّرين وClaude Code. ولكل جزءٍ مترجمٌ ثم مراجعٌ مستقل، ثم مرورٌ
  للاتساق، ثم تحريرٌ للنص كاملًا. ومنها كلماتٌ وعباراتٌ كانت تظهر بالإنجليزية في صفحة الإعدادات. وقبلها تُرجم بالطريقة نفسها ما أضافه
  الموقع إلى واجهته بعد 2.0.0، وهو 6,906 عبارات، ومنها Claude Security وجلسات Claude Code وإعدادات المؤسسة والموصّلات:
  - قاموسه 42,044 نصًّا (كان 34,459 في 2.0.0)، و9,353 قاعدةً للنصوص المتغيّرة (كانت 6,168)، و1,256 نصًّا بصيغ الجمع العربية
    (كانت 834)؛
  - وتترجم الإضافة اليوم 37,406 نصوص من 37,498 نصًّا بسيطًا في كتالوج الموقع، أي 99.75٪. ومن رسائله كلها، البسيطة والمركّبة
    (الجمع والاختيار والوسوم)، يبقى لفظٌ إنجليزي من المصدر وسط العربية في 196 رسالةً من 40,871؛
  - وأكثرُ رسائل العدد والاختيار التي كانت تخرج نصفَ إنجليزية، مثل «حذف 1 file»، صارت جملًا عربية تامة. ومنها الأعداد من 1,000
    فأكثر التي يكتبها الموقع بفاصلة الآلاف: كانت تبقى بالإنجليزية، فصارت بصيغة الجمع الصحيحة («12,345 ملفًّا»)؛
  - والتواريخ داخل الجمل بأسماء الأشهر العربية («أُنشئ في 14 مارس 2027»).
- **نافذة الخدمات القانونية في معرض المُخرَجات مترجمةٌ كلها:** أسماء بطاقاتها الاثنتين والثلاثين وعناوين معايناتها وأوصافها بالعربية،
  استثناءً من قاعدتنا في إبقاء ما تتركه الشركة بالإنجليزية، لأن الموقع يعرضها جزءًا من واجهته. وأُعيدت ترجمة النافذة كلها بعد
  تجربة النسخة التجريبية الثانية، 99 نصًّا، لئلا تكون حرفية: مترجمٌ ثم ناقدان مستقلان، قانونيٌّ ولغوي، ثم محرّرٌ يجمع، بالرجوع إلى
  الأنظمة ودليل الأسلوب. فصار عنوانها «المُخرَجات القانونية»، وصارت «مصفوفة المستندات» مكان «المراجعة الجدولية»، وجاءت الأسماء
  بلغة المهنة وأقصر، فيظهر أكثرها كاملًا في القائمة الضيقة. و«Ask legal» صارت «الاستفسارات القانونية» بعد أن كانت تظهر نصفَ مترجمة، وسطر الشريك
  لقارئ الشاشة «طُوِّر بالتعاون مع …». والاسم الذي يبقى إنجليزيًّا في قائمة البطاقات، كاسم الشريك تحت اسم البطاقة، يُقصّ من آخره لا
  من أوله، والوصف الذي يبقى إنجليزيًّا يُعرض من اليسار ونقطته في آخره. أما محتوى المُخرَج بعد فتحه، والمستند النموذجي في المعاينة،
  فيبقيان كما هما.
- **مصطلحٌ واحد، ولا عربيَّ وإنجليزيَّ معًا في واجهة تطبيق Claude:** حُسمت أسر المصطلحات قبل الترجمة بقواعد كتبها محلّلٌ وراجعها
  ناقدٌ مستقل، مثل «المُخرَجات» لـArtifacts و«المهارات» لـSkills وCowork بحروفه. ثم رُوجعت عليها 4,082 مدخلًا قائمًا في القاموس،
  فتغيّر منها 4,043. وكانت أسماء الميزات وبعض المصطلحات تُكتب بالعربية ثم بالإنجليزية بين قوسين، فصارت بالعربية وحدها في 362 نصًّا
  وقاعدة، فلا مصطلح عربيًّا مقرونًا بإنجليزيه في قاموس claude.ai. وما يكتبه الموقع اسمًا بحروفه بقي بحروفه، مثل Cowork وDispatch
  وBox. ويبقى القوس لما في نص الموقع نفسه، وللاختصار التقني عند أول ذكره. وصُحّحت رسائل حال الفرع التي كانت تُلصق كلمتين
  («للدفع، ومتأخر» لا «للدفعمتأخر»).
- **وثائق Claude Code:** انتقل الموقع إلى إطارٍ جديد من Mintlify، فصارت صفحاته تبقى إنجليزية نحو 20 ثانية قبل أن تُعرَّب. فصارت
  الإضافة تعرّبها حين يكتمل تحميل الإطار، في ثانيةٍ إلى أربع ثوانٍ على الصفحات الخفيفة.
- **قائمة الإضافة أخفّ:** نُقل منها «إضافة أو تصحيح ترجمة» إلى صفحة الإعدادات، وفيها التصحيح اليدوي في «إدارة قاموس التعريب»، وحلّ
  محلّه سطرٌ شامل يذكر أقسام صفحة الإعدادات العشرة بترتيبها فيها: «في الإعدادات: تشغيل التعريب، وتعريب كل موقع، والخط العربي،
  وفحص الترجمة، واتجاه الصفحة، وتصحيح قاموس التعريب واستيراده وتصديره، وتصحيحات فقرات المقالات، والمزامنة بين أجهزتك، وإعادة الضبط،
  ونبذة عن الإضافة والخصوصية». ويبقى «تصحيح فقرةٍ من المقالة» في القائمة كما كان.
- **الوثائق القانونية تعمل من جديد:** أعاد anthropic.com بناء صفحاته القانونية بعد صدور 2.0.0، فتعطّلت فيها الترجمة: ظهر النص
  الإنجليزي من اليمين، وعلامات الترقيم في غير موضعها. فصارت الإضافة تعرف متن الوثيقة دون الاعتماد على أسماءٍ يغيّرها الموقع، وفُحصت
  الوثائق حيًّا بعرض الحاسب وعرض الجوال. وتُرجمت واجهة قالبها الجديد: «الوثائق القانونية» و«تنزيل PDF» و«عرض سجل الإصدارات»،
  وسمات الوثيقة («تاريخ السريان» و«النوع» و«الجمهور» و«اللغة»)، وعناوين أقسامها الثلاثة والأربعين في شريط الأقسام وفهرسها. وتبقى
  ترويسة anthropic.com العامة ومنتقي لغة الوثيقة بالإنجليزية كما تُبقيهما الشركة.
- **لا تنبيه فوق الوثائق القانونية:** حُذف من فوق متن كل وثيقةٍ معرَّبة التنبيه «ترجمة غير رسمية للاطلاع، والنص الإنجليزي هو
  المعتمد». فالإضافة نفسها تقول إنها غير رسمية، ولا تُثبَّت إلا بطلبك، ولو بقي التنبيه هنا للزم مثله في كل صفحةٍ وواجهة. ويبقى المتن
  وتخطيط الصفحة كما كانا.
- **إن غيّر موقعٌ بنية صفحاته مرةً أخرى** فلم تعرف الإضافة متن الصفحة، تركتها كما يعرضها الموقع، بالإنجليزية ومن اليسار، بدل أن
  تقلبها وفيها نصٌّ مختلط؛ ويعود التعريب متى ظهر المتن.
- **مركز المساعدة ومركز الخصوصية:** تُرجم ما غيّره الموقعان في مقالاتهما بعد إعداد 2.0.0، وهو 268 مقطعًا، وعناوين القائمة الجانبية
  الجديدة في مركز المساعدة، مثل «خطط Pro وMax وUltra». فصار في الإضافة لمركز المساعدة 18,277 مقطعًا في 377 صفحةً، ولمركز الخصوصية
  887 مقطعًا في 58 صفحةً. ويظهر المتن العربي اليوم في 236 صفحةً من الأولى (62.6٪) و50 من الثانية (86.2٪)، وما غيّره
  الموقعان بعد الترجمة يبقى بالإنجليزية حتى تحديثٍ قادم (انظر «القيود المعروفة»).
- **أكاديمية Claude:** صارت الأسهم تنعكس مرةً واحدة، وكان بعضها ينعكس مرتين فيعود إلى اتجاهه الأول؛ ولم تعد الأيقونات داخل النص
  الإنجليزي تنقلب؛ وحُدّثت ورقة الاتجاه لأنماط الموقع الجديدة. وتُرجمت نصوص صفحتها الرئيسة الجديدة، ومنها «تعمّق في أحد المنتجات»
  ووصف بطاقة Claude Cowork.
- **«فحص الترجمة» بلا سقف:** كان يحفظ 4,000 سطرٍ ويُسقط ما بعدها بلا تنبيه، ويتخطّى النصوص الأطول من 300 حرف. فصار يقرأ النصوص
  كلها مهما طالت، ومنها الرسائل المكتوبة بين علامتي اقتباسٍ مائلتين، ويحكم على النص بأسطره كما تبحث عنه الإضافة في الصفحة، فلا يعدّ
  مترجمًا ما يظهر بالإنجليزية. و«أمر الترجمة» يحفظ النص ذا الأسطر ويعيده بأسطره عند الاستيراد.
- **تصحيحاتك بلا حدّ طول:** تُحفظ على جهازك مهما طالت، ولا يُرفع منها إلى المزامنة الاختيارية إلا ما يسعه حدّها.
- **النسخ بلا علاماتٍ خفية:** ما تنسخه من نصٍّ عرّبته الإضافة يصل إلى الحافظة بلا علامات الاتجاه الخفية التي أضافتها، نصًّا عاديًّا
  ونسخةَ HTML، وتبقى علامات الموقع في نصّه كما هي.
- **مراجعةٌ أمنية:** بحث باحثٌ في الإضافة عن أصناف الثغرات كلها، ثم أعاد مراجعٌ مستقل كل ملاحظةٍ بنفسه ليدحضها، فلم تثبت ثغرةٌ
  أمنية. وأُخذت منها أربع تقويات:
  - «فحص الاتجاه» وفحص الحزم يقرآن عبر https وحده، ولا يتبعان تحويلًا إلى عنوانٍ آخر؛
  - فحصٌ آليّ قبل كل إصدار يردّ أي طلب شبكةٍ في الإضافة لا يُسقط ملفات تعريف الارتباط؛
  - صفحة الخيارات تحوّل كل عددٍ مخزَّن تعرضه إلى عددٍ قبل كتابته، فلا يُعرض نصٌّ مخزَّن وسومًا؛
  - ونسخ التصحيحات يتخطّى المفاتيح `__proto__` و`constructor` و`prototype`.

### عند التحديث من 2.0.0
- لا يطلب كروم موافقةً جديدة: المواقع التي تعمل فيها الإضافة هي مواقع 2.0.0 نفسها، والإذن الوحيد `storage`.
- تبقى إعداداتك وتصحيحاتك كما هي. وإن صار في القاموس ترجمةٌ لنصٍّ صحّحته، عرضته لوحة «تصحيحاتك بعد تحديث الإضافة» في «إدارة
  قاموس التعريب»، ولا تحذف شيئًا إلا بأمرك.

### تحت الغطاء، باختصار
- أداةٌ تدمج رسائل الجمع والاختيار في القاموس بمدخلات المحرّك القائمة وأقسام العربية الست، دون تغييرٍ في المحرّك. وجُرّبت ذهابًا
  وإيابًا بمصدر المحرّك نفسه على 13,315 صيغة، فلم يبقَ اختلافٌ بلا تفسير.
- بواباتٌ جديدة قبل كل إصدار: صحة محدِّدات المتون في 12 صفحةً عامة، والمحدِّد الذي لا يطابق شيئًا صنفٌ عالٍ في فحص الاتجاه؛
  وبوابة الإنجليزية الجزئية على مخرجات القاموس كلها، ونزل خطّ أساسها من 1,273 حالة إلى 196؛ وبوابة طلبات الشبكة؛ وقياس تغطية
  كتالوج claude.ai، ولا يصدر إصدارٌ تنزل فيه.
- 71 صفحةً للاختبار بـ2,081 فحصًا، والاختبار الذاتي للأدوات 130 من 130، وفحصٌ حيّ بالإضافة المحمَّلة فعلًا بعرضين قبل
  الإصدار، وفحصٌ لكل صفحات المقالات المشحونة بحكم الإضافة نفسها.
- الإذن الوحيد ما زال `storage`، والإضافة لا تتصل بخادمٍ لها ولا بخدمة خارجية.

### القيود المعروفة
- لا تعرّب الملفات المرفقة والمنزَّلة، ولا الصفحات خارج المواقع المذكورة، ولا الصور والفيديو، ولا التعليمات البرمجية والأوامر، ولا
  الخصائص والنماذج في مرجع الواجهة البرمجية.
- نصّ المحادثات مع Claude مستثنًى من الترجمة أصلًا، ومعه محتوى المُخرَجات بعد فتحها، وأجوبة المساعد في وثائق Claude Code
  وفي الأكاديمية.
- متون دروس الأكاديمية، ومتون وثائق Claude Code، وسياسة الاستخدام في الوثائق القانونية، ليست في هذا الإصدار.
- ما أضافته المواقع أو غيّرته بعد إعداد هذا الإصدار يبقى بالإنجليزية حتى يصل تحديثٌ للإضافة. والمقالة التي تغيّر فيها أكثر من 5٪
  من مقاطعها يبقى متنها كلُّه بالإنجليزية والواجهة حوله عربية، وتقول قائمة الإضافة سبب ذلك. وفحصنا كل صفحات المقالات التي في
  الإضافة يوم ٢٦ جمادى الأولى ١٤٤٨هـ بالإضافة نفسها، فظهر المتن العربي في:
  - مركز المساعدة: 236 صفحةً من 377 (62.6٪)، ومن الباقية 129 غيّر الموقع متنها، و12 لم تعد فيه (نُقلت عشرٌ منها إلى claude.com)؛
  - مركز الخصوصية: 50 من 58 (86.2٪)؛
  - الوثائق القانونية: 4 من 4؛
  - وثائق المطوّرين: 263 من 624 (42.1٪)، منها 259 من 352 صفحةً في مرجع الواجهة البرمجية، و4 فقط من 272 صفحةً من صفحات
    الشرح، لأن الموقع نقّح أكثر نصوصها بعد ترجمتها، فتُعاد ترجمتها في تحديثٍ قادم.
- **المتصفحات**: كروم 120 فأحدث، وسائر متصفحات Chromium (إيدج، Brave، Opera). فايرفوكس غير مدعوم رسميًّا بعد.

### شكر
- **راجع OpenAI Codex كود الإصدار 2.0.0** في ثمانية بنود بتجاربها، وفي ملحقٍ من ست أفكار هندسية. فتحقّقنا من البنود وقيّمنا الأفكار،
  ونفّذ Claude في هذا الإصدار إصلاح سبعة بنود وأربعًا من الأفكار:
  - الكتلة التي فيها محتوى مستثنًى من المستخدم تُرفض كلها قبل قراءة نصّها، وزال سقف طول الكتلة (4,000 حرف) من مسارات المقالات؛
  - العنصر الذي يصير محتوى مستخدمٍ بتغيّر سمةٍ وحدها يعود نصّه كما كان، وحارس لغة الموقع يحكم بمصدر التغيير لا بقيمته؛
  - ترتيب قواعد CSS المتداخلة في ورقة الاتجاه صحيح، والجزر المعروضة من اليسار لا تُقلب فيها القيم الفيزيائية؛
  - وإطفاء «ضبط اتجاه نص المحادثة» لا يمحو اتجاهًا كتبه الموقع بعد الإضافة؛
  - ومن الأفكار: مسحٌ أقلّ لجذور كل دفعة، واختبار الهندسة المرآوية لمولّد الاتجاه، وحالاتٌ متقابلة لاختبار الاستثناءات، واختبار
    التركيز والتحديد.

### التثبيت
من [متجر Chrome](https://chromewebstore.google.com/detail/ilebkilcahbijffokjmlakbocdjkojbe) (تحديث تلقائي)، أو يدويًّا: `chrome://extensions` ← وضع المطوّر ← تحميل غير محزومة ← المجلد `extension/`.

---

## 3.0.0 — The claude.ai interface in Arabic

### What's new for you
- **The Claude app (claude.ai) interface:** we matched the site's whole English string catalogue against our dictionary and translated
  what was still in English or half translated: 3,257 strings in 13 parts, 126 of them for the developer docs and Claude Code
  interfaces. Each part went through a translator, then an independent reviewer, then a consistency pass, then an editorial pass over
  the whole text. Among them are words and phrases that still showed in English on the settings page. Before that, what the site
  added to its interface after 2.0.0 was translated the same way, 6,906 strings, among them Claude Security, Claude Code sessions,
  organization settings and connectors:
  - its dictionary has 42,044 strings (2.0.0: 34,459), 9,353 rules for variable text (2.0.0: 6,168), and 1,256 strings with Arabic
    plural forms (2.0.0: 834);
  - the extension now translates 37,406 of the 37,498 simple strings in the site's catalogue, 99.75%. Of all its messages, simple
    and compound (plural, choice and tagged), 196 of 40,871 still leave an English word of the source in the Arabic;
  - most count and choice messages that came out half in English, such as «حذف 1 file», are now whole Arabic sentences. This includes
    counts of 1,000 and above, which the site writes with a thousands separator: they stayed in English and now take the right Arabic
    plural form («12,345 ملفًّا»);
  - and dates inside sentences use the Arabic month names («أُنشئ في 14 مارس 2027»).
- **The legal-services window in the artifacts gallery is fully translated:** the names, preview titles and descriptions of its 32
  cards are in Arabic; an exception to our rule of keeping what the company leaves in English, because the site shows them as part of
  its interface. After the second test build the whole window, 99 strings, was translated again so that it does not read as a literal
  translation: a translator, then two independent critics, one legal and one linguistic, then an editor who settled their points,
  working from the regulations and the style guide. Its title is now «المُخرَجات القانونية», «مصفوفة المستندات» replaces
  «المراجعة الجدولية», and the names use the profession's own, shorter words, so most show in full in the narrow list.
  "Ask legal" is now «الاستفسارات القانونية» instead of appearing half translated, and the partner line for screen readers reads
  «طُوِّر بالتعاون مع …». A name that stays in English in the card list, such as the partner under a card's name, is cut at its end
  rather than its start, and a description that stays in English reads left to right with its period at the end. The content of an
  artifact, once opened, and the sample document in a preview are left as they are.
- **One term per meaning, and no Arabic and English side by side in the Claude app interface:** the term families were settled before
  translation in rules written by an analyst and checked by an independent critic, such as «المُخرَجات» for Artifacts, «المهارات» for
  Skills, and Cowork in Latin letters. Then 4,082 existing dictionary entries were reviewed against them, and 4,043 changed. Feature
  names and some terms used to be written in Arabic followed by the English in parentheses; they are now in Arabic alone in 362
  strings and rules, so no Arabic term is paired with its English one in the claude.ai dictionary, and the names the site writes in
  Latin letters stay so, such as Cowork, Dispatch and Box. A parenthesis stays where the site text has it, and for a technical
  abbreviation at its first mention. The branch-status messages that ran two words together now read with a separator.
- **Claude Code docs:** the site moved to a new Mintlify build, after which its pages stayed in English for about 20 seconds before
  being translated. The extension now translates them once the build has loaded, in one to four seconds on light pages.
- **A lighter extension menu:** «إضافة أو تصحيح ترجمة» moved from it to the options page, where the manual correction is in «إدارة
  قاموس التعريب», and in its place a line names all ten sections of the options page in their order there: «في الإعدادات: تشغيل
  التعريب، وتعريب كل موقع، والخط العربي، وفحص الترجمة، واتجاه الصفحة، وتصحيح قاموس التعريب واستيراده وتصديره، وتصحيحات فقرات
  المقالات، والمزامنة بين أجهزتك، وإعادة الضبط، ونبذة عن الإضافة والخصوصية». «تصحيح فقرةٍ من المقالة» stays in the menu as before.
- **The legal documents work again:** anthropic.com rebuilt its legal pages after 2.0.0 was released, which broke their translation:
  the English text showed right-aligned, with punctuation on the wrong side. The extension now finds a document's body without relying
  on names the site changes, and the documents were checked live at desktop and phone widths. The interface of the new template is
  translated: «الوثائق القانونية», «تنزيل PDF» and «عرض سجل الإصدارات», the document attributes («تاريخ السريان», «النوع», «الجمهور»
  and «اللغة»), and the titles of the 43 sections in the section bar and the contents list. The general anthropic.com header and the
  document's language selector stay in English, as the company keeps them.
- **No notice above the legal documents:** the notice «ترجمة غير رسمية للاطلاع، والنص الإنجليزي هو المعتمد» ("unofficial
  translation for reference; the English text is authoritative") is no longer drawn above each translated document. The extension
  itself says it is unofficial and is installed only at your request; keeping the notice here would call for one on every page and
  interface. The body and the page layout are otherwise unchanged.
- **If a site changes the structure of its pages again** and the extension cannot find a page's body, it leaves the page as the site
  shows it, in English and left to right, instead of mirroring it with mixed text; translation resumes once the body appears.
- **Help Center and Privacy Center:** what the two sites changed in their articles after 2.0.0 was prepared is translated, 268
  segments, together with the new titles in the Help Center sidebar, such as «خطط Pro وMax وUltra». The extension now holds 18,277
  segments on 377 pages for the Help Center and 887 segments on 58 pages for the Privacy Center. Today the Arabic body shows on 236
  of the first (62.6%) and 50 of the second (86.2%); what the sites changed after translation stays in English until a
  coming update (see Known limitations).
- **Claude Academy:** arrows now flip once (some flipped twice and so returned to their first direction); icons inside English text no
  longer flip; the direction sheet was updated for the site's new styles; and the texts of its new home page are translated, among
  them «تعمّق في أحد المنتجات» and the description of the Claude Cowork card.
- **No cap on the translation scan:** it kept 4,000 lines and silently dropped the rest, and skipped texts longer than 300 characters.
  It now reads every text however long, including messages written between backticks, and judges each text with its line breaks, as the
  extension looks it up on the page, so nothing shown in English counts as translated. The translation command keeps multi-line text
  and restores its line breaks on import.
- **No length limit on your corrections:** they are kept on your device however long they are; only what fits the optional sync's
  limit is uploaded to it.
- **Copying without hidden marks:** text the extension translated reaches the clipboard without the hidden direction marks it added,
  as plain text and as HTML; the site's own marks in its text are kept.
- **A security review:** a researcher searched the extension for every class of vulnerability, then an independent reviewer re-ran
  every finding to refute it, and no security vulnerability was confirmed. Four hardening changes came out of it:
  - the direction check and the bundle scan fetch over https only and follow no redirect to another address;
  - an automatic check before every release rejects any network request in the extension that does not omit cookies;
  - the options page converts every stored count it shows to a number before writing it, so no stored text can render as markup;
  - and copying corrections skips the keys `__proto__`, `constructor` and `prototype`.

### When updating from 2.0.0
- Chrome asks for no new approval: the extension runs on the same sites as 2.0.0, and its only permission is `storage`.
- Your settings and corrections stay as they are. If the dictionary now has a translation for a string you corrected, the «تصحيحاتك
  بعد تحديث الإضافة» panel in «إدارة قاموس التعريب» shows it, and deletes nothing unless you ask.

### Under the hood, briefly
- A tool merges plural and choice messages into the dictionary as the engine's existing entries, in Arabic's six plural categories,
  without changing the engine. It was tested round trip with the engine's own source on 13,315 forms, with no unexplained difference
  left.
- New gates before every release: the body selectors on 12 public pages, with a selector that matches nothing counted as a high class
  in the direction audit; the partial-English gate on all dictionary output, whose baseline went down from 1,273 cases to 196; the
  network-request gate; and the claude.ai catalogue coverage, which no release may lower.
- 71 test pages with 2,081 checks, the toolchain self-test at 130 of 130, a live check with the extension actually loaded,
  at two widths, before the release, and a check of every shipped article page by the extension's own verdict.
- The only permission is still `storage`, and the extension contacts no server of its own and no external service.

### Known limitations
- It does not translate attached or downloaded files, pages outside the sites above, images and video, code and commands, or the
  properties and models in the API reference.
- Conversation text with Claude is excluded from translation outright, as are the content of Artifacts once opened and the assistant's
  answers in the Claude Code docs and the Academy.
- Academy lesson bodies, the Claude Code docs bodies and the Usage Policy among the legal documents are not in this release.
- Anything the sites added or changed after this release was prepared stays in English until the extension is updated. An article
  with more than 5% of its segments changed keeps its whole body in English with the interface around it in Arabic, and the popup
  says why. We checked every article page the extension holds on 6 November 2026 with the extension itself, and the Arabic body
  showed on:
  - Help Center: 236 of 377 pages (62.6%); of the rest, the site changed the body of 129, and 12 are no longer on it (ten moved to
    claude.com);
  - Privacy Center: 50 of 58 (86.2%);
  - legal documents: 4 of 4;
  - developer docs: 263 of 624 (42.1%): 259 of the 352 API reference pages, and only 4 of the 272 explanation pages,
    because the site revised most of their text after translation; those will be translated again in a coming update.
- **Browsers**: Chrome 120 or later and other Chromium browsers (Edge, Brave, Opera). Firefox is not officially supported yet.

### Thanks
- **OpenAI Codex reviewed the 2.0.0 code** in eight findings with experiments, and in an addendum of six engineering ideas. We verified
  the findings and assessed the ideas, and in this release Claude implemented fixes for seven findings and four of the ideas:
  - a block that holds excluded user content is rejected whole before its text is read, and the block length cap (4,000 characters)
    is gone from the article paths;
  - an element that becomes user content through an attribute change alone gets its text back, and the site-language guard judges by
    the source of a change, not its value;
  - nested CSS rules keep their order in the direction sheet, and physical values are not mirrored inside left-to-right islands;
  - switching off «ضبط اتجاه نص المحادثة» no longer erases a direction the site wrote after the extension;
  - and from the ideas: a smaller scan of each batch's roots, a mirrored-geometry test for the direction generator, paired cases for
    testing exclusions, and a focus-and-selection test.

### Install
From the [Chrome Web Store](https://chromewebstore.google.com/detail/ilebkilcahbijffokjmlakbocdjkojbe) (automatic updates), or manually: `chrome://extensions` → Developer mode → Load unpacked → the `extension/` folder.

---

## 2.0.0 — مواقع Claude بالعربية

### ما الجديد لك
- **سبعة مواقع بدل موقعٍ واحد.** إلى جانب تطبيق Claude (claude.ai) أصبحت الإضافة تعرّب:
  - **مركز المساعدة** (support.claude.com) و**مركز الخصوصية** (privacy.claude.com): الواجهة والمقالات؛
  - **الوثائق القانونية** في anthropic.com/legal: سياسة الخصوصية، وسياسة الخصوصية لغير المستخدمين، وسياسة ملفات تعريف
    الارتباط، وشروط الخدمة للمستهلكين، وفوق كلٍّ منها تنبيه «ترجمة غير رسمية للاطلاع، والنص الإنجليزي هو المعتمد»؛
  - **أكاديمية Claude** (academy.claude.com): الواجهة وعناوين الدورات والدروس؛
  - **وثائق المطوّرين** (platform.claude.com/docs) ومرجع الواجهة البرمجية: الواجهة والمقالات؛
  - **وثائق Claude Code** (code.claude.com/docs): الواجهة.
- **ترجمة المقالات:** 40,818 مقطعًا (فقرةً أو عنوانًا أو بندًا أو خليةَ جدول) في 1,062 صفحةً، محفوظةٌ داخل الإضافة، تُقرأ ترجمة
  كل صفحةٍ وحدها عند فتحها. وفي المواقع الجديدة تبقى الصفحة مخفيّةً لحظةَ تحميلها حتى تُعرَّب ثم تظهر عربية، فلا تظهر
  الإنجليزية قبل العربية، إلا أن يتأخّر الموقع عن سقف الإمساك الزمني فتظهر الصفحة ثم تُعرَّب.
- **عناوين التبويب بالعربية** في المواقع كلها.
- **خطٌّ عربي تختاره** من قسم «الخط العربي» في الإعدادات: ثلاثة خطوط من Google Fonts مضمَّنة داخل الإضافة ومرتّبة بحسب طلبها
  فيها، وCairo، أكثرها طلبًا، افتراضيًّا. يُرسم به الحرف العربي وحده، فتبقى الحروف الإنجليزية والأرقام الغربية بخط الموقع، ولا
  يُطلب شيءٌ من الشبكة.
  - **إصلاح:** كان الإصدار 1.0.0 يفرض خط النظام على النص كله في بعض مواضع claude.ai، ومنه الحروف الإنجليزية؛ فأصبح التغيير
    مقصورًا على الحروف العربية.
  - **تغيّرٌ في المظهر:** تُرسم العربية بعد التحديث بخط Cairo بدل خط النظام. ولمن أراد خطوط الموقع نفسه دون خطٍّ مضاف «خط
    الموقع كما هو»، وفي مركزي المساعدة والخصوصية يرسم العربيةَ حينها خطُّ المتصفح القياسي. ولمن أراد الشكل السابق «خط النظام».
- **خيارات لكل موقع:** قائمة «الموقع» في رأس الإعدادات و«المواقع كلها» أولًا، ولكل موقعٍ مفتاح تعريبه ومحرّك اتجاهه
  وتصحيحاته وإعادة ضبطه. وفي النافذة مفتاحٌ لموقع التبويب المفتوح.
- **تصحيح فقرات المقالات:** حدّد نصًّا من فقرة، ثم «جلب الفقرة المحدّدة» من قائمة الإضافة، وعدّل ترجمتها لنفسك. وتُراجَع
  تصحيحاتك وتُحذف من قسم «تصحيحات فقرات المقالات» في الإعدادات، وتُزامَن مع المزامنة الاختيارية بأدنى أولوية.
- **فحص الترجمة لوثائق المطوّرين ووثائق Claude Code** من فهرس صفحاتهما العام (llms.txt)، إلى جانب فحص claude.ai.
- **claude.ai:**
  - قاموسه 34,457 نصًّا (كان 28,305)، و6,168 قاعدةً للنصوص المتغيّرة (كانت 3,356)، و834 نصًّا بصيغ الجمع العربية (كانت 10)؛
  - النصوص الطويلة تُعرَّب كغيرها، بلا سقف طول؛
  - أسماء محادثاتك ومشاريعك وجلساتك في الشريط الجانبي ورأس الصفحة، وأسماء المُخرَجات والملفات في حواراتها، تبقى كما كتبتها؛
  - تحيات الصفحة الرئيسية جملٌ عربية تامة؛
  - تخمد الإضافة إذا اخترت لواجهة claude.ai لغةً غير الإنجليزية، وتعود متى عدت إليها؛
  - لم تعد تقلب العروض المضمَّنة من assets.claude.ai في صفحات claude.com.
- **إصلاحاتٌ في الاتجاه:** الجداول العريضة في مركزَي المساعدة والخصوصية تتمرّر بدل أن تُقصّ، والأقواس حول الكلمات الإنجليزية في
  التسميات لا تنكسر، والأسهم تنقلب في الأكاديمية، وعناصر عربية كانت تُعرض من اليسار إلى اليمين أصبحت تُعرض من اليمين إلى اليسار.
- **الإطفاء يعيد الصفحة كما كانت:** ما عرّبته الإضافة يعود إنجليزيًّا، وما غيّره الموقع نفسه لا يُمسّ.
- **القواعد الذكية** تظهر مع تصحيحاتك وتُحذف منها، وتدخل في التصدير والاستيراد، فالنسخة الاحتياطية كاملة.

### عند التحديث من 1.0.0
- يطلب كروم موافقتك على المواقع الجديدة، ويوقف الإضافة حتى توافق من قائمة الإضافات أو من `chrome://extensions`.
- تبقى إعداداتك وتصحيحاتك كما هي، وتظهر لك بطاقة ترحيبٍ مرةً واحدة في الإعدادات.
- أصبح اسم الإضافة «تعريب كلود (Claude) لنسخة الويب (غير رسمي)»، واسمها المختصر «تعريب كلود» (كان «تعريب كلود للويب»).
- أصبح أدنى إصدارٍ مدعوم من Chrome هو 120 (كان 102).

### تحت الغطاء، باختصار
- قاموس واجهةٍ لكل موقع، وترجمةٌ لكل صفحة في ملفٍّ داخل الإضافة؛ وحارسُ مسارٍ يُبقي الإضافة خاملةً خارج الصفحات المقصودة،
  وحارسُ لغةٍ يُخمدها حين يعرض الموقع لغةً أخرى.
- حارسٌ للمتن المختلط في مواقع المقالات الخمسة كلها بعتبة 5٪: إن زاد ما غيّره الموقع في مقالةٍ بعد ترجمتها على 5٪ من مقاطعها
  أُبقي متنها إنجليزيًّا كلّه والواجهة حوله عربية، بدل أن تُخلط اللغتان؛ والصفحة التي لا ترجمة لمتنها في هذا الإصدار كذلك، إلا أن
  يغطّي قاموس الواجهة متنها (كبعض صفحات مرجع الواجهة البرمجية)، أو لا يكون فيها متن (كصفحات المجموعات). ويُحكم لكل صفحةٍ مرّةً قبل أن
  يُكتب في متنها شيء، وتقول قائمة الإضافة السبب.
- المزامنة الاختيارية أُعيد تصميمها: مساحةٌ مستقلة لكل موقع، وحكمٌ سببيّ بين الأجهزة، وما لا تسعه مساحة كروم يبقى على جهازك
  بلا فقدٍ ويُرفع متى اتّسعت.
- ورقة الاتجاه الحيّة تُبنى في عامل الخدمة بثلث العمل، وتُقبل كاملةً أو لا تُقبل.
- بواباتٌ قبل كل إصدار: الشمول، والبناء طازج، والدخان بالإضافة المحمَّلة فعلًا، وفحص الاتجاه بخط أساس؛ و39 صفحةً للاختبار.
- الإذن الوحيد ما زال `storage`، والإضافة لا تتصل بخادمٍ لها ولا بخدمة خارجية.

### القيود المعروفة
- لا تعرّب الملفات المرفقة والمنزَّلة، ولا الصفحات خارج المواقع المذكورة، ولا الصور والفيديو، ولا التعليمات البرمجية والأوامر، ولا
  الخصائص والنماذج في مرجع الواجهة البرمجية.
- نصّ المحادثات مع Claude مستثنًى من الترجمة أصلًا، ومعه محتوى المُخرَجات (Artifacts)، وأجوبة المساعد في وثائق Claude Code وفي
  الأكاديمية.
- متون دروس الأكاديمية ومتون وثائق Claude Code ليست في هذا الإصدار.
- ما تتركه الشركة بالإنجليزية في ترجماتها لمواقعها يبقى بالإنجليزية هنا أيضًا، وأسماء أزرار وحدة التحكم (Console) في المقالات
  بالإنجليزية كما تظهر على شاشتها.
- المقالات مترجمةٌ من نسخة الموقع وقت إعداد هذا الإصدار، فما غيّره الموقع أو أضافه بعده يبقى بالإنجليزية حتى يصل تحديثٌ للإضافة؛
  والمقالة التي كثر فيها التغيير، أو لا ترجمة لها في هذا الإصدار، يبقى متنها كلُّه بالإنجليزية والواجهة حوله عربية، وتقول قائمة
  الإضافة سبب ذلك. ولم يجرِ التحرير على مستوى المقالة لوثائق المطوّرين بعد.
- **المتصفحات**: كروم 120 فأحدث، وسائر متصفحات Chromium (إيدج، Brave، Opera). فايرفوكس غير مدعوم رسميًّا بعد.

### شكر
- **راجع الخطة والكود OpenAI Codex:** راجع خطة هذا الإصدار وكودَ الإصدار 1.0.0 المنشور في ثلاثين بندًا بتجاربها وقياساتها،
  فأثبت علّاتٍ في المزامنة ومحرّك الاتجاه والاستعادة عند الإطفاء، واقترح علاجها وضوابط لترجمة المقالات وأدوات الاختبار.
  وتحقّقنا من بنوده كلها فقبلناها، ونفّذها Claude.

### التثبيت
من [متجر Chrome](https://chromewebstore.google.com/detail/ilebkilcahbijffokjmlakbocdjkojbe) (تحديث تلقائي)، أو يدويًّا: `chrome://extensions` ← وضع المطوّر ← تحميل غير محزومة ← المجلد `extension/`.

---

## 2.0.0 — Claude's websites in Arabic

### What's new for you
- **Seven sites instead of one.** Besides the Claude app (claude.ai), the extension now translates:
  - the **Help Center** (support.claude.com) and the **Privacy Center** (privacy.claude.com): interface and articles;
  - the **legal documents** on anthropic.com/legal: the Privacy Policy, the Non-User Privacy Policy, the Cookie Policy and the
    Consumer Terms of Service, each headed «ترجمة غير رسمية للاطلاع، والنص الإنجليزي هو المعتمد» ("unofficial translation for
    reference; the English text is authoritative");
  - **Claude Academy** (academy.claude.com): interface and course and lesson titles;
  - the **developer docs** (platform.claude.com/docs) and the API reference: interface and articles;
  - the **Claude Code docs** (code.claude.com/docs): interface.
- **Article translation:** 40,818 segments (paragraphs, headings, list items or table cells) on 1,062 pages, bundled inside the
  extension; each page's translation is read alone when the page opens. On the new sites the page stays hidden for a moment while
  it loads, until it is translated, then appears in Arabic, so English does not show first — unless the site is slower than
  the hold's time cap, in which case the page shows and is then translated.
- **Tab titles in Arabic** on every site.
- **An Arabic font of your choice**, under «الخط العربي» in the options: three Google Fonts bundled inside the extension, ordered by
  how often they are requested there, with Cairo, the most requested, as the default. It draws Arabic letters only, so English
  letters and Western digits keep the site's font, and nothing is requested from the network.
  - **Fix:** 1.0.0 forced the system font on all text in some places on claude.ai, English letters included; the change is now
    limited to Arabic letters.
  - **Change in appearance:** after the update Arabic is drawn in Cairo instead of the system font. For the sites' own fonts with
    nothing added there is «خط الموقع كما هو» (on the help and privacy centers Arabic is then drawn by the browser's standard
    font); for the previous look, «خط النظام».
- **Per-site options:** a «الموقع» list at the top of the options, with "all sites" first, and for each site its own translation
  switch, direction engine, corrections and reset. The popup has a switch for the open tab's site.
- **Article paragraph corrections:** select text in a paragraph, choose «جلب الفقرة المحدّدة» in the popup, and correct its
  translation for yourself. Review or delete your corrections in the options; they sync, with the optional sync, at the lowest
  priority.
- **Translation scan for the developer and Claude Code docs**, from their public page index (llms.txt), alongside the claude.ai scan.
- **claude.ai:**
  - its dictionary has 34,457 strings (1.0.0: 28,305), 6,168 rules for variable text (1.0.0: 3,356), and 834 strings with Arabic
    plural forms (1.0.0: 10);
  - long texts are translated like any other, with no length cap;
  - the names of your chats, projects and sessions in the sidebar and page header, and of artifacts and files in their dialogs,
    stay as you wrote them;
  - home-page greetings are complete Arabic sentences;
  - the extension goes dormant when you set claude.ai's interface to a language other than English, and comes back when you
    return to English;
  - it no longer flips the assets.claude.ai demos embedded in claude.com pages.
- **Direction fixes:** wide tables on the help and privacy centers scroll instead of being clipped, parentheses around English
  words in labels no longer break, arrows flip on the Academy, and Arabic items that showed left-to-right now show
  right-to-left.
- **Switching off restores the page:** what the extension translated goes back to English, and what the site itself changed is
  left alone.
- **Smart rules** appear alongside your corrections and can be deleted there, and they are included in export and import, so a
  backup is complete.

### When updating from 1.0.0
- Chrome asks you to approve the new sites and keeps the extension off until you do, from the extensions menu or
  `chrome://extensions`.
- Your settings and corrections stay as they are, and a one-time welcome card appears in the options.
- The minimum supported Chrome version is now 120 (it was 102).

### Under the hood, briefly
- An interface dictionary per site and a translation file per page inside the extension; a route guard keeps the extension
  dormant outside the intended pages, and a language guard makes it dormant when a site shows another language.
- A mixed-body guard on all five article sites, at 5%: when more than 5% of an article's segments changed on the site after it was
  translated, its body is kept wholly in English with the interface around it in Arabic, rather than mixing the two languages; a page
  with no translation in this release is treated the same, unless the interface dictionary covers its body (as on some API reference
  pages) or it has no body (as on collection pages). Each page is judged once, before anything is written into its body, and the
  popup says why.
- The optional sync was redesigned: a separate space per site, causal ordering between devices, and anything Chrome's sync space
  cannot hold stays on your device without loss and is uploaded when there is room.
- The live direction sheet is built in the service worker with a third of the work, and is accepted whole or not at all.
- Gates before every release: coverage, a fresh build, a smoke test with the extension actually loaded, and the direction audit
  against a baseline; 39 test pages.
- The only permission is still `storage`, and the extension contacts no server of its own and no external service.

### Known limitations
- It does not translate attached or downloaded files, pages outside the sites above, images and video, code and commands, or the
  properties and models in the API reference.
- Conversation text with Claude is excluded from translation outright, as are the content of Artifacts and the assistant's answers
  in the Claude Code docs and the Academy.
- Academy lesson bodies and the Claude Code docs bodies are not in this release.
- What the company leaves in English in its own translations of its sites stays in English here too; Console button names in
  articles stay in English, as they appear on that screen.
- The articles were translated from the sites as they were when this release was prepared; anything a site changes or adds later
  stays in English until the extension is updated, and an article with many changes, or with no translation in this release, keeps
  its whole body in English with the interface around it in Arabic; the popup says why. The developer docs have not had the
  article-level editorial pass yet.
- **Browsers**: Chrome 120 or later and other Chromium browsers (Edge, Brave, Opera). Firefox is not officially supported yet.

### Thanks
- **OpenAI Codex reviewed the plan and the code:** it reviewed this release's plan and the published 1.0.0 code in thirty
  findings with experiments and measurements, proving bugs in sync, the direction engine and restoring pages on switch-off, and
  proposing fixes and safeguards for article translation and the test tooling. We verified every finding and accepted all thirty;
  Claude implemented them.

### Install
From the [Chrome Web Store](https://chromewebstore.google.com/detail/ilebkilcahbijffokjmlakbocdjkojbe) (automatic updates), or manually: `chrome://extensions` → Developer mode → Load unpacked → the `extension/` folder.

---

## 1.0.0 — الإصدار الأول

### ما تفعله الإضافة
- **ترجمة واجهة claude.ai** بقاموس فيه أكثر من 28,300 مفردة يغطي نحو 96% من نصوص الموقع،
  وأكثر من 3,300 قاعدة ذكية للنصوص المتغيّرة، وصيغ الجمع العربية الست. المصطلحات مُسنَدة إلى
  معجم البيانات والذكاء الاصطناعي (مجمع الملك سلمان العالمي للغة العربية وسدايا، الإصدار الثالث).
- **الاتجاه من اليمين إلى اليسار** بمحرّكين: «الشامل» (الافتراضي) يبني ورقة العكس من ملفات تصميم
  الموقع نفسها ويعيد بناءها كلما تغيّرت نسخته، و«المبسّط» ورقة ثابتة مضمّنة للطوارئ. اتجاه مستقل
  لكل فقرة في المحادثة، والتعليمات البرمجية تبقى من اليسار.
- **تصحيحاتك الشخصية** تعلو على القاموس وتُطبَّق فورًا، مع بحث في القاموس كله وتصدير واستيراد.
- **فحص الموقع** و**فحص الاتجاه** بضغطة منك: يُظهران ما استُجدّ في الموقع ولم يُترجَم أو لم يُعكس بعد.
- **مزامنة اختيارية** بين أجهزتك عبر مزامنة كروم نفسها — متوقّفة ما لم تُفعّلها.

### القيود المعروفة
- نحو 4% من نصوص الموقع لا تُترجَم عمدًا أو تعذّر تعميمها: أسماء منتجات ومعرّفات وقيم متغيّرة
  وحدها، ونصوص متغيّرة قصيرة جدًّا لا تصلح قاعدةً آمنة.
- الترجمة الآلية المدقَّقة ليست معصومة — وُجد «التصحيح الشخصي» لهذا، والمسائل على GitHub مرحّب بها.
- **المتصفحات**: كروم وسائر متصفحات Chromium (إيدج، Brave، Opera). فايرفوكس غير مدعوم رسميًّا بعد (نسخة تجريبية للمطوّرين في README).
- نصّ محادثاتك مستثنًى من الترجمة أصلًا؛ ولا تترجم الإضافة محتوى المُخرَجات (Artifacts).

### التثبيت
من [متجر Chrome](https://chromewebstore.google.com/detail/ilebkilcahbijffokjmlakbocdjkojbe) (تحديث تلقائي)، أو يدويًّا: `chrome://extensions` ← وضع المطوّر ← تحميل غير محزومة ← المجلد `extension/`.

---

## 1.0.0 — First release

### What it does
- **Translates the claude.ai interface** with a dictionary of 28,300+ strings covering about 96% of
  the site's text, 3,300+ smart rules for variable strings, and the six Arabic plural forms. AI
  terminology is anchored to the Data & AI Glossary (King Salman Global Academy for Arabic Language
  and SDAIA, 3rd edition).
- **Right-to-left layout** with two engines: "comprehensive" (default) builds its mirroring sheet
  from the site's own stylesheets and rebuilds it whenever the site ships a new version;
  "simplified" is a fixed bundled sheet for emergencies. Per-paragraph direction inside chats; code
  stays left-to-right.
- **Personal corrections** override the dictionary and apply immediately, with full-dictionary
  search, export and import.
- **Site scan** and **direction check**, on your click: show what the site added that is not yet
  translated or mirrored.
- **Optional sync** across your devices through Chrome's own sync — off unless you turn it on.

### Known limitations
- About 4% of the site's strings are deliberately untranslated or could not be generalized: product
  names, identifiers, bare variable values, and very short variable strings that would not make a
  safe rule.
- Reviewed machine translation is not infallible — that is what personal corrections are for, and
  issues on GitHub are welcome.
- **Browsers**: Chrome and other Chromium browsers (Edge, Brave, Opera). Firefox is not officially
  supported yet (a developer-only build is described in the README).
- Conversation text is excluded from translation by design; the extension does not translate the
  content of Artifacts.

### Install
From the [Chrome Web Store](https://chromewebstore.google.com/detail/ilebkilcahbijffokjmlakbocdjkojbe) (automatic updates), or manually: `chrome://extensions` → Developer mode → Load unpacked → the `extension/` folder.
