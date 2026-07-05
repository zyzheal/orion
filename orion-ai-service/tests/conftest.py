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
