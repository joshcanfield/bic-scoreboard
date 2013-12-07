package canfield.bia.hockey;

import canfield.bia.HockeyGameServer;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.io.SerialUpdater;
import canfield.bia.rest.GameResource;
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
                HockeyGameServer.class
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
}
