---
title: 'Angular: Input Transforms For Arrays In Query Params'
slug: 'angular-input-transforms-for-arrays-in-query-params'
icon: ''
created_time: '2023-12-04T13:19:00.000Z'
last_edited_time: '2023-12-30T09:58:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'en'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Input-Transforms-For-Arrays-In-Query-Params-5ad67d6f9feb4970a107105bb88d8023'
features:
  katex: false
  mermaid: false
  tweet: false
---

**Input Transforms**, introduced in Angular v16, allow you to declare transformation processes for input properties when values are set by passing a function using `@Input({ transform: transformFn })`. A typical use case is when creating directives or components that mimic the behavior of HTML standard boolean attributes, such as `<button disable>`, and need to convert them into boolean values. Similarly, for attributes that accept numeric values like `<img width="16">`, if you want to mimic the behavior of HTML attributes, you'll need to convert them from strings.

[Accepting data with input properties • Angular](https://angular.dev/guide/components/inputs#input-transforms)

```typescript
import {Component, Input, booleanAttribute, numberAttribute} from '@angular/core';
@Component({...})
export class CustomSlider {
  @Input({transform: booleanAttribute}) disabled = false;
  @Input({transform: numberAttribute}) number = 0;
}

```

By combining this feature with **Component Input Binding** in the Angular v16 Router, handling array data as query parameters becomes easier.

## Arrays in Query Params

[There are various patterns for representing arrays as query parameters](https://medium.com/raml-api/arrays-in-query-params-33189628fa68), but when you specify an array value as a query parameter using the `navigate()` method or `RouterLink` in the Router, Angular converts it into the format of repeating the same key parameter multiple times, like `key=param1&key=param2`.

![image](/images/angular-input-transforms-for-arrays-in-query-params/Untitled.e0a7f813b2256a74.png)

```typescript
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <router-outlet />
    <ul>
      <li><a routerLink="" [queryParams]="{query: null}" >no query</a></li>
      <li><a routerLink="" [queryParams]="{query: 1}" >query=1</a></li>
      <li><a routerLink="" [queryParams]="{query: [1]}" >query=[1]</a></li>
      <li><a routerLink="" [queryParams]="{query: [1,2]}" >query=[1,2]</a></li>
    </ul>
  `,
})
export class App {}

const routes: Routes = [
  {
    path: '',
    component: Page,
  },
];

bootstrapApplication(App, {
  providers: [provideRouter(routes, withComponentInputBinding())],
});

```

Writing an array type as a query parameter is easy, but reading it from the query parameter requires some consideration. The reason is that in this format, if there is only `query=1`, the information about whether **it was originally an array or not** is lost. In other words, the query parameters generated from a non-array value like `{ query: 1 }` and a length-1 array like `{ query: [1] }` will be the same.

![image](/images/angular-input-transforms-for-arrays-in-query-params/Untitled.f0d6ea9c3ed5f663.png)

If you don't keep this in mind, the following naive implementation will throw a runtime error immediately. Although the `query` input property will be set with the value from the query parameter due to the `withComponentInputBinding()` option of the Router, even if it was an array when writing it to the query parameter, if the length is 1, it will become a simple string and the `query.join()` method will throw an error because it doesn't exist for strings.

```typescript
@Component({
  standalone: true,
  imports: [JsonPipe],
  template: `
  <div>query={{ query.join(', ') }}</div>
  `,
})
export class Page {
  @Input()
  query: string[] = [];
}

```

![image](/images/angular-input-transforms-for-arrays-in-query-params/Untitled.2aad59ca4a79b7ea.png)

Also, naturally, you need to consider the case where there are no query parameters, so the actual type of this `query` input property should be `string[] | string | undefined`. However, no one wants to deal with an input property of this type. That's where Input Transforms, mentioned at the beginning, come in handy.

By the way, the behavior of converting objects and query parameters to each other can be modified by extending `UrlSerializer` in your way.

https://angular.io/api/router/UrlSerializer

## Normalization to an array

Using Input Transforms, you can normalize the `query` input property to be treated as a `string[]` type. If we assume that the transformation process is performed by a `normalizeQuery` function that takes an argument of type `string[] | string | undefined` and returns `string[]`, the component can be written as follows. You can use any implementation for `normalizeQuery` as long as it is a function that takes an argument of type `string[] | string | undefined` and returns `string[]`.

```typescript
function normalizeQuery(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

@Component({...})
export class Page {
  @Input({ transform: normalizeQuery })
  query: string[] = [];
}

```

I have provided a working sample code on Stackblitz for you to try out.

https://stackblitz.com/edit/angular-xjw1sl?ctl=1&embed=1&file=src/main.ts

## Takeaways

- When setting a length-1 array as a query parameter, the Router cannot parse it as an array.
- Normalization is necessary to handle the case when there are no query parameters.
- Using Router's Component Input Binding and Input Transforms, you can directly receive the normalized value in the input property.

