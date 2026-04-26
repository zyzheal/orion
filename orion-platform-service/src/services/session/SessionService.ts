/**
 * SessionService - Business logic layer for Session
 */
import { SessionRepository, Session } from './SessionRepository';
import { randomBytes } from 'crypto';

export class SessionServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'SessionServiceError'; }
}

export class SessionService {
  private repository: SessionRepository;
  constructor(repository: SessionRepository) { this.repository = repository; }

  async createSession(userId: string, tenantId: string, expiresInHours: number = 24): Promise<{ session: Session; token: string }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const session = await this.repository.create(userId, tenantId, token, expiresAt);
    return { session, token };
  }

  async verifyToken(token: string): Promise<Session | null> {
    return this.repository.findByToken(token);
  }

  async revokeSession(token: string): Promise<boolean> {
    return this.repository.revoke(token);
  }

  async cleanup(): Promise<number> {
    return this.repository.cleanup();
  }
}