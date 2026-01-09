package canfield.bia.hockey.v2.spec;

/**
 * Internal command sent by the GameTimer to trigger a time recalculation.
 * No payload.
 */
public record TickCommand() implements Command {
}
