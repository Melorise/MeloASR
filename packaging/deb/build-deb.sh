#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
version="${MELOASR_VERSION:-0.1.11}"
arch="${MELOASR_DEB_ARCH:-$(dpkg --print-architecture)}"
app_dir="${1:-${MELOASR_ELECTRON_APP_DIR:-${project_dir}/release/linux-unpacked}}"
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
    "${output_dir}/meloasr_${version}_${arch}.deb"
