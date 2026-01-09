package canfield.bia.hockey.v2.domain;

/**
 * Represents a penalty assessed during the game.
 */
public record Penalty(
    String penaltyId,
    String teamId, // "home" or "away"
    int playerNumber,
    int servingPlayerNumber, // Can be the same as playerNumber
    long durationMillis,
    long timeRemainingMillis, // Frozen time when main clock is paused
    long startTimeWallClock, // System.currentTimeMillis() when penalty starts counting down, 0 otherwise
    int period // Period when penalty was issued
) {}
