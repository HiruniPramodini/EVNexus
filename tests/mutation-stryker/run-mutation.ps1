# ==============================================================================
# EVNexus Multi-Microservice Mutation Testing Runner (Stryker.NET 5.0.0)
# Owner : K.T.L. Perera (IT24610793) - Mutation Testing Specialist
# Course: SE3112 Advanced Software Engineering | Team 32
#
# Compatible with Windows PowerShell 5.1, PowerShell 7+ (pwsh), and Linux CI.
# ==============================================================================

param(
    [ValidateSet("All", "Auth", "Payment")]
    [string]$Service = "All",
    [switch]$QuickDemo,
    [switch]$OpenReport,
    [switch]$SkipRestore,
    [string]$TargetFile = "",
    [int]$Concurrency = 4
)

$ErrorActionPreference = "Stop"
$overallStart = Get-Date

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$reportRoot = Join-Path $workspaceRoot "tests\reports\mutation"
if (-not (Test-Path $reportRoot)) {
    New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   EVNEXUS MUTATION TESTING PIPELINE (Stryker.NET 5.0.0)              " -ForegroundColor Yellow
Write-Host "   Student : K.T.L. Perera (IT24610793) | Team 32                     " -ForegroundColor Cyan
Write-Host "   Mode    : $(if ($QuickDemo) { 'Quick Live Demo' } else { 'Full Microservice Quality Gate' }) | Service: $Service" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# Helper: Parse Stryker.NET mutation-report.json into structured metrics
# ------------------------------------------------------------------------------
function Get-StrykerMetrics {
    param(
        [string]$JsonReportPath,
        [int]$BreakThreshold
    )

    if (-not (Test-Path $JsonReportPath)) {
        return $null
    }

    $json = Get-Content -Path $JsonReportPath -Raw | ConvertFrom-Json
    $killed = 0
    $timeout = 0
    $survived = 0
    $noCoverage = 0
    $ignored = 0
    $compileError = 0
    $fileRows = @()

    foreach ($fileProp in $json.files.PSObject.Properties) {
        $mutants = @($fileProp.Value.mutants)
        $fk = @($mutants | Where-Object { $_.status -eq "Killed" }).Count
        $ft = @($mutants | Where-Object { $_.status -eq "Timeout" }).Count
        $fs = @($mutants | Where-Object { $_.status -eq "Survived" }).Count
        $fn = @($mutants | Where-Object { $_.status -eq "NoCoverage" }).Count
        $fi = @($mutants | Where-Object { $_.status -eq "Ignored" }).Count
        $fc = @($mutants | Where-Object { $_.status -eq "CompileError" }).Count

        $killed += $fk
        $timeout += $ft
        $survived += $fs
        $noCoverage += $fn
        $ignored += $fi
        $compileError += $fc

        $fValid = $fk + $ft + $fs + $fn
        if ($fValid -gt 0) {
            $fScore = [math]::Round((($fk + $ft) / $fValid) * 100.0, 2)
            $shortName = Split-Path -Path $fileProp.Name -Leaf
            $fileRows += [PSCustomObject]@{
                FileName     = $shortName
                FullPath     = $fileProp.Name
                Killed       = $fk
                Timeout      = $ft
                Survived     = $fs
                NoCoverage   = $fn
                Ignored      = $fi
                CompileError = $fc
                TotalValid   = $fValid
                Score        = $fScore
            }
        }
    }

    $detected = $killed + $timeout
    $totalValid = $killed + $timeout + $survived + $noCoverage
    $score = if ($totalValid -gt 0) { [math]::Round(($detected / $totalValid) * 100.0, 2) } else { 0.0 }
    $gatePassed = ($totalValid -gt 0) -and ($score -ge $BreakThreshold)

    return [PSCustomObject]@{
        Killed         = $killed
        Timeout        = $timeout
        Survived       = $survived
        NoCoverage     = $noCoverage
        Ignored        = $ignored
        CompileError   = $compileError
        Detected       = $detected
        TotalValid     = $totalValid
        Score          = $score
        BreakThreshold = $BreakThreshold
        GatePassed     = $gatePassed
        Files          = ($fileRows | Sort-Object -Property FileName)
    }
}

# ------------------------------------------------------------------------------
# Helper: Execute Stryker.NET for a single microservice target
# ------------------------------------------------------------------------------
function Invoke-ServiceMutation {
    param(
        [hashtable]$Target
    )

    $svcStart = Get-Date
    $serviceOutputDir = Join-Path $reportRoot $Target.Key
    if (Test-Path $serviceOutputDir) {
        Remove-Item -Path $serviceOutputDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $serviceOutputDir -Force | Out-Null

    Write-Host "----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[RUN] $($Target.DisplayName)" -ForegroundColor Yellow
    Write-Host "      Test Project : $($Target.TestProjectDir)" -ForegroundColor DarkGray
    Write-Host "      Config File  : $($Target.ConfigFile)" -ForegroundColor DarkGray
    Write-Host "      Quality Gate : Break < $($Target.BreakThreshold)% | Low $($Target.LowThreshold)% | High $($Target.HighThreshold)%" -ForegroundColor DarkGray

    $strykerExit = 0
    Push-Location $Target.TestProjectDir
    try {
        $strykerArgs = @(
            "stryker",
            "--config-file", $Target.RelativeConfigFile,
            "--output", $serviceOutputDir,
            "--concurrency", "$Concurrency",
            "--skip-version-check"
        )

        if ($QuickDemo) {
            $mutatePattern = if (-not [string]::IsNullOrWhiteSpace($TargetFile)) {
                $TargetFile
            } else {
                $Target.QuickDemoMutate
            }
            Write-Host "      QuickDemo    : Mutating $mutatePattern" -ForegroundColor Cyan
            $strykerArgs += @("--mutate", $mutatePattern)
        }

        $prevPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & dotnet @strykerArgs 2>&1 | Out-Host
        $strykerExit = $LASTEXITCODE
        $ErrorActionPreference = $prevPref
    }
    finally {
        Pop-Location
    }

    $elapsed = [math]::Round(((Get-Date) - $svcStart).TotalSeconds, 1)
    $jsonReport = Get-ChildItem -Path $serviceOutputDir -Filter "mutation-report.json" -Recurse -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $htmlReport = Get-ChildItem -Path $serviceOutputDir -Filter "mutation-report.html" -Recurse -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1

    $metrics = if ($jsonReport) {
        Get-StrykerMetrics -JsonReportPath $jsonReport.FullName -BreakThreshold $Target.BreakThreshold
    } else {
        $null
    }

    $passed = ($strykerExit -eq 0) -and ($null -ne $metrics) -and $metrics.GatePassed

    if ($null -ne $metrics) {
        $scoreColor = if ($metrics.Score -ge $Target.HighThreshold) { "Green" }
                      elseif ($metrics.Score -ge $Target.LowThreshold) { "Yellow" }
                      else { "Red" }

        Write-Host ""
        Write-Host "  Result ($($Target.DisplayName)):" -ForegroundColor Cyan
        Write-Host ("    Mutation Score : {0:N2}% (Gate >= {1}%) -> {2}" -f $metrics.Score, $Target.BreakThreshold, $(if ($passed) { "PASS" } else { "FAIL" })) -ForegroundColor $scoreColor
        Write-Host ("    Mutants        : Killed={0} | Timeout={1} | Survived={2} | NoCoverage={3} | Ignored={4} | CompileErr={5}" -f `
            $metrics.Killed, $metrics.Timeout, $metrics.Survived, $metrics.NoCoverage, $metrics.Ignored, $metrics.CompileError) -ForegroundColor White
        Write-Host ("    Duration       : {0}s" -f $elapsed) -ForegroundColor DarkGray
    }
    else {
        Write-Host "  [ERROR] Stryker did not produce mutation-report.json (exit code $strykerExit)." -ForegroundColor Red
    }

    return [PSCustomObject]@{
        Key            = $Target.Key
        DisplayName    = $Target.DisplayName
        Passed         = $passed
        ExitCode       = $strykerExit
        DurationSec    = $elapsed
        Metrics        = $metrics
        HtmlReportPath = if ($htmlReport) { $htmlReport.FullName } else { $null }
        JsonReportPath = if ($jsonReport) { $jsonReport.FullName } else { $null }
    }
}

# ------------------------------------------------------------------------------
# Step 1: Restore local .NET tools (Stryker.NET 5.0.0)
# ------------------------------------------------------------------------------
if (-not $SkipRestore) {
    Write-Host "[1/3] Restoring local .NET tools (dotnet-stryker 5.0.0)..." -ForegroundColor Green
    Push-Location $workspaceRoot
    try {
        $prevPref = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        dotnet tool restore | Out-Null
        $restoreExit = $LASTEXITCODE
        $ErrorActionPreference = $prevPref
        if ($restoreExit -ne 0) {
            throw "dotnet tool restore failed with exit code $restoreExit."
        }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "[1/3] Skipping tool restore (-SkipRestore specified)." -ForegroundColor DarkGray
}

# ------------------------------------------------------------------------------
# Step 2: Build target list and run Stryker.NET per microservice
# ------------------------------------------------------------------------------
$allTargets = @(
    @{
        Key                = "auth"
        DisplayName        = "AuthenticationService (EVNexus.AuthService)"
        TestProjectDir     = Join-Path $workspaceRoot "AuthenticationService\tests\EVNexus.AuthService.Tests"
        ConfigFile         = Join-Path $PSScriptRoot "stryker-auth.json"
        RelativeConfigFile = "../../../tests/mutation-stryker/stryker-auth.json"
        QuickDemoMutate    = "**/Services/JwtTokenService.cs"
        BreakThreshold     = 70
        LowThreshold       = 70
        HighThreshold      = 85
    },
    @{
        Key                = "payment"
        DisplayName        = "PaymentService (EVNexus.PaymentService)"
        TestProjectDir     = Join-Path $workspaceRoot "PaymentService\tests\EVNexus.PaymentService.Tests"
        ConfigFile         = Join-Path $PSScriptRoot "stryker-payment.json"
        RelativeConfigFile = "../../../tests/mutation-stryker/stryker-payment.json"
        QuickDemoMutate    = "**/Forecasting/ForecastService.cs"
        BreakThreshold     = 65
        LowThreshold       = 65
        HighThreshold      = 80
    }
)

$selectedTargets = switch ($Service) {
    "Auth"    { @($allTargets | Where-Object { $_.Key -eq "auth" }) }
    "Payment" { @($allTargets | Where-Object { $_.Key -eq "payment" }) }
    default   { $allTargets }
}

Write-Host "[2/3] Executing Stryker.NET mutation analysis across $($selectedTargets.Count) microservice(s)..." -ForegroundColor Green
$results = @()
foreach ($t in $selectedTargets) {
    $results += Invoke-ServiceMutation -Target $t
}

# ------------------------------------------------------------------------------
# Step 3: Aggregate metrics, preserve unified pipeline link & build HTML hub
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/3] Aggregating results and generating Unified Mutation Dashboard..." -ForegroundColor Green

$totalKilled = 0
$totalTimeout = 0
$totalSurvived = 0
$totalNoCov = 0
$totalIgnored = 0
$totalValid = 0
$allPassed = $true

foreach ($r in $results) {
    if (-not $r.Passed) { $allPassed = $false }
    if ($null -ne $r.Metrics) {
        $totalKilled += $r.Metrics.Killed
        $totalTimeout += $r.Metrics.Timeout
        $totalSurvived += $r.Metrics.Survived
        $totalNoCov += $r.Metrics.NoCoverage
        $totalIgnored += $r.Metrics.Ignored
        $totalValid += $r.Metrics.TotalValid
    }
}

$overallScore = if ($totalValid -gt 0) {
    [math]::Round((($totalKilled + $totalTimeout) / $totalValid) * 100.0, 2)
} else { 0.0 }
$totalElapsed = [math]::Round(((Get-Date) - $overallStart).TotalSeconds, 1)

# Mirror primary Stryker HTML report to tests/reports/mutation/reports/mutation-report.html
# so tests/run-all-tests.ps1 links always resolve cleanly.
$legacyReportsDir = Join-Path $reportRoot "reports"
if (-not (Test-Path $legacyReportsDir)) {
    New-Item -ItemType Directory -Path $legacyReportsDir -Force | Out-Null
}
$firstHtml = $results | Where-Object { $_.HtmlReportPath } | Select-Object -First 1
if ($firstHtml) {
    Copy-Item -Path $firstHtml.HtmlReportPath -Destination (Join-Path $legacyReportsDir "mutation-report.html") -Force
}

# Write unified JSON summary for CI/CD scripts
$summaryObj = [PSCustomObject]@{
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    mode           = if ($QuickDemo) { "QuickDemo" } else { "Full" }
    serviceScope   = $Service
    overallScore   = $overallScore
    totalKilled    = $totalKilled
    totalTimeout   = $totalTimeout
    totalSurvived  = $totalSurvived
    totalNoCov     = $totalNoCov
    totalIgnored   = $totalIgnored
    totalValid     = $totalValid
    durationSec    = $totalElapsed
    allGatesPassed = $allPassed
    services       = @($results | ForEach-Object {
        [PSCustomObject]@{
            key         = $_.Key
            name        = $_.DisplayName
            passed      = $_.Passed
            durationSec = $_.DurationSec
            score       = if ($_.Metrics) { $_.Metrics.Score } else { 0 }
            killed      = if ($_.Metrics) { $_.Metrics.Killed } else { 0 }
            timeout     = if ($_.Metrics) { $_.Metrics.Timeout } else { 0 }
            survived    = if ($_.Metrics) { $_.Metrics.Survived } else { 0 }
            noCoverage  = if ($_.Metrics) { $_.Metrics.NoCoverage } else { 0 }
            ignored     = if ($_.Metrics) { $_.Metrics.Ignored } else { 0 }
            totalValid  = if ($_.Metrics) { $_.Metrics.TotalValid } else { 0 }
            files       = if ($_.Metrics) { $_.Metrics.Files } else { @() }
        }
    })
}
$summaryJsonPath = Join-Path $reportRoot "summary.json"
$summaryObj | ConvertTo-Json -Depth 6 | Set-Content -Path $summaryJsonPath -Encoding UTF8

# Generate unified HTML dashboard
$serviceCardsHtml = ""
$fileTableRowsHtml = ""

foreach ($r in $results) {
    $relHtml = ""
    if ($r.HtmlReportPath) {
        $relHtml = $r.HtmlReportPath.Substring($reportRoot.Length).TrimStart('\', '/').Replace('\', '/')
    }
    $badgeClass = if ($r.Passed) { "badge-pass" } else { "badge-fail" }
    $badgeText = if ($r.Passed) { "GATE PASSED" } else { "GATE FAILED" }
    $m = $r.Metrics
    $svcScore = if ($m) { "{0:N2}%" -f $m.Score } else { "N/A" }
    $kVal = if ($m) { $m.Killed } else { 0 }
    $sVal = if ($m) { $m.Survived } else { 0 }
    $ncVal = if ($m) { $m.NoCoverage } else { 0 }
    $igVal = if ($m) { $m.Ignored } else { 0 }
    $gateVal = if ($m) { "$($m.BreakThreshold)%" } else { "N/A" }

    $btnHtml = if ($relHtml) {
        "<a class='btn' href='$relHtml' target='_blank'>Open Stryker Interactive Report</a>"
    } else {
        "<span class='muted'>HTML report unavailable</span>"
    }

    $serviceCardsHtml += @"
        <div class="card">
            <span class="badge $badgeClass">$badgeText</span>
            <h3>$($r.DisplayName)</h3>
            <div class="big-score">$svcScore</div>
            <p class="metrics-line">Killed: <strong>$kVal</strong> &bull; Survived: <strong>$sVal</strong> &bull; NoCoverage: <strong>$ncVal</strong> &bull; Ignored: <strong>$igVal</strong></p>
            <p class="meta">Quality Gate: &ge; $gateVal &bull; Duration: $($r.DurationSec)s</p>
            $btnHtml
        </div>
"@

    if ($m -and $m.Files) {
        foreach ($f in $m.Files) {
            $barColor = if ($f.Score -ge 80) { "#10b981" } elseif ($f.Score -ge 60) { "#f59e0b" } else { "#ef4444" }
            $fileTableRowsHtml += @"
            <tr>
                <td>$($r.Key.ToUpperInvariant())</td>
                <td><code>$($f.FileName)</code></td>
                <td>$($f.Killed)</td>
                <td>$($f.Survived)</td>
                <td>$($f.NoCoverage)</td>
                <td>$($f.Ignored)</td>
                <td>
                    <div class="bar-wrap"><div class="bar-fill" style="width:$($f.Score)%;background:$barColor"></div></div>
                    <strong>$("{0:N2}%" -f $f.Score)</strong>
                </td>
            </tr>
"@
        }
    }
}

$overallBadgeClass = if ($allPassed) { "badge-pass" } else { "badge-fail" }
$overallBadgeText = if ($allPassed) { "ALL MUTATION QUALITY GATES PASSED" } else { "MUTATION QUALITY GATE FAILED" }

$dashboardHtml = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>EVNexus Mutation Testing Dashboard - Stryker.NET 5.0</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 32px; }
        .container { max-width: 1120px; margin: 0 auto; }
        .header { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px; margin-bottom: 24px; }
        .header h1 { margin: 0 0 8px 0; color: #38bdf8; }
        .subtitle { color: #94a3b8; font-size: 0.92rem; }
        .kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .kpi { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 18px; }
        .kpi-label { color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .kpi-value { font-size: 1.8rem; font-weight: 700; margin-top: 6px; color: #f8fafc; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 28px; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 22px; }
        .big-score { font-size: 2.2rem; font-weight: 700; color: #38bdf8; margin: 8px 0; }
        .metrics-line { color: #cbd5e1; font-size: 0.9rem; margin: 6px 0; }
        .meta { color: #94a3b8; font-size: 0.82rem; margin: 0 0 14px 0; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; margin-bottom: 10px; }
        .badge-pass { background: #10b98122; color: #10b981; border: 1px solid #10b98155; }
        .badge-fail { background: #ef444422; color: #ef4444; border: 1px solid #ef444455; }
        .btn { display: inline-block; padding: 10px 16px; background: #0284c7; color: #fff; text-decoration: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600; }
        .btn:hover { background: #0369a1; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border: 1px solid #334155; border-radius: 10px; overflow: hidden; }
        th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #334155; font-size: 0.88rem; }
        th { background: #0b1220; color: #94a3b8; text-transform: uppercase; font-size: 0.75rem; }
        .bar-wrap { display: inline-block; width: 90px; height: 8px; background: #334155; border-radius: 4px; overflow: hidden; margin-right: 8px; vertical-align: middle; }
        .bar-fill { height: 100%; }
        code { color: #e2e8f0; font-family: Consolas, monospace; }
        .muted { color: #64748b; font-size: 0.85rem; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <span class="badge $overallBadgeClass">$overallBadgeText</span>
        <h1>EVNexus Mutation Testing Dashboard</h1>
        <div class="subtitle">
            <strong>Engine:</strong> Stryker.NET 5.0.0 (Roslyn C# Mutator, Coverage-Based Per-Test) |
            <strong>Owner:</strong> K.T.L. Perera (IT24610793) |
            <strong>Module:</strong> SE3112 |
            <strong>Generated:</strong> $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        </div>
    </div>

    <div class="kpi-strip">
        <div class="kpi"><div class="kpi-label">Weighted Mutation Score</div><div class="kpi-value">$("{0:N2}%" -f $overallScore)</div></div>
        <div class="kpi"><div class="kpi-label">Mutants Killed</div><div class="kpi-value">$totalKilled</div></div>
        <div class="kpi"><div class="kpi-label">Mutants Survived</div><div class="kpi-value">$totalSurvived</div></div>
        <div class="kpi"><div class="kpi-label">Execution Duration</div><div class="kpi-value">${totalElapsed}s</div></div>
    </div>

    <div class="grid">
        $serviceCardsHtml
    </div>

    <h2 style="color:#e2e8f0;margin-bottom:12px;">Per-File Mutation Breakdown</h2>
    <table>
        <thead>
            <tr>
                <th>Service</th>
                <th>Source File</th>
                <th>Killed</th>
                <th>Survived</th>
                <th>NoCoverage</th>
                <th>Ignored</th>
                <th>Mutation Score</th>
            </tr>
        </thead>
        <tbody>
            $fileTableRowsHtml
        </tbody>
    </table>
</div>
</body>
</html>
"@

$dashboardPath = Join-Path $reportRoot "index.html"
Set-Content -Path $dashboardPath -Value $dashboardHtml -Encoding UTF8

# ------------------------------------------------------------------------------
# Final Console Summary
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "                  MUTATION TESTING EXECUTION SUMMARY                  " -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
foreach ($r in $results) {
    $m = $r.Metrics
    $scoreTxt = if ($m) { "{0:N2}%" -f $m.Score } else { "N/A" }
    $detailTxt = if ($m) { "Killed=$($m.Killed), Survived=$($m.Survived), NoCov=$($m.NoCoverage), Gate>=$($m.BreakThreshold)%" } else { "Execution failed" }
    $statusTxt = if ($r.Passed) { "PASS" } else { "FAIL" }
    $color = if ($r.Passed) { "Green" } else { "Red" }
    Write-Host ("{0,-44} [{1,4}] {2,7} ({3,5}s) | {4}" -f $r.DisplayName, $statusTxt, $scoreTxt, $r.DurationSec, $detailTxt) -ForegroundColor $color
}
Write-Host "----------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ("Overall Weighted Mutation Score : {0:N2}% (Killed={1}, Survived={2}, NoCov={3}, Valid={4})" -f $overallScore, $totalKilled, $totalSurvived, $totalNoCov, $totalValid) -ForegroundColor White
Write-Host ("Unified Mutation Dashboard      : {0}" -f $dashboardPath) -ForegroundColor Cyan
Write-Host ("Machine-Readable Summary JSON   : {0}" -f $summaryJsonPath) -ForegroundColor Cyan
Write-Host ("Total Duration                  : {0}s" -f $totalElapsed) -ForegroundColor DarkGray
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

if ($OpenReport -and (Test-Path $dashboardPath)) {
    Start-Process $dashboardPath
}

if (-not $allPassed) {
    Write-Host "[QUALITY GATE FAILED] One or more microservices fell below their mutation score threshold." -ForegroundColor Red
    exit 1
}

Write-Host "[QUALITY GATE PASSED] All evaluated microservices met their mutation testing thresholds." -ForegroundColor Green
exit 0
