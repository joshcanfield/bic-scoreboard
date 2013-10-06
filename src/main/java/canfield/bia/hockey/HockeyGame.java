package canfield.bia.hockey;

import canfield.bia.scoreboard.ScoreBoard;
import canfield.bia.scoreboard.io.SerialUpdater;

import java.util.List;

/**
 *
 */
public class HockeyGame {
    private ScoreBoard scoreBoard;

    private List<ScoreBoard.Penalty> homePenalties;
    private final SerialUpdater updater;

    public HockeyGame() {
        scoreBoard = new ScoreBoard();
        updater = new SerialUpdater(scoreBoard, "tty.usbserial");

        scoreBoard.addListener(
                new ScoreBoard.EventListener() {
                    @Override
                    public void handle(ScoreBoard.EventType eventType) {

                    }
                }
        );
    }

    public ScoreBoard getScoreBoard() {
        return scoreBoard;
    }

    public void setScoreBoard(ScoreBoard scoreBoard) {
        this.scoreBoard = scoreBoard;
    }

    public List<ScoreBoard.Penalty> getHomePenalties() {
        return homePenalties;
    }

    public void setHomePenalties(List<ScoreBoard.Penalty> homePenalties) {
        this.homePenalties = homePenalties;
    }

    public SerialUpdater getUpdater() {
        return updater;
    }
}
