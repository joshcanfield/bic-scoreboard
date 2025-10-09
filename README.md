# BIC Scoreboard

This project provides a local service and web UI for operating a hockey scoreboard, with REST and WebSocket control surfaces and end‑to‑end UI tests.

## Build, Run, and Test

- Build: `./gradlew build`
- Run locally: `./gradlew run` (working dir `src/main/dist`, default args `start`)
- Tests: `./gradlew test`
- Clean: `./gradlew clean`

Java 21 is required. The repo ships a tools JDK for convenience on some machines, but you can also use a system JDK 21.

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

