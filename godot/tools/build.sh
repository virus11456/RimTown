#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${BLENDER:=blender}"
: "${GODOT:=godot}"
: "${NODE:=node}"
# macOS Blender 3.6 can use --gpu-backend opengl when Metal is unavailable.
read -r -a blender_flags <<< "${BLENDER_FLAGS:-}"
"$BLENDER" -b --factory-startup "${blender_flags[@]}" --python-exit-code 1 -P tools/blender/build_all.py
"$GODOT" --headless --editor --import --path .
