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
        JsonNode commandNode = node.get("command");
        if (commandNode == null || commandNode.isNull()) {
            throw new IllegalArgumentException("Missing 'command' field in message");
        }
        String commandType = commandNode.asText();
        JsonNode payloadNode = node.get("payload"); // Get the payload node

        // Commands with no payload - handle null/missing payload gracefully
        return switch (commandType) {
            case "START_CLOCK" -> new StartClockCommand();
            case "PAUSE_CLOCK" -> new PauseClockCommand();
            case "TICK" -> new TickCommand();
            case "END_GAME" -> new EndGameCommand();
            case "RESET_GAME" -> new ResetGameCommand();
            case "TRIGGER_BUZZER" -> new TriggerBuzzerCommand();
            case "STOP_ADAPTER" -> new StopAdapterCommand();
            case "GET_PORTS" -> new GetPortsCommand();
            // Commands with optional payload
            case "START_ADAPTER" -> {
                String portName = payloadNode != null && payloadNode.has("portName")
                    ? payloadNode.get("portName").asText(null)
                    : null;
                yield new StartAdapterCommand(portName);
            }
            // Commands requiring payload - validate before deserializing
            case "CREATE_GAME" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("CREATE_GAME requires a payload");
                }
                yield mapper.treeToValue(payloadNode, CreateGameCommand.class);
            }
            case "ADD_PENALTY" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("ADD_PENALTY requires a payload");
                }
                yield mapper.treeToValue(payloadNode, AddPenaltyCommand.class);
            }
            case "RELEASE_PENALTY" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("RELEASE_PENALTY requires a payload");
                }
                yield mapper.treeToValue(payloadNode, ReleasePenaltyCommand.class);
            }
            case "ADD_GOAL" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("ADD_GOAL requires a payload");
                }
                yield mapper.treeToValue(payloadNode, AddGoalCommand.class);
            }
            case "REMOVE_GOAL" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("REMOVE_GOAL requires a payload");
                }
                yield mapper.treeToValue(payloadNode, RemoveGoalCommand.class);
            }
            case "ADD_SHOT" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("ADD_SHOT requires a payload");
                }
                yield mapper.treeToValue(payloadNode, AddShotCommand.class);
            }
            case "UNDO_LAST_SHOT" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("UNDO_LAST_SHOT requires a payload");
                }
                yield mapper.treeToValue(payloadNode, UndoLastShotCommand.class);
            }
            case "SET_PERIOD" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("SET_PERIOD requires a payload");
                }
                yield mapper.treeToValue(payloadNode, SetPeriodCommand.class);
            }
            case "SET_CLOCK" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("SET_CLOCK requires a payload");
                }
                yield mapper.treeToValue(payloadNode, SetClockCommand.class);
            }
            case "CANCEL_PENALTY" -> {
                if (payloadNode == null || payloadNode.isNull()) {
                    throw new IllegalArgumentException("CANCEL_PENALTY requires a payload");
                }
                yield mapper.treeToValue(payloadNode, CancelPenaltyCommand.class);
            }
            default -> throw new IllegalArgumentException("Unknown command type: " + commandType);
        };
    }
}
