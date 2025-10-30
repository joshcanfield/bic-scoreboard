# BIC Scoreboard

This project provides a local service and web UI for operating a hockey scoreboard, with REST and WebSocket control surfaces and end‑to‑end UI tests.

## Build, Run, and Test

### Unified Build (Java + UI)

- **Build everything**: `./gradlew build` (builds Java backend + TypeScript UI)
- **Run locally**: `./gradlew run` (working dir `src/main/dist`, default args `start`)
- **Tests**: `./gradlew test` (Java tests only)
- **Clean**: `./gradlew clean` (cleans both Java and UI builds)

### UI-Only Tasks

- **Build UI**: `./gradlew uiBuild` (runs `npm run build` in `src/ui/`)
- **UI tests**: `./gradlew uiTest` (runs Vitest unit tests)
- **UI validation**: `./gradlew uiCheck` (runs lint + tests + typecheck)
- **Clean UI**: `./gradlew uiClean`

Java 21 is required. The repo ships a tools JDK for convenience on some machines, but you can also use a system JDK 21.

**Note**: Node.js 20 is automatically downloaded and managed by the Gradle Node plugin. You don't need to install Node separately for Gradle builds, but having it locally is recommended for faster UI development iterations.

### Continuous Integration

CI workflows automatically validate both Java and UI code:
- **UI validation**: Runs `uiCheck` (lint, typecheck, Vitest tests) before the main build
- **Java tests**: Standard TestNG tests including Selenium UI integration tests
- **Caching**: Gradle and Node downloads are cached for faster builds
- **Artifacts**: Test reports and coverage from both Java and UI tests are uploaded

## Front-End Tooling Prerequisites

- Node.js 20 (see `.nvmrc` / `.node-version` for the exact version; `nvm use` or Volta will pick it up automatically).
- npm (bundled with Node 20) for installing and running the UI build pipeline (Vite, Vitest, Playwright) during the TypeScript migration.
- Headless browser tooling (Playwright) will be introduced in later phases; expect an `npm install` to set up required binaries.

### TypeScript UI Development

The control UI has been fully migrated to TypeScript. The workspace lives under `src/ui/`.

#### Setup
```bash
cd src/ui
npm install
```

#### Development Commands
- **Development server**: `npm run dev` - Starts Vite dev server with hot reload and proxies to Java backend
- **Build**: `npm run build` - Builds production bundle to `src/main/dist/web-generated`
- **Tests**: `npm run test` - Runs all Vitest unit tests (65 tests across 14 files)
- **Lint**: `npm run lint` - Runs ESLint on TypeScript files
- **Type check**: `npm run typecheck` - Validates TypeScript types
- **Full validation**: `npm run check` - Runs lint + test + typecheck (matches CI validation)
- **Generate API types**: `npm run generate:types` - Generates TypeScript types from `openapi/game.yaml`

#### Architecture

The UI is organized into focused TypeScript modules:

**Entry Point:**
- `control-ui.ts` - Main entry point that initializes all UI components

**Core Utilities:**
- `utils/time.ts` - Time parsing, formatting, and clock utilities
- `utils/rec-time.ts` - Recreational game time calculations and normalization

**API Layer:**
- `api/http.ts` - REST client with type-safe fetch wrapper
- `api/game.types.ts` - Generated TypeScript types from OpenAPI spec

**Transport:**
- `transport/native-ws.ts` - WebSocket transport with reconnection logic
- `transport/server.ts` - Server command wrappers and event typing

**State Management:**
- `state/control-state.ts` - Control state derivation and view model builders

**View Components:**
- `view/modals.ts` - Bootstrap-like modal management
- `view/team-colors.ts` - Team color picker with persistence
- `view/clock-settings.ts` - Clock setting dialog
- `view/penalty-dialog.ts` - Penalty creation and details dialogs
- `view/game-dialog.ts` - New game creation (standard and drop-in modes)
- `view/penalties.ts` - Penalty table rendering
- `view/ports.ts` - Serial port connection UI

**Rec Game Helpers:**
- `rec/game-time.ts` - Drop-in game time management, ends-at sync, shift hints

All modules include comprehensive Vitest tests with 100% core logic coverage.

## Test Environment (Windows/WSL and Linux)

UI tests use Selenium with headless Chrome. For a smooth setup:

- Preferred: install Google Chrome and let WebDriverManager manage Chromedriver.
  - Linux/WSL (Ubuntu):
    - Add Google repo and install Chrome (one‑time):
      - `sudo install -d -m 0755 /etc/apt/keyrings`
      - `curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /etc/apt/keyrings/google-linux-signing-keyring.gpg`
      - `echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-linux-signing-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list > /dev/null`
      - `sudo apt-get update && sudo apt-get install -y google-chrome-stable`
- JDK 21: either use your system JDK 21 or the bundled tools JDK.

### Running tests on WSL/Linux

Option A (with system JDK 21 on PATH):

- Ensure Java 21 is available: `sudo apt-get install -y openjdk-21-jdk-headless`
- Run tests: `./gradlew --no-daemon test`

Option B (using bundled tools JDK):

- Use helper script `scripts/test-wsl.sh` which:
  - Prepends `tools/temurin-21/jdk-21.0.8+9/bin` to PATH
  - Unsets `JAVA_HOME`
  - Runs `./gradlew --no-daemon test`

### Notes

- Do not set `JAVA_HOME` when invoking the Gradle wrapper in WSL if it points to a Windows path; prefer putting the desired JDK first on `PATH`.
- WebDriverManager in `UiHooks` automatically provisions a matching Chromedriver for the installed Chrome and respects proxy settings via `https_proxy`.
- Headless flags are configured for CI/containers/WSL: `--headless=new --no-sandbox --disable-dev-shm-usage`.

## Intermission Configuration

- Standard games can set an intermission duration when creating a new game.
- UI “none” sets the intermission to `0` minutes.
- Backend treats `0` as “no intermission” and advances directly to the next period when a period ends.

