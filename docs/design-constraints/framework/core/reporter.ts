// docs/design-constraints/framework/core/reporter.ts

import { CheckResult } from './checker';
import { DetectionResult } from './detector';

export interface Report {
  detection: DetectionResult;
  results: CheckResult[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    warning: number;
    skip: number;
    score: number;
  };
  p0Issues: CheckResult[];
  p1Issues: CheckResult[];
  nextSteps: string[];
}

export function generateReport(
  detection: DetectionResult,
  results: CheckResult[]
): Report {
  const summary = calculateSummary(results);
  const p0Issues = results.filter(
    (r) => r.item.level === 'P0' && (r.status === 'fail' || r.status === 'warning')
  );
  const p1Issues = results.filter(
    (r) => r.item.level === 'P1' && (r.status === 'fail' || r.status === 'warning')
  );

  return {
    detection,
    results,
    summary,
    p0Issues,
    p1Issues,
    nextSteps: generateNextSteps(p0Issues, p1Issues),
  };
}

function calculateSummary(results: CheckResult[]) {
  const total = results.length;
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  const warning = results.filter((r) => r.status === 'warning').length;
  const skip = results.filter((r) => r.status === 'skip').length;
  const score = Math.round((pass / total) * 100);

  return { total, pass, fail, warning, skip, score };
}

function generateNextSteps(p0Issues: CheckResult[], p1Issues: CheckResult[]): string[] {
  const steps: string[] = [];

  for (const issue of p0Issues) {
    steps.push(`[P0] ${issue.item.rule}: ${issue.details || issue.item.description}`);
  }

  for (const issue of p1Issues) {
    steps.push(`[P1] ${issue.item.rule}: ${issue.details || issue.item.description}`);
  }

  if (p0Issues.length + p1Issues.length > 0) {
    steps.push('');
    steps.push('💡 使用 /fix 触发 AI 修复引擎，自动生成完整修复方案');
    steps.push('   /skill design-constraint:fix --level P0  # 仅修复 P0');
    steps.push('   /skill design-constraint:fix --dimension A2  # 仅修复指定维度');
  }

  return steps;
}

export function formatReport(report: Report, options: { includeFixGuidance?: boolean } = {}): string {
  const lines = [
    '┌────────────────────────────────────────────────────────────┐',
    '│  Design Constraint Check Report (AI Enhanced)              │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Module:         ${report.detection.module.padEnd(44)}│`,
    `│  Code Type:      ${report.detection.codeType.padEnd(44)}│`,
    `│  Total Checks:   ${report.summary.total.toString().padEnd(44)}│`,
    `│  Pass:           ${report.summary.pass.toString().padEnd(44)}│`,
    `│  Fail:           ${report.summary.fail.toString().padEnd(44)}│`,
    `│  Warning:        ${report.summary.warning.toString().padEnd(44)}│`,
    `│  Score:          ${report.summary.score}/100${' '.repeat(33)}│`,
    '├────────────────────────────────────────────────────────────┤',
    '│  [P0] Issues                                               │',
  ];

  for (const issue of report.p0Issues) {
    const line = `│    ✗ ${issue.item.id}: ${issue.item.rule}`;
    lines.push(line.padEnd(60) + '│');
    if (issue.suggestion) {
      const fixLine = `│      → AI修复: ${issue.suggestion.substring(0, 45)}`;
      lines.push(fixLine.padEnd(60) + '│');
    }
  }

  if (report.p0Issues.length === 0) {
    lines.push('│    (无 P0 问题)                                          │');
  }

  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push('│  [P1] Suggestions                                          │');

  for (const issue of report.p1Issues.slice(0, 5)) {
    const line = `│    ○ ${issue.item.id}: ${issue.item.rule}`;
    lines.push(line.padEnd(60) + '│');
  }

  if (report.p1Issues.length > 5) {
    lines.push(`│    ... 还有 ${report.p1Issues.length - 5} 项                                    │`);
  }

  // AI 修复引导
  if (options.includeFixGuidance && report.p0Issues.length + report.p1Issues.length > 0) {
    lines.push('├────────────────────────────────────────────────────────────┤');
    lines.push('│  [Next Steps]                                              │');
    lines.push('│  💡 /skill design-constraint:fix 触发 AI 修复引擎          │');
    lines.push('│     → 三技能并行生成交互规格 + Token 映射 + 子任务表       │');
    lines.push('│                                                            │');
    lines.push('│  复查: /skill design-constraint:check --scan-mode changed  │');
    lines.push('└────────────────────────────────────────────────────────────┘');
  } else {
    lines.push('└────────────────────────────────────────────────────────────┘');
  }

  return lines.join('\n');
}