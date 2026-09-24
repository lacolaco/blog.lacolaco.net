---
title: 'Angular: Rethinking Private Field Semantics'
slug: 'angular-private-fields'
icon: ''
created_time: '2026-09-24T22:36:00.000Z'
last_edited_time: '2026-09-24T22:36:00.000Z'
tags: []
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-private-fields'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://app.notion.com/p/Angular-3e53521b014a804c8c2fd56fecda60ed'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: 'abd6cdb85b93c1e4666a943c6dd1dd27b60d33f4d3d07e30129cd0a00175991f'
---

Since the Angular v22.2.0 update, the behavior of the template compiler regarding private fields in component classes has changed. In this article, I will summarize the details of the update and my current thoughts on the semantics of field declarations that we must rethink because of it.

## Update Details

In the Angular v22.2.0 update, class fields (member variables) declared with the `private` modifier became accessible from within the component's template.

https://github.com/angular/angular/pull/70188

Specifically, code like the following is now executable. Referencing the `name` field held by the component via interpolation syntax no longer results in a compilation error.

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-greeting',
  template: `<p>Hello, {{ name }}!</p>`,
})
export class GreetingComponent {
  private name = 'Angular';
}
```

The relaxation of restrictions applies only to fields declared with the `private` modifier; ECMAScript private fields using the `#` prefix remain inaccessible as before and will result in a compilation error.

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-greeting',
  // Error
  template: `<p>Hello, {{ #name }}!</p>`,
})
export class GreetingComponent {
  #name = 'Angular';
}
```

## Background of the Change

The background for this change is the support for [`isolatedDeclarations`](https://www.typescriptlang.org/tsconfig/isolatedDeclarations.html) introduced in TypeScript 5.5. `isolatedDeclarations` ensures that each file can be independently converted to a type declaration file (`.d.ts`) without type checking.

Since Angular components are usually exported classes, their `public` and `protected` members are included in the class's external type declaration. For example, suppose you declare a `Signal` to be referenced from a template as follows:

```typescript
export class GreetingComponent {
  protected readonly name = signal('Angular');
}
```

Because `protected` members are accessible from derived classes, they are part of the class's external type. Consequently, under `isolatedDeclarations`, explicit type annotations become necessary, like this:

```typescript
export class GreetingComponent {
  protected readonly name: WritableSignal<string> = signal('Angular');
}
```

On the other hand, `private` members are implementation details of the class, and there is no need to expose their specific types as part of the external API. Therefore, if fields intended only for the template can be made `private`, we can avoid redundant type annotations just for generating type declaration files and leverage TypeScript's type inference directly.

```typescript
export class GreetingComponent {
  private readonly name = signal('Angular');
}
```

Previously, members referenced from templates could not be `private`. Because of this, developers had no choice but to add type annotations to fields exposed to the template if they wanted to enable `isolatedDeclarations`. This change is a measure against that deterioration of the developer experience.

## Semantics of Component Class Fields

To differentiate the use of component class field declarations, it seems necessary to clarify the semantics of what intent each type of field is declared with.

While I think it varies by project, the typical traditional semantics might look like this. In the previous specification, at the functional level of an Angular component, there was no difference between a private field using the `private` modifier and a private field using the `#` prefix. Therefore, there was no semantic need to distinguish them, and as long as a policy was established within the project on which one to use, there was no confusion.

- `public`: APIs exposed via the path of being accessed as a class instance.
  - There isn't much use for this in production code. It is necessary when accessing the instance from a `ComponentFixture` in test code, but it is unnecessary for DOM tests using something like Testing Library.
- `protected`: Internal APIs accessed only within the component.
  - Since inheritance is rarely used in component classes, these effectively function as private fields that can also be accessed from the template. Fields declared for template binding should basically be `protected`.
- `private`: Internal APIs accessed only from class methods.
  - Since they cannot be referenced from the template, they are used for injected dependency fields or internal state that one wants to hide from the view.

In summary, the following component implementation was a typical example until now.

```typescript
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile-editor',
  template: `
    <input
      #nameInput
      [value]="name()"
      (input)="name.set(nameInput.value)"
    />
    <button (click)="goBack()">戻る</button>
  `,
})
export class ProfileEditorComponent {
  // クラスインスタンスを介して外部から呼び出すためのAPI
  public reset(): void {
    this.name.set('');
  }

  // テンプレートから参照する内部API
  protected readonly name = signal('');

  // クラスのメソッドからのみ参照する実装詳細
  private readonly router = inject(Router);

  protected goBack(): void {
    this.router.navigate(['/profiles']);
  }
}
```

## Proposed Semantics in the New Specification

Given this change, I think it would be natural to view the template not as something external to the component class, but as something that constitutes the component's implementation along with the class.

Under this premise, the declarations could be used as follows:

- `public`: APIs exposed to users of the class instance.
  - Use only when there is a need for direct external access via the component instance.
- `protected`: APIs exposed to derived classes.
  - Basically not used. There are use cases only in components intended for inheritance, but these are extremely rare.
- `private`: Component internal APIs.
  - Accessible from both the class and the template. This becomes the basic form for state and methods referenced by the template.

In this organization, by moving the role of "internal API for templates"—previously held by `protected`—to `private`, we can avoid exposing specific types in external type declarations and utilize type inference even under `isolatedDeclarations`.

On the other hand, how should we handle implementation details like dependency services or internal state that we don't want the template to reference directly? I think there are two major approaches to facing this issue.

### Approach 1: Maintaining Information Hiding within the Component

[Kaplan's proposal](https://github.com/angular/angular/pull/70188#issuecomment-5645787054) is to use TypeScript's `private` and ECMAScript's `#private` as different levels of visibility.

- `private`: Component internal APIs shared by the class and the template.
- `#private`: Implementation details hidden even from the template, used only within the class body.

```typescript
@Component({
  selector: 'app-user-list',
  template: `
    @for (user of users.value(); track user.id) {
      <button (click)="selectUser(user.id)">
        {{ user.name }}
      </button>
    }
  `,
})
export class UserListComponent {
  #http = inject(HttpClient);
  #selectedUserId = signal<string | null>(null);

  private readonly users = resource({
    loader: () =>
      firstValueFrom(
        this.#http.get<readonly User[]>('/api/users'),
      ),
  });

  private readonly selection =
    this.#selectedUserId.asReadonly();

  private selectUser(id: string): void {
    this.#selectedUserId.set(id);
  }
}
```

In this approach, information hiding between "visible to template" and "class body only" remains within the component. Only read-only `Signal` or `Resource` objects and intended operations are exposed to the template, while mutable state and low-level dependencies are confined to `#private`. It continues the traditional semantics of `protected` and `private` by shifting them directly to `private` and `#private`.

The advantage of this method lies in being able to enforce visibility through language features. On the other hand, two types of private syntax coexist within a single class, and a mere difference in notation takes on the significant meaning of visibility from the Angular template.

### Approach 2: Replacing Internal Hiding with Separation of Concerns

Another approach I propose is to interpret the template and class as a single unit forming the component and decide not to perform information hiding within the component. Instead, implementation details that need to be hidden from the template should be moved out of the component in the first place.

What this change permits is access from the template to the component's own `private` fields. It does not mean that `private` fields of nested objects are exposed. Leveraging this characteristic, we can move dependencies, state, and processes that should not be exposed to the template into other objects like a Facade, ViewModel, or Store.

```typescript
@Injectable()
class UserListViewModel {
  private readonly http = inject(HttpClient);
  private readonly selectedUserId = signal<string | null>(null);

  readonly users = resource({
    loader: () =>
      firstValueFrom(
        this.http.get<readonly User[]>('/api/users'),
      ),
  });

  readonly selection = this.selectedUserId.asReadonly();

  selectUser(id: string): void {
    this.selectedUserId.set(id);
  }
}

@Component({
  selector: 'app-user-list',
  providers: [UserListViewModel],
  template: `
    @for (user of vm.users.value(); track user.id) {
      <button (click)="vm.selectUser(user.id)">
        {{ user.name }}
      </button>
    }
  `,
})
export class UserListComponent {
  private readonly vm = inject(UserListViewModel);
}
```

What is directly visible from the template is the component's `vm` field. Beyond that, only the public API of `UserListViewModel` is available, and `private` members like `http` or `selectedUserId` cannot be accessed.

In this approach, the component class focuses on the responsibility of integrating the template and external objects, while implementations requiring information hiding are moved to separate objects.

### Two Approaches

The fundamental difference between the two proposals is whether or not to establish a boundary for information hiding inside the component. The semantics of private fields change depending on whether you think the class and template have different contexts or share the same context.

| | Information hiding via field visibility | Information hiding via objects |
| ------- | ------- | ------- |
| Visibility within component | Separated into two levels with `private` and `#private` | All members are exposed to the template |
| Location of implementation details | Same component class | Separate objects like ViewModel, Facade, Store, etc. |
| Enforcement mechanism | Language features | Object boundaries |
| Pros | Fewer additional abstractions, full tool support | Avoids mixing different private syntaxes |
| Cons | Two types of private syntax coexist | Effort for separation of concerns. Can be over-engineering for small components |

There may be other approaches, but semantically, it will likely be a derivative of one of these two. Alternatively, simply exposing everything to the template without much thought is not a problem if that is what the project decides. What matters is intent and consistency.