---
title: 'Angular v22: Lazy Loading Business Logic with injectAsync'
slug: 'angular-v22-injectasync'
icon: ''
created_time: '2026-06-21T23:49:00.000Z'
last_edited_time: '2026-06-22T00:00:00.000Z'
tags:
  - 'TypeScript'
  - 'Dependency Injection'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-v22-injectasync'
channels:
  - 'Angular'
notion_url: 'https://app.notion.com/p/Angular-v22-injectAsync-3813521b014a80c7aad1d3778117c09c'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: 'b90f88266398885cf2ef78a2a4e0bcb7bbde2ce5661b42ea2abcd8c0621178b3'
---

The `injectAsync` function added in Angular v22 provides a new option for improving loading speeds. I'll introduce this new API while reviewing the existing lazy loading APIs.

https://angular.jp/guide/di/lazy-loading-services

## `injectAsync` 

The `inject` function used for dependency injection creates a static reference to the target being injected. Because of this, if the dependent side is included in the initial load JS, the dependency will also increase the bundle size accordingly. In the following example, the `ReportView` component and the `ReportExporter` service are statically coupled, and their loading timing cannot be separated.

```typescript
// Static import
import { ReportExporter } from './exporter';

@Component({...})
export class ReportView {
  // ReportView statically references ReportExporter
  exporter = inject(ReportExporter);
  
  export() {
    this.exporter.export();
  }
}
```

If `ReportExporter` isn't a feature that's always used, I might want to leave only `ReportView` in the initial load and delay `ReportExporter` so it's loaded only when the export button is pressed. That's where `injectAsync` comes in. This function makes the injection of a specific service asynchronous, allowing for bundle splitting and lazy loading of the module.

As shown in the next example, you replace the reference to the `ReportExporter` service from a static import with a dynamic import in the argument of the `injectAsync` function. By doing this, the `this.exporter` field becomes a function that returns a service reference asynchronously when called. If you `await` the return value, you can use the service just as before.

```typescript
@Component({...})
export class ReportView {
  // Dynamic import
  // ReportView dynamically references ReportExporter
  exporter = injectAsync(() => import('./exporter').then(m => m.ReportExporter));
  
  async export() {
    const exporter = await this.exporter();
    exporter.export();
  }
}
```

### Usage constraints

`injectAsync` can only be used with services declared with `@Injectable({ providedIn: 'root' })` or the `@Service()` decorator. Due to the nature of being dynamically integrated into the dependency injection system upon module loading, it doesn't support complex provider definitions.

## Lazy Loading Methods and Use Cases

As in the example above, if a certain feature provided by the application is infrequently used, it might be worth considering lazy loading so as not to compromise the experience of users who don't use that feature. Angular provides several lazy loading APIs, but how to choose between them depends on the application domain—specifically, what granularity and at which boundaries the application's features can be separated.

### Lazy Loading by Route

The coarsest granularity of lazy loading is splitting bundles by the Router's page-loading unit (route). You can use `loadChildren` when you want to lazy-load all pages under a certain path using parent-child route relationships, or `loadComponent` when you want to lazy-load a specific route.

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    // Lazy load the login page
    loadComponent: () => import('./components/auth/login-page'),
  },
  {
    path: 'admin',
    // Lazy load the admin pages
    loadComponent: () => import('./admin/admin.component'),
    loadChildren: () => import('./admin/admin.routes'),
  },
];
```

In cases where accessible pages are clearly separated by factors like user permissions, introducing route-based lazy loading would likely be effective.

https://angular.jp/best-practices/performance/lazy-loaded-routes

### Lazy Loading Partial Views

By using the `@defer` block, you can make parts of a component view lazy-loadable. The view is loaded and initialized only when that area enters the screen or when the user performs some action.

```typescript
@defer {
  <large-component />
} @placeholder {
  <p>プレースホルダーコンテンツ</p>
}
```

This is an option you can choose when a specific component among a component's descendant views has a large impact on bundle size, and its display speed isn't mission-critical. Examples might include calendar widgets or complex forms. A blog post comment section that isn't in the initial viewport would also be a perfect candidate.

In cases where the frequency and timing of feature usage vary by screen area, lazy loading views with `@defer` should work effectively.

https://angular.jp/best-practices/performance/defer

### Lazy Loading Services

When it's the logic rather than the view that can be partially delayed, that's when you'd choose `injectAsync`, which I've introduced here. If logic that uses a large third-party library isn't needed for the initial load and you can trigger the loading when it becomes necessary, `injectAsync` is the way to go.

https://angular.jp/best-practices/performance/lazy-loading-services

### Lazy Loading Modules

Finally, a method that's easy to forget because it's not an Angular-specific API is simply using ES Module dynamic imports via `import(...)` to achieve module-level lazy loading. This is because dynamic imports are converted into lazy loads within the Angular CLI build process. If the target to be loaded is just a function, class, or constant and isn't related to Angular's dependency injection or component system, using a plain dynamic import is sufficient.

You could split it by the service that uses it—such as a library used only in specific use cases—or you could reference the service statically and perform the module-level splitting inside it. I think you can decide this based on implementation preference. The only difference is whether the responsibility for asynchronous processing lies outside or inside the service. Personally, I feel that if `injectAsync` can cover it, then that's fine, but it might be best to combine it with module-level lazy loading as needed when complex DI provider definitions are required.

## Summary

- `injectAsync` enables bundle splitting and lazy loading on a per-service basis by replacing DI references with dynamic imports.
- It is limited to services declared with `@Injectable({ providedIn: 'root' })` or `@Service()`, and does not support complex provider definitions.
- Lazy loading methods and splitting units provided by Angular
  - Routes: `loadChildren` / `loadComponent`
  - Partial Views: `@defer`
  - Services: `injectAsync`
  - Other Modules: `import(...)`