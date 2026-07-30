#!/bin/bash
# content-review が NG のときに PR へ投稿するコメント本文を stdout に出す。
#
# 入力 (env):
#   REVIEW_RESULT  claude-code-action の structured_output (JSON)
#   OWNER          メンション先の GitHub ユーザー名
# cwd はリポジトリルート (manifest.json と指摘ファイルを読む)
set -euo pipefail

summary=$(jq -r '.summary' <<<"$REVIEW_RESULT")
issues=$(jq -r '.issues[] | "- **\(.file)**: \(.description)"' <<<"$REVIEW_RESULT")

notion_paths=$(jq -r '.[].filePath // empty' manifest.json 2>/dev/null || true)

notion=''
translated=''
direct=''
while read -r f; do
  [[ -n "$f" && "$f" == *.md && -f "$f" ]] || continue
  if grep -q '^auto_translated_from:' "$f"; then
    ja="${f%.en.md}.md"
    if [[ -f "$ja" ]]; then
      translated+="- \`${f}\` (翻訳元: \`${ja}\`)"$'\n'
    else
      translated+="- \`${f}\`"$'\n'
    fi
  elif grep -qxF -- "$f" <<<"$notion_paths"; then
    url=$(grep -m1 '^notion_url:' "$f" | cut -d' ' -f2- | tr -d "\"'" || true)
    notion+="- \`${f}\`: ${url:-(notion_url なし)}"$'\n'
  else
    direct+="- \`${f}\`"$'\n'
  fi
done < <(jq -r '.issues[].file' <<<"$REVIEW_RESULT" | sort -u)

cat <<EOF
## コンテンツレビュー NG

@${OWNER} 修正が必要です。

${summary}

${issues}
EOF

if [[ -n "$notion" ]]; then
  cat <<EOF

### Notion 原稿を修正

${notion}
原稿を修正すると sync でこの PR が更新されます。
EOF
fi

if [[ -n "$translated" ]]; then
  cat <<EOF

### auto-translate 生成物

${translated}
翻訳文の誤りは tools/auto-translate/ のパイプライン側、ja 原稿由来の誤りは翻訳元の Notion 原稿を修正してください。
EOF
fi

if [[ -n "$direct" ]]; then
  cat <<EOF

### 直接管理されているファイル

${direct}
生成物ではないため、このファイルを直接修正してください。
EOF
fi

if [[ -n "$notion" || -n "$translated" ]]; then
  if [[ -n "$notion" && -n "$translated" ]]; then
    regen='sync / auto-translate'
  elif [[ -n "$notion" ]]; then
    regen='sync'
  else
    regen='auto-translate'
  fi
  printf '\n生成物を PR 内で直接編集しても、次の %s で上書きされます。\n' "$regen"
fi
