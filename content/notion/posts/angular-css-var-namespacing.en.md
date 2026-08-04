---
title: 'Angular v22.1: Namespacing CSS Variables'
slug: 'angular-css-var-namespacing'
icon: ''
created_time: '2026-08-04T02:25:00.000Z'
last_edited_time: '2026-08-04T02:25:00.000Z'
tags:
  - 'CSS'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-css-var-namespacing'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://app.notion.com/p/Angular-v22-1-CSS-3b13521b014a80219d1ce585fc92df77'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: '7c9534b7f8e64aa1255e287f5ad2c897230036e24a03be4fa51f70624857e03d'
---

https://github.com/angular/angular/pull/68846

In Angular v22.1, a new feature for namespacing CSS variables was added. I'll introduce how to use it.

## Namespaced CSS Variables

**Namespacing CSS variables** is a mechanism to isolate CSS variables declared in an Angular component's CSS into a namespace to prevent them from colliding with variables in other applications or libraries. For instance, common CSS variable names like `--primary-color` often conflict with third-party UI libraries when used in an application. While it's common practice to manually prefix variable names to separate namespaces, this feature automates that process.

Namespacing CSS variables is an opt-in feature, so behavior remains unchanged unless you enable it. To enable it, you add the `provideCssVarNamespacing` provider to the application configuration.

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideCssVarNamespacing } from '@angular/platform-browser'; // ADD

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideCssVarNamespacing(), // ADD
  ]
};

```

By default, it uses the application's `APP_ID` for namespacing. For component CSS like the following, an `--ng_` prefix is automatically inserted, as shown in the image.

```typescript
@Component({
  selector: 'app-root',
  template: `<p>Component Scope Text</p>`,
  styles: `
    :host {
      --text-color: blue;
    }

    p {
      color: var(--text-color);
    }
  `,
})
export class App {}

```

![image](/images/angular-css-var-namespacing/CleanShot_2026-08-04_at_07.45.572x.875f648658105d02.png)

You can also namespace using an arbitrary string by passing an argument to the `provideCssVarNamespacing` function.

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideCssVarNamespacing('app'),
  ]
};
```

![image](/images/angular-css-var-namespacing/CleanShot_2026-08-04_at_07.48.302x.278a376db158f1b1.png)

## Using Global CSS Variables

When this namespacing is enabled, it might seem like you can't use global CSS variables or change their values within a component's CSS, but a way to do that has been properly provided.

For example, let's say a `--text-color` variable is also declared in the global CSS. If you do nothing, the variable applied to the p tag inside the component is namespaced, so it isn't affected by the global CSS and the color won't change.

```css
/* styles.css */

:root {
  --text-color: red;
}

p {
  color: var(--text-color);
}
```

![image](/images/angular-css-var-namespacing/CleanShot_2026-08-04_at_07.52.432x.32b37803f08da4eb.png)

When you want to reference a global `--text-color` variable inside a component, you can explicitly disable namespacing using the dedicated `--global` prefix. When this prefix is present, namespacing is skipped, and the remaining part with the `--global` prefix removed is actually applied. Of course, you can not only reference it but also overwrite the value.

```typescript
@Component({
  selector: 'app-root',
  template: `
  <p>Component Scope Text</p> 
  <p data-global>Component Scope Text (global)</p>
  `,
  styles: `
    :host {
      --text-color: blue;
      --global--text-color: green; 
    }

    p {
      color: var(--text-color);
    }

    p[data-global] {
      color: var(--global--text-color);
    }
  `,
})
export class App {}
```

![image](/images/angular-css-var-namespacing/CleanShot_2026-08-04_at_07.58.392x.98219dd25053b751.png)

## Caveats

By enabling namespacing, if CSS variables are used in design systems built outside the application, you can import and use them, while ensuring that using CSS variables inside the application won't break the design system. It seems like a feature that would generally be worth enabling for projects that make use of CSS variables.

However, there are some points to note. As of v22.1.0, the insertion of CSS variable namespaces only applies to component CSS. In other words, values provided to the style attribute in the template HTML are not covered.

```html
<!-- Refer to global --text-color -->
<p [style.color]="'var(--text-color)'"> 
```

If you want to use namespaced CSS variables within the template HTML, you need to resolve them on the TypeScript side using the `CssVarNamespacer` service. By binding the return value resolved by the `namespace` method of `CssVarNamespacer` as follows, you can apply namespacing to dynamic styling as well.

```typescript
import { CssVarNamespacer } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  template: `
    <p [style.color]="'var(' + textColor + ')'">Component Scope Text (inline)</p>
  `,
  styles: `
    :host {
      --text-color: blue;
    }
  `,
})
export class App {
  // namespaced `--text-color` 
  textColor = inject(CssVarNamespacer).namespace('--text-color'); 
}

```

Also, another point that might be easily misunderstood is that this namespacing is **isolation at the application level**, not the **component level**. It exists as a different mechanism from View Encapsulation, which scopes component CSS, and variables still affect components according to parent-child relationships on the DOM tree as before. Rather, the fact that CSS variables can be injected across component boundaries in this way is part of the point, so it's not a flaw, but let's be careful not to confuse it with the behavior of namespacing.

## Conclusion

Namespacing CSS variables in Angular v22.1 is a practical improvement that automatically avoids variable collisions within component CSS and can replace existing manual practices (like adding prefixes). It can be introduced just by adding `provideCssVarNamespacing()`, and an arbitrary prefix can be specified if necessary.

Furthermore, an explicit bypass method using the `--global` prefix is provided for cases where you want to reference or overwrite global variables. On the other hand, at this point, it is not automatically applied to inline styles in templates. In use cases involving template HTML, it's necessary to resolve them using `CssVarNamespacer`.

Projects that make extensive use of CSS variables will likely benefit the most, so I think it's worth trying out on an opt-in basis first.