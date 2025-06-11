---
title: '20 Lines Simple Store with RxJS'
slug: '20-lines-simple-store-with-rxjs'
icon: ''
created_time: '2018-01-05T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'TypeScript'
  - 'RxJS'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/20-Lines-Simple-Store-with-RxJS-ca90e008810941f6a4bb889503419f3b'
features:
  katex: false
  mermaid: false
  tweet: false
---

```ts
import { distinctUntilChanged, map } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

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
import { User } from '../entity/user';
import { Store } from '../../store';

export interface State {
  currentUser: User | null;
}

export class UserStore extends Store<State> {
  constructor() {
    super({
      currentUser: null,
    });
  }

  get currentUser$() {
    return this.select((state) => state.currentUser);
  }
  get currentUser() {
    return this.selectSync((state) => state.currentUser);
  }

  setCurrentUser(user: User) {
    this.dispatch((state) => ({
      ...state,
      currentUser: user,
    }));
  }
}
```
