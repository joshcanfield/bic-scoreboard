package canfield.bia.hockey.v2.domain;

import java.util.List;

/**
 * Represents the complete state of one team in the game.
 */
public record TeamState(
    List<GoalEvent> goals,
    int shots,
    List<Penalty> penalties
) {
    /**
     * The team's score is derived from the number of goal events.
     * @return The total number of goals scored by the team.
     */
    public int getScore() {
        return goals.size();
    }
}
