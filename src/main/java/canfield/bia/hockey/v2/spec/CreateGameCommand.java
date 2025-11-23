package canfield.bia.hockey.v2.spec;

import java.util.Map;

/**
 * Command to create a new game.
 * Payload:
 * - templateId: String (ID of the server-defined template to use)
 * - overrides: Map<String, Object> (Optional: An object containing any values that override the template's defaults)
 */
public record CreateGameCommand(String templateId, Map<String, Object> overrides) implements Command {
}
