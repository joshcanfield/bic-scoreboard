# Bremerton Ice Arena Scoreboard

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

