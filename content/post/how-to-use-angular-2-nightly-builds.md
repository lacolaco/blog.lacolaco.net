+++
date = "2016-08-05T22:04:30+09:00"
title = "How to Use Angular 2 Nightly Builds"

+++

This post explains how to use nightly-builds of Angular 2.

<!--more-->

Angular 2 consists of some modules. Each module has own package and its version.
And there are nightly-builds packages of these.

## Nightly Builds

Nightly-builds has its own repository. 
For example, `@angular/core` repo corresponds to `angular/core-builds`.

[angular/core\-builds: @angular/core build artifacts](https://github.com/angular/core-builds)

Every `@angular` packages has corresponding `-builds` repo.

- [angular/core\-builds](https://github.com/angular/core-builds)
- [angular/common\-builds](https://github.com/angular/common-builds)
- [angular/compiler\-builds](https://github.com/angular/compiler-builds)
- [angular/platform\-browser\-builds](https://github.com/angular/platform-browser-builds)
- and more...

These repositories are updated when the main repo's master is committed.
So these help us if you want to **use new features** or **avoid bugs** which not released yet. 

## How to use

Each repo has its `package.json`. so we can install these via `npm install`.

```
$ npm install --save angular/core-builds
```

or `dependencies` field in `package.json`.

```json
{
    "dependencies": {
        "@angular/core": "angular/core-builds"
    }
}
``` 

npm supports dependencies from GitHub. My dependencies are below: 

```
{
  "dependencies": {
    "@angular/common": "angular/common-builds",
    "@angular/compiler": "angular/compiler-builds",
    "@angular/compiler-cli": "angular/compiler-cli-builds",
    "@angular/core": "angular/core-builds",
    "@angular/forms": "angular/forms-builds",
    "@angular/platform-browser": "angular/platform-browser-builds",
    "@angular/platform-browser-dynamic": "angular/platform-browser-dynamic-builds",
    "@angular/platform-server": "angular/platform-server-builds",
    "@angular/router": "angular/router-builds",
    "core-js": "^2.4.0",
    "rxjs": "5.0.0-beta.6",
    "zone.js": "^0.6.6"
  }
}
```

## Summary

- All Angular 2 modules have its own nightly-builds repo
- Nightly-builds are synchronized with `angular/angular` master
- We can use these via npm GitHub dependencies