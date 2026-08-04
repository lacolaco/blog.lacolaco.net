---
title: 'Angular v22.1: Namespaced CSS Variables'
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

A new feature for namespacing CSS variables has been added in Angular v22.1. I'll introduce how to use it.

## Namespaced CSS Variables

**CSS variable namespacing** is a mechanism that isolates CSS variables declared within an Angular application's component CSS into a namespace so they don't collide with CSS variables from other applications or libraries. For instance, common CSS variable names like `--primary-color` often clash with third-party UI libraries when used in an application. While it is common practice to manage this by manually adding a specific prefix to variable names, this feature automates that process.

Namespacing CSS variables is an opt-in feature, and existing behavior will not change unless it is enabled. To enable it, you add the `provideCssVarNamespacing` provider to the application configuration.

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

By default, it namespaces using the application's `APP_ID`. As shown in the image, a component CSS like the following will have an `--ng_` prefix automatically inserted.

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

By passing an argument to the `provideCssVarNamespacing` function, you can also namespace using an arbitrary string.

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

While it might seem that enabling this namespacing would prevent you from using or modifying global CSS variables within component CSS, a method has been provided for that as well.

For example, let's say a `--text-color` variable is also declared in the global CSS. If you do nothing, the namespaced variable is what gets applied to the `p` tag inside the component, so it won't be affected by the global CSS and the color won't change.

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

When you want to reference the global `--text-color` variable from within a component, you explicitly disable namespacing using the dedicated `--global` prefix. When this prefix is present, namespacing is skipped, and the remaining part with the `--global` prefix removed is what is actually applied. Of course, you can not only reference it but also override the value.

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

By enabling namespacing, if CSS variables are being used in design systems or similar built outside the application, you can import and use them while also ensuring that using CSS variables inside the application won't break the design system. I think it is a feature that one would generally want to enable in projects that leverage CSS variables.

However, there is one point to note. As of v22.1.0, the insertion of CSS variable namespaces only applies to component CSS. In other words, values provided to the `style` attribute in template HTML are not covered.

```html
<!-- Refer to the global --text-color -->
<p [style.color]="'var(--text-color)'"> 
```

If you want to use namespaced CSS variables within template HTML, you need to resolve them on the TypeScript side using the `CssVarNamespacer` service. By binding the return value resolved by the `namespace` method of `CssVarNamespacer` as follows, you can apply namespacing to dynamic styling as well.

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

CSS variable namespacing in Angular v22.1 is a practical improvement that can replace existing workflows (like adding prefixes) while automatically avoiding variable collisions within component CSS. It can be introduced just by adding `provideCssVarNamespacing()`, and you can also specify an arbitrary prefix if necessary.

Additionally, for cases where you want to reference or override global variables, an explicit escape method using the `--global` prefix is provided. On the other hand, at this point, it is not automatically applied to inline styles in templates. In use cases involving template HTML, it seems necessary to resolve them using `CssVarNamespacer`.

Since the benefits are likely to be greater for projects that make extensive use of CSS variables, I think it is worth trying out as an opt-in first.