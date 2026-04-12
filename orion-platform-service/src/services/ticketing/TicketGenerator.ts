/**
 * TASK-801: Smart Ticket Generator
 *
 * Generates tickets from monitoring alerts and incidents with
 * smart categorization and automatic priority assignment.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketSource,
  AlertTicketSource,
  IncidentTicketSource,
} from './types';

/**
 * Category keywords mapping for smart classification
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  infrastructure: ['cpu', 'memory', 'disk', 'node', 'host', 'server', 'vm', 'instance'],
  application: ['error', 'exception', 'crash', 'timeout', 'api', 'service', 'http', 'latency'],
  database: ['database', 'db', 'query', 'connection_pool', 'replication', 'slow_query', 'deadlock'],
  network: ['network', 'dns', 'connectivity', 'packet_loss', 'bandwidth', 'firewall', 'latency'],
  security: ['auth', 'unauthorized', 'forbidden', 'ssl', 'certificate', 'intrusion', 'vulnerability'],
  deployment: ['deploy', 'build', 'release', 'rollback', 'pipeline', 'artifact', 'container'],
  pipeline: ['pipeline', 'ci', 'cd', 'stage', 'task', 'runner', 'agent'],
  performance: ['slow', 'performance', 'throughput', 'iops', 'p99', 'p95', 'response_time'],
  cost: ['cost', 'budget', 'spending', 'usage', 'optimization'],
};

/**
 * Severity to priority mapping
 */
const SEVERITY_TO_PRIORITY: Record<string, TicketPriority> = {
  critical: 'critical',
  high: 'high',
  warning: 'medium',
  medium: 'medium',
  info: 'low',
  low: 'low',
};

/**
 * Smart Ticket Generator
 *
 * Creates tickets from alerts/incidents with:
 * - Smart categorization based on alert keywords
 * - Priority assignment based on severity and impact
 * - Automatic title and description generation
 */
export class TicketGenerator {
  /**
   * Generate a ticket from a monitoring alert
   */
  generateFromAlert(source: AlertTicketSource, reporter: string = 'system'): Ticket {
    const category = this.categorizeFromAlert(source);
    const priority = this.assignPriorityFromAlert(source);
    const title = this.generateTitleFromAlert(source);
    const description = this.generateDescriptionFromAlert(source);

    const now = new Date();

    const ticket: Ticket = {
      id: `TKT-${uuidv4()}`,
      title,
      description,
      category,
      priority,
      status: 'open',
      reporter,
      source: 'alert',
      sourceAlertId: source.alertId,
      createdAt: now,
      updatedAt: now,
      escalationLevel: 0,
      tags: source.tags || {},
      metadata: {
        metric: source.metric,
        ruleName: source.ruleName,
        triggeredAt: source.triggeredAt.toISOString(),
      },
    };

    return ticket;
  }

  /**
   * Generate a ticket from an incident
   */
  generateFromIncident(source: IncidentTicketSource): Ticket {
    const category = this.categorizeFromIncident(source);
    const priority = this.assignPriorityFromIncident(source);

    const now = new Date();

    const ticket: Ticket = {
      id: `TKT-${uuidv4()}`,
      title: source.title,
      description: source.description,
      category,
      priority,
      status: 'open',
      assignee: undefined,
      reporter: source.reporter,
      source: 'incident',
      sourceIncidentId: source.incidentId,
      createdAt: now,
      updatedAt: now,
      escalationLevel: 0,
      tags: source.tags || {},
      metadata: {
        affectedServices: source.affectedServices || [],
      },
    };

    return ticket;
  }

  /**
   * Smart categorization based on alert data
   */
  categorize(source: { metric?: string; tags?: Record<string, string>; message?: string }): TicketCategory {
    const text = this.extractTextForCategorization(source);
    return this.findBestCategory(text);
  }

  /**
   * Priority assignment based on severity and impact
   */
  assignPriority(
    severity: 'critical' | 'warning' | 'info' | 'high' | 'medium' | 'low',
    impactScore?: number
  ): TicketPriority {
    let priority = SEVERITY_TO_PRIORITY[severity] || 'medium';

    // Adjust priority based on impact score (0-100)
    if (impactScore !== undefined) {
      if (impactScore >= 80 && priority !== 'critical') {
        priority = 'critical';
      } else if (impactScore >= 60 && (priority === 'medium' || priority === 'low')) {
        priority = 'high';
      } else if (impactScore < 20 && (priority === 'high' || priority === 'critical')) {
        priority = priority === 'critical' ? 'high' : 'medium';
      }
    }

    return priority;
  }

  /**
   * Categorize based on alert source
   */
  private categorizeFromAlert(source: AlertTicketSource): TicketCategory {
    const text = this.extractTextForCategorization({
      metric: source.metric,
      tags: source.tags,
      message: source.message,
    });
    return this.findBestCategory(text);
  }

  /**
   * Categorize based on incident source
   */
  private categorizeFromIncident(source: IncidentTicketSource): TicketCategory {
    const parts: string[] = [];
    if (source.title) parts.push(source.title);
    if (source.description) parts.push(source.description);
    if (source.tags) {
      parts.push(Object.values(source.tags).join(' '));
    }
    if (source.affectedServices) {
      parts.push(source.affectedServices.join(' '));
    }
    const text = parts.join(' ').toLowerCase();
    return this.findBestCategory(text);
  }

  /**
   * Assign priority from alert
   */
  private assignPriorityFromAlert(source: AlertTicketSource): TicketPriority {
    // Calculate impact score from tags
    let impactScore: number | undefined;
    if (source.tags) {
      const tagValues = Object.values(source.tags);
      // Check for common impact indicators
      if (tagValues.some(v => v.includes('production') || v.includes('prod'))) {
        impactScore = 70;
      }
      if (tagValues.some(v => v.includes('critical') || v.includes('essential'))) {
        impactScore = Math.max(impactScore || 0, 85);
      }
    }

    return this.assignPriority(source.severity, impactScore);
  }

  /**
   * Assign priority from incident
   */
  private assignPriorityFromIncident(source: IncidentTicketSource): TicketPriority {
    // Incidents with more affected services get higher priority
    const serviceCount = source.affectedServices?.length || 0;
    let impactBoost = 0;
    if (serviceCount >= 5) impactBoost = 30;
    else if (serviceCount >= 3) impactBoost = 20;
    else if (serviceCount >= 1) impactBoost = 10;

    const basePriority = SEVERITY_TO_PRIORITY[source.severity] || 'medium';
    const priorityOrder: TicketPriority[] = ['low', 'medium', 'high', 'critical'];
    let index = priorityOrder.indexOf(basePriority);

    if (impactBoost >= 30 && index < priorityOrder.length - 1) {
      index = Math.min(index + 1, priorityOrder.length - 1);
    }

    return priorityOrder[index];
  }

  /**
   * Find the best matching category from text
   */
  private findBestCategory(text: string): TicketCategory {
    const scores: Record<string, number> = {};

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      scores[category] = score;
    }

    // Find category with highest score
    let bestCategory: TicketCategory = 'other';
    let bestScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category as TicketCategory;
      }
    }

    return bestCategory;
  }

  /**
   * Extract text for categorization from various fields
   */
  private extractTextForCategorization(source: {
    metric?: string;
    tags?: Record<string, string>;
    message?: string;
  }): string {
    const parts: string[] = [];
    if (source.metric) parts.push(source.metric);
    if (source.message) parts.push(source.message);
    if (source.tags) {
      parts.push(Object.entries(source.tags).map(([k, v]) => `${k} ${v}`).join(' '));
    }
    return parts.join(' ').toLowerCase();
  }

  /**
   * Generate a descriptive title from alert data
   */
  private generateTitleFromAlert(source: AlertTicketSource): string {
    const severityPrefix = source.severity.toUpperCase();
    const metric = source.metric || 'Unknown metric';
    const suffix = source.ruleName ? ` (${source.ruleName})` : '';

    return `[${severityPrefix}] ${metric}${suffix}`;
  }

  /**
   * Generate a detailed description from alert data
   */
  private generateDescriptionFromAlert(source: AlertTicketSource): string {
    const lines: string[] = [
      `Alert triggered for metric: ${source.metric || 'N/A'}`,
      `Severity: ${source.severity}`,
      `Message: ${source.message || 'No additional details'}`,
      `Triggered at: ${source.triggeredAt.toISOString()}`,
    ];

    if (source.ruleName) {
      lines.push(`Rule: ${source.ruleName}`);
    }

    if (source.tags && Object.keys(source.tags).length > 0) {
      lines.push('Tags:');
      for (const [key, value] of Object.entries(source.tags)) {
        lines.push(`  - ${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }
}
