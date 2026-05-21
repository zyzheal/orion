/**
 * AST 增强型前端交互检测器
 * 使用 TypeScript AST 解析实现深度代码分析
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export type InteractionIssueType =
  // 基础检测（原有5项）
  | 'missing-feedback' | 'missing-loading' | 'missing-empty' | 'missing-submit' | 'missing-edit'
  // 新增检测（10项）
  | 'missing-network-error' | 'missing-business-error' | 'missing-permission-error'
  | 'missing-timeout' | 'missing-optimistic-lock' | 'missing-concurrent-edit'
  | 'missing-undo' | 'missing-skeleton' | 'missing-state-machine'
  | 'missing-animation' | 'missing-empty-search';

export interface InteractionIssue {
  file: string;
  line: number;
  column: number;
  type: InteractionIssueType;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion: string;
}

export interface ScanResult {
  file: string;
  issues: InteractionIssue[];
  stats: {
    functions: number;
    handlers: number;
    apis: number;
  };
}

// ============ 核心 AST 分析器 ============

export class FrontendInteractionAnalyzer {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;

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
   * 分析文件中的交互问题
   */
  analyze(): ScanResult {
    const issues: InteractionIssue[] = [];
    const stats = { functions: 0, handlers: 0, apis: 0 };

    // ============ 原有检测（5项）============

    // 1. 检测操作后缺少反馈
    issues.push(...this.detectMissingFeedback());

    // 2. 检测异步操作缺少 loading
    issues.push(...this.detectMissingLoading());

    // 3. 检测列表缺少 Empty 引导
    issues.push(...this.detectMissingEmpty());

    // 4. 检测表单缺少提交按钮
    issues.push(...this.detectMissingSubmit());

    // 5. 检测详情页缺少编辑入口
    issues.push(...this.detectMissingEdit());

    // ============ 新增检测（10项）============

    // 6. A2-03: 检测状态机定义
    issues.push(...this.detectMissingStateMachine());

    // 7. A2-04: 检测状态变化动画
    issues.push(...this.detectMissingAnimation());

    // 8. A2-05: 网络错误处理
    issues.push(...this.detectMissingNetworkError());

    // 9. A2-06: 业务错误提示
    issues.push(...this.detectMissingBusinessError());

    // 10. A2-07: 权限不足提示
    issues.push(...this.detectMissingPermissionError());

    // 11. A2-08: 超时处理
    issues.push(...this.detectMissingTimeout());

    // 12. A2-09: 乐观锁/冲突检测
    issues.push(...this.detectMissingOptimisticLock());

    // 13. A2-10: 并发操作提示
    issues.push(...this.detectMissingConcurrentEdit());

    // 14. A2-11: 关键操作可撤销
    issues.push(...this.detectMissingUndo());

    // 15. A2-13: 骨架屏/占位符
    issues.push(...this.detectMissingSkeleton());

    // 16. A2-15: 空搜索结果提示
    issues.push(...this.detectMissingEmptySearch());

    // 统计信息
    this.collectStats(stats);

    return {
      file: this.filePath,
      issues,
      stats,
    };
  }

  /**
   * 检测缺少 message 反馈的问题
   * 查找所有异步操作（onClick, useEffect, 自定义方法）
   */
  private detectMissingFeedback(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];
    const visited = new Set<number>(); // 避免重复报告

    // 1. 检测 onClick 异步处理器
    const findOnClickHandlers = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && node.name.text === 'onClick') {
        const handler = node.initializer;
        if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
          const isAsync = this.isAsyncFunction(handler);
          const hasMessageCall = this.hasMessageCall(handler);
          const hasTryCatch = this.hasTryCatch(handler);

          // 如果是异步操作且没有 message 调用，或者有 tryCatch 但没有在 finally 中处理
          if (isAsync && !hasMessageCall) {
            const { line, column } = this.getLineColumn(handler);
            const key = `${line}-${column}`;
            if (!visited.has(line)) {
              visited.add(line);
              issues.push({
                file: this.filePath,
                line,
                column,
                type: 'missing-feedback',
                severity: 'P0',
                message: '异步操作缺少成功/失败提示',
                suggestion: '添加 message.success() 或 message.error() 反馈',
              });
            }
          }
        }
      }
      ts.forEachChild(node, findOnClickHandlers);
    };

    // 2. 检测 async 方法定义（包括箭头函数赋值）
    const findAsyncMethods = (node: ts.Node) => {
      // 检测方法声明
      if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
          const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
          const hasBody = node.body;

          if (isAsync && hasBody) {
            const hasMessageCall = this.hasMessageCall(node.body!);
            const { line, column } = this.getLineColumn(node);

            if (!hasMessageCall && !visited.has(line)) {
              visited.add(line);
              const methodName = node.name.text;
              if (/^(handle|on|submit|save|delete|create|update|remove)/i.test(methodName)) {
                issues.push({
                  file: this.filePath,
                  line,
                  column,
                  type: 'missing-feedback',
                  severity: 'P0',
                  message: `方法 ${methodName} 缺少操作反馈`,
                  suggestion: '添加 message.success() 或 message.error() 反馈',
                });
              }
            }
          }
        }
      }

      // 检测箭头函数赋值（如 const loadData = async () => {}）
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isVariableDeclaration(decl) && decl.initializer) {
            const init = decl.initializer;
            if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
              const isAsync = init.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
              if (isAsync && init.body) {
                const hasMessageCall = this.hasMessageCall(init.body);
                const { line, column } = this.getLineColumn(decl);

                if (!hasMessageCall && !visited.has(line)) {
                  visited.add(line);
                  const varName = decl.name.getText(this.sourceFile);
                  // 只报告可能是操作类型的方法
                  if (/^(load|fetch|get|save|submit|create|update|delete|remove|handle|exec|runs)/i.test(varName)) {
                    issues.push({
                      file: this.filePath,
                      line,
                      column,
                      type: 'missing-feedback',
                      severity: 'P0',
                      message: `函数 ${varName} 缺少操作反馈`,
                      suggestion: '添加 message.success() 或 message.error() 反馈',
                    });
                  }
                }
              }
            }
          }
        }
      }
      ts.forEachChild(node, findAsyncMethods);
    };

    // 3. 检测 useRequest / useMutation 调用
    const findUseRequest = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isIdentifier(expr)) {
          // 检测 useRequest 或类似 hooks
          if (/^use(Request|Mutation|Async)$/.test(expr.text)) {
            const options = node.arguments[1];
            if (options && ts.isObjectLiteralExpression(options)) {
              // 检查是否有 onSuccess 或 onError 回调
              const hasSuccessHandler = options.properties.some(
                p => ts.isPropertyAssignment(p) && p.name.text === 'onSuccess'
              );
              const hasErrorHandler = options.properties.some(
                p => ts.isPropertyAssignment(p) && p.name.text === 'onError'
              );
              const { line, column } = this.getLineColumn(node);

              if (!hasSuccessHandler && !visited.has(line)) {
                visited.add(line);
                issues.push({
                  file: this.filePath,
                  line,
                  column,
                  type: 'missing-feedback',
                  severity: 'P0',
                  message: 'useRequest 缺少 onSuccess 回调处理',
                  suggestion: '添加 onSuccess: () => message.success("成功")',
                });
              }
            }
          }
        }
      }
      ts.forEachChild(node, findUseRequest);
    };

    ts.forEachChild(this.sourceFile, findOnClickHandlers);
    ts.forEachChild(this.sourceFile, findAsyncMethods);
    ts.forEachChild(this.sourceFile, findUseRequest);

    return issues;
  }

  /**
   * 检测缺少 loading 状态的问题
   * 增强版：检测每个异步处理器是否有独立的 loading 状态
   */
  private detectMissingLoading(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];
    const visited = new Set<number>();

    // 1. 检测 onClick 异步处理器
    const findOnClickHandlers = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && node.name.text === 'onClick') {
        const handler = node.initializer;

        if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
          const isAsync = this.isAsyncFunction(handler);
          const hasIndividualLoading = this.hasIndividualLoadingState(handler);
          const { line, column } = this.getLineColumn(handler);

          if (isAsync && !hasIndividualLoading && !visited.has(line)) {
            visited.add(line);
            issues.push({
              file: this.filePath,
              line,
              column,
              type: 'missing-loading',
              severity: 'P0',
              message: '异步操作缺少 loading 状态',
              suggestion: '添加 loading state 并在操作时设置按钮 disabled',
            });
          }
        }
      }
      ts.forEachChild(node, findOnClickHandlers);
    };

    // 2. 检测 async 方法（包括箭头函数赋值）
    const findAsyncMethods = (node: ts.Node) => {
      // 检测方法声明
      if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
          const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
          const hasBody = node.body;

          if (isAsync && hasBody) {
            const hasLoadingRef = this.hasLoadingRefInMethod(node.name.text);
            const { line, column } = this.getLineColumn(node);
            const methodName = node.name.text;

            if (!hasLoadingRef && !visited.has(line) &&
                /^(handle|on|submit|save|delete|create|update|remove|fetch|load)/i.test(methodName)) {
              visited.add(line);
              issues.push({
                file: this.filePath,
                line,
                column,
                type: 'missing-loading',
                severity: 'P0',
                message: `方法 ${methodName} 缺少 loading 状态`,
                suggestion: '添加 loading state 并在操作前设置为 true，操作完成后设置为 false',
              });
            }
          }
        }
      }

      // 检测箭头函数赋值
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isVariableDeclaration(decl) && decl.initializer) {
            const init = decl.initializer;
            if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
              const isAsync = init.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
              if (isAsync && init.body) {
                const varName = decl.name.getText(this.sourceFile);
                // 检查函数体是否使用了 loading 状态
                const bodyText = init.body.getText(this.sourceFile);
                const hasLoading = /setLoading|loading\s*=|disabled.*loading/.test(bodyText);
                const { line, column } = this.getLineColumn(decl);

                if (!hasLoading && !visited.has(line)) {
                  visited.add(line);
                  if (/^(load|fetch|get|save|submit|create|update|delete|remove|handle|exec|runs)/i.test(varName)) {
                    issues.push({
                      file: this.filePath,
                      line,
                      column,
                      type: 'missing-loading',
                      severity: 'P0',
                      message: `函数 ${varName} 缺少 loading 状态`,
                      suggestion: '添加 loading state 并在操作前设置为 true，操作完成后设置为 false',
                    });
                  }
                }
              }
            }
          }
        }
      }
      ts.forEachChild(node, findAsyncMethods);
    };

    // 3. 检测 useRequest 没有 loading 配置
    const findUseRequestLoading = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isIdentifier(expr) && /^use(Request|Mutation)$/.test(expr.text)) {
          const options = node.arguments[0] || node.arguments[1];
          if (options && ts.isObjectLiteralExpression(options)) {
            const hasLoadingProp = options.properties.some(
              p => ts.isPropertyAssignment(p) && p.name.text === 'loading'
            );
            const { line, column } = this.getLineColumn(node);

            if (!hasLoadingProp && !visited.has(line)) {
              visited.add(line);
              issues.push({
                file: this.filePath,
                line,
                column,
                type: 'missing-loading',
                severity: 'P0',
                message: 'useRequest 未配置 loading 状态',
                suggestion: '配置 loading 状态: const { loading, run } = useRequest(...)',
              });
            }
          }
        }
      }
      ts.forEachChild(node, findUseRequestLoading);
    };

    ts.forEachChild(this.sourceFile, findOnClickHandlers);
    ts.forEachChild(this.sourceFile, findAsyncMethods);
    ts.forEachChild(this.sourceFile, findUseRequestLoading);

    return issues;
  }

  /**
   * 检测列表缺少 Empty 组件
   */
  private detectMissingEmpty(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检查是否有 dataSource 或 data prop
    const hasDataSource = /\b(dataSource|data)\b/.test(this.content);
    const hasEmpty = /\b<Empty\b/.test(this.content);
    const isListComponent = this.isListComponent();

    if (hasDataSource && isListComponent && !hasEmpty) {
      // 查找数据加载完成后的条件渲染
      const hasConditionalRender = /\{\s*.*data(Source)?\s*&&\s*</.test(this.content);

      if (hasConditionalRender) {
        issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-empty',
          severity: 'P1',
          message: '列表数据可能为空但缺少 Empty 组件',
          suggestion: '添加 <Empty description="暂无数据" /> 或使用 dataSource?.length === 0 条件渲染',
        });
      }
    }

    return issues;
  }

  /**
   * 检测表单缺少提交按钮 - 优化版
   * 识别多种提交方式：htmlType submit, Modal onOk, Button onClick
   */
  private detectMissingSubmit(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 1. 检查是否有 Form
    const hasForm = this.content.includes('<Form') || this.content.includes('useForm');
    if (!hasForm) return issues;

    // 2. 检查是否有提交按钮或提交处理
    // 方式1: htmlType="submit"
    const hasHtmlTypeSubmit = /htmlType\s*=\s*["']submit["']/.test(this.content);

    // 方式2: 提交/保存/确定按钮（带 onClick，包括 handleSave/handleSubmit 等处理函数）
    // 支持: onClick={handleSave}>保存 和 onClick={handleSave} loading>保存 两种模式
    const hasSubmitButton = /<Button[^>]*onClick=\{[^}]+\}[^>]*>(提交|保存|确定|Submit)<\/Button>/.test(this.content) ||
                          /<Button[^>]*onClick=\{handle(Save|Submit|SubmitForm)[^}]*\}\s*[^>]*>/.test(this.content) ||
                          /onClick=\{handle(Save|Submit)\}/.test(this.content);

    // 方式3: Modal 有 onOk 处理
    const hasModalOk = /onOk\s*=\s*\{/.test(this.content);

    // 方式4: Drawer 有 onOk 处理
    const hasDrawerOk = /onOk\s*=\s*\{/.test(this.content);

    // 方式5: 使用 form.onFinish
    const hasFormOnFinish = /form\.onFinish|onFinish\s*=\s*\{/.test(this.content);

    // 方式6: 使用 @ant-design/form 的 onFinish
    const hasAntFormFinish = /onFinish\s*=\s*\{[^}]*handle(Save|Submit|Submit)/.test(this.content);

    const hasSubmitHandler = hasHtmlTypeSubmit || hasSubmitButton || hasModalOk || hasDrawerOk || hasFormOnFinish || hasAntFormFinish;

    if (hasForm && !hasSubmitHandler) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-submit',
        severity: 'P1',
        message: '表单缺少提交按钮',
        suggestion: '添加 <Button htmlType="submit">提交</Button> 或 Modal onOk 处理',
      });
    }

    return issues;
  }

  /**
   * 检测详情页缺少编辑入口 - 优化版
   * 排除只读展示页面、Drawer 内容页
   */
  private detectMissingEdit(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 1. 检查是否是详情页
    const isDetailPage = /\/Detail\//.test(this.filePath) ||
                         /Detail\.tsx$/.test(this.filePath) ||
                         /-detail\.tsx$/.test(this.filePath);

    if (!isDetailPage) return issues;

    // 2. 排除只读展示页面（不包含表单的详情页）
    const hasForm = this.content.includes('<Form') || this.content.includes('useForm');
    const hasEditableFields = this.content.includes('<Input') ||
                              this.content.includes('<Select') ||
                              this.content.includes('<TextArea');

    // 如果是纯展示页面（只有 Descriptions），不需要编辑入口
    const isReadOnlyPage = !hasForm && !hasEditableFields;
    if (isReadOnlyPage) return issues;

    // 3. 排除 Drawer 内容（Drawer 通常由父组件控制编辑状态）
    const isDrawerContent = this.content.includes('<Drawer');
    if (isDrawerContent) return issues;

    // 4. 检查是否有编辑按钮
    const hasEditButton = /EditOutlined/.test(this.content) ||
                          /onClick.*编辑/.test(this.content) ||
                          /setEdit/.test(this.content) ||
                          /editing\s*=/.test(this.content);

    if (isDetailPage && !hasEditButton && hasEditableFields) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-edit',
        severity: 'P1',
        message: '详情页缺少编辑入口',
        suggestion: '添加编辑按钮或启用编辑模式切换',
      });
    }

    return issues;
  }

  // ============ 新增检测方法（10项）============

  /**
   * A2-03: 检测状态机定义
   * 检测是否使用了状态机库（如 XState, useMachine, const [state, send]）
   */
  private detectMissingStateMachine(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检查是否是复杂交互页面（表单、审批、工作流等）
    const isComplexPage = /Form|Modal|Drawer|Step|Workflow|Approval|Pipeline/i.test(this.filePath) ||
                          /form.*state|workflow|approval/i.test(this.content);

    if (!isComplexPage) return issues;

    // 检测状态机库使用
    const hasStateMachine = /useMachine|from\(['"]xstate['"]\)|createMachine\(|xstate\b/i.test(this.content) ||
                           /const\s+\[state,\s*send\]/i.test(this.content) ||
                           /useReducer\b/.test(this.content);

    if (!hasStateMachine) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-state-machine',
        severity: 'P1',
        message: '复杂交互页面缺少状态机定义',
        suggestion: '建议使用 XState 或 useReducer 定义清晰的状态转换逻辑',
      });
    }

    return issues;
  }

  /**
   * A2-04: 检测状态变化动画过渡
   * 检测 CSS transition/animation 是否存在
   */
  private detectMissingAnimation(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检查是否有状态变化（如展开/折叠、显示/隐藏、切换）
    const hasStateChange = /setVisible|setExpanded|setOpen|setActive|setCurrent/i.test(this.content) ||
                          /visible\?|expanded|isOpen|isActive/i.test(this.content);

    if (!hasStateChange) return issues;

    // 检查是否有动画相关代码
    const hasAnimation = /transition:|animation:|@keyframes|\.ant-.*transition|style=\{\{.*transition/i.test(this.content) ||
                        /animate:|framer-motion|react-spring/i.test(this.content) ||
                        /duration.*\d{3}|ease-/i.test(this.content);

    if (!hasAnimation) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-animation',
        severity: 'P1',
        message: '状态变化缺少动画过渡效果',
        suggestion: '添加 CSS transition 或使用动画库实现平滑过渡',
      });
    }

    return issues;
  }

  /**
   * A2-05: 网络错误处理
   * 检测是否有 try-catch 和错误边界
   */
  private detectMissingNetworkError(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 查找所有异步操作
    const asyncOperations: { name: string; line: number; column: number }[] = [];

    const findAsyncOps = (node: ts.Node) => {
      // 异步方法
      if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
          const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
          if (isAsync && node.body) {
            const { line, column } = this.getLineColumn(node);
            asyncOperations.push({ name: node.name.text, line, column });
          }
        }
      }

      // 箭头函数赋值
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isVariableDeclaration(decl) && decl.initializer) {
            const init = decl.initializer;
            if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
              const isAsync = init.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
              if (isAsync) {
                const varName = decl.name.getText(this.sourceFile);
                const { line, column } = this.getLineColumn(decl);
                if (/^(handle|on|load|fetch|save|submit|create|update|delete)/i.test(varName)) {
                  asyncOperations.push({ name: varName, line, column });
                }
              }
            }
          }
        }
      }
      ts.forEachChild(node, findAsyncOps);
    };

    ts.forEachChild(this.sourceFile, findAsyncOps);

    // 检查每个异步操作是否有错误处理
    for (const op of asyncOperations) {
      // 检查是否有 catch 块
      const hasErrorHandling = /catch\s*\(|try\s*\{/i.test(this.content) ||
                              /onError|errorHandler|handleError/i.test(this.content);

      if (!hasErrorHandling) {
        issues.push({
          file: this.filePath,
          line: op.line,
          column: op.column,
          type: 'missing-network-error',
          severity: 'P0',
          message: `方法 ${op.name} 缺少网络错误处理`,
          suggestion: '添加 try-catch 块处理网络错误',
        });
        break; // 只报告一次，因为通常是全局问题
      }
    }

    // 检查是否有 Error Boundary
    const hasErrorBoundary = /ErrorBoundary|componentDidCatch|getDerivedStateFromError/i.test(this.content);
    if (asyncOperations.length > 0 && !hasErrorBoundary) {
      // 检查是否已有错误处理的 issues，如果没有则添加一个
      const hasExistingErrorIssue = issues.some(i => i.type === 'missing-network-error');
      if (!hasExistingErrorIssue) {
        issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-network-error',
          severity: 'P0',
          message: '页面缺少 Error Boundary 组件',
          suggestion: '添加 Error Boundary 组件捕获渲染错误',
        });
      }
    }

    return issues;
  }

  /**
   * A2-06: 业务错误提示
   * 检测 catch 块中是否有 message.error 显示
   */
  private detectMissingBusinessError(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 查找所有 catch 块
    const catchBlocks: { line: number; column: number; hasMessage: boolean }[] = [];

    const findCatchBlocks = (node: ts.Node) => {
      if (ts.isCatchClause(node)) {
        const { line, column } = this.getLineColumn(node);
        const catchBody = node.block.getText(this.sourceFile);
        const hasMessage = /message\.error|notification\.error/i.test(catchBody);

        catchBlocks.push({ line, column, hasMessage });
      }
      ts.forEachChild(node, findCatchBlocks);
    };

    ts.forEachChild(this.sourceFile, findCatchBlocks);

    // 检查是否有 catch 块但没有 message.error
    for (const catchBlock of catchBlocks) {
      if (!catchBlock.hasMessage) {
        issues.push({
          file: this.filePath,
          line: catchBlock.line,
          column: catchBlock.column,
          type: 'missing-business-error',
          severity: 'P0',
          message: 'catch 块缺少业务错误提示',
          suggestion: '在 catch 块中使用 message.error 显示错误信息',
        });
      }
    }

    // 检查 API 调用后是否有错误处理
    const hasApiCalls = /await\s+\w+Api\.|await\s+request\(|await\s+axios/i.test(this.content);
    const hasErrorCheck = /\.catch\(|try\s*\{|if\s*\(\s*error|if\s*\(\s*!.*\.success/i.test(this.content);

    if (hasApiCalls && !hasErrorCheck && catchBlocks.length === 0) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-business-error',
        severity: 'P0',
        message: 'API 调用后缺少业务错误处理',
        suggestion: '添加错误处理逻辑，显示后端返回的错误信息',
      });
    }

    return issues;
  }

  /**
   * A2-07: 权限不足提示
   * 检测 403 错误处理
   */
  private detectMissingPermissionError(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检测是否有 403 或权限相关错误处理
    const hasPermissionCheck = /403|forbidden|unauthorized|permission denied|no permission|无权限|权限不足/i.test(this.content) ||
                               /response\.status\s*===?\s*403/i.test(this.content) ||
                               /err\.response\.status\s*===?\s*403/i.test(this.content);

    // 检测是否有无权限提示
    const hasPermissionMessage = /message\.error.*权限|notification\.error.*权限/i.test(this.content);

    // 检查是否有 API 调用
    const hasApiCalls = /await\s+\w+Api\.|await\s+request\(|await\s+axios/i.test(this.content);

    if (hasApiCalls && !hasPermissionCheck) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-permission-error',
        severity: 'P0',
        message: '缺少 403 权限不足错误处理',
        suggestion: '添加 403 状态码检测，显示"无权限"提示并引导用户',
      });
    } else if (hasApiCalls && hasPermissionCheck && !hasPermissionMessage) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-permission-error',
        severity: 'P0',
        message: '权限错误缺少用户提示',
        suggestion: '检测到权限错误后显示明确的提示信息',
      });
    }

    return issues;
  }

  /**
   * A2-08: 超时处理
   * 检测 axios timeout 配置
   */
  private detectMissingTimeout(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检查 axios 请求配置
    const hasAxiosRequest = /axios\.|request\(|http\./i.test(this.content);

    if (!hasAxiosRequest) return issues;

    // 检测是否有 timeout 配置
    const hasTimeout = /timeout\s*:|timeout\s*=/i.test(this.content) ||
                      /AbortController|signal/i.test(this.content);

    // 检测是否有超时错误处理
    const hasTimeoutError = /timeout|ETIMEDOUT|ECONNABORTED/i.test(this.content);

    // 检查是否有 createApi 或umi-request
    const hasApiClient = /createApi|request\s*=\s*axios/i.test(this.content);

    if (!hasTimeout && hasApiClient) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-timeout',
        severity: 'P0',
        message: 'API 请求缺少超时配置',
        suggestion: '为 axios 配置 timeout 或使用 AbortController 处理超时',
      });
    }

    if (!hasTimeoutError && hasApiClient) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-timeout',
        severity: 'P0',
        message: '缺少请求超时错误处理',
        suggestion: '添加超时错误提示，如"请求超时，请重试"',
      });
    }

    return issues;
  }

  /**
   * A2-09: 乐观锁/冲突检测
   * 检测 version/etag 字段和 409 冲突处理
   */
  private detectMissingOptimisticLock(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检查是否是编辑/更新页面
    const isEditPage = /\/Edit\//.test(this.filePath) ||
                      /Edit\.tsx$/.test(this.filePath) ||
                      /-edit\.tsx$/.test(this.filePath) ||
                      /handleUpdate|handleSave/i.test(this.content);

    if (!isEditPage) return issues;

    // 检测是否有版本控制字段
    const hasVersionField = /version\s*:|etag\s*:|\bversion\b|\betag\b/i.test(this.content);

    // 检测是否有 409 冲突处理
    const hasConflictHandling = /409|conflict|Conflict/i.test(this.content);

    // 检测是否有乐观锁更新逻辑
    const hasOptimisticLock = /version\s*\+.*1|version\s*=\s*version\s*\+|setVersion/i.test(this.content);

    if (!hasVersionField) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-optimistic-lock',
        severity: 'P0',
        message: '更新操作缺少版本控制字段',
        suggestion: '添加 version 或 etag 字段实现乐观锁',
      });
    }

    if (!hasConflictHandling) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-optimistic-lock',
        severity: 'P0',
        message: '缺少 409 冲突错误处理',
        suggestion: '添加 409 状态码检测，处理数据并发冲突',
      });
    }

    return issues;
  }

  /**
   * A2-10: 并发操作提示
   * 检测多人同时编辑场景
   */
  private detectMissingConcurrentEdit(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检查是否是编辑页面
    const isEditPage = /\/Edit\//.test(this.filePath) ||
                      /Edit\.tsx$/.test(this.filePath) ||
                      /-edit\.tsx$/.test(this.filePath);

    if (!isEditPage) return issues;

    // 检测是否有并发检测机制
    const hasConcurrentCheck = /lock|unlock|editing|locked|isEditing/i.test(this.content) ||
                               /polling|interval.*check/i.test(this.content);

    // 检测是否有冲突提示
    const hasConflictMessage = /已被.*编辑|正在被编辑|多人编辑/i.test(this.content);

    if (isEditPage && !hasConcurrentCheck) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-concurrent-edit',
        severity: 'P0',
        message: '编辑页面缺少并发编辑检测',
        suggestion: '实现编辑锁机制或定时检测文档是否被他人修改',
      });
    }

    if (isEditPage && hasConcurrentCheck && !hasConflictMessage) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-concurrent-edit',
        severity: 'P0',
        message: '并发编辑缺少用户提示',
        suggestion: '检测到并发编辑时显示明确提示',
      });
    }

    return issues;
  }

  /**
   * A2-11: 关键操作可撤销
   * 检测撤销逻辑
   */
  private detectMissingUndo(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检查是否有可能需要撤销的操作
    const hasDeletableOperation = /handleDelete|handleRemove|handleCancel|delete.*api|remove.*api/i.test(this.content);

    if (!hasDeletableOperation) return issues;

    // 检测是否有撤销功能
    const hasUndo = /undo|revert|rollback|撤销/i.test(this.content) ||
                   /setTimeout.*delete|clearTimeout/i.test(this.content);

    // 检测是否有确认对话框
    const hasConfirm = /confirm\(|Modal\.confirm|popconfirm/i.test(this.content);

    if (hasDeletableOperation && !hasUndo && !hasConfirm) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-undo',
        severity: 'P1',
        message: '删除/取消操作缺少确认机制',
        suggestion: '添加确认对话框或撤销功能',
      });
    }

    return issues;
  }

  /**
   * A2-13: 骨架屏/占位符
   * 检测 Skeleton 组件
   */
  private detectMissingSkeleton(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检查是否有数据加载
    const hasDataLoading = /useEffect|useRequest|loading\s*=|fetch/i.test(this.content);

    if (!hasDataLoading) return issues;

    // 检测是否有骨架屏
    const hasSkeleton = /<Skeleton\b|Skeleton\.|\.Skeleton/i.test(this.content) ||
                       /placeholder|Placeholder/i.test(this.content);

    // 检测是否有 loading 状态（已有 loading 则不需要骨架屏）
    const hasLoadingState = /loading\s*[=?]|setLoading/i.test(this.content);

    if (hasDataLoading && !hasSkeleton && !hasLoadingState) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-skeleton',
        severity: 'P1',
        message: '数据加载缺少骨架屏或占位符',
        suggestion: '添加 <Skeleton> 组件提升加载体验',
      });
    }

    return issues;
  }

  /**
   * A2-15: 空搜索结果提示
   * 检测空搜索反馈
   */
  private detectMissingEmptySearch(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检查是否有搜索功能
    const hasSearch = /onSearch|handleSearch|searchValue|searchText|keyword/i.test(this.content);

    if (!hasSearch) return issues;

    // 检查是否有空结果处理
    const hasEmptySearch = /no result|无结果|未找到|empty.*search/i.test(this.content.toLowerCase()) ||
                          /data(Source)?\.length\s*===?\s*0.*search/i.test(this.content);

    // 检查是否有搜索结果为空的提示
    const hasSearchEmptyHint = /Empty.*description.*搜索|Empty.*search/i.test(this.content);

    if (hasSearch && !hasEmptySearch && !hasSearchEmptyHint) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-empty-search',
        severity: 'P1',
        message: '搜索功能缺少空结果提示',
        suggestion: '在搜索结果为空时显示友好提示，如"未找到相关结果"',
      });
    }

    return issues;
  }

  // ============ 辅助方法 ============

  private isAsyncFunction(node: ts.FunctionLikeDeclaration): boolean {
    // 检查是否有 async 关键字
    const modifiers = node.modifiers;
    if (modifiers) {
      for (const mod of modifiers) {
        if (mod.kind === ts.SyntaxKind.AsyncKeyword) {
          return true;
        }
      }
    }

    // 检查箭头函数是否有 async
    if (ts.isArrowFunction(node)) {
      return node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    }

    return false;
  }

  private hasMessageCall(node: ts.Node): boolean {
    let found = false;

    const check = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const expr = n.expression;
        if (ts.isPropertyAccessExpression(expr)) {
          if (expr.name.text === 'success' || expr.name.text === 'error' || expr.name.text === 'warning') {
            // 检查是否是 message.success/error/warning
            const obj = expr.expression;
            if (ts.isIdentifier(obj) && obj.text === 'message') {
              found = true;
            }
          }
        }
      }
      ts.forEachChild(n, check);
    };

    check(node);
    return found;
  }

  private hasLoadingState(): boolean {
    // 检查是否有 loading 相关的 state
    const hasLoadingVar = /const\s+\w*loading\w*\s*=/.test(this.content);
    const hasSetLoading = /setLoading/.test(this.content);
    const hasDisabledInButton = /disabled\s*=\s*\{[^}]*loading/.test(this.content);

    return hasLoadingVar || hasSetLoading || hasDisabledInButton;
  }

  /**
   * 检测特定处理器是否有独立的 loading 状态
   * 增强版：检查处理器内部是否使用 loading 变量
   */
  private hasIndividualLoadingState(handler: ts.FunctionLikeDeclaration): boolean {
    const handlerText = handler.getText(this.sourceFile);
    return /loading\s*[?=]/.test(handlerText) ||
           /setLoading/.test(handlerText) ||
           /disabled\s*=\s*\{[^}]*loading/.test(handlerText);
  }

  /**
   * 检测是否有针对特定方法的 loading ref
   */
  private hasLoadingRefInMethod(methodName: string): boolean {
    // 查找类似 const handleXxxLoading 或 const loading = ref
    const loadingPattern = new RegExp(`(const|let)\\s+${methodName.replace(/^on/i, '')}Loading\\s*=`, 'i');
    return loadingPattern.test(this.content);
  }

  /**
   * 检测 try-catch 结构
   */
  private hasTryCatch(node: ts.Node): boolean {
    let found = false;
    const check = (n: ts.Node) => {
      if (ts.isTryStatement(n)) {
        found = true;
      }
      ts.forEachChild(n, check);
    };
    check(node);
    return found;
  }

  private isListComponent(): boolean {
    const fileName = path.basename(this.filePath, '.tsx');
    return /List|Table|Grid|Items/i.test(fileName);
  }

  private collectStats(stats: { functions: number; handlers: number; apis: number }) {
    const countPattern = (pattern: RegExp) => {
      const matches = this.content.match(pattern);
      return matches ? matches.length : 0;
    };

    stats.functions = countPattern(/\bfunction\s+\w+/);
    stats.handlers = countPattern(/on\w+\s*=\{/);
    stats.apis = countPattern(/await\s+\w+Api\.|await\s+use.*\.mutate/);
  }

  private getLineColumn(node: ts.Node): { line: number; column: number } {
    const pos = node.getStart(this.sourceFile);
    const lineInfo = this.sourceFile.getLineAndCharacterOfPosition(pos);
    return {
      line: lineInfo.line + 1,
      column: lineInfo.character + 1,
    };
  }
}

// ============ 批量扫描器 ============

export class InteractionScanner {
  private rootPath: string;

  constructor(rootPath: string = 'orion-frontend/src/pages/') {
    this.rootPath = rootPath;
  }

  /**
   * 扫描目录下所有 TSX 文件
   */
  async scan(maxFiles: number = 100): Promise<InteractionIssue[]> {
    const allIssues: InteractionIssue[] = [];
    const files = this.getTsxFiles(this.rootPath).slice(0, maxFiles);

    console.log(`📊 开始扫描 ${files.length} 个文件...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (i % 20 === 0) {
        console.log(`  进度: ${i}/${files.length}`);
      }

      try {
        const analyzer = new FrontendInteractionAnalyzer(file);
        const result = analyzer.analyze();
        allIssues.push(...result.issues);
      } catch (e) {
        // 忽略解析错误
      }
    }

    console.log(`✅ 扫描完成，发现 ${allIssues.length} 个问题`);
    return allIssues;
  }

  /**
   * 按严重程度分组
   */
  groupBySeverity(issues: InteractionIssue[]): Record<string, InteractionIssue[]> {
    return {
      P0: issues.filter(i => i.severity === 'P0'),
      P1: issues.filter(i => i.severity === 'P1'),
      P2: issues.filter(i => i.severity === 'P2'),
    };
  }

  /**
   * 按类型分组
   */
  groupByType(issues: InteractionIssue[]): Record<string, InteractionIssue[]> {
    const groups: Record<string, InteractionIssue[]> = {};

    for (const issue of issues) {
      if (!groups[issue.type]) {
        groups[issue.type] = [];
      }
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
          } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
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

// ============ CLI 入口 ============

export async function runInteractiveScan(
  rootPath: string = 'orion-frontend/src/pages/',
  maxFiles: number = 100
): Promise<InteractionIssue[]> {
  const scanner = new InteractionScanner(rootPath);
  return scanner.scan(maxFiles);
}

// 使用示例
// runInteractiveScan('orion-frontend/src/pages/', 50).then(issues => {
//   console.log(JSON.stringify(issues, null, 2));
// });