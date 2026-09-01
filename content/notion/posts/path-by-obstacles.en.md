---
title: 'Obstacles Create the Path'
slug: 'path-by-obstacles'
icon: ''
created_time: '2026-09-01T14:22:00.000Z'
last_edited_time: '2026-09-01T14:22:00.000Z'
tags: []
published: true
locale: 'en'
channels:
  - 'Thought'
notion_url: 'https://app.notion.com/p/3cd3521b014a80ac9006e143997fbdfb'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: 'edb5000ad757a8d89e4db914e66c92342093080f1907dd2620e59458511ac11d'
---

I first put the idea that "obstacles create the path" into words during a presentation at an event called Classi Angular Night in 2019. There, I was talking about what people should consider when learning Angular: "What is a framework?" I've been thinking about this again recently, so I'd like to leave it here on my blog, based on what I spoke about back then.

https://docs.google.com/presentation/d/e/2PACX-1vTtm1u1Xgu4gNaVUA_hljHHO6b9ifnDUCz-OshEiDutEyiQzYn9pojorhFAifDEvyiKH_aHpmJRY51t/pub#slide=id.p

## Guidance through Constraints

If we abstract the purpose of what we call a framework, it would probably be to guide users to choose a specific option from among the choices available to solve a problem. Although there may be some degree of variation, I think they share the same nature. And I feel that the essence of what makes a framework a framework is that this form of guidance is **guidance through constraints**.

If it were just about leading someone, a guide teaching "best practices" would suffice. There is also a way to guide through knowledge, by saying "this is correct" or "this is wrong." One might call it **guidance through enlightenment**. On the other hand, what we call a framework is different. A framework makes users choose the options its designer wants them to choose by **making it harder to choose the options they don't want them to choose**. By placing the user in a special situation where bad patterns are difficult to select and good patterns are easy to select, it leads them to pick a specific option. This is guidance through constraints.

## Obstacles Create the Path

City roads are a perfect way to visualize guidance through constraints. How do you get a car to drive exactly where you want? Should you draw lines on the ground and enlighten them by saying, "You must drive along these lines"? There is a better way. You can simply make it impossible to go anywhere else. You place obstacles and clearly define the areas where one cannot proceed. The road then appears there as the "path without obstacles."

<figure>
  <img src="/images/path-by-obstacles/image.992471eb2cad4e07.png" alt="https://unsplash.com/photos/low-angle-photography-of-vehicles-passing-road-at-daytime-4YdbwhmTMn0">
  <figcaption>https://unsplash.com/photos/low-angle-photography-of-vehicles-passing-road-at-daytime-4YdbwhmTMn0</figcaption>
</figure>

Looking at the Shibuya scramble crossing, we can see that enlightenment alone regarding the "ideal form" of a crosswalk lacks effectiveness. If there are no obstacles on the shortest path, it is only natural that it becomes the road. At the same time, this also shows the limits of guidance through constraints. If you want someone to walk the shortest path, constraints are nothing but a hindrance. What guidance through constraints can do is to intentionally make someone walk a "**detour**" that isn't the shortest path but has other advantages.

<figure>
  <img src="/images/path-by-obstacles/image.32ae3ecc78c0bcf1.png" alt="https://unsplash.com/photos/shibuya-scramble-intersection-in-tokyo-DGsqL2j028E">
  <figcaption>https://unsplash.com/photos/shibuya-scramble-intersection-in-tokyo-DGsqL2j028E</figcaption>
</figure>

## Frameworks Are Always a "Detour"

When thinking about frameworks in software development, we must distinguish between the framework itself and the libraries bundled with it. Adopting a framework means accepting certain constraints. Compared to not adopting a framework, it is always a "detour" in some form.

If adopting a framework feels like a shortcut, it is likely due to the benefits of **outsourcing** via libraries attached to that framework, or because the problem has been simplified by constraints. On a road, in exchange for routes being limited by obstacles, complex problems like "moving without crashing" can be systematized through traffic lights and road signs. Similarly, by accepting certain constraints, choices are narrowed, problems in specific areas are simplified, and general-purpose solutions provided by libraries can be applied.

So, it is inevitable that a framework feels roundabout to those who don't like it. Essentially, it is a tool for intentionally taking a detour, not a tool for solving problems via the shortest path. In exchange, what a framework provides is a designed path. It may not be the shortest, but that path certainly contains the designer's intent. The values of "**what one wants to prioritize while solving the problem**" reside in that design. That is why empathy with the philosophy and values is important when adopting a framework. It is because you feel that the framework values the same things you do that you can accept taking a detour.