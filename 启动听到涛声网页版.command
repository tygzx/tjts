#!/bin/bash
folder="$(cd "$(dirname "$0")" && pwd -P)" || exit 1
/bin/bash "$folder/umi-reader/scripts/start-web.sh" "$@"
result=$?
if [ "$result" -ne 0 ]; then
  printf '\n启动未完成，请查看上方提示。按回车关闭。\n'
  read -r _
fi
exit "$result"
