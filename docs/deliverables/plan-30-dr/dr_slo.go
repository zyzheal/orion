// Plan 30 — 灾备与 SLO (Disaster Recovery & SLO)
// 本地: internal/dr/ (9 files: config, interfaces, models_json, response_writer, utils, utils_extended, README, internal/)
// 本地: internal/disaster-recovery/ (7 files: handler+models+repository+service)
// local has DRRepository/DRService stub interfaces + disaster-recovery CRUD
// 缺口: no RTO/RPO tracking, no DR drill automation, no failover orchestration, no SLO monitoring
package dr

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

type DRPhase string

const (
	PhasePrepare    DRPhase = "prepare"
	PhaseFailover   DRPhase = "failover"
	PhaseVerify     DRPhase = "verify"
	PhaseRestore    DRPhase = "restore"
	PhaseCleanup    DRPhase = "cleanup"
)

type DRStatus string

const (
	DRStatusActive    DRStatus = "active"
	DRStatusDrilling  DRStatus = "drilling"
	DRStatusFailed    DRStatus = "failed_over"
	DRStatusRestored  DRStatus = "restored"
	DRStatusInactive  DRStatus = "inactive"
)

type SLO struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Service       string  `json:"service"`
	TargetPct     float64 `json:"targetPct"`     // 99.9, 99.95, 99.99
	WindowDays    int     `json:"windowDays"`     // 7, 30, 90
	CurrentPct    float64 `json:"currentPct"`    // 当前 SLI
	ErrorBudget   float64 `json:"errorBudget"`   // (1-target) * 100
	BudgetUsed   float64 `json:"budgetUsed"`    // 已使用 budget 百分比
	BurnRate      float64 `json:"burnRate"`      // 当前消耗速率
	Status        string  `json:"status"`        // healthy, at_risk, exhausted
	UpdatedAt     time.Time `json:"updatedAt"`
}

type ErrorBudget struct {
	SLOID         string  `json:"sloId"`
	TotalSeconds  float64 `json:"totalSeconds"`   // window 内总秒数
	AllowedErrors float64 `json:"allowedErrors"` // 允许错误时间
	ConsumedErrors float64 `json:"consumedErrors"` // 已消耗错误时间
	Remaining     float64 `json:"remaining"`     // 剩余百分比
	BurnRate      float64 `json:"burnRate"`
	ProjectedExhaust time.Time `json:"projectedExhaust,omitempty"`
}

func (eb *ErrorBudget) Recompute(sli float64, window time.Duration) {
	eb.TotalSeconds = window.Seconds()
	eb.AllowedErrors = eb.TotalSeconds * (1 - sli/100)
	eb.ConsumedErrors = eb.TotalSeconds * (1 - sli/100) * (1 - eb.Remaining/100)
	if eb.AllowedErrors > 0 {
		eb.BurnRate = eb.ConsumedErrors / eb.AllowedErrors
	}
}

type DRPlan struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	PrimarySite  string    `json:"primarySite"`
	DRSite       string    `json:"drSite"`
	RTO          time.Duration `json:"rto"`          // Recovery Time Objective
	RPO          time.Duration `json:"rpo"`          // Recovery Point Objective
	Strategy     string    `json:"strategy"`          // active-active, active-passive, pilot-light
	CurrentPhase DRPhase   `json:"currentPhase"`
	Status       DRStatus  `json:"status"`
	LastDrill    *time.Time `json:"lastDrill,omitempty"`
	NextDrillDue time.Time  `json:"nextDrillDue"`
	CreatedAt    time.Time `json:"createdAt"`
}

type DRManager struct {
	mu      sync.Mutex
	plans   map[string]*DRPlan
	slos    map[string]*SLO
	budgets map[string]*ErrorBudget
}

func NewDRManager() *DRManager {
	return &DRManager{
		plans:   make(map[string]*DRPlan),
		slos:    make(map[string]*SLO),
		budgets: make(map[string]*ErrorBudget),
	}
}

type FailoverStep struct {
	ID          string    `json:"id"`
	Phase       DRPhase   `json:"phase"`
	Description string    `json:"description"`
	Status      string    `json:"status"` // pending, running, completed, failed
	StartedAt   *time.Time `json:"startedAt,omitempty"`
	FinishedAt  *time.Time `json:"finishedAt,omitempty"`
	Duration    time.Duration `json:"duration,omitempty"`
}

type FailoverPlan struct {
	DRPlanID   string          `json:"drPlanId"`
	Reason     string          `json:"reason"`  // drill, incident, test
	Steps      []FailoverStep  `json:"steps"`
	StartedAt  time.Time       `json:"startedAt"`
	FinishedAt *time.Time      `json:"finishedAt,omitempty"`
	ActualRTO  time.Duration   `json:"actualRto,omitempty"`
	Passed     bool            `json:"passed"`
}

func (m *DRManager) CreateDRPlan(name, primarySite, drSite, strategy string, rto, rpo time.Duration) *DRPlan {
	plan := &DRPlan{
		ID:           fmt.Sprintf("dr-%d", time.Now().UnixNano()),
		Name:         name,
		PrimarySite:  primarySite,
		DRSite:       drSite,
		RTO:          rto,
		RPO:          rpo,
		Strategy:     strategy,
		CurrentPhase: PhasePrepare,
		Status:       DRStatusActive,
		NextDrillDue: time.Now().Add(90 * 24 * time.Hour), // quarterly
		CreatedAt:    time.Now(),
	}
	m.mu.Lock()
	m.plans[plan.ID] = plan
	m.mu.Unlock()
	return plan
}

func (m *DRManager) InitiateFailover(ctx context.Context, drPlanID, reason string) (*FailoverPlan, error) {
	m.mu.Lock()
	plan, ok := m.plans[drPlanID]
	m.mu.Unlock()
	if !ok {
		return nil, errors.New("DR plan not found")
	}

	fp := &FailoverPlan{
		DRPlanID:  drPlanID,
		Reason:    reason,
		StartedAt: time.Now(),
		Steps: []FailoverStep{
			{ID: "fo-1", Phase: PhasePrepare, Description: "Verify DR site readiness", Status: "pending"},
			{ID: "fo-2", Phase: PhaseFailover, Description: "Switch DNS to DR site", Status: "pending"},
			{ID: "fo-3", Phase: PhaseFailover, Description: "Promote DR database to primary", Status: "pending"},
			{ID: "fo-4", Phase: PhaseVerify, Description: "Verify application health", Status: "pending"},
			{ID: "fo-5", Phase: PhaseCleanup, Description: "Notify stakeholders", Status: "pending"},
		},
	}

	plan.Status = DRStatusFailed
	plan.CurrentPhase = PhaseFailover

	start := time.Now()
	for i := range fp.Steps {
		step := &fp.Steps[i]
		step.Status = "running"
		step.StartedAt = &[]time.Time{time.Now()}[0]

		if err := m.executeFailoverStep(ctx, plan, step); err != nil {
			step.Status = "failed"
			finished := time.Now()
			step.FinishedAt = &finished
			step.Duration = time.Since(start)
			fp.Passed = false
			finish := time.Now()
			fp.FinishedAt = &finish
			fp.ActualRTO = time.Since(fp.StartedAt)
			return fp, fmt.Errorf("step %s failed: %w", step.ID, err)
		}

		step.Status = "completed"
		finished := time.Now()
		step.FinishedAt = &finished
		step.Duration = time.Since(*step.StartedAt)
	}

	fp.Passed = true
	fp.ActualRTO = time.Since(fp.StartedAt)
	finish := time.Now()
	fp.FinishedAt = &finish

	if reason == "drill" {
		plan.LastDrill = &finish
		plan.NextDrillDue = finish.Add(90 * 24 * time.Hour)
		plan.Status = DRStatusRestored
		plan.CurrentPhase = PhaseRestore
	}

	return fp, nil
}

func (m *DRManager) executeFailoverStep(ctx context.Context, plan *DRPlan, step *FailoverStep) error {
	// In production, these would interface with DNS, DB, health-check services
	switch step.Phase {
	case PhasePrepare:
		// Check DR site connectivity, resource availability
		return nil
	case PhaseFailover:
		// Execute DNS switch / DB promotion
		return nil
	case PhaseVerify:
		// Health check all services
		return nil
	case PhaseCleanup:
		// Send notifications
		return nil
	default:
		return nil
	}
}

type DRDrillReport struct {
	DRPlanID    string        `json:"drPlanId"`
	DrillDate   time.Time     `json:"drillDate"`
	PlannedRTO  time.Duration `json:"plannedRto"`
	ActualRTO   time.Duration `json:"actualRto"`
	PlannedRPO  time.Duration `json:"plannedRpo"`
	ActualRPO   time.Duration `json:"actualRpo"`
	RTOMet      bool          `json:"rtoMet"`
	RPOMet      bool          `json:"rpoMet"`
	Issues      []string      `json:"issues,omitempty"`
	Improvements []string     `json:"improvements,omitempty"`
}

func (m *DRManager) GenerateDrillReport(drPlanID string, fp *FailoverPlan) *DRDrillReport {
	m.mu.Lock()
	plan, ok := m.plans[drPlanID]
	m.mu.Unlock()

	report := &DRDrillReport{
		DRPlanID:   drPlanID,
		DrillDate:  fp.StartedAt,
		ActualRTO:  fp.ActualRTO,
		RTOMet:     fp.ActualRTO <= plan.RTO,
		RPOMet:     true, // would be measured from replication lag
	}
	if !report.RTOMet {
		report.Issues = append(report.Issues, fmt.Sprintf("RTO exceeded: %v > %v", fp.ActualRTO, plan.RTO))
		report.Improvements = append(report.Improvements, "Pre-stage resources at DR site", "Automate DNS failover")
	}
	return report
}

func (m *DRManager) CreateSLO(name, service string, target float64, windowDays int) *SLO {
	slo := &SLO{
		ID:          fmt.Sprintf("slo-%d", time.Now().UnixNano()),
		Name:        name,
		Service:     service,
		TargetPct:   target,
		WindowDays:  windowDays,
		ErrorBudget: (100 - target),
		UpdatedAt:   time.Now(),
		Status:      "healthy",
	}
	m.mu.Lock()
	m.slos[slo.ID] = slo
	m.budgets[slo.ID] = &ErrorBudget{
		SLOID:     slo.ID,
		Remaining: 100,
	}
	m.mu.Unlock()
	return slo
}

func (m *DRManager) UpdateSLI(sloID string, currentSLI float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	slo, ok := m.slos[sloID]
	if !ok {
		return
	}
	slo.CurrentPct = currentSLI
	budget, ok := m.budgets[sloID]
	if !ok {
		return
	}
	budget.Recompute(currentSLI, time.Duration(slo.WindowDays*24)*time.Hour)
	slo.BudgetUsed = 100 - budget.Remaining
	slo.BurnRate = budget.BurnRate

	if budget.Remaining < 10 {
		slo.Status = "exhausted"
	} else if budget.Remaining < 30 {
		slo.Status = "at_risk"
	} else {
		slo.Status = "healthy"
	}
	slo.UpdatedAt = time.Now()
}

func (m *DRManager) GetSLOs() []*SLO {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]*SLO, 0, len(m.slos))
	for _, s := range m.slos {
		result = append(result, s)
	}
	return result
}

func (m *DRManager) GetDRPlans() []*DRPlan {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]*DRPlan, 0, len(m.plans))
	for _, p := range m.plans {
		result = append(result, p)
	}
	return result
}