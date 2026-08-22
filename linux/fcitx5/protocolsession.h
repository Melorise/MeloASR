#pragma once

#include <cstdint>
#include <string>
#include <utility>

class ProtocolSession {
public:
    void start(std::string sessionId) {
        sessionId_ = std::move(sessionId);
        revision_ = 0;
    }

    bool active() const { return !sessionId_.empty(); }

    bool accept(const std::string &sessionId, std::int64_t revision) {
        if (!active() || sessionId != sessionId_ || revision <= revision_) return false;
        revision_ = revision;
        return true;
    }

    bool matches(const std::string &sessionId) const {
        return active() && sessionId == sessionId_;
    }

    void reset() {
        sessionId_.clear();
        revision_ = 0;
    }

private:
    std::string sessionId_;
    std::int64_t revision_ = 0;
};
