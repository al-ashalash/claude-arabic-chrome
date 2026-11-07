// manifest-entry.mjs — مدخل النطاق في المانيفست (content_scripts) من صفّه في جدول النطاقات (cml-const.js).
// مصدرٌ واحد يبني به build.mjs مانيفست الحزمة، ويضيف به rtl-audit مدخلَ النطاق القادم إلى نسخته المشغَّلة المؤقتة.
// ★ (ر28-ب، ٢٠ جمادى الأولى ١٤٤٨هـ — السؤال 2 على افتراضه، PLAN §٧ الخطر 3) مانيفست الحزمة يحمل مداخل النطاقات المشحونة وحدها: النطاق القادم
// (status.upcoming: claude.com وبوابة Anthropic) لا مدخل له، لأن مضيفًا جديدًا في تحديثٍ يجعل كروم يعطّل الإضافة عند المستخدم حتى يوافق على
// الإذن الجديد، والنطاق القادم لا يعمل فيه شيئًا. فيُعلن المضيف مع قاموسه في الإصدار الذي يشحنه (3.1.0)، وصفُّه وقاموسه وأوراقه باقيةٌ في الشجرة.
import fs from "node:fs";
import path from "node:path";

// ترتيب السكربتات إلزامي (الثوابت ثم المشترك ثم الاتجاه ثم التغطية للتطبيق ثم وحدة الخط ثم القاموس **قبل** المحرّك)، وأنماطها: base.css أولًا
// (يعلن الطبقات)، ثم لقطة الاتجاه إن وُجدت، ثم إصلاحات النطاق النقطية
export const SNAPSHOT = { app: "rtl-overrides.css", support: "rtl-intercom.css", privacy: "rtl-intercom.css", docs: "rtl-docs.css", code: "rtl-code.css",
  legal: "rtl-legal.css", academy: "rtl-academy.css", com: "rtl-com.css" };
export const POINT = { app: "app-point.css", support: "intercom-point.css", privacy: "intercom-point.css", docs: "docs-point.css", code: "code-point.css",
  legal: "legal-point.css", academy: "academy-point.css", com: "com-point.css" };

// C: جدول النطاقات المحمَّل (globalThis.CMLConst، أو جدول نسخةٍ مشغَّلة)؛ ext: مجلد الإضافة الذي تُطلب فيه الأوراق
export function contentScriptFor(domain, C, ext) {
  const js = ["cml-const.js", "cml-shared.js", "cml-rtl.js"];
  if (domain.id === "app") js.push("rtl-coverage.js");
  // وحدة الخط العربي بعد الاتجاه وقبل القاموس (DESIGN-fonts §٤.٣): يُنشئها المحرّك عند document_start فتركّب محفّزاتها
  // ★ (ر20-أ) وقاموس كل صنف مسارٍ مشحون بعد قاموس النطاق وقبل المحرّك؛ والقادم لا يُحقن (C.classUpcoming)
  js.push("cml-font.js", domain.dict, ...C.routeClasses(domain.id).filter((c) => !C.classUpcoming(c)).map((c) => c.dict), "engine.js");
  const css = ["base.css"];
  const snap = SNAPSHOT[domain.id];
  if (snap && fs.existsSync(path.join(ext, snap))) css.push(snap);
  // إصلاحات النطاق النقطية بعد لقطته: التطبيق، ومنصة Intercom لمركزي المساعدة والخصوصية، والوثائق، ووثائق Claude Code،
  // والوثائق القانونية (تنبيهها وغلاف الموقع LTR — ر3)، والأكاديمية (جزر المتون واللافتة والمنتقي LTR — ر4)، وclaude.com (مؤشر التبويبات
  // والأسهم والحركات ومتن الهيكل — ر16-أ؛ وكل قواعده خلف سمات المحرّك)
  const point = POINT[domain.id];
  if (point && fs.existsSync(path.join(ext, point))) css.push(point);
  const cs = { matches: domain.matches.slice(), js, css, run_at: "document_start", all_frames: !!domain.allFrames };
  if (domain.excludeMatches && domain.excludeMatches.length) cs.exclude_matches = domain.excludeMatches.slice();
  return cs;
}

// مداخل مانيفست الحزمة: النطاقات المشحونة وحدها، بترتيب الجدول
export function packageEntries(C, ext) {
  return C.DOMAINS.filter((d) => !C.upcoming(d.id)).map((d) => contentScriptFor(d, C, ext));
}
