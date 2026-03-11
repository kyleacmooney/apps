#!/usr/bin/env bash
# Sync local branch with origin, using Claude to resolve conflicts.
# Mirrors the CI auto-merge strategy: ff-only → rebase → Claude conflict resolution.
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "Syncing $BRANCH with origin/$BRANCH..."

git fetch --prune

# Try fast-forward first
if git pull --ff-only 2>/dev/null; then
  echo "Fast-forwarded to origin/$BRANCH."
  exit 0
fi

echo "⟳ Fast-forward failed, rebasing..."

# Try rebase — autostash handles dirty working tree
if git pull --rebase --autostash 2>/dev/null; then
  echo "Rebased onto origin/$BRANCH."
  exit 0
fi

echo "⚡ Rebase conflicts detected — invoking Claude to resolve..."

claude -p "A git rebase has conflicts. Please:
1. Run \`git diff --name-only --diff-filter=U\` to find conflicted files
2. Read each conflicted file and resolve the merge conflicts intelligently — keep both sides' intent where possible
3. Stage each resolved file with \`git add <file>\`
4. Run \`GIT_EDITOR=true git rebase --continue\` to finish the rebase
If the rebase has multiple conflicting commits, repeat until done." \
  --max-turns 15 --model claude-sonnet-4-6 --allowedTools "Bash,Read,Edit,Grep"

if [ $? -eq 0 ]; then
  echo "Sync complete — Claude resolved all conflicts."
else
  echo "Claude could not resolve all conflicts. Run 'git rebase --abort' to start over, or resolve manually."
  exit 1
fi
