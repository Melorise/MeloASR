# Arch Linux 构建

发布时把项目源码归档为 `meloasr-0.1.9.tar.gz`，与 `PKGBUILD` 放在同一目录，随后运行：

```bash
makepkg --syncdeps --cleanbuild
```

正式发布必须把 `source` 改为仓库的不可变 release URL，并以 `updpkgsums` 写入真实 SHA-256；当前源码包仍保留 `SKIP`，不能直接作为正式 Arch 发布源。
