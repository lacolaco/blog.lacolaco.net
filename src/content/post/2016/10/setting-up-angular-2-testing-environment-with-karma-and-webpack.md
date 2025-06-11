---
title: 'Setting up Angular Testing Environment with Karma and webpack'
slug: 'setting-up-angular-2-testing-environment-with-karma-and-webpack'
icon: ''
created_time: '2016-10-25T00:00:00.000Z'
last_edited_time: '2023-12-30T10:11:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Testing'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Setting-up-Angular-Testing-Environment-with-Karma-and-webpack-ba94cfed9b6441d3862b55c25fe0cea7'
features:
  katex: false
  mermaid: false
  tweet: false
---

This article will explain how to create an environment for Angular 2 testing. It uses [Karma](https://karma-runner.github.io/1.0/index.html), [webpack](http://webpack.js.org/) and some useful stuffs. And it focuses on simplicity and ease to use. Let’s understand it step by step.

## Create an Application (no tests)

```
> npm init -y
> npm i -S @angular/{core,common,compiler,platform-browser,platform-browser-dynamic} rxjs zone.js core-js
> npm i -D typescript webpack@~2.1.0-beta awesome-typescript-loader angular2-template-loader raw-loader node-static @types/node
> $(npm bin)/tsc --init
> touch webpack.config.js index.html
> mkdir src
> touch src/main.ts src/app.module.ts src/app.component.ts src/app.component.html
```

app.component.ts:

```
import { Component } from "@angular/core";
@Component({
  selector: "my-app",
  templateUrl: "app.component.html"
})
export class AppComponent {}
```

app.module.ts:

```
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { AppComponent } from "./app.component";
@NgModule({
  imports: [BrowserModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

main.ts:

```
import "core-js";
import "zone.js/dist/zone";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { AppModule } from "./app.module";
platformBrowserDynamic().bootstrapModule(AppModule);
```

tsconfig.json:

```json
{
  "compilerOptions": {
    "module": "es2015",
    "target": "es5",
    "noImplicitAny": false,
    "sourceMap": true,
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "lib": ["es2015", "dom"],
    "types": ["node"]
  },
  "awesomeTypeScriptLoaderOptions": {
    "useWebpackText": true
  }
}
```

webpack.config.js:

```
module.exports = () => {
  return {
    entry: {
      main: "./src/main.ts"
    },
    output: {
      path: "./dist",
      filename: "[name].bundle.js"
    },
    resolve: {
      extensions: [".js", ".ts", ".html"]
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loaders: ["awesome-typescript-loader", "angular2-template-loader"]
        },
        {
          test: /\.html$/,
          loader: "raw"
        }
      ]
    },
    devtool: "inline-source-map"
  };
};
```

package.json (scripts only):

```json
"scripts": {
    "build": "webpack",
    "start": "static ."
},
```

Yay, We’ve created an awesome application quickly.

## Setting up Karma runner

To make testing environment, we have to set up Karma test runner at first. Follow the command below:

```
> npm i -D karma jasmine
> $(npm bin)/karma init
```

This is the starting point of karma.config.js

```
module.exports = function(config) {
  config.set({
    basePath: "",
    frameworks: ["jasmine"],
    files: [],
    exclude: [],
    preprocessors: {},
    reporters: ["progress"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ["Chrome"],
    singleRun: true,
    concurrency: Infinity
  });
};
```

## Add test file

First step, let’s make a test file and add it into karma runner. Create test/main.js as following:

```
describe("Meaningful Test", () => {
  it("1 + 1 => 2", () => {
    expect(1 + 1).toBe(2);
  });
});
```

And update files property in karma configuration:

```
files: [
  { pattern: 'test/main.js' }
],
```

At last, add “test” npm-script in package.json:

```json
"scripts": {
    "build": "webpack",
    "start": "static .",
    "test": "karma start"
},
```

Let’s execute “npm test” command.

![image](/images/setting-up-angular-2-testing-environment-with-karma-and-webpack/npm_test.png)

Okey! Setting up karma runner is done! Let’s go to next step.

## Use modules and karma-webpack

Now, our test is only one file. So after now, all tests have to be written in test/main.js or add new file into karma configuration every times… Really?

No! Don’t worry, guys. We can separate tests as modules and bundle it to the single test file. No updates on karma configuration by per test.

Let’s get it started. Install karma-webpack and karma-sourcemap-loader at first:

```
> npm i -D karma-webpack karma-sourcemap-loader
```

And then, update our karma.config.js. Look at **preprocessors** and **webpack** property. `webpack` preprocessor executes webpack bundling using `test/main.js` as an entry point. And `webpack` property is an configuration for the bundling.

```
module.exports = function(config) {
  config.set({
    basePath: "",
    frameworks: ["jasmine"],
    files: [{ pattern: "test/main.js", watched: false }],
    exclude: [],
    preprocessors: {
      "test/main.js": ["webpack"]
    },
    webpack: require("./webpack.config")({ env: "test" }),
    reporters: ["progress"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ["Chrome"],
    singleRun: true,
    concurrency: Infinity
  });
};
```

Execute “npm test” again and see logs.

```
> karma start
webpack: wait until bundle finished:
Hash: 1130517a944241558f1f
Version: webpack 2.1.0-beta.25
Time: 3069ms
Asset     Size  Chunks             Chunk Names
main  2.19 MB       0  [emitted]  main
test/main.js  6.55 kB       1  [emitted]  test/main.js
chunk    {0} main (main) 1.77 MB [entry] [rendered]
[0] ./~/core-js/modules/_export.js 1.6 kB {0} [built]
[1] ./~/@angular/core/index.js 355 bytes {0} [built]
...
```

webpack runs! karma-webpack is a very easy way to integrate Karma and webpack. So now, let’s make the second test in **test/sub.js**:

```
describe("sub test", () => {
  it("always fails", () => {
    expect(0).toBe(1);
  });
});
```

And import that in test/main.js:

```
describe("Meaningful Test", () => {
  it("1 + 1 => 2", () => {
    expect(1 + 1).toBe(2);
  });
});
import "./sub";
```

test/sub.js contains the test fails always. In this state, try to run test once.

```
Chrome 54.0.2840 (Mac OS X 10.11.6) sub test always fails FAILED
Expected 0 to be 1.
at Object.it (test/main.js:74:19)
Chrome 54.0.2840 (Mac OS X 10.11.6): Executed 2 of 2 (1 FAILED) (0.045 secs / 0.014 secs)
```

As you can see, the test failed. It’s expected totally. But there is an important thing. Can you notice a weird information in that error logs?

Yes, it’s a stack trace. Despite we wrote failing test at test/sub.js, that error is logged as `at Object.it (test/main.js:74:19)`. It’s because of webpack bundling. That stack trace, `(test/main.js:74:19)`, points at the line of the bundled file. It needs **sourcemap** information to show stack traces as we expect.

Install **karma-sourcemap-loader**, which is a preprocessor for loading sourcemap into karma.

```
> npm i -D karma-sourcemap-loader
```

Next, update karma.config.js to add “sourcemap” into preprocessors.

```
preprocessors: {
    'test/main.js': ['webpack', 'sourcemap']
},
```

It’s ready! Let’s fail our test again and see error logs.

```
Chrome 54.0.2840 (Mac OS X 10.11.6) sub test always fails FAILED
Expected 0 to be 1.
at Object.it (webpack:///test/sub.js:3:0 <- test/main.js:74:19)
Chrome 54.0.2840 (Mac OS X 10.11.6): Executed 2 of 2 (1 FAILED) (0.03 secs / 0.007 secs)
```

Woohoo! That’s a perfect stack trace. We’ve got an environment to execute karma tests with webpack. But this is a starting point. Next step is setting up **Angular testing**.

## Setting up Angular Testing

Currently we have the entry point for testing bundle but it’s a JavaScript file. Let’s create **src/main.spec.ts** and update **test/main.js** to import it. (no longer use test/sub.js).

src/main.spec.ts:

```
describe("main test", () => {
  it("always fails", () => {
    expect(0).toBe(1);
  });
});
```

test/main.js:

```
require("../src/main.spec.ts");
```

And install type definitions of Jasmine and add it into `types` property of tsconfig.json.

```
> npm i -D @types/jasmine
```

tsconfig.json:

```json
{
  "compilerOptions": {
    "module": "es2015",
    "target": "es5",
    "noImplicitAny": false,
    "sourceMap": true,
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "lib": ["es2015", "dom"],
    "types": ["node", "jasmine"]
  },
  "awesomeTypeScriptLoaderOptions": {
    "useWebpackText": true
  }
}
```

Run tests. As below, sourcemap is working well even if tests are written in TypeScript.

```
Chrome 54.0.2840 (Mac OS X 10.11.6) main test always fails FAILED
Expected 0 to be 1.
at Object.<anonymous> (webpack:///src/main.spec.ts:3:18 <- test/main.js:74:19)
Chrome 54.0.2840 (Mac OS X 10.11.6): Executed 1 of 1 (1 FAILED) ERROR (0.034 secs / 0.006 secs)
```

## Initializing Angular TestBed

Angular testing uses **TestBed**. We have to initialize it at the first of the test runner. In addition, importing **polyfills** and **zone.js** is needed.

Update **src/main.spec.ts** as following:

```
import "core-js"; // ES6 + reflect-metadata
// zone.js
import "zone.js/dist/zone";
import "zone.js/dist/proxy";
import "zone.js/dist/sync-test";
import "zone.js/dist/async-test";
import "zone.js/dist/jasmine-patch";
// TestBed initialization
import { TestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from "@angular/platform-browser-dynamic/testing";
TestBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
```

All preparing was completely ended! At the beginning, let’s make a pipe and its spec.

src/echo.pipe.ts;

```
import { Pipe, PipeTransform } from "@angular/core";
@Pipe({
  name: "echo"
})
export class EchoPipe implements PipeTransform {
  transform(value: any): any {
    return value;
  }
}
```

src/echo.pipe.spec.ts

```
import { Component } from "@angular/core";
import { TestBed, async } from "@angular/core/testing";
import { EchoPipe } from "./echo.pipe";
@Component({
  selector: "test",
  template: `
    <p>{{ text | echo }}</p>
  `
})
class TestComponent {
  text: string;
}
describe("EchoPipe", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TestComponent, EchoPipe]
    });
  });
  beforeEach(async(() => {
    TestBed.compileComponents();
  }));
  it("works well", async(() => {
    const fixture = TestBed.createComponent(TestComponent);
    fixture.componentInstance.text = "foo";
    fixture.detectChanges();
    const el = fixture.debugElement.nativeElement as HTMLElement;
    expect(el.querySelector("p").textContent).toBe("foo");
  }));
});
```

At last, load that spec from src/main.spec.ts. **require.context** is very useful utility of webpack that can load all modules in directory recursively.

```
// TestBed initialization
// ...
// load all specs in ./src
const context = (require as any).context("./", true, /\.spec\.ts$/);
context.keys().map(context);
```

## More things

[Official documentation for testing](https://angular.io/docs/ts/latest/guide/testing.html) is a very good article. You can trying it with the testing environment which we’ve created here.

## Conclusion

- **karma-webpack** and sourcemap are awesome.
- Create a testing entry point and initialize **TestBed**
- Write tests!

Source code in this article is at [GitHub](https://github.com/laco0416/ng2-test-seed)
