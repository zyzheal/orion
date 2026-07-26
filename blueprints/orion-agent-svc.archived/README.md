# Orion Agent Service

Runner Agent Management Service - upgraded from `orion-runner-agent` with sandbox isolation, health checks, and graceful shutdown.

## Problem Solved

The original `orion-runner-agent` had critical issues:

| Issue | Original | New Service |
|-------|----------|-------------|
| Command execution | `child_process.exec` (command injection) | Docker sandbox with isolation |
| Security | No sandbox | Container with dropped capabilities, read-only FS, no network |
| Health checks | None | `/health` endpoint + Docker HEALTHCHECK |
| Shutdown | Abrupt | Graceful (SIGTERM/SIGINT handlers) |
| Testing | No tests | Vitest + full test scaffolds |
| Deployment | No containerization | Dockerfile + docker-compose |
| Scaling | Manual | Auto-scaling with cooldown |

## Architecture

```
Client/API ──> Fastify Server ──> AgentService (lifecycle)
                          │
                          ├── TaskExecutor (sandbox execution)
                          │       └── Docker container per task
                          │
                          └── RunnerManager (auto-scaling)
                                  └── Redis for state
```

## Quick Start

### Prerequisites

- Node.js >= 20
- Docker & Docker Compose
- Redis (or use docker-compose)

### Development

```bash
# Install dependencies
npm install

# Start Redis (if not using docker-compose)
docker run -d -p 6379:6379 redis:7-alpine

# Run in development mode with auto-reload
npm run dev

# Build
npm run build

# Run production
npm start
```

### Docker

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f orion-agent-svc

# Stop
docker compose down
```

## API Endpoints

### Agents

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agents/register` | Register a new Runner agent |
| POST | `/api/v1/agents/:id/heartbeat` | Update agent heartbeat |
| GET | `/api/v1/agents` | List all agents |
| GET | `/api/v1/agents/:id` | Get agent details |
| DELETE | `/api/v1/agents/:id` | Deregister an agent |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agents/:id/tasks` | Dispatch task to agent |
| GET | `/api/v1/agents/:id/tasks/:tid` | Get task status |
| GET | `/api/v1/agents/:id/tasks/:tid/logs` | Get task logs |
| POST | `/api/v1/agents/:id/tasks/:tid/cancel` | Cancel a running task |
| GET | `/api/v1/tasks` | List all tasks |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/` | Service info |

## Security Design

### Sandbox Execution

Every task runs in an isolated Docker container with:

- **Pinned base image** (`alpine:3.20` default)
- **Memory limits** (configurable, default 512MB)
- **CPU quotas** (configurable, default 1.0 cores)
- **Network disabled** (`network_mode: none`)
- **Read-only root filesystem**
- **All Linux capabilities dropped**
- **Non-root user**
- **Execution timeout** (configurable, default 300s)
- **Automatic container cleanup**

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment |
| `PORT` | `3100` | Server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `SANDBOX_IMAGE` | `alpine:3.20` | Sandbox container image |
| `SANDBOX_TIMEOUT` | `300` | Max execution time (seconds) |
| `SANDBOX_MEMORY_LIMIT` | `512m` | Memory per sandbox |
| `SANDBOX_CPU_LIMIT` | `1.0` | CPU per sandbox |
| `SANDBOX_NETWORK` | `none` | Network mode |
| `SANDBOX_READONLY_ROOT` | `true` | Read-only filesystem |
| `SANDBOX_DROP_CAPS` | `true` | Drop all capabilities |
| `HEARTBEAT_INTERVAL` | `15` | Expected heartbeat (seconds) |
| `HEARTBEAT_DEAD_THRESHOLD` | `60` | Dead threshold (seconds) |
| `HEARTBEAT_STALE_THRESHOLD` | `30` | Stale threshold (seconds) |
| `MAX_RUNNERS` | `10` | Max concurrent runners |
| `SCALING_COOLDOWN` | `60` | Scaling cooldown (seconds) |
| `RATE_LIMIT` | `100` | Requests per minute |

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Type checking
npm run typecheck
```

## Project Structure

```
orion-agent-svc/
├── src/
│   ├── app.ts                    # Fastify application entry
│   ├── config/
│   │   └── app.ts                # Environment configuration
│   ├── middleware/
│   │   ├── logger.ts             # Request logging
│   │   └── errorHandler.ts       # Global error handling
│   ├── routes/
│   │   ├── agent.ts              # Agent lifecycle routes
│   │   └── task.ts               # Task execution routes
│   ├── services/
│   │   ├── AgentService.ts       # Agent registration & heartbeat
│   │   ├── TaskExecutor.ts       # Sandboxed task execution
│   │   └── RunnerManager.ts      # Auto-scaling logic
│   └── types/
│       └── agent.ts              # TypeScript type definitions
├── test/
│   ├── app.test.ts               # Integration tests
│   ├── routes/
│   │   ├── agent.test.ts         # Agent route tests
│   │   └── task.test.ts          # Task route tests
│   ├── services/
│   │   ├── AgentService.test.ts  # AgentService tests
│   │   └── TaskExecutor.test.ts  # TaskExecutor tests
│   └── sandbox/
│       └── security.test.ts      # Sandbox security tests
├── Dockerfile                    # Multi-stage production build
├── docker-compose.yml            # Local development stack
├── package.json
├── tsconfig.json
└── .env.example
```

## Status

This is a skeleton project. Route endpoints return 501 Not Implemented.
Service classes have TODO markers for the full implementation.

### Implementation Priority

1. AgentService - registration, heartbeat, Redis persistence
2. TaskExecutor - Docker sandbox execution, log capture
3. RunnerManager - scaling evaluation and actions
4. Integration tests - end-to-end flow validation
5. Security hardening - penetration testing of sandbox
