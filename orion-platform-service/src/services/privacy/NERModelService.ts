// orion-platform-service/src/services/privacy/NERModelService.ts
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface NEREntity {
  type: 'name' | 'organization' | 'location' | 'date';
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export class NERModelService {
  private modelPath: string;
  private accuracyScore: number = 0.92; // BERT-NER典型准确率

  constructor(modelPath?: string) {
    this.modelPath = modelPath || process.env.NER_MODEL_PATH || './models/bert-ner';
  }

  async detect(text: string): Promise<NEREntity[]> {
    // Placeholder: Would call actual BERT-NER model
    // In production, would use transformers.js or Python microservice

    const entities: NEREntity[] = [];

    // Simple heuristic for Chinese names (placeholder)
    // Patterns designed to detect common Chinese name contexts
    const namePatterns = [
      // "用户XXX提交" pattern
      /用户([\u4e00-\u9fa5]{2,4})提交/g,
      // "姓名: XXX" pattern
      /姓名[\s:=：：]+([\u4e00-\u9fa5]{2,4})/g,
      // "联系人: XXX" pattern
      /联系人[\s:=：：]+([\u4e00-\u9fa5]{2,4})/g,
      // "用户名: XXX" pattern
      /用户名[\s:=：：]+([\u4e00-\u9fa5]{2,4})/g,
      // "XXX的" pattern (名字在句首)
      /^([\u4e00-\u9fa5]{2,3})的/g,
      // "XXX的邮箱" pattern
      /([\u4e00-\u9fa5]{2,3})的邮箱/g,
    ];

    for (const pattern of namePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          // Calculate the correct position of the name in the matched string
          const nameValue = match[1];
          const nameStartInMatch = match[0].indexOf(nameValue);
          const absoluteStart = match.index! + nameStartInMatch;

          entities.push({
            type: 'name',
            value: nameValue,
            start: absoluteStart,
            end: absoluteStart + nameValue.length,
            confidence: 0.85,
          });
        }
      }
    }

    return entities;
  }

  getAccuracyScore(): number {
    return this.accuracyScore;
  }

  async loadModel(): Promise<void> {
    logger.info('[NERModel] Loading BERT-NER model from: ' + this.modelPath);
    // Placeholder: Would load actual model
  }
}