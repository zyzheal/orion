/**
 * API 响应类型定义
 * 统一处理后端 API 响应结构
 */

// 通用 API 响应包装
export interface ApiResponse<T> {
  code?: number;
  message?: string;
  data?: T;
  [key: string]: unknown;
}

// 分页响应
export interface PaginatedResponse<T> {
  data?: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

// ChatOps 响应
export interface ChatOpsResponse<T> {
  data?: {
    data?: T;
    messages?: T;
    hasMore?: boolean;
    nextCursor?: string | null;
  };
}

// 命令列表响应
export interface CommandListResponse {
  data?: {
    commands: Array<{
      id: string;
      name: string;
      subcommand?: string;
      schema: Record<string, unknown>;
      examples: string[];
    }>;
  };
}

// 推荐列表响应
export interface RecommendationListResponse {
  data?: {
    recommendations: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
      description: string;
      actions: Array<{ label: string; command: string; params: Record<string, unknown> }>;
      createdAt: string;
      source: string;
    }>;
  };
}

// 执行结果响应
export interface ExecutionResultResponse {
  data?: {
    data?: {
      result?: {
        output?: string;
        status?: string;
      };
      status?: string;
    };
  };
}

// 流水线详情响应
export interface PipelineDetailResponse {
  data?: {
    data?: {
      id: string;
      name: string;
      status: string;
      pipelineId: string;
      projectId: string;
      trigger: string;
      creator?: {
        id: string;
        email: string;
        name?: string;
      };
      createdAt: string;
      updatedAt?: string;
      startedAt?: string;
      finishedAt?: string;
      duration?: number;
      stages?: Array<{
        id: string;
        name: string;
        status: string;
        duration?: number;
        tasks?: Array<{
          id: string;
          name: string;
          status: string;
          duration?: number;
        }>;
      }>;
    };
  };
}

// 流水线列表响应
export interface PipelineListResponse {
  data?: {
    list: Array<{
      id: string;
      name: string;
      status: string;
      pipelineId: string;
      projectId: string;
      trigger: string;
      creator?: {
        id: string;
        email: string;
        name?: string;
      };
      createdAt: string;
      updatedAt?: string;
      startedAt?: string;
      finishedAt?: string;
      duration?: number;
    }>;
    total: number;
  };
}

// 运行时日志响应
export interface LiveLogResponse {
  data?: {
    data?: Array<{
      timestamp: string;
      level: string;
      message: string;
      stage?: string;
      task?: string;
    }>;
  };
}

// 代码管理响应
export interface CodeMgmtResponse<T> {
  data?: {
    data?: T;
  };
}

// ITSM 工单响应
export interface TicketResponse {
  data?: {
    data?: {
      id: string;
      title: string;
      status: string;
      priority: string;
      type: string;
      assignee?: string;
      reporter?: string;
      createdAt: string;
      updatedAt?: string;
      relations?: Array<{
        id: string;
        type: string;
        targetId: string;
        targetType: string;
        relation: string;
      }>;
      history?: Array<{
        id: string;
        userId: string;
        action: string;
        timestamp: string;
        details?: Record<string, unknown>;
      }>;
    };
  };
}

// 窗口扩展属性
export interface WindowExtensions {
  __SUBAPP_API_BASE__?: string;
  __POWERED_BY_ORION__?: boolean;
  __BASENAME__?: string;
  $orion?: {
    token?: string;
    apiDomain?: string;
    [key: string]: unknown;
  };
  __orionToken?: string;
}

// 用户类型
export interface User {
  id?: string;
  email?: string;
  name?: string;
  roles?: string[];
  role?: string;
  [key: string]: unknown;
}

// 错误类型
export interface OrionError {
  code?: string;
  message?: string;
  requestId?: string;
  [key: string]: unknown;
}

// 执行结果数据
export interface ExecData {
  result?: {
    output?: string;
    status?: string;
  };
  status?: string;
  data?: unknown;
  [key: string]: unknown;
}

// 推荐项基础类型
export interface BaseRecommendation {
  id: string;
  status?: string;
  assignee?: string;
  [key: string]: unknown;
}

// 全局窗口扩展声明
declare global {
  interface Window {
    __SUBAPP_API_BASE__?: string;
    __POWERED_BY_ORION__?: boolean;
    __BASENAME__?: string;
    $orion?: {
      token?: string;
      tenantId?: string;
      user?: User;
      getApiBase?: () => string;
      apiDomain?: string;
      [key: string]: unknown;
    };
    __orionToken?: string;
  }
}

export {};
