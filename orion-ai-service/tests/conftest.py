"""
AI Service 测试配置

提供 mock 仓储层，使测试无需真实 PostgreSQL 即可运行。
"""
import sys
from unittest.mock import MagicMock

# 在导入 ai_service 之前，替换全局仓储为 mock
_mock_repo = MagicMock()
_mock_repo.save_generation = MagicMock()
_mock_repo.save_analysis = MagicMock()
_mock_repo.save_diagnosis = MagicMock()
_mock_repo.save_decision = MagicMock()
_mock_repo.save_review = MagicMock()
_mock_repo.get_decision = MagicMock(return_value=None)
_mock_repo.get_review = MagicMock(return_value=None)
_mock_repo.get_generation = MagicMock(return_value=None)
_mock_repo.get_analysis = MagicMock(return_value=None)
_mock_repo.get_diagnosis = MagicMock(return_value=None)
_mock_repo.list_decisions = MagicMock(return_value=[])
_mock_repo.list_reviews = MagicMock(return_value=[])
_mock_repo.list_analyses = MagicMock(return_value=[])
_mock_repo.list_diagnoses = MagicMock(return_value=[])
_mock_repo.list_generations = MagicMock(return_value=[])
_mock_repo.update_decision_status = MagicMock(return_value=False)

# Patch the repository module before any service imports
sys.modules['src.repositories.ai_result_repository'] = MagicMock()
sys.modules['src.repositories.ai_result_repository'].ai_result_repository = _mock_repo

# ==================== Metric 仓储 Mock ====================

class _FakeMetricRepo:
    """Fake MetricStorageRepository for tests and route imports."""
    def register_metric(self, *a, **kw): pass
    def unregister_metric(self, *a, **kw): return True
    def get_all_registered_metrics(self, *a, **kw): return []
    def get_metric_registry(self, *a, **kw): return None
    def insert_data_point(self, *a, **kw): pass
    def query_metric_series(self, *a, **kw):
        from src.models.metric_models import MetricSeries, MetricAggregation
        from datetime import datetime, timezone
        return MetricSeries(name="test", data_points=[], aggregation=MetricAggregation(),
                            window_start=datetime.now(timezone.utc), window_end=datetime.now(timezone.utc))
    def get_latest_value(self, *a, **kw): return None
    def prune_expired(self, *a, **kw): return 0
    def clear_all(self, *a, **kw): pass

# Patch metric_storage_repository module so metric_routes uses fake repo
sys.modules['src.repositories.metric_storage_repository'] = MagicMock()
sys.modules['src.repositories.metric_storage_repository'].PostgresMetricStorageRepository = _FakeMetricRepo
