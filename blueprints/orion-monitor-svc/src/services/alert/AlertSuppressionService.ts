/**
 * AlertSuppressionService - Stub implementation.
 * Provides alert suppression via maintenance windows and known issues.
 */

import { Alert, AlertSourceType } from './AlertTypes';

export interface SuppressionResult {
  suppressed: boolean;
  reason?: string;
}

export interface MaintenanceWindow {
  id: string;
  name: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  tenantId: string;
  scope: {
    sourceTypes?: AlertSourceType[];
    sourceIds?: string[];
    labelSelectors?: Record<string, string>;
  };
  createdBy: string;
}

export interface KnownIssue {
  id: string;
  title: string;
  description?: string;
  tenantId: string;
  fingerprintPattern?: string;
  labelSelectors?: Record<string, string>;
  silenceDuration: number;
  status: 'open' | 'closed';
  createdBy: string;
}

export interface SuppressionStats {
  totalSuppressed: number;
  maintenanceWindowsActive: number;
  knownIssuesOpen: number;
}

export class AlertSuppressionService {
  private maintenanceWindows: MaintenanceWindow[] = [];
  private knownIssues: KnownIssue[] = [];

  async processAlert(_alert: Alert): Promise<SuppressionResult> {
    return { suppressed: false };
  }

  getStats(): SuppressionStats {
    return {
      totalSuppressed: 0,
      maintenanceWindowsActive: this.maintenanceWindows.length,
      knownIssuesOpen: this.knownIssues.filter(i => i.status === 'open').length,
    };
  }

  getActiveMaintenanceWindows(): MaintenanceWindow[] {
    return this.maintenanceWindows;
  }

  addMaintenanceWindow(window: Omit<MaintenanceWindow, 'id'>): MaintenanceWindow {
    const entry = { ...window, id: `mw-${Date.now()}` };
    this.maintenanceWindows.push(entry);
    return entry;
  }

  getOpenKnownIssues(): KnownIssue[] {
    return this.knownIssues.filter(i => i.status === 'open');
  }

  addKnownIssue(issue: Omit<KnownIssue, 'id'>): KnownIssue {
    const entry = { ...issue, id: `ki-${Date.now()}` };
    this.knownIssues.push(entry);
    return entry;
  }
}
