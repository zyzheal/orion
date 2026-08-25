# Skill 广场管理能力设计 — 融合到 Orion AI Ops 生态

> **文档版本**: v1.0  
> **生成日期**: 2026-08-25  
> **负责人**: AI 团队 + 架构师团队  
> **状态**: 设计完成，待实施  
> **优先级**: P1（紧接当前 P0 修复后）

---

## 第一部分：现状诊断与差距分析

### 1.1 现有能力全景

当前 Orion 系统已具备 Skill 管理的基础骨架，但作为完整的"Skill 广场"运营管理能力仍有显著缺失：

| 能力 | 现有状态 | 代码位置 | 评级 |
|------|---------|---------|------|
| Skill 创建/编辑 | 存在（CRUD + 版本管理） | `skills.ts` createSkill/updateSkill | 基础可用 |
| Skill 安装/卸载 | 存在（install/uninstall） | `skills.ts` installSkill/uninstallSkill | 基础可用 |
| Skill 执行 | 存在（直接执行 + 实例管理） | `skills.ts` executeSkill | 可用 |
| 评分反馈 | 存在（rateSkill） | `skills.ts` rateSkill | 基础可用 |
| 审核流程 | 存在（submit/approve/reject/archive） | `skills.ts` submitSkillForReview等 | 基础可用 |
| 待审核队列 | 存在（PendingReviews.tsx） | `SkillManagement/PendingReviews.tsx` | 基础可用 |
| 提交发布 | 存在（SkillSubmission.tsx） | `SkillManagement/SkillSubmission.tsx` | 基础可用 |
| 实例管理 | 存在（SkillInstances.tsx） | `SkillManagement/SkillInstances.tsx` | 可用 |
| 执行历史 | 存在（SkillExecutions.tsx） | `SkillManagement/SkillExecutions.tsx` | 可用 |
| 审计日志 | 存在（AuditHistory.tsx + getAllAuditHistory） | `SkillManagement/AuditHistory.tsx` | 可用 |
| Marketplace 页面 | 存在（Marketplace.tsx） | `SkillManagement/Marketplace.tsx` | 基础可用 |
| **下载 Skill 包** | **缺失** | 无对应 API/页面 | **P0 缺失** |
| **预览 Skill** | **缺失** | 无对应 API/页面 | **P0 缺失** |
| **安全扫描** | **缺失** | 无对应 API/页面 | **P0 缺失** |
| **上架/下架操作台** | 缺失（approve 与上架混同） | 状态机不完整 | **P1 缺失** |
| **审核工作台** | 缺失（无审核人分配/批量审核/审核历史） | 无对应页面 | **P1 缺失** |
| **版本管理台** | 缺失（无版本列表/差异对比/回滚） | 仅 getSkillVersions | **P1 缺失** |
| **Skill 统计面板** | 缺失（无安装量/调用量/收入/活跃趋势） | 无对应页面 | **P2 缺失** |

### 1.2 当前状态机 vs 目标状态机

```
现有状态机（不完整）:
    draft ──[submit]──> submitted ──[approve]──> published
                                        └[reject]──> rejected
    published ──[archive]──> archived

目标状态机（完整广场生命周期）:
    ┌─────────────────────────────────────────────────────────────┐
    │                                                             │
    │  draft ──[提交]──> pending_review                          │
    │      │                    │                                 │
    │      │                    ├──[自动扫描通过]──>               │
    │      │                    │                                 │
    │      │                    │  ┌─[人工审核通过]─> approved     │
    │      │                    │  │                              │
    │      │                    │  └─[审核拒绝]──> rejected       │
    │      │                    │                    │            │
    │      │                    │                    └──[重新提交] │
    │      │                    │                                 │
    │      │                    │  approved ──[上架]──> published │
    │      │                    │       │            │            │
    │      │                    │       └─[强制下架]──┘            │
    │      │                    │       published ──[下架]──>      │
    │      │                    │              │        unpublish │
    │      │                    │              │                  │
    │      │                    │              └──[再次上架]──┐    │
    │      │                    │                             │    │
    │      └────────────────────┴─────────────────────────────┘    │
    │                                                             │
    │  published ──[安全违规/违规举报]──> disabled                 │
    │  published ──[归档]─────────────> archived                  │
    │  rejected ──[修复重提]─────────> draft                      │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

---

## 第二部分：完整管理能力矩阵

### 2.1 管理能力全景

| 模块 | 子能力 | 操作者 | 关键交互 | 优先级 |
|------|--------|--------|---------|--------|
| **发布管理** | 创建 Skill | 开发者 | 表单填写 + 包上传 + 预览 | P1 |
| **发布管理** | 版本管理 | 开发者 | 版本列表 + 差异对比 + 回滚 | P1 |
| **发布管理** | 提交审核 | 开发者 | 提交按钮 + 审核进度追踪 | P1 |
| **审核管理** | 自动安全扫描 | 系统自动 | 扫描结果 + 违规项列表 + 一键修复 | P0 |
| **审核管理** | 人工审核 | 审核员 | 批量审核 + 审核意见 + 审核历史 | P0 |
| **审核管理** | 审核工作台 | 审核员 | 待审队列 + 筛选 + 操作 | P0 |
| **广场管理** | 上架 | 运营 | 上架审批 + 上架时间 + 分类配置 | P0 |
| **广场管理** | 下架 | 运营 | 下架原因 + 下架后行为 | P0 |
| **广场管理** | 编辑广场信息 | 运营 | 封面/描述/推荐位 | P2 |
| **广场管理** | 推荐/精选 | 运营 | 热门推荐 + 精选标签 + 位置配置 | P2 |
| **使用管理** | 预览 | 用户 | 在线预览 Schema/文档/示例 | P0 |
| **使用管理** | 下载 | 用户 | 完整包下载 + 版本选择 | P0 |
| **使用管理** | 安装 | 用户 | 安装流程 + 依赖检查 + 配置向导 | P1 |
| **使用管理** | 使用反馈 | 用户 | 评分 + 评论 + 问题反馈 | P2 |
| **统计管理** | 广场统计 | 运营 | 下载量/安装量/活跃趋势 | P2 |
| **统计管理** | Skill 统计 | 开发者 | 个人 Skill 数据看板 | P2 |
| **安全管理** | 安全扫描 | 系统 | 恶意代码/敏感信息/依赖漏洞 | P0 |
| **安全管理** | 合规检查 | 系统 | 许可证合规 + 内容合规 | P1 |
| **安全管理** | 举报机制 | 用户 | 举报 + 处理流程 | P2 |

---

## 第三部分：后端服务设计

### 3.1 新增后端模块结构

```
orion-platform-svc-go/internal/skill-marketplace/
├── handler/
│   ├── marketplace_handler.go      # 广场展示/搜索/下载/预览
│   ├── review_handler.go           # 审核流程/审核工作台
│   ├── publish_handler.go          # 上架/下架/版本发布
│   ├── scan_handler.go             # 安全扫描触发/结果
│   └── stats_handler.go            # 统计分析
├── models/
│   ├── skill_marketplace.go        # 广场元数据
│   ├── skill_review.go             # 审核记录
│   ├── skill_scan.go               # 扫描记录
│   ├── skill_download.go           # 下载记录
│   └── skill_recommend.go          # 推荐配置
├── repository/
│   ├── marketplace_repo.go
│   ├── review_repo.go
│   ├── scan_repo.go
│   └── stats_repo.go
├── service/
│   ├── marketplace_service.go
│   ├── review_service.go
│   ├── publish_service.go
│   ├── scan_service.go
│   └── stats_service.go
└── router.go                       # 路由注册
```

### 3.2 数据库表设计

#### 3.2.1 广场核心表

```sql
-- Skill 广场元数据（扩展现有 skill 表）
CREATE TABLE skill_marketplace (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID NOT NULL REFERENCES skills(id),
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    -- status: draft / pending_review / approved / rejected / published / unpublish / disabled / archived
    
    -- 发布相关
    submitted_at    TIMESTAMP,
    submitted_by    UUID,
    approved_at     TIMESTAMP,
    approved_by     UUID,
    approved_reason TEXT,
    rejected_reason TEXT,
    published_at    TIMESTAMP,
    unpublished_at  TIMESTAMP,
    unpublish_reason TEXT,
    archived_at     TIMESTAMP,
    
    -- 广场展示
    marketplace_title   VARCHAR(256),
    marketplace_desc    TEXT,
    marketplace_cover   VARCHAR(512),
    category_path       VARCHAR(256),
    is_featured         BOOLEAN DEFAULT FALSE,
    feature_rank        INTEGER DEFAULT 0,
    download_count      INTEGER DEFAULT 0,
    install_count       INTEGER DEFAULT 0,
    usage_count         INTEGER DEFAULT 0,
    rating_avg          DECIMAL(3,2) DEFAULT 0.00,
    rating_count        INTEGER DEFAULT 0,
    
    -- 标签
    tags                TEXT[],
    
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_skill_marketplace_status ON skill_marketplace(status);
CREATE INDEX idx_skill_marketplace_category ON skill_marketplace(category_path);
CREATE INDEX idx_skill_marketplace_featured ON skill_marketplace(is_featured, feature_rank) WHERE is_featured;
CREATE INDEX idx_skill_marketplace_download ON skill_marketplace(download_count DESC);
CREATE INDEX idx_skill_marketplace_updated ON skill_marketplace(updated_at DESC);
```

#### 3.2.2 审核记录表

```sql
CREATE TABLE skill_review_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID NOT NULL,
    marketplace_id  UUID REFERENCES skill_marketplace(id),
    reviewer_id     UUID NOT NULL,
    reviewer_name   VARCHAR(128),
    action          VARCHAR(32) NOT NULL,
    -- action: auto_scan_pass / auto_scan_fail / manual_approve / manual_reject / resubmit
    old_status      VARCHAR(32),
    new_status      VARCHAR(32),
    reason          TEXT,
    details         JSONB DEFAULT '{}',
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_log_skill ON skill_review_log(skill_id);
CREATE INDEX idx_review_log_reviewer ON skill_review_log(reviewer_id);
CREATE INDEX idx_review_log_created ON skill_review_log(created_at DESC);
```

#### 3.2.3 安全扫描记录表

```sql
CREATE TABLE skill_scan_record (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID NOT NULL,
    version         VARCHAR(64) NOT NULL,
    scan_id         VARCHAR(128),
    scan_type       VARCHAR(32) NOT NULL DEFAULT 'full',
    -- scan_type: full / quick / security / compliance / malware
    
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    -- status: pending / running / passed / failed / error / skipped
    
    -- 扫描结果
    malware_detected    BOOLEAN DEFAULT FALSE,
    malware_details     JSONB DEFAULT '{}',
    sensitive_info_found BOOLEAN DEFAULT FALSE,
    sensitive_info_details JSONB DEFAULT '{}',
    vulnerable_deps     INTEGER DEFAULT 0,
    vulnerable_details  JSONB DEFAULT '{}',
    license_issues      INTEGER DEFAULT 0,
    license_details     JSONB DEFAULT '{}',
    code_quality_score  DECIMAL(5,2),
    
    overall_result      VARCHAR(32),
    -- overall_result: pass / fail / warning / error
    
    scan_report_url     VARCHAR(512),
    scan_duration_ms    INTEGER,
    created_at          TIMESTAMP DEFAULT NOW(),
    completed_at        TIMESTAMP
);

CREATE INDEX idx_scan_record_skill ON skill_scan_record(skill_id, version);
CREATE INDEX idx_scan_record_status ON skill_scan_record(status);
CREATE INDEX idx_scan_record_created ON skill_scan_record(created_at DESC);
```

#### 3.2.4 下载记录表

```sql
CREATE TABLE skill_download_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID NOT NULL,
    version         VARCHAR(64),
    user_id         UUID,
    tenant_id       UUID,
    download_url    VARCHAR(512),
    package_size    BIGINT,
    ip_address      INET,
    user_agent      VARCHAR(512),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_download_log_skill ON skill_download_log(skill_id);
CREATE INDEX idx_download_log_created ON skill_download_log(created_at DESC);
```

#### 3.2.5 推荐配置表

```sql
CREATE TABLE skill_recommendation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID NOT NULL,
    recommend_type  VARCHAR(32) NOT NULL,
    -- recommend_type: featured / trending / new / category_top / editor_choice
    
    rank            INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    valid_from      TIMESTAMP,
    valid_to        TIMESTAMP,
    created_by      UUID,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recommendation_active ON skill_recommendation(is_active, rank) WHERE is_active;
CREATE INDEX idx_recommendation_type ON skill_recommendation(recommend_type);
```

### 3.3 API 端点设计

#### 3.3.1 发布管理（Publisher API）

```
POST   /api/v1/marketplace/skills                  创建 Skill 提交
PUT    /api/v1/marketplace/skills/:id              更新 Skill
GET    /api/v1/marketplace/skills/me               获取我的 Skill 列表
POST   /api/v1/marketplace/skills/:id/submit       提交审核
POST   /api/v1/marketplace/skills/:id/versions     发布新版本
GET    /api/v1/marketplace/skills/:id/versions     获取版本列表
GET    /api/v1/marketplace/skills/:id/versions/:v  获取版本详情
POST   /api/v1/marketplace/skills/:id/versions/:v/diff  版本差异对比
GET    /api/v1/marketplace/skills/:id/changelog    获取变更日志
```

#### 3.3.2 审核管理（Reviewer API）

```
GET    /api/v1/marketplace/reviews/pending         待审核队列
POST   /api/v1/marketplace/reviews/pending/assign  分配审核人
GET    /api/v1/marketplace/reviews/mine            我的审核任务
GET    /api/v1/marketplace/reviews/:id             获取审核详情
POST   /api/v1/marketplace/reviews/:id/approve     审核通过
POST   /api/v1/marketplace/reviews/:id/reject      审核拒绝
POST   /api/v1/marketplace/reviews/:id/return      退回修改
GET    /api/v1/marketplace/reviews/history         审核历史
```

#### 3.3.3 广场管理（Operator API）

```
POST   /api/v1/marketplace/skills/:id/publish      上架
POST   /api/v1/marketplace/skills/:id/unpublish    下架
GET    /api/v1/marketplace/skills/published        已上架列表
POST   /api/v1/marketplace/skills/:id/feature      设置精选
DELETE /api/v1/marketplace/skills/:id/feature      取消精选
PUT    /api/v1/marketplace/skills/:id/display      编辑广场展示信息
GET    /api/v1/marketplace/categories              分类列表
POST   /api/v1/marketplace/categories              创建分类
```

#### 3.3.4 广场展示（Marketplace API）

```
GET    /api/v1/marketplace                         广场首页
GET    /api/v1/marketplace/search                  搜索 Skill
GET    /api/v1/marketplace/category/:slug          分类浏览
GET    /api/v1/marketplace/featured                热门推荐
GET    /api/v1/marketplace/trending                热门趋势
GET    /api/v1/marketplace/new                     最新发布
GET    /api/v1/marketplace/skill/:id               获取广场 Skill 详情
```

#### 3.3.5 预览与下载（Consumer API）

```
GET    /api/v1/marketplace/skills/:id/preview      预览 Skill 元数据/文档/示例
POST   /api/v1/marketplace/skills/:id/preview/run   沙箱试运行（有限参数）
GET    /api/v1/marketplace/skills/:id/download      获取下载令牌
GET    /api/v1/marketplace/skills/:id/download/:token  下载 Skill 包
POST   /api/v1/marketplace/skills/:id/rate          评分
POST   /api/v1/marketplace/skills/:id/comment       发表评论
GET    /api/v1/marketplace/skills/:id/comments      获取评论列表
```

#### 3.3.6 安全扫描（Security API）

```
POST   /api/v1/marketplace/skills/:id/scan          触发安全扫描
GET    /api/v1/marketplace/skills/:id/scan           获取扫描结果
GET    /api/v1/marketplace/skills/:id/scan/:scanId   获取扫描详情
GET    /api/v1/marketplace/skills/:id/scan/report    下载扫描报告
GET    /api/v1/marketplace/scan/stats                全局扫描统计
```

#### 3.3.7 统计 API

```
GET    /api/v1/marketplace/stats/overview            广场总览统计
GET    /api/v1/marketplace/stats/skill/:id           单个 Skill 统计
GET    /api/v1/marketplace/stats/downloads           下载量趋势
GET    /api/v1/marketplace/stats/installs            安装量趋势
GET    /api/v1/marketplace/stats/reviews             审核统计
GET    /api/v1/marketplace/stats/scans               扫描统计
```

### 3.4 权限模型

```
Marketplace 权限矩阵：
┌──────────────────┬────────┬────────┬──────────┬────────┬────────┐
│ 角色              │ 开发者  │ 审核员  │ 运营人员  │ 平台管理│ 普通用户│
├──────────────────┼────────┼────────┼──────────┼────────┼────────┤
│ 创建 Skill        │  ✓     │        │          │   ✓    │        │
│ 提交审核          │  ✓     │        │          │   ✓    │        │
│ 安全扫描          │  ✓     │  ✓     │    ✓     │   ✓    │        │
│ 人工审核          │        │  ✓     │          │   ✓    │        │
│ 上架/下架         │        │        │    ✓     │   ✓    │        │
│ 设置精选/推荐     │        │        │    ✓     │   ✓    │        │
│ 编辑广场信息      │        │        │    ✓     │   ✓    │        │
│ 预览 Skill        │  ✓     │  ✓     │    ✓     │   ✓    │   ✓    │
│ 下载 Skill        │  ✓     │  ✓     │    ✓     │   ✓    │   ✓    │
│ 安装 Skill        │  ✓     │  ✓     │    ✓     │   ✓    │   ✓    │
│ 评分/评论         │  ✓     │  ✓     │    ✓     │   ✓    │   ✓    │
│ 举报              │        │        │          │        │   ✓    │
│ 查看所有统计      │  ✓(己)  │  ✓(己) │    ✓     │   ✓    │        │
└──────────────────┴────────┴────────┴──────────┴────────┴────────┘

权限资源定义（RBAC/ABAC）：
  resource: "skill-marketplace"
  actions:
    - create       (开发者)
    - read         (所有)
    - submit       (开发者)
    - review       (审核员)
    - publish      (运营/管理)
    - unpublish    (运营/管理)
    - scan         (开发者/审核员)
    - download     (所有)
    - rate         (所有)
    - manage       (管理)
```

---

## 第四部分：安全扫描系统设计

### 4.1 扫描维度

```
┌─────────────────────────────────────────────────────────────────┐
│                    Skill 安全扫描维度                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 恶意代码检测 (Malware Detection)                             │
│     - 脚本注入检测                                               │
│     - 网络回连检测                                               │
│     - 加密勒索行为检测                                           │
│     - 已知恶意模式匹配（YARA 规则）                               │
│                                                                  │
│  2. 敏感信息泄露 (Sensitive Info Leakage)                        │
│     - API Key/Token 泄露                                         │
│     - 数据库密码/连接串泄露                                       │
│     - 私钥/证书泄露                                              │
│     - 个人信息/PII 泄露                                           │
│                                                                  │
│  3. 依赖漏洞扫描 (Dependency Vulnerability)                      │
│     - npm/pip/maven 依赖 CVE 匹配                                │
│     - 已知漏洞版本检测                                           │
│     - 过时依赖检测                                               │
│                                                                  │
│  4. 许可证合规 (License Compliance)                              │
│     - 开源许可证兼容性检查                                       │
│     - 商业许可证限制检查                                         │
│     - 禁止使用许可证检测                                         │
│                                                                  │
│  5. 代码质量 (Code Quality)                                      │
│     - 代码复杂度检测                                             │
│     - 安全编码规范检查                                           │
│     - 输入验证完整性检查                                         │
│                                                                  │
│  6. 资源滥用检测 (Resource Abuse)                                │
│     - 循环/递归深度检测                                          │
│     - 内存占用估算                                               │
│     - 文件 I/O 滥用检测                                          │
│     - 网络请求滥用检测                                           │
│                                                                  │
│  7. Prompt 注入检测 (Prompt Injection)                           │
│     - System Prompt 泄露                                         │
│     - Jailbreak 模式检测                                         │
│     - 越狱/绕过模式检测                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 扫描流水线

```
Skill 提交
    │
    ▼
┌─────────────────┐
│ Step 1: 包解析   │  解压 tar.gz / 解析 skill.yaml / 提取元数据
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 2: 静态扫描 │  恶意代码 + 敏感信息 + 依赖漏洞（并行）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 3: 合规检查 │  许可证 + 内容合规
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 4: 沙箱运行 │  受限环境下执行 Skill（超时/内存/CPU 限制）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 5: 结果聚合 │  汇总各维度结果 + 生成综合评分 + 违规项列表
└────────┬────────┘
         │
         ├─ 全部通过 ──> status = passed，进入人工审核队列
         │
         ├─ 有警告 ──> status = warning，进入人工审核队列（高优先级）
         │
         └─ 有违规 ──> status = failed，自动拒绝，通知开发者修复
```

### 4.3 扫描工具集成

| 扫描维度 | 集成工具 | 技术栈 |
|---------|---------|--------|
| 恶意代码 | YARA 规则引擎 + VirusTotal API | Go + YARA bindings |
| 敏感信息 | gitleaks / truffleHog | 子进程调用 |
| 依赖漏洞 | npm audit / pip-audit / OWASP Dependency-Check | 子进程调用 |
| 许可证 | FOSSA API / scancode-toolkit | API 集成 |
| 代码质量 | ESLint / SonarQube API | API 集成 |
| 沙箱运行 | gVisor / Firecracker 容器沙箱 | 容器运行时 |
| Prompt 注入 | 自定义规则引擎 + LLM 辅助检测 | Go + LLM |

---

## 第五部分：预览系统设计

### 5.1 预览能力矩阵

| 预览类型 | 能力描述 | 技术方案 |
|---------|---------|---------|
| **元数据预览** | Skill 名称/版本/作者/标签/描述 | 直接读取 skill.yaml |
| **文档预览** | README.md 在线渲染 | Markdown → HTML 渲染 |
| **Schema 预览** | 输入/输出 Schema 可视化 | JSON Schema → 可视化编辑器 |
| **示例预览** | 示例输入/输出展示 | 预置示例数据 |
| **沙箱试运行** | 使用有限参数在线执行 | 沙箱容器 + 超时控制 |
| **视频预览** | 使用演示视频 | 对象存储 + 视频播放器 |
| **截图预览** | UI 截图展示 | 对象存储 + 图片画廊 |

### 5.2 沙箱预览架构

```
前端预览请求
    │
    ▼
┌─────────────────┐
│  Preview API     │  POST /api/v1/marketplace/skills/:id/preview/run
│                  │  { "input": {}, "timeout": 30, "resourceLimit": {...} }
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Preview        │  创建一次性沙箱容器
│  Sandbox        │  - 独立 namespace
│  Manager        │  - CPU 限制: 500m
│                  │  - 内存限制: 256MB
│                  │  - 网络隔离: 仅允许指定域名
│                  │  - 超时: 30秒硬超时
│                  │  - 文件系统: 只读，tmp 目录可写
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  沙箱容器执行    │  运行 Skill + 限制资源 + 捕获输出
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  结果返回        │  结构化输出 + 执行日志 + 性能指标
│                  │  { "output": {}, "logs": "...", "metrics": {...} }
└────────┬────────┘
         │
         ▼
前端展示预览结果（含执行状态/耗时/输出）
```

---

## 第六部分：下载系统设计

### 6.1 下载流程

```
用户点击下载
    │
    ▼
┌─────────────────┐
│  生成下载令牌    │  POST /api/v1/marketplace/skills/:id/download
│                  │  返回：pre-signed URL（时效 10 分钟）
│                  │  { "token": "xxx", "expires_in": 600, "size": "2.3MB" }
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  记录下载日志    │  写入 skill_download_log 表
│                  │  更新 download_count
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CDN 下载        │  GET /api/v1/marketplace/skills/:id/download/:token
│                  │  从 MinIO/S3 获取 Skill 包
│                  │  支持：断点续传、Range 请求、CDN 缓存
└────────┬────────┘
         │
         ▼
用户获得 .skill 包文件
```

### 6.2 下载包格式规范

```
技能包结构 (.skill 格式，基于 tar.gz)：
┌─────────────────────────────────────────────────────────────────┐
│  my-skill.skill (tar.gz)                                         │
│  │                                                               │
│  ├── skill.yaml              # Skill 元数据（必填）               │
│  ├── README.md               # 说明文档（必填）                   │
│  ├── LICENSE                 # 许可证（必填）                     │
│  ├── CHANGELOG.md            # 变更日志（推荐）                   │
│  ├── screenshots/            # 截图目录（可选）                   │
│  │   ├── preview-1.png                                  │
│  │   └── preview-2.png                                  │
│  ├── demo/                     # 示例目录（可选）                   │
│  │   ├── input.json                                  │
│  │   └── output.json                                  │
│  ├── src/                      # Skill 实现源码（可选）            │
│  │   ├── index.js                                  │
│  │   └── ...                                         │
│  └── tests/                    # 测试目录（可选）                   │
│      └── ...                                         │
│                                                        │
│  包大小限制：单包 ≤ 50MB                                │
│  支持格式：tar.gz / zip                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 下载安全策略

| 策略项 | 规则 |
|--------|------|
| 权限校验 | 普通用户只能下载已上架（published）的 Skill |
| 预签名 URL | 每次下载生成唯一 URL，10 分钟过期 |
| 下载限速 | 单用户每分钟最多 10 次下载请求 |
| CDN 缓存 | 对已上架 Skill 的包启用 CDN 边缘缓存 |
| 下载计数 | 每次下载递增 download_count，用于统计和排序 |
| 版本选择 | 默认下载最新版本，支持指定版本下载 |
| 许可证检查 | 商业许可 Skill 需验证购买授权后才可下载 |

---

## 第七部分：前端页面设计

### 7.1 页面清单

```
orion-frontend/src/pages/SkillMarketplace/
├── index.tsx                    # Skill 广场根入口（Tab 切换）
├── Marketplace.tsx             # 广场首页（现有，增强版）
├── Category.tsx                # 分类浏览（新增）
├── SearchResults.tsx           # 搜索结果页（新增）
├── SkillDetail.tsx             # Skill 详情页（新增，替换现有 detail）
├── SkillPreview.tsx            # Skill 预览页（新增）
├── SkillInstall.tsx            # Skill 安装向导（新增）
├── Developer/
│   ├── MySkills.tsx           # 我的 Skill（现有，增强版）
│   ├── SkillSubmission.tsx    # 提交发布（现有，增强版）
│   ├── SkillCreate.tsx        # 创建 Skill（新增）
│   ├── SkillEdit.tsx          # 编辑 Skill（新增）
│   └── VersionManager.tsx     # 版本管理（新增）
├── Reviewer/
│   ├── ReviewWorkbench.tsx    # 审核工作台（新增，替代 PendingReviews）
│   ├── ReviewDetail.tsx       # 审核详情（新增）
│   ├── ReviewHistory.tsx      # 审核历史（新增）
│   └── MyReviews.tsx          # 我的审核任务（新增）
├── Operator/
│   ├── PublishWorkbench.tsx   # 上架工作台（新增）
│   ├── SkillEditor.tsx        # 广场信息编辑（新增）
│   ├── CategoryManager.tsx    # 分类管理（新增）
│   └── RecommendationManager.tsx  # 推荐位管理（新增）
├── Security/
│   ├── ScanResults.tsx        # 扫描结果（新增）
│   ├── ScanHistory.tsx        # 扫描历史（新增）
│   └── SecurityReport.tsx     # 安全报告（新增）
├── Stats/
│   ├── MarketplaceStats.tsx   # 广场统计（新增）
│   └── SkillStats.tsx         # Skill 统计（新增）
└── components/
    ├── SkillCard.tsx          # Skill 卡片组件
    ├── SkillRating.tsx        # 评分组件
    ├── SkillVersionSelector.tsx  # 版本选择器
    ├── PreviewPanel.tsx       # 预览面板
    ├── DownloadButton.tsx     # 下载按钮（含版本选择）
    └── MarketplaceFilters.tsx # 广场筛选器
```

### 7.2 关键页面交互设计

#### 7.2.1 广场首页（Marketplace.tsx 增强）

```
┌───────────────────────────────────────────────────────────────────┐
│  Skill 广场                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 搜索框 │ 分类筛选 ▼ │ 排序 ▼ │ 标签筛选 │                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ 精选标签  │  │ 精选标签  │  │ 精选标签  │  │ 精选标签  │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                    │
│  ─── 热门推荐 ───                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐     │
│  │ Skill 卡片  │ │ Skill 卡片  │ │ Skill 卡片  │ │ Skill 卡片  │     │
│  │            │ │            │ │            │ │            │     │
│  │ 名称/描述   │ │ 名称/描述   │ │ 名称/描述   │ │ 名称/描述   │     │
│  │ ⭐ 4.5     │ │ ⭐ 4.2     │ │ ⭐ 4.8     │ │ ⭐ 3.9     │     │
│  │ ↓ 1,234次  │ │ ↓ 856次    │ │ ↓ 2,103次  │ │ ↓ 432次    │     │
│  │ [预览][下载]│ │ [预览][下载]│ │ [预览][下载]│ │ [预览][下载]│     │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘     │
│                                                                    │
│  ─── 最新发布 ───                                                 │
│  ...                                                               │
└───────────────────────────────────────────────────────────────────┘
```

#### 7.2.2 Skill 详情页（SkillDetail.tsx）

```
┌───────────────────────────────────────────────────────────────────┐
│  │ 左侧：概览区        │ 右侧：操作区                          │
│  │                      │                                      │
│  │ Skill 名称 v1.2.3    │ ┌─────────────────────────────┐    │
│  │ 作者: AI 团队        │ │ 预览面板                      │    │
│  │ ⭐ 4.5 (32 评分)    │ │                                │    │
│  │ ↓ 1,234 安装        │ │ [元数据预览] [文档预览]       │    │
│  │                      │ │ [Schema预览] [沙箱试运行]     │    │
│  │ ── 描述 ──          │ │                                │    │
│  │ Lorem ipsum...      │ │ 预览输出结果区域                │    │
│  │                      │ │                                │    │
│  │ ── 标签 ──          │ │ [运行] [清空] [查看日志]      │    │
│  │ #code-review #AI    │ └─────────────────────────────┘    │
│  │                      │ ┌─────────────────────────────┐    │
│  │ ── 版本历史 ──      │ │ 安装/下载操作                  │    │
│  │ v1.2.3 (当前)       │ │ 版本选择: [v1.2.3 ▼]        │    │
│  │ v1.2.2 (2026-08-20) │ │ [安装到项目] [下载到本地]     │    │
│  │ v1.1.0 (2026-08-01) │ │ 依赖检查: ✅ 无冲突          │    │
│  │                      │ │ 需要权限: code.read, llm.call │    │
│  │ ── 变更日志 ──      │ │ [确认安装]                    │    │
│  │ v1.2.3: 修复 xxx    │ └─────────────────────────────┘    │
│  │ v1.2.2: 新增 xxx    │                                      │
│  │                      │ ┌─────────────────────────────┐    │
│  │ ── 评论 ──          │ │ 评论与反馈                    │    │
│  │ 用户A: 非常好用!    │ │ 评分: ⭐⭐⭐⭐⭐             │    │
│  │ 用户B: 有 bug...    │ │ [发表评论输入框]              │    │
│  │                      │ │ [提交]                      │    │
│  │ ── 安全扫描 ──      │ └─────────────────────────────┘    │
│  │ ✅ 最近扫描通过      │                                      │
│  │ 扫描时间: 2026-08-24 │ ┌─────────────────────────────┐    │
│  │ [查看完整报告]       │ │ 安全信息                      │    │
│  │                      │ │ 安全等级: 安全                │    │
│  │ ── 许可证 ──        │ │ 许可证: MIT                   │    │
│  │ MIT License          │ │ 最近扫描: 2026-08-24          │    │
│  └──────────────────────┘└─────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

#### 7.2.3 审核工作台（ReviewWorkbench.tsx）

```
┌───────────────────────────────────────────────────────────────────┐
│  审核工作台                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 状态筛选: [全部] [待审核] [审核中] [已通过] [已拒绝]       │ │
│  │ 分类筛选: [全部 ▼] │ 搜索: [_______] │ 批量操作: [审核通过 ▼] │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──┬──────────────┬────────┬────────┬──────────┬────────┬──────┐│
│  │□ │ Skill 名称   │ 版本   │ 作者   │ 提交时间  │ 扫描状态│ 操作 ││
│  ├──┼──────────────┼────────┼────────┼──────────┼────────┼──────┤│
│  │□ │ code-review  │ v1.2.3 │ AI团队 │ 08-25    │ ✅ 通过 │[审核]││
│  │□ │ log-analyzer │ v2.0.0 │ 运维组 │ 08-25    │ ⚠️ 警告 │[审核]││
│  │□ │ data-pipe    │ v1.0.0 │ 数据组 │ 08-24    │ ❌ 失败 │[拒绝]││
│  │□ │ sql-review   │ v1.1.0 │ DBA组  │ 08-24    │ ⏳ 扫描中│[查看]││
│  └──┴──────────────┴────────┴────────┴──────────┴────────┴──────┘│
│                                                                    │
│  共 4 条待审核 │ 页码: [1] [2] [3] >                             │
└───────────────────────────────────────────────────────────────────┘
```

#### 7.2.4 上架工作台（PublishWorkbench.tsx）

```
┌───────────────────────────────────────────────────────────────────┐
│  上架工作台                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 筛选: [全部] [已上架] [已下架] [已禁用] [已归档]           │ │
│  │ 搜索: [_______] │ 批量操作: [上架 ▼] [下架 ▼] [禁用 ▼]    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──┬──────────────┬────────┬────────┬──────────┬────────┬──────┐│
│  │□ │ Skill 名称   │ 版本   │ 状态   │ 上架时间  │ 下载量  │ 操作 ││
│  ├──┼──────────────┼────────┼────────┼──────────┼────────┼──────┤│
│  │□ │ code-review  │ v1.2.3 │ 已上架 │ 08-20    │ 1,234   │[下架]││
│  │□ │ test-gen     │ v2.1.0 │ 已上架 │ 08-15    │ 856     │[下架]││
│  │□ │ old-skill    │ v1.0.0 │ 已下架 │ -        │ 432     │[上架]││
│  │□ │ disabled     │ v1.3.0 │ 已禁用 │ -        │ 211     │[查看]││
│  └──┴──────────────┴────────┴────────┴──────────┴────────┴──────┘│
└───────────────────────────────────────────────────────────────────┘
```

---

## 第八部分：API 客户端设计（新增 skills-marketplace.ts）

```typescript
// orion-frontend/src/api/skills-marketplace.ts

import { api } from './client';

// ---- Types ----

export type SkillMarketplaceStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'unpublish'
  | 'disabled'
  | 'archived';

export interface SkillMarketplace {
  id: string;
  skillId: string;
  status: SkillMarketplaceStatus;
  submittedAt?: string;
  submittedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedReason?: string;
  rejectedReason?: string;
  publishedAt?: string;
  unpublishedAt?: string;
  unpublishReason?: string;
  marketplaceTitle?: string;
  marketplaceDesc?: string;
  marketplaceCover?: string;
  categoryPath?: string;
  isFeatured: boolean;
  featureRank: number;
  downloadCount: number;
  installCount: number;
  usageCount: number;
  ratingAvg: number;
  ratingCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScanRecord {
  id: string;
  skillId: string;
  version: string;
  scanType: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'skipped';
  malwareDetected: boolean;
  sensitiveInfoFound: boolean;
  vulnerableDeps: number;
  licenseIssues: number;
  codeQualityScore: number;
  overallResult: 'pass' | 'fail' | 'warning' | 'error';
  scanReportUrl?: string;
  scanDurationMs: number;
  createdAt: string;
  completedAt?: string;
}

// ---- 发布管理 ----

export async function getMyMarketplaceSkills(params?: {
  status?: SkillMarketplaceStatus;
  page?: number;
  limit?: number;
}) {
  const res = await api.get('/api/v1/marketplace/skills/me', { params });
  return res.data;
}

export async function submitSkillForMarketplace(skillId: string) {
  return api.post(`/api/v1/marketplace/skills/${skillId}/submit`);
}

export async function publishSkill(skillId: string, data?: { reason?: string }) {
  return api.post(`/api/v1/marketplace/skills/${skillId}/publish`, data);
}

export async function unpublishSkill(skillId: string, data: { reason: string }) {
  return api.post(`/api/v1/marketplace/skills/${skillId}/unpublish`, data);
}

export async function getSkillVersions(skillId: string) {
  return api.get(`/api/v1/marketplace/skills/${skillId}/versions`);
}

export async function getVersionDiff(skillId: string, version: string, baseVersion?: string) {
  return api.post(`/api/v1/marketplace/skills/${skillId}/versions/${version}/diff`, {
    baseVersion,
  });
}

// ---- 审核管理 ----

export async function getPendingReviews(params?: {
  page?: number;
  limit?: number;
  category?: string;
  scanStatus?: string;
}) {
  return api.get('/api/v1/marketplace/reviews/pending', { params });
}

export async function getMyReviewTasks(params?: { page?: number; limit?: number }) {
  return api.get('/api/v1/marketplace/reviews/mine', { params });
}

export async function getReviewDetail(reviewId: string) {
  return api.get(`/api/v1/marketplace/reviews/${reviewId}`);
}

export async function approveSkillReview(reviewId: string, data?: { reason?: string }) {
  return api.post(`/api/v1/marketplace/reviews/${reviewId}/approve`, data);
}

export async function rejectSkillReview(reviewId: string, data: { reason: string }) {
  return api.post(`/api/v1/marketplace/reviews/${reviewId}/reject`, data);
}

export async function returnSkillForRevision(reviewId: string, data: { reason: string }) {
  return api.post(`/api/v1/marketplace/reviews/${reviewId}/return`, data);
}

export async function getReviewHistory(params?: {
  page?: number;
  limit?: number;
  action?: string;
}) {
  return api.get('/api/v1/marketplace/reviews/history', { params });
}

// ---- 广场展示 ----

export async function getMarketplaceHome(params?: { page?: number; limit?: number }) {
  return api.get('/api/v1/marketplace', { params });
}

export async function searchSkills(params: {
  keyword: string;
  category?: string;
  tags?: string[];
  sortBy?: string;
  page?: number;
  limit?: number;
}) {
  return api.get('/api/v1/marketplace/search', { params });
}

export async function getCategorySkills(categorySlug: string, params?: {
  page?: number;
  limit?: number;
}) {
  return api.get(`/api/v1/marketplace/category/${categorySlug}`, { params });
}

export async function getFeaturedSkills() {
  return api.get('/api/v1/marketplace/featured');
}

export async function getTrendingSkills() {
  return api.get('/api/v1/marketplace/trending');
}

export async function getNewSkills() {
  return api.get('/api/v1/marketplace/new');
}

export async function getMarketplaceSkillDetail(skillId: string) {
  return api.get(`/api/v1/marketplace/skill/${skillId}`);
}

// ---- 预览与下载 ----

export async function getSkillPreview(skillId: string) {
  return api.get(`/api/v1/marketplace/skills/${skillId}/preview`);
}

export async function runSkillPreview(skillId: string, data: {
  input?: Record<string, unknown>;
  timeout?: number;
}) {
  return api.post(`/api/v1/marketplace/skills/${skillId}/preview/run`, data);
}

export async function generateDownloadToken(skillId: string, version?: string) {
  return api.post(`/api/v1/marketplace/skills/${skillId}/download`, { version });
}

export async function downloadSkillPackage(token: string) {
  return api.get(`/api/v1/marketplace/skills/download/${token}`, {
    responseType: 'blob',
  });
}

// ---- 安全扫描 ----

export async function triggerSkillScan(skillId: string, data?: { scanType?: string }) {
  return api.post(`/api/v1/marketplace/skills/${skillId}/scan`, data || { scanType: 'full' });
}

export async function getSkillScanResult(skillId: string) {
  return api.get(`/api/v1/marketplace/skills/${skillId}/scan`);
}

export async function getSkillScanDetail(skillId: string, scanId: string) {
  return api.get(`/api/v1/marketplace/skills/${skillId}/scan/${scanId}`);
}

export async function getSkillScanReport(skillId: string, scanId: string) {
  return api.get(`/api/v1/marketplace/skills/${skillId}/scan/${scanId}/report`);
}

export async function getScanStats() {
  return api.get('/api/v1/marketplace/scan/stats');
}

// ---- 统计 ----

export async function getMarketplaceOverview() {
  return api.get('/api/v1/marketplace/stats/overview');
}

export async function getSkillStats(skillId: string) {
  return api.get(`/api/v1/marketplace/stats/skill/${skillId}`);
}

export async function getDownloadTrend(params?: { startDate?: string; endDate?: string }) {
  return api.get('/api/v1/marketplace/stats/downloads', { params });
}

export async function getInstallTrend(params?: { startDate?: string; endDate?: string }) {
  return api.get('/api/v1/marketplace/stats/installs', { params });
}

// ---- 评论与评分 ----

export async function rateSkill(skillId: string, data: { score: number }) {
  return api.post(`/api/v1/marketplace/skills/${skillId}/rate`, data);
}

export async function addComment(skillId: string, data: { content: string }) {
  return api.post(`/api/v1/marketplace/skills/${skillId}/comment`, data);
}

export async function getComments(skillId: string, params?: { page?: number; limit?: number }) {
  return api.get(`/api/v1/marketplace/skills/${skillId}/comments`, { params });
}
```

---

## 第九部分：实施计划

### Phase 1（1-2 周）：P0 核心能力

| 任务 | 交付物 | 验收标准 |
|------|--------|---------|
| 安全扫描后端 | `scan_service.go` + `scan_handler.go` + 扫描流水线 | 支持 7 维度扫描，单次扫描 < 30s |
| 下载后端 | 预签名 URL 生成 + 下载日志 + CDN 集成 | 下载成功率 > 99%，单包 < 50MB |
| 预览后端 | 沙箱管理 + 预览 API + 资源限制 | 沙箱隔离有效，超时 30s 硬限制 |
| 下载前端 | `DownloadButton` + 下载流程 + 版本选择 | 预签名 URL 自动过期刷新 |
| 预览前端 | `PreviewPanel` + 沙箱试运行 + 结果展示 | 支持元数据/文档/Schema/沙箱 4 种预览 |

### Phase 2（2-3 周）：P1 审核与上架

| 任务 | 交付物 | 验收标准 |
|------|--------|---------|
| 状态机增强 | `skill_marketplace` 表 + 状态转换服务 | 8 种状态全覆盖，状态转换合法校验 |
| 审核工作台后端 | `review_handler.go` + 审核 API | 支持批量审核/分配/筛选 |
| 上架工作台后端 | `publish_handler.go` + 上架/下架 API | 上架/下架操作有审计日志 |
| 审核工作台前端 | `ReviewWorkbench` + `ReviewDetail` | 支持 8 种状态筛选 + 批量操作 |
| 上架工作台前端 | `PublishWorkbench` | 上架/下架操作确认 + 原因填写 |
| 版本管理 | `VersionManager` + 差异对比 API | 支持版本列表 + 差异 diff + 回滚 |

### Phase 3（3-4 周）：P2 统计与运营

| 任务 | 交付物 | 验收标准 |
|------|--------|---------|
| 统计后端 | `stats_handler.go` + 统计 SQL | 支持下载/安装/活跃趋势 |
| 推荐系统 | `skill_recommendation` 表 + 推荐 API | 支持精选/热门/新品 3 种推荐 |
| 广场统计前端 | `MarketplaceStats` + `SkillStats` | 图表展示趋势数据 |
| 评论与评分 | 评论 API + 前端集成 | 支持评分/评论/回复 |
| 举报机制 | 举报 API + 处理流程 | 举报 → 审核 → 处理闭环 |

---

## 第十部分：与现有生态集成点

### 10.1 与现有 Skill 管理集成

| 现有模块 | 集成方式 |
|---------|---------|
| `skills.ts` API | 保留现有 CRUD/execute/instance 接口，新增 marketplace 专用接口 |
| `SkillManagement` 页面 | 保留现有 MySkills/Instances/Executions，新增 Marketplace 专用页面 |
| `skill.yaml` Schema | 扩展现有 Schema，增加 marketplace 展示字段 |
| `AI-Skill-Schema-定义.md` | 补充 marketplace 专用字段定义 |

### 10.2 与 AI Ops 生态集成

| 集成点 | 方式 |
|--------|------|
| Agent 系统 | Skill 可作为 Agent 的 Tool/Skill 被调用 |
| AI Gateway | Skill 执行通过 AI Gateway 路由 LLM 调用 |
| 安全扫描 | 与 `prompt-security` 后端集成，复用注入检测规则 |
| 审计日志 | 与 `audit` 模块统一，Marketplace 操作写入审计 |

### 10.3 与权限系统集成

| 集成点 | 方式 |
|--------|------|
| RBAC/ABAC | 通过 `requiredPermission` 声明 Marketplace 资源权限 |
| 多租户 | `tenant_id` 贯穿所有 Marketplace 表，租户隔离 |
| 审核员角色 | 新增 `skill-marketplace-reviewer` 角色和权限 |

---

## 第十一部分：与原提示词优化版的关系

本文档是《review-prompt-optimization-2026-08-25.md》中 B 域（AI Ops）Skill 广场管理能力的**专项设计深化**，覆盖该提示词 v2 中以下能力项的完整实现方案：

- B2 Agent 能力体系中的 **Agent 注册中心**（Skill 上架即为注册）
- B2 Agent 能力体系中的 **Agent 评测体系**（安全扫描 + 审核 + 评分）
- B2 Agent 能力体系中的 **Agent 安全沙箱**（预览沙箱 + 安全扫描沙箱）
- B2 Agent 能力体系中的 **Agent 成本治理**（扫描报告 + 统计面板）

---

*本文档基于 Orion 平台 2026-08-25 快照生成，数据源：211 前端页面 / 178 API 客户端 / 303 后端服务*
