#pragma once

#include <string>
#include <utility>

template <typename ClearPreedit, typename CommitText>
void finalizePreedit(const std::string &text, ClearPreedit &&clearPreedit,
                     CommitText &&commitText) {
    std::forward<ClearPreedit>(clearPreedit)();
    if (!text.empty()) {
        std::forward<CommitText>(commitText)(text);
    }
}
