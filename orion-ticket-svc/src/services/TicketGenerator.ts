/**
 * TicketGenerator - generates tickets from alerts/incidents.
 */
import { Ticket, AlertTicketSource, IncidentTicketSource, TicketCategory, TicketPriority, TicketStatus } from '../types/ticketing';

/**
 * Map alert severity to ticket priority
 */
function mapSeverityToPriority(severity: string): TicketPriority {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'p0':
      return 'critical';
    case 'high':
    case 'p1':
      return 'high';
    case 'medium':
    case 'p2':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Map alert source to ticket category
 */
function mapAlertToCategory(alert: AlertTicketSource): TicketCategory {
  if (alert.alertRule?.includes?.('database') || alert.alertRule?.includes?.('db')) return 'database';
  if (alert.alertRule?.includes?.('network')) return 'network';
  if (alert.alertRule?.includes?.('security')) return 'security';
  if (alert.alertRule?.includes?.('deploy')) return 'deployment';
  if (alert.alertRule?.includes?.('pipeline')) return 'pipeline';
  if (alert.alertRule?.includes?.('perf') || alert.alertRule?.includes?.('latency')) return 'performance';
  if (alert.alertRule?.includes?.('cost')) return 'cost';
  return 'infrastructure';
}

export class TicketGenerator {
  generateFromAlert(source: AlertTicketSource): Ticket {
    const now = new Date();
    const priority = mapSeverityToPriority(source.severity || 'medium');
    const category = mapAlertToCategory(source);

    return {
      id: `TKT-ALERT-${crypto.randomUUID().slice(0, 8)}`,
      title: source.title || `Alert: ${source.alertRule || 'Unknown Rule'}`,
      description: source.description || `Auto-generated from alert rule: ${source.alertRule}`,
      category,
      priority,
      status: 'open',
      assignee: undefined,
      reporter: 'system',
      createdAt: now,
      updatedAt: now,
      dueDate: priority === 'critical' ? new Date(Date.now() + 4 * 3600_000) : undefined,
      source: 'alert',
      sourceAlertId: source.alertId,
      sourceIncidentId: undefined,
      tags: { source: 'alert', alertRule: source.alertRule || '' },
      metadata: {
        alertId: source.alertId,
        alertRule: source.alertRule,
        severity: source.severity,
        triggeredAt: source.triggeredAt,
      },
      escalationLevel: 0,
    };
  }

  generateFromIncident(source: IncidentTicketSource): Ticket {
    const now = new Date();
    const priority = mapSeverityToPriority(source.severity || 'high');

    return {
      id: `TKT-INC-${crypto.randomUUID().slice(0, 8)}`,
      title: source.title || `Incident: ${source.incidentId || 'Unknown'}`,
      description: source.description || `Auto-generated from incident: ${source.incidentId}`,
      category: source.category || 'infrastructure',
      priority,
      status: 'open',
      assignee: source.assignedTo,
      reporter: source.reporter || 'system',
      createdAt: now,
      updatedAt: now,
      dueDate: priority === 'critical' ? new Date(Date.now() + 2 * 3600_000) : new Date(Date.now() + 24 * 3600_000),
      source: 'incident',
      sourceAlertId: undefined,
      sourceIncidentId: source.incidentId,
      tags: { source: 'incident', incidentId: source.incidentId },
      metadata: {
        incidentId: source.incidentId,
        severity: source.severity,
        affectedServices: source.affectedServices,
        startedAt: source.startedAt,
      },
      escalationLevel: 0,
    };
  }
}
