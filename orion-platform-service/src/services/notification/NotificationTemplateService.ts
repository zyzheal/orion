import { NotificationTemplateRepository, NotificationTemplate, CreateNotificationTemplateInput, UpdateNotificationTemplateInput } from '../repositories/NotificationTemplateRepository';
import { createLogger } from '../../utils/logger';

export class NotificationTemplateServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'NotificationTemplateServiceError';
  }
}

export class NotificationTemplateService {
  private logger = createLogger('notification-template');

  constructor(private repository: NotificationTemplateRepository) {}

  async createTemplate(input: CreateNotificationTemplateInput): Promise<NotificationTemplate> {
    if (!input.name || !input.event_type || !input.body_template) {
      throw new NotificationTemplateServiceError('name, event_type, and body_template are required', 'INVALID_INPUT');
    }
    return this.repository.create(input);
  }

  async getTemplate(id: string): Promise<NotificationTemplate> {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new NotificationTemplateServiceError(`Template not found: ${id}`, 'NOT_FOUND');
    }
    return template;
  }

  async listTemplates(options?: { event_type?: string; limit?: number; offset?: number }): Promise<NotificationTemplate[]> {
    return this.repository.findAll(options);
  }

  async updateTemplate(id: string, updates: UpdateNotificationTemplateInput): Promise<NotificationTemplate> {
    const template = await this.repository.update(id, updates);
    if (!template) {
      throw new NotificationTemplateServiceError(`Template not found: ${id}`, 'NOT_FOUND');
    }
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotificationTemplateServiceError(`Template not found: ${id}`, 'NOT_FOUND');
    }
  }
}
