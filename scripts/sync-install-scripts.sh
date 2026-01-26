#!/bin/bash
# Copies install scripts to docs public folder for serving via moneywright.com

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DOCS_PUBLIC="$ROOT_DIR/apps/docs/public"

echo "Syncing install scripts to docs public folder..."

cp "$SCRIPT_DIR/install.sh" "$DOCS_PUBLIC/install.sh"
cp "$SCRIPT_DIR/install.ps1" "$DOCS_PUBLIC/install.ps1"

echo "Done!"
echo "  - $DOCS_PUBLIC/install.sh"
echo "  - $DOCS_PUBLIC/install.ps1"
