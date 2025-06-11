---
title: 'Angular: Model Inputsを使ったカスタムフォームコントロール実装例'
slug: 'angular-cva-signals'
icon: ''
created_time: '2024-06-13T14:44:00.000Z'
last_edited_time: '2024-06-14T01:04:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Signals'
  - 'Forms'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-Model-Inputs-3a28e81c63c84670af97d9e6218e2db8'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular v17.2で実装されたModel Inputsを使ってカスタムフォームコントロールを実装してみよう。SignalベースのAPIが揃ってきたことで、`ControlValueAccessor`の実装もかなり簡潔になった。

## `TimeInputComponent`

次のような`Time`型を読み書きする`ControlValueAccessor`を題材にする。

```ts
export type Time = {
  hour: number;
  minute: number;
};
```

今回は素朴にselect要素で時間と分を選択するようなコンポーネントを考える。UIだけ実装すると次のようになる。

```ts
@Component({
  selector: 'app-time-input',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div>
      <select>
        @for (i of hourOptions; track i) {
          <option [value]="i">{{ i | number: '2.0' }}</option>
        }
      </select>
      <span>:</span>
      <select>
        @for (i of minuteOptions; track i) {
          <option [value]="i">{{ i | number: '2.0' }}</option>
        }
      </select>
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
    }
  `,
})
export class TimeInputComponent {
  readonly hourOptions = getRange(0, 23);
  readonly minuteOptions = getRange(0, 59);
}
```

<figure>
  <img src="/images/angular-cva-signals/Untitled.png" alt="時と分をセレクトボックスで選択できる素朴な時刻入力コンポーネント">
  <figcaption>時と分をセレクトボックスで選択できる素朴な時刻入力コンポーネント</figcaption>
</figure>

これをAngular Formsと連携できるカスタムフォームコントロールとして実装しよう。まずは `value` という`Time`型のModel Inputを作成する。これを次のように`NgModel`を使ってselectと紐付ける。

```ts
@Component({
  selector: 'app-time-input',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div>
      <select [ngModel]="value().hour" (ngModelChange)="updateHour($event)">
        @for (i of hourOptions; track i) {
          <option [value]="i">{{ i | number: '2.0' }}</option>
        }
      </select>
      <span>:</span>
      <select [ngModel]="value().minute" (ngModelChange)="updateMinute($event)">
        @for (i of minuteOptions; track i) {
          <option [value]="i">{{ i | number: '2.0' }}</option>
        }
      </select>
    </div>
  `,
})
export class TimeInputComponent {
  readonly value = model<Time>({ hour: 0, minute: 0 });

  readonly hourOptions = getRange(0, 23);
  readonly minuteOptions = getRange(0, 59);

  updateHour(value: number) {
    this.value.update((curr) => ({ ...curr, hour: value }));
  }

  updateMinute(value: number) {
    this.value.update((v) => ({ ...v, minute: value }));
  }
}
```

これだけでも、親からは `<app-time-input [(value)]="...">` という形で双方向バインディング可能になった。ここからはさらに`<app-time-input [(ngModel)]="...">` や`<app-time-input [formControl]="...">` のようにAngular Formsとの連携が可能となるように、`ControlValueAccessor`としての実装を加える。

`TImeInputComponent` クラスで`ControlValueAccessor` インターフェースを実装すると次のようになる。Angular Formsからカスタムフォームコントロールであることが識別できるように`NG_VALUE_ACCESSOR` として自身を提供することを忘れないようにする。

```ts
@Component({
  selector: 'app-time-input',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `...`,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: TimeInputComponent,
      multi: true,
    },
  ],
})
export class TimeInputComponent implements ControlValueAccessor {
  readonly value = model<Time>({ hour: 0, minute: 0 });
  #onChangeListener = (_: Time) => {};

  constructor() {
    // Emit value change to form control
    effect(() => {
      this.#onChangeListener(this.#value());
    });
  }

  // ControlValueAccessor implementation

  writeValue(value: Time): void {
    this.value.set(value);
  }

  registerOnChange(fn: (v: Time) => void): void {
    this.#onChangeListener = fn;
  }

  registerOnTouched(fn: any): void {
    // noop
  }
}
```

Signalベースになったことでのポイントは、フォームモデルへ値の変更を伝えるためのコールバック関数 `#onChangeListener` の呼び出しが、`value` SignalのEffectを書くだけで完結している点だ。どのような経緯であれ`value` に変更があればフォームモデルに同期できるため、同期漏れの心配がない。また、コンポーネントが破棄されたあとのメモリリークの心配もない。

```ts
  #onChangeListener = (_: Time) => {};

  constructor() {
    effect(() => {
      this.#onChangeListener(this.value());
    });
  }

  registerOnChange(fn: (v: Time) => void): void {
    this.#onChangeListener = fn;
  }
```

同期漏れの心配はないが、逆に同期しすぎることはありえる。特に今回の例では`Time` 型はオブジェクトなので、`value` が更新されるたびに参照が変わる。等値ではないことになるため、実際の値が変わっていなくても`value` がセットされるたびにフォームモデルへ通知されてしまう。

> [!NOTE]
> `model()` は `signal()` や `computed()` と違い、`equal` オプションを持たないため、等値判定を変更できない。これは `input()` も同様である。オプションの追加を求めるイシューがあるため、賛同する人がいればイシューに対してさらなるVoteをお願いしたい。
> [https://github.com/angular/angular/issues/54111](https://github.com/angular/angular/issues/54111)

この問題を解決するために、新たに `#changedValue` Signalを作成する。これは`value` Signalから派生し、`Time`型のための等値判定関数を与えていることで、実際の値が変更したときだけ通知されるSignalになる。

```ts
// 等値判定関数
export function isEqualTime(a: Time, b: Time) {
  return a.hour === b.hour && a.minute === b.minute;
}

export class TimeInputComponent implements ControlValueAccessor {
  readonly value = model<Time>({ hour: 0, minute: 0 });

  readonly #changedValue = computed(() => this.value(), { equal: isEqualTime });

  constructor() {
    // Emit value change to form control
    effect(() => {
      this.#onChangeListener(this.#changedValue());
    });
  }
}
```

動作するサンプルは以下。現実のユースケースではもう少し複雑なコンポーネントになるが、基本的な構造はこの形から始めて拡張していけるはずだ。また、Angular本体のほうでもよりSignal APIとの親和性を高めるためのフォームAPIの拡張を計画しているため、それが来るともっとボイラープレートを減らせるかもしれない。それに備える意味でも今からカスタムコントロールをSignalベースに寄せていくのは無駄にならないだろう。

https://stackblitz.com/edit/angular-91xmwg?ctl=1&embed=1&file=src/main.ts
