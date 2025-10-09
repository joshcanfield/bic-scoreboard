package canfield.bia.hockey;

import canfield.bia.HockeyGameServer;
import canfield.bia.config.AppConfig;
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
        HockeyGameServer.class,
        SimpleGameManager.class
    }
)
public class SimpleGameModule {

    @Provides
    @Singleton
    AppConfig provideAppConfig() {
        return new AppConfig();
    }

    @Provides
    @Singleton
    GameConfig provideGameConfig() {
        // TODO: Load this from a config file
        GameConfig config = new GameConfig();
        // Default to 1 minute intermission; 0 disables intermission entirely
        config.setIntermissionDurationMinutes(1);
        return config;
    }

    @Provides
    @Singleton
    ScoreboardAdapter provideSerialUpdater(ScoreBoard scoreBoard, AppConfig config) {
        String port = config.getCommPort();
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

    @Provides
    @Singleton
    SimpleGameManager provideSimpleGameManager(ScoreBoard scoreBoard, ScoreboardAdapter scoreboardAdapter, AppConfig appConfig, GameConfig gameConfig) {
        return new SimpleGameManager(scoreBoard, scoreboardAdapter, appConfig, gameConfig);
    }
}
