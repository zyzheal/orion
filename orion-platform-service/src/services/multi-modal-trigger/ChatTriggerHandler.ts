/**
 * ChatTriggerHandler - Handles chat-based trigger registration and processing
 *
 * Parses chat commands and executes pipeline triggers from chat messages.
 * Reuses existing ChatOps infrastructure for notification and command routing.
 */

import { DatabasePool } from '../database';
import {
  TriggerRepository,
  TriggerEventRepository,
  TriggerEntity,
  TriggerEventEntity,
} from '../../repositories/Phase3Repository';
import { UnifiedTriggerService } from './UnifiedTriggerService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LChat-LTrigger-LHandler');

export interface ChatCommand {
  command: string;
  args: string[];
  options: Record<string, string>;
  raw: string;
}

export interface ChatMessage {
  userId: string;
  channel: string;
  content: string;
  timestamp: string;
  platform?: string; // slack, teams, discord, etc.
  threadId?: string;
}

export interface ChatTriggerResult {
  success: boolean;
  command?: ChatCommand;
  triggerId?: string;
  pipelineRunId?: string;
  response?: string;
  error?: string;
}

export class ChatTriggerHandler {
  private triggerRepo: TriggerRepository | null = null;
  private eventRepo: TriggerEventRepository | null = null;
  private triggerService: UnifiedTriggerService | null = null;

  constructor(db?: DatabasePool, triggerService?: UnifiedTriggerService) {
    if (db) {
      this.triggerRepo = new TriggerRepository(db);
      this.eventRepo = new TriggerEventRepository(db);
    }
    this.triggerService = triggerService || null;
  }

  // ==================== Command Parsing ====================

  parseChatCommand(message: string): ChatCommand {
    const trimmed = message.trim();

    // Check for command prefix (/)
    if (!trimmed.startsWith('/')) {
      return {
        command: '',
        args: [],
        options: {},
        raw: message,
      };
    }

    // Remove leading slash and split
    const content = trimmed.substring(1);
    const parts = content.split(/\s+/);
    const command = parts[0];
    const rest = parts.slice(1);

    // Parse args and options
    const args: string[] = [];
    const options: Record<string, string> = {};

    for (const part of rest) {
      const match = part.match(/^--?([\w-]+)=(.+)$/);
      if (match) {
        options[match[1]] = match[2];
      } else if (part.startsWith('-') || part.startsWith('--')) {
        const key = part.replace(/^-+/, '');
        options[key] = 'true';
      } else {
        args.push(part);
      }
    }

    return {
      command,
      args,
      options,
      raw: message,
    };
  }

  // ==================== Chat Trigger Execution ====================

  async executeFromChat(message: ChatMessage, channel?: string): Promise<ChatTriggerResult> {
    const parsed = this.parseChatCommand(message.content);

    if (!parsed.command) {
      // Not a command, just a regular message
      return {
        success: false,
        response: 'Message received but no command detected. Use /run <pipeline> to trigger.',
      };
    }

    // Handle different commands
    switch (parsed.command) {
      case 'run':
      case 'execute':
        return this.handleRunCommand(message, parsed);
      case 'status':
        return this.handleStatusCommand(message, parsed);
      case 'triggers':
        return this.handleListTriggersCommand(message, parsed);
      case 'help':
        return this.handleHelpCommand(message, parsed);
      default:
        // Check if there's a custom trigger with this command
        return this.handleCustomTrigger(message, parsed, channel);
    }
  }

  // ==================== Notification ====================

  async notifyChannel(channel: string, message: string, options?: {
    platform?: string;
    threadId?: string;
    attachments?: Record<string, any>[];
  }): Promise<{ success: boolean; messageId?: string }> {
    // In production, this would integrate with Slack API, Teams API, etc.
    // For now, log the notification
    const platform = options?.platform || 'unknown';

    logger.info(`[ChatTrigger] Notifying channel ${channel} on ${platform}: ${message}`);

    if (options?.attachments) {
      logger.info(`[ChatTrigger] Attachments: ${JSON.stringify(options.attachments)}`);
    }

    return {
      success: true,
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  async notifyChannelRich(channel: string, options: {
    platform?: string;
    title?: string;
    text?: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    color?: string;
    threadId?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const platform = options.platform || 'unknown';
    const title = options.title || 'Notification';
    const text = options.text || '';

    logger.info(`[ChatTrigger] Rich notification to ${channel} on ${platform}`);
    logger.info(`[ChatTrigger] Title: ${title}`);
    logger.info(`[ChatTrigger] Text: ${text}`);

    if (options.fields) {
      for (const field of options.fields) {
        logger.info(`[ChatTrigger]   ${field.name}: ${field.value}`);
      }
    }

    return {
      success: true,
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  // ==================== Internal Command Handlers ====================

  private async handleRunCommand(message: ChatMessage, parsed: ChatCommand): Promise<ChatTriggerResult> {
    if (parsed.args.length === 0) {
      return {
        success: false,
        command: parsed,
        response: 'Usage: /run <pipeline-name-or-id>',
      };
    }

    const pipelineId = parsed.args[0];

    // In production, this would look up the pipeline and trigger execution
    // For now, create a simulated run
    const pipelineRunId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Record the event
    if (this.eventRepo) {
      const eventId = `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await this.eventRepo.create({
        id: eventId,
        trigger_id: 'chat',
        tenant_id: 'default', // Would come from user context
        event_type: 'chat_command',
        event_payload: {
          command: 'run',
          pipelineId,
          user: message.userId,
          channel: message.channel,
          platform: message.platform,
        },
        evaluation_result: 'matched',
        pipeline_run_id: pipelineRunId,
      });
    }

    return {
      success: true,
      command: parsed,
      pipelineRunId,
      response: `Pipeline run initiated: ${pipelineRunId}`,
    };
  }

  private async handleStatusCommand(message: ChatMessage, parsed: ChatCommand): Promise<ChatTriggerResult> {
    const pipelineId = parsed.args[0] || parsed.options['pipeline'];

    if (!pipelineId) {
      return {
        success: false,
        command: parsed,
        response: 'Usage: /status --pipeline=<id>',
      };
    }

    // In production, look up pipeline status
    return {
      success: true,
      command: parsed,
      response: `Pipeline ${pipelineId}: status would be retrieved here`,
    };
  }

  private async handleListTriggersCommand(message: ChatMessage, parsed: ChatCommand): Promise<ChatTriggerResult> {
    if (!this.triggerRepo) {
      return {
        success: false,
        command: parsed,
        error: 'Database not configured',
      };
    }

    const tenantId = 'default'; // Would come from user context
    const triggers = await this.triggerRepo.findByTenant(tenantId);

    if (triggers.length === 0) {
      return {
        success: true,
        command: parsed,
        response: 'No triggers registered.',
      };
    }

    const triggerList = triggers
      .filter(t => t.type === 'chat' || t.type === 'manual')
      .map(t => `- ${t.name} (${t.type}) [${t.enabled ? 'enabled' : 'disabled'}]`)
      .join('\n');

    return {
      success: true,
      command: parsed,
      response: `Registered triggers:\n${triggerList}`,
    };
  }

  private async handleHelpCommand(message: ChatMessage, parsed: ChatCommand): Promise<ChatTriggerResult> {
    const helpText = `Available commands:
  /run <pipeline>     - Execute a pipeline
  /status --pipeline=<id> - Check pipeline status
  /triggers           - List available triggers
  /help               - Show this help message

Examples:
  /run build-and-deploy
  /status --pipeline=pipeline-123
  /run deploy --env=production`;

    return {
      success: true,
      command: parsed,
      response: helpText,
    };
  }

  private async handleCustomTrigger(message: ChatMessage, parsed: ChatCommand, channel?: string): Promise<ChatTriggerResult> {
    if (!this.triggerRepo) {
      return {
        success: false,
        command: parsed,
        error: 'Database not configured',
      };
    }

    const tenantId = 'default'; // Would come from user context

    // Look for chat triggers matching this command
    const chatTriggers = await this.triggerRepo.findByType(tenantId, 'chat');

    for (const trigger of chatTriggers) {
      const config = trigger.config || {};
      const chatCommands = config.chatCommands || [];

      if (chatCommands.includes(parsed.command)) {
        // Found a matching trigger, evaluate and execute
        const eventId = `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        if (this.eventRepo) {
          await this.eventRepo.create({
            id: eventId,
            trigger_id: trigger.id,
            tenant_id: tenantId,
            event_type: 'chat_command',
            event_payload: {
              command: parsed.command,
              args: parsed.args,
              options: parsed.options,
              user: message.userId,
              channel: message.channel,
            },
            evaluation_result: 'matched',
            pipeline_run_id: trigger.pipeline_id || null,
          });

          await this.triggerRepo.incrementTriggerCount(trigger.id);
        }

        return {
          success: true,
          command: parsed,
          triggerId: trigger.id,
          pipelineRunId: trigger.pipeline_id || undefined,
          response: `Trigger '${trigger.name}' activated`,
        };
      }
    }

    return {
      success: false,
      command: parsed,
      response: `Unknown command: ${parsed.command}. Use /help for available commands.`,
    };
  }
}
