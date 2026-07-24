/**
 * 敏感数据发现与脱敏服务
 *
 * 功能：
 * 1. 自动识别敏感字段（手机号、身份证、邮箱、银行卡等）
 * 2. 多种脱敏策略（掩码、哈希、截断、替换）
 * 3. 脱敏规则管理
 * 4. 扫描报告生成
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

/** 敏感数据类型 */
export enum SensitiveDataType {
  PHONE = 'phone',
  ID_CARD = 'id_card',
  EMAIL = 'email',
  BANK_CARD = 'bank_card',
  NAME = 'name',
  ADDRESS = 'address',
  IP_ADDRESS = 'ip_address',
  PASSWORD = 'password',
  CREDIT_CARD = 'credit_card',
  PASSPORT = 'passport',
  LICENSE_PLATE = 'license_plate',
  CUSTOM = 'custom',
}

/** 脱敏策略 */
export enum MaskStrategy {
  /** 部分掩码：保留首尾，中间用 * 替代 */
  PARTIAL_MASK = 'partial_mask',
  /** 全掩码：全部替换为 * */
  FULL_MASK = 'full_mask',
  /** 哈希：使用 SHA256 哈希 */
  HASH = 'hash',
  /** 截断：只保留前 N 位 */
  TRUNCATE = 'truncate',
  /** 替换：使用固定值替换 */
  REPLACE = 'replace',
  /** 加密：使用 AES 加密 */
  ENCRYPT = 'encrypt',
}

/** 敏感数据规则 */
export interface SensitiveDataRule {
  id: string;
  name: string;
  type: SensitiveDataType;
  pattern: RegExp;
  description: string;
  strategy: MaskStrategy;
  strategyOptions?: Record<string, unknown>;
  enabled: boolean;
  priority: number;
}

/** 字段扫描结果 */
export interface FieldScanResult {
  columnName: string;
  tableName: string;
  database: string;
  dataType: string;
  matchedType: SensitiveDataType;
  matchedRule: string;
  confidence: number;   // 0-1
  sampleValues: string[];
  sampleCount: number;
  sensitiveCount: number;
}

/** 扫描报告 */
export interface ScanReport {
  id: string;
  timestamp: Date;
  database: string;
  tablesScanned: number;
  fieldsScanned: number;
  sensitiveFieldsFound: number;
  results: FieldScanResult[];
  summary: Record<SensitiveDataType, number>;
  duration: number; // 毫秒
}

/** 脱敏结果 */
export interface MaskResult {
  original: string;
  masked: string;
  strategy: MaskStrategy;
  type: SensitiveDataType;
  reversible: boolean;
}

/** 脱敏请求 */
export interface MaskRequest {
  value: string;
  type: SensitiveDataType;
  strategy?: MaskStrategy;
  options?: Record<string, unknown>;
}

/** 敏感数据检测器配置 */
export interface SensitiveDataDetectorConfig {
  /** 默认脱敏策略 */
  defaultStrategy: MaskStrategy;
  /** 最小匹配置信度 */
  minConfidence: number;
  /** 扫描时每个字段采样的最大行数 */
  maxSampleRows: number;
  /** 是否启用自动扫描 */
  enableAutoScan: boolean;
}

const DEFAULT_CONFIG: SensitiveDataDetectorConfig = {
  defaultStrategy: MaskStrategy.PARTIAL_MASK,
  minConfidence: 0.7,
  maxSampleRows: 100,
  enableAutoScan: true,
};

// ==================== 服务实现 ====================

/**
 * 敏感数据发现与脱敏服务
 */
export class SensitiveDataDetector extends EventEmitter {
  private config: SensitiveDataDetectorConfig;
  private rules: SensitiveDataRule[] = [];
  private scanHistory: ScanReport[] = [];
  private maskHistory: MaskResult[] = [];

  constructor(config: Partial<SensitiveDataDetectorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registerDefaultRules();
  }

  /**
   * 检测单个值是否为敏感数据
   */
  detect(value: string): { type: SensitiveDataType; ruleName: string; confidence: number } | null {
    let bestMatch: { type: SensitiveDataType; ruleName: string; confidence: number } | null = null;

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.pattern.test(value)) {
        const confidence = this.calculateConfidence(value, rule);
        if (confidence >= this.config.minConfidence) {
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { type: rule.type, ruleName: rule.name, confidence };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * 批量检测
   */
  detectBatch(values: string[]): Map<string, { type: SensitiveDataType; ruleName: string; confidence: number } | null> {
    const results = new Map<string, typeof bestMatch>();
    let bestMatch: { type: SensitiveDataType; ruleName: string; confidence: number } | null = null;

    for (const value of values) {
      results.set(value, this.detect(value));
    }

    return results;
  }

  /**
   * 脱敏处理
   */
  mask(request: MaskRequest): MaskResult {
    const { value, type, strategy, options } = request;
    const rule = this.rules.find((r) => r.type === type && r.enabled);
    const actualStrategy = strategy || rule?.strategy || this.config.defaultStrategy;

    let masked: string;
    switch (actualStrategy) {
      case MaskStrategy.PARTIAL_MASK:
        masked = this.partialMask(value);
        break;
      case MaskStrategy.FULL_MASK:
        masked = this.fullMask(value);
        break;
      case MaskStrategy.HASH:
        masked = this.hashValue(value);
        break;
      case MaskStrategy.TRUNCATE:
        masked = this.truncateValue(value, (options?.length as number) || 3);
        break;
      case MaskStrategy.REPLACE:
        masked = (options?.replacement as string) || '***';
        break;
      case MaskStrategy.ENCRYPT:
        masked = this.encryptValue(value);
        break;
      default:
        masked = this.partialMask(value);
    }

    const result: MaskResult = {
      original: value,
      masked,
      strategy: actualStrategy,
      type,
      reversible: actualStrategy === MaskStrategy.ENCRYPT,
    };

    this.maskHistory.push(result);
    this.emit('data-masked', result);
    return result;
  }

  /**
   * 批量脱敏
   */
  maskBatch(requests: MaskRequest[]): MaskResult[] {
    return requests.map((r) => this.mask(r));
  }

  /**
   * 扫描数据库表结构（模拟实现）
   */
  async scanDatabase(database: string, tables?: string[]): Promise<ScanReport> {
    const startTime = Date.now();
    const results: FieldScanResult[] = [];

    // 模拟扫描结果
    const mockFields = this.generateMockScanResults(database, tables);
    results.push(...mockFields);

    // 统计各类型数量
    const summary: Record<string, number> = {};
    for (const result of results) {
      summary[result.matchedType] = (summary[result.matchedType] || 0) + 1;
    }

    const report: ScanReport = {
      id: `scan-${Date.now()}`,
      timestamp: new Date(),
      database,
      tablesScanned: tables?.length || 10,
      fieldsScanned: results.length * 5, // 模拟
      sensitiveFieldsFound: results.length,
      results,
      summary: summary as Record<SensitiveDataType, number>,
      duration: Date.now() - startTime,
    };

    this.scanHistory.push(report);
    this.emit('scan-completed', report);
    return report;
  }

  /**
   * 获取扫描历史
   */
  getScanHistory(limit: number = 20): ScanReport[] {
    return this.scanHistory.slice(-limit);
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: SensitiveDataRule): void {
    const existing = this.rules.find((r) => r.id === rule.id);
    if (existing) {
      throw new Error(`Rule with id ${rule.id} already exists`);
    }
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    this.emit('rule-added', rule);
  }

  /**
   * 更新规则启用状态
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  /**
   * 获取所有规则
   */
  getRules(): SensitiveDataRule[] {
    return [...this.rules];
  }

  /**
   * 获取脱敏历史
   */
  getMaskHistory(limit: number = 100): MaskResult[] {
    return this.maskHistory.slice(-limit);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalScans: number;
    totalSensitiveFields: number;
    totalMaskOperations: number;
    byType: Record<SensitiveDataType, number>;
    byStrategy: Record<MaskStrategy, number>;
  } {
    const byType: Record<string, number> = {};
    for (const report of this.scanHistory) {
      for (const [type, count] of Object.entries(report.summary)) {
        byType[type] = (byType[type] || 0) + count;
      }
    }

    const byStrategy: Record<string, number> = {};
    for (const result of this.maskHistory) {
      byStrategy[result.strategy] = (byStrategy[result.strategy] || 0) + 1;
    }

    return {
      totalScans: this.scanHistory.length,
      totalSensitiveFields: this.scanHistory.reduce((sum, r) => sum + r.sensitiveFieldsFound, 0),
      totalMaskOperations: this.maskHistory.length,
      byType: byType as Record<SensitiveDataType, number>,
      byStrategy: byStrategy as Record<MaskStrategy, number>,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<SensitiveDataDetectorConfig>): void {
    Object.assign(this.config, updates);
  }

  // ==================== 内部方法 ====================

  /**
   * 计算匹配置信度
   */
  private calculateConfidence(value: string, rule: SensitiveDataRule): number {
    // 基于规则匹配的置信度计算
    const match = value.match(rule.pattern);
    if (!match) return 0;

    // 匹配占整个值的比例越高，置信度越高
    const matchRatio = match[0].length / value.length;

    // 按类型调整置信度
    let baseConfidence = 0.8;
    switch (rule.type) {
      case SensitiveDataType.PHONE:
        baseConfidence = /^1[3-9]\d{9}$/.test(value) ? 0.95 : 0.7;
        break;
      case SensitiveDataType.ID_CARD:
        baseConfidence = /^\d{17}[\dXx]$/.test(value) ? 0.98 : 0.6;
        break;
      case SensitiveDataType.EMAIL:
        baseConfidence = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 0.95 : 0.7;
        break;
      case SensitiveDataType.BANK_CARD:
        baseConfidence = /^\d{16,19}$/.test(value) ? 0.9 : 0.6;
        break;
    }

    return Math.min(1, baseConfidence * matchRatio);
  }

  /**
   * 部分掩码
   */
  private partialMask(value: string): string {
    if (value.length <= 4) return '*'.repeat(value.length);
    const keepStart = Math.min(3, Math.floor(value.length * 0.3));
    const keepEnd = Math.min(4, Math.floor(value.length * 0.2));
    const maskLength = value.length - keepStart - keepEnd;
    return value.slice(0, keepStart) + '*'.repeat(maskLength) + value.slice(-keepEnd);
  }

  /**
   * 全掩码
   */
  private fullMask(value: string): string {
    return '*'.repeat(value.length);
  }

  /**
   * 哈希
   */
  private hashValue(value: string): string {
    // 简单的模拟哈希
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  /**
   * 截断
   */
  private truncateValue(value: string, length: number): string {
    return value.slice(0, length) + '...';
  }

  /**
   * 加密（模拟）
   */
  private encryptValue(value: string): string {
    // 模拟加密，实际应使用 AES
    return `enc_${Buffer.from(value).toString('base64')}`;
  }

  /**
   * 生成模拟扫描结果
   */
  private generateMockScanResults(database: string, tables?: string[]): FieldScanResult[] {
    const mockTables = tables || ['users', 'orders', 'payments', 'profiles'];
    const results: FieldScanResult[] = [];

    // 模拟常见敏感字段
    const commonSensitiveFields: { table: string; column: string; type: SensitiveDataType; dataType: string }[] = [
      { table: 'users', column: 'phone', type: SensitiveDataType.PHONE, dataType: 'varchar(20)' },
      { table: 'users', column: 'email', type: SensitiveDataType.EMAIL, dataType: 'varchar(100)' },
      { table: 'users', column: 'id_card', type: SensitiveDataType.ID_CARD, dataType: 'varchar(18)' },
      { table: 'users', column: 'name', type: SensitiveDataType.NAME, dataType: 'varchar(50)' },
      { table: 'users', column: 'address', type: SensitiveDataType.ADDRESS, dataType: 'varchar(200)' },
      { table: 'users', column: 'password_hash', type: SensitiveDataType.PASSWORD, dataType: 'varchar(255)' },
      { table: 'payments', column: 'bank_card', type: SensitiveDataType.BANK_CARD, dataType: 'varchar(19)' },
      { table: 'payments', column: 'credit_card', type: SensitiveDataType.CREDIT_CARD, dataType: 'varchar(16)' },
      { table: 'profiles', column: 'ip_address', type: SensitiveDataType.IP_ADDRESS, dataType: 'varchar(45)' },
    ];

    for (const field of commonSensitiveFields) {
      if (mockTables.includes(field.table)) {
        results.push({
          columnName: field.column,
          tableName: field.table,
          database,
          dataType: field.dataType,
          matchedType: field.type,
          matchedRule: `${field.type}_detection`,
          confidence: 0.85 + Math.random() * 0.15,
          sampleValues: this.generateMockSampleValues(field.type),
          sampleCount: 100,
          sensitiveCount: Math.floor(80 + Math.random() * 20),
        });
      }
    }

    return results;
  }

  /**
   * 生成模拟样本值
   */
  private generateMockSampleValues(type: SensitiveDataType): string[] {
    switch (type) {
      case SensitiveDataType.PHONE:
        return ['138****1234', '159****5678', '186****9012'];
      case SensitiveDataType.EMAIL:
        return ['u***@example.com', 't***@test.com', 'a***@demo.com'];
      case SensitiveDataType.ID_CARD:
        return ['110***********1234', '310***********5678'];
      case SensitiveDataType.NAME:
        return ['张*', '李*', '王**'];
      default:
        return ['***'];
    }
  }

  /**
   * 注册默认规则
   */
  private registerDefaultRules(): void {
    this.rules = [
      {
        id: 'phone',
        name: '手机号检测',
        type: SensitiveDataType.PHONE,
        pattern: /1[3-9]\d{9}/,
        description: '中国大陆手机号码',
        strategy: MaskStrategy.PARTIAL_MASK,
        enabled: true,
        priority: 10,
      },
      {
        id: 'id-card',
        name: '身份证号检测',
        type: SensitiveDataType.ID_CARD,
        pattern: /\d{17}[\dXx]/,
        description: '18位身份证号码',
        strategy: MaskStrategy.PARTIAL_MASK,
        enabled: true,
        priority: 10,
      },
      {
        id: 'email',
        name: '邮箱检测',
        type: SensitiveDataType.EMAIL,
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
        description: '电子邮箱地址',
        strategy: MaskStrategy.PARTIAL_MASK,
        enabled: true,
        priority: 8,
      },
      {
        id: 'bank-card',
        name: '银行卡号检测',
        type: SensitiveDataType.BANK_CARD,
        pattern: /\d{16,19}/,
        description: '银行卡号（16-19位）',
        strategy: MaskStrategy.PARTIAL_MASK,
        enabled: true,
        priority: 9,
      },
      {
        id: 'credit-card',
        name: '信用卡号检测',
        type: SensitiveDataType.CREDIT_CARD,
        pattern: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/,
        description: '信用卡号（16位，可含空格或连字符）',
        strategy: MaskStrategy.PARTIAL_MASK,
        enabled: true,
        priority: 9,
      },
      {
        id: 'password',
        name: '密码字段检测',
        type: SensitiveDataType.PASSWORD,
        pattern: /password|passwd|pwd|secret/i,
        description: '密码相关字段名',
        strategy: MaskStrategy.FULL_MASK,
        enabled: true,
        priority: 10,
      },
      {
        id: 'ip-address',
        name: 'IP地址检测',
        type: SensitiveDataType.IP_ADDRESS,
        pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
        description: 'IPv4 地址',
        strategy: MaskStrategy.PARTIAL_MASK,
        enabled: true,
        priority: 5,
      },
      {
        id: 'passport',
        name: '护照号检测',
        type: SensitiveDataType.PASSPORT,
        pattern: /[A-Z]\d{8}/,
        description: '护照号码',
        strategy: MaskStrategy.PARTIAL_MASK,
        enabled: true,
        priority: 7,
      },
      {
        id: 'license-plate',
        name: '车牌号检测',
        type: SensitiveDataType.LICENSE_PLATE,
        pattern: /[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-Z0-9]{5}/,
        description: '中国车牌号',
        strategy: MaskStrategy.PARTIAL_MASK,
        enabled: true,
        priority: 6,
      },
    ];
  }
}
