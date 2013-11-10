package canfield.bia.hockey;

import canfield.bia.scoreboard.Clock;
import canfield.bia.scoreboard.ScoreBoard;
import canfield.bia.scoreboard.io.SerialUpdater;

import java.util.LinkedList;
import java.util.List;

/**
 * Penalties
 * - sorted in the order they were received.
 * - grouped by player number (2 2 minute penalties show as 4 minutes on the scoreboard)
 * - player serving penalty number shows on scoreboard?
 * - coincidental penalties don't stop for a goal
 * - doesn't show on the clock?
 */
public class HockeyGame {
    private ScoreBoard scoreBoard;

    public enum Team {
        home, away
    }

    private List<Penalty> homePenalties = new LinkedList<Penalty>();
    private List<Penalty> awayPenalties = new LinkedList<Penalty>();

    private final SerialUpdater updater;

    public HockeyGame() {
        scoreBoard = new ScoreBoard();
        updater = new SerialUpdater(scoreBoard, "tty.usbserial");

        scoreBoard.addListener(
                new ScoreBoard.EventListener() {
                    @Override
                    public void handle(ScoreBoard.Event event) {
                        switch (event.getType()) {
                            case penalty_expired:
                                updatePenalties();
                        }
                    }
                }
        );
    }

    private void updatePenalties() {
        Clock gameClock = scoreBoard.getGameClock();
        if (homePenalties.size() > 0) {
            for (Penalty penalty : homePenalties) {
                if (isExpired(penalty))

                    if (penalty.getStartTime() > gameClock.getMillis()) {
//                    int millis = penalty.getStartTime() - gameClock.getMillis();
//                    scoreBoard.penalty(penalty.getPlayerNumber(), millis);
                    }
            }

        } else {
            scoreBoard.setHomePenalty(0, null);
            scoreBoard.setHomePenalty(1, null);
        }

        if (awayPenalties.size() > 0) {
            // remove expired penalties
            // fill the board with penalties

        } else {
            scoreBoard.setAwayPenalty(0, null);
            scoreBoard.setAwayPenalty(1, null);
        }
    }

    private boolean isExpired(Penalty penalty) {
        int gameMillis = scoreBoard.getGameClock().getMillis();
        return (penalty.getStartTime() + penalty.getTime()) > gameMillis;
    }

    public ScoreBoard getScoreBoard() {
        return scoreBoard;
    }

    public void setScoreBoard(ScoreBoard scoreBoard) {
        this.scoreBoard = scoreBoard;
    }

    public List<Penalty> getHomePenalties() {
        return homePenalties;
    }

    public void addHomePenalty(Penalty penalty) {
        homePenalties.add(penalty);
    }

    public List<Penalty> getAwayPenalties() {
        return awayPenalties;
    }

    public void addAwayPenalty(Penalty penalty) {
        awayPenalties.add(penalty);
    }

    public SerialUpdater getUpdater() {
        return updater;
    }
}
