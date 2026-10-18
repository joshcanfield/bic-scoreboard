package canfield.bia.hockey.v2.spec;

/**
 * Command to completely delete a penalty (e.g., added in error).
 * Unlike ReleasePenalty (goal scored), this removes from active AND history.
 * Payload:
 * - penaltyId: String (ID of the penalty to delete)
 */
public record CancelPenaltyCommand(String penaltyId) implements Command {}
