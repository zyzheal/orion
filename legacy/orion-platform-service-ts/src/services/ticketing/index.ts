/**
 * Ticketing Module Exports
 *
 * TASK-801: Smart Ticketing
 * TASK-802: Auto Ticket Dispatch
 */

// Types
export * from './types';

// Database-backed services (NEW)
export { TicketingRepository, TicketRecord, TicketCommentRecord, CreateTicketInput, UpdateTicketInput } from './TicketingRepository';
export { TicketingService, TicketingServiceError } from './TicketingService';

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

// TASK-TICKET-XFER: Transfer and Suspend services
export { TicketTransferService } from './TicketTransferService';
export { EngineerSuspendService } from './EngineerSuspendService';

// TASK-TICKET-BI: BI Analytics services
export { TicketBIService } from './TicketBIService';
export type { TransferRecord, CommentRecord, DashboardOptions } from './TicketBIService';

// Event types
export type { TicketingEventType } from './TicketService';
