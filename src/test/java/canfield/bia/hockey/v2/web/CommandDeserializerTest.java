package canfield.bia.hockey.v2.web;

import canfield.bia.hockey.v2.spec.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CommandDeserializerTest {

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        SimpleModule module = new SimpleModule();
        module.addDeserializer(Command.class, new CommandDeserializer());
        objectMapper.registerModule(module);
    }

    @Test
    void testDeserializeCreateGameCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "CREATE_GAME",
                "payload": {
                    "templateId": "USAH_ADULT_20",
                    "overrides": {}
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(CreateGameCommand.class, command);
        CreateGameCommand createGame = (CreateGameCommand) command;
        assertEquals("USAH_ADULT_20", createGame.templateId());
        assertTrue(createGame.overrides().isEmpty());
    }

    @Test
    void testDeserializeCreateGameCommandWithOverrides() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "CREATE_GAME",
                "payload": {
                    "templateId": "USAH_ADULT_20",
                    "overrides": {
                        "periodLengthMinutes": 15,
                        "intermissionMinutes": 5
                    }
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(CreateGameCommand.class, command);
        CreateGameCommand createGame = (CreateGameCommand) command;
        assertEquals("USAH_ADULT_20", createGame.templateId());
        assertEquals(2, createGame.overrides().size());
        assertEquals(15, createGame.overrides().get("periodLengthMinutes"));
    }

    @Test
    void testDeserializeStartClockCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "START_CLOCK",
                "payload": {}
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(StartClockCommand.class, command);
    }

    @Test
    void testDeserializePauseClockCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "PAUSE_CLOCK",
                "payload": {}
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(PauseClockCommand.class, command);
    }

    @Test
    void testDeserializeAddGoalCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "ADD_GOAL",
                "payload": {
                    "teamId": "home",
                    "scorerNumber": 10,
                    "assistNumbers": [7, 22],
                    "isEmptyNet": false
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(AddGoalCommand.class, command);
        AddGoalCommand addGoal = (AddGoalCommand) command;
        assertEquals("home", addGoal.teamId());
        assertEquals(10, addGoal.scorerNumber());
        assertEquals(2, addGoal.assistNumbers().size());
        assertEquals(7, addGoal.assistNumbers().get(0));
        assertEquals(22, addGoal.assistNumbers().get(1));
        assertFalse(addGoal.isEmptyNet());
    }

    @Test
    void testDeserializeRemoveGoalCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "REMOVE_GOAL",
                "payload": {
                    "goalId": "goal-123"
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(RemoveGoalCommand.class, command);
        RemoveGoalCommand removeGoal = (RemoveGoalCommand) command;
        assertEquals("goal-123", removeGoal.goalId());
    }

    @Test
    void testDeserializeAddShotCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "ADD_SHOT",
                "payload": {
                    "teamId": "home"
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(AddShotCommand.class, command);
        AddShotCommand addShot = (AddShotCommand) command;
        assertEquals("home", addShot.teamId());
    }

    @Test
    void testDeserializeUndoLastShotCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "UNDO_LAST_SHOT",
                "payload": {
                    "teamId": "away"
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(UndoLastShotCommand.class, command);
        UndoLastShotCommand undoShot = (UndoLastShotCommand) command;
        assertEquals("away", undoShot.teamId());
    }

    @Test
    void testDeserializeAddPenaltyCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "ADD_PENALTY",
                "payload": {
                    "teamId": "home",
                    "playerNumber": 15,
                    "servingPlayerNumber": 15,
                    "durationMinutes": 2
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(AddPenaltyCommand.class, command);
        AddPenaltyCommand addPenalty = (AddPenaltyCommand) command;
        assertEquals("home", addPenalty.teamId());
        assertEquals(15, addPenalty.playerNumber());
        assertEquals(15, addPenalty.servingPlayerNumber());
        assertEquals(2, addPenalty.durationMinutes());
    }

    @Test
    void testDeserializeSetPeriodCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "SET_PERIOD",
                "payload": {
                    "period": 2
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(SetPeriodCommand.class, command);
        SetPeriodCommand setPeriod = (SetPeriodCommand) command;
        assertEquals(2, setPeriod.period());
    }

    @Test
    void testDeserializeSetClockCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "SET_CLOCK",
                "payload": {
                    "timeMillis": 330000
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(SetClockCommand.class, command);
        SetClockCommand setClock = (SetClockCommand) command;
        assertEquals(330000L, setClock.timeMillis());
    }

    @Test
    void testDeserializeTriggerBuzzerCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "TRIGGER_BUZZER",
                "payload": {}
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(TriggerBuzzerCommand.class, command);
    }

    @Test
    void testDeserializeTickCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "TICK",
                "payload": {}
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(TickCommand.class, command);
    }

    @Test
    void testDeserializeEndGameCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "END_GAME",
                "payload": {}
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(EndGameCommand.class, command);
    }

    @Test
    void testDeserializeResetGameCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "RESET_GAME",
                "payload": {}
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(ResetGameCommand.class, command);
    }

    @Test
    void testUnknownCommandTypeThrowsException() {
        String json = """
            {
                "type": "COMMAND",
                "command": "UNKNOWN_COMMAND",
                "payload": {}
            }
            """;

        assertThrows(Exception.class, () -> objectMapper.readValue(json, Command.class));
    }

    // ===== Tests for new commands =====

    @Test
    void testDeserializeCancelPenaltyCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "CANCEL_PENALTY",
                "payload": {
                    "penaltyId": "penalty-123"
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(CancelPenaltyCommand.class, command);
        CancelPenaltyCommand cancelPenalty = (CancelPenaltyCommand) command;
        assertEquals("penalty-123", cancelPenalty.penaltyId());
    }

    @Test
    void testDeserializeStartAdapterCommandWithPort() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "START_ADAPTER",
                "payload": {
                    "portName": "COM3"
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(StartAdapterCommand.class, command);
        StartAdapterCommand startAdapter = (StartAdapterCommand) command;
        assertEquals("COM3", startAdapter.portName());
    }

    @Test
    void testDeserializeStartAdapterCommandWithoutPort() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "START_ADAPTER",
                "payload": {}
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(StartAdapterCommand.class, command);
        StartAdapterCommand startAdapter = (StartAdapterCommand) command;
        assertNull(startAdapter.portName());
    }

    @Test
    void testDeserializeStartAdapterCommandWithNullPayload() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "START_ADAPTER"
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(StartAdapterCommand.class, command);
        StartAdapterCommand startAdapter = (StartAdapterCommand) command;
        assertNull(startAdapter.portName());
    }

    @Test
    void testDeserializeStopAdapterCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "STOP_ADAPTER",
                "payload": {}
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(StopAdapterCommand.class, command);
    }

    @Test
    void testDeserializeGetPortsCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "GET_PORTS",
                "payload": {}
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(GetPortsCommand.class, command);
    }

    @Test
    void testDeserializeReleasePenaltyCommand() throws Exception {
        String json = """
            {
                "type": "COMMAND",
                "command": "RELEASE_PENALTY",
                "payload": {
                    "penaltyId": "penalty-456",
                    "releasedByGoalId": "goal-789"
                }
            }
            """;

        Command command = objectMapper.readValue(json, Command.class);

        assertInstanceOf(ReleasePenaltyCommand.class, command);
        ReleasePenaltyCommand release = (ReleasePenaltyCommand) command;
        assertEquals("penalty-456", release.penaltyId());
        assertEquals("goal-789", release.releasedByGoalId());
    }

    // ===== Test for missing command field =====

    @Test
    void testMissingCommandFieldThrowsException() {
        String json = """
            {
                "type": "COMMAND",
                "payload": {}
            }
            """;

        Exception exception = assertThrows(Exception.class, () -> objectMapper.readValue(json, Command.class));
        assertTrue(exception.getMessage().contains("Missing 'command' field") ||
                   exception.getCause() != null && exception.getCause().getMessage().contains("Missing 'command' field"));
    }
}
