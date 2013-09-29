package canfield.bia.scoreboard;

/**
 * The penalty clock runs with the game clock.
 * This clock may be created during a stacked penalty situation so it may not be running
 */
public class PenaltyClock implements Clock {
    private long timeLimitMillis; // 3000*60 => 3 minutes
    private long clockAtStartMillis;
    private boolean isRunning = false;
    private GameClock gameClock;

    PenaltyClock(GameClock gameClock, long timeLimitMillis) {
        this.gameClock = gameClock;
        this.timeLimitMillis = timeLimitMillis;
    }

    @Override
    public void start() {
        if (isRunning) return;
        isRunning = true;
        this.clockAtStartMillis = gameClock.getMillis();
    }

    @Override
    public int getMillis() {
        long elapsed = clockAtStartMillis - gameClock.getMillis();
        int millis = (int) (timeLimitMillis - elapsed);
        if (millis < 0) return 0;
        return millis;
    }

    @Override
    public int getMinutes() {
        return (this.getMillis() + 999) / (60 * 1000);
    }

    @Override
    public void setMinutes(int minutes) {
        int seconds = getSeconds();
        timeLimitMillis = minutes * 60 * 1000 + seconds * 1000;
    }

    @Override
    public int getSeconds() {
        return (this.getMillis() + 999) / 1000 % 60;
    }

    @Override
    public void setSeconds(int seconds) {
        int minutes = getMinutes();
        timeLimitMillis = minutes * 60 * 1000 + seconds * 1000;
    }

    @Override
    public boolean isRunning() {
        return isRunning;
    }

    @Override
    public void stop() {
        throw new UnsupportedOperationException("Perhaps you wanted to stop the game clock?");
    }
}
