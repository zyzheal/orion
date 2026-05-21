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
  | 'missing-hotkey'
  | 'missing-onboarding'
  | 'unobvious-entry'
  | 'too-many-steps'
  // D2 可访问性
  | 'missing-alt'
  | 'missing-focus-style'
  | 'missing-keyboard-nav'
  | 'color-only-status'
  | 'low-contrast'
  | 'missing-semantic-html'
  | 'wrong-tab-order'
  // D3 一致性
  | 'hardcoded-color'
  | 'hardcoded-radius'
  | 'inconsistent-style'
  | 'inconsistent-icon-style'
  // D4 性能感知
  | 'missing-skeleton'
  | 'missing-debounce'
  | 'no-loading-feedback'
  | 'no-progressive-loading'
  | 'missing-cache-hint'
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
    hasHotkey: boolean;
    hasOnboarding: boolean;
    hasKeyboardNav: boolean;
    hasSemanticHTML: boolean;
    hasProgressiveLoading: boolean;
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

    // D3-03: 检测图标风格一致性 (P1) - 新增
    this.detectInconsistentIconStyle();

    // ============ D2 可访问性检测 (P0 优先) ============

    // D2-01: 键盘操作支持 (P0) - 新增
    this.detectMissingKeyboardNav();

    // D2-02: Tab 顺序 (P1) - 新增
    this.detectWrongTabOrder();

    // D2-03: 检测焦点样式 (P0)
    this.detectMissingFocusStyle();

    // D2-04: 检测 img alt 属性 (P0)
    this.detectMissingAlt();

    // D2-06: 语义化 HTML (P1) - 新增
    this.detectMissingSemanticHTML();

    // D2-07: 检测颜色作为唯一状态信息 (P0)
    this.detectColorOnlyStatus();

    // ============ D4 性能感知检测 ============

    // D4-01: 骨架屏/占位符 (P0)
    this.detectMissingSkeleton();

    // D4-02: 渐进式加载 (P1) - 新增
    this.detectMissingProgressiveLoading();

    // D4-03: 缓存提示 (P1) - 新增
    this.detectMissingCacheHint();

    // D4-06: 防抖检测 (P1)
    this.detectMissingDebounce();

    // ============ D1 可用性检测 ============

    // D1-01: 操作步骤少 (P1) - 新增
    this.detectTooManySteps();

    // D1-02: 常用操作入口明显 (P1) - 新增
    this.detectUnobviousEntry();

    // D1-03: 快捷键支持 (P1) - 新增
    this.detectMissingHotkey();

    // D1-04: 新用户引导 (P1) - 新增
    this.detectMissingOnboarding();

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
      hasHotkey: /useHotkey|useKeyboard|onKeyDown|shortcut/i.test(this.content),
      hasOnboarding: /onboarding|tour|guide|welcome|newUser/i.test(this.content),
      hasKeyboardNav: /tabIndex|onKeyDown|keyboard.*nav|focusable/i.test(this.content),
      hasSemanticHTML: /<header|<main|<footer|<article|<aside|<section/i.test(this.content),
      hasProgressiveLoading: /skeleton.*loading|lazy.*load|progressive.*image/i.test(this.content),
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

  // ============ D1-01: 检测操作步骤 (P1) ============

  /**
   * 检测表单/流程是否步骤过多
   */
  private detectTooManySteps(): void {
    // 检测多步表单或步骤组件
    const hasStepComponent = /<Steps|<Step|activeStep|currentStep/.test(this.content);
    const hasMultiStepForm = /Step\d|step\d|phase\d/i.test(this.content);

    if (hasStepComponent) {
      // 检测步骤数量
      const stepMatches = this.content.match(/<Step|<steps/gi);
      const stepCount = stepMatches ? stepMatches.length : 0;

      if (stepCount > 5) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'too-many-steps',
          severity: 'P1',
          message: `流程步骤过多 (${stepCount} 步)，建议拆分或合并`,
          suggestion: '考虑将步骤控制在 5 步以内，或使用可折叠的步骤分组',
          checkId: 'D1-01',
        });
      }
    }
  }

  // ============ D1-02: 检测操作入口 (P1) ============

  /**
   * 检测常用操作是否在显眼位置
   */
  private detectUnobviousEntry(): void {
    // 检测是否有常用操作但不在主按钮位置
    const lines = this.content.split('\n');
    const importantActions = ['save', 'submit', 'create', 'delete', 'confirm'];

    for (const action of importantActions) {
      const actionLineIndex = lines.findIndex(line =>
        new RegExp(`onClick.*${action}|handle${action.charAt(0).toUpperCase() + action.slice(1)}`, 'i').test(line)
      );

      if (actionLineIndex !== -1) {
        const line = lines[actionLineIndex];
        // 检查是否在 drawer/modal 深层嵌套中
        const contextStart = Math.max(0, actionLineIndex - 10);
        const contextEnd = Math.min(lines.length, actionLineIndex + 5);
        const context = lines.slice(contextStart, contextEnd).join('\n');

        const deepNesting = (context.match(/{/g) || []).length > 5;
        const isInDropdown = /Dropdown|dropDown|menu/.test(context);
        const isInMore = /More|更多/.test(context);

        if (deepNesting || (isInDropdown && !isInMore)) {
          this.issues.push({
            file: this.filePath,
            line: actionLineIndex + 1,
            column: 1,
            type: 'unobvious-entry',
            severity: 'P1',
            message: `常用操作 "${action}" 入口不明显，可能隐藏在深层或下拉菜单中`,
            suggestion: '将常用操作放在主按钮位置或显眼入口处',
            checkId: 'D1-02',
            code: line.trim().substring(0, 60),
          });
        }
      }
    }
  }

  // ============ D1-03: 检测快捷键支持 (P1) ============

  /**
   * 检测是否支持键盘快捷键
   */
  private detectMissingHotkey(): void {
    // 检测是否有需要快捷键的场景
    const hasFrequentActions = /onClick|handleClick|onSubmit/.test(this.content);
    const hasHotkey = /useHotkey|useKeyboard|onKeyDown|onKeyPress|shortcut|hotKey/i.test(this.content);

    // 检测高频操作: 保存、提交、搜索、删除
    const frequentOps = ['save', 'submit', 'search', 'delete', 'refresh'];
    const hasFrequentOp = frequentOps.some(op =>
      new RegExp(`handle${op.charAt(0).toUpperCase() + op.slice(1)}|onClick.*{.*${op}`, 'i').test(this.content)
    );

    if (hasFrequentActions && hasFrequentOp && !hasHotkey) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-hotkey',
        severity: 'P1',
        message: '高频操作缺少键盘快捷键支持',
        suggestion: '使用 useHotkey 或 onKeyDown 添加快捷键 (如 Ctrl+S 保存)',
        checkId: 'D1-03',
      });
    }
  }

  // ============ D1-04: 检测新用户引导 (P1) ============

  /**
   * 检测是否缺少新用户引导
   */
  private detectMissingOnboarding(): void {
    // 检测页面是否有引导需求 (首次使用场景)
    const hasFirstUseScenario = /first|newUser|new.*user|onboarding|tour|guide/i.test(this.content);
    const hasOnboarding = /onboarding|tour|guide|welcome|step.*1|newUser|IntroJs|react-joyride/i.test(this.content);

    // 检测是否有欢迎/引导相关的页面入口
    const hasWelcomePage = /Welcome|gettingStarted|getting-started|起步|引导/i.test(this.content);

    if (hasWelcomePage && !hasOnboarding) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-onboarding',
        severity: 'P1',
        message: '欢迎/引导页面缺少引导功能',
        suggestion: '使用引导组件 (如 react-joyride) 提供渐进式引导',
        checkId: 'D1-04',
      });
    }

    // 如果页面有首次使用提示但没有引导
    if (!hasFirstUseScenario && !hasOnboarding) {
      const hasComplexFeature = /config|setting|advance|advanced/i.test(this.content);
      if (hasComplexFeature) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-onboarding',
          severity: 'P2',
          message: '复杂功能页面缺少新用户引导',
          suggestion: '考虑添加 onboarding tour 或 tooltip 引导',
          checkId: 'D1-04',
        });
      }
    }
  }

  // ============ D2-01: 检测键盘操作支持 (P0) ============

  /**
   * 检测是否支持键盘导航
   */
  private detectMissingKeyboardNav(): void {
    // 检测交互组件
    const hasInteractive = /Button|Input|Select|Checkbox|Radio|Tree|Table/.test(this.content);
    const hasKeyboardSupport = /tabIndex|onKeyDown|keyboard.*nav|focusable|aria-/i.test(this.content);

    if (hasInteractive && !hasKeyboardSupport) {
      // 检查是否有自定义键盘处理
      const hasCustomKeyboard = /useKeyboardEvent|useKey|onKeyDown|onKeyUp/.test(this.content);

      if (!hasCustomKeyboard) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-keyboard-nav',
          severity: 'P0',
          message: '交互组件缺少键盘导航支持',
          suggestion: '确保所有可交互元素支持键盘操作 (tab 切换、回车确认)',
          checkId: 'D2-01',
        });
      }
    }
  }

  // ============ D2-02: 检测 Tab 顺序 (P1) ============

  /**
   * 检测 Tab 键顺序是否合理
   */
  private detectWrongTabOrder(): void {
    // 检测是否有 tabIndex 设置为负数的情况 (可访问性问题)
    const hasNegativeTabIndex = /tabIndex\s*=\s*['"]?-[1-9]/.test(this.content);

    if (hasNegativeTabIndex) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'wrong-tab-order',
        severity: 'P1',
        message: '存在 tabIndex=-1 的元素，可能影响键盘导航顺序',
        suggestion: '检查是否有意为之，确保 modal/ drawer 中焦点正确管理',
        checkId: 'D2-02',
      });
    }

    // 检测 form 中字段顺序
    const formFields = this.content.match(/name\s*=\s*['"](\w+)['"]/g);
    if (formFields && formFields.length > 3) {
      // 检查字段名是否按逻辑顺序排列 (简单检查)
      const fields = formFields.map(f => f.match(/['"](\w+)['"]/)?.[1]).filter(Boolean) as string[];
      const hasReversedOrder = fields.some((field, i) => {
        if (i === 0) return false;
        // 简单启发式: 检查下一个字段名是否在逻辑上应该在前面
        return field < fields[i - 1] && Math.abs(field.charCodeAt(0) - fields[i - 1].charCodeAt(0)) < 5;
      });

      if (hasReversedOrder) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'wrong-tab-order',
          severity: 'P1',
          message: '表单字段可能 Tab 顺序不合理',
          suggestion: '确保字段按逻辑顺序排列: 重要 → 次要, 上 → 下',
          checkId: 'D2-02',
        });
      }
    }
  }

  // ============ D2-06: 检测语义化 HTML (P1) ============

  /**
   * 检测是否使用语义化 HTML 标签
   */
  private detectMissingSemanticHTML(): void {
    // 检测页面布局是否使用语义化标签
    const hasLayoutStructure = /<div[^>]*class\s*=\s*["']layout|container|wrapper|content|main/i.test(this.content);
    const hasSemanticHTML = /<header|<main|<footer|<article|<aside|<section|<nav/i.test(this.content);

    // 对于有布局结构但没有语义化标签的组件
    if (hasLayoutStructure && !hasSemanticHTML) {
      // 检查是否是页面级组件
      const isPageComponent = /export\s+default|export\s+const.*Page|export\s+function.*Page/i.test(this.content);

      if (isPageComponent) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-semantic-html',
          severity: 'P1',
          message: '页面组件缺少语义化 HTML 标签',
          suggestion: '使用 <main> 包裹主体内容，<header> 页眉，<footer> 页脚',
          checkId: 'D2-06',
        });
      }
    }

    // 检测列表是否使用语义化标签
    const hasListRendering = /\.map\(.*=>|for.*of/.test(this.content);
    const hasUlOl = /<ul|<ol/.test(this.content);
    const hasDivList = /<div[^>]*class\s*=\s*["']list|item/i.test(this.content);

    if (hasListRendering && hasDivList && !hasUlOl) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-semantic-html',
        severity: 'P2',
        message: '列表渲染使用 <div> 而非语义化列表标签',
        suggestion: '使用 <ul>/<ol> + <li> 替代 div 列表',
        checkId: 'D2-06',
      });
    }
  }

  // ============ D3-03: 检测图标风格一致性 (P1) ============

  /**
   * 检测是否混用多种图标库
   */
  private detectInconsistentIconStyle(): void {
    // 检测使用的图标库
    const iconLibraries = [
      { pattern: /@ant-design\/icons/, name: 'Ant Design Icons' },
      { pattern: /react-icons/, name: 'React Icons' },
      { pattern: /@antv\/icon/, name: 'AntV Icon' },
      { pattern: /iconfont/, name: 'Iconfont' },
    ];

    const usedLibraries = iconLibraries.filter(lib => lib.pattern.test(this.content));

    if (usedLibraries.length > 1) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'inconsistent-icon-style',
        severity: 'P1',
        message: `混用多种图标库: ${usedLibraries.map(l => l.name).join(', ')}`,
        suggestion: '统一使用 @ant-design/icons，保持视觉风格一致',
        checkId: 'D3-03',
      });
    }

    // 检测直接使用 SVG 而非图标组件
    const inlineSvgCount = (this.content.match(/<svg[^>]*>/g) || []).length;
    if (inlineSvgCount > 3) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'inconsistent-icon-style',
        severity: 'P2',
        message: `存在 ${inlineSvgCount} 个内联 SVG，建议封装为图标组件`,
        suggestion: '抽取为 Icon 组件，统一管理图标样式',
        checkId: 'D3-03',
      });
    }
  }

  // ============ D4-02: 检测渐进式加载 (P1) ============

  /**
   * 检测是否使用渐进式加载
   */
  private detectMissingProgressiveLoading(): void {
    // 检测大列表渲染
    const hasListRender = /\.map\(|\.forEach\(/.test(this.content);
    const hasLargeList = /\(.{50,}\)/.test(this.content); // 复杂渲染函数

    if (hasListRender && hasLargeList) {
      // 检测是否有分页或虚拟滚动
      const hasPagination = /pagination|pageSize|currentPage/.test(this.content);
      const hasVirtualScroll = /virtual|react-window|react-virtualized|useVirtual/.test(this.content);
      const hasProgressiveLoad = /loadMore|initialLoadCount|lazy.*load/i.test(this.content);

      if (!hasPagination && !hasVirtualScroll && !hasProgressiveLoad) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'no-progressive-loading',
          severity: 'P1',
          message: '大列表渲染缺少渐进式加载策略',
          suggestion: '使用分页、虚拟滚动或懒加载，避免一次性渲染大量数据',
          checkId: 'D4-02',
        });
      }
    }

    // 检测图片加载
    const hasImages = /<img|<Image/.test(this.content);
    if (hasImages) {
      const hasLazyLoad = /lazyLoad|lazy.*load|loading=["']lazy|placeholder/.test(this.content);

      if (!hasLazyLoad) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'no-progressive-loading',
          severity: 'P2',
          message: '图片缺少懒加载设置',
          suggestion: '使用 loading="lazy" 或图片占位符优化加载体验',
          checkId: 'D4-02',
        });
      }
    }
  }

  // ============ D4-03: 检测缓存提示 (P1) ============

  /**
   * 检测是否显示缓存状态
   */
  private detectMissingCacheHint(): void {
    // 检测缓存相关 API 使用
    const hasCacheOperation = /cache|localStorage|sessionStorage|indexedDB/i.test(this.content);

    if (hasCacheOperation) {
      // 检测是否有缓存状态提示
      const hasCacheHint = /cached|from.*cache|cache.*hit|缓存/.test(this.content);

      if (!hasCacheHint) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-cache-hint',
          severity: 'P1',
          message: '缓存操作缺少状态提示',
          suggestion: '显示 "来自缓存" 或加载时间提示，让用户感知性能优化',
          checkId: 'D4-03',
        });
      }
    }

    // 检测静态资源缓存
    const hasStaticAsset = /\.css|\.js|\.svg|\.png|assets\/|static\//.test(this.content);
    if (hasStaticAsset) {
      const hasVersionHash = /\?v=|\?version=|hash=/.test(this.content);

      if (!hasVersionHash) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-cache-hint',
          severity: 'P2',
          message: '静态资源缺少版本哈希，无法利用缓存',
          suggestion: '使用 build 工具添加 hash 版本号，启用缓存',
          checkId: 'D4-03',
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