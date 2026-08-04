---
title: 'Angular v22.1: CSS Variable Namespacing'
slug: 'angular-css-var-namespacing'
icon: ''
created_time: '2026-08-04T01:54:00.000Z'
last_edited_time: '2026-08-04T01:54:00.000Z'
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
auto_translated_from: 'bce643a46c52ed38fb460304726055ec2f5f2b0cfd864145e4eb81ec3daa4d4b'
---

https://github.com/angular/angular/pull/68846

A new feature for namespacing CSS variables was added in Angular v22.1. I'd like to introduce how to use it.

## Namespaced CSS Variables

**CSS variable namespacing** is a mechanism to isolate CSS variables declared within an Angular application component's CSS into a namespace so they don't collide with variables from other applications or libraries. For example, common CSS variable names like `--primary-color` often clash with third-party UI libraries when used in an application. To avoid this problem, it's common practice to manually add a specific prefix to variable names to separate namespaces, but this new feature automates that process.

CSS variable namespacing is an opt-in feature, so the existing behavior won't change unless you enable it. To enable it, you add the `provideCssVarNamespacing` provider to your application configuration.

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

By default, it namespaces using the application's `APP_ID`. For component CSS like the following, an `--ng_` prefix is automatically inserted as shown in the image.

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

When you enable this namespacing, it might seem like you can no longer use global CSS variables or modify their values within component CSS, but a proper method is provided for those cases.

For example, let's say a `--text-color` variable is also declared in the global CSS. If you do nothing, the p tag inside the component will have the namespaced variable applied, so it won't be affected by the global CSS and the color won't change.

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

When you want to reference the global `--text-color` variable inside a component, you can explicitly disable namespacing by using the dedicated `--global` prefix. When this prefix is present, namespacing is skipped, and the remaining part after removing the `--global` prefix is actually applied. Of course, you can not only reference it but also overwrite the value.

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

By enabling namespacing, if CSS variables are used in a design system built outside the application, you can still incorporate and use them while ensuring that using CSS variables inside the application won't break the design system. I think it's a feature you'd generally want to enable in projects that make extensive use of CSS variables.

However, there is one thing to be careful about. As of v22.1.0, CSS variable namespace insertion only applies to component CSS. In other words, values given to the style attribute within the template HTML are not covered.

```html
<!-- Refer to the global --text-color -->
<p [style.color]="'var(--text-color)'"> 
```

If you want to use namespaced CSS variables within the template HTML, you need to resolve them on the TypeScript side using the `CssVarNamespacer` service. By binding the return value resolved with the namespace method of `CssVarNamespacer` as follows, you can apply namespacing to dynamic styling as well.

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

## Conclusion

CSS variable namespacing in Angular v22.1 is a practical improvement that automatically avoids variable collisions in component CSS and can replace existing manual practices (like adding prefixes). It can be introduced just by adding `provideCssVarNamespacing()`, and you can also specify an arbitrary prefix if needed.

Also, for cases where you want to reference or overwrite global variables, an explicit escape hatch via the `--global` prefix is provided. On the other hand, at this point, it is not automatically applied to inline styles in templates. In use cases involving template HTML, it seems necessary to resolve them with `CssVarNamespacer` before use.

Since projects that utilize CSS variables extensively will benefit the most, I think it's worth trying it out as an opt-in first.