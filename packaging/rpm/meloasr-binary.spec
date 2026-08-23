Name:           meloasr
Version:        %{meloasr_version}
Release:        1%{?dist}
Summary:        Web-backed voice input for Fcitx5
License:        MPL-2.0
URL:            https://github.com/Melorise/MeloASR
Source0:        meloasr-root.tar.gz

Requires:       fcitx5
Requires:       gtk3
Requires:       nss
Requires:       libXScrnSaver
Requires:       mesa-libgbm

%description
MeloASR hosts supported web speech-recognition backends and sends their live
corrected text to the active Fcitx5 input context.

%prep

%build

%install
mkdir -p %{buildroot}
tar -C %{buildroot} -xzf %{SOURCE0}

%files
%defattr(-,root,root,-)
/opt/meloasr
/usr/bin/meloasr
%{meloasr_addon_file}
/usr/share/applications/meloasr.desktop
/usr/share/pixmaps/meloasr.png
/usr/share/metainfo/meloasr.metainfo.xml
/usr/share/fcitx5/addon/meloasr.conf
/etc/xdg/autostart/meloasr.desktop

%changelog
* Sun Aug 23 2026 MeloASR contributors - 0.1.12-1
- Disable Electron GPU acceleration for background web renderers.

* Sun Aug 23 2026 MeloASR contributors - 0.1.11-1
- Release only the selected speech backend renderer.
- Keep the overlay as a non-interactive session status indicator.

* Sun Aug 23 2026 MeloASR contributors - 0.1.10-1
- Restore the Nix npm configuration hook before building the application.

* Sun Aug 23 2026 MeloASR contributors - 0.1.9-1
- Fix multi-architecture package staging and RPM addon file ownership.
- Fix Nix derivation configuration phase.

* Sun Aug 23 2026 MeloASR contributors - 0.1.8-1
- Fix Fcitx5 addon compatibility with Ubuntu 24.04.

* Sun Aug 23 2026 MeloASR contributors - 0.1.7-1
- Initial package
