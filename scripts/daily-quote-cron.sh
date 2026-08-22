#!/bin/bash
#
# The daily quote, once a day, in both languages.
#
# Picks today's quote with scripts/daily-quote-select.mjs (deterministic: the
# day of the year modulo the length of scripts/daily-quotes.json), then calls
# scripts/send-daily-quote.mjs twice — once for the daily-quote-ru topic and
# once for daily-quote-en.
#
# Idempotent per day. The day is claimed in the state file BEFORE the pushes
# go out, so a crash between the two sends cannot produce a second run that
# pushes to everyone again. A day whose send failed is a lost day, not a
# retried one; the log line says which.
#
# Every decision lives in daily-quote-schedule.mjs, which the jest suite covers
# (scripts/daily-quote-schedule.test.ts). This file only moves strings.
#
# Usage:
#   scripts/daily-quote-cron.sh          # the real thing — sends two pushes
#   scripts/daily-quote-cron.sh --dry    # print today's pick, send nothing
#
# Run by ~/Library/LaunchAgents/ai.t27.leela.dailyquote.plist at 06:00 local.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEELA_HOME="${LEELA_HOME:-$HOME/.leela}"
STATE="$LEELA_HOME/daily-quote-state.json"
LOG="$LEELA_HOME/daily-quote.log"
NODE_BIN="${NODE_BIN:-node}"
SELECT="$REPO/scripts/daily-quote-select.mjs"
# SEND_SCRIPT exists so the send path can be rehearsed against a stub. Nothing
# but a rehearsal should ever set it.
SEND="${SEND_SCRIPT:-$REPO/scripts/send-daily-quote.mjs}"

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

mkdir -p "$LEELA_HOME"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$1" >>"$LOG"
}

# ---------------------------------------------------------------------------
# Ask the selector what today is.
# ---------------------------------------------------------------------------
if ! DECISION="$("$NODE_BIN" "$SELECT" --state "$STATE" --format env 2>&1)"; then
  log "ERROR selection failed: $(printf '%s' "$DECISION" | tr '\n' ' ')"
  printf '%s\n' "$DECISION" >&2
  exit 1
fi

send=0 day='' id='' reason='' ru_title='' ru_body='' en_title='' en_body=''
while IFS='=' read -r key value; do
  case "$key" in
    send) send="$value" ;;
    date) day="$value" ;;
    id) id="$value" ;;
    reason) reason="$value" ;;
    ru_title) ru_title="$value" ;;
    ru_body) ru_body="$value" ;;
    en_title) en_title="$value" ;;
    en_body) en_body="$value" ;;
  esac
done <<EOF
$DECISION
EOF

if [ -z "$id" ]; then
  log "ERROR selection produced no quote id"
  exit 1
fi

# ---------------------------------------------------------------------------
# Dry run: show the pick, touch nothing.
# ---------------------------------------------------------------------------
if [ "$DRY" = 1 ]; then
  "$NODE_BIN" "$SELECT" --state "$STATE" --dry
  log "DRY $day $id would-send=$send ($reason)"
  exit 0
fi

# ---------------------------------------------------------------------------
# Already handled today? Then say so and send nothing.
# ---------------------------------------------------------------------------
if [ "$send" != "1" ]; then
  log "SKIP $day $id — $reason"
  echo "nothing sent: $reason"
  exit 0
fi

# ---------------------------------------------------------------------------
# Claim the day first, then send. Fail-closed: never push twice.
# ---------------------------------------------------------------------------
if ! "$NODE_BIN" "$SELECT" --state "$STATE" --commit --status sending >/dev/null; then
  log "ERROR $day $id could not claim the day; sent nothing"
  exit 1
fi

outcome=sent
if ! "$NODE_BIN" "$SEND" --lang ru --title "$ru_title" --body "$ru_body"; then
  outcome=failed-ru
fi

if [ "$outcome" = sent ]; then
  if ! "$NODE_BIN" "$SEND" --lang en --title "$en_title" --body "$en_body"; then
    outcome=failed-en-after-ru
  fi
fi

"$NODE_BIN" "$SELECT" --state "$STATE" --commit --status "$outcome" >/dev/null

if [ "$outcome" = sent ]; then
  log "SENT $day $id ru+en"
  echo "sent $id for $day (ru + en)"
  exit 0
fi

log "ERROR $day $id $outcome — the day is spent, no retry"
echo "send failed: $outcome" >&2
exit 1
