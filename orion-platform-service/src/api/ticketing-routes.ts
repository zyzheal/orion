/**
 * TASK-801: Smart Ticketing API Routes
 *
 * Provides endpoints for ticket CRUD, workflow management,
 * assignment, relations, SLA-tracking, and reporting.
 * Registered under /api/v1/tickets prefix.
 *
 * P0-5 Fix: Changed all hardcoded `/tickets/` paths to relative paths
 * to avoid double prefix issue (/tickets/tickets).
 *
 * Migrated to PostgreSQL Repository pattern:
 * - Core ticket CRUD uses TicketingRepository + TicketingService
 * - Advanced features (workflow, dispatch, BI) still use TicketService (Map-based)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { TicketingController } from './controllers/ticketing/TicketingController';
import { TicketingRepository } from '../services/ticketing/TicketingRepository';
import { TicketingService } from '../services/ticketing/TicketingService';
import { TicketService } from '../services/ticketing/TicketService';

interface TicketingRoutesOptions {
  database?: DatabasePool;
}

export default async function ticketingRoutes(
  app: FastifyInstance,
  options: TicketingRoutesOptions
): Promise<void> {
  if (!options.database) {
    throw new Error('Ticketing routes require a database connection');
  }

  // Initialize Repository and Service with database pool
  const repository = new TicketingRepository(options.database);
  const ticketingService = new TicketingService(repository);

  // Initialize controller with both services
  // - TicketService (PostgreSQL-backed via TicketingRepository)
  // - TicketingService (PostgreSQL-backed, for core CRUD)
  const controller = new TicketingController(
    new TicketService({}, repository),
    ticketingService
  );

  // ==================== Service Control ====================

  // POST /start - Start ticketing service
  app.post('/start', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.startService(request, reply);
  });

  // POST /stop - Stop ticketing service
  app.post('/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.stopService(request, reply);
  });

  // GET /health - Health check
  app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.healthCheck(request, reply);
  });

  // ==================== Ticket CRUD ====================

  // POST / - Create a ticket
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTicket(request, reply);
  });

  // POST /from-alert - Create ticket from alert
  app.post('/from-alert', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTicketFromAlert(request, reply);
  });

  // POST /from-incident - Create ticket from incident
  app.post('/from-incident', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTicketFromIncident(request, reply);
  });

  // GET / - List tickets
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listTickets(request, reply);
  });

  // GET /:id - Get a ticket
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTicket(request, reply);
  });

  // ==================== Workflow ====================

  // POST /:id/transition - Transition ticket status
  app.post('/:id/transition', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.transitionStatus(request, reply);
  });

  // POST /:id/assign - Assign a ticket
  app.post('/:id/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.assignTicket(request, reply);
  });

  // POST /:id/escalate - Escalate a ticket
  app.post('/:id/escalate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.escalateTicket(request, reply);
  });

  // POST /:id/resolve - Resolve a ticket
  app.post('/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.resolveTicket(request, reply);
  });

  // POST /:id/close - Close a ticket
  app.post('/:id/close', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.closeTicket(request, reply);
  });

  // GET /:id/history - Get workflow history
  app.get('/:id/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getWorkflowHistory(request, reply);
  });

  // ==================== Assignment Rules ====================

  // POST /rules - Add assignment rule
  app.post('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addAssignmentRule(request, reply);
  });

  // GET /rules - Get assignment rules
  app.get('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAssignmentRules(request, reply);
  });

  // DELETE /rules/:id - Remove assignment rule
  app.delete('/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.removeAssignmentRule(request, reply);
  });

  // ==================== Relations ====================

  // POST /:id/relations - Add ticket relation
  app.post('/:id/relations', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addRelation(request, reply);
  });

  // GET /:id/relations - Get relations for a ticket
  app.get('/:id/relations', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRelations(request, reply);
  });

  // GET /:id/related - Find related tickets
  app.get('/:id/related', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.findRelatedTickets(request, reply);
  });

  // GET /:id/duplicates - Detect duplicates
  app.get('/:id/duplicates', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.detectDuplicates(request, reply);
  });

  // POST /correlate - Correlate root cause
  app.post('/correlate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.correlateRootCause(request, reply);
  });

  // ==================== SLA ====================

  // POST /sla - Add SLA target
  app.post('/sla', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addSLATarget(request, reply);
  });

  // GET /:id/sla - Get SLA for a ticket
  app.get('/:id/sla', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTicketSLA(request, reply);
  });

  // ==================== Reports ====================

  // GET /reports/sla - SLA compliance report
  app.get('/reports/sla', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSLACompliance(request, reply);
  });

  // GET /reports/resolution - Resolution time statistics
  app.get('/reports/resolution', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getResolutionStats(request, reply);
  });

  // GET /reports/backlog - Backlog analysis
  app.get('/reports/backlog', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBacklogAnalysis(request, reply);
  });

  // GET /reports/trends - Trend report
  app.get('/reports/trends', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTrendReport(request, reply);
  });

  // GET /reports/statistics - Overall statistics
  app.get('/reports/statistics', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStatistics(request, reply);
  });

  // ==================== TASK-802: Dispatch Endpoints ====================

  // POST /dispatch/engineers - Register engineer
  app.post('/dispatch/engineers', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerEngineer(request, reply);
  });

  // GET /dispatch/engineers - List engineers
  app.get('/dispatch/engineers', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listEngineers(request, reply);
  });

  // GET /dispatch/engineers/:id - Get engineer
  app.get('/dispatch/engineers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineer(request, reply);
  });

  // POST /dispatch/auto/:ticketId - Auto-dispatch
  app.post('/dispatch/auto/:ticketId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.autoDispatch(request, reply);
  });

  // POST /dispatch/manual/:ticketId - Manual dispatch
  app.post('/dispatch/manual/:ticketId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.manualDispatch(request, reply);
  });

  // GET /dispatch/best-match/:ticketId - Find best engineer
  app.get('/dispatch/best-match/:ticketId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.findBestMatch(request, reply);
  });

  // POST /dispatch/score - Calculate dispatch score
  app.post('/dispatch/score', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.calculateDispatchScore(request, reply);
  });

  // GET /dispatch/queue/status - Queue status
  app.get('/dispatch/queue/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchQueueStatus(request, reply);
  });

  // GET /dispatch/queue/entries - Queue entries
  app.get('/dispatch/queue/entries', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchQueueEntries(request, reply);
  });

  // GET /dispatch/sla-alerts - SLA alerts
  app.get('/dispatch/sla-alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSLAAlerts(request, reply);
  });

  // POST /dispatch/rules - Add dispatch rule
  app.post('/dispatch/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addDispatchRule(request, reply);
  });

  // GET /dispatch/rules - Get dispatch rules
  app.get('/dispatch/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchRules(request, reply);
  });

  // GET /dispatch/load-balance/report - Load balance report
  app.get('/dispatch/load-balance/report', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getLoadBalanceReport(request, reply);
  });

  // GET /dispatch/load-balance/suggestions - Reassignment suggestions
  app.get('/dispatch/load-balance/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReassignmentSuggestions(request, reply);
  });

  // GET /dispatch/reports/metrics - Dispatch metrics
  app.get('/dispatch/reports/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchMetrics(request, reply);
  });

  // GET /dispatch/reports/assignment-success - Assignment success
  app.get('/dispatch/reports/assignment-success', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAssignmentSuccessMetrics(request, reply);
  });

  // GET /dispatch/reports/time-to-assignment - Time to assignment
  app.get('/dispatch/reports/time-to-assignment', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTimeToAssignmentStats(request, reply);
  });

  // GET /dispatch/reports/performance - All performances
  app.get('/dispatch/reports/performance', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAllEngineerPerformances(request, reply);
  });

  // GET /dispatch/reports/performance/:engineerId - Engineer performance
  app.get('/dispatch/reports/performance/:engineerId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerPerformance(request, reply);
  });

  // PUT /dispatch/weights - Update dispatch weights
  app.put('/dispatch/weights', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateDispatchWeights(request, reply);
  });

  // GET /dispatch/weights - Get dispatch weights
  app.get('/dispatch/weights', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDispatchWeights(request, reply);
  });

  // ==================== TASK-TICKET-XFER: Transfer Endpoints ====================

  // POST /transfer/:ticketId - Transfer a ticket
  app.post('/transfer/:ticketId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.transferTicket(request, reply);
  });

  // GET /transfer/:ticketId/history - Get transfer history
  app.get('/transfer/:ticketId/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTransferHistory(request, reply);
  });

  // GET /transfer/stats - Get transfer statistics
  app.get('/transfer/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTransferStats(request, reply);
  });

  // ==================== TASK-TICKET-XFER: Suspend Endpoints ====================

  // POST /suspend - Create a suspension
  app.post('/suspend', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createSuspend(request, reply);
  });

  // POST /suspend/:id/activate - Activate a suspension
  app.post('/suspend/:id/activate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.activateSuspend(request, reply);
  });

  // POST /suspend/:id/end - End a suspension
  app.post('/suspend/:id/end', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.endSuspend(request, reply);
  });

  // POST /suspend/:id/cancel - Cancel a suspension
  app.post('/suspend/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.cancelSuspend(request, reply);
  });

  // GET /suspend - List suspensions
  app.get('/suspend', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listSuspensions(request, reply);
  });

  // GET /suspend/:id - Get suspension by ID
  app.get('/suspend/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSuspend(request, reply);
  });

  // GET /suspend/engineer/:engineerId - Get suspensions for an engineer
  app.get('/suspend/engineer/:engineerId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerSuspensions(request, reply);
  });

  // GET /suspend/engineer/:engineerId/impact - Get suspension impact
  app.get('/suspend/engineer/:engineerId/impact', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerSuspendImpact(request, reply);
  });

  // ==================== TASK-TICKET-BI: BI Analytics Endpoints ====================

  // GET /bi/dashboard/executive - Executive dashboard
  app.get('/bi/dashboard/executive', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getExecutiveDashboard(request, reply);
  });

  // GET /bi/dashboard/manager - Manager dashboard
  app.get('/bi/dashboard/manager', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getManagerDashboard(request, reply);
  });

  // GET /bi/dashboard/engineer/:engineerId - Engineer dashboard
  app.get('/bi/dashboard/engineer/:engineerId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerDashboard(request, reply);
  });

  // GET /bi/efficiency/:engineerId - Engineer efficiency metrics
  app.get('/bi/efficiency/:engineerId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEngineerEfficiency(request, reply);
  });

  // GET /bi/score/:engineerId - Engineer efficiency score
  app.get('/bi/score/:engineerId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEfficiencyScore(request, reply);
  });

  // GET /bi/compare - Compare periods
  app.get('/bi/compare', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.comparePeriods(request, reply);
  });

  // POST /bi/export - Export BI data
  app.post('/bi/export', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.exportBIData(request, reply);
  });

  // GET /bi/trend - Time trend
  app.get('/bi/trend', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTimeTrend(request, reply);
  });
}
