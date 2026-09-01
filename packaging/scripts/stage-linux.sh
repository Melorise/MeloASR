#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
app_dir="${1:-${TAMA_ASR_ELECTRON_APP_DIR:-${project_dir}/release/linux-unpacked}}"
stage_dir="${2:-${project_dir}/packaging/out/root}"
addon_build_dir="${TAMA_ASR_ADDON_BUILD_DIR:-${project_dir}/packaging/out/fcitx5-build}"

if [[ "${app_dir}" != /* ]]; then
    app_dir="${project_dir}/${app_dir}"
fi

if [[ ! -d "${app_dir}" ]]; then
    echo "缺少 Electron 解包目录：${app_dir}" >&2
    echo "请先运行项目提供的 Linux directory 构建脚本。" >&2
    exit 1
fi

if [[ ! -x "${app_dir}/tama-asr" ]]; then
    echo "Electron 解包目录中没有可执行文件 tama-asr：${app_dir}" >&2
    exit 1
fi

install -d \
    "${stage_dir}/opt/tama-asr" \
    "${stage_dir}/usr/bin" \
    "${stage_dir}/usr/share/applications" \
    "${stage_dir}/usr/share/pixmaps" \
    "${stage_dir}/usr/share/metainfo" \
    "${stage_dir}/etc/xdg/autostart"

cp -a "${app_dir}/." "${stage_dir}/opt/tama-asr/"
install -Dm755 "${project_dir}/packaging/assets/tama-asr-wrapper" \
    "${stage_dir}/usr/bin/tama-asr"
install -Dm644 "${project_dir}/packaging/assets/tama-asr.desktop" \
    "${stage_dir}/usr/share/applications/tama-asr.desktop"
install -Dm644 "${project_dir}/packaging/assets/tama-asr-autostart.desktop" \
    "${stage_dir}/etc/xdg/autostart/tama-asr.desktop"
install -Dm644 "${project_dir}/packaging/assets/tama-asr.metainfo.xml" \
    "${stage_dir}/usr/share/metainfo/tama-asr.metainfo.xml"
install -Dm644 "${project_dir}/src/assets/logo.png" \
    "${stage_dir}/usr/share/pixmaps/tama-asr.png"

cmake -S "${project_dir}/linux/fcitx5" -B "${addon_build_dir}" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr
cmake --build "${addon_build_dir}" --parallel
DESTDIR="${stage_dir}" cmake --install "${addon_build_dir}"

echo "已生成安装根目录：${stage_dir}"
