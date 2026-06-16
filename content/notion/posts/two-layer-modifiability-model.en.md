---
title: 'A Two-Layer Model of Modifiability'
slug: 'two-layer-modifiability-model'
icon: ''
created_time: '2026-06-15T00:29:00.000Z'
last_edited_time: '2026-06-15T06:26:00.000Z'
tags:
  - 'TSKaigi'
  - 'Software Design'
  - '変更容易性'
published: true
locale: 'en'
channels:
  - 'Thought'
notion_url: 'https://app.notion.com/p/2-37f3521b014a80bb9782f55c614989c2'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: '8469e70f5c0ad7f6660df5ddde390a8ba64bf2d710742cafc4dd24b3a37afcd7'
---

From TSKaigi 2026, "When to Write Tests?"

https://blog.lacolaco.net/posts/tskaigi-2026-deck

---

https://blog.lacolaco.net/posts/software-must-be-soft

We've seen so far that the essential characteristic of software is modifiability, and that it is influenced by the relationship between the software and the people interacting with it. So, how is that relationship observed? How can it be evaluated?

## A Two-Layer Model of Modifiability

Here, I'd like to think of modifiability as consisting of two layers and introduce a unique concept.

- **Expected Modifiability**
- **Experienced Modifiability**

### **Expected Modifiability**

Expected modifiability is the sense of "ease of change" one feels before actually making a change. When a human imagines making a change to certain software, the emotions they feel change significantly depending on whether they think it seems easy or not. Specifically, I think we can consider the following types of expectations:

- Expectations regarding the work required for the change
- Expectations regarding the scope of the change's impact
- Expectations regarding the probability of the change succeeding
- Expectations regarding the risk if the change fails

These expectations lead to two broad categories of results: peace of mind or fear. If it seems easy, you can approach the task with peace of mind even if you have to take it on, but if it seems difficult, you will likely want to avoid it if possible.

In other words, expected modifiability is the **degree of anxiety or fear** a developer feels toward the software. If a developer feels at peace with changing that software, one could say its expected modifiability is high. Conversely, if they feel anxious about changing that software, it represents low expected modifiability.

Robert C. Martin writes the following about "fear":

> Fear breeds rot in code. No one cleans it. No one improves it. When forced to make changes, they are made in the way that is safest for the programmer, not in the way that is best for the system. The design degrades. The code rots. Team productivity drops until it reaches zero.
>
> — Robert C. Martin, *Clean Craftsmanship: Disciplines, Standards, and Ethics*, Japanese translation by Yoshinori Sumi, KADOKAWA, 2022, p.50

### Experienced Modifiability

On the other hand, experienced modifiability is the sense of "ease of change" experienced **while making the change**. It is what you feel when you become the person making the change and face the source code. Specifically, it relates to experiences such as:

- How much effort was required for the change
- The scope and scale of the change's impact
- Side effects caused by the change

High experienced modifiability is a state where the change requires little effort, the impact is small, and no unintended side effects occur. In such cases, the change proceeds smoothly, and the developer can work with confidence. In the opposite scenario—where the change requires significant effort, the impact is wide, and unexpected side effects occur—experienced modifiability is low. The developer will likely feel stress because the change work is not progressing as they'd like.

In short, experienced modifiability is the degree of "**resistance to change**" that a developer receives from the software. One might even call it friction.

## Balancing the Two Modifiabilities

Thinking of modifiability as a two-layer model means considering the state where software is "soft" to be **a state where both expected modifiability and experienced modifiability coexist**. This implies the necessary conditions for continuing to change software: that there are **opportunities for change** and that **changing is rational**.

When a change seems easy, the opportunities for change increase. If expected modifiability is low (meaning there is anxiety about changing), one becomes cautious about changes. Speed drops, and one tries to get by with as few changes as possible. Consequently, the content packed into a single change becomes larger, making the scope of impact harder to read. This relationship is what makes software "hard."

Furthermore, if experienced modifiability is low (meaning there is great resistance to change), more effort is required. This directly impacts human and time costs. The greater the resistance, the more that change loses its economic rationality. What lies at the end of that path is the situation where "it's faster to just rebuild it." That is the very death of software.

These two do not always coexist. No matter how much you polish the design to make it easy to change, it's half-baked if it doesn't *look* easy to change. Conversely, you might think a change seems easy due to assumptions or lack of understanding, only to find it was far more difficult than imagined. That experience acts like a trauma, making you hesitate on the next change. Only when expected modifiability and experienced modifiability work together like two wheels of a cart does software truly become soft. That is why I feel that **software architecture is about aiming for a structure that achieves this balance**.