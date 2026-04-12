/**
 * TASK-801: Smart Ticketing API Routes
 *
 * Provides endpoints for ticket CRUD, workflow management,
 * assignment, relations, SLA tracking, and reporting.
 * Registered under /api/v1/tickets and /api/v1/ticketing prefixes.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TicketingController } from '../controllers/ticketing/TicketingController';

export default async function ticketingRoutes(app: FastifyInstance): Promise<void> {
  const controller = new TicketingController();

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

  // POST /tickets - Create a ticket
  app.post('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTicket(request, reply);
  });

  // POST /tickets/from-alert - Create ticket from alert
  app.post('/tickets/from-alert', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTicketFromAlert(request, reply);
  });

  // POST /tickets/from-incident - Create ticket from incident
  app.post('/tickets/from-incident', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createTicketFromIncident(request, reply);
  });

  // GET /tickets - List tickets
  app.get('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listTickets(request, reply);
  });

  // GET /tickets/:id - Get a ticket
  app.get('/tickets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTicket(request, reply);
  });

  // ==================== Workflow ====================

  // POST /tickets/:id/transition - Transition ticket status
  app.post('/tickets/:id/transition', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.transitionStatus(request, reply);
  });

  // POST /tickets/:id/assign - Assign a ticket
  app.post('/tickets/:id/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.assignTicket(request, reply);
  });

  // POST /tickets/:id/escalate - Escalate a ticket
  app.post('/tickets/:id/escalate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.escalateTicket(request, reply);
  });

  // POST /tickets/:id/resolve - Resolve a ticket
  app.post('/tickets/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.resolveTicket(request, reply);
  });

  // POST /tickets/:id/close - Close a ticket
  app.post('/tickets/:id/close', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.closeTicket(request, reply);
  });

  // GET /tickets/:id/history - Get workflow history
  app.get('/tickets/:id/history', async (request: FastifyRequest, reply: FastifyReply) => {
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

  // POST /tickets/:id/relations - Add ticket relation
  app.post('/tickets/:id/relations', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addRelation(request, reply);
  });

  // GET /tickets/:id/relations - Get relations for a ticket
  app.get('/tickets/:id/relations', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRelations(request, reply);
  });

  // GET /tickets/:id/related - Find related tickets
  app.get('/tickets/:id/related', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.findRelatedTickets(request, reply);
  });

  // GET /tickets/:id/duplicates - Detect duplicates
  app.get('/tickets/:id/duplicates', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.detectDuplicates(request, reply);
  });

  // POST /tickets/correlate - Correlate root cause
  app.post('/tickets/correlate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.correlateRootCause(request, reply);
  });

  // ==================== SLA ====================

  // POST /sla - Add SLA target
  app.post('/sla', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addSLATarget(request, reply);
  });

  // GET /tickets/:id/sla - Get SLA for a ticket
  app.get('/tickets/:id/sla', async (request: FastifyRequest, reply: FastifyReply) => {
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
}
