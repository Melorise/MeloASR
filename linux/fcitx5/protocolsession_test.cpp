#include "protocolsession.h"

#include <cassert>

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
}
