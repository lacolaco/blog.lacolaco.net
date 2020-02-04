---
title: "Managing Key-Value Constants in TypeScript"
date: 2019-08-20T15:24:08Z
tags: ["TypeScript", "Angular"]
---

A lot of applications have a dropdown select menu in a form. Let's imagine a form control like below;

![Demo](https://thepracticaldev.s3.amazonaws.com/i/l1s38h340la686epz47u.gif)

Typically, each select menu's item has **ID** and **label**. The ID is responsible to communicate with other components, services, or server-side. The label is responsible to display text for users.

This post explains how to manage constants for the menu items which has ID and mapping for its label. It uses TypeScript's `as const` feature which is introduced since v3.4.

## Define colorIDs Tuple

In TypeScript, a tuple is an array, but its length and items are fixed. You can define a tuple with `as const` directive on the array literal. (`as const` directive needs TypeScript 3.4+)

Create `colors.ts` and define `colorIDs` tuple as following;

```typescript
export const colorIDs = ["green", "red", "blue"] as const;
```

The type of `colorIDs` is not `string[]` but `['green', 'red', 'blue']` . Its length is absolutely 3 and `colorIDs[0]` is always `'green'`. This is a tuple!

## Extract ColorID Type

A Tuple type can be converted to its item's **union type**. In this case, you can get `'green' | 'red' | 'blue'` type from the tuple.

Add a line to `colors.ts` like below;

```typescript
export const colorIDs = ["green", "red", "blue"] as const;

type ColorID = typeof colorIDs[number]; // === 'green' | 'red' | 'blue'
```

Got confusing? Don't worry. It's not magic.

`colorIDs[number]` means "fields which can be access by number", which are `'green'` , `'red'`, or `'blue'` .

So `typeof colorIDs[number]` becomes the union type `'green' | 'red' | 'blue'`.

## Define colorLabels map

`colorLabels` map is an object like the below;

```typescript
const colorLabels = {
  blue: "Blue",
  green: "Green",
  red: "Red"
};
```

Because `colorLabels` has no explicit type, you cannot notice even if you missed to define `red` 's label.

Let's make sure that `colorLabels` has a complete label set of all colors! `ColorID` can help it.

TypeScript gives us `Record` type to define Key-Value map object. The key is `ColorID` and the value is string. So `colorLabels` 's type should be `Record<ColorID, string>` .

```typescript
export const colorIDs = ["green", "red", "blue"] as const;

type ColorID = typeof colorIDs[number];

export const colorLabels: Record<ColorID, string> = {
  green: "Green",
  red: "Red",
  blue: "Blue"
} as const;
```

When you missed to define `red` field, TypeScript compiler throw the error on the object.

![Compiler Error](https://thepracticaldev.s3.amazonaws.com/i/kl5wx6dfejnfmiicr7ck.png)

By the way, **Angular v8.0+ is compatible with TypeScript v3.4**. The demo app in the above is the following;

```typescript
import { Component } from "@angular/core";
import { FormControl } from "@angular/forms";

import { colorIDs, colorLabels } from "./colors";

@Component({
  selector: "app-root",
  template: `
    <label for="favoriteColor">Select Favorite Color:&nbsp;</label>
    <select id="favoriteColor" [formControl]="favoriteColorControl">
      <option *ngFor="let id of colorIDs" [ngValue]="id">
        {{ colorLabels[id] }}
      </option>
    </select>
    <div>Selected color ID: {{ favoriteColorControl.value }}</div>
  `
})
export class AppComponent {
  readonly colorIDs = colorIDs;
  readonly colorLabels = colorLabels;

  readonly favoriteColorControl = new FormControl(this.colorIDs[0]);
}
```

## Conclusion

- `as const` turns an array into a **tuple**
- `typeof colorIDs[number]` returns an **union type** of its item
- Define an object with `Record<ColorID, string>` for keeping a complete field set.
