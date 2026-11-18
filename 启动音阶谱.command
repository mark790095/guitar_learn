#!/bin/bash
# 双击启动：本地起一个静态服务并打开浏览器，关掉终端窗口即停止
cd "$(dirname "$0")" || exit 1

PORT=8771
while lsof -i ":$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

python3 -m http.server "$PORT" >/tmp/scale-tab-server.log 2>&1 &
SERVER_PID=$!

sleep 1
open "http://localhost:$PORT/"

echo ""
echo "  音阶六线谱生成器已启动： http://localhost:$PORT/"
echo "  关闭这个终端窗口即停止服务。"
echo ""

wait $SERVER_PID
