---
title: 'Angular: Implementing Expansion Directive with CSS Grid'
slug: 'angular-expansion-directive.en'
icon: ''
created_time: '2023-12-18T12:53:00.000Z'
last_edited_time: '2023-12-30T09:58:00.000Z'
tags:
  - 'Angular'
  - 'CSS'
published: true
locale: 'en'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Implementing-Expansion-Directive-with-CSS-Grid-2baf74e54ee04629bba3e69952099c3d'
features:
  katex: false
  mermaid: false
  tweet: false
---

Animating the height of an element between 0 and the automatically calculated size is not a straightforward task. However, it seems that a recent update to browsers has made it possible to use a CSS Grid approach.

https://dev.to/francescovetere/css-trick-transition-from-height-0-to-auto-21de

Using this method, I implemented the directive as an easy-to-use component within an Angular application. The following sample code is fully functional, so please try it out. Feel free to incorporate it into your project if you wish.

https://stackblitz.com/edit/angular-kyt4lx?ctl=1&embed=1&file=src/main.ts

## `Expandable` Directive

The `Expandable` directive applies styles to the host element it is assigned to. As mentioned in the previous article, for the element that serves as the container for the expansion panel, you should include `display: grid` and `grid-template-rows` in the styling. This allows for animating changes in the grid structure using `transition-property: grid-template-rows`. You can use any values for `duration` and `timing-function`.

When applying styles using directives, you can simply pass an object to the `style` property through host binding. You can apply styles collectively without using features like `ngStyle` or `[style.xxx]`.

```typescript
@Directive({
  selector: '[expandable]',
  standalone: true,
})
export class Expandable {
  @Input({ alias: 'expandable' })
  isExpanded = false;

  @HostBinding('style')
  get styles() {
    return {
      display: 'grid',
      'transition-property': 'grid-template-rows',
      'transition-duration': '250ms',
      'transition-timing-function': 'ease',
      'grid-template-rows': this.isExpanded ? '1fr' : '0fr',
    };
  }
}
```

## Usage

Apply the `Expandable` directive to any container element and add the `overflow: hidden` style to its immediate child elements. This will hide the overflowing content when the height of the grid becomes `0fr`.

```typescript
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Expandable],
  template: `
    <h1>Expansion with grid-template-rows</h1>
    
    <button (click)="toggle()">toggle</button>
    <div [expandable]="isExpanded()" style="border: 1px solid black;">
      <div style="overflow: hidden;">
        <p>
        Lorem ipsum dolor sit amet, ...
        </p>
      </div>
    </div>
  `,
})
export class App {
  isExpanded = signal(false);

  toggle() {
    this.isExpanded.update((v) => !v);
  }
}
```

## Thoughts

Angular has its animation feature, but I think CSS alone is sufficient for this expansion panel use case. It is a highly versatile mechanism and its implementation is not difficult, so I felt it is a technique that I want to actively use. (In the first place, it would be great if we could animate with `height: auto`.)

