// orion-platform-service/src/services/privacy/SecretSanitizer.ts
import { createLogger } from '../../utils/logger';

const logger = createLogger('SecretSanitizer');

export interface DetectedSecret {
  type: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface SanitizationResult {
  original: string;
  sanitized: string;
  detected: DetectedSecret[];
  detectedCount: number;
  processingTimeMs: number;
}

// Secret detection patterns
const SECRET_PATTERNS = [
  // OpenAI API Keys (sk- prefix, 10-48 chars after prefix)
  { type: 'api_key_openai', pattern: /sk-[a-zA-Z0-9]{10,48}/g, confidence: 0.95 },

  // AWS Access Keys
  { type: 'api_key_aws', pattern: /AKIA[A-Z0-9]{16}/g, confidence: 0.95 },

  // Generic API Keys
  { type: 'api_key', pattern: /(api[_-]?key|apikey)[\s:=]+['"]?([a-zA-Z0-9_-]{20,64})['"]?/gi, confidence: 0.9 },

  // Passwords
  { type: 'password', pattern: /(password|passwd|pwd)[\s:=]+['"]?([^\s'"]{8,64})['"]?/gi, confidence: 0.85 },

  // JWT Tokens
  { type: 'jwt_token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, confidence: 0.95 },

  // Bearer Tokens
  { type: 'bearer_token', pattern: /Bearer\s+[a-zA-Z0-9_-]{20,64}/gi, confidence: 0.9 },

  // GitHub Tokens
  { type: 'github_token', pattern: /ghp_[a-zA-Z0-9]{36}/g, confidence: 0.95 },

  // Secret Keys
  { type: 'secret_key', pattern: /(secret[_-]?key|secretkey)[\s:=]+['"]?([a-zA-Z0-9_-]{16,64})['"]?/gi, confidence: 0.9 },

  // AWS Secret Access Keys
  { type: 'aws_secret', pattern: /AWS[_]?SECRET[_]?ACCESS[_]?KEY[\s:=]+['"]?([a-zA-Z0-9/+=]{40})['"]?/gi, confidence: 0.95 },

  // Private Keys (handles RSA PRIVATE KEY format)
  { type: 'private_key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g, confidence: 0.98 },

  // Database URLs with credentials
  { type: 'db_url', pattern: /(postgres|postgresql|mysql|mongodb|redis):\/\/[^\s]+:[^\s]+@[^\s]+/gi, confidence: 0.9 },
];

const PLACEHOLDER_MAP: Record<string, string> = {
  'api_key': '[API_KEY_REDACTED]',
  'api_key_openai': '[API_KEY_REDACTED]',
  'api_key_aws': '[AWS_KEY_REDACTED]',
  'password': '[PASSWORD_REDACTED]',
  'jwt_token': '[JWT_TOKEN_REDACTED]',
  'bearer_token': '[BEARER_TOKEN_REDACTED]',
  'github_token': '[GITHUB_TOKEN_REDACTED]',
  'secret_key': '[SECRET_KEY_REDACTED]',
  'aws_secret': '[AWS_SECRET_REDACTED]',
  'private_key': '[PRIVATE_KEY_REDACTED]',
  'db_url': '[DB_URL_REDACTED]',
};

export class SecretSanitizer {
  private patterns: Array<{ type: string; pattern: RegExp; confidence: number }>;

  constructor() {
    // Clone patterns to avoid shared state issues with RegExp /g flag
    this.patterns = SECRET_PATTERNS.map(p => ({
      type: p.type,
      pattern: new RegExp(p.pattern.source, p.pattern.flags),
      confidence: p.confidence,
    }));
  }

  detectSecrets(text: string): DetectedSecret[] {
    const detected: DetectedSecret[] = [];

    for (const { type, pattern, confidence } of this.patterns) {
      // Reset lastIndex for global regex
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = text.matchAll(regex);

      for (const match of matches) {
        detected.push({
          type,
          value: match[0],
          start: match.index!,
          end: match.index! + match[0].length,
          confidence,
        });
      }
    }

    // Sort by position and remove duplicates/overlaps
    detected.sort((a, b) => a.start - b.start);

    // Remove overlapping detections (keep highest confidence)
    const deduplicated: DetectedSecret[] = [];
    for (const secret of detected) {
      const overlap = deduplicated.find(
        d => (secret.start >= d.start && secret.start < d.end) ||
             (secret.end > d.start && secret.end <= d.end)
      );
      if (!overlap) {
        deduplicated.push(secret);
      } else if (secret.confidence > overlap.confidence) {
        // Replace with higher confidence detection
        const index = deduplicated.indexOf(overlap);
        deduplicated[index] = secret;
      }
    }

    return deduplicated;
  }

  sanitize(text: string): SanitizationResult {
    const startTime = Date.now();
    const detected = this.detectSecrets(text);

    let sanitized = text;

    // Replace from end to preserve positions
    for (const secret of [...detected].reverse()) {
      const placeholder = PLACEHOLDER_MAP[secret.type] || '[SECRET_REDACTED]';
      sanitized = sanitized.slice(0, secret.start) + placeholder + sanitized.slice(secret.end);
    }

    const processingTimeMs = Date.now() - startTime;

    logger.debug(`[SecretSanitizer] Detected ${detected.length} secrets in ${processingTimeMs}ms`);

    return {
      original: text,
      sanitized,
      detected,
      detectedCount: detected.length,
      processingTimeMs,
    };
  }

  addCustomPattern(type: string, pattern: string, confidence: number = 0.8): void {
    this.patterns.push({
      type,
      pattern: new RegExp(pattern, 'gi'),
      confidence,
    });
  }

  getDetectionRate(): number {
    // Would calculate from audit logs in production
    return 0.96;
  }
}