#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
build_dir="${project_dir}/build"

cmake -S "${project_dir}" -B "${build_dir}" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="${HOME}/.local" \
  -DCMAKE_INSTALL_LIBDIR=lib \
  -DCMAKE_INSTALL_DATADIR=share
cmake --build "${build_dir}" --parallel
cmake --install "${build_dir}"

# 0.1.0 之前的原型使用 voiceinput 名称；升级时移除，避免两个常驻模块同时监听快捷键。
rm -f -- \
  "${HOME}/.local/lib/fcitx5/libvoiceinput.so" \
  "${HOME}/.local/share/fcitx5/addon/voiceinput.conf"

echo "已安装 MeloASR Fcitx5 插件，请重启 Fcitx5。"
