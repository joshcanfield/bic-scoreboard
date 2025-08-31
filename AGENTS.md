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
- Frameworks: TestNG, Mockito, Cucumber; Selenium/WebDriver for UI integration.
- Quick run: `./gradlew test` (headless friendly). Tag or limit suites at the TestNG/Cucumber level when adding long‑running UI tests.
- Coverage: add meaningful unit tests for new logic; include at least one integration test for new endpoints or socket events.
- Naming: unit tests `*Test` for classes; step defs under `src/test/java|groovy/**` with features in `src/test/resources/**`.

## Commit & Pull Request Guidelines
- Commits: imperative mood and scoped when helpful, e.g., `hockey/scoreboard: fix penalty clock drift`.
- Include context: what changed, why, and any follow‑ups.
- PRs: clear description, linked issues, test plan (commands and expected results), and screenshots/GIFs for UI changes (`src/main/dist/web/**`).
- CI/readability: ensure `./gradlew build` passes and no new warnings before requesting review.

## Security & Configuration Tips
- Runtime ports: REST `8080`, WebSocket `8081`. Avoid committing secrets; local logging config under `src/main/dist/conf/logback.xml`.
- Hardware I/O uses serial (PureJavaComm); mock or isolate when writing tests.

