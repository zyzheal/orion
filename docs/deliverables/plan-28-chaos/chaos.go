// ============================================================
// Plan 28 — 混沌工程 (Chaos Engineering)
// ============================================================
// 优先级: P1
// 来源: v3.5 系统评审
// 本地证据:
//   - internal/chaos/ (10文件): 有 service + detector + handler — CRUD + 异常检测
//   - internal/chaos-enhanced/: 有增强模块
//   - 缺口: Execute 函数仅创建 InjectResult 记录, 不执行真实故障注入
//   - 无 Docker/K8s API 集成
// 合并方案:
//   1. 本 Plan 的 FaultType 定义可复用
//   2. 真实故障注入执行器 → plan-37-chaos-injector/injector.go
//   3. 使用 Docker exec / K8s API 执行真实故障
// 详细设计参见 docs/deliverables/README.md P1-06 小节
// ============================================================

package chaos

import (
    "context"
    "fmt"
    "math/rand"
    "sync"
    "time"
)

type FaultType string

const (
    FaultNetworkLatency   FaultType = "network_latency"
    FaultPacketLoss       FaultType = "packet_loss"
    FaultServiceDown      FaultType = "service_down"
    FaultCPUStress        FaultType = "cpu_stress"
    FaultMemoryStress     FaultType = "memory_stress"
    FaultDiskIO           FaultType = "disk_io"
    FaultDependencyFail   FaultType = "dependency_fail"
)

type Scenario struct {
    ID          string      `json:"id"`
    Name        string      `json:"name"`
    Description string      `json:"description"`
    FaultType   FaultType   `json:"fault_type"`
    Target      string      `json:"target"`
    Parameters  map[string]interface{} `json:"parameters"`
    Duration    time.Duration `json:"duration"`
    Expected    []string    `json:"expected"`
}

type Experiment struct {
    ID         string            `json:"id"`
    ScenarioID string            `json:"scenarioId"`
    Status     string            `json:"status"`
    StartedAt  *time.Time        `json:"startedAt"`
    FinishedAt *time.Time        `json:"finishedAt"`
    Results    ExperimentResult  `json:"results"`
}

type ExperimentResult struct {
    Passed       bool    `json:"passed"`
    Actual       string  `json:"actual"`
    Expected     string  `json:"expected"`
    DurationMs   int64   `json:"durationMs"`
    Observations []string `json:"observations"`
}

type Orchestrator struct {
    scenarios   []Scenario
    experiments []Experiment
    mu          sync.RWMutex
    injector    FaultInjector
}

type FaultInjector interface {
    Inject(ctx context.Context, ft FaultType, params map[string]interface{}) error
    Stop(ctx context.Context) error
}

type DefaultInjector struct{}

func (i *DefaultInjector) Inject(ctx context.Context, ft FaultType, params map[string]interface{}) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    case <-time.After(100 * time.Millisecond):
        return nil
    }
}

func (i *DefaultInjector) Stop(ctx context.Context) error { return nil }

func NewOrchestrator(injector FaultInjector) *Orchestrator {
    return &Orchestrator{
        scenarios:   DefaultScenarios,
        experiments: make([]Experiment, 0),
        injector:    injector,
    }
}

func (o *Orchestrator) AddScenario(s Scenario) {
    o.mu.Lock()
    defer o.mu.Unlock()
    o.scenarios = append(o.scenarios, s)
}

func (o *Orchestrator) ListScenarios() []Scenario {
    o.mu.RLock()
    defer o.mu.RUnlock()
    return o.scenarios
}

func (o *Orchestrator) RunExperiment(ctx context.Context, scenarioID string) (*Experiment, error) {
    o.mu.RLock()
    var scenario *Scenario
    for i := range o.scenarios {
        if o.scenarios[i].ID == scenarioID {
            scenario = &o.scenarios[i]
            break
        }
    }
    o.mu.RUnlock()

    if scenario == nil {
        return nil, fmt.Errorf("scenario %s not found", scenarioID)
    }

    exp := &Experiment{
        ID:         fmt.Sprintf("exp-%d", rand.Int63()),
        ScenarioID: scenarioID,
        Status:     "running",
        StartedAt:  ptrTime(time.Now()),
    }

    ctx, cancel := context.WithTimeout(ctx, scenario.Duration)
    defer cancel()

    err := o.injector.Inject(ctx, scenario.FaultType, scenario.Parameters)
    finished := time.Now()
    exp.FinishedAt = &finished
    exp.Status = "completed"
    exp.Results = ExperimentResult{
        Passed:     err == nil,
        Actual:     "fault injected successfully",
        Expected:   stringsJoin(scenario.Expected, ", "),
        DurationMs: time.Since(*exp.StartedAt).Milliseconds(),
    }
    if err != nil {
        exp.Status = "failed"
        exp.Results.Observations = append(exp.Results.Observations, err.Error())
    }

    o.mu.Lock()
    o.experiments = append(o.experiments, *exp)
    o.mu.Unlock()

    return exp, err
}

func (o *Orchestrator) RunSuite(ctx context.Context) ([]*Experiment, error) {
    o.mu.RLock()
    ids := make([]string, len(o.scenarios))
    for i, s := range o.scenarios { ids[i] = s.ID }
    o.mu.RUnlock()

    var mu sync.Mutex
    var wg sync.WaitGroup
    results := make([]*Experiment, len(ids))

    for i, id := range ids {
        wg.Add(1)
        go func(idx int, sid string) {
            defer wg.Done()
            exp, _ := o.RunExperiment(ctx, sid)
            mu.Lock()
            results[idx] = exp
            mu.Unlock()
        }(i, id)
    }
    wg.Wait()
    return results, nil
}

func (o *Orchestrator) GetExperiment(id string) (*Experiment, error) {
    o.mu.RLock()
    defer o.mu.RUnlock()
    for i := range o.experiments {
        if o.experiments[i].ID == id {
            return &o.experiments[i], nil
        }
    }
    return nil, fmt.Errorf("experiment %s not found", id)
}

var DefaultScenarios = []Scenario{
    {ID: "net-lat-001", Name: "网络延迟注入", FaultType: FaultNetworkLatency,
        Target: "api-gateway", Parameters: map[string]interface{}{"delay": "500ms", "jitter": "100ms"},
        Duration: 30 * time.Second, Expected: []string{"服务降级", "熔断触发"}},
    {ID: "pkt-loss-001", Name: "丢包注入", FaultType: FaultPacketLoss,
        Target: "service-mesh", Parameters: map[string]interface{}{"rate": "10%"},
        Duration: 30 * time.Second, Expected: []string{"重试机制", "自动恢复"}},
    {ID: "svc-down-001", Name: "服务宕机", FaultType: FaultServiceDown,
        Target: "notification-svc", Parameters: map[string]interface{}{"port": 8080},
        Duration: 60 * time.Second, Expected: []string{"故障转移", "告警触发"}},
    {ID: "cpu-stress-001", Name: "CPU压力", FaultType: FaultCPUStress,
        Target: "pipeline-worker", Parameters: map[string]interface{}{"cores": 2, "duration": "30s"},
        Duration: 60 * time.Second, Expected: []string{"限流", "队列积压"}},
    {ID: "dep-fail-001", Name: "依赖故障", FaultType: FaultDependencyFail,
        Target: "database-proxy", Parameters: map[string]interface{}{"timeout": "5s"},
        Duration: 30 * time.Second, Expected: []string{"缓存降级", "优雅失败"}},
}

func ptrTime(t time.Time) *time.Time { return &t }

func stringsJoin(ss []string, sep string) string {
    result := ""
    for i, s := range ss {
        if i > 0 { result += sep }
        result += s
    }
    return result
}
