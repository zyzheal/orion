# AI Decision Engine + Gateway LLM Integration Gap Report (P1-12/13)

**Date:** 2026-07-20
**Scope:** `orion-platform-svc-go/internal/ai-decisions/` and `orion-platform-svc-go/internal/ai-gateway/`
**Classification:** P1 — Handlers/services exist but no real LLM provider integration

---

## 1. Module Overview

### ai-decisions (331-line handler)

A **full decision management system** — records AI decisions, tracks reasoning/alternatives, supports feedback loops, traces execution steps, and provides batch analysis.

**Files present:**
| File | Role |
|------|------|
| `internal/ai-decisions/models/models.go` | 219 lines — AIDecision, DecisionReasoning, DecisionFactor, DecisionAlternative, Feedback, Trace, analysis types |
| `internal/ai-decisions/repository/repository.go` | ~395 lines — PostgreSQL via sqlx, 3 tables (ai_decisions, ai_decision_feedback, ai_decision_traces) |
| `internal/ai-decisions/repository/repository_interface.go` | Data access contract (15 methods) |
| `internal/ai-decisions/service/service.go` | 657 lines — Full CRUD + analysis logic + explanation generation |
| `internal/ai-decisions/service/service_interface.go` | 25 methods, auto-generated |
| `internal/ai-decisions/handler/handler.go` | 351 lines — 10 endpoints, Gin, auth, tracing |

### ai-gateway (128-line handler)

A **request logging wrapper** — records LLM requests/responses but does NOT actually call any LLM.

**Files present:**
| File | Role |
|------|------|
| `internal/ai-gateway/models/models.go` | 28 lines — GatewayRequest (model, provider, input, maxTokens, temperature) + GatewayResponse |
| `internal/ai-gateway/repository/repository.go` | ~77 lines — PostgreSQL table + CRUD |
| `internal/ai-gateway/repository/repository_interface.go` | 6 methods |
| `internal/ai-gateway/service/service.go` | 80 lines — Validation + repo passthrough only |
| `internal/ai-gateway/service/service_interface.go` | 6 methods, auto-generated |
| `internal/ai-gateway/handler/handler.go` | 136 lines — 6 endpoints (POST process, GET by id, list, by-provider, by-model, recent) |

---

## 2. What Exists (Working Features)

### ai-decisions — Working
- Full CRUD for AI decisions with tenant isolation
- 10 decision types: pipeline_selection, resource_allocation, scheduling, scaling, optimization, anomaly_detection, risk_assessment, cost_prediction, quality_gate, custom
- 6 decision statuses: pending, executed, accepted, rejected, overridden, failed
- Human-readable explanation generation from stored reasoning (JSONB parsing → formatted text)
- Batch analysis: pattern/trend/anomaly/correlation on decision history
- Feedback loop: positive/negative/neutral → auto-updates decision status (accepted/rejected)
- Execution traces: 4-step default seed (data_collection → feature_extraction → model_inference → result_generation)
- Stats: total, by-status, by-type, avg confidence, acceptance rate, positive feedback rate, avg impact

### ai-gateway — Working
- Request/response logging with model, provider, input, output, tokens, latency tracking
- List by provider, by model, and recent requests
- Auto-creates table on init (`EnsureTable`)
- Auth + tracing on all routes

---

## 3. What's Missing (Gap Analysis)

### Gap 1: No LLM Provider Interface (CRITICAL)

**Entirely missing** across both modules. There is no interface, no client, no abstraction for calling an LLM. The codebase was searched across `orion-platform-svc-go` and `orion-go-common` — **zero LLM client code exists**.

**Required file(s):**
```
internal/ai-gateway/llm/llm_provider_interface.go   (NEW)
internal/ai-gateway/llm/openai_client.go            (NEW)
internal/ai-gateway/llm/anthropic_client.go         (NEW)
internal/ai-gateway/llm/custom_client.go            (NEW)
```

**Required interface:**
```go
// internal/ai-gateway/llm/llm_provider_interface.go

package llm

type ProviderType string

const (
    ProviderTypeOpenAI      ProviderType = "openai"
    ProviderTypeAnthropic   ProviderType = "anthropic"
    ProviderTypeCustom      ProviderType = "custom"
    ProviderTypeLocal       ProviderType = "local"
)

type ChatRequest struct {
    Model       string
    Messages    []Message   // {Role, Content}
    Temperature float64
    MaxTokens   int
    TopP        float64
    Stream      bool
}

type Message struct {
    Role    string  // "system" | "user" | "assistant"
    Content string
}

type ChatResponse struct {
    Content   string
    Model     string
    Provider  ProviderType
    InputTokens  int
    OutputTokens int
    TotalTokens  int
    LatencyMs    int64
    FinishReason string
}

type LLMProvider interface {
    Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error)
    ChatStream(ctx context.Context, req *ChatRequest) (chan *StreamChunk, error)
    Name() ProviderType
}

type StreamChunk struct {
    Content    string
    Done       bool
    Error      error
}

type ProviderRegistry struct {
    providers map[ProviderType]LLMProvider
}

func (r *ProviderRegistry) Register(p LLMProvider)
func (r *ProviderRegistry) Get(name ProviderType) (LLMProvider, error)
func (r *ProviderRegistry) Resolve(model string) (LLMProvider, error)  // model → provider routing
```

### Gap 2: No Real LLM Client Implementations (CRITICAL)

**Required implementations:**

```go
// internal/ai-gateway/llm/openai_client.go

type OpenAIClient struct {
    baseURL    string   // "https://api.openai.com/v1"
    apiKey     string
    httpClient *http.Client
    defaultModel string
}

func (c *OpenAIClient) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error)
func (c *OpenAIClient) ChatStream(ctx context.Context, req *ChatRequest) (chan *StreamChunk, error)
func (c *OpenAIClient) Name() ProviderType
```

```go
// internal/ai-gateway/llm/anthropic_client.go

type AnthropicClient struct {
    baseURL    string   // "https://api.anthropic.com/v1"
    apiKey     string
    httpClient *http.Client
    version    string   // "2023-06-01"
    defaultModel string
}
```

**Required dependencies:**
```
github.com/google/go-querystring (for URL encoding)
# OR use stdlib net/http directly (no external deps needed)
# OpenAI/Anthropic APIs are simple REST, can be implemented without SDKs
```

### Gap 3: Gateway Service Does Not Call LLM (CRITICAL)

The `RecordRequest` method in `internal/ai-gateway/service/service.go` (line 34-48) validates input but **never sends it to an LLM**. It simply logs the request with an empty output.

**Required change to `service/service.go`:**
```go
// service.go — add LLM provider field to Service struct

type Service struct {
    repo      RepositoryInterface
    llm       *llm.ProviderRegistry   // NEW field
}

func NewService(repo RepositoryInterface, llm *llm.ProviderRegistry) *Service {
    return &Service{repo: repo, llm: llm}
}

// RecordRequest — add actual LLM call (around line 34-48)
func (s *Service) RecordRequest(ctx context.Context, tenantID string, req *models.GatewayRequest) (*models.GatewayResponse, error) {
    // ... existing validation ...

    // [NEW] Resolve provider from model name or explicit provider field
    providerName := req.Provider
    if providerName == "" {
        providerName = inferProviderFromModel(req.Model)
    }

    provider, err := s.llm.Get(llm.ProviderType(providerName))
    if err != nil {
        return nil, fmt.Errorf("LLM provider %q not registered: %w", providerName, err)
    }

    // [NEW] Build chat request and call LLM
    start := time.Now()
    chatReq := &llm.ChatRequest{
        Model:       req.Model,
        Messages:    []llm.Message{{Role: "user", Content: req.Input}},
        Temperature: req.Temperature,
        MaxTokens:   req.MaxTokens,
    }
    chatResp, err := provider.Chat(ctx, chatReq)
    if err != nil {
        return nil, fmt.Errorf("LLM call failed: %w", err)
    }

    resp := &models.GatewayResponse{
        Model:     req.Model,
        Provider:  string(provider.Name()),
        Input:     req.Input,
        Output:    chatResp.Content,           // NEW: actual LLM output
        Tokens:    chatResp.TotalTokens,        // NEW: actual token count
        LatencyMs: chatResp.LatencyMs,          // NEW: actual latency
        CreatedAt: time.Now().UTC(),
    }
    return s.repo.Create(ctx, tenantID, resp)
}
```

### Gap 4: Provider Configuration / Registry (HIGH)

No mechanism to register, configure, or discover LLM providers.

**Required file(s):**
```
internal/ai-gateway/llm/config.go          (NEW — provider configuration)
```

**Required structure:**
```go
// config.go

type ProviderConfig struct {
    Type         ProviderType
    Name         string
    BaseURL      string
    APIKey       string
    DefaultModel string
    Enabled      bool
}

func LoadProviderConfigs() ([]ProviderConfig, error)
func NewOpenAIClient(cfg ProviderConfig) *OpenAIClient
func NewAnthropicClient(cfg ProviderConfig) *AnthropicClient

// Default provider → model mapping (for auto-routing)
var DefaultModelProviderMap = map[string]ProviderType{
    "gpt-4":        ProviderTypeOpenAI,
    "gpt-4-turbo":  ProviderTypeOpenAI,
    "gpt-3.5-turbo": ProviderTypeOpenAI,
    "claude-opus":   ProviderTypeAnthropic,
    "claude-sonnet": ProviderTypeAnthropic,
    "claude-haiku":  ProviderTypeAnthropic,
}

func inferProviderFromModel(model string) ProviderType {
    if p, ok := DefaultModelProviderMap[model]; ok {
        return p
    }
    // fallback: try prefix matching
    strings.HasPrefix(model, "gpt") → ProviderTypeOpenAI
    strings.HasPrefix(model, "claude") → ProviderTypeAnthropic
}
```

### Gap 5: ai-decisions Needs LLM for "Smart" Decisions (HIGH)

The ai-decisions module stores decisions that were made by some external process, but has **no integration to generate decisions via LLM**. The `AnalysisDecisions` endpoint produces pattern/trend/anomaly insights from historical data — these could be enhanced with LLM-generated analysis.

**Required change to `internal/ai-decisions/service/service.go`:**

```go
// Add LLM provider to service (optional — could be injected for analysis)
type Service struct {
    repo RepositoryInterface
    llm  *llm.ProviderRegistry  // NEW — optional, for enhanced analysis
}

// Enhance AnalyzeDecisions to optionally use LLM for deeper insights
func (s *Service) AnalyzeDecisions(ctx context.Context, tenantID string, req *models.AnalyzeDecisionsRequest) (*models.AnalyzeDecisionsResult, error) {
    // ... existing statistical analysis ...

    // [NEW] If LLM available, generate natural language summary
    if s.llm != nil && req.AnalysisType == "pattern" {
        llmInsight, err := s.generateLLMInsight(ctx, allDecisions, req.AnalysisType)
        if err == nil {
            insights = append(insights, llmInsight)
        }
    }
    return &models.AnalyzeDecisionsResult{...}, nil
}

func (s *Service) generateLLMInsight(ctx context.Context, decisions []models.AIDecision, analysisType string) (models.AnalysisInsight, error) {
    // Build prompt from decision data, call LLM, parse response
    provider, _ := s.llm.Get(llm.ProviderTypeOpenAI) // or configured default
    req := &llm.ChatRequest{
        Model: "gpt-4",
        Messages: []llm.Message{
            {Role: "system", Content: "You are an AI decision analyst. Analyze the following decisions..."},
            {Role: "user", Content: serializeDecisions(decisions)},
        },
    }
    resp, err := provider.Chat(ctx, req)
    // parse resp.Content into AnalysisInsight
}
```

### Gap 6: Stream/SSE Support (MEDIUM)

The GatewayRequest model and handler have no streaming support. For long LLM responses, SSE is needed.

**Required changes:**
- `handler/handler.go` — add SSE handler for streaming responses
- `models/models.go` — add `Stream bool` field to GatewayRequest
- Service — add `ChatStream` path

### Gap 7: Token Cost Tracking (MEDIUM)

The `llm-trace` module already tracks per-request costs with a built-in pricing table. The ai-gateway module should integrate with it.

**Required integration:**
```go
// After LLM call in ai-gateway/service.go:
// Emit to llm-trace for cost tracking
traceReq := &llmtrace.TraceCreateRequest{
    ModelID:     resp.Model,
    PromptContent: req.Input,
    // ...
}
llmTraceService.Create(ctx, traceReq)
```

---

## 4. LLM Provider Landscape in This Codebase

| Location | What It Does | LLM Capability? |
|----------|-------------|-----------------|
| `internal/llm-trace/` | Tracks LLM call costs, pricing, daily stats | **Observer only** — does not call LLMs |
| `internal/ai-models/` | Model registry, versioning, canary | **Metadata only** — no LLM calls |
| `internal/ai-agents/` | Agent definitions | **Metadata only** — no LLM calls |
| `internal/ai-gateway/` | Request logging | **STUB** — no LLM calls |
| `internal/ai-decisions/` | Decision management | **No LLM calls** |
| `internal/chatops/` | ChatOps integration | **Has LLM traces** but not shown here |
| `orion-go-common/` | Shared pkg (auth, errors, otel) | **No LLM client** |

**Conclusion:** No LLM client exists anywhere in the Go codebase. This is a greenfield implementation.

---

## 5. Integration Points (Where Real LLM Calls Happen)

```
Client (frontend / API caller)
    │
    ▼
┌──────────────────────────────────────┐
│  ai-gateway handler (ProcessRequest) │  POST /ai-gateway
│     req: {model, input, maxTokens}  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  ai-gateway service (RecordRequest)  │  ← [GAP 3] needs LLM call here
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  llm.ProviderRegistry.Resolve(model)  │  ← [GAP 4] provider resolution
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  llm.LLMProvider.Chat(req)           │  ← [GAP 1+2] missing interface + impl
│  (OpenAI / Anthropic / Custom)       │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  llm.ChatResponse {content, tokens}  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  ai-gateway repository (Create)       │  ← existing, works
│  ai-gateway response {output, tokens} │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  (Optional) llm-trace (Create)        │  ← [GAP 7] cost tracking integration
└──────────────────────────────────────┘
```

---

## 6. Required New Files Summary

| Module | File | Lines (est.) | Priority |
|--------|------|-------------|----------|
| ai-gateway/llm | `llm_provider_interface.go` | 80 | P0 |
| ai-gateway/llm | `openai_client.go` | 150 | P0 |
| ai-gateway/llm | `anthropic_client.go` | 150 | P0 |
| ai-gateway/llm | `custom_client.go` | 80 | P1 |
| ai-gateway/llm | `config.go` | 60 | P1 |
| ai-gateway/service | `service.go` (modify) | +40 | P0 |
| ai-decisions/service | `service.go` (modify) | +60 | P2 |
| ai-gateway/handler | `handler.go` (modify, SSE) | +50 | P2 |
| ai-gateway/llm | `llm_test.go` | 200 | P3 |

**Total estimated new code: ~800 lines across ~8 files**

---

## 7. Required Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| (none — stdlib only) | — | OpenAI/Anthropic APIs are plain REST, `net/http` + `encoding/json` sufficient |

**Recommended (optional):**
```
github.com/anthropic/anthropic-go  — if preferring SDK over raw HTTP
github.com/sashabaranov/go-openai — if preferring SDK over raw HTTP
```
Either SDK can be avoided by using raw `net/http` — both APIs are simple JSON over HTTPS.

---

## 8. Implementation Priority

| Priority | Gap | Effort | Rationale |
|----------|-----|--------|-----------|
| **P0** | Gap 1: LLM Provider Interface | 0.5 day | Foundation for all LLM integration |
| **P0** | Gap 2: OpenAI + Anthropic clients | 2 days | Two most common providers |
| **P0** | Gap 3: Service LLM call | 0.5 day | Makes the gateway actually functional |
| **P1** | Gap 4: Provider config/registry | 0.5 day | Multi-provider support |
| **P2** | Gap 5: ai-decisions LLM analysis | 1 day | Enhanced analysis via LLM |
| **P2** | Gap 6: Stream/SSE support | 1 day | Real-time response |
| **P2** | Gap 7: llm-trace integration | 0.5 day | Cost tracking |
| **P3** | Gap 8: Custom provider | 1 day | Self-hosted / local models |

**Minimum viable product** = Gap 1 + Gap 2 + Gap 3 (provider interface + two clients + service call). This makes the ai-gateway actually call LLMs and return real responses.

---

## 9. Architecture Diagram (After Completion)

```
┌─────────────────┐
│   POST /ai-gw   │  {model: "gpt-4", input: "..."}
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  ai-gateway Service.RecordRequest   │
│  1. Validate                         │
│  2. Resolve provider from model      │──▶ ProviderRegistry
│  3. Call provider.Chat()             │──▶ OpenAIClient / AnthropicClient
│  4. Create repo record               │──▶ Repository (existing)
│  5. (optional) emit llm-trace        │──▶ llm-trace service
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  LLMProvider interface              │
│  ├── OpenAIClient    (gpt-4, etc)   │
│  ├── AnthropicClient (claude, etc)  │
│  └── CustomClient    (self-hosted)  │
└─────────────────────────────────────┘
```
