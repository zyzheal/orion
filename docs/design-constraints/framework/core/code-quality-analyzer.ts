/**
 * 代码质量深度分析器
 * 检测代码重复、潜在问题、最佳实践、安全问题等
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface CodeQualityIssue {
  file: string;
  line: number;
  column: number;
  type: QualityIssueType;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion: string;
  code?: string;
}

export type QualityIssueType =
  // 代码重复
  | 'duplicate-code'
  // 潜在问题
  | 'unused-variable'
  | 'unused-import'
  | 'console-log'
  | 'any-type'
  | 'any-return'
  | 'empty-block'
  | 'complex-condition'
  // 最佳实践
  | 'missing-error-handling'
  | 'missing-validation'
  | 'hardcoded-value'
  | 'magic-number'
  | 'missing-memo'
  | 'missing-key'
  // 性能问题
  | 'inline-function'
  | 'nested-loop'
  | 'deep-nesting'
  // 安全问题
  | 'eval-usage'
  | 'dangerous-html'
  | 'sql-concat'
  | 'secret-hardcoded';

export class CodeQualityAnalyzer {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;
  private issues: CodeQualityIssue[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  }

  /**
   * 执行全面代码质量分析
   */
  analyze(): CodeQualityIssue[] {
    this.issues = [];

    // 1. 最佳实践检测
    this.detectConsoleLog();
    this.detectAnyType();
    this.detectHardcodedValues();
    this.detectMagicNumbers();
    this.detectMissingKey();
    this.detectEmptyBlock();

    // 2. 性能问题检测
    this.detectInlineFunctions();
    this.detectNestedLoops();
    this.detectDeepNesting();

    // 3. 安全问题检测
    this.detectEvalUsage();
    this.detectDangerousHtml();
    this.detectSqlConcat();
    this.detectHardcodedSecrets();

    // 4. 未使用代码检测
    this.detectUnusedVariables();
    this.detectUnusedImports();

    return this.issues;
  }

  // ============ 最佳实践检测 ============

  /**
   * 检测 console.log 等调试代码
   */
  private detectConsoleLog(): void {
    const patterns = [
      { regex: /console\.(log|debug|info)\(/, type: 'P1' as const, msg: '存在 console.log 调试代码' },
      { regex: /console\.warn\(/, type: 'P2' as const, msg: '存在 console.warn 警告' },
      { regex: /console\.error\(/, type: 'P2' as const, msg: '存在 console.error 错误输出' },
    ];

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      for (const p of patterns) {
        if (p.regex.test(line)) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: line.indexOf('console') + 1,
            type: 'console-log',
            severity: p.type,
            message: p.msg,
            suggestion: '生产环境应移除调试代码或使用日志框架',
            code: line.trim().substring(0, 60),
          });
        }
      }
    });
  }

  /**
   * 检测 any 类型使用
   */
  private detectAnyType(): void {
    const patterns = [
      { regex: /:\s*any\b/, type: 'P1' as const, msg: '显式 any 类型声明' },
      { regex: /as\s+any\b/, type: 'P1' as const, msg: 'as any 类型断言' },
      { regex: /<any>/, type: 'P1' as const, msg: '泛型 any 类型' },
    ];

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      // 排除注释行
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

      for (const p of patterns) {
        if (p.regex.test(line)) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: line.indexOf('any') + 1,
            type: 'any-type',
            severity: p.type,
            message: p.msg,
            suggestion: '使用具体的类型替代 any',
            code: line.trim().substring(0, 60),
          });
        }
      }
    });
  }

  /**
   * 检测硬编码值
   */
  private detectHardcodedValues(): void {
    // 检测硬编码的颜色值
    const colorRegex = /['"]#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})['"]/g;
    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      // 跳过 style 对象外的颜色引用（可能是变量）
      if (!line.includes('style=') && !line.includes('color:')) return;

      const matches = line.match(colorRegex);
      if (matches) {
        this.issues.push({
          file: this.filePath,
          line: i + 1,
          column: 1,
          type: 'hardcoded-value',
          severity: 'P2',
          message: `硬编码颜色值: ${matches[0]}`,
          suggestion: '使用 Design Token 替代',
          code: line.trim().substring(0, 60),
        });
      }
    });
  }

  /**
   * 检测魔法数字 - 优化版
   * 只检测明显的魔法数字，排除常见场景
   */
  private detectMagicNumbers(): void {
    // 检测明显的魔法数字（状态码、超时、限制值等）
    const patterns = [
      { regex: /\btimeout\s*[:=]\s*(\d{3,})\b/i, type: 'timeout' },
      { regex: /\bdelay\s*[:=]\s*(\d{3,})\b/i, type: 'delay' },
      { regex: /\bretry\s*[:=]\s*(\d{1,2})\b/i, type: 'retry' },
      { regex: /\bmax\s*[:=]\s*(\d{2,})\b/i, type: 'max' },
      { regex: /\bmin\s*[:=]\s*(\d{2,})\b/i, type: 'min' },
      { regex: /\blimit\s*[:=]\s*(\d{2,})\b/i, type: 'limit' },
      { regex: /\bcount\s*[:=]\s*(\d{2,})\b/i, type: 'count' },
      { regex: /\bsize\s*[:=]\s*(\d{2,})\b/i, type: 'size' },
      { regex: /\bstatus[Code]?\s*==?\s*(\d{3})\b/i, type: 'status' },
      { regex: /\bcode\s*==?\s*(\d{3})\b/i, type: 'code' },
    ];

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      // 跳过注释
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

      for (const p of patterns) {
        if (p.regex.test(line)) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: 1,
            type: 'magic-number',
            severity: 'P2',
            message: `可能的魔法数字: ${p.type}`,
            suggestion: `提取为命名常量，如 TIMEOUT_${p.type?.toUpperCase()}`,
            code: line.trim().substring(0, 60),
          });
        }
      }
    });
  }

  /**
   * 检测 map 渲染缺少 key
   */
  private detectMissingKey(): void {
    const regex = /\{\s*\.map\([^}]+\)\s*=>/g;
    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      if (regex.test(line)) {
        // 检查同一行或后续行是否有 key
        const hasKey = /key\s*=/.test(line) || lines[i + 1]?.includes('key=');
        if (!hasKey) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: 1,
            type: 'missing-key',
            severity: 'P0',
            message: 'map 渲染可能缺少 key 属性',
            suggestion: '添加唯一的 key 属性以优化渲染性能',
            code: line.trim().substring(0, 60),
          });
        }
      }
    });
  }

  /**
   * 检测空代码块 - 优化版
   * 排除测试文件和常见场景
   */
  private detectEmptyBlock(): void {
    // 跳过测试文件
    if (this.filePath.includes('.test.') || this.filePath.includes('.spec.')) {
      return;
    }

    // 只检测明显的空 catch 块（可能吞掉错误）
    const catchEmpty = /catch\s*\([^)]*\)\s*\{\s*\}/g;
    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      if (catchEmpty.test(line)) {
        this.issues.push({
          file: this.filePath,
          line: i + 1,
          column: 1,
          type: 'empty-block',
          severity: 'P1',
          message: '空的 catch 块会吞掉错误',
          suggestion: '至少记录错误或重新抛出',
          code: line.trim().substring(0, 60),
        });
      }
    });
  }

  // ============ 性能问题检测 ============

  /**
   * 检测内联函数（每次渲染创建新函数）
   */
  private detectInlineFunctions(): void {
    // 检测 JSX 中直接定义箭头函数
    const regex = /on(Click|Change|Submit)=\{[^=]=>/g;
    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      if (regex.test(line) && !line.includes('useCallback')) {
        this.issues.push({
          file: this.filePath,
          line: i + 1,
          column: 1,
          type: 'inline-function',
          severity: 'P2',
          message: 'JSX 中使用内联箭头函数',
          suggestion: '提取为 useCallback 包装的函数或类方法',
          code: line.trim().substring(0, 60),
        });
      }
    });
  }

  /**
   * 检测嵌套循环
   */
  private detectNestedLoops(): void {
    const regex = /\.forEach\(|\.map\(.*\.forEach|\.filter\(.*\.map/g;
    if (regex.test(this.content)) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'nested-loop',
        severity: 'P1',
        message: '可能存在嵌套循环（数组链式操作）',
        suggestion: '考虑使用单次遍历或优化算法',
      });
    }
  }

  /**
   * 检测代码嵌套过深
   */
  private detectDeepNesting(): void {
    let maxDepth = 0;
    let maxDepthLine = 0;
    let currentDepth = 0;

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      // 计算缩进级别（2 空格 = 1 级）
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const depth = Math.floor(indent / 2);

      if (line.includes('{') && !line.includes('//')) {
        if (depth > maxDepth) {
          maxDepth = depth;
          maxDepthLine = i + 1;
        }
      }
    });

    if (maxDepth > 5) {
      this.issues.push({
        file: this.filePath,
        line: maxDepthLine,
        column: 1,
        type: 'deep-nesting',
        severity: 'P1',
        message: `代码嵌套过深（${maxDepth} 层）`,
        suggestion: '提取为独立函数或使用提前返回',
      });
    }
  }

  // ============ 安全问题检测 ============

  /**
   * 检测 eval 使用
   */
  private detectEvalUsage(): void {
    const patterns = [
      { regex: /\beval\s*\(/, msg: '使用 eval() 动态执行代码' },
      { regex: /\bFunction\s*\(/, msg: '使用 Function 构造函数' },
      { regex: /\bsetTimeout\s*\(\s*['"`]/, msg: 'setTimeout 中使用字符串代码' },
      { regex: /\bsetInterval\s*\(\s*['"`]/, msg: 'setInterval 中使用字符串代码' },
    ];

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      for (const p of patterns) {
        if (p.regex.test(line)) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: 1,
            type: 'eval-usage',
            severity: 'P0',
            message: p.msg,
            suggestion: '使用安全的方式替代',
            code: line.trim().substring(0, 60),
          });
        }
      }
    });
  }

  /**
   * 检测危险 HTML 操作
   */
  private detectDangerousHtml(): void {
    const patterns = [
      { regex: /dangerouslySetInnerHTML/, msg: '使用 dangerouslySetInnerHTML' },
      { regex: /\.innerHTML\s*=/, msg: '直接设置 innerHTML' },
      { regex: /\.outerHTML\s*=/, msg: '直接设置 outerHTML' },
      { regex: /document\.write\s*\(/, msg: '使用 document.write' },
    ];

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      for (const p of patterns) {
        if (p.regex.test(line)) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: 1,
            type: 'dangerous-html',
            severity: 'P0',
            message: p.msg,
            suggestion: '确保内容已安全处理或使用 React 的安全渲染',
            code: line.trim().substring(0, 60),
          });
        }
      }
    });
  }

  /**
   * 检测 SQL 字符串拼接（潜在注入）
   */
  private detectSqlConcat(): void {
    // 简单检测：字符串模板中包含 SQL 关键词和变量
    const regex = /`.*(SELECT|INSERT|UPDATE|DELETE).*\$\{/;
    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      if (regex.test(line)) {
        this.issues.push({
          file: this.filePath,
          line: i + 1,
          column: 1,
          type: 'sql-concat',
          severity: 'P0',
          message: '可能存在 SQL 注入风险',
          suggestion: '使用参数化查询或 ORM',
          code: line.trim().substring(0, 60),
        });
      }
    });
  }

  /**
   * 检测硬编码的密钥/密码
   */
  private detectHardcodedSecrets(): void {
    const patterns = [
      { regex: /password\s*[:=]\s*['"][^'"]{3,}['"]/i, msg: '可能存在硬编码密码' },
      { regex: /apiKey\s*[:=]\s*['"][^'"]{8,}['"]/i, msg: '可能存在硬编码 API Key' },
      { regex: /secret\s*[:=]\s*['"][^'"]{8,}['"]/i, msg: '可能存在硬编码 Secret' },
      { regex: /token\s*[:=]\s*['"][^'"]{10,}['"]/i, msg: '可能存在硬编码 Token' },
      { regex: /privateKey\s*[:=]\s*['"]/i, msg: '可能存在硬编码私钥' },
    ];

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      // 跳过注释
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

      for (const p of patterns) {
        if (p.regex.test(line)) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: 1,
            type: 'secret-hardcoded',
            severity: 'P0',
            message: p.msg,
            suggestion: '使用环境变量或密钥管理服务',
            code: line.trim().substring(0, 60),
          });
        }
      }
    });
  }

  // ============ 未使用代码检测 ============

  /**
   * 检测未使用的变量
   */
  private detectUnusedVariables(): void {
    const regex = /const\s+(\w+)\s*=\s*[^;]+;$/gm;
    let match;
    while ((match = regex.exec(this.content)) !== null) {
      const varName = match[1];
      // 检查是否在后续代码中使用
      const remainingCode = this.content.substring(match.index + match[0].length);
      const usageCount = (remainingCode.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length;

      if (usageCount === 0 && !varName.startsWith('_')) {
        this.issues.push({
          file: this.filePath,
          line: this.content.substring(0, match.index).split('\n').length,
          column: 1,
          type: 'unused-variable',
          severity: 'P2',
          message: `可能未使用的变量: ${varName}`,
          suggestion: '确认是否需要或删除',
        });
      }
    }
  }

  /**
   * 检测未使用的导入
   */
  private detectUnusedImports(): void {
    const importRegex = /import\s+\{?\s*([^}\s]+)\s*\}?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    const imports: string[] = [];
    const importLines: number[] = [];

    while ((match = importRegex.exec(this.content)) !== null) {
      const imported = match[1].split(',').map(s => s.trim());
      const lineNum = this.content.substring(0, match.index).split('\n').length;
      imported.forEach(item => {
        imports.push(item);
        importLines.push(lineNum);
      });
    }

    // 检查每个导入是否被使用
    imports.forEach((imp, idx) => {
      const regex = new RegExp(`\\b${imp}\\b`, 'g');
      const matches = this.content.match(regex);
      if (matches && matches.length === 1) {
        // 只出现一次（导入语句本身）
        this.issues.push({
          file: this.filePath,
          line: importLines[idx],
          column: 1,
          type: 'unused-import',
          severity: 'P2',
          message: `可能未使用的导入: ${imp}`,
          suggestion: '确认是否需要或删除导入',
        });
      }
    });
  }
}

// ============ 批量扫描器 ============

export class CodeQualityScanner {
  private rootPath: string;

  constructor(rootPath: string = 'orion-frontend/src/') {
    this.rootPath = rootPath;
  }

  async scan(maxFiles: number = 50): Promise<CodeQualityIssue[]> {
    const allIssues: CodeQualityIssue[] = [];
    let allFiles = this.getTsxFiles(this.rootPath);

    // 排除测试文件和 mock 文件
    allFiles = allFiles.filter(f =>
      !f.includes('.test.') &&
      !f.includes('.spec.') &&
      !f.includes('__tests__') &&
      !f.includes('__mocks__') &&
      !f.includes('/mock')
    );

    const files = allFiles.slice(0, maxFiles);

    console.log(`🔍 开始代码质量扫描 (${files.length} 个文件，排除测试文件)...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (i % 10 === 0) console.log(`  进度: ${i}/${files.length}`);

      try {
        const analyzer = new CodeQualityAnalyzer(file);
        const issues = analyzer.analyze();
        allIssues.push(...issues);
      } catch (e) {
        // 忽略解析错误
      }
    }

    console.log(`✅ 扫描完成，发现 ${allIssues.length} 个代码质量问题`);
    return allIssues;
  }

  groupBySeverity(issues: CodeQualityIssue[]): Record<string, CodeQualityIssue[]> {
    return {
      P0: issues.filter(i => i.severity === 'P0'),
      P1: issues.filter(i => i.severity === 'P1'),
      P2: issues.filter(i => i.severity === 'P2'),
    };
  }

  groupByType(issues: CodeQualityIssue[]): Record<string, CodeQualityIssue[]> {
    const groups: Record<string, CodeQualityIssue[]> = {};
    for (const issue of issues) {
      if (!groups[issue.type]) groups[issue.type] = [];
      groups[issue.type].push(issue);
    }
    return groups;
  }

  private getTsxFiles(dir: string): string[] {
    const files: string[] = [];

    const traverse = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            traverse(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
            files.push(fullPath);
          }
        }
      } catch {
        // 忽略访问错误
      }
    };

    traverse(dir);
    return files;
  }
}

// ============ 主函数 ============

export async function runCodeQualityScan(
  rootPath: string = 'orion-frontend/src/',
  maxFiles: number = 50
): Promise<CodeQualityIssue[]> {
  const scanner = new CodeQualityScanner(rootPath);
  return scanner.scan(maxFiles);
}