---
date: "2017-03-08T19:00:00+09:00"
title: "[Angular 4.0] formsモジュールの更新について"
tags: [Angular, Forms]
---

Angular 4.0ではformsモジュールにいくつかの変更が入っています。
追加された新機能と、新しいNgFormの挙動について解説します。

<!--more-->

## `email`バリデータの追加

新たに組み込みの`email`バリデータが追加され、`input[type=email]`要素の値が正しくメールアドレスの文字列になっているかどうか、NgFormがチェックするようになります。
組み込みバリデータなのでこの機能を使うために特別な記述は必要ありません。

## `equalsTo`バリデータの追加

こちらが目玉の機能です。
`equalsTo`バリデータは、入力された値が特定のコントロールの値と同じかどうかを検査してくれるものです。
メールアドレスの確認など、同じ内容を2回入力させるようなフォームで有用です。
使い方は次のようになります。`equalsTo`属性の右辺には一致させたいコントロールの **絶対パス** を設定します。

```html
<form>
    <input type="email" name="mail">
    <input type="email" name="mailConfirm" equalsTo="mail">
</form>
```

もしフォームのモデルが入れ子構造になっているのなら、`.`でパスの階層を表現します。

```html
<form>
    <div ngModelGroup="user">
        <input type="email" ngModel name="mail">
        <input type="email" ngModel name="mailConfirm" equalsTo="user.mail">
    </div>
</form>
```

## デフォルトで`novalidate`が付与されるようになる

Angular 4.0からは、テンプレート中の`<form>`には自動的に`novalidate`属性が付与されるようになります。
これはブラウザ間でのバリデーションの挙動の差を生まないため、formsモジュールが提供するバリデータだけが動作するための変更です。

もちろん元の挙動に戻すことは可能です。`ngNativeValidate`ディレクティブを`<form>`タグに付与することで2系の挙動になります。

```html
<form ngNativeValidate>
```

## まとめ

- `email`バリデータの追加
- `equalsTo`バリデータの追加
- `novalidate`のデフォルト化と、`ngNativeValidate`による回避

次回はcoreモジュールやテンプレートシンタックスに関する変更について解説する予定です。

----
**Angular 4.0 Features**

- [新しいngIfの使い方](/post/ng4-feature-ngif/)
- [Metaサービスの使い方](/post/ng4-feature-meta-service/)
- [formsモジュールの更新について](/post/ng4-feature-forms-update/)
- [core/commonモジュールの変更について](/post/ng4-feature-core-update/)
- [router/http/animationsモジュールの変更について](/post/ng4-feature-libs-update/)