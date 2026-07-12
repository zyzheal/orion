package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/alert/models"
	"orion/platform-svc-go/internal/alert/repository"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Service struct {
	repo *repository.Repository
	db   *sqlx.DB
}

func NewService(repo *repository.Repository, db *sqlx.DB) *Service {
	return &Service{repo: repo, db: db}
}

// Ingest processes an incoming alert: generates fingerprint, checks suppression, deduplicates.
func (s *Service) Ingest(ctx context.Context, tenantID string, req models.IngestRequest) (*models.IngestResponse, error) {
	// Ensure tenant ID
	if req.TenantID != "" {
		tenantID = req.TenantID
	}
	severity := req.Severity
	if severity == "" {
		severity = "warning"
	}
	status := "firing"

	// Build alert
	alert := &models.Alert{
		ID:         fmt.Sprintf("alert-%d", time.Now().UnixNano()),
		TenantID:   tenantID,
		Name:       req.Name,
		Severity:   severity,
		Status:     status,
		SourceType: req.SourceType,
		SourceID:   req.SourceID,
		SourceName: req.SourceName,
		Value:      req.Value,
		Threshold:  req.Threshold,
		Metric:     req.Metric,
	}
	// Serialize labels/annotations to JSON
	alert.Labels = req.Labels
	alert.Annotations = req.Annotations

	// Generate fingerprint
	alert.Fingerprint = s.generateFingerprint(alert)

	// Check suppression via maintenance windows
	suppressed, suppressionReason, err := s.checkSuppression(ctx, tenantID, alert)
	if err != nil {
		return nil, err
	}
	if suppressed {
		alert.Status = "suppressed"
		return &models.IngestResponse{
			Status: "suppressed",
			Reason: suppressionReason,
			Alert:  *alert,
		}, nil
	}

	// Check for existing alert with same fingerprint (deduplication)
	existing, _ := s.repo.GetActiveGroups(ctx, tenantID)
	var isDuplicate bool
	var existingGroupID string
	for _, g := range existing {
		if g.Fingerprint == alert.Fingerprint {
			isDuplicate = true
			existingGroupID = g.GroupID
			break
		}
	}

	if isDuplicate {
		alert.GroupID = existingGroupID
		alert.IsDuplicate = true
		alert.Status = "firing"
	} else {
		alert.GroupID = uuid.New().String()
	}

	if err := s.repo.CreateAlert(ctx, alert); err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	statusOut := "created"
	if isDuplicate {
		statusOut = "updated"
	}
	return &models.IngestResponse{
		Status:     statusOut,
		Alert:      *alert,
		IsDuplicate: isDuplicate,
	}, nil
}

// Correlate performs root cause analysis on a batch of alerts.
func (s *Service) Correlate(ctx context.Context, tenantID string, alerts []models.Alert) (*models.CorrelationAnalysis, error) {
	if len(alerts) == 0 {
		return nil, errors.New("alerts is required")
	}

	// Update node health for each alert
	for _, a := range alerts {
		health := "healthy"
		switch a.Severity {
		case "critical":
			health = "down"
		case "warning":
			health = "degraded"
		default:
			health = "healthy"
		}
		s.repo.UpdateNodeHealth(ctx, tenantID, models.NodeHealth{
			NodeID:     a.SourceID,
			NodeName:   a.SourceName,
			Health:     health,
			AlertCount: 1,
			LastUpdate: time.Now().UTC(),
		})
	}

	// Group alerts by common fingerprint pattern
	correlatedGroups := make([]models.CorrelatedGroup, 0)
	seen := make(map[string]bool)
	for _, a := range alerts {
		fp := a.Fingerprint
		if fp == "" {
			fp = s.generateFingerprint(&a)
		}
		if seen[fp] {
			continue
		}
		seen[fp] = true
		var ids []string
		for _, other := range alerts {
			otherFp := other.Fingerprint
			if otherFp == "" {
				otherFp = s.generateFingerprint(&other)
			}
			if fp == otherFp {
				ids = append(ids, other.ID)
			}
		}
		if len(ids) > 1 {
			correlatedGroups = append(correlatedGroups, models.CorrelatedGroup{
				GroupID:      uuid.New().String(),
				AlertIDs:     ids,
				CommonRoot:   true,
				Similarity:   1.0,
			})
		}
	}

	// Root causes = alerts with highest severity
	var rootCauses []models.Alert
	for _, a := range alerts {
		if a.Severity == "critical" || a.Severity == "warning" {
			rootCauses = append(rootCauses, a)
		}
	}

	return &models.CorrelationAnalysis{
		RootCauses:      rootCauses,
		CorrelatedGroups: correlatedGroups,
		TopologyUpdate: models.TopologyUpdate{
			NodeCount: len(alerts),
		},
	}, nil
}

// GetTopology returns the current alert topology.
func (s *Service) GetTopology(ctx context.Context, tenantID string) (*models.Topology, error) {
	return s.repo.GetTopology(ctx, tenantID)
}

// SetTopology stores a new topology.
func (s *Service) SetTopology(ctx context.Context, tenantID string, req models.TopologyNodesRequest) (*models.TopologyUpdate, error) {
	// Count nodes
	var nodeCount, edgeCount int
	if n, ok := req.Nodes.([]interface{}); ok {
		nodeCount = len(n)
	}
	if e, ok := req.Edges.([]interface{}); ok {
		edgeCount = len(e)
	}
	t, err := s.repo.SetTopology(ctx, tenantID, req.Nodes, req.Edges)
	if err != nil {
		return nil, err
	}
	_ = t
	return &models.TopologyUpdate{NodeCount: nodeCount, EdgeCount: edgeCount}, nil
}

// GetDedupStats returns deduplication statistics.
func (s *Service) GetDedupStats(ctx context.Context, tenantID string) (*models.DedupStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}

// GetActiveGroups returns active alert groups.
func (s *Service) GetActiveGroups(ctx context.Context, tenantID string) ([]models.AlertGroup, error) {
	return s.repo.GetActiveGroups(ctx, tenantID)
}

// GetSuppressionStats returns suppression statistics.
func (s *Service) GetSuppressionStats(ctx context.Context, tenantID string) (*models.SuppressionStats, error) {
	// First expire old windows
	s.repo.ExpireMaintenanceWindows(ctx, tenantID)
	return s.repo.GetSuppressionStats(ctx, tenantID)
}

// GetActiveMaintenanceWindows returns active maintenance windows.
func (s *Service) GetActiveMaintenanceWindows(ctx context.Context, tenantID string) ([]models.MaintenanceWindow, error) {
	return s.repo.GetActiveMaintenanceWindows(ctx, tenantID)
}

// AddMaintenanceWindow creates a new maintenance window.
func (s *Service) AddMaintenanceWindow(ctx context.Context, tenantID string, req models.AddMaintenanceWindowRequest) (*models.MaintenanceWindow, error) {
	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		return nil, fmt.Errorf("invalid start time: %w", err)
	}
	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		return nil, fmt.Errorf("invalid end time: %w", err)
	}
	if endTime.Before(startTime) {
		return nil, errors.New("end time must be after start time")
	}
	scopeJSON, _ := json.Marshal(req.Scope)
	mw := &models.MaintenanceWindow{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		StartTime: startTime,
		EndTime:   endTime,
		Scope:     string(scopeJSON),
	}
	if err := s.repo.AddMaintenanceWindow(ctx, mw); err != nil {
		return nil, err
	}
	return mw, nil
}

// GetOpenKnownIssues returns open known issues.
func (s *Service) GetOpenKnownIssues(ctx context.Context, tenantID string) ([]models.KnownIssue, error) {
	return s.repo.GetOpenKnownIssues(ctx, tenantID)
}

// AddKnownIssue creates a new known issue.
func (s *Service) AddKnownIssue(ctx context.Context, tenantID string, req models.AddKnownIssueRequest) (*models.KnownIssue, error) {
	if req.Title == "" {
		return nil, errors.New("title is required")
	}
	labelSelectors, _ := json.Marshal(req.LabelSelectors)
	silenceDuration := req.SilenceDuration
	if silenceDuration <= 0 {
		silenceDuration = 3600000 // 1 hour default
	}
	ki := &models.KnownIssue{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		Title:              req.Title,
		Description:        req.Description,
		FingerprintPattern: req.FingerprintPattern,
		LabelSelectors:     string(labelSelectors),
		SilenceDuration:    silenceDuration,
		Status:             "open",
	}
	if err := s.repo.AddKnownIssue(ctx, ki); err != nil {
		return nil, err
	}
	return ki, nil
}

// GetActiveAlerts returns all active alerts.
func (s *Service) GetActiveAlerts(ctx context.Context, tenantID string) ([]models.Alert, error) {
	groups, err := s.GetActiveGroups(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var allAlerts []models.Alert
	for _, g := range groups {
		allAlerts = append(allAlerts, g.Alerts...)
	}
	return allAlerts, nil
}

// ListAlerts returns a filtered list of alerts.
func (s *Service) ListAlerts(ctx context.Context, tenantID string, severity, status string, limit int) (*models.AlertListResponse, error) {
	if limit <= 0 {
		limit = 100
	}
	alerts, total, err := s.repo.ListAlerts(ctx, tenantID, severity, status, limit)
	if err != nil {
		return nil, err
	}
	return &models.AlertListResponse{
		Alerts: alerts,
		Total:  total,
	}, nil
}

// GetAlert returns a single alert by ID.
func (s *Service) GetAlert(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	alert, err := s.repo.GetAlertByID(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("alert not found")
	}
	return alert, nil
}

// checkSuppression checks if an alert should be suppressed.
func (s *Service) checkSuppression(ctx context.Context, tenantID string, alert *models.Alert) (bool, string, error) {
	// Check maintenance windows
	windows, err := s.repo.GetActiveMaintenanceWindows(ctx, tenantID)
	if err != nil {
		return false, "", err
	}
	for _, w := range windows {
		scope := w.Scope.(string)
		// Check if alert source matches window scope
		if strings.Contains(scope, alert.SourceID) || strings.Contains(scope, alert.SourceName) {
			return true, fmt.Sprintf("suppressed by maintenance window: %s", w.Name), nil
		}
	}

	// Check known issues
	if alert.Fingerprint != "" {
		issue, err := s.repo.GetKnownIssueByPattern(ctx, tenantID, alert.Fingerprint)
		if err == nil {
			return true, fmt.Sprintf("suppressed by known issue: %s", issue.Title), nil
		}
	}
	return false, "", nil
}

// generateFingerprint creates a hash fingerprint from alert attributes.
func (s *Service) generateFingerprint(a *models.Alert) string {
	data := strings.Join([]string{
		a.Name, a.Severity, a.SourceType, a.SourceID,
	}, "|")
	hash := sha256.Sum256([]byte(data))
	return "fp-" + hex.EncodeToString(hash[:16])
}
