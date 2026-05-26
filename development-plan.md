# Orion平台开发计划 - 自动执行

## 当前状态
- **分支**: feat/metric-collector-postgres-persistence
- **待提交变更**: 31.6KB（设计约束相关文件）
- **评审结果**: 
  - P0问题: 3处日志脱敏 + 12个页面交互链缺失
  - P1问题: 消息队列未实现 + 缓存策略缺失
  - P2问题: CI/CD增强 + 容灾恢复设计

## Phase 1: P0级别修复（立即执行）

### 任务1.1: 日志脱敏修复
**目标**: 修复3处敏感信息泄露问题
**文件**: 
- orion-platform-service/src/services/user-service.ts
- orion-platform-service/src/services/ticket-service.ts  
- orion-platform-service/src/services/notification-service.ts

**修复内容**:
```typescript
// 修复前: logger.info(user.phone)
// 修复后: logger.info({traceId, tenantId}, '用户手机号', {phone: user.phone ? '***' : ''})
```

**验证**: design-constraint --verify 后端服务

### 任务1.2: 交互链完整性修复
**目标**: 补充12个页面的loading状态、错误反馈、编辑入口
**文件**:
- orion-frontend/src/pages/TicketList/index.tsx
- orion-frontend/src/pages/UserManagement/index.tsx
- orion-frontend/src/pages/WorkflowCanvas/index.tsx
- orion-frontend/src/pages/DashboardNew/index.tsx
- orion-frontend/src/pages/Console/index.tsx
- orion-frontend/src/pages/SubApps/index.tsx
- orion-frontend/src/pages/monitor-svc/Monitoring/index.tsx
- orion-frontend/src/pages/security-svc/Diagnostic/index.tsx
- orion-frontend/src/pages/TicketDetail/index.tsx
- orion-frontend/src/pages/test-selector/index.tsx
- orion-frontend/src/pages/artifact-version/index.tsx

**修复内容**:
```typescript
// 添加loading状态
const [loading, setLoading] = useState(false);

// 添加错误处理
try {
  setLoading(true);
  const result = await apiCall();
  message.success('操作成功');
} catch (error) {
  message.error('操作失败: ' + error.message);
} finally {
  setLoading(false);
}

// 添加编辑入口
<Table
  rowKey="id"
  columns={[
    { title: '操作', render: (_, record) => (
      <Space>
        <Button type="link" onClick={() => handleEdit(record)}>编辑</Button>
        <Button type="link" danger onClick={() => handleDelete(record)}>删除</Button>
      </Space>
    )}
  ]}
/>
```

**验证**: design-constraint --verify 前端页面

### 任务1.3: 熔断器实现
**目标**: 基于Netflix Hystrix模式实现熔断器
**文件**: orion-platform-service/src/middleware/circuit-breaker.ts

**实现内容**:
```typescript
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold = 5;
  private readonly timeout = 30000; // 30秒

  async execute<T>(fn: () => Promise<T>, timeoutMs: number = 5000): Promise<T> {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime < this.timeout) {
      throw new OrionError('CIRCUIT.OPEN', '熔断器已打开，请稍后再试');
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        )
      ]);
      
      this.reset();
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.open();
      }
      throw error;
    }
  }

  private open() {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
  }

  private reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
}
```

**集成**: 在关键API调用处使用
```typescript
const circuitBreaker = new CircuitBreaker();
try {
  const result = await circuitBreaker.execute(() => userService.getUser(id));
} catch (error) {
  // 处理熔断
}
```

**验证**: 错误率>5%自动熔断

## Phase 2: P1级别优化（并行执行）

### 任务2.1: 消息队列实现
**目标**: 基于阿里SOFAStack模式实现事件总线
**文件**: orion-platform-service/src/events/event-bus.ts

**实现内容**:
```typescript
export class EventBus {
  private subscribers: Map<string, Function[]> = new Map();
  private deadLetterQueue: any[] = [];

  subscribe(eventType: string, handler: Function) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
  }

  publish(event: any) {
    const eventType = event.type;
    const handlers = this.subscribers.get(eventType) || [];
    
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        this.deadLetterQueue.push({ event, error, handler });
      }
    });
  }

  processDeadLetterQueue() {
    // 实现死信队列处理逻辑
  }
}

// 使用示例
eventBus.subscribe('pipeline.completed', (event) => {
  // 处理流程完成事件
});
```

**验证**: 消息可靠性99.9%

### 任务2.2: 缓存策略优化
**目标**: Redis缓存热点查询，防穿透/雪崩
**文件**: orion-platform-service/src/services/cache-service.ts

**实现内容**:
```typescript
export class CacheService {
  private redis: Redis;

  async getHotData(key: string, fetchFn: () => Promise<any>, ttl: number = 300): Promise<any> {
    // 防穿透：空值缓存
    const cached = await this.redis.get(key);
    if (cached !== null) {
      return cached === 'null' ? null : JSON.parse(cached);
    }

    // 防雪崩：随机过期时间
    const result = await fetchFn();
    const actualTtl = ttl + Math.floor(Math.random() * 60); // 300-360秒随机
    
    await this.redis.set(key, JSON.stringify(result), 'EX', actualTtl);
    return result;
  }

  async batchGet(keys: string[]): Promise<(string | null)[]> {
    // 批量获取，减少RTT
    return this.redis.mget(...keys);
  }
}
```

**验证**: 缓存命中率>80%

## Phase 3: P2级别增强（后续执行）

### 任务3.1: CI/CD增强
**目标**: 添加蓝绿部署和自动回滚
**文件**: .github/workflows/deploy.yml

**实现内容**:
```yaml
name: Blue-Green Deployment

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v2
      
    - name: Build
      run: npm run build
      
    - name: Deploy to blue environment
      run: |
        curl -X POST $ORION_API/deploy -d '{"env":"blue","version":"$GITHUB_SHA"}'
        
    - name: Health check
      run: |
        curl -f $ORION_API/healthz
        
    - name: Switch traffic
      run: |
        curl -X POST $ORION_API/traffic -d '{"from":"green","to":"blue"}'
        
    - name: Monitor
      run: |
        # 监控5分钟，失败则回滚
        timeout 300 bash -c "
          while true; do
            if ! curl -f $ORION_API/healthz; then
              curl -X POST $ORION_API/traffic -d '{"from":"blue","to":"green"}'
              exit 1
            fi
            sleep 10
          done
        "
```

**验证**: 回滚成功率100%

## 执行流程

1. **立即开始**: 从Phase 1的P0任务开始
2. **并行开发**: Phase 1的P0任务可以并行执行
3. **自动化验证**: 每个任务完成后运行design-constraint CLI验证
4. **规范遵循**: 所有代码修改必须遵循Orion规范

## 验证门控

每个任务完成后必须通过以下验证：
- ✅ design-constraint --verify (前端/后端)
- ✅ Orion规范合规检查
- ✅ 交互链8项检查通过
- ✅ 无新增P0/P1问题

开始执行Phase 1任务...