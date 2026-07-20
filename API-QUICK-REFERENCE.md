# Orion API Quick Reference

> Generated from `orion-platform-svc-go` handler routes.
> **Total: 626 routes** across **77 modules**
> Data source: `/tmp/routes-catalog.txt`
> Last updated: 2026-07-20

## Overview

| Category | Modules | Routes |
|----------|---------|--------|
| 认证与访问控制 | 7 | 34 |
| AI 平台 | 6 | 54 |
| 流水线与构建 | 9 | 95 |
| 制品与版本 | 5 | 37 |
| 可观测性与运维 | 14 | 124 |
| 代码与脚本 | 7 | 68 |
| 治理与合规 | 5 | 50 |
| 服务与模块 | 6 | 37 |
| 通信与事件 | 5 | 28 |
| 数据与存储 | 6 | 46 |
| 工单与知识 | 2 | 10 |
| 扩展与集成 | 3 | 33 |
| 专项功能 | 1 | 2 |
| 其他 | 1 | 8 |
| **Total** | **77** | **626** |

### HTTP Method Distribution

| Method | Count | Percentage |
|--------|-------|------------|
| GET | 295 | 47.1% |
| POST | 173 | 27.6% |
| PUT | 81 | 12.9% |
| DELETE | 74 | 11.8% |
| PATCH | 3 | 0.5% |

---

## API Endpoints

### AI 平台

#### AI 安全 `ai-security` — 14 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 1 | GET | `/ai-security` | 列表 | JWT |
| 2 | GET | `/ai-security/:id` | 获取详情 | JWT |
| 3 | POST | `/ai-security` | 创建 | JWT |
| 4 | PUT | `/ai-security/:id` | 更新 | JWT |
| 5 | DELETE | `/ai-security/:id` | 删除 | JWT |
| 6 | POST | `/ai-security/vulns/scan` | 创建 | JWT |
| 7 | GET | `/ai-security/vulns` | 列表 | JWT |
| 8 | GET | `/ai-security/vulns/:cveId` | 列表 | JWT |
| 9 | POST | `/ai-security/vulns/:cveId/fix` | 创建 | JWT |
| 10 | GET | `/ai-security/vulns/check` | 列表 | JWT |
| 11 | GET | `/ai-security/policies` | 列表 | JWT |
| 12 | GET | `/ai-security/audit` | 列表 | JWT |
| 13 | POST | `/ai-security/block` | 创建 | JWT |
| 14 | GET | `/ai-security/score/:id` | 列表 | JWT |

#### AI 模型 `ai-models` — 14 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 15 | GET | `/api/v1/ai/models` | 列表 | JWT |
| 16 | POST | `/api/v1/ai/models` | 创建 | JWT |
| 17 | GET | `/api/v1/ai/models/:id` | 获取详情 | JWT |
| 18 | PUT | `/api/v1/ai/models/:id` | 更新 | JWT |
| 19 | DELETE | `/api/v1/ai/models/:id` | 删除 | JWT |
| 20 | GET | `/api/v1/ai/models/:id/versions` | 版本列表 | JWT |
| 21 | POST | `/api/v1/ai/models/:id/versions` | 版本列表 | JWT |
| 22 | GET | `/api/v1/ai/models/:id/versions/:versionId` | 版本列表 | JWT |
| 23 | POST | `/api/v1/ai/models/:id/versions/:versionId/promote` | 晋升 | JWT |
| 24 | POST | `/api/v1/ai/models/:id/versions/:versionId/rollback` | 回滚 | JWT |
| 25 | GET | `/api/v1/ai/models/:id/metrics` | 指标 | JWT |
| 26 | POST | `/api/v1/ai/models/:id/canary` | 创建金丝雀 | JWT |
| 27 | GET | `/api/v1/ai/models/:id/canary` | 金丝雀状态 | JWT |
| 28 | DELETE | `/api/v1/ai/models/:id/canary` | 移除金丝雀 | JWT |

#### AI 降级 `ai-degradation` — 11 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 29 | GET | `/ai/degradation/status` | 获取状态 | JWT |
| 30 | GET | `/ai/degradation` | 列表 | JWT |
| 31 | POST | `/ai/degradation` | 创建 | JWT |
| 32 | GET | `/ai/degradation/:id` | 获取详情 | JWT |
| 33 | PUT | `/ai/degradation/:id` | 更新 | JWT |
| 34 | DELETE | `/ai/degradation/:id` | 删除 | JWT |
| 35 | POST | `/ai/degradation/:id/enable` | 操作 | JWT |
| 36 | POST | `/ai/degradation/:id/disable` | 操作 | JWT |
| 37 | GET | `/ai/degradation/:id/history` | 历史记录 | JWT |
| 38 | POST | `/ai/degradation/:id/trigger` | 触发执行 | JWT |
| 39 | POST | `/ai/degradation/:id/recover` | 操作 | JWT |

#### AI 网关 `ai-gateway` — 6 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 40 | POST | `/ai-gateway` | 创建 | JWT |
| 41 | GET | `/ai-gateway/:id` | 获取详情 | JWT |
| 42 | GET | `/ai-gateway` | 列表 | JWT |
| 43 | GET | `/ai-gateway/by-provider/:provider` | 列表 | JWT |
| 44 | GET | `/ai-gateway/by-model/:model` | 列表 | JWT |
| 45 | GET | `/ai-gateway/recent/:n` | 列表 | JWT |

#### AI 评审 `ai-review` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 46 | GET | `/ai-review` | 列表 | JWT |
| 47 | GET | `/ai-review/:id` | 获取详情 | JWT |
| 48 | POST | `/ai-review` | 创建 | JWT |
| 49 | PUT | `/ai-review/:id/approve` | 审批记录 | JWT |
| 50 | PUT | `/ai-review/:id/reject` | 审批拒绝 | JWT |

#### AI 成本 `ai-cost` — 4 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 51 | GET | `/ai-cost` | 列表 | JWT |
| 52 | GET | `/ai-cost/summary` | 汇总 | JWT |
| 53 | GET | `/ai-cost/:id` | 获取详情 | JWT |
| 54 | POST | `/ai-cost` | 创建 | JWT |

### 专项功能

#### 任务超时 `task-timeout` — 2 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 55 | GET | `/task-timeout` | 列表 | JWT |
| 56 | PUT | `/task-timeout` | 全量更新 | JWT |

### 代码与脚本

#### 代码仓库 `code-repo` — 23 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 57 | GET | `/code-repo/adapters` | 列表 | JWT |
| 58 | GET | `/code-repo/:adapterId/repos` | 列表 | JWT |
| 59 | GET | `/code-repo/:adapterId/repos/:repoId` | 列表 | JWT |
| 60 | GET | `/code-repo/:adapterId/repos/:repoId/branches` | 列表 | JWT |
| 61 | POST | `/code-repo/:adapterId/repos/:repoId/branches` | 操作 | JWT |
| 62 | DELETE | `/code-repo/:adapterId/repos/:repoId/branches/:branchName` | 删除 | JWT |
| 63 | GET | `/code-repo/:adapterId/repos/:repoId/pulls` | 列表 | JWT |
| 64 | POST | `/code-repo/:adapterId/repos/:repoId/pulls` | 操作 | JWT |
| 65 | GET | `/code-repo/:adapterId/repos/:repoId/pull-requests` | 列表 | JWT |
| 66 | POST | `/code-repo/:adapterId/repos/:repoId/pulls/:prId/merge` | 操作 | JWT |
| 67 | POST | `/code-repo/:adapterId/repos/:repoId/pulls/:prId/close` | 操作 | JWT |
| 68 | POST | `/code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews` | 提交评审 | JWT |
| 69 | GET | `/code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews` | 评审记录 | JWT |
| 70 | GET | `/code-repo/:adapterId/repos/:repoId/pulls/:prId/comments` | 列表 | JWT |
| 71 | POST | `/code-repo/:adapterId/repos/:repoId/pulls/:prId/comments` | 操作 | JWT |
| 72 | GET | `/code-repo/:adapterId/repos/:repoId/commits` | 列表 | JWT |
| 73 | GET | `/code-repo/:adapterId/repos/:repoId/commits/:sha` | 列表 | JWT |
| 74 | GET | `/code-repo/:adapterId/repos/:repoId/diff` | 列表 | JWT |
| 75 | GET | `/code-repo/code-owners` | 列表 | JWT |
| 76 | GET | `/code-repo/webhooks/logs` | 日志 | JWT |
| 77 | POST | `/code-repo/webhooks/:id/secret` | 创建 | JWT |
| 78 | GET | `/code-repo/webhooks/:id/secret` | 列表 | JWT |
| 79 | POST | `/code-repo/webhooks/:id/rotate-secret` | 创建 | JWT |

#### 测试选择 `test-selector` — 11 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 80 | GET | `/test-selector/files` | 文件列表 | JWT |
| 81 | GET | `/test-selector/coverage` | 列表 | JWT |
| 82 | GET | `/test-selector/test-suites` | 列表 | JWT |
| 83 | GET | `/test-selector/test-suites/:id` | 列表 | JWT |
| 84 | POST | `/test-selector/test-suites` | 创建 | JWT |
| 85 | PUT | `/test-selector/test-suites/:id` | 更新 | JWT |
| 86 | DELETE | `/test-selector/test-suites/:id` | 删除 | JWT |
| 87 | GET | `/test-selector/impact` | 影响分析 | JWT |
| 88 | POST | `/test-selector/recommend` | 创建 | JWT |
| 89 | GET | `/test-selector/stats` | 统计信息 | JWT |
| 90 | PUT | `/test-selector/test-suites/:id/run` | 更新 | JWT |

#### 分支策略 `branch-policy` — 10 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 91 | GET | `/branch-policy` | 列表 | JWT |
| 92 | GET | `/branch-policy/:id` | 获取详情 | JWT |
| 93 | POST | `/branch-policy` | 创建 | JWT |
| 94 | PUT | `/branch-policy/:id` | 更新 | JWT |
| 95 | DELETE | `/branch-policy/:id` | 删除 | JWT |
| 96 | GET | `/branch-policy/validate/:branch` | 列表 | JWT |
| 97 | GET | `/branch-policy/coverage` | 列表 | JWT |
| 98 | POST | `/branch-policy/enforce` | 创建 | JWT |
| 99 | GET | `/branch-policy/violations` | 列表 | JWT |
| 100 | GET | `/branch-policy/stats` | 统计信息 | JWT |

#### 测试生成 `test-generation` — 9 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 101 | GET | `/test-generation` | 列表 | JWT |
| 102 | GET | `/test-generation/:id` | 获取详情 | JWT |
| 103 | POST | `/test-generation` | 创建 | JWT |
| 104 | PUT | `/test-generation/:id` | 更新 | JWT |
| 105 | DELETE | `/test-generation/:id` | 删除 | JWT |
| 106 | POST | `/test-generation/:id/generate` | 操作 | JWT |
| 107 | GET | `/test-generation/:id/results` | 列表 | JWT |
| 108 | GET | `/test-generation/templates` | 列表 | JWT |
| 109 | PUT | `/test-generation/:id/regenerate` | 更新 | JWT |

#### 脚本库 `script-library` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 110 | GET | `/script-library` | 列表 | JWT |
| 111 | GET | `/script-library/:id` | 获取详情 | JWT |
| 112 | POST | `/script-library` | 创建 | JWT |
| 113 | PUT | `/script-library/:id` | 更新 | JWT |
| 114 | DELETE | `/script-library/:id` | 删除 | JWT |

#### 脚本 `script` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 115 | GET | `/script` | 列表 | JWT |
| 116 | GET | `/script/:id` | 获取详情 | JWT |
| 117 | POST | `/script` | 创建 | JWT |
| 118 | PUT | `/script/:id` | 更新 | JWT |
| 119 | DELETE | `/script/:id` | 删除 | JWT |

#### 脚本版本 `script-version` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 120 | GET | `/script-version` | 列表 | JWT |
| 121 | GET | `/script-version/:id` | 获取详情 | JWT |
| 122 | POST | `/script-version` | 创建 | JWT |
| 123 | PUT | `/script-version/:id` | 更新 | JWT |
| 124 | DELETE | `/script-version/:id` | 删除 | JWT |

### 其他

#### 多模态触发 `multi-modal-trigger` — 8 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 125 | GET | `/multi-modal-trigger` | 列表 | JWT |
| 126 | GET | `/multi-modal-trigger/:id` | 获取详情 | JWT |
| 127 | POST | `/multi-modal-trigger` | 创建 | JWT |
| 128 | PUT | `/multi-modal-trigger/:id` | 更新 | JWT |
| 129 | DELETE | `/multi-modal-trigger/:id` | 删除 | JWT |
| 130 | POST | `/multi-modal-trigger/:id/execute` | 执行 | JWT |
| 131 | POST | `/multi-modal-trigger/:id/evaluate` | 操作 | JWT |
| 132 | POST | `/multi-modal-trigger/webhook/process` | 创建 | JWT |

### 制品与版本

#### 制品版本 `artifact-version` — 9 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 133 | GET | `/artifact-version` | 列表 | JWT |
| 134 | GET | `/artifact-version/:id` | 获取详情 | JWT |
| 135 | POST | `/artifact-version` | 创建 | JWT |
| 136 | PUT | `/artifact-version/:id` | 更新 | JWT |
| 137 | DELETE | `/artifact-version/:id` | 删除 | JWT |
| 138 | GET | `/artifact-version/:id/tags` | 列表 | JWT |
| 139 | POST | `/artifact-version/:id/tag` | 操作 | JWT |
| 140 | DELETE | `/artifact-version/:id/tag/:tag` | 删除 | JWT |
| 141 | GET | `/artifact-version/:id/compat` | 列表 | JWT |

#### APK 上传历史 `apk-upload-history` — 8 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 142 | GET | `/apk-uploads` | 列表 | JWT |
| 143 | GET | `/apk-uploads/:id` | 获取详情 | JWT |
| 144 | POST | `/apk-uploads` | 创建 | JWT |
| 145 | PUT | `/apk-uploads/:id/status` | 获取状态 | JWT |
| 146 | DELETE | `/apk-uploads/:id` | 删除 | JWT |
| 147 | GET | `/apk-uploads/stats` | 统计信息 | JWT |
| 148 | GET | `/apk-uploads/failures` | 列表 | JWT |
| 149 | POST | `/apk-uploads/duplicate-check` | 创建 | JWT |

#### OCI 注册表 `oci-registry` — 8 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 150 | GET | `/oci-registry` | 列表 | JWT |
| 151 | GET | `/oci-registry/:id` | 获取详情 | JWT |
| 152 | POST | `/oci-registry` | 创建 | JWT |
| 153 | PUT | `/oci-registry/:id` | 更新 | JWT |
| 154 | DELETE | `/oci-registry/:id` | 删除 | JWT |
| 155 | PATCH | `/oci-registry/:registryId/enable` | 部分更新 | JWT |
| 156 | GET | `/oci-registry/repositories/:registryId/:name/tags` | 列表 | JWT |
| 157 | DELETE | `/oci-registry/images/:registryId/:name/:digest` | 删除 | JWT |

#### 制品生命周期 `artifact-lifecycle` — 7 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 158 | GET | `/artifact-lifecycle` | 列表 | JWT |
| 159 | GET | `/artifact-lifecycle/:artifactId` | 列表 | JWT |
| 160 | POST | `/artifact-lifecycle` | 创建 | JWT |
| 161 | PUT | `/artifact-lifecycle/:id/stage` | 更新 | JWT |
| 162 | DELETE | `/artifact-lifecycle/:id` | 删除 | JWT |
| 163 | GET | `/artifact-lifecycle/stages` | 列表 | JWT |
| 164 | PUT | `/artifact-lifecycle/:id/archive` | 更新 | JWT |

#### 版本归档 `version-archive` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 165 | GET | `/version-archive` | 列表 | JWT |
| 166 | GET | `/version-archive/:id` | 获取详情 | JWT |
| 167 | POST | `/version-archive` | 创建 | JWT |
| 168 | PUT | `/version-archive/:id` | 更新 | JWT |
| 169 | DELETE | `/version-archive/:id` | 删除 | JWT |

### 可观测性与运维

#### 服务拓扑 `service-topology` — 14 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 170 | GET | `/service-topology` | 列表 | JWT |
| 171 | GET | `/service-topology/:id` | 获取详情 | JWT |
| 172 | GET | `/service-topology/by-name/:name` | 按名称查询 | JWT |
| 173 | POST | `/service-topology` | 创建 | JWT |
| 174 | PUT | `/service-topology/:id` | 更新 | JWT |
| 175 | DELETE | `/service-topology/:id` | 删除 | JWT |
| 176 | POST | `/service-topology/by-name/:name/dependencies` | 添加依赖 | JWT |
| 177 | DELETE | `/service-topology/by-name/:name/dependencies/:target` | 移除依赖 | JWT |
| 178 | GET | `/service-topology/by-name/:name/dependencies` | 获取依赖 | JWT |
| 179 | GET | `/service-topology/by-name/:name/upstream` | 获取上游 | JWT |
| 180 | GET | `/service-topology/by-name/:name/downstream` | 获取下游 | JWT |
| 181 | GET | `/service-topology/by-name/:name/impact` | 影响分析 | JWT |
| 182 | GET | `/service-topology/cycles` | 检测循环依赖 | JWT |
| 183 | GET | `/service-topology/stats` | 统计信息 | JWT |

#### 中间件运维 `middleware-ops` — 14 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 184 | GET | `/middleware-ops` | 列表 | JWT |
| 185 | GET | `/middleware-ops/:id` | 获取详情 | JWT |
| 186 | POST | `/middleware-ops` | 创建 | JWT |
| 187 | PUT | `/middleware-ops/:id` | 更新 | JWT |
| 188 | DELETE | `/middleware-ops/:id` | 删除 | JWT |
| 189 | GET | `/middleware-ops/config` | 配置详情 | JWT |
| 190 | PUT | `/middleware-ops/config` | 配置详情 | JWT |
| 191 | GET | `/middleware-ops/status` | 获取状态 | JWT |
| 192 | POST | `/middleware-ops/:id/restart` | 操作 | JWT |
| 193 | POST | `/middleware-ops/:id/configure` | 配置 | JWT |
| 194 | GET | `/middleware-ops/plugins` | 列表 | JWT |
| 195 | GET | `/middleware-ops/plugins/:name` | 列表 | JWT |
| 196 | POST | `/middleware-ops/plugins/:name/enable` | 创建 | JWT |
| 197 | POST | `/middleware-ops/plugins/:name/disable` | 创建 | JWT |

#### 混沌网关 `chaos-gateway` — 13 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 198 | GET | `/chaos/scenarios` | 列表 | JWT |
| 199 | GET | `/chaos` | 列表 | JWT |
| 200 | POST | `/chaos` | 创建 | JWT |
| 201 | GET | `/chaos/:id` | 获取详情 | JWT |
| 202 | PUT | `/chaos/:id` | 更新 | JWT |
| 203 | DELETE | `/chaos/:id` | 删除 | JWT |
| 204 | POST | `/chaos/:id/start` | 操作 | JWT |
| 205 | POST | `/chaos/:id/stop` | 操作 | JWT |
| 206 | POST | `/chaos/:id/pause` | 操作 | JWT |
| 207 | POST | `/chaos/:id/resume` | 操作 | JWT |
| 208 | GET | `/chaos/:id/results` | 列表 | JWT |
| 209 | GET | `/chaos/:id/logs` | 日志 | JWT |
| 210 | POST | `/chaos/schedule` | 创建 | JWT |

#### 检查 `inspection` — 12 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 211 | GET | `/inspection` | 列表 | JWT |
| 212 | GET | `/inspection/:id` | 获取详情 | JWT |
| 213 | POST | `/inspection` | 创建 | JWT |
| 214 | PUT | `/inspection/:id` | 更新 | JWT |
| 215 | DELETE | `/inspection/:id` | 删除 | JWT |
| 216 | POST | `/inspection/:id/run` | 操作 | JWT |
| 217 | GET | `/inspection/:id/results` | 列表 | JWT |
| 218 | PUT | `/inspection/:id/status` | 获取状态 | JWT |
| 219 | GET | `/inspection/templates` | 列表 | JWT |
| 220 | GET | `/inspection/stats` | 统计信息 | JWT |
| 221 | POST | `/inspection/batch` | 创建 | JWT |
| 222 | GET | `/inspection/history` | 历史记录 | JWT |

#### 自愈 `self-healing` — 11 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 223 | POST | `/self-healing/incidents` | 创建 | JWT |
| 224 | GET | `/self-healing/incidents/:id` | 列表 | JWT |
| 225 | GET | `/self-healing/history` | 历史记录 | JWT |
| 226 | GET | `/self-healing/effectiveness` | 列表 | JWT |
| 227 | GET | `/self-healing/strategies` | 列表 | JWT |
| 228 | GET | `/self-healing/strategies/:id` | 列表 | JWT |
| 229 | POST | `/self-healing/strategies/:id/toggle` | 创建 | JWT |
| 230 | POST | `/self-healing/strategies` | 创建 | JWT |
| 231 | GET | `/self-healing/approvals` | 列表 | JWT |
| 232 | GET | `/self-healing/approvals/:id` | 列表 | JWT |
| 233 | POST | `/self-healing/approvals/:id/respond` | 创建 | JWT |

#### 服务健康 `service-health` — 10 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 234 | GET | `/service-health` | 列表 | JWT |
| 235 | GET | `/service-health/:id` | 获取详情 | JWT |
| 236 | POST | `/service-health` | 创建 | JWT |
| 237 | PUT | `/service-health/:id` | 更新 | JWT |
| 238 | DELETE | `/service-health/:id` | 删除 | JWT |
| 239 | POST | `/service-health/:id/record` | 操作 | JWT |
| 240 | GET | `/service-health/:id/results` | 列表 | JWT |
| 241 | GET | `/service-health/summary/:serviceName` | 汇总 | JWT |
| 242 | GET | `/service-health/summaries` | 列表 | JWT |
| 243 | GET | `/service-health/degraded` | 列表 | JWT |

#### 容量管理 `capacity` — 10 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 244 | GET | `/capacity` | 列表 | JWT |
| 245 | GET | `/capacity/:id` | 获取详情 | JWT |
| 246 | POST | `/capacity` | 创建 | JWT |
| 247 | PUT | `/capacity/:id` | 更新 | JWT |
| 248 | DELETE | `/capacity/:id` | 删除 | JWT |
| 249 | GET | `/capacity/forecast` | 列表 | JWT |
| 250 | GET | `/capacity/utilization` | 列表 | JWT |
| 251 | POST | `/capacity/scale` | 创建 | JWT |
| 252 | GET | `/capacity/alerts` | 列表 | JWT |
| 253 | GET | `/capacity/history` | 历史记录 | JWT |

#### 运行手册 `runbook` — 7 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 254 | GET | `/runbooks` | 列表 | JWT |
| 255 | GET | `/runbooks/:id` | 获取详情 | JWT |
| 256 | POST | `/runbooks` | 创建 | JWT |
| 257 | PUT | `/runbooks/:id` | 更新 | JWT |
| 258 | DELETE | `/runbooks/:id` | 删除 | JWT |
| 259 | POST | `/runbooks/:id/execute` | 执行 | JWT |
| 260 | GET | `/runbooks/:id/executions` | 列表 | JWT |

#### 升级处理 `escalation` — 7 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 261 | POST | `/escalation` | 创建 | JWT |
| 262 | GET | `/escalation/:id` | 获取详情 | JWT |
| 263 | GET | `/escalation` | 列表 | JWT |
| 264 | PUT | `/escalation/:id` | 更新 | JWT |
| 265 | DELETE | `/escalation/:id` | 删除 | JWT |
| 266 | POST | `/escalation/:id/trigger` | 触发执行 | JWT |
| 267 | GET | `/escalation/stats` | 统计信息 | JWT |

#### 灾难恢复 `disaster-recovery` — 6 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 268 | GET | `/disaster-recovery/plans` | 列表 | JWT |
| 269 | GET | `/disaster-recovery/plans/:id` | 列表 | JWT |
| 270 | POST | `/disaster-recovery/plans` | 创建 | JWT |
| 271 | PUT | `/disaster-recovery/plans/:id` | 更新 | JWT |
| 272 | POST | `/disaster-recovery/plans/:id/run` | 创建 | JWT |
| 273 | GET | `/disaster-recovery/plans/:id/runs` | 列表 | JWT |

#### 指标 `metrics` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 274 | GET | `/metrics` | 列表 | JWT |
| 275 | GET | `/metrics/:id` | 获取详情 | JWT |
| 276 | POST | `/metrics` | 创建 | JWT |
| 277 | PUT | `/metrics/:id` | 更新 | JWT |
| 278 | DELETE | `/metrics/:id` | 删除 | JWT |

#### 拓扑 `topology` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 279 | GET | `/topology` | 列表 | JWT |
| 280 | GET | `/topology/:id` | 获取详情 | JWT |
| 281 | POST | `/topology` | 创建 | JWT |
| 282 | PUT | `/topology/:id` | 更新 | JWT |
| 283 | DELETE | `/topology/:id` | 删除 | JWT |

#### 可观测性 `observability` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 284 | POST | `/observability/metrics` | 指标 | JWT |
| 285 | GET | `/observability/metrics` | 指标 | JWT |
| 286 | GET | `/observability/metrics/:name` | 指标 | JWT |
| 287 | POST | `/observability/alerts` | 创建 | JWT |
| 288 | GET | `/observability/alerts` | 列表 | JWT |

#### 事件动作 `incident-action` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 289 | GET | `/incident-action` | 列表 | JWT |
| 290 | GET | `/incident-action/:id` | 获取详情 | JWT |
| 291 | POST | `/incident-action` | 创建 | JWT |
| 292 | PUT | `/incident-action/:id` | 更新 | JWT |
| 293 | DELETE | `/incident-action/:id` | 删除 | JWT |

### 工单与知识

#### 工单知识库 `ticket-knowledge` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 294 | GET | `/ticket-knowledge` | 列表 | JWT |
| 295 | GET | `/ticket-knowledge/:id` | 获取详情 | JWT |
| 296 | POST | `/ticket-knowledge` | 创建 | JWT |
| 297 | PUT | `/ticket-knowledge/:id` | 更新 | JWT |
| 298 | DELETE | `/ticket-knowledge/:id` | 删除 | JWT |

#### 工单自动化 `ticket-automation` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 299 | GET | `/ticket-automation` | 列表 | JWT |
| 300 | GET | `/ticket-automation/:id` | 获取详情 | JWT |
| 301 | POST | `/ticket-automation` | 创建 | JWT |
| 302 | PUT | `/ticket-automation/:id` | 更新 | JWT |
| 303 | DELETE | `/ticket-automation/:id` | 删除 | JWT |

### 扩展与集成

#### 插件 `plugin` — 22 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 304 | POST | `/plugins` | 创建 | JWT |
| 305 | GET | `/plugins` | 列表 | JWT |
| 306 | GET | `/plugins/:id` | 获取详情 | JWT |
| 307 | DELETE | `/plugins/:id` | 删除 | JWT |
| 308 | PATCH | `/plugins/:id` | 部分更新 | JWT |
| 309 | GET | `/plugins/count` | 列表 | JWT |
| 310 | POST | `/plugins/:pluginId/install` | 操作 | JWT |
| 311 | POST | `/plugins/:pluginId/enable` | 操作 | JWT |
| 312 | POST | `/plugins/:pluginId/disable` | 操作 | JWT |
| 313 | GET | `/plugins/audit` | 列表 | JWT |
| 314 | GET | `/plugins/audit/:taskId/trail` | 列表 | JWT |
| 315 | GET | `/plugins/:runId/timeline` | 列表 | JWT |
| 316 | POST | `/plugins/:runId/debug/pause` | 操作 | JWT |
| 317 | POST | `/plugins/:runId/debug/resume` | 操作 | JWT |
| 318 | POST | `/plugins/:runId/debug/step` | 操作 | JWT |
| 319 | GET | `/plugins/:runId/debug/state` | 列表 | JWT |
| 320 | POST | `/plugins/ai-diagnose` | 创建 | JWT |
| 321 | PUT | `/plugins/quotas/:pluginId` | 更新 | JWT |
| 322 | GET | `/plugins/quotas/:pluginId` | 列表 | JWT |
| 323 | DELETE | `/plugins/quotas/:pluginId` | 删除 | JWT |
| 324 | POST | `/plugins/security-events` | 创建 | JWT |
| 325 | GET | `/plugins/security-events` | 列表 | JWT |

#### MCP 协议 `mcp` — 6 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 326 | GET | `/mcp/servers` | 列表 | JWT |
| 327 | GET | `/mcp/servers/:id` | 列表 | JWT |
| 328 | POST | `/mcp/servers` | 创建 | JWT |
| 329 | PUT | `/mcp/servers/:id` | 更新 | JWT |
| 330 | DELETE | `/mcp/servers/:id` | 删除 | JWT |
| 331 | GET | `/mcp/tools` | 列表 | JWT |

#### 插件热重载 `plugin-hotreload` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 332 | GET | `/plugin-hotreload` | 列表 | JWT |
| 333 | GET | `/plugin-hotreload/:id` | 获取详情 | JWT |
| 334 | POST | `/plugin-hotreload` | 创建 | JWT |
| 335 | PUT | `/plugin-hotreload/:id` | 更新 | JWT |
| 336 | DELETE | `/plugin-hotreload/:id` | 删除 | JWT |

### 数据与存储

#### MLOps `mlops` — 16 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 337 | GET | `/mlops` | 列表 | JWT |
| 338 | GET | `/mlops/:id` | 获取详情 | JWT |
| 339 | POST | `/mlops` | 创建 | JWT |
| 340 | PUT | `/mlops/:id` | 更新 | JWT |
| 341 | DELETE | `/mlops/:id` | 删除 | JWT |
| 342 | POST | `/mlops/:id/train` | 操作 | JWT |
| 343 | POST | `/mlops/:id/evaluate` | 操作 | JWT |
| 344 | PUT | `/mlops/:id/deploy` | 部署 | JWT |
| 345 | PUT | `/mlops/:id/rollback` | 回滚 | JWT |
| 346 | GET | `/mlops/:id/metrics` | 指标 | JWT |
| 347 | GET | `/mlops/:id/experiments` | 列表 | JWT |
| 348 | GET | `/mlops/:id/artifacts` | 列表 | JWT |
| 349 | GET | `/mlops/models` | 列表 | JWT |
| 350 | POST | `/mlops/models` | 创建 | JWT |
| 351 | DELETE | `/mlops/models/:id` | 删除 | JWT |
| 352 | GET | `/mlops/pipelines` | 列表 | JWT |

#### 元数据 `metadata` — 8 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 353 | GET | `/metadata` | 列表 | JWT |
| 354 | GET | `/metadata/:key` | 列表 | JWT |
| 355 | POST | `/metadata` | 创建 | JWT |
| 356 | PUT | `/metadata/:key` | 更新 | JWT |
| 357 | DELETE | `/metadata/:key` | 删除 | JWT |
| 358 | POST | `/metadata/batch` | 创建 | JWT |
| 359 | GET | `/metadata/search` | 列表 | JWT |
| 360 | GET | `/metadata/stats` | 统计信息 | JWT |

#### 向量 `vector` — 7 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 361 | GET | `/vector/stores` | 列表 | JWT |
| 362 | GET | `/vector/stores/:id` | 列表 | JWT |
| 363 | POST | `/vector/stores` | 创建 | JWT |
| 364 | DELETE | `/vector/stores/:id` | 删除 | JWT |
| 365 | POST | `/vector/stores/:id/vectors` | 创建 | JWT |
| 366 | POST | `/vector/stores/:id/search` | 创建 | JWT |
| 367 | DELETE | `/vector/stores/:id/vectors` | 删除 | JWT |

#### 统一配置 `unified-config` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 368 | GET | `/unified-config` | 列表 | JWT |
| 369 | GET | `/unified-config/:id` | 获取详情 | JWT |
| 370 | POST | `/unified-config` | 创建 | JWT |
| 371 | PUT | `/unified-config/:id` | 更新 | JWT |
| 372 | DELETE | `/unified-config/:id` | 删除 | JWT |

#### 向量存储 `vector-store` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 373 | GET | `/vector-store` | 列表 | JWT |
| 374 | GET | `/vector-store/:id` | 获取详情 | JWT |
| 375 | POST | `/vector-store` | 创建 | JWT |
| 376 | PUT | `/vector-store/:id` | 更新 | JWT |
| 377 | DELETE | `/vector-store/:id` | 删除 | JWT |

#### 向量化规则 `vectorize-rules` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 378 | GET | `/vectorize-rules` | 列表 | JWT |
| 379 | GET | `/vectorize-rules/:id` | 获取详情 | JWT |
| 380 | POST | `/vectorize-rules` | 创建 | JWT |
| 381 | PUT | `/vectorize-rules/:id` | 更新 | JWT |
| 382 | DELETE | `/vectorize-rules/:id` | 删除 | JWT |

### 服务与模块

#### 服务目录 `service-catalog` — 8 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 383 | GET | `/service-catalog` | 列表 | JWT |
| 384 | GET | `/service-catalog/:id` | 获取详情 | JWT |
| 385 | POST | `/service-catalog` | 创建 | JWT |
| 386 | PUT | `/service-catalog/:id` | 更新 | JWT |
| 387 | DELETE | `/service-catalog/:id` | 删除 | JWT |
| 388 | POST | `/service-catalog/requests/:id/status` | 获取状态 | JWT |
| 389 | GET | `/service-catalog/requests/:id/timeline` | 列表 | JWT |
| 390 | GET | `/service-catalog/sla-breaches` | 列表 | JWT |

#### 动态网关 `gateway-dynamic` — 7 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 391 | GET | `/routes` | 列表 | JWT |
| 392 | GET | `/routes/stats` | 统计信息 | JWT |
| 393 | POST | `/routes` | 创建 | JWT |
| 394 | GET | `/routes/:id` | 获取详情 | JWT |
| 395 | PUT | `/routes/:id` | 更新 | JWT |
| 396 | DELETE | `/routes/:id` | 删除 | JWT |
| 397 | PATCH | `/routes/:id/toggle` | 部分更新 | JWT |

#### 临时环境 `ephemeral-env` — 7 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 398 | GET | `/ephemeral-env` | 列表 | JWT |
| 399 | GET | `/ephemeral-env/:id` | 获取详情 | JWT |
| 400 | POST | `/ephemeral-env` | 创建 | JWT |
| 401 | PUT | `/ephemeral-env/:id/extend` | 更新 | JWT |
| 402 | DELETE | `/ephemeral-env/:id` | 删除 | JWT |
| 403 | GET | `/ephemeral-env/:id/logs` | 日志 | JWT |
| 404 | POST | `/ephemeral-env/:id/destroy` | 操作 | JWT |

#### 模块管理 `module` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 405 | GET | `/module` | 列表 | JWT |
| 406 | GET | `/module/:id` | 获取详情 | JWT |
| 407 | PUT | `/module/:id/toggle` | 更新 | JWT |
| 408 | GET | `/module/validate` | 列表 | JWT |
| 409 | GET | `/module/startup-order` | 列表 | JWT |

#### 自助服务 `self-service` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 410 | GET | `/self-service` | 列表 | JWT |
| 411 | GET | `/self-service/:id` | 获取详情 | JWT |
| 412 | POST | `/self-service` | 创建 | JWT |
| 413 | PUT | `/self-service/:id` | 更新 | JWT |
| 414 | DELETE | `/self-service/:id` | 删除 | JWT |

#### 终端审计 `terminal-audit` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 415 | GET | `/terminal-audit` | 列表 | JWT |
| 416 | GET | `/terminal-audit/:id` | 获取详情 | JWT |
| 417 | DELETE | `/terminal-audit/batch` | 删除 | JWT |
| 418 | PUT | `/terminal-audit/search` | 更新 | JWT |
| 419 | GET | `/terminal-audit/stats` | 统计信息 | JWT |

### 治理与合规

#### 联邦 `federation` — 23 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 420 | POST | `/federation` | 创建 | JWT |
| 421 | GET | `/federation/:id` | 列表 | JWT |
| 422 | GET | `/federation` | 列表 | JWT |
| 423 | PUT | `/federation/:id` | 更新 | JWT |
| 424 | DELETE | `/federation/:id` | 删除 | JWT |
| 425 | POST | `/federation/executors` | 创建 | JWT |
| 426 | GET | `/federation/executors` | 列表 | JWT |
| 427 | GET | `/federation/executors/:executorId/health` | 健康检查 | JWT |
| 428 | GET | `/federation/executors/dashboard` | 列表 | JWT |
| 429 | POST | `/federation/executors/:executorId/heartbeat` | 创建 | JWT |
| 430 | DELETE | `/federation/executors/:executorId` | 删除 | JWT |
| 431 | POST | `/federation/dispatch-job` | 创建 | JWT |
| 432 | POST | `/federation-advanced/scheduling-policies` | 创建 | JWT |
| 433 | GET | `/federation-advanced/scheduling-policies` | 列表 | JWT |
| 434 | POST | `/federation-advanced/cross-cluster-jobs` | 创建 | JWT |
| 435 | POST | `/federation-advanced/resource-pools` | 创建 | JWT |
| 436 | GET | `/federation-advanced/resource-pools/:poolId` | 列表 | JWT |
| 437 | POST | `` | 创建 | JWT |
| 438 | GET | `` | 列表 | JWT |
| 439 | GET | `/:id` | 获取详情 | JWT |
| 440 | PUT | `/:id` | 更新 | JWT |
| 441 | DELETE | `/:id` | 删除 | JWT |
| 442 | GET | `/count` | 列表 | JWT |

#### 确认流程 `confirmation` — 10 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 443 | GET | `/confirmation` | 列表 | JWT |
| 444 | GET | `/confirmation/:id` | 获取详情 | JWT |
| 445 | POST | `/confirmation` | 创建 | JWT |
| 446 | PUT | `/confirmation/:id/approve` | 审批记录 | JWT |
| 447 | PUT | `/confirmation/:id/reject` | 审批拒绝 | JWT |
| 448 | DELETE | `/confirmation/:id` | 删除 | JWT |
| 449 | GET | `/confirmation/pending` | 列表 | JWT |
| 450 | GET | `/confirmation/stats` | 统计信息 | JWT |
| 451 | PUT | `/confirmation/:id/escalate` | 更新 | JWT |
| 452 | GET | `/confirmation/by-user/:userId` | 列表 | JWT |

#### Saga 编排 `saga` — 7 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 453 | POST | `/saga/transactions` | 创建 | JWT |
| 454 | GET | `/saga/transactions/:transactionId` | 列表 | JWT |
| 455 | GET | `/saga/transactions` | 列表 | JWT |
| 456 | POST | `/saga/transactions/:transactionId/cancel` | 创建 | JWT |
| 457 | POST | `/saga/transactions/:transactionId/compensate` | 创建 | JWT |
| 458 | GET | `/saga/transactions/:transactionId/steps` | 列表 | JWT |
| 459 | GET | `/saga/steps/:stepId` | 列表 | JWT |

#### 流程步骤 `process-step` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 460 | GET | `/process-step` | 列表 | JWT |
| 461 | GET | `/process-step/:id` | 获取详情 | JWT |
| 462 | POST | `/process-step` | 创建 | JWT |
| 463 | PUT | `/process-step/:id` | 更新 | JWT |
| 464 | DELETE | `/process-step/:id` | 删除 | JWT |

#### 风险管理 `risk` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 465 | GET | `/risk` | 列表 | JWT |
| 466 | GET | `/risk/:id` | 获取详情 | JWT |
| 467 | POST | `/risk` | 创建 | JWT |
| 468 | PUT | `/risk/:id` | 更新 | JWT |
| 469 | DELETE | `/risk/:id` | 删除 | JWT |

### 流水线与构建

#### 流水线模板 `pipeline-templates` — 13 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 470 | GET | `/pipeline-templates/categories` | 列表 | JWT |
| 471 | GET | `/pipeline-templates/search` | 列表 | JWT |
| 472 | GET | `/pipeline-templates` | 列表 | JWT |
| 473 | POST | `/pipeline-templates` | 创建 | JWT |
| 474 | GET | `/pipeline-templates/:id` | 获取详情 | JWT |
| 475 | PUT | `/pipeline-templates/:id` | 更新 | JWT |
| 476 | DELETE | `/pipeline-templates/:id` | 删除 | JWT |
| 477 | POST | `/pipeline-templates/:id/publish` | 发布 | JWT |
| 478 | POST | `/pipeline-templates/:id/deprecate` | 操作 | JWT |
| 479 | GET | `/pipeline-templates/:id/versions` | 版本列表 | JWT |
| 480 | POST | `/pipeline-templates/:id/instantiate` | 操作 | JWT |
| 481 | POST | `/pipeline-templates/:id/star` | 操作 | JWT |
| 482 | DELETE | `/pipeline-templates/:id/star` | 删除 | JWT |

#### 流水线 `pipeline` — 13 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 483 | GET | `/pipeline` | 列表 | JWT |
| 484 | POST | `/pipeline` | 创建 | JWT |
| 485 | GET | `/pipeline/:id` | 获取详情 | JWT |
| 486 | PUT | `/pipeline/:id` | 更新 | JWT |
| 487 | DELETE | `/pipeline/:id` | 删除 | JWT |
| 488 | POST | `/pipeline/validate` | 创建 | JWT |
| 489 | POST | `/pipeline/:id/run` | 操作 | JWT |
| 490 | POST | `/pipeline/runs/:runId/stop` | 创建 | JWT |
| 491 | POST | `/pipeline/batch/start` | 创建 | JWT |
| 492 | POST | `/pipeline/batch/stop` | 创建 | JWT |
| 493 | POST | `/pipeline/batch/delete` | 创建 | JWT |
| 494 | GET | `/pipeline/:id/stats` | 统计信息 | JWT |
| 495 | GET | `/pipeline/:id/versions` | 版本列表 | JWT |

#### 构建 `build` — 13 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 496 | GET | `/build/environments` | 列表 | JWT |
| 497 | POST | `/build/environments` | 创建 | JWT |
| 498 | GET | `/build/environments/:id` | 列表 | JWT |
| 499 | PUT | `/build/environments/:id` | 更新 | JWT |
| 500 | DELETE | `/build/environments/:id` | 删除 | JWT |
| 501 | GET | `/build` | 列表 | JWT |
| 502 | POST | `/build` | 创建 | JWT |
| 503 | GET | `/build/:id` | 获取详情 | JWT |
| 504 | POST | `/build/:id/start` | 操作 | JWT |
| 505 | POST | `/build/:id/cancel` | 操作 | JWT |
| 506 | POST | `/build/:id/retry` | 操作 | JWT |
| 507 | DELETE | `/build/:id` | 删除 | JWT |
| 508 | GET | `/build/stats` | 统计信息 | JWT |

#### 数据流水线 `data-pipeline` — 12 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 509 | GET | `/data-pipeline` | 列表 | JWT |
| 510 | GET | `/data-pipeline/:id` | 获取详情 | JWT |
| 511 | POST | `/data-pipeline` | 创建 | JWT |
| 512 | PUT | `/data-pipeline/:id` | 更新 | JWT |
| 513 | DELETE | `/data-pipeline/:id` | 删除 | JWT |
| 514 | POST | `/data-pipeline/:id/run` | 操作 | JWT |
| 515 | GET | `/data-pipeline/:id/status` | 获取状态 | JWT |
| 516 | PUT | `/data-pipeline/:id/pause` | 更新 | JWT |
| 517 | PUT | `/data-pipeline/:id/resume` | 更新 | JWT |
| 518 | GET | `/data-pipeline/:id/logs` | 日志 | JWT |
| 519 | GET | `/data-pipeline/schemas` | 列表 | JWT |
| 520 | GET | `/data-pipeline/lineage/:id` | 列表 | JWT |

#### 渐进交付 `progressive` — 12 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 521 | GET | `/progressive` | 列表 | JWT |
| 522 | GET | `/progressive/:id` | 获取详情 | JWT |
| 523 | POST | `/progressive` | 创建 | JWT |
| 524 | PUT | `/progressive/:id` | 更新 | JWT |
| 525 | DELETE | `/progressive/:id` | 删除 | JWT |
| 526 | POST | `/progressive/:id/start` | 操作 | JWT |
| 527 | POST | `/progressive/:id/stages/:stage/complete` | 操作 | JWT |
| 528 | POST | `/progressive/:id/pause` | 操作 | JWT |
| 529 | POST | `/progressive/:id/resume` | 操作 | JWT |
| 530 | POST | `/progressive/:id/rollback` | 回滚 | JWT |
| 531 | GET | `/progressive/:id/stages` | 列表 | JWT |
| 532 | GET | `/progressive/:id/progress` | 列表 | JWT |

#### 智能部署 `smart-deploy` — 10 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 533 | POST | `/smart-deploy` | 创建 | JWT |
| 534 | GET | `/smart-deploy/:id` | 获取详情 | JWT |
| 535 | GET | `/smart-deploy` | 列表 | JWT |
| 536 | GET | `/smart-deploy/latest/:appName/:environment` | 列表 | JWT |
| 537 | POST | `/smart-deploy/:id/cancel` | 操作 | JWT |
| 538 | DELETE | `/smart-deploy/:id` | 删除 | JWT |
| 539 | POST | `/smart-deploy/:id/rollback` | 回滚 | JWT |
| 540 | GET | `/smart-deploy/:id/rollbacks` | 回滚 | JWT |
| 541 | GET | `/smart-deploy/metrics` | 指标 | JWT |
| 542 | GET | `/smart-deploy/:id/audit` | 列表 | JWT |

#### 自主流水线 `autonomous-pipeline` — 8 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 543 | GET | `/autonomous-pipeline` | 列表 | JWT |
| 544 | GET | `/autonomous-pipeline/:id` | 获取详情 | JWT |
| 545 | POST | `/autonomous-pipeline` | 创建 | JWT |
| 546 | PUT | `/autonomous-pipeline/:id` | 更新 | JWT |
| 547 | DELETE | `/autonomous-pipeline/:id` | 删除 | JWT |
| 548 | POST | `/autonomous-pipeline/:id/trigger` | 触发执行 | JWT |
| 549 | GET | `/autonomous-pipeline/:id/status` | 获取状态 | JWT |
| 550 | GET | `/autonomous-pipeline/templates` | 列表 | JWT |

#### 流水线预算 `pipeline-budget` — 8 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 551 | GET | `/pipelines/:pipelineId/budget` | 列表 | JWT |
| 552 | PUT | `/pipelines/:pipelineId/budget` | 全量更新 | JWT |
| 553 | GET | `/pipelines/:pipelineId/budget/usage` | 列表 | JWT |
| 554 | GET | `/pipelines/:pipelineId/budget/alerts` | 列表 | JWT |
| 555 | POST | `/pipelines/:pipelineId/budget/alerts` | 创建 | JWT |
| 556 | PUT | `/pipelines/:pipelineId/budget/alerts/:alertId` | 更新 | JWT |
| 557 | DELETE | `/pipelines/:pipelineId/budget/alerts/:alertId` | 删除 | JWT |
| 558 | GET | `/pipelines/:pipelineId/budget/history` | 历史记录 | JWT |

#### 流水线引擎 `pipeline-engine` — 6 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 559 | POST | `/pipeline-engine/runs` | 创建 | JWT |
| 560 | GET | `/pipeline-engine/runs/:runId` | 列表 | JWT |
| 561 | GET | `/pipeline-engine/pipelines/:pipelineId/runs` | 列表 | JWT |
| 562 | GET | `/pipeline-engine/runs/:runId/stages` | 列表 | JWT |
| 563 | GET | `/pipeline-engine/stages/:stageId/tasks` | 列表 | JWT |
| 564 | POST | `/pipeline-engine/runs/:runId/cancel` | 创建 | JWT |

### 认证与访问控制

#### 项目成员 `project-member` — 8 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 565 | GET | `/project-members` | 列表 | JWT |
| 566 | GET | `/project-members/:id` | 获取详情 | JWT |
| 567 | POST | `/project-members` | 创建 | JWT |
| 568 | PUT | `/project-members/:id` | 更新 | JWT |
| 569 | DELETE | `/project-members/:id` | 删除 | JWT |
| 570 | GET | `/project-members/by-project/:projectID` | 列表 | JWT |
| 571 | GET | `/project-members/by-project/:projectID/count` | 列表 | JWT |
| 572 | GET | `/project-members/role-check` | 列表 | JWT |

#### 单点登录 `sso` — 6 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 573 | GET | `/sso/providers` | 列表 | JWT |
| 574 | GET | `/sso/providers/:id` | 列表 | JWT |
| 575 | POST | `/sso/providers` | 创建 | JWT |
| 576 | PUT | `/sso/providers/:id` | 更新 | JWT |
| 577 | POST | `/sso/login` | 日志 | No |
| 578 | GET | `/sso/callback/:id` | 列表 | No |

#### 安全 `security` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 579 | GET | `/security/vulnerabilities` | 列表 | JWT |
| 580 | POST | `/security/vulnerabilities/scan` | 创建 | JWT |
| 581 | POST | `/security/vulnerabilities/scan-image` | 创建 | JWT |
| 582 | GET | `/security/vulnerabilities/:id` | 获取详情 | JWT |
| 583 | POST | `/security/vulnerabilities/:id/remediate` | 操作 | JWT |

#### 隐私 `privacy` — 4 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 584 | GET | `/privacy` | 列表 | JWT |
| 585 | PUT | `/privacy` | 全量更新 | JWT |
| 586 | DELETE | `/privacy` | 清空 | JWT |
| 587 | GET | `/privacy/compliance` | 列表 | JWT |

#### 用户状态 `user-status` — 4 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 588 | GET | `/user-status/me` | 列表 | JWT |
| 589 | GET | `/user-status/:id` | 获取详情 | JWT |
| 590 | PUT | `/user-status/me` | 更新 | JWT |
| 591 | GET | `/user-status/online` | 列表 | JWT |

#### 用户资料 `user-profile` — 4 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 592 | GET | `/user-profile/me` | 列表 | JWT |
| 593 | GET | `/user-profile/:id` | 获取详情 | JWT |
| 594 | PUT | `/user-profile/me` | 更新 | JWT |
| 595 | PUT | `/user-profile/:id` | 更新 | JWT |

#### 用户令牌 `user-token` — 3 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 596 | GET | `/user-token/:id/tokens` | 列表 | JWT |
| 597 | POST | `/user-token/:id/tokens` | 操作 | JWT |
| 598 | DELETE | `/user-token/:id/tokens/:tokenId` | 删除 | JWT |

### 通信与事件

#### 队列 `queue` — 8 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 599 | GET | `/queue` | 列表 | JWT |
| 600 | GET | `/queue/:id` | 获取详情 | JWT |
| 601 | POST | `/queue` | 创建 | JWT |
| 602 | PUT | `/queue/:id` | 更新 | JWT |
| 603 | DELETE | `/queue/:id` | 删除 | JWT |
| 604 | POST | `/queue/:queueName/jobs` | 操作 | JWT |
| 605 | POST | `/queue/:queueName/dequeue` | 操作 | JWT |
| 606 | POST | `/queue/jobs/:id/complete` | 创建 | JWT |

#### Webhook 存储 `webhook/store` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 607 | GET | `/webhook-config/:domain` | 列表 | JWT |
| 608 | GET | `/webhook-config/:domain/:id` | 列表 | JWT |
| 609 | POST | `/webhook-config/:domain` | 操作 | JWT |
| 610 | PUT | `/webhook-config/:domain/:id` | 更新 | JWT |
| 611 | DELETE | `/webhook-config/:domain/:id` | 删除 | JWT |

#### 通知管理 `notification-management` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 612 | GET | `/notification-management` | 列表 | JWT |
| 613 | GET | `/notification-management/:id` | 获取详情 | JWT |
| 614 | POST | `/notification-management` | 创建 | JWT |
| 615 | PUT | `/notification-management/:id` | 更新 | JWT |
| 616 | DELETE | `/notification-management/:id` | 删除 | JWT |

#### 事件触发注册 `event-trigger-registry` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 617 | GET | `/event-trigger-registry` | 列表 | JWT |
| 618 | GET | `/event-trigger-registry/:id` | 获取详情 | JWT |
| 619 | POST | `/event-trigger-registry` | 创建 | JWT |
| 620 | PUT | `/event-trigger-registry/:id` | 更新 | JWT |
| 621 | DELETE | `/event-trigger-registry/:id` | 删除 | JWT |

#### 消息队列 `message-queue` — 5 routes

| # | 方法 | 路径 | 描述 | 认证 |
|---|------|------|------|------|
| 622 | GET | `/message-queue` | 列表 | JWT |
| 623 | GET | `/message-queue/:id` | 获取详情 | JWT |
| 624 | POST | `/message-queue` | 创建 | JWT |
| 625 | PUT | `/message-queue/:id` | 更新 | JWT |
| 626 | DELETE | `/message-queue/:id` | 删除 | JWT |

---

> Generated: 2026-07-20 | Total: 626 routes | Modules: 77
> All routes require JWT authentication unless marked "No".
