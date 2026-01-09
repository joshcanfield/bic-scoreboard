package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.GameConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * An implementation of TemplateRepository that loads game configurations from a JSON file.
 */
public class JsonTemplateRepository implements TemplateRepository {

    private final Map<String, GameConfig> templates;

    public JsonTemplateRepository() {
        this("/templates.json"); // Default path
    }

    public JsonTemplateRepository(String resourcePath) {
        ObjectMapper mapper = new ObjectMapper();
        Map<String, GameConfig> loadedTemplates = Collections.emptyMap();
        try (InputStream is = getClass().getResourceAsStream(resourcePath)) {
            if (is == null) {
                throw new IOException("Resource not found: " + resourcePath);
            }
            loadedTemplates = mapper.readValue(is, new TypeReference<Map<String, GameConfig>>() {});
        } catch (Exception e) { // Catch generic Exception to see all errors
            System.err.println("Error loading templates from " + resourcePath + ": " + e.getMessage());
            e.printStackTrace(); // Print full stack trace for debugging
        }
        Map<String, GameConfig> normalized = new HashMap<>();
        for (Map.Entry<String, GameConfig> entry : loadedTemplates.entrySet()) {
            GameConfig cfg = entry.getValue();
            GameConfig enriched = new GameConfig(
                entry.getKey(),
                cfg.warmupLengthMinutes(),
                cfg.periodLengthMinutes(),
                cfg.intermissionLengthMinutes(),
                cfg.periods(),
                cfg.clockType(),
                cfg.shiftLengthSeconds()
            );
            normalized.put(entry.getKey(), enriched);
        }
        this.templates = Collections.unmodifiableMap(normalized);
    }

    @Override
    public GameConfig load(String templateId) {
        return Optional.ofNullable(templates.get(templateId))
            .orElseThrow(() -> new IllegalArgumentException("Game template not found: " + templateId));
    }
}
