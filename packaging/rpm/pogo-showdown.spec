Name:           pogo-showdown
Version:        %{pogo_version}
Release:        1%{?dist}
Summary:        Open-world pogo action game: dig, build, duel, trick, dash and fight
License:        LicenseRef-Proprietary
URL:            https://github.com/9x25dillon/pogo-showdown
BuildArch:      noarch
Source0:        pogo-showdown-%{version}.tar.gz
Requires:       python3
Requires:       curl
Recommends:     xdg-utils

%description
Pogo Showdown is a single open world, the Forever Realm, where history's icons
are highschoolers with a pogo stick. Dig and build Terraria-style, fight
through four elemental realms to the Forever Gate, duel pog players in the
Schoolyard, land yoyo tricks in combat, bounce through Dash Trials, climb the
Circuit Arena and step through Pog Quest rifts. Plays in your browser from a
local copy; saves stay on this machine. Keyboard, mouse and Xbox controllers.

%prep
%setup -q -n pogo-showdown-%{version}

%build
# prebuilt web game (npm run build)

%install
install -d %{buildroot}%{_datadir}/pogo-showdown
cp -a dist/. %{buildroot}%{_datadir}/pogo-showdown/
install -Dm755 pogo-showdown.sh %{buildroot}%{_bindir}/pogo-showdown
install -Dm644 pogo-showdown.desktop %{buildroot}%{_datadir}/applications/pogo-showdown.desktop
install -Dm644 pogo-showdown.svg %{buildroot}%{_datadir}/icons/hicolor/scalable/apps/pogo-showdown.svg

%files
%{_bindir}/pogo-showdown
%{_datadir}/pogo-showdown
%{_datadir}/applications/pogo-showdown.desktop
%{_datadir}/icons/hicolor/scalable/apps/pogo-showdown.svg

%changelog
* Mon Sep 28 2026 9x25dillon <deathmilk@gmail.com> - 0.5.0-1
- The Forever Realm becomes the whole game: hero levels, pog gear, duelists,
  yoyo tricks, pogo stick and Dash Trials, the Circuit Arena and Quest Rifts.
