package canfield.bia.hockey.v2.domain;

import java.util.List;

/**
 * An immutable record representing the entire state of a hockey game at a single point in time.
 */
public record GameState(
    String gameId,
    GameConfig config,
    GameStatus status,
    int period,
    ClockState clock,
    TeamState home,
    TeamState away,
    boolean buzzerOn,
    List<String> eventHistory // A log of event IDs for the 'undo' functionality
) {
    /**
     * Default constructor to represent the initial PRE_GAME state.
     */
    public GameState() {
        this(
            null,
            null,
            GameStatus.PRE_GAME,
            0,
            new ClockState(0, false, 0L),
            new TeamState(List.of(), 0, List.of(), List.of()),
            new TeamState(List.of(), 0, List.of(), List.of()),
            false,
            List.of()
        );
    }
}
