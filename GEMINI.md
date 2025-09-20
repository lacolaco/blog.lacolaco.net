# Project Overview

This is a personal blog built with [Astro](https://astro.build/), a static site generator for building fast, content-focused websites. The blog is deployed to [Cloudflare Pages](https://pages.cloudflare.com/).

## Communication Rules

* IMPORTANT: Speak in Japanese.

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
*   `tools/`: Contains scripts for development and content management.
    *   `tools/notion-fetch/`: A script to fetch content from Notion and transform it into Markdown files for Astro. It's the core of the headless CMS workflow.
        *   **Entrypoint & Flow**: The process is orchestrated by `main.ts`. It fetches all blog pages from the Notion database and processes them in parallel. It includes an optimization to skip pages that haven't been updated by comparing the `last_edited_time` with the frontmatter of the existing Markdown file.
        *   **Block Transformation**: `block-transformer.ts` is the core of the conversion logic. It recursively transforms an array of Notion blocks into a Markdown string. It supports a wide range of blocks, including lists, code blocks, callouts (converted to GitHub-style alerts), and equations. A `TransformContext` object is used to track required features (like KaTeX for equations) and collect image download tasks.
        *   **Page & Frontmatter**: `page-transformer.ts` is responsible for extracting page properties (title, slug, tags, etc.) from the Notion API response and building the final Markdown file, combining the frontmatter and the transformed content. It uses Prettier for final formatting.
        *   **Image Handling**: `image-downloader.ts` handles the parallel download of all images found during the block transformation. Images are saved locally to `public/images/{slug}/`, and the Markdown `<img>` tags are updated to point to these local files.
        *   **File System Abstraction**: `filesystem.ts` provides a simple wrapper around Node.js file system APIs, which allows the script to support a `--dry-run` mode for safe testing.
    *   `tools/remark-embed/`: A Remark plugin to handle embedding external content like links or other resources within Markdown files.

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
