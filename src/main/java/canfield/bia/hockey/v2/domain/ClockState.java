package canfield.bia.hockey.v2.domain;

/**
 * Represents the state of the main game clock.
 */
public record ClockState(
    long timeRemainingMillis, // Frozen time when paused
    boolean isRunning,
    long startTimeWallClock // System.currentTimeMillis() when started, 0 when paused
) {}
