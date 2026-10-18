package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.GameState;
import canfield.bia.hockey.v2.domain.GameStatus;
import canfield.bia.hockey.v2.spec.CreateGameCommand;
import canfield.bia.hockey.v2.spec.SetPeriodCommand;
import canfield.bia.hockey.v2.spec.StartClockCommand;
import canfield.bia.hockey.v2.spec.TickCommand;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.function.BiConsumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class GameLifecycleTest {

    private GameEngine gameEngine;
    private long initialTime;

    @BeforeEach
    void setUp() {
        HardwareOutputAdapter mockHardware = mock(HardwareOutputAdapter.class);
        GameTimer mockTimer = mock(GameTimer.class);
        BiConsumer<GameState, GameState> mockConsumer = mock(BiConsumer.class);
        gameEngine = new GameEngine(new JsonTemplateRepository(), mockHardware, mockTimer, mockConsumer);
        initialTime = 10000L;
    }

    @Test
    void finalPeriodClockExpiryTransitionsToGameOver() {
        gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", Map.of(
            "warmupMinutes", 0,
            "periods", 3,
            "periodLengthMinutes", 1,
            "intermissionLengthMinutes", 1
        )), initialTime);

        // Set to final period (3) and start clock
        gameEngine.processCommand(new SetPeriodCommand(3), initialTime);
        gameEngine.processCommand(new StartClockCommand(), initialTime);

        // Tick past the 1 minute period clock
        long periodEnd = initialTime + 60000L + 100L;
        gameEngine.processCommand(new TickCommand(), periodEnd);

        GameState state = gameEngine.getCurrentState();
        assertEquals(GameStatus.GAME_OVER, state.status(),
            "Expected GAME_OVER when final period expires, but got: " + state.status());
    }

    @Test
    void zeroMinuteIntermissionAutoAdvancesToNextPeriod() {
        gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", Map.of(
            "warmupMinutes", 0,
            "periods", 3,
            "periodLengthMinutes", 1,
            "intermissionLengthMinutes", 0
        )), initialTime);

        // In period 1, start clock and tick past period end
        gameEngine.processCommand(new StartClockCommand(), initialTime);
        long periodEnd = initialTime + 60000L + 100L;
        gameEngine.processCommand(new TickCommand(), periodEnd);

        GameState state = gameEngine.getCurrentState();
        assertEquals(2, state.period());
        assertEquals(GameStatus.READY_FOR_PERIOD, state.status(),
            "Expected READY_FOR_PERIOD for period 2 with 0-minute intermission, but got: " + state.status());
    }

    @Test
    void testAddPenaltyDeserialization() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        com.fasterxml.jackson.databind.module.SimpleModule module = new com.fasterxml.jackson.databind.module.SimpleModule();
        module.addDeserializer(canfield.bia.hockey.v2.spec.Command.class, new canfield.bia.hockey.v2.web.CommandDeserializer());
        mapper.registerModule(module);

        String json = "{\"type\":\"COMMAND\",\"command\":\"ADD_PENALTY\",\"payload\":{\"teamId\":\"home\",\"playerNumber\":22,\"servingPlayerNumber\":22,\"durationMinutes\":2,\"durationMillis\":120000,\"infractionType\":\"TRIPPING\",\"customInfractionDescription\":null,\"offTimeGameClockMillis\":120000}}";
        canfield.bia.hockey.v2.spec.Command cmd = mapper.readValue(json, canfield.bia.hockey.v2.spec.Command.class);
        org.junit.jupiter.api.Assertions.assertTrue(cmd instanceof canfield.bia.hockey.v2.spec.AddPenaltyCommand);
    }

    @Test
    void resetGameWithZeroWarmupSkipsToPeriodOne() {
        gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", Map.of(
            "warmupMinutes", 0,
            "periods", 3,
            "periodLengthMinutes", 20,
            "intermissionLengthMinutes", 1
        )), initialTime);

        // After createNewGame with warmup=0, initial period is 1 and status is READY_FOR_PERIOD
        assertEquals(1, gameEngine.getCurrentState().period());
        assertEquals(GameStatus.READY_FOR_PERIOD, gameEngine.getCurrentState().status());

        // Modify period to 2
        gameEngine.processCommand(new SetPeriodCommand(2), initialTime);
        assertEquals(2, gameEngine.getCurrentState().period());

        // Reset game
        gameEngine.processCommand(new canfield.bia.hockey.v2.spec.ResetGameCommand(), initialTime);

        GameState state = gameEngine.getCurrentState();
        assertEquals(1, state.period(), "Expected period 1 on reset when warmup is 0, but was: " + state.period());
        assertEquals(GameStatus.READY_FOR_PERIOD, state.status(),
            "Expected READY_FOR_PERIOD on reset when warmup is 0, but was: " + state.status());
    }
}
