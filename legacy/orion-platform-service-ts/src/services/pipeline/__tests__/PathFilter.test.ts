/**
 * PathFilter Unit Tests
 */

import { PathFilter } from '../PathFilter';

describe('PathFilter', () => {
  let filter: PathFilter;

  beforeEach(() => {
    filter = new PathFilter();
  });

  // ==================== match ====================

  describe('match', () => {
    it('should match exact path', () => {
      expect(filter.match('src/index.ts', 'src/index.ts')).toBe(true);
    });

    it('should not match different path', () => {
      expect(filter.match('src/index.ts', 'src/other.ts')).toBe(false);
    });

    it('should match * wildcard', () => {
      expect(filter.match('index.ts', '*.ts')).toBe(true);
      expect(filter.match('src/index.ts', 'src/*.ts')).toBe(true);
      expect(filter.match('src/index.ts', '*.js')).toBe(false);
    });

    it('should not match * across path separators', () => {
      expect(filter.match('src/sub/index.ts', '*.ts')).toBe(false);
    });

    it('should match ** wildcard across directories', () => {
      expect(filter.match('src/sub/deep/index.ts', '**/*.ts')).toBe(true);
      expect(filter.match('index.ts', '**/*.ts')).toBe(true);
    });

    it('should match **/pattern', () => {
      expect(filter.match('a/b/c/test.ts', '**/test.ts')).toBe(true);
      expect(filter.match('test.ts', '**/test.ts')).toBe(true);
    });

    it('should match ? wildcard for single character', () => {
      expect(filter.match('src/a.ts', 'src/?.ts')).toBe(true);
      expect(filter.match('src/ab.ts', 'src/?.ts')).toBe(false);
    });

    it('should match character class [abc]', () => {
      expect(filter.match('src/a.ts', 'src/[abc].ts')).toBe(true);
      expect(filter.match('src/d.ts', 'src/[abc].ts')).toBe(false);
    });

    it('should match character range [a-z]', () => {
      expect(filter.match('src/b.ts', 'src/[a-z].ts')).toBe(true);
      expect(filter.match('src/A.ts', 'src/[a-z].ts')).toBe(false);
    });

    it('should negate character class [!abc]', () => {
      expect(filter.match('src/d.ts', 'src/[!abc].ts')).toBe(true);
      expect(filter.match('src/a.ts', 'src/[!abc].ts')).toBe(false);
    });

    it('should handle unclosed bracket as literal', () => {
      expect(filter.match('src/[abc', 'src/[abc')).toBe(true);
    });

    it('should match brace expansion {a,b,c}', () => {
      expect(filter.match('file.ts', '*.{ts,js}')).toBe(true);
      expect(filter.match('file.js', '*.{ts,js}')).toBe(true);
      expect(filter.match('file.css', '*.{ts,js}')).toBe(false);
    });

    it('should handle unclosed brace as literal', () => {
      expect(filter.match('file{test', 'file{test')).toBe(true);
    });

    it('should escape regex special characters', () => {
      expect(filter.match('file.ts', 'file.ts')).toBe(true);
      expect(filter.match('file+ts', 'file+ts')).toBe(true);
      expect(filter.match('file(ts)', 'file(ts)')).toBe(true);
      expect(filter.match('file^ts', 'file^ts')).toBe(true);
      expect(filter.match('file$ts', 'file$ts')).toBe(true);
      expect(filter.match('file|ts', 'file|ts')).toBe(true);
    });

    it('should use regex cache for repeated patterns', () => {
      filter.match('a.ts', '*.ts');
      filter.match('b.ts', '*.ts');
      // Should not throw and should use cached regex
      expect(filter.match('c.ts', '*.ts')).toBe(true);
    });

    it('should handle brace expansion with multiple alternatives', () => {
      expect(filter.match('a.ts', '*.{ts,js,tsx}')).toBe(true);
      expect(filter.match('a.js', '*.{ts,js,tsx}')).toBe(true);
      expect(filter.match('a.tsx', '*.{ts,js,tsx}')).toBe(true);
      expect(filter.match('a.css', '*.{ts,js,tsx}')).toBe(false);
    });
  });

  // ==================== matchesAny ====================

  describe('matchesAny', () => {
    it('should return false for empty patterns', () => {
      expect(filter.matchesAny('src/a.ts', [])).toBe(false);
    });

    it('should match include pattern', () => {
      expect(filter.matchesAny('src/a.ts', ['src/*.ts'])).toBe(true);
    });

    it('should return false when no include matches', () => {
      expect(filter.matchesAny('test/a.ts', ['src/*.ts'])).toBe(false);
    });

    it('should apply negation pattern', () => {
      expect(filter.matchesAny('test/a.ts', ['**/*.ts', '!test/*'])).toBe(false);
    });

    it('should return true when include matches and negation does not', () => {
      expect(filter.matchesAny('src/a.ts', ['**/*.ts', '!test/*'])).toBe(true);
    });

    it('should default to match all when only negation patterns', () => {
      expect(filter.matchesAny('src/a.ts', ['!test/*'])).toBe(true);
      expect(filter.matchesAny('test/a.ts', ['!test/*'])).toBe(false);
    });

    it('should handle multiple negation patterns', () => {
      const patterns = ['**/*.ts', '!test/*', '!node_modules/*'];
      expect(filter.matchesAny('src/a.ts', patterns)).toBe(true);
      expect(filter.matchesAny('test/a.ts', patterns)).toBe(false);
      expect(filter.matchesAny('node_modules/a.ts', patterns)).toBe(false);
    });
  });

  // ==================== filterChanges ====================

  describe('filterChanges', () => {
    it('should filter changed paths matching patterns', () => {
      const paths = ['src/a.ts', 'src/b.js', 'test/c.ts', 'docs/readme.md'];
      const patterns = ['src/*'];

      const result = filter.filterChanges(paths, patterns);

      expect(result).toEqual(['src/a.ts', 'src/b.js']);
    });

    it('should return all paths for empty patterns', () => {
      const paths = ['src/a.ts', 'test/b.ts'];

      const result = filter.filterChanges(paths, []);

      expect(result).toEqual(paths);
    });

    it('should apply negation in filter', () => {
      const paths = ['src/a.ts', 'src/test/b.ts', 'test/c.ts'];
      const patterns = ['**/*.ts', '!src/test/*'];

      const result = filter.filterChanges(paths, patterns);

      expect(result).toEqual(['src/a.ts', 'test/c.ts']);
    });

    it('should return empty array when nothing matches', () => {
      const paths = ['docs/readme.md', 'assets/image.png'];
      const patterns = ['*.ts'];

      const result = filter.filterChanges(paths, patterns);

      expect(result).toEqual([]);
    });
  });

  // ==================== exported instance ====================

  describe('exported pathFilter instance', () => {
    it('should be available as named export', async () => {
      const { pathFilter } = await import('../PathFilter');
      expect(pathFilter).toBeInstanceOf(PathFilter);
    });
  });
});
