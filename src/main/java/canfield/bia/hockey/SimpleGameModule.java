package canfield.bia.hockey;

import canfield.bia.HockeyGameServer;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.io.SerialUpdater;
import canfield.bia.hockey.web.WebSocketAdapter;
import canfield.bia.rest.GameResource;
import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;
import dagger.Module;
import dagger.Provides;

import javax.inject.Singleton;

/**
 *
 */
@Module(
        injects = {
                SerialUpdater.class,
                ScoreBoard.class,
                GameResource.class,
                HockeyGameServer.class,
                WebSocketAdapter.class
        }
)
public class SimpleGameModule {

    @Provides
    @Singleton
    SerialUpdater provideSerialUpdater(ScoreBoard scoreBoard) {
        String port = System.getProperty("scoreboard.commport", "usb.ttyserial");
        return new SerialUpdater(scoreBoard, port);
    }

    @Provides
    @Singleton
    ScoreBoard provideScoreboard() {
        return new ScoreBoard();
    }

    @Provides
    @Singleton
    SocketIOServer provideSocketIOServer() {
        final Configuration config = new Configuration();
        config.setHostname("localhost");
        config.setPort(8081);

        return new SocketIOServer(config);
    }
}
