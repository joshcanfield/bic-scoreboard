## Summary
Briefly describe the change and its impact on the scoreboard service.

## Motivation
Why is this change needed? Link related issues (e.g., #123).

## Changes
- What was added/removed/updated?
- Note any API, socket event, or UI changes under `src/main/dist/web/**`.

## Testing
Commands run and results:
```sh
./gradlew build       # compile + tests
./gradlew run         # manual check (REST :8080, WS :8081)
```
Include unit/integration tests added and their coverage of new logic.

## Screenshots / GIFs (UI)
If UI changed, attach screenshots of `scoreboard.html` or `index.html` views.

## Risks & Rollback
Potential failure modes and how to revert (e.g., `git revert` hash, config toggles).

## Checklist
- [ ] `./gradlew build` passes locally
- [ ] Tests added/updated for new behavior
- [ ] Docs updated (README/AGENTS.md/dist notes) if needed
- [ ] No secrets or local paths committed

