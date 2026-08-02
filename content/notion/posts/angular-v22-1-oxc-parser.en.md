---
title: 'Adoption of oxc-parser in Angular v22.1'
slug: 'angular-v22-1-oxc-parser'
icon: ''
created_time: '2026-07-30T03:57:00.000Z'
last_edited_time: '2026-08-02T01:15:00.000Z'
tags:
  - 'Angular CLI'
  - 'oxc'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-v22-1-oxc-parser'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://app.notion.com/p/Angular-v22-1-oxc-parser-3ad3521b014a8112a97de82bb32e5d55'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: 'd3636537199d8256d4a1492a9f06d3eccf8cb9ea3678e113e011c1d22181f55b'
---

In Angular CLI v22.1.0, part of the build pipeline in `@angular/build` has been migrated from Babel to oxc-parser + magic-string.

https://github.com/angular/angular-cli/commit/10dc30f9c680f46f65b5beb030f2a75c422a3e71

https://github.com/angular/angular-cli/commit/917393a4cd85172574b155f727da5c1eae196fb1

This change only affects the angular/angular-cli repository, and oxc is not included in the dependencies of angular/angular. ngtsc and `@angular/compiler` remain in TypeScript. The migration is limited to the pre-processing JS-to-JS transformation before passing code to esbuild.

## The Role of oxc-parser

oxc is a JavaScript toolchain written in Rust, and **oxc-parser** is a package that allows its parser functionality to be used from Node.js via NAPI. It obtains an AST using `parseSync(filename, code, options)` and traverses it with a `Visitor`.

After oxc-parser converts the compiled JS into an AST, a separate library called **magic-string** performs the code rewriting for optimization. While oxc also has a transformer written in Rust (the `oxc-transform` package), it is not currently being used.

```typescript
import { MagicString } from 'magic-string';
import { Visitor, parseSync } from 'oxc-parser';
```

## Changes in @angular/build

With this change, part of the Angular CLI build-time optimization process has switched from a Babel plugin-based mechanism to a custom mechanism using oxc-parser + magic-string. The goal seems to be removing the Babel dependency and shortening build times.

In the Babel plugin-based mechanism, the source code is parsed into an AST, the AST is modified, and then the entire code is re-generated from the AST. In contrast, the new mechanism does not modify the AST parsed by oxc-parser; instead, it uses magic-string to perform string manipulations only on the specific ranges of the original code that require changes. The idea is likely to try to reduce build times by using the faster oxc-parser in cases where Babel is not required.

### Before Migration: AST Editing with Babel Plugins

Before the migration, `javascript-transformer-worker.ts` was structured to stack four optimization plugins along with coverage instrumentation and the Angular Linker into a `plugins` array and then call `transformAsync`.

```typescript
if (options.advancedOptimizations) {
  const { adjustStaticMembers, adjustTypeScriptEnums, elideAngularMetadata, markTopLevelPure } =
    await import('../babel/plugins');

  const sideEffectFree = options.sideEffects === false;
  const safeAngularPackage =
    sideEffectFree && /[\\/]node_modules[\\/]@angular[\\/]/.test(filename);

  plugins.push(
    [markTopLevelPure, { topLevelSafeMode: !safeAngularPackage }],
    elideAngularMetadata,
    adjustTypeScriptEnums,
    [adjustStaticMembers, { wrapDecorators: sideEffectFree }],
  );
}

// ...

const result = await transformAsync(data, {
  filename,
  inputSourceMap: (useInputSourcemap ? undefined : false) as undefined,
  sourceMaps: useInputSourcemap ? 'inline' : false,
  compact: false,
  configFile: false,
  babelrc: false,
  browserslistConfigFile: false,
  plugins,
});
```

The processes performed by the four optimization plugins were as follows. All of them are markings for tree shaking.

- `markTopLevelPure`: Appends `/*#__PURE__*/` to top-level function calls and constructor calls.
- `elideAngularMetadata`: Removes calls like `ɵsetClassMetadata`.
- `adjustTypeScriptEnums`: Wraps enums output by TypeScript in a pure IIFE.
- `adjustStaticMembers`: Wraps static members like `ɵcmp` and `ɵfac` in a pure IIFE.

### After Migration: String Editing with magic-string

The four plugins have been integrated into the `transform()` function in `oxc-transform.ts`. While traversing the parsed AST, all edits are stacked into a single `MagicString` instance.

```typescript
export function transform(filename: string, code: string, options: OxcTransformOptions) {
  const { program } = parseSync(filename, code, { range: true });
  const s = new MagicString(code);
  // ...
```

The removal of Angular metadata is implemented as follows:

```typescript
if (calleeName && angularMetadataFunctions.has(calleeName)) {
  const parentFunc = functionStack[functionStack.length - 1];
  if (
    parentFunc &&
    (parentFunc.type === 'FunctionExpression' ||
      parentFunc.type === 'ArrowFunctionExpression')
  ) {
    s.overwrite(node.start, node.end, 'void 0');
    markEdited(node.start, node.end);

    return;
  }
}
```

The `angularMetadataFunctions` contains three items: `ɵsetClassMetadata`, `ɵsetClassMetadataAsync`, and `ɵsetClassDebugInfo`. The range of the corresponding call expression is overwritten with `void 0`. For insertions like the pure annotation, `appendLeft` and `appendRight` are used.

```typescript
s.appendLeft(decl.id.end, ' = /*#__PURE__*/ ');
```

### Path Bypassing Babel

`javascript-transformer-worker.ts`, the process for post-build JS, has been split into two phases.

```typescript
let code = data;

// If Babel is needed, run it first
if (babelPlugins.length > 0) {
  const result = await transformAsync(code, { /* ... */ plugins: babelPlugins });
  code = result?.code ?? code;
}

// Run advanced optimizations using our fast oxc-transform
if (options.advancedOptimizations) {
  const { transform } = await import('../babel/plugins/oxc-transform.js');
  const sideEffectFree = options.sideEffects === false;
  const safeAngularPackage =
    sideEffectFree && /[\\/]node_modules[\\/]@angular[\\/]/.test(filename);
  const topLevelSafeMode = !safeAngularPackage;

  const result = transform(filename, code, {
    sourcemap: useInputSourcemap,
    sideEffects: options.sideEffects,
    jit: options.jit,
    topLevelSafeMode,
  });
  code = result.code;
  // ...
}
```

Now, only coverage instrumentation and the Angular Linker have the potential to be added to `babelPlugins`. If neither of these is needed, the code never reaches `transformAsync`, and the dynamic import of `@babel/core` does not occur. The Linker is only necessary for files containing `ɵɵngDeclare`—namely, libraries that have been partially compiled.

This covers the introduction of oxc-parser in build-time optimization; similarly, the i18n inlining process can now also bypass Babel.

## Future Outlook

Although a bypass path that doesn't call Babel has been created for some processes, `@babel/core` still remains in the dependencies for v22.1.0. There are two paths where Babel still runs at runtime.

One is code coverage instrumentation. Since the `programVisitor` from `istanbul-lib-instrument` can only be used as a Babel plugin, Babel will run if `codeCoverage: true` is specified in the `karma` builder. This path will eventually disappear with the migration to the Vitest-based `@angular/build:unit-test` builder.

The other is the Angular Linker, which still uses `@angular/compiler-cli/linker/babel` as is. [PR #33625](https://github.com/angular/angular-cli/pull/33625), which migrates the Angular Linker to oxc, is still open at the time of writing and is not included in v22.1. Once this is also merged, all paths that call Babel in a modern Angular project will likely disappear. It will be some time before the dependency is completely gone, but the benefits of faster builds should be felt immediately.

Note that, currently, oxc-parser is only adopted for post-compilation processing into JS; there are no changes in the areas responsible for compiling TypeScript code or template HTML. Since there is no primary information from official sources yet, I think it's important not to misunderstand its scope.