# استعادة النسخة الاحتياطية الخفيفة

1. فك الضغط في مجلد جديد.
2. من داخل المجلد:
   ```bash
   npm install
   cd src-tauri && cargo build
   ```
3. للتشغيل: `npm run tauri dev`

ملاحظة: لا يتضمن `.env` ولا `node_modules` ولا `target` — أعد إنشاء `.env` يدوياً إن لزم.
