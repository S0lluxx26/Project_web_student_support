#!/usr/bin/env bash
#
# Run the student housing safety demo. macOS and Linux; Windows uses run.ps1.
#
#   ./demo/run.sh             serve the site and open a browser (manual demo)
#   ./demo/run.sh --report    run every screenshot through the real pipeline
#                             and write demo/report.html
#   ./demo/run.sh --port 9000
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

REPORT=0
PORT=8000
OPEN=1
while [ $# -gt 0 ]; do
  case "$1" in
    --report)  REPORT=1 ;;
    --port)    PORT="$2"; shift ;;
    --no-open) OPEN=0 ;;
    -h|--help) sed -n '3,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  node was not found on PATH."
  echo "  Install it from https://nodejs.org (LTS is fine) and try again."
  echo
  exit 1
fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "  node $(node --version) is too old; this needs 18 or newer." >&2
  exit 1
fi
if [ ! -d demo/screenshots ]; then
  echo "  demo/screenshots is missing." >&2
  echo "  Regenerate it with:  python3 demo/make-demo-screenshots.py" >&2
  exit 1
fi

if [ "$REPORT" = "1" ]; then
  echo
  echo "  Running every demo screenshot through the real pipeline."
  echo "  First run installs Playwright and a Chromium build; that part is slow."
  echo
  # --no-save keeps the repo free of a package.json it does not otherwise need.
  npm install --no-save playwright
  # CHROMIUM_PATH points at a Chromium you already have, and skips a download
  # of a few hundred megabytes. Useful on a machine behind a proxy that blocks
  # Playwright's CDN, which is where this script's first failure usually is.
  if [ -z "${CHROMIUM_PATH:-}" ]; then
    npx playwright install chromium
  else
    echo "  using CHROMIUM_PATH=$CHROMIUM_PATH (skipping the browser download)"
  fi
  node demo/run-demo.mjs
  echo
  echo "  Report: $(pwd)/demo/report.html"
  if [ "$OPEN" = "1" ]; then
    if   command -v open     >/dev/null 2>&1; then open demo/report.html
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open demo/report.html
    fi
  fi
  exit 0
fi

cat <<EOF

  Serving the site on http://localhost:$PORT/

  To demo the screenshot reader:
    1. Open  http://localhost:$PORT/#/housing/conversation
    2. Expand  '스크린샷에서 글자 읽기'
    3. Choose a file from  demo/screenshots/
    4. Wait — the FIRST run downloads the recognition model (~6MB).
    5. Check the text in the review box, then press  '대화에 추가'
    6. Press  '분석하기'

  Start with 01-kakao-pressure.jpg, then 02-kakao-ordinary.jpg —
  02 should come back with NO warnings. That one matters most.

EOF

if [ "$OPEN" = "1" ]; then
  exec node demo/serve.mjs --port "$PORT" --open
else
  exec node demo/serve.mjs --port "$PORT"
fi
