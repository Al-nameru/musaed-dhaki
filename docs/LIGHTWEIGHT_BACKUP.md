# النسخة الاحتياطية الخفيفة

## الهدف

حفظ نسخة من التطبيق **قابلة للاستعادة** بحجم ~1–2 MB، بدون:
- `node_modules`
- `src-tauri/target`
- `.env` (أسرار)
- `.git`

## إنشاء نسخة

```bash
bash scripts/create-light-backup.sh
```

الملف يُحفظ في: `../backups/smart-assistant-v1-snapshot-YYYY-MM-DD.zip`

## استعادة

1. فك الضغط.
2. `npm install`
3. `cd src-tauri && cargo build`
4. `npm run tauri dev`

## بديل أقوى (موصى به أيضاً): Git tag

```bash
git add -A && git commit -m "snapshot before v2"
git tag v1-pre-v2-$(date +%Y-%m-%d)
```

العودة: `git checkout v1-pre-v2-YYYY-MM-DD`
