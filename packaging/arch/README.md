# Arch Linux 打包

## 默认：从官方 deb 重打包

远程 Release 附带的 `PKGBUILD` 是 bin 版。它根据当前 Arch 架构下载同一 Release 中的 `amd64.deb` 或 `arm64.deb`，解出已经构建好的 Electron 应用、桌面文件和 Fcitx5 addon，再交给 `makepkg` 生成 pacman 包，不会在本地重复编译源码。

下载后直接运行：

```bash
curl --fail --location --remote-name \
  https://github.com/Melorise/TamaASR/releases/download/v1.0.1/PKGBUILD
makepkg --syncdeps --cleanbuild
```

`x86_64` 使用 `tama-asr_<version>_amd64.deb`，`aarch64` 使用 `tama-asr_<version>_arm64.deb`。这两个 deb 与 Arch 包来自同一版本的官方 Release。

## 可选：从源码构建

需要完整源码构建时，使用 Release 同时附带的 `PKGBUILD-from-source`：

```bash
curl --fail --location --remote-name \
  https://github.com/Melorise/TamaASR/releases/download/v1.0.1/PKGBUILD-from-source
makepkg --syncdeps --cleanbuild -p PKGBUILD-from-source
```

源码版保留原有流程：下载对应 Git 标签的源码归档，安装锁文件依赖，构建 Electron 应用和 Fcitx5 addon，运行测试后再生成 pacman 包。
