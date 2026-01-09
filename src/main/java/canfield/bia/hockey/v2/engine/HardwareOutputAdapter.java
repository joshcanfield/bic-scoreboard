package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.GameState;

/**
 * Interface for adapting the GameState to any hardware output.
 */
public interface HardwareOutputAdapter {
    /**
     * Updates the hardware output to reflect the given GameState.
     * @param state The current GameState.
     */
    void update(GameState state);
}
