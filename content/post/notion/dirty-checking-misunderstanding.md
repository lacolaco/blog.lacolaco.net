---
title: 'Dirty Checkingへの誤解'
date: '2023-03-12T02:00:00.000Z'
tags:
  - 'angular'
summary: 'Angular のレンダリングメカニズムや変更検知などの文脈で “Dirty Checking” という用語はよくでてくるが、これが誤って理解されているようなブログ記事や発言を目にすることがある。つまり、「汚い方法での変更検知」という意味で読まれていることがあるが、これは完全に間違っている。'
draft: false
emoji: '💬'
source: 'https://www.notion.so/Dirty-Checking-92bf97dd802c4b39b7527a50b5875273'
---

Angular のレンダリングメカニズムや変更検知などの文脈で “Dirty Checking” という用語はよくでてくるが、これが誤って理解されているようなブログ記事や発言を目にすることがある。つまり、「汚い方法での変更検知」という意味で読まれていることがあるが、これは完全に間違っている。

“Dirty Checking” とは、あるオブジェクトの状態が “Dirty” であるのかどうかをチェックすることである。この文脈では、オブジェクトは “Pristine” と“Dirty” のどちらかの状態を持つと考える。”Pristine”（手つかずの）とは、オブジェクトが何者によっても手を加えられておらず事前状態から変わっていないことを示す。逆に “Dirty” とはオブジェクトが何者かによって手を加えられて事前状態から変化していることを示す。

Angular のレンダリングメカニズムは、コンポーネントの状態が変更されたことを検知して再レンダリングするが、これは言いかえればコンポーネントが Dirty になったことを検知している。Dirty なコンポーネントを検知するとレンダリング処理が実行され、コンポーネントとビューを同期したあとにコンポーネントを Pristine に戻す。これを繰り返している。

`ChangeDetectorRef.markForCheck()` という API はこのメカニズムを象徴している。呼び出し元のコンポーネントを明示的に Dirty 状態に遷移させて、再レンダリングの必要があることをフレームワークに伝えることができる。

{{< embed "https://angular.io/api/core/ChangeDetectorRef#markforcheck" >}}

> Components are normally marked as dirty (in need of rerendering) when inputs have changed or events have fired in the view. Call this method to ensure that a component is checked even if these triggers have not occurred.

同様に、Angular のフォーム API においても各コントロールが Dirty と Pristine の状態を持つ。同じ空文字列であってもユーザーがまだ触れていない状態か、ユーザーが触れた上での空なのかは意味が異なる。この文脈でも `FormControl.markAsDirty()` と`FormControl.markAsPristine()` という API がある。Dirty/Pristine という状態概念は Angular の文脈のなかで一貫した基礎的な用語であるといえる。

したがって、少なくとも Angular の文脈において ”Dirty Checking” というのは変更検知の方法が ”Dirty” であるという意味ではまったくなく、”Dirty” かどうかを検知するという意味以外に解釈の余地はない。