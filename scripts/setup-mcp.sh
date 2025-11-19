#!/bin/bash
# Setup MCP servers for Claude Code in devcontainer
# This script can be run manually if the automatic setup fails

set -e

echo "Setting up MCP configuration for Claude Code..."

# Install chrome-devtools-mcp globally if not already installed
if ! npm list -g chrome-devtools-mcp &>/dev/null; then
    echo "📦 Installing chrome-devtools-mcp globally..."
    npm install -g chrome-devtools-mcp
    echo "✓ chrome-devtools-mcp installed"
else
    echo "✓ chrome-devtools-mcp already installed"
fi

# Check if Claude CLI is available
if ! command -v claude &> /dev/null; then
    echo "✗ Claude CLI not found. Please install Claude Code first."
    exit 1
fi

# Add Chrome MCP server using Claude CLI
echo "⚙️  Configuring Chrome MCP server..."
if claude mcp list 2>/dev/null | grep -q "chrome-devtools"; then
    echo "✓ chrome-devtools MCP server already configured"
else
    claude mcp add chrome-devtools -- chrome-devtools-mcp --browserUrl http://127.0.0.1:9222
    echo "✓ chrome-devtools MCP server configured"
fi

# Verify Chrome is running with remote debugging
if pgrep -f "remote-debugging-port=9222" > /dev/null; then
    echo "✓ Chrome is running with remote debugging on port 9222"
else
    echo "⚠ Warning: Chrome is not running with remote debugging on port 9222"
    echo "  You may need to start Chrome with: --remote-debugging-port=9222"
fi

echo ""
echo "MCP setup complete!"
echo "Run 'claude mcp list' to verify the configuration."
