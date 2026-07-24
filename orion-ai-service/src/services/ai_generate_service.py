"""
AIGenerateService - AI 脚本生成服务

调用 AI 服务进行内容生成，不可用时降级到模板匹配。
"""

import logging
from typing import List, Optional

from src.models.ai_gateway_models import AIScenario
from src.services.prompt_security import PromptSecurity, PromptSecurityConfig

logger = logging.getLogger(__name__)


class GenerateRequest:
    """生成请求"""

    def __init__(
        self,
        prompt: str,
        language: str = "bash",
        level: Optional[str] = None,
    ):
        self.prompt = prompt
        self.language = language
        self.level = level


class GeneratedScript:
    """生成脚本结果"""

    def __init__(
        self,
        code: str,
        language: str,
        warnings: Optional[List[str]] = None,
        requires_approval: bool = False,
    ):
        self.code = code
        self.language = language
        self.warnings = warnings or []
        self.requires_approval = requires_approval

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "language": self.language,
            "warnings": self.warnings,
            "requires_approval": self.requires_approval,
        }


# 脚本模板库
_SCRIPT_TEMPLATES = [
    # 系统检查
    {
        "keywords": ["disk", "space", "storage", "df"],
        "language": "bash",
        "code": "df -h",
        "description": "Check disk space usage",
    },
    {
        "keywords": ["memory", "mem", "free", "ram"],
        "language": "bash",
        "code": "free -h",
        "description": "Check memory usage",
    },
    {
        "keywords": ["cpu", "processor", "load", "top"],
        "language": "bash",
        "code": "top -bn1 | head -20",
        "description": "Check CPU usage and load",
    },
    {
        "keywords": ["process", "ps", "running", "list process"],
        "language": "bash",
        "code": "ps aux | head -50",
        "description": "List running processes",
    },
    {
        "keywords": ["port", "listen", "netstat", "socket"],
        "language": "bash",
        "code": "netstat -tlnp",
        "description": "Check listening ports",
    },
    {
        "keywords": ["network", "ping", "connectivity", "connect"],
        "language": "bash",
        "code": "ping -c 3 8.8.8.8",
        "description": "Test network connectivity",
    },
    {
        "keywords": ["dns", "resolve", "nslookup", "dig"],
        "language": "bash",
        "code": "nslookup example.com",
        "description": "Check DNS resolution",
    },
    # 服务检查
    {
        "keywords": ["nginx", "web server", "http server", "nginx running", "check nginx"],
        "language": "bash",
        "code": "ps aux | grep nginx && curl -s -o /dev/null -w \"%{http_code}\" http://localhost",
        "description": "Check if nginx is running and responding",
    },
    {
        "keywords": ["docker", "container", "containers", "docker ps"],
        "language": "bash",
        "code": "docker ps -a --format \"table {{.Names}}\\t{{.Status}}\\t{{.Ports}}\"",
        "description": "List Docker containers",
    },
    {
        "keywords": ["service", "systemctl", "status"],
        "language": "bash",
        "code": "systemctl list-units --type=service --state=running",
        "description": "List running system services",
    },
    # 日志
    {
        "keywords": ["log", "tail", "recent", "last log"],
        "language": "bash",
        "code": "tail -n 100 /var/log/syslog",
        "description": "View recent log entries",
    },
    {
        "keywords": ["error", "grep error", "find error"],
        "language": "bash",
        "code": "grep -i error /var/log/syslog | tail -50",
        "description": "Find recent error messages in logs",
    },
    # 文件操作
    {
        "keywords": ["file size", "large file", "find large", "disk usage"],
        "language": "bash",
        "code": "find / -type f -size +100M 2>/dev/null | head -20",
        "description": "Find large files on the system",
    },
    {
        "keywords": ["uptime", "how long", "boot"],
        "language": "bash",
        "code": "uptime && who -b",
        "description": "Check system uptime",
    },
    {
        "keywords": ["whoami", "user", "current user", "identity"],
        "language": "bash",
        "code": "whoami && id",
        "description": "Check current user identity",
    },
    # 环境
    {
        "keywords": ["env", "environment", "variable", "env var"],
        "language": "bash",
        "code": "env | sort",
        "description": "List environment variables",
    },
    {
        "keywords": ["os", "operating system", "uname", "kernel"],
        "language": "bash",
        "code": "uname -a",
        "description": "Show operating system information",
    },
]


class AIGenerateService:
    """
    AI 脚本生成服务

    优先调用 AI 模型生成脚本，不可用时降级到模板匹配。
    集成 PromptSecurity 进行输入安全检查。
    """

    def __init__(
        self,
        ai_service_url: Optional[str] = None,
        timeout_ms: int = 30000,
        prompt_security_config: Optional[PromptSecurityConfig] = None,
    ):
        self.ai_service_url = ai_service_url or "http://localhost:8000"
        self.timeout_ms = timeout_ms
        self.prompt_security = PromptSecurity(prompt_security_config)

    async def generate_script(self, request: GenerateRequest) -> GeneratedScript:
        """
        生成脚本

        Args:
            request: 生成请求（prompt, language, level）

        Returns:
            GeneratedScript: 生成的脚本结果
        """
        logger.info(
            "Generating script",
            extra={"prompt": request.prompt[:100], "language": request.language},
        )

        # Prompt 安全检测
        security_analysis = self.prompt_security.analyze(request.prompt)
        if not security_analysis.is_safe:
            logger.warning(
                "Prompt security check failed",
                extra={"threats": [t.type.value for t in security_analysis.threats]},
            )
            return GeneratedScript(
                code="# Security alert: unsafe prompt detected",
                language=request.language,
                warnings=[f"Security: {t.description}" for t in security_analysis.threats],
                requires_approval=True,
            )

        # 使用清洗后的 prompt
        safe_prompt = security_analysis.sanitized_prompt

        # 尝试 AI 生成（预留接口）
        try:
            ai_result = await self._call_ai_generation(safe_prompt, request)
            if ai_result:
                return ai_result
        except Exception as e:
            logger.warning(
                "AI generation failed, falling back to templates",
                extra={"error": str(e)},
            )

        # 降级到模板匹配
        return self._generate_from_template(safe_prompt, request)

    async def _call_ai_generation(
        self, prompt: str, request: GenerateRequest
    ) -> Optional[GeneratedScript]:
        """
        调用 AI 服务生成（预留）

        TODO: 实现真实的 AI 模型 HTTP 调用
        """
        # 预留：调用 orion-ai-service /api/v1/ai/generate
        return None

    def _generate_from_template(
        self, prompt: str, request: GenerateRequest
    ) -> GeneratedScript:
        """
        基于模板匹配的降级生成
        """
        prompt_lower = prompt.lower()
        words = prompt_lower.split()

        # 评分每个模板
        scored = []
        for template in _SCRIPT_TEMPLATES:
            score = 0
            for keyword in template["keywords"]:
                if keyword in prompt_lower:
                    score += 2
                else:
                    keyword_words = keyword.lower().split()
                    for kw in keyword_words:
                        if kw in words:
                            score += 1
            scored.append((template, score))

        # 按分数排序
        scored.sort(key=lambda x: x[1], reverse=True)

        best_template, best_score = scored[0] if scored else (None, 0)

        if best_template and best_score > 0:
            logger.info(
                "Template-based generation",
                extra={
                    "template": best_template["description"],
                    "score": best_score,
                },
            )

            warnings = []
            if request.language and request.language != best_template["language"]:
                warnings.append(
                    f"模板生成 {best_template['language']} 代码，但请求的是 {request.language}"
                )

            return GeneratedScript(
                code=best_template["code"],
                language=best_template["language"],
                warnings=warnings,
                requires_approval=False,
            )

        # 无匹配模板
        return GeneratedScript(
            code=f"# No template found for prompt: \"{request.prompt[:100]}\"\n"
                 "# Please write the script manually or use a more specific description.",
            language=request.language or "bash",
            warnings=["No matching template found - generated placeholder script"],
            requires_approval=True,
        )
