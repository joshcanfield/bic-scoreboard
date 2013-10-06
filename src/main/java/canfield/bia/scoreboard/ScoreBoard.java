package canfield.bia.scoreboard;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Container of the state of the scoreboard.
 * <p/>
 * TODO: Support undo - if you add a point and it clears a penalty we need to be able to fix that!
 * TODO: Scoreboard Events:
 * AWAY_SCORE,
 * HOME_SCORE,
 * ADD_PENALTY,
 * CLEAR_PENALTY,
 * PERIOD_CHANGE,
 * CLOCK_STOPPED,
 * CLOCK_STARTED
 */
public class ScoreBoard {

    private GameClock gameClock = new GameClock(20, 0);
    private int period = 1;
    private int homeScore;
    private int awayScore;

    private Penalty[] homePenaltyList = new Penalty[2];
    private Penalty[] awayPenaltyList = new Penalty[2];

    private List<EventListener> listeners = new ArrayList<EventListener>();

    public ScoreBoard() {
        final ScheduledExecutorService executorService = Executors.newSingleThreadScheduledExecutor();
        executorService.scheduleAtFixedRate(
                new Runnable() {
                    @Override
                    public void run() {
                        if (gameClock == null) return;

                        int millis = gameClock.getMillis();
                        gameClock.update();
                        fire(EventType.tick);

                        if (millis != 0 && gameClock.getMillis() == 0) {
                            fire(EventType.end_of_period);
                        }
                    }
                }, 1000, 1000 / 60, TimeUnit.MILLISECONDS
        );
    }

    public void setGameClock(int minutes, int seconds) {
        if (gameClock != null) {
            gameClock.setTimeRemaining(minutes, seconds);
            return;
        }
        gameClock = new GameClock(minutes, seconds);
    }

    /**
     * @return reference to an immutable clock
     */
    public Clock getGameClock() {
        if (gameClock != null)
            gameClock.update();
        return gameClock;
    }

    public int getPeriod() {
        return period;
    }

    public void setPeriod(int period) {
        this.period = period%10;
    }

    public void setHomePenalty(int index, Penalty penalty) {
        homePenaltyList[index] = penalty;
    }

    public Penalty getHomePenalty(int index) {
        return homePenaltyList[index];
    }

    public void setAwayPenalty(int index, Penalty penalty) {
        awayPenaltyList[index] = penalty;
    }

    public Penalty getAwayPenalty(int index) {
        return awayPenaltyList[index];
    }

    public void pause() {
        gameClock.stop();
    }

    public void start() {
        gameClock.start();
    }

    public int getHomeScore() {
        return homeScore;
    }

    public int getAwayScore() {
        return awayScore;
    }

    public void setAwayScore(int awayScore) {
        this.awayScore = awayScore;
    }

    public void setHomeScore(int homeScore) {
        this.homeScore = homeScore;
    }

    public void advancePeriod() {
        period = (++period % 10);
        gameClock.stop();
        gameClock.reset();
    }


    private void fire(EventType eventType) {
        for (EventListener listener : listeners) {
            listener.handle(eventType);
        }
    }

    public void addListener(EventListener listener) {
        listeners.add(listener);
    }


    public enum PenaltyType {
        Major, // must run full time, not cleared with score
        Minor // clears with an opposing team score
    }

    /**
     * Penalties -
     * two players may have concurrent running penalties
     * - other penalties are not running
     * one player may have two penalties, they run consecutively
     * on an opposing team goal the minor penalty with the lowest time remaining is cleared
     * a penalty may be assessed to one player but sat by another
     */
    public class Penalty {
        private int playerNumber;
        private Clock clock;

        public Penalty(int playerNumber, int timeMillis) {
            this.playerNumber = playerNumber;
            this.clock = gameClock.child(timeMillis);
        }

        public int getPlayerNumber() {
            return playerNumber;
        }

        public void setPlayerNumber(int playerNumber) {
            this.playerNumber = playerNumber;
        }

        public Clock getClock() {
            return clock;
        }

        public void setClock(Clock clock) {
            this.clock = clock;
        }
    }


    static public enum EventType {
        tick, end_of_period, clock_expired
    }

    public interface EventListener {
        void handle(EventType eventType);
    }
}
