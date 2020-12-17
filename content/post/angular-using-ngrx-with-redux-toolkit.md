---
title: 'Angular: Using NgRx Store with Redux Toolkit 🚀'
date: 2020-12-16T21:09:31+09:00
updated_at: 2020-12-16T21:09:31+09:00
tags: [angular, ngrx, state-management, redux, redux-toolkit]
---

This article introduces the idea of combining [**NgRx Store**](https://ngrx.io/guide/store), the de facto standard state management library for Angular applications, with the [**Redux Toolkit**](https://redux-toolkit.js.org/), a library from the Redux team.

I expect that this will eventually become the solid configuration for Angular applications.

## What is the Redux Toolkit (RTK)?

If you are already familiar with the Redux Toolkit, you can find it in the following "NgRx Store with RTK" section.

The Redux Toolkit (**RTK**) is the official library of the Redux development team. It provides best practices that match real-world use cases to make it easier and more effective for anyone to use Redux. A major theme of RTK is the reduction of cumbersome boilerplate code that has frequently occurred in Redux in the past. You can get a good overview of this through the Redux Toolkit Basic Tutorial. It is recommended that you read through it first.

[https://redux-toolkit.js.org/tutorials/basic-tutorial](https://redux-toolkit.js.org/tutorials/basic-tutorial)

The ability to create Actions, Action Creators, Reducers, etc. with creating functions is also effective in reducing the existing boilerplate, but the most important thing is the last `createSlice` function.
Just by looking at the code sample, you can see that the API is quite different from the impression of Redux so far, and the amount of code can be reduced considerably.

[https://redux-toolkit.js.org/tutorials/basic-tutorial#introducing-createslice](https://redux-toolkit.js.org/tutorials/basic-tutorial#introducing-createslice)

```ts
const counterSlice = createSlice({
  name: 'counter',
  initialState: 0,
  reducers: {
    increment: (state) => state + 1,
    decrement: (state) => state - 1,
  },
});

const store = configureStore({
  reducer: counterSlice.reducer,
});

document.getElementById('increment').addEventListener('click', () => {
  store.dispatch(counterSlice.actions.increment());
});
```

In the future, Redux will basically be based on this Slice. Most of the existing Redux logic should be able to be solved by `createSlice()`, unless you are using it in a very complex way.

> This API is the standard approach for writing Redux logic.
> (https://redux-toolkit.js.org/api/createSlice)

The concept of Slice is a new one created by the Redux Toolkit, but its essence is not entirely new. Here is a detailed explanation of Slice.

### The concept of Slice

"Slice" is an object that encapsulates the Reducer and Action Creators created under the namespace.

> createSlice returns a "slice" object that contains the generated reducer function as a field named reducer, and the generated action creators inside an object called actions.
> (https://redux-toolkit.js.org/tutorials/basic-tutorial)

```ts
// Creating a slice
const counterSlice = createSlice({
  name: 'counter',
  initialState: 0,
  reducers: {
    increment: (state) => state + 1,
  },
});
// Auto-generated reducer and action creators
const { reducer, actions } = counterSlice;
actions.increment(); // => Action { type: 'counter/increment' }
```

If you are familiar with the Redux ["ducks" pattern](https://github.com/erikras/ducks-modular-redux), you will feel a sense of déjà vu when you see Slice, which is the exact representation of the ducks pattern as a type of object. The ducks pattern can be easily implemented by simply exporting each property individually from the return value of `createSlice()`.

> Thanks to createSlice, we already have our action creators and the reducer right here in one file. All we have to do is export them separately, and our todos slice file now matches the common "ducks" pattern.
> (https://redux-toolkit.js.org/tutorials/intermediate-tutorial)

```ts
// ducks pattern exports
export const { increment } = counterSlice.actions;
export default counterSlice.reducer;
```

The reason why it is called "Slice" will become clearer when we apply multiple Slices to a single Store. To combine multiple Slices, we will continue to use the `combineReducers` function. The Slice is the combination of `[name]: namedReducer` in this combine step. Each slice is a thin layer of the whole reducer.

![](/img/angular-using-ngrx-with-redux-toolkit/slices.png)

There have been various approaches to dividing the Reducer in this way, and the ducks pattern has been popular. It creates modules that are scoped by namespaces while ensuring atomic state updates through centralized state management infrastructure. The reason why RTK and `createSlice()` should be used is that it is easy and anyone can implement the scalable Redux best practices in the same way.

## NgRx Store with RTK

Redux is a framework-agnostic library. But why NgRx Store is widely used for Angular app state management instead of plain Redux?

- Because it's easy to set up in Angular's DI.
- Because they want to manage state changes with RxJS (Observable)
- Because they want to use TypeScript's type checking
- Because it requires less boilerplate code than plain Redux

RTK can also solve the needs of TypeScript-friendliness and simplicity of description, and it also has the sense of security of being a Redux official.
So, by using NgRx Store with RTK, we can write state management logic that blends naturally into Angular applications while benefiting from the Redux ecosystem. This is the starting point of my idea, and I am confident that it will work.

### `StoreModule.forFeature()` and Slice

In NgRx Store, you can create a "Feature State" by using `StoreModule.forFeature()` for lazy loading or simply for separation of concerns. For applications of a large size, it is common to modularize them into Feature States instead of managing everything in the Root State.

```ts
import counterReducer, { name as counterFeatureKey } from './state/counter';

@NgModule({
  imports: [StoreModule.forFeature(counterFeatureKey, counterReducer)],
})
export class CounterModule {}
```

To create a Feature State, you need a string that is the key to distinguish the Feature and a Reducer function corresponding to the Feature State. And as mentioned earlier, RTK's Slice has the same information.
In other words, Feature State and Slice are both APIs aimed at modularizing state management, and their essence is almost the same.

By the way, NgRx Store is a state management library for Angular, based on RxJS, but its core is strongly inspired by Redux.

> Store is RxJS powered global state management for Angular applications, inspired by Redux. 
> (https://ngrx.io/guide/store)

This is not only the idea but also the interface of Action and Reducer, the principle part of Redux, is the same. So the objects generated by RTK can be directly applied to NgRx Store.
In other words, the **key** and **Reducer** required for the Feature State can be generated by Slice.

I will explain the implementation with a simple example. It is a small application, but it has everything you need to integrate NgRx Store with RTK.

<iframe src="https://codesandbox.io/embed/staging-dust-pg930?fontsize=14&hidenavigation=1&module=%2Fsrc%2Fapp%2Fcounter%2Fcounter-slice.ts&theme=dark&view=editor"
style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
title="staging-dust-pg930"
allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts">
</iframe>

### 0. Setup NgRx Store

First, we need to prepare `StoreModule.forRoot()` to make `Store` available to components and services. If it is fully modularized, there will be no reducer to pass to `forRoot()`.

```ts
@NgModule({
  imports: [BrowserModule, StoreModule.forRoot({})],
  // ...
})
export class AppModule {}
```

### 1. Create a counter slice

The first thing to do is to create a Slice. Create `counter/counter-slice.ts` and use the `createSlice()` function to create a Slice object.
That's almost all the code for state management.

```ts
import { createSlice } from '@reduxjs/toolkit';

const counterSlice = createSlice({
  name: 'counter',
  initialState: {
    count: 0,
  },
  reducers: {
    increment: (state) => {
      state.count++;
    },
  },
});
```

### 2. Make a "ducks" module

Based on the Slice created in step 1, we will modularize the Slice according to the ducks pattern: default export for Reducer, named export for Action Creator and other objects.
Using object destructuring, we can write like the following:

```ts
const {
  reducer,
  actions: { increment },
  name,
} = counterSlice;

export default counterSlice.reducer;
export { increment, name };
```

This is a preference, so if you don't find the ducks pattern valuable, you can export the Slice object as is.

### 3.Setup `StoreModule.forFeature()`

We will use the object exported from `counter-slice.ts` to set the Feature State of NgRx. Just call `StoreModule.forFeature()` in `counter.module.ts` and pass the `name` and `reducer` of the Slice as follows:

```ts
import counterReducer, { name as counterFeatureKey } from './counter-slice';

@NgModule({
  imports: [StoreModule.forFeature(counterFeatureKey, counterReducer)],
  // ...
})
export class CounterModule {}
```

### 4. Creating a Feature selector

In the NgRx Store, it is common to use a Feature Selector to retrieve the Feature State from the `Store`. This time, `counter-slice.ts` itself will create and export a Feature Selector.
The type of the Feature State managed by `counterSlice` can be retrieved using `ReturnType<typeof reducer>`, thanks to RTK's strong type inference support.

```ts
export const selectFeature = createFeatureSelector<ReturnType<typeof reducer>>(
  name
);
```

### 5. Access to Feature State

Finally, refer to the Feature State from the component, dispatch an Action to update it, and you are done. The code in this area is not affected by the RTK.

```ts
import { createSelector, Store } from '@ngrx/store';
import * as counterSlice from './counter-slice';

@Component({
  selector: 'app-counter',
  template: `<button (click)="increment()">INCREMENT</button>:
    {{ counter$ | async }}`,
})
export class CounterComponent {
  constructor(private readonly store: Store<{}>) {}

  // Get state
  counter$ = this.store.select(
    createSelector(counterSlice.selectFeature, (state) => state.count)
  );

  increment() {
    // Update state
    this.store.dispatch(counterSlice.increment());
  }
}
```

## Advantages and disadvantages

This is a brief summary of the advantages and disadvantages of using NgRx Store with RTK.

### Advantage: minimized boilerplate

Compared to the bare Redux, utilities provided by NgRx such as `createReducer` and `createAction` simplify the description, while `createSlice()` reduces waste to the absolute minimum. It not only reduces the amount of code but also hides the combination of multiple APIs in just one `createSlice()`, which is very good in terms of ease of remembering how to use it.

```ts
// NgRx
import { createAction, createReducer } from '@ngrx/store';

export const increment = createAction('[Counter Component] Increment');
export const initialState = 0;

const _counterReducer = createReducer(
  initialState,
  on(increment, (state) => state + 1)
);

export function counterReducer(state, action) {
  return _counterReducer(state, action);
}
```

```ts
// Redux Toolkit
import { createSlice } from '@reduxjs/toolkit';

const counterSlice = createSlice({
  name: 'counter',
  initialState: 0,
  reducers: {
    increment: (state) => state + 1,
  },
});
```

### Advantage: Redux Ecosystem

RTK will become a central part of the Redux ecosystem in the near future, and new projects derived from RTK are emerging. For example, the recently released [RTK Query](https://rtk-query-docs.netlify.app/) is an experimental library that automates the common Redux use case of fetching data and caching the response. RTK-based state management makes it easier to keep up with the evolution of the Redux ecosystem.

### Disadvantage: Increased bundle size

The RTK comes with some middleware by default, so the bundle size should be larger than the plain NgRx Store. Tree-shaking will mitigate this, but the increment will not be zero.

## Conclusion

I had the opportunity to introduce my idea on the interoperability between NgRx Store and RTK.

I put up an issue on the NgRx GitHub repository suggesting how to improve interoperability with RTK, and the NgRx maintainer was very positive, and also  Mark Erikson, the Redux maintainer, showed up and welcomed it.

[https://github.com/ngrx/platform/issues/2809](https://github.com/ngrx/platform/issues/2809)

{{< tweet 1336804656777932803 >}}

Since the RTK, the Redux ecosystem seems to be gaining momentum in spreading best practices that match real-world use cases. And I found out that there is an option to delegate the core of state management to the Redux official. I think the role of NgRx in combination with RTK will be to connect Redux with Angular's DI system and reactive programming with RxJS as a bridge. And I believe that this division of responsibilities will become more important in the future.

The implementation example presented here is just one idea at the moment, and if we can find a better interoperable implementation pattern, we would love to see NgRx Store + RTK made by others. I'm looking forward to your feedback.

See you.
