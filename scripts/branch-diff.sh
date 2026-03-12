#!/usr/bin/env bash
# Show local vs remote branch sync and differences between dev and main.
set -euo pipefail

# ANSI colors (no color if not a TTY)
if [ -t 1 ]; then
  C_RESET='\033[0m'
  C_DIM='\033[2m'
  C_BOLD='\033[1m'
  C_CYAN='\033[36m'
  C_GREEN='\033[32m'
  C_YELLOW='\033[33m'
  C_RED='\033[31m'
else
  C_RESET= C_DIM= C_BOLD= C_CYAN= C_GREEN= C_YELLOW= C_RED=
fi

git fetch origin dev main 2>/dev/null || true

section() {
  echo ""
  echo -e "${C_BOLD}${C_CYAN}━━ $* ${C_RESET}"
}

report() {
  local branch=$1
  if ! git rev-parse "origin/$branch" &>/dev/null; then
    echo -e "  ${C_DIM}$branch: no origin/$branch${C_RESET}"
    return
  fi
  if ! git rev-parse "$branch" &>/dev/null; then
    echo -e "  ${C_DIM}$branch: no local $branch${C_RESET}"
    return
  fi
  local counts
  counts=$(git rev-list --left-right --count "origin/$branch...$branch" 2>/dev/null)
  local behind ahead
  behind=$(echo "$counts" | cut -f1)
  ahead=$(echo "$counts" | cut -f2)
  if [ "$behind" -eq 0 ] && [ "$ahead" -eq 0 ]; then
    echo -e "  ${C_GREEN}$branch ↔ origin/$branch: in sync${C_RESET}"
  else
    echo -e "  ${C_YELLOW}$branch ↔ origin/$branch: ${ahead} ahead, ${behind} behind${C_RESET}"
  fi
}

# ---- Local vs origin ----
section "Local vs origin"
report dev
report main

# ---- dev vs main ----
section "dev vs main"
for ref in origin/dev origin/main; do
  if ! git rev-parse "$ref" &>/dev/null; then
    echo -e "  ${C_DIM}$ref not found${C_RESET}"
    continue
  fi
done
if git rev-parse origin/dev &>/dev/null && git rev-parse origin/main &>/dev/null; then
  dev_ahead=$(git rev-list --count origin/main..origin/dev 2>/dev/null || echo 0)
  main_ahead=$(git rev-list --count origin/dev..origin/main 2>/dev/null || echo 0)
  if [ "$dev_ahead" -eq 0 ] && [ "$main_ahead" -eq 0 ]; then
    echo -e "  ${C_GREEN}dev and main are even${C_RESET}"
  else
    [ "$dev_ahead" -gt 0 ] && echo -e "  ${C_YELLOW}dev is ${dev_ahead} commit(s) ahead of main${C_RESET}"
    [ "$main_ahead" -gt 0 ] && echo -e "  ${C_RED}main is ${main_ahead} commit(s) ahead of dev${C_RESET}"
    if [ "$dev_ahead" -gt 0 ]; then
      echo -e "  ${C_DIM}Commits on dev not in main:${C_RESET}"
      git log origin/main..origin/dev --oneline 2>/dev/null | sed 's/^/    /'
    fi
    if [ "$main_ahead" -gt 0 ]; then
      echo -e "  ${C_DIM}Commits on main not in dev:${C_RESET}"
      git log origin/dev..origin/main --oneline 2>/dev/null | sed 's/^/    /'
    fi
  fi
fi

echo ""
