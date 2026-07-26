import crypto from 'crypto';
import {
  AlertSilenceRepository,
  type AlertSilenceMatcher,
  type AlertSilence,
} from '../repositories/AlertSilenceRepository.js';

export type { AlertSilenceMatcher, AlertSilence };

export interface CreateSilenceInput {
  matchers: AlertSilenceMatcher[];
  startsAt: Date;
  endsAt: Date | null;
  comment: string;
  createdBy: string;
}

export interface SuppressionResult {
  suppressed: boolean;
  silence?: AlertSilence;
}

/**
 * AlertSilenceService — business logic for alert silence rules.
 *
 * Manages the lifecycle of silence rules and provides label-matching
 * to determine whether an incoming alert should be suppressed.
 */
export class AlertSilenceService {
  private repository: AlertSilenceRepository;

  constructor(repository?: AlertSilenceRepository) {
    this.repository = repository ?? new AlertSilenceRepository();
  }

  /**
   * Create a new silence rule.
   */
  async create(input: CreateSilenceInput): Promise<AlertSilence> {
    const id = crypto.randomUUID();
    return this.repository.create({
      id,
      createdBy: input.createdBy,
      matchers: input.matchers,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      comment: input.comment,
    });
  }

  /**
   * List all silence rules.
   */
  async listAll(): Promise<AlertSilence[]> {
    return this.repository.findAll();
  }

  /**
   * List currently active silence rules.
   */
  async listActive(): Promise<AlertSilence[]> {
    return this.repository.findActive();
  }

  /**
   * Deactivate (soft-delete) a silence rule.
   */
  async delete(id: string): Promise<boolean> {
    return this.repository.deactivate(id);
  }

  /**
   * Determine whether the given alert labels should be suppressed
   * by any active silence rule.
   */
  async shouldSuppress(
    labels: Record<string, string>,
  ): Promise<SuppressionResult> {
    const silence = await this.repository.matchSilence(labels);
    if (silence) {
      return { suppressed: true, silence };
    }
    return { suppressed: false };
  }
}
