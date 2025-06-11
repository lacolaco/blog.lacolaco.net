---
title: 'WebブラウザにおけるOpenTelemetryの自動計装PoC: Trace via Service Worker'
slug: 'poc-trace-via-service-worker'
icon: ''
created_time: '2024-06-26T06:21:00.000Z'
last_edited_time: '2024-06-26T08:39:00.000Z'
category: 'Tech'
tags:
  - 'Web'
  - 'OpenTelemetry'
  - 'Service Worker'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Web-OpenTelemetry-PoC-Trace-via-Service-Worker-1add2e31b2224912bd322faab675cc5d'
features:
  katex: false
  mermaid: false
  tweet: false
---

2024/06/25のOpenTelemetry Meetupで発表した『opentelemetry-js 探訪 Webフロントエンドでも自動計装したい！編』の中で、Service Workerを使った非破壊的な自動計装のPoCを紹介した。この記事では発表の中では割愛した詳細部分を含めて解説する。

https://opentelemetry.connpass.com/event/317170/

https://docs.google.com/presentation/d/e/2PACX-1vTofqAssUECvL19frdSwtW6AG03Hyr0VXyhLSHq7R8AE0oK6TQKfLjDYipEyrPT4_ZFXaFuwiDDe3HO/pub

https://www.youtube.com/live/ATlbJnc4d3o?si=V97dld8w92wiLqxw&t=5804

## otel-jsのバージョン

今回のPoCのコードで利用しているopentelemetry-jsのパッケージバージョンは以下のとおりである。experimentalだらけなので時間が経てばいろいろと壊れるだろう。

```
"@opentelemetry/api": "^1.9.0",
"@opentelemetry/core": "^1.25.1",
"@opentelemetry/exporter-trace-otlp-http": "^0.52.1",
"@opentelemetry/otlp-transformer": "^0.52.1",
"@opentelemetry/resources": "^1.25.1",
"@opentelemetry/sdk-trace-base": "^1.25.1",
"@opentelemetry/sdk-trace-web": "^1.25.1",
"@opentelemetry/semantic-conventions": "^1.25.1",
```

## FetchTraceExporter

今回のPoCの本質ではないが、技術的な制約のために自作せざるを得なかった `FetchTraceExporter` について解説する。まずはコードの全文を見てもらおう。

```ts
import { OTLPExporterBrowserBase, OTLPExporterConfigBase, OTLPExporterError } from '@opentelemetry/otlp-exporter-base';
import { IExportTraceServiceResponse, JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

/**
 * Custom OTLPTraceExporter implementation for Fetch API
 */
export class FetchTraceExporter extends OTLPExporterBrowserBase<ReadableSpan, IExportTraceServiceResponse> {
  constructor(config: OTLPExporterConfigBase) {
    // same as OTLPTraceExporter in @opentelemetry/exporter-trace-otlp-http
    super(config, JsonTraceSerializer, 'application/json');
  }

  override send(items: ReadableSpan[], onSuccess: () => void, onError: (error: OTLPExporterError) => void): void {
    const body = JsonTraceSerializer.serializeRequest(items) ?? new Uint8Array();
    const request = new Request(this.url, {
      method: 'POST',
      body,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this._headers,
      },
    });
    const promise = fetch(request).then(onSuccess).catch(onError);
    // for managing the sending promises concurrency
    this._sendingPromises.push(promise);
    promise.finally(() => {
      const index = this._sendingPromises.indexOf(promise);
      this._sendingPromises.splice(index, 1);
    });
  }

  override getDefaultUrl(config: OTLPExporterConfigBase): string {
    if (typeof config.url !== 'string') {
      throw new OTLPExporterError('config.url is not a string');
    }
    return config.url;
  }
}
```

ここで実装している内容に入る前に、まずはこのクラスのインターフェースと継承関係について説明しておこう。もっとも基本的なインターフェースとして`SpanProcessor`というものがある。これはトレーサーがスパンを開始・終了したときのフック処理を行うためのインターフェースで、`TracerProvider`の`addSpanProcessor`メソッドで登録できる。`SpanProcessor`のインターフェース定義は`sdk-trace-base`に含まれている。

[https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/SpanProcessor.ts](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/SpanProcessor.ts)

```ts
/**
 * SpanProcessor is the interface Tracer SDK uses to allow synchronous hooks
 * for when a {@link Span} is started or when a {@link Span} is ended.
 */
export interface SpanProcessor {
  /**
   * Forces to export all finished spans
   */
  forceFlush(): Promise<void>;

  /**
   * Called when a {@link Span} is started, if the `span.isRecording()`
   * returns true.
   * @param span the Span that just started.
   */
  onStart(span: Span, parentContext: Context): void;

  /**
   * Called when a {@link ReadableSpan} is ended, if the `span.isRecording()`
   * returns true.
   * @param span the Span that just ended.
   */
  onEnd(span: ReadableSpan): void;

  /**
   * Shuts down the processor. Called when SDK is shut down. This is an
   * opportunity for processor to do any cleanup required.
   */
  shutdown(): Promise<void>;
}
```

見て分かるとおり`SpanProcessor`の用途は自由だが、その用途のひとつがスパンの外部送信（**エクスポート**）であり、もっともシンプルな実装として提供されているのが `sdk-trace-base`の `SimpleSpanProcessor`である。長いので詳細は割愛するが、ここで重要なのはコンストラクタ引数に`SpanExporter`というインターフェースを要求することである。

[https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/SimpleSpanProcessor.ts](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/SimpleSpanProcessor.ts)

```ts
/**
 * An implementation of the {@link SpanProcessor} that converts the {@link Span}
 * to {@link ReadableSpan} and passes it to the configured exporter.
 *
 * Only spans that are sampled are converted.
 *
 * NOTE: This {@link SpanProcessor} exports every ended span individually instead of batching spans together, which causes significant performance overhead with most exporters. For production use, please consider using the {@link BatchSpanProcessor} instead.
 */
export class SimpleSpanProcessor implements SpanProcessor {

  constructor(private readonly _exporter: SpanExporter) {
		...
	}
	...
}
```

`SimpleSpanProcessor`の役割は、記録されたスパンがEndするたびにひとつずつ逐次的にエクスポート処理をすることである。今回は深く触れないが、対置されるものとして複数のスパンをまとめて送信する`BatchSpanProcessor`も`sdk-trace-base`から提供されている。共通するのは、どちらもエクスポート処理そのものは`SpanExporter`に移譲しており、エクスポートのタイミングだけを責任範囲としている点である。スパンをエクスポートするトリガーは引くが、具体的にどのように、どこにエクスポートするかはすべて`SpanExporter`に委ねられている。

というわけで`SpanExporter`の実装が必要になるわけだが、これもインターフェースは`sdk-trace-base`で定義されている。`SpanExporter`には`export`メソッドが要求され、このメソッドで実際にスパンを外部送信する方法を記述することになる。

[https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/SpanExporter.ts](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/SpanExporter.ts)

```ts
/**
 * An interface that allows different tracing services to export recorded data
 * for sampled spans in their own format.
 *
 * To export data this MUST be register to the Tracer SDK using a optional
 * config.
 */
export interface SpanExporter {
  /**
   * Called to export sampled {@link ReadableSpan}s.
   * @param spans the list of sampled Spans to be exported.
   */
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void;

  /** Stops the exporter. */
  shutdown(): Promise<void>;

  /** Immediately export all spans */
  forceFlush?(): Promise<void>;
}
```

ところで、この`SpanExporter`インターフェースの具体的な実装でotel-jsの安定版パッケージから提供されているのは `sdk-trace-base` の`ConsoleSpanExporter`と`InMemorySpanExporter`しかなく、ほかは非推奨である。packagesディレクトリには`@opentelemetry/exporter-jaeger`と`@opentelemetry/exporter-zipkin`があるように見えるが、どちらも非推奨になっている。READMEには以下の新しいパッケージを使うよう書かれているが、これらは今のところすべてexperimentalである。つまり2024/06現在、**ブラウザからスパンを外部送信する安定版の実装は皆無**である。

- `@opentelemetry/exporter-trace-otlp-proto`
- `@opentelemetry/exporter-trace-otlp-grpc`
- `@opentelemetry/exporter-trace-otlp-http`

とはいえ実験的とはいえ実装があるにはあるので使うことはできる。今回はHTTP通信でJSON形式のエクスポートをするために`@opentelemetry/exporter-trace-otlp-http` を参考にする。このパッケージはブラウザとNode.jsの両方向けの実装を含んでおり`package.json`で読み込むモジュールを分岐させているがそこは今回のテーマではないので割愛する。重要なのは、このパッケージからは`OTLPTraceExporter`というクラスが提供されることである。

[https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/exporter-trace-otlp-http/src/platform/browser/OTLPTraceExporter.ts](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/exporter-trace-otlp-http/src/platform/browser/OTLPTraceExporter.ts)

```ts
export class OTLPTraceExporter
  extends OTLPExporterBrowserBase<ReadableSpan, IExportTraceServiceResponse>
  implements SpanExporter
{
  constructor(config: OTLPExporterConfigBase = {}) {
    super(config, JsonTraceSerializer, 'application/json');
    //...
  }
  /// ...
}
```

`OTLPTraceExporter`は`SpanExporter`を実装しているが、コードを見ればわかるようにその具体的な実装はこのクラスではなく継承元の`OTLPExporterBrowserBase`に移譲している。`OTLPExporterBrowserBase` は`@opentelemetry/otlp-exporter-base`から提供されているのでそちらを読みに行くと、ようやくスパンを送信している処理にたどりつく。

[https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/otlp-exporter-base/src/platform/browser/OTLPExporterBrowserBase.ts](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/otlp-exporter-base/src/platform/browser/OTLPExporterBrowserBase.ts)

```ts
/**
 * Collector Metric Exporter abstract base class
 */
export abstract class OTLPExporterBrowserBase<ExportItem, ServiceResponse> extends OTLPExporterBase<
  OTLPExporterConfigBase,
  ExportItem
> {
  //...
  constructor(
    config: OTLPExporterConfigBase = {},
    serializer: ISerializer<ExportItem[], ServiceResponse>,
    contentType: string,
  ) {
    super(config);
    this._serializer = serializer;
    this._contentType = contentType;
    this._useXHR = !!config.headers || typeof navigator.sendBeacon !== 'function';
    if (this._useXHR) {
      this._headers = Object.assign(
        {},
        parseHeaders(config.headers),
        baggageUtils.parseKeyPairsIntoRecord(getEnv().OTEL_EXPORTER_OTLP_HEADERS),
      );
    } else {
      this._headers = {};
    }
  }

  //...

  send(items: ExportItem[], onSuccess: () => void, onError: (error: otlpTypes.OTLPExporterError) => void): void {
    //...
    const body = this._serializer.serializeRequest(items) ?? new Uint8Array();

    const promise = new Promise<void>((resolve, reject) => {
      if (this._useXHR) {
        sendWithXhr(
          body,
          this.url,
          {
            ...this._headers,
            'Content-Type': this._contentType,
          },
          this.timeoutMillis,
          resolve,
          reject,
        );
      } else {
        sendWithBeacon(body, this.url, { type: this._contentType }, resolve, reject);
      }
    }).then(onSuccess, onError);

    this._sendingPromises.push(promise);
    const popPromise = () => {
      const index = this._sendingPromises.indexOf(promise);
      this._sendingPromises.splice(index, 1);
    };
    promise.then(popPromise, popPromise);
  }
}
```

このクラスではコンフィグによってスパンの送信にXHRを使うか[sendBeacon](https://developer.mozilla.org/ja/docs/Web/API/Navigator/sendBeacon)を使うかを切り替えている。当初の目的を思い出すと、今回は`fetch`関数しか使えない環境でスパンを外部送信したいのだった。つまり、やるべきことはこの`OTLPExporterBrowserBase` の処理の代替品を作らなければならないことだとわかる。ここまでを踏まえたうえで改めて今回自作した`FetchTraceExporter`を見てもらおう。

まずクラス宣言は`OTLPExporterBrowserBase` を継承する形にしているが、実際は無駄な実装を多く含むので真面目に作るならゼロから作ったほうがいい。コンストラクタで`super`コンストラクタを呼び出しているところの引数は実際にはまったく意味がないが、コンパイルを通すためだけに渡している。本質的なのは`send`メソッドで行っているスパン配列のシリアライズと`fetch`関数でのPOSTリクエスト送信である。ここまでの流れを踏まえたうえでならこのコードの意味がわかってもらえるだろう。

```ts
import { OTLPExporterBrowserBase, OTLPExporterConfigBase, OTLPExporterError } from '@opentelemetry/otlp-exporter-base';
import { IExportTraceServiceResponse, JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

/**
 * Custom OTLPTraceExporter implementation for Fetch API
 */
export class FetchTraceExporter extends OTLPExporterBrowserBase<ReadableSpan, IExportTraceServiceResponse> {
  constructor(config: OTLPExporterConfigBase) {
    // same as OTLPTraceExporter in @opentelemetry/exporter-trace-otlp-http
    super(config, JsonTraceSerializer, 'application/json');
  }

  override send(items: ReadableSpan[], onSuccess: () => void, onError: (error: OTLPExporterError) => void): void {
    const body = JsonTraceSerializer.serializeRequest(items) ?? new Uint8Array();
    const request = new Request(this.url, {
      method: 'POST',
      body,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this._headers,
      },
    });
    const promise = fetch(request).then(onSuccess).catch(onError);
    // for managing the sending promises concurrency
    this._sendingPromises.push(promise);
    promise.finally(() => {
      const index = this._sendingPromises.indexOf(promise);
      this._sendingPromises.splice(index, 1);
    });
  }

  override getDefaultUrl(config: OTLPExporterConfigBase): string {
    if (typeof config.url !== 'string') {
      throw new OTLPExporterError('config.url is not a string');
    }
    return config.url;
  }
}
```

このように実装した`FetchTraceExporter`を`TracerProvider`のセットアップに組み込むのは簡単で、引数に`SpanExporter`を受け取る`SpanProcessor`クラスに渡せばよい。今回はデモなので雑にhoneycombに送信する作りにしており、そのエンドポイントと認証ヘッダ設定を加えた`honeycombExporter` としてインスタンス化し、`SimpleSpanProcessor`に渡している。

```ts
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { StackContextManager } from '@opentelemetry/sdk-trace-web';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { FetchTraceExporter } from './exporter';

const honeycombExporter = new FetchTraceExporter({
  url: 'https://api.honeycomb.io/v1/traces',
  headers: {
    'X-Honeycomb-Team': '...',
  },
});

export function registerTraceProvider(serviceName: string) {
  const provider = new BasicTracerProvider({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    }),
  });
  // export traces to honeycomb.io
  provider.addSpanProcessor(new SimpleSpanProcessor(honeycombExporter));
  // extract|inject w3c trace context
  provider.register({
    propagator: new W3CTraceContextPropagator(),
    contextManager: new StackContextManager(),
  });
  return provider;
}
```

`FetchTraceExporter`に関しては以上で解説は十分だろう。

## Trace on Service Worker

次に、Service Worker上でトレースの計装を行う上で考慮した点を解説する。PoCでのserviceWorker.tsの実装全文は以下のとおりである。

```ts
/// <reference lib="WebWorker" />
import { SpanKind, SpanOptions, context, propagation, trace } from '@opentelemetry/api';

import * as SemanticAttributes from '@opentelemetry/semantic-conventions';
import { registerTraceProvider } from '../opentelemetry/trace-provider';

declare const self: ServiceWorkerGlobalScope;

/**
 * Setup Otel tracer for fetch events
 */
function setupTracer() {
  registerTraceProvider('browser-service-worker');
}

function getRequestSpanOptions(request: Request): SpanOptions {
  return {
    attributes: {
      [SemanticAttributes.SEMATTRS_HTTP_URL]: request.url,
      [SemanticAttributes.SEMATTRS_HTTP_METHOD]: request.method.toUpperCase(),
    },
    kind: SpanKind.CLIENT,
  };
}

// setup tracer on activate
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  setupTracer();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // trace only requests from the same origin APIs
  const reqURL = new URL(request.url);
  const isApiRequest = reqURL.origin === self.location.origin && reqURL.pathname.startsWith('/api');
  if (!isApiRequest) {
    return;
  }

  // extract context from main thread
  const traceContext = propagation.extract<Headers>(context.active(), request.headers, {
    keys: (carrier) => Object.keys(carrier),
    get: (carrier, key) => carrier.get(key) ?? undefined,
  });

  // start fetch span
  const tracer = trace.getTracer('sw-fetch');
  const spanOptions = getRequestSpanOptions(request);
  const promise = tracer.startActiveSpan('fetch', spanOptions, traceContext, async (span) => {
    // propagate trace context to the server
    const headers = new Headers(request.headers);
    propagation.inject<Headers>(context.active(), headers, {
      set: (carrier, key, value) => carrier.set(key, value),
    });

    return fetch(new Request(request, { headers }))
      .then((resp) => {
        span.setAttribute(SemanticAttributes.SEMATTRS_HTTP_STATUS_CODE, resp.status);
        return resp;
      })
      .finally(() => {
        span.end();
      });
  });
  event.respondWith(promise);
});
```

### setupTracer関数

この関数は上述の`FetchTraceExporter`を組み込んだ`TracerProvider`を初期化し、グローバルトレーサーとして登録するものである。Service Workerがアクティブな間は一回だけ実行すればよいので、`activate`イベントで呼び出している。

### fetchイベントハンドラ

ここが本丸だが、いくつかのステップに分けて考えられる。

- リクエストのフィルタリング
- メインスレッドからのトレースコンテキストの抽出
- スパンの作成とトレースコンテキストの注入
- オリジンサーバーへのfetchリクエスト
- レスポンス情報のスパン属性書き込み
- スパンの完了
- メインスレッドへのレスポンス返却

まずリクエストのフィルタリングについては、このfetchイベントにはあらゆるHTTPリクエストが渡されてくるので、計装対象とすべきものを仕分ける必要がある。今回はバックエンドAPIだけを対象としたが別に静的ファイルも含めてよいし、ここは自由である。

メインスレッドからのトレースコンテキストの抽出は、Service Workerだけでなくフロントエンド実装にもOTelの計装があることを考慮して分散トレースが可能となるようにしている。メインスレッドがOTLPに準拠していれば、HTTPヘッダにトレースコンテキストが含まれている。それを取り出すのに`@open-telemetry/api`の`propagation` APIを使う。

`propagation.extract`メソッドは、引数に渡したコンテキストにヘッダから取り出したトレースコンテキストをマージした新しいコンテキストを返してくれる。第2引数に渡したオブジェクトから第3引数に渡した関数を使って値を取り出してくれるのだが、この処理で具体的にどのヘッダをどう解釈するのかについては、`TracerProvider`の定義で**Propagator**を設定しておく必要がある。今回は標準的な`traceparent`ヘッダをW3Cの仕様通りに解釈したいので、`@opentelemetry/core`から提供される`W3CTraceContextPropagator`を利用している。

```ts
const traceContext = propagation.extract<Headers>(context.active(), request.headers, {
  keys: (carrier) => Object.keys(carrier),
  get: (carrier, key) => carrier.get(key) ?? undefined,
});
```

```ts
provider.register({
  propagator: new W3CTraceContextPropagator(),
});
```

ここまで準備ができたら、Service Worker内でスパンを開始する。先ほど抽出したコンテキストをもとに`startActiveSpan`すれば、親が存在すれば子スパンとなるし、なければここがルートスパンとなる。また、バックエンドへ送るリクエストヘッダにはこのスパンを作成したあとのアクティブコンテキスト `context.active()` を注入することで、バックエンド側のスパンとの間に親子関係を指定できる。大事なのはかならずスパンを完了させることで、リクエストの成功・失敗にかかわらず`finally`メソッドで`span.end()`を呼び出している。また、メインスレッドにレスポンスを返すのも忘れないようにしよう。

```ts
const promise = tracer.startActiveSpan('fetch', spanOptions, traceContext, async (span) => {
  // propagate trace context to the server
  const headers = new Headers(request.headers);
  propagation.inject<Headers>(context.active(), headers, {
    set: (carrier, key, value) => carrier.set(key, value),
  });

  return fetch(new Request(request, { headers }))
    .then((resp) => {
      span.setAttribute(SemanticAttributes.SEMATTRS_HTTP_STATUS_CODE, resp.status);
      return resp;
    })
    .finally(() => {
      span.end();
    });
});
event.respondWith(promise);
```

やることは多いが、それぞれはOpenTelemetryの基本的な計装のステップなので、それほど難しくない。`propagation`や`context`などの概念を理解していれば自然と読み解けるだろう。

## おまけ: Cloudflare Workerでの計装

今回のPoCの本質ではないが、分散トレースのサンプルとしてバックエンドAPIをCloudflare Workerで用意した。この環境もブラウザでもNode.jsでもない特殊な環境で、結果的にはService Workerのために作った`FetchTraceExporter`が役立つ結果になった。PoCで使った`echo`エンドポイントのコード全文は以下のとおりである。

```ts
import { SpanKind, SpanOptions, context, propagation, trace } from '@opentelemetry/api';
import * as SemanticAttributes from '@opentelemetry/semantic-conventions';
import { registerTraceProvider } from '../../opentelemetry/trace-provider';

/**
 * Setup Otel tracer for fetch events
 */
function setupTracer() {
  registerTraceProvider('worker-api');
}

function getTracer() {
  return trace.getTracer('worker-api');
}

function getRequestSpanOptions(request: Request): SpanOptions {
  return {
    attributes: {
      [SemanticAttributes.SEMATTRS_HTTP_URL]: request.url,
      [SemanticAttributes.SEMATTRS_HTTP_METHOD]: request.method,
    },
    kind: SpanKind.SERVER,
  };
}

/**
 * Echo handler: returns the request body
 */
export const onRequest: PagesFunction = async (event) => {
  setupTracer();

  const { request } = event;
  console.log('headers', request.headers);
  // extract context from client
  const traceContext = propagation.extract<Headers>(context.active(), request.headers, {
    keys: (carrier) => Array.from(carrier.keys()),
    get: (carrier, key) => carrier.get(key) ?? undefined,
  });

  // start onRequest span
  const tracer = trace.getTracer('worker-api');
  const spanOptions = getRequestSpanOptions(request);
  return tracer.startActiveSpan('onRequest', spanOptions, traceContext, async (span) => {
    try {
      const message = await generateMessage();
      const respBody = { message };
      span.setAttribute(SemanticAttributes.SEMATTRS_HTTP_STATUS_CODE, 200);
      return new Response(JSON.stringify(respBody), {
        headers: { 'content-type': 'application/json' },
      });
    } catch (error) {
      span.setAttribute(SemanticAttributes.SEMATTRS_HTTP_STATUS_CODE, 500);
      return new Response('Internal Server Error', { status: 500 });
    } finally {
      span.end();
    }
  });
};

async function generateMessage(): Promise<string> {
  return getTracer().startActiveSpan('generateMessage', (span) => {
    // simulate async operation
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve('Hello, world!');
        span.end();
      }, 100);
    });
  });
}
```

やっていることはService Workerの`fetch`ハンドラとほとんど同じで、リクエストからトレースコンテキストを抽出し、そのコンテキストを使って新たなスパンを作成し、処理が終わったらスパンを完了しているだけである。やってることは難しくないがやはり冗長ではあるので、このあたり汎用的なインターフェースで抽象化したレイヤーが欲しくなる。

## 課題: BatchSpanProcessor対応

また、実はPoCのために手抜きをした部分があり、それはこの実装は`BatchSpanProcessor`ではうまくいかないということだ。

`BatchSpanProcessor`は一定時間おきにストックしたスパンを非同期的にまとめて処理するわけだが、タイムサイクルが短いランタイムだと一定時間が経過する前にシャットダウンしてしまうことがある。そうするとスパンが送られずに虚空に消えてしまうので、いわゆるgraceful shutdownを行い、強制的にすべて送信してからシャットダウンされるようにしなければならない。

この強制的な送信は`SpanProcessor`の`forceFlush`メソッドを呼び出すことでトリガーできるのだが、問題はこのメソッドをどうやって呼び出すかである。Service Workerには`install`や`activate`といった開始イベントはあるが、逆に登録が解除されるときに発火される`deactivate`イベントは存在しない。そうなるとflushできるタイミングは`fetch`イベントの処理の終わりくらいである。それでは結局逐次送信しているのと変わらない。

どうすればService Worker上で`BatchSpanProcessor` を使えるだろうか。この問題については誰かしらが解決してくれるとうれしい。

---

20分の発表では説明しきれなかった詳細を解説したが、もし追加で質問などがあればTwitterやMisskeyのほうでリプライをいただければ加筆するので遠慮なく声をかけてほしい。また、このPoCのアイデアはそれほど独創的でもないし、自分のアイデアだと主張するつもりももちろんないので、開発の参考にするのは自由にしてほしい。
