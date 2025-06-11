---
title: 'Try Angular 2 AoT compilation'
slug: 'try-angular-2-aot-compilation'
icon: ''
created_time: '2016-10-05T00:00:00.000Z'
last_edited_time: '2023-12-30T10:11:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Try-Angular-2-AoT-compilation-6b7d57eab6c948d98a5ac7d374d32343'
features:
  katex: false
  mermaid: false
  tweet: false
---

with Angular-CLI

![image](/images/try-angular-2-aot-compilation/1__2HGmglBA6b78AoREpWpULw.png)

Ahead-of-Time(AoT) compilation is a key feature of Angular 2. It bring us big performance and small payload size. Let’s try it easily. It’s good news, **Angular-CLI** started AoT support **experimentally!**

### Install CLI

Type a command to install angular-cli package in global

```
> npm install -g angular-cli
```

After installation, check the version.

```
> ng versionangular-cli: 1.0.0-beta.16node: 6.7.0os: darwin x64
```

### Create a project

Create new project with CLI

```
> ng new example-app
```

It takes a long long time. Be patient…

After that, move to the generated directory.

```
> cd example-app
```

### Build in JiT mode

At first, let’s build the project in JiT mode. Type a command:

```
> ng build
```

Built files will be in `dist` directory.

### Explore the bundle

Let’s explore and measure the bundled file. Install a tool from npm:

```
> npm install -g source-map-explorer
```

And use source-map-explorer for the bundle and source map

```
> source-map-explorer dist/main.bundle.js dist/main.map
```

Web browser opens automatically and show a graph telling items of the bundle!

![image](/images/try-angular-2-aot-compilation/1__kV__ewHL8x4Y__7DGLrMnHzg.png)

Awesome! Now we can see that `@angular/compiler` is the largest module. In JiT mode, all Angular applications require the compiler at runtime. In AoT mode, it doesn’t. Let’s make it sure.

### Build in AoT mode

**Note: Angular-CLI AoT support is really experimental yet.**

To build with AoT, use `— aot` option.

```
> ng build --aot
```

And explore the bundle again.

```
> source-map-explorer dist/main.bundle.js dist/main.map
```

![image](/images/try-angular-2-aot-compilation/1__vrqivZOWelOyCHeYfS__Wgw.png)

Yeeeeeah! We removed `@angular/compiler` module from our bundle! By AoT compilation, we can eliminate files which are no longer used in runtime and can reduce initial loss time for compilation.

### Conclusion

- Angular-CLI started AoT support experimentally
- `source-map-explorer` is a great tool to measure our bundle

if you have not watched yet, I recommend you this video, Martin’s great session about optimizing bundle at AngularConnect 2016.

Thanks.
