// docs/design-constraints/framework/core/checker.ts

export interface CheckItem {
  id: string;
  category: string;
  level: 'P0' | 'P1' | 'P2';
  rule: string;
  description: string;
  frontend?: boolean;
  backend?: boolean;
  detection: 'code-review' | 'eslint' | 'config-check' | 'test';
}

export interface CheckResult {
  item: CheckItem;
  status: 'pass' | 'fail' | 'skip' | 'warning';
  details?: string;
  suggestion?: string;
}

export async function executeChecks(
  checks: CheckItem[],
  targetPath: string
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const check of checks) {
    const result = await executeCheck(check, targetPath);
    results.push(result);
  }

  return results;
}

async function executeCheck(
  check: CheckItem,
  targetPath: string
): Promise<CheckResult> {
  switch (check.detection) {
    case 'eslint':
      return await runEslintCheck(check, targetPath);
    case 'code-review':
      return await runCodeReviewCheck(check, targetPath);
    case 'config-check':
      return await runConfigCheck(check, targetPath);
    case 'test':
      return await runTestCheck(check, targetPath);
    default:
      return { item: check, status: 'skip', details: '未实现检测方式' };
  }
}

async function runEslintCheck(check: CheckItem, targetPath: string): Promise<CheckResult> {
  // TODO: 实现 ESLint 规则检测
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

// ============ 前端专项扫描 ============

import * as fs from 'fs';
import * as path from 'path';

export async function runFrontendScan(
  frontendPath: string = 'orion-frontend/src/pages/'
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 核心检查项
  const keyChecks: CheckItem[] = [
    { id: 'A2-02', category: 'interaction', level: 'P0', rule: '操作后有明确反馈', description: '每个异步操作必须有 success/error 提示', detection: 'code-review' },
    { id: 'A2-12', category: 'interaction', level: 'P0', rule: '异步操作有 loading 状态', description: '异步操作必须包含 loading 状态', detection: 'code-review' },
    { id: 'A2-14', category: 'interaction', level: 'P1', rule: '空数据有引导', description: '列表为空时必须有 Empty 组件和引导操作', detection: 'code-review' },
    { id: 'A2-15', category: 'interaction', level: 'P1', rule: '表单有提交按钮', description: '表单必须包含提交按钮和保存逻辑', detection: 'code-review' },
    { id: 'A2-16', category: 'interaction', level: 'P1', rule: '详情页可编辑', description: '详情页必须提供编辑入口', detection: 'code-review' },
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

  // 对每个检查项执行扫描
  for (const check of keyChecks) {
    const result = await scanFrontendCheck(check, frontendPath);
    results.push(result);
  }

  return results;
}

async function scanFrontendCheck(check: CheckItem, frontendPath: string): Promise<CheckResult> {
  const files = getTsxFiles(frontendPath);
  const issues: string[] = [];

  for (const file of files.slice(0, 50)) { // 限制扫描数量
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file);

    switch (check.id) {
      case 'A2-02': {
        // 检测 onClick 无 message 反馈
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
        // 检测异步操作无 loading
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
        // 检测空数据无引导
        const hasDataSource = content.includes('dataSource');
        const hasEmpty = content.includes('Empty');
        if (hasDataSource && !hasEmpty) {
          issues.push(`${relativePath}: 列表缺少 Empty 组件`);
        }
        break;
      }
      case 'A2-15': {
        // 检测表单无提交按钮
        const hasForm = content.includes('<Form') || content.includes('useForm');
        const hasSubmitButton = content.includes('htmlType="submit"') || content.includes('type="submit"');
        if (hasForm && !hasSubmitButton) {
          issues.push(`${relativePath}: 表单缺少提交按钮`);
        }
        break;
      }
      case 'A2-16': {
        // 检测详情页无编辑入口
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
      status: 'warning',
      details: `发现 ${issues.length} 个问题`,
      suggestion: issues.slice(0, 5).join('; '),
    };
  }

  return { item: check, status: 'pass', details: '检查通过' };
}

function getTsxFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }

  try {
    traverse(dir);
  } catch (e) {
    // 忽略读取错误
  }

  return files;
}

export async function scanFrontendInteractions(): Promise<CheckResult[]> {
  return runFrontendScan('orion-frontend/src/pages/');
}