#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${GREEN}Installing Moneywright...${NC}"
echo ""

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
  linux)
    OS="linux"
    ;;
  darwin)
    OS="darwin"
    ;;
  mingw*|msys*|cygwin*)
    OS="windows"
    ;;
  *)
    echo -e "${RED}Unsupported operating system: $OS${NC}"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64)
    ARCH="x64"
    ;;
  arm64|aarch64)
    ARCH="arm64"
    ;;
  *)
    echo -e "${RED}Unsupported architecture: $ARCH${NC}"
    exit 1
    ;;
esac

# Determine install directory based on OS
if [ "$OS" = "windows" ]; then
  INSTALL_DIR="${LOCALAPPDATA:-$HOME/AppData/Local}/Moneywright"
  BINARY_NAME="moneywright.exe"
  ARCHIVE_EXT="zip"
elif [ "$OS" = "darwin" ]; then
  # macOS: use ~/.moneywright
  INSTALL_DIR="${INSTALL_DIR:-$HOME/.moneywright}"
  BINARY_NAME="moneywright"
  ARCHIVE_EXT="tar.gz"
else
  # Linux: use XDG standard ~/.local/share/moneywright
  INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/moneywright}"
  BINARY_NAME="moneywright"
  ARCHIVE_EXT="tar.gz"
fi

echo -e "  OS:           ${CYAN}$OS${NC}"
echo -e "  Architecture: ${CYAN}$ARCH${NC}"
echo -e "  Install to:   ${CYAN}$INSTALL_DIR${NC}"
echo ""

# Get latest release version from GitHub
REPO="moneywright/moneywright"
echo -e "${YELLOW}Fetching latest release...${NC}"

LATEST_VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
  echo -e "${RED}Failed to fetch latest version${NC}"
  exit 1
fi

echo -e "  Version: ${CYAN}$LATEST_VERSION${NC}"
echo ""

# Construct download URL
FILENAME="moneywright-${OS}-${ARCH}.${ARCHIVE_EXT}"
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$LATEST_VERSION/$FILENAME"

echo -e "${YELLOW}Downloading $FILENAME...${NC}"

# Create temp directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# Download
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/$FILENAME"; then
  echo -e "${RED}Failed to download from $DOWNLOAD_URL${NC}"
  echo -e "${YELLOW}Make sure the release exists and includes binaries for your platform.${NC}"
  exit 1
fi

# Extract
echo -e "${YELLOW}Extracting...${NC}"

# Backup existing .env and data if present (for updates)
ENV_BACKUP=""
DATA_BACKUP=""
if [ -f "$INSTALL_DIR/.env" ]; then
  ENV_BACKUP="$TMP_DIR/.env.backup"
  cp "$INSTALL_DIR/.env" "$ENV_BACKUP"
fi
if [ -d "$INSTALL_DIR/data" ]; then
  DATA_BACKUP="$TMP_DIR/data-backup"
  cp -r "$INSTALL_DIR/data" "$DATA_BACKUP"
fi

# Remove old installation (except backups)
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"

if [ "$ARCHIVE_EXT" = "zip" ]; then
  unzip -q "$TMP_DIR/$FILENAME" -d "$INSTALL_DIR"
else
  tar -xzf "$TMP_DIR/$FILENAME" -C "$INSTALL_DIR" --strip-components=1
fi

# Restore backups
if [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" "$INSTALL_DIR/.env"
fi
if [ -n "$DATA_BACKUP" ] && [ -d "$DATA_BACKUP" ]; then
  cp -r "$DATA_BACKUP" "$INSTALL_DIR/data"
fi

# Make executable
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""

# ============================================================================
# Database Configuration (only on first install)
# ============================================================================

# Skip database configuration if .env already exists (this is an update)
if [ -z "$ENV_BACKUP" ]; then
  echo -e "${BOLD}Database Configuration${NC}"
  echo ""
  echo "Moneywright can use either:"
  echo -e "  1. ${CYAN}SQLite${NC} (default) - No setup needed, data stored locally"
  echo -e "  2. ${CYAN}PostgreSQL${NC} (recommended for cloud deployments)"
  echo ""
  echo -e "${YELLOW}Note:${NC} PostgreSQL requires an external database you've already set up."
  echo "      If you don't have one, press Enter to use SQLite."
  echo ""
  read -p "Would you like to use an external PostgreSQL database? (y/N): " USE_POSTGRES < /dev/tty

  DATABASE_URL=""
  if [ "$USE_POSTGRES" = "y" ] || [ "$USE_POSTGRES" = "Y" ]; then
    echo ""
    echo -e "Enter your PostgreSQL connection URL:"
    echo -e "  Example: ${CYAN}postgresql://user:password@host:5432/dbname${NC}"
    echo ""
    read -p "DATABASE_URL: " DATABASE_URL < /dev/tty

    if [ -n "$DATABASE_URL" ]; then
      # Create or update .env with DATABASE_URL
      ENV_FILE="$INSTALL_DIR/.env"
      if [ -f "$ENV_FILE" ]; then
        # Check if DATABASE_URL already exists
        if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
          # Update existing
          sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" "$ENV_FILE"
          rm -f "$ENV_FILE.bak"
        else
          # Append
          echo "" >> "$ENV_FILE"
          echo "# PostgreSQL database URL" >> "$ENV_FILE"
          echo "DATABASE_URL=$DATABASE_URL" >> "$ENV_FILE"
        fi
      else
        # Will be created on first run, but we can pre-create with DATABASE_URL
        echo "# PostgreSQL database URL" > "$ENV_FILE"
        echo "DATABASE_URL=$DATABASE_URL" >> "$ENV_FILE"
      fi
      echo ""
      echo -e "${GREEN}PostgreSQL configured!${NC}"
    else
      echo ""
      echo -e "${YELLOW}No URL provided, using SQLite.${NC}"
    fi
  else
    echo ""
    echo -e "Using ${CYAN}SQLite${NC} (default). Data will be stored in $INSTALL_DIR/data/"
  fi

  echo ""
else
  echo -e "${GREEN}Existing configuration preserved.${NC}"
  echo ""
fi

# Detect shell config file
detect_shell_config() {
  if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ] || [ "$SHELL" = "/usr/bin/zsh" ]; then
    echo "$HOME/.zshrc"
  elif [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ] || [ "$SHELL" = "/usr/bin/bash" ]; then
    if [ -f "$HOME/.bashrc" ]; then
      echo "$HOME/.bashrc"
    else
      echo "$HOME/.bash_profile"
    fi
  elif [ -f "$HOME/.profile" ]; then
    echo "$HOME/.profile"
  else
    echo "$HOME/.bashrc"
  fi
}

SHELL_CONFIG=$(detect_shell_config)
SHELL_NAME=$(basename "$SHELL_CONFIG")

# Check if already in PATH
if echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo -e "${GREEN}Moneywright is already in your PATH.${NC}"
  PATH_ADDED=true
else
  # Ask user if they want to add to PATH
  echo -e "${YELLOW}Would you like to add Moneywright to your PATH?${NC}"
  echo -e "This will let you run 'moneywright' from anywhere."
  echo ""
  read -p "Add to PATH? (Y/n): " ADD_TO_PATH < /dev/tty

  if [ "$ADD_TO_PATH" != "n" ] && [ "$ADD_TO_PATH" != "N" ]; then
    # Add to shell config
    echo "" >> "$SHELL_CONFIG"
    echo "# Moneywright" >> "$SHELL_CONFIG"
    echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_CONFIG"

    echo ""
    echo -e "${GREEN}Added to $SHELL_NAME${NC}"
    echo -e "Run ${CYAN}source $SHELL_CONFIG${NC} or restart your terminal to use 'moneywright' command."
    PATH_ADDED=true

    # Source the config in the current shell
    export PATH="$INSTALL_DIR:$PATH"
  else
    echo ""
    echo -e "To add to PATH later, run:"
    echo -e "  ${CYAN}echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> $SHELL_CONFIG${NC}"
    PATH_ADDED=false
  fi
fi

echo ""
echo -e "For more info: ${CYAN}https://github.com/$REPO${NC}"
echo ""

# Ask if user wants to start now
echo -e "${YELLOW}Would you like to start Moneywright now?${NC}"
read -p "Start now? (Y/n): " START_NOW < /dev/tty

if [ "$START_NOW" != "n" ] && [ "$START_NOW" != "N" ]; then
  echo ""
  echo -e "${GREEN}Starting Moneywright...${NC}"
  echo ""
  exec "$INSTALL_DIR/$BINARY_NAME"
else
  echo ""
  echo -e "To start Moneywright later, run:"
  if [ "$PATH_ADDED" = true ]; then
    echo -e "  ${CYAN}moneywright${NC}"
  else
    echo -e "  ${CYAN}$INSTALL_DIR/moneywright${NC}"
  fi
  echo ""
fi
