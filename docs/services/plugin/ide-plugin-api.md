# Orion IDE Plugin API Interface Design

## Overview

This document defines the API interfaces required for the Orion IDE Plugin to communicate with the Orion backend.

## Base URL

```
Production: https://api.orion.dev/api/v1/ide
Development: http://localhost:3001/api/v1/ide
```

## Authentication

All API requests require authentication via one of:

### API Key (Recommended for IDE)

```http
Authorization: X-API-Key <api_key>
```

### JWT Token

```http
Authorization: Bearer <jwt_token>
```

### Session Token (Browser Integration)

```http
X-Session-Token: <session_token>
```

---

## API Endpoints

### 1. Code Completion

**Endpoint**: `POST /completion`

**Description**: Generate inline code completion suggestions.

**Request Headers**:
```http
Content-Type: application/json
Authorization: X-API-Key <api_key>
X-Request-Id: <uuid>  // Optional, for tracing
```

**Request Body**:
```typescript
interface CompletionRequest {
  context: {
    filePath: string;
    languageId: string;
    cursorPosition: {
      line: number;
      column: number;
    };
    prefix: string;       // Code before cursor (max 500 lines)
    suffix: string;       // Code after cursor (max 50 lines)
    currentLine: string;
  };
  options?: {
    maxTokens?: number;      // Default: 100
    temperature?: number;    // Default: 0.3
    model?: string;          // Default: "claude-sonnet-4"
    stopSequences?: string[];
  };
  metadata?: {
    ideVersion: string;
    extensionVersion: string;
    projectId?: string;
  };
}
```

**Example Request**:
```json
{
  "context": {
    "filePath": "src/services/UserService.ts",
    "languageId": "typescript",
    "cursorPosition": { "line": 42, "column": 15 },
    "prefix": "import { PrismaClient } from '@prisma/client';\n\nconst prisma = new PrismaClient();\n\nexport class UserService {\n  private db = prisma;\n\n  async getUser",
    "suffix": "\n  }\n}",
    "currentLine": "async getUser"
  },
  "options": {
    "maxTokens": 100,
    "temperature": 0.3,
    "model": "claude-sonnet-4"
  }
}
```

**Response (200 OK)**:
```typescript
interface CompletionResponse {
  completions: Array<{
    text: string;           // Full completion text
    displayText: string;    // Short display version
    range: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    isInline: boolean;      // True for inline, false for block
    confidence: number;     // 0-1, AI confidence score
  }>;
  metadata: {
    model: string;
    latencyMs: number;
    cached: boolean;
    tokensUsed: number;
  };
}
```

**Example Response**:
```json
{
  "completions": [
    {
      "text": "(id: string): Promise<User | null> {\n    return this.db.user.findUnique({ where: { id } });\n  }",
      "displayText": "(id: string): Promise<User | null>",
      "range": {
        "start": { "line": 42, "column": 15 },
        "end": { "line": 44, "column": 4 }
      },
      "isInline": false,
      "confidence": 0.92
    }
  ],
  "metadata": {
    "model": "claude-sonnet-4",
    "latencyMs": 245,
    "cached": false,
    "tokensUsed": 85
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid context or options
- `401 Unauthorized`: Invalid API key
- `403 Forbidden`: Quota exceeded
- `429 Too Many Requests`: Rate limit hit
- `500 Internal Error`: Backend failure

---

### 2. Code Chat (Streaming)

**Endpoint**: `POST /chat`

**Description**: Interactive code Q&A with streaming response.

**Request Headers**:
```http
Content-Type: application/json
Accept: text/event-stream
Authorization: X-API-Key <api_key>
```

**Request Body**:
```typescript
interface ChatRequest {
  message: string;
  context?: {
    activeFile?: {
      path: string;
      languageId: string;
      content: string;
    };
    selectedCode?: {
      text: string;
      languageId: string;
      range: {
        start: { line: number; column: number };
        end: { line: number; column: number };
      };
    };
    recentFiles?: Array<{
      path: string;
      languageId: string;
      summary: string;  // Brief description
    }>;
    diagnostics?: Array<{
      message: string;
      severity: 'error' | 'warning' | 'info';
      range: Range;
    }>;
  };
  conversationId?: string;  // For multi-turn, returned in first response
  options?: {
    model?: string;
    maxTokens?: number;
    includeCodeBlocks?: boolean;
  };
}
```

**Example Request**:
```json
{
  "message": "How do I add pagination to this query?",
  "context": {
    "activeFile": {
      "path": "src/services/UserService.ts",
      "languageId": "typescript",
      "content": "..."
    },
    "selectedCode": {
      "text": "return this.db.user.findMany();",
      "languageId": "typescript",
      "range": { "start": { "line": 50, "column": 3 }, "end": { "line": 50, "column": 30 } }
    }
  },
  "conversationId": null
}
```

**Response (SSE Stream)**:
```
event: conversation_id
data: {"conversationId": "conv-abc123"}

event: text
data: {"content": "To add pagination in Prisma, you can use "}

event: text
data: {"content": "the `skip` and `take` parameters:\n\n"}

event: code
data: {"content": "async getUsers(page: number, pageSize: number) {\n  return this.db.user.findMany({\n    skip: (page - 1) * pageSize,\n    take: pageSize,\n  });\n}", "language": "typescript"}

event: text
data: {"content": "\nThis will return a paginated list of users."}

event: file_ref
data: {"filePath": "src/services/UserService.ts", "range": {"start": 50, "end": 55}, "action": "suggest_edit"}

event: done
data: {"tokensUsed": 156}
```

**SSE Event Types**:
```typescript
type SSEEventType = 
  | 'conversation_id'  // New conversation ID
  | 'text'             // Text content
  | 'code'             // Code block with language
  | 'file_ref'         // File reference for editing
  | 'error'            // Error occurred
  | 'done';            // Stream complete

interface SSEEvent {
  type: SSEEventType;
  data: {
    content?: string;
    language?: string;
    filePath?: string;
    range?: Range;
    action?: 'suggest_edit' | 'open_file' | 'show_diff';
    conversationId?: string;
    tokensUsed?: number;
    error?: { code: string; message: string };
  };
}
```

---

### 3. Context Collection

**Endpoint**: `POST /context/collect`

**Description**: Analyze and collect relevant code context.

**Request Body**:
```typescript
interface ContextCollectRequest {
  rootPath: string;
  activeFile?: string;
  recentFiles?: string[];
  options?: {
    maxFiles?: number;      // Default: 5
    maxLinesPerFile?: number;  // Default: 100
    includeImports?: boolean;
    includeTypes?: boolean;
    includeGitContext?: boolean;
  };
}
```

**Response (200 OK)**:
```typescript
interface ContextCollectResponse {
  contexts: Array<{
    filePath: string;
    languageId: string;
    relevanceScore: number;  // 0-1
    content: string;
    symbols?: Array<{
      name: string;
      kind: 'function' | 'class' | 'variable' | 'interface';
      range: Range;
    }>;
  }>;
  metadata: {
    totalFilesAnalyzed: number;
    totalSymbolsFound: number;
    processingTimeMs: number;
  };
}
```

---

### 4. Available Models

**Endpoint**: `GET /models`

**Description**: List available AI models for IDE.

**Response (200 OK)**:
```typescript
interface ModelsResponse {
  models: Array<{
    id: string;
    name: string;
    provider: 'anthropic' | 'openai' | 'local';
    capabilities: {
      completion: boolean;
      chat: boolean;
      maxTokens: number;
    };
    pricing: {
      inputTokenCost: number;  // Per 1K tokens
      outputTokenCost: number;
    };
    availability: {
      status: 'available' | 'limited' | 'unavailable';
      queueTimeMs?: number;
    };
  }>;
  defaultModel: string;
}
```

---

### 5. Model Switch

**Endpoint**: `POST /models/{modelId}/switch`

**Description**: Switch active model for current session.

**Request Body**:
```typescript
interface ModelSwitchRequest {
  scope: 'session' | 'permanent';
  features: Array<'completion' | 'chat'>;
}
```

**Response (200 OK)**:
```typescript
interface ModelSwitchResponse {
  previousModel: string;
  currentModel: string;
  effectiveAt: Date;
}
```

---

### 6. User Feedback

**Endpoint**: `POST /feedback`

**Description**: Collect user feedback on AI suggestions.

**Request Body**:
```typescript
interface FeedbackRequest {
  type: 'completion' | 'chat';
  requestId: string;
  rating: 'positive' | 'negative' | 'neutral';
  details?: {
    accepted?: boolean;
    edited?: boolean;
    reason?: string;
    suggestedAlternative?: string;
  };
}
```

**Response (200 OK)**:
```typescript
interface FeedbackResponse {
  recorded: boolean;
  feedbackId: string;
}
```

---

### 7. Telemetry

**Endpoint**: `POST /telemetry`

**Description**: Report usage telemetry (batch).

**Request Body**:
```typescript
interface TelemetryRequest {
  events: Array<{
    type: 'completion_request' | 'completion_accept' | 'completion_reject' 
          | 'chat_request' | 'chat_continue' | 'cache_hit' | 'error';
    timestamp: Date;
    metadata: Record<string, any>;
  }>;
  sessionId: string;
}
```

**Response (200 OK)**:
```typescript
interface TelemetryResponse {
  recorded: number;
  sessionId: string;
}
```

---

## Data Models

### Range

```typescript
interface Range {
  start: { line: number; column: number };
  end: { line: number; column: number };
}
```

### FileInfo

```typescript
interface FileInfo {
  path: string;
  languageId: string;
  content?: string;
  summary?: string;
}
```

### CodeSelection

```typescript
interface CodeSelection {
  text: string;
  languageId: string;
  range: Range;
}
```

---

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId: string;
  timestamp: Date;
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CONTEXT` | 400 | Missing or invalid context |
| `AUTH_FAILED` | 401 | Authentication failed |
| `QUOTA_EXCEEDED` | 403 | Monthly quota exceeded |
| `RATE_LIMIT` | 429 | Too many requests |
| `MODEL_UNAVAILABLE` | 503 | Selected model unavailable |
| `INTERNAL_ERROR` | 500 | Backend processing error |

---

## Rate Limits

| Endpoint | Rate Limit | Burst |
|----------|------------|-------|
| `/completion` | 60/min | 10 |
| `/chat` | 30/min | 5 |
| `/context/collect` | 10/min | 3 |
| `/models` | 5/min | 2 |
| `/feedback` | 100/min | 20 |
| `/telemetry` | 10/min | 5 |

---

## Implementation Priority

| Endpoint | Priority | Status |
|----------|----------|--------|
| `/completion` | P0 | Needs implementation |
| `/chat` | P0 | Needs implementation |
| `/models` | P1 | Needs implementation |
| `/context/collect` | P1 | Needs implementation |
| `/models/{id}/switch` | P2 | Planned |
| `/feedback` | P2 | Planned |
| `/telemetry` | P2 | Planned |

---

## Backend Service Architecture

```
orion-platform-service/src/
├── api/
│   └── ide-completion-routes.ts     # Route definitions
├── services/
│   └─ ide/
│       ├── CompletionService.ts     # Completion logic
│       ├── ChatService.ts           # Chat logic
│       ├── ContextCollector.ts      # Context analysis
│       └── ModelRouter.ts           # Model selection
└── types/
    └── ide.ts                       # Type definitions
```

---

## Integration with Existing Services

### AIGateway Integration

```typescript
// CompletionService.ts
import { AIGateway } from '../ai/AIGateway';

export class CompletionService {
  private aiGateway: AIGateway;
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Build prompt from context
    const prompt = this.buildPrompt(request);
    
    // Call AIGateway with security check
    const response = await this.aiGateway.generate({
      prompt,
      model: request.options?.model,
      maxTokens: request.options?.maxTokens,
      temperature: request.options?.temperature,
    });
    
    return this.formatResponse(response);
  }
}
```

### VectorStore Integration

```typescript
// ContextCollector.ts
import { VectorStore } from '../ai/VectorStore';

export class ContextCollector {
  private vectorStore: VectorStore;
  
  async collect(request: ContextCollectRequest): Promise<ContextCollectResponse> {
    // Get semantic similar code
    const similar = await this.vectorStore.search({
      query: this.extractQuery(request),
      limit: request.options?.maxFiles,
    });
    
    // Merge with LSP analysis
    return this.mergeContexts(similar, request);
  }
}
```

---

## Next Steps

1. Implement `ide-completion-routes.ts` in `orion-platform-service/src/api/`
2. Create `services/ide/` directory with CompletionService and ChatService
3. Add type definitions in `types/ide.ts`
4. Update `routes.ts` to mount IDE routes
5. Create tests in `__tests__/ide/`