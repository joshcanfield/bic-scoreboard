---
name: ui-test
description: Run TypeScript UI tests with Vitest and summarize results. Shows failures and coverage stats. Use when testing UI code in src/ui, validating TypeScript changes, or debugging test failures.
allowed-tools: Bash(npm run test:*), Bash(cd:*), Bash(npm:*), Bash(python:*), Bash(cat:*)
---

# UI Test Runner

Run TypeScript UI tests using Vitest and return a concise summary.

## Context Reduction Strategy

**IMPORTANT**: To minimize context usage, use one of these approaches:

### Option 1: Use Task Agent (Recommended for Large Output)

Use the Task tool with `subagent_type=Explore` to run tests in a separate context:

```
Task: Run UI tests in src/ui with npm run test and summarize results. Report only:
- Total test files, tests, passed, failed counts
- Each failure with file:test name and assertion (max 5 lines each)
- Duration
- Do NOT include passing tests or full DOM snapshots
```

### Option 2: Pipe Through Parse Script

Run tests and pipe through the parsing script:

```bash
cd src/ui && npm run test 2>&1 | python ../scripts/parse-test-output.py --vitest
```

### Option 3: Direct Run with Manual Summary

Run tests, then summarize the key information:

```bash
cd src/ui && npm run test
```

## Commands

**Run all UI tests:**
```bash
cd src/ui && npm run test
```

**Run specific test file:**
```bash
cd src/ui && npm run test -- src/view/penalties.test.ts
```

**Run with parsed output:**
```bash
cd src/ui && npm run test 2>&1 | python ../scripts/parse-test-output.py --vitest
```

## Output Guidelines

**DO NOT** include in response:
- Each passing test name and checkmark
- Full DOM/component snapshots
- Vite compilation progress
- Complete expected vs actual diffs (truncate to key differences)

**DO** include in response:
- Overall status (PASS/FAIL)
- Test counts: suites, tests, passed, failed
- Duration
- Each failure with:
  - File and test name
  - Brief assertion message
  - Key expected vs actual difference
