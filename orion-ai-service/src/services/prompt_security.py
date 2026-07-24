"""
PromptSecurity 服务

检测 6 类 Prompt 安全威胁：
- command_injection: 代码注入 (```bash, $(...), `...`, eval())
- role_play_attack: 角色扮演攻击 ("you are now", "pretend you are", "act as")
- system_prompt_leak: 系统提示词泄露 ("system prompt", "reveal your", "bypass")
- token_smuggling: Token 走私 (超长 prompt)
- code_injection: 代码注入
- instruction_override: 指令覆盖 ("ignore previous instructions", "disregard all prior")
"""

import logging
import re
from typing import List, Optional

from src.models.prompt_security_models import (
    PromptAnalysis,
    PromptSecurityConfig,
    PromptThreat,
    ThreatType,
)

logger = logging.getLogger(__name__)

# 默认拦截关键词
_DEFAULT_BLOCKLIST = [
    "ignore previous instructions",
    "disregard all prior",
    "you are now",
    "pretend you are",
    "system prompt",
    "your instructions",
    "reveal your",
    "bypass safety",
]

# 严重程度权重
_SEVERITY_WEIGHTS = {
    "low": 5,
    "medium": 15,
    "high": 30,
    "critical": 50,
}


class PromptSecurity:
    """Prompt 安全检测服务"""

    def __init__(self, config: Optional[PromptSecurityConfig] = None):
        self.config = config or PromptSecurityConfig()

    def analyze(self, prompt: str) -> PromptAnalysis:
        """
        分析 prompt 安全性

        Args:
            prompt: 待检测的 prompt 文本

        Returns:
            PromptAnalysis: 安全分析结果
        """
        threats: List[PromptThreat] = []

        # 1. 长度检查
        if len(prompt) > self.config.max_prompt_length:
            threats.append(PromptThreat(
                type=ThreatType.TOKEN_SMUGGLING,
                severity="medium",
                description=f"Prompt 超过最大长度 ({len(prompt)} > {self.config.max_prompt_length})",
                matched_pattern=f"length:{len(prompt)}",
            ))

        # 2. 指令覆盖攻击检测
        if self.config.enable_instruction_override_check:
            threats.extend(self._check_instruction_override(prompt))

        # 3. 角色扮演攻击检测
        if self.config.enable_role_play_check:
            threats.extend(self._check_role_play(prompt))

        # 4. 系统提示词泄露检测
        if self.config.enable_system_prompt_leak_check:
            threats.extend(self._check_system_prompt_leak(prompt))

        # 5. 命令注入检测
        threats.extend(self._check_command_injection(prompt))

        # 计算风险评分
        risk_score = self._calculate_risk_score(threats)
        is_safe = risk_score < 30

        return PromptAnalysis(
            is_safe=is_safe,
            threats=threats,
            risk_score=risk_score,
            sanitized_prompt=self.sanitize(prompt),
        )

    def _check_instruction_override(self, prompt: str) -> List[PromptThreat]:
        """检测指令覆盖攻击"""
        threats = []
        lower = prompt.lower()
        for pattern in self.config.custom_blocklist:
            if pattern.lower() in lower:
                threats.append(PromptThreat(
                    type=ThreatType.INSTRUCTION_OVERRIDE,
                    severity="high",
                    description="检测到指令覆盖尝试",
                    matched_pattern=pattern,
                ))
        return threats

    def _check_role_play(self, prompt: str) -> List[PromptThreat]:
        """检测角色扮演攻击"""
        threats = []
        patterns = [
            re.compile(r"you are now\s+\w+", re.IGNORECASE),
            re.compile(r"pretend\s+(you are|to be)", re.IGNORECASE),
            re.compile(r"act\s+as", re.IGNORECASE),
        ]
        for pattern in patterns:
            match = pattern.search(prompt)
            if match:
                threats.append(PromptThreat(
                    type=ThreatType.ROLE_PLAY_ATTACK,
                    severity="medium",
                    description="检测到角色扮演攻击",
                    matched_pattern=match.group(0),
                ))
        return threats

    def _check_system_prompt_leak(self, prompt: str) -> List[PromptThreat]:
        """检测系统提示词泄露尝试"""
        threats = []
        patterns = [
            re.compile(r"system\s+prompt", re.IGNORECASE),
            re.compile(r"your\s+instructions", re.IGNORECASE),
            re.compile(r"reveal\s+your", re.IGNORECASE),
            re.compile(r"bypass", re.IGNORECASE),
        ]
        for pattern in patterns:
            match = pattern.search(prompt)
            if match:
                threats.append(PromptThreat(
                    type=ThreatType.SYSTEM_PROMPT_LEAK,
                    severity="high",
                    description="检测到系统提示词泄露尝试",
                    matched_pattern=match.group(0),
                ))
        return threats

    def _check_command_injection(self, prompt: str) -> List[PromptThreat]:
        """检测命令注入"""
        threats = []
        patterns = [
            (re.compile(r"```(?:bash|sh|shell|cmd)", re.IGNORECASE), ThreatType.COMMAND_INJECTION),
            (re.compile(r"\$\("), ThreatType.COMMAND_INJECTION),
            (re.compile(r"`[^`]+`"), ThreatType.COMMAND_INJECTION),
            (re.compile(r"eval\("), ThreatType.CODE_INJECTION),
        ]
        for pattern, threat_type in patterns:
            match = pattern.search(prompt)
            if match:
                threats.append(PromptThreat(
                    type=threat_type,
                    severity="critical" if threat_type == ThreatType.COMMAND_INJECTION else "high",
                    description="检测到命令/代码注入",
                    matched_pattern=match.group(0),
                ))
        return threats

    def _calculate_risk_score(self, threats: List[PromptThreat]) -> int:
        """计算风险评分"""
        score = sum(_SEVERITY_WEIGHTS.get(t.severity, 0) for t in threats)
        return min(score, 100)

    def sanitize(self, prompt: str) -> str:
        """
        清洗 prompt（移除可疑模式）

        Args:
            prompt: 原始 prompt

        Returns:
            清洗后的 prompt
        """
        sanitized = prompt
        # 移除代码块
        sanitized = re.sub(
            r"```(?:bash|sh|shell|cmd)[\s\S]*?```",
            "[CODE_BLOCK_REMOVED]",
            sanitized,
        )
        return sanitized
