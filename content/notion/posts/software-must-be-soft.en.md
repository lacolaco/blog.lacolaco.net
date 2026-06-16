---
title: 'Software Must Be Soft'
slug: 'software-must-be-soft'
icon: ''
created_time: '2026-06-07T08:28:00.000Z'
last_edited_time: '2026-06-15T06:26:00.000Z'
tags:
  - 'Software Design'
published: true
locale: 'en'
channels:
  - 'Thought'
notion_url: 'https://app.notion.com/p/3773521b014a80a1866bc7418afaa21e'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: '989c29da5ff87368bff237a21ce842808a22f31f1c1403ea475d6fb56d86b8a4'
---

From TSKaigi 2026 "When to Write Tests?"

https://blog.lacolaco.net/posts/tskaigi-2026-deck

---

## What does it mean for software to be "soft"?

If you're in the software business, I suspect you might have wondered this at least once. What exactly does it mean for software to be "soft"?

Robert C. Martin has mentioned this several times in his works.

> Software was chosen as the term for these collections of programs... because it was intended to be "soft." It was intended to be a way to easily change the behavior of machines. If we didn't want the behavior of a machine to be easy to change, we called it hardware.
> — Robert C. Martin, *Clean Architecture*

> The first word in software is **soft**. Software is intended to be soft. It is intended to be easy to change. If you didn’t want it to be easy to change, you would have called it **hard**ware.
>
> It is important to remember why software was invented. It was invented to make the behavior of machines easy to change. If the software is not easy to change, then it is thwarting the reason that software was invented.
> — Robert C. Martin, *Clean Craftsmanship*

## Software and Changeability

Based on Martin's reasoning, for software to be "soft" means that it is **easy to change**. Changeability is the essential quality that software must not lack.

Conversely, software that has lost its ease of change and become difficult to modify is no longer "soft." I will refer to this state as the "hardening" of software. **Software that has become difficult to change has "hardened."**

This "hardening" represents a loss of the software's very reason for being.

## Peter Naur's "Death of a Program"

By the way, Peter Naur described a situation similar to this "hardening" as early as 1985.

> ...the building of the program is the same as the building of the theory of it by the programmer team. [...] the death of a program happens when the programmer team which has its theory is dissolved. A dead program may continue to be executed on a computer and produce useful results. The actual state of death is visible when one can no more answer intelligently to requests for modifications of the program.
> ― Peter Naur, "Programming as Theory Building" (1985)

For Naur, the "death of a program" refers to a state where one can no longer respond to requests for modifications. This is exactly what it means for a program to lose its changeability.

As Naur himself points out, just because a program has become difficult to change doesn't mean it stops running. It simply means it can no longer be changed. However, that program has undoubtedly lost its purpose as software.

## Changeability is a Relationship Between Humans and Software

What we can see from Naur's insight is that **changeability is not an inherent property of software**. In other words, changeability is not determined solely by the software's structure. There is no such thing as code that is absolutely easy or difficult to change; rather, changeability is determined by the relationship with the humans attempting to change that software.

In the first place, "easy" or "difficult" are subjective sensations experienced by humans. Furthermore, one cannot evaluate changeability without the premise of "for what kind of change." Beyond that, what is considered easy is also influenced by the developer's knowledge and experience.

When thinking about the changeability of software, I think we also need to consider the humans—the developers—who are in a position to change that software.

## Summary

- Software being "soft" means it is easy to change.
- Loss of changeability = **The "Hardening" of software**
  - Loss of the purpose of software
  - Naur's "Death of a Program"
- Changeability is a relationship between humans and software.