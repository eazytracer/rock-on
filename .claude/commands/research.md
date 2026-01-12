---
description: Start feature research - analyzes codebase and creates research document
---

# Feature Research

Start researching a new feature or improvement. This command spawns the research-agent to analyze the codebase and create a comprehensive research document.

## Usage

```
/research <feature-name-or-description>
```

## Examples

```
/research improved-auth-flow
/research Add dark mode support
/research Fix the songs page performance issue
```

## What This Does

1. **Creates feature directory**: `.claude/features/<feature-name>/`
2. **Analyzes codebase**: Searches for related components, patterns, dependencies
3. **Documents findings**: Creates `YYYY-MM-DDTHH:MM_research.md` with:
   - Current state analysis
   - Related components (with file:line references)
   - Database impact assessment
   - Risk analysis
   - Recommended approaches
   - Open questions

## Process

The research-agent will:

1. **Understand the Request**
   - Parse user input: $ARGUMENTS
   - Identify core requirements vs nice-to-haves
   - Ask clarifying questions if needed

2. **Search the Codebase**
   - Find related components using Glob/Grep
   - Read existing implementations
   - Check database schema in `.claude/specifications/unified-database-schema.md`
   - Identify existing patterns to follow

3. **Analyze Dependencies**
   - Map affected files
   - Identify integration points
   - Note potential breaking changes

4. **Risk Assessment**
   - Classify risks (High/Medium/Low)
   - Suggest mitigation strategies

5. **Create Research Document**
   - Get timestamp: `date +%Y-%m-%dT%H:%M`
   - Create: `.claude/features/<feature-name>/<timestamp>_research.md`
   - Include recommended approaches with trade-offs

## Next Steps After Research

Once research is complete, proceed to planning:

```
/plan <feature-name>
```

## User Input

$ARGUMENTS
