# Orion 设计文档使用指南 (LLM Context Management Guide)

> **文档版本**: v1.0 | **创建日期**: 2026-04-10 | **状态**: ✅ 新建

---

## 一、问题背景

### 1.1 当前文档规模

| 指标 | 数值 | 挑战 |
|------|------|------|
| 文档总数 | 85+ 个 | 超出单次上下文窗口 |
| 总行数 | ~50,000 行 | 无法一次性读取 |
| 总字数 | ~600,000 字 | 约 1.5M tokens |
| 文档分类 | 21 个目录 | 结构复杂 |
| 设计完成度 | 98% | 仍有 2% 待设计 |

### 1.2 选择性理解问题

**问题表现**:
```
❌ 问题 1: 模型只读取部分文档就给出答案
❌ 问题 2: 忽略文档间的依赖关系
❌ 问题 3: 使用过时的文档版本
❌ 问题 4: 混淆已完成和待设计内容
❌ 问题 5: 无法定位关键设计决策
```

**根本原因**:
- 上下文窗口限制（通常 128K-200K tokens）
- 文档缺乏优先级标注
- 缺少设计决策摘要
- 文档状态不清晰

---

## 二、解决方案架构

### 2.1 文档分层策略

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 核心摘要层 (必读，~5K tokens)                          │
│  ─────────────────────────────────────────────────────────────  │
│  • 00-文档索引与任务分发.md (状态矩阵)                           │
│  • DESIGN-SUMMARY.md (设计决策摘要) ⭐ 新建                      │
│  • API-QUICK-REFERENCE.md (API 速查) ⭐ 新建                     │
│  └─────────────────────────────────────────────────────────────┘
│                              │
│                              ▼
│  ┌─────────────────────────────────────────────────────────────────┐
│  │  Layer 2: 模块设计层 (按需读取，~50K tokens)                     │
│  │  ─────────────────────────────────────────────────────────────  │
│  │  • docs/adr/*.md (架构决策记录)                                 │
│  │  • docs/architecture/*.md (架构设计)                            │
│  │  • docs/frontend/*.md (前端设计)                                │
│  │  • docs/security/*.md (安全设计)                                │
│  │  └── 每个模块 1 个主设计文档                                     │
│  └─────────────────────────────────────────────────────────────────┘
│                              │
│                              ▼
│  ┌─────────────────────────────────────────────────────────────────┐
│  │  Layer 3: 详细实现层 (深度查询，~200K tokens)                    │
│  │  ─────────────────────────────────────────────────────────────  │
│  │  • 所有详细设计文档                                             │
│  │  • 代码示例                                                     │
│  │  • API 完整定义                                                  │
│  │  • 配置 Schema                                                  │
│  └─────────────────────────────────────────────────────────────────┘
```

### 2.2 文档状态标注规范

**在每份文档开头添加状态元数据**:

```markdown
# 文档标题

> **状态**: ✅ 已完成 | ⚠️ 进行中 | ❌ 待设计 | 🔄 需更新
> **优先级**: P0 (核心) | P1 (重要) | P2 (可选)
> **最后更新**: 2026-04-10
> **依赖文档**: [文档 A](./a.md), [文档 B](./b.md)
> **被依赖文档**: [文档 C](./c.md)
> **关键决策**: 是/否
> **设计完成度**: 95%
```

### 2.3 设计决策摘要文档

创建 `DESIGN-SUMMARY.md`，包含所有关键设计决策的 1 页摘要：

```markdown
# Orion 关键设计决策摘要

## 架构决策

### ADR-001: 核心域 vs 支撑域划分
- **决策**: 采用核心域 + 支撑域架构
- **状态**: ✅ 已完成
- **影响**: 所有服务设计
- **详见**: docs/adr/ADR-001-ProductLine-CRD 设计.md

### ADR-002: Plugin SPI 接口设计
- **决策**: 混合方案（gRPC+WASM/HTTP+ 容器/SDK+ 进程）
- **状态**: ✅ 已完成
- **影响**: 插件开发
- **详见**: docs/adr/ADR-002-Plugin-SPI 接口设计.md

## 技术栈选型

| 模块 | 技术栈 | 版本 | 状态 |
|------|--------|------|------|
| 前端基座 | Vue 3 | 3.2.39 | ✅ 已确定 |
| 微前端 | qiankun | 2.x | ✅ 已确定 |
| 后端框架 | Go + Gin | 1.19+ | ✅ 已确定 |
| 数据库 | PostgreSQL | 15+ | ✅ 已确定 |

## 待设计内容 (2%)

| 模块 | 缺失内容 | 优先级 | 预计完成 |
|------|---------|--------|---------|
| API 版本管理 | v1/v2 演进策略 | P1 | Phase 3 |
| 缓存层设计 | Redis 使用场景 | P1 | Phase 3 |

### 已完成文档 (本次更新)

| 分类 | 文档 | 状态 |
|------|------|------|
| **Non-Functional** | 性能需求规格.md | ✅ 已完成 |
| **Requirements** | 验收标准.md | ✅ 已完成 |
| **QA** | 测试策略与测试设计.md | ✅ 已完成 |
| **SRE** | 运维设计详解.md | ✅ 已完成 |
| **Risk** | 技术风险评估.md | ✅ 已完成 |
```

---

## 三、LLM 提示词模板

### 3.1 标准查询模板

```markdown
# 角色设定
你是 Orion 平台架构助手，需要基于设计文档回答问题。

# 文档读取规则
1. **必须首先读取**: 
   - 00-文档索引与任务分发.md (了解文档状态)
   - DESIGN-SUMMARY.md (了解关键决策)

2. **根据问题类型读取对应模块**:
   - 架构问题 → docs/adr/ + docs/architecture/
   - 前端问题 → docs/frontend/
   - 安全问题 → docs/security/
   - API 问题 → docs/api/

3. **检查文档状态**:
   - 只引用 ✅ 已完成 的文档
   - 标注 ⚠️ 进行中 的文档为"设计中"
   - 标注 ❌ 待设计 的文档为"待设计"

4. **引用规范**:
   - 必须标注文档来源：`[文档名](路径)`
   - 必须标注设计状态：`[✅ 已完成]`
   - 如有冲突，以高优先级文档为准

# 问题
[用户问题]

# 回答要求
1. 先说明基于哪些文档
2. 标注每个设计点的状态
3. 如信息不完整，明确说明缺失内容
4. 提供相关文档链接
```

### 3.2 设计评审模板

```markdown
# 角色设定
你是 Orion 平台设计评审委员会，需要评估设计的一致性和完整性。

# 评审流程

## Step 1: 读取核心文档 (必做)
- [ ] 00-文档索引与任务分发.md
- [ ] DESIGN-SUMMARY.md
- [ ] Orion-完整设计方案.md

## Step 2: 读取相关模块设计 (根据评审内容)
- [ ] docs/adr/ (架构决策)
- [ ] docs/architecture/ (架构设计)
- [ ] docs/frontend/ (前端设计)
- [ ] docs/security/ (安全设计)

## Step 3: 检查设计一致性
- [ ] 与核心架构是否一致
- [ ] 与 ADR 决策是否冲突
- [ ] 技术栈选型是否统一
- [ ] API 规范是否一致

## Step 4: 检查设计完整性
- [ ] 是否覆盖所有 P0 功能
- [ ] 是否有未设计的依赖模块
- [ ] 是否有矛盾的设计点

## Step 5: 输出评审报告
格式：
```
## 评审结果

### ✅ 一致的设计点
1. ...

### ⚠️ 需要协调的设计点
1. ...

### ❌ 冲突的设计点
1. ...

### 📋 缺失的设计
1. ...

### 📎 参考文档
- [文档名](路径) - 状态
```
```

### 3.3 代码生成模板

```markdown
# 角色设定
你是 Orion 平台开发工程师，需要基于设计文档生成代码。

# 代码生成规则

## 1. 必须读取的设计文档
- [ ] 相关模块设计文档 (✅ 已完成)
- [ ] API 设计规范 (docs/api/API 设计规范.md)
- [ ] 前端组件规范 (docs/frontend/前端组件库设计.md)

## 2. 技术栈约束
- 前端：Vue 3.2.39 + Ant Design Vue 3.2.15 + TypeScript 4.3
- 后端：Go 1.19+ + Gin
- 状态管理：Vuex 4 / Redux
- 构建工具：Vite 3.1 / Webpack 5

## 3. 代码规范要求
- 遵循现有代码风格（参考 orion-dba/frontend）
- 使用设计文档定义的组件和 API
- 遵循错误码规范（docs/api/API 分页与错误码规范.md）
- 遵循日志规范（docs/sre/可观测性设计.md）

## 4. 禁止行为
- ❌ 不使用设计文档未定义的技术栈
- ❌ 不创建设计文档未定义的 API
- ❌ 不违反架构设计的分层规则

# 任务
[代码生成任务]

# 输出要求
1. 说明基于哪些设计文档
2. 标注与设计文档的差异（如有）
3. 提供完整的代码和说明
```

---

## 四、文档组织优化

### 4.1 创建文档依赖图

```markdown
# 文档依赖关系 (docs/DEPENDENCY-GRAPH.md)

## 核心文档 (无依赖)
- README.md
- 00-文档索引与任务分发.md
- Orion-完整设计方案.md

## 架构层 (依赖核心文档)
- docs/architecture/架构设计详解.md
  └─ 依赖：Orion-完整设计方案.md
- docs/adr/ADR-001-ProductLine-CRD 设计.md
  └─ 依赖：架构设计详解.md

## 模块层 (依赖架构层)
- docs/frontend/前端架构设计.md
  └─ 依赖：架构设计详解.md
- docs/security/安全与权限详解.md
  └─ 依赖：架构设计详解.md

## 实现层 (依赖模块层)
- docs/frontend/前端组件库设计.md
  └─ 依赖：前端架构设计.md
```

### 4.2 创建模块索引

为每个模块创建 `README.md` 索引：

```markdown
# docs/frontend/README.md

## 前端设计文档索引

### 核心设计
| 文档 | 状态 | 优先级 | 说明 |
|------|------|--------|------|
| [前端架构设计.md](./前端架构设计.md) | ✅ | P0 | 技术栈选型、状态管理 |
| [微前端开发规范.md](./micro-frontend-development-guide.md) | ✅ | P0 | 微前端集成规范 |

### 组件设计
| 文档 | 状态 | 优先级 | 说明 |
|------|------|--------|------|
| [前端组件库设计.md](./前端组件库设计.md) | ✅ | P0 | 组件规范 |
| [审批组件库.md](./审批组件库.md) | ✅ | P0 | 审批组件 |

### 性能优化
| 文档 | 状态 | 优先级 | 说明 |
|------|------|--------|------|
| [前端性能优化设计.md](./前端性能优化设计.md) | ✅ | P1 | 性能优化 |
| [组件状态管理优化.md](./组件状态管理优化.md) | ✅ | P1 | 状态优化 |

### API 规范
| 文档 | 状态 | 优先级 | 说明 |
|------|------|--------|------|
| [API 层设计规范.md](./API 层设计规范.md) | ✅ | P0 | API 规范 |
| [WebSocket 认证集成设计.md](./WebSocket 认证集成设计.md) | ✅ | P0 | WebSocket |

## 快速查询
- 架构问题 → 前端架构设计.md
- 组件问题 → 前端组件库设计.md
- 性能问题 → 前端性能优化设计.md
- API 问题 → API 层设计规范.md
```

### 4.3 创建设计决策日志

```markdown
# 设计决策日志 (docs/DESIGN-DECISION-LOG.md)

## 2026-04-10

### 决策：缓存配置设计
- **ID**: DDL-2026-04-10-001
- **状态**: ✅ 已批准
- **影响范围**: CI-CD 模块
- **决策内容**: 
  - 支持全局/流水线/任务三级缓存开关
  - 支持 LRU/LFU/FIFO 三种淘汰策略
  - 缓存命中率监控告警
- **参考文档**: docs/cicd/构建缓存配置设计.md
- **替代方案**: 无
- **评审人**: 架构委员会

### 决策：微前端集成规范
- **ID**: DDL-2026-04-10-002
- **状态**: ✅ 已批准
- **影响范围**: 所有前端模块
- **决策内容**:
  - 统一使用 qiankun 微前端框架
  - 支持独立运行和微前端嵌入两种模式
  - Orion 全局状态注入规范
- **参考文档**: docs/frontend/micro-frontend-development-guide.md
- **替代方案**: vite-plugin-federation
- **评审人**: 架构委员会

## 待决策事项

### 议题：API 版本管理策略
- **ID**: DDL-PENDING-001
- **优先级**: P1
- **预计决策日期**: Phase 3
- **讨论区**: [链接]
```

---

## 五、上下文管理工具

### 5.1 文档摘要生成脚本

```python
#!/usr/bin/env python3
"""
生成设计文档摘要，帮助 LLM 快速理解文档内容
"""

import os
import json
from pathlib import Path

def generate_summary(doc_path: str) -> dict:
    """生成文档摘要"""
    with open(doc_path, 'r') as f:
        content = f.read()
    
    # 提取元数据
    metadata = extract_metadata(content)
    
    # 提取关键决策
    decisions = extract_decisions(content)
    
    # 提取 API 定义
    apis = extract_apis(content)
    
    # 提取配置 Schema
    schemas = extract_schemas(content)
    
    return {
        'path': doc_path,
        'status': metadata.get('status', 'unknown'),
        'priority': metadata.get('priority', 'P2'),
        'dependencies': metadata.get('dependencies', []),
        'decisions': decisions,
        'apis': apis,
        'schemas': schemas,
        'word_count': len(content.split()),
        'summary': content[:1000] + '...'  # 前 1000 字摘要
    }

def create_index():
    """创建文档索引"""
    docs_dir = Path('docs')
    index = []
    
    for doc in docs_dir.rglob('*.md'):
        summary = generate_summary(str(doc))
        index.append(summary)
    
    # 保存索引
    with open('docs/DOCUMENT-INDEX.json', 'w') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    
    print(f"Indexed {len(index)} documents")

if __name__ == '__main__':
    create_index()
```

### 5.2 文档检索脚本

```python
#!/usr/bin/env python3
"""
根据问题检索相关文档
"""

import json
from pathlib import Path
from typing import List

def search_docs(query: str, limit: int = 5) -> List[dict]:
    """搜索相关文档"""
    with open('docs/DOCUMENT-INDEX.json', 'r') as f:
        index = json.load(f)
    
    # 简单关键词匹配
    results = []
    for doc in index:
        score = 0
        query_terms = query.lower().split()
        
        # 标题匹配
        for term in query_terms:
            if term in doc['path'].lower():
                score += 10
        
        # 摘要匹配
        for term in query_terms:
            if term in doc['summary'].lower():
                score += 5
        
        # 决策匹配
        for decision in doc.get('decisions', []):
            if query in decision.lower():
                score += 20
        
        if score > 0:
            results.append({
                'path': doc['path'],
                'status': doc['status'],
                'priority': doc['priority'],
                'score': score
            })
    
    # 按分数排序
    results.sort(key=lambda x: x['score'], reverse=True)
    
    return results[:limit]

if __name__ == '__main__':
    import sys
    query = ' '.join(sys.argv[1:])
    results = search_docs(query)
    
    print(f"找到 {len(results)} 个相关文档:\n")
    for r in results:
        status_icon = {'✅': '完成', '⚠️': '进行中', '❌': '待设计'}.get(r['status'], '')
        print(f"- {r['path']} [{status_icon}] (优先级：{r['priority']}, 匹配度：{r['score']})")
```

---

## 六、使用工作流

### 6.1 标准查询工作流

```
用户提问
    │
    ▼
┌─────────────────┐
│ Step 1: 读取    │
│ - 00-文档索引   │
│ - DESIGN-SUMMARY│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 2: 识别    │
│ 问题类型        │
│ - 架构？        │
│ - 前端？        │
│ - 安全？        │
│ - API?          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 3: 读取    │
│ 对应模块文档    │
│ (检查状态✅)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 4: 检查    │
│ 文档依赖关系    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 5: 生成    │
│ 答案 + 引用     │
└────────┬────────┘
         │
         ▼
    返回答案
```

### 6.2 设计评审工作流

```
评审请求
    │
    ▼
┌─────────────────┐
│ Step 1: 读取    │
│ 核心文档 (必做)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 2: 读取    │
│ 被评审文档      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 3: 检查    │
│ 与核心架构一致性│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 4: 检查    │
│ 与 ADR 决策一致性 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 5: 检查    │
│ 设计完整性      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 6: 输出    │
│ 评审报告        │
└────────┬────────┘
         │
         ▼
    返回报告
```

---

## 七、最佳实践

### 7.1 文档编写规范

```markdown
# 文档模板

# {文档标题}

> **状态**: ✅ 已完成 | ⚠️ 进行中 | ❌ 待设计
> **优先级**: P0 | P1 | P2
> **最后更新**: YYYY-MM-DD
> **依赖文档**: [列表](链接)
> **被依赖文档**: [列表](链接)
> **关键决策**: 是/否
> **设计完成度**: XX%

---

## 一、概述
(200-500 字摘要)

## 二、设计决策
(关键决策点)

## 三、详细设计
(核心内容)

## 四、API 定义
(如有)

## 五、配置 Schema
(如有)

## 六、验收标准
(检查清单)

## 七、参考文档
(链接列表)
```

### 7.2 文档更新流程

```
1. 修改文档内容
    │
    ▼
2. 更新文档开头状态元数据
    │
    ▼
3. 更新 DESIGN-SUMMARY.md 对应条目
    │
    ▼
4. 更新 00-文档索引与任务分发.md
    │
    ▼
5. 更新 DESIGN-DECISION-LOG.md
    │
    ▼
6. 提交 PR，标注影响的模块
```

### 7.3 LLM 使用建议

| 场景 | 推荐文档 | 上下文大小 |
|------|---------|-----------|
| 架构咨询 | DESIGN-SUMMARY + docs/adr/ | ~30K tokens |
| 前端开发 | docs/frontend/README + 对应文档 | ~50K tokens |
| API 设计 | docs/api/ + DESIGN-SUMMARY | ~20K tokens |
| 代码生成 | 模块设计 + API 规范 + 组件规范 | ~80K tokens |
| 设计评审 | 核心文档 + 被评审文档 | ~100K tokens |

---

## 八、工具与脚本

### 8.1 可用脚本

| 脚本 | 用途 | 位置 |
|------|------|------|
| `generate_summary.py` | 生成文档摘要 | scripts/ |
| `search_docs.py` | 检索相关文档 | scripts/ |
| `check_consistency.py` | 检查设计一致性 | scripts/ |
| `update_index.py` | 更新文档索引 | scripts/ |

### 8.2 推荐工具

| 工具 | 用途 | 配置 |
|------|------|------|
| **Obsidian** | 文档浏览 | 加载 docs/ 目录 |
| **VS Code** | 文档编辑 | Markdown All in One 插件 |
| **grep** | 快速搜索 | `grep -r "pattern" docs/` |
| **jq** | JSON 索引查询 | `jq '.[] | select(.status=="✅")' DOCUMENT-INDEX.json` |

---

## 九、检查清单

### 9.1 提问前检查

- [ ] 是否已阅读 DESIGN-SUMMARY.md
- [ ] 是否已查看 00-文档索引与任务分发.md
- [ ] 是否已确认问题对应的模块
- [ ] 是否已检查文档状态（✅/⚠️/❌）

### 9.2 回答时检查

- [ ] 是否标注了引用的文档
- [ ] 是否标注了设计状态
- [ ] 是否检查了文档依赖关系
- [ ] 是否说明了信息完整性

### 9.3 设计评审检查

- [ ] 是否与核心架构一致
- [ ] 是否与 ADR 决策一致
- [ ] 是否有未设计的依赖
- [ ] 是否有矛盾的设计点

---

## 十、持续改进

### 10.1 反馈机制

发现以下问题请更新本文档：

- [ ] 文档引用缺失
- [ ] 设计决策冲突
- [ ] 文档状态不准确
- [ ] 依赖关系错误

### 10.2 定期维护

- **每周**: 更新 DESIGN-DECISION-LOG.md
- **每月**: 审查文档状态标注
- **每季度**: 优化文档结构

---

_文档版本：v1.0 | 最后更新：2026-04-10 | 维护团队：Orion Platform Team_
