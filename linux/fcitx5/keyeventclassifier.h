#pragma once

enum class VoiceKeyAction {
    Pass,
    Start,
    Stop,
    ConsumeHeldTrigger,
    Cancel,
};

inline VoiceKeyAction classifyVoiceKeyEvent(bool isRelease, bool held,
                                             bool triggerMatches,
                                             bool rawSymbolMatches,
                                             bool repeat, bool modifier,
                                             bool sessionPending) {
    if (!isRelease && triggerMatches) {
        return (repeat || held) ? VoiceKeyAction::ConsumeHeldTrigger
                                : VoiceKeyAction::Start;
    }
    if (held && rawSymbolMatches) {
        return isRelease ? VoiceKeyAction::Stop
                         : VoiceKeyAction::ConsumeHeldTrigger;
    }
    if (!sessionPending || isRelease || modifier) {
        return VoiceKeyAction::Pass;
    }
    return VoiceKeyAction::Cancel;
}
