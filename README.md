# Bremerton Ice Arena Scoreboard

[![CI](https://github.com/joshcanfield/bic-scoreboard/actions/workflows/ci.yml/badge.svg)](https://github.com/joshcanfield/bic-scoreboard/actions/workflows/ci.yml)

This repository contains the Bremerton Ice Arena Scoreboard application.

## How It Works

The scoreboard server manages game state for hockey matches and communicates with
both hardware and browser clients:

* **Jetty + RESTEasy** expose a REST API on port `8080` for querying and
  updating the game clock, scores, penalties, and buzzer.
* Native WebSocket server on port `8082` pushes
  real‑time score and clock updates to connected web clients.
* **PureJavaComm** connects to the physical scoreboard over a serial port so
  on-ice displays mirror the server state.
* **Dagger** wires these components together and produces singletons for the
  scoreboard state and services.

## Technologies

The project is written in **Java 21** and built with **Gradle**. It also uses:

* **Joda-Time** for time calculations
* **SLF4J/Logback** for logging
* **TestNG** and **Mockito** for testing

## Building

Use the Gradle wrapper to build the project:

```sh
./gradlew build
```

## Testing

Run the test suite with:

```sh
./gradlew test
```

## Running

Start the scoreboard service:

```sh
./gradlew run --args 'start'
```

Default ports and endpoints:

- HTTP API and static files: http://localhost:8080/
  - Control UI: http://localhost:8080/index.html
  - Display UI: http://localhost:8080/scoreboard.html
- Native WebSocket: ws://localhost:8082/ws

Runtime configuration (JVM system properties):

- `-Dws.port=8082`: WebSocket server port
- `-DRESOURCE_BASE=web`: static file root relative to working dir (default: `web` under `src/main/dist`)
- `-Dscoreboard.commport=usb.ttyserial`: serial port name for hardware I/O

You can override socket host/port used by the UIs via URL params, e.g.:

```
http://localhost:8080/index.html?socketHost=example.com&socketPort=9090
```

## Deployment

We now deploy using a Windows app image (bundled runtime). Zip/tar distributions are disabled.

**Prerequisites**
- Open inbound ports `8080` (HTTP) and `8082` (WebSocket) on the host firewall if other devices connect.

**Windows App Image (bundled runtime)**
- Build locally with jpackage (requires JDK 21 with jpackage; Temurin 21 recommended):
  - PowerShell:
    - `$env:JAVA_HOME="C:\\Path\\To\\Temurin\\jdk-21.x"`
    - `$env:PATH="$env:JAVA_HOME\\bin;$env:PATH"`
    - `./gradlew jpackageFullJre`
  - Output app image: `build/jpackage/scoreboard/`
- Deploy by copying the `scoreboard/` folder to the target machine and running `scoreboard.exe`.
- A small launcher dialog appears (Close exits cleanly). Click “Open Scoreboard” to launch the UI.

Zip for handoff
- Create a portable zip of the app image: `./gradlew appImageZip`
- Output: `build/artifacts/scoreboard-<version>-app-image.zip`

Installer note
- Creating an MSI/EXE installer requires WiX on PATH; the app image above is sufficient for most installs.

**Start/Stop Helpers**
- Stop any running packaged instance from the repo: `./gradlew stopPackaged`
- Run UI tests against the packaged app (headless Chrome): `./gradlew uiTestPackaged`

**Service Management (optional)**
- Windows (auto-start): Use Task Scheduler to run `scoreboard.exe` at logon, or wrap with NSSM.

**Runtime Tweaks**
- JVM properties:
  - `-Dws.port=8082` to change WebSocket port.
  - `-DRESOURCE_BASE=/path/to/web` to override static file root.
  - `-Dscoreboard.showDialog=true` to show the launcher dialog on startup (enabled in packaged app).


