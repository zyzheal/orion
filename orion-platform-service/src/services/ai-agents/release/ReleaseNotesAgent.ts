/**
 * Release Notes Agent - 版本发布说明生成 Agent
 *
 * 职责：
 * 1. 从 Git 提交历史获取变更信息
 * 2. 解析提交信息，分类变更类型
 * 3. 生成结构化的 Release Notes
 * 4. 可选地使用 AI 增强描述
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve, isAbsolute } from 'path';
import { realpathSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

import { BaseAgent } from '../base/BaseAgent';
import { AgentConfig, AgentExecutionContext } from '../base/types';
import { AIGateway } from '../../ai/AIGateway';
import { ToolAdapter } from '../base/ToolAdapter';
import {
  GitCommit,
  VersionInfo,
  ReleaseNotesOptions,
  ReleaseNotesResult,
  ReleaseChanges,
  ChangeItem,
  ReleaseNotesStats,
  GitDiff,
  GitTag,
  CommitType,
  ReleaseNotesAgentConfig,
} from './types';
import { OrionError, ErrorCode } from '../../../../errors';

const execFileAsync = promisify(execFile);
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 允许的仓库根目录白名单
 * 防止路径穿越和符号链接攻击
 */
const ALLOWED_REPO_ROOTS = [
  '/tmp',
  '/data/repos',
  '/home',
  process.cwd(),
].filter(Boolean).map(p => resolve(p));

/**
 * 验证 repoPath 是否安全，防止命令注入和路径穿越
 */
function validateRepoPath(repoPath: string): string {
  if (!repoPath || repoPath.trim().length === 0) {
    throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid repository path: must not be empty');
  }

  // 路径长度限制
  if (repoPath.length > 1024) {
    throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid repository path: too long');
  }

  const resolved = resolve(repoPath);

  // 解析符号链接，获取真实路径
  let realPath: string;
  try {
    realPath = realpathSync(resolved);
  } catch {
    throw new Error(`Invalid repository path: path does not exist or is not accessible`);
  }

  // 白名单校验：真实路径必须在允许的根目录下
  const isAllowed = ALLOWED_REPO_ROOTS.some(root => realPath.startsWith(root));
  if (!isAllowed) {
    logger.warn({ realPath, allowedRoots: ALLOWED_REPO_ROOTS }, 'Repository path not in allowed roots');
    throw new Error(`Invalid repository path: not within allowed directories`);
  }

  return realPath;
}

/**
 * 验证 git ref 名称是否安全，防止参数注入
 */
function validateGitRef(ref: string): string {
  if (!ref || ref.trim().length === 0) {
    throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid git ref: must not be empty');
  }
  if (ref.length > 256) {
    throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid git ref: too long (max 256 chars)');
  }
  // ref 不能以 - 开头，防止被解析为命令行参数
  if (ref.startsWith('-')) {
    throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid git ref: must not start with "-"');
  }
  // 只允许安全的字符
  const safeRefPattern = /^[a-zA-Z0-9_./-]+$/;
  if (!safeRefPattern.test(ref)) {
    throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid git ref: contains disallowed characters');
  }
  return ref;
}

/**
 * 解析提交信息，提取类型和范围
 */
function parseCommitMessage(message: string): { type?: CommitType; scope?: string; subject: string } {
  // Conventional Commits 格式: feat(scope): description
  const conventionalMatch = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (conventionalMatch) {
    const [, type, scope, subject] = conventionalMatch;
    return {
      type: type as CommitType,
      scope,
      subject,
    };
  }

  return { subject: message };
}

/**
 * 根据提交类型分类到对应变更组
 */
function categorizeCommit(commit: GitCommit): (keyof ReleaseChanges) {
  const { type } = parseCommitMessage(commit.message);

  if (!type) return 'other';

  switch (type) {
    case 'feat':
      return 'features';
    case 'fix':
      return 'fixes';
    case 'docs':
      return 'documentation';
    case 'perf':
      return 'performance';
    case 'refactor':
      return 'refactoring';
    case 'test':
      return 'tests';
    case 'build':
    case 'ci':
      return 'build';
    case 'breaking':
      return 'breaking';
    case 'revert':
      return 'other';
    default:
      return 'other';
  }
}

/**
 * Release Notes Agent
 *
 * 从 Git 提交历史生成版本发布说明
 */
export class ReleaseNotesAgent extends BaseAgent {
  private agentConfig: ReleaseNotesAgentConfig;

  constructor(
    config: AgentConfig,
    aiGateway: AIGateway,
    toolAdapter: ToolAdapter,
    agentConfig?: ReleaseNotesAgentConfig
  ) {
    super(config, aiGateway, toolAdapter);
    this.agentConfig = agentConfig ?? {
      enableAIEnhancement: true,
      defaultLanguage: 'zh-CN',
      includeFileDetails: false,
      autoDetectVersionType: true,
    };
  }

  /**
   * 从提交列表生成 Release Notes
   *
   * @param commits Git 提交列表
   * @param options 生成选项
   * @returns Release Notes 结果
   */
  async generateFromCommits(
    commits: GitCommit[],
    options?: Partial<ReleaseNotesOptions>
  ): Promise<ReleaseNotesResult> {
    const startTime = Date.now();
    const language = options?.language ?? this.agentConfig.defaultLanguage;

    logger.info({
      msg: 'Generating release notes from commits',
      commitsCount: commits.length,
      language,
    });

    // 1. 分类变更
    const changes = this.categorizeChanges(commits);

    // 2. 生成版本信息
    const version: VersionInfo = {
      version: options?.to ?? '0.0.0',
      releaseType: this.detectReleaseType(commits),
      releaseDate: new Date().toISOString(),
      previousVersion: options?.from,
      hasBreakingChanges: changes.breaking.length > 0,
    };

    // 3. 统计信息
    const stats = this.calculateStats(commits, changes);

    // 4. 构建 Release Notes 内容
    let content = this.buildMarkdownContent(version, changes, stats, language);

    // 5. 可选：AI 增强
    let aiSummary: string | undefined;
    if (this.agentConfig.enableAIEnhancement && options?.enhanceWithAI !== false) {
      try {
        aiSummary = await this.enhanceWithAI(changes, language);
      } catch (error) {
        logger.warn({
          msg: 'AI enhancement failed, using default summary',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const result: ReleaseNotesResult = {
      version,
      content: aiSummary ? `${content}\n\n---\n\n${aiSummary}` : content,
      changes,
      aiSummary,
      stats,
      commits,
      generatedAt: new Date().toISOString(),
    };

    logger.info({
      msg: 'Release notes generated',
      version: version.version,
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  /**
   * 从 Git 仓库获取提交历史并生成 Release Notes
   *
   * @param options 生成选项
   * @returns Release Notes 结果
   */
  async generateFromGit(options: ReleaseNotesOptions): Promise<ReleaseNotesResult> {
    const { repoPath, from, to } = options;

    logger.info({
      msg: 'Fetching commits from git',
      repoPath,
      from,
      to,
    });

    // 1. 获取提交历史
    const commits = await this.getCommits(repoPath, from, to);

    // 2. 获取标签信息
    const tags = await this.getTags(repoPath, to);

    // 3. 可选：获取文件变更详情
    let diffs: GitDiff[] = [];
    if (options.includeFileChanges) {
      diffs = await this.getFileChanges(repoPath, from, to);
    }

    // 4. 将文件变更信息添加到提交中
    for (const commit of commits) {
      const commitDiffs = diffs.filter(d =>
        commit.files?.some(f => f === d.file)
      );
      commit.files = commitDiffs.map(d => d.file);
    }

    // 5. 生成 Release Notes
    return this.generateFromCommits(commits, {
      ...options,
      from,
      to: tags[0]?.name ?? to,
    });
  }

  /**
   * 获取两个版本/标签之间的提交
   */
  async getCommits(
    repoPath: string,
    from: string,
    to: string
  ): Promise<GitCommit[]> {
    try {
      const safePath = validateRepoPath(repoPath);
      const safeFrom = validateGitRef(from);
      const safeTo = validateGitRef(to);

      const format = '%H|%an|%ae|%aI|%s';
      const { stdout } = await execFileAsync(
        'git',
        ['-C', safePath, 'log', `${safeFrom}..${safeTo}`, `--format=${format}`, '--no-merges', '--'],
        { maxBuffer: 10 * 1024 * 1024 }
      );

      if (!stdout.trim()) {
        logger.warn({ msg: 'No commits found', from, to });
        return [];
      }

      const commits: GitCommit[] = stdout.trim().split('\n').map(line => {
        const [hash, author, authorEmail, date, ...messageParts] = line.split('|');
        const message = messageParts.join('|');

        return {
          hash,
          shortHash: hash.substring(0, 7),
          message: message.trim(),
          author,
          authorEmail,
          date,
          ...parseCommitMessage(message),
        };
      });

      logger.info({
        msg: 'Commits retrieved',
        count: commits.length,
        from,
        to,
      });

      return commits;
    } catch (error) {
      logger.error({
        msg: 'Failed to get commits from git',
        error: error instanceof Error ? error.message : String(error),
        from,
        to,
      });
      throw new Error(`Failed to get commits: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取仓库的标签
   */
  async getTags(repoPath: string, ref?: string): Promise<GitTag[]> {
    try {
      const safePath = validateRepoPath(repoPath);
      if (ref) validateGitRef(ref);

      const format = '%d|%s|%ci|%H';
      const args = ['-C', safePath, 'log', '--oneline', '--decorate', '-1', `--format=${format}`, '--'];
      if (ref) args.push(ref);
      const { stdout } = await execFileAsync('git', args, { maxBuffer: 1024 * 1024 });

      if (!stdout.trim()) {
        return [];
      }

      const [decorations, message, date, commit] = stdout.trim().split('|');
      const tagNames = decorations
        ?.replace(/[()]/g, '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.startsWith('tag: '))
        .map(t => t.replace('tag: ', '')) ?? [];

      return tagNames.map(name => ({
        name,
        message: message?.trim(),
        date: date?.trim() ?? '',
        commit: commit?.trim() ?? '',
      }));
    } catch (error) {
      logger.warn({
        msg: 'Failed to get tags',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 获取文件变更详情
   */
  async getFileChanges(
    repoPath: string,
    from: string,
    to: string
  ): Promise<GitDiff[]> {
    try {
      const safePath = validateRepoPath(repoPath);
      const safeFrom = validateGitRef(from);
      const safeTo = validateGitRef(to);

      const { stdout } = await execFileAsync(
        'git',
        ['-C', safePath, 'diff', '--stat', `${safeFrom}..${safeTo}`, '--'],
        { maxBuffer: 10 * 1024 * 1024 }
      );

      const diffs: GitDiff[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        // 解析 stat 格式: file.ts | 10 +++---
        const match = line.match(/^\s*(.+?)\s*\|\s*(\d+\s+[+-]+)$/);
        if (match) {
          const [, file, stat] = match;
          const added = (stat.match(/\+/g) || []).length;
          const deleted = (stat.match(/-/g) || []).length;

          diffs.push({
            file: file.trim(),
            status: added > 0 && deleted > 0 ? 'modified' : added > 0 ? 'added' : 'deleted',
            additions: added,
            deletions: deleted,
          });
        }
      }

      return diffs;
    } catch (error) {
      logger.warn({
        msg: 'Failed to get file changes',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 分类变更
   */
  private categorizeChanges(commits: GitCommit[]): ReleaseChanges {
    const changes: ReleaseChanges = {
      features: [],
      fixes: [],
      breaking: [],
      documentation: [],
      performance: [],
      refactoring: [],
      tests: [],
      build: [],
      other: [],
    };

    for (const commit of commits) {
      const category = categorizeCommit(commit);
      const { subject, scope } = parseCommitMessage(commit.message);

      const changeItem: ChangeItem = {
        description: subject,
        scope,
        commitHash: commit.shortHash,
        isBreaking: commit.message.includes('BREAKING CHANGE') || commit.message.includes('breaking'),
        files: commit.files,
      };

      // 检查是否为破坏性变更
      if (changeItem.isBreaking || category === 'breaking') {
        changes.breaking.push(changeItem);
      } else {
        changes[category].push(changeItem);
      }
    }

    return changes;
  }

  /**
   * 检测版本类型
   */
  private detectReleaseType(commits: GitCommit[]): 'major' | 'minor' | 'patch' {
    if (!this.agentConfig.autoDetectVersionType) {
      return 'patch';
    }

    // 检查是否有破坏性变更
    for (const commit of commits) {
      if (
        commit.message.includes('BREAKING CHANGE') ||
        commit.message.includes('breaking') ||
        commit.message.startsWith('feat!') ||
        commit.message.startsWith('fix!')
      ) {
        return 'major';
      }
    }

    // 检查是否有新功能
    for (const commit of commits) {
      if (commit.message.startsWith('feat') || commit.message.startsWith('feat(')) {
        return 'minor';
      }
    }

    return 'patch';
  }

  /**
   * 计算统计信息
   */
  private calculateStats(commits: GitCommit[], changes: ReleaseChanges): ReleaseNotesStats {
    const contributors = new Set(commits.map(c => c.authorEmail));

    return {
      totalCommits: commits.length,
      featuresCount: changes.features.length,
      fixesCount: changes.fixes.length,
      breakingChangesCount: changes.breaking.length,
      docsCount: changes.documentation.length,
      contributorsCount: contributors.size,
    };
  }

  /**
   * 构建 Markdown 内容
   */
  private buildMarkdownContent(
    version: VersionInfo,
    changes: ReleaseChanges,
    stats: ReleaseNotesStats,
    language: 'zh-CN' | 'en-US'
  ): string {
    const isZh = language === 'zh-CN';

    const title = isZh ? `# 版本 ${version.version} 发布说明` : `# Release ${version.version}`;
    const dateLine = isZh
      ? `发布日期: ${new Date(version.releaseDate).toLocaleDateString('zh-CN')}`
      : `Release Date: ${new Date(version.releaseDate).toLocaleDateString('en-US')}`;

    const sections: string[] = [title, '', dateLine, ''];

    // 破坏性变更 (高优先级)
    if (changes.breaking.length > 0) {
      const breakingTitle = isZh ? '## ⚠️ 破坏性变更' : '## ⚠️ Breaking Changes';
      sections.push(breakingTitle, '');

      for (const item of changes.breaking) {
        sections.push(`- ${item.description} (${item.commitHash})`);
      }
      sections.push('');
    }

    // 新功能
    if (changes.features.length > 0) {
      const featTitle = isZh ? '## ✨ 新功能' : '## ✨ New Features';
      sections.push(featTitle, '');

      for (const item of changes.features) {
        const scope = item.scope ? `**${item.scope}**: ` : '';
        sections.push(`- ${scope}${item.description} (${item.commitHash})`);
      }
      sections.push('');
    }

    // Bug 修复
    if (changes.fixes.length > 0) {
      const fixTitle = isZh ? '## 🐛 Bug 修复' : '## 🐛 Bug Fixes';
      sections.push(fixTitle, '');

      for (const item of changes.fixes) {
        const scope = item.scope ? `**${item.scope}**: ` : '';
        sections.push(`- ${scope}${item.description} (${item.commitHash})`);
      }
      sections.push('');
    }

    // 性能优化
    if (changes.performance.length > 0) {
      const perfTitle = isZh ? '## ⚡ 性能优化' : '## ⚡ Performance Improvements';
      sections.push(perfTitle, '');

      for (const item of changes.performance) {
        sections.push(`- ${item.description} (${item.commitHash})`);
      }
      sections.push('');
    }

    // 代码重构
    if (changes.refactoring.length > 0) {
      const refTitle = isZh ? '## 🔧 代码重构' : '## 🔧 Code Refactoring';
      sections.push(refTitle, '');

      for (const item of changes.refactoring) {
        sections.push(`- ${item.description} (${item.commitHash})`);
      }
      sections.push('');
    }

    // 文档更新
    if (changes.documentation.length > 0) {
      const docTitle = isZh ? '## 📝 文档更新' : '## 📝 Documentation';
      sections.push(docTitle, '');

      for (const item of changes.documentation) {
        sections.push(`- ${item.description} (${item.commitHash})`);
      }
      sections.push('');
    }

    // 测试
    if (changes.tests.length > 0) {
      const testTitle = isZh ? '## ✅ 测试' : '## ✅ Tests';
      sections.push(testTitle, '');

      for (const item of changes.tests) {
        sections.push(`- ${item.description} (${item.commitHash})`);
      }
      sections.push('');
    }

    // 构建/CI
    if (changes.build.length > 0) {
      const buildTitle = isZh ? '## 🔨 构建与 CI' : '## 🔨 Build & CI';
      sections.push(buildTitle, '');

      for (const item of changes.build) {
        sections.push(`- ${item.description} (${item.commitHash})`);
      }
      sections.push('');
    }

    // 统计信息
    const statsTitle = isZh ? '## 📊 统计信息' : '## 📊 Statistics';
    sections.push(statsTitle, '');
    sections.push(`- ${isZh ? '总提交数' : 'Total Commits'}: ${stats.totalCommits}`);
    sections.push(`- ${isZh ? '新功能' : 'Features'}: ${stats.featuresCount}`);
    sections.push(`- ${isZh ? 'Bug 修复' : 'Bug Fixes'}: ${stats.fixesCount}`);
    sections.push(`- ${isZh ? '破坏性变更' : 'Breaking Changes'}: ${stats.breakingChangesCount}`);
    sections.push(`- ${isZh ? '贡献者' : 'Contributors'}: ${stats.contributorsCount}`);

    return sections.join('\n');
  }

  /**
   * 使用 AI 增强描述
   */
  private async enhanceWithAI(
    changes: ReleaseChanges,
    language: 'zh-CN' | 'en-US'
  ): Promise<string> {
    const isZh = language === 'zh-CN';

    // 构建摘要提示词
    const summaryLines: string[] = [];

    if (changes.features.length > 0) {
      summaryLines.push(`${isZh ? '新增功能' : 'Added'}: ${changes.features.length} ${isZh ? '项' : 'items'}`);
    }
    if (changes.fixes.length > 0) {
      summaryLines.push(`${isZh ? '修复问题' : 'Fixed'}: ${changes.fixes.length} ${isZh ? '个' : 'issues'}`);
    }
    if (changes.breaking.length > 0) {
      summaryLines.push(`${isZh ? '破坏性变更' : 'Breaking'}: ${changes.breaking.length} ${isZh ? '项' : 'changes'}`);
    }

    const summaryText = summaryLines.join(', ');

    const prompt = isZh
      ? `请为以下版本变更生成一段简洁的摘要（50-100字），突出重点变更：

${summaryText}

请使用中文撰写，注重可读性。`
      : `Please generate a concise summary (50-100 words) highlighting the key changes:

${summaryText}

Please write in English, focus on readability.`;

    try {
      const enhancedText = await this.callAI(prompt);
      return isZh
        ? `### AI 摘要\n\n${enhancedText}`
        : `### AI Summary\n\n${enhancedText}`;
    } catch (error) {
      logger.warn({
        msg: 'AI enhancement call failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  /**
   * 执行 Agent
   */
  protected async doExecute(
    input: ReleaseNotesOptions,
    context: AgentExecutionContext
  ): Promise<ReleaseNotesResult> {
    this.validateContext(context);

    logger.info({
      msg: 'Executing ReleaseNotesAgent',
      from: input.from,
      to: input.to,
      traceId: context.traceId,
    });

    return this.generateFromGit(input);
  }
}

/**
 * 创建默认的 Release Notes Agent 配置
 */
export function createReleaseNotesAgentConfig(): AgentConfig {
  return {
    id: 'release-notes-agent',
    name: 'Release Notes Generator',
    enabled: true,
    scenario: 'release_notes',
    provider: 'sonnet',
    maxConcurrency: 3,
    timeoutMs: 60000,
    retry: {
      maxRetries: 2,
      backoffMs: 1000,
    },
    requiredTools: ['git'],
    requiredPermissions: ['read:repository'],
  };
}