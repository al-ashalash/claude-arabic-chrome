# سياسة الخصوصية — تعريب كلود (Claude) لنسخة الويب (غير رسمي)

**آخر تحديث: ٣٠ ربيع الآخر ١٤٤٨هـ (2026-10-11)، للإصدار 2.0.0**

## بالعربية

لا تجمع هذه الإضافة أي بيانات شخصية، **ولا تخزّن شيئًا مما يظهر على شاشتك ولا ترسله إلى أي
جهة**. تعمل بالكامل داخل متصفحك. الاستثناء الوحيد: إن فعّلتَ المزامنة الاختيارية (وهي متوقّفة
ما لم تُفعّلها) رُفعت تصحيحاتُك وقواعدُك وتصحيحات الفقرات — دون إعداداتك ودون شيءٍ من محتواك أو
محادثاتك — عبر مزامنة كروم إلى حسابك في جوجل، وتبقى لك أزرار إيقافها ومسح ما رُفع. (التفصيل في
قسم «المزامنة الاختيارية» أدناه.)

### أين تعمل

في مواقع Claude هذه وحدها، ولا تعمل في غيرها:

- تطبيق Claude: ‏`claude.ai` ونطاقاته الفرعية، عدا `assets.claude.ai` و`pivot.claude.ai` ومعاينات `*.livepreview.claude.ai`؛
- مركز المساعدة ومركز الخصوصية: صفحاتهما الإنجليزية تحت `support.claude.com/en/` و`privacy.claude.com/en/`؛
- الوثائق القانونية: خمس وثائق في `www.anthropic.com/legal/`، وما سواها من الموقع لا تمسّه؛
- أكاديمية Claude: ‏`academy.claude.com` بصفحاتها الإنجليزية؛
- وثائق المطوّرين: ‏`platform.claude.com/docs/en/`، ولا تمسّ لوحة المطوّرين (Console) على المضيف نفسه؛
- وثائق Claude Code: ‏`code.claude.com/docs`.

### كيف تعمل بالضبط — بلا تهويل ولا تهوين

لتترجم الإضافةُ نصًّا في الصفحة فلا بدّ أن **تطابقه** أولًا. فهي إذن **تقرأ** نصوص
الصفحة أثناء مرورها عليها، وتقارن كل نصّ بقواميس وترجماتٍ مضمَّنة داخل الإضافة نفسها: فإن وجدت له
ترجمةً كتبتها مكانه، وإلّا تركته كما هو ونسيته.

**والفرق الذي يعنيك:** القراءة **عابرة للمطابقة وحدها**. لا شيء مما يُقرأ يُخزَّن، ولا
يُراكَم، ولا يُرسَل — لا إلى تخزين، ولا إلى خادم، ولا إلى أي مكان. وما يُحفظ على جهازك هو
تفضيلاتُك التي تختارها والتصحيحاتُ التي تكتبها بنفسك، وما تبنيه الإضافة لعملها (انظر «الإذن الوحيد» أدناه).

ونقول هذا بدقّة لأن الوعد المتجاوِز أضعفُ من الوعد الدقيق: المشروع مفتوح المصدر، فكلُّ
سطرٍ هنا يمكنك التحقق منه بنفسك.

- **نصّ محادثاتك مستثنًى أصلًا:** الترجمة لا تلمس متن الرسائل إطلاقًا — لا رسائلك ولا ردود
  Claude. (انظر `inChatContent` في `engine.js`.) ومثلها أجوبة المساعد في وثائق Claude Code وفي الأكاديمية.
- **لا تحتفظ بشيء:** لا عناوين محادثاتك، ولا أسماء مشاريعك، ولا نصوص رسائلك، ولا أي شيء تراه.
- **لا تجمع بيانات ولا تستعين بخدمة خارجية:** كل ملفاتها مضمّنة محليًّا: القواميس، وترجمات
  المقالات (ملفٌّ لكل صفحة يُقرأ من الإضافة نفسها عند فتح صفحته)، والخطوط. والطلبات الشبكية التي
  تفتحها الإضافة ثلاثة، كلها تقصد **ملفات المواقع المذكورة العامة وحدها** — على أصل الصفحة
  نفسه، أو مضيفات Claude وAnthropic التي تحمّل منها هذه المواقع ملفاتها — **ولا يُرسَل في أيٍّ
  منها شيءٌ من عندك**، إنما تُقرأ ملفات الموقع كما يقرؤها متصفحك. (والمزامنة الاختيارية أدناه
  لا تفتح لها الإضافة اتصالًا أصلًا: المتصفح نفسه ينقلها ضمن مزامنة حسابك.)
- **الخط العربي محلي:** الخطوط التي تختار منها (من Google Fonts، وترخيصها SIL OFL 1.1) مضمَّنةٌ داخل
  الإضافة، ولا تطلب الإضافة شيئًا من Google ولا من غيرها لرسمها، و«خط النظام» يرسمه خطُّ جهازك نفسه.
  ويُنسخ الخط المختار وحده إلى تخزين متصفحك المحلي ليُرسم مع الصفحة من أول لحظة. والخط يغيّر شكل
  الحروف العربية المعروضة — ومنها ما في المحادثات وفي أجوبة مساعد وثائق Claude Code — دون أن يتطلّب
  ذلك قراءةَ النصّ أو حفظه أو إرساله.
- **الإذن الوحيد `storage`:** لحفظ تفضيلاتك (تشغيل/إيقاف لكل المواقع ولكل موقع، والاتجاه، والخط)
  وتصحيحاتك (الكلمات والقواعد وتصحيحات الفقرات) محليًّا على جهازك، ومعها ما تبنيه الإضافة لعملها:
  ورقة الاتجاه لكل موقع ونسخة الخط المختار (حتى 3 ميغابايت لهما معًا)، ونتائج الفحص. لا تُشارَك
  مع أي جهة إلا ما اخترته أنت في «المزامنة الاختيارية» أدناه. (وستعرض لك كروم عند التثبيت عبارتها
  المعيارية «قراءة بياناتك وتغييرها» على المواقع المذكورة، لأن الإضافة تكتب الترجمة داخل صفحاتها —
  ولا تطلب أي موقع آخر.)
- **(١) محرّك الاتجاه يقرأ ملفات التنسيق تلقائيًّا** في claude.ai والوثائق القانونية والأكاديمية
  ووثائق المطوّرين ووثائق Claude Code: المحرّك «الشامل» (الافتراضي) يأخذ عناوين ملفات التنسيق
  (CSS) التي حمّلها متصفحك للصفحة نفسها، ويقرؤها نصًّا عند أول تشغيل وعند كل تغيّر في نسخة
  الموقع، ليبني منها ورقة العكس ويحفظها على جهازك. لا يقرأ صفحتك ولا محتواك، ولا يُرسَل شيء.
  ويمكنك إيقاف هذه القراءة التلقائية باختيار المحرّك «المبسّط» في الإعدادات (ورقةٌ ثابتة مضمّنة).
  وفي مركزَي المساعدة والخصوصية يأتي الاتجاه من ورقةٍ مضمّنة وحدها.
- **(٢) «فحص الترجمة» يجري بضغطة منك وحدك:** ولا يقرأ إلا ملفات الموقع العامة — ملفات البرمجة
  التي ينزّلها متصفحك لعرض claude.ai، أو فهرس الصفحات العام (llms.txt) في وثائق المطوّرين ووثائق
  Claude Code — نصًّا ليستخرج منها عبارات الواجهة ويعرف ما لم يُترجَم بعد، ولا يُنفَّذ منها شيء.
  **لا يمسّ صفحتك ولا محتواك**، والنتيجة تبقى على جهازك.
- **(٣) «فحص الاتجاه» كذلك يجري بضغطة منك وحدك** في claude.ai: يقرأ ملفات التنسيق العامة نفسها
  ليكشف ما استجدّ منها ولا يعكسه محرّك الاتجاه بعد. والنتيجة تبقى على جهازك.

- **عند الإزالة:** يمحو المتصفح تلقائيًّا كل ما حُفظ محليًّا؛ لا يبقى شيء ولا يُرسَل شيء.
  (ما في مساحة المزامنة — إن كنت فعّلتها — يتبع حسابك لا جهازك؛ انظر القسم التالي.)

### المزامنة الاختيارية بين أجهزتك

الاستثناء الوحيد للقاعدة أعلاه: إن فعّلتَ المزامنة الاختيارية (وهي متوقّفة ما لم تُفعّلها) رُفعت
تصحيحاتُك وقواعدُك وتصحيحات الفقرات — دون إعداداتك ودون شيءٍ من محتواك أو محادثاتك — عبر مزامنة
كروم إلى حسابك في جوجل، وتبقى لك أزرار إيقافها ومسح ما رُفع. وتفصيل ذلك:

- **متوقّفة ما لم تُفعّلها**، ولا تُفعَّل إلا بموافقة صريحة من صفحة الإعدادات، بعد لوحةٍ تعرض
  عليك كلَّ ما يلي قبل الكتابة.
- **ما الذي يُرفع:** تصحيحاتُك التي كتبتها بنفسك وقواعدُك الذكية وتصحيحاتُ الفقرات — لا غير، ولكل
  موقعٍ مساحته. وتصحيحات الفقرات بأدنى أولوية: تأخذ ما يبقى من السعة، وما لا يسع يبقى على جهازك
  ويُرفع متى اتّسعت.
- **إلى أين:** بنية مزامنة كروم (`chrome.storage.sync`) المرتبطة بحسابك في جوجل. الإضافة
  نفسها لا تفتح أي اتصال شبكي؛ المتصفح هو من ينقل هذه البيانات ضمن مزامنة حسابك.
  **وجوجل قد تطّلع عليها ما لم تفعّل عبارة مرور المزامنة في كروم نفسه.**
- **ما لا يُرفع أبدًا:** إعداداتك (تبقى لكل جهاز على حدة)، ونتائج الفحص، وأي شيء يُقرأ
  من الصفحات.
- **التعطيل لا يمسح ما رُفع:** إيقاف المزامنة يوقف الرفع من جهازك ولا يمسّ ما في حسابك —
  ولذلك في صفحة الإعدادات زرٌّ مستقل «مسح ما رُفع من حسابك» يمحو بيانات الإضافة وحدها
  من مساحة المزامنة.
- **عند إزالة الإضافة:** ما في مساحة المزامنة قد يبقى في حسابك ويعود عند إعادة التثبيت —
  فإن أردت محوه يقينًا فاضغط «مسح ما رُفع من حسابك» قبل الإزالة.

### كيف أُنجزت الترجمة

بُنيت القواميس وتُرجمت المقالات بمعونة **Claude Code** (أداة Anthropic للبرمجة بالذكاء
الاصطناعي)، على قواعد مصطلحية ثابتة وضعها صاحب المشروع، ومصطلحاتها مُسنَدة إلى 33 معجمًا ومصدرًا
مذكورةٍ بجهاتها في صفحة «حول» داخل الإضافة. وتُرجمت المقالات دفعةً دفعة: لكل دفعةٍ مترجمٌ ثم مراجعٌ
منفصلٌ عنه ثم مدقّقٌ آلي. ونحن نصرّح بهذا لأن المستخدم من حقه أن يعرف كيف صُنع ما يقرؤه.

ومع ذلك تبقى في الترجمة أخطاء ولا بدّ. **ولهذا صُنع التصحيح الشخصي**: ما استُشكل عليك
صحّحه لنفسك في أي وقت، أو اقترحه للجميع على مستودع المشروع — فالمشروع مفتوح المصدر، والقواميس
كلها متاحة للقراءة والتدقيق.

الإضافة مستقلة وغير رسمية، وليست من إنتاج شركة Anthropic ولا تابعة لها. «Claude» و«Claude.ai»
علامتان تجاريتان لمالكهما. وترجمة الوثائق القانونية غير رسمية للاطلاع، والنص الإنجليزي هو المعتمد.

---

## In English

This extension collects no personal data, **stores nothing of what appears on your screen, and
sends nothing anywhere**. It runs entirely inside your browser. The one exception: if you enable
the optional cross-device sync (off by default), the corrections, smart rules and paragraph corrections
you wrote yourself — never your settings, and never any of your content or conversations — are carried
by Chrome's own sync to your Google account, and buttons to stop it and to wipe what was uploaded remain
yours. (Details in the "Optional sync" section below.)

### Where it runs

Only on these Claude sites, and nowhere else:

- the Claude app: `claude.ai` and its subdomains, except `assets.claude.ai`, `pivot.claude.ai` and `*.livepreview.claude.ai` previews;
- the Help Center and the Privacy Center: their English pages under `support.claude.com/en/` and `privacy.claude.com/en/`;
- the legal documents: five documents under `www.anthropic.com/legal/`; it leaves the rest of the site alone;
- Claude Academy: `academy.claude.com`, its English pages;
- the developer docs: `platform.claude.com/docs/en/`; it does not touch the developer Console on the same host;
- the Claude Code docs: `code.claude.com/docs`.

### Exactly how it works — stated precisely

To translate a string on the page, the extension must first **match** it. So yes: it reads text on
the page as it walks the DOM, comparing each string against dictionaries and translations bundled inside
the extension itself. If a translation exists, it writes it in place; if not, it leaves the text
alone and forgets it.

**The distinction that matters to you:** those reads are **transient and match-only**. Nothing
read from the page is stored, accumulated, or transmitted — not to storage, not to a server, not
anywhere. What is saved on your device is the preferences you choose and the corrections you type
yourself, plus what the extension builds to work (see "The only permission" below).

We state it this precisely because a claim that overreaches is weaker than an exact one: the
project is open source, so every line of this is yours to verify.

- **Conversation content is excluded outright:** translation never touches message prose — neither
  yours nor Claude's. (See `inChatContent` in `engine.js`.) The same goes for the assistant's answers in
  the Claude Code docs and the Academy.
- **It keeps nothing:** no chat titles, project names, message text, or anything else you see.
- **Collects no data and uses no external service:** all its files are bundled locally: the
  dictionaries, the article translations (one file per page, read from the extension itself when its page
  opens), and the fonts. The extension opens three kinds of network request, all of them for **the listed
  sites' own public files only** — on the page's own origin, or the Claude and Anthropic hosts these sites
  load their files from — and **nothing of yours is sent in any of them**; they read the site's files as
  your browser does. (The optional sync below opens no connection at all from the extension: the browser
  itself carries that data as part of your account's sync.)
- **The Arabic font is local:** the fonts you choose from (from Google Fonts, licensed under SIL OFL 1.1)
  ship inside the extension, and nothing is requested from Google or anyone else to draw them; «خط النظام»
  (the system font) is drawn by your device's own font. Only the chosen font is copied into your browser's
  local storage, so it applies as the page starts. The font changes how Arabic letters on screen are drawn,
  including in conversations and in the Claude Code docs assistant's answers, without this requiring
  that text to be read, stored or sent.
- **The only permission, `storage`,** saves your preferences (on/off for all sites and per site, direction,
  font) and your corrections (terms, rules and paragraph corrections) locally on your device, along with
  what the extension builds to work: the direction sheet for each site and the copy of the chosen font (up
  to 3 MB for both together), and scan results. Nothing is shared beyond what you yourself opt into under
  "Optional sync" below. (Chrome's install screen shows its standard "read and change your data" line for
  the listed sites because the extension writes translations into their pages; it asks for no other site.)
- **(1) The direction engine reads the site's stylesheets automatically** on claude.ai, the legal
  documents, the Academy, the developer docs and the Claude Code docs: the "comprehensive" engine (the
  default) takes the URLs of the CSS files your browser already loaded for the page and fetches them as text
  — on first run and whenever the site ships a new version — to build its mirroring sheet, which it caches
  on your device. It reads neither your page nor your content, and sends nothing. Choosing the "simplified"
  engine in the options turns this automatic read off (a fixed bundled sheet is used instead). On the help
  and privacy centers the direction comes from a bundled sheet only.
- **(2) The "translation scan" runs only when you press the button,** and reads only the site's public
  files — the JavaScript bundles your browser already downloads to render claude.ai, or the public page
  index (llms.txt) of the developer and Claude Code docs — as text, to extract interface strings and find
  those not translated yet; nothing fetched is ever executed. **It does not touch your page or your
  content**, and the result stays on your device.
- **(3) The "direction check" likewise runs only when you press it,** on claude.ai: it reads the same
  public CSS to find newly shipped rules the direction engine does not mirror yet. The result stays on your
  device.

- **On uninstall,** the browser automatically erases everything stored locally. (Data in the
  sync area — if you ever enabled sync — follows your account, not your device; see the next
  section.)

### Optional sync between your devices

The one exception to the rule above: if you enable the optional sync (off by default), the
corrections, smart rules and paragraph corrections you wrote yourself — never your settings, and never any
of your content or conversations — are carried by Chrome's own sync to your Google account, **which
Google may be able to read unless you set a sync passphrase in Chrome itself**; buttons to stop
it and to wipe what was uploaded remain yours. In detail:

- **Off by default.** It activates only after an explicit consent panel in the options page
  that states everything below before anything is written.
- **What is uploaded:** the corrections you typed yourself, your smart rules and your paragraph
  corrections — nothing else, in a separate space for each site. Paragraph corrections have the lowest
  priority: they take the room left over, and what does not fit stays on your device and is uploaded when
  there is room.
- **Where to:** Chrome's sync infrastructure (`chrome.storage.sync`), tied to your Google
  account. The extension itself opens no network connection; the browser carries this data as
  part of your account's sync. **Google may be able to read it unless you set a sync passphrase
  in Chrome itself.**
- **What is never uploaded:** your settings (they stay per device), scan results, and anything
  read from pages.
- **Turning sync off does not erase what was uploaded:** it only stops uploads from that
  device and leaves your account untouched — which is why a separate "wipe what was uploaded"
  button exists in the options page; it removes this extension's data alone from the sync area.
- **On uninstall,** data in the sync area may remain in your account and reappear on
  reinstall — press the wipe button first if you want it gone for certain.

### How the translation was made

The dictionaries were built and the articles translated with the help of **Claude Code** (Anthropic's
AI coding tool), following a fixed terminology rulebook set by the project's author, with terms resting on
33 lexicons and sources listed with their publishers on the extension's About page. The articles were
translated batch by batch: each batch by a translator, then a separate reviewer, then an automated
validator. We state this plainly because you deserve to know how what you read was made.

Errors nonetheless remain. **That is precisely why personal corrections exist**: fix anything that reads
wrong for yourself at any time, or propose it for everyone on the project's repository — the project
is open source and all the dictionaries are there to read and audit.

This is an independent, unofficial extension, not created by or affiliated with Anthropic.
"Claude" and "Claude.ai" are trademarks of their owner. The translations of the legal documents are
unofficial and for reference; the English text is authoritative.
