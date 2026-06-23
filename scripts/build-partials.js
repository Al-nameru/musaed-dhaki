#!/usr/bin/env node
/**
 * build-partials.js
 *
 * يحوّل كل ملفات src/partials/*.html تلقائياً
 * إلى ملفات src/partialsContent/*.js بصيغة ES module.
 *
 * الاستخدام:
 *   node scripts/build-partials.js
 *   أو تلقائياً عند تشغيل: npm run dev  /  npm run build:partials
 *
 * النمط: tab-home.html  →  tabHome.js  (camelCase)
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = join(__dirname, '..');

const PARTIALS_DIR = join(ROOT, 'src', 'partials');
const OUTPUT_DIR   = join(ROOT, 'src', 'partialsContent');

/** kebab-case → camelCase  (tab-home → tabHome) */
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// تأكد من وجود مجلد الإخراج
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

let count = 0;
const htmlFiles = readdirSync(PARTIALS_DIR).filter(f => f.endsWith('.html'));

for (const file of htmlFiles) {
  const name    = basename(file, '.html');      // e.g. "tab-home"
  const camel   = toCamelCase(name);            // e.g. "tabHome"
  const srcPath = join(PARTIALS_DIR, file);
  const outPath = join(OUTPUT_DIR, `${camel}.js`);

  const html    = readFileSync(srcPath, 'utf8');
  const escaped = JSON.stringify(html);          // safe string literal

  const content = `// AUTO-GENERATED — لا تعدّل هذا الملف يدوياً
// المصدر: src/partials/${file}
// لإعادة التوليد: node scripts/build-partials.js
export default ${escaped};\n`;

  writeFileSync(outPath, content, 'utf8');
  count++;
  console.log(`  ✔ ${file}  →  ${camel}.js`);
}

console.log(`\n✅ تم توليد ${count} ملف في src/partialsContent/\n`);
