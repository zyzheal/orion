/**
 * 快速设计约束分析器
 * 3秒内输出结果，聚焦高频问题
 * 适合智能体开发过程中快速检查
 */

import * as fs from 'fs';
import * as path from 'path';

export interface QuickIssue {
  id: string;
  severity: 'P0' | 'P1';
  title: string;
  line: number;
  code: string;
  fix: string;
}

export interface QuickAnalysisResult {
  file: string;
  issues: QuickIssue[];
  stats: {
    p0: number;
    p1: number;
  };
}

// ============ 优化后的检测规则 ============
// 针对误报问题进行了智能过滤

const HIGH_FREQUENCY_RULES: Array<{
  id: string;
  severity: 'P0' | 'P1';
  title: string;
  // 检测逻辑：返回 [是否通过检测, 问题描述]
  detector: (line: string, context: string, fullContent: string) => [boolean, string?];
  fix: string;
}> = [
  // A2-12: 异步操作缺少 loading 状态（优化版）
  // 只检测用户操作触发的异步函数，排除 useEffect/数据加载
  {
    id: 'A2-12',
    severity: 'P0',
    title: '异步操作缺少 loading 状态',
    detector: (line: string, context: string) => {
      // 用户操作触发函数模式
      const userActionPatterns = [
        /handle\w+/i,      // handleSubmit, handleDelete
        /on[A-Z]\w+/i,     // onClick, onSubmit
        /submit\w+/i,      // submitForm
        /create\w+/i,      // createItem
        /edit\w+/i,        // editItem
        /save\w+/i,        // saveData
        /delete\w+/i,      // deleteItem
        /remove\w+/i,      // removeItem
        /update\w+/i,      // updateItem
        /add\w+/i,         // addItem
      ];

      // 排除模式
      const excludePatterns = [
        /useEffect/i,      // useEffect 中的异步不是用户触发
        /useCallback/i,    // 回调中的异步
        /fetchData/i,      // 数据加载（通常有独立的 loading）
        /load\w+/i,        // 数据加载函数
        /getData/i,        // 获取数据
        /watch/i,          // watch 监听器
        /useMemo/i,        // 计算属性
      ];

      // 检测 async 函数定义
      const asyncMatch = line.match(/(?:async\s+)?(?:function\s+)?(\w+)\s*[=\(]/);
      if (!asyncMatch) return [false];

      const funcName = asyncMatch[1];

      // 检查是否需要排除
      if (excludePatterns.some(p => p.test(funcName))) {
        return [false];
      }

      // 检查是否是用户操作函数
      if (!userActionPatterns.some(p => p.test(funcName))) {
        return [false];
      }

      // 检查函数体内是否已有 loading 逻辑
      if (/loading|setLoading|disabled/i.test(context)) {
        return [false];
      }

      return [true, `${funcName} 是用户操作触发的异步函数，需要 loading 状态`];
    },
    fix: '添加 const [loading, setLoading] = useState(false)，请求时 setLoading(true)，完成时 setLoading(false)',
  },
  // A2-02: 操作后缺少 message 反馈
  {
    id: 'A2-02',
    severity: 'P0',
    title: '异步操作缺少成功/失败提示',
    detector: (line: string, context: string) => {
      if (!/await\s+(\w+)\.(get|post|put|delete|mutate)/.test(line)) {
        return [false];
      }
      if (/message\.(success|error|warning|info)/i.test(context)) {
        return [false];
      }
      return [true];
    },
    fix: '在 try 块中添加 message.success("操作成功")，catch 块中添加 message.error(error.message)',
  },
  // A2-14: 列表缺少 Empty 空状态
  {
    id: 'A2-14',
    severity: 'P0',
    title: '列表缺少 Empty 空状态引导',
    detector: (line: string, context: string) => {
      if (!/\{.*\.map\(|dataSource\s*=\{|\{\s*list|\.map\(\s*\([^)]*\)\s*=>/.test(line)) {
        return [false];
      }
      if (/<Empty|empty.*=|data\.length\s*===?\s*0|data\?\.\w+\.length/i.test(context)) {
        return [false];
      }
      return [true];
    },
    fix: '添加 {data?.length === 0 && <Empty description="暂无数据" />} 或使用 antd 4.x 的 list.emptyText',
  },
  // A3-16: 危险操作缺少二次确认（优化版）
  // 只检测 Button 组件中的危险操作，排除变量声明
  {
    id: 'A3-16',
    severity: 'P0',
    title: '删除/危险操作缺少二次确认',
    detector: (line: string, context: string, fullContent: string) => {
      // 只检测 Button 或 Link 组件中的危险操作
      const buttonDangerPattern = /<(Button|a)[^>]*>.*(删除|移除|注销|delete|remove|destroy|清空|clear).*<\/\1>/i;
      if (!buttonDangerPattern.test(line)) {
        return [false];
      }

      // 检查是否已有确认组件
      if (/Popconfirm|Modal\.confirm|confirm\(/.test(context)) {
        return [false];
      }

      // 检查同级别上下文是否有确认
      const funcNameMatch = line.match(/onClick=\{(\w+)\}/);
      if (funcNameMatch) {
        const funcName = funcNameMatch[1];
        const funcPattern = new RegExp(`const\\s+${funcName}\\s*=[^{]*\\{[^}]*confirm`, 'i');
        if (funcPattern.test(context)) {
          return [false];
        }
      }

      return [true];
    },
    fix: '使用 <Popconfirm title="确认删除?" onConfirm={handleDelete}><Button>删除</Button></Popconfirm>',
  },
  // D3-01: 使用硬编码颜色（优化版）
  // 只检测内联 style 中的硬编码，排除 Token 使用
  {
    id: 'D3-01',
    severity: 'P1',
    title: '使用硬编码颜色值',
    detector: (line: string, context: string) => {
      // 检测内联 style 中的硬编码颜色
      const colorPattern = /(?:style\s*=\s*\{\{?|color\s*:\s*)['"]#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})['"]/;
      const match = line.match(colorPattern);
      if (!match) {
        return [false];
      }

      // 排除 Token 使用
      if (/colors\.\w+\[|DesignToken|theme\./i.test(line)) {
        return [false];
      }

      // 排除 CSS 变量定义
      if (/const\s+\w*[Cc]olor\s*=|let\s+\w*[Cc]olor\s*=/.test(line)) {
        return [false];
      }

      // 排除颜色是变量的引用（如 color={bgColor}）
      if (/color\s*=\s*\{\s*\w+/.test(line) && !/#/.test(line)) {
        return [false];
      }

      return [true, `检测到硬编码颜色 #${match[1]}`];
    },
    fix: '改用 import { colors } from "@/tokens"，使用 colors.primary[500] 等 Token',
  },
  // A1-06: 使用 any 类型（优化版）
  // 排除 catch 块中的合理用法
  {
    id: 'A1-06',
    severity: 'P1',
    title: '使用 any 类型断言',
    detector: (line: string, context: string) => {
      // 排除 catch 块中的 error: any（合理用法）
      if (/catch\s*\(\s*\w+\s*:\s*any\s*\)/.test(line)) {
        return [false];
      }

      // 排除 any 联合类型（如 string | any）
      if (/:.*\|\s*any\b/.test(line)) {
        return [false];
      }

      // 排除 React 相关合理用法
      if (/React\.ref|useRef.*:?\s*any/i.test(line)) {
        return [false];
      }

      // 只报告真正的问题
      const problemPatterns = [
        /useState<any>/,                     // useState<any>
        /useEffect.*:\s*any/,                // useEffect 返回 any
        /function\s+\w+\s*\([^)]*\)\s*:\s*any/,  // 函数返回 any
        /:\s*any\b(?!\s*\|)/,                // 直接标为 any（不含联合类型）
      ];

      if (!problemPatterns.some(p => p.test(line))) {
        return [false];
      }

      return [true];
    },
    fix: '添加具体类型定义，或使用 unknown 配合类型守卫',
  },
  // B1-07: 日志包含敏感信息
  {
    id: 'B1-07',
    severity: 'P0',
    title: '日志可能包含敏感信息',
    detector: (line: string, context: string) => {
      if (!/(console\.(log|info|warn|error)|logger\.(log|info|warn|error))/.test(line)) {
        return [false];
      }
      if (/password|token|secret|apiKey|credential|auth|authorization/i.test(line)) {
        // 检查是否有掩码处理
        if (/\*\*\*|mask|hide|redact/i.test(line)) {
          return [false];
        }
        return [true, '日志可能包含敏感信息'];
      }
      return [false];
    },
    fix: '确保日志不包含 password/token/secret 等敏感信息，使用 *** 掩码',
  },
  // A1-01: map 渲染缺少 key 属性
  {
    id: 'A1-01',
    severity: 'P0',
    title: 'map 渲染缺少 key 属性',
    detector: (line: string, context: string) => {
      // 检测 .map() 渲染
      const mapPattern = /\.map\s*\(\s*\([^)]*\)\s*=>/;
      if (!mapPattern.test(line)) {
        return [false];
      }

      // 检查是否已有 key
      if (/key\s*=/.test(line)) {
        return [false];
      }

      // 排除 List 组件等自动处理 key 的情况
      if (/List\.|antd|ListComponent/i.test(line)) {
        return [false];
      }

      return [true];
    },
    fix: '添加 key={item.id} 或 key={index}（不推荐）',
  },
];

// ============ 快速分析器 ============

export class QuickAnalyzer {
  private filePath: string;
  private content: string;
  private lines: string[];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.lines = this.content.split('\n');
  }

  /**
   * 执行快速分析
   */
  analyze(): QuickAnalysisResult {
    const issues: QuickIssue[] = [];

    // 只分析前 200 行（快速分析）
    const analysisLines = this.lines.slice(0, 200);
    const fullContent = analysisLines.join('\n');

    for (const rule of HIGH_FREQUENCY_RULES) {
      analysisLines.forEach((line, index) => {
        // 跳过注释行和空行
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        // 获取上下文（前3行+当前行+后2行）
        const context = this.getContext(index);

        // 使用智能检测器
        const [isIssue, customMessage] = rule.detector(line, context, fullContent);

        if (isIssue) {
          issues.push({
            id: rule.id,
            severity: rule.severity,
            title: customMessage || rule.title,
            line: index + 1,
            code: line.trim().substring(0, 60),
            fix: rule.fix,
          });
        }
      });
    }

    // 去重（同一行只报一次）
    const uniqueIssues = this.deduplicate(issues);

    return {
      file: this.filePath,
      issues: uniqueIssues,
      stats: {
        p0: uniqueIssues.filter(i => i.severity === 'P0').length,
        p1: uniqueIssues.filter(i => i.severity === 'P1').length,
      },
    };
  }

  /**
   * 获取上下文（前3行+当前行+后2行）
   */
  private getContext(lineIndex: number): string {
    const start = Math.max(0, lineIndex - 3);
    const end = Math.min(this.lines.length, lineIndex + 3);
    return this.lines.slice(start, end).join('\n');
  }

  /**
   * 去重
   */
  private deduplicate(issues: QuickIssue[]): QuickIssue[] {
    const seen = new Set<string>();
    return issues.filter(issue => {
      const key = `${issue.id}-${issue.line}-${issue.code.substring(0, 20)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// ============ 批量快速扫描 ============

export class QuickScanner {
  /**
   * 快速扫描文件或目录
   */
  async scan(targetPath: string, maxFiles: number = 10): Promise<QuickAnalysisResult[]> {
    const results: QuickAnalysisResult[] = [];
    const files = this.getTargetFiles(targetPath, maxFiles);

    for (const file of files) {
      try {
        const analyzer = new QuickAnalyzer(file);
        const result = analyzer.analyze();
        if (result.issues.length > 0) {
          results.push(result);
        }
      } catch (e) {
        // 跳过解析错误
      }
    }

    return results;
  }

  private getTargetFiles(targetPath: string, maxFiles: number): string[] {
    const files: string[] = [];

    if (fs.statSync(targetPath).isFile()) {
      return [targetPath];
    }

    // 排除目录清单 - 与 ast-analyzer.ts 和 checker.ts 保持一致
    const EXCLUDED_DIRS = [
      '.git', '.next', 'node_modules', '__tests__', '__mocks__',
      'coverage', 'dist', 'build',
    ];
    // 排除 *-svc 副本目录（与主页面重复，避免计数翻倍）
    const SVC_DIR_PATTERN = /-svc$/;

    const traverse = (dir: string) => {
      if (files.length >= maxFiles) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (files.length >= maxFiles) return;

          // 排除已知目录
          if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) continue;
          // 排除 *-svc 副本目录
          if (entry.isDirectory() && SVC_DIR_PATTERN.test(entry.name)) continue;

          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            traverse(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.spec.tsx')) {
            files.push(fullPath);
          }
        }
      } catch (e) {
        // 忽略
      }
    };

    traverse(targetPath);
    return files;
  }
}

// ============ 格式化输出 ============

export function formatQuickResult(results: QuickAnalysisResult[]): string {
  if (results.length === 0) {
    return '✅ 未发现高频问题，代码符合基本规范';
  }

  let output = '\n┌────────────────────────────────────────────────────────────┐\n';
  output += '│  Quick Analysis Result                                     │\n';
  output += '├────────────────────────────────────────────────────────────┤\n';

  const totalP0 = results.reduce((sum, r) => sum + r.stats.p0, 0);
  const totalP1 = results.reduce((sum, r) => sum + r.stats.p1, 0);
  const totalIssues = totalP0 + totalP1;

  output += `│  Issues:   ${totalIssues} 个 (P0: ${totalP0}, P1: ${totalP1})              │\n`;
  output += '├────────────────────────────────────────────────────────────┤\n';

  for (const result of results) {
    for (const issue of result.issues) {
      const prefix = issue.severity === 'P0' ? '[P0]' : '[P1]';
      const fileName = path.basename(result.file);

      output += `│  ${prefix} ${issue.id} ${issue.title}\n`;
      output += `│        ${fileName}:${issue.line}\n`;
      output += `│        代码: ${issue.code.substring(0, 40)}...\n`;
      output += `│        修复: ${issue.fix.substring(0, 35)}...\n`;
      output += '├────────────────────────────────────────────────────────────┤\n';
    }
  }

  output += '│  修复建议: 参考上方 Fix 部分进行修改                        │\n';
  output += '└────────────────────────────────────────────────────────────┘\n';

  return output;
}

// ============ 便捷入口 ============

export async function quickCheck(targetPath: string): Promise<string> {
  const scanner = new QuickScanner();
  const results = await scanner.scan(targetPath);
  return formatQuickResult(results);
}

// 使用示例
// quickCheck('orion-frontend/src/pages/Pipeline/').then(console.log);