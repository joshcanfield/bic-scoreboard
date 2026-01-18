package canfield.bia.hockey.v2.spec;

/**
 * Command to start the hardware scoreboard adapter (serial port connection).
 * @param portName Optional serial port name (e.g., "COM10"). If null, uses previously configured port.
 */
public record StartAdapterCommand(String portName) implements Command {}
