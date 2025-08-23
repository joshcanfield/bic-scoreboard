# Bremerton Ice Arena Scoreboard

This repository contains the Bremerton Ice Arena Scoreboard application.

## How It Works

The scoreboard server manages game state for hockey matches and communicates with
both hardware and browser clients:

* **Jetty + RESTEasy** expose a REST API on port `8080` for querying and
  updating the game clock, scores, penalties, and buzzer.
* **netty-socketio** provides a WebSocket server on port `8081` that pushes
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

Start the scoreboard service with:

```sh
./gradlew run --args 'start'
```

