#!/bin/sh
# Package the web build for itch.io as an HTML5 upload.
# Output: release/eternity-high-web-<version>.zip, with index.html at the zip root
# (itch.io wants it there), plus the licenses and a note on where the source is.
# Needs a prior `npm run build` and the `zip` command.
set -eu
cd "$(dirname "$0")/../.."
VERSION=$(node -p "require('./package.json').version")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
[ -f dist/index.html ] || { echo "run npm run build first" >&2; exit 1; }
command -v zip >/dev/null || { echo "the zip command is needed" >&2; exit 1; }
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -a dist/. "$STAGE/"
cp LICENSE LICENSE-MUSIC "$STAGE/"
# Phaser is MIT: its notice has to travel with the minified bundle.
{
  echo "Eternity High bundles third-party code under these licenses."
  echo
  echo "== Phaser (https://phaser.io) =="
  cat node_modules/phaser/LICENSE.md
  echo
  echo "== Vite module preload helper (https://vite.dev) =="
  echo "MIT License. Copyright (c) 2019-present, VoidZero Inc. and Vite contributors."
} > "$STAGE/THIRD_PARTY_NOTICES.txt"
cat > "$STAGE/SOURCE.txt" <<NOTE
Eternity High $VERSION (commit $COMMIT)

The code is free software under the GNU GPL v3.0 or later (LICENSE).
The soundtrack in music/ is CC BY-SA 4.0 by 9x25dillon (LICENSE-MUSIC).
Complete source code: https://github.com/9x25dillon/pogo-showdown
NOTE
mkdir -p release
OUT="release/eternity-high-web-$VERSION.zip"
rm -f "$OUT"
(cd "$STAGE" && zip -qr -X "$OLDPWD/$OUT" .)
FILES=$(unzip -Z1 "$OUT" | grep -vc '/$')
echo "$OUT: $(du -h "$OUT" | cut -f1), $FILES files"
