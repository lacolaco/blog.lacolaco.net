---
title: Enjoyable WebWorkers in Angular
date: "2018-12-22T06:39:05.976Z"
tags: [angular, webworker, comlink]
---

WebWorkers have attracted the attention as one of the most important things of web development in the near future. But today, it still has some problems. Especially, developer experience is not good. How to separate code, how to communicate with it, and how to deploy it… it’s not fun.

[**Comlink**](https://github.com/GoogleChromeLabs/comlink) is a JavaScript library created by Google Chrome team to **make WebWorkers enjoyable**. It provides an easy way to communicate with classes defined in Worker-side.

This post explains how to integrate Comlink with your Angular application that created by Angular CLI. After read it, you will be able to create WebWorker script easily and separate application codes into that. Let’s get started!

#### 🚨️Caveat🚨

All contents of this article are completely just for experiment. I don’t recommend you to adopt these in production. Enjoy!

### [Update for After Angular CLI v8.3]

Angular CLI v8.3 supports Web Worker module as a built-in feature! So we no longer need extra webpack configuration for Web Worker.

See the update commit for detail:

https://github.com/lacolaco/angular-comlink-example/pull/7

### Setting up an application

An example application is simple. [Install Angular CLI](https://angular.io/guide/quickstart#install-cli) if you still have it.

After installation, run the command to create a new application with minimal configuration. A minimal application doesn’t has files for testing. And just hit Enter key twice. No routing, and using CSS.

```
$ **ng new angular-comlink-example --minimal**
? Would you like to add Angular routing? **No**
? Which stylesheet format would you like to use? **CSS**
```

#### Setting up worker-plugin

Then, install **WorkerPlugin**, which is a webpack plugin to split code for workers.

https://github.com/GoogleChromeLabs/worker-plugin

```
$ yarn add --dev worker-plugin
```

And install `**ngx-build-plus**` to use WorkerPlugin in Angular CLI’s build process. It allows us extend CLI’s webpack configuration without ejection!

https://github.com/manfredsteyer/ngx-build-plus

```
$ ng add ngx-build-plus
```

To enable WorkerPlugin, create new `webpack.extra.js` file at the project root dir.

```js
// webpack.extra.js
const WorkerPlugin = require("worker-plugin");

module.exports = {
  plugins: [
    new WorkerPlugin({
      plugins: ["AngularCompilerPlugin"]
    })
  ]
};
```

At last, update the build task to load the extra configuration. There are two ways. One is via command line argument; `--extraWebpackConfig` .

![npm scripts](/img/enjoyable-webworkers-in-angular/1__1OO4AbaMTx6JPB__cSNBsSQ.png)

Another option is via `angular.json` setting; `extraWebpackConfig` .

![](/img/enjoyable-webworkers-in-angular/1__w8R4aJw9D7BLzfzw2MwsIg.png)

That’s all! Now, your Angular CLI project can build WebWorker script with code splitting. Let’s go next step.

### Use Comlink

Install Comlink as the below. Comlink has its own TypeScript definition in the package, so you don’t need additional installation.

```
$ yarn add comlinkjs
```

#### Example: Markdown processor

For example, let’s make a markdown processor with Comlink. It can convert markdown text to HTML.

At first, create a class file named `markdown.ts` in `src/app/worker` directory. To create it, `ng generate` command is useful. This file will be the entry point of the worker’s bundle.

```
$ ng generate class worker/markdown
```

To handle markdown, please install `marked` and `@types/marked`.

```
yarn add marked && yarn add --dev @types/marked
```

Then, implement `markdown.ts` as following. It’s simple code to compile markdown to HTML with marked.

```ts
import * as marked from "marked";

export class Markdown {
  compile(source: string) {
    return new Promise<string>((resolve, reject) => {
      marked(source, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }
}
```

To expose the class to outside the worker, call `expose` function as the below.

```ts
import * as marked from "marked";
import { expose } from "comlinkjs";

export class Markdown {
  compile(source: string) {
    return new Promise<string>((resolve, reject) => {
      marked(source, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }
}
```

**expose(Markdown, self);**

That’s all to implement Worker-side code. Just declare a class and expose it. Ain’t easy?

#### Call the class through comlink’s proxy

Next step. Let’s call the `Markdown` class through Comlink. It’s not static reference, but you can take all benefits of TypeScript and WebWorker.

At first, create `MarkdownService` as Angular service to separate business logic from component. Execute following command;

```
$ ng generate service service/markdown
```

And here is an initial implementation.

```ts
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root"
})
export class MarkdownService {
  async compile(source: string): Promise<string> {}
}
```

To use `worker/markdown.ts` , import Comlink and create a **proxy** instance with `proxy` function as the below. `import('../worker/markdown).Markdown` may look tricky. This `import` is not ES Module import but TypeScript’s feature that **import only type definition** without any JavaScript references. So, this static link will be eliminated in TypeScript compilation process and it can be separated to different bundles. And One more tricky TypeScript code; `(Worker as any)` . It is necessary to use the 2nd argument of `new Worker()` .

```ts
import { proxy } from "comlinkjs";

const MarkdownWorker = proxy<typeof import("../worker/markdown").Markdown>(
  new (Worker as any)("../worker/markdown", { type: "module" })
);
```

The returned `MarkdownWorker` is a class constructor. To use its functionality, create its instance by `new MarkdownWorker()` . But it doesn’t return the same instance of `Markdown` but its **promisified** version. Look at the code. The construction returns Promise of the instance, so you need to **await** it. This is the Comlink’s interface. All from worker-side are promisified.

```ts
export class MarkdownService {
  async compile(source: string): Promise<string> {
    const worker = await new MarkdownWorker();
    return worker.compile(source);
  }
}
```

If you use a TypeScript-friendly editor, you can find out its autocompletion can suggest `worker.compile` with the correct type definition. Comlink is TypeScript friendly. That is why I’m loving this.


![compile() has its correct type!](/img/enjoyable-webworkers-in-angular/1__q6CHXNfdND52qegowHHplA.png)

`compile()` has its correct type!

#### Run the app!

To see the work of Comlink and WorkerPlugin, finish the application. Here is `AppComponent` modified to use `MarkdownService` and show the result.

```ts
import { MarkdownService } from "./service/markdown.service";
import { Component } from "@angular/core";

@Component({
  selector: "app-root",
  template: `
    <button (click)="compileMarkdown()">compile</button>

    <div>{{ result }}</div>
  `
})
export class AppComponent {
  result: string = "";

  constructor(private markdown: MarkdownService) {}

  async compileMarkdown() {
    this.result = await this.markdown.compile(`## Hello Comlink`);
  }
}
```

Let’s serve the app by using`ng serve` and open browser’s devtool. `0.worker.js` is a chunk that is split by WorkerPlugin. It is loaded lazily after initial scripts are all loaded. It doesn’t block the initial rendering. Cool!

![Running](/img/enjoyable-webworkers-in-angular/1__WghqP__ww8aX6KVZVQNzmeA.gif)

You can load the worker script any time. If you call `proxy` in the `compile` method, the script will be loaded on-demand. Here is an example.

```ts
export class MarkdownService {
  async compile(source: string): Promise<string> {
    // proxy in method
    const MarkdownWorker = proxy<typeof import("../worker/markdown").Markdown>(
      new (Worker as any)("../worker/markdown", { type: "module" })
    );

    const worker = await new MarkdownWorker();
    return worker.compile(source);
  }
}
```

Load script on-demand
![Load script on-demand](/img/enjoyable-webworkers-in-angular/1__E1O4TCG0BWjF1OLEJ5v2Kw.gif)

### Summary

- Setting up WorkerPlugin with ngx-build-plus
- A single class can be a worker with Comlink
- TypeScript + Comlink is cool!!

All sample code is public in GitHub.

https://github.com/lacolaco/angular-comlink-example

Any feedback is welcome. Thanks for reading!!
