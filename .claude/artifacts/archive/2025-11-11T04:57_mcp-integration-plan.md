---
created: 2025-11-11T04:57
type: implementation-plan
status: active
priority: high
---

# MCP Integration Plan for Agent Workflow

## Executive Summary

This document outlines our plan to integrate Model Context Protocol (MCP) servers with the new agent workflow system. MCP servers provide specialized capabilities to agents, dramatically enhancing their effectiveness.

**Current Status:**
- ✅ Playwright MCP - Already installed and configured
- ✅ Chrome DevTools MCP - Already installed and configured
- ✅ Supabase (local) - Available via local docker container
- ⏳ ESLint MCP - Available (ESLint v9.26.0+), needs configuration

**Implementation Phase:**
- Phase 1: Configure available servers (Supabase local, ESLint)
- Phase 2: Install high-priority servers (GitHub, PostgreSQL, Git)
- Phase 3: Install medium-priority servers (TypeScript, MarkItDown, etc.)

---

## Currently Available MCP Servers

### 1. Playwright MCP ✅ CONFIGURED

**Status:** Already installed and working

**Package:** `@microsoft/playwright-mcp` (or `executeautomation/mcp-playwright`)

**Usage:** Test Agent (PRIMARY)

**Features:**
- Browser automation
- E2E test execution
- Screenshot capture
- Multi-browser support

**Claude CLI Command:**
```bash
# Already configured - no action needed
# Test Agent will use: mcp__playwright__* tools
```

---

### 2. Chrome DevTools MCP ✅ CONFIGURED

**Status:** Already installed and working

**Usage:**
- Test Agent (debugging E2E failures)
- Execute Agent (visual self-checking)
- Diagnose Agent (reproducing issues)

**Features:**
- Live browser inspection
- Console monitoring
- Network request inspection
- Performance profiling
- Screenshots and snapshots

**Claude CLI Command:**
```bash
# Already configured - no action needed
# Agents will use: mcp__chrome-devtools__* tools
```

---

### 3. Supabase (Local Docker) ✅ AVAILABLE

**Status:** Running in local devcontainer, needs MCP bridge configuration

**Location:** Local Docker container (part of devcontainer)
- PostgreSQL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Supabase Studio: `http://127.0.0.1:54323`

**Usage:** Supabase Agent (PRIMARY), Test Agent, Diagnose Agent

**MCP Integration Options:**

**Option A: Use Local PostgreSQL MCP Server**
```json
{
  "mcpServers": {
    "supabase-local": {
      "command": "npx",
      "args": ["-y", "postgres-mcp"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
      }
    }
  }
}
```

**Option B: Use Official Supabase MCP (Remote)**
```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "transport": "http",
      "auth": "oauth2"
    }
  }
}
```

**Recommendation:** Use Option A for local development (direct connection to local Supabase)

**Features via PostgreSQL MCP:**
- Direct SQL queries
- Schema inspection
- Performance analysis
- RLS policy testing

**Claude CLI Command:**
```bash
# Configure PostgreSQL MCP to connect to local Supabase
# Add to Claude Code MCP configuration

# Test connection:
# psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT version()"
```

**Future .devcontainer Integration:**
```json
// Add to .devcontainer/devcontainer.json "postCreateCommand"
"postCreateCommand": "npm install -g postgres-mcp && echo 'MCP servers installed'"
```

---

### 4. ESLint MCP ✅ AVAILABLE

**Status:** ESLint v9.26.0+ installed, MCP mode available

**Package:** Part of ESLint (`@eslint/mcp@latest`)

**Usage:** Execute Agent, Finalize Agent

**Features:**
- Run linting checks
- Explain rule violations
- Auto-fix issues
- Integration with AI tools

**Configuration:**

Add to Claude Code MCP config:
```json
{
  "mcpServers": {
    "eslint": {
      "command": "npx",
      "args": ["eslint", "--mcp"]
    }
  }
}
```

**Claude CLI Command:**
```bash
# Test ESLint MCP mode
npx eslint --mcp --help

# Use in agent workflow:
# eslint-mcp: check_files
# eslint-mcp: auto_fix
# eslint-mcp: explain_violation
```

**Integration Points:**
- Execute Agent: Run linting during implementation
- Finalize Agent: Final quality check before commit

---

## Planned MCP Servers

### Phase 2: High Priority (Install This Week)

#### 5. GitHub MCP 🎯 PLANNED

**Official:** GitHub (public preview)
**Hosted:** `https://api.githubcopilot.com/mcp/`
**Status:** Requires OAuth setup

**Usage:** Finalize Agent (PRIMARY), Research Agent

**Features:**
- Create pull requests
- Manage issues and labels
- Search repositories
- Code search across GitHub
- OAuth authentication (no PAT needed)

**Configuration:**
```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "transport": "http",
      "auth": "oauth2"
    }
  }
}
```

**Benefits:**
- Finalize Agent creates PRs with one command
- Auto-assign reviewers
- No manual git commands
- Search code across entire GitHub

**Blocker:** Requires GitHub Copilot OAuth setup

---

#### 6. PostgreSQL MCP 🎯 PLANNED

**Package:** `postgres-mcp` or `postgres-mcp-pro`
**GitHub:** https://github.com/crystaldba/postgres-mcp
**Status:** Ready to install

**Usage:** Supabase Agent, Test Agent

**Features:**
- Direct PostgreSQL queries
- Schema inspection
- Performance analysis
- Read/write access (configurable)

**Configuration:**
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "postgres-mcp"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
      }
    }
  }
}
```

**Installation:**
```bash
# Test installation
npx -y postgres-mcp --help

# Verify connection to local Supabase
# (connection string from env)
```

**Future .devcontainer Integration:**
```json
"postCreateCommand": "npm install -g postgres-mcp"
```

---

#### 7. Git MCP 🎯 PLANNED

**Official:** Model Context Protocol reference server
**Package:** `@modelcontextprotocol/server-git`
**Status:** Ready to install

**Usage:** Diagnose Agent, Research Agent

**Features:**
- Read Git repositories
- Search commit history
- Manipulate branches
- View diffs
- Git blame

**Configuration:**
```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "/workspaces/rock-on/.git"]
    }
  }
}
```

**Installation:**
```bash
# Test installation
npx -y @modelcontextprotocol/server-git --help
```

**Benefits:**
- Diagnose Agent: Find when bugs were introduced
- Research Agent: Analyze code history
- Automated git blame for root cause analysis

**Future .devcontainer Integration:**
```json
"postCreateCommand": "npm install -g @modelcontextprotocol/server-git"
```

---

### Phase 3: Medium Priority (Next Sprint)

#### 8. TypeScript MCP 📊 PLANNED

**GitHub:** https://github.com/catpaladin/mcp-typescript-assistant
**Status:** Available via LobeHub MCP registry

**Usage:** Execute Agent, Diagnose Agent

**Features:**
- TypeScript code analysis
- Type information
- ESLint integration
- Best practices suggestions

**Installation:** TBD (check LobeHub registry)

---

#### 9. MarkItDown MCP 📊 PLANNED

**Official:** Microsoft
**GitHub:** https://github.com/microsoft/markitdown
**Status:** Ready to install

**Usage:** Research Agent, Finalize Agent

**Features:**
- Convert PDF, DOCX, PPTX to Markdown
- Structured conversion
- Preserve formatting

**Configuration:**
```json
{
  "mcpServers": {
    "markitdown": {
      "command": "npx",
      "args": ["-y", "@microsoft/markitdown-mcp"]
    }
  }
}
```

**Use Case:** Convert design docs and specs to markdown

---

#### 10. Markdown Library MCP 📊 PLANNED

**GitHub:** https://github.com/lethain/library-mcp
**Status:** Ready to install

**Usage:** Research Agent, Plan Agent

**Features:**
- Index markdown knowledge bases
- Search across docs
- Version-aware search
- Support for local files, GitHub, npm

**Configuration:**
```json
{
  "mcpServers": {
    "library": {
      "command": "npx",
      "args": ["-y", "library-mcp", "/workspaces/rock-on/.claude"]
    }
  }
}
```

**Use Case:** Search all `.claude/` documentation instantly

---

#### 11. SQLite MCP 📊 PLANNED

**GitHub:** https://github.com/simonholm/sqlite-mcp-server
**Status:** Ready to install

**Usage:** Test Agent (for E2E test data)

**Features:**
- SQLite database operations
- Works with filesystem MCP
- Perfect for test databases

**Configuration:**
```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@simonholm/sqlite-mcp-server", "/workspaces/rock-on/tests/test-data.db"]
    }
  }
}
```

**Use Case:** Manage test data for E2E tests

---

#### 12. Filesystem MCP 📊 PLANNED

**Official:** Model Context Protocol reference server
**Package:** `@modelcontextprotocol/server-filesystem`
**Status:** Ready to install

**Usage:** All agents (for safe file access)

**Features:**
- Secure file operations
- Configurable access controls
- Read/write permissions

**Configuration:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspaces/rock-on"]
    }
  }
}
```

**Use Case:** Enhanced file safety across all agents

---

## Agent-to-MCP Mapping

| Agent | Current MCP | Planned MCP |
|-------|-------------|-------------|
| **Research** | - | Markdown Library, Git, GitHub (search) |
| **Plan** | - | Markdown Library |
| **Execute** | Chrome (self-check) | ESLint |
| **Supabase** | - | PostgreSQL (local), Supabase (remote) |
| **Test** | Playwright, Chrome | SQLite (test data) |
| **Diagnose** | Chrome | Git, PostgreSQL |
| **Finalize** | - | GitHub, ESLint, MarkItDown |

---

## Implementation Timeline

### Week 1 (Current): Phase 1 - Configure Available

**Day 1-2:**
- [x] Create all agent definitions
- [ ] Configure Supabase local via PostgreSQL MCP
- [ ] Configure ESLint MCP
- [ ] Test Playwright MCP integration with Test Agent
- [ ] Test Chrome MCP integration with Execute Agent
- [ ] Document Claude CLI commands

**Day 3-4:**
- [ ] Create test feature using agent workflow
- [ ] Validate MCP integrations work
- [ ] Document any issues
- [ ] Refine agent prompts

**Day 5:**
- [ ] Create implementation guide
- [ ] Update CLAUDE.md with agent workflow
- [ ] Team review and feedback

---

### Week 2: Phase 2 - High Priority Servers

**Day 1:**
- [ ] Install GitHub MCP
- [ ] Set up OAuth authentication
- [ ] Test PR creation with Finalize Agent

**Day 2:**
- [ ] Install PostgreSQL MCP
- [ ] Configure connection to local Supabase
- [ ] Test with Supabase Agent

**Day 3:**
- [ ] Install Git MCP
- [ ] Test with Diagnose Agent
- [ ] Validate git history search

**Day 4-5:**
- [ ] Run full workflow with all MCP servers
- [ ] Document improvements
- [ ] Measure time savings

---

### Week 3+: Phase 3 - Medium Priority

- [ ] Install TypeScript MCP
- [ ] Install MarkItDown MCP
- [ ] Install Markdown Library MCP
- [ ] Install SQLite MCP
- [ ] Install Filesystem MCP

---

## MCP Server Registration Commands

Use `claude mcp add` to register MCP servers. Once registered, agents automatically have access to the tools.

### Currently Registered (Already Working)

```bash
# Playwright MCP - Already configured
# Test Agent uses: mcp__playwright__* tools

# Chrome DevTools MCP - Already configured
# Execute/Test/Diagnose Agents use: mcp__chrome-devtools__* tools
```

### Add These Now (Phase 1)

```bash
# PostgreSQL MCP (for local Supabase)
claude mcp add postgres -- npx -y postgres-mcp

# Environment variable needed:
export POSTGRES_CONNECTION_STRING="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# ESLint MCP
claude mcp add eslint -- npx eslint --mcp
```

### Add These Next (Phase 2)

```bash
# GitHub MCP (hosted)
claude mcp add github -- \
  --url https://api.githubcopilot.com/mcp/ \
  --transport http \
  --auth oauth2

# Git MCP
claude mcp add git -- npx -y @modelcontextprotocol/server-git /workspaces/rock-on/.git
```

### Future Additions (Phase 3)

```bash
# TypeScript MCP
claude mcp add typescript -- npx -y mcp-typescript-assistant

# MarkItDown MCP
claude mcp add markitdown -- npx -y @microsoft/markitdown-mcp

# Markdown Library MCP (index .claude/ docs)
claude mcp add library -- npx -y library-mcp /workspaces/rock-on/.claude

# SQLite MCP
claude mcp add sqlite -- npx -y @simonholm/sqlite-mcp-server /workspaces/rock-on/tests/test-data.db

# Filesystem MCP
claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem /workspaces/rock-on
```

### .devcontainer Integration (Planned)

Add to `.devcontainer/setup.sh`:

```bash
#!/bin/bash

echo "Setting up MCP servers..."

# Install global MCP tools
npm install -g postgres-mcp @modelcontextprotocol/server-git

# Configure environment
export POSTGRES_CONNECTION_STRING="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Register MCP servers
claude mcp add postgres -- npx -y postgres-mcp
claude mcp add eslint -- npx eslint --mcp
claude mcp add git -- npx -y @modelcontextprotocol/server-git /workspaces/rock-on/.git

echo "MCP servers configured!"
```

### Verifying MCP Tools

```bash
# List all registered MCP servers
claude mcp list

# Test a specific server
claude mcp test postgres
```

---

## Configuration Files

### .devcontainer/devcontainer.json (Future Enhancement)

```json
{
  "name": "Rock-On Development",
  "dockerComposeFile": "../docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspaces/rock-on",

  "postCreateCommand": "bash .devcontainer/setup.sh && npm install && npm run install-mcp-servers",

  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "ms-playwright.playwright"
      ],
      "settings": {
        "mcp.servers": {
          "eslint": {
            "command": "npx",
            "args": ["eslint", "--mcp"]
          },
          "postgres": {
            "command": "npx",
            "args": ["-y", "postgres-mcp"],
            "env": {
              "POSTGRES_CONNECTION_STRING": "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
            }
          },
          "git": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-git", "/workspaces/rock-on/.git"]
          }
        }
      }
    }
  }
}
```

### package.json (New Scripts)

```json
{
  "scripts": {
    "install-mcp-servers": "npm install -g postgres-mcp @modelcontextprotocol/server-git @microsoft/markitdown-mcp library-mcp @simonholm/sqlite-mcp-server",
    "test-mcp": "bash .claude/scripts/test-mcp-servers.sh"
  }
}
```

### .claude/scripts/test-mcp-servers.sh (New File)

```bash
#!/bin/bash

echo "Testing MCP Server Connectivity..."

# Test PostgreSQL MCP
echo "1. PostgreSQL MCP..."
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT version()" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ PostgreSQL connection working"
else
  echo "   ❌ PostgreSQL connection failed"
fi

# Test ESLint MCP
echo "2. ESLint MCP..."
npx eslint --mcp --help > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ ESLint MCP available"
else
  echo "   ❌ ESLint MCP not available"
fi

# Test Git MCP
echo "3. Git MCP..."
npx -y @modelcontextprotocol/server-git --help > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ Git MCP available"
else
  echo "   ❌ Git MCP not available"
fi

echo ""
echo "MCP Server Status Check Complete"
```

---

## Benefits Summary

### With MCP Integration

**Supabase Agent + PostgreSQL MCP:**
- ✅ Query actual database state
- ✅ Validate RLS policies with real queries
- ✅ Inspect schema vs expected
- ✅ **Eliminates "shotgun fixes"**

**Finalize Agent + GitHub MCP + ESLint MCP:**
- ✅ Auto-fix linting errors
- ✅ Create PRs with one command
- ✅ Assign reviewers automatically
- ✅ **No manual git workflow**

**Diagnose Agent + Git MCP + Chrome MCP:**
- ✅ Find when bugs introduced
- ✅ Git blame for root cause
- ✅ Reproduce failures visually
- ✅ **Automated root cause analysis**

**Execute Agent + Chrome MCP + ESLint MCP:**
- ✅ Visual self-checking
- ✅ Lint during implementation
- ✅ Catch bugs before Test Agent
- ✅ **Reduced test failures**

**Test Agent + Playwright MCP + Chrome MCP:**
- ✅ Automated E2E tests
- ✅ Visual debugging
- ✅ Screenshot comparison
- ✅ **Comprehensive testing**

---

## Success Metrics

**Measure After Phase 2 Complete:**

1. **Time Savings:**
   - Time from feature request to PR creation
   - Manual git commands eliminated
   - Debugging time reduced

2. **Quality Improvements:**
   - Test failure rate (should decrease)
   - Bugs caught before Test Agent
   - Lint violations eliminated

3. **Agent Effectiveness:**
   - Supabase Agent: DB changes correct first time
   - Finalize Agent: PRs created without manual intervention
   - Diagnose Agent: Root causes found faster

4. **Developer Experience:**
   - Workflow steps reduced
   - Documentation quality improved
   - Confidence in deployments increased

---

## Next Steps

### Immediate (This Week)

1. **Configure Available MCP Servers:**
   - [ ] PostgreSQL MCP for local Supabase
   - [ ] ESLint MCP for linting
   - [ ] Test Chrome MCP with Execute Agent
   - [ ] Test Playwright MCP with Test Agent

2. **Create Remaining Agent Definitions:**
   - [x] research-agent.md
   - [x] plan-agent.md
   - [x] execute-agent.md
   - [ ] supabase-agent.md
   - [ ] test-agent.md
   - [ ] diagnose-agent.md
   - [ ] finalize-agent.md

3. **Test Workflow End-to-End:**
   - [ ] Pick small feature
   - [ ] Run through full workflow
   - [ ] Document learnings
   - [ ] Refine agent prompts

### Short-Term (Next Week)

1. **Install High-Priority MCP Servers:**
   - [ ] GitHub MCP (requires OAuth)
   - [ ] Git MCP
   - [ ] Additional PostgreSQL MCP tools

2. **Create Supporting Documentation:**
   - [ ] Claude CLI command reference
   - [ ] MCP troubleshooting guide
   - [ ] Agent workflow quick start

### Medium-Term (Next Sprint)

1. **Install Remaining MCP Servers:**
   - [ ] TypeScript MCP
   - [ ] MarkItDown MCP
   - [ ] Markdown Library MCP
   - [ ] SQLite MCP
   - [ ] Filesystem MCP

2. **Add to .devcontainer:**
   - [ ] Auto-install MCP servers
   - [ ] Configure in devcontainer.json
   - [ ] Test fresh container setup

---

**Status:** Phase 1 in progress
**Last Updated:** 2025-11-11T04:57
**Next Review:** After Phase 1 complete
