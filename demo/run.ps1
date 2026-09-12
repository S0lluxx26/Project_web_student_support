<#
.SYNOPSIS
    Run the student housing safety demo.

.DESCRIPTION
    Two ways to look at it.

        .\demo\run.ps1              serve the site and open a browser (manual demo)
        .\demo\run.ps1 -Report      run every demo screenshot through the real
                                    pipeline and open an HTML report

    The manual mode is the one to use in front of people: you drop a screenshot
    in and watch the review pane fill. The report mode is for checking, after a
    change, that the output did not quietly get worse.

.PARAMETER Report
    Run the headless report instead of serving. Installs Playwright and a
    Chromium build on first use (a few hundred MB, into node_modules).

.PARAMETER Port
    Port for the manual demo. Default 8000.

.PARAMETER NoOpen
    Do not launch a browser.
#>
[CmdletBinding()]
param(
    [switch]$Report,
    [int]$Port = 8000,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
# The script lives in demo/; everything below is relative to the repo root.
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Require-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host ""
        Write-Host "  node was not found on PATH." -ForegroundColor Red
        Write-Host "  Install it from https://nodejs.org (LTS is fine), reopen PowerShell, and try again."
        Write-Host ""
        exit 1
    }
    $v = (& node --version).TrimStart('v').Split('.')[0]
    if ([int]$v -lt 18) {
        Write-Host "  node $(& node --version) is too old; this needs 18 or newer." -ForegroundColor Red
        exit 1
    }
}

Require-Node

if (-not (Test-Path (Join-Path $repo 'demo\screenshots'))) {
    Write-Host "  demo\screenshots is missing." -ForegroundColor Red
    Write-Host "  Regenerate it with:  python demo\make-demo-screenshots.py"
    exit 1
}

if ($Report) {
    Write-Host ""
    Write-Host "  Running every demo screenshot through the real pipeline." -ForegroundColor Cyan
    Write-Host "  First run installs Playwright and a Chromium build; that part is slow."
    Write-Host ""

    # --no-save keeps the repo free of a package.json it does not otherwise need.
    & npm install --no-save playwright
    if ($LASTEXITCODE -ne 0) { Write-Host "  npm install failed." -ForegroundColor Red; exit 1 }
    # CHROMIUM_PATH points at a Chromium you already have and skips a download
    # of a few hundred megabytes — useful behind a proxy that blocks
    # Playwright's CDN, which is where this usually fails first.
    if (-not $env:CHROMIUM_PATH) {
        & npx playwright install chromium
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Browser download failed." -ForegroundColor Red
            Write-Host "  If you already have Chrome or Chromium, point at it instead:"
            Write-Host '    $env:CHROMIUM_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"'
            Write-Host "  then run this again."
            exit 1
        }
    } else {
        Write-Host "  Using CHROMIUM_PATH=$env:CHROMIUM_PATH (skipping the download)"
    }

    & node demo\run-demo.mjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $report = Join-Path $repo 'demo\report.html'
    Write-Host ""
    Write-Host "  Report: $report" -ForegroundColor Green
    if (-not $NoOpen) { Start-Process $report }
    exit 0
}

Write-Host ""
Write-Host "  Serving the site on http://localhost:$Port/" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To demo the screenshot reader:" -ForegroundColor Yellow
Write-Host "    1. Open  http://localhost:$Port/#/housing/conversation"
Write-Host "    2. Expand  '스크린샷에서 글자 읽기'"
Write-Host "    3. Choose a file from  demo\screenshots\"
Write-Host "    4. Wait — the FIRST run downloads the recognition model (~6MB)."
Write-Host "    5. Check the text in the review box, then press  '대화에 추가'"
Write-Host "    6. Press  '분석하기'"
Write-Host ""
Write-Host "  Start with 01-kakao-pressure.jpg, then 02-kakao-ordinary.jpg —" -ForegroundColor Yellow
Write-Host "  02 should come back with NO warnings. That one matters most."
Write-Host ""

$serveArgs = @('demo\serve.mjs', '--port', "$Port")
if (-not $NoOpen) { $serveArgs += '--open' }
& node $serveArgs
