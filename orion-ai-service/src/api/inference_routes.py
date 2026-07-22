"""
ML 推理 & 决策路由 (Inference & Decision Routes)

提供 ML 推理端点 (分类/嵌入/异常检测) 和决策端点 (决策/部署预测/事件严重度)。
路由前缀: /api/v1/ai

端点:
  GET  /api/v1/ai/inference/health
  POST /api/v1/ai/inference/classify
  POST /api/v1/ai/inference/embedding
  POST /api/v1/ai/inference/anomaly
  POST /api/v1/ai/decision/make
  POST /api/v1/ai/decision/deployment-predict
  POST /api/v1/ai/decision/incident-severity
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException

from src.services.inference_service import inference_service
from src.services.decision_service import decision_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["inference"])


def _get_request_id(x_request_id: Optional[str]) -> str:
    """从 headers 获取或生成 request_id"""
    if x_request_id:
        return x_request_id
    import uuid

    return str(uuid.uuid4())


def _get_tenant_id(x_tenant_id: Optional[str]) -> str:
    """从 headers 获取 tenant_id，默认 'default'"""
    return x_tenant_id or "default"


# ── 统一响应包装 ──


def _wrap(
    data: Any, error: Optional[str] = None, success: bool = True
) -> Dict[str, Any]:
    """统一响应格式: {"success": bool, "data": ..., "error": str|null}"""
    return {"success": success, "data": data, "error": error}


# ════════════════════════════════════════════════════
#  Inference 端点
# ════════════════════════════════════════════════════


@router.get("/inference/health", summary="推理服务健康检查")
async def inference_health(
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """检查推理服务状态和 torch 可用性。"""
    logger.info("Inference health check", extra={"request_id": x_request_id})
    result = inference_service.health()
    return {
        "request_id": x_request_id or "",
        "success": True,
        "data": result,
        "error": None,
    }


@router.post(
    "/inference/classify",
    summary="图像分类",
    description="对上传的图像进行 ML 分类（ResNet18 / 统计回退）。",
)
async def classify_image(
    image_data: Dict[str, Any],
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """
    图像分类端点

    请求体:
    - **image_bytes**: base64 编码的图像字节串（优先）
    - **image_url**: 或直接提供图像 URL（未来支持）
    - **model**: 模型名（默认 "default"）
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)

    logger.info(
        "Image classify request",
        extra={"request_id": request_id, "tenant_id": tenant_id},
    )

    # 解析 base64 图像数据
    b64 = image_data.get("image_bytes", "")
    model = image_data.get("model", "default")

    try:
        import base64

        image_bytes = base64.b64decode(b64)
    except Exception as exc:
        logger.error("Invalid image base64: %s", exc)
        raise HTTPException(
            status_code=400, detail=f"Invalid image base64: {str(exc)}"
        )

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image data")

    result = inference_service.classify_image(image_bytes, model=model)
    result["data"]["request_id"] = request_id
    result["data"]["tenant_id"] = tenant_id
    return result


@router.post(
    "/inference/embedding",
    summary="文本嵌入",
    description="将文本转换为向量嵌入（sentence-transformers / TF-IDF）。",
)
async def text_embedding(
    text_data: Dict[str, Any],
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """
    文本嵌入端点

    请求体:
    - **text**: 待嵌入的文本
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    text = text_data.get("text", "")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    logger.info(
        "Text embedding request",
        extra={"request_id": request_id, "tenant_id": tenant_id, "text_len": len(text)},
    )

    result = inference_service.text_embedding(text)
    result["data"]["request_id"] = request_id
    result["data"]["tenant_id"] = tenant_id
    return result


@router.post(
    "/inference/anomaly",
    summary="异常检测",
    description="对时间序列数据执行异常检测（IsolationForest / Z-Score）。",
)
async def anomaly_detection(
    anomaly_data: Dict[str, Any],
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """
    异常检测端点

    请求体:
    - **data_points**: 时间序列数据点列表，每个点包含 {value, label?, timestamp?}
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    data_points = anomaly_data.get("data_points", [])

    if not isinstance(data_points, list):
        raise HTTPException(status_code=400, detail="data_points must be a list")

    logger.info(
        "Anomaly detection request",
        extra={"request_id": request_id, "tenant_id": tenant_id, "points": len(data_points)},
    )

    result = inference_service.anomaly_detection(data_points)
    result["data"]["request_id"] = request_id
    result["data"]["tenant_id"] = tenant_id
    return result


# ════════════════════════════════════════════════════
#  Decision 端点
# ════════════════════════════════════════════════════


@router.post(
    "/decision/make",
    summary="ML 决策",
    description="基于上下文和候选选项做出加权评分决策。",
)
async def make_decision(
    decision_data: Dict[str, Any],
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """
    ML 决策端点

    请求体:
    - **context**: 决策上下文 {weights?, scores?}
    - **options**: 候选选项列表 [{name, scores: {feature: value}}]
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)

    context = decision_data.get("context", {})
    options = decision_data.get("options", [])

    if not isinstance(options, list):
        raise HTTPException(status_code=400, detail="options must be a list")

    logger.info(
        "Decision request",
        extra={
            "request_id": request_id,
            "tenant_id": tenant_id,
            "options": len(options),
        },
    )

    result = decision_service.make_decision(context=context, options=options)
    result["data"]["request_id"] = request_id
    result["data"]["tenant_id"] = tenant_id
    return result


@router.post(
    "/decision/deployment-predict",
    summary="部署成功预测",
    description="基于应用指标预测部署是否可能成功。",
)
async def deployment_predict(
    predict_data: Dict[str, Any],
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """
    部署成功预测端点

    请求体:
    - **app_metrics**: 应用指标 {error_rate, latency_p99_ms, cpu_percent, memory_percent, test_pass_rate, build_duration_s, change_lines}
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    app_metrics = predict_data.get("app_metrics", {})

    if not isinstance(app_metrics, dict):
        raise HTTPException(status_code=400, detail="app_metrics must be an object")

    logger.info(
        "Deployment prediction request",
        extra={"request_id": request_id, "tenant_id": tenant_id},
    )

    result = decision_service.predict_deployment_success(app_metrics=app_metrics)
    result["data"]["request_id"] = request_id
    result["data"]["tenant_id"] = tenant_id
    return result


@router.post(
    "/decision/incident-severity",
    summary="事件严重度预测",
    description="预测事件严重度并推荐响应方案。",
)
async def incident_severity(
    incident_data_in: Dict[str, Any],
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """
    事件严重度预测端点

    请求体:
    - **incident_data**: 事件数据 {affected_users, error_rate, service_tier, downtime_minutes, has_workaround}
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)

    # 支持两种传参方式: {"incident_data": {...}} 或 直接 {...}
    if "incident_data" in incident_data_in:
        incident_data = incident_data_in["incident_data"]
    else:
        incident_data = incident_data_in

    if not isinstance(incident_data, dict):
        raise HTTPException(
            status_code=400,
            detail="incident_data must be an object (or wrap in {incident_data: ...})",
        )

    logger.info(
        "Incident severity prediction request",
        extra={"request_id": request_id, "tenant_id": tenant_id},
    )

    result = decision_service.predict_incident_severity(incident_data=incident_data)
    result["data"]["request_id"] = request_id
    result["data"]["tenant_id"] = tenant_id
    return result


# ════════════════════════════════════════════════════
#  决策历史代理端点（兼容前端 /api/decision/* 路径）
# ════════════════════════════════════════════════════


@router.get("/decision/history", summary="决策历史（代理）")
async def decision_history_proxy(
    status: Optional[str] = None,
    limit: int = 50,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """决策历史查询（代理到 ai-decision 路由的同一逻辑）。"""
    from src.repositories.ai_result_repository import ai_result_repository

    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)

    decisions = ai_result_repository.list_decisions(tenant_id=tenant_id)
    if status:
        decisions = [d for d in decisions if d.get("status") == status]

    return {
        "success": True,
        "data": {
            "request_id": request_id,
            "tenant_id": tenant_id,
            "decisions": decisions[:limit],
            "total": len(decisions),
        },
        "error": None,
    }
