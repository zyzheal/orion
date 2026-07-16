/**
 * CodeOwnershipService 单元测试
 */

import { CodeOwnershipService } from '../CodeOwnershipService';
import { CodeOwnersFile } from '../types';

/** 内存 Mock Repository */
class MockCodeOwnershipRepository {
  private files: Map<string, CodeOwnersFile> = new Map();
  private byRepo: Map<string, string> = new Map();

  async create(file: {
    id: string;
    repoId: string;
    filePath: string;
    rules: any[];
    rawContent: string;
  }): Promise<CodeOwnersFile> {
    const entry: CodeOwnersFile = {
      filePath: file.filePath,
      repoId: file.repoId,
      rules: file.rules,
      lastUpdated: new Date(),
      rawContent: file.rawContent,
    };
    this.files.set(file.id, entry);
    this.byRepo.set(file.repoId, file.id);
    return { ...entry, id: file.id };
  }

  async findByRepo(repoId: string): Promise<CodeOwnersFile | null> {
    const fileId = this.byRepo.get(repoId);
    if (!fileId) return null;
    const file = this.files.get(fileId);
    return file ? { ...file, id: fileId } : null;
  }

  async update(
    repoId: string,
    input: { filePath?: string; rules?: any[]; rawContent?: string }
  ): Promise<CodeOwnersFile | null> {
    const fileId = this.byRepo.get(repoId);
    if (!fileId) return null;
    const existing = this.files.get(fileId);
    if (!existing) return null;
    const updated: CodeOwnersFile = {
      ...existing,
      filePath: input.filePath ?? existing.filePath,
      rules: input.rules ?? existing.rules,
      rawContent: input.rawContent ?? existing.rawContent,
      lastUpdated: new Date(),
    };
    this.files.set(fileId, updated);
    return { ...updated, id: fileId };
  }

  async delete(repoId: string): Promise<boolean> {
    const fileId = this.byRepo.get(repoId);
    if (!fileId) return false;
    this.files.delete(fileId);
    this.byRepo.delete(repoId);
    return true;
  }

  clear(): void {
    this.files.clear();
    this.byRepo.clear();
  }
}

describe('CodeOwnershipService', () => {
  let service: CodeOwnershipService;
  let mockRepo: MockCodeOwnershipRepository;

  beforeEach(() => {
    mockRepo = new MockCodeOwnershipRepository();
    service = new CodeOwnershipService(mockRepo);
  });

  describe('registerCodeOwnersFile', () => {
    it('should register a CODEOWNERS file with valid content', async () => {
      const content = `
# Code ownership rules
*.js @frontend-team
/src/api/ @backend-team @api-reviewers
/docs/ @docs-team @tech-writers
      `.trim();

      const file = await service.registerCodeOwnersFile('test-repo', content);

      expect(file.repoId).toBe('test-repo');
      expect(file.rules).toHaveLength(3);
      expect(file.rules[0].pattern).toBe('*.js');
      expect(file.rules[0].owners).toEqual(['frontend-team']);
      expect(file.rules[1].pattern).toBe('/src/api/');
      expect(file.rules[1].owners).toEqual(['backend-team', 'api-reviewers']);
    });

    it('should handle @ prefix in owners', async () => {
      const content = '*.ts @typescript-team';
      const file = await service.registerCodeOwnersFile('test-repo', content);

      expect(file.rules[0].owners).toEqual(['typescript-team']);
    });

    it('should skip comments and empty lines', async () => {
      const content = `
# This is a comment
*.js @frontend

# Another comment

/src/ @backend
      `.trim();

      const file = await service.registerCodeOwnersFile('test-repo', content);
      expect(file.rules).toHaveLength(2);
    });

    it('should update existing file when re-registering', async () => {
      const content1 = '*.js @team-a';
      const file1 = await service.registerCodeOwnersFile('test-repo', content1);

      const content2 = '*.ts @team-b';
      const file2 = await service.registerCodeOwnersFile('test-repo', content2);

      expect(file2.rawContent).toBe(content2);
      expect(file2.rules).toHaveLength(1);
      expect(file2.rules[0].owners).toEqual(['team-b']);
    });

    it('should throw error for invalid content with no rules', async () => {
      const content = `
# Only comments
# No actual rules
      `.trim();

      await expect(
        service.registerCodeOwnersFile('test-repo', content)
      ).rejects.toThrow('Failed to parse CODEOWNERS file');
    });
  });

  describe('getCodeOwnersFile', () => {
    it('should return null for non-existent repo', async () => {
      const file = await service.getCodeOwnersFile('non-existent');
      expect(file).toBeNull();
    });

    it('should return file for registered repo', async () => {
      await service.registerCodeOwnersFile('test-repo', '*.js @team');
      const file = await service.getCodeOwnersFile('test-repo');
      expect(file).not.toBeNull();
    });
  });

  describe('removeCodeOwnersFile', () => {
    it('should remove a registered file', async () => {
      await service.registerCodeOwnersFile('test-repo', '*.js @team');
      const removed = await service.removeCodeOwnersFile('test-repo');
      expect(removed).toBe(true);

      const file = await service.getCodeOwnersFile('test-repo');
      expect(file).toBeNull();
    });

    it('should return false for non-existent repo', async () => {
      const removed = await service.removeCodeOwnersFile('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('validateCodeOwnersContent', () => {
    it('should validate correct content', () => {
      const content = '*.js @frontend\n/src/ @backend';
      const result = service.validateCodeOwnersContent(content);

      expect(result.success).toBe(true);
      expect(result.rules).toHaveLength(2);
      expect(result.errors).toEqual([]);
    });

    it('should warn about patterns without owners', () => {
      const content = '*.js';
      const result = service.validateCodeOwnersContent(content);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should error on invalid patterns', () => {
      const content = '*** @team';
      const result = service.validateCodeOwnersContent(content);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('recommendOwners', () => {
    beforeEach(async () => {
      const content = `
*.js @frontend-team
*.ts @backend-team
/src/api/ @api-team
/docs/ @docs-team
      `.trim();
      await service.registerCodeOwnersFile('test-repo', content);
    });

    it('should recommend owners for matched files', async () => {
      const recs = await service.recommendOwners('test-repo', ['index.js', 'main.ts']);

      expect(recs).toHaveLength(2);
      expect(recs[0].owners).toContain('frontend-team');
      expect(recs[1].owners).toContain('backend-team');
    });

    it('should return empty owners for unmatched files', async () => {
      const recs = await service.recommendOwners('test-repo', ['unknown.xyz']);

      expect(recs[0].owners).toEqual([]);
    });

    it('should return empty for repo without CODEOWNERS', async () => {
      const recs = await service.recommendOwners('no-owners-repo', ['file.js']);
      expect(recs[0].owners).toEqual([]);
    });

    it('should match path-based rules', async () => {
      const recs = await service.recommendOwners('test-repo', ['src/api/users.js']);

      // Both *.js and /src/api/ should match
      expect(recs[0].matchedPattern).toBe('/src/api/');
      expect(recs[0].owners).toContain('api-team');
    });
  });

  describe('getRequiredApproversForPR', () => {
    beforeEach(async () => {
      const content = `
*.js @frontend-team
/src/api/ @api-team
      `.trim();
      await service.registerCodeOwnersFile('test-repo', content);
    });

    it('should aggregate approvers from all changed files', async () => {
      const result = await service.getRequiredApproversForPR('test-repo', [
        { path: 'index.js', status: 'modified' },
        { path: 'src/api/users.js', status: 'modified' },
      ]);

      expect(result.requiredApprovers).toContain('frontend-team');
      expect(result.requiredApprovers).toContain('api-team');
      expect(result.ownershipMap['index.js']).toContain('frontend-team');
    });

    it('should handle files with no owners', async () => {
      const result = await service.getRequiredApproversForPR('test-repo', [
        { path: 'unknown.xyz', status: 'added' },
      ]);

      expect(result.requiredApprovers).toEqual([]);
      expect(result.ownershipMap).toEqual({});
    });
  });

  describe('pattern matching', () => {
    beforeEach(async () => {
      const content = `
# Exact file match
package.json @core-team
# Directory match
/docs/ @docs-team
# Extension match
*.ts @typescript-team
# Path with directory
/src/utils/ @utils-team
      `.trim();
      await service.registerCodeOwnersFile('test-repo', content);
    });

    it('should match exact file names', async () => {
      const recs = await service.recommendOwners('test-repo', ['package.json']);
      expect(recs[0].owners).toContain('core-team');
    });

    it('should match directory patterns', async () => {
      const recs = await service.recommendOwners('test-repo', ['docs/readme.md']);
      expect(recs[0].owners).toContain('docs-team');
    });

    it('should match extension patterns', async () => {
      const recs = await service.recommendOwners('test-repo', ['src/main.ts']);
      expect(recs[0].owners).toContain('typescript-team');
    });
  });
});
