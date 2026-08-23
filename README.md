# MeloASR

大模型的进步推动了自然语言处理的进化，语音输入正在成为主流。在其它桌面平台下，微信输入法，豆包输入法，千问输入法等支持语音输入甚至以此为卖点的新兴中文输入法正在成为主流。
而在linux下，相关领域却长期空白，现有实现主要聚焦于以下几种类型:


api调用——调用各大ai厂商的语音转文字api。显然，该方案最大的问题在于——要钱。
本地模型——识别准确率低，技术落后，和其他平台的能实时校正的ai语音输入根本不是一个量级的东西，尤其是针对中文环境。

我们注意到，很多大模型的网页对话窗口，都支持语音输入，而且完全免费——因为语音输入最后只是输入到文本框，并没有发送实际的对话请求，而大模型就算是付费也往往是根据对话请求来计费的。

因此，本项目使用了一种全新的思路:在后台运行一个electron应用，并在里面登录千问，元宝等网页版对话作为后端，实时抓取语音输入到输入框中的结果，并传递给fcitx5，从而让linux用户也用上高质量的语音输入。

简而言之，MeloASR 是面向 Linux/Fcitx5 的桌面语音输入工具。应用使用受支持网页平台自身的录音、流式识别、纠错、断句和标点能力，并把网页编辑器中的当前完整文本实时同步到活动的 Fcitx5 InputContext。

当前后端：

- 千问
- 元宝

### 本项目暂不考虑迁移到Tauri。我们充分理解这种需要后台常驻的系统性应用，在Tauri下开发似乎更加合适，事实上我们也确实进行了两次Tauri迁移。但元宝和千问web版对于webkit2gtk的表现实在是过于糟糕了（至少是在我的目标设备上），即使使用默认的gnome浏览器进行语音输入都会卡死，更不用说后续自动化的抓取了。还请各位理解，该项目是一个偏个人向的项目（毕竟使用的这种方式，大规模公开那就是商业侵权），而我的目标开发设备是一台非常老旧的设备，我没法说因为为了在他人的设备上获得更出色的性能而放弃对自己设备的适配。也许未来我们会在这些web端的兼容性得到改善，或者该目标设备被淘汰以后，才会考虑向Tauri迁移。

### 当前electron版的常驻占用内存在200mb左右。

### 项目暂不支持豆包后端。豆包的ASR输入是直接发送请求，而非像元宝和千问一样输出到输入框，这就需要拦截或自行重新实现请求，技术难度高且有风控风险。

### 同时该项目是中文输入主导的，也不考虑适配chatgpt等非中文优先的平台。


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
