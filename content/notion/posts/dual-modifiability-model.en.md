---
title: 'Dual Model of Modifiability'
slug: 'dual-modifiability-model'
icon: ''
created_time: '2026-09-12T02:43:00.000Z'
last_edited_time: '2026-09-12T02:43:00.000Z'
tags:
  - 'Testing'
  - '変更容易性'
published: true
locale: 'en'
channels:
  - 'Thought'
notion_url: 'https://app.notion.com/p/3d83521b014a80e8bd7add61e3a40a2a'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: 'fa05cc8d30828be3130265aadc2536a32571bd35cc641311ffa1e1a63d6eddbf'
---

I wrote a blog post a little while ago about the idea of the "Two-Layer Model of Modifiability," but after continuing to think about it since then, I've started to see things from a different perspective. I'd like to document the "**Dual Model of Modifiability**," which reflects these updates.

https://blog.lacolaco.net/posts/two-layer-modifiability-model

## Challenges of the Layer Model

The two-layer model explained that modifiability consists of two layers. I don't think this view was entirely wrong, but the challenge was that it didn't well describe the relationship between the two types of modifiability.

A layer model implies a **unidirectionality of dependencies**. Much like frontend and backend, an upper layer depends on a lower layer, but not vice-versa. In the two-layer model of modifiability, the explanation was that anticipatory modifiability is the lower layer and empirical modifiability is the upper layer, but this doesn't really seem to match reality.

The two types of modifiability influence each other. It's conceivable that a reduction in fear or anxiety about change would increase the frequency of change. However, if the frequency of change increases while the structure remains unchanged, maintenance costs will rise. This is because the structure hasn't been adjusted to adapt to the new variability. Also, lower costs of change lead to less anxiety. The relationship between anticipatory and empirical modifiability is bidirectional.

Essentially, I believe the concept of decomposing the inhibitors of modifiability into the two perspectives of fear/anxiety and the effort/cost of change was on point, so the issues mentioned above are strictly at the level of the model's naming and representation. That is how I arrived at the **Dual Model of Modifiability**.

## Dual Model of Modifiability

In the new model, I've chosen to bifurcate based on the **factors that inhibit modifiability**. These are **Psychological Modifiability** and **Physical Modifiability**.

### **Psychological Modifiability**

Psychological modifiability is the **low level of psychological resistance to making changes**. The lower the anxiety, the higher the psychological modifiability. However, anxiety isn't the only thing that creates psychological resistance. Typically, situations like the following might increase psychological resistance:

- Complexity is high, and the impact of a change cannot be predicted
- Lack of knowledge or experience makes it impossible to see the steps for a change
- Risks are high when a change fails
- Tasks are cumbersome, cognitive load is high, and stress is significant

The definition is almost the same as anticipatory modifiability, but psychological modifiability carries no temporal implication. In reality, **anxiety continues not just before making a change, but even after starting it**. Developers often make changes tentatively, fearing regressions. Also, it was necessary to capture not just anxiety but the psychological resistance of cognitive load. Therefore, I've redefined this perspective as **psychological** modifiability.

### **Physical Modifiability**

Physical modifiability is the **degree of effort required for a change**. You could simply think of it as **change cost**. The lower the change cost, the higher the physical modifiability. Effort is the resistance to change that the developer receives from the software. Typically, factors like the following increase the cost of change:

- The volume of code to be changed is large
- The scope of impact is large (increasing verification costs)
- Fixing bugs caused by unsafe changes (additional costs)

This definition is similar to empirical modifiability, but the emphasis is shifted toward the **physical costs**—human, financial, and temporal—that occur as a result of resistance. Even with a legacy system that has high change costs, people who maintain it for a long time eventually get used to the situation to some extent. In this dimension, since the focus is on objective economics rather than subjective resistance, I've redefined it as **physical** modifiability.

## The Four Quadrants of Modifiability

By moving to a dual model instead of a layer model, we can now perceive the state of modifiability through four quadrants.

<figure>
  <img src="/images/dual-modifiability-model/psychological-physical-modifiability.f23f0ad47337060e.png" alt="The Four Quadrants of Modifiability">
  <figcaption>The Four Quadrants of Modifiability</figcaption>
</figure>

A state where both psychological and physical modifiability are high is, needless to say, the ideal state for software. Developers welcome making changes, and the effort required is low. This is the state that most embodies the software's reason for being.

Conversely, a state where both are low is software that can no longer be changed—what Peter Naur calls the "death of a program." No one wants to change this software, and if changes must be made, hell awaits.

What does it mean when only psychological modifiability is low? The change itself is simple, but the developers involved feel anxiety or stress. For example, it's a state where you know there are few tests or that complex coupling makes the impact scope prone to expanding. You can do it, but you'd rather not touch it—that is the relationship represented by this quadrant.

What does it mean when only physical modifiability is low? Changes aren't feared, but they don't progress smoothly. There are plenty of tests and things don't break easily, but the cost of making a change is high. It's a state lacking flexibility. However, developers have resigned themselves to the software's design flaws, thinking "that's just how it is." This quadrant represents the stagnation of refactoring and the calcification of design.

## How to Use the Model

Using this dual model and the four-quadrant diagram should be helpful for analysis when a team feels there are issues with modifiability. If you feel psychological modifiability is low, you must identify the source of that anxiety or avoidance. If you feel physical modifiability is low, you must identify the design distortions that are increasing change costs. It helps you focus on and address the bottlenecks.

Of course, the two types of modifiability influence each other, and they may lead back to the same cause. Becoming excessively defensive due to anxiety can increase change costs, and understanding may grow while untangling complex code, lightening the anxiety of making changes. It's rare for only one to be the issue; rather, it's a gradation of which one is felt more strongly.

Modifiability isn't a binary of having it or not, and it isn't determined by structure alone. It is the relationship between the developer and the software, not something that gets a perfect score just by filling out a checklist. What's important, I think, is the attitude of continuously asking, "Is this software soft enough?" and the habit of putting that into practice. Perhaps one such pattern for doing so is Test-Driven Development.