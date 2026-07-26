/**
 * AutoRecoveryService - Stub
 * Manages AI provider degradation status and automatic recovery.
 */

export interface ProviderStats {
  providers: Array<{ providerId: string; successRate: number; status: string }>;
  total: number;
}

export interface RecoveryStats {
  providerId: string;
  totalAttempts: number;
  successfulRecoveries: number;
  lastRecoveryAt?: Date;
}

export interface AutoRecoveryConfig {
  threshold: number;
  recoveryInterval: number;
  maxRecoveryAttempts: number;
}

export class AutoRecoveryService {
  getConfig(): AutoRecoveryConfig {
    return { threshold: 0.85, recoveryInterval: 60000, maxRecoveryAttempts: 3 };
  }

  getAllStats(): ProviderStats {
    return { providers: [], total: 0 };
  }

  getDegradedProviders(): string[] {
    return [];
  }

  getOverallSuccessRate(): number {
    return 1.0;
  }

  getRecoveryStats(_providerId: string): RecoveryStats | null {
    return null;
  }

  updateProviderSuccessRate(_providerId: string, _rate: number): void {
    // Stub
  }
}
