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
