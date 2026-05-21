/**
 * AST 增强型前端交互检测器
 * 使用 TypeScript AST 解析实现深度代码分析
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { getTsxFiles } from './file-utils';

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
   * 优化版：避免重复报告，只在函数级别报告一次
   */
  private detectMissingFeedback(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];
    const visited = new Set<number>();
    const reportedFunctions = new Set<string>();

    // 1. 检测 onClick 异步处理器
    const findOnClickHandlers = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'onClick') {
        const handler = node.initializer;
        if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
          const isAsync = this.isAsyncFunction(handler);
          const hasMessageCall = this.hasMessageCall(handler);
          const hasTryCatch = this.hasTryCatch(handler);

          if (isAsync && !hasMessageCall && !hasTryCatch) {
            const { line, column } = this.getLineColumn(handler);
            const key = `onClick-${line}-${column}`;
            if (!reportedFunctions.has(key)) {
              reportedFunctions.add(key);
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

    // 2. 检测 async 方法定义
    const findAsyncMethods = (node: ts.Node) => {
      if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
          const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
          const hasBody = node.body;

          if (isAsync && hasBody) {
            const hasMessageCall = this.hasMessageCall(node.body!);
            const hasTryCatch = this.hasTryCatch(node.body!);
            const { line, column } = this.getLineColumn(node);

            if (!hasMessageCall && !hasTryCatch) {
              const methodName = node.name.text;
              const key = `method-${methodName}`;
              if (/^(handle|on|submit|save|delete|create|update|remove)/i.test(methodName) && !reportedFunctions.has(key)) {
                reportedFunctions.add(key);
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

      // 检测箭头函数赋值
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isVariableDeclaration(decl) && decl.initializer) {
            const init = decl.initializer;
            if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
              const isAsync = init.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
              if (isAsync && init.body) {
                const hasMessageCall = this.hasMessageCall(init.body);
                const hasTryCatch = this.hasTryCatch(init.body);
                const { line, column } = this.getLineColumn(decl);

                if (!hasMessageCall && !hasTryCatch) {
                  const varName = decl.name.getText(this.sourceFile);
                  const key = `func-${varName}`;
                  if (/^(load|fetch|get|save|submit|create|update|delete|remove|handle|exec|runs)/i.test(varName) && !reportedFunctions.has(key)) {
                    reportedFunctions.add(key);
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
          if (/^use(Request|Mutation|Async)$/.test(expr.text)) {
            const options = node.arguments[1];
            if (options && ts.isObjectLiteralExpression(options)) {
              const hasSuccessHandler = options.properties.some(
                p => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'onSuccess'
              );
              const hasErrorHandler = options.properties.some(
                p => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'onError'
              );
              const { line, column } = this.getLineColumn(node);

              if (!hasSuccessHandler && !hasErrorHandler) {
                const key = `useRequest-${line}-${column}`;
                if (!reportedFunctions.has(key)) {
                  reportedFunctions.add(key);
                  issues.push({
                    file: this.filePath,
                    line,
                    column,
                    type: 'missing-feedback',
                    severity: 'P0',
                    message: 'useRequest 缺少 onSuccess/onError 回调处理',
                    suggestion: '添加 onSuccess: () => message.success("成功") 或 onError 回调',
                  });
                }
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
 * 优化版：扫描整个组件的 loading 状态定义，而非仅检查函数体内
 * 支持 submitting/saving/fetching 等变量名，支持 props 传入
 */
  private detectMissingLoading(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];
    const visited = new Set<number>();

    // 1. 先扫描组件级别的 loading 状态定义
    const componentLoadingStates = this.findAllLoadingStates();

    // 2. 检测 onClick 异步处理器
    const findOnClickHandlers = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'onClick') {
        const handler = node.initializer;

        if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
          const isAsync = this.isAsyncFunction(handler);
          const hasIndividualLoading = this.hasIndividualLoadingState(handler);
          const usesComponentLoading = this.functionUsesLoadingState(handler, componentLoadingStates);
          const { line, column } = this.getLineColumn(handler);

          // 只有函数体内既没有独立 loading 也没有引用组件级 loading 时才报告
          if (isAsync && !hasIndividualLoading && !usesComponentLoading && !visited.has(line)) {
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

    // 3. 检测 async 方法（包括箭头函数赋值）
    const findAsyncMethods = (node: ts.Node) => {
      if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
          const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
          const hasBody = node.body;

          if (isAsync && hasBody) {
            const methodName = node.name.text;
            const hasLoadingRef = this.hasLoadingRefInMethod(methodName);
            const usesComponentLoading = this.functionUsesLoadingState(node, componentLoadingStates);
            const { line, column } = this.getLineColumn(node);

            // 检查函数是否引用了组件级 loading 变量
            if (!hasLoadingRef && !usesComponentLoading && !visited.has(line) &&
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

      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isVariableDeclaration(decl) && decl.initializer) {
            const init = decl.initializer;
            if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
              const isAsync = init.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
              if (isAsync && init.body) {
                const varName = decl.name.getText(this.sourceFile);
                const hasLoading = this.hasLoadingInBody(init.body);
                const usesComponentLoading = this.functionUsesLoadingState(init, componentLoadingStates);
                const { line, column } = this.getLineColumn(decl);

                // 检查函数体内是否有 loading 使用或引用了组件级 loading 变量
                if (!hasLoading && !usesComponentLoading && !visited.has(line)) {
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

    // 4. 检测 useRequest 没有 loading 配置
    const findUseRequestLoading = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isIdentifier(expr) && /^use(Request|Mutation)$/.test(expr.text)) {
          const options = node.arguments[0] || node.arguments[1];
          if (options && ts.isObjectLiteralExpression(options)) {
            const hasLoadingProp = options.properties.some(
              p => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'loading'
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
   * 查找组件中所有 loading 状态定义
   * 支持: loading, submitting, saving, fetching, actionLoading 等
   */
  private findAllLoadingStates(): string[] {
    const loadingVars: string[] = [];

    // 使用 matchAll 匹配所有 useState loading 定义（扩展模式覆盖更多命名约定）
    // 包括 exporting/generating/uploading 等操作状态
    const useStatePattern = /const\s+\[(\w*(?:loading|submitting|saving|fetching|executing|processing|running|working|actioning|deleting|creating|updating|exporting|generating|uploading|downloading|importing|applying|refreshing|searching|validating|checking|sending|building)\w*)\s*,\s*\w+\]\s*=\s*useState/gi;
    for (const match of this.content.matchAll(useStatePattern)) {
      const varName = match[1];
      if (varName && !loadingVars.includes(varName)) {
        loadingVars.push(varName);
      }
    }

    // 匹配更多模式（使用 matchAll）
    const patterns = [
      /const\s+\[(loading|submitting|saving|fetching|executing|processing|exporting|generating|actionLoading|detailLoading|modalLoading|tableLoading|listLoading|isProcessing|isSubmitting|isSaving|isLoading|isExecuting|isFetching|isExporting|isGenerating)\s*,/gi,
      /const\s+\[(\w+Loading)\s*,/gi,
      /const\s+\[(\w+(?:ing|tion))\s*,\s*set\w+\]\s*=\s*useState\((?:true|false)\)/gi,  // 匹配 const [xxxIng, setXxx] = useState(false)
      /const\s+\[(is\w+)\s*,\s*set\1\]\s*=\s*useState\((?:true|false)\)/gi,  // 匹配 const [isXxx, setIsXxx] = useState(false)
    ];

    for (const pattern of patterns) {
      for (const match of this.content.matchAll(pattern)) {
        const varName = match[1];
        if (varName && !loadingVars.includes(varName)) {
          loadingVars.push(varName);
        }
      }
    }

    // 通用模式：任何 const [xxx, setXxx] = useState(false) 其中 xxx 以 ing/is 开头
    const genericPattern = /const\s+\[(\w+)\s*,\s*set\w+\]\s*=\s*useState\((?:true|false)\)/gi;
    for (const match of this.content.matchAll(genericPattern)) {
      const varName = match[1];
      // 匹配操作状态类变量名
      if (/(?:ing|loading|submitting|saving|fetching|executing|processing|exporting|generating|is[A-Z]|has[A-Z]|should[A-Z])/i.test(varName) && !loadingVars.includes(varName)) {
        loadingVars.push(varName);
      }
    }

    // 检查是否有 props 传入的 loading
    const hasPropLoading = /loading\s*:\s*boolean|loading\?\s*:\s*boolean/i.test(this.content);
    if (hasPropLoading) {
      loadingVars.push('props.loading');
    }

    return loadingVars;
  }

  /**
   * 检查函数体内是否有 loading 状态的使用（setLoading 等）
   */
  private hasLoadingInBody(body: ts.Node): boolean {
    const bodyText = body.getText(this.sourceFile);
    // 扩展正则，支持更多变量名
    return /setLoading|setSubmitting|setSaving|setLoadingState|loading\s*=\s*(true|false)|disabled.*loading/i.test(bodyText);
  }

  /**
   * 检查函数体是否引用了组件级 loading 变量
   * 避免"只要定义了 loading 就豁免所有函数"的误报
   */
  private functionUsesLoadingState(func: ts.FunctionLikeDeclaration | ts.MethodDeclaration | ts.FunctionDeclaration, loadingVars: string[]): boolean {
    if (loadingVars.length === 0) return false;

    const funcText = func.getText(this.sourceFile);

    // 检查是否引用了 loading 变量（读取、设置、作为 prop 传递）
    for (const varName of loadingVars) {
      // 匹配变量名作为标识符使用（排除定义行本身）
      // 同时匹配 setter 形式：setXxxLoading, setExecuting 等
      const setterName = 'set' + varName.charAt(0).toUpperCase() + varName.slice(1);
      const directPattern = `\\b${varName}\\b`;
      const setterPattern = `\\b${setterName}\\b`;
      const combinedPattern = new RegExp(`(${directPattern}|${setterPattern})(?!\\s*,\\s*\\w+\\]\\s*=\\s*useState)`, 'i');
      if (combinedPattern.test(funcText)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检测特定处理器是否有独立的 loading 状态
   * 优化版：支持 submitting/saving 等变量名
   */
  private hasIndividualLoadingState(handler: ts.FunctionLikeDeclaration): boolean {
    const handlerText = handler.getText(this.sourceFile);
    // 扩展匹配更多 loading 状态模式（包括 exporting/generating/refreshing 等）
    return /(?:loading|submitting|saving|fetching|executing|processing|exporting|generating|uploading|refreshing|searching)\s*[?=]|set(?:Loading|Submitting|Saving|Fetching|Executing|Processing|Exporting|Generating|Uploading|Refreshing|Searching|AuditLogLoading|DetailLoading|ModalLoading|TableLoading)|disabled\s*=\s*\{[^}]*loading/i.test(handlerText);
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
   * 优化版：在每个异步函数级别检测 try-catch，而非全文正则
   */
  private detectMissingNetworkError(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];
    const reportedLines = new Set<number>();

    const checkNode = (node: ts.Node) => {
      let asyncFunc: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | null = null;
      let funcName = '';

      if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
        const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
        if (isAsync && node.body) {
          asyncFunc = node;
          funcName = ts.isIdentifier(node.name) ? node.name.text : 'anonymous';
        }
      }

      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isVariableDeclaration(decl) && decl.initializer) {
            const init = decl.initializer;
            if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && init.body) {
              const isAsync = init.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
              if (isAsync) {
                asyncFunc = init;
                funcName = decl.name.getText(this.sourceFile);
              }
            }
          }
        }
      }

      if (asyncFunc && /^(handle|load|fetch|save|submit|create|update|delete|remove)/i.test(funcName)) {
        const hasTryCatch = this.hasTryCatch(asyncFunc);
        const hasCatchWithMessage = this.hasCatchWithErrorMessage(asyncFunc);
        const { line, column } = this.getLineColumn(asyncFunc);

        // 如果既没有 try-catch 也没有 catch 中的错误提示，且未报告过该行
        if (!hasTryCatch && !reportedLines.has(line)) {
          reportedLines.add(line);
          issues.push({
            file: this.filePath,
            line,
            column,
            type: 'missing-network-error',
            severity: 'P0',
            message: `方法 ${funcName} 缺少网络错误处理`,
            suggestion: '添加 try-catch 块处理网络错误',
          });
        }
      }

      ts.forEachChild(node, checkNode);
    };

    ts.forEachChild(this.sourceFile, checkNode);

    // 检查是否有 Error Boundary
    const hasErrorBoundary = /ErrorBoundary|componentDidCatch|getDerivedStateFromError/i.test(this.content);
    if (!hasErrorBoundary && issues.length === 0) {
      // 检查是否有 await 调用但没有任何错误处理
      const hasApiCalls = /await\s+\w+Api\.|await\s+request\(|await\s+axios/i.test(this.content);
      const hasAnyTryCatch = /try\s*\{[\s\S]*catch/i.test(this.content);

      if (hasApiCalls && !hasAnyTryCatch) {
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
   * 检查节点及其子节点是否有 catch 块
   */
  private hasTryCatchInNode(node: ts.Node): boolean {
    let found = false;
    const check = (n: ts.Node) => {
      if (ts.isTryStatement(n)) {
        found = true;
        return;
      }
      // 遇到嵌套函数边界时停止，避免将内部回调的 try-catch 误归为外层函数
      if (n !== node && ts.isFunctionLike(n)) {
        return;
      }
      if (!found) ts.forEachChild(n, check);
    };
    check(node);
    return found;
  }

  /**
   * 检查异步函数是否有 try-catch 且 catch 中有错误提示
   */
  private hasCatchWithErrorMessage(func: ts.FunctionLikeDeclaration): boolean {
    let found = false;
    const check = (n: ts.Node) => {
      if (ts.isTryStatement(n) && n.catchClause) {
        const catchBody = n.catchClause.block.getText(this.sourceFile);
        if (/message\.(error|warning)|notification\.error/i.test(catchBody)) {
          found = true;
          return;
        }
      }
      if (!found) ts.forEachChild(n, check);
    };
    check(func);
    return found;
  }

  /**
   * A2-06: 业务错误提示
   * 检测 catch 块中是否有 message.error 显示
   */
  private detectMissingBusinessError(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 查找所有 catch 块
    const catchBlocks: {
      line: number;
      column: number;
      hasMessage: boolean;
      hasErrorHandling: boolean;
      isEmpty: boolean;
    }[] = [];

    const findCatchBlocks = (node: ts.Node) => {
      if (ts.isCatchClause(node)) {
        const { line, column } = this.getLineColumn(node);
        const catchBody = node.block.getText(this.sourceFile);

        // 检查是否有用户可见的错误提示
        const hasMessage = /message\.error|notification\.error|Modal\.error|Modal\.warning/i.test(catchBody);

        // 检查是否有其他有效的错误处理模式
        const hasErrorHandling = hasMessage ||
          /setError|setApiError|setErrorMessage/i.test(catchBody) ||  // 状态设置
          /throw\s+new\s+Error|throw\s+error/i.test(catchBody) ||     // 重新抛出
          /return\s+\{.*error|return\s+Promise\.reject/i.test(catchBody) || // 返回错误对象
          /logger\.error|console\.error.*用户|reportError/i.test(catchBody) || // 日志记录+用户提示
          /handleError|showError|displayError/i.test(catchBody);      // 自定义错误处理函数

        // 检查是否为空 catch 块（只有注释或空白）
        const bodyWithoutWhitespace = catchBody.replace(/\s+/g, '').replace(/\/\/.*/g, '').replace(/\/\*.*?\*\//g, '');
        const isEmpty = bodyWithoutWhitespace === '{}' || bodyWithoutWhitespace.length < 10;

        catchBlocks.push({ line, column, hasMessage, hasErrorHandling, isEmpty });
      }
      ts.forEachChild(node, findCatchBlocks);
    };

    ts.forEachChild(this.sourceFile, findCatchBlocks);

    // 只报告真正有问题的 catch 块
    for (const catchBlock of catchBlocks) {
      // 如果没有任何错误处理，或者 catch 块是空的，报告问题
      if (!catchBlock.hasErrorHandling || catchBlock.isEmpty) {
        issues.push({
          file: this.filePath,
          line: catchBlock.line,
          column: catchBlock.column,
          type: 'missing-business-error',
          severity: 'P0',
          message: catchBlock.isEmpty
            ? 'catch 块为空，缺少错误处理'
            : 'catch 块缺少用户可见的错误提示',
          suggestion: '在 catch 块中使用 message.error 显示错误信息，或设置错误状态',
        });
      }
    }

    return issues;
  }

  /**
   * A2-07: 权限不足提示
   * 检测 403 错误处理
   */
  private detectMissingPermissionError(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 检测是否有写操作 API 调用（GET 不需要权限检查）
    const hasWriteApiCalls = /await\s+\w+Api\.(post|put|delete|patch|mutate)|await\s+request\.(post|put|delete|patch)/i.test(this.content);

    if (!hasWriteApiCalls) return issues;

    // 检测是否有 403 或权限相关错误处理
    const hasPermissionCheck = /403|forbidden|unauthorized|permission denied|no permission|无权限|权限不足/i.test(this.content) ||
                               /response\.status\s*===?\s*403/i.test(this.content) ||
                               /err\.response\.status\s*===?\s*403/i.test(this.content) ||
                               /error\..*status\s*===?\s*403/i.test(this.content);

    // 检测是否有无权限提示
    const hasPermissionMessage = /message\.error.*权限|notification\.error.*权限/i.test(this.content);

    if (!hasPermissionCheck && !hasPermissionMessage) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-permission-error',
        severity: 'P0',
        message: '缺少 403 权限不足错误处理',
        suggestion: '添加 403 状态码检测，显示"无权限"提示并引导用户',
      });
    } else if (hasPermissionCheck && !hasPermissionMessage) {
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
   * 修复：使用 AST 识别真正的搜索功能，排除 JSDoc 注释中的关键词匹配
   * 要求页面中同时存在搜索输入 + 搜索渲染结果 + 无 Empty 组件才报
   */
  private detectMissingEmptySearch(): InteractionIssue[] {
    const issues: InteractionIssue[] = [];

    // 1. 使用 AST 检测真正的搜索功能（排除 JSDoc 注释）
    const searchDetection = this.detectSearchWithAST();
    if (!searchDetection.hasSearchInput) return issues;

    // 2. 检查是否已有空搜索结果处理
    const hasEmptySearch =
      /no result|无结果|未找到|empty.*search|search.*empty/i.test(this.content.toLowerCase()) ||
      /data(Source)?\.length\s*===?\s*0|dataSource\s*=\s*\{\s*\}/i.test(this.content) ||
      /<Empty|emptyText|locale\s*=\s*\{\s*empty/i.test(this.content) ||
      /searchResults\.length\s*===?\s*0|filteredData\.length\s*===?\s*0/i.test(this.content);

    if (hasEmptySearch) return issues;

    // 3. 有搜索输入但没有空结果处理，报告
    issues.push({
      file: this.filePath,
      line: searchDetection.line,
      column: searchDetection.column,
      type: 'missing-empty-search',
      severity: 'P1',
      message: '搜索功能缺少空结果提示',
      suggestion: '在搜索结果为空时显示友好提示，如"未找到相关结果"',
    });

    return issues;
  }

  /**
   * 使用 AST 检测页面是否有真正的搜索功能
   * 排除 JSDoc 注释中的关键词匹配，只识别实际的搜索组件/回调
   */
  private detectSearchWithAST(): { hasSearchInput: boolean; line: number; column: number } {
    let foundSearch = false;
    let searchLine = 1;
    let searchColumn = 1;

    const checkNode = (node: ts.Node) => {
      if (foundSearch) return;

      // 检测 <Input.Search /> 或 <Search /> 组件
      if (ts.isJsxSelfClosingElement(node)) {
        const tagName = node.tagName.getText(this.sourceFile);
        if (tagName === 'Input.Search' || tagName === 'Search') {
          foundSearch = true;
          const pos = node.getStart(this.sourceFile);
          const lineInfo = this.sourceFile.getLineAndCharacterOfPosition(pos);
          searchLine = lineInfo.line + 1;
          searchColumn = lineInfo.character + 1;
          return;
        }
      }

      // 检测 onSearch prop
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'onSearch') {
        foundSearch = true;
        const pos = node.getStart(this.sourceFile);
        const lineInfo = this.sourceFile.getLineAndCharacterOfPosition(pos);
        searchLine = lineInfo.line + 1;
        searchColumn = lineInfo.character + 1;
        return;
      }

      // 检测 handleSearch / onSearch 函数定义
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
          if (/^(handleSearch|onSearch|doSearch|performSearch)$/i.test(node.name.text)) {
            foundSearch = true;
            const pos = node.getStart(this.sourceFile);
            const lineInfo = this.sourceFile.getLineAndCharacterOfPosition(pos);
            searchLine = lineInfo.line + 1;
            searchColumn = lineInfo.character + 1;
            return;
          }
        }
      }

      // 检测 searchValue / searchText 的 useState 定义（代码中的真实变量声明，非注释）
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        if (/^(searchValue|searchText|keyword|searchQuery)$/i.test(node.name.text)) {
          foundSearch = true;
          const pos = node.getStart(this.sourceFile);
          const lineInfo = this.sourceFile.getLineAndCharacterOfPosition(pos);
          searchLine = lineInfo.line + 1;
          searchColumn = lineInfo.character + 1;
          return;
        }
      }

      ts.forEachChild(node, checkNode);
    };

    ts.forEachChild(this.sourceFile, checkNode);

    // AST 没找到，降级为去除 JSDoc 注释后的正则匹配
    if (!foundSearch) {
      const codeWithoutComments = this.content
        .replace(/\/\*\*[\s\S]*?\*\//g, '')  // 去除 JSDoc
        .replace(/\/\*[\s\S]*?\*\//g, '')     // 去除块注释
        .replace(/\/\/.*$/gm, '');             // 去除行注释

      if (/onSearch|handleSearch|searchValue|searchText|keyword/i.test(codeWithoutComments)) {
        foundSearch = true;
        // 行号标记为 1（正则降级无法精确定位）
        searchLine = 1;
        searchColumn = 1;
      }
    }

    return { hasSearchInput: foundSearch, line: searchLine, column: searchColumn };
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
   * 检测是否有针对特定方法的 loading ref
   */
  private hasLoadingRefInMethod(methodName: string): boolean {
    const loadingPattern = new RegExp(`(const|let)\\s+${methodName.replace(/^on/i, '')}Loading\\s*=`, 'i');
    return loadingPattern.test(this.content);
  }

  /**
   * 检测 try-catch 结构
   */
  private hasTryCatch(node: ts.Node): boolean {
    return this.hasTryCatchInNode(node);
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
    const files = getTsxFiles(this.rootPath).slice(0, maxFiles);

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