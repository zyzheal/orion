/**
 * 分页工具
 *
 * 支持 Offset 和 Cursor 两种分页策略
 */

export interface PaginationMeta {
  type: 'offset' | 'cursor';
  limit: number;
  hasMore: boolean;
}

export interface OffsetPaginationMeta extends PaginationMeta {
  type: 'offset';
  total?: number;
  offset: number;
}

export interface CursorPaginationMeta extends PaginationMeta {
  type: 'cursor';
  cursor: {
    current?: string;
    next?: string;
    previous?: string;
  };
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: OffsetPaginationMeta | CursorPaginationMeta;
  meta: {
    requestId?: string;
    timestamp: string;
  };
}

export interface OffsetPaginationParams {
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface CursorPaginationParams {
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'previous';
}

/**
 * 分页配置
 */
export interface PaginationConfig {
  maxLimit: number;
  defaultLimit: number;
  minLimit: number;
}

const DEFAULT_CONFIG: PaginationConfig = {
  maxLimit: 100,
  defaultLimit: 20,
  minLimit: 1,
};

/**
 * Offset 分页器
 *
 * 适用于传统列表场景，支持跳页
 */
export class OffsetPaginator {
  private config: PaginationConfig;

  constructor(config: Partial<PaginationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 解析分页参数
   */
  parseParams(params: OffsetPaginationParams): ParsedOffsetParams {
    const limit = Math.min(
      Math.max(params.limit ?? this.config.defaultLimit, this.config.minLimit),
      this.config.maxLimit
    );

    const offset = Math.max(params.offset ?? 0, 0);

    return {
      limit,
      offset,
      sort: params.sort ?? 'createdAt',
      order: params.order ?? 'desc',
    };
  }

  /**
   * 创建分页响应
   */
  createResponse<T>(
    data: T[],
    total: number,
    params: ParsedOffsetParams,
    requestId?: string
  ): PaginationResponse<T> {
    const hasMore = params.offset + data.length < total;

    return {
      data,
      pagination: {
        type: 'offset',
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * 计算总页数
   */
  getTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit);
  }

  /**
   * 判断是否有上一页
   */
  hasPreviousPage(offset: number): boolean {
    return offset > 0;
  }

  /**
   * 判断是否有下一页
   */
  hasNextPage(offset: number, limit: number, total: number): boolean {
    return offset + limit < total;
  }
}

export interface ParsedOffsetParams {
  limit: number;
  offset: number;
  sort: string;
  order: 'asc' | 'desc';
}

/**
 * Cursor 分页器
 *
 * 适用于大数据量、实时数据场景
 */
export class CursorPaginator {
  private config: PaginationConfig;

  constructor(config: Partial<PaginationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 解析分页参数
   */
  parseParams(params: CursorPaginationParams): ParsedCursorParams {
    const limit = Math.min(
      Math.max(params.limit ?? this.config.defaultLimit, this.config.minLimit),
      this.config.maxLimit
    );

    return {
      limit,
      cursor: params.cursor,
      direction: params.direction ?? 'next',
    };
  }

  /**
   * 创建分页响应
   */
  createResponse<T extends Record<string, any>>(
    data: T[],
    params: ParsedCursorParams,
    options: CursorResponseOptions<T>,
    requestId?: string
  ): PaginationResponse<T> {
    const { idField = 'id' as keyof T } = options;

    // 编码当前游标
    let currentCursor: string | undefined;
    if (params.cursor) {
      currentCursor = params.cursor;
    } else if (data.length > 0) {
      currentCursor = this.encodeCursor(String(data[0][idField]));
    }

    // 编码下一页游标
    let nextCursor: string | undefined;
    if (data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = this.encodeCursor(String(lastItem[idField]));
    }

    // 编码上一页游标
    let previousCursor: string | undefined;
    if (data.length > 0) {
      const firstItem = data[0];
      previousCursor = this.encodeCursor(String(firstItem[idField]));
    }

    const hasMore = data.length >= params.limit;

    return {
      data,
      pagination: {
        type: 'cursor',
        limit: params.limit,
        cursor: {
          current: currentCursor,
          next: hasMore ? nextCursor : undefined,
          previous: previousCursor,
        },
        hasMore,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * 编码游标
   */
  encodeCursor(value: string | number | Date): string {
    const cursorData = typeof value === 'object' ? value.toISOString() : String(value);
    return Buffer.from(cursorData, 'utf-8').toString('base64');
  }

  /**
   * 解码游标
   */
  decodeCursor(cursor: string): string {
    if (!cursor || typeof cursor !== 'string') {
      throw new Error(`Invalid cursor format: ${cursor}`);
    }
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      // 检查解码后是否为空或包含无效字符
      if (!decoded) {
        throw new Error(`Invalid cursor format: ${cursor}`);
      }
      return decoded;
    } catch (error) {
      throw new Error(`Invalid cursor format: ${cursor}`);
    }
  }

  /**
   * 从游标构建查询条件
   */
  buildCursorCondition<T extends { id?: string | number }>(
    cursor: string | undefined,
    direction: 'next' | 'previous',
    sortField: string = 'id'
  ): CursorCondition {
    if (!cursor) {
      return { operator: 'none' };
    }

    const cursorValue = this.decodeCursor(cursor);

    return {
      operator: direction === 'next' ? 'gt' : 'lt',
      field: sortField,
      value: cursorValue,
    };
  }
}

export interface ParsedCursorParams {
  limit: number;
  cursor?: string;
  direction: 'next' | 'previous';
}

export interface CursorResponseOptions<T> {
  idField?: keyof T;
}

export interface CursorCondition {
  operator: 'gt' | 'lt' | 'none';
  field?: string;
  value?: string;
}

/**
 * 分页辅助函数
 */

/**
 * 应用 Offset 分页到数组
 */
export function applyOffsetPagination<T>(
  items: T[],
  params: ParsedOffsetParams
): T[] {
  const { offset, limit } = params;
  return items.slice(offset, offset + limit);
}

/**
 * 应用 Cursor 分页到数组（基于 ID 比较）
 */
export function applyCursorPagination<T extends Record<string, any>>(
  items: T[],
  params: ParsedCursorParams,
  sortField: keyof T = 'id' as keyof T
): T[] {
  const { cursor, direction, limit } = params;

  if (!cursor) {
    return items.slice(0, limit);
  }

  const paginator = new CursorPaginator();
  const cursorValue = paginator.decodeCursor(cursor);

  let filtered: T[];
  if (direction === 'next') {
    filtered = items.filter((item) => String(item[sortField]) > cursorValue);
  } else {
    filtered = items.filter((item) => String(item[sortField]) < cursorValue);
    // 反向遍历以获取正确的顺序
    filtered.reverse();
  }

  return filtered.slice(0, limit);
}

/**
 * 统一的分页接口
 */
export interface Paginator<T> {
  paginate(items: T[], total?: number): PaginationResponse<T>;
}

/**
 * 创建分页器的工厂函数
 */
export function createPaginator<T extends Record<string, any>>(
  type: 'offset' | 'cursor',
  config?: Partial<PaginationConfig>
): Paginator<T> {
  if (type === 'cursor') {
    const paginator = new CursorPaginator(config);
    return {
      paginate(items: T[], total?: number): PaginationResponse<T> {
        // Cursor 分页不需要 total
        return paginator.createResponse(
          items,
          { limit: config?.defaultLimit ?? 20, direction: 'next' },
          {},
          undefined
        ) as PaginationResponse<T>;
      },
    };
  } else {
    const paginator = new OffsetPaginator(config);
    return {
      paginate(items: T[], total: number = items.length): PaginationResponse<T> {
        return paginator.createResponse(
          items,
          total,
          {
            limit: config?.defaultLimit ?? 20,
            offset: 0,
            sort: 'createdAt',
            order: 'desc',
          },
          undefined
        );
      },
    };
  }
}
