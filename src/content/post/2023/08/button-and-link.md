---
title: 'リンクはUI表現か？'
slug: 'button-and-link'
icon: ''
created_time: '2023-08-31T03:22:00.000Z'
last_edited_time: '2023-12-30T10:01:00.000Z'
tags:
  - '雑記'
  - 'HTML'
  - 'UI'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/UI-e735baabfe9f4ecb9944f340b479572a'
features:
  katex: false
  mermaid: false
  tweet: false
---

ButtonとLink、どう実装する？ - Google スライド [https://docs.google.com/presentation/d/1rS7BeO1sqbD9-FGRPkst1TCteXkxvPFlfoQh2fWeEus/edit#slide=id.g23f0f9e1b55_0_185](https://docs.google.com/presentation/d/1rS7BeO1sqbD9-FGRPkst1TCteXkxvPFlfoQh2fWeEus/edit#slide=id.g23f0f9e1b55_0_185)

これを読んでいて思ったこと

- Buttonは間違いなくUI表現（Look and Feel）の名称である
- しかし、LinkはUI表現の名称か？
  - 別の問いで言い換えれば、ButtonとLinkって同レイヤーで並べるものなのか？
- 語義的に考える
  - Link: `[名][C] つながり`
  - 何かと何かをつなげるもの・つながりそのもの
  - 機能っぽい
- 慣例的に考える
  - ところでHTMLの文脈でLinkといえば大きく2種類ある
    - [https://developer.mozilla.org/ja/docs/Web/HTML/Element/link](https://developer.mozilla.org/ja/docs/Web/HTML/Element/link)
    - [https://developer.mozilla.org/ja/docs/Web/HTML/Element/a](https://developer.mozilla.org/ja/docs/Web/HTML/Element/a)
      - [https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element)
  - linkタグ
    > 現在の文書と外部のリソースとの関係を指定します。

    - headタグの中で使われて見た目を持たないので、明らかにこのLinkはUI表現ではない。
  - aタグはAnchorタグである
    > href属性を用いて、別のウェブページ、ファイル、メールアドレス、同一ページ内の場所、または他の URL へのハイパーリンクを作成します。

    - "アンカー" が "リンクを作成" する　主語と述語
    - アンカー: 錨
      - 別の点（リソース）との間にリンクを形成するための点を置くのがアンカーの役割
      - そうするとAnchorというのも機能であり、UI表現ではない
        - だって錨の形してないし
  - であれば、LinkはUI表現ではなく機能としかいいようがない
  - そもそも「ボタンの見た目のリンク」が存在する以上それはそう
- じゃあいわゆる"Link"って、UI表現としてはなんて呼べるんだ？
  - Text Button: 文字だけでフレームを見せないボタン
    - [https://m2.material.io/components/buttons#text-button](https://m2.material.io/components/buttons#text-button)
    - あくまでボタン（押すUI）ということで押し通す
    - しかしこれではテキスト中にインラインで登場するLinkは表現できていなさそう
  - テキスト中にインラインで登場するLink
    - いわゆる「青文字で下線が引かれてカーソルが反応するテキスト」をUI表現上なんと呼ぶのか
    - それは文字色が変わったり下線を引いたり引かなかったりしても通用しないといけない（単にスタイリングの違いなので）
    - じゃあもうそれは Text 以上でも以下でもなくない？
    - インタラクティブなTextというのを一語でいいたい気はする。Intaractable Text（長い）
    - "Link Text" あるいは "Linked Text" と呼べばいいのか？
    - 機能としてリンクを作成しているかどうかは見た目に関係ないので、"Link Button" も "Link Text" も存在していいはず
- だとすると、レイヤーが揃った整理はこうなのでは
  - UI表現: Button / Text
  - 機能（振る舞い）: Action / Link (Anchor)

![image](/images/button-and-link/Untitled.7e6fca0b82d90b02.png)

- つまりですね、「リンク」っていう言葉のあいまいさ（UI表現を指しているのか機能を指しているのか）が残った状態で会話するから混乱が生まれる
- 「ボタンみたいなリンク」ではなく、UI表現としてButtonであり発揮する機能がLinkである
- いわゆる「リンク」を言いたいときは Link TextやらText Linkなどと読んでみてはどうか

