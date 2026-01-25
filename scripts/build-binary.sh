#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Moneywright Binary Build${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Parse arguments
TARGET=""
FOR_DESKTOP=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --for-desktop)
      FOR_DESKTOP=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Get version from package.json
VERSION="v$(bun -e "console.log(require('./package.json').version)" 2>/dev/null || echo "dev")"
echo -e "Version: ${YELLOW}${VERSION}${NC}"

# Set output directory based on mode
if [ "$FOR_DESKTOP" = true ]; then
  # For desktop builds, determine the Tauri sidecar name based on target
  DESKTOP_BIN_DIR="$ROOT_DIR/apps/desktop/src-tauri/binaries"

  # Map bun targets to Tauri sidecar target triples
  case "$TARGET" in
    bun-darwin-arm64|"")
      SIDECAR_SUFFIX="aarch64-apple-darwin"
      ;;
    bun-darwin-x64)
      SIDECAR_SUFFIX="x86_64-apple-darwin"
      ;;
    bun-linux-x64)
      SIDECAR_SUFFIX="x86_64-unknown-linux-gnu"
      ;;
    bun-linux-arm64)
      SIDECAR_SUFFIX="aarch64-unknown-linux-gnu"
      ;;
    bun-windows-x64)
      SIDECAR_SUFFIX="x86_64-pc-windows-msvc"
      ;;
    *)
      echo -e "${RED}Unknown target for desktop build: $TARGET${NC}"
      exit 1
      ;;
  esac

  echo -e "Building for desktop (sidecar: ${YELLOW}${SIDECAR_SUFFIX}${NC})"
  DIST_DIR="$DESKTOP_BIN_DIR"
  mkdir -p "$DIST_DIR"
else
  # Clean previous build for standalone distribution
  echo -e "${YELLOW}Cleaning previous build...${NC}"
  rm -rf "$DIST_DIR"
  mkdir -p "$DIST_DIR"
fi

# Step 1: Build the frontend
echo -e "${YELLOW}Step 1: Building frontend...${NC}"
cd "$ROOT_DIR/apps/web"
bun run build
echo -e "${GREEN}Frontend built successfully${NC}"

# Step 2: Copy frontend to API public folder
echo -e "${YELLOW}Step 2: Preparing static assets...${NC}"
rm -rf "$ROOT_DIR/apps/api/public"
cp -r "$ROOT_DIR/apps/web/dist" "$ROOT_DIR/apps/api/public"
echo -e "${GREEN}Static assets prepared${NC}"

# Step 3: Compile the binary
echo -e "${YELLOW}Step 3: Compiling binary...${NC}"
cd "$ROOT_DIR/apps/api"

# Clear Bun's build cache to ensure fresh compilation
rm -rf ~/.bun/install/cache/vfs 2>/dev/null || true

# Determine binary name based on target and mode
if [ "$FOR_DESKTOP" = true ]; then
  # For desktop, use Tauri sidecar naming convention
  BINARY_NAME="moneywright-${SIDECAR_SUFFIX}"
  if [[ "$SIDECAR_SUFFIX" == *"windows"* ]]; then
    BINARY_NAME="${BINARY_NAME}.exe"
  fi
else
  BINARY_NAME="moneywright"
fi

if [[ -n "$TARGET" ]]; then
  echo -e "  Target: ${TARGET}"
  bun build src/index.ts --compile --target="$TARGET" --define "__APP_VERSION__=\"$VERSION\"" --outfile="$DIST_DIR/$BINARY_NAME"
else
  echo -e "  Target: current platform"
  bun build src/index.ts --compile --define "__APP_VERSION__=\"$VERSION\"" --outfile="$DIST_DIR/$BINARY_NAME"
fi
echo -e "${GREEN}Binary compiled successfully${NC}"

# For desktop builds, we need the binary and migrations
if [ "$FOR_DESKTOP" = true ]; then
  # Clean up api/public
  rm -rf "$ROOT_DIR/apps/api/public"

  # Copy migrations for the sidecar
  echo -e "${YELLOW}Step 4: Copying migrations for desktop...${NC}"
  mkdir -p "$DIST_DIR/drizzle/sqlite"
  cp -r "$ROOT_DIR/apps/api/drizzle/sqlite/"* "$DIST_DIR/drizzle/sqlite/"
  if [ -d "$ROOT_DIR/apps/api/drizzle/pg" ]; then
    mkdir -p "$DIST_DIR/drizzle/pg"
    cp -r "$ROOT_DIR/apps/api/drizzle/pg/"* "$DIST_DIR/drizzle/pg/"
    echo -e "${GREEN}Migrations copied (SQLite + PostgreSQL)${NC}"
  else
    echo -e "${GREEN}Migrations copied (SQLite only)${NC}"
  fi

  # Copy frontend public folder for the sidecar
  echo -e "${YELLOW}Step 5: Copying frontend for desktop...${NC}"
  mkdir -p "$DIST_DIR/public"
  cp -r "$ROOT_DIR/apps/web/dist/"* "$DIST_DIR/public/"
  echo -e "${GREEN}Frontend copied${NC}"

  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  Desktop Sidecar Build Complete!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "Sidecar binary created at: ${YELLOW}$DIST_DIR/$BINARY_NAME${NC}"
  echo ""
  ls -la "$DIST_DIR"
  exit 0
fi

# Step 4: Copy public folder to dist and clean up api/public
echo -e "${YELLOW}Step 4: Copying assets to distribution...${NC}"
cp -r "$ROOT_DIR/apps/api/public" "$DIST_DIR/public"
rm -rf "$ROOT_DIR/apps/api/public"
echo -e "${GREEN}Static assets copied and cleaned up${NC}"

# Step 5: Copy migrations folder (both SQLite and Postgres)
echo -e "${YELLOW}Step 5: Copying migrations...${NC}"
mkdir -p "$DIST_DIR/drizzle"
cp -r "$ROOT_DIR/apps/api/drizzle/sqlite" "$DIST_DIR/drizzle/sqlite"
if [ -d "$ROOT_DIR/apps/api/drizzle/pg" ]; then
  cp -r "$ROOT_DIR/apps/api/drizzle/pg" "$DIST_DIR/drizzle/pg"
  echo -e "${GREEN}Migrations copied (SQLite + PostgreSQL)${NC}"
else
  echo -e "${GREEN}Migrations copied (SQLite only)${NC}"
fi

# Step 6: Create data directory
mkdir -p "$DIST_DIR/data"

# Step 7: Copy example env file
cp "$ROOT_DIR/apps/api/.env.example" "$DIST_DIR/.env.example"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Distribution created at: ${YELLOW}$DIST_DIR${NC}"
echo ""
echo "Contents:"
ls -la "$DIST_DIR"
echo ""
echo -e "${YELLOW}To run:${NC}"
echo "  cd $DIST_DIR"
echo "  ./moneywright"
echo ""
echo -e "${YELLOW}Notes:${NC}"
echo "  - Binary auto-generates .env with secure secrets on first run"
echo "  - Default port: 17777 (http://localhost:17777)"
echo "  - Configure Google OAuth via /setup UI or edit .env"
echo ""
echo -e "${YELLOW}Cross-compilation targets:${NC}"
echo "  --target bun-linux-x64"
echo "  --target bun-linux-arm64"
echo "  --target bun-darwin-x64"
echo "  --target bun-darwin-arm64"
echo "  --target bun-windows-x64"
echo ""
