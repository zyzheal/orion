/**
 * BuilderImage 模型测试
 */
import {
  createBuilderImage,
  updateBuilderImage,
  isImageAvailable,
  ImagePullPolicy,
  BuilderImageStatus,
  PresetImageType,
} from '../BuilderImage';

describe('BuilderImage', () => {
  describe('createBuilderImage', () => {
    it('should create image with required fields', () => {
      const img = createBuilderImage({
        name: 'node-builder',
        image: 'node:20-slim',
      });

      expect(img.id).toBeDefined();
      expect(img.name).toBe('node-builder');
      expect(img.displayName).toBe('node-builder');
      expect(img.image).toBe('node:20-slim');
      expect(img.type).toBe(PresetImageType.CUSTOM);
      expect(img.version).toBe('latest');
      expect(img.description).toBe('');
      expect(img.pullPolicy).toBe(ImagePullPolicy.IF_NOT_PRESENT);
      expect(img.status).toBe(BuilderImageStatus.ACTIVE);
      expect(img.isPreset).toBe(false);
      expect(img.createdAt).toBeInstanceOf(Date);
    });

    it('should accept custom values', () => {
      const img = createBuilderImage({
        name: 'go-builder',
        displayName: 'Go Builder',
        image: 'golang:1.22',
        type: PresetImageType.GO,
        version: '1.22',
        description: 'Go build environment',
        pullPolicy: ImagePullPolicy.ALWAYS,
        env: { GOPATH: '/go' },
        labels: { team: 'backend' },
        createdBy: 'admin',
      });

      expect(img.displayName).toBe('Go Builder');
      expect(img.type).toBe(PresetImageType.GO);
      expect(img.version).toBe('1.22');
      expect(img.pullPolicy).toBe(ImagePullPolicy.ALWAYS);
      expect(img.env).toEqual({ GOPATH: '/go' });
      expect(img.labels).toEqual({ team: 'backend' });
      expect(img.createdBy).toBe('admin');
    });
  });

  describe('updateBuilderImage', () => {
    it('should update specified fields', () => {
      const img = createBuilderImage({
        name: 'test',
        image: 'test:latest',
      });

      const updated = updateBuilderImage(img, {
        displayName: 'Updated',
        description: 'new desc',
        status: BuilderImageStatus.DEPRECATED,
      });

      expect(updated.displayName).toBe('Updated');
      expect(updated.description).toBe('new desc');
      expect(updated.status).toBe(BuilderImageStatus.DEPRECATED);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should preserve fields not in update', () => {
      const img = createBuilderImage({
        name: 'test',
        image: 'test:latest',
        type: PresetImageType.NODE,
      });

      const updated = updateBuilderImage(img, { description: 'updated' });

      expect(updated.name).toBe('test');
      expect(updated.image).toBe('test:latest');
      expect(updated.type).toBe(PresetImageType.NODE);
    });
  });

  describe('isImageAvailable', () => {
    it('should return true for active images', () => {
      const img = createBuilderImage({ name: 'test', image: 'test:latest' });
      expect(isImageAvailable(img)).toBe(true);
    });

    it('should return false for deprecated images', () => {
      const img = createBuilderImage({ name: 'test', image: 'test:latest' });
      const updated = updateBuilderImage(img, { status: BuilderImageStatus.DEPRECATED });
      expect(isImageAvailable(updated)).toBe(false);
    });

    it('should return false for disabled images', () => {
      const img = createBuilderImage({ name: 'test', image: 'test:latest' });
      const updated = updateBuilderImage(img, { status: BuilderImageStatus.DISABLED });
      expect(isImageAvailable(updated)).toBe(false);
    });
  });

  describe('enums', () => {
    it('ImagePullPolicy should have correct values', () => {
      expect(ImagePullPolicy.ALWAYS).toBe('Always');
      expect(ImagePullPolicy.IF_NOT_PRESENT).toBe('IfNotPresent');
      expect(ImagePullPolicy.NEVER).toBe('Never');
    });

    it('PresetImageType should have correct values', () => {
      expect(PresetImageType.NODE).toBe('node');
      expect(PresetImageType.PYTHON).toBe('python');
      expect(PresetImageType.GO).toBe('go');
      expect(PresetImageType.JAVA).toBe('java');
      expect(PresetImageType.DOTNET).toBe('dotnet');
      expect(PresetImageType.RUST).toBe('rust');
      expect(PresetImageType.CUSTOM).toBe('custom');
    });
  });
});
