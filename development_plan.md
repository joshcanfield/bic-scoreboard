# Development Plan: Migrating to the New Scoreboard Architecture

This document outlines the development plan for implementing the new, event-driven architecture as specified in `new_architecture.md`.

## Current Backlog (2024-07-23)

| ID | Area | Status | Notes / Next Step |
| --- | --- | --- | --- |
| BZ-01 | Clock / UI sync | TODO | UI clock still does not decrement after `START_CLOCK`. Need to confirm `StateDiffer` emits clock deltas and ensure `renderUpdate` applies them even when only `clock.timeRemainingMillis` changes. Verify with `./gradlew uiTestPackaged`. |
| BZ-02 | Buzzer auto-reset | In Progress | Auto-reset runnable fires but UI never receives a patch toggling `buzzerOn` back to false, so indicators stay lit and the new e2e scenario fails. Route reset through normal command/state pipeline so websocket clients get the change. |
| UI-01 | New game controls | TODO | “New Game” button currently no-ops; dialog should create a game via websocket command, respect configured periods, and refresh home/away state. |
| UI-02 | Update clock dialog | TODO | Update-clock modal does not persist entered time back to the engine. Hook dialog submit to `SetClockCommand` and re-render without a page reload. |
| UI-03 | Disconnected dialog | TODO | Legacy “disconnected” modal no longer appears when websocket/server is down. Re-introduce connection watchdog + modal so operators understand why controls are inert. |
| UI-04 | Layout / responsiveness | TODO | New game dialog must render correctly at 560 px and enforce min-width ≥ 600 px; between 1025–1200 px Bootstrap columns are stretching full width (Edge 142 regression). Audit CSS being served (`src/ui/public/css/index.css`) and adjust media queries to keep desktop-first layout for 1024×768 target. |
| UI-05 | Template picker duplication | TODO | Dialog sometimes shows two template pickers; widen modal (min-width 600px) and remove duplicate markup. Ensure Vite build picks up the right HTML fragment. |
| UI-06 | Buzzer/intermission indicators | TODO | Indicators render but colors remain muted because served CSS (`/css/index.css`) lacks the new rules. Move indicator styles into the bundled CSS and ensure active state uses bright yellow, with state restored on initial load. Add missing websocket patch when period buzzer ends. |
| QA-01 | E2E coverage | TODO | Add/repair e2e tests for buzzer/intermission indicators (scenario added but currently failing) and for new game/create flow once the controls work. |

### Recently Resolved

- Warmup-specific issues are fixed: period 0 now uses configured warmup minutes, warmup transition does not trigger an intermission, and template overrides no longer allow adding periods beyond configuration.

## 1. Overall Strategy: A Phased Rewrite

A complete "big bang" rewrite is too risky, while a piecemeal migration of the core logic is impractical due to the fundamental architectural differences.

Our strategy is therefore a **phased rewrite**, centered on building the new `GameEngine` from scratch and progressively integrating it into the existing application structure. This allows us to leverage the existing server setup, hardware adapter, and UI components while ensuring the new core logic is robust and correct from day one.

**The guiding principle is: Build the new spine, then connect the existing limbs to it before finally amputating the old spine.**

## 2. Development Phases

The project is broken down into four distinct phases. Each phase has a clear goal and a set of tasks. Work on a phase should not begin until the previous phase is complete and verified.

---

### **Phase 1: Backend Core Implementation (The "Spine")**

**Goal:** Create a fully functional, test-covered, and *headless* backend core that perfectly implements the new architecture's rules.

| Task ID | Task | Description | Verification |
| :--- | :--- | :--- | :--- |
| **1.1** | **Define Data Models** | Create the new Java records in a new package (e.g., `v2.domain`): `GameState`, `GameConfig`, `TeamState`, `GoalEvent`, `Penalty`. | [DONE] Code compiles. |
| **1.2** | **Implement Template Loader** | Create a `TemplateRepository` class that can load and parse game rules from a `templates.json` file located in the resources directory. | [DONE] Unit tests can load a sample template file. |
| **1.3** | **Build the Game Engine** | Create the central `GameEngine` class. Implement the `processCommand` method, which takes the current state and a command and returns a new state. This is the heart of the logic. | [DONE] Unit tests exist for every command. |
| **1.4** | **Build the State Differ** | Implement the logic that compares an `oldState` and a `newState` to produce a `StatePatch` object containing only the changed key-value pairs. | [DONE] Unit tests verify correct patch generation. |
| **1.5** | **Write Core Unit Tests** | **This is the most critical task.** Write extensive JUnit tests for the `GameEngine` that cover every command, state transition, and edge case defined in `new_architecture.md`. | [DONE] High test coverage on the `GameEngine`. All architectural rules are verified. |

---

### **Phase 2: Backend Integration (The "Nervous System")**

**Goal:** Connect the new `GameEngine` to the outside world via WebSockets and to the physical scoreboard hardware.

| Task ID | Task | Description | Verification |
| :--- | :--- | :--- | :--- |
| **2.1** | **Create New WebSocket API** | Create a new `GameWebSocketV2` class. This class will handle incoming WebSocket messages, parse them into `Command` objects, and pass them to the `GameEngine`. | A test client can connect to the endpoint. |
| **2.2** | **Implement State Broadcasting** | The `GameWebSocketV2` must listen for updates from the `GameEngine` and broadcast the `INITIAL_STATE` and `STATE_PATCH` messages to all connected clients. | Test client receives state patches correctly. |
| **2.3** | **Integrate Hardware Adapter** | Modify the `GameEngine` to notify the existing `ScoreboardAdapter` with the full `GameState` object after every state change. | Physical scoreboard (or simulator) correctly mirrors the state of the new `GameEngine`. |
| **2.4** | **Update Server Entrypoint** | Update `HockeyGameServer.java` to initialize and use the new `GameWebSocketV2`. Mark the old `GameResource` (REST) and `SimpleGameManager` with `@Deprecated`. | The server starts, and the new WebSocket endpoint is live. The old REST endpoints are still present but marked for removal. |

---

### **Phase 3: UI Rewiring**

**Goal:** Update the existing TypeScript UI to communicate with the new WebSocket-based backend.

| Task ID | Task | Description | Verification |
| :--- | :--- | :--- | :--- |
| **3.1** | **Create WebSocket Client** | In the `src/ui` project, create a new service (`api/socket-client.ts`) responsible for the WebSocket connection, sending commands, and handling incoming state messages. | UI can establish a connection. |
| **3.2** | **Implement Client State Store** | Create a simple, central state store (e.g., using a lightweight library or a simple observable object) that holds the client's copy of the `GameState`. | The store is updated when `INITIAL_STATE` and `STATE_PATCH` messages are received. |
| **3.3** | **Refactor UI Components** | Systematically update each UI component (clock, penalty display, etc.) to read its data from the central client state store instead of making its own API calls. | UI components correctly display data from the WebSocket feed. |
| **3.4** | **Wire UI Commands** | Update all UI controls (buttons, forms) to send commands to the backend via the new `socket-client.ts` service instead of using the old REST or WebSocket calls. | Clicking buttons in the UI correctly modifies the backend state and updates all clients. |


### **Phase 3.1: Control UI progress**

Before diving deeper into Phase 3, we reviewed the UI strategy and compared two paths:

1. **Continue migrating the new TypeScript control UI** (the files under `src/ui`). This code already wires a `websocketClient` that understands the `{type: INITIAL_STATE/STATE_PATCH}` envelope, so most of the plumbing is in place; the remaining work is finishing the goal/penalty dialogs, power/port flows, and command emitters.
2. **Patch the legacy script-based UI** under `src/main/dist/web`. That surface still assumes the old `{event, data}` protocol and would require redoing large chunks of `transport.js`, `socket-events.js`, and the REST helpers, which is a higher-risk, lower-reward detour.

We chose **Option 1** because it keeps the modern build (Vite) and TypeScript tooling, ensures the UI mirrors the new architectures state model, and avoids regressing to the brittle legacy event format. With that decision made, we started by cleaning up `src/ui/src/control-ui.ts` so the module compiles and can show power/port messages:

* Added a `notOnCountdownHandle` plus a `setConnectMessage` helper so the power modal can post updates without relying on dead legacy helpers.
* These changes unblock the next tasks: hooking the modal buttons into the new `websocketClient`, wiring the port/power status over the WebSocket, and finishing the command helpers (`goalDialog`, `penaltyDialog`, etc.).

Next steps for Phase 3: finish port dialog messaging, validate every command emitter uses the new `websocketClient`, and verify the UI reacts to `STATE_PATCH` updates for penalties, goals, shots, and the buzzer.

- In progress: reworked `goal-dialog.ts`, `penalty-dialog.ts`, and `game-dialog.ts` so their data entry flows now build `Command` objects (`ADD_GOAL`, `ADD_PENALTY`, `CREATE_GAME`, etc.) and send them through the shared `websocketClient`, eliminating the old REST helpers.


---

### **Phase 4: Final Cleanup & Deprecation**

**Goal:** Remove all legacy code, leaving only the new, clean architecture.

| Task ID | Task | Description | Verification |
| :--- | :--- | :--- | :--- |
| **4.1** | **Delete Old Backend Logic** | Once the new UI is fully tested and confirmed to be working, delete the deprecated `SimpleGameManager`, `GameResource`, and all associated old data models and REST API classes. | The project compiles and runs without the old files. |
| **4.2** | **Remove Old UI Code** | Delete any old API services or data-fetching logic from the TypeScript project that are no longer used. | The UI project builds and runs without the old files. |
| **4.3** | **Final Review** | Perform a final code review and run a full regression test to ensure all functionality is present and correct. | All tests pass, and a full manual run-through of a game confirms system stability. |

---
## 3. Getting Started: A Detailed Look at Phase 1

This section provides a developer-ready blueprint for kicking off the implementation.

### 3.1. Proposed Package Structure

To keep the new implementation isolated from the legacy code during the transition, all new backend code should live under a `v2` package:

-   **`src/main/java/canfield/bia/hockey/v2/domain/`**: For the new data models (records) like `GameState`, `GameConfig`, `TeamState`, `GoalEvent`, and `Penalty`.
-   **`src/main/java/canfield/bia/hockey/v2/engine/`**: For the core logic classes: `GameEngine`, `TemplateRepository`, and the state-patching utility.
-   **`src/main/java/canfield/bia/hockey/v2/spec/`**: For command and event definitions, like the `Command` record.
-   **`src/test/java/canfield/bia/hockey/v2/engine/`**: For the critical `GameEngine` unit tests.

### 3.2. Core Class Skeletons

A developer can start by creating these files with the following structure:

**`GameEngine.java`**
```java
package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.GameState;
import canfield.bia.hockey.v2.spec.Command;

public class GameEngine {

    private final TemplateRepository templateRepository;

    public GameEngine(TemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    /**
     * This is the core function of the architecture. It is a pure function
     * that takes the current state and a command and returns the new state.
     * It does not have side effects like database calls or network requests.
     *
     * @param currentState The state of the game before the command.
     * @param command The command to apply.
     * @return The new state of the game after the command is applied.
     */
    public GameState processCommand(GameState currentState, Command command) {
        // Step 1: Validate command against current state based on edge case rules.
        // If invalid, log the attempt and return currentState unchanged.

        // Step 2: Use a switch on the command type to delegate to a private method.
        // e.g., case CREATE_GAME: return createNewGame(command.payload());

        // Step 3: Return the newly computed state.
        return currentState; // Placeholder
    }
}
```

### 3.3. Your First Test Case: `GameEngineTest.java`

The first step should be to write a failing test that you will then make pass. This ensures the entire project structure, dependencies, and test framework are correctly configured for the new code.

Create the test file `src/test/java/canfield/bia/hockey/v2/engine/GameEngineTest.java`:

```java
package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.GameConfig;
import canfield.bia.hockey.v2.domain.GameState;
import canfield.bia.hockey.v2.domain.GameStatus;
import canfield.bia.hockey.v2.spec.Command;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class GameEngineTest {

    @Test
    void testCreateGameCommand() {
        // Arrange
        // In a real test, you would mock the TemplateRepository.
        // For now, we can use a simple fake one for this initial test.
        TemplateRepository fakeRepo = (templateId) -> {
            var config = new GameConfig();
            config.periodLengthMillis = 1200000L; // 20 minutes
            config.periods = 3;
            return config;
        };

        GameEngine gameEngine = new GameEngine(fakeRepo);
        GameState initialState = new GameState(); // Represents PRE_GAME state
        
        Command createGameCommand = new Command(
            "CREATE_GAME",
            Map.of("templateId", "USAH_ADULT_20")
        );

        // Act
        GameState newState = gameEngine.processCommand(initialState, createGameCommand);

        // Assert
        assertNotNull(newState, "New state should not be null.");
        assertNotSame(initialState, newState, "A new state object should be returned to ensure immutability.");
        assertEquals(GameStatus.READY_FOR_PERIOD, newState.status(), "Game should be in READY_FOR_PERIOD state.");
        assertEquals(1, newState.period(), "Game should start in the 1st period.");
        assertEquals(1200000L, newState.config().periodLengthMillis(), "Game config should be applied from the template.");
    }
}
```
