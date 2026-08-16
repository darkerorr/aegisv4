#!/usr/bin/env sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

echo "Aegis CLI installer"
echo "Project: $PROJECT_ROOT"

command -v node >/dev/null 2>&1 || { echo "[ERROR] Node.js is required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "[ERROR] npm is required"; exit 1; }

if command -v git >/dev/null 2>&1; then
  echo "[OK] Git detected: $(git --version)"
else
  echo "[WARN] Git not detected"
fi

cd "$PROJECT_ROOT"
npm install
npm run build
npm link

echo "[OK] Installation complete"
echo "Try: aegis doctor"
