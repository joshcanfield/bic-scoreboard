package canfield.bia.hockey.v2.spec;

/**
 * Command to remove a specific goal event by its unique ID.
 * Payload:
 * - goalId: String (unique ID of the goal to remove)
 */
public record RemoveGoalCommand(String goalId) implements Command {
}
