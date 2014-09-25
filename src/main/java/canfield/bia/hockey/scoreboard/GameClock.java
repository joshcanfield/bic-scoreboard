package canfield.bia.hockey.scoreboard;

/**
 * This is a count down clock. It only knows time remaining.
 */
public class GameClock implements Clock {
    private int timeRemainingMillis;
    private boolean isRunning = false;

    private long lastUpdateMillis;

    public GameClock(int minutes, int seconds) {
        setTimeRemaining(minutes, seconds);
    }

    public void setTimeRemaining(int minutes, int seconds) {
        timeRemainingMillis = minutes * 60 * 1000 + seconds * 1000;
    }

    public void reset() {
        timeRemainingMillis = 0;
    }

    @Override
    public boolean isRunning() {
        return isRunning;
    }

    @Override
    public int getRemainingMillis() {
        if ( isRunning ) {
            long now = System.currentTimeMillis();
            int elapsed = (int)(now - lastUpdateMillis);
            final int actualRemaining = timeRemainingMillis - elapsed;
            return  actualRemaining < 0 ? 0 : actualRemaining;
        }
        return timeRemainingMillis;
    }

    @Override
    public void setRemainingMillis(int millis) {
        timeRemainingMillis = millis;
    }

    @Override
    public int getMinutes() {
        return getMinutes(this.getRemainingMillis());
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
        return getSeconds(this.getRemainingMillis());
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
        isRunning = false;

        long now = System.currentTimeMillis();
        long elapsed = now - lastUpdateMillis;
        lastUpdateMillis = now;
        timeRemainingMillis -= elapsed;
        if (timeRemainingMillis < 0) timeRemainingMillis = 0;
    }
}
