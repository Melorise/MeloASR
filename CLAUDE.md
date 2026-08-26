# MeloASR 维护约定

## 项目范围

MeloASR 是仅面向 Linux 的 Fcitx5 桌面语音输入工具。项目名为 `MeloASR`，分发包名为 `meloasr`，当前版本为 `0.1.15`。

不得恢复 Windows、PowerShell 或 Tauri 输出路径。发行版差异只能存在于依赖说明和打包配置，不能进入语音输入核心逻辑。

除非用户另有要求，文档、界面文字和代码注释使用简体中文。

`AGENTS.md` 与 `CLAUDE.md` 必须始终逐字一致。修改其中任意一份时必须把相同内容同步到另一份，并在提交前使用字节比较确认一致。

## 核心不变量

- 网页编辑器中的当前完整内容是唯一可信识别结果。
- 使用网页平台自身的采集、流式 ASR、纠错、断句和标点能力。
- 禁止复刻厂商 WebSocket/PCM 协议，禁止自行拼接 partial/final。
- 网页文本缩短、改词或补标点时，必须整体替换 Fcitx5 client preedit。
- 正常结束只提交一次最终完整文本；取消、失焦、reset 或断线不得提交。
- 禁止使用剪贴板、模拟键盘、xdotool 或 Wayland 注入代替 Fcitx5。

## 模块边界

`src/main/index.ts` 只组合依赖、注册 IPC 和管理 Electron 生命周期，不承载具体业务。

- `src/backends/`：后端静态定义、网页适配器、登录/就绪探测和注册表；
- `backend-manager.ts`：后端 BrowserWindow、persistent partition、权限和调试窗口；
- `session-controller.ts`：idle/starting/recording/stopping 状态机；
- `fcitx-bridge.ts`：Unix Socket、JSONL、sessionId/revision；
- `tray-controller.ts`：托盘菜单和就绪颜色；
- `settings-store.ts`：设置 schema、默认值和迁移；
- `auto-start-service.ts`：Linux XDG autostart；
- `overlay-controller.ts`：悬浮球位置、常驻和状态；
- `src/preload/`：最小化 IPC 暴露；
- `src/renderer/`：设置和悬浮球 UI。

不要把新功能重新堆回入口文件。

## 后端扩展契约

厂商 DOM 只能出现在对应 `BackendWebAdapter`。新增后端需要声明 ID、显示名、URL、允许 origin、persistent partition、编辑器选择器、序列化、麦克风定位、登录/就绪探测和停止等待时间，并在注册表注册。

登录状态是网页适配器上报的可观测状态，不能仅凭 `did-finish-load` 推断。切换后端不得清除其它后端的 cookie 或登录会话。Fcitx5 addon 不得了解后端 ID 以外的厂商细节。

## Fcitx5 与本地协议

- Socket：`$XDG_RUNTIME_DIR/meloasr/fcitx5.sock`；目录 `0700`，Socket `0600`；
- JSONL 协议版本：2；
- `sessionId` 隔离轮次，`revision` 单调递增；
- `text` 永远是当前完整文本；
- `configure` 同步快捷键，不能使用 Electron 假注册代替；
- `activate` 允许不抢焦点的常驻悬浮球请求当前 InputContext；
- 断线、reset 和焦点丢失必须清空 preedit 并取消。

## 状态与交互

- 后端真正 ready 前拒绝录音，并通过桌面通知说明原因；
- 托盘颜色必须投影当前后端就绪状态；
- 设置页和调试窗口默认隐藏，关闭时隐藏，应用生命周期由托盘维持；
- 调试窗口首次打开时提示用户登录；
- 悬浮球不得抢焦点，位置只由设置控制；常驻时点击开始，录音时点击停止；
- 多屏坐标基于 workArea 限制，方向键 1 px、Shift + 方向键 10 px；
- 默认开机自启动，关闭时用用户级 `Hidden=true` 覆盖系统级 autostart。

## Electron 安全

- 保持 `contextIsolation: true`、`nodeIntegration: false`；
- preload 只暴露必要 API，主进程验证 IPC sender 和 payload；
- 后端媒体权限仅授予精确允许 origin；
- 后端新窗口只允许 HTTPS，不能把 cookie、token 或网页敏感内容写入日志；
- 如果后端 preload 需要拆分模块，必须 bundle 后再启用 sandbox。

## 构建与验证

核心命令：

```bash
npm test
npm run build
npm run build:fcitx5
ctest --test-dir linux/fcitx5/build --output-on-failure
```

验证必须与实际改动范围对应，禁止为了展示“完整”而机械扩大测试范围：

- TypeScript、preload 或 renderer 改动运行 `npm test` 和 `npm run build`；
- 只有修改 Fcitx5 C++、CMake 构建逻辑或本地协议实现时，才运行 `npm run build:fcitx5` 和 `ctest`；仅同步发行版本号不要求重测未改动的 Fcitx5 逻辑；
- FHS 发行版是首要维护目标，FHS 构建或打包问题必须在对应 Debian、Ubuntu、RPM 或 Arch 环境处理，不得默认用 Nix 环境替代；Nix 只用于验证 Nix 打包路径；
- 项目依赖未安装时，按 `package-lock.json` 运行 `npm ci`，不能以 `tsc` 或其它工具缺失为由跳过正常验证；
- 不得声称添加了未实际添加的测试，也不得把无关环境中的成功构建计入目标平台验证结果。

最低动态回归：连续三轮；文本缩短、改词和补标点；finish 仅一次；cancel/reset/disconnect；ready gate；登录探测；后端切换；多屏位置和键盘微调；托盘退出/重启；自启动；GTK、Qt、Chromium 和终端；X11 与 Wayland。

不要声称没有真实验证的发行版包或元宝端到端识别已经通过。

## 打包

deb、rpm、Arch/pacman 和 Nix 都必须包含 Electron 应用、desktop/icon/autostart 文件和 Fcitx5 addon。桌面 ID、包名、Socket、addon 名称和版本保持一致。仓库地址和许可证确定前，不得把占位值作为正式发行元数据。

版本发布时同步 `package.json`、`package-lock.json`、CHANGELOG、AppStream、Fcitx5 addon 版本和各发行版打包元数据，并运行 `scripts/release-metadata.mjs <version>` 校验发布说明。

`v*` Git 标签由远程 Release 工作流产生。除非用户明确要求，本地禁止创建、移动或删除发布标签，也禁止推送提交或标签。“更新版本”或“更新发版”本身不等于授权本地打标签。

## 工程判断与性能修改

- 先区分稳定对象与对象内部的可变内容。一次语音会话中编辑器根元素视为稳定对象，可以缓存；识别文本所在的子树内容持续变化，必须重新序列化完整结果。
- 不得用没有实际证据的极端场景否定正常工程假设，例如假设同一录音会话中的编辑器根元素会被持续重建。若稳定对象意外失效，应采用明确失败策略，不能为猜测场景增加常态热路径开销。
- 性能结论必须区分静态代码分析与真实测量。没有 profiler、计时或内存采样时，不得给出伪精确的性能收益。
- 优化热路径时先消除重复 DOM 查询、重复序列化、重复 IPC 和无意义轮询，不得破坏网页常驻、实时启动录音和完整文本同步这些产品前提。

## 工作边界与交付检查

- 开始操作前确认实际 Git 仓库根目录，不能仅依赖外层工作区路径。
- 用户要求实现修改时，应完成代码、对应验证、版本与 CHANGELOG 更新等明确要求；遇到缺失依赖要解决或准确报告真实阻塞，不能自行缩减交付范围。
- 不得为了反驳用户而引入没有证据的假设。用户指出实现与事实矛盾时，应先核对代码链路并修正判断。
- 只修改任务相关文件，不运行与改动无关的构建，不擅自扩大发布、标签、推送或外部操作范围。
- 提交前检查 `git diff --check`、发行元数据校验和对应测试；提交后检查 `git status --short`、提交内容和工作树是否干净。
- 只要修改了仓库文件，就必须在本轮创建对应 Git commit，不得留下未提交改动；如果不准备或不能提交，就不得修改文件。Tag 和 push 仍需分别获得用户明确授权，不能从修改或 commit 推定。

## 提交约定

按功能粒度提交，只包含相关文件。提交前运行对应验证。AI 辅助提交尾部统一添加：

```text
AI-assisted-by: Codex
AI-model: gpt-5.6-sol
AI-reasoning-effort: medium
Co-authored-by: Codex <codex@openai.com>
```
