REM @echo off
cd %~dp0
cd ..
set INSTALL_DIR=%cd%
cd ..
set BASE_DIR=%cd%

set JAVA_HOME="%BASE_DIR%/jre1.8.0_65"
cd %INSTALL_DIR%

tasklist /FI "IMAGENAME eq java.exe" 2>NUL | find /I /N "java.exe">NUL
if "%ERRORLEVEL%"=="0" goto START_CHROME

echo "Starting scoreboard server!"
start "Scoreboard Server" /min %JAVA_HOME%\bin\java ^
   -Dlogback.configurationFile=conf/logback.xml ^
   -Dscoreboard.commport=COM4 ^
   -cp "%INSTALL_DIR%/lib/*";"%INSTALL_DIR%/scoreboard-1.1.jar";"%INSTALL_DIR%/conf/" ^
   canfield.bia.ServiceMain start

echo "sleep while the service starts up..."
ping -n 5 127.0.0.1 >nul

:START_CHROME
start "" "http://localhost:8080"

