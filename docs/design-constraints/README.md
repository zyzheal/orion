# 设计约束体系

> 14 维约束体系，196 项检查项，自动识别 + 批量扫描

## 架构

- `framework/` — 通用框架核心（可复用于任何项目）
- `orion/` — Orion 特定配置

## 14 维体系

| 层级 | 维度 | 检查项 |
|------|------|--------|
| **A. 设计** | A1 数据结构 + A2 交互逻辑 + A3 流程细节 | 45 |
| **B. 开发** | B1 修复规范 + B2 优化规范 | 27 |
| **C. 运维** | C1-C8 兼容性/扩展性/生态/可观测/灾备/容量/部署/自动化 | 58 |
| **D. 体验** | D1-D5 可用性/可访问性/一致性/性能感知/情感化 | 35+ |
| **S. 安全** | S1-S5 身份认证/数据安全/基础设施/审计/第三方 | 25+ |
| **合计** | **14 维** | **196** |

## 快速开始

```bash
# 自动识别并检查当前模块
/skill design-constraint:check

# 全量扫描
/skill design-constraint:check --scan-mode full
```

## 目录结构

```
framework/
├── core/         # 核心引擎 (detector/checker/reporter)
├── profiles/     # 14 维检查项配置 (JSON)
└── skill/        # Skill 封装

orion/
├── profiles/     # Orion 模块配置
└── detector/     # Orion 识别规则
```
