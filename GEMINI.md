# Project Overview

This project is a hockey scoreboard application for the Bremerton Ice Arena. It is written in Java 21 and built with Gradle.

The application consists of a server that manages the game state and communicates with both hardware and browser clients.

- **Jetty:** Serves the frontend web UI and static assets on port `8080`.
- **GameWebSocketV2 server:** Receives JSON commands and pushes real-time game state updates and patches to connected web clients on port `8082`.
- **GameEngine:** Manages official game clock, periods, scores, penalties, and intermissions.
- **jSerialComm + LegacyScoreboardHardwareAdapter:** Bridges state to the physical scoreboard over a serial port so on-ice displays mirror the server state.

For more detailed information on project structure, build commands, coding style, and other guidelines, please refer to [AGENTS.md](AGENTS.md).