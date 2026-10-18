# Implementation Plan: Missing Command Handlers

## Problem

The UI sends three WebSocket commands that the backend doesn't recognize:
- `CANCEL_PENALTY` - Delete a penalty (added in error)
- `START_ADAPTER` - Start the hardware scoreboard connection
- `STOP_ADAPTER` - Stop the hardware scoreboard connection

These throw `IllegalArgumentException` in `CommandDeserializer` and silently fail.

## Design Decisions

### CancelPenalty vs ReleasePenalty
- **ReleasePenaltyCommand** (existing): Goal scored on power play → marks penalty as `RELEASED`, keeps in `penaltyHistory` for scoresheet
- **CancelPenaltyCommand** (new): Delete mistake → removes from active penalties AND `penaltyHistory` completely

### Adapter Commands
- Follow existing architecture: all commands flow through `GameEngine.processCommand()`
- Extend `HardwareOutputAdapter` interface with `start()`/`stop()` methods
- Keep current auto-start behavior on boot; UI can stop/restart as needed

---

## Files to Modify

| File | Change |
|------|--------|
| `src/main/java/canfield/bia/hockey/v2/spec/CancelPenaltyCommand.java` | **NEW** |
| `src/main/java/canfield/bia/hockey/v2/spec/StartAdapterCommand.java` | **NEW** |
| `src/main/java/canfield/bia/hockey/v2/spec/StopAdapterCommand.java` | **NEW** |
| `src/main/java/canfield/bia/hockey/v2/spec/Command.java` | Add to permits |
| `src/main/java/canfield/bia/hockey/v2/web/CommandDeserializer.java` | Add 3 cases |
| `src/main/java/canfield/bia/hockey/v2/engine/HardwareOutputAdapter.java` | Add start/stop |
| `src/main/java/canfield/bia/hockey/v2/engine/LegacyScoreboardHardwareAdapter.java` | Implement start/stop |
| `src/main/java/canfield/bia/hockey/v2/engine/GameEngine.java` | Handle 3 commands |
| `src/main/java/canfield/bia/ServiceMain.java` | Pass adapter reference |

---

## Step-by-Step Implementation

### Step 1: Create Command Records

**CancelPenaltyCommand.java**
```java
package canfield.bia.hockey.v2.spec;

/**
 * Command to completely delete a penalty (e.g., added in error).
 * Unlike ReleasePenalty (goal scored), this removes from active AND history.
 */
public record CancelPenaltyCommand(String penaltyId) implements Command {}
```

**StartAdapterCommand.java**
```java
package canfield.bia.hockey.v2.spec;

/**
 * Command to start the hardware scoreboard adapter.
 */
public record StartAdapterCommand() implements Command {}
```

**StopAdapterCommand.java**
```java
package canfield.bia.hockey.v2.spec;

/**
 * Command to stop the hardware scoreboard adapter.
 */
public record StopAdapterCommand() implements Command {}
```

### Step 2: Update Command.java

Add to the `permits` clause:
```java
public sealed interface Command permits
    // ... existing commands ...
    CancelPenaltyCommand,
    StartAdapterCommand,
    StopAdapterCommand
{}
```

### Step 3: Update CommandDeserializer.java

Add cases to the switch statement (with NPE protection for empty payloads):
```java
case "CANCEL_PENALTY" -> mapper.treeToValue(payloadNode, CancelPenaltyCommand.class);
case "START_ADAPTER" -> new StartAdapterCommand();
case "STOP_ADAPTER" -> new StopAdapterCommand();
```

### Step 4: Update HardwareOutputAdapter Interface

```java
public interface HardwareOutputAdapter {
    void update(GameState state);
    void start();
    void stop();
    boolean isRunning();
}
```

### Step 5: Update LegacyScoreboardHardwareAdapter

Add field and constructor parameter for `ScoreboardAdapter`:
```java
public class LegacyScoreboardHardwareAdapter implements HardwareOutputAdapter {
    private final ScoreBoard legacyScoreBoard;
    private final ScoreboardAdapter scoreboardAdapter;

    public LegacyScoreboardHardwareAdapter(ScoreBoard legacyScoreBoard, ScoreboardAdapter scoreboardAdapter) {
        this.legacyScoreBoard = legacyScoreBoard;
        this.scoreboardAdapter = scoreboardAdapter;
    }

    @Override
    public void start() {
        if (scoreboardAdapter != null) scoreboardAdapter.start();
    }

    @Override
    public void stop() {
        if (scoreboardAdapter != null) scoreboardAdapter.stop();
    }

    @Override
    public boolean isRunning() {
        return scoreboardAdapter != null && scoreboardAdapter.isRunning();
    }

    // ... existing update() unchanged
}
```

### Step 6: Update ServiceMain.java

Pass the adapter to `LegacyScoreboardHardwareAdapter`:
```java
// Change from:
LegacyScoreboardHardwareAdapter hardwareOutputAdapter = new LegacyScoreboardHardwareAdapter(legacyScoreBoard);

// To:
LegacyScoreboardHardwareAdapter hardwareOutputAdapter = new LegacyScoreboardHardwareAdapter(legacyScoreBoard, legacyScoreboardAdapter);
```

### Step 7: Update GameEngine.processCommand()

Add handling for the three new commands:

```java
} else if (command instanceof CancelPenaltyCommand cancelPenaltyCommand) {
    this.currentState = cancelPenalty(this.currentState, cancelPenaltyCommand);
} else if (command instanceof StartAdapterCommand) {
    hardwareOutputAdapter.start();
    // No state change
} else if (command instanceof StopAdapterCommand) {
    hardwareOutputAdapter.stop();
    // No state change
}
```

Add the `cancelPenalty` helper method:
```java
private GameState cancelPenalty(GameState state, CancelPenaltyCommand command) {
    String penaltyId = command.penaltyId();

    // Check home team
    List<Penalty> homePenalties = state.home().penalties();
    List<Penalty> newHomePenalties = homePenalties.stream()
        .filter(p -> !p.penaltyId().equals(penaltyId))
        .collect(Collectors.toList());
    List<Penalty> homeHistory = state.home().penaltyHistory().stream()
        .filter(p -> !p.penaltyId().equals(penaltyId))
        .collect(Collectors.toList());

    if (newHomePenalties.size() < homePenalties.size()) {
        TeamState newHomeState = new TeamState(
            state.home().goals(), state.home().shots(),
            Collections.unmodifiableList(newHomePenalties),
            Collections.unmodifiableList(homeHistory)
        );
        return new GameState(state.gameId(), state.config(), state.status(),
            state.period(), state.clock(), newHomeState, state.away(),
            state.buzzerOn(), state.eventHistory());
    }

    // Check away team
    List<Penalty> awayPenalties = state.away().penalties();
    List<Penalty> newAwayPenalties = awayPenalties.stream()
        .filter(p -> !p.penaltyId().equals(penaltyId))
        .collect(Collectors.toList());
    List<Penalty> awayHistory = state.away().penaltyHistory().stream()
        .filter(p -> !p.penaltyId().equals(penaltyId))
        .collect(Collectors.toList());

    if (newAwayPenalties.size() < awayPenalties.size()) {
        TeamState newAwayState = new TeamState(
            state.away().goals(), state.away().shots(),
            Collections.unmodifiableList(newAwayPenalties),
            Collections.unmodifiableList(awayHistory)
        );
        return new GameState(state.gameId(), state.config(), state.status(),
            state.period(), state.clock(), state.home(), newAwayState,
            state.buzzerOn(), state.eventHistory());
    }

    // Not found, return unchanged
    return state;
}
```

---

## Implementation Order

1. Create 3 new command record files
2. Update `Command.java` permits clause
3. Update `CommandDeserializer.java` with 3 new cases
4. Update `HardwareOutputAdapter.java` interface
5. Update `LegacyScoreboardHardwareAdapter.java` implementation
6. Update `ServiceMain.java` to pass adapter reference
7. Update `GameEngine.java` with command handling + cancelPenalty method

---

## Tests to Add

- `CommandDeserializerTest`: Add tests for CANCEL_PENALTY, START_ADAPTER, STOP_ADAPTER JSON
- `GameEngineTest`: Test cancelPenalty removes from both active and history
- `GameEngineTest`: Test start/stop adapter commands invoke adapter methods
