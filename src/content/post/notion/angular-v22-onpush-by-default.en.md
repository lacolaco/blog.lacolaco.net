---
title: 'Angular v22: Introducing ChangeDetectionStrategy.Eager and OnPush By Default'
slug: 'angular-v22-onpush-by-default'
icon: ''
created_time: '2026-04-22T14:43:00.000Z'
last_edited_time: '2026-04-30T03:24:00.000Z'
tags:
  - 'Signals'
  - 'Angular CLI'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-v22-onpush-by-default'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://app.notion.com/p/Angular-v22-ChangeDetectionStrategy-Eager-OnPush-By-Default-34a3521b014a808f9211c3a1b715c44d'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: '738cc3ce93679515b2daf1e69be8c6f9289e5c81c46464525ce881be05697edb'
---

In Angular v21.2, `ChangeDetectionStrategy.Eager` was newly added as an option for a component's change detection strategy. That said, this has exactly the same behavior as the existing `ChangeDetectionStrategy.Default`; it's essentially just an alias.

https://github.com/angular/angular/pull/66830

As of v21, you can choose between `Eager` (= `Default`) and `OnPush` for the change detection strategy, but **in v22, `OnPush` will finally become the default**. A migration path for existing projects is also planned, so I'll explain that here.

## Default-to-Eager Migration

https://github.com/angular/angular/commit/cb4cb77053a817fe800af6395783720761e29ada

Through the `ng update` migration to Angular v22, components that have no strategy specified or are set to `Default` will be automatically rewritten to `Eager`. Because of this, applications in existing projects will continue to operate with the same change detection behavior as before, so no breaking changes should occur.

## OnPush By Default

https://github.com/angular/angular-cli/commit/6572a69443356ff0022e6ce162915125fee0e3bb

https://github.com/angular/angular/commit/eae8f7e30b9f8bebdcdb535bd86260199c34274b

Starting from v22, the change detection strategy for components generated via `ng new` or `ng generate` will be `OnPush` by default. Of course, if you have explicitly set component generation options to `changeDetection: Eager` in your configuration files, that will be applied, but otherwise, new code will operate in `OnPush` mode without any extra effort.

## Eager-to-OnPush Migration?

For now, there doesn't seem to be any discussion about deprecating `Eager` mode. While `OnPush` has performance advantages, there is likely no need to rush the migration of existing code. When you do proceed with migration, it often goes smoothly if you first migrate the component's internal state to a `Signal`. The primary reason a component stops working after switching to `OnPush` is when class fields are being modified internally, but if those fields are `Signal` instances, the template will automatically subscribe to changes in the `Signal`.

```diff
@Component({
  template: `
-   <div>{{ userData?.name }}</div>
+   <div>{{ userData()?.name }}</div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Component {
   private userService = inject(UserService);

-  userData?: UserData | undefined;
+  readonly userData = signal<UserData | undefined>(undefined);

loadUserData() {
    this.userService.getUserData().then((data) => {
-      this.userData = data;
+      this.userData.set(data);
    });
  }
}
```

The reason the Angular team wants to promote `OnPush` more than ever is that they want to encourage the "Zoneless-ification" of existing projects. To strip away the dependency on Zone.js, moving to `OnPush` is recommended. While not strictly required, if everything is running entirely on `OnPush`, you can guarantee that Zone.js is no longer needed. Conversely, if there are components running in `Eager` mode, the possibility of a dependency on Zone.js cannot be entirely ruled out.

The Angular MCP Server also provides a tool called `onpush_zoneless_migration` to assist with `OnPush` migration and going Zoneless using AI agents.

https://angular.jp/guide/zoneless

https://angular.dev/ai/mcp

Even though existing code will continue to work as is, I expect the future Angular ecosystem will evolve with the general assumption that "`OnPush` is the default." If you want to receive those benefits without exception, then the path toward `OnPush` and Zoneless migration will likely be an unavoidable one.

## Summary

- In Angular v22, `ChangeDetectionStrategy.Eager` is treated as the successor to `Default`.
- For existing code, components set to `Default` or with no strategy specified will be automatically migrated to `Eager` via `ng update`, preserving their behavior.
- Newly created components will use `OnPush` by default.
- There is no need to migrate existing `Eager` components immediately, but the ecosystem will likely shift toward an `OnPush` prerequisite in the future.