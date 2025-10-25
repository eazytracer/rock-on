---
name: chrome-testing
description: Start Chrome with remote debugging for testing via Chrome MCP Server
tags: [testing, chrome, mcp, debugging]
---

# Chrome Testing Setup

Start Chrome with remote debugging enabled for UI testing via Chrome MCP Server.

## Prerequisites

1. **Dev server must be running**: `npm run dev` on port 5173
2. **Chrome MCP server must be configured** in Claude Code settings
3. **Chrome binary must be available** at `/home/vscode/chrome/chrome/linux-141.0.7390.122/chrome-linux64/chrome`

## Basic Command

Run this command in the terminal:

```bash
/home/vscode/chrome/chrome/linux-141.0.7390.122/chrome-linux64/chrome \
  --headless=new \
  --remote-debugging-port=9222 \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir=/tmp/chrome-profile \
  http://localhost:5173 \
  > /tmp/chrome.log 2>&1 &
```

## Command Variations

### Desktop Testing (Default 1280x720)

```bash
/home/vscode/chrome/chrome/linux-141.0.7390.122/chrome-linux64/chrome \
  --headless=new \
  --remote-debugging-port=9222 \
  --no-sandbox \
  --disable-gpu \
  --window-size=1280,720 \
  http://localhost:5173 \
  > /tmp/chrome.log 2>&1 &
```

### Mobile Testing (iPhone X: 375x812)

```bash
/home/vscode/chrome/chrome/linux-141.0.7390.122/chrome-linux64/chrome \
  --headless=new \
  --remote-debugging-port=9222 \
  --no-sandbox \
  --disable-gpu \
  --window-size=375,812 \
  http://localhost:5173 \
  > /tmp/chrome.log 2>&1 &
```

### Tablet Testing (iPad: 768x1024)

```bash
/home/vscode/chrome/chrome/linux-141.0.7390.122/chrome-linux64/chrome \
  --headless=new \
  --remote-debugging-port=9222 \
  --no-sandbox \
  --disable-gpu \
  --window-size=768,1024 \
  http://localhost:5173 \
  > /tmp/chrome.log 2>&1 &
```

### With DevTools (Non-headless)

```bash
/home/vscode/chrome/chrome/linux-141.0.7390.122/chrome-linux64/chrome \
  --remote-debugging-port=9222 \
  --no-sandbox \
  --disable-gpu \
  http://localhost:5173 \
  > /tmp/chrome.log 2>&1 &
```

## Explanation of Flags

| Flag | Purpose | Required? |
|------|---------|-----------|
| `--headless=new` | Run in headless mode without display | Yes (in container) |
| `--remote-debugging-port=9222` | Enable Chrome DevTools Protocol on port 9222 for MCP access | Yes |
| `--no-sandbox` | Disable sandboxing | Yes (in Docker/container) |
| `--disable-gpu` | Disable GPU acceleration | Recommended (not available in container) |
| `--disable-dev-shm-usage` | Prevent shared memory issues in container | Recommended |
| `--no-first-run` | Skip first-run wizards and UI | Optional |
| `--no-default-browser-check` | Skip default browser check | Optional |
| `--user-data-dir=/tmp/chrome-profile` | Use temporary profile directory | Optional |
| `--window-size=WxH` | Set initial window size | Optional (default varies) |
| `http://localhost:5173` | URL to load on startup | Optional |
| `> /tmp/chrome.log 2>&1 &` | Log output and run in background | Recommended |

## Common Viewport Sizes

### Mobile (Portrait)
- iPhone SE: `--window-size=375,667`
- iPhone X/11/12/13: `--window-size=375,812`
- iPhone 14 Pro Max: `--window-size=414,896`
- Pixel 5: `--window-size=393,851`
- Galaxy S21: `--window-size=360,800`

### Mobile (Landscape)
- iPhone X/11/12/13: `--window-size=812,375`
- iPhone 14 Pro Max: `--window-size=896,414`

### Tablet
- iPad: `--window-size=768,1024`
- iPad Pro 11": `--window-size=834,1194`
- iPad Pro 12.9": `--window-size=1024,1366`

### Desktop
- Laptop: `--window-size=1280,720`
- Desktop HD: `--window-size=1920,1080`
- Desktop 4K: `--window-size=3840,2160`

## After Starting Chrome

### 1. Verify Chrome is Running

```bash
pgrep -f chrome
```

You should see a process ID. If not, check `/tmp/chrome.log` for errors.

### 2. Use Chrome MCP Tools

Once Chrome is running with remote debugging enabled, use these MCP tools:

#### Page Management
- `mcp__chrome__list_pages` - List open pages/tabs
- `mcp__chrome__new_page` - Create new page/tab
- `mcp__chrome__select_page` - Switch to a specific page
- `mcp__chrome__close_page` - Close a page/tab
- `mcp__chrome__navigate_page` - Navigate to URL
- `mcp__chrome__navigate_page_history` - Go back/forward

#### Inspection & Analysis
- `mcp__chrome__take_snapshot` - Get accessibility tree (for finding elements)
- `mcp__chrome__take_screenshot` - Capture visual state
- `mcp__chrome__evaluate_script` - Run JavaScript for measurements/interaction
- `mcp__chrome__list_console_messages` - View console logs
- `mcp__chrome__get_console_message` - Get specific console message
- `mcp__chrome__list_network_requests` - View network traffic
- `mcp__chrome__get_network_request` - Get specific request details

#### Interaction
- `mcp__chrome__click` - Click elements by uid (from snapshot)
- `mcp__chrome__dblClick` - Double-click elements
- `mcp__chrome__fill` - Fill form inputs
- `mcp__chrome__fill_form` - Fill multiple form fields at once
- `mcp__chrome__hover` - Hover over elements
- `mcp__chrome__drag` - Drag and drop elements
- `mcp__chrome__upload_file` - Upload files
- `mcp__chrome__handle_dialog` - Handle browser dialogs (alert, confirm, prompt)
- `mcp__chrome__wait_for` - Wait for text to appear

#### Viewport & Performance
- `mcp__chrome__resize_page` - Change viewport size
- `mcp__chrome__emulate_cpu` - Throttle CPU for performance testing
- `mcp__chrome__emulate_network` - Throttle network (Slow 3G, Fast 3G, etc.)
- `mcp__chrome__performance_start_trace` - Start performance recording
- `mcp__chrome__performance_stop_trace` - Stop performance recording
- `mcp__chrome__performance_analyze_insight` - Analyze performance metrics

### 3. Typical Testing Workflows

#### UI/Visual Testing
1. **Start Chrome** (run command above)
2. **List pages**: `mcp__chrome__list_pages`
3. **Navigate**: `mcp__chrome__navigate_page` to localhost:5173
4. **Take snapshot**: See page structure and element uids
5. **Take screenshots**: Capture visual state
6. **Interact**: Click, fill, scroll using element uids
7. **Verify**: Use screenshots and snapshots to confirm behavior

#### Responsive Design Testing
1. **Start Chrome** with mobile viewport size
2. **Navigate** to page
3. **Take screenshot**: Capture mobile view
4. **Measure elements**: Use `evaluate_script` with `getBoundingClientRect()`
5. **Resize**: Use `mcp__chrome__resize_page` for different sizes
6. **Repeat**: Capture and measure at each breakpoint

#### Performance Testing
1. **Start Chrome** with CPU/network throttling
2. **Navigate** to page
3. **Start trace**: `mcp__chrome__performance_start_trace`
4. **Interact**: Perform user actions
5. **Stop trace**: `mcp__chrome__performance_stop_trace`
6. **Analyze**: Review Core Web Vitals and performance insights

#### Debugging/Console Testing
1. **Start Chrome** and navigate to page
2. **List console messages**: `mcp__chrome__list_console_messages`
3. **Check for errors**: Filter by error type
4. **Inspect network**: `mcp__chrome__list_network_requests`
5. **Run scripts**: Use `evaluate_script` to debug issues

## Stopping Chrome

```bash
# Find Chrome process ID
pgrep -f chrome

# Kill Chrome
pkill -f chrome

# Or kill specific process
kill <process_id>
```

## Troubleshooting

### Chrome Won't Start

**Error**: "No usable sandbox"
- **Solution**: Ensure `--no-sandbox` flag is included

**Error**: "Missing X server or $DISPLAY"
- **Solution**: Use `--headless=new` mode

**Error**: "Address already in use"
- **Solution**: Kill existing Chrome process on port 9222
  ```bash
  pkill -f "remote-debugging-port=9222"
  ```

### MCP Connection Issues

**Error**: "Cannot connect to Chrome"
- **Solution**: Verify Chrome is running: `pgrep -f chrome`
- **Solution**: Check Chrome logs: `cat /tmp/chrome.log`
- **Solution**: Ensure port 9222 is not blocked

### Page Not Loading

**Error**: "Failed to load localhost:5173"
- **Solution**: Verify dev server is running: `curl http://localhost:5173`
- **Solution**: Start dev server: `npm run dev`

## Example: Measuring Element Overflow

```javascript
// Use mcp__chrome__evaluate_script
const viewport = { width: 375, height: 812 };
const results = [];

document.querySelectorAll('*').forEach(el => {
  const rect = el.getBoundingClientRect();
  if (rect.right > viewport.width) {
    results.push({
      tag: el.tagName,
      className: el.className,
      width: rect.width,
      right: rect.right,
      overflow: rect.right - viewport.width
    });
  }
});

return results.sort((a, b) => b.overflow - a.overflow).slice(0, 10);
```

## Example: Checking Console Errors

```javascript
// Use mcp__chrome__list_console_messages with type filter
// Then get specific messages with mcp__chrome__get_console_message

// Or use evaluate_script to check for errors
return {
  errorCount: console.errors?.length || 0,
  warningCount: console.warnings?.length || 0
};
```

## Example: Performance Testing

```javascript
// Use mcp__chrome__performance_start_trace with reload: true
// Wait for page to load
// Use mcp__chrome__performance_stop_trace
// Review metrics like:
// - Largest Contentful Paint (LCP)
// - First Input Delay (FID)
// - Cumulative Layout Shift (CLS)
// - Time to Interactive (TTI)
```

## Related Files

- **Mobile UI Verification**: `.claude/artifacts/2025-10-24T12:40_responsive-ui-fixes-verification.md`
- **High Priority Fixes**: `.claude/artifacts/2025-10-24T03:26_high-priority-fixes-completion.md`
- **Pre-deployment Audit**: `.claude/artifacts/2025-10-24T01:35_pre-deployment-audit-report.md`

## Testing Checklists

### UI Testing
- [ ] Chrome started with remote debugging
- [ ] Dev server running on port 5173
- [ ] Page loads successfully
- [ ] No console errors
- [ ] All interactive elements work
- [ ] Forms submit correctly
- [ ] Navigation functions properly

### Responsive Design Testing
- [ ] Mobile viewport (375px) - No horizontal overflow
- [ ] Tablet viewport (768px) - Layout adapts correctly
- [ ] Desktop viewport (1280px) - Full features visible
- [ ] Touch targets adequate size (min 44px on mobile)
- [ ] Text readable without zoom
- [ ] Images scale properly

### Performance Testing
- [ ] LCP < 2.5s (Good)
- [ ] FID < 100ms (Good)
- [ ] CLS < 0.1 (Good)
- [ ] No layout shifts
- [ ] Assets load efficiently
- [ ] No render-blocking resources

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility (aria labels)
- [ ] Sufficient color contrast
- [ ] Focus indicators visible
- [ ] Alt text on images

---

**Created**: 2025-10-24T12:40
**Updated**: 2025-10-24T12:45
**Purpose**: Enable comprehensive Chrome testing via Chrome MCP Server
**Usage**: Reference when starting Chrome for any testing session
