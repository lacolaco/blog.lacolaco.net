---
title: 'Angularドキュメント用にGemini + TextlintのMarkdown翻訳ツールを作った'
slug: 'ai-markdown-translator-with-gemini-textlint'
icon: ''
created_time: '2025-06-17T12:29:00.000Z'
last_edited_time: '2025-06-17T12:42:00.000Z'
tags:
  - 'Angular'
  - 'Markdown'
  - 'AI'
  - 'LangChain'
  - 'Gemini'
  - 'Textlint'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Gemini-Textlint-Markdown-2153521b014a80c3bea6d437b0ab1e42'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angularの公式ドキュメントの日本語翻訳版 [https://angular.jp](https://angular.jp/) を運営していますが、その翻訳作業の多くは去年あたりからGeminiを使ったAI翻訳の割合が増えています。最近までは Google 公式の `@google/genai` パッケージ（[Gemini APIライブラリ](https://ai.google.dev/gemini-api/docs/libraries?hl=ja)）を素朴に呼び出すだけのスクリプトでしたが、さらに便利なAI翻訳ツールにしようと思い、GeminiとTextlintを組み込んだLangChainアプリケーションへと作り直しました。

https://textlint.org/

https://js.langchain.com/docs/introduction

出来上がったものがこちら。翻訳プロジェクトのレポジトリに同梱してあるので、GeminiのAPIキーさえ用意すれば誰でも実行できます。

https://github.com/angular/angular-ja/tree/main/tools/translator

## ツールの実装

この翻訳ツールは次の翻訳作業フローを自動的に行なってくれます。

1. 入力Markdownファイルを適切なサイズにチャンク分割する
1. チャンクをGeminiで翻訳する
1. 翻訳結果をTextlintで自動修正する
1. 自動修正したうえで残るTextlintエラーを元に、翻訳結果をGeminiで校正する
1. すべての翻訳・校正済みチャンクを結合してファイルに書き出す
1. 最終的に出力されたファイルに対して再度Textlintを実行する
1. 翻訳前後でファイルの行数の差異がないかをバリデーションする

いままでの翻訳スクリプトは1-2までしか自動化していなかったですが、翻訳結果とTextlintの診断結果を合わせて校正作業もGeminiにやらせることでかなりの手間を省略できました。思いつきで組んだパイプラインでしたが、GeminiはTextlintのエラーを読んでいい感じに修正するのは苦手ではないようです。

LangChainを使ったGemini呼び出し周りの実装は `agent.ts` にまとまっています。翻訳用と校正用で同じGeminiモデルですが `temperature` パラメータを変えています。翻訳は毎回同じような出力をしてほしい一方、校正エラーに対応する修正は柔軟性が求められるので温度高めにしてあります。

https://github.com/angular/angular-ja/blob/main/tools/translator/agent.ts#L18

```typescript
export async function createTranslationAgent(input: {
  googleApiKey: string;
  translationModelName?: string;
  proofreaderModelName?: string;
}): Promise<Runnable<TranslationAgentInput, string>> {
  const { googleApiKey, translationModelName, proofreaderModelName } = input;

  // 翻訳用モデル
  const translator = new ChatGoogleGenerativeAI({
    apiKey: googleApiKey,
    model: translationModelName ?? defaultGeminiModel,
    temperature: 0.2, // 翻訳の一貫性を重視
    cache: false,
  });
  const translatorPrompt = PromptTemplate.fromTemplate(
    translatorPromptTemplate
  );

  // 校正用モデル
  const proofreader = new ChatGoogleGenerativeAI({
    apiKey: googleApiKey,
    model: proofreaderModelName ?? defaultGeminiModel,
    temperature: 0.8, // エラー修正への柔軟性を持たせる
    cache: false,
  });
  const proofreaderPrompt = PromptTemplate.fromTemplate(
    proofreaderPromptTemplate
  );

  const textlint = await createTextlintRunnable();

  return RunnableSequence.from([
    // { text: string } -> PromptTemplate -> AIMessageChunk -> string
    translatorPrompt.pipe(translator).pipe(new StringOutputParser()),
    // string -> { text: string, diagnostics: string }
    textlint,
    RunnableBranch.from([
      // Textlintがエラーを検出した場合は校正を行う
      [
        (result) => !!result.diagnostics,
        // { text: string, diagnostics: string } -> PromptTemplate -> AIMessageChunk -> string
        proofreaderPrompt.pipe(proofreader).pipe(new StringOutputParser()),
      ],
      // エラーがない場合はそのままテキストを返す
      // { fixedText: string, diagnostics: string } -> string
      RunnableLambda.from((result) => result.text),
    ]),
  ]);
}
```

ちょっと複雑なパイプラインですが、LangChainはよくできたフレームワークだと思いました。RxやGulpみたいな宣言的なパイプライン構築のインターフェースに慣れていれば、とても扱いやすいと思います。はじめて使いましたが、TypeScriptサポートもしっかりしていました。

Textlintの自動修正とエラーの取得もLangChainに組み込めるよう、`Runnable`型にラップしています。Textlintのフォーマッターは何パターンか試した結果、Geminiの校正作業の成功率が高かったのは `unix` フォーマットでした。

```typescript
export async function createTextlintRunnable(): Promise<
  Runnable<string, TextlintRunnableOutput>
> {
  const descriptor = await loadTextlintrc();
  const linter = await createLinter({ descriptor });
  const linterFormatter = await loadLinterFormatter({ formatterName: 'unix' });

  return RunnableLambda.from(async (text: string) => {
    // 1. 自動修正可能なエラーを修正する
    const { output: fixedText } = await linter.fixText(text, 'temp.md');
    // 2. 修正後のテキストを再度lintして診断結果を取得す
    const result = await linter.lintText(fixedText, 'temp.md');
    // 3. 診断結果を整形する
    if (result.messages.length === 0) {
      return { text: fixedText, diagnostics: null };
    }
    return { text: fixedText, diagnostics: linterFormatter.format([result]) };
  });
}
```

最近TextlintはMCPサーバーを提供するようになりましたが、今回のパイプラインでは常にTextlintを通すので、Function Callingよりも普通にスクリプトで呼び出して結果だけをLLMに渡すほうがシンプルです。

プロンプトについては今後ちまちまと改善していきますが、比較的シンプルなもので機能しています。Angular日本語ドキュメント特有の指示もあり、興味があればソースコードを見てください。

## 結果

すでにいくつかのページは新しいツールを使って翻訳しました。どのページもほぼ何も手直しせずに出来上がっています。まだ若干表現が硬かったり、違和感の残る部分もありますが、独自のHTMLタグやコードブロックなど大量に含むにもかかわらず、ページの構造がまったく壊れずに翻訳できているのはLLMの性能向上を感じます。

- [https://angular.jp/ai](https://angular.jp/ai)
- [https://angular.jp/best-practices/runtime-performance](https://angular.jp/best-practices/runtime-performance)
- [https://angular.jp/guide/elements](https://angular.jp/guide/elements)
- [https://angular.jp/guide/image-optimization](https://angular.jp/guide/image-optimization)

表現については、今後Textlintやprhの設定、プロンプトを通じて明文化された基準で改善していきます。レビュアーの移り気な匙加減ではなく、ルールを整備することで翻訳の質を高められるのがありがたいです。

また、翻訳に誤りやわかりにくい部分があれば、修正するパッチを投げてもらえればよいです。オンデマンドの自動翻訳ではなく翻訳済みMarkdownがGitHub上にあるため、いままで通りオープンソースプロジェクトとしてコントリビューションを受け付けられます。未翻訳のページをまるごと翻訳するのは大変ですが、翻訳済みのドキュメントに1行だけ修正するパッチを投げるのは誰でもできるので、コントリビューションのハードルを下げることにもなりそうです。

## まとめ

Geminiの力を借りて、未翻訳のページを減らす0→1の翻訳作業はかなり楽になりました。完全に趣味でやっているノーギャラのメンテナンス業なので持続可能性が何よりも大事なのですが、フレームワークのアップデートに伴って増えたり変わったりするドキュメントを翻訳し直すコストが下がるのは非常に重要です。

しかし**人間にとってよいドキュメント**になるかどうかは、人間による評価と改善が不可欠。なので、これまで以上にAngular日本語ドキュメントへのコントリビューションをよろしくお願いします。1文字の修正でも大歓迎です。

