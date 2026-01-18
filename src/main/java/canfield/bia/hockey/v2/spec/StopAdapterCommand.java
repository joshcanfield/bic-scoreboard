package canfield.bia.hockey.v2.spec;

/**
 * Command to stop the hardware scoreboard adapter (close serial port).
 * No payload required.
 */
public record StopAdapterCommand() implements Command {}
