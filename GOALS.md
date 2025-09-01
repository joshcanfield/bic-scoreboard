Active Goals: Shot Counters

- Scope: add per-team shots on goal with UI controls, REST + WebSocket APIs, and in-memory tracking.

Status Snapshot
- Backend model: SimpleGameManager tracks home/away shots [Done].
- WS events: `shot` and `undo_shot` handled in `NativeWebSocketServer` [Done].
- REST: `POST /api/game/{team}/shot`, `DELETE /api/game/{team}/shot` in `GameResource` [Done].
- UI: buttons and digits wired in `src/main/dist/web/{index.html,js/main.js}` [Done].
- State updates: shots included in periodic `update` payloads [Done].

Next Actions (pick up here)
- Tests: add unit tests for `addShot/removeShot` in `SimpleGameManager` and REST integration for shot endpoints.
- Keyboard shortcuts: map hotkeys for +Shot/−Shot on home/away.
- Hardware mapping: decide if shots should be sent to the physical scoreboard (if supported) or remain UI-only.
- UX polish: disable −Shot when value is 0; ensure no negative values via UI and server (server already guards).

Validation Quick Steps
- Run service: `./gradlew run` then open the UI at `http://localhost:8080`.
- Click +Shot/−Shot for Home/Away and verify digits update.
- Verify REST: `curl -X POST http://localhost:8080/api/game/home/shot` then `GET /api/game/` shows incremented shots.

Relevant Files
- Java: `src/main/java/canfield/bia/hockey/SimpleGameManager.java` (shots state)
- Java: `src/main/java/canfield/bia/hockey/web/NativeWebSocketServer.java` (WS events + update payload)
- Java: `src/main/java/canfield/bia/rest/GameResource.java` (REST endpoints)
- Web: `src/main/dist/web/index.html`, `src/main/dist/web/js/main.js` (UI controls + rendering)

Notes
- Shots reset to 0 on `game.reset()`; covered when creating a new game or resetting state.
- Keep lines ≤ 120 chars; add tests under `src/test/java|groovy/**` per repo guidelines.

