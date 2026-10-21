#!/bin/bash
set -eu
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
project_dir="$(cd "$script_dir/.." && pwd -P)"
server_script="$script_dir/serve.mjs"
count=0
for pid_file in "$project_dir"/.build-cache/web-server/server-*.pid; do
  [ -f "$pid_file" ] || continue
  pid="$(cat "$pid_file")"
  case "$pid" in ''|*[!0-9]*) continue ;; esac
  [ "$pid" -gt 1 ] || continue
  command_line="$(ps -ww -p "$pid" -o command= 2>/dev/null || true)"
  # A stale PID must never stop another app, another checkout or another Node job.
  case "$command_line" in
    *"$server_script"*)
      if kill "$pid" 2>/dev/null; then count=$((count + 1)); fi
      ;;
    '') ;;
    *) echo '忽略已由其他程序使用的进程编号。'; continue ;;
  esac
  rm -f "$pid_file"
done
printf '已停止本文件夹启动的服务：%s 个。\n' "$count"
echo '如果是在终端运行 npm start 启动的，请到那个终端按 Control+C 停止。'
