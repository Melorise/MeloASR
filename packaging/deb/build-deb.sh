#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
version="${TAMA_ASR_VERSION:-1.0.0}"
arch="${TAMA_ASR_DEB_ARCH:-$(dpkg --print-architecture)}"
app_dir="${1:-${TAMA_ASR_ELECTRON_APP_DIR:-${project_dir}/release/linux-unpacked}}"
work_dir="${project_dir}/packaging/out/deb-root"
output_dir="${project_dir}/packaging/out"

rm -rf -- "${work_dir}"
"${project_dir}/packaging/scripts/stage-linux.sh" "${app_dir}" "${work_dir}"

install -d "${work_dir}/DEBIAN"
installed_size="$(du -sk "${work_dir}" | cut -f1)"
sed \
    -e "s/@VERSION@/${version}/g" \
    -e "s/@ARCH@/${arch}/g" \
    -e "s/@INSTALLED_SIZE@/${installed_size}/g" \
    "${project_dir}/packaging/deb/control.in" > "${work_dir}/DEBIAN/control"

mkdir -p "${output_dir}"
dpkg-deb --root-owner-group --build "${work_dir}" \
    "${output_dir}/tama-asr_${version}_${arch}.deb"
