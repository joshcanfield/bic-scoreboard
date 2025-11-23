package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.GameState;
import canfield.bia.hockey.v2.domain.ClockState;
import canfield.bia.hockey.v2.domain.TeamState;
import canfield.bia.hockey.v2.domain.GoalEvent;
import canfield.bia.hockey.v2.domain.Penalty;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Utility to compare two GameState objects and produce a StatePatch.
 * A StatePatch is a Map<String, Object> where keys are dot-separated paths
 * to changed fields and values are the new values of those fields.
 */
public class StateDiffer {

    public Map<String, Object> diff(GameState oldState, GameState newState) {
        Map<String, Object> patch = new HashMap<>();

        // Compare top-level fields
        if (!Objects.equals(oldState.gameId(), newState.gameId())) {
            patch.put("gameId", newState.gameId());
        }
        // GameConfig is immutable and set at creation, so it shouldn't change after initial state
        // if (!Objects.equals(oldState.config(), newState.config())) {
        //     patch.put("config", newState.config());
        // }
        if (!Objects.equals(oldState.status(), newState.status())) {
            patch.put("status", newState.status());
        }
        if (oldState.period() != newState.period()) {
            patch.put("period", newState.period());
        }
        if (oldState.buzzerOn() != newState.buzzerOn()) {
            patch.put("buzzerOn", newState.buzzerOn());
        }
        // eventHistory is for internal engine use, not typically broadcast as a patch

        // Compare ClockState
        diffClockState(oldState.clock(), newState.clock(), patch);

        // Compare TeamState (home)
        diffTeamState(oldState.home(), newState.home(), "home", patch);

        // Compare TeamState (away)
        diffTeamState(oldState.away(), newState.away(), "away", patch);

        return patch;
    }

    private void diffClockState(ClockState oldClock, ClockState newClock, Map<String, Object> patch) {
        if (oldClock.timeRemainingMillis() != newClock.timeRemainingMillis()) {
            patch.put("clock.timeRemainingMillis", newClock.timeRemainingMillis());
        }
        if (oldClock.isRunning() != newClock.isRunning()) {
            patch.put("clock.isRunning", newClock.isRunning());
        }
        // startTimeWallClock is internal, not part of the broadcast state
    }

    private void diffTeamState(TeamState oldTeam, TeamState newTeam, String prefix, Map<String, Object> patch) {
        // Score is derived, so we only compare goals list
        if (!Objects.equals(oldTeam.goals(), newTeam.goals())) {
            // For lists, send the entire new list for simplicity and robustness
            patch.put(prefix + ".goals", newTeam.goals());
            // Also send derived score if goals changed
            patch.put(prefix + ".score", newTeam.getScore());
        }
        if (oldTeam.shots() != newTeam.shots()) {
            patch.put(prefix + ".shots", newTeam.shots());
        }
        if (!Objects.equals(oldTeam.penalties(), newTeam.penalties())) {
            // For lists, send the entire new list for simplicity and robustness
            patch.put(prefix + ".penalties", newTeam.penalties());
        }
    }
}
