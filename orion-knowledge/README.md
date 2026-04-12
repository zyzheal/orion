# Orion-Knowledge

> Based on [PandaWiki](https://github.com/nanbingxyz/pandawiki) (AGPL-3.0), modified for Orion platform.

Orion-Knowledge 是 Orion 研发效能平台的**可插拔知识库微服务模块**，提供 AI 驱动的知识管理、文档协作和 RAG 智能问答能力。

## 快速启动

```bash
cd deploy
cp .env.example .env
docker compose up -d
```

启动后访问：
- **管理端**: http://localhost:3020
- **Wiki 用户端**: http://localhost:3010
- **API 文档**: http://localhost:8090/swagger/index.html

## 项目结构

```
orion-knowledge/
├── backend/          # Go 后端 API + Consumer 服务
├── web/
│   ├── admin/        # 管理端前端 (Vite + React)
│   ├── app/          # Wiki 用户端前端 (Next.js)
│   └── packages/     # 共享组件 (@orion-knowledge/*)
├── deploy/
│   ├── docker-compose.yaml
│   └── .env.example
├── sdk/              # RAG SDK
└── images/           # 文档图片
```

## 可插拔设计

- 独立的 `docker-compose.yaml`，与 Orion Visor 主系统解耦
- 所有端口可通过 `.env` 调整，默认避免端口冲突
- 启停不影响主系统：`docker compose up/down`

## 与 Orion Visor 集成

在 Orion Visor 的 Nginx 中添加反向代理路由，将流量转发到知识库服务。详见 [集成指南](../docs/knowledge/Orion-Knowledge%20微服务改造方案.md)。

## 许可证

本项目基于 AGPL-3.0 开源协议。原始代码版权归 PandaWiki 原作者所有，修改部分遵循相同协议。
