/**
 * DiagnosticService - Business logic layer for Diagnostic operations
 *
 * Wraps DiagnosticRepository with domain-level operations.
 */

import { DiagnosticRepository, DiagnosticRule } from './DiagnosticRepository';
import { DiagnosticSession, RootCause, Finding } from './types';

export class DiagnosticServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'DiagnosticServiceError'; }
}

export class DiagnosticService {
  private repository: DiagnosticRepository;
  constructor(repository: DiagnosticRepository) { this.repository = repository; }

  async createSession(session: DiagnosticSession): Promise<void> {
    return this.repository.createSession(session);
  }

  async completeSession(sessionId: string, rootCause: RootCause | null, confidence: number, findings: Finding[]): Promise<void> {
    return this.repository.completeSession(sessionId, rootCause, confidence, findings);
  }

  async getSession(id: string): Promise<DiagnosticSession> {
    const session = await this.repository.getSession(id);
    if (!session) throw new DiagnosticServiceError(`Session not found: ${id}`, 'NOT_FOUND');
    return session;
  }

  async getHistory(tenantId: string, limit?: number): Promise<DiagnosticSession[]> {
    return this.repository.getSessions(tenantId, limit);
  }

  async getRules(category?: string): Promise<DiagnosticRule[]> {
    return this.repository.findRules(category);
  }
}
