# Arch Linux 构建

发布时把项目源码归档为 `meloasr-0.1.0.tar.gz`，与 `PKGBUILD` 放在同一目录，随后运行：

```bash
makepkg --syncdeps --cleanbuild
```

正式发布必须把 `source` 改为仓库的不可变 release URL，并以 `updpkgsums` 写入真实 SHA-256；仓库地址确定前保留的 `example.invalid` 和 `SKIP` 不能用于发布。

