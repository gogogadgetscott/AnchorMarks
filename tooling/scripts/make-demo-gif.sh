#!/usr/bin/env bash
set -euo pipefail

OUT="apps/client/public/images/anchormarks_demo.gif"
IMG1="apps/client/public/images/anchormarks_dashboard_1765737807089.png"
IMG2="apps/client/public/images/anchormarks_search_1765737823968.png"
IMG3="apps/client/public/images/anchormarks_mobile_1765737840238.png"

if [[ ! -f "$IMG1" || ! -f "$IMG2" || ! -f "$IMG3" ]]; then
  echo "Missing screenshots; expected:"
  echo "  $IMG1"
  echo "  $IMG2"
  echo "  $IMG3"
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

if command -v convert >/dev/null 2>&1; then
  echo "Using ImageMagick convert to create GIF..."
  convert -delay 150 -loop 0 "$IMG1" "$IMG2" "$IMG3" "$OUT"
  echo "Created $OUT"
  exit 0
fi

if command -v ffmpeg >/dev/null 2>&1; then
  echo "Using ffmpeg to create GIF..."
  ffmpeg -y -loop 1 -t 2 -i "$IMG1" -loop 1 -t 2 -i "$IMG2" -loop 1 -t 2 -i "$IMG3" \
    -filter_complex "[0:v][1:v][2:v]concat=n=3:v=1:a=0,scale=720:-1,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
    "$OUT"
  echo "Created $OUT"
  exit 0
fi

if command -v node >/dev/null 2>&1; then
  echo "Using Node.js generator to create GIF..."
  node tooling/scripts/make-demo-gif.js && exit 0
fi

cat <<EOF
Neither ImageMagick (convert) nor ffmpeg is installed, and Node.js GIF fallback failed.
Install one of them and re-run:
  sudo apt install imagemagick
  # or
  sudo apt install ffmpeg
EOF
exit 2
