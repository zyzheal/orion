# Orion MCP Server - AI Assistant Integration

## Overview

Orion implements a Model Context Protocol (MCP) Server that enables AI assistants like Claude to directly interact with Orion DevOps platform. This allows AI assistants to:

- Trigger and monitor pipelines
- Query deployment status and perform rollbacks
- Create and manage tickets/issues
- Run diagnostics and trigger self-healing actions
- Query cost data and detect anomalies

## MCP Protocol

MCP uses JSON-RPC 2.0 protocol. The server supports:

- **Tools**: Actions AI can execute (trigger pipeline, create ticket)
- **Resources**: Data AI can read (pipeline status, deployment list)
- **SSE**: Real-time event streaming

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/mcp` | POST | JSON-RPC endpoint |
| `/api/v1/mcp/sse` | GET | SSE connection |
| `/api/v1/mcp/tools` | GET | Tools list (debug) |
| `/api/v1/mcp/resources` | GET | Resources list (debug) |
| `/api/v1/mcp/info` | GET | Server info |

## Authentication

MCP requires authentication. Provide either:

1. **API Key**: `x-api-key` header (recommended for MCP clients)
2. **JWT Token**: Authorization header (for web users)

```bash
# Example with API key
curl -X POST http://localhost:3001/api/v1/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: orion-your-api-key" \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize"}'
```

## Available Tools

### Pipeline Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `pipeline_trigger` | Trigger pipeline execution | `pipeline_id`, `branch`, `environment` |
| `pipeline_status` | Query run status | `run_id`, `include_logs` |
| `pipeline_cancel` | Cancel running pipeline | `run_id`, `reason` |
| `pipeline_logs` | Get execution logs | `run_id`, `stage_name`, `tail` |

### Deployment Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `deployment_list` | Query deployment list | `environment`, `status`, `project_id` |
| `deployment_status` | Query deployment details | `deployment_id` |
| `deployment_rollback` | Rollback deployment | `deployment_id`, `target_version` |

### Ticket Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `ticket_create` | Create new ticket | `title`, `type`, `priority`, `description` |
| `ticket_list` | Query ticket list | `status`, `type`, `assignee` |
| `ticket_update` | Update ticket | `ticket_id`, `status`, `priority` |
| `ticket_assign` | Assign ticket | `ticket_id`, `assignee` |

### Diagnostic Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `diagnostic_run` | Run diagnostic | `target_type`, `target_id`, `analysis_type` |
| `diagnostic_result` | Get results | `diagnostic_id` |
| `selfhealing_trigger` | Trigger remediation | `action_id`, `diagnostic_id`, `dry_run` |

### FinOps Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `cost_query` | Query cost data | `start_date`, `end_date`, `group_by` |
| `cost_anomaly` | Detect anomalies | `threshold`, `lookback_days` |
| `cost_forecast` | Predict costs | `forecast_days` |

## Available Resources

### Project Resources

| URI | Description |
|-----|-------------|
| `projects://list` | List all projects |
| `projects://{id}` | Project details |

### Pipeline Resources

| URI | Description |
|-----|-------------|
| `pipelines://list` | List all pipelines |
| `pipelines://{id}/runs` | Pipeline run history |
| `pipelines://{id}/config` | Pipeline configuration |

### Deployment Resources

| URI | Description |
|-----|-------------|
| `deployments://list` | List deployments |
| `deployments://{id}` | Deployment details |
| `deployments://env/{env}` | Deployments by environment |

### Metrics Resources

| URI | Description |
|-----|-------------|
| `metrics://dora` | DORA metrics summary |
| `metrics://efficiency` | Efficiency metrics |
| `metrics://cost` | Cost metrics |

## Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "orion-devops": {
      "url": "http://localhost:3001/api/v1/mcp",
      "headers": {
        "x-api-key": "orion-your-api-key"
      }
    }
  }
}
```

See `docs/mcp/claude-desktop-config.json` for full configuration examples.

## Example Requests

### Initialize Connection

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "initialize"
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "orion-devops",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {},
      "resources": {}
    }
  }
}
```

### List Tools

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/list"
}
```

### Trigger Pipeline

```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "tools/call",
  "params": {
    "name": "pipeline_trigger",
    "arguments": {
      "pipeline_id": "pipe-001",
      "branch": "main",
      "environment": "staging"
    }
  }
}
```

### Read Resource

```json
{
  "jsonrpc": "2.0",
  "id": "4",
  "method": "resources/read",
  "params": {
    "uri": "pipelines://pipe-001/runs"
  }
}
```

## Implementation Files

| File | Description |
|------|-------------|
| `src/mcp/McpServer.ts` | MCP Server core implementation |
| `src/mcp/mcp-config.ts` | Configuration and types |
| `src/mcp/tools/*.ts` | Tool implementations |
| `src/mcp/resources/index.ts` | Resource implementations |
| `src/api/mcp-routes.ts` | HTTP endpoints |

## Testing

```bash
# Run MCP tests
cd orion-platform-service
npm run test -- --testPathPattern="mcp"
```

## Security Considerations

1. **API Key Required**: All MCP requests require valid API key or JWT
2. **Role-Based Access**: Tools respect user roles (admin, platform_admin)
3. **Audit Logging**: All MCP operations are logged for audit
4. **Rate Limiting**: Consider adding rate limits for production

## Future Enhancements

- [ ] Prompts support (predefined prompt templates)
- [ ] WebSocket transport option
- [ ] Streaming tool outputs
- [ ] Integration with actual repositories
- [ ] Real-time pipeline event subscriptions