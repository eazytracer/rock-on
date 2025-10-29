---
title: Chrome MCP Server Setup for Testing
created: 2025-10-26T23:20
status: Configuration Complete - Requires Restart
prompt: "User wants to test setlist management via Chrome MCP but the MCP server was not installed/configured"
---

# Chrome MCP Server Setup

## Problem

Chrome MCP tools (`mcp__chrome__*`) were whitelisted in `.claude/settings.local.json` but not actually available when attempting to use them. Error: "No such tool available: mcp__chrome__list_pages"

## Root Cause

The Chrome DevTools MCP server was **not installed or configured**. The devcontainer setup only installed Chrome browser, but not the MCP server package needed for Claude Code to interact with it.

## Solution Implemented

### 1. Installed Chrome DevTools MCP Server
```bash
npm install -g chrome-devtools-mcp
```

### 2. Created MCP Configuration
**File**: `.mcp.json` (project root)

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "chrome-devtools-mcp",
      "args": [
        "--browserUrl",
        "http://127.0.0.1:9222"
      ]
    }
  }
}
```

This tells Claude Code to:
- Launch `chrome-devtools-mcp` command
- Connect to Chrome via remote debugging on port 9222 (already forwarded in devcontainer.json)

### 3. Updated Devcontainer Setup Script
**File**: `.devcontainer/setup.sh`

Added automatic installation and configuration:
```bash
# Install Chrome DevTools MCP server
npm install -g chrome-devtools-mcp

# Create MCP configuration
cat > .mcp.json <<'EOF'
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "chrome-devtools-mcp",
      "args": ["--browserUrl", "http://127.0.0.1:9222"]
    }
  }
}
EOF
```

## ⚠️ REQUIRED: Restart Claude Code

**The MCP configuration will NOT be active until you restart Claude Code.**

Claude Code only reads `.mcp.json` on startup, so you need to:
1. Exit the current Claude Code session
2. Restart Claude Code
3. Reopen the project

After restart, all `mcp__chrome__*` tools will be available:
- `mcp__chrome__list_pages`
- `mcp__chrome__new_page`
- `mcp__chrome__navigate_page`
- `mcp__chrome__take_snapshot`
- `mcp__chrome__take_screenshot`
- `mcp__chrome__click`
- `mcp__chrome__fill`
- `mcp__chrome__evaluate_script`
- And more...

## Testing After Restart

Once restarted, verify MCP tools are working:

```typescript
// Should list open Chrome tabs/pages
mcp__chrome__list_pages()

// Should navigate to localhost:5173
mcp__chrome__navigate_page({ url: "http://localhost:5173" })

// Should capture page structure
mcp__chrome__take_snapshot()
```

## Workflow for Setlist Testing

After restart, the testing flow will be:

1. **Start Chrome** with remote debugging:
   ```bash
   /home/vscode/chrome/chrome/linux-141.0.7390.122/chrome-linux64/chrome \
     --headless=new \
     --remote-debugging-port=9222 \
     --no-sandbox \
     --disable-gpu \
     http://localhost:5173
   ```

2. **List pages** to find the app:
   ```typescript
   mcp__chrome__list_pages()
   ```

3. **Navigate to Setlists page**:
   ```typescript
   mcp__chrome__navigate_page({ url: "http://localhost:5173/setlists" })
   ```

4. **Take snapshot** to see page structure:
   ```typescript
   mcp__chrome__take_snapshot()
   ```

5. **Click/Fill/Interact** to test setlist CRUD operations

6. **Check Supabase** after each operation:
   ```bash
   docker exec -i supabase_db_rock-on psql -U postgres -c \
     "SELECT id, name, status FROM public.setlists;"
   ```

## Files Modified

1. **`.mcp.json`** - New MCP configuration file
2. **`.devcontainer/setup.sh`** - Updated to auto-install Chrome MCP server
3. **`.claude/artifacts/2025-10-26T23:20_chrome-mcp-setup.md`** - This documentation

## Next Steps

1. **User action required**: Restart Claude Code
2. **After restart**: Test setlist management workflow
3. **Verify**: RLS policies work correctly for setlists

## Reference

- Chrome DevTools MCP: https://developer.chrome.com/blog/chrome-devtools-mcp
- GitHub: https://github.com/ChromeDevTools/chrome-devtools-mcp
- npm package: `chrome-devtools-mcp`

---

**Status**: ✅ Configured - **Awaiting Claude Code restart**
**Next**: Restart Claude Code → Test setlist management → Verify RLS
