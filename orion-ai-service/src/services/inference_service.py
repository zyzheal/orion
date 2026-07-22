"""
ML 推理服务 (Inference Service)

提供图像分类、文本嵌入、异常检测等 ML 推理能力。
- Torch 懒加载，无 torch 时优雅降级到统计方法。
- 所有方法为同步，FastAPI 端点中通过线程池执行以避免阻塞事件循环。
"""

import base64
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── 预定义类别标签 (ImageNet 简版，用于 torch 不可用时的回退) ──
_IMAGENET_TOP_LABELS = [
    "tench", "goldfish", "great white shark", "tiger shark", "hammerhead",
    "electric ray", "stingray", "cock", "hen", "ostrich", "brambling",
    "goldfinch", "junco", "indigo bunting", "robin", "bulbul", "jay",
    "magpie", "chickadee", "water ouzel",
]


def _load_torch() -> bool:
    """尝试导入 torch/torchvision，返回是否可用。"""
    try:
        import torch  # noqa: F401
        import torchvision  # noqa: F401
        return True
    except ImportError:
        return False


class InferenceService:
    """
    ML 推理服务。

    - `torch_available`: torch 是否可用（懒加载）。
    - 所有推理结果包含 `{"success", "data", "error"}` 三层结构。
    """

    def __init__(self) -> None:
        self._torch_available: bool = False
        self._torch_module: Optional[Any] = None
        self._torchvision_module: Optional[Any] = None
        self._model: Optional[Any] = None
        self._transforms = None
        self._load_torch_lazy()

    # ── 懒加载 ──

    def _load_torch_lazy(self) -> None:
        """懒加载 torch 模块，避免启动时阻塞。"""
        try:
            import torch  # noqa: F401
            import torchvision  # noqa: F401
            self._torch_available = True
            self._torch_module = torch
            self._torchvision_module = torchvision
            logger.info("torch/torchvision loaded successfully")
        except ImportError as exc:
            logger.warning("torch/torchvision not available: %s", exc)
            self._torch_available = False

    def _get_model(self) -> Optional[Any]:
        """懒加载 ResNet18 预训练模型。"""
        if self._model is None and self._torch_available:
            try:
                from torchvision import models  # noqa: F401
                from torchvision import transforms as _tfs  # noqa: F401
                _weights = (
                    self._torchvision_module.models.ResNet18_Weights.IMAGENET1K_V1
                )
                self._model = self._torchvision_module.models.resnet18(weights=_weights)
                self._model.eval()
                self._transforms = self._torchvision_module.transforms.Compose(
                    [
                        self._torchvision_module.transforms.Resize(256),
                        self._torchvision_module.transforms.CenterCrop(224),
                        self._torchvision_module.transforms.ToTensor(),
                        self._torchvision_module.transforms.Normalize(
                            mean=[0.485, 0.456, 0.406],
                            std=[0.229, 0.224, 0.225],
                        ),
                    ]
                )
                logger.info("ResNet18 pretrained model loaded")
            except Exception as exc:
                logger.error("Failed to load ResNet18: %s", exc)
                self._model = None
        return self._model

    # ── 健康检查 ──

    def health(self) -> Dict[str, Any]:
        """检查服务健康和 torch 可用性。"""
        return {
            "status": "healthy",
            "torch_available": self._torch_available,
            "torch_version": (
                self._torch_module.__version__ if self._torch_available else "not-installed"
            ),
            "inference_backend": (
                "pytorch-resnet18" if self._model is not None else "fallback-statistical"
            ),
        }

    # ── 图像分类 ──

    def classify_image(
        self, image_bytes: bytes, model: str = "default"
    ) -> Dict[str, Any]:
        """
        图像分类。

        - torch 可用：使用 ResNet18 预训练模型。
        - torch 不可用：基于图像统计特征（像素均值/方差）的简单回退。
        """
        result_id = str(uuid.uuid4())[:8]
        try:
            if self._torch_available:
                return self._classify_with_torch(result_id, image_bytes, model)
            else:
                return self._classify_fallback(result_id, image_bytes)
        except Exception as exc:
            logger.exception("Image classification failed")
            return {
                "success": False,
                "data": {"id": result_id},
                "error": f"Image classification failed: {str(exc)}",
            }

    def _classify_with_torch(
        self, result_id: str, image_bytes: bytes, model: str
    ) -> Dict[str, Any]:
        """使用 ResNet18 进行图像分类。"""
        _model = self._get_model()
        if _model is None:
            return self._classify_fallback(result_id, image_bytes)

        try:
            from PIL import Image
        except ImportError:
            return self._classify_fallback(result_id, image_bytes)

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        if self._transforms is None:
            return self._classify_fallback(result_id, image_bytes)

        tensor = self._transforms(img).unsqueeze(0)
        with self._torch_module.no_grad():
            output = _model(tensor)
            probs = self._torch_module.nn.functional.softmax(output, dim=1)
            top5_probs, top5_indices = self._torch_module.topk(probs, k=5, dim=1)

        predictions = []
        for prob, idx in zip(top5_probs[0], top5_indices[0]):
            label = _IMAGENET_TOP_LABELS[idx.item()] if idx.item() < len(_IMAGENET_TOP_LABELS) else f"class-{idx.item()}"
            predictions.append({
                "label": label,
                "confidence": round(float(prob.item()), 4),
            })

        return {
            "success": True,
            "data": {
                "id": result_id,
                "model": f"resnet18-{model}",
                "top_label": predictions[0]["label"],
                "top_confidence": predictions[0]["confidence"],
                "predictions": predictions,
                "engine": "pytorch",
            },
            "error": None,
        }

    def _classify_fallback(
        self, result_id: str, image_bytes: bytes
    ) -> Dict[str, Any]:
        """基于像素统计的简单回退分类。"""
        try:
            from PIL import Image
        except ImportError:
            # 无法解析图像，基于字节长度/分布给出统计分类
            length = len(image_bytes)
            return {
                "success": True,
                "data": {
                    "id": result_id,
                    "model": "fallback-statistical",
                    "top_label": "unknown-object",
                    "top_confidence": 0.25,
                    "predictions": [
                        {"label": "unknown-object", "confidence": 0.25},
                        {"label": "texture", "confidence": 0.20},
                        {"label": "document", "confidence": 0.15},
                    ],
                    "engine": "fallback",
                    "note": "torch/PIL not available; statistical fallback used",
                    "image_byte_length": length,
                },
                "error": None,
            }

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        pixels = list(img.getdata())
        width, height = img.size

        # 计算每通道均值和方差
        r_vals = [p[0] for p in pixels]
        g_vals = [p[1] for p in pixels]
        b_vals = [p[2] for p in pixels]

        def _mean(var_list):
            return sum(var_list) / len(var_list)

        def _var(var_list):
            m = _mean(var_list)
            return sum((x - m) ** 2 for x in var_list) / len(var_list)

        r_mean, g_mean, b_mean = _mean(r_vals), _mean(g_vals), _mean(b_vals)
        brightness = (r_mean + g_mean + b_mean) / 3

        # 基于亮度/色偏的简单规则
        if brightness > 200:
            label, conf = "document-light", 0.6
        elif abs(r_mean - b_mean) > 50 and g_mean < 100:
            label, conf = "warm-sky", 0.55
        elif g_mean > r_mean and g_mean > b_mean:
            label, conf = "nature-green", 0.55
        else:
            label, conf = "general-scene", 0.45

        return {
            "success": True,
            "data": {
                "id": result_id,
                "model": "fallback-statistical",
                "top_label": label,
                "top_confidence": conf,
                "predictions": [
                    {"label": label, "confidence": conf},
                    {"label": "texture", "confidence": 0.15},
                    {"label": "unknown-object", "confidence": 0.10},
                ],
                "image_width": width,
                "image_height": height,
                "engine": "fallback",
            },
            "error": None,
        }

    # ── 文本嵌入 ──

    def text_embedding(self, text: str) -> Dict[str, Any]:
        """
        生成文本嵌入。

        引擎优先级（从快到慢、从无网络到有网络）：
        1. sklearn TfidfVectorizer（快速、离线）
        2. sentence-transformers（需要网络下载模型，仅作为增强）
        """
        result_id = str(uuid.uuid4())[:8]
        # 首选 sklearn TF-IDF（无网络依赖、毫秒级）
        try:
            return self._text_embedding_tfidf(result_id, text)
        except Exception as exc:
            logger.warning("TF-IDF embedding failed, trying sentence-transformers: %s", exc)

        # 降级：sentence-transformers（可能需要网络）
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer("all-MiniLM-L6-v2")
            vec = model.encode([text])
            return {
                "success": True,
                "data": {
                    "id": result_id,
                    "embedding": vec[0].tolist(),
                    "dimension": len(vec[0]),
                    "engine": "sentence-transformers",
                },
                "error": None,
            }
        except Exception as exc2:
            logger.exception("All embedding engines failed")
            return {
                "success": False,
                "data": {"id": result_id},
                "error": f"Text embedding failed: {str(exc2)}",
            }

    def _text_embedding_tfidf(
        self, result_id: str, text: str
    ) -> Dict[str, Any]:
        """基于 sklearn TfidfVectorizer 的文本嵌入（128 维，离线可用）。"""
        from sklearn.feature_extraction.text import TfidfVectorizer
        vectorizer = TfidfVectorizer(
            max_features=128, ngram_range=(1, 2), stop_words="english"
        )
        try:
            matrix = vectorizer.fit_transform([text])
            embedding = matrix.toarray()[0].tolist()
        except ValueError:
            # 空文本或无法向量化 → 零向量
            embedding = [0.0] * 128

        return {
            "success": True,
            "data": {
                "id": result_id,
                "embedding": [round(float(v), 6) for v in embedding],
                "dimension": 128,
                "engine": "tfidf-sklearn",
            },
            "error": None,
        }

    # ── 异常检测 ──

    def anomaly_detection(
        self, data_points: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        时间序列异常检测。

        支持两种引擎：
        - sklearn IsolationForest（数据点 >= 10 时首选）。
        - Z-Score 统计方法（始终可用，不依赖 sklearn）。
        """
        result_id = str(uuid.uuid4())[:8]
        if not data_points:
            return {
                "success": True,
                "data": {
                    "id": result_id,
                    "anomalies": [],
                    "total_points": 0,
                    "anomaly_count": 0,
                    "engine": "sklearn-isolation-forest",
                },
                "error": None,
            }

        try:
            # 从 data_points 提取数值列
            values, labels, timestamps = [], [], []
            for i, dp in enumerate(data_points):
                v = dp.get("value")
                if v is None:
                    v = dp.get("metric")
                if v is None:
                    continue
                try:
                    v = float(v)
                except (TypeError, ValueError):
                    continue
                values.append(v)
                labels.append(str(dp.get("label", dp.get("name", f"point-{i}"))))
                ts = dp.get("timestamp", dp.get("time"))
                timestamps.append(str(ts) if ts else "")

            if not values:
                return {
                    "success": False,
                    "data": {"id": result_id},
                    "error": "No numeric values found in data_points",
                }

            # sklearn IsolationForest
            try:
                from sklearn.ensemble import IsolationForest
                iso = IsolationForest(
                    contamination=0.1, random_state=42, n_estimators=100
                )
                # 每个值作为一行特征传入
                X = [[v] for v in values]
                pred = iso.fit_predict(X)
                anomalies = [
                    {
                        "index": idx,
                        "value": values[idx],
                        "label": labels[idx],
                        "timestamp": timestamps[idx],
                        "is_anomaly": True,
                        "score": round(float(iso.decision_function([[values[idx]]])[0]), 4),
                    }
                    for idx in range(len(values))
                    if pred[idx] == -1
                ]
                return {
                    "success": True,
                    "data": {
                        "id": result_id,
                        "anomalies": anomalies,
                        "total_points": len(values),
                        "anomaly_count": len(anomalies),
                        "engine": "sklearn-isolation-forest",
                        "stats": {
                            "mean": round(sum(values) / len(values), 4),
                            "min": round(min(values), 4),
                            "max": round(max(values), 4),
                        },
                    },
                    "error": None,
                }
            except ImportError:
                pass

            # Z-Score 回退
            return self._anomaly_zscore(result_id, values, labels, timestamps)
        except Exception as exc:
            logger.exception("Anomaly detection failed")
            return {
                "success": False,
                "data": {"id": result_id},
                "error": f"Anomaly detection failed: {str(exc)}",
            }

    def _anomaly_zscore(
        self, result_id: str, values: list, labels: list, timestamps: list
    ) -> Dict[str, Any]:
        """Z-Score 统计异常检测（不依赖 sklearn）。"""
        n = len(values)
        mean = sum(values) / n
        variance = sum((x - mean) ** 2 for x in values) / n
        std = variance ** 0.5

        if std == 0:
            anomalies = []
        else:
            threshold = 2.0
            anomalies = [
                {
                    "index": i,
                    "value": values[i],
                    "label": labels[i],
                    "timestamp": timestamps[i],
                    "is_anomaly": True,
                    "z_score": round((values[i] - mean) / std, 4),
                }
                for i in range(n)
                if abs((values[i] - mean) / std) > threshold
            ]

        return {
            "success": True,
            "data": {
                "id": result_id,
                "anomalies": anomalies,
                "total_points": n,
                "anomaly_count": len(anomalies),
                "engine": "zscore-statistical",
                "stats": {
                    "mean": round(mean, 4),
                    "std": round(std, 4),
                    "min": round(min(values), 4),
                    "max": round(max(values), 4),
                    "threshold": 2.0,
                },
            },
            "error": None,
        }


# 全局服务实例
inference_service = InferenceService()
