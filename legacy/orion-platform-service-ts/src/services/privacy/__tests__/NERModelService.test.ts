/**
 * NERModelService Tests
 */

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { NERModelService } from '../NERModelService';

describe('NERModelService', () => {
  let service: NERModelService;

  beforeAll(() => {
    // Use regex fallback mode (no actual model loading)
    service = new NERModelService();
    jest.spyOn(service, 'loadModel').mockResolvedValue();
  });

  describe('detect', () => {
    it('should detect Chinese names with regex fallback', async () => {
      const text = '用户张三提交了代码';
      const entities = await service.detect(text);

      expect(entities.length).toBeGreaterThan(0);
      expect(entities[0].type).toBe('name');
      expect(entities[0].value).toBe('张三');
    });

    it('should detect names with 姓名 pattern', async () => {
      const text = '姓名: 李四';
      const entities = await service.detect(text);

      expect(entities.length).toBeGreaterThan(0);
      expect(entities[0].type).toBe('name');
      expect(entities[0].value).toBe('李四');
    });

    it('should detect organizations', async () => {
      const text = '公司: 阿里巴巴';
      const entities = await service.detect(text);

      expect(entities.length).toBeGreaterThan(0);
      expect(entities[0].type).toBe('organization');
      expect(entities[0].value).toBe('阿里巴巴');
    });

    it('should detect locations', async () => {
      const text = '地址: 北京市朝阳区';
      const entities = await service.detect(text);

      expect(entities.length).toBeGreaterThan(0);
      expect(entities[0].type).toBe('location');
    });

    it('should return empty array for no entities', async () => {
      const text = '这是一段普通文本，没有敏感信息。';
      const entities = await service.detect(text);

      expect(entities).toEqual([]);
    });

    it('should return entities with correct positions', async () => {
      const text = '用户王五提交了任务';
      const entities = await service.detect(text);

      expect(entities[0].start).toBeGreaterThanOrEqual(0);
      expect(entities[0].end).toBeGreaterThan(entities[0].start);
      expect(entities[0].end - entities[0].start).toBe(entities[0].value.length);
    });

    it('should return entities with confidence', async () => {
      const text = '联系人: 赵六';
      const entities = await service.detect(text);

      expect(entities[0].confidence).toBeGreaterThan(0);
      expect(entities[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should deduplicate overlapping entities', async () => {
      const text = '姓名: 张三，用户名: 张三';
      const entities = await service.detect(text);

      // Should not have duplicate entries for the same person
      expect(entities.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getAccuracyScore', () => {
    it('should return fallback accuracy when model not loaded', () => {
      const accuracy = service.getAccuracyScore();
      expect(accuracy).toBe(0.75); // Regex fallback accuracy
    });
  });

  describe('isModelLoaded', () => {
    it('should return false initially (mocked)', () => {
      expect(service.isModelLoaded()).toBe(false);
    });
  });

  describe('getSupportedTypes', () => {
    it('should return list of supported entity types', () => {
      const types = service.getSupportedTypes();
      expect(types).toContain('name');
      expect(types).toContain('organization');
      expect(types).toContain('location');
      expect(types).toContain('email');
      expect(types).toContain('phone');
      expect(types).toContain('id_card');
    });
  });

  describe('loadModel', () => {
    it('should handle load failure gracefully', async () => {
      const newService = new NERModelService('invalid-model-path');
      await newService.loadModel();

      // Should not throw, should just use fallback
      expect(newService.isModelLoaded()).toBe(false);
    });

    it('should not throw on multiple load calls', async () => {
      const freshService = new NERModelService();

      // Multiple calls should not throw
      await freshService.loadModel();
      await freshService.loadModel();
      await freshService.loadModel();

      // Should complete without error
      expect(freshService.isModelLoaded()).toBe(false); // Using fallback
    });
  });
});