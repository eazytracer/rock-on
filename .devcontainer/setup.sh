#!/bin/bash
set -e

echo "🚀 Setting up devcontainer..."

# Install Claude Code and usage tracker
echo "📦 Installing npm global packages..."
npm install -g @anthropic-ai/claude-code ccusage

# Install Supabase CLI
echo "🗄️  Installing Supabase CLI..."
curl -L -o /tmp/supabase.tar.gz "https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz"
tar -xzf /tmp/supabase.tar.gz -C /tmp
sudo mv /tmp/supabase /usr/local/bin/
rm /tmp/supabase.tar.gz
supabase --version
echo "✓ Supabase CLI installed"

# Install Vercel CLI
echo "🔺 Installing Vercel CLI..."
npm install -g vercel
vercel --version
echo "✓ Vercel CLI installed"

# Install GitHub CLI (gh) — used for PRs, releases, and tag operations
echo "🐙 Installing GitHub CLI..."
(type -p curl >/dev/null || sudo apt-get install curl -y) \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
     | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
     | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && sudo apt-get update \
  && sudo apt-get install gh -y
gh --version | head -1
echo "✓ GitHub CLI installed (run 'gh auth login' to authenticate)"


# Install Playwright dependencies for Firefox
echo "Installing Playwright system dependencies for Firefox..."
npx playwright install-deps firefox

# Install Firefox browser for Playwright
echo "Installing Firefox browser for Playwright..."
npx playwright install firefox

# Install Playwright MCP server globally for convenience
echo "Installing Playwright MCP server..."
npm install -g @playwright/mcp

# Configure Playwright MCP server in Claude Code
echo "Configuring Playwright MCP server in Claude Code..."
claude mcp add playwright -- npx @playwright/mcp --browser firefox --headless

echo "=== Setup Complete ==="
echo ""
echo "Available commands:"
echo "  npm run dev      - Start the Next.js development server"
echo "  npm run capture  - Capture screenshots of an app"
echo "  npm run collage  - Generate a collage from screenshots"
echo ""
echo "Playwright MCP server can be started with:"
echo "  npx @playwright/mcp --browser firefox --headless"
echo "✅ Devcontainer setup complete!"
echo "ℹ️  Note: Run 'claude mcp list' to verify MCP server is connected"
