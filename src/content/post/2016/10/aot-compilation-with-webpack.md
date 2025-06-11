---
title: 'Angular AoT Compilation with webpack'
slug: 'aot-compilation-with-webpack'
icon: ''
created_time: '2016-10-23T00:00:00.000Z'
last_edited_time: '2023-12-30T10:11:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'webpack'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-AoT-Compilation-with-webpack-655c55b569cc4063860844d8f10ec88b'
features:
  katex: false
  mermaid: false
  tweet: false
---

How to use `@ngtools/webpack`.

**@ngtools/webpack** package provides a very easy way to switch compilations of an Angular application from JiT to **AoT**. It’s used in Angular-CLI. The tool allows us enable AoT compilation **without any changes** of the application code. Let’s use new great stuff!

## Make base app

At first, make a very simple application.

```
├── index.html
├── package.json
├── src
│   ├── app
│   │   ├── app.component.css
│   │   ├── app.component.html
│   │   ├── app.component.ts
│   │   ├── app.module.ts
│   │   └── home
│   │       ├── home.component.html
│   │       └── home.component.ts
│   └── main.ts
├── tsconfig.json
└── webpack.config.js
```

This is current webpack configuration.

```
module.exports = {
  entry: {
    main: "./src/main.ts"
  },
  output: {
    path: "./dist",
    filename: "[name].bundle.js"
  },
  resolve: {
    extensions: [".ts", ".js", ".html"]
  },
  module: {
    rules: [
      { test: /\.html$/, loader: "raw" },
      { test: /\.css$/, loader: "raw" },
      {
        test: /\.ts/,
        loaders: ["awesome-typescript-loader", "angular2-template-loader"]
      }
    ]
  },
  devtool: "#source-map"
};
```

Current Project: [https://github.com/laco0416/ngtools-webpack-example/tree/base-app](https://github.com/laco0416/ngtools-webpack-example/tree/base-app)

## Switching dev/prod mode with CLI option

I want to have two build mode. **dev** mode is fast and no optimization. In other hand, **prod** mode is fully optimized build. We can pass **env** options via webpack CLI if the configuration is a function. New webpack.config.js is below:

```
const webpack = require("webpack");
module.exports = envOptions => {
  envOptions = envOptions || {};
  const config = {
    entry: {
      main: "./src/main.ts"
    },
    output: {
      path: "./dist",
      filename: "[name].bundle.js"
    },
    resolve: {
      extensions: [".ts", ".js", ".html"]
    },
    module: {
      rules: [
        { test: /\.html$/, loader: "raw" },
        { test: /\.css$/, loader: "raw" },
        {
          test: /\.ts/,
          loaders: ["awesome-typescript-loader", "angular2-template-loader"]
        }
      ]
    },
    devtool: "#source-map"
  };
  if (envOptions.MODE === "prod") {
    config.plugins = [
      new webpack.optimize.UglifyJsPlugin({
        beautify: false,
        mangle: {
          screw_ie8: true,
          keep_fnames: true
        },
        compress: {
          warnings: false,
          screw_ie8: true
        },
        comments: false
      })
    ];
  }
  return config;
};
```

And new npm-scripts are below.

```json
"scripts": {
    "build": "webpack --config webpack.config.js",
    "build:prod": "webpack --config webpack.config.js --env.MODE=prod"
},
```

Current Project: [https://github.com/laco0416/ngtools-webpack-example/tree/build-mode](https://github.com/laco0416/ngtools-webpack-example/tree/build-mode)

## Use NgcLoader and AotPlugin in prod mode

AoT compilation is a large effective optimization. It should be used in prod mode. To build with AoT compilation, let’s install `@ngtools/webpack` package and its dependencies.

```
npm install -D @angular/compiler-cli @ngtools/webpack
```

And update webpack.config.js to enable AotPlugin. Separate .ts file resolution, use `@ngtools/webpack` loader (NgcLoader) and add AotPlugin.

```
const webpack = require("webpack");
const AotPlugin = require("@ngtools/webpack").AotPlugin;
module.exports = envOptions => {
  envOptions = envOptions || {};
  const config = {
    entry: {
      main: "./src/main.ts"
    },
    output: {
      path: "./dist",
      filename: "[name].bundle.js"
    },
    resolve: {
      extensions: [".ts", ".js", ".html"]
    },
    module: {
      rules: [
        { test: /\.html$/, loader: "raw" },
        { test: /\.css$/, loader: "raw" }
      ]
    },
    devtool: "#source-map"
  };
  if (envOptions.MODE === "prod") {
    config.module.rules.push({ test: /\.ts$/, loaders: ["@ngtools/webpack"] });
    config.plugins = [
      new AotPlugin({
        tsConfigPath: "./tsconfig.json",
        entryModule: "src/app/app.module#AppModule"
      }),
      new webpack.optimize.UglifyJsPlugin({
        beautify: false,
        mangle: {
          screw_ie8: true,
          keep_fnames: true
        },
        compress: {
          warnings: false,
          screw_ie8: true
        },
        comments: false
      })
    ];
  } else {
    config.module.rules.push({
      test: /\.ts$/,
      loaders: ["awesome-typescript-loader", "angular2-template-loader"]
    });
  }
  return config;
};
```

AotPlugin takes two parameters at least. **tsConfigPath** identifies the path of tsconfig.json, and **entryModule** identifies the path and module class used for bootstrapping.

Now, `npm run build:prod` command executes AoT compilation. Congrats!

Final Project: [https://github.com/laco0416/ngtools-webpack-example/tree/aot-plugin](https://github.com/laco0416/ngtools-webpack-example/tree/aot-plugin)

## Conclusion

- Switch build mode with webpack’s environment options: –env.MODE
- Install @ngtools/webpack
- Use NgcLoader and add AotPlugin in prod mode
