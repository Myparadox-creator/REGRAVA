"""
Quick demonstration runner for RepoSentinel.
Executes static analysis across all bundled demonstration scenarios and outputs results.
"""

import sys
from pathlib import Path

# Add backend to Python path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root / "backend"))

from app.cli import run_cli

if __name__ == "__main__":
    scenario = sys.argv[1] if len(sys.argv) > 1 else "breaking"
    print(f"\n>>> Running RepoSentinel Demonstration Scenario: {scenario.upper()} <<<\n")
    sys.exit(run_cli(["analyze", "--demo", scenario, "--format", "terminal"]))
