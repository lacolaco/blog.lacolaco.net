---
title: 'Angular: Router Resources Explained'
slug: 'angular-router-resources'
icon: ''
created_time: '2026-10-11T12:18:00.000Z'
last_edited_time: '2026-10-11T15:47:00.000Z'
tags:
  - 'Signals'
  - 'Angular Router'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-router-resources'
channels:
  - 'Code'
  - 'Angular'
notion_url: 'https://app.notion.com/p/Angular-Router-Resources-3f13521b014a80f49acefae0cf5204c7'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: '37929e906fe7f1cb0508392865a8380bebcd7f2e732cfb309e3701c0bf00a78b'
---

Router Resources, released in Angular v22.2, is the long-awaited full-scale integration API for the Router and Signals. In this article, I will explain its basic usage through specific use cases.

https://angular.dev/guide/routing/data-fetching-with-resources

## How to Use Router Resources

### Blocking Data Fetching During Navigation

The most typical use case is fetching data during a Router navigation and waiting for the data to be ready before moving to the page. Until now, Observable/Promise-based data resolvers handled this, but an intuitive Signal-based API has been introduced to take over the same role. Let's look at a concrete comparison between the old and new code.

Take the case of fetching user data using an ID in the URL path during page navigation. Conventionally, you would declare a resolver function like this, and the component would receive the already fetched user data.

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withComponentInputBinding())],
};

// app.routes.ts
import { ResolveFn, Routes } from '@angular/router';
import { UserProfile } from './user-profile';
import { User, UserService } from './user.service';

const userResolver: ResolveFn<User> = (route) => {
  const userService = inject(UserService);
  const userId = route.paramMap.get('id')!;
  return userService.getUser(userId);
};

export const routes: Routes = [
  {
    path: 'users/:id',
    component: UserProfile,
    resolve: { user: userResolver },
  },
];
```

The component receives the fetched `User` as an input signal via `withComponentInputBinding`. This is typical data fetching during navigation using a data resolver.

```typescript
// user-profile.ts
import { Component, input } from '@angular/core';
import { User } from './user.service';

@Component({
  selector: 'app-user-profile',
  template: `
    <h2>{{ user().name }}</h2>
  `,
})
export class UserProfile {
  readonly user = input.required<User>();
}
```

Rewriting this with Router Resources looks like the following. First, to use Router Resources, add `withRouterResources()` to the Router configuration. Then, declare a function in the `Route.resources` property instead of a data resolver. This function takes a `ResourceContext` object as an argument and returns a key-value object of resources. `ResourceContext` holds various parameters as Signals; for example, `ctx.params()` is a Signal containing the path parameters. Since the resolved `value()` of the resource is passed to the component, the code remains exactly the same as in the data resolver case and requires no changes.

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withRouterResources,
} from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterResources(), // Added
    ),
  ],
};

// app.routes.ts
import { inject, resource } from '@angular/core';
import { Routes } from '@angular/router';
import { UserProfile } from './user-profile';
import { UserService } from './user.service';

export const routes: Routes = [
  {
    path: 'users/:id',
    component: UserProfile,
    resources: (ctx) => {
      const userService = inject(UserService);
      return {
        user: resource({
          params: () => ctx.params()['id'] as string,
          loader: ({ params: id }) =>
            userService.getUser(id),
        }),
      };
    },
  },
];
```

In this example, the data resolver was replaced by Router Resources, but if it were just about replacement, a new API wouldn't be necessary. From here, let's look at the advantages that only Router Resources can offer.

### Non-blocking Data Fetching

The behavior of a data resolver is **blocking**, meaning it navigates to the page only after the data fetch is complete. While this helps in ensuring state consistency before reaching a page that needs data, it has several drawbacks. One is a user experience issue where data fetching must be waited for on the previous page, making it feel as though the screen has frozen. It is difficult to manage waiting time with skeletons or loading UIs. Another issue is the fragmentation of code. Since data resolvers are always blocking, fetching non-blocking data ends up being written on the component side. Even though it is the same concern—data fetching associated with page navigation—the code gets scattered.

**Router Resources allows you to choose whether data fetching should be blocking or non-blocking.** This allows data fetching code associated with Router-dependent page transitions to be centralized in one place. Let's look at it concretely.

Unlike the previous example, let's display a loading indicator while fetching user data, an error message if it fails, and the user info once fetched. With the conventional API, the component would receive the path parameter as an input signal via `withComponentInputBinding`, and it would also be the component's responsibility to create a resource using that parameter.

```typescript
// user-profile.ts
import { Component, inject, resource } from '@angular/core';
import { UserService } from './user.service';

@Component({
  template: `
    @if (userResource.isLoading()) {
      <p>Loading...</p>
    } @else if (userResource.error()) {
      <p>Failed to load user.</p>
    } @else if (userResource.value(); as user) {
      <h2>{{ user.name }}</h2>
      <p>ID: {{ user.id }}</p>
    }
  `,
})
export class UserProfile {
  private readonly userService = inject(UserService);
  private readonly id = input.required<string>(); // users/:id

  readonly userResource = resource({
    params: () => this.id(),
    loader: ({ params: id }) =>
      this.userService.getUser(id),
  });
}
```

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { UserProfile } from './user-profile';

export const routes: Routes = [
  { path: 'users/:id', component: UserProfile },
];
```

With Router Resources, it looks like this. You create the resource in the `resources` function of the route configuration, but unlike the previous example, you wrap the resource with the `nonBlocking` function. By doing this, the component receives not the `value()` fetched by the resource, but the **resource object itself**. In other words, it receives not `user` but `userResource`.

```typescript
// app.routes.ts
import { inject, resource } from '@angular/core';
import { nonBlocking, Routes } from '@angular/router';
import { UserProfile } from './user-profile';
import { UserService } from './user.service';

export const routes: Routes = [
  {
    path: 'users/:id',
    component: UserProfile,
    resources: (ctx) => {
      const userService = inject(UserService);
      return {
        userResource: nonBlocking(
          resource({
            params: () => ctx.params()['id'] as string | undefined,
            loader: ({ params: id }) =>
              userService.getUser(id),
          }),
        ),
      };
    },
  },
];
```

The component **receives the resource object as an input signal** from the start. Since the resource object also holds the data fetching state and errors, it can handle UI changes according to the state, just like before. It's also worth noting that the concern regarding data fetching has disappeared from the component, and the dependency on the service has been eliminated. Through Router Resources, a component can achieve a higher level of separation as a presentation layer. The internal details of how data is fetched are encapsulated behind the resource.

```typescript
// user-profile.ts
import { Component, input, Resource } from '@angular/core';
import { User } from './user.service';

@Component({
  template: `
    @let res = userResource();
    @if (res.isLoading()) {
      <p>Loading...</p>
    } @else if (res.error()) {
      <p>Failed to load user.</p>
    } @else if (res.value(); as user) {
      <h2>{{ user.name }}</h2>
      <p>ID: {{ user.id }}</p>
    }
  `,
})
export class UserProfile {
  readonly userResource = input.required<Resource<User | undefined>>();
}
```

### Parallel Execution of Data Fetching Across Parent and Child Routes

Another advantage of Router Resources is the ability to execute data fetching across multiple routes in parallel. Data resolvers are executed sequentially from the parent route to the child route. Even if the data fetches have no dependencies on each other, the child must wait for the parent to complete.

Let's take a page that displays a user profile and a list of posts as an example. The parent route fetches the user information, and the child route fetches that user's list of posts. Both can be fetched as long as the ID from the URL is known; there's no need to wait for the user info fetch to complete to fetch the post list.

```typescript
// app.routes.ts
import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { UserPage } from './user-page';
import { UserPosts } from './user-posts';
import { User, UserService } from './user.service';
import { Post, PostService } from './post.service';

const userResolver: ResolveFn<User> = (route) => {
  const userService = inject(UserService);
  const userId = route.paramMap.get('id')!;
  return userService.getUser(userId);
};

const postsResolver: ResolveFn<Post[]> = (route) => {
  const postService = inject(PostService);
  const userId = route.paramMap.get('id')!;
  return postService.getPosts(userId);
};

export const routes: Routes = [
  {
    path: 'users/:id',
    component: UserPage,
    resolve: { user: userResolver },
    children: [
      {
        path: '',
        component: UserPosts,
        resolve: { posts: postsResolver },
      },
    ],
  },
];
```

`UserPage` displays the user information and a `RouterOutlet`, inside which `UserPosts` displays the list of posts. Since a child route with an empty path inherits the parent's path parameters, the same `id` can be used in the child. As in the previous examples, the component receives the fetched `user` and `posts` via `withComponentInputBinding`. In this setup, if fetching user information takes 200ms and fetching the post list takes 300ms, the total wait time for data fetching would be 500ms.

Replacing this with Router Resources looks like the following. **Router Resources loads resources for the parent and child routes that match the destination in parallel.** Since the fetching of user info and the post list proceeds in parallel, in the previous example, the total wait time for data fetching would not be 500ms, but around 300ms, which is the duration of the slower one.

```typescript
// app.routes.ts
import { inject, resource } from '@angular/core';
import { ResourceContext, Routes } from '@angular/router';
import { UserPage } from './user-page';
import { UserPosts } from './user-posts';
import { UserService } from './user.service';
import { PostService } from './post.service';

const userResource = (ctx: ResourceContext) => {
  const userService = inject(UserService);
  return resource({
    params: () => ctx.params()['id'] as string,
    loader: ({ params: id }) =>
      userService.getUser(id),
  });
};

const postsResource = (ctx: ResourceContext) => {
  const postService = inject(PostService);
  return resource({
    params: () => ctx.params()['id'] as string,
    loader: ({ params: id }) =>
      postService.getPosts(id),
  });
};

export const routes: Routes = [
  {
    path: 'users/:id',
    component: UserPage,
    resources: (ctx) => ({ user: userResource(ctx) }),
    children: [
      {
        path: '',
        component: UserPosts,
        resources: (ctx) => ({ posts: postsResource(ctx) }),
      },
    ],
  },
];
```

#### Appendix: Depending on a Parent Route's Resource

Consider a case where a child route fetches a post list using an organization ID included in the user information fetched by the parent route. In this case, the fetching criteria cannot be determined by URL parameters alone; the child depends on the parent's resource. As of v22.2.0, Router Resources does not have an API to reference a parent route's resource from the context of the `resources` function, but [PR #70587](https://github.com/angular/angular/pull/70587), which addresses this use case, is currently in development.

In this draft, `ResourceContext.resources` is exposed to inherit resources from ancestor routes, allowing resources declared in the parent to be retrieved via `ctx.resources()`. Rewriting the previous `postsResource` according to this proposal would look like the following. In this example, assume `User` has an `organizationId` and the post fetching service accepts that ID.

```typescript
// app.routes.ts
import { inject, Resource, resource } from '@angular/core';
import { ResourceContext } from '@angular/router';
import { User } from './user.service';
import { PostService } from './post.service';

const postsResource = (ctx: ResourceContext) => {
  const postService = inject(PostService);
  return resource({
    params: ({ chain }) => {
      const userResource = ctx.resources()['user'] as Resource<User | undefined>;
      return chain(userResource)?.organizationId;
    },
    loader: ({ params: organizationId }) =>
      postService.getPostsByOrganization(organizationId),
  });
};
```

### Reloading Without Re-navigation

Consider a scenario where you edit a name in a user list and want to re-fetch the list after saving. Instead of just displaying the saved value, you want to reflect the updated data from the server in the list. In this example, assume `UserService.getUsers()` returns the list as a `Promise<User[]>` and `saveUser(user)` saves the user info and returns a `Promise<void>`.

If you are fetching the list using a data resolver, re-fetching after saving also requires navigation. You would specify `onSameUrlNavigation: 'reload'` to handle navigation to the same URL, and `runGuardsAndResolvers: 'always'` to re-execute the resolver even if the path parameters haven't changed. With this method, route matching and guard evaluation are also re-executed just to update the list after saving.

```typescript
// app.routes.ts
import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { UserList } from './user-list';
import { User, UserService } from './user.service';

const usersResolver: ResolveFn<User[]> = () => {
  const userService = inject(UserService);
  return userService.getUsers();
};

export const routes: Routes = [
  {
    path: 'users',
    component: UserList,
    resolve: { users: usersResolver },
    runGuardsAndResolvers: 'always',
  },
];

// user-list.ts
import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { User, UserService } from './user.service';

@Component({
  template: `
    @for (user of users(); track user.id) {
      <input #name [value]="user.name" />
      <button (click)="saveUser(user, name.value)">Save</button>
    }
  `,
})
export class UserList {
  readonly users = input.required<User[]>();
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  async saveUser(user: User, name: string) {
    await this.userService.saveUser({ ...user, name });
    await this.router.navigateByUrl(this.router.url, {
      onSameUrlNavigation: 'reload',
    });
  }
}
```

With Router Resources, you only need to call `reload()` on the list's resource after the save is complete.

```typescript
// app.routes.ts
import { inject, resource } from '@angular/core';
import { Routes } from '@angular/router';
import { UserList } from './user-list';
import { UserService } from './user.service';

const usersResource = () => {
  const userService = inject(UserService);
  return resource({
    loader: () => userService.getUsers(),
  });
};

export const routes: Routes = [
  {
    path: 'users',
    component: UserList,
    resources: () => ({ users: usersResource() }),
  },
];

// user-list.ts
import { Component, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { User, UserService } from './user.service';

@Component({
  template: `
    @for (user of users(); track user.id) {
      <input #name [value]="user.name" />
      <button (click)="saveUser(user, name.value)">Save</button>
    }
  `,
})
export class UserList {
  readonly users = input.required<User[]>();
  private readonly userService = inject(UserService);
  private readonly usersResource =
    inject(ActivatedRoute).resources?.['users']!;

  async saveUser(user: User, name: string) {
    await this.userService.saveUser({ ...user, name });
    this.usersResource.reload();
  }
}
```

In the case of a blocking resource, since only the fetch result is passed to the input signal, the resource object is referenced from `ActivatedRoute.resources`. The list is re-fetched after waiting for the save to complete, and the change in the fetch result is reflected in the input signal as well. While the saving logic remains on the component side, there is no need to duplicate the list fetching logic.

In the case of a non-blocking resource, you can directly call `reload()` on the received resource. However, as of 22.2.0, a type corresponding to the resource with the `reload` method passed by the Router has not been made public. For now, it is probably best to prepare your own type as in the following example.

```typescript
// user-list.ts
import { Component, inject, input, Resource } from '@angular/core';
import { User, UserService } from './user.service';

type RouteResource<T> = Resource<T> & { reload(): boolean };

@Component({
  template: `
    @let res = usersResource();
    @if (res.isLoading()) {
      <p>Loading...</p>
    } @else if (res.error()) {
      <p>Failed to load users.</p>
    } @else if (res.value(); as users) {
      @for (user of users; track user.id) {
        <input #name [value]="user.name" />
        <button (click)="saveUser(user, name.value)">Save</button>
      }
    }
  `,
})
export class UserList {
  readonly usersResource = input.required<RouteResource<User[] | undefined>>();
  private readonly userService = inject(UserService);

  async saveUser(user: User, name: string) {
    await this.userService.saveUser({ ...user, name });
    this.usersResource().reload();
  }
}
```

### Reactive Data Fetching Based on Query Parameters

Consider updating search results on the same page when changing search criteria. Let the URL of the user search page be `/users?q=alice`, where the search term is stored in the query parameter `q`. When the search term changes, the URL becomes `/users?q=bob`, and search results are updated while continuing to use the same component. In this example, assume `UserService.searchUsers(q)` returns the search results as a `Promise<User[]>`.

Conventionally, the component would receive the query parameter as an input signal and hold a resource that uses it as the fetch condition.

```typescript
// user-search.ts
import { Component, inject, input, linkedSignal, resource } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { UserService } from './user.service';

@Component({
  imports: [RouterLink, FormField],
  template: `
    <input type="search" [formField]="searchForm.q" />
    <button [routerLink]="[]" [queryParams]="{ q: searchForm.q().value() }">Search</button>
    
    @let res = usersResource;
    @if (res.isLoading()) {
      <p>Loading...</p>
    } @else if (res.error()) {
      <p>Failed to load users.</p>
    } @else if (res.value(); as users) {
      @for (user of users; track user.id) {
        <p>{{ user.name }}</p>
      }
    }
  `,
})
export class UserSearch {
  readonly q = input<string>();
  readonly searchForm = form(linkedSignal(() => ({ q: this.q() ?? '' })));
  private readonly userService = inject(UserService);

  readonly usersResource = resource({
    params: () => this.q() ?? '',
    loader: ({ params: query }) =>
      this.userService.searchUsers(query),
  });
}

// app.routes.ts
import { Routes } from '@angular/router';
import { UserSearch } from './user-search';

export const routes: Routes = [
  { path: 'users', component: UserSearch },
];
```

With Router Resources, the search term is read from `ctx.queryParams()`, and the resource is wrapped with `nonBlocking()`. The update of query parameters does not wait for the search to complete, and the resource fetches data in response to changes in the search term.

```typescript
// app.routes.ts
import { computed, inject, resource } from '@angular/core';
import { nonBlocking, ResourceContext, Routes } from '@angular/router';
import { UserSearch } from './user-search';
import { UserService } from './user.service';

const usersResource = (ctx: ResourceContext) => {
  const userService = inject(UserService);
  const q = computed(() => (ctx.queryParams()['q'] as string | undefined) ?? '');
  return resource({
    params: () => q(),
    loader: ({ params: query }) =>
      userService.searchUsers(query),
  });
};

export const routes: Routes = [
  {
    path: 'users',
    component: UserSearch,
    resources: (ctx) => ({ usersResource: nonBlocking(usersResource(ctx)) }),
  },
];
```

The component receives the resource as an input signal and displays the fetch state and search results as before. The logic connecting search criteria to data fetching moves to the Router side, and the component no longer depends on the search service.

What's important here is that the resource uses **only the search term's `q` parameter as a fetch condition, not the entire set of query parameters**. It converts `q` into a Signal using `computed` before reading it in the `params` function. Even if other query parameters for toggling display methods change, as long as `q` remains the same, neither re-fetching nor re-rendering occurs. The benefit of Signals—fine-grained reactivity—can also be applied to changes in URL state.

```typescript
// user-search.ts
import { Component, input, linkedSignal, Resource } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { User } from './user.service';

@Component({
  imports: [RouterLink, FormField],
  template: `
    <input type="search" [formField]="searchForm.q" />
    <button [routerLink]="[]" [queryParams]="{ q: searchForm.q().value() }">Search</button>
    
    @let res = usersResource();
    @if (res.isLoading()) {
      <p>Loading...</p>
    } @else if (res.error()) {
      <p>Failed to load users.</p>
    } @else if (res.value(); as users) {
      @for (user of users; track user.id) {
        <p>{{ user.name }}</p>
      }
    }
  `,
})
export class UserSearch {
  readonly q = input<string>();
  readonly searchForm = form(linkedSignal(() => ({ q: this.q() ?? '' })));
  readonly usersResource = input.required<Resource<User[] | undefined>>();
}
```

### Data Fetching with `httpResource`

Not only `resource()`, but also resources created with `httpResource()` can be passed to Router Resources. When fetching user information via `GET /api/users/:id`, instead of writing a loader through a service, you can simply construct the request URL from the path parameter. `httpResource()` executes an HTTP request in response to changes in the Signal read by the function that returns the URL. In this example, when the ID changes, the user info is re-fetched.

```typescript
// app.routes.ts
import { httpResource } from '@angular/common/http';
import { computed } from '@angular/core';
import { nonBlocking, ResourceContext, Routes } from '@angular/router';
import { UserProfile } from './user-profile';
import { User } from './user.service';

const userResource = (ctx: ResourceContext) => {
  const id = computed(() => ctx.params()['id'] as string);
  return httpResource<User>(() => `/api/users/${encodeURIComponent(id())}`);
};

export const routes: Routes = [
  {
    path: 'users/:id',
    component: UserProfile,
    resources: (ctx) => ({ userResource: nonBlocking(userResource(ctx)) }),
  },
];
```

## Points to Consider

A point to consider when using Router Resources is the issue of type inference. While this has existed for some time, the resource name declared in the route configuration and the input name received by the component rely on **matching names**. Detecting mismatches with static type checking requires some ingenuity.

For example, consider a utility type like the following. Consolidate resource declaration types and functions in `user-profile.resources.ts`, and use `satisfies` to check for a match between resource names and types. Reference that function in the route configuration, and on the component side, import and implement `UserProfileResourceInputs` derived from the declaration side. With this, `satisfies` will cause an error if the resource declaration name is wrong, and `implements` will cause an error if you forget to declare `userResource` on the component side or use a different name or type. However, what can be checked is limited to the class property names and types; it cannot verify `alias` usage for inputs or the correctness of the mapping to the component specified in the route.

```typescript
// router-resource.types.ts
import type { InputSignal, Resource } from '@angular/core';

export type RouteResource<T> = Resource<T> & { reload(): boolean };

export type ResourceInputs<
  Blocking extends { [K in keyof Blocking]: Resource<unknown> },
  NonBlocking extends { [K in keyof NonBlocking]: Resource<unknown> },
> = {
  readonly [K in keyof Blocking]: InputSignal<ReturnType<Blocking[K]['value']>>;
} & {
  readonly [K in keyof NonBlocking]: InputSignal<NonBlocking[K]>;
};

// user-profile.resources.ts
import { inject, resource } from '@angular/core';
import { nonBlocking } from '@angular/router';
import type { ResourceContext } from '@angular/router';
import type { ResourceInputs, RouteResource } from './router-resource.types';
import { UserService } from './user.service';
import type { User } from './user.service';

export type UserResource = RouteResource<User | undefined>;

interface UserProfileBlockingResources {
  user: UserResource;
}

interface UserProfileNonBlockingResources {
  userResource: UserResource;
}

type UserProfileResources =
  UserProfileBlockingResources & UserProfileNonBlockingResources;

export type UserProfileResourceInputs = ResourceInputs<
  UserProfileBlockingResources,
  UserProfileNonBlockingResources
>;

const userResource = (ctx: ResourceContext) => {
  const userService = inject(UserService);
  return resource({
    params: () => ctx.params()['id'] as string,
    loader: ({ params: id }) => userService.getUser(id),
  });
};

export const userProfileResources = (ctx: ResourceContext) => ({
  user: userResource(ctx),
  userResource: nonBlocking(userResource(ctx)),
} satisfies UserProfileResources);

// app.routes.ts
import type { Routes } from '@angular/router';
import { UserProfile } from './user-profile';
import { userProfileResources } from './user-profile.resources';

export const routes: Routes = [
  {
    path: 'users/:id',
    component: UserProfile,
    resources: userProfileResources,
  },
];

// user-profile.ts
import { Component, input } from '@angular/core';
import type { UserProfileResourceInputs, UserResource } from './user-profile.resources';
import type { User } from './user.service';

@Component({
  template: `
    @if (user(); as user) {
      <p>ID: {{ user.id }}</p>
    }
    @let res = userResource();
    @if (res.isLoading()) {
      <p>Loading...</p>
    } @else if (res.error()) {
      <p>Failed to load user.</p>
    } @else if (res.value(); as user) {
      <h2>{{ user.name }}</h2>
    }
  `,
})
export class UserProfile implements UserProfileResourceInputs {
  readonly user = input.required<User | undefined>();
  readonly userResource = input.required<UserResource>();
}
```

## Summary

What I realized from thinking through actual use cases is that Router Resources allows you to move the concern about the data fetching path out of the component. It enables you to handle data and its fetch state, abstracted as a resource, without having knowledge of how it is being fetched.

Even as of 22.2.0, where it was implemented as a developer preview, there are already many benefits to replacing data resolvers, and it will likely become an essential element if you design applications based on Signals. While there are still areas where functionality is lacking, I believe that by actively using it and providing feedback, we can help refine the framework.

The sample code for this article is available on GitHub in a working format.

https://github.com/lacolaco/angular-router-resources-sandbox