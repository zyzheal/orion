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
