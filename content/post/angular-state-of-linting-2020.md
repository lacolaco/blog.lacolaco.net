---
title: "Angular: ESLintサポートの現状 2020 Autumn"
date: 2020-11-12T09:32:02+09:00
updated_at: 2020-11-12T09:32:02+09:00
tags: [angular, angular-cli, tslint, eslint]
---

Angular v11.0.0のリリースとともに、Angularの開発ロードマップも更新された。
この記事では開発ロードマップから "Migrate To ESLint" が消えたことと、Lintingに関するAngular CLIの動きについて簡単にまとめる。

## TL;DR

要点だけ知りたい人は次のことだけ持ち帰って欲しい。

- TSLintからESLintへの移行はサードパーティの[angular-eslint][]の利用を公式に推奨している
- Angular CLIのデフォルトLinter(TSLint)はv12で非推奨になる

## angular-eslint 

AngularチームがTSLintからESLintへの移行を考え始める以前から、angular-eslintプロジェクトはTSLint+Codelyzerの機能をESLintで再現するツールを開発してきた。
近々angular-eslintのリリースはアルファからベータになり、実戦投入可能なレベルに仕上がりつつある。
これまでCodelyzerが提供してきたTSLintのルールに対応するESLintルールはまだ不完全ではあるが、多くが対応済みだ。

Rules List
https://github.com/angular-eslint/angular-eslint#rules-list


## デフォルトLinterの廃止

当初はAngular CLIのデフォルトLinterをESLintに移行するために、ESLint対応のファーストパーティ実装を追加する方向で進んでいたが、
すでにサードパーティで存在していて活発に開発されているangular-eslintの意向を尊重し、angular-eslintと連携する方針に固まった。

Migration to ESLint · Issue #13732 · angular/angular-cli 
https://github.com/angular/angular-cli/issues/13732#issuecomment-719724640

v12でAngular CLIはデフォルトのTSLintサポートを非推奨にする（おそらくOpt-inに切り替え、利用者に警告を出す）。その後はそもそも"デフォルトLinter"というものを持たないようになる予定だ。
`ng deploy` コマンドと同じように、`ng lint` コマンドはエントリポイントだけを提供し、実体はプラグインが提供するようになるだろう。

v11のリリースブログにも同様のことが書かれている。

Version 11 of Angular Now Available | by Mark Techson | Nov, 2020 | Angular Blog 
https://blog.angular.io/version-11-of-angular-now-available-74721b7952f7

Angular外のエコシステムへ柔軟に対応するためのプラグイン化という側面もあるが、Angularチームの開発リソースをより本質的なプロジェクトへ集中するため、コミュニティに任せられるところは任せたい、ということもあるだろう。

## 今できること

Lintの設定をデフォルトからほとんど変えていないのであれば、v12, v13あたりで公式に推奨されるであろう移行ガイドを待っていてもよいだろう。
もちろん今すぐangular-eslintに切り替えるのも自由だ。

ただ、もしAngularのプロジェクトでTSLintのカスタムルールを今から追加しようとしているのであれば、それはangular-eslintに移行してからESLintのカスタムルールを追加するように切り替えたほうがいいだろう。
特にCodelyzerによるテンプレートASTの解析に依存するカスタムルールであれば、今から新たに追加するのは将来移行するのを難しくする可能性がある。
むしろangular-eslintへ移行した上で足りない機能があれば早めにフィードバックしておくのがオープンソース利用者の振る舞いとしても好ましいだろう。

[angular-eslint]: https://github.com/angular-eslint/angular-eslint
