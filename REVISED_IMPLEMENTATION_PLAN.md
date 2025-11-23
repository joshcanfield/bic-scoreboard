  Revised Implementation Plan - Intermission Issues

  Based on your feedback and my investigation, here's the updated plan:

  Key Findings:

  1. Bug Confirmed: setPeriod() does NOT clear intermission state
    - When user manually changes period (via UI increment button), it calls SimpleGameManager.setPeriod() at line 127
    - This ONLY calls scoreBoard.setPeriod(period) and setTime()
    - It never clears the INTERMISSION game state - this is the root cause bug!
    - Result: Game stuck in INTERMISSION mode, causing penalty time calculation bugs
  2. Buzzer is already tracked
    - ScoreboardAdapterImpl tracks buzzer state via buzzer_stops timestamp (line 28)
    - isBuzzerOn() method exists (line 105-107)
    - UI already has buzzer state in view (line 289: view.buzzerOn)
    - UI applies .buzzer CSS class to body when buzzer is on
  3. Buzzer cancellation needs implementation
    - Currently no way to stop buzzer once started
    - Buzzer runs until buzzer_stops timestamp expires

  ---
  Revised Implementation Plan

  Phase 1: Fix Core Bugs (Critical - ~30 min)

  1.1 Fix setPeriod() to clear intermission state

  File: src/main/java/canfield/bia/hockey/SimpleGameManager.java:127-130

  Current code:
  public void setPeriod(Integer period) {
    scoreBoard.setPeriod(period);
    setTime((int) TimeUnit.MINUTES.toMillis(getPeriodLength()));
  }

  Fixed code:
  public void setPeriod(Integer period) {
    scoreBoard.setPeriod(period);
    setTime((int) TimeUnit.MINUTES.toMillis(getPeriodLength()));

    // Clear intermission state when period is manually changed
    if (scoreBoard.getGameState() == ScoreBoard.GameState.INTERMISSION) {
      scoreBoard.setGameState(ScoreBoard.GameState.READY_FOR_PERIOD);
    }
  }

  Impact: Fixes the penalty time bug (4:09/14:09 issue) when using period increment button during intermission

  1.2 Remove auto-start of intermission timer

  File: src/main/java/canfield/bia/hockey/SimpleGameManager.java:68

  Change: Remove or comment out scoreBoard.getGameClock().start();

  Impact: Prevents continuous buzzer during intermission

  ---
  Phase 2: UI Enhancements (High Priority - ~1.5 hours)

  2.1 Add Intermission State Indicator

  File: src/ui/index.html

  Add badge near clock controls:
  <div id="intermission-indicator" class="alert alert-info" style="display: none;">
    <strong>INTERMISSION</strong>
  </div>

  File: src/ui/src/control-ui.ts

  Add state tracking and render logic:
  const State: any = {
    // ... existing fields
    gameState: 'PRE_GAME', // Track game state
  };

  // In render function, show/hide intermission indicator
  if (view.gameState !== State.gameState) {
    State.gameState = view.gameState;
    const indicator = $('#intermission-indicator');
    if (indicator) {
      indicator.style.display = (view.gameState === 'INTERMISSION') ? 'block' : 'none';
    }
  }

  2.2 Enhance Buzzer Visual Indicator

  Current: Body gets .buzzer class when buzzer is on (line 289-290)

  Enhancement: Make it more prominent

  File: src/main/dist/web/css/control.css (or appropriate CSS file)

  Add/enhance CSS:
  body.buzzer {
    /* Add prominent visual indicator */
    outline: 5px solid #ff0000;
    outline-offset: -5px;
  }

  body.buzzer::before {
    content: "🔔 BUZZER ON";
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ff0000;
    color: white;
    padding: 10px 20px;
    font-weight: bold;
    font-size: 18px;
    z-index: 10000;
    border-radius: 5px;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  2.3 Add Buzzer Cancel Functionality

  File: src/main/java/canfield/bia/hockey/scoreboard/io/ScoreboardAdapterImpl.java

  Add method to cancel buzzer:
  @Override
  public void cancelBuzzer() {
    buzzer_stops = 0; // Immediately stop buzzer
  }

  File: src/main/java/canfield/bia/hockey/scoreboard/io/ScoreboardAdapter.java

  Add interface method:
  void cancelBuzzer();

  File: src/main/java/canfield/bia/hockey/SimpleGameManager.java

  Add public method:
  public void cancelBuzzer() {
    if (scoreboardAdapter instanceof ScoreboardAdapterImpl) {
      ((ScoreboardAdapterImpl) scoreboardAdapter).cancelBuzzer();
    }
  }

  File: src/main/java/canfield/bia/rest/GameResource.java

  Add REST endpoint:
  @DELETE @Path("/buzzer")
  public Response cancelBuzzer() {
    game.cancelBuzzer();
    return Response.ok().build();
  }

  File: src/main/java/canfield/bia/hockey/web/NativeWebSocketServer.java

  Add WebSocket event handler:
  case "cancel_buzzer":
    gameManager.cancelBuzzer();
    break;

  File: src/ui/src/transport/server.ts

  Add server action:
  cancelBuzzer: () => send({ event: 'cancel_buzzer' }),

  File: src/ui/src/control-ui.ts

  Add click handler for cancel (make existing buzzer button toggle):
  on(document, 'click', '#buzzer', () => {
    if (State.buzzerOn) {
      Server.cancelBuzzer();
    } else {
      Server.buzzer();
    }
  });

  Or add separate cancel button:
  <button id="cancel-buzzer" class="btn btn-danger" style="display: none;">Cancel Buzzer</button>

  // Show/hide cancel button based on buzzer state
  const cancelBtn = $('#cancel-buzzer');
  if (cancelBtn) {
    cancelBtn.style.display = State.buzzerOn ? 'inline-block' : 'none';
  }

  on(document, 'click', '#cancel-buzzer', () => Server.cancelBuzzer());

  2.4 Update OpenAPI Spec

  File: openapi/game.yaml

  Add endpoints:
  /game/buzzer:
    delete:
      summary: Cancel the currently playing buzzer
      responses:
        '200':
          description: Buzzer cancelled

  Add WebSocket event:
  cancel_buzzer:
    description: Cancel the currently playing buzzer

  Regenerate TypeScript types:
  cd src/ui && npm run generate:types

  ---
  Phase 3: SOG Display (Low Priority - ~2-3 hours)

  Implementation same as original plan - defer until Phase 1 & 2 are tested and deployed

  ---
  Testing Plan

  Test 1: Period Increment During Intermission
  1. Let period 1 expire → enters INTERMISSION state
  2. Click period increment button (without starting intermission timer)
  3. ✅ Verify game state changes to READY_FOR_PERIOD (not stuck in INTERMISSION)
  4. Add 2-minute penalty
  5. ✅ Verify penalty shows as "2:00" (not "14:09" or other wrong time)
  6. Start period, verify penalty clock counts down

  Test 2: Manual Intermission Timer
  1. Let period 1 expire → enters INTERMISSION
  2. ✅ Verify intermission timer does NOT auto-start
  3. ✅ Verify no continuous buzzer
  4. Manually click "Start Clock" button
  5. ✅ Verify intermission timer counts down
  6. Let it expire naturally
  7. ✅ Verify advances to next period

  Test 3: Buzzer Indicator
  1. Click manual buzzer button
  2. ✅ Verify prominent visual indicator appears (red outline + text)
  3. Wait for buzzer to expire naturally
  4. ✅ Verify indicator disappears

  Test 4: Buzzer Cancellation
  1. Trigger buzzer (manual or end-of-period)
  2. Click cancel buzzer button (or click buzzer button again)
  3. ✅ Verify buzzer stops immediately
  4. ✅ Verify visual indicator disappears

  Test 5: Intermission Indicator
  1. Let period 1 expire
  2. ✅ Verify "INTERMISSION" badge appears
  3. Click period increment button
  4. ✅ Verify "INTERMISSION" badge disappears
  5. Start period 2, verify badge stays hidden

  ---
  Summary of Changes

  | Component                     | Change                     | Impact                      |
  |-------------------------------|----------------------------|-----------------------------|
  | SimpleGameManager.setPeriod() | Clear INTERMISSION state   | Fixes penalty time bug      |
  | SimpleGameManager.java:68     | Remove auto-start          | Fixes continuous buzzer     |
  | ScoreboardAdapter             | Add cancelBuzzer()         | Enables buzzer cancellation |
  | REST API                      | Add DELETE /game/buzzer    | API for cancel              |
  | WebSocket                     | Add cancel_buzzer event    | WebSocket for cancel        |
  | UI HTML                       | Add intermission indicator | Shows INTERMISSION state    |
  | UI CSS                        | Enhance buzzer indicator   | Prominent visual feedback   |
  | UI JS                         | Wire up cancel button      | User can stop buzzer        |

  Total Time Estimate:
  - Phase 1: 30 minutes
  - Phase 2: 1.5-2 hours
  - Total: 2-2.5 hours (excluding SOG)

  ---

● Summary

  I've created a revised implementation plan that addresses your feedback:

  Key Changes from Original Plan:

  1. ✅ No new "Exit Intermission" button - Instead, we'll fix the existing period increment button to properly clear intermission state (this is currently a bug)
  2. ✅ Added intermission indicator - Visual badge showing "INTERMISSION" status
  3. ✅ Added prominent buzzer indicator - Red outline + pulsing text when buzzer is on
  4. ✅ Added buzzer cancel functionality - Either make existing buzzer button toggle on/off, or add separate cancel button

  Root Causes Identified:

  1. Continuous Buzzer: Intermission timer auto-starts (line 68), causing shift buzzer to fire repeatedly
  2. Penalty Time Bug (4:09/14:09): setPeriod() doesn't clear INTERMISSION state, so when you manually change periods, the game stays stuck in intermission mode
  3. Your workaround works: Because setting intermission to 0 bypasses the buggy state machine entirely

  Priority Implementation:

  Phase 1 (30 min) - Critical Fixes:
  - Fix setPeriod() to clear intermission state ← This fixes your period increment issue
  - Remove intermission auto-start ← This fixes the continuous buzzer

  Phase 2 (1.5-2 hours) - UI Enhancements:
  - Intermission state indicator (badge)
  - Prominent buzzer visual indicator (CSS)
  - Buzzer cancel button/functionality

  Phase 3 (deferred) - SOG display
