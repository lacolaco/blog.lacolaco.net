---
title: 'ブログに記事要約機能を実装した（Built-in AI on Chrome）'
slug: 'implement-article-summary-feature'
icon: ''
created_time: '2025-12-30T12:43:00.000Z'
last_edited_time: '2025-12-30T12:43:00.000Z'
tags:
  - 'AI'
  - 'Chrome'
  - 'Blog Dev'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Built-in-AI-on-Chrome-2d93521b014a809a8b9acc91ed59efe2'
features:
  katex: false
  mermaid: false
  tweet: false
---

![image](/images/implement-article-summary-feature/CleanShot_2025-12-30_at_20.47.40.543d87dc8c1e76f3.gif)

このブログに記事の内容を短く要約する機能を実装した。ブラウザの組み込みAI機能を使っているので、2025年12月末の時点ではChromeでのみ動作する。

## 組み込みAI API

https://developer.chrome.com/docs/ai/built-in-apis?hl=ja

Chromeはブラウザに組み込まれたGemini Nanoモデルを呼び出すAPIを提供している。今回利用したのはSummerizer APIで、Chrome 138から安定版で提供されている。他にもいくつかのAPIがあり、まだOrigin Trial段階のものもある。

Summarizer APIはその名の通り、テキストを与えたら要約してくれるAPIだ。

https://developer.chrome.com/docs/ai/summarizer-api?hl=ja

いまのところ、`window.Summarizer`オブジェクトを通じてAPIを呼び出すようになっている。このブログでは記事にロケール（`ja` or `en`） があり、それぞれのロケールに合わせた言語で要約を出力するよう、次のような設定で`Summarizer`を呼び出している。

```typescript
export async function createSummarizer(locale: string): Promise<Summarizer> {
  if (typeof Summarizer === 'undefined') {
    throw new Error('Summarizer API is not available');
  }

  const outputLanguage = locale === 'en' ? 'en' : 'ja';
  const options: SummarizerCreateOptions = {
    type: 'tldr',
    format: 'markdown',
    length: 'medium',
    outputLanguage,
    expectedInputLanguages: [outputLanguage],
  };

  return await Summarizer.create(options);
}

```

要約にもいくつか種類があり、今回は`tldr` 形式で`medium`サイズの要約を生成している。

![image](/images/implement-article-summary-feature/CleanShot_2025-12-30_at_20.54.172x.8e62f768df3e33d0.png)

このあたりの設定値などをTypeScriptで書くための型定義は`@types/dom-chromium-ai`というパッケージが提供されている。これを読み込むようにすれば問題ない。

https://www.npmjs.com/package/@types/dom-chromium-ai

## 要約のストリーミング生成

今回はじめて組み込みAIを使ってみたが、要約の生成はけっこう時間がかかる。完全に完了するまで待って文字列を出していると体験がよくなかったので、ストリーミングで少しずつ表示を更新できるようにした。といってもSummarizer APIが`summarizeStreaming`というメソッドを持っているのでそれを使っているだけだ。

```typescript
/**
 * テキストをストリーミングで要約する
 * @param text 要約対象のテキスト
 * @param options 要約オプション
 * @param onChunk チャンク受信時のコールバック（累積テキストを受け取る）
 */
export async function summarizeTextStream(
  text: string,
  options: SummarizeOptions,
  onChunk: (text: string) => void,
): Promise<void> {
  const { locale, maxLength = DEFAULT_MAX_LENGTH, signal } = options;

  if (!text.trim()) {
    throw new Error('Text is empty');
  }

  const truncatedText = text.slice(0, maxLength);
  const summarizer = await createSummarizer(locale);

  try {
    const stream = summarizer.summarizeStreaming(truncatedText);
    const reader = stream.getReader();

    while (true) {
      // キャンセルされた場合は中断
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(value);
    }
  } finally {
    summarizer.destroy();
  }
}
```

あとはボタンが押されたときにこの処理を呼び出してチャンクをUIに反映させればよい。けっこうあっさり実装できた。

## Feature Detection

この機能が使えるのはまだ限られたブラウザだけなので、非対応のブラウザではUIを表示しないように機能検出を丁寧にしている。APIの有無だけでなく、`Summarizer.availability()`メソッドで組み込みモデルの利用可否を取得している。

```typescript
/**
 * Summarizer APIの利用可能状態を確認する
 * @param locale 記事の言語（言語別の利用可能状態を確認）
 * @returns 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported'
 */
export async function checkSummarizerAvailability(locale?: string): Promise<AvailabilityResult> {
  // Feature Detection: Summarizer APIが存在するか
  if (typeof Summarizer === 'undefined') {
    return 'unsupported';
  }

  try {
    const outputLanguage = locale === 'en' ? 'en' : 'ja';
    const availability = await Summarizer.availability({
      type: 'tldr',
      format: 'markdown',
      length: 'medium',
      outputLanguage,
      expectedInputLanguages: [outputLanguage],
    });
    return availability;
  } catch (error) {
    console.error('Summarizer availability check failed:', error);
    return 'unsupported';
  }
}

```

`Availability`が`downloadable` である場合、モデルがまだダウンロードされていない。組み込みAI APIはユースケースごとにチューニングされたモデルが用意されているらしいから、おそらくそのブラウザプロファイルではじめて要約APIを使うときにモデルがダウンロードされるだろう。

モデルが利用可能であれば`ready`が返される。利用できない場合は`unavailable`だ。たとえばモデルをダウンロードする容量がディスクに残っていなかったり、マシンパワーが十分じゃなかったりすると返されるようだ。

[https://developer.chrome.com/docs/ai/get-started#model-download](https://developer.chrome.com/docs/ai/get-started#model-download)

![image](/images/implement-article-summary-feature/CleanShot_2025-12-30_at_21.34.152x.ae0a666b96eaf0bb.png)

このあたりも考慮して機能が利用可能だと判断できる場合に要約ボタンを表示している。

## まとめ

組み込みAI APIを使って記事要約機能を実装したが、想像以上に簡単に実装できた。Feature Detectionもしっかり行えるため、プログレッシブエンハンスメントとして実験的な機能を組み込みやすい。APIもそれなりに使いやすい形にはなってると思うので、他のブラウザでも使えるようになることに期待する。

