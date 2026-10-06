#!/usr/bin/env bash
# 本机无 root、系统缺少 chromium 运行库；arm64 依赖已下载解压到家目录，
# 通过 LD_LIBRARY_PATH 提供给 Playwright 的 Chromium。
EXTRA_LIB="/tmp/debs/extract/usr/lib/aarch64-linux-gnu:/tmp/debs/extract/lib/aarch64-linux-gnu"
if [ -d /tmp/debs/extract/usr/lib/aarch64-linux-gnu ]; then
  export LD_LIBRARY_PATH="${EXTRA_LIB}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi
exec "$@"
