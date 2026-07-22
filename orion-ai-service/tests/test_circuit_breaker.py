"""
Circuit Breaker 服务测试

验证断路器状态机、线程安全、统计信息。
"""

import time
import pytest
from threading import Thread, Barrier
from src.services.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerError,
    CircuitBreakerRegistry,
    CircuitState,
)


class TestCircuitBreaker:
    """CircuitBreaker 基础功能测试"""

    def test_initial_state(self):
        """初始状态应为 CLOSED"""
        cb = CircuitBreaker(name="test")
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0
        assert cb.is_available() is True

    def test_initial_stats(self):
        """初始统计信息应为零"""
        cb = CircuitBreaker(name="test")
        stats = cb.stats
        assert stats["state"] == "closed"
        assert stats["total_calls"] == 0
        assert stats["total_successes"] == 0
        assert stats["total_failures"] == 0
        assert stats["total_rejected"] == 0

    def test_successful_call(self):
        """成功调用应返回结果并记录成功"""
        cb = CircuitBreaker(name="test")

        result = cb.call(lambda x: x + 1, 41)

        assert result == 42
        assert cb.state == CircuitState.CLOSED
        assert cb.stats["total_successes"] == 1
        assert cb.stats["total_calls"] == 1

    def test_failure_opens_circuit(self):
        """连续失败达到阈值应切换到 OPEN"""
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=60)

        def failing_func():
            raise ValueError("test error")

        for _ in range(3):
            with pytest.raises(ValueError):
                cb.call(failing_func)

        assert cb.state == CircuitState.OPEN
        assert cb.failure_count == 3
        assert cb.is_available() is False

    def test_open_circuit_rejects_requests(self):
        """OPEN 状态的断路器应拒绝请求"""
        cb = CircuitBreaker(name="test", failure_threshold=2, recovery_timeout=60)

        def failing_func():
            raise ValueError("test error")

        # 触发熔断
        for _ in range(2):
            with pytest.raises(ValueError):
                cb.call(failing_func)

        assert cb.state == CircuitState.OPEN

        # 应拒绝请求
        with pytest.raises(CircuitBreakerError, match="rejected"):
            cb.call(lambda: "ok")

    def test_recovery_timeout_transitions_to_half_open(self):
        """超时后应自动切换到 HALF_OPEN"""
        cb = CircuitBreaker(name="test", failure_threshold=2, recovery_timeout=0.1)

        def failing_func():
            raise ValueError("test error")

        for _ in range(2):
            with pytest.raises(ValueError):
                cb.call(failing_func)

        assert cb.state == CircuitState.OPEN

        # 等待超时
        time.sleep(0.15)

        # 此时应允许请求（自动切换到 HALF_OPEN）
        assert cb.is_available() is True
        assert cb.state == CircuitState.HALF_OPEN

    def test_half_open_success_transitions_to_closed(self):
        """HALF_OPEN 下成功调用应切换到 CLOSED"""
        cb = CircuitBreaker(name="test", failure_threshold=2, recovery_timeout=0.1)

        def failing_func():
            raise ValueError("test error")

        for _ in range(2):
            with pytest.raises(ValueError):
                cb.call(failing_func)

        # 等待超时
        time.sleep(0.15)

        # HALF_OPEN 下成功调用
        result = cb.call(lambda: "recovered")
        assert result == "recovered"

        # 应回到 CLOSED
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0

    def test_half_open_failure_transitions_to_open(self):
        """HALF_OPEN 下失败调用应回到 OPEN"""
        cb = CircuitBreaker(name="test", failure_threshold=2, recovery_timeout=0.1)

        def failing_func():
            raise ValueError("test error")

        for _ in range(2):
            with pytest.raises(ValueError):
                cb.call(failing_func)

        # 等待超时
        time.sleep(0.15)

        # HALF_OPEN 下失败
        with pytest.raises(ValueError):
            cb.call(failing_func)

        # 应回到 OPEN
        assert cb.state == CircuitState.OPEN

    def test_half_open_max_requests(self):
        """HALF_OPEN 应限制并发探测请求数"""
        import threading
        import time

        cb = CircuitBreaker(
            name="test",
            failure_threshold=2,
            recovery_timeout=0.1,
            half_open_max_requests=2,
        )

        def failing_func():
            raise ValueError("test error")

        for _ in range(2):
            with pytest.raises(ValueError):
                cb.call(failing_func)

        # 等待超时进入 HALF_OPEN
        time.sleep(0.15)

        # 使用一个长时间运行的函数来模拟并发探测
        # 这样所有并发请求会同时进入 is_available() 检查
        _event = threading.Event()

        def slow_func():
            _event.wait(2.0)  # 阻塞直到被设置
            return "ok"

        # 并发启动 3 个请求，只有 2 个应通过（half_open_max_requests=2）
        results = []
        errors = []

        def worker():
            try:
                r = cb.call(slow_func)
                results.append(r)
            except CircuitBreakerError as e:
                errors.append(str(e))

        threads = [threading.Thread(target=worker) for _ in range(3)]
        for t in threads:
            t.start()

        # 稍微等待让所有线程进入 call()
        time.sleep(0.2)
        # 释放阻塞的函数
        _event.set()

        for t in threads:
            t.join(timeout=2.0)

        # 2 个请求应成功（通过探测），1 个被拒绝
        assert len(results) == 2, f"Expected 2 successes, got {len(results)}"
        assert len(errors) == 1, f"Expected 1 rejection, got {len(errors)}"
        assert "rejected" in errors[0]

    def test_reset(self):
        """reset 应恢复初始状态"""
        cb = CircuitBreaker(name="test", failure_threshold=2, recovery_timeout=60)

        for _ in range(2):
            with pytest.raises(ValueError):
                cb.call(lambda: (_ for _ in ()).throw(ValueError("err")))

        assert cb.state == CircuitState.OPEN

        cb.reset()
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0
        assert cb.stats["total_calls"] == 0

    def test_force_open(self):
        """force_open 应强制打开断路器"""
        cb = CircuitBreaker(name="test")
        assert cb.state == CircuitState.CLOSED

        cb.force_open()
        assert cb.state == CircuitState.OPEN
        assert cb.is_available() is False

    def test_force_close(self):
        """force_close 应强制关闭断路器"""
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=60)

        with pytest.raises(ValueError):
            cb.call(lambda: (_ for _ in ()).throw(ValueError("err")))

        assert cb.state == CircuitState.OPEN

        cb.force_close()
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0
        assert cb.is_available() is True

    def test_record_success_and_failure(self):
        """record_success/record_failure 应正确更新状态"""
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=60)

        cb.record_success()
        assert cb.state == CircuitState.CLOSED
        assert cb.stats["total_successes"] == 1

        cb.record_failure()
        cb.record_failure()
        assert cb.failure_count == 2
        assert cb.state == CircuitState.CLOSED

        cb.record_failure()
        assert cb.state == CircuitState.OPEN

    def test_record_timeout(self):
        """record_timeout 应作为失败处理"""
        cb = CircuitBreaker(name="test", failure_threshold=2, recovery_timeout=60)

        cb.record_timeout()
        assert cb.failure_count == 1
        assert cb.stats["total_timeouts"] == 1

        cb.record_timeout()
        assert cb.state == CircuitState.OPEN

    def test_success_resets_failure_count_in_closed(self):
        """CLOSED 状态下成功应递减失败计数"""
        cb = CircuitBreaker(name="test", failure_threshold=5, recovery_timeout=60)

        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.failure_count == 3

        cb.record_success()
        assert cb.failure_count == 2  # 递减

    def test_stats(self):
        """stats 属性应返回完整统计信息"""
        cb = CircuitBreaker(name="mytest", failure_threshold=10, recovery_timeout=5.0)

        cb.call(lambda: 42)
        cb.call(lambda: 43)

        stats = cb.stats
        assert stats["name"] == "mytest"
        assert stats["state"] == "closed"
        assert stats["failure_threshold"] == 10
        assert stats["recovery_timeout"] == 5.0
        assert stats["total_calls"] == 2
        assert stats["total_successes"] == 2

    def test_repr(self):
        """__repr__ 应包含关键信息"""
        cb = CircuitBreaker(name="test", failure_threshold=3)
        rep = repr(cb)
        assert "CircuitBreaker" in rep
        assert "test" in rep
        assert "closed" in rep


class TestCircuitBreakerThreadSafety:
    """CircuitBreaker 线程安全测试"""

    def test_concurrent_calls(self):
        """并发调用应保持线程安全"""
        cb = CircuitBreaker(name="concurrent", failure_threshold=5, recovery_timeout=0.1)
        n_threads = 10
        n_calls = 20
        barrier = Barrier(n_threads)

        def worker():
            barrier.wait()
            for _ in range(n_calls):
                try:
                    cb.call(lambda: 1)
                except CircuitBreakerError:
                    pass
                except ValueError:
                    pass

        threads = [Thread(target=worker) for _ in range(n_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # 总调用数应正确
        stats = cb.stats
        assert stats["total_calls"] == n_threads * n_calls

    def test_concurrent_state_transitions(self):
        """并发状态转换不应导致数据竞争"""
        cb = CircuitBreaker(name="race", failure_threshold=3, recovery_timeout=0.05)
        n_threads = 5
        barrier = Barrier(n_threads)

        def failing_worker():
            barrier.wait()
            for _ in range(10):
                try:
                    cb.call(lambda: (_ for _ in ()).throw(ValueError("err")))
                except (CircuitBreakerError, ValueError):
                    pass

        threads = [Thread(target=failing_worker) for _ in range(n_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # 最终状态应为 OPEN（很多失败）
        stats = cb.stats
        assert stats["total_failures"] > 0
        assert stats["total_rejected"] >= 0


class TestCircuitBreakerRegistry:
    """CircuitBreakerRegistry 测试"""

    def test_get_or_create(self):
        """get_or_create 应创建或返回已有实例"""
        registry = CircuitBreakerRegistry()

        cb1 = registry.get_or_create("svc1", failure_threshold=3)
        cb2 = registry.get_or_create("svc1", failure_threshold=5)  # 应返回已有实例

        assert cb1 is cb2  # 同一实例
        assert cb1.failure_threshold == 3  # 首次创建的值

    def test_get(self):
        """get 应返回已有实例或 None"""
        registry = CircuitBreakerRegistry()

        cb = registry.get_or_create("svc1")
        assert registry.get("svc1") is cb
        assert registry.get("nonexistent") is None

    def test_remove(self):
        """remove 应删除实例"""
        registry = CircuitBreakerRegistry()

        registry.get_or_create("svc1")
        assert registry.remove("svc1") is True
        assert registry.remove("svc1") is False

    def test_list_all(self):
        """list_all 应返回所有断路器状态"""
        registry = CircuitBreakerRegistry()

        registry.get_or_create("svc1")
        registry.get_or_create("svc2")

        all_stats = registry.list_all()
        assert len(all_stats) == 2
        names = {s["name"] for s in all_stats}
        assert names == {"svc1", "svc2"}

    def test_reset_all(self):
        """reset_all 应重置所有断路器"""
        registry = CircuitBreakerRegistry()

        cb1 = registry.get_or_create("svc1", failure_threshold=1)
        with pytest.raises(ValueError):
            cb1.call(lambda: (_ for _ in ()).throw(ValueError("err")))
        assert cb1.state == CircuitState.OPEN

        registry.reset_all()
        assert cb1.state == CircuitState.CLOSED

    def test_len(self):
        """__len__ 应返回注册表大小"""
        registry = CircuitBreakerRegistry()
        assert len(registry) == 0

        registry.get_or_create("svc1")
        assert len(registry) == 1

    def test_global_registry(self):
        """全局单例应可导入"""
        from src.services.circuit_breaker import circuit_breaker_registry
        assert isinstance(circuit_breaker_registry, CircuitBreakerRegistry)