# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is lacolaco's personal blog built with **Astro 5.x** as a static site generator, using **Notion as a headless CMS**. The blog supports bilingual content (Japanese/English) and focuses on software development topics, particularly Angular.

## Prerequisites

**System Requirements:**

- **Node.js**: 22.x or later
- **pnpm**: 10.11.1 (exact version enforced by packageManager)
- **TypeScript**: ES modules enabled

**Environment Variables (.env):**

```bash
NOTION_AUTH_TOKEN=secret_*       # Notion Integration Token
NOTION_DATABASE_ID=*             # Notion Database ID
CLOUDFLARE_API_TOKEN=*          # Cloudflare API Token (for deployment)
```

**Initial Setup:**

1. Clone repository and install dependencies: `pnpm install`
2. Setup environment variables in `.env` file
3. Install Playwright browsers: `pnpm playwright install chromium`
4. Verify setup: `pnpm dev`

## Essential Commands

**Development:**

- `pnpm dev` - Start development server
- `pnpm build` - Build for production (includes Cloudflare Workers build)
- `pnpm preview` - Preview production build

**Content Management:**

- `pnpm notion-fetch` - Sync content from Notion (requires `.env` with Notion API credentials)

**Code Quality:**

- `pnpm format` - Format code with Prettier
- `pnpm lint` - Run ESLint to check for code issues
- `pnpm test:tools` - Run all tool tests (Node.js test runner)
- `pnpm test:notion-fetch` - Run notion-fetch tool tests specifically
- `pnpm test:remark-embed` - Run remark-embed plugin tests specifically

**Quality Assurance (MANDATORY before commits):**

- `pnpm lint` - ESLint code quality checks (tools/ directory only)
- `pnpm format` - Prettier code formatting (all files)

## Architecture Overview

**Content Pipeline:**

- Blog posts originate in **Notion** and are synced via custom `tools/notion-fetch/`
- Content is **directly transformed to Markdown** with frontmatter in `src/content/post/*.md` (**DO NOT EDIT MANUALLY**)
- **Images are automatically downloaded** to `public/images/{slug}/` directory during sync
- Uses Astro Content Collections with frontmatter for type safety

**notion-fetch Workflow:**

1. Fetch pages from Notion database via API
2. Transform each page to Markdown using `transformNotionPageToMarkdown()`
3. Extract image download tasks during transformation
4. Download images in parallel to slug-specific directories
5. Save Markdown files with correct image references (`/images/{slug}/{filename}`)

**Tech Stack:**

- **Astro 5.x** with React integration for interactive components
- **TypeScript** with strict configuration and path aliases (`@lib/*`)
- **Tailwind CSS 4.x** for styling
- **Cloudflare Pages** for hosting with Workers for serverless functions

**Key Directories:**

- `src/components/` - Astro/React UI components
- `src/content/post/` - Auto-generated blog post Markdown files (**DO NOT EDIT**)
- `src/libs/` - Internal TypeScript libraries (notion, post processing, i18n, querying)
- `src/pages/` - Astro routes including dynamic routes and OG image generation
- `tools/notion-fetch/` - Custom Notion CMS sync tool with direct Markdown generation
- `tools/remark-embed/` - Custom remark plugin for content embedding
- `functions/embed/` - Cloudflare Pages Functions for web link preview generation
- `public/images/` - Auto-managed image storage (**DO NOT EDIT MANUALLY**)

**notion-fetch Tool Architecture:**

- `tools/notion-fetch/main.ts` - Entry point and main processing flow
- `tools/notion-fetch/filesystem.ts` - FileSystem class for file operations with dry-run support
- `tools/notion-fetch/page-transformer.ts` - Converts Notion pages to Markdown with frontmatter
- `tools/notion-fetch/block-transformer.ts` - Converts individual Notion blocks to Markdown strings
- `tools/notion-fetch/utils.ts` - Utility functions (JSON formatting, metadata conversion, etc.)
- `tools/notion-fetch/notion-types.ts` - Comprehensive TypeScript types for Notion API
- `tools/notion-fetch/fixtures/` - Test fixtures for transformation logic

For detailed architecture and usage information, see @tools/notion-fetch/README.md

**Cloudflare Pages Functions:**

- `functions/embed/index.tsx` - Web page preview generation using Preact/Goober
- Extracts page titles from URLs for link previews
- Special handling for Amazon URLs with Googlebot UA
- 1-day browser cache + Cloudflare edge caching
- Built to `dist/worker/` during production build

**Internationalization:**

- Default locale: Japanese (`ja`)
- Supported locales: Japanese (`ja`), English (`en`)
- Use `getRelativeLocaleUrl()` for locale-aware links
- File naming: `<slug>.md` (Japanese), `<slug>.en.md` (English)
- Images stored in: `public/images/{slug}/{notion-id}/{filename}` structure

## Development Guidelines

**Component Selection:**

- Use **Astro components** (`.astro`) when no client-side interactivity is needed
- Use **React components** (`.tsx`) only when client-side interactivity is required

**Content Boundaries:**

- **NEVER modify** files in `src/content/post/*.md` - these are auto-generated from Notion
- **NEVER modify** files in `public/images/` - these are auto-managed by notion-fetch
- Application code (components, utilities, styles) is editable

**Code Standards:**

- TypeScript for all files with strict configuration
- Use Zod for validation with exported inferred types
- Prefer self-documenting code over extensive comments
- Use Japanese for all comments and documentation (this is a Japanese development environment)
- Follow functional programming patterns where appropriate
- Avoid side effects in pure functions
- **NEVER use `as any` type assertions** - always define proper types or use type guards

**Styling:**

- Use Tailwind CSS following existing patterns in similar components
- Reference `tailwind.config.js` for custom design tokens and Iconify integration

**Path Aliases:**

- `@lib/notion` → `src/libs/notion/index.ts`
- `@lib/post` → `src/libs/post/index.ts`
- `@lib/i18n` → `src/libs/i18n/index.ts`
- `@lib/query` → `src/libs/query/index.ts`

## Markdown Processing

Rich markdown support with custom plugins:

- **Math**: KaTeX for mathematical expressions
- **Diagrams**: Mermaid with SVG rendering strategy
- **GitHub Features**: Alerts, emojis, GFM support
- **Custom Embedding**: Via `tools/remark-embed/` plugin
- **Syntax Highlighting**: Shiki with GitHub light theme

## Testing

- Uses Node.js built-in test runner (`tsx --test`)
- Tests located in `tools/**/*.spec.ts`
- Playwright installed for browser automation (if needed)
- Run with `pnpm test:notion-fetch` or `pnpm test:remark-embed`

## Deployment

- **Target**: Cloudflare Pages with Workers
- **Build Output**: `dist/client/` (Astro) + `dist/worker/` (Workers)
- **CI/CD**: GitHub Actions with automated deployment
- **Configuration**: `wrangler.toml` for Cloudflare settings

## Development Workflow

**Test-Driven Development:**

- **ALWAYS adopt TDD approach - this is NON-NEGOTIABLE**
- **CRITICAL TDD PRINCIPLE: Tests are the specification - NEVER modify tests to fit implementation**
- Write tests before implementing new features or fixing bugs
- Follow Red → Green → Refactor cycle strictly:
  1. **Red**: Write a failing test that defines the desired behavior
  2. **Green**: Write the minimum code to make the test pass
  3. **Refactor**: Improve code quality while keeping tests green
- **When tests fail after implementation changes:**
  - **DO NOT modify the test** - the test represents the expected behavior
  - **MODIFY the implementation** to satisfy the existing test expectations
  - If test expectations are genuinely wrong, get explicit user confirmation before changing tests
- **Library Integration Guidelines:**
  - Before using any library, verify actual output format with simple test scripts
  - Check library documentation for correct option names and usage
  - Do not assume API behavior - always verify with concrete examples
- **CRITICAL: TDD process MUST conclude with linting and formatting:**
  - **MANDATORY:** Run `pnpm lint` to check for linting issues and fix all errors
  - **MANDATORY:** Run `pnpm format` to format code with Prettier
  - **NEVER commit without completing both lint and format steps**
- Ensure all changes are tested before committing

**Error Handling:**

- Handle errors gracefully with proper logging
- Use appropriate error boundaries in React components
- Provide meaningful error messages for debugging

**Performance Considerations:**

- Optimize images and assets for web delivery
- Use lazy loading where appropriate
- Monitor bundle sizes and avoid unnecessary dependencies

## Security Guidelines

- Never commit sensitive information (API keys, tokens)
- Validate all user inputs and external data
- Use Content Security Policy (CSP) headers
- Sanitize content when rendering user-generated HTML

## Git Workflow

See @docs/git-instructions.md

## Tool Usage Notes

- Use `mcp__eslint__lint-files` MCP tool to get ESLint diagnostics rather than CLI execution
- Use `mcp__ide__getDiagnostics` for VS Code language server diagnostics
- Prioritize using the `gh` command for GitHub-related operations
- When debugging code issues, combine MCP diagnostic tools with targeted file reads

## Debugging & Troubleshooting

**Common Issues:**

1. **Notion API Connection Errors:**

   - Verify `NOTION_AUTH_TOKEN` in `.env`
   - Check token permissions for database access
   - Run `pnpm notion-fetch --dry-run` to test connection

2. **Build Failures:**

   - Ensure all tests pass: `pnpm test:tools`
   - Check TypeScript compilation: `pnpm build`
   - Verify environment variables are set

3. **Image Processing Issues:**

   - Check internet connection for Notion image downloads
   - Verify `public/images/` directory permissions
   - Use `--debug` flag for detailed notion-fetch logs

4. **Development Server Issues:**
   - Clear `.astro` cache directory
   - Restart development server: `pnpm dev`
   - Check port conflicts (default: 4321)

**Debugging Commands:**

```bash
pnpm notion-fetch --debug --dry-run  # Debug mode without file writes
pnpm build --verbose                 # Verbose build output
pnpm dev --host                      # Expose dev server to network
```

## Code Review Checklist

**Before Creating PRs:**

- [ ] All tests pass: `pnpm test:tools`
- [ ] Code linting passes: `pnpm lint`
- [ ] Code is formatted: `pnpm format`
- [ ] Build succeeds: `pnpm build`
- [ ] No auto-generated files modified (`src/content/post/*.md`, `public/images/`)
- [ ] TypeScript compilation succeeds without `as any` assertions
- [ ] New features include comprehensive tests (TDD approach)

**Performance Considerations:**

- Bundle size impact assessment for new dependencies
- Image optimization and lazy loading implementation
- Cloudflare Workers execution time limits (< 10ms typically)
- Notion API rate limiting considerations

## Claude Code Specific Guidelines

**When Working with Auto-Generated Content:**

- **NEVER edit** `src/content/post/*.md` files directly
- **NEVER edit** `public/images/` directory manually
- Always use `pnpm notion-fetch` to sync content changes
- Understand that content changes require Notion database updates

**Diagnostic Tool Priority:**

1. Use `mcp__ide__getDiagnostics` for immediate code issues
2. Use `mcp__eslint__lint-files` for linting-specific problems
3. Use `Read` tool for targeted file analysis
4. Use `Bash` tool only when MCP tools are insufficient

**Error Resolution Approach:**

1. **Check MCP diagnostics first** before manual debugging
2. **Run quality checks early** (`pnpm lint && pnpm format`)
3. **Test incremental changes** rather than large modifications
4. **Respect TDD principles** - modify implementation to match tests

## Important Notes

- CLAUDE.md is always written in English
- This is a Japanese development environment - use Japanese for code comments
- Never use `as any` type assertions - define proper types
- Conventional Commits format required for all commits
