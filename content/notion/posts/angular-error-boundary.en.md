---
title: 'Angular: Error Boundary Explained'
slug: 'angular-error-boundary'
icon: ''
created_time: '2026-10-18T15:05:00.000Z'
last_edited_time: '2026-10-18T23:44:00.000Z'
tags: []
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-error-boundary'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://app.notion.com/p/Angular-Error-Boundary-3fd3521b014a809d9a07c4a1270cadaa'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: '4ff4e3a3b2bf27d570fd16ac921de630bd6304ed59e24c6f81d800d039054556'
---

In this article, I will explain the **Error Boundary** feature introduced as a developer preview in Angular v22.2, covering its basic usage through specific use cases.

https://blog.lacolaco.net/posts/angular-v22-2-update

## What is an Error Boundary?

An **error boundary** is a boundary that catches errors occurring within a certain range and decides whether to propagate them outward or handle them on the spot. The most familiar example is probably the standard `try/catch` syntax for exception handling. Since the rendering of declarative UI components is executed at timings managed by the library, user code cannot catch exceptions that occur during rendering or updates. Therefore, a mechanism is needed to **specify part of the component tree as an error boundary**.

An error boundary in a UI is a mechanism to keep the rest of the screen usable by replacing a part that failed to render with a **fallback UI**. In React, for example, error boundaries are often used as a mechanism to detach part of the component tree from a broken UI and replace it with a fallback UI. In the following example, if an exception occurs while rendering the `Chart`, only the inside of the boundary is replaced by an error message, while the `Navigation` outside the boundary remains as it is.

```javascript
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <main>
      <Navigation />
      <ErrorBoundary fallback={<p>グラフを表示できませんでした。</p>}>
        <Chart />
      </ErrorBoundary>
    </main>
  );
}
```

Until now, Angular lacked the ability to create error boundaries within parts of the component tree like this, so one had to handle all errors via the global `ErrorHandler` API. This issue is resolved by the **built-in error boundary** introduced in Angular v22.2.

https://angular.dev/guide/templates/error-boundaries

## Use Cases

### Fallback Display for Rendering Errors

As a first example, let's look at a dashboard-like view where several widgets are lined up. Wrapping each widget with `@boundary` results in a template like the following. When an exception occurs during initialization or change detection inside `@boundary`, the content of `@error` is displayed instead of that widget.

```typescript
// fallback/fallback.ts
import { Component } from '@angular/core';
import { Chart } from '../chart';
import { Navigation } from '../navigation';
import { KpiSummary } from './kpi-summary';
import { RecentOrders } from './recent-orders';

@Component({
  selector: 'app-fallback',
  imports: [Chart, KpiSummary, Navigation, RecentOrders],
  template: `
    <main>
      <app-navigation />
      @boundary {
        <app-chart />
      } @error {
        <p>The sales chart could not be displayed.</p>
      }
      @boundary {
        <app-kpi-summary />
      } @error {
        <p>The KPIs could not be displayed.</p>
      }
      @boundary {
        <app-recent-orders />
      } @error {
        <p>The recent orders could not be displayed.</p>
      }
    </main>
  `,
})
export class Fallback {}
```

Even if the Sales Chart widget's API returns data in an invalid format, only the Sales Chart will show an error, while KPIs and Recent Orders remain functional. Without error boundaries, the entire application would have crashed, resulting in a blank screen. By **isolating error-prone components** that depend on dynamic data, the user experience can be improved.

<figure>
  <img src="/images/angular-error-boundary/fallback-valid-v2.4b64a167f33f1e83.png" alt="State where all widgets are rendered">
  <figcaption>State where all widgets are rendered</figcaption>
</figure>

<figure>
  <img src="/images/angular-error-boundary/fallback-broken-v2.28c08d30c1631990.png" alt="State where only the Sales Chart is replaced by the fallback UI">
  <figcaption>State where only the Sales Chart is replaced by the fallback UI</figcaption>
</figure>

#### Swallowing Rendering Errors to Skip Display

There are cases where if something cannot be rendered, it's better to just not display it at all, without even showing a fallback UI. A campaign banner rendered based on dynamically delivered settings is a good example of this. If the settings are broken and the banner cannot be rendered, users won't be troubled as long as the banner simply doesn't appear. In such cases, by leaving the `@error` block empty, you can swallow the error and skip the display.

```typescript
// hide-on-error/hide-on-error.ts
import { Component } from '@angular/core';
import { KpiSummary } from '../fallback/kpi-summary';
import { Navigation } from '../navigation';
import { CampaignBanner } from './campaign-banner';

@Component({
  selector: 'app-hide-on-error',
  imports: [CampaignBanner, KpiSummary, Navigation],
  template: `
    <main>
      <app-navigation />
      @boundary {
        <app-campaign-banner />
      } @error {}
      <app-kpi-summary />
    </main>
  `,
})
export class HideOnError {}
```

Note that even when you want to skip the display, the **empty** `@error` **block cannot be omitted**. You can compile without an `@error` block, but in that case, if an exception occurs, there is no `@error` block to render, so the error will be thrown outside the boundary.

<figure>
  <img src="/images/angular-error-boundary/hide-on-error-valid-v2.5422276b2f2ab87d.png" alt="State where the banner is displayed">
  <figcaption>State where the banner is displayed</figcaption>
</figure>

<figure>
  <img src="/images/angular-error-boundary/hide-on-error-broken-v2.ffca8c18a29acbed.png" alt="State where the banner is no longer displayed due to broken settings">
  <figcaption>State where the banner is no longer displayed due to broken settings</figcaption>
</figure>

### Retrying Rendering

Calling `$reset()`, which is available inside `@error`, clears the error state and retries the rendering. However, if the situation hasn't changed, the same exception will simply occur again and you'll go back to the `@error` display, so it must be called after the cause of the error has been removed.

In the following example, consider a case where the display settings for a chart saved by a user are corrupted, causing the chart to fail to render. We place a button in the error display to reset settings to their default values, and after reverting the settings, we call `$reset()` to redraw the chart.

```typescript
// retry/retry.ts
import { Component, inject } from '@angular/core';
import { Navigation } from '../navigation';
import { ChartSettingsService } from './chart-settings.service';
import { SeriesChart } from './series-chart';

@Component({
  selector: 'app-retry',
  imports: [Navigation, SeriesChart],
  template: `
    <main>
      <app-navigation />
      @boundary {
        <app-series-chart />
      } @error {
        <p>The chart settings are invalid.</p>
        <button type="button" (click)="restoreDefaults($reset)">Restore default settings</button>
      }
    </main>
  `,
})
export class Retry {
  private readonly chartSettings = inject(ChartSettingsService);

  restoreDefaults(reset: () => void): void {
    this.chartSettings.restoreDefaults();
    reset();
  }
}
```

Inside the `@error` block, `$reset` can be referenced as a function, so it can be passed as an argument to component methods like this. In template type checking, `$reset` is treated as the `() => void` type, so you can apply that type to the method argument as well.

<figure>
  <img src="/images/angular-error-boundary/retry-valid-v2.47fc942869a1ad58.png" alt="State where the chart is rendered">
  <figcaption>State where the chart is rendered</figcaption>
</figure>

<figure>
  <img src="/images/angular-error-boundary/retry-broken-v2.2777146d820e9a21.png" alt="State where the button to reset to defaults is displayed">
  <figcaption>State where the button to reset to defaults is displayed</figcaption>
</figure>

### Changing Display Based on Error Content

For example, consider a component that displays account information for a logged-in user. If the user logs out in another tab, the session ends, and the user information referenced by the component during rendering is lost. In this case, unlike a simple rendering failure, I would want to display a link to log back in.

```typescript
// auth.ts (excerpt)
export class UnauthenticatedError extends Error {}

// inside AuthService
requireUser(): User {
  const user = this.user();
  if (user === null) {
    throw new UnauthenticatedError('No user is signed in.');
  }
  return user;
}
```

Within the template, you can determine the error using the `when` condition of `@error`. Prepare a predicate function in the component like the following.

```typescript
// error-types/error-types.ts (inside the component class)
readonly isUnauthenticated = (error: unknown) => error instanceof UnauthenticatedError;
```

By declaring error branching conditions in the template, you can fall back to different UIs for each `when` condition. For exceptions other than `UnauthenticatedError`—for example, if a `TypeError` occurs during rendering because user information is corrupted—the `@error` block without a condition will be displayed.

```typescript
// error-types/error-types.ts
import { Component } from '@angular/core';
import { UnauthenticatedError } from '../auth';
import { Navigation } from '../navigation';
import { AccountSummary } from './account-summary';

@Component({
  selector: 'app-error-types',
  imports: [AccountSummary, Navigation],
  template: `
    <main>
      <app-navigation />
      @boundary {
        <app-account-summary />
      } @error (let error; when isUnauthenticated(error)) {
        <p>Your session has ended.</p>
        <a href="/sign-in">Sign in again</a>
      } @error {
        <p>Your account could not be displayed.</p>
      }
    </main>
  `,
})
export class ErrorTypes {
  readonly isUnauthenticated = (error: unknown) => error instanceof UnauthenticatedError;
}
```

<figure>
  <img src="/images/angular-error-boundary/error-types-signed-in.30df8f3d728b76bd.png" alt="State where the signed-in user is displayed">
  <figcaption>State where the signed-in user is displayed</figcaption>
</figure>

<figure>
  <img src="/images/angular-error-boundary/error-types-signed-out.80dd2c50d65e0a0d.png" alt="State where the session has ended">
  <figcaption>State where the session has ended</figcaption>
</figure>

### Collecting Rendering Errors with onViewError

While error boundaries now prevent application crashes, simply swallowing errors can be problematic in some cases. If the error frequency is high, there might be something wrong with the backend API. In such cases, one might want to record the occurrence of the fallback in an error collection service. Using the `onViewError` method of `ErrorHandler`, you can **receive and process errors caught by error boundaries**. The following example assumes the use of Sentry as an error collection service.

```typescript
// on-view-error/app-error-handler.ts
import { ErrorHandler, Injectable, reflectComponentType, Type } from '@angular/core';
import type { ErrorDetails } from '@angular/core';
import { Sentry } from './sentry';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    Sentry.captureException(error);
  }

  onViewError(error: Error, details: ErrorDetails): void {
    Sentry.captureException(error, {
      tags: {
        component: selectorOf(details.declarationType),
        boundary: details.boundary ? selectorOf(details.boundary.type) : 'none',
      },
    });
  }
}

// Class names are minified in production builds, so the selector names the component instead.
function selectorOf(type: Type<unknown>): string {
  return reflectComponentType(type)?.selector ?? type.name;
}
```

The `ErrorDetails` object includes the class (`declarationType`) and instance (`declarationInstance`) of the component or directive where the error occurred, as well as the class of the component declaring the boundary that caught the error (`boundary.type`). In this example, these are sent as Sentry tags so that we can aggregate which component's rendering failed on which screen. However, in production builds, class names are minified and the original name cannot be obtained from the `name` property, so I am using `reflectComponentType` to extract the component's selector as the tag value.

https://angular.dev/api/core/ErrorDetails

## Conclusion

With the introduction of built-in error boundaries as template syntax, it has become quite simple to implement robust applications that do not easily crash. In environments like admin screens for feature-rich and complex business systems where Angular is often used, I think it would be good to use error boundaries like firewalls to prevent the entire application from breaking due to an error in one part.

Especially in contexts like [A2UI](https://a2ui.org/) or Generative UI, where UI is displayed using LLM-generated JSON as input, we inevitably have to handle non-deterministic and untrustworthy data on the client side. While defending with validation is important, I suspect that utilizing error boundaries to prevent application crashes even in the worst-case scenario will become a standard practice in the future.

Personally, this is a feature I've wanted for a long time, so I'm very happy that it's finally available starting from v22.2. While keeping in mind that it is a developer preview, let's proactively make use of it.

The sample code for this article is available on GitHub.

https://github.com/lacolaco/angular-error-boundary-example