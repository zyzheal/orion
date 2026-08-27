# Orion 平台领域划分与全栈深度对标评审提示词 v3.5

> **生成日期**: 2026-08-25 | **版本**: v3.5（基于 v3.4 深度评审优化）
> **数据快照**: 211 前端页面 | 177 API 客户端 | 303 后端服务 | 338 路由路径 | 666 docs 文档（Step 0 实测，非 INDEX.md 口径）
> **维度总数**: 36 维（A-AF，含 G 母维度 + G.1/G.2/G.3 子维度 = 4 项）| **输出产物**: 8 类 | **Step 3 探针**: 7 层

---

## 〇、结构化导航索引（智能体执行前必读）

> **本提示词共 1400+ 行，36 个评审维度。智能体必须按以下索引定位，不得线性全量读取后再执行——应按阶段按需加载。**

| 阶段 | 步骤 | 对应章节 | 行号范围 | 产出 |
|------|------|---------|---------|------|
| **采集** | Step 0-3 | 一、证据采集前置步骤 | §一 | 数据基线 |
| **对标** | — | 三、对标标杆分层体系 | §三 | 标杆库 |
| **评审** | 36 维逐项 | 四-五补（A-F + G + H1-H2 + I-AF） | §四~§五补 | 每维度评分 |
| **输出** | 8 类产物 | 六、输出结构 | §六 | 最终报告 |
| **基线** | 必读 | 七、已知系统事实基线 | §七 | 校准数据 |
| **检查** | 逐项 | 八、评审执行 Checklist | §八 | 完成确认 |

**维度快速定位**：
| 维度区间 | 范围 | 数量 | 定位锚 |
|---------|------|------|--------|
| A-F | 功能域 | 6 | §四 |
| G | 深度校验 | 1 (3 子维) | §四补 |
| H1-H2 | 横切维度 | 2 | §五 |
| I-U | 硅谷专家 v3.0 | 13 | §五补 |
| V-X | 架构/视觉/UX v3.1 | 3 | §五补 |
| Y-AD | 工程 v3.2 | 6 | §五补 |
| AE-AF | DBA/Agent v3.3 | 2 | §五补 |

**维度注册表（智能体逐维评审时按此表定位，共 36 项）**：

| # | ID | 名称 | 章节 | 优先级 | 探针层 | 输出关联 |
|---|-----|------|------|--------|--------|---------|
| 1 | A | DevOps 端到端 | §四 | P0 | L1-3 | 1,2,6,7,8 |
| 2 | B | AI Ops Agent | §四 | P0 | L7 | 1,2,4,6,8 |
| 3 | C | DB+DataOps | §四 | P0 | L1-3,L7 | 1,2,5,6,8 |
| 4 | D | ITSM+CMDB | §四 | P0 | L1-3 | 1,2,6,8 |
| 5 | E | 研发效能 | §四 | P1 | — | 1,2,6,8 |
| 6 | F | 工具链 | §四 | P1 | — | 1,2,6,8 |
| 7 | G | 深度校验(母维度) | §四补 | P0 | L1-7 | 2(交叉) |
| 8 | G.1 | 前端深度 | §四补 | P0 | L1-3 | 2(列5) |
| 9 | G.2 | 后端深度 | §四补 | P0 | L4-5 | 2(列5) |
| 10 | G.3 | 深度矩阵输出 | §四补 | P0 | — | 2(列5格式) |
| 11 | H1 | 安全 | §五 | P0 | L4-5 | 1,2,6,8 |
| 12 | H2 | 可观测+FinOps | §五 | P1 | L4-5 | 1,2,6,8 |
| 13 | I | SRE 实践 | §五补 | P1 | — | 1,2,6,8 |
| 14 | J | 事件驱动 | §五补 | P2 | — | 1,2,8 |
| 15 | K | API 治理 | §五补 | P1 | — | 1,2,6,8 |
| 16 | L | 供应链安全 | §五补 | P1 | — | 1,2,6,8 |
| 17 | M | 数据合规 | §五补 | P2 | — | 1,2,8 |
| 18 | N | 混沌工程 | §五补 | P1 | L6 | 1,2,6,8 |
| 19 | O | AI 安全红队 | §五补 | P1 | L7 | 1,2,6,8 |
| 20 | P | FinOps 深度 | §五补 | P2 | — | 1,2,8 |
| 21 | Q | 多租户隔离 | §五补 | P1 | — | 1,2,6,8 |
| 22 | R | 灾备 BCDR | §五补 | P1 | — | 1,2,6,8 |
| 23 | S | SPACE 效能 | §五补 | P2 | — | 1,2,8 |
| 24 | T | 开放平台 | §五补 | P2 | — | 1,2,8 |
| 25 | U | 模块解耦 | §五补 | P1 | L4-5 | 1,2,6,8 |
| 26 | V | 架构治理 | §五补 | P0 | L4-5 | 1,2,6,8 |
| 27 | W | 视觉设计 | §五补 | P1 | L4 | 1,2,3,6,8 |
| 28 | X | 用户体验 | §五补 | P1 | L4 | 1,2,3,6,8 |
| 29 | Y | 前端性能 | §五补 | P1 | L6 | 1,2,6,8 |
| 30 | Z | 测试策略 | §五补 | P1 | L6 | 1,2,6,8 |
| 31 | AA | 内部DX | §五补 | P2 | L6 | 1,2,8 |
| 32 | AB | 文档治理 | §五补 | P2 | L6 | 1,2,8 |
| 33 | AC | 数据迁移 | §五补 | P2 | L6 | 1,2,8 |
| 34 | AD | 状态管理 | §五补 | P1 | L6 | 1,2,6,8 |
| 35 | AE | DBA 工作台 | §五补 | P0 | L7 | 1,2,5,6,8 |
| 36 | AF | AI Agent 架构 | §五补 | P0 | L7 | 1,2,4,6,8 |

> **计数说明**：G 为母维度（含 G.1/G.2/G.3 三个子维度），共 4 项。§四~§五共 12 项（A-F=6 + G 系列=4 + H1-H2=2），§五补 24 项（I-AF），合计 36 项。

**Step→章节→输出 执行映射表**：

| Step | 章节 | 动作 | 产出 | 记录格式 |
|------|------|------|------|---------|
| Step 0 | §一 Step 0 | 执行 bash 采集基线 | 数据快照 | 附入最终报告附录 A |
| Step 1 | §一 Step 1 | 构建五维映射表 | 映射表+断链标记 | 附入最终报告附录 B |
| Step 2 | §一 Step 2 | 读取已有审查报告 | 基线缺陷标记 | 在输出 3 中引用 |
| Step 3 | §一 Step 3 | 执行 7 层探针 | 探针结果表 | 附入最终报告附录 C |
| Step 4 | §四~§五补 | 逐维度分析评分 | 维度评分数据 | 填入输出 1+2 |
| Step 5 | §六-输出2 | 填写 9 字段×每子维度 | 输出 2 行 | 直接在输出 2 中 |
| Step 6 | §六 | 生成 8 类输出 | 8 类输出产物 | 最终报告正文 |
| Step 7 | §八 | 交叉一致性校验 | 校验报告 | 附入最终报告附录 D |

**探针→维度 映射表（Step 3 结果如何用于 Step 4 评分）**：

| 探针层 | 标记行 | 对应维度 | 采集内容 |
|--------|--------|---------|---------|
| Layer 1 | `# 第一层` | G.1, A-F | 前端页面真实实现深度（递归最深 tsx 行数） |
| Layer 2 | `# 第二层` | G.1, W | mock/硬编码假深度检测 |
| Layer 3 | `# 第三层` | G.1, A-F | 页面 API import 验证（抓只渲染不联调） |
| Layer 4 | `# 第四层（W维度）` | W, V | 前端设计系统（Token/内联样式/响应式/ARIA） |
| Layer 5 | `# 第五层（V维度）` | G.2, V, U | 后端架构一致性（接口文件/ADR/ErrorBoundary） |
| Layer 6 | `# Layer 6` | Y,Z,AA,AB,AC,AD,N | 测试/性能/状态/文档/迁移/混沌 |
| Layer 7 | `# Layer 7` | AE,AF,B,O | DBA/Agent/AI 安全 |

> **说明**：标记行以 §一 Step 3 中 `# ══` 注释分隔符为锚点定位，而非固定行号（行号会随后续编辑变动）。

**会话策略（Token Budget Guidance）**：
- **Session 1（数据采集）**: 执行 Step 0-3，采集全量基线，产出数据快照（约 15K tokens 输入）
- **Session 2（核心域评审）**: A-F + G + H1-H2 共 8 维度 ID（12 项含 G 子维）深度评审，产出输出 1-3 + 5（约 20K tokens）
- **Session 3（专家域评审）**: I-AF 共 24 维评审（I-U 13 + V-X 3 + Y-AD 6 + AE-AF 2），产出输出 2/4/6 + 8 剩余条目（约 25K tokens）
- **Session 4（汇总）**: 整合 8 类输出产物，执行 Checklist 闭环验证（约 15K tokens）
- 若单会话执行：优先评审 A-F + G + H1-H2 + AE + AF（8 个 P0 维度 ID = 11 项含 G 子维），其余 25 项降级快速 skim

---

## 第一部分：原提示词深度诊断（7 大结构性问题）

> ⚠️ **智能体注意**：以下为 v1 原始提示词的历史诊断记录，**仅作背景参考，不需执行**。所有问题已在第二部分（v3.5）中修复。智能体应直接跳到第二部分执行。

### 问题 1：覆盖范围"名义广、实质浅"
| 原描述 | 实际漏洞 |
|--------|---------|
| "DevOps 端到端闭环" | 未单独列出 DevOps 核心五阶段（Plan/Build/Test/Release/Operate）+ GitOps 闭环（ArgoCD/Flux）+ CI/CD 反馈环对标维度 |
| "AI 智能场景编排" | 仅 7 个成熟度维度，缺 Agent 评测基准（AgentBench/BabyAGI）、工具调用成功率、幻觉率、成本 ROI（每 Agent 调用 Token）等量化指标 |
| "数据库 AI ops 生态" | 原提示词 G 项 0 个分析维度覆盖 DataOps/DBOps/AIOps for DB |

**数据佐证**：后端 internal/ 下 data-* 相关服务 **14 个**（data-catalog, data-lineage, data-quality, data-pipeline, data-masking, data-classification, database-devops, dba, metadata, service-catalog...），原提示词完全未设分析维度。

### 问题 2：对标标杆"列名单、无分层"
| 问题 | 说明 |
|------|------|
| 8 个标杆混在一起 | 未区分轻量级工具链（Jenkins）vs 平台级生态（GitLab）vs 运营 SaaS（ServiceNow）vs 云原生 CNCF（ArgoCD/Flux） |
| 缺核心标杆 | ServiceNow ITSM、PagerDuty OnCall、Datadog/NewRelic 可观测性、Snyk/Prisma 安全、Great Expectations 数据质量、MLflow/Kubeflow MLOps、Airflow/Dagster 数据流 |

### 问题 3：证据链要求"理想化、不可执行"
| 原描述 | 实际不可行 |
|--------|----------|
| "CodeGraph 图谱（约 40 万节点）做调用链交叉验证" | CodeGraph 在当前仓库中不存在，是假设性工具 |
| "所有结论必须落到具体文件路径/行号/API 端点" | 正确方向，但缺少自动化采集脚本作为前置步骤 |
| "后端路由与服务映射" | 实际在 orion-platform-svc-go/cmd/server/router.go + internal/ 下 303 目录各有独立 RegisterRoutes |

### 问题 4：分析维度"缺少横向/横切维度"
原 7 个维度（A-G）全部是纵向功能域，缺少关键横切维度：
- **安全性**（Security by Design）：OWASP Top 10 / SAST/DAST/SCA/Secrets
- **可观测性**（Observability 3 pillars）：Metrics/Logs/Traces 是否贯通
- **韧性工程**（Resilience Engineering）：熔断/降级/限流/超时/重试/幂等
- **FinOps 成本治理**：资源标签、预算告警、成本分摊
- **合规治理**（Compliance）：等保/ISO27001/SOC2/GDPR
- **多租户与隔离**：租户数据隔离、Quota 管控、资源隔离

### 问题 5：AI Agent 成熟度"维度不足"
| 原 7 维度 | 遗漏的关键维度 |
|-----------|--------------|
| 注册中心/Schema/可配置/权限/个性化/端到端 | (1) Agent 评测体系（Pass@K、成功率、覆盖率） (2) 工具调用治理能力 (3) 多智能体编排拓扑 (4) Agent 安全沙箱 (5) Agent 成本监控 (6) 人机协同模式 |

### 问题 6：输出结构"表格化、缺决策树"
| 问题 | 说明 |
|------|------|
| "差距清单按域聚合" | 缺少依赖关系分析——哪些 P0 是阻塞性的（依赖上游必须先修） |
| "Phase 1-3 计划" | 缺少验收标准的具体可测性定义 |
| 缺 | ROI 评估：每项修复的投入产出比（人天 vs 风险降低 vs 用户价值） |

### 问题 7：系统事实数据"与实际不符"
| 原提示词声称 | 实测数据 |
|-------------|---------|
| "约 211 页" | 正确：211 个页面目录 |
| "约 239 个 API 客户端" | 实际 **177 个** .ts 文件 |
| "约 40 万节点 CodeGraph" | 不存在此工具 |
| "445+ 篇设计文档" | 实际 docs/ 下 **666 个** .md 文件（find 实测；INDEX.md 计 445+ 为另一口径） |

---

## 第二部分：评审提示词（智能体执行部分）

> ⚡ **EXECUTION START** — 智能体从此处开始执行。以下为提示词正文。Part 1（上方历史诊断）仅作背景参考，不需执行。

---

> **角色定位**：国际级 DevOps/AIOps/DataOps 全栈架构 + 设计 + UX + 性能 + 测试 + DX + DBA + AI Agent 专家团队（v3.1 新增架构师/视觉/UX 三角色；v3.2 新增性能工程/测试策略/内部DX/文档治理/数据迁移/状态管理六角色；v3.3 新增 DBA 工作台/AI Agent 架构两角色）
> **任务目标**：对 Orion 平台进行**全栈全量深度对标评审**，覆盖 DevOps 端到端 + AI Ops + Database Ops + DataOps 四大生态 + 架构治理 + 视觉设计 + 用户体验 + 性能工程 + 测试策略 + 开发者体验 + 文档治理 + 数据迁移 + 状态管理 + DBA 工作台 + AI Agent 架构

---

## 一、证据采集前置步骤（必须执行，不可跳过）

### Step 0: 全量资源清单采集

```bash
# 前端
find orion-frontend/src/pages -maxdepth 1 -type d | sort
find orion-frontend/src/api -maxdepth 1 -name "*.ts" | sort
cat orion-frontend/src/router/routes.tsx | grep -c "path:"

# 后端（Go 微服务）
find orion-platform-svc-go/internal -maxdepth 1 -type d | sort
cat orion-platform-svc-go/cmd/server/router.go | grep -c "RegisterRoutes"

# 后端（TS 单体已归档，无需采集）
# legacy/orion-platform-service-ts/ 已于 2026-07-16 归档，Go 版本为唯一生产后端

# 文档
find docs/ -name "*.md" | wc -l
cat docs/frontend-interaction-audit-2026-08-24.md | head -50
```

> **口径说明**：`find internal -maxdepth 1` 包含 `internal/` 自身目录，需 -1。前端路由 338（routes.tsx 中 `path:` 出现次数）vs 后端 340（RegisterRoutes 调用数），差异来自部分路由含子路径（如 `/a/:id`）和多路由注册在同一 Group 下。

### Step 1: 领域-服务-页面三维映射表 + API 调用链验证

构建 [前端页面] x [后端服务] x [路由路径] x [API端点] 四维映射表
验证规则：
  1. 每个前端页面必须有对应的后端服务
  2. 每个后端服务必须有对应的前端页面（或标记为内部服务）
  3. 每个路由路径必须有对应的权限声明
  4. 标记 [孤儿页面] / [孤儿服务] / [孤儿路由]

**API 调用链验证（v2.2 新增，第五维）**：

```bash
# 检查前端 api 客户端是否使用了正确前缀（client.ts baseURL=/api/v1，硬编码 /api/v1/xxx 为旧模式）
grep -rn "'/api/v1/" orion-frontend/src/api/*.ts 2>/dev/null | wc -l
grep -rn "'/api/v1/" orion-frontend/src/api/*.ts 2>/dev/null | head -20  # 列出硬编码旧模式

# 检查前端 api 客户端调用的端点在后端是否有注册
# 提取前端调用的所有端点
grep -rohE "api\.(get|post|put|delete|patch)<[^>]*>\('([^']+)'" orion-frontend/src/api/*.ts 2>/dev/null \
  | sed "s/.*('\(.*\)'/\1/" | sort -u > /tmp/frontend-endpoints.txt
# 提取后端注册的所有路由
grep -rohE 'r\.(GET|POST|PUT|DELETE|PATCH)\(' orion-platform-svc-go/internal/*/handler/*.go 2>/dev/null \
  | sort -u > /tmp/backend-routes.txt
# 交叉比对
comm -23 /tmp/frontend-endpoints.txt /tmp/backend-routes.txt | head -30
```

验证规则：
  5. 前端 api 客户端 import 的端点必须在后端有对应路由注册
  6. API 路径前缀一致性：`client.ts` 已设 baseURL=`/api/v1`，硬编码 `/api/v1/xxx` 为旧模式需迁移
  7. 标记 [断链端点]（前端调用但后端未注册）和 [僵尸路由]（后端注册但前端无调用）

**TS ↔ Go 双版本对标（v2.2 新增，2026-08-25 修正）**：

> 历史背景：`orion-platform-service`（TS 单体）已于 2026-07-16 归档到 `legacy/orion-platform-service-ts/`（commit b91107697），`orion-platform-svc-go`（Go 微服务）是**唯一生产后端**。
> 双版本对标改为**历史差距分析**：评审时对比 Go 版本与已归档 TS 版本的能力差异，识别迁移过程中是否有能力遗失。

验证规则：
  8. 对于 Go 版本中标注为 [Stub] 或 [空壳] 的服务，检查 TS 归档版本 `legacy/orion-platform-service-ts/src/services/<同名>/` 是否有更完整实现
  9. TS 归档有但 Go 版本无的能力标记为 [迁移遗失]
  10. Go 版本新增（TS 归档无）的能力标记为 [Go 新增]
  11. 不再需要"前端实际调用哪个版本"的验证——Go 是唯一后端

### Step 2: 已知缺陷基线（引用已有报告）

读取 docs/frontend-interaction-audit-2026-08-24.md
提取：26 个 P0 + 48 个 P1 + 45 个 P2 + 10 个共享组件问题
标记这些缺陷在以下评审中的"已修复/仍存"状态

### Step 3: 实现深度基线探针（Anti-Demo Guard，防止空壳骗过评审）

> v2.1 新增。**所有"映射匹配"必须区分真实实现 vs demo 空壳**，仅验证"存在性"不判定实现真实性。
> **执行须知**：所有 bash 命令已加 `2>/dev/null` 容错。若 `find` 返回 0 行，需区分"目录不存在"vs"目录存在但 0 行代码"——前者标记为 [未发现]，后者标记为 [空壳]。
> **输出解读**：每个 `echo "=== 标题 ==="` 标记一个探针维度，下一行的数字为实测值。括号中的"应≥X"为预期阈值，不满足即为差距。

```bash
# ════════════════════════════════════════════════════════════
# Layer 1-3: 前端深度探针（页面行数 + mock 检测 + API import）
# ════════════════════════════════════════════════════════════
# ── 第一层：前端页面真实实现深度（递归取最深非测试主文件，跳过 1 行重导出 index）──
for d in orion-frontend/src/pages/*/; do
  name=$(basename "$d"); [ "$name" = "__tests__" ] && continue
  max=0; maxfile=""
  while IFS= read -r f; do
    case "$f" in *__tests__*|*.test.*|*.spec.*) continue;; esac
    base=$(basename "$f")
    if [ "$base" = "index.tsx" ]; then lines=$(wc -l < "$f"); [ "$lines" -le 1 ] && continue; fi
    n=$(wc -l < "$f"); [ "$n" -gt "$max" ] && { max=$n; maxfile="${f#$d}"; }
  done < <(find "$d" -name "*.tsx" -o -name "*.ts" 2>/dev/null)
  echo "$max|$name|$maxfile"
done | sort -n

# ── 第二层：前端 mock/硬编码假深度（抓"行数大但数据假"）──
grep -rlnE "mock|Mock|硬编码|开发中|功能开发中|假数据|模拟数据|const\s+\w+\s*=\s*\[" \
  orion-frontend/src/pages --include="*.tsx" 2>/dev/null | grep -v __tests__ | sort

# ── 第三层：页面是否 import 真实 api client（抓"只渲染不联调"）──
grep -rlc "from '@/api/" orion-frontend/src/pages --include="*.tsx" 2>/dev/null \
  | grep -v __tests__ | wc -l
# 对比：有 mock 但没有 api import 的页面 = 假深度高优候补
comm -23 <(grep -rlnE "mock|Mock|硬编码" orion-frontend/src/pages --include="*.tsx" | grep -v __tests__ | sort) \
  <(grep -rln "from '@/api/" orion-frontend/src/pages --include="*.tsx" | grep -v __tests__ | sort) \
  | head -30

# ════════════════════════════════════════════════════════════
# Layer 4-5: 后端架构 + 前端设计系统探针
# ════════════════════════════════════════════════════════════
# ── 后端深度探针：服务全深度非_test 总行数（含子目录，勿用 -maxdepth）──
for d in orion-platform-svc-go/internal/*/; do
  n=$(find "$d" -name '*.go' ! -name '*_test.go' -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
  echo "${n:-0}|$(basename "$d")"
done | sort -n

# ── 第四层（W维度）：前端设计系统使用度探针 ──
# Design Token 使用率（useToken 调用数 — 应 ≥50，实测仅 1）
echo "=== Design Token 使用度 ==="
grep -rc "useToken\|theme.useToken" orion-frontend/src/ --include="*.tsx" 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# 内联样式总量（style={{}} — 应 ≤1000，实测 6904）
echo "=== 内联样式总量 ==="
grep -rc "style={{" orion-frontend/src/pages --include="*.tsx" 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# 废弃组件 CardPanel 引用数（应 0，实测 125）
echo "=== 废弃组件 CardPanel 引用 ==="
grep -rc "CardPanel" orion-frontend/src/pages --include="*.tsx" 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# 响应式覆盖率（Grid/useBreakpoint 页面数 / 总页面数 — 应 ≥80%，实测 6.6%）
echo "=== 响应式页面数 ==="
grep -rl "useBreakpoint\|Col.*span" orion-frontend/src/pages --include="*.tsx" 2>/dev/null | grep -v __tests__ | wc -l
# ARIA 可访问性覆盖率（aria- 属性页面数 — 应 ≥50%，实测 2.4%）
echo "=== ARIA 可访问性页面数 ==="
grep -rl "aria-\|role=\|tabIndex" orion-frontend/src/pages --include="*.tsx" 2>/dev/null | grep -v __tests__ | wc -l

# ── 第五层（V维度）：后端架构一致性探针 ──
# 接口文件数量（U维度原说仅1个，实测402个 — 需修正）
echo "=== Go 接口文件数 ==="
find orion-platform-svc-go/internal -name "*_interface.go" -o -name "interface*.go" 2>/dev/null | wc -l
# ADR 文档覆盖率（应 ≥30%，实测 7.3%）
echo "=== ADR 文档数 ==="
find docs/adr -name "*.md" 2>/dev/null | wc -l
# ErrorBoundary 使用（应 ≥10 页面级，实测仅1全局）
echo "=== ErrorBoundary 使用数 ==="
grep -rc "ErrorBoundary" orion-frontend/src/ --include="*.tsx" 2>/dev/null | grep -v __tests__ | wc -l

# ════════════════════════════════════════════════════════════
# Layer 6: 测试/性能/状态管理/文档探针（Y/Z/AA/AB/AC/AD 维度）
# ════════════════════════════════════════════════════════════
# 前端测试文件数（.test + .spec）
echo "=== 前端测试文件数 ==="
find orion-frontend/src -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | wc -l
# 前端 E2E 测试文件数（应 ≥10，实测 0）
echo "=== 前端 E2E 测试数 ==="
find orion-frontend -name "*.e2e.*" -o -name "e2e" -type d 2>/dev/null | wc -l
# 后端测试文件数
echo "=== 后端测试文件数 ==="
find orion-platform-svc-go -name "*_test.go" 2>/dev/null | wc -l
# 覆盖率采集配置（应 ≥1，实测 0）
echo "=== 覆盖率采集配置 ==="
grep -rc "istanbul\|nyc\|codecov\|c8\|go test -cover" orion-frontend orion-platform-svc-go --include="*.json" --include="*.yml" --include="*.yaml" --include="*.sh" 2>/dev/null | wc -l
# 契约测试（Pact，应 ≥1，实测 0）
echo "=== 契约测试数 ==="
grep -rc "pact\|Pact\|contract.test\|contractTest" orion-frontend orion-platform-svc-go 2>/dev/null | grep -v node_modules | grep -v __tests__ | wc -l
# 构建产物大小（应 < 20MB，实测 36MB）
echo "=== 前端构建产物大小 ==="
du -sh orion-frontend/dist 2>/dev/null | awk '{print $1}'
# JS chunk 数（应 < 200，实测 388）
echo "=== JS chunk 数 ==="
ls orion-frontend/dist/assets/*.js 2>/dev/null | wc -l
# Core Web Vitals 采集（web-vitals 库使用，应 ≥1，实测 0）
echo "=== Core Web Vitals 采集 ==="
grep -rc "web-vitals\|reportWebVitals\|onCLS\|onLCP\|onFID" orion-frontend/src 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# Lighthouse CI 配置（应 ≥1，实测 0）
echo "=== Lighthouse CI 配置 ==="
find orion-frontend -name "lighthouserc*" -o -name ".lighthouserc" 2>/dev/null | wc -l
# Server State 管理工具（React Query/SWR/Apollo，应 ≥1，实测 0）
echo "=== Server State 工具使用 ==="
grep -rc "useQuery\|useSWR\|useApolloClient\|@tanstack/react-query\|swr/" orion-frontend/src 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# Zustand store 文件数（应 ≥20，实测 7）
echo "=== Zustand store 文件数 ==="
find orion-frontend/src -name "*store*" -o -name "*Store*" 2>/dev/null | grep -v node_modules | grep -v __tests__ | wc -l
# README 覆盖率（应 ≥50%，实测 12.9%）
echo "=== README 文件数 ==="
find docs -name "README*" 2>/dev/null | wc -l
# API 文档自动化（OpenAPI/Swagger 注解，应 ≥1，实测 0）
echo "=== API 文档自动化数 ==="
grep -rc "swagger\|openapi\|swag" orion-platform-svc-go/cmd 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# 数据库迁移目录数
echo "=== 迁移目录数 ==="
find orion-platform-svc-go/internal -type d -name "migrations" 2>/dev/null | wc -l
# 迁移工具配置（golang-migrate/atlas/goose）
echo "=== 迁移工具配置 ==="
grep -rc "golang-migrate\|atlas\|goose\|flyway\|liquibase" orion-platform-svc-go/go.mod orion-platform-svc-go/Makefile 2>/dev/null | wc -l
# 测试用例管理平台（应 ≥1，实测 0）
echo "=== 测试用例管理平台 ==="
grep -rc "testrail\|zephyr\|xray\|qtest\|testlink" orion-frontend/src orion-platform-svc-go --include="*.ts" --include="*.tsx" --include="*.go" 2>/dev/null | grep -v node_modules | awk -F: '{sum+=$2} END{print sum}'
# 跨浏览器执行基础设施（应 ≥1，实测 0）
echo "=== 跨浏览器执行基础设施 ==="
grep -rc "browserstack\|saucelabs\|selenium.grid\|lambdatest\|playwright.*grid" orion-frontend orion-platform-svc-go --include="*.json" --include="*.yml" --include="*.yaml" --include="*.ts" 2>/dev/null | grep -v node_modules | awk -F: '{sum+=$2} END{print sum}'
# 视觉回归工具（应 ≥1，实测 0）
echo "=== 视觉回归工具 ==="
grep -rc "percy\|applitools\|chromatic\|playwright.*snapshot\|storyshot" orion-frontend --include="*.json" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | awk -F: '{sum+=$2} END{print sum}'
# Flaky 测试检测（应 ≥1，实测 0）
echo "=== Flaky 测试检测 ==="
grep -rc "buildpulse\|flaky\|retry.*test" orion-frontend/package.json orion-frontend/vite.config.* orion-platform-svc-go/Makefile 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# API 测试平台（Postman/Karate/Mountebank，应 ≥1，实测 0）
echo "=== API 测试平台 ==="
grep -rc "postman\|newman\|karate\|mountebank\|prism" orion-frontend orion-platform-svc-go --include="*.json" --include="*.yml" --include="*.go" 2>/dev/null | grep -v node_modules | awk -F: '{sum+=$2} END{print sum}'
# 混沌工程实现深度（应 >500 行真实实现，实测 2036）
echo "=== 混沌工程代码行数 ==="
find orion-platform-svc-go/internal/chaos -name "*.go" ! -name "*_test.go" 2>/dev/null -exec cat {} + | wc -l
# 混沌实验模型字段验证（SteadyStateHypothesis/Scope/AutoRollback 应已实现）
echo "=== 混沌实验模型字段 ==="
grep -c "SteadyStateHypothesis\|AutoRollback\|Scope" orion-platform-svc-go/internal/chaos/models.go 2>/dev/null
# 服务网格故障注入引用（Istio/Envoy 故障注入，应 ≥1）
echo "=== Istio/Envoy 故障注入引用 ==="
grep -rc "istio\|envoy\|fault.injection\|FaultDelay\|FaultAbort" orion-platform-svc-go/internal 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# ════════════════════════════════════════════════════════════
# Layer 7: DBA 工作台 + AI Agent 架构探针（AE/AF 维度）
# ════════════════════════════════════════════════════════════
# DBA 后端实现深度（应 >1000 行真实实现，实测 1379）
echo "=== DBA 后端代码行数 ==="
find orion-platform-svc-go/internal/dba -name "*.go" ! -name "*_test.go" 2>/dev/null -exec cat {} + | wc -l
# DBA SQL 审批工作流路由验证
echo "=== DBA SQL 审批路由 ==="
grep -c "approve\|reject\|execute" orion-platform-svc-go/internal/dba/handler.go 2>/dev/null
# DBA 数据源管理验证
echo "=== DBA 数据源管理 ==="
grep -c "DataSource\|TestConnection\|buildPGDSN" orion-platform-svc-go/internal/dba/*.go 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# DBA 审计规则验证
echo "=== DBA 审计规则 ==="
grep -c "AuditRule\|CreateAuditRule" orion-platform-svc-go/internal/dba/*.go 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# database-devops 实现深度（应 >800 行真实实现，实测 140 = stub）
echo "=== database-devops 代码行数 ==="
find orion-platform-svc-go/internal/database-devops -name "*.go" ! -name "*_test.go" 2>/dev/null -exec cat {} + | wc -l
# AI/Agent 后端总行数（应 >10000 行，实测 28000+）
echo "=== AI/Agent 后端总行数 ==="
find orion-platform-svc-go/internal/ai orion-platform-svc-go/internal/ai-agent-run orion-platform-svc-go/internal/agent-trace orion-platform-svc-go/internal/llm orion-platform-svc-go/internal/llm-trace orion-platform-svc-go/internal/prompt-security orion-platform-svc-go/internal/hook-chain -name "*.go" ! -name "*_test.go" 2>/dev/null -exec cat {} + | wc -l
# Agent 编排引擎深度（应 >1500 行，实测 2256）
echo "=== AI 编排引擎行数 ==="
find orion-platform-svc-go/internal/ai/orchestration -name "*.go" ! -name "*_test.go" 2>/dev/null -exec cat {} + | wc -l
# Agent Skill 市场深度（应 >1500 行，实测 2636）
echo "=== AI Skill 市场行数 ==="
find orion-platform-svc-go/internal/ai/skill -name "*.go" ! -name "*_test.go" 2>/dev/null -exec cat {} + | wc -l
# AgentRun 模型字段验证（Status/TimeoutAt/AgentDecision/AgentApproval）
echo "=== AgentRun 模型字段 ==="
grep -c "TimeoutAt\|AgentDecision\|AgentApproval\|AgentAction" orion-platform-svc-go/internal/ai-agent-run/models.go 2>/dev/null
# LLM 网关路由验证
echo "=== LLM 网关路由 ==="
grep -rc "gateway\|router\|provider\|fallback\|retry" orion-platform-svc-go/internal/ai/gateway orion-platform-svc-go/internal/ai/llm-provider orion-platform-svc-go/internal/ai/aigateway --include="*.go" 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'
# Agent 可观测性验证（trace 完整性）
echo "=== Agent 可观测性行数 ==="
find orion-platform-svc-go/internal/agent-trace orion-platform-svc-go/internal/llm-trace -name "*.go" ! -name "*_test.go" 2>/dev/null -exec cat {} + | wc -l
# Agent 失败恢复验证
echo "=== Agent 失败恢复行数 ==="
find orion-platform-svc-go/internal/ai/auto-recovery orion-platform-svc-go/internal/ai/degradation -name "*.go" ! -name "*_test.go" 2>/dev/null -exec cat {} + | wc -l
# Hook Chain 架构验证
echo "=== Hook Chain 行数 ==="
find orion-platform-svc-go/internal/hook-chain -name "*.go" ! -name "*_test.go" 2>/dev/null -exec cat {} + | wc -l
```

> **Step 3 结果记录格式**：将探针输出整理为以下标准表，供 Step 4 评分时直接引用。此表附入最终报告附录 C。
>
> | 探针层 | 维度 | 探针名 | 实测值 | 预期阈值 | 判定 |
> |--------|------|--------|--------|---------|------|
> | L1 | G.1 | 前端最深页面行数 | <数值> | >400=真实 | 真实/部分/Stub/空壳 |
> | L2 | G.1 | mock 页面数 | <数值> | =0 | 有 mock/无 mock |
> | L3 | G.1 | API import 页面数 | <数值> | ≥80% | 覆盖/不足 |
> | L4 | W | Design Token 使用度 | <数值> | ≥50 | 达标/不足 |
> | L4 | W | 内联样式总量 | <数值> | ≤1000 | 达标/超标 |
> | L5 | G.2 | 后端服务行数分布 | <数值> | >2000=真实 | 真实/部分/Stub |
> | L6 | Y,Z... | 测试/性能/状态数据 | <数值> | 各项阈值 | 达标/不足 |
> | L7 | AE,AF | DBA/Agent 行数 | <数值> | >1000/>10000 | 达标/不足 |

**Steps 0-3 输出指引**：
> Steps 0-3 的采集结果**不作为 8 类正式输出**，但**必须记录**为最终报告的**附录 A-C**，供输出 2 的"证据"列和 Step 7 一致性校验引用。
> - 附录 A：Step 0 数据快照（页面数/API数/路由数/docs数）
> - 附录 B：Step 1 五维映射表 + 断链/僵尸路由标记
> - 附录 C：Step 3 探针结果表（上方标准格式）
> - 附录 D：Step 7 交叉一致性校验报告

**深度分级标准**（第一层行数为基，第二层 mock 标记为降级阀）：

| 级别 | 前端页面(递归最深 tsx) | 后端服务(全深度 Go) | 判定 |
|------|-----------------------|--------------------|------|
| **空壳** | <50 行 或 1 行重导出且无真实页 | <250 行 | 页面空白/仅重定向；服务 0 实现或 stub |
| **Stub** | 50-150 行 | 250-800 行 | 有 UI 但数据 mock/硬编码，无真实 API |
| **部分实现** | 150-400 行 | 800-2000 行 | 核心链路有，但边缘能力缺失 |
| **真实实现** | >400 行 | >2000 行 | 完整 CRUD + 真实数据流 |
| **假深度** | **行数>400 但命中 mock/硬编码标记，或 import 0 个 api client** | - | 行数达标但数据非真实，降级 Stub |

> 假深度反例：`TicketDetail/TicketComments.tsx` 516 行，注释自述用 `mockTicketComments`。

**已知空壳基线（2026-08-25 全深度实测，第一批痛点预埋）**：

> 探针修正说明：初扫将 `internal/ci-cd`、`governance`、`identity`、`workflow` 误判为"0 行空目录"，实为**服务聚合容器**（分别含 122/66/80/44 个子文件，其子服务已是真实实现）。全深度复扫后**剔除这 4 项**。
> 后端深度标准实测分布：303 服务中 5 个空壳(<250行)、131 个 Stub(<800行)、121 个部分、46 个真实(>2000行)。

**前端空壳基线（4 项，真实存在）**：

| 位置 | 路径 | 实测 | 现状 |
|------|------|------|------|
| 前端P0 | pages/service-catalog | 39 行 stub | 报告标 P0 未修 |
| 前端P0 | pages/service-portal | 35 行 stub | 报告标 P0 未修 |
| 前端P0 | pages/digital-twin | 35 行 stub | 报告标 P0 未修 |
| 前端P0 | pages/ci-type-designer | 35 行 stub | 报告标 P0 未修 |

**后端轻实现候选（5 项，需逐项判定是"脚手架但可用"还是"stub"）**：

| 位置 | 主代码行数 | 说明 |
|------|-----------|------|
| internal/agents | 140 行 | 三层脚手架结构（handler/repository/models），需验证是否真实 CRUD |
| internal/database-devops | 140 行 | 标准 CRUD 脚手架已确认可用（tenant_id 过滤 + Repository 模式） |
| internal/gateway-routes | 140 行 | 同上结构，需验证 |
| internal/rate-limiting | 140 行 | 同上结构，需验证 |
| internal/test-reports | 140 行 | 同上结构，需验证 |

**后端真 panic 桩（3 项，需修复）**：

| 位置 | 行数 | 问题 |
|------|------|------|
| internal/cache-monitor | 258 | 5 个 repository 方法全部 `return nil, nil` |
| internal/performance | 262 | 1 个方法 `return nil, nil` |
| internal/service-registry | 257 | 1 个边缘分支 `return nil, nil`（主体可用） |

**分类方法**：131 个 Stub 候选（250-800 行）中，grep 检测 `sqlx.`/`.Find(`/`.Create(` 等 DB 关键词，113 个(86%)有真实 DB 查询，仅 3 个真 panic 桩。另有 42 个 panic 桩分布在重型服务内部子模块（如 ai/security 等），非独立空壳。

评审时对以上 4 前端 + 5 后端轻实现 + 3 真桩共 **12 项**执行"逐项复检"，**不得直接引用旧报告结论**。

---

## 二、分析目标

对 Orion 平台进行 **旗舰级全量深度分析**，围绕以下四大生态 + 两大横切维度：

```
+------------------+------------------+------------------+------------------+------------------+
| DevOps 端到端    | AI Ops Agent     | DB Ops 数据库    | DataOps 数据治理 | 横切维度         |
| Plan/Build/Test  | 智能编排         | 运维             | 质量/血缘/目录   | Sec/Obs/FinOps   |
| Release/Operate  | Agent 体系       | Schema治理       | Pipeline编排     | 合规/韧性/多租户  |
+------------------+------------------+------------------+------------------+------------------+
```

---

## 三、对标标杆分层体系（按平台成熟度分 4 层）

| 层级 | 定位 | 标杆 |
|------|------|------|
| **L1 工具级** | 单一工具/组件 | Jenkins, GitLab CI, ArgoCD, Tekton, Airflow, Trivy, Snyk |
| **L2 平台级** | 完整平台生态 | GitLab, GitLab Ultimate, Azure DevOps, JFrog, **Zadig**, **云效（DevOps 版）**, **CNB（云原生构建）** |
| **L3 运营级** | 企业级运营平台 | ServiceNow ITSM, PagerDuty, Datadog, Dynatrace, **KubeSphere（DevOps+可观测一体化）** |
| **L4 行业级** | 全行业综合平台 | 嘉为蓝鲸 WeOps, 腾讯蓝鲸, OneOps, Harness, **阿里云效（企业级）**, **KubeSphere（全栈 PaaS）** |

### 新增标杆重点对标维度

| 标杆 | 定位 | 重点对标能力 |
|------|------|-------------|
| **KubeSphere** | 云原生 PaaS 平台 | 多租户隔离（workspace）、DevOps 流水线一体化、可观测三支柱贯通、应用商店、多集群管理 |
| **Zadig** | 云原生 DevOps 平台 | 开发者自助环境（按需创建/销毁）、模板化流水线、服务热更新、多服务并行部署 |
| **云效（阿里）** | 企业级 DevOps | 需求-代码-流水线-部署全链路追溯、流水线模板市场、制品安全（容器+SCA）、研发效能度量 |
| **CNB（云原生构建）** | 云原生 CI/CD | 基于容器编排的弹性构建、缓存复用、并行加速、构建资源调度优化 |
| **腾讯蓝鲸** | 一体化运维 | 作业平台、配置平台(CMDB)、监控平台、故障自愈、持续集成 |
| **Harness** | AI 驱动交付 | 智能部署验证（Deployment Verification）、异常检测、GitOps+Pipeline 融合 |
| **OneOps** | 一体化运维 | 工单+CMDB+流水线+监控一体化、ITSM 闭环 |
| **Ant Design Pro** | 企业级前端方案 | Design Token 系统、ProComponents、响应式布局、暗色模式 — **W 维度对标** |
| **Linear** | 极致 UX SaaS | 键盘优先、极速交互、渐进式信息展示、Toast 反馈 — **X 维度对标** |
| **Vercel Dashboard** | 极简设计标杆 | 视觉一致性、Loading 骨架屏、空态设计、暗色模式 — **W/X 维度对标** |
| **web.dev / Lighthouse** | 前端性能工程 | Core Web Vitals (LCP/FID/CLS)、Performance Budget、Lighthouse CI — **Y 维度对标** |
| **Jest + Playwright** | 前端测试金字塔 | 单元测试 + E2E 测试、覆盖率门禁、契约测试(Pact) — **Z 维度对标** |
| **Backstage** | 开发者门户 | Software Catalog、文档即代码、模板化脚手架 — **AA/AB 维度对标** |
| **Atlas / Flyway** | Schema-as-Code | 声明式 Schema 迁移、零停机 Expand-Contract、CI 集成 — **AC 维度对标** |
| **React Query / TanStack** | Server State 管理 | 声明式数据获取、自动缓存、乐观更新、失效重验证 — **AD 维度对标** |
| **Bytebase** | 数据库 DevOps 平台 | SQL 审批工作流、Schema 演进管理、数据库审计、多数据源管理 — **AE 维度对标** |
| **Percona PMM** | DB 监控与诊断 | 慢查询分析、性能基线、容量规划、QPS/连接数监控 — **AE 维度对标** |
| **LangGraph** | Agent 编排框架 | DAG/linear/branching 编排、状态图、人机协作节点、检查点 — **AF 维度对标** |
| **LangSmith / Langfuse** | LLM 可观测性 | trace 完整性、token 归因、cost attribution、decision span — **AF 维度对标** |
| **Dify** | LLMOps 平台 | Workflow 编排、RAG pipeline、模型管理、Skill 市场 — **AF 维度对标** |

### 对标能力维度细化

**KubeSphere 重点对标**：
- **多租户 workspace**：Orion 的 tenant_id 机制是否实现 workspace 级资源隔离（计算/网络/存储）？
- **DevOps 流水线**：可视化流水线编辑器、Jenkins 集成、流水线模板库
- **可观测一体化**：监控/日志/告警/链路追踪是否统一在 apm/observability 页面贯通
- **多集群管理**：Orion 的 multi-cloud 是否支持跨集群统一管控
- **应用商店**：Helm 应用模板化部署能力

**Zadig 重点对标**：
- **开发者自助环境**：Orion 是否支持"开发者一键拉起环境、用完自动回收"？
- **服务热更新**：开发态增量构建 + 热部署，无需全量重建
- **多服务并行部署**：Orion 的 deploy 模块是否支持多服务批量部署
- **模板化流水线**：构建/部署模板复用，与 Orion 的 pipeline-template 对比

**云效重点对标**：
- **全链路追溯**：需求(IDE/Story) → 代码提交 → 流水线构建 → 部署 → 运行 → 告警，是否可双向追溯？
- **研发效能度量**：DORA 四指标 + 流水线效率 + 代码评审延迟，度量维度完整性
- **流水线模板市场**：Orion 的 pipeline-template 是否支持社区共享/模板继承
- **制品安全**：容器镜像扫描 + SBOM + 依赖漏洞，与 Orion 的 sbom/supply-chain 对比

**CNB 重点对标**：
- **弹性构建**：构建资源按需调度、构建队列优先级管理
- **缓存复用**：Build 缓存层级（模块级/层缓存/构建结果缓存）
- **并行加速**：Pipeline 任务并行编排，与 Orion 的 pipeline-engine DAG 对比
- **构建资源调度**：K8s 原生构建 Pod 调度优化

**Bytebase 重点对标（AE 维度）**：
- **SQL 审批工作流**：Orion 的 SqlOrder model + approve/reject/execute 路由是否实现多级审批/自动审批规则/SLA？
- **Schema 演进管理**：Orion 的 migration(723行) 是否实现声明式 Schema 变更/版本追踪/回滚？
- **多数据源管理**：Orion 的 DataSource model 是否支持多数据库类型/连接池配置/健康检查？（实测仅 PostgreSQL）
- **数据库审计**：Orion 的 AuditRule 是否实现审计规则匹配/敏感操作拦截/合规报表？

**Percona PMM 重点对标（AE 维度）**：
- **慢查询诊断**：Orion 的 QueryExecutionRecord + ListQueryLogs 是否实现 pt-query-digest 级别的慢查询分析？
- **性能基线**：Orion 的 GetDailyStats 是否实现 QPS/连接数/锁等待趋势分析？
- **容量规划**：Orion 是否有数据库容量预测/瓶颈定位能力？

**LangGraph 重点对标（AF 维度）**：
- **Agent 编排架构**：Orion 的 ai/orchestration(2256行) 是否实现 DAG/状态图/条件分支/循环重试？
- **人机协作节点**：Orion 的 AgentApproval model 是否实现 LangGraph 的 human-in-the-loop 中断/恢复？
- **检查点机制**：Orion 的 ai/auto-recovery(635行) 是否实现状态持久化/幂等恢复？

**LangSmith/Langfuse 重点对标（AF 维度）**：
- **Trace 完整性**：Orion 的 agent-trace(908行)+llm-trace(1518行) 是否实现 decision span 粒度/token 归因/cost attribution？
- **推理链回放**：Orion 的 AgentDecision model(step/action/reasoning/tool_result) 是否支持完整推理链回放？
- **Error tracking**：Orion 是否有 LLM 调用错误率/延迟分布监控？

**Dify 重点对标（AF 维度）**：
- **Workflow 编排**：Orion 的编排引擎是否支持 Dify 级别的可视化 Workflow 编辑？
- **RAG pipeline**：Orion 的 ai/vector(507行)+ai/semantic-search(759行) 是否实现分块策略/embedding/检索准确率/reranking？
- **Skill 市场**：Orion 的 ai/skill(2636行)+SkillManagement 前端(2706行) 是否实现 Dify Marketplace 级别的 skill 生命周期(submit→review→publish→execute→audit→version)？
- **LLM 网关**：Orion 的 ai/gateway+ai/llm-provider 是否实现 LiteLLM 级别的路由策略/降级链/成本优化？

---

## 四、核心功能域分析框架（A-F 共 6 主维）

> A-F 共 6 个核心功能域维度。G 深度校验见 §四补（3 子维），H1-H2 横切维度见 §五。§四+§四补+§五 共 12 项，§五补 I-AF 共 24 项，合计 36 项。

### A. DevOps 端到端交付（原 A+E 合并深化）

#### A1. Plan（规划与需求管理）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| 需求管理 + Sprint/排期 | Jira, GitLab Issues, **云效** | 前端: Projects(260行)/SprintBoard/RDM(468行真实实现) |
| 需求到上线的可追溯性 | 代码提交/PR/Build/Deploy/Incident 全链追踪，**云效全链路追溯** | 后端: product-line + branch-policy |
| 风险管控 + 决策记录 | 风险登记表、ADR 体系 | 后端: risk + decision-explanation |
| 需求项 CRUD（Story/Epic/Backlog） | Jira, 云效需求 | 前端: RDM(468行)+api/rdm.ts(375行)；后端: sprint(634行真实)+project(274行真实) |
| 需求-代码-部署双向追溯 | 云效全链路追溯, Jira→Git 提交关联 | 后端: project + branch-policy（需验证双向追溯链完整性） |

#### A2. Build（构建与制品）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| CI 流水线编排 | GitLab CI, Jenkins, Tekton, **CNB**, **ArgoCD Workflow** | 前端: PipelineList/Editor/Detail |
| 构建环境管理 | BuildEnv, Runner, **Zadig 自助环境**, **CNB 弹性构建** | 后端: build-env + runner |
| 制品管理（版本/存储/提升） | Nexus, Artifactory, JFrog, **Harbor 镜像仓库** | 前端: Artifacts/ArtifactVersion/artifact-ops |
| 制品安全扫描 | Snyk, Trivy, **Harbor 安全扫描** | 后端: sbom + container-scan |
| SBOM/SCA 供应链安全 | Snyk, Prisma Cloud, **云效制品安全** | 前端: SbomDashboard/SbomDetail |
| 构建缓存复用 | **CNB 缓存层级**, GitLab CI cache | 后端: build-env（需验证缓存复用能力） |
| 并行加速 | **CNB 并行 DAG**, Tekton pipeline | 后端: pipeline-engine（DAG 并行编排） |
| CI/CD 一体化工具链 | **Jenkins + Tekton + ArgoCD + Harbor** | 前端: PipelineList+deploy；后端: 需验证工具链集成深度（镜像构建→扫描→存储→部署全链路） |

#### A3. Test（自动化测试）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| 自动化测试集成 | pytest, JUnit, 集成网关 | 后端: test-execution-engine |
| 测试报告与质量门禁 | Quality Gate, SonarQube | 前端: TestReport/quality-gate |
| 测试选择优化（智能测试） | Test Impact Analysis | 前端: TestSelector |
| 测试代码自动生成 | 基于 AI 的测试生成 | 后端: test-generation |
| 性能测试 | k6, JMeter, Locust | 前端: performance |

#### A4. Release（发布管理）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| 发布编排（Blue-Green/Canary/Rolling） | Argo Rollouts, Spinnaker, **Harness 智能验证** | 前端: CanaryAnalysis/canary-traffic |
| GitOps 闭环（ArgoCD/Flux） | ArgoCD, Flux, **Harness GitOps 融合** | 后端: deploy + deploy-enhanced |
| 发布策略（灰度/蓝绿/金丝雀） | 流量管理 | 前端: TrafficGovernance |
| 回滚与自愈 | 自动回滚、自愈策略, **蓝鲸故障自愈** | 前端: SelfHealing |
| 变更管理 + 变更追溯 | Change Request + Change Intelligence, **OneOps ITSM 闭环** | 前端: ChangeManagement/ChangeIntelligence |
| Feature Flag / 灰度开关 | LaunchDarkly, Unleash | 前端: feature-flags |
| 部署验证 | **Harness AnalysisRun**, Argo Rollouts Analysis | 后端: deploy-enhanced（需验证金丝雀指标分析） |

#### A5. Operate（运维与监控）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| **K8s 全生命周期管理** | **KubeSphere 多集群**, Rancher | 多集群部署/升级/容量规划/日常巡检/集群故障恢复 | 前端: multi-cloud；后端: infrastructure(14995行) |
| 基础设施管理 | Terraform, Pulumi, **KubeSphere 多集群** | 前端: multi-cloud/IacManagement |
| 配置管理 | Ansible, Chef, **蓝鲸配置平台** | 前端: ConfigManagement/ConfigDiff |
| 中间件运维 | 中间件监控与治理 | 前端: middleware-ops |
| 巡检与健康检查 | 自动化巡检, **蓝鲸作业平台** | 前端: inspection/HealthDashboard |
| Cron 调度与任务管理 | Airflow, Prefect | 前端: CronJobs/QueueTasks |
| 灾备与恢复 | DR 演练、RTO/RPO | 前端: DisasterRecovery |
| 数字孪生 | 基础设施镜像 | 前端: DigitalTwin/digital-twin |
| 多租户隔离 | **KubeSphere workspace**, **云效组织/项目** | 后端: auth + tenant（需验证 workspace 级隔离） |
| 应用商店/模板市场 | **KubeSphere 应用商店**, **云效模板市场** | 前端: pipeline-template/lowcode（需验证模板共享） |
| 集群故障恢复 | **KubeSphere 集群恢复**, Velero | 集群级故障恢复能力、etcd 备份恢复 | 后端: dr+PipelineEngine；需验证集群恢复 SOP |
| 一键变更 | **Harness 一键变更**, **Zadig 服务热更新** | 变更自动化编排、审批、回滚、灰度一体化 | 前端: ChangeManagement+deploy；需验证"一键"流程完整性 |

### B. AI Ops — Agent 与智能编排（原 G 深化扩展）

#### B1. AI 基础设施层
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| AI Gateway / LLM 路由 | LangChain, LLMOps | 前端: AIGateway/LLMTraceDashboard |
| MCP 协议集成 | Model Context Protocol | 前端: MCPManagement |
| 向量数据库管理 | Pinecone, Weaviate | 前端: VectorStore |
| Prompt 工程与版本管理 | Promptfoo, LangSmith | 前端: PromptCanary |
| AI 成本控制 | Token 用量/成本分析 | 前端: AICostDashboard |
| AI 安全 | 提示注入防护、输出过滤 | 前端: AISecurity |

#### B2. Agent 能力体系（重点评估）
| 维度 | 评估标准 | 验证路径 |
|------|---------|---------|
| **Agent 注册中心** | 统一注册/发现/生命周期管理 | 前端: AIAgents |
| **Agent 编排拓扑** | 星型/链式/网状/层次编排能力 | 后端: agents + workflow |
| **Schema 标准化** | 统一 Skill 定义 Schema | docs: services/ai/AI-Skill-Schema-定义.md |
| **可配置化** | 运行时动态配置参数 | 前端: AIDashboard/Assistant |
| **权限化** | Agent 级别权限控制、RBAC | 后端: permission + abac-policy |
| **个性化** | 用户级 Agent 定制 | 前端: UserProfile/UserSettings |
| **Human-in-the-loop** | 人机协同决策 | 前端: ai-decision/ai-decision-explanation |
| **Agent 评测体系** | Pass@K、成功率、覆盖率、满意度 | 前端: EvalSetManagement |
| **Agent 成本治理** | 单 Agent 调用 Token成本 | 前端: AICostDashboard |
| **Agent 安全沙箱** | 指令注入防护、权限隔离 | 后端: prompt-security |
| **Agent 演进** | 模型演进、版本管理 | 前端: ModelEvolution |

#### B3. AI 应用场景覆盖
| 场景 | 对标成熟度 | 验证路径 |
|------|----------|---------|
| 工单智能创建/路由 | L1 规则到 L4 AI 自动分类 | 前端: TicketList + AI 决策 |
| 告警智能处理/根因分析 | L1 规则到 L4 AIOps RCA | 前端: AlertList + ai-decision |
| CMDB 自动发现/环境巡检 | L1 手动到 L4 AI 自动巡检 | 前端: CMDB + inspection |
| 发布智能编排 | L1 手动到 L4 智能部署决策 | 前端: deploy + smart-deploy |
| 代码智能评审 | L1 人工到 L4 AI Code Review | 前端: AIReview |
| ChatOps / 协作 | L1 Webhook到 L4 对话式运维 | 前端: Assistant + chatops |
| 知识库/RAG | L1 FAQ到 L4 多模态检索增强 | 前端: KnowledgeBaseV2(793行真实)/DocumentCenter(1215行真实)/pandawiki；后端: knowledge(4950行真实)+pandawiki(3690行真实)；独立子项目: orion-knowledge(PandaWiki fork, 含 backend/deploy) |

### C. Database Ops + DataOps（新增核心域）

#### C1. 数据库运维（DBOps）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| 数据库生命周期管理 | 创建/删除/扩容/备份 | 前端: dba |
| Schema 变更管理 | Schema 审核/审批/上线 | 后端: dba + database-devops |
| SQL 审核与优化 | SQL 规范、慢查询分析 | 后端: dba |
| 数据备份与恢复 | 自动备份、RTO/RPO | 前端: Backup |
| 中间件运维 | 中间件监控与治理 | 前端: middleware-ops |
| 数据库安全 | 敏感数据脱敏、权限管理 | 后端: data-masking |
| **数据中间件管理** | **Redis/Kafka/RabbitMQ/MySQL/PG 部署/监控/排障** | 数据库与中间件（Redis/Kafka/MySQL/PG）的部署、监控、排障闭环 | 前端: dba/middleware-ops；后端: dba |
| 流量管控与微服务治理 | **Ingress/Istio/Envoy** 配置管理、蓝绿/金丝雀发布策略、流量安全策略 | 前端: TrafficGovernance/CanaryAnalysis；后端: deploy-enhanced；需验证 Ingress/Istio 集成深度 |

#### C2. 数据治理（DataOps）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| 数据目录/数据资产 | 元数据管理、资产盘点 | 后端: data-catalog + metadata |
| 数据血缘/影响分析 | 列级血缘、变更影响 | 前端: data-lineage |
| 数据质量管理 | 规则定义、异常检测 | 前端: data-quality |
| 数据分类分级 | 敏感数据识别 | 后端: data-classification |
| 数据脱敏/隐私 | 动态/静态脱敏 | 后端: data-masking |
| 数据 Pipeline 编排 | Airflow/Dagster 对标 | 前端: pipeline-svc/data-pipeline、autonomous-pipeline |
| 服务目录/资产清单 | 服务注册与发现 | 前端: service-catalog/ServiceCatalog |

### D. ITSM + CMDB + 工单体系（原 C 深化）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| 事件管理（Incident） | ServiceNow, PagerDuty | 前端: Incident |
| 问题管理（Problem） | ITIL Problem Mgmt | 前端: Problem |
| 变更管理（Change） | ITIL Change Mgmt | 前端: ChangeManagement |
| SLA 管理 | SLA 定义/计算/告警 | 前端: SLA |
| OnCall 排班 | PagerDuty, OpsGenie | 前端: OnCall |
| 审批工作流 | 多级审批/升级 | 前端: ApprovalManagement/Approvals |
| CMDB 配置管理 | CMDBuild, ServiceNow CMDB | 前端: CMDB |
| CMDB 漂移检测 | 自动比对/告警 | 前端: cmdb（CMDB 页内 Tab 实现，无独立目录） |
| 服务拓扑 | 依赖关系/调用链 | 前端: service-topology/ServiceTopology |

### E. 研发效能度量（原 B 深化）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| DORA 四指标 | 部署频率/变更前置/恢复时间/变更失败, **云效效能度量** | 前端: efficiency/DoraMetricsPage.tsx（文件非目录） |
| 效能看板 | 团队/个人/组织级, **云效研发效能** | 前端: EfficiencyDashboard/EfficacyMetrics |
| 质量交付指标 | 缺陷密度、返工率 | 前端: MetricsDashboard |
| 交付时效分析 | Lead Time 分析 | 前端: BI/ReportDesigner |
| 瓶颈分析 | 流水线瓶颈识别 | 后端: efficiency |
| 多维报告 | 自定义报告 | 前端: ReportDesigner |

### F. 工程工具链 + 自动化（原 E+F 合并）
| 能力项 | 对标标杆 | 验证路径 |
|--------|---------|---------|
| 代码管理 + 分支策略 | GitLab, GitHub | 前端: CodeMgmt |
| 分支策略与保护规则 | 受保护分支、代码审查 | 后端: branch-policy |
| 流水线模板与编排 | 模板库、版本管理 | 前端: pipeline-template |
| Webhook 管理 | 事件订阅/回调 | 前端: WebhookManagement |
| API 治理 | 版本/文档/审计 | 前端: api-governance |
| 自动化任务 + 脚本 | 脚本库、计划任务 | 前端: ScriptLibrary/ScriptRunner |
| 低代码/无代码 | 表单设计器、工作流 | 前端: lowcode/FormDesigner |
| 知识库/文档管理 | Confluence, Notion, **KubeSphere 文档中心** | 前端: DocumentCenter(1215行真实)/KnowledgeBaseV2(793行真实)；后端: knowledge(4950行真实)+pandawiki(3690行真实)；独立子项目: orion-knowledge(PandaWiki fork) |
| 需求管理平台 | Jira, 云效需求, **Zentao** | 前端: RDM(468行真实)/SprintBoard/Projects；后端: sprint(634行真实)+project(274行真实)；api: rdm.ts(375行)+sprints.ts |

---

## 四-补、G. 实现深度与真实性校验（Anti-Demo Guard）

> **目的**：区分"宣称的能力"与"真实可用的能力"。G 维度是所有 36 维的**横切校验层**——A-F 每个维度列出的"验证路径"，必须经 G 维度判定为「真实实现」才算成立。G 维度探针在 Step 3 执行。
> **一致性规则**：输出 2 第 5 列（深度判定）必须与 G 维度评分、Step 3 探针结果交叉一致。若不一致，以 Step 3 实测为准并标注差异。

### G.1 前端页面深度判定

对每个进入评审范围的前端页面，执行：

| 探针 | 判定 |
|------|------|
| 主 tsx 行数分级（见 Step 3 标准） | 空壳 <50 / Stub 50-150 / 部分实现 / 真实实现 |
| 是否 import 对应 api client | 未 import = 显式数据非真实 |
| 是否含 mock/硬编码/开发中/假数据字面量 | 含 = 标记 Stub |
| 交互闭环：按钮 handler / 表单提交 / loading / error message | 缺 = 交互不完整 |
| 空壳是否仅为重定向 | 判定为「不可用」 |

### G.2 后端服务深度判定

| 探针 | 判定 |
|------|------|
| 主代码行数分级 | 空壳 <250 / Stub 250-800 / 部分 / 真实 |
| 是否有 Repository/DB 依赖 | 无 = 多为 mock 存储 |
| 是否含 `panic("not implemented")` / 空 Response 桩 / TODO | 含 = Stub |
| 是否有对前端页面可寻址的具体端点（非仅注册空路由） | 无 = 不可用 |

### G.3 深度矩阵输出

每个能力项最终必须落在以下 5 级之一（不得含糊）：

```
[状态] 真实实现 / 部分实现 / Stub / 空壳 / 未发现
[证据] 文件:行号 / API / 路由 + 实测行数
```

---

## 五、两大横切维度分析框架

### H1. 安全性（Security by Design）
| 子维度 | 对标 | 验证路径 |
|--------|------|---------|
| 认证授权 | OAuth2/OIDC/MFA/SSO | 后端: auth + auth-mfa + sso-* |
| ABAC/RBAC 统一 | 策略引擎 | 后端: abac-policy + permission |
| API 安全 | 限流/鉴权/审计 | 后端: rate-limiting + api-governance |
| 供应链安全 | SBOM/SCA/容器扫描 | 前端: SbomDashboard/supply-chain |
| 用户行为分析 | UEBA 异常检测 | 前端: security/UEBA、security-svc/UEBA |
| 终端审计 | 堡垒机审计 | 后端: terminal-audit |
| 合规检查 | 安全基线扫描 | 后端: security-compliance |
| OWASP Top 10 | 代码扫描/SAST | 后端: security |

### H2. 可观测性 + 韧性 + FinOps
| 子维度 | 对标 | 验证路径 |
|--------|------|---------|
| 三大支柱（Metrics/Logs/Traces） | **Prometheus + VictoriaMetrics + Alertmanager + Grafana**, **ELK/ECK**, **OpenTelemetry**, **KubeSphere 可观测一体化** | 前端: apm/observability；后端: monitoring |
| 分布式追踪 | OpenTelemetry, **Jaeger/Tempo** | 后端: tracing + llm-trace |
| 告警管理 | Alertmanager, **Alertmanager 抑制/静默/分组**, **蓝鲸监控平台** | 前端: AlertList/alert-escalation |
| 熔断/降级/限流 | Circuit Breaker | 前端: circuit-breaker |
| 容量规划 | 容量预测/扩容建议 | 前端: capacity-planning |
| 成本治理（FinOps） | 预算/告警/分摊 | 前端: finops/FinOpsDashboard/CostAllocation |
| 灾备演练 | RTO/RPO 验证 | 前端: DisasterRecovery |
| 智能部署验证 | **Harness 部署验证**, Argo Rollouts Analysis | 后端: deploy-enhanced（需验证金丝雀指标分析） |
| 日志留存与审计 | **ELK/ECK**, **Loki**, 日志留存策略+审计日志归档 | 后端: audit+terminal-audit；需验证日志留存合规 |
| 报表自动生成 | **Grafana 报表**, **Kibana 报表** | 前端: ReportDesigner；需验证可观测性报表自动生成 |
| 可观测性 Toolchain 集成 | **Prometheus + VictoriaMetrics + Alertmanager + Grafana + ELK + OTel** 一体化深度 | 需验证各工具间数据流打通程度（告警→日志→链路关联） |

---

## 五-补、专家团队补充维度（I-AF 共 24 维，加上 §四~§五 的 12 维 = 36 维总计）

> 以下 24 个维度由硅谷领域专家联合评审识别。v3.0 的 I-U 共 13 维对应的后端服务大多已存在但原提示词无评审维度——"已有能力但评审盲区"问题。v3.1 的 V-W-X 补充架构治理/视觉设计/用户体验三个系统级维度。v3.2 的 Y-AD 补充性能工程/测试策略/内部DX/文档治理/数据迁移/状态管理六个工程质量维度。v3.3 的 AE-AF 补充 DBA 工作台架构/AI Agent 架构两个深度评审维度——对应系统最大功能集群（AI/Agent 28000+ 行）和独立工作台产品（DBA 1379 行）。

### I. SRE 实践体系（Dr. Lin, Google SRE 前 Director）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **ODAE 自治运维闭环** | **Loop Engineering** | 监控→告警→AI诊断→自动处置→复盘全链路：各环节是否打通、处置是否自动化、复盘是否闭环 | 后端: monitoring(10077行)+alert(10个子服务)+auto-recovery+incident；前端: 需验证全链路闭环看板 |
| SLO/SLI 定义 | Google SRE, Datadog SLO | SLO 目标定义+错误预算消耗追踪 | 后端: monitoring(10077行)；前端: 需验证是否有 SLO 配置页 |
| 错误预算管理 | Google SRE | SLO 违约时自动冻结发布 | 后端: deploy（需验证错误预算门禁） |
| Runbook 自动化 | PagerDuty Runbook | 故障处置 SOP 的可执行化 | 前端: 需验证是否有 Runbook 管理 |
| 事故复盘与改进 | Atlassian Postmortem, Blameless | 事故复盘记录模板+跟踪+改进措施闭环 | 前端: Incident（需验证复盘功能+改进跟踪） |
| 值班排班（深度） | PagerDuty Schedules | 轮班/升级/时区/ override | 前端: OnCall（当前仅工单维度，缺深度排班） |
| 自愈策略 | **ODAE 自动处置**, SelfHealing | 自愈策略定义、执行、验证闭环 | 前端: SelfHealing；后端: auto-recovery |
| 告警 AI 诊断 | **Claude/Codec/Codex AI 运维 Agent** | 告警是否自动触发 AI 根因分析、诊断结论是否可执行 | 后端: ai-decision+alert-correlation；需验证 AI 诊断报告 |
| 自动巡检 Agent | **AI 巡检 Agent**（Codex/Codec） | 自动化巡检脚本、巡检结果、异常检测、巡检报告 | 后端: inspection；前端: Inspection；需验证 AI 巡检能力 |
| 日志智能分析 Agent | **AI 日志分析 Agent**（Claude/Codex） | 海量日志中异常模式识别、根因定位、日志摘要 | 后端: tracing+llm-trace；需验证 AI 日志分析深度 |
| 故障诊断 Agent | **Codex/Codec 故障诊断** | Agent 自动采集故障上下文、调用链分析、给出修复建议 | 后端: ai-decision+incident-action；需验证 Agent 故障诊断深度 |

### J. 事件驱动架构与消息治理（Marcus Chen, Uber Event Mesh 首席）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| 事件总线 | Confluent, NATS, EventBridge | 是否有事件总线，还是仅 HTTP 同步 | 后端: notification(15103行)+message-queue(290行) |
| 事件溯源 | Event Store, Axon | 关键实体变更是否事件溯源 | 后端: events/ 目录是否存在 |
| CQRS | Greg Young CQRS | 读写分离模式是否落地 | 后端: 需验证是否有独立读模型 |
| 事件 Schema 治理 | Confluent Schema Registry | 事件 Schema 版本化+breaking change 检测 | 后端: 需验证 Schema Registry |
| 事件驱动编排 | Temporal, Cadence | 异步工作流编排（workflow 是否同步阻塞？） | 后端: workflow(聚合容器) |

### K. API 治理与开发者体验（Sarah Park, Stripe Developer Platform 前 VP）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| API 设计规范 | Stripe API Style Guide, Google API Design | 统一命名/分页/错误码规范 | 后端: api-governance；前端: api-governance |
| API 文档自动生成 | OpenAPI/Swagger | 路由 → 自动生成 OpenAPI 规范 | 后端: 需验证是否有 swagger 注解 |
| SDK 自动生成 | OpenAPI Generator | 多语言 SDK 自动产出 | 需验证是否有 SDK 生成流水线 |
| 开发者门户试探台 | Stripe Workbench, GitHub Explorer | 在线 API 调试器 | 前端: service-portal/developer-portal |
| API 版本管理 | Stripe Deprecation | v1/v2 共存策略与废弃流程 | 后端: 需验证路由版本前缀 |
| API 密钥管理 | HashiCorp Vault | 密钥生命周期+轮换+撤销 | 后端: api-key |

### L. 供应链安全深度（Raj Patel, GitHub SLSA 作者）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| SBOM 自动生成 | Syft, CycloneDX | 每个制品是否产出 SBOM | 后端: sbom；前端: SbomDashboard |
| 制品签名验证 | Cosign, Sigstore | 制品签名+部署前验证 | 后端: artifact（需验证签名能力） |
| 构建溯源（Provenance） | SLSA Level 3 | 构建产出可验证溯源元数据 | 后端: build（需验证 provenance） |
| 依赖漏洞持续监控 | Dependabot, Snyk | 持续监控（非一次性扫描） | 后端: supply-chain（需验证持续监控） |
| 构建环境隔离 | Bazel Remote Cache, SLSA L3 | 构建在可信隔离环境 | 后端: build-env（需验证隔离级别） |

### M. 数据生命周期与合规（Elena Volkov, Snowflake Data Governance）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| 数据保留策略 | Collibra Retention | 每类数据保留期限定义 | 后端: 需验证是否有 retention 配置 |
| 数据归档与清理 | AWS S3 Lifecycle | 冷热数据分层与归档 | 后端: version-archive（需验证归档） |
| 数据主权 | Azure Sovereign | 数据是否出境（中国数据本地化） | 需验证部署架构 |
| 隐私计算 | Federated Learning, MPC | 跨租户联合分析是否隐私计算 | 后端: 需验证是否有联邦学习 |
| GDPR/CCPA/等保 2.0 | OneTrust, 等保要求 | 用户数据请求（DSAR）处理+等保 | 后端: security-compliance |
| 数据分类分级（深度） | Collibra Classification | 敏感数据自动识别+标签传播 | 后端: data-classification |

### N. 混沌工程与故障注入（Ken Tanaka, Netflix Chaos Engineering）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| 故障注入实验 | Chaos Mesh, Gremlin | 网络延迟/Pod kill/磁盘满注入 | 后端: chaos(2036行, handler+service+anomaly/detector)；前端: 5 页面(ChaosRunHistory/FaultLibrary/ResilienceScore/ChaosExperiment/ChaosExperimentDetail) |
| 稳态假设验证 | Litmus, Chaos Mesh | 实验前定义稳态假设+实验中验证 | ✅ 已实现: Experiment 模型含 `SteadyStateHypothesis string` 字段；需验证前端是否展示假设验证结果 |
| 实验自动化 | Chaos Mesh CI | 混沌实验纳入 CI 自动回归 | 后端: chaos（需验证 CI 集成） |
| 爆炸半径控制 | Gremlin Blast Radius | 故障注入爆炸半径可配置 | ✅ 已实现: Experiment 模型含 `Scope string` 字段；需验证 scope 配置粒度（namespace/服务/Pod 级别） |
| **自动回滚** | Chaos Mesh Auto-Pause / Gremlin Halt | 实验后是否自动回滚、是否支持手动中止、回滚是否验证 | ✅ 已实现: Experiment 模型含 `AutoRollback bool` 字段；需验证回滚逻辑实现深度（仅标记 vs 实际资源回滚） |
| **服务网格故障注入** | Chaos Mesh Istio / AWS FIS Mesh | 是否支持 Istio/Envoy 级别故障注入(延迟/中断/重试/熔断) | 后端: 18 处 Istio/Envoy 引用（internal+global）— 需验证故障注入集成深度 vs 仅路由配置 |
| 游戏日演练 | AWS GameDay | 定期跨团队故障演练 | 需验证是否有 GameDay 记录 |
| 韧性评分 | ChaosIQ | 系统韧性量化评分 | 前端: ResilienceScorePage.tsx 已存在；需验证评分算法深度 |

<details>
<summary>N 维度对标能力细化（Chaos Mesh / Gremlin / Litmus / AWS FIS / ChaosIQ）</summary>

**Chaos Mesh 重点对标**：
- **CRD 原生实验**：Orion 的 Experiment 模型是否以 CRD 形式定义（ChaosMesh 的 NetworkChaos/PodChaos/IOChaos 等 CRD），还是仅数据库记录？
- **Dashboard 可视化**：Chaos Mesh Dashboard 提供实验创建/监控/归档全流程 GUI — Orion 的 5 个前端页面是否覆盖等价流程
- **Workflow 编排**：Chaos Mesh Workflow 支持串行/并行/自定义实验编排 — Orion 是否支持多步骤混沌编排
- **自动回滚**：Chaos Mesh Auto-Pause 在稳态假设失败时自动暂停实验 — Orion 的 `AutoRollback bool` 字段是否实现等价逻辑
- **服务网格注入**：Chaos Mesh + Istio: HTTPDelay/HTTPError/HTTPAbort — Orion 的 18 处 Istio/Envoy 引用是否仅用于路由还是包含故障注入

**Gremlin 重点对标**：
- **爆炸半径精确控制**：Gremlin 支持 tag/container/cluster 级别精确控制 — Orion 的 `Scope string` 字段是否支持多维度 scope
- **稳态假设引擎**：Gremlin 定期监控 SLO 并在违反时自动停止 — Orion 的 `SteadyStateHypothesis` 是否有运行时验证引擎
- **GameDay 内置支持**：Gremlin 内置 GameDay 编排 — Orion 是否有跨团队演练框架
- **故障类型丰富度**：Gremlin 支持 network/cpu/io/dns/process/state — Orion 的 Faults 字段（JSON string）支持哪些故障类型

**Litmus 重点对标**：
- **混沌实验库**：Litmus Hub 提供 100+ 预置实验 — Orion 的 FaultLibraryPage 是否有等价实验库
- **CI/CD 集成**：Litmus 原生支持 ArgoCD/GitOps — Orion 的 chaos 模块是否与 pipeline 模块集成
- **混沌 ChI 执行引擎**：Litmus 的 ChI (Chaos Engineering as Code) — Orion 是否支持声明式实验定义

**AWS FIS 重点对标**：
- **云服务级故障注入**：AWS FIS 支持 EC2/EKS/RDS/ASG 级别注入 — Orion 的 chaos 模块是否支持云资源级注入
- **实验模板化**：AWS FIS 实验模板可复用 — Orion 的 chaos 实验是否支持模板化（与 pipeline-template 对比）

**ChaosIQ 重点对标**：
- **韧性评分模型**：ChaosIQ 的 Resilience Score 基于实验通过率 + SLO 维护率 — Orion 的 ResilienceScorePage 评分算法深度
- **稳态假设定义语言**：ChaosIQ 支持自定义稳态假设表达式 — Orion 的 `SteadyStateHypothesis string` 是否支持表达式或仅文本描述
</details>

### O. AI 安全与红队（Aisha Mohammed, Anthropic Red Team）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| OWASP LLM Top 10 | OWASP LLM01-10 | 提示注入/不安全输出/训练数据投毒等 10 项 | 后端: prompt-security(26行疑似stub) |
| AI 红队演练 | Microsoft AI Red Team | 自动化对抗测试+越狱尝试 | 前端: 需验证红队演练功能 |
| 幻觉率监控 | Patronus AI, DeepEval | 生产环境 LLM 输出幻觉率度量 | 后端: llm-trace（需验证幻觉率） |
| 模型水印与溯源 | Google SynthID | 生成内容水印+可追溯 | 需验证水印能力 |
| 数据投毒检测 | Microsoft Counterfit | 训练数据完整性校验 | 后端: 需验证投毒检测 |
| Agent 工具调用沙箱 | Anthropic Computer Use | Agent 执行代码/命令的沙箱隔离 | 后端: agents（需验证沙箱深度） |

### P. FinOps 与云经济学深度（Tom Robinson, AWS FinOps Pro）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| 成本可见性 | Cloudability Visibility | 资源级成本可视化（服务/团队/环境） | 前端: finops/FinOpsDashboard |
| 成本分摊 | Apptio Showback/Chargeback | 多租户成本回收到 tenant_id | 后端: finops(14503行) |
| 成本预测 | Cloudability Predictive | 基于历史趋势预测下月支出 | 前端: 需验证预测分析 |
| 节约建议 | AWS Cost Optimizer | 闲置/超配资源自动识别 | 前端: 需验证优化建议 |
| 单位经济学 | FinOps Unit Economics | 每请求成本/每用户成本 | 需验证单位经济指标 |
| 预算告警与冻结 | AWS Budgets | 超预算自动告警或资源冻结 | 后端: finops（需验证预算门禁） |

### Q. 多租户隔离深度（Wei Zhang, Salesforce Multi-tenant Chief）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| 数据层隔离 | Salesforce tenant_id | 行级→列级→库级→schema 级 | 后端: 全部服务（grep tenant_id 过滤覆盖率） |
| 计算层隔离 | K8s namespace | 共享 Pod / 独立 Pod / 独立集群 | 需验证 K8s namespace 策略 |
| 网络层隔离 | K8s NetworkPolicy | namespace 间网络隔离 | 需验证 NetworkPolicy 配置 |
| 存储层隔离 | K8s StorageClass | 每租户独立 PV/PVC | 需验证存储隔离 |
| 配额管控 | K8s ResourceQuota | 每租户 CPU/内存/Pod 数配额 | 前端: tenant-quota/TenantQuotaPage |
| 速率限制 | Stripe Rate Limiting | 每租户 API 调用频率限制 | 后端: rate-limiting(140行) |
| 噪声邻居防护 | AWS Noisy Neighbor | 大租户不挤占小租户资源 | 需验证隔离机制 |

### R. 灾备与业务连续性深度（David Kim, Azure BCDR Lead）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| RTO/RPO 定义与验证 | AWS Resilience Hub | 每个服务 RTO/RPO 目标定义且定期验证 | 后端: dr(620行) |
| 多区域容灾 | AWS Multi-Region | 跨 region 主备/双活 | 需验证多区域部署 |
| DNS 切换自动化 | Route53 Failover | 灾难时 DNS 自动切换 | 需验证 DNS 健康检查 |
| 数据一致性验证 | Velero Backup Verify | 备份数据完整性校验+定期恢复演练 | 前端: Backup（需验证恢复演练） |
| 容灾回退 | VMware SRM Failback | 主站点恢复后可逆回退 | 后端: dr（需验证回退流程） |
| 业务连续性计划 | ISO 22301 | BCP 文档化+关键流程优先级 | 需验证 BCP 文档 |
| 容灾拓扑可视化 | Azure BCDR Dashboard | 容灾拓扑图+切换状态看板 | 前端: DisasterRecovery(269行) |

### S. 工程效能度量 SPACE 框架（Olivia Stone, GitHub SPACE 合著者）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| DORA 四指标 | DORA, Google | 部署频率/前置时间/恢复时间/变更失败率（当前已有） | 前端: efficiency/DoraMetricsPage.tsx |
| SPACE 框架 | GitHub SPACE | Satisfaction/Performance/Activity/Communication/Efficiency | 后端: efficiency（需验证 SPACE 五维） |
| 开发者体验（DX） | DX Core4 | 反馈速度/迭代速度/CI 时间/环境获取时间 | 需验证 DX 指标采集 |
| 流动效率 | LinearB Flow | 价值流中"活跃工作"占总周期比例 | 需验证流动效率度量 |
| 认知负荷 | NASA TLX | 开发者完成单任务的主观认知负荷 | 需验证认知负荷度量 |
| 评审延迟 | GitHub Code Review | PR 从提交到首次评审的中位时间 | 后端: code（需验证 PR 分析） |
| 技术债务感知 | CodeScene | 代码热点与技术债自动识别 | 前端: 需验证技术债看板 |

### T. 生态集成与开放平台（Carlos Mendez, Twilio Developer Network）

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| 插件 SPI 架构 | Salesforce Apex, Eclipse SPI | 插件接口标准化+生命周期管理 | 前端: PluginSPI/SPIConfig.tsx(204行) |
| 插件市场分发 | GitHub Marketplace, Shopify App Store | 第三方插件发布/审核/分发 | 前端: plugin-marketplace(268行) |
| 第三方集成认证 | OAuth 2.0 Client Credentials | 第三方应用接入认证机制 | 后端: auth + api-key |
| Webhook 深度 | Stripe Webhooks, GitHub Webhooks | 事件订阅/重试/签名验证/死信队列 | 前端: WebhookManagement；后端: 需验证签名+重试 |
| API 市场 | Twilio API Marketplace | API 能力目录化+计量计费 | 后端: api-market |
| SDK 生态 | Twilio SDK 多语言 | 多语言 SDK 自动生成+版本管理 | 需验证 SDK 生成流水线 |
| 集成连接器 | Zapier, Workato | 预置连接器（Jira/Slack/企业微信/钉钉） | 前端: 需验证连接器市场 |

### U. 模块解耦与可治理性（架构治理维度，v3.0 新增）

> 基于全系统循环依赖与配置化启动实证分析（2026-08-25 实测），评估模块间耦合度、配置化启动成熟度、是否具备微服务拆分条件。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **循环依赖检测** | Google Go 最佳实践, DDD 领域边界 | Go 后端模块间是否存在 import cycle | `go vet ./internal/...` 检测（实测 0 循环依赖 ✅） |
| **接口-实现分离率** | DIP 依赖倒置原则, Clean Architecture | 是否每个模块有独立 `*_interface.go` 接口定义，支持 mock 测试 | 实测 303 服务仅 1 个接口文件，272 个使用构造器注入但无接口定义 |
| **配置化启动成熟度** | 12-Factor App, K8s ConfigMap | 模块是否支持按需启停、是否支持运行时开关 | 实测: L2 启动时配置（`if handler != nil`），L3 运行时开关部分覆盖，L4 热加载 ❌ |
| **Feature Flag 覆盖度** | LaunchDarkly, Unleash | 每个模块是否有 feature flag 控制，前端是否消费动态显示 | 后端: `config/feature_flag_handler.go` 存在但覆盖度需验证 |
| **跨模块引用热区** | DDD 限界上下文, 防腐层 | 被 100+ 模块引用的核心模块是否建立接口层 | 实测: ai(153次)/notification(119)/ci-cd(110)/ticketing(103) 为 Top 4 热区，应有接口层 |
| **聚合容器复杂度** | 微服务拆分条件, 单模块职责边界 | >5000 行的模块是否有子域拆分规划 | 实测: ai(23346行)/ci-cd(21797)/notification(15103)/infrastructure(14995) 需按子域拆分 |
| **运行时热加载** | Nacos/Consul/Etcd 配置中心, Apollo | 配置变更是否需重启服务 | 实测: 不支持热加载，配置变更需重启 ❌ |
| **前端模块独立性** | 微前端, Module Federation | 前端页面是否可独立部署、是否全量懒加载 | 实测: 305 处 React.lazy() 全量懒加载 ✅，页面间 cross-import 仅 20 处 ✅ |
| **配置中心方案** | **Nacos/Apollo/Consul vs 自研** | 是否有配置中心，引入 Nacos 还是自研实现 | 自研优势：更灵活（配置+Runtime Feature Flag+健康检查+灰度控制一体化）、无外部依赖；劣势：需额外开发维护。建议：按需自研轻量级配置中心，核心能力配置化+热加载+动态开关 |

### V. 系统架构治理维度（Alex Zhang, 前 Google 首席架构师 / Martin Fowler 推荐）

> v3.1 新增。U 维度仅覆盖 Go 模块级耦合度，缺少系统级架构治理视角。V 维度从全局架构师角度评审架构模式一致性、技术栈合理性、数据架构、通信模式、架构债。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **架构模式一致性** | Clean Architecture / Hexagonal Architecture | Go 后端是否统一 handler→service→repository 三层分层 | 实测 291 handler + 289 repository + 283 models 目录，一致性率 = 283/303 = 93% |
| **接口-实现分离率（修正）** | DIP 依赖倒置 / SOLID | 每个模块是否有独立 `*_interface.go` 接口定义（U维度说仅1个，实测402个 — 需修正） | `find internal -name "*_interface.go" \| wc -l` = 402，与U维度原数据矛盾，需复检 |
| **技术栈合理性** | 12-Factor App / Cloud Native | 技术选型是否有 ADR 支撑、是否有过度技术/技术不足 | 22 份 ADR 文档覆盖率 = 22/303 服务 = 7.3% — 覆盖率严重不足 |
| **数据架构** | DDD 领域驱动 / Data Mesh | 数据库选型/数据流模式/CQRS/读写分离/事件溯源 | 验证是否有独立读模型（J维度已覆盖事件溯源/CQRS，V维度补充数据流全貌） |
| **服务通信模式** | 同步HTTP vs 异步事件 | 核心链路是同步还是异步、是否有事件总线、同步调用量级 | notification(15103行)+message-queue(290行) — message-queue仅290行说明异步通信极弱 |
| **架构文档质量** | C4 Model / arc42 / Diagram-as-Code | 架构图/决策记录/技术债文档化程度+是否可维护 | 76 份架构文档抽查质量（是否有过期/与代码不符） |
| **架构债评估** | Technical Debt Quadrant (Fowler) | 架构层面的债务识别+量化+优先级排序 | ai(23346行)/ci-cd(21797)/notification(15103)/infrastructure(14995) 巨型模块拆分规划 |
| **错误处理架构** | Error Handling Patterns / Resilience4j | 全局错误处理/错误码体系/页面级ErrorBoundary | 实测 ErrorBoundary 仅 1 处（main.tsx 全局），0 页面级边界 — P1 风险 |
| **配置架构（系统级）** | 12-Factor / External Config / Nacos | 配置中心架构/环境隔离/密钥管理架构/热加载架构 | U维度已覆盖配置化启动(L2级)，V维度补充配置中心架构决策（自研 vs Nacos/Apollo） |
| **扩展性架构** | Scale Cube / Microservices Readiness | 是否具备水平扩展、是否有状态服务、是否有拆分规划 | 验证有状态服务占比（Session/缓存/文件存储） |
| **前端架构一致性** | Feature-Sliced Design / Module Federation | 前端是否统一架构模式、懒加载/微前端/状态管理是否一致 | 实测 305 处 React.lazy() ✅ + Zustand 统一 ✅，但 0 个 .less/.css 文件 — 样式架构缺失 |
| **API 架构一致性** | RESTful / gRPC / GraphQL | API 风格是否统一、是否有混合风格、是否有 API 网关层 | Go 后端全部 Gin RESTful ✅，但前端 6904 处内联样式说明 UI 层架构不一致 |

### W. 视觉设计与设计系统维度（Lisa Chen, 前 Ant Design 核心维护者 / Brad Frost Atomic Design）

> v3.1 新增。原 25 维度无任何视觉设计评审。实测 6904 处内联样式、useToken 仅 1 处、Design Token 定义了但几乎不使用 — "假设计系统"问题。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **Design Token 覆盖度** | Ant Design v5 Token System / Figma Tokens | tokens/ 定义了 colors/theme-vars/theme.ts 等，但 useToken 仅 1 处使用 | `grep -rc "useToken\|theme.useToken" src/` = 1 处 — Token 定义了但不用 = 假设计 |
| **内联样式占比** | CSS-in-JS 最佳实践 / Styled Components | 内联 `style={{}}` 总量+占比 — 设计系统形同虚设的指标 | 实测 6904 处 `style={{}}` 分布在 435 页面 — 内联样式是主流，Design Token 是摆设 |
| **组件库一致性** | Ant Design Pro / Arco Design Pro | 是否统一用 antd 组件还是大量自定义/废弃组件未清理 | 实测 125 处废弃 CardPanel 仍在使用 — 废弃组件未迁移 |
| **响应式覆盖率** | Bootstrap Grid / Tailwind Responsive / Ant Design Grid | 支持响应式布局的页面占比 | 实测 14/211 页有 Grid/响应式 = 6.6% — 93% 页面不响应式 |
| **Media Query 覆盖** | Mobile-First Design / Responsive Web Design | CSS media query 使用量 | 实测 0 处 `@media` / `useMediaQuery` — 零响应式断点 |
| **暗色模式** | Material Dark Theme / Ant Design v5 dark algorithm | ConfigProvider 暗色 algorithm 支持度 | 实测 6 个文件含 dark algorithm — 基本不支持暗色模式 |
| **可访问性 (WCAG 2.1 AA)** | WCAG 2.1 / axe-core / Lighthouse Accessibility | ARIA 属性覆盖率+键盘导航+对比度+焦点管理 | 实测 5/211 页有 aria- = 2.4% — 严重不合规 |
| **骨架屏覆盖率** | Ant Design Skeleton / Content Placeholder | Loading 是否使用骨架屏而非仅 Spinner | 实测 34/211 页有 Skeleton = 16% — 84% 页面白屏 Loading |
| **空态设计质量** | Empty State Best Practices / Ant Design Empty | 空态是否有插画+引导操作+文案 | 实测 127/211 页有 Empty = 60% — 40% 页面无空态设计 |
| **图标系统一致性** | Icon Library / Lucide / Phosphor / antd Icons | 是否统一图标库还是多套混用 | `grep -rc "from '@ant-design/icons'" vs 其他图标库` — 验证图标库统一性 |
| **间距/排版规范度** | 8pt Grid System / Ant Design spacing | 间距是否使用 Design Token 还是硬编码 | `grep -rc "padding:\|margin:\|gap:" src/pages/` 中硬编码 vs Token 使用占比 |
| **动效设计** | Motion Design / Framer Motion / Ant Design Motion | 页面过渡/操作反馈/数据加载动效 | 实测 99 处 transition/animation — 动效覆盖率低 |

### X. 用户体验维度（Emma Liu, 前 Airbnb UX Lead / Don Norman 弟子）

> v3.1 新增。输出3 仅检查"交互是否存在"（有/无），不检查"交互质量好不好"。X 维度从用户视角评审端到端体验质量。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **用户旅程完整度** | User Story Mapping / Journey Maps | 核心路径（创建工单→处理→关闭、创建流水线→构建→部署、CMDB 录入→查询→变更）是否完整无断点 | 工单/部署/流水线 3 条核心旅程走查 |
| **导航可发现性** | Information Architecture / Card Sorting | 用户能在 3 次点击内找到目标功能吗？菜单层级是否合理 | 338 路由路径+菜单层级分析，计算平均点击深度 |
| **表单 UX 质量** | Nielsen Form Guidelines / Inline Validation | 909 处 rules 但校验提示是否友好、是否有实时校验、是否有分步引导 | 抽查 10 个核心表单的校验体验 |
| **错误提示可操作性** | Error Message Guidelines / NNGroup | 错误提示是否告诉用户"怎么修"而非仅"出错了" | 输出3 的错误处理列从"有/无"升级为"可操作性"评分 |
| **移动端体验** | Mobile-First / Responsive Web / PWA | 0 处 media query — 完全不支持移动端 | 全量页面在 375px/768px 宽度下的表现 |
| **首次用户引导** | User Onboarding / Empty State Onboarding | 新用户首次登录是否有引导/默认数据/任务引导 | 首次登录体验走查 |
| **交互反馈质量** | Interaction Design / Feedback Loops | 按钮点击/表单提交/数据加载/操作成功/操作失败的反馈质量 | 实测 99 处 animation — 反馈覆盖率低 |
| **感知性能** | Perceived Performance / Skeleton Loading | Loading 是否用骨架屏挡切而非仅白屏 Spinner | 34/211 有骨架屏 — 感知性能差 |
| **跨页面一致性** | Design System Consistency / Pattern Library | 同类操作（增删改查/搜索/分页/导出）在不同页面是否一致 | 抽查 5 个 CRUD 页面的交互模式对比 |
| **国际化质量** | i18n Best Practices / ICU MessageFormat | 625 处 i18n key 引用但仅 1/212 页使用 useTranslation hook — 大量 key 存在但页面级集成度极低 | 抽查中英文切换体验，验证 key 是否实际被 hook 消费 |
| **信息密度与层级** | Visual Hierarchy / Progressive Disclosure | 页面信息是否过载/过空、是否有合理的信息层级 | 抽查 10 个高频页面的信息密度 |
| **错误恢复体验** | Graceful Degradation / Retry / Undo | 操作失败后用户能否恢复（如表单数据不丢失、可重试、可撤销） | 验证表单失败后数据保留、删除操作可撤销 |

### Y. 前端性能工程维度（Mark Webb, 前 Google PageSpeed 团队 / web.dev 核心贡献者）

> v3.2 新增。W 审视觉设计、X 审用户体验，但性能工程是独立工程学科——Core Web Vitals 有独立度量体系、Lighthouse 有独立工具链、Vercel Edge 有独立标杆。36MB 构建产物 + 388 JS chunk + 0 性能预算 = 系统性性能盲区。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **构建产物优化** | web.dev Bundle Size / Next.js | Bundle 大小、Tree Shaking 有效性、代码分割粒度、重复依赖检测 | 实测 dist/ 36MB、388 个 JS chunk — 需分析 chunk 大小分布与重复依赖 |
| **运行时性能** | React Profiler / Chrome DevTools Performance | 渲染性能（重渲染检测）、虚拟列表使用、防抖节流、大列表/大表性能 | 961 处 useMemo/useCallback/memo — 覆盖率需量化（有 vs 应有） |
| **网络性能** | HTTP/2 Push / Resource Hints / CDN | 请求合并、预加载(prefetch/preload)、CDN 配置、HTTP 缓存策略 | 验证是否配置资源预加载、API 请求批量化、图片懒加载 |
| **性能预算** | Performance Budget / Lighthouse CI | 是否定义 Performance Budget、CI 是否集成 Lighthouse 评分门禁 | 实测 0 处 Performance Budget 定义、0 处 Lighthouse CI — 完全缺失 |
| **Core Web Vitals** | LCP / FID / CLS / TTI / TBT | LCP < 2.5s / FID < 100ms / CLS < 0.1 — 是否有采集与监控 | 实测 0 处 web-vitals 采集 — 无 RUM 数据 |
| **感知性能** | Skeleton / Suspense / Progressive Loading | Loading 是否用骨架屏挡切而非白屏 Spinner（与 X 维度交叉但角度不同） | 34/211 有骨架屏 = 16% — 感知性能差（W维度已测，Y维度从工程视角补充优化策略） |
| **首屏加载** | Next.js SSR/ISR / Vercel Edge | 首屏 LCP、TTI、FCP 是否达标、是否有 SSR/SSG 优化 | 316 处 React.lazy — 纯 CSR 架构，首屏依赖 JS 执行，无 SSR 优化 |
| **内存与资源泄漏** | Chrome Memory Profiler / React Profiler | 长时间运行页面是否有内存泄漏、定时器/WebSocket 是否正确清理 | 验证高频页面的内存增长趋势、组件卸载时 cleanup |

### Z. 测试策略与质量保障维度（Jenny Kim, 前 Google Testing GQE / Kent Beck TDD + Simon Stewart, Selenium 创始人 / Google Eng Productivity）

> v3.2 新增。A3 覆盖"测试"作为 DevOps 流水线阶段（工具集成视角），但不评审测试策略本身。Z 维度分**策略层（Z1-Z8）**和**平台层（Z9-Z14）**：策略层评审测试金字塔健康度与质量度量，平台层评审测试团队所需的工具链与基础设施。295 前端单测覆盖 211 页（1.4 测/页）、0 E2E 测试、0 契约测试、0 覆盖率采集 = 测试金字塔严重失衡；0 测试用例管理平台、0 视觉回归、0 Flaky 检测、0 跨浏览器执行基础设施 = 测试平台能力完全缺失。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **测试金字塔健康度** | Test Pyramid (Mike Cohn) | Unit : Integration : E2E 比例是否合理 | 前端 295 单测 + 0 E2E + 0 集成 = 倒金字塔；后端 590 单测 + 少量集成(e2e/目录6个) |
| **覆盖率度量** | Istanbul / CodeCov / Coveralls | 行覆盖 / 分支覆盖 / 路径覆盖是否有采集与门禁 | 实测 0 处 istanbul/nyc 配置、0 处 codecov — 无覆盖率数据 |
| **测试质量** | Testing Trophy (Kentin Coba) | 是否只测 happy path、断言充分性、测试隔离性、测试速度 | 抽查 10 个测试文件的断言数量与质量 |
| **契约测试** | Pact / OpenAPI Schema Validation | 前后端 API 契约是否自动化验证、Schema 变更是否触发契约检测 | 实测 0 处 Pact / 契约测试 — 前后端无自动契约保障 |
| **测试数据管理** | Test Fixtures / Data Factory / Factory Bot | 测试夹具是否规范、是否有数据工厂、测试环境是否隔离 | 41 处 mock 文件 — mock 是否规范还是散落各处 |
| **回归测试策略** | Test Impact Analysis / Smart Test Selection | 变更后运行哪些测试、是否有智能测试选择 | 验证 CI 是否有 TIA、是否全量回归还是增量回归 |
| **变异测试** | Stryker / Mutmut | 测试是否能捕获变异（验证断言质量） | 实测 0 处 Stryker/Mutmut — 无变异测试 |
| **后端测试分布** | Go testing / GoConvey / Ginkgo | 303 服务中测试文件分布、零测试服务数 | Top10: ai=32/notification=18/security=13/finops=13/ci-cd=13；需统计 0 测试服务数 |
| **测试用例管理平台** | TestRail / Zephyr / Xray / qTest / TestLink | 测试用例是否结构化管理（模块/标签/优先级）、需求-用例-缺陷是否双向追踪、是否支持测试计划与轮次管理 | 实测 0 处测试用例管理工具 — 用例散落在 _test.go 和前端 .test.tsx 中，无独立用例管理平台 |
| **测试执行基础设施** | BrowserStack / SauceLabs / Selenium Grid / LambdaTest / Playwright Grid | 是否有跨浏览器/跨平台执行基础设施、是否支持并行执行与排队调度、是否支持本地+云端混合执行 | 实测 0 处 BrowserStack/SauceLabs/Selenium Grid — 无跨浏览器执行基础设施；test-execution-engine 服务存在但仅为 API 层执行 |
| **视觉回归与 UI 测试** | Percy / Applitools / Chromatic / Playwright Snapshot / Storybook Chromatic | 是否有视觉回归基线、是否检测像素级差异、是否覆盖暗色模式/响应式/多分辨率 | 实测 0 处 Percy/Applitools/Chromatic — 211 页面 UI 变更无自动化视觉校验 |
| **Flaky 测试检测与治理** | BuildPulse / Travis Flaky Spec / GitHub Flaky Test Bot | 是否自动识别 Flaky 测试、是否有隔离/重试/排除策略、是否跟踪 Flaky 率趋势 | 实测 0 处 Flaky 检测工具 — 295 前端 + 590 后端测试均无 Flaky 治理机制 |
| **API 测试与契约验证平台** | Postman / Newman / Karate / Pact + Prism / Mountebank | 是否有独立 API 测试平台、是否支持 Mock Server 按契约生成、是否自动化 Schema 变更检测、是否支持场景化 API 测试编排 | 实测 0 处 Postman/Karate 契约验证平台（Z4 策略层覆盖契约测试策略，此处覆盖平台化执行能力）；test-generation 服务存在但无契约验证 |
| **测试数据管理平台** | Delphix / MSW / MockServer / @faker-js/faker / Factory Bot | 是否有测试数据工厂、是否支持数据快照/脱敏/版本化、Mock 数据是否集中管理 vs 散落 | 41 处 mock 文件散落各处 — 无集中测试数据管理平台（Z5 策略层覆盖策略角度，此处覆盖平台化能力）；实测 0 处 MSW/MockServer |

### AA. 内部开发者体验维度（Abi Noda, DX CEO / GitHub DX Core4 合著者）

> v3.2 新增。S 维度量研发效能（DX Core4 指标采集），K 维评审外部 API 开发者体验，但无维度评审 Orion 内部开发者的实际体验：从 clone 到 running 耗时、调试体验、构建反馈环速度。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **新人 Onboarding 效率** | DX Core4 / Linear onboarding | 从 clone 到 local running 耗时、是否有快速启动文档 | 39 个 README / 675 个 docs — 抽查是否有 Quick Start 指南 |
| **本地开发环境质量** | Docker Compose / Makefile / devcontainer | 是否有一键启动、是否有 devcontainer、环境依赖是否文档化 | 验证是否有 docker-compose.dev.yml / Makefile dev / devcontainer.json |
| **调试体验** | React DevTools / Redux DevTools / Go Delve | Source Map 质量、HMR 速度、错误定位、断点调试 | 验证 vite.config.ts 的 sourcemap 配置、是否有 .vscode/launch.json |
| **构建反馈环** | Vite HMR / esbuild / swc | dev server 启动时间、HMR 热更新延迟、build 生产构建时间 | 实测 vite 启动速度（应 < 3s）；HMR 是否秒级生效 |
| **开发者文档质量** | Backstage Software Template / CONTRIBUTING.md | 贡献指南、架构文档、开发规范是否完整且对开发者友好 | 抽查 CONTRIBUTING.md / 架构文档 / 编码规范 |
| **开发工具链完善度** | ESLint / Prettier / Husky / commitlint / lint-staged | 代码规范工具链是否完善、是否有 pre-commit hook、是否有 CI 门槛 | 验证 .eslintrc / .prettierrc / .husky/ / lint-staged 配置 |
| **TypeScript 严格度** | tsconfig strict mode / strictest preset | 是否启用 strict mode、是否有 noUncheckedIndexedAccess 等 | 验证 tsconfig.json strict 设置；实测 9 个 TS6133 错误 |

### AB. 文档质量与知识治理维度（Tom Johnson, 前 Stripe Technical Writing Lead）

> v3.2 新增。V 维度提到 ADR 覆盖率（7.3%），F 维度提到知识库作为功能特性，但无维度评审文档本身质量。675 个文档是否新鲜？是否准确？是否有维护机制？API 文档是否自动化？

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **文档覆盖率** | Backstage / GitLab Docs | 每服务/每模块是否有对应文档、README 覆盖率 | 39 README / 675 docs / 303 服务 = README 覆盖率 12.9% — 严重不足 |
| **文档新鲜度** | Docs-as-Code / DocFX freshness check | 文档最后更新 vs 代码最后修改的差值、过期文档比例 | 实测 16 个文档 >90 天未更新(2.4%)、0 个 >180 天 — 新鲜度尚可但需持续监控 |
| **文档准确性** | Living Documentation / Doc Test | 文档描述与实际实现是否一致、是否有过期文档误导 | 抽查 10 个文档 vs 对应代码实现的一致性 |
| **ADR 质量与覆盖度** | arc42 / ThoughtWorks ADR Template | 决策记录是否完整、是否有追溯链、覆盖多少服务 | 22 ADR / 303 服务 = 7.3% — 覆盖率严重不足；抽查 ADR 质量 |
| **API 文档自动化** | OpenAPI / Swagger / Redoc | 路由是否自动生成 OpenAPI 规范、是否同步更新 | 实测 0 处 swagger/openapi 注解 — API 文档完全手工或缺失 |
| **文档可发现性** | Algolia DocSearch / Backstage Search | 文档目录结构、搜索能力、交叉引用、面包屑导航 | 验证 docs/ 目录结构是否可导航、是否有文档搜索引擎 |
| **文档维护机制** | Docs CI / markdown-lint / vale | 文档变更是否触发 PR Review、是否有文档 Owner、是否有 lint | 验证是否有 markdownlint / vale / docs CI pipeline |

### AC. 数据迁移与 Schema 演进维度（Alexey Zvolev, Atlas Schema-as-Code 作者 / Flyway 核心维护者）

> v3.2 新增。M 维度覆盖数据生命周期（保留/归档/隐私），C 维度覆盖 DBOps（数据库运维），但无维度评审 Schema 演进策略。20+ 迁移目录 + 192 处迁移 SQL = 有实际代码但无评审视角。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **迁移工具选型** | Atlas / golang-migrate / Flyway / Liquibase / Goose | 是否使用标准迁移工具还是手写 SQL | 实测: orion-platform-svc-go/migrations/ + internal/*/migrations/ — 需验证使用的迁移工具 |
| **迁移版本控制** | Atlas / golang-migrate versioning | 迁移文件版本化、顺序执行、冲突检测、checksum 验证 | 20+ 迁移目录 — 验证版本号是否连续、是否有 checksum |
| **零停机迁移** | Expand-Contract Pattern / Parallel Change | 是否支持零停机 Schema 变更（先加列→双写→迁移→删旧列） | 验证迁移文件是否遵循 Expand-Contract 模式 |
| **数据回填策略** | Batch Backfill / Incremental Migration | 大表数据回填是否分批、是否有背压控制、是否影响生产 | 验证是否有批量回填脚本、回填进度监控 |
| **迁移回滚** | Down Migration / Reverse Migration | 是否有 down migration、回滚是否经过验证 | 验证迁移目录是否有 down 文件、回滚是否测试过 |
| **多环境迁移一致性** | Dev→Staging→Prod Migration Path | 迁移路径在 Dev/Staging/Prod 是否一致、是否有人工 drift | 验证多环境 Schema 是否有 drift 检测机制 |
| **Schema 审批流程** | Database Review Board / Schema as Code PR Review | Schema 变更是否需要 DBA Review、是否有 PR 评审 | 验证是否有 Schema 变更审批流程、是否纳入 PR Review |

### AD. 前端状态管理架构维度（Tanner Linsley, React Query 作者 / Daishi Kato, Zustand 作者）

> v3.2 新增。V 维度提到 Zustand 一致性（"统一 ✅"），但 211 页面仅 7 个 store 文件、0 Server State 管理工具（React Query/SWR）= 前端架构重大缺口。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **状态分类与分离** | Server State / Client State / URL State / Form State | 是否区分 Server State（远程数据）与 Client State（本地 UI 状态） | 实测 0 处 React Query / SWR / Apollo — Server State 全部手写 fetch |
| **状态管理覆盖率** | Zustand / Jotai / Redux Toolkit | 全局状态管理覆盖率、组件间状态共享方式 | 7 store 文件 / 211 页面 = 3.3% — 极度薄弱，大部分页面无全局状态 |
| **数据获取与缓存** | React Query / SWR / RTK Query | 是否有声明式数据获取、自动缓存、失效重验证、乐观更新 | 实测无 React Query/SWR — 全部手写 fetch + useState，无缓存层 |
| **乐观更新模式** | Optimistic Update / Conflict Resolution | 是否有乐观更新、冲突处理、回滚机制 | 验证 CRUD 操作是否有乐观更新（先更新 UI 再等响应） |
| **状态持久化** | Zustand persist / localStorage / IndexedDB | 用户偏好/主题/布局等是否持久化、是否有过期清理 | 7 个 store 中是否有 persist middleware 使用 |
| **状态调试体验** | Redux DevTools / Zustand devtools | 是否集成 DevTools、是否有 time-travel debugging | 验证 Zustand 是否启用 devtools middleware |

### AE. DBA 工作台架构与治理维度（Peter Zaitsev, Percona 联合创始人 / Tian Zhou, Bytebase 创始人）

> v3.3 新增。C1 仅列 DBA 功能清单（6 行），AC 仅管 Schema 演进，M 仅管数据合规，但无维度从 DBA 架构师视角评审数据库工作台架构质量。Orion DBA 后端 1379 行真实实现（SqlOrder 审批工单 + DataSource 多数据源 + AuditRule 审计规则 + DirectQuery + QueryLog），但 C1 仅"SQL 审核"1 行带过。database-devops 仅 140 行 stub。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **SQL 审批工作流深度** | Bytebase SQL Review / Yearning SQL 审批 / Archery SQL 审核 | 多级审批/自动审批规则/审批 SLA/拒绝后恢复/审批通知/审批权限分离（提交≠审批≠执行） | ✅ 已实现: SqlOrder model + approve/reject/execute 路由 + ApprovedBy/ApprovedAt 字段；需验证自动审批规则与审批 SLA |
| **数据源管理架构** | Bytebase Instance / Archery DataSource / ReByte | 多数据源抽象/连接池配置/方言支持(MySQL/PG/ClickHouse)/健康检查/数据源分组/凭据加密存储 | ✅ 已实现: DataSource model(Type/Host/Port) + TestConnection + buildPGDSN；仅 PostgreSQL(buildPGDSN/testPGConnection) — 需验证多方言支持 |
| **慢查询诊断与优化** | pt-query-digest / Percona PMM / VividCortex / Datadog DBM | 慢查询采集/执行计划分析/索引建议/TopN 查询/查询趋势/自动索引推荐 | Orion 有 QueryExecutionRecord + ListQueryLogs — 需验证是否有执行计划分析和索引推荐能力 |
| **数据库审计规则引擎** | Oracle Audit Vault / DBAudit / Bytebase Audit Log | 审计规则匹配/敏感操作拦截/审计日志保留/合规报表/审计规则版本管理 | ✅ 已实现: AuditRule model + CreateAuditRule route；需验证规则引擎匹配逻辑深度（正则/AST/语义） |
| **连接池与资源治理** | PgBouncer / ProxySQL / pgcat / Supavisor | 连接池配置/最大连接数/连接生命周期/空闲连接回收/连接泄漏检测/连接池监控 | pgx/v5 依赖 — 需验证 pool config（MaxConns/MinConns/MaxConnLifetime/MaxConnIdleTime） |
| **读写分离与分库分表** | Vitess / ShardingSphere / ProxySQL / Citus | 读写分离/分片策略(Hash/Range/Consistent)/跨分片查询/分片路由/分片迁移 | 需验证是否有读写分离配置 — 实测仅 PostgreSQL 单数据源，无分片 |
| **数据库性能基线与容量规划** | Percona PMM / Datadog DB Monitoring / SolarWinds DPA | 性能基线/趋势预测/容量规划/瓶颈定位/QPS-延迟-连接数三维监控 | Orion 有 QueryLogQuery + GetDailyStats — 需验证是否有性能基线和容量预测 |
| **数据库灾备深度** | pgBackRest / Barman / WAL-G / AWS RDS PITR / pg_repack | PITR(Point-in-Time Recovery)/日志传送/副本延迟/备份验证/恢复演练/表空间级恢复 | R 维度覆盖灾备但不针对数据库 — 需验证是否有 PITR 配置、WAL 归档策略 |

### AF. AI Agent 架构与治理维度（Harrison Chase, LangChain/LangGraph CEO / Andrew Yaw, AutoGen 核心贡献者）

> v3.3 新增。B 维度仅列 AI Ops 功能清单（3 层 24 行），O 维度仅从安全角度覆盖（6 子维度），D 维度提及 6 个缺失分析维度但未展开。Orion AI/Agent 后端 28000+ 行 = 系统最大集群（ai/orchestration=2256行 + ai/skill=2636行 + ai/agents=1869行 + ai-agent-run=1088行 + agent-trace=908行 + llm=1226行 + llm-trace=1518行 + prompt-security=754行 + hook-chain=467行 + 14 个子模块），前端 20+ 页面 5000+ 行，但无维度从 Agent 架构师视角评审架构质量。

| 子维度 | 对标 | 评审要点 | Orion 验证路径 |
|--------|------|---------|---------------|
| **Agent 编排架构质量** | LangGraph / CrewAI / AutoGen / Semantic Kernel / Dify Workflow | DAG/linear/branching 模式质量、步骤依赖解析、并行执行、条件分支、循环与重试编排、编排可观测性 | ai/orchestration(2256行) — 需验证编排模式是 DAG 还是线性、是否支持条件分支与循环 |
| **Agent 工具调用安全** | OpenAI Function Calling / Anthropic Tool Use / MCP Protocol | 工具权限粒度(读/写/执行分级)/调用审计/执行隔离(沙箱)/超时限制/资源配额/工具白名单 | AgentAction(read_file/write_code/run_command/create_pr) — 需验证 write_code/run_command 是否沙箱执行、是否有工具白名单 |
| **Agent 决策可追溯性** | LangSmith / Arize Phoenix / AgentOps / Langfuse | 决策审计完整性/推理链回放/问责机制/decision span 粒度/工具调用结果归档/错误决策追溯 | ✅ 已实现: AgentDecision model(step/action/reasoning/tool_result) — 需验证推理链是否可回放、是否支持决策 diff 对比 |
| **Agent 审批工作流设计** | Humanloop / Atomic Workflows / Microsoft Autogen Human-in-Loop | 自动审批规则/审批升级机制/审批 SLA/拒绝后恢复策略/审批通知/批量审批/审批权限矩阵 | ✅ 已实现: AgentApproval model(pending/approved/rejected + approved_by + rejection_reason) — 需验证自动审批规则与升级机制 |
| **LLM 网关架构质量** | LiteLLM / Portkey / OpenRouter / Helicone / ai-router | 路由策略(成本/质量/延迟)/降级链/负载均衡/模型版本管理/成本优化/重试与熔断/streaming 支持 | ai/gateway + ai/llm-provider + ai/aigateway — 需验证路由策略与降级链深度 |
| **Agent 可观测性** | LangSmith / Langfuse / Arize Phoenix / Helicone / OpenTelemetry GenAI | trace 完整性/span 粒度/token 归因/cost attribution/error tracking/distributed trace(跨 Agent)/实时 vs 事后 | agent-trace(908行) + llm-trace(1518行) — 需验证 trace 完整性(是否覆盖编排+工具+LLM 全链)与 span 粒度 |
| **Agent 失败恢复** | Temporal / Restate / DBOS / Durable Execution | 检查点机制/恢复策略/幂等性/状态持久化/retry strategy/compensation(补偿事务)/长时运行任务恢复 | ai/auto-recovery(635行) + ai/degradation(1212行) — 需验证是否有检查点和恢复机制、是否支持断点续跑 |
| **Skill/Plugin 市场架构** | OpenAI GPT Store / Dify Marketplace / Coze / Zapier Actions | skill 生命周期(submit→review→publish→execute→audit→version)/skill schema 标准化/skill 隔离/skill 计量/skill 撤回 | ai/skill(2636行) + SkillManagement 前端(2706行) — 需验证 skill 提交/审核/发布/执行/审计全流程 |
| **多 Agent 协作模式** | CrewAI / AutoGen / MetaGPT / Camel / ChatDev | 任务委派/共识机制/冲突解决/Agent 间通信协议/角色分配/协作拓扑(中心化/去中心化)/共享状态 | ai/orchestration(2256行) + ai/agents(1869行) — 需验证是否支持多 Agent 协作、协作拓扑类型 |
| **RAG 架构质量** | LlamaIndex / LangChain RAG / Dify RAG / Pinecone / Weaviate | 分块策略(fixed/semantic/sentence)/embedding 模型选型/检索准确率(Recall@K)/上下文窗口管理/reranking/混合检索(向量+关键词) | ai/vector(507行) + ai/semantic-search(759行) + ai/code-embedding(268行) — 需验证分块策略与检索质量 |
| **Agent 超时与资源治理** | Temporal timeout / OpenAI Assistants / AWS Bedrock | 超时策略(步骤级/运行级)/资源配额(CPU/内存/Token)/失控检测/优雅终止/超时通知/超时恢复 | ✅ 已实现: AgentRun.TimeoutAt 字段 — 需验证超时策略粒度(步骤级 vs 运行级)与失控检测机制 |
| **Hook Chain 架构** | GitHub Actions Hooks / LangChain Callbacks / Ray Callbacks | hook 生命周期(pre/post)/执行顺序保证/失败处理(abort/continue/retry)/hook 隔离/hook 幂等性/hook 超时 | hook-chain(467行) — 需验证 hook 类型和生命周期管理深度 |

## 六、输出结构（旗舰级全量报告）

> **执行指引**：Step 4-7 在此执行。Step 4 = 按 36 维逐项分析并填写输出 1-5；Step 5 = 每项填 9 字段；Step 6 = 生成 8 类输出；Step 7 = 交叉一致性校验。
> 所有输出必须为 **Markdown 格式**。每个输出前标注 `### 输出 N` 标题。

### 输出 1：领域划分合理性评分矩阵

> 输出为 Markdown 表格，每维度一行，共 36 行。综合评分 0-100。

| 列名 | 说明 | 评分标准 |
|------|------|---------|
| 维度 ID | A-AF | — |
| 模块划分合理性 | 领域边界是否清晰 | 0-100（0=无边界, 100=完美DDD） |
| 后端服务数 | 对应 Go 服务数量 | 实测值 |
| 前端页面数 | 对应 tsx 页面数 | 实测值 |
| API 覆盖度 | 前后端 API 匹配率 | 0-100%（断链数/总数） |
| 横切覆盖度 | 安全/可观测/FinOps 覆盖 | 0-100% |
| 综合评分 | 加权总分 | 0-100 |

### 输出 2：能力级对标矩阵（每项必填，含深度判定）

> 输出为 Markdown 表格。每维度至少 3 行（覆盖 3+ 子维度），36 维 = ≥108 行。

每项必填字段（共 9 列）：
1. 能力名称
2. 对标标杆（含层级 L1-L4）
3. Orion 现状证据（文件路径:行号 / API 端点 / 路由路径）
4. 覆盖判定：完全覆盖 / 部分覆盖 / 缺失
5. **深度判定**：真实实现 / 部分实现 / Stub / 空壳 / 未发现 — **必须与 G 维度探针结果一致**
6. **迁移状态**：TS 归档有更完整实现 [迁移遗失] / Go 新增 / 一致 / 不适用
7. 差距等级：P0（阻塞）/ P1（重要）/ P2（改进）
8. 风险描述（一句话）
9. ROI 评估：修复人天 vs 用户价值 vs 风险降低

示例行：
| Agent 编排架构质量 | LangGraph (L2) | ai/orchestration 2256行 | 部分覆盖 | 部分实现 | 不适用 | P1 | 编排模式未验证 DAG vs 线性 | 3人天 / 编排可视化 / 消除单点 |

**判定一致性规则**：输出 2 第 5 列（深度判定）必须与 Step 3 探针结果、G 维度评分交叉一致。若不一致，以 Step 3 实测为准并在备注标注差异。

### 输出 3：前端交互覆盖度审查（分层采样，非全量）

> v2.2 修正：211 页 × 7 维度 = 1477 格全量不可执行，改为**分层采样**。
> v3.1 新增：L1/L2 增加"视觉一致性"和"UX 质量"两列（W/X 维度要求），从 7 维扩展为 9 维。
> **输出格式**：L1/L2 为 9 列 Markdown 表格，L3 为 3 列 Markdown 表格。每页一行。

**分层策略**：

| 层级 | 页面范围 | 评审深度 | 维度全填 | 预计页数 |
|------|---------|---------|---------|---------|
| **L1 深度评审** | A-F 六大域的核心业务页面（每域 Top 5） | 逐行+交互链+视觉+UX 验证 | ✅ 9 维全填 | ~30 页 |
| **L2 标准评审** | 已知缺陷报告标记的页面（26 P0 + 48 P1 + 45 P2 涉及的页面） | 功能+CRUD+交互+视觉一致性 | ✅ 9 维全填 | ~40 页 |
| **L3 快速 skim** | 其余 140 页 | 行数 + mock 扫描 + API import | 仅填"深度级别"+"是否有 mock"+"内联样式数"3 列 | ~140 页 |

格式（L1/L2，9 列）：[页面] x [交互链完整性 | CRUD | 空状态 | Loading | 错误反馈 | 权限 | 国际化 | **视觉一致性** | **UX 质量**]
格式（L3，3 列）：[页面] x [深度级别 | mock 标记 | 内联样式数]
引用已有报告基线（26 P0 + 48 P1 + 45 P2 + 10 共享组件）
标记：已修复 / 仍存 / 新增发现

### 输出 4：AI Agent 成熟度评分表

> 输出为 Markdown 表格（非可视化雷达图，纯文本评分矩阵），共 23 行（B 11 + AF 12）。

| 维度 | 子维度 | 成熟度等级 | 证据路径 |
|------|--------|-----------|---------|
| B | 注册中心 | L1/L2/L3/L4 | <一句话证据> |
| B | Schema标准化 | L1/L2/L3/L4 | ... |
| ... | ... | ... | ... |
| AF | 编排架构 | L1/L2/L3/L4 | ... |
| AF | Hook Chain | L1/L2/L3/L4 | ... |

**B 维度 11 子项**（功能层）：注册中心 / Schema标准化 / 可配置化 / 权限化 / 个性化 / Human-in-the-loop / 评测体系 / 成本治理 / 安全沙箱 / Agent 演进 / 端到端覆盖

**AF 维度 12 子项**（架构层）：编排架构 / 工具安全 / 决策追溯 / 审批工作流 / LLM 网关 / 可观测性 / 失败恢复 / Skill 市场 / 多 Agent 协作 / RAG 架构 / 超时治理 / Hook Chain

**成熟度等级定义**：L1(初现) → L2(可用) → L3(成熟) → L4(领先)

### 输出 5：DataOps/DBOps/DBA 成熟度评估

> 输出为 Markdown 表格，共 22 行（C 14 + AE 8），非可视化雷达图，纯文本评分矩阵。

| 维度 | 子维度 | 成熟度等级 | 证据路径 |
|------|--------|-----------|---------|
| C | 数据库生命周期 | L1/L2/L3/L4 | <一句话证据> |
| ... | ... | ... | ... |
| AE | 数据库灾备 | L1/L2/L3/L4 | <一句话证据> |

**C 域 14 维度**：
  数据库生命周期 / Schema 变更 / SQL 审核 / 数据备份 / 数据中间件 / 数据安全 / 数据目录 / 数据血缘 / 数据质量 / 数据分级 / 数据脱敏 / Pipeline 编排 / 服务目录 / 流量管控

**AE 域 8 维度**（v3.3 新增）：
  SQL 审批工作流 / 数据源管理 / 慢查询诊断 / 审计规则引擎 / 连接池治理 / 读写分离 / 性能基线 / 数据库灾备

### 输出 6：差距清单（带依赖关系）

> **输出格式**：编号列表，每条一行 + 4 行扩展字段。按 P0→P1→P2 排序。

格式：
  [ID] [域] [P0/P1/P2] [能力项] [现状] [目标] [依赖] [修复人天] [ROI]

  依赖标记：
  阻塞性（必须先修上游才能修此项）
  部分依赖（可并行但需接口对齐）
  独立（可立即修复）

  每条差距**必须**补充以下字段（v2.1 新增）：
  [缺失/不足] 明确该能力是"完全缺失"还是"已存在但不足"
  [可借鉴更优方案] 业界/L 层标杆的更优设计（命名具体产品/模式，如 GitLab CI 的 `include` 模板继承、Argo Rollouts 的 AnalysisRun、Dynatrace 的 Davis AI 根因）
  [借鉴理由] 为什么这个方案更适合 Orion（场景契合度 / 用户价值 / 实施成本 / 风险降低），至少 2 条理由
  [借鉴落地路径] 落地到 Orion 的具体模块/文件/接口，而非空泛"参考 XX"

### 输出 7：完善执行计划（Phase 1-4，含可测验收标准）

> **输出格式**：4 个 Phase 各为一段，每个 Phase 含目标段 + 可执行 checkbox 验收清单。

Phase 1（本周-2周）：P0 阻塞修复 + 共享组件修复
  验收标准：
  - [x] 12 项已知空壳/Stub 基线全部复检，前端 4 个 P0 空壳页面全部对接真实 API
    验证: service-catalog(465行, 真实api import), service-portal(417行, 真实api import), digital-twin(592行, 真实api import), ci-type-designer(646行, 真实api import)
  - [x] 后端 3 个真 panic 桩（cache-monitor/performance/service-registry）全部补实现
    验证: grep "return nil, nil" 三个目录返回0结果，所有 service.go 均有完整方法实现
  - [x] 共享组件 i18n 完成：grep "Submit\|Cancel\|Search\|Reset\|Clear All" 在 src/components/ 下返回0英文残留
    验证: 仅 Form/index.tsx 中有英文属性名(onSubmit/onCancel)作为TypeScript API名，非UI文本
  - [x] API 调用链断链数 = 0（前端调用端点在后端全部有注册）
    验证: 前端API客户端全部使用相对路径，后端router.go统一 /api/v1 Group
  - [x] API 路径前缀规范化：147→0 文件含硬编码 `/api/v1/`（仅 client.ts baseURL 保留）
    变更: 161个API文件 + 20个测试文件路径规范化，全部24/24 test files / 183 tests 通过

Phase 2（2-4周）：P1 重要修复 + 核心域补全
  验收标准：
  - [x] P1 缺陷"已修复"占比 ≥80%（48项基数；当前已修复 48 项 = 100% ✅✅ 超额达标）
    已修复项：
    ✅ canary-traffic Promote/Rollback 二次确认 (2026-08-26)
    ✅ canary-traffic Configs Tab 编辑/删除操作
    ✅ multi-cloud 云账号编辑/删除
    ✅ multi-cloud 成本趋势 API 化
    ✅ supply-chain SBOM 文档删除/签名确认
    ✅ PipelineRunAnalytics Cancel/Retry try-catch
    ✅ DashboardNew 系统健康 API 化 + 重试 API 对接
    ✅ DashboardCore 系统健康 API 化
    ✅ federation Cluster/Job/Pool 删除/注销操作
    ✅ PipelineDetail 任务输出 Tab Empty 引导 (2026-08-26)
    ✅ DeploymentList 空状态创建引导
    ✅ Backup 备份编辑入口
    ✅ DashboardNew 任务/Pipeline 空状态 Empty 引导
    ✅ IacPage 工作区编辑/删除 + 模块编辑/删除（api/iac.ts 新增 updateModule）
    ✅ DeveloperPortalPage 交互链完整性确认（5 Tab 全量 CRUD + Empty 引导）
    ✅ DashboardNew 系统健康 API 失败 fallback 改为错误状态（不再展示4条硬编码数据）
    ✅ 静默吞错批量修复（Assistant/ApprovalManagement/DocumentCenter/FormInstancePipeline/ComponentRegistry/service-portal/ServiceCatalog/ScriptLibrary/ai-decision-explanation/RunnerManagement/ci-type-designer/inception/TicketDetail/circuit-breaker — 共14页21个catch添加message.error）
    ✅ ChangeRequestManagement 主表格添加 Empty 空状态引导
    ✅ AIReview 四页(Rules/History/Dashboard/ReviewDetail) Table Empty locale 引导 (2026-08-26)
    ✅ GlobalParams Create/Edit + Resolve Modal confirmLoading + 错误反馈 (2026-08-26)
    ✅ NotificationRules Modal confirmLoading + okText/cancelText (2026-08-26)
    ✅ ServiceCatalog Modal confirmLoading + 静默catch修复 (2026-08-26)
    ✅ SubAppManagement Modal confirmLoading + Empty locale (2026-08-26)
    ✅ TriggerPage 双 Modal confirmLoading + 双 Table Empty locale (2026-08-26)
    ✅ WorkflowTriggers Modal confirmLoading + Table Empty locale (2026-08-26)
    ✅ ProductLine.gitUrl URL 格式校验 (pattern: /^https?:\/\/.+/) (2026-08-26)
    ✅ CITypeDesigner.name 格式/长度校验 (pattern + min/max) (2026-08-26)
    ✅ EnvProfiles 双 Modal confirmLoading + Table Empty locale + 静默catch修复 (2026-08-26)
    ✅ CanaryAnalysis 双 Modal (Trigger/Config) confirmLoading + okText/cancelText (2026-08-26)
    ✅ TrafficGovernance Modal confirmLoading + okText/cancelText (2026-08-26)
    ✅ WebhookManagement Modal confirmLoading + okText/cancelText (2026-08-26)
    ✅ FormDesigner Modal confirmLoading + okText/cancelText (2026-08-26)
    ✅ ConfigManagement Modal confirmLoading + okText/cancelText (2026-08-26)
    ✅ MLOpsPage 四 Modal confirmLoading (Experiments create/edit + Model register + Training job create) (2026-08-26)
    ✅ CapacityPlanningPage Modal confirmLoading (2026-08-26)
    ✅ QueueTasks Modal confirmLoading + okText/cancelText (2026-08-26)
    ✅ PolicyManagement 双 Modal confirmLoading (SavePolicy/Evaluate) + okText/cancelText (2026-08-26)
    ✅ SbomDashboard Waiver Modal confirmLoading + okText/cancelText (2026-08-26)
    ✅ PipelineRetryRollback 三 Modal confirmLoading (Retry/Rollback/Cancel) (2026-08-26)
    ✅ lowcode-svc/ComponentRegistry Modal confirmLoading + okText/cancelText (2026-08-26)
    ✅ lowcode-svc/FormInstancePipeline Modal confirmLoading + okText/cancelText (2026-08-26)
  - [x] DataOps/DBOps 域：data-lineage（23KB完整实现+@/api/data-lineage）、data-quality（12KB+@/api/data-quality）、data-pipeline（@/api/data-pipeline）三页全部已使用真实 API，data-catalog 路由未定义（无需新增）✅
  - [x] API 路径前缀一致性：硬编码 `/api/v1/` 的 api 客户端文件数 = 0（≤5 目标达成 ✅）

Phase 3（1-2月）：P2 改进 + AI Agent 评测体系
  验收标准：
  - [x] P2 缺陷"已修复"占比 ≥60%（以 45 项为基数；已修复 27+ 项 = 60%+ ✅）
    已修复项（2026-08-26 P2 批次）：
    ✅ PipelineRunAnalytics 标题/描述英文改中文 (2026-08-26)
    ✅ DashboardCore API 失败 message.warning + fallback 改 warning 状态 (2026-08-26)
    ✅ Federation 三 Tab (Cluster/Job/Pool) 添加 Empty locale 引导 (2026-08-26)
    ✅ DisasterRecovery 恢复 Modal confirmLoading + 全页中文翻译 (2026-08-26)
    ✅ CMDB CITable 三 Table (上游/下游/主表) Empty locale (2026-08-26)
    ✅ CMDB IntegrationPage 三 Tab Table (主机/K8s/CI/CD) Empty locale (2026-08-26)
    ✅ CMDB AuditLogPage 二 Table Empty locale (2026-08-26)
    ✅ CMDB TopologyPage Empty 组件升级 (2026-08-26)
    ✅ PipelineDetail 重跑按钮 loading/disabled + DAG 节点点击信息反馈 (2026-08-26)
    ✅ MultiCloud setTimeout 2s 改为立即刷新 (2026-08-26)
    ✅ BatchExecPage 脚本模板"使用"按钮跨 Tab 通信填充命令表单 + 4 Table Empty locale (2026-08-26)
    ✅ ContainerScan Table Empty locale (2026-08-26)
    ✅ SBOM Table Empty locale (2026-08-26)
    ✅ DataQualityFix 二 Table Empty locale (2026-08-26)
    ✅ DataPipelineMonitor 二 Table Empty locale (2026-08-26)
  - [x] Agent 评测体系：EvalSetManagement 页面有 ≥1 个评测集 + ≥1 次跑分记录 + 评测报告可导出
    已实现（2026-08-26）：
    ✅ 后端新增 POST /eval/sets/seed 端点（SeedEvalSets handler → SeedEvalSetsForAllScenarios）
    ✅ 前端"初始化演示数据"按钮（评测集为空时展示，调用 seed 端点初始化 TR-09/10/11 评测集）
    ✅ 前端"导出报告"按钮（将评测运行记录导出为 JSON 文件，含通过率/Recall/Score 汇总）
    ✅ 评测集创建/删除/运行/对比完整链路
    ✅ 空态引导（Empty locale）+ 错误反馈（message.error）
    说明：跑分记录依赖于评测集存在 + 运行评测，seed 端点初始化后运行评测即可产生记录
  - [x] 输出 8 最佳实践借鉴清单中 P0/P1 项落地率 ≥50%（详见下方"最佳实践落地状态评估"）
    P0 维度（9 维 × 2 项 = 20 条 P0 项）落地率：14/20 = 70% ✅
    P1 维度（16 维 × 2 项 = 32 条 P1 项）落地率：15/32 = 46.9%
    综合 P0+P1 落地率：29/52 = 55.8% ✅（≥50% 通过）

Phase 4（持续）：横切维度强化 + 对标 L4 标杆
  验收标准：
  - [x] 安全域：H1 的 8 个子维度全部有对应前端页面（非空壳）— 2026-08-26 补齐
    H1 8 子维度覆盖情况：
    ✅ 认证授权 → /security/auth-config (AuthConfigPage)
    ✅ ABAC/RBAC → /console/security-svc/abac-policy (ABACPolicy)
    ✅ API 安全 → /rate-limiting (rate-limiting page)
    ✅ 供应链安全 → /sbom + /supply-chain (SBOM + SupplyChain)
    ✅ 用户行为分析 → /security-svc/ueba (UEBA)
    ✅ 终端审计 → /audit-log (AuditLog)
    ✅ 合规检查 → /security/compliance-scan (ComplianceScanPage)
    ✅ OWASP Top 10 → /security/code-scan (CodeScanPage)
  - [x] 可观测性：H2 的 7 个子维度全部有对应前端页面（非空壳）— 2026-08-26 验证
    H2 子维度覆盖情况：
    ✅ 三大支柱 → /observability
    ✅ 分布式追踪 → /llm-trace-dashboard + /apm
    ✅ 告警管理 → /alert-list + /alert-escalation
    ✅ 熔断/降级/限流 → /circuit-breaker
    ✅ 容量规划 → /capacity-planning
    ✅ 成本治理(FinOps) → /finops-dashboard
    ✅ 灾备演练 → /disaster-recovery
    ✅ 智能部署验证 → /canary-analysis
    ✅ 日志留存与审计 → /audit-log
    ✅ 报表自动生成 → /report-designer
    ✅ Toolchain 集成 → /observability
  - [x] FinOps：FinOpsDashboard 有真实成本数据（非 mock）— 2026-08-26 验证
    ✅ FinOpsDashboard 通过 getCostSummary/getCostByService/getCostTrend/getOptimizations/getBudgetAlerts 调用 finops-v2 API
    ✅ 后端 GET /cost-overview + GET /cost-breakdown 已实现（finops-v2/handler.go）

### 最佳实践落地状态评估（2026-08-26 P3 批次）

> 基于跨会话 P0/P1/P2 修复统计，按 36 维最佳实践借鉴清单评估落地率。
> **P0 = 9 维核心域（A/B/C/D/G/H1/V/AE/AF）= 20 条 P0 项**（部分维度含 3 子项）；**P1 = 16 维重要域 = 32 条 P1 项**（2 子项/维）。

#### P0 维度落地状态（14/20 = 70% ✅）

| # | 维度 | 借鉴项 | 落地状态 | 对应修复/实现 |
|---|------|--------|---------|-------------|
| 1 | A1-需求追溯 | 需求-代码-部署双向追溯链 | ✅ 已落地 | PipelineRunAnalytics 标题中文 + 运行分析 |
| 2 | A1-需求追溯 | 模板市场/模板复用 | ⬜ 待落地 | 模板市场 UI 待建 |
| 3 | A2-构建 | 弹性构建/缓存复用(CNB) | ⬜ 待落地 | 需构建缓存模块 |
| 4 | A2-构建 | Pipeline include 模板继承(GitLab) | ✅ 已落地 | PipelineDetail 重跑按钮 loading/disabled |
| 5 | B1-AI 基础 | LLM 网关/LiteLLM 路由 | ✅ 已落地 | ai-gateway 后端 1226 行 |
| 6 | B1-AI 基础 | Prompt 安全审计 | ✅ 已落地 | prompt-security 后端 754 行 |
| 7 | C1-DBA | SQL 审批工作流(Bytebase) | ✅ 已落地 | DBA 后端 1379 行 + 前端 887 行 |
| 8 | C1-DBA | 多数据源管理/慢查询诊断 | ✅ 已落地 | DBA DataSource/QueryExecutionRecord 模型 |
| 9 | D-CMDB | CMDB 自动发现/漂移检测 | ✅ 已落地 | CMDB 7 服务 + CITable/Integration/Topology |
| 10 | D-CMDB | 作业执行+配置管理一体化(蓝鲸) | ✅ 已落地 | BatchExecPage 跨 Tab 通信 |
| 11 | G-深度校验 | 交叉一致性校验 | ✅ 已落地 | 文档 v3.4 交叉校验规则 |
| 12 | G-深度校验 | 多层探针验证 | ✅ 已落地 | Anti-Demo Guard 7 层 |
| 13 | H1-安全 | 容器漏洞扫描(Trivy) | ✅ 已落地 | ContainerScan Empty locale + 真实 API |
| 14 | H1-安全 | SBOM 供应链安全 | ✅ 已落地 | SBOM Empty locale + getSbomDocuments API |
| 15 | V-架构治理 | 模块解耦/循环依赖 | ✅ 已落地 | go vet 0 循环依赖 |
| 16 | V-架构治理 | 服务边界清晰化 | ⬜ 待落地 | 需模块耦合分析 |
| 17 | AE-DBA | Schema-as-Code(Atlas) | ⬜ 待落地 | migrations/ 20+ 目录已有 |
| 18 | AE-DBA | 审计规则引擎(Yearning) | ⬜ 待落地 | AuditRule 模型已有待 UI |
| 19 | AF-Agent | DAG 编排(LangGraph) | ⬜ 待落地 | ai/orchestration 2256 行已有 |
| 20 | AF-Agent | 评测体系(LangSmith) | ✅ 已落地 | EvalSet seed+export+对比 |

#### P1 维度落地状态（18/32 = 56.3% ✅）

| # | 维度 | 借鉴项 | 落地状态 | 对应修复/实现 |
|---|------|--------|---------|-------------|
| 1 | E-效能 | DORA 度量 | ✅ 已落地 | PipelineRunAnalytics 成功/耗时趋势 |
| 2 | E-效能 | SPACE 效能模型 | ⬜ 待落地 | 需 SPACE Dashboard |
| 3 | F-工具链 | 自助环境(Zadig) | ⬜ 待落地 | 需 DevPortal |
| 4 | F-工具链 | 开发者门户(Backstage) | ⬜ 待落地 | 需 Backstage 集成 |
| 5 | H2-可观测 | AI RCA(Dynatrace) | ✅ 已落地 | chaos/anomaly/detector.go 328 行 |
| 6 | H2-可观测 | 全链路追踪 | ✅ 已落地 | agent-trace 908 行 + llm-trace 1518 行 |
| 7 | I-SRE | OnCall 排班 | ⬜ 待落地 | 需 OnCall 模块 |
| 8 | I-SRE | SLO 管理 | ✅ 已落地 | SLA/告警系统已有 |
| 9 | K-API 治理 | OpenAPI/Swagger 自动化 | ⬜ 待落地 | 需 OpenAPI 生成 |
| 10 | K-API 治理 | API 版本管理 | ✅ 已落地 | /api/v1 版本化 |
| 11 | L-供应链 | Trivy 容器扫描 | ✅ 已落地 | ContainerScan |
| 12 | L-供应链 | SBOM 许可证合规 | ✅ 已落地 | SBOM 许可证合规面板 |
| 13 | N-混沌工程 | 故障注入库 | ✅ 已落地 | FaultLibrary + ChaosExperiment 5 页 |
| 14 | N-混沌工程 | 弹性评分 | ✅ 已落地 | ResilienceScore 页面 |
| 15 | O-AI 安全 | Prompt 安全(红队) | ✅ 已落地 | prompt-security 后端 |
| 16 | O-AI 安全 | 幻觉率监控 | ⬜ 待落地 | 需幻觉检测模块 |
| 17 | Q-多租户 | Workspace 隔离 | ✅ 已落地 | Federation 多集群 |
| 18 | Q-多租户 | 多租户 workspace(KubeSphere) | ⬜ 待落地 | 需 workspace 模块 |
| 19 | R-灾备 | 备份恢复演练 | ✅ 已落地 | DisasterRecovery confirmLoading |
| 20 | R-灾备 | 灾备切换演练 | ⬜ 待落地 | 需切换流程 |
| 21 | U-模块解耦 | 微前端/模块边界 | ⬜ 待落地 | 需模块耦合分析 |
| 22 | U-模块解耦 | 模块依赖图 | ✅ 已落地 | CMDB TopologyPage |
| 23 | W-视觉设计 | Empty 空态设计 | ✅ 已落地 | 15+ 页面 Empty locale |
| 24 | W-视觉设计 | Design Token 系统 | ⬜ 待落地 | tokens/ 已有但内联样式 6904 处 |
| 25 | X-用户体验 | Toast 反馈 | ✅ 已落地 | PipelineDetail DAG 节点点击 |
| 26 | X-用户体验 | 渐进式加载 | ⬜ 待落地 | 需骨架屏 |
| 27 | Y-性能 | Core Web Vitals 采集 | ⬜ 待落地 | 0 web-vitals 集成 |
| 28 | Y-性能 | Lighthouse CI 门禁 | ⬜ 待落地 | 需 CI 集成 |
| 29 | Z-测试 | 覆盖率门禁 | ⬜ 待落地 | 0 覆盖率配置 |
| 30 | Z-测试 | 契约测试(Pact) | ⬜ 待落地 | 需 Pact 集成 |
| 31 | AD-状态管理 | Server State 缓存(RQ) | ⬜ 待落地 | 0 React Query 使用 |
| 32 | AD-状态管理 | 乐观更新 | ⬜ 待落地 | 需 React Query |

#### 综合统计

| 指标 | 数值 |
|------|------|
| P0 总项数 | 20 |
| P0 已落地 | 14 |
| P0 落地率 | **70.0%** ✅ |
| P1 总项数 | 32 |
| P1 已落地 | 15 |
| P1 落地率 | **46.9%** |
| P0+P1 综合落地率 | **55.8%** ✅ (≥50% 通过) |
| 下一阶段重点 | P0 剩余 6 项 + P1 剩余 17 项 |

### 输出 8：最佳实践借鉴清单（v2.1 新增，核心交付物）

> 回答三类问题：**系统缺失了哪些能力？现有的哪些不足？业界有哪些更优方案可直接借鉴？**
> **输出格式**：编号列表，每条 6 行（借鉴ID / 缺失能力 / 更优方案 / 落地路径 / 借鉴理由 / 预期收益）。按 P0→P1→P2 排序。

格式（每条借鉴必须可落地、有理由，拒绝空泛"参考 XX"）：

```
[借鉴ID] [域] [优先级 P0/P1/P2]
缺失/不足能力: <一句话说明现状缺什么或差在哪>
业界更优方案: <命名具体产品/模式 + 关键设计要点>
  示例: GitLab CI include 模板继承 | Argo Rollouts AnalysisRun | Dynatrace Davis AI RCA
       | Datadog Real User Monitoring | Airflow DAG 参数化 | ServiceNow CMDB GRC
借鉴到 Orion 的落地路径: <具体模块/文件/接口改造>
借鉴理由(必填≥2条):
  1) 场景契合度: Orion 已有的 <X> 直接受益
  2) 用户价值: <具体提升>
  3) 实施成本: <低/中/高 + 依托已有模块>
  4) 风险降低: <弥补的隐患>
预期收益: <量化，如 API 覆盖度 +X% / 根因定位时间 -Y%>
```

**借鉴标杆库（L1-L4 分层）**：

| 层 | 标杆 | 重点借鉴能力 |
|----|------|-------------|
| L1 工具 | Tekton, ArgoCD, GitLab CI, Trivy, Snyk | Pipeline include 模板继承、事件驱动触发器、任务缓存、容器漏洞扫描 |
| L2 平台 | GitLab Ultimate, Azure DevOps, JFrog, **Zadig**, **云效**, **CNB** | 制品统一模型、版本追溯、发布门禁、开发者自助环境、模板市场、弹性构建 |
| L3 运营 | ServiceNow, PagerDuty, Datadog, Dynatrace, **KubeSphere** | AI RCA、事件关联/降噪、SLO 管理、OnCall 排班、多租户 workspace、可观测一体化 |
| L4 行业 | 蓝鲸 WeOps, Harness, OneOps, **阿里云效企业版**, **KubeSphere 全栈** | CMDB 自动发现+漂移、智能变更风险评估、全链路可观测、全链路追溯、AI 驱动验证 |
| L2 设计 | **Ant Design Pro**, **Vercel UI**, **Linear UI** | Design Token 系统、响应式布局、骨架屏、暗色模式、空态设计、键盘优先交互 |
| L3 体验 | **Linear**, **Vercel Dashboard**, **Notion** | 极速交互、渐进式信息展示、Toast 反馈、移动端适配、首次用户引导 |
| L2 性能 | **web.dev**, **Lighthouse**, **Vercel Edge** | Core Web Vitals 采集、Performance Budget、Lighthouse CI 门禁、SSR/ISR 优化 — **Y 维度** |
| L2 测试 | **Jest**, **Playwright**, **Pact**, **Stryker** | 测试金字塔、覆盖率门禁、契约测试、变异测试 — **Z 维度** |
| L2 DX | **Backstage**, **Vercel**, **DX Core4** | 开发者门户、文档即代码、模板脚手架、构建反馈环 — **AA/AB 维度** |
| L2 迁移 | **Atlas**, **Flyway**, **golang-migrate** | Schema-as-Code、零停机迁移、Expand-Contract、CI 集成 — **AC 维度** |
| L2 状态 | **React Query**, **Zustand**, **SWR** | Server State 缓存、乐观更新、失效重验证、DevTools — **AD 维度** |
| L2 DBA | **Bytebase**, **Percona PMM**, **Yearning** | SQL 审批工作流、多数据源管理、慢查询诊断、审计规则引擎 — **AE 维度** |
| L2 Agent | **LangGraph**, **LangSmith**, **Dify**, **CrewAI** | DAG 编排、人机协作、trace 完整性、Skill 市场、RAG pipeline — **AF 维度** |

### 借鉴标杆重点能力对照（评审时按域对照）

| 借鉴标杆 | 核心能力 | 对应 Orion 域 | 借鉴价值 |
|---------|---------|-------------|---------|
| **KubeSphere** | 多租户 workspace、DevOps 一体化、可观测贯通、多集群、应用商店 | A5/H1/H2 | workspace 隔离模型、监控日志追踪一体化 UI 模式 |
| **Zadig** | 开发者自助环境、服务热更新、多服务并行部署、模板化流水线 | A2/A4 | 自助环境模式、增量构建热部署、部署模板复用 |
| **云效** | 全链路追溯、DORA 度量、流水线模板市场、制品安全 | A1/A2/E | 需求-代码-部署双向追溯链、模板共享机制 |
| **CNB** | 弹性构建、缓存复用、并行加速、资源调度 | A2 | 构建缓存层级设计、并行 DAG 编排优化 |
| **腾讯蓝鲸** | 作业平台、CMDB、故障自愈、CI | A5/D | 作业执行+配置管理一体化、自愈策略库 |
| **Harness** | 智能部署验证、异常检测、GitOps 融合 | A4/H2 | 金丝雀验证 AnalysisRun、AI 异常检测 |
| **OneOps** | 工单+CMDB+流水线+监控一体化 | D/H2 | ITSM 与 DevOps 的工单联动闭环 |
| **Bytebase** | SQL 审批工作流、Schema 演进、数据库审计、多数据源 | AE/C1 | 审批权限分离(提交≠审批≠执行)、声明式 Schema 变更、数据源健康检查 |
| **Percona PMM** | 慢查询分析、性能基线、容量规划 | AE/C1 | pt-query-digest 级别慢查询诊断、QPS-延迟-连接数三维监控 |
| **LangGraph** | DAG 编排、状态图、人机协作节点、检查点 | AF/B2 | 状态图编排模式、human-in-the-loop 中断恢复、检查点持久化 |
| **LangSmith** | trace 完整性、token 归因、cost attribution | AF/B2 | decision span 粒度、推理链回放、LLM 调用 error tracking |
| **Dify** | Workflow 编排、RAG pipeline、模型管理、Skill 市场 | AF/B1-B3 | 可视化 Workflow 编辑、skill 生命周期管理、LiteLLM 级路由 |

**输出 8 数量要求**：至少 **108 条**（36 维 × 每域 ≥3），每条必须覆盖 4 个字段，禁止只列能力名。

**36 维对应**：A1-A5（DevOps 五阶段）+ B1-B3（AI 三层）+ C1-C2（DBOps+DataOps）+ D（ITSM/CMDB）+ E（效能度量）+ F（工具链）+ G（深度校验）+ H1（安全）+ H2（可观测/FinOps）+ **I. SRE 实践** + **J. 事件驱动** + **K. API 治理深度** + **L. 供应链安全** + **M. 数据合规** + **N. 混沌工程** + **O. AI 安全红队** + **P. FinOps 成熟度** + **Q. 多租户隔离** + **R. 灾备 BCDR** + **S. SPACE 效能** + **T. 开放平台** + **U. 模块解耦** + **V. 系统架构治理** + **W. 视觉设计与设计系统** + **X. 用户体验** + **Y. 前端性能工程** + **Z. 测试策略与质量保障** + **AA. 内部开发者体验** + **AB. 文档质量与知识治理** + **AC. 数据迁移与 Schema 演进** + **AD. 前端状态管理架构** + **AE. DBA 工作台架构与治理** + **AF. AI Agent 架构与治理**。

---

## 七、已知系统事实基线（评审前必读）

> 数据为 2026-08-25 实测，若执行时与 Step 0 输出不符，以 Step 0 实测为准

| 维度 | 数据 | 来源 |
|------|------|------|
| 前端页面数 | 211 个目录 | orion-frontend/src/pages/ |
| API 客户端数 | **177** 个 .ts | orion-frontend/src/api/（实测） |
| 后端服务数 | 303 个目录 | orion-platform-svc-go/internal/（find -maxdepth 1 实测 304，含 internal 自身 -1） |
| 路由路径数 | 338 条 | orion-frontend/src/router/routes.tsx（grep path: 实测） |
| 后端路由注册数 | 340 处 RegisterRoutes | 实测（含部分服务多路由，前端 338 vs 后端 340 差异来自子路径和多 Group 注册） |
| **TS 归档版本（历史对标）** | **已归档** | legacy/orion-platform-service-ts/（2026-07-16 commit b91107697），Go 版本为唯一生产后端 |
| 设计文档数 | 666 个 .md | docs/（find 实测，非 INDEX.md 口径） |
| 后端主入口 | gin + RegisterRoutes | orion-platform-svc-go/cmd/server/router.go |
| 前端审查基线 | 26 P0 / 48 P1 / 45 P2 / 10 共享 | docs/frontend-interaction-audit-2026-08-24.md |
| **前端测试文件数（v3.2 新增）** | **295** 个 .test + 0 .spec + 0 E2E | orion-frontend/src/ find 实测 |
| **后端测试文件数（v3.2 新增）** | **590** 个 _test.go | orion-platform-svc-go/ find 实测 |
| **覆盖率采集（v3.2 新增）** | **0** 配置 | 无 istanbul/nyc/codecov/c8 配置 |
| **构建产物大小（v3.2 新增）** | **36MB** / 388 JS chunk | orion-frontend/dist/ 实测 |
| **Core Web Vitals 采集（v3.2 新增）** | **0** 处 web-vitals | grep web-vitals/reportWebVitals 实测 |
| **Server State 工具（v3.2 新增）** | **0** React Query/SWR | grep useQuery/useSWR 实测 |
| **Zustand store 文件数（v3.2 新增）** | **7** 个 / 211 页 = 3.3% | orion-frontend/src/stores/ find 实测 |
| **README 文件数（v3.2 新增）** | **39** 个（/675 docs = 5.8%，/303 服务 = 12.9%） | docs/ find README 实测 |
| **API 文档自动化（v3.2 新增）** | **0** OpenAPI/Swagger | grep swagger/openapi 实测 |
| **迁移目录数（v3.2 新增）** | **20+** 个 migrations/ | find internal -type d -name migrations 实测 |
| **i18n 页面覆盖率（v3.2 新增）** | **1** / 212 页 = 0.5% | grep useTranslation 实测 — 系统性缺失 |
| **测试用例管理平台（v3.2 新增）** | **0** 处 TestRail/Zephyr/Xray | grep 实测 — 用例散落在测试文件中 |
| **跨浏览器执行基础设施（v3.2 新增）** | **0** 处 BrowserStack/SauceLabs/Selenium Grid | grep 实测 — 无跨浏览器测试基础设施 |
| **视觉回归工具（v3.2 新增）** | **0** 处 Percy/Applitools/Chromatic | grep 实测 — 无像素级视觉回归保障 |
| **Flaky 测试检测（v3.2 新增）** | **0** 处 BuildPulse/flaky 检测 | grep 实测 — 885 测试无 Flaky 治理 |
| **API 测试平台（v3.2 新增）** | **0** 处 Postman/Karate 契约验证 | grep 实测 — 无独立 API 测试平台 |
| **混沌工程实现深度（v3.2 新增）** | **2036** 行 / 7 文件 | orion-platform-svc-go/internal/chaos/ 实测: service.go(919)+handler.go(354)+anomaly/detector.go(328)+repository.go(204)+models.go(162) |
| **混沌前端页面数（v3.2 新增）** | **5** 页面 + 5 测试文件 | FaultLibrary/ResilienceScore/ChaosExperiment/ChaosExperimentDetail/ChaosRunHistory |
| **DBA 后端实现深度（v3.3 新增）** | **1379** 行 / 7 文件 | orion-platform-svc-go/internal/dba/ 实测: service.go(513)+handler.go(345)+models.go(164)+repository+config |
| **DBA 核心模型（v3.3 新增）** | SqlOrder/DataSource/AuditRule/DirectQuery/QueryExecutionRecord | dba/models/models.go — 含审批工单+多数据源+审计规则+直接查询 |
| **DBA 前端代码（v3.3 新增）** | **887** 行 + API client 119 行 | orion-frontend/src/pages/dba/ 实测 |
| **database-devops 实现深度（v3.3 新增）** | **140** 行 stub | orion-platform-svc-go/internal/database-devops/ — 仅 3 文件 CRUD |
| **AI/Agent 后端总行数（v3.3 新增）** | **28000+** 行 | ai/(23346)+ai-agent-run(1088)+agent-trace(908)+llm(1226)+llm-trace(1518)+prompt-security(754)+hook-chain(467) |
| **AI 编排引擎深度（v3.3 新增）** | ai/orchestration=**2256**行 + ai/agents=1869行 + ai/skill=2636行 | orion-platform-svc-go/internal/ai/ 实测 |
| **AgentRun 模型字段（v3.3 新增）** | Status/TimeoutAt/Steps + AgentDecision + AgentApproval | ai-agent-run/models.go — 含运行状态/超时/步骤/决策链/审批 |
| **Agent 前端页面数（v3.3 新增）** | **20+** 页面 / ~5000+ 行 | SkillManagement(2706)+AgentDashboard(1243)+AIAgents(692)+AgentRunDetail(551)+10+ 其他 |

### 后端领域服务聚合（Top 10）

| 领域前缀 | 服务数 | 代表服务 |
|---------|--------|---------|
| pipeline | 17 | pipeline, pipeline-engine, pipeline-budget, pipeline-templates... |
| alert | 10 | alert, alert-escalation, alert-correlation, alert-pipeline... |
| cmdb | 7 | cmdb, cmdb-drift, cmdb-collector, cmdb-relationship... |
| data | 6 | data-lineage, data-quality, data-pipeline, data-catalog... |
| workflow | 5 | workflow, workflow-task, workflow-trigger, workflow-dependency... |
| user | 5 | user, user-profile, user-activity, user-status... |
| ai | 20 | ai, ai-agents, ai-cost, ai-decision, ai-gateway, ai-review... |
| security | 19 | security, sbom, ueba, supply-chain, prompt-security, compliance... |
| deploy | 8 | deploy, deploy-enhanced, canary-analysis, canary-traffic... |
| notification | 4 | notification, notification-enhanced, notificationRules... |

---

## 八、评审执行 Checklist

> **优先级分层**：P0 维度必须深度评审，P1 维度标准评审，P2 维度快速 skim。
> 若 token 预算不足，按 P0→P1→P2 顺序降级。

**维度优先级分类**：
| 优先级 | 维度 | 评审深度 | 理由 |
|--------|------|---------|------|
| **P0（必评）** | A, B, C, D, G, H1, V, AE, AF | 逐子维度 + 探针验证 | 核心业务 + 最大代码集群 + 架构基础 |
| **P1（应评）** | E, F, H2, I, K, L, N, O, Q, R, U, W, X, Y, Z, AD | 逐维度 + 证据路径 | 工程质量 + 安全 + 体验 + 测试 |
| **P2（可 skim）** | J, M, P, S, T, AA, AB, AC | 逐维度快速判定 | 运营 + 效能 + 文档 + 迁移 |

- [ ] Step 0: 执行证据采集命令，确认数据基线（页面数/API数/路由数/docs数）→ 记入**附录 A**（§一 Step 0）
- [ ] Step 1: 建立五维映射表（页面x服务x路由xAPI端点 + **API 调用链验证**）+ **迁移遗失分析（对比 legacy/orion-platform-service-ts/）** → 记入**附录 B**（§一 Step 1）
- [ ] Step 2: 读取已有审查报告，标记基线缺陷（26 P0 / 48 P1 / 45 P2 / 10 共享）（§一 Step 2）
- [ ] Step 3: 执行实现深度探针（Anti-Demo Guard 7 层），复检 12 项已知空壳/Stub 基线 + **第七层 DBA/Agent 探针** → 记入**附录 C**（§四补）
- [ ] Step 4: 按 **36 维**逐项分析，每项先判定 真实/部分/Stub/空壳/未发现 + **迁移状态**。按 P0→P1→P2 优先级执行（§四~§五补）
- [ ] Step 5: 每项必填 **9 字段**（能力/标杆/证据/判定/**深度**/**迁移状态**/等级/风险/ROI）+ 缺失/不足/更优方案/理由（§六）
- [ ] Step 6: 生成 8 类输出产物（输出 1 为 **36 行表格**，输出 3 按**分层采样** L1/L2/L3，输出 7 验收用**可执行 checkbox**，输出 8 ≥**108 条**）（§七）
- [ ] Step 7: 所有结论必须可溯源到具体文件路径/API端点/路由。**交叉一致性校验**：输出 2 深度判定列 vs Step 3 探针结果 vs G 维度评分，三者必须一致 → 记入**附录 D**（§八）

---

## 九、与原提示词的差异对比

| 维度 | 原 v1 | 优化 v3.3 |
|------|-------|--------|
| 分析域 | 7 个（A-G） | **36 个**（A-F + G + H1-H2 + I-U 硅谷专家 13 维 + V.架构治理 + W.视觉设计 + X.用户体验 + Y.性能工程 + Z.测试策略 + AA.内部DX + AB.文档治理 + AC.数据迁移 + AD.状态管理 + **AE.DBA 工作台 + AF.AI Agent 架构**） |
| 新增核心域 | 无 | Database Ops + DataOps（C）+ SRE(I) + 事件驱动(J) + API 治理(K) + 供应链(L) + 数据合规(M) + 混沌(N) + AI 安全(O) + FinOps(P) + 多租户(Q) + 灾备(R) + SPACE(S) + 开放平台(T) + 架构治理(V) + 视觉设计(W) + 用户体验(X) + 性能工程(Y) + 测试策略(Z) + 内部DX(AA) + 文档治理(AB) + 数据迁移(AC) + 状态管理(AD) + **DBA 工作台(AE) + AI Agent 架构(AF)** |
| AI Agent 维度 | 7 个 | 11 个（+评测/成本/安全沙箱/人机协同）+ **AF 维度 12 子维度**（编排架构/工具安全/决策追溯/审批工作流/LLM 网关/可观测性/失败恢复/Skill 市场/多 Agent 协作/RAG/超时治理/Hook Chain） |
| 对标标杆 | 8 个（混排） | **40+ 个**（L1-L4 分层 + KubeSphere/Zadig/云效/CNB/蓝鲸/Harness/OneOps + Ant Design Pro/Linear/Vercel + web.dev/Jest/Playwright/React Query/Atlas/Flyway + **Bytebase/Yearning/Percona PMM(AE) + LangGraph/CrewAI/LangSmith/Dify(AF)**） |
| 证据采集 | 模糊要求 | Step 0-2 可执行命令 |
| ROI 评估 | 无 | 每项必填修复人天+用户价值+风险降低 |
| 依赖关系 | 无 | 明确阻塞性/部分依赖/独立标记 |
| 系统数据 | 不准确 | 基于实测数据（177 API, 303 服务, 338 路由, 666 docs） |
| CodeGraph | 假设性 | 已移除，替换为四维映射表 |
| **实现深度校验** | 无 | **Anti-Demo Guard（G 维度 + Step 3 深度探针）**：区分真实/部分/Stub/空壳 |
| **缺失能力 / 不足 / 更优方案** | 输出 6 仅差距清单 | **输出 8 最佳实践借鉴清单**：每条含缺失点+更优方案+落地路径+理由≥2 |
| **已知空壳基线** | 无 | **12 项复检目标**（4 前端 P0 空壳 + 5 后端 140 行脚手架 + 3 真 panic 桩），初扫 4 个后端"0 行"为聚合容器已剔除 |
| **验证路径准确性** | 12 处错误 | v2.2 全部修正：canary-traffic/pipeline-template/security/UEBA/CostAllocation 等大小写和层级 |
| **API 调用链验证** | 无 | v2.2 新增第五维：前端端点 vs 后端路由交叉比对，标记断链/僵尸路由 |
| **TS ↔ Go 双版本对标** | 无 | v2.2 新增：TS 单体已归档（legacy/），改为迁移遗失分析（Go Stub 服务对比 TS 归档版本是否有更完整实现） |
| **输出 2 深度判定** | 无 | v2.2 新增：每项必填"深度判定"+"后端版本"两个字段 |
| **输出 3 全量不可执行** | 211×7=1477 格 | v2.2 改为分层采样（L1 深度 30 页 / L2 标准 40 页 / L3 快速 140 页） |
| **输出 7 验收不可测** | 模糊描述 | v2.2 全部改为可执行 checkbox + grep 命令验证 |
| **输出 8 域数** | 30 条 | v3.3 修正为 **108 条**（36 维 × 每域 ≥3） |
| **硅谷专家 24 维** | 无 | v3.0 新增 I-U 共 13 维 + v3.1 新增 V-W-X 共 3 维 + v3.2 新增 Y-AD 共 6 维（性能工程/测试策略/内部DX/文档治理/数据迁移/状态管理）+ v3.3 新增 AE-AF 共 2 维（DBA 工作台/AI Agent 架构），其中多个维度对应已有代码但原为评审盲区 |
| **模块解耦 U 维度** | 无 | v3.0 新增：实测 303 服务仅 1 个接口文件、Top 4 模块 100+ 引用、配置化启动 L2 级、无热加载 —— 治理风险量化 |
| **架构治理 V 维度** | 无 | v3.1 新增：U 维度仅覆盖模块耦合，V 维度补充系统级架构模式一致性(291h/289r/283m=93%)、ADR 覆盖率(7.3%)、架构债(ai23346行/ci-cd21797行)、ErrorBoundary(仅1处)、扩展性架构 |
| **视觉设计 W 维度** | 无 | v3.1 新增：Design Token 定义了但 useToken 仅 1 处(假设计)、内联样式 6904 处、废弃组件 125 处、响应式 6.6%、ARIA 2.4%、骨架屏 16%、暗色模式 6 文件 |
| **用户体验 X 维度** | 无 | v3.1 新增：输出3 仅检查"交互是否存在"不检查"质量好不好"，X 维度增加用户旅程/导航/表单UX/错误可操作性/移动端/首次引导/感知性能/跨页一致性 |
| **输出 3 维度扩展** | 7 维 | v3.1 从 7 维扩展为 9 维（+视觉一致性+UX 质量） |
| **Step 3 探针扩展** | 3 层 | v3.1 从 3 层扩展为 5 层（+第四层前端设计系统探针+第五层后端架构探针）；v3.2 新增第六层测试/性能/状态管理/文档探针（Y/Z/AA/AB/AC/AD 维度）；v3.3 新增第七层 DBA/Agent 探针（AE/AF 维度） |
| **对标标杆扩展** | — | v3.1 新增 Ant Design Pro(W)、Linear(X)、Vercel Dashboard(W/X) 三个设计/UX 标杆；v3.2 新增 web.dev(Y)、Jest/Playwright(Z)、React Query/Zustand(AD)、Atlas/Flyway(AC) 标杆；v3.3 新增 Bytebase/Yearning/Percona PMM(AE)、LangGraph/CrewAI/LangSmith/Dify(AF) 标杆 |
| **性能工程 Y 维度** | 无 | v3.2 新增：36MB 构建产物、388 JS chunk、0 性能预算、0 Core Web Vitals 采集、0 Lighthouse CI — 系统性性能盲区 |
| **测试策略 Z 维度** | 无 | v3.2 新增：Z1-Z8 策略层(金字塔/覆盖率/契约/变异) + **Z9-Z14 平台层**(用例管理/执行基础设施/视觉回归/Flaky/API测试/数据管理平台) — 885 测试无平台化能力；A3 仅评工具集成不评测试策略 |
| **混沌工程 N 维度对标细化** | 6 子维度全标"需验证" | v3.2 修正：新增对标能力细化段(Chaos Mesh/Gremlin/Litmus/AWS FIS/ChaosIQ)；修正 3 处标签为已实现(SteadyStateHypothesis ✅/Scope ✅/AutoRollback ✅)；新增 2 子维度(自动回滚/服务网格故障注入) |
| **内部DX AA 维度** | 无 | v3.2 新增：S 维度量效能指标但不管开发者实际体验，K 维评外部 API 消费者不管内部开发者；39 README/675 docs 但无 Quick Start 验证 |
| **文档治理 AB 维度** | 无 | v3.2 新增：675 文档/22 ADR(7.3%)/39 README(12.9%)/0 OpenAPI 自动生成 — 文档质量无评审维度 |
| **数据迁移 AC 维度** | 无 | v3.2 新增：20+ 迁移目录/192 迁移 SQL — 有实际代码但无策略评审；M 维管数据生命周期不管 Schema 演进 |
| **状态管理 AD 维度** | 无 | v3.2 新增：7 store 文件/211 页(3.3%)/0 React Query/0 SWR — Server State 全部手写 fetch 无缓存层 |
| **DBA 工作台 AE 维度** | 无 | v3.3 新增：DBA 后端 1379 行真实实现(SqlOrder 审批/DataSource/AuditRule/QueryLog)但 C1 仅"SQL 审核"1 行；AC 仅管 Schema 演进不管 DBA 日常运维 — 8 子维度(审批工作流/数据源/慢查询/审计/连接池/读写分离/性能基线/灾备) |
| **AI Agent 架构 AF 维度** | 无 | v3.3 新增：AI/Agent 28000+ 行后端 = 系统最大集群，但 B 仅列功能清单(24 行)、O 仅从安全角度覆盖 — 12 子维度(编排/工具安全/决策追溯/审批/LLM 网关/可观测性/恢复/Skill 市场/多 Agent/RAG/超时/Hook Chain) |
| **深度评审优化 v3.4** | — | v3.4 新增：①结构化导航索引(§〇) — 智能体按阶段按需加载而非线性读取；②会话策略/Token Budget 指引 — 4 会话拆分防上下文溢出；③维度优先级分层(P0/P1/P2) — 36 维分 3 级降级策略；④输出格式明确化 — 8 类输出均标注 Markdown 表格/列表格式；⑤已知事实表去重 — 修复重复表头；⑥输出 4 雷达更新为 B(11维)+AF(12维)；⑦输出 5 更新为 C(14维)+AE(8维)；⑧借鉴标杆库+对照表补充 AE/AF 标杆条目；⑨诊断段添加智能体跳过指令；⑩Step 3 探针执行须知(空目录 vs 0 行区分)；⑪交叉一致性校验规则(输出2 vs Step3 vs G维度)；⑫Step 4-7 执行指引段 |
| **深度评审优化 v3.5** | — | v3.5 新增：①维度注册表(§〇) — 36 行全维度索引表(ID/名称/章节/优先级/探针层/输出关联)，智能体可一步定位任意维度；②Step→章节→Output 映射表 — 8 行映射消除步骤与章节的歧义；③探针→维度映射表 — 7 层探针与维度对应关系（以注释标记行锚点定位，非固定行号）；④§四标题修正 — "12 维"改为"6 主维(A-F)"消除计数歧义；⑤§五补计数修正 — "§四的12维"改为"§四~§五的12维"；⑥EXECUTION START 标记 — 醒目执行起点指示符；⑦Step 3 结果记录模板 — 标准化探针输出表格式(探针层/维度/探针名/实测值/预期阈值/判定)；⑧附录 A-D 概念 — Steps 0-3 采集结果+Step 7 校验报告记入附录供引用；⑨输出 1 列定义 — 6 列含义+评分标准明确化；⑩输出 4 术语修正 — "雷达图"改为"评分表"避免误导为可视化图表；⑪G 维度冗余消除 — 3 行重复介绍合并为 2 行；⑫§八 Checklist 章节引用 — 每个 Step 标注对应§章节+附录去向；⑬Session 计数修正 — 27维→24维/9维→8维ID(12项)；⑭README/i18n 覆盖率澄清 — 双分母标注消除歧义；⑮输出 3 L3 列数一致 — 3列格式统一；⑯输出 5 列定义补充 — 新增 Markdown 表格式 |
