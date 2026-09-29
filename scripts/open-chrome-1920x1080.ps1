<#
  Starts the Vite dev server and opens it in a normal Chrome window
  (title bar, tabs, toolbar all visible) sized 1920x1080. Pure
  dev-environment tooling - does not touch any application code,
  layout, or CSS.

  Usage:
    npm run dev:1920      (normal window, sized 1920x1080)

  Notes on precision:
    - Chrome's "--window-size" is expressed in device-independent pixels
      (DIPs), i.e. it is scaled by the Windows display-scaling setting.
      On a monitor running at 150% scaling, asking for 1920x1080 actually
      requests ~2880x1620 physical pixels, which usually doesn't fit the
      screen and gets silently clamped/resized. "-ForceScale1" (on by
      default) passes --force-device-scale-factor=1 so DIPs map 1:1 to
      physical pixels, giving an actual 1920x1080 window regardless of
      monitor scaling.
    - This is a NORMAL window, not kiosk/fullscreen: title bar, tabs and
      toolbar stay visible, so the page's own content area is slightly
      shorter than 1080px (browser chrome eats some vertical space).
    - Chrome is single-instance per user-data-dir: if a normal Chrome
      window is already open, launching chrome.exe again just asks that
      existing process to open a new tab/window and SILENTLY IGNORES
      --window-size/--force-device-scale-factor (those only take effect
      when a new browser process is created). To guarantee they apply
      every time, this script launches with a dedicated --user-data-dir,
      forcing a separate Chrome process regardless of what's already
      open. It also calls chrome.exe by its FULL PATH - the bare
      "chrome" command resolves through Windows' App Paths registry
      key, which on this machine redirects to the already-running
      instance and drops all arguments.
#>
param(
  [int]$Port = 5173,
  [bool]$ForceScale1 = $true
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:$Port"

Write-Host "Starting Vite dev server on $url ..."
Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $projectRoot -WindowStyle Normal

Write-Host "Waiting for dev server to respond..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $ready = $true; break }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}
if (-not $ready) {
  Write-Warning "Dev server did not respond on $url after 30s - opening Chrome anyway (it may show a connection error; refresh once the server is up)."
}

$profileDir = Join-Path $env:TEMP "chrome-dev-1920x1080-profile"
$chromeArgs = @(
  "--new-window",
  "--user-data-dir=$profileDir",
  "--no-first-run",
  "--no-default-browser-check",
  "--window-position=0,0",
  "--window-size=1920,1080"
)
if ($ForceScale1) { $chromeArgs += "--force-device-scale-factor=1" }
$chromeArgs += $url

# Full paths only - deliberately NOT including the bare "chrome" command.
# On this machine it resolves through Windows' App Paths registry key to
# the already-running default-profile instance, which silently swallows
# all of the arguments above.
$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$launched = $false
foreach ($candidate in $candidates) {
  if (-not (Test-Path $candidate)) { continue }
  try {
    Start-Process -FilePath $candidate -ArgumentList $chromeArgs -ErrorAction Stop
    $launched = $true
    break
  } catch {
    continue
  }
}

if (-not $launched) {
  Write-Error "Could not find Chrome. Install it, or open manually with:`nchrome.exe $($chromeArgs -join ' ')"
  exit 1
}

$modeLabel = "normal window, 1920x1080"
if ($ForceScale1) { $modeLabel += ", scale-factor forced to 1" }
Write-Host "Chrome launched at $url with $modeLabel."
