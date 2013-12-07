package canfield.bia.hockey.scoreboard;

import canfield.bia.hockey.Penalty;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Scoreboard owns the state of the scoreboard.
 */
public class ScoreBoard {
    private static final int HOME = 0;
    private static final int AWAY = 1;
    private GameClock gameClock = new GameClock(20, 0);
    private int period = 1;
    private int homeScore;
    private int awayScore;

    // Empty penalties
    private Penalty[][] penalties = new Penalty[][]{
            {null, null},
            {null, null}
    };

    private Event tickEvent = new Event(EventType.tick);
    private Event endOfPeriodEvent = new Event(EventType.end_of_period);

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
                        fire(tickEvent);

                        if (millis != 0 && gameClock.getMillis() == 0) {
                            fire(endOfPeriodEvent);
                            // TODO advance after millis
                            advancePeriod();
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

    public void ringBuzzer(int millis) {
        fire(new BuzzerEvent(millis));
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
        this.period = period % 10;
    }

    public void setHomePenalty(int index, Penalty penalty) {
        if (index > 1) return;
        penalties[HOME][index] = penalty;
    }

    public Penalty getHomePenalty(int index) {
        if (index > 1) return null;
        return penalties[HOME][index];
    }

    public void setAwayPenalty(int index, Penalty penalty) {
        if (index > 1) return;
        penalties[AWAY][index] = penalty;
    }

    public Penalty getAwayPenalty(int index) {
        if (index > 1) return null;
        return penalties[AWAY][index];
    }

    public int getPenaltyRemainingMillis(Penalty penalty) {
        int clockMillis = getGameClock().getMillis();
        int startClockMillis = penalty.getStartTime();

        startClockMillis += (getPeriod() - penalty.getPeriod()) * 20 * 60 * 1000; // assumes 20 minute period :/

        int elapsed = startClockMillis - clockMillis;

        int i = penalty.getTime() - elapsed;

        return i > 0 ? i : 0;
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


    private void fire(Event eventType) {
        for (EventListener listener : listeners) {
            listener.handle(eventType);
        }
    }

    public void addListener(EventListener listener) {
        listeners.add(listener);
    }


    static public enum EventType {
        tick, end_of_period, penalty_expired, clock_expired, buzzer
    }

    public interface EventListener {
        void handle(Event eventType);
    }

    public static class Event {
        EventType type;

        public Event(EventType type) {
            this.type = type;
        }

        public EventType getType() {
            return type;
        }
    }

    public static class BuzzerEvent extends Event {
        int lengthMillis;

        public BuzzerEvent(int lengthMillis) {
            super(EventType.buzzer);
            this.lengthMillis = lengthMillis;
        }

        public int getLengthMillis() {
            return lengthMillis;
        }

        public void setLengthMillis(int lengthMillis) {
            this.lengthMillis = lengthMillis;
        }
    }
}
