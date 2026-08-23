# Linux 分发打包

MeloASR 0.1.8 的系统包由两部分组成：

- Electron 应用安装到 `/opt/meloasr`，命令入口为 `/usr/bin/meloasr`；
- Fcitx5 常驻 addon 由目标发行版中的 CMake/Fcitx5 开发包编译，并安装到该环境报告的 addon 目录。

安装包同时提供桌面入口、项目图标和 `/etc/xdg/autostart/meloasr.desktop`，因此安装后的默认行为是随桌面会话启动。设置页关闭自启动时，应用需要在用户级 autostart 目录写入覆盖项，不能删除系统包所属文件。

## 统一构建契约

deb、rpm 和 Arch 配置期望项目提供：

```bash
npm run build:linux:dir
```

该命令应在 `release/linux-unpacked/` 生成可直接运行的 Electron 目录，并且主程序名必须是 `meloasr`。仓库提供的 `electron-builder.yml` 只生成这一中间目录；deb/rpm/Arch 的系统文件仍由各自脚本管理，避免用安装钩子复制未被包管理器追踪的 Fcitx5 文件。

主项目可将脚本定义为：

```json
{
  "build:linux:dir": "npm run build && electron-builder --config packaging/electron-builder.yml --linux dir"
}
```

手工检查安装树：

```bash
packaging/scripts/stage-linux.sh release/linux-unpacked packaging/out/root
```

## deb

在 Debian/Ubuntu 对应目标环境中安装 Node.js 构建依赖、CMake、C++ 编译器、Fcitx5 开发包与 nlohmann-json 开发包，然后执行：

```bash
npm run build:linux:dir
packaging/deb/build-deb.sh
```

产物位于 `packaging/out/meloasr_0.1.8_<arch>.deb`。依赖名称按 Debian/Ubuntu 系列填写，但尚未在各发行版完成安装验证。

## rpm

在目标 RPM 发行版中准备相同的编译依赖和 `rpmbuild`，然后执行：

```bash
npm run build:linux:dir
packaging/rpm/build-rpm.sh
```

产物复制到 `packaging/out/`。RPM 发行版之间的 Fcitx5 开发包和运行库名称可能不同，正式发布前需要分别在 Fedora/openSUSE 等目标环境验证并维护发行版 spec。

## Arch/pacman

参见 [`arch/README.md`](arch/README.md)。PKGBUILD 在干净 chroot 中从源码构建 Electron 应用和 Fcitx5 addon。

## Nix flake

```bash
nix build
nix run
```

flake 使用 nixpkgs 的 Electron，Node 依赖由 `package-lock.json` 的 integrity 数据导入，不需要手写固定输出 hash。仓库首次确定发布地址后，需要锁定并提交 `flake.lock`。当前环境没有 Nix，尚未实际执行上述命令。

## 发布前必须完成

- 发布前确认仓库地址和许可证元数据；
- 明确项目许可证，并替换临时的 `LicenseRef-Proprietary`/Nix license；
- 生成 Arch 源码归档真实 SHA-256；
- 在干净的 Debian、RPM、Arch 和 Nix 构建环境逐一构建、安装、卸载；
- 验证 Fcitx5 能发现 addon，桌面菜单/托盘图标、自启动开关和包升级均正常。
