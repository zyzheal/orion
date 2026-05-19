# AI Agent 增强 DevOps 系统 - 项目进度

**更新日期**: 2026-05-19
**当前状态**: 设计阶段

---

## 一、已完成文档

| 文档 | 路径 | 状态 | 说明 |
|------|------|------|------|
| 低代码平台详细设计 | `docs/superpowers/specs/2026-05-19-lowcode-platform-detailed-design.md` | ✅ 完成 | 附录A：底层架构设计，附录B：集成方案 |
| AI Agent 增强六大模块（初版） | `docs/superpowers/specs/2026-05-19-ai-agent-enhancement-six-modules.md` | ✅ 完成 | 10个Agent详细设计 |
| AI Agent 配置化集成方案 | `docs/superpowers/specs/2026-05-19-ai-agent-config-integration.md` | ✅ 完成 | 非侵入式配置设计 |
| AI Agent 冲突分析 | `docs/superpowers/specs/2026-05-19-ai-agent-conflict-analysis.md` | ✅ 完成 | 8个冲突点分析 |
| **AI Agent 增强最终方案** | `docs/superpowers/specs/2026-05-19-ai-agent-enhancement-final.md` | ✅ 完成 | 修正冲突后的完整设计 |

---

## 二、冲突修正总结

| # | 冲突项 | 严重程度 | 修正方案 |
|---|--------|---------|---------|
| 1 | 配置结构不一致 | Critical | 在 `UnifiedConfigService` 新增 `aiAgents` 段 |
| 2 | 事件体系重复 | Critical | 复用现有 `PipelineEventType.RunFailed` |
| 3 | 审计表重复 | Critical | 扩展 `llm_traces` 表 |
| 4 | 场景路由重复 | Important | 扩展现有 `ScenarioRouter.ts` |
| 5 | 成本限制重复 | Important | 复用 `CostTracker` |
| 6 | 通知渠道重复 | Important | 复用 `notification.channels.wechat` |
| 7 | 路由注册不一致 | Minor | 在 `routes.ts` 统一注册 |
| 8 | 环境变量风格 | Minor | 保持 `AI_AGENT_` 前缀 |

---

## 三、实施计划

### Week 1: 基础设施
- [ ] 扩展 UnifiedConfigService 新增 aiAgents 配置段
- [ ] 扩展 llm_traces 表加 3 个字段（agent_id, agent_input, agent_output）
- [ ] 扩展 ScenarioRouter 添加 9 个 Agent 场景规则
- [ ] 实现 BaseAgent 抽象基类
- [ ] 实现 AIGatewayAdapter 适配层

### Week 2-3: P0 Agent
- [ ] PipelineYamlAgent（自然语言→YAML）
- [ ] RootCauseAgent（根因分析）

### Week 4-5: P1 Agent
- [ ] AlertClassifyAgent（告警归类）
- [ ] PerfOptAgent（性能优化）
- [ ] ReleaseDiffAgent（版本差异）

### Week 6-7: P2 Agent
- [ ] AutoFixAgent（自动修复）
- [ ] ReleaseNotesAgent（发布说明）
- [ ] AlertMergeAgent（告警合并）
- [ ] RAGKnowledgeAgent（RAG知识库）
- [ ] WeComBotAdapter（企微机器人）

---

## 四、关键技术设计

### 4.1 Agent 基类接口
```typescript
abstract class BaseAgent {
  config: AgentConfig;
  execute<TInput, TOutput>(input: TInput, context: AgentExecutionContext): Promise<TOutput>;
  isEnabled(): boolean;
  protected callAI(prompt: string, temperature?: number): Promise<string>;
}
```

### 4.2 配置结构
```typescript
interface SystemConfig {
  // ... 现有配置
  aiAgents: {
    enabled: boolean;
    agents: {
      'pipeline-yaml': AgentRuntimeConfig;
      'root-cause': AgentRuntimeConfig;
      // ...
    };
    global: { maxTokensPerDay: number; maxCostPerDay: number; };
  };
}
```

### 4.3 场景路由
- `agent:pipeline-yaml` → sonnet-4-6
- `agent:root-cause` → opus-4-6
- `agent:alert-classify` → haiku-4-5
- 等9个场景

### 4.4 事件订阅
```typescript
eventBus.subscribe(PipelineEventType.RunFailed, async (event) => {
  const agent = agentRegistry.get('root-cause');
  await agent.handlePipelineFailed(event.data.runId);
});
```

---

## 五、待处理任务

1. 设计文档评审（已触发 `/requesting-code-review`）
2. 基础设施代码实现（Week 1）
3. 首个Agent开发（PipelineYamlAgent）
4. 数据库Migration编写

---

## 六、依赖关系

- **前置依赖**: AIGateway（已有）、ScenarioRouter（已有）、LLMTrace（已有）、EventBus（已有）
- **不依赖**: 不修改任何现有业务模块代码

---

*进度文档由 AI Agent 自动维护*