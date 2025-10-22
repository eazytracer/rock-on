# Devcontainer Setup

## What's Included

This devcontainer automatically sets up:
- Node.js and npm
- Claude Code CLI
- Chrome (headless) with all required dependencies for MCP tools
- Python and uv

## Chrome MCP Server Configuration

The Chrome browser is installed at: `~/chrome/chrome/linux-{version}/chrome-linux64/chrome`

To use Chrome MCP tools in Claude Code, the configuration is already set in your `.claude.json`:

```json
{
  "mcpServers": {
    "chrome": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@latest",
        "--executablePath",
        "/home/vscode/chrome/chrome/linux-141.0.7390.122/chrome-linux64/chrome",
        "--headless",
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ]
    }
  }
}
```

**Note:** The Chrome version number in the path may change when Chrome updates. If Chrome MCP tools stop working after a rebuild, check the actual path:
```bash
ls ~/chrome/chrome/
```

## Chrome Dependencies

The following packages are installed to support headless Chrome:
- **Fonts & Rendering**: fonts-liberation, libcairo2, libpango-1.0-0
- **Audio**: libasound2t64
- **Accessibility**: libatk-bridge2.0-0t64, libatk1.0-0t64, libatspi2.0-0t64
- **Printing**: libcups2t64
- **Graphics**: libdrm2, libgbm1, libgtk-3-0t64
- **Security**: libnspr4, libnss3
- **X11/Wayland**: libx11-xcb1, libxcomposite1, libxdamage1, libxfixes3, libxkbcommon0, libxrandr2
- **Utilities**: xdg-utils

## Troubleshooting

### Chrome MCP tools not working?
1. Check if Chrome is installed: `ls ~/chrome/chrome/`
2. Test Chrome can run: `~/chrome/chrome/linux-*/chrome-linux64/chrome --version`
3. Restart Claude Code to reinitialize MCP server

### Need to update Chrome version in MCP config?
1. Find the actual Chrome path: `ls -la ~/chrome/chrome/`
2. Update the `executablePath` in `.claude.json` under `projects > /workspaces/rock-on > mcpServers > chrome > args`
