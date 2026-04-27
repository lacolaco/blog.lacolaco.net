---
title: 'Angular v22: Explaining debounced Resource'
slug: 'angular-debounced-resource'
icon: ''
created_time: '2026-04-08T02:03:00.000Z'
last_edited_time: '2026-04-27T00:02:00.000Z'
tags:
  - 'Signals'
  - '状態管理'
published: true
locale: 'en'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://www.notion.so/Angular-v22-debounced-Resource-3253521b014a8157a3b6d0d63eae2c6e'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: '6938b5e04cc31fd7121792e0396e9eb4349e3380625e369030639c347853c826'
---

In Angular v22, it is expected that `debounced` will be newly added to the Signals API family. I will explain the use cases and mechanism of this API.

https://github.com/angular/angular/commit/b918beda323eefef17bf1de03fde3d402a3d4af0

## `debounced()`

The `debounced` function returns a `Resource` object with a fixed wait time when changes to the source `Signal` are frequent. After the source changes, if no additional changes occur during the wait time, the value is finalized. The mental model is similar to `debounce` in jQuery or RxJS.

```typescript
export function debounced<T>(
  source: () => T,
  wait: NoInfer<number | ((value: T, lastValue: ResourceSnapshot<T>) => Promise<void> | void)>,
  options?: NoInfer<DebouncedOptions<T>>,
): Resource<T>
```

The following pseudo-code illustrates the behavior. While a Signal is a data model that always returns a value synchronously, the `debounced` function returns a Resource object. Its `value` property returns a Signal that does not change during the wait time. During the wait time, the Resource's `isLoading` property also becomes true.

```typescript
const source = signal('initial');
const res = debounced(source, 200);

source(); // => initial
res.value(); // => initial
res.isLoading(); // => false

source.set('updated');
source(); // => updated
res.value(); // => initial
res.isLoading(); // => true

tick(200);

source(); // => updated
res.value(); // => updated
res.isLoading(); // => false
```

A concrete use case would likely be integration with Signal Forms. In cases where an HTTP request is triggered based on a Signal bound to a text field, user input needs to be throttled. For example, by using it as follows, you can create an HTTP Resource that calls an API with a value waited on at a 200ms interval from the username field input.

```typescript
const usernameForm = form(signal('foobar'));
const res = httpResource(() => `/api/users/${debounced(usernameForm.value, 200)}`);
```

A similar use case is asynchronous validation in Signal Forms. As a built-in feature, a `debounce` option has been added to the `validateHttp` function, which throttles form value updates to perform validation via HTTP. Internally, the `debounced` function is called.

```typescript
const usernameForm = form(
  signal('foobar'),
  (p) => {
    validateHttp(p, {
      request: ({value}) => `/api/check?username=${value()}`,
      debounce: 50, // Short debounce
      onSuccess: (available: boolean) => (available ? undefined : {kind: 'username-taken'}),
      onError: () => null,
    });
  },
  {injector},
);
```

https://github.com/angular/angular/commit/24e52d450d201e3da90bb64f84358f9eccd7877d#diff-40702c7e3d12dc92f4ddf6e85452d6359479f4c0fc98ef0bb7c2e086cbeb0bb0

This should roughly explain what the debounced function is. From here, let's look at the mechanism.

## Mechanism

As in the example I wrote the other day about wrapping Firestore, `Resource` is an interface, and you are free to construct it however you like. Even without using the built-in `resource` or `httpResource` functions, you can create objects that follow the `Resource` interface. While the actual `debounced` function is a complex implementation involving detailed error handling within the framework, let's try to understand the mechanism by creating a simple, custom `debounced` function.

First, as a basic form, let's create a function that returns a `Resource` that does nothing. From Angular v21.2 onwards, you can use the `resourceFromSnapshots` function to convert to a Resource based on a Signal with a specific type.

```typescript
function debounced<T>(source: () => T): Resource<T> {
  const state = signal<ResourceSnapshot>({
    status: 'resolved',
    value: untracked(() => source()),
  });
  return resourceFromSnapshots(state);
}
```

https://angular.dev/api/core/resourceFromSnapshots

With just this, changes to the `source` will not propagate to the Resource. We need to use `effect` to update the `state` when the `source` changes.

```typescript
function debounced<T>(source: () => T): Resource<T> {
  const state = signal<ResourceSnapshot>({
    status: 'resolved',
    value: untracked(() => source()),
  });
  
  effect(() => {
    const changedValue = source();
    
    state.set({
      status: 'resolved',
      value: changedValue,
    });
  });
  
  return resourceFromSnapshots(state);
}
```

Next, we provide a wait time. We receive the interval as an argument and pass it to `setTimeout` to delay the reflection of the value to the `state`. While it is delayed, we keep the `state` in a `loading` status.

```typescript
function debounced<T>(source: () => T, wait: number): Resource<T> {
  const state = signal<ResourceSnapshot>({
    status: 'resolved',
    value: untracked(() => source()),
  });
  
  effect(() => {
    const changedValue = source();
    
    setTimeout(()=> {
      state.set({
        status: 'resolved',
        value: changedValue,
      });
    }, wait);
    
    state.set({
      status: 'loading',
      value: state.value(),
    });
  });
  
  return resourceFromSnapshots(state);
}
```

This just delays it. If an additional change is triggered during the delay time, the ongoing wait time must be discarded, and we must wait for the value to stabilize again. To maintain this asynchronous state, let's introduce local variables `activePromise` and `pendingValue`. Within the callback delayed by `setTimeout`, if the `active` matches, it means there were no additional changes.

```typescript
function debounced<T>(source: () => T, wait: number): Resource<T> {
  const state = signal<ResourceSnapshot>({
    status: 'resolved',
    value: untracked(() => source()),
  });
  
  effect(() => {
    const changedValue = source();
    
    const waiting = new Promise(resolve => {
      setTimeout(resolve, wait)
    });
    
    const activePromise = waiting;
    const pendingValue = changedValue;
    
    waiting.then(() => {
      // 割り込みの変更があればactivePromiseが不一致になる
      if (waiting === activePromise) {
        state.set({
          status: 'resolved',
          value: pendingValue,
        });
      }
    });
    
    state.set({
      status: 'loading',
      value: state.value(),
    });
  });
  
  return resourceFromSnapshots(state);
}
```

With this, our simplified `debounced` function is complete. While it differs from the actual framework implementation in fine details, the basic design is like this. Inside, it's just a simple thing managing state with a Promise and a timer.

What I want to say is that creating a function that returns a `Resource` type is easy. When you want to integrate processing with asynchrony into Signals, even if the built-in API doesn't fit well, the hurdle to create your own is low. One example of that was the previous transformation of a Firestore Collection into a Resource.

https://blog.lacolaco.net/posts/angular-firestore-resource-signal

## Summary

- `debounced()`, planned for introduction in Angular v22, takes a frequently changing Signal as input and returns a `Resource` that yields a confirmed value once the value has settled for a certain period.
- Typical use cases include "throttling input," such as HTTP Resources tied to form inputs or asynchronous validation in Signal Forms.
- The key point of the implementation is monitoring input changes with `effect`, managing the latest wait with a timer and a Promise, and updating the `ResourceSnapshot` to `resolved` upon confirmation.
- Creating a function that returns a `Resource` type is not difficult. It is a convenient interface that can be used to integrate asynchronous data sources into Signals.