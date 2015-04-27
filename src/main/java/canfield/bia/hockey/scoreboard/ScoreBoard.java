package canfield.bia.hockey.scoreboard;

import canfield.bia.hockey.Penalty;

import java.util.List;

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

    void setPeriodLength(List<Integer> minutes);

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

    enum EventType {
        tick, end_of_period, penalty_expired, clock_expired, buzzer
    }

    interface EventListener {
        void handle(Event eventType);
    }

    class Event {
        EventType type;

        public Event(EventType type) {
            this.type = type;
        }

        public EventType getType() {
            return type;
        }
    }

    class BuzzerEvent extends Event {
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
