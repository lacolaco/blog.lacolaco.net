# CLAUDE.md

## Project
Astro 5.x blog, Notion CMS, bilingual (ja/en), Angular focus

## Stack
- Node.js 22+, pnpm 10.16.1, TS strict
- Astro 5.x+React, Tailwind 4.x
- GCP: Cloud Run, Cloud Storage (OG cache)
- ENV: NOTION_AUTH_TOKEN, NOTION_DATABASE_ID, GCS_BUCKET_NAME

## Commands
- `pnpm dev` - dev server
- `pnpm build` - production build
- `pnpm preview` - preview build
- `pnpm notion-sync` - sync from Notion (@lacolaco/notion-sync@2.3.0)
- `pnpm format` - format (mandatory pre-commit)
- `pnpm lint` - lint (mandatory pre-commit)
- `pnpm test:tools` - all tests
- `pnpm test:remark-embed` - remark-embed tests

## Architecture
- Content: Notion→notion-sync→src/content/post/*.md (auto, **DO NOT EDIT**)
- Images: auto→public/images/{slug}/ (**DO NOT EDIT**)
- Metadata: notion-sync→src/content/post/metadata.json→tags.json/categories.json
- Path aliases: @lib/{notion,post,i18n,query}

## Dirs
- src/components/: Astro/React UI
- src/content/post/: auto-gen MD (**DO NOT EDIT**)
- src/content/tags/: auto-gen tags.json (**DO NOT EDIT**)
- src/content/categories/: auto-gen categories.json (**DO NOT EDIT**)
- src/libs/: internal libs
- src/pages/: routes, API, OG gen
- src/pages/embed/: link preview
- src/pages/og/: OG image gen
- tools/notion-sync/: Notion sync (@lacolaco/notion-sync)
- tools/remark-embed/: remark plugin
- public/images/: auto-managed (**DO NOT EDIT**)

## Rules
- **NO EDIT**: src/content/post/*.md, src/content/tags/tags.json, src/content/categories/categories.json, public/images/
- **NO** `as any` assertions
- Component: .astro (static) vs .tsx (interactive)
- i18n: `<slug>.md` (ja), `<slug>.en.md` (en)
- Code comments: Japanese
- User communication: Japanese
- Conventional Commits format

## Data Deletion Protocol (CRITICAL)

**NEVER delete files/directories without explicit user approval, even if:**
- You believe they are "old" or "duplicate"
- You think compatibility has been verified
- The user said to "check compatibility" (checking ≠ deleting)

**Steps for any deletion:**
1. Present COMPLETE analysis of what will be deleted
2. Show EXACT consequences and risks
3. Wait for EXPLICIT user approval with "yes, delete"
4. Only then proceed with deletion

**Example violation:** User: "Check compatibility first" → You: Delete files immediately
**Correct approach:** User: "Check compatibility first" → You: Complete analysis → Show results → Wait for approval → Then delete

## Exact Match Requirements

When user says "完全一致" or "exact match":
- **NO** concept of "acceptable differences"
- **NO** filtering by "important fields"
- **NO** assumptions about what user will tolerate
- Compare EVERYTHING byte-by-byte
- Report ALL differences found
- Let user decide what is acceptable

**You do NOT have authority to:**
- Define "important vs unimportant" fields
- Judge "acceptable vs unacceptable" differences
- Filter or hide any differences

## Root Cause Analysis Protocol

When you receive errors or user corrections, **NEVER just fix the surface problem**. Always ask:

**1. Why did this happen?** (なぜこれが起きたのか)
- Not the surface reason ("I forgot X")
- The deep reason ("Which thought process was missing?")
- Example: Not "I forgot to check dependencies" but "I assumed my changes were isolated without verifying"

**2. What did I not check?** (何を確認しなかったか)
- Dependencies and impact scope
- Integration with existing code
- All references to changed files
- Complete validation of generated content

**3. What assumption was wrong?** (どの前提が間違っていたか)
- "This is an existing issue" without proof
- "This is simple" without verification
- "The library doesn't support X" without checking latest version

**4. How do I prevent this pattern?** (このパターンをどう防ぐか)
- Specific verification steps to add
- Thought process improvements
- Not just "be more careful" - concrete actions

**Document your root cause analysis:**
- When making significant mistakes, add specific prevention rules to CLAUDE.md
- Focus on thought process improvements, not just behavioral rules

## Library Investigation Protocol

**BEFORE implementing any solution involving external libraries:**

**1. Check Latest Version & Changelog**
- Read package's latest version and CHANGELOG
- Check if recent versions solve your problem
- **If user mentions a version number (e.g., "notion-sync@2.3.0"), treat it as highest priority hint**

**2. Understand Library Scope**
- Read README, type definitions, examples
- Understand what the library abstracts (e.g., @lacolaco/notion-sync abstracts Notion SDK)
- Know the boundaries of provided functionality

**3. Respect Library Abstractions**
- **NEVER bypass library abstractions** (e.g., using Notion SDK directly when @lacolaco/notion-sync exists)
- If library hides implementation details, there's a reason
- Before breaking abstraction, check if library update/config solves the issue

**4. Version Upgrade First**
- If current version lacks features, try upgrading first
- Check if configuration options provide needed functionality
- Only implement custom solution if library truly doesn't support it

**Example violation:** Using Notion SDK directly when @lacolaco/notion-sync v2.3.0 provides the needed feature
**Correct approach:** Check latest version → Find v2.3.0 adds the feature → Upgrade and use it

## TDD (NON-NEGOTIABLE)
- **Kent Beck style**.
- Tests = spec, fix impl not tests. 
- Conclude: lint + format

## Deployment
- GCP Cloud Run, GitHub Actions
- Production: main→deploy-production.yml
- Preview: PR→deploy-preview.yml
- **NEVER test on production workflows**
- Docker: multi-stage, build in GHA not Docker

## Pre-commit Checklist
- [ ] test:tools pass
- [ ] test:libs pass
- [ ] lint pass
- [ ] format done
- [ ] build success
- [ ] No auto-gen files modified
- [ ] No `as any`
- [ ] TDD tests included

## Error Policy
**CRITICAL**: Fix errors immediately. NO workarounds (it.skip, eslint-disable). Tests block progress.

**Test Failure Policy:**
When tests fail after your changes:
1. **ALWAYS assume your changes caused it** until proven otherwise
2. NEVER dismiss as "existing issues" without thorough investigation
3. Before concluding "existing issue", complete the investigation protocol below

**Investigation Protocol - Before Concluding "Existing Issue":**
1. List ALL files you changed/generated
2. Find ALL references to those files (use grep/Grep tool)
3. Check if error messages reference those files or their dependents
4. Verify the generated content is valid (not just first few lines)
5. Only after confirming ZERO relation, conclude "existing issue"
6. Report findings to user before any conclusion

**Command Execution Errors:**
- ANY command failure = STOP immediately
- Analyze failure cause before proceeding
- Report to user and wait for instruction
- Do NOT chain multiple failed attempts
- Do NOT assume alternative approaches without user input

**MANDATORY STOP on any command failure:**
1. Command fails (non-zero exit, error output, empty result)
2. IMMEDIATELY STOP all subsequent operations
3. Analyze failure cause
4. Report to user
5. Wait for user instruction

**NEVER:**
- Execute next command after previous failure
- Assume "it's fine" or "try different approach"
- Chain multiple attempts without user feedback

## Tools Priority
1. mcp__ide__getDiagnostics
2. mcp__eslint__lint-files
3. Read
4. Bash (last resort)

## Tool Selection for File Editing

**For JSON/structured file editing:**
1. Read + Edit tools (PREFERRED - type-safe, reliable)
2. Write tool (for complete rewrites)
3. Bash with jq/sed (LAST RESORT - error-prone)

**Use Bash commands ONLY for:**
- System operations (git, package managers)
- Data analysis (grep, wc, find for inspection)
- NOT for file content modification

**User explicitly stated:** "下手なコマンド使わず自分でEditしろ"

## Git
All git/GitHub ops→git-github-ops agent

## Content Processing
- Markdown: KaTeX, Mermaid, GFM, remark-embed, Shiki
- Images: Notion auto-download, OG via /og/{slug}.png, GCS cache
- OG: Satori+@resvg/resvg-js, Google Fonts subset

## Security
- No secrets in commits
- Validate inputs
- CSP headers
- Sanitize user HTML
