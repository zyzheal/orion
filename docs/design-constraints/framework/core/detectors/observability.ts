/**
 * Observability Detector — checks for traceId propagation, structured logging,
 * metrics exposure, and health check endpoints.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { BaseDetector, InteractionIssue } from './base';

export class ObservabilityDetector extends BaseDetector {
  type = 'observability' as const;

  analyze(): InteractionIssue[] {
    this.issues = [];
    this._analyzeLogging();
    this._analyzeTraceId();
    this._analyzeMetrics();
    this._analyzeHealthCheck();
    return this.issues;
  }

  private _analyzeLogging(): void {
    const visit = (node: ts.Node) => {
      // console.log/error instead of structured logger
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isPropertyAccessExpression(expr)) {
          if (ts.isIdentifier(expr.expression) && expr.expression.text === 'console') {
            const method = expr.name.text;
            if (['log', 'error', 'warn', 'info'].includes(method)) {
              this.issues.push({
                file: this.filePath,
                line: this.getLine(node),
                column: 1,
                type: 'unstructured-log',
                severity: 'P2',
                message: `使用 console.${method} 而非结构化日志`,
                suggestion: '使用 logger.error({traceId, tenantId}, "msg") 格式',
              });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(this.sourceFile, visit);
  }

  private _analyzeTraceId(): void {
    // Check if request/axios calls include traceId header
    const content = this.content;
    if (/(axios|request|apiClient)\.(get|post|put|delete)/.test(content) &&
        !/traceId|x-request-id|x-correlation-id/i.test(content)) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-traceId-injection',
        severity: 'P1',
        message: 'HTTP 客户端调用未注入 traceId',
        suggestion: '在 axios interceptor 中自动注入 x-request-id header',
      });
    }
  }

  private _analyzeMetrics(): void {
    if (/route|router/.test(this.content) &&
        !/metrics|prometheus|\/metrics/.test(this.content)) {
      // Only flag for service-level files
      if (!/\.test\.|\.spec\.|__tests__/.test(this.filePath)) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-metrics',
          severity: 'P2',
          message: '服务文件未暴露 metrics 端点',
          suggestion: '添加 /metrics 路由并暴露关键指标（请求数、错误率、延迟）',
        });
      }
    }
  }

  private _analyzeHealthCheck(): void {
    if (/route|router/.test(this.content) &&
        !/healthz|health|readyz|ready/.test(this.content)) {
      if (!/\.test\.|\.spec\.|__tests__/.test(this.filePath)) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-health-check',
          severity: 'P1',
          message: '路由文件未定义 health check 端点',
          suggestion: '添加 /healthz 和 /readyz 端点',
        });
      }
    }
  }

  private getLine(node: ts.Node): number {
    return this.sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  }
}
