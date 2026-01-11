package canfield.bia.hockey.v2.spec;

import java.util.List;

/**
 * Command to add a goal event.
 * Payload:
 * - teamId: String (e.g., "home", "away")
 * - scorerNumber: int (jersey number of the scoring player)
 * - assistNumbers: List<Integer> (jersey numbers of players with assists, max 2)
 * - isEmptyNet: boolean (true if it was an empty net goal)
 * - releasePenaltyId: String (optional, ID of opposing team's penalty to release for power play goal)
 */
public record AddGoalCommand(
    String teamId,
    int scorerNumber,
    List<Integer> assistNumbers,
    boolean isEmptyNet,
    String releasePenaltyId
) implements Command {
    /**
     * Backward-compatible constructor for existing code.
     */
    public AddGoalCommand(String teamId, int scorerNumber, List<Integer> assistNumbers, boolean isEmptyNet) {
        this(teamId, scorerNumber, assistNumbers, isEmptyNet, null);
    }
}
