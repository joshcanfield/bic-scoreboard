@echo off
REM Serial Port Diagnostic Script for Windows
REM This script helps diagnose serial port detection issues

echo ========================================
echo Serial Port Diagnostic Tool
echo ========================================
echo.

REM Find the application JAR
set APP_DIR=%~dp0..
set JAR_NAME=

REM Look for the JAR file in the app directory
for %%f in ("%APP_DIR%\app\*.jar") do (
    set JAR_NAME=%%f
    goto :found_jar
)

REM Look for the JAR in lib directory (alternative location)
for %%f in ("%APP_DIR%\lib\*.jar") do (
    set JAR_NAME=%%f
    goto :found_jar
)

REM Look for fat JAR in current directory
for %%f in ("%APP_DIR%\*-all.jar") do (
    set JAR_NAME=%%f
    goto :found_jar
)

echo ERROR: Could not find application JAR file
echo Please run this script from the application directory
pause
exit /b 1

:found_jar
echo Found JAR: %JAR_NAME%
echo.

REM Run the diagnostic tool
echo Running diagnostic...
echo.

java -cp "%JAR_NAME%" canfield.bia.diagnostic.SerialPortDiagnostic

echo.
echo ========================================
echo.
echo If you see errors or no ports detected:
echo   1. Check Device Manager for COM ports
echo   2. Try running this script as Administrator
echo   3. See TROUBLESHOOTING-SERIAL-PORTS.md for more help
echo.
echo Press any key to exit...
pause > nul
