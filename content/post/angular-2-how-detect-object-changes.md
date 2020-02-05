---
title: "Angular2はいかにしてオブジェクトの変更を監視しているのか"
date: 2016-01-15T15:58:22+09:00
tags: [Angular]
---

こんにちは、laco0416 です。

今回は Angular2 がいかにしてオブジェクトの変更を監視し、データバインディングを解決しているのかを解き明かします。

## 結論

[この部分](https://github.com/angular/angular/blob/7ae23adaff2990cf6022af9792c449730d451d1d/modules/angular2/src/core/application_ref.ts#L374)でループと tick 処理を実装していた。

```ts
ObservableWrapper.subscribe(this._zone.onTurnDone, _ => {
  this._zone.run(() => {
    this.tick();
  });
});
```

## 調査開始

Angular2 は`$apply`がないのにどうやってオブジェクトの変更をビューに反映しているんだろう？という疑問から調査を開始。

そもそも、Component のプロパティに変更を加えたときに何かイベントが発生しているわけではない（object.Observe も Proxies も使っていない)ので、何かしらのタイミングで別のメソッドから変更があるかどうかをチェックしているはず。

ということで変更を検知する処理を探索、AbstractChangeDetector に`detectChanges`メソッドを発見。

https://github.com/angular/angular/blob/fcc7ce225ec6b6abc8935c2a024941ee53dce1e6/modules/angular2/src/core/change_detection/abstract_change_detector.ts#L76

```ts
  detectChanges(): void { this.runDetectChanges(false); }
```

このメソッドが呼ばれると、ChangeDetector が保存している状態と現在の状態を比較して、変更点をリストアップするらしい。

次にこの`detectChanges`が呼ばれている部分を探す。発見。

https://github.com/angular/angular/blob/7ae23adaff2990cf6022af9792c449730d451d1d/modules/angular2/src/core/application_ref.ts#L471

```ts
  tick(): void {
    if (this._runningTick) {
      throw new BaseException("ApplicationRef.tick is called recursively");
    }

    var s = ApplicationRef_._tickScope();
    try {
      this._runningTick = true;
      this._changeDetectorRefs.forEach((detector) => detector.detectChanges());
      if (this._enforceNoNewChanges) {
        this._changeDetectorRefs.forEach((detector) => detector.checkNoChanges());
      }
    } finally {
      this._runningTick = false;
      wtfLeave(s);
    }
  }
```

`ApplicationRef_`クラスの tick()メソッドの中で呼ばれていた。ざっと上から処理を追うと、

1. tick が入れ子になっていないかのチェック（1ApplicationRef につき同時に走る tick は 1 つ）
2. `_tickScope`の呼び出し。中はプロファイリング用の処理だった。無視して OK
3. tick 処理を開始。フラグを立てる
4. ApplicationRef が持っている ChangeDetector すべてに`detectChanges`を実行
5. `_enforceNoNewChanges`が true ならすべての ChangeDetector を変更がなかったものとする（`ngAfter**`系のライフサイクルが発生しないっぽい）
6. tick 処理を終了。フラグを下ろす
7. プロファイリングを終了する。無視して OK

アプリケーション全体のデータバインディングを解決するメソッドが分かった。これが AngularJS の\$digest ループ相当のものらしい。あとはこれが呼ばれている場所がわかればいい。

というわけで tick()を呼び出している部分を探索、発見。

https://github.com/angular/angular/blob/7ae23adaff2990cf6022af9792c449730d451d1d/modules/angular2/src/core/application_ref.ts#L374

```ts
constructor(private _platform: PlatformRef_, private _zone: NgZone, private _injector: Injector) {
    super();
    if (isPresent(this._zone)) {
      ObservableWrapper.subscribe(this._zone.onTurnDone,
                                  (_) => { this._zone.run(() => { this.tick(); }); });
    }
    this._enforceNoNewChanges = assertionsEnabled();
  }
```

`ApplicationRef_`のコンストラクタである。bootstrap 関数によってアプリケーションの開始時に一度だけ呼ばれる部分。当たり前といえば当たり前である。

とはいえ初見ではこれが tick ループの実装だとはわからないと思うので、ひとつずつ解説する。

### `ObservableWrapper.subscribe`

ObservableWrapper の実装はこれ
[class ObservableWrapper](https://github.com/angular/angular/blob/fcc7ce225ec6b6abc8935c2a024941ee53dce1e6/modules/angular2/src/facade/async.ts#L26)

RxJS の Observable をラップし、EventEmitter と協調するための Angular2 用の非同期処理用便利クラスである。Observable の処理を Wrapper の static メソッドで行うことができるので RxJS を隠蔽できる。

`subscribe`メソッドは、第 1 引数に渡された EventEmitter のイベントが発行されるたびに第 2 引数の関数が実行される。

### `this._zone.onTurnDown`

subscribe の第 1 引数に渡されたこれは前述のとおり EventEmitter である。つまり、このイベントが発火されるたびに第 2 引数の処理が走る。

`this._zone`の型は`NgZone`だが、これは Zone.js の Zone を拡張した Angular2 用の Zone である。

[class NgZone](https://github.com/angular/angular/blob/fcc7ce225ec6b6abc8935c2a024941ee53dce1e6/modules/angular2/src/core/zone/ng_zone.ts#L92)

どのように拡張しているかというと、
Zone の`run`が実行されるたびに自身の`onTurnStart`を発火し、処理が終了すると`onTurnDone`を発火するようになっている。

[このソース](https://github.com/angular/angular/blob/fcc7ce225ec6b6abc8935c2a024941ee53dce1e6/modules/angular2/src/core/zone/ng_zone.ts#L352)にある`_notifyOnTurnStart`と`_notifyOnTurnDone`がそれである。

### `this._zone.run(() => { this.tick(); }`

これは ApplicationRef が持っている Zone 中で tick 処理を行っているだけである。Zone については本稿では扱わないが、複数の非同期処理をグループ化し、コンテキストを共有したもののように思ってもらえればよい。同じ Zone 内で起きたエラーを一括でハンドルしたり、非同期のスタックトレースを取得できたりする。

[angular/zone.js: Implements Zones for JavaScript](https://github.com/angular/zone.js/)

これですべての謎が解けた。まとめると以下のようになる。

1. ApplicationRef が作成される（bootstrap 関数の中で作られる）
2. Application の NgZone が作成され、tick ループが作られる
3. 各 Component が自身の ChangeDetector を Application に登録する（これはコンポーネントツリー構築時にされている）
4. tick が呼ばれる
5. すべての ChangeDetector が変更チェックし、データバインディングを解決する
6. tick 処理が終わると`onTurnDone`イベントが発火する
7. `onTurnDone`イベントを受けて tick を実行する
8. 4 に戻る

イベントドリブンな再帰ループ？とでも言うのだろうか。ともかくこういう仕組みで動いている。setInterval とかではない。

## 所感

RxJS と Zone.js との合わせ技だが、わかってしまえばシンプルだった。ちなみに処理の追跡は全部 GitHub 上で出来たので楽だった。

Zone.js についてはまた後日記事を書こうと思う。
