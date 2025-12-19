---
title: 'Zoneless Angular Tip: How To Detect Activated Route Change'
slug: 'angular-zoneless-router-activation'
icon: ''
created_time: '2020-03-24T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'en'
category: 'Tech'
notion_url: 'https://www.notion.so/Zoneless-Angular-Tip-How-To-Detect-Activated-Route-Change-8e70c8ca2d5649b094b002c8332db5c5'
features:
  katex: false
  mermaid: false
  tweet: false
---

Although Angular allows us to use `NoopNgZone` to make an app zoneless, still some Angular modules are depending on Zone implicitly.

## `ngOnInit` of Routed Component won’t be called!

I hit a problem when using Angular Router without Zone. Routing looks working but `ngOnInit` method of the routed component has not been executed.

![image](https://img.esa.io/uploads/production/attachments/14362/2020/03/24/50720/db07c767-7618-4179-bba5-f6150881313b.png)

It is because Angular Router depends on Zone in route activation. Technically, Router internally calls `ChangeDetectorRef#markForCheck` to re-render after route change. [https://github.com/angular/angular/blob/master/packages/router/src/directives/router_outlet.ts#L142](https://github.com/angular/angular/blob/master/packages/router/src/directives/router_outlet.ts#L142)

[As I wrote previously](https://blog.lacolaco.net/2020/03/angular-app-reactiveness-en/), `markForCheck` won’t trigger Change Detection without Zone.

## Call `detectChanges` on `(activate)`

Here is a solution, maybe just a workaround.

```
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

`RouterOutlet` component is exposing `(activate)` output. It emits events on route has been activated. So I can trigger Change Detection after route activation.

```
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

Running example: [https://ng-run.com/edit/pwwWzXxngYX0FUJDZIIj?open=app%2Fapp.component.ts](https://ng-run.com/edit/pwwWzXxngYX0FUJDZIIj?open=app%2Fapp.component.ts)

