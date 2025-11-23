package canfield.bia.hockey.v2.domain;

/**
 * Defines the behavior of the main game clock.
 */
public enum ClockType {
    /**
     * The clock stops on every whistle.
     */
    STOP_TIME,

    /**
     * The clock runs continuously, except for specific long stoppages.
     */
    RUN_TIME
}
