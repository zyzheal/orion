/**
 * NotificationTemplateService - Comprehensive tests
 *
 * Covers:
 * - Variable replacement engine ({{variable}} syntax)
 * - Template inheritance (base + override)
 * - Template preview (render with sample variables)
 */

import { NotificationTemplateService, NotificationTemplateServiceError, RenderResult, TemplateInheritanceOverride } from '../NotificationTemplateService';
import { NotificationTemplateRepository, NotificationTemplate, CreateNotificationTemplateInput } from '../../repositories/NotificationTemplateRepository';

describe('NotificationTemplateService', () => {
  let mockRepository: jest.Mocked<NotificationTemplateRepository>;
  let service: NotificationTemplateService;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findByEventType: jest.fn(),
    } as unknown as jest.Mocked<NotificationTemplateRepository>;

    service = new NotificationTemplateService(mockRepository);
  });

  // ================================================================
  // extractVariables
  // ================================================================

  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const result = service.extractVariables('Hello {{name}}');
      expect(result).toEqual(['name']);
    });

    it('should extract multiple distinct variables', () => {
      const result = service.extractVariables('{{name}} {{email}}');
      expect(result).toEqual(['name', 'email']);
    });

    it('should deduplicate repeated variables', () => {
      const result = service.extractVariables('{{name}} and {{name}} again');
      expect(result).toEqual(['name']);
    });

    it('should return empty array for no variables', () => {
      const result = service.extractVariables('Hello world');
      expect(result).toEqual([]);
    });

    it('should trim whitespace around variable keys', () => {
      const result = service.extractVariables('{{  key  }}');
      expect(result).toEqual(['key']);
    });

    it('should extract underscore and hyphen in variable names', () => {
      const result = service.extractVariables('{{user_name}} {{first-name}}');
      expect(result).toEqual(['user_name', 'first-name']);
    });
  });

  // ================================================================
  // renderTemplate
  // ================================================================

  describe('renderTemplate', () => {
    it('should replace all variables when all are provided', () => {
      const { rendered, missing } = service.renderTemplate('Hello {{name}}', { name: 'World' });
      expect(rendered).toBe('Hello World');
      expect(missing).toEqual([]);
    });

    it('should replace multiple variables', () => {
      const { rendered, missing } = service.renderTemplate('{{greeting}} {{name}}', { greeting: 'Hi', name: 'Alice' });
      expect(rendered).toBe('Hi Alice');
      expect(missing).toEqual([]);
    });

    it('should leave placeholder intact when variable is missing', () => {
      const { rendered, missing } = service.renderTemplate('Hello {{name}}', {});
      expect(rendered).toBe('Hello {{name}}');
      expect(missing).toEqual(['name']);
    });

    it('should report missing variables for partial substitution', () => {
      const { rendered, missing } = service.renderTemplate('{{name}} {{email}}', { name: 'Alice' });
      expect(rendered).toBe('Alice {{email}}');
      expect(missing).toEqual(['email']);
    });

    it('should handle empty variables map', () => {
      const { rendered, missing } = service.renderTemplate('{{a}} {{b}}', {});
      expect(rendered).toBe('{{a}} {{b}}');
      expect(missing).toEqual(['a', 'b']);
    });

    it('should handle empty template string', () => {
      const { rendered, missing } = service.renderTemplate('', { name: 'X' });
      expect(rendered).toBe('');
      expect(missing).toEqual([]);
    });

    it('should handle template with no placeholders', () => {
      const { rendered, missing } = service.renderTemplate('Plain text', { name: 'X' });
      expect(rendered).toBe('Plain text');
      expect(missing).toEqual([]);
    });

    it('should trim keys before lookup', () => {
      const { rendered } = service.renderTemplate('{{  name  }}', { name: 'X' });
      expect(rendered).toBe('X');
    });

    it('should treat empty string variable as present', () => {
      const { rendered, missing } = service.renderTemplate('{{name}}', { name: '' });
      expect(rendered).toBe('');
      expect(missing).toEqual([]);
    });
  });

  // ================================================================
  // renderTemplateFull
  // ================================================================

  describe('renderTemplateFull', () => {
    const baseTemplate: NotificationTemplate = {
      id: 'tpl-1',
      tenant_id: 't1',
      name: 'Test',
      event_type: 'alert',
      subject: 'Alert: {{title}}',
      subject_template: 'Subject: {{title}}',
      body_template: 'Body: {{body}}',
      channel_ids: [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should render both subject_template and body_template', () => {
      const result = service.renderTemplateFull(baseTemplate, { title: 'CPU High', body: 'CPU at 99%' });
      expect(result.subject).toBe('Subject: CPU High');
      expect(result.body).toBe('Body: CPU at 99%');
      expect(result.missingVariables).toEqual([]);
    });

    it('should fall back to subject when subject_template is null', () => {
      const tpl: NotificationTemplate = { ...baseTemplate, subject_template: null };
      const result = service.renderTemplateFull(tpl, { title: 'T' });
      expect(result.subject).toBe('Alert: T');
    });

    it('should return undefined subject when both subject and subject_template are null', () => {
      const tpl: NotificationTemplate = { ...baseTemplate, subject: null, subject_template: null };
      const result = service.renderTemplateFull(tpl, {});
      expect(result.subject).toBeUndefined();
    });

    it('should aggregate missing variables from subject and body', () => {
      const result = service.renderTemplateFull(baseTemplate, { title: 'T' });
      expect(result.missingVariables).toContain('body');
    });

    it('should deduplicate missing variables across subject and body', () => {
      const tpl: NotificationTemplate = { ...baseTemplate, subject_template: '{{missing}}' };
      const result = service.renderTemplateFull(tpl, {});
      // bodyResult.missing comes first, then subjectResult.missing
      expect(result.missingVariables).toEqual(['body', 'missing']);
    });
  });

  // ================================================================
  // Basic CRUD
  // ================================================================

  describe('createTemplate', () => {
    it('should create template with required fields', async () => {
      mockRepository.create.mockResolvedValue({
        id: 'tpl-1', tenant_id: 't1', name: 'T', event_type: 'alert',
        body_template: 'body', channel_ids: [], created_at: new Date(), updated_at: new Date(),
      });

      const result = await service.createTemplate({
        name: 'T', event_type: 'alert', body_template: 'body',
      });

      expect(result.id).toBe('tpl-1');
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should throw when name is missing', async () => {
      await expect(service.createTemplate({ name: '', event_type: 'alert', body_template: 'body' }))
        .rejects.toThrow('name, event_type, and body_template are required');
    });

    it('should throw when event_type is missing', async () => {
      await expect(service.createTemplate({ name: 'T', event_type: '', body_template: 'body' }))
        .rejects.toThrow('name, event_type, and body_template are required');
    });

    it('should throw when body_template is missing', async () => {
      await expect(service.createTemplate({ name: 'T', event_type: 'alert', body_template: '' }))
        .rejects.toThrow('name, event_type, and body_template are required');
    });
  });

  describe('getTemplate', () => {
    it('should return template when found', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'tpl-1', tenant_id: 't1', name: 'T', event_type: 'alert',
        body_template: 'body', channel_ids: [], created_at: new Date(), updated_at: new Date(),
      });

      const result = await service.getTemplate('tpl-1');

      expect(result.id).toBe('tpl-1');
      expect(mockRepository.findById).toHaveBeenCalledWith('tpl-1');
    });

    it('should throw NOT_FOUND when template does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getTemplate('missing')).rejects.toThrow(NotificationTemplateServiceError);
      await expect(service.getTemplate('missing')).rejects.toThrow('Template not found: missing');
    });
  });

  describe('updateTemplate', () => {
    it('should update and return template', async () => {
      mockRepository.update.mockResolvedValue({
        id: 'tpl-1', tenant_id: 't1', name: 'Updated', event_type: 'alert',
        body_template: 'new body', channel_ids: [], created_at: new Date(), updated_at: new Date(),
      });

      const result = await service.updateTemplate('tpl-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should throw NOT_FOUND when updating non-existent template', async () => {
      mockRepository.update.mockResolvedValue(null);

      await expect(service.updateTemplate('missing', { name: 'X' })).rejects.toThrow('Template not found: missing');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      mockRepository.delete.mockResolvedValue(true);

      await service.deleteTemplate('tpl-1');

      expect(mockRepository.delete).toHaveBeenCalledWith('tpl-1');
    });

    it('should throw NOT_FOUND when deleting non-existent template', async () => {
      mockRepository.delete.mockResolvedValue(false);

      await expect(service.deleteTemplate('missing')).rejects.toThrow('Template not found: missing');
    });
  });

  describe('listTemplates', () => {
    it('should return all templates when no options', async () => {
      const templates: NotificationTemplate[] = [{
        id: 't1', tenant_id: 't1', name: 'T1', event_type: 'alert',
        body_template: 'b', channel_ids: [], created_at: new Date(), updated_at: new Date(),
      }];
      mockRepository.findAll.mockResolvedValue(templates);

      const result = await service.listTemplates();

      expect(result).toEqual(templates);
      expect(mockRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should pass event_type filter to repository', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      await service.listTemplates({ event_type: 'alert' });

      expect(mockRepository.findAll).toHaveBeenCalledWith({ event_type: 'alert' });
    });
  });

  // ================================================================
  // Template Inheritance
  // ================================================================

  describe('resolveInheritance', () => {
    const baseTemplate: NotificationTemplate = {
      id: 'base-1', tenant_id: 't1', name: 'Base', event_type: 'alert',
      body_template: 'Base body', subject_template: 'Base subject', subject: 'Base subj',
      channel_ids: ['in-app'], created_at: new Date(), updated_at: new Date(),
    };

    beforeEach(() => {
      mockRepository.findById.mockResolvedValue(baseTemplate);
    });

    it('should merge override fields over base', async () => {
      const overrides: TemplateInheritanceOverride = { body_template: 'Overridden body' };
      const result = await service.resolveInheritance('base-1', overrides);

      expect(result.body_template).toBe('Overridden body');
      expect(result.name).toBe('Base'); // inherited
      expect(result.channel_ids).toEqual(['in-app']);
    });

    it('should override channel_ids', async () => {
      const overrides: TemplateInheritanceOverride = { channel_ids: ['email', 'slack'] };
      const result = await service.resolveInheritance('base-1', overrides);

      expect(result.channel_ids).toEqual(['email', 'slack']);
    });

    it('should throw NOT_FOUND when base template missing', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.resolveInheritance('missing', {})).rejects.toThrow('Template not found: missing');
    });
  });

  describe('createInheritedTemplate', () => {
    const baseTemplate: NotificationTemplate = {
      id: 'base-1', tenant_id: 't1', name: 'Base', event_type: 'alert',
      body_template: 'Base body', subject_template: 'Base subject', subject: 'Base subj',
      channel_ids: ['in-app'], variables_schema: { key: 'type' }, category: 'system',
      created_at: new Date(), updated_at: new Date(),
    };

    beforeEach(() => {
      mockRepository.findById.mockResolvedValue(baseTemplate);
    });

    it('should inherit body_template from base when not provided', async () => {
      mockRepository.create.mockResolvedValue({
        id: 'child-1', tenant_id: 't1', name: 'Child', event_type: 'alert',
        body_template: 'Base body', channel_ids: ['in-app'], created_at: new Date(), updated_at: new Date(),
      });

      await service.createInheritedTemplate('base-1', { name: 'Child' });

      expect(mockRepository.create).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          name: 'Child',
          body_template: 'Base body',
          event_type: 'alert',
        })
      );
    });

    it('should override fields when provided', async () => {
      mockRepository.create.mockResolvedValue({
        id: 'child-1', tenant_id: 't1', name: 'Child', event_type: 'deploy',
        body_template: 'Child body', channel_ids: ['email'], created_at: new Date(), updated_at: new Date(),
      });

      await service.createInheritedTemplate('base-1', {
        name: 'Child',
        event_type: 'deploy',
        body_template: 'Child body',
        channel_ids: ['email'],
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          name: 'Child',
          event_type: 'deploy',
          body_template: 'Child body',
          channel_ids: ['email'],
        })
      );
    });

    it('should throw NOT_FOUND when base template missing', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.createInheritedTemplate('missing', { name: 'Child' }))
        .rejects.toThrow('Template not found: missing');
    });
  });

  // ================================================================
  // Template Preview
  // ================================================================

  describe('previewTemplate', () => {
    const baseTemplate: NotificationTemplate = {
      id: 'tpl-1', tenant_id: 't1', name: 'Preview Tpl', event_type: 'alert',
      subject_template: '{{title}}', body_template: 'Details: {{body}}',
      channel_ids: [], created_at: new Date(), updated_at: new Date(),
    };

    beforeEach(() => {
      mockRepository.findById.mockResolvedValue(baseTemplate);
    });

    it('should return rendered subject and body with all variables provided', async () => {
      const result = await service.previewTemplate('tpl-1', { variables: { title: 'CPU', body: '99%' } });

      expect(result).toEqual<RenderResult>({
        subject: 'CPU',
        body: 'Details: 99%',
        missingVariables: [],
      });
    });

    it('should report missing variables', async () => {
      const result = await service.previewTemplate('tpl-1', { variables: { title: 'CPU' } });

      expect(result.body).toBe('Details: {{body}}');
      expect(result.missingVariables).toEqual(['body']);
    });

    it('should throw NOT_FOUND when template missing', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.previewTemplate('missing', { variables: {} })).rejects.toThrow('Template not found: missing');
    });

    it('should pass channelId through', async () => {
      mockRepository.findById.mockResolvedValue(baseTemplate);

      await service.previewTemplate('tpl-1', { variables: { title: 'T', body: 'B' }, channelId: 'email' });

      expect(mockRepository.findById).toHaveBeenCalledWith('tpl-1');
    });
  });
});
