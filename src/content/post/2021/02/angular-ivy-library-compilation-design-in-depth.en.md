---
title: 'Understanding Angular Ivy Library Compilation'
slug: 'angular-ivy-library-compilation-design-in-depth.en'
icon: ''
created_time: '2021-02-24T00:00:00.000Z'
last_edited_time: '2023-12-30T10:07:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'en'
notion_url: 'https://www.notion.so/Understanding-Angular-Ivy-Library-Compilation-8f425a78a2da4952953729fca1cdd4ff'
features:
  katex: false
  mermaid: false
  tweet: false
---

In this post, I will explain how to compile Angular libraries with Ivy, which is now possible in Angular v11.1, and its details. The intended audience is those who are developing Angular third-party libraries, or simply interested in Angular’s internal mechanism. You don’t need to know anything in this article to develop Angular applications.

The content of this article is based on the Design Doc written by the Angular team.

[Ivy Library Compilation - Conceptual Design Doc](https://docs.google.com/document/d/148eXrCST6TM7Uo90KxaBrMbOkwJbYrQSQgRaGMK5WRc/edit#)

## How to compile libraries with Ivy

When you develop an Angular library using Angular CLI or something similar, Ivy is currently disabled for production build. It is probably set in a file like `src/tsconfig.lib.prod.json` as follows.

```json
{
  "angularCompilerOptions": {
    "enableIvy": false
  }
}
```

Angular libraries compiled and published to NPM with this configuration are still compatible for use even if the applications are not Ivy-enabled.

Starting from Angular v11.1, you can experimentally remove compatibility for applications not yet Ivy-enabled, and compile the library optimized for Ivy-enabled applications. To use Ivy compilation for libraries to be published to NPM, configure as follows

```json
{
  "angularCompilerOptions": {
    "enableIvy": true,
    "compilationMode": "partial"
  }
}
```

`"compilationMode": "partial"` is an important part, and I will explain what it means in the later part of this post. Of course, libraries compiled with this setting can only be used in Ivy-enabled applications, so it is still not currently recommended.

By the way, for libraries that are only used locally in monorepo, such as Angular CLI and Nrwl/Nx, you can simply use `enableIvy: true`. The `"compilationMode": "partial"` is required only for the libraries that are published in NPM. This difference is also explained later in this article.

```json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

## Terminology

In order to make the following explanations concise, let’s first sort out the terminology.

|                           |                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| term                      | meaning                                                                                        |
| Angular decorators        | Decorators defined by Angular such as `@Component`, `@Directive`, and `@Injectable`.           |
| Compiler                  | The Angular compiler is a tool that analyzes Angular decorators and generates executable code. |
| `ngc`                     | An executable CLI for the Angular compiler                                                     |
| Ivy compiler              | A compiler introduced in Angular v9                                                            |
| View Engine (VE) compiler | A deprecated compiler that was used by default until Angular v8                                |

## Ivy compilation for applications

Before we start talking about libraries, let’s start with compiling an application with Ivy already enabled by default. The Angular decorator in the application will be analyzed by the compiler to generate the executable code based on the extracted metadata.

Let’s look at an example of compiling a simple component. Suppose we have the following component.

```
@Component({
  selector: 'some-comp',
  template: `<div> Hello! </div>`
})
export class SomeComponent {}
```

If you compile this code with Ivy, you will get the following JavaScript output. The two points are as follows

- The decorator does not remain in the JavaScript.
- The generated code is inserted as a static field in the component class.

```
export class SomeComponent {}

SomeComponent.ɵcmp = ɵɵdefineComponent({
  selectors: [['some-comp']],
  template: (rf) => {
    if (rf & 1) {
      ɵɵelementStart('div');
      ɵɵtext(' Hello! ');
      ɵɵelementEnd();
    }
  },
});
```

The Ivy compiler generates the code to create the _definition_ from the metadata contained in the decorator. The HTML template, which was a string, becomes executable code as a **Template Function**. The `ɵɵelementStart` and `ɵɵtext` used in the template functions are called **Template Instructions**, and abstract the concrete DOM API calls and data binding update process.

![image](/images/angular-ivy-library-compilation-design-in-depth.en/ivy-app-compilation.png)

Angular compilation is internally divided into two steps; Analysis step and code generation step.

### Analysis step

In the analysis step of compilation, it integrates the metadata obtained from the decorators of the entire application and detects the dependencies between components/directives. At this point, the important part is the `@NgModule`. It is used to determine the references corresponding to unknown HTML tags and attributes contained in templates. After the analysis step, the compiler gets the following information.

- Which components depend on which directives/components
- What dependencies are needed to instantiate each component/directive

### Code generation step

In the code generation step, it generates the code for each Angular decorator based on the information obtained in the analysis step. The generated code has two requirements: **Locality** and **Runtime Compatibility**.

### Locality

Locality is also expressed as **self-contained**. It means that all the references needed for compiling the component are included in the component class itself. This makes differential builds more efficient. To make it easier to understand, let’s look back at the issues in the pre-Ivy View Engine days without Locality.

The VE compiler generated code as a file named `*.ngfactory.js` which was independent of the original file. Angular executes this `*.ngfactory.js` at runtime, and the generated code refers to the original component class. This approach becomes problematic when a component depends on another component.

For example, when a component `<app-parent>` uses a template to call a component `<app-child>`, there is no reference from `parent.component.ts` to `child.component.ts` as a JavaScript module. This parent-child dependence is only visible between `parent.component.ngfactory.js` and `child.component.ngfactory.js`.

Since the direct compilation result, `parent.component.js`, does not refer to either `child.component.js` or `child.component.ngfactory.js`, it cannot determine when it needs to be recompiled. Therefore, ViewEngine had to recompile the entire application at each build time.

![image](/images/angular-ivy-library-compilation-design-in-depth.en/ngfactory-dependency-link.png)

To solve this problem, the Ivy compiler generates the code as a static field of the class. In the generation code, the classes of the directives referenced in the template are included. This makes it easy to determine which files will be affected when that file is changed.

As you can see, with code generation with Locality, it is only necessary to recompile `ParentComponent` when itself or `ChildComponent` is changed.

```
// parent.component.js
import { ChildComponent } from './child.component';

ParentComponent.ɵcmp = ɵɵdefineComponent({
    ...
    template: function ParentComponent_Template(rf, ctx) {
        if (rf & 1) {
            ɵɵelement(2, "app-child");
        }
    },
    // Directives depended on by the template
    directives: [ChildComponent]
});
```

### Runtime compatibility

Another important factor in code generation is runtime compatibility. This is not an issue when compiling an application, but it is critical for compiling a library.

In an application, the compiler version and the Angular runtime version basically match because the compilation is done at the same time in the application build. However, this is not the same for libraries.

For libraries published to NPM, it must be considered that the Angular version that compiles the library does not match the Angular version used by the application that uses the library at runtime. A big issue here is the compatibility of the Angular APIs called in the generated code. APIs that existed in the compile-time version may not exist in the runtime version of Angular, or their signatures may have changed. So, **the rules for code generation must be determined by the Angular version of the runtime that executes it**.

Libraries used locally within monorepo were Ivy compilable because as long as it is in monorepo, it is ensured that the library and the application have the same Angular version.

## Library compilation

Here is the main topic. First, let’s look at compiling libraries with `enableIvy: false`, which is the current recommended setting for v11. Compiling a library with no Ivy is just **inlining the metadata** collected in the analysis step. The Angular decorator metadata is embedded in the static field as shown below.

![image](/images/angular-ivy-library-compilation-design-in-depth.en/library-compilation-ivy-false-1.png)

The library compilation works to convert the metadata into a JavaScript representation that can be published to NPM. However, this is still a metadata and cannot be executed as a component when loaded into an application. It needs to be compiled again based on this metadata. **Angular Compatibility Compiler**, `ngcc`, is the tool to do it.

### ngcc

As we don’t know whether the application side compiler is Ivy or VE, the only way to keep compatibility is to compile the library code on the application side. This is the reason why `ngcc` is run at application build time.

The compilation result of `ngcc` is the same as that of compiling the library directly. The difference is that `ngc` uses decorators in TypeScript as metadata, while `ngcc` uses `.decorators` in JavaScript as metadata.

![image](/images/angular-ivy-library-compilation-design-in-depth.en/library-compilation-ivy-false-2.png)

Although `ngcc` achieved its purpose to allow libraries to be released to NPM with compatibility, the frequent compilations spoiled the developer experience. Many of you may have felt the frustration of running `ngcc` repeatedly every time you installed a library. The `ngcc` overwrites the library code in `node_modules` installed from NPM and compiles it, so if the contents of `node_modules` are changed by the `npm install` command, you have to recompile it.

But originally, `ngcc` is a temporary approach until the View Engine support is removed from applications. The Ivy library compiler, which will be explained below, is a new Ivy-native library compilation mechanism that solves the problems clarified by `ngcc`.

### Ivy library compilation

The biggest issue with `ngcc` was the execution cost of the compilation on the application side. If `ngcc` was fast enough, we could have compiled the library just-in-time when the application was compiled, without persisting the compilation results in `node_modules`. The execution cost is high, so we want to reduce the number of times and save the results.

On the other hand, if we finish compiling the library before publishing it, we can build the application faster, but we lose runtime compatibility. The code generation step really needs to be done in the application’s Angular version.

So Ivy library compilation concept is a set of **mechanism for running only the code generation step rapidly** after library installation and **mechanism for finishing the analysis step before NPM release**. The first mechanism is called library **linking**, and the second mechanism is called **Link-Time Optimization (LTO) compilation**.

### LTO compilation (Pre-Publish compilation)

LTO compilation, which is done before publishing to NPM, is a mechanism to complete only the analysis step of the entire compilation and embed the result in JavaScript. As mentioned in the Introduction, when the setting `"compilationMode": "partial"` is set, the compiler will perform LTO compilation of the library.

```json
{
  "angularCompilerOptions": {
    "enableIvy": true,
    "compilationMode": "partial"
  }
}
```

The compiled JavaScript contains the following code. It looks similar to the normal compilation result, but the important thing is that the **template is preserved as a string** and it has **Locality**.

![image](/images/angular-ivy-library-compilation-design-in-depth.en/library-compilation-ivy-1.png)

The information obtained from the analysis step is inlined as a _declaration_. It includes a list of directives on which it depends, and has a locality that allows it to execute the code generation step with only information in the file. And by deferring the code generation of template functions until they are linked, the library can ensure runtime compatibility.

Also, the Angular version of the LTO compilation is included. Even if the template is the same, it can be optimized at link time depending on the combination of both the version it is written in and the runtime version.

### Linking libraries

An application that installs an LTO compiled library will link it at the building time just-in-time. The **Linker**, which does the linking, will generate code based on the declarations from the LTO compilation, and replace them with definitions that can be used by the application.

![image](/images/angular-ivy-library-compilation-design-in-depth.en/library-compilation-ivy-2.png)

Unlike `ngcc`, which required analysis step, the linking process can be executed independently for each file thanks to Locality of LTO compilation, so it can work as a plugin in module resolution like webpack. In the Angular CLI build, it is implemented as a Babel plugin called `AngularLinker`.

## Wrap-up

The new Ivy library compilation can be summarized as follows:

- The library compilation is separated into two parts: before and after NPM release.
- One is the **LTO compile** process that finishes the decorator analysis before publishing to NPM.
- The other is the **linking** process, which completes the compilation of the library by generating code at application build time.

I hope this article will help you readers understand how new Ivy library compilation is designed, based on the differences between applications and libraries in compilation, and the issues of `ngcc` used today.
