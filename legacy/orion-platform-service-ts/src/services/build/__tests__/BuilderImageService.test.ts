/**
 * BuilderImageService 单元测试
 */

import { BuilderImageService } from '../BuilderImageService';
import {
  PresetImageType,
  BuilderImageStatus,
  ImagePullPolicy,
} from '../../../models/BuilderImage';

describe('BuilderImageService', () => {
  let service: BuilderImageService;

  beforeEach(() => {
    service = new BuilderImageService();
  });

  describe('register', () => {
    it('should register a new builder image', async () => {
      const image = await service.register({
        name: 'custom-builder',
        displayName: 'Custom Builder',
        image: 'my-registry/custom-builder:1.0',
        type: PresetImageType.NODE,
        version: '1.0',
        description: 'A custom builder image',
      });

      expect(image).toBeDefined();
      expect(image.name).toBe('custom-builder');
      expect(image.image).toBe('my-registry/custom-builder:1.0');
      expect(image.status).toBe(BuilderImageStatus.ACTIVE);
      expect(image.isPreset).toBe(false);
    });

    it('should throw error for duplicate name', async () => {
      await service.register({
        name: 'test-dup',
        image: 'test:1.0',
      });

      await expect(
        service.register({
          name: 'test-dup',
          image: 'test:2.0',
        })
      ).rejects.toThrow("Builder image 'test-dup' already exists");
    });
  });

  describe('getById', () => {
    it('should return image by ID', async () => {
      const created = await service.register({
        name: 'test-get',
        image: 'test:1.0',
      });

      const found = await service.getById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.getById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getByName', () => {
    it('should return image by name', async () => {
      const created = await service.register({
        name: 'test-by-name',
        image: 'test:1.0',
      });

      const found = await service.getByName('test-by-name');
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });
  });

  describe('list', () => {
    it('should return all images', async () => {
      const images = await service.list();
      // Should include preset images
      expect(images.length).toBeGreaterThan(0);
    });

    it('should filter by type', async () => {
      const nodeImages = await service.list({ type: PresetImageType.NODE });
      expect(nodeImages.every(img => img.type === PresetImageType.NODE)).toBe(true);
    });

    it('should filter by preset status', async () => {
      const presets = await service.list({ isPreset: true });
      expect(presets.every(img => img.isPreset === true)).toBe(true);

      await service.register({
        name: 'custom-for-filter',
        image: 'custom:1.0',
      });
      const customs = await service.list({ isPreset: false });
      expect(customs.some(img => img.name === 'custom-for-filter')).toBe(true);
    });

    it('should support pagination', async () => {
      const all = await service.list();
      const page = await service.list({ limit: 2, offset: 0 });
      expect(page.length).toBeLessThanOrEqual(2);
    });
  });

  describe('update', () => {
    it('should update image properties', async () => {
      const created = await service.register({
        name: 'test-update',
        image: 'test:1.0',
      });

      const updated = await service.update(created.id, {
        displayName: 'Updated Display',
        description: 'Updated description',
      });

      expect(updated).toBeDefined();
      expect(updated?.displayName).toBe('Updated Display');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.updatedAt).toBeDefined();
    });

    it('should return null for non-existent ID', async () => {
      const updated = await service.update('non-existent', { displayName: 'test' });
      expect(updated).toBeNull();
    });
  });

  describe('deprecate', () => {
    it('should deprecate an image', async () => {
      const created = await service.register({
        name: 'test-deprecate',
        image: 'test:1.0',
      });

      const deprecated = await service.deprecate(created.id);
      expect(deprecated).toBeDefined();
      expect(deprecated?.status).toBe(BuilderImageStatus.DEPRECATED);
    });
  });

  describe('restore', () => {
    it('should restore a deprecated image', async () => {
      const created = await service.register({
        name: 'test-restore',
        image: 'test:1.0',
      });

      await service.deprecate(created.id);
      const restored = await service.restore(created.id);

      expect(restored).toBeDefined();
      expect(restored?.status).toBe(BuilderImageStatus.ACTIVE);
    });
  });

  describe('disable', () => {
    it('should disable a custom image', async () => {
      const created = await service.register({
        name: 'test-disable',
        image: 'test:1.0',
      });

      const result = await service.disable(created.id);
      expect(result).toBe(true);

      const image = await service.getById(created.id);
      expect(image?.status).toBe(BuilderImageStatus.DISABLED);
    });

    it('should throw error for preset image', async () => {
      const presets = await service.getPresets();
      expect(presets.length).toBeGreaterThan(0);

      await expect(service.disable(presets[0].id)).rejects.toThrow(
        'Cannot disable preset images'
      );
    });
  });

  describe('getPresets', () => {
    it('should return preset images', async () => {
      const presets = await service.getPresets();
      expect(presets.length).toBeGreaterThan(0);
      expect(presets.every(img => img.isPreset === true)).toBe(true);
    });
  });

  describe('getAvailable', () => {
    it('should return only active images', async () => {
      const available = await service.getAvailable();
      expect(available.every(img => img.status === BuilderImageStatus.ACTIVE)).toBe(true);
    });
  });

  describe('getByType', () => {
    it('should return active images of specific type', async () => {
      const javaImages = await service.getByType(PresetImageType.JAVA);
      expect(javaImages.length).toBeGreaterThan(0);
      expect(javaImages.every(img =>
        img.type === PresetImageType.JAVA &&
        img.status === BuilderImageStatus.ACTIVE
      )).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete a custom image', async () => {
      const created = await service.register({
        name: 'test-delete',
        image: 'test:1.0',
      });

      const deleted = await service.delete(created.id);
      expect(deleted).toBe(true);

      const found = await service.getById(created.id);
      expect(found).toBeNull();
    });

    it('should throw error for preset image', async () => {
      const presets = await service.getPresets();
      expect(presets.length).toBeGreaterThan(0);

      await expect(service.delete(presets[0].id)).rejects.toThrow(
        'Cannot delete preset images'
      );
    });
  });
});
