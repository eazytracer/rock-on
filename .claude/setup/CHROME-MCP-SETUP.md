# Chrome DevTools MCP Server Setup

## Overview

This project uses the Chrome DevTools MCP (Model Context Protocol) server to allow Claude Code to interact with and debug a running Chrome browser instance.

## Quick Start for Agents 🤖

The Chrome MCP server connects **lazily** when tools are first called - Chrome can be started at any time.

### Steps to Use Chrome MCP Tools

1. **Start Chrome with remote debugging** (one-liner):
   ```bash
   $(find ~/chrome -name chrome -type f 2>/dev/null | head -1) --headless=new --remote-debugging-port=9222 --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --user-data-dir=/tmp/chrome-profile http://localhost:5173 > /tmp/chrome.log 2>&1 &
   ```

   **Critical flag:** `--remote-debugging-port=9222` enables Chrome DevTools Protocol for MCP

2. **Verify Chrome is responding**:
   ```bash
   sleep 2 && curl -s http://127.0.0.1:9222/json/version
   ```
   Should return JSON with Chrome version info.

3. **Use MCP tools** - The MCP server will connect when you call any tool:
   - `mcp__chrome-devtools__list_pages`
   - `mcp__chrome-devtools__navigate_page`
   - `mcp__chrome-devtools__take_snapshot`
   - `mcp__chrome-devtools__take_screenshot`
   - etc.

**Typical workflow:**
1. Agent starts Chrome with the correct flags
2. Agent calls MCP tool (e.g., `mcp__chrome-devtools__navigate_page`)
3. MCP server connects to Chrome on demand
4. Tool works

### If MCP Tools Are Not Available

If MCP tools don't appear in your function list, use the Chrome DevTools Protocol directly via curl as a fallback (see Troubleshooting section below). This always works regardless of MCP state.

## MCP Server Configuration

### Current Configuration (Already Set Up ✅)

The MCP server is configured in `~/.claude.json`:

```json
{
  "chrome-devtools": {
    "type": "stdio",
    "command": "chrome-devtools-mcp",
    "args": [
      "--browserUrl",
      "http://127.0.0.1:9222"
    ],
    "env": {}
  }
}
```

This configuration:
1. Tells Claude Code to launch `chrome-devtools-mcp` as an MCP server
2. Connects to Chrome's remote debugging port at `http://127.0.0.1:9222`
3. Makes Chrome DevTools tools available in Claude Code sessions

### Setting Up From Scratch (If Needed)

If you need to configure this manually, use the `claude mcp` CLI command:

```bash
claude mcp add chrome-devtools -- chrome-devtools-mcp --browserUrl http://127.0.0.1:9222
```

This command:
1. Adds the Chrome DevTools MCP server to your Claude Code configuration
2. Stores the configuration in `~/.claude.json` (in the devcontainer's home directory)
3. Configures it to connect to Chrome on port 9222

### Automatic Setup

When you build the devcontainer, the `.devcontainer/setup.sh` script automatically:
1. Installs `chrome-devtools-mcp` globally via npm
2. Runs the `claude mcp add` command to configure the server
3. Makes the Chrome MCP tools immediately available

### Baseline Configuration File

The `.mcp.json` file in the repo root is a **reference file** showing the MCP server configuration format. It's not used directly by Claude Code when using the `claude mcp` CLI method.

## How It Works

1. **Chrome Runs with Remote Debugging**: Chrome is started with `--remote-debugging-port=9222`
2. **MCP Server Connects**: The `chrome-devtools-mcp` package connects to Chrome via this port
3. **Claude Code Uses MCP**: Claude Code can now use Chrome MCP tools to interact with the browser

## Starting Chrome with Remote Debugging

**IMPORTANT:** Chrome is installed via Puppeteer with version-specific paths. Always use dynamic path finding.

### Required Chrome Flags for MCP

**Critical flag (enables MCP connection):**
- `--remote-debugging-port=9222` ⭐ **Must have this for MCP to work**

**Container/headless flags (required in Docker/devcontainer):**
- `--headless=new` - Run in headless mode (no GUI)
- `--no-sandbox` - Disable sandbox (required in containers)
- `--disable-gpu` - Disable GPU hardware acceleration
- `--disable-dev-shm-usage` - Prevent shared memory issues

**Optional flags (recommended):**
- `--no-first-run` - Skip first-run wizards
- `--no-default-browser-check` - Skip default browser check
- `--user-data-dir=/tmp/chrome-profile` - Use temp profile directory

### Complete Startup Command

```bash
# Find Chrome binary (works across version updates)
CHROME_BIN=$(find ~/chrome -name chrome -type f 2>/dev/null | head -1)

# Verify Chrome binary exists
if [ -z "$CHROME_BIN" ]; then
  echo "ERROR: Chrome not found. Run: npx -y @puppeteer/browsers install chrome@stable --path ~/chrome"
  exit 1
fi

# Start Chrome with remote debugging (all required flags)
${CHROME_BIN} \
  --headless=new \
  --remote-debugging-port=9222 \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir=/tmp/chrome-profile \
  --window-size=1280,720 \
  http://localhost:5173 \
  > /tmp/chrome.log 2>&1 &
```

**One-liner version (use this in scripts/agents):**

```bash
$(find ~/chrome -name chrome -type f 2>/dev/null | head -1) --headless=new --remote-debugging-port=9222 --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --user-data-dir=/tmp/chrome-profile http://localhost:5173 > /tmp/chrome.log 2>&1 &
```

## Verifying the Setup

### 1. Check Chrome Binary Location
```bash
# Find Chrome binary
find ~/chrome -name chrome -type f 2>/dev/null | head -1

# Should output something like:
# /home/vscode/chrome/chrome/linux-142.0.7444.61/chrome-linux64/chrome
```

### 2. Check if Chrome is Running with Remote Debugging
```bash
# Check Chrome process
pgrep -f "remote-debugging-port=9222"

# Verify debugging port is accessible
curl -s http://127.0.0.1:9222/json/version

# Should return JSON with Chrome version info:
# {
#   "Browser": "Chrome/142.0.7444.61",
#   "Protocol-Version": "1.3",
#   ...
# }
```

### 3. Check if chrome-devtools-mcp is Installed
```bash
which chrome-devtools-mcp
npm list -g chrome-devtools-mcp

# Should show:
# /usr/local/share/nvm/versions/node/v22.x.x/bin/chrome-devtools-mcp
# └── chrome-devtools-mcp@0.x.x
```

### 4. Check MCP Configuration
```bash
# List all configured MCP servers
claude mcp list

# Should show:
# chrome-devtools: chrome-devtools-mcp --browserUrl http://127.0.0.1:9222 - ✓ Connected
```

**Note:** The MCP server can show "✓ Connected" even if Chrome isn't running. Always verify Chrome's debugging port (step 2) is responding before using MCP tools.

### 5. View MCP Tools in Claude Code
In Claude Code, run:
```
/mcp
```

You should see `chrome-devtools` listed as an available MCP server with all its tools.

### 6. Test Chrome MCP Tools
Ask Claude to:
- Take a screenshot of the current page
- Navigate to a URL
- Evaluate JavaScript in the browser
- Inspect network requests
- Check performance metrics

**If MCP tools return "Not connected":** Restart Claude Code session or use the Chrome DevTools Protocol directly via curl as a fallback.

## Troubleshooting

### MCP Server Not Showing Up

1. **Check if the MCP server is configured**:
   ```bash
   claude mcp list
   ```

   If `chrome-devtools` is not listed, add it manually:
   ```bash
   claude mcp add chrome-devtools -- chrome-devtools-mcp --browserUrl http://127.0.0.1:9222
   ```

2. **Check if chrome-devtools-mcp is installed**:
   ```bash
   npm list -g chrome-devtools-mcp
   ```

   If not installed, run:
   ```bash
   npm install -g chrome-devtools-mcp
   ```

3. **Verify the configuration file**:
   ```bash
   cat ~/.claude.json
   ```

   Look for a `chrome-devtools` entry with the correct command and arguments.

### Chrome Not Responding

1. **Check if Chrome is running**:
   ```bash
   pgrep -f chrome
   ```

2. **Check the remote debugging port**:
   ```bash
   curl -s http://127.0.0.1:9222/json/version

   # If this fails, check port:
   netstat -tlnp | grep 9222
   # or
   ss -tlnp | grep 9222
   ```

3. **Restart Chrome with remote debugging**:
   ```bash
   pkill -f chrome

   # Wait for process to die
   sleep 1

   # Start Chrome with dynamic path finding
   $(find ~/chrome -name chrome -type f 2>/dev/null | head -1) --headless=new --remote-debugging-port=9222 --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --user-data-dir=/tmp/chrome-profile http://localhost:5173 > /tmp/chrome.log 2>&1 &

   # Verify it started
   sleep 2 && curl -s http://127.0.0.1:9222/json/version
   ```

### MCP Tools Return "Not Connected"

This can happen even when Chrome is running and `claude mcp list` shows "✓ Connected". The MCP server connection state may not be available in the current Claude Code session.

**Workaround:** Use Chrome DevTools Protocol directly via curl:

```bash
# Navigate to a URL
curl -s http://127.0.0.1:9222/json/new?https://example.com

# Take a screenshot (base64)
# First, get the target ID
TARGET_ID=$(curl -s http://127.0.0.1:9222/json | jq -r '.[0].id')

# Then use Chrome DevTools Protocol
curl -s -X POST http://127.0.0.1:9222/devtools/page/$TARGET_ID \
  -H "Content-Type: application/json" \
  -d '{"id":1,"method":"Page.captureScreenshot","params":{}}'

# List all pages
curl -s http://127.0.0.1:9222/json | jq '.[] | {id, url, title}'

# Evaluate JavaScript
curl -s -X POST http://127.0.0.1:9222/devtools/page/$TARGET_ID \
  -H "Content-Type: application/json" \
  -d '{"id":2,"method":"Runtime.evaluate","params":{"expression":"document.title"}}'
```

**Long-term fix:** Restart Claude Code to re-establish MCP connections.

### Permission Issues

If you get permission errors, ensure the chrome binary is executable:
```bash
CHROME_BIN=$(find ~/chrome -name chrome -type f 2>/dev/null | head -1)
chmod +x "$CHROME_BIN"
```

### Chrome Binary Not Found

If `find ~/chrome -name chrome` returns nothing:

```bash
# Reinstall Chrome using Puppeteer
npx -y @puppeteer/browsers install chrome@stable --path ~/chrome

# Verify installation
find ~/chrome -name chrome -type f 2>/dev/null | head -1

# Should output: /home/vscode/chrome/chrome/linux-XXX.X.XXXX.XX/chrome-linux64/chrome
```

## Available Chrome MCP Tools

Once configured, Claude Code can use tools like:

- **Navigation**: `navigate_page`, `new_page`, `list_pages`
- **Screenshots**: `take_screenshot`, `take_snapshot`
- **Interaction**: `click`, `fill`, `evaluate_script`
- **Debugging**: `list_console_messages`, `resize_page`
- **Performance**: Performance profiling and metrics

## For Future Devcontainer Setups

The configuration is baselined in the repository:

1. **`.devcontainer/setup.sh`** - Automatically installs chrome-devtools-mcp and configures it via `claude mcp add`
2. **`.mcp.json`** - Reference configuration file (not used directly by Claude Code)
3. **`~/.claude.json`** - Actual configuration file in devcontainer home directory (auto-generated)

### Setting Up in a New Devcontainer

When you create a new devcontainer from this repo:

1. The devcontainer will automatically run `.devcontainer/setup.sh`
2. This script will install chrome-devtools-mcp and configure it
3. The configuration will be saved to `~/.claude.json` in the devcontainer
4. Run `claude mcp list` to verify the setup

**Note**: The `~/.claude.json` file lives in the devcontainer's home directory and is not part of the repo. This is why the setup script runs automatically on devcontainer creation.

## References

- [Chrome DevTools MCP Documentation](https://github.com/ChromeDevTools/chrome-devtools-mcp/)
- [Chrome DevTools MCP npm package](https://www.npmjs.com/package/chrome-devtools-mcp)
- [Claude Code MCP Setup Guide](https://docs.claude.com/en/docs/claude-code/mcp)
- [VS Code MCP Configuration](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
