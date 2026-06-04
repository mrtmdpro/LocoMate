#!/usr/bin/env bash
#
# Re-encode oversized brand raster images in place.
#
# Resolves the Cluster E / Perf C2 finding: ~100 atom JPEGs were committed at
# 2.5-3 MB each (245 MB total) and served to mobile thumbnails. They are already
# <=1600px on the long edge, so the bloat is pure encoding overhead. This script
# re-encodes every JPEG/PNG under public/brand that exceeds the size budget down
# to a <=1600px, quality-72 JPEG master. next/image then derives per-device
# WebP/AVIF variants at request time, so these masters never ship as-is.
#
# Idempotent: already-small files are skipped, so re-runs are cheap and safe.
# Uses macOS `sips` (always present, no dependency footprint).
#
# Usage:  bash scripts/optimize-brand-images.sh [target_dir] [max_kb] [max_px] [quality]

set -euo pipefail

DIR="${1:-public/brand}"
MAX_KB="${2:-400}"
MAX_PX="${3:-1600}"
QUALITY="${4:-72}"

if ! command -v sips >/dev/null 2>&1; then
  echo "error: sips not found (this script targets macOS)." >&2
  exit 1
fi

before_total=0
after_total=0
optimized=0
skipped=0

while IFS= read -r -d '' f; do
  size_kb=$(( $(stat -f%z "$f") / 1024 ))
  before_total=$(( before_total + size_kb ))

  if (( size_kb <= MAX_KB )); then
    after_total=$(( after_total + size_kb ))
    skipped=$(( skipped + 1 ))
    continue
  fi

  tmp="${f}.opt.tmp"
  sips -s format jpeg -s formatOptions "$QUALITY" -Z "$MAX_PX" "$f" --out "$tmp" >/dev/null 2>&1
  new_kb=$(( $(stat -f%z "$tmp") / 1024 ))

  # Guard: only replace if we actually shrank the file.
  if (( new_kb < size_kb )); then
    mv "$tmp" "$f"
    after_total=$(( after_total + new_kb ))
    optimized=$(( optimized + 1 ))
    printf '  %-70s %5d KB -> %4d KB\n' "$(basename "$f")" "$size_kb" "$new_kb"
  else
    rm -f "$tmp"
    after_total=$(( after_total + size_kb ))
    skipped=$(( skipped + 1 ))
  fi
done < <(find "$DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print0)

echo
echo "optimized: $optimized   skipped: $skipped"
echo "total: ${before_total} KB -> ${after_total} KB"
