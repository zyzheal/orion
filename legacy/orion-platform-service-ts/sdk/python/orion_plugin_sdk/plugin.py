"""
Orion Plugin SDK for Python

用于开发 Custom Task 类型插件的 SDK
提供任务执行、日志输出、配置读取等基础能力
"""

import json
import sys
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    CANCELLED = "CANCELLED"


@dataclass
class ConfigField:
    """配置字段定义"""
    type: str  # string/number/boolean/array/object
    description: str
    required: bool = False
    default: Any = None
    enum: Optional[List[str]] = None


@dataclass
class PluginMetadata:
    """插件元数据"""
    name: str
    version: str
    description: str
    author: str
    tags: List[str]
    config_schema: Dict[str, ConfigField] = field(default_factory=dict)


@dataclass
class Workspace:
    """工作区"""
    root_path: str
    files: Dict[str, str] = field(default_factory=dict)


@dataclass
class TaskContext:
    """任务执行上下文"""
    task_id: str
    pipeline_run_id: str
    stage_id: str
    config: Dict[str, str]
    workspace: Workspace
    env: Dict[str, str] = field(default_factory=dict)


@dataclass
class TaskResult:
    """任务执行结果"""
    task_id: str
    status: TaskStatus
    exit_code: int
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    duration_ms: int = 0
    outputs: Optional[Dict[str, str]] = None
    error_message: Optional[str] = None


class TaskPlugin(ABC):
    """
    Task Plugin 基类

    所有 Custom Task 插件都应继承此类
    """

    def __init__(self):
        self._context: Optional[TaskContext] = None
        self._start_time: Optional[float] = None
        self._logs: List[Dict[str, Any]] = []

    @abstractmethod
    def get_metadata(self) -> PluginMetadata:
        """获取插件元数据（子类必须实现）"""
        pass

    @abstractmethod
    async def execute(self, ctx: TaskContext) -> TaskResult:
        """执行任务（子类必须实现）"""
        pass

    def _init_context(self, ctx: TaskContext) -> None:
        """初始化任务上下文"""
        self._context = ctx
        self._start_time = time.time() * 1000  # 毫秒

    def _log(self, level: LogLevel, message: str) -> None:
        """输出日志"""
        timestamp = datetime.utcnow().isoformat()
        log_entry = {
            "timestamp": timestamp,
            "level": level.value,
            "message": message,
            "task_id": self._context.task_id if self._context else None,
        }

        # 输出到 stdout/stderr
        output = json.dumps(log_entry)
        if level == LogLevel.ERROR:
            print(output, file=sys.stderr)
        else:
            print(output)
        sys.stdout.flush()

        # 记录日志
        self._logs.append(log_entry)

    def debug(self, message: str) -> None:
        """输出 DEBUG 日志"""
        self._log(LogLevel.DEBUG, message)

    def info(self, message: str) -> None:
        """输出 INFO 日志"""
        self._log(LogLevel.INFO, message)

    def warn(self, message: str) -> None:
        """输出 WARN 日志"""
        self._log(LogLevel.WARN, message)

    def error(self, message: str) -> None:
        """输出 ERROR 日志"""
        self._log(LogLevel.ERROR, message)

    def get_config(self, key: str, default: Any = None) -> Any:
        """读取配置项"""
        if self._context is None:
            return default
        value = self._context.config.get(key)
        if value is None and default is not None:
            return default
        return value

    def get_env(self, key: str, default: str = "") -> str:
        """读取环境变量"""
        if self._context is None:
            return default
        return self._context.env.get(key, default)

    def get_workspace_root(self) -> str:
        """获取工作区根路径"""
        if self._context is None:
            return "/tmp/workspace"
        return self._context.workspace.root_path

    def read_workspace_file(self, relative_path: str) -> Optional[str]:
        """读取工作区文件"""
        if self._context is None:
            return None
        return self._context.workspace.files.get(relative_path)

    def create_success_result(self, outputs: Optional[Dict[str, str]] = None) -> TaskResult:
        """创建成功结果"""
        duration = int(time.time() * 1000 - self._start_time) if self._start_time else 0
        return TaskResult(
            task_id=self._context.task_id if self._context else "",
            status=TaskStatus.SUCCESS,
            exit_code=0,
            duration_ms=duration,
            outputs=outputs,
        )

    def create_failed_result(self, error_message: str) -> TaskResult:
        """创建失败结果"""
        duration = int(time.time() * 1000 - self._start_time) if self._start_time else 0
        return TaskResult(
            task_id=self._context.task_id if self._context else "",
            status=TaskStatus.FAILED,
            exit_code=1,
            error_message=error_message,
            duration_ms=duration,
        )


def register_plugin(plugin: TaskPlugin) -> None:
    """注册插件"""
    metadata = plugin.get_metadata()
    print(f"Registering plugin: {metadata['name']} v{metadata['version']}")


# 便捷导入
__all__ = [
    "TaskPlugin",
    "PluginMetadata",
    "TaskContext",
    "TaskResult",
    "TaskStatus",
    "LogLevel",
    "Workspace",
    "ConfigField",
    "register_plugin",
]
