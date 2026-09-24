---
title: 'Angular: Rethinking the Semantics of Private Fields'
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

Starting with the Angular v22.2.0 update, the template compiler's behavior regarding private fields in component classes has changed. In this post, I will summarize the update and my current thoughts on the semantics of field declarations that perhaps need rethinking as a result.

## Update Details

In the Angular v22.2.0 update, class fields (member variables) declared with the `private` modifier became accessible from within a component's template.

[https://github.com/angular/angular/pull/70188](https://github.com/angular/angular/pull/70188)

Specifically, code like the following is now executable. Referring to the `name` field of a component via interpolation syntax no longer results in a compilation error.

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

This relaxation only applies to fields declared with the `private` modifier; ECMAScript private fields using the `#` prefix remain inaccessible from templates as before and will cause a compilation error.

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

The background for this change lies in supporting [`isolatedDeclarations`](https://www.typescriptlang.org/tsconfig/isolatedDeclarations.html), which was introduced in TypeScript 5.5. `isolatedDeclarations` ensures that each file can be independently converted into a type declaration file (`.d.ts`) without type checking.

Since Angular components are typically exported classes, their `public` and `protected` members are included in the class's external type declarations. For example, suppose you declare a Signal for template reference like this:

```typescript
export class GreetingComponent {
  protected readonly name = signal('Angular');
}
```

Because `protected` members can be accessed from derived classes, they are part of the class's external type. Therefore, under `isolatedDeclarations`, an explicit type annotation is required as follows:

```typescript
export class GreetingComponent {
  protected readonly name: WritableSignal<string> = signal('Angular');
}
```

On the other hand, `private` members are implementation details of the class, and there is no need to expose their specific types as part of the external API. Consequently, if fields used exclusively for the template could be made `private`, one could avoid redundant type annotations just for generating declaration files and leverage TypeScript's type inference as-is.

```typescript
export class GreetingComponent {
  private readonly name = signal('Angular');
}
```

Until now, members referenced from templates could not be `private`. For this reason, developers had no choice but to add type annotations to fields exposed to the template when enabling `isolatedDeclarations`. This change serves as a measure against this degradation of the developer experience.

## Semantics of Component Class Fields

To use component class field declarations effectively, I think it is necessary to clarify the semantics of each field type—what intention each declaration is meant to convey.

While there may be differences between projects, the traditional typical semantics would likely be as follows. Under previous specifications, there was no functional difference between private fields using the `private` modifier and those using the `#` prefix at the Angular component level. Thus, there was no need to distinguish them semantically, and as long as a project policy was established for which to use, it seems to me there was no confusion.

- `public`: APIs exposed via the path accessed as a class instance.
  - These rarely appear in production code. They are necessary when accessing an instance via `ComponentFixture` in test code, but unnecessary for DOM tests using something like Testing Library.
- `protected`: Internal APIs accessed only within the component.
  - Since inheritance is rarely used for component classes, these effectively function as private fields that are also accessible from templates. **Fields declared for template binding** should generally be `protected`.
- `private`: Internal APIs accessed only from class methods.
  - Because they cannot be referenced from the template, they are used for **injected dependency fields or internal state that one wants to hide from the view**.

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
  // API for calling from the outside via a class instance
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

## Proposed Semantics under the New Specification

Given this change, it seems natural to view the template not as something external to the component class, but as something that **constitutes the component implementation along with the class**.

Under this premise, the different declarations could be used as follows:

- `public`: APIs exposed to users of the class instance.
  - Use this only when direct external access via the component instance is necessary.
- `protected`: APIs exposed to derived classes.
  - Generally not used. Use cases exist only in components designed for inheritance, which is extremely rare.
- `private`: Internal component APIs.
  - Accessible from both the class and the template. This becomes the basic form for states and methods referenced by the template.

In this organization, by shifting the role of "internal API for templates" previously held by `protected` over to `private`, we can avoid exposing specific types in external type declarations and leverage type inference even under `isolatedDeclarations`.

On the other hand, what should be done about implementation details that one might not want directly referenced by the template, such as dependency services or internal state? I wonder if there are two main policies for approaching this issue.

### Policy 1: Maintaining Information Hiding within the Component

[A proposal by Mr. Kaplan](https://github.com/angular/angular/pull/70188#issuecomment-5645787054) suggests using TypeScript's `private` and ECMAScript's `#private` as different levels of visibility.

- `private`: Internal component APIs shared by the class and template.
- `#private`: Implementation details hidden even from the template and used only within the class body.

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

In this policy, information hiding is maintained within the component between "visible to template" and "class body only." Only read-only Signals, Resources, or intended operations are exposed to the template, while mutable state and low-level dependencies are confined to `#private`. The semantics of the traditional `protected` and `private` are essentially shifted to `private` and `#private`.

The advantage of this method is that visibility can be enforced by language features. On the other hand, it means two types of private syntax coexist within a single class, and a mere difference in notation takes on the significant meaning of visibility from the Angular template.

### Policy 2: Replacing Information Hiding with Separation of Responsibilities

Another policy I propose is to interpret the template and class as a single unit forming the component and to **forego information hiding inside the component**. Instead, implementation details that need to be hidden from the template should not be held by the component in the first place.

What this change permits is access from the template to the component's own `private` fields. It does not mean the `private` fields of nested objects are exposed. Leveraging this characteristic, one can move dependencies, state, and processes that should not be exposed to the template into separate objects like a Facade, ViewModel, or Store.

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

What is directly visible from the template is the component's `vm` field. Beyond that, only the public API of `UserListViewModel` is available; `private` members like `http` or `selectedUserId` cannot be accessed.

In this policy, the component class focuses on the responsibility of integrating the template with external objects, while implementations requiring information hiding are moved to separate objects.

### The Two Policies

The fundamental difference between the two proposals is **whether to establish a further boundary for information hiding inside the component**. The semantics of private fields change depending on whether you think the class and template have different contexts or share the same context.

| | Information hiding via field visibility | Information hiding via objects |
| ------- | ------- | ------- |
| Visibility within the component | Divided into two levels with `private` and `#private` | All members are exposed to the template |
| Location of implementation details | Same component class | Separate objects like ViewModel, Facade, Store |
| Enforcement mechanism | Language features | Object boundaries |
| Pros | Fewer additional abstractions, full tool support | Avoids mixing private syntaxes |
| Cons | Two types of private syntax coexist | Effort for separation of concerns; may be over-engineering for small components |

There may be other approaches, but semantically I suspect they will likely be variations of one of these two. Alternatively, simply exposing everything to the template without much thought is also not a problem if that is what the project decides. What matters is intent and consistency.