---
title: 'Claude CodeのメッセージをAivisSpeechで読み上げる'
slug: 'claude-code-tts'
icon: ''
created_time: '2026-05-10T01:53:00.000Z'
last_edited_time: '2026-05-10T01:53:00.000Z'
tags:
  - 'Claude Code'
  - 'AI'
  - 'TTS'
published: true
locale: 'ja'
channels:
  - 'Code'
notion_url: 'https://www.notion.so/Claude-Code-AivisSpeech-35b3521b014a813db183f62f35e4eb20'
features:
  katex: false
  mermaid: false
  tweet: false
---

Claude Codeを自動モードで走らせてその間に別の作業をしているとき、PCの前を離れていても終わったらイヤホンで状況を知りたいので、そういうプラグインを作った。自分用だが、公開プラグインにしているので使いたい人がいたら使ってもらってもかまわない。

```bash
/plugin marketplace add lacolaco/claude-plugins
/plugin install session-tts@lacolaco-plugins
```

[https://github.com/lacolaco/claude-plugins](https://github.com/lacolaco/claude-plugins)

<video src="/videos/claude-code-tts/CleanShot_2026-05-09_at_17.26.57-converted.83dc7da309040f99.mp4" controls playsinline preload="metadata"></video>

`Stop`、`StopFailure`、`Notification`の各hookに乗せて、Claudeの応答を日本語の音声で読み上げる。並列セッションをある程度耳で識別できるように、セッションごとに違う声を割り当てている。

TTSのエンジンには[**AivisSpeech**](https://aivis-project.com/)を使っている。ここに至るまでにいくつか他のTTSを試したので、選定の経緯と実装の要点を書いておく。

## TTSの選定基準

今回のツール選定での必須要件はMacでローカル動作することと、日本語の読み上げが流暢であること。そのうえでレイテンシや安定性、ライセンスなどを評価したいと思っていくつか試してみた。

## 試したもの

最初は**Kokoro TTS** から始めた。先行事例がいくつか見つかるので、いったんそれを真似してみることにした。

https://dev.classmethod.jp/articles/claude-code-kokoro-tts-local-voice-response/

Apple Silicon上で軽快に動くし、ライセンスを気にせず使える。最初の実装はこれで作ったが、日本語の発話品質が物足りなかった。棒読みっぽい抑揚の弱さと、日本語文中の英単語の発音がひどい。”plugin” レベルですらデフォルトでは読めていなかった。

というわけで別のTTSを求めていくつか比較してみた。**Style-Bert-VITS2** はローカルで動かして声質を確認したが、好みではなかった。

## AivisSpeechに乗り換え

AivisSpeechはStyle-Bert-VITS2の技術をベースにしているらしい。

https://aivis-project.com/

さっと公式のボイスで試したところ、声質と抑揚が明らかに自然だった。日本語特化で、固有名詞も辞書なしでだいたい読める。Kokoroと聴き比べて即決した。

また、Claude CodeのHookに組み込む上で、ありがたい点もいくつかあった。

- HTTP APIサーバーとして動くので、Python側はhttpxで`/audio_query`と`/synthesis`を順に叩くだけになる
- macOS arm64向けのバイナリが配布されている
- 音声モデルは`/aivm_models/install`エンドポイントで動的に取れる

`SessionStart` hookで、エンジンバイナリの存在チェック→起動チェック→必要モデルのインストールを冪等にやる。再起動時には`/version`への確認リクエストしか走らない。インターネットアクセスも初回のモデルDL時しか必要ない。

## セッションごとに話者を変える

並列セッションを耳で識別できるかもと思い、セッションごとに違う話者を割り当てることにしてみた。今は3人を順繰りにローテーションしている。

```bash
prev=$(cat "$index_file" 2>/dev/null || echo -1)
next=$(( (prev + 1) % 3 ))
case "$next" in
  0) speaker_id=888753760  ;;  # まお
  1) speaker_id=1431611904 ;;  # まい
  2) speaker_id=345585728  ;;  # るな
esac
echo "$next" > "$index_file"
echo "$speaker_id" > "$session_file"
```

https://hub.aivis-project.com/aivm-models/a59cb814-0083-4369-8542-f51a29e72af7

https://hub.aivis-project.com/aivm-models/e9339137-2ae3-4d41-9394-fb757a7e61e6

https://hub.aivis-project.com/aivm-models/4f281e78-eba6-495a-8e50-5c322d02b5b1

ローテーションのインデックスは`~/.claude/session-tts/index`にカウンタとして残し、セッションごとの割り当ては`~/.claude/session-tts/sessions/$session_id`にspeaker_idで保存する。一度割り当てたら同じセッションIDの間は固定で、`/clear`や`/compact`でSessionStartが再開しても変わらない。

ミュートと話者割り当ては別ファイルにしてある。`/session-tts:tts off`で消音した後に`on`で戻しても、同じ声で復帰する。

## チャンク化と並列再生

応答音声は1リクエストで合成しないようにしている。これはAivisSpeechのドキュメントでは「1回の`/synthesis`は500文字以内、意味の切れ目で分割」を推奨しているため。

[https://github.com/Aivis-Project/AivisSpeech-Engine#q-長い文章を一度に音声合成-api-に送ると音声が不自然になったりメモリリークが発生します](https://github.com/Aivis-Project/AivisSpeech-Engine#q-%E9%95%B7%E3%81%84%E6%96%87%E7%AB%A0%E3%82%92%E4%B8%80%E5%BA%A6%E3%81%AB%E9%9F%B3%E5%A3%B0%E5%90%88%E6%88%90-api-%E3%81%AB%E9%80%81%E3%82%8B%E3%81%A8%E9%9F%B3%E5%A3%B0%E3%81%8C%E4%B8%8D%E8%87%AA%E7%84%B6%E3%81%AB%E3%81%AA%E3%81%A3%E3%81%9F%E3%82%8A%E3%83%A1%E3%83%A2%E3%83%AA%E3%83%AA%E3%83%BC%E3%82%AF%E3%81%8C%E7%99%BA%E7%94%9F%E3%81%97%E3%81%BE%E3%81%99)

また、長い応答を全部合成し終わるまで待たされるのは体験が悪い。最初の音が早く出るほうがいいため、チャンク分割と並列化をしている。

まずテキストを段落→文・節境界の順に分割し、最初のチャンクだけ60文字以内に絞り、残りは250文字以内にする。最初のチャンクが短ければそのぶん最初の音が早く出る。

合成と再生はスレッドを分けて並列に走らせる。合成スレッドが`/audio_query`→`/synthesis`を順に叩いてWAVをキューに積み、再生スレッドが`afplay`で順番に再生する。最初のチャンクが合成された時点で再生が始まり、その間に2番目以降が裏で合成されていく。

```python
synth_thread = threading.Thread(target=synth_worker,
    args=(client, SPEAKER_ID, chunks, play_queue))
player_thread = threading.Thread(target=player_worker,
    args=(play_queue,))
synth_thread.start()
player_thread.start()
```

## その他の調整

- **先頭無音時間の延長**: Bluetoothヘッドホンかつマルチポイント接続とか使ってると、再生直後が途切れることが多い。`/audio_query`のレスポンスに`prePhonemeLength`を0.5秒ぶん足してから`/synthesis`に投げ直すと先頭の無音区間を伸ばせるので、それでなんとなく調整している。
- **チャンク数による速度スケール**: チャンク数が4以上のときは`speedScale`を1.2にして短くなるようにしている。1.4とかも試したが早口過ぎてうるさかった。
- **8チャンクで打ち切り**: それでも長すぎる応答は8チャンクで切って「以下、省略します。」を末尾に足している。

## まとめ

最終的に出来上がったプラグインを自分で使いはじめたが、まあまあいい感じ。本当はStopだけじゃなくて自動モード中の途中のナレーションも読ませたいのだが、専用のHookがなくて保留中。やろうと思ったらPreToolUseとかに引っ掛けてセッションのログファイルを読みに行くとかをしないといけなさそう。

