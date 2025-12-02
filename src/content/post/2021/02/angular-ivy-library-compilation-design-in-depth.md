---
title: 'Angular Ivyライブラリコンパイルを理解する'
slug: 'angular-ivy-library-compilation-design-in-depth'
icon: ''
created_time: '2021-02-24T00:00:00.000Z'
last_edited_time: '2023-12-30T10:07:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Ivy-6de3a8dd12c348938a530fd4e5789e65'
features:
  katex: false
  mermaid: false
  tweet: false
---

この記事では Angular v11.1 から可能になった Angular ライブラリの Ivy コンパイルの方法と、その詳細について解説する。 想定する読者は、Angular のサードパーティライブラリを開発している人や、単に Angular の内部構造に興味がある人である。 Angular アプリケーションを開発する上では、この記事で解説する内容を知っていなくても何の問題もない。

この記事の内容は Angular チームによって書かれた Design Doc をベースに、現状の実装での検証を加えて書いている。

[Ivy Library Compilation - Conceptual Design Doc](https://docs.google.com/document/d/148eXrCST6TM7Uo90KxaBrMbOkwJbYrQSQgRaGMK5WRc/edit#)

## ライブラリの Ivy コンパイル方法

Angular CLI などを使って Angular ライブラリを開発するとき、現在はプロダクションビルド時に Ivy は無効化されている。 おそらく `src/tsconfig.lib.prod.json` のようなファイルに次のように設定されているだろう。

```json
{
  "angularCompilerOptions": {
    "enableIvy": false
  }
}
```

この設定でコンパイルされ NPM に公開された Angular ライブラリは、利用するアプリケーションが Ivy を有効にしていなくても使える互換性を保っている。

Angular v11.1 からは実験的に、Ivy 未対応のアプリケーションへの互換性を捨て、Ivy 対応アプリケーションに最適化したコンパイルを行うことができる。 NPM に公開するライブラリを Ivy コンパイルするには、次のように設定する。

```json
{
  "angularCompilerOptions": {
    "enableIvy": true,
    "compilationMode": "partial"
  }
}
```

`"compilationMode": "partial"` が重要なポイントであり、これが意味するところをこの記事の後半で解説する。 当然だがこの設定でコンパイルしたライブラリは Ivy 対応したアプリケーションでしか利用できないので、現在はまだ非推奨である。

ちなみに、Angular CLI や Nrwl/Nx のような monorepo のローカルでだけ使われるライブラリは単純に `enableIvy: true` だけでよい。 `"compilationMode": "partial"`が必要になるのはあくまでも NPM に公開されるものだけである。 この違いについても後半で解説する。

```json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

## 用語の整理

このあとの説明を簡潔にするために、はじめに用語の整理をしておく。

|  |  |
| ------- | ------- |
| 用語 | 意味 |
| Angular デコレータ | `@Component`、 `@Directive`、 `@Injectable`などの Angular が定義するデコレータ |
| コンパイラ | Angular のコンパイラは Angular デコレータを解析して実行コードを生成するツール |
| `ngc` | Angular コンパイラの 実行可能な CLI |
| Ivy コンパイラ | Angular v9 で導入されたコンパイラ |
| View Engine (VE)コンパイラ | Angular v8 までデフォルトで使われていた現在は非推奨のコンパイラ |

## アプリケーションの Ivy コンパイル

ライブラリの話に入る前に、すでに Ivy がデフォルトで有効になっているアプリケーションのコンパイルから見ていこう。 アプリケーション中の Angular デコレータはコンパイラによって解析され、抽出されたメタデータを元に実行コードを生成する。

簡単なコンポーネントのコンパイルの例を見てみよう。次のようなコンポーネントがあるとする。

```
@Component({
  selector: 'some-comp',
  template: `<div> Hello! </div>`
})
export class SomeComponent {}
```

このコードを Ivy コンパイルすると、次のような JavaScript が出力される。 ポイントは次の 2 点である。

- デコレータは JavaScript に残らない
- コンポーネントクラスの static フィールドに生成コードが挿入される

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

Ivy コンパイラはデコレータに含まれるメタデータから _Definition_ を作成するコードを生成する。 文字列だった HTML テンプレートは、**テンプレート関数**として実行可能なコードになる。 テンプレート関数の中で利用される`ɵɵelementStart`や`ɵɵtext`は **テンプレートインストラクション** と呼ばれ、具体的な DOM API の呼び出しやデータバインディングの更新処理などを隠蔽している。

![image](/images/angular-ivy-library-compilation-design-in-depth/ivy-app-compilation.a5c1bf7c3d614f69.png)

このようなアプリケーションのコンパイルは、内部的には 2 つのステップに分かれている。解析ステップとコード生成ステップだ。

### 解析ステップ

コンパイルの解析ステップでは、アプリケーション全体のデコレータから得られたメタデータを統合し、コンポーネント/ディレクティブ間の依存関係を洗い出す。 このとき重要になるのが `@NgModule` である。テンプレートに含まれる未知の HTML タグや属性に対応する参照先を決定するために使われる。 解析ステップが終わると、コンパイラは次の情報を得る。

- どのコンポーネントがどのディレクティブ/コンポーネントに依存しているのか
- 各コンポーネント/ディレクティブをインスタンス化するために必要な依存性はなにか

### コード生成ステップ

コード生成ステップでは、解析ステップで得られた情報を元に Angular デコレータそれぞれに対応するコードを生成する。 コード生成ステップで生成されるコードには**Locality**と**ランタイム互換性**の 2 つが必要とされる。

### Locality

Locality は **self-contained** とも表現される。あるコンポーネントのコンパイル時に必要な参照がすべてそのコンポーネントクラス自身に含められているということである。 これにより差分ビルドが効率的になる。 理解しやすくするために、Locality がなかった Ivy 以前の View Engine 時代の課題を振り返ってみよう。

VE コンパイラは生成コードを元のファイルから独立した `*.ngfactory.js` というファイルとして生成していた。 Angular は実行時にこの `*.ngfactory.js`を実行し、その内部の生成コードが元のコンポーネントクラスを参照する。 このアプローチは、コンポーネントが別のコンポーネントに依存しているときに問題になる。

例えばコンポーネント `<app-parent>` がテンプレート中でコンポーネント `<app-child>` を呼び出しているとき、 `parent.component.ts` から `child.component.ts` へ、JavaScript のモジュールとしての参照はない。 この親子関係が表れるのは、`parent.component.ngfactory.js`と`child.component.ngfactory.js`の間だけである。

直接のコンパイル結果である `parent.component.js` は `child.component.js`と`child.component.ngfactory.js`どちらも参照していないため、いつ再コンパイルされる必要があるのか決定できない。 よって、ViewEngine では差分ビルド時に毎回アプリケーション全体をコンパイルし直す必要があった。

![image](/images/angular-ivy-library-compilation-design-in-depth/ngfactory-dependency-link.ae468cfddf4ba4b1.png)

この問題を解決するために、Ivy コンパイラは生成コードをそのクラスの static フィールドとして生成する。 生成コードには、そのテンプレート内で参照されているディレクティブのクラスも列挙される。 これによって、そのファイルが変更されたときにどのファイルへ影響するのかを簡単に決定できるようになった。

次のように Locality を備えたコード生成であれば、`ParentComponent`の再コンパイルが必要になるのはそれ自身か`ChildComponent`が変更された時だけで十分なことがわかる。

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
    // テンプレートから依存されているディレクティブ
    directives: [ChildComponent]
});
```

### ランタイム互換性

コード生成で重要なもうひとつの要素がランタイム互換性である。 この要素はアプリケーションのコンパイルでは問題にならないが、ライブラリのコンパイルのときに非常に重要になる。

アプリケーションではコンパイルはアプリケーションのビルドの中で同時に行われるため、基本的にコンパイラのバージョンと Angular のランタイムのバージョンは一致する。 だがライブラリはそうではない。

NPM に公開されるライブラリでは、ライブラリをコンパイルした Angular のバージョンと、そのライブラリを使うアプリケーションが実行時に利用する Angular のバージョンが一致しないことを前提にしなければならない。 そこで特に問題になるのは、生成コード内で呼び出される Angular API の互換性である。 コンパイル時のバージョンでは存在した API が、ランタイムの Angular には存在しなかったりシグネチャが変わっていたりする可能性がある。 したがって、**コード生成のルールはそれを実行するランタイムの Angular バージョンで決定されなければならない**。

monorepo 内でローカルに利用されるライブラリが以前から Ivy コンパイル可能だったのは、それが monorepo である限りライブラリとアプリケーションが同じ Angular バージョンであることが確実だからである。

## ライブラリのコンパイル

ここからが本題だ。まずは v11 現在の推奨設定である `enableIvy: false` でのライブラリのコンパイルについて見てみよう。 Ivy を無効化したライブラリのコンパイルは、解析ステップで収集した**メタデータをインライン化**するだけである。 次のように、static フィールドの中にそのクラスに付与されていた Angular デコレータのメタデータが埋め込まれている。

![image](/images/angular-ivy-library-compilation-design-in-depth/library-compilation-ivy-false-1.6fd41277c88ecd15.png)

ライブラリコンパイルは NPM に公開可能な JavaScript の形にメタデータを変換する役割を果たしているが、 これはまだメタデータの状態であり、このままアプリケーションから読み込まれてもコンポーネントとして実行はできない。 このメタデータを元に、もう一度コンパイルが必要である。それを行うのが `ngcc`、**Angular Compatibility Compiler**である。

### ngcc

アプリケーション側のコンパイラが Ivy か VE かがわからない以上、互換性を保つためにはそもそもライブラリコードのコンパイルをアプリケーション側で行ってもらうしかない。 これが`ngcc`がアプリケーションビルド時に実行される目的だ。

`ngcc`のコンパイル結果はライブラリを直接コンパイルしたものと同じになる。 違うのは`ngc`が TypeScript 内のデコレータをメタデータとしてコンパイルするのに対して、`ngcc`は JavaScript 内の`.decorators`をメタデータとしてコンパイルすることだ。

![image](/images/angular-ivy-library-compilation-design-in-depth/library-compilation-ivy-false-2.d28849369b1e0f53.png)

互換性を保った状態でライブラリを NPM に公開可能にする目的は果たした`ngcc`だったが、頻発するコンパイルは開発者体験を損ねることにもなった。 ライブラリをインストールするたびに何度も`ngcc`が走りストレスを感じた人も多いだろう。 `ngcc`は NPM からインストールした`node_modules`内のライブラリコードに対して上書きしてコンパイルを行うため、`npm install` コマンドなどで`node_modules`の中身が変更されたら再コンパイルしなければならない。

だがもともと`ngcc`はアプリケーションの View Engine サポートが廃止されるまでの過渡期のアプローチである。 このあと解説する Ivy ライブラリコンパイラは、`ngcc`で明らかになった課題を克服した、Ivy ネイティブな新しいライブラリコンパイルの仕組みである。

### Ivy ライブラリコンパイル

`ngcc`の最大の課題はコンパイルをアプリケーション側で行う実行コストだった。 もし`ngcc`が十分に高速であれば、`node_modules`の中にコンパイル結果を永続化しなくても、アプリケーションのコンパイル時に Just-in-Time でライブラリをコンパイルすることもできただろう。 実行コストが高いから回数を減らしたいし、結果を保存しておきたくなるのだ。

逆に、ライブラリの公開前にコンパイルを終わらせてしまうと、アプリケーションのビルドは速くなるがランタイム互換性を失ってしまう。 コード生成ステップはどうしてもアプリケーションの Angular バージョンで行われる必要がある。

こうして、ライブラリインストール後に**コード生成ステップだけを高速に実行できる仕組み**、そのために必要になる**NPM 公開前に解析ステップを完了する仕組み**のセットが Ivy ライブラリコンパイルのコンセプトになった。前者の仕組みをライブラリの **リンク (Link)** と呼び、後者の仕組みを**Link-Time Optimization (LTO)コンパイル**と呼ぶ。

### LTO コンパイル (公開前コンパイル)

NPM に公開する前に行う LTO コンパイルは、コンパイル全体の解析ステップだけを完了させ、その結果を JavaScript に埋め込む仕組みである。 冒頭で触れたとおり、`"compilationMode": "partial"`という設定があるとき、コンパイラはライブラリの LTO コンパイルを行う。

```json
{
  "angularCompilerOptions": {
    "enableIvy": true,
    "compilationMode": "partial"
  }
}
```

コンパイル後の JavaScript には次のようなコードが生成されている。 普通のコンパイル結果と同じように見えるが、注目すべきは**テンプレートが文字列のまま残されている**ことと、**Locality を備えている**ことだ。

![image](/images/angular-ivy-library-compilation-design-in-depth/library-compilation-ivy-1.d7abdb8c54e086be.png)

解析ステップにより決定された情報を _Declaration_ という形でインライン化する。 ここには依存しているディレクティブが列挙されており、そのファイルだけの情報でコード生成ステップを実行できる Locality を備えている。 そしてリンクされるまでテンプレート関数のコード生成を先送りすることで、ライブラリはランタイム互換性を担保できる。

また、LTO コンパイルを行った Angular バージョンが添えられているのもポイントだ。 同じテンプレートであっても、それが書かれたバージョンと実行するバージョンの組み合わせによってリンク時に最適化できる余地を残している。

### ライブラリのリンク

LTO コンパイルされたライブラリをインストールしたアプリケーションは、ビルド時にライブラリのリンクを Just-in-Time で行う。 リンクを行う**Linker**は LTO コンパイルで生成された Declaration を元にコード生成ステップを実行して、アプリケーションから呼び出し可能な Definition へ置き換える。

![image](/images/angular-ivy-library-compilation-design-in-depth/library-compilation-ivy-2.41c4240973e757b6.png)

解析ステップが必要だった`ngcc`と違い、リンク処理は LTO コンパイルの Locality によりファイルごとに独立して実行できるため、webpack のようなモジュール解決の中でプラグインとして機能できるようになった。Angular CLI によるビルドでは、`AngularLinker` という Babel プラグインとして実装されている。

## まとめ

新しい Ivy ライブラリコンパイルを簡単にまとめると、次のように説明できる。

- ライブラリのコンパイルを NPM 公開前と後の 2 つに分離する
- ひとつは NPM 公開前にデコレータの解析を終わらせる **LTO コンパイル**処理
- もうひとつはアプリケーションビルド時にコード生成を行い、ライブラリのコンパイルを完了させる**リンク**処理

この記事を読むことで、コンパイルにおけるアプリケーションとライブラリの違い、そして現在使われている`ngcc`の課題を踏まえた上で、新しく導入される Ivy ライブラリコンパイルがどのような目的で設計されたのかを読者が理解できればと思う。

