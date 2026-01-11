package canfield.bia.hockey.v2.spec;

/**
 * Command to release a penalty early (e.g., due to power play goal).
 * Only 2-minute minors can be released.
 * Payload:
 * - penaltyId: String (ID of the penalty to release)
 * - releasedByGoalId: String (optional, links to the goal that caused release)
 */
public record ReleasePenaltyCommand(
    String penaltyId,
    String releasedByGoalId
) implements Command {
    /**
     * Constructor for manual release without linking to a goal.
     */
    public ReleasePenaltyCommand(String penaltyId) {
        this(penaltyId, null);
    }
}
