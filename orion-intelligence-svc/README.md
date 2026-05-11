# Orion Intelligence Service

AI-powered intelligence service for the Orion platform. Provides ticket classification, code review, root cause analysis, solution recommendation, summarization, sentiment analysis, and SLA prediction.

## Overview

This service consolidates AI enhancement capabilities from `orion-ai-service` and `orion-platform-service` into a single, purpose-built Python microservice.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/ai/classify` | 工单分类 - Classify incoming support tickets |
| POST | `/api/v1/ai/code-review` | 代码审查 - AI-powered code review |
| POST | `/api/v1/ai/root-cause` | 根因分析 - Root cause analysis for incidents |
| POST | `/api/v1/ai/suggest-solution` | 解决方案推荐 - Recommend solutions |
| POST | `/api/v1/ai/summarize` | 工单摘要 - Generate ticket summaries |
| POST | `/api/v1/ai/sentiment` | 情感分析 - Sentiment analysis |
| POST | `/api/v1/ai/predict-sla` | SLA 预测 - Predict SLA breach probability |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/ready` | Readiness check |
| GET | `/metrics` | Prometheus metrics |

## Tech Stack

- **Python 3.11+**
- **FastAPI** - Web framework
- **Pydantic v2** - Data validation
- **uv** - Dependency management
- **OpenAI SDK** - LLM client (compatible with Claude, GPT, Qwen, etc.)
- **ClickHouse** - Analytics data store
- **Redis** - Caching layer
- **structlog** - Structured logging
- **Prometheus** - Metrics

## External Dependencies

| Service | Purpose | Config |
|---------|---------|--------|
| LLM API | Core AI reasoning | `LLM_API_BASE`, `LLM_API_KEY` |
| orion-knowledge-svc | RAG knowledge base | `KNOWLEDGE_SVC_URL` |
| ClickHouse | Historical incident analytics | `CLICKHOUSE_HOST`, `CLICKHOUSE_PORT` |

## Quick Start

### Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv) or pip
- Docker & Docker Compose (for local dependencies)

### Development Setup

```bash
# Install dependencies
uv sync

# Or with pip
pip install -e ".[dev]"

# Run with auto-reload
uvicorn src.main:app --reload --host 0.0.0.0 --port 8004
```

### Docker Compose (Full Stack)

```bash
# Copy and edit environment
cp .env.example .env

# Start all services (API, ClickHouse, Redis, PostgreSQL)
docker compose up -d

# Start with GPU support (uncomment in docker-compose.yml first)
# docker compose --profile gpu up -d
```

### Run Tests

```bash
uv run pytest
uv run pytest --cov=src --cov-report=html
```

### Linting

```bash
uv run ruff check src/
uv run mypy src/
```

## Project Structure

```
orion-intelligence-svc/
├── src/
│   ├── main.py                  # FastAPI application entry
│   ├── api/
│   │   ├── classify.py          # Ticket classification endpoint
│   │   ├── code_review.py       # Code review endpoint
│   │   ├── root_cause.py        # Root cause analysis endpoint
│   │   ├── solution.py          # Solution recommendation endpoint
│   │   ├── summarize.py         # Summarization endpoint
│   │   ├── sentiment.py         # Sentiment analysis endpoint
│   │   └── predict_sla.py       # SLA prediction endpoint
│   ├── services/
│   │   ├── ai_service.py        # Core AI service orchestrator
│   │   └── llm_client.py        # LLM API client
│   ├── models/
│   │   └── __init__.py          # Shared Pydantic models
│   └── utils/                   # Utilities
├── tests/                       # Test suite
├── config/                      # Configuration files
├── pyproject.toml               # Python dependencies
├── Dockerfile                   # Multi-stage build + GPU support
├── docker-compose.yml           # Local dev stack
└── .env.example                 # Environment variables
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│              API Gateway                        │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│          Orion Intelligence Service              │
│  ┌──────────────────────────────────────────┐   │
│  │            API Layer (FastAPI)            │   │
│  │  /classify /code-review /root-cause       │   │
│  │  /suggest-solution /summarize             │   │
│  │  /sentiment /predict-sla                  │   │
│  └──────────────────────┬───────────────────┘   │
│                         │                        │
│  ┌──────────────────────▼───────────────────┐   │
│  │           AIService (Orchestrator)        │   │
│  └──────┬──────────────┬──────────────┬─────┘   │
│         │              │              │          │
│  ┌──────▼─────┐ ┌─────▼──────┐ ┌────▼──────┐   │
│  │ LLM Client │ │ Knowledge  │ │ ClickHouse│   │
│  │ (OpenAI)   │ │ Base (RAG) │ │ (Analytics│   │
│  └────────────┘ └────────────┘ └───────────┘   │
└─────────────────────────────────────────────────┘
```

## Environment Variables

See `.env.example` for the complete list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_BASE` | LLM API base URL | `https://api.openai.com/v1` |
| `LLM_API_KEY` | LLM API key | - |
| `LLM_MODEL` | Default model | `gpt-4o` |
| `CLICKHOUSE_HOST` | ClickHouse host | `localhost` |
| `CLICKHOUSE_PORT` | ClickHouse port | `9000` |
| `KNOWLEDGE_SVC_URL` | Knowledge base URL | `http://localhost:8003` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/3` |

## TODO

- [ ] Implement AI service methods in `ai_service.py`
- [ ] Connect to orion-knowledge-svc for RAG queries
- [ ] Set up ClickHouse schema for historical analytics
- [ ] Add request/response caching with Redis
- [ ] Implement prompt templates per endpoint
- [ ] Add rate limiting and quota management
- [ ] Set up Prometheus dashboards
- [ ] Write integration tests for each endpoint
- [ ] Add structured logging correlation IDs
- [ ] Configure CI/CD pipeline
