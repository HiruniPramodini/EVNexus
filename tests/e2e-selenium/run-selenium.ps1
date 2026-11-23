# ==============================================================================
# EVNexus UI / E2E Browser Testing Runner (Selenium WebDriver / Headless Chrome)
# Owner: A.G.H. Pramodini (IT24610786) - UI / E2E Testing Specialist
# Course: SE3112 Advanced Software Engineering
# ==============================================================================

param(
    [switch]$OpenReport,
    [string]$TargetUrl = "http://localhost:5173"
)

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "   🌐 EVNexus UI / E2E Browser Testing Runner         " -ForegroundColor Yellow
Write-Host "   Student: A.G.H. Pramodini (IT24610786)             " -ForegroundColor Cyan
Write-Host "   Engine: Selenium WebDriver (Headless Chrome)       " -ForegroundColor Green
Write-Host "=======================================================`n" -ForegroundColor Cyan

$reportFile = "$PSScriptRoot\..\reports\selenium-report\index.html"

node "$PSScriptRoot\seleniumRunner.js"

if ($OpenReport -and (Test-Path $reportFile)) {
    Start-Process $reportFile
}
