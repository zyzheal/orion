/**
 * A1 数据结构检测器
 * 检测数据结构相关的 14 项设计约束
 *
 * A1-01~A1-06: 前端类型安全 (P0)
 * A1-07~A1-08: 状态管理 (P0)
 * A1-09~A1-11: 数据脱敏 (P0)
 * A1-12~A1-14: 分页/排序/筛选 (P0/P1)
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface DataStructureIssue {
  file: string;
  line: number;
  column: number;
  type: DataStructureIssueType;
  severity: 'P0' | 'P1';
  message: string;
  suggestion: string;
  checkId: string; // A1-XX
  code?: string;
}

export type DataStructureIssueType =
  // A1-01: API 类型定义
  | 'missing-api-types'
  // A1-02: OpenAPI 文档
  | 'missing-openapi'
  // A1-03: Form rules
  | 'missing-form-rules'
  | 'missing-validator'
  // A1-04: 后端校验规则
  | 'missing-backend-validation'
  // A1-05: strict 模式
  | 'missing-strict-mode'
  // A1-06: 接口 any
  | 'interface-any'
  // A1-07: 初始状态
  | 'missing-initial-state'
  | 'undefined-initial-state'
  // A1-08: 状态定义
  | 'missing-loading-state'
  | 'missing-error-state'
  // A1-09: 数据库默认值
  | 'missing-db-default'
  // A1-10: 前端脱敏
  | 'missing-frontend-masking'
  // A1-11: API 脱敏
  | 'missing-api-masking'
  // A1-12: 分页参数
  | 'missing-pagination'
  // A1-13: 排序字段
  | 'missing-sort-fields'
  // A1-14: 筛选条件
  | 'missing-filter-types';

export interface DataStructureScanResult {
  file: string;
  issues: DataStructureIssue[];
  stats: {
    hasForm: boolean;
    hasApiCall: boolean;
    hasTable: boolean;
    hasSensitiveFields: boolean;
  };
}

// ============ 前端检测器 ============

export class A1DataStructureAnalyzer {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;
  private issues: DataStructureIssue[] = [];

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
   * 执行 A1 数据结构分析
   */
  analyze(): DataStructureScanResult {
    this.issues = [];

    // P0 检测项
    // A1-03: Form rules (P0)
    this.detectMissingFormRules();

    // A1-07: 初始状态 (P0)
    this.detectMissingInitialState();

    // A1-08: loading/error 状态 (P0)
    this.detectMissingStateDefinition();

    // A1-10: 前端脱敏 (P0)
    this.detectMissingFrontendMasking();

    // A1-12: 分页参数 (P0)
    this.detectMissingPagination();

    // A1-13: 排序字段 (P1)
    this.detectMissingSortFields();

    // A1-14: 筛选条件类型 (P1)
    this.detectMissingFilterTypes();

    // A1-06: 接口 any (P1)
    this.detectInterfaceAny();

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues: this.issues,
      stats,
    };
  }

  /**
   * 收集统计信息
   */
  private collectStats() {
    return {
      hasForm: /<Form|<Form\.Item/.test(this.content),
      hasApiCall: /fetch|axios|request|api\./.test(this.content),
      hasTable: /<Table|<DataGrid/.test(this.content),
      hasSensitiveFields: this.hasSensitiveFields(),
    };
  }

  /**
   * 检测敏感字段
   */
  private hasSensitiveFields(): boolean {
    return /phone|mobile|idCard|idNo|identity|cardNo|credit|password|secret/i.test(this.content);
  }

  // ============ A1-03: Form rules (P0) ============

  /**
   * 检测 Form 组件是否缺少 rules 属性
   */
  private detectMissingFormRules(): void {
    const lines = this.content.split('\n');

    // 查找所有 Form 组件使用
    const formPattern = /<Form[^>]*>/g;
    let match;

    while ((match = formPattern.exec(this.content)) !== null) {
      const formStartLine = this.content.substring(0, match.index).split('\n').length;

      // 检查同一行或后续是否有 rules 属性
      const formContext = this.content.substring(match.index, match.index + 500);
      const hasRules = /rules\s*=/.test(formContext);

      if (!hasRules) {
        // 检查是否在组件内部定义了 Form.Item
        const hasFormItems = /<Form\.Item/.test(formContext.substring(0, 2000));

        if (hasFormItems) {
          this.issues.push({
            file: this.filePath,
            line: formStartLine,
            column: 1,
            type: 'missing-form-rules',
            severity: 'P0',
            message: 'Form 组件缺少 rules 属性配置',
            suggestion: '为必填字段添加 rules={[{ required: true, message: "..." }]}',
            checkId: 'A1-03',
            code: match[0],
          });
        }
      }
    }

    // 检测 Form.Item 是否缺少 rules
    const formItemPattern = /<Form\.Item[^>]*>/g;
    const processedFormItems = new Set<number>();

    while ((match = formItemPattern.exec(this.content)) !== null) {
      const itemLine = this.content.substring(0, match.index).split('\n').length;

      if (processedFormItems.has(itemLine)) continue;
      processedFormItems.add(itemLine);

      const itemContext = this.content.substring(match.index, match.index + 300);
      const hasName = /name\s*=/.test(itemContext);
      const hasRules = /rules\s*=/.test(itemContext);
      const hasRequiredProp = /required/.test(itemContext);

      // 如果有 name 属性但没有 rules 且没有 required prop，可能是遗漏
      if (hasName && !hasRules && !hasRequiredProp) {
        // 检查是否是必填字段（通过 name 判断）
        const nameMatch = itemContext.match(/name\s*=\s*["']([^"']+)["']/);
        if (nameMatch) {
          const fieldName = nameMatch[1];
          const likelyRequired = !/desc|description|remark|note|optional|comment/i.test(fieldName);

          if (likelyRequired) {
            this.issues.push({
              file: this.filePath,
              line: itemLine,
              column: 1,
              type: 'missing-validator',
              severity: 'P0',
              message: `Form.Item "${fieldName}" 缺少 rules 校验规则`,
              suggestion: '添加 rules={[{ required: true, message: "请输入" }]} 或自定义 validator',
              checkId: 'A1-03',
              code: match[0],
            });
          }
        }
      }
    }
  }

  // ============ A1-07: 初始状态 (P0) ============

  /**
   * 检测 useState 是否定义了初始值
   * 排除 useState(null) 和 useState(undefined)
   */
  private detectMissingInitialState(): void {
    // 检测 useState 调用
    const useStatePattern = /useState\s*(?:<\w+>)?\s*\(\s*(\w+|null|undefined)?\s*\)/g;
    let match;

    while ((match = useStatePattern.exec(this.content)) !== null) {
      const lineNum = this.content.substring(0, match.index).split('\n').length;
      const initialValue = match[1];

      // 检查是否是未定义初始值
      if (initialValue === undefined) {
        this.issues.push({
          file: this.filePath,
          line: lineNum,
          column: 1,
          type: 'missing-initial-state',
          severity: 'P0',
          message: 'useState 缺少初始值定义',
          suggestion: '提供明确的初始值，如 useState<Type>(initialValue)',
          checkId: 'A1-07',
          code: match[0],
        });
      } else if (initialValue === 'null' || initialValue === 'undefined') {
        this.issues.push({
          file: this.filePath,
          line: lineNum,
          column: 1,
          type: 'undefined-initial-state',
          severity: 'P0',
          message: `useState 使用了 ${initialValue} 作为初始值`,
          suggestion: '使用有意义的初始值，避免 null/undefined',
          checkId: 'A1-07',
          code: match[0],
        });
      }
    }

    // 检测 useState<any>
    const useStateAnyPattern = /useState\s*<\s*any\s*>/g;
    while ((match = useStateAnyPattern.exec(this.content)) !== null) {
      const lineNum = this.content.substring(0, match.index).split('\n').length;

      this.issues.push({
        file: this.filePath,
        line: lineNum,
        column: 1,
        type: 'missing-initial-state',
        severity: 'P0',
        message: 'useState 使用了 any 类型',
        suggestion: '定义具体的类型接口，不要使用 any',
        checkId: 'A1-07',
        code: match[0],
      });
    }
  }

  // ============ A1-08: 状态定义 (P0) ============

  /**
   * 检测是否缺少 loading/error/success 状态定义
   */
  private detectMissingStateDefinition(): void {
    // 检测是否有 API 调用
    const hasApiCall = /fetch|axios|api\.|request\(|get\(|post\(|put\(|delete\(/.test(this.content);

    if (!hasApiCall) return;

    // 检测 useState 定义
    const hasLoadingState = /useState.*loading|loading\s*[=:]|setLoading/.test(this.content);
    const hasErrorState = /useState.*error|error\s*[=:]|setError/.test(this.content);
    const hasSuccessState = /success\s*[=:]|setSuccess/.test(this.content);

    // 检测 async 函数
    const hasAsyncFunction = /async\s+\(|const\s+\w+\s*=\s*async/.test(this.content);

    if (hasAsyncFunction) {
      if (!hasLoadingState) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-loading-state',
          severity: 'P0',
          message: '异步操作缺少 loading 状态定义',
          suggestion: '添加 const [loading, setLoading] = useState(false) 管理加载状态',
          checkId: 'A1-08',
        });
      }

      if (!hasErrorState) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-error-state',
          severity: 'P0',
          message: '异步操作缺少 error 状态定义',
          suggestion: '添加 const [error, setError] = useState<string | null>(null) 管理错误状态',
          checkId: 'A1-08',
        });
      }
    }
  }

  // ============ A1-10: 前端脱敏 (P0) ============

  /**
   * 检测敏感字段是否使用脱敏函数
   */
  private detectMissingFrontendMasking(): void {
    // 检测敏感字段
    const sensitivePatterns = [
      { pattern: /phone|mobile|手机/, fieldName: '手机号' },
      { pattern: /idCard|idNo|identity|身份证/, fieldName: '身份证号' },
      { pattern: /cardNo|creditCard|银行卡/, fieldName: '银行卡号' },
      { pattern: /password|secret|密码/, fieldName: '密码' },
      { pattern: /email|邮箱/, fieldName: '邮箱' },
    ];

    for (const { pattern, fieldName } of sensitivePatterns) {
      if (!pattern.test(this.content)) continue;

      // 检测脱敏函数
      const hasMasking =
        /mask|privacy|desensitize|脱敏|隐藏/.test(this.content) ||
        // 常见脱敏模式
        /\d{3}.*\*\*\*\*|\*\*\*\d{4}/.test(this.content) ||
        // 自定义脱敏函数
        /hide|show|splice.*\d/.test(this.content);

      // 在 JSX 中检测敏感字段渲染
      const fieldRenderPattern = new RegExp(`\\b(${pattern.source})\\b`, 'i');
      if (fieldRenderPattern.test(this.content) && !hasMasking) {
        // 找到字段出现的行
        const lines = this.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (fieldRenderPattern.test(lines[i])) {
            // 检查是否在展示区域（非 input/send/validate）
            const isInputField = /<Input|<TextField/.test(lines[i]);
            const isDisplayArea = /<Text>|<Typography|<Descriptions|<Table/.test(lines[i]);

            if (isDisplayArea || !isInputField) {
              this.issues.push({
                file: this.filePath,
                line: i + 1,
                column: 1,
                type: 'missing-frontend-masking',
                severity: 'P0',
                message: `敏感字段 ${fieldName} 缺少前端脱敏处理`,
                suggestion: `使用 mask${fieldName}() 或 privacy 函数进行脱敏，如 138****1234`,
                checkId: 'A1-10',
                code: lines[i].trim().substring(0, 100),
              });
              break; // 每个文件只报告一次
            }
          }
        }
      }
    }
  }

  // ============ A1-12: 分页参数 (P0) ============

  /**
   * 检测分页参数是否定义
   */
  private detectMissingPagination(): void {
    // 检测是否有 Table 组件
    const hasTable = /<Table|<DataGrid/.test(this.content);

    if (!hasTable) return;

    // 检测分页相关代码
    const hasPagination =
      /pagination|pagination=\{/.test(this.content) ||
      /currentPage|page|pageSize|limit|offset/.test(this.content);

    if (!hasPagination) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-pagination',
        severity: 'P0',
        message: '列表组件缺少分页参数定义',
        suggestion: '添加 pagination={current, pageSize, onChange} 配置分页',
        checkId: 'A1-12',
      });
      return;
    }

    // 检测 API 调用是否包含分页参数
    const hasApiCall = /fetch|axios|api\.|request/.test(this.content);
    if (hasApiCall) {
      const hasPageParam = /page|limit|offset/.test(this.content);
      if (!hasPageParam) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-pagination',
          severity: 'P0',
          message: 'API 调用缺少分页参数',
          suggestion: '在 API 调用中添加 page/limit 参数，如 { page: 1, limit: 20 }',
          checkId: 'A1-12',
        });
      }
    }
  }

  // ============ A1-13: 排序字段 (P1) ============

  /**
   * 检测排序字段是否定义
   */
  private detectMissingSortFields(): void {
    // 检测 Table 或数据展示组件
    const hasTable = /<Table|<DataGrid/.test(this.content);

    if (!hasTable) return;

    // 检测是否有排序配置
    const hasSortConfig =
      /sorter|sortable|sortBy|orderBy|sortField|sortOrder/.test(this.content) ||
      /onSort|onChange.*sorter/.test(this.content);

    if (!hasSortConfig) {
      // 检测是否有多个字段可能需要排序
      const hasMultipleFields = /columns=\{|\[\s*\{/.test(this.content);

      if (hasMultipleFields) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-sort-fields',
          severity: 'P1',
          message: '表格缺少排序字段定义',
          suggestion: '在 columns 中添加 sorter 属性或配置 sortable',
          checkId: 'A1-13',
        });
      }
    }
  }

  // ============ A1-14: 筛选条件类型 (P1) ============

  /**
   * 检测筛选条件是否有类型定义
   */
  private detectMissingFilterTypes(): void {
    // 检测筛选相关代码
    const hasFilter =
      /filter|Filters|筛选|查询/.test(this.content) ||
      /searchParams|queryParams|searchForm|filterForm/.test(this.content);

    if (!hasFilter) return;

    // 检测是否有类型定义
    const hasTypeDefinition =
      /interface.*Filter|type.*Filter|:\s*\{/.test(this.content) ||
      /FormValues|QueryParams|SearchParams/.test(this.content);

    // 检测是否有具体字段
    const hasFilterFields = /name\s*=|field\s*=|key\s*=/.test(this.content);

    if (hasFilter && !hasTypeDefinition && hasFilterFields) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-filter-types',
        severity: 'P1',
        message: '筛选条件缺少类型定义',
        suggestion: '定义 interface FilterParams 或使用 type 定义筛选参数类型',
        checkId: 'A1-14',
      });
    }
  }

  // ============ A1-06: 接口 any (P1) ============

  /**
   * 检测接口是否使用 any
   */
  private detectInterfaceAny(): void {
    // 检测 interface 或 type 定义
    const interfacePattern = /(?:interface|type)\s+(\w+)\s*[=:{]/g;
    let match;

    while ((match = interfacePattern.exec(this.content)) !== null) {
      const interfaceStart = match.index;
      const interfaceLine = this.content.substring(0, interfaceStart).split('\n').length;

      // 查找接口定义的结束位置（简化：取后面 500 字符）
      const interfaceContent = this.content.substring(interfaceStart, interfaceStart + 500);

      // 检测是否使用了 any
      if (/\bany\b/.test(interfaceContent)) {
        this.issues.push({
          file: this.filePath,
          line: interfaceLine,
          column: 1,
          type: 'interface-any',
          severity: 'P1',
          message: `接口 ${match[1]} 使用了 any 类型`,
          suggestion: '使用具体的类型定义替代 any',
          checkId: 'A1-06',
          code: match[0],
        });
      }
    }
  }
}

// ============ 后端检测器 ============

export class BackendDataStructureAnalyzer {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;
  private issues: DataStructureIssue[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
  }

  /**
   * 执行后端数据结构分析
   */
  analyze(): DataStructureScanResult {
    this.issues = [];

    // A1-01: API 类型定义 (P0)
    this.detectMissingApiTypes();

    // A1-02: OpenAPI 文档 (P0)
    this.detectMissingOpenAPI();

    // A1-04: 后端校验规则 (P0)
    this.detectMissingBackendValidation();

    // A1-09: 数据库默认值 (P1)
    this.detectMissingDbDefault();

    // A1-11: API 返回脱敏 (P0)
    this.detectMissingApiMasking();

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues: this.issues,
      stats,
    };
  }

  private collectStats() {
    return {
      hasForm: false,
      hasApiCall: /router\.|route\.|@.*Route/.test(this.content),
      hasTable: false,
      hasSensitiveFields: this.hasSensitiveFields(),
    };
  }

  private hasSensitiveFields(): boolean {
    return /phone|mobile|idCard|idNo|identity|cardNo|credit|password|secret/i.test(this.content);
  }

  // ============ A1-01: API 类型定义 (P0) ============

  /**
   * 检测 API 路由是否有 Request/Response 类型定义
   */
  private detectMissingApiTypes(): void {
    // 检测路由定义
    const routePattern = /(?:router|route)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = routePattern.exec(this.content)) !== null) {
      const routeLine = this.content.substring(0, match.index).split('\n').length;

      // 检查后续是否有类型定义
      const routeContext = this.content.substring(match.index, match.index + 800);

      // 检测是否有 DTO/类型定义
      const hasRequestType =
        /RequestBody|Request|DTO|Input|Params/.test(routeContext) ||
        /interface.*Request|type.*Request/.test(routeContext);

      const hasResponseType =
        /Response|Reply|Result/.test(routeContext) ||
        /interface.*Response|type.*Response/.test(routeContext);

      if (!hasRequestType && !hasResponseType) {
        this.issues.push({
          file: this.filePath,
          line: routeLine,
          column: 1,
          type: 'missing-api-types',
          severity: 'P0',
          message: `路由 ${match[2]} 缺少 Request/Response 类型定义`,
          suggestion: '定义接口 RequestDTO 和 ResponseDTO',
          checkId: 'A1-01',
          code: match[0],
        });
      }
    }
  }

  // ============ A1-02: OpenAPI 文档 (P0) ============

  /**
   * 检测是否有 OpenAPI/Swagger 文档定义
   */
  private detectMissingOpenAPI(): void {
    // 检测是否有路由但没有 OpenAPI 注解
    const hasRoute = /router\.(get|post|put|delete|patch)\s*\(/i.test(this.content);
    const hasOpenAPI =
      /@Operation|@ApiOperation|@Api|@OpenAPI|swagger|openapi/i.test(this.content) ||
      /@ts-doc|jsdoc|comment.*@/.test(this.content) ||
      /export\s+const\s+apiDoc|APIDoc/.test(this.content);

    if (hasRoute && !hasOpenAPI) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-openapi',
        severity: 'P0',
        message: '路由缺少 OpenAPI/Swagger 文档注释',
        suggestion: '添加 @Operation 或 JSDoc 注释描述 API',
        checkId: 'A1-02',
      });
    }
  }

  // ============ A1-04: 后端校验规则 (P0) ============

  /**
   * 检测后端是否有校验规则 (class-validator/zod)
   */
  private detectMissingBackendValidation(): void {
    // 检测控制器或路由参数
    const hasParamValidation = /@Param|@Query|@Body|@RequestBody/.test(this.content);

    if (!hasParamValidation) return;

    // 检测是否有校验装饰器
    const hasValidationDecorators =
      /@IsString|@IsNumber|@IsEmail|@IsOptional|@MinLength|@MaxLength/.test(this.content) ||
      /@Validate|@Validation/.test(this.content) ||
      /zod\.|z\.object/.test(this.content);

    if (!hasValidationDecorators) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-backend-validation',
        severity: 'P0',
        message: 'API 参数缺少后端校验规则',
        suggestion: '使用 class-validator 装饰器或 zod 定义校验规则',
        checkId: 'A1-04',
      });
    }
  }

  // ============ A1-09: 数据库默认值 (P1) ============

  /**
   * 检测数据库字段是否有默认值定义
   */
  private detectMissingDbDefault(): void {
    // 检测实体定义
    const entityPattern = /@Entity|@Table|class\s+\w+\s*\{/g;
    let match;

    while ((match = entityPattern.exec(this.content)) !== null) {
      const entityLine = this.content.substring(0, match.index).split('\n').length;
      const entityContext = this.content.substring(match.index, match.index + 1000);

      // 检测字段定义
      const hasColumnDef = /@Column|@PrimaryColumn|@Property/.test(entityContext);

      if (hasColumnDef) {
        // 检测是否有默认值
        const hasDefault =
          /default\s*:|defaultValue|@Default/.test(entityContext) ||
          /DEFAULT\s+/.test(entityContext);

        if (!hasDefault) {
          this.issues.push({
            file: this.filePath,
            line: entityLine,
            column: 1,
            type: 'missing-db-default',
            severity: 'P1',
            message: '数据库实体字段缺少默认值定义',
            suggestion: '使用 @Column({ default: value }) 定义默认值',
            checkId: 'A1-09',
          });
          break;
        }
      }
    }
  }

  // ============ A1-11: API 返回脱敏 (P0) ============

  /**
   * 检测 API 返回是否对敏感字段进行脱敏
   */
  private detectMissingApiMasking(): void {
    if (!this.hasSensitiveFields()) return;

    // 检测是否有脱敏处理
    const hasMasking =
      /mask|privacy|desensitize|脱敏|隐藏/.test(this.content) ||
      /transformer|@Transform/.test(this.content);

    // 检测是否有返回敏感字段
    const hasSensitiveReturn =
      /return\s*\{[^}]*(phone|mobile|idCard|cardNo|password)/i.test(this.content);

    if (hasSensitiveReturn && !hasMasking) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-api-masking',
        severity: 'P0',
        message: 'API 返回的敏感字段未进行脱敏处理',
        suggestion: '使用 @Transform 装饰器或手动处理脱敏',
        checkId: 'A1-11',
      });
    }
  }
}

// ============ 批量扫描器 ============

export class DataStructureScanner {
  private frontendPath: string;
  private backendPath: string;

  constructor(
    frontendPath: string = 'orion-frontend/src/pages/',
    backendPath: string = 'orion-platform-service/src/'
  ) {
    this.frontendPath = frontendPath;
    this.backendPath = backendPath;
  }

  /**
   * 扫描前端文件
   */
  async scanFrontend(maxFiles: number = 100): Promise<DataStructureIssue[]> {
    const allIssues: DataStructureIssue[] = [];
    const files = this.getTsxFiles(this.frontendPath).slice(0, maxFiles);

    console.log(`📊 开始扫描前端文件 (${files.length} 个)...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (i % 20 === 0) {
        console.log(`  进度: ${i}/${files.length}`);
      }

      try {
        const analyzer = new A1DataStructureAnalyzer(file);
        const result = analyzer.analyze();
        allIssues.push(...result.issues);
      } catch {
        // 忽略解析错误
      }
    }

    console.log(`✅ 前端扫描完成，发现 ${allIssues.length} 个问题`);
    return allIssues;
  }

  /**
   * 扫描后端文件
   */
  async scanBackend(maxFiles: number = 50): Promise<DataStructureIssue[]> {
    const allIssues: DataStructureIssue[] = [];
    const files = this.getTsFiles(this.backendPath).slice(0, maxFiles);

    console.log(`📊 开始扫描后端文件 (${files.length} 个)...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (i % 10 === 0) {
        console.log(`  进度: ${i}/${files.length}`);
      }

      try {
        const analyzer = new BackendDataStructureAnalyzer(file);
        const result = analyzer.analyze();
        allIssues.push(...result.issues);
      } catch {
        // 忽略解析错误
      }
    }

    console.log(`✅ 后端扫描完成，发现 ${allIssues.length} 个问题`);
    return allIssues;
  }

  /**
   * 完整扫描
   */
  async scan(frontendMax: number = 100, backendMax: number = 50): Promise<DataStructureIssue[]> {
    const frontendIssues = await this.scanFrontend(frontendMax);
    const backendIssues = await this.scanBackend(backendMax);

    return [...frontendIssues, ...backendIssues];
  }

  /**
   * 按严重程度分组
   */
  groupBySeverity(issues: DataStructureIssue[]): Record<string, DataStructureIssue[]> {
    return {
      P0: issues.filter(i => i.severity === 'P0'),
      P1: issues.filter(i => i.severity === 'P1'),
    };
  }

  /**
   * 按检查项分组
   */
  groupByCheckId(issues: DataStructureIssue[]): Record<string, DataStructureIssue[]> {
    const groups: Record<string, DataStructureIssue[]> = {};

    for (const issue of issues) {
      if (!groups[issue.checkId]) {
        groups[issue.checkId] = [];
      }
      groups[issue.checkId].push(issue);
    }

    return groups;
  }

  /**
   * 统计覆盖率
   */
  calculateCoverage(issues: DataStructureIssue[], totalItems: number = 14): number {
    const coveredItems = new Set(
      issues.map(i => i.checkId.replace(/-\d+$/, ''))
    );
    return Math.round((coveredItems.size / totalItems) * 100);
  }

  private getTsxFiles(dir: string): string[] {
    const files: string[] = [];

    const traverse = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (
            entry.isDirectory() &&
            !entry.name.startsWith('.') &&
            entry.name !== 'node_modules'
          ) {
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

  private getTsFiles(dir: string): string[] {
    const files: string[] = [];

    const traverse = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (
            entry.isDirectory() &&
            !entry.name.startsWith('.') &&
            entry.name !== 'node_modules'
          ) {
            traverse(fullPath);
          } else if (
            entry.isFile() &&
            entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.d.ts')
          ) {
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

export async function runDataStructureScan(
  frontendPath: string = 'orion-frontend/src/pages/',
  backendPath: string = 'orion-platform-service/src/',
  frontendMax: number = 100,
  backendMax: number = 50
): Promise<DataStructureIssue[]> {
  const scanner = new DataStructureScanner(frontendPath, backendPath);
  return scanner.scan(frontendMax, backendMax);
}

// ============ tsconfig strict 模式检测器 (A1-05) ============

export interface TsConfigIssue {
  file: string;
  type: 'missing-strict-mode' | 'missing-strict-null-checks' | 'weak-strict-config';
  severity: 'P0';
  message: string;
  suggestion: string;
  checkId: string;
}

/**
 * 检测 tsconfig.json 是否启用 strict 模式
 * 这是 A1-05: TypeScript strict 模式的检测
 */
export class TsConfigAnalyzer {
  private configPath: string;
  private config: any;

  constructor(configPath: string = 'tsconfig.json') {
    this.configPath = configPath;
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      this.config = JSON.parse(content);
    } catch {
      this.config = {};
    }
  }

  /**
   * 分析 tsconfig 的 strict 配置
   */
  analyze(): TsConfigIssue[] {
    const issues: TsConfigIssue[] = [];

    // 获取 compilerOptions
    const compilerOptions = this.config?.compilerOptions || {};

    // A1-05: 检测 strict 模式
    const strict = compilerOptions.strict;

    if (strict === undefined || strict === false) {
      issues.push({
        file: this.configPath,
        type: 'missing-strict-mode',
        severity: 'P0',
        message: 'tsconfig.json 缺少 "strict": true 配置',
        suggestion: '添加 "strict": true 启用严格类型检查',
        checkId: 'A1-05',
      });
    }

    // 检测其他严格类型配置
    if (strict === true) {
      const strictNullChecks = compilerOptions.strictNullChecks;
      const noImplicitAny = compilerOptions.noImplicitAny;
      const strictNullChecksEnabled = strictNullChecks !== false;
      const noImplicitAnyEnabled = noImplicitAny !== false;

      if (!strictNullChecksEnabled || !noImplicitAnyEnabled) {
        issues.push({
          file: this.configPath,
          type: 'weak-strict-config',
          severity: 'P0',
          message: 'strict 模式配置不完整',
          suggestion: '确保 strictNullChecks 和 noImplicitAny 为 true',
          checkId: 'A1-05',
        });
      }
    }

    return issues;
  }
}

/**
 * 扫描项目中的 tsconfig 文件
 */
export async function scanTsConfig(
  basePath: string = process.cwd()
): Promise<TsConfigIssue[]> {
  const allIssues: TsConfigIssue[] = [];

  const tsconfigPaths = [
    path.join(basePath, 'tsconfig.json'),
    path.join(basePath, 'orion-frontend', 'tsconfig.json'),
    path.join(basePath, 'orion-platform-service', 'tsconfig.json'),
  ];

  for (const configPath of tsconfigPaths) {
    if (fs.existsSync(configPath)) {
      const analyzer = new TsConfigAnalyzer(configPath);
      const issues = analyzer.analyze();
      allIssues.push(...issues);
    }
  }

  return allIssues;
}

// 使用示例
// runDataStructureScan().then(issues => {
//   console.log(JSON.stringify(issues, null, 2));
// });