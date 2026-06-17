#!/usr/bin/env bash
#
# test-forms.sh - Om Sacred Space form test harness
#
# Two layers:
#   1) AUTOMATED  - safe health check. No POST, no submission, no email.
#   2) HUMAN LOOP - opt-in real submission (--live). Sends ONE real email
#                   and uses ONE free-tier slot. You run this deliberately.
#
# Usage:
#   ./scripts/test-forms.sh                 # safe checks only (default)
#   ./scripts/test-forms.sh --live you+test@example.com
#
set -euo pipefail

FORM_ID="xkopkvpp"
ENDPOINT="https://formspree.io/f/${FORM_ID}"

bar() { printf '%s\n' "------------------------------------------------------------"; }

echo
bar
echo "  OM SACRED SPACE - FORM TEST HARNESS"
echo "  endpoint: ${ENDPOINT}"
bar
echo

# ---------------------------------------------------------------------------
# LAYER 1 - AUTOMATED SAFE CHECK  (HEAD request: never creates a submission)
# ---------------------------------------------------------------------------
echo "[1/2] AUTOMATED  health check (no email, no submission)"
echo

code="$(curl -sS -o /dev/null -w '%{http_code}' -I "${ENDPOINT}" || echo '000')"

echo "      HTTP status from HEAD : ${code}"
case "${code}" in
  000) echo "      RESULT : UNREACHABLE  - DNS/TLS/network problem." ;;
  2*|400|405)
       echo "      RESULT : LIVE  - endpoint reachable and routing."
       echo "               (400/405 on a bare HEAD is expected: no form data sent.)" ;;
  404) echo "      RESULT : NOT FOUND  - form ID may be wrong/deleted." ;;
  *)   echo "      RESULT : check manually - unexpected status." ;;
esac
echo

# ---------------------------------------------------------------------------
# LAYER 2 - HUMAN-IN-THE-LOOP  (real submission, only with --live)
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--live" ]]; then
  TEST_EMAIL="${2:-}"
  if [[ -z "${TEST_EMAIL}" ]]; then
    echo "      --live needs an address you control:"
    echo "      ./scripts/test-forms.sh --live you+test@example.com"
    exit 1
  fi
  echo "[2/2] HUMAN LOOP  real submission to live form"
  echo "      WARNING: sends a REAL email to the site owner's inbox"
  echo "               and consumes ONE free-tier submission."
  read -r -p "      Type YES to proceed: " confirm
  if [[ "${confirm}" != "YES" ]]; then echo "      Aborted."; exit 0; fi

  resp="$(curl -sS -X POST "${ENDPOINT}" \
            -H 'Accept: application/json' \
            -d "email=${TEST_EMAIL}" \
            -d "_subject=TEST - form harness probe" \
            -w $'\n%{http_code}')"
  echo "      response: ${resp}"
  echo
  echo "      NEXT (human): check the destination inbox."
  echo "        - email arrives  -> that inbox IS the recipient"
  echo "        - nothing in 5m  -> recipient is a different address"
else
  echo "[2/2] HUMAN LOOP  skipped (safe mode)."
  echo "      To run the real end-to-end test deliberately:"
  echo "        ./scripts/test-forms.sh --live you+test@example.com"
fi
echo
bar
echo "  Reminder: the recipient email is NOT in the codebase."
echo "  Confirm it in the Formspree dashboard for form ${FORM_ID}."
bar
echo
