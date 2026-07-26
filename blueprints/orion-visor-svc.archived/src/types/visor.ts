export interface Host {
  id: string;
  tenantId: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  status: 'online' | 'offline' | 'error';
  os: string;
  cpu: number;
  memory: number;
  disk: number;
  createdAt: string;
  updatedAt: string;
}

export interface Script {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  content: string;
  type: 'shell' | 'python' | 'powershell';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  tenantId: string;
  hostIds: string[];
  scriptId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  output?: string;
  error?: string;
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TerminalSession {
  id: string;
  hostId: string;
  userId: string;
  status: 'active' | 'closed';
  createdAt: string;
}

export interface CreateHostInput {
  name: string;
  ip: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface ExecuteScriptInput {
  hostIds: string[];
  scriptId?: string;
  content?: string;
  type?: 'shell' | 'python' | 'powershell';
  timeout?: number;
}

export interface VisorQuery {
  tenantId?: string;
  page?: number;
  limit?: number;
}
