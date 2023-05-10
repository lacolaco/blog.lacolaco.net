---
title: 'GitHub Actions: Yarn キャッシュをシンプルに使う'
date: 2021-06-01T22:58:58+09:00
updated_at: 2021-07-03T09:28:56.449Z
tags: ['github-actions', 'github', 'yarn']
---

**追記（2021-07-03）**

`actions/setup-node` が公式にキャッシュ機能を実装したため、この記事で紹介した `actions/cache` を使った方法はまったく無用になった。

{{< embed "https://github.blog/changelog/2021-07-02-github-actions-setup-node-now-supports-dependency-caching/" >}}

今後は `actions/setup-node` の `cache` オプションで事足りるだろう。以下は読まなくていい。

---

GitHub Actions で継続的インテグレーション・デプロイを構成すると、すぐに問題になるのはキャッシュの活用だろう。
特に Node.js プロジェクトでは NPM から依存パッケージをダウンロードする時間がワークフロー実行時間全体の大部分を占めることも珍しくない。
毎回すべての依存パッケージをインターネット越しに取得することはなるべく避けたい。そこでキャッシュの出番になる。

GitHub Actions ではデフォルトで何もキャッシュされないため、基本的には公式の[actions/cache](https://github.com/actions/cache)を使うことになる。
`actions/cache`はキャッシュするファイル・ディレクトリを指定し、それにキャッシュキーを紐付けるだけ、という単純なものだ。

```yml
- name: Cache Primes
  id: cache-primes
  uses: actions/cache@v2
  with:
    path: prime-numbers
    key: ${{ runner.os }}-primes
```

公式ドキュメントには Yarn を使う Node.js プロジェクトのための設定例ももちろんあり、次のように設定するよう書かれている。

https://github.com/actions/cache/blob/main/examples.md#node---yarn

```yml
- name: Get yarn cache directory path
  id: yarn-cache-dir-path
  run: echo "::set-output name=dir::$(yarn cache dir)"

- uses: actions/cache@v2
  id: yarn-cache # use this to check for `cache-hit` (`steps.yarn-cache.outputs.cache-hit != 'true'`)
  with:
    path: ${{ steps.yarn-cache-dir-path.outputs.dir }}
    key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
    restore-keys: |
      ${{ runner.os }}-yarn-
```

しかしこのサンプル、いったい何をしていて、果たしてこの書き方は最適なのだろうか？今一度 Yarn 自体から振り返って考えてみたい。

ちなみに Yarn v2 ではもっとシンプルに設定できるが、この記事では Yarn v1 だけを対象とする。

## Yarn キャッシュ

ここで保存しようとしている Yarn キャッシュとは、マシン上でグローバルに管理されるネットワークキャッシュである。`yarn add` や `yarn install`などが実行され、NPM からパッケージをダウンロードするたびにキャッシュが保存されている。同じパッケージの同じバージョンをダウンロードするときにはインターネットアクセスせずにキャッシュからインストールされる。

Yarn v1 では次のように書かれている。

> Yarn stores every package in a global cache in your user directory on the file system.

{{< embed "https://classic.yarnpkg.com/en/docs/cli/cache/" >}}

このキャッシュがマシン上のどこに実際に存在するかは環境依存となっているようだ。OS によって違うし、Yarn のバージョンによっても変わることもあるかもしれない。そのため、上記のサンプル設定ではまずコマンドを実行して現在の設定を取得することで、次のキャッシュステップで `path` に Yarn キャッシュを指定できるわけである。

```shell
$ yarn cache dir
/Users/laco/Library/Caches/Yarn/v6
```

### YARN_CACHE_FOLDER

ところで、Yarn キャッシュの保存場所は任意に変更することができる。環境ごとに差異があるというのはデフォルトの話であって、明示的に設定することは可能だ。
`yarn`コマンドの実行環境に `YARN_CACHE_FOLDER` 環境変数がある場合、その環境では Yarn キャッシュはそのディレクトリが使われることになっている。

> You can also specify the cache directory by environment variable YARN_CACHE_FOLDER:

```shell
YARN_CACHE_FOLDER=<path> yarn <command>
```

これを利用すれば、Yarn キャッシュを使う GitHub Actions はかなりシンプルに記述できるだろう。

### キャッシュの破棄

`actions/cache`のサンプルでは、キャッシュのキーが次のようになっていた。`key`が主キーとしてまず検索されるキーであり、主キーでキャッシュが見つからなかったときには`restore-keys`の条件で前方一致させて最初にヒットしたキャッシュが使われる。

```yml
key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
restore-keys: |
  ${{ runner.os }}-yarn-
```

この設定では、マシングローバルのキャッシュキーに OS とリポジトリ内の`yarn.lock`すべてのハッシュを含めているため、OS が変わるかリポジトリ内でひとつでも`yarn.lock`に変更があれば`restore-keys`へフォールバックすることになる。しかしこの設定は本当に必要だろうか？

Yarn キャッシュはそもそもマシン上でグローバル管理されているものであり、マシン上にはいくつもの Node.js プロジェクトがあるのは特別なことではない。そのうち 1 つのロックファイルが更新されたときにグローバルのキャッシュを破棄する必要はないだろう。そもそも Yarn キャッシュはネットワークキャッシュであり、インストールしたことのあるパッケージのバージョンが保管されているだけである。プロジェクトのロックファイルが更新されて新しいバージョンのパッケージを利用するときには新しいキャッシュが増えるだけだ。

つまり、`yarn.lock`のハッシュを Yarn キャッシュの主キーに含めるのはキャッシュヒット率を必要以上に下げるだけである。無限に保持し続けるとキャッシュサイズが肥大化し続けキャッシュ処理に時間がかかるおそれはあるが、主キーにハードコードされたバージョンでも書いておけば解決する話だ。

## シンプルな Yarn キャッシュ

前置きが長くなったが、私が愛用している Yarn プロジェクト用のキャッシュ設定は次のものである。`YARN_CACHE_FOLDER`環境変数をワークフローのグローバルで設定し、すべての`yarn`コマンドで自動的に利用されるようにする。キャッシュには主キーだけを与え、OS だけをキーに含める。キャッシュを破棄したくなったときには `v1`部分をインクリメントすればよい。

```yml
env:
  YARN_CACHE_FOLDER: .cache/yarn

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/cache@v2
        with:
          path: ${YARN_CACHE_FOLDER}
          key: ${{ runner.os }}-yarn-cache-v1
      - run: yarn install
```

ちなみに `yarn install` 後の `node_modules` はキャッシュしないようにしている。こちらのキャッシュは `yarn.lock` に変化があったときに破棄しなければならないが、依存パッケージのアップデートに追従するたびに破棄されるため Yarn キャッシュと比べてキャッシュヒット率が極めて低い。そのうえ `node_modules`はかなりのサイズになるためキャッシュの保存、復元の時間もそれなりに掛かる。うまく管理できれば高速化するのは間違いないが、キャッシュ事故のリスクを含めコストパフォーマンスに見合っているかを検討した上でキャッシュしたほうがいいだろう。私は基本的にキャッシュしないようにしている。
