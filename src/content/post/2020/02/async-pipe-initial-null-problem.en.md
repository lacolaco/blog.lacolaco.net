---
title: 'Initial Null Problem of AsyncPipe and async data-binding'
slug: 'async-pipe-initial-null-problem.en'
icon: ''
created_time: '2020-02-19T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'RxJS'
published: true
locale: 'en'
notion_url: 'https://www.notion.so/Initial-Null-Problem-of-AsyncPipe-and-async-data-binding-618c54c986894e02a3ef4db0ac7ab530'
features:
  katex: false
  mermaid: false
  tweet: false
---

This post is English version of [AsyncPipeの初期値null問題と非同期データバインディング](https://blog.lacolaco.net/2020/02/async-pipe-initial-null-problem/).

Angular’s [AsyncPipe](https://angular.io/api/common/AsyncPipe) is a useful feature for template binding of asynchronous data, but it has a big problem since the beginning. That is the “Initial Null Problem”. This article describes the Initial Null Problem of AsyncPipe and its root cause, and discusses new asynchronous data-binding to solve that.

## How AsyncPipe works

AsyncPipe is now always used to create general Angular applications. It is often used to subscribe to Observable data and bind its snapshot to a template. The basic usage is as follows.

```
@Component({
  selector: "app-root",
  template: `
    <div *ngIf="source$ | async as state">
      {{ state.count }}
    </div>
  `,
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  source$ = interval(1000).pipe(map(i => ({ count: i })));
}
```

So, how does AsyncPipe bind the value that `source$` streams to a template and render it? Take a look at [Implementation of AsyncPipe](https://github.com/angular/angular/blob/9.0.1/packages/common/src/pipes/async_pipe.ts#L71).

AsyncPipe has a lot of asynchronous data abstraction code that can handle both Promise and Observable, but the essential code is the following code. Like any other Pipe, it implements the `transform()` method.

```
  transform(obj: Observable<any>|Promise<any>|null|undefined): any {
    if (!this._obj) {
      if (obj) {
        this._subscribe(obj);
      }
      this._latestReturnedValue = this._latestValue;
      return this._latestValue;
    }

    if (obj !== this._obj) {
      this._dispose();
      return this.transform(obj as any);
    }

    if (ɵlooseIdentical(this._latestValue, this._latestReturnedValue)) {
      return this._latestReturnedValue;
    }

    this._latestReturnedValue = this._latestValue;
    return WrappedValue.wrap(this._latestValue);
  }
```

Let’s look at the code from the top. The first `if (!this._obj)` is the condition when Observable is passed to AsyncPipe for the first time, that is, the initialization process. If `this._obj` doesn’t exist and `obj` does, the pipe subscribes `obj`. `obj` corresponds to `source$` in the example. The Observable passed to AsyncPipe is executed `subscribe()` here.

The next if statement is for when an Observable has changed from the one you are subscribing. It disposes the current subscription and starts resubscribing.

And the rest of the code is for returning the latest value `this._latestValue` from the subscribed Observable. The returned value will be the value actually used to render the template.

What you can see here is that **AsyncPipe returns the cached \*\***`this._latestValue`\***\* when the\*\***`transform()`\***\*method is called**. This can also be seen in AsyncPipe’s `_subscribe()` and `this._updateLatestValue()` methods. When the value flows into the asynchronous data subscribed by the `_subscribe()` method, `markForCheck()` of `ChangeDetectorRef` is called in the callback. It causes the next `transform()` call.

```
  private _subscribe(obj: Observable<any>|Promise<any>|EventEmitter<any>): void {
    this._obj = obj;
    this._strategy = this._selectStrategy(obj);
    this._subscription = this._strategy.createSubscription(
        obj, (value: Object) => this._updateLatestValue(obj, value));
  }
  ...
  private _updateLatestValue(async: any, value: Object): void {
    if (async === this._obj) {
      this._latestValue = value;
      this._ref.markForCheck();
    }
  }
```

In other words, AsyncPipe renders templates using the following mechanism.

1. Pipe’s `transform()` is called in Change Detection
2. Start subscribing to the passed Observable
3. Return `this._latestValue` at the time `transform()`is called
4. When Observable flows new data, update `this._latestValue` and trigger Change Detection (back to 1)

`transform()` must return a synchronous value, because the template can only render synchronous values. It can only return a cached snapshot at the time `transform()` is called.

A solid understanding of this should raise a question. That is, “at the start of the subscription, can’t the `transform()` return a value?” And that is the biggest problem that AsyncPipe has, the “Initial Null Problem”.

## Initial Null Problem

Since `this._latestValue` is set by Observable’s subscription callback, the value has never been set at the time of `transform()` call. However, `transform()` must return some value, so it returns a default value. Let’s look again at the beginning of AsyncPipe’s `transform()`.

```
    if (!this._obj) {
      if (obj) {
        this._subscribe(obj);
      }
      this._latestReturnedValue = this._latestValue;
      return this._latestValue;
    }
```

`this._latestValue` used in the last two lines has never been set, so the initial value of this field will be used. Its value is `null`.

```
export class AsyncPipe implements OnDestroy, PipeTransform {
  private _latestValue: any = null;
  private _latestReturnedValue: any = null;
```

In other words, AsyncPipe always returns `null` once before flowing the first value. Even if the original Observable is `Observable<State>`, it becomes `State | null` through AsyncPipe. This is a problem I call " Initial Null Problem".

While this problem seems serious, it has been automatically avoided in many cases. This is because `*ngIf` and `*ngFor`, which are often used with AsyncPipe, ignore the `null` returned from AsyncPipe.

In the following template, the value returned by `source$ | async` is evaluated by the NgIf directive, and if it is Truthy, it will be rendered, so if it is `null`, it will not go inside `*ngIf`.

```html
<div *ngIf="source$ | async as state">{{ state.count }}</div>
```

Similarly, in the following template, the value returned by `source$ | async` is evaluated by the NgFor directive and ignored if it is Falsey, so if it is `null`, it will not be inside `*ngFor`.

```html
<div *ngFor="let item of source$ | async">{{ item }}</div>
```

Through null-safe directives such as `*ngIf` and `*ngFor`, the Initial Null Problem does not affect the application. The problem is otherwise, that is, passing values directly to the child component’s Input via AsyncPipe. In the following cases, the child component should define a `prop` Input type, but you have to consider the possibility of passing `null` to it. If `prop` is a getter or setter, you can easily imagine a runtime error when trying to access the value.

```html
<child [prop]="source$ | async"></child>
```

So far, one simple best practice can be said. **AsyncPipe should always be used through a null-safe guard like NgIf or NgFor**.

## Replace AsyncPipe

From here, I will explore the new asynchronous data-binding that can replace AsyncPipe which has the above-mentioned problem.

Why AsyncPipe returns `null` is Pipe needs to return a synchronous value. The only way to solve the Initial Null Problem is to stop using Pipe for async data.

So I tried using a directive. I think an approach that accepts an input and a template and renders the template under the control of the directive, is the best replacement for AsyncPipe.

So I implemented the `*rxSubscribe` directive. The sample that actually works is [here](https://stackblitz.com/edit/github-zg4qep). It subscribe an Observable with a structural directive as follows:

```html
<div *rxSubscribe="source$; let state">{{ state.count }}</div>
```

The directive is implemented as follows. What this directive does is

1. Subscribe an Observable received by `rxSubscribe` Input.
2. When the Observable value flows, embed (render) the template for the first time
3. When the value after the second time flows, update the context and call `markForCheck()`

https://github.com/lacolaco/ngivy-rx-subscribe-directive/blob/master/src/app/rx-subscribe.directive.ts

```
@Directive({
  selector: "[rxSubscribe]"
})
export class RxSubscribeDirective<T> implements OnInit, OnDestroy {
  constructor(
    private vcRef: ViewContainerRef,
    private templateRef: TemplateRef<RxSubscribeFromContext<T>>
  ) {}
  @Input("rxSubscribe")
  source$: Observable<T>;

  ngOnInit() {
    let viewRef: EmbeddedViewRef<RxSubscribeFromContext<T>>;
    this.source$.pipe(takeUntil(this.onDestroy$)).subscribe(source => {
      if (!viewRef) {
        viewRef = this.vcRef.createEmbeddedView(this.templateRef, {
          $implicit: source
        });
      } else {
        viewRef.context.$implicit = source;
        viewRef.markForCheck();
      }
    });
  }
}
```

With this approach, the template is not rendered until the value first flows, and re-rendering can be triggered only when the value flows. It solves the Initial Null Problem, and is also CPU-friendly because re-rendering is limited only when necessary.

By the way, the type of `state` in `let state`is inferred from the type of `source$` exactly if Ivy and `strictTemplates` flag are enabled. When you make a mistake use of `state`, AOT compiler throws an error.

```html
<div *rxSubscribe="source$; let state">
  {{ state.foo }}
  <!-- compile error: state doesn't have `foo` -->
</div>
```

AsyncPipe could always only infer `or null` due to the Initial Null Problem, but the structure directive approach can infer the context type exactly from `Observable<T>`.

I’ve published this `*rxSubscribe` directive as the npm package **`@soundng/rx-subscribe`**.

- GitHub [https://github.com/soundng/rx-subscribe](https://github.com/soundng/rx-subscribe)
- NPM [https://www.npmjs.com/package/@soundng/rx-subscribe](https://www.npmjs.com/package/@soundng/rx-subscribe)
- Demo [https://stackblitz.com/edit/github-zg4qep-kq9pyw?file=src/app/app.component.html](https://stackblitz.com/edit/github-zg4qep-kq9pyw?file=src%2Fapp%2Fapp.component.html)

## Conclusion

- AsyncPipe has Initial Null Problem
- Guarding with NgIf or NgFor can avoid the initial null
- Pipe has limitations in handling asynchronous data
- Structural directive approach can solve AsyncPipe problem
- Feedback welcome to `@soundng/rx-subscribe`
