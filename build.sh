#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies..."
npm ci || npm install

echo "==> Compiling TypeScript..."
npm run build

echo "==> Packaging standalone executable (Linux/macOS)..."
npx caxa --input . --output AnimalHospitalOrganizer --exclude "tests" "data" "*.md" -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/dist/index.js"

echo "==> Packaging standalone executable (Windows)..."
npx caxa --input . --output AnimalHospitalOrganizer.exe --exclude "tests" "data" "*.md" -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/dist/index.js"

echo "==> Build complete!"
