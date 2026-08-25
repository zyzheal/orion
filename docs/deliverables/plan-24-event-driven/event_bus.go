// ============================================================
// Plan 24 — 事件驱动架构 (Event-Driven)
// ============================================================
// 优先级: P1
// 来源: v3.5 系统评审
// 本地证据:
//   - internal/eventbus/ (10文件, 632行): 有完整 service + repository + models
//   - internal/eventbus/service/eventbus_service.go (284行): 内存 pub/sub (busConn)
//   - 本 Plan 的 SchemaRegistry 部分已提取到 plan-43-schema-registry/
//   - 本地 eventbus 比本 Plan 更完整，NATS 接入方案见 plan-34-nats-jetstream/
// 合并方案:
//   1. 本地 eventbus 保持不变 (已有更完整实现)
//   2. SchemaRegistry 提取为独立模块 → plan-43-schema-registry/
//   3. NATS JetStream 替换内存 busConn → plan-34-nats-jetstream/
// 详细设计参见 docs/deliverables/README.md P1-03 和 P1-13 小节
// ============================================================

package eventbus

import (
    "context"
    "encoding/json"
    "fmt"
    "math/rand"
    "sync"
    "time"
)

type EventSchema struct {
    ID            string     `json:"id"`
    Name          string     `json:"name"`
    Version       string     `json:"version"`
    Compatibility string     `json:"compatibility"`
    Fields        []FieldDef `json:"fields"`
}

type FieldDef struct {
    Name string `json:"name"`
    Type string `json:"type"`
    Required bool `json:"required"`
}

type SchemaRegistry struct {
    schemas map[string][]EventSchema
    mu      sync.RWMutex
}

func NewSchemaRegistry() *SchemaRegistry {
    return &SchemaRegistry{schemas: make(map[string][]EventSchema)}
}

func (r *SchemaRegistry) Register(s EventSchema) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    existing := r.schemas[s.Name]
    if len(existing) > 0 {
        latest := existing[len(existing)-1]
        if !isCompatible(latest, s) {
            return fmt.Errorf("schema %s v%s incompatible with v%s", s.Name, s.Version, latest.Version)
        }
    }
    r.schemas[s.Name] = append(r.schemas[s.Name], s)
    return nil
}

func (r *SchemaRegistry) GetLatest(name string) (*EventSchema, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    v, ok := r.schemas[name]
    if !ok || len(v) == 0 { return nil, fmt.Errorf("schema not found: %s", name) }
    latest := v[len(v)-1]
    return &latest, nil
}

func (r *SchemaRegistry) Validate(event map[string]interface{}, name string) error {
    s, err := r.GetLatest(name)
    if err != nil || s == nil { return nil }
    for _, f := range s.Fields {
        if f.Required && event[f.Name] == nil {
            return fmt.Errorf("missing required field: %s", f.Name)
        }
    }
    return nil
}

type EventMessage struct {
    ID        string                 `json:"id"`
    Topic     string                 `json:"topic"`
    Type      string                 `json:"type"`
    Key       string                 `json:"key"`
    Value     map[string]interface{} `json:"value"`
    Timestamp int64                  `json:"timestamp"`
    Headers   map[string]string      `json:"headers"`
}

type EventHandler func(msg EventMessage) error

type Consumer struct {
    config   ConsumerConfig
    handlers map[string][]EventHandler
    mu       sync.RWMutex
    ctx      context.Context
    cancel   context.CancelFunc
}

type ConsumerConfig struct {
    Brokers []string
    GroupID string
    Topics  []string
}

func NewConsumer(config ConsumerConfig) *Consumer {
    ctx, cancel := context.WithCancel(context.Background())
    return &Consumer{config: config, handlers: make(map[string][]EventHandler), ctx: ctx, cancel: cancel}
}

func (c *Consumer) RegisterHandler(topic string, handler EventHandler) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.handlers[topic] = append(c.handlers[topic], handler)
}

func (c *Consumer) Start() error {
    c.mu.RLock()
    topics := c.config.Topics
    handlers := make(map[string][]EventHandler)
    for k, v := range c.handlers { handlers[k] = v }
    c.mu.RUnlock()
    for _, topic := range topics {
        go func(t string) {
            for {
                select {
                case <-c.ctx.Done(): return
                default:
                    for _, h := range handlers[t] {
                        _ = h(EventMessage{Topic: t, Timestamp: time.Now().UnixMilli()})
                    }
                    time.Sleep(100 * time.Millisecond)
                }
            }
        }(topic)
    }
    return nil
}

func (c *Consumer) Stop() { c.cancel() }

type Publisher struct {
    brokers []string
}

func NewPublisher(brokers []string) *Publisher {
    return &Publisher{brokers: brokers}
}

func (p *Publisher) Publish(ctx context.Context, msg EventMessage) error {
    msg.ID = fmt.Sprintf("evt-%d-%d", time.Now().UnixNano(), rand.Int63())
    msg.Timestamp = time.Now().UnixMilli()
    if msg.Headers == nil { msg.Headers = map[string]string{"x-source": "orion"} }
    _, _ = json.Marshal(msg.Value)
    select {
    case <-ctx.Done(): return ctx.Err()
    default: return nil
    }
}

func isCompatible(old, new EventSchema) bool {
    if new.Compatibility == "none" { return true }
    oldFields := make(map[string]bool)
    for _, f := range old.Fields { if f.Required { oldFields[f.Name] = true } }
    for _, f := range new.Fields { if f.Required && !oldFields[f.Name] { return false } }
    return true
}
