---
title: 'Angular: Resource API Family Map'
slug: 'angular-resource-apis-system'
icon: ''
created_time: '2026-07-12T00:57:00.000Z'
last_edited_time: '2026-07-12T13:16:00.000Z'
tags:
  - 'Signals'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-resource-apis-system'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://app.notion.com/p/Angular-Resource-API-39a3521b014a80debcf4cc76adf1cce6'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: '7d87cf75c55ae620686f90e5a9a275c3c8dcee7d45b19920a7dd14836d34c5c7'
---

In this article, I will provide an overview of the Resource API family, which became stable in Angular v22, and explain the relationships between its members.

## Resource API Family

As of v22, the following are the primary public APIs included in the Resource API family:

- `Resource<T>` interface
- `WritableResource<T>` interface
- `ResourceSnapshot<T>` interface
- `resourceFromSnapshots` function
- `resource` function
- `httpResource` function

![image](/images/angular-resource-apis-system/CleanShot_2026-07-11_at_11.51.182x.fdf21ad17d3f63fd.png)

Let's verify the role of each within the family as we explain them one by one.

## `Resource<T>` Interface

This interface sits at the center of the API family. The Resource API family can be broadly divided into APIs that represent Resource objects and factory APIs for creating them. The `Resource<T>` interface is the base type common to all Resource objects and also serves as the return type for factory APIs.

https://angular.jp/api/core/Resource

```typescript
export interface Resource<T> {
  readonly value: Signal<T>;
  readonly status: Signal<ResourceStatus>;
  readonly error: Signal<Error | undefined>;
  readonly isLoading: Signal<boolean>;
  readonly snapshot: Signal<ResourceSnapshot<T>>;

  hasValue(this: T extends undefined ? this : never): this is Resource<Exclude<T, undefined>>;
  hasValue(): boolean;
}
```

As you can see, `Resource<T>` is read-only, and its responsibility is to return the value and status held by that Resource as a Signal. If an object adheres to this interface, it can be considered a Resource object. If you were writing code that takes a Resource object as an argument to perform some action, that argument would require the `Resource<T>` type.

## `WritableResource<T>` Interface

The `WritableResource<T>` interface is an extension of `Resource<T>`, with the key difference being that it supports writing. The `value` field is a `WritableSignal<T>` type, and it also provides `set` and `update` methods. It can be converted into a read-only `Resource<T>` using the `asReadonly` method. Additionally, the `reload` method re-executes the most recently performed resource resolution, which also updates the `value` internally. Ultimately, a `WritableResource<T>` allows the user to trigger value updates.

```typescript
export interface WritableResource<T> extends Resource<T> {
  readonly value: WritableSignal<T>;

  set(value: T): void;
  update(updater: (value: T) => T): void;
  asReadonly(): Resource<T>;
  reload(): boolean;
}
```

https://angular.jp/api/core/ResourceRef

![image](/images/angular-resource-apis-system/image.ff98702a7dff205e.png)

## `ResourceSnapshot<T>` Interface

The `ResourceSnapshot<T>` interface represents an immutable object that captures the internal state of a Resource object at a specific moment. Specifically, it consists of a `status` field indicating the value resolution state of the Resource, along with additional fields corresponding to each status. While a Resource is an object whose state changes asynchronously, that state always corresponds to one of these snapshot types, forming what is known as a **Discriminated Union**.

```typescript
export type ResourceSnapshot<T> =
  | {readonly status: 'idle'; readonly value: T}
  | {readonly status: 'loading' | 'reloading'; readonly value: T}
  | {readonly status: 'resolved' | 'local'; readonly value: T}
  | {readonly status: 'error'; readonly error: Error};
```

https://angular.jp/api/core/ResourceSnapshot

The `snapshot` field of `Resource<T>` exists to return the state at the time of the call as a `ResourceSnapshot<T>` object.

![image](/images/angular-resource-apis-system/image.7f6a2e84c7c8d5a2.png)

## `resourceFromSnapshots` Function

Since the states a `Resource<T>` can take are always extractable as a `ResourceSnapshot<T>`, it can be said that the continuous change of `ResourceSnapshot<T>` is the `Resource<T>` itself. In other words, a `Resource<T>` is essentially a `Signal<ResourceSnapshot<T>>`.

The `resourceFromSnapshots` function expresses this directly. It takes a function that returns a `ResourceSnapshot<T>` as an argument. If the argument is a `Signal<ResourceSnapshot<T>>`, it is subscribed to internally, and its values are automatically reflected in the state of the `Resource<T>`. Since the source is the source of truth for the state, the returned object is a read-only Resource object.

```typescript
function resourceFromSnapshots<T>(
  source: () => ResourceSnapshot<T>,
): Resource<T>;
```

https://angular.jp/api/core/resourceFromSnapshots

```typescript
  const source = signal<ResourceSnapshot<string>>({status: 'idle', value: ''});
  const res = resourceFromSnapshots(source);
  expect(res.status()).toEqual('idle');
  expect(res.value()).toEqual('');
  expect(res.isLoading()).toBeFalse();
  expect(res.hasValue()).toBeTrue();

  // Updating the snapshot
  source.set({status: 'loading', value: 'alpha'});
  expect(res.status()).toEqual('loading');
  expect(res.value()).toEqual('alpha');
  expect(res.isLoading()).toBeTrue();
  expect(res.hasValue()).toBeTrue();

```

You have complete freedom in how you create the source Signal—it can be a `signal` function, an `input` function, a `linkedSignal` function, or a `computed` function. As long as it ends up as a `Signal<ResourceSnapshot<T>>`, it's fine. If you want to create a Resource object tailored to a specific use case, this method is quite convenient. Of course, if one of the built-in factory APIs discussed later suffices, those are fine too.

![image](/images/angular-resource-apis-system/image.fde3b6c4bcd8bb56.png)

## `resource` Function

The `resource` function is a built-in Resource factory API. Unlike the `resourceFromSnapshots` function, it returns a writable Resource object based on declarative options. `ResourceRef<T>` is essentially the same as `WritableResource<T>`.

```typescript
function resource<T, R>(
  options: ResourceOptions<T, R> & { defaultValue: NoInfer<T> },
): ResourceRef<T>;
```

https://angular.jp/api/core/resource

I'll skip the details of the API usage since you can find them in the documentation, but broadly speaking, you can configure a Resource object in two ways. One is configuration via a Loader that returns a Promise, and the other is via a Loader that returns a Stream. By Stream, I mean a sequence of values, specifically a `Signal<ResourceStreamItem<T>>`. `ResourceStreamItem<T>` specifically refers to `{value: T} | {error: Error}`.

```typescript
const userId: Signal<string> = getUserId();

// Promise-based Loader
const userResource = resource({
  params: () => ({id: userId()}),
  loader: ({params}): Promise<User> => fetchUser(params),
});

// Signal-based Streaming Loader
const chunkedMessageResource = resource({
  params: () => ({id: messageId()}),
  stream: ({params}): Signal<ResourceStreamItem<string>> => {
    const message = signal<string>('');
    chunkedMessage(params).subscribe({
      next: (chunk) => {
        message.update(item => ({ value: item.value + chunk }));
      },
      error: (err) => message.set({ error: err }),
    });
  },
});
```

If your use case requires multiple value writes rather than a Promise model where resolution completes once, you can configure it with a Stream-based Loader. However, I think `resourceFromSnapshots` is generally more versatile and easier to use for this use case, and personally, I feel it wouldn't be surprising if the Stream-based option were eventually removed. Unless there is a specific reason, I think it is best to limit the use of the `resource` function to when you have a Promise-based Loader.

![image](/images/angular-resource-apis-system/image.bd16716569684d27.png)

## `httpResource` Function

The final one, the `httpResource` function, is a built-in Resource factory API like the `resource` function, but with a more specific purpose. As the name suggests, it is a factory for configuring a Resource that resolves its value via an HTTP request. It accepts a function to resolve a `url`, and you can obtain a response fetched internally using Angular's HttpClient as a Resource object. Since its purpose is clear, you likely won't have trouble deciding when to use it over other Resource factories.

```typescript
function httpResource<T>(
  url: (ctx: ResourceParamsContext) => string | undefined, 
  options: HttpResourceOptions<T, unknown> & { defaultValue: NoInfer<T>; }
): HttpResourceRef<T>;

const userId = signal<string>('id');
const user = httpResource(() => `/api/user/${userId()}`);
```

https://angular.jp/api/common/http/httpResource

The `HttpResourceRef<T>` interface adds HTTP-specific state to `WritableResource<T>`. Because the `value` is managed by `WritableResource<T>`, it is writable, but the response headers and status codes are read-only. Also, note that calling `asReadonly` turns it into a plain `Resource<T>`, causing the HTTP-specific information to be lost.

```typescript
export interface HttpResourceRef<T> extends WritableResource<T>, ResourceRef<T> {
  readonly headers: Signal<HttpHeaders | undefined>;
  readonly statusCode: Signal<number | undefined>;
  readonly progress: Signal<HttpProgressEvent | undefined>;
}
```

![image](/images/angular-resource-apis-system/image.d794691b3e377a98.png)

## Summary

![image](/images/angular-resource-apis-system/image.016a63cf56466503.png)

I have summarized the relationships between the major APIs introduced so far. Centering around `Resource<T>`, derived interfaces and corresponding factory functions are provided as built-ins. At the same time, the implementations for these interfaces are interchangeable. The built-in factory APIs are not special; they are designed in an open way so that you can create implementations specialized for individual use cases. By keeping these relationships in mind, I think you'll be able to master the Resource API effectively.