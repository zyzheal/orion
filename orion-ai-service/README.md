# Orion AI Service

Orion 平台 AI 增强域基础服务。通过 NATS 订阅 Pipeline 和代码管理事件，提供 AI Code Review、智能测试选择等能力。

## 架构

```
┌─────────────────────────────────────────────────┐
│              Orion AI Service                    │
│                                                  │
│  ┌───────────┐  ┌───────────────────────────┐   │
│  │  FastAPI  │  │    Event Subscriber       │   │
│  │  (HTTP)   │  │    (NATS JetStream)       │   │
│  │           │  │                           │   │
│  │ /healthz  │  │  pipeline.run.completed   │   │
│  │ /status   │  │  code.pr.opened           │   │
│  └─────┬─────┘  └───────────┬───────────────┘   │
│        │                    │                    │
│  ┌─────┴────────────────────┴───────────────┐   │
│  │          AI Service (Abstract)           │   │
│  │  - analyze_pipeline()                    │   │
│  │  - analyze_code_review()                 │   │
│  │                                          │   │
│  │  (具体 AI 逻辑在 TASK-302 实现)          │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## 技术栈

- Python 3.11+
- FastAPI + Uvicorn
- nats-py (NATS JetStream 客户端)
- Pydantic (数据验证)
- pytest (测试)

## 快速开始

### 本地开发

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务 (NATS 未连接时也可以启动)
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# 3. 访问文档
open http://localhost:8000/docs
```

### Docker 部署

```bash
# 启动 AI Service + NATS
docker compose up -d

# 查看日志
docker compose logs -f orion-ai-service

# 健康检查
curl http://localhost:8000/api/v1/ai/healthz
```

### Kubernetes 部署

```bash
kubectl apply -f infra/k8s/
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ORION_AI_PORT` | `8000` | 服务端口 |
| `ORION_AI_NATS_SERVERS` | `nats://localhost:4222` | NATS 服务器地址 |
| `ORION_AI_LOG_LEVEL` | `INFO` | 日志级别 |
| `ORION_AI_SUBSCRIBED_TOPICS` | `pipeline.run.completed,code.pr.opened` | 订阅主题 |
| `ORION_AI_AI_MODEL_ENDPOINT` | `""` | AI 模型地址 (TASK-302) |
| `ORION_AI_AI_API_KEY` | `""` | AI 模型密钥 (TASK-302) |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 服务信息 |
| GET | `/healthz` | (已废弃，使用 `/api/v1/ai/healthz`) |
| GET | `/api/v1/ai/healthz` | 健康检查 |
| GET | `/api/v1/ai/status` | 服务状态 |
| GET | `/docs` | Swagger 文档 |
| GET | `/openapi.json` | OpenAPI 规范 |

## 订阅的事件

| 主题 | 说明 | 处理器 |
|------|------|--------|
| `pipeline.run.completed` | Pipeline 运行完成 | `pipeline_handler` |
| `code.pr.opened` | PR/MR 打开 | `code_review_handler` |

## 项目结构

```
orion-ai-service/
├── src/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── models/              # Pydantic 数据模型
│   │   └── __init__.py
│   ├── api/                 # API 路由
│   │   ├── __init__.py
│   │   └── routes.py
│   ├── events/              # 事件处理
│   │   ├── __init__.py
│   │   ├── subscriber.py    # NATS 订阅
│   │   ├── pipeline_handler.py
│   │   └── code_review_handler.py
│   └── services/            # 业务服务
│       └── ai_service.py    # AI 服务基类
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_config.py
│   ├── test_models.py
│   ├── test_api_routes.py
│   ├── test_events.py
│   └── test_ai_service.py
├── infra/
│   └── k8s/
│       ├── deployment.yaml  # K8s 部署（含 GPU 配置）
│       └── configmap.yaml
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pyproject.toml
└── README.md
```

## 运行测试

```bash
# 安装测试依赖
pip install -r requirements.txt

# 运行所有测试
pytest -v

# 运行测试并生成覆盖率报告
pytest -v --cov=src --cov-report=html
```

## GPU 资源配置

Kubernetes 部署配置包含 GPU 资源分配：

```yaml
resources:
  limits:
    nvidia.com/gpu: "1"
  requests:
    nvidia.com/gpu: "1"
tolerations:
  - key: "nvidia.com/gpu"
    operator: "Exists"
    effect: "NoSchedule"
```

## TODO (TASK-302)

- [ ] 接入真实 AI 模型服务
- [ ] 实现 Pipeline 智能分析
- [ ] 实现 AI Code Review
- [ ] 智能测试选择
- [ ] 分析结果持久化
- [ ] 分析结果事件发布
