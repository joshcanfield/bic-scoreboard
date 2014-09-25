package canfield.bia.hockey.scoreboard.io;

/**
 *
 */
public interface ScoreboardAdapter {
    String getPortName();

    void setPortName(String portName);

    void start();

    void stop();

    boolean isRunning();

    boolean isBuzzerOn();
}
