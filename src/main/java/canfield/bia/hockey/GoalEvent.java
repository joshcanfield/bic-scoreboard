package canfield.bia.hockey;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable record of a scoring play that captures the team, the associated {@link Goal},
 * and the wall-clock instant when the goal was registered.
 */
public final class GoalEvent {
  private final Team team;
  private final Goal goal;
  private final Instant recordedAt;

  public GoalEvent(Team team, Goal goal, Instant recordedAt) {
    this.team = Objects.requireNonNull(team, "team");
    this.goal = Objects.requireNonNull(goal, "goal");
    this.recordedAt = Objects.requireNonNull(recordedAt, "recordedAt");
  }

  public Team getTeam() {
    return team;
  }

  public Goal getGoal() {
    return goal;
  }

  /**
   * Returns the wall-clock instant when the goal was recorded by the server.
   */
  public Instant getRecordedAt() {
    return recordedAt;
  }
}

