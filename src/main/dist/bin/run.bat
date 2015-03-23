@echo off

set INSTALL_DIR=c:/scoreboard-1.1
cd %INSTALL_DIR%

tasklist /FI "IMAGENAME eq java.exe" 2>NUL | find /I /N "java.exe">NUL
if "%ERRORLEVEL%"=="0" goto START_CHROME

echo "Starting scoreboard server!"
start "Scoreboard Server" /min java -Dlogback.configurationFile=conf/logback.xml ^
   -cp %INSTALL_DIR%/lib/*;%INSTALL_DIR%/scoreboard-1.1.jar;%INSTALL_DIR%/conf/ ^
   canfield.bia.ServiceMain start

@sleep while the service starts up...
timeout 4

:START_CHROME
start chrome "http://localhost:8080"

