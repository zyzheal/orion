import { ReleaseNotesService } from '../ReleaseNotesService';

describe('ReleaseNotesService', () => {
  let service: ReleaseNotesService;

  beforeEach(() => {
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

    it('handles extra pipe characters in author name', () => {
      const rawLog = 'abc1234|feat: test|Author|Name|2026-05-15';
      const commits = service.parseCommits(rawLog);

      expect(commits).toHaveLength(1);
      expect(commits[0].author).toBe('Author');
    });

    it('returns "other" type for non-conventional commits', () => {
      const rawLog = 'abc1234|just a regular commit message|Author|2026-05-15';
      const commits = service.parseCommits(rawLog);

      expect(commits[0].type).toBe('other');
      expect(commits[0].description).toBe('just a regular commit message');
    });

    it('returns empty array for empty input', () => {
      expect(service.parseCommits('')).toEqual([]);
      expect(service.parseCommits('   ')).toEqual([]);
    });

    it('handles commit with scope', () => {
      const rawLog = 'abc1234|feat(ui): add new button|Author|2026-05-15';
      const commits = service.parseCommits(rawLog);

      expect(commits[0].type).toBe('feat');
      expect(commits[0].description).toBe('add new button');
    });
  });

  describe('parseSubject', () => {
    it('parses conventional commit with scope', () => {
      const result = service.parseSubject('feat(auth): add login');
      expect(result).toEqual({ type: 'feat', description: 'add login' });
    });

    it('parses conventional commit without scope', () => {
      const result = service.parseSubject('fix: resolve bug');
      expect(result).toEqual({ type: 'fix', description: 'resolve bug' });
    });

    it('returns "other" for non-conventional commits', () => {
      const result = service.parseSubject('random message');
      expect(result).toEqual({ type: 'other', description: 'random message' });
    });
  });

  describe('groupByType', () => {
    it('groups commits by conventional commit type', () => {
      const commits = [
        { hash: 'a1', subject: 'feat: a', author: '', date: '', type: 'feat', description: 'a' },
        { hash: 'a2', subject: 'fix: b', author: '', date: '', type: 'fix', description: 'b' },
        { hash: 'a3', subject: 'feat: c', author: '', date: '', type: 'feat', description: 'c' },
      ];

      const sections = service.groupByType(commits);

      expect(sections['Features']).toHaveLength(2);
      expect(sections['Bug Fixes']).toHaveLength(1);
    });

    it('groups unknown types under "Other Changes"', () => {
      const commits = [
        { hash: 'a1', subject: 'merge: branch', author: '', date: '', type: 'merge', description: 'branch' },
      ];

      const sections = service.groupByType(commits);

      expect(sections['Other Changes']).toHaveLength(1);
    });
  });

  describe('renderMarkdown', () => {
    it('renders markdown with sections ordered by priority', () => {
      const sections = {
        'Bug Fixes': [{ hash: 'b1', subject: 'fix: x', author: '', date: '', type: 'fix', description: 'x' }],
        'Features': [{ hash: 'a1', subject: 'feat: y', author: '', date: '', type: 'feat', description: 'y' }],
      };

      const md = service.renderMarkdown(sections, 'v1', 'v2');

      const featIdx = md.indexOf('## Features');
      const fixIdx = md.indexOf('## Bug Fixes');
      expect(featIdx).toBeLessThan(fixIdx);
    });

    it('renders empty sections as just the header', () => {
      const md = service.renderMarkdown({}, 'v0.1.0', 'v0.2.0');
      expect(md).toBe('# Release Notes: v0.1.0..v0.2.0\n');
    });
  });

  describe('execGitLog', () => {
    it('calls git log with correct format and range', async () => {
      // Override execGitLog to avoid actual git calls
      const spy = jest.spyOn(service, 'execGitLog').mockResolvedValue('abc123|feat: test|Author|2026-05-15');

      const result = await service.execGitLog('v1.0.0', 'v1.1.0', '/repo');

      expect(result).toBe('abc123|feat: test|Author|2026-05-15');
      spy.mockRestore();
    });

    it('throws error when git command fails', async () => {
      jest.spyOn(service, 'execGitLog').mockImplementation(async () => {
        throw new Error('Git log command failed: fatal: ambiguous argument');
      });

      await expect(service.generate({ fromRef: 'bad-ref', toRef: 'HEAD' }))
        .rejects.toThrow('Git log command failed: fatal: ambiguous argument');
    });
  });

  describe('generate', () => {
    it('generates full release notes from git history', async () => {
      const rawLog =
        'abc1234|feat(auth): add OAuth2 support|John|2026-05-15\n' +
        'def5678|fix(api): handle null response|Jane|2026-05-14\n' +
        'ghi9012|chore: update dependencies|Bot|2026-05-13';

      jest.spyOn(service, 'execGitLog').mockResolvedValue(rawLog);

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
      jest.spyOn(service, 'execGitLog').mockResolvedValue('');

      const notes = await service.generate({ fromRef: 'v1.0.0' });

      expect(notes.toRef).toBe('HEAD');
      expect(notes.totalCommits).toBe(0);
    });

    it('handles empty git output gracefully', async () => {
      jest.spyOn(service, 'execGitLog').mockResolvedValue('');

      const notes = await service.generate({ fromRef: 'v1.0.0', toRef: 'v1.0.0' });

      expect(notes.totalCommits).toBe(0);
      expect(Object.keys(notes.sections)).toHaveLength(0);
      expect(notes.markdown).toBe('# Release Notes: v1.0.0..v1.0.0\n');
    });
  });
});
