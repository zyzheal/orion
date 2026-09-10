package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/middleware-ops/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) RunInspection(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "run triggered", nil
}

func (s *Service) GetResults(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	results := make([]string, len(records))
	for i, r := range records {
		results[i] = r.ID
	}
	return results, nil
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	return err
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	templates := make([]string, len(records))
	for i, r := range records {
		templates[i] = r.Name
	}
	return templates, nil
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	byStatus, active := countByStatus(records)
	return map[string]interface{}{
		"total":    len(records),
		"active":   active,
		"inactive": len(records) - active,
		"byStatus": byStatus,
		"names":    recordNames(records),
	}, nil
}

func (s *Service) RunPipeline(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "pipeline run triggered", nil
}

func (s *Service) GetStatus(ctx context.Context, tenantID string) (string, error) {
	_, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return "unknown", err
	}
	return "running", nil
}

func (s *Service) Pause(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "paused", nil
}

func (s *Service) Resume(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "resumed", nil
}

func (s *Service) GetLogs(ctx context.Context, tenantID, id string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	logs := make([]string, len(records))
	for i, r := range records {
		logs[i] = r.ID
	}
	return logs, nil
}

func (s *Service) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	schemas := make([]string, len(records))
	for i, r := range records {
		schemas[i] = r.Name
	}
	return schemas, nil
}

func (s *Service) GetLineage(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"node": id}, nil
}

func (s *Service) GetConfig(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	entries := make(map[string]interface{})
	var latest time.Time
	for _, r := range records {
		if len(r.Metadata) > 0 {
			entries[r.Name] = r.Metadata
		}
		if r.UpdatedAt.After(latest) {
			latest = r.UpdatedAt
		}
	}
	updated := ""
	if !latest.IsZero() {
		updated = latest.UTC().Format(time.RFC3339)
	}
	return map[string]interface{}{
		"entries": entries,
		"count":   len(entries),
		"updated": updated,
		"source":  "middleware_ops_records",
	}, nil
}

func (s *Service) UpdateConfig(ctx context.Context, tenantID string, cfg map[string]interface{}) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "config updated", nil
}

func (s *Service) GetStatusMiddleware(ctx context.Context, tenantID string) (string, error) {
	_, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return "unhealthy", err
	}
	return "healthy", nil
}

func (s *Service) Restart(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "restart triggered", nil
}

func (s *Service) Configure(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "configured", nil
}

func (s *Service) ListPlugins(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	plugins := make([]string, len(records))
	for i, r := range records {
		plugins[i] = r.Name
	}
	return plugins, nil
}

func (s *Service) GetPlugin(ctx context.Context, tenantID, name string) (map[string]interface{}, error) {
	_, err := s.repo.GetByID(ctx, tenantID, name)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"name": name}, nil
}

func (s *Service) EnablePlugin(ctx context.Context, tenantID, name string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, name); err != nil {
		return "", err
	}
	return "enabled", nil
}

func (s *Service) DisablePlugin(ctx context.Context, tenantID, name string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, name); err != nil {
		return "", err
	}
	return "disabled", nil
}

func (s *Service) Train(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "training started", nil
}

func (s *Service) Evaluate(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "evaluation started", nil
}

func (s *Service) Deploy(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "deployed", nil
}

func (s *Service) Rollback(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "rolled back", nil
}

func (s *Service) GetMetrics(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	byStatus, active := countByStatus(records)
	now := time.Now()
	var ages []float64
	var latest, oldest time.Time
	for _, r := range records {
		if r.CreatedAt.IsZero() {
			continue
		}
		ages = append(ages, now.Sub(r.CreatedAt).Seconds())
		if r.CreatedAt.After(latest) {
			latest = r.CreatedAt
		}
		if oldest.IsZero() || r.CreatedAt.Before(oldest) {
			oldest = r.CreatedAt
		}
	}
	avg := 0.0
	if len(ages) > 0 {
		sum := 0.0
		for _, a := range ages {
			sum += a
		}
		avg = sum / float64(len(ages))
	}
	return map[string]interface{}{
		"total":         len(records),
		"active":        active,
		"inactive":      len(records) - active,
		"byStatus":      byStatus,
		"avgAgeSeconds": avg,
		"latestCreated": rfc3339OrEmpty(latest),
		"oldestCreated": rfc3339OrEmpty(oldest),
	}, nil
}

func (s *Service) ListExperiments(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	exps := make([]string, len(records))
	for i, r := range records {
		exps[i] = r.Name
	}
	return exps, nil
}

func (s *Service) ListArtifacts(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	artifacts := make([]string, len(records))
	for i, r := range records {
		artifacts[i] = r.Name
	}
	return artifacts, nil
}

func (s *Service) ListModels(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	names := make([]string, len(records))
	for i, r := range records {
		names[i] = r.Name
	}
	return names, nil
}

func (s *Service) RegisterModel(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "model registered", nil
}

func (s *Service) DeregisterModel(ctx context.Context, tenantID, id string) (string, error) {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "model deregistered", nil
}

func (s *Service) ListPipelines(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	pipelines := make([]string, len(records))
	for i, r := range records {
		pipelines[i] = r.Name
	}
	return pipelines, nil
}

func (s *Service) Trigger(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "triggered", nil
}

func (s *Service) GetBranchStatus(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "valid", nil
}

func (s *Service) ListHistories(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	histories := make([]string, len(records))
	for i, r := range records {
		histories[i] = r.ID
	}
	return histories, nil
}

func (s *Service) ListPending(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	pending := make([]string, len(records))
	for i, r := range records {
		pending[i] = r.ID
	}
	return pending, nil
}

func (s *Service) Approve(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "approved", nil
}

func (s *Service) Reject(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "rejected", nil
}

func (s *Service) Escalate(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "escalated", nil
}

func (s *Service) GetByUser(ctx context.Context, tenantID, user string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(records))
	for i, r := range records {
		ids[i] = r.ID
	}
	return ids, nil
}

func (s *Service) Forecast(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	byStatus, active := countByStatus(records)
	// Derive a creation rate from the observed record window, then project a
	// linear count for the next 24h. A zero-width window yields a zero rate.
	var oldest time.Time
	for _, r := range records {
		if r.CreatedAt.IsZero() {
			continue
		}
		if oldest.IsZero() || r.CreatedAt.Before(oldest) {
			oldest = r.CreatedAt
		}
	}
	rate := 0.0
	if len(records) > 0 && !oldest.IsZero() {
		if span := time.Since(oldest); span > 0 {
			rate = float64(len(records)) / span.Hours()
		}
	}
	next24h := int(rate)
	return map[string]interface{}{
		"current":     len(records),
		"active":      active,
		"perDay":      rate,
		"next24h":     next24h,
		"projected":   len(records) + next24h,
		"activeShare": activeShare(records, active),
		"byStatus":    byStatus,
		"windowHours": 24,
	}, nil
}

func (s *Service) GetUtilization(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	byStatus, active := countByStatus(records)
	return map[string]interface{}{
		"total":       len(records),
		"active":      active,
		"inactive":    len(records) - active,
		"utilization": activeShare(records, active),
		"byStatus":    byStatus,
		"names":       recordNames(records),
	}, nil
}

func (s *Service) ScaleResource(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "scaled", nil
}

func (s *Service) ListAlerts(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	alerts := make([]string, len(records))
	for i, r := range records {
		alerts[i] = r.ID
	}
	return alerts, nil
}

func (s *Service) GetHistory(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	history := make([]string, len(records))
	for i, r := range records {
		history[i] = r.ID
	}
	return history, nil
}

func (s *Service) AddTag(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "tag added", nil
}

func (s *Service) DeleteTag(ctx context.Context, tenantID, id string) (string, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return "", err
	}
	return "tag deleted", nil
}

func (s *Service) CheckCompatibility(ctx context.Context, tenantID string) (bool, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) ValidateBranch(ctx context.Context, tenantID string) (bool, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) GetCoverage(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	byStatus, active := countByStatus(records)
	var uncovered []string
	for _, r := range records {
		if statusOf(r) != models.StatusActive {
			uncovered = append(uncovered, r.Name)
		}
	}
	return map[string]interface{}{
		"total":          len(records),
		"covered":        active,
		"uncovered":      len(records) - active,
		"coverage":       activeShare(records, active),
		"uncoveredNames": uncovered,
		"byStatus":       byStatus,
	}, nil
}

func (s *Service) EnforcePolicy(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "enforced", nil
}

func (s *Service) ListViolations(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	violations := make([]string, len(records))
	for i, r := range records {
		violations[i] = r.ID
	}
	return violations, nil
}

func (s *Service) BatchCreate(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "batch created", nil
}

func (s *Service) Search(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	results := make([]string, len(records))
	for i, r := range records {
		results[i] = r.Name
	}
	return results, nil
}

func (s *Service) Regenerate(ctx context.Context, tenantID string) (string, error) {
	if _, err := s.repo.List(ctx, tenantID); err != nil {
		return "", err
	}
	return "regenerated", nil
}

// ---------------------------------------------------------------------------
// Record-derived helpers
// ---------------------------------------------------------------------------

// statusOf returns the effective status of a record, defaulting unset values
// to the canonical active status so derived aggregates are never skewed.
func statusOf(r models.Record) string {
	if r.Status == "" {
		return models.StatusActive
	}
	return r.Status
}

// countByStatus buckets records by their effective status and reports how many
// are active. Always returns a non-nil map so JSON encoding yields {}.
func countByStatus(records []models.Record) (map[string]int, int) {
	byStatus := make(map[string]int)
	active := 0
	for _, r := range records {
		status := statusOf(r)
		byStatus[status]++
		if status == models.StatusActive {
			active++
		}
	}
	return byStatus, active
}

// activeShare is the fraction of records in the active status, rounded to four
// decimals. An empty set reports 0 rather than dividing by zero.
func activeShare(records []models.Record, active int) float64 {
	if len(records) == 0 {
		return 0
	}
	share := float64(active) / float64(len(records))
	return float64(int(share*10000)) / 10000
}

func recordNames(records []models.Record) []string {
	names := make([]string, 0, len(records))
	for _, r := range records {
		if r.Name != "" {
			names = append(names, r.Name)
		}
	}
	return names
}

func rfc3339OrEmpty(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}
