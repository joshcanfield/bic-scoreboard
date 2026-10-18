package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.GameState;

import java.util.List;

/**
 * Interface for adapting the GameState to any hardware output.
 */
public interface HardwareOutputAdapter {
    /**
     * Updates the hardware output to reflect the given GameState.
     * @param state The current GameState.
     */
    void update(GameState state);

    /**
     * Start the hardware adapter (e.g., open serial port connection).
     */
    void start();

    /**
     * Stop the hardware adapter (e.g., close serial port connection).
     */
    void stop();

    /**
     * Check if the hardware adapter is currently running.
     * @return true if running, false otherwise.
     */
    boolean isRunning();

    /**
     * Get the list of available port names.
     * @return List of port names (e.g., ["COM1", "COM3", "COM10"])
     */
    List<String> getPossiblePorts();

    /**
     * Set the port name to use for connection.
     * @param portName The port name (e.g., "COM10")
     */
    void setPortName(String portName);

    /**
     * Get the currently configured port name.
     * @return The port name, or null if not set.
     */
    String getPortName();
}
