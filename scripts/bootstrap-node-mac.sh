#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
base="$PWD/.webguide-local"
mkdir -p "$base/downloads"
if [ -x "$base/node/bin/node" ] && [ "$("$base/node/bin/node" -p 'process.versions.node')" = "24.22.3" ]; then exit 0; fi
case "$(uname -m)" in
  arm64) arch=arm64; expected=ff6e17d4874b76d272212b908cc020d6e815fba5a6c7eaaa06add725840307fd ;;
  x86_64) arch=x64; expected=977614af0504c81045e7fd85596dbca0e5f951b96681516dadafedcca8c447f7 ;;
  *) echo "Unsupported Mac architecture."; exit 1 ;;
esac
asset="node-v24.22.3-darwin-$arch.tar.gz"
archive="$base/downloads/$asset"
echo "Preparing private Node.js 24.22.3; no system installation or administrator password."
if [ ! -f "$archive" ] || [ "$(shasum -a 256 "$archive" | cut -d ' ' -f 1)" != "$expected" ]; then
  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --connect-timeout 30 --max-time 1800 --output "$archive" "https://nodejs.org/dist/v24.22.3/$asset"
fi
if [ "$(shasum -a 256 "$archive" | cut -d ' ' -f 1)" != "$expected" ]; then echo "Node checksum failed; nothing executed. Relaunch to retry."; exit 1; fi
stage="$(mktemp -d "$base/node-stage-XXXXXX")"
tar -xzf "$archive" -C "$stage" --strip-components=1
[ -x "$stage/bin/node" ] || { echo "Unexpected Node archive layout."; exit 1; }
if [ -e "$base/node" ]; then mv "$base/node" "$base/node-previous-$(date +%s)"; fi
mv "$stage" "$base/node"
