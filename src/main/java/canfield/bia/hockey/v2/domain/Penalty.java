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
    int period, // Period when penalty was issued
    // New fields for scoresheet support:
    InfractionInfo infraction, // Type of infraction (null for legacy penalties)
    long offTimeGameClockMillis, // Game clock time when penalty was assessed
    Long onTimeGameClockMillis, // Game clock time when player returned (null if still active)
    PenaltyStatus status // ACTIVE, EXPIRED, or RELEASED
) {
    /**
     * Backward-compatible factory method for existing code that doesn't use new fields.
     */
    public static Penalty createLegacy(
        String penaltyId,
        String teamId,
        int playerNumber,
        int servingPlayerNumber,
        long durationMillis,
        long timeRemainingMillis,
        long startTimeWallClock,
        int period
    ) {
        return new Penalty(
            penaltyId, teamId, playerNumber, servingPlayerNumber,
            durationMillis, timeRemainingMillis, startTimeWallClock, period,
            null, 0L, null, PenaltyStatus.ACTIVE
        );
    }
}
