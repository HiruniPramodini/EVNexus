# ==============================================================================
# EVNexus Mutation Testing Runner (Stryker.NET 4.4.1 / 5.0.0)
# Owner: K.T.L. Perera (IT24610793) - Mutation Testing Specialist
# Course: SE3112 Advanced Software Engineering
# ==============================================================================

param(
    [switch]$QuickDemo,
    [switch]$OpenReport,
    [string]$TargetFile = "AccountManagementService.cs"
)

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "   🧬 EVNexus Mutation Testing - Stryker.NET Runner   " -ForegroundColor Yellow
Write-Host "   Student: K.T.L. Perera (IT24610793)                " -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Cyan

$workspaceRoot = Resolve-Path "$PSScriptRoot\..\.."
$configPath = "$PSScriptRoot\stryker-config.json"
$reportDir = "$PSScriptRoot\..\reports\mutation"

# Ensure output directory exists
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

Push-Location "$workspaceRoot\AuthenticationService\tests\EVNexus.AuthService.Tests"
try {
    Write-Host "[1/3] Restoring .NET tools and verifying test baseline..." -ForegroundColor Green
    dotnet tool restore | Out-Null
    
    if ($QuickDemo) {
        Write-Host "[2/3] Executing FAST LIVE DEMO mutation run on $TargetFile..." -ForegroundColor Yellow
        Write-Host "      (Mutates arithmetic, equality, boolean expressions and verifies test kill rate)" -ForegroundColor DarkGray
        
        dotnet stryker `
            --mutate "$TargetFile" `
            --reporters "['progress', 'cleartext', 'html']" `
            --output "$reportDir" `
            --concurrency 4
    }
    else {
        Write-Host "[2/3] Executing Standard Mutation Testing run..." -ForegroundColor Yellow
        Write-Host "      Config: $configPath" -ForegroundColor DarkGray
        
        dotnet stryker `
            --config-file "$configPath"
    }

    Write-Host "`n[3/3] Mutation Testing Execution Finished!" -ForegroundColor Green
    $latestReport = Get-ChildItem -Path "$reportDir" -Filter "mutation-report.html" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    
    if ($latestReport) {
        Write-Host "Report generated at: $($latestReport.FullName)" -ForegroundColor Cyan
        if ($OpenReport) {
            Start-Process $latestReport.FullName
        }
    } else {
        Write-Host "Report saved in: $reportDir" -ForegroundColor Cyan
    }
}
finally {
    Pop-Location
}
