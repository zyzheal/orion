import type { ExecException } from 'child_process';
import { ReleaseNotesService } from '../ReleaseNotesService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cp = require('child_process');

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

const mockExec = cp.exec as jest.Mock;

describe('ReleaseNotesService', () => {
  let service: ReleaseNotesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReleaseNotesService();
  });

  describe('parseCommits', () => {
    it('parses git log output into CommitEntry array', () => {
      const rawLog =
        'abc1234|feat(auth): add OAuth2 support|John Doe|2026-05-15\n' +
        'def5678|fix(api): resolve null pointer in handler|Jane Smith|2026-05-14';

      const commits = service.parseCommits(rawLog);

      expect(commits).toHaveLength(2);
      expect(commits[0]).toEqual({
        hash: 'abc1234',
        subject: 'feat(auth): add OAuth2 support',
        author: 'John Doe',
        date: '2026-05-15',
        type: 'feat',
        description: 'add OAuth2 support',
      });
      expect(commits[1]).toEqual({
        hash: 'def5678',
        subject: 'fix(api): resolve null pointer in handler',
        author: 'Jane Smith',
        date: '2026-05-14',
        type: 'fix',
        description: 'resolve null pointer in handler',
      });
    });

    it('returns empty array for empty input', () => {
      expect(service.parseCommits('')).toEqual([]);
      expect(service.parseCommits('   ')).toEqual([]);
    });

    it('categorizes non-conventional commits as "other"', () => {
      const rawLog = 'abc1234|Merge branch main into develop|Bot|2026-05-15';
      const commits = service.parseCommits(rawLog);

      expect(commits).toHaveLength(1);
      expect(commits[0].type).toBe('other');
      expect(commits[0].description).toBe('Merge branch main into develop');
    });
  });

  describe('parseSubject', () => {
    it('extracts type and description from conventional commit', () => {
      expect(service.parseSubject('feat(ui): add dark mode toggle')).toEqual({
        type: 'feat',
        description: 'add dark mode toggle',
      });
    });

    it('handles commits without scope', () => {
      expect(service.parseSubject('fix: memory leak in cache')).toEqual({
        type: 'fix',
        description: 'memory leak in cache',
      });
    });

    it('returns "other" for non-conventional commits', () => {
      expect(service.parseSubject('Initial commit')).toEqual({
        type: 'other',
        description: 'Initial commit',
      });
    });
  });

  describe('groupByType', () => {
    it('groups commits by conventional commit type', () => {
      const commits = [
        { hash: 'a1', subject: 'feat: add login', author: 'A', date: '2026-05-15', type: 'feat', description: 'add login' },
        { hash: 'b1', subject: 'fix: crash on startup', author: 'B', date: '2026-05-14', type: 'fix', description: 'crash on startup' },
        { hash: 'a2', subject: 'feat: add signup', author: 'A', date: '2026-05-13', type: 'feat', description: 'add signup' },
        { hash: 'c1', subject: 'chore: bump deps', author: 'C', date: '2026-05-12', type: 'chore', description: 'bump deps' },
      ];

      const sections = service.groupByType(commits);

      expect(sections['Features']).toHaveLength(2);
      expect(sections['Bug Fixes']).toHaveLength(1);
      expect(sections['Chores']).toHaveLength(1);
      expect(sections['Features'][0].description).toBe('add login');
    });

    it('groups unknown types under "Other Changes"', () => {
      const commits = [
        { hash: 'm1', subject: 'Merge PR #42', author: 'A', date: '2026-05-15', type: 'other', description: 'Merge PR #42' },
      ];

      const sections = service.groupByType(commits);

      expect(sections['Other Changes']).toHaveLength(1);
    });
  });

  describe('renderMarkdown', () => {
    it('renders markdown with sections ordered by priority', () => {
      const sections = {
        'Bug Fixes': [
          { hash: 'def5678', subject: 'fix: null pointer', author: 'J', date: '2026-05-14', type: 'fix', description: 'null pointer' },
        ],
        'Features': [
          { hash: 'abc1234', subject: 'feat: OAuth2', author: 'J', date: '2026-05-15', type: 'feat', description: 'OAuth2' },
        ],
      };

      const md = service.renderMarkdown(sections, 'v1.0.0', 'v1.1.0');

      // Features should come before Bug Fixes
      const featIndex = md.indexOf('## Features');
      const fixIndex = md.indexOf('## Bug Fixes');
      expect(featIndex).toBeGreaterThan(0);
      expect(fixIndex).toBeGreaterThan(featIndex);
      expect(md).toContain('# Release Notes: v1.0.0..v1.1.0');
      expect(md).toContain('`abc1234`');
      expect(md).toContain('`def5678`');
    });

    it('renders empty sections as just the header', () => {
      const md = service.renderMarkdown({}, 'v0.1.0', 'v0.2.0');
      expect(md).toBe('# Release Notes: v0.1.0..v0.2.0\n');
    });
  });

  describe('execGitLog', () => {
    it('calls git log with correct format and range', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: (err: ExecException | null, result: { stdout: string }) => void) => {
        cb(null, { stdout: 'abc123|feat: test|Author|2026-05-15\n' });
      });

      const result = await service.execGitLog('v1.0.0', 'v1.1.0', '/repo');

      expect(mockExec).toHaveBeenCalledWith(
        'git log "v1.0.0..v1.1.0" --format="%H|%s|%an|%ad" --date=short',
        { cwd: '/repo' },
        expect.any(Function),
      );
      expect(result).toBe('abc123|feat: test|Author|2026-05-15');
    });

    it('throws error when git command fails', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: (err: ExecException | null, result: unknown) => void) => {
        cb(new Error('fatal: ambiguous argument') as unknown as ExecException, null);
      });

      await expect(service.execGitLog('bad-ref', 'HEAD', '/repo'))
        .rejects.toThrow('Git log command failed: fatal: ambiguous argument');
    });
  });

  describe('generate', () => {
    it('generates full release notes from git history', async () => {
      const rawLog =
        'abc1234|feat(auth): add OAuth2 support|John|2026-05-15\n' +
        'def5678|fix(api): handle null response|Jane|2026-05-14\n' +
        'ghi9012|chore: update dependencies|Bot|2026-05-13';

      mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: (err: ExecException | null, result: { stdout: string }) => void) => {
        cb(null, { stdout: rawLog });
      });

      const notes = await service.generate({ fromRef: 'v1.0.0', toRef: 'v1.1.0', repository: '/repo' });

      expect(notes.fromRef).toBe('v1.0.0');
      expect(notes.toRef).toBe('v1.1.0');
      expect(notes.totalCommits).toBe(3);
      expect(notes.sections['Features']).toHaveLength(1);
      expect(notes.sections['Bug Fixes']).toHaveLength(1);
      expect(notes.sections['Chores']).toHaveLength(1);
      expect(notes.markdown).toContain('## Features');
      expect(notes.markdown).toContain('## Bug Fixes');
      expect(notes.markdown).toContain('## Chores');
    });

    it('defaults toRef to HEAD when not provided', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: (err: ExecException | null, result: { stdout: string }) => void) => {
        cb(null, { stdout: '' });
      });

      const notes = await service.generate({ fromRef: 'v1.0.0' });

      expect(notes.toRef).toBe('HEAD');
      expect(notes.totalCommits).toBe(0);
    });

    it('handles empty git output gracefully', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: (err: ExecException | null, result: { stdout: string }) => void) => {
        cb(null, { stdout: '' });
      });

      const notes = await service.generate({ fromRef: 'v1.0.0', toRef: 'v1.0.0' });

      expect(notes.totalCommits).toBe(0);
      expect(Object.keys(notes.sections)).toHaveLength(0);
      expect(notes.markdown).toBe('# Release Notes: v1.0.0..v1.0.0\n');
    });
  });
});
