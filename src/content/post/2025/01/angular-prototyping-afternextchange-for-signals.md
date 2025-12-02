---
title: 'Angular: Prototyping afterNextChange for Signals'
slug: 'angular-prototyping-afternextchange-for-signals'
icon: ''
created_time: '2025-01-19T09:44:00.000Z'
last_edited_time: '2025-01-19T11:02:00.000Z'
tags:
  - 'Angular'
  - 'Signals'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Prototyping-afterNextChange-for-Signals-1803521b014a8061ac65d2a070fe5d09'
features:
  katex: false
  mermaid: false
  tweet: false
---

While developing Angular applications with Signals, I frequently encounter the need for practical utilities not yet supported by the framework. This prototype addresses specific challenges when working with `effect()`.

## Wait for the next change

When working with signals, I sometimes need to delay a function's execution until the next signal change. However, using `effect()` presents two key problems in this scenario.

1. The first `effect()` execution uses the current signal value.
1. An `effect()` cannot be destroyed from within its own callback function.

As a result, here's an example implementation of `waitForNextChange()`. This function returns a `Promise<T>` that resolves with the next value from the source `Signal<T>`. The function skips the first (current) value, uses the second value to resolve the promise, and when the promise resolves, the watcher will be destroyed.

```typescript
function waitForNextChange<T>(
  source: Signal<T>,
  injector: Injector
): Promise<T> {
  let watcher: EffectRef;
  const p = new Promise<T>((resolve) => {
    let first = true;
    watcher = effect(
      () => {
        const value = source();
        if (first) {
          // skip the first value
          first = false;
        } else {
          untracked(() => resolve(value));
        }
      },
      { injector, manualCleanup: true }
    );
  });
  return p.finally(() => watcher.destroy());
}

const touched = signal(false);
waitForNextChange(touched, injector).then(() => {
  console.log('touched');
});

```

The implementation above is virtually identical to this:

```typescript
// Rewrite with rxjs-interop
function waitForNextChange<T>(
  source: Signal<T>,
  injector: Injector
): Promise<T> {
  return firstValueFrom(toObservable(source, { injector }).pipe(skip(1)));
}
```

Alternatively, using a callback function style similar to Angular's `afterNextRender`, the implementation would look like this:

```typescript
function afterNextChange<T>(
  source: Signal<T>,
  injector: Injector,
  callback: (value: T) => void
): void {
  let watcher: EffectRef;
  const p = new Promise<T>((resolve) => {
    let first = true;
    watcher = effect(
      () => {
        const value = source();
        if (first) {
          // skip the first value
          first = false;
        } else {
          untracked(() => resolve(value));
        }
      },
      { injector, manualCleanup: true }
    );
  });
  p.then(callback).finally(() => watcher.destroy());
}

const touched = signal(false);
afterNextChange(touched, injector, () => {
  console.log('touched');
});
```

https://stackblitz.com/edit/stackblitz-starters-sbqq9vcc?ctl=1&embed=1&file=src%2Fmain.ts

## Considerations

Although these implementations are functional, there are some drawbacks to consider. The requirement for an `Injector` particularly degrades the developer experience. While Promises are a native JavaScript feature and Signals are meant to be Angular's "primitives," converting between them is unexpectedly complex. This conversion process should be more intuitive and require less boilerplate.

