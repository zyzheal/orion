# Harbor Adapter 集成设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：后端团队  
> 优先级：P0  
> 状态：设计完成

---

## 一、集成架构总览

### 1.1 Harbor 在 Orion 中的定位

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orion 平台                                    │
│                                                                 │
│  用户接口层                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Orion UI   │  │  Pipeline   │  │  CLI        │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Harbor Adapter (封装层)                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ 镜像管理     │  │ 扫描管理     │  │ 签名验证     │  │   │
│  │  │ API 客户端    │  │ API 客户端    │  │ API 客户端    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Harbor 实例                            │   │
│  │  • 镜像仓库 (Docker Registry)                            │   │
│  │  • 漏洞扫描 (Clair/Trivy)                                │   │
│  │  • 镜像签名 (Notary)                                     │   │
│  │  • 复制规则 (Replication)                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 集成场景

| 场景 | 触发源 | Orion 动作 | Harbor 动作 |
|------|--------|-----------|-----------|
| **镜像推送** | Pipeline Build 完成 | 触发镜像上传 | 存储镜像 + 生成元数据 |
| **镜像扫描** | 镜像推送完成 | 触发自动扫描 | 调用 Trivy/Clair 扫描 |
| **镜像签名** | 镜像扫描通过 | 触发 Cosign 签名 | 存储签名 + 关联镜像 |
| **镜像拉取** | Pipeline Deploy | 验签 + 拉取镜像 | 提供镜像下载 |
| **镜像清理** | 定时任务 | 根据保留策略清理 | 删除旧镜像 |

---

## 二、Harbor API 封装

### 2.1 Harbor API 客户端

```python
# Harbor REST API 封装
class HarborClient:
    """
    Harbor REST API v2.0 封装
    参考：https://github.com/goharbor/harbor/blob/master/docs/swagger.yaml
    """
    
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.session = aiohttp.ClientSession(
            auth=aiohttp.BasicAuth(username, password)
        )
    
    # ========== 项目相关 ==========
    
    async def get_project(self, project_name: str) -> Project:
        """获取项目信息"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return Project(**data)
    
    async def create_project(
        self,
        name: str,
        public: bool = False,
        storage_limit: int = -1
    ) -> Project:
        """创建项目"""
        url = f"{self.base_url}/api/v2.0/projects"
        data = {
            'project_name': name,
            'public': public,
            'storage_limit': storage_limit,
            'metadata': {
                'auto_scan': 'true',  # 自动扫描
                'enable_content_trust': 'true'  # 启用签名
            }
        }
        async with self.session.post(url, json=data) as resp:
            resp.raise_for_status()
            return await self.get_project(name)
    
    async def list_projects(self) -> List[Project]:
        """获取项目列表"""
        url = f"{self.base_url}/api/v2.0/projects"
        return await self._paginate(url)
    
    # ========== 镜像仓库相关 ==========
    
    async def get_repository(
        self, 
        project_name: str, 
        repo_name: str
    ) -> Repository:
        """获取仓库信息"""
        repo_full = f"{project_name}/{repo_name}"
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return Repository(**data)
    
    async def list_repositories(
        self, 
        project_name: str
    ) -> List[Repository]:
        """获取项目下所有仓库"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories"
        return await self._paginate(url)
    
    async def delete_repository(
        self,
        project_name: str,
        repo_name: str
    ):
        """删除仓库"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}"
        async with self.session.delete(url) as resp:
            resp.raise_for_status()
    
    # ========== 镜像标签相关 ==========
    
    async def get_artifact(
        self,
        project_name: str,
        repo_name: str,
        reference: str  # tag 或 digest
    ) -> Artifact:
        """获取镜像详情"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}/artifacts/{reference}"
        params = {'with_scan_overview': 'true', 'with_signature': 'true'}
        async with self.session.get(url, params=params) as resp:
            data = await resp.json()
            return Artifact(**data)
    
    async def list_artifacts(
        self,
        project_name: str,
        repo_name: str
    ) -> List[Artifact]:
        """获取仓库下所有镜像"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}/artifacts"
        params = {'with_scan_overview': 'true'}
        return await self._paginate(url, params)
    
    async def delete_artifact(
        self,
        project_name: str,
        repo_name: str,
        reference: str
    ):
        """删除镜像"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}/artifacts/{reference}"
        async with self.session.delete(url) as resp:
            resp.raise_for_status()
    
    # ========== 扫描相关 ==========
    
    async def scan_artifact(
        self,
        project_name: str,
        repo_name: str,
        reference: str
    ):
        """触发镜像扫描"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}/artifacts/{reference}/scan"
        async with self.session.post(url) as resp:
            resp.raise_for_status()
    
    async def get_scan_report(
        self,
        project_name: str,
        repo_name: str,
        reference: str
    ) -> ScanReport:
        """获取扫描报告"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}/artifacts/{reference}/scan/overview"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return ScanReport(**data)
    
    async def stop_scan(
        self,
        project_name: str,
        repo_name: str,
        reference: str
    ):
        """停止扫描"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}/artifacts/{reference}/scan/stop"
        async with self.session.post(url) as resp:
            resp.raise_for_status()
    
    # ========== 标签管理 ==========
    
    async def create_tag(
        self,
        project_name: str,
        repo_name: str,
        tag_name: str,
        artifact_digest: str
    ):
        """创建镜像标签"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}/artifacts/{artifact_digest}/tags"
        data = {'name': tag_name}
        async with self.session.post(url, json=data) as resp:
            resp.raise_for_status()
    
    async def delete_tag(
        self,
        project_name: str,
        repo_name: str,
        tag_name: str
    ):
        """删除镜像标签"""
        url = f"{self.base_url}/api/v2.0/projects/{project_name}/repositories/{repo_name}/tags/{tag_name}"
        async with self.session.delete(url) as resp:
            resp.raise_for_status()
    
    # ========== 工具方法 ==========
    
    async def _paginate(self, url: str, params: Dict = None) -> List[Any]:
        """处理分页"""
        all_items = []
        page = 1
        per_page = 100
        
        while True:
            current_params = {
                **(params or {}),
                'page': page,
                'page_size': per_page
            }
            async with self.session.get(url, params=current_params) as resp:
                items = await resp.json()
                if not items:
                    break
                all_items.extend(items)
                page += 1
        
        return all_items
    
    async def close(self):
        """关闭会话"""
        await self.session.close()
```

### 2.2 数据模型定义

```python
# Harbor 数据模型
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class Project(BaseModel):
    id: int
    name: str
    owner_id: int
    creation_time: datetime
    update_time: datetime
    deleted: bool
    owner_name: str
    public: bool
    repo_count: int
    artifact_count: int
    metadata: Dict[str, str]
    cve_allowlist: Dict
    storage_used: int

class Repository(BaseModel):
    id: int
    project_id: int
    name: str
    description: str
    artifact_count: int
    pull_count: int
    creation_time: datetime
    update_time: datetime

class Artifact(BaseModel):
    id: int
    project_id: int
    repository_id: str
    digest: str
    type: str  # image, chart, etc.
    media_type: str
    manifest_media_type: str
    artifact_type: str
    size: int
    digest: str
    tags: List[Tag]
    extra_attrs: Dict
    annotations: Dict
    references: List[Reference]
    scan_overview: Optional[Dict]  # 扫描概览
    signatures: Optional[List[Signature]]  # 签名信息
    
    # 便捷属性
    @property
    def scan_status(self) -> str:
        """获取扫描状态"""
        if not self.scan_overview:
            return "not_scanned"
        return self.scan_overview.get('scan_status', 'not_scanned')
    
    @property
    def vulnerability_summary(self) -> VulnerabilitySummary:
        """获取漏洞汇总"""
        if not self.scan_overview:
            return VulnerabilitySummary()
        return VulnerabilitySummary(**self.scan_overview.get('vulnerability_summary', {}))

class Tag(BaseModel):
    id: int
    repository_id: int
    artifact_id: int
    name: str
    creation_time: datetime
    update_time: datetime
    pull_count: int

class Reference(BaseModel):
    parent_id: int
    child_id: int
    child_digest: str
    platform: str
    urls: List[str]
    annotations: Dict

class Signature(BaseModel):
    type: str  # cosign, notary, etc.
    signature: str
    signed_at: datetime
    signer: str

class VulnerabilitySummary(BaseModel):
    total: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    unknown: int = 0
    fixable: int = 0
    
    @property
    def has_critical(self) -> bool:
        return self.critical > 0
    
    @property
    def has_high(self) -> bool:
        return self.high > 0

class ScanReport(BaseModel):
    scan_status: str  # Pending, Running, Success, Error, Stopped
    end_time: Optional[datetime]
    duration: Optional[int]  # 秒
    scanner: Scanner
    vulnerability_summary: VulnerabilitySummary
    vulnerabilities: List[Vulnerability]

class Scanner(BaseModel):
    name: str  # Trivy, Clair, etc.
    vendor: str
    version: str

class Vulnerability(BaseModel):
    id: str  # CVE-ID
    package: str
    version: str
    fix_version: Optional[str]
    severity: str  # Critical, High, Medium, Low, Unknown
    description: str
    links: List[str]
    preferred_cvss: Dict
    cwe_ids: List[str]
    layer: Dict
```

---

## 三、镜像版本提升流程

### 3.1 版本提升状态机

```python
# 镜像版本提升状态机
from enum import Enum

class ArtifactStage(Enum):
    """镜像生命周期阶段"""
    SNAPSHOT = "snapshot"           # 开发中版本
    RELEASE_CANDIDATE = "rc"        # 候选发布版
    STABLE = "stable"               # 稳定版
    PRODUCTION = "production"       # 生产版
    ARCHIVED = "archived"           # 归档版

class ArtifactPromotionMachine:
    """
    镜像版本提升状态机
    """
    
    # 状态转换规则
    TRANSITIONS = {
        ArtifactStage.SNAPSHOT: [
            ArtifactStage.RELEASE_CANDIDATE,
            None  # 可以被删除
        ],
        ArtifactStage.RELEASE_CANDIDATE: [
            ArtifactStage.STABLE,
            ArtifactStage.SNAPSHOT,  # 打回
            None  # 可以被删除
        ],
        ArtifactStage.STABLE: [
            ArtifactStage.PRODUCTION,
            ArtifactStage.RELEASE_CANDIDATE,
            ArtifactStage.ARCHIVED
        ],
        ArtifactStage.PRODUCTION: [
            ArtifactStage.ARCHIVED
        ],
        ArtifactStage.ARCHIVED: []  # 终态，不可转换
    }
    
    # 各阶段的保留策略
    RETENTION_POLICIES = {
        ArtifactStage.SNAPSHOT: {"days": 7, "keep_count": 10},
        ArtifactStage.RELEASE_CANDIDATE: {"days": 30, "keep_count": 5},
        ArtifactStage.STABLE: {"days": 90, "keep_count": 10},
        ArtifactStage.PRODUCTION: {"days": 365, "keep_count": -1},  # -1 = 永久
        ArtifactStage.ARCHIVED: {"days": -1, "keep_count": -1}  # 永久
    }
    
    def __init__(self, harbor_client: HarborClient):
        self.harbor = harbor_client
    
    async def promote(
        self,
        project_name: str,
        repo_name: str,
        tag: str,
        target_stage: ArtifactStage
    ) -> bool:
        """
        提升镜像版本
        
        返回：是否成功
        """
        # 1. 获取当前镜像
        artifact = await self.harbor.get_artifact(
            project_name, repo_name, tag
        )
        
        # 2. 获取当前阶段
        current_stage = self._get_current_stage(artifact)
        
        # 3. 检查是否可以转换
        if target_stage not in self.TRANSITIONS.get(current_stage, []):
            raise ValueError(
                f"无法从 {current_stage.value} 提升到 {target_stage.value}"
            )
        
        # 4. 检查前置条件
        if not await self._check_prerequisites(
            artifact, current_stage, target_stage
        ):
            raise ValueError("前置条件不满足")
        
        # 5. 执行提升
        await self._execute_promotion(
            project_name, repo_name, tag, current_stage, target_stage
        )
        
        # 6. 更新元数据
        await self._update_metadata(
            project_name, repo_name, tag, target_stage
        )
        
        return True
    
    def _get_current_stage(self, artifact: Artifact) -> ArtifactStage:
        """从元数据获取当前阶段"""
        stage_str = artifact.annotations.get(
            'orion.artifact.stage',
            ArtifactStage.SNAPSHOT.value
        )
        return ArtifactStage(stage_str)
    
    async def _check_prerequisites(
        self,
        artifact: Artifact,
        current_stage: ArtifactStage,
        target_stage: ArtifactStage
    ) -> bool:
        """检查前置条件"""
        
        # snapshot → rc: 需要扫描通过且无 Critical 漏洞
        if (
            current_stage == ArtifactStage.SNAPSHOT and
            target_stage == ArtifactStage.RELEASE_CANDIDATE
        ):
            if artifact.scan_status != "Success":
                return False
            if artifact.vulnerability_summary.has_critical:
                return False
        
        # rc → stable: 需要所有测试通过
        elif (
            current_stage == ArtifactStage.RELEASE_CANDIDATE and
            target_stage == ArtifactStage.STABLE
        ):
            test_status = artifact.annotations.get(
                'orion.test.status', 'pending'
            )
            if test_status != "passed":
                return False
        
        # stable → production: 需要 Tech Lead 审批
        elif (
            current_stage == ArtifactStage.STABLE and
            target_stage == ArtifactStage.PRODUCTION
        ):
            approval_status = artifact.annotations.get(
                'orion.approval.status', 'pending'
            )
            if approval_status != "approved":
                return False
        
        return True
    
    async def _execute_promotion(
        self,
        project_name: str,
        repo_name: str,
        tag: str,
        current_stage: ArtifactStage,
        target_stage: ArtifactStage
    ):
        """执行版本提升"""
        
        # 创建新标签
        new_tag = f"{tag}-{target_stage.value}"
        await self.harbor.create_tag(
            project_name,
            repo_name,
            new_tag,
            artifact_digest=tag  # 使用原 tag 的 digest
        )
    
    async def _update_metadata(
        self,
        project_name: str,
        repo_name: str,
        tag: str,
        stage: ArtifactStage
    ):
        """更新元数据"""
        # 通过 Harbor API 更新 annotations
        # 注意：Harbor API v2.0 不支持直接更新 annotations
        # 需要通过 webhook 或数据库直接更新
        pass
```

### 3.2 版本提升流程图

```
┌─────────────────────────────────────────────────────────────────┐
│              镜像版本提升流程                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐                                                   │
│  │ SNAPSHOT  │ ←─ CI 构建完成，自动推送                          │
│  │ (开发版)  │    保留：7 天 / 10 个版本                           │
│  └────┬─────┘                                                   │
│       │                                                         │
│       │ 条件：扫描通过 + 无 Critical 漏洞                        │
│       ▼                                                         │
│  ┌──────────────┐                                               │
│  │ RELEASE      │ ←─ 集成测试通过                               │
│  │ CANDIDATE    │    保留：30 天 / 5 个版本                        │
│  │ (候选版)     │                                               │
│  └────┬─────────┘                                               │
│       │                                                         │
│       │ 条件：所有测试通过 + 性能测试达标                        │
│       ▼                                                         │
│  ┌──────────┐                                                   │
│  │ STABLE   │ ←─ UAT 验收通过                                   │
│  │ (稳定版) │    保留：90 天 / 10 个版本                          │
│  └────┬─────┘                                                   │
│       │                                                         │
│       │ 条件：Tech Lead 审批 + 部署到 Staging 验证               │
│       ▼                                                         │
│  ┌────────────┐                                                 │
│  │ PRODUCTION │ ←─ 生产部署完成                                 │
│  │ (生产版)   │    保留：365 天 / 永久                           │
│  └────┬───────┘                                                 │
│       │                                                         │
│       │ 条件：新版本上线 / 合规要求归档                          │
│       ▼                                                         │
│  ┌──────────┐                                                   │
│  │ ARCHIVED │ ←─ 只读保留，不可删除                             │
│  │ (归档版) │    保留：永久                                     │
│  └──────────┘                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 四、镜像扫描集成

### 4.1 自动扫描触发

```python
# 镜像扫描服务
class ImageScanService:
    """
    镜像漏洞扫描服务
    """
    
    def __init__(
        self,
        harbor_client: HarborClient,
        nats_client: NATSClient
    ):
        self.harbor = harbor_client
        self.nats = nats_client
    
    async def trigger_scan(
        self,
        project_name: str,
        repo_name: str,
        tag: str
    ):
        """触发镜像扫描"""
        
        # 1. 调用 Harbor API 触发扫描
        await self.harbor.scan_artifact(
            project_name, repo_name, tag
        )
        
        # 2. 发布扫描开始事件
        await self.nats.publish(
            subject="harbor.scan.started",
            payload={
                "project_name": project_name,
                "repo_name": repo_name,
                "tag": tag,
                "timestamp": datetime.now().isoformat()
            }
        )
        
        # 3. 轮询扫描结果
        await self._poll_scan_result(
            project_name, repo_name, tag
        )
    
    async def _poll_scan_result(
        self,
        project_name: str,
        repo_name: str,
        tag: str,
        max_attempts: int = 60,
        interval: int = 10
    ):
        """轮询扫描结果"""
        
        for attempt in range(max_attempts):
            await asyncio.sleep(interval)
            
            try:
                artifact = await self.harbor.get_artifact(
                    project_name, repo_name, tag,
                    with_scan_overview=True
                )
                
                if artifact.scan_status == "Success":
                    # 扫描完成
                    await self._handle_scan_completed(artifact)
                    return
                
                elif artifact.scan_status == "Error":
                    # 扫描失败
                    await self._handle_scan_failed(artifact)
                    return
                
            except Exception as e:
                logger.error(f"轮询扫描结果失败：{e}")
        
        # 超时
        logger.warning(f"扫描超时 ({max_attempts * interval}s)")
    
    async def _handle_scan_completed(self, artifact: Artifact):
        """处理扫描完成"""
        
        vuln_summary = artifact.vulnerability_summary
        
        # 发布扫描完成事件
        await self.nats.publish(
            subject="harbor.scan.completed",
            payload={
                "project_name": artifact.project_id,
                "repo_name": artifact.repository_id,
                "tag": artifact.tags[0].name if artifact.tags else None,
                "digest": artifact.digest,
                "vulnerability_summary": {
                    "total": vuln_summary.total,
                    "critical": vuln_summary.critical,
                    "high": vuln_summary.high,
                    "medium": vuln_summary.medium,
                    "low": vuln_summary.low,
                    "fixable": vuln_summary.fixable
                },
                "passed": not vuln_summary.has_critical
            }
        )
        
        # 如果有 Critical 漏洞，发布告警
        if vuln_summary.has_critical:
            await self.nats.publish(
                subject="harbor.scan.critical_alert",
                payload={
                    "artifact": f"{artifact.repository_id}:{artifact.tags[0].name}",
                    "critical_count": vuln_summary.critical
                }
            )
    
    async def _handle_scan_failed(self, artifact: Artifact):
        """处理扫描失败"""
        
        await self.nats.publish(
            subject="harbor.scan.failed",
            payload={
                "project_name": artifact.project_id,
                "repo_name": artifact.repository_id,
                "tag": artifact.tags[0].name if artifact.tags else None,
                "reason": "扫描器错误"
            }
        )
```

### 4.2 扫描门禁策略

```python
# 扫描门禁策略
class ScanGatePolicy:
    """
    镜像扫描门禁策略
    定义不同阶段的扫描通过标准
    """
    
    POLICIES = {
        ArtifactStage.SNAPSHOT: {
            "block_on": ["critical"],  # 仅阻塞 Critical
            "warn_on": ["high", "medium"],  # 警告 High/Medium
            "ignore": ["low", "unknown"],  # 忽略 Low/Unknown
            "require_fixable": False
        },
        ArtifactStage.RELEASE_CANDIDATE: {
            "block_on": ["critical", "high"],  # 阻塞 Critical/High
            "warn_on": ["medium"],
            "ignore": ["low", "unknown"],
            "require_fixable": True  # 必须有可修复版本
        },
        ArtifactStage.STABLE: {
            "block_on": ["critical", "high", "medium"],  # 阻塞中危以上
            "warn_on": ["low"],
            "ignore": ["unknown"],
            "require_fixable": True
        },
        ArtifactStage.PRODUCTION: {
            "block_on": ["critical", "high", "medium", "low"],  # 零漏洞
            "warn_on": [],
            "ignore": [],
            "require_fixable": True
        }
    }
    
    @classmethod
    def check_gate(
        cls,
        stage: ArtifactStage,
        vuln_summary: VulnerabilitySummary
    ) -> GateResult:
        """
        检查扫描是否通过门禁
        
        返回：GateResult(passed, blocked_reason, warnings)
        """
        policy = cls.POLICIES.get(stage)
        if not policy:
            return GateResult(passed=True)
        
        warnings = []
        blocked_reason = None
        
        # 检查阻塞级别
        for severity in policy["block_on"]:
            count = getattr(vuln_summary, severity, 0)
            if count > 0:
                blocked_reason = f"发现 {count} 个 {severity} 级别漏洞"
                break
        
        # 检查警告级别
        if not blocked_reason:
            for severity in policy["warn_on"]:
                count = getattr(vuln_summary, severity, 0)
                if count > 0:
                    warnings.append(f"发现 {count} 个 {severity} 级别漏洞")
        
        # 检查可修复要求
        if (
            not blocked_reason and
            policy.get("require_fixable") and
            vuln_summary.fixable > 0
        ):
            warnings.append(
                f"发现 {vuln_summary.fixable} 个可修复漏洞，建议修复"
            )
        
        return GateResult(
            passed=blocked_reason is None,
            blocked_reason=blocked_reason,
            warnings=warnings
        )
```

---

## 五、镜像签名验证

### 5.1 Cosign 签名集成

```python
# 镜像签名服务
class ImageSignatureService:
    """
    使用 Cosign 进行镜像签名和验证
    """
    
    def __init__(self, harbor_client: HarborClient):
        self.harbor = harbor_client
        self.cosign_binary = "/usr/local/bin/cosign"
    
    async def sign_image(
        self,
        image_ref: str,  # harbor.internal/project/repo:tag
        private_key_path: str,
        password: str
    ) -> str:
        """
        对镜像进行签名
        
        返回：签名 digest
        """
        
        # 使用 Cosign CLI 签名
        cmd = [
            self.cosign_binary,
            "sign",
            "--key", private_key_path,
            "--upload-signature", "true",
            image_ref
        ]
        
        # 执行命令
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # 输入密码
        stdout, stderr = await process.communicate(
            input=password.encode()
        )
        
        if process.returncode != 0:
            raise SignatureError(f"签名失败：{stderr.decode()}")
        
        # 解析签名 digest
        signature_digest = self._parse_signature_output(stdout.decode())
        
        return signature_digest
    
    async def verify_image(
        self,
        image_ref: str,
        public_key_path: str
    ) -> VerificationResult:
        """
        验证镜像签名
        
        返回：VerificationResult(verified, signer, signed_at)
        """
        
        cmd = [
            self.cosign_binary,
            "verify",
            "--key", public_key_path,
            image_ref
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            return VerificationResult(
                verified=False,
                error=stderr.decode()
            )
        
        # 解析验证结果
        return self._parse_verification_output(stdout.decode())
    
    def _parse_signature_output(self, output: str) -> str:
        """解析 Cosign 签名输出"""
        # 输出格式：sha256-xxx.sig
        match = re.search(r'sha256-[a-f0-9]+\.sig', output)
        if match:
            return match.group(0)
        raise SignatureError("无法解析签名输出")
    
    def _parse_verification_output(self, output: str) -> VerificationResult:
        """解析 Cosign 验证输出"""
        # 输出格式：
        # Verification for index.docker.io/library/alpine@sha256::
        # ...
        lines = output.strip().split('\n')
        
        signer = None
        signed_at = None
        
        for line in lines:
            if 'Signer:' in line:
                signer = line.split(':')[1].strip()
            elif 'Timestamp:' in line:
                signed_at = line.split(':')[1].strip()
        
        return VerificationResult(
            verified=True,
            signer=signer,
            signed_at=signed_at
        )
```

### 5.2 签名验证流程

```
┌─────────────────────────────────────────────────────────────────┐
│              镜像签名验证流程                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  签名流程 (Pipeline 中):                                         │
│  ┌─────────────┐                                                │
│  │ 1. 构建镜像  │                                                │
│  └──────┬──────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                                │
│  │ 2. 推送 Harbor│                                                │
│  └──────┬──────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                                │
│  │ 3. 漏洞扫描  │ ←─ 必须通过                                    │
│  └──────┬──────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                                │
│  │ 4. Cosign   │   私钥：Kubernetes Secret                      │
│  │    签名     │   密码：从 Vault 动态获取                        │
│  └──────┬──────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                                │
│  │ 5. 存储签名  │   Harbor 关联签名与镜像                         │
│  └─────────────┘                                                │
│                                                                 │
│  验证流程 (部署时):                                              │
│  ┌─────────────┐                                                │
│  │ 1. 拉取镜像  │                                                │
│  └──────┬──────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                                │
│  │ 2. 验证签名  │   公钥：ConfigMap                             │
│  │             │   失败 → 拒绝部署                              │
│  └──────┬──────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                                │
│  │ 3. 部署镜像  │                                                │
│  └─────────────┘                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 六、镜像清理策略

### 6.1 清理规则配置

```yaml
# 镜像清理策略配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: harbor-cleanup-policy
  namespace: orion-system
data:
  cleanup_policy.yaml: |
    # 全局清理策略
    global:
      # 启用未标记镜像清理
      delete_untagged: true
      
      # 启用保留规则
      keep_recent: 10  # 保留最近 10 个版本
      
    # 按项目分类的清理策略
    projects:
      # 开发项目
      - pattern: ".*-dev$"
        retention:
          days: 7
          keep_count: 10
        exclude_tags:
          - "latest"
          - "stable"
      
      # 生产项目
      - pattern: ".*-prod$"
        retention:
          days: 365
          keep_count: -1  # 永久保留
        exclude_tags:
          - ".*"  # 保留所有标签
      
      # 临时项目
      - pattern: ".*-temp$"
        retention:
          days: 1
          keep_count: 3
        exclude_tags: []
      
      # 基础镜像项目
      - pattern: "^base-images$"
        retention:
          days: 90
          keep_count: 5
        exclude_tags:
          - "latest"
          - "lts"
    
    # 清理执行时间
    schedule:
      cron: "0 3 * * *"  # 每天凌晨 3 点
      timezone: "Asia/Shanghai"
```

### 6.2 清理执行器

```python
# 镜像清理服务
class HarborCleanupService:
    """
    Harbor 镜像清理服务
    """
    
    def __init__(self, harbor_client: HarborClient):
        self.harbor = harbor_client
        self.policies = self._load_policies()
    
    async def cleanup(self) -> CleanupResult:
        """执行清理任务"""
        
        result = CleanupResult()
        
        # 1. 获取所有项目
        projects = await self.harbor.list_projects()
        
        for project in projects:
            # 2. 匹配清理策略
            policy = self._match_policy(project.name)
            if not policy:
                continue
            
            # 3. 获取项目下所有仓库
            repositories = await self.harbor.list_repositories(project.name)
            
            for repo in repositories:
                # 4. 清理仓库
                repo_result = await self._cleanup_repository(
                    project.name, repo.name, policy
                )
                result.deleted_count += repo_result.deleted_count
                result.freed_bytes += repo_result.freed_bytes
        
        return result
    
    async def _cleanup_repository(
        self,
        project_name: str,
        repo_name: str,
        policy: CleanupPolicy
    ) -> RepositoryCleanupResult:
        """清理单个仓库"""
        
        result = RepositoryCleanupResult()
        
        # 1. 获取所有镜像
        artifacts = await self.harbor.list_artifacts(
            project_name, repo_name
        )
        
        # 2. 过滤需要删除的镜像
        to_delete = []
        
        for artifact in artifacts:
            if self._should_delete(artifact, policy):
                to_delete.append(artifact)
        
        # 3. 执行删除
        for artifact in to_delete:
            try:
                await self.harbor.delete_artifact(
                    project_name, repo_name, artifact.digest
                )
                result.deleted_count += 1
                result.freed_bytes += artifact.size
                
            except Exception as e:
                logger.error(
                    f"删除镜像失败：{project_name}/{repo_name}:{artifact.digest}"
                    f"错误：{e}"
                )
        
        return result
    
    def _should_delete(
        self,
        artifact: Artifact,
        policy: CleanupPolicy
    ) -> bool:
        """判断是否应该删除"""
        
        # 检查排除标签
        for tag in artifact.tags:
            if self._match_pattern(tag.name, policy.exclude_tags):
                return False
        
        # 检查保留数量
        if policy.keep_count > 0:
            # 按创建时间排序，保留最近的 N 个
            sorted_artifacts = sorted(
                self._all_artifacts,
                key=lambda a: a.creation_time,
                reverse=True
            )
            if sorted_artifacts.index(artifact) < policy.keep_count:
                return False
        
        # 检查保留天数
        if policy.days > 0:
            age = (datetime.now() - artifact.creation_time).days
            if age < policy.days:
                return False
        
        return True
    
    def _match_pattern(self, value: str, patterns: List[str]) -> bool:
        """匹配通配符模式"""
        for pattern in patterns:
            if re.match(pattern, value):
                return True
        return False
```

---

## 七、Webhook 集成

### 7.1 Harbor Webhook 配置

```yaml
# Harbor Webhook 配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: harbor-webhook-config
  namespace: orion-system
data:
  webhook_config.yaml: |
    # Webhook 端点
    endpoints:
      - name: "Orion Pipeline"
        url: "https://orion.internal/api/webhooks/harbor"
        secret: "${HARBOR_WEBHOOK_SECRET}"
        
        # 触发事件
        events:
          - push_artifact      # 镜像推送
          - pull_artifact      # 镜像拉取
          - scan_completed     # 扫描完成
          - tag_created        # 标签创建
          - tag_deleted        # 标签删除
        
        # 过滤条件
        filters:
          - type: "project"
            value: ".*"  # 所有项目
        
        # 重试配置
        retry:
          max_retries: 3
          retry_interval: 10  # 秒
        
        # SSL 配置
        skip_cert_verify: false
```

### 7.2 Webhook 事件处理

```python
# Harbor Webhook 处理器
class HarborWebhookHandler:
    """
    接收并处理 Harbor Webhook 事件
    """
    
    def __init__(self, nats_client: NATSClient):
        self.nats = nats_client
    
    async def handle_webhook(self, request: Request) -> Response:
        """处理 Harbor Webhook"""
        
        # 1. 验证签名
        signature = request.headers.get('X-Harbor-Signature')
        if not self.verify_signature(request.body, signature):
            return Response(status=401, body="Invalid signature")
        
        # 2. 解析事件
        event = HarborWebhookEvent.parse_raw(request.body)
        
        # 3. 转换为 Orion 事件
        orion_event = self.convert_to_orion_event(event)
        
        # 4. 发布到 NATS
        await self.nats.publish(
            subject=f"harbor.{event.type}",
            payload=orion_event.dict()
        )
        
        return Response(status=200, body="OK")
    
    def convert_to_orion_event(
        self, 
        event: HarborWebhookEvent
    ) -> OrionEvent:
        """Harbor 事件 → Orion 事件"""
        
        if event.type == "push_artifact":
            return OrionEvent(
                type=OrionEvent.ARTIFACT_PUSHED,
                data=ArtifactPushedData(
                    project_name=event.event_data['project']['name'],
                    repo_name=event.event_data['repo_name'],
                    tag=event.event_data['tags'][0],
                    digest=event.event_data['digest'],
                    push_time=event.event_data['occurred_at']
                )
            )
        
        elif event.type == "scan_completed":
            return OrionEvent(
                type=OrionEvent.SCAN_COMPLETED,
                data=ScanCompletedData(
                    project_name=event.event_data['project']['name'],
                    repo_name=event.event_data['repo_name'],
                    tag=event.event_data['tags'][0],
                    status=event.event_data['status'],
                    vulnerabilities=event.event_data['vulnerabilities']
                )
            )
```

---

## 八、监控与告警

### 8.1 监控指标

```yaml
# Prometheus 监控指标
harbor_adapter:
  # API 调用指标
  api_requests_total:
    type: counter
    labels: [endpoint, method, status]
  
  api_request_duration_seconds:
    type: histogram
    labels: [endpoint, method]
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  
  # 镜像指标
  artifacts_total:
    type: gauge
    labels: [project, repo]
  
  artifacts_size_bytes:
    type: gauge
    labels: [project, repo]
  
  # 扫描指标
  scan_jobs_total:
    type: counter
    labels: [status]  # success, failed
  
  scan_duration_seconds:
    type: histogram
    labels: [scanner]
  
  vulnerabilities_total:
    type: counter
    labels: [severity]  # critical, high, medium, low
  
  # 清理指标
  cleanup_jobs_total:
    type: counter
    labels: [status]
  
  cleanup_freed_bytes:
    type: counter
```

### 8.2 告警规则

```yaml
# Prometheus 告警规则
groups:
  - name: harbor_adapter
    rules:
      - alert: HarborAPIHighErrorRate
        expr: |
          sum(rate(harbor_adapter_api_requests_total{status=~"5.."}[5m])) 
          / sum(rate(harbor_adapter_api_requests_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Harbor API 错误率过高"
      
      - alert: HarborCriticalVulnerability
        expr: harbor_adapter_vulnerabilities_total{severity="critical"} > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "发现 Critical 级别漏洞"
      
      - alert: HarborStorageHighUsage
        expr: |
          sum(harbor_adapter_artifacts_size_bytes) 
          / harbor_storage_limit_bytes > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Harbor 存储使用率超过 80%"
```

---

## 九、部署配置

### 9.1 Kubernetes 部署

```yaml
# Harbor Adapter 部署配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: harbor-adapter
  namespace: orion-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app: harbor-adapter
  template:
    metadata:
      labels:
        app: harbor-adapter
    spec:
      containers:
        - name: harbor-adapter
          image: orion-registry.internal/harbor-adapter:v1.0.0
          ports:
            - containerPort: 8080
          env:
            - name: HARBOR_URL
              value: "https://harbor.internal"
            - name: NATS_URL
              value: "nats://orion-nats:4222"
          envFrom:
            - secretRef:
                name: harbor-credentials
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: harbor-adapter
  namespace: orion-system
spec:
  selector:
    app: harbor-adapter
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: harbor-adapter
  namespace: orion-system
spec:
  rules:
    - host: orion.internal
      http:
        paths:
          - path: /api/webhooks/harbor
            pathType: Prefix
            backend:
              service:
                name: harbor-adapter
                port:
                  number: 80
```

---

## 十、总结

### 10.1 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| 镜像推送/拉取 | ✅ | 完整支持 |
| 镜像扫描 | ✅ | 自动触发 + 结果轮询 |
| 镜像签名 | ✅ | Cosign 集成 |
| 版本提升 | ✅ | 5 阶段状态机 |
| 清理策略 | ✅ | 基于保留规则 |
| Webhook 集成 | ✅ | 事件驱动 |
| 监控告警 | ✅ | Prometheus 指标 |

### 10.2 与 Nexus 分工

| 功能 | Harbor | Nexus |
|------|--------|-------|
| 容器镜像 | ✅ 主存储 | ❌ |
| Helm Chart | ✅ | ❌ |
| Maven JAR | ❌ | ✅ 主存储 |
| NPM 包 | ❌ | ✅ 主存储 |
| Python Wheel | ❌ | ✅ 主存储 |
| Go Module | ❌ | ✅ 主存储 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成，待开发_
