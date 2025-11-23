package canfield.bia.hockey.v2.spec;

/**
 * Command to set the clock to a specific remaining time (in milliseconds).
 */
public record SetClockCommand(long timeMillis) implements Command {
}

