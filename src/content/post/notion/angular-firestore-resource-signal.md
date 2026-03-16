---
title: 'Angular: Firestore ResourceでリアルタイムデータをSignal化する'
slug: 'angular-firestore-resource-signal'
icon: ''
created_time: '2026-03-16T01:41:00.000Z'
last_edited_time: '2026-03-16T01:41:00.000Z'
tags:
  - 'Angular'
  - 'Signals'
  - 'Firebase'
  - '設計'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Firestore-Resource-Signal-3c1c45e4096f4bd298c209b07d7be73f'
features:
  katex: false
  mermaid: false
  tweet: false
---

個人開発しているプロジェクトの中で、Firestore のリアルタイムデータを Angular の Signal として扱えるようにする仕組みを実装した。Angular 組み込みの `resource()` と同じ `Resource<T>` インターフェースに従いながら、リアルタイムストリームに対応したアダプタ層を設計したのでその話をする。

## 背景

Angular v19 で experimental として導入された [`resource()`](https://angular.dev/guide/signals/resource) は、非同期データを Signal として扱うための API だ。組み込みの `resource()` は Promise ベースの request-response モデルと、ストリーミングモデルに対応している。しかしどちらも共通するのは基本的にリードオンリーのデータソースということだ。今回は Firestore からデータを取得しつつ、更新も扱えるモデルがほしかったので組み込みのAPIでは実現しにくい。

ところで `resource()` が返す [`Resource<T>`](https://angular.dev/api/core/Resource) はインターフェースだ。`value()`, `status()`, `error()`, `isLoading()`, `hasValue()` などのプロパティが定義されていて、別に `resource()` を通さなくても自分で実装できる。そこで `Resource<T>` インターフェースに準拠しつつ、Firestore のリアルタイム購読を Signal で扱える `createCollectionResource()` と `createDocumentResource()` を作った。

## API 設計

2つのファクトリ関数を提供する。どちらも Angular の injection context 内で呼び出す。

### `createCollectionResource`

```typescript
const booksResource = createCollectionResource<BookDocument, Book>(
  () => 'books', // path を返す関数(Signal)
  {
    transform: ({ id, data }) => parseBook(data!, id),
    orderBy: { field: 'createdAt', direction: 'desc' },
  },
);

// テンプレートで使用
@if (booksResource.isLoading()) {
  <p>Loading...</p>
} @else if (booksResource.error()) {
  <p>Error: {{ booksResource.error()?.message }}</p>
} @else {
  @for (book of booksResource.value(); track book.id) {
    <div>{{ book.title }}</div>
  }
}
```

### `createDocumentResource`

```typescript
const settingsResource = createDocumentResource<SettingsDocument, Settings>(
  () => ['app_settings', 'default'], // path を返す関数(Signal)
  { transform: ({ data }) => parseSettings(data!) },
);

// computed や effect で使用
const theme = computed(() => {
  if (settingsResource.hasValue()) {
    return settingsResource.value().theme;
  }
  return 'light';
});
```

`path` は関数であり、Signal オブジェクトを渡すことができる。Signal である場合にはその変更に反応して自動的に購読を張り直す。`string[]` を使えば `['collection', 'docId']` のようなパスセグメント指定もできる。

## `resource()` との比較

Angular の `resource()` と今回の Firestore Resource は、多くの部分で同じように振る舞う。

どちらもパラメータを関数で宣言する。`resource()` では `request: () => T`、Firestore Resource では `path: () => string | string[]` だ。関数にすることで内部の Signal tracking が機能し、パラメータが変わったら自動的に再実行される。状態の読み取りも同じで、`value()`, `status()`, `error()`, `isLoading()`, `hasValue()` が使える。`Resource<T>` インターフェースに揃えているので、コンポーネント側のコードはデータの取得元が REST API だろうと Firestore だろうと同じ形になる。

パラメータが変化したときに前回の処理を片付ける仕組みもある。`resource()` は `AbortSignal` を使い、Firestore Resource は購読の `unsubscribe` を使う。やり方は違うが利用者から見た振る舞いは変わらない。

相違点もある。Firestore Resource には `reload()` がない。リアルタイム購読ではデータは常にサーバーと同期されるので手動リロードという概念がそもそもない。`Resource<T>` インターフェース上 `reload()` はオプショナルなので省略しても準拠できる。

一方で Firestore Resource には `ref` プロパティを追加した。`Signal<CollectionReference>` または `Signal<DocumentReference>` として、更新操作に使う Firestore の参照を提供する。`path` が変化すれば参照も変わるので Signal にしている。

```typescript
// ref を使った更新操作の例
async function addBook(title: string) {
  const ref = booksResource.ref();
  await addDoc(ref, { title, createdAt: serverTimestamp() });
  // → リアルタイム購読により booksResource.value() が自動更新される
}
```

読み取りも書き込みも同じリソースを起点にできるので、コンポーネントのデータフローがわかりやすくなる。

## 実装

全体の実装は以下のとおり。Firestore SDK への直接参照を避けるためにアダプター層を介しているが、そこは今回の本題ではないので省略している部分がある。

```typescript
import { computed, inject, signal, effect, type Signal, type Resource } from '@angular/core';

/**
 * コレクションリソース（Resource<T[]>準拠 + コレクション参照）
 */
export type CollectionResource<TValue, TDocumentData = TValue> = Resource<TValue[]> & {
  ref: Signal<CollectionReference<TDocumentData>>;
};

/**
 * ドキュメントリソース（Resource<T | undefined>準拠 + ドキュメント参照）
 */
export type DocumentResource<TValue, TDocumentData = TValue> = Resource<TValue | undefined> & {
  ref: Signal<DocumentReference<TDocumentData>>;
};

/**
 * リソース内部状態（単一 signal で管理し、派生 computed で公開する）
 */
interface ResourceState<T, TRef> {
  data: T;
  ref: TRef;
  loading: boolean;
  error: Error | undefined;
}

/**
 * ResourceState から共通プロパティを導出する（hasValue は各ファクトリで定義）
 */
function deriveResourceBase<T, TRef>(state: Signal<ResourceState<T, TRef>>) {
  return {
    value: computed(() => state().data),
    ref: computed(() => state().ref),
    isLoading: computed(() => state().loading),
    error: computed(() => state().error),
    status: computed(() => {
      const s = state();
      if (s.error) return 'error' as const;
      if (s.loading) return 'loading' as const;
      return 'resolved' as const;
    }),
  };
}

/**
 * Firestoreコレクションのリアルタイムリソースを作成する
 * pathの変化で自動的に購読を張り直す
 */
export function createCollectionResource<TDocumentData, TValue = TDocumentData>(
  path: () => string | string[],
  options?: CollectionResourceOptions<TDocumentData, TValue>,
): CollectionResource<TValue, TDocumentData> {
  const adapter = inject(FirestoreAdapter);
  const transform =
    options?.transform ??
    ((snapshot: DocumentSnapshot<TDocumentData>) => snapshot.data as unknown as TValue);

  const subscriptionOptions: CollectionSubscriptionOptions | undefined = options
    ? { orderBy: options.orderBy, limit: options.limit, where: options.where }
    : undefined;

  const state = signal<ResourceState<TValue[], CollectionReference<TDocumentData>>>({
    data: [],
    ref: undefined!,
    loading: true,
    error: undefined,
  });

  effect((onCleanup) => {
    // path の更新を購読
    const p = path();
    // 状態を loading に変更
    state.update((s) => ({ ...s, loading: true }));

    const { ref, unsubscribe } = adapter.subscribeCollection<TDocumentData>(p, subscriptionOptions, {
      onNext: (docs) => {
        const items: TValue[] = [];
        for (const doc of docs) {
          try {
            items.push(transform(doc));
          } catch (e) {
            console.error(`[firestore-resource] Transform error for doc ${doc.id}:`, e);
          }
        }
        // 読み込み完了の状態に更新
        state.update((s) => ({ ...s, data: items, loading: false, error: undefined }));
      },
      onError: (error) => {
        // エラー状態に更新
        state.update((s) => ({
          ...s,
          loading: false,
          error: new Error(`データの取得に失敗しました: ${error.message}`),
        }));
      },
    });
    state.update((s) => ({ ...s, ref }));
    // effect の再実行時に古い購読を破棄
    onCleanup(() => unsubscribe());
  });

  return {
    ...deriveResourceBase(state),
    hasValue(): this is Resource<TValue[]> {
      const s = state();
      return !s.loading && !s.error;
    },
  };
}

/**
 * Firestoreドキュメントのリアルタイムリソースを作成する
 * pathの変化で自動的に購読を張り直す
 */
export function createDocumentResource<TDocumentData, TValue = TDocumentData>(
  path: () => string | string[],
  options?: DocumentResourceOptions<TDocumentData, TValue>,
): DocumentResource<TValue, TDocumentData> {
  const adapter = inject(FirestoreAdapter);
  const transform =
    options?.transform ??
    ((snapshot: DocumentSnapshot<TDocumentData>) => snapshot.data as unknown as TValue);

  const state = signal<ResourceState<TValue | undefined, DocumentReference<TDocumentData>>>({
    data: undefined,
    ref: undefined!,
    loading: true,
    error: undefined,
  });

  effect((onCleanup) => {
    const p = path();
    state.update((s) => ({ ...s, loading: true }));

    const { ref, unsubscribe } = adapter.subscribeDocument<TDocumentData>(p, {
      onNext: (snapshot) => {
        if (snapshot.exists) {
          try {
            state.update((s) => ({
              ...s,
              data: transform(snapshot),
              loading: false,
              error: undefined,
            }));
          } catch (e) {
            console.error('[firestore-resource] Transform error for doc', p, e);
            state.update((s) => ({ ...s, data: undefined, loading: false, error: undefined }));
          }
        } else {
          state.update((s) => ({ ...s, data: undefined, loading: false, error: undefined }));
        }
      },
      onError: (error) => {
        console.error('[firestore-resource] Error subscribing to', p, error);
        state.update((s) => ({
          ...s,
          loading: false,
          error: new Error(`データの取得に失敗しました: ${error.message}`),
        }));
      },
    });

    state.update((s) => ({ ...s, ref }));
    onCleanup(() => unsubscribe());
  });

  return {
    ...deriveResourceBase(state),
    hasValue(): this is Resource<Exclude<TValue, undefined>> {
      const s = state();
      return !s.loading && !s.error && s.data !== undefined;
    },
  };
}
```

## 実装のポイント

### 単一 Signal による状態管理

内部では `ResourceState<T, TRef>` 型の `Signal` で全状態を管理している。

```typescript
interface ResourceState<T, TRef> {
  data: T;
  ref: TRef;
  loading: boolean;
  error: Error | undefined;
}
```

`value()`, `ref()`, `isLoading()`, `error()`, `status()` はすべてこの Signal からの `computed` 導出だ。状態遷移は常に `state.update()` の1回の呼び出しで完結するため、中間状態が派生 Signal に伝播することはない。

### `effect` によるライフサイクル管理

どちらのファクトリも同じ構造を持つ。

1. `effect` 内で `path()` を評価（Signal tracking）
1. FirestoreAdapter の subscribe メソッドで購読開始
1. コールバックで `transform` 適用 → 内部状態を原子的に更新
1. `onCleanup` で購読解除（path 変化時・コンポーネント破棄時に自動実行）

この構造により、`path` に含まれる Signal が変化すると自動的に前回の購読を解除して新しい購読を開始する。

## ドメインリソースの定義

アプリケーション層では、このアダプタを使って具象リソースを1行で定義できる。

```typescript
export function createBooksResource() {
  return createCollectionResource<BookDocument, Book>(
    () => 'books',
    {
      transform: ({ id, data }) => parseBook(data!, id),
      orderBy: { field: 'createdAt', direction: 'desc' },
    },
  );
}

export function createSettingsResource() {
  return createDocumentResource<SettingsDocument, Settings>(
    () => ['app_settings', 'default'],
    { transform: ({ data }) => parseSettings(data!) },
  );
}
```

コンポーネントからは、これらのファクトリ関数を injection context 内で呼び出すだけだ。

```typescript
@Component({
  template: `
    @if (books.hasValue()) {
      @for (book of books.value(); track book.id) {
        <div>{{ book.title }}</div>
      }
    }
  `,
})
export class BookListComponent {
  protected readonly books = createBooksResource();
}
```

## まとめ

`Resource<T>` は `resource()` のためだけのものではない。今回は Firestore を対象にしたが、非同期性のあるデータソースはどんなものでも同じ構造で実装できるはずだ。さまざまなデータソースの差異を、`Resource<T>` という共通のインターフェースで抽象化することで、アプリケーションレイヤから見たときの情報隠蔽、関心の分離が一歩進む。

また、こうした `createXxxResource` というファクトリ関数による抽象化は、Angular が長らく採用してきた Component と Service という責務分割の典型的パターンに変化を加えるものだ。データの購読・変換・状態管理をひとつの関数に閉じ込めて、コンポーネントはそれを呼ぶだけ。Service クラスを経由するまでもないケースが増えてくる。この方向が今後の主流になっていく予感がしている。今後も Resource インタフェースのユースケースについて研究していく。

