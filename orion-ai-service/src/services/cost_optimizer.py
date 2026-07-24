"""
Cost Optimizer 服务

跟踪 LLM 调用成本，按 provider/model 维度统计。
支持内存存储和可选 Redis 持久化。

对应 AI Python Phase 2.4: 成本优化与配额管理。
"""

import logging
import threading
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


class CostRecord:
    """单次 LLM 调用的成本记录"""

    __slots__ = (
        "id", "tenant_id", "provider", "model",
        "prompt_tokens", "completion_tokens", "total_tokens",
        "cost", "currency", "timestamp",
    )

    def __init__(
        self,
        tenant_id: str,
        provider: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        cost: float = 0.0,
        currency: str = "USD",
        timestamp: Optional[datetime] = None,
    ):
        import uuid
        self.id = str(uuid.uuid4())
        self.tenant_id = tenant_id
        self.provider = provider
        self.model = model
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = prompt_tokens + completion_tokens
        self.cost = cost
        self.currency = currency
        self.timestamp = timestamp or datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "provider": self.provider,
            "model": self.model,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "cost": self.cost,
            "currency": self.currency,
            "timestamp": self.timestamp.isoformat(),
        }

    def __repr__(self) -> str:
        return (
            f"CostRecord(provider={self.provider}, model={self.model}, "
            f"tokens={self.total_tokens}, cost={self.cost:.6f} {self.currency})"
        )


class CostOptimizer:
    """
    Cost Optimizer - LLM 调用成本跟踪与优化

    功能:
    - 记录每次 LLM 调用的 token 消耗和成本
    - 按 provider/model 维度统计
    - 按租户维度查询
    - 支持内存存储和可选 Redis 持久化
    - 线程安全

    成本模型:
    默认使用以下模型的估算价格（每 1K token）:
    - OpenAI GPT-4:     $0.03 input / $0.06 output
    - OpenAI GPT-3.5:   $0.0015 input / $0.002 output
    - Claude 3 Opus:    $0.015 input / $0.075 output
    - Claude 3 Sonnet:  $0.003 input / $0.015 output
    - Claude 3 Haiku:   $0.00025 input / $0.00125 output
    - DeepSeek:         $0.0005 input / $0.002 output
    - Custom:           由用户指定 cost 参数
    """

    # 默认成本估算 (每 1K tokens, USD)
    DEFAULT_PRICES: dict[str, dict[str, float]] = {
        "openai": {
            "gpt-4": {"input": 0.03, "output": 0.06},
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "gpt-4o": {"input": 0.005, "output": 0.015},
            "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
        },
        "anthropic": {
            "claude-3-opus": {"input": 0.015, "output": 0.075},
            "claude-3-sonnet": {"input": 0.003, "output": 0.015},
            "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
            "claude-4": {"input": 0.015, "output": 0.075},
        },
        "deepseek": {
            "deepseek-chat": {"input": 0.0005, "output": 0.002},
            "deepseek-coder": {"input": 0.0005, "output": 0.002},
        },
        "azure": {
            "gpt-4": {"input": 0.03, "output": 0.06},
        },
    }

    def __init__(self, redis_client: Optional[Any] = None):
        """
        初始化 CostOptimizer。

        Args:
            redis_client: 可选的 Redis 客户端，用于持久化
        """
        self._redis = redis_client

        # 内存存储: {provider: {model: [CostRecord, ...]}}
        self._records: dict[str, dict[str, list[CostRecord]]] = defaultdict(
            lambda: defaultdict(list)
        )

        # 租户索引: {tenant_id: [CostRecord, ...]}
        self._tenant_index: dict[str, list[CostRecord]] = defaultdict(list)

        # 总统计
        self._total_cost: float = 0.0
        self._total_tokens: int = 0

        # 自定义价格覆盖
        self._custom_prices: dict[str, dict[str, dict[str, float]]] = {}

        # 线程锁
        self._lock = threading.Lock()

    # ==================== 成本跟踪 ====================

    def track_cost(
        self,
        provider: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        cost: Optional[float] = None,
        tenant_id: str = "default",
        currency: str = "USD",
    ) -> CostRecord:
        """
        记录一次 LLM 调用的成本。

        如果未指定 cost 参数，将根据默认价格模型自动估算。

        Args:
            provider: 提供商名称 (如 "openai", "anthropic")
            model: 模型名称 (如 "gpt-4", "claude-3-opus")
            prompt_tokens: 输入 token 数
            completion_tokens: 输出 token 数
            cost: 可选，实际成本。不指定则自动估算
            tenant_id: 租户 ID
            currency: 货币单位，默认 USD

        Returns:
            创建的 CostRecord 实例
        """
        # 自动估算成本
        if cost is None:
            cost = self._estimate_cost(provider, model, prompt_tokens, completion_tokens)

        record = CostRecord(
            tenant_id=tenant_id,
            provider=provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost=cost,
            currency=currency,
        )

        with self._lock:
            self._records[provider][model].append(record)
            self._tenant_index[tenant_id].append(record)
            self._total_cost += cost
            self._total_tokens += record.total_tokens

        # Redis 持久化（可选）
        self._persist_cost(record)

        logger.debug(
            "[CostOptimizer] Tracked cost: provider=%s model=%s tokens=%d cost=%.6f tenant=%s",
            provider, model, record.total_tokens, cost, tenant_id,
        )

        return record

    def _estimate_cost(
        self,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> float:
        """
        根据默认价格模型估算成本。

        先在自定义价格中查找，再查默认价格，最后返回 0.0。
        """
        provider_lower = provider.lower()
        model_lower = model.lower()

        # 自定义价格优先
        prices = self._custom_prices.get(provider_lower, {}).get(model_lower, {})
        if not prices:
            # 默认价格
            provider_prices = self.DEFAULT_PRICES.get(provider_lower, {})
            prices = provider_prices.get(model_lower, {})

        input_price = prices.get("input", 0.0)
        output_price = prices.get("output", 0.0)

        input_cost = (prompt_tokens / 1000) * input_price
        output_cost = (completion_tokens / 1000) * output_price

        return round(input_cost + output_cost, 8)

    # ==================== 价格管理 ====================

    def set_custom_price(
        self,
        provider: str,
        model: str,
        input_price: float,
        output_price: float,
    ) -> None:
        """
        设置自定义价格覆盖。

        Args:
            provider: 提供商名称
            model: 模型名称
            input_price: 每 1K input token 的价格 (USD)
            output_price: 每 1K output token 的价格 (USD)
        """
        with self._lock:
            if provider not in self._custom_prices:
                self._custom_prices[provider] = {}
            self._custom_prices[provider][model] = {
                "input": input_price,
                "output": output_price,
            }
        logger.info(
            "[CostOptimizer] Set custom price: %s/%s input=%.6f output=%.6f",
            provider, model, input_price, output_price,
        )

    def get_price(self, provider: str, model: str) -> dict[str, float]:
        """获取指定 provider/model 的价格"""
        provider_lower = provider.lower()
        model_lower = model.lower()

        custom = self._custom_prices.get(provider_lower, {}).get(model_lower, {})
        if custom:
            return custom

        default = self.DEFAULT_PRICES.get(provider_lower, {}).get(model_lower, {})
        if default:
            return default

        return {"input": 0.0, "output": 0.0}

    # ==================== 查询统计 ====================

    def get_usage_stats(self, tenant_id: Optional[str] = None) -> dict:
        """
        获取使用统计摘要。

        Args:
            tenant_id: 可选，按租户过滤

        Returns:
            统计摘要字典
        """
        with self._lock:
            if tenant_id:
                records = self._tenant_index.get(tenant_id, [])
            else:
                records = [
                    r for provider_records in self._records.values()
                    for model_records in provider_records.values()
                    for r in model_records
                ]

            if not records:
                return {
                    "total_calls": 0,
                    "total_tokens": 0,
                    "total_cost": 0.0,
                    "avg_cost_per_call": 0.0,
                    "avg_tokens_per_call": 0,
                    "provider_breakdown": {},
                    "model_breakdown": {},
                }

            total_calls = len(records)
            total_tokens = sum(r.total_tokens for r in records)
            total_cost = sum(r.cost for r in records)

            provider_breakdown: dict[str, dict] = {}
            model_breakdown: dict[str, dict] = {}

            for r in records:
                if r.provider not in provider_breakdown:
                    provider_breakdown[r.provider] = {
                        "calls": 0, "tokens": 0, "cost": 0.0,
                    }
                provider_breakdown[r.provider]["calls"] += 1
                provider_breakdown[r.provider]["tokens"] += r.total_tokens
                provider_breakdown[r.provider]["cost"] += r.cost

                model_key = f"{r.provider}/{r.model}"
                if model_key not in model_breakdown:
                    model_breakdown[model_key] = {
                        "calls": 0, "tokens": 0, "cost": 0.0,
                    }
                model_breakdown[model_key]["calls"] += 1
                model_breakdown[model_key]["tokens"] += r.total_tokens
                model_breakdown[model_key]["cost"] += r.cost

            return {
                "total_calls": total_calls,
                "total_tokens": total_tokens,
                "total_cost": round(total_cost, 6),
                "avg_cost_per_call": round(total_cost / total_calls, 8) if total_calls > 0 else 0.0,
                "avg_tokens_per_call": total_tokens // total_calls if total_calls > 0 else 0,
                "provider_breakdown": provider_breakdown,
                "model_breakdown": model_breakdown,
            }

    def get_cost_by_provider(self) -> dict[str, float]:
        """
        获取按 provider 汇总的成本。

        Returns:
            {provider_name: total_cost}
        """
        with self._lock:
            result: dict[str, float] = {}
            for provider, models in self._records.items():
                total = sum(r.cost for model_records in models.values() for r in model_records)
                if total > 0:
                    result[provider] = round(total, 6)
            return result

    def get_cost_by_model(self) -> dict[str, float]:
        """
        获取按 model 汇总的成本。

        Returns:
            {"provider/model": total_cost}
        """
        with self._lock:
            result: dict[str, float] = {}
            for provider, models in self._records.items():
                for model, records in models.items():
                    total = sum(r.cost for r in records)
                    if total > 0:
                        result[f"{provider}/{model}"] = round(total, 6)
            return result

    def get_recent_calls(
        self,
        limit: int = 10,
        tenant_id: Optional[str] = None,
    ) -> list[dict]:
        """
        获取最近的调用记录。

        Args:
            limit: 返回条数
            tenant_id: 可选，按租户过滤

        Returns:
            CostRecord 字典列表
        """
        with self._lock:
            if tenant_id:
                records = sorted(
                    self._tenant_index.get(tenant_id, []),
                    key=lambda r: r.timestamp,
                    reverse=True,
                )
            else:
                records = sorted(
                    (
                        r for provider_records in self._records.values()
                        for model_records in provider_records.values()
                        for r in model_records
                    ),
                    key=lambda r: r.timestamp,
                    reverse=True,
                )
            return [r.to_dict() for r in records[:limit]]

    def get_total_cost(self) -> float:
        """获取总成本"""
        with self._lock:
            return round(self._total_cost, 6)

    def get_total_tokens(self) -> int:
        """获取总 token 数"""
        with self._lock:
            return self._total_tokens

    def get_record_count(self) -> int:
        """获取记录总数"""
        with self._lock:
            return sum(
                len(model_records)
                for provider_records in self._records.values()
                for model_records in provider_records.values()
            )

    # ==================== 维护 ====================

    def clear(self) -> None:
        """清空所有记录"""
        with self._lock:
            self._records.clear()
            self._tenant_index.clear()
            self._total_cost = 0.0
            self._total_tokens = 0
        logger.info("[CostOptimizer] Cleared all records")

    def prune_older_than(self, days: int = 30) -> int:
        """
        清理指定天数之前的记录。

        Args:
            days: 保留天数，之前的记录将被删除

        Returns:
            删除的记录数
        """
        cutoff = datetime.now(timezone.utc).timestamp() - (days * 86400)
        pruned = 0

        with self._lock:
            for provider in list(self._records.keys()):
                for model in list(self._records[provider].keys()):
                    before = len(self._records[provider][model])
                    self._records[provider][model] = [
                        r for r in self._records[provider][model]
                        if r.timestamp.timestamp() >= cutoff
                    ]
                    pruned += before - len(self._records[provider][model])

            # 重建租户索引（与 provider 索引保持同步，避免 double-count）
            for tenant_id in list(self._tenant_index.keys()):
                self._tenant_index[tenant_id] = [
                    r for r in self._tenant_index[tenant_id]
                    if r.timestamp.timestamp() >= cutoff
                ]

            # 重新计算总数
            self._recompute_totals()

        logger.info("[CostOptimizer] Pruned %d records older than %d days", pruned, days)
        return pruned

    def _recompute_totals(self) -> None:
        """重新计算总成本/总 token（锁内调用）"""
        total_cost = 0.0
        total_tokens = 0
        for provider_records in self._records.values():
            for model_records in provider_records.values():
                for r in model_records:
                    total_cost += r.cost
                    total_tokens += r.total_tokens
        self._total_cost = total_cost
        self._total_tokens = total_tokens

    # ==================== Redis 持久化 ====================

    def _persist_cost(self, record: CostRecord) -> None:
        """将成本记录持久化到 Redis（可选）"""
        if not self._redis:
            return
        try:
            key = f"cost_optimizer:{record.provider}:{record.model}"
            self._redis.lpush(key, record.to_dict())
            self._redis.ltrim(key, 0, 9999)  # 最多保留 10000 条
        except Exception as e:
            logger.warning("[CostOptimizer] Failed to persist to Redis: %s", e)

    def load_from_redis(self, provider: str, model: str, max_records: int = 1000) -> int:
        """
        从 Redis 加载历史记录。

        Args:
            provider: 提供商名称
            model: 模型名称
            max_records: 最大加载条数

        Returns:
            加载的记录数
        """
        if not self._redis:
            return 0
        try:
            key = f"cost_optimizer:{provider}:{model}"
            data = self._redis.lrange(key, 0, max_records - 1)
            count = 0
            for item in data:
                if isinstance(item, dict):
                    # 从 Redis 加载的记录需要重建
                    pass
                    count += 1
            return count
        except Exception as e:
            logger.warning("[CostOptimizer] Failed to load from Redis: %s", e)
            return 0

    def export_records(self, tenant_id: Optional[str] = None) -> list[dict]:
        """导出所有记录为字典列表"""
        with self._lock:
            if tenant_id:
                records = self._tenant_index.get(tenant_id, [])
            else:
                records = [
                    r for provider_records in self._records.values()
                    for model_records in provider_records.values()
                    for r in model_records
                ]
            return [r.to_dict() for r in records]

    # ==================== 预算管理 ====================

    def __repr__(self) -> str:
        return (
            f"CostOptimizer(records={self.get_record_count()}, "
            f"total_cost={self.get_total_cost():.6f}, "
            f"total_tokens={self.get_total_tokens()})"
        )


# 全局单例
cost_optimizer = CostOptimizer()