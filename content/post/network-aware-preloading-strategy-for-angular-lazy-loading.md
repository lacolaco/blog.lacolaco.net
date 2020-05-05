---
title: "Network-aware Preloading Strategy for Angular Lazy Loading"
date: 2019-05-11T10:01:10Z
tags: ["angular", "lazy-loading", "performance", "typescript"]
---

This post explains how to make *network-aware* preloading strategy for lazy loading of Angular Router. 

It can improve user experience with lazy loading despite users network condition.

![](https://thepracticaldev.s3.amazonaws.com/i/t6o2d6hv9v3jjbtx5pkl.png)

# What is Preloading?

**Preloading** is an important feature of Angular Router's lazy loading. This is available since 2.1.0. 

By default, when the application uses lazy loading with `loadChildren`, chunked lazy modules will be loaded on-demand. It can reduce initial bundle size but users have to wait for loading of chunks on transition. 

Preloading changes that. By preloading, the application will start loading chunked modules **before needed**. It can improve user experience with smooth transition.

Here is the best article to read at first about preloading in Angular by Victor Savkin. He is the author of the feature.

[Angular Router: Preloading Modules](https://vsavkin.com/angular-router-preloading-modules-ba3c75e424cb)

# Preloading Strategy

Angular Router supports customizing preloading behavior with `PreloadingStrategy` feature. There are two built-in strategies; `PreloadAllModules` and `NoPreloading`.

`NoPreloading` is the default behavior that doesn't preload any modules. 

`PreloadAllModules` loads all lazy modules immediately after bootstrapping. In other word, this is "As soon as possible" strategy.

```ts
import { RouterModule, NoPreloading, PreloadAllModules } from '@angular/router';

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules, // or NoPreloading
    }),
  ],
})
class AppRoutingModule {}
```

`PreloadingStrategy` is a simple class object implementing a `preload` method. So we can make custom preloading strategy in ease like below.

The `preload` method takes two arguments; `route` and `load` . `route` is a route object that you declare in `routes` array. `load` is a function that trigger loading a module. 

```ts
// custom-preloading-strategy.ts
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CustomPreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    if (shouldPreload(route)) {
      return load();
    } else {
      return EMPTY;
    }
  }
}

// app-routing.module.ts
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: CustomPreloadingStrategy,
    }),
  ],
})
class AppRoutingModule {}
```

# Preloading Problem: Cost of networking

Preloading can improve user experience, but it is only in the case the device uses in fast network enough. Sometimes mobile devices have a narrow-band network connection. If then the application tries to preload all modules ASAP, it affects other connections like AJAX in a bad way. 

Preloading is an appropriate solution for users who has a strong network. If they don't, on-demand loading is better. But this condition can change very dynamically, so the application have to get network information in runtime and turning on/off preloading.

I call that "**Network-aware Preloading Strategy**". 

# Using Network Information API

[**Network Information API**](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation) is a new Web standard API proposal. The Network Information API provides information about the system's connection. 

{% youtube jO8iVc4hEe8 %}

The entire API consists of the addition of the `NetworkInformation` interface and a single property to the `Navigator` interface: `Navigator.connection` . Because this API is not a standard yet, TypeScript doesn't have its type definition. So I've created that as `network-information-types` package and it is used in all example codes below. 

{% github lacolaco/network-information-types %}

# Making Network-aware PreloadingStrategy

Let's make network-aware preloading strategy with Network Information API! The following code defines `shouldPreload` function that is used in the above `CustomPreloadingStrategy` example. 

`navigator.connection` is landed in limited browsers. So we MUST detect the feature. In this case, 

```ts
export function shouldPreload(route: Route): boolean {
  // Get NetworkInformation object
  const conn = navigator.connection;

  if (conn) {
    // With network information
  }
  return true;
}
```

## Detecting "Save Data" mode

At first, "Save Data" mode should be prioritized the best. It means the user strongly cares about payload size for their cost- or performance-constraints. Use `NetworkInformation.saveData` property and return `false`.

```ts
export function shouldPreload(route: Route): boolean {
  // Get NetworkInformation object
  const conn = navigator.connection;

  if (conn) {
    // Save-Data mode
    if (conn.saveData) {
      return false;
    }
  }
  return true;
}
```

## Detecting "2G" connection

Network Information API can recognize the network's effective connection type; 4G, 3G, 2G, and Slow 2G. 

In this sample, the application disables preloading when the user is in 2G network. 

```ts
export function shouldPreload(route: Route): boolean {
  // Get NetworkInformation object
  const conn = navigator.connection;

  if (conn) {
    // Save-Data mode
    if (conn.saveData) {
      return false;
    }
    // 'slow-2g', '2g', '3g', or '4g'
    const effectiveType = conn.effectiveType || '';
    // 2G network
    if (effectiveType.includes('2g')) {
      return false;
    }
  }
  return true;
}

```

Network Information API has also several other properties like `rtt` (RTT, round-trip time of the connection). You can add more checks for your application. 

# Conclusion

- Angular Router is supporting **preloading** feature since 2.1.0.
- You can create your own custom preloading strategy
- Preloading is effective only for users with a fast network.
- **Network Information API** is available in several browsers.
- It's very easy to make network-aware preloading strategy.

Thank you for reading!