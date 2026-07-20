package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/self-healing/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateIncident(ctx context.Context, tenantID string, req models.CreateIncidentRequest) (*models.HealingIncident, error)
	CreateStrategy(ctx context.Context, s *models.HealingStrategy) error
	GetApprovalRequest(ctx context.Context, id string) (*models.ApprovalRequest, error)
	GetIncident(ctx context.Context, tenantID, id string) (*models.HealingIncident, error)
	GetIncidentByApprovalID(ctx context.Context, tenantID, approvalID string) (*models.HealingIncident, error)
	GetStrategy(ctx context.Context, id string) (*models.HealingStrategy, error)
	ListApprovalRequests(ctx context.Context, status string) ([]models.ApprovalRequest, error)
	ListForEffectiveness(ctx context.Context, tenantID string, q models.EffectivenessQuery) ([]models.HealingIncident, error)
	ListIncidents(ctx context.Context, tenantID string, q models.HistoryQuery) ([]models.HealingIncident, int, error)
	ListStrategies(ctx context.Context) ([]models.HealingStrategy, error)
	MarkExpiredApprovals(ctx context.Context) (int64, error)
	ToggleStrategy(ctx context.Context, id string, enabled bool) error
	UpdateApprovalRequest(ctx context.Context, id string, updates map[string]interface{}) (*models.ApprovalRequest, error)
	UpdateIncident(ctx context.Context, id string, updates map[string]interface{}) (*models.HealingIncident, error)
}

var (
	ErrInvalidType     = errors.New("invalid incident type")
	ErrInvalidSeverity = errors.New("invalid severity")
	ErrApprovalExpired = errors.New("approval request has expired")
)

var validTypes = map[string]bool{
	"high_cpu":           true,
	"high_memory":        true,
	"high_error_rate":    true,
	"high_latency":       true,
	"pod_crash":          true,
	"node_failure":       true,
	"service_down":       true,
	"deployment_failure": true,
	"disk_full":          true,
	"network_timeout":    true,
	"custom":             true,
}

var validSeverities = map[string]bool{
	"critical": true,
	"warning":  true,
	"info":     true,
}

// metricToType maps alert metric names to incident types.
var metricToType = map[string]models.IncidentType{
	"cpu_usage":          models.IncidentTypeHighCPU,
	"memory_usage":       models.IncidentTypeHighMemory,
	"error_rate":         models.IncidentTypeHighErrorRate,
	"latency":            models.IncidentTypeHighLatency,
	"pod_crash":          models.IncidentTypePodCrash,
	"node_failure":       models.IncidentTypeNodeFailure,
	"service_down":       models.IncidentTypeServiceDown,
	"deployment_failure": models.IncidentTypeDeployFailure,
	"disk_full":          models.IncidentTypeDiskFull,
	"disk_usage":         models.IncidentTypeDiskFull,
	"network_timeout":    models.IncidentTypeNetworkTimeout,
}

// Service provides the business logic layer.
type Service struct {
	repo RepositoryInterface
	opts Options
}

// Options holds optional service configuration.
type Options struct {
	ApprovalExpirationMin int64 // minutes; default 5
}

// NewService constructs a new Service.
func NewService(repo RepositoryInterface, opts Options) *Service {
	if opts.ApprovalExpirationMin <= 0 {
		opts.ApprovalExpirationMin = 5
	}
	return &Service{repo: repo, opts: opts}
}

// CreateIncident validates and creates an incident from a manual trigger.
func (s *Service) CreateIncident(ctx context.Context, tenantID string, req models.CreateIncidentRequest) (*models.HealingIncident, error) {
	if !validTypes[string(req.Type)] {
		return nil, ErrInvalidType
	}
	if !validSeverities[string(req.Severity)] {
		return nil, ErrInvalidSeverity
	}
	return s.repo.CreateIncident(ctx, tenantID, req)
}

// GetIncident retrieves an incident by ID.
func (s *Service) GetIncident(ctx context.Context, tenantID, id string) (*models.HealingIncident, error) {
	return s.repo.GetIncident(ctx, tenantID, id)
}

// ListHistory returns paginated incident history.
func (s *Service) ListHistory(ctx context.Context, tenantID string, q models.HistoryQuery) ([]models.HealingIncident, int, error) {
	_, _ = s.repo.MarkExpiredApprovals(ctx)
	return s.repo.ListIncidents(ctx, tenantID, q)
}

// incrementStat increments a stat in a map using copy-back pattern.
func incrementStat(m map[string]models.Stat, key string) {
	v := m[key]
	v.Total++
	m[key] = v
}

// incrementStatSuccess increments a stat's success count using copy-back.
func incrementStatSuccess(m map[string]models.Stat, key string) {
	v := m[key]
	v.Success++
	m[key] = v
}

// setStatRate sets the rate field of a stat entry.
func setStatRate(m map[string]models.Stat, key string, rate float64) {
	v := m[key]
	v.Rate = rate
	m[key] = v
}

// GetEffectiveness computes healing effectiveness metrics.
func (s *Service) GetEffectiveness(ctx context.Context, tenantID string, q models.EffectivenessQuery) (*models.HealingEffectiveness, error) {
	incidents, err := s.repo.ListForEffectiveness(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}

	eff := &models.HealingEffectiveness{
		ByIncidentType: make(map[string]models.Stat),
		ByStrategy:     make(map[string]models.Stat),
		ByEnvironment:  make(map[string]models.Stat),
		ByActionType:   make(map[string]models.Stat),
	}

	for _, i := range incidents {
		eff.TotalIncidents++
		healed := i.Status == models.IncidentStatusHealed
		if healed {
			eff.HealedIncidents++
		} else if i.Status == models.IncidentStatusFailed {
			eff.FailedIncidents++
		} else if i.Status == models.IncidentStatusEscalated {
			eff.EscalatedIncidents++
		}

		incrementStat(eff.ByIncidentType, string(i.Type))
		if healed {
			incrementStatSuccess(eff.ByIncidentType, string(i.Type))
		}

		sKey := i.StrategyName
		if sKey == "" {
			sKey = "unknown"
		}
		incrementStat(eff.ByStrategy, sKey)
		if healed {
			incrementStatSuccess(eff.ByStrategy, sKey)
		}

		incrementStat(eff.ByEnvironment, i.Environment)
		if healed {
			incrementStatSuccess(eff.ByEnvironment, i.Environment)
		}

		var actions []models.HealingAction
		if i.Actions != "" {
			json.Unmarshal([]byte(i.Actions), &actions)
		}
		for _, a := range actions {
			incrementStat(eff.ByActionType, string(a.Type))
		}
	}

	// Compute rates
	for k, st := range eff.ByIncidentType {
		if st.Total > 0 {
			setStatRate(eff.ByIncidentType, k, roundFloat(float64(st.Success)/float64(st.Total)*100, 1))
		}
	}
	for k, st := range eff.ByStrategy {
		if st.Total > 0 {
			setStatRate(eff.ByStrategy, k, roundFloat(float64(st.Success)/float64(st.Total)*100, 1))
		}
	}
	for k, st := range eff.ByEnvironment {
		if st.Total > 0 {
			setStatRate(eff.ByEnvironment, k, roundFloat(float64(st.Success)/float64(st.Total)*100, 1))
		}
	}
	for k, st := range eff.ByActionType {
		if st.Total > 0 {
			setStatRate(eff.ByActionType, k, roundFloat(float64(st.Success)/float64(st.Total)*100, 1))
		}
	}

	eff.SuccessRate = roundFloat(float64(eff.HealedIncidents)/float64(eff.TotalIncidents)*100, 1)

	return eff, nil
}

// ListStrategies returns all healing strategies.
func (s *Service) ListStrategies(ctx context.Context) ([]models.HealingStrategy, error) {
	return s.repo.ListStrategies(ctx)
}

// GetStrategy retrieves a strategy by ID.
func (s *Service) GetStrategy(ctx context.Context, id string) (*models.HealingStrategy, error) {
	return s.repo.GetStrategy(ctx, id)
}

// RegisterStrategy registers a custom healing strategy.
func (s *Service) RegisterStrategy(ctx context.Context, req models.RegisterStrategyRequest) (*models.HealingStrategy, error) {
	actionsJSON := "{}"
	if len(req.Actions) > 0 {
		b, err := json.Marshal(req.Actions)
		if err != nil {
			return nil, err
		}
		actionsJSON = string(b)
	}
	conditionsJSON := "{}"
	if req.Conditions != "" {
		conditionsJSON = req.Conditions
	}
	envsJSON := "[]"
	if req.Environments != "" {
		envsJSON = req.Environments
	}

	confidence := req.Confidence
	if confidence == 0 {
		confidence = 50
	}

	strategy := &models.HealingStrategy{
		ID:              req.ID,
		Name:            req.Name,
		TriggerType:     req.TriggerType,
		Actions:         actionsJSON,
		Conditions:      conditionsJSON,
		Confidence:      confidence,
		Enabled:         req.Enabled,
		Description:     req.Description,
		Environments:    envsJSON,
		MaxRetries:      req.MaxRetries,
		RetryCooldownMs: 0,
	}
	if !strategy.Enabled {
		strategy.Enabled = true
	}

	err := s.repo.CreateStrategy(ctx, strategy)
	return strategy, err
}

// ToggleStrategy enables or disables a strategy.
func (s *Service) ToggleStrategy(ctx context.Context, id string, enabled bool) error {
	_, err := s.repo.GetStrategy(ctx, id)
	if err != nil {
		return err
	}
	return s.repo.ToggleStrategy(ctx, id, enabled)
}

// ListApprovals returns approval requests, optionally filtered by status.
func (s *Service) ListApprovals(ctx context.Context, status string) ([]models.ApprovalRequest, error) {
	_, _ = s.repo.MarkExpiredApprovals(ctx)
	return s.repo.ListApprovalRequests(ctx, status)
}

// GetApproval retrieves an approval request by ID.
func (s *Service) GetApproval(ctx context.Context, id string) (*models.ApprovalRequest, error) {
	_, _ = s.repo.MarkExpiredApprovals(ctx)
	return s.repo.GetApprovalRequest(ctx, id)
}

// RespondApproval processes an approval response.
func (s *Service) RespondApproval(ctx context.Context, tenantID, approvalID string, req models.RespondApprovalRequest) (*models.HealingIncident, error) {
	_, _ = s.repo.MarkExpiredApprovals(ctx)

	approval, err := s.repo.GetApprovalRequest(ctx, approvalID)
	if err != nil {
		return nil, err
	}
	if approval.Status != "pending" {
		return nil, fmt.Errorf("approval request is already %s", approval.Status)
	}
	if approval.ExpiresAt != nil && time.Now().UTC().After(*approval.ExpiresAt) {
		_, _ = s.repo.UpdateApprovalRequest(ctx, approvalID, map[string]interface{}{"status": "expired"})
		return nil, ErrApprovalExpired
	}

	now := time.Now().UTC()
	status := "approved"
	if !req.Approved {
		status = "rejected"
	}

	updates := map[string]interface{}{
		"status":          status,
		"approved_by":     req.RespondedBy,
		"approval_reason": req.Reason,
		"responded_at":    &now,
	}
	_, err = s.repo.UpdateApprovalRequest(ctx, approvalID, updates)
	if err != nil {
		return nil, err
	}

	incident, err := s.repo.GetIncidentByApprovalID(ctx, tenantID, approvalID)
	if err != nil {
		return nil, err
	}

	var incidentStatus models.IncidentStatus
	var approvalStatus string
	var errMsg string
	var completedAt *time.Time

	if req.Approved {
		incidentStatus = models.IncidentStatusHealing
		approvalStatus = "approved"
	} else {
		incidentStatus = models.IncidentStatusFailed
		approvalStatus = "rejected"
		errMsg = fmt.Sprintf("Approval rejected by %s: %s", req.RespondedBy, req.Reason)
		completedAt = &now
	}

	return s.repo.UpdateIncident(ctx, incident.ID, map[string]interface{}{
		"status":          string(incidentStatus),
		"approval_status": approvalStatus,
		"error":           errMsg,
		"completed_at":    completedAt,
	})
}

// MapMetricToIncidentType maps a monitoring metric name to an incident type.
func MapMetricToIncidentType(metric string) models.IncidentType {
	if t, ok := metricToType[metric]; ok {
		return t
	}
	for key, t := range metricToType {
		if strings.Contains(metric, key) {
			return t
		}
	}
	return models.IncidentTypeCustom
}

// MapSeverityToRiskLevel maps severity to risk level.
func MapSeverityToRiskLevel(severity models.IncidentSeverity) models.RiskLevel {
	switch severity {
	case models.IncidentSeverityCritical:
		return models.RiskLevelCritical
	case models.IncidentSeverityWarning:
		return models.RiskLevelHigh
	case models.IncidentSeverityInfo:
		return models.RiskLevelLow
	default:
		return models.RiskLevelMedium
	}
}

// AssessRiskLevel assesses risk based on environment.
func AssessRiskLevel(environment string) models.RiskLevel {
	e := strings.ToLower(environment)
	if e == "production" || e == "prod" {
		return models.RiskLevelHigh
	}
	if e == "staging" || e == "pre-prod" {
		return models.RiskLevelMedium
	}
	return models.RiskLevelLow
}

// RequiresManualApproval determines if a strategy requires manual approval.
func RequiresManualApproval(strategy *models.HealingStrategy, environment string, severity models.IncidentSeverity) bool {
	if strings.ToLower(environment) == "production" || strings.ToLower(environment) == "prod" {
		return true
	}
	if severity == models.IncidentSeverityCritical {
		return true
	}
	if strategy.Confidence < 70 {
		return true
	}
	return false
}

// NewIncidentID generates a new UUID.
func NewIncidentID() string {
	return uuid.New().String()
}

// roundFloat rounds a float64 to the given number of decimals.
func roundFloat(v float64, decimals int) float64 {
	d := 1.0
	for i := 0; i < decimals; i++ {
		d *= 10
	}
	return float64(int(v*d+0.5)) / d
}

// medianOf returns the median of a sorted slice of int64 values.
func medianOf(durations []int64) float64 {
	if len(durations) == 0 {
		return 0
	}
	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})
	mid := len(durations) / 2
	if len(durations)%2 == 0 {
		return float64(durations[mid-1]+durations[mid]) / 2
	}
	return float64(durations[mid])
}
