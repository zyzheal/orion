"""
PromptSecurity 数据模型
"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ThreatType(str, Enum):
    """Prompt 安全威胁类型"""
    COMMAND_INJECTION = "command_injection"
    ROLE_PLAY_ATTACK = "role_play_attack"
    SYSTEM_PROMPT_LEAK = "system_prompt_leak"
    TOKEN_SMUGGLING = "token_smuggling"
    CODE_INJECTION = "code_injection"
    INSTRUCTION_OVERRIDE = "instruction_override"


class PromptThreat(BaseModel):
    """检测到的威胁"""
    type: ThreatType
    severity: str = Field(..., description="low/medium/high/critical")
    description: str
    matched_pattern: str


class PromptAnalysis(BaseModel):
    """Prompt 安全分析结果"""
    is_safe: bool
    threats: List[PromptThreat] = Field(default_factory=list)
    risk_score: int = Field(..., ge=0, le=100, description="风险评分 0-100")
    sanitized_prompt: str


class PromptSecurityConfig(BaseModel):
    """Prompt 安全配置"""
    max_prompt_length: int = Field(default=10000, description="最大 prompt 长度")
    enable_command_injection_check: bool = Field(default=True)
    enable_role_play_check: bool = Field(default=True)
    enable_system_prompt_leak_check: bool = Field(default=True)
    enable_instruction_override_check: bool = Field(default=True)
    custom_blocklist: List[str] = Field(
        default_factory=lambda: [
            "ignore previous instructions",
            "disregard all prior",
            "you are now",
            "pretend you are",
            "system prompt",
            "your instructions",
            "reveal your",
            "bypass safety",
        ]
    )
