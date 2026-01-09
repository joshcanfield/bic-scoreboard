package canfield.bia.hockey.v2.web;

import canfield.bia.hockey.v2.spec.*;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;

/**
 * Custom JsonDeserializer for the Command interface to handle polymorphic deserialization.
 * It inspects the "type" field in the JSON to determine the concrete Command class to instantiate.
 */
public class CommandDeserializer extends JsonDeserializer<Command> {

    @Override
    public Command deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        ObjectMapper mapper = (ObjectMapper) p.getCodec();
        JsonNode node = mapper.readTree(p);
        // The top-level "type" is "COMMAND", the actual command type is in the "command" field
        String commandType = node.get("command").asText();
        JsonNode payloadNode = node.get("payload"); // Get the payload node

        return switch (commandType) {
            case "CREATE_GAME" -> mapper.treeToValue(payloadNode, CreateGameCommand.class);
            case "START_CLOCK" -> mapper.treeToValue(payloadNode, StartClockCommand.class);
            case "PAUSE_CLOCK" -> mapper.treeToValue(payloadNode, PauseClockCommand.class);
            case "ADD_PENALTY" -> mapper.treeToValue(payloadNode, AddPenaltyCommand.class);
            case "TICK" -> mapper.treeToValue(payloadNode, TickCommand.class);
            case "ADD_GOAL" -> mapper.treeToValue(payloadNode, AddGoalCommand.class);
            case "REMOVE_GOAL" -> mapper.treeToValue(payloadNode, RemoveGoalCommand.class);
            case "ADD_SHOT" -> mapper.treeToValue(payloadNode, AddShotCommand.class);
            case "UNDO_LAST_SHOT" -> mapper.treeToValue(payloadNode, UndoLastShotCommand.class);
            case "END_GAME" -> mapper.treeToValue(payloadNode, EndGameCommand.class);
            case "RESET_GAME" -> mapper.treeToValue(payloadNode, ResetGameCommand.class);
            case "SET_PERIOD" -> mapper.treeToValue(payloadNode, SetPeriodCommand.class);
            case "TRIGGER_BUZZER" -> mapper.treeToValue(payloadNode, TriggerBuzzerCommand.class);
            case "SET_CLOCK" -> mapper.treeToValue(payloadNode, SetClockCommand.class);
            default -> throw new IllegalArgumentException("Unknown command type: " + commandType);
        };
    }
}
