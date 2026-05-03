/**
 * ChangeAnalyzer - 代码变更分析器
 *
 * 功能：
 * 1. 解析 Git diff
 * 2. 识别变更类型（新增、修改、删除）
 * 3. 提取变更函数签名
 * 4. 分析变更影响范围
 */

import {
  ChangeAnalysisResult,
  AnalyzedChange,
  ChangedSymbol,
  ChangeImpactScope,
  ProgrammingLanguage,
  ParameterInfo,
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 语言解析器配置
 */
export interface ChangeAnalyzerConfig {
  /** 源代码根目录 */
  sourceRoot?: string;
  /** 是否启用详细分析 */
  detailedAnalysis?: boolean;
}

/**
 * Git diff 行类型
 */
type DiffLineType = 'added' | 'removed' | 'context' | 'header';

/**
 * 解析后的 diff 行
 */
interface ParsedDiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * 解析后的文件 diff
 */
interface ParsedFileDiff {
  oldFile: string;
  newFile: string;
  lines: ParsedDiffLine[];
  hunks: DiffHunk[];
}

/**
 * Diff hunk 信息
 */
interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: ParsedDiffLine[];
}

/**
 * 代码变更分析器
 */
export class ChangeAnalyzer {
  private config: ChangeAnalyzerConfig;

  constructor(config: ChangeAnalyzerConfig = {}) {
    this.config = {
      sourceRoot: config.sourceRoot || 'src',
      detailedAnalysis: config.detailedAnalysis ?? true,
    };
  }

  /**
   * 分析代码变更
   *
   * @param diff Git diff 内容
   * @param filePath 文件路径
   * @param language 编程语言
   * @param fileContent 文件内容（可选）
   * @returns 变更分析结果
   */
  async analyzeChange(
    diff: string,
    filePath: string,
    language: ProgrammingLanguage,
    fileContent?: string
  ): Promise<ChangeAnalysisResult> {
    const analysisId = `analysis-${uuidv4().substring(0, 8)}`;

    // 1. 解析 Git diff
    const parsedDiff = this.parseGitDiff(diff);

    // 2. 分析变更
    let changes = this.extractChanges(parsedDiff, filePath);

    // 如果没有解析到变更（简化 diff 格式），直接从 diff 内容提取
    if (changes.length === 0 && diff.trim()) {
      changes = this.parseSimpleDiff(diff);
    }

    // 3. 提取变更的符号（函数/类）
    const changedSymbols = await this.extractChangedSymbols(
      changes,
      language,
      fileContent
    );

    // 4. 分析影响范围
    const impactScope = this.analyzeImpactScope(changes, changedSymbols, language);

    return {
      filePath,
      language,
      changes,
      changedSymbols,
      impactScope,
      analysisId,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * 解析简化 diff 格式（没有文件头的 diff）
   */
  private parseSimpleDiff(diff: string): AnalyzedChange[] {
    const changes: AnalyzedChange[] = [];
    const lines = diff.split('\n');

    let currentChange: AnalyzedChange | null = null;
    let lineNumber = 1;

    for (const line of lines) {
      if (line.startsWith('+')) {
        const content = line.substring(1);
        if (!currentChange || currentChange.changeType !== 'added') {
          if (currentChange) {
            changes.push(currentChange);
          }
          currentChange = {
            changeType: 'added',
            startLine: lineNumber,
            endLine: lineNumber,
            content: content,
          };
        } else {
          currentChange.endLine = lineNumber;
          currentChange.content += '\n' + content;
        }
        lineNumber++;
      } else if (line.startsWith('-')) {
        const content = line.substring(1);
        if (!currentChange || currentChange.changeType !== 'deleted') {
          if (currentChange) {
            changes.push(currentChange);
          }
          currentChange = {
            changeType: 'deleted',
            startLine: lineNumber,
            endLine: lineNumber,
            content: content,
          };
        } else {
          currentChange.endLine = lineNumber;
          currentChange.content += '\n' + content;
        }
      } else if (line.trim()) {
        // 非 diff 行，结束当前变更
        if (currentChange) {
          changes.push(currentChange);
          currentChange = null;
        }
        lineNumber++;
      }
    }

    // 保存最后一个变更
    if (currentChange) {
      changes.push(currentChange);
    }

    return changes;
  }

  /**
   * 解析 Git diff
   *
   * 将 Git diff 内容解析为结构化的数据。
   */
  private parseGitDiff(diff: string): ParsedFileDiff[] {
    const fileDiffs: ParsedFileDiff[] = [];
    const lines = diff.split('\n');

    let currentFile: ParsedFileDiff | null = null;
    let currentHunk: DiffHunk | null = null;

    for (const line of lines) {
      // 文件头
      if (line.startsWith('diff --git ')) {
        if (currentFile) {
          if (currentHunk) {
            currentFile.hunks.push(currentHunk);
          }
          fileDiffs.push(currentFile);
        }
        currentFile = {
          oldFile: '',
          newFile: '',
          lines: [],
          hunks: [],
        };
        currentHunk = null;
        continue;
      }

      // 旧文件路径
      if (line.startsWith('--- ') && currentFile) {
        currentFile.oldFile = line.substring(4).replace('a/', '');
        continue;
      }

      // 新文件路径
      if (line.startsWith('+++ ') && currentFile) {
        currentFile.newFile = line.substring(4).replace('b/', '');
        continue;
      }

      // Hunk 头
      if (line.startsWith('@@ ') && currentFile) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }

        // 解析 hunk 头: @@ -oldStart,oldLines +newStart,newLines @@
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          currentHunk = {
            oldStart: parseInt(match[1], 10),
            oldLines: 0,
            newStart: parseInt(match[2], 10),
            newLines: 0,
            lines: [],
          };
        }
        continue;
      }

      // Diff 行
      if (currentFile && currentHunk) {
        let parsedLine: ParsedDiffLine;

        if (line.startsWith('+')) {
          parsedLine = {
            type: 'added',
            content: line.substring(1),
            newLineNumber: currentHunk.newStart + currentHunk.newLines,
          };
          currentHunk.newLines++;
        } else if (line.startsWith('-')) {
          parsedLine = {
            type: 'removed',
            content: line.substring(1),
            oldLineNumber: currentHunk.oldStart + currentHunk.oldLines,
          };
          currentHunk.oldLines++;
        } else if (line.startsWith(' ')) {
          parsedLine = {
            type: 'context',
            content: line.substring(1),
            oldLineNumber: currentHunk.oldStart + currentHunk.oldLines,
            newLineNumber: currentHunk.newStart + currentHunk.newLines,
          };
          currentHunk.oldLines++;
          currentHunk.newLines++;
        } else {
          continue; // 跳过其他行
        }

        currentHunk.lines.push(parsedLine);
        currentFile.lines.push(parsedLine);
      }
    }

    // 保存最后一个文件
    if (currentFile) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }
      fileDiffs.push(currentFile);
    }

    return fileDiffs;
  }

  /**
   * 提取变更内容
   */
  private extractChanges(parsedDiff: ParsedFileDiff[], filePath: string): AnalyzedChange[] {
    const changes: AnalyzedChange[] = [];

    for (const fileDiff of parsedDiff) {
      // 只分析指定文件
      if (fileDiff.newFile !== filePath && fileDiff.oldFile !== filePath) {
        continue;
      }

      for (const hunk of fileDiff.hunks) {
        // 合并连续的变更行
        let currentChange: AnalyzedChange | null = null;

        for (const line of hunk.lines) {
          if (line.type === 'added' || line.type === 'removed') {
            const changeType: 'added' | 'modified' | 'deleted' =
              line.type === 'added' ? 'added' : line.type === 'removed' ? 'deleted' : 'modified';

            if (!currentChange) {
              currentChange = {
                changeType,
                startLine: line.newLineNumber || line.oldLineNumber || 0,
                endLine: line.newLineNumber || line.oldLineNumber || 0,
                content: line.content,
              };
            } else if (currentChange.changeType === changeType) {
              // 连续的同类型变更
              currentChange.endLine = line.newLineNumber || line.oldLineNumber || currentChange.endLine;
              currentChange.content += '\n' + line.content;
            } else {
              // 不同类型的变更，保存当前变更并开始新的
              changes.push(currentChange);
              currentChange = {
                changeType,
                startLine: line.newLineNumber || line.oldLineNumber || 0,
                endLine: line.newLineNumber || line.oldLineNumber || 0,
                content: line.content,
              };
            }
          } else if (currentChange) {
            // context 行，保存当前变更
            changes.push(currentChange);
            currentChange = null;
          }
        }

        // 保存最后一个变更
        if (currentChange) {
          changes.push(currentChange);
        }
      }
    }

    // 如果没有解析到变更（可能是简化 diff），尝试直接处理
    if (changes.length === 0 && parsedDiff.length === 0) {
      // 这是一个 fallback，处理没有文件头的简化 diff
      // 在 analyzeChange 方法中处理
    }

    return changes;
  }

  /**
   * 提取变更的符号（函数/类）
   *
   * 根据语言类型使用不同的解析策略。
   */
  private async extractChangedSymbols(
    changes: AnalyzedChange[],
    language: ProgrammingLanguage,
    fileContent?: string
  ): Promise<ChangedSymbol[]> {
    const symbols: ChangedSymbol[] = [];

    switch (language) {
      case 'typescript':
      case 'javascript':
        symbols.push(...this.extractTypeScriptSymbols(changes, fileContent));
        break;
      case 'python':
        symbols.push(...this.extractPythonSymbols(changes, fileContent));
        break;
      case 'go':
        symbols.push(...this.extractGoSymbols(changes, fileContent));
        break;
      case 'java':
        symbols.push(...this.extractJavaSymbols(changes, fileContent));
        break;
    }

    return symbols;
  }

  /**
   * 提取 TypeScript/JavaScript 符号
   */
  private extractTypeScriptSymbols(changes: AnalyzedChange[], fileContent?: string): ChangedSymbol[] {
    const symbols: ChangedSymbol[] = [];

    for (const change of changes) {
      const content = change.content;

      // 函数定义
      const funcMatches = Array.from(content.matchAll(
        /(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?/g
      ));
      for (const match of funcMatches) {
        const name = match[3];
        const params = this.parseTypeScriptParams(match[4]);
        const returnType = match[5];

        symbols.push({
          name,
          type: 'function',
          signature: match[0],
          parameters: params,
          returnType,
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateFunctionTestRecommendations(name, params, returnType),
        });
      }

      // 箭头函数
      const arrowMatches = Array.from(content.matchAll(
        /(export\s+)?(const|let)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)(?:\s*:\s*(\w+))?\s*=>/g
      ));
      for (const match of arrowMatches) {
        const name = match[3];
        const params = this.parseTypeScriptParams(match[5]);
        const returnType = match[6];

        symbols.push({
          name,
          type: 'function',
          signature: match[0],
          parameters: params,
          returnType,
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateFunctionTestRecommendations(name, params, returnType),
        });
      }

      // 类定义
      const classMatches = Array.from(content.matchAll(
        /(export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g
      ));
      for (const match of classMatches) {
        const name = match[2];
        const parentClass = match[3];

        symbols.push({
          name,
          type: 'class',
          signature: match[0],
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateClassTestRecommendations(name, parentClass),
        });
      }

      // 方法定义
      const methodMatches = Array.from(content.matchAll(
        /(public|private|protected)?\s*(async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?/g
      ));
      for (const match of methodMatches) {
        const name = match[3];
        if (['if', 'for', 'while', 'switch', 'catch', 'function', 'class'].includes(name)) {
          continue; // 跳过关键字
        }
        const params = this.parseTypeScriptParams(match[4]);
        const returnType = match[5];

        symbols.push({
          name,
          type: 'method',
          signature: match[0],
          parameters: params,
          returnType,
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateMethodTestRecommendations(name, params, returnType),
        });
      }

      // Interface 定义
      const interfaceMatches = Array.from(content.matchAll(
        /(export\s+)?interface\s+(\w+)/g
      ));
      for (const match of interfaceMatches) {
        const name = match[2];

        symbols.push({
          name,
          type: 'interface',
          signature: match[0],
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: [], // Interface 本身不需要测试，但需要验证实现
        });
      }

      // Type 定义
      const typeMatches = Array.from(content.matchAll(
        /(export\s+)?type\s+(\w+)\s*=/g
      ));
      for (const match of typeMatches) {
        const name = match[2];

        symbols.push({
          name,
          type: 'type',
          signature: match[0],
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: [],
        });
      }
    }

    return symbols;
  }

  /**
   * 解析 TypeScript 参数
   */
  private parseTypeScriptParams(paramsStr: string): ParameterInfo[] {
    if (!paramsStr.trim()) return [];

    const params: ParameterInfo[] = [];
    const paramParts = paramsStr.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // 参数格式: name?: type 或 name: type = default
      const match = trimmed.match(/(\w+)(\?)?(?:\s*:\s*(\w+))?(?:\s*=\s*(.+))?/);
      if (match) {
        params.push({
          name: match[1],
          type: match[3] || 'any',
          optional: !!match[2],
          defaultValue: match[4],
        });
      }
    }

    return params;
  }

  /**
   * 提取 Python 符号
   */
  private extractPythonSymbols(changes: AnalyzedChange[], fileContent?: string): ChangedSymbol[] {
    const symbols: ChangedSymbol[] = [];

    for (const change of changes) {
      const content = change.content;

      // 函数定义
      const funcMatches = Array.from(content.matchAll(
        /def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\w+))?/g
      ));
      for (const match of funcMatches) {
        const name = match[1];
        const params = this.parsePythonParams(match[2]);
        const returnType = match[3];

        symbols.push({
          name,
          type: 'function',
          signature: match[0],
          parameters: params,
          returnType,
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateFunctionTestRecommendations(name, params, returnType),
        });
      }

      // 类定义
      const classMatches = Array.from(content.matchAll(
        /class\s+(\w+)(?:\s*\(([^)]+)\))?/g
      ));
      for (const match of classMatches) {
        const name = match[1];
        const parentClass = match[2];

        symbols.push({
          name,
          type: 'class',
          signature: match[0],
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateClassTestRecommendations(name, parentClass),
        });
      }
    }

    return symbols;
  }

  /**
   * 解析 Python 参数
   */
  private parsePythonParams(paramsStr: string): ParameterInfo[] {
    if (!paramsStr.trim()) return [];

    const params: ParameterInfo[] = [];
    const paramParts = paramsStr.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === 'self') continue;

      // 参数格式: name: type = default 或 name=default
      const match = trimmed.match(/(\w+)(?:\s*:\s*(\w+))?(?:\s*=\s*(.+))?/);
      if (match) {
        params.push({
          name: match[1],
          type: match[2] || 'Any',
          optional: !!match[3],
          defaultValue: match[3],
        });
      }
    }

    return params;
  }

  /**
   * 提取 Go 符号
   */
  private extractGoSymbols(changes: AnalyzedChange[], fileContent?: string): ChangedSymbol[] {
    const symbols: ChangedSymbol[] = [];

    for (const change of changes) {
      const content = change.content;

      // 函数定义
      const funcMatches = Array.from(content.matchAll(
        /func\s+(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]*)\)|(\w+))/g
      ));
      for (const match of funcMatches) {
        const name = match[1];
        const params = this.parseGoParams(match[2]);
        const returnType = match[3] || match[4];

        symbols.push({
          name,
          type: 'function',
          signature: match[0],
          parameters: params,
          returnType,
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateFunctionTestRecommendations(name, params, returnType),
        });
      }

      // 结构体定义
      const structMatches = Array.from(content.matchAll(
        /type\s+(\w+)\s+struct/g
      ));
      for (const match of structMatches) {
        const name = match[1];

        symbols.push({
          name,
          type: 'class', // Go 的 struct 类似于 class
          signature: match[0],
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateClassTestRecommendations(name),
        });
      }
    }

    return symbols;
  }

  /**
   * 解析 Go 参数
   */
  private parseGoParams(paramsStr: string): ParameterInfo[] {
    if (!paramsStr.trim()) return [];

    const params: ParameterInfo[] = [];
    const paramParts = paramsStr.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Go 参数格式: name type 或 type
      const match = trimmed.match(/(\w+)\s+(\w+)/);
      if (match) {
        params.push({
          name: match[1],
          type: match[2],
          optional: false,
        });
      } else {
        // 只有类型的情况
        params.push({
          name: 'arg',
          type: trimmed,
          optional: false,
        });
      }
    }

    return params;
  }

  /**
   * 提取 Java 符号
   */
  private extractJavaSymbols(changes: AnalyzedChange[], fileContent?: string): ChangedSymbol[] {
    const symbols: ChangedSymbol[] = [];

    for (const change of changes) {
      const content = change.content;

      // 类定义
      const classMatches = Array.from(content.matchAll(
        /(public|private|protected)?\s*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(.+))?/g
      ));
      for (const match of classMatches) {
        const name = match[2];
        const parentClass = match[3];

        symbols.push({
          name,
          type: 'class',
          signature: match[0],
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateClassTestRecommendations(name, parentClass),
        });
      }

      // 方法定义
      const methodMatches = Array.from(content.matchAll(
        /(public|private|protected)?\s*(static)?\s*(\w+)\s+(\w+)\s*\(([^)]*)\)/g
      ));
      for (const match of methodMatches) {
        const returnType = match[3];
        const name = match[4];
        if (['if', 'for', 'while', 'switch', 'catch', 'class'].includes(name)) {
          continue;
        }
        const params = this.parseJavaParams(match[5]);

        symbols.push({
          name,
          type: 'method',
          signature: match[0],
          parameters: params,
          returnType,
          isNew: change.changeType === 'added',
          isModified: change.changeType === 'modified',
          isDeleted: change.changeType === 'deleted',
          lineRange: { start: change.startLine, end: change.endLine },
          testRecommendations: this.generateMethodTestRecommendations(name, params, returnType),
        });
      }
    }

    return symbols;
  }

  /**
   * 解析 Java 参数
   */
  private parseJavaParams(paramsStr: string): ParameterInfo[] {
    if (!paramsStr.trim()) return [];

    const params: ParameterInfo[] = [];
    const paramParts = paramsStr.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Java 参数格式: type name
      const match = trimmed.match(/(\w+)\s+(\w+)/);
      if (match) {
        params.push({
          name: match[2],
          type: match[1],
          optional: false,
        });
      }
    }

    return params;
  }

  /**
   * 分析变更影响范围
   */
  private analyzeImpactScope(
    changes: AnalyzedChange[],
    symbols: ChangedSymbol[],
    language: ProgrammingLanguage
  ): ChangeImpactScope {
    const directFiles: string[] = [];
    const indirectFiles: string[] = [];
    const symbolsToTest: string[] = [];

    // 收集需要测试的符号
    for (const symbol of symbols) {
      if (!symbol.isDeleted) {
        symbolsToTest.push(symbol.name);
      }
    }

    // 计算复杂度评分
    const complexityScore = this.calculateComplexityScore(changes, symbols);

    // 计算风险评分
    const riskScore = this.calculateRiskScore(changes, symbols, language);

    return {
      directFiles,
      indirectFiles,
      symbolsToTest,
      complexityScore,
      riskScore,
    };
  }

  /**
   * 计算复杂度评分
   */
  private calculateComplexityScore(changes: AnalyzedChange[], symbols: ChangedSymbol[]): number {
    let score = 0;

    // 基于变更行数
    const totalLines = changes.reduce((sum, c) => sum + (c.endLine - c.startLine + 1), 0);
    score += Math.min(totalLines * 2, 40);

    // 基于符号数量
    score += Math.min(symbols.length * 10, 30);

    // 基于新增符号
    const newSymbols = symbols.filter(s => s.isNew);
    score += Math.min(newSymbols.length * 15, 30);

    return Math.min(score, 100);
  }

  /**
   * 计算风险评分
   */
  private calculateRiskScore(
    changes: AnalyzedChange[],
    symbols: ChangedSymbol[],
    language: ProgrammingLanguage
  ): number {
    let score = 0;

    // 基于修改类型
    for (const change of changes) {
      if (change.changeType === 'deleted') {
        score += 20;
      } else if (change.changeType === 'modified') {
        score += 10;
      }
    }

    // 基于符号类型
    for (const symbol of symbols) {
      if (symbol.type === 'class') {
        score += 15;
      } else if (symbol.type === 'method') {
        score += 10;
      } else if (symbol.type === 'function') {
        score += 8;
      }
    }

    // 检查是否有异步函数
    for (const symbol of symbols) {
      if (symbol.signature?.includes('async')) {
        score += 5;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * 生成函数测试建议
   */
  private generateFunctionTestRecommendations(
    name: string,
    params: ParameterInfo[],
    returnType?: string
  ): string[] {
    const recommendations: string[] = [];

    recommendations.push(`测试正常调用: ${name}(${params.map(p => p.name).join(', ')})`);

    if (params.some(p => p.optional)) {
      recommendations.push(`测试可选参数缺失情况`);
    }

    if (params.length > 0) {
      recommendations.push(`测试边界参数值`);
      recommendations.push(`测试无效参数输入`);
    }

    if (returnType) {
      recommendations.push(`验证返回值类型和结构`);
    }

    return recommendations;
  }

  /**
   * 生成方法测试建议
   */
  private generateMethodTestRecommendations(
    name: string,
    params: ParameterInfo[],
    returnType?: string
  ): string[] {
    const recommendations = this.generateFunctionTestRecommendations(name, params, returnType);

    recommendations.push(`测试方法在不同实例状态下的行为`);

    return recommendations;
  }

  /**
   * 生成类测试建议
   */
  private generateClassTestRecommendations(name: string, parentClass?: string): string[] {
    const recommendations: string[] = [];

    recommendations.push(`测试类实例化`);
    recommendations.push(`测试类方法调用`);
    recommendations.push(`测试类状态变更`);

    if (parentClass) {
      recommendations.push(`测试继承关系正确性`);
      recommendations.push(`测试父类方法覆盖行为`);
    }

    return recommendations;
  }

  /**
   * 从文件路径推断语言类型
   */
  static detectLanguage(filePath: string): ProgrammingLanguage | null {
    const ext = filePath.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'py':
        return 'python';
      case 'go':
        return 'go';
      case 'java':
        return 'java';
      default:
        return null;
    }
  }
}