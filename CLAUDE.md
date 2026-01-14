# CLAUDE.md

---
## 🚨 CRITICAL RULES (STOP IF VIOLATED)
---

These 3 rules are NON-NEGOTIABLE. Violating any = STOP and reassess.

### 1. Pre-Commit Review Gate
**TRIGGER**: After lint/format/build pass, BEFORE `git commit`

For significant changes (new features, refactoring, multi-file):
1. Run code-critic agent
2. Fix all findings
3. Run code-critic AGAIN to verify
4. Only then commit

**"lint/build passed" ≠ "ready to commit"**

### 2. Deletion Requires Explicit Approval
NEVER delete files/directories without user saying "yes, delete".
- "Check compatibility" ≠ permission to delete
- Show what will be deleted → Wait for approval → Then delete

### 3. TDD is Mandatory
Kent Beck style. Tests = spec. Fix implementation, not tests.

---
## Project Info
---

### Stack
- Astro 5.x blog, Notion CMS, bilingual (ja/en)
- Node.js 24+, pnpm 10.20.0, TS strict
- Astro 5.x+React, Tailwind 4.x
- GCP: Cloud Run, Cloud Storage (OG cache)
- Cloudflare R2: 画像CDN (images.blog.lacolaco.net)

### Commands
```
pnpm dev          # dev server (USE THIS for iteration)
pnpm build        # production build
pnpm lint         # mandatory pre-commit
pnpm format       # mandatory pre-commit
pnpm test:tools   # all tests
pnpm test:libs    # library tests
```

### Architecture
- Content: Notion→notion-sync→src/content/post/*.md (**DO NOT EDIT**)
- Images: public/images/{slug}/ → R2 CDN経由で配信 (**DO NOT EDIT**)
- Components: .astro (static) / .tsx (interactive)
- i18n: `<slug>.md` (ja), `<slug>.en.md` (en)

### Key Directories
- src/components/: UI components
- src/libs/: internal libraries
- src/pages/: routes, API, OG generation
- tools/: build tools (notion-sync, remark-embed)

---
## Standard Procedures
---

### Error Handling
- ANY error = STOP immediately, analyze, report to user
- NEVER chain failed attempts
- NEVER use workarounds (it.skip, eslint-disable)
- Test failures after your changes = assume your fault until proven otherwise

### Before Implementation
1. Search for similar existing code (Glob/Grep)
2. Check if library/pattern already exists
3. Read similar implementations first

### Git Operations
- Use git-github-ops agent for complex operations
- NEVER `git reset --hard` with uncommitted changes you need
- After PR creation: verify title/body match actual changes

### Tool Usage Priority
1. mcp__ide__getDiagnostics (for errors)
2. Read/Edit tools (for files)
3. Bash (last resort, NOT for file editing)

### When User Corrects You
1. Note what was wrong and why
2. Check for same pattern before similar actions in this session
3. If corrected 2+ times for same thing: STOP and analyze why

---
## Reference (Look Up When Needed)
---

### Package Management
- Only update explicitly requested packages
- `pnpm add` for runtime, `pnpm add -D` for dev
- Check package.json before adding

### Library Investigation
Before implementing with external libraries:
1. Check latest version/changelog
2. Respect library abstractions (don't bypass)
3. Upgrade before custom implementation

### File Editing
- Read file before Edit/Write
- Match existing patterns (language, format, structure)
- Use Edit tool, not Bash sed/awk

### Agent Outputs
- Never trust without verification
- Read actual files to confirm claims
- Verify before proceeding with agent's plan

### Code Style
- NO `as any`
- Comments in Japanese
- Conventional Commits format
- No emojis unless requested

---
## Feature Documentation
---

### AI Summarizer
- Chrome Summarizer API (Chrome 138+)
- Components: ArticleSummarizer.tsx, src/libs/summarizer/
- Analytics: summarize_start, summarize_complete, summarize_error

### TTS Read-Aloud
- Web Speech API (SpeechSynthesis)
- Components: TTSControls.tsx, src/libs/tts/
- Analytics: tts_start, tts_complete, tts_error

### Image CDN (Cloudflare R2)
- 画像はビルド時にR2 CDN URLに書き換え
- tools/astro-integration-image-cdn/: URL変換Astro integration
- tools/r2-sync/: R2へのアップロードスクリプト
- 環境変数: IMAGE_CDN_BASE_URL
- Dockerイメージから画像除外（.dockerignore）

### Deployment
- GCP Cloud Run via GitHub Actions
- Production: main→deploy-production.yml
- Preview: PR→deploy-preview.yml
- 画像同期: sync-with-notion.yml→R2
