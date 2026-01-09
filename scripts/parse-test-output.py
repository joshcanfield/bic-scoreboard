#!/usr/bin/env python3
"""
Parse test output from Gradle or Vitest and extract failures/summary.
Usage:
    ./gradlew test 2>&1 | python scripts/parse-test-output.py --gradle
    cd src/ui && npm run test 2>&1 | python scripts/parse-test-output.py --vitest
"""

import sys
import re
import argparse


def strip_ansi(text: str) -> str:
    """Remove ANSI escape codes from text."""
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

def parse_gradle_output(content: str) -> dict:
    """Extract test failures and statistics from Gradle output."""
    content = strip_ansi(content)
    lines = content.split('\n')

    result = {
        'status': 'UNKNOWN',
        'tests': 0,
        'passed': 0,
        'failed': 0,
        'skipped': 0,
        'failures': [],
        'errors': []
    }

    current_failure = []
    in_failure = False

    for i, line in enumerate(lines):
        # Detect build status
        if 'BUILD SUCCESSFUL' in line:
            result['status'] = 'PASSED'
        elif 'BUILD FAILED' in line:
            result['status'] = 'FAILED'

        # Parse test counts from various formats
        # Format: "X tests completed, Y failed, Z skipped"
        match = re.search(r'(\d+)\s+tests?\s+completed', line, re.IGNORECASE)
        if match:
            result['tests'] = int(match.group(1))

        match = re.search(r'(\d+)\s+failed', line, re.IGNORECASE)
        if match:
            result['failed'] = int(match.group(1))

        match = re.search(r'(\d+)\s+skipped', line, re.IGNORECASE)
        if match:
            result['skipped'] = int(match.group(1))

        # Capture failure sections
        if 'FAILED' in line and '>' in line:
            in_failure = True
            current_failure = [line]
        elif in_failure:
            if line.strip() == '' or line.startswith('>') or 'BUILD' in line:
                if current_failure:
                    result['failures'].append('\n'.join(current_failure[:15]))
                in_failure = False
                current_failure = []
            else:
                current_failure.append(line)

        # Capture compilation errors
        if ': error:' in line.lower() or 'error: ' in line.lower():
            result['errors'].append(line.strip())

    # Calculate passed
    result['passed'] = result['tests'] - result['failed'] - result['skipped']

    return result

def parse_vitest_output(content: str) -> dict:
    """Extract test failures and statistics from Vitest output."""
    content = strip_ansi(content)
    lines = content.split('\n')

    result = {
        'status': 'UNKNOWN',
        'suites': 0,
        'tests': 0,
        'passed': 0,
        'failed': 0,
        'skipped': 0,
        'duration': '',
        'failures': [],
        'errors': []
    }

    current_failure = []
    in_failure = False

    for i, line in enumerate(lines):
        # Parse test summary line
        # Format: "Test Files  1 passed (1)"
        # Format: "Tests  65 passed (65)"
        if 'Test Files' in line:
            match = re.search(r'(\d+)\s+passed', line)
            if match:
                result['suites'] = int(match.group(1))
            match = re.search(r'(\d+)\s+failed', line)
            if match:
                result['status'] = 'FAILED'

        if line.strip().startswith('Tests') and 'passed' in line:
            match = re.search(r'(\d+)\s+passed', line)
            if match:
                result['passed'] = int(match.group(1))
            match = re.search(r'(\d+)\s+failed', line)
            if match:
                result['failed'] = int(match.group(1))
            match = re.search(r'(\d+)\s+skipped', line)
            if match:
                result['skipped'] = int(match.group(1))
            result['tests'] = result['passed'] + result['failed'] + result['skipped']

        # Parse duration
        if 'Duration' in line:
            match = re.search(r'Duration\s+(.+)', line)
            if match:
                result['duration'] = match.group(1).strip()

        # Capture FAIL blocks
        if line.strip().startswith('FAIL') or '× ' in line:
            in_failure = True
            current_failure = [line]
        elif in_failure:
            if line.strip() == '' and len(current_failure) > 3:
                result['failures'].append('\n'.join(current_failure[:20]))
                in_failure = False
                current_failure = []
            elif '✓' in line or line.strip().startswith('Test Files'):
                if current_failure:
                    result['failures'].append('\n'.join(current_failure[:20]))
                in_failure = False
                current_failure = []
            else:
                current_failure.append(line)

        # TypeScript errors
        if 'error TS' in line:
            result['errors'].append(line.strip())

    # Determine status if not already set
    if result['status'] == 'UNKNOWN':
        result['status'] = 'FAILED' if result['failed'] > 0 else 'PASSED'

    return result

def format_output(result: dict, format_type: str) -> str:
    """Format the parsed results for display."""
    output = []

    # Header - use ASCII-safe characters for Windows compatibility
    status_emoji = 'PASS' if result['status'] == 'PASSED' else 'FAIL'
    output.append(f"\n{'='*60}")
    output.append(f"TEST RESULTS: {status_emoji} {result['status']}")
    output.append(f"{'='*60}")

    # Statistics
    output.append(f"\nStatistics:")
    if 'suites' in result and result['suites'] > 0:
        output.append(f"  Test Suites: {result['suites']}")
    output.append(f"  Tests:   {result['tests']}")
    output.append(f"  Passed:  {result['passed']}")
    output.append(f"  Failed:  {result['failed']}")
    if result['skipped'] > 0:
        output.append(f"  Skipped: {result['skipped']}")
    if result.get('duration'):
        output.append(f"  Duration: {result['duration']}")

    # Errors (compilation/type errors)
    if result['errors']:
        output.append(f"\n{'='*60}")
        output.append(f"ERRORS ({len(result['errors'])} total):")
        output.append(f"{'='*60}")
        for error in result['errors'][:10]:  # Limit to 10
            output.append(f"  {error}")
        if len(result['errors']) > 10:
            output.append(f"  ... and {len(result['errors']) - 10} more errors")

    # Failures
    if result['failures']:
        output.append(f"\n{'='*60}")
        output.append(f"FAILURES ({len(result['failures'])} total):")
        output.append(f"{'='*60}")
        for i, failure in enumerate(result['failures'][:5], 1):  # Limit to 5
            output.append(f"\n--- Failure {i} ---")
            output.append(failure)
        if len(result['failures']) > 5:
            output.append(f"\n... and {len(result['failures']) - 5} more failures")

    output.append(f"\n{'='*60}")

    return '\n'.join(output)

def main():
    parser = argparse.ArgumentParser(description='Parse test output and summarize')
    parser.add_argument('--gradle', action='store_true', help='Parse Gradle test output')
    parser.add_argument('--vitest', action='store_true', help='Parse Vitest test output')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('file', nargs='?', help='File to parse (default: stdin)')

    args = parser.parse_args()

    # Read input
    if args.file:
        with open(args.file, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    else:
        content = sys.stdin.read()

    # Auto-detect if not specified
    if not args.gradle and not args.vitest:
        if 'Vitest' in content or 'vite' in content.lower():
            args.vitest = True
        else:
            args.gradle = True

    # Parse
    if args.vitest:
        result = parse_vitest_output(content)
        format_type = 'vitest'
    else:
        result = parse_gradle_output(content)
        format_type = 'gradle'

    # Output
    if args.json:
        import json
        print(json.dumps(result, indent=2))
    else:
        print(format_output(result, format_type))

if __name__ == '__main__':
    main()
