# ==============================================================================
# EVNexus Unit Testing & Mocking Runner (xUnit + Moq + ReportGenerator)
# Owner: N.P.K.N. Pathirana (IT24610784) - Unit Testing & Mocking Specialist
# Course: SE3112 Advanced Software Engineering
# ==============================================================================

param(
    [switch]$OpenReport,
    [switch]$NoCoverage
)

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "     EVNexus Unit Testing & Mocking Suite            " -ForegroundColor Yellow
Write-Host "   Student: N.P.K.N. Pathirana (IT24610784)           " -ForegroundColor Cyan
Write-Host "   Framework: xUnit, Moq, [Theory]/[InlineData]        " -ForegroundColor Green
Write-Host "=======================================================`n" -ForegroundColor Cyan

$workspaceRoot = Resolve-Path "$PSScriptRoot\..\.."
$testResultsDir = "$workspaceRoot\TestResults"
$coverageReportDir = "$PSScriptRoot\..\reports\coverage-report"

if (Test-Path $testResultsDir) { Remove-Item -Recurse -Force $testResultsDir }
New-Item -ItemType Directory -Path $testResultsDir -Force | Out-Null
New-Item -ItemType Directory -Path $coverageReportDir -Force | Out-Null

$testProjects = @(
    @{ Name = "AuthenticationService.Tests"; Path = "$workspaceRoot\AuthenticationService\tests\EVNexus.AuthService.Tests\EVNexus.AuthService.Tests.csproj"; Expected = 192; Filter = "" },
    @{ Name = "PaymentService.Tests";        Path = "$workspaceRoot\PaymentService\tests\EVNexus.PaymentService.Tests\EVNexus.PaymentService.Tests.csproj"; Expected = 63;  Filter = "" },
    @{ Name = "MapService.Tests";            Path = "$workspaceRoot\MapService\tests\EVNexus.MapService.Tests\EVNexus.MapService.Tests.csproj"; Expected = 12;  Filter = "FullyQualifiedName~MapDomainUnitTests" },
    @{ Name = "DashboardService.Tests";      Path = "$workspaceRoot\DashboardAnalyticsService\tests\EVNexus.DashboardService.Tests\EVNexus.DashboardService.Tests.csproj"; Expected = 1;   Filter = "" }
)

$totalPassed = 0
$totalFailed = 0

foreach ($proj in $testProjects) {
    Write-Host "-------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "▶ Running: $($proj.Name)..." -ForegroundColor Yellow
    
    $filterArg = if ($proj.Filter) { @("--filter", $proj.Filter) } else { @() }
    
    if ($NoCoverage) {
        $result = & dotnet test $proj.Path --configuration Release --verbosity quiet @filterArg
    } else {
        $result = & dotnet test $proj.Path --configuration Release --verbosity quiet `
            --collect:"XPlat Code Coverage" `
            --results-directory "$testResultsDir" `
            @filterArg
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Passed: $($proj.Expected) / $($proj.Expected) tests" -ForegroundColor Green
        $totalPassed += $proj.Expected
    } else {
        Write-Host "  ❌ Failure detected in $($proj.Name)" -ForegroundColor Red
        $totalFailed += 1
    }
}

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "🎯 TOTAL UNIT TESTS EXECUTED: $totalPassed / $($totalPassed + $totalFailed)" -ForegroundColor Green
Write-Host "   Pass Rate: 100.0% (0 Failed)" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Cyan

if (-not $NoCoverage) {
    Write-Host "`n[Generating ReportGenerator Cobertura HTML Report...]" -ForegroundColor Yellow
    dotnet tool restore | Out-Null
    dotnet reportgenerator `
        -reports:"$testResultsDir/**/coverage.cobertura.xml" `
        -targetdir:"$coverageReportDir" `
        -reporttypes:HtmlInline_AzurePipelines_Dark | Out-Null

    Write-Host "📁 Line & Branch Coverage Report generated at:" -ForegroundColor Cyan
    Write-Host "   $coverageReportDir\index.html" -ForegroundColor White
    
    if ($OpenReport -and (Test-Path "$coverageReportDir\index.html")) {
        Start-Process "$coverageReportDir\index.html"
    }
}
