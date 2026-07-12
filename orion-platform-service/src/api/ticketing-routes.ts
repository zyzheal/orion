/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/ticketing/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

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
import { TicketDispatchController } from './controllers/ticketing/TicketDispatchController';
import { TicketingBIController } from './controllers/ticketing/TicketingBIController';
import { SLAController } from './controllers/ticketing/SLAController';
import { AutomationRuleController } from './controllers/ticketing/AutomationRuleController';
import { TicketService } from '../services/ticketing/TicketService';
import { TicketingService } from '../services/ticketing/TicketingService';
import { TicketingRepository } from '../services/ticketing/TicketingRepository';
import { SlaService } from '../services/ticketing/SlaService';
import { SlaRepository } from '../repositories/SlaRepository';
import { AutomationRuleService } from '../services/ticketing/AutomationRuleService';
import { AutomationRuleRepository } from '../repositories/AutomationRuleRepository';

export default async function ticketingRoutes(app: FastifyInstance): Promise<void> {
  // Initialize services with real db connection from Fastify instance
  const db = (app as any).db;
  const ticketingRepo = new TicketingRepository(db);
  const ticketingService = new TicketingService(ticketingRepo);
  const ticketService = new TicketService(undefined, ticketingRepo);
  const controller = new TicketingController(ticketService, ticketingService);
  const dispatchController = new TicketDispatchController(ticketService);
  const biController = new TicketingBIController(ticketService);

  // Initialize SLA and Automation services
  const slaRepo = new SlaRepository(db);
  const slaService = new SlaService(slaRepo);
  const slaController = new SLAController(slaService);

  const automationRuleRepo = new AutomationRuleRepository(db);
  const automationRuleService = new AutomationRuleService(automationRuleRepo);
  const automationRuleController = new AutomationRuleController(automationRuleService);

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
    return dispatchController.registerEngineer(request, reply);
  });

  app.get('/tickets/dispatch/engineers', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.listEngineers(request, reply);
  });

  app.get('/tickets/dispatch/engineers/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getEngineer(request, reply);
  });

  app.post('/tickets/dispatch/auto/:ticketId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.autoDispatch(request, reply);
  });

  app.post('/tickets/dispatch/manual/:ticketId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.manualDispatch(request, reply);
  });

  app.get('/tickets/dispatch/best-match/:ticketId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getBestMatch(request, reply);
  });

  app.post('/tickets/dispatch/score', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.calculateDispatchScore(request, reply);
  });

  app.get('/tickets/dispatch/queue/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getDispatchQueueStatus(request, reply);
  });

  app.get('/tickets/dispatch/queue/entries', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getDispatchQueueEntries(request, reply);
  });

  app.get('/tickets/dispatch/sla-alerts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getSLAAlerts(request, reply);
  });

  app.post('/tickets/dispatch/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.addDispatchRule(request, reply);
  });

  app.get('/tickets/dispatch/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getDispatchRules(request, reply);
  });

  app.get('/tickets/dispatch/load-balance/report', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getLoadBalanceReport(request, reply);
  });

  app.get('/tickets/dispatch/load-balance/suggestions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getReassignmentSuggestions(request, reply);
  });

  app.get('/tickets/dispatch/reports/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getDispatchMetrics(request, reply);
  });

  app.get('/tickets/dispatch/reports/assignment-success', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getAssignmentSuccessMetrics(request, reply);
  });

  app.get('/tickets/dispatch/reports/time-to-assignment', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getTimeToAssignmentStats(request, reply);
  });

  app.get('/tickets/dispatch/reports/performance/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getEngineerPerformance(request, reply);
  });

  app.get('/tickets/dispatch/reports/performance', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getAllEngineerPerformances(request, reply);
  });

  app.put('/tickets/dispatch/weights', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.updateDispatchWeights(request, reply);
  });

  app.get('/tickets/dispatch/weights', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return dispatchController.getDispatchWeights(request, reply);
  });

  // ==================== Transfer ====================

  app.post('/tickets/transfer/:ticketId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.transferTicket(request, reply);
  });

  app.get('/tickets/transfer/:ticketId/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getTransferHistory(request, reply);
  });

  app.get('/tickets/transfer/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getTransferStats(request, reply);
  });

  // ==================== Suspend ====================

  app.post('/tickets/suspend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.createSuspend(request, reply);
  });

  app.post('/tickets/suspend/:id/activate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.activateSuspend(request, reply);
  });

  app.post('/tickets/suspend/:id/end', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.endSuspend(request, reply);
  });

  app.post('/tickets/suspend/:id/cancel', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.cancelSuspend(request, reply);
  });

  app.get('/tickets/suspend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.listSuspensions(request, reply);
  });

  app.get('/tickets/suspend/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getSuspend(request, reply);
  });

  app.get('/tickets/suspend/engineer/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getEngineerSuspensions(request, reply);
  });

  app.get('/tickets/suspend/engineer/:engineerId/impact', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getEngineerSuspendImpact(request, reply);
  });

  // ==================== BI Analytics ====================

  app.get('/tickets/bi/dashboard/executive', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getExecutiveDashboard(request, reply);
  });

  app.get('/tickets/bi/dashboard/manager', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getManagerDashboard(request, reply);
  });

  app.get('/tickets/bi/dashboard/engineer/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getEngineerDashboard(request, reply);
  });

  app.get('/tickets/bi/efficiency/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getEngineerEfficiency(request, reply);
  });

  app.get('/tickets/bi/score/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getEfficiencyScore(request, reply);
  });

  app.get('/tickets/bi/compare', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.comparePeriods(request, reply);
  });

  app.post('/tickets/bi/export', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.exportBIData(request, reply);
  });

  app.get('/tickets/bi/trend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return biController.getTimeTrend(request, reply);
  });

  // ==================== SLA Policies ====================

  app.post('/ticketing/sla/policies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return slaController.createPolicy(request, reply);
  });

  app.get('/ticketing/sla/policies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return slaController.listPolicies(request, reply);
  });

  app.get('/ticketing/sla/policies/:policyId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return slaController.getPolicy(request, reply);
  });

  app.put('/ticketing/sla/policies/:policyId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return slaController.updatePolicy(request, reply);
  });

  app.delete('/ticketing/sla/policies/:policyId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return slaController.deletePolicy(request, reply);
  });

  // ==================== SLA Tracking ====================

  app.get('/ticketing/sla/tickets/:ticketId/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return slaController.getTicketSLAStatus(request, reply);
  });

  app.get('/ticketing/sla/breaches', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return slaController.getBreaches(request, reply);
  });

  app.get('/ticketing/sla/compliance/:policyId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return slaController.getCompliance(request, reply);
  });

  // ==================== Automation Rules ====================

  app.post('/ticketing/automation/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return automationRuleController.createRule(request, reply);
  });

  app.get('/ticketing/automation/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return automationRuleController.listRules(request, reply);
  });

  app.put('/ticketing/automation/rules/:ruleId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return automationRuleController.updateRule(request, reply);
  });

  app.delete('/ticketing/automation/rules/:ruleId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return automationRuleController.deleteRule(request, reply);
  });

  app.post('/ticketing/automation/rules/:ruleId/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticketing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return automationRuleController.executeRule(request, reply);
  });
}