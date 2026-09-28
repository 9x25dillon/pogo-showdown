#!/bin/sh
# Pogo Showdown launcher: serves the installed game on localhost and opens it in your browser.
# The port is fixed on purpose: browser saves (IndexedDB) belong to one origin, so a new port
# every launch would look like a new player. Override with POGO_PORT if 47219 is taken.
PORT="${POGO_PORT:-47219}"
ROOT=/usr/share/pogo-showdown
URL="http://127.0.0.1:${PORT}/"

if ! curl -fsS -o /dev/null "$URL" 2>/dev/null; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS -o /dev/null "$URL" 2>/dev/null && break
    sleep 0.3
  done
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
else
  echo "Pogo Showdown is running at $URL"
fi
