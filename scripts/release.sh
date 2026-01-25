#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Check if version argument is provided
if [ -z "$1" ]; then
  echo -e "${RED}Usage: ./scripts/release.sh <version>${NC}"
  echo -e "Example: ./scripts/release.sh 0.4.0"
  echo -e "         ./scripts/release.sh 1.0.0-beta.1"
  exit 1
fi

VERSION="$1"

# Validate version format (basic semver check)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo -e "${RED}Invalid version format: $VERSION${NC}"
  echo -e "Expected format: X.Y.Z or X.Y.Z-suffix"
  exit 1
fi

TAG="v$VERSION"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Moneywright Release${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Version: ${YELLOW}$VERSION${NC}"
echo -e "Tag:     ${YELLOW}$TAG${NC}"
echo ""

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --staged --quiet; then
  echo -e "${RED}Error: You have uncommitted changes. Please commit or stash them first.${NC}"
  exit 1
fi

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo -e "${RED}Error: Tag $TAG already exists.${NC}"
  exit 1
fi

# Update package.json files
echo -e "${YELLOW}Updating package.json files...${NC}"

update_package_json() {
  local file="$1"
  if [ -f "$file" ]; then
    # Use node/bun to update JSON properly
    bun -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('$file', 'utf8'));
      pkg.version = '$VERSION';
      fs.writeFileSync('$file', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo -e "  Updated: ${file#$ROOT_DIR/}"
  fi
}

update_package_json "$ROOT_DIR/package.json"
update_package_json "$ROOT_DIR/apps/api/package.json"
update_package_json "$ROOT_DIR/apps/web/package.json"
update_package_json "$ROOT_DIR/apps/docs/package.json"

echo -e "${GREEN}Package files updated${NC}"
echo ""

# Stage changes
echo -e "${YELLOW}Staging changes...${NC}"
git add package.json apps/*/package.json

# Commit
echo -e "${YELLOW}Creating commit...${NC}"
git commit -m "release: v$VERSION"

# Create tag
echo -e "${YELLOW}Creating tag...${NC}"
git tag -a "$TAG" -m "Release $TAG"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Release $TAG created!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review the commit: git show HEAD"
echo "  2. Push the commit:   git push"
echo "  3. Push the tag:      git push origin $TAG"
echo ""
echo -e "Or push both at once:"
echo "  git push && git push origin $TAG"
echo ""
