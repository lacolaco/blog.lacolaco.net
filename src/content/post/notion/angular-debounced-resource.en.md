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
auto_translated_from: '9c555e0f3704762a3e236fbf8f700d348a7b4e0e35a9ccede1b4d985da1a981a'
---

In Angular v22, it is expected that `debounced` will be added to the Signals API family. I will explain the use cases and mechanisms for this API.

https://github.com/angular/angular/commit/b918beda323eefef17bf1de03fde3d402a3d4af0

## `debounced()`

The `debounced` function, when the source `Signal` changes frequently, returns a `Resource` object with a set wait time. After a change to the source occurs, the value is finalized if no additional changes happen during the wait time. The mental model is similar to `debounce` in jQuery or RxJS.

```typescript
export function debounced<T>(
  source: () => T,
  wait: NoInfer<number | ((value: T, lastValue: ResourceSnapshot<T>) => Promise<void> | void)>,
  options?: NoInfer<DebouncedOptions<T>>,
): Resource<T>
```

The following pseudo-code illustrates the behavior. While a Signal is a data model that always returns values synchronously, the `debounced` function returns a Resource object. Its `value` property returns a Signal that doesn't change during the wait time. During the wait time, the Resource's `isLoading` property also becomes true.

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

Specific use cases will likely center around integration with Signal Forms. In cases where an HTTP request is triggered based on a Signal bound to a text field, user input needs to be debounced. For example, by using it as follows, you can create an HTTP Resource that calls an API with a value debounced by 200ms from a username field input.

```typescript
const usernameForm = form(signal('foobar'));
const res = httpResource(() => `/api/users/${debounced(usernameForm.value, 200)}`);
```

A similar use case is asynchronous validation in Signal Forms. As a built-in feature, the `validateHttp` function has had the `debounce` option added to it, which performs validation via HTTP by debouncing updates to form values. Internally, the `debounced` function is being called.

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

I think this mostly explains what the debounced function is. From here, let's look at the mechanism.

## Mechanism

Like the example I wrote recently wrapping Firestore, `Resource` is an interface, and the way it is constructed is flexible. Even without using the built-in `resource` or `httpResource` functions, you can create an object that follows the `Resource` interface. While the actual `debounced` function has a complex implementation involving detailed error handling within the framework, let's try to understand the mechanism by creating a simple, custom `debounced` function.

First, as a basic form, let's try making a function that returns a `Resource` that does nothing. From Angular v21.2 onwards, by using the `resourceFromSnapshots` function, you can convert a Signal with a specific type into a Resource.

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

This alone won't propagate changes from `source` to the Resource. We need to use `effect` so that when `source` changes, we update `state`.

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

Next, we'll introduce a wait time. We'll accept an interval as an argument and pass it to `setTimeout` to delay reflecting the value in `state`. While it's delayed, we'll keep `state` in the `loading` state.

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

This just delays it, though. If additional changes fire during the delay, the ongoing wait time must be discarded, and we must wait for the value to stabilize again. To maintain this asynchronous state, let's introduce local variables `activePromise` and `pendingValue`. In the delayed callback via `setTimeout`, if `active` matches, it means there were no additional changes.

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
      // If there is an interrupting change, activePromise will mismatch
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

With this, our simple `debounced` function is complete. While it differs from the actual framework implementation in details, the basic design is like this. Internally, it's a simple thing that just manages state with a Promise and a timer.

What I want to say is that making a function that returns the `Resource` type is easy. When you want to integrate asynchronous processes into Signals, even if the built-in APIs don't fit perfectly, the barrier to creating your own is low. One example of that was the previous conversion of a Firestore Collection into a Resource.

https://blog.lacolaco.net/posts/angular-firestore-resource-signal

## Summary

- `debounced()`, scheduled for introduction in Angular v22, takes a frequently changing Signal as input and returns a `Resource` that yields a finalized value once it has stabilized for a certain period.
- Typical use cases include "debouncing input," such as HTTP Resources linked to form input or asynchronous validation in Signal Forms.
- The key points of the implementation are monitoring input changes with `effect`, managing the latest wait period with a timer and a Promise, and updating `ResourceSnapshot` to `resolved` upon finalization.
- Creating a function that returns the `Resource` type is not difficult. It is a useful interface that can be used to integrate asynchronous data sources into Signals.