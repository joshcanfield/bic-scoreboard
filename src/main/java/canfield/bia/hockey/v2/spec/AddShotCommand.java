package canfield.bia.hockey.v2.spec;

/**
 * Command to increment shots on goal for a team by one.
 * Payload:
 * - teamId: String (e.g., "home", "away")
 */
public record AddShotCommand(String teamId) implements Command {
}
