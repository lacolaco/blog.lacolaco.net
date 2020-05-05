---
title: "Angular Forms: Partial Form Injectionパターンの検討"
date: 2020-02-08T10:23:15+09:00
tags: ["angular","forms","design","thought"]
foreign: true
---

**Partial Form Injection** とは、AngularのReactiveFormsを使った実装において、フォームのデータモデルをいくつかの部分フォーム（Partial Form）のコンポジションとして構成する手法につけた名前である。
この記事のサンプルアプリケーションは https://stackblitz.com/edit/ivy-3fq2no?file=src%2Fapp%2Fapp.component.html で実行できる。

たとえば次のようなデータモデルを想定しよう。ヘルストラッカーアプリのようなイメージで、一日の起床時間と就寝時間、そしてその日のワークアウトの内容を記録できるフォームだ。

```ts
interface ActivityInput {
    activityTimes: {
        awokeAt: {
            hour: number;
            minute: number;
        };
        sleptAt: {
            hour: number;
            minute: number;
        }
    };
    workouts: WorkoutInput[];
}

interface WorkoutInput {
    type: 'running' | 'walking' | 'swimming';
    minutes: number;
}
```

## 部分フォームの作成

このようなデータモデルのフォームを構築するに際し、まず **部分フォーム** を作成する。部分フォームは関心によって境界づけられる。今回の例では、 `activityTimes` と `workouts` がそれぞれ 部分フォーム の単位となる。
具体的には、それぞれの部分フォームごとにフォームモデルを作成する。対象がネストされたグループ構造であれば `FormGroup`を、リスト構造であれば `FormArray`を選択する。もちろん関心の分け方によっては `FormControl` を選択することもありえる。

```ts
@Component({
  selector: "my-app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  activityTimesForm = new FormGroup({
    awokeAt: new FormGroup({
      hour: new FormControl(null),
      minute: new FormControl(null)
    }),
    sleptAt: new FormGroup({
      hour: new FormControl(null),
      minute: new FormControl(null)
    })
  });

  workoutsForm = new FormArray([]);
  
  addWorkout() {
    this.workoutsForm.push(
      new FormGroup({
        type: new FormControl("running"),
        minutes: new FormControl(0)
      })
    );
  }
}

```

部分フォームの作成後、これらを合成し、全体のフォームモデルを作成する。

```ts

@Component({
  selector: "my-app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  ...
    
  activityInputForm = new FormGroup({
    activityTimes: this.activityTimesForm,
    workouts: this.workoutsForm
  });
```

## HTMLフォームの構築

さて、次はHTMLフォームを組み立てるためのテンプレートの記述に移ろう。
このパターンが Partial Form **Injection** と呼ばれる所以は、それぞれのPartial Formに対応するコンポーネントを作成し、**パタメータとして注入する**ことにある。つまり、親テンプレートは次のようになる。

```html
<form [formGroup]="activityInputForm">
	<app-activity-times-form [model]="activityTimesForm">
	</app-activity-times-form>
</form>
```

`ActivityTimesFormComponent` は次のように作成する。Inputで `model: FormGroup` を定義し、親から注入可能にする。テンプレートでは ルートレベルで `[formGroup]="model"` を使ってフォーム構築する。内部は通常のReactive Formの実装と何ら変わらない。 

```ts
@Component({
  selector: 'app-activity-times-form',
  templateUrl: './activity-times-form.component.html',
  styleUrls: ['./activity-times-form.component.css']
})
export class ActivityTimesFormComponent {

  @Input()
  model: FormGroup;
}
```

```html
<ng-container [formGroup]="model">
  <div formGroupName="awokeAt">
    <span>Awoke at:</span>
    <span>
    <input type="number" formControlName="hour"> 
    : 
    <input type="number" formControlName="name" >
    </span>
  </div>

  <div formGroupName="sleptAt">
    <span>Slept at:</span>
    <span>
    <input type="number" formControlName="hour"> 
    : 
    <input type="number" formControlName="name" >
    </span>
  </div>
</ng-container>
```

WorkoutsComponentについての説明は同様であるため割愛する。

## 手法の評価

Partial Form Injectionによって作られるフォームには以下の特徴が見られる。

- フォームモデルは親コンポーネントによって一元的に管理される。
- HTMLフォームはそれぞれの子コンポーネントによって個別に管理される。

### フォームモデルの一元管理

フォームは全体としての整合性を強く要求される。バリデーションのエラーや、touched・dirtyのようなフォームの状態が**全体として統合されている**ことに意味がある。よって個別のコンポーネントがフォームモデルを独自に構築するアプローチは成立しない。フォームモデルの一元管理は必然的な帰結である。

似たアプローチとして、それぞれの子コンポーネントに ControlValueAccessor (CVA) を実装させ、カスタムフォームコントロールとして振る舞わせる手法もある。この方法を取らなかったのは以下の理由による。

- CVAは自身に紐付けられているフォームモデルを参照することができず、内包する自身のフォームモデルとの同期が簡単でないため
- 子コンポーネントがCVAとして振る舞うためにAngular Forms的作法の関心を持たざるをえなくなるため（この点については後述する）

一方で親コンポーネントからInputとして部分フォームモデルを注入することで以下のような課題も発生する。

- 親子コンポーネント間の結合は強くなり、子コンポーネントの再利用性は著しく下がる
- フォームモデルの構造は親が管理しているため、HTMLフォームの構築のために親コンポーネントが持つ部分フォームモデルの定義を知る必要がある。
- 親と同じフォームモデルを参照するため、子コンポーネントでの操作が親コンポーネントに副作用を与えうる。

総じて、再利用性に重きを置くカスタムフォームコントロールでは従来どおりCVAによる実装を取るべきであり、そうではなくユースケースに強く依存した複雑なフォームにおいては、管理しやすい粒度に分割するためのアプローチとしてPartial Form Injectionは有用であるといえる。
言い換えれば、ボトムアップ的合成のアプローチがCVAであり、トップダウン的分解のアプローチがPartial Form Injectionである。

### HTMLフォームの個別管理

フォームの実装が難しい理由のひとつは、HTMLレイアウトとしての関心をフォームのデータモデルとマッピングする必要があるためである。
また、フォームはステートフルなUIであるため、状態によってスタイルを変えたりエラーを表示したりといった**状態に対してリアクティブなUI**であることも強く求められる。
これは管理するフォームが大きくなるほどより困難になるため、コンポーネントとして分離することでメンテナンス性を確保する。

そのためにはHTMLフォームの構築を担う部分フォームコンポーネントは極力HTMLフォームの構築以外の関心を持たせないほうがよい。データの処理やバリデーションなどはすべて親に移譲し、子は部分フォームモデルの状態に対してリアクティブにHTMLを構築することだけに集中させたい。
CVAによるアプローチは再利用可能なフォームコントロールであることを表明する実装を求められるため、部分フォームコンポーネントにとっては形式的なコードが増える。再利用を目的としないのであれば無駄であり、HTMLフォームの構築に関心を集中させたいという目的に逆行する。
また、上述の「子コンポーネントでの操作が親コンポーネントに副作用を与えうる」という課題に対しても、部分フォームコンポーネントは一切の能動的ロジックを持たず親に処理を移譲する方針は解決策となる。

### 結論

単純でないフォームを構築する上での汎用的アプローチとして採用できるのではないか。
ただしこのアプローチの力点は **ユースケースに強く依存した複雑なフォームを管理しやすい粒度に分割すること** であることに留意したうえで、再利用性を犠牲にしていることに自覚的であるべきだ。

### 課題

- ReactiveForms自体の型安全性の問題
    - 親から渡すフォームモデルの構造と子が期待するフォームモデルの構造が一致していることを静的に検証できないだろうか
    - フレームワークの改善を待たずとも、ジェネリクスを備えたラッパーを作ることで比較的容易に解決はできる
- 部分フォームモデルを読み取り専用にできないだろうか
    - 子コンポーネントから親コンポーネントへ副作用を起こすことを機械的に禁じることができないだろうか
- 部分フォームコンポーネントのインターフェースを定義できないだろうか
    - あるコンポーネントが部分フォームコンポーネントであることを型レベルで静的に表明できないだろうか
        - 例えば `class ActivityTimesForm extends PartialForm<FormGroup>`のような