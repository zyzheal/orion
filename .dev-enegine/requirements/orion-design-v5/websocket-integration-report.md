# WebSocket 前后端联调报告

## 测试日期
2026-04-12

## 测试范围
- 连接认证流程验证
- Token 刷新流程验证
- 心跳机制联调
- 重连策略验证
- 消息队列持久化测试
- 消息协议验证
- 状态同步测试

## 测试结果汇总

### 后端测试 (Jest)

| 测试文件 | 测试数量 | 通过 | 失败 |
|---------|---------|------|------|
| ws-auth.test.ts | 9 | 9 | 0 |
| ws-heartbeat.test.ts | 8 | 8 | 0 |
| ws-integration.test.ts | 8 | 8 | 0 |
| **总计** | **25** | **25** | **0** |

### 前端测试 (Vitest)

| 测试文件 | 测试数量 | 通过 | 失败 | 跳过 |
|---------|---------|------|------|------|
| ws-client.test.ts | 9 | 9 | 0 | 0 |
| ws-integration.test.ts | 21 | 19 | 0 | 2 |
| **总计** | **30** | **28** | **0** | **2** |

## 功能验证详情

### 1. 连接认证测试
- [x] Token 从 Query 参数提取 (`?token=xxx`)
- [x] Token 从 Sec-WebSocket-Protocol 头提取 (Bearer 格式)
- [x] Token 从 Sec-WebSocket-Protocol 头提取 (JWT 直接格式)
- [x] 无 Token 时返回 401 Unauthorized
- [x] Token 验证成功返回用户 payload
- [x] Token 过期返回 4003 错误码

### 2. 心跳机制测试
- [x] 心跳启动/停止
- [x] missedPongs 计数器重置
- [x] 多次丢失 pong 触发 timeout
- [x] 连接管理器添加/获取连接
- [x] 连接管理器移除连接
- [x] 发送消息到指定客户端
- [x] 广播消息给所有客户端

### 3. 重连策略测试
- [x] 指数退避算法正确计算延迟
- [x] 重连次数有限制 (默认 10 次)
- [x] 重连状态正确传递给 Store
- [x] 连接成功后重连计数重置

### 4. 消息队列测试
- [x] 未连接时消息被队列化
- [x] 连接后发送队列中的消息
- [x] 消息队列大小限制 (默认 100)

### 5. 消息协议验证
- [x] 欢迎消息格式: `{ type: 'connected', clientId, userId, timestamp }`
- [x] Ping/Pong 格式: `{ type: 'ping/pong', timestamp }`
- [x] 错误码统一:
  - UNAUTHORIZED: 4001
  - INVALID_TOKEN: 4002
  - TOKEN_EXPIRED: 4003
  - RATE_LIMITED: 4004

### 6. WebSocketStore 状态同步
- [x] connectionState 正确更新
- [x] 统计信息正确累加
- [x] 重连计数在连接成功后重置

## 问题修复记录

### 修复 1: ws-client.ts 语法错误
**文件**: `orion-frontend/src/websocket/ws-client.ts`
**问题**: 第 129 行缺少箭头函数的箭头 `=>`
**修复**: `this.ws.onclose = (event) => this.handleClose(event);`

### 修复 2: ws-heartbeat.test.ts 类型错误
**文件**: `orion-api-gateway/src/websocket/__tests__/ws-heartbeat.test.ts`
**问题**: MockWebSocket 类缺少 WebSocket 必要属性
**修复**: 添加 binaryType、bufferedAmount、extensions 等必要属性

### 修复 3: ws-auth.test.ts 类型错误
**文件**: `orion-api-gateway/src/websocket/__tests__/ws-auth.test.ts`
**问题**: mockApp.jwt 可能为 undefined
**修复**: 使用 `mockApp.jwt!.verify` 非空断言

### 修复 4: ws-client.test.ts 全局模拟问题
**文件**: `orion-frontend/src/websocket/__tests__/ws-client.test.ts`
**问题**: Vitest 中 global.WebSocket 是只读属性
**修复**: 使用 `vi.stubGlobal('WebSocket', MockWebSocket)` 替代直接赋值

## 最佳实践建议

### 1. Token 管理
- 建议使用 Query 参数方式传递 Token，更简单直接
- Token 过期后应触发重新认证流程，前端需要监听 4003 错误码

### 2. 心跳配置
- 前端和后端心跳间隔应保持一致 (30s)
- 服务端超时时间应小于客户端心跳间隔 (15s < 30s)

### 3. 重连策略
- 指数退避算法: `delay = base * 2^(attempt-1) + jitter`
- 建议最大延迟设置为 30 秒，避免过长等待
- 添加随机抖动 (0-1s) 防止重连风暴

### 4. 消息队列
- 建议设置队列大小上限 (100 条)，避免内存溢出
- 队列消息应在连接成功后立即发送

### 5. 状态管理
- 使用 Zustand 的 subscribeWithSelector 监听状态变化
- 统计信息应实时更新，便于监控

## 测试命令

### 后端测试
```bash
cd orion-api-gateway
npm test -- --testPathPattern="websocket"
```

### 前端测试
```bash
cd orion-frontend
npm test -- --run src/websocket/__tests__
```

## 结论
WebSocket 前后端联调验证完成，所有核心功能测试通过。消息协议一致性已验证，状态同步机制正常工作。