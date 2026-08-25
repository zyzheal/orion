# Skill 广场管理方案 — 资深AI专家深度评审报告

> **评审日期**: 2026-08-25
> **评审对象**: docs/skill-marketplace-design-2026-08-25.md
> **评审视角**: AI-native 平台架构 / Agent 生态 / 对标行业标杆

---

## 一、总体定性

### 结论：设计方向正确，但存在"传统软件市场"思维定式，缺少 AI-native 维度

| 维度 | 当前设计 | 行业标杆 | 差距 |
|------|---------|---------|------|
| AI 能力定位 | Skill=可下载代码包 | Skill=可调用的AI能力单元 | P0 |
| 发现与推荐 | 关键词搜索+分类浏览 | 语义搜索+UseCase匹配+协同过滤 | P0 |
| 能力编排 | 无（单Skill独立使用） | DAG编排+链式组合+条件路由 | P0 |
| 质量评测 | 安全扫描+人工审核 | AI准确率+延迟分位+成本/调用 | P1 |
| 多模型支持 | 未考虑 | 多LLM后端+版本锁定 | P1 |
| 开发者体验 | 表单提交+包上传 | CLI SDK+Local Dev+一键发布 | P1 |
| 成本治理 | 未考虑 | 单调用成本+预算上限+用量告警 | P1 |
| 可观测性 | 基础下载/安装统计 | 全链路Trace+错误率+P50/P99 | P1 |

---

## 二、AI-native 维度核心问题

### P0-1: Skill 定位偏差 — 缺少"AI 能力单元"的本质定义

当前: Skill=压缩包(skill.yaml+README+src/)
目标: Skill=AI能力单元(能力定义+执行引擎+评测基准+成本模型)

需新增 skill.yaml 字段:
- capability.tags / task_type / model_type / execution_mode
- evaluation.benchmark_dataset / baseline_accuracy / baseline_latency
- cost.estimated_tokens / estimated_llm_cost / budget_per_month

### P0-2: 缺少语义发现与智能推荐

| 能力 | 当前 | 需补充 |
|------|------|--------|
| 语义搜索 | 无 | 向量检索(Embedding+ANN) |
| UseCase推荐 | 无 | 意图分类->多维匹配->加权排序 |
| 协同过滤 | 无 | "类似用户还安装了" |
| 租户上下文 | 无 | 同租户团队使用率加权 |

### P0-3: 缺少 Skill 编排与组合

| 场景 | 编排逻辑 |
|------|---------|
| 代码审查自动修复 | code-review -> if issues -> auto-fix -> create-pr |
| 日志异常检测 | log-parser -> anomaly-detector -> alert |
| 批量文档处理 | extract -> translate -> format |

### P0-4: 状态机过度复杂(8状态)，缺少灰度

缺失: 灰度发布(Canary) / 版本锁定(Pin) / 自动回滚(Auto-rollback)
建议: 简化为6状态 draft->pending_review->ready->canary->published->archived

### P1-1: 安全扫描缺少AI特有维度

| 维度 | 检测方式 |
|------|---------|
| Prompt注入脆弱性 | 红队测试,绕过率<5% |
| 数据泄露风险 | 网络流量+外部API检测 |
| 输出毒性 | Toxicity Score扫描 |
| 幻觉率 | 标准QA集Accuracy基线 |
| 权限越权 | 声明vs实际行为比对 |
| 供应链投毒 | 依赖签名+SLSA等级 |

### P1-2: 缺少AI Skill质量评测体系

| 维度 | 指标 | 采集 |
|------|------|------|
| 准确性 | 测试集通过率 | 自动化评测 |
| 延迟 | P50/P95/P99 | 生产埋点 |
| 成本 | USD/次 | Token*单价 |
| 稳定性 | 错误率/重试率 | SLO |
| 新鲜度 | 更新距今天数 | 版本时间戳 |

### P1-3: 缺少多LLM后端支持

- 租户使用不同LLM后端: 不支持
- 模型版本锁定: 不支持
- 成本优化选模型: 不支持
- 不可用自动切换: 不支持

---

## 三、代码一致性问题(10项需修复)

| # | 级别 | 问题 | 代码事实 |
|---|------|------|---------|
| 1 | P0 | 状态机8状态vs后端4状态 | Skill.status: draft/submitted/approved/archived |
| 2 | P0 | 扫描工具部署方式未定义 | YARA/gitleaks需确认运行环境 |
| 3 | P0 | 预览沙箱重复建设 | internal/sandbox/已有完整实现 |
| 4 | P1 | 下载存储重复建设 | internal/storage/已有ObjectStorageProvider |
| 5 | P1 | 忽略plugin-marketplace可复用模型 | QualityScore/PluginStats/Verified已存在 |
| 6 | P1 | 前端目录冲突 | SkillManagement/已有完整导航 |
| 7 | P1 | API路径冲突 | 后端/skill/* vs 设计/marketplace/* |
| 8 | P2 | 权限命名不一致 | resource "skill" vs "skill-marketplace" |
| 9 | P2 | 存量数据迁移方案缺失 | 需approved->published迁移 |
| 10 | P2 | 与AI-Skill-Schema未对齐 | 需新增marketplace展示字段 |

---

## 四、最终结论

总体评级: 有条件通过

可立即投入开发(5项): 下载/预览/安全扫描基础/状态机增强/前端页面
需补充设计(5项): AI能力定位/语义搜索/编排/多LLM/成本治理

修复优先级:
  第1步: 完成10项一致性修复
  第2步: 补充AI-native维度设计
  第3步: 进入Phase1开发
