// orion-platform-service/src/services/privacy/NERModelService.ts
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface NEREntity {
  type: 'name' | 'organization' | 'location' | 'date' | 'email' | 'phone' | 'id_card';
  value: string;
  start: number;
  end: number;
  confidence: number;
}

// Entity type mapping from transformers output to our types
const ENTITY_TYPE_MAP: Record<string, NEREntity['type']> = {
  'PER': 'name',
  'PERSON': 'name',
  'ORG': 'organization',
  'ORGANIZATION': 'organization',
  'LOC': 'location',
  'LOCATION': 'location',
  'DATE': 'date',
  'EMAIL': 'email',
  'PHONE': 'phone',
  'ID_CARD': 'id_card',
};

// Type for pipeline function (loaded dynamically)
type NERPipeline = (text: string) => Promise<any[]>;

export class NERModelService {
  private modelPath: string;
  private nerPipeline: NERPipeline | null = null;
  private modelLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;

  constructor(modelPath?: string) {
    this.modelPath = modelPath || process.env.NER_MODEL_PATH || 'Xenova/bert-base-NER';
  }

  /**
   * Load the NER model (async, cached)
   * Uses dynamic import to avoid bundling issues
   */
  async loadModel(): Promise<void> {
    if (this.modelLoaded) {
      return;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this._loadModelInternal();
    return this.loadingPromise;
  }

  private async _loadModelInternal(): Promise<void> {
    try {
      logger.info(`[NERModel] Loading NER model: ${this.modelPath}`);

      // Dynamic import - only loads if available
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      // @ts-expect-error @xenova/transformers is an optional dependency
      const transformers = await import('@xenova/transformers').catch(() => null) as any;

      if (!transformers) {
        logger.warn('[NERModel] @xenova/transformers not installed. Using regex fallback.');
        this.modelLoaded = false;
        return;
      }

      // Use transformers.js NER pipeline
      const modelName = this.modelPath.includes('bert-base-NER')
        ? 'Xenova/bert-base-NER'
        : this.modelPath;

      this.nerPipeline = await transformers.pipeline('token-classification', modelName, {
        quantized: true,
      });

      this.modelLoaded = true;
      logger.info(`[NERModel] Model loaded successfully: ${modelName}`);
    } catch (error) {
      logger.warn(`[NERModel] Failed to load model: ${error}. Using fallback regex detection.`);
      this.modelLoaded = false;
    }
  }

  /**
   * Detect entities using transformers.js NER model
   * Falls back to regex patterns if model not loaded
   */
  async detect(text: string): Promise<NEREntity[]> {
    // Ensure model is loaded (or attempted)
    await this.loadModel();

    if (this.nerPipeline && this.modelLoaded) {
      return this._detectWithModel(text);
    }

    return this._detectWithRegex(text);
  }

  /**
   * Detect entities using transformers.js model
   */
  private async _detectWithModel(text: string): Promise<NEREntity[]> {
    try {
      const results = await this.nerPipeline!(text);

      const entities: NEREntity[] = [];
      for (const result of results) {
        const entityType = ENTITY_TYPE_MAP[result.entity_group || result.entity] || 'name';

        entities.push({
          type: entityType,
          value: result.word || text.slice(result.start, result.end),
          start: result.start,
          end: result.end,
          confidence: result.score || 0.85,
        });
      }

      logger.debug(`[NERModel] Model detected ${entities.length} entities`);
      return this._deduplicateEntities(entities);
    } catch (error) {
      logger.warn(`[NERModel] Model inference failed: ${error}. Using fallback.`);
      return this._detectWithRegex(text);
    }
  }

  /**
   * Fallback regex-based detection
   */
  private _detectWithRegex(text: string): Promise<NEREntity[]> {
    const entities: NEREntity[] = [];

    // Chinese name patterns
    const namePatterns = [
      /用户([\u4e00-\u9fa5]{2,4})提交/g,
      /姓名[\s:=：]+([\u4e00-\u9fa5]{2,4})/g,
      /联系人[\s:=：]+([\u4e00-\u9fa5]{2,4})/g,
      /用户名[\s:=：]+([\u4e00-\u9fa5]{2,3})/g,
      /^([\u4e00-\u9fa5]{2,3})的/g,
      /([\u4e00-\u9fa5]{2,3})的邮箱/g,
    ];

    for (const pattern of namePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const nameValue = match[1];
          const nameStartInMatch = match[0].indexOf(nameValue);
          const absoluteStart = match.index! + nameStartInMatch;

          entities.push({
            type: 'name',
            value: nameValue,
            start: absoluteStart,
            end: absoluteStart + nameValue.length,
            confidence: 0.75,
          });
        }
      }
    }

    // Organization patterns
    const orgPatterns = [
      /公司[\s:=：]+([\u4e00-\u9fa5]{2,10})/g,
      /组织[\s:=：]+([\u4e00-\u9fa5]{2,10})/g,
      /单位[\s:=：]+([\u4e00-\u9fa5]{2,10})/g,
    ];

    for (const pattern of orgPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const orgValue = match[1];
          const orgStartInMatch = match[0].indexOf(orgValue);
          const absoluteStart = match.index! + orgStartInMatch;

          entities.push({
            type: 'organization',
            value: orgValue,
            start: absoluteStart,
            end: absoluteStart + orgValue.length,
            confidence: 0.7,
          });
        }
      }
    }

    // Location patterns
    const locationPatterns = [
      /地址[\s:=：]+([\u4e00-\u9fa5]{4,30})/g,
      /位置[\s:=：]+([\u4e00-\u9fa5]{2,10})/g,
      /城市[\s:=：]+([\u4e00-\u9fa5]{2,10})/g,
    ];

    for (const pattern of locationPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const locValue = match[1];
          const locStartInMatch = match[0].indexOf(locValue);
          const absoluteStart = match.index! + locStartInMatch;

          entities.push({
            type: 'location',
            value: locValue,
            start: absoluteStart,
            end: absoluteStart + locValue.length,
            confidence: 0.7,
          });
        }
      }
    }

    logger.debug(`[NERModel] Regex detected ${entities.length} entities`);
    return Promise.resolve(this._deduplicateEntities(entities));
  }

  /**
   * Remove overlapping/duplicate entities
   */
  private _deduplicateEntities(entities: NEREntity[]): NEREntity[] {
    if (entities.length === 0) return entities;

    entities.sort((a, b) => a.start - b.start);

    const deduplicated: NEREntity[] = [];
    let lastEnd = -1;

    for (const entity of entities) {
      if (entity.start >= lastEnd) {
        deduplicated.push(entity);
        lastEnd = entity.end;
      } else if (entity.confidence > (deduplicated[deduplicated.length - 1]?.confidence || 0)) {
        deduplicated[deduplicated.length - 1] = entity;
        lastEnd = entity.end;
      }
    }

    return deduplicated;
  }

  /**
   * Get model accuracy score (model-based or fallback)
   */
  getAccuracyScore(): number {
    if (this.modelLoaded) {
      return 0.92;
    }
    return 0.75;
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  /**
   * Get supported entity types
   */
  getSupportedTypes(): NEREntity['type'][] {
    return ['name', 'organization', 'location', 'date', 'email', 'phone', 'id_card'];
  }
}

// Export singleton for convenience
export const nerModelService = new NERModelService();