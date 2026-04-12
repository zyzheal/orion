/**
 * Ticketing Module Exports
 *
 * TASK-801: Smart Ticketing
 * TASK-802: Auto Ticket Dispatch
 */

// Types
export * from './types';

// Services
export { TicketGenerator } from './TicketGenerator';
export { TicketWorkflowService } from './TicketWorkflowService';
export { TicketRelationAnalyzer } from './TicketRelationAnalyzer';
export { TicketReportService } from './TicketReportService';
export { TicketService } from './TicketService';

// TASK-802: Dispatch services
export { DispatchEngine } from './DispatchEngine';
export { DispatchQueueManager } from './DispatchQueueManager';
export { LoadBalancer } from './LoadBalancer';
export { DispatchAnalytics } from './DispatchAnalytics';

// Event types
export type { TicketingEventType } from './TicketService';
