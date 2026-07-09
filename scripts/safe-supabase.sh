#!/usr/bin/env bash
set -e

echo "🛡️ Running DB Guardian pre-check..."

# Call db-guardian via Claude
claude --prompt "Invoke @db-guardian. Validate pending migration: ${1:-latest}. Output verdict to .harness/guardian-latest.json"

# Check verdict
if [ -f .harness/guardian-latest.json ]; then
  VERDICT=$(cat .harness/guardian-latest.json | jq -r '.recommendation // "Unknown"')

  if [[ "$VERDICT" == "Blocked" ]]; then
    echo "❌ Guardian blocked execution. Fix issues first."
    cat .harness/guardian-latest.json
    exit 1
  fi

  echo "✅ Guardian passed (verdict: $VERDICT). Running: supabase $*"
  supabase "$@"
else
  echo "⚠️ Guardian verdict not found. Running anyway..."
  supabase "$@"
fi
