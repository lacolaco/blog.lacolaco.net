---
title: 'Angular: Rethinking the Semantics of Private Fields'
slug: 'angular-private-fields'
icon: ''
created_time: '2026-09-24T22:56:00.000Z'
last_edited_time: '2026-09-24T22:56:00.000Z'
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

Since the Angular v22.2.0 update, the behavior of the template compiler regarding private fields in component classes has changed. In this article, I will summarize the update and share my current thoughts on the semantics of field declarations that we should perhaps reconsider as a result.

## Content of the Update

With the Angular v22.2.0 update, class fields (member variables) declared with the `private` modifier can now be referenced from within a component's template.

[https://github.com/angular/angular/pull/70188](https://github.com/angular/angular/pull/70188)

Specifically, code like the following is now executable. Referencing the `name` field of a component using interpolation syntax no longer causes a compilation error.

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

The restriction has only been relaxed for fields declared with the `private` modifier; ECMAScript private fields using the `#` prefix still cannot be referenced and will result in a compilation error as before.

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

The background for this change is the support for [`isolatedDeclarations`](https://www.typescriptlang.org/tsconfig/isolatedDeclarations.html) introduced in TypeScript 5.5. `isolatedDeclarations` ensures that each file can be independently converted into a type declaration file (`.d.ts`) without type checking.

Since Angular components are typically exported classes, their `public` and `protected` members are included in the class's external type declaration. For example, suppose you declare a Signal to be referenced from a template like this:

```typescript
export class GreetingComponent {
  protected readonly name = signal('Angular');
}
```

Because `protected` members are accessible from derived classes, they are part of the class's external type. Therefore, under `isolatedDeclarations`, an explicit type annotation becomes necessary, as shown below:

```typescript
export class GreetingComponent {
  protected readonly name: WritableSignal<string> = signal('Angular');
}
```

On the other hand, `private` members are implementation details of the class, and there is no need to expose their specific types as part of the external API. Consequently, if fields used exclusively for templates can be made `private`, we can avoid redundant type annotations solely for generating type declaration files and instead leverage TypeScript's type inference directly.

```typescript
export class GreetingComponent {
  private readonly name = signal('Angular');
}
```

Previously, members referenced from templates could not be `private`. Because of this, developers had no choice but to add type annotations to fields exposed to the template when enabling `isolatedDeclarations`. This change is a measure against that degradation of the developer experience.

## Semantics of Component Class Fields

To use component class field declarations effectively, I think it is necessary to clarify the semantics—what intention each type of field is declared with.

While there may be differences depending on the project, the traditional typical semantics would likely be as follows. Under the previous specifications, there was no difference at the functional level of Angular components between private fields using the `private` modifier and those using the `#` prefix. Therefore, there was no semantic need to distinguish between them, and as long as a policy was established within a project, there was no confusion.

- `public`: An API exposed for access via the class instance.
  - These rarely appear in production code. They are necessary when accessing an instance from a `ComponentFixture` in test code, but unnecessary for DOM tests using something like Testing Library.
- `protected`: An internal API accessed only within the component.
  - Since inheritance is rarely used in component classes, these effectively function as private fields that can also be accessed from templates. **Fields declared for template binding** can generally be `protected`.
- `private`: An internal API accessed only from class methods.
  - Since they cannot be referenced from the template, they are used for **injected dependency fields or internal state that you want to hide from the view**.

Taken together, a component implementation like the following was a typical example until now.

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
  // API for external calling via the class instance
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

## A Proposal for Semantics in the New Specification

Given this change, it seems natural to view the template not as something external to the component class, but as something that **constitutes the component's implementation along with the class**.

Under this premise, the declarations could be used as follows:

- `public`: An API exposed to users of the class instance.
  - Use only when direct external access via the component instance is required.
- `protected`: An API exposed to derived classes.
  - Basically not used. Use cases exist only in components designed for inheritance, which is extremely rare.
- `private`: An internal component API.
  - Can be used by both the class and the template. This becomes the basic form for state and methods referenced by the template.

In this organization, by moving the role of "internal API for templates" previously held by `protected` to `private`, we avoid exposing specific types in the external type declaration and can utilize type inference even under `isolatedDeclarations`.

On the other hand, what should we do with implementation details like dependency services or internal state that we do not want the template to reference directly? I think there are two main approaches to facing this problem.

### Strategy 1: Maintain Information Hiding within the Component

One approach is to use TypeScript's `private` and ECMAScript's `#private` as different levels of visibility.

- `private`: An internal component API shared by the class and the template.
- `#private`: An implementation detail hidden even from the template, used only within the class body.

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

In this strategy, we maintain information hiding within the component between "visible to the template" and "class body only." We expose only read-only Signals, Resources, or intended operations to the template, while confining mutable state or low-level dependencies within `#private`. This effectively continues the traditional semantics of `protected` and `private` by shifting them to `private` and `#private`.

The advantage of this method is that visibility can be enforced by language features. On the other hand, two types of private syntax will coexist within a single class, and a mere difference in notation will carry the significant meaning of visibility from the Angular template.

### Strategy 2: Replace Information Hiding with Separation of Concerns

Another approach, which is my preference, is to interpret the template and the class as a single unit forming the component, and **opt not to perform information hiding within the component**. Instead, implementation details that need to be hidden from the template should not be held by the component in the first place.

What this change allows is access from the template to the component's own `private` fields. It does not mean that the `private` fields of nested objects are exposed. Taking advantage of this property, we move dependencies, state, and processes that should not be exposed to the template into other objects such as a Facade, ViewModel, or Store.

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

In this strategy, the component class focuses on the responsibility of integrating the template with external objects, and implementations requiring information hiding are moved to separate objects.

### The Two Strategies

The fundamental difference between the two proposals is **whether or not to establish a boundary for information hiding inside the component**. Depending on whether you think the class and the template have different contexts or share the same context, the semantics of private fields will change.

| | Information Hiding via Field Visibility | Information Hiding via Objects |
| ------- | ------- | ------- |
| Visibility within the component | Divided into two stages with `private` and `#private` | All members are exposed to the template |
| Location of implementation details | The same component class | Separate objects like ViewModel, Facade, Store |
| Enforcement mechanism | Language features | Object boundaries |
| Pros | Fewer additional abstractions; full tool support | No mixing of private syntaxes |
| Cons | Two types of private syntax coexist | Effort of separating concerns; may be over-engineering for small components |

There might be other approaches, but semantically, they will likely be variations of one of these two. Alternatively, if a project decides to expose everything to the template without much thought, that is not a problem either. What matters is intent and consistency.
