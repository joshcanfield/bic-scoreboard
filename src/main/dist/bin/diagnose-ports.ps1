#!/usr/bin/env pwsh
# Serial Port Diagnostic Script for Windows (PowerShell)
# This script helps diagnose serial port detection issues and compares results with Windows Device Manager

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "Serial Port Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get Windows COM ports from registry
Write-Host "Step 1: Checking Windows Device Manager for COM ports..." -ForegroundColor Yellow
Write-Host ""

try {
    $regPath = "HKLM:\HARDWARE\DEVICEMAP\SERIALCOMM"
    if (Test-Path $regPath) {
        $comPorts = Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue
        if ($comPorts) {
            Write-Host "COM Ports found in Windows Registry:" -ForegroundColor Green
            $comPorts.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | ForEach-Object {
                Write-Host "  $($_.Name) -> $($_.Value)" -ForegroundColor Green
            }
            Write-Host ""
        } else {
            Write-Host "  No COM ports found in registry" -ForegroundColor Yellow
            Write-Host ""
        }
    } else {
        Write-Host "  Registry path not found (this is unusual)" -ForegroundColor Red
        Write-Host ""
    }
} catch {
    Write-Host "  Error reading registry: $_" -ForegroundColor Red
    Write-Host ""
}

# Find the application JAR
Write-Host "Step 2: Running Java diagnostic tool..." -ForegroundColor Yellow
Write-Host ""

$appDir = Split-Path -Parent $PSScriptRoot
$jarFile = $null

# Search for JAR in common locations
$searchPaths = @(
    (Join-Path $appDir "app\*.jar"),
    (Join-Path $appDir "lib\*.jar"),
    (Join-Path $appDir "*-all.jar")
)

foreach ($pattern in $searchPaths) {
    $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $jarFile = $found.FullName
        break
    }
}

if (-not $jarFile) {
    Write-Host "ERROR: Could not find application JAR file" -ForegroundColor Red
    Write-Host "Please run this script from the application directory" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "Found JAR: $jarFile" -ForegroundColor Green
Write-Host ""

# Run the Java diagnostic tool
try {
    & java -cp "$jarFile" canfield.bia.diagnostic.SerialPortDiagnostic
} catch {
    Write-Host "ERROR: Failed to run diagnostic tool" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Provide additional troubleshooting info
Write-Host "Additional Troubleshooting:" -ForegroundColor Yellow
Write-Host "  - If Windows shows COM ports but Java doesn't:" -ForegroundColor White
Write-Host "    1. Try running this script as Administrator" -ForegroundColor Gray
Write-Host "    2. Check if USB-to-Serial drivers are installed" -ForegroundColor Gray
Write-Host "    3. See TROUBLESHOOTING-SERIAL-PORTS.md" -ForegroundColor Gray
Write-Host ""
Write-Host "  - To manually test a specific COM port:" -ForegroundColor White
Write-Host "    1. Note the port name from Device Manager (e.g., COM3)" -ForegroundColor Gray
Write-Host "    2. Open the scoreboard app" -ForegroundColor Gray
Write-Host "    3. Navigate to port settings and enter the port name" -ForegroundColor Gray
Write-Host ""

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
