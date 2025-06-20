---
title: 'ECMAScriptのimport/exportについてのメモ'
slug: 'esmodule-export-import'
icon: ''
created_time: '2018-06-26T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'ECMAScript'
  - 'JavaScript'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/ECMAScript-import-export-4a2c1ab7cb284e92a201925dee868227'
features:
  katex: false
  mermaid: false
  tweet: true
---

js-primer という JavaScript の本を書く上で ES2015 の import/export 構文の仕様について気になったところがあって調べたメモ

https://github.com/asciidwango/js-primer/pull/505

https://twitter.com/laco2net/status/1011466070387904512

https://twitter.com/laco2net/status/1011466632210743297

https://twitter.com/laco2net/status/1011467526927052800

https://twitter.com/laco2net/status/1011467908134809600

https://twitter.com/laco2net/status/1011468925152870400

## デフォルトエクスポートの扱い

まず、デフォルトエクスポートする方法がふたつある。ひとつは専用の`export default`文によってエクスポートする方法。

```javascript
export default function () {}
```

また、`default`という名前で名前付きエクスポートすれば、それもデフォルトエクスポートしたことになる。

```javascript
function foo() {}
export { foo as default };
```

デフォルトエクスポートが`default`という固有名がつけられることは、Spec の https://www.ecma-international.org/ecma-262/6.0/#sec-exports-static-semantics-exportentries にかかれている。

{{< figure src=“https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180626/20180626135151.png” caption=“default expor”>}}

## デフォルトエクスポートをインポートする方法

デフォルトエクスポートされたものをインポートする方法もいくつかある。ひとつは一番シンプルなデフォルトインポート用の専用構文を使う。

```javascript
import otherDefault from 'other.js';
```

ところでこれは名前付きインポートで次のように書き換えられる。先程デフォルトエクスポートで書いたように、デフォルトエクスポートは`default`という固有名でエクスポートされていることを利用できる。

```javascript
import { default as otherDefault } from 'other.js';
```

この構文、MDN の import 文のところには書かれていない。

{{< embed “https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements/import” >}}

ちなみに、`default as`というのは専用の構文ではなく、`as`によるエイリアス付きインポートの構文が適用されており、仕様上では`default`は特別なキーワードではなくただの IdentifierName として扱われているはず。 次のコードで default と foo は仕様上同じもので区別できない。

```javascript
import { default as otherDefault, foo as otherFoo } from 'other.js';
```

https://www.ecma-international.org/ecma-262/6.0/#sec-imports-static-semantics-boundnames

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180626/20180626135841.png)

しかし、次のコードはシンタックスエラーになる。`as`によるエイリアスを使わない場合には、`default`と`foo`は等価ではなくなる。 なぜなら`default`は ECMAScript の予約語であるからだ。

```javascript
import { default, foo } from "other.js";
```

https://www.ecma-international.org/ecma-262/6.0/#sec-keywords

ここの肝は、Import 構文の ImportsList というもので、これは ImportSpecifier のリストだが、ImportSpecifier は ImportedBinding あるいは`identifierName as ImportedBinding` と定義されている。

https://www.ecma-international.org/ecma-262/6.0/#sec-imports

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180626/20180626140548.png)

つまり、`import { default }` と書いたときの`default`は`ImportedBinding`として扱われるが、これはシンボルとして参照可能なので予約語のチェックに違反する。

一方で、`import { default as alias }`と書いたときの`default`は`identifierName`であって、`ImportedBinding`ではなくなり、予約語のチェックから外れる。

結果的に、`default as`はまるで普通のエイリアスされた名前付きインポートのように振る舞うことができる。 しかし仕様上は`import { default as ...}`構文というのは存在していないが、デフォルトエクスポートや予約語の仕様が絡んだ結果、事実上の構文っぽいものになっているのがややこしい。

MDN の構文例は export と import どちらも、デフォルトエクスポートが`default`という名前付きエクスポートとして振る舞っている例を扱っていないが、 これは仕様が複雑で説明が難しいからされてないんだろうか。

とりあえず自分の中で整理がついたので良し。
