$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server 8000
    exit $LASTEXITCODE
}

if (Get-Command py -ErrorAction SilentlyContinue) {
    py -m http.server 8000
    exit $LASTEXITCODE
}

Write-Error "No Python runtime was found. Install Python or run the site from another static server."
