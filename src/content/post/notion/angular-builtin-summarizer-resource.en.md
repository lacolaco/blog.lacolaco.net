---
title: 'Angular: Implementing summaryResource to Signal-ize Built-in AI'
slug: 'angular-builtin-summarizer-resource'
icon: ''
created_time: '2026-04-27T07:49:00.000Z'
last_edited_time: '2026-04-28T10:40:00.000Z'
tags:
  - 'Signals'
  - 'Dependency Injection'
  - 'Chrome'
  - 'AI'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-builtin-summarizer-resource'
channels:
  - 'Angular'
notion_url: 'https://www.notion.so/Angular-Built-in-AI-Signal-summaryResource-34f3521b014a80149b66c11891b89391'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: 'cb9e57c00d9583987d0596301a2d6584ff0f557c4f9678e986bf782ed422ff82'
---

I previously posted an article about enabling blog post summarization using the Summarizer API, which is a built-in AI feature in Chrome.

https://developer.chrome.com/docs/ai/summarizer-api?hl=ja

https://blog.lacolaco.net/posts/implement-article-summary-feature

This time, I tried an implementation that wraps the asynchronous processing of this Summarizer API with Angular's Resource API for use within an Angular application. Let's try calling the Summarizer API reactively in a way that links with the application state managed by Signals.

You can see a working sample on StackBlitz. Note that since only Chrome currently supports the Summarizer API, it will not work in browsers other than Chrome.

https://stackblitz.com/github/lacolaco/angular-built-in-ai?ctl=1&embed=1&file=src%2Fapp%2Fapp.ts

## Prototype: `summaryResource`

First, I'll introduce the interface of the final version, `summaryResource`. In the following `App` component, the `summaryResource` function is called with the `input` string signal bound to a textarea as an argument. The returned `SummaryResource` provides the Summarizer API status as a `summary.summarizerAvailability()` status signal and the summarized result of the `input` content as a `summary.value()` string signal.

```typescript
import { Component, signal } from '@angular/core';
import { debounce, form, FormField } from '@angular/forms/signals';
import { summaryResource } from './summarized.resource';

@Component({
  selector: 'app-root',
  imports: [FormField],
  template: `
    <div>
      <h1>Built-in AI Summarizer</h1>

      <div>
        <div>
          <label for="input-text">入力テキスト</label>
        </div>
        <textarea
          id="input-text"
          [formField]="inputForm"
          placeholder="要約したい長文をここに貼り付け"
        ></textarea>
      </div>

      <section>
        @switch (summary.summarizerAvailability()) {
          @case ('unavailable') {
            <p>要約機能は利用できません。</p>
          }
          @case ('downloadable') {
            <button type="button" (click)="summary.initialize()">
              要約機能を初期化
            </button>
          }
          @case ('downloading') {
            <p>要約機能をダウンロード中…</p>
          }
          @case ('available') {
            @switch (summary.status()) {
              @case ('idle') {
                <p>テキストを入力すると要約が表示されます。</p>
              }
              @case ('loading') {
                <p>要約しています…</p>
              }
              @case ('error') {
                <p>{{ summary.error()?.message }}</p>
              }
              @case ('resolved') {
                <p>{{ summary.value() }}</p>
              }
            }
          }
        }
      </section>
    </div>
  `,
})
export class App {
  protected readonly input = signal('');
  readonly inputForm = form(this.input, (control) => {
    debounce(control, 500);
  });

  protected readonly summary = summaryResource(this.input, {
    summarizerOptions: {
      outputLanguage: 'ja',
    },
  });
}
```

It hides the internal asynchronous processing with a mental model similar to Angular's built-in `httpResource`, and is able to represent the result of asynchronous processing for dynamic values using the Resource type.

From here, I will explain how this `summaryResource` is constructed.

## Summarizer API

I've already introduced this in the aforementioned article, and since I'd like you to refer to the official documentation for the latest information, I won't go too deep into the details of the Summarizer API itself. First, we create a function to call the Summarizer API directly from the application. In the following code, I wrote a function that wraps the detection of whether the `Summarizer` variable even exists in the execution environment and the calls to `Summarizer.availability` and `Summarizer.create`. This allows other parts of the application to remain unaware of the details of how to call the Summarizer API.

```typescript
// ai/summarizer.ts
export const isSummarizationSupported = 'Summarizer' in self;

export async function getBuiltinAISummarizerAvailability(
  options?: SummarizerCreateCoreOptions,
): Promise<Availability> {
  if (!isSummarizationSupported) return 'unavailable';
  return Summarizer.availability(options);
}

export async function createBuiltinAISummarizer(
  options: SummarizerCreateOptions = {},
): Promise<Summarizer> {
  const availability = await getBuiltinAISummarizerAvailability(options);
  if (availability === 'unavailable') {
    throw new Error('Summarizer API is unavailable on this device.');
  }
  return Summarizer.create(options);
}
```

## SummarizerFactory

This isn't the essential part of this topic, but it's a necessary piece for handling environment differences to use the Built-in AI feature in practice. I've set it up to switch via DI so that it swaps to a Noop implementation that summarizes nothing in environments where the Summarizer API is unavailable. Of course, it also serves as a hook point that can be replaced with any Summarizer implementation during testing.

```typescript
// summarizer-factory.ts
import { Injectable } from '@angular/core';
import {
  createBuiltinAISummarizer,
  getBuiltinAISummarizerAvailability,
  isSummarizationSupported,
} from './ai/summarizer';

@Injectable({
  providedIn: 'root',
  useFactory: () =>
    isSummarizationSupported ? new BuiltinAISummarizerFactory() : new NoopSummarizerFactory(),
})
export abstract class SummarizerFactory {
  abstract availability(options?: SummarizerCreateCoreOptions): Promise<Availability>;
  abstract create(options?: SummarizerCreateOptions): Promise<Summarizer>;
}

@Injectable()
export class BuiltinAISummarizerFactory extends SummarizerFactory {
  override availability(options?: SummarizerCreateCoreOptions): Promise<Availability> {
    return getBuiltinAISummarizerAvailability(options);
  }

  override create(options?: SummarizerCreateOptions): Promise<Summarizer> {
    return createBuiltinAISummarizer(options);
  }
}

@Injectable()
export class NoopSummarizerFactory extends SummarizerFactory {
  override async availability(): Promise<Availability> {
    return 'available';
  }

  override async create(): Promise<Summarizer> {
    // Minimal stub for environments without Built-in AI API support / tests.
    return {
      summarize: async (input: string) => input,
      summarizeStreaming: () => new ReadableStream<string>(),
      destroy: () => {},
    } as unknown as Summarizer;
  }
}
```

## SummaryResource

This is the body of the `summaryResource` function. It's a bit complex, so let's look at the parts one by one.

First, regarding the `SummaryResource` type that serves as the function's return value. This adds two fields to the `Resource<T>` type provided by Angular. `summarizerAvailability` is, as the name suggests, a signal representing the availability status of the Summarizer instance itself. And the other, `initialize`, is a function to explicitly trigger the creation of the `Summarizer` instance.

```typescript
/**
 * Resource returned by {@link summaryResource}.
 * Standard Resource<string> with Summarizer-specific properties added.
 */
export interface SummaryResource extends Resource<string> {
  /** Summarizer availability. Reflects the return value of Summarizer.availability(). */
  readonly summarizerAvailability: Signal<Availability>;

  /**
   * Creates a Summarizer and starts summarization. Idempotent.
   * When `summarizerAvailability()` is `'downloadable'`, it must be called from a user-initiated action (e.g., a click).
   */
  initialize(): void;
}
```

Why is `initialize` necessary? It's because the AI model used internally by the Summarizer API is downloaded on-demand when needed, but the specification states that user activation is required to start that download. In other words, it cannot be started by events like page loading; it must be triggered by a user interaction event such as a button click.

[https://developer.chrome.com/docs/ai/get-started#user-activation](https://developer.chrome.com/docs/ai/get-started#user-activation)

> If the device can support built-in AI APIs, but the model is not yet downloaded, the user must meaningfully interact with your page for your application to start a session with `create()`.

Therefore, in `summaryResource`, I've added a conditional branch to automatically call `initialize` only when the result of calling `factory.availability` is `available` or `downloading`, as follows.

```typescript
export const summaryResource = (
  source: () => string,
  options: {
    summarizerOptions?: SummarizerCreateOptions;
    injector?: Injector;
  } = {},
): SummaryResource => {
  const injector = options.injector ?? inject(Injector);
  const factory = injector.get(SummarizerFactory);
  const summarizerOptions = options.summarizerOptions;

  const state = signal<ResourceSnapshot<string>>({ status: 'idle', value: '' });
  const summarizerAvailability = signal<Availability>('unavailable');

  let initialized = false;

  const initialize = async () => {
    if (initialized) {
      return;
    }
    initialized = true;
    // ...
  }

  factory.availability(summarizerOptions).then((availability) => {
    if (availability === 'unavailable') {
      initialized = true;
      state.set({ status: 'idle', value: '' });
      return;
    }
    if (availability === 'available' || availability === 'downloading') {
      initialize();
    }
  });

  return {
    ...resourceFromSnapshots(state),
    summarizerAvailability,
    initialize,
  };
};
```

Next, regarding the creation of the `Summarizer` instance. As shown below, in the `initialize` function, the `factory.create` function is called to create the Summarizer instance. This `factory.create` function's Promise will wait for the model download. In other words, by the time the Promise resolves, `summarizerAvailability` is `available`.

Also, in coordination with the destruction of the Resource, I am using `DestroyRef` to perform the instance destruction of the `Summarizer`. This prevents unintended memory leaks.

```typescript
export const summaryResource = (
  source: () => string,
  options: {
    summarizerOptions?: SummarizerCreateOptions;
    injector?: Injector;
  } = {},
): SummaryResource => {
  const injector = options.injector ?? inject(Injector);
  const destroyRef = injector.get(DestroyRef);
  const factory = injector.get(SummarizerFactory);
  const summarizerOptions = options.summarizerOptions;

  const state = signal<ResourceSnapshot<string>>({ status: 'idle', value: '' });
  const summarizerAvailability = signal<Availability>('unavailable');

  let initialized = false;
  let activeSummarization: Promise<string> | null = null;

  const initialize = async () => {
    if (initialized) {
      return;
    }
    initialized = true;

    const summarizer = await factory.create(summarizerOptions);
    summarizerAvailability.set('available');
    destroyRef.onDestroy(() => {
      summarizer.destroy();
    });
  };

  return {
    ...resourceFromSnapshots(state),
    summarizerAvailability,
    initialize,
  };
};
```

Finally, the implementation of the part that reactively summarizes the input text. In the following code, an `effect` is declared inside the `initialize` function. This `effect` subscribes to the `source` signal, and whenever `source` is updated, this function is re-executed. If the input text is not empty, it calls the `summarizer.summarize` function to generate a summary. Since this summarization process takes time, there is a possibility that the input text has been updated while it is summarizing. The key point is that I've implemented state management with an `activeSummarization` variable, as well as cancellation processing using an `AbortController` and the `onCleanUp` function, so that old summaries are not processed unnecessarily.

```typescript
export const summaryResource = (
  source: () => string,
  options: {
    summarizerOptions?: SummarizerCreateOptions;
    injector?: Injector;
  } = {},
): SummaryResource => {
  const injector = options.injector ?? inject(Injector);
  const destroyRef = injector.get(DestroyRef);
  const factory = injector.get(SummarizerFactory);
  const summarizerOptions = options.summarizerOptions;

  const state = signal<ResourceSnapshot<string>>({ status: 'idle', value: '' });
  const summarizerAvailability = signal<Availability>('unavailable');

  let initialized = false;
  let activeSummarization: Promise<string> | null = null;

  const initialize = async () => {
    //...

    effect(
      (onCleanUp) => {
        const input = source();
        if (!input.trim()) {
          state.set({ status: 'idle', value: '' });
          return;
        }

        const abortController = new AbortController();
        onCleanUp(() => {
          abortController.abort();
        });

        const summarizePromise = summarizer.summarize(input, { signal: abortController.signal });
        activeSummarization = summarizePromise;


        state.set({ status: 'loading', value: '' });
        summarizePromise
          .then((result) => {
            // Reflect only the latest Promise to avoid overwriting the new state with the results of an old summarize call.
            if (activeSummarization === summarizePromise) {
              state.set({ status: 'resolved', value: result });
            }
          })
          .catch((error) => {
            if (activeSummarization === summarizePromise) {
              state.set({ status: 'error', error });
            }
          });
      },
      { injector },
    );
  };

  //...

  return {
    ...resourceFromSnapshots(state),
    summarizerAvailability,
    initialize,
  };
};
```

By combining these, the `summaryResource` mentioned at the beginning is completed. If you want to read the entire source code, you can check it on StackBlitz or GitHub.

https://github.com/lacolaco/angular-built-in-ai/blob/main/src/app/summarized.resource.ts

## Summary

- I prototyped `summaryResource` to reactively handle the Summarizer API, a Chrome Built-in AI, using Angular's Resource API and Signals.
- `SummaryResource` extends `Resource<string>` and provides `summarizerAvailability`, which indicates the availability of the Summarizer, and `initialize()`, which is used to initialize from a user operation.
- Since on-demand model downloading requires user activation, it is designed to either auto-initialize based on `availability` or have `initialize()` called explicitly from a button or similar.
- In the implementation, I switched `SummarizerFactory` via DI to allow falling back to a Noop implementation in unsupported environments.
- Input text summarization is subscribed to via `effect`, and by using an `AbortController` and a guard that only reflects the latest Promise, it follows input updates while avoiding unnecessary processing or conflicts.