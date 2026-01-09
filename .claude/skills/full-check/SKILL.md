---
name: check
description: Run full project validation - Java tests, UI tests, lint, and typecheck. Comprehensive validation before commits or PRs. Use when you need to verify all code quality checks pass.
allowed-tools: Bash(./gradlew:*), Bash(npm:*), Bash(cd:*), Bash(cmd.exe:*), Bash(python:*), Bash(cat:*)
---

# Full Project Check

Run all validation checks and return a consolidated summary.

## Context Reduction Strategy

**IMPORTANT**: For comprehensive checks, use the Task agent to run in a separate context and return only a summary.

### Recommended: Use Task Agent

Use the Task tool with `subagent_type=general-purpose`:

```
Task: Run full project validation and return a consolidated status table. Execute these checks in order:

1. cd src/ui && npm run lint
2. cd src/ui && npm run typecheck
3. cd src/ui && npm run test
4. ./gradlew test --no-daemon

Return a summary table like:
| Check      | Status | Details |
|------------|--------|---------|
| Lint       | PASS   | 0 errors, 2 warnings |
| Typecheck  | PASS   | - |
| UI Tests   | PASS   | 65 tests |
| Java Tests | PASS   | 42 tests |

If any check fails, include first 3 error messages.
```

## Quick Check Commands

**UI validation only (lint + test + typecheck):**
```bash
cd src/ui && npm run check
```

**Gradle UI validation:**
```bash
./gradlew uiCheck
```

**Full validation (all checks):**
```bash
./gradlew uiCheck && ./gradlew test --no-daemon
```

## Output Format

Always produce a summary table:

```
CHECK RESULTS
=============
| Check      | Status | Details           |
|------------|--------|-------------------|
| Lint       | ✓ PASS | 0 errors          |
| Typecheck  | ✓ PASS | -                 |
| UI Tests   | ✓ PASS | 65 tests, 0.8s    |
| Java Tests | ✓ PASS | 42 tests, 5.2s    |

Overall: ALL CHECKS PASSED
```

Or if failures:

```
CHECK RESULTS
=============
| Check      | Status | Details           |
|------------|--------|-------------------|
| Lint       | ✗ FAIL | 3 errors          |
| Typecheck  | SKIP   | (blocked by lint) |
...

LINT ERRORS:
- src/view/penalties.ts:45 - 'x' is defined but never used
- src/view/penalties.ts:52 - Missing return type
- (1 more...)

Overall: FAILED (lint)
```

## Output Guidelines

**DO NOT** include:
- Full output from each check
- Passing test names
- Intermediate progress messages

**DO** include:
- Summary table with status per check
- First 3-5 errors from any failing check
- Overall pass/fail status
