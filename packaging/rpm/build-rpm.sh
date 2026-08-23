#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
version="${MELOASR_VERSION:-0.1.8}"
app_dir="${1:-${project_dir}/release/linux-unpacked}"
stage_dir="${project_dir}/packaging/out/rpm-root"
top_dir="${project_dir}/packaging/out/rpmbuild"

command -v rpmbuild >/dev/null || {
    echo "未找到 rpmbuild，请先安装 RPM 构建工具。" >&2
    exit 1
}

rm -rf -- "${stage_dir}" "${top_dir}"
"${project_dir}/packaging/scripts/stage-linux.sh" "${app_dir}" "${stage_dir}"
mkdir -p "${top_dir}"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
tar -C "${stage_dir}" -czf "${top_dir}/SOURCES/meloasr-root.tar.gz" .

rpmbuild -bb \
    --define "_topdir ${top_dir}" \
    --define "meloasr_version ${version}" \
    "${project_dir}/packaging/rpm/meloasr-binary.spec"

find "${top_dir}/RPMS" -type f -name '*.rpm' -exec cp -f {} "${project_dir}/packaging/out/" \;
