package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"orion/platform-svc-go/internal/pipeline-budget/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AppendHistory(ctx context.Context, h *models.BudgetHistoryRecord) error
	CountHistory(ctx context.Context, tenantID, pipelineID string) (int, error)
	GetByPipelineID(ctx context.Context, tenantID, pipelineID string) (*models.BudgetConfig, error)
	ListHistory(ctx context.Context, tenantID, pipelineID string, offset, limit int) ([]models.BudgetHistoryRecord, error)
	Upsert(ctx context.Context, b *models.BudgetConfig) error
}

// Repository defines the persistence contract for pipeline budgets.
type Repository interface {
	GetByPipelineID(ctx context.Context, tenantID, pipelineID string) (*models.BudgetConfig, error)
	Upsert(ctx context.Context, b *models.BudgetConfig) error
	AppendHistory(ctx context.Context, h *models.BudgetHistoryRecord) error
	ListHistory(ctx context.Context, tenantID, pipelineID string, offset, limit int) ([]models.BudgetHistoryRecord, error)
	CountHistory(ctx context.Context, tenantID, pipelineID string) (int, error)
}

// Service coordinates business logic for pipeline budget management.
type Service struct {
	repo Repository
}

// NewService creates a new Service instance.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ErrNotFound is returned when a budget config or alert cannot be located.
var ErrNotFound = errors.New("pipeline budget not found")

// ---------------------------------------------------------------------------
// Budget CRUD
// ---------------------------------------------------------------------------

// GetBudget retrieves the budget config for a pipeline (tenant-scoped).
func (s *Service) GetBudget(ctx context.Context, tenantID, pipelineID string) (*models.BudgetConfig, error) {
	return s.repo.GetByPipelineID(ctx, tenantID, pipelineID)
}

// UpsertBudget creates or updates the budget config for a pipeline.
// On update, existing alert rules are preserved and usage counts are
// retained for matching resource types.
func (s *Service) UpsertBudget(ctx context.Context, tenantID, pipelineID string, req *models.UpsertBudgetRequest) (*models.BudgetConfig, error) {
	now := unixSec()

	// Try to read the existing budget to preserve usage/alerts.
	existing, _ := s.repo.GetByPipelineID(ctx, tenantID, pipelineID)

	// Build the period from the budget type.
	period := calculatePeriod(req.Type)
	periodJSON, err := marshal(period)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal period: %w", err)
	}

	// Build the new limits, merging usage from existing limits.
	var existingLimits []models.BudgetLimit
	if existing != nil {
		_ = json.Unmarshal([]byte(existing.Limits), &existingLimits)
	}
	newLimits := make([]models.BudgetLimit, len(req.Limits))
	for i, rl := range req.Limits {
		used := 0.0
		for _, el := range existingLimits {
			if el.ResourceType == rl.ResourceType {
				used = el.Used
				break
			}
		}
		newLimits[i] = models.BudgetLimit{
			ResourceType: rl.ResourceType,
			Limit:        rl.Limit,
			Unit:         rl.Unit,
			Used:         used,
		}
	}
	limitsJSON, err := marshal(newLimits)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal limits: %w", err)
	}

	// Cost limits (nullable).
	var costLimitsJSON *string
	if req.CostLimits != nil {
		cj, err := marshal(req.CostLimits)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal costLimits: %w", err)
		}
		costLimitsJSON = &cj
	}

	// Alerts — preserve existing if updating, empty if creating.
	var alertsJSON string
	if existing != nil {
		alertsJSON = existing.Alerts
	} else {
		alertsJSON = "[]"
	}

	b := &models.BudgetConfig{
		ID:         uuid.New().String(),
		PipelineID: pipelineID,
		TenantID:   tenantID,
		Type:       req.Type,
		Period:     periodJSON,
		Limits:     limitsJSON,
		CostLimits: costLimitsJSON,
		Alerts:     alertsJSON,
		CreatedAt:  &now,
		UpdatedAt:  &now,
	}
	if existing != nil {
		b.CreatedAt = existing.CreatedAt
	}

	if err := s.repo.Upsert(ctx, b); err != nil {
		return nil, fmt.Errorf("failed to upsert budget: %w", err)
	}

	// Append a history entry.
	s.appendHistory(ctx, tenantID, pipelineID, models.HistoryActionConfigUpdated,
		map[string]any{"type": string(req.Type), "limitsCount": len(req.Limits)}, "system")

	return b, nil
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

// GetBudgetUsage computes the current usage snapshot for a pipeline.
// Usage (used values) come from the stored limits; cost is simulated by
// reading the cost limit and applying the current period progress.
func (s *Service) GetBudgetUsage(ctx context.Context, tenantID, pipelineID string) (*models.BudgetUsage, error) {
	budget, err := s.GetBudget(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, ErrNotFound
	}

	var period models.BudgetPeriod
	if err := json.Unmarshal([]byte(budget.Period), &period); err != nil {
		return nil, fmt.Errorf("invalid period JSON: %w", err)
	}
	var limits []models.BudgetLimit
	if err := json.Unmarshal([]byte(budget.Limits), &limits); err != nil {
		return nil, fmt.Errorf("invalid limits JSON: %w", err)
	}

	resources := make([]models.BudgetUsageResource, len(limits))
	for i, l := range limits {
		pct := 0
		if l.Limit > 0 {
			pct = int(math.Round((l.Used / l.Limit) * 100))
		}
		resources[i] = models.BudgetUsageResource{
			Type:       l.ResourceType,
			Used:       l.Used,
			Limit:      l.Limit,
			Unit:       l.Unit,
			Percentage: pct,
		}
	}

	cost := models.BudgetUsageCost{
		Limit:    0,
		Currency: "USD",
	}
	if budget.CostLimits != nil {
		var cl models.BudgetCostLimit
		if err := json.Unmarshal([]byte(*budget.CostLimits), &cl); err == nil {
			cost.Limit = cl.Total
			cost.Currency = cl.Currency
		}
	}

	// Estimate cost usage as proportional to resource usage.
	if cost.Limit > 0 {
		used := math.Round(math.Min(1.0, float64(len(resources))/float64(6))) // heuristic
		cost.Used = math.Round(used*cost.Limit*100) / 100
		cost.Percentage = int(math.Round(used * 100))
	}

	// Forecast.
	periodDays, elapsedDays, daysRemaining := periodDays(period)

	forecast := &models.BudgetForecast{
		DaysRemaining: max(daysRemaining, 0),
	}
	if elapsedDays > 0 {
		scale := float64(periodDays) / float64(elapsedDays)
		forecast.ProjectedUsage = math.Round(cost.Used*scale*100) / 100
		forecast.ProjectedCost = math.Round(cost.Used*scale*100) / 100
	}

	return &models.BudgetUsage{
		PipelineID: pipelineID,
		Period:     period,
		Resources:  resources,
		Cost:       cost,
		Forecast:   forecast,
	}, nil
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

// GetAlerts returns the alert rules for a pipeline's budget.
func (s *Service) GetAlerts(ctx context.Context, tenantID, pipelineID string) ([]models.BudgetAlert, error) {
	budget, err := s.GetBudget(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, ErrNotFound
	}
	var alerts []models.BudgetAlert
	if err := json.Unmarshal([]byte(budget.Alerts), &alerts); err != nil {
		return nil, fmt.Errorf("invalid alerts JSON: %w", err)
	}
	if alerts == nil {
		alerts = []models.BudgetAlert{}
	}
	return alerts, nil
}

// CreateAlert adds a new alert rule to a pipeline's budget.
func (s *Service) CreateAlert(ctx context.Context, tenantID, pipelineID string, req *models.CreateAlertRequest) (*models.BudgetAlert, error) {
	budget, err := s.GetBudget(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, ErrNotFound
	}
	now := unixSec()

	alert := models.BudgetAlert{
		ID:        "alert_" + uuid.New().String(),
		Name:      req.Name,
		Threshold: req.Threshold,
		Severity:  req.Severity,
		Channels:  stringJSONArray(req.Channels),
		Enabled:   true,
		CreatedAt: &now,
		UpdatedAt: &now,
	}
	if req.Enabled != nil {
		alert.Enabled = *req.Enabled
	}

	var alerts []models.BudgetAlert
	if err := json.Unmarshal([]byte(budget.Alerts), &alerts); err != nil {
		alerts = []models.BudgetAlert{}
	}
	alerts = append(alerts, alert)
	jsonB, err := json.Marshal(alerts)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal alerts: %w", err)
	}
	budget.Alerts = string(jsonB)
	budget.UpdatedAt = &now

	if err := s.repo.Upsert(ctx, budget); err != nil {
		return nil, fmt.Errorf("failed to persist alerts: %w", err)
	}

	s.appendHistory(ctx, tenantID, pipelineID, models.HistoryActionAlertTriggered,
		map[string]any{"alertId": alert.ID, "threshold": alert.Threshold}, "system")

	return &alert, nil
}

// UpdateAlert patches a single alert rule in place.
func (s *Service) UpdateAlert(ctx context.Context, tenantID, pipelineID, alertID string, req *models.UpdateAlertRequest) (*models.BudgetAlert, error) {
	budget, err := s.GetBudget(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, ErrNotFound
	}
	var alerts []models.BudgetAlert
	if err := json.Unmarshal([]byte(budget.Alerts), &alerts); err != nil {
		return nil, fmt.Errorf("invalid alerts JSON: %w", err)
	}
	now := unixSec()
	idx := -1
	for i, a := range alerts {
		if a.ID == alertID {
			idx = i
			break
		}
	}
	if idx == -1 {
		return nil, fmt.Errorf("alert %s not found", alertID)
	}
	a := &alerts[idx]
	if req.Name != nil {
		a.Name = *req.Name
	}
	if req.Threshold != nil {
		a.Threshold = *req.Threshold
	}
	if req.Severity != nil {
		a.Severity = *req.Severity
	}
	if req.Channels != nil {
		a.Channels = stringJSONArray(*req.Channels)
	}
	if req.Enabled != nil {
		a.Enabled = *req.Enabled
	}
	a.UpdatedAt = &now

	jsonB, err := json.Marshal(alerts)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal alerts: %w", err)
	}
	budget.Alerts = string(jsonB)
	budget.UpdatedAt = &now

	if err := s.repo.Upsert(ctx, budget); err != nil {
		return nil, fmt.Errorf("failed to persist updated alert: %w", err)
	}
	return a, nil
}

// DeleteAlert removes an alert rule from a pipeline's budget.
func (s *Service) DeleteAlert(ctx context.Context, tenantID, pipelineID, alertID string) error {
	budget, err := s.GetBudget(ctx, tenantID, pipelineID)
	if err != nil {
		return ErrNotFound
	}
	var alerts []models.BudgetAlert
	if err := json.Unmarshal([]byte(budget.Alerts), &alerts); err != nil {
		return fmt.Errorf("invalid alerts JSON: %w", err)
	}
	idx := -1
	for i, a := range alerts {
		if a.ID == alertID {
			idx = i
			break
		}
	}
	if idx == -1 {
		return fmt.Errorf("alert %s not found", alertID)
	}
	now := unixSec()
	alerts = append(alerts[:idx], alerts[idx+1:]...)
	jsonB, err := json.Marshal(alerts)
	if err != nil {
		return fmt.Errorf("failed to marshal alerts: %w", err)
	}
	budget.Alerts = string(jsonB)
	budget.UpdatedAt = &now

	return s.repo.Upsert(ctx, budget)
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

// AppendBudgetHistory wraps repository.AppendHistory.
func (s *Service) AppendBudgetHistory(ctx context.Context, h *models.BudgetHistoryRecord) error {
	if h.ID == "" {
		h.ID = uuid.New().String()
	}
	h.Timestamp = func(i int64) *int64 { return &i }(unixSec())
	return s.repo.AppendHistory(ctx, h)
}

// GetHistoryPage returns paginated history with total count.
type HistoryPage struct {
	Items []models.BudgetHistoryRecord
	Total int
}

// GetHistoryPage is the recommended way to retrieve paginated history.
func (s *Service) GetHistoryPage(ctx context.Context, tenantID, pipelineID string, q *models.ListQuery) (*HistoryPage, error) {
	lq := models.DefaultListQuery()
	if q != nil {
		if q.Offset != nil {
			lq.Offset = q.Offset
		}
		if q.Limit != nil {
			lq.Limit = q.Limit
		}
	}
	items, err := s.repo.ListHistory(ctx, tenantID, pipelineID, lq.GetOffset(), lq.GetLimit())
	if err != nil {
		return nil, err
	}
	total, err := s.repo.CountHistory(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, err
	}
	return &HistoryPage{Items: items, Total: total}, nil
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

func (s *Service) appendHistory(ctx context.Context, tenantID, pipelineID string, action models.HistoryAction, details map[string]any, actor string) {
	detailsJSON := "{}"
	b, err := json.Marshal(details)
	if err == nil {
		detailsJSON = string(b)
	}
	s.repo.AppendHistory(ctx, &models.BudgetHistoryRecord{
		ID:         uuid.New().String(),
		PipelineID: pipelineID,
		TenantID:   tenantID,
		Timestamp:  func(i int64) *int64 { return &i }(unixSec()),
		Action:     action,
		Details:    detailsJSON,
		Actor:      actor,
	})
}

func unixSec() int64 {
	return time.Now().Unix()
}

func marshal(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	return string(b), err
}

func stringJSONArray(s []string) string {
	if len(s) == 0 {
		return "[]"
	}
	b, err := json.Marshal(s)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func calculatePeriod(bt models.BudgetType) models.BudgetPeriod {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	var end time.Time
	switch bt {
	case models.BudgetTypeQuarterly:
		quarterEnd := (int(now.Month())-1)/3*3 + 3
		end = time.Date(now.Year(), time.Month(quarterEnd)+1, 1, 0, 0, 0, 0, time.UTC).AddDate(0, 0, -1)
	case models.BudgetTypeYearly:
		end = time.Date(now.Year(), 12, 31, 0, 0, 0, 0, time.UTC)
	case models.BudgetTypePerRun:
		end = now.AddDate(0, 0, 1)
	default: // monthly
		end = start.AddDate(0, 1, 0).AddDate(0, 0, -1)
	}
	return models.BudgetPeriod{
		Start: start.Format(time.RFC3339),
		End:   end.Format(time.RFC3339),
	}
}

func periodDays(p models.BudgetPeriod) (periodDays, elapsedDays, daysRemaining int) {
	start, err := time.Parse(time.RFC3339, p.Start)
	if err != nil {
		return 30, 0, 30
	}
	end, err := time.Parse(time.RFC3339, p.End)
	if err != nil {
		return 30, 0, 30
	}
	periodDays = int(math.Ceil(end.Sub(start).Hours() / 24))
	elapsedDays = int(math.Ceil(time.Now().Sub(start).Hours() / 24))
	daysRemaining = periodDays - elapsedDays
	return
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// SortAlertsByThreshold sorts alert rules by ascending threshold.
func SortAlertsByThreshold(alerts []models.BudgetAlert) {
	sort.Slice(alerts, func(i, j int) bool {
		return alerts[i].Threshold < alerts[j].Threshold
	})
}
