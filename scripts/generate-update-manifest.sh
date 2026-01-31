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

# Function to find and read signature
get_sig() {
  local bundle_dir="$1"
  local pattern="$2"
  for f in "$bundle_dir"/$pattern 2>/dev/null; do
    if [ -f "$f" ]; then
      cat "$f"
      return
    fi
  done
  echo ""
}

# Look for signature files in build directories
SIG_DARWIN_ARM64=$(get_sig "$DESKTOP_DIR/src-tauri/target/aarch64-apple-darwin/release/bundle/macos" "*.app.tar.gz.sig")
SIG_DARWIN_X64=$(get_sig "$DESKTOP_DIR/src-tauri/target/x86_64-apple-darwin/release/bundle/macos" "*.app.tar.gz.sig")
SIG_LINUX=$(get_sig "$DESKTOP_DIR/src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb" "*.deb.sig")
SIG_WINDOWS=$(get_sig "$DESKTOP_DIR/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis" "*.nsis.zip.sig")

# Build the JSON
cat > "$OUTPUT_FILE" << EOF
{
  "version": "v$VERSION",
  "notes": "$NOTES",
  "pub_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$SIG_DARWIN_ARM64",
      "url": "$BASE_URL/Moneywright_${VERSION}_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "$SIG_DARWIN_X64",
      "url": "$BASE_URL/Moneywright_${VERSION}_x64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "$SIG_LINUX",
      "url": "$BASE_URL/moneywright_${VERSION}_amd64.deb"
    },
    "windows-x86_64": {
      "signature": "$SIG_WINDOWS",
      "url": "$BASE_URL/Moneywright_${VERSION}_x64-setup.nsis.zip"
    }
  }
}
EOF

echo -e "${GREEN}Generated: ${CYAN}$OUTPUT_FILE${NC}"
echo ""

# Show signature status
echo -e "Signature status:"
[ -n "$SIG_DARWIN_ARM64" ] && echo -e "  darwin-aarch64: ${GREEN}Found${NC}" || echo -e "  darwin-aarch64: ${YELLOW}Missing${NC}"
[ -n "$SIG_DARWIN_X64" ] && echo -e "  darwin-x86_64:  ${GREEN}Found${NC}" || echo -e "  darwin-x86_64:  ${YELLOW}Missing${NC}"
[ -n "$SIG_LINUX" ] && echo -e "  linux-x86_64:   ${GREEN}Found${NC}" || echo -e "  linux-x86_64:   ${YELLOW}Missing${NC}"
[ -n "$SIG_WINDOWS" ] && echo -e "  windows-x86_64: ${GREEN}Found${NC}" || echo -e "  windows-x86_64: ${YELLOW}Missing${NC}"
echo ""

if [ -z "$SIG_DARWIN_ARM64" ] && [ -z "$SIG_DARWIN_X64" ] && [ -z "$SIG_LINUX" ] && [ -z "$SIG_WINDOWS" ]; then
  echo -e "${YELLOW}Note:${NC} No signatures found. Build with TAURI_SIGNING_PRIVATE_KEY set to generate signatures."
  echo ""
fi

cat "$OUTPUT_FILE"
echo ""
