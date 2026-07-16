/**
 * ReleaseNotesAgent Tests
 *
 * Covers:
 * - Constructor: default config, custom agentConfig
 * - generateFromCommits(): categorization, version detection, stats, markdown, AI enhancement
 * - generateFromGit(): git integration (mocked execFile)
 * - getCommits(): parsing git log output, error handling, security validation
 * - getTags(): parsing tag output, error handling
 * - getFileChanges(): parsing diff stat output
 * - Commit message parsing (Conventional Commits)
 * - Commit categorization (feat, fix, docs, perf, refactor, test, build, ci, breaking, revert)
 * - Release type detection (major, minor, patch)
 * - Markdown content generation (zh-CN, en-US)
 * - AI enhancement (success, failure fallback)
 * - Path and ref security validation
 * - Factory function createReleaseNotesAgentConfig
 */

import { ReleaseNotesAgent, createReleaseNotesAgentConfig } from '../release/ReleaseNotesAgent';
import { AgentConfig, AgentExecutionContext } from '../base/types';
import { GitCommit, ReleaseNotesOptions, ReleaseNotesAgentConfig } from '../release/types';

// Mock child_process.execFile - must preserve promisify.custom for Node.js built-in
jest.mock('child_process', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { custom } = require('util').promisify;
  const mockExecFile = jest.fn((cmd: string, args: string[], options: any, cb: Function) => {
    cb(null, '', '');
  });
  // Node.js execFile has a custom promisify that returns {stdout, stderr}
  (mockExecFile as any)[custom] = (cmd: string, args: string[], options: any) => {
    return new Promise((resolve, reject) => {
      mockExecFile(cmd, args, options, (err: any, stdout: string, stderr: string) => {
        if (err) reject(err);
        else resolve({ stdout, stderr });
      });
    });
  };
  return { execFile: mockExecFile };
});

// Mock fs.realpathSync
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  realpathSync: jest.fn((p: string) => p),
}));

const { execFile } = require('child_process');

// -- Mock Factories --

function createMockAIGateway(overrides: Record<string, unknown> = {}) {
  return {
    execute: jest.fn().mockResolvedValue({ success: true, data: 'AI enhanced summary' }),
    health: jest.fn().mockResolvedValue({ status: 'healthy' }),
    ...overrides,
  } as any;
}

function createMockToolAdapter(overrides: Record<string, unknown> = {}) {
  return {
    executeTool: jest.fn().mockResolvedValue({ success: true, data: {} }),
    getToolNames: jest.fn().mockReturnValue(['git']),
    registerTool: jest.fn(),
    ...overrides,
  } as any;
}

function createDefaultConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'release-notes-agent',
    name: 'Release Notes Agent',
    enabled: true,
    scenario: 'release_notes',
    provider: 'sonnet',
    maxConcurrency: 3,
    timeoutMs: 60000,
    retry: { maxRetries: 0, backoffMs: 100 },
    requiredTools: ['git'],
    requiredPermissions: ['read:repository'],
    ...overrides,
  };
}

function createContext(overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext {
  return {
    traceId: 'trace-release-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    ...overrides,
  };
}

function createCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  return {
    hash: 'abc1234567890',
    shortHash: 'abc1234',
    message: 'feat: add new feature',
    author: 'Test Author',
    authorEmail: 'test@example.com',
    date: '2026-06-01T10:00:00Z',
    ...overrides,
  };
}

// Helper to set up execFile mock for git commands
function mockExecFileFor(stdout: string, stderr?: string): void;
function mockExecFileFor(error: Error): void;
function mockExecFileFor(stdoutOrError: string | Error, stderr: string = ''): void {
  if (stdoutOrError instanceof Error) {
    execFile.mockImplementation(
      (cmd: string, args: string[], opts: any, cb: Function) => {
        cb(stdoutOrError, null, null);
      }
    );
  } else {
    execFile.mockImplementation(
      (cmd: string, args: string[], opts: any, cb: Function) => {
        cb(null, stdoutOrError, stderr);
      }
    );
  }
}

function mockExecFileMulti(responses: Array<{ match: string; stdout: string } | { match: string; error: Error }>) {
  execFile.mockImplementation(
    (cmd: string, args: string[], opts: any, cb: Function) => {
      const argsStr = args.join(' ');
      for (const resp of responses) {
        if (argsStr.includes(resp.match)) {
          if ('error' in resp) {
            cb(resp.error, null, null);
          } else {
            cb(null, resp.stdout, '');
          }
          return;
        }
      }
      // Default: empty success
      cb(null, '', '');
    }
  );
}

// -- Tests --

describe('ReleaseNotesAgent', () => {
  let agent: ReleaseNotesAgent;
  let mockGateway: any;
  let mockToolAdapter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGateway = createMockAIGateway();
    mockToolAdapter = createMockToolAdapter();
    agent = new ReleaseNotesAgent(createDefaultConfig(), mockGateway, mockToolAdapter);
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create agent with default agentConfig', () => {
      expect(agent).toBeDefined();
      expect(agent.isEnabled()).toBe(true);
    });

    it('should accept custom agentConfig', () => {
      const customConfig: ReleaseNotesAgentConfig = {
        enableAIEnhancement: false,
        defaultLanguage: 'en-US',
        includeFileDetails: true,
        autoDetectVersionType: false,
      };
      const customAgent = new ReleaseNotesAgent(
        createDefaultConfig(),
        mockGateway,
        mockToolAdapter,
        customConfig
      );
      expect(customAgent).toBeDefined();
    });
  });

  // ==================== generateFromCommits ====================

  describe('generateFromCommits', () => {
    it('should generate release notes from commits', async () => {
      const commits = [
        createCommit({ message: 'feat: add user authentication' }),
        createCommit({ message: 'fix: resolve login bug', hash: 'def456', shortHash: 'def4567' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.content).toBeTruthy();
      expect(result.changes).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.commits).toEqual(commits);
      expect(result.generatedAt).toBeTruthy();
    });

    it('should categorize feat commits to features', async () => {
      const commits = [
        createCommit({ message: 'feat(auth): add OAuth2 support' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.features.length).toBe(1);
      expect(result.changes.features[0].scope).toBe('auth');
      expect(result.changes.features[0].description).toContain('OAuth2');
    });

    it('should categorize fix commits to fixes', async () => {
      const commits = [
        createCommit({ message: 'fix(api): handle null response' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.fixes.length).toBe(1);
    });

    it('should categorize docs commits to documentation', async () => {
      const commits = [
        createCommit({ message: 'docs: update README' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.documentation.length).toBe(1);
    });

    it('should categorize perf commits to performance', async () => {
      const commits = [
        createCommit({ message: 'perf: optimize database queries' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.performance.length).toBe(1);
    });

    it('should categorize refactor commits to refactoring', async () => {
      const commits = [
        createCommit({ message: 'refactor: extract service layer' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.refactoring.length).toBe(1);
    });

    it('should categorize test commits to tests', async () => {
      const commits = [
        createCommit({ message: 'test: add unit tests for auth' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.tests.length).toBe(1);
    });

    it('should categorize build commits to build', async () => {
      const commits = [
        createCommit({ message: 'build: update webpack config' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.build.length).toBe(1);
    });

    it('should categorize ci commits to build', async () => {
      const commits = [
        createCommit({ message: 'ci: add GitHub Actions workflow' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.build.length).toBe(1);
    });

    it('should categorize breaking commits to breaking', async () => {
      const commits = [
        createCommit({ message: 'breaking: remove deprecated API' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.breaking.length).toBe(1);
    });

    it('should detect BREAKING CHANGE in message', async () => {
      const commits = [
        createCommit({ message: 'feat: change API format\n\nBREAKING CHANGE: response format changed' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.breaking.length).toBe(1);
    });

    it('should categorize revert commits to other', async () => {
      const commits = [
        createCommit({ message: 'revert: undo last change' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.other.length).toBe(1);
    });

    it('should categorize unknown types to other', async () => {
      const commits = [
        createCommit({ message: 'chore: cleanup dependencies' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.other.length).toBe(1);
    });

    it('should categorize non-conventional commits to other', async () => {
      const commits = [
        createCommit({ message: 'just a regular commit message' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.changes.other.length).toBe(1);
    });

    it('should handle empty commits array', async () => {
      const result = await agent.generateFromCommits([]);

      expect(result.changes.features.length).toBe(0);
      expect(result.changes.fixes.length).toBe(0);
      expect(result.stats.totalCommits).toBe(0);
      expect(result.stats.contributorsCount).toBe(0);
    });
  });

  // ==================== Version Detection ====================

  describe('version detection', () => {
    it('should detect major version for breaking changes', async () => {
      const commits = [
        createCommit({ message: 'feat!: redesign API\n\nBREAKING CHANGE: all endpoints changed' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.version.releaseType).toBe('major');
      expect(result.version.hasBreakingChanges).toBe(true);
    });

    it('should detect major version for BREAKING CHANGE keyword', async () => {
      const commits = [
        createCommit({ message: 'feat: new feature\n\nBREAKING CHANGE: breaking stuff' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.version.releaseType).toBe('major');
    });

    it('should detect minor version for feat commits', async () => {
      const commits = [
        createCommit({ message: 'feat: add new feature' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.version.releaseType).toBe('minor');
    });

    it('should detect patch version for fix commits', async () => {
      const commits = [
        createCommit({ message: 'fix: bug fix' }),
      ];

      const result = await agent.generateFromCommits(commits);
      expect(result.version.releaseType).toBe('patch');
    });

    it('should default to patch when autoDetectVersionType is false', async () => {
      const customAgent = new ReleaseNotesAgent(
        createDefaultConfig(),
        mockGateway,
        mockToolAdapter,
        { enableAIEnhancement: false, defaultLanguage: 'zh-CN', includeFileDetails: false, autoDetectVersionType: false }
      );

      const commits = [
        createCommit({ message: 'feat: new feature' }),
      ];

      const result = await customAgent.generateFromCommits(commits);
      expect(result.version.releaseType).toBe('patch');
    });

    it('should use options.to as version number', async () => {
      const result = await agent.generateFromCommits(
        [createCommit()],
        { to: 'v2.0.0', from: 'v1.0.0' }
      );

      expect(result.version.version).toBe('v2.0.0');
      expect(result.version.previousVersion).toBe('v1.0.0');
    });
  });

  // ==================== Stats ====================

  describe('stats', () => {
    it('should calculate correct stats', async () => {
      const commits = [
        createCommit({ message: 'feat: feature 1', authorEmail: 'a@test.com' }),
        createCommit({ message: 'feat: feature 2', authorEmail: 'a@test.com' }),
        createCommit({ message: 'fix: bug 1', authorEmail: 'b@test.com' }),
        createCommit({ message: 'docs: update', authorEmail: 'c@test.com' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.stats.totalCommits).toBe(4);
      expect(result.stats.featuresCount).toBe(2);
      expect(result.stats.fixesCount).toBe(1);
      expect(result.stats.docsCount).toBe(1);
      expect(result.stats.contributorsCount).toBe(3);
    });
  });

  // ==================== Markdown Content ====================

  describe('markdown content', () => {
    it('should generate Chinese markdown by default', async () => {
      const commits = [
        createCommit({ message: 'feat: new feature' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('版本');
      expect(result.content).toContain('发布说明');
      expect(result.content).toContain('新功能');
    });

    it('should generate English markdown when language is en-US', async () => {
      const commits = [
        createCommit({ message: 'feat: new feature' }),
      ];

      const result = await agent.generateFromCommits(commits, { language: 'en-US' });

      expect(result.content).toContain('Release');
      expect(result.content).toContain('New Features');
    });

    it('should include breaking changes section', async () => {
      const commits = [
        createCommit({ message: 'feat!: breaking change' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('破坏性变更');
    });

    it('should include bug fixes section', async () => {
      const commits = [
        createCommit({ message: 'fix: bug fix' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('Bug 修复');
    });

    it('should include performance section', async () => {
      const commits = [
        createCommit({ message: 'perf: optimize' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('性能优化');
    });

    it('should include refactoring section', async () => {
      const commits = [
        createCommit({ message: 'refactor: cleanup' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('代码重构');
    });

    it('should include documentation section', async () => {
      const commits = [
        createCommit({ message: 'docs: update' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('文档更新');
    });

    it('should include tests section', async () => {
      const commits = [
        createCommit({ message: 'test: add tests' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('测试');
    });

    it('should include build section', async () => {
      const commits = [
        createCommit({ message: 'ci: add pipeline' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('构建与 CI');
    });

    it('should include statistics section', async () => {
      const commits = [
        createCommit({ message: 'feat: feature' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('统计信息');
      expect(result.content).toContain('总提交数');
    });

    it('should include scope in feature descriptions', async () => {
      const commits = [
        createCommit({ message: 'feat(api): add endpoint' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.content).toContain('**api**');
    });
  });

  // ==================== AI Enhancement ====================

  describe('AI enhancement', () => {
    it('should enhance with AI summary when enabled', async () => {
      const commits = [
        createCommit({ message: 'feat: new feature' }),
      ];

      const result = await agent.generateFromCommits(commits);

      expect(result.aiSummary).toBeTruthy();
      expect(result.content).toContain('AI enhanced summary');
    });

    it('should not enhance when enableAIEnhancement is false', async () => {
      const customAgent = new ReleaseNotesAgent(
        createDefaultConfig(),
        mockGateway,
        mockToolAdapter,
        { enableAIEnhancement: false, defaultLanguage: 'zh-CN', includeFileDetails: false, autoDetectVersionType: true }
      );

      const result = await customAgent.generateFromCommits([createCommit()]);

      expect(result.aiSummary).toBeUndefined();
      expect(mockGateway.execute).not.toHaveBeenCalled();
    });

    it('should not enhance when options.enhanceWithAI is false', async () => {
      const result = await agent.generateFromCommits([createCommit()], { enhanceWithAI: false });

      expect(result.aiSummary).toBeUndefined();
    });

    it('should continue without AI summary when AI fails', async () => {
      mockGateway.execute.mockResolvedValue({ success: false, error: 'AI unavailable' });

      const result = await agent.generateFromCommits([createCommit()]);

      expect(result.content).toBeTruthy();
    });

    it('should continue when AI throws an error', async () => {
      mockGateway.execute.mockRejectedValue(new Error('Network error'));

      const result = await agent.generateFromCommits([createCommit()]);

      expect(result.content).toBeTruthy();
    });

    it('should use Chinese prompt for zh-CN', async () => {
      await agent.generateFromCommits([createCommit()], { language: 'zh-CN' });

      const callArgs = mockGateway.execute.mock.calls[0][0];
      expect(callArgs.input.prompt).toContain('中文');
    });

    it('should use English prompt for en-US', async () => {
      await agent.generateFromCommits([createCommit()], { language: 'en-US' });

      const callArgs = mockGateway.execute.mock.calls[0][0];
      expect(callArgs.input.prompt).toContain('English');
    });
  });

  // ==================== getCommits (Git Integration) ====================

  describe('getCommits', () => {
    it('should parse git log output into commits', async () => {
      const gitOutput = 'abc123|Author1|a@test.com|2026-06-01T10:00:00Z|feat: add feature\ndef456|Author2|b@test.com|2026-06-01T11:00:00Z|fix: fix bug';
      mockExecFileFor(gitOutput);

      const commits = await agent.getCommits('/tmp/test-repo', 'v1.0.0', 'v2.0.0');

      expect(commits.length).toBe(2);
      expect(commits[0].hash).toBe('abc123');
      expect(commits[0].author).toBe('Author1');
      expect(commits[0].message).toBe('feat: add feature');
      expect(commits[1].hash).toBe('def456');
    });

    it('should return empty array when no commits found', async () => {
      mockExecFileFor('');

      const commits = await agent.getCommits('/tmp/test-repo', 'v1.0.0', 'v1.0.0');
      expect(commits).toEqual([]);
    });

    it('should handle git command failure', async () => {
      mockExecFileFor(new Error('git not found'));

      await expect(
        agent.getCommits('/tmp/test-repo', 'v1.0.0', 'v2.0.0')
      ).rejects.toThrow('Failed to get commits');
    });

    it('should handle pipe characters in commit messages', async () => {
      const gitOutput = 'abc123|Author1|a@test.com|2026-06-01T10:00:00Z|feat: add | separator';
      mockExecFileFor(gitOutput);

      const commits = await agent.getCommits('/tmp/test-repo', 'v1.0.0', 'v2.0.0');

      expect(commits[0].message).toBe('feat: add | separator');
    });
  });

  // ==================== getTags ====================

  describe('getTags', () => {
    it('should parse tag information', async () => {
      const tagOutput = '(HEAD -> main, tag: v2.0.0, origin/main)|Release v2.0.0|2026-06-01 10:00:00 +0000|abc123';
      mockExecFileFor(tagOutput);

      const tags = await agent.getTags('/tmp/test-repo', 'v2.0.0');

      expect(tags.length).toBe(1);
      expect(tags[0].name).toBe('v2.0.0');
      expect(tags[0].commit).toBe('abc123');
    });

    it('should return empty array when no tags', async () => {
      mockExecFileFor('');

      const tags = await agent.getTags('/tmp/test-repo');
      expect(tags).toEqual([]);
    });

    it('should handle tag fetch error gracefully', async () => {
      mockExecFileFor(new Error('git error'));

      const tags = await agent.getTags('/tmp/test-repo');
      expect(tags).toEqual([]);
    });

    it('should handle multiple tags', async () => {
      const tagOutput = '(tag: v2.0.0, tag: latest)|Release|2026-06-01|abc123';
      mockExecFileFor(tagOutput);

      const tags = await agent.getTags('/tmp/test-repo');
      expect(tags.length).toBe(2);
      expect(tags[0].name).toBe('v2.0.0');
      expect(tags[1].name).toBe('latest');
    });
  });

  // ==================== getFileChanges ====================

  describe('getFileChanges', () => {
    it('should parse git diff stat output', async () => {
      const diffOutput = ' src/file1.ts | 10 ++++------\n src/file2.ts |  5 ++---\n 2 files changed, 7 insertions(+), 8 deletions(-)';
      mockExecFileFor(diffOutput);

      const diffs = await agent.getFileChanges('/tmp/test-repo', 'v1.0.0', 'v2.0.0');

      expect(diffs.length).toBe(2);
      expect(diffs[0].file).toBe('src/file1.ts');
      expect(diffs[0].status).toBe('modified');
    });

    it('should detect added files', async () => {
      const diffOutput = ' new-file.ts | 5 +++++';
      mockExecFileFor(diffOutput);

      const diffs = await agent.getFileChanges('/tmp/test-repo', 'v1.0.0', 'v2.0.0');

      expect(diffs.length).toBe(1);
      expect(diffs[0].status).toBe('added');
    });

    it('should detect deleted files', async () => {
      const diffOutput = ' old-file.ts | 3 ---';
      mockExecFileFor(diffOutput);

      const diffs = await agent.getFileChanges('/tmp/test-repo', 'v1.0.0', 'v2.0.0');

      expect(diffs.length).toBe(1);
      expect(diffs[0].status).toBe('deleted');
    });

    it('should return empty array on error', async () => {
      mockExecFileFor(new Error('git error'));

      const diffs = await agent.getFileChanges('/tmp/test-repo', 'v1.0.0', 'v2.0.0');
      expect(diffs).toEqual([]);
    });

    it('should return empty array for empty output', async () => {
      mockExecFileFor('');

      const diffs = await agent.getFileChanges('/tmp/test-repo', 'v1.0.0', 'v2.0.0');
      expect(diffs).toEqual([]);
    });
  });

  // ==================== generateFromGit ====================

  describe('generateFromGit', () => {
    it('should generate release notes from git repository', async () => {
      mockExecFileMulti([
        { match: '--format', stdout: 'abc123|Author|a@test.com|2026-06-01|feat: new feature' },
        { match: '--decorate', stdout: '(tag: v2.0.0)|Release|2026-06-01|abc123' },
      ]);

      const options: ReleaseNotesOptions = {
        repoPath: '/tmp/test-repo',
        from: 'v1.0.0',
        to: 'v2.0.0',
      };

      const result = await agent.generateFromGit(options);

      expect(result).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.content).toBeTruthy();
    });

    it('should include file changes when option is set', async () => {
      mockExecFileMulti([
        { match: '--format', stdout: 'abc123|Author|a@test.com|2026-06-01|feat: feature' },
        { match: '--decorate', stdout: '(tag: v2.0.0)|Release|2026-06-01|abc123' },
        { match: '--stat', stdout: ' file.ts | 10 ++++---\n' },
      ]);

      const options: ReleaseNotesOptions = {
        repoPath: '/tmp/test-repo',
        from: 'v1.0.0',
        to: 'v2.0.0',
        includeFileChanges: true,
      };

      const result = await agent.generateFromGit(options);
      expect(result).toBeDefined();
    });
  });

  // ==================== doExecute ====================

  describe('doExecute', () => {
    it('should validate context before execution', async () => {
      mockExecFileFor('');

      await expect(
        agent.execute(
          { repoPath: '/tmp/test-repo', from: 'v1', to: 'v2' } as ReleaseNotesOptions,
          createContext({ traceId: undefined })
        )
      ).rejects.toThrow('Missing required field: traceId');
    });
  });

  // ==================== Security Validation ====================

  describe('security validation', () => {
    it('should reject empty repo path', async () => {
      await expect(
        agent.getCommits('', 'v1', 'v2')
      ).rejects.toThrow('must not be empty');
    });

    it('should reject repo path that is too long', async () => {
      const longPath = '/tmp/' + 'a'.repeat(2000);
      await expect(
        agent.getCommits(longPath, 'v1', 'v2')
      ).rejects.toThrow('too long');
    });

    it('should reject empty git ref', async () => {
      await expect(
        agent.getCommits('/tmp/test-repo', '', 'v2')
      ).rejects.toThrow('must not be empty');
    });

    it('should reject git ref that starts with dash', async () => {
      await expect(
        agent.getCommits('/tmp/test-repo', '-v1', 'v2')
      ).rejects.toThrow('must not start with');
    });

    it('should reject git ref with disallowed characters', async () => {
      await expect(
        agent.getCommits('/tmp/test-repo', 'v1; rm -rf /', 'v2')
      ).rejects.toThrow('disallowed characters');
    });

    it('should reject git ref that is too long', async () => {
      const longRef = 'a'.repeat(300);
      await expect(
        agent.getCommits('/tmp/test-repo', longRef, 'v2')
      ).rejects.toThrow('too long');
    });
  });

  // ==================== Factory Function ====================

  describe('createReleaseNotesAgentConfig', () => {
    it('should return a valid agent config', () => {
      const config = createReleaseNotesAgentConfig();

      expect(config.id).toBe('release-notes-agent');
      expect(config.name).toBe('Release Notes Generator');
      expect(config.enabled).toBe(true);
      expect(config.scenario).toBe('release_notes');
      expect(config.provider).toBe('sonnet');
      expect(config.maxConcurrency).toBe(3);
      expect(config.timeoutMs).toBe(60000);
      expect(config.retry.maxRetries).toBe(2);
      expect(config.retry.backoffMs).toBe(1000);
      expect(config.requiredTools).toContain('git');
      expect(config.requiredPermissions).toContain('read:repository');
    });
  });
});
