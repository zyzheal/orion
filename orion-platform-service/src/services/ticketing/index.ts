/**
 * Ticketing Module Exports
 *
 * TASK-801: Smart Ticketing
 */

// Types
export * from './types';

// Services
export { TicketGenerator } from './TicketGenerator';
export { TicketWorkflowService } from './TicketWorkflowService';
export { TicketRelationAnalyzer } from './TicketRelationAnalyzer';
export { TicketReportService } from './TicketReportService';
export { TicketService } from './TicketService';

// Event types
export type { TicketingEventType } from './TicketService';
