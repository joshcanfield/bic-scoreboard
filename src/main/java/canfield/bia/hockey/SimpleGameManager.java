package canfield.bia.hockey;

import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.io.SerialUpdater;

import javax.inject.Inject;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CopyOnWriteArrayList;

import static canfield.bia.hockey.SimpleGameManager.Team.home;

/**
 * SimpleGameManager keeps track of more penalties than will fit on the
 */
public class SimpleGameManager {
    private ScoreBoard scoreBoard;
    private SerialUpdater serialUpdater;

    public enum Team {
        home, away
    }

    private List<Penalty> homePenalties = new CopyOnWriteArrayList<Penalty>();
    private List<Penalty> awayPenalties = new CopyOnWriteArrayList<Penalty>();

    @Inject
    public SimpleGameManager(ScoreBoard scoreBoard, SerialUpdater serialUpdater) {
        this.scoreBoard = scoreBoard;
        this.serialUpdater = serialUpdater;

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

    public int getPeriod() {
        return scoreBoard.getPeriod();
    }

    public void setPeriod(Integer period) {
        scoreBoard.setPeriod(period);
    }

    public long getTime() {
        return scoreBoard.getGameClock().getMillis();
    }

    public boolean isClockRunning() {
        return scoreBoard.getGameClock().isRunning();
    }

    public void startClock() {
        scoreBoard.getGameClock().start();
    }

    public void stopClock() {
        scoreBoard.getGameClock().stop();
    }

    public void setTime(Integer millis) {
        scoreBoard.getGameClock().setMillis(millis);
    }

    public int getScore(Team team) {
        if (team == home) {
            return scoreBoard.getHomeScore();
        } else {
            return scoreBoard.getAwayScore();
        }
    }

    public void setScore(Team team, int score) {
        switch (team) {
            case home:
                scoreBoard.setHomeScore(score);
                break;
            case away:
                scoreBoard.setAwayScore(score);
                break;
        }
    }

    public void deletePenalty(Team team, Penalty penalty) {
        switch (team) {
            case home:
                for (int i = 0; i < 2; ++i) {
                    if (penalty.equals(scoreBoard.getHomePenalty(i))) {
                        scoreBoard.setHomePenalty(i, null);
                    }
                }
                homePenalties.remove(penalty);
                break;
            case away:
                for (int i = 0; i < 2; ++i) {
                    if (penalty.equals(scoreBoard.getAwayPenalty(i))) {
                        scoreBoard.setAwayPenalty(i, null);
                    }
                }
                awayPenalties.remove(penalty);
                break;
        }

    }

    public void updatePenalties() {
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
                    penalty.setStartTime(roundToSecond(millis));
                    scoreBoard.setHomePenalty(index, penalty);
                    break;
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
                    penalty.setStartTime(roundToSecond(millis));
                    scoreBoard.setAwayPenalty(index, penalty);
                    break;
                }
            }
        }
    }

    private int roundToSecond(int millis) {
        return ((millis + 999) / 1000) * 1000;
    }

    private boolean isExpired(Penalty penalty) {
        return scoreBoard.getPenaltyRemainingMillis(penalty) == 0;
    }

    public ScoreBoard getScoreBoard() {
        return scoreBoard;
    }

    public List<Penalty> getPenalties(Team team) {
        return team == home ? homePenalties : awayPenalties;
    }

    public void addPenalty(Team team, Penalty penalty) {
        switch (team) {
            case home:
                homePenalties.add(penalty);
                break;
            case away:
                awayPenalties.add(penalty);
                break;
        }
        updatePenalties();
    }

    public void playBuzzer(int millis) {
        scoreBoard.ringBuzzer(millis);
    }

    public void stopUpdates() {
        serialUpdater.stop();
    }

    public void startUpdates() {
        serialUpdater.start();
    }

}
