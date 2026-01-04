---
name: java-test
description: Run Java tests with Gradle and summarize results. Shows only failures and key statistics. Use when testing Java code, validating backend changes, or debugging test failures.
allowed-tools: Bash(./gradlew test:*), Bash(./gradlew:*), Bash(cmd.exe:*), Bash(python:*), Bash(cat:*)
---

# Java Test Runner

Run Java tests and return a concise summary with only failures and statistics.

## Context Reduction Strategy

**IMPORTANT**: To minimize context usage, use one of these approaches:

### Option 1: Use Task Agent (Recommended for Large Output)

Use the Task tool with `subagent_type=Explore` to run tests in a separate context:

```
Task: Run ./gradlew test --no-daemon and summarize results. Report only:
- Total tests, passed, failed, skipped counts
- Each failure with class.method name and assertion message (max 5 lines each)
- Do NOT include passing tests or full stack traces
```

### Option 2: Pipe Through Parse Script

Run tests and pipe through the parsing script to extract only failures:

```bash
./gradlew test --no-daemon 2>&1 | python scripts/parse-test-output.py --gradle
```

### Option 3: Direct Run with Manual Summary

Run tests, then summarize the key information yourself:

```bash
./gradlew test --no-daemon
```

After running, report ONLY:
1. **Status**: PASSED or FAILED
2. **Counts**: X tests, Y passed, Z failed
3. **Failures**: Class.method + assertion message (first 5 only)

## Commands

**Run all tests:**
```bash
./gradlew test --no-daemon
```

**Run specific test class:**
```bash
./gradlew test --tests "canfield.bia.hockey.v2.engine.GameEngineTest" --no-daemon
```

**Run with verbose test output:**
```bash
./gradlew test --no-daemon --console=plain
```

**Read test report for detailed counts:**
```bash
cat build/reports/tests/test/index.html | grep -E "(tests|failures|passed)"
```

## Output Guidelines

**DO NOT** include in response:
- Full Gradle task output (compileJava, processResources, etc.)
- Passing test names
- Full stack traces (max 5 lines)
- Download progress messages

**DO** include in response:
- Overall status
- Test counts
- Each failure with concise details
- Actionable next steps
