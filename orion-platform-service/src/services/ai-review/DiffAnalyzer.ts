/**
 * Diff 分析器
 *
 * 解析 git diff 输出，提取变更文件、行范围、代码模式。
 * 支持 unified diff 格式 (GitLab/Gerrit/GitHub 通用格式)。
 */

import { createLogger } from '../utils/logger';

const logger = pino({ name: 'LDiff-LAnalyzer' });
import {
  DiffParseResult,
  FileDiff,
  DiffHunk,
  DiffLine,
  ChangedLine,
} from './types';

/**
 * Git Diff 分析器
 */
export class DiffAnalyzer {
  /**
   * 解析 git diff 输出
   * @param diffText git diff 原始文本
   * @returns 解析结果
   */
  parseDiff(diffText: string): DiffParseResult {
    const files: FileDiff[] = [];
    const changedLines: ChangedLine[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    if (!diffText || diffText.trim().length === 0) {
      return { files, changedLines, totalAdditions, totalDeletions };
    }

    // 按文件分割 diff
    const fileDiffs = this.splitByFile(diffText);

    for (const fileDiffText of fileDiffs) {
      const fileDiff = this.parseFileDiff(fileDiffText);
      if (fileDiff) {
        files.push(fileDiff);
        totalAdditions += fileDiff.additions;
        totalDeletions += fileDiff.deletions;

        // 提取变更行
        for (const hunk of fileDiff.hunks) {
          for (const line of hunk.lines) {
            if (line.type === 'added') {
              changedLines.push({
                filePath: fileDiff.newPath,
                lineNumber: line.lineNumber,
                content: line.content,
              });
            }
          }
        }
      }
    }

    return { files, changedLines, totalAdditions, totalDeletions };
  }

  /**
   * 获取变更的文件列表
   * @param diffText git diff 原始文本
   * @returns 文件路径列表
   */
  getChangedFiles(diffText: string): string[] {
    const result = this.parseDiff(diffText);
    return result.files.map((f) => f.newPath);
  }

  /**
   * 获取指定文件的所有变更行
   * @param diffText git diff 原始文本
   * @param filePath 文件路径
   * @returns 变更行列表
   */
  getChangedLines(diffText: string, filePath: string): ChangedLine[] {
    const result = this.parseDiff(diffText);
    return result.changedLines.filter((line) => line.filePath === filePath);
  }

  /**
   * 提取代码模式 (检测常见模式如 console.log, TODO, 敏感信息等)
   * @param diffText git diff 原始文本
   * @param patterns 要检测的正则模式列表
   * @returns 匹配结果 { filePath, lineNumber, content, pattern }
   */
  extractPatterns(
    diffText: string,
    patterns: Array<{ name: string; regex: RegExp; fileExtensions?: string[] }>
  ): Array<{
    filePath: string;
    lineNumber: number;
    content: string;
    patternName: string;
  }> {
    const result = this.parseDiff(diffText);
    const matches: Array<{
      filePath: string;
      lineNumber: number;
      content: string;
      patternName: string;
    }> = [];

    for (const line of result.changedLines) {
      for (const pattern of patterns) {
        // 如果指定了文件扩展名过滤，检查是否匹配
        if (pattern.fileExtensions && pattern.fileExtensions.length > 0) {
          const ext = this.getFileExtension(line.filePath);
          if (!pattern.fileExtensions.includes(ext)) {
            continue;
          }
        }

        if (pattern.regex.test(line.content)) {
          matches.push({
            filePath: line.filePath,
            lineNumber: line.lineNumber,
            content: line.content,
            patternName: pattern.name,
          });
        }
      }
    }

    return matches;
  }

  /**
   * 获取文件的变更统计信息
   * @param diffText git diff 原始文本
   * @returns 文件路径 -> { additions, deletions } 的映射
   */
  getFileStats(
    diffText: string
  ): Record<string, { additions: number; deletions: number }> {
    const result = this.parseDiff(diffText);
    const stats: Record<string, { additions: number; deletions: number }> = {};

    for (const file of result.files) {
      stats[file.newPath] = {
        additions: file.additions,
        deletions: file.deletions,
      };
    }

    return stats;
  }

  // ==================== 内部方法 ====================

  /**
   * 按文件分割 diff 文本
   */
  private splitByFile(diffText: string): string[] {
    const lines = diffText.split('\n');
    const fileChunks: string[] = [];
    let currentChunk: string[] = [];

    for (const line of lines) {
      if (line.startsWith('diff --git ')) {
        if (currentChunk.length > 0) {
          fileChunks.push(currentChunk.join('\n'));
        }
        currentChunk = [line];
      } else {
        currentChunk.push(line);
      }
    }

    if (currentChunk.length > 0) {
      fileChunks.push(currentChunk.join('\n'));
    }

    return fileChunks;
  }

  /**
   * 解析单个文件的 diff
   */
  private parseFileDiff(diffText: string): FileDiff | null {
    const lines = diffText.split('\n');
    let oldPath = '';
    let newPath = '';
    let isNewFile = false;
    let isDeletedFile = false;
    let isRenamed = false;

    // 解析文件头
    const diffMatch = lines[0]?.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (!diffMatch) {
      return null;
    }

    oldPath = diffMatch[1];
    newPath = diffMatch[2];

    for (const line of lines) {
      if (line.startsWith('new file mode')) {
        isNewFile = true;
      }
      if (line.startsWith('deleted file mode')) {
        isDeletedFile = true;
      }
      if (line.startsWith('similarity index') || line.startsWith('rename from')) {
        isRenamed = true;
      }
      if (line.startsWith('--- ')) {
        if (line === '--- /dev/null') {
          isNewFile = true;
        }
      }
      if (line.startsWith('+++ ')) {
        if (line === '+++ /dev/null') {
          isDeletedFile = true;
        }
      }
    }

    // 解析变更块 (hunks)
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      // 匹配 hunk header: @@ -oldStart,oldLines +newStart,newLines @@
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldLines: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
          newStart: parseInt(hunkMatch[3], 10),
          newLines: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
          lines: [],
          header: hunkMatch[0],
        };
        oldLineNum = currentHunk.oldStart;
        newLineNum = currentHunk.newStart;
        continue;
      }

      if (currentHunk) {
        if (line.startsWith('+')) {
          currentHunk.lines.push({
            lineNumber: newLineNum,
            oldLineNumber: oldLineNum,
            type: 'added',
            content: line.substring(1),
          });
          newLineNum++;
          oldLineNum++;
        } else if (line.startsWith('-')) {
          currentHunk.lines.push({
            lineNumber: newLineNum,
            oldLineNumber: oldLineNum,
            type: 'removed',
            content: line.substring(1),
          });
          oldLineNum++;
        } else if (line.startsWith(' ') || line === '\\ No newline at end of file') {
          if (line.startsWith(' ')) {
            currentHunk.lines.push({
              lineNumber: newLineNum,
              oldLineNumber: oldLineNum,
              type: 'context',
              content: line.substring(1),
            });
          }
          oldLineNum++;
          newLineNum++;
        }
        // 忽略其他行 (如 index, mode 等)
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    // 计算新增和删除行数
    let additions = 0;
    let deletions = 0;
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'added') additions++;
        if (line.type === 'removed') deletions++;
      }
    }

    return {
      oldPath,
      newPath,
      isNewFile,
      isDeletedFile,
      isRenamed,
      hunks,
      additions,
      deletions,
    };
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }
}
