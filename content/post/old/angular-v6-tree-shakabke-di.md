---
title: "Angular v6で導入されるTree-Shakable DIの紹介"
date: 2018-03-01T15:08:47+09:00
tags: [angular]
---

追記: 最新では `scope` が `providedIn` に変わってます。

{{< embed "https://github.com/angular/angular/commit/db56836425fe200f42e299bce3e76bca0a6021e9#diff-8b97739be3c64aaadb195fe80787c702" >}}

---

Angular v6 では、これまでの Dependency Injection の仕組みを Tree-Shaking 可能にするためのオプション機能を追加します。

概要を説明するために簡単なスライドを作りました。

<iframe src="//slides.com/laco/angular-v6-tree-shakable-di/embed" width="576" height="420" scrolling="no" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

## 現状の問題

現在の Dependency Injection の仕組みでは、Injection されるサービス（**Injectable**）は**Provider**の登録と、**Injector**からの参照の 2 箇所で、静的に参照される必要があります。

![](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180301/20180301145501.png)

たとえどこからも Injection されないサービスでも、Provider を登録する時点で NgModule からの参照が発生するため、ビルド時に不要なコードをふるい落とす*Tree-Shaking*の対象にすることができませんでした。

## 新しいアプローチ

Angular v6 では、`@Injectable`デコレータに機能追加をおこない、参照の方向を変更することで Tree-Shaking 可能な Injectable を作成できるようになりました。
次のように`@Injectable`デコレータの引数に、Injection を解決するスコープとなる NgModule のクラスを指定します。
`useClass`相当の場合はそのままで、`useFactory`や`useValue`相当の場合はファクトリ関数を同時に設定できます。

![](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180301/20180301145857.png)

このようにすることで、NgModule から参照される側だった Injectable が、NgModule を参照する側になります。
つまり、その Injectable を参照する Component や他の Injectable が存在しなければ、どこからも参照されず Tree-Shaking 可能になります。

![](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180301/20180301150137.png)

## 何が嬉しいか

言わずもがな、使われていないサービスのぶんだけバンドルサイズを削減できる点が最大の利点です。
アプリケーションコード中には作成して使われないサービスというのは少ないと思いますが、
たとえば `BrosersModule`や`CommonModule`、あるいは Angular Material の NgModule などに providers として登録されているサービスが Tree-Shaking 可能になれば、
アプリケーションから参照している部分だけのコードをバンドルに含められるようになります。

また、アプリケーションコードにおいても AppModule に溢れかえる大量の providers 地獄を解決できるかもしれません。

かならず対応する必要はありませんが、シビアなバンドルサイズを要求されるプロダクトにとっては嬉しい新機能となるでしょう。
