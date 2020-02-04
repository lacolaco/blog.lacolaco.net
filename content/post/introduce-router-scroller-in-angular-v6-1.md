---
title: Introduce Router Scroller in Angular v6.1
date: "2018-06-09T02:34:29.892Z"
tags: [Angular, Router]
---

With Angular’s next minor update, a new feature will be out.  
Its name is **Router Scroller**.  
For long-time people using Angular it is a long-awaited feature that is so glad that tears come out.  
In this article, for the strange one, “I can not wait next week beta.1! I want to try it now!”, I will also show you how to try it with the latest build.

### Router Scroller

The Router Scroller provides functions related to scrolling to the Angular Router.  
With Router Scroller, you can do the following things.

- Restore to scroll position before transition when browser back
- Fragmented URL like `#foo` and automatically scroll to elements with corresponding ID

If both of them are static HTML pages, the browser will do it automatically. And today, the same behavior can be easily introduced even by SPA by Angular Router.  
I will introduce about each.

#### Scroll Position Restoration

Router Scroller The first function is to store and restore the scroll position.  
Every time Router navigates, it stores the scroll position at that point.  
And when the screen returns to the previous screen by the return operation of the browser, it automatically restores to the stored scroll position.

Since the timing is controlled by the Router in this restoration process, the scroll moves after the routing process of the previous screen is finished.

#### Anchor Scrolling

Another function is to scroll to an element with a corresponding ID if there is a fragment like `#foo` in the URL.  
This is also a function commonly used in static HTML pages, but in Angular it did not work because the browser searches for the element earlier than component generation by Router.  
This time Router has the Anchor Scrolling function, so even with Angular application it is possible to scroll by `#foo`.  
In addition to navigation by Router, it scrolls in the same way even if you reload.

### How to use

Both Scroll Position Restoration and Anchor Scrolling are disabled by default at v6.1.0.  
So, you need to set `RouterModule` to enable it.

`ScrollPositionRestoration` and `anchorScrolling` have been added to the option of the second argument of `RouterModule.forRoot` method.  
If set to `’enabled’` respectively, the function is enabled.

That’s all there is to it.

```ts
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: "enabled",
      anchorScrolling: "enabled"
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
```

#### Scroll Offset

You can also specify an offset for the Router Scroller.  
If you want to shift the scroll position, such as when the header is fixed or sticky, set `scrollOffset` with the option of the second argument of`RouterModule.forRoot` method.  
In the previous example of Anchor Scrolling, since the upper header is sticky, the y coordinate is shifted down by 64 px.

```ts
@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: "enabled",
      anchorScrolling: "enabled",
      scrollOffset: [0, 64] // [x, y]
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
```

### To try it now

The Router Scroller will be included in the release from v6.1.0-beta.1.  
For those who want to try before that, you need to replace packages with a development build. You can specify the version as follows.

"[@angular/common](http://twitter.com/angular/common "Twitter profile for @angular/common")": "angular/common-builds",  
 "[@angular/compiler](http://twitter.com/angular/compiler "Twitter profile for @angular/compiler")": "^6.0.0",  
 "[@angular/core](http://twitter.com/angular/core "Twitter profile for @angular/core")": "^6.0.0",  
 "[@angular/platform-browser](http://twitter.com/angular/platform-browser "Twitter profile for @angular/platform-browser")": "angular/platform-browser-builds",  
 "[@angular/platform-browser-dynamic](http://twitter.com/angular/platform-browser-dynamic "Twitter profile for @angular/platform-browser-dynamic")": "angular/platform-browser-dynamic-builds",  
 "[@angular/router](http://twitter.com/angular/router "Twitter profile for @angular/router")": "angular/router-builds",

### Learn more

For those who want to know more, it would be better to read the commit content of the function.

https://github.com/angular/angular/commit/49c5234c6817ceae02b8bacb30adae99c45a49a9

The sample code of this article is published on GitHub.

https://github.com/lacolaco/ng-router-scrolling-example

Thanks.
