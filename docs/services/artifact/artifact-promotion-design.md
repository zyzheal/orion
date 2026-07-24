# 产物版本提升设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：后端团队  
> 优先级：P0  
> 状态：设计完成

---

## 一、版本提升架构总览

### 1.1 产物生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│              产物版本提升流程                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐                                                   │
│  │ SNAPSHOT  │ ←─ CI 构建完成自动推送                            │
│  │ 开发版    │    条件：无                                      │
│  │ 保留：7 天  │    门禁：无                                      │
│  └────┬─────┘                                                   │
│       │                                                         │
│       │ 触发：Tech Lead 确认测试通过                            │
│       │ 门禁：扫描通过 + 无 Critical 漏洞 + CI 全绿              │
│       ▼                                                         │
│  ┌──────────────┐                                               │
│  │ RELEASE      │ ←─ 集成测试/UAT 通过                           │
│  │ CANDIDATE    │    条件：所有自动化测试通过                   │
│  │ 候选版       │    门禁：测试覆盖率≥80% + 性能测试达标         │
│  │ 保留：30 天   │                                               │
│  └────┬─────────┘                                               │
│       │                                                         │
│       │ 触发：产品经理验收通过                                  │
│       │ 门禁：UAT 验收报告 + 安全扫描通过                        │
│       ▼                                                         │
│  ┌──────────┐                                                   │
│  │ STABLE   │ ←─ 可以发布到生产                                 │
│  │ 稳定版   │    条件：验收报告 + 回滚方案                      │
│  │ 保留：90 天 │    门禁：Tech Lead 审批                          │
│  └────┬─────┘                                                   │
│       │                                                         │
│       │ 触发：变更审批通过                                      │
│       │ 门禁：变更评审 + 灰度策略 + On-Call 确认                 │
│       ▼                                                         │
│  ┌────────────┐                                                 │
│  │ PRODUCTION │ ←─ 已部署到生产环境                             │
│  │ 生产版     │    条件：生产部署完成                           │
│  │ 保留：365 天 │    门禁：部署验证通过                          │
│  └────┬───────┘                                                 │
│       │                                                         │
│       │ 触发：新版本上线 / 合规要求                             │
│       ▼                                                         │
│  ┌──────────┐                                                   │
│  │ ARCHIVED │ ←─ 只读保留，用于审计和回滚                       │
│  │ 归档版   │    条件：永久保留                                 │
│  │ 保留：永久 │    门禁：无                                      │
│  └──────────┘                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 支持的产物类型

| 产物类型 | 仓库 | 版本格式 | 提升策略 |
|---------|------|---------|---------|
| **容器镜像** | Harbor | semver (2.3.0) | 标签提升 + 复制 |
| **Maven JAR** | Nexus | semver (2.3.0.jar) | 复制构件 |
| **NPM 包** | Nexus | semver (@company/pkg@2.3.0) | 发布新版本 |
| **Python Wheel** | Nexus | semver (pkg-2.3.0-py3.whl) | 发布新版本 |
| **Helm Chart** | Harbor/Nexus | semver (chart-2.3.0.tgz) | 标签提升 |

---

## 二、版本提升状态机

### 2.1 状态机定义

```python
# 产物版本提升状态机
from enum import Enum
from typing import List, Dict, Optional

class ArtifactStage(Enum):
    """产物生命周期阶段"""
    
    SNAPSHOT = "snapshot"           # 开发中版本
    RELEASE_CANDIDATE = "rc"        # 候选发布版
    STABLE = "stable"               # 稳定版
    PRODUCTION = "production"       # 生产版
    ARCHIVED = "archived"           # 归档版

class PromotionTransition:
    """状态转换定义"""
    
    def __init__(
        self,
        from_stage: ArtifactStage,
        to_stage: ArtifactStage,
        conditions: List[Condition],
        approvals: List[str],
        actions: List[Action]
    ):
        self.from_stage = from_stage
        self.to_stage = to_stage
        self.conditions = conditions  # 前置条件
        self.approvals = approvals    # 需要的审批
        self.actions = actions        # 执行动作

# 状态转换规则
PROMOTION_RULES = {
    # snapshot → rc
    PromotionTransition(
        from_stage=ArtifactStage.SNAPSHOT,
        to_stage=ArtifactStage.RELEASE_CANDIDATE,
        conditions=[
            ScanPassedCondition(),      # 扫描通过
            NoCriticalVulnCondition(),  # 无 Critical 漏洞
            CIPassedCondition()         # CI 全绿
        ],
        approvals=[
            "tech_lead"  # Tech Lead 确认
        ],
        actions=[
            CreateTagAction(tag_suffix="rc"),
            UpdateMetadataAction(stage="rc"),
            NotifyAction(channels=["slack", "email"])
        ]
    ),
    
    # rc → stable
    PromotionTransition(
        from_stage=ArtifactStage.RELEASE_CANDIDATE,
        to_stage=ArtifactStage.STABLE,
        conditions=[
            AllTestsPassedCondition(),     # 所有测试通过
            CoverageThresholdCondition(),  # 覆盖率≥80%
            PerformanceTestCondition()     # 性能测试达标
        ],
        approvals=[
            "tech_lead",
            "product_manager"  # 产品经理验收
        ],
        actions=[
            CreateTagAction(tag_suffix="stable"),
            UpdateMetadataAction(stage="stable"),
            GenerateReleaseNotesAction(),
            NotifyAction(channels=["slack", "email", "dingtalk"])
        ]
    ),
    
    # stable → production
    PromotionTransition(
        from_stage=ArtifactStage.STABLE,
        to_stage=ArtifactStage.PRODUCTION,
        conditions=[
            UATAcceptanceCondition(),   # UAT 验收报告
            RollbackPlanCondition(),    # 回滚方案就绪
            ChangeReviewCondition()     # 变更评审通过
        ],
        approvals=[
            "tech_lead",
            "sre",
            "org_admin"  # 生产部署需更高级别审批
        ],
        actions=[
            CreateTagAction(tag_suffix="prod"),
            UpdateMetadataAction(stage="production"),
            DeployToProdAction(),
            NotifyAction(channels=["slack", "email", "dingtalk", "sms"])
        ]
    ),
    
    # production → archived
    PromotionTransition(
        from_stage=ArtifactStage.PRODUCTION,
        to_stage=ArtifactStage.ARCHIVED,
        conditions=[
            NewVersionDeployedCondition()  # 新版本已部署
        ],
        approvals=[],
        actions=[
            UpdateMetadataAction(stage="archived"),
            SetReadOnlyAction()
        ]
    )
}
```

### 2.2 条件检查器

```python
# 条件检查器基类
class Condition(ABC):
    """前置条件检查器"""
    
    @abstractmethod
    async def check(self, context: PromotionContext) -> bool:
        """检查条件是否满足"""
        pass
    
    @property
    def name(self) -> str:
        """条件名称"""
        return self.__class__.__name__

# 具体条件实现
class ScanPassedCondition(Condition):
    """扫描通过条件"""
    
    async def check(self, context: PromotionContext) -> bool:
        artifact = context.artifact
        
        # 检查扫描状态
        if artifact.scan_status != "Success":
            return False
        
        return True

class NoCriticalVulnCondition(Condition):
    """无 Critical 漏洞条件"""
    
    async def check(self, context: PromotionContext) -> bool:
        artifact = context.artifact
        
        # 检查漏洞汇总
        vuln_summary = artifact.vulnerability_summary
        return vuln_summary.critical == 0

class CIPassedCondition(Condition):
    """CI 全绿条件"""
    
    async def check(self, context: PromotionContext) -> bool:
        # 查询关联的 Pipeline
        pipelines = await context.pipeline_service.get_pipelines(
            artifact=context.artifact
        )
        
        # 所有 Pipeline 必须成功
        return all(p.status == 'success' for p in pipelines)

class AllTestsPassedCondition(Condition):
    """所有测试通过条件"""
    
    async def check(self, context: PromotionContext) -> bool:
        # 查询测试报告
        test_reports = await context.test_service.get_reports(
            artifact=context.artifact
        )
        
        # 所有测试必须通过
        return all(report.passed for report in test_reports)

class CoverageThresholdCondition(Condition):
    """测试覆盖率阈值条件"""
    
    def __init__(self, threshold: float = 0.8):
        self.threshold = threshold
    
    async def check(self, context: PromotionContext) -> bool:
        coverage = await context.test_service.get_coverage(
            artifact=context.artifact
        )
        return coverage >= self.threshold

class PerformanceTestCondition(Condition):
    """性能测试达标条件"""
    
    async def check(self, context: PromotionContext) -> bool:
        perf_report = await context.test_service.get_performance_report(
            artifact=context.artifact
        )
        
        # 检查性能指标
        return (
            perf_report.p99_latency < 500 and  # P99 < 500ms
            perf_report.error_rate < 0.01 and   # 错误率 < 1%
            perf_report.throughput > 1000       # 吞吐量 > 1000 QPS
        )

class UATAcceptanceCondition(Condition):
    """UAT 验收报告条件"""
    
    async def check(self, context: PromotionContext) -> bool:
        # 检查是否有 UAT 验收报告
        report = await context.uat_service.get_acceptance_report(
            artifact=context.artifact
        )
        return report is not None and report.approved

class RollbackPlanCondition(Condition):
    """回滚方案就绪条件"""
    
    async def check(self, context: PromotionContext) -> bool:
        # 检查是否有回滚方案
        plan = await context.deploy_service.get_rollback_plan(
            artifact=context.artifact
        )
        return plan is not None

class ChangeReviewCondition(Condition):
    """变更评审通过条件"""
    
    async def check(self, context: PromotionContext) -> bool:
        # 检查变更评审状态
        review = await context.change_service.get_review(
            artifact=context.artifact
        )
        return review.status == 'approved'

class NewVersionDeployedCondition(Condition):
    """新版本已部署条件"""
    
    async def check(self, context: PromotionContext) -> bool:
        # 检查是否有更新版本已部署到生产
        newer_versions = await context.artifact_service.get_newer_versions(
            artifact=context.artifact,
            stage=ArtifactStage.PRODUCTION
        )
        return len(newer_versions) > 0
```

---

## 三、提升执行器

### 3.1 提升服务

```python
# 产物版本提升服务
class ArtifactPromotionService:
    """
    产物版本提升服务
    """
    
    def __init__(
        self,
        harbor_client: HarborClient,
        nexus_client: NexusClient,
        approval_service: ApprovalService,
        pipeline_service: PipelineService,
        nats_client: NATSClient
    ):
        self.harbor = harbor_client
        self.nexus = nexus_client
        self.approval = approval_service
        self.pipeline = pipeline_service
        self.nats = nats_client
    
    async def promote(
        self,
        artifact_id: str,
        target_stage: ArtifactStage,
        operator: str
    ) -> PromotionResult:
        """
        执行版本提升
        
        Args:
            artifact_id: 产物 ID
            target_stage: 目标阶段
            operator: 操作人
        
        Returns:
            PromotionResult
        """
        
        # 1. 获取产物详情
        artifact = await self._get_artifact(artifact_id)
        
        # 2. 获取当前阶段
        current_stage = self._get_current_stage(artifact)
        
        # 3. 获取转换规则
        transition = self._get_transition(
            current_stage, target_stage
        )
        
        if not transition:
            raise PromotionError(
                f"无法从 {current_stage.value} 提升到 {target_stage.value}"
            )
        
        # 4. 检查前置条件
        condition_results = await self._check_conditions(
            transition.conditions, artifact
        )
        
        if not all(r.passed for r in condition_results):
            failed = [r for r in condition_results if not r.passed]
            raise PromotionError(
                f"前置条件不满足：{[r.condition.name for r in failed]}"
            )
        
        # 5. 创建审批请求
        approval_request = await self._create_approval_request(
            transition, artifact, operator
        )
        
        # 6. 等待审批
        approval_result = await self._wait_for_approval(
            approval_request
        )
        
        if not approval_result.approved:
            raise PromotionError(
                f"审批被拒绝：{approval_result.reason}"
            )
        
        # 7. 执行提升动作
        for action in transition.actions:
            await action.execute(artifact)
        
        # 8. 发布提升完成事件
        await self.nats.publish(
            subject="artifact.promoted",
            payload={
                "artifact_id": artifact_id,
                "from_stage": current_stage.value,
                "to_stage": target_stage.value,
                "operator": operator,
                "timestamp": datetime.now().isoformat()
            }
        )
        
        return PromotionResult(
            success=True,
            artifact=artifact,
            new_stage=target_stage
        )
    
    async def _check_conditions(
        self,
        conditions: List[Condition],
        artifact: Artifact
    ) -> List[ConditionResult]:
        """检查所有前置条件"""
        
        context = PromotionContext(
            artifact=artifact,
            pipeline_service=self.pipeline,
            # ... 其他服务
        )
        
        results = []
        for condition in conditions:
            try:
                passed = await condition.check(context)
                results.append(ConditionResult(
                    condition=condition,
                    passed=passed,
                    message=None if passed else f"{condition.name} 检查失败"
                ))
            except Exception as e:
                results.append(ConditionResult(
                    condition=condition,
                    passed=False,
                    message=str(e)
                ))
        
        return results
    
    async def _create_approval_request(
        self,
        transition: PromotionTransition,
        artifact: Artifact,
        operator: str
    ) -> ApprovalRequest:
        """创建审批请求"""
        
        request = ApprovalRequest(
            type="artifact_promotion",
            title=f"产物版本提升：{artifact.name} {artifact.version}",
            description=f"""
## 产物版本提升申请

**产物**: {artifact.name}  
**当前版本**: {artifact.version}  
**当前阶段**: {transition.from_stage.value}  
**目标阶段**: {transition.to_stage.value}  
**申请人**: {operator}

### 前置条件检查

{await self._format_condition_results(transition.conditions)}

### 需要的审批人

{', '.join(transition.approvals)}
""",
            approvers=transition.approvals,
            artifact_id=artifact.id,
            target_stage=transition.to_stage.value
        )
        
        return await self.approval.create_request(request)
```

---

## 四、Harbor 镜像版本提升

### 4.1 镜像标签提升流程

```python
# Harbor 镜像版本提升
class HarborPromotionService:
    """
    Harbor 镜像版本提升服务
    """
    
    def __init__(self, harbor_client: HarborClient):
        self.harbor = harbor_client
    
    async def promote_image(
        self,
        project_name: str,
        repo_name: str,
        source_tag: str,
        target_stage: ArtifactStage
    ):
        """
        提升镜像版本
        
        策略：创建新标签指向同一镜像 digest
        """
        
        # 1. 获取源镜像
        source_artifact = await self.harbor.get_artifact(
            project_name, repo_name, source_tag
        )
        
        # 2. 生成目标标签
        target_tag = self._generate_tag_name(
            source_tag, target_stage
        )
        
        # 3. 检查目标标签是否存在
        try:
            existing = await self.harbor.get_artifact(
                project_name, repo_name, target_tag
            )
            if existing:
                raise PromotionError(
                    f"目标标签已存在：{target_tag}"
                )
        except ArtifactNotFoundError:
            pass  # 预期情况
        
        # 4. 创建新标签（指向同一 digest）
        await self.harbor.create_tag(
            project_name=project_name,
            repo_name=repo_name,
            tag_name=target_tag,
            artifact_digest=source_artifact.digest
        )
        
        # 5. 更新元数据
        await self._update_annotations(
            project_name, repo_name, target_tag,
            {
                'orion.artifact.stage': target_stage.value,
                'orion.artifact.promoted_at': datetime.now().isoformat(),
                'orion.artifact.source_tag': source_tag
            }
        )
        
        return PromotionResult(
            success=True,
            source_tag=source_tag,
            target_tag=target_tag,
            digest=source_artifact.digest
        )
    
    def _generate_tag_name(
        self,
        source_tag: str,
        target_stage: ArtifactStage
    ) -> str:
        """生成目标标签名"""
        
        # 解析源标签
        # 格式：1.0.0-SNAPSHOT → 1.0.0-rc / 1.0.0-stable / 1.0.0-prod
        match = re.match(r'^(.+)-SNAPSHOT$', source_tag)
        if match:
            base_version = match.group(1)
        else:
            base_version = source_tag
        
        # 根据目标阶段生成标签
        tag_map = {
            ArtifactStage.RELEASE_CANDIDATE: f"{base_version}-rc",
            ArtifactStage.STABLE: f"{base_version}-stable",
            ArtifactStage.PRODUCTION: f"{base_version}-prod",
            ArtifactStage.ARCHIVED: f"{base_version}-archived"
        }
        
        return tag_map.get(target_stage, source_tag)
```

---

## 五、Nexus 依赖包版本提升

### 5.1 Maven 构件提升

```python
# Nexus Maven 构件提升
class NexusMavenPromotionService:
    """
    Nexus Maven 构件版本提升服务
    """
    
    def __init__(self, nexus_client: NexusClient):
        self.nexus = nexus_client
    
    async def promote_maven_artifact(
        self,
        component_id: str,
        target_stage: ArtifactStage
    ):
        """
        提升 Maven 构件版本
        
        策略：从 snapshot 仓库复制到 release 仓库
        """
        
        # 1. 获取构件详情
        components = await self.nexus.search_components()
        component = next(
            (c for c in components if c.id == component_id),
            None
        )
        
        if not component:
            raise ComponentNotFoundError(component_id)
        
        # 2. 确定目标仓库
        target_repo = self._get_target_repository(target_stage)
        
        # 3. 检查目标仓库是否已存在
        existing = await self.nexus.search_components(
            repository=target_repo,
            group=component.group,
            name=component.name,
            version=component.version
        )
        
        if existing:
            raise PromotionError(
                f"目标仓库已存在 {component.group}:{component.name}:{component.version}"
            )
        
        # 4. 下载构件资产
        assets = []
        for asset in component.assets:
            asset_content = await self._download_asset(asset.download_url)
            assets.append({
                'path': asset.path,
                'name': asset.name,
                'content': asset_content
            })
        
        # 5. 上传到目标仓库
        for asset in assets:
            await self.nexus.upload_maven(
                repository=target_repo,
                group_id=component.group,
                artifact_id=component.name,
                version=component.version,
                packaging=component.packaging,
                classifier=component.classifier,
                asset=asset['content']
            )
        
        return PromotionResult(
            success=True,
            component=component,
            target_repository=target_repo
        )
    
    def _get_target_repository(
        self,
        stage: ArtifactStage
    ) -> str:
        """根据阶段获取目标仓库"""
        
        repo_map = {
            ArtifactStage.SNAPSHOT: 'maven-snapshots',
            ArtifactStage.RELEASE_CANDIDATE: 'maven-releases',
            ArtifactStage.STABLE: 'maven-releases',
            ArtifactStage.PRODUCTION: 'maven-releases',
            ArtifactStage.ARCHIVED: 'maven-archived'
        }
        
        return repo_map.get(stage, 'maven-snapshots')
```

---

## 六、保留与清理策略

### 6.1 保留策略配置

```yaml
# 产物保留策略配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: artifact-retention-policy
  namespace: orion-system
data:
  retention_policy.yaml: |
    # 全局保留策略
    global:
      # 启用自动清理
      cleanup_enabled: true
      
      # 清理执行时间
      schedule:
        cron: "0 5 * * *"  # 每天凌晨 5 点
        timezone: "Asia/Shanghai"
    
    # 按阶段的保留策略
    stages:
      snapshot:
        retention_days: 7
        keep_count: 10
        cleanup_priority: high  # 优先清理
    
      release_candidate:
        retention_days: 30
        keep_count: 5
        cleanup_priority: medium
    
      stable:
        retention_days: 90
        keep_count: 10
        cleanup_priority: low
    
      production:
        retention_days: 365
        keep_count: -1  # 永久保留
        cleanup_priority: none
    
      archived:
        retention_days: -1  # 永久保留
        keep_count: -1
        cleanup_priority: none
    
    # 例外规则（不清理）
    exceptions:
      # 带特定标签的不清理
      - tag_pattern: "^lts-.*"
        action: retain_forever
      
      # 生产环境正在使用的不清理
      - condition: "in_use_by_production"
        action: retain_forever
      
      # 合规要求的保留
      - condition: "compliance_required"
        action: retain_forever
```

### 6.2 清理执行器

```python
# 产物清理服务
class ArtifactCleanupService:
    """
    产物清理服务
    """
    
    def __init__(
        self,
        harbor_client: HarborClient,
        nexus_client: NexusClient,
        policy_config: RetentionPolicy
    ):
        self.harbor = harbor_client
        self.nexus = nexus_client
        self.policy = policy_config
    
    async def cleanup(self) -> CleanupResult:
        """执行清理任务"""
        
        result = CleanupResult()
        
        # 1. 清理 Harbor 镜像
        harbor_result = await self._cleanup_harbor()
        result.deleted_count += harbor_result.deleted_count
        result.freed_bytes += harbor_result.freed_bytes
        
        # 2. 清理 Nexus 构件
        nexus_result = await self._cleanup_nexus()
        result.deleted_count += nexus_result.deleted_count
        result.freed_bytes += nexus_result.freed_bytes
        
        return result
    
    async def _cleanup_harbor(self) -> RepositoryCleanupResult:
        """清理 Harbor 镜像"""
        
        result = RepositoryCleanupResult()
        
        # 获取所有项目
        projects = await self.harbor.list_projects()
        
        for project in projects:
            repos = await self.harbor.list_repositories(project.name)
            
            for repo in repos:
                artifacts = await self.harbor.list_artifacts(
                    project.name, repo.name
                )
                
                for artifact in artifacts:
                    if self._should_cleanup(artifact):
                        await self.harbor.delete_artifact(
                            project.name, repo.name, artifact.digest
                        )
                        result.deleted_count += 1
                        result.freed_bytes += artifact.size
        
        return result
    
    def _should_cleanup(self, artifact: Artifact) -> bool:
        """判断是否应该清理"""
        
        # 获取阶段
        stage_str = artifact.annotations.get(
            'orion.artifact.stage', 'snapshot'
        )
        stage = ArtifactStage(stage_str)
        
        # 获取保留策略
        policy = self.policy.stages.get(stage)
        if not policy:
            return False
        
        # 检查例外规则
        for exception in self.policy.exceptions:
            if self._match_exception(artifact, exception):
                return False
        
        # 检查保留天数
        if policy.retention_days > 0:
            age = (datetime.now() - artifact.creation_time).days
            if age < policy.retention_days:
                return False
        
        # 检查保留数量
        if policy.keep_count > 0:
            # 需要获取同仓库同组件的所有版本
            # 按时间排序，保留最近的 N 个
            pass  # 实现略
        
        return True
```

---

## 七、监控与审计

### 7.1 监控指标

```yaml
# Prometheus 监控指标
artifact_promotion:
  # 提升操作指标
  promotions_total:
    type: counter
    labels: [from_stage, to_stage, artifact_type, status]
  
  promotion_duration_seconds:
    type: histogram
    labels: [from_stage, to_stage]
    buckets: [1, 5, 10, 30, 60, 300]
  
  # 审批指标
  approval_requests_total:
    type: counter
    labels: [type, status]
  
  approval_duration_seconds:
    type: histogram
    labels: [type]
  
  # 清理指标
  cleanup_jobs_total:
    type: counter
    labels: [status]
  
  cleanup_freed_bytes:
    type: counter
  
  cleanup_deleted_count:
    type: counter
```

### 7.2 审计日志

```python
# 产物提升审计日志
class PromotionAuditLogger:
    """
    记录产物提升审计日志
    """
    
    async def log_promotion(
        self,
        artifact_id: str,
        from_stage: ArtifactStage,
        to_stage: ArtifactStage,
        operator: str,
        approval_ids: List[str],
        condition_results: List[ConditionResult]
    ):
        """记录提升审计日志"""
        
        audit_log = AuditLog(
            event_type="artifact_promotion",
            timestamp=datetime.now(),
            actor=operator,
            resource_type="artifact",
            resource_id=artifact_id,
            action="promote",
            details={
                "from_stage": from_stage.value,
                "to_stage": to_stage.value,
                "approvals": approval_ids,
                "conditions": [
                    {
                        "name": r.condition.name,
                        "passed": r.passed,
                        "message": r.message
                    }
                    for r in condition_results
                ]
            },
            result="success"
        )
        
        # 写入审计日志存储
        await self.audit_store.insert(audit_log)
```

---

## 八、总结

### 8.1 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| 5 阶段状态机 | ✅ | snapshot→rc→stable→production→archived |
| 前置条件检查 | ✅ | 扫描/测试/覆盖率/性能等 |
| 多级审批 | ✅ | Tech Lead/PM/SRE/Org Admin |
| Harbor 镜像提升 | ✅ | 标签复制 |
| Nexus 构件提升 | ✅ | 仓库复制 |
| 保留策略 | ✅ | 按阶段配置 |
| 自动清理 | ✅ | 定时执行 |
| 审计日志 | ✅ | 完整记录 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成，待开发_
