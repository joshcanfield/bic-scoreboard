package canfield.bia.hockey.v2.spec;

import java.util.List;

/**
 * Command to add a goal event.
 * Payload:
 * - teamId: String (e.g., "home", "away")
 * - scorerNumber: int (jersey number of the scoring player)
 * - assistNumbers: List<Integer> (jersey numbers of players with assists, max 2)
 * - isEmptyNet: boolean (true if it was an empty net goal)
 */
public record AddGoalCommand(String teamId, int scorerNumber, List<Integer> assistNumbers, boolean isEmptyNet) implements Command {
}
