# ==============================================================================
# EVNexus Load & Performance Testing Runner (Apache JMeter 5.6.3 Engine)
# Owner: J.M. Asmal (IT24610803) - Load & Performance Testing Specialist
# Course: SE3112 Advanced Software Engineering
# ==============================================================================

param(
    [string]$TargetHost = "localhost",
    [int]$TargetPort = 5000,
    [int]$Samples = 5000,
    [switch]$OpenDashboard
)

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host "   🚀 EVNexus API Load & Concurrency Testing Runner   " -ForegroundColor Yellow
Write-Host "   Student: J.M. Asmal (IT24610803)                   " -ForegroundColor Cyan
Write-Host "   Target: 5,000 Transactions | SLA Threshold: <200ms  " -ForegroundColor Green
Write-Host "=======================================================`n" -ForegroundColor Cyan

$jmxFile = "$PSScriptRoot\EVNexus_Load_Test_Plan.jmx"
$outputDir = "$PSScriptRoot\..\reports\jmeter-dashboard"

# Check if JMeter binary exists in PATH
$jmeterCmd = Get-Command "jmeter" -ErrorAction SilentlyContinue

if ($jmeterCmd) {
    Write-Host "[1/3] Found native Apache JMeter CLI: $($jmeterCmd.Source)" -ForegroundColor Green
    Write-Host "[2/3] Launching non-GUI JMeter load test against http://${TargetHost}:${TargetPort}..." -ForegroundColor Yellow
    
    if (Test-Path $outputDir) { Remove-Item -Recurse -Force $outputDir }
    $jtlFile = "$PSScriptRoot\test_results.jtl"
    if (Test-Path $jtlFile) { Remove-Item -Force $jtlFile }
    
    jmeter -n -t "$jmxFile" -l "$jtlFile" -e -o "$outputDir"
    
    Write-Host "`n[3/3] JMeter execution completed successfully!" -ForegroundColor Green
    Write-Host "HTML Dashboard generated at: $outputDir\index.html" -ForegroundColor Cyan
    if ($OpenDashboard) { Start-Process "$outputDir\index.html" }
}
else {
    Write-Host "[1/3] Apache JMeter binary not in PATH. Running standalone performance runner..." -ForegroundColor Yellow
    node "$PSScriptRoot\loadRunner.js" --host $TargetHost --port $TargetPort --samples $Samples
    
    if ($OpenDashboard) {
        $dashFile = "$outputDir\index.html"
        if (Test-Path $dashFile) { Start-Process $dashFile }
    }
}
