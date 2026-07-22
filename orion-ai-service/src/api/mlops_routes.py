"""
MLOps API 路由

提供模型注册、部署、查询接口。
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.services.mlops import mlops_service
from src.models.ml import ModelDeployment, DeploymentStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai/mlops", tags=["ai-mlops"])


# ==================== 请求/响应模型 ====================


class RegisterModelRequest(BaseModel):
    """注册模型请求"""
    model_id: str = Field(..., description="模型 ID")
    version: str = Field(..., description="模型版本")
    path: str = Field(..., description="模型文件路径")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="模型元数据")


class DeployModelRequest(BaseModel):
    """部署模型请求"""
    environment: str = Field(..., description="部署环境 (staging/prod/etc)")


class ModelDeploymentResponse(BaseModel):
    """模型部署响应"""
    model_id: str
    version: str
    path: str
    environment: str
    status: str
    deployed_at: Optional[str]
    metadata: Dict[str, Any]


def _to_deployment_response(d: ModelDeployment) -> ModelDeploymentResponse:
    """Convert ModelDeployment to response model"""
    return ModelDeploymentResponse(
        model_id=d.model_id,
        version=d.version,
        path=d.path,
        environment=d.environment,
        status=d.status.value,
        deployed_at=d.deployed_at.isoformat() if d.deployed_at else None,
        metadata=d.metadata or {},
    )


# ==================== 路由 ====================


@router.post("/models", response_model=ModelDeploymentResponse)
async def register_model(request: RegisterModelRequest) -> ModelDeploymentResponse:
    """注册模型版本"""
    deployment = mlops_service.register_model(
        model_id=request.model_id,
        version=request.version,
        path=request.path,
        metadata=request.metadata or {},
    )
    return _to_deployment_response(deployment)


@router.post("/models/{model_id}/deploy", response_model=ModelDeploymentResponse)
async def deploy_model(
    model_id: str,
    request: DeployModelRequest,
    version: Optional[str] = Query(default=None, description="模型版本，不指定则使用最新"),
) -> ModelDeploymentResponse:
    """部署模型到指定环境"""
    # 如果指定了 version 则部署指定版本，否则用最新版本
    if version:
        deployment = mlops_service.deploy_model(model_id, version, request.environment)
        if not deployment:
            raise HTTPException(
                status_code=404,
                detail=f"Model version '{version}' for model '{model_id}' not found",
            )
    else:
        # 获取最新版本部署
        latest = mlops_service.get_deployment(model_id)
        if not latest:
            raise HTTPException(
                status_code=404,
                detail=f"No registered versions found for model '{model_id}'",
            )
        deployment = mlops_service.deploy_model(model_id, latest.version, request.environment)

    return _to_deployment_response(deployment)


@router.get("/models/{model_id}/deployment", response_model=Optional[ModelDeploymentResponse])
async def get_model_deployment(
    model_id: str,
    version: Optional[str] = Query(default=None, description="模型版本，不指定则返回最新"),
) -> Optional[ModelDeploymentResponse]:
    """查询模型部署信息"""
    deployment = mlops_service.get_deployment(model_id, version=version)
    if not deployment:
        raise HTTPException(
            status_code=404,
            detail=f"No deployment found for model '{model_id}'",
        )
    return _to_deployment_response(deployment)


@router.get("/models", response_model=List[ModelDeploymentResponse])
async def list_models() -> List[ModelDeploymentResponse]:
    """列出所有已注册模型"""
    models = mlops_service.list_models()
    return [_to_deployment_response(m) for m in models]
