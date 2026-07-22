"""
Circuit Breaker 服务

实现断路器模式，防止 LLM API 调用雪崩。
状态机: CLOSED -> OPEN -> HALF_OPEN -> CLOSED (或回到 OPEN)

对应微服务架构中的容错与弹性模式 (Phase 2.4)。
"""

import logging
import time
import threading
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(Enum):
    """断路器状态"""
    CLOSED = "closed"       # 正常状态，请求通过
    OPEN = "open"           # 熔断状态，请求快速失败
    HALF_OPEN = "half_open"  # 半开状态，允许有限请求探测


class CircuitBreakerError(Exception):
    """断路器触发的异常 - 请求被熔断"""
    pass


class CircuitBreaker:
    """
    断路器

    状态转换:
        CLOSED --(连续失败达到阈值)--> OPEN
        OPEN   --(超时恢复窗口)-----> HALF_OPEN
        HALF_OPEN --(探测成功)------> CLOSED
        HALF_OPEN --(探测失败)------> OPEN

    线程安全: 使用 threading.Lock 保护所有状态变更。
    """

    def __init__(
        self,
        name: str = "default",
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_requests: int = 3,
    ):
        """
        初始化断路器。

        Args:
            name: 断路器名称，用于日志区分
            failure_threshold: 连续失败次数阈值，达到后进入 OPEN 状态
            recovery_timeout: 从 OPEN 到 HALF_OPEN 的等待时间（秒）
            half_open_max_requests: HALF_OPEN 状态下允许的最大探测请求数
        """
        self._name = name
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._half_open_max_requests = half_open_max_requests

        # 状态
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[float] = None
        self._last_state_change_time: float = time.monotonic()
        self._half_open_requests = 0

        # 线程锁
        self._lock = threading.Lock()

        # 统计
        self._total_calls = 0
        self._total_successes = 0
        self._total_failures = 0
        self._total_rejected = 0
        self._total_timeouts = 0

    @property
    def name(self) -> str:
        return self._name

    @property
    def state(self) -> CircuitState:
        with self._lock:
            return self._state

    @property
    def failure_count(self) -> int:
        with self._lock:
            return self._failure_count

    @property
    def failure_threshold(self) -> int:
        return self._failure_threshold

    @failure_threshold.setter
    def failure_threshold(self, value: int) -> None:
        with self._lock:
            self._failure_threshold = value

    # ==================== Stats ====================

    @property
    def stats(self) -> dict:
        """获取断路器统计信息"""
        with self._lock:
            return {
                "name": self._name,
                "state": self._state.value,
                "failure_count": self._failure_count,
                "success_count": self._success_count,
                "failure_threshold": self._failure_threshold,
                "recovery_timeout": self._recovery_timeout,
                "half_open_max_requests": self._half_open_max_requests,
                "half_open_requests": self._half_open_requests,
                "total_calls": self._total_calls,
                "total_successes": self._total_successes,
                "total_failures": self._total_failures,
                "total_rejected": self._total_rejected,
                "total_timeouts": self._total_timeouts,
                "last_failure_time": self._last_failure_time,
                "last_state_change_time": self._last_state_change_time,
            }

    def is_available(self) -> bool:
        """
        检查断路器是否允许请求通过。

        线程安全。
        """
        with self._lock:
            return self._is_available_locked()

    def _is_available_locked(self) -> bool:
        """锁内检查 - 必须持有锁时调用"""
        if self._state == CircuitState.CLOSED:
            return True

        if self._state == CircuitState.OPEN:
            elapsed = time.monotonic() - self._last_state_change_time
            if elapsed >= self._recovery_timeout:
                # 自动切换到 HALF_OPEN
                self._transition_to(CircuitState.HALF_OPEN)
                logger.info(
                    "[CircuitBreaker:%s] OPEN -> HALF_OPEN after %.2fs recovery timeout",
                    self._name, elapsed,
                )
                self._half_open_requests = 0
                return True
            return False

        # HALF_OPEN: 只允许有限请求
        if self._half_open_requests < self._half_open_max_requests:
            return True
        return False

    def call(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """
        通过断路器执行函数调用。

        如果断路器处于 OPEN 状态且未超时恢复，则抛出 CircuitBreakerError。
        如果处于 HALF_OPEN 状态且达到最大探测请求数，也拒绝请求。

        Args:
            func: 要执行的函数
            *args: 函数的位置参数
            **kwargs: 函数的关键字参数

        Returns:
            函数的返回值

        Raises:
            CircuitBreakerError: 请求被熔断
            Exception: 原始函数抛出的异常
        """
        with self._lock:
            self._total_calls += 1
            if not self._is_available_locked():
                self._total_rejected += 1
                raise CircuitBreakerError(
                    f"[CircuitBreaker:{self._name}] Request rejected - circuit is {self._state.value}"
                )
            if self._state == CircuitState.HALF_OPEN:
                self._half_open_requests += 1

        try:
            result = func(*args, **kwargs)
            self.record_success()
            return result
        except Exception as e:
            self.record_failure()
            raise

    def record_success(self) -> None:
        """记录成功调用"""
        with self._lock:
            self._total_successes += 1
            self._success_count += 1

            if self._state == CircuitState.HALF_OPEN:
                # 探测成功，关闭断路器
                self._transition_to(CircuitState.CLOSED)
                self._failure_count = 0
                self._success_count = 0
                self._half_open_requests = 0
                logger.info(
                    "[CircuitBreaker:%s] HALF_OPEN -> CLOSED (probe succeeded)",
                    self._name,
                )
            elif self._state == CircuitState.CLOSED:
                # 成功时重置失败计数（滑动窗口语义）
                self._failure_count = max(0, self._failure_count - 1) if self._failure_count > 0 else 0

    def record_failure(self) -> None:
        """记录失败调用"""
        with self._lock:
            self._total_failures += 1
            self._failure_count += 1
            self._last_failure_time = time.monotonic()

            if self._state == CircuitState.HALF_OPEN:
                # 探测失败，回到 OPEN
                self._transition_to(CircuitState.OPEN)
                logger.warning(
                    "[CircuitBreaker:%s] HALF_OPEN -> OPEN (probe failed, failure_count=%d)",
                    self._name, self._failure_count,
                )
            elif self._state == CircuitState.CLOSED and self._failure_count >= self._failure_threshold:
                # 达到阈值，熔断
                self._transition_to(CircuitState.OPEN)
                logger.warning(
                    "[CircuitBreaker:%s] CLOSED -> OPEN (failure_threshold=%d reached)",
                    self._name, self._failure_threshold,
                )

    def record_timeout(self) -> None:
        """记录超时（作为失败的一种特殊类型）"""
        with self._lock:
            self._total_timeouts += 1
        self.record_failure()

    def reset(self) -> None:
        """重置断路器到初始状态"""
        with self._lock:
            self._transition_to(CircuitState.CLOSED)
            self._failure_count = 0
            self._success_count = 0
            self._half_open_requests = 0
            self._total_calls = 0
            self._total_successes = 0
            self._total_failures = 0
            self._total_rejected = 0
            self._total_timeouts = 0
            logger.info("[CircuitBreaker:%s] Reset to CLOSED", self._name)

    def force_open(self) -> None:
        """强制打开断路器（手动干预）"""
        with self._lock:
            self._transition_to(CircuitState.OPEN)
            logger.warning("[CircuitBreaker:%s] Force set to OPEN", self._name)

    def force_close(self) -> None:
        """强制关闭断路器（手动恢复）"""
        with self._lock:
            self._transition_to(CircuitState.CLOSED)
            self._failure_count = 0
            self._success_count = 0
            self._half_open_requests = 0
            logger.info("[CircuitBreaker:%s] Force set to CLOSED", self._name)

    def _transition_to(self, new_state: CircuitState) -> None:
        """执行状态转换（锁内调用）"""
        self._state = new_state
        self._last_state_change_time = time.monotonic()

    def __repr__(self) -> str:
        return (
            f"CircuitBreaker(name={self._name!r}, state={self._state.value}, "
            f"failures={self._failure_count}/{self._failure_threshold})"
        )


class CircuitBreakerRegistry:
    """
    断路器注册表

    管理多个断路器实例，按名称访问。
    线程安全。
    """

    def __init__(self):
        self._breakers: dict[str, CircuitBreaker] = {}
        self._lock = threading.Lock()

    def get_or_create(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_requests: int = 3,
    ) -> CircuitBreaker:
        """获取或创建断路器"""
        with self._lock:
            if name not in self._breakers:
                self._breakers[name] = CircuitBreaker(
                    name=name,
                    failure_threshold=failure_threshold,
                    recovery_timeout=recovery_timeout,
                    half_open_max_requests=half_open_max_requests,
                )
            return self._breakers[name]

    def get(self, name: str) -> Optional[CircuitBreaker]:
        """获取断路器实例"""
        with self._lock:
            return self._breakers.get(name)

    def remove(self, name: str) -> bool:
        """移除断路器实例"""
        with self._lock:
            if name in self._breakers:
                del self._breakers[name]
                return True
            return False

    def list_all(self) -> list[dict]:
        """列出所有断路器状态"""
        with self._lock:
            return [breaker.stats for breaker in self._breakers.values()]

    def reset_all(self) -> None:
        """重置所有断路器"""
        with self._lock:
            for breaker in self._breakers.values():
                breaker.reset()

    def __len__(self) -> int:
        with self._lock:
            return len(self._breakers)


# 全局单例
circuit_breaker_registry = CircuitBreakerRegistry()