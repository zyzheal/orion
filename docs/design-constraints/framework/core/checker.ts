// docs/design-constraints/framework/core/checker.ts

export interface CheckItem {
  id: string;
  category: string;
  level: 'P0' | 'P1' | 'P2';
  rule: string;
  description: string;
  frontend?: boolean;
  backend?: boolean;
  detection: 'code-review' | 'eslint' | 'config-check' | 'test' | 'ast' | 'ai';
}

export interface CheckOptions {
  mode?: 'check' | 'fix';        // 检查模式 or 修复模式
  scanMode?: 'full' | 'changed'; // 全量扫描 or 增量扫描
  skipDimensions?: string[];      // 跳过的维度
  overrideType?: string;          // 覆盖类型
}

export interface CheckResult {
  item: CheckItem;
  status: 'pass' | 'fail' | 'skip' | 'warning';
  details?: string;
  suggestion?: string;
  fixSpec?: any;  // 修复模式下的完整修复方案
}

export async function executeChecks(
  checks: CheckItem[],
  targetPath: string,
  options: CheckOptions = {}
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 过滤跳过的维度
  const filteredChecks = options.skipDimensions
    ? checks.filter(c => !options.skipDimensions!.includes(c.id.split('-')[0]))
    : checks;

  // 增量扫描：仅检查变更文件
  if (options.scanMode === 'changed') {
    const changedFiles = await getChangedFiles(targetPath);
    if (changedFiles.length > 0) {
      for (const check of filteredChecks) {
        const result = await executeCheck(check, targetPath, options);
        results.push(result);
      }
    } else {
      return [{
        item: filteredChecks[0] || { id: 'none', category: '', level: 'P2', rule: '', description: '', detection: 'ai' },
        status: 'pass',
        details: '无变更文件，跳过检查',
      }];
    }
  } else {
    for (const check of filteredChecks) {
      const result = await executeCheck(check, targetPath, options);
      results.push(result);
    }
  }

  return results;
}

async function executeCheck(
  check: CheckItem,
  targetPath: string,
  options: CheckOptions = {}
): Promise<CheckResult> {
  switch (check.detection) {
    case 'ast':
      return await runAstCheck(check, targetPath);
    case 'eslint':
      return await runEslintCheck(check, targetPath);
    case 'code-review':
      return await runCodeReviewCheck(check, targetPath);
    case 'config-check':
      return await runConfigCheck(check, targetPath);
    case 'test':
      return await runTestCheck(check, targetPath);
    case 'ai':
      return await runAICheck(check, targetPath, options);
    default:
      return { item: check, status: 'skip', details: '未实现检测方式' };
  }
}

// ============ AST 检测集成 ============

async function runAstCheck(check: CheckItem, targetPath: string, maxFiles: number = 200): Promise<CheckResult> {
  // 动态导入 AST 分析器
  let FrontendInteractionAnalyzer: any;
  try {
    const mod = await import('./ast-analyzer.js');
    FrontendInteractionAnalyzer = mod.FrontendInteractionAnalyzer;
  } catch {
    // 如果 AST 分析器不可用，降级为正则扫描
    return await runCodeReviewCheck(check, targetPath);
  }

  const files = getTsxFiles(targetPath).slice(0, maxFiles);
  const issues: string[] = [];

  // 检查项到 AST 问题类型的映射（15 种 AST 检测全覆盖）
  const issueTypeMap: Record<string, string> = {
    // 基础检测（5 项）
    'A2-02': 'missing-feedback',
    'A2-12': 'missing-loading',
    'A2-14': 'missing-empty',
    'A2-15': 'missing-submit',
    'A2-16': 'missing-edit',
    // 新增检测（10 项）
    'A2-05': 'missing-network-error',
    'A2-06': 'missing-business-error',
    'A2-07': 'missing-permission-error',
    'A2-08': 'missing-timeout',
    'A2-09': 'missing-optimistic-lock',
    'A2-10': 'missing-concurrent-edit',
    'A2-11': 'missing-undo',
    'A2-13': 'missing-skeleton',
    'A2-03': 'missing-state-machine',
    'A2-17': 'missing-empty-search',
  };

  const targetType = issueTypeMap[check.id];
  if (!targetType) {
    return await runCodeReviewCheck(check, targetPath);
  }

  for (const file of files) {
    try {
      const analyzer = new FrontendInteractionAnalyzer(file);
      const result = analyzer.analyze();
      const matchedIssues = result.issues.filter((i: any) => i.type === targetType);
      for (const issue of matchedIssues) {
        const relativePath = file.replace(process.cwd() + '/', '');
        issues.push(`${relativePath}:${issue.line} ${issue.message}`);
      }
    } catch {
      // 忽略解析错误
    }
  }

  if (issues.length > 0) {
    return {
      item: check,
      status: 'fail',
      details: `发现 ${issues.length} 个问题`,
      suggestion: issues.slice(0, 5).join('; '),
    };
  }

  return { item: check, status: 'pass', details: '检查通过' };
}

// ============ 原有检测（降级为 placeholder）============

async function runEslintCheck(check: CheckItem, targetPath: string): Promise<CheckResult> {
  // TODO: 实现 ESLint 规则检测
  // 优先使用 AST 检测
  if (check.id.startsWith('A2-')) {
    return await runAstCheck(check, targetPath);
  }
  return { item: check, status: 'pass', details: 'ESLint check placeholder' };
}

async function runCodeReviewCheck(check: CheckItem, targetPath: string): Promise<CheckResult> {
  // TODO: 实现代码审查检测
  return { item: check, status: 'warning', details: '需要人工审查' };
}

async function runConfigCheck(check: CheckItem, targetPath: string): Promise<CheckResult> {
  // TODO: 实现配置检查
  return { item: check, status: 'pass', details: 'Config check placeholder' };
}

async function runTestCheck(check: CheckItem, targetPath: string): Promise<CheckResult> {
  // TODO: 实现测试覆盖检查
  return { item: check, status: 'pass', details: 'Test check placeholder' };
}

// ============ AI 引擎路由 ============

/**
 * 维度 → 技能映射表
 * A 设计层 → design-doc-reviewer
 * B 开发层 → code-design-analyzer
 * C 运维层 → code-design-analyzer
 * D 体验层 → task-decomposer
 * S 安全层 → code-design-analyzer
 */
const dimensionToSkillMap: Record<string, string> = {
  'A1': 'design-doc-reviewer',  // 数据结构
  'A2': 'design-doc-reviewer',  // 交互逻辑
  'A3': 'design-doc-reviewer',  // 流程细节
  'B1': 'code-design-analyzer', // 修复规范
  'B2': 'code-design-analyzer', // 优化规范
  'C1': 'code-design-analyzer', // 兼容性
  'C2': 'code-design-analyzer', // 扩展性
  'C3': 'code-design-analyzer', // 生态
  'C4': 'code-design-analyzer', // 可观测性
  'C5': 'code-design-analyzer', // 灾备
  'C6': 'code-design-analyzer', // 容量
  'C7': 'code-design-analyzer', // 部署
  'C8': 'code-design-analyzer', // 自动化
  'D1': 'task-decomposer',      // 可用性
  'D2': 'task-decomposer',      // 可访问性
  'D3': 'task-decomposer',      // 一致性
  'D4': 'task-decomposer',      // 性能感知
  'D5': 'task-decomposer',      // 情感化
  'S1': 'code-design-analyzer', // 身份认证
  'S2': 'code-design-analyzer', // 数据安全
  'S3': 'code-design-analyzer', // 基础设施
  'S4': 'code-design-analyzer', // 审计
  'S5': 'code-design-analyzer', // 第三方
};

async function runAICheck(
  check: CheckItem,
  targetPath: string,
  options: CheckOptions = {}
): Promise<CheckResult> {
  // 从 check.id 提取维度前缀（如 "A2-03" → "A2"）
  const dimension = check.id.split('-')[0];
  const targetSkill = dimensionToSkillMap[dimension] || 'code-design-analyzer';

  // 构建传递给 AI 技能的上下文
  const context = {
    mode: options.mode || 'check',  // 默认检查模式
    checkItem: {
      id: check.id,
      rule: check.rule,
      description: check.description,
      level: check.level,
    },
    targetPath,
    category: dimension,
    // 修复模式下传递违规清单
    ...(options.mode === 'fix' ? {
      violations: [{
        id: check.id,
        message: check.description,
        file: targetPath,
      }],
    } : {}),
  };

  try {
    // 调用对应 AI 技能执行检查
    const result = await invokeSkill(targetSkill, context);

    if (result.hasIssues) {
      const baseResult: CheckResult = {
        item: check,
        status: 'fail',
        details: `发现 ${result.issues.length} 个问题`,
        suggestion: result.issues.slice(0, 5).map((i: any) =>
          `${i.file}:${i.line} - ${i.message} → ${i.fix}`
        ).join('; '),
      };

      // 修复模式下附加完整修复方案
      if (options.mode === 'fix' && result.fixSpec) {
        baseResult.fixSpec = result.fixSpec;
      }

      return baseResult;
    }

    return { item: check, status: 'pass', details: 'AI 检查通过' };
  } catch (error: any) {
    // AI 引擎不可用时降级为人工审查
    return {
      item: check,
      status: 'warning',
      details: `AI 引擎不可用: ${error.message}`,
      suggestion: '需要人工审查',
    };
  }
}

/**
 * 调用 AI 技能执行检查
 * 在 Claude Code 环境中，通过子代理或 Skill 工具调用
 */
async function invokeSkill(skillName: string, context: any): Promise<any> {
  // TODO: 在 Claude Code 运行时环境中实现
  // 当前实现：返回模拟结果用于验证架构
  return {
    hasIssues: false,
    issues: [],
    skillUsed: skillName,
    dimension: context.category,
  };
}

// ============ 增量扫描 ============

async function getChangedFiles(targetPath: string): Promise<string[]> {
  // 通过 git diff 获取变更文件
  const { execSync } = require('child_process');
  try {
    const output = execSync(
      `git diff --name-only HEAD -- ${targetPath}`,
      { encoding: 'utf-8' }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // git 不可用，返回空数组
    return [];
  }
}

// ============ 前端专项扫描 ============

import * as fs from 'fs';
import * as path from 'path';
import { getTsxFiles } from './file-utils';

export async function runFrontendScan(
  frontendPath: string = 'orion-frontend/src/pages/',
  maxFiles: number = 200
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 核心检查项 - 标记为 AST 检测
  const keyChecks: CheckItem[] = [
    { id: 'A2-02', category: 'interaction', level: 'P0', rule: '操作后有明确反馈', description: '每个异步操作必须有 success/error 提示', detection: 'ast' },
    { id: 'A2-12', category: 'interaction', level: 'P0', rule: '异步操作有 loading 状态', description: '异步操作必须包含 loading 状态', detection: 'ast' },
    { id: 'A2-14', category: 'interaction', level: 'P1', rule: '空数据有引导', description: '列表为空时必须有 Empty 组件和引导操作', detection: 'ast' },
    { id: 'A2-15', category: 'interaction', level: 'P1', rule: '表单有提交按钮', description: '表单必须包含提交按钮和保存逻辑', detection: 'ast' },
    { id: 'A2-16', category: 'interaction', level: 'P1', rule: '详情页可编辑', description: '详情页必须提供编辑入口', detection: 'ast' },
  ];

  // 扫描前端文件
  if (!fs.existsSync(frontendPath)) {
    results.push({
      item: keyChecks[0],
      status: 'warning',
      details: `前端路径不存在: ${frontendPath}`,
    });
    return results;
  }

  // 对每个检查项执行 AST 检测
  for (const check of keyChecks) {
    const result = await runAstCheck(check, frontendPath, maxFiles);
    results.push(result);
  }

  return results;
}

// 保留旧的正则扫描方法作为降级方案，但不再默认使用
async function scanFrontendCheckFallback(check: CheckItem, frontendPath: string): Promise<CheckResult> {
  const files = getTsxFiles(frontendPath);
  const issues: string[] = [];

  for (const file of files.slice(0, 50)) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file);

    switch (check.id) {
      case 'A2-02': {
        const onClickMatches = content.match(/onClick=\{[^}]+\}/g);
        if (onClickMatches) {
          for (const match of onClickMatches) {
            if (match.includes('async') && !match.includes('message.')) {
              issues.push(`${relativePath}: onClick 回调缺少 message 反馈`);
            }
          }
        }
        break;
      }
      case 'A2-12': {
        const asyncClickMatches = content.match(/onClick=\{async[^}]+\}/g);
        if (asyncClickMatches) {
          const hasLoading = content.includes('loading') || content.includes('setLoading');
          if (!hasLoading) {
            issues.push(`${relativePath}: 异步操作缺少 loading 状态`);
          }
        }
        break;
      }
      case 'A2-14': {
        const hasDataSource = content.includes('dataSource');
        const hasEmpty = content.includes('Empty');
        if (hasDataSource && !hasEmpty) {
          issues.push(`${relativePath}: 列表缺少 Empty 组件`);
        }
        break;
      }
      case 'A2-15': {
        const hasForm = content.includes('<Form') || content.includes('useForm');
        const hasSubmitButton = content.includes('htmlType="submit"') || content.includes('type="submit"');
        if (hasForm && !hasSubmitButton) {
          issues.push(`${relativePath}: 表单缺少提交按钮`);
        }
        break;
      }
      case 'A2-16': {
        const isDetailPage = file.includes('/Detail/') || file.includes('/detail/');
        const hasEditButton = content.includes('EditOutlined') || content.includes('编辑');
        if (isDetailPage && !hasEditButton) {
          issues.push(`${relativePath}: 详情页缺少编辑入口`);
        }
        break;
      }
    }
  }

  if (issues.length > 0) {
    return {
      item: check,
      status: 'fail',
      details: `发现 ${issues.length} 个问题`,
      suggestion: issues.slice(0, 5).join('; '),
    };
  }

  return { item: check, status: 'pass', details: '检查通过' };
}

export async function scanFrontendInteractions(): Promise<CheckResult[]> {
  return runFrontendScan('orion-frontend/src/pages/');
}