# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is lacolaco's personal blog built with **Astro** as a static site generator, using **Notion as a headless CMS**. The blog supports bilingual content (Japanese/English) and focuses on software development topics, particularly Angular.

## Essential Commands

**Development:**

- `pnpm dev` - Start development server
- `pnpm build` - Build for production (includes Cloudflare Workers build)
- `pnpm preview` - Preview production build

**Content Management:**

- `pnpm notion-fetch` - Sync content from Notion (requires `.env` with Notion API credentials)

**Code Quality:**

- `pnpm format` - Format code with Prettier
- `pnpm test:tools` - Run tests for custom tools (uses Node.js test runner)

**Deployment:**

- `pnpm pages:dev` - Local development with Cloudflare Pages

## Architecture Overview

**Content Pipeline:**

- Blog posts originate in **Notion** and are synced via custom `tools/notion-fetch/`
- Content is transformed to JSON files in `src/content/post/*.json` (**DO NOT EDIT MANUALLY**)
- Uses Astro Content Collections with Zod schemas for type safety

**Tech Stack:**

- **Astro 5.x** with React integration for interactive components
- **TypeScript** with strict configuration and path aliases (`@lib/*`)
- **Tailwind CSS 4.x** for styling
- **Cloudflare Pages** for hosting with Workers for serverless functions

**Key Directories:**

- `src/components/` - Astro/React UI components
- `src/content/post/` - Auto-generated blog post JSON files (**DO NOT EDIT**)
- `src/libs/` - Internal TypeScript libraries (notion, post processing, i18n, querying)
- `src/pages/` - Astro routes including dynamic routes and OG image generation
- `tools/notion-fetch/` - Custom Notion CMS sync tool
- `tools/remark-embed/` - Custom remark plugin for content embedding

**Internationalization:**

- Default locale: Japanese (`ja`)
- Supported locales: Japanese (`ja`), English (`en`)
- Use `getRelativeLocaleUrl()` for locale-aware links

## Development Guidelines

**Component Selection:**

- Use **Astro components** (`.astro`) when no client-side interactivity is needed
- Use **React components** (`.tsx`) only when client-side interactivity is required

**Content Boundaries:**

- **NEVER modify** files in `src/content/post/*.json` - these are auto-generated from Notion
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
- Run with `pnpm test:tools`

## Deployment

- **Target**: Cloudflare Pages with Workers
- **Build Output**: `dist/client/` (Astro) + `dist/worker/` (Workers)
- **CI/CD**: GitHub Actions with automated deployment
- **Configuration**: `wrangler.toml` for Cloudflare settings

## Development Workflow

**Test-Driven Development:**

- Always adopt TDD approach.
- Write tests before implementing new features or fixing bugs
- After tests succeed, try to refactor the code while keeping tests passing
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

## Important Notes

- CLAUDE.md is always written in English
