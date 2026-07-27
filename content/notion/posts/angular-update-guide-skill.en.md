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

The **Angular Update Guide** in the official Angular documentation is a handy tool for checking the scope of impact when upgrading Angular versions. However, because it's dynamic web content, it's difficult to provide as a data source when instructing an AI agent to perform Angular update tasks, and the fact that it requires steps like WebFetch or scraping via browser manipulation is a problem.

https://angular.dev/update-guide

Incidentally, since the content of this update guide exists statically as TypeScript objects in the source code, it becomes easier to use if you process it into an agent skill in advance. With that in mind, I created the `lacolaco/angular-skills` `angular-update-guide` skill.

https://github.com/lacolaco/angular-skills

```shell
# Install skills
npx skills add lacolaco/angular-skills

# Just one of the skills
npx skills add lacolaco/angular-skills -s angular-update-guide
```

As you can see from the source code, it consists of a single SKILL.md and a set of XML files referenced from there, with no external tool calls. My aim is to have the AI agent gather information by referencing the XML files for each major version's guide content based on the context.

If you've ever felt that getting an AI agent to read the Angular Update Guide content is a bit of a hassle, I'd love for you to give this a try. Also, since I think something equivalent to this skill should ideally be included in the official Angular Skills, I plan to move forward with a proposal for that as well.