import { ChannelConfigRepository, ChannelConfig, CreateChannelConfigInput, UpdateChannelConfigInput } from './ChannelConfigRepository';
import { ChannelMessageRepository, ChannelMessage, CreateChannelMessageInput } from './ChannelMessageRepository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ChannelIngressService');

export interface ParsedMessage {
  title?: string;
  body?: string;
  from?: string;
  priority?: string;
  messageId?: string;
}

export class ChannelIngressService {
  constructor(
    private channelRepo: ChannelConfigRepository,
    private messageRepo: ChannelMessageRepository
  ) {}

  // ---- Channel Config CRUD ----

  async listChannels(options?: {
    channelType?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: ChannelConfig[]; total: number }> {
    return this.channelRepo.findAll(options);
  }

  async getChannel(id: string): Promise<ChannelConfig> {
    const channel = await this.channelRepo.findById(id);
    if (!channel) {
      throw new OrionError(`Channel not found: ${id}`, 'NOT_FOUND');
    }
    return channel;
  }

  async createChannel(input: CreateChannelConfigInput, userId?: string): Promise<ChannelConfig> {
    return this.channelRepo.create({ ...input, created_by: userId });
  }

  async updateChannel(id: string, input: UpdateChannelConfigInput): Promise<ChannelConfig> {
    const existing = await this.channelRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Channel not found: ${id}`, 'NOT_FOUND');
    }
    const updated = await this.channelRepo.update(id, input);
    return updated!;
  }

  async deleteChannel(id: string): Promise<boolean> {
    const existing = await this.channelRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Channel not found: ${id}`, 'NOT_FOUND');
    }
    return this.channelRepo.delete(id);
  }

  // ---- Inbound Message Processing ----

  async processInbound(channelId: string, rawMessage: Record<string, unknown>): Promise<ChannelMessage> {
    const channel = await this.channelRepo.findById(channelId);
    if (!channel || !channel.enabled) {
      throw new OrionError('Channel not found or disabled', 'NOT_FOUND');
    }

    const tenantId = getCurrentTenantId();

    // Log the inbound message
    const message = await this.messageRepo.create({
      channel_id: channelId,
      direction: 'inbound',
      message_type: (rawMessage.messageType as string) || 'text',
      from_address: (rawMessage.from as string) || undefined,
      to_address: (rawMessage.to as string) || undefined,
      subject: (rawMessage.subject as string) || undefined,
      body: (rawMessage.body as string) || JSON.stringify(rawMessage),
      metadata: rawMessage as Record<string, unknown>,
      status: 'received',
    });

    logger.info(
      { tenantId, channelId, messageId: message.id, channelType: channel.channel_type },
      '[ChannelIngress] Inbound message received'
    );

    return message;
  }

  async markMessageProcessed(id: string, ticketId?: string): Promise<ChannelMessage | null> {
    return this.messageRepo.updateStatus(id, 'processed', { ticketId });
  }

  async markMessageFailed(id: string, errorMessage: string): Promise<ChannelMessage | null> {
    return this.messageRepo.updateStatus(id, 'failed', { errorMessage });
  }

  // ---- Message Log Queries ----

  async listMessages(options?: {
    channelId?: string;
    direction?: string;
    status?: string;
    ticketId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: ChannelMessage[]; total: number }> {
    return this.messageRepo.findAll(options);
  }

  async getMessagesByChannel(channelId: string, limit?: number): Promise<ChannelMessage[]> {
    return this.messageRepo.getByChannel(channelId, limit);
  }

  // ---- Channel Test ----

  async testChannel(id: string): Promise<{ success: boolean; message: string }> {
    const channel = await this.channelRepo.findById(id);
    if (!channel) {
      throw new OrionError(`Channel not found: ${id}`, 'NOT_FOUND');
    }

    // Log a test outbound message
    await this.messageRepo.create({
      channel_id: id,
      direction: 'outbound',
      message_type: 'text',
      subject: 'Test Message',
      body: `Test message from Orion channel: ${channel.name}`,
      status: 'received',
    });

    return { success: true, message: `Test message sent via channel: ${channel.name}` };
  }
}
