/**
 * MLInferenceService 单元测试
 */

import { MLInferenceService } from '../MLInferenceService';

describe('MLInferenceService', () => {
  let service: MLInferenceService;

  beforeEach(async () => {
    service = new MLInferenceService();
  });

  // ==================== loadModel ====================

  describe('loadModel', () => {
    it('should load a default model', async () => {
      const model = service.loadModel('pipeline-failure-predictor');

      expect(model.modelId).toBe('pipeline-failure-predictor');
      expect(model.status).toBe('loaded');
      expect(model.modelType).toBe('classification');
      expect(model.loadedAt).toBeDefined();
    });

    it('should return existing model if already loaded', async () => {
      const first = service.loadModel('pipeline-failure-predictor');
      const second = service.loadModel('pipeline-failure-predictor');

      expect(second.modelId).toBe(first.modelId);
      expect(second.status).toBe('loaded');
    });

    it('should create a new model for unknown modelId', async () => {
      const model = service.loadModel('custom-model-123');

      expect(model.modelId).toBe('custom-model-123');
      expect(model.status).toBe('loaded');
      expect(model.featureCount).toBe(3);
    });
  });

  // ==================== unloadModel ====================

  describe('unloadModel', () => {
    it('should unload a loaded model', async () => {
      service.loadModel('pipeline-failure-predictor');

      const result = service.unloadModel('pipeline-failure-predictor');
      expect(result).toBe(true);

      const model = service.getModel('pipeline-failure-predictor');
      expect(model!.status).toBe('unloaded');
    });

    it('should return false for non-existent model', async () => {
      const result = service.unloadModel('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== getModel ====================

  describe('getModel', () => {
    it('should return model info', async () => {
      service.loadModel('cost-estimator');

      const model = service.getModel('cost-estimator');
      expect(model).toBeDefined();
      expect(model!.name).toBe('Resource Cost Estimator');
      expect(model!.modelType).toBe('regression');
    });

    it('should return undefined for non-existent model', async () => {
      const model = service.getModel('non-existent');
      expect(model).toBeUndefined();
    });
  });

  // ==================== listLoadedModels ====================

  describe('listLoadedModels', () => {
    it('should list only loaded models', async () => {
      service.loadModel('pipeline-failure-predictor');
      service.loadModel('cost-estimator');

      const models = service.listLoadedModels();
      expect(models).toHaveLength(2);
      expect(models.every((m) => m.status === 'loaded')).toBe(true);
    });

    it('should return empty list when no models loaded', async () => {
      const models = service.listLoadedModels();
      expect(models).toHaveLength(0);
    });
  });

  // ==================== predict ====================

  describe('predict', () => {
    it('should predict with classification model', async () => {
      service.loadModel('pipeline-failure-predictor');

      const result = await service.predict(
        { build_duration: 300, test_count: 50, code_changes: 10, history_failure_rate: 0.1 },
        'pipeline-failure-predictor'
      );

      expect(result.modelId).toBe('pipeline-failure-predictor');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(['positive', 'negative']).toContain(result.value);
    });

    it('should predict with regression model', async () => {
      service.loadModel('cost-estimator');

      const result = await service.predict(
        { cpu_cores: 4, memory_gb: 16, disk_gb: 100, duration_hours: 8 },
        'cost-estimator'
      );

      expect(result.modelId).toBe('cost-estimator');
      expect(typeof result.value).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should predict with anomaly detection model', async () => {
      service.loadModel('anomaly-detector');

      const result = await service.predict(
        { error_rate: 0.05, latency_p99: 500, cpu_usage: 80, memory_usage: 70, request_rate: 1000 },
        'anomaly-detector'
      );

      expect(result.modelId).toBe('anomaly-detector');
      expect(['anomaly', 'normal']).toContain(result.value);
    });

    it('should throw error for unloaded model', async () => {
      await expect(
        service.predict({ feature_0: 1, feature_1: 2 }, 'non-existent')
      ).rejects.toThrow('Model non-existent is not loaded');
    });

    it('should throw error for empty features', async () => {
      service.loadModel('pipeline-failure-predictor');

      await expect(
        service.predict({}, 'pipeline-failure-predictor')
      ).rejects.toThrow('Features cannot be empty');
    });

    it('should return prediction result with correct fields', async () => {
      service.loadModel('pipeline-failure-predictor');

      const result = await service.predict(
        { build_duration: 300, test_count: 50, code_changes: 10, history_failure_rate: 0.1 },
        'pipeline-failure-predictor'
      );

      expect(result.modelId).toBe('pipeline-failure-predictor');
      expect(result.predictedAt).toBeDefined();
      expect(result.inputFeatures).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== batchPredict ====================

  describe('batchPredict', () => {
    it('should batch predict successfully', async () => {
      service.loadModel('pipeline-failure-predictor');

      const featureSets = [
        { build_duration: 300, test_count: 50, code_changes: 10, history_failure_rate: 0.1 },
        { build_duration: 600, test_count: 20, code_changes: 5, history_failure_rate: 0.3 },
        { build_duration: 100, test_count: 100, code_changes: 2, history_failure_rate: 0.05 },
      ];

      const result = await service.batchPredict(featureSets, 'pipeline-failure-predictor');

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.predictions).toHaveLength(3);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle partial failures', async () => {
      service.loadModel('pipeline-failure-predictor');

      const featureSets = [
        { build_duration: 300, test_count: 50, code_changes: 10, history_failure_rate: 0.1 },
        {} as Record<string, number>, // Invalid: empty features
        { build_duration: 100, test_count: 100, code_changes: 2, history_failure_rate: 0.05 },
      ];

      const result = await service.batchPredict(featureSets, 'pipeline-failure-predictor');

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });
  });

  // ==================== getPredictionHistory ====================

  describe('getPredictionHistory', () => {
    it('should return empty array without database', async () => {
      const history = await service.getPredictionHistory('pipeline-failure-predictor');
      expect(history).toHaveLength(0);
    });

    it('should return empty array for non-existent model', async () => {
      const history = await service.getPredictionHistory('non-existent');
      expect(history).toHaveLength(0);
    });
  });

  // ==================== getModelPerformance ====================

  describe('getModelPerformance', () => {
    it('should return zero stats for model without database', async () => {
      service.loadModel('pipeline-failure-predictor');

      const perf = await service.getModelPerformance('pipeline-failure-predictor');

      expect(perf).not.toBeNull();
      expect(perf!.modelId).toBe('pipeline-failure-predictor');
      expect(perf!.totalPredictions).toBe(0);
      expect(perf!.averageConfidence).toBe(0);
      expect(perf!.minConfidence).toBe(0);
      expect(perf!.maxConfidence).toBe(0);
      expect(perf!.lastPredictionAt).toBeUndefined();
    });

    it('should return correct model name and type', async () => {
      service.loadModel('anomaly-detector');

      const perf = await service.getModelPerformance('anomaly-detector');

      expect(perf!.modelName).toBe('Deployment Anomaly Detector');
      expect(perf!.modelType).toBe('anomaly_detection');
    });

    it('should return null for non-existent model', async () => {
      const perf = await service.getModelPerformance('non-existent');
      expect(perf).toBeNull();
    });
  });

  // ==================== getPredictionConfidence ====================

  describe('getPredictionConfidence', () => {
    it('should return confidence from prediction result', async () => {
      service.loadModel('pipeline-failure-predictor');

      const prediction = await service.predict(
        { build_duration: 300, test_count: 50, code_changes: 10, history_failure_rate: 0.1 },
        'pipeline-failure-predictor'
      );

      const confidence = service.getPredictionConfidence(prediction);
      expect(confidence).toBe(prediction.confidence);
    });
  });
});
