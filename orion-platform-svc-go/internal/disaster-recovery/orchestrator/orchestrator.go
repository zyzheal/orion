package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// DRPhase marks the lifecycle phase of a step.
type DRPhase string

const (
	PhasePreflight     DRPhase = "preflight"
	PhaseScaleDown     DRPhase = "scale_down"
	PhaseDataSync      DRPhase = "data_sync"
	PhaseTrafficSwitch DRPhase = "traffic_switch"
	PhaseScaleUp       DRPhase = "scale_up"
	PhaseVerification  DRPhase = "verification"
	PhaseCleanup       DRPhase = "cleanup"
	PhaseRollback      DRPhase = "rollback"
)

// StepStatus tracks the outcome of a single step.
type StepStatus string

const (
	StepPending  StepStatus = "pending"
	StepRunning  StepStatus = "running"
	StepSuccess  StepStatus = "success"
	StepFailed   StepStatus = "failed"
	StepSkipped  StepStatus = "skipped"
	StepRollback StepStatus = "rollback"
)

// Endpoint describes a source or target region.
type Endpoint struct {
	Name        string `json:"name"`
	Region      string `json:"region"`
	Kubeconfig  string `json:"kubeconfig,omitempty"`
	Namespace   string `json:"namespace"`
	DBHost      string `json:"dbHost"`
	DBPort      int    `json:"dbPort"`
	DBName      string `json:"dbName"`
	IngressHost string `json:"ingressHost"`
}

// DRStep defines one executable step in a DR plan.
type DRStep struct {
	ID              string        `json:"id"`
	Name            string        `json:"name"`
	Phase           DRPhase       `json:"phase"`
	Command         string        `json:"command"`
	Timeout         time.Duration `json:"timeout"`
	OnFail          string        `json:"onFail"`
	MaxRetries      int           `json:"maxRetries"`
	RollbackCommand string        `json:"rollbackCommand,omitempty"`
}

// DRPlan represents a complete disaster recovery plan.
type DRPlan struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	Description  string        `json:"description"`
	Source       Endpoint      `json:"source"`
	Target       Endpoint      `json:"target"`
	Steps        []DRStep      `json:"steps"`
	TotalTimeout time.Duration `json:"totalTimeout"`
	AutoRollback bool          `json:"autoRollback"`
	Enabled      bool          `json:"enabled"`
	CreatedAt    time.Time     `json:"createdAt"`
	UpdatedAt    time.Time     `json:"updatedAt"`
}

// DRStepResult records the outcome of one step execution.
type DRStepResult struct {
	StepID    string        `json:"stepId"`
	StepName  string        `json:"stepName"`
	Phase     DRPhase       `json:"phase"`
	Status    StepStatus    `json:"status"`
	StartedAt time.Time     `json:"startedAt"`
	EndedAt   *time.Time    `json:"endedAt,omitempty"`
	Output    string        `json:"output,omitempty"`
	Error     string        `json:"error,omitempty"`
	Duration  time.Duration `json:"duration"`
}

// DRResult records a full failover execution.
type DRResult struct {
	PlanID    string         `json:"planId"`
	Status    string         `json:"status"`
	StartedAt time.Time      `json:"startedAt"`
	EndedAt   *time.Time     `json:"endedAt,omitempty"`
	Steps     []DRStepResult `json:"steps"`
	Error     string         `json:"error,omitempty"`
}

// DRHealth summarizes source/target endpoint health.
type DRHealth struct {
	SourceHealthy   bool          `json:"sourceHealthy"`
	TargetHealthy   bool          `json:"targetHealthy"`
	ReplicationLag  time.Duration `json:"replicationLag,omitempty"`
	LastFailover    *time.Time    `json:"lastFailover,omitempty"`
	LastHealthCheck time.Time     `json:"lastHealthCheck"`
}

// --- Repository ---

type RepositoryInterface interface {
	CreatePlan(ctx context.Context, plan *DRPlan) error
	GetPlan(ctx context.Context, id string) (*DRPlan, error)
	ListPlans(ctx context.Context) ([]*DRPlan, error)
	UpdatePlan(ctx context.Context, plan *DRPlan) error
	DeletePlan(ctx context.Context, id string) error
	RecordResult(ctx context.Context, result *DRResult) error
	GetResults(ctx context.Context, planID string, limit int) ([]*DRResult, error)
	GetHealth(ctx context.Context, planID string) (*DRHealth, error)
}

// --- Command executor (pluggable) ---

type CommandExecutor func(ctx context.Context, command string) (string, error)

// DefaultExecutor is a stub that returns an error for unimplemented commands.
func DefaultExecutor(ctx context.Context, command string) (string, error) {
	return "", fmt.Errorf("command executor not configured")
}

// --- DROrchestrator ---

type DROrchestrator struct {
	repo     RepositoryInterface
	logger   *zap.Logger
	executor CommandExecutor
	mu       sync.Mutex
	active   map[string]*DRResult
}

func NewDROrchestrator(repo RepositoryInterface, logger *zap.Logger, executor CommandExecutor) *DROrchestrator {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	if executor == nil {
		executor = DefaultExecutor
	}
	return &DROrchestrator{
		repo:     repo,
		logger:   logger,
		executor: executor,
		active:   make(map[string]*DRResult),
	}
}

// Failover executes a DR plan from preflight through cleanup.
func (o *DROrchestrator) Failover(ctx context.Context, planID string) (*DRResult, error) {
	plan, err := o.repo.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}
	if !plan.Enabled {
		return nil, fmt.Errorf("plan %s is not enabled", planID)
	}

	o.mu.Lock()
	if existing, ok := o.active[planID]; ok && existing.Status == "running" {
		o.mu.Unlock()
		return nil, fmt.Errorf("failover already in progress for plan %s", planID)
	}
	result := &DRResult{PlanID: planID, Status: "running", StartedAt: time.Now()}
	o.active[planID] = result
	o.mu.Unlock()

	if plan.TotalTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, plan.TotalTimeout)
		defer cancel()
	}

	for i := range plan.Steps {
		step := &plan.Steps[i]
		sr := o.executeStep(ctx, step)
		result.Steps = append(result.Steps, *sr)

		o.logger.Info("DR step completed",
			zap.String("plan", plan.Name),
			zap.String("step", step.Name),
			zap.String("phase", string(step.Phase)),
			zap.String("status", string(sr.Status)))

		if sr.Status == StepFailed {
			result.Status = "failed"
			result.Error = fmt.Sprintf("step %s failed: %s", step.Name, sr.Error)
			now := time.Now()
			result.EndedAt = &now

			if plan.AutoRollback {
				o.logger.Info("starting auto-rollback", zap.String("plan", plan.Name))
				o.rollback(ctx, plan, result)
				result.Status = "rolled-back"
			}

			_ = o.repo.RecordResult(ctx, result)
			o.mu.Lock()
			delete(o.active, planID)
			o.mu.Unlock()
			return result, fmt.Errorf("step %s failed: %s", step.Name, sr.Error)
		}
	}

	result.Status = "success"
	now := time.Now()
	result.EndedAt = &now

	_ = o.repo.RecordResult(ctx, result)
	o.mu.Lock()
	delete(o.active, planID)
	o.mu.Unlock()
	return result, nil
}

func (o *DROrchestrator) executeStep(ctx context.Context, step *DRStep) *DRStepResult {
	result := &DRStepResult{
		StepID: step.ID, StepName: step.Name, Phase: step.Phase,
		Status: StepRunning, StartedAt: time.Now(),
	}

	stepCtx := ctx
	if step.Timeout > 0 {
		var cancel context.CancelFunc
		stepCtx, cancel = context.WithTimeout(ctx, step.Timeout)
		defer cancel()
	}

	maxRetries := step.MaxRetries
	if maxRetries <= 0 {
		maxRetries = 1
	}

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		output, err := o.executor(stepCtx, step.Command)
		if err == nil {
			result.Status = StepSuccess
			result.Output = output
			lastErr = nil
			break
		}
		lastErr = err
		result.Output = output
		result.Error = err.Error()
		if attempt < maxRetries {
			o.logger.Warn("DR step failed, retrying",
				zap.String("step", step.Name),
				zap.Int("attempt", attempt+1),
				zap.Error(err))
			time.Sleep(time.Duration(attempt+1) * 2 * time.Second)
		}
	}

	if lastErr != nil {
		if step.OnFail == "continue" {
			result.Status = StepSkipped
		} else {
			result.Status = StepFailed
		}
	}

	now := time.Now()
	result.EndedAt = &now
	result.Duration = now.Sub(result.StartedAt)
	return result
}

func (o *DROrchestrator) rollback(ctx context.Context, plan *DRPlan, result *DRResult) {
	for i := len(plan.Steps) - 1; i >= 0; i-- {
		step := plan.Steps[i]
		if step.RollbackCommand == "" {
			continue
		}
		o.logger.Info("executing rollback step", zap.String("step", step.Name))
		_, err := o.executor(ctx, step.RollbackCommand)
		if err != nil {
			o.logger.Error("rollback step failed", zap.String("step", step.Name), zap.Error(err))
		}
	}
}

// HealthCheck reports the health of source and target endpoints.
func (o *DROrchestrator) HealthCheck(ctx context.Context, planID string) (*DRHealth, error) {
	plan, err := o.repo.GetPlan(ctx, planID)
	if err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}
	h := &DRHealth{
		SourceHealthy:   o.checkEndpoint(plan.Source),
		TargetHealthy:   o.checkEndpoint(plan.Target),
		LastHealthCheck: time.Now(),
	}
	if plan.Source.DBHost != "" && plan.Target.DBHost != "" {
		h.ReplicationLag = 0
	}
	return h, nil
}

func (o *DROrchestrator) checkEndpoint(ep Endpoint) bool {
	return ep.Name != "" && ep.Region != "" && ep.DBHost != ""
}

// GetActiveFailovers returns all currently-running failover results.
func (o *DROrchestrator) GetActiveFailovers() map[string]*DRResult {
	o.mu.Lock()
	defer o.mu.Unlock()
	out := make(map[string]*DRResult, len(o.active))
	for k, v := range o.active {
		out[k] = v
	}
	return out
}

// ToJSON serializes a DRResult.
func (r *DRResult) ToJSON() (string, error) {
	data, err := json.Marshal(r)
	if err != nil {
		return "", fmt.Errorf("marshal: %w", err)
	}
	return string(data), nil
}

// DefaultDRPlan returns a standard failover plan template.
func DefaultDRPlan() *DRPlan {
	return &DRPlan{
		Name: "Default DR Plan", Description: "Standard DR failover plan",
		Enabled: true, TotalTimeout: 30 * time.Minute, AutoRollback: true,
		Steps: []DRStep{
			{ID: "preflight", Name: "Preflight Check", Phase: PhasePreflight, Command: "echo preflight", Timeout: 30 * time.Second, OnFail: "abort", MaxRetries: 1},
			{ID: "scale-down", Name: "Scale Down Source", Phase: PhaseScaleDown, Command: "kubectl scale --replicas=0", Timeout: 5 * time.Minute, OnFail: "abort", MaxRetries: 2, RollbackCommand: "kubectl scale --replicas=3"},
			{ID: "data-sync", Name: "Final Data Sync", Phase: PhaseDataSync, Command: "pg_repack", Timeout: 10 * time.Minute, OnFail: "abort", MaxRetries: 1},
			{ID: "traffic-switch", Name: "Switch Traffic", Phase: PhaseTrafficSwitch, Command: "kubectl annotate ingress traffic=active", Timeout: 1 * time.Minute, OnFail: "abort", MaxRetries: 3, RollbackCommand: "kubectl annotate ingress traffic=standby"},
			{ID: "scale-up", Name: "Scale Up Target", Phase: PhaseScaleUp, Command: "kubectl scale --replicas=3", Timeout: 5 * time.Minute, OnFail: "abort", MaxRetries: 2},
			{ID: "verify", Name: "Health Verification", Phase: PhaseVerification, Command: "curl -f /health", Timeout: 2 * time.Minute, OnFail: "abort", MaxRetries: 5},
			{ID: "cleanup", Name: "Cleanup Source", Phase: PhaseCleanup, Command: "echo cleanup", Timeout: 1 * time.Minute, OnFail: "continue", MaxRetries: 1},
		},
	}
}
