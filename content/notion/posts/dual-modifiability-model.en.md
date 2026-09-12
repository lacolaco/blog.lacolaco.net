---
title: 'A Dual Model of Modifiability'
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

I wrote about the idea of a "Two-layer model of modifiability" on my blog a while ago, but as I’ve continued to think about it since then, a different perspective has come into view. I’d like to write about the "Dual Model of Modifiability" that reflects this update.

https://blog.lacolaco.net/posts/two-layer-modifiability-model

## Issues with the Layer Model

The two-layer model explained modifiability as being composed of two layers. I don’t think this view was completely wrong, but it had the issue of not adequately describing the relationship between the two types of modifiability.

A layer model implies a one-way dependency. Like frontend and backend, the upper layer depends on the lower layer, but not vice versa. In the two-layer model, anticipatory modifiability was explained as the lower layer and empirical modifiability as the upper layer, but this doesn't really align with reality.

The two types of modifiability influence each other. One can imagine that as fear and anxiety regarding changes decrease, the frequency of changes increases. However, if the frequency of changes increases while the structure remains the same, maintenance costs will rise. This is because the structure hasn't been adjusted to adapt to the new variability. Also, as the cost of change decreases, the anxiety regarding change also lessens. The relationship between anticipatory and empirical modifiability is bidirectional.

Fundamentally, I think the concept of breaking down inhibitors of modifiability into the two perspectives of fear/anxiety and the effort/cost of change hits the mark, so the aforementioned issues are strictly at the level of the model's naming and representation. That is how I arrived at the **Dual Model of Modifiability**.

## The Dual Model of Modifiability

In the new model, I have decided to bifurcate modifiability based on the **factors that inhibit it**. These are **Psychological Modifiability** and **Physical Modifiability**.

### **Psychological Modifiability**

Psychological modifiability is the **lack of psychological resistance to making a change**. The lower the anxiety, the higher the psychological modifiability. However, it’s not just anxiety that creates psychological resistance. Typically, situations like the following might increase psychological resistance:

- Complexity is high, and the scope of impact of a change cannot be predicted
- Lack of knowledge or experience makes it impossible to foresee the steps for the change
- The risk when a change fails is large
- Tasks are cumbersome, cognitive load is high, and stress is significant

While the definition is almost the same as anticipatory modifiability, psychological modifiability carries no temporal implication. In reality, **anxiety continues not just before making a change, but even after starting it**. Developers carry out changes tentatively, fearing regressions. Additionally, there was a need to capture not just anxiety, but also psychological resistance in the form of cognitive load. Therefore, I’ve redefined this perspective as **psychological** modifiability.

### **Physical Modifiability**

Physical modifiability is the **degree of effort required for a change**. It could simply be rephrased as the **cost of change**. The lower the cost of change, the higher the physical modifiability. Effort is the resistance to change that a developer receives from the software. Typically, factors like the following increase the cost of change:

- The amount of code to be changed is large
- The scope of impact of the change is large (increasing verification costs)
- Fixing bugs caused by unsafe changes (additional costs)

This too is similar to the definition of empirical modifiability, but the emphasis is placed on the **physical costs**—human, financial, and temporal—that occur as a result of resistance. Even with a high-cost legacy system, people who maintain it for a long time eventually get used to the situation to some extent. Since this dimension focuses on objective economics rather than subjective resistance, I’ve redefined it as **physical** modifiability.

## The Four Quadrants of Modifiability

By moving from a layer model to a dual model, it’s become possible to perceive the state of modifiability through four quadrants.

<figure>
  <img src="/images/dual-modifiability-model/psychological-physical-modifiability.f23f0ad47337060e.png" alt="Four Quadrants of Modifiability">
  <figcaption>Four Quadrants of Modifiability</figcaption>
</figure>

A state where both psychological and physical modifiability are high is, needless to say, the ideal state for software. Developers welcome making changes, and the effort to do so is low. This is the state that most embodies the software's reason for being.

Conversely, a state where both are low is software that can no longer be changed—it's what Peter Naur calls the "death of a program." No one wants to change this software, and if they are forced to do so, hell awaits.

What does a state where only psychological modifiability is low mean? The change itself is easy, but the developers involved feel anxiety or stress. For example, it’s a state where you know there are few tests, or that the impact is likely to spread due to complex coupling. You can do it, but you don't want to touch it if possible—this quadrant represents that kind of relationship.

What does a state where only physical modifiability is low mean? You aren't afraid of the change, but the change doesn't progress smoothly. There are plenty of tests and it won't break easily, but the cost to change it is high. It’s a state lacking flexibility. However, the developers have given up on the design flaws of the software, thinking "that’s just how it is." This quadrant represents the stagnation of refactoring and the fixation of design.

## How to Use the Model

Using this dual model and the four-quadrant diagram should be helpful for analysis when a team feels there are issues with modifiability. If you feel psychological modifiability is low, you must identify where that anxiety or aversion comes from. If you feel physical modifiability is low, you must identify the structural distortions that are increasing the cost of change. It helps you focus on and address the bottlenecks.

Of course, the two types of modifiability influence each other, and they may even trace back to the same cause. Becoming excessively defensive due to anxiety can increase change costs, and understanding might improve while tidying up intricately intertwined code, easing the anxiety of changing it. It’s rare for only one to be the issue; it’s more of a gradation of which one is felt more strongly.

Modifiability is not a binary "exists or doesn't exist," and it isn't determined solely by structure. It is a relationship between the developer and the software, not something that reaches a score of 100 just by fulfilling a checklist. What is important, I think, is the attitude of continuously asking, "Is this software soft enough?" and the habit of putting that into practice. One pattern for doing so is test-driven development.