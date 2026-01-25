#!/bin/bash
#
# Moneywright Setup Script
# Generates secure secrets and creates .env file
#

set -e

echo ""
echo "=========================================="
echo "  Moneywright Setup"
echo "  AI-powered personal finance helper"
echo "=========================================="
echo ""

# Check for required tools
if ! command -v openssl >/dev/null 2>&1; then
  echo "Error: openssl is required but not installed."
  echo "Please install openssl and try again."
  exit 1
fi

# Generate secure secrets
echo "Generating secure secrets..."
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

echo "  JWT_SECRET: Generated (${#JWT_SECRET} characters)"
echo "  ENCRYPTION_KEY: Generated (64 hex characters)"
echo ""

# Check if .env already exists
if [ -f .env ]; then
  echo "WARNING: .env file already exists!"
  echo ""
  read -p "Do you want to overwrite it? (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo ""
    echo "Setup cancelled. Your existing .env file was preserved."
    echo ""
    echo "Generated secrets (copy these if needed):"
    echo "  JWT_SECRET=$JWT_SECRET"
    echo "  ENCRYPTION_KEY=$ENCRYPTION_KEY"
    exit 0
  fi
  echo ""
  echo "Backing up existing .env to .env.backup..."
  cp .env .env.backup
fi

# Create .env file
cat > .env << EOF
# =============================================================================
# Moneywright Configuration
# Generated on $(date)
# =============================================================================

# -----------------------------------------------------------------------------
# Google OAuth Credentials (REQUIRED for multi-user mode)
# Get these from: https://console.cloud.google.com/apis/credentials
# -----------------------------------------------------------------------------
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# -----------------------------------------------------------------------------
# Security Secrets (REQUIRED - auto-generated)
# -----------------------------------------------------------------------------
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# -----------------------------------------------------------------------------
# Application URL
# Set this to your public URL for production deployments
# The OAuth redirect URI is derived from this: APP_URL + /auth/google/callback
# Default: http://localhost:17777 (production) or http://localhost:3000 (development)
# -----------------------------------------------------------------------------
# APP_URL=https://your-domain.com

# -----------------------------------------------------------------------------
# Database Configuration
# Docker uses bundled PostgreSQL by default
# For local development without Docker, SQLite is used automatically
# -----------------------------------------------------------------------------
# DATABASE_URL=postgres://user:password@localhost:5432/moneywright

# -----------------------------------------------------------------------------
# Optional: PostgreSQL Password (for Docker's bundled PostgreSQL)
# -----------------------------------------------------------------------------
# POSTGRES_PASSWORD=your_secure_password
EOF

echo ".env file created successfully!"
echo ""
echo "=========================================="
echo "  Next Steps"
echo "=========================================="
echo ""
echo "1. Set up Google OAuth credentials (optional for local use):"
echo "   - Go to https://console.cloud.google.com/apis/credentials"
echo "   - Create an OAuth 2.0 Client ID"
echo "   - Add redirect URI: http://localhost:17777/auth/google/callback"
echo "   - Add your credentials to .env"
echo ""
echo "2. Start Moneywright:"
echo "   docker compose up -d"
echo ""
echo "3. Open in browser:"
echo "   http://localhost:17777"
echo ""
echo "=========================================="
echo ""
