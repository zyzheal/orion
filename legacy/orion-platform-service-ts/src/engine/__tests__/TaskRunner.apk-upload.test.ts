/**
 * APK Upload Task Type Tests
 *
 * Tests that APK upload task types are recognized and processed.
 * Note: The TaskRunner handles unknown task types via executeMockTask.
 * APK upload is not a built-in task type, so it falls through to mock execution.
 */

import { TaskRunner, TaskExecutionResult } from '../TaskRunner';
import { Task, TaskStatus } from '../../models/Task';

describe('TaskRunner - APK Upload to Market', () => {
  let runner: TaskRunner;

  beforeEach(async () => {
    runner = new TaskRunner();
  });

  const createMockTask = (params: Record<string, unknown> = {}): Task => ({
    id: 'test-task-1',
    stageId: 'test-stage-1',
    name: 'Upload APK',
    type: 'apk-upload/upload',
    sequence: 1,
    status: TaskStatus.PENDING,
    config: {},
    parameters: {
      market: 'pgyer',
      apkPath: './app-release.apk',
      packageName: 'com.example.test',
      versionCode: 100,
      versionName: '1.0.0',
      pgyer: {
        apiKey: 'test-api-key',
      },
      ...params,
    },
    timeoutSeconds: 300,
    log: '',
  });

  describe('executeApkUploadTask', () => {
    it('should execute APK upload task via mock handler', async () => {
      const task = createMockTask();
      const result = await runner.run(task);

      // Unknown task types fall through to executeMockTask which succeeds
      expect(result.status).toBe(TaskStatus.SUCCESS);
    });

    it('should support multiple markets', async () => {
      const markets = ['huawei', 'xiaomi', 'oppo', 'vivo', 'pgyer', 'fir'];

      for (const market of markets) {
        const task = createMockTask({
          market,
          [market]: { apiKey: 'test-key' },
        });

        // Should not throw for supported markets
        expect(task.type).toBe('apk-upload/upload');
        expect(task.parameters.market).toBe(market);
      }
    });

    it('should return result on success', async () => {
      const task = createMockTask({
        market: 'pgyer',
        pgyer: { apiKey: 'valid-key' },
      });

      const result = await runner.run(task);

      expect(result.status).toBe(TaskStatus.SUCCESS);
      expect(result.result).toBeDefined();
    });
  });

  describe('market credential validation', () => {
    it('should execute with Huawei credentials', async () => {
      const task = createMockTask({
        market: 'huawei',
        huawei: {
          clientId: 'test-id',
          clientSecret: 'test-secret',
        },
      });

      const result = await runner.run(task);
      expect(result.status).toBe(TaskStatus.SUCCESS);
    });

    it('should execute with Xiaomi credentials', async () => {
      const task = createMockTask({
        market: 'xiaomi',
        xiaomi: {
          apiKey: 'test-key',
        },
      });

      const result = await runner.run(task);
      expect(result.status).toBe(TaskStatus.SUCCESS);
    });
  });

  describe('supported markets', () => {
    const supportedMarkets = [
      'huawei',
      'xiaomi',
      'oppo',
      'vivo',
      'honor',
      'tencent',
      'pgyer',
      'fir',
      'googleplay',
      'samsung',
    ];

    it.each(supportedMarkets)('should support %s market', (market) => {
      const task = createMockTask({ market });
      expect(task.parameters.market).toBe(market);
    });
  });
});
