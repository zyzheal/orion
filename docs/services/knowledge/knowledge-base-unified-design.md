# 知识库模块统一设计文档

> **文档版本**: v2.0 (合并版) | **合并日期**: 2026-06-26
> **合并来源**: knowledge-base-design.md, Orion-Knowledge 微服务改造方案.md, orion-knowledge-integration-design.md, orion-knowledge-改造说明.md
> **外部组件**: orion-knowledge (PandaWiki 二开)
> **集成方式**: 可插拔微服务 + 微前端子应用

---

## 目录

- **第一章 ~ 第七章**: 知识库模块详细设计 (原 knowledge-base-design.md)
- **第八章**: 微服务改造方案 (原 Orion-Knowledge 微服务改造方案.md)
- **第九章 ~ 第十五章**: 集成设计 (原 orion-knowledge-integration-design.md)
- **第十六章**: 子应用改造说明 (原 orion-knowledge-改造说明.md)

---

# 知识库模块详细设计

> **文档版本**: v1.0 | **创建日期**: 2026-04-10 | **状态**: 设计完成
> **外部组件**: orion-knowledge (PandaWiki 二开)
> **集成方式**: 可插拔微服务 + 微前端子应用

---

## 一、概述

### 1.1 模块定位

知识库模块为 Orion 平台提供文档管理、知识图谱、RAG 智能问答能力，包括：
- **文档管理**: Markdown/Wiki 编辑、版本管理、协作编辑
- **知识图谱**: 实体关系管理、标签系统、知识关联
- **RAG 问答**: 文档向量化、相似文档检索、LLM 生成回答
- **智能搜索**: 全文检索、语义搜索、智能推荐

### 1.2 外部组件清单

| 组件 | 定位 | 技术栈 | 许可证 | 部署方式 |
|------|------|--------|--------|---------|
| **orion-knowledge-api** | 知识库后端 API | Go | AGPL-3.0 | 独立服务 (orion-wiki Namespace) |
| **orion-knowledge-admin** | 管理端 UI | Vite + React | AGPL-3.0 | 微前端子应用 |
| **orion-knowledge-app** | 用户端 Wiki | Next.js | AGPL-3.0 | 独立站点 (/wiki) |
| **orion-knowledge-consumer** | 文档处理消费者 | Go | AGPL-3.0 | 独立服务 |

### 1.3 集成决策

```
Build vs Integrate:
├── ✅ 集成 PandaWiki (不重复造轮子)
│   ├── 成熟的 Wiki/RAG 开源方案
│   ├── 内置文档处理 + 向量化 + 检索
│   └── 支持多种文档格式 (Markdown/PDF/Word)
│
└── 🔧 增强 AI 能力 (Orion 差异化)
    ├── RAG + Orion LLM 集成
    ├── 与 Pipeline 文档自动同步
    ├── 事故报告自动归档
    └── 效能报告自动生成
```

---

## 二、架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Orion 平台                                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    微前端基座 (orion-base)                        │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  orion-knowledge-admin (知识库管理端子应用)                  │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │   │
│  │  │  │ 文档     │ │ 知识     │ │ RAG      │ │ 系统     │    │   │   │
│  │  │  │ 管理     │ │ 图谱     │ │ 配置     │ │ 设置     │    │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  API Gateway (orion-api-gateway)                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │  /api/knowledge/* → orion-knowledge-api:8000            │    │   │
│  │  │  /wiki/* → orion-knowledge-app:3000                      │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  orion-knowledge (orion-wiki Namespace)                                  │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │ API Service │ │ Consumer    │ │ Vector DB   │ │ Object      │      │
│  │ (Go)        │ │ (文档处理)   │ │ (Chroma)    │ │ Storage     │      │
│  │             │ │             │ │             │ │ (MinIO)     │      │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │ PostgreSQL  │ │ Redis       │ │ NATS        │ │ ES          │      │
│  │ (元数据)    │ │ (缓存)      │ │ (消息)      │ │ (全文检索)  │      │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 组件职责

| 组件 | 职责 | 关键功能 |
|------|------|---------|
| **orion-knowledge-api** | 后端 API 服务 | 文档 CRUD、知识图谱、RAG 检索、权限控制 |
| **orion-knowledge-consumer** | 文档处理消费者 | Markdown 解析、向量化、索引构建 |
| **orion-knowledge-admin** | 管理端 UI | 文档管理、知识库配置、用户权限 |
| **orion-knowledge-app** | 用户端 Wiki | 文档浏览、搜索、问答 |
| **Orion AI Service** | AI 增强层 | RAG 检索增强、LLM 生成、知识抽取 |

---

## 三、微前端集成

### 3.1 集成方式

采用 **vite-plugin-federation** Module Federation 方式集成管理端：

```javascript
// orion-base (host) 配置
// vite.config.ts
import federation from '@originjs/vite-plugin-federation'

export default {
  plugins: [
    federation({
      name: 'orion-base',
      remotes: {
        // Orion Core 主应用
        'orion-core': 'http://localhost:3001/assets/remoteEntry.js',
        
        // gemini-next (SQL 审计前端)
        'gemini-next': 'http://localhost:3010/assets/remoteEntry.js',
        
        // orion-knowledge (知识库管理端)
        'orion-knowledge': 'http://localhost:3020/assets/remoteEntry.js',
        
        // orion-visor (CMDB 前端)
        'orion-visor': 'http://localhost:3030/assets/remoteEntry.js',
      },
      shared: [
        'react',
        'react-dom',
        '@arco-design/web-react'
      ]
    })
  ]
}
```

### 3.2 orion-knowledge (remote) 配置

```javascript
// orion-knowledge (remote) 配置
// vite.config.ts
import federation from '@originjs/vite-plugin-federation'

export default {
  plugins: [
    federation({
      name: 'orion-knowledge',
      filename: 'assets/remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
        './DocList': './src/components/DocList/index.tsx',
        './DocEditor': './src/components/DocEditor/index.tsx',
        './KnowledgeGraph': './src/components/KnowledgeGraph/index.tsx',
        './RAGConfig': './src/components/RAGConfig/index.tsx',
      },
      shared: [
        'react',
        'react-dom',
        '@arco-design/web-react'
      ]
    })
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: true
  }
}
```

### 3.3 路由配置

```javascript
// orion-base 路由配置
const routes = [
  {
    path: '/',
    component: BaseLayout,
    children: [
      // Orion Core 路由
      { path: '', component: OrionCore },
      { path: 'pipeline/*', component: PipelineModule },
      { path: 'workflow/*', component: WorkflowModule },
      
      // 知识库路由 (orion-knowledge)
      {
        path: 'knowledge/*',
        component: () => import('orion-knowledge/App'),
        meta: {
          module: 'orion-knowledge',
          title: '知识库',
          icon: 'book'
        }
      },
      {
        path: 'knowledge/docs',
        component: () => import('orion-knowledge/DocList'),
        meta: {
          module: 'orion-knowledge',
          title: '文档管理'
        }
      },
      {
        path: 'knowledge/editor',
        component: () => import('orion-knowledge/DocEditor'),
        meta: {
          module: 'orion-knowledge',
          title: '文档编辑'
        }
      },
      {
        path: 'knowledge/graph',
        component: () => import('orion-knowledge/KnowledgeGraph'),
        meta: {
          module: 'orion-knowledge',
          title: '知识图谱'
        }
      },
      
      // Wiki 用户端 (独立站点)
      {
        path: 'wiki/*',
        external: true,
        meta: {
          title: 'Wiki',
          icon: 'globe'
        }
      }
    ]
  }
]
```

---

## 四、API 集成

### 4.1 API Gateway 路由

```yaml
# API Gateway 配置
router:
  # 知识库 API
  - path: /api/knowledge/*
    target: orion-knowledge-api.orion-wiki.svc.cluster.local:8000
    strip_prefix: false
    auth: true
    timeout: 30s
    
    # 限流配置
    rate_limit:
      requests_per_second: 200
      burst: 400
    
    # 熔断配置
    circuit_breaker:
      failure_threshold: 5
      recovery_timeout: 30s
  
  # Wiki 用户端
  - path: /wiki/*
    target: orion-knowledge-app.orion-wiki.svc.cluster.local:3000
    strip_prefix: false
    auth: false  # Wiki 公开访问
  
  # RAG 检索 API (Orion 内部调用)
  - path: /api/ai/rag/*
    target: orion-knowledge-api.orion-wiki.svc.cluster.local:8000
    auth: true
    rules:
      - POST /api/knowledge/v1/rag/retrieve
      - POST /api/knowledge/v1/rag/query
```

### 4.2 API 清单

#### 4.2.1 文档 API

| 接口 | 方法 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| `/api/knowledge/v1/docs` | GET | 查询文档列表 | `?space=&page=&tag=` | `{items, total}` |
| `/api/knowledge/v1/docs/{id}` | GET | 查询文档详情 | - | `{doc, content, versions}` |
| `/api/knowledge/v1/docs` | POST | 创建文档 | `{title, content, spaceId}` | `{id, status}` |
| `/api/knowledge/v1/docs/{id}` | PUT | 更新文档 | `{content, summary}` | `{version, updatedAt}` |
| `/api/knowledge/v1/docs/{id}` | DELETE | 删除文档 | - | `{status}` |

#### 4.2.2 知识图谱 API

| 接口 | 方法 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| `/api/knowledge/v1/graph/entities` | GET | 查询实体列表 | `?type=&spaceId=` | `{entities}` |
| `/api/knowledge/v1/graph/relations` | GET | 查询关系列表 | `?entityId=` | `{relations}` |
| `/api/knowledge/v1/graph/entities` | POST | 创建实体 | `{name, type, properties}` | `{id, status}` |
| `/api/knowledge/v1/graph/relations` | POST | 创建关系 | `{sourceId, targetId, type}` | `{id, status}` |

#### 4.2.3 RAG API

| 接口 | 方法 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| `/api/knowledge/v1/rag/retrieve` | POST | 检索相关文档 | `{query, topK, filters}` | `{documents, scores}` |
| `/api/knowledge/v1/rag/query` | POST | RAG 问答 | `{query, context}` | `{answer, references}` |
| `/api/knowledge/v1/rag/embeddings` | POST | 文本向量化 | `{texts}` | `{embeddings}` |

---

## 五、认证与授权

### 5.1 SSO 集成架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orion SSO (统一认证中心)                       │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ LDAP/AD     │  │ OAuth2      │  │ SAML        │             │
│  │ (企业目录)   │  │ (GitHub 等)   │  │ (企业 SSO)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  JWT Token 签发                           │   │
│  │  {                                                       │   │
│  │    "sub": "user123",                                     │   │
│  │    "tenant_id": "tenant456",                             │   │
│  │    "roles": ["developer", "knowledge_editor"],           │   │
│  │    "permissions": ["knowledge:read", "knowledge:write"], │   │
│  │    "exp": 1712764800                                     │   │
│  │  }                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (JWT 验证)                        │
│  • 验证 JWT 签名                                                  │
│  • 检查有效期                                                    │
│  • 提取用户上下文                                                │
│  • 转发到知识库服务 (携带 X-User-Id, X-Tenant-Id)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              orion-knowledge-api (RBAC 鉴权)                     │
│  • 读取 JWT header 中的用户信息                                    │
│  • 基于角色验证权限                                              │
│  • 记录审计日志                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 权限映射

| Orion 角色 | 知识库权限 | orion-knowledge 角色映射 |
|-----------|-----------|------------------------|
| **Admin** | 全部权限 | `admin` |
| **Knowledge Admin** | 知识库管理/配置 | `knowledge_admin` |
| **Editor** | 创建/编辑/删除文档 | `editor` |
| **Developer** | 查看/评论 | `viewer` |
| **Viewer** | 只读查看 (公开文档) | `guest` |

### 5.3 文档权限模型

```
文档权限层次:
├── Space (知识库空间)
│   ├── Public: 所有人可读
│   ├── Internal: 团队成员可读
│   └── Private: 仅创建者可读写
│
├── Document (文档)
│   ├── 继承 Space 权限
│   └── 可设置独立权限
│
└── Section (章节)
    └── 继承 Document 权限
```

---

## 六、数据流设计

### 6.1 文档同步流程

```
Git 仓库 → Orion 知识库同步流程:

1. Git Webhook 触发 (push event)
         │
         ▼
2. Orion Pipeline 提取文档
   ├── Markdown 解析
   ├── 元数据提取 (title, tags, authors)
   └── 版本关联 (commit, branch)
         │
         ▼
3. 发布 NATS 事件：docs.updated
         │
         ▼
4. orion-knowledge-consumer 订阅处理
   ├── 向量化 (Embedding)
   ├── 全文索引 (Elasticsearch)
   └── 知识图谱更新
```

### 6.2 RAG 问答流程

```
用户提问 → RAG 智能回答流程:

1. 用户提交问题 (gemini-next 或 Orion AI Assistant)
         │
         ▼
2. Orion AI Service 接收问题
         │
         ▼
3. 检索相关文档 (orion-knowledge RAG API)
   ├── 向量检索 (Chroma)
   ├── 全文检索 (Elasticsearch)
   └── 混合排序 (Reciprocal Rank Fusion)
         │
         ▼
4. 构建 Prompt + 调用 LLM
   ├── System Prompt: 角色定义
   ├── Context: 检索到的文档片段
   └── User Query: 原始问题
         │
         ▼
5. LLM 生成回答 + 引用溯源
         │
         ▼
6. 返回结果 (含引用文档链接)
```

### 6.3 知识图谱构建流程

```
文档 → 知识图谱构建流程:

1. 文档解析 (Markdown/HTML)
         │
         ▼
2. 实体抽取 (NER)
   ├── 人名、组织、地点
   ├── 技术术语、产品名
   └── 事件、概念
         │
         ▼
3. 关系抽取
   ├── 上下位关系 (is-a)
   ├── 组成关系 (part-of)
   └── 关联关系 (related-to)
         │
         ▼
4. 知识融合
   ├── 实体消歧
   └── 关系合并
         │
         ▼
5. 图谱存储 (Neo4j / PostgreSQL)
```

---

## 七、部署架构

### 7.1 Kubernetes 部署

```yaml
# orion-knowledge-api Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-knowledge-api
  namespace: orion-wiki
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orion-knowledge-api
  template:
    metadata:
      labels:
        app: orion-knowledge-api
    spec:
      containers:
        - name: api
          image: registry/orion/orion-knowledge-api:1.0.0
          ports:
            - containerPort: 8000
          env:
            - name: PG_DSN
              valueFrom:
                secretKeyRef:
                  name: orion-knowledge-db
                  key: dsn
            - name: REDIS_ADDR
              value: "orion-knowledge-redis:6379"
            - name: S3_ENDPOINT
              value: "http://orion-knowledge-minio:9000"
            - name: NATS_URL
              value: "nats://orion-knowledge-nats:4222"
            - name: SSO_ENABLED
              value: "true"
            - name: SSO_ORION_URL
              value: "http://orion-sso.orion-core.svc.cluster.local"
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
---
# orion-knowledge-consumer Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-knowledge-consumer
  namespace: orion-wiki
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: consumer
          image: registry/orion/orion-knowledge-consumer:1.0.0
          env:
            - name: PG_DSN
              valueFrom:
                secretKeyRef:
                  name: orion-knowledge-db
                  key: dsn
            - name: REDIS_ADDR
              value: "orion-knowledge-redis:6379"
            - name: NATS_URL
              value: "nats://orion-knowledge-nats:4222"
            - name: VECTOR_MODEL
              value: "text-embedding-ada-002"
          resources:
            requests:
              cpu: 1000m
              memory: 1Gi
            limits:
              cpu: 4000m
              memory: 4Gi
---
# orion-knowledge-admin (前端)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-knowledge-admin
  namespace: orion-wiki
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: admin
          image: registry/orion/orion-knowledge-admin:1.0.0
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
---
# orion-knowledge-app (Next.js Wiki)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-knowledge-app
  namespace: orion-wiki
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: app
          image: registry/orion/orion-knowledge-app:1.0.0
          ports:
            - containerPort: 3000
          env:
            - name: API_ENDPOINT
              value: "http://orion-knowledge-api:8000"
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi
```

### 7.2 Namespace 隔离

```yaml
# Namespace 定义
namespaces:
  - orion-core        # Orion 核心域
  - orion-wiki        # 知识库 (orion-knowledge)
  - orion-monitoring  # 可观测性

# 网络策略
networkPolicies:
  orion-wiki:
    ingress:
      - from:
          - namespaceSelector:
              matchLabels:
                name: orion-core
          - namespaceSelector:
              matchLabels:
                name: orion-monitoring
        ports:
          - protocol: TCP
            port: 8000  # API
            port: 80    # Admin
            port: 3000  # App
    egress:
      - to:
          - namespaceSelector:
              matchLabels:
                name: orion-core
        ports:
          - protocol: TCP
            port: 443  # SSO
      - to:
          - ipBlock:
              cidr: 0.0.0.0/0
        ports:
          - protocol: TCP
            port: 443  # 外部向量模型 API
```

---

## 八、向量数据库设计

### 8.1 ChromaDB 配置

```yaml
# ChromaDB 部署
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chromadb
  namespace: orion-wiki
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: chromadb
          image: chromadb/chroma:0.4.22
          ports:
            - containerPort: 8000
          volumeMounts:
            - name: data
              mountPath: /chroma/chroma
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: chromadb-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: chromadb-pvc
  namespace: orion-wiki
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: ssd
```

### 8.2 向量集合设计

```python
# ChromaDB 集合定义
collections = {
    "documents": {
        "name": "documents",
        "metadata": {
            "description": "文档向量集合",
            "embedding_model": "text-embedding-ada-002",
            "dimension": 1536
        },
        "index_params": {
            "metric": "cosine",
            "index_type": "HNSW",
            "M": 16,
            "efConstruction": 200
        }
    },
    "knowledge_graph": {
        "name": "knowledge_graph",
        "metadata": {
            "description": "知识图谱实体向量集合",
            "embedding_model": "text-embedding-ada-002",
            "dimension": 1536
        }
    }
}
```

### 8.3 向量化流程

```python
class DocumentEmbedding:
    """文档向量化处理"""
    
    def __init__(self):
        self.chroma = ChromaClient()
        self.embedding_model = OpenAIEmbedding()
    
    async def embed_document(self, doc_id: str, content: str, metadata: dict):
        # 1. 文档分块 (按章节/段落)
        chunks = self._chunk_document(content, chunk_size=512, overlap=50)
        
        # 2. 批量向量化
        embeddings = await self.embedding_model.embed_documents(
            [chunk.text for chunk in chunks]
        )
        
        # 3. 存储到 ChromaDB
        await self.chroma.collection("documents").add(
            ids=[f"{doc_id}:{i}" for i in range(len(chunks))],
            embeddings=embeddings,
            metadatas=[
                {**metadata, "chunk_text": chunk.text, "chunk_index": i}
                for i, chunk in enumerate(chunks)
            ]
        )
        
        return len(chunks)
```

---

## 九、AI 增强设计

### 9.1 RAG 检索增强

```python
class RAGRetriever:
    """RAG 检索器"""
    
    def __init__(self):
        self.vector_store = ChromaClient()
        self.es_client = ElasticsearchClient()
        self.llm = LLMClient()
    
    async def retrieve(self, query: str, top_k: int = 5) -> List[Document]:
        # 1. 向量检索 (语义搜索)
        query_embedding = await self.llm.embed(query)
        vector_results = await self.vector_store.search(
            collection="documents",
            query_embedding=query_embedding,
            top_k=top_k * 2
        )
        
        # 2. 全文检索 (关键词匹配)
        es_results = await self.es_client.search(
            index="documents",
            query={
                "multi_match": {
                    "query": query,
                    "fields": ["title^2", "content", "tags"],
                    "type": "best_fields"
                }
            },
            size=top_k * 2
        )
        
        # 3. 混合排序 (Reciprocal Rank Fusion)
        fused_results = self._reciprocal_rank_fusion(
            vector_results, es_results, k=60
        )
        
        # 4. 重排序 (LLM-based)
        reranked = await self._rerank(query, fused_results[:top_k * 2])
        
        return reranked[:top_k]
```

### 9.2 RAG 问答

```python
class RAGQA:
    """RAG 问答系统"""
    
    def __init__(self):
        self.retriever = RAGRetriever()
        self.llm = LLMClient()
    
    async def query(self, question: str, context: dict = None) -> QAResult:
        # 1. 检索相关文档
        docs = await self.retriever.retrieve(question, top_k=5)
        
        # 2. 构建 Prompt
        prompt = self._build_prompt(question, docs, context)
        
        # 3. 调用 LLM 生成回答
        response = await self.llm.generate(prompt)
        
        # 4. 验证并提取引用
        answer, citations = self._parse_answer(response, docs)
        
        return QAResult(
            question=question,
            answer=answer,
            citations=citations,
            confidence=self._calculate_confidence(answer, docs)
        )
    
    def _build_prompt(self, question: str, docs: List[Document], context: dict) -> str:
        context_text = "\n\n".join([
            f"[文档 {i+1}]: {doc.content}"
            for i, doc in enumerate(docs)
        ])
        
        return f"""你是一个 Orion 平台智能助手。请基于以下参考文档回答问题。

参考文档:
{context_text}

问题：{question}

请根据参考文档内容回答，如果文档中没有相关信息，请说明。
回答时需标注引用来源，格式为 [1]、[2] 等。
"""
```

### 9.3 知识抽取

```python
class KnowledgeExtractor:
    """知识抽取器"""
    
    def __init__(self):
        self.llm = LLMClient()
        self.ner_model = NERModel()
    
    async def extract_entities(self, text: str) -> List[Entity]:
        # 1. NER 实体识别
        ner_results = await self.ner_model.predict(text)
        
        # 2. 实体链接
        entities = await self._link_entities(ner_results)
        
        # 3. 实体属性抽取
        for entity in entities:
            entity.properties = await self._extract_properties(
                entity, text
            )
        
        return entities
    
    async def extract_relations(self, entities: List[Entity], text: str) -> List[Relation]:
        # 1. 候选关系生成
        candidates = self._generate_candidate_pairs(entities)
        
        # 2. 关系分类 (LLM)
        relations = []
        for source, target in candidates:
            relation_type = await self._classify_relation(
                source, target, text
            )
            if relation_type:
                relations.append(Relation(
                    source=source.id,
                    target=target.id,
                    type=relation_type
                ))
        
        return relations
```

---

## 十、监控与可观测性

### 10.1 监控指标

```yaml
# Prometheus 指标
metrics:
  orion-knowledge:
    # 文档指标
    - knowledge_docs_total:         # 文档总数 (gauge)
    - knowledge_docs_created:       # 创建数 (counter)
    - knowledge_docs_updated:       # 更新数 (counter)
    
    # 检索指标
    - rag_queries_total:            # RAG 查询数 (counter)
    - rag_queries_success:          # 成功数 (counter)
    - rag_latency_seconds:          # RAG 延迟 (histogram)
    - rag_retrieval_recall:         # 检索召回率 (gauge)
    
    # 向量库指标
    - vector_store_size:            # 向量库大小 (gauge)
    - vector_store_latency:         # 向量检索延迟 (histogram)
    
    # AI 指标
    - llm_requests_total:           # LLM 请求数 (counter)
    - llm_latency_seconds:          # LLM 延迟 (histogram)
    - llm_token_usage:              # Token 使用量 (counter)
```

### 10.2 审计日志

```json
{
  "timestamp": "2026-04-10T10:30:00Z",
  "event_type": "knowledge.doc.update",
  "user_id": "user123",
  "tenant_id": "tenant456",
  "doc_id": "doc-789",
  "space_id": "space-001",
  "action": "update",
  "change_summary": "更新第三章内容",
  "version": 5,
  "trace_id": "trace-abc123"
}
```

---

## 十一、容错与降级

### 11.1 熔断策略

```yaml
circuit_breaker:
  orion-knowledge-api:
    failure_threshold: 5
    recovery_timeout: 30s
    half_open_requests: 3
    
  chromadb:
    failure_threshold: 3
    recovery_timeout: 60s
    
  llm:
    failure_threshold: 5
    recovery_timeout: 30s
```

### 11.2 降级方案

| 组件 | 降级触发条件 | 降级行为 | 恢复条件 |
|------|-------------|---------|---------|
| **orion-knowledge-api** | 服务不可用 | 使用本地缓存的文档快照 | 服务恢复 |
| **ChromaDB** | 向量库不可用 | 降级为纯全文检索 | 服务恢复 |
| **LLM** | AI 不可用 | 降级为纯检索，返回文档片段 | 服务恢复 |

---

## 十二、运维手册

### 12.1 快速部署

```bash
# 部署知识库模块
cd deploy/orion-knowledge

# 复制环境变量
cp .env.example .env

# 启动所有服务
docker compose up -d

# 查看状态
docker compose ps

# 预期输出:
# orion-knowledge-api       healthy
# orion-knowledge-consumer  running
# orion-knowledge-admin     healthy
# orion-knowledge-app       running
# chromadb                  healthy
# postgres                  healthy
# redis                     healthy
# minio                     healthy
```

### 12.2 故障排查

```bash
# 检查服务健康状态
kubectl get pods -n orion-wiki

# 查看 API 日志
kubectl logs -n orion-wiki deploy/orion-knowledge-api

# 测试 API 连通性
curl -H "Authorization: Bearer $TOKEN" \
  http://api-gateway/api/knowledge/health

# 测试 RAG 检索
curl -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"query":"如何部署流水线","top_k":5}' \
  http://api-gateway/api/knowledge/v1/rag/retrieve
```

---

## 十三、总结

### 13.1 集成收益

| 收益维度 | 说明 |
|---------|------|
| **开发效率** | 复用 PandaWiki，减少 70%+ 自研工作量 |
| **时间成本** | 上线周期从 4 个月缩短至 1 个月 |
| **质量保障** | 集成经过生产验证的开源方案 |
| **AI 增强** | 在 PandaWiki 基础上增加 Orion RAG/LLM 能力 |

### 13.2 风险提示

| 风险点 | 缓解措施 |
|-------|---------|
| **AGPL 许可证风险** | 独立部署，通过 API 集成，保持开源 |
| **向量库性能** | HNSW 索引 + 定期优化 |
| **数据安全** | 统一认证 + 权限隔离 + 审计日志 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 维护团队：Orion Platform Team_


---

# 第八章：微服务改造方案

> 来源: Orion-Knowledge 微服务改造方案.md

---

# Orion-Knowledge 微服务改造方案

> **来源**: PandaWiki 二开（AGPL-3.0 开源协议）
> **目标**: 前后端改造为可插拔微服务，独立部署、独立启停、与 Orion 主系统松耦合
> **状态**: 设计中

---

## 一、项目重命名

### 1.1 命名映射

| 原名称 | 新名称 | 范围 |
|--------|--------|------|
| `PandaWiki` | `Orion-Knowledge` | 产品名、UI 展示名 |
| `panda-wiki` | `orion-knowledge` | 包名、镜像名、容器名、环境变量前缀 |
| `github.com/chaitin/panda-wiki` | `github.com/orion-platform/orion-knowledge` | Go module path |
| `panda-wiki-app` | `orion-knowledge-app` | 前端用户端 npm 包名 |
| `panda-wiki-admin` | `orion-knowledge-admin` | 前端管理端 npm 包名 |
| `@panda-wiki/icons` | `@orion-knowledge/icons` | 前端图标包 |
| `@panda-wiki/themes` | `@orion-knowledge/themes` | 前端主题包 |
| `@panda-wiki/ui` | `@orion-knowledge/ui` | 前端 UI 组件包 |

### 1.2 项目位置

```
orion-design/
├── orion-visor/            # 现有主系统（不变）
├── orion-knowledge/        # 知识库微服务（由 PandaWiki 改名而来）
│   ├── backend/            # Go 后端 API + Consumer
│   ├── web/
│   │   ├── admin/          # 管理端 UI（Vite + React）
│   │   ├── app/            # 用户端 Wiki UI（Next.js）
│   │   └── packages/       # 共享组件
│   ├── deploy/
│   │   ├── docker-compose.yaml
│   │   ├── .env.example
│   │   └── k8s/            # K8s manifests（可选）
│   └── docs/
```

---

## 二、可插拔架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orion 统一入口                             │
│                     (Nginx / API Gateway)                         │
│                                                                 │
│   /orion-visor/*    ──→  主系统 (Java Spring Boot)                │
│   /orion-knowledge/ ──→  知识库管理端 (Vite SPA)                   │
│   /wiki/*           ──→  知识库用户端 (Next.js)                    │
│   /api/knowledge/*  ──→  知识库 API (Go)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
   ┌──────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐
   │ Orion Visor │  │ Orion        │  │ 共享基础设施  │
   │ (主系统)     │  │ Knowledge    │  │             │
   │             │  │ (微服务)     │  │ Nginx       │
   │ MySQL       │  │              │  │ (统一路由)   │
   │ Redis       │  │ PostgreSQL   │  │             │
   │ InfluxDB    │  │ Redis        │  └─────────────┘
   │ Guacd       │  │ MinIO (S3)   │
   └─────────────┘  │ NATS         │
                    └──────────────┘
```

### 2.2 可插拔设计原则

```
可插拔 = 独立部署 + 独立启停 + 可选依赖 + 统一注册

1. 独立部署
   ├── 知识库有独立的 docker-compose
   ├── 可与主系统分开部署到不同机器
   └── 不依赖 Orion Visor 的构建流程

2. 独立启停
   ├── docker compose up/down 不影响主系统
   ├── 健康检查自包含
   └── 优雅关闭，不丢数据

3. 可选依赖
   ├── 知识库不依赖主系统即可运行
   ├── 主系统不依赖知识库即可运行
   └── 两者通过 API 松耦合通信

4. 统一注册
   ├── 知识库启动后向 Orion 注册自身地址
   ├── Orion 通过服务发现感知知识库是否可用
   └── 前端通过 Gateway 自动路由
```

### 2.3 启用/禁用机制

```yaml
# orion-knowledge/deploy/.env
# ─────────────────────────────────────────
# 知识库开关：false 时整个知识库模块不启动
KNOWLEDGE_ENABLED=true

# 前端访问路径前缀
KNOWLEDGE_BASE_PATH=/orion-knowledge

# Wiki 用户端访问路径
WIKI_BASE_PATH=/wiki

# API 路径
API_BASE_PATH=/api/knowledge

# 与主系统 SSO 集成
SSO_ENABLED=false  # true = 接入 Orion Visor 统一认证
SSO_ORION_URL=http://orion-visor-service:9200
```

**禁用效果**：`docker compose up` 时不启动任何知识库容器，Orion 主系统自动检测知识库不可用并隐藏入口。

---

## 三、Docker Compose 设计

### 3.1 独立的 docker-compose（可插拔）

```yaml
# orion-knowledge/deploy/docker-compose.yaml
# ──────────────────────────────────────────────
# 可插拔知识库模块
# 独立于 orion-visor/docker-compose.yaml
# 使用共享网络 orion-net 或自建网络
# ──────────────────────────────────────────────

name: orion-knowledge

services:
  # ── 知识库 API ──────────────────────────
  api:
    image: ${IMAGE_REGISTRY:-}orion-knowledge-api:${IMAGE_TAG:-latest}
    container_name: orion-knowledge-api
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_API_PORT:-8090}:8000"
    environment:
      # 数据库
      PG_DSN: "host=${KNOWLEDGE_PG_HOST:-orion-knowledge-pg} user=${KNOWLEDGE_PG_USER:-knowledge} password=${KNOWLEDGE_PG_PASSWORD:-Knowledge@123} dbname=orion_knowledge port=5432 sslmode=disable TimeZone=Asia/Shanghai"
      # Redis
      REDIS_ADDR: "orion-knowledge-redis:6379"
      REDIS_PASSWORD: "${KNOWLEDGE_REDIS_PASSWORD:-Knowledge@123}"
      # MinIO
      S3_ENDPOINT: "${S3_ENDPOINT:-orion-knowledge-minio:9000}"
      S3_ACCESS_KEY: "${S3_ACCESS_KEY:-knowledge}"
      S3_SECRET_KEY: "${S3_SECRET_KEY:-Knowledge@123}"
      S3_BUCKET: "${S3_BUCKET:-knowledge}"
      S3_USE_SSL: "false"
      # NATS
      NATS_URL: "nats://orion-knowledge-nats:4222"
      # 日志
      LOG_LEVEL: "${LOG_LEVEL:-info}"
      # 基础路径（与前端对应）
      BASE_PATH: "${KNOWLEDGE_BASE_PATH:-}"
    volumes:
      - ./data/api/config:/app/config
    networks:
      - orion-knowledge-net
      - orion-net  # 可选：接入主网络
    healthcheck:
      test: ["CMD", "curl", "-f", "http://127.0.0.1:8000/api/v1/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 10s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy

  # ── 知识库 Consumer（文档处理）───────────
  consumer:
    image: ${IMAGE_REGISTRY:-}orion-knowledge-consumer:${IMAGE_TAG:-latest}
    container_name: orion-knowledge-consumer
    restart: unless-stopped
    environment:
      PG_DSN: "host=orion-knowledge-pg user=knowledge password=Knowledge@123 dbname=orion_knowledge port=5432 sslmode=disable TimeZone=Asia/Shanghai"
      REDIS_ADDR: "orion-knowledge-redis:6379"
      REDIS_PASSWORD: "${KNOWLEDGE_REDIS_PASSWORD:-Knowledge@123}"
      S3_ENDPOINT: "orion-knowledge-minio:9000"
      S3_ACCESS_KEY: "knowledge"
      S3_SECRET_KEY: "${KNOWLEDGE_S3_SECRET_KEY:-Knowledge@123}"
      S3_BUCKET: "${S3_BUCKET:-knowledge}"
      S3_USE_SSL: "false"
      NATS_URL: "nats://orion-knowledge-nats:4222"
    volumes:
      - ./data/consumer/cache:/app/cache
    networks:
      - orion-knowledge-net
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      nats:
        condition: service_healthy

  # ── 知识库管理端 UI ─────────────────────
  admin:
    image: ${IMAGE_REGISTRY:-}orion-knowledge-admin:${IMAGE_TAG:-latest}
    container_name: orion-knowledge-admin
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_ADMIN_PORT:-3020}:80"
    environment:
      NGINX_API_PROXY: "http://orion-knowledge-api:8000"
      BASE_PATH: "${KNOWLEDGE_BASE_PATH:-}"
    networks:
      - orion-knowledge-net
    depends_on:
      api:
        condition: service_healthy

  # ── 知识库用户端 Wiki UI ────────────────
  app:
    image: ${IMAGE_REGISTRY:-}orion-knowledge-app:${IMAGE_TAG:-latest}
    container_name: orion-knowledge-app
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_WIKI_PORT:-3010}:3000"
    environment:
      TARGET: "http://orion-knowledge-api:8000"
      BASE_PATH: "${KNOWLEDGE_BASE_PATH:-}"
    networks:
      - orion-knowledge-net
    depends_on:
      api:
        condition: service_healthy

  # ── PostgreSQL（知识库专用）──────────────
  postgres:
    image: postgres:16-alpine
    container_name: orion-knowledge-pg
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_PG_PORT:-5433}:5432"
    environment:
      POSTGRES_DB: orion_knowledge
      POSTGRES_USER: knowledge
      POSTGRES_PASSWORD: "${KNOWLEDGE_PG_PASSWORD:-Knowledge@123}"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U knowledge -d orion_knowledge"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - orion-knowledge-net

  # ── Redis（知识库专用）───────────────────
  redis:
    image: redis:7-alpine
    container_name: orion-knowledge-redis
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_REDIS_PORT:-6381}:6379"
    command: sh -c 'redis-server --requirepass $${KNOWLEDGE_REDIS_PASSWORD}'
    environment:
      KNOWLEDGE_REDIS_PASSWORD: "${KNOWLEDGE_REDIS_PASSWORD:-Knowledge@123}"
    volumes:
      - ./data/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    networks:
      - orion-knowledge-net

  # ── MinIO（知识库专用对象存储）──────────
  minio:
    image: minio/minio:latest
    container_name: orion-knowledge-minio
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_MINIO_PORT:-9001}:9000"
      - "${KNOWLEDGE_MINIO_CONSOLE_PORT:-9002}:9001"
    environment:
      MINIO_ROOT_USER: "${S3_ACCESS_KEY:-knowledge}"
      MINIO_ROOT_PASSWORD: "${S3_SECRET_KEY:-Knowledge@123}"
    command: server /data --console-address ":9001"
    volumes:
      - ./data/minio:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://127.0.0.1:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - orion-knowledge-net

  # ── NATS（消息队列）─────────────────────
  nats:
    image: nats:2-alpine
    container_name: orion-knowledge-nats
    restart: unless-stopped
    ports:
      - "${KNOWLEDGE_NATS_PORT:-4222}:4222"
    command: "--js"
    volumes:
      - ./data/nats:/var/lib/nats
    healthcheck:
      test: ["CMD", "nats", "server", "report", "jetstream"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - orion-knowledge-net

  # ── MinIO 初始化（一次性）──────────────
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set myminio http://orion-knowledge-minio:9000 $${S3_ACCESS_KEY:-knowledge} $${S3_SECRET_KEY:-Knowledge@123};
      mc mb --ignore-existing myminio/$${S3_BUCKET:-knowledge};
      exit 0;
      "
    environment:
      S3_ACCESS_KEY: "${S3_ACCESS_KEY:-knowledge}"
      S3_SECRET_KEY: "${S3_SECRET_KEY:-Knowledge@123}"
      S3_BUCKET: "${S3_BUCKET:-knowledge}"
    networks:
      - orion-knowledge-net

networks:
  orion-knowledge-net:
    driver: bridge
  orion-net:
    external: true
    name: orion-visor_orion-visor-net  # 接入主系统网络（可选）
```

### 3.2 环境变量（.env.example）

```bash
# ──────────────────────────────────────────
# Orion-Knowledge 环境变量
# ──────────────────────────────────────────

# 镜像配置
IMAGE_REGISTRY=
IMAGE_TAG=latest

# ── 端口配置 ──────────────────────────────
KNOWLEDGE_API_PORT=8090
KNOWLEDGE_ADMIN_PORT=3020
KNOWLEDGE_WIKI_PORT=3010
KNOWLEDGE_PG_PORT=5433
KNOWLEDGE_REDIS_PORT=6381
KNOWLEDGE_MINIO_PORT=9001
KNOWLEDGE_MINIO_CONSOLE_PORT=9002
KNOWLEDGE_NATS_PORT=4222

# ── 数据库 ────────────────────────────────
KNOWLEDGE_PG_PASSWORD=Knowledge@123
KNOWLEDGE_REDIS_PASSWORD=Knowledge@123

# ── 对象存储 ──────────────────────────────
S3_ACCESS_KEY=knowledge
S3_SECRET_KEY=Knowledge@123
S3_BUCKET=knowledge

# ── 路径配置 ──────────────────────────────
KNOWLEDGE_BASE_PATH=
LOG_LEVEL=info
```

---

## 四、与主系统集成

### 4.1 Nginx 统一路由

在 Orion Visor 的 Nginx 中添加 location 块，将流量转发到知识库：

```nginx
# orion-visor/docker/nginx/conf.d/orion.conf
# 在现有配置中追加知识库路由

# 知识库管理端
location /orion-knowledge/ {
    proxy_pass http://orion-knowledge-admin:80/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 知识库用户端（Wiki 网站）
location /wiki/ {
    proxy_pass http://orion-knowledge-app:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 知识库 API
location /api/knowledge/ {
    proxy_pass http://orion-knowledge-api:8000/api/v1/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> **可插拔体现**：如果知识库未启动，Nginx 返回 `503 Service Unavailable` 或重定向到"模块未启用"页面。

### 4.2 服务发现与健康检查

Orion Visor 主系统可通过 HTTP 健康检查感知知识库状态：

```
GET /api/knowledge/health
→ 200 OK  → 知识库可用，前端显示入口
→ 503     → 知识库未启动，前端隐藏入口
```

### 4.3 SSO 集成（可选）

知识库支持接入 Orion Visor 统一认证：

```
方案 A: JWT 共享
  Orion Visor 签发 JWT → 知识库使用相同密钥验证
  实现: 知识库读取 Orion JWT_SECRET，验证 token 中的用户信息

方案 B: OAuth2
  知识库作为 OAuth2 Client → 重定向到 Orion Visor 认证
  实现: 知识库增加 /auth/orion 回调端点

方案 C: 反向代理认证
  Nginx 在转发请求到知识库时注入 X-User-Id 和 X-User-Name header
  实现: 最简单，适合内网环境
```

**推荐方案 C**（反向代理认证）作为默认，方案 A（JWT 共享）作为进阶选项。

---

## 五、前端微服务集成

### 5.1 三种集成方式

```
┌─────────────────────────────────────────────────┐
│ 方式一：iframe 嵌入（最快）                       │
│ Orion Visor 页面中 <iframe src="/orion-knowledge">│
│ 优点: 0 改造，立即可用                             │
│ 缺点: 体验割裂，样式不一致                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 方式二：独立页面 + Nginx 路由（推荐）             │
│ 用户访问 /orion-knowledge → 直接跳转到独立 UI      │
│ 优点: 完整体验，独立部署                          │
│ 缺点: 导航需要统一处理                            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 方式三：微前端 Module Federation（最优）          │
│ Orion Knowledge 作为 remote，Orion Visor 作为 host│
│ 优点: 无缝集成，统一导航和样式                     │
│ 缺点: 需要改造 admin 端为 Module Federation remote │
└─────────────────────────────────────────────────┘
```

**阶段推荐**：先用方式二快速上线 → 后续升级为方式三。

### 5.2 Next.js 用户端部署适配

Next.js 需要以 Node.js 运行时运行，Dockerfile 改为：

```dockerfile
# web/app/Dockerfile (修改后)
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages ./packages
COPY app ./app
WORKDIR /app/app
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/app/.next ./.next
COPY --from=builder /app/app/public ./public
COPY --from=builder /app/app/package.json ./package.json
COPY --from=builder /app/app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 六、后端改造清单

### 6.1 Go Module 路径替换

```bash
# 1. 修改 go.mod
#    github.com/chaitin/panda-wiki → github.com/orion-platform/orion-knowledge

# 2. 全局替换 import 路径
find backend/ -name "*.go" -exec sed -i '' \
  's|github.com/chaitin/panda-wiki|github.com/orion-platform/orion-knowledge|g' {} \;

# 3. 重新生成
cd backend && make generate
```

### 6.2 配置文件默认值替换

```go
// backend/config/config.go 中的默认 DSN:
// 旧: host=panda-wiki-postgres user=panda-wiki password=panda-wiki-secret ...
// 新: host=orion-knowledge-pg user=knowledge password=Knowledge@123 ...
```

### 6.3 环境变量支持

```go
// 所有配置通过环境变量覆盖，支持外部注入
// 这样 docker compose 可以灵活配置
PG_DSN         = env("PG_DSN", "host=orion-knowledge-pg...")
REDIS_ADDR     = env("REDIS_ADDR", "orion-knowledge-redis:6379")
S3_ENDPOINT    = env("S3_ENDPOINT", "orion-knowledge-minio:9000")
NATS_URL       = env("NATS_URL", "nats://orion-knowledge-nats:4222")
```

---

## 七、去商品化改造清单

### 7.1 前端用户端（web/app/）

| # | 文件 | 原内容 | 改为 |
|---|------|--------|------|
| 1 | `package.json` | `panda-wiki-app` | `orion-knowledge-app` |
| 2 | `src/components/QaModal/index.tsx` | `PandaWiki 提供技术支持` | `Orion-Knowledge 提供技术支持` |
| 3 | `src/components/footer/index.tsx` | `release.baizhi.cloud/panda-wiki/icon.png` | 本地 `/favicon.png` |
| 4 | 全局 | `@panda-wiki/icons` | `@orion-knowledge/icons` |
| 5 | 全局 | `@panda-wiki/ui` | `@orion-knowledge/ui` |
| 6 | 全局 | `@panda-wiki/themes` | `@orion-knowledge/themes` |
| 7 | `src/request/` | 类型名含 `ChaitinPandaWiki` | 重新生成 API 类型 |

### 7.2 前端管理端（web/admin/）

| # | 文件 | 原内容 | 改为 |
|---|------|--------|------|
| 1 | `package.json` | `panda-wiki-admin` | `orion-knowledge-admin` |
| 2 | `src/components/Sidebar/index.tsx` | `PandaWiki` 文字 | `Orion Knowledge` |
| 3 | `src/components/Sidebar/index.tsx` | GitHub `chaitin/PandaWiki` | 移除或改 |
| 4 | `src/components/Sidebar/index.tsx` | `bbs.baizhi.cloud` | 移除 |
| 5 | `src/components/Sidebar/Version.tsx` | 外部版本检查 | 移除或改为内部 |
| 6 | `src/main.tsx` | `panda-wiki.css` | `orion-knowledge.css` |
| 7 | `src/components/CustomModal/utils.ts` | 外部 logo URL | 本地 logo |
| 8 | `src/components/CreateWikiModal/steps/initData.ts` | 品牌引导文案 | 重写为 Orion 引导 |
| 9 | `src/components/.../FooterConfig.tsx` | `PandaWiki 版权信息` | `Orion Knowledge 版权信息` |

### 7.3 包名替换（web/packages/）

| 包 | 旧 name | 新 name |
|----|---------|---------|
| icons | 通过 workspace 引用 | `@orion-knowledge/icons` |
| themes | 通过 workspace 引用 | `@orion-knowledge/themes` |
| ui | 通过 workspace 引用 | `@orion-knowledge/ui` |

---

## 八、启动与验证

### 8.1 一键启动

```bash
cd orion-knowledge/deploy

# 首次：复制环境变量
cp .env.example .env

# 启动整个知识库模块
docker compose up -d

# 查看状态
docker compose ps

# 预期输出:
# orion-knowledge-api         healthy
# orion-knowledge-consumer    running
# orion-knowledge-admin       healthy
# orion-knowledge-app         running
# orion-knowledge-pg          healthy
# orion-knowledge-redis       healthy
# orion-knowledge-minio       healthy
# orion-knowledge-nats        healthy
```

### 8.2 访问验证

```bash
# 管理端
open http://localhost:3020

# Wiki 用户端
open http://localhost:3010

# API 健康检查
curl http://localhost:8090/api/v1/health
```

### 8.3 一键停止（可插拔验证）

```bash
# 停止知识库，Orion Visor 不受影响
docker compose down

# 确认主系统仍然正常
cd ../../orion-visor
docker compose ps  # 全部 running ✓
```

---

## 九、端口汇总

| 服务 | 容器端口 | 宿主机端口 | 说明 |
|------|----------|-----------|------|
| API | 8000 | 8090 | 知识库后端 API |
| Admin UI | 80 | 3020 | 管理端 |
| App UI | 3000 | 3010 | Wiki 用户端 |
| PostgreSQL | 5432 | 5433 | 知识库数据库 |
| Redis | 6379 | 6381 | 缓存 |
| MinIO API | 9000 | 9001 | 对象存储 |
| MinIO Console | 9001 | 9002 | 对象存储控制台 |
| NATS | 4222 | 4222 | 消息队列 |

> 所有端口可通过 `.env` 调整，避免与 Orion Visor 冲突。

---

## 十、AGPL-3.0 合规提醒

| 要求 | 应对 |
|------|------|
| 修改代码必须开源 | 改造后的 Orion-Knowledge 代码需保持开源 |
| 网络交互也视为分发 | 通过 API 与主系统通信即满足要求 |
| 必须保留版权声明 | 保留 PandaWiki 原始 LICENSE 和 NOTICE |
| 衍生作品同样 AGPL | Orion-Knowledge 整体仍为 AGPL-3.0 |

**建议**：在 `orion-knowledge/` 根目录保留原始 LICENSE，在 README 中注明 "Based on PandaWiki (AGPL-3.0), modified for Orion platform"。

---

## 十一、改造优先级排序

### Phase 1：核心可运行（第 1 步）
- [ ] `go.mod` 路径替换
- [ ] `config.go` 默认值替换
- [ ] `docker-compose.yaml` 编写
- [ ] `Makefile` 镜像路径替换
- [ ] 前端 package name 替换

### Phase 2：去品牌化（第 2 步）
- [ ] 前端 UI 文字替换（Sidebar/QaModal/Footer）
- [ ] 外部 URL 移除/替换
- [ ] logo 和引导图片替换
- [ ] 初始化引导文案重写
- [ ] npm packages name 替换

### Phase 3：集成主系统（第 3 步）
- [ ] Nginx 路由配置
- [ ] 健康检查端点
- [ ] SSO 集成
- [ ] 前端入口集成

### Phase 4：生产就绪（第 4 步）
- [ ] K8s manifests 编写
- [ ] 日志聚合配置
- [ ] 备份恢复脚本
- [ ] 监控告警接入


---

# 第九章：集成设计

> 来源: orion-knowledge-integration-design.md

---

# Orion-Knowledge 集成设计 (Orion-Knowledge Integration Design)

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**优先级**: P1  
**状态**: 设计中  
**作者**: Orion Architecture Team  
**评审人**: 架构委员会  

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion-Knowledge 知识库微服务与 Orion 主系统的集成方案。Orion-Knowledge 基于 PandaWiki（AGPL-3.0）二开，为 Orion 平台提供文档管理、知识图谱、RAG 智能问答等核心能力。

### 集成范围

| 集成领域 | 核心内容 | 优先级 | 实施阶段 |
|---------|---------|--------|---------|
| **Nginx 集成设计** | 反代路由配置、Location 规则、Header 传递 | P1 | Phase 1 |
| **SSO 对接方案** | JWT 共享模式、反向代理认证、单点登录流程 | P1 | Phase 1 |
| **知识自动积累机制** | 故障记录推送、审查结果归档、优化记录沉淀 | P1 | Phase 2 |
| **RAG API 对接** | Orion AI 诊断调用知识库 API、向量检索、上下文增强 | P1 | Phase 2 |
| **事件驱动集成** | NATS 事件订阅、知识更新触发 | P2 | Phase 3 |
| **数据同步策略** | 增量同步、全量备份、冲突解决 | P2 | Phase 3 |
| **权限继承** | Orion 权限同步到知识库、租户隔离 | P1 | Phase 1 |

### 预期收益

| 指标 | 集成前 | 集成后目标 | 改善幅度 |
|------|--------|-----------|---------|
| 知识检索效率 | 手动搜索 | RAG 智能检索 | 10x |
| 故障复现率 | 30% | 5% | 83% |
| 新人上手时间 | 4 周 | 1 周 | 75% |
| 文档覆盖率 | 40% | 90% | 125% |

---

## 一、Nginx 集成设计 (Nginx Integration Design)

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Nginx 统一入口层                                        │
│                           (统一流量入口)                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────────────┐
        │                               │                                       │
        ▼                               ▼                                       ▼
┌───────────────────┐       ┌───────────────────┐                   ┌───────────────────┐
│  Orion Visor      │       │  Orion-Knowledge  │                   │  Wiki 用户端       │
│  主系统            │       │  管理端            │                   │  (Next.js)        │
│  /orion-visor/*   │       │  /orion-knowledge/*│                   │  /wiki/*          │
└───────────────────┘       └───────────────────┘                   └───────────────────┘
        │                               │                                       │
        └───────────────────────────────┼───────────────────────────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │   API Gateway         │
                            │   /api/knowledge/*    │
                            │   /api/visor/*        │
                            └───────────┬───────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────────────┐
        │                               │                                       │
        ▼                               ▼                                       ▼
┌───────────────────┐       ┌───────────────────┐                   ┌───────────────────┐
│  Visor API        │       │  Knowledge API    │                   │  其他服务 API      │
│  :9200            │       │  :8090            │                   │  :808x            │
└───────────────────┘       └───────────────────┘                   └───────────────────┘
```

### 1.2 Location 路由规则

#### 1.2.1 路由配置总览

| 路径前缀 | 目标服务 | 容器端口 | 说明 |
|---------|---------|---------|------|
| `/orion-visor/` | 主系统前端 | 9200 | Orion Visor 主界面 |
| `/orion-knowledge/` | 知识库管理端 | 3020 | 知识库管理 UI |
| `/wiki/` | Wiki 用户端 | 3010 | Next.js Wiki 站点 |
| `/api/knowledge/` | 知识库 API | 8090 | Go 后端 API |
| `/api/visor/` | 主系统 API | 9200 | Java Spring Boot API |

#### 1.2.2 Nginx 配置详情

```nginx
# /etc/nginx/conf.d/orion.conf
# ─────────────────────────────────────────────────────────────────────────────────
# Orion Platform 统一 Nginx 配置
# 包含主系统 + 知识库 + Wiki 用户端
# ─────────────────────────────────────────────────────────────────────────────────

# 上游服务定义
upstream orion_visor_backend {
    least_conn;
    server orion-visor-service:9200 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream orion_knowledge_admin {
    least_conn;
    server orion-knowledge-admin:80 max_fails=3 fail_timeout=30s;
    keepalive 16;
}

upstream orion_knowledge_app {
    least_conn;
    server orion-knowledge-app:3000 max_fails=3 fail_timeout=30s;
    keepalive 16;
}

upstream orion_knowledge_api {
    least_conn;
    server orion-knowledge-api:8000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream orion_visor_api {
    least_conn;
    server orion-visor-api:9200 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name orion.example.com;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # 访问日志
    access_log /var/log/nginx/orion_access.log combined;
    error_log /var/log/nginx/orion_error.log warn;
    
    # ─────────────────────────────────────────────────────────────────────────────
    # 主系统前端
    # ─────────────────────────────────────────────────────────────────────────────
    location /orion-visor/ {
        proxy_pass http://orion_visor_backend/;
        
        # 基础 Header 传递
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # 连接配置
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓冲配置
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # ─────────────────────────────────────────────────────────────────────────────
    # 知识库管理端
    # ─────────────────────────────────────────────────────────────────────────────
    location /orion-knowledge/ {
        proxy_pass http://orion_knowledge_admin/;
        
        # 基础 Header 传递
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # SSO Header 注入（反向代理认证模式）
        # 从主系统获取用户信息后注入
        proxy_set_header X-User-Id $http_x_user_id;
        proxy_set_header X-User-Name $http_x_user_name;
        proxy_set_header X-Tenant-Id $http_x_tenant_id;
        proxy_set_header X-Roles $http_x_roles;
        
        # 连接配置
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓冲配置
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        
        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # ─────────────────────────────────────────────────────────────────────────────
    # Wiki 用户端 (Next.js)
    # ─────────────────────────────────────────────────────────────────────────────
    location /wiki/ {
        proxy_pass http://orion_knowledge_app/;
        
        # WebSocket 支持 (Next.js HMR)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 基础 Header 传递
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 连接配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Next.js 特定配置
        proxy_set_header Accept-Encoding gzip;
    }
    
    # ─────────────────────────────────────────────────────────────────────────────
    # 知识库 API
    # ─────────────────────────────────────────────────────────────────────────────
    location /api/knowledge/ {
        proxy_pass http://orion_knowledge_api/api/v1/;
        
        # 基础 Header 传递
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # SSO Header 注入
        proxy_set_header X-User-Id $http_x_user_id;
        proxy_set_header X-User-Name $http_x_user_name;
        proxy_set_header X-Tenant-Id $http_x_tenant_id;
        proxy_set_header X-Roles $http_x_roles;
        proxy_set_header X-Permissions $http_x_permissions;
        
        # 连接配置
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 请求大小限制 (文档上传)
        client_max_body_size 50M;
        
        # 超时配置 (RAG 检索可能需要更长时间)
        proxy_read_timeout 120s;
    }
    
    # ─────────────────────────────────────────────────────────────────────────────
    # 主系统 API
    # ─────────────────────────────────────────────────────────────────────────────
    location /api/visor/ {
        proxy_pass http://orion_visor_api/;
        
        # 基础 Header 传递
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 连接配置
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # ─────────────────────────────────────────────────────────────────────────────
    # 健康检查端点
    # ─────────────────────────────────────────────────────────────────────────────
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    location /health/visor {
        proxy_pass http://orion_visor_backend/actuator/health;
        access_log off;
    }
    
    location /health/knowledge {
        proxy_pass http://orion_knowledge_api/api/v1/health;
        access_log off;
    }
    
    # ─────────────────────────────────────────────────────────────────────────────
    # 服务不可用时的友好提示
    # ─────────────────────────────────────────────────────────────────────────────
    error_page 502 503 504 = @service_unavailable;
    
    location @service_unavailable {
        default_type text/html;
        return 503 '<!DOCTYPE html><html><head><title>Service Unavailable</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>服务暂时不可用</h1>
        <p>请稍后重试或联系管理员。</p>
        <p style="color: #999; font-size: 12px;">Orion Platform</p>
        </body></html>';
    }
}
```

### 1.3 Header 传递规则

#### 1.3.1 必须传递的 Header

| Header 名称 | 来源 | 目标 | 说明 |
|------------|------|------|------|
| `X-User-Id` | Orion Visor 认证 | Knowledge API | 用户唯一标识 |
| `X-User-Name` | Orion Visor 认证 | Knowledge API | 用户名 |
| `X-Tenant-Id` | Orion Visor 认证 | Knowledge API | 租户 ID |
| `X-Roles` | Orion Visor 认证 | Knowledge API | 角色列表（逗号分隔） |
| `X-Permissions` | Orion Visor 认证 | Knowledge API | 权限列表（逗号分隔） |
| `X-Trace-Id` | 链路追踪 | 所有服务 | 分布式追踪 ID |
| `X-Request-Id` | 链路追踪 | 所有服务 | 请求唯一 ID |

#### 1.3.2 Header 映射配置

```lua
# /etc/nginx/lua/auth_header.lua
-- SSO Header 注入逻辑
local function inject_sso_headers()
    -- 从 Cookie 或 Token 中提取用户信息
    local token = ngx.var.http_authorization
    if token then
        -- 调用主系统验证 Token 并获取用户信息
        local res = ngx.location.capture("/api/visor/auth/verify", {
            method = ngx.HTTP_GET,
            headers = {
                ["Authorization"] = token
            }
        })
        
        if res.status == 200 then
            local user_info = cjson.decode(res.body)
            ngx.var.http_x_user_id = user_info.user_id
            ngx.var.http_x_user_name = user_info.username
            ngx.var.http_x_tenant_id = user_info.tenant_id
            ngx.var.http_x_roles = table.concat(user_info.roles, ",")
            ngx.var.http_x_permissions = table.concat(user_info.permissions, ",")
        end
    end
end
```

---

## 二、SSO 对接方案 (SSO Integration Design)

### 2.1 SSO 集成架构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Orion 统一认证中心                                    │
│                              (Orion SSO Center)                                   │
│                                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ LDAP/AD     │  │ OAuth2      │  │ SAML 2.0    │  │ OIDC        │             │
│  │ (企业目录)   │  │ (GitHub 等)   │  │ (企业 SSO)   │  │ (通用)      │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                │                      │
│         └────────────────┴────────────────┴────────────────┘                      │
│                                  │                                                │
│                                  ▼                                                │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │                      Identity Provider (IdP)                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │   │
│  │  │ 用户认证         │  │ Token 签发        │  │ 会话管理         │            │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘            │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                  │                                                │
│                                  ▼ JWT Access Token                               │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │                      JWT Payload Structure                                 │   │
│  │  {                                                                         │   │
│  │    "iss": "orion-sso",                   /* 签发者 */                       │   │
│  │    "sub": "user-123",                    /* 主题 (用户 ID) */               │   │
│  │    "aud": ["orion-visor", "orion-knowledge"],  /* 受众 */                   │   │
│  │    "exp": 1712764800,                    /* 过期时间 */                     │   │
│  │    "iat": 1712761200,                    /* 签发时间 */                     │   │
│  │    "tenant_id": "tenant-456",            /* 租户 ID */                      │   │
│  │    "user_name": "zhangsan",              /* 用户名 */                       │   │
│  │    "email": "zhangsan@example.com",      /* 邮箱 */                        │   │
│  │    "roles": ["developer", "editor"],     /* 角色列表 */                     │   │
│  │    "permissions": [                      /* 权限列表 */                     │   │
│  │      "knowledge:read",                                                    │   │
│  │      "knowledge:write",                                                     │   │
│  │      "knowledge:admin"                                                      │   │
│  │    ]                                                                       │   │
│  │  }                                                                         │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway (JWT 验证层)                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  1. 验证 JWT 签名 (使用 Orion SSO 公钥)                                        │  │
│  │  2. 检查有效期 (exp > now)                                                  │  │
│  │  3. 检查签发者 (iss = orion-sso)                                            │  │
│  │  4. 检查受众 (aud 包含当前服务)                                              │  │
│  │  5. 提取用户上下文到 Header                                                  │  │
│  │  6. 转发请求到后端服务                                                       │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ X-User-Id, X-Tenant-Id, X-Roles
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        orion-knowledge-api (RBAC 鉴权)                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  1. 读取 Header 中的用户信息                                                   │  │
│  │  2. 基于角色验证权限                                                          │  │
│  │  3. 记录审计日志                                                             │  │
│  │  4. 执行业务逻辑                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 认证方案对比

#### 2.2.1 三种 SSO 方案对比

| 方案 | 实现复杂度 | 安全性 | 性能 | 推荐场景 |
|------|-----------|--------|------|---------|
| **JWT 共享模式** | 中 | 高 | 高 | 推荐：内网可信环境 |
| **反向代理认证** | 低 | 中 | 高 | 推荐：简单集成场景 |
| **OAuth2 授权码** | 高 | 最高 | 中 | 可选：对外暴露场景 |

### 2.3 方案 A: JWT 共享模式（推荐）

#### 2.3.1 架构设计

```
JWT 共享模式架构:

┌─────────────────────────────────────────────────────────────────┐
│                     Orion Visor (主系统)                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  JWT_SECRET = "shared-secret-key-base64-encoded"         │   │
│  │  JWT_ALGORITHM = "HS256" 或 "RS256"                      │   │
│  │  JWT_EXPIRY = 3600 (1 小时)                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼ 签发 JWT                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  POST /api/visor/auth/login                              │   │
│  │  Response: { "access_token": "eyJhbGc...", ... }         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ JWT Token (Bearer)
┌─────────────────────────────────────────────────────────────────┐
│                     Orion-Knowledge (知识库)                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  配置共享密钥：                                           │   │
│  │  JWT_SECRET = "shared-secret-key-base64-encoded"         │   │
│  │  JWT_ALGORITHM = "HS256"                                 │   │
│  │  JWT_ISSUER = "orion-sso"                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼ 验证 JWT                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. 验证签名 (使用共享密钥)                                │   │
│  │  2. 验证有效期 (exp)                                     │   │
│  │  3. 验证签发者 (iss)                                     │   │
│  │  4. 提取用户信息 (sub, tenant_id, roles)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.2 配置示例

```yaml
# orion-knowledge/deploy/.env
# ─────────────────────────────────────────────────────────────────

# SSO 配置 (JWT 共享模式)
SSO_ENABLED=true
SSO_TYPE=jwt

# JWT 共享密钥 (与 Orion Visor 相同)
JWT_SECRET=your-shared-secret-key-base64-encoded
JWT_ALGORITHM=HS256
JWT_ISSUER=orion-sso
JWT_AUDIENCE=orion-knowledge

# Token 配置
JWT_EXPIRY_SECONDS=3600
JWT_REFRESH_ENABLED=true
JWT_REFRESH_EXPIRY_SECONDS=86400

# Orion Visor 地址 (用于 Token 验证回调)
SSO_ORION_URL=http://orion-visor-service:9200
```

```yaml
# orion-visor/.env
# ─────────────────────────────────────────────────────────────────

# JWT 配置
JWT_SECRET=your-shared-secret-key-base64-encoded
JWT_ALGORITHM=HS256
JWT_ISSUER=orion-sso
JWT_EXPIRY_SECONDS=3600
```

### 2.4 方案 B: 反向代理认证（简单模式）

```
反向代理认证流程:

1. 用户访问 /orion-knowledge/
              │
              ▼
2. Nginx 检查 Cookie/Token
              │
              ▼
3. 调用 /api/visor/auth/verify 验证
              │
         ┌────┴────┐
         │         │
         ▼         ▼
    验证成功    验证失败
         │         │
         │         ▼
         │    重定向到 /orion-visor/login
         │
         ▼
4. Nginx 注入 Header:
   - X-User-Id: user-123
   - X-User-Name: zhangsan
   - X-Tenant-Id: tenant-456
   - X-Roles: developer,editor
              │
              ▼
5. 转发请求到 orion-knowledge-admin
              │
              ▼
6. 知识库信任 Header 中的用户信息
```

### 2.5 单点登录流程

#### 2.5.1 用户登录流程

```
┌─────────┐    ┌────────────┐    ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  User   │    │   Browser  │    │ Orion Visor  │    │ Orion-Knowledge  │    │     LDAP/AD      │
│         │    │            │    │   (SSO)      │    │      (API)       │    │                  │
└────┬────┘    └─────┬──────┘    └──────┬───────┘    └─────────┬────────┘    └────────┬─────────┘
     │               │                  │                       │                     │
     │ 1. 访问 /orion-knowledge/         │                       │                     │
     │──────────────▶│                  │                       │                     │
     │               │                  │                       │                     │
     │               │ 2. 检查本地 Token                          │                     │
     │               │─────────────────▶│                       │                     │
     │               │                  │                       │                     │
     │               │ 3. Token 无效/过期                        │                     │
     │               │◀─────────────────│                       │                     │
     │               │                  │                       │                     │
     │ 4. 重定向到 /orion-visor/login   │                       │                     │
     │◀──────────────│                  │                       │                     │
     │               │                  │                       │                     │
     │ 5. 登录页面 (输入凭证)             │                       │                     │
     │──────────────▶│                  │                       │                     │
     │               │                  │                       │                     │
     │               │ 6. 验证凭证       │                       │                     │
     │               │─────────────────▶│                       │                     │
     │               │                  │                       │                     │
     │               │                  │ 7. LDAP 认证           │                     │
     │               │                  │──────────────────────▶│                     │
     │               │                  │                       │                     │
     │               │                  │◀──────────────────────│                     │
     │               │                  │ 8. 认证结果            │                     │
     │               │                  │                       │                     │
     │               │ 9. 签发 JWT Token │                       │                     │
     │               │◀─────────────────│                       │                     │
     │               │                  │                       │                     │
     │ 10. 重定向回 /orion-knowledge/   │                       │                     │
     │◀──────────────│ (携带 JWT Token) │                       │                     │
     │               │                  │                       │                     │
     │ 11. 访问 API (携带 JWT)           │                       │                     │
     │──────────────▶│                  │                       │                     │
     │               │                  │                       │                     │
     │               │ 12. 转发 + JWT    │                       │                     │
     │               │─────────────────▶│                       │                     │
     │               │                  │                       │                     │
     │               │                  │ 13. 验证 JWT 签名       │                     │
     │               │                  │──────────────────────▶│                     │
     │               │                  │                       │                     │
     │               │                  │ 14. 提取用户信息       │                     │
     │               │                  │◀──────────────────────│                     │
     │               │                  │                       │                     │
     │               │                  │ 15. 返回受保护资源      │                     │
     │               │                  │◀──────────────────────│                     │
     │◀──────────────│                  │                       │                     │
     │               │                  │                       │                     │
```

### 2.6 JWT 共享模式时序图

```
┌──────────┐       ┌─────────────┐       ┌───────────────┐       ┌───────────────────┐       ┌─────────────┐
│  Client  │       │ Orion Visor │       │ API Gateway   │       │ Orion-Knowledge   │       │   Redis     │
│          │       │   (IdP)     │       │               │       │      (API)        │       │             │
└────┬─────┘       └──────┬──────┘       └───────┬───────┘       └─────────┬─────────┘       └──────┬──────┘
     │                    │                      │                         │                        │
     │ 1. POST /auth/login (credentials)         │                         │                        │
     │───────────────────▶│                      │                         │                        │
     │                    │                      │                         │                        │
     │                    │ 2. 验证用户名密码     │                         │                        │
     │                    │─────────────────────▶│                         │                        │
     │                    │                      │                         │                        │
     │                    │ 3. 查询用户信息       │                         │                        │
     │                    │─────────────────────▶│                         │                        │
     │                    │                      │                         │                        │
     │                    │ 4. 用户信息 + 权限     │                         │                        │
     │                    │◀─────────────────────│                         │                        │
     │                    │                      │                         │                        │
     │                    │ 5. 签发 JWT           │                         │                        │
     │                    │ ┌─────────────────┐  │                         │                        │
     │                    │ │ payload:        │  │                         │                        │
     │                    │ │ - sub: user_id  │  │                         │                        │
     │                    │ │ - tenant_id     │  │                         │                        │
     │                    │ │ - roles         │  │                         │                        │
     │                    │ │ - permissions   │  │                         │                        │
     │                    │ │ - exp           │  │                         │                        │
     │                    │ └─────────────────┘  │                         │                        │
     │                    │                      │                         │                        │
     │ 6. JWT Token       │                      │                         │                        │
     │◀───────────────────│                      │                         │                        │
     │                    │                      │                         │                        │
     │ 7. GET /api/knowledge/docs               │                         │                        │
     │    Authorization: Bearer <JWT>            │                         │                        │
     │─────────────────────────────────────────▶│                         │                        │
     │                    │                      │                         │                        │
     │                    │                      │ 8. 验证 JWT 签名          │                        │
     │                    │                      │────────────────────────▶│                        │
     │                    │                      │                         │                        │
     │                    │                      │                         │ 9. 检查 Redis 黑名单     │
     │                    │                      │                         │───────────────────────▶│
     │                    │                      │                         │                        │
     │                    │                      │                         │ 10. 不在黑名单          │
     │                    │                      │                         │◀───────────────────────│
     │                    │                      │                         │                        │
     │                    │                      │ 11. 验证通过             │                        │
     │                    │                      │◀────────────────────────│                        │
     │                    │                      │                         │                        │
     │                    │                      │ 12. 注入用户 Header      │                        │
     │                    │                      │ X-User-Id: user-123     │                        │
     │                    │                      │ X-Tenant-Id: tenant-456 │                        │
     │                    │                      │ X-Roles: developer      │                        │
     │                    │                      │                         │                        │
     │                    │                      │ 13. 转发请求             │                        │
     │                    │                      │────────────────────────▶│                        │
     │                    │                      │                         │                        │
     │                    │                      │                         │ 14. 执行业务逻辑        │
     │                    │                      │                         │ (基于用户权限)          │
     │                    │                      │                         │                        │
     │                    │                      │ 15. 返回结果             │                        │
     │                    │                      │◀────────────────────────│                        │
     │                    │                      │                         │                        │
     │ 16. 文档列表 + 数据  │                      │                         │                        │
     │◀──────────────────────────────────────────│                         │                        │
     │                    │                      │                         │                        │
```

---

## 三、知识自动积累机制 (Knowledge Auto-Accumulation Mechanism)

### 3.1 设计目标

Orion 平台在日常运维过程中会产生大量有价值的知识，包括：
- **故障处理记录**: 故障现象、诊断过程、解决方案
- **变更审查结果**: 变更申请、风险评估、审批记录、实施结果
- **优化实践**: 性能优化、成本优化、架构优化案例

本机制旨在自动捕获这些知识并归档到知识库，形成组织知识资产。

### 3.2 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Orion 知识自动积累架构                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  故障管理系统    │    │  变更管理系统    │    │  效能洞察系统   │
│  (Incident)     │    │  (Change)       │    │  (Insight)      │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │ 故障解决             │ 变更完成              │ 优化完成
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           NATS 事件总线                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ incident.       │  │ change.         │  │ optimization.   │                 │
│  │ resolved        │  │ completed       │  │ applied         │                 │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     orion-knowledge-consumer                                     │
│                     (知识处理消费者)                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  1. 订阅事件                                                            │   │
│  │  2. 提取关键信息                                                         │   │
│  │  3. 生成知识文档草稿                                                     │   │
│  │  4. 通知相关人员审核                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           知识库存储层                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │  故障知识库      │  │  变更知识库      │  │  优化知识库      │                 │
│  │  (Incident KB)  │  │  (Change KB)    │  │  (Opt KB)       │                 │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 故障记录推送流程

#### 3.3.1 数据结构

```json
{
  "event_type": "incident.resolved",
  "timestamp": "2026-04-10T10:30:00Z",
  "data": {
    "incident_id": "INC-2026-0410-001",
    "title": "生产环境数据库连接池耗尽",
    "severity": "P1",
    "status": "resolved",
    "timeline": [
      {
        "time": "2026-04-10T08:15:00Z",
        "event": "监控告警触发",
        "description": "数据库连接池使用率达到 100%"
      },
      {
        "time": "2026-04-10T08:20:00Z",
        "event": "on-call 响应",
        "description": "工程师张三开始处理"
      },
      {
        "time": "2026-04-10T09:00:00Z",
        "event": "根因定位",
        "description": "发现某慢查询导致连接堆积"
      },
      {
        "time": "2026-04-10T09:30:00Z",
        "event": "临时修复",
        "description": "Kill 慢查询会话，恢复服务"
      },
      {
        "time": "2026-04-10T10:30:00Z",
        "event": "永久修复",
        "description": "优化 SQL 并添加索引"
      }
    ],
    "root_cause": "订单表缺少 (user_id, created_at) 联合索引，导致全表扫描",
    "solution": "1. Kill 阻塞会话；2. 添加联合索引；3. 优化 SQL 查询",
    "impact": {
      "duration_minutes": 135,
      "affected_services": ["order-service", "payment-service"],
      "affected_users": 5000
    },
    "owner": {
      "user_id": "user-123",
      "name": "张三",
      "team": "SRE"
    },
    "tags": ["database", "performance", "index", "mysql"]
  }
}
```

#### 3.3.2 知识文档生成

```
故障知识文档结构:

┌─────────────────────────────────────────────────────────────────┐
│  故障报告：INC-2026-0410-001                                    │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ## 故障概述                                                      │
│  - **标题**: 生产环境数据库连接池耗尽                              │
│  - **等级**: P1                                                   │
│  - **持续时间**: 135 分钟                                          │
│  - **影响范围**: 订单服务、支付服务，约 5000 用户                    │
│                                                                  │
│  ## 故障时间线                                                    │
│  | 时间 | 事件 | 描述 |                                          │
│  |------|------|------|                                          │
│  | 08:15 | 告警触发 | 数据库连接池使用率达到 100% |                  │
│  | 08:20 | 响应 | 工程师张三开始处理 |                            │
│  | 09:00 | 定位 | 发现某慢查询导致连接堆积 |                       │
│  | 09:30 | 临时修复 | Kill 慢查询会话 |                           │
│  | 10:30 | 永久修复 | 优化 SQL 并添加索引 |                       │
│                                                                  │
│  ## 根因分析 (RCA)                                                │
│  订单表缺少 (user_id, created_at) 联合索引，导致大表全表扫描，       │
│  长时间持有数据库连接，最终耗尽连接池。                              │
│                                                                  │
│  ## 解决方案                                                      │
│  1. 立即 Kill 阻塞会话，恢复服务                                    │
│  2. 添加联合索引：CREATE INDEX idx_user_created ON orders(...)    │
│  3. 优化 SQL 查询，添加 LIMIT 限制                                   │
│                                                                  │
│  ## 后续行动 (Action Items)                                       │
│  - [ ] 对所有大表进行索引审查                                       │
│  - [ ] 添加慢查询自动告警                                          │
│  - [ ] 完善 SQL 审核流程                                            │
│                                                                  │
│  ## 相关文档                                                      │
│  - [数据库索引设计最佳实践](link)                                  │
│  - [慢查询优化指南](link)                                         │
│  ─────────────────────────────────────────────────────────────  │
│  来源：故障管理系统 | 作者：张三 | 审核状态：待审核                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 审查结果归档流程

```
变更审查知识归档流程:

1. 变更完成 (Change Completed)
         │
         ▼
2. 发布 change.completed 事件
   {
     "change_id": "CHG-2026-0410-001",
     "title": "订单服务 v2.3.0 发布",
     "type": "standard",
     "risk_level": "medium",
     "result": "success",
     "changes_made": [...],
     "rollback_plan": "...",
     "approver": "李四",
     "implementer": "王五"
   }
         │
         ▼
3. knowledge-consumer 订阅处理
         │
         ▼
4. 生成变更案例文档
   ├── 变更背景
   ├── 变更内容
   ├── 风险评估
   ├── 实施过程
   └── 经验总结
         │
         ▼
5. 存储到变更知识库
         │
         ▼
6. 通知变更申请人确认
         │
         ▼
7. 确认后发布到公开知识库
```

### 3.5 优化记录沉淀流程

```
优化知识沉淀流程:

1. 效能洞察系统检测到优化效果
   - 性能提升 > 20%
   - 成本降低 > 10%
   - 可用性提升
         │
         ▼
2. 发布 optimization.applied 事件
         │
         ▼
3. knowledge-consumer 捕获事件
         │
         ▼
4. 生成优化案例文档
   ├── 优化前状态（基线）
   ├── 优化方案
   ├── 实施步骤
   ├── 优化效果（数据对比）
   └── 可复用的最佳实践
         │
         ▼
5. 存储到优化知识库
         │
         ▼
6. 向相似场景团队推荐
```

### 3.6 知识自动积累数据流图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           知识自动积累数据流                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                              Orion 平台事件源
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│                 │                 │                 │                 │
▼                 ▼                 ▼                 ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 故障管理系统 │ │ 变更管理系统 │ │ 效能洞察系统 │ │ 安全合规系统 │ │ 用户行为日志 │
│              │ │              │ │              │ │              │ │              │
│ 故障解决      │ │ 变更完成      │ │ 优化应用      │ │ 合规检查完成 │ │ 高频查询     │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │                │
       │ NATS Events    │                │                │                │
       ▼                ▼                ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              NATS JetStream (事件总线)                            │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐    │
│  │ incident.*     │ │ change.*       │ │ optimization.* │ │ compliance.*   │    │
│  │ security.*     │ │ usage.*        │ │                │ │                │    │
│  └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         orion-knowledge-consumer                                  │
│                         (知识处理引擎)                                             │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Stage 1: 事件捕获                                                            │ │
│  │  ├── 订阅 NATS 主题                                                            │ │
│  │  ├── 过滤有效事件                                                            │ │
│  │  └── 解析事件数据                                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                         │
│                                        ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Stage 2: 知识抽取                                                            │ │
│  │  ├── 提取关键信息（标题、描述、时间线、结果）                                 │ │
│  │  ├── 识别相关标签                                                            │ │
│  │  └── 关联相关人员（作者、审核人）                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                         │
│                                        ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Stage 3: 文档生成                                                            │ │
│  │  ├── 套用模板（故障/变更/优化）                                               │ │
│  │  ├── 填充内容                                                                │ │
│  │  └── 生成草稿                                                                │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                         │
│                                        ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Stage 4: 审核发布                                                            │ │
│  │  ├── 通知相关人员审核                                                        │ │
│  │  ├── 审核通过后发布                                                          │ │
│  │  └── 向量化 + 索引                                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              知识库存储层                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  PostgreSQL     │  │  ChromaDB       │  │  Elasticsearch  │                  │
│  │  (文档元数据)    │  │  (向量存储)      │  │  (全文索引)      │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 四、RAG API 对接 (RAG API Integration)

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Orion AI 诊断调用知识库 RAG API                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  Orion AI       │
│  Service        │
│  (AI 诊断服务)    │
└────────┬────────┘
         │
         │ 1. 接收诊断请求
         │ (系统异常/性能问题)
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                    RAG 检索增强层 (Retrieval-Augmented Generation)           │ │
│  │                                                                             │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │ │
│  │  │ 查询理解     │    │ 混合检索     │    │ 结果重排序   │                     │ │
│  │  │ (Query      │───▶│ (Hybrid     │───▶│ (Re-ranking)│                     │ │
│  │  │  Analysis)  │    │  Search)    │    │             │                     │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘                     │ │
│  │         │                  │                  │                             │ │
│  │         ▼                  ▼                  ▼                             │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │ │
│  │  │ 查询扩展     │    │ 向量检索     │    │ 上下文构建   │                     │ │
│  │  │ (扩展同义词) │    │ (ChromaDB)  │    │ (Context    │                     │ │
│  │  └─────────────┘    └─────────────┘    │  Building)   │                     │ │
│  │                       ┌─────────────┐    └─────────────┘                     │ │
│  │                       │ 全文检索     │            │                           │ │
│  │                       │ (ES)        │            │                           │ │
│  │                       └─────────────┘            │                           │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 2. 调用 RAG API
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    orion-knowledge-api (RAG Endpoints)                            │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  POST /api/v1/rag/retrieve  - 检索相关文档                                   │ │
│  │  POST /api/v1/rag/query       - RAG 问答                                     │ │
│  │  POST /api/v1/rag/embed       - 文本向量化                                   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 3. 向量检索 + 全文检索
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐              │
│  │  ChromaDB       │    │  Elasticsearch  │    │  PostgreSQL     │              │
│  │  (向量存储)      │    │  (全文索引)      │    │  (文档元数据)    │              │
│  │                 │    │                 │    │                 │              │
│  │  - 文档向量      │    │  - 标题/内容索引 │    │  - 文档信息      │              │
│  │  - 相似度检索    │    │  - 关键词匹配    │    │  - 权限控制      │              │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 4. 返回检索结果
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          LLM 生成层                                                │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Prompt Template:                                                           │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │  │ 你是一个 Orion 平台智能诊断助手。请基于以下参考文档回答问题。              │  │ │
│  │  │                                                                       │  │ │
│  │  │ 参考文档：                                                             │  │ │
│  │  │ [文档 1] {content_1} (来源：{source_1})                                 │  │ │
│  │  │ [文档 2] {content_2} (来源：{source_2})                                 │  │ │
│  │  │ [文档 3] {content_3} (来源：{source_3})                                 │  │ │
│  │  │                                                                       │  │ │
│  │  │ 用户问题：{query}                                                      │  │ │
│  │  │                                                                       │  │ │
│  │  │ 请根据参考文档内容回答，如果文档中没有相关信息，请说明。                   │  │ │
│  │  │ 回答时需标注引用来源，格式为 [1]、[2] 等。                                 │  │ │
│  │  └──────────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │ 5. 生成最终回答
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          响应结果                                                │
│  {                                                                                │
│    "answer": "根据历史故障记录，该问题可能是由数据库连接池耗尽导致...",           │
│    "confidence": 0.85,                                                            │
│    "references": [                                                                │
│      {"doc_id": "INC-2026-0401-001", "title": "...", "url": "..."},              │
│      {"doc_id": "OPT-2026-0315-002", "title": "...", "url": "..."}               │
│    ]                                                                              │
│  }                                                                                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 RAG API 调用时序图

```
┌─────────────┐       ┌───────────────┐       ┌───────────────────┐       ┌───────────────┐       ┌───────────────┐
│   Client    │       │ Orion AI      │       │ Knowledge         │       │   ChromaDB    │       │ Elasticsearch │
│ (诊断请求)   │       │ Service       │       │ API (RAG)         │       │ (Vector DB)   │       │ (Full-text)   │
└──────┬──────┘       └───────┬───────┘       └─────────┬─────────┘       └───────┬───────┘       └───────┬───────┘
       │                     │                           │                         │                     │
       │ 1. 诊断请求          │                           │                         │                     │
       │ (系统异常检测)       │                           │                         │                     │
       │────────────────────▶│                           │                         │                     │
       │                     │                           │                         │                     │
       │                     │ 2. 查询分析                │                         │                     │
       │                     │ - 意图识别                │                         │                     │
       │                     │ - 关键词提取              │                         │                     │
       │                     │ - 查询扩展                │                         │                     │
       │                     │                           │                         │                     │
       │                     │ 3. RAG 检索请求             │                         │                     │
       │                     │ POST /api/v1/rag/retrieve │                         │                     │
       │                     │──────────────────────────▶│                         │                     │
       │                     │                           │                         │                     │
       │                     │                           │ 4. 查询向量化            │                     │
       │                     │                           │ (Embedding)             │                     │
       │                     │                           │────────────────────────▶│                     │
       │                     │                           │                         │                     │
       │                     │                           │ 5. 向量相似度检索        │                     │
       │                     │                           │ top_k=10                │                     │
       │                     │                           │────────────────────────▶│                     │
       │                     │                           │                         │                     │
       │                     │                           │ 6. 返回向量检索结果      │                     │
       │                     │                           │◀────────────────────────│                     │
       │                     │                           │                         │                     │
       │                     │                           │ 7. 全文检索 (并行)       │                     │
       │                     │                           │────────────────────────────────────────────▶│
       │                     │                           │                         │                     │
       │                     │                           │ 8. 返回全文检索结果      │                     │
       │                     │                           │◀────────────────────────────────────────────│
       │                     │                           │                         │                     │
       │                     │                           │ 9. 混合排序              │                     │
       │                     │                           │ (Reciprocal Rank Fusion)│                     │
       │                     │                           │                         │                     │
       │                     │                           │ 10. 重排序 (LLM-based)   │                     │
       │                     │                           │ top_k=5                 │                     │
       │                     │                           │                         │                     │
       │                     │ 11. 返回相关文档           │                         │                     │
       │                     │◀──────────────────────────│                         │                     │
       │                     │                           │                         │                     │
       │                     │ 12. 构建 Prompt           │                         │                     │
       │                     │ - System Prompt           │                         │                     │
       │                     │ - Context (文档片段)       │                         │                     │
       │                     │ - User Query              │                         │                     │
       │                     │                           │                         │                     │
       │                     │ 13. 调用 LLM               │                         │                     │
       │                     │─────────────────────────────────────────────────────────────────────────▶│
       │                     │                           │                         │                     │
       │                     │ 14. LLM 生成回答            │                         │                     │
       │                     │◀─────────────────────────────────────────────────────────────────────────│
       │                     │                           │                         │                     │
       │                     │ 15. 解析回答 + 提取引用     │                         │                     │
       │                     │                           │                         │                     │
       │                     │ 16. 诊断结果 + 知识引用     │                         │                     │
       │◀────────────────────│                           │                         │                     │
       │                     │                           │                         │                     │
```

### 4.3 API 端点定义

#### 4.3.1 检索 API

```yaml
# POST /api/v1/rag/retrieve
# 检索与查询相关的文档片段

request:
  query: string              # 查询文本（必填）
  top_k: integer = 5         # 返回结果数量
  filters:
    space_id: string         # 知识库空间过滤
    doc_type: string         # 文档类型（incident/change/optimization）
    tags: string[]           # 标签过滤
    date_range:
      start: date
      end: date
  search_type: string = "hybrid"  # hybrid/vector/fulltext
  
response:
  query: string
  results:
    - doc_id: string
      chunk_id: string
      content: string
      score: number          # 相关性分数
      metadata:
        title: string
        doc_type: string
        space_id: string
        tags: string[]
        created_at: date
        url: string
  search_type: string
  total_time_ms: number
```

#### 4.3.2 问答 API

```yaml
# POST /api/v1/rag/query
# RAG 智能问答

request:
  query: string              # 用户问题（必填）
  top_k: integer = 5         # 检索文档数量
  filters: object            # 同 retrieve API
  include_references: boolean = true  # 是否返回引用
  stream: boolean = false    # 是否流式返回
  
response:
  answer: string             # LLM 生成的回答
  confidence: number         # 置信度 (0-1)
  references:
    - doc_id: string
      title: string
      url: string
      relevance_score: number
  search_results:            # 原始检索结果（可选）
    - doc_id: string
      content: string
      score: number
  total_time_ms: number
```

#### 4.3.3 向量化 API

```yaml
# POST /api/v1/rag/embed
# 文本向量化

request:
  texts: string[]            # 待向量化文本列表
  model: string = "default"  # 嵌入模型
  
response:
  embeddings:
    - text: string
      embedding: number[]    # 向量（1536 维）
  model: string
  dimension: integer
  total_tokens: integer
```

### 4.4 上下文增强策略

```
上下文增强 (Context Enhancement):

1. 查询理解阶段
   ├── 意图分类（故障诊断/操作指导/概念解释）
   ├── 关键词提取
   └── 查询扩展（同义词、缩写展开）

2. 检索阶段
   ├── 向量检索（语义相似度）
   ├── 全文检索（关键词匹配）
   └── 混合排序（RRF 融合）

3. 重排序阶段
   ├── 基于 LLM 的相关性重排序
   ├── 去重（相似内容合并）
   └── 多样性保证（不同来源）

4. 上下文构建阶段
   ├── 文档片段拼接
   ├── 元数据标注（来源、时间、作者）
   └── 长度控制（不超过 token 限制）

5. Prompt 优化
   ├── System Prompt 角色定义
   ├── Context 清晰分隔
   ├── 引用格式要求
   └── 不确定性表达指引
```

---

## 五、事件驱动集成 (Event-Driven Integration)

### 5.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Orion 事件驱动集成架构                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

                              事件生产者 (Publishers)
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│                 │                 │                 │                 │
▼                 ▼                 ▼                 ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Orion Visor  │ │ Pipeline     │ │ CMDB         │ │ AI Service   │ │ 外部系统      │
│              │ │              │ │              │ │              │ │              │
│ 用户事件      │ │ 构建事件      │ │ 配置变更     │ │ 诊断事件      │ │ Webhook      │
│ 权限事件      │ │ 部署事件      │ │ 拓扑变更     │ │ RAG 事件       │ │              │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │                │
       └────────────────┴────────────────┴────────────────┴────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           NATS JetStream (事件总线)                               │
│                                                                                  │
│  Streams:                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐               │
│  │ orion-events     │  │ knowledge-events │  │ audit-events     │               │
│  │ (保留 7 天)        │  │ (保留 30 天)       │  │ (保留 90 天)       │               │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘               │
│                                                                                  │
│  Topics:                                                                         │
│  ├── user.*           ├── build.*         ├── config.*                          │
│  ├── permission.*     ├── deploy.*        ├── topology.*                        │
│  ├── auth.*           ├── pipeline.*      ├── diagnosis.*                       │
│  └── session.*        └── artifact.*      └── rag.*                             │
└──────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                              事件消费者 (Subscribers)
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  orion-knowledge-consumer (知识库消费者)                                    │  │
│  │                                                                           │  │
│  │  订阅主题：                                                                │  │
│  │  ├── user.created       → 同步用户到知识库                                 │  │
│  │  ├── user.deleted       → 禁用知识库账户                                   │  │
│  │  ├── permission.updated → 更新知识库权限                                   │  │
│  │  ├── incident.resolved  → 生成故障知识文档                                 │  │
│  │  ├── change.completed   → 生成变更知识文档                                 │  │
│  │  └── optimization.applied → 生成优化知识文档                               │  │
│  │                                                                           │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  其他消费者                                                                 │  │
│  │  ├── Audit Logger (审计日志记录)                                           │  │
│  │  ├── Notification Service (通知发送)                                       │  │
│  │  └── Analytics Service (数据分析)                                          │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 事件定义

#### 5.2.1 用户事件

```json
{
  "specversion": "1.0",
  "type": "user.created",
  "source": "orion-visor",
  "id": "evt-user-001",
  "time": "2026-04-10T10:30:00Z",
  "datacontenttype": "application/json",
  "data": {
    "user_id": "user-123",
    "username": "zhangsan",
    "email": "zhangsan@example.com",
    "tenant_id": "tenant-456",
    "roles": ["developer", "editor"],
    "created_at": "2026-04-10T10:30:00Z"
  }
}
```

#### 5.2.2 故障解决事件

```json
{
  "specversion": "1.0",
  "type": "incident.resolved",
  "source": "orion-visor",
  "id": "evt-incident-001",
  "time": "2026-04-10T10:30:00Z",
  "datacontenttype": "application/json",
  "data": {
    "incident_id": "INC-2026-0410-001",
    "title": "生产环境数据库连接池耗尽",
    "severity": "P1",
    "status": "resolved",
    "root_cause": "订单表缺少联合索引",
    "solution": "添加索引并优化 SQL",
    "owner": {
      "user_id": "user-123",
      "name": "张三",
      "team": "SRE"
    },
    "tags": ["database", "performance", "index"]
  }
}
```

### 5.3 事件驱动集成架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        事件驱动集成架构详解                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   事件生产者     │
                              │  (Publishers)   │
                              └────────┬────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────────────┐
         │                             │                                     │
         ▼                             ▼                                     ▼
┌─────────────────┐         ┌─────────────────┐                   ┌─────────────────┐
│ Orion Visor     │         │ Pipeline        │                   │ CMDB            │
│                 │         │                 │                   │                 │
│ • user.created  │         │ • build.success │                   │ • config.changed│
│ • user.deleted  │         │ • deploy.failed │                   │ • topology.update│
│ • permission.*  │         │ • artifact.*    │                   │                 │
└────────┬────────┘         └────────┬────────┘                   └────────┬────────┘
         │                          │                                     │
         └──────────────────────────┼─────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            NATS JetStream                                        │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Stream: orion-events                                                      │ │
│  │  Retention: 7 days                                                         │ │
│  │  Max Msgs: 1,000,000                                                       │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  Subjects:                                                                       │
│  ├── user.created      ├── user.deleted      ├── user.updated                   │
│  ├── permission.granted ├── permission.revoked                                   │
│  ├── build.completed   ├── deploy.success    ├── deploy.failed                  │
│  ├── config.changed    ├── topology.updated                                       │
│  ├── incident.resolved ├── change.completed  ├── optimization.applied           │
└──────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         事件消费者 (Subscribers)                                 │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  orion-knowledge-consumer                                                   │ │
│  │                                                                             │ │
│  │  Subscriptions:                                                             │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │ │
│  │  │ user.created    │  │ incident.       │  │ permission.     │             │ │
│  │  │ → 创建知识库用户  │  │ resolved        │  │ updated         │             │ │
│  │  │                 │  │ → 生成故障文档    │  │ → 同步权限      │             │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘             │ │
│  │                                                                             │ │
│  │  Processing Pipeline:                                                       │ │
│  │  1. 接收事件 → 2. 验证格式 → 3. 业务处理 → 4. 持久化 → 5. ACK               │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  其他消费者                                                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │ │
│  │  │ Audit Logger    │  │ Notification    │  │ Analytics       │             │ │
│  │  │ (审计日志记录)    │  │ (通知发送)       │  │ (数据分析)       │             │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘             │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、数据同步策略 (Data Synchronization Strategy)

### 6.1 同步场景

| 同步场景 | 方向 | 频率 | 数据量 | 一致性要求 |
|---------|------|------|--------|-----------|
| 用户信息同步 | Visor → Knowledge | 实时（事件驱动） | 小 | 最终一致 |
| 权限信息同步 | Visor → Knowledge | 实时（事件驱动） | 小 | 最终一致 |
| 文档元数据同步 | Knowledge → Visor | 准实时（5 分钟） | 中 | 最终一致 |
| 全量备份 | Knowledge → Backup | 每日 | 大 | 最终一致 |

### 6.2 增量同步机制

```
增量同步流程 (CDC - Change Data Capture):

┌─────────────────┐
│ PostgreSQL      │
│ (orion_knowledge)│
└────────┬────────┘
         │
         │ 1. 数据变更 (INSERT/UPDATE/DELETE)
         │
         ▼
┌─────────────────┐
│ WAL (Write-Ahead│
│ Log)            │
└────────┬────────┘
         │
         │ 2. CDC 捕获变更
         │
         ▼
┌─────────────────┐
│ Debezium /      │
│ pgoutput        │
└────────┬────────┘
         │
         │ 3. 发布变更事件到 NATS
         │
         ▼
┌─────────────────┐
│ NATS JetStream  │
│ Topic:          │
│ knowledge.sync.*│
└────────┬────────┘
         │
         │ 4. 消费者处理
         │
         ▼
┌─────────────────┐
│ 目标系统         │
│ (Visor/Backup)  │
└─────────────────┘
```

### 6.3 全量备份策略

```yaml
# 备份配置
backup:
  schedule: "0 2 * * *"        # 每天凌晨 2 点
  retention:
    daily: 7                   # 保留 7 天日备份
    weekly: 4                  # 保留 4 周全备份
    monthly: 12                # 保留 12 个月备份
  
  targets:
    - type: postgresql
      database: orion_knowledge
      tables: all
      format: sql + custom
    
    - type: chromadb
      collection: all
      format: parquet
    
    - type: minio
      bucket: knowledge
      format: snapshot
  
  storage:
    primary: s3://backup-bucket/orion-knowledge/
    secondary: s3://dr-bucket/orion-knowledge/
  
  verification:
    enabled: true
    schedule: "0 4 * * *"      # 备份后 2 小时验证
    method: restore_test
```

### 6.4 冲突解决策略

```
冲突检测与解决 (Conflict Resolution):

1. 冲突检测
   ├── 基于版本号 (version)
   ├── 基于时间戳 (updated_at)
   └── 基于哈希值 (content_hash)

2. 解决策略
   ├── Last-Write-Wins (LWW)
   │   └── 使用最新时间戳覆盖
   │
   ├── First-Write-Wins (FWW)
   │   └── 保留最早写入
   │
   ├── 手动合并 (Manual Merge)
   │   └── 通知相关人员审核
   │
   └── 业务规则合并 (Business Rules)
       └── 按预定义业务逻辑合并

3. 冲突日志
   └── 记录所有冲突及解决结果，用于审计
```

---

## 七、权限继承 (Permission Inheritance)

### 7.1 权限模型

```
Orion 权限模型 → 知识库权限映射:

┌─────────────────────────────────────────────────────────────────┐
│                      Orion 权限层级                              │
│                                                                  │
│  ┌─────────────────┐                                            │
│  │    Tenant       │  租户级权限                                 │
│  │  (租户管理员)    │  - 知识库创建/删除                          │
│  │                 │  - 配额管理                                 │
│  └────────┬────────┘                                            │
│           │ 继承                                                 │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │     Team        │  团队级权限                                 │
│  │  (团队负责人)    │  - 空间管理                                 │
│  │                 │  - 成员管理                                 │
│  └────────┬────────┘                                            │
│           │ 继承                                                 │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │     User        │  用户级权限                                 │
│  │  (普通成员)     │  - 文档读写                                 │
│  │                 │  - 评论协作                                 │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 角色映射表

| Orion 角色 | 知识库角色 | 权限说明 |
|-----------|-----------|---------|
| `tenant_admin` | `knowledge_admin` | 知识库全部权限 |
| `team_admin` | `space_admin` | 空间管理权限 |
| `editor` | `editor` | 文档编辑权限 |
| `developer` | `viewer` | 文档查看权限 |
| `viewer` | `guest` | 公开文档查看 |

### 7.3 租户隔离机制

```
租户隔离 (Tenant Isolation):

1. 数据隔离
   ├── 数据库行级隔离 (tenant_id 字段)
   ├── 索引隔离 (按 tenant_id 分区)
   └── 存储隔离 (S3 路径含 tenant_id)

2. 访问隔离
   ├── JWT 中携带 tenant_id
   ├── API 层自动过滤非本租户数据
   └── 审计日志记录租户访问

3. 缓存隔离
   └── Redis Key 前缀包含 tenant_id
```

### 7.4 权限继承映射图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          权限继承映射图                                          │
└─────────────────────────────────────────────────────────────────────────────────┘

                              Orion 权限系统
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  租户级权限 (Tenant Level)                                                  │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │ │
│  │  │ tenant_admin    │  │ tenant_member   │  │ tenant_guest    │             │ │
│  │  │                 │  │                 │  │                 │             │ │
│  │  │ - 全部权限       │  │ - 基础访问       │  │ - 只读公开      │             │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘             │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                             │
│                                    ▼ 继承                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  团队级权限 (Team Level)                                                    │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │ │
│  │  │ team_admin      │  │ team_member     │  │ team_viewer     │             │ │
│  │  │                 │  │                 │  │                 │             │ │
│  │  │ - 空间管理       │  │ - 编辑协作       │  │ - 只读          │             │ │
│  │  │ - 成员管理       │  │ - 评论          │  │                 │             │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘             │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                             │
│                                    ▼ 继承                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  文档级权限 (Document Level)                                                │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │ │
│  │  │ doc_owner       │  │ doc_editor      │  │ doc_viewer      │             │ │
│  │  │                 │  │                 │  │                 │             │ │
│  │  │ - 全部权限       │  │ - 编辑          │  │ - 只读          │             │ │
│  │  │ - 权限分配       │  │ - 评论          │  │                 │             │ │
│  │  │ - 删除          │  │ - 版本历史       │  │                 │             │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘             │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                             │
│                                    ▼ 映射                                        │
└──────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        orion-knowledge 权限系统                                    │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  知识库角色 (Knowledge Roles)                                               │ │
│  │                                                                             │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │ │
│  │  │ knowledge_admin │  │ editor          │  │ viewer          │             │ │
│  │  │ ← tenant_admin  │  │ ← editor        │  │ ← developer     │             │ │
│  │  │ ← team_admin    │  │ ← team_member   │  │ ← team_viewer   │             │ │
│  │  │                 │  │                 │  │                 │             │ │
│  │  │ - 全部权限       │  │ - 创建/编辑      │  │ - 只读          │             │ │
│  │  │ - 空间管理       │  │ - 删除自己      │  │ - 公开文档      │             │ │
│  │  │ - 权限管理       │  │ - 评论          │  │                 │             │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘             │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 八、部署架构 (Deployment Architecture)

### 8.1 Kubernetes 部署

```yaml
# orion-knowledge 完整部署清单
apiVersion: v1
kind: Namespace
metadata:
  name: orion-knowledge
  labels:
    app.kubernetes.io/name: orion-knowledge
    app.kubernetes.io/part-of: orion-platform
---
# API Service Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-knowledge-api
  namespace: orion-knowledge
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orion-knowledge-api
  template:
    metadata:
      labels:
        app: orion-knowledge-api
    spec:
      containers:
        - name: api
          image: registry.example.com/orion/orion-knowledge-api:1.0.0
          ports:
            - containerPort: 8000
          env:
            - name: PG_DSN
              valueFrom:
                secretKeyRef:
                  name: orion-knowledge-db
                  key: dsn
            - name: REDIS_ADDR
              value: "orion-knowledge-redis:6379"
            - name: S3_ENDPOINT
              value: "http://orion-knowledge-minio:9000"
            - name: NATS_URL
              value: "nats://orion-knowledge-nats:4222"
            - name: SSO_ENABLED
              value: "true"
            - name: SSO_ORION_URL
              value: "http://orion-visor-service:9200"
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/v1/ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 5
---
# Consumer Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-knowledge-consumer
  namespace: orion-knowledge
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orion-knowledge-consumer
  template:
    metadata:
      labels:
        app: orion-knowledge-consumer
    spec:
      containers:
        - name: consumer
          image: registry.example.com/orion/orion-knowledge-consumer:1.0.0
          env:
            - name: PG_DSN
              valueFrom:
                secretKeyRef:
                  name: orion-knowledge-db
                  key: dsn
            - name: REDIS_ADDR
              value: "orion-knowledge-redis:6379"
            - name: NATS_URL
              value: "nats://orion-knowledge-nats:4222"
          resources:
            requests:
              cpu: 1000m
              memory: 1Gi
            limits:
              cpu: 4000m
              memory: 4Gi
---
# Admin UI Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-knowledge-admin
  namespace: orion-knowledge
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orion-knowledge-admin
  template:
    metadata:
      labels:
        app: orion-knowledge-admin
    spec:
      containers:
        - name: admin
          image: registry.example.com/orion/orion-knowledge-admin:1.0.0
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
---
# App UI (Next.js) Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-knowledge-app
  namespace: orion-knowledge
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orion-knowledge-app
  template:
    metadata:
      labels:
        app: orion-knowledge-app
    spec:
      containers:
        - name: app
          image: registry.example.com/orion/orion-knowledge-app:1.0.0
          ports:
            - containerPort: 3000
          env:
            - name: API_ENDPOINT
              value: "http://orion-knowledge-api:8000"
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi
---
# Service Definitions
apiVersion: v1
kind: Service
metadata:
  name: orion-knowledge-api
  namespace: orion-knowledge
spec:
  selector:
    app: orion-knowledge-api
  ports:
    - port: 8000
      targetPort: 8000
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: orion-knowledge-admin
  namespace: orion-knowledge
spec:
  selector:
    app: orion-knowledge-admin
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: orion-knowledge-app
  namespace: orion-knowledge
spec:
  selector:
    app: orion-knowledge-app
  ports:
    - port: 3000
      targetPort: 3000
  type: ClusterIP
```

### 8.2 网络策略

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: orion-knowledge-network-policy
  namespace: orion-knowledge
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # 允许 API Gateway 访问 API 服务
    - from:
        - namespaceSelector:
            matchLabels:
              name: orion-gateway
      ports:
        - protocol: TCP
          port: 8000
    # 允许 API Gateway 访问前端
    - from:
        - namespaceSelector:
            matchLabels:
              name: orion-gateway
      ports:
        - protocol: TCP
          port: 80
        - protocol: TCP
          port: 3000
  egress:
    # 允许访问 Orion Visor (SSO)
    - to:
        - namespaceSelector:
            matchLabels:
              name: orion-visor
      ports:
        - protocol: TCP
          port: 9200
    # 允许访问 NATS
    - to:
        - namespaceSelector:
            matchLabels:
              name: orion-infra
      ports:
        - protocol: TCP
          port: 4222
    # 允许访问外部向量模型 API
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
```

---

## 九、监控与告警 (Monitoring and Alerting)

### 9.1 监控指标

```yaml
# Prometheus 指标配置
metrics:
  orion-knowledge:
    # 业务指标
    - knowledge_docs_total:              # 文档总数 (gauge)
    - knowledge_docs_created_total:      # 累计创建数 (counter)
    - knowledge_docs_updated_total:      # 累计更新数 (counter)
    - knowledge_spaces_total:            # 空间总数 (gauge)
    
    # RAG 指标
    - rag_queries_total:                 # RAG 查询数 (counter)
    - rag_queries_success_total:         # 成功数 (counter)
    - rag_queries_failed_total:          # 失败数 (counter)
    - rag_latency_seconds:               # RAG 延迟 (histogram)
      buckets: [0.1, 0.5, 1.0, 2.0, 5.0]
    - rag_retrieval_results_count:       # 检索结果数 (histogram)
    
    # 向量库指标
    - vector_store_size_bytes:           # 向量库大小 (gauge)
    - vector_store_latency_seconds:      # 向量检索延迟 (histogram)
    - vector_store_query_total:          # 向量查询数 (counter)
    
    # API 指标
    - api_requests_total:                # API 请求数 (counter)
    - api_request_duration_seconds:      # API 延迟 (histogram)
    - api_errors_total:                  # API 错误数 (counter)
    
    # 事件处理指标
    - events_processed_total:            # 处理事件数 (counter)
    - events_failed_total:               # 失败事件数 (counter)
    - event_processing_duration_seconds: # 处理延迟 (histogram)
```

### 9.2 告警规则

```yaml
# Prometheus 告警规则
groups:
  - name: orion-knowledge
    interval: 30s
    rules:
      # API 错误率告警
      - alert: KnowledgeAPIHighErrorRate
        expr: |
          sum(rate(api_errors_total[5m])) / sum(rate(api_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Knowledge API 错误率过高"
          description: "API 错误率 {{ $value | humanizePercentage }} 超过 5%"
      
      # RAG 延迟告警
      - alert: KnowledgeRAGHighLatency
        expr: |
          histogram_quantile(0.95, sum(rate(rag_latency_seconds_bucket[5m])) by (le)) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "RAG 检索延迟过高"
          description: "P95 延迟 {{ $value }}s 超过 2s"
      
      # 事件积压告警
      - alert: KnowledgeEventBacklog
        expr: |
          nats_consumer_lag{stream="orion-events", consumer="knowledge-consumer"} > 1000
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Knowledge 事件积压严重"
          description: "事件积压 {{ $value }} 条"
      
      # 服务不可用告警
      - alert: KnowledgeAPIDown
        expr: |
          up{job="orion-knowledge-api"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Knowledge API 服务不可用"
          description: "服务 {{ $labels.instance }} 已宕机 2 分钟"
```

---

## 十、安全设计 (Security Design)

### 10.1 传输安全

```
传输安全 (Transport Security):

1. HTTPS/TLS
   ├── 所有外部通信使用 HTTPS
   ├── 内部服务间使用 mTLS（可选）
   └── TLS 1.3 优先

2. JWT Token 安全
   ├── 使用 RS256 非对称加密
   ├── Token 有效期≤1 小时
   ├── Refresh Token 有效期≤24 小时
   └── 支持 Token 黑名单（吊销）

3. API 安全
   ├── API Key 认证（服务间）
   ├── Rate Limiting（限流）
   └── CORS 配置（跨域控制）
```

### 10.2 数据安全

```
数据安全 (Data Security):

1. 静态数据加密
   ├── 数据库透明加密 (TDE)
   ├── S3 对象加密 (SSE-S3)
   └── 敏感字段应用层加密

2. 访问控制
   ├── 最小权限原则
   ├── RBAC 权限控制
   └── 审计日志记录

3. 数据脱敏
   ├── 日志脱敏
   ├── 测试数据脱敏
   └── API 响应脱敏（按权限）
```

---

## 十一、容错与降级 (Fault Tolerance and Degradation)

### 11.1 熔断策略

```yaml
# 熔断配置
circuit_breaker:
  orion-knowledge-api:
    failure_threshold: 5        # 失败阈值
    recovery_timeout: 30s       # 恢复超时
    half_open_requests: 3       # 半开状态请求数
  
  chromadb:
    failure_threshold: 3
    recovery_timeout: 60s
  
  elasticsearch:
    failure_threshold: 3
    recovery_timeout: 60s
  
  llm:
    failure_threshold: 5
    recovery_timeout: 30s
```

### 11.2 降级方案

| 组件 | 降级触发条件 | 降级行为 | 恢复条件 |
|------|-------------|---------|---------|
| **orion-knowledge-api** | 服务不可用 | 使用本地缓存文档快照 | 服务恢复 |
| **ChromaDB** | 向量库不可用 | 降级为纯全文检索 | 服务恢复 |
| **Elasticsearch** | 全文检索不可用 | 降级为向量检索 | 服务恢复 |
| **LLM** | AI 不可用 | 降级为纯检索，返回文档片段 | 服务恢复 |
| **NATS** | 消息队列不可用 | 本地队列缓冲，恢复后重放 | 服务恢复 |

---

## 十二、验收标准 (Acceptance Criteria)

### 12.1 功能验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| F1 | Nginx 路由正确 | 访问各路径 | 正确转发到目标服务 |
| F2 | SSO 登录正常 | 单点登录测试 | 一次登录，多处访问 |
| F3 | 权限继承正确 | 权限变更测试 | 知识库权限同步更新 |
| F4 | 知识自动积累 | 触发事件测试 | 自动生成知识文档 |
| F5 | RAG 检索准确 | 查询测试 | 返回相关文档 |
| F6 | RAG 问答正确 | 问答测试 | 回答准确，引用正确 |
| F7 | 事件订阅正常 | 发布事件测试 | Consumer 正确处理 |
| F8 | 数据同步正常 | 数据变更测试 | 目标系统数据一致 |

### 12.2 性能验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| P1 | API P99 延迟 | 压测 | <200ms |
| P2 | RAG P99 延迟 | 压测 | <2s |
| P3 | 向量检索延迟 | 基准测试 | <100ms |
| P4 | 吞吐量 | 压测 | >500 RPS |
| P5 | 事件处理延迟 | 监控 | <5s |

### 12.3 运维验收

| 编号 | 验收项 | 验收方法 | 通过标准 |
|------|--------|---------|---------|
| O1 | 监控指标完整 | 检查 Dashboard | 所有关键指标可见 |
| O2 | 告警配置正确 | 告警演练 | 告警准确触发 |
| O3 | 日志收集完整 | 日志查询 | 所有服务日志可见 |
| O4 | 部署脚本可用 | 部署演练 | 一键部署成功 |
| O5 | 回滚方案可用 | 回滚演练 | 10 分钟内回滚 |

---

## 十三、附录 (Appendix)

### 13.1 术语表

| 术语 | 定义 |
|------|------|
| **RAG** | Retrieval-Augmented Generation，检索增强生成 |
| **SSO** | Single Sign-On，单点登录 |
| **JWT** | JSON Web Token，一种令牌格式 |
| **NATS** | 高性能消息队列系统 |
| **ChromaDB** | 向量数据库，用于存储文档向量 |
| **CDC** | Change Data Capture，变更数据捕获 |
| **RBAC** | Role-Based Access Control，基于角色的访问控制 |
| **mTLS** | mutual TLS，双向 TLS 认证 |

### 13.2 参考文档

| 文档 | 链接 |
|------|------|
| Orion-Knowledge 微服务改造方案 | `docs/knowledge/Orion-Knowledge 微服务改造方案.md` |
| Knowledge Base Design | `docs/knowledge/knowledge-base-design.md` |
| Platform Service Split Implementation | `docs/architecture/platform-service-split-implementation.md` |

### 13.3 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 优先级：P1 | 状态：设计中 | 维护团队：Orion Platform Team_


---

# 第十六章：子应用改造说明

> 来源: orion-knowledge-改造说明.md

---

# orion-knowledge 子应用改造说明

**状态**: 需要额外调研  
**技术栈**: Next.js + React 19 + MUI  
**复杂度**: 高

---

## 一、当前状态

### 技术架构

- **框架**: Next.js (App Router)
- **React 版本**: 19.2.3
- **UI 库**: @ctzhian/ui (基于 MUI)
- **包管理**: pnpm + monorepo
- **构建工具**: Next.js 内置

### 目录结构

```
orion-knowledge/web/
├── admin/          # 管理后台
├── app/           # 主应用 (Next.js App Router)
├── packages/      # 共享包
│   ├── icons/     # 图标库
│   ├── themes/    # 主题库
│   └── ui/        # UI 组件库
└── package.json   # monorepo 配置
```

---

## 二、wujie 适配挑战

### 2.1 Next.js 微前端限制

Next.js 的微前端接入相比 Vite/Webpack 应用更为复杂，主要因为：

1. **服务端渲染 (SSR)**: Next.js 默认开启 SSR，而 wujie 主要在客户端运行
2. **路由系统**: Next.js 使用文件系统路由，与 wujie 的路由管理有冲突
3. **构建输出**: Next.js 输出为 Node.js 服务，不是静态 UMD 包

### 2.2 可选方案

#### 方案 A: Next.js + wujie (实验性)

使用 `next-micro-frontend` 或自定义方案，需要：
- 禁用 SSR (`ssr: false`)
- 使用 `output: 'export'` 导出静态文件
- 配置 wujie 生命周期

**优点**: 保持 Next.js 特性
**缺点**: 配置复杂，部分 Next.js 特性不可用

#### 方案 B: 降级为 Create React App / Vite

如果 Next.js 特性不是必需的，可以考虑：
- 将核心页面迁移到 Vite + React
- 使用标准的 wujie 接入方式

**优点**: 微前端接入简单
**缺点**: 失去 Next.js 的 SSR/路由等特性

#### 方案 C: 使用 iframe 独立部署

作为临时方案：
- orion-knowledge 独立部署
- 主应用通过 iframe 嵌入

**优点**: 改动最小
**缺点**: 体验和集成度不如 wujie

---

## 三、推荐方案

鉴于 orion-knowledge 的复杂性和 Next.js 微前端的不成熟性，建议：

### 短期方案 (MVP 阶段)

1. **保持独立部署**: orion-knowledge 作为独立应用运行
2. **单点登录集成**: 通过 Token 实现认证互通
3. **导航集成**: 在主应用添加知识库导航入口
4. **新窗口打开**: 点击导航时在新窗口/标签页打开知识库

### 中期方案 (Phase 2)

1. **评估必要性**: 评估微前端集成的实际价值
2. **技术验证**: 进行 Next.js + wujie 的 POC 验证
3. **渐进式迁移**: 如确有必要，考虑将核心功能迁移到 Vite

### 长期方案 (Phase 3+)

1. **统一技术栈**: 如果前端技术栈统一为 React + Vite
2. **完整微前端集成**: 实现完整的 wujie 集成

---

## 四、改造清单 (当前暂不执行)

### 4.1 入口文件改造 (待 Next.js 方案成熟后)

```typescript
// src/app/provider/wujie-provider.tsx (待创建)
'use client';

import { useEffect } from 'react';

interface WujieProviderProps {
  children: React.ReactNode;
}

export function WujieProvider({ children }: WujieProviderProps) {
  useEffect(() => {
    // 标记为 wujie 子应用
    (window as any).__POWERED_BY_WUJIE__ = true;
    
    // 导出生命周期 (需要在主应用中调用)
    window.mount = (props: any) => {
      console.log('[orion-knowledge] mount', props);
    };
    
    window.unmount = () => {
      console.log('[orion-knowledge] unmount');
    };
    
    return () => {
      (window as any).__POWERED_BY_WUJIE__ = false;
    };
  }, []);
  
  return <>{children}</>;
}
```

### 4.2 Next.js 配置 (待 Next.js 方案成熟后)

```javascript
// next.config.js (待修改)
module.exports = {
  // 禁用 SSR 以支持微前端
  reactStrictMode: true,
  ssr: false,
  
  // 配置输出为静态
  output: 'export',
  
  // 配置 basePath
  basePath: '/orion-knowledge',
  
  // 配置 CORS
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
        ],
      },
    ];
  },
}
```

---

## 五、决策记录

**决策**: 暂不进行 orion-knowledge 微前端改造  
**原因**:
1. Next.js 微前端技术尚不成熟
2. MVP 阶段优先保证核心功能
3. 可采用独立部署 + SSO 方案替代

**后续行动**:
1. 在 F206 联调测试阶段，使用新窗口打开方案
2. 在 Phase 2 重新评估微前端集成的必要性
3. 如确有必要，进行技术验证和 POC

---

## 六、替代方案实施

### 6.1 主应用配置

```typescript
// orion-frontend/src/microfront/apps.ts
export const subAppConfigs: SubAppConfig[] = [
  // ... 其他子应用
  {
    name: '知识库',
    key: 'knowledge',
    path: '/knowledge/*',
    url: 'http://localhost:3002', // 独立部署地址
    container: '#wujie-knowledge',
    enabled: false, // 暂时禁用 wujie 集成
    openInNewTab: true, // 新窗口打开
  },
];
```

### 6.2 认证集成

- orion-knowledge 接受主应用传递的 Token
- 通过 URL 参数或 localStorage 共享认证状态

---

## 七、参考文档

- [Next.js 官方文档](https://nextjs.org/)
- [wujie 框架说明](https://wujie-micro.github.io/)
- [微前端与 Next.js](https://github.com/wujie-micro/wujie/issues)
