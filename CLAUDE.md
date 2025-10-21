# rock-on Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-27

## Active Technologies
- TypeScript 5.x with React 18+ + React, TailwindCSS, client-side database (TBD) (001-use-this-prd)

## Project Structure
```
src/
tests/
```

## Commands
npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style
TypeScript 5.x with React 18+: Follow standard conventions

## Recent Changes
- 001-use-this-prd: Added TypeScript 5.x with React 18+ + React, TailwindCSS, client-side database (TBD)

<!-- MANUAL ADDITIONS START -->
## Artifact creation
Whenever instructed to generate an artifact, assume the file will be stored in @.claude/artifacts unless explicitly stated otherwise. Create every artifact by running the bash command to get the current datetime and prepend the filename with a timestamp in the "YYYY-MM-DDTHH:mm_{filename}.md" format. Include frontmatter in the artifact that also includes the timestamp and a brief summary of the prompt you were given to make the artifact. When modifying an existing artifact, update the timestamp in the filename and add the new timestamp to the frontmatter as an "appended time" and provide secondary context as the nature of what was updated, do not overwrite the original frontmatter
<!-- MANUAL ADDITIONS END -->