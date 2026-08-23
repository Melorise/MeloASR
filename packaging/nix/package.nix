{ lib
, stdenv
, importNpmLock
, nodejs
, electron
, cmake
, pkg-config
, makeWrapper
, fcitx5
, nlohmann_json
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "meloasr";
  version = (builtins.fromJSON (builtins.readFile ../../package.json)).version;

  src = ../..;

  npmDeps = importNpmLock {
    npmRoot = finalAttrs.src;
  };

  nativeBuildInputs = [
    nodejs
    importNpmLock.npmConfigHook
    cmake
    pkg-config
    makeWrapper
  ];

  buildInputs = [ fcitx5 nlohmann_json ];

  buildPhase = ''
    runHook preBuild
    npm run build
    cmake -S linux/fcitx5 -B build/fcitx5 \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX="$out" \
      -DFCITX_INSTALL_USE_FCITX_SYS_PATHS=OFF
    cmake --build build/fcitx5 --parallel "$NIX_BUILD_CORES"
    runHook postBuild
  '';

  checkPhase = ''
    runHook preCheck
    npm test
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
    if [ -d node_modules ]; then
      npm prune --omit=dev --ignore-scripts
      cp -r node_modules "$appDir/"
    fi

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
