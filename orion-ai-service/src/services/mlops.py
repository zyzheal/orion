"""
MLOps 服务

提供模型注册、部署、查询等 MLOps 能力。
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.models.ml import ModelDeployment, DeploymentStatus

logger = logging.getLogger(__name__)


class MLOpsService:
    """
    MLOps 服务

    管理模型注册、版本控制和部署生命周期。
    """

    def __init__(self) -> None:
        # Store ModelDeployment objects directly to preserve identity on repeated deploys
        self._deployments: Dict[str, ModelDeployment] = {}

    def register_model(
        self,
        model_id: str,
        version: str,
        path: str,
        metadata: Dict[str, Any],
    ) -> ModelDeployment:
        """
        注册模型版本
        """
        key = f"{model_id}:{version}"
        deployment = ModelDeployment(
            model_id=model_id,
            version=version,
            path=path,
            environment="registered",
            status=DeploymentStatus.REGISTERED,
            deployed_at=None,
            metadata=metadata or {},
        )
        self._deployments[key] = deployment
        logger.info(
            "Model registered",
            extra={"model_id": model_id, "version": version},
        )
        return deployment

    def deploy_model(
        self,
        model_id: str,
        version: str,
        environment: str,
    ) -> Optional[ModelDeployment]:
        """
        部署模型到指定环境
        """
        key = f"{model_id}:{version}"
        existing = self._deployments.get(key)
        if not existing:
            return None

        # 已部署过的模型返回已有对象（保持 identity）
        if existing.status == DeploymentStatus.DEPLOYED:
            return existing

        now = datetime.now(timezone.utc)
        deployment = ModelDeployment(
            model_id=model_id,
            version=version,
            path=existing.path,
            environment=environment,
            status=DeploymentStatus.DEPLOYED,
            deployed_at=now,
            metadata=existing.metadata or {},
        )
        self._deployments[key] = deployment
        logger.info(
            "Model deployed",
            extra={"model_id": model_id, "version": version, "environment": environment},
        )
        return deployment

    def get_deployment(
        self, model_id: str, version: Optional[str] = None
    ) -> Optional[ModelDeployment]:
        """
        查询模型部署信息，不指定 version 返回最新版本
        """
        if version:
            key = f"{model_id}:{version}"
            return self._deployments.get(key)

        # 不指定 version，返回最新部署的版本
        candidates = [
            (k, v) for k, v in self._deployments.items() if v.model_id == model_id
        ]
        if not candidates:
            return None
        candidates.sort(key=lambda item: item[0], reverse=True)
        return candidates[0][1]

    def list_models(self) -> List[ModelDeployment]:
        """列出所有已注册模型"""
        seen = {}
        for key, deployment in self._deployments.items():
            model_id = deployment.model_id
            if model_id not in seen:
                seen[model_id] = deployment
        return list(seen.values())


# 全局 MLOps 服务实例
mlops_service = MLOpsService()
