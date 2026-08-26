{ lib
, stdenv
, fetchPnpmDeps
, nodejs
, pnpm_11
, pnpmConfigHook
, electron
, cmake
, pkg-config
, makeWrapper
, fcitx5
, nlohmann_json
}:

let
  pnpm = pnpm_11;
in
stdenv.mkDerivation (finalAttrs: {
  pname = "meloasr";
  version = (builtins.fromJSON (builtins.readFile ../../package.json)).version;

  src = ../..;

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    inherit pnpm;
    fetcherVersion = 4;
    hash = "sha256-KoxRIhZVhshxTpl5rzzfUnaSAuGo3gCvFD2FsltN1gc=";
  };

  nativeBuildInputs = [
    nodejs
    pnpm
    pnpmConfigHook
    cmake
    pkg-config
    makeWrapper
  ];

  buildInputs = [ fcitx5 nlohmann_json ];

  # 保留 pnpmConfigHook 的 postConfigure 生命周期，但不对项目根目录运行默认 CMake 配置。
  configurePhase = ''
    runHook preConfigure
    runHook postConfigure
  '';

  buildPhase = ''
    runHook preBuild
    pnpm run build
    cmake -S linux/fcitx5 -B build/fcitx5 \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX="$out" \
      -DFCITX_INSTALL_USE_FCITX_SYS_PATHS=OFF
    cmake --build build/fcitx5 --parallel "$NIX_BUILD_CORES"
    runHook postBuild
  '';

  checkPhase = ''
    runHook preCheck
    pnpm test
    ctest --test-dir build/fcitx5 --output-on-failure
    runHook postCheck
  '';
  doCheck = true;

  installPhase = ''
    runHook preInstall

    appDir="$out/share/meloasr/app"
    mkdir -p "$appDir" "$out/bin" "$out/share/applications" \
      "$out/share/pixmaps" "$out/share/metainfo" \
      "$out/etc/xdg/autostart"

    cp package.json "$appDir/"
    cp -r dist "$appDir/"
    install -Dm644 packaging/assets/meloasr.desktop \
      "$out/share/applications/meloasr.desktop"
    install -Dm644 packaging/assets/meloasr-autostart.desktop \
      "$out/etc/xdg/autostart/meloasr.desktop"
    install -Dm644 packaging/assets/meloasr.metainfo.xml \
      "$out/share/metainfo/meloasr.metainfo.xml"
    install -Dm644 src/assets/logo.png \
      "$out/share/pixmaps/meloasr.png"

    cmake --install build/fcitx5
    makeWrapper ${electron}/bin/electron "$out/bin/meloasr" \
      --add-flags "$appDir"

    runHook postInstall
  '';

  meta = {
    description = "Web-backed voice input for Fcitx5";
    homepage = "https://github.com/Melorise/MeloASR";
    license = lib.licenses.mpl20;
    mainProgram = "meloasr";
    platforms = lib.platforms.linux;
  };
})
