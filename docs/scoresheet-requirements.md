# Scoresheet Requirements & Specification

## Overview
- **Feature name:** Post-game scoresheet generation
- **Primary users:** Scorekeeper operating the Control UI, team staff, league officials
- **Business value:** Produce a printable, regulation-ready record immediately after games without rekeying from the
  scoreboard; aligns with USA Hockey / IIHF administrative expectations.

## Goals
- Provide a single-click “Download Scoresheet” action when the game reaches `GAME_OVER`.
- Capture all data necessary to satisfy standard ice hockey scoresheets (scoring, penalties, shots, rosters,
  signatures, officials).
- Support operations where league offices manage pre-game metadata externally, so operators must be able to skip metadata
  entry while still generating a scoresheet.
- Allow late corrections (metadata or event edits) prior to exporting the final document.
- Deliver a printable PDF format and an HTML view (for quick review or re-print).

## Non-goals
- No automated submission to governing-body portals (e.g., USAH Online Game Sheet) in the initial release.
- No persistent archival or search UI beyond the current game session.
- No optical signature capture; users print and sign manually.

## Stakeholders
- **Scorekeepers / timekeepers:** Need a fast workflow that mirrors familiar paper sheets.
- **League officials / referees:** Require accurate signatures and clear penalty/goal logs.
- **Technical staff:** Need maintainable data model changes and automated tests to prevent regressions.

## Current State Summary
- `SimpleGameManager` tracks goals (`Goal`), penalties (`Penalty`), scores, period, and aggregate shots per team.
- Control UI collects goals, penalties, and clock adjustments but lacks rosters, officials, or infraction details.
- No export functionality exists; game data lives in memory and websocket/REST payloads only.

## User Workflow
1. **Pre-game setup:** Enter game metadata (league, game number, venue, officials) and team rosters before starting.
2. **In-game logging:** Continue using existing controls to record goals, penalties, shots, goalie changes.
3. **Post-game review:** Adjust metadata or events if required; request scoresheet preview.
4. **Export:** Download PDF or open HTML preview, print, obtain signatures, and distribute to teams/officials.

## Data Requirements
- **Pre-game metadata (optional):** League/competition, game number, date & start time, venue/ice surface,
  attendance, weather. When skipped, scoresheet generation must still succeed and clearly indicate that details are
  managed externally.
- **Officials:** Referee(s), linesperson(s), timekeeper, penalty-box attendants, scorer.
- **Team summary:** Team name, colors, head coach, assistant coach/manager, captain/alternate identifiers, timeout usage.
- **Roster:** Player sweater number, full name, position, DOB (optional), affiliate markers; goalie subsection includes
  starter/backup designations.
- **Goal events:** Period, timestamp (elapsed & remaining), manpower situation (EV/PP/SH/EN/PS), scorer number & name,
  assist numbers & names, goal type (even strength, power-play, shorthanded, empty net), running score after the goal.
- **Penalty events:** Period, assessed timestamp, player penalized & serving, infraction code/description,
  duration, start & end time (clock), resulting manpower effect, notes for coincident penalties.
- **Shots & special teams:** Shots on goal per period (OT included), power-play opportunities & goals, penalty kill result.
- **Goalie stats:** For each goalie: minutes played, shots faced, saves, goals against (EV/PP/SH/EN breakdown).
- **Signatures:** Signature lines for referee, scorekeeper, both head coaches; include date/time fields.
- **Supplemental:** Shootout log (round, shooter, result) and incident notes (injury, equipment) for optional capture.

## Functional Requirements
- `FR1` Capture and persist game metadata via new REST endpoints and Control UI forms; allow leagues to disable or bypass
  in-app metadata collection while still supporting external ingestion (e.g., API read-only mode).
- `FR2` Capture team roster and staff information with validation for required fields before start.
- `FR3` Extend goal and penalty submission payloads to include strength/type and infraction metadata.
- `FR4` Track goalie participation, shots per period, and special-teams tallies in real time.
- `FR5` Provide a server-side `ScoresheetDTO` endpoint aggregating all required data.
- `FR6` Render scoresheet into HTML template; offer PDF export via server-side rendering pipeline.
- `FR7` Notify UI when a fresh scoresheet is available post `GAME_OVER`; allow manual regeneration.
- `FR8` Persist metadata locally (e.g., `localStorage`) for quick reuse while avoiding auto-fill of final scores.
- `FR9` Handle correction flows (e.g., edited goal time) and regenerate totals consistently.

## UX & UI Requirements
- Extend “New Game” dialog with tabs for **Game Details**, **Home Team**, **Away Team**, **Officials**, with a toggle to
  skip metadata entry when managed externally.
- Include roster table inputs with keyboard-friendly navigation and CSV import (optional stretch).
- Display validation indicators before enabling “Start Game” (e.g., missing head coach or roster entries); if metadata
  capture is disabled, validation should respect the reduced requirement set.
- Provide in-game quick-access overlays to edit metadata and goalie assignments without leaving the main screen.
- Add dedicated stats widgets for shots per period and special teams summary on the Control UI sidebar.
- Include a `Download Scoresheet` button once the scoreboard enters `GAME_OVER`, with tooltip if data incomplete.

## Backend & API Requirements
- Introduce `ScoresheetMetadata`, `TeamSheet`, `OfficialAssignment` domain objects stored in `SimpleGameManager`.
- Add REST endpoints:
  - `GET /api/game/scoresheet` -> returns `ScoresheetDTO`
  - `PUT /api/game/metadata` -> stores metadata
  - `PUT /api/game/{team}/roster` -> stores roster
  - `PUT /api/game/{team}/goalies` -> updates goalie usage
- Update websocket events to broadcast metadata and roster changes for live UI sync.
- Ensure `ScoresheetDTO` contains pre-formatted strings for clock times plus raw millis for flexibility.
- Add optional persistence hook (JSON file) controlled via config for post-game archival.

## Output Specification
- **Layout:** Two-column landscape PDF mirroring USA Hockey official scoresheet with home/away sections split.
- **Sections:** Header, team roster tables, scoring summary, penalties, goalie stats, shots table, special teams, signatures.
- **Formatting:** Support 8.5×11 letter size, 0.5 in margins, 10pt base font (Roboto/Helvetica). Alternate background shading for
  rows to aid readability.
- **Accessibility:** HTML preview uses semantic tables with `aria` labels; ensure PDF text is selectable (no rasterization).
- **File naming:** `YYYYMMDD-League-TeamA-vs-TeamB-Game####-scoresheet.pdf`.

## Non-functional Requirements
- Generate PDF within 2 seconds on target hardware after `GAME_OVER`.
- Survive UI refresh; metadata must serve from backend state.
- Handle up to 30 penalties and 20 goals per side without layout overflow.
- Avoid network access outside internal REST/WS (per deployment constraints).

## Testing Strategy
- Unit tests for DTO builders (e.g., compute manpower, running score, goalie minutes).
- Integration tests hitting `/api/game/scoresheet` verifying JSON shape and derived totals.
- UI integration (Cucumber) to confirm metadata validation, roster entry persistence, and export button gating.
- Snapshot or text-based tests for HTML template (e.g., using Jsoup assertions).
- Manual QA checklist: sample printed copy with signatures, long-game stress (multiple OTs, coincident majors).

## Risks & Unknowns
- Need authoritative mapping of infraction codes (e.g., USAH vs local league variants).
- Goalie stat collection requires shot-by-shot logging per period; current system only stores totals.
- PDF rendering library selection (e.g., Flying Saucer vs OpenPDF) adds dependency and potential build complexity.
- Storage strategy for multi-game retention (future requirement) remains undecided.

## Open Questions
1. Do we need to support bilingual labels on the scoresheet?
2. Should the system track running faceoff stats, or is that entered manually later?
3. Is there a requirement to email scoresheets automatically to teams?
4. Should we allow importing pre-defined rosters from CSV to reduce operator workload?

## References
- USA Hockey Official Scoresheet (2019 edition)
- IIHF Game Summary Report template
- Existing `SimpleGameManager` data structures (`src/main/java/canfield/bia/hockey/SimpleGameManager.java`)
- Control UI components (`src/main/dist/web/js/*`)


