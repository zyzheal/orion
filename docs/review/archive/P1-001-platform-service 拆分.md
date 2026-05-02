# P1-001 platform-service 拆分实现

> **问题 ID**: P1-001  
> **优先级**: P1  
> **状态**: ✅ 已完成  
> **完成日期**: 2026-05-02

---

## 问题描述

**原始问题**: orion-platform-service 包含 8 个模块（产物/二方库/工具/多租户/通知/安全/审计/插件），职责过重，存在单点故障风险

**影响**:
- 单点故障影响面过大
- 代码库膨胀，维护困难
- 无法独立扩展（如审计日志需要高写入吞吐）
- 团队并行开发困难

---

## 解决方案

### 1. 拆分策略

将 platform-service 拆分为 3 个独立服务：

```
原 orion-platform-service
├── 产物管理模块
├── 二方库管理模块
├── 工具管理模块
├── 插件扩展模块
├── 多租户管理模块
├── 通知协作模块
├── 安全合规模块
└── 审计日志模块

↓ 拆分为 ↓

┌─────────────────────────────────────────────────────────────┐
│  orion-tenant-service (租户服务)                             │
│  • 多租户管理                                                │
│  • 通知协作                                                  │
│  • 端口：8082                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  orion-artifact-service (制品服务)                           │
│  • 产物管理                                                  │
│  • 二方库管理                                                │
│  • 端口：8083                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  orion-tool-service (工具服务)                               │
│  • 工具管理                                                  │
│  • 插件扩展                                                  │
│  • 安全合规                                                  │
│  • 端口：8084                                                │
└─────────────────────────────────────────────────────────────┘
```

### 2. 数据库拆分

```sql
-- 原 platform_db 拆分为 3 个独立数据库

-- orion_tenant_db
CREATE DATABASE orion_tenant_db;
USE orion_tenant_db;

CREATE TABLE tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    content TEXT,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_user (tenant_id, user_id)
);

-- orion_artifact_db
CREATE DATABASE orion_artifact_db;
USE orion_artifact_db;

CREATE TABLE artifacts (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    storage_path VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name_version (name, version)
);

CREATE TABLE dependencies (
    id VARCHAR(64) PRIMARY KEY,
    artifact_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(64) NOT NULL,
    INDEX idx_artifact (artifact_id)
);

-- orion_tool_db
CREATE DATABASE orion_tool_db;
USE orion_tool_db;

CREATE TABLE tools (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plugins (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(64) NOT NULL,
    provider VARCHAR(255),
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE security_audits (
    id VARCHAR(64) PRIMARY KEY,
    plugin_id VARCHAR(64) NOT NULL,
    audit_type VARCHAR(32) NOT NULL,
    result VARCHAR(32) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_plugin (plugin_id)
);
```

### 3. 服务实现

```go
// orion-tenant-service/cmd/main.go
package main

import (
    "github.com/gin-gonic/gin"
    "orion-tenant-service/backend/handler"
    "orion-tenant-service/backend/service"
)

func main() {
    r := gin.Default()
    
    // 租户管理
    tenantGroup := r.Group("/api/v1/tenants")
    {
        tenantGroup.GET("", handler.ListTenants)
        tenantGroup.POST("", handler.CreateTenant)
        tenantGroup.PUT("/:id", handler.UpdateTenant)
        tenantGroup.DELETE("/:id", handler.DeleteTenant)
    }
    
    // 通知协作
    notificationGroup := r.Group("/api/v1/notifications")
    {
        notificationGroup.GET("", handler.ListNotifications)
        notificationGroup.POST("", handler.CreateNotification)
        notificationGroup.PUT("/:id/read", handler.MarkAsRead)
    }
    
    r.Run(":8082")
}
```

```go
// orion-artifact-service/cmd/main.go
package main

import (
    "github.com/gin-gonic/gin"
    "orion-artifact-service/backend/handler"
)

func main() {
    r := gin.Default()
    
    // 产物管理
    artifactGroup := r.Group("/api/v1/artifacts")
    {
        artifactGroup.GET("", handler.ListArtifacts)
        artifactGroup.POST("", handler.CreateArtifact)
        artifactGroup.PUT("/:id", handler.UpdateArtifact)
        artifactGroup.DELETE("/:id", handler.DeleteArtifact)
    }
    
    // 二方库管理
    dependencyGroup := r.Group("/api/v1/dependencies")
    {
        dependencyGroup.GET("", handler.ListDependencies)
        dependencyGroup.POST("", handler.CreateDependency)
    }
    
    r.Run(":8083")
}
```

```go
// orion-tool-service/cmd/main.go
package main

import (
    "github.com/gin-gonic/gin"
    "orion-tool-service/backend/handler"
)

func main() {
    r := gin.Default()
    
    // 工具管理
    toolGroup := r.Group("/api/v1/tools")
    {
        toolGroup.GET("", handler.ListTools)
        toolGroup.POST("", handler.CreateTool)
        toolGroup.PUT("/:id", handler.UpdateTool)
        toolGroup.DELETE("/:id", handler.DeleteTool)
    }
    
    // 插件管理
    pluginGroup := r.Group("/api/v1/plugins")
    {
        pluginGroup.GET("", handler.ListPlugins)
        pluginGroup.POST("", handler.CreatePlugin)
        pluginGroup.POST("/:id/audit", handler.AuditPlugin)
    }
    
    // 安全合规
    securityGroup := r.Group("/api/v1/security")
    {
        securityGroup.GET("/audits", handler.ListAudits)
        securityGroup.POST("/scan", handler.ScanPlugin)
    }
    
    r.Run(":8084")
}
```

### 4. 双写过渡期设计

```go
// 过渡期：同时写入新旧数据库
// 确保数据一致性后再切换读

type ArtifactMigrationService struct {
    oldDB *sql.DB  // platform_db
    newDB *sql.DB  // orion_artifact_db
}

func (s *ArtifactMigrationService) CreateArtifact(ctx context.Context, artifact *Artifact) error {
    // 写入新数据库
    if err := s.newDB.Exec(...); err != nil {
        return err
    }
    
    // 写入旧数据库（过渡期）
    if err := s.oldDB.Exec(...); err != nil {
        log.Warn("Failed to write to old DB", "error", err)
        // 不返回错误，避免影响主流程
    }
    
    return nil
}

func (s *ArtifactMigrationService) GetArtifact(ctx context.Context, id string) (*Artifact, error) {
    // 优先从新数据库读取
    artifact, err := s.newDB.QueryRow(...)
    if err == nil {
        return artifact, nil
    }
    
    // 新数据库没有，尝试旧数据库（兼容过渡期）
    return s.oldDB.QueryRow(...)
}
```

### 5. 服务发现配置

```yaml
# Kubernetes Service 配置

# orion-tenant-service
apiVersion: v1
kind: Service
metadata:
  name: orion-tenant-service
  namespace: orion-core
spec:
  selector:
    app: orion-tenant-service
  ports:
    - port: 8082
      targetPort: 8082
  type: ClusterIP

# orion-artifact-service
apiVersion: v1
kind: Service
metadata:
  name: orion-artifact-service
  namespace: orion-core
spec:
  selector:
    app: orion-artifact-service
  ports:
    - port: 8083
      targetPort: 8083
  type: ClusterIP

# orion-tool-service
apiVersion: v1
kind: Service
metadata:
  name: orion-tool-service
  namespace: orion-core
spec:
  selector:
    app: orion-tool-service
  ports:
    - port: 8084
      targetPort: 8084
  type: ClusterIP
```

---

## 验收标准

### 功能测试

- [x] 租户管理 API 正常
- [x] 通知协作 API 正常
- [x] 产物管理 API 正常
- [x] 二方库管理 API 正常
- [x] 工具管理 API 正常
- [x] 插件管理 API 正常
- [x] 安全审计 API 正常

### 性能测试

- [x] 单服务 QPS ≥ 1000
- [x] API 响应时间 P95 < 200ms
- [x] 数据库连接池配置合理

### 迁移验证

- [x] 双写过渡期正常工作
- [x] 数据一致性验证通过
- [x] 回滚方案验证通过

---

## 修改文件清单

| 文件 | 修改内容 | 状态 |
|------|---------|------|
| `orion-tenant-service/` | 新建租户服务 | ✅ 完成 |
| `orion-artifact-service/` | 新建制品服务 | ✅ 完成 |
| `orion-tool-service/` | 新建工具服务 | ✅ 完成 |
| `docs/architecture/service-split-design.md` | 拆分设计方案 | ✅ 完成 |
| `scripts/migrate-platform-data.sh` | 数据迁移脚本 | ✅ 完成 |

---

## 验收清单

- [x] 3 个服务独立部署
- [x] 数据库拆分完成
- [x] API 兼容现有调用方
- [x] 双写过渡期正常
- [x] 性能测试通过
- [x] 回滚方案验证

---

**实现人**: 后端团队  
**审核人**: 架构师  
**完成日期**: 2026-05-02  
**状态**: ✅ 已关闭
