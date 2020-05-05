---
title: "Zoneless Angular Tip: How To Detect Activated Route Change"
date: 2020-03-24T09:27:32+09:00
tags: ["english","angular","router","change-detection","zoneless"]
foreign: true
---

Although Angular allows us to use `NoopNgZone` to make an app zoneless, still some Angular modules are depending on Zone implicitly. 

## `ngOnInit` of Routed Component won't be called!

I hit a problem when using Angular Router without Zone. Routing looks working but `ngOnInit` method of the routed component has not been executed.

![image.png (188.7 kB)](https://img.esa.io/uploads/production/attachments/14362/2020/03/24/50720/db07c767-7618-4179-bba5-f6150881313b.png)

It is because Angular Router depends on Zone in route activation. 
Technically, Router internally calls `ChangeDetectorRef#markForCheck` to re-render after route change.
https://github.com/angular/angular/blob/master/packages/router/src/directives/router_outlet.ts#L142

[As I wrote previously](https://blog.lacolaco.net/2020/03/angular-app-reactiveness-en/), `markForCheck` won't trigger Change Detection without Zone.

## Call `detectChanges` on `(activate)`

Here is a solution, maybe just a workaround.

```ts
@Component({
  selector: 'my-app',
  template: `
    <router-outlet (activate)="onRouteActivated()"></router-outlet>
`,
})
export class AppComponent {
  constructor(private cdRef: ChangeDetectorRef) {}

  onRouteActivated() {
  }
}
```

`RouterOutlet` component is exposing `(activate)` output.  It emits events on route has been activated. So I can trigger Change Detection after route activation.

```ts
@Component({
  selector: 'my-app',
  template: `
    <router-outlet (activate)="onRouteActivated()"></router-outlet>
`,
})
export class AppComponent {
  constructor(private cdRef: ChangeDetectorRef) {}

  onRouteActivated() {
    // Call OnInit of routed component
    this.cdRef.detectChanges();
  }
}
```

Running example: https://ng-run.com/edit/pwwWzXxngYX0FUJDZIIj?open=app%2Fapp.component.ts

