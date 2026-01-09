package canfield.bia.hockey.v2.spec;

/**
 * Command to decrement shots on goal for a team by one.
 * Payload:
 * - teamId: String (e.g., "home", "away")
 */
public record UndoLastShotCommand(String teamId) implements Command {
}
