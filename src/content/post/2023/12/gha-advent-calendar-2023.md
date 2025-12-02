---
title: 'GitHub ActionsのJob Outputsでハマった話'
slug: 'gha-advent-calendar-2023'
icon: ''
created_time: '2023-12-20T15:00:00.000Z'
last_edited_time: '2023-12-30T09:58:00.000Z'
tags:
  - 'GitHub Actions'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/GitHub-Actions-Job-Outputs-b28b8ef4ebdb495fa2b51c0e89c9cded'
features:
  katex: false
  mermaid: false
  tweet: false
---

この記事は [GitHub Actions Advent Calendar](https://qiita.com/advent-calendar/2023/github-actions) 21日目の記事です。昨日は@eno49conanさんの [GitHub Actions、キャッシュで時間短縮(とLambda更新で少し苦労)した話](https://qiita.com/eno49conan/items/508bae516fa2ed089db9) でした。

https://qiita.com/advent-calendar/2023/github-actions

アドベントカレンダーなので、小粒のちょっとした話を書きます。先日GitHub Actionsの**Job Outputs** 機能のめちゃくちゃ初歩的な仕様を勘違いしてしばらくハマってしまったので、備忘録も兼ねてその話を。

## Job Outputs

Job Outputsは、先行するジョブから出力された値を、後続のジョブで利用するための機能です。

> You can use `jobs.<job_id>.outputs` to create a map of outputs for a job. Job outputs are available to all downstream jobs that depend on this job. For more information on defining job dependencies, see `jobs.<job_id>.needs`.

https://docs.github.com/en/actions/using-jobs/defining-outputs-for-jobs

出力は各ステップに紐づき、同一ジョブ内では `steps.<step_id>.outputs` でアクセスできますが、異なるジョブから参照するには一旦ジョブの出力としてマッピングしなおす必要があります。

```yaml
# 公式ドキュメントより
jobs:
  job1:
    runs-on: ubuntu-latest
    # Map a step output to a job output
    outputs:
      output1: ${{ steps.step1.outputs.test }}
      output2: ${{ steps.step2.outputs.test }}
    steps:
      - id: step1
        run: echo "test=hello" >> "$GITHUB_OUTPUT"
      - id: step2
        run: echo "test=world" >> "$GITHUB_OUTPUT"
  job2:
    runs-on: ubuntu-latest
    needs: job1
    steps:
      - env:
          OUTPUT1: ${{needs.job1.outputs.output1}}
          OUTPUT2: ${{needs.job1.outputs.output2}}
        run: echo "$OUTPUT1 $OUTPUT2"
```

## 出力は常に文字列エンコードされる

ドキュメントを読めばそこかしこに書いてあるのですが、僕はこの仕様を完全に見落としていて時間を無駄にしました。ステップやジョブの出力は、常にUnicode文字列にエンコードされます。文字列以外のオブジェクトが出力された場合は、JSON文字列に変換されます。

これが何を意味するかというと、 `false` が出力されると `"false"` になるということです。もう察しがついたかもしれませんが、真偽値を出力していると思ったまま後続のジョブの `if` 条件でその値を参照してしまい、 `"true"` でも `"false"` でも常に `if` は真だと評価してしまう、というのをやらかしました。

```yaml
# こんなイメージ
jobs:
  check:
    runs-on: ubuntu-latest
    outputs:
      release_ready: ${{ steps.release_check.outputs.ready }}
    steps:
      - id: release_check
        uses: ... # 内部で ready=true|false を出力する
  release:
    runs-on: ubuntu-latest
    needs: 
      - check
    if: ${{ needs.check.outputs.release_ready }} # 常に真になる
    steps:
      - ...
```

これに気づくのが遅れた理由はいくつかあり、ひとつはその出力をしている部分のコードを読むと `@actions/core` のJavaScript APIで、 `setOutput()` 関数を呼び出しており、そこだけ見たら出力は間違いなくブール値であったためです。しかし、これは `@actions/core` APIへの理解が不足しており、ソースコードのJSDocまで読んでいれば第2引数がJSONエンコードされることは明記してありました。

[https://github.com/actions/toolkit/tree/main/packages/core#inputsoutputs](https://github.com/actions/toolkit/tree/main/packages/core#inputsoutputs)

[https://github.com/actions/toolkit/blob/main/packages/core/src/core.ts#L185-L200](https://github.com/actions/toolkit/blob/main/packages/core/src/core.ts#L185-L200)

```typescript
/**
 * Sets the value of an output.
 *
 * @param     name     name of the output to set
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setOutput(name: string, value: any): void {
```

ふたつめの理由は、上述の例でいうところの `release_ready` が本当に `false` になっているのかを確かめるためにログを入れての調査は早くに始めていたのですが、 `echo ${{steps.release_check.outputs.ready}}`  では `false` と `"false"` の区別がつかないことに気づくのが遅かったためです。ログには `false` と出力されるのに `if` 条件が真になってしまうのが謎でかなり悩みました。

## 文字列以外の出力には `fromJSON()` を

そういうわけでハマった問題の原因は暗黙的に文字列に変換されたことに気づいていなかったというしょーもないものでした。こういうしょーもないものほど盲点で、気づくのに時間がかかるのはあるあるですね。

今回の場合は `if` 条件で参照するときに `fromJSON()` 関数で文字列からデコードするのが適切な記述でした。あるいは、文字列として `"true"` との一致をチェックすることもできますね。

[https://docs.github.com/en/actions/learn-github-actions/expressions#fromjson](https://docs.github.com/en/actions/learn-github-actions/expressions#fromjson)

```yaml
# こんなイメージ
jobs:
  check:
    runs-on: ubuntu-latest
    outputs:
      release_ready: ${{ steps.release_check.outputs.ready }}
    steps:
      - id: release_check
        uses: ... # 内部で ready=true|false を出力する
  release:
    runs-on: ubuntu-latest
    needs: 
      - check
    if: fromJSON(needs.check.outputs.release_ready)
    steps:
      - ...
```

これにて一件落着、めでたしめでたしということで、今年もたくさんGitHub Actionsのお世話になりました。来年もたくさんお世話になると思います。みなさんも楽しいGitHub Actionsライフを！

