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
echo -e "${GREEN}  Binary Build${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Parse arguments
TARGET=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --target)
      TARGET="$2"
      shift 2
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

# Clean previous build
echo -e "${YELLOW}Cleaning previous build...${NC}"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

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

# Determine binary name based on target
BINARY_NAME="app"
if [[ -n "$TARGET" ]]; then
  echo -e "  Target: ${TARGET}"
  bun build src/index.ts --compile --target="$TARGET" --define "__APP_VERSION__=\"$VERSION\"" --outfile="$DIST_DIR/$BINARY_NAME"
else
  echo -e "  Target: current platform"
  bun build src/index.ts --compile --define "__APP_VERSION__=\"$VERSION\"" --outfile="$DIST_DIR/$BINARY_NAME"
fi
echo -e "${GREEN}Binary compiled successfully${NC}"

# Step 4: Copy public folder to dist
echo -e "${YELLOW}Step 4: Copying assets to distribution...${NC}"
cp -r "$ROOT_DIR/apps/api/public" "$DIST_DIR/public"

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
echo "  ./app"
echo ""
echo -e "${YELLOW}Notes:${NC}"
echo "  - Binary auto-generates .env with secure secrets on first run"
echo "  - Default port: 7777 (http://localhost:7777)"
echo "  - Configure Google OAuth via /setup UI or edit .env"
echo ""
echo -e "${YELLOW}Cross-compilation targets:${NC}"
echo "  --target bun-linux-x64"
echo "  --target bun-linux-arm64"
echo "  --target bun-darwin-x64"
echo "  --target bun-darwin-arm64"
echo "  --target bun-windows-x64"
echo ""
