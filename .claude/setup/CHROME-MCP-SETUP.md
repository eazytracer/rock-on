# Chrome DevTools MCP Server Setup

## Overview

This project uses the Chrome DevTools MCP (Model Context Protocol) server to allow Claude Code to interact with and debug a running Chrome browser instance.

## Configuration Method

### Using Claude CLI (Primary Method)

The MCP server is configured using the `claude mcp` CLI command:

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

```bash
# The Chrome instance should be started with remote debugging enabled
$(find ~/chrome -name chrome -type f) \
  --headless=new \
  --remote-debugging-port=9222 \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --window-size=1280,720 \
  http://localhost:5173
```

This is typically done when running tests or when you need Claude to interact with the browser.

## Verifying the Setup

### 1. Check if Chrome is Running
```bash
pgrep -f "remote-debugging-port=9222"
```

### 2. Check if chrome-devtools-mcp is Installed
```bash
which chrome-devtools-mcp
npm list -g chrome-devtools-mcp
```

### 3. Check MCP Configuration
```bash
# List all configured MCP servers
claude mcp list

# Should show:
# chrome-devtools: chrome-devtools-mcp --browserUrl http://127.0.0.1:9222 - ✓ Connected
```

### 4. View MCP Tools in Claude Code
In Claude Code, run:
```
/mcp
```

You should see `chrome-devtools` listed as an available MCP server with all its tools.

### 5. Test Chrome MCP Tools
Ask Claude to:
- Take a screenshot of the current page
- Navigate to a URL
- Evaluate JavaScript in the browser
- Inspect network requests
- Check performance metrics

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
   netstat -tlnp | grep 9222
   # or
   ss -tlnp | grep 9222
   ```

3. **Restart Chrome with remote debugging**:
   ```bash
   pkill chrome
   # Then start Chrome with the command shown above
   ```

### Permission Issues

If you get permission errors, ensure the chrome binary is executable:
```bash
chmod +x $(find ~/chrome -name chrome -type f)
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
