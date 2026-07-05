import { DoNotDisturbRepository, DoNotDisturb, CreateDoNotDisturbInput } from '../../repositories/DoNotDisturbRepository';
import { createLogger } from '../../utils/logger';

export class DoNotDisturbServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DoNotDisturbServiceError';
  }
}

export class DoNotDisturbService {
  private logger = createLogger('do-not-disturb');

  constructor(private repository: DoNotDisturbRepository) {}

  async setDnd(userId: string, startTime: Date, endTime: Date, reason?: string): Promise<DoNotDisturb> {
    if (endTime <= startTime) {
      throw new DoNotDisturbServiceError('end_time must be after start_time', 'INVALID_INPUT');
    }
    return this.repository.upsert(userId, startTime, endTime, reason);
  }

  async clearDnd(userId: string): Promise<void> {
    const deleted = await this.repository.deleteByUser(userId);
    if (!deleted) {
      throw new DoNotDisturbServiceError(`No DND settings found for user: ${userId}`, 'NOT_FOUND');
    }
  }

  async isDndActive(userId: string): Promise<boolean> {
    const settings = await this.repository.findByUser(userId);
    if (!settings) return false;
    const now = new Date();
    const active = now >= settings.start_time && now <= settings.end_time;
    if (!active && now > settings.end_time) {
      // Auto-clear expired DND
      await this.repository.deleteByUser(userId).catch(() => {});
      return false;
    }
    return active;
  }

  async getDndSettings(userId: string): Promise<DoNotDisturb | null> {
    return this.repository.findByUser(userId);
  }

  async getActiveUsers(): Promise<string[]> {
    return this.repository.findActiveUsers(new Date());
  }
}
