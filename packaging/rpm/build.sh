#!/bin/sh
# Build the RPM inside a Fedora container (the host needs only Docker and a prior `npm run build`).
# Output: packaging/rpm/out/pogo-showdown-<version>-1.noarch.rpm
set -eu
cd "$(dirname "$0")/../.."
VERSION=$(node -p "require('./package.json').version")
[ -f dist/index.html ] || { echo "run npm run build first" >&2; exit 1; }
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/pogo-showdown-$VERSION"
cp -a dist LICENSE LICENSE-MUSIC packaging/rpm/pogo-showdown.sh packaging/rpm/pogo-showdown.desktop packaging/rpm/pogo-showdown.svg "$STAGE/pogo-showdown-$VERSION/"
tar -C "$STAGE" -czf "$STAGE/pogo-showdown-$VERSION.tar.gz" "pogo-showdown-$VERSION"
mkdir -p packaging/rpm/out
docker run --rm -v "$STAGE:/src:ro" -v "$PWD/packaging/rpm:/pkg" fedora:42 sh -c "
  dnf -y -q install rpm-build >/dev/null &&
  mkdir -p /root/rpmbuild/SOURCES && cp /src/pogo-showdown-$VERSION.tar.gz /root/rpmbuild/SOURCES/ &&
  rpmbuild -bb --define 'pogo_version $VERSION' --define 'dist %{nil}' /pkg/pogo-showdown.spec &&
  cp /root/rpmbuild/RPMS/noarch/*.rpm /pkg/out/ && chown $(id -u):$(id -g) /pkg/out/*.rpm"
ls -la packaging/rpm/out
