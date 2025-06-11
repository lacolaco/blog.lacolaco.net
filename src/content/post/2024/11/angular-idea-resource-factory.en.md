---
title: 'Angular implementation idea: Resource Factory '
slug: 'angular-idea-resource-factory.en'
icon: ''
created_time: '2024-11-16T01:24:00.000Z'
last_edited_time: '2024-11-16T01:26:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'dependency injection'
  - 'Signals'
published: true
locale: 'en'
notion_url: 'https://www.notion.so/Angular-implementation-idea-Resource-Factory-1403521b014a8021ba2ce240f1d439e8'
features:
  katex: false
  mermaid: false
  tweet: false
---

In this article, we will explore a practical implementation pattern for the experimental API `resource()` to be introduced in Angular v19. I would like to name this idea "Resource Factory".

## Remember AngularJS: `$resource`

https://docs.angularjs.org/api/ngResource/service/$resource

In the past, AngularJS's `$resource` API encapsulated connections to RESTful HTTP APIs. It created dedicated resource objects for each resource like `User`, through which asynchronous data was retrieved. I'd like to adopt this idea for the `resource()` in Angular v19 as well.

```javascript
var User = $resource('/users/:userId', { userId: '@id' });
User.get({ userId: 123 }).$promise.then(function (user) {
  user.abc = true;
  user.$save();
});
```

## Resource factory class

In this idea, I implement a “resource factory” class to encapsulate the creation of resource objects for specific domain models, as shown in the following `ProductResource`. The responsibility of this class is to bridge the gap between the ApiClient (which depends on details of asynchronous data retrieval methods such as `HttpClient` or `fetch`) and the components that use this data. It’s encapsulating **how is the data resolved**.

```ts
import { inject, Injectable, resource } from '@angular/core';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class ProductResource {
  readonly #api = inject(ApiClient);

  list() {
    return resource({
      loader: async ({ abortSignal }) => {
        return this.#api.fetchProducts({ abortSignal });
      },
    }).asReadonly();
  }

  get(getProductId: () => number) {
    return resource({
      request: () => getProductId(),
      loader: async ({ request: productId, abortSignal }) => {
        return this.#api.fetchProductById(productId, { abortSignal });
      },
    }).asReadonly();
  }
}
```

Without such a class, if components directly create resources, it would require complex processes in testing those components, such as setting up `HttpClient` and preparing test doubles for asynchronous data. To keep testability of components, they should be away from the detail of data fetching.

In the following simple example, a component uses the resource factory to fetch data based on their own state given by the parent component. By passing parameters as Signals, data refetching is automatically performed in response to state changes. When testing this component with mock data, you can replace the `ProductResource` class with a dummy through dependency injection and return a test resource object from the `get()` method.

```ts
import { Component, inject, input } from '@angular/core';
import { ProductResource } from './product-resource';

@Component({
  selector: 'app-product-viewer',
  standalone: true,
  template: `
    @if (product.value(); as value) {
      <p>Title: {{ value.title }}</p>
    } @else if (product.error(); ) {
      <p>load failed</p>
    } @else if(product.isLoading()) {
      <p>loading...</p>
    }
  `,
})
export class ProductViewer {
  readonly #productResource = inject(ProductResource);
  readonly productId = input.required<number>();
  readonly product = this.#productResource.get(this.productId);
}

test("show product data", async () => {
  TestBed.configureTestModule({
    imports: [ProductViewer],
    providers: [
      {
        provide: ProductResource,
        useValue: {
          get: /* mock implementation */
        }
      }
    ]
  });
})
```

In the following slightly more complex example, instead of having the component directly use the resource factory, it goes through a `ViewModel` class. This class has a one-to-one relationship with the corresponding component, and the component itself holds the instance provider. Therefore, the `ViewModel` class is created and destroyed in sync with the component's creation and destruction lifecycle.

In this `AppViewModel` class, the product selection state input by the user is maintained using `linkedSignal()`, but the selection state is initialized when the product list is updated. Such details of state management are encapsulated, and only read-only Signals and use case methods are exposed to the component. Even in this case, component testing becomes easy with a mock of the `ViewModel`, and testing the `ViewModel` itself is sufficient with a mock of the resource factory.

```ts
import { Component, computed, linkedSignal, Injectable, inject } from '@angular/core';
import { ProductViewer } from './product-viewer';
import { ProductResource } from './product-resource';

@Injectable()
export class AppViewModel {
  readonly #productResource = inject(ProductResource);

  readonly #products = this.#productResource.list();
  readonly #selectedProductId = linkedSignal({
    source: () => this.#products.value(),
    computation: (value) => value?.products[0]?.id ?? 0,
  });

  readonly products = computed(() => this.#products.value()?.products);
  readonly selectedProductId = this.#selectedProductId.asReadonly();

  selectProduct(id: number) {
    this.#selectedProductId.set(id);
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProductViewer],
  providers: [AppViewModel],
  template: `
    @if (vm.selectedProductId(); as productId) {
      <app-product-viewer [productId]="productId" />
    }

    @if (vm.products(); as products) {
      <select #productSelector (change)="selectProduct(productSelector.value)">
        @for (product of products; track product.id) {
          <option [value]="product.id">{{ product.title }}</option>
        }
      </select>
    }
  `,
})
export class App {
  readonly vm = inject(AppViewModel);

  selectProduct(id: string) {
    this.vm.selectProduct(Number(id));
  }
}
```

That’s all. Simply put, this idea is a rule to **avoid components directly using resources**. What components want is **using** data by `resource()`, not **creating** resources and handling asynchronous communication concerns. By extracting the responsibility and ensuring that components are strictly **consumers of resources**, wouldn't we be able to maintain dependency relationships in a way that's easier to test? I'm excited to start implementing and testing this idea. If you have any feedback, please let me know anytime on [bluesky](https://bsky.app/profile/lacolaco.bsky.social).

https://stackblitz.com/edit/stackblitz-starters-hzk4qx?ctl=1&embed=1&file=src%2Fproduct-resource.ts
