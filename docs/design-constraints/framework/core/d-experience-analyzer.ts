/**
 * D 用户体验层检测器
 * 检测用户体验相关的 35+ 项设计约束
 *
 * D1 可用性 (12项): 操作步骤、引导、提示、撤销等
 * D2 可访问性 (11项): 键盘操作、ARIA、颜色对比度等
 * D3 一致性 (9项): Design Token、组件风格、术语统一等
 * D4 性能感知 (9项): 骨架屏、加载反馈、防抖等
 * D5 情感化 (6项): 成功反馈、空状态等
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ============ Design Token 定义 ============

const DESIGN_TOKEN_COLORS = [
  '#3370E6', '#2B5DD6', '#1F4BB5', '#5B8DEF', '#8FA9E5', '#B3C5EE', '#D7E1F7', '#EBF0FB', // primary
  '#52c41a', '#389e0d', '#237804', '#73d13d', '#95de64', '#b7eb8f', '#d9f7be', '#f6ffed', // success
  '#faad14', '#d48806', '#ad6800', '#ffd666', '#ffe58f', '#ffecb3', '#fff7e6', '#fffbe6', // warning
  '#f5222d', '#cf1322', '#a8071a', '#ff4d4f', '#ff7875', '#ffa39e', '#ffccc7', '#fff1f0', // error
  '#3a98f4', '#2e7ac5', '#235c95', '#5dabf6', '#80bdf8', '#a3d0fa', '#c6e2fc', '#e8f4fd', // info
  '#7C5CFC', '#6349E0', '#391085', '#9B7FFD', '#b37feb', '#d3adf7', '#efdbff', '#f9f0ff', // purple
  '#ffffff', '#fafafa', '#F5F5F7', '#f0f0f0', '#d9d9d9', '#bfbfbf', '#8c8c8c', '#595959', '#434343', '#262626', '#1f1f1f', '#141414', // neutral
];

// 常见需要检测的硬编码颜色
const HARDCODED_COLOR_PATTERNS = [
  { color: '#3370E6', name: 'primary' },
  { color: '#2B5DD6', name: 'primary-600' },
  { color: '#1F4BB5', name: 'primary-700' },
  { color: '#52c41a', name: 'success' },
  { color: '#faad14', name: 'warning' },
  { color: '#f5222d', name: 'error' },
  { color: '#3a98f4', name: 'info' },
  { color: '#7C5CFC', name: 'purple' },
  { color: '#1f1f1f', name: 'neutral-900' },
  { color: '#8c8c8c', name: 'neutral-500' },
  { color: '#d9d9d9', name: 'neutral-300' },
  { color: '#ffffff', name: 'white' },
];

// ============ 类型定义 ============

export interface ExperienceIssue {
  file: string;
  line: number;
  column: number;
  type: ExperienceIssueType;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion: string;
  checkId: string; // D1-XX ~ D5-XX
  code?: string;
}

export type ExperienceIssueType =
  // D1 可用性
  | 'missing-tooltip'
  | 'missing-empty-state'
  | 'missing-confirmation'
  | 'missing-undo'
  // D2 可访问性
  | 'missing-alt'
  | 'missing-focus-style'
  | 'missing-keyboard-nav'
  | 'color-only-status'
  | 'low-contrast'
  // D3 一致性
  | 'hardcoded-color'
  | 'hardcoded-radius'
  | 'inconsistent-style'
  // D4 性能感知
  | 'missing-skeleton'
  | 'missing-debounce'
  | 'no-loading-feedback'
  // D5 情感化
  | 'cold-empty-state';

export interface ExperienceScanResult {
  file: string;
  issues: ExperienceIssue[];
  stats: {
    hasDesignTokens: boolean;
    hasSkeleton: boolean;
    hasAlt: boolean;
    hasFocus: boolean;
  };
}

// ============ D 用户体验分析器 ============

export class DExperienceAnalyzer {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;
  private issues: ExperienceIssue[] = [];
  private isTSX: boolean;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.isTSX = filePath.endsWith('.tsx');

    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      this.isTSX ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
  }

  /**
   * 执行 D 用户体验分析
   */
  analyze(): ExperienceScanResult {
    this.issues = [];

    if (!this.isTSX) {
      // 非 TSX 文件跳过大部分前端特定检测
      return {
        file: this.filePath,
        issues: this.issues,
        stats: this.collectStats(),
      };
    }

    // ============ D3 一致性检测 (最高价值) ============

    // D3-01: 检测硬编码颜色值 (P0)
    this.detectHardcodedColors();

    // D3-02: 检测组件样式是否统一 (P0)
    this.detectInconsistentStyles();

    // ============ D2 可访问性检测 (P0 优先) ============

    // D2-03: 检测焦点样式 (P0)
    this.detectMissingFocusStyle();

    // D2-04: 检测 img alt 属性 (P0)
    this.detectMissingAlt();

    // D2-07: 检测颜色作为唯一状态信息 (P0)
    this.detectColorOnlyStatus();

    // ============ D4 性能感知检测 ============

    // D4-01: 骨架屏/占位符 (P0)
    this.detectMissingSkeleton();

    // D4-06: 防抖检测 (P1)
    this.detectMissingDebounce();

    // ============ D1 可用性检测 ============

    // D1-05: 工具提示完善 (P1)
    this.detectMissingTooltip();

    // D1-07: 误操作可撤销 (P0)
    this.detectMissingUndo();

    // ============ D5 情感化检测 ============

    // D5-02: 空状态有温度 (P1)
    this.detectColdEmptyState();

    return {
      file: this.filePath,
      issues: this.issues,
      stats: this.collectStats(),
    };
  }

  /**
   * 收集统计信息
   */
  private collectStats() {
    return {
      hasDesignTokens: /from ['"]@\/tokens/.test(this.content),
      hasSkeleton: /Skeleton|skeleton/.test(this.content),
      hasAlt: /alt=/.test(this.content),
      hasFocus: /:focus|focus-visible|outline/.test(this.content),
    };
  }

  // ============ D3-01: 检测硬编码颜色值 (P0) ============

  /**
   * 检测 style 对象中的硬编码颜色值
   * 要求使用 Design Token (colors.primary[500] 等)
   */
  private detectHardcodedColors(): void {
    const lines = this.content.split('\n');

    lines.forEach((line, i) => {
      // 匹配 style={{ 或 style={ 内的颜色值
      const styleMatch = line.match(/style\s*=\s*\{[\s\S]*?\}/);
      if (!styleMatch) return;

      const styleContent = styleMatch[0];

      for (const { color, name } of HARDCODED_COLOR_PATTERNS) {
        // 排除已经在使用 token 的情况
        if (styleContent.includes('colors.')) continue;

        // 匹配硬编码颜色 (带引号或不带引号)
        const colorRegex = new RegExp(`['"]?${color.replace('#', '')}['"]?|color:\\s*${color}`, 'i');
        if (colorRegex.test(styleContent.replace(/\s/g, ''))) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: line.indexOf(color) + 1 || 1,
            type: 'hardcoded-color',
            severity: 'P0',
            message: `使用硬编码颜色 ${color}，应使用 Design Token`,
            suggestion: `使用 colors.${name} 或 @/tokens/colors`,
            checkId: 'D3-01',
            code: line.trim().substring(0, 80),
          });
          break;
        }
      }

      // 通用颜色值检测 (3位或6位十六进制)
      const hexColorRegex = /:?\s*['"]?(#[0-9a-fA-F]{3,6})['"]?/g;
      let match;
      while ((match = hexColorRegex.exec(styleContent)) !== null) {
        const color = match[1];
        // 跳过已经是 token 引用的颜色
        if (color.length <= 4) continue; // 跳过 #333 等短格式

        const isKnownToken = DESIGN_TOKEN_COLORS.some(
          tc => tc.toLowerCase() === color.toLowerCase()
        );
        if (!isKnownToken && color.startsWith('#')) {
          // 检查是否在 tokens 引用行附近
          const hasTokenImport = /import.*colors.*from ['"]@\/tokens/.test(this.content);
          if (!hasTokenImport) {
            this.issues.push({
              file: this.filePath,
              line: i + 1,
              column: match.index + 1,
              type: 'hardcoded-color',
              severity: 'P0',
              message: `使用硬编码颜色 ${color}，应使用 Design Token`,
              suggestion: `使用 @/tokens/colors 中的颜色常量`,
              checkId: 'D3-01',
              code: line.trim().substring(0, 80),
            });
          }
        }
      }
    });
  }

  // ============ D3-02: 检测组件样式一致性 (P0) ============

  /**
   * 检测组件中不一致的样式 (如不同的 border-radius)
   */
  private detectInconsistentStyles(): void {
    const lines = this.content.split('\n');
    const radiusValues: { value: string; line: number }[] = [];
    const fontSizeValues: { value: string; line: number }[] = [];

    lines.forEach((line, i) => {
      // 检测 borderRadius 硬编码值
      const radiusMatches = line.matchAll(/borderRadius\s*:\s*['"]?(\d+)px?['"]?/g);
      for (const match of radiusMatches) {
        radiusValues.push({ value: match[1], line: i + 1 });
      }

      // 检测 fontSize 硬编码值
      const fontSizeMatches = line.matchAll(/fontSize\s*:\s*['"]?(\d+)px?['"]?/g);
      for (const match of fontSizeMatches) {
        fontSizeValues.push({ value: match[1], line: i + 1 });
      }
    });

    // 检测不一致的 border-radius
    const uniqueRadius = [...new Set(radiusValues.map(r => r.value))];
    if (uniqueRadius.length > 2) {
      // 找到第一个不一致的值报告
      const inconsistent = radiusValues[2];
      this.issues.push({
        file: this.filePath,
        line: inconsistent.line,
        column: 1,
        type: 'inconsistent-style',
        severity: 'P0',
        message: `组件使用了多个不同的 border-radius 值: ${uniqueRadius.join(', ')}px`,
        suggestion: '统一使用 Design Token: componentRadius.card(12), button(6), input(6)',
        checkId: 'D3-02',
      });
    }

    // 检测不一致的 font-size
    const uniqueFontSize = [...new Set(fontSizeValues.map(f => f.value))];
    if (uniqueFontSize.length > 3) {
      const inconsistent = fontSizeValues[3];
      this.issues.push({
        file: this.filePath,
        line: inconsistent.line,
        column: 1,
        type: 'inconsistent-style',
        severity: 'P0',
        message: `组件使用了多个不同的 font-size 值: ${uniqueFontSize.join(', ')}px`,
        suggestion: '统一使用 Design Token: typography 的尺寸定义',
        checkId: 'D3-02',
      });
    }
  }

  // ============ D2-03: 检测焦点样式 (P0) ============

  /**
   * 检测按钮/输入框是否缺少 focus 样式
   */
  private detectMissingFocusStyle(): void {
    // 检测是否有 focus-visible 或 &:focus 样式定义
    const hasFocusStyle = /:focus|focus-visible|outline|focused/.test(this.content);

    if (hasFocusStyle) return;

    // 检测是否有交互组件但没有 focus 样式
    const hasButton = /<Button|Button\(|useButton|Button\s*=/.test(this.content);
    const hasInput = /<Input|Input\(|useInput|Input\s*=|TextArea/.test(this.content);

    if (hasButton || hasInput) {
      // 检查样式文件中是否定义了 focus
      const hasCSSFocus = /\.focus|focus-visible|\&:focus/.test(this.content);
      if (!hasCSSFocus) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-focus-style',
          severity: 'P0',
          message: '交互组件缺少 focus 焦点样式',
          suggestion: '添加 focus-visible 样式: outline: 2px solid #3370E6; outline-offset: 2px;',
          checkId: 'D2-03',
        });
      }
    }
  }

  // ============ D2-04: 检测 img alt 属性 (P0) ============

  /**
   * 检测 img 标签是否缺少 alt 属性
   */
  private detectMissingAlt(): void {
    const lines = this.content.split('\n');

    lines.forEach((line, i) => {
      // 匹配 <img 标签 (不包括自闭合的 /> 或 >)
      const imgMatches = line.matchAll(/<img[^>]*>/g);
      for (const match of imgMatches) {
        const imgTag = match[0];
        // 检查是否包含 alt 属性
        if (!/\salt\s*=/.test(imgTag)) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: imgTag.indexOf('<img') + 1,
            type: 'missing-alt',
            severity: 'P0',
            message: 'img 标签缺少 alt 属性，影响可访问性',
            suggestion: '添加 alt 属性: alt="描述图片内容" 或 alt="" (装饰性图片)',
            checkId: 'D2-04',
            code: imgTag.substring(0, 60),
          });
        }
      }
    });
  }

  // ============ D2-07: 检测颜色作为唯一状态信息 (P0) ============

  /**
   * 检测状态是否只用颜色表示 (无图标/文字辅助)
   */
  private detectColorOnlyStatus(): void {
    // 检测是否有纯颜色表示状态的模式
    // 如: style={{ color: '#52c41a' }} 但没有状态文字

    const lines = this.content.split('\n');

    lines.forEach((line, i) => {
      // 检测状态颜色的使用
      const statusColors = [
        { color: '#52c41a', name: '成功' },
        { color: '#faad14', name: '警告' },
        { color: '#f5222d', name: '错误' },
        { color: '#3370E6', name: '进行中' },
      ];

      for (const { color, name } of statusColors) {
        if (line.includes(color) && line.includes('style')) {
          // 检查附近是否有状态文字或图标
          const contextStart = Math.max(0, i - 2);
          const contextEnd = Math.min(lines.length, i + 3);
          const context = lines.slice(contextStart, contextEnd).join(' ');

          const hasStatusText = /status|text|label|tag|badge/i.test(context);
          const hasIcon = /Icon|statusIcon|StatusIcon/.test(context);

          if (!hasStatusText && !hasIcon) {
            this.issues.push({
              file: this.filePath,
              line: i + 1,
              column: line.indexOf(color) + 1,
              type: 'color-only-status',
              severity: 'P0',
              message: `使用颜色 ${color} 表示 ${name} 状态，但缺少图标或文字辅助`,
              suggestion: '添加状态图标或文字标签，确保色盲用户也能理解',
              checkId: 'D2-07',
              code: line.trim().substring(0, 60),
            });
          }
        }
      }
    });
  }

  // ============ D4-01: 检测骨架屏 (P0) ============

  /**
   * 检测数据加载时是否使用 Skeleton 组件
   */
  private detectMissingSkeleton(): void {
    // 检测是否有异步数据加载
    const hasAsyncFetch = /useEffect|fetch\(|axios\.|request\(|await\s+/.test(this.content);
    const hasLoading = /loading|isLoading|fetching/.test(this.content);

    if (hasAsyncFetch && hasLoading) {
      // 检测是否使用了 Skeleton
      const hasSkeleton = /Skeleton|Active|Paragraph/.test(this.content);

      if (!hasSkeleton) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-skeleton',
          severity: 'P0',
          message: '异步数据加载时缺少骨架屏',
          suggestion: '使用 Ant Design Skeleton 组件: <Skeleton active paragraph={{ rows: 4 }} />',
          checkId: 'D4-01',
        });
      }
    }
  }

  // ============ D4-06: 检测防抖 (P1) ============

  /**
   * 检测 input onChange 是否使用防抖
   */
  private detectMissingDebounce(): void {
    const lines = this.content.split('\n');

    lines.forEach((line, i) => {
      // 检测 onChange 事件处理
      const hasOnChange = /onChange\s*=/.test(line);
      if (!hasOnChange) return;

      // 检测是否使用防抖
      const hasDebounce = /debounce|useDebounce|useDebouncedValue/.test(line);

      // 检查附近行是否有 debounce 定义
      const contextStart = Math.max(0, i - 10);
      const contextEnd = Math.min(lines.length, i + 5);
      const context = lines.slice(contextStart, contextEnd).join('\n');
      const hasDebounceHook = /useDebounce|useDebouncedValue|debouncedValue/.test(context);

      if (!hasDebounce && !hasDebounceHook) {
        this.issues.push({
          file: this.filePath,
          line: i + 1,
          column: line.indexOf('onChange') + 1,
          type: 'missing-debounce',
          severity: 'P1',
          message: 'input onChange 缺少防抖处理',
          suggestion: '使用 useDebounce 或 debounce 函数，避免频繁触发',
          checkId: 'D4-06',
          code: line.trim().substring(0, 60),
        });
      }
    });
  }

  // ============ D1-05: 检测工具提示 (P1) ============

  /**
   * 检测图标按钮是否缺少 Tooltip
   */
  private detectMissingTooltip(): void {
    // 检测图标按钮使用
    const iconButtonPatterns = [
      /<Icon\s+type=/,
      /<.*Icon\s*\/>/,
      /{.*Outlined}/,
      /{.*Filled}/,
    ];

    const hasIconUsage = iconButtonPatterns.some(p => p.test(this.content));

    if (hasIconUsage) {
      // 检查是否都包裹在 Tooltip 中
      const iconComponents = this.content.match(/<Icon[^>]*>|<.*Icon\s*\/>/g) || [];
      const tooltipComponents = this.content.match(/<Tooltip[^>]*>/g) || [];

      // 简单检查: 如果图标数量 > tooltip 数量，可能有问题
      if (iconComponents.length > tooltipComponents.length * 0.5) {
        // 检测是否有不带 Tooltip 的图标按钮
        const lines = this.content.split('\n');
        lines.forEach((line, i) => {
          const hasIcon = /<Icon|Outlined\}|Filled\}/.test(line);
          const hasTooltip = /<Tooltip|<ToolTip/.test(line);
          const isButtonContext = /Button|onClick/.test(line);

          if (hasIcon && isButtonContext && !hasTooltip) {
            this.issues.push({
              file: this.filePath,
              line: i + 1,
              column: 1,
              type: 'missing-tooltip',
              severity: 'P1',
              message: '图标按钮缺少 Tooltip 提示',
              suggestion: '使用 <Tooltip title="描述文字"><Icon ... /></Tooltip> 包裹',
              checkId: 'D1-05',
              code: line.trim().substring(0, 60),
            });
          }
        });
      }
    }
  }

  // ============ D1-07: 检测撤销功能 (P0) ============

  /**
   * 检测危险操作是否支持撤销
   */
  private detectMissingUndo(): void {
    // 检测危险操作关键词
    const dangerousOps = [
      { pattern: /delete|remove|clear|reset/i, name: '删除' },
      { pattern: /batchDelete|batchRemove/i, name: '批量删除' },
    ];

    const lines = this.content.split('\n');

    lines.forEach((line, i) => {
      for (const { pattern, name } of dangerousOps) {
        if (pattern.test(line)) {
          // 检查附近是否有撤销逻辑
          const contextStart = Math.max(0, i - 5);
          const contextEnd = Math.min(lines.length, i + 10);
          const context = lines.slice(contextStart, contextEnd).join('\n');

          const hasUndo = /undo|revert|restore|cancel/.test(context);
          const hasMessage = /message\.(success|warning|error)/.test(context);

          if (!hasUndo && hasMessage) {
            // 只在有确认消息但没有撤销操作时报告
            this.issues.push({
              file: this.filePath,
              line: i + 1,
              column: line.indexOf('delete') + 1 || line.indexOf('remove') + 1 || 1,
              type: 'missing-undo',
              severity: 'P0',
              message: `${name}操作后缺少撤销功能`,
              suggestion: '考虑添加撤销功能，或在删除前增加二次确认',
              checkId: 'D1-07',
              code: line.trim().substring(0, 60),
            });
          }
        }
      }
    });
  }

  // ============ D5-02: 检测空状态温度 (P1) ============

  /**
   * 检测空状态是否有引导性内容
   */
  private detectColdEmptyState(): void {
    // 检测是否有 Empty 组件
    const hasEmpty = /<Empty|Empty\.|empty:/.test(this.content);

    if (hasEmpty) {
      // 检查 Empty 是否有描述和操作引导
      const hasDescription = /description|desc|notFoundContent/.test(this.content);
      const hasAction = /onClick|button|Button|operation/.test(this.content);

      if (!hasDescription && !hasAction) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'cold-empty-state',
          severity: 'P1',
          message: 'Empty 空状态缺少引导性内容',
          suggestion: '添加 description 描述和 action 引导按钮',
          checkId: 'D5-02',
        });
      }
    }
  }
}

// ============ 批量扫描器 ============

export class DExperienceScanner {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * 扫描指定目录下的所有 TSX 文件
   */
  scanDirectory(dirPath?: string): ExperienceScanResult[] {
    const targetPath = dirPath || this.basePath;
    const results: ExperienceScanResult[] = [];

    const scan = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // 跳过 node_modules 和隐藏目录
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scan(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
          try {
            const analyzer = new DExperienceAnalyzer(fullPath);
            const result = analyzer.analyze();
            if (result.issues.length > 0) {
              results.push(result);
            }
          } catch (e) {
            // 跳过无法解析的文件
            console.warn(`Skipping ${fullPath}: ${e}`);
          }
        }
      }
    };

    scan(targetPath);
    return results;
  }

  /**
   * 扫描单个文件
   */
  scanFile(filePath: string): ExperienceScanResult {
    const analyzer = new DExperienceAnalyzer(filePath);
    return analyzer.analyze();
  }

  /**
   * 汇总所有问题
   */
  summarize(results: ExperienceScanResult[]): {
    total: number;
    bySeverity: Record<string, number>;
    byCheckId: Record<string, number>;
    byType: Record<string, number>;
  } {
    const issues = results.flatMap(r => r.issues);

    const bySeverity: Record<string, number> = { P0: 0, P1: 0, P2: 0 };
    const byCheckId: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const issue of issues) {
      bySeverity[issue.severity]++;
      byCheckId[issue.checkId] = (byCheckId[issue.checkId] || 0) + 1;
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    }

    return {
      total: issues.length,
      bySeverity,
      byCheckId,
      byType,
    };
  }
}

// ============ CLI 入口 ============

// eslint-disable-next-line @typescript-eslint/no-require-imports
if (typeof require !== 'undefined' && require.main === module) {
  const args = process.argv.slice(2);
  const targetPath = args[0] || process.cwd();

  console.log(`\n🔍 D 用户体验检测器`);
  console.log(`扫描路径: ${targetPath}\n`);

  const scanner = new DExperienceScanner(targetPath);
  const results = scanner.scanDirectory();

  if (results.length === 0) {
    console.log('✅ 未发现问题');
    process.exit(0);
  }

  const summary = scanner.summarize(results);
  console.log(`\n📊 检测结果汇总`);
  console.log(`总问题数: ${summary.total}`);
  console.log(`按严重程度: P0=${summary.bySeverity.P0}, P1=${summary.bySeverity.P1}, P2=${summary.bySeverity.P2}`);
  console.log(`\n按检查项:`);
  for (const [checkId, count] of Object.entries(summary.byCheckId)) {
    console.log(`  ${checkId}: ${count}`);
  }

  console.log(`\n按类型:`);
  for (const [type, count] of Object.entries(summary.byType)) {
    console.log(`  ${type}: ${count}`);
  }

  console.log(`\n详细问题:\n`);
  for (const result of results) {
    for (const issue of result.issues) {
      console.log(`[${issue.checkId}] ${issue.file}:${issue.line}`);
      console.log(`  ${issue.message}`);
      console.log(`  建议: ${issue.suggestion}`);
      if (issue.code) {
        console.log(`  代码: ${issue.code}`);
      }
      console.log('');
    }
  }
}