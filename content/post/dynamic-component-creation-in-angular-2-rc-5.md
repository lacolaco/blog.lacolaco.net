+++
date = "2016-08-11T12:00:00+09:00"
title = "Dynamic Component Creation in Angular 2 RC.5"

+++

Few months ago, I wrote an article, [Dynamic Component Creation in Angular 2](/post/dynamic-component-creation-in-angular-2/).
It said how to load a HTML template with using _dynamic component creation_.

Now, Angular 2 RC.5 has released! Some APIs were deprecated and some introduced.
Let's revise my _dynamic component creation_ in latest Angular 2. 

Angular version: 2.0.0-rc.5

<!--more-->

## `ComponentOutlet` directive

Previously, I declared `DynamicHTMLOutlet`; 

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

My new idea is `ComponentOutlet`, it has own template, selector and **context**.
By **context** passing, we can use data-binding and event-handling in the dynamic template.

```ts
@Directive({
  selector: '[componentOutlet]',
})
export class ComponentOutlet {
  @Input('componentOutlet') private template: string;
  @Input('componentOutletSelector') private selector: string;
  @Input('componentOutletContext') private context: Object;

  private _createDynamicComponent() {
    this.context = this.context || {};

    const metadata = new ComponentMetadata({
      selector: this.selector,
      template: this.template,
    });

    const cmpClass = class _ { };
    cmpClass.prototype = this.context;
    return Component(metadata)(cmpClass);
  }
}
```

And it's used with templating syntax (`*`-prefix) like `*ngIf`.
Templating syntax can turn the element into the template which doesn't appear in the DOM.
So, we can replace an element has `componentOutlet` with the dynamic component.

```
@Component({
    selector: 'my-app',
    template: `
    <div *componentOutlet="html; context:self; selector:'my-dynamic-component'"></div>
    `,
})
export class App {
  self = this; // copy of context
  html = `
  <div>
    <button (click)="self.showAlert('dynamic component')">Click</button>
  </div>`;
  
  setMessage(message: string) {
    alert(message);
  }
}
```

It turns into like below;

```html
<my-app>
    <my-dynamic-component>
        <div>
            <button>Click<button>
        </div>
    <my-dynamic-component>
</my-app>
```

This is what I really wanted. don't you?

## Use `Compiler`

In RC.5, `ComponentResolver` is deprecated. Instead, We can use `Compiler` API to create `ComponentFactory`.

Before: 

```ts
this.resolver.resolveComponent(this._createDynamicComponent())
    .then(factory => {
        ...
    })
```

After: 

```ts
this.compiler.compileComponentAsync(this._createDynamicComponent())
    .then(factory => {
        ...
    });
```

`Compiler` belongs to the application module.
So the compiler can use all directives and pipes which is in `declarations` of the module.

At the final, `ComponentOutlet` code is following:

```ts
@Directive({
  selector: '[componentOutlet]',
})
export class ComponentOutlet {
  @Input('componentOutlet') private template: string;
  @Input('componentOutletSelector') private selector: string;
  @Input('componentOutletContext') private context: Object;

  constructor(private vcRef: ViewContainerRef, private compiler: Compiler) { }

  private _createDynamicComponent() {
    this.context = this.context || {};

    const metadata = new ComponentMetadata({
      selector: this.selector,
      template: this.template,
    });

    const cmpClass = class _ { };
    cmpClass.prototype = this.context;
    return Component(metadata)(cmpClass);
  }

  ngOnChanges() {
    if (!this.template) return;
    this.compiler.compileComponentAsync(this._createDynamicComponent())
      .then(factory => {
        const injector = ReflectiveInjector.fromResolvedProviders([], this.vcRef.parentInjector);
        this.vcRef.clear();
        this.vcRef.createComponent(factory, 0, injector);
      });
  }
}
```

Let's use the outlet.

<iframe src="https://embed.plnkr.co/1dlbF4/" width="100%" height="300" frameborder="0"></iframe>

```ts
@Component({
    selector: 'my-app',
    template: `
        <p>{{message}}</p>
        <div *componentOutlet="html; context:self; selector:'my-dynamic-component'"></div>
    `,
})
export class App {
  message = 'static component';
  self = this; // copy of context
  html = `
  <div>
    <button (click)="self.setMessage('dynamic component')">Click</button>
  </div>`;
  
  setMessage(message: string) {
    this.message = message;
  }
}

@NgModule({
  imports: [BrowserModule],
  declarations: [App, ComponentOutlet],
  bootstrap: [App]
})
export class AppModule {}
```

## Summary

- `ComponentOutlet` with `*`-prefix syntax
- `NgModule` and `Compiler`

If you want to use my `ComponentOutlet`, you can install `angular2-component-outlet` package.

[laco0416/angular2\-component\-outlet: Angular2 dynamic component outlet](https://github.com/laco0416/angular2-component-outlet)

```
npm install --save angular2-component-outlet
```

Please give me feedback!
