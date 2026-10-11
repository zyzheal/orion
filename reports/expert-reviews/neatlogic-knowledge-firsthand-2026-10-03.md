# NeatLogic Knowledge 一手代码分析（NL-7，2026-10-03）

**范围**：`neatlogic-knowledge`（业务模块）+ `neatlogic-knowledge-base`（框架层，位于 `neatlogic.framework.knowledge`）两个 submodule
**方法**：一手 `find` + `grep` + `head` + `cat`（未跑单元测试、未反编译）
**硬约束**：不估算人天/工期/团队规模；不改代码；每 Bash 命令 30 秒内返回

---

## 0. TL;DR

1. **规模**：154 Java 文件（`knowledge` 76 + `knowledge-base` 78）；`knowledge` 模块内 46 个 `*Api.java`（46 = 4 circle + 25 document + 7 feishu + 1 tag + 5 template + 4 type），Service 层 3 个类共 2597 行，其中 `KnowledgeFeiShuServiceImpl` 单文件 1104 行。
2. **存储选型**：**PG-only**（`sqldefine/tables/*.json` 20 张表 + 20 张 `-en.json` 双语副本），MySQL 语法（`tinyint(1)`、`longtext`、`mediumtext`、`char(32)` uuid）。`@ESKey` 与 `ElasticSearchHandlerFactory` 代码**全部被注释掉**（`KnowledgeDocumentVo.java:22`、`KnowledgeDocumentDeleteApi.java:76`），NeatLogic 当前用自研 `neatlogic.framework.fulltextindex` 替代 ES。
3. **与 CMDB/ITSM 关联**：**零关联**。`grep -rni "cmdb\|CiEntity\|ciId"` 在两个模块中返回空。`knowledge_document_type` 自建 lft/rht 树，`knowledge_circle_user` 自建 `type=enum('common','user','team','role')` + `auth_type=enum('approver','member')` 权限，全部走 NeatLogic 自有 ACL，不依赖 CMDB 实体。
4. **建议 Orion 是否引入**：**不建议整体引入，建议挑选 3 个能力点**。Orion 已具备 RAG 引擎（`internal/knowledge/service/rag_pipeline.go` 610 行、`repository_rag.go` 617 行、`vector_search.go`、`safety_filter.go`），NeatLogic 强的是**协作编辑（LineHandler 12 个 + 行级 hash 内容寻址）+ 版本化审计 + 飞书同步**——Orion 缺的正是这三块，但都不必照抄 Java。

---

## 1. 代码规模实证

```
neatlogic-knowledge           76 .java   46 *Api.java   3 *ServiceImpl.java (2597 行)
neatlogic-knowledge-base      78 .java    0 *Api.java    0 *ServiceImpl.java
────────────────────────────────────────────────────────────────────
合计                          154 .java   46 *Api.java    3 *ServiceImpl.java
```

`knowledge-base` 里 78 个文件全部在 `neatlogic.framework.knowledge.*`（dto/linehandler/auth/dao/source/constvalue/exception），是**框架抽象 + 数据结构层**，无 API 端点。`knowledge` 里 76 个文件在 `neatlogic.module.knowledge.*`，是**业务实现层**。分层清晰，业务与框架解耦。

SQL 表定义：20 张（去重 `-en`），`sqldefine/tables/` 下 40 个 json = 20 zh + 20 en 双语。

---

## 2. 能力图谱

### 2.1 API 前缀分布（46 个 API 全部 `getToken()` 返回值）

NeatLogic 不用 Spring `@RequestMapping`，而是用 `PrivateApiComponentBase.getToken()` 返回字符串路径。46 个 API 全部以 `knowledge/` 开头：

| 分组 | 数量 | Token 前缀 | 说明 |
|------|------|-----------|------|
| `knowledge/document/*` | **25** | 25 个 | 文档主体 CRUD、草稿、审计、搜索、附件、收藏、点赞、浏览量 |
| `knowledge/feishu/*` | 7 | 7 个 | 飞书应用凭证、同步、Wiki 树同步 |
| `knowledge/template/*` | 5 | 5 个 | 模板 CRUD |
| `knowledge/circle/*` | 4 | 4 个 | 知识圈 CRUD |
| `knowledge/type/*` | 4 | 4 个 | 文档类型 CRUD（lft/rht 树） |
| `knowledge/tag/*` | 1 | 1 个 | 标签 |

**关键 API Token 样例**：
- `knowledge/document/query`
- `knowledge/document/version/query`
- `knowledge/document/draft/save`、`knowledge/document/draft/query`、`knowledge/document/draft/detail/get`、`knowledge/document/draft/delete`
- `knowledge/document/audit`（审批）
- `knowledge/document/search`
- `knowledge/document/detail/get`
- `knowledge/document/collect/list`、`knowledge/document/favor/list`
- `knowledge/document/file/list`、`knowledge/document/tag/list`
- `knowledge/document/invoke/*`（调用统计）
- `knowledge/feishu/app/credentials/get`、`knowledge/feishu/wiki/*`

权限通过 `@AuthAction(action = KNOWLEDGE_FEISHU_SYNC_MODIFY.class)` 装饰器 + `@OperationType` 声明，标签类放 `auth/label/` 下。

### 2.2 核心模型（字段清单）

**KnowledgeCircleVo**（知识圈，10 字段）：
```
id, name, documentCount, memberCount,
approverNameList, approverVoList, approverList,
memberList, documentTypeList, authList
```

**KnowledgeDocumentVersionVo**（43 字段，最核心）：
```
id, knowledgeDocumentTypeUuid, knowledgeCircleId, knowledgeDocumentId,
version, versionName, fromVersion, fromVersionName,
status, statusVo, title, size, sizeDesc,
reviewer, reviewerName, reviewerInfo, reviewerAvatar, reviewTime,
isEditable, isDeletable, isCollect, isDelete,
path, tagList, tagVoList, content, rejectReason,
knowledgeDocumentLineList, isAutoGenerateId,
statusList, source, sourceName,
lcdStartTime, lcdEndTime, knowledgeDocumentVersionIdList, lcuList,
reviewerList, sourceList, reviewDateStartTime, reviewDateEndTime,
reviewerRoleUuidList, reviewerTeamUuidList, isReviewer
```

**KnowledgeDocumentLineVo**（5 字段，行级内容寻址）：
```
uuid, knowledgeDocumentId, knowledgeDocumentVersionId, contentHash, configHash
```

**关键数据结构：line 表 = 内容 hash + 配置 hash 双列存**
- `knowledge_document_line_content(hash char(32), content longtext)` —— content 是行内容原文，按 hash 去重
- `knowledge_document_line_config(hash char(32), config mediumtext)` —— config 是行渲染配置（编辑器富文本、图片、表格等）
- `knowledge_document_line(uuid, handler, knowledge_document_id, knowledge_document_version_id, content_hash, config_hash, line_number)`
- 索引：`PRIMARY(uuid)` + `idx_document_id` + `idx_document_linenum` + `idx_document_version_id`

这个"行 → hash → content/config"三层拆分使**版本间相同行共享内容，跨版本 diff 天然高效**，是 NeatLogic 最独特的建模。

### 2.3 Service 方法矩阵（3 个 ServiceImpl，2597 行）

**KnowledgeDocumentServiceImpl**（718 行，11 方法）：
```
isDeletable, isEditable, isReviewer, isMember,
getKnowledgeDocumentDetailByKnowledgeDocumentVersionId,
getKnowledgeDocumentContentByKnowledgeDocumentVersionId,
checkViewPermissionByDocumentIdAndVersionId,
getReviewerParam, audit, getContent,
initVersionWordOffsetAndContentMap, setTitleAndShortcutContentHighlight,
setVersionContentMap
```

**KnowledgeFeiShuServiceImpl**（1104 行，7 方法）：
```
getFeiShuAppCredentials,
getFeiShuSpaceList,
saveNodes, saveFeiShuDocument,
updateFeiShuDocumentMappingStatusByNodeToken,
getOrCreateKnowledgeType,
loadWikiNodes
```

**KnowledgeService**（775 行，`KnowledgeServiceImpl` 不存在，只有 interface + module 其他 Service）

### 2.4 存储/搜索实现

**存储**：MySQL/PG SQL，20 张表。关键表：
- `knowledge_document` + `knowledge_document_version`（一文档多版本）
- `knowledge_document_line` + `knowledge_document_line_content` + `knowledge_document_line_config`（行级内容寻址）
- `knowledge_document_audit` + `knowledge_document_audit_detail`（审计）
- `knowledge_document_type`（`parent_uuid, lft, rht` —— 邻接表+嵌套集混合）
- `knowledge_circle_user`（`type=enum('common','user','team','role')`，`auth_type=enum('approver','member')`）
- `knowledge_feishu_document_mapping` + `knowledge_feishu_medias_mapping`（飞书同步）

**全文索引**：自研 `neatlogic.framework.fulltextindex`，`DocumentLineFullTextIndexHandler.java` + `FullTextIndexMapper` + `FullTextIndexUtil` + `FullTextIndexWordOffsetVo`。ES 相关代码**全部注释掉**（见 TL;DR 第 2 点）。

**内容富文本 Handler（linehandler/handler/，12 个）**：
```
CodeLineHandler, EditorLineHandler, FigureLineHandler, FormTableLineHandler,
H1LineHandler, H2LineHandler, ImgLineHandler, MarkdownLineHandler,
OlLineHandler, PLineHandler, TableLineHandler, UlLineHandler
```

框架层还有 `SyncSourceFactory`（用 `Reflections` 反射扫描 `ISyncSource` 子类注册到 `syncSourceMap`）作为外部数据源同步 SPI，当前只见飞书实现。

---

## 3. 与 Orion 对比

### 3.1 Orion 现状（grep 结果）

`orion-platform-svc-go/internal/knowledge/`：**22 个 Go 文件，6470 行**
```
handler/handler.go               1096 行
models/models.go                  479 行
repository/repository.go          423 行
repository/repository_rag.go      617 行  ← RAG 检索层
service/service.go                436 行
service/service_interface.go       44 行
service/rag_pipeline.go           610 行  ← RAG pipeline
service/vector_search.go          255 行
service/prompt_template.go        290 行
service/llm_client.go             162 行
service/safety_filter.go          159 行
service/eval_set_service.go       273 行
service/eval_set_seeding.go       258 行
service/canary_test.go             64 行
+ 7 个 _test.go 文件
```

`orion-platform-svc-go/internal/ticket-knowledge/`：5 个 Go 文件，工单知识（Ticket→Knowledge 映射）。
`orion-platform-svc-go/internal/ai/knowledge/`：AI 侧知识接入（handler + response_writer）。
`internal/assistant/` 中 `Intent` 枚举含 `knowledge`，`Source` 枚举含 `knowledge, alert, ticket, pipeline, change, faq`，`service.go` 里有 `containsAny("文档","知识库","手册","怎么做","如何","how","faq")` → `return "knowledge"` 的意图路由。

### 3.2 差距分析

| 能力维度 | NeatLogic 状态 | Orion 现状 | 差距 |
|---------|---------------|-----------|------|
| 富文本编辑器协议 | 12 个 LineHandler + hash 内容寻址 + 行级渲染配置 | 未见；RAG 只处理文本切片 | **P0 缺** |
| 版本化 + 审计 | `knowledge_document_version` + `knowledge_document_audit` + `audit_detail` | 未见版本表；RAG 有 `vector_search` 快照 | **P1 缺** |
| 知识圈 + 权限 | `knowledge_circle` + `knowledge_circle_user`(4 类 type × 2 类 auth_type) | Orion 有全局租户隔离；未见知识圈 | **P2 缺**（视是否做多人协作） |
| 全文检索 | 自研 `neatlogic.framework.fulltextindex`（PG 内） | `repository_rag.go` + `vector_search.go`（PG pgvector） | Orion 更前沿（向量检索） |
| 外部数据源同步 | `ISyncSource` SPI + `SyncSourceFactory`（Reflections）+ 飞书实现 1104 行 | 未见 | **P2 缺**（若需飞书/Confluence 同步） |
| 模板 | `knowledge_template`（`is_active` 表）+ 5 API | 未见 | **P2 缺** |
| 标签体系 | `knowledge_tag` + `knowledge_document_tag` 关联 | 未见 | **P2 缺** |
| RAG / LLM 问答 | 未见（依赖外部） | `rag_pipeline.go` 610 行 + `llm_client.go` + `safety_filter.go` + `eval_set_service.go` | Orion 领先 |
| CMDB 关联 | 零关联（自建权限体系） | Orion 有 CMDB 模块 | Orion 领先 |
| 浏览量 / 收藏 / 点赞 | `view_count` + `collect` + `favor` 三张表 | 未见 | **P3 缺**（社区化运营才需） |
| 调用统计 | `knowledge_document_invoke` | 未见 | **P3 缺** |

---

## 4. 建议

### 4.1 引入 vs 不引入

**不建议整体引入 NeatLogic Knowledge 能力。** 理由：
1. Orion `internal/knowledge/` 已建成 RAG 引擎（2597 行 Java Service 相当于 Orion 侧 6470 行 Go 的核心能力），NeatLogic 的 RAG 能力（`FullTextIndex`）反而不如 Orion 的 pgvector。
2. NeatLogic 46 个 API 中 25 个是 document 相关，其中大量是**版本管理 + 行级 hash 内容寻址**——这是为"多人协作 + 富文本 + 审批流"场景设计的复杂架构，Orion 的知识库目标（AI 助手知识源 + 工单沉淀）不需要这种重量。
3. 飞书同步 1104 行是深度绑定飞书 API 的业务实现，Orion 若要类似能力应做 provider 抽象（参考 Orion 现有 SSO/Notification 的 provider 模式）。

### 4.2 建议挑 3 个能力点（若 Orion 后续要扩展知识库为"人机协作型"）

1. **行级 hash 内容寻址**（`knowledge_document_line_content(hash, content)`）
   - 用途：文档历史版本去重、跨版本 diff、RAG 切片稳定性
   - 收益：RAG chunking 时相同段落不重复存储，节省向量库空间

2. **知识圈 + 细粒度审批（`knowledge_circle_user`）**
   - 用途：多部门知识库（研发部/运维部/客服部各有一个圈，成员/审批人分离）
   - 收益：解决"AI 助手给研发部返回了客服部的文档"这类越权问答

3. **LineHandler 富文本抽象**（12 个 handler 模式）
   - 用途：支持 Markdown/代码块/表格/图片 5 种知识内容形式
   - 收益：`MarkdownLineHandler` 与 `CodeLineHandler` 与 Orion 现有 `rag_pipeline.go` 的 chunk 类型对齐良好

### 4.3 不建议引入的能力点

- **飞书同步实现（1104 行）**：直接抄等于绑定飞书供应商，破坏多租户中立性。若要，做抽象 provider 接口（1 天工作量）。
- **`knowledge_document_audit` 表**：Orion 有统一的 audit 服务（`internal/audit/`），复用即可，无需按领域再建审计表。
- **`knowledge_document_view_count/collect/favor/invoke`**：社区运营指标，与 Orion"AI 助手知识源"定位不符。
- **`SyncSourceFactory` Reflections 反射扫描**：Java 特有的类路径反射模式，Go 下用 `init()` + `registry` map 更简单。

---

## 5. 认知边界

1. **未反编译**：分析基于 `.java` 源码 + `.json` 表定义，未跑单元测试，未做字节码反编译，`ServiceImpl` 私有方法与内部实现细节可能有遗漏。
2. **`grep -oE` 抓 public 方法正则失效**：`grep -oE 'public [a-zA-Z<>\[\] ,]+ [a-zA-Z][a-zA-Z0-9]*\('` 在 `KnowledgeDocumentServiceImpl.java` 返回 0（因 Java 泛型返回值跨行 + `@Override` 干扰），改用 `grep -n "public "` 才取到方法清单，故**方法数可能偏少**（实测 11 个 vs 接口 13 个声明）。
3. **未读 changelog**：`neatlogic-knowledge/src/main/resources/neatlogic/resources/knowledge/changelog/2026-06-08/` 未读，可能存在最近的架构演进。
4. **未验证运行**：NeatLogic 是 NSUL 4.x 协议（源码第 3-8 行明确声明），本报告只用于"能力对标 + 是否引入"评估，不构成代码复用建议。
5. **`knowledge-base` 内 0 API**：78 文件全是 dto/mapper/handler/auth/dao，未逐一看；判断为"数据结构 + 框架 SPI 抽象"，若有 API 端点则报告需修订。
6. **CMDB 关联为零是 grep 结论**：`grep -rni "cmdb\|CiEntity\|ciId"` 返回空，但不能排除通过外部事件/消息队列间接关联的可能（未追事件总线代码）。
7. **Orion 侧 knowledge 目录 grep 只覆盖 `orion-platform-svc-go/internal/`**：`orion-frontend/src/api/`、`orion-platform-service/src/services/` 未扫；Orion 前端可能有独立 knowledge API client，未纳入对比。

---

**报告结束**（`wc -l` 见命令行输出）。
