# Arch Linux 构建

远程 Release 会附带当前版本的 `PKGBUILD`。下载后直接运行：

```bash
curl --fail --location --remote-name \
  https://github.com/Melorise/MeloASR/releases/download/v0.1.17/PKGBUILD
makepkg --syncdeps --cleanbuild
```

`PKGBUILD` 会根据 `pkgver` 直接下载 GitHub Release 标签对应的源码归档，无需手动下载、重命名或放置源码包。源码地址固定为 `https://github.com/Melorise/MeloASR/archive/refs/tags/v${pkgver}.tar.gz`，因此同一份 `PKGBUILD` 可以重复构建该版本。
