---
title: "Angular: How to use Action Creator introduced in NgRx v7.4"
date: 2019-04-03T23:34:22Z
tags: ["angular", "ngrx", "typescript"]
---

This article explains the **Action Creator** feature introduced in NgRx v7.4 and the implementation pattern using it.
Action Creator has not yet been included in the [ngrx.io](https://ngrx.io) documentation, but please refer to it after it is added in the future.

## Definition of action

Let's review how to write NgRx so far while implementing a simple counter.
This time, the counter defines `Increment` which receives and adds an arbitrary number, and` Reset` which resets the counter as actions.

In the previous action definition, it was common to define Enum of action type, each action class that has it, and Union Type of that class type.
For example, if you define `counter.actions.ts` with actions `Increment` and `Reset`, it looks like the following.
`Increment` increment the count by a given number, and` Reset` is an action to reset the count back to zero.

```typescript
// counter.actions.ts
import {Action} from '@ngrx/store';

export enum ActionTypes {
  Increment = '[Counter] Increment',
  Reset = '[Counter] Reset',
}

export class Increment implements Action {
  readonly type = ActionTypes.Increment;

  constructor (public payload: number) {}
}

export class Reset implements Action {
  readonly type = ActionTypes.Reset;
}

export type ActionsUnion = Increment | Reset;
```

This file is rewritten by Action Creator as follows:

```typescript
// counter.actions.ts
import {createAction, union} from '@ngrx/store';

export const increment = createAction(
  '[Counter] Increment',
  (payload: number) => ({payload})
);

export const reset = createAction(
  '[Counter] Reset'
);

const actions = union({
  increment,
  reset,
});

export type ActionsUnion = typeof actions;
```

### `createAction` function

First, we will discuss the `createAction` function, which replaces the class definition.
This function returns an **Action Creator**. Action Creator is a function that returns an action object.
In other words, the dispatching action changes from the instance of the new class to the return value of the function.

```typescript
import * as Actions from './actions';

// instance of action class
store.dispatch(new Actions.Increment(1));

// Action Creator
// function returns Action
store.dispatch(Actions.increment(1));
```

An action that takes an argument passes the function to the second argument of the `createAction` function.
This function takes an argument and returns a partial action object.
This is the same as the constructor and class field definitions in the traditional action class.

Let's look at the `increment` action again.
The second argument is a function that accepts a numeric value as the `payload` argument, and the return value is an object with the` payload` property.
The return value of this function is merged with the action object created with the first argument, and finally the action object `{type: '[Counter] Increment', payload}` will be created.

```typescript
// Create an action
const action = Actions.increment(1);

// action object has `type`
console.log(action.type); // => '[Counter] Increment'
// The object returned by the second argument is merged
console.log(action.payload); // => 1
```

By the way, ActionTypes Enum is no longer needed.
You can find out more about this in a later section of Reducer.

### `union` function

The `ActionsUnion` type, which is a composite of a series of action types, is required in several places such as Reducer and Effect.
The conventional action class can handle the union type of the class type as it is, but in the case of a function, it is necessary to combine the return type of the function.
It is NgRx's `union` function to assist it.

Pass all Action Creators to the `union` function and declare its return value ** without exporting **.
The reason why you don't want to export is that you only want that type. There is no use in the place where it was exported and made available externally.
Once you have declared the `actions` variable, use `typeof` to export its type as `Union`.

```typescript
// do not export return value
const actions = union({
  increment,
  reset,
});

// export only type
export type ActionsUnion = typeof actions;
```

## Create Reducer

After defining the Action Creator, let's make the Reducer correspond.
When originally using the action class and Enum, it was the following Reducer.
The type of action passed to the argument is of type `ActionsUnion`, which describes a switch statement that compares` action.type` with the Enum string of `ActionTypes`.

```typescript
import {ActionsUnion, ActionTypes} from './actions';
import {State, initialState} from './state';

export function reducer (state = initialState, action: ActionsUnion): State {
  switch (action.type) {
    case ActionTypes.Increment: {
      return {
        ... state,
        count: state.count + action.payload,
      };
    }
    case ActionTypes.Reset: {
      return {
        ... state,
        count: 0,
      };
    }
    default: {
      return state;
    }
  }
}
```

The following is the result of reflecting the previous change of the action definition in this Reducer.
Only the case statement has changed.
The action type specified in the case statement has been changed to the `type` property possessed by Action Creator.
In this way, because it can be obtained directly from Action Creator, it is not necessary to separate in Enum at the action definition side.

```typescript
import {ActionsUnion, increment, reset} from './actions';
import {State, initialState} from './state';

export function reducer (state = initialState, action: ActionsUnion): State {
  switch (action.type) {
    case increment.type: {
      return {
        ... state,
        count: state.count + action.payload,
      };
    }
    case reset.type: {
      return {
        ... state,
        count: 0,
      };
    }
    default: {
      return state;
    }
  }
}
```

## Create Effects

Use NgRx Effects to define the side effect of outputting a log each time a counter is added and reset.
The traditional action definition is as follows:

```typescript
import {Injectable} from '@angular/core';
import {Effect, Actions, ofType} from '@ngrx/effects';
import {tap} from 'rxjs/operators';

import {ActionsUnion, ActionTypes} from './actions';

@Injectable()
export class CounterEffects {

  constructor (private actions$: Actions<ActionsUnion>) {}

  @Effect({dispatch: false})
  logger$ = this.actions$.pipe(
    ofType(ActionTypes.Increment, ActionTypes.Reset),
    tap(action => {
      console.log(action);
    }),
  )
}
```

As with Reducer, this only affects the part of the action type.

```typescript
import { Injectable } from '@angular/core';
import { Effect, Actions, ofType } from '@ngrx/effects';
import { tap } from 'rxjs/operators';

import { ActionsUnion, increment, reset } from './actions';

@Injectable()
export class CounterEffects {

  constructor(private actions$: Actions<ActionsUnion>) { }

  @Effect({ dispatch: false })
  logger$ = this.actions$.pipe(
    ofType(increment.type, reset.type),
    tap(action => {
      console.log(action);
    }),
  )
}
```

## Dispatching actions

The last part is to dispatch the action.
In conventional action classes, class instances are created and dispatched as follows.

```typescript
import * as CounterActions from './state/counter/actions';

@Component({
  selector: 'my-app',
  template: `
     <div>{{ count$ | async }}</div>
     <button (click)="incrementOne()">+1</button>
     <button (click)="reset()">Reset</button>
  `,
})
export class AppComponent {

  count$ = this.store.pipe(
    select(state => state.counter.count),
  );

  constructor(private store: Store<AppState>) { }

  incrementOne() {
    this.store.dispatch(new CounterActions.Increment(1));
  }

  reset() {
    this.store.dispatch(new CounterActions.Reset());
  }
}
```

This changes to dispatch the return value that called the Action Creator function, as described above.

```typescript
import * as CounterActions from './state/counter/actions';

@Component({
  selector: 'my-app',
  template: `
     <div>{{ count$ | async }}</div>
     <button (click)="incrementOne()">+1</button>
     <button (click)="reset()">Reset</button>
  `,
})
export class AppComponent {

  count$ = this.store.pipe(
    select(state => state.counter.count),
  );

  constructor(private store: Store<AppState>) { }

  incrementOne() {
    this.store.dispatch(CounterActions.increment(1));
  }

  reset() {
    this.store.dispatch(CounterActions.reset());
  }
}
```

This completes all replacements.

## Benefits of Action Creator

The actions defined in the class were the inconvenient of not being able to access `type` until it was instantiated, and the large amount of code that had to be written formally.

In Action Creator, you can write functions as functions, so wasteful code is greatly reduced.
And the features and testability are the same as before, with no particular disadvantages.

Once you have updated your project's NgRx to v7.4, basically you should proceed with replacing it with Action Creator.

## Summary

* The `createAction` function has been introduced to create an Action Creator that defines an action as a function instead of a class
* ActionType Enum is no longer needed
* The impact on the Reducer, Effects, and dispatch side is very minor

Check out how the counter application covered in this article actually works.

https://stackblitz.com/edit/angular-pj4f4p?file=src%2Fapp%2Fapp.component.ts
