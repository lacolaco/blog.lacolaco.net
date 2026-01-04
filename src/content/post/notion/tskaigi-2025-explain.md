---
title: 'TSKaigi 2025「SignalとObservable ― 新たなデータモデルを解きほぐす」補足解説'
slug: 'tskaigi-2025-explain'
icon: ''
created_time: '2025-05-31T02:05:00.000Z'
last_edited_time: '2025-05-31T02:12:00.000Z'
tags:
  - 'TypeScript'
  - 'Signals'
  - 'パターン'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/TSKaigi-2025-Signal-Observable-2033521b014a80d98b70f882faed196e'
features:
  katex: false
  mermaid: false
  tweet: false
---

先日TSKaigi 2025で話した「SignalとObservable ― 新たなデータモデルを解きほぐす」についての補足解説をする。当日は時間の関係で端折った部分や、登壇後のAsk the speakerでいただいた質問に対する見解なども含めている。

https://blog.lacolaco.net/posts/tskaigi-2025-slide/

## Signalを解きほぐす

3部構成の初め、Signalについては以下のように論を展開した。

- ECMAScriptへの提案からモチベーションを探る
- Signalと呼ばれる構造の基本的要素をカウンターアプリの例から理解する
- 基本的要素が既存のSignal実装にも共通することを確認する
- Signalと呼ばれるパターンがどのように成立してきたか系譜をたどる
- 現代のJavaScriptでSignalが求められている背景を理解する

### Effectの困難さ

この中で、Signalベースのリアクティビティの基本3要素として “State”, “Computed State”, “Effect” を挙げたが、”Effect”について補足する。

発表中にも少しだけ触れたが、現状ではEffectにあたる機能を標準化するのはなかなか困難だ。[現在のSignalsの提案](https://github.com/tc39/proposal-signals)の中でも、`effect` についてはスコープ外で、他のSignalプリミティブをベースに各ライブラリやフレームワークが`effect`に相当するものを実装することを想定している。

```typescript
const counter = new Signal.State(0);
const isEven = new Signal.Computed(() => (counter.get() & 1) == 0);
const parity = new Signal.Computed(() => isEven.get() ? "even" : "odd");

// A library or framework defines effects based on other Signal primitives
declare function effect(cb: () => void): (() => void);

effect(() => element.innerText = parity.get());

// Simulate external updates to counter...
setInterval(() => counter.set(counter.get() + 1), 1000);
```

そもそものモチベーションにあるように、Signalは状態の変更をリアクティブにUIへ反映させるためのものだった。そしてUIのレンダリングアルゴリズムは各ライブラリやフレームワークが開発者体験やパフォーマンス最適化のために磨き込み、しのぎを削っている部分である。

たとえば、Signalに新たな値をセットしたタイミングですべて同期的に処理することもできるし、新たな値がセットされたときにタスクをキューに積んで非同期的に処理することもできる。頻繁に状態が変わると再描画のコストが高い場合、ある程度の時間的ウィンドウを設けて一定時間内に起きた変更をバッチ処理でまとめて反映する戦略もありうる。

Signalの状態変化をどういうタイミングでUIに反映させるのか、そのスケジューリング戦略はUIライブラリ・フレームワークの根幹に関わる部分なので、標準化は難しいだろう。そのスケジューリング戦略こそが`effect`をどう実装するかとイコールなので、今回の標準化提案ではその難しい部分をスコープ外にして、まずは`State`と`Computed`の2つをプリミティブなインターフェースにすることを優先していると思われる。

### 標準化の難しさ

Signalを標準化しようという提案に対してかならず向けられる反対意見は、「ライブラリで実現できてるならそれでいいのでは？」というものだ。達成したいモチベーションがかならずしもECMAScriptへの仕様追加がなくても実現できるのなら、仕様はできるだけ小さくとどめておくのが将来のためだろう。

この点に関して提案側の言い分はこうだ。

- 相互運用性、再利用可能性による利点
  - 状態管理に関する実装が組み込み機能への依存になれば、UIライブラリ・フレームワークを変更するときにも影響を受けず再利用ができる。異なるUIシステムに対して相互運用可能な共通基盤を実装することができる。
- パフォーマンス最適化
  - Signalの変更追跡アルゴリズムがブラウザのネイティブレイヤー（C++など）で実装されることによるオーバーヘッドの軽減は大きいと見ている
  - またJSファイルのサイズが減らせることによる読み込みパフォーマンスの改善も見込まれる
- デバッガビリティ
  - Signalを使ったコードのデバッグは内部状態を追跡したり、リアクティビティの依存関係を視覚化するニーズがあるが、別々の実装だとそれぞれでDevTool的なものを作る必要がある。標準化されればブラウザの標準DevToolでデバッグできるようになる。

これらの利点を踏まえても、現に標準化されなくとも使えている現実がある以上、標準化の必要性についてはやや不利なように思う。しかし、かつてこれと同様の状況にあったと思われるのは、いまや当たり前になっているPromiseの標準化だ。

Promiseもかつてはデファクトスタンダード的なライブラリだったものがECMAScriptに組み込まれたもので、標準化以前からPromiseというものはあったし、使われていた。当時も「ライブラリでいいじゃん」という不要論はあったはずだ。それでもPromiseは標準化され、いまとなってはほとんどの非同期APIの共通インターフェースとして定着している。そして`async/await` のような構文の追加にも発展している。

今のSignal標準化に対する不要論は妥当だと思いつつ、もしかするとSignalがPromiseのようにいずれ定着した先、Signalを前提としてその上に新たな言語機能が生まれるチャンスを摘んでしまうのではないかと自分は考えている。そういう目線で今後の動向に期待している。

## Observableを解きほぐす

第2部も同様に、Observableについて以下のように論を進めた。

- ECMAScript, W3Cへの提案からモチベーションを探る
- Observableと呼ばれる構造の基本的要素を簡単な例から理解する
- 基本的要素が既存実装にも共通することを確認する
- Observableと呼ばれるパターンがどのように成立してきたか系譜をたどる
- 現代のJavaScriptでObservableが求められている背景を理解する

### C#におけるLINQとRx

発表では時間の関係で途中のC#におけるLINQとRxの話をだいぶ端折ってしまった。

JavaScriptの`Iterable<T>`に相当するC#のインターフェースは`IEnumerable<T>` という。JavaScriptと同じく配列やジェネレータなど反復可能なオブジェクトだが、C#ではLINQ（統合言語クエリ）という機能で`IEnumerable<T>` インターフェースの利便性を高めている。

次の例では、配列 `numbers` に対して `.Where` と `.Select` という値をクエリするメソッドをつなげて`results`を生成している。これは配列型固有のメソッドではなく、`IEnumerable<T>` インターフェースに対して共通に後付けされる**拡張メソッド**である。

![image](/images/tskaigi-2025-explain/image.73fadffb5b730a29.png)

C#の拡張メソッド（メンバー）というのは、次のように特定の型に対してメンバー変数を追加できる機能である。以下の例では、文字列型`string`に対して`WordCount`メソッドを追加する拡張を加えている。

https://learn.microsoft.com/ja-jp/dotnet/csharp/programming-guide/classes-and-structs/extension-methods

```csharp
namespace CustomExtensionMembers;

public static class MyExtensions
{
    extension(string str)
    {
        public int WordCount() =>
            str.Split([' ', '.', '?'], StringSplitOptions.RemoveEmptyEntries).Length;
    }
}
```

これと同じことが`IEnumerable<T>`にも行われている。さっきの配列をクエリするコードは、データソースをジェネレータに変えても全く同じである。

![image](/images/tskaigi-2025-explain/image.78121d959d81f7d6.png)

この考えを非同期データソースにも適用しようということで生まれたのがReactive Extensionsと`IObservable<T>`だ。データソースが非同期的に値が流れてくるストリームであっても、`results`を作る宣言的なクエリの部分はほとんど変わっていないことがわかる。

![image](/images/tskaigi-2025-explain/image.76fbe5f8bed19204.png)

### 標準化への道

Observableの標準化への動きは今に始まったものではない。ECMAScriptへの追加提案が出されたのは2015年頃、RxJSとAngularの開発チームが中心だったが、これはほとんど前進せずに頓挫した。その後DOM APIへの組み込みに絞ったスコープで2017年頃から再始動し、それもなかなか難航したが、ようやくChromeに実装されるまでに至った。

このあたりのことはWCIGの提案の中にもまとまっているので一読するといい。

[https://github.com/WICG/observable?tab=readme-ov-file#history](https://github.com/WICG/observable?tab=readme-ov-file#history)

Observableの標準化の困難さはいろいろあるが、まずひとつはブラウザにしろNode.jsにしろ、すでにストリームを扱うインターフェースがあることだ。

https://developer.mozilla.org/ja/docs/Web/API/Streams_API

https://nodejs.org/api/stream.html

これらはそれぞれWHATWG、Node.jsのものなので、ECMAScriptの仕様ではない。とはいえ現実的にはストリームデータを扱うということだけなら事足りている現状というのはある。

Observableが既存のStreamインターフェースと比べて優位性がある部分はおそらく宣言的なパイプライン構築の部分など開発者体験が主になりそうだが、それだけならライブラリのままでいいという不要論は退けられないだろう。

Signalと同じくブラウザに組み込まれることによるパフォーマンス最適化や相互運用性の利点はあるにせよ、すでに標準化されているAPIとの間の棲み分けの点ではSignalよりもさらに困難かもしれない。

## Choosing a model

最後に、抽象化モデルの選択について話しながら結論へと向かった。

### 「不在=必要」ではない

発表スライドでは次の図を使って、SignalとObservableがそれぞれ現在のECMAScriptにおける「不在」を埋める抽象化モデルであると話した。だが、これらが「不在」だからといって、「必要」であるかどうかとはまったく別の話だ。

![image](/images/tskaigi-2025-explain/image.664c583e82fd553e.png)

むしろ「不要」だからこそ、これまで不在だったのだと考えることもできる。つまり、JavaScriptという言語が適用される問題領域に対して、今の仕様で十分に解を与えられているならそれ以上に広げる必要はないということだ。

だからこそ、こうした「不在」を「必要」に変えるためには新たな問題設定が重要で、エコシステムが取り組む問題領域のほうが広がっているのだという主張しないといけない。「今のJavaScriptでは解けない問題がある」ということに合意を形成できるかどうかにかかっている。それが特定のアーキテクチャ、特定の思想に閉じた問題であれば、標準化への道は険しくなるだろう。「まさしく問題なるものはない」のである。

https://blog.lacolaco.net/posts/there-is-no-problem/

## まとめ

以上、発表で話せなかった、伝わりにくかったと思われる部分の補足解説をした。結局のところ、この発表を通じて言いたかったことは2つ。具体的な物だけを見るのではなく構造とパターンを取り出し、そのパターンの背後にある原則や原理、そして価値観を把握することで、はじめて意味が見えてくるということ。もうひとつは、そのようにパターンは、言語を超えて紡がれている通時的な系譜の連続性と、共時的な発展の多様性の両方に視野を広げておくことで見つけやすくなるということ。やはり『達人プログラマー』の教えのとおり、毎年新しいプログラミング言語をひとつ習得するのは大事なことだ。

