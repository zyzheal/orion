/**
 * Code Ownership Service - 代码所有权管理服务
 *
 * 管理 CODEOWNERS 文件，解析所有权规则，推荐审批人。
 *
 * CODEOWNERS 文件格式:
 *   # 注释行
 *   *.js        @frontend-team
 *   /docs/      @docs-team @tech-writers
 *   /src/api/   @backend-team  # 后端 API 代码
 *
 * 规则优先级: 从上到下，最后匹配的规则优先 (覆盖前面的规则)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CodeOwnersFile,
  OwnershipRule,
  OwnerRecommendation,
} from './types';
import { CodeOwnershipRepository } from '../../repositories/CodeOwnershipRepository';
import { OrionError } from '../../errors';

/** 解析 CODEOWNERS 文件的结果 */
export interface ParseResult {
  /** 是否解析成功 */
  success: boolean;
  /** 解析出的规则 */
  rules: OwnershipRule[];
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
}

export class CodeOwnershipService {
  private repository: CodeOwnershipRepository;

  constructor(repository: CodeOwnershipRepository) {
    this.repository = repository;
  }

  /**
   * 注册/更新 CODEOWNERS 文件
   *
   * @param repoId 仓库 ID
   * @param rawContent CODEOWNERS 文件原始内容
   * @param filePath 文件路径 (默认 .github/CODEOWNERS 或 CODEOWNERS)
   */
  async registerCodeOwnersFile(
    repoId: string,
    rawContent: string,
    filePath: string = '.github/CODEOWNERS'
  ): Promise<CodeOwnersFile> {
    // 解析文件内容
    const parseResult = this.parseCodeOwnersContent(rawContent);

    if (!parseResult.success || parseResult.rules.length === 0) {
      throw new OrionError(`Failed to parse CODEOWNERS file: ${parseResult.errors.length > 0 ? parseResult.errors.join(', ') : 'No valid rules found'}`, 'OPERATION_FAILED');
    }

    const file: Omit<CodeOwnersFile, 'id'> = {
      filePath,
      repoId,
      rules: parseResult.rules,
      lastUpdated: new Date(),
      rawContent,
    };

    // Persist to repository
    const existing = await this.repository.findByRepo(repoId);
    if (existing) {
      await this.repository.update(repoId, { filePath, rules: parseResult.rules, rawContent });
      return { ...file, id: existing.id };
    }

    const id = uuidv4();
    await this.repository.create({ id, repoId, filePath, rules: parseResult.rules, rawContent });
    return { ...file, id };
  }

  /**
   * 获取仓库的 CODEOWNERS 文件
   */
  async getCodeOwnersFile(repoId: string): Promise<CodeOwnersFile | null> {
    return await this.repository.findByRepo(repoId);
  }

  /**
   * 删除仓库的 CODEOWNERS 文件
   */
  async removeCodeOwnersFile(repoId: string): Promise<boolean> {
    return await this.repository.delete(repoId);
  }

  /**
   * 获取文件的推荐审批人
   *
   * 根据 CODEOWNERS 规则，匹配文件路径，返回需要的审批人
   */
  async recommendOwners(
    repoId: string,
    filePaths: string[]
  ): Promise<OwnerRecommendation[]> {
    const file = await this.getCodeOwnersFile(repoId);
    if (!file || file.rules.length === 0) {
      return filePaths.map(fp => ({
        filePath: fp,
        owners: [],
        matchedPattern: '',
      }));
    }

    const recommendations: OwnerRecommendation[] = [];

    for (const filePath of filePaths) {
      const matchedRules = this.matchFileToRules(filePath, file.rules);
      const allOwners = new Set<string>();

      // 合并所有匹配规则的 owners (最后的规则优先级更高)
      for (const rule of matchedRules) {
        rule.owners.forEach(owner => allOwners.add(owner));
      }

      recommendations.push({
        filePath,
        owners: Array.from(allOwners),
        matchedPattern: matchedRules.length > 0 ? matchedRules[matchedRules.length - 1].pattern : '',
      });
    }

    return recommendations;
  }

  /**
   * 获取 PR 涉及的所有审批人
   *
   * 分析 PR 中变更的所有文件，汇总需要的审批人
   */
  async getRequiredApproversForPR(
    repoId: string,
    changedFiles: { path: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }[]
  ): Promise<{
    requiredApprovers: string[];
    ownershipMap: Record<string, string[]>;
  }> {
    const recommendations = await this.recommendOwners(
      repoId,
      changedFiles.map(f => f.path)
    );

    const ownershipMap: Record<string, string[]> = {};
    const allApprovers = new Set<string>();

    for (const rec of recommendations) {
      if (rec.owners.length > 0) {
        ownershipMap[rec.filePath] = rec.owners;
        rec.owners.forEach((owner: string) => allApprovers.add(owner));
      }
    }

    return {
      requiredApprovers: Array.from(allApprovers),
      ownershipMap,
    };
  }

  /**
   * 验证 CODEOWNERS 文件格式
   *
   * 检查语法是否正确，返回错误和警告
   */
  validateCodeOwnersContent(rawContent: string): ParseResult {
    return this.parseCodeOwnersContent(rawContent);
  }

  /**
   * 解析 CODEOWNERS 文件内容
   *
   * CODEOWNERS 格式:
   *   pattern    owner1 owner2  # comment
   *
   * 规则:
   *   - # 开头为注释
   *   - 空行被忽略
   *   - 模式后跟一个或多个所有者
   *   - 所有者以 @ 开头 (用户名或组名)
   *   - 行尾 # 为注释
   */
  private parseCodeOwnersContent(rawContent: string): ParseResult {
    const rules: OwnershipRule[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    const lines = rawContent.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();

      // 跳过空行和注释行
      if (!line || line.startsWith('#')) {
        continue;
      }

      // 分离注释
      const commentIndex = this.findCommentIndex(line);
      const content = commentIndex >= 0 ? line.slice(0, commentIndex).trim() : line;

      if (!content) {
        continue;
      }

      // 分离模式和所有者
      const parts = content.split(/\s+/);
      if (parts.length < 2) {
        warnings.push(`Line ${lineNum + 1}: Pattern without owners: "${content}"`);
        continue;
      }

      const pattern = parts[0];
      const owners = parts.slice(1).filter(p => p.startsWith('@')).map(p => p.replace(/^@/, ''));

      if (owners.length === 0) {
        warnings.push(`Line ${lineNum + 1}: No valid owners (must start with @): "${content}"`);
        continue;
      }

      // 验证模式
      const validation = this.validatePattern(pattern);
      if (!validation.valid) {
        errors.push(`Line ${lineNum + 1}: Invalid pattern "${pattern}": ${validation.error}`);
        continue;
      }

      rules.push({
        pattern,
        owners,
        line: lineNum + 1,
      });
    }

    return {
      success: errors.length === 0,
      rules,
      errors,
      warnings,
    };
  }

  /**
   * 匹配文件路径到所有权规则
   *
   * CODEOWNERS 规则: 最后匹配的规则优先
   */
  private matchFileToRules(
    filePath: string,
    rules: OwnershipRule[]
  ): OwnershipRule[] {
    const matched: OwnershipRule[] = [];

    // CODEOWNERS 规则是从上到下匹配，但最后匹配的规则优先级最高
    for (const rule of rules) {
      if (this.matchFilePattern(rule.pattern, filePath)) {
        matched.push(rule);
      }
    }

    return matched;
  }

  /**
   * 匹配文件路径模式
   *
   * CODEOWNERS 模式规则:
   *   - 以 / 开头: 相对于仓库根目录
   *   - 以 / 结尾: 只匹配目录
   *   - 不包含 /: 匹配所有同名文件/目录
   *   - 包含 *: 通配符
   *   - 包含 **: 匹配任意层级目录
   */
  private matchFilePattern(pattern: string, filePath: string): boolean {
    // 处理目录模式
    const isDirOnly = pattern.endsWith('/');
    if (isDirOnly) {
      // 目录模式只匹配该目录下的文件
      const dirPath = pattern.slice(0, -1);
      if (pattern.startsWith('/')) {
        // 绝对路径: /docs/ -> docs/ 下的所有文件
        const normalizedDir = dirPath.startsWith('/') ? dirPath.slice(1) : dirPath;
        return filePath === normalizedDir || filePath.startsWith(normalizedDir + '/');
      }
      // 相对路径
      return filePath.includes(dirPath);
    }

    // 转换为正则表达式
    const regex = this.patternToRegex(pattern);
    return regex.test(filePath);
  }

  /**
   * 将 CODEOWNERS 模式转换为正则表达式
   */
  private patternToRegex(pattern: string): RegExp {
    let regexStr = pattern;

    if (pattern.startsWith('/')) {
      // 相对于根目录的精确匹配
      regexStr = `^${pattern.slice(1)}`;
    } else if (pattern.includes('/')) {
      // 包含路径分隔符，从根目录匹配
      regexStr = `^${pattern}`;
    } else {
      // 不包含 /，匹配任意位置的同名文件
      regexStr = `(^|/)${pattern}$`;
    }

    // 转换通配符
    regexStr = regexStr
      .replace(/\*\*/g, '__DOUBLESTAR__')  // 临时替换
      .replace(/\*/g, '[^/]*')              // * 匹配任意非斜杠字符
      .replace(/__DOUBLESTAR__/g, '.*');    // ** 匹配任意字符

    return new RegExp(regexStr);
  }

  /**
   * 验证 CODEOWNERS 模式是否合法
   */
  private validatePattern(pattern: string): { valid: boolean; error?: string } {
    if (!pattern) {
      return { valid: false, error: 'Empty pattern' };
    }

    // 检查无效字符
    if (/[<>|]/.test(pattern)) {
      return { valid: false, error: 'Contains invalid characters' };
    }

    // 检查 * 数量
    if (pattern.includes('***')) {
      return { valid: false, error: 'Invalid wildcard ***' };
    }

    return { valid: true };
  }

  /**
   * 查找行中的注释起始位置
   */
  private findCommentIndex(line: string): number {
    // 不在引号内的 # 才是注释
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
      } else if (!inQuotes && char === '#') {
        return i;
      }
    }

    return -1;
  }
}
