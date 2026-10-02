---
title: 'Angular Update Guide Skill for Agents'
slug: 'angular-update-guide-skill'
icon: ''
created_time: '2026-07-27T00:54:00.000Z'
last_edited_time: '2026-07-27T00:54:00.000Z'
tags:
  - 'Agent Skills'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-update-guide-skill'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://app.notion.com/p/Angular-Update-Guide-Skill-for-Agents-3aa3521b014a8097855bebdb45df75fc'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: 'ae46737babe463c3a4ab2fb4bcc3f5c032dbce25385e84f08a8a20bec43ac535'
---

The **Angular Update Guide** in the official Angular documentation is a useful tool for checking the scope of impact when upgrading Angular versions. However, because it's dynamic content on a website, it's difficult to provide as a data source when instructing an AI agent to perform an Angular update, and the need for steps like WebFetch or scraping via browser automation is a problem.

https://angular.dev/update-guide

By the way, the content of this update guide exists statically as a TypeScript object in the source code, so it becomes easier to use if you process it beforehand and turn it into an agent skill. That's why I created the `lacolaco/angular-skills` `angular-update-guide` skill.

https://github.com/lacolaco/angular-skills

```shell
# Install skills
npx skills add lacolaco/angular-skills

# Just one of the skills
npx skills add lacolaco/angular-skills -s angular-update-guide
```

If you look at the source code, you'll see it consists of a single SKILL.md and a set of XML files referenced from it, with no external tool calls or anything like that. I've converted the guide content for each major version into XML files, aiming to have the AI agent gather information by referencing them according to the context.

If anyone feels that getting an AI agent to read the Angular Update Guide content is a hassle, please give it a try. Also, since something equivalent to this skill is something I'd ideally like to see included in the official Angular Skills, I intend to proceed with a proposal for that as well.