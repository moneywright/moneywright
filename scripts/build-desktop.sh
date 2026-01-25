#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get the root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"

# Source cargo environment if available
if [ -f "$HOME/.cargo/env" ]; then
  source "$HOME/.cargo/env"
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Moneywright Desktop Build${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Parse arguments
TARGET=""
DEBUG=false
NOTARIZE=true  # Notarize by default for macOS
SKIP_NOTARIZE=false
FULL_CLEAN=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --debug)
      DEBUG=true
      shift
      ;;
    --skip-notarize)
      SKIP_NOTARIZE=true
      shift
      ;;
    --clean)
      FULL_CLEAN=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo ""
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --target <platform>   Target platform: macos, macos-intel, windows, linux, linux-arm"
      echo "  --debug               Build in debug mode (faster, larger binary)"
      echo "  --skip-notarize       Skip notarization for macOS builds"
      echo "  --clean               Full clean build (removes Rust target directory)"
      echo ""
      exit 1
      ;;
  esac
done

# Map friendly target names to bun and rust targets
case "$TARGET" in
  macos|macos-arm64|"")
    BUN_TARGET="bun-darwin-arm64"
    RUST_TARGET="aarch64-apple-darwin"
    PLATFORM_NAME="macOS (Apple Silicon)"
    ;;
  macos-intel|macos-x64)
    BUN_TARGET="bun-darwin-x64"
    RUST_TARGET="x86_64-apple-darwin"
    PLATFORM_NAME="macOS (Intel)"
    ;;
  windows|windows-x64)
    BUN_TARGET="bun-windows-x64"
    RUST_TARGET="x86_64-pc-windows-msvc"
    PLATFORM_NAME="Windows"
    ;;
  linux|linux-x64)
    BUN_TARGET="bun-linux-x64"
    RUST_TARGET="x86_64-unknown-linux-gnu"
    PLATFORM_NAME="Linux (x64)"
    ;;
  linux-arm|linux-arm64)
    BUN_TARGET="bun-linux-arm64"
    RUST_TARGET="aarch64-unknown-linux-gnu"
    PLATFORM_NAME="Linux (ARM64)"
    ;;
  *)
    echo -e "${RED}Unknown target: $TARGET${NC}"
    echo "Valid targets: macos, macos-intel, windows, linux, linux-arm"
    exit 1
    ;;
esac

echo -e "Target: ${CYAN}$PLATFORM_NAME${NC}"
echo ""

# Clean previous build artifacts
echo -e "${YELLOW}Cleaning previous build artifacts...${NC}"
# Clean sidecar binaries (keep .gitkeep)
find "$DESKTOP_DIR/src-tauri/binaries" -type f ! -name '.gitkeep' -delete 2>/dev/null || true
# Clean drizzle folder contents but keep structure
rm -rf "$DESKTOP_DIR/src-tauri/binaries/drizzle/sqlite/"* 2>/dev/null || true
rm -rf "$DESKTOP_DIR/src-tauri/binaries/drizzle/pg/"* 2>/dev/null || true
# Clean public folder
rm -rf "$DESKTOP_DIR/src-tauri/binaries/public/"* 2>/dev/null || true
# Clean Tauri release bundle
rm -rf "$DESKTOP_DIR/src-tauri/target/$RUST_TARGET/release/bundle" 2>/dev/null || true

# Full clean if requested (removes entire target directory for fresh Rust build)
if [ "$FULL_CLEAN" = true ]; then
  echo -e "  Full clean: removing Rust target directory..."
  rm -rf "$DESKTOP_DIR/src-tauri/target" 2>/dev/null || true
fi

echo -e "${GREEN}Clean complete${NC}"
echo ""

# Step 1: Build the moneywright sidecar binary
echo -e "${YELLOW}Step 1: Building moneywright sidecar binary...${NC}"
"$ROOT_DIR/scripts/build-binary.sh" --target "$BUN_TARGET" --for-desktop
echo -e "${GREEN}Sidecar binary built successfully${NC}"
echo ""

# Step 2: Build the Tauri desktop app
echo -e "${YELLOW}Step 2: Building Tauri desktop app...${NC}"
cd "$DESKTOP_DIR"

# Ensure Rust target is installed
if ! rustup target list --installed | grep -q "$RUST_TARGET"; then
  echo -e "  Installing Rust target: ${CYAN}$RUST_TARGET${NC}"
  rustup target add "$RUST_TARGET"
fi

# Set up Tauri update signing key if available
if [ -f "$HOME/.tauri/moneywright.key" ]; then
  export TAURI_SIGNING_PRIVATE_KEY=$(cat "$HOME/.tauri/moneywright.key")
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
  echo -e "  Update signing: ${GREEN}Enabled${NC}"
else
  echo -e "  Update signing: ${YELLOW}Disabled${NC} (no key found at ~/.tauri/moneywright.key)"
fi

# Set up Apple notarization for macOS builds
if [[ "$RUST_TARGET" == *"apple-darwin"* ]]; then
  if [ "$SKIP_NOTARIZE" = true ]; then
    NOTARIZE=false
    echo -e "  Notarization: ${YELLOW}Skipped${NC} (--skip-notarize flag)"
  elif [ -z "$APPLE_ID" ] || [ -z "$APPLE_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${RED}Error: Notarization requires APPLE_ID, APPLE_PASSWORD, and APPLE_TEAM_ID environment variables${NC}"
    echo ""
    echo "Set these environment variables:"
    echo "  export APPLE_ID=\"your@email.com\""
    echo "  export APPLE_PASSWORD=\"app-specific-password\"  # Generate at appleid.apple.com"
    echo "  export APPLE_TEAM_ID=\"YOUR_TEAM_ID\"            # Find in Apple Developer portal"
    echo ""
    echo "Or use --skip-notarize to build without notarization"
    echo ""
    exit 1
  else
    # Use APPLE_SIGNING_IDENTITY from environment, or default
    export APPLE_SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-Developer ID Application}"
    echo -e "  Signing identity: ${CYAN}$APPLE_SIGNING_IDENTITY${NC}"
    echo -e "  Notarization: ${GREEN}Enabled${NC}"
  fi
else
  # Non-macOS targets don't support notarization
  NOTARIZE=false
fi

# Build with Tauri
if [ "$DEBUG" = true ]; then
  echo -e "  Mode: ${YELLOW}Debug${NC}"
  bun run tauri build --debug --target "$RUST_TARGET"
else
  echo -e "  Mode: ${GREEN}Release${NC}"
  bun run tauri build --target "$RUST_TARGET"
fi

# Notarize macOS build if requested
if [[ "$RUST_TARGET" == *"apple-darwin"* ]] && [ "$NOTARIZE" = true ] && [ "$DEBUG" = false ]; then
  echo ""
  echo -e "${YELLOW}Step 3: Notarizing macOS app...${NC}"

  BUNDLE_DIR="$DESKTOP_DIR/src-tauri/target/$RUST_TARGET/release/bundle"
  DMG_FILE=$(find "$BUNDLE_DIR/dmg" -name "*.dmg" 2>/dev/null | head -1)

  if [ -n "$DMG_FILE" ]; then
    echo -e "  Submitting: ${CYAN}$(basename "$DMG_FILE")${NC}"

    # Submit for notarization
    xcrun notarytool submit "$DMG_FILE" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --wait

    # Staple the notarization ticket to the DMG
    echo -e "  Stapling notarization ticket..."
    xcrun stapler staple "$DMG_FILE"

    echo -e "${GREEN}Notarization complete!${NC}"
  else
    echo -e "${RED}No DMG found to notarize${NC}"
  fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Desktop Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Show output location
BUNDLE_DIR="$DESKTOP_DIR/src-tauri/target/$RUST_TARGET/release/bundle"
if [ "$DEBUG" = true ]; then
  BUNDLE_DIR="$DESKTOP_DIR/src-tauri/target/$RUST_TARGET/debug/bundle"
fi

echo -e "Installers created at: ${YELLOW}$BUNDLE_DIR${NC}"
echo ""

# List the created bundles
if [ -d "$BUNDLE_DIR" ]; then
  echo "Created bundles:"
  find "$BUNDLE_DIR" -maxdepth 2 -type f \( -name "*.dmg" -o -name "*.exe" -o -name "*.msi" -o -name "*.AppImage" -o -name "*.deb" -o -name "*.tar.gz" -o -name "*.sig" \) 2>/dev/null | while read -r file; do
    SIZE=$(du -h "$file" | cut -f1)
    echo -e "  ${CYAN}$(basename "$file")${NC} ($SIZE)"
  done
fi

echo ""
echo -e "${YELLOW}For releases with auto-update support:${NC}"
echo "  1. Build for all platforms"
echo "  2. Run: ./scripts/generate-update-manifest.sh"
echo "  3. Upload latest.json alongside release assets"
echo ""
