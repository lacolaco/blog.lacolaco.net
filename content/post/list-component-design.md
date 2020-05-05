---
title: AngularにおけるListComponent/ListItemComponentの設計
date: 2019-02-18T00:47:00.000Z
tags: [angular, design, component-design]
---

`<ul>` と `<li>` のように、親子であることに意味がある密結合したコンポーネントを作るときのプラクティスについて。

例として、 メニューを表示するための `MenuListComponent` を考える。Input として表示するメニューの要素 ( `MenuItem` 型) の配列を受け取り、それを ngFor で表示するものだ

```ts
@Component({
  selector: 'menu-list',
  template: `
  <ng-container *ngFor="let item of items">
    <a class="menu-list-item" [href]="item.url">{{item.label}}</a>
  </ng-container>
  `,
  styles: [`
  :host { display: flex; flex-direction: column; }
  .menu-list-item { flex: 0 0 25%; }
  `]
})
export class MenuListComponent {
  @Input() items: MenuItem[];
}
```

使う側は次のようになる。シンプルに Input で渡しているだけだ。

```ts
@Component({
  selector: 'app-root',
  template: `
  <menu-list [items]="menuItems"></menu-list>
  `
})
export class AppComponent {
  menuItems = [
    { url: '#foo', label: 'foo' },
    { url: '#bar', label: 'bar' },
  ];
}
```

この設計には特筆するほどの欠点はないが、UI コンポーネントというのは得てしてある日突然にデザインや振る舞いに仕様変更が加わるものだ。

例えば、「メニューの中でグループを 2 つに分けて、divider で区切って表示したい」とか「新登場の要素を先頭に表示してバッジを付けて強調したい」とか、思いつくことはたくさんある。それらを将来的に吸収できるコンポーネントかというと、問題がある。ngFor を `MenuListComponent` に任せていることから、配列をどのように反復して表示するか、順序やグループ分けというものが UI コンポーネントである `MenuListComponent` の責務になっている。つまり、UI とコンテンツの責務が混在している。これを解決するには、コンテンツの責務を切り出してあげるほかない。

次のように、 `<ng-content>` を使ってリストの中身を外からもらうようにする。 ngFor をおこなう=コンテンツの責務を持つのはアプリケーション側だ。ただし `menu-list-item` クラスの CSS を `AppComponent` が持つのは UI の責務が漏れてしまうので、その責務を持つための `MenuListItemComponent` を作成する必要がある。URL やラベルは `MenuListItemComponent` の Input として渡すことになる。

`<ng-content>` で渡される要素は Shadow DOM の外から与えられるので、 `MenuListComponent` から `MenuListItemComponent` へ子孫セレクタでのアクセスはできないことに注意が必要だ。

    @Component({
      selector: 'menu-list',
      template: `<ng-content></ng-content>`,
      styles: [`
      :host { display: flex; flex-direction: column; }
      `]
    })
    export class MenuListComponent {}

    @Component({
      selector: 'menu-list-item',
      template: `<a [href]="url">{{label}}</a>`,
      styles: [`
      :host { flex: 0 0 25%; }
      `]
    })
    export class MenuListItemComponent {
      @Input() url: string;
      @Input() label: string;
    }

結果として、 `AppComponent` は次のようになる。

    @Component({
      selector: 'app-root',
      template: `
      <menu-list>
        <menu-list-item *ngFor="let item of menuItems" [url]="item.url" [label]="item.label"></menu-list-item>　
      </menu-list>
      `
    })
    export class AppComponent {
      menuItems = [
        { url: '#foo', label: 'foo' },
        { url: '#bar', label: 'bar' },
      ];
    }

メニューのコンテンツについては、そのデータのすべての裁量をアプリケーション側で握れている。それでいながらリストの UI は `MenuListComponent` と `MenuListItemComponent` で担保できている。万が一配列が複数になろうとも、それは `AppComponent` 側で解決できる。

ここで次の問題は、リストの UI を管理する CSS が 2 箇所に分散してしまっていることだ。 `MenuListItemComponent` は、親の `MenuListComponent` が Flexbox であることに暗黙的に依存している。 `MenuListComponent` が `display: grid` に変えるときに見落とす可能性が高い。そのため、できればリストの親子のスタイルは一か所に集まっていてほしい。

ここで便利なのが、Sass の `mixin` と `include` を使った手法だ。まずはリストの構造にかかわるスタイルを `menu-list-base.scss` ファイルに記述する。

    @mixin menu-list() {
      display: flex;
      flex-direction: column;
    }

    @mixin menu-list-item() {
      flex: 0 0 25%;
    }

次に、 `MenuListComponent` と `MenuListItemComponent` のスタイルをそれぞれ `.scss` ファイルに外部化し、それぞれから `menu-list-base.scss` ファイルを参照する。そしてそれぞれの `:host` スタイルの中で対応する mixin を `@include` する。

    // menu-list.component.scss
    @import "menu-list-base";

    :host {
      @include menu-list();
    }

    // menu-list-item.component.scss
    @import "menu-list-base";

    :host {
      @include menu-list-item();
    }

このようにすればリストの親子間で一貫する必要があるスタイルを 1 ファイルに集約しつつ、各コンポーネントのスタイルではそれ以外の関心に集中できる。たとえば `MenuListItemComponent` の背景色やボーダーなどはリストには関係ないことなので `menu-list-item.component.scss` に直接記述するほうがよい。

実際に動作するサンプルがこちらだ。

[angular-u3f21w - StackBlitz](https://stackblitz.com/edit/angular-u3f21w?file=src%2Fapp%2Fapp.component.html)

このように、親子の結合が強い UI 構造をコンポーネント化する際には Sass の mixin 機能を使うことでシンプルにスタイルを集約できる。Angular CLI であればデフォルトで Sass ファイルをサポートしているので準備はまったく不要だ。

また、UI を責務とするコンポーネントからはデータの構造やコンテンツへの関心を極力排除するほうが好ましい。UI コンポーネントはひたすら見た目とユーザーインタラクションに集中し、コンポジションによってコンテンツを表示しよう。UI コンポーネントというのは複数コンテキストで共有するのが前提なのだから、コンテキストには無関心でなければアプリケーション間の横のつながりを生んでしまうのだ。
