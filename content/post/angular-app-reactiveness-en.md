---
title: "Angular: Test Reactiveness with OnPush strategy"
date: 2020-03-18T17:59:50+09:00
updated_at: 2020-05-05T16:19:13+09:00
tags: ["english","angular","reactive","on-push","zone.js","change-detection","zoneless"]
foreign: true
---

`OnPush` change detection strategy can test "reactiveness" of an Angular application. Using OnPush is not neccessary to remove Zone.js, but reactiveness is still important in the _zone-less_ world. 
Removing Zone.js brings both control and responsibility about application rendering to a developer.  It is not recommendable for everyone. So before doing that, understand how much Angular and Zone.js have been helping us enough.

## Things Zone.js does

Simply, what Zone.js (Zone) does is just *firing events to Angular in order to run change detection*. It means Zone itself does **not** detect changes. Change detection is Angular's job. Zone just tells Angular when it should run change detection.

Technically, Zone patches some of Browser APIs like `setTimeout`, `Promise` and `XHR` to hook into *async tasks* and fire its events. Angular listens the events and run change detection on after each async task. As the result, Angular application can re-render component templates after `setTimeout`. 

Learn more: https://angular.io/guide/zone

So, after removing Zone, Angular cannot know when it should run change detection. Angular won't re-render any components unless explicit triggering. Who have to does it? Of course, a developer.

## Triggering Change Detection manually

Without Zone, there is a bit difference in how to use `ChangeDetectorRef`.  

- `markForCheck()` does **NOT** trigger change detection.
- `detectChanges()` triggers change detection immediately.

Because `markForCheck()` can just mark the component *for the next change detection*, re-rendering never happens unless someone triggers it. But `detectChanges()` is exactly an API for trigger change detection. So without Zone, developers can call `detectChanges()` when they want to re-rendering. All done! yay!

## :tired_face: "Too many detectChanges()!!"

But sadly, regular Angular applications are not ready for Zone-less. You may have to write too many `detectChanges()` in a lot components or other places. 

It is because the application's *reactiveness*  is not high. Reactiveness means how much the Angular application can react the state changes. As you know, using observables and AsyncPipe is a common pattern which can make the app reactive.

Here is a great talk about reactive Angular by Mike Ryan.

{{< youtube rz-rcaGXhGk >}}

To build reactive Angular app, immutability and passiveness of components are strongly important.
And before removing Zone, artificially we can *test* these with **OnPush change detection strategy**.

## OnPush strategy

OnPush is one of the change detection behavior. That brings some restriction to an application. Every components won't be checked in change detection flow unless it has been **pushed**. What the **push**? Great articles are here;

- [Angular OnPush Change Detection \- Avoid Common Pitfalls](https://blog.angular-university.io/onpush-change-detection-how-it-works/)
- [🚀 A Comprehensive Guide to Angular onPush Change Detection Strategy](https://netbasal.com/a-comprehensive-guide-to-angular-onpush-change-detection-strategy-5bac493074a4)

Shortly, the following things can **push** a component.

1. Input changes: passing new value to the `@Input()` property **within the template**. 
2. DOM events: dispatching a native DOM events in its template. 
3. Marking: calling `ChangeDetectorRef.markForCheck()` from a directive/component.

## From OnPush-full to Zone-less

If an application works well even all components has been configured as OnPush, it has a great reactiveness. There are some steps to removing Zone from there.

For example, this component can be used with OnPush because it uses `state$` and AsyncPipe and its template is completely depending on the stream. AsyncPipe calls `markForCheck` when the observable emits new value. So after calling `count()`, this component will be re-rendered.

```ts
@Component({
  template: `
    <ng-container *ngIf="state$ | async as state">
    <button (click)="count()">Counter {{ state.counter }}</button>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CounterComponent {
  private readonly stateSubject = new BehaviorSubject({
    counter: 1,
  });
  readonly state$ = this.stateSubject.asObservable();

  count() {
    const prev = this.stateSubject.value;
    this.stateSubject.next({ ...prev, counter: prev.counter + 1 });
  }
}
```

Because that re-rendering is triggered by `markForCheck`, still it needs Zone. Setting `NoopZone` in `main.ts`, the counter won't work on click.

```ts
platformBrowser().bootstrapModule(AppModule, { ngZone: 'noop'});
```
To fixing this, call `detectChanges()` on state changes. Adding a line to `click()` method is easy but it is not *reactive* way. Let's make `state$` can trigger change detection. `tap()` operator is added to `state$` observable to call `detectChanges()` after each change. `setTimeout()` is needed to defer it till AsyncPipe handles the change.

```ts
export class AppComponent {
  constructor(private cdRef: ChangeDetectorRef) { }

  private readonly stateSubject = new BehaviorSubject({
    counter: 1,
  });
  readonly state$ = this.stateSubject.asObservable().pipe(
    // Reactive way
    // Trigger change detection after each change
    tap(() => setTimeout(() => this.cdRef.detectChanges()))
  );

  count() {
    const prev = this.stateSubject.value;
    this.stateSubject.next({ ...prev, counter: prev.counter + 1 });
    // Imperative way
    // this.cdRef.detectChanges()
  }
}
```

If you are familier to Ivy's experimental secret APIs, use `ɵmarkDirty` instead.

```ts
  readonly state$ = this.stateSubject.asObservable().pipe(
    tap(() => ɵmarkDirty(this))
  );
```

It works well! But... wait! Why we have to trigger change detection manually is AsyncPipe doesn't do that. If AsyncPipe can do that, we are free from `detectChanges()`. Let's replace AsyncPipe by another solution.

### Pipe and `detectChanges()`

This is the simplest alternative. Making a pipe similar to AsyncPipe but call `detectChanges()` insteat of `markForCheck()`.

NgRx team are proposing a RFC about `ngrx/components` package and it says about that.

[RFC: Component: Proposal for a new package \`component\` · Issue \#2052 · ngrx/platform](https://github.com/ngrx/platform/issues/2052)

> ## Push Pipe
>
> An angular pipe similar to the async pipe but triggers detectChanges instead of markForCheck.
This is required to run zone-less. We render on every pushed message.

There is not the implementation yet but it is not difficult to built the pipe by yourself. 

```ts
// Simple Implementation
@Pipe({
  name: 'push',
  pure: false
})
export class PushPipe<T> implements PipeTransform {
  constructor(private cdRef: ChangeDetectorRef) { }

  observable: Observable<T> | null = null;
  subscription: Subscription;
  lastValue: T | null = null;

  transform(observable: Observable<T>): T {
    if (this.observable !== observable) {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      this.subscription = observable.subscribe(value => {
        this.lastValue = value;
        setTimeout(() => this.cdRef.detectChanges());
      });
    }
    return this.lastValue;
  }
}
```

By the way, Pipes have a problem for handling asynchronous data. Read previous post ["Initial Null Problem of AsyncPipe and async data\-binding"](https://blog.lacolaco.net/2020/02/async-pipe-initial-null-problem-en/) for the detail.

## Conclusion

- Zone is telling Angular when it should run change detection. 
- Without Zone, a developer have to do that instead of Zone.
- Both OnPush and Zone-less require reactiveness of an application.
- OnPush-full application can go forward for Zone-less with less effort.

Example app for this arcticle is avaiable on ng-run:
https://ng-run.com/edit/OCM8QyXr4CrgPQv5TZMT?open=app%2Fapp.component.ts

Thanks!