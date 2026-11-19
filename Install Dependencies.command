#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Installing and verifying WebGuide AI. First setup needs internet and several GB of downloads."
/bin/bash "./Start WebGuide.command" --check --no-browser
echo "Setup verified. Double-click Start WebGuide.command to use the app."
