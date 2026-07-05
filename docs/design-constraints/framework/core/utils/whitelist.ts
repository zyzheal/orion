/**
 * 白名单机制
 * 用于过滤已知的误报场景，降低误报率
 */

/**
 * 白名单规则配置
 */
export interface WhitelistRule {
  /** 匹配模式 */
  match: RegExp;
  /** 排除原因 */
  reason: string;
}

/**
 * 检测器白名单配置
 */
export interface DetectorWhitelist {
  /** 误报模式列表 */
  patterns: WhitelistRule[];
  /** 文件级别白名单 */
  filePatterns: RegExp[];
  /** 代码注释白名单 */
  allowComments: string[];
}

/**
 * 完整白名单配置
 */
export interface WhitelistConfig {
  [detector: string]: DetectorWhitelist;
}

/**
 * 白名单检查结果
 */
export interface WhitelistCheckResult {
  whitelisted: boolean;
  reason?: string;
  detector?: string;
  rule?: string;
}

/**
 * 预定义白名单配置
 * 包含常见误报场景的白名单规则
 */
export const DEFAULT_WHITELIST: WhitelistConfig = {
  // A3-16 危险操作确认
  'missing-confirmation': {
    patterns: [
      { match: /deleteCache|deleteLocal|clearCache|removeTemp/i, reason: '缓存操作' },
      { match: /const\s+\w*delete/i, reason: '变量声明' },
      { match: /\/\/.*delete/i, reason: '注释中的 delete' },
    ],
    filePatterns: [/mock|__tests__|\.test\.|\.spec\./],
    allowComments: ['// skip-check', '// no-confirm-needed'],
  },

  // D3-01 硬编码颜色
  'hardcoded-color': {
    patterns: [
      { match: /colors\.\w+\[|DesignToken|theme\./i, reason: '使用了 Token' },
      { match: /const\s+\w+Color\s*=/i, reason: '常量定义' },
    ],
    filePatterns: [],
    allowComments: [],
  },

  // D3-02 硬编码字体大小
  'hardcoded-font-size': {
    patterns: [
      { match: /fontSize\s*:\s*DesignToken|fontSize\s*:\s*theme\./i, reason: '使用了 Token' },
      { match: /const\s+\w+FontSize/i, reason: '常量定义' },
    ],
    filePatterns: [],
    allowComments: [],
  },

  // D3-03 硬编码间距
  'hardcoded-spacing': {
    patterns: [
      { match: /spacing\.\w+|DesignToken.*spacing/i, reason: '使用了 Token' },
      { match: /margin\s*:\s*\d+|padding\s*:\s*\d+/i, reason: '动态计算' },
    ],
    filePatterns: [],
    allowComments: [],
  },

  // S 安全层 - 敏感日志
  'sensitive-log': {
    patterns: [
      { match: /password\s*:\s*['"]\*\*\*|token\s*:\s*['"]\*\*\*/i, reason: '已脱敏' },
      { match: /console\.\w+\(['"]\w+:\s*\*\*\*/i, reason: '日志中已掩码' },
      { match: /logger\.\w+.*\*\*\*/i, reason: '已脱敏' },
    ],
    filePatterns: [],
    allowComments: [],
  },

  // S 安全层 - SQL 注入
  'sql-injection': {
    patterns: [
      { match: /\$\d+|\{\{.*\}\}/i, reason: '参数化查询' },
      { match: /prepareStatement| parameterized/i, reason: '预处理语句' },
    ],
    filePatterns: [/mock|__tests__|\.test\./],
    allowComments: ['// safe-query', '// nosec'],
  },

  // S 安全层 - XSS
  'xss-vulnerability': {
    patterns: [
      { match: /textContent|innerText/i, reason: '安全 API' },
      { match: /sanitize|escape|htmlEncode/i, reason: '已消毒' },
    ],
    filePatterns: [],
    allowComments: [],
  },

  // A1 数据结构分析 - 缺失必填字段
  'missing-required-field': {
    patterns: [
      { match: /\?\.\w+|\?\?\s*\w+/i, reason: '可选链或空值合并' },
      { match: /if\s*\(\s*\w+\s*\)/i, reason: '条件检查' },
    ],
    filePatterns: [],
    allowComments: [],
  },

  // A2 交互测试 - 缺少异步等待
  'missing-async-await': {
    patterns: [
      { match: /await\s+\w+/i, reason: '已使用 await' },
      { match: /\.then\s*\(/i, reason: '使用 Promise' },
    ],
    filePatterns: [/mock|__tests__|\.test\./],
    allowComments: [],
  },

  // B1 修复分析 - 修复逻辑错误
  'fix-logic-error': {
    patterns: [
      { match: /if\s*\(.*\)\s*\{[^}]*return/i, reason: '有 early return' },
      { match: /try\s*\{[^}]*return/i, reason: 'try 块中返回' },
    ],
    filePatterns: [],
    allowComments: [],
  },

  // B2 性能优化 - 内存泄漏
  'memory-leak': {
    patterns: [
      { match: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\(\s*\)/i, reason: '空依赖数组' },
      { match: /cleanup|clearInterval|clearTimeout/i, reason: '有清理逻辑' },
    ],
    filePatterns: [],
    allowComments: [],
  },

  // C 运营分析 - API 错误处理
  'missing-error-handling': {
    patterns: [
      { match: /catch\s*\(|catch\s*\(\s*\w+/i, reason: '有 catch 块' },
      { match: /\.catch\s*\(/i, reason: '有 Promise catch' },
    ],
    filePatterns: [],
    allowComments: [],
  },
};

/**
 * 获取默认白名单
 * @returns 默认白名单配置
 */
export function getDefaultWhitelist(): WhitelistConfig {
  return { ...DEFAULT_WHITELIST };
}

/**
 * 检查是否命中白名单
 * @param detector - 检测器名称
 * @param content - 待检查的内容（代码行）
 * @param line - 行号
 * @param whitelist - 白名单配置（可选，默认使用默认白名单）
 * @returns 白名单检查结果
 */
export function isWhitelisted(
  detector: string,
  content: string,
  line: number,
  whitelist: WhitelistConfig = DEFAULT_WHITELIST
): WhitelistCheckResult {
  // 检查该检测器是否有白名单配置
  const detectorWhitelist = whitelist[detector];

  if (!detectorWhitelist) {
    return { whitelisted: false };
  }

  // 1. 检查注释白名单
  for (const comment of detectorWhitelist.allowComments) {
    if (content.includes(comment)) {
      return {
        whitelisted: true,
        reason: `匹配注释白名单: ${comment}`,
        detector,
        rule: 'allowComments',
      };
    }
  }

  // 2. 检查模式白名单
  for (const rule of detectorWhitelist.patterns) {
    if (rule.match.test(content)) {
      return {
        whitelisted: true,
        reason: `匹配模式白名单: ${rule.reason}`,
        detector,
        rule: rule.reason,
      };
    }
  }

  return { whitelisted: false };
}

/**
 * 批量检查多个检测器
 * @param detections - 检测结果数组，每个包含 detector, content, line
 * @param whitelist - 白名单配置
 * @returns 过滤后的检测结果
 */
export function filterWhitelisted<T extends { detector: string; content: string; line: number }>(
  detections: T[],
  whitelist: WhitelistConfig = DEFAULT_WHITELIST
): T[] {
  return detections.filter((detection) => {
    const result = isWhitelisted(
      detection.detector,
      detection.content,
      detection.line,
      whitelist
    );
    return !result.whitelisted;
  });
}

/**
 * 检查文件是否在白名单中
 * @param filePath - 文件路径
 * @param filePatterns - 文件模式列表
 * @returns 是否在白名单中
 */
export function isFileWhitelisted(filePath: string, filePatterns: RegExp[]): boolean {
  for (const pattern of filePatterns) {
    if (pattern.test(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * 为检测结果添加白名单过滤
 * @param results - 检测结果数组
 * @param contentProvider - 获取每行内容的方法
 * @param whitelist - 白名单配置
 * @returns 过滤白名单后的结果
 */
export function applyWhitelistFilter<
  T extends { detector: string; line: number; content?: string }
>(
  results: T[],
  contentProvider: (line: number) => string,
  whitelist: WhitelistConfig = DEFAULT_WHITELIST
): T[] {
  return results.filter((result) => {
    const content = result.content || contentProvider(result.line);
    const checkResult = isWhitelisted(
      result.detector,
      content,
      result.line,
      whitelist
    );

    // 如果命中白名单，返回 false 以过滤掉
    return !checkResult.whitelisted;
  });
}

/**
 * 添加自定义白名单规则
 * @param whitelist - 现有白名单
 * @param detector - 检测器名称
 * @param rule - 白名单规则
 * @returns 更新后的白名单
 */
export function addWhitelistRule(
  whitelist: WhitelistConfig,
  detector: string,
  rule: WhitelistRule | RegExp | string,
  reason?: string
): WhitelistConfig {
  const updated = { ...whitelist };

  // 初始化检测器的白名单（如果不存在）
  if (!updated[detector]) {
    updated[detector] = {
      patterns: [],
      filePatterns: [],
      allowComments: [],
    };
  }

  if (typeof rule === 'object' && 'match' in rule) {
    // WhitelistRule 对象
    updated[detector].patterns.push(rule);
  } else if (rule instanceof RegExp) {
    // RegExp
    updated[detector].patterns.push({
      match: rule,
      reason: reason || '自定义规则',
    });
  } else if (typeof rule === 'string') {
    // 注释白名单
    updated[detector].allowComments.push(rule);
  }

  return updated;
}

/**
 * 加载自定义白名单配置
 * @param customConfig - 自定义白名单配置
 * @param existingConfig - 现有配置（可选，默认与默认白名单合并）
 * @returns 合并后的白名单配置
 */
export function mergeWhitelistConfig(
  customConfig: Partial<WhitelistConfig>,
  existingConfig: WhitelistConfig = DEFAULT_WHITELIST
): WhitelistConfig {
  const merged = { ...existingConfig };

  for (const [detector, config] of Object.entries(customConfig)) {
    if (!merged[detector]) {
      merged[detector] = {
        patterns: [],
        filePatterns: [],
        allowComments: [],
      };
    }

    if (config.patterns) {
      merged[detector].patterns = [
        ...merged[detector].patterns,
        ...config.patterns,
      ];
    }

    if (config.filePatterns) {
      merged[detector].filePatterns = [
        ...merged[detector].filePatterns,
        ...config.filePatterns,
      ];
    }

    if (config.allowComments) {
      merged[detector].allowComments = [
        ...merged[detector].allowComments,
        ...config.allowComments,
      ];
    }
  }

  return merged;
}