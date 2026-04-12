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
