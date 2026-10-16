# سجلّ الإصدارات — Changelog

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
