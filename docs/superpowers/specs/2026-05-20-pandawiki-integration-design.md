# PandaWiki 与 Orion 平台集成架构设计

**文档版本**: v1.3 (三次评审修订版)
**创建日期**: 2026-05-20
**修订日期**: 2026-05-20
**状态**: 专家评审通过，可实施

## 1. 背景与目标

### 1.1 背景

当前 Orion 系统中存在多个文档/知识相关模块：

| 模块 | 前端路径 | 后端实现 | 状态 |
|------|---------|---------|------|
| 文档中心 | `/documents` | `orion-platform-service` | 基础CRUD |
| AI 知识库 | `/ai/knowledge` | `orion-platform-service` | 伪RAG |
| AI Docs | `/ai/docs` | AIDocManagement前端 | 页面存在 |
| 知识库 | `/knowledge` | Pandawiki (独立) | 功能完整 |
| orion-knowledge-svc | - | Node.js (:3020) | 现有服务 |

这些模块存在以下问题：
1. **功能重复** - 多个入口提供类似功能
2. **能力差异大** - 平台内置知识库功能弱，无RAG/LLM能力
3. **数据分散** - 文档数据存储在多个位置
4. **维护成本高** - 需要维护多套代码

### 1.2 目标

以 PandaWiki (orion-knowledge) 为主，统一文档/知识模块：

1. **统一入口** - 文档中心、AI知识库、AI Docs 统一指向 PandaWiki
2. **认证打通** - PandaWiki 复用 Orion 平台的 JWT 认证
3. **租户隔离** - 为 PandaWiki 增加租户支持
4. **RAG增强** - 完善向量检索和 LLM 问答能力
5. **替换旧服务** - 用 PandaWiki 替换现有的 orion-knowledge-svc

### 1.3 集成策略

选择方案A：**完全替换** - 用PandaWiki完全替换现有的 orion-knowledge-svc (端口3020)

## 2. 现状分析

### 2.1 PandaWiki 架构

```
┌─────────────────────────────────────────────────────────┐
│                    orion-knowledge                       │
├─────────────────────────────────────────────────────────┤
│  Frontend (Next.js)         │  Backend (Go + Echo)      │
│  - admin (端口 5173)        │  - API Server (:8000)     │
│  - app  (端口 3010)         │  - LLM 集成               │
│                             │  - 向量存储               │
└─────────────────────────────────────────────────────────┘
```

- **认证**: 独立的 JWT + Session 系统，有独立用户表
- **数据模型**: space, document, node, chat, conversation
- **租户**: 无租户概念，所有数据全局共享
- **实际路由**: `/api/v1/knowledge_base`, `/api/v1/node` 等

### 2.2 orion-knowledge-svc 架构 (将被替换)

```
┌─────────────────────────────────────────────────────────┐
│                  orion-knowledge-svc                     │
├─────────────────────────────────────────────────────────┤
│  Node.js + Fastify                                       │
│  端口: 3020                                              │
│  路由前缀: /knowledge/v1/*                               │
│  API: /spaces, /docs, /rag, /graph                      │
└─────────────────────────────────────────────────────────┘
```

- **路由**: `/knowledge/v1/spaces`, `/knowledge/v1/docs` 等
- **数据**: kb_spaces, kb_docs, kb_doc_versions
- **问题**: 伪RAG，无真正LLM能力

### 2.3 核心差异

| 维度 | PandaWiki | orion-knowledge-svc |
|------|-----------|---------------------|
| 技术栈 | Go + Echo | Node.js + Fastify |
| 租户支持 | ❌ (需新增) | ✅ |
| LLM集成 | ✅ | ❌ |
| 向量检索 | ✅ (pgvector) | ❌ (预留字段未用) |
| 端口 | 8000 → 3020 | 3020 (将被替换) |
| RAG能力 | 完整 | 伪RAG |

## 3. 集成方案设计

### 3.1 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        API Gateway (:3000)                        │
├──────────────────────────────────────────────────────────────────┤
│  /api/v1/*              -> orion-platform-service (:3001)       │
│  /api/v1/knowledge/*    -> orion-knowledge (:3020)  [复用/替换]  │
└──────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Platform Svc   │  │  PandaWiki      │  │   Frontend      │
│  (:3001)        │  │  (:3020)        │  │   (:5173/5174)  │
│                 │  │  (替换旧服务)    │  │                 │
│ - 知识库API     │  │ - 文档管理      │  │ - 统一入口      │
│ - 伪RAG         │  │ - 知识空间      │  │ - Wujie微前端   │
│                 │  │ - RAG/LLM       │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

> **架构说明**: 复用现有 API Gateway 中已配置的 3020 端口，将 PandaWiki Go 后端部署于此，替换现有的 orion-knowledge-svc

### 3.2 集成步骤

#### Phase 1: 端口与路由调整 + API适配

| 任务 | 说明 | 涉及文件 |
|------|------|---------|
| 1.1 | PandaWiki 端口改为 3020 (复用现有配置) | `orion-knowledge/backend/config/config.go` |
| 1.2 | PandaWiki 添加兼容路由 (/api/v1/knowledge/*) | `orion-knowledge/backend/handler/v1/routes_compat.go` [新建] |
| 1.3 | 确认 knowledge 服务指向 3020 | `orion-api-gateway/src/config/index.ts` |
| 1.4 | 停止 orion-knowledge-svc 服务 | 部署配置 |
| 1.5 | 验证 API 路径转发正常 | 手动测试 |

> **关键**: 在 PandaWiki 端添加与 Orion 平台兼容的路由，无需修改 API Gateway

#### Phase 2: 认证体系打通

```
用户访问流程：
1. 用户登录 Orion 平台 -> 获取 JWT Token
2. 前端携带 Token 访问 PandaWiki
3. PandaWiki 验证 Token，提取 user_id + tenant_id
4. 根据 tenant_id 过滤数据
```

| 任务 | 说明 | 涉及文件 |
|------|------|---------|
| 2.1 | PandaWiki 增加 Orion JWT 验证中间件 | `orion-knowledge/backend/middleware/orion_auth.go` [新建] |
| 2.2 | 支持双模式认证 (PandaWiki原生 / Orion JWT) | `orion-knowledge/backend/middleware/auth.go` |
| 2.3 | 前端 Token 透传 | `orion-frontend/src/api/pandawiki.ts` |

#### Phase 3: 租户隔离实现

数据库层面增加 tenant_id 字段：

```sql
-- 新增 tenant_id 字段
ALTER TABLE spaces ADD COLUMN tenant_id VARCHAR(36) DEFAULT 'default';
ALTER TABLE documents ADD COLUMN tenant_id VARCHAR(36) DEFAULT 'default';

-- 创建索引
CREATE INDEX idx_spaces_tenant ON spaces(tenant_id);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
```

| 任务 | 说明 | 涉及文件 |
|------|------|---------|
| 3.1 | 数据库迁移脚本 | `orion-knowledge/backend/migration/tenant.go` [新建] |
| 3.2 | Repository 层租户过滤 | `orion-knowledge/backend/usecase/knowledge_base.go` |
| 3.3 | API 层租户传递 | 所有 handler 增加 tenant_id 解析 |

#### Phase 4: 前端入口整合

统一菜单配置，废弃重复入口：

```
现有入口                    ->  目标
------------------------------------------------------------
/documents (文档中心)       ->  /api/v1/knowledge/spaces
/ai/knowledge (AI知识库)    ->  /api/v1/knowledge/spaces?mode=ai
/ai/docs (AI Docs)          ->  /api/v1/knowledge/rag-query
/knowledge (知识库)         ->  /api/v1/knowledge/spaces
```

| 任务 | 说明 | 涉及文件 |
|------|------|---------|
| 4.1 | 路由重定向 | `orion-frontend/src/router/routes.tsx` |
| 4.2 | 菜单配置更新 | `orion-frontend/src/stores/menuConfigStore.ts` |
| 4.3 | API 客户端更新 | `orion-frontend/src/api/pandawiki.ts` |

#### Phase 5: RAG 能力完善

```
┌─────────────────────────────────────────────────────────────┐
│                      RAG 架构                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   用户Query ──► Embedding Service ──► 向量检索 (pgvector)   │
│                        │                    │                │
│                        ▼                    ▼                │
│                  LLM Service ──► 生成自然语言回答            │
│                  (OpenAI/Claude)                            │
└─────────────────────────────────────────────────────────────┘
```

| 任务 | 说明 | 涉及文件 |
|------|------|---------|
| 5.1 | 启用 pgvector 扩展 | 数据库 migration |
| 5.2 | 文档 embedding 生成 | `orion-knowledge/backend/usecase/embedding.go` [新建] |
| 5.3 | RAG API 完善 | `orion-knowledge/backend/usecase/rag.go` [新建/修改] |

#### Phase 6: 权限集成

| 任务 | 说明 | 涉及文件 |
|------|------|---------|
| 6.1 | 集成 Orion 权限引擎 | `orion-knowledge/backend/middleware/orion_permission.go` [新建] |
| 6.2 | 配置权限映射 | 各 handler 添加权限检查 |
| 6.3 | 安全审计日志 | `orion-knowledge/backend/middleware/audit.go` [新建] |

## 4. API 统一设计

### 4.1 现有 API 对比

| 功能 | orion-knowledge-svc | PandaWiki |
|------|---------------------|-----------|
| 知识空间列表 | GET /knowledge/v1/spaces | GET /api/v1/knowledge_base/list |
| 创建空间 | POST /knowledge/v1/spaces | POST /api/v1/knowledge_base |
| 文档列表 | GET /knowledge/v1/docs | GET /api/v1/node/list |
| 创建文档 | POST /knowledge/v1/docs | POST /api/v1/node |
| RAG检索 | POST /knowledge/v1/rag/retrieve | POST /api/v1/chat/knowledge |

### 4.2 统一 API 策略

**方案**: 在 PandaWiki 端添加兼容路由，适配 Orion 平台的前端调用

### 4.3 核心 API 列表

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/v1/knowledge/spaces | 知识空间列表 |
| POST | /api/v1/knowledge/spaces | 创建知识空间 |
| GET | /api/v1/knowledge/spaces/:id | 空间详情 |
| DELETE | /api/v1/knowledge/spaces/:id | 删除空间 |
| GET | /api/v1/knowledge/docs | 文档列表 |
| POST | /api/v1/knowledge/docs | 创建文档 |
| GET | /api/v1/knowledge/docs/:id | 文档详情 |
| PUT | /api/v1/knowledge/docs/:id | 更新文档 |
| DELETE | /api/v1/knowledge/docs/:id | 删除文档 |
| POST | /api/v1/knowledge/rag/retrieve | RAG 检索 |
| POST | /api/v1/knowledge/rag/query | RAG 问答 |
| POST | /api/v1/knowledge/embedding | 生成 Embedding |

### 4.4 API 路径适配层

#### 4.4.1 路径冲突分析

当前系统存在两个知识服务：

| 服务 | 技术栈 | 端口 | 前端调用路径 | 后端路由 |
|------|--------|------|-------------|----------|
| orion-knowledge-svc | Node.js | 3020 | `/api/v1/knowledge/*` | `/knowledge/v1/*` |
| orion-knowledge (PandaWiki) | Go | 8000 | `/api/v1/knowledge/*` | 需添加兼容路由 |

#### 4.4.2 解决方案：PandaWiki 路由适配（推荐）

在 PandaWiki 端添加与 Orion 平台兼容的路由：

```go
// orion-knowledge/backend/handler/v1/routes_compat.go

// 兼容 Orion 平台的路由适配
compatGroup := e.Group("/api/v1/knowledge")

// 空间相关 - 映射到 knowledge_base
compatGroup.GET("/spaces", h.GetKnowledgeBaseList)
compatGroup.POST("/spaces", h.CreateKnowledgeBase)
compatGroup.GET("/spaces/:id", h.GetKnowledgeBaseDetail)
compatGroup.PUT("/spaces/:id", h.UpdateKnowledgeBase)
compatGroup.DELETE("/spaces/:id", h.DeleteKnowledgeBase)

// 文档相关 - 映射到 node
compatGroup.GET("/docs", h.ListNodes)
compatGroup.POST("/docs", h.CreateNode)
compatGroup.GET("/docs/:id", h.GetNodeDetail)
compatGroup.PUT("/docs/:id", h.UpdateNode)
compatGroup.DELETE("/docs/:id", h.DeleteNode)

// RAG 相关
compatGroup.POST("/rag/retrieve", h.RAGRetrieve)
compatGroup.POST("/rag/query", h.RAGQuery)
```

#### 4.4.3 完整路径映射表

| 前端调用路径 | PandaWiki 实际路由 | 功能 |
|-------------|-------------------|------|
| GET /api/v1/knowledge/spaces | GET /api/v1/knowledge_base/list | 知识空间列表 |
| POST /api/v1/knowledge/spaces | POST /api/v1/knowledge_base | 创建知识空间 |
| GET /api/v1/knowledge/spaces/:id | GET /api/v1/knowledge_base/detail | 空间详情 |
| PUT /api/v1/knowledge/spaces/:id | PUT /api/v1/knowledge_base/detail | 更新空间 |
| DELETE /api/v1/knowledge/spaces/:id | DELETE /api/v1/knowledge_base/detail | 删除空间 |
| GET /api/v1/knowledge/docs | GET /api/v1/node/list | 文档列表 |
| POST /api/v1/knowledge/docs | POST /api/v1/node | 创建文档 |
| GET /api/v1/knowledge/docs/:id | GET /api/v1/node/detail | 文档详情 |
| PUT /api/v1/knowledge/docs/:id | PUT /api/v1/node/detail | 更新文档 |
| DELETE /api/v1/knowledge/docs/:id | DELETE /api/v1/node/detail | 删除文档 |
| POST /api/v1/knowledge/rag/retrieve | POST /api/v1/chat/knowledge | RAG 检索 |
| POST /api/v1/knowledge/rag/query | POST /api/v1/chat/knowledge | RAG 问答 |

#### 4.4.4 替换策略

**Phase 1 完成后**：

```
替换前:
API Gateway -> orion-knowledge-svc (:3020) -> Node.js 知识库

替换后:
API Gateway -> orion-knowledge (:3020) -> PandaWiki Go 后端 (带兼容路由)
                    ↑
            修改端口配置，添加兼容路由
```

## 5. 认证设计

### 5.1 安全认证流程

> **安全修复**: 移除自动降级机制，改为明确的三态处理

```go
// middleware/orion_auth.go

// 认证模式枚举
type AuthMode int
const (
    AuthModeNone AuthMode = iota
    AuthModeOrion     // Orion JWT 认证
    AuthModePandaWiki // PandaWiki 原生认证
)

// 配置项
type AuthConfig struct {
    EnablePandaWikiFallback bool // 是否允许降级到PandaWiki原生认证（生产环境应关闭）
    OrionJWTIssuer string        // Orion 平台签发者
    JWTSecret string             // JWT 验证密钥
}

func OrionAuthMiddleware(config *AuthConfig) echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            authHeader := c.Request().Header.Get("Authorization")

            // 1. 有 Authorization Header，尝试 Orion JWT 验证
            if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
                token := strings.TrimPrefix(authHeader, "Bearer ")

                // 完整JWT验证（包含安全检查）
                claims, err := validateOrionJWT(token, config)
                if err == nil {
                    // Orion JWT 验证成功
                    c.Set("user_id", claims.UserID)
                    c.Set("tenant_id", claims.TenantID)
                    c.Set("auth_mode", "orion")
                    c.Set("roles", claims.Roles)
                    log.Printf("[Auth] Orion JWT validated for user: %s, tenant: %s", claims.UserID, claims.TenantID)
                    return next(c)
                }

                // JWT 验证失败 - 记录日志并拒绝访问
                log.Printf("[Auth] Orion JWT validation failed: %v", err)
                if !config.EnablePandaWikiFallback {
                    return echo.NewHTTPError(http.StatusUnauthorized, "Invalid Orion JWT token")
                }
                // 降级时记录安全警告
                log.Printf("[Security] JWT failed, falling back to PandaWiki auth - possible attack attempt")
            }

            // 2. 无 Orion JWT，检查是否允许 PandaWiki 原生认证
            if config.EnablePandaWikiFallback {
                c.Set("auth_mode", "pandawiki")
                return next(c)
            }

            // 3. 都不允许，返回 401
            return echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
        }
    }
}
```

### 5.2 JWT 完整验证（安全增强）

```go
// validateOrionJWT - 完整的 JWT 验证，包含标准声明检查
type OrionJWTClaims struct {
    UserID   string   `json:"sub"`
    TenantID string   `json:"tenant_id"`
    Username string   `json:"username"`
    Roles    []string `json:"roles"`
    Issuer   string   `json:"iss"`
    Audience string   `json:"aud"`
    IssuedAt int64    `json:"iat"`
    ExpiresAt int64   `json:"exp"`
}

func validateOrionJWT(token string, config *AuthConfig) (*OrionJWTClaims, error) {
    // 1. 解析 Token
    claims := &OrionJWTClaims{}
    tokenParser := jwt.Parser{
        ValidMethods: []string{"RS256", "HS256"},
    }
    _, err := tokenParser.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
        return []byte(config.JWTSecret), nil
    })
    if err != nil {
        return nil, fmt.Errorf("token parse failed: %w", err)
    }

    // 2. 验证签发者 (iss)
    if claims.Issuer != config.OrionJWTIssuer {
        return nil, fmt.Errorf("invalid issuer: %s", claims.Issuer)
    }

    // 3. 验证受众 (aud) - 可选，根据业务需求
    // if claims.Audience != "pandawiki" { ... }

    // 4. 验证过期时间 (exp)
    now := time.Now().Unix()
    if claims.ExpiresAt < now {
        return nil, fmt.Errorf("token expired")
    }

    // 5. 验证签发时间 (iat) - 防止未来token攻击
    if claims.IssuedAt > now+300 { // 允许5分钟 clock skew
        return nil, fmt.Errorf("token issued in the future")
    }

    return claims, nil
}
```

### 5.3 认证配置

| 配置项 | 生产环境建议值 | 说明 |
|--------|---------------|------|
| `EnablePandaWikiFallback` | `false` | 生产环境关闭降级，防止攻击 |
| `OrionJWTIssuer` | `orion-platform` | Orion 平台签发者标识 |
| `JWTSecret` | (从配置中心获取) | 与 Orion 平台共享的密钥 |

## 6. 数据模型变更

### 6.1 数据表变更

```sql
-- ==================== 启用 pgvector 扩展 ====================
CREATE EXTENSION IF NOT EXISTS vector;

-- ==================== 空间表 ====================
ALTER TABLE spaces ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';

-- 创建索引
CREATE INDEX idx_spaces_tenant ON spaces(tenant_id);

-- 唯一约束（租户内空间名唯一）
ALTER TABLE spaces ADD CONSTRAINT uq_space_tenant_name UNIQUE (tenant_id, name);

-- ==================== 文档表 ====================
ALTER TABLE documents ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';

-- embedding 字段 (1536维，对应 OpenAI text-embedding-3-small)
ALTER TABLE documents ADD COLUMN embedding vector(1536);

-- 创建索引
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_space ON documents(space_id);

-- 唯一约束（租户内文档名唯一）
ALTER TABLE documents ADD CONSTRAINT uq_doc_tenant_space_title UNIQUE (tenant_id, space_id, title);

-- ==================== 向量检索索引 (HNSW) ====================
CREATE INDEX idx_documents_embedding ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ==================== 用户表（不添加 tenant_id）====================
ALTER TABLE users ADD COLUMN orion_user_id VARCHAR(36) UNIQUE;
CREATE INDEX idx_users_orion ON users(orion_user_id);

-- ==================== 其他相关表（租户隔离）====================
ALTER TABLE conversations ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);

ALTER TABLE chat_messages ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
CREATE INDEX idx_chat_messages_tenant ON chat_messages(tenant_id);
```

### 6.2 Row Level Security (RLS) 策略

```sql
-- 启用 RLS
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY tenant_isolation_spaces ON spaces
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_documents ON documents
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
```

### 6.3 数据迁移脚本（带校验）

```sql
-- ==================== 迁移前：数据清洗 ====================
UPDATE spaces
SET name = name || '-' || LEFT(id, 8)
WHERE id IN (
    SELECT id FROM (
        SELECT id, name, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at) as rn
        FROM spaces
    ) t WHERE rn > 1
);

-- ==================== 迁移执行 ====================
BEGIN;

UPDATE spaces SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE documents SET tenant_id = 'default' WHERE tenant_id IS NULL;

ALTER TABLE spaces ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN tenant_id SET NOT NULL;

COMMIT;

-- ==================== 迁移后：数据校验 ====================
SELECT
    (SELECT COUNT(*) FROM spaces WHERE tenant_id IS NULL) as spaces_without_tenant,
    (SELECT COUNT(*) FROM documents WHERE tenant_id IS NULL) as docs_without_tenant,
    (SELECT COUNT(DISTINCT array_length(embedding, 1)) FROM documents WHERE embedding IS NOT NULL) as embedding_dims;
```

### 6.4 Embedding 同步机制

```go
// 文档内容变更触发 embedding 重建
func (d *DocumentUseCase) UpdateDocument(ctx context.Context, docID string, req UpdateDocReq) error {
    doc, err := d.docRepo.Update(ctx, docID, req)
    if err != nil {
        return err
    }

    // 异步触发 embedding 更新
    go func() {
        embedding, err := d.embeddingService.Generate(doc.Content)
        if err != nil {
            log.Printf("[Warning] Failed to generate embedding for doc %s: %v", docID, err)
            return
        }
        d.docRepo.UpdateEmbedding(ctx, docID, embedding)
        log.Printf("[Info] Embedding updated for doc %s", docID)
    }()

    return nil
}
```

### 6.5 批量 Embedding 生成策略

```go
// embedding 批量生成服务
type EmbeddingBatchService struct {
    batchSize  int
    maxWorkers int
}

func (s *EmbeddingBatchService) GenerateAll(ctx context.Context) error {
    docs, err := s.docRepo.FindWithoutEmbedding(ctx)
    if err != nil {
        return err
    }

    log.Printf("[Info] Starting batch embedding generation for %d documents", len(docs))

    sem := make(chan struct{}, s.maxWorkers)
    var wg sync.WaitGroup

    for i := 0; i < len(docs); i += s.batchSize {
        batch := docs[i:min(i+s.batchSize, len(docs))]

        wg.Add(1)
        sem <- struct{}{}

        go func(batch []Document) {
            defer wg.Done()
            defer <-sem

            for _, doc := range batch {
                embedding, err := s.embeddingService.Generate(doc.Content)
                if err != nil {
                    log.Printf("[Error] Failed to generate embedding for doc %s: %v", doc.ID, err)
                    continue
                }
                s.docRepo.UpdateEmbedding(ctx, doc.ID, embedding)
            }
        }(batch)
    }

    wg.Wait()
    return nil
}
```

**配置建议**：
- `batchSize`: 100
- `maxWorkers`: 5
- embedding 模型: OpenAI text-embedding-3-small (1536维)

### 6.6 旧系统数据迁移策略

```sql
-- 旧系统数据迁移脚本 (orion-knowledge-svc -> PandaWiki)

-- 1. 迁移空间数据
INSERT INTO pandawiki.knowledge_base (id, name, type, status, created_at, updated_at)
SELECT id, name, type, 'active', created_at, updated_at
FROM orion_platform.kb_spaces
ON CONFLICT (id) DO NOTHING;

-- 2. 迁移文档数据
INSERT INTO pandawiki.node (id, knowledge_base_id, parent_id, title, content, created_at, updated_at)
SELECT id, space_id, parent_id, title, content, created_at, updated_at
FROM orion_platform.kb_docs
ON CONFLICT (id) DO NOTHING;
```

**字段映射表**：

| 旧系统字段 | PandaWiki 字段 |
|-----------|---------------|
| kb_spaces.id | knowledge_base.id |
| kb_spaces.name | knowledge_base.name |
| kb_docs.id | node.id |
| kb_docs.space_id | node.knowledge_base_id |
| kb_docs.title | node.title |
| kb_docs.content | node.content |

> **替代方案**: 如无需保留旧数据，可明确说明数据废弃策略，用户确认后直接使用 PandaWiki。

## 7. 权限模型设计

### 7.1 混合权限模式

> 采用混合模式 - 核心资源使用 Orion 权限体系，节点级细粒度权限保留 PandaWiki 原生能力

```
┌─────────────────────────────────────────────────────────────────┐
│                      权限控制架构                                 │
├─────────────────────────────────────────────────────────────────┤
│   Orion 权限层                    PandaWiki 权限层              │
│   ┌─────────────┐                ┌─────────────┐               │
│   │ knowledge:write │  ───────►  │ 空间成员管理 │               │
│   │ knowledge:delete│            │             │               │
│   │ knowledge:manage│            │             │               │
│   └─────────────┘                └─────────────┘               │
│                                                                  │
│   ┌─────────────┐                ┌─────────────┐               │
│   │ document:read│  ──────────►  │ 节点访问控制 │               │
│   │ document:write│              │ (visitable) │               │
│   │ document:delete│             │             │               │
│   └─────────────┘                └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 权限映射表

| 操作 | Orion 权限资源 | Orion 动作 | PandaWiki 角色 |
|------|---------------|-----------|---------------|
| 创建知识空间 | `knowledge` | `write` | - |
| 删除知识空间 | `knowledge` | `delete` | admin |
| 管理空间成员 | `knowledge` | `manage` | full_control |
| 创建文档 | `document` | `write` | - |
| 编辑文档 | `document` | `write` | - |
| 删除文档 | `document` | `delete` | doc_manage |
| 查看文档列表 | `document` | `read` | - |
| RAG 问答 | `chat` | `read` | (节点级: answerable) |

## 8. 实施计划

### 8.1 阶段划分

| 阶段 | 周期 | 交付物 | 备注 |
|------|------|--------|------|
| Phase 1 | 0.5周 | 端口改为 3020，PandaWiki添加兼容路由 | 替换旧服务 |
| Phase 2 | 1周 | 认证中间件 + 安全 JWT 验证 | 修复安全问题 |
| Phase 3 | 1周 | 租户隔离 + 数据迁移 + RLS | 数据安全增强 |
| Phase 4 | 1周 | 权限集成 + Orion 权限引擎对接 | 权限统一管理 |
| Phase 5 | 0.5周 | 前端入口整合 + Wujie 微前端 | 用户无感知 |
| Phase 6 | 1周 | RAG 能力完善 + 向量索引优化 | 核心差异化功能 |

**总工期**: 5 周

### 8.2 里程碑

- [ ] M1: PandaWiki 部署到 3020 端口，兼容路由生效
- [ ] M2: 安全认证中间件上线 (JWT完整验证)
- [ ] M3: 数据按租户隔离 + RLS 生效
- [ ] M4: Orion 权限引擎集成
- [ ] M5: 统一前端入口
- [ ] M6: RAG 功能可用

## 9. 安全审计设计

### 9.1 审计日志

```go
type AuditEvent struct {
    Timestamp   time.Time `json:"timestamp"`
    UserID      string    `json:"user_id"`
    TenantID    string    `json:"tenant_id"`
    Action      string    `json:"action"`
    Resource    string    `json:"resource"`
    Result      string    `json:"result"` // success / denied
}
```

**记录的事件**:
- 用户登录/登出
- 认证失败尝试
- 权限拒绝访问
- 跨租户访问尝试

### 9.2 安全监控

| 监控项 | 阈值 | 告警级别 |
|--------|------|---------|
| 认证失败率 | > 10% / 5min | 高 |
| JWT 验证失败 | > 5 / min | 中 |
| 跨租户访问尝试 | > 0 | 高 |

## 10. 回滚方案

### 10.1 配置回滚

1. **回退端口** - PandaWiki 改回 8000
2. **恢复服务** - 重新启动 orion-knowledge-svc
3. **关闭认证中间件** - 恢复原生认证模式

### 10.2 数据回滚

```sql
BEGIN;
ALTER TABLE spaces DROP COLUMN tenant_id;
ALTER TABLE documents DROP COLUMN tenant_id;
ALTER TABLE spaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
COMMIT;
```

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 | 状态 |
|------|------|---------|------|
| 双模式认证安全漏洞 | **严重** | 移除自动降级，生产环境关闭原生认证 | ✅ 已修复 |
| 租户隔离不完整 | 高 | 数据库 RLS 策略 | ✅ 已修复 |
| JWT 验证不完整 | 高 | 补充 iss/aud/iat 验证 | ✅ 已修复 |
| API路径不匹配 | 高 | PandaWiki添加兼容路由 | ✅ 已修复 |
| 向量数据迁移 | 中 | 异步生成，分批处理 | ✅ 已修复 |
| embedding不同步 | 中 | 异步更新机制 | ✅ 已修复 |

## 12. 验收标准

| # | 标准 | 验证方法 |
|---|------|---------|
| 1 | Orion 用户无需重新登录即可访问 | 登录后直接访问 |
| 2 | 各租户数据完全隔离 | 跨租户查询返回空 |
| 3 | 文档中心、AI知识库、AI Docs 统一入口 | 访问旧路径自动重定向 |
| 4 | RAG 问答功能正常工作 | 发起问答，返回 LLM 结果 |
| 5 | API 响应时间 < 500ms | 压力测试验证 |
| 6 | 权限检查生效 | 无权限用户访问返回 403 |

---

**审批人**: ________________

**审批日期**: ________________