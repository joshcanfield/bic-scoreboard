package canfield.bia.hockey;

import canfield.bia.HockeyGameServer;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.ScoreBoardImpl;
import canfield.bia.hockey.scoreboard.io.ScoreboardAdapter;
import canfield.bia.hockey.scoreboard.io.ScoreboardAdapterImpl;
import canfield.bia.hockey.web.WebSocketAdapter;
import canfield.bia.rest.GameResource;
import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;
import dagger.Module;
import dagger.Provides;

import javax.inject.Singleton;

@Module(
    injects = {
        ScoreboardAdapterImpl.class,
        ScoreBoardImpl.class,
        GameResource.class,
        HockeyGameServer.class,
        WebSocketAdapter.class
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
    SocketIOServer provideSocketIOServer() {
        final Configuration config = new Configuration();
        config.setHostname("localhost");
        int port = Integer.parseInt(System.getProperty("socketio.port", "8081"));
        config.setPort(port);

        return new SocketIOServer(config);
    }
}
