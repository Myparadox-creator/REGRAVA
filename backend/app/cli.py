"""
Command-line interface for RepoSentinel.
Provides deterministic regression risk analysis for local Git repositories and CI workflows.
"""

import argparse
import sys
from pathlib import Path
from typing import Optional
from app.analyzer.git_reader import GitReaderError, InvalidRepositoryError, InvalidRevisionError
from app.analyzer.report_builder import ReportBuilder
from app.config import settings
from app.models.analysis import AnalysisResult
from app.models.finding import Severity
from app.services.analysis_service import SecurityError, analysis_service


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="reposentinel",
        description="RepoSentinel: Evidence-Based Regression Risk Analysis for Full-Stack Applications",
    )
    subparsers = parser.add_subparsers(dest="subcommand", help="Available subcommands")

    # 'analyze' subcommand
    analyze_parser = subparsers.add_parser("analyze", help="Analyze repository changes")
    analyze_parser.add_argument(
        "--repo",
        type=str,
        default=".",
        help="Path to the Git repository (default: current directory)",
    )
    analyze_parser.add_argument(
        "--base",
        type=str,
        default="main",
        help="Base Git reference/commit (default: 'main')",
    )
    analyze_parser.add_argument(
        "--head",
        type=str,
        default="HEAD",
        help="Head Git reference/commit (default: 'HEAD')",
    )
    analyze_parser.add_argument(
        "--format",
        choices=["terminal", "json", "markdown"],
        default="terminal",
        help="Output report format (default: 'terminal')",
    )
    analyze_parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="Path to save the generated report",
    )
    analyze_parser.add_argument(
        "--fail-on",
        choices=["high", "medium", "any", "none"],
        default="high",
        help="Exit with error code 1 if findings meet or exceed this severity (default: 'high')",
    )
    analyze_parser.add_argument(
        "--demo",
        choices=["baseline", "breaking", "fixed", "harmless"],
        default=None,
        help="Run against a bundled demonstration scenario",
    )

    return parser


def run_cli(args_list: Optional[list] = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    parser = build_parser()
    args = parser.parse_args(args_list)

    if not args.subcommand:
        parser.print_help()
        return 0

    if args.subcommand == "analyze":
        try:
            result: AnalysisResult

            if args.demo:
                # Built-in demo scenario execution
                scenario = args.demo
                demo_root = settings.EXAMPLES_DIR
                base_dir = demo_root / "base"

                if scenario == "baseline":
                    head_dir = demo_root / "base"
                    label = "Scenario A: Baseline"
                elif scenario == "breaking":
                    head_dir = demo_root / "breaking"
                    label = "Scenario B: Breaking Change"
                elif scenario == "fixed":
                    head_dir = demo_root / "fixed"
                    label = "Scenario C: Fixed Consumer"
                elif scenario == "harmless":
                    head_dir = demo_root / "harmless"
                    label = "Scenario D: Harmless Change"
                else:
                    head_dir = demo_root / "breaking"
                    label = "Scenario B: Breaking Change"

                result = analysis_service.analyze_directories(
                    base_dir=base_dir,
                    head_dir=head_dir,
                    target_name=label,
                    base_label="base",
                    head_label=scenario,
                )
            else:
                repo_path = Path(args.repo).resolve()
                if not repo_path.exists():
                    sys.stderr.write(f"Error: Repository path does not exist: {repo_path}\n")
                    return 2

                result = analysis_service.analyze_git_repository(
                    repo_path=repo_path,
                    base_ref=args.base,
                    head_ref=args.head,
                )

            # Format report
            if args.format == "json":
                output_str = ReportBuilder.to_json(result)
            elif args.format == "markdown":
                output_str = ReportBuilder.to_markdown(result)
            else:
                output_str = ReportBuilder.to_terminal(result)

            # Write or print
            if args.output:
                out_path = Path(args.output).resolve()
                out_path.parent.mkdir(parents=True, exist_ok=True)
                with open(out_path, "w", encoding="utf-8") as f:
                    f.write(output_str)
                print(f"Report saved to {out_path}")
            else:
                print(output_str)

            # Check CI failure threshold
            if args.fail_on != "none":
                if args.fail_on == "high" and result.metrics.high_severity_count > 0:
                    return 1
                elif args.fail_on == "medium" and (result.metrics.high_severity_count > 0 or result.metrics.medium_severity_count > 0):
                    return 1
                elif args.fail_on == "any" and result.metrics.total_findings > 0:
                    return 1

            return 0

        except (InvalidRepositoryError, InvalidRevisionError, GitReaderError) as e:
            sys.stderr.write(f"Git Analysis Error: {str(e)}\n")
            return 2
        except SecurityError as e:
            sys.stderr.write(f"Security Error: {str(e)}\n")
            return 2
        except Exception as e:
            sys.stderr.write(f"Unexpected Error during analysis: {str(e)}\n")
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(run_cli())
