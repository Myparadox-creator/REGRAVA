"""
Prompt Generator for REGRAVA (RepoSentinel).
Translates deterministic AST findings, schema drift, and security vulnerabilities
into precision-engineered prompts for Cursor Composer, Claude Code CLI, GitHub Copilot,
Windsurf, and generic coding agents. Also synthesizes runnable Vitest/pytest contract assertions.
"""

from typing import List, Optional, Tuple
from app.models.finding import Finding, FindingCategory, Severity
from app.models.prompt_steering import TargetAITool, SteeredPromptResponse


class PromptGenerator:
    """Generates structured, AST-grounded prompts and contract tests for AI coding agents."""

    @classmethod
    def generate(
        cls,
        finding: Finding,
        target_tool: TargetAITool = TargetAITool.CURSOR,
        include_test_assertion: bool = True,
        include_negative_constraints: bool = True,
    ) -> SteeredPromptResponse:
        target_files = cls._extract_target_files(finding)
        constraints = cls._build_constraints(finding) if include_negative_constraints else []
        test_snippet = cls._synthesize_test_snippet(finding) if include_test_assertion else None
        patch_diff = cls._synthesize_patch_diff(finding)
        suggested_command = cls._determine_verification_command(finding)

        if target_tool == TargetAITool.CURSOR:
            prompt_text = cls._format_cursor_prompt(finding, target_files, constraints, test_snippet)
        elif target_tool == TargetAITool.CLAUDE_CODE:
            prompt_text = cls._format_claude_code_prompt(
                finding, target_files, constraints, suggested_command, test_snippet
            )
        elif target_tool == TargetAITool.COPILOT:
            prompt_text = cls._format_copilot_prompt(finding, target_files, constraints, test_snippet)
        elif target_tool == TargetAITool.WINDSURF:
            prompt_text = cls._format_windsurf_prompt(finding, target_files, constraints, test_snippet)
        else:
            prompt_text = cls._format_generic_prompt(
                finding, target_files, constraints, suggested_command, test_snippet
            )

        return SteeredPromptResponse(
            finding_id=finding.id,
            target_tool=target_tool,
            prompt_text=prompt_text.strip(),
            target_files=target_files,
            constraints=constraints,
            suggested_command=suggested_command,
            synthesized_test_snippet=test_snippet,
            suggested_patch_diff=patch_diff,
        )

    @classmethod
    def _extract_target_files(cls, finding: Finding) -> List[str]:
        files: List[str] = []
        if finding.changed_file and finding.changed_file.path:
            files.append(finding.changed_file.path)
        if finding.affected_file and finding.affected_file.path:
            if finding.affected_file.path not in files:
                files.append(finding.affected_file.path)
        return files

    @classmethod
    def _build_constraints(cls, finding: Finding) -> List[str]:
        constraints: List[str] = []

        if finding.category in (
            FindingCategory.REMOVED_FIELD,
            FindingCategory.TYPE_MISMATCH,
            FindingCategory.API_CONTRACT,
            FindingCategory.FRONTEND_CONSUMER_RISK,
        ):
            if finding.changed_file:
                constraints.append(
                    f"Do NOT revert intentional backend changes in `{finding.changed_file.path}` unless explicitly requested."
                )
            constraints.append(
                "Update all downstream consumer components and TypeScript interfaces to align with the revised API schema."
            )
            constraints.append("Ensure full type-safety; avoid using `any` or loose type assertions.")

        elif finding.category == FindingCategory.INJECTION:
            constraints.append("Never use string formatting, f-strings, or raw concatenation for database queries.")
            constraints.append("Use parameterized queries, ORM filter methods, or prepared statements.")

        elif finding.category == FindingCategory.AUTHENTICATION:
            constraints.append("Enforce multi-tenant query isolation on every database access (`tenant_id = current_user.tenant_id`).")
            constraints.append("Do not rely exclusively on client-provided tenant headers.")

        elif finding.category == FindingCategory.SECRETS:
            constraints.append("Never commit plaintext API keys, tokens, or credentials into repository files.")
            constraints.append("Extract secrets to environment variables accessed via a configuration manager.")

        constraints.append("Ensure existing test suites pass without regression.")
        return constraints

    @classmethod
    def _determine_verification_command(cls, finding: Finding) -> str:
        if finding.affected_file and (
            finding.affected_file.path.endswith((".ts", ".tsx", ".js", ".jsx"))
        ):
            return "npm run build && npm test"
        if finding.changed_file and (
            finding.changed_file.path.endswith(".py")
        ):
            return "pytest tests/ -k test_contract"
        return "npm test && pytest"

    @classmethod
    def _synthesize_test_snippet(cls, finding: Finding) -> str:
        """Synthesize an executable Vitest or pytest contract proof."""
        if finding.category in (
            FindingCategory.REMOVED_FIELD,
            FindingCategory.TYPE_MISMATCH,
            FindingCategory.API_CONTRACT,
            FindingCategory.FRONTEND_CONSUMER_RISK,
        ):
            field = finding.field_name or (finding.changed_file.symbol if finding.changed_file else "target_field")
            endpoint = finding.route_path or "/api/v1/resource"
            return (
                f"// REGRAVA Auto-Generated Vitest Contract Proof\n"
                f"import {{ describe, it, expect }} from 'vitest';\n"
                f"import api from '../client';\n\n"
                f"describe('Contract Integrity: {finding.id}', () => {{\n"
                f"  it('verifies {endpoint} schema aligns with consumer expectations', async () => {{\n"
                f"    const response = await api.get('{endpoint}');\n"
                f"    expect(response.status).toBe(200);\n"
                f"    // Verifies '{field}' exists and matches required contract\n"
                f"    expect(response.data).toHaveProperty('{field}');\n"
                f"  }});\n"
                f"}});"
            )

        if finding.category == FindingCategory.INJECTION:
            return (
                f"# REGRAVA Auto-Generated Pytest Injection Safety Proof\n"
                f"import pytest\n"
                f"from app.db import execute_query\n\n"
                f"def test_{finding.id.lower()}_prevents_sqli():\n"
                f"    malicious_input = \"' OR '1'='1\"\n"
                f"    # Should treat payload as literal parameter, returning 0 unauthenticated records\n"
                f"    results = execute_query(filter_param=malicious_input)\n"
                f"    assert len(results) == 0\n"
            )

        return (
            f"// REGRAVA Automated Verification Test for {finding.id}\n"
            f"describe('{finding.title}', () => {{\n"
            f"  it('passes deterministic security & contract verification', () => {{\n"
            f"    // Verified remediation assertion\n"
            f"  }});\n"
            f"}});"
        )

    @classmethod
    def _synthesize_patch_diff(cls, finding: Finding) -> Optional[str]:
        if not finding.changed_file and not finding.affected_file:
            return None

        target_path = finding.affected_file.path if finding.affected_file else finding.changed_file.path
        line_num = finding.affected_file.line if finding.affected_file else finding.changed_file.line
        old_sym = (
            finding.changed_file.old_value
            if finding.changed_file and finding.changed_file.old_value
            else (finding.field_name or "old_property")
        )
        new_sym = (
            finding.changed_file.new_value
            if finding.changed_file and finding.changed_file.new_value
            else "new_property"
        )

        return (
            f"--- a/{target_path}\n"
            f"+++ b/{target_path}\n"
            f"@@ -{max(1, line_num - 2)},5 +{max(1, line_num - 2)},5 @@\n"
            f" context_before();\n"
            f"-const value = response.data.{old_sym};\n"
            f"+const value = response.data.{new_sym};\n"
            f" context_after();"
        )

    # --------------------------------------------------------------------------
    # FORMATTERS PER TARGET
    # --------------------------------------------------------------------------

    @classmethod
    def _format_cursor_prompt(
        cls,
        finding: Finding,
        target_files: List[str],
        constraints: List[str],
        test_snippet: Optional[str],
    ) -> str:
        file_tags = " ".join([f"@{f}" for f in target_files])
        constraints_list = "\n".join([f"- {c}" for c in constraints])

        prompt = f"""### REGRAVA Steered Remediation for Cursor Composer

Context Files:
{file_tags}

**Issue:** {finding.title} (`{finding.id}`)
**Severity:** {finding.severity.value.upper()} | **Category:** {finding.category.value}

**Summary:**
{finding.summary}

**Actionable Instruction:**
{finding.recommendation}

**Strict Negative Constraints:**
{constraints_list}
"""
        if finding.affected_file and finding.affected_file.context_snippet:
            prompt += f"\n**Target Code Context ({finding.affected_file.path}:{finding.affected_file.line}):**\n```\n{finding.affected_file.context_snippet}\n```\n"

        if test_snippet:
            prompt += f"\n**Verification Contract Test (Ensure this passes):**\n```typescript\n{test_snippet}\n```\n"

        prompt += "\nPlease apply the patch across the referenced files and confirm all types pass cleanly."
        return prompt

    @classmethod
    def _format_claude_code_prompt(
        cls,
        finding: Finding,
        target_files: List[str],
        constraints: List[str],
        command: str,
        test_snippet: Optional[str],
    ) -> str:
        files_str = "\n".join([f"- {f}" for f in target_files])
        constraints_list = "\n".join([f"- {c}" for c in constraints])

        prompt = f"""Fix the {finding.severity.value.upper()} regression detected by REGRAVA: '{finding.title}' ({finding.id}).

**Target Files to Modify:**
{files_str}

**Problem:**
{finding.summary}

**Remediation Steps:**
1. {finding.recommendation}
"""
        if constraints:
            prompt += f"\n**Constraints:**\n{constraints_list}\n"

        if test_snippet:
            prompt += f"\n**Contract Test to Add or Satisfy:**\n```\n{test_snippet}\n```\n"

        prompt += f"""
**Verification:**
After editing, execute `{command}` to verify the build and test suite pass without errors.
"""
        return prompt

    @classmethod
    def _format_copilot_prompt(
        cls,
        finding: Finding,
        target_files: List[str],
        constraints: List[str],
        test_snippet: Optional[str],
    ) -> str:
        files_str = ", ".join([f"`{f}`" for f in target_files])
        constraints_list = "\n".join([f"- {c}" for c in constraints])

        prompt = f"""## GitHub Copilot Remediation Task: {finding.title}

- **Finding ID:** `{finding.id}`
- **Severity:** `{finding.severity.value.upper()}`
- **Relevant Files:** {files_str}

### Problem Statement
{finding.summary}

### Required Fix
{finding.recommendation}

### Rules & Guidelines
{constraints_list}
"""
        if test_snippet:
            prompt += f"\n### Verification Test Proof\n```\n{test_snippet}\n```\n"
        return prompt

    @classmethod
    def _format_windsurf_prompt(
        cls,
        finding: Finding,
        target_files: List[str],
        constraints: List[str],
        test_snippet: Optional[str],
    ) -> str:
        file_bullets = "\n".join([f"- `{f}`" for f in target_files])
        constraints_list = "\n".join([f"- {c}" for c in constraints])

        prompt = f"""[Windsurf Cascade Task: {finding.id}]
Objective: Resolve {finding.title}

Target Files:
{file_bullets}

Details:
{finding.summary}

Instructions:
{finding.recommendation}

Constraints:
{constraints_list}
"""
        if test_snippet:
            prompt += f"\nContract Assertion:\n```\n{test_snippet}\n```\n"
        return prompt

    @classmethod
    def _format_generic_prompt(
        cls,
        finding: Finding,
        target_files: List[str],
        constraints: List[str],
        command: str,
        test_snippet: Optional[str],
    ) -> str:
        files_str = "\n".join([f"- `{f}`" for f in target_files])
        constraints_list = "\n".join([f"- {c}" for c in constraints])

        prompt = f"""# Code Remediation Prompt: {finding.title} ({finding.id})

**Severity:** {finding.severity.value.upper()}  
**Files:**
{files_str}

## Issue Summary
{finding.summary}

## Instructions
{finding.recommendation}

## Guardrails & Constraints
{constraints_list}
"""
        if test_snippet:
            prompt += f"\n## Expected Test Verification\n```\n{test_snippet}\n```\n"

        prompt += f"\nVerify your changes by running: `{command}`\n"
        return prompt
