#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx supabase login
npx supabase functions deploy --project-ref tvycfhrbdtyxmyeymdgo --no-verify-jwt --use-api
