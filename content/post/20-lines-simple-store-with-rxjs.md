---
title: "20 Lines Simple Store with RxJS"
date: 2018-01-05T12:34:43Z
tags: ["TypeScript", "RxJS"]
---

```ts
import { distinctUntilChanged, map } from "rxjs/operators";
import { BehaviorSubject } from "rxjs/BehaviorSubject";

export abstract class Store<T> extends BehaviorSubject<T> {
  constructor(initialState: T) {
    super(initialState);
  }

  public dispatch(fn: (state: T) => T) {
    this.next(fn(this.getValue()));
  }

  public select<R>(fn: (state: T) => R) {
    return this.pipe(map<T, R>(fn), distinctUntilChanged());
  }

  public selectSync<R>(fn: (state: T) => R) {
    return fn(this.getValue());
  }
}
```

Example: UserStore

```ts
import { User } from "../entity/user";
import { Store } from "../../store";

export interface State {
  currentUser: User | null;
}

export class UserStore extends Store<State> {
  constructor() {
    super({
      currentUser: null
    });
  }

  get currentUser$() {
    return this.select(state => state.currentUser);
  }
  get currentUser() {
    return this.selectSync(state => state.currentUser);
  }

  setCurrentUser(user: User) {
    this.dispatch(state => ({
      ...state,
      currentUser: user
    }));
  }
}
```
