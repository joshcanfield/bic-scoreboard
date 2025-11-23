package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.*;
import canfield.bia.hockey.v2.spec.*; // Import all new command types
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer; // Import BiConsumer
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GameEngineTest {

    private GameEngine gameEngine;
    private long initialTime;
    private HardwareOutputAdapter mockHardwareOutputAdapter;
    private GameTimer mockGameTimer;
    private BiConsumer<GameState, GameState> mockStateChangeConsumer; // Changed to BiConsumer

    @BeforeEach
    void setUp() {
        mockHardwareOutputAdapter = mock(HardwareOutputAdapter.class);
        mockGameTimer = mock(GameTimer.class);
        mockStateChangeConsumer = mock(BiConsumer.class); // Initialize mock consumer as BiConsumer
        gameEngine = new GameEngine(new JsonTemplateRepository(), mockHardwareOutputAdapter, mockGameTimer, mockStateChangeConsumer);
        initialTime = 10000L; // Arbitrary start time for tests
        // createTestGame(initialTime); // Initialize the game state within the engine
    }

    private void createTestGame(long creationTime) {
        gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", Map.of()), creationTime);
    }

    @Test
    void testHardwareOutputAdapterIsCalledOnStateChange() {
        createTestGame(initialTime); // Add this line
        // Verify that update was called during the initial createTestGame
        verify(mockHardwareOutputAdapter, times(1)).update(any(GameState.class));

        // Perform another command to trigger an update
        StartClockCommand startClockCommand = new StartClockCommand();
        gameEngine.processCommand(startClockCommand, initialTime);

        // Verify that update was called again with the new state
        verify(mockHardwareOutputAdapter, times(2)).update(any(GameState.class));
        verify(mockHardwareOutputAdapter, times(1)).update(gameEngine.getCurrentState());
    }

    @Test
    void testGameTimerStartsOnStartClock() {
        createTestGame(initialTime); // Add this line
        StartClockCommand startClockCommand = new StartClockCommand();
        gameEngine.processCommand(startClockCommand, initialTime);

        verify(mockGameTimer, times(1)).start(any(Runnable.class));
    }

    @Test
    void testStartClock() {
        System.out.println("GameEngine in testStartClock: " + gameEngine);
        // Create a game to get to READY_FOR_PERIOD status
        Map<String, Object> overrides = new HashMap<>();
        overrides.put("periodLengthMinutes", 17);
        overrides.put("intermissionLengthMinutes", 1);
        overrides.put("periods", 3);
        overrides.put("clockType", ClockType.STOP_TIME.name());
        overrides.put("shiftLengthSeconds", null);
        gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", overrides), initialTime);

        gameEngine.processCommand(new StartClockCommand(), initialTime);
        GameState currentState = gameEngine.getCurrentState();

        assertEquals(GameStatus.PLAYING, currentState.status());
        assertTrue(currentState.clock().isRunning());
        assertEquals(initialTime, currentState.clock().startTimeWallClock());
    }

    @Test
    void testSetPeriodClampsToConfiguredRange() {
        createTestGame(initialTime);

        GameState afterIncrease = gameEngine.processCommand(new SetPeriodCommand(10), initialTime);
        assertEquals(3, afterIncrease.period(), "Period should not exceed configured maximum");

        GameState afterDecrease = gameEngine.processCommand(new SetPeriodCommand(-2), initialTime);
        assertEquals(0, afterDecrease.period(), "Period should not fall below zero");
    }

    @Test
    void testCreateGameUsesWarmupOverride() {
        Map<String, Object> overrides = new HashMap<>();
        overrides.put("warmupMinutes", 7);
        overrides.put("periodLengthMinutes", 15);
        overrides.put("intermissionLengthMinutes", 1);
        overrides.put("periods", 3);
        overrides.put("clockType", ClockType.STOP_TIME.name());
        GameState created = gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", overrides), initialTime);
        assertEquals(0, created.period());
        assertEquals(7 * 60 * 1000L, created.clock().timeRemainingMillis());
    }

    @Test
    void testSetPeriodZeroUsesWarmupLength() {
        createTestGame(initialTime);
        gameEngine.processCommand(new SetPeriodCommand(2), initialTime);
        GameState afterWarmupReset = gameEngine.processCommand(new SetPeriodCommand(0), initialTime);
        assertEquals(afterWarmupReset.config().warmupLengthMillis(), afterWarmupReset.clock().timeRemainingMillis());
    }

    @Test
    void testWarmupFinishesWithoutIntermission() {
        createTestGame(initialTime);
        gameEngine.processCommand(new StartClockCommand(), initialTime);
        GameState warmupPlaying = gameEngine.getCurrentState();
        long warmupMillis = warmupPlaying.clock().timeRemainingMillis();
        gameEngine.processCommand(new TickCommand(), initialTime + warmupMillis + 1000L);
        GameState afterWarmup = gameEngine.getCurrentState();
        assertEquals(GameStatus.READY_FOR_PERIOD, afterWarmup.status());
        assertEquals(1, afterWarmup.period());
        assertFalse(afterWarmup.clock().isRunning());
        assertEquals(afterWarmup.config().periodLengthMillis(), afterWarmup.clock().timeRemainingMillis());
    }

    @Test
    void testStartClockDuringIntermission() {
        createTestGame(initialTime);
        gameEngine.processCommand(new SetPeriodCommand(1), initialTime);
        gameEngine.processCommand(new StartClockCommand(), initialTime);
        GameState playing = gameEngine.getCurrentState();
        long periodMillis = playing.clock().timeRemainingMillis();
        gameEngine.processCommand(new TickCommand(), initialTime + periodMillis + 1000L);
        GameState intermissionState = gameEngine.getCurrentState();
        assertEquals(GameStatus.INTERMISSION, intermissionState.status());
        assertFalse(intermissionState.clock().isRunning());
        GameState resumed = gameEngine.processCommand(new StartClockCommand(), initialTime + periodMillis + 2000L);
        assertEquals(GameStatus.INTERMISSION, resumed.status());
        assertTrue(resumed.clock().isRunning());
    }

    @Test
    void testBuzzerAutoResetsAfterTrigger() throws InterruptedException {
        createTestGame(initialTime);
        gameEngine.processCommand(new TriggerBuzzerCommand(), initialTime);
        assertTrue(gameEngine.getCurrentState().buzzerOn(), "Buzzer should be on immediately after trigger");
        gameEngine.processCommand(new TickCommand(), initialTime + 4000L);
        assertFalse(gameEngine.getCurrentState().buzzerOn(), "Buzzer should auto-reset after delay");
    }

    @Test
    void testBuzzerAutoResetsAfterPeriodCompletes() throws InterruptedException {
        createTestGame(initialTime);
        gameEngine.processCommand(new SetPeriodCommand(1), initialTime);
        gameEngine.processCommand(new StartClockCommand(), initialTime);
        GameState playing = gameEngine.getCurrentState();
        long remaining = playing.clock().timeRemainingMillis();
        gameEngine.processCommand(new TickCommand(), initialTime + remaining + 1000L);
        assertEquals(GameStatus.INTERMISSION, gameEngine.getCurrentState().status());
        assertTrue(gameEngine.getCurrentState().buzzerOn(), "Buzzer should ring at end of period");
        gameEngine.processCommand(new TickCommand(), initialTime + remaining + 5000L);
        assertFalse(gameEngine.getCurrentState().buzzerOn(), "Buzzer should auto-reset after intermission ring");
    }

    @Test
    void testBuzzerAutoResetsWithRealTimer() throws InterruptedException {
        HardwareOutputAdapter adapter = mock(HardwareOutputAdapter.class);
        ScheduledGameTimer realTimer = new ScheduledGameTimer();
        CountDownLatch buzzerOn = new CountDownLatch(1);
        CountDownLatch buzzerOff = new CountDownLatch(1);
        GameEngine engine = new GameEngine(
            new JsonTemplateRepository(),
            adapter,
            realTimer,
            (oldState, newState) -> {
                if (oldState != null && !oldState.buzzerOn() && newState.buzzerOn()) {
                    buzzerOn.countDown();
                }
                if (oldState != null && oldState.buzzerOn() && !newState.buzzerOn()) {
                    buzzerOff.countDown();
                }
            }
        );
        long now = System.currentTimeMillis();
        engine.processCommand(new CreateGameCommand("USAH_ADULT_20", Map.of(
            "periodLengthMinutes", 1,
            "intermissionLengthMinutes", 1,
            "periods", 1,
            "warmupMinutes", 0
        )), now);
        engine.processCommand(new SetPeriodCommand(1), now);
        engine.processCommand(new SetClockCommand(1000L), now);
        engine.processCommand(new StartClockCommand(), now);
        assertTrue(buzzerOn.await(3, TimeUnit.SECONDS), "Buzzer should turn on");
        assertTrue(buzzerOff.await(6, TimeUnit.SECONDS), "Auto-reset should fire");
        realTimer.stop();
    }

    @Test
    void testSetClockCommandClampsAndPauses() {
        createTestGame(initialTime);
        gameEngine.processCommand(new StartClockCommand(), initialTime);
        GameState afterSet = gameEngine.processCommand(new SetClockCommand(25 * 60 * 1000L), initialTime + 1000);
        assertFalse(afterSet.clock().isRunning());
        assertEquals(GameStatus.PAUSED, afterSet.status());
        assertEquals(gameEngine.getCurrentState().config().periodLengthMillis(), afterSet.clock().timeRemainingMillis());
        verify(mockGameTimer, atLeastOnce()).stop();
    }

    // @Test
    // void testGameTimerStopsOnPauseClock() {
    //     // Create a game and start the clock to get to PLAYING status
    //     gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", Map.of(
    //         "periodLengthMinutes", 17,
    //         "intermissionLengthMinutes", 1,
    //         "periods", 3,
    //         "clockType", ClockType.STOP_TIME.name(),
    //         "shiftLengthSeconds", null
    //     )), initialTime);
    //     gameEngine.processCommand(new StartClockCommand(), initialTime);
    //     verify(mockGameTimer, times(1)).start(any(Runnable.class));

    //     // Then pause it
    //     long pauseTime = initialTime + 5000L;
    //     gameEngine.processCommand(new PauseClockCommand(), pauseTime);

    //     verify(mockGameTimer, times(1)).stop();
    // }

    // @Test
    // void testTickCommandIsSentByTimer() {
    //     createTestGame(initialTime); // Add this line
    //     // Capture the runnable passed to gameTimer.start()
    //     ArgumentCaptor<Runnable> runnableCaptor = ArgumentCaptor.forClass(Runnable.class);
    //     gameEngine.processCommand(new StartClockCommand(), initialTime);
    //     verify(mockGameTimer).start(runnableCaptor.capture());

    //     // Simulate a tick from the timer
    //     Runnable tickRunnable = runnableCaptor.getValue();
    //     tickRunnable.run(); // This should trigger a processCommand with TickCommand

    //     // Verify that processCommand was called with a TickCommand
    //     // We need to verify the internal call to processCommand, which is harder with mocks.
    //     // Instead, we can verify the effect on the state.
    //     // For this test, we'll rely on the fact that the tickRunnable calls processCommand
    //     // and that processCommand updates the state.
    //     // A more robust test might involve spying on the GameEngine or using a custom mock.
    //     // For now, we'll check if the state changed as a result of the tick.
    //     GameState stateAfterTick = gameEngine.getCurrentState();
    //     // The initial state is READY_FOR_PERIOD, then START_CLOCK makes it PLAYING.
    //     // A tick should update the time remaining.
    //     assertNotEquals(1200000L, stateAfterTick.clock().timeRemainingMillis()); // Time should have advanced
    // }


    // @Test
    // void testCreateGameCommand() {
    //     // Initial state should be empty/default before any commands
    //     GameState initialState = gameEngine.getCurrentState();
    //     assertEquals(GameStatus.PRE_GAME, initialState.status()); // Default status
    //     assertEquals(0, initialState.period()); // Default period
    //     assertEquals(0L, initialState.clock().timeRemainingMillis()); // Default clock

    //     createTestGame(initialTime); // Now create the game
    //     GameState currentState = gameEngine.getCurrentState();
    //     assertEquals(GameStatus.READY_FOR_PERIOD, currentState.status());
    //     assertEquals(1, currentState.period());
    //     assertEquals(1020000L, currentState.config().periodLengthMillis()); // 17 minutes
    //     assertEquals(0L, currentState.clock().startTimeWallClock());
    // }

    // @Test
    // void testPauseClock() {
    //     // Create a game and start the clock to get to PLAYING status
    //     gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", Map.of(
    //         "periodLengthMinutes", 17,
    //         "intermissionLengthMinutes", 1,
    //         "periods", 3,
    //         "clockType", ClockType.STOP_TIME.name(),
    //         "shiftLengthSeconds", null
    //     )), initialTime);
    //     gameEngine.processCommand(new StartClockCommand(), initialTime);

    //     long pauseTime = initialTime + 5000L; // 5 seconds later
    //     gameEngine.processCommand(new PauseClockCommand(), pauseTime);
    //     GameState currentState = gameEngine.getCurrentState();

    //     assertEquals(GameStatus.PAUSED, currentState.status());
    //     assertFalse(currentState.clock().isRunning());
    //     assertEquals(0L, currentState.clock().startTimeWallClock());
    //     assertEquals(1020000L - 5000L, currentState.clock().timeRemainingMillis()); // 17 minutes - 5 seconds
    // }

    // @Test
    // void testTickRecalculatesTime() {
    //     createTestGame(initialTime); // Add this line
    //     gameEngine.processCommand(new StartClockCommand(), initialTime);
    //     long tickTime = initialTime + 1000L; // 1 second later
    //     gameEngine.processCommand(new TickCommand(), tickTime);
    //     GameState currentState = gameEngine.getCurrentState();

    //     // After the first tick, startTimeWallClock is updated to tickTime.
    //     // The time remaining should be the initial period length minus the elapsed time from initialTime to tickTime.
    //     long expectedRemaining = 1020000L - (tickTime - initialTime); // 17 minutes
    //     assertEquals(expectedRemaining, currentState.clock().timeRemainingMillis());
    //     assertEquals(tickTime, currentState.clock().startTimeWallClock()); // Verify startTimeWallClock is updated
    // }


    // @Test
    // void testAddPenalty() {
    //     // Create a game and start the clock to get to PLAYING status
    //     gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", Map.of(
    //         "periodLengthMinutes", 17,
    //         "intermissionLengthMinutes", 1,
    //         "periods", 3,
    //         "clockType", ClockType.STOP_TIME.name(),
    //         "shiftLengthSeconds", null
    //     )), initialTime);
    //     gameEngine.processCommand(new StartClockCommand(), initialTime);

    //     AddPenaltyCommand addPenaltyCommand = new AddPenaltyCommand("home", 42, 42, 2);
    //     gameEngine.processCommand(addPenaltyCommand, initialTime);
    //     GameState currentState = gameEngine.getCurrentState();

    //     assertEquals(1, currentState.home().penalties().size());
    //     var penalty = currentState.home().penalties().getFirst();
    //     assertEquals(42, penalty.playerNumber());
    //     assertEquals(120000L, penalty.durationMillis());
    //     assertEquals(0L, penalty.startTimeWallClock());
    // }

    // @Test
    // void testAddGoal() {
    //     createTestGame(initialTime); // Add this line
    //     AddGoalCommand addGoalCommand = new AddGoalCommand("home", 17, List.of(9, 10), false);
    //     gameEngine.processCommand(addGoalCommand, initialTime);
    //     GameState currentState = gameEngine.getCurrentState();

    //     assertEquals(1, currentState.home().goals().size());
    //     assertEquals(1, currentState.home().getScore());
    //     var goal = currentState.home().goals().getFirst();
    //     assertEquals("home", goal.teamId());
    //     assertEquals(17, goal.scorerNumber());
    //     assertEquals(List.of(9, 10), goal.assistNumbers());
    //     assertFalse(goal.isEmptyNet());
    //     assertEquals(1200000L, goal.timeInPeriodMillis());
    // }

    // @Test
    // void testRemoveGoal() {
    //     createTestGame(initialTime); // Add this line
    //     AddGoalCommand addGoalCommand = new AddGoalCommand("home", 17, List.of(9, 10), false);
    //     gameEngine.processCommand(addGoalCommand, initialTime);
    //     String goalIdToRemove = gameEngine.getCurrentState().home().goals().getFirst().goalId();

    //     RemoveGoalCommand removeGoalCommand = new RemoveGoalCommand(goalIdToRemove);
    //     gameEngine.processCommand(removeGoalCommand, initialTime);
    //     GameState currentState = gameEngine.getCurrentState();

    //     assertTrue(currentState.home().goals().isEmpty());
    //     assertEquals(0, currentState.home().getScore());
    // }

    // @Test
    // void testRemoveNonExistentGoal() {
    //     createTestGame(initialTime); // Add this line
    //     AddGoalCommand addGoalCommand = new AddGoalCommand("home", 17, List.of(9, 10), false);
    //     gameEngine.processCommand(addGoalCommand, initialTime);
    //     GameState stateBefore = gameEngine.getCurrentState();

    //     RemoveGoalCommand removeGoalCommand = new RemoveGoalCommand("non-existent-id");
    //     gameEngine.processCommand(removeGoalCommand, initialTime);
    //     GameState stateAfter = gameEngine.getCurrentState();

    //     assertEquals(1, stateAfter.home().goals().size());
    //     assertEquals(1, stateAfter.home().getScore());
    //     assertSame(stateBefore, stateAfter); // State should be identical if no change occurred
    // }

    // @Test
    // void testAddShot() {
    //     createTestGame(initialTime); // Add this line
    //     AddShotCommand addShotCommand = new AddShotCommand("home");
    //     gameEngine.processCommand(addShotCommand, initialTime);
    //     GameState currentState = gameEngine.getCurrentState();

    //     assertEquals(1, currentState.home().shots());
    //     assertEquals(0, currentState.away().shots());
    // }

    // @Test
    // void testUndoLastShot() {
    //     createTestGame(initialTime); // Add this line
    //     AddShotCommand addShotCommand = new AddShotCommand("home");
    //     gameEngine.processCommand(addShotCommand, initialTime);
    //     assertEquals(1, gameEngine.getCurrentState().home().shots());

    //     UndoLastShotCommand undoLastShotCommand = new UndoLastShotCommand("home");
    //     gameEngine.processCommand(undoLastShotCommand, initialTime);
    //     GameState currentState = gameEngine.getCurrentState();

    //     assertEquals(0, currentState.home().shots());
    // }

    // @Test
    // void testUndoLastShot_doesNotGoBelowZero() {
    //     createTestGame(initialTime); // Add this line
    //     GameState stateBefore = gameEngine.getCurrentState();
    //     UndoLastShotCommand undoLastShotCommand = new UndoLastShotCommand("home");
    //     gameEngine.processCommand(undoLastShotCommand, initialTime);
    //     GameState stateAfter = gameEngine.getCurrentState();

    //     assertEquals(0, stateAfter.home().shots());
    //     assertSame(stateBefore, stateAfter); // State should be identical if no change occurred
    // }

    // @Test
    // void testEndGame() {
    //     createTestGame(initialTime); // Add this line
    //     EndGameCommand endGameCommand = new EndGameCommand();
    //     gameEngine.processCommand(endGameCommand, initialTime);
    //     GameState currentState = gameEngine.getCurrentState();

    //     assertEquals(GameStatus.GAME_OVER, currentState.status());
    //     assertFalse(currentState.clock().isRunning());
    // }

    // @Test
    // void testResetGame() {
    //     createTestGame(initialTime); // Add this line
    //     // Create a game, add some state changes
    //     gameEngine.processCommand(new AddGoalCommand("home", 1, List.of(), false), initialTime);
    //     gameEngine.processCommand(new AddPenaltyCommand("away", 2, 2, 2), initialTime);
    //     gameEngine.processCommand(new AddShotCommand("home"), initialTime);

    //     GameState stateWithChanges = gameEngine.getCurrentState();
    //     assertEquals(1, stateWithChanges.home().getScore());
    //     assertEquals(1, stateWithChanges.home().shots());
    //     assertEquals(1, stateWithChanges.away().penalties().size());

    //     ResetGameCommand resetGameCommand = new ResetGameCommand();
    //     gameEngine.processCommand(resetGameCommand, initialTime);
    //     GameState currentState = gameEngine.getCurrentState();

    //     assertEquals(GameStatus.PRE_GAME, currentState.status());
    //     assertFalse(currentState.clock().isRunning());
    //     assertEquals(0L, currentState.clock().timeRemainingMillis()); // Corrected to expect 0L
    //     assertEquals(0, currentState.home().getScore());
    //     assertEquals(0, currentState.home().shots());
    //     assertTrue(currentState.home().penalties().isEmpty());
    //     assertEquals(0, currentState.away().getScore());
    //     assertEquals(0, currentState.away().shots());
    //     assertTrue(currentState.away().penalties().isEmpty());
    //     assertNotNull(currentState.config());
    //     assertEquals(stateWithChanges.config(), currentState.config());
    // }

    // @Test
    // void testTemplatesJsonLoads() {
    //     String resourcePath = "/templates.json";
    //     InputStream is = getClass().getResourceAsStream(resourcePath);
    //     assertNotNull(is, "templates.json should be found on the classpath.");
    //     try {
    //         is.close();
    //     } catch (java.io.IOException e) {
    //         fail("Failed to close InputStream", e);
    //     }
    // }

    @Test
    void testAddGoal() {
        createTestGame(initialTime); // Add this line
        AddGoalCommand addGoalCommand = new AddGoalCommand("home", 17, List.of(9, 10), false);
        gameEngine.processCommand(addGoalCommand, initialTime);
        GameState currentState = gameEngine.getCurrentState();

        assertEquals(1, currentState.home().goals().size());
        assertEquals(1, currentState.home().getScore());
        var goal = currentState.home().goals().getFirst();
        assertEquals("home", goal.teamId());
        assertEquals(17, goal.scorerNumber());
        assertEquals(List.of(9, 10), goal.assistNumbers());
        assertFalse(goal.isEmptyNet());
        assertEquals(1200000L, goal.timeInPeriodMillis());
    }

    @Test
    void testRemoveGoal() {
        createTestGame(initialTime); // Add this line
        AddGoalCommand addGoalCommand = new AddGoalCommand("home", 17, List.of(9, 10), false);
        gameEngine.processCommand(addGoalCommand, initialTime);
        String goalIdToRemove = gameEngine.getCurrentState().home().goals().getFirst().goalId();

        RemoveGoalCommand removeGoalCommand = new RemoveGoalCommand(goalIdToRemove);
        gameEngine.processCommand(removeGoalCommand, initialTime);
        GameState currentState = gameEngine.getCurrentState();

        assertTrue(currentState.home().goals().isEmpty());
        assertEquals(0, currentState.home().getScore());
    }

    @Test
    void testRemoveNonExistentGoal() {
        createTestGame(initialTime); // Add this line
        AddGoalCommand addGoalCommand = new AddGoalCommand("home", 17, List.of(9, 10), false);
        gameEngine.processCommand(addGoalCommand, initialTime);
        GameState stateBefore = gameEngine.getCurrentState();

        RemoveGoalCommand removeGoalCommand = new RemoveGoalCommand("non-existent-id");
        gameEngine.processCommand(removeGoalCommand, initialTime);
        GameState stateAfter = gameEngine.getCurrentState();

        assertEquals(1, stateAfter.home().goals().size());
        assertEquals(1, stateAfter.home().getScore());
        assertSame(stateBefore, stateAfter); // State should be identical if no change occurred
    }

    @Test
    void testAddShot() {
        createTestGame(initialTime); // Add this line
        AddShotCommand addShotCommand = new AddShotCommand("home");
        gameEngine.processCommand(addShotCommand, initialTime);
        GameState currentState = gameEngine.getCurrentState();

        assertEquals(1, currentState.home().shots());
        assertEquals(0, currentState.away().shots());
    }

    @Test
    void testUndoLastShot() {
        createTestGame(initialTime); // Add this line
        AddShotCommand addShotCommand = new AddShotCommand("home");
        gameEngine.processCommand(addShotCommand, initialTime);
        assertEquals(1, gameEngine.getCurrentState().home().shots());

        UndoLastShotCommand undoLastShotCommand = new UndoLastShotCommand("home");
        gameEngine.processCommand(undoLastShotCommand, initialTime);
        GameState currentState = gameEngine.getCurrentState();

        assertEquals(0, currentState.home().shots());
    }

    @Test
    void testUndoLastShot_doesNotGoBelowZero() {
        createTestGame(initialTime); // Add this line
        GameState stateBefore = gameEngine.getCurrentState();
        UndoLastShotCommand undoLastShotCommand = new UndoLastShotCommand("home");
        gameEngine.processCommand(undoLastShotCommand, initialTime);
        GameState stateAfter = gameEngine.getCurrentState();

        assertEquals(0, stateAfter.home().shots());
        assertSame(stateBefore, stateAfter); // State should be identical if no change occurred
    }

    @Test
    void testEndGame() {
        createTestGame(initialTime); // Add this line
        EndGameCommand endGameCommand = new EndGameCommand();
        gameEngine.processCommand(endGameCommand, initialTime);
        GameState currentState = gameEngine.getCurrentState();

        assertEquals(GameStatus.GAME_OVER, currentState.status());
        assertFalse(currentState.clock().isRunning());
    }

    @Test
    void testResetGame() {
        createTestGame(initialTime); // Add this line
        // Create a game, add some state changes
        gameEngine.processCommand(new AddGoalCommand("home", 1, List.of(), false), initialTime);
        gameEngine.processCommand(new AddPenaltyCommand("away", 2, 2, 2), initialTime);
        gameEngine.processCommand(new AddShotCommand("home"), initialTime);

        GameState stateWithChanges = gameEngine.getCurrentState();
        assertEquals(1, stateWithChanges.home().getScore());
        assertEquals(1, stateWithChanges.home().shots());
        assertEquals(1, stateWithChanges.away().penalties().size());

        ResetGameCommand resetGameCommand = new ResetGameCommand();
        gameEngine.processCommand(resetGameCommand, initialTime);
        GameState currentState = gameEngine.getCurrentState();

        assertEquals(GameStatus.PRE_GAME, currentState.status());
        assertFalse(currentState.clock().isRunning());
        assertEquals(stateWithChanges.config().periodLengthMillis(), currentState.clock().timeRemainingMillis());
        assertEquals(0, currentState.home().getScore());
        assertEquals(0, currentState.home().shots());
        assertTrue(currentState.home().penalties().isEmpty());
        assertEquals(0, currentState.away().getScore());
        assertEquals(0, currentState.away().shots());
        assertTrue(currentState.away().penalties().isEmpty());
        assertNotNull(currentState.config());
        assertEquals(stateWithChanges.config(), currentState.config());
    }

    @Test
    void testTemplatesJsonLoads() {
        String resourcePath = "/templates.json";
        InputStream is = getClass().getResourceAsStream(resourcePath);
        assertNotNull(is, "templates.json should be found on the classpath.");
        try {
            is.close();
        } catch (java.io.IOException e) {
            fail("Failed to close InputStream", e);
        }
    }
}
