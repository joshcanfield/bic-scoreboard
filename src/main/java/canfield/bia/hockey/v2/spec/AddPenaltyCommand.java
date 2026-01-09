package canfield.bia.hockey.v2.spec;

/**
 * Command to add a new penalty to a team.
 * Payload:
 * - teamId: String (e.g., "home", "away")
 * - playerNumber: int (jersey number of the penalized player)
 * - servingPlayerNumber: int (jersey number of the player serving the penalty, can be same as playerNumber)
 * - durationMinutes: int (duration of the penalty in minutes)
 */
public record AddPenaltyCommand(String teamId, int playerNumber, int servingPlayerNumber, int durationMinutes) implements Command {
}
