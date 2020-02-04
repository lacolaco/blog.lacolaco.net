---
title: "\"Differential Loading\" - A New Feature of Angular CLI v8"
date: 2019-04-17T08:42:40Z
tags: ["Angular", "Angular CLI", "JavaScript"]
---

## TL;DR

- Angular CLI understands browsers support range from `browserslist` configuration.
- If the application needs to support ES5 browsers and TypeScript target is higher than es5, the CLI automatically makes additional bundles for compatibility.
- `browserslist` is the single source of truth, so `es5BrowserSupport` will be deprecated.

---

Angular CLI v8 (now in **beta.15**) ships new feature called **"Differential Loading"**. It allows us to get free from considering browser compatibility of your application.

The CLI can understand browsers which the app needs to support and can make different bundles for both ES5 browsers and not.

## How to use

To enable differential loading, the app must have `browserslist` configuration. It can be placed in `package.json` or `browserslist` file. This configuration has already been used by autoprefixer process of postcss. Apps created recently by CLI should contain it and you can find it in the project.

[browserslist/browserslist](https://github.com/browserslist/browserslist)

Even if you don't have it now, you can create easily with [online demo](https://browserl.ist/?q=%3E+0.5%25%2C+last+2+versions%2C+Firefox+ESR%2C+not+dead%2C+not+IE+9-11%2C+not+Chrome+41). Angular CLI can look it up if `browserslist` file is placed at the same directory to `package.json` .

Preparation is over! If your tsconfig's target is out of browser range determined by `browserslist` , Angular CLI will separate bundles; one is for original target, and another is for **ES5 browsers**.

For example, let's support the latest 2 versions of Chrome and IE 11. `browserslist` is the following;

    last 2 Chrome versions, IE 11

And `tsconfig.json` is like below.

    {
      "compilerOptions": {
        "target": "es2015",
    		...
      }
    }

As you may know, IE11 is an ES5 browser. So without differential loading, this application will throw errors on IE11 because of missing `es2015` features like arrow functions, `class` or etc...

With differential loading, **Angular CLI understand this problem in advance**. The CLI judges whether the app has to support ES5 browsers, and check the current tsconfig's target can support them.
If they are mismatched, all bundles are separated as like `main-es5.bundle.js` and `main-es2015.bundle.js`.

Then, `<script>` tags for ES5 bundles are placed with `nomodule` attribute. It avoids loading ES5 bundles on non-ES5 browsers. As a result, on modern browsers, **users will load smaller bundles** just that the browser needs. It can improve loading performance.

![](https://thepracticaldev.s3.amazonaws.com/i/7hbyinyypnhlfmrvemnc.png)

## How about `es5BrowserSupport` option?

Yes, Angular CLI v7.3 added a feature like differential loading but it is only for polyfills. It uses `es5BrowserSupport` option in `angular.json` .

[5 Angular CLI Features You Didn't Know About](https://blog.mgechev.com/2019/02/06/5-angular-cli-features/)

After Angular CLI v8, **it will be deprecated** because it is not simple to manage supporting browsers in both of `browserslist` for CSS and `es5BrowserSupport` for JavaScript. So the CLI team adopt `browserslist` as the single source of truth to judge whether the application needs to support ES5 browsers.

## Conclusion

- Differential loading has been landed in Angular CLI v8 beta.
- CLI uses `browserslist` to judge the application needs to support ES5 browsers.
- If tsconfig doesn't match that, CLI adds different bundles loaded only by ES5 browsers.

To try the feature, let's create an application with the following command;

    $ npx @angular/cli@next new example-app
    $ cd example-app
    $ npm run build

Thanks for reading!
