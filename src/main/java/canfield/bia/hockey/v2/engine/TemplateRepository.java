package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.GameConfig;

/**
 * A repository for loading game configuration templates.
 */
@FunctionalInterface
public interface TemplateRepository {
    /**
     * Loads a game configuration template by its ID.
     *
     * @param templateId The ID of the template (e.g., "USAH_ADULT_20").
     * @return The loaded GameConfig object.
     * @throws IllegalArgumentException if the templateId is not found.
     */
    GameConfig load(String templateId);
}
