# Sprint 1 实施计划

> 版本：v1.0  
> 创建日期：2026-04-11  
> 项目：Orion - AI 研发效能平台  
> 周期：4/14-4/25 (10 个工作日)  
> 状态：📋 待启动

---

## 1. Sprint 目标

### 1.1 核心目标
- ✅ 完成基础设施部署 (K8s, PostgreSQL, Redis, NATS)
- ✅ 搭建后端基础框架 (API Gateway, SSO, JWT, RBAC)
- ✅ 搭建前端基座应用 (布局/路由/导航)
- ✅ 实现用户可登录系统

### 1.2 验收标准
| 标准 | 验证方式 | 负责人 |
|------|---------|--------|
| 用户可通过 SSO 登录 | E2E 测试 | 后端 + 前端 |
| JWT Token 正常签发/刷新 | API 测试 | 后端 |
| RBAC 权限拦截生效 | 集成测试 | 后端 |
| 前端路由守卫生效 | 手动测试 | 前端 |
| 平台首页展示待办/通知 | UI 验收 | 前端 |

---

## 2. 任务清单

### 2.1 任务看板

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Sprint 1 任务看板 (18 tasks, 70 人日)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  待办 (To Do) - 18 tasks                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ T001  K8s 集群资源申请          [SRE]   2 人日   P0  □           │   │
│  │ T002  PostgreSQL 集群部署       [DBA]   3 人日   P0  □           │   │
│  │ T003  Redis 集群部署            [DBA]   2 人日   P0  □           │   │
│  │ T004  NATS 集群部署             [SRE]   2 人日   P0  □           │   │
│  │ T005  项目脚手架创建            [后端]  3 人日   P0  □           │   │
│  │ T006  API Gateway 基础框架      [后端]  5 人日   P0  □           │   │
│  │ T007  SSO 集成 (OIDC)           [后端]  5 人日   P0  □           │   │
│  │ T008  JWT Token 管理            [后端]  3 人日   P0  □           │   │
│  │ T009  RBAC 权限模型             [后端]  5 人日   P0  □           │   │
│  │ T010  用户服务 CRUD             [后端]  3 人日   P0  □           │   │
│  │ T011  团队服务 CRUD             [后端]  3 人日   P0  □           │   │
│  │ T012  租户隔离实现              [后端]  5 人日   P0  □           │   │
│  │ T013  审计日志记录              [后端]  3 人日   P0  □           │   │
│  │ T014  前端基座应用              [前端]  5 人日   P0  □           │   │
│  │ T015  Arco Design 集成          [前端]  2 人日   P0  □           │   │
│  │ T016  登录页面                  [前端]  3 人日   P0  □           │   │
│  │ T017  权限路由守卫              [前端]  3 人日   P0  □           │   │
│  │ T018  平台首页框架              [前端]  3 人日   P0  □           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  进行中 (In Progress) - 0 tasks                                         │
│  已完成 (Done) - 0 tasks                                                │
│  已阻塞 (Blocked) - 0 tasks                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 任务依赖关系

```
Sprint 1 任务依赖图

基础设施组 (SRE/DBA)
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  T001 (K8s 申请)                                                 │
│     │                                                            │
│     ├─────► T002 (PostgreSQL) ─────┐                            │
│     │                              │                            │
│     ├─────► T003 (Redis) ──────────┼────► 后端服务              │
│     │                              │                            │
│     └─────► T004 (NATS) ───────────┘                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

后端组
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  T005 (脚手架)                                                   │
│     │                                                            │
│     ▼                                                            │
│  T006 (API Gateway)                                              │
│     │                                                            │
│     ├─────► T007 (SSO) ──► T008 (JWT) ──► T010 (用户服务)       │
│     │                                      │                     │
│     │                                      ▼                     │
│     │                                    T011 (团队服务)         │
│     │                                                            │
│     ├─────► T009 (RBAC) ──► T012 (租户隔离)                     │
│     │                                                            │
│     └─────► T013 (审计日志)                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

前端组
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  T014 (前端基座)                                                 │
│     │                                                            │
│     ├─────► T015 (Arco Design) ──► T016 (登录页)                │
│     │                               │                            │
│     │                               ▼                            │
│     │                             T017 (路由守卫)                │
│     │                                                            │
│     └───────────────────────────► T018 (首页框架)                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 每日站会计划

| 日期 | 星期 | 重点内容 | 负责人 |
|------|------|---------|--------|
| 4/14 | 一 | Sprint 计划会，任务认领 | Scrum Master |
| 4/15 | 二 | K8s 集群确认，脚手架搭建 | SRE + 后端 |
| 4/16 | 三 | 数据库部署完成，API Gateway 框架 | DBA + 后端 |
| 4/17 | 四 | SSO 集成联调，前端基座 | 后端 + 前端 |
| 4/18 | 五 | JWT+RBAC完成，登录页开发 | 后端 + 前端 |
| 4/21 | 一 | 用户/团队服务完成，路由守卫 | 后端 + 前端 |
| 4/22 | 二 | 租户隔离实现，首页框架 | 后端 + 前端 |
| 4/23 | 三 | 审计日志完成，前后端联调 | 后端 + 前端 |
| 4/24 | 四 | 集成测试，Bug 修复 | 测试 + 全体 |
| 4/25 | 五 | Sprint 评审，Demo 展示 | 全体 |

---

## 4. 技术实现细节

### 4.1 K8s 集群申请 (T001)

```yaml
# k8s/cluster-request.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: orion
  labels:
    app: orion-platform
    environment: development

---
# 资源配额
apiVersion: v1
kind: ResourceQuota
metadata:
  name: orion-quota
  namespace: orion
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    pods: "50"
    services: "20"
```

### 4.2 PostgreSQL 部署 (T002)

```yaml
# k8s/postgresql-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgresql
  namespace: orion
spec:
  serviceName: postgresql
  replicas: 3  # 1 主 2 从
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      containers:
      - name: postgresql
        image: postgres:15.4
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: orion_platform
        - name: POSTGRES_USER
          value: orion_admin
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgresql-secret
              key: password
        volumeClaimTemplates:
        - metadata:
            name: data
          spec:
            accessModes: ["ReadWriteOnce"]
            resources:
              requests:
                storage: 100Gi
```

### 4.3 API Gateway 基础框架 (T006)

```go
// cmd/gateway/main.go
package main

import (
    "github.com/gin-gonic/gin"
    "orion-design/internal/gateway/middleware"
    "orion-design/internal/gateway/routes"
)

func main() {
    r := gin.New()
    
    // 全局中间件
    r.Use(gin.Logger())
    r.Use(gin.Recovery())
    r.Use(middleware.CORS())
    r.Use(middleware.RateLimit())
    
    // 健康检查
    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })
    
    // API 路由组
    api := r.Group("/api/v1")
    {
        // 公开路由
        public := api.Group("")
        {
            routes.SetupAuthRoutes(public)    // /auth/login, /auth/logout
            routes.SetupHealthRoutes(public)  // /health, /ready
        }
        
        // 需要认证的路由
        authenticated := api.Group("")
        authenticated.Use(middleware.JWTAuth())
        {
            routes.SetupUserRoutes(authenticated)
            routes.SetupTeamRoutes(authenticated)
            routes.SetupPipelineRoutes(authenticated)
        }
        
        // 需要 RBAC 权限的路由
        rbac := api.Group("")
        rbac.Use(middleware.JWTAuth(), middleware.RBAC())
        {
            routes.SetupAdminRoutes(rbac)
            routes.SetupAuditRoutes(rbac)
        }
    }
    
    r.Run(":8080")
}
```

### 4.4 JWT Token 管理 (T008)

```go
// internal/auth/jwt.go
package auth

import (
    "time"
    "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
    UserID   uint64 `json:"uid"`
    Username string `json:"uname"`
    TenantID uint64 `json:"tid"`
    Roles    []string `json:"roles"`
    jwt.RegisteredClaims
}

var jwtKey = []byte(os.Getenv("JWT_SECRET"))

func GenerateToken(userID uint64, username string, tenantID uint64, roles []string) (string, error) {
    claims := &Claims{
        UserID:   userID,
        Username: username,
        TenantID: tenantID,
        Roles:    roles,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            Issuer:    "orion-platform",
        },
    }
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(jwtKey)
}

func ParseToken(tokenString string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        return jwtKey, nil
    })
    
    if err != nil {
        return nil, err
    }
    
    claims, ok := token.Claims.(*Claims)
    if !ok || !token.Valid {
        return nil, fmt.Errorf("invalid token")
    }
    
    return claims, nil
}
```

### 4.5 RBAC 权限模型 (T009)

```go
// internal/rbac/model.go
package rbac

import "gorm.io/gorm"

// Role 角色
type Role struct {
    ID          uint64 `gorm:"primarykey"`
    Name        string `gorm:"uniqueIndex;size:50"`  // admin, developer, viewer
    DisplayName string `gorm:"size:100"`
    Permissions []Permission `gorm:"many2many:role_permissions;"`
}

// Permission 权限
type Permission struct {
    ID         uint64 `gorm:"primarykey"`
    Resource   string `gorm:"size:50;uniqueIndex:idx_resource_action"`  // user, team, pipeline
    Action     string `gorm:"size:20;uniqueIndex:idx_resource_action"`  // create, read, update, delete
    Department string `gorm:"size:50"`  // * 表示所有部门
}

// UserRole 用户角色关联
type UserRole struct {
    UserID uint64 `gorm:"primarykey"`
    RoleID uint64 `gorm:"primarykey"`
}

// 内置角色
var BuiltInRoles = map[string][]Permission{
    "admin": {
        {Resource: "*", Action: "*"},
    },
    "developer": {
        {Resource: "pipeline", Action: "create"},
        {Resource: "pipeline", Action: "read"},
        {Resource: "pipeline", Action: "update"},
        {Resource: "ai-review", Action: "read"},
    },
    "viewer": {
        {Resource: "pipeline", Action: "read"},
        {Resource: "dashboard", Action: "read"},
    },
}
```

### 4.6 前端基座应用 (T014)

```vue
<!-- src/App.vue -->
<template>
  <a-config-provider :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { zhCN } from '@arco-design/web-vue/es/locale/lang/zh-cn';
</script>
```

```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      redirect: '/home',
    },
    {
      path: '/home',
      name: 'Home',
      component: () => import('@/views/Home.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pipelines',
      name: 'Pipelines',
      component: () => import('@/views/pipelines/List.vue'),
      meta: { requiresAuth: true, requiresRole: ['admin', 'developer'] },
    },
  ],
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
    return;
  }
  
  if (to.meta.requiresRole && !authStore.hasRoles(to.meta.requiresRole as string[])) {
    next({ name: '403' });
    return;
  }
  
  next();
});

export default router;
```

### 4.7 登录页面 (T016)

```vue
<!-- src/views/Login.vue -->
<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">Orion 平台</h1>
      <p class="login-subtitle">AI 研发效能平台</p>
      
      <a-form :model="form" layout="vertical" @submit="handleLogin">
        <a-alert v-if="error" type="error" :content="errorMessage" />
        
        <a-form-item label="SSO 登录">
          <a-button type="primary" size="large" long @click="handleSSOLogin">
            <template #icon>
              <icon-user />
            </template>
            使用公司账号登录
          </a-button>
        </a-form-item>
      </a-form>
      
      <div class="login-footer">
        <p>登录即表示您同意 Orion 平台的服务条款</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({});
const error = ref(false);
const errorMessage = ref('');

const handleSSOLogin = async () => {
  try {
    // 重定向到 SSO 提供商
    const ssoUrl = `${import.meta.env.VITE_SSO_BASE_URL}/authorize?client_id=orion&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/callback')}&response_type=code`;
    window.location.href = ssoUrl;
  } catch (e) {
    error.value = true;
    errorMessage.value = 'SSO 登录失败，请稍后重试';
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  background: white;
  padding: 48px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 420px;
}

.login-title {
  text-align: center;
  font-size: 32px;
  color: #1d2129;
  margin-bottom: 8px;
}

.login-subtitle {
  text-align: center;
  color: #86909c;
  margin-bottom: 32px;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
  color: #86909c;
  font-size: 12px;
}
</style>
```

---

## 5. 验收测试清单

### 5.1 基础设施验收

| 测试项 | 验证命令 | 预期结果 |
|--------|---------|---------|
| K8s 集群就绪 | `kubectl get nodes` | 3 节点 Ready |
| PostgreSQL 就绪 | `kubectl get pods -l app=postgresql` | 3/3 Running |
| Redis 就绪 | `kubectl get pods -l app=redis` | 3/3 Running |
| NATS 就绪 | `kubectl get pods -l app=nats` | 3/3 Running |

### 5.2 后端 API 验收

| 测试项 | 请求 | 预期响应 |
|--------|------|---------|
| 健康检查 | `GET /health` | `{"status": "ok"}` |
| SSO 登录 | `POST /auth/sso` | 302 重定向到 SSO |
| JWT 刷新 | `POST /auth/refresh` | 新 token |
| 用户信息 | `GET /api/v1/users/me` | 用户信息 JSON |
| 权限拦截 | `GET /api/v1/admin/*` (无权限) | 403 Forbidden |

### 5.3 前端验收

| 测试项 | 操作步骤 | 预期结果 |
|--------|---------|---------|
| SSO 登录 | 点击登录按钮 | 跳转到 SSO 页面 |
| 路由守卫 | 直接访问 `/pipelines` (未登录) | 重定向到登录页 |
| 权限控制 | 访问无权限页面 | 显示 403 页面 |
| 首页加载 | 登录后访问首页 | 显示待办/通知 |

---

## 6. 风险管理

| 风险 | 概率 | 影响 | 缓解措施 | 负责人 |
|------|------|------|---------|--------|
| SSO 集成延期 | 高 | 高 | 提前对接 SSO 团队，准备 Mock 方案 | 后端负责人 |
| K8s 资源不足 | 中 | 高 | 提前申请资源配额 | SRE |
| 前端组件库兼容性问题 | 中 | 中 | 预留 1 天技术验证时间 | 前端负责人 |
| 核心开发人员请假 | 低 | 高 | AB 角备份 | 技术负责人 |

---

## 7. 交付物清单

| 交付物 | 位置 | 状态 |
|--------|------|------|
| K8s 集群 | `kubectl get namespaces orion` | □ |
| PostgreSQL 集群 | `postgresql.orion.svc:5432` | □ |
| Redis 集群 | `redis.orion.svc:6379` | □ |
| NATS 集群 | `nats.orion.svc:4222` | □ |
| 后端代码仓库 | `git@github.com:orion-design/orion-backend.git` | □ |
| 前端代码仓库 | `git@github.com:orion-design/orion-frontend.git` | □ |
| API 文档 | `https://orion-design.github.io/api/` | □ |
| 部署文档 | `docs/deployment/sprint1.md` | □ |

---

## 8. Sprint 回顾模板

```markdown
## Sprint 1 回顾 (4/25)

### 做得好的
1. ...
2. ...

### 需要改进的
1. ...
2. ...

### 行动计划
| 行动项 | 负责人 | 截止日期 |
|--------|--------|---------|
| ... | ... | ... |

### Sprint 数据
- 计划任务：18 个
- 完成的任务：__ 个
- 延期任务：__ 个
- Bug 数量：__ 个
- 团队满意度：__/10
```

---

_文档版本：v1.0 | 创建日期：2026-04-11 | 下次更新：每日站会后_
