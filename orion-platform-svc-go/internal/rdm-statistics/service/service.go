// Package service implements the RDM statistics aggregation.
//
// Current implementation is a "no data source yet" stub: every endpoint
// returns a well-formed empty response so callers get 200 with the
// expected JSON shape ([]) or ({}) instead of 404.
//
// Design decision (see docs/adr/ADR-017 for pattern references):
//   - No DB dependency in the stub phase. Once RDM entity tables exist
//     (rdm_requirements / rdm_defects / rdm_tasks), inject a
//     repository.Repository via NewService(repo) and replace each
//     handler body with real SQL aggregation. The public method
//     signatures (GetBurndown / GetVelocity / GetDefectStats /
//     GetSprintStats) will NOT change.
//   - Tenant isolation is preserved: tenantID is passed through to the
//     stub even though it is unused. When the real aggregation lands,
//     tenant scoping is already the entry point.
package service

import (
	"context"

	"orion/platform-svc-go/internal/rdm-statistics/models"
)

// Repository is the future dependency for real aggregation.
// Not wired today; kept as an interface so the Service struct can
// evolve without breaking the handler.
type Repository interface{}

// Service computes RDM statistics. All methods are safe to call even
// when the underlying RDM entity tables do not exist yet.
type Service struct {
	repo Repository
}

// NewService constructs a Service. Pass nil for repo in the stub phase;
// pass a concrete *rdm.Repository once the RDM data model exists.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GetBurndown returns burndown points for a sprint.
// Returns an empty slice when no RDM tasks/requirements exist.
func (s *Service) GetBurndown(ctx context.Context, tenantID, sprintID string) ([]models.BurndownPoint, error) {
	// Stub: no data source. Return empty to satisfy the HTTP contract.
	_ = ctx
	_ = tenantID
	_ = sprintID
	return []models.BurndownPoint{}, nil
}

// GetVelocity returns velocity points across sprints.
// limit caps the number of sprints returned; <=0 defaults to 10.
func (s *Service) GetVelocity(ctx context.Context, tenantID, _ string, limit int) ([]models.VelocityPoint, error) {
	_ = ctx
	_ = tenantID
	_ = limit
	return []models.VelocityPoint{}, nil
}

// GetDefectStats returns defect counts grouped by severity and status.
// Empty groups (no data yet) are returned as empty slices so JSON
// marshals to [] rather than null.
func (s *Service) GetDefectStats(ctx context.Context, tenantID, _ string) (*models.DefectStats, error) {
	_ = ctx
	_ = tenantID
	return &models.DefectStats{
		BySeverity: []models.DefectBySeverity{},
		ByStatus:   []models.DefectByStatus{},
	}, nil
}

// GetSprintStats returns per-sprint aggregate stats.
func (s *Service) GetSprintStats(ctx context.Context, tenantID, _ string) (models.SprintSummaryList, error) {
	_ = ctx
	_ = tenantID
	return models.SprintSummaryList{}, nil
}
