package canfield.bia.hockey.v2.spec;

/**
 * Command to manually force the game into the GAME_OVER state.
 * No payload.
 */
public record EndGameCommand() implements Command {
}
