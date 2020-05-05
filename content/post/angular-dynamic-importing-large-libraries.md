---
title: "Angular: Dynamic Importing Large Libraries"
date: "2019-03-06T08:38:54.266Z"
tags: [angular, code-splitting, performance, webpack]
---

This post explains how to import large 3rd-party libraries into your Angular application without pain on initial payload size.

### Example: Chart.js in Angular

[Chart.js](https://www.chartjs.org/) is a popular library to render rich charts. It contains a lot of features and its payload size is huge.

To use it in your Angular application, typically you write a `import` statement in TypeScript code and call it like the below;

```ts
import { Component, ViewChild, ElementRef } from "@angular/core";

// Import 'chart.js' package
import * as Chart from "chart.js";

@Component({
  selector: "app-root",
  template: `
    <div>
      <canvas #chart></canvas>
    </div>
  `
})
export class AppComponent {
  @ViewChild("chart") chartElement: ElementRef<HTMLCanvasElement>;

  ngOnInit() {
    new Chart(this.chartElement.nativeElement, {
      /** chart configurations */
    });
  }
}
```

As you can expect easily, this import makes `main.bundle.js` large. Increasing the initial payload size is one of what we want most to avoid.

![Build result](/img/angular-dynamic-importing-large-libraries/1__P7kR4JOftK2sOO43PCSLdw.png)

![Chart.js: ~500KB](/img/angular-dynamic-importing-large-libraries/1__bdvPHFVhblVx3JsiGjxTwQ.png)

Chart.js: ~500KB

### Use import()

`import()` is a new feature of ECMAScript. It loads a script dynamically in runtime. In the future, all modern browsers support it natively. But today, its support is not enough.

[Can I use… JavaScript modules: dynamic import()](https://caniuse.com/#feat=es6-module-dynamic-import)

**No problem, webpack helps us**. webpack can replace`import()` calls with its own dynamic module loading function in the bundling flow. You can imagine it just like a polyfill.

[webpack: Dynamic Imports](https://webpack.js.org/guides/code-splitting#dynamic-imports)

Because Angular CLI uses webpack, we can use it, even in Angular CLI-based applications. **There is no “_eject”_**. Don’t worry! :)

#### Preparation: Edit tsconfig.json

Also, TypeScript has support for dynamic `import()` , but it is enabled only in some module types. Open `tsconfig.json` at the root directory and set its `module` field to `esnext` . It doesn’t affect the final bundle’s browser compatibility because all module resolutions are solved by webpack behind of Angular CLI.

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": "./",
    "outDir": "./dist/out-tsc",
    "sourceMap": true,
    "declaration": false,
    "module": "esnext",
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "es5",
    "typeRoots": ["node_modules/@types"],
    "lib": ["es2018", "dom"]
  }
}
```

#### Migrate to dynamic `import()`

Call `import()` in the TypeScript code simply like following. That’s all…

```ts
import { normalizeCommonJSImport } from '../utils/normalizeCommonJSImport';

// import() returns a Promise
const importChart = normalizeCommonJSImport(
  import(/* webpackChunkName: "chart" */ 'chart.js'),
);**

@Component({ ... })
export class AppComponent {
  @ViewChild('chart') chartElement: ElementRef<HTMLCanvasElement>;

 async ngOnInit() {
    // Wait for dynamic import resolution
    const Chart = await importChart;

    new Chart(this.chartElement.nativeElement, {
      /** chart configurations */
    });
  }
}
```

`normalizeCommonJSImport` is a utility function for **compatibility between CommonJS module and ES modules** and for **strict-typing.**

```ts
export function normalizeCommonJSImport<T>(
  importPromise: Promise<T>
): Promise<T> {
  // CommonJS's `module.exports` is wrapped as `default` in ESModule.
  return importPromise.then((m: any) => (m.default || m) as T);
}
```

For details about module compatibility, please read this.

[**webpack 4: import() and CommonJs**](https://medium.com/webpack/webpack-4-import-and-commonjs-d619d626b655)

In this case, TypeScript’s `import()` returns `Promise<typeof Chart>` as well as `import * as Chart from ‘chart.js’`. This is a problem because `chart.js` is a CommonJS module. Without any helpers,`default` doesn’t exist in the result of `import()` . So we have to mark it as `any` temporary and remark `default` as the original type. This is a small hack for correct typing.

As the result, you can see separated bundles like below. `chart.<hash>.js` is not marked as **\[initial\]**; it means this bundle is loaded lazily and doesn’t affect initial bootstrapping.

![Build result](/img/angular-dynamic-importing-large-libraries/1__FY__MPUG__xp4BXeWVfZaTXg.png)

Dynamic loading in the browser
![Dynamic loading in the browser](/img/angular-dynamic-importing-large-libraries/1__aKkqoplA1K2wEBuhfBCBpQ.png)

### Conclusion

- Static importing large libraries brings big pain for initial bootstrapping performance.
- Dynamic importing will come to modern browsers in the future, and we can use it today with webpack’s help.
- There are some issues which we have to care about around CommonJS-ESModules compatibility.

The full code example is here. Thanks.

[**lacolaco/angular-chartjs-dynamic-import**](https://github.com/lacolaco/angular-chartjs-dynamic-import)
