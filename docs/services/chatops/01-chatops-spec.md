# ChatOps 运维详细规格 (Phase 1)

> **日期**: 2026-07-02
> **状态**: 已验证
> **能力域**: 7. ChatOps
> **目标成熟度**: L2 → L3
> **关键交付**: 命令系统、IM 集成、速率限制、安全控制

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- ChatOps 命令解析框架（命令注册/匹配/执行流水线）
- 核心命令集（pipeline/deploy/approval/status 等 20+ 命令）
- IM 平台适配器框架（钉钉/企业微信/飞书）
- 命令执行引擎（CommandExecutor + CommandValidator）
- 命令历史记录（PostgreSQL 持久化）
- ChatOps 前端配置页面

**不足**：
- 速率限制未实现（无频率控制，可被高频命令攻击）
- Redis 未接入（命令历史/状态缓存无 Redis 支持）
- 命令执行超时控制缺失（长时间执行命令无超时终止）
- 平台配置加密仅 Base64（敏感信息（Token/Secret）未使用 AES-256）
- 命令 Mock 未真实化（部分命令返回 Mock 数据）
- 缺少命令权限体系（任何用户可执行任何命令）

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 速率限制 | 用户级/全局速率控制、突发处理 | L3 |
| Redis 集成 | 命令缓存、状态同步、会话管理 | L3 |
| 超时控制 | 命令执行超时终止、超时通知 | L3 |
| 安全加固 | 配置加密 AES-256、权限控制 | L3 |
| 命令真实化 | 替换 Mock 实现、OpenAPI 文档 | L3 |

## 二、验收标准

### 2.1 速率限制

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 每个用户每分钟最多执行 30 个命令 | 集成测试 |
| C2 | 全局每分钟最多执行 200 个命令 | 集成测试 |
| C3 | 超限时返回友好提示（"命令执行过于频繁，请 30 秒后重试"） | 集成测试 |
| C4 | 紧急命令（/incident）不受速率限制 | 单元测试 |

### 2.2 Redis 集成

| # | 标准 | 验证方式 |
|---|------|----------|
| R1 | 命令历史缓存到 Redis（最近 100 条/用户） | 集成测试 |
| R2 | IM 平台 Token 缓存到 Redis（自动刷新） | 集成测试 |
| R3 | 命令执行状态通过 Redis 实时同步 | 集成测试 |
| R4 | Redis 不可用时降级为内存缓存 | 集成测试 |

### 2.3 超时控制

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 每个命令有默认超时时间（30 秒） | 单元测试 |
| T2 | 超时后自动终止命令执行 | 集成测试 |
| T3 | 超时后向用户发送超时通知 | 集成测试 |
| T4 | 长耗时命令（>5 秒）异步执行并回调结果 | API 测试 |

### 2.4 安全加固

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 平台配置（Token/Secret/Webhook）使用 AES-256 加密存储 | 单元测试 |
| S2 | 命令按角色权限控制（只读/运维/管理员） | 集成测试 |
| S3 | 敏感命令（/deploy /exec /sql）需要二次确认 | 前端 + 集成测试 |
| S4 | 命令执行日志记录操作人/时间/参数 | 单元测试 |

## 三、API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/chatops/command` | 执行命令 |
| GET | `/api/v1/chatops/commands` | 获取命令列表 |
| GET | `/api/v1/chatops/history` | 命令执行历史 |
| GET | `/api/v1/chatops/config` | 获取 IM 平台配置 |
| PUT | `/api/v1/chatops/config` | 更新 IM 平台配置 |
| POST | `/api/v1/chatops/test` | 测试 IM 连接 |

## 四、数据模型

```sql
CREATE TABLE chatops_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL,  -- dingtalk, wecom, feishu
  config_name VARCHAR(100) NOT NULL,
  config_value_encrypted TEXT NOT NULL,  -- AES-256 加密
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chatops_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  command_count INTEGER DEFAULT 0,
  window_start TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

_文档版本: v1.0 | 创建日期: 2026-07-02 | 状态: 已验证_