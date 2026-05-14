# Gerrit Adapter 集成设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：后端团队  
> 优先级：P1  
> 状态：设计完成

---

## 一、集成架构总览

### 1.1 Gerrit 在 Orion 中的定位

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orion 平台                                    │
│                                                                 │
│  用户接口层                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Orion UI   │  │  Gerrit UI  │  │  CLI        │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Gerrit Adapter (封装层)                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ Stream-Events│  │ REST API     │  │ SSH API      │  │   │
│  │  │ 事件监听器    │  │ 客户端       │  │ 打分/评论    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Gerrit 实例                            │   │
│  │  • 代码评审 (Code Review)                                │   │
│  │  • Patch Set 管理                                        │   │
│  │  • 权限管理 (Project/Branch)                             │   │
│  │  • 提交队列 (Submit Queue)                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Gerrit vs GitLab 对比

| 特性 | Gerrit | GitLab | Orion 适配策略 |
|------|--------|--------|---------------|
| **代码评审** | Patch Set + 打分 | Merge Request | 统一为 MR 模型 |
| **提交模型** | Cherry-Pick 合并 | Merge Commit | 适配两种模式 |
| **权限管理** | 细粒度 Project/Branch | Group/Role | 权限映射层 |
| **事件系统** | Stream-Events | Webhook | 统一事件模型 |
| **CI 集成** | Verified 打分 | Pipeline 状态 | 状态映射 |

### 1.3 集成场景

| 场景 | 触发源 | Orion 动作 | Gerrit 动作 |
|------|--------|-----------|-----------|
| **Patch Set 创建** | Stream-Events | 触发 AI Review Pipeline | 等待 Verified 打分 |
| **AI 审查完成** | Pipeline 完成 | Code-Review 打分 + 评论 | 显示审查结果 |
| **CI 完成** | Pipeline 完成 | Verified 打分 | 显示 CI 状态 |
| **提交批准** | 打分满足条件 | 触发 Submit | 合并到目标分支 |

---

## 二、Stream-Events 监听

### 2.1 事件流架构

```python
# Gerrit Stream-Events 监听器
class GerritStreamEventsListener:
    """
    监听 Gerrit Stream-Events
    通过 SSH 连接到 Gerrit 的 event stream
    """
    
    def __init__(
        self,
        gerrit_host: str,
        gerrit_port: int,
        ssh_key_path: str,
        nats_client: NATSClient
    ):
        self.host = gerrit_host
        self.port = gerrit_port
        self.ssh_key = ssh_key_path
        self.nats = nats_client
        self.ssh_process = None
    
    async def start(self):
        """启动事件监听"""
        
        # SSH 连接到 Gerrit event stream
        # 命令：ssh -p 29418 review.example.com gerrit stream-events
        cmd = [
            'ssh',
            '-i', self.ssh_key,
            '-p', str(self.port),
            f'{self.host}',
            'gerrit', 'stream-events'
        ]
        
        self.ssh_process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # 启动读取协程
        asyncio.create_task(self._read_events())
    
    async def _read_events(self):
        """读取事件流"""
        
        while True:
            if self.ssh_process.stdout.at_eof():
                logger.warning("Gerrit event stream 断开")
                await asyncio.sleep(5)
                await self.start()  # 重连
                break
            
            # 读取一行 JSON 事件
            line = await self.ssh_process.stdout.readline()
            if not line:
                continue
            
            try:
                event_data = json.loads(line.decode())
                await self._handle_event(event_data)
            except json.JSONDecodeError as e:
                logger.error(f"解析事件失败：{e}")
    
    async def _handle_event(self, event_data: Dict):
        """处理 Gerrit 事件"""
        
        event_type = event_data.get('type')
        
        if event_type == 'patchset-created':
            await self._handle_patchset_created(event_data)
        
        elif event_type == 'comment-added':
            await self._handle_comment_added(event_data)
        
        elif event_type == 'change-merged':
            await self._handle_change_merged(event_data)
        
        elif event_type == 'change-abandoned':
            await self._handle_change_abandoned(event_data)
        
        elif event_type == 'change-restored':
            await self._handle_change_restored(event_data)
        
        else:
            logger.debug(f"未处理的事件类型：{event_type}")
    
    async def _handle_patchset_created(self, event_data: Dict):
        """
        处理 Patch Set 创建事件
        
        触发 Orion AI Review Pipeline
        """
        
        # 转换为 Orion 事件
        orion_event = {
            'type': 'gerrit.patchset.created',
            'data': {
                'project': event_data['change']['project'],
                'change_id': event_data['change']['id'],
                'change_number': event_data['change']['number'],
                'patch_set': event_data['patchSet']['number'],
                'revision': event_data['patchSet']['revision'],
                'ref': event_data['change']['branch'],
                'topic': event_data['change'].get('topic'),
                'owner': event_data['change']['owner']['email'],
                'subject': event_data['change']['subject'],
                'created_at': event_data['change']['createdOn']
            }
        }
        
        # 发布到 NATS
        await self.nats.publish(
            subject="gerrit.patchset.created",
            payload=orion_event
        )
        
        logger.info(
            f"Patch Set 创建：{event_data['change']['number']} "
            f"PS{event_data['patchSet']['number']}"
        )
    
    async def _handle_comment_added(self, event_data: Dict):
        """处理评论添加事件"""
        
        orion_event = {
            'type': 'gerrit.comment.added',
            'data': {
                'project': event_data['change']['project'],
                'change_number': event_data['change']['number'],
                'comment': event_data['comment'],
                'author': event_data['author']['email'],
                'patch_set': event_data['patchSet']['number']
            }
        }
        
        await self.nats.publish(
            subject="gerrit.comment.added",
            payload=orion_event
        )
    
    async def _handle_change_merged(self, event_data: Dict):
        """处理变更合并事件"""
        
        orion_event = {
            'type': 'gerrit.change.merged',
            'data': {
                'project': event_data['change']['project'],
                'change_number': event_data['change']['number'],
                'merged_by': event_data['submitter']['email'],
                'merged_at': event_data['change']['lastUpdatedOn']
            }
        }
        
        await self.nats.publish(
            subject="gerrit.change.merged",
            payload=orion_event
        )
```

### 2.2 事件类型映射

```python
# Gerrit 事件类型定义
class GerritEventType(Enum):
    """Gerrit Stream-Events 类型"""
    
    PATCHSET_CREATED = "patchset-created"
    CHANGE_CREATED = "change-created"
    CHANGE_UPDATED = "change-updated"
    COMMENT_ADDED = "comment-added"
    CHANGE_MERGED = "change-merged"
    CHANGE_ABANDONED = "change-abandoned"
    CHANGE_RESTORED = "change-restored"
    REFS_UPDATED = "refs-updated"
    PROJECT_CREATED = "project-created"
    PROJECT_UPDATED = "project-updated"

# Gerrit → Orion 事件映射
EVENT_MAPPING = {
    GerritEventType.PATCHSET_CREATED: OrionEvent.MR_UPDATED,
    GerritEventType.CHANGE_CREATED: OrionEvent.MR_OPENED,
    GerritEventType.CHANGE_UPDATED: OrionEvent.MR_UPDATED,
    GerritEventType.COMMENT_ADDED: OrionEvent.MR_COMMENTED,
    GerritEventType.CHANGE_MERGED: OrionEvent.MR_MERGED,
    GerritEventType.CHANGE_ABANDONED: OrionEvent.MR_CLOSED,
    GerritEventType.CHANGE_RESTORED: OrionEvent.MR_RESTORED,
}
```

---

## 三、SSH API 集成

### 3.1 Gerrit SSH 客户端

```python
# Gerrit SSH API 客户端
class GerritSSHClient:
    """
    Gerrit SSH API 客户端
    用于打分、评论、提交等操作
    """
    
    def __init__(
        self,
        host: str,
        port: int,
        ssh_key_path: str,
        username: str
    ):
        self.host = host
        self.port = port
        self.ssh_key = ssh_key_path
        self.username = username
    
    async def _execute_ssh_command(self, command: str) -> str:
        """执行 SSH 命令"""
        
        cmd = [
            'ssh',
            '-i', self.ssh_key,
            '-p', str(self.port),
            f'{self.username}@{self.host}',
            command
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            raise GerritSSHError(f"SSH 命令失败：{stderr.decode()}")
        
        return stdout.decode()
    
    # ========== 打分相关 ==========
    
    async def set_review(
        self,
        change_number: str,
        code_review: int = None,      # -2 ~ +2
        verified: int = None,          # -1 ~ +1
        message: str = None
    ):
        """
        设置评审打分
        
        Code-Review: -2, -1, 0, +1, +2
        Verified: -1, 0, +1
        """
        
        labels = []
        if code_review is not None:
            labels.append(f"Code-Review={code_review}")
        if verified is not None:
            labels.append(f"Verified={verified}")
        
        label_str = "--" + " --".join(labels)
        
        # Gerrit review 命令
        # ssh -p 29418 review.example.com gerrit review --code-review +2 <change-id>
        command = f"gerrit review {label_str} {change_number}"
        
        if message:
            # 消息需要转义
            escaped_message = message.replace('"', '\\"')
            command += f' --message "{escaped_message}"'
        
        result = await self._execute_ssh_command(command)
        return result
    
    async def add_comment(
        self,
        change_number: str,
        message: str,
        patch_set: int = None
    ):
        """添加评论"""
        
        command = f'gerrit review --message "{message}" {change_number}'
        
        if patch_set:
            command += f" --patch-set {patch_set}"
        
        await self._execute_ssh_command(command)
    
    # ========== 提交相关 ==========
    
    async def submit_change(self, change_number: str):
        """提交变更"""
        
        command = f"gerrit review --submit {change_number}"
        await self._execute_ssh_command(command)
    
    async def abandon_change(
        self,
        change_number: str,
        reason: str = None
    ):
        """废弃变更"""
        
        command = f"gerrit review --abandon {change_number}"
        
        if reason:
            escaped_reason = reason.replace('"', '\\"')
            command += f' --message "{escaped_reason}"'
        
        await self._execute_ssh_command(command)
    
    # ========== 查询相关 ==========
    
    async def query_change(self, change_number: str) -> Dict:
        """查询变更详情"""
        
        command = f'gerrit query --current --format JSON {change_number}'
        result = await self._execute_ssh_command(command)
        
        # 解析 JSON (可能有多行)
        lines = result.strip().split('\n')
        if len(lines) > 1:
            # 多行 JSON，取第一行
            return json.loads(lines[0])
        return json.loads(result)
    
    async def query_changes(self, query: str) -> List[Dict]:
        """查询多个变更"""
        
        command = f'gerrit query --current --format JSON "{query}"'
        result = await self._execute_ssh_command(command)
        
        changes = []
        for line in result.strip().split('\n'):
            if line:
                changes.append(json.loads(line))
        
        return changes
```

### 3.2 AI Review 打分回写

```python
# AI Review 打分服务
class AIReviewService:
    """
    AI 代码审查并回写到 Gerrit
    """
    
    def __init__(
        self,
        ssh_client: GerritSSHClient,
        ai_review_engine: AIReviewEngine
    ):
        self.ssh = ssh_client
        self.ai_engine = ai_review_engine
    
    async def review_patchset(
        self,
        change_number: str,
        patch_set: int,
        project: str
    ):
        """
        审查 Patch Set 并回写结果
        """
        
        # 1. 获取变更详情
        change_info = await self.ssh.query_change(change_number)
        
        # 2. 获取代码 diff
        diff = await self._fetch_diff(
            project,
            change_info['currentRevision']['commit']['commit']
        )
        
        # 3. AI 审查
        review_result = await self.ai_engine.review_code(
            diff=diff,
            context={
                'project': project,
                'change_number': change_number,
                'patch_set': patch_set
            }
        )
        
        # 4. 生成评论
        comment = self._generate_review_comment(review_result)
        
        # 5. 设置打分和评论
        code_review_score = self._calculate_code_review_score(review_result)
        
        await self.ssh.set_review(
            change_number=change_number,
            code_review=code_review_score,
            message=comment
        )
        
        logger.info(
            f"AI 审查完成：{change_number} PS{patch_set} "
            f"Code-Review={code_review_score}"
        )
    
    def _calculate_code_review_score(
        self,
        result: AIReviewResult
    ) -> int:
        """
        根据 AI 审查结果计算 Code-Review 打分
        
        +2: 完美，无问题
        +1: 通过，仅有建议
         0: 需要关注，有警告
        -1: 需要修复，有严重问题
        -2: 必须修复，有阻塞问题
        """
        
        if result.critical_count > 0:
            return -2
        elif result.high_count > 0:
            return -1
        elif result.medium_count > 0:
            return 0
        elif result.suggestion_count > 0:
            return +1
        else:
            return +2
    
    def _generate_review_comment(
        self,
        result: AIReviewResult
    ) -> str:
        """生成审查评论"""
        
        template = """
## 🤖 Orion AI 代码审查

**审查状态**: {status}

### 审查摘要

| 级别 | 数量 |
|------|------|
| 🔴 Critical | {critical} |
| 🟠 High | {high} |
| 🟡 Medium | {medium} |
| 💡 Suggestion | {suggestion} |

### 详细问题

{details}

---

> 此审查由 Orion AI 自动生成
"""
        
        return template.format(
            status="✅ 通过" if result.passed else "❌ 需修复",
            critical=result.critical_count,
            high=result.high_count,
            medium=result.medium_count,
            suggestion=result.suggestion_count,
            details=self._format_issues(result.issues)
        )
```

---

## 四、REST API 封装

### 4.1 Gerrit REST API 客户端

```python
# Gerrit REST API 客户端
class GerritRESTClient:
    """
    Gerrit REST API 封装
    参考：https://gerrit-review.googlesource.com/Documentation/rest-api.html
    """
    
    def __init__(
        self,
        base_url: str,
        username: str,
        password: str
    ):
        self.base_url = base_url.rstrip('/')
        self.session = aiohttp.ClientSession(
            auth=aiohttp.BasicAuth(username, password)
        )
    
    # ========== Change 相关 ==========
    
    async def get_change(self, change_id: str) -> Change:
        """获取变更详情"""
        url = f"{self.base_url}/changes/{change_id}"
        async with self.session.get(url) as resp:
            # Gerrit REST API 返回 JSONP，需要去除前缀
            text = await resp.text()
            json_str = text[5:]  # 去除 ")]}'\n"
            data = json.loads(json_str)
            return Change(**data)
    
    async def list_changes(
        self,
        query: str = None,
        limit: int = 100
    ) -> List[Change]:
        """查询变更列表"""
        url = f"{self.base_url}/changes"
        params = {'n': limit}
        if query:
            params['q'] = query
        
        async with self.session.get(url, params=params) as resp:
            text = await resp.text()
            json_str = text[5:]
            data = json.loads(json_str)
            return [Change(**item) for item in data]
    
    # ========== 评论相关 ==========
    
    async def get_comments(
        self,
        change_id: str
    ) -> List[Comment]:
        """获取评论列表"""
        url = f"{self.base_url}/changes/{change_id}/comments"
        async with self.session.get(url) as resp:
            text = await resp.text()
            json_str = text[5:]
            data = json.loads(json_str)
            return [Comment(**item) for item in data]
    
    async def create_comment(
        self,
        change_id: str,
        message: str,
        patch_set: int = None
    ):
        """创建评论"""
        url = f"{self.base_url}/changes/{change_id}/comments"
        data = {'message': message}
        if patch_set:
            data['patchset'] = patch_set
        
        async with self.session.post(url, json=data) as resp:
            resp.raise_for_status()
    
    # ========== 打分相关 ==========
    
    async def set_review(
        self,
        change_id: str,
        labels: Dict[str, int],
        message: str = None
    ):
        """设置评审打分"""
        url = f"{self.base_url}/changes/{change_id}/revisions/current/review"
        data = {'labels': labels}
        if message:
            data['message'] = message
        
        async with self.session.post(url, json=data) as resp:
            resp.raise_for_status()
    
    # ========== 提交相关 ==========
    
    async def submit_change(self, change_id: str):
        """提交变更"""
        url = f"{self.base_url}/changes/{change_id}/submit"
        async with self.session.post(url) as resp:
            resp.raise_for_status()
```

### 4.2 数据模型

```python
# Gerrit 数据模型
from pydantic import BaseModel
from typing import Optional, List, Dict

class Change(BaseModel):
    """变更（类似 GitLab MR）"""
    id: str  # 完整 Change-ID
    _number: int  # 变更编号
    project: str
    branch: str
    change_id: str  # Gerrit Change-ID
    subject: str
    owner: Dict  # {name, email, username}
    
    # 状态
    status: str  # NEW, MERGED, ABANDONED
    submitted: Optional[bool]
    merged: Optional[bool]
    
    # 时间
    created: str  # ISO 8601
    updated: str
    
    # 当前 Patch Set
    current_revision: str
    revisions: Dict[str, Revision]
    
    # 标签（打分）
    labels: Dict[str, LabelInfo]

class Revision(BaseModel):
    """Patch Set 修订版本"""
    _number: int
    commit: Dict
    ref: str  # refs/changes/XX/XXX/Z
    created: str
    uploader: Dict

class LabelInfo(BaseModel):
    """标签信息"""
    optional: bool
    approved: Optional[Dict]  # 批准者
    rejected: Optional[Dict]  # 拒绝者
    recommended: Optional[Dict]
    disliked: Optional[Dict]
    value: int  # 当前分值
    all: List[Dict]  # 所有投票

class Comment(BaseModel):
    """评论"""
    comment_id: str
    path: str  # 文件路径
    revision: str
    patch_set: int
    message: str
    updated: str
    author: Dict
    in_reply_to: Optional[str]
```

---

## 五、权限映射

### 5.1 Gerrit → Orion 权限映射

```python
# 权限映射服务
class PermissionMapper:
    """
    Gerrit 权限 → Orion 权限映射
    """
    
    # Gerrit 权限定义
    GERRIT_PERMISSIONS = {
        'read': '读取代码',
        'forgeCommitter': '伪装提交者',
        'forgeAuthor': '伪装作者',
        'forgeServer': '伪装服务器',
        'push': '推送',
        'pushMerge': '推送合并',
        'labelCodeReview': 'Code Review 打分',
        'labelVerified': 'Verified 打分',
        'submit': '提交',
        'owner': '项目管理',
        'createTopic': '创建主题',
        'createChange': '创建变更',
        'addWatches': '添加关注'
    }
    
    # 权限映射表
    PERMISSION_MAPPING = {
        'read': 'code.read',
        'push': 'code.push',
        'labelCodeReview': 'review.code_review',
        'labelVerified': 'review.verified',
        'submit': 'review.submit',
        'owner': 'admin.project',
        'createChange': 'mr.create',
    }
    
    @classmethod
    def map_gerrit_to_orion(
        cls,
        gerrit_permissions: List[str]
    ) -> List[str]:
        """将 Gerrit 权限映射到 Orion 权限"""
        
        orion_permissions = []
        
        for perm in gerrit_permissions:
            if perm in cls.PERMISSION_MAPPING:
                orion_permissions.append(
                    cls.PERMISSION_MAPPING[perm]
                )
        
        return orion_permissions
    
    @classmethod
    def map_orion_to_gerrit(
        cls,
        orion_role: str
    ) -> List[str]:
        """将 Orion 角色映射到 Gerrit 权限"""
        
        role_permissions = {
            'viewer': ['read'],
            'developer': ['read', 'push', 'createChange', 'labelVerified'],
            'tech_lead': ['read', 'push', 'createChange', 
                         'labelCodeReview', 'labelVerified', 'submit'],
            'project_owner': ['read', 'push', 'createChange',
                             'labelCodeReview', 'labelVerified', 
                             'submit', 'owner']
        }
        
        return role_permissions.get(orion_role, ['read'])
```

---

## 六、部署配置

### 6.1 Kubernetes 部署

```yaml
# Gerrit Adapter 部署配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gerrit-adapter
  namespace: orion-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app: gerrit-adapter
  template:
    metadata:
      labels:
        app: gerrit-adapter
    spec:
      containers:
        - name: gerrit-adapter
          image: orion-registry.internal/gerrit-adapter:v1.0.0
          ports:
            - containerPort: 8080
          env:
            - name: GERRIT_HOST
              value: "gerrit.internal"
            - name: GERRIT_PORT
              value: "29418"
            - name: NATS_URL
              value: "nats://orion-nats:4222"
          volumeMounts:
            - name: ssh-key
              mountPath: /etc/gerrit/ssh
              readOnly: true
          envFrom:
            - secretRef:
                name: gerrit-credentials
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
      volumes:
        - name: ssh-key
          secret:
            secretName: gerrit-ssh-key
            defaultMode: 0600
---
apiVersion: v1
kind: Service
metadata:
  name: gerrit-adapter
  namespace: orion-system
spec:
  selector:
    app: gerrit-adapter
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
```

---

## 七、总结

### 7.1 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| Stream-Events 监听 | ✅ | Patch Set/评论/提交事件 |
| SSH API 集成 | ✅ | 打分/评论/提交 |
| REST API 集成 | ✅ | 查询变更/评论 |
| AI Review 打分 | ✅ | Code-Review -2~+2 |
| Verified 打分 | ✅ | CI 状态回写 |
| 权限映射 | ✅ | Gerrit ↔ Orion |
| 提交队列集成 | ⚠️ 部分 | 基础提交功能 |

### 7.2 与 GitLab Adapter 对比

| 功能 | GitLab Adapter | Gerrit Adapter |
|------|---------------|---------------|
| 事件接收 | Webhook | Stream-Events (SSH) |
| 评论回写 | REST API | SSH / REST API |
| 打分回写 | Pipeline 状态 | Code-Review / Verified |
| 用户同步 | REST API | 需额外开发 |
| 权限同步 | REST API | 需额外开发 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成，待开发_
