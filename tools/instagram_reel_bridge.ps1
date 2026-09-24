param(
  [switch]$Setup,
  [string[]]$Url,
  [string]$Profile = "$env:USERPROFILE\.content-control\instagram-profile",
  [string]$Out = "$PSScriptRoot\..\reel-captures"
)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path "$PSScriptRoot\.."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required."
}
Push-Location $repo
try {
  if (-not (Test-Path "node_modules\playwright")) {
    npm install --no-audit --no-fund
  }

  $argsList = @("tools/instagram_reel_bridge.mjs", "--profile", $Profile, "--out", $Out)
  if ($Setup) {
    $argsList += "--setup"
  } else {
    if (-not $Url -or $Url.Count -eq 0) {
      throw "Provide -Url with one or more Instagram Reel links, or use -Setup."
    }
    foreach ($u in $Url) {
      $argsList += @("--url", $u)
    }
  }

  & node @argsList
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  Pop-Location
}
