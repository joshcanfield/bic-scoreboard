---
name: build
description: Validate the full project build (Java + TypeScript UI). Detects compilation errors, test failures, and build warnings. Use when making code changes and need to verify everything compiles.
allowed-tools: Bash(./gradlew:*), Bash(./gradlew build:*), Bash(./gradlew clean:*), Bash(cmd.exe:*), Bash(python:*), Bash(cat:*)
---

# Build Validator

Run full project build and return concise status with any errors.

## Context Reduction Strategy

**IMPORTANT**: To minimize context usage, use one of these approaches:

### Option 1: Use Task Agent (Recommended)

Use the Task tool with `subagent_type=general-purpose` to run build in a separate context:

```
Task: Run ./gradlew clean build --no-daemon and summarize results. Report only:
- BUILD SUCCESSFUL or BUILD FAILED
- Any compilation errors (file:line + message)
- Any test failures (count only, details via java-test skill)
- Do NOT include task progress or successful compilations
```

### Option 2: Direct Run with Filtered Summary

Run build and manually extract only errors:

```bash
./gradlew clean build --no-daemon
```

After running, report ONLY:
1. Final status: BUILD SUCCESSFUL or BUILD FAILED
2. Compilation errors (if any)
3. Test summary (X passed, Y failed)

## Commands

**Full clean build:**
```bash
./gradlew clean build --no-daemon
```

**Incremental build (faster):**
```bash
./gradlew build --no-daemon
```

**UI-only build:**
```bash
./gradlew uiBuild --info
```

## Output Guidelines

**DO NOT** include in response:
- Task progress lines (`:compileJava UP-TO-DATE`, etc.)
- Successful compilation messages
- Download progress
- Full stack traces (max 5 lines per error)
- Deprecation warnings (unless critical)

**DO** include in response:
- Final BUILD status
- Each compilation error with file:line
- Test failure count (use java-test skill for details)
- Key actionable messages
