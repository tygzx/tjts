#!/bin/bash
# Compatible with the Bash 3.2 shipped with macOS; no npm install is required.
set -eu
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
project_dir="$(cd "$script_dir/.." && pwd -P)"
port="${UMI_PORT:-4173}"
open_browser=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-browser|-NoBrowser) open_browser=0; shift ;;
    --port|-Port) [ "$#" -ge 2 ] || { echo 'Missing port.'; exit 1; }; port="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done
case "$port" in ''|*[!0-9]*) echo 'Port must be a number from 1 to 65535.'; exit 1 ;; esac
[ "$port" -ge 1 ] && [ "$port" -le 65535 ] || { echo 'Port must be from 1 to 65535.'; exit 1; }
node_path="$(command -v node || true)"
if [ -z "$node_path" ]; then
  echo '请先从 https://nodejs.org/ 安装 macOS 版 Node.js 20 或更高版本，再重新启动。'
  exit 1
fi
major="$("$node_path" -p "process.versions.node.split('.')[0]")"
[ "$major" -ge 20 ] || { echo '需要 Node.js 20 或更高版本，请先更新 Node.js。'; exit 1; }
url="http://127.0.0.1:$port/"
ready() {
  response="$(curl --noproxy '*' --connect-timeout 1 --max-time 2 -fsS "${url}api/connection" 2>/dev/null || true)"
  case "$response" in *'"app":"umi-reader"'*) return 0 ;; *) return 1 ;; esac
}
if ! ready; then
  log_dir="$project_dir/.build-cache/web-server"
  mkdir -p "$log_dir"
  server_script="$script_dir/serve.mjs"
  UMI_PORT="$port" nohup "$node_path" "$server_script" >"$log_dir/server-$port.log" 2>&1 </dev/null &
  server_pid=$!
  attempt=0
  while [ "$attempt" -lt 30 ]; do
    kill -0 "$server_pid" 2>/dev/null || break
    if ready; then break; fi
    attempt=$((attempt + 1))
    sleep 0.25
  done
  if ! kill -0 "$server_pid" 2>/dev/null || ! ready; then
    kill "$server_pid" 2>/dev/null || true
    echo "启动失败，请查看：$log_dir/server-$port.log"
    echo '如果端口已被占用，可以加 --port 4175 启动。'
    exit 1
  fi
  printf '%s\n' "$server_pid" >"$log_dir/server-$port.pid"
fi
printf '网页版已启动：%s\n' "$url"
if [ "$open_browser" -eq 1 ] && [ "$(uname -s)" = 'Darwin' ]; then
  open "$url" || echo "请在浏览器中手动打开 $url"
fi
echo '服务在后台运行，可以关闭此终端窗口；用“停止听到涛声网页版.command”结束服务。'
