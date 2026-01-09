package canfield.bia.hockey.v2.domain;

import java.util.List;

/**
 * Represents a goal scored in the game, containing all scoresheet details.
 */
public record GoalEvent(
    String goalId,
    String teamId, // "home" or "away"
    int period,
    long timeInPeriodMillis,
    int scorerNumber,
    List<Integer> assistNumbers, // Max 2
    boolean isEmptyNet
) {}
