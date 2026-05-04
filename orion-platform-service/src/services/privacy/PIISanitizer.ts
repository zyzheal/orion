// orion-platform-service/src/services/privacy/PIISanitizer.ts
import { NERModelService, NEREntity } from './NERModelService';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface DetectedPII {
  type: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
  source: 'regex' | 'ner';
}

export interface PIISanitizationResult {
  original: string;
  sanitized: string;
  detected: DetectedPII[];
  detectedCount: number;
  nerAccuracyScore?: number;
  processingTimeMs: number;
}

// PII正则模式（基础检测）
const PII_REGEX_PATTERNS = [
  // Email
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, confidence: 0.95 },

  // Phone (中国手机号) - 支持带分隔符格式
  { type: 'phone', pattern: /(\+86|86)?[\s-]*1[3-9]\d[\s-]*\d{4}[\s-]*\d{4}/g, confidence: 0.9 },

  // ID Card (18位)
  { type: 'id_card', pattern: /\d{6}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g, confidence: 0.95 },

  // Address (中国地址匹配)
  { type: 'address', pattern: /(地址|住址|联系地址)[\s:=：：]*[^\n，,。]{5,50}/gi, confidence: 0.7 },
];

const PII_PLACEHOLDER_MAP: Record<string, string> = {
  'email': '[EMAIL_REDACTED]',
  'phone': '[PHONE_REDACTED]',
  'name': '[NAME_REDACTED]',
  'id_card': '[ID_CARD_REDACTED]',
  'address': '[ADDRESS_REDACTED]',
};

export class PIISanitizer {
  private regexPatterns: Array<{ type: string; pattern: RegExp; confidence: number }>;
  private nerService: NERModelService;

  constructor(nerService?: NERModelService) {
    this.regexPatterns = PII_REGEX_PATTERNS;
    this.nerService = nerService || new NERModelService();
  }

  detectPII(text: string): DetectedPII[] {
    const detected: DetectedPII[] = [];

    for (const { type, pattern, confidence } of this.regexPatterns) {
      // Reset regex lastIndex for global patterns
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = text.matchAll(regex);

      for (const match of matches) {
        detected.push({
          type,
          value: match[0],
          start: match.index!,
          end: match.index! + match[0].length,
          confidence,
          source: 'regex',
        });
      }
    }

    return detected.sort((a, b) => a.start - b.start);
  }

  async detectPIIWithNER(text: string): Promise<DetectedPII[]> {
    // First use regex (fast)
    const regexDetected = this.detectPII(text);

    // Then use NER (slower, more accurate for names)
    try {
      const nerEntities = await this.nerService.detect(text);

      for (const entity of nerEntities) {
        // Skip if already detected by regex
        const overlap = regexDetected.some(
          d => d.start <= entity.start && d.end >= entity.end
        );

        if (!overlap) {
          regexDetected.push({
            type: entity.type,
            value: entity.value,
            start: entity.start,
            end: entity.end,
            confidence: entity.confidence,
            source: 'ner',
          });
        }
      }
    } catch (error) {
      logger.warn('[PIISanitizer] NER detection failed, using regex only');
    }

    return regexDetected.sort((a, b) => a.start - b.start);
  }

  async sanitize(text: string): Promise<PIISanitizationResult> {
    const startTime = Date.now();
    const detected = await this.detectPIIWithNER(text);

    let sanitized = text;

    // Replace from end to preserve positions
    for (const pii of [...detected].reverse()) {
      const placeholder = PII_PLACEHOLDER_MAP[pii.type] || '[PII_REDACTED]';
      sanitized = sanitized.slice(0, pii.start) + placeholder + sanitized.slice(pii.end);
    }

    const processingTimeMs = Date.now() - startTime;

    logger.debug(`[PIISanitizer] Detected ${detected.length} PII items in ${processingTimeMs}ms`);

    return {
      original: text,
      sanitized,
      detected,
      detectedCount: detected.length,
      nerAccuracyScore: this.nerService.getAccuracyScore(),
      processingTimeMs,
    };
  }
}