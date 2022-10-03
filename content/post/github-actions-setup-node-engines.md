---
title: 'GitHub Actions: setup-nodeのNode.jsバージョンをpackage.jsonで指定する'
date: '2022-10-03T13:39:00.000Z'
updated_at: '2022-10-03T13:56:00.000Z'
tags:
  - 'GitHub Actions'
  - 'Node.js'
draft: false
source: 'https://www.notion.so/GitHub-Actions-setup-node-Node-js-package-json-1934ffc5baff4477a7661e34e8dd45f7'
---

GitHub Actions の setup-node v3.5.0 で、 `package.json` の `engines.node` フィールドがサポートされた。

[https://github.com/actions/setup-node/releases/tag/v3.5.0](https://github.com/actions/setup-node/releases/tag/v3.5.0)

{{< embed "https://github.com/actions/setup-node/pull/485" >}}

もともと setup-node には `node-version-file` というパラメータが存在する。ワークフローの YAML ファイルの中で直接 Node.js バージョンを書くのではなく、別のファイルから読み込むことができる。

[setup\-node/advanced\-usage\.md at main · actions/setup\-node](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md#node-version-file)

> The `node-version-file` input accepts a path to a file containing the version of Node.js to be used by a project, for example `.nvmrc`, `.node-version`, `.tool-versions`, or `package.json`. If both the `node-version` and the `node-version-file` inputs are provided then the `node-version` input is used. See [supported version syntax](https://github.com/actions/setup-node#supported-version-syntax).

v3.5.0 ではここに新たに `package.json` が追加され、 `engines.node` プロパティを参照できるようになった。

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-node@v3
    with:
      node-version-file: 'package.json'
      cache: yarn
```

いままでサポートされていた Node.js バージョン管理ツール用の設定ファイルと違い、 `package.json` の `engines` は npm や yarn などパッケージマネージャがもれなくサポートしているため、開発ツールを厳密に標準化していないチームでも共通のバージョン制約を適用しやすいはずだ。（npm の場合は `engine-strict=true` 設定が必要ではあるが）
