package canfield.bia.hockey.v2.spec;

import canfield.bia.hockey.v2.domain.InfractionType;

/**
 * Command to add a new penalty to a team.
 * Payload:
 * - teamId: String (e.g., "home", "away")
 * - playerNumber: int (jersey number of the penalized player)
 * - servingPlayerNumber: int (jersey number of the player serving the penalty, can be same as playerNumber)
 * - durationMinutes: int (duration of the penalty in minutes)
 * - infractionType: InfractionType (type of infraction, null defaults to OTHER)
 * - customInfractionDescription: String (used when infractionType is OTHER)
 * - offTimeGameClockMillis: Long (game clock time when assessed, null = use current)
 */
public record AddPenaltyCommand(
    String teamId,
    int playerNumber,
    int servingPlayerNumber,
    int durationMinutes,
    InfractionType infractionType,
    String customInfractionDescription,
    Long offTimeGameClockMillis
) implements Command {
    /**
     * Backward-compatible constructor for existing code.
     */
    public AddPenaltyCommand(String teamId, int playerNumber, int servingPlayerNumber, int durationMinutes) {
        this(teamId, playerNumber, servingPlayerNumber, durationMinutes, null, null, null);
    }
}
