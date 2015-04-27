package canfield.bia.hockey;

import canfield.bia.hockey.scoreboard.Clock;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.io.ScoreboardAdapter;

import javax.inject.Inject;
import javax.inject.Singleton;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;

/**
 * SimpleGameManager keeps track of more penalties than will fit on the scoreboard.
 * TODO: Re-design with a better domain model.
 * TODO: The clock tracking is really cumbersome. Track elapsed time instead of time remaining!
 */
@Singleton
public class SimpleGameManager {
    private ScoreBoard scoreBoard;
    private ScoreboardAdapter scoreboardAdapter;

    private List<Penalty> homePenalties = new CopyOnWriteArrayList<Penalty>();
    private List<Penalty> awayPenalties = new CopyOnWriteArrayList<Penalty>();
    private Long shiftBuzzerIntervalMillis;
    private long shiftBuzzerFiredMillis = 0;


    @Inject
    public SimpleGameManager(ScoreBoard scoreBoard, ScoreboardAdapter scoreboardAdapter) {
        this.scoreBoard = scoreBoard;
        this.scoreboardAdapter = scoreboardAdapter;

        scoreBoard.addListener(
            event -> {
                switch (event.getType()) {
                    case tick:
                        updatePenalties();
                        handleShiftBuzzer();
                }
            }
        );
        reset();
    }

    private void handleShiftBuzzer() {
        if ( shiftBuzzerIntervalMillis == null ) {
            return;
        }
        final int remainingMillis = scoreBoard.getGameClock().getRemainingMillis();
        // don't run the buzzer if we're at the end of the period/game
        if ( remainingMillis < shiftBuzzerIntervalMillis ) {
            return;
        }
        final int periodLengthMillis = scoreBoard.getPeriodLengthMinutes() * 60 * 1000;
        final int elapsedMillis = periodLengthMillis - remainingMillis;

        // We don't have the total clock time here, so we use the elapsed time to determine how many times
        // we should have buzzed, and the last buzzed time to determine how many times we have buzzed.
        // if the numbers arent't he same start the buzzer.
        final long count = elapsedMillis / shiftBuzzerIntervalMillis;
        final long last = shiftBuzzerFiredMillis / shiftBuzzerIntervalMillis;
        if ( last != count ) {
            shiftBuzzerFiredMillis = elapsedMillis;
            playBuzzer(1000);
        }
    }

    public int getPeriod() {
        return scoreBoard.getPeriod();
    }

    public int getPeriodLength() {
        return scoreBoard.getPeriodLengthMinutes();
    }

    public void setPeriod(Integer period) {
        scoreBoard.setPeriod(period);
        setTime((int) TimeUnit.MINUTES.toMillis(getPeriodLength()));
    }

    public long getTime() {
        return scoreBoard.getGameClock().getRemainingMillis();
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

    public void setTime(int millis) {
        final Clock gameClock = scoreBoard.getGameClock();
        gameClock.setRemainingMillis(millis);
        if (gameClock.getMinutes() > getPeriodLength()) {
            gameClock.setMinutes(getPeriodLength());
            gameClock.setSeconds(0);
        }
    }

    public int getScore(Team team) {
        if (team == Team.home) {
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

    void updateElapsed(Penalty penalty) {
        // if a penalty started in the previous period elapsed time is the rest of that period + whatever has elapsed this period.
        int timeRemainingInCurrentPeriodMillis = getScoreBoard().getGameClock().getRemainingMillis();

        int elapsed;
        if (penalty.getPeriod() < getPeriod()) {
            final int periodLengthMillis = (int) TimeUnit.MINUTES.toMillis(getScoreBoard().getPeriodLengthMinutes());
            final int periodTimeRemainingAtPenaltyStartMillis = penalty.getStartTime();

            // penalty started at period with clock remaining
            int timeElapsedInCurrentPeriodMillis = periodLengthMillis - timeRemainingInCurrentPeriodMillis;

            elapsed = periodTimeRemainingAtPenaltyStartMillis + timeElapsedInCurrentPeriodMillis;

        } else {
            final int periodTimeRemainingAtPenaltyStartMillis = penalty.getStartTime();
            elapsed = periodTimeRemainingAtPenaltyStartMillis - timeRemainingInCurrentPeriodMillis;
        }

        if (elapsed > penalty.getTime()) {
            elapsed = penalty.getTime();
        }
        penalty.setElapsed(elapsed);
    }

    public void updatePenalties() {
        Queue<Integer> availableHomePenaltyIndex = new ArrayDeque<Integer>();
        Queue<Integer> availableAwayPenaltyIndex = new ArrayDeque<Integer>();
        for (Penalty p : homePenalties) {
            updateElapsed(p);
        }

        for (Penalty p : awayPenalties) {
            updateElapsed(p);
        }

        // Clear expired penalties from the scoreboard
        for (int i = 0; i < 2; ++i) {
            Penalty p = scoreBoard.getHomePenalty(i);

            if (p != null && p.isExpired()) {
                scoreBoard.setHomePenalty(i, null);
                p = null;
            }
            if (p == null) {
                availableHomePenaltyIndex.add(i);
            }

            p = scoreBoard.getAwayPenalty(i);
            if (p != null && p.isExpired()) {
                scoreBoard.setAwayPenalty(i, null);
                p = null;
            }
            if (p == null) {
                availableAwayPenaltyIndex.add(i);
            }
        }
        // Do we need to put some penalties on the board?
        final int startTime = roundToSecond(getScoreBoard().getGameClock().getRemainingMillis());

        if (homePenalties.size() > 0) {
            while (!availableHomePenaltyIndex.isEmpty()) {
                int index = availableHomePenaltyIndex.remove();

                for (Penalty penalty : homePenalties) {
                    if (penalty.getStartTime() > 0) {
                        continue; // already started
                    }
                    if (scoreBoard.getHomePenalty(0) == penalty || scoreBoard.getHomePenalty(1) == penalty) {
                        continue; // already on the board
                    }
                    penalty.setStartTime(startTime);
                    scoreBoard.setHomePenalty(index, penalty);
                    break;
                }
            }
        }

        if (awayPenalties.size() > 0) {
            while (!availableAwayPenaltyIndex.isEmpty()) {
                int index = availableAwayPenaltyIndex.remove();

                for (Penalty penalty : awayPenalties) {
                    if (penalty.getStartTime() > 0) {
                        continue; // already started
                    }
                    if (scoreBoard.getAwayPenalty(0) == penalty || scoreBoard.getAwayPenalty(1) == penalty) {
                        continue; // already on the board
                    }
                    penalty.setStartTime(startTime);
                    scoreBoard.setAwayPenalty(index, penalty);
                    break;
                }
            }
        }
    }

    private int roundToSecond(int millis) {
        return ((millis + 999) / 1000) * 1000;
    }

    public ScoreBoard getScoreBoard() {
        return scoreBoard;
    }

    public List<Penalty> getPenalties(Team team) {
        return team == Team.home ? homePenalties : awayPenalties;
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

    public void reset() {
        stopClock();
        homePenalties.clear();
        awayPenalties.clear();
        scoreBoard.setAwayPenalty(0, null);
        scoreBoard.setAwayPenalty(1, null);
        scoreBoard.setHomePenalty(0, null);
        scoreBoard.setHomePenalty(1, null);
        setPeriod(0);
        setScore(Team.home, 0);
        setScore(Team.away, 0);
        setTime((int) TimeUnit.MINUTES.toMillis(getPeriodLength()));
    }

    public void playBuzzer(int millis) {
        scoreBoard.ringBuzzer(millis);
    }

    public boolean updatesRunning() {
        return scoreboardAdapter.isRunning();
    }

    public void stopUpdates() {
        scoreboardAdapter.stop();
    }

    public void startUpdates() {
        scoreboardAdapter.start();
    }

    public boolean isBuzzerOn() {
        return scoreboardAdapter.isBuzzerOn();
    }

    public void setShiftBuzzerIntervalMillis(final Long shiftBuzzerIntervalMillis) {
            this.shiftBuzzerIntervalMillis = shiftBuzzerIntervalMillis;
    }

    public Long getShiftBuzzerIntervalMillis() {
        return shiftBuzzerIntervalMillis;
    }
}
