---
title: Try Angular 2 AoT compilation
date: "2016-10-05T15:31:47.067Z"
tags: [angular, aot, angular-cli]
---

with Angular-CLI

![AngularConnect 2016 Keynote](/img/try-angular-2-aot-compilation/1__2HGmglBA6b78AoREpWpULw.png)

Ahead-of-Time(AoT) compilation is a key feature of Angular 2. It bring us big performance and small payload size. Let’s try it easily. It’s good news, **Angular-CLI** started AoT support **experimentally!**

#### Install CLI

Type a command to install angular-cli package in global

```sh
> npm install -g angular-cli
```

After installation, check the version.

```sh
> ng version
angular-cli: 1.0.0-beta.16
node: 6.7.0
os: darwin x64
```

#### Create a project

Create new project with CLI

```sh
> ng new example-app
```

It takes a long long time. Be patient…

After that, move to the generated directory.

```sh
> cd example-app
```

#### Build in JiT mode

At first, let’s build the project in JiT mode. Type a command:

```sh
> ng build
```

Built files will be in `dist` directory.

#### Explore the bundle

Let’s explore and measure the bundled file. Install a tool from npm:

```sh
> npm install -g source-map-explorer
```

And use source-map-explorer for the bundle and source map

```sh
> source-map-explorer dist/main.bundle.js dist/main.map
```

Web browser opens automatically and show a graph telling items of the bundle!

![JiT bundle](/img/try-angular-2-aot-compilation/1__kV__ewHL8x4Y__7DGLrMnHzg.png)

Awesome! Now we can see that `@angular/compiler` is the largest module. In JiT mode, all Angular applications require the compiler at runtime. In AoT mode, it doesn’t. Let’s make it sure.

#### Build in AoT mode

**Note: Angular-CLI AoT support is really experimental yet.**

To build with AoT, use `— aot` option.

```sh
> ng build --aot
```

And explore the bundle again.

```sh
> source-map-explorer dist/main.bundle.js dist/main.map
```

![AoT bundle](/img/try-angular-2-aot-compilation/1__vrqivZOWelOyCHeYfS__Wgw.png)

Yeeeeeah! We removed `@angular/compiler` module from our bundle! By AoT compilation, we can eliminate files which are no longer used in runtime and can reduce initial loss time for compilation.

#### Conclusion

- Angular-CLI started AoT support experimentally
- `source-map-explorer` is a great tool to measure our bundle

if you have not watched yet, I recommend you this video, Martin’s great session about optimizing bundle at AngularConnect 2016.

Thanks.
