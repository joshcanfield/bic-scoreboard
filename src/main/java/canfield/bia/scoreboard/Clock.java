package canfield.bia.scoreboard;

/**
 *
 */
public interface Clock {

    void start();

    void stop();

    int getMillis();

    int getMinutes();

    void setMinutes(int minutes);

    int getSeconds();

    void setSeconds(int seconds);

    boolean isRunning();
}
