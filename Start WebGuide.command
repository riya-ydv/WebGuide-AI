#!/bin/bash
set -euo pipefail
if [ "$(uname -s)" != "Darwin" ]; then
  echo "This launcher is for a Mac. On Windows use Start WebGuide.bat."
  exit 1
fi
mac_major="$(/usr/bin/sw_vers -productVersion | cut -d . -f 1)"
if [ "$mac_major" -lt 14 ]; then
  echo "WebGuide local AI requires macOS 14 or newer. Please update macOS first."
  read -r -p "Press Return to close." unused
  exit 1
fi
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
cd "$(dirname "$0")"
if ! /bin/bash scripts/bootstrap-node-mac.sh; then
  echo "Setup could not finish. Check the message above and your internet connection."
  read -r -p "Press Return to close." unused
  exit 1
fi
"$PWD/.webguide-local/node/bin/node" scripts/launch-webguide.mjs "$@" || { read -r -p "Press Return to close." unused; exit 1; }
