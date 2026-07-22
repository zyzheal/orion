"""
Cost Optimizer 服务测试

验证成本跟踪、价格估算、统计查询、线程安全。
"""

import pytest
from src.services.cost_optimizer import CostOptimizer, CostRecord


class TestCostRecord:
    """CostRecord 基础功能测试"""

    def test_creation(self):
        """创建 CostRecord 应包含所有字段"""
        record = CostRecord(
            tenant_id="tenant1",
            provider="openai",
            model="gpt-4",
            prompt_tokens=100,
            completion_tokens=50,
            cost=0.006,
        )

        assert record.tenant_id == "tenant1"
        assert record.provider == "openai"
        assert record.model == "gpt-4"
        assert record.prompt_tokens == 100
        assert record.completion_tokens == 50
        assert record.total_tokens == 150
        assert record.cost == 0.006
        assert record.currency == "USD"
        assert record.id is not None

    def test_to_dict(self):
        """to_dict 应返回完整字典"""
        record = CostRecord(
            tenant_id="t1", provider="p1", model="m1",
            prompt_tokens=10, completion_tokens=5, cost=0.001,
        )
        d = record.to_dict()
        assert d["tenant_id"] == "t1"
        assert d["provider"] == "p1"
        assert d["model"] == "m1"
        assert d["total_tokens"] == 15
        assert d["cost"] == 0.001
        assert "timestamp" in d

    def test_repr(self):
        """__repr__ 应包含关键信息"""
        record = CostRecord(
            tenant_id="t1", provider="openai", model="gpt-4",
            prompt_tokens=100, completion_tokens=50, cost=0.006,
        )
        rep = repr(record)
        assert "openai" in rep
        assert "gpt-4" in rep
        assert "0.006" in rep


class TestCostOptimizer:
    """CostOptimizer 基础功能测试"""

    def test_initial_state(self):
        """初始状态应为空"""
        co = CostOptimizer()
        assert co.get_record_count() == 0
        assert co.get_total_cost() == 0.0
        assert co.get_total_tokens() == 0

    def test_track_cost(self):
        """track_cost 应记录成本"""
        co = CostOptimizer()
        record = co.track_cost(
            provider="openai",
            model="gpt-4",
            prompt_tokens=1000,
            completion_tokens=500,
            tenant_id="tenant1",
        )

        assert record.provider == "openai"
        assert record.model == "gpt-4"
        assert record.total_tokens == 1500
        assert record.cost > 0

        assert co.get_record_count() == 1
        assert co.get_total_tokens() == 1500

    def test_track_cost_with_explicit_cost(self):
        """指定 cost 时不应自动估算"""
        co = CostOptimizer()
        record = co.track_cost(
            provider="openai",
            model="gpt-4",
            prompt_tokens=1000,
            completion_tokens=500,
            cost=0.05,
            tenant_id="tenant1",
        )

        assert record.cost == 0.05

    def test_estimate_cost_openai_gpt4(self):
        """应正确估算 OpenAI GPT-4 成本"""
        co = CostOptimizer()
        record = co.track_cost(
            provider="openai",
            model="gpt-4",
            prompt_tokens=1000,  # $0.03 / 1K
            completion_tokens=1000,  # $0.06 / 1K
            tenant_id="t1",
        )

        # input: 1 * 0.03 = 0.03, output: 1 * 0.06 = 0.06
        assert record.cost == pytest.approx(0.09, rel=0.01)

    def test_estimate_cost_claude_opus(self):
        """应正确估算 Claude 3 Opus 成本"""
        co = CostOptimizer()
        record = co.track_cost(
            provider="anthropic",
            model="claude-3-opus",
            prompt_tokens=1000,  # $0.015 / 1K
            completion_tokens=1000,  # $0.075 / 1K
            tenant_id="t1",
        )

        # input: 1 * 0.015 = 0.015, output: 1 * 0.075 = 0.075
        assert record.cost == pytest.approx(0.09, rel=0.01)

    def test_estimate_cost_deepseek(self):
        """应正确估算 DeepSeek 成本"""
        co = CostOptimizer()
        record = co.track_cost(
            provider="deepseek",
            model="deepseek-chat",
            prompt_tokens=1000,  # $0.0005 / 1K
            completion_tokens=1000,  # $0.002 / 1K
            tenant_id="t1",
        )

        # input: 1 * 0.0005 = 0.0005, output: 1 * 0.002 = 0.002
        assert record.cost == pytest.approx(0.0025, rel=0.01)

    def test_estimate_cost_unknown_model(self):
        """未知模型应返回 0 成本"""
        co = CostOptimizer()
        record = co.track_cost(
            provider="unknown",
            model="unknown-model",
            prompt_tokens=1000,
            completion_tokens=1000,
            tenant_id="t1",
        )

        assert record.cost == 0.0

    def test_set_custom_price(self):
        """自定义价格应覆盖默认价格"""
        co = CostOptimizer()
        co.set_custom_price("openai", "gpt-4", input_price=0.05, output_price=0.10)

        record = co.track_cost(
            provider="openai",
            model="gpt-4",
            prompt_tokens=1000,
            completion_tokens=1000,
            tenant_id="t1",
        )

        # input: 1 * 0.05 = 0.05, output: 1 * 0.10 = 0.10
        assert record.cost == pytest.approx(0.15, rel=0.01)

    def test_get_price(self):
        """get_price 应返回正确价格"""
        co = CostOptimizer()

        price = co.get_price("openai", "gpt-4")
        assert price["input"] == 0.03
        assert price["output"] == 0.06

        # 自定义价格
        co.set_custom_price("openai", "gpt-4", 0.01, 0.02)
        price = co.get_price("openai", "gpt-4")
        assert price["input"] == 0.01
        assert price["output"] == 0.02

    def test_get_usage_stats(self):
        """get_usage_stats 应返回正确统计"""
        co = CostOptimizer()

        # 添加多条记录
        co.track_cost("openai", "gpt-4", 1000, 500, tenant_id="t1")
        co.track_cost("openai", "gpt-4", 500, 300, tenant_id="t1")
        co.track_cost("anthropic", "claude-3-opus", 800, 400, tenant_id="t2")

        # 全局统计
        global_stats = co.get_usage_stats()
        assert global_stats["total_calls"] == 3
        assert global_stats["total_tokens"] > 0
        assert global_stats["total_cost"] > 0
        assert "openai" in global_stats["provider_breakdown"]
        assert "anthropic" in global_stats["provider_breakdown"]

        # 按租户统计
        tenant_stats = co.get_usage_stats(tenant_id="t1")
        assert tenant_stats["total_calls"] == 2
        assert "openai" in tenant_stats["provider_breakdown"]
        assert "anthropic" not in tenant_stats["provider_breakdown"]

        # 空租户
        empty_stats = co.get_usage_stats(tenant_id="nonexistent")
        assert empty_stats["total_calls"] == 0

    def test_get_cost_by_provider(self):
        """get_cost_by_provider 应按 provider 汇总"""
        co = CostOptimizer()

        co.track_cost("openai", "gpt-4", 1000, 500, cost=0.05, tenant_id="t1")
        co.track_cost("openai", "gpt-3.5-turbo", 2000, 1000, cost=0.01, tenant_id="t1")
        co.track_cost("anthropic", "claude-3-opus", 500, 300, cost=0.03, tenant_id="t2")

        by_provider = co.get_cost_by_provider()
        assert by_provider["openai"] == pytest.approx(0.06, rel=0.01)
        assert by_provider["anthropic"] == pytest.approx(0.03, rel=0.01)

    def test_get_cost_by_model(self):
        """get_cost_by_model 应按 model 汇总"""
        co = CostOptimizer()

        co.track_cost("openai", "gpt-4", 1000, 500, cost=0.05, tenant_id="t1")
        co.track_cost("openai", "gpt-4", 500, 300, cost=0.03, tenant_id="t1")
        co.track_cost("anthropic", "claude-3-opus", 500, 300, cost=0.04, tenant_id="t2")

        by_model = co.get_cost_by_model()
        assert by_model["openai/gpt-4"] == pytest.approx(0.08, rel=0.01)
        assert by_model["anthropic/claude-3-opus"] == pytest.approx(0.04, rel=0.01)

    def test_get_recent_calls(self):
        """get_recent_calls 应返回最近的调用"""
        co = CostOptimizer()

        for i in range(5):
            co.track_cost("openai", "gpt-4", 100, 50, cost=0.01, tenant_id=f"t{i}")

        recent = co.get_recent_calls(limit=3)
        assert len(recent) == 3

        recent_by_tenant = co.get_recent_calls(limit=10, tenant_id="t0")
        assert len(recent_by_tenant) == 1

    def test_clear(self):
        """clear 应清空所有记录"""
        co = CostOptimizer()

        co.track_cost("openai", "gpt-4", 100, 50, cost=0.01, tenant_id="t1")
        assert co.get_record_count() == 1

        co.clear()
        assert co.get_record_count() == 0
        assert co.get_total_cost() == 0.0
        assert co.get_total_tokens() == 0

    def test_prune_older_than(self):
        """prune_older_than 应清理旧记录"""
        import time
        co = CostOptimizer()

        co.track_cost("openai", "gpt-4", 100, 50, cost=0.01, tenant_id="t1")
        assert co.get_record_count() == 1

        # 清理 0 天前的记录（应删除所有）
        pruned = co.prune_older_than(days=0)
        assert pruned == 1
        assert co.get_record_count() == 0

    def test_export_records(self):
        """export_records 应导出所有记录"""
        co = CostOptimizer()

        co.track_cost("openai", "gpt-4", 100, 50, cost=0.01, tenant_id="t1")
        co.track_cost("anthropic", "claude-3-opus", 200, 100, cost=0.02, tenant_id="t2")

        all_records = co.export_records()
        assert len(all_records) == 2

        tenant_records = co.export_records(tenant_id="t1")
        assert len(tenant_records) == 1
        assert tenant_records[0]["tenant_id"] == "t1"

    def test_repr(self):
        """__repr__ 应包含关键信息"""
        co = CostOptimizer()
        co.track_cost("openai", "gpt-4", 100, 50, cost=0.01, tenant_id="t1")
        rep = repr(co)
        assert "CostOptimizer" in rep
        assert "0.01" in rep or "0.010000" in rep


class TestCostOptimizerThreadSafety:
    """CostOptimizer 线程安全测试"""

    def test_concurrent_track_cost(self):
        """并发 track_cost 应保持线程安全"""
        from threading import Thread, Barrier

        co = CostOptimizer()
        n_threads = 10
        n_calls = 50
        barrier = Barrier(n_threads)

        def worker():
            barrier.wait()
            for i in range(n_calls):
                co.track_cost(
                    provider="openai",
                    model="gpt-4",
                    prompt_tokens=100,
                    completion_tokens=50,
                    cost=0.005,
                    tenant_id=f"t{i % 5}",
                )

        threads = [Thread(target=worker) for _ in range(n_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert co.get_record_count() == n_threads * n_calls
        assert co.get_total_cost() == pytest.approx(
            n_threads * n_calls * 0.005, rel=0.01
        )

    def test_concurrent_read_write(self):
        """并发读写应保持线程安全"""
        from threading import Thread, Barrier

        co = CostOptimizer()
        n_threads = 8
        n_ops = 20
        barrier = Barrier(n_threads)

        def writer():
            barrier.wait()
            for _ in range(n_ops):
                co.track_cost("openai", "gpt-4", 100, 50, cost=0.005, tenant_id="t1")

        def reader():
            barrier.wait()
            for _ in range(n_ops):
                co.get_usage_stats()
                co.get_cost_by_provider()
                co.get_total_cost()

        threads = []
        for _ in range(4):
            threads.append(Thread(target=writer))
            threads.append(Thread(target=reader))

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert co.get_record_count() == 4 * n_ops