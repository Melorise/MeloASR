# MeloASR Fcitx5 addon

该 addon 作为 Fcitx5 常驻 Module 工作，不需要切换到独立输入法。

- 按住设置的快捷键：向 Electron 请求开始语音输入；
- 松开主键：请求停止；
- `Esc`、普通键盘输入、焦点丢失、InputContext reset 或 Socket 断开：取消且不提交；
- Electron 每次发送网页编辑器的完整文本时，addon 整体替换 client preedit；
- `finish` 只调用一次 `commitString()`。

用户级安装：

```bash
./linux/fcitx5/install-user.sh
fcitx5 -r
```

安装文件：

```text
~/.local/lib/fcitx5/libmeloasr.so
~/.local/share/fcitx5/addon/meloasr.conf
```

本地协议使用 `$XDG_RUNTIME_DIR/meloasr/fcitx5.sock`，目录权限 `0700`，Socket 权限 `0600`。协议版本为 2，支持 `configure` 动态快捷键和 `activate` 悬浮球启动请求。
