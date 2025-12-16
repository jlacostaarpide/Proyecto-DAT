#!/usr/bin/env bash
# Wrapper to run the Python simulator with sensible defaults.
# Usage: ./simulate_bus.sh [interval_seconds]

INTERVAL=${1:-5}
PYTHON=${PYTHON:-python}
# Resolve script directory even if called from another cwd
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_PATH="$PROJECT_DIR/app/data/sample_data.json"

"$PYTHON" "$SCRIPT_DIR/simulate_bus.py" --output "$OUTPUT_PATH" --interval "$INTERVAL"
