// addlang.mjs — register a new language and seed an empty dictionary from the
// English key set (so a translator just fills in the blanks).
// Usage: node addlang.mjs <code> [endonym] [englishName]
import fs from "node:fs";
import path from "node:path";
import { resolveDirection } from "./direction.mjs";
import { LANGUAGES_JSON, DICTS } from "./paths.mjs";

const code = process.argv[2];
if (!code) { console.error("Usage: node addlang.mjs <code> [endonym] [englishName]"); process.exit(1); }
const endonym = process.argv[3] || code;
const englishName = process.argv[4] || code;
const dir = resolveDirection(code);

// 1) update registry
const reg = JSON.parse(fs.readFileSync(LANGUAGES_JSON, "utf8"));
if (reg.languages.some((l) => l.code === code)) {
  console.log(`Language '${code}' already exists in languages.json — leaving it as is.`);
} else {
  reg.languages.push({ code, endonym, englishName, direction: dir, isBase: false, dictionary: `${code}.json`, enabled: true, note_ar: endonym, note_en: englishName + " — " + dir.toUpperCase() });
  fs.writeFileSync(LANGUAGES_JSON, JSON.stringify(reg, null, 2) + "\n", "utf8");
  console.log(`+ registered ${code} (${dir}) in languages.json`);
}

// 2) seed dictionary from Arabic key set (English side), empty translations
const seedPath = path.join(DICTS, `${code}.json`);
if (fs.existsSync(seedPath)) { console.log(`Dictionary ${seedPath} already exists — not overwriting.`); process.exit(0); }
const ar = JSON.parse(fs.readFileSync(path.join(DICTS, "ar.json"), "utf8"));
const strings = {}; Object.keys(ar.strings || {}).forEach((k) => { strings[k] = ""; });
const plurals = {}; Object.keys(ar.plurals || {}).forEach((k) => { plurals[k] = { plural: ar.plurals[k].plural, forms: [] }; });
const dict = {
  _meta: { language: code, direction: dir, languageNameEnglish: englishName, languageNameNative: endonym, sourceLanguage: "en", version: "1.0.0" },
  _guide: { ar: "أضِف الترجمة أمام كل نص إنجليزي داخل strings، ثم شغّل بناء الإضافة.", en: "Fill each translation in strings, then run the build." },
  strings, plurals, notes: ar.notes || {},
};
fs.mkdirSync(DICTS, { recursive: true });
fs.writeFileSync(seedPath, JSON.stringify(dict, null, 2) + "\n", "utf8");
console.log(`+ seeded ${Object.keys(strings).length} empty strings -> ${seedPath}`);
console.log(`\nNext: translate ${code}.json, then run the build to include it.`);
