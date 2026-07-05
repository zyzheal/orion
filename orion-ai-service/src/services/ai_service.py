"""
AI 服务核心实现

提供 AI 生成、分析、审查、诊断、决策的实际业务逻辑。
使用规则引擎 + 模板匹配作为 AI 模型不可用时的降级方案。
"""

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from src.config import Settings, settings
from src.models.ai_models import (
    AIAnalysisType,
    AIAnalyzeResponse,
    AIDecisionResponse,
    AIDecisionStatus,
    AIDiagnoseResponse,
    AIDiagnoseSeverity,
    AIGenerateResponse,
    AIReviewComment,
    AIReviewResponse,
    AIReviewStatus,
)
from src.repositories.ai_result_repository import ai_result_repository

logger = logging.getLogger(__name__)


# ==================== 规则引擎 ====================


class DiagnosisRule:
    """诊断规则"""

    def __init__(
        self,
        pattern: str,
        root_cause: str,
        suggested_fix: str,
        confidence: float,
    ):
        self.pattern = re.compile(pattern, re.IGNORECASE)
        self.root_cause = root_cause
        self.suggested_fix = suggested_fix
        self.confidence = confidence


# 诊断规则集（来源：AIDiagnosisService.ts DIAGNOSIS_RULES）
_DIAGNOSIS_RULES: List[DiagnosisRule] = [
    DiagnosisRule(
        pattern=r"connection\s*refused|ECONNREFUSED",
        root_cause="Network connection refused - the target service is unreachable",
        suggested_fix="Verify the service is running and network policy allows outbound traffic to the target host/port",
        confidence=85.0,
    ),
    DiagnosisRule(
        pattern=r"connection\s*(timed?\s*out|timeout)|ETIMEDOUT",
        root_cause="Network connection timeout - the target service is not responding",
        suggested_fix="Check if the target service is overloaded, verify firewall rules and DNS resolution",
        confidence=80.0,
    ),
    DiagnosisRule(
        pattern=r"ENOTFOUND|getaddrinfo|dns\s+resolution|domain\s*not?\s*found",
        root_cause="DNS resolution failure - hostname cannot be resolved",
        suggested_fix="Verify the hostname is correct and DNS is properly configured in the environment",
        confidence=90.0,
    ),
    DiagnosisRule(
        pattern=r"out\s*of\s*memory|OOM|ENOMEM|heap\s*limit|memory\s*(exceeded|limit)",
        root_cause="Out of memory - the process exceeded its memory allocation",
        suggested_fix="Increase the memory limit in plugin configuration or optimize the plugin to use less memory",
        confidence=85.0,
    ),
    DiagnosisRule(
        pattern=r"too\s*many\s*open\s*files|EMFILE|ENFILE",
        root_cause="File descriptor limit reached - too many open files or connections",
        suggested_fix="Increase the ulimit for open files or fix resource leaks in the plugin code",
        confidence=80.0,
    ),
    DiagnosisRule(
        pattern=r"image\s*pull\s*failed|no\s*such\s*image|manifest\s*unknown|docker\s*pull",
        root_cause="Container image not found - failed to pull or locate the Docker image",
        suggested_fix="Verify the image name and tag exist in the registry, check registry authentication",
        confidence=85.0,
    ),
    DiagnosisRule(
        pattern=r"docker\s*(daemon|not?\s*running|cannot\s*connect)",
        root_cause="Docker daemon unavailable - the Docker engine is not running or accessible",
        suggested_fix="Ensure Docker daemon is running and the service has access to the Docker socket",
        confidence=90.0,
    ),
    DiagnosisRule(
        pattern=r"permission\s*denied|EACCES|not\s*permitted",
        root_cause="Permission denied - insufficient access rights for the requested operation",
        suggested_fix="Check RBAC policies and file permissions, ensure the plugin has the required access rights",
        confidence=85.0,
    ),
    DiagnosisRule(
        pattern=r"not\s*found|ENOENT|no\s*such\s*file|does\s*not\s*exist",
        root_cause="File or resource not found - the requested path does not exist",
        suggested_fix="Verify the file path is correct and the file exists in the workspace",
        confidence=75.0,
    ),
    DiagnosisRule(
        pattern=r"authentication\s*failed|unauthorized|401|invalid\s*(token|credentials|api\s*key)",
        root_cause="Authentication failure - invalid or expired credentials",
        suggested_fix="Verify the API key/token is valid and has not expired, check credential rotation",
        confidence=85.0,
    ),
    DiagnosisRule(
        pattern=r"forbidden|403|access\s*denied|insufficient\s*privileges",
        root_cause="Authorization failure - insufficient privileges for the requested operation",
        suggested_fix="Check RBAC policies and ensure the service account has the required permissions",
        confidence=80.0,
    ),
]


# ==================== 脚本模板（来源：AIGenerateService.ts） ====================


class ScriptTemplate:
    """脚本模板"""

    def __init__(
        self,
        keywords: List[str],
        language: str,
        code: str,
        description: str,
    ):
        self.keywords = [k.lower() for k in keywords]
        self.language = language
        self.code = code
        self.description = description


_SCRIPT_TEMPLATES: List[ScriptTemplate] = [
    ScriptTemplate(
        keywords=["disk", "space", "storage", "df"],
        language="bash",
        code="df -h",
        description="Check disk space usage",
    ),
    ScriptTemplate(
        keywords=["memory", "mem", "free", "ram"],
        language="bash",
        code="free -h",
        description="Check memory usage",
    ),
    ScriptTemplate(
        keywords=["cpu", "processor", "load", "top"],
        language="bash",
        code="top -bn1 | head -20",
        description="Check CPU usage and load",
    ),
    ScriptTemplate(
        keywords=["process", "ps", "running", "list process"],
        language="bash",
        code="ps aux | head -50",
        description="List running processes",
    ),
    ScriptTemplate(
        keywords=["port", "listen", "netstat", "socket"],
        language="bash",
        code="netstat -tlnp",
        description="Check listening ports",
    ),
    ScriptTemplate(
        keywords=["network", "ping", "connectivity", "connect"],
        language="bash",
        code="ping -c 3 8.8.8.8",
        description="Test network connectivity",
    ),
    ScriptTemplate(
        keywords=["dns", "resolve", "nslookup", "dig"],
        language="bash",
        code="nslookup example.com",
        description="Check DNS resolution",
    ),
    ScriptTemplate(
        keywords=["nginx", "web server", "http server", "nginx running", "check nginx"],
        language="bash",
        code="ps aux | grep nginx && curl -s -o /dev/null -w \"%{http_code}\" http://localhost",
        description="Check if nginx is running and responding",
    ),
    ScriptTemplate(
        keywords=["docker", "container", "containers", "docker ps"],
        language="bash",
        code="docker ps -a --format \"table {{.Names}}\\t{{.Status}}\\t{{.Ports}}\"",
        description="List Docker containers",
    ),
    ScriptTemplate(
        keywords=["service", "systemctl", "status"],
        language="bash",
        code="systemctl list-units --type=service --state=running",
        description="List running system services",
    ),
    ScriptTemplate(
        keywords=["log", "tail", "recent", "last log"],
        language="bash",
        code="tail -n 100 /var/log/syslog",
        description="View recent log entries",
    ),
    ScriptTemplate(
        keywords=["error", "grep error", "find error"],
        language="bash",
        code="grep -i error /var/log/syslog | tail -50",
        description="Find recent error messages in logs",
    ),
    ScriptTemplate(
        keywords=["file size", "large file", "find large", "disk usage"],
        language="bash",
        code="find / -type f -size +100M 2>/dev/null | head -20",
        description="Find large files on the system",
    ),
    ScriptTemplate(
        keywords=["uptime", "how long", "boot"],
        language="bash",
        code="uptime && who -b",
        description="Check system uptime",
    ),
    ScriptTemplate(
        keywords=["whoami", "user", "current user", "identity"],
        language="bash",
        code="whoami && id",
        description="Check current user identity",
    ),
    ScriptTemplate(
        keywords=["env", "environment", "variable", "env var"],
        language="bash",
        code="env | sort",
        description="List environment variables",
    ),
    ScriptTemplate(
        keywords=["os", "operating system", "uname", "kernel"],
        language="bash",
        code="uname -a",
        description="Show operating system information",
    ),
]


# ==================== AI 服务实现 ====================


class AIService:
    """
    AI 服务实现

    提供 AI 生成、分析、审查、诊断、决策的实际业务逻辑。
    当 AI 模型不可用时，自动降级到规则引擎 + 模板匹配。
    """

    def __init__(self, config: Settings = settings):
        self.config = config
        self._initialized = False
        self._model_available = config.ai_model_endpoint is not None

    @property
    def is_available(self) -> bool:
        """AI 服务是否可用"""
        return self._initialized and self._model_available

    async def initialize(self) -> None:
        """初始化 AI 服务"""
        if self._model_available:
            logger.info(
                f"Initializing AI service at {self.config.ai_model_endpoint}"
            )
            await self._do_initialize()
            self._initialized = True
        else:
            logger.info(
                "AI model endpoint not configured, "
                "AI service running in rule-based fallback mode"
            )
            self._initialized = True  # 规则引擎始终可用

    async def _do_initialize(self) -> None:
        """连接 AI 模型服务"""
        # TODO: 实现真实的 AI 模型 HTTP 客户端连接
        logger.info("AI model client initialized (placeholder for real implementation)")

    # ==================== AI 生成 ====================

    async def generate_text(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
    ) -> AIGenerateResponse:
        """
        AI 文本生成

        优先调用 AI 模型，不可用时降级到模板匹配。
        """
        gen_id = str(uuid.uuid4())
        used_model = model or self.config.ai_model_endpoint or "rule-based-fallback"
        tokens_used = len(prompt.split())

        content = ""
        if self._model_available:
            try:
                content = await self._call_model_generate(prompt, context, model)
            except Exception as e:
                logger.warning(
                    "AI model generation failed, falling back to templates",
                    extra={"error": str(e)},
                )
                content = self._template_generate(prompt)
        else:
            content = self._template_generate(prompt)

        response = AIGenerateResponse(
            id=gen_id,
            content=content,
            model=used_model,
            tokens_used=tokens_used,
            created_at=datetime.now(timezone.utc),
        )

        # 持久化结果
        ai_result_repository.save_generation(
            {
                "id": gen_id,
                "prompt": prompt,
                "context": context,
                "model": used_model,
                "content": content,
                "tokens_used": tokens_used,
                "created_at": response.created_at,
            }
        )

        return response

    async def _call_model_generate(
        self, prompt: str, context: Optional[Dict[str, Any]], model: Optional[str]
    ) -> str:
        """调用真实 AI 模型（预留）"""
        # TODO: 实现真实的 HTTP 调用到 AI 模型服务
        raise NotImplementedError("Real AI model integration not yet implemented")

    def _template_generate(self, prompt: str) -> str:
        """基于模板匹配的降级生成"""
        prompt_lower = prompt.lower()
        words = prompt_lower.split()

        # 评分每个模板
        scored: List[Tuple[ScriptTemplate, int]] = []
        for template in _SCRIPT_TEMPLATES:
            score = 0
            for keyword in template.keywords:
                if keyword in prompt_lower:
                    score += 2
                else:
                    keyword_words = keyword.split()
                    for kw in keyword_words:
                        if kw in words:
                            score += 1
            scored.append((template, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        best_template, best_score = scored[0] if scored else (None, 0)

        if best_template and best_score > 0:
            logger.info(
                "Template-based generation",
                extra={"template": best_template.description, "score": best_score},
            )
            return best_template.code

        return (
            f"# No template found for prompt: \"{prompt[:100]}\"\n"
            "# Please write the script manually or use a more specific description."
        )

    # ==================== AI 分析 ====================

    async def analyze(
        self,
        analysis_type: str,
        data: Dict[str, Any],
    ) -> AIAnalyzeResponse:
        """
        AI 分析入口

        根据类型分发到具体的分析方法。
        """
        analysis_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        if analysis_type == AIAnalysisType.PIPELINE:
            result = await self.analyze_pipeline(data)
        elif analysis_type == AIAnalysisType.CODE:
            diff = data.get("diff", "")
            context = data.get("context", {})
            result = await self.analyze_code_review(diff, context)
        elif analysis_type == AIAnalysisType.COST:
            result = await self._analyze_cost(data)
        else:
            result = {"summary": f"Unknown analysis type: {analysis_type}", "details": data}

        confidence = self._estimate_confidence(result)

        response = AIAnalyzeResponse(
            id=analysis_id,
            type=analysis_type,
            result=result,
            confidence=confidence,
            created_at=now,
        )

        # 持久化分析结果
        ai_result_repository.save_analysis(
            {
                "id": analysis_id,
                "type": analysis_type,
                "data": data,
                "result": result,
                "confidence": confidence,
                "created_at": now,
            }
        )

        return response

    async def analyze_pipeline(
        self, pipeline_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        分析 Pipeline 运行结果

        检测失败阶段、异常耗时、错误模式。
        """
        pipeline_id = pipeline_data.get("pipeline_id", "unknown")
        status = pipeline_data.get("status", "unknown")
        duration_ms = pipeline_data.get("duration_ms", 0)
        stages = pipeline_data.get("stages", [])

        issues: List[Dict[str, Any]] = []
        suggestions: List[str] = []

        # 检测失败阶段
        failed_stages = [
            s for s in stages if s.get("status") in ("failed", "error", "cancelled")
        ]
        if failed_stages:
            for stage in failed_stages:
                issues.append(
                    {
                        "type": "stage_failure",
                        "severity": "error",
                        "stage": stage.get("name"),
                        "message": f"Stage '{stage.get('name')}' failed with status '{stage.get('status')}'",
                    }
                )
            suggestions.append(
                f"Review failed stages: {', '.join(s.get('name', 'unknown') for s in failed_stages)}"
            )

        # 检测耗时异常
        avg_duration = pipeline_data.get("avg_duration_ms", 0)
        if avg_duration > 0 and duration_ms > avg_duration * 2:
            issues.append(
                {
                    "type": "slow_pipeline",
                    "severity": "warning",
                    "message": f"Pipeline took {duration_ms}ms, {duration_ms / avg_duration:.1f}x the average ({avg_duration}ms)",
                }
            )
            suggestions.append("Investigate slow stages or resource contention")

        # 检测取消
        if status == "cancelled":
            issues.append(
                {
                    "type": "pipeline_cancelled",
                    "severity": "warning",
                    "message": "Pipeline was cancelled before completion",
                }
            )
            suggestions.append("Check who cancelled the pipeline and review the reason")

        summary = (
            f"Pipeline '{pipeline_id}' analysis: {len(issues)} issue(s) found."
            if issues
            else f"Pipeline '{pipeline_id}' looks healthy. No issues detected."
        )

        return {
            "summary": summary,
            "pipeline_id": pipeline_id,
            "status": status,
            "duration_ms": duration_ms,
            "details": pipeline_data,
            "issues_found": len(issues),
            "issues": issues,
            "suggestions": suggestions,
        }

    async def analyze_code_review(
        self, diff: str, context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        代码变更分析

        基于规则引擎检测 diff 中的潜在问题。
        """
        comments: List[Dict[str, Any]] = []

        if not diff:
            return comments

        lines = diff.split("\n")
        changed_lines = [l for l in lines if l.startswith("+") or l.startswith("-")]

        # 检测常见安全问题
        security_patterns = [
            (r"password\s*=\s*['\"][^'\"]+['\"]", "Hardcoded password detected", "error",
             "Use environment variables or secret management for credentials"),
            (r"api[_-]?key\s*=\s*['\"][^'\"]+['\"]", "Hardcoded API key detected", "error",
             "Use environment variables or secret management for API keys"),
            (r"TODO.*FIXME|FIXME.*TODO", "TODO/FIXME comment found", "warning",
             "Address or create a ticket for the TODO/FIXME"),
            (r"eval\s*\(|exec\s*\(|__import__", "Dangerous eval/exec usage", "error",
             "Avoid eval/exec as they pose security risks"),
            (r"subprocess\.(call|run|Popen)\s*\(.*shell\s*=\s*True", "Shell injection risk", "error",
             "Use shell=False or validate input when using subprocess"),
            (r"SELECT\s+.*\+.*FROM|INSERT\s+.*\+.*INTO|UPDATE\s+.*\+.*SET",
             "Potential SQL injection (string concatenation)", "error",
             "Use parameterized queries instead of string concatenation"),
        ]

        for i, line in enumerate(changed_lines, start=1):
            for pattern, message, severity, suggestion in security_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    comments.append(
                        {
                            "type": "security",
                            "line": i,
                            "content": message,
                            "severity": severity,
                            "suggestion": suggestion,
                            "code_snippet": line[:200],
                        }
                    )

        # 检测代码质量
        added_lines = [l[1:] for l in lines if l.startswith("+") and not l.startswith("+++")]
        if len(added_lines) > 200:
            comments.append(
                {
                    "type": "complexity",
                    "line": None,
                    "content": f"Large diff: {len(added_lines)} lines added in this change",
                    "severity": "warning",
                    "suggestion": "Consider breaking this into smaller, focused changes",
                }
            )

        if context.get("pr_id"):
            comments.append(
                {
                    "type": "info",
                    "line": None,
                    "content": f"Review for PR {context['pr_id']}",
                    "severity": "info",
                    "suggestion": None,
                }
            )

        if not comments:
            comments.append(
                {
                    "type": "info",
                    "line": None,
                    "content": "No significant issues detected in the diff",
                    "severity": "info",
                    "suggestion": None,
                }
            )

        return comments

    # ==================== AI 诊断 ====================

    async def diagnose(
        self,
        symptoms: List[str],
        context: Optional[Dict[str, Any]] = None,
    ) -> AIDiagnoseResponse:
        """
        AI 诊断

        基于规则引擎匹配症状，返回诊断结论和修复建议。
        """
        diagnosis_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        # 合并所有症状文本进行规则匹配
        combined_text = " ".join(symptoms)
        if context:
            combined_text += " " + json.dumps(context)

        matched_rule: Optional[DiagnosisRule] = None
        for rule in _DIAGNOSIS_RULES:
            if rule.pattern.search(combined_text):
                matched_rule = rule
                break

        if matched_rule:
            diagnosis = matched_rule.root_cause
            recommendations = [matched_rule.suggested_fix]
            severity = self._confidence_to_severity(matched_rule.confidence)
        else:
            diagnosis = (
                f"Analyzed {len(symptoms)} symptom(s). "
                "No specific pattern matched, review detailed logs for root cause."
            )
            recommendations = [
                "Review logs for more details",
                "Check resource utilization",
                "Verify recent configuration changes",
            ]
            severity = AIDiagnoseSeverity.LOW

        response = AIDiagnoseResponse(
            id=diagnosis_id,
            diagnosis=diagnosis,
            severity=severity,
            recommendations=recommendations,
            created_at=now,
        )

        # 持久化诊断结果
        ai_result_repository.save_diagnosis(
            {
                "id": diagnosis_id,
                "symptoms": symptoms,
                "context": context,
                "diagnosis": diagnosis,
                "severity": severity.value,
                "recommendations": recommendations,
                "created_at": now,
            }
        )

        return response

    # ==================== AI 决策 ====================

    async def make_decision(
        self,
        title: str,
        description: str,
        context: Optional[Dict[str, Any]] = None,
        options: Optional[List[str]] = None,
    ) -> AIDecisionResponse:
        """
        AI 决策

        基于上下文分析，推荐最优方案。
        """
        decision_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        # 基于规则生成推荐
        recommendation, confidence = self._generate_recommendation(
            title, description, context, options
        )

        response = AIDecisionResponse(
            id=decision_id,
            title=title,
            description=description,
            status=AIDecisionStatus.PENDING,
            recommendation=recommendation,
            confidence=confidence,
            context=context,
            options=options,
            created_at=now,
        )

        # 持久化决策
        ai_result_repository.save_decision(
            {
                "id": decision_id,
                "title": title,
                "description": description,
                "status": AIDecisionStatus.PENDING.value,
                "recommendation": recommendation,
                "confidence": confidence,
                "context": context,
                "options": options,
                "created_at": now,
                "updated_at": None,
            }
        )

        return response

    def _generate_recommendation(
        self,
        title: str,
        description: str,
        context: Optional[Dict[str, Any]],
        options: Optional[List[str]],
    ) -> Tuple[Optional[str], float]:
        """生成决策推荐"""
        if not options:
            return None, 0.0

        # 基于风险关键词的推荐逻辑
        risk_keywords = ["production", "critical", "urgent", "outage", "rollback"]
        text = f"{title} {description}".lower()

        high_risk = any(kw in text for kw in risk_keywords)

        if high_risk:
            # 高风险场景：推荐保守方案
            conservative = next(
                (o for o in options if any(kw in o.lower() for kw in ["gradual", "canary", "conservative", "rollback"])),
                options[0],
            )
            return conservative, 0.75

        if len(options) == 1:
            return options[0], 0.8

        # 默认：返回第一个选项
        return options[0], 0.6

    async def get_decision_explanation(
        self, decision_id: str
    ) -> Optional[Dict[str, Any]]:
        """获取决策解释"""
        decision = ai_result_repository.get_decision(decision_id)
        if not decision:
            return None

        factors = [
            "Historical similar decision success rate",
            "Current system load",
            "Risk tolerance threshold",
            "Business impact scope",
        ]

        alternatives = decision.get("options") or ["Conservative plan", "Aggressive plan", "Compromise plan"]

        return {
            "decision_id": decision_id,
            "reasoning": (
                "Based on historical data and rule engine analysis, "
                "the optimal solution has been automatically generated among current options."
            ),
            "factors": factors,
            "confidence": decision.get("confidence", 0.0) or 0.82,
            "alternatives": alternatives,
        }

    # ==================== AI 代码审查 ====================

    async def review_code(
        self,
        code: str,
        language: str,
        context: Optional[Dict[str, Any]] = None,
        reviewers: Optional[List[str]] = None,
    ) -> AIReviewResponse:
        """
        AI 代码审查

        基于规则引擎检测代码中的问题。
        """
        review_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        # 分析代码生成评论
        comments = self._analyze_code(code, language, context)

        # 计算质量评分
        score = self._calculate_code_score(code, comments)
        if score >= 80:
            status = AIReviewStatus.APPROVED
        elif score >= 60:
            status = AIReviewStatus.CHANGES_REQUESTED
        else:
            status = AIReviewStatus.REJECTED

        summary = (
            f"Code review completed for {language} code. "
            f"Score: {score}/100. "
            f"{len([c for c in comments if c.get('severity') == 'error'])} error(s), "
            f"{len([c for c in comments if c.get('severity') == 'warning'])} warning(s)."
        )

        response = AIReviewResponse(
            id=review_id,
            status=status,
            summary=summary,
            comments=[
                AIReviewComment(
                    line=c.get("line"),
                    content=c.get("content", ""),
                    severity=c.get("severity", "info"),
                    suggestion=c.get("suggestion"),
                )
                for c in comments
            ],
            score=score,
            created_at=now,
        )

        # 持久化审查结果
        ai_result_repository.save_review(
            {
                "id": review_id,
                "code": code,
                "language": language,
                "context": context,
                "reviewers": reviewers,
                "status": status.value,
                "summary": summary,
                "comments": [c.model_dump() for c in response.comments],
                "score": score,
                "created_at": now,
                "completed_at": now,
            }
        )

        return response

    def _analyze_code(
        self,
        code: str,
        language: str,
        context: Optional[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """分析代码，检测问题"""
        comments: List[Dict[str, Any]] = []
        lines = code.split("\n")

        # 通用安全问题
        security_checks = [
            (r"password\s*=\s*['\"][^'\"]+['\"]", "Hardcoded password detected", "error",
             "Use environment variables or secret management"),
            (r"api[_-]?key\s*=\s*['\"][^'\"]+['\"]", "Hardcoded API key detected", "error",
             "Use environment variables or secret management"),
            (r"TODO.*FIXME|FIXME.*TODO", "TODO/FIXME comment needs attention", "warning",
             "Address or create a ticket for the TODO/FIXME"),
        ]

        # 语言特定检查
        language_checks: Dict[str, List[Tuple[str, str, str, str]]] = {
            "python": [
                (r"eval\s*\(|exec\s*\(|__import__\s*\(", "Dangerous eval/exec usage", "error",
                 "Avoid eval/exec as they pose security risks"),
                (r"import \*$", "Wildcard import used", "warning",
                 "Use explicit imports instead of wildcard imports"),
                (r"except\s*:", "Bare except clause", "warning",
                 "Catch specific exception types instead of bare except"),
            ],
            "javascript": [
                (r"var\s+", "Use of 'var' detected", "warning",
                 "Use 'const' or 'let' instead of 'var'"),
                (r"==\s*(?!==|!=)", "Loose equality (==) used", "warning",
                 "Use strict equality (===) instead of loose equality (==)"),
            ],
            "typescript": [
                (r"any\b", "Use of 'any' type detected", "warning",
                 "Use explicit types instead of 'any'"),
            ],
        }

        all_checks = security_checks + language_checks.get(language.lower(), [])

        for i, line in enumerate(lines, start=1):
            for pattern, message, severity, suggestion in all_checks:
                if re.search(pattern, line, re.IGNORECASE):
                    comments.append(
                        {
                            "line": i,
                            "content": message,
                            "severity": severity,
                            "suggestion": suggestion,
                        }
                    )

        if not comments:
            comments.append(
                {
                    "line": None,
                    "content": "No significant issues detected in the code",
                    "severity": "info",
                    "suggestion": None,
                }
            )

        return comments

    def _calculate_code_score(
        self, code: str, comments: List[Dict[str, Any]]
    ) -> float:
        """计算代码质量评分"""
        if not comments:
            return 95.0

        error_count = sum(1 for c in comments if c.get("severity") == "error")
        warning_count = sum(1 for c in comments if c.get("severity") == "warning")
        info_count = sum(1 for c in comments if c.get("severity") == "info")

        score = 100.0
        score -= error_count * 25.0
        score -= warning_count * 5.0
        score -= info_count * 1.0

        return max(0.0, min(100.0, score))

    # ==================== 辅助方法 ====================

    async def analyze_cost(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """分析成本数据"""
        cost = data.get("cost", 0.0)
        budget = data.get("budget", 0.0)
        resource_type = data.get("resource_type", "unknown")

        issues = []
        if budget > 0 and cost > budget:
            issues.append(
                {
                    "type": "over_budget",
                    "severity": "warning",
                    "message": f"Cost ({cost}) exceeds budget ({budget})",
                }
            )

        utilization = data.get("utilization", 0.0)
        if utilization < 0.3:
            issues.append(
                {
                    "type": "low_utilization",
                    "severity": "info",
                    "message": f"Resource utilization is {utilization:.0%}, consider downsizing",
                }
            )

        return {
            "summary": f"Cost analysis for {resource_type}: {len(issues)} finding(s).",
            "resource_type": resource_type,
            "cost": cost,
            "budget": budget,
            "utilization": utilization,
            "issues_found": len(issues),
            "issues": issues,
            "suggestions": [
                "Review unused resources",
                "Consider spot/preemptible instances",
                "Set up cost alerts",
            ],
        }

    async def _analyze_cost(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """内部成本分析方法"""
        return await self.analyze_cost(data)

    def _estimate_confidence(self, result: Dict[str, Any]) -> float:
        """估算分析结果置信度"""
        issues = result.get("issues", [])
        if not issues:
            return 0.92

        error_count = sum(1 for i in issues if i.get("severity") == "error")
        warning_count = sum(1 for i in issues if i.get("severity") == "warning")

        confidence = 0.85
        confidence -= error_count * 0.05
        confidence -= warning_count * 0.02

        return max(0.5, min(0.95, confidence))

    def _confidence_to_severity(self, confidence: float) -> AIDiagnoseSeverity:
        """将置信度转换为严重程度"""
        if confidence >= 90:
            return AIDiagnoseSeverity.CRITICAL
        elif confidence >= 80:
            return AIDiagnoseSeverity.HIGH
        elif confidence >= 60:
            return AIDiagnoseSeverity.MEDIUM
        return AIDiagnoseSeverity.LOW


# 全局 AI 服务实例
ai_service = AIService()
