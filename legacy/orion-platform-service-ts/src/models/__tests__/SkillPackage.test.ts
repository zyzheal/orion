/**
 * SkillPackage 模型测试
 */
import {
  createSkillPackage,
  createSkillVersion,
  createSkillReview,
} from '../SkillPackage';

describe('SkillPackage', () => {
  describe('createSkillPackage', () => {
    it('should create package with defaults', () => {
      const pkg = createSkillPackage({
        name: 'test-runner',
        version: '1.0.0',
        description: 'Run tests automatically',
        category: 'testing',
        author: 'platform-team',
      });

      expect(pkg.id).toBeDefined();
      expect(pkg.name).toBe('test-runner');
      expect(pkg.version).toBe('1.0.0');
      expect(pkg.description).toBe('Run tests automatically');
      expect(pkg.category).toBe('testing');
      expect(pkg.tags).toEqual([]);
      expect(pkg.author).toBe('platform-team');
      expect(pkg.status).toBe('draft');
      expect(pkg.schema).toEqual({});
      expect(pkg.installCount).toBe(0);
      expect(pkg.rating).toBe(0);
      expect(pkg.ratingCount).toBe(0);
      expect(pkg.createdAt).toBeInstanceOf(Date);
      expect(pkg.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const pkg = createSkillPackage({
        name: 'p1',
        version: '1.0',
        description: 'desc',
        category: 'ai-ml',
        author: 'user1',
        tags: ['ml', 'auto'],
        schema: { input: 'string' },
      });

      expect(pkg.tags).toEqual(['ml', 'auto']);
      expect(pkg.schema).toEqual({ input: 'string' });
    });
  });

  describe('createSkillVersion', () => {
    it('should create version with defaults', () => {
      const version = createSkillVersion({
        skillId: 'skill-1',
        version: '1.1.0',
      });

      expect(version.id).toBeDefined();
      expect(version.skillId).toBe('skill-1');
      expect(version.version).toBe('1.1.0');
      expect(version.schema).toEqual({});
      expect(version.isLatest).toBe(true);
      expect(version.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const version = createSkillVersion({
        skillId: 's1',
        version: '2.0.0',
        changelog: 'Breaking changes',
        schema: { config: 'object' },
      });

      expect(version.changelog).toBe('Breaking changes');
      expect(version.schema).toEqual({ config: 'object' });
    });
  });

  describe('createSkillReview', () => {
    it('should create review', () => {
      const review = createSkillReview({
        skillId: 'skill-1',
        userId: 'user-1',
        rating: 4,
      });

      expect(review.id).toBeDefined();
      expect(review.skillId).toBe('skill-1');
      expect(review.userId).toBe('user-1');
      expect(review.rating).toBe(4);
      expect(review.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional comment', () => {
      const review = createSkillReview({
        skillId: 's1',
        userId: 'u1',
        rating: 5,
        comment: 'Excellent skill!',
      });

      expect(review.comment).toBe('Excellent skill!');
    });
  });
});
