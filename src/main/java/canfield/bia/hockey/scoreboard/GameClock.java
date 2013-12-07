package canfield.bia.hockey.scoreboard;

/**
 * The GameClock produces child clocks that share isRunning?
 */
public class GameClock implements Clock {
    private int clockStartMillis; // 20 minute clock, used when reset
    private int timeRemainingMillis;
    private boolean isRunning = false;

    private long lastUpdateMillis;

    public GameClock(int minutes, int seconds) {
        setTimeRemaining(minutes, seconds);
        clockStartMillis = timeRemainingMillis;
    }

    public void setTimeRemaining(int minutes, int seconds) {
        timeRemainingMillis = minutes * 60 * 1000 + seconds * 1000;
    }

    public void reset() {
        timeRemainingMillis = clockStartMillis;
    }

    @Override
    public boolean isRunning() {
        return isRunning;
    }

    @Override
    public int getMillis() {
        return timeRemainingMillis;
    }

    @Override
    public void setMillis(int millis) {
        timeRemainingMillis = millis;
    }

    @Override
    public int getMinutes() {
        return getMinutes(this.getMillis());
    }

    public static int getMinutes(int millis) {
        return (millis + 999) / (60 * 1000);
    }

    @Override
    public void setMinutes(int minutes) {
        int seconds = getSeconds();
        timeRemainingMillis = minutes * 60 * 1000 + seconds * 1000;
    }

    @Override
    public int getSeconds() {
        return getSeconds(this.getMillis());
    }

    public static int getSeconds(int millis) {
        return (millis + 999) / 1000 % 60;
    }

    @Override
    public void setSeconds(int seconds) {
        int minutes = getMinutes();
        timeRemainingMillis = minutes * 60 * 1000 + seconds * 1000;
    }

    @Override
    public void start() {
        lastUpdateMillis = System.currentTimeMillis();
        isRunning = true;
    }

    @Override
    public void stop() {
        update();
        isRunning = false;
    }

    public void update() {
        if (!isRunning || timeRemainingMillis == 0) return;
        long now = System.currentTimeMillis();
        long elapsed = now - lastUpdateMillis;
        lastUpdateMillis = now;
        timeRemainingMillis -= elapsed;
        if (timeRemainingMillis < 0) timeRemainingMillis = 0;
    }

}
