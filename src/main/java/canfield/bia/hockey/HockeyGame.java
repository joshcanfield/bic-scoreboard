package canfield.bia.hockey;

import canfield.bia.scoreboard.ScoreBoard;
import canfield.bia.scoreboard.io.SerialUpdater;

import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CopyOnWriteArrayList;

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

    private List<Penalty> homePenalties = new CopyOnWriteArrayList<Penalty>();
    private List<Penalty> awayPenalties = new CopyOnWriteArrayList<Penalty>();

    private final SerialUpdater updater;

    public HockeyGame() {
        scoreBoard = new ScoreBoard();
        updater = new SerialUpdater(scoreBoard, "tty.usbserial");

        scoreBoard.addListener(
                new ScoreBoard.EventListener() {
                    @Override
                    public void handle(ScoreBoard.Event event) {
                        switch (event.getType()) {
                            case tick:
                                updatePenalties();
                        }
                    }
                }
        );
    }

    private void updatePenalties() {
        Queue<Integer> availableHomePenaltyIndex = new ArrayDeque<Integer>();
        Queue<Integer> availableAwayPenaltyIndex = new ArrayDeque<Integer>();
        // clear expired penalties from the scoreboard
        for (int i = 0; i < 2; ++i) {
            Penalty p = scoreBoard.getHomePenalty(i);

            if (p != null && isExpired(p)) {
                homePenalties.remove(p);
                scoreBoard.setHomePenalty(i, null);
                p = null;
            }
            if (p == null) {
                availableHomePenaltyIndex.add(i);
            }

            p = scoreBoard.getAwayPenalty(i);
            if (p != null && isExpired(p)) {
                awayPenalties.remove(p);
                scoreBoard.setAwayPenalty(i, null);
                p = null;
            }
            if (p == null) {
                availableAwayPenaltyIndex.add(i);
            }
        }
        int millis = getScoreBoard().getGameClock().getMillis();

        // Do we need to put some penalties on the board?
        if (homePenalties.size() > 0) {
            while (!availableHomePenaltyIndex.isEmpty()) {
                int index = availableHomePenaltyIndex.remove();

                for (Penalty penalty : homePenalties) {
                    if (scoreBoard.getHomePenalty(0) == penalty || scoreBoard.getHomePenalty(1) == penalty) {
                        continue; // already on the board
                    }
                    penalty.setStartTime((millis/1000)*1000);
                    scoreBoard.setHomePenalty(index, penalty);
                }
            }
        }

        if (awayPenalties.size() > 0) {
            while (!availableAwayPenaltyIndex.isEmpty()) {
                int index = availableAwayPenaltyIndex.remove();

                for (Penalty penalty : awayPenalties) {
                    if (scoreBoard.getAwayPenalty(0) == penalty || scoreBoard.getAwayPenalty(1) == penalty) {
                        continue; // already on the board
                    }
                    penalty.setStartTime((millis/1000)*1000);
                    scoreBoard.setAwayPenalty(index, penalty);
                }
            }
        }
    }

    private boolean isExpired(Penalty penalty) {
        return scoreBoard.getPenaltyRemainingMillis(penalty) == 0;
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
        updatePenalties();
    }

    public List<Penalty> getAwayPenalties() {
        return awayPenalties;
    }

    public void addAwayPenalty(Penalty penalty) {
        awayPenalties.add(penalty);
        updatePenalties();
    }

    public SerialUpdater getUpdater() {
        return updater;
    }
}
