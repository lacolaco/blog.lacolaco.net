---
title: Forget $compile in Angular 2
date: "2016-10-02T14:42:39.927Z"
tags: [angular]
---

### TL;DR

- Forget about `$compile`
- Use `innerHTML` and DOM APIs

### `$compile` in Angular 2

I wrote an [article](http://blog.lacolaco.net/post/dynamic-component-creation-in-angular-2/) that explain “how to load a HTML template with using dynamic component creation.”

> Since Angular 2, `$compile` was dropped. There are no ways to insert HTML fragments into the component view except using innerHTML. But if we could create a component and load it…? Yes, we can do it! This post will explain about **dynamic HTML projection** in Angular 2 with dynamic component creation.

### How did I ?

Before `@NgModule` introduced, I used `ViewContainerRef` and `RuntimeCompiler` with a **dynamic component factory.**

Dynamic component factory is a just function that calls `Component()` decorator function to **create decorated class object** dynamically.

```ts
  private createDynamicComponent(selector, template) {
    const metadata = new ComponentMetadata({
      selector,
      template,
    });

    const cmpClass = class _ { };
    return Component(metadata)(cmpClass);
  }
```

And then, I passed the class to `RuntimeCompiler` and get `ComponentFactory`.

```ts
this.compiler
  .compileComponentAsync(this.createDynamicComponent(selector, template))
  .then(factory => {
    this.vcRef.clear();
    this.vcRef.createComponent(factory, 0, injector);
  });
```

### After `NgModule`

In Angular 2.0.0-rc.6, many APIs including `Compiler#compileComponent` were removed as deprecated API. Now, every component is belonging to its NgModules as declarations, and every compilation starts on the module.

**Important thing: NgModules are compilation context.**

That means I no longer be able to compile components separately because any compilations needs a module.

Of course, then I had an idea; **dynamic component compilation with dynamic module creation.**

If you are interested in the idea and my challenge, see this code.

https://github.com/laco0416/angular2-component-outlet/blob/master/src/component-outlet.ts#L70-L99

I tried that and it seems succeeded, but it has a big problem: **AoT**.

### RuntimeCompiler is dead

**Ahead of Time compilation** is a powerful feature of Angular 2 to gain drastic performance improvement. It allows us to compile templates at the build time and reduce dependency on `@angular/compiler` package. It significantly affects to app bundle size if we use **tree-shaking.** why? Because then our app doesn’t have `RuntimeCompiler`. As all compilation finished in offline, a compiler is not needed in runtime.

AoT compilation brings many benefits to us:

- Small payload bundle
- Fast bootstrapping
- Template error detection

So, I chose AoT and threw away `$compile`.

### Use `innerHTML` and DOM APIs

Instead of `$compile`, I decided to use `innerHTML` and DOM APIs to implement something like `directive` or Custom Elements.

Most of our directives may be reproduced with native DOM. For example, we can create _pseudo-routerLink_ in a dynamic HTML.

It’s very grunt code, but works well. We should go on the right way of Angular and Web standards.

### Summary

Angular 2 is stable now. We should throw away tricky ways. Keep our applications AoT-friendly and optimizable. Follow the right Angular way.
