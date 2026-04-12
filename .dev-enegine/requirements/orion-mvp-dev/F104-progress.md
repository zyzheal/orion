# F104 - WebSocket 认证与心跳实现进度

## 实现时间
2026-04-12

## 实现状态
✅ 完成

## 实现内容

### 1. 认证 Store 增强 (`src/stores/authStore.ts`)

**新增功能**:
- `accessToken`: string | null - JWT Access Token
- `refreshToken`: string | null - Refresh Token
- `tokenExpiresAt`: number | null - Token 过期时间
- `setTokens(accessToken, refreshToken, expiresAt)`: 设置并持久化 Token
- `getToken()`: Promise<string | null> - 获取有效 Token（自动刷新过期 Token）
- `refreshAuthToken()`: Promise<string | null> - 刷新 Token
- `isTokenExpiring()`: boolean - 检测 Token 是否即将过期（5 分钟内）

**持久化机制**:
- Token 存储到 localStorage
- Key: `access_token`, `refresh_token`, `token_expires_at`

### 2. WebSocket Store (`src/stores/webSocketStore.ts`) - 新建

**状态管理**:
- `connectionState`: ConnectionState - 连接状态（disconnected/connecting/connected/reconnecting/error/closed）
- `error`: Error | null - 当前错误
- `stats`: WebSocketStats - 统计信息

**统计信息**:
- `reconnectAttempts`: 重连尝试次数
- `messagesSent`: 已发送消息数
- `messagesReceived`: 已接收消息数
- `lastMessageTime`: 最后消息时间
- `lastPongTime`: 最后 Pong 响应时间

### 3. useWebSocket Hook (`src/hooks/useWebSocket.ts`) - 新建

**核心功能**:
- 自动认证：从 authStore 获取 Token 并注入 WebSocket URL
- 指数退避重连：1s → 2s → 4s → ... → 30s（最多加上±20% 抖动）
- 心跳保活：30 秒间隔发送 ping，10 秒超时检测
- 消息队列：断线时消息入队，重连后自动发送
- 状态管理：集成 Zustand store

**配置选项**:
```typescript
interface UseWebSocketOptions {
  url: string;
  enabled?: boolean;
  protocols?: string[];
  backoff?: Partial<BackoffConfig>;
  heartbeat?: Partial<HeartbeatConfig>;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: ConnectionState) => void;
}
```

**默认配置**:
- Backoff: initialDelay=1s, maxDelay=30s, multiplier=2, jitter=0.2, maxAttempts=10
- Heartbeat: interval=30s, timeout=10s, maxMissed=3

### 4. API 层更新 (`src/api/auth.ts`)

**新增函数**:
- `refreshAuthToken(refreshToken)`: 简化 Token 刷新调用

### 5. 导出索引

**新建**:
- `src/hooks/index.ts` - Hooks 导出
- `src/stores/index.ts` - Stores 导出

### 6. 测试覆盖

**authStore.test.ts** - 新增测试:
- ✅ setTokens 并持久化到 localStorage
- ✅ getToken 未过期场景
- ✅ getToken 无 Token 场景
- ✅ isTokenExpiring 检测
- ✅ logout 清除 localStorage

**测试结果**:
```
Test Suites: 1 passed
Tests:       9 passed
```

## 消息队列实现

```typescript
class MessageQueue {
  enqueue(message): boolean    // 消息入队
  dequeue(): Message | null    // 消息出队
  requeue(message): boolean    // 重新入队（发送失败）
  size(): number               // 队列大小
  clear(): void                // 清空队列
}
```

**队列特性**:
- 最大队列大小：100
- 消息最大存活时间：5 分钟
- 最大重试次数：3 次

## 事件处理

### 心跳机制
```
Client Ping (30s interval) → Server Pong
           ↓
    [10s timeout]
           ↓
    missedHeartbeats++
           ↓
    [maxMissed=3]
           ↓
    触发重连
```

### 认证过期处理
```
Server: { type: 'auth_expired' }
    ↓
Client: refreshAuthToken()
    ↓
可选：重连更新认证
```

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /auth/refresh | 刷新 Token |

## 使用示例

```typescript
import { useWebSocket } from '@/hooks';

function Dashboard() {
  const ws = useWebSocket({
    url: 'wss://api.example.com/ws',
    enabled: true,
    onMessage: (msg) => console.log('Received:', msg),
    onError: (err) => console.error('Error:', err),
  });

  return (
    <div>
      <span>Status: {ws.connectionState}</span>
      <button onClick={() => ws.sendMessage({ type: 'ping' })}>
        Send Ping
      </button>
    </div>
  );
}
```

## 测试结果

```
Test Suites: 7 passed, 2 failed (与 F104 无关的既有失败)
Tests:       37 passed
```

## 后续工作

- 在 Dashboard 页面实际集成测试
- 与后端 WebSocket 服务器联调
- 监控生产环境连接稳定性
