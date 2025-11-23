package canfield.bia.hockey.v2.spec;

/**
 * Command to reset the current game state to PRE_GAME without changing config.
 * No payload.
 */
public record ResetGameCommand() implements Command {
}
