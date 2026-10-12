package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/inspection/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
}

// problemsKey is the metadata key under which Engine results are persisted
// back into the record so GetResults can return them later.
const problemsKey = "problems"

// errorsKey is the metadata key under which per-collector errors are stored.
const errorsKey = "collector_errors"

type Service struct {
	repo    RepositoryInterface
	engine  *Engine
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo, engine: NewEngine()}
}

// WithEngine swaps the default no-op engine for one with real collectors.
// Called from wiring code after NewService.
func (s *Service) WithEngine(e *Engine) *Service {
	if e == nil {
		e = NewEngine()
	}
	s.engine = e
	return s
}

// WithCollectors registers collectors on the service engine.
func (s *Service) WithCollectors(cs ...Collector) *Service {
	for _, c := range cs {
		s.engine.WithCollector(c)
	}
	return s
}

// WithRules installs a threshold rule set on the service engine.
func (s *Service) WithRules(rules []ThresholdRule) *Service {
	s.engine.WithRules(rules)
	return s
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	if req.Status == "" {
		req.Status = models.StatusPending
	}
	if !IsValidStatus(req.Status) {
		return nil, fmt.Errorf("%w: %q", ErrUnknownStatus, req.Status)
	}
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	if req.Status != "" && !IsValidStatus(req.Status) {
		return nil, fmt.Errorf("%w: %q", ErrUnknownStatus, req.Status)
	}
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// RunInspection executes the engine against the record's config, persists
// problems + collector errors back into record.Metadata, and returns a real
// result summary. No error is swallowed — repository failures propagate.
func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		// Do NOT fabricate {"status":"ok"} here — propagate the failure so
		// the handler maps it to a real HTTP 404/500 (was silently 200
		// before S2-T1).
		return nil, err
	}

	// Snapshot name/config once so subsequent Updates don't depend on repo
	// mutating the record we just read.
	startName := rec.Name
	startMeta := cloneMeta(rec.Metadata)
	startStatus := rec.Status

	// Drive state: pending/warn/failed/passed → running (via Update).
	if startStatus != StatusRunning {
		if !CanTransition(startStatus, StatusRunning) {
			return nil, fmt.Errorf("inspection: cannot run from status %q", startStatus)
		}
		if _, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{
			Name:   startName,
			Status: StatusRunning,
			Config: startMeta,
		}); err != nil {
			return nil, err
		}
	}

	// Real execution: collector SPI + threshold evaluator.
	result := s.engine.Run(ctx, tenantID, startMeta)

	// Persist problems + errors into record.Metadata for later retrieval.
	meta := startMeta
	if meta == nil {
		meta = map[string]interface{}{}
	}
	probBytes, mErr := json.Marshal(result.Problems)
	if mErr == nil {
		meta[problemsKey] = probBytes
	}
	if len(result.Errors) > 0 {
		meta[errorsKey] = result.Errors
	}
	newStatus := result.FinalStatus()
	if !IsValidStatus(newStatus) {
		newStatus = StatusFailed
	}
	if _, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{
		Name:   startName,
		Status: newStatus,
		Config: meta,
	}); err != nil {
		// Persist failure of the terminal write — surface to caller, but
		// still return the in-memory engine result so the caller sees what
		// actually happened.
		return map[string]interface{}{
			"inspectionId":  id,
			"status":        StatusRunning,
			"collected":     result.Collected,
			"collectors":    result.Collectors,
			"problemCount":  len(result.Problems),
			"errors":        result.Errors,
			"persistError":  err.Error(),
		}, err
	}
	return map[string]interface{}{
		"inspectionId":  id,
		"status":        newStatus,
		"collected":     result.Collected,
		"collectors":    result.Collectors,
		"problemCount":  len(result.Problems),
		"finalStatus":   newStatus,
		"errors":        result.Errors,
	}, nil
}

// GetResults returns the persisted engine Problems for the record.
// Missing/empty metadata ⇒ empty slice (no fabricated data).
func (s *Service) GetResults(ctx context.Context, tenantID, id string) ([]models.Record, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if rec.Metadata == nil {
		return []models.Record{}, nil
	}
	probBytes, ok := rec.Metadata[problemsKey].([]byte)
	if !ok {
		return []models.Record{}, nil
	}
	var problems []Problem
	if err := json.Unmarshal(probBytes, &problems); err != nil || len(problems) == 0 {
		return []models.Record{}, nil
	}
	// Return one synthetic Record per problem — the existing handler shape
	// ([]models.Record) stays, so existing tests + clients keep working.
	out := make([]models.Record, 0, len(problems))
	for _, p := range problems {
		out = append(out, problemToRecord(rec, p))
	}
	return out, nil
}

// UpdateStatus validates the requested transition, persists it, and returns
// the resulting status. Illegal/unknown transitions return an error — no
// longer blind writes.
func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string, status string) (map[string]interface{}, error) {
	if !IsValidStatus(status) {
		return nil, fmt.Errorf("%w: %q", ErrUnknownStatus, status)
	}
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	previous := rec.Status
	startName := rec.Name
	startMeta := cloneMeta(rec.Metadata)
	if !CanTransition(previous, status) {
		return nil, fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, previous, status)
	}
	if _, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{
		Name:   startName,
		Status: status,
		Config: startMeta,
	}); err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"inspectionId": id,
		"newStatus":    status,
		"previous":     previous,
	}, nil
}

// ListTemplates returns templates filtered by metadata.kind=="template".
// Empty slice when no templates exist — no longer a silent alias to List.
func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.Record, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]models.Record, 0)
	for _, r := range records {
		if r.Metadata != nil {
			if kind, ok := r.Metadata["kind"].(string); ok && kind == "template" {
				out = append(out, r)
			}
		}
	}
	return out, nil
}

// GetStats computes aggregate statistics from inspection records.
func (s *Service) GetStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	stats := map[string]interface{}{
		"total":    len(records),
		"passed":   0,
		"failed":   0,
		"warnings": 0,
		"running":  0,
		"pending":  0,
		"cancelled": 0,
	}
	for _, r := range records {
		switch r.Status {
		case StatusPassed:
			stats["passed"] = stats["passed"].(int) + 1
		case StatusFailed:
			stats["failed"] = stats["failed"].(int) + 1
		case StatusWarning:
			stats["warnings"] = stats["warnings"].(int) + 1
		case StatusRunning:
			stats["running"] = stats["running"].(int) + 1
		case StatusPending:
			stats["pending"] = stats["pending"].(int) + 1
		case StatusCancelled:
			stats["cancelled"] = stats["cancelled"].(int) + 1
		}
	}
	return stats, nil
}

// GetHistory returns inspection record names as a history timeline.
func (s *Service) GetHistory(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return []string{}, nil
	}
	names := make([]string, len(records))
	for i, r := range records {
		names[i] = r.ID + ":" + r.Name
	}
	return names, nil
}

// BatchCreate creates multiple inspection records.
func (s *Service) BatchCreate(ctx context.Context, tenantID string, items []models.CreateRequest) (map[string]interface{}, error) {
	created := 0
	errs := make([]string, 0)
	for _, item := range items {
		if _, err := s.Create(ctx, tenantID, item); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", item.Name, err))
		} else {
			created++
		}
	}
	return map[string]interface{}{
		"status":  "ok",
		"created": created,
		"errors":  strings.Join(errs, "; "),
	}, nil
}

// cloneMeta returns a shallow copy of a metadata map (nil-safe).
func cloneMeta(m map[string]interface{}) map[string]interface{} {
	if m == nil {
		return nil
	}
	out := make(map[string]interface{}, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

// problemToRecord converts a single Problem into a Record whose
// Name/Status encode the problem. Preserves handler shape.
func problemToRecord(parent *models.Record, p Problem) models.Record {
	return models.Record{
		ID:       parent.ID + ":" + p.Name,
		TenantID: parent.TenantID,
		Name:     p.Name,
		Status:   p.Severity,
		Metadata: map[string]interface{}{
			"reason":  p.Reason,
			"value":   p.Value,
			"labels":  p.Labels,
		},
		CreatedAt: parent.CreatedAt,
		UpdatedAt: parent.UpdatedAt,
	}
}

// Ensure sentinel transitions do not get aliased into a non-nil pointer.
var _ = errors.New
