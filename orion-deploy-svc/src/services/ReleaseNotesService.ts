import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Mapping of Conventional Commit types to section titles */
const SECTION_MAP: Record<string, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance Improvements',
  refactor: 'Refactoring',
  docs: 'Documentation',
  style: 'Style Changes',
  test: 'Tests',
  chore: 'Chores',
  build: 'Build System',
  ci: 'CI/CD',
  revert: 'Reverts',
};

export interface CommitEntry {
  hash: string;
  subject: string;
  author: string;
  date: string;
  type: string;
  description: string;
}

export interface ReleaseNotesSections {
  [section: string]: CommitEntry[];
}

export interface ReleaseNotes {
  fromRef: string;
  toRef: string;
  repository?: string;
  totalCommits: number;
  sections: ReleaseNotesSections;
  markdown: string;
}

export interface ReleaseNotesParams {
  fromRef: string;
  toRef?: string;
  repository?: string;
}

/**
 * Service that generates release notes from git commit history.
 * Parses Conventional Commits and groups them into categorized sections.
 */
export class ReleaseNotesService {
  /**
   * Generate release notes between two git refs.
   */
  async generate(params: ReleaseNotesParams): Promise<ReleaseNotes> {
    const { fromRef, toRef = 'HEAD', repository } = params;
    const cwd = repository || process.cwd();

    const gitLog = await this.execGitLog(fromRef, toRef, cwd);
    const commits = this.parseCommits(gitLog);
    const sections = this.groupByType(commits);
    const markdown = this.renderMarkdown(sections, fromRef, toRef);

    return {
      fromRef,
      toRef,
      repository,
      totalCommits: commits.length,
      sections,
      markdown,
    };
  }

  /**
   * Execute git log and return raw output.
   */
  async execGitLog(fromRef: string, toRef: string, cwd: string): Promise<string> {
    const range = `${fromRef}..${toRef}`;
    const format = '%H|%s|%an|%ad';
    try {
      const { stdout } = await execFileAsync('git', ['log', range, `--format=${format}`, '--date=short'], { cwd });
      return (stdout as string).trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Git log command failed: ${message}`);
    }
  }

  /**
   * Parse raw git log output into CommitEntry array.
   */
  parseCommits(rawLog: string): CommitEntry[] {
    if (!rawLog || !rawLog.trim()) {
      return [];
    }

    return rawLog
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|', 4);
        const [hash, subject, author, date] = parts;
        const { type, description } = this.parseSubject(subject || '');
        return {
          hash: hash || '',
          subject: subject || '',
          author: author || '',
          date: date || '',
          type,
          description,
        };
      });
  }

  /**
   * Parse a commit subject to extract Conventional Commit type and description.
   */
  parseSubject(subject: string): { type: string; description: string } {
    // Match patterns like: feat(scope): description  or  fix: description
    const match = subject.match(/^(?<type>[a-zA-Z]+)(?:\([^)]*\))?:\s+(?<desc>.+)/);
    if (match && match.groups) {
      return {
        type: match.groups.type.toLowerCase(),
        description: match.groups.desc,
      };
    }
    return { type: 'other', description: subject };
  }

  /**
   * Group commits by their Conventional Commit type.
   */
  groupByType(commits: CommitEntry[]): ReleaseNotesSections {
    const sections: ReleaseNotesSections = {};

    for (const commit of commits) {
      const sectionName = SECTION_MAP[commit.type] || 'Other Changes';
      if (!sections[sectionName]) {
        sections[sectionName] = [];
      }
      sections[sectionName].push(commit);
    }

    return sections;
  }

  /**
   * Render release notes sections as Markdown.
   */
  renderMarkdown(sections: ReleaseNotesSections, fromRef: string, toRef: string): string {
    const lines: string[] = [];
    lines.push(`# Release Notes: ${fromRef}..${toRef}`);
    lines.push('');

    // Define section order for consistent output
    const sectionOrder = [
      'Features',
      'Bug Fixes',
      'Performance Improvements',
      'Refactoring',
      'Documentation',
      'Style Changes',
      'Tests',
      'Chores',
      'Build System',
      'CI/CD',
      'Reverts',
      'Other Changes',
    ];

    const orderedKeys = Object.keys(sections).sort((a, b) => {
      const ai = sectionOrder.indexOf(a);
      const bi = sectionOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    for (const section of orderedKeys) {
      const commits = sections[section];
      if (commits.length === 0) continue;

      lines.push(`## ${section}`);
      lines.push('');

      for (const commit of commits) {
        const shortHash = commit.hash.substring(0, 7);
        const displayDesc = commit.type !== 'other' ? commit.description : commit.subject;
        lines.push(`- ${displayDesc} (\`${shortHash}\`)`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
