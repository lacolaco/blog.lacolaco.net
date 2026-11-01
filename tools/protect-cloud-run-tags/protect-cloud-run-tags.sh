#!/bin/bash
# PreToolUse hook for Bash
# `gcloud run services update-traffic --set-tags` は指定しなかったタグをすべて外す。
# web には開いている PR のプレビュー用のタグが多数あるため、実行の前に止める。
# 付け外しは --update-tags / --remove-tags で行う。
#
# 終了コードは protect-notion-content.sh と同じく明示する。jq が無い、入力が壊れているなど
# フック側の異常は許可 (exit 0) する。

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$command" ]; then
  exit 0
fi

# 行継続 (\ + 改行) は空白にし、残った改行はコマンドの区切りとして扱う。
# どちらも、語が複数行に分かれていても検出できるよう、1行にしてから照合する
command=${command//\\$'\n'/ }
case "$command" in
  *$'\n'*) multi=1 ;;
  *) multi=0 ;;
esac
command=$(printf '%s' "$command" | tr '\n' ' ')

# git commit や echo の引用符の中は文章であり実行されないので、中身を取り除いて誤検出を避ける。
# 引用符の中が実行されうる形 (bash -c "..."、フラグ自体の引用など) を見逃さないよう、
# 単純なコマンド1つ (連結や置換なし) で、先頭が文章を扱うコマンドのときだけ取り除く
if [ "$multi" = 0 ] && echo "$command" | grep -Eq '^[[:space:]]*(git[[:space:]]+(commit|tag|notes)|echo|printf)([[:space:]]|$)' &&
  ! echo "$command" | grep -Eq '[;&|`]|\$\('; then
  command=$(printf '%s' "$command" | sed -E "s/\"[^\"]*\"/\"\"/g; s/'[^']*'/''/g")
fi

# --update-tags などを誤検出しないよう、オプション名の前後の区切り (引用符を含む) まで見る
if echo "$command" | grep -Eq 'gcloud.*run[[:space:]]+services[[:space:]]+update-traffic' &&
  echo "$command" | grep -Eq '(^|[[:space:]"'"'"'])--set-tags([=[:space:]"'"'"']|$)'; then
  cat <<'EOF2' >&2
Blocked: `gcloud run services update-traffic --set-tags` removes every tag not listed in the command.
Open PR preview URLs depend on those tags, so use one of these instead:
  - --update-tags=TAG=REVISION  (add or move only the given tags)
  - --remove-tags=TAG           (remove only the given tags)
EOF2
  exit 2
fi

exit 0
