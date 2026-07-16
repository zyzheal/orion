/**
 * FormRepository Tests - Database layer for form definitions, fields, and instances
 * Covers query generation, parameter binding, and row mapping
 */

import { FormRepository, FormDefinition, FormFieldDefinition, FormInstance } from '../FormRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

describe('FormRepository', () => {
  let mockPool: { query: jest.Mock };
  let repo: FormRepository;

  const mockDefinitionRow: FormDefinition = {
    id: 'form-1',
    tenant_id: 'test-tenant',
    name: 'Bug Report',
    description: 'Bug report form',
    version: 1,
    layout: 'vertical',
    enabled: true,
    created_by: 'user-1',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const mockFieldRow: FormFieldDefinition = {
    id: 'field-1',
    tenant_id: 'test-tenant',
    form_id: 'form-1',
    field_key: 'title',
    field_type: 'text',
    label: 'Title',
    placeholder: 'Enter title',
    required: true,
    default_value: null,
    options: null,
    rules: null,
    visible_when: null,
    required_when: null,
    sort_order: 0,
    props: null,
    created_at: new Date('2026-01-01'),
  };

  const mockInstanceRow: FormInstance = {
    id: 'inst-1',
    tenant_id: 'test-tenant',
    definition_id: 'form-1',
    entity_type: 'ticket',
    entity_id: 'ticket-1',
    form_data: { title: 'Bug' },
    submitted_by: 'user-1',
    submitted_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new FormRepository(mockPool as any);
  });

  // ==================== findDefinitionById ====================

  describe('findDefinitionById', () => {
    it('should return definition when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDefinitionRow], rowCount: 1 });

      const result = await repo.findDefinitionById('form-1');

      expect(result).toEqual(mockDefinitionRow);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM form_definitions WHERE id = $1',
        ['form-1'],
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findDefinitionById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==================== findDefinitions ====================

  describe('findDefinitions', () => {
    it('should query with tenant isolation and default limit/offset', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockDefinitionRow] });

      const result = await repo.findDefinitions();

      expect(result.total).toBe(1);
      expect(result.rows).toEqual([mockDefinitionRow]);
      // Count query
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT COUNT(*) as count FROM form_definitions WHERE tenant_id = $1'),
        ['test-tenant'],
      );
      // Data query with LIMIT/OFFSET
      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('LIMIT $2 OFFSET $3'),
        ['test-tenant', 20, 0],
      );
    });

    it('should add enabled filter when provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.findDefinitions({ enabled: true });

      const countCall = mockPool.query.mock.calls[0];
      expect(countCall[0]).toContain('enabled = $2');
      expect(countCall[1]).toEqual(['test-tenant', true]);
    });
  });

  // ==================== createDefinition ====================

  describe('createDefinition', () => {
    it('should insert with tenant_id from context and return created row', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDefinitionRow], rowCount: 1 });

      const result = await repo.createDefinition({
        name: 'Bug Report',
        description: 'Bug report form',
      });

      expect(result).toEqual(mockDefinitionRow);
      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO form_definitions');
      expect(sql).toContain('RETURNING *');
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant');
      expect(params[1]).toBe('Bug Report');
    });

    it('should default layout to vertical and enabled to true', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDefinitionRow], rowCount: 1 });

      await repo.createDefinition({ name: 'Simple Form' });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toBe('vertical'); // layout default
      expect(params[4]).toBe(true);       // enabled default
    });
  });

  // ==================== updateDefinition ====================

  describe('updateDefinition', () => {
    it('should generate dynamic SET clauses for provided fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDefinitionRow], rowCount: 1 });

      await repo.updateDefinition('form-1', { name: 'Updated', enabled: false });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('enabled = $2');
      expect(sql).toContain('updated_at = NOW()');
      expect(sql).toContain('WHERE id = $3');
      const params = mockPool.query.mock.calls[0][1];
      expect(params).toEqual(['Updated', false, 'form-1']);
    });

    it('should fall back to findDefinitionById when no fields to update', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDefinitionRow], rowCount: 1 });

      await repo.updateDefinition('form-1', {});

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM form_definitions WHERE id = $1',
        ['form-1'],
      );
    });
  });

  // ==================== createField ====================

  describe('createField', () => {
    it('should serialize JSON fields and insert with tenant context', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockFieldRow], rowCount: 1 });

      const result = await repo.createField({
        form_id: 'form-1',
        field_key: 'title',
        field_type: 'text',
        label: 'Title',
        rules: { maxLength: 100 },
        options: ['a', 'b'],
      });

      expect(result).toEqual(mockFieldRow);
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant');
      expect(params[8]).toBe(JSON.stringify(['a', 'b']));          // options (index 8)
      expect(params[9]).toBe(JSON.stringify({ maxLength: 100 }));  // rules (index 9)
    });
  });

  // ==================== deleteFieldsByFormId ====================

  describe('deleteFieldsByFormId', () => {
    it('should return deleted row count', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 3 });

      const result = await repo.deleteFieldsByFormId('form-1');

      expect(result).toBe(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM form_field_definitions WHERE form_id = $1',
        ['form-1'],
      );
    });
  });

  // ==================== createInstance ====================

  describe('createInstance', () => {
    it('should stringify form_data and insert with tenant context', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockInstanceRow], rowCount: 1 });

      const result = await repo.createInstance({
        definition_id: 'form-1',
        entity_type: 'ticket',
        entity_id: 'ticket-1',
        form_data: { title: 'Bug' },
      });

      expect(result).toEqual(mockInstanceRow);
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant');
      expect(params[4]).toBe(JSON.stringify({ title: 'Bug' }));
    });
  });

  // ==================== updateInstance ====================

  describe('updateInstance', () => {
    it('should stringify form_data in update and set updated_at', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockInstanceRow], rowCount: 1 });

      await repo.updateInstance('inst-1', { form_data: { title: 'Fixed' } });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('form_data = $1');
      expect(sql).toContain('updated_at = NOW()');
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe(JSON.stringify({ title: 'Fixed' }));
    });
  });
});
