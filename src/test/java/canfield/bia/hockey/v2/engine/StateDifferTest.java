package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class StateDifferTest {

    private StateDiffer stateDiffer;
    private GameConfig defaultConfig;

    @BeforeEach
    void setUp() {
        stateDiffer = new StateDiffer();
        defaultConfig = new GameConfig(
            "TEST_TEMPLATE",
            5,
            20,
            1,
            3,
            ClockType.STOP_TIME,
            null
        );
    }

    private GameState createInitialState() {
        return new GameState(
            "game-123",
            defaultConfig,
            GameStatus.PRE_GAME,
            1,
            new ClockState(defaultConfig.periodLengthMillis(), false, 0L),
            new TeamState(Collections.emptyList(), 0, Collections.emptyList()),
            new TeamState(Collections.emptyList(), 0, Collections.emptyList()),
            false,
            Collections.emptyList()
        );
    }

    @Test
    void testNoChangesReturnsEmptyPatch() {
        GameState oldState = createInitialState();
        GameState newState = createInitialState();

        Map<String, Object> patch = stateDiffer.diff(oldState, newState);

        assertTrue(patch.isEmpty());
    }

    @Test
    void testStatusChange() {
        GameState oldState = createInitialState();
        GameState newState = new GameState(
            oldState.gameId(),
            oldState.config(),
            GameStatus.PLAYING, // Changed
            oldState.period(),
            oldState.clock(),
            oldState.home(),
            oldState.away(),
            oldState.buzzerOn(),
            oldState.eventHistory()
        );

        Map<String, Object> patch = stateDiffer.diff(oldState, newState);

        assertEquals(1, patch.size());
        assertEquals(GameStatus.PLAYING, patch.get("status"));
    }

    @Test
    void testClockTimeChange() {
        GameState oldState = createInitialState();
        GameState newState = new GameState(
            oldState.gameId(),
            oldState.config(),
            oldState.status(),
            oldState.period(),
            new ClockState(1199000L, oldState.clock().isRunning(), oldState.clock().startTimeWallClock()), // Changed
            oldState.home(),
            oldState.away(),
            oldState.buzzerOn(),
            oldState.eventHistory()
        );

        Map<String, Object> patch = stateDiffer.diff(oldState, newState);

        assertEquals(1, patch.size());
        assertEquals(1199000L, patch.get("clock.timeRemainingMillis"));
    }

    @Test
    void testClockRunningStateChange() {
        GameState oldState = createInitialState();
        GameState newState = new GameState(
            oldState.gameId(),
            oldState.config(),
            oldState.status(),
            oldState.period(),
            new ClockState(oldState.clock().timeRemainingMillis(), true, 10000L), // Changed
            oldState.home(),
            oldState.away(),
            oldState.buzzerOn(),
            oldState.eventHistory()
        );

        Map<String, Object> patch = stateDiffer.diff(oldState, newState);

        assertEquals(1, patch.size());
        assertEquals(true, patch.get("clock.isRunning"));
    }

    @Test
    void testHomeShotsChange() {
        GameState oldState = createInitialState();
        TeamState newHome = new TeamState(oldState.home().goals(), 1, oldState.home().penalties()); // Changed
        GameState newState = new GameState(
            oldState.gameId(),
            oldState.config(),
            oldState.status(),
            oldState.period(),
            oldState.clock(),
            newHome,
            oldState.away(),
            oldState.buzzerOn(),
            oldState.eventHistory()
        );

        Map<String, Object> patch = stateDiffer.diff(oldState, newState);

        assertEquals(1, patch.size());
        assertEquals(1, patch.get("home.shots"));
    }

    @Test
    void testHomeGoalsChange() {
        GameState oldState = createInitialState();
        GoalEvent newGoal = new GoalEvent("goal-1", "home", 1, 1190000L, 10, Collections.emptyList(), false);
        TeamState newHome = new TeamState(List.of(newGoal), oldState.home().shots(), oldState.home().penalties()); // Changed
        GameState newState = new GameState(
            oldState.gameId(),
            oldState.config(),
            oldState.status(),
            oldState.period(),
            oldState.clock(),
            newHome,
            oldState.away(),
            oldState.buzzerOn(),
            oldState.eventHistory()
        );

        Map<String, Object> patch = stateDiffer.diff(oldState, newState);

        assertEquals(2, patch.size()); // goals list and derived score
        assertEquals(List.of(newGoal), patch.get("home.goals"));
        assertEquals(1, patch.get("home.score"));
    }

    @Test
    void testAwayPenaltiesChange() {
        GameState oldState = createInitialState();
        Penalty newPenalty = new Penalty("pen-1", "away", 20, 20, 120000L, 120000L, 0L, 1);
        TeamState newAway = new TeamState(oldState.away().goals(), oldState.away().shots(), List.of(newPenalty)); // Changed
        GameState newState = new GameState(
            oldState.gameId(),
            oldState.config(),
            oldState.status(),
            oldState.period(),
            oldState.clock(),
            oldState.home(),
            newAway,
            oldState.buzzerOn(),
            oldState.eventHistory()
        );

        Map<String, Object> patch = stateDiffer.diff(oldState, newState);

        assertEquals(1, patch.size());
        assertEquals(List.of(newPenalty), patch.get("away.penalties"));
    }
}
