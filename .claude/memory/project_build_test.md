---
name: 项目构建与测试
description: 平台服务(Node.js+Fastify)、前端(React+Vite)、API网关的构建命令和测试流程
type: project
---

# 构建与测试

## Platform Service (orion-platform-service)
- 技术栈: Node.js + TypeScript + Fastify
- `npm run dev` — tsx watch (热重载)
- `npm run build` — tsc 编译
- `npm run start` — node dist/index.js
- `npm run test` — jest
- `npm run type-check` — tsc --noEmit

## API Gateway (orion-api-gateway)
- 技术栈: Node.js + Fastify + http-proxy
- `npm run dev` / `npm run test`

## Frontend (orion-frontend)
- 技术栈: React + Vite + Ant Design + wujie 微前端
- `npm run dev` — vite
- `npm run test` — vitest
- `npm run test:e2e` — playwright

## 单测执行
- Jest (后端): `npx jest -- -t "test name" path/to/test.ts`
- Vitest (前端): `npx vitest run path/to/test.ts`

## 服务端口
- API Gateway: localhost:3000
- Platform Service: localhost:3001

**How to apply:** 开发和测试时 cd 到对应子目录执行命令。单测优先用 vitest/jest 直接运行特定文件。
