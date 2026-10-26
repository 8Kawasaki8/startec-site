#!/usr/bin/env sh
# Publish guard for Star.Tec.Solutions (opt-in git pre-push hook).
#
# docs/ is what GitHub Pages serves. This hook refuses a push that changes docs/ on the
# Pages branch unless .qa/report.json is green and was produced for the commit being pushed.
# Waves build on 'v5'; main's docs/ stays frozen until WP-15 (set STS_RELEASE=1 to release).
#
# Install (once, per clone):   git config core.hooksPath scripts/qa/hooks
#   or:                         ln -s ../../scripts/qa/prepush.sh .git/hooks/pre-push
# Configure the Pages branch:   git config sts.pagesBranch main   (default: main)
# Dry run without git:          scripts/qa/prepush.sh --check   (STS_QA_REPORT=pad overschrijft het rapportpad)
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REPORT="${STS_QA_REPORT:-$ROOT/.qa/report.json}"
PAGES_BRANCH="${STS_PAGES_BRANCH:-$(git -C "$ROOT" config --get sts.pagesBranch 2>/dev/null || echo main)}"
ZERO="0000000000000000000000000000000000000000"

say() { printf '%s\n' "$*" >&2; }

report_status() {
  # prints: <status> <commit> <generated>; 'missing' when there is no report
  if [ ! -f "$REPORT" ]; then echo "missing - -"; return; fi
  python3 -I - "$REPORT" <<'PY'
import json, sys
try:
    r = json.load(open(sys.argv[1], encoding="utf-8"))
    s = r.get("summary", {})
    status = s.get("status") or ("green" if not s.get("fail") and not s.get("lintFails") else "red")
    if r.get("matrix", {}).get("quick"):
        status = "quick"
    elif r.get("matrix", {}).get("partial"):
        status = "partial"
    print(status, r.get("commit") or "-", r.get("generated") or "-")
except Exception as e:
    print("broken - -")
PY
}

check_report() {
  head="$1"
  set -- $(report_status)
  rstatus="$1"; commit="$2"; generated="$3"
  case "$rstatus" in
    green) ;;
    quick) say "QA: .qa/report.json komt van 'npm run qa:quick' ($generated). Draai 'npm run qa' voor een volledige matrix."; return 1 ;;
    partial) say "QA: .qa/report.json komt van een deelrun (--pages, --profile, --mode of --variant) ($generated). Draai 'npm run qa' zonder selectie."; return 1 ;;
    missing) say "QA: geen .qa/report.json. Draai eerst 'npm run build && npm run qa'."; return 1 ;;
    broken) say "QA: .qa/report.json is niet leesbaar. Draai 'npm run qa' opnieuw."; return 1 ;;
    *) say "QA: rapport is ROOD ($generated). Los de fouten op en draai 'npm run qa' opnieuw; docs/ wordt niet gepusht."; return 1 ;;
  esac
  if [ "$commit" != "-" ] && [ "$commit" != "$head" ]; then
    say "QA: het groene rapport hoort bij commit ${commit} maar je pusht ${head}. Draai 'npm run build && npm run qa' op deze commit."
    return 1
  fi
  say "QA: rapport groen voor ${head} ($generated)."
  return 0
}

if [ "${1:-}" = "--check" ]; then
  head="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo -)"
  check_report "$head"
  exit $?
fi

# git pre-push: stdin lines are "<local ref> <local sha> <remote ref> <remote sha>"
status=0
while read -r local_ref local_sha remote_ref remote_sha; do
  [ -n "$local_ref" ] || continue
  [ "$local_sha" = "$ZERO" ] && continue                       # branch delete
  remote_branch="${remote_ref#refs/heads/}"
  [ "$remote_branch" = "$PAGES_BRANCH" ] || continue            # only the Pages branch is guarded
  if [ "$remote_sha" = "$ZERO" ]; then range="$local_sha"; else range="$remote_sha..$local_sha"; fi
  if ! git -C "$ROOT" diff --quiet "$range" -- docs/ 2>/dev/null; then
    say "pre-push: deze push wijzigt docs/ op '$PAGES_BRANCH' (wat GitHub Pages serveert)."
    if [ "$PAGES_BRANCH" = "main" ] && [ -z "${STS_RELEASE:-}" ]; then
      say "pre-push: docs/ op main is bevroren tot WP-15. Zet STS_RELEASE=1 bij de release, pas na een groen rapport."
      status=1
      continue
    fi
    check_report "$local_sha" || status=1
  fi
done
exit $status
