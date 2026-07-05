/**
 * A3 流程细节检测器
 * 检测流程细节相关的 16 项设计约束
 * - A3-01~10: 前端检测 (TSX)
 * - A3-11~13: 后端任务检测 (定时任务)
 * - A3-14~15: 集成点检测 (Webhooks, MQ)
 * - A3-16: 危险操作确认 (前端)
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface FlowIssue {
  file: string;
  line: number;
  column: number;
  type: FlowIssueType;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion: string;
  checkId: string; // A3-XX
}

export type FlowIssueType =
  // A3-01 步骤条
  | 'missing-steps'
  // A3-02 状态保留
  | 'missing-state-preservation'
  // A3-03 空数据处理
  | 'missing-empty'
  // A3-04 超长截断
  | 'missing-truncation'
  // A3-05 分页边界
  | 'missing-pagination-boundary'
  // A3-06 数字/日期格式化
  | 'missing-format'
  // A3-07 批量选择
  | 'missing-batch-selection'
  // A3-08 批量进度
  | 'missing-batch-progress'
  // A3-09 批量失败处理
  | 'missing-batch-error'
  // A3-10 批量取消
  | 'missing-batch-cancel'
  // A3-11 执行周期
  | 'missing-cron-schedule'
  // A3-12 并发控制
  | 'missing-concurrency-control'
  // A3-13 超时处理
  | 'missing-timeout'
  // A3-14 Webhook
  | 'missing-webhook'
  // A3-15 MQ契约
  | 'missing-mq-contract'
  // A3-16 危险确认
  | 'missing-confirmation';

export interface FlowScanResult {
  file: string;
  issues: FlowIssue[];
  stats: {
    tables: number;
    forms: number;
    batchOps: number;
    scheduledTasks: number;
  };
}

// ============ 前端检测器 ============

export class A3FlowAnalyzer {
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
   * 分析文件中的流程细节问题
   */
  analyze(): FlowScanResult {
    const issues: FlowIssue[] = [];

    // A3-01: 步骤条/引导
    issues.push(...this.detectMissingSteps());

    // A3-02: 状态保留
    issues.push(...this.detectMissingStatePreservation());

    // A3-03: 空数据处理
    issues.push(...this.detectMissingEmpty());

    // A3-04: 超长截断
    issues.push(...this.detectMissingTruncation());

    // A3-05: 分页边界处理
    issues.push(...this.detectMissingPaginationBoundary());

    // A3-06: 数字/日期格式化
    issues.push(...this.detectMissingFormat());

    // A3-07: 批量选择
    issues.push(...this.detectMissingBatchSelection());

    // A3-08: 批量进度提示
    issues.push(...this.detectMissingBatchProgress());

    // A3-09: 批量失败处理
    issues.push(...this.detectMissingBatchError());

    // A3-10: 批量取消
    issues.push(...this.detectMissingBatchCancel());

    // A3-16: 危险操作确认
    issues.push(...this.detectMissingConfirmation());

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues,
      stats,
    };
  }

  // ============ A3-01: 步骤条/引导 ============

  /**
   * 检测多步骤流程是否缺少步骤条
   * 识别场景: 向导、创建流程、配置流程等多步骤场景
   */
  private detectMissingSteps(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // 检测是否是向导/步骤流程组件
    const isWizardPage = /Wizard|Step|Guide|Wizard|ProcessFlow/i.test(this.filePath) ||
                        /Steps|Stepper/i.test(this.content);

    // 如果有步骤组件，检查是否有 Steps/Steps组件渲染
    const hasStepComponent = /<Steps|<Stepper/i.test(this.content);

    // 检测多步骤场景
    const hasMultiStepLogic = this.content.includes('currentStep') ||
                              this.content.includes('activeStep') ||
                              this.content.includes('stepIndex') ||
                              this.content.includes('setStep');

    // 如果有步骤逻辑但没有步骤条组件，报告问题
    if (hasMultiStepLogic && !hasStepComponent) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-steps',
        severity: 'P1',
        message: '多步骤流程缺少步骤条组件',
        suggestion: '添加 <Steps> 组件显示流程进度',
        checkId: 'A3-01',
      });
    }

    return issues;
  }

  // ============ A3-02: 状态保留 ============

  /**
   * 检测上一步/下一步状态是否保留
   */
  private detectMissingStatePreservation(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // 检测多步骤场景
    const hasMultiStep = this.content.includes('currentStep') ||
                        this.content.includes('activeStep') ||
                        this.content.includes('nextStep') ||
                        this.content.includes('prevStep');

    if (!hasMultiStep) return issues;

    // 检查状态保存机制
    const hasStatePreservation =
      // 方式1: 表单值保存到 state
      /(setFormData|setFormValues|formData\s*=|formValues\s*=)/.test(this.content) ||
      // 方式2: useRef 保存状态
      /useRef.*formData|useRef.*data/.test(this.content) ||
      // 方式3: 父组件传递状态
      /onNext.*form|onPrev.*form/.test(this.content) ||
      // 方式4: Context 保存状态
      /useContext.*FormContext|FormProvider/.test(this.content);

    if (hasMultiStep && !hasStatePreservation) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-state-preservation',
        severity: 'P1',
        message: '多步骤流程未保存上一步数据',
        suggestion: '使用 state/context 保存每一步的输入数据',
        checkId: 'A3-02',
      });
    }

    return issues;
  }

  // ============ A3-03: 空数据处理 (P0) ============

  /**
   * 检测列表是否缺少 Empty 组件
   */
  private detectMissingEmpty(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    const hasDataSource = /\b(dataSource|data|list|items|rows)\b/.test(this.content);
    const hasEmpty = /\b<Empty\b/.test(this.content);
    const isListComponent = this.isListComponent();

    // 检测数据条件渲染
    const hasConditionalRender = /\{\s*.*(dataSource|data|list)\s*(&&|\?)\s*</.test(this.content) ||
                                /dataSource\?\.length/.test(this.content) ||
                                /data\.length/.test(this.content);

    if (hasDataSource && isListComponent && !hasEmpty && hasConditionalRender) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-empty',
        severity: 'P0',
        message: '列表数据可能为空但缺少 Empty 组件',
        suggestion: '添加 <Empty description="暂无数据" /> 或使用条件渲染',
        checkId: 'A3-03',
      });
    }

    return issues;
  }

  // ============ A3-04: 超长截断 (P1) ============

  /**
   * 检测超长文本是否截断处理
   */
  private detectMissingTruncation(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // 检测长文本字段
    const hasLongText = /<Text>|<Typography\.Text|<span|<div/.test(this.content);
    const hasDescription = /<Descriptions|<Descriptions\.Item/.test(this.content);

    if (!hasLongText && !hasDescription) return issues;

    // 检查截断机制
    const hasTruncation =
      // 方式1: ellipsis 属性
      /ellipsis/.test(this.content) ||
      // 方式2: slice/substring 截断
      /(slice|substring|substr)\(0,/.test(this.content) ||
      // 方式3: 文本溢出CSS
      /(textOverflow|overflow.*hidden)/.test(this.content) ||
      // 方式4: Tooltip 配合截断
      (/ellipsis/.test(this.content) && /Tooltip/.test(this.content));

    if ((hasLongText || hasDescription) && !hasTruncation) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-truncation',
        severity: 'P1',
        message: '长文本内容缺少截断处理',
        suggestion: '添加 ellipsis 属性或使用 text.slice(0, 100) 截断',
        checkId: 'A3-04',
      });
    }

    return issues;
  }

  // ============ A3-05: 分页边界处理 (P1) ============

  /**
   * 检测分页边界情况处理
   */
  private detectMissingPaginationBoundary(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    const hasPagination = /pagination|Pagination/i.test(this.content);

    if (!hasPagination) return issues;

    // 检测边界处理
    const hasBoundaryHandling =
      // 方式1: total 或 totalCount
      /total\s*[>=<]/.test(this.content) ||
      // 方式2: pageSize 变化处理
      /onShowSizeChange|onChange.*page/.test(this.content) ||
      // 方式3: 分页为 0 或空处理
      /pagination\s*===?\s*0|pagination\s*===?\s*false/.test(this.content);

    if (hasPagination && !hasBoundaryHandling) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-pagination-boundary',
        severity: 'P1',
        message: '分页组件缺少边界情况处理',
        suggestion: '处理空数据、总数为0、页码超界等边界情况',
        checkId: 'A3-05',
      });
    }

    return issues;
  }

  // ============ A3-06: 数字/日期格式化 (P1) ============

  /**
   * 检测超大数字和日期是否格式化
   */
  private detectMissingFormat(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // 检测数字和日期字段
    const hasNumberField = /\b(price|amount|count|total|size|bytes|memory|cpu)\b/i.test(this.content);
    const hasDateField = /\b(date|time|created|updated|expired|timestamp)\b/i.test(this.content);

    if (!hasNumberField && !hasDateField) return issues;

    // 检测格式化方法
    const hasNumberFormat =
      /(format|toLocaleString|NumberFormat|Currency|Decimal)/.test(this.content) ||
      /(\d{1,3}(,\d{3})+|\d+\.\d{2})/.test(this.content); // 简单检测千分位

    const hasDateFormat =
      /(formatDate|moment|dayjs|date-fns|new Date\(.*\))/i.test(this.content) ||
      /(YYYY|MM|DD|HH|mm|ss)/.test(this.content);

    if (hasNumberField && !hasNumberFormat) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-format',
        severity: 'P1',
        message: '数字字段缺少格式化处理',
        suggestion: '使用 formatNumber/toLocaleString 格式化数字',
        checkId: 'A3-06',
      });
    }

    if (hasDateField && !hasDateFormat) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-format',
        severity: 'P1',
        message: '日期字段缺少格式化处理',
        suggestion: '使用 moment/dayjs/formatDate 格式化日期',
        checkId: 'A3-06',
      });
    }

    return issues;
  }

  // ============ A3-07: 批量选择 UI (P0) ============

  /**
   * 检测列表是否支持批量选择
   */
  private detectMissingBatchSelection(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    const hasTable = /<Table|<DataGrid|<List/.test(this.content);
    const isListPage = this.isListComponent();

    if (!hasTable && !isListPage) return issues;

    // 检测 rowSelection
    const hasRowSelection = /rowSelection|rowKey|selectedRowKeys/.test(this.content);

    // 检测批量操作入口（选择后才显示）
    const hasBatchAction = /batch|批量|多选/.test(this.content);

    if ((hasTable || isListPage) && !hasRowSelection && hasBatchAction) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-batch-selection',
        severity: 'P0',
        message: '列表缺少批量选择功能',
        suggestion: '为 Table 添加 rowSelection 属性支持批量选择',
        checkId: 'A3-07',
      });
    }

    return issues;
  }

  // ============ A3-08: 批量进度提示 (P1) ============

  /**
   * 检测批量操作是否有进度提示
   */
  private detectMissingBatchProgress(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    const hasBatchOperation = this.detectBatchOperations();

    if (!hasBatchOperation) return issues;

    // 检测进度显示
    const hasProgressIndicator =
      /Progress|progress|percent|进度/.test(this.content) ||
      /(set)?(Progress|percent|current)\s*[=:]/.test(this.content);

    if (hasBatchOperation && !hasProgressIndicator) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-batch-progress',
        severity: 'P1',
        message: '批量操作缺少进度提示',
        suggestion: '使用 Progress 组件或进度条显示处理进度',
        checkId: 'A3-08',
      });
    }

    return issues;
  }

  // ============ A3-09: 批量失败处理 (P0) ============

  /**
   * 检测批量操作失败是否有处理
   */
  private detectMissingBatchError(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    const hasBatchOperation = this.detectBatchOperations();

    if (!hasBatchOperation) return issues;

    // 检测错误处理
    const hasErrorHandling =
      // 方式1: then/catch
      /\.then.*\.catch/s.test(this.content) ||
      // 方式2: try-catch
      /try\s*\{[^}]*\}\s*catch/.test(this.content) ||
      // 方式3: results filter
      /results\.filter|results\.forEach.*error/.test(this.content) ||
      // 方式4: 错误收集
      /errorResults|failResults|failedItems/.test(this.content);

    if (hasBatchOperation && !hasErrorHandling) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-batch-error',
        severity: 'P0',
        message: '批量操作缺少失败处理逻辑',
        suggestion: '使用 try-catch 或 results.filter 处理失败项',
        checkId: 'A3-09',
      });
    }

    return issues;
  }

  // ============ A3-10: 批量取消功能 (P1) ============

  /**
   * 检测长时间批量操作是否有取消功能
   */
  private detectMissingBatchCancel(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    const hasBatchOperation = this.detectBatchOperations();

    if (!hasBatchOperation) return issues;

    // 检测长时间运行特征
    const isLongRunning = /while|loop|forEach|map.*then/.test(this.content) ||
                          /Promise\.all/.test(this.content);

    if (!isLongRunning) return issues;

    // 检测取消机制
    const hasCancelMechanism =
      /cancel|abort|stop|中断/.test(this.content) ||
      /isCancelled|isAborted|cancelled/.test(this.content);

    if (hasBatchOperation && isLongRunning && !hasCancelMechanism) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-batch-cancel',
        severity: 'P1',
        message: '长时间批量操作缺少取消功能',
        suggestion: '添加取消按钮和相关状态控制',
        checkId: 'A3-10',
      });
    }

    return issues;
  }

  // ============ A3-16: 危险操作二次确认 (P0) ============

  /**
   * 检测删除、修改等危险操作是否有二次确认
   */
  private detectMissingConfirmation(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // 检测危险操作
    const hasDangerousOp = /delete|remove|destroy|删除|移除|注销|clear/.test(this.content.toLowerCase());

    if (!hasDangerousOp) return issues;

    // 检测确认机制
    const hasConfirmation =
      // 方式1: Popconfirm
      /<Popconfirm/i.test(this.content) ||
      // 方式2: Modal.confirm
      /Modal\.confirm/i.test(this.content) ||
      // 方式3: confirm 相关的 props
      /confirm.*delete|confirm.*remove|onConfirm/.test(this.content) ||
      // 方式4: 自定义确认弹窗
      /确认删除|确认移除/.test(this.content);

    if (hasDangerousOp && !hasConfirmation) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-confirmation',
        severity: 'P0',
        message: '危险操作缺少二次确认',
        suggestion: '使用 Popconfirm 或 Modal.confirm 添加二次确认',
        checkId: 'A3-16',
      });
    }

    return issues;
  }

  // ============ 辅助方法 ============

  private isListComponent(): boolean {
    const fileName = path.basename(this.filePath, '.tsx');
    return /List|Table|Grid|Items|Rows/i.test(fileName);
  }

  private detectBatchOperations(): boolean {
    return (
      /batch|批量/.test(this.content) ||
      /selectAll|全选/.test(this.content) ||
      /selectedRowKeys|selectedKeys/.test(this.content)
    );
  }

  private collectStats() {
    return {
      tables: (this.content.match(/<Table|<DataGrid/g) || []).length,
      forms: (this.content.match(/<Form|<Form\.Item/g) || []).length,
      batchOps: (this.content.match(/batch|批量|selectAll/g) || []).length,
      scheduledTasks: 0,
    };
  }
}

// ============ 后端任务检测器 ============

export class BackendTaskAnalyzer {
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
      ts.ScriptKind.TS
    );
  }

  analyze(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // A3-11: 执行周期定义
    issues.push(...this.detectMissingCronSchedule());

    // A3-12: 并发控制
    issues.push(...this.detectMissingConcurrencyControl());

    // A3-13: 超时处理
    issues.push(...this.detectMissingTimeout());

    // A3-14: Webhook 定义
    issues.push(...this.detectMissingWebhook());

    // A3-15: MQ 契约
    issues.push(...this.detectMissingMQContract());

    return issues;
  }

  // ============ A3-11: 执行周期定义 ============

  /**
   * 检测定时任务是否有明确的执行周期
   */
  private detectMissingCronSchedule(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // 检测定时任务场景
    const isScheduledTask =
      /cron|schedule|setInterval|setTimeout|timer|CronJob|scheduled/i.test(this.content) ||
      /@Scheduled|scheduleJob|addJob/i.test(this.content);

    if (!isScheduledTask) return issues;

    // 检测周期定义
    const hasCronExpression =
      // Cron 表达式
      /cron|cronExpression|schedule/.test(this.content) ||
      // 固定间隔
      /interval|period|every\s+\d+/.test(this.content) ||
      // 注解
      /@Scheduled|@Cron/i.test(this.content);

    if (isScheduledTask && !hasCronExpression) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-cron-schedule',
        severity: 'P0',
        message: '定时任务缺少明确的执行周期定义',
        suggestion: '添加 cron 表达式或定时配置',
        checkId: 'A3-11',
      });
    }

    return issues;
  }

  // ============ A3-12: 并发控制 (P0) ============

  /**
   * 检测定时任务是否有并发控制
   */
  private detectMissingConcurrencyControl(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    const isScheduledTask =
      /cron|schedule|setInterval|setTimeout|timer|CronJob|scheduled/i.test(this.content) ||
      /@Scheduled|scheduleJob|addJob/i.test(this.content);

    if (!isScheduledTask) return issues;

    // 检测并发控制
    const hasConcurrencyControl =
      // 锁机制
      /lock|mutex|semaphore|acquire|release/.test(this.content) ||
      // 分布式锁
      /redis.*lock|Redisson|setNX/.test(this.content) ||
      // 标志位
      /isRunning|running\s*[=!]|inProgress/.test(this.content) ||
      // 数据库锁
      /FOR UPDATE|lock.*table/.test(this.content);

    if (isScheduledTask && !hasConcurrencyControl) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-concurrency-control',
        severity: 'P0',
        message: '定时任务缺少并发控制',
        suggestion: '使用分布式锁或标志位防止任务重复执行',
        checkId: 'A3-12',
      });
    }

    return issues;
  }

  // ============ A3-13: 超时处理 (P1) ============

  /**
   * 检测任务是否有超时处理
   */
  private detectMissingTimeout(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // 检测长时间运行的任务
    const isLongRunning =
      /while|for\s*\(|loop|recursive|retry|重试/.test(this.content) ||
      /await.*sleep|delay|timeout/i.test(this.content);

    if (!isLongRunning) return issues;

    // 检测超时处理
    const hasTimeoutHandling =
      /timeout|timeoutMs|maxExecutionTime|cancelAfter/.test(this.content) ||
      /setTimeout|clearTimeout/.test(this.content) ||
      /race.*Promise|Promise\.race/.test(this.content);

    if (isLongRunning && !hasTimeoutHandling) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-timeout',
        severity: 'P1',
        message: '长时间运行任务缺少超时处理',
        suggestion: '添加 timeout 或取消机制防止任务无限等待',
        checkId: 'A3-13',
      });
    }

    return issues;
  }

  // ============ A3-14: Webhook 定义 (P1) ============

  /**
   * 检测集成点是否有 Webhook 定义
   */
  private detectMissingWebhook(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // 检测集成场景
    const isIntegrationPoint =
      /webhook|hook|trigger|event|回调|通知/i.test(this.content) ||
      /on\w+Event|addEventListener|emit/i.test(this.content);

    if (!isIntegrationPoint) return issues;

    // 检测 webhook 定义
    const hasWebhookDef =
      /webhook|webhookUrl|hookUrl|endpoint|url\s*:/.test(this.content) ||
      /headers|method|POST|GET/.test(this.content);

    if (isIntegrationPoint && !hasWebhookDef) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-webhook',
        severity: 'P1',
        message: '集成点缺少 Webhook 定义',
        suggestion: '定义 Webhook URL、请求方法、headers 等契约',
        checkId: 'A3-14',
      });
    }

    return issues;
  }

  // ============ A3-15: MQ 契约 (P1) ============

  /**
   * 检测异步通信是否有消息队列契约
   */
  private detectMissingMQContract(): FlowIssue[] {
    const issues: FlowIssue[] = [];

    // 检测 MQ 场景
    const isMQUsage =
      /mq|message.*queue|kafka|rabbit|redis.*publish|subscribe|publish|subscribe/i.test(this.content) ||
      /sendMessage|receiveMessage|produce|consume/i.test(this.content);

    if (!isMQUsage) return issues;

    // 检测契约定义
    const hasMQContract =
      // 队列/主题定义
      /queue|topic|exchange|routingKey/.test(this.content) ||
      // 消息格式
      /messageType|eventType|payload|schema/.test(this.content) ||
      // 消费者/生产者
      /consumer|producer|publisher/.test(this.content);

    if (isMQUsage && !hasMQContract) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-mq-contract',
        severity: 'P1',
        message: '异步通信缺少消息队列契约',
        suggestion: '定义队列/主题、消息格式、消费者等契约',
        checkId: 'A3-15',
      });
    }

    return issues;
  }
}

// ============ 批量扫描器 ============

export class FlowScanner {
  private frontendPath: string;
  private backendPath: string;

  constructor(
    frontendPath: string = 'orion-frontend/src/pages/',
    backendPath: string = 'orion-platform-service/src/services/'
  ) {
    this.frontendPath = frontendPath;
    this.backendPath = backendPath;
  }

  /**
   * 扫描前端文件
   */
  async scanFrontend(maxFiles: number = 100): Promise<FlowIssue[]> {
    const allIssues: FlowIssue[] = [];
    const files = this.getTsxFiles(this.frontendPath).slice(0, maxFiles);

    console.log(`📊 开始扫描前端文件 (${files.length} 个)...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (i % 20 === 0) {
        console.log(`  进度: ${i}/${files.length}`);
      }

      try {
        const analyzer = new A3FlowAnalyzer(file);
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
  async scanBackend(maxFiles: number = 50): Promise<FlowIssue[]> {
    const allIssues: FlowIssue[] = [];
    const files = this.getTsFiles(this.backendPath).slice(0, maxFiles);

    console.log(`📊 开始扫描后端文件 (${files.length} 个)...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (i % 10 === 0) {
        console.log(`  进度: ${i}/${files.length}`);
      }

      try {
        const analyzer = new BackendTaskAnalyzer(file);
        const issues = analyzer.analyze();
        allIssues.push(...issues);
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
  async scan(frontendMax: number = 100, backendMax: number = 50): Promise<FlowIssue[]> {
    const frontendIssues = await this.scanFrontend(frontendMax);
    const backendIssues = await this.scanBackend(backendMax);

    return [...frontendIssues, ...backendIssues];
  }

  /**
   * 按严重程度分组
   */
  groupBySeverity(issues: FlowIssue[]): Record<string, FlowIssue[]> {
    return {
      P0: issues.filter(i => i.severity === 'P0'),
      P1: issues.filter(i => i.severity === 'P1'),
      P2: issues.filter(i => i.severity === 'P2'),
    };
  }

  /**
   * 按检查项分组
   */
  groupByCheckId(issues: FlowIssue[]): Record<string, FlowIssue[]> {
    const groups: Record<string, FlowIssue[]> = {};

    for (const issue of issues) {
      if (!groups[issue.checkId]) {
        groups[issue.checkId] = [];
      }
      groups[issue.checkId].push(issue);
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

  private getTsFiles(dir: string): string[] {
    const files: string[] = [];

    const traverse = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            traverse(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
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

export async function runFlowScan(
  frontendPath: string = 'orion-frontend/src/pages/',
  backendPath: string = 'orion-platform-service/src/services/',
  frontendMax: number = 100,
  backendMax: number = 50
): Promise<FlowIssue[]> {
  const scanner = new FlowScanner(frontendPath, backendPath);
  return scanner.scan(frontendMax, backendMax);
}

// 使用示例
// runFlowScan().then(issues => {
//   console.log(JSON.stringify(issues, null, 2));
// });