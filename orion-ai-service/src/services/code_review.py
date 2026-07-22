"""
Code Review 服务

提供基于规则引擎的 AI 代码审查能力，包括安全分析和代码风格检查。
对应 TS: src/services/code-review/CodeReviewService.ts
"""

import logging
import re
from typing import Any, Dict, List, Optional

from src.models.review import ReviewFinding, ReviewResult, ReviewSeverity
from src.models.ai_gateway_models import AIScenario, AIRequest, AIResponse
from src.services.ai_gateway import AIGateway

logger = logging.getLogger(__name__)


# ==================== 规则集 ====================


# 通用安全规则（不依赖 LLM，纯规则检测）
_SECURITY_RULES: List[tuple] = [
    (
        r"password\s*=\s*['\"][^'\"]+['\"]",
        "hardcoded_password",
        "Hardcoded password detected",
        "Use environment variables or Secret management service to store credentials",
    ),
    (
        r"api[_-]?key\s*=\s*['\"][^'\"]+['\"]",
        "hardcoded_api_key",
        "Hardcoded API Key detected",
        "Use environment variables or Secret management service to store API Key",
    ),
    (
        r"secret\s*=\s*['\"][^'\"]+['\"]",
        "hardcoded_secret",
        "Hardcoded Secret detected",
        "Use environment variables or Secret management service",
    ),
    (
        r"eval\s*\(|exec\s*\(|__import__\s*\(",
        "dangerous_eval_exec",
        "Dangerous eval/exec usage",
        "Avoid using eval/exec, they pose security risks",
    ),
    (
        r"subprocess\.(call|run|Popen)\s*\(.*shell\s*=\s*True",
        "shell_injection",
        "Shell injection risk",
        "Use shell=False or validate input when using subprocess",
    ),
    (
        r"SELECT\s+.*\+|INSERT\s+.*\+|UPDATE\s+.*\+",
        "sql_injection",
        "Potential SQL injection (string concatenation)",
        "Use parameterized queries instead of string concatenation",
    ),
    (
        r"pickle\.loads?\(|yaml\.load\s*\([^,)]*$|yaml\.unsafe_load",
        "unsafe_deserialization",
        "Unsafe deserialization",
        "Avoid pickle.loads on untrusted data, use yaml.load with Loader parameter",
    ),
    (
        r"md5\s*\(|sha1\s*\(",
        "weak_crypto",
        "Weak cryptography (MD5/SHA1)",
        "Use stronger algorithms like SHA-256 or bcrypt",
    ),
]

# 语言特定安全规则
_LANG_SECURITY_RULES: Dict[str, List[tuple]] = {
    "python": [
        (
            r"os\.system\s*\(|os\.popen\s*\(",
            "os_system_usage",
            "Use of os.system/os.popen",
            "Use subprocess module instead of os.system",
        ),
        (
            r"except\s*:",
            "bare_except",
            "Bare except clause",
            "Catch specific exception types instead of bare except",
        ),
        (
            r"DEBUG\s*=\s*True",
            "debug_mode_enabled",
            "Debug mode enabled",
            "Do not enable DEBUG mode in production",
        ),
    ],
    "javascript": [
        (
            r"var\s+",
            "use_of_var",
            "Use of 'var' to declare variables",
            "Use 'const' or 'let' instead of 'var'",
        ),
        (
            r"==\s*(?!==|!=)",
            "loose_equality",
            "Loose equality (==) used",
            "Use strict equality (===) instead of loose equality (==)",
        ),
        (
            r"innerHTML\s*=",
            "inner_html_assignment",
            "Direct innerHTML assignment",
            "Use textContent or framework DOM APIs to avoid XSS",
        ),
        (
            r"eval\s*\(",
            "js_eval_usage",
            "Use of eval()",
            "Avoid eval(), it poses security risks",
        ),
    ],
    "typescript": [
        (
            r"any\b",
            "use_of_any",
            "Use of 'any' type",
            "Use explicit types instead of 'any'",
        ),
    ],
    "go": [
        (
            r"(?:sql\.Query|query\s*:=).*\+",
            "sql_concatenation",
            "SQL query uses string concatenation",
            "Use parameterized queries",
        ),
        (
            r"fmt\.Sprintf\s*\(.*%s.*\)",
            "format_string_usage",
            "Use of fmt.Sprintf for string formatting",
            "Validate format string arguments to avoid injection",
        ),
    ],
    "java": [
        (
            r"System\.exit\s*\(",
            "system_exit",
            "Call to System.exit()",
            "Avoid calling System.exit() in web applications",
        ),
        (
            r"Class\.forName\s*\(",
            "class_for_name",
            "Use of Class.forName()",
            "Validate input source of Class.forName()",
        ),
    ],
}

# 代码风格规则
_STYLE_RULES: Dict[str, List[tuple]] = {
    "python": [
        (
            r"^[ \t]*[^#\n]*[ \t]+$",
            "trailing_whitespace",
            "Trailing whitespace detected",
            "Remove trailing whitespace",
        ),
        (
            r"[A-Z][a-z]+[A-Z]",
            "camel_case_violation",
            "CamelCase naming used (Python style should be snake_case)",
            "Use snake_case naming convention",
        ),
        (
            r"def\s+\w+\s*\([^)]*\)\s*->\s*:",
            "missing_space_before_colon",
            "Missing space after 'def'",
            "Use 'def func_name():' format",
        ),
    ],
    "javascript": [
        (
            r"console\.log\s*\(",
            "console_log_left",
            "Legacy console.log statement",
            "Remove or replace with structured logging",
        ),
        (
            r"===\s*null",
            "triple_equals_null",
            "Use of === null",
            "Use == null to match both null and undefined",
        ),
    ],
    "typescript": [
        (
            r"any\b",
            "use_of_any_ts",
            "Use of 'any' type in TypeScript",
            "Use explicit type definitions",
        ),
    ],
    "go": [
        (
            r"fmt\.Println\s*\(",
            "fmt_println_left",
            "Legacy fmt.Println statement",
            "Use structured logging",
        ),
    ],
    "java": [
        (
            r"System\.out\.print",
            "system_out_print",
            "Legacy System.out.print statement",
            "Use logging framework instead of System.out",
        ),
    ],
}


class CodeReviewService:
    """
    AI 代码审查服务

    提供基于规则引擎的代码审查，支持安全分析和代码风格检查。
    可通过 AIGateway 集成 LLM 增强分析。
    """

    def __init__(
        self,
        gateway: AIGateway,
        metric_collector: Optional[Any] = None,
    ):
        self._gateway = gateway
        self._metric_collector = metric_collector

    def review_code(
        self,
        code: str,
        language: str,
        rules: Optional[List[str]] = None,
    ) -> ReviewResult:
        """
        审查代码

        流程：安全分析 → 风格分析 → 评分
        """
        security_findings = self._analyze_security(code, language)
        style_findings = self._analyze_style(code, language)

        all_findings = security_findings + style_findings

        # 计算质量评分
        score = self._calculate_score(all_findings)

        # 生成摘要
        critical_count = sum(1 for f in all_findings if f.severity == ReviewSeverity.CRITICAL)
        warning_count = sum(1 for f in all_findings if f.severity == ReviewSeverity.WARNING)
        info_count = sum(1 for f in all_findings if f.severity == ReviewSeverity.INFO)

        summary = (
            f"Code review completed for {language} code. "
            f"Score: {score:.1f}/100. "
            f"{critical_count} critical, {warning_count} warning, {info_count} info."
        )

        if score >= 80:
            status_msg = "Looks good!"
        elif score >= 60:
            status_msg = "Some issues need attention."
        else:
            status_msg = "Significant issues found, review required."

        summary = f"{summary} {status_msg}"

        # 记录指标
        if self._metric_collector:
            try:
                self._metric_collector.record_metric(
                    "ai.code_review.score",
                    score,
                    {"language": language, "findings_count": str(len(all_findings))},
                )
            except Exception as e:
                logger.debug(f"[CodeReviewService] Failed to record metric: {e}")

        return ReviewResult(
            findings=all_findings,
            summary=summary,
            score=score,
        )

    def _analyze_security(self, code: str, language: str) -> List[ReviewFinding]:
        """安全分析（规则化，不依赖 LLM）"""
        findings: List[ReviewFinding] = []
        lines = code.split("\n")

        # 通用安全规则
        for line_idx, line in enumerate(lines, start=1):
            for pattern, rule_id, message, suggestion in _SECURITY_RULES:
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append(ReviewFinding(
                        rule_id=rule_id,
                        severity=ReviewSeverity.CRITICAL,
                        message=message,
                        line=line_idx,
                        suggestion=suggestion,
                    ))

        # 语言特定安全规则
        lang_rules = _LANG_SECURITY_RULES.get(language.lower(), [])
        for line_idx, line in enumerate(lines, start=1):
            for pattern, rule_id, message, suggestion in lang_rules:
                if re.search(pattern, line, re.IGNORECASE):
                    # 避免重复：如果通用规则已经匹配，不再添加
                    existing_rule_ids = {f.rule_id for f in findings}
                    if rule_id not in existing_rule_ids:
                        findings.append(ReviewFinding(
                            rule_id=rule_id,
                            severity=ReviewSeverity.CRITICAL,
                            message=message,
                            line=line_idx,
                            suggestion=suggestion,
                        ))

        return findings

    def _analyze_style(self, code: str, language: str) -> List[ReviewFinding]:
        """代码风格分析"""
        findings: List[ReviewFinding] = []
        lines = code.split("\n")

        style_rules = _STYLE_RULES.get(language.lower(), [])

        for line_idx, line in enumerate(lines, start=1):
            for pattern, rule_id, message, suggestion in style_rules:
                if re.search(pattern, line):
                    findings.append(ReviewFinding(
                        rule_id=rule_id,
                        severity=ReviewSeverity.WARNING,
                        message=message,
                        line=line_idx,
                        suggestion=suggestion,
                    ))

        return findings

    def _calculate_score(self, findings: List[ReviewFinding]) -> float:
        """计算代码质量评分"""
        if not findings:
            return 95.0

        score = 100.0
        for finding in findings:
            if finding.severity == ReviewSeverity.CRITICAL:
                score -= 25.0
            elif finding.severity == ReviewSeverity.WARNING:
                score -= 5.0
            elif finding.severity == ReviewSeverity.INFO:
                score -= 1.0

        return max(0.0, min(100.0, score))
