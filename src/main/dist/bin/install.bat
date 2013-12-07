# Installs the scoreboard service

c:\scoreboard\bin\scoreboardsvc.exe //IS//ScoreboardService --Install=C:\scoreboard\bin\scoreboardsvc.exe --Description="ScoreBoard UI Server and serial driver" --Jvm=auto --Classpath=C:\scoreboard\lib\*:C:\scoreboard\*:C:\scoreboard\conf\ --StartMode=jvm --StartClass=canfield.bia.HockeyGameServer --StartMethod=windowsService --StartParams=start --StopMode=jvm --StopClass=canfield.bia.HockeyGameServer --StopMethod=windowsService --StopParams=stop --LogPath=C:\scoreboard\logs --StdOutput=auto --StdError=auto
