package canfield.bia.hockey;

import canfield.bia.HockeyGameServer;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.ScoreBoardImpl;
import canfield.bia.hockey.scoreboard.io.ScoreboardAdapter;
import canfield.bia.hockey.scoreboard.io.ScoreboardAdapterImpl;
import canfield.bia.hockey.web.NativeWebSocketServer;
import canfield.bia.rest.GameResource;
import dagger.Module;
import dagger.Provides;

import javax.inject.Singleton;

@Module(
    injects = {
        ScoreboardAdapterImpl.class,
        ScoreBoardImpl.class,
        GameResource.class,
        HockeyGameServer.class
    }
)
public class SimpleGameModule {

    @Provides
    @Singleton
    ScoreboardAdapter provideSerialUpdater(ScoreBoard scoreBoard) {
        String port = System.getProperty("scoreboard.commport", "usb.ttyserial");
        return new ScoreboardAdapterImpl(scoreBoard, port);
    }

    @Provides
    @Singleton
    ScoreBoard provideScoreboard() {
        return new ScoreBoardImpl();
    }

    @Provides
    @Singleton
    NativeWebSocketServer provideNativeWebSocketServer(SimpleGameManager manager) {
        int port = Integer.parseInt(System.getProperty("ws.port", "8082"));
        return new NativeWebSocketServer(manager, port);
    }
}
