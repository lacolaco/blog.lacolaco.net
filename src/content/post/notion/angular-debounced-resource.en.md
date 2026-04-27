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

In Angular v22, `debounced` is expected to be newly added to the Signals API family. I will explain the use cases and mechanism of this API.

https://github.com/angular/angular/commit/b918beda323eefef17bf1de03fde3d402a3d4af0

## `debounced()`

The `debounced` function returns a `Resource` object with a specific wait time when changes to the source `Signal` occur at a high frequency. After a change to the source, the value is finalized if no additional changes occur during the wait time. The mental model is similar to `debounce` in jQuery or RxJS.

```typescript
export function debounced<T>(
  source: () => T,
  wait: NoInfer<number | ((value: T, lastValue: ResourceSnapshot<T>) => Promise<void> | void)>,
  options?: NoInfer<DebouncedOptions<T>>,
): Resource<T>
```

The following pseudo-code illustrates its behavior. While a Signal is a data model that always returns a value synchronously, the `debounced` function returns a Resource object. Its `value` property returns a Signal that does not change during the wait time. During the wait period, the Resource's `isLoading` property also becomes True.

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

The primary use case would likely be integration with Signal Forms. In cases where an HTTP request is generated based on a Signal bound to a text field, you would end up debouncing the user's input. For example, you can create an HTTP Resource that calls an API with a value debounced by a 200ms interval from a username field input like this:

```typescript
const usernameForm = form(signal('foobar'));
const res = httpResource(() => `/api/users/${debounced(usernameForm.value, 200)}`);
```

A similar use case is asynchronous validation in Signal Forms. As a built-in feature, a `debounce` option has been added to the `validateHttp` function, which debounces updates to form values to execute validation via HTTP. Internally, the `debounced` function is being called.

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

I think this mostly explains what the debounced function is. From here, let's check its mechanism.

## Mechanism

As in the example I wrote recently about wrapping Firestore, a `Resource` is an interface, and you are free to construct it however you like. Even without using the built-in `resource` or `httpResource` functions, you can create an object that follows the `Resource` interface. The actual `debounced` function has a complex implementation including detailed error handling within the framework, but let's try to understand the mechanism by creating a simple DIY `debounced` function.

First, as a basic form, let's try making a function that returns a `Resource` that does nothing. If you are using Angular v21.2 or later, you can use the `resourceFromSnapshots` function to convert a Signal with a specific type into a Resource.

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

This alone won't propagate changes from `source` to the Resource. We need to use `effect` to update `state` when `source` changes.

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

Next, we'll establish a wait time. By receiving an interval as an argument and passing it to `setTimeout`, we can delay the reflection of the value into `state`. While it's being delayed, we'll keep `state` in the `loading` state.

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

As it is, this is just delaying things. If an additional change fires during the delay, the in-progress wait time must be discarded, and we must wait for the value to stabilize anew. To maintain this asynchronous state, let's introduce local variables called `activePromise` and `pendingValue`. Inside the callback delayed by `setTimeout`, if the `active` matches, it means no additional changes occurred.

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

With this, the simple `debounced` function is complete. While it differs in small details from the actual implementation in the framework, the basic design is like this. Internally, it's just a simple thing managing state with a Promise and a timer.

What I want to say is that creating functions that return a `Resource` type is easy. When you want to integrate processing with asynchrony into Signals, the hurdle for creating your own is low even if built-in APIs don't fit perfectly. One example of that was the conversion of Firestore Collection into a Resource in my previous post.

https://blog.lacolaco.net/posts/angular-firestore-resource-signal

## Summary

- The `debounced()` function scheduled for introduction in Angular v22 takes a Signal that changes frequently as input and returns a `Resource` that yields a finalized value once the value has settled for a certain period.
- Typical use cases include "debouncing input," such as an HTTP Resource tied to form input or asynchronous validation in Signal Forms.
- The key point of the implementation is monitoring input changes with `effect`, managing the latest wait period with a timer and Promise, and updating the `ResourceSnapshot` to `resolved` upon finalization.
- Creating functions that return a `Resource` type is not difficult. It is a convenient interface that can be used to integrate asynchronous data sources into Signals.