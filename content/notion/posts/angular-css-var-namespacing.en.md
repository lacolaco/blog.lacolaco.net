---
title: 'Angular v22.1: Namespacing CSS Variables'
slug: 'angular-css-var-namespacing'
icon: ''
created_time: '2026-08-03T23:15:00.000Z'
last_edited_time: '2026-08-03T23:31:00.000Z'
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
auto_translated_from: '36aa0042c1237e7e0c25bdb359c4af7d89861d6dce5ca10ec366fa01231bac70'
---

https://github.com/angular/angular/pull/68846

In Angular v22.1, a new feature for namespacing CSS variables was added. I'd like to introduce how to use it.

## Namespaced CSS Variables

**Namespacing CSS variables** is a way to isolate CSS variables declared within an Angular component's CSS into a namespace so they don't collide with variables from other applications or libraries. For example, commonly named CSS variables like `--primary-color` often collide with third-party UI libraries when used in an application. While it's common practice to manage this by manually adding a specific prefix to variable names, this new feature automates that process.

Namespacing CSS variables is an opt-in feature, so the existing behavior won't change unless you enable it. To enable it, you add the `provideCssVarNamespacing` provider to your application configuration.

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

By default, variables are namespaced using the application's `APP_ID`. For component CSS like the following, a `--ng_` prefix is automatically inserted, as shown in the image.

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

By passing an argument to the `provideCssVarNamespacing` function, you can also use an arbitrary string for namespacing.

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

While it might seem that enabling this namespacing would prevent you from using or modifying global CSS variables within a component's CSS, a method has been provided specifically for that purpose.

For instance, suppose a `--text-color` variable is declared in your global CSS. If you do nothing, the variable applied to the `p` tag inside the component will be the namespaced one, so it won't be affected by the global CSS, and the color won't change.

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

When you want to reference the global `--text-color` variable from within a component, you can explicitly opt out of namespacing by using the special `--global` prefix. When this prefix is present, namespacing is skipped, and the remaining part of the name (with the `--global` prefix removed) is actually applied. Naturally, you can use this not only for referencing but also for overwriting values.

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

By enabling namespacing, if you are using CSS variables from an external design system, you can still incorporate and use them, while also being guaranteed that using CSS variables inside your application won't break that design system. It seems like a feature that I would basically want to keep enabled in any project that makes active use of CSS variables.

However, there is one caveat. As of v22.1.0, the insertion of CSS variable namespaces only applies to component CSS. In other words, values provided to `style` attributes within the template HTML are not covered.

```html
<!-- Reference the global --text-color -->
<p [style.color]="'var(--text-color)'"> 
```

If you want to use namespaced CSS variables within a template HTML, you need to resolve them on the TypeScript side using the `CssVarNamespacer` service. By binding the return value resolved by the `namespace` method of `CssVarNamespacer`, as shown below, you can apply namespacing even to dynamic styling.

```typescript
import { CssVarNamespacer } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  template: `
    <p [style.color]="textColor">Component Scope Text (inline)</p>
  `,
  styles: `
    :host {
      --text-color: blue;
    }
  `,
})
export class App {
  // namespaced `var('--text-color')` 
  textColor = inject(CssVarNamespacer).namespace('--text-color'); 
}

```

## Conclusion

CSS variable namespacing in Angular v22.1 is a practical improvement that can replace manual conventions (like adding prefixes) while automatically avoiding variable collisions within component CSS. It can be introduced simply by adding `provideCssVarNamespacing()`, and you can specify a custom prefix if needed.

Additionally, an explicit workaround using the `--global` prefix is available for cases where you want to reference or overwrite global variables. On the other hand, it isn't automatically applied to inline styles in templates at this time. For use cases involving template HTML, you'll need to resolve variables via `CssVarNamespacer`.

The benefits seem greater the more a project utilizes CSS variables, so I think it's worth giving it a try as an opt-in feature.