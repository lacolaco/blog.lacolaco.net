---
title: 'How to Try Angular CLI with Bazel'
slug: 'how-to-try-angular-cli-with-bazel'
icon: ''
created_time: '2019-01-01T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Bazel'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/How-to-Try-Angular-CLI-with-Bazel-b3355b6fa9f94b0da35d23b772427c5b'
features:
  katex: false
  mermaid: false
  tweet: false
---

![image](/images/how-to-try-angular-cli-with-bazel/1__ReNz4DpvQrUpGduIF8RS2w.png)

**A Happy New Year!** I expect this year will be a beginning of Bazel Era!

This post is a reminder note for someone will try Angular CLI with Bazel (referred to as **Angular Bazel** in this post) at angular/bazel@7.0.0-rc.0.

This is based on Minko Gechev’s introduction post.

**[Introducing Bazel Schematics for Angular CLI](https://blog.mgechev.com/2018/12/17/introduction-bazel-schematics-angular-cli/)**

### Environment Preparation

### 1. Install Bazel

Not mentioned in Minko’s post, Angular Bazel needs global Bazel environment with its version higher than **v0.18.0.**

```
$ **brew install bazel**
$ **bazel version**
  INFO: Invocation ID: f973b7f6-a2b8-4821-a343-3036ac99183d
  Build label: **0.20.0-homebrew**
  Build target: bazel-out/darwin-opt/bin/src/main/java/com/google/devtools/build/lib/bazel/BazelServer_deploy.jar
  Build time: Fri Nov 30 20:40:12 2018 (1543610412)
  Build timestamp: 1543610412
  Build timestamp as int: 1543610412
```

https://docs.bazel.build/versions/master/install.html

### 2. Install Angular Bazel

To use Bazel schematics with `ng new` , it has to be installed in the same place to the CLI. In other words, you have to install Angular Bazel with `--global` flag. If you installed Angular CLI with yarn, execute `yarn add --global` .

```
$ npm -g i @angular/bazel@7.2.0-rc.0
```

### 3. Create Application

Create new application with `ng new` .

```
$ ng new bzl-app --collection=@angular/bazel
```

As same as Minko’s post, you need to edit some project files like package.json or WORKSPACE.

As far as I tried, SCSS or other AltCSS are not supported by Angular Bazel yet. You have to choose CSS in `ng new` prompt.

### Run application with Bazel

To run Angular application, just execute `ng serve` .

`ng serve` command without `--prod` runs `ts_devserver` target defined in `src/BUILD.bazel` .

```
ts_devserver(
    name = "devserver",
    port = 4200,
    additional_root_paths = [
        "npm/node_modules/zone.js/dist",
        "npm/node_modules/tslib",
    ],
    entry_module = "bzl_app/src/main.dev",
    serving_path = "/bundle.min.js",
    static_files = [
        "@npm//node_modules/zone.js:dist/zone.min.js",
        "@npm//node_modules/tslib:tslib.js",
        "index.html",
    ],
    deps = [":src"],
)
```

https://github.com/bazelbuild/rules_typescript

Technically, `ng serve` is the same to `bazel run //src:devserver` . And then, the below log is shown.

```
Server listening on http://<Your Machine Name>.local:4200/
```

This is designed behavior of `ts_devserver` . But it is not friendly possibly. Here is an issue about it. I think it should show `localhost:4200` in the log, too.

https://github.com/bazelbuild/rules_typescript/issues/339

With `--prod` , it uses `history_server` from Nodejs Rules.

```
history_server(
    name = "prodserver",
    data = [
        "index.html",
        ":bundle",
        ":zonejs",
    ],
)
```

https://bazelbuild.github.io/rules_nodejs/history-server/history_server.html

Notable thing is **Angular Bazel provides different servers** for development and production. It is more performant than `ts_devserver` but not easy to debug.

### Build application with Bazel

Angular Bazel already supports `ng build --prod` . But its build output is completely different to today’s non-Bazel `ng build` .

After running`ng build --prod` , `dist` directory has some sub directories and many output files. In Angular Bazel, `dist/bzl-app` directory is not **_serve-able_** with other simple HTTP server, because it doesn’t contain `index.html` . It is not regular structure.

```
dist
├── bin
├── bzl-app
├── genfiles
├── out
└── testlogs
```

To run application built by `ng build --prod` , execute `dist/bin/src/prodserver` executable file. It runs `history_server` as same as `ng serve --prod` . It’s a very performant web server implemented in Go.

```
$ ./dist/bin/src/prodserver --port=4200
```

So currently, to deploy the application, you have to follow the below steps;

1. Build application
2. Copy `dist` to remote server
3. Execute `prodserver` with Bazel environment

I think it is not easy, and Angular Bazel should support typical simple build output to deploy to web hosting ecosystems like GitHub Pages, Netlify, or Firebase Hosting.

### Conclusion

- Install Bazel and Angular Bazel
- Create application with `-collection=@angular/bazel`
- `ng serve` and `ng build --prod` are supported
- Built output is very different to today’s CLI

Angular Bazel is still in RC.0. I’ll try next release.
