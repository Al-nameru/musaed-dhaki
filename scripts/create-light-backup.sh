#!/usr/bin/env bash
# نسخة احتياطية خفيفة (~1–2 MB): كود مصدر + إعدادات فقط، بدون node_modules أو target أو .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATE_STAMP="$(date +%Y-%m-%d)"

normalize_path() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$p"
  elif [[ "$p" =~ ^[A-Za-z]: ]]; then
    echo "/${p:0:1,,}${p:2}"
  else
    echo "$p"
  fi
}

RAW_OUT="${1:-$(dirname "$ROOT")/backups}"
OUT_DIR="$(normalize_path "$RAW_OUT")"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
ARCHIVE="$OUT_DIR/smart-assistant-v1-snapshot-${DATE_STAMP}.zip"
STAGING="$(mktemp -d 2>/dev/null || mktemp -d -t sa-backup)"

cleanup() { rm -rf "$STAGING"; }
trap cleanup EXIT

mkdir -p "$OUT_DIR"
DEST="$STAGING/smart-assistant"
mkdir -p "$DEST"

copy_path() {
  local rel="$1"
  if [[ -e "$ROOT/$rel" ]]; then
    mkdir -p "$DEST/$(dirname "$rel")"
    cp -R "$ROOT/$rel" "$DEST/$rel"
  fi
}

# Frontend + Rust source
copy_path "src"
copy_path "src-tauri/src"
copy_path "src-tauri/Cargo.toml"
copy_path "src-tauri/Cargo.lock"
copy_path "src-tauri/tauri.conf.json"
copy_path "src-tauri/capabilities"
copy_path "src-tauri/icons"
copy_path "src-tauri/build.rs"

# Tooling + docs
copy_path "package.json"
copy_path "package-lock.json"
copy_path "vitest.config.js"
copy_path "vitest.setup.js"
copy_path "scripts"
copy_path "docs"
copy_path "HANDOFF.md"
copy_path "AGENT_KICKOFF.md"
copy_path "future_ideas.md"

# استعادة سريعة
cat > "$DEST/RESTORE.md" <<'EOF'
# استعادة النسخة الاحتياطية الخفيفة

1. فك الضغط في مجلد جديد.
2. من داخل المجلد:
   ```bash
   npm install
   cd src-tauri && cargo build
   ```
3. للتشغيل: `npm run tauri dev`

ملاحظة: لا يتضمن `.env` ولا `node_modules` ولا `target` — أعد إنشاء `.env` يدوياً إن لزم.
EOF

cd "$STAGING"
if command -v zip >/dev/null 2>&1; then
  zip -rq "$ARCHIVE" smart-assistant
else
  ARCHIVE="${ARCHIVE%.zip}.tar.gz"
  tar -czf "$ARCHIVE" smart-assistant
fi
cd "$ROOT"

BYTES=$(wc -c < "$ARCHIVE" | tr -d ' ')
MB=$(awk "BEGIN {printf \"%.2f\", $BYTES/1024/1024}")
echo "Created: $ARCHIVE ($MB MB)"
