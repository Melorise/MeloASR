#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <utility>

#include <fcntl.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

#include <nlohmann/json.hpp>

#include <fcitx-utils/event.h>
#include <fcitx-utils/capabilityflags.h>
#include <fcitx-utils/key.h>
#include <fcitx-utils/keysym.h>
#include <fcitx-utils/log.h>
#include <fcitx/addonfactory.h>
#include <fcitx/addoninstance.h>
#include <fcitx/addonmanager.h>
#include <fcitx/event.h>
#include <fcitx/inputcontext.h>
#include <fcitx/inputpanel.h>
#include <fcitx/instance.h>
#include <fcitx/text.h>

#include "protocolsession.h"
#include "preeditfinalizer.h"
#include "keyeventclassifier.h"

namespace {

constexpr int kProtocolVersion = 2;
constexpr std::size_t kMaxBufferBytes = 1024 * 1024;

#define MELOASR_DIAGNOSTIC_INFO if (!diagnosticLogging_) {} else FCITX_INFO()

class VoiceInputAddon final : public fcitx::AddonInstance {
public:
    explicit VoiceInputAddon(fcitx::Instance *instance)
        : instance_(instance), trigger_("Control+Shift+space") {
        keyWatcher_ = instance_->watchEvent(
            fcitx::EventType::InputContextKeyEvent,
            // 必须在原输入法之前吞掉快捷键；否则长按产生的重复事件会先触发
            // Fcitx5 自身的输入法切换窗口，并打断网页录音焦点。
            fcitx::EventWatcherPhase::PreInputMethod,
            [this](fcitx::Event &event) {
                handleKeyEvent(static_cast<fcitx::KeyEvent &>(event));
            });
        focusOutWatcher_ = instance_->watchEvent(
            fcitx::EventType::InputContextFocusOut,
            fcitx::EventWatcherPhase::PostInputMethod,
            [this](fcitx::Event &event) {
                MELOASR_DIAGNOSTIC_INFO << "MeloASR：InputContext focusOut，取消当前会话 active="
                             << session_.active() << " awaiting=" << awaitingStart_;
                cancelForContext(static_cast<fcitx::InputContextEvent &>(event).inputContext());
            });
        focusInWatcher_ = instance_->watchEvent(
            fcitx::EventType::InputContextFocusIn,
            fcitx::EventWatcherPhase::PostInputMethod,
            [this](fcitx::Event &event) {
                focusedInputContext_ =
                    static_cast<fcitx::InputContextEvent &>(event).inputContext();
            });
        resetWatcher_ = instance_->watchEvent(
            fcitx::EventType::InputContextReset,
            fcitx::EventWatcherPhase::PostInputMethod,
            [this](fcitx::Event &event) {
                MELOASR_DIAGNOSTIC_INFO << "MeloASR：InputContext reset，取消当前会话 active="
                             << session_.active() << " awaiting=" << awaitingStart_;
                cancelForContext(static_cast<fcitx::InputContextEvent &>(event).inputContext());
            });
        destroyedWatcher_ = instance_->watchEvent(
            fcitx::EventType::InputContextDestroyed,
            fcitx::EventWatcherPhase::PostInputMethod,
            [this](fcitx::Event &event) {
                auto *context = static_cast<fcitx::InputContextEvent &>(event).inputContext();
                if (context == focusedInputContext_) focusedInputContext_ = nullptr;
                if (context == inputContext_) {
                    MELOASR_DIAGNOSTIC_INFO << "MeloASR：InputContext destroyed，取消当前会话";
                    sendControl("request-cancel");
                    resetLocalState(false);
                }
            });
        reconnectTimer_ = instance_->eventLoop().addTimeEvent(
            CLOCK_MONOTONIC, fcitx::now(CLOCK_MONOTONIC) + 100000, 100000,
            [this](fcitx::EventSourceTime *source, uint64_t) {
                if (socketFd_ < 0) ensureConnected();
                source->setNextInterval(1000000);
                // 时间事件触发后会退出 one-shot 状态；重新启用才能持续探测
                // Electron 的重启和冷启动。
                source->setOneShot();
                return true;
            });
    }

    ~VoiceInputAddon() override {
        if (inputContext_) {
            clearPreedit();
        }
        disconnectSocket();
    }

private:
    void handleKeyEvent(fcitx::KeyEvent &event) {
        const VoiceKeyAction action = classifyVoiceKeyEvent(
            event.isRelease(), held_, event.key().check(trigger_),
            event.rawKey().sym() == trigger_.sym(),
            event.rawKey().states().test(fcitx::KeyState::Repeat),
            event.key().isModifier(), session_.active() || awaitingStart_);

        if (action == VoiceKeyAction::ConsumeHeldTrigger) {
            event.filterAndAccept();
            return;
        }

        if (action == VoiceKeyAction::Start) {
            event.filterAndAccept();
            MELOASR_DIAGNOSTIC_INFO << "网页语音输入：快捷键按下 held=" << held_
                         << " awaiting=" << awaitingStart_
                         << " active=" << session_.active();
            if (!ensureConnected()) {
                FCITX_WARN() << "网页语音输入：Electron Socket 尚未就绪";
                return;
            }
            held_ = true;
            if (!prepareInputContext(event.inputContext())) held_ = false;
            return;
        }

        if (action == VoiceKeyAction::Stop) {
            event.filterAndAccept();
            MELOASR_DIAGNOSTIC_INFO << "网页语音输入：快捷键松开 awaiting=" << awaitingStart_
                         << " active=" << session_.active();
            held_ = false;
            if (awaitingStart_ || session_.active()) sendControl("request-stop");
            return;
        }

        if (action == VoiceKeyAction::Pass) return;

        if (event.key().check(FcitxKey_Escape)) {
            event.filterAndAccept();
            MELOASR_DIAGNOSTIC_INFO << "MeloASR：录音中收到 Escape，取消当前会话";
            sendControl("request-cancel");
            clearPreedit();
            resetLocalState(false);
            return;
        }

        // 用户开始键盘输入时，立即取消语音会话，并让该按键继续交给原输入法。
        MELOASR_DIAGNOSTIC_INFO << "MeloASR：录音中收到其它按键，取消当前会话 key="
                     << event.key().toString() << " rawKey=" << event.rawKey().toString()
                     << " repeat=" << event.rawKey().states().test(fcitx::KeyState::Repeat);
        sendControl("request-cancel");
        clearPreedit();
        resetLocalState(false);
    }

    bool prepareInputContext(fcitx::InputContext *context) {
        if (!context || !context->hasFocus()) return false;
        if (!context->inputPanel().clientPreedit().empty() ||
            !context->inputPanel().preedit().empty()) {
            FCITX_WARN() << "MeloASR：当前输入法存在未提交文本，本轮未启动";
            return false;
        }
        inputContext_ = context;
        awaitingStart_ = true;
        sendControl("request-start");
        return true;
    }

    bool ensureConnected() {
        if (socketFd_ >= 0) {
            char byte;
            const ssize_t probe = ::recv(socketFd_, &byte, sizeof(byte), MSG_PEEK | MSG_DONTWAIT);
            if (probe > 0 || (probe < 0 && (errno == EAGAIN || errno == EWOULDBLOCK))) {
                return true;
            }
            MELOASR_DIAGNOSTIC_INFO << "网页语音输入：检测到失效的 Electron Socket，立即重连";
            handleDisconnect();
        }
        const char *runtimeDir = std::getenv("XDG_RUNTIME_DIR");
        if (!runtimeDir || !*runtimeDir) return false;
        const std::string socketPath = std::string(runtimeDir) + "/meloasr/fcitx5.sock";
        const int fd = ::socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
        if (fd < 0) return false;
        sockaddr_un address{};
        if (socketPath.size() >= sizeof(address.sun_path)) {
            ::close(fd);
            return false;
        }
        address.sun_family = AF_UNIX;
        std::memcpy(address.sun_path, socketPath.c_str(), socketPath.size() + 1);
        if (::connect(fd, reinterpret_cast<sockaddr *>(&address), sizeof(address)) < 0) {
            ::close(fd);
            return false;
        }
        const int flags = ::fcntl(fd, F_GETFL, 0);
        if (flags >= 0) ::fcntl(fd, F_SETFL, flags | O_NONBLOCK);
        socketFd_ = fd;
        socketWatcher_ = instance_->eventLoop().addIOEvent(
            socketFd_, fcitx::IOEventFlags{fcitx::IOEventFlag::In, fcitx::IOEventFlag::Err,
                                           fcitx::IOEventFlag::Hup},
            [this](fcitx::EventSourceIO *, int, fcitx::IOEventFlags flags) {
                if (flags.test(fcitx::IOEventFlag::Err) || flags.test(fcitx::IOEventFlag::Hup)) {
                    handleDisconnect();
                    return false;
                }
                return readMessages();
            });
        return writeJson({{"type", "hello"}, {"protocol", kProtocolVersion}});
    }

    bool readMessages() {
        char chunk[8192];
        while (true) {
            const ssize_t size = ::recv(socketFd_, chunk, sizeof(chunk), 0);
            if (size > 0) {
                readBuffer_.append(chunk, static_cast<std::size_t>(size));
                if (readBuffer_.size() > kMaxBufferBytes) {
                    handleDisconnect();
                    return false;
                }
                consumeLines();
                continue;
            }
            if (size == 0) {
                handleDisconnect();
                return false;
            }
            if (errno == EINTR) continue;
            if (errno == EAGAIN || errno == EWOULDBLOCK) return true;
            handleDisconnect();
            return false;
        }
    }

    void consumeLines() {
        std::size_t newline;
        while ((newline = readBuffer_.find('\n')) != std::string::npos) {
            std::string line = readBuffer_.substr(0, newline);
            readBuffer_.erase(0, newline + 1);
            if (line.empty()) continue;
            try {
                handleMessage(nlohmann::json::parse(line));
            } catch (const std::exception &error) {
                FCITX_WARN() << "网页语音输入协议解析失败：" << error.what();
            }
        }
    }

    void handleMessage(const nlohmann::json &message) {
        if (!message.is_object() || !message.contains("type") || !message["type"].is_string()) return;
        const std::string type = message["type"].get<std::string>();
        if (type == "hello") {
            if (message.value("protocol", 0) != kProtocolVersion) handleDisconnect();
            return;
        }
        if (type == "configure") {
            if (message.contains("diagnosticLogging") && message["diagnosticLogging"].is_boolean()) {
                diagnosticLogging_ = message["diagnosticLogging"].get<bool>();
            }
            if (!message.contains("shortcut") || !message["shortcut"].is_string() ||
                awaitingStart_ || session_.active()) return;
            fcitx::Key candidate(message["shortcut"].get<std::string>());
            if (!candidate.isValid() || !candidate.hasModifier()) {
                FCITX_WARN() << "MeloASR：拒绝无效快捷键";
                return;
            }
            trigger_ = std::move(candidate);
            MELOASR_DIAGNOSTIC_INFO << "MeloASR：快捷键已更新为 " << trigger_.toString();
            return;
        }
        if (type == "activate") {
            if (!awaitingStart_ && !session_.active()) {
                prepareInputContext(focusedInputContext_);
            }
            return;
        }
        if (type == "start") {
            if (!awaitingStart_ || !inputContext_ || !inputContext_->hasFocus()) return;
            if (!message.contains("sessionId") || !message["sessionId"].is_string()) return;
            session_.start(message["sessionId"].get<std::string>());
            awaitingStart_ = false;
            MELOASR_DIAGNOSTIC_INFO << "网页语音输入：会话开始，clientPreedit="
                         << inputContext_->capabilityFlags().test(fcitx::CapabilityFlag::Preedit);
            // 新会话尚无文本；重复发布空 preedit 会使部分 frontend 立刻 reset。
            return;
        }
        if (type == "cancel") {
            const std::string incoming = message.value("sessionId", std::string());
            if (!incoming.empty() && !session_.matches(incoming)) return;
            MELOASR_DIAGNOSTIC_INFO << "MeloASR：收到 Electron cancel，sessionIdEmpty="
                         << incoming.empty() << " message="
                         << message.value("message", std::string());
            clearPreedit();
            resetLocalState(false);
            return;
        }
        if (type == "update" || type == "finish") {
            if (!message.contains("revision") || !message["revision"].is_number_integer() ||
                !message.contains("text") || !message["text"].is_string()) return;
            const std::int64_t incomingRevision = message["revision"].get<std::int64_t>();
            if (!session_.accept(message.value("sessionId", std::string()), incomingRevision)) return;
            currentText_ = message["text"].get<std::string>();
            MELOASR_DIAGNOSTIC_INFO << "网页语音输入：收到 " << type << " revision="
                         << incomingRevision << " bytes=" << currentText_.size();
            setPreedit(currentText_);
            if (type == "finish") {
                finalizePreedit(
                    currentText_, [this]() { clearPreedit(); },
                    [this](const std::string &text) {
                        if (inputContext_ && inputContext_->hasFocus()) {
                            inputContext_->commitString(text);
                        }
                    });
                resetLocalState(false);
            }
        }
    }

    void setPreedit(const std::string &text) {
        if (!inputContext_ || !inputContext_->hasFocus()) return;
        fcitx::Text formatted(text);
        formatted.setCursor(static_cast<int>(text.size()));
        inputContext_->inputPanel().setClientPreedit(formatted);
        inputContext_->updatePreedit();
    }

    void clearPreedit() {
        if (!inputContext_) return;
        inputContext_->inputPanel().setClientPreedit(fcitx::Text());
        if (inputContext_->hasFocus()) {
            inputContext_->updatePreedit();
        }
    }

    void cancelForContext(fcitx::InputContext *context) {
        if (context == focusedInputContext_) focusedInputContext_ = nullptr;
        if (context != inputContext_) return;
        sendControl("request-cancel");
        clearPreedit();
        resetLocalState(false);
    }

    void resetLocalState(bool keepContext) {
        held_ = false;
        awaitingStart_ = false;
        session_.reset();
        currentText_.clear();
        if (!keepContext) inputContext_ = nullptr;
    }

    bool sendControl(const char *type) { return writeJson({{"type", type}}); }

    bool writeJson(const nlohmann::json &message) {
        if (socketFd_ < 0) return false;
        const std::string line = message.dump() + "\n";
        std::size_t offset = 0;
        while (offset < line.size()) {
            const ssize_t written = ::send(socketFd_, line.data() + offset, line.size() - offset, MSG_NOSIGNAL);
            if (written > 0) {
                offset += static_cast<std::size_t>(written);
                continue;
            }
            if (written < 0 && errno == EINTR) continue;
            handleDisconnect();
            return false;
        }
        return true;
    }

    void handleDisconnect() {
        MELOASR_DIAGNOSTIC_INFO << "MeloASR：Electron Socket 断开，取消当前会话 active="
                     << session_.active() << " awaiting=" << awaitingStart_;
        clearPreedit();
        resetLocalState(false);
        disconnectSocket();
    }

    void disconnectSocket() {
        socketWatcher_.reset();
        if (socketFd_ >= 0) ::close(socketFd_);
        socketFd_ = -1;
        readBuffer_.clear();
    }

    fcitx::Instance *instance_;
    fcitx::Key trigger_;
    fcitx::InputContext *inputContext_ = nullptr;
    fcitx::InputContext *focusedInputContext_ = nullptr;
    bool held_ = false;
    bool awaitingStart_ = false;
    bool diagnosticLogging_ = false;
    ProtocolSession session_;
    std::string currentText_;
    int socketFd_ = -1;
    std::string readBuffer_;
    std::unique_ptr<fcitx::EventSourceIO> socketWatcher_;
    std::unique_ptr<fcitx::EventSourceTime> reconnectTimer_;
    std::unique_ptr<fcitx::HandlerTableEntry<fcitx::EventHandler>> keyWatcher_;
    std::unique_ptr<fcitx::HandlerTableEntry<fcitx::EventHandler>> focusOutWatcher_;
    std::unique_ptr<fcitx::HandlerTableEntry<fcitx::EventHandler>> focusInWatcher_;
    std::unique_ptr<fcitx::HandlerTableEntry<fcitx::EventHandler>> resetWatcher_;
    std::unique_ptr<fcitx::HandlerTableEntry<fcitx::EventHandler>> destroyedWatcher_;
};

class VoiceInputAddonFactory final : public fcitx::AddonFactory {
public:
    fcitx::AddonInstance *create(fcitx::AddonManager *manager) override {
        return new VoiceInputAddon(manager->instance());
    }
};

} // namespace

FCITX_ADDON_FACTORY(VoiceInputAddonFactory);
