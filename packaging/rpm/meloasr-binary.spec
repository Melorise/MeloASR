Name:           meloasr
Version:        %{meloasr_version}
Release:        1%{?dist}
Summary:        Web-backed voice input for Fcitx5
License:        LicenseRef-Proprietary
URL:            https://example.invalid/meloasr
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
/usr/lib*/fcitx5/libmeloasr.so
/usr/share/applications/meloasr.desktop
/usr/share/pixmaps/meloasr.png
/usr/share/metainfo/meloasr.metainfo.xml
/usr/share/fcitx5/addon/meloasr.conf
/etc/xdg/autostart/meloasr.desktop

%changelog
* Sun Aug 23 2026 MeloASR contributors - 0.1.0-1
- Initial package
