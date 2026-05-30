# GitHub Copilot Instructions for blog.lacolaco.net

## Project Overview
- Personal blog built with Astro 4.x, React 18.x, and Tailwind CSS 3.x
- Content from Notion via custom transformation pipeline
- Supports Japanese (default) and English locales via Astro i18n
- TypeScript with Zod for schema validation, pnpm package manager

## Key Boundaries
- DO NOT modify content files in `content/notion/**` - these are auto-generated
- Application code is editable (components, utilities, styles)
- Only suggest Astro components (.astro) when no client interactivity needed
- React components (.tsx) should be used only when client-side interactivity is required

## Code Guidelines
- Use TypeScript for all files
- Prefer Astro components over React when possible
- Use Tailwind for styling (check existing patterns in similar components)
- Use Zod for validation with exported inferred types
- Use English for all comments and documentation
- Keep code comments minimal - prioritize self-documenting code
- Always verify code after modification
- Handle errors with typed error responses, avoid generic catch blocks

## Structure & Extensions
- `src/`
  - `components/*.astro|*.tsx` - UI components
  - `layouts/*.astro` - Page layouts
  - `pages/*.astro|*.ts` - Routes and endpoints
  - `libs/*.ts` - Shared utilities
- `content/`
  - `notion/posts/*.md` - DO NOT EDIT (Notion sync output)
  - `notion/{tags,channels}.json` - DO NOT EDIT (Notion propertyOutputs)
  - `posts/*.md` - direct-write articles (editable)
- `tools/auto-translate/*.ts` - ja→en translation pipeline
- Notion sync itself lives in the external `lacolaco/blog-contents` repo and writes to `content/notion/` via cross-repo PR (no local sync command)

## i18n Implementation
- Files follow `src/pages/[locale]/path.astro` pattern
- Use `getRelativeLocaleUrl()` for links between pages
- Reference existing i18n implementations in similar components

## Naming Conventions
- React components: PascalCase (.tsx)
- Astro components: PascalCase (.astro)
- Utilities: camelCase (.ts)
- Type/schema definitions: PascalCase with Type/Schema suffix

## Commands & Verification
- Development: `pnpm run dev`
- Translation: `pnpm run auto-translate` (runs ja→en for newly synced ja .md)
- Always test changes with appropriate command

## Git Commit
- Format: `<type>[scope]: <description>`
- Types: feat, fix, docs, style, refactor, perf, test, chore
- Present tense, imperative mood

## Communication
- Use technical language appropriate for Astro developers
- Keep responses concise and practical
- Communicate in user's preferred language (Japanese or English)
