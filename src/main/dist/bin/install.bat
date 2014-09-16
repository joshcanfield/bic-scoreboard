# Installs the scoreboard service
# @see http://commons.apache.org/proper/commons-daemon/procrun.html
# @see http://web.archive.org/web/20090228071059/http://blog.platinumsolutions.com/node/234

set INSTALL_DIR=c:\scoreboard2

%INSTALL_DIR%\bin\scoreboardsvc.exe //IS//ScoreboardService2 \
  --Install=%INSTALL_DIR%\bin\scoreboardsvc.exe \
  --Description="ScoreBoard UI Server and serial driver" \
  --Jvm=auto \
  --Classpath=%INSTALL_DIR%\lib\*;%INSTALL_DIR%\scoreboard-1.1.jar;%INSTALL_DIR%\conf\ \
  --StartMode=jvm \
  --StartClass=canfield.bia.ServiceMain \
  --StartMethod=windowsService \
  --StartParams=start \
  --StopMode=jvm \
  --StopClass=canfield.bia.HockeyGameServer \
  --StopMethod=windowsService \
  --StopParams=stop \
  --LogPath=%INSTALL_DIR%\logs \
  --StdOutput=auto \
  --StdError=auto
