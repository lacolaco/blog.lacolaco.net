---
title: 'Deep Dive into Angular Components: MatDivider'
slug: 'deep-dive-angular-components-mat-divider.en'
icon: ''
created_time: '2020-05-05T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
tags:
  - 'Angular'
  - 'Angular Material'
published: true
locale: 'en'
category: 'Tech'
notion_url: 'https://www.notion.so/Deep-Dive-into-Angular-Components-MatDivider-4d1722665b4b488d8049bf2ac4fee642'
features:
  katex: false
  mermaid: false
  tweet: false
---

This series explains how Angular Components are working by diving its source code deeply.

https://github.com/angular/components

## MatDivider

**MatDivider** is one of the simplest component in the Angular Material library.

https://material.angular.io/components/divider/overview

It just can display a line separator but its source code is worth to read enough.

[https://github.com/angular/components/blob/master/src/material/divider/divider.ts](https://github.com/angular/components/blob/master/src/material/divider/divider.ts)

```
@Component({
  selector: 'mat-divider',
  host: {
    'role': 'separator',
    '[attr.aria-orientation]': 'vertical ? "vertical" : "horizontal"',
    '[class.mat-divider-vertical]': 'vertical',
    '[class.mat-divider-horizontal]': '!vertical',
    '[class.mat-divider-inset]': 'inset',
    'class': 'mat-divider'
  },
  template: '',
  styleUrls: ['divider.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatDivider {
  /** Whether the divider is vertically aligned. */
  @Input()
  get vertical(): boolean { return this._vertical; }
  set vertical(value: boolean) { this._vertical = coerceBooleanProperty(value); }
  private _vertical: boolean = false;

  /** Whether the divider is an inset divider. */
  @Input()
  get inset(): boolean { return this._inset; }
  set inset(value: boolean) { this._inset = coerceBooleanProperty(value); }
  private _inset: boolean = false;

  static ngAcceptInputType_vertical: BooleanInput;
  static ngAcceptInputType_inset: BooleanInput;
}
```

If you’ve understood every line above, you don’t need to read following parts.

### Component Metadata

At first, look at the metadata of `MatDivider` line by line.

```
@Component({
  selector: 'mat-divider',
  host: {
    'role': 'separator',
    '[attr.aria-orientation]': 'vertical ? "vertical" : "horizontal"',
    '[class.mat-divider-vertical]': 'vertical',
    '[class.mat-divider-horizontal]': '!vertical',
    '[class.mat-divider-inset]': 'inset',
    'class': 'mat-divider'
  },
  template: '',
  styleUrls: ['divider.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

### `selector`

The `selector` metadata is a CSS selector of the component. If you don’t know this, you may need to go back to [getting started](angular.io/start).

### `host`

The `host` metadata is a map of binding to host element. It can accept template syntax same as inner template.

https://angular.io/api/core/Directive#host

### `'role': 'separator'`

`<mat-divider>` host element has always `role="separator"` attribute. This is an **ARIA** role attribute. This arrtibute tells the User Agent this non-built-in HTML tag is a separator.

[The Roles Model | Accessible Rich Internet Applications (WAI-ARIA) 1.0](https://www.w3.org/WAI/PF/aria/roles#separator)

> A divider that separates and distinguishes sections of content or groups of menuitems.

### `'[attr.aria-orientation]': 'vertical ? "vertical" : "horizontal"'`

Above `separator` role supports `aria-orientation` which is a state of its orientation. If `MatDivider#vertical` property is true, it represents the separator is a vertical separator.

[Supported States and Properties | Accessible Rich Internet Applications (WAI-ARIA) 1.0](https://www.w3.org/WAI/PF/aria/states_and_properties#aria-orientation)

### `'[class.mat-divider-vertical]': 'vertical'`

It sets `mat-divider-vertical` class to `<mat-divider>` host element by using **class binding**. That class is used for styling you can see in `divider.scss`

[https://github.com/angular/components/blob/master/src/material/divider/divider.scss#L10-L14](https://github.com/angular/components/blob/master/src/material/divider/divider.scss#L10-L14)

```scss
&.mat-divider-vertical {
    border-top: 0;
    border-right-width: $mat-divider-width;
    border-right-style: solid;
}
```

### `'[class.mat-divider-horizontal]': '!vertical'`

This line is similar to the above but interestingly `mat-divider-horizontal` class is not used in the SCSS. How do you think why it is set?

- [https://github.com/angular/components/blob/master/src/material/divider/divider.scss](https://github.com/angular/components/blob/master/src/material/divider/divider.scss) 
- [https://github.com/angular/components/blob/master/src/material/divider/_divider-theme.scss](https://github.com/angular/components/blob/master/src/material/divider/_divider-theme.scss) 

As far I can imagine, this is set for user customization. Develoers can override horizontal-specific style by using `.mat-divider-hotizontal`. Angular Material supports user-customization at many points.

```scss
.my-app {
    .mat-divider-horizontal {
        border-top-width: 2px; // Override divider's thickness
    }
}
```

To know that philosophy, you can watch a talk by the Angular Material maintainer, Jeremy Elbourn.

https://videos.ng-conf.org/videos/a-philosophy-for-designing-components-with-composition

### `'[class.mat-divider-inset]': 'inset'`

This sets `.mat-divider-inset` class to `<mat-divider>` host element.

### `'class': 'mat-divider'`

This sets `.mat-divider` class to `<mat-divider>` host element. Most of (maybe all?) Angular Material components/directives set its own class to the host element.

### `template: ''`

This component doesn’t has any children but just shows border of the host element.

### `styleUrls: ['divider.css']`

This component has its own style. `divider.scss` will be compiled into `divider.css`.

### `encapsulation: ViewEncapsulation.None`

Interesting point! Angular Material components basically **don’t encapusulate its style**. It means styles in `divider.css` are exposed to document global.

https://angular.io/api/core/Component#encapsulation

`encapusulation` metadata is set to `Emulated` by default so we can use safely styles in the component template scope. But scoped styles cannot be overrided from outside even developer. Angular Material explicitly turns off the mechanism to allow user customization.

### `changeDetection: ChangeDetectionStrategy.OnPush`

This component will be re-render only when its any input has been updated.

https://web.dev/faster-angular-change-detection/

### Component class

Let’s step down into `MatDivider` class.

```
export class MatDivider {
  /** Whether the divider is vertically aligned. */
  @Input()
  get vertical(): boolean { return this._vertical; }
  set vertical(value: boolean) { this._vertical = coerceBooleanProperty(value); }
  private _vertical: boolean = false;

  /** Whether the divider is an inset divider. */
  @Input()
  get inset(): boolean { return this._inset; }
  set inset(value: boolean) { this._inset = coerceBooleanProperty(value); }
  private _inset: boolean = false;

  static ngAcceptInputType_vertical: BooleanInput;
  static ngAcceptInputType_inset: BooleanInput;
}
```

### `vertical` Input

`MatDivider#vertical` is a set of setter and getter. `@Input()` decorator can be placed on setter as well as a normal field.

[Angular - Component interaction](https://angular.io/guide/component-interaction#intercept-input-property-changes-with-a-setter)

### `inset` Input

Similar to `vertical` . :slightly_smiling_face:

### `static ngAcceptInputType_vertical: BooleanInput;`

Interesting point again! This is a special static field for communication with Angular AoT compiler. This `ngAcceptInputType_{inputName}` is a _hint_ for type checking the input field with **input setter coercion**. If you haven’t heard of input setter coercion, read the official document.

[https://angular.io/guide/template-typecheck#input-setter-coercion](https://angular.io/guide/template-typecheck#input-setter-coercion)

In short, sometimes an input field needs to accept a value which doesn’t match type. To allow user to write an input shorthand like `<mat-divider vertial>`, `vertial` setter has to accept `''` in addition to boolean value.

That is why`static ngAcceptInputType_vertical: BooleanInput;` exists. `BooleanInput` is a type provided from `@angular/cdk/coercion`. `ngAcceptInputType_vertical` tells AoT compier that `vertical` input can accept types `string | boolean | null | undefined`.

[https://github.com/angular/components/blob/master/src/cdk/coercion/boolean-property.ts](https://github.com/angular/components/blob/master/src/cdk/coercion/boolean-property.ts)

```
export type BooleanInput = string | boolean | null | undefined;
```

And actual coercion logic is also provided as `coerceBooleanProperty` by CDK. So every developers can use the same mechanism in any component.

### `static ngAcceptInputType_inset: BooleanInput;`

Similar to the above.

## Summary

- `MatDivider` has a `separator` role.
- `MatDivider` provides CSS classes to allow user customization.
- `MatDivider` displays only host element border.
- `MatDivider` can accept a shorthand of the boolean input like `<mat-divider vertical>`

