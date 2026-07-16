#!/bin/bash
# ================================================================
# Seed Demo Data Script
# ================================================================
# Populates the database with realistic demo data for:
#   - POS checkout flow testing
#   - Demo Day presentation
#   - Inventory alerts testing
#
# Usage:
#   ./scripts/seed-demo.sh           # Run against local database
#   ./scripts/seed-demo.sh --linked  # Run against linked (remote) database
#
# Prerequisites:
#   - Supabase CLI installed
#   - For local: Local Supabase running (supabase start)
#   - For linked: Linked to remote project (supabase link)
# ================================================================

set -e

echo "☕ Seeding demo data for Myanmar Coffee Shop POS..."
echo ""

# Determine target database
TARGET="--local"
if [[ "$1" == "--linked" ]]; then
  TARGET="--linked"
  echo "📡 Targeting linked (remote) database..."
else
  # Check if supabase is running for local
  if ! npx supabase status > /dev/null 2>&1; then
    echo "⚠️  Supabase is not running. Starting it now..."
    npx supabase start
    echo ""
  fi
fi

# Run the seed file
echo "📦 Applying seed-demo-data.sql..."
npx supabase db query -f supabase/seed-demo-data.sql $TARGET

echo ""
echo "✅ Demo data seeded successfully!"
echo ""
echo "📊 Summary:"
echo "   - 6 categories"
echo "   - 28 products (2 out of stock, 2 low stock)"
echo "   - 5 customers (with credit limits)"
echo "   - 4 active discounts"
echo "   - 10 sample sales (last 7 days)"
echo ""
echo "🚀 Ready for Demo Day!"
echo ""
