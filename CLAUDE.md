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
- `pnpm notion-fetch` - sync from Notion
- `pnpm format` - format (mandatory pre-commit)
- `pnpm lint` - lint (mandatory pre-commit)
- `pnpm test:tools` - all tests
- `pnpm test:notion-fetch` - notion-fetch tests
- `pnpm test:remark-embed` - remark-embed tests

## Architecture
- Content: Notion→notion-fetch→src/content/post/*.md (auto, **DO NOT EDIT**)
- Images: auto→public/images/{slug}/ (**DO NOT EDIT**)
- Path aliases: @lib/{notion,post,i18n,query}
- Details: tools/notion-fetch/README.md

## Dirs
- src/components/: Astro/React UI
- src/content/post/: auto-gen MD (**DO NOT EDIT**)
- src/libs/: internal libs
- src/pages/: routes, API, OG gen
- src/pages/embed/: link preview
- src/pages/og/: OG image gen
- tools/notion-fetch/: Notion sync
- tools/remark-embed/: remark plugin
- public/images/: auto-managed (**DO NOT EDIT**)

## Rules
- **NO EDIT**: src/content/post/*.md, public/images/
- **NO** `as any` assertions
- Component: .astro (static) vs .tsx (interactive)
- i18n: `<slug>.md` (ja), `<slug>.en.md` (en)
- Code comments: Japanese
- User communication: Japanese
- Conventional Commits format

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
- [ ] lint pass
- [ ] format done
- [ ] build success
- [ ] No auto-gen files modified
- [ ] No `as any`
- [ ] TDD tests included

## Error Policy
**CRITICAL**: Fix errors immediately. NO workarounds (it.skip, eslint-disable). Tests block progress.

## Tools Priority
1. mcp__ide__getDiagnostics
2. mcp__eslint__lint-files
3. Read
4. Bash (last resort)

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
