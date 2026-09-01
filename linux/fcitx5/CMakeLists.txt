cmake_minimum_required(VERSION 3.16)

project(tama-asr-fcitx5 VERSION 1.0.1 LANGUAGES CXX)

include(GNUInstallDirs)
include(CTest)
find_package(Fcitx5Core 5.0 REQUIRED)
find_package(Fcitx5Utils 5.0 REQUIRED)
find_package(nlohmann_json 3.2 REQUIRED)

add_library(tama-asr MODULE voiceinput.cpp)
target_compile_features(tama-asr PRIVATE cxx_std_20)
target_compile_options(tama-asr PRIVATE -Wall -Wextra -Wpedantic)
target_link_libraries(tama-asr PRIVATE Fcitx5::Core Fcitx5::Utils nlohmann_json::nlohmann_json)
set_target_properties(tama-asr PROPERTIES PREFIX "lib")

set(TAMA_ASR_LIBRARY_PATH "${FCITX_INSTALL_ADDONDIR}/libtama-asr")
configure_file(tama-asr.conf.in tama-asr.conf @ONLY)
install(TARGETS tama-asr LIBRARY DESTINATION "${FCITX_INSTALL_ADDONDIR}")
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/tama-asr.conf" DESTINATION "${FCITX_INSTALL_PKGDATADIR}/addon")

if(BUILD_TESTING)
    add_executable(protocolsession_test protocolsession_test.cpp)
    target_compile_features(protocolsession_test PRIVATE cxx_std_17)
    add_test(NAME protocol-session COMMAND protocolsession_test)
endif()
