# TamaASR

TamaASR 是面向 Linux/Fcitx5 的桌面语音输入工具。   

和常规ASR软件不同，本软件不运行本地模型或要求用户提供ASR api进行调用，而是通过将语音输入转发到支持语音识别的AI网页对话助手，再将识别到的文字抓取并发送到fcitx5完成输入。  

您需要在本软件的内置浏览器里登录对应的AI助手平台，然后在外部按住快捷键即可进行输入。   

从官方渠道(Github Releases,星火商店等)获取到的本软件，不会获取您的任何个人信息、AI平台账户信息、对话记录或语音输入记录   
如果您是从其它渠道获取，且无法确认来源可信，请立即卸载并更换为官方来源的版本以防止个人信息泄露   
本项目遵循MPL-2.0许可证开源    

当前支持的可作为输入源的后端：

- 千问
- 元宝

### 出于个人原因(多次尝试后效果不符合预期，个人设备不兼容等)，本项目暂不考虑迁移到Tauri或QtWebEngine。

## 架构

```text
网页后端适配器
  → Electron 后端窗口与登录会话
  → 会话状态机
  → $XDG_RUNTIME_DIR/tama-asr/fcitx5.sock
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
pnpm install --frozen-lockfile
pnpm test
pnpm run build:fcitx5
./linux/fcitx5/install-user.sh
fcitx5 -r
pnpm start
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
pnpm run build:linux:dir
pnpm run package:deb
pnpm run package:rpm
```

Arch/pacman 配置位于 `packaging/arch/`，Nix 入口为 `flake.nix`。详细依赖、验证状态和发布前替换项见 `packaging/README.md`。

## Nix Cachix缓存源
缓存源：https://meloasr.cachix.org   
公钥：meloasr.cachix.org-1:oMmpfj7D1pQTtJx6cHYupvPDJPFlkBB0JIpJYvkR5hc=

## 验证

```bash
pnpm test
pnpm run build
pnpm run build:fcitx5
ctest --test-dir linux/fcitx5/build --output-on-failure
```
