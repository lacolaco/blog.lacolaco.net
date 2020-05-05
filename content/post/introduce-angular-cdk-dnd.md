---
title: "Angular CDK drag-and-drop の紹介"
date: 2018-08-29T23:29:16+09:00
tags: [angular, angular-cdk]
---

こんにちは。

この記事では Angular CDK の次期アップデートで提供される、 **drag-and-drop** 機能を紹介します。
執筆時点ではまだ npm パッケージとして公開されていないので、一般に利用できるまでにはもうしばらくかかりますが、
もし早く使いたい方は、次のコマンドで開発版ビルドをインストールしましょう。
なお、開発版ビルドですので自己責任でお願いします。

```
$ yarn add angular/cdk-builds
```

## CDK drag-and-drop

drag-and-drop はその名のとおり、UI 上でのドラッグアンドドロップ操作をサポートするものです。

`@angular/cdk/drag-drop` パッケージから提供される `DragDropModule` をインポートすると、次の 2 つのディレクティブ、コンポーネントが利用できます。

### `cdkDrag` ディレクティブ

`cdkDrag`ディレクティブは、ドラッグされる要素を指定するディレクティブです。このディレクティブを付けられた要素は画面上で自由に位置を変えられます。

たとえば `ng new` 直後のテンプレート HTML で、 `li`要素に `cdkDrag`ディレクティブを付与すると、次のようになります。
（わかりやすさのために `li`要素に CSS でスタイルを付与しています）

```html
<ul>
  <li cdkDrag>
    <h2>
      <a target="_blank" rel="noopener" href="https://angular.io/tutorial"
        >Tour of Heroes</a
      >
    </h2>
  </li>
  <li cdkDrag>
    <h2>
      <a
        target="_blank"
        rel="noopener"
        href="https://github.com/angular/angular-cli/wiki"
        >CLI Documentation</a
      >
    </h2>
  </li>
  <li cdkDrag>
    <h2>
      <a target="_blank" rel="noopener" href="https://blog.angular.io/"
        >Angular blog</a
      >
    </h2>
  </li>
</ul>
```

![](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180829/20180829200010.gif)

`cdkDrag` ディレクティブだけを使うと、何の制約もなく自由に移動することができました。

### `cdk-drop`コンポーネント

このままでは動いて面白い以上の意味がないので、`cdk-drop`コンポーネントを使います。
`cdk-drop`コンポーネントは、`cdkDrag`ディレクティブをグルーピングし、動きに制限をつけて、限られた領域内でだけ移動できるようにします。

たとえば、`ul`要素の外側に `<cdk-drop>` コンポーネントを配置すると、`ul`の内部でだけ移動できるようになり、移動中は並び替えが行われるようになります。

```html
<cdk-drop>
  <ul>
    <li cdkDrag>
      <h2>
        <a target="_blank" rel="noopener" href="https://angular.io/tutorial"
          >Tour of Heroes</a
        >
      </h2>
    </li>
    <li cdkDrag>
      <h2>
        <a
          target="_blank"
          rel="noopener"
          href="https://github.com/angular/angular-cli/wiki"
          >CLI Documentation</a
        >
      </h2>
    </li>
    <li cdkDrag>
      <h2>
        <a target="_blank" rel="noopener" href="https://blog.angular.io/"
          >Angular blog</a
        >
      </h2>
    </li>
  </ul>
</cdk-drop>
```

![](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180829/20180829200735.gif)

見てのとおり、 `<cdk-drop>`タグの内側でだけ並べ替えが行われるようになりましたが、ドロップしてしまうともとの状態に戻ります。
これは`cdk-drop`コンポーネントの仕様で、ドラッグアンドドロップが終了すると、その内部の`cdkDrag`の順序は復元されます。
ただし、ドラッグアンドドロップ終了時には`dropped`イベントが発行されていて、このイベントをもとにコンポーネント側からデータモデルを更新することで、
ドラッグアンドドロップによる並べ替えを実現できます。

### 並べ替え

並べ替えをおこなうためには、リストをコンポーネント側で管理する必要があります。これまでは適当な`li`要素を使っていましたが、AppComponent に次のような`list`プロパティをもたせます。

```typescript
@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  list = ["まぐろ", "サーモン", "えび"];
}
```

そしてテンプレートを次のように変更し、`list`プロパティの要素を繰り返し表示します。先程までと同じように、`<cdk-drop>`タグのなかで繰り返される並べ替えの対象に`cdkDrag`ディレクティブを付与します。

```html
<h2>好きなネタ</h2>
<cdk-drop [data]="list" (dropped)="drop($event)">
  <ul>
    <li *ngFor="let item of list" cdkDrag>
      <h2>{{item}}</h2>
    </li>
  </ul>
</cdk-drop>
```

ポイントは `<cdk-drop [data]="list" (dropped)="drop($event)">` です。`[data]`プロパティには並べ替えの対象となるデータモデルを渡します。
次に、`(dropped)="drop($event)"`では、`dropped`イベントハンドラで`drop`メソッドを呼び出しています。
`drop`メソッドは次のように記述します。

```typescript
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  list = ["まぐろ", "サーモン", "えび"];

  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
  }
}
```

`CdkDragDrop<string[]>`は、`drop`イベントの引数の型です。ジェネリックの`string[]`は並べ替え対象の配列の型を表しています。

`moveItemInArray`関数は、基本的な配列の並べ替えを行ってくれる CDK の機能です。中身は単なる JavaScript の配列の並べ替えですが、Angular チームによる実装にまかせておくのが安心だと思います。

```typescript
export function moveItemInArray<T = any>(
  array: T[],
  fromIndex: number,
  toIndex: number
): void {
  const from = clamp(fromIndex, array.length - 1);
  const to = clamp(toIndex, array.length - 1);

  if (from === to) {
    return;
  }

  const target = array[from];
  const delta = to < from ? -1 : 1;

  for (let i = from; i !== to; i += delta) {
    array[i] = array[i + delta];
  }

  array[to] = target;
}
```

![](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180829/20180829210528.gif)

これで、`drop`イベントによって配列を並べ替えられるようになりました。

### 複数の`cdk-drop`でグルーピングをおこなう

複数のグループを跨いだ並べ替えも可能です。先程の AppComponent を次のように変更します。`list`プロパティを`like`プロパティに改名し、新しく`unlike`プロパティを追加します。

```typescript
@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  like = ["まぐろ", "サーモン", "えび"];
  unlike = ["数の子", "たくあん"];

  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
  }
}
```

テンプレートでは、`like`プロパティと`unlike`プロパティの両方で同じように`cdk-drop`による並べ替えができるようにします。

```html
<h2>好きなネタ</h2>
<cdk-drop [data]="like" (dropped)="drop($event)">
  <ul>
    <li *ngFor="let item of like" cdkDrag>
      <h2>{{item}}</h2>
    </li>
  </ul>
</cdk-drop>

<h2>好きじゃないネタ</h2>
<cdk-drop [data]="unlike" (dropped)="drop($event)">
  <ul>
    <li *ngFor="let item of unlike" cdkDrag>
      <h2>{{item}}</h2>
    </li>
  </ul>
</cdk-drop>
```

ここまでは先程と変わりません。ここから、この 2 つのグループを結合します。
並べ替えグループを結合するには、`cdk-drop`の`connectTo`プロパティを使います。このプロパティに結合の対象となるグループの参照を渡します。

```html
<h2>好きなネタ</h2>
<cdk-drop
  #dropLike
  [data]="like"
  (dropped)="drop($event)"
  [connectedTo]="[dropUnlike]"
>
  <ul>
    <li *ngFor="let item of like" cdkDrag>
      <h2>{{item}}</h2>
    </li>
  </ul>
</cdk-drop>

<h2>好きじゃないネタ</h2>
<cdk-drop
  #dropUnlike
  [data]="unlike"
  (dropped)="drop($event)"
  [connectedTo]="[dropLike]"
>
  <ul>
    <li *ngFor="let item of unlike" cdkDrag>
      <h2>{{item}}</h2>
    </li>
  </ul>
</cdk-drop>
```

さらに、AppComponent の`drop`メソッドで、グループを跨いでいた場合の処理を追加します。
この場合も汎用的なグループ移動機能をサポートする`transferArrayItem`関数が提供されているので、それを使います。

グループを跨いだ移動かどうかは `event.previousContainer` と `event.container` を比較して判定できます。
次のように書けば、一致する場合は配列内での移動を、一致しない場合はグループを越えた移動をおこないます。

```typescript
  drop(event: CdkDragDrop<string[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
  }
```

![](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180829/20180829212028.gif)

これで複数のグループを跨いだドラッグアンドドロップによる並べ替えができるようになりました。

### CSS によるスタイリング

最後に、CDK の drag-drop が提供するスタイリングのための CSS クラスを紹介します。

#### `.cdk-drag.placeholder`

`.cdk-drag.placeholder`クラスは、ドラッグされている要素のプレースホルダ部分につけられる CSS クラスです。たとえばここを次のように見えなくすることで自然な挿入を演出できます。

```css
.cdk-drag-placeholder {
  opacity: 0;
}
```

![](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180829/20180829212513.gif)

#### `.cdk-drag-preview`

`.cdk-drag-preview`クラスは、ドラッグされている要素のプレビュー部分（動かしている部分）につけられる CSS クラスです。たとえば次のように半透明にすることで自然な挿入を演出できます。

```css
.cdk-drag-preview {
  box-sizing: border-box;
  opacity: 0.5;
}
```

![](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180829/20180829212904.gif)

この他にもいくつか CSS クラスがあります。詳しくはスタイリングに関する[ドキュメント](https://github.com/angular/material2/blob/master/src/cdk/drag-drop/drag-drop.md#styling)を参照してください。

## まとめ

- Component Dev Kit の次期アップデートでドラッグアンドドロップがサポートされる
- `cdkDrag`ディレクティブと`cdk-drop`コンポーネントで並べ替えやグルーピングが簡単に実装できる

CDK のアップデートは Angular v7 のリリースと合わせておこなわれるだろうと見られています。
楽しみに待ちましょう。
