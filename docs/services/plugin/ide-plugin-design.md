# Orion IDE Plugin Architecture Design

## Overview

Orion IDE Plugin is a VS Code extension that provides AI-powered code completion and code chat functionality, leveraging Orion's existing AI infrastructure (AIGateway, VectorStore).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code IDE                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ InlineCompletion│  │   Chat Panel    │  │  Status Bar     │  │
│  │    Provider     │  │   (Webview)     │  │   Indicator     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│  ┌────────┴────────────────────┴────────────────────┴────────┐  │
│  │              Orion Extension Host                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │Completion   │  │   Chat      │  │  Context    │        │  │
│  │  │  Provider   │  │  Provider   │  │  Collector  │        │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │  │
│  │         │                │                │               │  │
│  │  ┌──────┴────────────────┴────────────────┴──────────────┐│  │
│  │  │              Orion API Client                          ││  │
│  │  │  - Authentication (API Key / JWT)                      ││  │
│  │  │  - Request Formatting                                  ││  │
│  │  │  - Response Handling                                   ││  │
│  │  │  - Error Recovery                                      ││  │
│  │  └────────────────────────────────────────────────────────┘│  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/SSE
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Orion Backend                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  IDE Completion │  │    IDE Chat     │  │ Context Collect │  │
│  │     Service      │  │    Service      │  │    Service      │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│  ┌────────┴────────────────────┴────────────────────┴────────┐  │
│  │                    AIGateway                                │  │
│  │  - Model Routing (Claude / GPT / Local)                     │  │
│  │  - Prompt Injection Protection                              │  │
│  │  - Circuit Breaker & Degradation                            │  │
│  │  - Token Tracking                                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                    VectorStore                              │  │
│  │  - Code Semantic Index                                      │  │
│  │  - Documentation Search                                     │  │
│  │  - Similar Code Retrieval                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. InlineCompletionProvider

**Purpose**: Provide real-time code completion as user types.

**Trigger Mechanisms**:
- Auto-trigger: After typing delay (configurable, default 300ms)
- Manual trigger: Ctrl+Alt+Space
- Special characters: `.` , `(` , `{`

**Context Collection**:
```typescript
interface CompletionContext {
  // Current file
  filePath: string;
  languageId: string;
  cursorPosition: { line: number; column: number };
  
  // Code context
  prefix: string;       // 500 lines before cursor
  suffix: string;       // 50 lines after cursor
  currentLine: string;
  
  // Project context
  projectRoot: string;
  relatedFiles: string[];  // Via LSP/imports
  
  // User context
  recentEdits: Edit[];
  preferences: UserPreferences;
}
```

**Completion Response**:
```typescript
interface CompletionResponse {
  completions: CompletionItem[];
  metadata: {
    model: string;
    latencyMs: number;
    cached: boolean;
  };
}

interface CompletionItem {
  text: string;
  displayText: string;
  range: Range;
  isInline: boolean;
  confidence: number;
}
```

### 2. ChatProvider

**Purpose**: Provide code Q&A in a sidebar panel.

**Features**:
- Multi-turn conversation with context retention
- Code block rendering with syntax highlighting
- File reference linking
- Streaming response (SSE)

**Chat Request**:
```typescript
interface ChatRequest {
  message: string;
  context: {
    activeFile?: FileInfo;
    selectedCode?: CodeSelection;
    recentFiles?: FileInfo[];
  };
  conversationId?: string;  // For multi-turn
}
```

**Chat Response (SSE)**:
```typescript
interface ChatStreamEvent {
  type: 'text' | 'code' | 'file_ref' | 'done' | 'error';
  content: string;
  metadata?: {
    language?: string;
    filePath?: string;
    lineRange?: Range;
  };
}
```

### 3. ContextCollector

**Purpose**: Collect and prioritize code context for AI requests.

**Context Sources**:
1. **LSP Integration**: Symbols, imports, type definitions
2. **File System**: Related files via import analysis
3. **VectorStore**: Semantic similar code from knowledge base
4. **Git History**: Recent changes, commit context

**Context Prioritization**:
```typescript
interface ContextPriority {
  // Priority levels (higher = more important)
  IMPORTS_AND_TYPES: 10;     // Direct dependencies
  CURRENT_FILE: 8;          // Active file content
  RECENT_EDITS: 6;          // Recent changes
  SEMANTIC_SIMILAR: 4;      // VectorStore results
  GIT_CONTEXT: 2;           // Commit history
}
```

## API Design

### Completion API

**Endpoint**: `POST /api/v1/ide/completion`

**Request**:
```json
{
  "context": {
    "filePath": "src/services/UserService.ts",
    "languageId": "typescript",
    "cursorPosition": { "line": 42, "column": 15 },
    "prefix": "...",
    "suffix": "...",
    "currentLine": "async function getUser"
  },
  "options": {
    "maxTokens": 100,
    "temperature": 0.3,
    "model": "claude-sonnet-4"
  }
}
```

**Response**:
```json
{
  "completions": [
    {
      "text": "(id: string): Promise<User> {\n  return this.db.users.findUnique({ where: { id } });\n}",
      "displayText": "(id: string): Promise<User>",
      "range": { "start": { "line": 42, "column": 15 }, "end": { "line": 42, "column": 15 } },
      "confidence": 0.92
    }
  ],
  "metadata": {
    "model": "claude-sonnet-4",
    "latencyMs": 245,
    "cached": false
  }
}
```

### Chat API

**Endpoint**: `POST /api/v1/ide/chat` (SSE)

**Request**:
```json
{
  "message": "How do I add pagination to this query?",
  "context": {
    "activeFile": {
      "path": "src/services/UserService.ts",
      "content": "..."
    },
    "selectedCode": {
      "text": "return this.db.users.findMany();",
      "range": { "start": { "line": 50, "column": 3 }, "end": { "line": 50, "column": 30 } }
    }
  },
  "conversationId": "conv-123"
}
```

**Response (SSE stream)**:
```
event: text
data: {"content": "To add pagination, you can use Prisma's `skip` and `take` parameters:"}

event: code
data: {"content": "return this.db.users.findMany({\n  skip: (page - 1) * pageSize,\n  take: pageSize\n});", "language": "typescript"}

event: file_ref
data: {"filePath": "src/services/UserService.ts", "lineRange": {"start": 50, "end": 53}}

event: done
data: {"conversationId": "conv-123"}
```

## Performance Optimization

### Multi-level Cache

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cache Layers                              │
├─────────────────────────────────────────────────────────────────┤
│  L1: In-memory (Extension Host)                                 │
│  │ - Exact match cache (completion text → result)              │
│  │ - TTL: 5 minutes, Size: 100 entries                          │
│  │ - Hit rate target: 30%                                       │
├─────────────────────────────────────────────────────────────────┤
│  L2: Local Storage (VS Code globalState)                        │
│  │ - Semantic cache (context hash → result)                    │
│  │ - TTL: 24 hours, Size: 500 entries                           │
│  │ - Hit rate target: 40%                                       │
├─────────────────────────────────────────────────────────────────┤
│  L3: Orion Backend Cache                                        │
│  │ - Distributed cache (Redis)                                  │
│  │ - TTL: 7 days                                                │
│  │ - Hit rate target: 20%                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Incremental Completion

- **Strategy**: Reuse previous completion when only suffix changes
- **Condition**: Same prefix + cursor moved forward < 10 characters
- **Benefit**: Reduces API calls by 50%+

### Streaming Response

- **Chat**: SSE streaming for immediate feedback
- **Completion**: Optional streaming for long completions

## Security

### Authentication

```typescript
interface AuthConfig {
  // API Key (recommended for IDE)
  apiKey: string;
  
  // JWT Token (alternative)
  jwtToken?: string;
  
  // Session Token (browser integration)
  sessionToken?: string;
}
```

### Prompt Injection Protection

All requests go through Orion's `PromptInjectionDetector`:
- Risk score > 70: Request rejected
- Risk score 50-70: Prompt sanitized
- Risk score < 50: Allowed

### Data Privacy

- **Local preprocessing**: Sensitive patterns detected before sending
- **Context filtering**: Only necessary code sent to backend
- **User control**: Opt-out of context collection

## Configuration

```typescript
interface OrionExtensionConfig {
  // Connection
  apiEndpoint: string;         // Default: https://api.orion.dev
  apiKey: string;
  
  // Completion
  completionEnabled: boolean;
  completionTriggerDelay: number;  // ms, default: 300
  completionMaxTokens: number;     // default: 100
  completionModel: string;         // default: claude-sonnet-4
  
  // Chat
  chatEnabled: boolean;
  chatModel: string;               // default: claude-sonnet-4
  
  // Context
  contextCollectEnabled: boolean;
  contextMaxFiles: number;         // default: 5
  contextMaxLines: number;         // default: 500
  
  // Performance
  cacheEnabled: boolean;
  streamingEnabled: boolean;
}
```

## Development Roadmap

### Phase 1: MVP (4 weeks)
- VS Code extension scaffolding
- InlineCompletionProvider basic implementation
- Orion backend API integration
- Basic authentication

### Phase 2: Chat (3 weeks)
- Chat panel webview
- SSE streaming
- Multi-turn conversation
- User feedback collection

### Phase 3: Advanced (3 weeks)
- LSP integration for context
- VectorStore knowledge base
- Multi-level cache
- Performance optimization

### Phase 4: Enterprise (2 weeks)
- Multi-tenant isolation
- Admin dashboard
- Monitoring integration
- Security hardening

## Performance Targets

| Metric | Target | Priority |
|--------|--------|----------|
| Completion latency (P95) | < 500ms | Critical |
| Completion accuracy | > 85% | Critical |
| Cache hit rate | > 40% | High |
| Error rate | < 0.1% | High |
| Availability | > 99.9% | Medium |

## Cost Estimation

**Development**: 42 person-weeks (12 weeks × 3.5 people)

**Operations** (1000 daily active users):
- LLM API: ~5000 CNY/month
- Server: ~2000 CNY/month
- Total: ~7000 CNY/month

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [InlineCompletionItemProvider](https://code.visualstudio.com/api/references/vscode-api#InlineCompletionItemProvider)
- [Continue.dev](https://github.com/continuedev/continue) - Open source reference
- [Orion AIGateway](../../../orion-platform-service/src/services/ai/AIGateway.ts)
- [Orion VectorStore](../../../orion-platform-service/src/services/ai/VectorStore.ts)