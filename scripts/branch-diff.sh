#!/usr/bin/env bash
# Show whether local and remote dev/main branches differ.
set -euo pipefail

git fetch origin dev main 2>/dev/null || true

report() {
  local branch=$1
  if ! git rev-parse "origin/$branch" &>/dev/null; then
    echo "$branch: no origin/$branch"
    return
  fi
  if ! git rev-parse "$branch" &>/dev/null; then
    echo "$branch: no local $branch"
    return
  fi
  local counts
  counts=$(git rev-list --left-right --count "origin/$branch...$branch" 2>/dev/null)
  local behind ahead
  behind=$(echo "$counts" | cut -f1)
  ahead=$(echo "$counts" | cut -f2)
  if [ "$behind" -eq 0 ] && [ "$ahead" -eq 0 ]; then
    echo "$branch: in sync with origin/$branch"
  else
    echo "$branch: $ahead ahead, $behind behind origin/$branch"
  fi
}

echo "dev  vs origin/dev:"
report dev
echo "main vs origin/main:"
report main
