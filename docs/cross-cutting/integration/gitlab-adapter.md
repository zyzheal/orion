# GitLab Adapter 集成设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：后端团队  
> 优先级：P0  
> 状态：设计完成

---

## 一、集成架构总览

### 1.1 GitLab 在 Orion 中的定位

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orion 平台                                    │
│                                                                 │
│  用户接口层                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Orion UI   │  │  GitLab MR  │  │  CLI        │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              GitLab Adapter (封装层)                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ Webhook      │  │ REST API     │  │ SSH API      │  │   │
│  │  │ 事件解析器    │  │ 客户端       │  │ 评论回写     │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   GitLab 实例                            │   │
│  │  • 代码仓库 (Git Repository)                             │   │
│  │  • Merge Request                                        │   │
│  │  • CI/CD Pipeline                                       │   │
│  │  • Issues / Wiki                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 集成场景

| 场景 | 触发源 | Orion 动作 | 回写内容 |
|------|--------|-----------|---------|
| **代码提交** | Git Push Webhook | 触发 Pipeline | Pipeline 状态徽章 |
| **MR 创建** | MR Open Webhook | 触发 AI Review Pipeline | AI 审查评论 |
| **MR 更新** | MR Update Webhook | 重新触发 AI Review | 更新审查评论 |
| **MR 合并** | MR Merge Webhook | 触发 Release Pipeline | 部署状态 |
| **Tag 创建** | Tag Push Webhook | 触发 Release/Deploy | 发布说明 |

---

## 二、Webhook 事件映射

### 2.1 事件类型定义

```typescript
// GitLab Webhook 事件类型
enum GitLabWebhookEvent {
  PUSH = "Push Hook",
  TAG_PUSH = "Tag Push Hook",
  MERGE_REQUEST_OPEN = "Merge Request Hook (open)",
  MERGE_REQUEST_UPDATE = "Merge Request Hook (update)",
  MERGE_REQUEST_MERGE = "Merge Request Hook (merge)",
  MERGE_REQUEST_CLOSE = "Merge Request Hook (close)",
  PIPELINE = "Pipeline Hook",
  BUILD = "Build Hook",
  WIKI_PAGE = "Wiki Page Hook",
  ISSUE = "Issue Hook",
  NOTE = "Note Hook"  // 评论
}

// Orion 内部事件类型
enum OrionEvent {
  CODE_PUSH = "code.push",
  TAG_CREATED = "tag.created",
  MR_OPENED = "mr.opened",
  MR_UPDATED = "mr.updated",
  MR_MERGED = "mr.merged",
  MR_CLOSED = "mr.closed",
  PIPELINE_STARTED = "pipeline.started",
  PIPELINE_COMPLETED = "pipeline.completed",
  AI_REVIEW_REQUESTED = "ai.review.requested",
  AI_REVIEW_COMPLETED = "ai.review.completed"
}

// 事件映射表
const EVENT_MAPPING: Record<GitLabWebhookEvent, OrionEvent> = {
  [GitLabWebhookEvent.PUSH]: OrionEvent.CODE_PUSH,
  [GitLabWebhookEvent.TAG_PUSH]: OrionEvent.TAG_CREATED,
  [GitLabWebhookEvent.MERGE_REQUEST_OPEN]: OrionEvent.MR_OPENED,
  [GitLabWebhookEvent.MERGE_REQUEST_UPDATE]: OrionEvent.MR_UPDATED,
  [GitLabWebhookEvent.MERGE_REQUEST_MERGE]: OrionEvent.MR_MERGED,
  [GitLabWebhookEvent.MERGE_REQUEST_CLOSE]: OrionEvent.MR_CLOSED,
  [GitLabWebhookEvent.PIPELINE]: OrionEvent.PIPELINE_COMPLETED,
};
```

### 2.2 Webhook 接收处理

```python
# GitLab Webhook 接收器
class GitLabWebhookHandler:
    """
    接收并处理 GitLab Webhook 事件
    """
    
    def __init__(self, nats_client: NATSClient, secret_token: str):
        self.nats = nats_client
        self.secret_token = secret_token
    
    async def handle_webhook(self, request: Request) -> Response:
        # 1. 验证 GitLab Token
        token = request.headers.get('X-Gitlab-Token')
        if not self.verify_token(token):
            return Response(status=401, body="Invalid token")
        
        # 2. 解析事件类型
        event_type = request.headers.get('X-Gitlab-Event')
        payload = request.json
        
        # 3. 转换为 Orion 事件
        orion_event = self.convert_to_orion_event(event_type, payload)
        
        # 4. 发布到 NATS 事件总线
        await self.nats.publish(
            subject=f"gitlab.{orion_event.type}",
            payload=orion_event.dict(),
            headers={
                "correlation_id": self.generate_correlation_id(payload),
                "source": "gitlab",
                "event_type": event_type
            }
        )
        
        return Response(status=200, body="OK")
    
    def convert_to_orion_event(
        self, 
        event_type: str, 
        payload: Dict
    ) -> OrionEvent:
        """GitLab 事件 → Orion 事件"""
        
        if event_type == "Push Hook":
            return OrionEvent(
                type=OrionEvent.CODE_PUSH,
                data=CodePushData(
                    project_id=payload['project']['id'],
                    project_name=payload['project']['name'],
                    repository=payload['project']['git_http_url'],
                    ref=payload['ref'],
                    commits=payload['commits'],
                    user_name=payload['user_name'],
                    user_email=payload['user_email']
                )
            )
        
        elif event_type == "Merge Request Hook":
            object_attributes = payload['object_attributes']
            return OrionEvent(
                type=OrionEvent.MR_OPENED if object_attributes['action'] == 'open' 
                     else OrionEvent.MR_UPDATED,
                data=MRData(
                    project_id=payload['project']['id'],
                    mr_id=object_attributes['iid'],
                    mr_url=object_attributes['url'],
                    source_branch=object_attributes['source_branch'],
                    target_branch=object_attributes['target_branch'],
                    title=object_attributes['title'],
                    description=object_attributes['description'],
                    author=payload['user']['username'],
                    state=object_attributes['state'],
                    action=object_attributes['action']
                )
            )
```

### 2.3 Webhook 配置示例

```yaml
# GitLab Webhook 配置 (通过 API 自动配置)
apiVersion: v1
kind: ConfigMap
metadata:
  name: gitlab-webhook-config
  namespace: orion-system
data:
  webhook_config.yaml: |
    gitlab:
      url: https://gitlab.internal
      api_version: v4
      
      # Webhook 配置
      webhooks:
        - project_pattern: ".*"  # 所有项目
          events:
            - push_events: true
            - tag_push_events: true
            - merge_requests_events: true
            - pipeline_events: true
          url: https://orion.internal/api/webhooks/gitlab
          secret_token: ${GITLAB_WEBHOOK_SECRET}
          enable_ssl_verification: true
          
      # 排除的项目
      exclude_projects:
        - "archive/*"
        - "deprecated/*"
```

---

## 三、REST API 封装

### 3.1 GitLab API 客户端

```python
# GitLab REST API 封装
class GitLabClient:
    """
    GitLab REST API v4 封装
    提供统一的 API 接口，屏蔽底层细节
    """
    
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.session = aiohttp.ClientSession(
            headers={
                'PRIVATE-TOKEN': token,
                'Content-Type': 'application/json'
            }
        )
    
    # ========== 项目相关 ==========
    
    async def get_project(self, project_id: int) -> Project:
        """获取项目信息"""
        url = f"{self.base_url}/api/v4/projects/{project_id}"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return Project(**data)
    
    async def list_projects(self, search: str = None) -> List[Project]:
        """获取项目列表"""
        params = {'search': search} if search else {}
        url = f"{self.base_url}/api/v4/projects"
        return await self._paginate(url, params)
    
    # ========== Merge Request 相关 ==========
    
    async def get_mr(self, project_id: int, mr_iid: int) -> MergeRequest:
        """获取 MR 详情"""
        url = f"{self.base_url}/api/v4/projects/{project_id}/merge_requests/{mr_iid}"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return MergeRequest(**data)
    
    async def create_mr(
        self, 
        project_id: int,
        source_branch: str,
        target_branch: str,
        title: str,
        description: str = None
    ) -> MergeRequest:
        """创建 MR"""
        url = f"{self.base_url}/api/v4/projects/{project_id}/merge_requests"
        data = {
            'source_branch': source_branch,
            'target_branch': target_branch,
            'title': title,
            'description': description or ''
        }
        async with self.session.post(url, json=data) as resp:
            result = await resp.json()
            return MergeRequest(**result)
    
    async def update_mr(
        self,
        project_id: int,
        mr_iid: int,
        **kwargs
    ) -> MergeRequest:
        """更新 MR"""
        url = f"{self.base_url}/api/v4/projects/{project_id}/merge_requests/{mr_iid}"
        async with self.session.put(url, json=kwargs) as resp:
            result = await resp.json()
            return MergeRequest(**result)
    
    async def merge_mr(
        self,
        project_id: int,
        mr_iid: int,
        merge_commit_message: str = None,
        should_remove_source_branch: bool = True
    ) -> MergeRequest:
        """合并 MR"""
        url = f"{self.base_url}/api/v4/projects/{project_id}/merge_requests/{mr_iid}/merge"
        data = {
            'merge_commit_message': merge_commit_message,
            'should_remove_source_branch': should_remove_source_branch
        }
        async with self.session.put(url, json=data) as resp:
            result = await resp.json()
            return MergeRequest(**result)
    
    # ========== 评论相关 ==========
    
    async def add_mr_comment(
        self,
        project_id: int,
        mr_iid: int,
        body: str,
        commit_id: str = None
    ) -> Note:
        """添加 MR 评论"""
        url = f"{self.base_url}/api/v4/projects/{project_id}/merge_requests/{mr_iid}/notes"
        data = {'body': body}
        if commit_id:
            data['commit_id'] = commit_id
        async with self.session.post(url, json=data) as resp:
            result = await resp.json()
            return Note(**result)
    
    async def update_mr_comment(
        self,
        project_id: int,
        mr_iid: int,
        note_id: int,
        body: str
    ) -> Note:
        """更新 MR 评论"""
        url = f"{self.base_url}/api/v4/projects/{project_id}/merge_requests/{mr_iid}/notes/{note_id}"
        async with self.session.put(url, json={'body': body}) as resp:
            result = await resp.json()
            return Note(**result)
    
    # ========== Pipeline 相关 ==========
    
    async def trigger_pipeline(
        self,
        project_id: int,
        ref: str,
        variables: Dict[str, str] = None
    ) -> Pipeline:
        """触发 Pipeline"""
        url = f"{self.base_url}/api/v4/projects/{project_id}/pipeline"
        data = {'ref': ref}
        if variables:
            data['variables'] = variables
        async with self.session.post(url, json=data) as resp:
            result = await resp.json()
            return Pipeline(**result)
    
    async def get_pipeline(self, project_id: int, pipeline_id: int) -> Pipeline:
        """获取 Pipeline 详情"""
        url = f"{self.base_url}/api/v4/projects/{project_id}/pipelines/{pipeline_id}"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return Pipeline(**data)
    
    # ========== 工具方法 ==========
    
    async def _paginate(self, url: str, params: Dict = None) -> List[Any]:
        """处理分页"""
        all_items = []
        page = 1
        per_page = 100
        
        while True:
            current_params = {**(params or {}), 'page': page, 'per_page': per_page}
            async with self.session.get(url, params=current_params) as resp:
                items = await resp.json()
                if not items:
                    break
                all_items.extend(items)
                page += 1
        
        return all_items
```

### 3.2 数据模型定义

```python
# GitLab 数据模型
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class Project(BaseModel):
    id: int
    name: str
    path_with_namespace: str
    git_http_url: str
    git_ssh_url: str
    web_url: str
    visibility: str  # private, internal, public
    default_branch: str
    archived: bool
    created_at: datetime
    last_activity_at: datetime

class User(BaseModel):
    id: int
    username: str
    name: str
    email: str
    avatar_url: str
    web_url: str

class MergeRequest(BaseModel):
    id: int
    iid: int
    project_id: int
    title: str
    description: str
    state: str  # opened, merged, closed
    merged: bool
    author: User
    assignee: Optional[User]
    source_branch: str
    target_branch: str
    sha: str
    web_url: str
    created_at: datetime
    updated_at: datetime
    merged_at: Optional[datetime]
    closed_at: Optional[datetime]
    merge_status: str  # can_be_merged, cannot_be_merged
    user_notes_count: int

class Note(BaseModel):
    id: int
    body: str
    author: User
    created_at: datetime
    updated_at: datetime
    system: bool  # 是否为系统消息
    resolvable: bool
    resolved: bool
    resolved_by: Optional[User]

class Pipeline(BaseModel):
    id: int
    iid: int
    project_id: int
    status: str  # running, success, failed, canceled
    ref: str
    sha: str
    web_url: str
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    duration: Optional[int]  # 秒
    user: User

class Commit(BaseModel):
    id: str
    short_id: str
    title: str
    message: str
    author_name: str
    author_email: str
    committed_date: datetime
    web_url: str
```

---

## 四、MR 评论集成

### 4.1 AI Review 评论格式

```python
# AI Review 评论生成器
class AIReviewCommentGenerator:
    """
    生成 AI 代码审查评论
    """
    
    def generate_review_comment(
        self,
        mr: MergeRequest,
        review_result: AIReviewResult
    ) -> str:
        """生成 AI 审查评论"""
        
        # 评论模板
        template = """
## 🤖 Orion AI 代码审查

**审查时间**: {review_time}  
**审查模型**: {model}  
**审查状态**: {status}

---

### 📊 审查摘要

| 指标 | 结果 |
|------|------|
| 变更文件数 | {files_changed} |
| 变更行数 | {lines_changed} |
| 发现问题数 | {issues_count} |
| 审查耗时 | {duration} |

---

### 🚨 严重问题 ({critical_count})

{critical_issues}

---

### ⚠️ 警告 ({warning_count})

{warning_issues}

---

### 💡 建议 ({suggestion_count})

{suggestion_issues}

---

### ✅ 亮点 ({positive_count})

{positive_feedback}

---

**下一步**:
- [ ] 修复所有严重问题
- [ ] 审查警告项
- [ ] 考虑建议项

> 审查由 Orion AI 自动生成，如有疑问请联系平台团队
"""
        
        # 填充数据
        return template.format(
            review_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            model=review_result.model,
            status="✅ 通过" if review_result.passed else "❌ 需修复",
            files_changed=len(review_result.changed_files),
            lines_changed=review_result.lines_changed,
            issues_count=len(review_result.issues),
            duration=review_result.duration,
            critical_count=len(review_result.critical_issues),
            critical_issues=self._format_issues(review_result.critical_issues),
            warning_count=len(review_result.warning_issues),
            warning_issues=self._format_issues(review_result.warning_issues),
            suggestion_count=len(review_result.suggestion_issues),
            suggestion_issues=self._format_issues(review_result.suggestion_issues),
            positive_count=len(review_result.positive_feedback),
            positive_feedback=self._format_positive(review_result.positive_feedback)
        )
    
    def _format_issues(self, issues: List[Issue]) -> str:
        """格式化问题列表"""
        if not issues:
            return "无"
        
        lines = []
        for issue in issues:
            lines.append(f"- **{issue.type}** ({issue.severity}): {issue.message}")
            lines.append(f"  - 文件：`{issue.file}:{issue.line}`")
            lines.append(f"  - 建议：{issue.suggestion}")
            lines.append("")
        
        return "\n".join(lines)
    
    def _format_positive(self, feedbacks: List[str]) -> str:
        """格式化正面反馈"""
        if not feedbacks:
            return "无"
        return "\n".join([f"- {fb}" for fb in feedbacks])
```

### 4.2 评论回写流程

```python
# MR 评论回写服务
class MRCommentService:
    """
    将 AI 审查结果回写到 GitLab MR
    """
    
    def __init__(self, gitlab_client: GitLabClient):
        self.gitlab = gitlab_client
    
    async def post_ai_review(
        self,
        project_id: int,
        mr_iid: int,
        review_result: AIReviewResult
    ):
        """发布 AI 审查评论到 MR"""
        
        # 1. 生成评论
        generator = AIReviewCommentGenerator()
        comment_body = generator.generate_review_comment(
            mr=await self.gitlab.get_mr(project_id, mr_iid),
            review_result=review_result
        )
        
        # 2. 检查是否已有 AI 评论
        existing_comment = await self._find_existing_ai_comment(
            project_id, mr_iid
        )
        
        # 3. 更新或创建评论
        if existing_comment:
            await self.gitlab.update_mr_comment(
                project_id=project_id,
                mr_iid=mr_iid,
                note_id=existing_comment.id,
                body=comment_body
            )
        else:
            await self.gitlab.add_mr_comment(
                project_id=project_id,
                mr_iid=mr_iid,
                body=comment_body
            )
    
    async def _find_existing_ai_comment(
        self,
        project_id: int,
        mr_iid: int
    ) -> Optional[Note]:
        """查找已有的 AI 审查评论"""
        notes = await self.gitlab.get_mr_comments(project_id, mr_iid)
        for note in notes:
            if note.system and "Orion AI" in note.body:
                return note
        return None
```

---

## 五、Pipeline 状态回写

### 5.1 状态徽章更新

```python
# Pipeline 状态回写服务
class PipelineStatusService:
    """
    将 Orion Pipeline 状态回写到 GitLab Commit
    """
    
    def __init__(self, gitlab_client: GitLabClient):
        self.gitlab = gitlab_client
    
    async def update_commit_status(
        self,
        project_id: int,
        commit_sha: str,
        pipeline_status: PipelineStatus
    ):
        """
        更新 Commit 状态
        
        状态映射:
        - pending → 等待中
        - running → 运行中
        - success → 通过
        - failed → 失败
        - cancelled → 取消
        """
        
        status_map = {
            'pending': 'pending',
            'running': 'running',
            'success': 'success',
            'failed': 'failed',
            'cancelled': 'canceled'
        }
        
        # 构建状态数据
        state_data = {
            'state': status_map.get(pipeline_status.status, 'pending'),
            'name': 'orion/pipeline',
            'description': self._build_description(pipeline_status),
            'target_url': f"https://orion.internal/pipelines/{pipeline_status.pipeline_id}",
            'context': 'orion/pipeline'
        }
        
        # 调用 GitLab API
        url = f"{self.gitlab.base_url}/api/v4/projects/{project_id}/statuses/{commit_sha}"
        await self.gitlab.session.post(url, json=state_data)
    
    def _build_description(self, status: PipelineStatus) -> str:
        """构建状态描述"""
        if status.status == 'running':
            return f"运行中 - Stage: {status.current_stage}"
        elif status.status == 'success':
            return f"通过 - 耗时：{status.duration}"
        elif status.status == 'failed':
            return f"失败 - Stage: {status.failed_stage}"
        else:
            return status.status
```

### 5.2 状态回写示例

```yaml
# GitLab Commit 状态显示示例
# 在 MR 页面显示:

┌─────────────────────────────────────────────────────────────┐
│  Merge Request !478: 支付服务 v2.3.0                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ Some checks passed                                      │
│  ─────────────────────────────────────────────────────      │
│  ✅ ci/run-pipeline  Pipeline #12345 succeeded              │
│  ✅ orion/pipeline   通过 - 耗时：8m32s                     │
│  ⚠️  security-scan   1 high severity issue                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、用户同步

### 6.1 用户同步流程

```python
# GitLab 用户同步服务
class GitLabUserSyncService:
    """
    从 GitLab 同步用户到 Orion
    """
    
    def __init__(
        self, 
        gitlab_client: GitLabClient,
        orion_user_store: UserStore
    ):
        self.gitlab = gitlab_client
        self.user_store = orion_user_store
    
    async def sync_users(self) -> SyncResult:
        """同步 GitLab 用户到 Orion"""
        
        # 1. 获取 GitLab 所有用户
        gitlab_users = await self.gitlab.list_users(active=True)
        
        # 2. 获取 Orion 现有用户
        orion_users = await self.user_store.get_all()
        
        # 3. 计算差异
        result = SyncResult()
        
        for gitlab_user in gitlab_users:
            orion_user = orion_users.get(gitlab_user.email)
            
            if not orion_user:
                # 新用户 → 创建
                await self._create_user(gitlab_user)
                result.created += 1
            else:
                # 现有用户 → 更新信息
                await self._update_user(orion_user, gitlab_user)
                result.updated += 1
        
        # 4. 禁用 Orion 中有但 GitLab 中没有的用户
        gitlab_emails = {u.email for u in gitlab_users}
        for email, user in orion_users.items():
            if email not in gitlab_emails and user.source == 'gitlab':
                await self.user_store.disable(user.id)
                result.disabled += 1
        
        return result
    
    async def _create_user(self, gitlab_user: User):
        """创建 Orion 用户"""
        await self.user_store.create(
            email=gitlab_user.email,
            name=gitlab_user.name,
            username=gitlab_user.username,
            avatar_url=gitlab_user.avatar_url,
            source='gitlab',
            source_id=gitlab_user.id,
            status='active',
            role='developer'  # 默认角色，后续从 HR 同步
        )
    
    async def _update_user(self, orion_user: User, gitlab_user: User):
        """更新 Orion 用户信息"""
        await self.user_store.update(
            user_id=orion_user.id,
            data={
                'name': gitlab_user.name,
                'avatar_url': gitlab_user.avatar_url,
                'last_sync_at': datetime.now()
            }
        )
```

### 6.2 定时同步任务

```yaml
# Kubernetes CronJob 配置
apiVersion: batch/v1
kind: CronJob
metadata:
  name: gitlab-user-sync
  namespace: orion-system
spec:
  schedule: "0 2 * * *"  # 每天凌晨 2 点
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: sync
              image: orion-registry.internal/user-sync:v1.0.0
              env:
                - name: GITLAB_URL
                  value: "https://gitlab.internal"
                - name: GITLAB_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: gitlab-admin-token
                      key: token
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: orion-db-credentials
                      key: url
          restartPolicy: OnFailure
```

---

## 七、配置管理

### 7.1 GitLab 实例配置

```yaml
# GitLab 实例配置 (支持多实例)
apiVersion: v1
kind: ConfigMap
metadata:
  name: gitlab-instances-config
  namespace: orion-system
data:
  instances.yaml: |
    # 主 GitLab 实例
    primary:
      id: 1
      name: "GitLab 主实例"
      url: https://gitlab.internal
      api_url: https://gitlab.internal/api/v4
      auth:
        type: oauth2
        client_id: ${GITLAB_OAUTH_CLIENT_ID}
        client_secret: ${GITLAB_OAUTH_CLIENT_SECRET}
        token_url: https://sso.internal/oauth/token
      webhook:
        secret_token: ${GITLAB_WEBHOOK_SECRET}
        url: https://orion.internal/api/webhooks/gitlab
      sync:
        enabled: true
        interval: "0 2 * * *"  # 每天凌晨 2 点
        users: true
        projects: true
      
    # 备用 GitLab 实例 (如集团多套 GitLab)
    backup:
      id: 2
      name: "GitLab 备用实例"
      url: https://gitlab-backup.internal
      api_url: https://gitlab-backup.internal/api/v4
      auth:
        type: oauth2
        client_id: ${GITLAB_BACKUP_OAUTH_CLIENT_ID}
        client_secret: ${GITLAB_BACKUP_OAUTH_CLIENT_SECRET}
      webhook:
        enabled: false  # 备用实例不接收 webhook
      sync:
        enabled: false
```

### 7.2 Kubernetes Secret

```yaml
# GitLab 认证信息
apiVersion: v1
kind: Secret
metadata:
  name: gitlab-credentials
  namespace: orion-system
type: Opaque
stringData:
  # OAuth 凭证
  oauth-client-id: "xxx"
  oauth-client-secret: "xxx"
  
  # Webhook Secret
  webhook-secret: "xxx"
  
  # Admin Token (用于用户同步)
  admin-token: "glpat-xxx"
```

---

## 八、错误处理与降级

### 8.1 错误处理策略

```python
# GitLab API 错误处理
class GitLabAPIError(Exception):
    """GitLab API 错误"""
    pass

class GitLabRateLimitError(GitLabAPIError):
    """GitLab 速率限制"""
    pass

class GitLabErrorHandler:
    """
    GitLab API 错误处理
    """
    
    async def handle_api_error(self, error: Exception, context: str):
        """处理 API 错误"""
        
        if isinstance(error, aiohttp.ClientResponseError):
            if error.status == 429:
                # 速率限制 → 指数退避重试
                raise GitLabRateLimitError(f"GitLab 速率限制：{context}")
            
            elif error.status == 401:
                # 认证失败 → 刷新 Token
                await self._refresh_token()
                return RetryAction.RETRY
            
            elif error.status == 403:
                # 权限不足 → 记录审计日志
                await self._log_audit_violation(context)
                raise GitLabAPIError(f"权限不足：{context}")
            
            elif error.status == 404:
                # 资源不存在 → 返回 None
                return None
            
            elif error.status >= 500:
                # 服务器错误 → 重试
                return RetryAction.RETRY
        
        # 网络错误 → 重试
        if isinstance(error, aiohttp.ClientError):
            return RetryAction.RETRY
        
        # 其他错误 → 抛出
        raise error
    
    async def _refresh_token(self):
        """刷新 OAuth Token"""
        # 实现 Token 刷新逻辑
        pass
```

### 8.2 降级策略

```python
# GitLab 降级策略
class GitLabFallbackStrategy:
    """
    GitLab 服务降级策略
    """
    
    def __init__(self):
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60
        )
        self.local_cache = LocalCache(ttl=300)  # 5 分钟缓存
    
    async def get_project(self, project_id: int) -> Optional[Project]:
        """获取项目 (带降级)"""
        
        try:
            # 尝试从 GitLab API 获取
            return await self.circuit_breaker.call(
                self.gitlab_client.get_project,
                project_id
            )
        
        except CircuitBreakerError:
            # 熔断器打开 → 从缓存读取
            logger.warning("GitLab API 熔断，从缓存读取")
            return self.local_cache.get(f"project:{project_id}")
        
        except GitLabAPIError as e:
            # API 错误 → 记录并返回缓存
            logger.error(f"GitLab API 错误：{e}")
            return self.local_cache.get(f"project:{project_id}")
    
    async def post_comment(self, project_id: int, mr_iid: int, body: str):
        """发布评论 (带降级)"""
        
        try:
            await self.gitlab_client.add_mr_comment(
                project_id, mr_iid, body
            )
        
        except GitLabAPIError as e:
            # 评论失败 → 记录到本地，稍后重试
            logger.error(f"评论发布失败：{e}")
            await self._queue_for_retry(
                action="comment",
                data={
                    "project_id": project_id,
                    "mr_iid": mr_iid,
                    "body": body
                }
            )
    
    async def _queue_for_retry(self, action: str, data: Dict):
        """将操作加入重试队列"""
        await self.nats.publish(
            subject="gitlab.fallback.retry",
            payload={"action": action, "data": data}
        )
```

---

## 九、监控与告警

### 9.1 监控指标

```yaml
# Prometheus 监控指标
gitlab_adapter:
  # API 调用指标
  api_requests_total:
    type: counter
    labels: [endpoint, method, status]
    description: "GitLab API 请求总数"
  
  api_request_duration_seconds:
    type: histogram
    labels: [endpoint, method]
    buckets: [0.1, 0.5, 1, 2, 5, 10]
    description: "GitLab API 请求延迟"
  
  # Webhook 指标
  webhook_events_total:
    type: counter
    labels: [event_type, project_id]
    description: "接收的 Webhook 事件数"
  
  webhook_processing_duration_seconds:
    type: histogram
    labels: [event_type]
    description: "Webhook 处理延迟"
  
  # 同步指标
  user_sync_duration_seconds:
    type: histogram
    description: "用户同步耗时"
  
  user_sync_created_total:
    type: counter
    description: "同步创建的用户数"
  
  # 熔断器指标
  circuit_breaker_state:
    type: gauge
    labels: [service]
    description: "熔断器状态 (0=closed, 1=open, 2=half-open)"
```

### 9.2 告警规则

```yaml
# Prometheus 告警规则
groups:
  - name: gitlab_adapter
    rules:
      - alert: GitLabAPIHighErrorRate
        expr: |
          sum(rate(gitlab_adapter_api_requests_total{status=~"5.."}[5m])) 
          / sum(rate(gitlab_adapter_api_requests_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "GitLab API 错误率过高"
          description: "GitLab API 错误率超过 10%，当前值 {{ $value | humanizePercentage }}"
      
      - alert: GitLabWebhookLag
        expr: |
          time() - gitlab_adapter_webhook_events_total_timestamp > 300
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "GitLab Webhook 延迟"
          description: "超过 5 分钟未收到 Webhook 事件"
      
      - alert: GitLabCircuitBreakerOpen
        expr: gitlab_adapter_circuit_breaker_state{service="gitlab_api"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "GitLab API 熔断器打开"
          description: "GitLab API 熔断器已打开，服务降级中"
```

---

## 十、测试策略

### 10.1 单元测试

```python
# GitLab Adapter 单元测试
import pytest
from unittest.mock import AsyncMock, MagicMock

class TestGitLabWebhookHandler:
    
    @pytest.fixture
    def handler(self):
        nats_client = AsyncMock()
        return GitLabWebhookHandler(nats_client, secret_token="test-secret")
    
    @pytest.mark.asyncio
    async def test_push_webhook(self, handler):
        """测试 Push Webhook 处理"""
        
        # 准备测试数据
        payload = {
            "project": {
                "id": 1,
                "name": "test-project",
                "git_http_url": "https://gitlab.internal/test/test-project.git"
            },
            "ref": "refs/heads/main",
            "commits": [
                {
                    "id": "abc123",
                    "message": "feat: add payment feature",
                    "author": {"name": "张三", "email": "zhangsan@company.com"}
                }
            ],
            "user_name": "张三"
        }
        
        # 调用处理
        request = MagicMock(json=payload)
        request.headers = {
            'X-Gitlab-Token': 'test-secret',
            'X-Gitlab-Event': 'Push Hook'
        }
        
        response = await handler.handle_webhook(request)
        
        # 验证
        assert response.status == 200
        handler.nats.publish.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_invalid_token(self, handler):
        """测试无效 Token"""
        
        request = MagicMock()
        request.headers = {'X-Gitlab-Token': 'wrong-token'}
        
        response = await handler.handle_webhook(request)
        
        assert response.status == 401
```

### 10.2 集成测试

```python
# GitLab Adapter 集成测试
@pytest.mark.integration
class TestGitLabClientIntegration:
    
    @pytest.fixture
    async def gitlab_client(self):
        client = GitLabClient(
            base_url=os.environ['GITLAB_URL'],
            token=os.environ['GITLAB_TOKEN']
        )
        yield client
        await client.session.close()
    
    @pytest.mark.asyncio
    async def test_get_project(self, gitlab_client):
        """测试获取项目"""
        
        project = await gitlab_client.get_project(project_id=1)
        
        assert project.id == 1
        assert project.name != ""
        assert project.git_http_url != ""
    
    @pytest.mark.asyncio
    async def test_create_mr(self, gitlab_client):
        """测试创建 MR"""
        
        mr = await gitlab_client.create_mr(
            project_id=1,
            source_branch="feature/test",
            target_branch="main",
            title="Test: 集成测试 MR",
            description="这是一个测试 MR"
        )
        
        assert mr.iid > 0
        assert mr.state == "opened"
        
        # 清理：关闭 MR
        await gitlab_client.update_mr(
            project_id=1,
            mr_iid=mr.iid,
            state_event="close"
        )
```

---

## 十一、部署配置

### 11.1 Kubernetes 部署

```yaml
# GitLab Adapter 部署配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gitlab-adapter
  namespace: orion-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app: gitlab-adapter
  template:
    metadata:
      labels:
        app: gitlab-adapter
    spec:
      containers:
        - name: gitlab-adapter
          image: orion-registry.internal/gitlab-adapter:v1.0.0
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: GITLAB_URL
              value: "https://gitlab.internal"
            - name: NATS_URL
              value: "nats://orion-nats:4222"
          envFrom:
            - secretRef:
                name: gitlab-credentials
            - configMapRef:
                name: gitlab-instances-config
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: gitlab-adapter
  namespace: orion-system
spec:
  selector:
    app: gitlab-adapter
  ports:
    - port: 80
      targetPort: 8080
      name: http
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gitlab-adapter
  namespace: orion-system
spec:
  rules:
    - host: orion.internal
      http:
        paths:
          - path: /api/webhooks/gitlab
            pathType: Prefix
            backend:
              service:
                name: gitlab-adapter
                port:
                  number: 80
```

---

## 十二、总结

### 12.1 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| Webhook 事件接收 | ✅ | 支持 Push/MR/Pipeline 等事件 |
| REST API 封装 | ✅ | 完整封装 GitLab API v4 |
| MR 评论回写 | ✅ | AI Review 结果回写 |
| Pipeline 状态回写 | ✅ | Commit 状态徽章 |
| 用户同步 | ✅ | 定时同步 GitLab 用户 |
| 多实例支持 | ✅ | 支持集团多 GitLab |
| 降级策略 | ✅ | 熔断器 + 本地缓存 |
| 监控告警 | ✅ | Prometheus 指标 + 告警规则 |

### 12.2 待办事项

| 事项 | 优先级 | 预计工作量 |
|------|--------|-----------|
| Gerrit Adapter 开发 | P1 | 10 人日 |
| GitHub Adapter 开发 | P2 | 8 人日 |
| 多 GitLab 实例测试 | P1 | 3 人日 |
| 性能优化 (批量 API) | P2 | 2 人日 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成，待开发_
