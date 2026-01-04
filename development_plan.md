# BIC Scoreboard Development Plan

> **Last Updated:** 2026-01-03
> **Branch:** `scoreboard_v3`
> **Overall Status:** ~85% Complete

This document is the single source of truth for the scoreboard architecture migration project. It consolidates and supersedes the previous `REVISED_IMPLEMENTATION_PLAN.md`.

For detailed architecture specifications, see `new_architecture.md`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Implementation Status](#2-implementation-status)
3. [Current Backlog](#3-current-backlog)
4. [Remaining Work](#4-remaining-work)
5. [File Reference](#5-file-reference)
6. [Testing](#6-testing)

---

## 1. Architecture Overview

### Core Principles

1. **Single Source of Truth (SSOT)**: Java backend is the authority for all game state
2. **Event-Sourced State**: State changes only via explicit commands
3. **Unified Communication**: WebSocket for all real-time updates (INITIAL_STATE + STATE_PATCH)
4. **Decoupled Clients**: UI and physical scoreboard are stateless renderers

### Data Flow

```
UI Client                    Backend                         Hardware
    |                           |                               |
    |-- Command --------------->|                               |
    |                           |-- GameEngine.process() ------>|
    |                           |-- StateDiffer.diff() -------->|
    |<-- STATE_PATCH -----------|                               |
    |                           |-- HardwareAdapter.update() -->|
```

### Key Components

| Component | Location | Status |
|-----------|----------|--------|
| GameEngine | `v2/engine/GameEngine.java` | Complete |
| Domain Models | `v2/domain/*.java` | Complete |
| Command Specs | `v2/spec/*.java` | Complete |
| StateDiffer | `v2/engine/StateDiffer.java` | Complete |
| GameTimer | `v2/engine/GameTimer.java` | Complete |
| WebSocket Server | `v2/web/GameWebSocketV2.java` | Complete |
| Hardware Adapter | `v2/engine/HardwareOutputAdapter.java` | Complete |
| Template Repository | `v2/engine/JsonTemplateRepository.java` | Complete |
| UI WebSocket Client | `src/ui/src/websocket.ts` | Complete |
| UI Types | `src/ui/src/api/v2-types.ts` | Complete |
| UI State Patching | `src/ui/src/utils/state-patch.ts` | Complete |

---

## 2. Implementation Status

### Phase 1: Backend Core - COMPLETE

| Task | Description | Status |
|------|-------------|--------|
| 1.1 Define Data Models | Immutable records in `v2/domain/` | Done |
| 1.2 Template Loader | `JsonTemplateRepository` loads from `templates.json` | Done |
| 1.3 Game Engine | Central `processCommand()` with 13+ command types | Done |
| 1.4 State Differ | Generates dot-notation patches for efficient updates | Done |
| 1.5 Unit Tests | `GameEngineTest.java` - 656 lines, comprehensive coverage | Done |

**Commands Implemented:**
- `CREATE_GAME`, `RESET_GAME`, `END_GAME`
- `START_CLOCK`, `PAUSE_CLOCK`, `SET_CLOCK`, `TICK`
- `SET_PERIOD`
- `ADD_GOAL`, `REMOVE_GOAL`
- `ADD_SHOT`, `UNDO_LAST_SHOT`
- `ADD_PENALTY`
- `TRIGGER_BUZZER` (with 3-second auto-reset)

### Phase 2: Backend Integration - COMPLETE

| Task | Description | Status |
|------|-------------|--------|
| 2.1 WebSocket API | `GameWebSocketV2` handles commands | Done |
| 2.2 State Broadcasting | INITIAL_STATE on connect, STATE_PATCH on updates | Done |
| 2.3 Hardware Adapter | `LegacyScoreboardHardwareAdapter` bridges to serial | Done |
| 2.4 Server Entrypoint | New endpoint live alongside legacy (deprecated) | Done |

### Phase 3: UI Migration - IN PROGRESS (~85%)

| Task | Description | Status |
|------|-------------|--------|
| 3.1 WebSocket Client | `websocket.ts` singleton with reconnect | Done |
| 3.2 State Store | `control-state.ts` + `state-patch.ts` | Done |
| 3.3 Type Definitions | `v2-types.ts` matches Java domain | Done |
| 3.4 Goal Dialog | Refactored to emit `ADD_GOAL` commands | Done |
| 3.5 Penalty Dialog | Refactored to emit penalty commands | Done |
| 3.6 Game Dialog | Sends `CREATE_GAME` command (fixed resetGameState bug) | Done |
| 3.7 Clock Dialog | Sends `SET_CLOCK` command | Done |
| 3.8 Indicators | HTML exists, CSS needs fixing | In Progress |

### Phase 4: Cleanup - NOT STARTED

| Task | Description | Status |
|------|-------------|--------|
| 4.1 Delete Legacy Backend | Remove `SimpleGameManager`, `GameResource` | Pending |
| 4.2 Remove Old UI Code | Delete legacy REST/WebSocket helpers | Pending |
| 4.3 Final Review | Full regression test | Pending |

---

## 3. Current Backlog

### Critical (Blocking Release)

| ID | Area | Issue | Next Step |
|----|------|-------|-----------|
| **BZ-01** | Clock sync | UI clock doesn't decrement after START_CLOCK | Code review complete - logic appears correct. Debug logging added to GameEngine.tick() and broadcastStateChange(). Run with DEBUG level and verify patches are broadcast. |
| **BZ-02** | Buzzer reset | Auto-reset fires but UI never receives patch | Fixed threading visibility (volatile fields). Added debug logging. Verify with DEBUG level logging. |

### High Priority

| ID | Area | Issue | Next Step |
|----|------|-------|-----------|
| **UI-03** | Connection | Disconnected dialog doesn't appear | Re-introduce connection watchdog + modal |

### Medium Priority

| ID | Area | Issue | Next Step |
|----|------|-------|-----------|
| **UI-06** | Indicators | Buzzer/intermission colors muted | Move styles to bundled CSS, ensure bright yellow active state |
| **QA-01** | Tests | E2E tests failing for indicators | Repair scenarios after UI fixes complete |

### Low Priority

| ID | Area | Issue | Next Step |
|----|------|-------|-----------|
| **UI-04** | Layout | Dialog renders incorrectly at 560px | Enforce min-width 600px |
| **UI-05** | Template picker | Duplicate pickers in dialog | Remove duplicate markup |

### Recently Resolved

- **UI-01**: New Game dialog now sends `CREATE_GAME` command (fixed bug where `resetGameState()` was called immediately after, undoing the game creation)
- **UI-02**: Clock dialog correctly sends `SET_CLOCK` command (was already wired, verified working)
- Warmup uses configured minutes (period 0)
- Warmup transition doesn't trigger intermission
- Template overrides respect period limits
- Buzzer auto-reset after 3 seconds (backend)
- Intermission state properly cleared on period change (v2 engine)
- setPeriod() clears INTERMISSION state (was root cause of penalty time bugs)

---

## 4. Remaining Work

### To Complete Phase 3

**Priority 1 - Verify Critical Fixes:**

1. **Verify clock rendering (BZ-01)** - INVESTIGATION COMPLETE, NEEDS VERIFICATION
   - Code review done: GameEngine.tick(), StateDiffer, broadcastStateChange(), applyPatch(), renderUpdate() - all logic appears correct
   - Debug logging added to `GameEngine.tick()` and `GameWebSocketV2.broadcastStateChange()`
   - Next: Run with DEBUG logging enabled and verify clock patches are broadcast and rendered

2. **Verify buzzer auto-reset pipeline (BZ-02)** - FIXES APPLIED, NEEDS VERIFICATION
   - Made `currentState` and `buzzerOnSince` volatile for thread visibility
   - Added debug logging to `autoResetBuzzer()`
   - Next: Run with DEBUG level and verify patches reach UI

**Priority 2 - Polish:**

3. Reconnect connection watchdog (UI-03)
4. Fix indicator CSS (UI-06)
5. Fix layout issues (UI-04, UI-05)
6. Repair E2E tests (QA-01)

### To Complete Phase 4

After Phase 3 is verified working:

1. Delete `SimpleGameManager.java` and related legacy classes
2. Remove deprecated REST endpoints in `GameResource.java`
3. Clean up legacy UI transport code
4. Final regression testing

---

## 5. File Reference

### Backend v2 Architecture

```
src/main/java/canfield/bia/hockey/v2/
├── domain/
│   ├── GameState.java       # Main state record
│   ├── GameConfig.java      # Game configuration
│   ├── GameStatus.java      # PRE_GAME, PLAYING, PAUSED, INTERMISSION, GAME_OVER
│   ├── ClockState.java      # Clock with wall-clock sync
│   ├── ClockType.java       # STOP_TIME, RUNNING_TIME
│   ├── TeamState.java       # Goals, shots, penalties
│   ├── GoalEvent.java       # Goal details
│   └── Penalty.java         # Penalty details
├── engine/
│   ├── GameEngine.java      # Core state machine (632 lines)
│   ├── GameTimer.java       # Timer interface
│   ├── ScheduledGameTimer.java
│   ├── StateDiffer.java     # Patch generation
│   ├── TemplateRepository.java
│   ├── JsonTemplateRepository.java
│   └── HardwareOutputAdapter.java
├── spec/
│   ├── Command.java
│   ├── CreateGameCommand.java
│   ├── StartClockCommand.java
│   ├── PauseClockCommand.java
│   ├── SetClockCommand.java
│   ├── SetPeriodCommand.java
│   ├── AddGoalCommand.java
│   ├── RemoveGoalCommand.java
│   ├── AddShotCommand.java
│   ├── UndoLastShotCommand.java
│   ├── AddPenaltyCommand.java
│   ├── TriggerBuzzerCommand.java
│   ├── EndGameCommand.java
│   └── ResetGameCommand.java
└── web/
    ├── GameWebSocketV2.java # WebSocket handler
    └── CommandDeserializer.java
```

### Frontend TypeScript

```
src/ui/src/
├── api/
│   ├── v2-types.ts          # TypeScript interfaces for v2 domain
│   └── game.types.ts        # Legacy types (to be removed)
├── state/
│   └── control-state.ts     # UI state management
├── utils/
│   ├── state-patch.ts       # Patch application utility
│   ├── state-patch.test.ts  # Patch tests
│   └── time.ts              # Time formatting
├── view/
│   ├── game-dialog.ts       # Game creation
│   ├── goal-dialog.ts       # Goal entry
│   ├── penalty-dialog.ts    # Penalty entry
│   ├── penalties.ts         # Penalty table
│   ├── penalties.test.ts    # Penalty tests
│   └── keyboard-shortcuts.ts
├── rec/
│   └── game-time.ts         # Recreation game time
├── websocket.ts             # WebSocket client singleton
└── control-ui.ts            # Main UI orchestrator
```

### Tests

```
src/test/java/canfield/bia/hockey/v2/engine/
└── GameEngineTest.java      # 656 lines, comprehensive coverage

src/ui/src/
├── utils/state-patch.test.ts
└── view/penalties.test.ts
```

---

## 6. Testing

### Running Tests

```bash
# Java backend tests
./gradlew test

# Single test class
./gradlew test --tests "canfield.bia.hockey.v2.engine.GameEngineTest"

# UI tests
cd src/ui && npm run test

# Full UI validation (lint + test + typecheck)
cd src/ui && npm run check

# E2E tests against packaged app
./gradlew uiTestPackaged
```

### Test Coverage Goals

| Area | Current | Target |
|------|---------|--------|
| GameEngine commands | High | Maintain |
| StateDiffer patches | High | Maintain |
| UI state-patch | High | Maintain |
| UI penalties | Medium | Expand |
| E2E scenarios | Low (failing) | Repair |

### Manual Testing Checklist

Before release, verify:

- [ ] Create game from template
- [ ] Start/pause clock
- [ ] Clock decrements in real-time
- [ ] Add goals (both teams)
- [ ] Add penalties
- [ ] Penalty time counts down
- [ ] Period transitions
- [ ] Intermission state indicator
- [ ] Buzzer sounds and auto-resets
- [ ] Buzzer indicator shows/hides
- [ ] Physical scoreboard updates
- [ ] Reconnect after disconnect

---

## Appendix: Notes

### Design Decisions

1. **Buzzer Auto-Reset**: Instead of manual cancel button (originally proposed), the v2 engine implements automatic buzzer reset after 3 seconds. This is more robust and requires no user interaction.

2. **TypeScript Migration**: Chose to continue with the new TypeScript UI under `src/ui/` rather than patching the legacy JavaScript. This keeps modern tooling (Vite, TypeScript, Vitest) and ensures the UI mirrors the new state model.

3. **State Patching**: Uses dot-notation patches (e.g., `clock.timeRemainingMillis`) for efficient WebSocket updates. Full arrays sent for list changes (goals, penalties).

### Archived Documents

The following documents have been consolidated into this plan:
- `REVISED_IMPLEMENTATION_PLAN.md` - Focused on intermission/buzzer fixes (now resolved via v2 engine)

The `new_architecture.md` document remains as the authoritative architecture specification.

---

*This plan will be updated as work progresses.*
