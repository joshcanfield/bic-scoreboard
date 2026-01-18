package canfield.bia.hockey.v2.spec;

/**
 * Command to query available serial ports.
 * The response will be sent via WebSocket with event type "ports".
 */
public record GetPortsCommand() implements Command {}
