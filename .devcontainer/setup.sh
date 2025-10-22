#!/bin/bash
set -e

echo "🚀 Setting up devcontainer..."

# Install Claude Code and usage tracker
echo "📦 Installing npm global packages..."
npm install -g @anthropic-ai/claude-code ccusage

# Install Chrome dependencies for headless mode
echo "🔧 Installing Chrome dependencies..."
sudo apt-get update
sudo apt-get install -y \
  fonts-liberation \
  libasound2t64 \
  libatk-bridge2.0-0t64 \
  libatk1.0-0t64 \
  libatspi2.0-0t64 \
  libcairo2 \
  libcups2t64 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0t64 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends

# Clean up apt cache to reduce image size
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*

# Install Chrome using Puppeteer's browser installer
echo "🌐 Installing Chrome..."
npx -y @puppeteer/browsers install chrome@stable --path ~/chrome

echo "✅ Devcontainer setup complete!"
