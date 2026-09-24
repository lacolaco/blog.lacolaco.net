---
title: 'Angular: Rethinking the Semantics of Private Fields'
slug: 'angular-private-fields'
icon: ''
created_time: '2026-09-24T22:51:00.000Z'
last_edited_time: '2026-09-24T22:51:00.000Z'
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
auto_translated_from: '702703962f8835a299ee3eeaeec16f0da8b2d6aee60daca501b8951fd34bba13'
---

Since the Angular v22.2.0 update, the template compiler's behavior regarding private fields in component classes has changed. In this article, I will summarize the updates and my current thoughts on the semantics of field declarations that we must rethink as a result.

## Updates

In the Angular v22.2.0 update, class fields (member variables) declared with the `private` modifier can now be referenced from within a component's template.

[https://github.com/angular/angular/pull/70188](https://github.com/angular/angular/pull/70188)

Specifically, code like the following is now executable. Referencing the `name` field of the component using interpolation syntax no longer causes a compilation error.

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

The restriction was relaxed only for fields declared with the `private` modifier; ECMAScript private fields using the `#` prefix still cannot be referenced and will result in a compilation error, as before.

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

Since Angular components are typically exported classes, their `public` and `protected` members are included in the class's external type declarations. For example, suppose we declare a signal to be referenced from a template as follows:

```typescript
export class GreetingComponent {
  protected readonly name = signal('Angular');
}
```

Because `protected` members can be accessed from derived classes, they are part of the class's external type. Therefore, under `isolatedDeclarations`, an explicit type annotation is required, as shown below:

```typescript
export class GreetingComponent {
  protected readonly name: WritableSignal<string> = signal('Angular');
}
```

On the other hand, `private` members are implementation details of the class, and there is no need to expose their specific types as part of the external API. Consequently, if template-only fields can be made `private`, we can avoid redundant type annotations just for the sake of generating type declaration files and leverage TypeScript's type inference directly.

```typescript
export class GreetingComponent {
  private readonly name = signal('Angular');
}
```

Previously, members referenced from templates could not be `private`. Because of this, developers had no choice but to add type annotations to fields exposed to templates if they wanted to enable `isolatedDeclarations`. This change is a measure against this decline in developer experience (DX).

## Semantics of Component Class Fields

To properly distinguish between the use of different component class field declarations, we need to clarify the semantics—what the intention is behind declaring each type of field.

While this may vary by project, typical conventional semantics might look like this. Under the previous specifications, there was no difference at the functional level of an Angular component between private fields using the `private` modifier and those using the `#` prefix. Therefore, there was no semantic need to distinguish them, and as long as a project policy was established for which one to use, there was no confusion.

- `public`: An API exposed for access via the class instance.
  - These rarely appear in production code. They are necessary when accessing an instance from a `ComponentFixture` in test code, but unnecessary for DOM tests using tools like Testing Library.
- `protected`: An internal API accessed only within the component.
  - Since inheritance is rarely used in component classes, this effectively functions as a private field that is also accessible from the template. **Fields declared for template binding** should generally be `protected`.
- `private`: An internal API accessed only from class methods.
  - Since these cannot be referenced from the template, they are used for **injected dependency fields or internal state that you want to hide from the view**.

Taken together, the following component implementation was a typical example until now.

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
  // API for calling externally via class instance
  public reset(): void {
    this.name.set('');
  }

  // Internal API referenced from the template
  protected readonly name = signal('');

  // Implementation details referenced only from class methods
  private readonly router = inject(Router);

  protected goBack(): void {
    this.router.navigate(['/profiles']);
  }
}
```

## Proposal for Semantics in the New Specification

Given this change, I think it seems natural to view the template not as something external to the component class, but as something that **constitutes the component's implementation along with the class**.

Based on this premise, the declarations can be used as follows:

- `public`: An API exposed to users of the class instance.
  - Use only when it is necessary to access the component instance directly from the outside.
- `protected`: An API exposed to derived classes.
  - Basically not used. Use cases exist only for components intended for inheritance, which is extremely rare.
- `private`: An internal component API.
  - Available for use by both the class and the template. This becomes the default form for state and methods referenced by the template.

In this organization, by moving the role of "internal API for templates" previously held by `protected` to `private`, we can avoid exposing specific types in external type declarations and utilize type inference even under `isolatedDeclarations`.

On the other hand, what should be done about implementation details like dependency services and internal state that we do not want the template to reference directly? I think there are two main strategies for approaching this problem.

### Strategy 1: Maintaining Information Hiding within the Component

One approach is to use TypeScript's `private` and ECMAScript's `#private` as different levels of visibility.

- `private`: Internal component API shared by the class and template.
- `#private`: Implementation detail hidden even from the template, used only within the class body.

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

In this strategy, we maintain information hiding within the component between "visible to the template" and "class body only." We expose only read-only signals, resources, and intended operations to the template, while keeping mutable state and low-level dependencies confined to `#private`. The semantics of the conventional `protected` and `private` are essentially shifted to `private` and `#private` and continued.

The advantage of this method lies in the fact that visibility can be enforced by language features. On the other hand, two types of private syntax coexist within a single class, and a mere difference in notation takes on the significant meaning of visibility from the Angular template.

### Strategy 2: Replacing Information Hiding within the Component with Separation of Concerns

The other strategy, which I prefer, is to interpret the template and class as a single unit as a component and **not perform information hiding within the component**. Instead, implementation details that need to be hidden from the template should not be held by the component in the first place.

The change this time allows access from the template to the component's own `private` fields. It does not mean that `private` fields of nested objects are exposed. Taking advantage of this property, we can move dependencies, state, and processing that are not exposed to the template into other objects such as Facades, ViewModels, or Stores.

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

What is directly visible from the template is the component's `vm` field. Beyond that, only the public API of the `UserListViewModel` is available; `private` members like `http` or `selectedUserId` cannot be accessed.

In this strategy, the component class focuses on the responsibility of integrating the template and external objects, and implementations requiring information hiding are moved to separate objects.

### The Two Strategies

The fundamental difference between the two proposals is **whether or not to establish a boundary for information hiding inside the component**. Depending on whether you think the class and template have different contexts or share the same context, the semantics of private fields will change.

| | Information Hiding via Field Visibility | Information Hiding via Objects |
| ------- | ------- | ------- |
| Visibility within the component | Divided into two stages with `private` and `#private` | All members are exposed to the template |
| Where implementation details reside | Same component class | Separate objects like ViewModel, Facade, Store |
| Enforcement mechanism | Language features | Object boundaries |
| Pros | Fewer additional abstractions, full tool support | Avoids mixing two private syntaxes |
| Cons | Two types of private syntax coexist | Effort of separating concerns; can be over-engineered for small components |

There may be other approaches, but semantically it will likely be a variation of one of these two. Alternatively, simply exposing everything to the template without much thought is not a problem if that is what the project decides. What matters is intention and consistency.