#include "protocolsession.h"
#include "preeditfinalizer.h"
#include "keyeventclassifier.h"

#include <cassert>
#include <string>
#include <vector>

int main() {
    ProtocolSession session;
    assert(!session.active());
    session.start("round-1");
    assert(session.active());
    assert(session.accept("round-1", 1));
    assert(!session.accept("round-1", 1));
    assert(!session.accept("round-1", 0));
    assert(!session.accept("old-round", 2));
    assert(session.accept("round-1", 3));
    session.reset();
    assert(!session.active());
    assert(!session.accept("round-1", 4));
    session.start("round-2");
    assert(!session.accept("round-1", 100));
    assert(session.accept("round-2", 1));
    std::vector<std::string> finalizationEvents;
    finalizePreedit(
        "最终文本",
        [&finalizationEvents]() { finalizationEvents.emplace_back("clear"); },
        [&finalizationEvents](const std::string &text) {
            finalizationEvents.emplace_back("commit:" + text);
        });
    assert((finalizationEvents == std::vector<std::string>{"clear", "commit:最终文本"}));

    assert(classifyVoiceKeyEvent(false, true, false, true, false, false, false) ==
           VoiceKeyAction::ConsumeHeldTrigger);
    assert(classifyVoiceKeyEvent(true, true, false, true, false, false, false) ==
           VoiceKeyAction::Stop);
    assert(classifyVoiceKeyEvent(false, true, false, false, false, false, true) ==
           VoiceKeyAction::Cancel);
}
