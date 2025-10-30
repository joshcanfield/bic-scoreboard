# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BIC Scoreboard is a local service and web UI for operating a hockey scoreboard at Bremerton Ice Arena. It provides REST and WebSocket APIs for control, with a Java backend and a TypeScript UI currently in migration.

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
- **Generate API types**: `npm run generate:types` (consumes `openapi/game.yaml` to produce `src/api/game.types.ts`)

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
- **Server**: `canfield.bia.HockeyGameServer` - Manages Jetty (port 8080) and native WebSocket server (port 8082)
- **REST API**: `canfield.bia.rest.GameResource` - RESTEasy 6 endpoints under `/api/game/*`
- **DI**: Dagger 1.x via `GameApplication.getObjectGraph()`
- **Game logic**: `SimpleGameManager` coordinates game state, clock, scoreboard adapter
- **Scoreboard I/O**: `ScoreboardAdapter` handles serial port communication with physical scoreboard hardware
- **WebSocket**: `NativeWebSocketServer` broadcasts game updates and accepts control commands

### Frontend

The UI has been **fully migrated to TypeScript**:

- **TypeScript UI Source**: `src/ui/` - Vite-based workspace with full TypeScript migration
- **Static Assets**: `src/main/dist/web/` - CSS, fonts, images, Bootstrap libraries (Vite `publicDir`)
- **Build Output**: `src/main/dist/web-generated/` - Compiled TypeScript bundles + copied static assets (served by Jetty)
- **Migration status**: ✅ Complete - All control UI logic migrated to TypeScript with 65 passing tests
- **Build integration**: Vite proxies `/api` to `http://localhost:8080` and `/ws` to `ws://localhost:8082` during dev
- **Server configuration**: HockeyGameServer serves from `web-generated/` (TypeScript build output)

### API Communication

- **REST**: `GET/POST/PUT /api/game` for game state, goals, shots, penalties, buzzer, power control
- **WebSocket**: `ws://localhost:8082/ws` - JSON envelope `{"event": string, "data": any}`
  - Outbound: `update` (game state snapshot), `power` (scoreboard power state)
  - Inbound: `goal`, `shot`, `undo_goal`, `undo_shot`, `clock_start`, `clock_pause`, `set_period`, `buzzer`, `power`, `createGame`
- **API types**: Generated from `openapi/game.yaml` via `npm run generate:types` in `src/ui`

### Testing

- **Java tests**: TestNG, Mockito (unit), Selenium + Cucumber (UI integration)
- **TypeScript tests**: Vitest for unit tests of migrated modules
- **UI integration**: `canfield.bia.UiIntegrationTest` runs Cucumber scenarios with headless Chrome
- **Packaged app tests**: `uiTestPackaged` task starts the packaged executable and runs UI tests against it

### Packaging and Distribution

- **jlink**: Creates trimmed runtime image with `jpackage` for Windows EXE installer
- **jpackageFullJre**: Fallback using shadow JAR and full JRE when jlink JPMS conflicts occur
- **Working dir normalization**: `ServiceMain.normalizeAppWorkingDir()` sets `RESOURCE_BASE` and `user.dir` when running from packaged app-image
- **Static assets**: `src/main/dist/` (web, conf, bin) copied into packaged app image

## Key Configuration Files

- **OpenAPI spec**: `openapi/game.yaml` - REST API contract, consumed by TypeScript type generator
- **Vite config**: `src/ui/vite.config.ts` - Dev server proxies, build output to `web-generated`
- **Gradle**: `build.gradle` - Java 21, Jetty 11, RESTEasy 6, Dagger, jpackage tasks
- **Migration tracker**: `typescript_migration_plan.md` - Phased migration roadmap and progress

## Common Workflows

### Local Development

1. Start Java service: `./gradlew run` (port 8080, WebSocket 8082)
2. In separate terminal: `cd src/ui && npm run dev` (UI dev server on port 5173)
3. Access UI at http://localhost:5173 (proxies API calls to Java service)

### Adding TypeScript UI Code

1. Create modules under `src/ui/src/`
2. Add Vitest tests alongside implementation
3. Update `src/ui/index.html` if adding new entry points
4. Run `npm run check` to validate lint, tests, types
5. Legacy UI can import TypeScript modules during transition via `legacy-*` shims

### Updating REST API

1. Modify `canfield.bia.rest.GameResource` for new endpoints
2. Update `openapi/game.yaml` to reflect changes
3. Run `npm run generate:types` in `src/ui/` to regenerate TypeScript types
4. Update UI code to use new types

### Intermission Configuration

- Standard games can set intermission duration when creating a new game
- UI "none" option sets intermission to `0` minutes
- Backend treats `0` as "no intermission" and advances directly to next period when period ends
