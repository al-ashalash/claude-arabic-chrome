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
      SYNC_META: "cml_syncmeta",          // sync: {v,rev,at,device,count,hash,chunks} — يُكتب آخِرًا
      SYNC_CHUNK_PREFIX: "cml_syncd_",    // sync: بادئة مفاتيح الشرائح cml_syncd_0..N
      // مفاتيح بناءات ما قبل النشر — تُحذف عند الإقلاع ولا تُستعمل
      LEGACY_COLLECT: "cml_collect",
      LEGACY_COLLECTED: "cml_collected",
    },

    // القائمة التي تحذفها «إعادة الضبط» — تُشتق من الأسماء أعلاه فلا تنحرف عنها.
    // مفاتيح المزامنة المحلية فيها (فيُطفأ العلم وتُمحى الدفاتر)، أما مفاتيح السحابة
    // (cml_syncmeta والشرائح) فليست فيها عمدًا: «إعادة الضبط» محلية بالعقد،
    // وزرُّ المحو في صفحة الإعدادات هو من يتولى الطرف البعيد
    RESET_KEYS: [
      "cml_enabled", "cml_rtl", "cml_chatrtl", "cml_overrides", "cml_user_patterns",
      "cml_scan_request", "cml_scan_result", "cml_scan_cancel", "cml_scan_claim",
      "cml_recon_dismissed", "cml_bad_rules",
      "cml_rtl_engine", "cml_rtldoc_request", "cml_rtldoc_result", "cml_rtl_live",
      "cml_sync_enabled", "cml_sync_tombs", "cml_sync_lasthash",
      "cml_sync_device", "cml_sync_state", "cml_sync_pending", "cml_sync_dirty",
    ],
    UNUSED_KEYS: ["cml_collect", "cml_collected"],

    // ---- منفذ التحكيم (المرحلة ٤): اسم قناة runtime بين المحرك وعامل الخدمة ----
    PORT_CRAWL: "cml-crawl",

    // ---- عتبات المحرك ----
    TEXT_MAX: 300,          // أقصى طول نص يُترجم (عقد النص والسمات وسكربت الفحص سواء)
    PEND_MAX: 2000,         // سقف طابور الطفرات قبل التحول لمرور كامل
    LOOKUP_CACHE_MAX: 5000, // سقف ذاكرة نتائج البحث

    // ---- عتبات الفحص ----
    CLAIM_STALE_MS: 90000,  // حجز أقدم من هذا متروك (يطابقه startScan وclaimScan حكمًا)
    SCAN_CAP: 4000,         // أقصى ما يُخزَّن من غير المترجَم (القائمتان تُقصان، العدّ يصدق)
    RTLDOC_CAP: 500,        // أقصى ما يُخزَّن من إعلانات فيزيائية غير مغطاة (العدّ يصدق)
    // سقفُ ورقة المحرّك الحيّ المخزَّنة (الحاليّ ~400ك.ب؛ ما تجاوز هذا لقطةٌ شاذّة لا تُخزَّن)
    RTL_LIVE_MAX_BYTES: 2 * 1024 * 1024,
    RTL_LIVE_SHEETS_MAX: 12, // أقصى عدد أوراق تُجلب في الجولة الواحدة
    SCAN_PARALLEL: 6,       // توازي الجلب — لا يزاحم بث المحادثة على الاتصال نفسه
    HEARTBEAT_STALL_MS: 45000, // نبض أقدم من هذا في «جارٍ» = فحص متعثر

    // ---- سقوف الاستيراد ----
    IMPORT_MAX_BYTES: 5 * 1024 * 1024,
    IMPORT_MAX_TERMS: 20000,
    IMPORT_MAX_RULES: 2000,

    // ---- عتبات المزامنة (حصص chrome.storage.sync الحقيقية: 8192 بايت للعنصر،
    //      102400 للمجموع، 512 عنصرًا، وسقفُ كتابات بالدقيقة — فالأرقام دونها بهامش) ----
    SYNC_ITEM_BYTES: 7500,          // سقف (مفتاح + قيمة JSON) للشريحة الواحدة، بايتات UTF-8
    SYNC_TOTAL_BYTES: 92000,        // سقف مجموع اللقطة (الشرائح + الميتا)
    SYNC_TOMB_MAX: 200,             // سقف شواهد الحذف — الأقدم يُسقَط أولًا
    SYNC_TOMB_TTL_MS: 30 * 24 * 3600 * 1000, // عمر الشاهد: شهر ثم يُنسى (الحذف بلغ الجميع)
    // لقطةٌ طابعُها أبعدَ من هذا في المستقبل = ساعةُ جهازٍ منحرفة: لا تُؤتمن على
    // الحذف بالغياب (وإلا محت تصحيحات الجهاز السليم في كل دمج)
    SYNC_SKEW_TOLERANCE_MS: 5 * 60 * 1000,
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
  };
  g.CMLConst = C;
})(typeof globalThis !== "undefined" ? globalThis : this);
