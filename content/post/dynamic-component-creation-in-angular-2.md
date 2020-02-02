+++
date = "2016-05-25T13:00:00+09:00"
publishdate = "2016-05-25T13:00:00+09:00"
title = "Dynamic Component Creation in Angular 2"

+++

**Edit**
Revised in [Dynamic Component Creation in Angular 2 RC.5](/post/dynamic-component-creation-in-angular-2-rc-5/)


Since Angular 2, `$compile` was dropped. 
There are no ways to insert HTML fragments into the component view except using `innerHTML`.
But if we could create a component and load it...? Yes, we can do it!
This post will explain about **dynamic HTML projection** in Angular 2 with dynamic component creation.

Angular version: 2.0.0-rc.1

<!--more-->

## `Component` as a function

We usually use a decorator, `@Component`, to create a component class like the following:

```ts
@Component({
    selector: 'static-component',
    template: `<p>Static Component</p>`
})
class StaticComponent {
}
```

Actually, above component is almost equivalent to the next:

```ts
class DynamicComponent {
}

const dynamicComponent = Component({
    selector: 'dynamic-component',
    template: `<p>Dynamic Component</p>`
})(DynamicComponent);
```

**Decorator isn't a magic. It's just function-calling.**

## Dynamic Component Loading

We can already use `ViewContainerRef` and `ComponentResolver` to load components into the host component dynamically.

- [ViewContainerRef - ts](https://angular.io/docs/ts/latest/api/core/index/ViewContainerRef-class.html)
- [ComponentResolver - ts](https://angular.io/docs/ts/latest/api/core/index/ComponentResolver-class.html)

### ViewContainerRef
`ViewContainerRef` is a **container** where one or more views can be attached.
It's used in many places; `NgIf`, `NgFor`, `RouterOutlet`.

Creation types by `ViewContainerRef` are two pattern.
One is **loading into next location**. A component is loaded into the next location of the container.

Result: 

```html
<container-directive></container-directive>
<loaded-directive></loaded-directive>
```

Another is **loading as embedded view**. It needs `TemplateRef`.

Result: 

```html
<container-directive>
    <loaded-directive></loaded-directive>
</container-directive>
```

### ComponentResolver
`ComponentResolver` is a service to create `ComponentFactory` from a component type. 
All components are loaded into the view by `ComponentFactory`. 
`ComponentResolver` has a method, `resolveComponent`, which return a promise of `ComponentFactory`.

## Dynamic Component Factory

So, we can create any components in dynamically by using above features.
Let's look at the following code:

```ts
export function createComponentFactory(resolver: ComponentResolver, metadata: ComponentMetadata): Promise<ComponentFactory<any>> {
    const cmpClass = class DynamicComponent {};
    const decoratedCmp = Component(metadata)(cmpClass);
    return resolver.resolveComponent(decoratedCmp);
}
``` 

`createComponentFactory` returns a promise of `ComponentFactory` created dynamically. It's very simple.

Next, use the function at new `DynamicHTMLOutlet` directive.

```ts
@Directive({
    selector: 'dynamic-html-outlet',
})
export class DynamicHTMLOutlet {
  @Input() src: string;
  
  constructor(private vcRef: ViewContainerRef, private resolver: ComponentResolver) {
  }
  
  ngOnChanges() {
    if (!this.src) return;
    
    const metadata = new ComponentMetadata({
        selector: 'dynamic-html',
        template: this.src,
    });
    createComponentFactory(this.resolver, metadata)
      .then(factory => {
        const injector = ReflectiveInjector.fromResolvedProviders([], this.vcRef.parentInjector);
        this.vcRef.createComponent(factory, 0, injector, []);
      });
  }
}
```

Last, let's use the outlet.

```ts
@Component({
    selector: 'my-app',
    template: `
        <dynamic-html-outlet [src]="html"></dynamic-html-outlet>
    `,
    directives: [DynamicHTMLOutlet]
})
export class MyApp {
    html = `<div>
    <p>Dynamic HTML Fragment</p>
</div>`;
}
```

Plunker is [here](http://plnkr.co/edit/HCz7Kc)

## Summary

- Decorators are just function
- You can create a component by using `Component` and `ComponentResolver`
- You can load a component by using `ViewContainerRef` and `ComponentFactory`

