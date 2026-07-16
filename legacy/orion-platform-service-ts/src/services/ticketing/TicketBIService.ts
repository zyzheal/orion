/**
 * TASK-TICKET-BI: Ticket BI Analytics Service
 *
 * Comprehensive BI analytics for the ticketing system:
 * - Executive dashboard (boss view with KPIs, trends, rankings, alerts)
 * - Manager dashboard (team detail with member metrics, heatmap, transfer analysis)
 * - Engineer dashboard (personal view with trends, strengths, weaknesses)
 * - Engineer efficiency metrics with composite scoring
 * - Time aggregation at multiple granularities
 * - Period comparison and BI data export
 *
 * Pure computation service -- no side effects, no timers.
 *
 * Architecture: This service is a facade. Computation logic is delegated
 * to specialized builder classes in the same directory:
 * - ExecutiveDashboardBuilder: executive dashboard computation
 * - ManagerDashboardBuilder: manager dashboard computation
 * - EngineerDashboardBuilder: engineer personal dashboard
 * - EngineerMetricsCalculator: efficiency metrics and scoring
 * - PeriodComparator: period-over-period comparison
 * - BIExporter: data export for external BI tools
 * - TimeTrendAnalyzer: time-series trend computation
 *
 * Shared utilities:
 * - BIDataContext: data container
 * - TimeSeriesUtils: time bucketing and formatting
 * - SLAUtils: SLA compliance calculations
 */

import {
  Ticket,
  TicketSLA,
  DispatchResult,
  EngineerProfile,
  TimeGranularity,
  ExecutiveDashboard,
  ManagerDashboard,
  EngineerDashboard,
  BIExportData,
  EfficiencyScore,
  PeriodComparison,
} from './types';
import { BITransferRecordRepository } from '../../repositories/BITransferRecordRepository';
import { BICommentRecordRepository } from '../../repositories/BICommentRecordRepository';
import { BIDataContext } from './BIDataContext';
import { getDefaultStart } from './TimeSeriesUtils';
import { buildExecutiveDashboard } from './ExecutiveDashboardBuilder';
import { buildManagerDashboard } from './ManagerDashboardBuilder';
import { buildEngineerDashboard } from './EngineerDashboardBuilder';
import { comparePeriods } from './PeriodComparator';
import { exportBIData } from './BIExporter';
import { computeTimeTrend } from './TimeTrendAnalyzer';
import { computeEngineerEfficiency, computeEfficiencyScore } from './EngineerMetricsCalculator';

/**
 * Transfer record for analytics
 */
export interface TransferRecord {
  id: string;
  ticketId: string;
  fromEngineer: string;
  toEngineer: string;
  reason: string;
  transferredAt: Date;
  holdTimeMs?: number;
}

/**
 * Comment record for collaboration metrics
 */
export interface CommentRecord {
  id: string;
  ticketId: string;
  authorId: string;
  createdAt: Date;
}

/**
 * Options for dashboard queries
 */
export interface DashboardOptions {
  periodStart?: Date;
  periodEnd?: Date;
  granularity?: TimeGranularity;
}

/**
 * Ticket BI Analytics Service
 *
 * Provides multi-level analytics dashboards:
 * - Executive: high-level KPIs, trends, rankings, alerts
 * - Manager: team metrics, heatmap, week-over-week, transfers
 * - Engineer: personal performance, strengths/weaknesses, active work
 */
export class TicketBIService {
  /** Ticket data */
  private tickets: Ticket[] = [];

  /** SLA records */
  private slaRecords: TicketSLA[] = [];

  /** Dispatch results */
  private dispatchResults: DispatchResult[] = [];

  /** Transfer records - runtime cache */
  private transferRecordRepository?: BITransferRecordRepository;
  private transferRecords: TransferRecord[] = [];

  /** Comment records - runtime cache */
  private commentRecordRepository?: BICommentRecordRepository;
  private commentRecords: CommentRecord[] = [];

  /** Engineer profiles */
  private engineerProfiles: Map<string, EngineerProfile> = new Map();

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.transferRecordRepository = new BITransferRecordRepository(db);
      this.commentRecordRepository = new BICommentRecordRepository(db);
    }
  }

  // ==================== Data Loading ====================

  /**
   * Set ticket data for analysis
   */
  setTickets(tickets: Ticket[]): void {
    this.tickets = [...tickets];
  }

  /**
   * Set SLA records for analysis
   */
  setSLARecords(records: TicketSLA[]): void {
    this.slaRecords = [...records];
  }

  /**
   * Set dispatch results for analysis
   */
  setDispatchResults(results: DispatchResult[]): void {
    this.dispatchResults = [...results];
  }

  /**
   * Set transfer records for analysis
   */
  setTransferRecords(records: TransferRecord[]): void {
    this.transferRecords = [...records];

    // Persist to repository
    if (this.transferRecordRepository) {
      for (const record of records) {
        this.transferRecordRepository.create({
          id: record.id,
          ticketId: record.ticketId,
          fromEngineer: record.fromEngineer,
          toEngineer: record.toEngineer,
          reason: record.reason,
          transferredAt: record.transferredAt,
          holdTimeMs: record.holdTimeMs ?? null,
        }).catch(() => {/* ignore */});
      }
    }
  }

  /**
   * Set comment records for analysis
   */
  setCommentRecords(records: CommentRecord[]): void {
    this.commentRecords = [...records];

    // Persist to repository
    if (this.commentRecordRepository) {
      for (const record of records) {
        this.commentRecordRepository.create({
          id: record.id,
          ticketId: record.ticketId,
          authorId: record.authorId,
          createdAt: record.createdAt,
        }).catch(() => {/* ignore */});
      }
    }
  }

  /**
   * Set engineer profiles for context
   */
  setEngineerProfiles(profiles: EngineerProfile[]): void {
    this.engineerProfiles.clear();
    for (const p of profiles) {
      this.engineerProfiles.set(p.id, p);
    }
  }

  /**
   * Load all data at once
   */
  loadData(data: {
    tickets: Ticket[];
    slaRecords?: TicketSLA[];
    dispatchResults?: DispatchResult[];
    transferRecords?: TransferRecord[];
    commentRecords?: CommentRecord[];
    engineerProfiles?: EngineerProfile[];
  }): void {
    this.tickets = [...data.tickets];
    this.slaRecords = data.slaRecords ? [...data.slaRecords] : [];
    this.dispatchResults = data.dispatchResults ? [...data.dispatchResults] : [];
    this.transferRecords = data.transferRecords ? [...data.transferRecords] : [];
    this.commentRecords = data.commentRecords ? [...data.commentRecords] : [];
    if (data.engineerProfiles) {
      this.setEngineerProfiles(data.engineerProfiles);
    }

    // Persist transfer and comment records to repository
    if (this.transferRecordRepository && data.transferRecords) {
      for (const record of data.transferRecords) {
        this.transferRecordRepository.create({
          id: record.id,
          ticketId: record.ticketId,
          fromEngineer: record.fromEngineer,
          toEngineer: record.toEngineer,
          reason: record.reason,
          transferredAt: record.transferredAt,
          holdTimeMs: record.holdTimeMs ?? null,
        }).catch(() => {/* ignore */});
      }
    }
    if (this.commentRecordRepository && data.commentRecords) {
      for (const record of data.commentRecords) {
        this.commentRecordRepository.create({
          id: record.id,
          ticketId: record.ticketId,
          authorId: record.authorId,
          createdAt: record.createdAt,
        }).catch(() => {/* ignore */});
      }
    }
  }

  // ==================== Dashboard Builders ====================

  /**
   * Get executive dashboard (boss view)
   */
  getExecutiveDashboard(options?: DashboardOptions): ExecutiveDashboard {
    return buildExecutiveDashboard(this.toContext(), options);
  }

  /**
   * Get manager dashboard (team view)
   */
  getManagerDashboard(options?: DashboardOptions): ManagerDashboard {
    return buildManagerDashboard(this.toContext(), options);
  }

  /**
   * Get engineer personal dashboard
   */
  getEngineerDashboard(
    engineerId: string,
    options?: DashboardOptions
  ): EngineerDashboard | null {
    return buildEngineerDashboard(engineerId, this.toContext(), options);
  }

  // ==================== Efficiency Metrics ====================

  /**
   * Get efficiency metrics for a specific engineer
   */
  getEngineerEfficiency(
    engineerId: string,
    granularity: TimeGranularity = 'day',
    start?: Date,
    end?: Date
  ): ReturnType<typeof computeEngineerEfficiency> {
    return computeEngineerEfficiency({
      engineerId,
      context: this.toContext(),
      granularity,
      start,
      end,
    });
  }

  /**
   * Get efficiency score with 4-dimensional breakdown
   * - Workload: 25%
   * - Efficiency: 30%
   * - Quality: 30%
   * - Teamwork: 15%
   */
  getEfficiencyScore(
    engineerId: string,
    start?: Date,
    end?: Date
  ): EfficiencyScore {
    const result = computeEfficiencyScore(
      engineerId,
      start || getDefaultStart(),
      end || new Date(),
      this.toContext()
    );
    return {
      score: result.score,
      breakdown: result.breakdown,
    };
  }

  // ==================== Analytics ====================

  /**
   * Compare current period vs previous period
   */
  comparePeriods(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): PeriodComparison {
    return comparePeriods({
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      context: this.toContext(),
    });
  }

  /**
   * Export data for external BI tools
   */
  exportBIData(options: {
    dataset: 'tickets' | 'sla' | 'dispatch' | 'efficiency';
    granularity?: TimeGranularity;
    periodStart?: Date;
    periodEnd?: Date;
  }): BIExportData {
    return exportBIData(this.toContext(), options);
  }

  /**
   * Get time series trend data
   */
  getTimeTrend(options?: {
    metric?: 'volume' | 'resolution' | 'sla' | 'load';
    start?: Date;
    end?: Date;
    granularity?: TimeGranularity;
  }): { period: string; value: number; details?: Record<string, number> }[] {
    return computeTimeTrend(this.toContext(), options);
  }

  // ==================== Internal: Data Context ====================

  /** Convert internal state to BIDataContext for computation modules */
  private toContext(): BIDataContext {
    return {
      tickets: this.tickets,
      slaRecords: this.slaRecords,
      dispatchResults: this.dispatchResults,
      transferRecords: this.transferRecords,
      commentRecords: this.commentRecords,
      engineerProfiles: this.engineerProfiles,
    };
  }

  // ==================== Clear ====================

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.tickets = [];
    this.slaRecords = [];
    this.dispatchResults = [];
    this.transferRecords = [];
    this.commentRecords = [];
    this.engineerProfiles.clear();
  }
}
