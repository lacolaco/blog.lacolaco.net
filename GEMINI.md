# Project Overview

This is a personal blog built with [Astro](https://astro.build/), a static site generator for building fast, content-focused websites. The blog is deployed to [Cloudflare Pages](https://pages.cloudflare.com/).

## Key Technologies

*   **Framework:** [Astro](https://astro.build/)
*   **UI Components:** [React](https://react.dev/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Deployment:** [Cloudflare Pages](https://pages.cloudflare.com/)
*   **Content Source:** [Notion](https://www.notion.so/)

## Project Structure

*   `src/`: Contains the main source code of the blog.
    *   `src/content/`: Contains the blog posts and other content.
    *   `src/pages/`: Defines the pages and routes of the blog.
    *   `src/layouts/`: Defines the layout templates for pages.
    *   `src/components/`: Contains reusable UI components.
*   `public/`: Contains static assets like images and fonts.
*   `tools/`: Contains scripts for fetching content from Notion and other development tools.

# Building and Running

## Prerequisites

*   [Node.js](https://nodejs.org/) (version specified in `.node-version`)
*   [pnpm](https://pnpm.io/)

## Installation

```bash
pnpm install
```

## Development

To start the development server, run:

```bash
pnpm dev
```

## Building

To build the static site for production, run:

```bash
pnpm build
```

## Content Fetching

This project uses Notion as a headless CMS. To fetch the latest content from Notion, run:

```bash
pnpm notion-fetch
```

This requires a `.env` file with the necessary Notion API credentials.

# Development Conventions

## Formatting

This project uses [Prettier](https://prettier.io/) for code formatting. To format the code, run:

```bash
pnpm format
```

## Linting

This project uses [ESLint](https://eslint.org/) for code linting. To lint the code, run:

```bash
pnpm lint
```

## Commit Messages

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification. The commit message format is:

```
<type>(<scope>): <subject>
```

Common types include `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`.
