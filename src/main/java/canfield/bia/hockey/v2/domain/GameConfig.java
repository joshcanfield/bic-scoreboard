package canfield.bia.hockey.v2.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Configuration for a hockey game.
 * This object is created by the GameEngine from a template and user overrides.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GameConfig(
    String templateId,
    int warmupLengthMinutes,
    long warmupLengthMillis,
    int periodLengthMinutes, // Input from JSON
    long periodLengthMillis, // Derived from periodLengthMinutes
    int intermissionLengthMinutes, // Input from JSON
    long intermissionLengthMillis, // Derived from intermissionLengthMinutes
    int periods,
    ClockType clockType,
    Integer shiftLengthSeconds, // Optional
    boolean showShotsInPenaltySlot // Experimental: show shots in penalty slot 2 on hardware scoreboard
) {

    @JsonCreator
    public GameConfig(
        @JsonProperty("templateId") String templateId,
        @JsonProperty("warmupLengthMinutes") Integer warmupLengthMinutes,
        @JsonProperty("periodLengthMinutes") int periodLengthMinutes,
        @JsonProperty("intermissionLengthMinutes") int intermissionLengthMinutes,
        @JsonProperty("periods") int periods,
        @JsonProperty("clockType") ClockType clockType,
        @JsonProperty("shiftLengthSeconds") Integer shiftLengthSeconds,
        @JsonProperty("showShotsInPenaltySlot") Boolean showShotsInPenaltySlot
    ) {
        this(
            templateId,
            warmupLengthMinutes != null ? warmupLengthMinutes : periodLengthMinutes,
            (long) (warmupLengthMinutes != null ? warmupLengthMinutes : periodLengthMinutes) * 60 * 1000,
            periodLengthMinutes,
            (long) periodLengthMinutes * 60 * 1000, // Derived periodLengthMillis
            intermissionLengthMinutes,
            (long) intermissionLengthMinutes * 60 * 1000, // Derived intermissionLengthMillis
            periods,
            clockType,
            shiftLengthSeconds,
            showShotsInPenaltySlot != null ? showShotsInPenaltySlot : false // Default to false
        );
    }
}
