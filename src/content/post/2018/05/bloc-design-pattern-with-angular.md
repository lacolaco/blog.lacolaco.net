---
title: 'FlutterのBLoCパターンをAngularで理解する'
slug: 'bloc-design-pattern-with-angular'
icon: ''
created_time: '2018-05-22T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - '設計'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Flutter-BLoC-Angular-6bbc2bc05d0f4e2eadfb010e6d45fa4b'
features:
  katex: false
  mermaid: false
  tweet: false
---

この記事では AngularDart/Flutter の文脈で新しいコンポーネント設計パターンとして広まりつつある**BLoC**パターンを、Angular の語彙で理解し、実装する方法を紹介する。

## BLoC パターンとは

BLoC とは、**B**usiness **Lo**gic **C**omponent の略である。 BLoC を使ったアプリケーションの実装パターンを BLoC パターンと呼ぶ。

まず誤解を招きそうなポイントとして、この“Component”は React や Angular などでいうところのビューを構築する“コンポーネント”ではない。 一般的な単語としての、アプリケーションを構成するひとかたまりの要素という意味の“Component”なので誤解しないこと。 対比するレベルとしては、“UI Component” vs “Business Logic Component”のようになる。

BLoC は複数の環境向けにアプリケーションを開発するときのコードシェアカバレッジを高めるための、リファクタリング指針のようなものだ。 具体的には、以下の指針を与える。

1. BLoC の入力・出力インターフェースは**すべて Stream/Sink**である
2. BLoC の依存は必ず**注入可能**で、**環境に依存しない**
3. BLoC 内に環境ごとの条件分岐は持たない
4. 以上のルールに従う限り実装は自由である

詳しくは BLoC パターンの初出であるこのセッションを見るとよい。

https://www.youtube.com/watch?v=PLHln7wHgPE

## Angular における BLoC パターン

Angular において BLoC パターンの恩恵がどれほどあるのかは議論の余地があるが、 [https://lacolaco.hatenablog.com/entry/2018/05/15/121514](https://lacolaco.hatenablog.com/entry/2018/05/15/121514) でも述べたようにフレームワークに依存しない部分を明確に分ける、というのは設計指針として重要である。 サーバーサイドでの実行や NativeScript、Ionic、あるいは React/Vue などへの換装など考えても、BLoC パターンはアプリケーションの Angular 依存度を適切に保つために良いルールに思える。

さて、さっそく Angular で BLoC を実装してみよう。 Dart には言語標準の Stream と Sink があるが、JavaScript には[まだ](https://github.com/tc39/proposal-observable)存在しないため、非標準の実装が必要である。 幸運にも Angular は RxJS と相互運用可能なので、RxJS の Observable を Stream に見立てて BLoC を実装することができる。

まずは UI コンポーネントがビジネスロジックを持ってしまった状態の例を以下に挙げる。

[https://stackblitz.com/edit/angular-bloc-example-1?file=src%2Fapp%2Fapp.component.ts](https://stackblitz.com/edit/angular-bloc-example-1?file=src%2Fapp%2Fapp.component.ts)

```ts
@Component({
  selector: 'my-app',
  template: `
    <div cdkTrapFocus [cdkTrapFocusAutoCapture]="false">
      <mat-form-field appearance="outline" style="width: 80%;">
        <input matInput placeholder="Search for..." ngModel (ngModelChange)="onInputChange($event)" />
      </mat-form-field>
    </div>

    <span> {{ preamble }} </span>

    <ul>
      <li *ngFor="let result of results">
        {{ result }}
      </li>
    </ul>
  `,
})
export class AppComponent {
  private query = '';
  results: string[] = [];

  get preamble() {
    return this.query == null || this.query.length == 0 ? '' : `Results for ${this.query}`;
  }

  constructor(private repository: SearchRepository) {}

  onInputChange(query: string) {
    this.query = query;
    this.executeSearch(query);
  }

  private async executeSearch(query: string) {
    const results = await this.repository.search(query);
    this.results = results;
  }
}
```

UI コンポーネントが API の呼び出しや状態の保持などさまざまなビジネスロジックを持っているので、もしこのアプリケーションを別プラットフォームにも展開したくなってもコードが共有できない。

### BLoC の作成

BLoC はポータビリティを考えると、ほとんどの場合は単なるクラスとして宣言される。 ここでは`SearchBloc`クラスを作成する。 もともと`AppComponent`が持っていたビジネスロジックをすべて`SearchBloc`に移動すると次のようになる。

```ts
class SearchBloc {
  private query = '';
  results: string[] = [];

  get preamble() {
    return this.query == null || this.query.length == 0 ? '' : `Results for ${this.query}`;
  }

  constructor(private repository: SearchRepository) {}

  async executeSearch(query: string) {
    this.query = query;
    const results = await this.repository.search(query);
    this.results = results;
  }
}
```

そして`AppComponent`は`SearchBloc`に依存して次のようになる。

```ts
@Component({
  selector: 'my-app',
  template: `
    <div cdkTrapFocus [cdkTrapFocusAutoCapture]="false">
      <mat-form-field appearance="outline" style="width: 80%;">
        <input matInput placeholder="Search for..." ngModel (ngModelChange)="bloc.executeSearch($event)" />
      </mat-form-field>
    </div>

    <span> {{ bloc.preamble }} </span>

    <ul>
      <li *ngFor="let result of bloc.results">
        {{ result }}
      </li>
    </ul>
  `,
})
export class AppComponent {
  bloc: SearchBloc;

  constructor(private repository: SearchRepository) {
    this.bloc = new SearchBloc(this.repository);
  }
}
```

[https://stackblitz.com/edit/angular-bloc-example-2?file=src/app/app.component.ts](https://stackblitz.com/edit/angular-bloc-example-2?file=src%2Fapp%2Fapp.component.ts)

### Observable へのリファクタリング

先述のとおり、BLoC パターンでは BLoC のすべてのインターフェースは Stream でなければならない。 これは Flutter の StatefulWidget や AngularDart の Change Detection の間で、データの変更に対する UI のリアクションのアプローチが違うからだ。 同期的な状態の管理ではプラットフォームごとに特別な処理が必要になる。

一方 Stream であれば Flutter は`StreamBuilder`で Stream からデータが流れてくるたびに再描画する仕組みをもっており、AngularDart も`async`パイプにより同様の反応機構をもっている。 プラットフォームに依存せず非同期的な値を描画するために、Dart の BLoC パターンでは Stream を活用する。

Angular の場合は RxJS が BLoC の実装を助けてくれる。

Dart の Stream を`Observable`、Sink を`Observer`に置き換えると、`SearchBloc`は次のようになる。

```ts
class SearchBloc {
  private _results$: Observable<string[]>;
  get results$(): Observable<string[]> {
    return this._results$;
  }

  private _preamble$: Observable<string>;
  get preamble$(): Observable<string> {
    return this._preamble$;
  }

  private _query$ = new BehaviorSubject<string>('');
  get query(): Observer<string> {
    return this._query$;
  }

  constructor(private repository: SearchRepository) {
    this._results$ = this._query$.pipe(switchMap((query) => observableFrom(this.repository.search(query))));
    this._preamble$ = this.results$.pipe(withLatestFrom(this._query$, (_, q) => (q ? `Results for ${q}` : '')));
  }

  dispose() {
    this._query$.complete();
  }
}
```

`results: string[]`が`results$: Observable<string[]>`になり、`preamble: string`も`preamble$: Observable<string>`となった。 これらは`query`の変更に反応して変化する非同期的な値として表現される。

`query`は`Observer<string>`インターフェースを外部に公開し、新しい値の追加を UI に許可する。 `SearchBloc`の内部では`_query$: BehaviorSubject<string>`を実体として持ち、コンストラクタでは`_query$`に反応する`_results$`と`_preamble$`が宣言されている。

これを`AppComponent`から使うと次のようになる。テンプレート中で`async`パイプを使い、Observable の変更に反応してビューの再描画が実行されるようになる。

```ts
@Component({
  selector: 'my-app',
  template: `
    <div cdkTrapFocus [cdkTrapFocusAutoCapture]="false">
      <mat-form-field appearance="outline" style="width: 80%;">
        <input matInput placeholder="Search for..." ngModel (ngModelChange)="bloc.query.next($event)" />
      </mat-form-field>
    </div>

    <span> {{ bloc.preamble$ | async }} </span>

    <ul>
      <li *ngFor="let result of bloc.results$ | async">
        {{ result }}
      </li>
    </ul>
  `,
})
export class AppComponent {
  bloc: SearchBloc;

  constructor(private repository: SearchRepository) {
    this.bloc = new SearchBloc(this.repository);
  }

  ngOnDestroy() {
    this.bloc.dispose();
  }
}
```

[https://stackblitz.com/edit/angular-bloc-example-3?file=src/app/app.component.ts](https://stackblitz.com/edit/angular-bloc-example-3?file=src%2Fapp%2Fapp.component.ts)

これで BLoC の実装が完了した。

## 考察

- Angular アプリケーションを RxJS ベースで設計・実装をしていれば自然と似たような形になっているはず。
- BLoC はそのパターンに名前をつけ、ビジネスロジックのクラスにインターフェースの制約を設けたもの。
- Angular のコンポーネントは Angular 環境での依存性を、DI を使って供給する役割も果たすことになる。
  - BLoC を持つコンポーネントは Container, BLoC を持たないコンポーネントは Presentational、と呼べそうでもある。
- UI コンポーネントはテストしにくいので、ビジネスロジックを BLoC に逃がすことでテスタビリティが高くなるのは目に見える恩恵のひとつ。

## まとめ

- BLoC はクロスプラットフォーム開発でのコードシェアリングを促進するための実装パターン
- Flutter/AngularDart でのコードシェアリングのために生まれたが、Dart だけのものではない
- Angular では RxJS の Observable を使って実装できる。
- Angular だけの単一プラットフォームであっても、ビジネスロジックのテスタビリティを高めることができる。
