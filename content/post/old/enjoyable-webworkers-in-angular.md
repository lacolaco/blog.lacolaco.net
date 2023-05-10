---
title: Enjoyable WebWorkers in Angular
date: '2018-12-22T06:39:05.976Z'
updated_at: '2021-05-26T11:13:01+0900'
tags: [english, angular, webworker, comlink, webpack, off-the-main-thread]
---

[Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) have attracted the attention as one of the most important things of web development. [**Comlink**](https://github.com/GoogleChromeLabs/comlink) is a JavaScript library created by Google Chrome team to **make WebWorkers enjoyable**. It provides an easy way to communicate with classes defined in Worker-side.

This post explains how to integrate Comlink with your Angular application that created by Angular CLI. By using Comlink, You will be able to move away heavy processing **off-the-main-thread** easily and make JavaScript bundles smaller by **code separation**. Let’s get started!

### [Change from Angular CLI v12.0]

- Syntax for worker module was updated since webpack v5. CLI v12 can migrate automatically by executing `ng update @angular/cli@12`.

![](/img/enjoyable-webworkers-in-angular/2021-05-26T11-16-04.png)
![](/img/enjoyable-webworkers-in-angular/2021-05-26T11-20-53.png)

### Setting up an application

Create an example application by using [Angular CLI](https://angular.io/guide/quickstart#install-cli). 

```shell
$ ng new angular-comlink-example --defaults
```

After application setup, install Comlink as the below. Comlink has its own TypeScript definition in the package, so you don’t need additional installation.

```shell
$ cd angular-comlink-example
$ yarn add comlink # or npm install comlink
```

### Implement worker module

For example, let’s make a markdown processor which can convert markdown text to HTML.
At first, install `marked` and `@types/marked` to compile markdown to HTML.

```shell
yarn add marked && yarn add --dev @types/marked
```

Next, create `src/tsconfig.worker.json` for the application project. Its location is next to `tsconfig.app.json`.

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/worker",
    "lib": [
      "es2018",
      "webworker"
    ],
    "types": []
  },
  "include": [
    "**/*.worker.ts"
  ]
}
```

Create a file named `markdown.worker.ts` in `src/app/worker` directory and write a function as the below. This file will be the entry point of the worker module.

```shell
$ touch src/app/worker/markdown.worker.ts
```

```ts
// worker/markdown.worker.ts
import * as marked from 'marked';

export const api = {
  compileMarkdown(source: string) {
    return new Promise<string>((resolve, reject) => {
      marked(source, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  },
};
```

To expose that functions as the worker, call `Comlink.expose` function and pass the `api` object.

```ts
import * as marked from 'marked';
import { expose } from 'comlink';

export const api = {
  compileMarkdown(source: string) {
    // ...
  },
};

expose(api); // Expose as worker's API
```

That’s all to implement Worker-side code. Just write a function and expose it. Ain’t easy?

### Use the exposed worker APIs

Next step. Let’s call the `compileMarkdown` function through Comlink.
At first, create `MarkdownService` as Angular service to separate business logic from component. Execute following command;

```
$ ng generate service service/markdown
```

And here is an initial implementation.

```ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MarkdownService {
  async compile(source: string): Promise<string> {}
}
```

To use `worker/markdown.worker.ts` , import Comlink and create a proxied worker instance with `wrap` function as the below. A module worker instance is instanciated by `new Worker(new URL('../worker/markdown.worker', import.meta.url)`. This syntax is defined by [webpack's Web Workers support](https://webpack.js.org/guides/web-workers/).

```ts
import { wrap } from 'comlink';

async function compileMarkdown(source: string): Promise<string> {
  const worker = wrap<typeof import('../worker/markdown.worker').api>(
    new Worker(new URL('../worker/markdown.worker', import.meta.url)),
  );
  return await worker.compileMarkdown(source);
}
```

Now `worker` instance has functions exposed by `Comlink.expose` with its types.

To retrieve type of `api`, pass `typeof import('../worker/markdown.worker).api` into `wrap<T>`. This `import` is not ES Module import but TypeScript’s feature that **import only type definition** without any JavaScript references which will be eliminated after TypeScript compilation process and it can be separated to different bundles.

The following is the final example of `service/markdown.service.ts`. If the environment doesn't support `window.Worker`, it will fallback to on-the-main theaed processing with dynamic `import()` to keep the initial bundle small.

```ts
import { Injectable } from '@angular/core';
import { wrap } from 'comlink';

async function compileMarkdown(source: string): Promise<string> {
  if (window.Worker) {
    const worker = wrap<typeof import('../worker/markdown.worker').api>(
      new Worker(new URL('../worker/markdown.worker', import.meta.url)),
    );
    return await worker.compileMarkdown(source);
  } else {
    // Fallback to main thread with dynamic imports
    const worker = await import('../worker/markdown.worker').then((m) => m.api);
    return await worker.compileMarkdown(source);
  }
}

@Injectable({
  providedIn: 'root',
})
export class MarkdownService {
  async compile(source: string): Promise<string> {
    return await compileMarkdown(source);
  }
}
```

#### Run the app!

Finish the application. Here is `AppComponent` modified to use `MarkdownService` and show the result.

```ts
import { MarkdownService } from './service/markdown.service';
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <button (click)="compileMarkdown()">compile</button>

    <div>{{ result }}</div>
  `,
})
export class AppComponent {
  result: string = '';

  constructor(private markdown: MarkdownService) {}

  async compileMarkdown() {
    this.result = await this.markdown.compile(`## Hello Comlink`);
  }
}
```

Let’s serve the app by using`ng serve` and open browser’s devtool. `0.worker.js` is a chunk that is split by WorkerPlugin. It is loaded lazily after initial scripts are all loaded. It doesn’t block the initial rendering. Cool!

![Running](/img/enjoyable-webworkers-in-angular/1__WghqP__ww8aX6KVZVQNzmeA.gif)

### Summary

- Use Comlink to define worker and expose async APIs.
- Angular CLI supports worker code separation with zero-config.
- TypeScript support from Comlink perfectly.

All sample code is public in GitHub.

https://github.com/lacolaco/angular-comlink-example

Any feedback is welcome. Thanks for reading!!
