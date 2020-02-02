+++
date = "2016-04-24T13:13:35+09:00"
title = "Broadcasting events in Angular 2"

+++

Angular 1 has an utility for broadcasting an event, `$broadcast` and `$on`. 
Now, Angular 2 dropped these features. Instead it has `@Output` annotation and `(event)` syntax.
However, we can create a similar utility by using DI; `Broadcaster`.

<!--more--> 

## Define `Broadcaster`
First, we have to define `Broadcaster`.

```ts
import {Subject} from 'rxjs/Subject';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';

interface BroadcastEvent {
  key: any;
  data?: any;
}

export class Broadcaster {
  private _eventBus: Subject<BroadcastEvent>;

  constructor() {
    this._eventBus = new Subject<BroadcastEvent>();
  }

  broadcast(key: any, data?: any) {
    this._eventBus.next({key, data});
  }

  on<T>(key: any): Observable<T> {
    return this._eventBus.asObservable()
      .filter(event => event.key === key)
      .map(event => <T>event.data);
  }
}
``` 

`Broadcaster` has two methods; `broadcast` and `on`.
`broadcast` will be used to fire an event with event-specific key.
In other hand, `on` returns an observable of events which broadcasted the key. 

Angular 1's `$broadcast` is used with **string** key.

```js
$broadcast('MyEvent', data)
``` 

Of course, we can implement string-based propagation that uses string keys.

```ts
// app.ts (application root component)
@Component({
    selector: 'app',
    ...
    providers: [
        // application-shared broadcaster (similar to $rootScope)
        Broadcaster
    ]
})
class App {}
```

```ts
// child.ts
@Component({
    selector: 'child'
})
export class ChildComponent {
  constructor(private broadcaster: Broadcaster) {
  }
  
  registerStringBroadcast() {
    this.broadcaster.on<string>('MyEvent')
      .subscribe(message => {
        ...
      });
  }

  emitStringBroadcast() {
    this.broadcaster.broadcast('MyEvent', 'some message');
  }
}
``` 

Great, we regained `$rootScope.$broadcast`! 
But there are some problems; loosing **typo-safety** and **type-safety**. 

### _typo-safety_
If we mistake the event name, event propagation will be broken, but we cannot get any  **static errors**.

### _type-safety_
We cannot know a type of the event data.
Any types will be accepted to the event with same name.

```js
$broadcast('MyEvent', '100');
$broadcast('MyEvent', 100);
```

## Type-based event propagation
So, we should make a safety broadcaster, which uses **types** to specify an event type.

Let's make **domain-specific** broadcaster, `MessageEvent`!

```ts
import {Injectable} from 'angular2/core';
import {Observable} from 'rxjs/Observable';
import {Broadcaster} from './broadcast';

@Injectable()
export class MessageEvent {
  constructor(private broadcaster: Broadcaster) {}

  fire(data: string): void {
    this.broadcaster.broadcast(MessageEvent, data);
  }

  on(): Observable<string> {
    return this.broadcaster.on<string>(MessageEvent);
  }
}
```

Then, we can use it with perfect type-safety! Look at new `child.ts`.

```ts
import {Component} from 'angular2/core';
import {MessageEvent} from '../../services/message_event';

@Component({
  selector: 'child',
  ...
  providers: [ 
    MessageEvent
  ],
})
export class Child {
  constructor(private messageEvent: MessageEvent) {
  }
  
  registerTypeBroadcast() {
    this.messageEvent.on()
      .subscribe(message => {
        ...
      });
  }
  
  emitTypeBroadcast() {
    this.messageEvent.fire(`Message from ${this.boxID}`);
  }
}
```

Demo is [here](http://plnkr.co/edit/aJe5SUtFlnpmGXWA5eHk).

## Conclusion
In this article, I explained a way to implement an event propagation like Angular 1's `$broadcast`.
And I introduced old string-based event system and type-based safe event system.
