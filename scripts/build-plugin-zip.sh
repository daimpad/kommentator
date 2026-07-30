#!/usr/bin/env bash
# ============================================================================
# Baut das installierbare WordPress-Plugin-ZIP — getrennt vom statischen
# Werkzeug. Prüft vorher, dass nichts Veraltetes ausgeliefert wird.
#
#   ./scripts/build-plugin-zip.sh            # -> dist/kommentare-tool-<version>.zip
#   ./scripts/build-plugin-zip.sh 1.9.0      # erwartete Version zusätzlich prüfen
#
# Das ZIP enthält genau einen Ordner `kommentare-tool/` (so erwartet es
# WordPress unter „Plugins → Installieren → Plugin hochladen").
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$ROOT/wordpress/kommentare-tool"
DIST="$ROOT/dist"
ERWARTETE_VERSION="${1:-}"

fehler() { echo "FEHLER: $*" >&2; exit 1; }

[ -d "$PLUGIN_DIR" ] || fehler "Plugin-Ordner fehlt: $PLUGIN_DIR"

# --- Version aus dem Plugin-Header lesen ------------------------------------
VERSION="$(sed -n 's/^ \* Version:[[:space:]]*\([0-9][0-9.]*\).*/\1/p' \
  "$PLUGIN_DIR/kommentare-tool.php" | head -1)"
[ -n "$VERSION" ] || fehler "Version im Plugin-Header nicht gefunden."

# --- 1) Version konsistent? (Header, KOMMENTARE_VERSION, readme.txt) --------
CONST_VERSION="$(sed -n "s/^define('KOMMENTARE_VERSION', *'\([0-9][0-9.]*\)').*/\1/p" \
  "$PLUGIN_DIR/kommentare-tool.php" | head -1)"
README_VERSION="$(sed -n 's/^Stable tag:[[:space:]]*\([0-9][0-9.]*\).*/\1/p' \
  "$PLUGIN_DIR/readme.txt" | head -1)"

[ "$VERSION" = "$CONST_VERSION" ] \
  || fehler "Header-Version ($VERSION) != KOMMENTARE_VERSION ($CONST_VERSION)."
[ "$VERSION" = "$README_VERSION" ] \
  || fehler "Header-Version ($VERSION) != readme.txt Stable tag ($README_VERSION)."

if [ -n "$ERWARTETE_VERSION" ] && [ "$VERSION" != "$ERWARTETE_VERSION" ]; then
  fehler "Plugin-Version ($VERSION) passt nicht zum Tag ($ERWARTETE_VERSION)."
fi

# --- 2) Gebündelte Assets = Wurzel-Assets? (kein veralteter Stand) ----------
for f in kommentare.js kommentare.css; do
  cmp -s "$ROOT/$f" "$PLUGIN_DIR/assets/$f" \
    || fehler "$f weicht von wordpress/kommentare-tool/assets/$f ab — 'npm run sync-plugin-assets' ausführen."
done

# --- 3) PHP-Syntax prüfen, falls PHP verfügbar -----------------------------
if command -v php >/dev/null 2>&1; then
  php -l "$PLUGIN_DIR/kommentare-tool.php" >/dev/null \
    || fehler "PHP-Syntaxfehler in kommentare-tool.php."
fi

# --- 4) ZIP bauen ----------------------------------------------------------
ZIP="$DIST/kommentare-tool-$VERSION.zip"
rm -rf "$DIST/kommentare-tool" "$ZIP"
mkdir -p "$DIST/kommentare-tool"

cp "$PLUGIN_DIR/kommentare-tool.php" "$PLUGIN_DIR/readme.txt" "$DIST/kommentare-tool/"
mkdir -p "$DIST/kommentare-tool/assets"
cp "$PLUGIN_DIR/assets/kommentare.js" "$PLUGIN_DIR/assets/kommentare.css" \
   "$DIST/kommentare-tool/assets/"
# Lizenz mitliefern (das ZIP wird eigenständig verteilt)
[ -f "$ROOT/LICENSE" ] && cp "$ROOT/LICENSE" "$DIST/kommentare-tool/"

( cd "$DIST" && zip -qr "$(basename "$ZIP")" kommentare-tool \
    -x '*.DS_Store' -x '__MACOSX*' )
rm -rf "$DIST/kommentare-tool"

echo "Plugin-Version: $VERSION"
echo "ZIP:            ${ZIP#"$ROOT"/}"
unzip -l "$ZIP" | sed 's/^/  /'
