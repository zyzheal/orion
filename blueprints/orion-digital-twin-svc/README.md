# Orion Digital Twin Service

数字孪生服务（Digital Twin）- 系统状态镜像、沙箱隔离、流量录制与回放

从 `orion-platform-service/src/services/digital-twin/` 拆分出的独立微服务。

## 功能模块

| 模块 | 描述 |
|------|------|
| Twin 管理 | 创建/查询数字孪生快照 |
| 沙箱隔离 | 沙箱创建/停止/销毁/健康检查 |
| 流量录制 | 录制会话管理、流量记录 |
| 流量回放 | 回放会话、速度控制、报告 |

## Quick Start

```bash
bun install
bun run dev  # http://localhost:3008
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/digital-twins | 注册孪生 |
| GET | /api/v1/digital-twins | 列表 |
| GET | /api/v1/digital-twins/:id/state | 获取状态 |
| POST | /api/v1/digital-twins/:id/snapshot | 创建快照 |
| POST | /api/v1/digital-twins/sandbox | 创建沙箱 |
| GET | /api/v1/digital-twins/sandbox | 沙箱列表 |
| POST | /api/v1/digital-twins/sandbox/:id/stop | 停止沙箱 |
| DELETE | /api/v1/digital-twins/sandbox/:id | 销毁沙箱 |
| POST | /api/v1/digital-twins/:id/record | 录制流量 |
| POST | /api/v1/digital-twins/:id/recordings/start | 开始录制 |
| POST | /api/v1/digital-twins/:id/replay/start | 开始回放 |
| GET | /api/v1/digital-twins/replay/:id/status | 回放状态 |

## 端口

- **3008** - Digital Twin Service
