# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BIC Scoreboard is a local service and web UI for operating a hockey scoreboard at Bremerton Ice Arena. It provides REST and WebSocket APIs for control, with a Java backend and a TypeScript UI currently in migration.

## Physical Scoreboard Fields

The physical scoreboard (see `docs/Scoreboard.jpg`) displays only these fields, which are **required** when collecting data:

- **Home score** - Team score (left side)
- **Guest score** - Team score (right side)
- **Game clock** - Time remaining in period
- **Period** - Current period number
- **Home penalty player** - Player number serving penalty
- **Home penalty time** - Time remaining on home penalty
- **Guest penalty player** - Player number serving penalty
- **Guest penalty time** - Time remaining on guest penalty

All other data fields in the software (e.g., player names, goal details, shot counts) are **optional** since they don't display on the physical board.

## Build and Test Commands

### Java Backend

- **Build**: `./gradlew build` (also builds TypeScript UI automatically)
- **Run locally**: `./gradlew run` (starts server on http://localhost:8080)
- **Run tests**: `./gradlew test` (Java tests only)
- **Clean**: `./gradlew clean` (cleans both Java and UI builds)
- **Run single test**: `./gradlew test --tests "canfield.bia.ClassName.testMethodName"`

### TypeScript UI - Gradle Integration

The UI build is integrated with Gradle via the Node plugin. Node 20.11.1 is automatically downloaded.

- **Build UI**: `./gradlew uiBuild` (outputs to `src/main/dist/web-generated`, runs automatically during `./gradlew build`)
- **UI tests**: `./gradlew uiTest` (runs Vitest unit tests)
- **UI validation**: `./gradlew uiCheck` (runs lint + tests + typecheck)
- **Clean UI**: `./gradlew uiClean` (runs automatically during `./gradlew clean`)

### TypeScript UI - Direct npm Commands (src/ui/)

For faster iteration during development, you can run npm commands directly. First `cd src/ui`, then:

- **Install dependencies**: `npm install`
- **Dev server**: `npm run dev` (runs Vite with proxies to Java service on port 5173)
- **Build**: `npm run build` (outputs to `src/main/dist/web-generated`)
- **Run tests**: `npm run test` (Vitest)
- **Lint**: `npm run lint`
- **Type check**: `npm run typecheck`
- **Full validation**: `npm run check` (runs lint, test, and typecheck)

### Packaging

- **Package as Windows app**: `./gradlew jpackageFullJre` (requires JAVA_HOME set to JDK 21, creates app-image in `build/jpackage/scoreboard`)
- **Create distribution zip**: `./gradlew appImageZip` (creates zip in `build/artifacts`)
- **UI test packaged app**: `./gradlew uiTestPackaged` (runs Cucumber tests against packaged executable)
- **Stop packaged app processes**: `./gradlew stopPackaged`

### WSL/Linux Testing

When running tests on WSL or Linux:

- **Option A**: Use system JDK 21: `./gradlew --no-daemon test`
- **Option B**: Use bundled tools JDK: `scripts/test-wsl.sh`

Note: Do not set `JAVA_HOME` to a Windows path in WSL; prefer putting the desired JDK first on `PATH`.

## Requirements

- **Java**: JDK 21 (bundled tools JDK available, or use system JDK)
- **Node.js**: 20 (see `.nvmrc` or `.node-version` for exact version)
- **Chrome**: Required for Selenium UI tests (WebDriverManager auto-provisions ChromeDriver)

## Architecture

### Backend (Java)

- **Entry point**: `canfield.bia.ServiceMain` - Handles startup, working directory normalization, optional GUI dialog
- **Server**: `canfield.bia.HockeyGameServer` - Manages Jetty (serves static UI on port 8080)
- **WebSocket Server**: `canfield.bia.hockey.v2.web.GameWebSocketV2` - Port 8082, receives JSON commands (`{type, payload}`) and broadcasts state patches (`STATE_PATCH`, `INITIAL_STATE`)
- **Game Engine**: `canfield.bia.hockey.v2.engine.GameEngine` - Stateful engine managing official clock, periods, scores, penalties, and intermissions
- **Hardware Adapter**: `LegacyScoreboardHardwareAdapter` + `ScoreboardAdapterImpl` (jSerialComm) - Bridges game state over serial port to the physical Daktronics/All-American scoreboard

### Frontend

The UI is built with **TypeScript + Vite**:

- **TypeScript UI Source**: `src/ui/` - Vite-based workspace with modular TypeScript components
- **Static Assets**: `src/ui/public/` - CSS, fonts, images, and shortcut configs (copied to `web-generated/` during build)
- **Build Output**: `src/main/dist/web-generated/` - Compiled TypeScript bundles and assets served by Jetty on port 8080
- **WebSocket Client**: `src/ui/src/websocket.ts` - Typed client communicating directly with `GameWebSocketV2` on port 8082

### API Communication

- **WebSocket**: `ws://localhost:8082` - JSON messages communicating with `GameWebSocketV2`:
  - Client to Server: `{type: "<COMMAND_NAME>", payload: { ... }}` (e.g. `CREATE_GAME`, `START_CLOCK`, `PAUSE_CLOCK`, `ADD_PENALTY`, `ADD_GOAL`, `ADD_SHOT`, `SET_PERIOD`, `RESET_GAME`, `GET_PORTS`, `START_ADAPTER`)
  - Server to Client: `{type: "INITIAL_STATE", data: GameState}` and `{type: "STATE_PATCH", data: patch}`
- **Protocol types**: Maintained in `src/ui/src/api/v2-types.ts` mirroring Java domain and command models.

### Testing

- **Java tests**: TestNG + JUnit 5, Mockito (unit), Selenium + Cucumber (UI integration)
- **TypeScript tests**: Vitest for unit tests in `src/ui`
- **UI integration**: `canfield.bia.UiIntegrationTest` runs Cucumber scenarios with headless Chrome
- **Packaged app tests**: `uiTestPackaged` task starts the packaged executable and runs UI tests against it

### Packaging and Distribution

- **jlink**: Creates trimmed runtime image with `jpackage` for Windows EXE installer
- **jpackageFullJre**: Fallback using shadow JAR and full JRE when jlink JPMS conflicts occur
- **Working dir normalization**: `ServiceMain.normalizeAppWorkingDir()` sets `RESOURCE_BASE` and `user.dir` when running from packaged app-image
- **Static assets**: `src/main/dist/` (web-generated, conf, bin) copied into packaged app image

## Key Configuration Files

- **Vite config**: `src/ui/vite.config.ts` - Dev server proxies, build output to `web-generated`
- **Gradle**: `build.gradle` - Java 21, Jetty 11, Logback 1.5, jpackage tasks

## Common Workflows

### Local Development

1. Start Java service: `./gradlew run` (port 8080, WebSocket 8082)
2. In separate terminal: `cd src/ui && npm run dev` (UI dev server on port 5173)
3. Access UI at http://localhost:5173 (proxies to WebSocket on 8082)

### Adding TypeScript UI Code

1. Create modules under `src/ui/src/`
2. Add Vitest tests alongside implementation
3. Update `src/ui/index.html` if adding new entry points
4. Run `npm run check` to validate lint, tests, types

### Intermission Configuration

- Standard games can set intermission duration when creating a new game
- UI "none" option sets intermission to `0` minutes
- Backend treats `0` as "no intermission" and advances directly to next period when period ends
