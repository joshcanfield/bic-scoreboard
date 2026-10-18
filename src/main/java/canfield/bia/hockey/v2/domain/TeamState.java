package canfield.bia.hockey.v2.domain;

import java.util.List;

/**
 * Represents the complete state of one team in the game.
 */
public record TeamState(
    List<GoalEvent> goals,
    int shots,
    List<Penalty> penalties,
    List<Penalty> penaltyHistory // All penalties including expired/released (for scoresheet)
) {
    /**
     * Backward-compatible factory method for existing code that doesn't use penaltyHistory.
     */
    public static TeamState create(List<GoalEvent> goals, int shots, List<Penalty> penalties) {
        return new TeamState(goals, shots, penalties, List.of());
    }

    /**
     * The team's score is derived from the number of goal events.
     * @return The total number of goals scored by the team.
     */
    public int getScore() {
        return goals.size();
    }
}
