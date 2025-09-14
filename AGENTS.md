# Repository Guidelines

## Project Structure & Module Organization
- Source code: `src/main/java/canfield/bia/**` (entrypoint: `ServiceMain`).
- Resources and runtime assets: `src/main/dist/**` (web UI, scripts, configs) and `src/main/resources/**`.
- Tests: Java and Groovy under `src/test/java/**` and `src/test/groovy/**`; Cucumber features in `src/test/resources/**`.
- Build scripts: `build.gradle`, `settings.gradle`, Gradle wrapper `gradlew*`.

## Build, Test, and Development Commands
- Build: `./gradlew build` — compiles sources, runs tests, creates distribution.
- Test: `./gradlew test` — runs TestNG (incl. Groovy and Cucumber tests).
- Run locally: `./gradlew run` — starts the service (working dir `src/main/dist`), default args `start`.
- Clean: `./gradlew clean` — removes build outputs.

## Coding Style & Naming Conventions
- Language: Java 21; indent 4 spaces; UTF‑8; Unix line endings.
- Packages: `canfield.bia.*`; Classes `PascalCase`, methods/fields `camelCase`, constants `UPPER_SNAKE_CASE`.
- Tests: mirror package of code under test; names like `ScoreBoardTest.java` or `ScoreBoardImplTest.groovy`.
- Logging: use SLF4J (`org.slf4j.Logger`) with parameterized messages.
- Formatting: follow standard IntelliJ/Google‑style Java defaults; keep lines ≤ 120 chars.

## Testing Guidelines
- Frameworks: TestNG, Mockito, Cucumber; Selenium/WebDriver for UI integration (headless Chrome).
- Quick run: `./gradlew test`.
- Coverage: add meaningful unit tests for new logic; include at least one integration test for new endpoints or socket events.
- UI tests are organized by feature area under `src/test/resources/canfield/bia/`:
  - `ui_index.feature` (index/title, basic presence)
  - `ui_game_flow.feature` (create game, clock behavior)
  - `ui_penalties.feature` (add penalty updates list)
  - `ui_persistence.feature` (dialog field persistence)
- Step definitions live in `src/test/java/canfield/bia/UiIntegrationSteps.java`; hooks/driver setup in `UiHooks.java`.
- Prefer functional assertions over style checks. Avoid brittle CSS-hover tests in headless mode.

## Commit & Pull Request Guidelines
- Commits: imperative mood and scoped when helpful, e.g., `hockey/scoreboard: fix penalty clock drift`.
- Include context: what changed, why, and any follow‑ups.
- PRs: clear description, linked issues, test plan (commands and expected results), and screenshots/GIFs for UI changes (`src/main/dist/web/**`).
- CI/readability: ensure `./gradlew build` passes and no new warnings before requesting review.

## Security & Configuration Tips
- Runtime ports: REST `8080`, WebSocket `8082` (configurable via `-Dws.port=`). Avoid committing secrets; local logging config under `src/main/dist/conf/logback.xml`.
- Hardware I/O uses serial (PureJavaComm); mock or isolate when writing tests.

## Web UI Overview
- Control UI is served from `src/main/dist/web/index.html` (type="module" JS; no jQuery/Bootstrap JS).
- Display page is `src/main/dist/web/scoreboard.html`.
- Static assets live under `src/main/dist/web/{css,js,img,lib}`.
- Main stylesheet for the control UI: `css/index.css` (consolidates modern styles and tokens).
- Main script: `js/main.js` (native WebSocket client, REST helpers, UI wiring, persistence).

### Styling
- Buttons use CSS variables and gradients; hover/focus are intentionally high‑contrast.
- Update button colors/hover in `css/index.css`. Primary shades derive from `--accent` tokens.
- Score minus buttons use `btn-default` (de‑emphasized); shots minus matches it for consistency.

### Persistence (localStorage)
- Standard game: persists period minutes (warmup + 1–3) under `scoreboard.standard.periods`.
- Drop‑In game: persists minutes and shift settings under `scoreboard.rec.*`.
- Do not persist last game mode or specific ends‑at times. Ends‑at always derives from "now + minutes" when dialog opens.

### Transport
- REST API mounted at `/api/*` on port `8080`.
- Native WebSocket endpoint at `ws://<host>:<ws.port>/ws` (default port `8082`). The client speaks a simple JSON envelope `{event, data}`.

## UI Test Harness
- `UiHooks` starts the Jetty server and the native WebSocket server for tests. It sets `RESOURCE_BASE` to the `src/main/dist/web` folder (symlink or copy) so assets are served.
- Chrome runs headless by default. Adjust options in `UiHooks.initChromeDriver()` if you need visibility locally.
- Keep selectors stable (`id`s and key class names) to reduce flakiness.

## Developer Tips
- Keep front‑end JS framework‑free (native modules, DOM APIs). Avoid introducing heavyweight deps.
- Use the provided color tokens in `:root` to theme UI consistently.
- When adding UI behavior, prefer progressive enhancement and minimal DOM structure churn.
- For new REST endpoints or socket events, add at least one functional integration test.

