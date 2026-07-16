/**
 * Alert Types - Shared type definitions for alert services.
 */

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum AlertStatus {
  FIRING = 'firing',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
  ACKNOWLEDGED = 'acknowledged',
}

export enum AlertSourceType {
  PROMETHEUS = 'prometheus',
  GRAFANA = 'grafana',
  CUSTOM = 'custom',
  HEALTH_CHECK = 'health_check',
}

export interface Alert {
  id: string;
  fingerprint: string;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  sourceType: AlertSourceType;
  sourceId: string;
  sourceName: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  value: number;
  threshold: number;
  tenantId: string;
  startsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertTopologyNode {
  id: string;
  name: string;
  type: string;
  health: number;
  activeAlerts: Alert[];
}

export interface AlertTopologyEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface AlertTopologyGraph {
  nodes: AlertTopologyNode[];
  edges: AlertTopologyEdge[];
}
