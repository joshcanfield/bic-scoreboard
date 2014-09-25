package canfield.bia.hockey.scoreboard;

import canfield.bia.hockey.Penalty;

/**
 *
 */
public interface ScoreBoard {
    void ringBuzzer(int millis);

    Clock getGameClock();

    int getPeriod();

    int getPeriodLengthMinutes();

    int getPeriodMinutes(int p);

    void setPeriod(int period);

    void setPeriodLength(int period, int minutes);

    void setHomePenalty(int index, Penalty penalty);

    Penalty getHomePenalty(int index);

    void setAwayPenalty(int index, Penalty penalty);

    Penalty getAwayPenalty(int index);

    void pause();

    void start();

    int getHomeScore();

    int getAwayScore();

    void setAwayScore(int awayScore);

    void setHomeScore(int homeScore);

    void advancePeriod();

    void addListener(EventListener listener);

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
