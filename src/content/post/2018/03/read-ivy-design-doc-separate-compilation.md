---
title: 'DESIGN DOC (Ivy): Separate Compilationを読む'
slug: 'read-ivy-design-doc-separate-compilation'
icon: ''
created_time: '2018-03-03T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/DESIGN-DOC-Ivy-Separate-Compilation-f6bcdb7096ae42f184bf94651422e9b7'
features:
  katex: false
  mermaid: false
  tweet: false
---

https://github.com/angular/angular/blob/master/packages/compiler/design/separate_compilation.md

日本語訳しながら ngIvy の設計を理解する。

---

読んだ。要点だけまとめると以下。

- Angular 6.0 では Ivy という新しいコンパイラが導入される
- Ivy は Angular 5.0 (Renderer2) における分離コンパイルの課題を解決できる
- Ivy コンパイラは過去の形式を“バックパッチ”して Ivy 化できるので、後方互換の問題はない
- Ivy が要求するのはコンパイル後の`.js`ファイルと`.metadata.json`ファイルだけであり、手書きやあるいはサードパーティのツールにより生成されたコードであっても区別せず同様に扱うことができる

かなりアツい。

---

# DESIGN DOC (Ivy): Separate Compilation / コンパイルの分離

AUTHOR: chuckj@

## Background / 背景

### Angular 5 (Renderer2)

In 5.0 and prior versions of Angular the compiler performs whole program analysis and generates template and injector definitions that are using this global knowledge to flatten injector scope definitions, inline directives into the component, pre-calculate queries, pre-calculate content projection, etc. This global knowledge requires that module and component factories are generated as a final global step when compiling a module. If any of the transitive information changed then all factories need to be regenerated.

- バージョン 5.0 以前の Angular コンパイラは、プログラム全体の分析を行い、テンプレートとインジェクタ定義を生成します。
- それらはこのグローバルな情報 (訳注: プログラム全体の分析をして得られたメタデータのことだと思う) を、インジェクタスコープ定義の平坦化や、コンポーネント中へのディレクティブのインライン化、クエリの事前計算、コンテンツプロジェクションの事前計算、その他に利用します。
- このグローバルな情報はモジュールとコンポーネントファクトリーがモジュールのコンパイル時に最終的なグローバルのステップとして生成されていることを要求します。
- もしも何らかの推移的な情報が変更されたときには、すべてのファクトリーが再生成される必要があります。

Separate component and module compilation is supported only at the module definition level and only from source. That is, npm packages must contain the metadata necessary to generate the factories, they cannot contain, themselves, the generated factories. This is because, if any of there dependencies change, their factories would be invalid preventing them from using version ranges in their dependencies. To support producing factories from compiled source (already translated by TypeScript into JavaScript) libraries include metadata that describe the content of the the Angular decorators.

- コンポーネントやモジュールのコンパイルの分離は、モジュール定義レベルで、ソースコード状態からのみサポートされています。
- それはつまり、npm パッケージはファクトリーを生成するためのメタデータを持つ必要があり、生成されたファクトリを含めてはいけないということです。
- なぜなら、もし依存パッケージがひとつでも変化すれば、そのファクトリーは無効になり、依存パッケージの中でバージョン範囲を使うことを防ぐからです。（訳注: ここよくわからない）
- （すでに TypeScript から JavaScript に翻訳された）コンパイル済みのソースからファクトリを作成するためには、ライブラリは Angular デコレータの中身を記述したメタデータを含める必要があります。

This document refers to this style of code generation as Renderer2 after the name of the renderer class it uses at runtime.

- このドキュメントではこのスタイルのコード生成をランタイムで使うレンダラークラスの名前より、Renderer2 と説明します。

### Angular Ivy

In Ivy, the runtime is crafted in a way that allows for separate compilation by performing at runtime much of what was previously pre-calculated by compiler. This allows the definition of components to change without requiring modules and components that depend on them being recompiled.

- Ivy においては、ランタイムはこれまではコンパイラによって事前計算されたもののほとんどを、実行時に処理することで分離コンパイルを可能にする方法で作られています。
- これにより、コンポーネントの定義はそれに依存するモジュールやコンポーネントがリコンパイルされることを要求することなく変更できるようになります。
  - 訳注: 構文が入り組んでいて難しいが、次の 2 つの合成で合っているはず
    - `This allows (A) to V without B` / A が B なしに V できるようにする
    - `requiring A doing` / A が do することを要求する

The mental model of Ivy is that the decorator is the compiler. That is the decorator can be thought of as parameters to a class transformer that transforms the class by generating definitions based on the decorator parameters. An `@Component` decorator transforms the class by adding an `ngComponentDef` static property, `@Directive` adds `ngDirectiveDef`, `@Pipe` adds `ngPipeDef`, etc. In most cases values supplied to the decorator is sufficient to generate the definition. However, in the case of interpreting the template, the compiler needs to know the selector defined for each component, directive and pipe that are in scope of the template. The purpose of this document is to define the information is needed by the compiler and how that information is is serialized to be discovered and used by subsequent calls to `ngc`.

- この Ivy のメンタルモデルは、デコレータがコンパイラであるということです。
- それはつまり、デコレータは、デコレータのパラメータを基に定義を生成することによりクラスを変換するトランスフォーマーへのパラメータとして考えられるということです。
- `@Component`デコレータは`ngComponentDef`静的プロパティを追加することでクラスを変換し、`@Directive`は`ngDirectiveDef`を追加し、`@Pipe`は`ngPipeDef`を追加し、その他もそうです。
- ほとんどのケースで、デコレータに与えられる値は定義を生成するために十分です。
- しかしながら、テンプレートの解釈においては、コンパイラはそのテンプレートのスコープ中にあるそれぞれのコンポーネント・ディレクティブ・パイプのために定義されたセレクターを知っている必要があります。
- このドキュメントの目的はコンパイラから必要とされる情報と、その情報が発見されその後の`ngc`の呼び出しに使われるために、どのようにシリアライズされるかを定義することです。

This document refers to this style of code generation as ivy after the code name of the project to create it. It would be more consistent to refer to it as Renderer3 that looks too similar to Renderer2.

- このドキュメントではこのスタイルのコード生成を、それを作るプロジェクトのコードネームより、ivy と説明します。
- Renderer2 とよく似ている Renderer3 として説明するほうが一貫性があるかもしれません。

## Information needed

- 必要な情報

The information available across compilations in Angular 5 is represented in the compiler by a summary description. For example, components and directives are represented by the `[CompileDirectiveSummary](https://github.com/angular/angular/blob/d3827a0017fd5ff5ac0f6de8a19692ce47bf91b4/packages/compiler/src/compile_metadata.ts#L257)`. The following table shows where this information ends up in an ivy compiled class:

- Angular 5 においてコンパイルを超えて有効な情報はコンパイラ中でサマリーの記述として表されます。
- たとえば、コンポーネントやディレクティブは`CompileDirectiveSummary`として表されます。
- 以下のテーブルはこの情報が Ivy コンパイル後クラスの中で確定する場所を示します。

### `CompileDirectiveSummary`

|                     |                  |
| ------------------- | ---------------- |
| field               | destination      |
| `type`              | implicit         |
| `isComponent`       | `ngComponentDef` |
| `selector`          | `ngModuleScope`  |
| `exportAs`          | `ngDirectiveDef` |
| `inputs`            | `ngDirectiveDef` |
| `outputs`           | `ngDirectiveDef` |
| `hostListeners`     | `ngDirectiveDef` |
| `hostProperties`    | `ngDirectiveDef` |
| `hostAttributes`    | `ngDirectiveDef` |
| `providers`         | `ngInjectorDef`  |
| `viewProviders`     | `ngComponentDef` |
| `queries`           | `ngDirectiveDef` |
| `guards`            | not used         |
| `viewQueries`       | `ngComponentDef` |
| `entryComponents`   | not used         |
| `changeDetection`   | `ngComponentDef` |
| `template`          | `ngComponentDef` |
| `componentViewType` | not used         |
| `renderType`        | not used         |
| `componentFactory`  | not used         |

Only one definition is generated per class. All components are directives so a `ngComponentDef` contains all the `ngDirectiveDef` information. All directives are injectable so `ngComponentDef` and `ngDirectiveDef` contain `ngInjectableDef` information.

- クラスにつきたった 1 つの定義が生成されます。
- すべてのコンポーネントはディレクティブであるため、`ngComponentDef`は`ngDirectiveDef`の情報をすべて内包します。
- すべてのディレクティブは Injectable であるため、`ngComponentDef`と`ngDirectiveDef`は`ngInjectableDef`の情報を内包します。

For `CompilePipeSummary` the table looks like:

- `CompilePipeSummary`は次のテーブルのようになります。

### `CompilePipeSummary`

|        |                 |
| ------ | --------------- |
| field  | destination     |
| `type` | implicit        |
| `name` | `ngModuleScope` |
| `pure` | `ngPipeDef`     |

The only pieces of information that are not generated into the definition are the directive selector and the pipe name as they go into the module scope.

- 定義に生成されない情報はディレクティブのセレクターとパイプの名前だけです。なぜならそれらはモジュールのスコープに入るからです。

The information needed to build an `ngModuleScope` needs to be communicated from the directive and pipe to the module that declares them.

- `ngModuleScope`を組み立てるために必要な情報はディレクティブやパイプからそれらが宣言されるモジュールへのコミュニケーションが必要になります。

## Metadata

### Angular 5

Angular 5 uses `.metadata.json` files to store information that is directly inferred from the `.ts` files and include value information that is not included in the `.d.ts` file produced by TypeScript. Because only exports for types are included in `.d.ts` files and might not include the exports necessary for values, the metadata includes export clauses from the `.ts` file.

- Angular 5 は`.ts`ファイルから直接推定され、TypeScript により作成される`.d.ts`ファイルには含まれない値の情報を保存するために`.metadata.json`ファイルを使います。
- `.d.ts`ファイルには型のエクスポートだけが含まれていて、必要な値のエクスポートを含まないので、メタデータは`.ts`ファイルからの export 文を含みます。

When a module is flattened into a FESM (Flat ECMAScript Module), a flat metadata file is also produced which is the metadata for all symbols exported from the module index. The metadata represents what the `.metadata.json` file would look like if all the symbols were declared in the index instead of reexported from the index.

- モジュールが FESM に平坦化されるとき、そのモジュールのインデックスからエクスポートされるすべてのシンボルのメタデータである、フラットメタデータファイルも作成されます。
- フラットメタデータは`.metadata.json`ファイルがすべてのシンボルがインデックスからの再エクスポートではなくそのインデックスで宣言されているかのように表現します。

### Angular Ivy

The metadata for a class in ivy is transformed to be what the metadata of the transformed .js file produced by the ivy compiler would be. For example, a component’s `@Component` is removed by the compiler and replaced by a `ngComponentDef`. The `.metadata.json` file is similarly transformed but the content of the value assigned is elided (e.g. `"ngComponentDef": {}`). The compiler doesn’t record the selector declared for a component but it is needed to produce the `ngModuleScope` so the information is recorded as if a static field `ngSelector` was declared on class with the value of the `selector` field from the `@Component` or `@Directive` decorator.

- Ivy におけるクラスのメタデータは Ivy コンパイラにより変換された`.js`ファイルのメタデータになるように変換されます。
- たとえば、コンポーネントの`@Component`はコンパイラにより削除され、`ngComponentDef`に置き換えられます。
- `.metadata.json`ファイルは同じように変換されますが、値の中身は除外されます。（例えば `"ngComponentDef": {}`のように）
- コンパイラはコンポーネントのために宣言されたセレクターを記録しませんが、`ngModuleScope`を作るために必要です。したがって、その情報は`ngSelector`静的フィールドが`@Component`あるいは`@Directive`デコレータの`selector`フィールドの値と共にクラスに宣言されているかのように記録されます。

The following transformations are performed:

- 次のような変換が実行されます。

### `@Component`

The metadata for a component is transformed by:

- コンポーネントのメタデータは次のように変換されます

1. Removing the `@Component` directive.
2. Add `"ngComponentDef": {}` static field.
3. Add `"ngSelector": <selector-value>` static field.

- @Component`ディレクティブを削除する
  - 訳注: このディレクティブは多分一般的な`命令`くらいの意味
- `ngComponentDef: {}`静的フィールドを追加する
- “ngSelector”: `静的フィールドを追加する

### Example

_my.component.ts_

```
@Component({
  selector: "my-comp",
  template: `
    <h1>Hello, {{ name }}!</h1>
  `
})
export class MyComponent {
  @Input() name: string;
}
```

_my.component.js_

```
export class MyComponent {
  name: string;
  static ngComponentDef = defineComponent({...});
}
```

_my.component.metadata.json_

```json
{
  "__symbolic": "module",
  "version": 4,
  "metadata": {
    "MyComponent": {
      "__symbolic": "class",
      "statics": {
        "ngComponentDef": {},
        "ngSelector": "my-comp"
      }
    }
  }
}
```

Note that this is exactly what is produced if the transform had been done manually or by some other compiler before `ngc` compiler is invoked. That is this model has the advantage that there is no magic introduced by the compiler as it treats classes annotated by `@Component` identically to those produced manually.

- `ngc`コンパイラが実行されるまえに、手作業あるいは他のコンパイラによる変換が完了している場合は、正確にこのとおりに作成するように注意してください。
- それはつまり、このモデルはコンパイラによる魔法は存在せず、`@Component`により修飾されたクラスは手作業で作られたものと同一に扱われるという利点があるということです。

### `@Directive`

The metadata for a directive is transformed by:

- ディレクティブのメタデータは次のように変換されます

1. Removing the `@Directive` directive.
2. Add `"ngDirectiveDef": {}` static field.
3. Add `"ngSelector": <selector-value>` static field.

- `@Directive`ディレクティブを削除する
- `"ngDirectiveDef": {}`静的フィールドを追加する
- `"ngSelector": <selector-value>`静的フィールドを追加する

### example

_my.directive.ts_

```
@Directive({ selector: "[my-dir]" })
export class MyDirective {
  @HostBinding("id") dirId = "some id";
}
```

_my.directive.js_

```
export class MyDirective {
  constructor() {
    this.dirId = 'some id';
  }
  static ngDirectiveDef = defineDirective({...});
}
```

_my.directive.metadata.json_

```json
{
  "__symbolic": "module",
  "version": 4,
  "metadata": {
    "MyDirective": {
      "__symbolic": "class",
      "statics": {
        "ngDirectiveDef": {},
        "ngSelector": "[my-dir]"
      }
    }
  }
}
```

### `@Pipe`

The metadata for a pipe is transformed by:

- パイプのメタデータは次のように変換されます

1. Removing the `@Pipe` directive.
2. Add `"ngPipeDef": {}` static field.
3. Add `"ngSelector": <name-value>` static field.

- `@Pipe`ディレクティブを削除する
- `"ngPipeDef": {}`静的フィールドを追加する
- `"ngSelector": <selector-value>`静的フィールドを追加する

### example

_my.pipe.ts_

```
@Pipe({name: 'myPipe'})
export class MyPipe implements PipeTransform {
  transform(...) ...
}
```

_my.pipe.js_

```
export class MyPipe {
  transform(...) ...
  static ngPipeDef = definePipe({...});
}
```

_my.pipe.metadata.json_

```json
{
  "__symbolic": "module",
  "version": 4,
  "metadata": {
    "MyPipe": {
      "__symbolic": "class",
      "statics": {
        "ngPipeDef": {},
        "ngSelector": "myPipe"
      }
    }
  }
}
```

### `@NgModule`

The metadata for a module is transformed by:

- モジュールのメタデータは次のように変換されます

1. Remove the `@NgModule` directive.
2. Add `"ngInjectorDef": {}` static field.
3. Add `"ngModuleScope": <module-scope>` static field.

- `@NgModule`ディレクティブを削除する
- `"ngInjectorDef": {}`静的フィールドを追加する
- `"ngModuleScope": <module-scope>`静的フィールドを追加する

The scope value is an array the following type:

- スコープの値は次のような型の配列です。

```
export type ModuleScope = ModuleScopeEntry[];

export interface ModuleDirectiveEntry {
  type: Type;
  selector: string;
}

export interface ModulePipeEntry {
  type: Type;
  name: string;
  isPipe: true;
}

export interface ModuleExportEntry {
  type: Type;
  isModule: true;
}

type ModuleScopeEntry =
  | ModuleDirectiveEntry
  | ModulePipeEntry
  | ModuleExportEntry;
```

where the `type` values are generated as references.

### example

_my.module.ts_

```
@NgModule({
  imports: [CommonModule, UtilityModule],
  declarations: [MyComponent, MyDirective, MyComponent],
  exports: [MyComponent, MyDirective, MyPipe, UtilityModule],
  providers: [
    {
      provide: Service,
      useClass: ServiceImpl
    }
  ]
})
export class MyModule {}
```

_my.module.js_

```
export class MyModule {
  static ngInjectorDef = defineInjector(...);
}
```

_my.module.metadata.json_

```json
{
  "__symbolic": "module",
  "version": 4,
  "metadata": {
    "MyModule": {
      "__symbolic": "class",
      "statics": {
        "ngInjectorDef": {},
        "ngModuleScope": [
          {
            "type": {
              "__symbolic": "reference",
              "module": "./my.component",
              "name": "MyComponent"
            },
            "selector": "my-comp"
          },
          {
            "type": {
              "__symbolic": "reference",
              "module": "./my.directive",
              "name": "MyDirective"
            },
            "selector": "[my-dir]"
          },
          {
            "type": {
              "__symbolic": "reference",
              "module": "./my.pipe",
              "name": "MyPipe"
            },
            "name": "myPipe",
            "isPipe": true
          },
          {
            "type": {
              "__symbolic": "reference",
              "module": "./utility.module",
              "name": "UtilityModule"
            },
            "isModule": true
          }
        ]
      }
    }
  }
}
```

Note that this is identical to what would have been generated if the this was manually written as:

- 次のように手作業で書かれたとしても、生成されたものと同一であることが重要です。

```
export class MyModule {
  static ngInjectorDef = defineInjector({
    providers: [
      {
        provide: Service,
        useClass: ServiceImpl
      }
    ],
    imports: [CommonModule, UtilityModule]
  });
  static ngModuleScope = [
    {
      type: MyComponent,
      selector: "my-comp"
    },
    {
      type: MyDirective,
      selector: "[my-dir]"
    },
    {
      type: MyPipe,
      name: "myPipe"
    },
    {
      type: UtilityModule,
      isModule: true
    }
  ];
}
```

except for the call to `defineInjector` would generate a `{ __symbolic: 'error' }` value which is ignored by the ivy compiler. This allows the system to ignore the difference between manually and mechanically created module definitions.

- `defineInjector`の呼び出し以外は、Ivy コンパイラによって無視される`{ __symbolic: 'error' }`という値を生成します。
- これはこのシステムが手作業で作られたモジュール定義と機械的に作成されたモジュール定義の違いを無視できるようにします。

## Manual Considerations

- 手書きへの考慮

With this proposal, the compiler treats manually and mechanically generated Angular definitions identically. This allows flexibility not only in the future for how the declarations are mechanically produced it also allows alternative mechanism to generate declarations be easily explored without altering the compiler or dependent tool chain. It also allows third-party code generators with possibly different component syntaxes to generate a component fully understood by the compiler.

- このプロポーザルでは、コンパイラは手書きの Angular 定義と機械的に生成された Angular 定義を同一に扱います。
- これは将来的にその定義を機械的に作成する方法を柔軟にするだけでなく、定義を生成する代替のメカニズムを、コンパイラや依存するツールチェインに手を加えることなく簡単に探究できるようにします。
- また、異なるコンポーネント構文を持ったサードパーティのコード生成器が、完全にコンパイラから理解可能なコンポーネントを作成することも可能にします。
  - 訳注: 多分 JSX とかのことを指している。結果として得られる js と metadata.json さえ正しければ.ts の層は自由であるということを表している

Unfortunately, however, manually generated modules contain references to classes that might not be necessary at runtime. Manually or third-party components can get the same payload properties of an Angular generated component by annotating the `ngSelector` and `ngModuleScope` properties with `// @__BUILD_OPTIMIZER_REMOVE_` comment which will cause the build optimizer to remove the declaration.

- しかし残念ながら、手書きのモジュールは実行時には不要なクラスへの参照を含んでいます。
- 手書き、あるいはサードパーティのコンポーネントは、`ngSelector`と`ngModuleScope`プロパティをビルドオプティマイザによる宣言の除去を起こす`// @__BUILD_OPTIMIZER_REMOVE_`コメントで修飾することで Angular が生成したコンポーネントプロパティを同じペイロードにできます。

### example

For example the above manually created module would have better payload properties by including a `// @__BUILD_OPTIMIZER_REMOVE_` comment:

- たとえば上記の手書きされたモジュールは次のように`// @__BUILD_OPTIMIZER_REMOVE_`コメントを含むことでプロパティのペイロードを改善できます。

```
export class MyModule {
  static ngInjectorDef = defineInjector({
    providers: [
      {
        provide: Service,
        useClass: ServiceImpl
      }
    ],
    imports: [CommonModule, UtilityModule]
  });

  // @__BUILD_OPTIMIZER_REMOVE_
  static ngModuleScope = [
    {
      type: MyComponent,
      selector: "my-comp"
    },
    {
      type: MyDirective,
      selector: "[my-dir]"
    },
    {
      type: MyPipe,
      name: "myPipe"
    },
    {
      type: UtilityModule,
      isModule: true
    }
  ];
}
```

## `ngc` output (non-Bazel)

The cases that `ngc` handle are producing an application and producing a reusable library used in an application.

- `ngc`が扱えるケースはアプリケーションを作成することと、アプリケーションから使われる再利用可能なライブラリを作成することです。

### Application output

- アプリケーション出力

The output of the ivy compiler only optionally generates the factories generated by the Renderer2 style output of Angular 5.0. In ivy, the information that was generated in factories is now generated in Angular as a definition that is generated as a static field on the Angular decorated class.

- Ivy コンパイラの出力はオプショナルに Angular 5 の Renderer2 形式の出力により生成されるファクトリを生成できます。
- Ivy においては、ファクトリで生成された情報は Angular のなかでデコレートされたクラスの静的フィールドとして生成された定義として生成されます。

Renderer2 requires that, when building the final application, all factories for all libraries also be generated. In ivy, the definitions are generated when the library is compiled.

- 最終的なアプリケーションをビルドするとき、Renderer2 はすべてのライブラリのすべてファクトリが生成されることを要求します。
- Ivy においては、ライブラリがコンパイルされるときに定義は生成されます。

The ivy compile can adapt Renderer2 target libraries by generating the factories for them and back-patching, at runtime, the static property into the class.

- Ivy のコンパイルは Renderer2 をターゲットにしたライブラリをファクトリを生成し、バックパッチを行いランタイムで静的プロパティを追加することにより採用できます。

### Back-patching module (`"renderer2BackPatching"`)

- モジュールのバックパッチ (`"renderer2BackPatching"`)

When an application contains Renderer2 target libraries the ivy definitions need to be back-patch onto the component, directive, module, pipe, and injectable classes.

- アプリケーションが Renderer2 ターゲットライブラリを含む時、Ivy 定義がそのコンポーネントやディレクティブ、モジュール、パイプ、Injectable クラス上にバックパッチされる必要があります。

If the Angular compiler option `"renderer2BackPatching"` is enabled, the compiler will generate an `angular.back-patch` module in the to root output directory of the project. If `"generateRenderer2Factories"` is set to `true` then the default value for `"renderer2BackPatching"` is `true` and it is and error for it to be `false`. `"renderer2BackPatching"` is ignored if `"enableIvy"` is `false`.

- Angular コンパイラオプションの`renderer2BackPatching`が有効な時、コンパイラは`angular.back-patch`モジュールをプロジェクトの出力ディレクトリのルートに生成します。
- `generateRenderer2Factories`が`true`の場合は、`renderer2BackPatching`のデフォルト値は`true`になり、`false`にするとエラーになります。
- `renderer2BackPatching`は`enableIvy`が`false`のときは無視されます。

`angular.back-patch` exports a function per `@NgModule` for the entire application, including previously compiled libraries. The name of the function is determined by name of the imported module with all non alphanumeric character, including ‘`/`’ and ‘`.`’, replaced by ‘`_`’.

- `angular.back-patch`はすでにコンパイルされたライブラリを含むアプリケーション全体の`@NgModule`ごとに関数をエクスポートします。
- 関数名はインポートされたモジュールの名前を、`/`や`.`を含むアルファベットでない文字を`_`に置換して決定されます。

The back-patch functions will call the back-patch function of any module they import. This means that only the application’s module and lazy loaded modules back-patching functions needs to be called. If using the Renderer2 module factory instances, this is performed automatically when the first application module instance is created.

- バックパッチ関数はそれがインポートする他のモジュールのバックパッチ関数を呼び出します。
- これが意味するのは、アプリケーションのモジュールと、遅延ロードされるモジュールのバックパッチ関数だけを呼び出す必要があるということです。
- もし Renderer2 モジュールファクトリのインスタンスを使う場合は、これはアプリケーションの最初のモジュールのインスタンスが作られたときに自動的に機能します。

### Renderer2 Factories (`"generateRenderer2Factories"`)

`ngc` can generate an implementation of `NgModuleFactory` in the same location that Angular 5.0 would generate it. This implementation of `NgModuleFactory` will back-patch the Renderer2 style classes when the first module instance is created by calling the correct back-patching function generated in the`angular.back-patch` module.

- `ngc`は Angular 5.0 が生成するのと同じ場所に`NgModuleFactory`の実装を生成できます。
- この`NgModuleFactory`の実装は最初のモジュールインスタンスが作られたときに、`angular.back-patch`モジュールに生成された正しいバックパッチ関数を呼び出すことにより、Renderer2 形式のクラスをバックパッチします。

Renderer2 style factories are created when the `"generateRenderer2Factories"` Angular compiler option is `true`. Setting `"generateRenderer2Factories"` implies `"renderer2BackPatching"` is also `true` and it is an error to explicitly set it to `false`. `"generateRenderer2Factories"` is ignored if `"enableIvy"` is `false`.

- Renderer2 形式のファクトリは`generateRenderer2Factories`Angular コンパイラオプションが`true`のときに作成されます。
- `generateRenderer2Factories`を設定すると、`renderer2BackPatching`も暗黙的に`true`になり、明示的に`false`にするとエラーになります。
- `generateRenderer2Factories`は`enavleIvy`が`false`のときは無視されます。

When this option is `true` a factory module is created with the same public API at the same location as Angular 5.0 whenever Angular 5.0 would have generated a factory.

- このオプションが`true`のとき、Angular 5.0 がファクトリを生成するたびに、ファクトリのモジュールは Angular 5.0 と同じ場所に同じパブリック API で作成されます。

### Recommended options

The recommended options for producing a ivy application are

- Ivy アプリケーションを作成するための推奨オプションは次のとおりです。

|                                |          |          |
| ------------------------------ | -------- | -------- |
| option                         | value    |          |
| `"enableIvy"`                  | `true`   | required |
| `"generateRenderer2Factories"` | `true`   | implied  |
| `"renderer2BackPatching"`      | `true`   | implied  |
| `"generateCodeForLibraries"`   | `true`   | default  |
| `"annotationsAs"`              | `remove` | implied  |
| `"enableLegacyTemplate"`       | `false`  | default  |
| `"preserveWhitespaces"`        | `false`  | default  |
| `"skipMetadataEmit"`           | `true`   | default  |
| `"strictMetadataEmit"`         | `false`  | implied  |
| `"skipTemplateCodegen"`        |          | ignored  |

The options marked “implied” are implied by other options having the recommended value and do not need to be explicitly set. Options marked “default” also do not need to be set explicitly.

- `implied`と記されたオプションは他のオプションにより暗黙的に推奨される値を持つため、明示的に設定する必要はありません。
- `default`と記されたオプションも同様に明示的に設定する必要はありません。

## Library output

- ライブラリ出力

Building an ivy library with `ngc` differs from Renderer2 in that the declarations are included in the generated output and should be included in the package published to `npm`. The `.metadata.json` files still need to be included but they are transformed as described below.

- Ivy ライブラリを`ngc`を使ってビルドするのは、その定義が生成された出力に含まれる点と、それが`npm`に公開されるパッケージに含まれるべきであるという点で、Renderer2 と違います。 `.metadata.json`ファイルはまだ同梱が必要ですが、後述のように変換されます。

### Transforming metadata

As described above, when the compiler adds the declaration to the class it will also transform the `.metadata.json` file to reflect the new static fields added to the class.

- 先述のとおり、コンパイラがクラスに宣言を追加するとき、コンパイラはクラスに追加された新しい静的フィールドを反映するように`.metadata.json`も変換します。

Once the static fields are added to the metadata, the ivy compiler no longer needs the the information in the decorator. When `"enableIvy"` is `true` this information is removed from the `.metadata.json` file.

- 一度静的フィールドがメタデータに追加されると、Ivy コンパイラはもうデコレータの情報を必要としません。
- `enableIvy`が`true`であるとき、この情報は`.metadata.json`ファイルから削除されます。

### Recommended options

The recommended options for producing a ivy library are:

- Ivy ライブラリを作成するときの推奨オプションは次のとおりです。

|                                |          |          |
| ------------------------------ | -------- | -------- |
| option                         | value    |          |
| `"enableIvy"`                  | `true`   | required |
| `"generateRenderer2Factories"` | `false`  |          |
| `"renderer2BackPatching"`      | `false`  | default  |
| `"generateCodeForLibraries"`   | `false`  |          |
| `"annotationsAs"`              | `remove` | implied  |
| `"enableLegacyTemplate"`       | `false`  | default  |
| `"preserveWhitespaces"`        | `false`  | default  |
| `"skipMetadataEmit"`           | `false`  |          |
| `"strictMetadataEmit"`         | `true`   |          |
| `"skipTemplateCodegen"`        |          | ignored  |

The options marked “implied” are implied by other options having the recommended value and do not need to be explicitly set. Options marked “default” also do not need to be set explicitly.

- `implied`と記されたオプションは他のオプションにより暗黙的に推奨される値を持つため、明示的に設定する必要はありません。
- `default`と記されたオプションも同様に明示的に設定する必要はありません。

## Simplified options

- 簡略化したオプション

The default Angular Compiler options default to, mostly, the recommended set of options but the options necessary to set for specific targets are not clear and mixing them can produce nonsensical results. The `"target"` option can be used to simplify the setting of the compiler options to the recommended values depending on the target:

- デフォルトの Angular コンパイラオプションは殆どの場合、推奨されるオプションのセットですが、特定のターゲットに設定するのに必要なオプションが明確ではなく、それらを混合すると無意味な結果が生じる可能性があります。
- `target`オプションはコンパイラオプションをターゲットに依存した推奨値に設定するのを簡略化するために利用できます。

|                 |                                |              |          |
| --------------- | ------------------------------ | ------------ | -------- |
| target          | option                         | value        |          |
| `"application"` | `"generateRenderer2Factories"` | `true`       | enforced |
|                 | `"renderer2BackPatching"`      | `true`       | enforced |
|                 | `"generateCodeForLibraries"`   | `true`       |          |
|                 | `"annotationsAs"`              | `remove`     |          |
|                 | `"enableLegacyTemplate"`       | `false`      |          |
|                 | `"preserveWhitespaces"`        | `false`      |          |
|                 | `"skipMetadataEmit"`           | `false`      |          |
|                 | `"strictMetadataEmit"`         | `true`       |          |
|                 | `"skipTemplateCodegen"`        | `false`      |          |
|                 | `"fullTemplateTypeCheck"`      | `true`       |          |
|                 | `"enableLegacyTemplate"`       | `false`      |          |
|                 |                                |              |          |
| `"library"`     | `"generateRenderer2Factories"` | `false`      | enforced |
|                 | `"renderer2BackPatching"`      | `false`      | enforced |
|                 | `"generateCodeForLibraries"`   | `false`      | enforced |
|                 | `"annotationsAs"`              | `decorators` |          |
|                 | `"enableLegacyTemplate"`       | `false`      |          |
|                 | `"preserveWhitespaces"`        | `false`      |          |
|                 | `"skipMetadataEmit"`           | `false`      | enforced |
|                 | `"strictMetadataEmit"`         | `true`       |          |
|                 | `"skipTemplateCodegen"`        | `false`      | enforced |
|                 | `"fullTemplateTypeCheck"`      | `true`       |          |
|                 | `"enableLegacyTemplate"`       | `false`      |          |
|                 |                                |              |          |
| `"package"`     | `"flatModuleOutFile"`          |              | required |
|                 | `"flatModuleId"`               |              | required |
|                 | `"enableIvy"`                  | `false`      | enforced |
|                 | `"generateRenderer2Factories"` | `false`      | enforced |
|                 | `"renderer2BackPatching"`      | `false`      | enforced |
|                 | `"generateCodeForLibraries"`   | `false`      | enforced |
|                 | `"annotationsAs"`              | `remove`     |          |
|                 | `"enableLegacyTemplate"`       | `false`      |          |
|                 | `"preserveWhitespaces"`        | `false`      |          |
|                 | `"skipMetadataEmit"`           | `false`      | enforced |
|                 | `"strictMetadataEmit"`         | `true`       |          |
|                 | `"skipTemplateCodegen"`        | `false`      | enforced |
|                 | `"fullTemplateTypeCheck"`      | `true`       |          |
|                 | `"enableLegacyTemplate"`       | `false`      |          |

Options that are marked “enforced” are reported as an error if they are explicitly set to a value different from what is specified here. The options marked “required” are required to be set and an error message is displayed if no value is supplied but no default is provided.

- `enforced`と記述されたオプションは、もし明示的に異なる値が設定されたときにエラーを報告します。
- `required`と記述されたオプションは設定されることを要求し、もし値がなかった場合はエラーメッセージを表示します。

The purpose of the “application” target is for the options used when the `ngc` invocation contains the root application module. Lazy loaded modules should also be considered “application” targets.

- application ターゲットはルートアプリケーションモジュールを含む`ngc`の実行時に使われるオプションを目的とします。
- 遅延ロードされるモジュールも application ターゲットで考慮されるべきです。

The purpose of the “library” target is for are all `ngc` invocations that do not contain the root application module or a lazy loaded module.

- library ターゲットはルートアプリケーションモジュールや遅延ロードモジュールを含まないすべての`ngc`の実行時に使われるオプションを目的とします。

The purpose of the “package” target is to produce a library package that will be an entry point for an npm package. Each entry point should be separately compiled using a “package” target.

- package ターゲットは npm パッケージのエントリポイントとなるライブラリパッケージを作成することを目的とします。
- それぞれのエントリポイントは package ターゲットを使って個別にコンパイルされるべきです。

### example - application

To produce a Renderer2 application the options would look like,

- Renderer2 アプリケーションを作成するためのオプションは次のようになります。

```json
{
  "compileOptions": {
    ...
  },
  "angularCompilerOptions": {
    "target": "application"
  }
}
```

alternately, since the recommended `"application"` options are the default values, the `"angularCompilerOptions"` can be out.

- あるいは、`application`オプションはデフォルト値なので、`angularCompilerOptions`は省略できます。

### example - library

To produce a Renderer2 library the options would look like,

- Renderer2 ライブラリを作成するためのオプションは次のようになります。

```json
{
  "compileOptions": {
    ...
  },
  "angularCompilerOptions": {
    "target": "library"
  }
}
```

### example - package

To produce a Renderer2 package the options would look like,

- Renderer2 パッケージを作成するためのオプションは次のようになります。

```json
{
  "compileOptions": {
    ...
  },
  "angularCompilerOptions": {
    "target": "package"
  }
}
```

### example - ivy application

To produce an ivy application the options would look like,

- Ivy アプリケーションを作成するためのオプションは次のようになります。

```json
{
  "compileOptions": {
    ...
  },
  "angularCompilerOptions": {
    "target": "application",
    "enableIvy": true
  }
}
```

### example - ivy library

To produce an ivy application the options would look like,

- Ivy アプリケーションを作成するためのオプションは次のようになります。
  - 訳注: これは ivy library のはず

https://github.com/angular/angular/pull/22579

```json
{
  "compileOptions": {
    ...
  },
  "angularCompilerOptions": {
    "target": "library",
    "enableIvy": true
  }
}
```

### example - ivy package

Ivy packages are not supported in Angular 6.0 as they are not recommended in npm packages as they would only be usable if in ivy application where an ivy application. Ivy application support Renderer2 libraries so npm packages should all be Renderer2 libraries.

- Ivy パッケージは Ivy アプリケーションからしか利用できず、npm パッケージとして推奨されないため、Angular 6.0 ではサポートされません。
- Ivy アプリケーションは Renderer2 ライブラリをサポートするので、npm パッケージはすべて Renderer2 ライブラリであるべきです。

## `ng_module` output (Bazel)

The `ng_module` rule describes the source necessary to produce a Angular library that is reusable and composable into an application.

`ng_module`ルールは再利用とアプリケーションへの組み込みが可能な Angular ライブラリを作成するのに必要なソースを記述します。

### Angular 5.0

The `ng_module` rule invokes `ngc`[1](about:blank#ngc_wrapped) to produce the Angular output. However, `ng_module` uses a feature, the `.ngsummary.json` file, not normally used and is often difficult to configure correctly.

- `ng_module`ルールは Angular 出力をつくるために`ngc`を呼び出します。
- しかしながら、`ng_module`は普通は使われない`.ngsummary.json`ファイルの機能を使い、正しく設定することが難しいです。

The `.ngsummary.json` describes all the information that is necessary for the compiler to use a generated factory. It is produced by actions defined in the `ng_module` rule and is consumed by actions defined by `ng_module` rules that depend on other `ng_module` rules.

- `.ngsummary.json`はコンパイラが生成されたファクトリを使うのに必要なすべての情報を記述します。
- `.ngsummary.json`は`ng_module`ルールで定義されたアクションにより生成され、別の`ng_module`ルールに依存する`ng_module`ルールにより定義されたアクションにより使われます。

### Angular Ivy

The `ng_module` rule will still use `ngc` to produce the Angular output but, when producing ivy output, it no longer will need the `.ngsummary.json` file.

- `ng_module`ルールはまだ`ngc`を Angular 出力を得るために使いますが、Ivy 出力を生成するときには、`.ngsummary.json`ファイルはもはや必要ありません。

### `ng_experimental_ivy_srcs`

The `ng_experimental_ivy_srcs` can be used as use to cause the ivy versions of files to be generated. It is intended the sole dependency of a `ts_dev_server` rule and the `ts_dev_server` sources move to `ng_experimental_iv_srcs`.

- `ng_experimental_ivy_srcs`は生成されるファイルの Ivy 版を発生させる手段として利用されます。
- `ts_dev_server`ルールと`ts_dev_server`ソースの依存関係が `ng_experimental_iv_srcs`に移動することを意図しています。

### `ng_module` ivy output

The `ng_module` is able to provide the ivy version of the `.js` files which will be generated with as `.ivy.js` for the development sources and `.ivy.closure.js` for the production sources.

- `ng_module`は`.js`ファイルの Ivy 版を提供できます。それは開発用の`.ivy.js`と、プロダクション用の`.ivy.closure.js`を生成します。

The `ng_module` rule will also generate a `angular.back_patch.js` and `.closure.js` files and a `module_scope.json` file. The type of the `module_scope.json` file will be:

- `ng_module`ルールは`angular.back-patch.js`と`.closure.js`ファイル、`module_scope.json`ファイルも生成します。
- `module_scope.json`ファイルの型は次のようになります。

```
interface ModuleScopeSummary {  [moduleName: string]: ModuleScopeEntry[];}
```

where `moduleName` is the name of the as it would appear in an import statement in a `.ts` file at the same relative location in the source tree. All the references in this file are also relative this location.

- `moduleName`がある場所はソースツリーのなかで同じ相対位置の`.ts`ファイルの import 文に登場するような名前です。
- このファイル中のすべての参照はこの位置からの相対です。

### example

The following is a typical Angular application build in bazel:

- 一般的な Angular アプリケーションの Bazel ビルドは次のようになります。

_src/BUILD.bazel_

```
ng_module(
  name = "src",
  srcs = glob(["*.ts"]),
  deps= ["//common/component"],
)

ts_dev_server(
  name = "server",
  srcs = ":src",
)
```

To use produce an ivy version you would add:

- Ivy 版を生成するには次のように追加します。

```
ng_experimental_ivy_srcs(
  name = "ivy_srcs",
  srcs = ":src",
)

ts_dev_server(
  name = "server_ivy",
  srcs = [":ivy_srcs"]
)
```

To serve the Renderer2 version, you would run:

- Renderer2 版を serve するには次のように実行します。

```
bazel run :server
```

to serve the ivy version you would run

- Ivy 版を serve するには次のように実行します。

```
bazel run :server_ivy
```

The `ng_experimental_ivy_srcs` rule is only needed when ivy is experimental. Once ivy is released the `ng_experimental_ivy_srcs`, dependent rules, can be removed.

- `ng_experimental_ivy_srcs`ルールは Ivy がエクスペリメンタルである間だけ必要です。
- Ivy がリリースされたあとは、`ng_experimental_ivy_srcs`と依存するルールは削除できます。

---
