package canfield.bia.hockey.v2.engine;

/**
 * Interface for a game timer that periodically triggers a tick event.
 */
public interface GameTimer {
    /**
     * Starts the timer, scheduling the given callback to run at a fixed rate.
     * @param tickCallback The Runnable to execute on each tick.
     */
    void start(Runnable tickCallback);

    /**
     * Stops the timer.
     */
    void stop();
}
