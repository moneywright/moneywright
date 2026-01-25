#!/bin/bash
set -e

# Generate latest.json for Tauri auto-updater
# This script should be run after building all platform binaries
# The output file should be uploaded alongside release assets

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Generate Update Manifest${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Get version from package.json
VERSION=$(bun -e "console.log(require('./package.json').version)" 2>/dev/null)
if [ -z "$VERSION" ]; then
  echo -e "${RED}Failed to get version from package.json${NC}"
  exit 1
fi

echo -e "Version: ${CYAN}v$VERSION${NC}"
echo ""

# GitHub repo for download URLs
REPO="moneywright/moneywright"
BASE_URL="https://github.com/$REPO/releases/download/v$VERSION"

# Release notes (can be customized)
NOTES="Moneywright Desktop v$VERSION"

# Output file
OUTPUT_FILE="$ROOT_DIR/dist/latest.json"
mkdir -p "$ROOT_DIR/dist"

# Function to get signature from .sig file
get_signature() {
  local sig_file="$1"
  if [ -f "$sig_file" ]; then
    cat "$sig_file"
  else
    echo ""
  fi
}

# Build the JSON
# Note: Tauri generates .tar.gz.sig and .zip.sig files during build
# These need to exist for the manifest to be valid

cat > "$OUTPUT_FILE" << EOF
{
  "version": "v$VERSION",
  "notes": "$NOTES",
  "pub_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platforms": {
    "darwin-aarch64": {
      "signature": "",
      "url": "$BASE_URL/Moneywright_${VERSION}_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "",
      "url": "$BASE_URL/Moneywright_${VERSION}_x64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "",
      "url": "$BASE_URL/Moneywright_${VERSION}_amd64.AppImage"
    },
    "windows-x86_64": {
      "signature": "",
      "url": "$BASE_URL/Moneywright_${VERSION}_x64-setup.nsis.zip"
    }
  }
}
EOF

echo -e "${GREEN}Generated: ${CYAN}$OUTPUT_FILE${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} Signatures need to be added after signing the release files."
echo -e "      Run this script again after building with TAURI_SIGNING_PRIVATE_KEY set."
echo ""

# If signature files exist, update the manifest
update_signature() {
  local platform="$1"
  local sig_file="$2"

  if [ -f "$sig_file" ]; then
    local sig=$(cat "$sig_file")
    # Use jq to update if available, otherwise use sed
    if command -v jq &> /dev/null; then
      tmp=$(mktemp)
      jq ".platforms.\"$platform\".signature = \"$sig\"" "$OUTPUT_FILE" > "$tmp" && mv "$tmp" "$OUTPUT_FILE"
      echo -e "  Updated signature for ${CYAN}$platform${NC}"
    fi
  fi
}

# Look for signature files in the target directories
TARGETS=("aarch64-apple-darwin" "x86_64-apple-darwin" "x86_64-unknown-linux-gnu" "x86_64-pc-windows-msvc")
PLATFORMS=("darwin-aarch64" "darwin-x86_64" "linux-x86_64" "windows-x86_64")

for i in "${!TARGETS[@]}"; do
  target="${TARGETS[$i]}"
  platform="${PLATFORMS[$i]}"
  bundle_dir="$DESKTOP_DIR/src-tauri/target/$target/release/bundle"

  # Find .sig files
  for sig_file in "$bundle_dir"/**/*.sig 2>/dev/null; do
    if [ -f "$sig_file" ]; then
      update_signature "$platform" "$sig_file"
    fi
  done
done

echo ""
cat "$OUTPUT_FILE"
echo ""
