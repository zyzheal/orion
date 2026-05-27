/**
 * TASK-801: Smart Ticketing API Routes
 *
 * Routes under /api/v1/ticketing and /api/v1/tickets
 * Handles ticket CRUD, workflow management, assignment, relations, dispatch, and reporting
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { TicketingController } from './controllers/ticketing/TicketingController';
import { TicketService } from '../services/ticketing/TicketService';
import { TicketingService } from '../services/ticketing/TicketingService';
import { TicketingRepository } from '../services/ticketing/TicketingRepository';

export default async function ticketingRoutes(app: FastifyInstance): Promise<void> {
  // Initialize services and controller
  const ticketService = new TicketService();
  const mockDb = {} as any;
  const ticketingRepo = new TicketingRepository(mockDb);
  const ticketingService = new TicketingService(ticketingRepo);
  const controller = new TicketingController(ticketService, ticketingService);

  // ==================== Service Control ====================

  app.post('/ticketing/start', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.startService(request, reply);
  });

  app.post('/ticketing/stop', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.stopService(request, reply);
  });

  app.get('/ticketing/health', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.healthCheck(request, reply);
  });

  // ==================== Ticket CRUD ====================

  app.post('/tickets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTicket(request, reply);
  });

  app.post('/tickets/from-alert', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTicketFromAlert(request, reply);
  });

  app.post('/tickets/from-incident', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTicketFromIncident(request, reply);
  });

  app.get('/tickets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTicket(request, reply);
  });

  app.get('/tickets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listTickets(request, reply);
  });

  // ==================== Workflow ====================

  app.post('/tickets/:id/transition', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.transitionStatus(request, reply);
  });

  app.post('/tickets/:id/assign', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.assignTicket(request, reply);
  });

  app.post('/tickets/:id/escalate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.escalateTicket(request, reply);
  });

  app.post('/tickets/:id/resolve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.resolveTicket(request, reply);
  });

  app.post('/tickets/:id/close', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.closeTicket(request, reply);
  });

  app.get('/tickets/:id/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getWorkflowHistory(request, reply);
  });

  // ==================== Assignment Rules ====================

  app.post('/ticketing/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addAssignmentRule(request, reply);
  });

  app.get('/ticketing/rules', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAssignmentRules(request, reply);
  });

  app.delete('/ticketing/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.removeAssignmentRule(request, reply);
  });

  // ==================== Relations ====================

  app.post('/tickets/:id/relations', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addRelation(request, reply);
  });

  app.get('/tickets/:id/relations', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRelations(request, reply);
  });

  app.get('/tickets/:id/related', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.findRelatedTickets(request, reply);
  });

  app.get('/tickets/:id/duplicates', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.detectDuplicates(request, reply);
  });

  app.post('/tickets/correlate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.correlateRootCause(request, reply);
  });

  // ==================== SLA ====================

  app.post('/ticketing/sla', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addSLATarget(request, reply);
  });

  app.get('/tickets/:id/sla', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTicketSLA(request, reply);
  });

  // ==================== Reports ====================

  app.get('/tickets/reports/sla', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSLACompliance(request, reply);
  });

  app.get('/tickets/reports/resolution', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getResolutionStats(request, reply);
  });

  app.get('/tickets/reports/backlog', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBacklogAnalysis(request, reply);
  });

  app.get('/tickets/reports/trends', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTrendReport(request, reply);
  });

  app.get('/tickets/reports/statistics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStatistics(request, reply);
  });

  // ==================== Dispatch ====================

  app.post('/tickets/dispatch/engineers', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerEngineer(request, reply);
  });

  app.get('/tickets/dispatch/engineers', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listEngineers(request, reply);
  });

  app.get('/tickets/dispatch/engineers/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineer(request, reply);
  });

  app.post('/tickets/dispatch/auto/:ticketId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.autoDispatch(request, reply);
  });

  app.post('/tickets/dispatch/manual/:ticketId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.manualDispatch(request, reply);
  });

  app.get('/tickets/dispatch/best-match/:ticketId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.findBestMatch(request, reply);
  });

  app.post('/tickets/dispatch/score', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.calculateDispatchScore(request, reply);
  });

  app.get('/tickets/dispatch/queue/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchQueueStatus(request, reply);
  });

  app.get('/tickets/dispatch/queue/entries', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchQueueEntries(request, reply);
  });

  app.get('/tickets/dispatch/sla-alerts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSLAAlerts(request, reply);
  });

  app.post('/tickets/dispatch/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addDispatchRule(request, reply);
  });

  app.get('/tickets/dispatch/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchRules(request, reply);
  });

  app.get('/tickets/dispatch/load-balance/report', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getLoadBalanceReport(request, reply);
  });

  app.get('/tickets/dispatch/load-balance/suggestions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReassignmentSuggestions(request, reply);
  });

  app.get('/tickets/dispatch/reports/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchMetrics(request, reply);
  });

  app.get('/tickets/dispatch/reports/assignment-success', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAssignmentSuccessMetrics(request, reply);
  });

  app.get('/tickets/dispatch/reports/time-to-assignment', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTimeToAssignmentStats(request, reply);
  });

  app.get('/tickets/dispatch/reports/performance/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerPerformance(request, reply);
  });

  app.get('/tickets/dispatch/reports/performance', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAllEngineerPerformances(request, reply);
  });

  app.put('/tickets/dispatch/weights', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateDispatchWeights(request, reply);
  });

  app.get('/tickets/dispatch/weights', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchWeights(request, reply);
  });

  // ==================== Transfer ====================

  app.post('/tickets/transfer/:ticketId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.transferTicket(request, reply);
  });

  app.get('/tickets/transfer/:ticketId/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTransferHistory(request, reply);
  });

  app.get('/tickets/transfer/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTransferStats(request, reply);
  });

  // ==================== Suspend ====================

  app.post('/tickets/suspend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createSuspend(request, reply);
  });

  app.post('/tickets/suspend/:id/activate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.activateSuspend(request, reply);
  });

  app.post('/tickets/suspend/:id/end', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.endSuspend(request, reply);
  });

  app.post('/tickets/suspend/:id/cancel', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.cancelSuspend(request, reply);
  });

  app.get('/tickets/suspend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listSuspensions(request, reply);
  });

  app.get('/tickets/suspend/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSuspend(request, reply);
  });

  app.get('/tickets/suspend/engineer/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerSuspensions(request, reply);
  });

  app.get('/tickets/suspend/engineer/:engineerId/impact', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerSuspendImpact(request, reply);
  });

  // ==================== BI Analytics ====================

  app.get('/tickets/bi/dashboard/executive', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getExecutiveDashboard(request, reply);
  });

  app.get('/tickets/bi/dashboard/manager', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getManagerDashboard(request, reply);
  });

  app.get('/tickets/bi/dashboard/engineer/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerDashboard(request, reply);
  });

  app.get('/tickets/bi/efficiency/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerEfficiency(request, reply);
  });

  app.get('/tickets/bi/score/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEfficiencyScore(request, reply);
  });

  app.get('/tickets/bi/compare', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.comparePeriods(request, reply);
  });

  app.post('/tickets/bi/export', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.exportBIData(request, reply);
  });

  app.get('/tickets/bi/trend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTimeTrend(request, reply);
  });
}
