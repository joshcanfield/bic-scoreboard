#!/usr/bin/env bash
set -euo pipefail

# Run Gradle tests in WSL/Linux using the bundled JDK under tools/.
# - Puts tools JDK first on PATH
# - Unsets JAVA_HOME to avoid Gradle wrapper validation issues across mounts
# - Runs tests without the daemon for reproducibility

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
JDK_DIR="${ROOT_DIR}/tools/temurin-21/jdk-21.0.8+9"

if [[ ! -x "${JDK_DIR}/bin/java" ]]; then
  echo "Bundled JDK not found at: ${JDK_DIR}" >&2
  exit 1
fi

export PATH="${JDK_DIR}/bin:${PATH}"
unset JAVA_HOME || true

cd "${ROOT_DIR}"
echo "Using java: $(command -v java)" >&2
java -version >&2 || true

exec ./gradlew --no-daemon test "$@"

