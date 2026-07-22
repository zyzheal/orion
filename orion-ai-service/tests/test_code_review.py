"""
CodeReviewService 测试

覆盖 review_code, security analysis, style analysis 核心功能。
"""

from unittest.mock import MagicMock

import pytest

from src.models.review import ReviewFinding, ReviewResult, ReviewSeverity
from src.services.code_review import CodeReviewService


# ==================== Fixtures ====================


@pytest.fixture
def mock_gateway():
    gateway = MagicMock()
    gateway.execute = MagicMock()
    return gateway


@pytest.fixture
def mock_metric_collector():
    collector = MagicMock()
    collector.record_metric = MagicMock()
    return collector


@pytest.fixture
def code_review_service(mock_gateway, mock_metric_collector):
    return CodeReviewService(
        gateway=mock_gateway,
        metric_collector=mock_metric_collector,
    )


# ==================== review_code 测试 ====================


class TestReviewCode:
    """review_code 功能测试"""

    def test_review_clean_code(self, code_review_service):
        code = """
def hello(name: str) -> str:
    return f"Hello, {name}!"
"""
        result = code_review_service.review_code(code, "python")
        assert isinstance(result, ReviewResult)
        assert result.score >= 80

    def test_review_returns_findings(self, code_review_service):
        code = 'password = "hardcoded123"'
        result = code_review_service.review_code(code, "python")
        assert len(result.findings) > 0

    def test_review_summary_contains_language_and_score(self, code_review_service):
        code = "var x = 1;"
        result = code_review_service.review_code(code, "javascript")
        assert "javascript" in result.summary
        assert f"{result.score:.1f}" in result.summary

    def test_review_records_metric(self, code_review_service, mock_metric_collector):
        code = "x = 1"
        code_review_service.review_code(code, "python")
        mock_metric_collector.record_metric.assert_called_once()
        call_args = mock_metric_collector.record_metric.call_args
        assert call_args[0][0] == "ai.code_review.score"

    def test_review_no_metric_collector(self, mock_gateway):
        service = CodeReviewService(gateway=mock_gateway, metric_collector=None)
        result = service.review_code("x = 1", "python")
        assert isinstance(result, ReviewResult)

    def test_review_with_rules_parameter(self, code_review_service):
        # rules 参数当前版本未使用，但接口应接受
        code = 'api_key = "secret"'
        result = code_review_service.review_code(code, "python", rules=["security"])
        assert isinstance(result, ReviewResult)


# ==================== 安全分析测试 ====================


class TestSecurityAnalysis:
    """安全分析功能测试"""

    def test_detect_hardcoded_password(self, code_review_service):
        code = 'password = "admin123"'
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("password" in f.message.lower() for f in findings)

    def test_detect_hardcoded_api_key(self, code_review_service):
        code = 'api_key = "sk-1234567890abcdef"'
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("api key" in f.message.lower() for f in findings)

    def test_detect_eval_usage(self, code_review_service):
        code = "result = eval(user_input)"
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("eval" in f.message.lower() for f in findings)

    def test_detect_sql_injection(self, code_review_service):
        code = "query = 'SELECT * FROM users WHERE id = ' + user_id"
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("sql" in f.message.lower() for f in findings)

    def test_detect_subprocess_shell_true(self, code_review_service):
        code = "subprocess.run(cmd, shell=True)"
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("shell" in f.message.lower() for f in findings)

    def test_detect_unsafe_deserialization(self, code_review_service):
        code = "import pickle; data = pickle.loads(untrusted_data)"
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("deserialization" in f.message.lower() or "pickle" in f.message.lower() for f in findings)

    def test_detect_weak_crypto(self, code_review_service):
        code = "import hashlib; h = hashlib.md5(password.encode())"
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("weak" in f.message.lower() or "md5" in f.message.lower() for f in findings)

    def test_clean_python_code_no_security_issues(self, code_review_service):
        code = """
import os
import hashlib

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()
"""
        result = code_review_service.review_code(code, "python")
        critical_findings = [f for f in result.findings if f.severity == ReviewSeverity.CRITICAL]
        assert len(critical_findings) == 0

    # ==================== 语言特定安全规则 ====================

    def test_python_bare_except(self, code_review_service):
        code = "try:\n    pass\nexcept:\n    pass"
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("bare except" in f.message.lower() for f in findings)

    def test_python_debug_mode(self, code_review_service):
        code = "DEBUG = True"
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("debug" in f.message.lower() for f in findings)

    def test_javascript_use_of_var(self, code_review_service):
        code = "var x = 1;"
        result = code_review_service.review_code(code, "javascript")
        findings = result.findings
        assert any("var" in f.message.lower() for f in findings)

    def test_javascript_loose_equality(self, code_review_service):
        code = "if (a == b) {}"
        result = code_review_service.review_code(code, "javascript")
        findings = result.findings
        assert any("loose equality" in f.message.lower() for f in findings)

    def test_javascript_inner_html(self, code_review_service):
        code = 'element.innerHTML = userInput;'
        result = code_review_service.review_code(code, "javascript")
        findings = result.findings
        assert any("innerHTML" in f.message for f in findings)

    def test_typescript_use_of_any(self, code_review_service):
        code = "function process(data: any): void {}"
        result = code_review_service.review_code(code, "typescript")
        findings = result.findings
        assert any("any" in f.message.lower() for f in findings)

    def test_go_sql_concatenation(self, code_review_service):
        code = 'query := "SELECT * FROM users WHERE id = " + userID'
        result = code_review_service.review_code(code, "go")
        findings = result.findings
        assert any("sql" in f.message.lower() for f in findings)

    def test_java_system_exit(self, code_review_service):
        code = "System.exit(0);"
        result = code_review_service.review_code(code, "java")
        findings = result.findings
        assert any("System.exit" in f.message for f in findings)


# ==================== 代码风格分析测试 ====================


class TestStyleAnalysis:
    """代码风格分析功能测试"""

    def test_detect_trailing_whitespace(self, code_review_service):
        code = "x = 1   \n"  # 行尾有空格
        result = code_review_service.review_code(code, "python")
        findings = result.findings
        assert any("whitespace" in f.message.lower() for f in findings)

    def test_detect_console_log(self, code_review_service):
        code = "console.log('debug');"
        result = code_review_service.review_code(code, "javascript")
        findings = result.findings
        assert any("console.log" in f.message for f in findings)

    def test_detect_fmt_println(self, code_review_service):
        code = 'fmt.Println("debug")'
        result = code_review_service.review_code(code, "go")
        findings = result.findings
        assert any("fmt.Println" in f.message for f in findings)

    def test_detect_system_out_print(self, code_review_service):
        code = 'System.out.println("debug");'
        result = code_review_service.review_code(code, "java")
        findings = result.findings
        assert any("System.out" in f.message for f in findings)

    def test_clean_code_high_score(self, code_review_service):
        code = """
def calculate(x: int, y: int) -> int:
    return x + y
"""
        result = code_review_service.review_code(code, "python")
        assert result.score >= 80.0

    def test_code_with_many_issues_low_score(self, code_review_service):
        code = """
password = "admin"
api_key = "sk-123"
eval(input)
import pickle; pickle.loads(data)
var x = 1
"""
        result = code_review_service.review_code(code, "python")
        assert result.score < 50.0

    def test_findings_have_line_numbers(self, code_review_service):
        code = 'password = "secret"\napi_key = "key"'
        result = code_review_service.review_code(code, "python")
        for finding in result.findings:
            assert finding.line is not None
            assert finding.line >= 1

    def test_findings_have_suggestions(self, code_review_service):
        code = 'password = "secret"'
        result = code_review_service.review_code(code, "python")
        for finding in result.findings:
            assert finding.suggestion is not None
            assert len(finding.suggestion) > 0


# ==================== 评分计算测试 ====================


class TestScoreCalculation:
    """评分计算功能测试"""

    def test_score_no_findings(self, code_review_service):
        # 直接调用内部方法测试评分逻辑
        findings = []
        score = code_review_service._calculate_score(findings)
        assert score == 95.0

    def test_score_with_critical(self, code_review_service):
        findings = [
            ReviewFinding(
                rule_id="r1",
                severity=ReviewSeverity.CRITICAL,
                message="Critical issue",
            ),
        ]
        score = code_review_service._calculate_score(findings)
        assert score == 75.0  # 100 - 25

    def test_score_with_warnings(self, code_review_service):
        findings = [
            ReviewFinding(rule_id="r1", severity=ReviewSeverity.WARNING, message="Warn"),
            ReviewFinding(rule_id="r2", severity=ReviewSeverity.WARNING, message="Warn"),
        ]
        score = code_review_service._calculate_score(findings)
        assert score == 90.0  # 100 - 5 - 5

    def test_score_floor_at_zero(self, code_review_service):
        findings = [
            ReviewFinding(rule_id=f"r{i}", severity=ReviewSeverity.CRITICAL, message="C")
            for i in range(10)
        ]
        score = code_review_service._calculate_score(findings)
        assert score == 0.0
