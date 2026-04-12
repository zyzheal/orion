/**
 * 分页工具单元测试
 */

import {
  OffsetPaginator,
  CursorPaginator,
  applyOffsetPagination,
  applyCursorPagination,
  createPaginator,
} from '../pagination';

describe('OffsetPaginator', () => {
  let paginator: OffsetPaginator;

  beforeEach(() => {
    paginator = new OffsetPaginator();
  });

  describe('parseParams', () => {
    it('should use default values when no params provided', () => {
      const result = paginator.parseParams({});
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(result.sort).toBe('createdAt');
      expect(result.order).toBe('desc');
    });

    it('should use provided values', () => {
      const result = paginator.parseParams({
        limit: 50,
        offset: 100,
        sort: 'name',
        order: 'asc',
      });
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
      expect(result.sort).toBe('name');
      expect(result.order).toBe('asc');
    });

    it('should enforce max limit', () => {
      const result = paginator.parseParams({ limit: 200 });
      expect(result.limit).toBe(100); // maxLimit
    });

    it('should enforce min limit', () => {
      const result = paginator.parseParams({ limit: 0 });
      expect(result.limit).toBe(1); // minLimit
    });

    it('should handle negative offset', () => {
      const result = paginator.parseParams({ offset: -10 });
      expect(result.offset).toBe(0);
    });
  });

  describe('createResponse', () => {
    it('should create proper pagination response', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const params = { limit: 10, offset: 0, sort: 'createdAt', order: 'desc' as const };
      const result = paginator.createResponse(data, 100, params, 'req-123');

      expect(result.data).toEqual(data);
      expect(result.pagination).toEqual({
        type: 'offset',
        total: 100,
        limit: 10,
        offset: 0,
        hasMore: true,
      });
      expect(result.meta.requestId).toBe('req-123');
      expect(result.meta.timestamp).toBeDefined();
    });

    it('should set hasMore to false when at end', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const params = { limit: 10, offset: 90, sort: 'createdAt', order: 'desc' as const };
      const result = paginator.createResponse(data, 92, params);

      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('getTotalPages', () => {
    it('should calculate total pages correctly', () => {
      expect(paginator.getTotalPages(100, 20)).toBe(5);
      expect(paginator.getTotalPages(101, 20)).toBe(6);
      expect(paginator.getTotalPages(0, 20)).toBe(0);
    });
  });

  describe('hasPreviousPage', () => {
    it('should return true when offset > 0', () => {
      expect(paginator.hasPreviousPage(10)).toBe(true);
      expect(paginator.hasPreviousPage(0)).toBe(false);
    });
  });

  describe('hasNextPage', () => {
    it('should return true when more pages exist', () => {
      expect(paginator.hasNextPage(0, 20, 100)).toBe(true);
      expect(paginator.hasNextPage(80, 20, 100)).toBe(false);
      expect(paginator.hasNextPage(90, 20, 100)).toBe(false);
    });
  });
});

describe('CursorPaginator', () => {
  let paginator: CursorPaginator;

  beforeEach(() => {
    paginator = new CursorPaginator();
  });

  describe('parseParams', () => {
    it('should use default values when no params provided', () => {
      const result = paginator.parseParams({});
      expect(result.limit).toBe(20);
      expect(result.cursor).toBeUndefined();
      expect(result.direction).toBe('next');
    });

    it('should use provided values', () => {
      const result = paginator.parseParams({
        limit: 50,
        cursor: 'eyJpZCI6MTAwfQ==',
        direction: 'previous',
      });
      expect(result.limit).toBe(50);
      expect(result.cursor).toBe('eyJpZCI6MTAwfQ==');
      expect(result.direction).toBe('previous');
    });
  });

  describe('encodeCursor/decodeCursor', () => {
    it('should encode and decode string cursor', () => {
      const original = '123';
      const encoded = paginator.encodeCursor(original);
      expect(paginator.decodeCursor(encoded)).toBe(original);
    });

    it('should encode and decode number cursor', () => {
      const original = 456;
      const encoded = paginator.encodeCursor(original);
      expect(paginator.decodeCursor(encoded)).toBe('456');
    });

    it('should encode and decode Date cursor', () => {
      const original = new Date('2026-04-11T10:00:00Z');
      const encoded = paginator.encodeCursor(original);
      expect(paginator.decodeCursor(encoded)).toBe(original.toISOString());
    });

    it('should throw on invalid cursor', () => {
      // Empty string is invalid base64 for our use case (decodes to empty)
      expect(() => paginator.decodeCursor('')).toThrow(
        'Invalid cursor format'
      );
    });
  });

  describe('createResponse', () => {
    it('should create cursor pagination response', () => {
      const data = [
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '4' },
        { id: '5' },
      ];
      const params = { limit: 5, direction: 'next' as const };
      const result = paginator.createResponse(data, params, {}, 'req-123');

      expect(result.data).toEqual(data);
      expect(result.pagination.type).toBe('cursor');
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.hasMore).toBe(true);

      // Type guard to access cursor property
      if (result.pagination.type === 'cursor') {
        expect(result.pagination.cursor.next).toBeDefined();
        expect(result.pagination.cursor.previous).toBeDefined();
      }
    });

    it('should set hasMore to false when less than limit items', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const params = { limit: 5, direction: 'next' as const };
      const result = paginator.createResponse(data, params, {});

      expect(result.pagination.hasMore).toBe(false);

      // Type guard to access cursor property
      if (result.pagination.type === 'cursor') {
        expect(result.pagination.cursor.next).toBeUndefined();
      }
    });
  });

  describe('buildCursorCondition', () => {
    it('should return none operator when no cursor', () => {
      const condition = paginator.buildCursorCondition(undefined, 'next');
      expect(condition.operator).toBe('none');
    });

    it('should build gt condition for next direction', () => {
      const cursor = paginator.encodeCursor('100');
      const condition = paginator.buildCursorCondition(cursor, 'next', 'id');
      expect(condition.operator).toBe('gt');
      expect(condition.field).toBe('id');
      expect(condition.value).toBe('100');
    });

    it('should build lt condition for previous direction', () => {
      const cursor = paginator.encodeCursor('100');
      const condition = paginator.buildCursorCondition(cursor, 'previous', 'id');
      expect(condition.operator).toBe('lt');
    });
  });
});

describe('applyOffsetPagination', () => {
  const items = [
    { id: 1 },
    { id: 2 },
    { id: 3 },
    { id: 4 },
    { id: 5 },
    { id: 6 },
    { id: 7 },
    { id: 8 },
    { id: 9 },
    { id: 10 },
  ];

  it('should slice array correctly', () => {
    const result = applyOffsetPagination(items, {
      limit: 3,
      offset: 0,
      sort: 'id',
      order: 'asc',
    });
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('should handle offset correctly', () => {
    const result = applyOffsetPagination(items, {
      limit: 3,
      offset: 5,
      sort: 'id',
      order: 'asc',
    });
    expect(result).toEqual([{ id: 6 }, { id: 7 }, { id: 8 }]);
  });
});

describe('applyCursorPagination', () => {
  const items = [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
    { id: 'd' },
    { id: 'e' },
  ];

  it('should return first page when no cursor', () => {
    const result = applyCursorPagination(items, {
      limit: 3,
      direction: 'next',
    });
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('should return next page with cursor', () => {
    const paginator = new CursorPaginator();
    const cursor = paginator.encodeCursor('b');

    const result = applyCursorPagination(items, {
      limit: 2,
      cursor,
      direction: 'next',
    });
    expect(result).toEqual([{ id: 'c' }, { id: 'd' }]);
  });

  it('should return previous page with cursor', () => {
    const paginator = new CursorPaginator();
    const cursor = paginator.encodeCursor('d');

    const result = applyCursorPagination(items, {
      limit: 2,
      cursor,
      direction: 'previous',
    });
    // Should return items before 'd' in reverse order
    expect(result).toEqual([{ id: 'c' }, { id: 'b' }]);
  });
});

describe('createPaginator', () => {
  it('should create offset paginator', () => {
    const paginator = createPaginator('offset');
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = paginator.paginate(items, 10);

    expect(result.pagination.type).toBe('offset');
    expect(result.data).toEqual(items);
  });

  it('should create cursor paginator', () => {
    const paginator = createPaginator('cursor');
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = paginator.paginate(items);

    expect(result.pagination.type).toBe('cursor');
    expect(result.data).toEqual(items);
  });
});
