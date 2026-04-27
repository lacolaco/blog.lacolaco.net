---
title: 'Angular v22: Explaining debounced Resource'
slug: 'angular-debounced-resource'
icon: ''
created_time: '2026-04-08T02:03:00.000Z'
last_edited_time: '2026-04-27T23:20:00.000Z'
tags:
  - 'Signals'
  - 'State Management'
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
auto_translated_from: '647faca2764759408661b2451de77e84b5d4a048ba3fc72e837ef88abd0b4052'
---

In Angular v22, it looks like `debounced` will be newly added to the Signals API family. I'll explain the use cases and the mechanism for this API.

https://github.com/angular/angular/commit/b918beda323eefef17bf1de03fde3d402a3d4af0

## `debounced()`

The `debounced` function returns a `Resource` object with a certain wait time when changes to the source `Signal` are high-frequency. After a change to the source occurs, the value is finalized if no additional changes happen during the wait time. The mental model is similar to `debounce` in jQuery or RxJS.

```typescript
export function debounced<T>(
  source: () => T,
  wait: NoInfer<number | ((value: T, lastValue: ResourceSnapshot<T>) => Promise<void> | void)>,
  options?: NoInfer<DebouncedOptions<T>>,
): Resource<T>
```

The following pseudo-code illustrates the behavior. While a `Signal` is a data model that always returns values synchronously, what the `debounced` function returns is a `Resource` object. Its `value` property returns a `Signal` that doesn't change during the wait time. During the wait time, the `isLoading` property of the `Resource` will also be `true`.

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

The primary concrete use case will likely be integration with Signal Forms. In cases where an HTTP request is triggered based on a `Signal` bound to a text field, you'll want to debounce the user's input. For example, you can create an HTTP Resource that calls an API with the value after waiting for a 200ms interval from the username field input, like this:

```typescript
const usernameForm = form(signal('foobar'));
const res = httpResource(() => `/api/users/${debounced(usernameForm.value, 200)}`);
```

A similar use case is asynchronous validation in Signal Forms. This has been added as a built-in feature where a `debounce` option is available in the `validateHttp` function, allowing for HTTP-based validation by debouncing form value updates. Internally, the `debounced` function is being called.

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

I think this mostly explains what the `debounced` function is. From here, let's look at its mechanism.

## Mechanism

As in the example where I wrapped Firestore the other day, `Resource` is an interface, and you're free to choose how to construct it. Even if you don't use the built-in `resource` or `httpResource` functions, you can still create objects that follow the `Resource` interface. While the actual `debounced` function has a complex implementation including fine-grained error handling within the framework, let's try to understand the mechanism by creating a simplified version of a `debounced` function ourselves.

First, as a base form, let's create a function that returns a `Resource` that doesn't do anything. From Angular v21.2 onwards, you can use the `resourceFromSnapshots` function to convert a `Signal` of a specific type into a `Resource`.

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

With just this, changes to the `source` won't propagate to the `Resource`. We need to use an `effect` to update the `state` when the `source` changes.

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

Next, we'll introduce a wait time. By accepting an interval as an argument and passing it to `setTimeout`, we can delay reflecting the value in the `state`. While it's delayed, we'll keep the `state` in a `loading` status.

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

Currently, it's just delaying. If an additional change is triggered during the delay, we need to discard the ongoing wait time and wait for the value to stabilize again. To maintain this asynchronous state, let's introduce local variables called `activePromise` and `pendingValue`. In the delayed callback via `setTimeout`, if the `active` matches, it means no additional changes occurred.

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
      // If there is an intervening change, activePromise will mismatch
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

Now our simplified `debounced` function is complete. Although it differs from the actual framework implementation in the finer details, the basic design looks like this. The internals are simple, just managing state with a `Promise` and a timer.

What I'm trying to say is that creating a function that returns a `Resource` type is easy. When you want to integrate processing with asynchronicity into a `Signal`, the hurdle to creating your own is low, even if the built-in APIs don't fit perfectly. One example of that was turning the Firestore Collection into a `Resource` in my previous post.

https://blog.lacolaco.net/posts/angular-firestore-resource-signal

## Summary

- The `debounced()` function expected to be introduced in Angular v22 takes a high-frequency `Signal` as input and returns a `Resource` that finalizes the value once it has settled for a certain period.
- Typical usage is "debouncing input," such as HTTP Resources linked to form inputs or asynchronous validation in Signal Forms.
- The key point of the implementation is monitoring input changes with an `effect`, managing the latest wait using a timer and a `Promise`, and updating the `ResourceSnapshot` to `resolved` when finalized.
- Creating a function that returns a `Resource` type is not difficult. It's a useful interface that can be used to integrate asynchronous data sources with `Signal`.