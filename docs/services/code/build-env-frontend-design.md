# 构建环境管理 - 前端设计文档

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/build-env` | 主布局 | 侧边栏菜单导航 |
| `/build-env/images` | Builder 镜像列表 | CRUD 操作 |
| `/build-env/images/:id` | 镜像详情 | 版本历史、使用统计 |
| `/build-env/cache` | 缓存管理 | 两个 Tab（配置 + 条目） |
| `/build-env/pods` | Build Pod 列表 | 运行状态、资源消耗 |
| `/build-env/pods/:id` | Pod 详情 | 含实时日志查看器 |
| `/build-env/logs` | 构建日志查询 | 多条件过滤 |
| `/build-env/logs/:id` | 日志查看器 | SSE 流式日志 + 关键词搜索 |
| `/build-env/artifacts` | 构建产物列表 | 下载、过期清理 |

## 组件清单

`BuildEnvLayout` — 页面骨架（侧边栏 + 内容区）
`BuilderImageList` — 镜像表格 + 搜索/过滤 + CRUD 按钮
`BuilderImageModal` — 创建/编辑镜像的表单
`BuildCacheList` — 缓存配置表格
`BuildCacheModal` — 缓存配置表单
`BuildPodList` — Pod 列表表格
`BuildPodDetail` — Pod 详情 + 实时日志
`BuildLogList` — 日志查询表格
`BuildLogViewer` — SSE 流式日志查看器（暂停/恢复/搜索）
`ArtifactList` — 产物表格 + 下载 + 过期清理

## API 契约

### 镜像管理 (`/api/v1/build-images`)
```
GET    /v1/build-images                           # 列表
POST   /v1/build-images                           # 创建
GET    /v1/build-images/:id                       # 详情
PUT    /v1/build-images/:id                       # 更新
DELETE /v1/build-images/:id                       # 删除
POST   /v1/build-images/:id/deprecate|restore     # 废弃/恢复
GET    /v1/build-images/presets|available|type/:type  # 预设/可用/按类型
```

### 缓存管理 (`/api/v1/build-cache`)
```
GET/POST   /v1/build-cache/configs                         # 配置 CRUD
GET/PUT/DELETE /v1/build-cache/configs/:id                 # 单条配置
GET        /v1/build-cache/effective|enabled               # 生效配置
GET/POST   /v1/build-cache/entries                         # 缓存条目
DELETE     /v1/build-cache/entries/:id                     # 删除条目
POST       /v1/build-cache/cleanup/expired|lru|clear/:configId  # 批量清理
```

### Build Pod (`/api/v1/build-pods`)
```
GET/POST   /v1/build-pods                  # 列表/创建
GET        /v1/build-pods/:id|:id/logs     # 详情/日志
POST       /v1/build-pods/:id/cleanup|cancel  # 清理/取消
```

### 构建日志 (`/api/v1/build-logs`)
```
GET    /v1/build-logs|/:id|/:id/text  # 列表/详情/纯文本
GET    /v1/build-logs/:id/stream      # SSE 流式日志
POST   /v1/build-logs/:id/complete    # 标记完成
```

### 产物管理 (`/api/v1/artifacts`)
```
GET/POST   /v1/artifacts                       # 列表/创建
GET        /v1/artifacts/:id|:id/download      # 详情/下载
DELETE     /v1/artifacts/:id                   # 删除
POST       /v1/artifacts/cleanup/expired       # 清理过期
```

## 数据流

```
API (axios via api/build-env.ts)
  -> useEffect 触发请求
  -> useState 管理 loading/data/error
  -> Ant Design Table/Modal 渲染
```

SSE 日志使用 `EventSource` + `useRef` 管理连接 + `useState` 流式更新条目。

## UI 布局

- **镜像**: 表格 + 类型/状态过滤 + 搜索栏 + CRUD 操作列
- **缓存**: 双 Tab 布局（配置列表 + 缓存条目），批量清理操作按钮
- **Pod**: 表格 + runId/stageId/status 过滤 + 取消操作
- **日志**: 多条件过滤表格 + 日志查看器（SSE 流式 + 关键词高亮）
- **产物**: 表格 + 下载按钮 + 过期时间标记 + 批量清理

## 关键交互

- 创建/编辑通过 Modal 表单
- 删除通过 Popconfirm 确认
- SSE 日志支持暂停/恢复/关键词搜索
- 产物下载通过重定向到下载 URL
- 批量清理操作带二次确认

## API 客户端文件

`orion-frontend/src/api/build-env.ts` — 导出约 30 个函数，覆盖 5 个资源组。
