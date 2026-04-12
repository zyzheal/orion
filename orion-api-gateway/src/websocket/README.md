/**
 * WebSocket 功能使用文档
 *
 * F104 - WebSocket 认证与心跳功能
 */

# WebSocket 使用指南

## 概述

Orion 平台提供了完整的 WebSocket 支持，包括：
- 基于 JWT 的认证机制
- 30 秒心跳保活
- 指数退避自动重连
- 内存泄漏防护

## 服务端（Node.js）

### 文件结构

```
orion-api-gateway/src/websocket/
├── ws-server.ts        # WebSocket 服务器主文件
├── ws-auth.ts          # 认证处理器
├── ws-heartbeat.ts     # 心跳机制
├── ws-errors.ts        # 错误码定义
└── __tests__/          # 单元测试
```

### 认证方式

支持两种 Token 传递方式：

1. **Query 参数**（推荐）
   ```
   ws://localhost:3000/ws?token=<jwt_token>
   ```

2. **Sub-protocol 头**
   ```javascript
   const ws = new WebSocket('ws://localhost:3000/ws', 'Bearer <jwt_token>');
   ```

### 心跳机制

- 服务端每 30 秒发送 ping
- 客户端需在 15 秒内响应 pong
- 允许丢失 2 次 pong，超过则断开连接

### 错误码

| 错误码 | 含义 |
|--------|------|
| 4001 | 需要认证 |
| 4002 | 认证失败 |
| 4003 | Token 过期 |
| 4004 | Token 无效 |
| 4009 | 心跳超时 |

## 客户端（Frontend）

### 文件结构

```
orion-frontend/src/websocket/
├── ws-client.ts        # WebSocket 客户端 SDK
├── index.ts            # 导出文件
└── __tests__/          # 单元测试
```

### 基本使用

```typescript
import { createWebSocketClient, getWebSocketClient } from '@/websocket';

// 创建客户端实例
const client = createWebSocketClient({
  url: 'ws://localhost:3000/ws',
  accessToken: 'your-jwt-token', // 可选，从 localStorage 获取
  reconnectEnabled: true,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
  onMessage: (data) => {
    console.log('Received:', data);
  },
  onStateChange: (state) => {
    console.log('State changed:', state);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});

// 获取客户端实例（单例）
const existingClient = getWebSocketClient();

// 发送消息
client.send({ type: 'message', data: 'Hello Server!' });

// 断开连接
client.disconnect();

// 销毁实例
client.destroy();
```

### 连接状态

```typescript
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
```

### 自动重连

客户端内置指数退避重连算法：

- 初始延迟：1 秒
- 最大延迟：30 秒
- 重连次数：10 次
- 计算公式：`delay = base * 2^(attempt-1) + jitter`

### Token 管理

```typescript
// 设置 Token
client.setAccessToken('new-token');

// Token 会自动从 localStorage 获取（如果创建时未提供）
const client = createWebSocketClient({
  url: 'ws://localhost:3000/ws',
  // accessToken 可选，未提供则从 localStorage.getItem('access_token') 获取
});
```

### 与 React 集成

```typescript
import { useEffect, useRef } from 'react';
import { createWebSocketClient } from '@/websocket';

function MyComponent() {
  const clientRef = useRef<ReturnType<typeof createWebSocketClient> | null>(null);

  useEffect(() => {
    // 创建客户端
    clientRef.current = createWebSocketClient({
      url: 'ws://localhost:3000/ws',
      onMessage: (data) => {
        console.log('Received:', data);
      },
    });

    // 清理函数
    return () => {
      clientRef.current?.destroy();
    };
  }, []);

  return <div>...</div>;
}
```

### 内存泄漏防护

客户端自动处理以下清理工作：

1. **定时器清理** - disconnect/destroy 时清除所有定时器
2. **事件监听器清理** - 关闭时移除所有 WebSocket 监听器
3. **消息队列清理** - 销毁时清空消息队列

使用 React Hooks 时，务必在 `useEffect` 的清理函数中调用 `destroy()`。

## 消息格式

### 客户端发送

```typescript
// 普通消息
{
  type: 'message',
  data: { ... }
}

// Ping（心跳）
{
  type: 'ping',
  timestamp: number
}
```

### 服务端发送

```typescript
// 连接成功
{
  type: 'connected',
  clientId: string,
  userId: string,
  timestamp: number
}

// Pong（心跳响应）
{
  type: 'pong',
  timestamp: number
}

// 错误消息
{
  type: 'error',
  code: number,
  message: string,
  timestamp: number
}
```

## 单元测试

### 服务端测试

```bash
cd orion-api-gateway
npm test -- ws
```

### 前端测试

```bash
cd orion-frontend
npm test -- ws-client
```

## 常见问题

### Q: 连接失败如何处理？

A: 检查以下几点：
1. Token 是否有效
2. WebSocket 服务是否运行
3. 防火墙/代理是否允许 WebSocket 连接
4. 查看 `onError` 回调中的错误信息

### Q: 如何手动触发重连？

A: 调用 `disconnect()` 后再调用 `connect()`：
```typescript
client.disconnect();
client.connect();
```

### Q: 如何广播消息给所有客户端？

A: 在服务端使用 `wsServer.broadcast()`：
```typescript
wsServer.broadcast({
  type: 'announcement',
  data: 'Server maintenance in 5 minutes',
});
```

### Q: 如何获取当前连接数？

A: 在服务端调用：
```typescript
const count = wsServer.getConnectionCount();
```

## 参考文档

- [F104 需求文档](../../docs/requirements/F104-WebSocket 认证与心跳.md)
- [RFC 6455 - The WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
- [jwt.io - JWT 介绍](https://jwt.io/)
