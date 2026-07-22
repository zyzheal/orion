"""
MLOpsService 测试

测试模型注册、部署、查询和列表功能。
"""

import pytest

from src.services.mlops import MLOpsService
from src.models.ml import ModelDeployment, DeploymentStatus


@pytest.fixture
def service():
    """创建 MLOpsService 实例"""
    return MLOpsService()


class TestRegisterModel:
    """注册模型版本测试"""

    def test_register_model_returns_deployment(self, service: MLOpsService):
        """测试注册模型返回 ModelDeployment"""
        deployment = service.register_model(
            model_id="model-001",
            version="v1.0.0",
            path="/models/model-001/v1.0.0",
            metadata={"accuracy": 0.95, "framework": "pytorch"},
        )

        assert isinstance(deployment, ModelDeployment)
        assert deployment.model_id == "model-001"
        assert deployment.version == "v1.0.0"
        assert deployment.path == "/models/model-001/v1.0.0"
        assert deployment.status == DeploymentStatus.REGISTERED
        assert deployment.environment == "registered"
        assert deployment.metadata["accuracy"] == 0.95

    def test_register_model_stores_deployment(self, service: MLOpsService):
        """测试注册模型后可被查询"""
        service.register_model(
            model_id="model-002",
            version="v1.0.0",
            path="/models/model-002/v1.0.0",
            metadata={},
        )

        deployment = service.get_deployment("model-002", "v1.0.0")
        assert deployment is not None
        assert deployment.model_id == "model-002"

    def test_register_model_same_version_updates(self, service: MLOpsService):
        """测试注册相同版本会更新已有记录"""
        service.register_model(
            model_id="model-003",
            version="v1.0.0",
            path="/models/model-003/v1.0.0",
            metadata={"accuracy": 0.90},
        )

        # 再次注册相同版本
        service.register_model(
            model_id="model-003",
            version="v1.0.0",
            path="/models/model-003/v1.0.0-updated",
            metadata={"accuracy": 0.95},
        )

        deployment = service.get_deployment("model-003", "v1.0.0")
        assert deployment.path == "/models/model-003/v1.0.0-updated"
        assert deployment.metadata["accuracy"] == 0.95


class TestDeployModel:
    """部署模型测试"""

    def test_deploy_registered_model(self, service: MLOpsService):
        """测试部署已注册的模型"""
        service.register_model(
            model_id="model-004",
            version="v1.0.0",
            path="/models/model-004/v1.0.0",
            metadata={},
        )

        deployment = service.deploy_model(
            model_id="model-004",
            version="v1.0.0",
            environment="prod",
        )

        assert deployment is not None
        assert deployment.status == DeploymentStatus.DEPLOYED
        assert deployment.environment == "prod"
        assert deployment.deployed_at is not None

    def test_deploy_unregistered_model_returns_none(self, service: MLOpsService):
        """测试部署未注册的模型返回 None"""
        deployment = service.deploy_model(
            model_id="nonexistent-model",
            version="v1.0.0",
            environment="prod",
        )
        assert deployment is None

    def test_deploy_already_deployed_model_returns_existing(
        self, service: MLOpsService
    ):
        """测试重复部署已部署的模型返回现有部署信息"""
        service.register_model(
            model_id="model-005",
            version="v1.0.0",
            path="/models/model-005/v1.0.0",
            metadata={},
        )

        deployment1 = service.deploy_model("model-005", "v1.0.0", "prod")
        deployment2 = service.deploy_model("model-005", "v1.0.0", "prod")

        assert deployment1 is deployment2
        assert deployment1.status == DeploymentStatus.DEPLOYED


class TestGetDeployment:
    """查询部署信息测试"""

    def test_get_deployment_with_version(self, service: MLOpsService):
        """测试按 version 查询"""
        service.register_model(
            model_id="model-006",
            version="v1.0.0",
            path="/models/model-006/v1.0.0",
            metadata={},
        )

        deployment = service.get_deployment("model-006", "v1.0.0")
        assert deployment is not None
        assert deployment.version == "v1.0.0"

    def test_get_deployment_without_version_returns_latest(
        self, service: MLOpsService
    ):
        """测试不指定 version 返回最新部署版本"""
        service.register_model(
            model_id="model-007",
            version="v1.0.0",
            path="/models/model-007/v1.0.0",
            metadata={},
        )

        # 部署多个版本
        service.deploy_model("model-007", "v1.0.0", "staging")
        service.register_model(
            model_id="model-007",
            version="v2.0.0",
            path="/models/model-007/v2.0.0",
            metadata={},
        )
        service.deploy_model("model-007", "v2.0.0", "staging")

        latest = service.get_deployment("model-007")
        assert latest is not None
        assert latest.version == "v2.0.0"

    def test_get_deployment_nonexistent_returns_none(self, service: MLOpsService):
        """测试查询不存在的模型返回 None"""
        deployment = service.get_deployment("nonexistent-model")
        assert deployment is None


class TestListModels:
    """列出所有模型测试"""

    def test_list_models_empty(self, service: MLOpsService):
        """测试空列表"""
        models = service.list_models()
        assert models == []

    def test_list_models_returns_all(self, service: MLOpsService):
        """测试列出所有已注册模型"""
        service.register_model("model-008", "v1.0.0", "/m/v1", {})
        service.register_model("model-009", "v1.0.0", "/m/v2", {})
        service.register_model("model-010", "v1.0.0", "/m/v3", {})

        models = service.list_models()
        assert len(models) == 3
        model_ids = {m.model_id for m in models}
        assert model_ids == {"model-008", "model-009", "model-010"}
