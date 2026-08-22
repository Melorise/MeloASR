cmake_minimum_required(VERSION 3.16)

project(meloasr-fcitx5 VERSION 0.1.0 LANGUAGES CXX)

include(GNUInstallDirs)
include(CTest)
find_package(Fcitx5Core 5.0 REQUIRED)
find_package(Fcitx5Utils 5.0 REQUIRED)
find_package(nlohmann_json 3.2 REQUIRED)

add_library(meloasr MODULE voiceinput.cpp)
target_compile_features(meloasr PRIVATE cxx_std_20)
target_compile_options(meloasr PRIVATE -Wall -Wextra -Wpedantic)
target_link_libraries(meloasr PRIVATE Fcitx5::Core Fcitx5::Utils nlohmann_json::nlohmann_json)
set_target_properties(meloasr PROPERTIES PREFIX "lib")

set(MELOASR_LIBRARY_PATH "${FCITX_INSTALL_ADDONDIR}/libmeloasr")
configure_file(meloasr.conf.in meloasr.conf @ONLY)
install(TARGETS meloasr LIBRARY DESTINATION "${FCITX_INSTALL_ADDONDIR}")
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/meloasr.conf" DESTINATION "${FCITX_INSTALL_PKGDATADIR}/addon")

if(BUILD_TESTING)
    add_executable(protocolsession_test protocolsession_test.cpp)
    target_compile_features(protocolsession_test PRIVATE cxx_std_17)
    add_test(NAME protocol-session COMMAND protocolsession_test)
endif()
