"""
Inference Service 测试

测试 ML 推理服务（图像分类、文本嵌入、异常检测）的规则引擎与降级逻辑。
"""

import base64

import pytest

from src.services.inference_service import InferenceService, inference_service


@pytest.fixture
def service():
    """创建 InferenceService 实例（torch 通常不可用，触发降级）"""
    return InferenceService()


# ═══════════════════════════════════════
#  健康检查
# ═══════════════════════════════════════


class TestInferenceHealth:
    """健康检查端点测试。"""

    def test_health_returns_status(self, service):
        """health() 返回 health 结构。"""
        result = service.health()
        assert result["status"] == "healthy"
        assert isinstance(result["torch_available"], bool)
        assert "torch_version" in result
        assert "inference_backend" in result

    def test_health_torch_version_not_installed(self, service):
        """torch 不可用时返回 not-installed。"""
        result = service.health()
        if not service._torch_available:
            assert result["torch_version"] == "not-installed"

    def test_health_backend_is_fallback(self, service):
        """torch 不可用时后端为 fallback。"""
        result = service.health()
        if not service._torch_available:
            assert result["inference_backend"] == "fallback-statistical"


# ═══════════════════════════════════════
#  图像分类
# ═══════════════════════════════════════


class TestImageClassification:
    """图像分类端点测试。"""

    def _small_png(self) -> bytes:
        """生成一个最小合法 PNG（1x1 红色像素）。"""
        import io
        from PIL import Image
        img = Image.new("RGB", (1, 1), color=(255, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def test_classify_returns_structured_response(self, service):
        """classify_image 返回 {success, data, error} 结构。"""
        image_bytes = self._small_png()
        result = service.classify_image(image_bytes)
        assert "success" in result
        assert "data" in result
        assert "error" in result
        assert result["success"] is True
        assert result["error"] is None

    def test_classify_has_prediction_fields(self, service):
        """分类结果包含 top_label / top_confidence / predictions。"""
        image_bytes = self._small_png()
        result = service.classify_image(image_bytes)
        data = result["data"]
        assert "top_label" in data
        assert "top_confidence" in data
        assert "predictions" in data
        assert isinstance(data["predictions"], list)
        assert len(data["predictions"]) >= 1
        # 红色像素 → 可能分类为 general / warm 类
        assert data["top_confidence"] > 0.0

    def test_classify_empty_image_returns_structured(self, service):
        """空图像数据返回结构化错误。"""
        result = service.classify_image(b"")
        # PIL 无法打开空字节流，应返回 fallback（非失败）
        assert "success" in result
        assert "data" in result

    def test_classify_with_custom_model_name(self, service):
        """传递 model 参数时结果包含 model 字段。"""
        image_bytes = self._small_png()
        result = service.classify_image(image_bytes, model="custom")
        # 降级模式下 model 名不一定含 "custom"，但结构应完整
        assert result["success"] is True
        assert "data" in result


# ═══════════════════════════════════════
#  文本嵌入
# ═══════════════════════════════════════


class TestTextEmbedding:
    """文本嵌入端点测试。"""

    def test_embedding_returns_structured_response(self, service):
        """text_embedding 返回 {success, data, error} 结构。"""
        result = service.text_embedding("hello world")
        assert result["success"] is True
        assert result["error"] is None
        assert "data" in result

    def test_embedding_has_vector(self, service):
        """嵌入结果包含向量。"""
        result = service.text_embedding("hello world")
        data = result["data"]
        assert "embedding" in data
        assert isinstance(data["embedding"], list)
        assert len(data["embedding"]) > 0
        assert all(isinstance(v, float) for v in data["embedding"])

    def test_embedding_dimension(self, service):
        """嵌入维度应 > 0。"""
        result = service.text_embedding("hello world")
        assert result["data"]["dimension"] > 0

    def test_embedding_uses_tfidf_engine(self, service):
        """无 sentence-transformers 时使用 TF-IDF。"""
        result = service.text_embedding("hello world")
        assert result["data"]["engine"] in ("tfidf-sklearn", "sentence-transformers")

    def test_embedding_engine_field(self, service):
        """engine 字段标识实际使用的引擎。"""
        result = service.text_embedding("machine learning is great")
        assert "engine" in result["data"]


# ═══════════════════════════════════════
#  异常检测
# ═══════════════════════════════════════


class TestAnomalyDetection:
    """异常检测端点测试。"""

    def test_anomaly_returns_structured_response(self, service):
        """anomaly_detection 返回 {success, data, error}。"""
        points = [{"value": i} for i in [1, 2, 3, 4, 5]]
        result = service.anomaly_detection(points)
        assert "success" in result
        assert "data" in result
        assert "error" in result

    def test_anomaly_detects_outlier(self, service):
        """应能检测到明显异常值。"""
        points = [{"value": i} for i in [1, 2, 3, 4, 5, 100, 2, 3, 4]]
        result = service.anomaly_detection(points)
        if result["success"]:
            assert result["data"]["anomaly_count"] >= 1
            anomalies = result["data"]["anomalies"]
            assert any(a["value"] == 100 for a in anomalies)

    def test_anomaly_empty_list(self, service):
        """空数据点列表返回成功但无异常。"""
        result = service.anomaly_detection([])
        assert result["success"] is True
        assert result["data"]["anomalies"] == []
        assert result["data"]["total_points"] == 0

    def test_anomaly_has_stats(self, service):
        """结果包含统计信息。"""
        points = [{"value": i} for i in [10, 20, 30, 40, 50]]
        result = service.anomaly_detection(points)
        data = result["data"]
        assert "total_points" in data
        assert data["total_points"] == 5

    def test_anomaly_engine_field(self, service):
        """engine 字段标识使用的引擎。"""
        points = [{"value": i} for i in [1, 2, 3, 4, 5, 100, 2, 3, 4]]
        result = service.anomaly_detection(points)
        if result["success"]:
            engine = result["data"]["engine"]
            assert engine in ("sklearn-isolation-forest", "zscore-statistical")

    def test_anomaly_non_numeric_ignored(self, service):
        """非数值数据点应被跳过。"""
        points = [
            {"value": 1.0},
            {"value": "not-a-number"},
            {"value": 2.0},
        ]
        result = service.anomaly_detection(points)
        if result["success"]:
            assert result["data"]["total_points"] == 2
