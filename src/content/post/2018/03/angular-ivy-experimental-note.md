---
title: 'ngIvyメモ'
slug: 'angular-ivy-experimental-note'
icon: ''
created_time: '2018-03-11T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/ngIvy-ecaa239cf616409c80b826b507a161f6'
features:
  katex: false
  mermaid: false
  tweet: false
---

[DESIGN DOC (Ivy): Separate Compilation を読む](../read-ivy-design-doc-separate-compilation/)

ngIvy の Separate Compilation についてのプロポーザルを読み、実装中の Renderer3 のコードを読み、ベータ版の compiler が生成するコードを読み、毎晩毎晩考えを巡らせた結果、ngIvy についてある程度体系的な理解が得られたという錯覚があるので、ここで言語化しておきます。 単なるメモなので、何か伝えたいとかではないです。https://ng-sake.connpass.com/event/80734/ の話のネタにはなるかもしれません。

また、予め断っておきますが、この内容は Angular の内部処理を理解している上級者向けです。これはブラックボックスの内側です。 これがわからないからといって Angular が使えないわけではないですし、まったく自信を失わなくてよいです。 知らないほうが素直にライブラリを使える可能性のほうが高いです。

## いままでの AoT コンパイル

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180310/20180310123120.png)

v5 までの AoT コンパイルは、以下の流れで `greeting.component.ts`をコンパイルします。

1. **Analysis phase**: AoT コンパイルのエントリポイントとなる NgModule から再帰的にすべての参照をたどり、以下の操作をおこなう。
   1. それが`.ts`ファイルである場合は、そのファイルから export されているすべてのシンボルを`.metadata.json`に記録し、関連付ける
   1. それが`.js`ファイルである場合は、隣接する`.metadata.json`を関連付ける
1. **Codegen phase**: 1 でコンパイルに関連付けられたすべての`.metadata.json`について、以下の操作をおこなう
   1. `.metadata.json`に`@Component`や`@NgModule`などの Angular デコレータが存在する場合は、それぞれについて NgFactory の TypeScript コードを生成する
   1. 生成された TypeScript コードをコンパイルし、`.ngfactory.js`を生成するか、型チェックが通らない場合はエラーを出力する
1. **Compilation phase**: 通常の`tsc`の挙動と同じようにすべての`.ts`ファイルをコンパイルする

すべての操作が正しく完了すると、AoT コンパイルが成功します。 結果として、`GreetingComponent`に対して出力されるファイルは次の 3 つです。

### greeting.component.js

`greeting.component.ts`を JavaScript にコンパイルしたものです。 コンパイル過程で、デコレータの情報は静的フィールドに変換されることがあります。 ( `annotationsAs` オプション )

### greeting.component.ngfactory.js

`greeting.component.js`から export される`GreetingComponent`を、Angular がコンポーネントとして利用するために機械生成されたコードで、 `GreetingComponentNgFactory`クラスを export します。 `GreetingComponentNgFactory`クラスの主な役割は次の 2 つです。

- `GreetingComponent`のインスタンス生成: コンストラクタで要求する引数の解決（Dependency Injection の実行）
- `GreetingComponent`のビュー生成: テンプレートから生成されるビュー組み立て関数の提供

### greeting.component.metadata.json

`greeting.component.ts`を静的解析した結果得られたメタデータです。[公式ドキュメント](https://angular.io/guide/aot-compiler#phase-1-analysis)ではある種の抽象構文木(AST)と見ることもできると書かれています。 メタデータは NgFactory の生成だけでなく、language-service によるテンプレートエラー検知にも使われています。

メタデータ中に保存される情報は、**TypeScript の型情報 + Angular デコレータ中の値情報** です。前者だけであれば`.d.ts`ファイルで事足りますが、NgFactory の生成には`@Component`などのデコレータに渡される実際の値情報が必要になるため、ngc はこれを`*.metadata.json`という形で記録します。

## で、ngIvy って何？

ここからが本題で、上述のコンパイル処理は ngIvy により次のように変わります。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180311/20180311131044.png)

ngIvy 方式の AoT コンパイルは、以下の流れで `greeting.component.ts`をコンパイルします。

1. **コンパイル対象の**`.ts`**ファイル**について、以下の操作をおこなう
   1. Angular デコレータが存在する場合は、それぞれのデコレータに対応した Angular 定義を TypeScript コード中に生成し、対応するメタデータを`.metadata.json`に記録する
   1. TypeScript コードをコンパイルし、`.js`を生成するか、型チェックが通らない場合はエラーを出力する

それぞれのデコレータに対応する定義とメタデータについては [DESIGN DOC (Ivy): Separate Compilation を読む](../read-ivy-design-doc-separate-compilation/) を参照してください。

### 手書き定義と脱 ngc

ngIvy のコンパイル過程において、「Angular デコレータが存在する場合は、それぞれのデコレータに対応した Angular 定義を TypeScript コード中に生成」と書きましたが、 裏を返せば「Angular デコレータが存在しなければただ TypeScript をコンパイルするだけ」ということです。

ngIvy では、本来は Angular デコレータから生成される`ngComponentDef`や`ngInjectorRef`のような定義を事前に TypeScript 中に記述しておくと、ngc におけるコード生成過程をスキップできます。 機械生成された定義と手書きの定義は区別されないため、この場合は`ngc`ではなく`tsc`だけでコンパイル可能です。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180311/20180311131157.png)

手書きでなくとも、例えば Babel や他のシステムによってソースコードが変換されたとしても、最終的に ngIvy の期待する出力があれば、Angular の AoT コンパイル結果として受け入れられます。 プラグインさえ書けば JSX から Angular コンポーネント定義を生成することも不可能ではないでしょう。

このポイントは、

- ngIvy により `@Component` などの Angular デコレータは「Angular 定義を生成する手段のひとつ」となる。
- サードパーティのツールやマニュアルでの記述により、Angular デコレータを排除したピュアな JavaScript としてコンポーネントを作成できるようになる。

実際に ngIvy によって、`tsc`と`rollup`だけで動作するアプリケーションのサンプルは[こちら](https://github.com/angular/angular/tree/master/integration/hello_world__render3__rollup)です。

この例では`HelloWorld`コンポーネントは`@Component`デコレータを持たず、`ngComponentDef`を手書きしているので、コンパイルは`tsc`だけで完了します。

### 分離コンパイル

ngIvy では従来の AoT コンパイルの非効率性を解決することに重きをおいています。ここでいう非効率性とは、

- NgFactory の生成はアプリケーションコンパイル時にしかおこなえない（npm ライブラリは NgFactory を含まない`.js`ファイルと NgFactory の元になる`.metadata.json`を提供する必要がある）
- NgModule のスコープ内で何かしらの変更があった場合には、その NgModule ごと再コンパイルして metadata.json や NgFactory を再生成する必要がある

重要なポイントは、このプロポーザルにおいてはこれらを解決するために、ngIvy による AoT コンパイルは単純にデコレータをもとにコードを変換する仕組みになっていて、アプリケーション自体の整合性を担保する役割は失っていることです。

> Ivy においては、ランタイムはこれまではコンパイラによって事前計算されたもののほとんどを、実行時に処理することで分離コンパイルを可能にする方法で作られています。

とあるように、アプリケーションが実行可能かどうかのチェックは事前計算ではなく JIT での処理に切り分けられると予想されます。 この場合、Language Service とどのように協調するのかは今のところ不明です。

### 今後

上記仕様はまだ実装されていない（定義の生成部分は見て取れるけど、まだ`.metadata.json`の生成が古いように見える）ので、分離コンパイルが最終的にどういう形になるのかはまだ観察が必要です。とはいえ、現状では ngIvy のターゲットはライブラリとアプリケーションだけでパッケージは対象外なので、実質的に`.metadata.json`は不要といえば不要なのかもしれません。

