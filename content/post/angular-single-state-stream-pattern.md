---
title: AngularコンポーネントにおけるSingle State Streamパターン
date: 2019-07-11T00:40:00.000Z
tags: [angular, architecture]
---

## Single State Stream パターン

これはAsync Pipeを活用したリアクティブなAngularコンポーネントを作る上で、汎用性の高い実装パターンである。
テンプレートでレンダリングする**状態**を**単一**の**ストリーム**として扱うため、私はこれを **Single State Stream**パターンと名付けた。Sが3つで覚えやすい。
過去にも何度か発表で触れているが、改めて言語化して誰からも参照可能な状態にしておく。

同じようなアイデアはng-conf 2019でDeborah Kurataさんも軽く紹介している。こちらでは `vm$` という名前で複数のストリームを合成しているが、ng-conf後にDeborahさんに話したところこれはSingle State Streamパターンと全く同じものだった。

{{< youtube Z76QlSpYcck >}}

[ngConf 2019: Data Composition](https://docs.google.com/presentation/d/11tlfhUoyZ6WG7-UyYE3YsfiaZcy7ijPO6hA4CFKaCn8/preview?slide=id.g550602cfc5_2_141)

## Code Example

コードを見て理解するのが一番早い。次の例ではコンポーネントが直接BehaviorSubjectで状態を管理しているが、これはSingle State Streamパターンをわかりやすく説明するためである。まともなアプリケーションであれば適切に状態管理のサービスに移譲する。そのパターンのコード例は後述する。

    type AppComponentState = {
      user: User | null;
      userFetching: boolean;
    }
    
    const initialState: AppComponentState = {
    	user: null,
    	userFetching: false,
    };
    
    @Component({
      template: `
    <ng-container *ngIf="state$ | async as state">
    	
    	<ng-container *ngIf="state.userFetching; else showUser">
    		<loading-spinner></loading-spinner>
    	</ng-container>
    
    	<ng-template #showUser>
    		<user-display [user]="state.user"></user-display>
    	</ng-template>
    
    </ng-container>
      `
    })
    export class AppComponent {
      readonly state$ = new BehaviorSubject<AppComponentState>(initialState);
    
    	fetchUser() {
    		this.setState({ user: null, userFetching: true });
    		
    		this.userService.fetchUser().subscribe(user => {
    			this.setState({ user, userFetching: false });
    		}, error => {
    			this.setState({ user: null, userFetching: false });
    		});
    	}
    
      setState(state: AppComponentState) {
    		this.state$.next(state);
    	}
    }

## ComponentStateと `state$`

そのコンポーネントのテンプレートに必要な状態を定義した型を作る。上記の例では `AppComponentState` 型。この型のObservableをコンポーネントに `state$` プロパティとして宣言する。

単一のストリームにすることにより、ある時点での複数の非同期的な値の組み合わせをスナップショット化できる。

この `state$` をテンプレートの最上位で `state$ | async as state` することでその内部のテンプレートに同期的な `state` を注入できる。

この実装パターンは、テンプレート全体をひとつのStatelessな関数のように捉えることができるところが良い。いわばReactの `render` 関数のように、引数として `state` が与えられることでその状態に対応したビューを描画する。いわゆる `UI = f(State)` 的なアーキテクチャと相性がいい。

    // 擬似的な再現コード
    const AppComponent = (state: AppComponentState) => {
    	if (state.userFetching) {
    		return <loading-spinner />;
    	} else {
    		return <user-display user={state.user} />;
    	}
    };

## Storeサービスとの併用

上述の例ではコンポーネントが直接BehaviorSubjectを管理していたが、NgRxのStoreのような状態管理レイヤーのサービスと併用すると次のような実装パターンになる。テンプレートはまったく変わらず、 `state$` の作り方が変わるだけである。

    type AppComponentState = {
      user: User | null;
      userFetching: boolean;
    }
    
    @Component({
      template: `
    <ng-container *ngIf="state$ | async as state">
    	
    	<ng-container *ngIf="state.userFetching; else showUser">
    		<loading-spinner></loading-spinner>
    	</ng-container>
    
    	<ng-template #showUser>
    		<user-display [user]="state.user"></user-display>
    	</ng-template>
    
    </ng-container>
      `
    })
    export class AppComponent {
      readonly state$: Observable<AppComponentState>;
    
    	constructor(private store: Store<AppState>) {
    		// ComponentStateへのマッピング
    		this.state$ = this.store.select(state => ({
    			user: state.user.value,
    			userFetching: state.user.fetching,
    		}));
    	}
    
    	fetchUser() {
    		this.store.dispatch(startUserFetching());
    		
    		this.userService.fetchUser().subscribe(user => {
    			this.store.dispatch(finishUserFetching(user));
    		}, error => {
    			this.store.dispatch(finishUserFetching(null));
    		});
    	}
    }

あるいは、単一データストアではなく分散型の場合は、 `combineLatest` を使った形にもできる。（この例では不自然だが）もし `user$` と `userFetching$` を別々に管理しているなら次の例のように合成すれば、これもテンプレートには全く影響がない。

    type AppComponentState = {
      user: User | null;
      userFetching: boolean;
    }
    
    @Component({
      template: `
    <ng-container *ngIf="state$ | async as state">
    	
    	<ng-container *ngIf="state.userFetching; else showUser">
    		<loading-spinner></loading-spinner>
    	</ng-container>
    
    	<ng-template #showUser>
    		<user-display [user]="state.user"></user-display>
    	</ng-template>
    
    </ng-container>
      `
    })
    export class AppComponent {
      readonly state$: Observable<AppComponentState>;
    
    	constructor() {
    		this.state$ = combineLatest(
    			[user$, userFetching$], 
    			([user, userFetching]) => ({ user, userFetching }), // Destructuring
    		);
    	}
    }

ここまで見たように、Single State Streamパターンではコンポーネントとテンプレートの間に `state$` が挟まることである種のクッションとして働き、アプリケーションの状態管理がどのように変わっても、 `state$` のインターフェースさえ維持されていればコンポーネントのレンダリングには影響を与えないようになる。

言い換えれば、どのようなアプリケーションのアーキテクチャにおいてもSingle State Streamパターンは適合する。特に、Container / Presentational のようなコンポーネント設計をしている場合には、Containerコンポーネントにとてもよくマッチする。

また、コンポーネントをテストするときにも `state$` の値を更新するだけでよいので、テンプレートのレンダリング結果をユニットテストしやすい。

## Single State Streamパターンのデメリット

ComponentStateが複雑になる、つまり `state$` のプロパティが増えてくると少し問題が出てくる。 `state$` の値が変わるたびにテンプレート全体の評価が行われるため、互いに関連性の少ないプロパティが増えてくると無駄な計算処理が増えてしまう。
この問題は `@Input` で値を受け取る側のコンポーネントのChange Detection Strategyを **OnPush** にすることで大幅に緩和できる。Async Pipeがある部分だけはどうしようもないが、それぞれの子コンポーネントの先が再評価されなければパフォーマンスにはほぼ影響はない。

下記の例では、 `[state.foo](http://state.foo)` だけが変化した場合でも `state` オブジェクトの値が変われば当然 `ng-container` 内の再評価が行われる。OnPushを使わなければ `[state.bar](http://state.bar)`に変化がなくても `<bar-display>` と `<baz-display>` までもが一緒に再評価されてしまうが、OnPushを使えば `state.bar` が変わらない限り `<bar-display>` は再評価されない。

    <ng-container *ngIf="state$ | async as state">
    	
    	<foo-display [value]="state.foo"></foo-display>
    
    	<bar-display [value]="state.bar"></bar-display>
    
    	<baz-display [value]="state.baz"></baz-display>
    
    </ng-container>