# MeloASR

MeloASR 是面向 Linux/Fcitx5 的桌面语音输入工具。应用使用受支持网页平台自身的录音、流式识别、纠错、断句和标点能力，并把网页编辑器中的当前完整文本实时同步到活动的 Fcitx5 InputContext。

当前后端：

- 千问
- 元宝

## 架构

```text
网页后端适配器
  → Electron 后端窗口与登录会话
  → 会话状态机
  → $XDG_RUNTIME_DIR/meloasr/fcitx5.sock
  → Fcitx5 常驻 addon
  → 当前应用的 preedit / commit
```

`src/main/index.ts` 只负责应用启动与依赖组合。主要模块位于：

- `src/backends/`：后端定义、DOM 适配器和注册表；
- `src/main/backend-manager.ts`：后端窗口、登录状态和就绪状态；
- `src/main/session-controller.ts`：语音会话状态机；
- `src/main/fcitx-bridge.ts`：本地 JSONL 协议；
- `src/main/settings-store.ts`：设置持久化；
- `src/main/tray-controller.ts`：托盘生命周期和就绪颜色；
- `src/main/overlay-controller.ts`：悬浮球显示与位置；
- `src/renderer/`、`src/preload/`：设置页、悬浮球和安全 IPC。

## 本地开发

依赖：Node.js 22+、CMake 3.16+、支持 C++20 的编译器、Fcitx5 Core/Utils 开发包、nlohmann-json。

```bash
npm install
npm test
npm run build:fcitx5
./linux/fcitx5/install-user.sh
fcitx5 -r
npm start
```

应用默认由托盘常驻，设置页与后端调试窗口默认隐藏。首次打开某个后端的调试窗口时，应用会提示登录；登录状态保存在该后端自己的 persistent partition 中。

默认按住 `Ctrl+Shift+Space` 开始录音，松开后停止。快捷键可在设置页修改，并通过本地协议同步给 Fcitx5 addon。悬浮球常驻时，点击可开始或停止录音。

## 后端扩展

新增后端时需要：

1. 添加 `BackendDefinition`；
2. 实现 `BackendWebAdapter`；
3. 在注册表中注册定义和网页适配器；
4. 添加注册、URL 归属和 DOM 探测测试。

网页编辑器中的当前完整文本是唯一可信结果。不要自行拼接服务端 partial/final，也不要在 Fcitx5 层加入厂商判断。

## Linux 分发

```bash
npm run build:linux:dir
npm run package:deb
npm run package:rpm
```

Arch/pacman 配置位于 `packaging/arch/`，Nix 入口为 `flake.nix`。详细依赖、验证状态和发布前替换项见 `packaging/README.md`。

## 验证

```bash
npm test
npm run build
npm run build:fcitx5
ctest --test-dir linux/fcitx5/build --output-on-failure
```

元宝仍需要使用具备语音输入权限的真实账号完成发布前端到端验证。不要把页面能加载等同于语音识别已经验证。
