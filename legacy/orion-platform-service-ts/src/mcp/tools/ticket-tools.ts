/**
 * Ticket Tools - MCP Tools for Ticket Operations
 *
 * Enables AI assistants to create and manage tickets/issues.
 */

import { McpTool, McpContext, McpToolResult } from '../mcp-config';

/**
 * Tool: ticket_create
 * Create a new ticket/issue
 */
export const ticketCreateTool: McpTool = {
  name: 'ticket_create',
  description: 'Create a new ticket or issue in the system. Tickets can be bugs, feature requests, or incidents.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title/summary of the ticket',
      },
      description: {
        type: 'string',
        description: 'Detailed description of the issue or request',
      },
      type: {
        type: 'string',
        description: 'Type of ticket',
        enum: ['bug', 'feature', 'incident', 'task'],
      },
      priority: {
        type: 'string',
        description: 'Priority level',
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
      },
      project_id: {
        type: 'string',
        description: 'Associated project ID',
      },
      assignee: {
        type: 'string',
        description: 'User ID to assign the ticket to',
      },
      labels: {
        type: 'array',
        description: 'Labels/tags for categorization',
        items: { type: 'string' },
      },
    },
    required: ['title', 'type'],
  },
  handler: async (params: Record<string, unknown>, context: McpContext): Promise<McpToolResult> => {
    const title = params.title as string;
    const description = params.description as string | undefined;
    const type = params.type as string;
    const priority = (params.priority as string) || 'medium';
    const projectId = params.project_id as string | undefined;
    const assignee = params.assignee as string | undefined;
    const labels = params.labels as string[] | undefined;

    // Note: Actual implementation would use TicketingService
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ticket_id: ticketId,
          title,
          description,
          type,
          priority,
          status: 'open',
          project_id: projectId,
          assignee,
          labels: labels || [],
          created_by: context.userId || 'mcp-client',
          created_at: new Date().toISOString(),
          url: `/tickets/${ticketId}`,
        }, null, 2),
      }],
    };
  },
};

/**
 * Tool: ticket_list
 * Query ticket list
 */
export const ticketListTool: McpTool = {
  name: 'ticket_list',
  description: 'Query the list of tickets with optional filters.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status',
        enum: ['open', 'in_progress', 'resolved', 'closed'],
      },
      type: {
        type: 'string',
        description: 'Filter by type',
        enum: ['bug', 'feature', 'incident', 'task'],
      },
      priority: {
        type: 'string',
        description: 'Filter by priority',
        enum: ['low', 'medium', 'high', 'critical'],
      },
      assignee: {
        type: 'string',
        description: 'Filter by assignee user ID',
      },
      project_id: {
        type: 'string',
        description: 'Filter by project ID',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 20)',
        default: 20,
      },
    },
  },
  handler: async (params: Record<string, unknown>, context: McpContext): Promise<McpToolResult> => {
    const status = params.status as string | undefined;
    const type = params.type as string | undefined;
    const priority = params.priority as string | undefined;
    const assignee = params.assignee as string | undefined;
    const projectId = params.project_id as string | undefined;
    const limit = (params.limit as number) || 20;

    // Note: Actual implementation would use TicketingRepository
    const tickets = [
      {
        id: 'TKT-ABC123',
        title: 'API latency spike in production',
        type: 'incident',
        priority: 'high',
        status: 'in_progress',
        assignee: 'sre-team',
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'TKT-DEF456',
        title: 'Add dark mode support',
        type: 'feature',
        priority: 'medium',
        status: 'open',
        assignee: null,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ].filter(t => {
      if (status && t.status !== status) return false;
      if (type && t.type !== type) return false;
      if (priority && t.priority !== priority) return false;
      if (assignee && t.assignee !== assignee) return false;
      return true;
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total: tickets.length,
          limit,
          tickets,
        }, null, 2),
      }],
    };
  },
};

/**
 * Tool: ticket_update
 * Update ticket status
 */
export const ticketUpdateTool: McpTool = {
  name: 'ticket_update',
  description: 'Update the status or details of a ticket.',
  inputSchema: {
    type: 'object',
    properties: {
      ticket_id: {
        type: 'string',
        description: 'The ID of the ticket to update',
      },
      status: {
        type: 'string',
        description: 'New status',
        enum: ['open', 'in_progress', 'resolved', 'closed'],
      },
      priority: {
        type: 'string',
        description: 'New priority',
        enum: ['low', 'medium', 'high', 'critical'],
      },
      comment: {
        type: 'string',
        description: 'Comment to add with the update',
      },
    },
    required: ['ticket_id'],
  },
  handler: async (params: Record<string, unknown>, context: McpContext): Promise<McpToolResult> => {
    const ticketId = params.ticket_id as string;
    const status = params.status as string | undefined;
    const priority = params.priority as string | undefined;
    const comment = params.comment as string | undefined;

    if (!status && !priority) {
      return {
        content: [{
          type: 'text',
          text: 'Error: At least one of status or priority must be provided',
        }],
        isError: true,
      };
    }

    // Note: Actual implementation would use TicketingRepository
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ticket_id: ticketId,
          status: status || 'unchanged',
          priority: priority || 'unchanged',
          updated_by: context.userId || 'mcp-client',
          updated_at: new Date().toISOString(),
          comment: comment ? { author: context.userId, text: comment, timestamp: new Date().toISOString() } : undefined,
        }, null, 2),
      }],
    };
  },
};

/**
 * Tool: ticket_assign
 * Assign ticket to a user
 */
export const ticketAssignTool: McpTool = {
  name: 'ticket_assign',
  description: 'Assign a ticket to a specific user or team.',
  inputSchema: {
    type: 'object',
    properties: {
      ticket_id: {
        type: 'string',
        description: 'The ID of the ticket to assign',
      },
      assignee: {
        type: 'string',
        description: 'User ID or team to assign the ticket to',
      },
      comment: {
        type: 'string',
        description: 'Optional comment with the assignment',
      },
    },
    required: ['ticket_id', 'assignee'],
  },
  handler: async (params: Record<string, unknown>, context: McpContext): Promise<McpToolResult> => {
    const ticketId = params.ticket_id as string;
    const assignee = params.assignee as string;
    const comment = params.comment as string | undefined;

    // Note: Actual implementation would use TicketingRepository
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ticket_id: ticketId,
          previous_assignee: null,
          new_assignee: assignee,
          assigned_by: context.userId || 'mcp-client',
          assigned_at: new Date().toISOString(),
          comment,
        }, null, 2),
      }],
    };
  },
};

/**
 * Export all ticket tools
 */
export const ticketTools: McpTool[] = [
  ticketCreateTool,
  ticketListTool,
  ticketUpdateTool,
  ticketAssignTool,
];