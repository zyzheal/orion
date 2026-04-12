# 自愈引擎 5-Agent 协作设计

> 版本：v1.0  
> 创建日期：2026-04-11  
> 负责人：SRE 团队 + AI 团队  
> 优先级：P0  
> 状态：设计完成

---

## 1. 概述

### 1.1 背景

Orion 自愈引擎 (代号 Kintsugi) 采用多 Agent 协作架构，实现从故障检测到修复验证的全自动闭环。

### 1.2 设计目标

- **自动化率 > 80%**：常见故障无需人工干预
- **MTTR < 5 分钟**：从故障发生到恢复平均 5 分钟内
- **误操作率 < 1%**：修复操作准确率 > 99%
- **人在环路**：高危操作需人工审批

---

## 2. 5-Agent 架构

### 2.1 Agent 总览

```
┌─────────────────────────────────────────────────────────────────┐
│                   自愈引擎 5-Agent 协作架构                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   故障事件                                                        │
│      │                                                          │
│      ▼                                                          │
│ ┌────────────────┐                                              │
│ │ Monitor Agent  │  职责：故障检测与告警聚合                      │
│ │ (监控 Agent)    │  • 实时指标监控 (Prometheus)                 │
│ │                │  • 告警聚合去噪 (DBSCAN)                     │
│ │                │  • 异常事件生成                               │
│ └───────┬────────┘                                              │
│         │                                                       │
│         │ 异常事件                                               │
│         ▼                                                       │
│ ┌────────────────┐                                              │
│ │ Diagnose Agent │  职责：根因定位与诊断分析                      │
│ │ (诊断 Agent)    │  • PageRank 根因定位                          │
│ │                │  • 日志模式识别 (NLP)                        │
│ │                │  • 生成诊断报告                               │
│ └───────┬────────┘                                              │
│         │                                                       │
│         │ 诊断报告 (含根因 + 影响面)                               │
│         ▼                                                       │
│ ┌────────────────┐                                              │
│ │ Decide Agent   │  职责：修复方案生成与决策                      │
│ │ (决策 Agent)    │  • 匹配历史解决方案 (RAG)                    │
│ │                │  • 生成 Top3 修复方案                         │
│ │                │  • 计算成功率与风险评估                       │
│ └───────┬────────┘                                              │
│         │                                                       │
│         │ 修复方案 + 审批请求                                     │
│         ▼                                                       │
│ ┌────────────────┐                                              │
│ │ Execute Agent  │  职责：修复执行与流程控制                      │
│ │ (执行 Agent)    │  • 沙箱验证                                   │
│ │                │  • 分阶段执行                                 │
│ │                │  • 执行过程监控                               │
│ └───────┬────────┘                                              │
│         │                                                       │
│         │ 执行结果                                               │
│         ▼                                                       │
│ ┌────────────────┐                                              │
│ │ Verify Agent   │  职责：效果验证与知识沉淀                      │
│ │ (验证 Agent)    │  • 健康检查验证                              │
│ │                │  • 业务指标恢复确认                           │
│ │                │  • 生成 Postmortem 报告                        │
│ │                │  • 知识库更新                                 │
│ └────────────────┘                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Agent 状态机

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent 协作状态机                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IDLE ──[故障检测]──> DETECTING                                 │
│                         │                                       │
│                         │ [检测到异常]                           │
│                         ▼                                       │
│                    DIAGNOSING ──[诊断完成]──> DECIDING          │
│                                    │                            │
│                                    │ [生成方案]                 │
│                                    ▼                            │
│                              PENDING_APPROVAL                   │
│                                    │                            │
│                                    │ [审批通过]                 │
│                                    ▼                            │
│                              VERIFYING_SANDBOX                  │
│                                    │                            │
│                                    │ [沙箱验证通过]              │
│                                    ▼                            │
│                              EXECUTING ──[执行完成]──> VERIFYING│
│                                    │                            │
│                                    │ [验证成功]                 │
│                                    ▼                            │
│                                    COMPLETED                    │
│                                                                 │
│  异常流转：                                                      │
│  • 任何状态 ──[检测误报]──> IDLE                                │
│  • 沙箱验证失败 ──> DECIDING (重新生成方案)                      │
│  • 执行失败 ──> EXECUTING (重试，最多 3 次)                        │
│  • 验证失败 ──> EXECUTING (回滚)                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent 详细设计

### 3.1 Monitor Agent (监控 Agent)

```python
class MonitorAgent:
    """
    故障检测与告警聚合 Agent
    """
    
    def __init__(self):
        self.prometheus_client = PrometheusClient()
        self.dbscan_cluster = DBSCAN(eps=0.5, min_samples=3)
        self.baseline_detector = DynamicBaselineDetector()
    
    async def detect_anomaly(self, metric: str, service: str) -> Optional[AnomalyEvent]:
        """
        检测指标异常
        """
        # 1. 获取实时指标
        metrics = await self.prometheus_client.query(
            query=f'{metric}{{service="{service}"}}',
            range='5m',
            step='15s'
        )
        
        # 2. 动态基线检测
        anomaly_result = self.baseline_detector.detect(
            value=metrics.current,
            timestamp=metrics.timestamp
        )
        
        # 3. 生成异常事件
        if anomaly_result['anomaly']:
            return AnomalyEvent(
                service=service,
                metric=metric,
                current_value=metrics.current,
                baseline_mean=anomaly_result['mean'],
                baseline_std=anomaly_result['std'],
                z_score=anomaly_result['z_score'],
                severity=self._calculate_severity(anomaly_result['z_score']),
                timestamp=metrics.timestamp
            )
        return None
    
    def aggregate_alerts(self, raw_alerts: List[Alert]) -> List[AlertGroup]:
        """
        告警聚合去噪 (减少 80% 重复告警)
        """
        if len(raw_alerts) < 3:
            return [AlertGroup([a]) for a in raw_alerts]
        
        # 使用 DBSCAN 聚类
        features = self._extract_features(raw_alerts)
        clusters = self.dbscan_cluster.fit_predict(features)
        
        # 分组
        groups = {}
        for alert, cluster in zip(raw_alerts, clusters):
            if cluster not in groups:
                groups[cluster] = AlertGroup([])
            groups[cluster].add(alert)
        
        return list(groups.values())
    
    def _calculate_severity(self, z_score: float) -> str:
        if z_score > 5:
            return "P0"
        elif z_score > 3:
            return "P1"
        elif z_score > 2:
            return "P2"
        else:
            return "P3"
```

---

### 3.2 Diagnose Agent (诊断 Agent)

```python
class DiagnoseAgent:
    """
    根因定位与诊断分析 Agent
    """
    
    def __init__(self):
        self.graph_db = Neo4jClient()
        self.nlp_encoder = SentenceTransformer('all-MiniLM-L6-v2')
        self.loki_client = LokiClient()
    
    async def find_root_cause(self, anomaly: AnomalyEvent) -> DiagnosisReport:
        """
        使用 PageRank 算法在反向服务调用图上定位根因
        """
        # 1. 获取服务调用图
        service_graph = await self._build_service_graph(anomaly.service)
        
        # 2. 计算异常分数 (从异常服务向外扩散)
        anomaly_scores = await self._calculate_anomaly_scores(
            graph=service_graph,
            seed_service=anomaly.service,
            seed_severity=anomaly.severity
        )
        
        # 3. 运行 Personalized PageRank (反向图)
        reverse_graph = service_graph.reverse()
        pagerank_scores = nx.pagerank(
            reverse_graph,
            personalization=anomaly_scores,
            alpha=0.85,
            max_iter=100
        )
        
        # 4. 获取 Top 3 疑似根因
        top_causes = sorted(
            pagerank_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]
        
        # 5. 分析日志模式
        log_patterns = await self._analyze_logs(
            services=[cause[0] for cause in top_causes],
            time_range=anomaly.timestamp - timedelta(minutes=15)
        )
        
        return DiagnosisReport(
            root_cause=top_causes[0][0],
            confidence=top_causes[0][1],
            all_causes=top_causes,
            log_patterns=log_patterns,
            impact_analysis=await self._analyze_impact(top_causes[0][0])
        )
    
    async def _analyze_logs(self, services: List[str], time_range: datetime) -> List[LogPattern]:
        """
        使用 NLP 分析异常日志模式
        """
        patterns = []
        for service in services:
            logs = await self.loki_client.query(
                query=f'{{service="{service}"}} |= "error" |="exception"',
                start=time_range,
                limit=1000
            )
            
            # 日志聚类
            embeddings = self.nlp_encoder.encode([log.message for log in logs])
            clusters = KMeans(n_clusters=5).fit_predict(embeddings)
            
            # 提取每类的代表模式
            for cluster_id in set(clusters):
                cluster_logs = [logs[i] for i in range(len(logs)) if clusters[i] == cluster_id]
                patterns.append(LogPattern(
                    service=service,
                    pattern=self._extract_pattern(cluster_logs),
                    count=len(cluster_logs),
                    first_seen=min(log.timestamp for log in cluster_logs)
                ))
        
        return sorted(patterns, key=lambda p: p.count, reverse=True)
```

---

### 3.3 Decide Agent (决策 Agent)

```python
class DecideAgent:
    """
    修复方案生成与决策 Agent
    """
    
    def __init__(self):
        self.vector_db = ChromaClient()
        self.llm = LLMClient(model="qwen3.5-plus")
        self.risk_model = xgb.XGBClassifier()
    
    async def generate_solutions(self, diagnosis: DiagnosisReport) -> List[FixSolution]:
        """
        基于 RAG 检索历史解决方案，生成 Top3 修复方案
        """
        # 1. 检索相似历史案例
        similar_cases = await self.vector_db.query(
            collection="incident_solutions",
            query_embedding=self._encode_diagnosis(diagnosis),
            top_k=10
        )
        
        # 2. 提取解决方案模板
        solution_templates = self._extract_templates(similar_cases)
        
        # 3. 使用 LLM 生成定制方案
        prompt = self._build_generation_prompt(diagnosis, solution_templates)
        llm_response = await self.llm.generate(prompt)
        
        # 4. 解析方案
        candidate_solutions = self._parse_solutions(llm_response)
        
        # 5. 评估每个方案的成功率和风险
        for solution in candidate_solutions:
            solution.success_rate = await self._predict_success_rate(solution)
            solution.risk_level = self._assess_risk(solution)
        
        # 6. 返回 Top3
        return sorted(candidate_solutions, key=lambda s: s.success_rate, reverse=True)[:3]
    
    async def _predict_success_rate(self, solution: FixSolution) -> float:
        """
        使用 XGBoost 模型预测修复成功率
        """
        features = [
            solution.complexity,
            solution.affected_services_count,
            solution.is_rollback,
            solution.has_sandbox_validation,
            self.historical_success_rate(solution.action_type),
        ]
        
        return self.risk_model.predict_proba([features])[0][1]
    
    def _assess_risk(self, solution: FixSolution) -> RiskLevel:
        """
        评估修复操作的风险等级
        """
        risk_score = 0
        
        # 操作类型风险
        if solution.action_type in ["DDL", "流量切换", "回滚"]:
            risk_score += 40
        
        # 影响范围风险
        risk_score += min(solution.affected_services_count * 10, 30)
        
        # 时间风险 (业务高峰期风险更高)
        if self._is_business_peak_hour():
            risk_score += 20
        
        if risk_score >= 70:
            return RiskLevel.P0
        elif risk_score >= 50:
            return RiskLevel.P1
        elif risk_score >= 30:
            return RiskLevel.P2
        else:
            return RiskLevel.P3
```

---

### 3.4 Execute Agent (执行 Agent)

```python
class ExecuteAgent:
    """
    修复执行与流程控制 Agent
    """
    
    def __init__(self):
        self.sandbox_client = SandboxClient()
        self.k8s_client = KubernetesClient()
        self.approval_service = ApprovalService()
        self.audit_logger = AuditLogger()
    
    async def execute(self, solution: FixSolution, diagnosis: DiagnosisReport) -> ExecutionResult:
        """
        执行修复方案
        """
        # 1. 检查审批状态
        approval_required = self._check_approval_required(solution.risk_level)
        if approval_required:
            approval_status = await self.approval_service.wait_for_approval(
                request_id=solution.id,
                timeout=timedelta(hours=2)
            )
            if not approval_status.approved:
                return ExecutionResult(
                    success=False,
                    error="审批未通过",
                    details=approval_status.comments
                )
        
        # 2. 沙箱验证
        if solution.risk_level in [RiskLevel.P0, RiskLevel.P1]:
            sandbox_result = await self.sandbox_client.validate(solution)
            if not sandbox_result.success:
                return ExecutionResult(
                    success=False,
                    error="沙箱验证失败",
                    details=sandbox_result.output
                )
        
        # 3. 分阶段执行
        execution_steps = solution.get_execution_steps()
        for i, step in enumerate(execution_steps):
            step_result = await self._execute_step(step)
            
            if not step_result.success:
                # 执行失败，触发回滚
                rollback_result = await self._rollback(execution_steps[:i])
                return ExecutionResult(
                    success=False,
                    error=f"步骤 {i+1} 执行失败：{step_result.error}",
                    details=rollback_result
                )
            
            # 步骤间健康检查
            health_check = await self._health_check()
            if not health_check.healthy:
                rollback_result = await self._rollback(execution_steps[:i+1])
                return ExecutionResult(
                    success=False,
                    error="健康检查失败，已回滚",
                    details=health_check.details
                )
        
        return ExecutionResult(
            success=True,
            details="修复执行成功"
        )
    
    async def _execute_step(self, step: ExecutionStep) -> StepResult:
        """
        执行单步骤
        """
        try:
            if step.type == "kubectl":
                result = await self.k8s_client.run(step.command)
            elif step.type == "sql":
                result = await self.db_client.execute(step.command)
            elif step.type == "api":
                result = await self.http_client.post(step.url, json=step.payload)
            else:
                raise ValueError(f"未知步骤类型：{step.type}")
            
            return StepResult(success=True, output=result)
        except Exception as e:
            return StepResult(success=False, error=str(e))
    
    async def _rollback(self, executed_steps: List[ExecutionStep]) -> RollbackResult:
        """
        执行回滚 (按相反顺序执行回滚步骤)
        """
        rollback_steps = []
        for step in reversed(executed_steps):
            rollback_step = step.get_rollback_step()
            if rollback_step:
                rollback_steps.append(rollback_step)
        
        for step in rollback_steps:
            await self._execute_step(step)
        
        return RollbackResult(
            success=True,
            steps_executed=len(rollback_steps)
        )
```

---

### 3.5 Verify Agent (验证 Agent)

```python
class VerifyAgent:
    """
    效果验证与知识沉淀 Agent
    """
    
    def __init__(self):
        self.prometheus_client = PrometheusClient()
        self.postmortem_generator = PostmortemGenerator()
        self.vector_db = ChromaClient()
    
    async def verify_fix(self, execution: ExecutionResult, diagnosis: DiagnosisReport) -> VerificationResult:
        """
        验证修复效果
        """
        # 1. 等待系统稳定 (2 分钟)
        await asyncio.sleep(120)
        
        # 2. 健康检查
        health_checks = await self._run_health_checks(diagnosis.root_cause)
        if not all(check.passed for check in health_checks):
            return VerificationResult(
                success=False,
                reason="健康检查未通过",
                details=health_checks
            )
        
        # 3. 验证业务指标恢复
        metrics_recovery = await self._verify_metrics_recovery(
            service=diagnosis.root_cause,
            pre_incident_metrics=diagnosis.pre_incident_metrics,
            current_metrics=await self._get_current_metrics(diagnosis.root_cause)
        )
        
        if not metrics_recovery.recovered:
            return VerificationResult(
                success=False,
                reason=f"指标未恢复：{metrics_recovery.details}",
                details=metrics_recovery
            )
        
        # 4. 生成 Postmortem 报告
        postmortem = await self.postmortem_generator.generate(
            incident=diagnosis,
            fix=execution,
            verification=self
        )
        
        # 5. 更新知识库
        await self._update_knowledge_base(diagnosis, execution, postmortem)
        
        return VerificationResult(
            success=True,
            postmortem=postmortem,
            metrics_recovery=metrics_recovery
        )
    
    async def _verify_metrics_recovery(self, service: str, 
                                        pre: Metrics, 
                                        current: Metrics) -> MetricsRecovery:
        """
        验证关键指标是否恢复到正常范围
        """
        checks = [
            self._check_metric("error_rate", current.error_rate, max_value=pre.baseline_error_rate * 1.2),
            self._check_metric("latency_p99", current.latency_p99, max_value=pre.baseline_latency * 1.5),
            self._check_metric("success_rate", current.success_rate, min_value=0.99),
        ]
        
        all_passed = all(check.passed for check in checks)
        
        return MetricsRecovery(
            recovered=all_passed,
            checks=checks,
            details=", ".join([f"{c.name}: {'✓' if c.passed else '✗'}" for c in checks])
        )
```

---

## 4. Agent 间通信协议

### 4.1 事件定义

```python
@dataclass
class AnomalyEvent:
    """异常事件"""
    service: str
    metric: str
    current_value: float
    baseline_mean: float
    baseline_std: float
    z_score: float
    severity: str  # P0/P1/P2/P3
    timestamp: datetime

@dataclass
class DiagnosisReport:
    """诊断报告"""
    root_cause: str
    confidence: float
    all_causes: List[Tuple[str, float]]
    log_patterns: List[LogPattern]
    impact_analysis: ImpactAnalysis
    pre_incident_metrics: Metrics

@dataclass
class FixSolution:
    """修复方案"""
    id: str
    title: str
    description: str
    action_type: str
    steps: List[ExecutionStep]
    success_rate: float
    risk_level: RiskLevel
    affected_services: List[str]
    rollback_plan: RollbackPlan

@dataclass
class ExecutionResult:
    """执行结果"""
    success: bool
    error: Optional[str]
    details: Any
    duration_seconds: float
    executed_at: datetime

@dataclass
class VerificationResult:
    """验证结果"""
    success: bool
    reason: Optional[str]
    postmortem: Optional[Postmortem]
    metrics_recovery: Optional[MetricsRecovery]
```

### 4.2 通信流程

```
Monitor Agent ──AnomalyEvent──> Diagnose Agent
                                     │
                                     │ DiagnosisReport
                                     ▼
                              Decide Agent
                                     │
                                     │ List[FixSolution]
                                     ▼
                              Execute Agent
                                     │
                                     │ ExecutionResult
                                     ▼
                              Verify Agent
                                     │
                                     │ VerificationResult + Postmortem
                                     ▼
                              知识库更新
```

---

## 5. 自愈场景覆盖率

### 5.1 支持场景清单

| 场景 ID | 场景名称 | 自动化级别 | 预计覆盖率 |
|---------|---------|-----------|-----------|
| SH-01 | Pod 崩溃循环重启 | L3 (全自动) | 90% |
| SH-02 | 内存泄漏自动重启 | L3 (全自动) | 85% |
| SH-03 | 数据库连接池耗尽 | L2 (需审批) | 80% |
| SH-04 | 磁盘空间不足清理 | L3 (全自动) | 95% |
| SH-05 | 服务雪崩熔断 | L3 (全自动) | 90% |
| SH-06 | 流量突增自动扩容 | L2 (需审批) | 75% |
| SH-07 | 配置错误回滚 | L2 (需审批) | 85% |
| SH-08 | 部署失败回滚 | L2 (需审批) | 90% |
| SH-09 | 主从切换 | L1 (人工执行) | 60% |
| SH-10 | 依赖服务故障降级 | L2 (需审批) | 70% |

### 5.2 自愈成功率目标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| 自愈成功率 | > 80% | 成功修复次数 / 触发次数 |
| 误操作率 | < 1% | 导致问题的修复 / 总修复次数 |
| 平均修复时间 | < 5 分钟 | 从故障发生到验证通过 |
| 人工介入率 | < 20% | 需要人工审批或执行的次数占比 |

---

## 6. 配置示例

```yaml
# configs/self-healing.yaml
self_healing:
  enabled: true
  
  # Agent 配置
  agents:
    monitor:
      check_interval: 15s
      baseline_window: 24h
      anomaly_threshold: 3.0  # Z-Score 阈值
    
    diagnose:
      pagerank_iterations: 100
      pagerank_alpha: 0.85
      log_analysis_enabled: true
    
    decide:
      max_solutions: 3
      min_success_rate: 0.6
      rag_top_k: 10
    
    execute:
      sandbox_required_for: [P0, P1]
      max_retries: 3
      health_check_interval: 10s
    
    verify:
      wait_stabilization: 120s
      health_check_timeout: 30s
  
  # 场景开关
  scenarios:
    pod_restart:
      enabled: true
      auto_approve: true
      max_restarts: 3
    
    disk_cleanup:
      enabled: true
      auto_approve: true
      threshold_percent: 85
    
    deployment_rollback:
      enabled: true
      auto_approve: false  # 需要审批
      require_approver: ["team-lead", "sre"]
```

---

## 7. 总结

| 维度 | 详情 |
|------|------|
| Agent 数量 | 5 个 (Monitor/Diagnose/Decide/Execute/Verify) |
| 协作方式 | 流水线式，每阶段产出传递给下一阶段 |
| 自愈场景 | 10 个，覆盖 80% 常见故障 |
| 人在环路 | P0/P1 风险操作需审批 |
| 安全机制 | 沙箱验证 + 双签审批 + 自毁开关 |

---

_文档版本：v1.0 | 创建日期：2026-04-11 | 状态：已批准_
