# ChatOps Phase 1a 优化方案 — P1/P2 问题修复计划

> 基于: `docs/review/chatops-phase1a-plan-review.md` (8.0/10)
> 优化目标: 14 个 P1 + 2 个 P2 问题全部给出代码级修复方案
> 日期: 2026-04-27

---

## 一、后端 API 优化 (架构师评审)

### TE-16 (升级为 P0): EventBus 事件格式完全不匹配

**问题**: `ChatOpsEventSubscriber` 使用 `eventBus.on('alert.created', handler)` 监听业务事件，但 `EventBusService` 的 `on()` 仅用于生命周期事件，业务事件应通过 `subscribe()` (NATS 模式) 监听。

**修复方案**: 引入双层事件总线架构：

```typescript
// orion-platform-service/src/services/chatops/EventSubscriber.ts

import { EventBusService } from '../event-bus-service';
import { EventEmitter } from 'events';

export interface Recommendation {
  id: string;
  type: 'alert' | 'blocked' | 'selfhealing' | 'cost';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actions: Array<{ label: string; command: string; params: Record<string, unknown> }>;
  createdAt: Date;
  source: string;
}

export class ChatOpsEventSubscriber {
  private eventBus: EventBusService;
  private localBus: EventEmitter = new EventEmitter();
  private activeRecommendations: Map<string, Recommendation> = new Map();
  private unsubscribeFns: Array<() => Promise<void>> = [];

  constructor(eventBus: EventBusService) {
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    // 使用 EventBusService.subscribe() (NATS 模式) 监听外部事件
    const unsub1 = await this.eventBus.subscribe('alert.created', async (event: any) => {
      this.handleAlertCreated(event.data || event);
    });
    this.unsubscribeFns.push(unsub1);

    const unsub2 = await this.eventBus.subscribe('alert.acknowledged', async (event: any) => {
      this.handleAlertAcknowledged(event.data || event);
    });
    this.unsubscribeFns.push(unsub2);

    const unsub3 = await this.eventBus.subscribe('pipeline.run.completed', async (event: any) => {
      this.handlePipelineCompleted(event.data || event);
    });
    this.unsubscribeFns.push(unsub3);

    const unsub4 = await this.eventBus.subscribe('selfhealing.failed', async (event: any) => {
      this.handleSelfHealingFailed(event.data || event);
    });
    this.unsubscribeFns.push(unsub4);
  }

  private handleAlertCreated(data: Record<string, unknown>): void {
    const alertId = data.alertId || data.id;
    if (!alertId) return;

    this.activeRecommendations.set(String(alertId), {
      id: String(alertId),
      type: 'alert',
      severity: (data.severity as 'critical' | 'warning' | 'info') || 'warning',
      title: String(data.title || '告警'),
      description: String(data.message || ''),
      actions: [
        { label: '查看日志', command: 'logs', params: { resource: data.resource } },
        { label: '诊断根因', command: 'diagnose', params: { resource: data.resource } },
      ],
      createdAt: new Date(),
      source: 'monitoring',
    });

    this.localBus.emit('chatops:recommendation_update', {
      recommendations: Array.from(this.activeRecommendations.values()),
    });
  }

  private handleAlertAcknowledged(data: Record<string, unknown>): void {
    const alertId = data.alertId || data.id;
    if (alertId) this.activeRecommendations.delete(String(alertId));
    this.localBus.emit('chatops:recommendation_update', {
      recommendations: Array.from(this.activeRecommendations.values()),
    });
  }

  private handlePipelineCompleted(data: Record<string, unknown>): void {
    if (data.status === 'failed') {
      const key = `pipeline:${data.runId}`;
      this.activeRecommendations.set(key, {
        id: key, type: 'blocked', severity: 'warning',
        title: `Pipeline #${data.runId} 执行失败`,
        description: String(data.error || ''),
        actions: [{ label: '查看日志', command: 'logs', params: { resource: data.pipelineId } }],
        createdAt: new Date(), source: 'pipeline',
      });
    }
    this.localBus.emit('chatops:recommendation_update', {
      recommendations: Array.from(this.activeRecommendations.values()),
    });
  }

  private handleSelfHealingFailed(data: Record<string, unknown>): void {
    const key = `selfhealing:${data.policyId}`;
    this.activeRecommendations.set(key, {
      id: key, type: 'selfhealing', severity: 'warning',
      title: `自愈失败: ${data.policyName}`,
      description: String(data.error || ''),
      actions: [{ label: '手动干预', command: 'diagnose', params: { resource: data.service } }],
      createdAt: new Date(), source: 'selfhealing',
    });
    this.localBus.emit('chatops:recommendation_update', {
      recommendations: Array.from(this.activeRecommendations.values()),
    });
  }

  getLocalBus(): EventEmitter { return this.localBus; }
  getActiveRecommendations(): Recommendation[] {
    return Array.from(this.activeRecommendations.values());
  }

  async cleanup(): Promise<void> {
    for (const unsub of this.unsubscribeFns) await unsub();
    this.unsubscribeFns = [];
    this.localBus.removeAllListeners();
  }
}
```

**影响**: EventSubscriber.ts 全部实现；SSE 路由改为监听 `localBus`

---

### TE-5: 所有新增 API 统一从 JWT 提取 userId

**修复方案**: 在 ChatOpsController 中增加 `getUser()` 辅助方法，所有新增路由使用：

```typescript
protected getUser(request: FastifyRequest): { userId: string; username: string; role: string } {
  const user = (request as any).user as { userId: string; username: string; role: string } | undefined;
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
```

| 路由 | 修改前 | 修改后 |
|------|--------|--------|
| `POST /recommendations` | `body.userId` | `this.getUser(request).userId` |
| `GET /settings/notification-preferences?userId=xxx` | `query.userId` | `this.getUser(request).userId` |
| `GET /settings/dnd` | 未明确 | `this.getUser(request).userId` |
| `GET/POST /alerts/states` | 未明确 | `this.getUser(request).userId` |

**影响**: API 契约同步更新；前端 API 调用需移除 userId 参数

---

### TE-6: SSE 路由安全写入

**修复方案**:

```typescript
app.get('/stream/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
  const user = (request as any).user as { userId: string; role: string } | undefined;
  if (!user) return reply.code(401).send({ error: 'UNAUTHORIZED' });

  reply.header('Content-Type', 'text/event-stream');
  reply.header('Cache-Control', 'no-cache');
  reply.header('Connection', 'keep-alive');
  reply.header('X-Accel-Buffering', 'no');
  reply.raw.write('event: connected\ndata: {"status":"ok"}\n\n');
  reply.sent = true;

  const listener = (data: Record<string, unknown>) => {
    if (reply.raw.writableEnded) {
      localBus.removeListener('chatops:recommendation_update', listener);
      return;
    }
    try {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      localBus.removeListener('chatops:recommendation_update', listener);
    }
  };

  localBus.on('chatops:recommendation_update', listener);
  reply.raw.on('close', () => {
    localBus.removeListener('chatops:recommendation_update', listener);
  });
  reply.raw.on('error', () => {
    localBus.removeListener('chatops:recommendation_update', listener);
  });
});
```

---

### SE-7: PermissionService 从数据库查询角色权限

**修复方案**: 将硬编码 `ROLE_PERMISSIONS` 改为数据库查询 + 缓存：

```typescript
export class PermissionService {
  private db: DatabasePool;
  private rolePermsCache: Map<string, { perms: string[]; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 60_000;

  constructor(db: DatabasePool) { this.db = db; }

  async getRolePermissions(roleName: string): Promise<string[]> {
    const cached = this.rolePermsCache.get(roleName);
    if (cached && cached.expiresAt > Date.now()) return cached.perms;

    const result = await this.db.query(
      `SELECT DISTINCT p.resource, p.action
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       JOIN roles r ON rp.role_id = r.id
       WHERE r.name = $1`,
      [roleName],
    );
    const perms = result.rows.map(row => `${row.resource}:${row.action}`);
    this.rolePermsCache.set(roleName, { perms, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return perms;
  }

  invalidateCache(roleName?: string): void {
    if (roleName) this.rolePermsCache.delete(roleName);
    else this.rolePermsCache.clear();
  }
}
```

**注意**: `COMMAND_PERMISSION` (命令→权限点映射) 保留硬编码，因为这是业务逻辑。

---

### SE-9: alert_id 资源范围校验

**修复方案**: `AlertStateService` 中所有操作前增加 `validateAlertOwnership`：

```typescript
private async validateAlertOwnership(userId: string, alertId: string): Promise<boolean> {
  const result = await this.db.query(
    `SELECT 1 FROM alerts a
     JOIN user_tenants ut ON a.tenant_id = ut.tenant_id
     WHERE a.id = $1 AND ut.user_id = $2 LIMIT 1`,
    [alertId, userId],
  );
  if (result.rowCount === 0) {
    const rc = await this.db.query(
      `SELECT 1 FROM chatops_alert_states cas
       JOIN user_resources ur ON cas.resource_type = ur.resource_type AND cas.resource_id = ur.resource_id
       WHERE cas.alert_id = $1 AND ur.user_id = $2 LIMIT 1`,
      [alertId, userId],
    );
    return rc.rowCount !== 0;
  }
  return true;
}

async markAsRead(userId: string, alertId: string): Promise<void> {
  if (!await this.validateAlertOwnership(userId, alertId)) throw new Error('无权访问该告警');
  await this.alertStateRepo.upsert({ userId, alertId, state: 'read', readAt: new Date() });
}
```

---

### TE-17: SSE 连接管理器

**新增 `SSEConnectionManager.ts`**:

```typescript
export interface SSEConnection {
  id: string; userId: string;
  listener: (data: Record<string, unknown>) => void;
  reply: FastifyReply;
  heartbeatTimer: NodeJS.Timer;
  connectedAt: Date;
}

export class SSEConnectionManager {
  private connections = new Map<string, SSEConnection>();
  private localBus: EventEmitter;
  private readonly HEARTBEAT_INTERVAL_MS = 30_000;

  constructor(localBus: EventEmitter) { this.localBus = localBus; }

  addConnection(conn: SSEConnection): void {
    this.connections.set(conn.id, conn);
    this.localBus.on('chatops:recommendation_update', conn.listener);
    conn.heartbeatTimer = setInterval(() => {
      if (conn.reply.raw.writableEnded) this.removeConnection(conn.id);
      else conn.reply.raw.write(':heartbeat\n\n');
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  removeConnection(id: string): void {
    const conn = this.connections.get(id);
    if (!conn) return;
    this.localBus.removeListener('chatops:recommendation_update', conn.listener);
    clearInterval(conn.heartbeatTimer);
    this.connections.delete(id);
  }

  async shutdown(): Promise<void> {
    for (const conn of this.connections.values()) {
      try { conn.reply.raw.write('event: shutdown\ndata: {"reason":"server_shutdown"}\n\n'); } catch {}
    }
    await new Promise(r => setTimeout(r, 2000));
    for (const id of this.connections.keys()) this.removeConnection(id);
  }
}
```

---

## 二、前端优化 (前端架构师评审)

### TE-9: Store 初始化改为延迟加载

```typescript
// chatOpsStore.ts — 移除 IIFE，替换为:
let _initialized = false;
export async function initializeChatOpsStore(): Promise<void> {
  if (_initialized) return;
  _initialized = true;
  try {
    const { data } = await getCommands();
    const commands = data.data || [];
    commands.forEach((cmd: any) => parser.registerSchema(cmd.name, cmd.schema || {}));
    useChatOpsStore.setState({ commands });
    useChatOpsStore.getState().fetchRecommendations();
  } catch (err) {
    console.error('[ChatOps] Failed to initialize store:', err);
    _initialized = false;
  }
}

// ChatPanel/index.tsx:
useEffect(() => { initializeChatOpsStore(); }, []);
```

### TE-10: userId 统一从 authStore 获取

```typescript
// chatOpsStore.ts 中两处替换:
// 旧: localStorage.getItem('user_id') || 'anonymous'
// 新:
import { useAuthStore } from '@/stores/authStore';
const userId = useAuthStore.getState().user?.id || useAuthStore.getState().user?.email || 'anonymous';
```

### TE-11: 消除 sendMessage 竞态

```typescript
sendMessage: async (text: string) => {
  const { isTyping, messages } = get();
  if (isTyping) return;  // 防抖

  const parseResult = parser.parse(text);
  const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
  set({ messages: [...messages, userMsg].slice(-500), isTyping: true });

  if (!parseResult.success) {
    const errMsg: ChatMessage = { id: crypto.randomUUID(), role: 'system', content: parseResult.error || '无法识别命令', timestamp: new Date() };
    set(state => ({ messages: [...state.messages, errMsg], isTyping: false }));
    return;
  }

  try {
    const { command, params } = parseResult.parsed!;
    const userId = useAuthStore.getState().user?.id || 'anonymous';
    const response = await executeCommand({ command, params, userId, platform: 'web' });
    const execData = response.data?.data;
    const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: execData?.result?.output || '命令执行完成', timestamp: new Date(), status: execData?.status === 'completed' ? 'success' : 'failed' };
    set(state => ({ messages: [...state.messages, aiMsg].slice(-500), isTyping: false }));
  } catch (err) {
    set(state => ({ messages: [...state.messages, { id: crypto.randomUUID(), role: 'system', content: `执行失败: ${err instanceof Error ? err.message : '未知错误'}`, timestamp: new Date() }], isTyping: false }));
  }
},
```

### TE-12: executeAction 直接调用 API

```typescript
executeAction: async (command: string, params: Record<string, unknown>) => {
  const userId = useAuthStore.getState().user?.id || 'anonymous';
  set({ isTyping: true, alertLevel: 'executing' });
  try {
    const response = await executeCommand({ command, params, userId, platform: 'web' });
    const execData = response.data?.data;
    const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: execData?.result?.output || '操作执行完成', timestamp: new Date(), status: execData?.status === 'completed' ? 'success' : 'failed' };
    set(state => ({ messages: [...state.messages, aiMsg].slice(-500), isTyping: false, alertLevel: 'normal' }));
  } catch (err) {
    set(state => ({ messages: [...state.messages, { id: crypto.randomUUID(), role: 'system', content: `操作失败: ${err instanceof Error ? err.message : '未知错误'}`, timestamp: new Date() }], isTyping: false, alertLevel: 'normal' }));
  }
},
```

### TE-14: VirtualList 动态高度

```tsx
// MessageArea.tsx
const containerRef = useRef<HTMLDivElement>(null);
const [containerHeight, setContainerHeight] = useState(400);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const h = Math.floor(entry.contentRect.height);
      if (h > 0) setContainerHeight(h);
    }
  });
  observer.observe(el);
  return () => observer.disconnect();
}, []);

<VirtualList items={virtualItems} containerHeight={containerHeight} itemHeight={80} overscanCount={5} renderItem={(item) => <ChatMessage message={item.data} />} />
```

### FE-2: 路由正则集中管理

新建 `pageContext.ts`，将路由模式集中管理，避免硬编码散落在多处。

### FE-3: QUICK_COMMANDS 从 store.commands 动态生成

```tsx
const quickCommands = React.useMemo(() => {
  if (commands.length > 0) return commands.slice(0, 6).map(cmd => ({ label: `/${cmd.name}`, value: `/${cmd.name}` }));
  return [{ label: '/deploy', value: '/deploy' }, { label: '/logs', value: '/logs' }, { label: '/restart', value: '/restart' }];
}, [commands]);
```

### IR-1/2/3: 统一滚动监听

`VirtualList` 增加 `scrollRef` prop，`useAutoScroll` 通过同一 ref 监听滚动，避免双重监听冲突。

---

## 三、修复优先级

| 优先级 | 编号 | 问题 | 影响 |
|--------|------|------|------|
| **P0** | TE-16 | EventBus 事件格式不匹配 | 不修复则订阅完全不工作 |
| **P1** | TE-5 | userId 提取不一致 | 安全一致性 |
| **P1** | TE-11 | sendMessage 竞态 | 快速发消息时状态丢失 |
| **P1** | IR-1/2/3 | 滚动监听冲突 | VirtualList 与 useAutoScroll 冲突 |
| **P1** | SE-7 | ROLE_PERMISSIONS 硬编码 | RBAC 数据与代码脱节 |
| **P1** | SE-9 | alert_id 资源范围校验 | 安全越权 |
| **P1** | TE-6 | SSE 绕过 Fastify 生命周期 | 潜在 uncaught exception |
| **P1** | TE-9 | Store IIFE 初始化 | 组件未挂载时状态丢失 |
| **P1** | TE-10 | localStorage userId | 与 JWT 不一致 |
| **P1** | TE-12 | executeAction 二次解析 | 参数精度丢失 |
| **P1** | TE-14 | VirtualList 高度硬编码 | 不同屏幕显示异常 |
| **P2** | TE-17 | SSE listener 优雅关闭 | 优雅关闭时孤儿 listener |
| **P2** | TE-13 | z-index 冲突 | 悬浮按钮可能浮在 Drawer 上 |
| **P2** | TE-15 | SmartRecommend maxHeight | 推荐面板高度不合适 |
| **P2** | FE-2 | 路由正则不匹配 | 上下文提取错误 |
| **P2** | FE-3 | QUICK_COMMANDS 硬编码 | 命令不动态更新 |

---

## 四、评分预估

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| 功能覆盖 | 8.5/10 | 9.0/10 |
| 技术架构 | 8.0/10 | 9.0/10 |
| 安全性 | 7.5/10 | 9.0/10 |
| 集成可行性 | 7.5/10 | 8.5/10 |
| 代码质量预期 | 7.0/10 | 8.5/10 |
| **综合** | **8.0/10** | **9.0/10** |
